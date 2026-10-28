# Padel Metric — guía para Claude

App web (PWA) de marcador y estadísticas de pádel en directo. Sin servidor ni dependencias: HTML, CSS y JavaScript puro. Se publica en Netlify desde la rama `main` y se empaqueta para Google Play con PWABuilder.

El dueño del proyecto no es programador: explica los cambios en español y en lenguaje sencillo.

## Estructura

- `index.html`: solo el marcado (pantallas y modales). Los botones llaman a funciones globales con `onclick`. La navegación es un menú desplegable superior (`#app-menu`) que se abre tocando el logo y el nombre de la app; no hay barra inferior ni botón ☰. Durante un partido en directo el menú queda bloqueado (se oculta el chevron `#main-nav`).
- El tamaño base es fluido (`html { font-size: clamp(...) }`): mide en `rem` para que todo escale con la pantalla.
- El sprite de iconos de `index.html` no puede usar `display:none` (rompería la máscara del logo).
- `assets/logo.svg` y `assets/logo-mark.svg`: logo vectorial (monograma "P." con pala perforada). Los PNG de `icons/` se generan a partir de él; el logo también está como `<symbol id="logo-mark">` en `index.html`.
- `css/styles.css`: todos los estilos. Colores en variables CSS en `:root` y `body.light-mode`.
  - Cada sección tiene su color de acento mediante `body[data-section]`: `match` lima, `events` violeta (torneos y americanos), `ranking` oro y `history` azul. Usa siempre `var(--volt)`, `rgba(var(--volt-rgb), x)`, `var(--volt-deep)` y `var(--on-volt)` en vez de colores fijos para que el acento cambie solo.
