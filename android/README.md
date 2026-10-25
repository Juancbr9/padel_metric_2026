# App Android de Padel Metric

App nativa: lleva dentro los archivos de la web (la raíz del repositorio, copiados al compilar) y los abre en su propia
ventana, sin navegador. Compartir, descargas (copia de seguridad, Excel, pósters), portapapeles, vibración, pantalla
encendida y la voz del narrador van por Android (`MainActivity.java` y `js/nativo.js`). El botón atrás lo decide la web
(`window.__padelAtras` en `js/app.js`).

**Actualizaciones:** al abrirla con conexión mira la `CACHE` de `sw.js` publicada en https://padelmetric2026.netlify.app/;
si es otra, descarga la lista `APP_FILES` y la usa al volver a la app (`Web.java`), salvo en mitad de un partido en directo.
Por eso, al cambiar la web basta con subir `CACHE` y añadir a `APP_FILES` los archivos nuevos, como siempre. Solo hace
falta un APK nuevo si se cambia algo de esta carpeta (subir `versionCode` y `versionName`).

Compilar (Android SDK 35 y JDK 17+):

    export ANDROID_HOME=… PADEL_KEYSTORE=/ruta/padelmetric.keystore PADEL_KEYSTORE_PASS=…
    gradle assembleRelease   # → app/build/outputs/apk/release/app-release.apk

Después, copiar el APK a `descargas/PadelMetric.apk` para que se pueda descargar desde la web (menú → Descargar la app
para Android, visible en navegadores de Android).

La clave de firma no está en el repositorio (la tiene el dueño del proyecto). Hay que firmar siempre con la misma clave:
si cambia, los móviles no aceptan la actualización. Su huella SHA-256 está en `/.well-known/assetlinks.json`, que permite
que los enlaces de invitación (`https://padelmetric2026.netlify.app/#unirse=...`) abran la app directamente.
