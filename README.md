# Padel Metric

Marcador, estadísticas y competiciones de pádel. Se instala en el móvil y funciona sin conexión.

**App publicada:** https://padelmetric2026.netlify.app

## Qué hace

**Navegación**: menú ☰ arriba a la izquierda con todas las secciones (Jugar, Analizar, Mi pádel, Compartir y Aplicación). Ajustes y copias de seguridad en hojas propias.

**Instalar y compartir**: menú → **Instalar y compartir la app**. Enlace, código QR (también como imagen para WhatsApp) y pasos para instalarla desde el navegador en Android y en iPhone (Safari → Compartir → Añadir a pantalla de inicio). En iPhone el inicio muestra un aviso para instalarla.

**Inicio**: resumen de actividad, tu carta y tu temporada (si eliges tu perfil con **Soy yo**), partido en pausa, competiciones en juego, último partido y top 3 del ranking. La primera vez se muestra una bienvenida.

**Jugar**
- **Partido en directo**: marcador estilo televisión con apellidos, saque, bolas de break, de set y de partido (y cuántas seguidas), punto de oro, tie-break y súper tie-break. **Probabilidad de victoria** en directo (modelo punto → juego → set → partido que parte del ELO y se ajusta con lo que pasa en la pista). Tarjetas grandes de jugador: desliza hacia arriba para un winner o hacia abajo para un error no forzado y elige el golpe (volea, bandeja, víbora, remate, bajada de pared, golpe de fondo, globo, dejada, chiquita, resto o saque) en una cuadrícula con un dibujo de cada uno. Botones de punto por pareja, celebraciones de juego, break y set, y cierre del partido con el resumen y la curva de probabilidad. Cronómetro, narrador de voz y sonidos opcionales.
- **Directo para espectadores**: botón **Emitir** del partido. Genera un enlace y un código QR; quien lo abra sigue el marcador en su móvil o en una tele sin instalar nada.
- **Torneos**: eliminatoria con cuadro, liga todos contra todos, o fase de grupos con cuadro final. Cabezas de serie por ELO o sorteo, y parejas equilibradas automáticamente. Cada cruce se puede anotar a mano o jugar con el marcador en directo, y el resultado pasa solo al cuadro.
- **Americano y Mexicano**: Americano (cambias de pareja en cada ronda), Americano por parejas fijas, Mexicano (cruces según la clasificación), Mexicano mixto y Pozo (los ganadores suben de pista y los perdedores bajan). Admite cualquier número de jugadores y de pistas, con descansos rotativos. Tipos de partido: a puntos (16, 21, 24 o 32), juegos fijos, por tiempo (con cronómetro y aviso al acabar) o a un set (corto a 4, completo a 6 o pro set a 9).

**Analizar**
- **Mapa de calor de golpes**: zona de volea, transición y fondo, en el lado drive o revés.
- **Puntos clave**: gráfico de la probabilidad de victoria punto a punto (se puede recorrer con el dedo) y el **momento clave** del partido, bolas de break, puntos de oro, tie-breaks, rachas, saque y resto, más un análisis automático del partido.
- **Ranking ELO** con podio, forma reciente, cara a cara y rendimiento por parejas.
- **Carta de jugador**: media y seis atributos (red, fondo, saque, resto, presión y regularidad) calculados con sus puntos, nivel bronce, plata, oro o élite, y imagen para compartir.
- **Tu temporada en historias**: resumen del año en pantallas que pasan solas (partidos, ELO, mejor pareja, rival, golpe, presión, remontada, racha y carta).
- **Ficha de jugador**: evolución del ELO, rachas, sets y juegos, mejor compañero, rival más difícil, golpes ganadores, mapa de calor y últimos partidos.
- **Historial** en tarjetas agrupadas por mes, con búsqueda por jugador, filtros (mis partidos, torneo, masculino, femenino, mixto), mini gráfico de probabilidad, póster para WhatsApp y exportación a Excel.
- **Ranking** por pestañas: jugadores, parejas y cara a cara (enfrentamientos, comparación con barras y partidos entre ellos).

**Compartir**
- **Imágenes para WhatsApp** de clasificaciones de americanos, ligas, grupos y cuadros de torneo.
- **Sincronizar entre móviles**: un club compartido en Supabase (gratis) para que todo el grupo vea el mismo ranking, partidos, torneos y americanos. Guía en [`supabase/LEEME.md`](supabase/LEEME.md).

## App para Android

`descargas/PadelMetric.apk` (también en el menú de la web desde un móvil Android → **Descargar la app para Android**). Es una app nativa que lleva la web dentro, funciona sin conexión y se actualiza sola cuando se publica una versión nueva de la web. Detalles en [`android/README.md`](android/README.md).

## Datos de ejemplo

`assets/demo/padel-metric-demo.json` trae 30 jugadores (top 15 masculino y top 15 femenino del circuito profesional), 73 partidos simulados punto a punto (masculinos, femeninos y mixtos), 3 torneos y 6 americanos (Americano, por parejas, Mexicano, Mexicano mixto y Pozo). Se carga desde el menú con **Cargar datos de ejemplo**, o importando el archivo con **Restaurar copia de seguridad**. Los resultados y estadísticas son simulados.

Al cargarlos, las fechas se mueven para que el último partido sea reciente. Se regeneran con `node tools/generar-datos-demo.mjs` (con el servidor local en marcha).

Para empezar de cero: menú → **Restaurar de fábrica** (permite exportar una copia antes de borrar).

## Estructura del código

Consulta [`CLAUDE.md`](CLAUDE.md).

## Publicar desde GitHub (como USAR)

La web ya está lista para GitHub Pages (rutas relativas y archivo `.nojekyll`). En GitHub:
1. **Settings → General → Danger Zone → Change visibility → Public** (GitHub Pages gratis solo funciona con repositorios públicos; las claves de firma del APK no están en el repositorio).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
3. En un par de minutos estará en `https://juancbr9.github.io/padel_metric_2026/`. La app usa como enlace para compartir la dirección desde la que se abre.