- `js/`: scripts clásicos (no módulos ES) que comparten el ámbito global. **El orden de carga en `index.html` importa.**
  - `core/state.js`: variables globales (`state` = partido en curso, `dbPlayers`, `dbProfiles`, `matchHistory`, `setupConfig`).
  - `core/storage.js`: `saveDB()` y perfiles. Todo se guarda en `localStorage`.
  - `core/utils.js`: utilidades (toast, vibración, avatares, portada, tema).
  - `fx.js` (tras `utils.js`): movimiento global (`fxEnter` al cambiar de sección, contadores con `data-count`/`data-dec`/`data-suffix`, cerrar hojas arrastrando), `fxConfetti()` y `fxSound()` (solo si `appSettings.sound`). Respeta `prefers-reduced-motion`.
  - `setup.js`: pantalla de convocatoria, reglas, previsión por ELO.
  - `players.js`: selector de jugadores, ficha y recorte de foto.
  - `winprob.js` (antes de `match/scoring.js`): probabilidad de victoria. Modelo de Markov punto → juego → set → partido con las reglas de la app; la previsión inicial sale del ELO (`initMatchWinProb`) y se ajusta con los puntos ganados al saque y al resto. Tras cada punto se guarda en `state.wp` y en el punto (`wp`); `state.wpStart` es la inicial. `wpSeries`, `wpKeyMoment` y `wpChartSVG` dibujan el gráfico.
  - Golpes: `SHOT_CATALOG` en `match/scoring.js` (volea, bandeja, víbora, remate, bajada de pared, golpe de fondo, globo, dejada, chiquita, resto y saque directo), cada uno con su dibujo `<symbol id="shot-…">` en `index.html` y su zona por defecto. Los winners suman en `p.shots[id]` y en su familia antigua (`group`: `Bandeja/Víbora`, `Fondo/Bajada`…); los errores en `p.errShots[id]`.
  - `match/scoring.js`: motor de puntuación (puntos, juegos, sets, tie-break, súper tie-break) y registro punto a punto. Orden de saque `NEXT_SERVER = [2, 3, 1, 0]` (las parejas se alternan); en el tie-break cambia cada dos puntos y el set siguiente lo empieza la pareja que restó el primer punto.
  - `match/live.js`: pantalla del partido (marcador de retransmisión, `liveChance()` para bolas de break/set/partido, `liveStatus()`, apellidos con `liveSurname`/`livePairName`), animaciones solo de lo que cambia (`setLiveText`/`replayAnim`), celebraciones (`celebrateEvent` con `state.lastEvent`), cierre del partido (`openMatchEnd`), opciones del partido (`openMatchOptions`) y tarjetas de jugador: deslizar ↑ = winner, ↓ = error no forzado, tocar = panel completo (`openShotSheet(idx, tipo)` con los dibujos de los golpes y la zona opcional). `state.inputMode`: `tap` = "Elegir golpe" (el gesto abre el panel), `swipe` = "Rápido" (anota al momento).
  - `match/voice.js`: narrador de voz del marcador.
  - `analysis.js`: cálculos a partir del registro punto a punto (zonas, puntos clave, saque, entrenador, logros).
  - `heatmap.js`: dibujo SVG del mapa de calor.
  - `stats.js` (incluye el panel de probabilidad de victoria y el momento clave en Puntos clave), `poster.js`, `ranking.js` (incluye ELO, podio y la ficha con la pestaña Carta), `history.js` (historial, copias de seguridad).
  - `card.js`: carta de jugador (`computePlayerCard`, `playerCardHTML`, inclinación con `initCardTilt`, imagen con `sharePlayerCard`) y perfil propio "Soy yo" (`myPlayerName`, `pm_yo_v1`) que personaliza el inicio.
  - `wrapped.js`: historias a pantalla completa (`openStories`): resumen de temporada (`openWrapped`) y bienvenida la primera vez (`maybeShowWelcome`, `pm_bienvenida_v1`).
  - `events/common.js`: utilidades de competición (selector de jugadores, modal de resultados, `escapeHtml`/`jsArg` están en `core/utils.js`).
  - `events/tournament.js`: torneos (eliminatoria, liga, grupos + cuadro). Un partido de torneo se puede jugar con el marcador: `startMatch({ kind: 'tournament', tid, mid })` y al terminar `applyLinkedMatchResult` anota el resultado en el cuadro.
  - `events/americano.js`: Americano, Americano por parejas, Mexicano, Mexicano mixto y Pozo (ganadores suben de pista, perdedores bajan; sin empates; múltiplo de 4 jugadores). Tipo de partido en `ev.matchType` (`points`, `games` = total fijo; `time` con cronómetro de ronda; `set` a 4, 6 o 9 con validación). Los eventos antiguos solo tienen `ev.points`: usa siempre `matchTypeOf(ev)`.
  - `share.js`: imágenes 1080×1350 para compartir clasificaciones y cuadros (usa el lienzo y el modal del póster).
  - `qr.js`: generador de códigos QR sin dependencias (`QR.svg(texto)`).
  - `directo.js`: directo para espectadores. El anotador publica `livePayload()` con `pm_live_publish` (código público + clave secreta en `state.live`, agrupando cambios y con latido cada 30 s); la vista `#directo=CÓDIGO` (`handleLiveHash`, `body.spectator-mode`) consulta `pm_live_get` cada 2,5 s.
  - `sync.js`: sincronización entre móviles con Supabase (club compartido). `saveDB()` llama a `trackChanges()` (pone `updatedAt` a lo que cambia y anota borrados en `syncMeta.deleted`) y a `scheduleSync()`. La fusión es por id con `updatedAt` y respeta los borrados. Al importar datos hay que poner `entityHashes = null` antes de `saveDB()` para no generar borrados. El SQL está en `supabase/setup.sql` y la guía en `supabase/LEEME.md`. Proyecto por defecto: `padel-metric` (ref `ijmxhzdgcwxihfzllnoj`, constantes `DEFAULT_SUPABASE_URL`/`DEFAULT_SUPABASE_KEY`); las claves `sb_publishable_` se envían solo en la cabecera `apikey`. Funciones RPC: `pm_get_club`, `pm_create_club` (código ≥ 20 caracteres), `pm_save_club` (control de versión, devuelve -1 si hay conflicto) y `pm_club_version` (consulta ligera cada minuto). Directo: tabla `pm_live` con `pm_live_publish` (solo con la clave secreta, 64 KB máx., borra directos de más de 3 días) y `pm_live_get`. Cualquier cambio de SQL hay que aplicarlo también en ese proyecto.
  - `home.js`: página de inicio (sección por defecto): resumen, partido en pausa, accesos rápidos, competiciones en juego, último partido y top 3.
  - `app.js`: navegación (`switchMainTab`, `SECTIONS`), menú, ajustes (`appSettings`), exportación CSV, instalación.
  - `history.js` también tiene `applyBackupData`, `loadDemoData` (datos de ejemplo) y `openFactoryReset`/`factoryReset` (borra todas las claves `pm_`).
