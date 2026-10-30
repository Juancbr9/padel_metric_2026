# Padel Metric · Índice de activos de marca

Inventario de los activos visuales del proyecto: qué existe, dónde está, para qué se usa y cómo se regenera.
Las normas de uso (colores, tipografía, superficies, movimiento) están en [`DESIGN.md`](../DESIGN.md).

## Logotipo

| Archivo | Qué es | Uso |
|---|---|---|
| `assets/logo.svg` | Icono completo 512 × 512: fondo oscuro con esquinas redondeadas (r = 112), monograma "P" lima `#D4FF2A` con la cabeza de la pala perforada (19 agujeros) y el punto final blanco `#F8FAFC`. | Origen de los iconos de la app (`icons/`). No usarlo dentro de la interfaz. |
| `assets/logo-mark.svg` | Solo el monograma "P." recortado (viewBox `96 60 340 380`), sin fondo. Rellenos en `currentColor`. | Cualquier logo dentro de la interfaz, tintado con CSS. |
| `<symbol id="logo-mark">` en `index.html` | El mismo monograma dentro del sprite de iconos. | Cabecera (`.brand-emblem`), menú lateral (`.drawer-logo`), inicio, historias, vista del espectador. Se usa con `<svg><use href="#logo-mark"/></svg>`. |

Reglas del logo:
- Siempre sobre fondo oscuro (`#030508` o `#0D1117`) en lima `#D4FF2A`, o en blanco / gris sobre superficies claras. Nunca con degradados, sombras de color ni contornos.
- Área de respeto mínima: la mitad del ancho del monograma alrededor.
- Tamaño mínimo: 16 px de alto (icono de pestaña); en la interfaz, 24 px o más.
- El sprite de iconos **no puede** llevar `display:none` porque rompería la máscara de perforaciones: se oculta con `position:absolute; width:0; height:0; overflow:hidden`.
- Logotipo en texto: "PADEL METRIC" en `Barlow Condensed` 900 cursiva, mayúsculas, con un ligero espaciado. Es uno de los dos únicos usos permitidos de la cursiva (el otro es el marcador en directo).

## Iconos de la aplicación (PWA, Android, iPhone)

| Archivo | Tamaño | Uso |
|---|---|---|
| `icons/icon-192.png` | 192 × 192, con transparencia | Manifiesto (`purpose: any`). |
| `icons/icon-512.png` | 512 × 512, con transparencia | Manifiesto (`purpose: any`), pantalla de bienvenida de Android. |
| `icons/icon-maskable-512.png` | 512 × 512, fondo opaco | Manifiesto (`purpose: maskable`): Android recorta en círculo o en "squircle"; el monograma queda dentro de la zona segura (80 %). |
| `icons/apple-touch-icon.png` | 180 × 180, fondo opaco | iPhone / iPad (`<link rel="apple-touch-icon">`). |
| `android/app/src/main/res/` | Varios | Iconos adaptativos de la app nativa (primer plano + fondo), generados a partir del mismo logo. |

Los PNG se generan a partir de `assets/logo.svg`. Si cambia el logo, hay que regenerarlos todos (y los de `android/`) y subir la versión de `CACHE` en `sw.js` y el `versionCode` del APK.

## Iconografía de la interfaz

Sprite SVG al principio de `index.html` (`<svg style="position:absolute;width:0;height:0">`), con trazo de 2 px, extremos redondeados y relleno vacío (estilo lineal), en `viewBox="0 0 24 24"`:

- Navegación y acciones: `i-home`, `i-menu`, `i-close`, `i-chevron`, `i-plus`, `i-undo`, `i-trash`, `i-edit`, `i-save`, `i-download`, `i-upload`, `i-share`, `i-copy`, `i-qr`, `i-ios-share`, `i-file`, `i-camera`, `i-sliders`, `i-info`.
- Juego: `i-ball`, `i-bracket`, `i-shuffle`, `i-trophy`, `i-history`, `i-chart`, `i-target`, `i-flag`, `i-exit`, `i-swap`, `i-tap`, `i-swipe`, `i-play`, `i-play-circle`, `i-broadcast`, `i-tv`, `i-star`, `i-users`.
- Ajustes: `i-sun`, `i-moon`, `i-volume`, `i-volume-x`, `i-vibrate`, `i-screen`, `i-music`.

Se pintan con `class="icon"` (16 px) o `icon icon-lg` (20 px) y toman el color del texto (`currentColor`).

### Esquemas de golpes

`<symbol id="shot-…" viewBox="0 0 72 40">`: once esquemas de la pista vista de lado (cristal de fondo, suelo y red con la clase `shot-court`), la pala en el punto de impacto, la trayectoria de la bola y su bote. La jugada usa `currentColor`, que el panel tiñe según la zona (red, transición o fondo). Golpes: `volea`, `remate`, `dejada`, `bandeja`, `vibora`, `chiquita`, `fondo`, `bajada`, `globo`, `resto` y `saque`.

## Tipografías (Google Fonts)

| Familia | Pesos cargados | Uso |
|---|---|---|
| Barlow Condensed | 600–900, cursiva 700–900 | Logotipo y marcador en directo (cursiva); títulos de sección y nombres de jugador (recta, 700). |
| Plus Jakarta Sans | 500–800 | Texto de interfaz, botones, etiquetas. |
| JetBrains Mono | 600–800 | Cifras de marcador, cronómetros y estadísticas tabulares. |

## Imágenes generadas por la app

- **Póster del partido** y **clasificaciones** (1080 × 1350, `js/poster.js` y `js/share.js`): fondo oscuro plano, logo, título y tabla.
- **Carta de jugador** (`sharePlayerCard` en `js/card.js`) y **QR de la app** (`shareAppQR` en `js/install.js`).
- **Portada del partido** (`pm_custom_cover`): foto opcional del usuario sobre la cabecera de "Nuevo partido".

## Capturas

No hay capturas guardadas en el repositorio. Para revisar la interfaz se generan con Playwright (ver "Cómo probar" en `CLAUDE.md`) a 400 px de ancho, en modo oscuro y claro.

## Datos de ejemplo

`assets/demo/padel-metric-demo.json`: 30 jugadores (top 15 masculino y femenino del circuito profesional), partidos simulados punto a punto, torneos y americanos. No es un activo de marca, pero aparece en todas las capturas de demostración.
