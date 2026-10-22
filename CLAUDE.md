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
  - `setup.js`: pantalla de convocatoria, reglas, previsión por ELO.
  - `players.js`: selector de jugadores, ficha y recorte de foto.
  - `match/scoring.js`: motor de puntuación (puntos, juegos, sets, tie-break, súper tie-break) y registro punto a punto.
  - `match/live.js`: pantalla del partido, gestos, modal de golpes y selector de zona.
  - `match/voice.js`: narrador de voz del marcador.
  - `analysis.js`: cálculos a partir del registro punto a punto (zonas, puntos clave, saque, entrenador, logros).
  - `heatmap.js`: dibujo SVG del mapa de calor.
  - `stats.js`, `poster.js`, `ranking.js` (incluye ELO y podio), `history.js` (historial, copias de seguridad).
  - `events/common.js`: utilidades de competición (selector de jugadores, modal de resultados, `escapeHtml`/`jsArg` están en `core/utils.js`).
  - `events/tournament.js`: torneos (eliminatoria, liga, grupos + cuadro). Un partido de torneo se puede jugar con el marcador: `startMatch({ kind: 'tournament', tid, mid })` y al terminar `applyLinkedMatchResult` anota el resultado en el cuadro.
  - `events/americano.js`: Americano, Americano por parejas, Mexicano, Mexicano mixto y Pozo (ganadores suben de pista, perdedores bajan; sin empates; múltiplo de 4 jugadores).
  - `home.js`: página de inicio (sección por defecto): resumen, partido en pausa, accesos rápidos, competiciones en juego, último partido y top 3.
  - `app.js`: navegación (`switchMainTab`, `SECTIONS`), menú, ajustes (`appSettings`), exportación CSV, instalación.
  - `history.js` también tiene `applyBackupData`, `loadDemoData` (datos de ejemplo) y `openFactoryReset`/`factoryReset` (borra todas las claves `pm_`).
- `assets/demo/padel-metric-demo.json`: datos de ejemplo (top 15 masculino y femenino, partidos simulados punto a punto, torneos y americanos). Se regeneran con `tools/generar-datos-demo.mjs`.
- `sw.js`: service worker (modo sin conexión). **Si añades un archivo JS/CSS, inclúyelo en `APP_FILES` y sube la versión de `CACHE`.**

## Datos

- Cada partido guarda `state.points`: un objeto por punto con `s` (set), `n` (nombre del jugador), `t` (`W`, `ENF`, `EF`, `DF`, `N` neutro), `sh` (golpe), `z` (zona `R` red/volea, `T` transición, `F` fondo), `l` (lado `D` drive / `V` revés), `w` (pareja ganadora), `sv` (índice del sacador), `sn` (1.º o 2.º saque), `bp` (bola de break), `gp` (punto de oro), `tb` (tie-break), `at` (segundo del partido).
- Los partidos antiguos no tienen `points`: todo el código nuevo debe funcionar sin ese campo.
- Claves de `localStorage`: `pm_jugadores_v5`, `pm_perfiles_v6`, `pm_historial_v5`, `pm_partido_activo_v14`, `pm_torneos_v1`, `pm_americanos_v1`, `pm_ajustes_v1`, `pm_custom_cover`, `pm_theme_light`, `pm_voz`. No cambiarlas sin migrar los datos. La copia de seguridad (JSON) incluye jugadores, perfiles, historial, torneos y americanos.
- Textos: tono profesional y descriptivo, sin emojis ni apodos (nada de "Rey de la pista").
- Índices de jugadores: 0 y 1 = pareja 1, 2 y 3 = pareja 2.

## Cómo probar

```bash
python3 -m http.server 8765   # y abrir http://localhost:8765
```

Comprobar siempre: inicio, menú superior y cambio de sección, cargar datos de ejemplo y restaurar de fábrica, empezar un partido, registrar golpes en modo Toque y Gestos, deshacer, tie-break, súper tie-break, estadísticas (mapa de calor y puntos clave), torneo con resultado manual y en directo, americano/mexicano, ranking y ficha de jugador, en modo oscuro y claro, a 400 px de ancho.