- `assets/demo/padel-metric-demo.json`: datos de ejemplo (top 15 masculino y femenino, partidos simulados punto a punto con ventaja al saque y `wp`, torneos y americanos). Se regeneran con `tools/generar-datos-demo.mjs` (generador mulberry32). `loadDemoData` mueve las fechas (`shiftDemoDates`) para que el último partido sea reciente.
- `sw.js`: service worker (modo sin conexión). **Si añades un archivo JS/CSS, inclúyelo en `APP_FILES` y sube la versión de `CACHE`.** La app de Android usa esa misma lista para actualizarse sola.
- `android/`: app nativa (como la de USAR): WebView que sirve la web desde el APK y se actualiza desde Netlify. Ver `android/README.md`. `js/nativo.js` (se carga el primero) conecta con Android a través de `window.PadelNative`; en el navegador no hace nada. Las medidas de pantalla completa llegan como `--sa-t/--sa-b/--sa-l/--sa-r` en CSS. El APK publicado está en `descargas/PadelMetric.apk` y `/.well-known/assetlinks.json` tiene la huella de la firma.

## Datos

- Cada partido guarda `state.points`: un objeto por punto con `s` (set), `n` (nombre del jugador), `t` (`W`, `ENF`, `EF`, `DF`, `N` neutro), `sh` (golpe), `z` (zona `R` red/volea, `T` transición, `F` fondo), `l` (lado `D` drive / `V` revés), `w` (pareja ganadora), `sv` (índice del sacador), `sn` (1.º o 2.º saque), `bp` (bola de break), `gp` (punto de oro), `tb` (tie-break), `at` (segundo del partido), `svn` (nombre del sacador), `g` (juegos antes del punto), `pl` (marcador del juego antes del punto) y `wp` (probabilidad de victoria de la pareja 1 tras el punto).
- Los partidos antiguos no tienen `points`: todo el código nuevo debe funcionar sin ese campo.
- Claves de `localStorage`: `pm_jugadores_v5`, `pm_perfiles_v6`, `pm_historial_v5`, `pm_partido_activo_v14`, `pm_torneos_v1`, `pm_americanos_v1`, `pm_ajustes_v1`, `pm_sync_v1` (club), `pm_sync_meta_v1` (borrados), `pm_yo_v1` (perfil propio), `pm_bienvenida_v1` (bienvenida vista), `pm_custom_cover`, `pm_theme_light`, `pm_voz`. `appSettings` (`pm_ajustes_v1`) incluye `sound`. No cambiarlas sin migrar los datos. La copia de seguridad (JSON) incluye jugadores, perfiles, historial, torneos y americanos.
- Textos: tono profesional y descriptivo, sin emojis ni apodos (nada de "Rey de la pista").
- Índices de jugadores: 0 y 1 = pareja 1, 2 y 3 = pareja 2.

## Cómo probar

```bash
python3 -m http.server 8765   # y abrir http://localhost:8765
```

Comprobar siempre: bienvenida (con almacenamiento vacío), inicio, menú superior y cambio de sección, cargar datos de ejemplo y restaurar de fábrica, empezar un partido, registrar golpes en modo Toque y Gestos, deshacer, tie-break, súper tie-break, estadísticas (mapa de calor, puntos clave y gráfico de probabilidad), cierre del partido, emitir en directo y vista del espectador (con un servidor simulado), carta de jugador, Soy yo y historias de temporada, torneo con resultado manual y en directo, americano/mexicano con cada tipo de partido, compartir imagen, sincronización (con un servidor simulado), ranking y ficha de jugador, en modo oscuro y claro, a 400 px de ancho.
