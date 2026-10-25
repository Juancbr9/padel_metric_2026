package io.github.juancbr9.padelmetric;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONArray;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Locale;

/** Ventana de la app: la web de Padel Metric servida desde dentro del APK, con compartir, archivos, voz y vibración de Android. */
public class MainActivity extends Activity {
    private static final String ORIGEN = "https://appassets.androidplatform.net/";
    private static final int ELEGIR_ARCHIVO = 4;

    private WebView web;
    private FrameLayout marco;
    private Web archivos;
    private volatile boolean hayVersionNueva;
    private ValueCallback<Uri[]> archivoPendiente;
    private final ArrayList<Uri> preparados = new ArrayList<>();
    private volatile String margenes = "{}";
    private TextToSpeech voz;
    private boolean vozLista;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        archivos = new Web(this);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#06090F"));
        marco = new FrameLayout(this);
        marco.addView(web);
        setContentView(marco);
        pantallaCompleta();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " PadelMetricApp");

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
                @Override
                public WebResourceResponse shouldInterceptRequest(@NonNull WebResourceRequest r) { return servir(r.getUrl()); }
            });
        }
        web.addJavascriptInterface(new Puente(), "PadelNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) { return servir(r.getUrl()); }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String url = r.getUrl().toString();
                if (url.startsWith(ORIGEN)) return false;
                if (url.startsWith(Web.PUBLICA)) { v.loadUrl(local(url)); return true; }
                abrirFuera(url);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (archivoPendiente != null) archivoPendiente.onReceiveValue(null);
                archivoPendiente = cb;
                try {
                    Intent i = p.createIntent();
                    if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    startActivityForResult(Intent.createChooser(i, null), ELEGIR_ARCHIVO);
                } catch (ActivityNotFoundException e) {
                    archivoPendiente = null;
                    return false;
                }
                return true;
            }
        });
        web.setDownloadListener((url, ua, cd, tipo, largo) -> abrirFuera(url));

        if (estado == null || web.restoreState(estado) == null) web.loadUrl(local(enlace(getIntent())));
        buscarVersion();
    }

    /** La web se dibuja también bajo la barra de estado y la de gestos; sus medidas van a la web
     *  (--sa-t, --sa-b, --sa-l, --sa-r en js/nativo.js) para que la cabecera ocupe la franja de arriba sin tapar nada. */
    private void pantallaCompleta() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams p = getWindow().getAttributes();
            p.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30 ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(p);
        }
        barraClara(false);
        ViewCompat.setOnApplyWindowInsetsListener(marco, (v, ins) -> {
            Insets b = ins.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            int teclado = ins.getInsets(WindowInsetsCompat.Type.ime()).bottom;
            // Con el teclado abierto la web se encoge sobre él (como adjustResize) y abajo ya no hay margen
            v.setPadding(0, 0, 0, teclado);
            float d = getResources().getDisplayMetrics().density;
            margenes = "{\"t\":" + Math.round(b.top / d) + ",\"b\":" + (teclado > 0 ? 0 : Math.round(b.bottom / d))
                    + ",\"l\":" + Math.round(b.left / d) + ",\"r\":" + Math.round(b.right / d) + "}";
            web.evaluateJavascript("window.__padelMargenes && window.__padelMargenes(" + margenes + ")", null);
            return WindowInsetsCompat.CONSUMED;
        });
    }

    /** Iconos de la barra de estado: blancos con el tema oscuro y oscuros con el claro */
    private void barraClara(boolean clara) {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), marco);
        c.setAppearanceLightStatusBars(clara);
        c.setAppearanceLightNavigationBars(clara);
        getWindow().getDecorView().setBackgroundColor(Color.parseColor(clara ? "#F1F5F9" : "#06090F"));
    }

    private WebResourceResponse servir(Uri u) {
        if (!"appassets.androidplatform.net".equals(u.getHost())) return null;
        String ruta = u.getPath() == null ? "" : u.getPath();
        return archivos.abrir(ruta.startsWith("/") ? ruta.substring(1) : ruta);
    }

    /** https://padelmetric2026.netlify.app/#unirse=... → la misma pantalla dentro de la app */
    private static String local(String url) {
        if (url == null || !url.startsWith(Web.PUBLICA)) return ORIGEN + "index.html";
        int h = url.indexOf('#');
        return ORIGEN + "index.html" + (h >= 0 ? url.substring(h) : "");
    }

    private static String enlace(Intent i) {
        return i != null && i.getData() != null ? i.getData().toString() : null;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        String url = enlace(i);
        // La app ya está abierta: solo cambia la parte de después de "#", así no se pierde nada de lo que hay en pantalla
        if (url != null && url.startsWith(Web.PUBLICA) && url.contains("#")) {
            String hash = url.substring(url.indexOf('#'));
            web.evaluateJavascript("location.hash = " + org.json.JSONObject.quote(hash), null);
        } else if (url != null) {
            web.loadUrl(local(url));
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        // Una versión nueva descargada se aplica al volver a la app (si no hay un partido en directo)
        if (hayVersionNueva) {
            web.evaluateJavascript("document.body && document.body.classList.contains('in-live-match')", r -> {
                if (!"true".equals(r)) { hayVersionNueva = false; web.reload(); }
            });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        buscarVersion();
    }

    private long ultimaBusqueda;
    private void buscarVersion() {
        long ahora = System.currentTimeMillis();
        if (ahora - ultimaBusqueda < 10 * 60 * 1000) return;
        ultimaBusqueda = ahora;
        new Thread(() -> { if (archivos.actualizar()) hayVersionNueva = true; }).start();
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle b) {
        super.onSaveInstanceState(b);
        web.saveState(b);
    }

    /** Atrás: la web decide (cerrar menú o ventanas, volver a Inicio...). Si no hace nada, se sale de la app. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.__padelAtras ? window.__padelAtras() : false", r -> {
            if (!"true".equals(r)) MainActivity.super.onBackPressed();
        });
    }

    @Override
    protected void onDestroy() {
        if (voz != null) voz.shutdown();
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int codigo, int resultado, Intent datos) {
        super.onActivityResult(codigo, resultado, datos);
        if (codigo != ELEGIR_ARCHIVO || archivoPendiente == null) return;
        Uri[] elegidos = null;
        if (resultado == RESULT_OK && datos != null) {
            if (datos.getClipData() != null) {
                ClipData c = datos.getClipData();
                elegidos = new Uri[c.getItemCount()];
                for (int i = 0; i < c.getItemCount(); i++) elegidos[i] = c.getItemAt(i).getUri();
            } else if (datos.getData() != null) elegidos = new Uri[]{datos.getData()};
        }
        archivoPendiente.onReceiveValue(elegidos);
        archivoPendiente = null;
    }

    private void abrirFuera(String url) {
        if (url.startsWith(ORIGEN)) url = Web.PUBLICA + url.substring(ORIGEN.length());
        try {
            Intent i = url.startsWith("intent:") ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception ignored) { }
    }

    /** Lo que la web puede pedir a Android (js/nativo.js) */
    private class Puente {
        @JavascriptInterface
        public String urlPublica() { return Web.PUBLICA; }

        @JavascriptInterface
        public String version() { return archivos.version(); }

        @JavascriptInterface
        public String versionApp() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public String margenes() { return margenes; }

        @JavascriptInterface
        public void temaClaro(boolean clara) { runOnUiThread(() -> barraClara(clara)); }

        @JavascriptInterface
        public boolean prepararArchivo(String base64, String nombre, String tipo) {
            try {
                File d = new File(getCacheDir(), "compartir");
                //noinspection ResultOfMethodCallIgnored
                d.mkdirs();
                File f = new File(d, nombre.replaceAll("[\\\\/:*?\"<>|]", "_"));
                try (FileOutputStream out = new FileOutputStream(f)) { out.write(Base64.decode(base64, Base64.DEFAULT)); }
                synchronized (preparados) { preparados.add(FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".archivos", f)); }
                return true;
            } catch (IOException | IllegalArgumentException e) { return false; }
        }

        @JavascriptInterface
        public void compartirArchivos(String titulo, String tipo) {
            ArrayList<Uri> uris;
            synchronized (preparados) { uris = new ArrayList<>(preparados); preparados.clear(); }
            if (uris.isEmpty()) return;
            Intent i = new Intent(uris.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
            i.setType(tipo == null || tipo.isEmpty() ? "*/*" : tipo);
            if (uris.size() == 1) i.putExtra(Intent.EXTRA_STREAM, uris.get(0)); else i.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
            ClipData c = ClipData.newRawUri("", uris.get(0));
            for (int n = 1; n < uris.size(); n++) c.addItem(new ClipData.Item(uris.get(n)));
            i.setClipData(c);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(i, titulo == null || titulo.isEmpty() ? "Guardar o compartir" : titulo));
        }

        @JavascriptInterface
        public void compartirTexto(String texto, String titulo) {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto);
            if (titulo != null && !titulo.isEmpty()) i.putExtra(Intent.EXTRA_SUBJECT, titulo);
            startActivity(Intent.createChooser(i, null));
        }

        @JavascriptInterface
        public void abrir(String url) { runOnUiThread(() -> abrirFuera(url)); }

        @JavascriptInterface
        public void copiar(String texto) {
            ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("Padel Metric", texto));
        }

        @JavascriptInterface
        public void pantallaEncendida(boolean si) {
            runOnUiThread(() -> {
                if (si) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void vibrar(String patron) {
            try {
                JSONArray a = new JSONArray(patron);
                long[] t = new long[a.length() + 1];
                for (int i = 0; i < a.length(); i++) t[i + 1] = a.getLong(i);
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v == null || t.length < 2) return;
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(t, -1)); else v.vibrate(t, -1);
            } catch (Exception ignored) { }
        }

        /** Narrador del marcador con la voz de Android (la ventana web no trae voz propia) */
        @JavascriptInterface
        public void hablar(String texto) {
            runOnUiThread(() -> {
                if (voz == null) {
                    voz = new TextToSpeech(MainActivity.this, st -> {
                        vozLista = st == TextToSpeech.SUCCESS;
                        if (vozLista) {
                            voz.setLanguage(new Locale("es", "ES"));
                            voz.speak(texto, TextToSpeech.QUEUE_FLUSH, null, "pm");
                        }
                    });
                } else if (vozLista) {
                    voz.speak(texto, TextToSpeech.QUEUE_FLUSH, null, "pm");
                }
            });
        }
    }
}
