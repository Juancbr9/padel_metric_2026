package io.github.juancbr9.padelmetric;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Archivos de la web dentro de la app.
 * Se sirven desde la última versión descargada (files/www) y, si falta algo, desde la que trae el APK (assets/www)
 * o, en último caso, desde la web publicada.
 * La versión es la CACHE de sw.js y los archivos son su lista APP_FILES: al subir CACHE en la web, la app la descarga.
 */
class Web {
    static final String PUBLICA = "https://juancbr9.github.io/padel_metric_2026/";
    private static final Pattern VERSION = Pattern.compile("const CACHE = '([^']+)'");
    private static final Pattern LISTA = Pattern.compile("const APP_FILES = \\[([^\\]]*)\\]");
    private static final Pattern ARCHIVO = Pattern.compile("'([^']+)'");

    private final Context ctx;
    private final SharedPreferences prefs;
    private final File dir;

    Web(Context ctx) {
        this.ctx = ctx;
        prefs = ctx.getSharedPreferences("web", Context.MODE_PRIVATE);
        dir = new File(ctx.getFilesDir(), "www");
        // Con un APK nuevo manda la web que trae dentro, salvo que se descargue otra más nueva
        long apk = versionApk();
        if (prefs.getLong("apk", -1) != apk) {
            borrar(dir);
            prefs.edit().putLong("apk", apk).remove("version").apply();
        }
    }

    WebResourceResponse abrir(String ruta) {
        if (ruta.isEmpty() || ruta.endsWith("/")) ruta += "index.html";
        if (ruta.contains("..")) return null;
        InputStream in = null;
        try {
            File f = new File(dir, ruta);
            if (f.isFile()) in = new FileInputStream(f);
        } catch (IOException ignored) { }
        if (in == null) try { in = ctx.getAssets().open("www/" + ruta); } catch (IOException ignored) { }
        if (in == null) try { in = descargar(PUBLICA + ruta); } catch (IOException e) { return null; }
        WebResourceResponse r = new WebResourceResponse(tipo(ruta), tipo(ruta).startsWith("text/") || ruta.endsWith(".js") ? "utf-8" : null, in);
        java.util.Map<String, String> h = new java.util.HashMap<>();
        h.put("Cache-Control", "no-cache");
        r.setResponseHeaders(h);
        return r;
    }

    String version() {
        String v = prefs.getString("version", null);
        if (v != null) return v;
        try (InputStream in = ctx.getAssets().open("www/sw.js")) {
            Matcher m = VERSION.matcher(texto(in));
            return m.find() ? m.group(1) : "";
        } catch (IOException e) { return ""; }
    }

    /** Descarga la versión publicada si es distinta. Devuelve true si hay una nueva lista para usar. */
    boolean actualizar() {
        try {
            String sw = texto(descargar(PUBLICA + "sw.js"));
            Matcher v = VERSION.matcher(sw), l = LISTA.matcher(sw);
            if (!v.find() || !l.find() || v.group(1).equals(version())) return false;
            List<String> archivos = new ArrayList<>();
            Matcher a = ARCHIVO.matcher(l.group(1));
            while (a.find()) archivos.add(a.group(1).equals("./") ? "index.html" : a.group(1).replaceFirst("^\\./", ""));
            archivos.add("sw.js");
            File nuevo = new File(ctx.getFilesDir(), "www-nuevo");
            borrar(nuevo);
            for (String ruta : archivos) {
                if (ruta.contains("..")) return false;
                File f = new File(nuevo, ruta);
                //noinspection ResultOfMethodCallIgnored
                f.getParentFile().mkdirs();
                try (InputStream in = descargar(PUBLICA + ruta); OutputStream out = new FileOutputStream(f)) { copiar(in, out); }
            }
            File viejo = new File(ctx.getFilesDir(), "www-viejo");
            borrar(viejo);
            if (dir.exists() && !dir.renameTo(viejo)) return false;
            if (!nuevo.renameTo(dir)) return false;
            borrar(viejo);
            prefs.edit().putString("version", v.group(1)).apply();
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    private static InputStream descargar(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
        c.setRequestProperty("Cache-Control", "no-cache");
        if (c.getResponseCode() != 200) { c.disconnect(); throw new IOException(url + ": " + c.getResponseCode()); }
        return c.getInputStream();
    }

    private static String texto(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InputStream i = in) { copiar(i, out); }
        return out.toString(StandardCharsets.UTF_8.name());
    }

    private static void copiar(InputStream in, OutputStream out) throws IOException {
        byte[] b = new byte[16384];
        for (int n; (n = in.read(b)) > 0; ) out.write(b, 0, n);
    }

    private static void borrar(File f) {
        File[] hijos = f.listFiles();
        if (hijos != null) for (File h : hijos) borrar(h);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    static String tipo(String ruta) {
        String ext = ruta.substring(ruta.lastIndexOf('.') + 1).toLowerCase();
        switch (ext) {
            case "html": return "text/html";
            case "js": case "mjs": return "text/javascript";
            case "css": return "text/css";
            case "json": case "webmanifest": return "application/json";
            case "svg": return "image/svg+xml";
            case "webp": return "image/webp";
            case "png": return "image/png";
        }
        String t = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return t != null ? t : "application/octet-stream";
    }

    private long versionApk() {
        try {
            PackageInfo p = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            return p.lastUpdateTime;
        } catch (Exception e) { return 0; }
    }
}
