# Padel Metric — guía para Claude

App web (PWA) de marcador y estadísticas de pádel en directo. Sin servidor ni dependencias: HTML, CSS y JavaScript puro. Se publica en Netlify desde la rama `main` y se empaqueta para Google Play con PWABuilder.

El dueño del proyecto no es programador: explica los cambios en español y en lenguaje sencillo.

## Estructura

- `index.html`: solo el marcado (pantallas y modales). Los botones llaman a funciones globales con `onclick`.
- `css/styles.css`: todos los estilos. Colores en variables CSS en `:root` y `body.light-mode`.
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
  - `stats.js`, `poster.js`, `ranking.js` (incluye ELO), `history.js`, `app.js` (arranque, pestañas, instalación).
- `sw.js`: service worker (modo sin conexión). **Si añades un archivo JS/CSS, inclúyelo en `APP_FILES` y sube la versión de `CACHE`.**

## Datos

- Cada partido guarda `state.points`: un objeto por punto con `s` (set), `n` (nombre del jugador), `t` (`W`, `ENF`, `EF`, `DF`, `N` neutro), `sh` (golpe), `z` (zona `R` red/volea, `T` transición, `F` fondo), `l` (lado `D` drive / `V` revés), `w` (pareja ganadora), `sv` (índice del sacador), `sn` (1.º o 2.º saque), `bp` (bola de break), `gp` (punto de oro), `tb` (tie-break), `at` (segundo del partido).
- Los partidos antiguos no tienen `points`: todo el código nuevo debe funcionar sin ese campo.
- Claves de `localStorage`: `pm_jugadores_v5`, `pm_perfiles_v6`, `pm_historial_v5`, `pm_partido_activo_v14`, `pm_custom_cover`, `pm_theme_light`, `pm_voz`. No cambiarlas sin migrar los datos.
- Índices de jugadores: 0 y 1 = pareja 1, 2 y 3 = pareja 2.

## Cómo probar

```bash
python3 -m http.server 8765   # y abrir http://localhost:8765
```

Comprobar siempre: empezar un partido, registrar golpes en modo Toque y Gestos, deshacer, tie-break, súper tie-break, estadísticas (mapa de calor y pestaña Clave), ranking y ficha de jugador, en modo oscuro y claro, a 400 px de ancho.
