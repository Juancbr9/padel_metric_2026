# Padel Metric

Marcador, estadísticas y competiciones de pádel. Se instala en el móvil y funciona sin conexión.

**App publicada:** https://padelmetric2026.netlify.app

## Qué hace

**Inicio**: resumen de actividad, partido en pausa, competiciones en juego, último partido y top 3 del ranking.

**Jugar**
- **Partido en directo**: ventaja, star point o punto de oro; tercer set completo o súper tie-break; cambios de lado, bolas de break, cronómetro y narrador de voz.
- **Torneos**: eliminatoria con cuadro, liga todos contra todos, o fase de grupos con cuadro final. Cabezas de serie por ELO o sorteo, y parejas equilibradas automáticamente. Cada cruce se puede anotar a mano o jugar con el marcador en directo, y el resultado pasa solo al cuadro.
- **Americano y Mexicano**: Americano (cambias de pareja en cada ronda), Americano por parejas fijas, Mexicano (cruces según la clasificación), Mexicano mixto y Pozo (los ganadores suben de pista y los perdedores bajan). Admite cualquier número de jugadores y de pistas, con descansos rotativos. Tipos de partido: a puntos (16, 21, 24 o 32), juegos fijos, por tiempo (con cronómetro y aviso al acabar) o a un set (corto a 4, completo a 6 o pro set a 9).

**Analizar**
- **Mapa de calor de golpes**: zona de volea, transición y fondo, en el lado drive o revés.
- **Puntos clave**: bolas de break, puntos de oro, tie-breaks, rachas, saque y resto, más un análisis automático del partido.
- **Ranking ELO** con podio, forma reciente, cara a cara y rendimiento por parejas.
- **Ficha de jugador**: evolución del ELO, rachas, sets y juegos, mejor compañero, rival más difícil, golpes ganadores, mapa de calor y últimos partidos.
- **Historial** con resumen de actividad, póster para WhatsApp y exportación a Excel.

**Compartir**
- **Imágenes para WhatsApp** de clasificaciones de americanos, ligas, grupos y cuadros de torneo.
- **Sincronizar entre móviles**: un club compartido en Supabase (gratis) para que todo el grupo vea el mismo ranking, partidos, torneos y americanos. Guía en [`supabase/LEEME.md`](supabase/LEEME.md).

## App para Android

`descargas/PadelMetric.apk` (también en el menú de la web desde un móvil Android → **Descargar la app para Android**). Es una app nativa que lleva la web dentro, funciona sin conexión y se actualiza sola cuando se publica una versión nueva de la web. Detalles en [`android/README.md`](android/README.md).

## Datos de ejemplo

`assets/demo/padel-metric-demo.json` trae 30 jugadores (top 15 masculino y top 15 femenino del circuito profesional), 73 partidos simulados punto a punto (masculinos, femeninos y mixtos), 3 torneos y 6 americanos (Americano, por parejas, Mexicano, Mexicano mixto y Pozo). Se carga desde el menú con **Cargar datos de ejemplo**, o importando el archivo con **Restaurar copia de seguridad**. Los resultados y estadísticas son simulados.

Para empezar de cero: menú → **Restaurar de fábrica** (permite exportar una copia antes de borrar).

## Estructura del código

Consulta [`CLAUDE.md`](CLAUDE.md).
