# Padel Metric

Marcador, estadísticas y competiciones de pádel. Se instala en el móvil y funciona sin conexión.

**App publicada:** https://juancbr9.github.io/padel_metric_2026/ (GitHub Pages, rama `main`)

## Qué hace

**Navegación**: menú ☰ arriba a la izquierda con tu perfil y todas las secciones (Inicio, Jugar, Analizar y Más). Ajustes, copias de seguridad y novedades en hojas propias.

**Instalar y compartir**: menú → **Instalar y compartir la app**. Enlace, código QR (también como imagen para WhatsApp) y pasos para instalarla desde el navegador en Android y en iPhone (Safari → Compartir → Añadir a pantalla de inicio). En iPhone el inicio muestra un aviso para instalarla.

**Inicio**: botón de nuevo partido (o el partido en pausa), tu carta y tu temporada (si eliges quién eres en **¿Quién eres?**), competiciones en juego, último partido y top 3 del ranking. La primera vez se muestra una bienvenida. **Tema** oscuro, claro o automático (como el móvil) en Ajustes.

**Jugar**
- **Partido en directo**: marcador estilo televisión con apellidos, saque, bolas de break, de set y de partido (y cuántas seguidas), punto de oro, tie-break y súper tie-break. **Probabilidad de victoria** en directo (modelo punto → juego → set → partido que parte del ELO y se ajusta con lo que pasa en la pista). Tarjetas grandes de jugador: desliza hacia arriba para un winner o hacia abajo para un error no forzado y elige el golpe en una cuadrícula agrupada por zona (red, transición y fondo, cada una con su color), con un esquema de la trayectoria de cada golpe: volea, remate, dejada, bandeja, víbora, chiquita, golpe de fondo, bajada de pared, globo, resto y saque. Botones de punto por pareja, celebraciones de juego, break y set, y cierre del partido con el resumen y la curva de probabilidad. Cronómetro, narrador de voz y sonidos opcionales.
- **Directo para espectadores**: botón **Emitir** del partido. Genera un enlace y un código QR; quien lo abra sigue el marcador en su móvil o en una tele sin instalar nada.
- **Torneos**: eliminatoria con cuadro, liga todos contra todos, o fase de grupos con cuadro final. Cabezas de serie por ELO o sorteo, y parejas equilibradas automáticamente. Cada cruce se puede anotar a mano o jugar con el marcador en directo, y el resultado pasa solo al cuadro.
- **Americano y Mexicano**: Americano (cambias de pareja en cada ronda), Americano por parejas fijas, Mexicano (cruces según la clasificación), Mexicano mixto y Pozo (los ganadores suben de pista y los perdedores bajan). Admite cualquier número de jugadores y de pistas, con descansos rotativos. Tipos de partido: a puntos (16, 21, 24 o 32), juegos fijos, por tiempo (con cronómetro y aviso al acabar) o a un set (corto a 4, completo a 6 o pro set a 9).

**Analizar**
- **Mapa de calor de golpes**: zona de volea, transición y fondo, en el lado drive o revés.
- **Puntos clave**: gráfico de la probabilidad de victoria punto a punto (se puede recorrer con el dedo) y el **momento clave** del partido, bolas de break, puntos de oro, tie-breaks, rachas, saque y resto, más un análisis automático del partido.
- **Ranking ELO** con podio, forma reciente, cara a cara y rendimiento por parejas.
- **Carta de jugador**: una pista de pádel vista desde arriba con el jugador en un campo y sus números en el otro: media, ELO, balance y seis atributos (red, fondo, saque, resto, presión y regularidad) calculados con sus puntos. Cada jugador elige el color de su pista y puede poner la pala que usa; también hay imagen para compartir.
- **Empezar en un toque**: repetir el último partido, partido rápido sin jugadores, revancha al terminar y grupos de cuatro jugadores habituales.
- **Durante el partido**: modo sencillo (winner o error con un gesto) o avanzado (golpe y sitio exacto en la pista, vista desde donde estás), deshacer siempre a mano, guía la primera vez, terminar sin guardar y anotar con un mando Bluetooth o, en Android, con los botones de volumen.
- **Compartir**: imagen del resultado (también con la foto del grupo), imagen de estadísticas, resumen en texto con crónica con IA y enlace del partido. Las caras de la foto del grupo pueden pasar a ser las fotos de perfil (con IA).
- **Tu temporada en historias**: resumen en pantallas que pasan solas, con selector de temporada (cada año o toda la historia): partidos, mes a mes, ELO de la temporada, mejor partido, mejor pareja, rival, golpe (con su dibujo), presión, remontada, títulos, comparación con el año anterior, racha y carta. Se comparte como imagen vertical para historias (1080 × 1920).
- **Ficha de jugador**: evolución del ELO, rachas, sets y juegos, mejor compañero, rival más difícil, golpes ganadores, mapa de calor y últimos partidos.
- **Historial** en tarjetas agrupadas por mes, con búsqueda por jugador, filtros (mis partidos, torneo, masculino, femenino, mixto), mini gráfico de probabilidad, póster para WhatsApp y exportación a Excel.
- **Ranking** por pestañas: jugadores, parejas y cara a cara (enfrentamientos, comparación con barras y partidos entre ellos).

**Compartir**
- **Enlace del partido**: botón **Compartir** al acabar un partido, en sus opciones o en el historial. Crea un enlace y un QR con el resultado, las estadísticas de los cuatro jugadores y la curva de probabilidad. Se abre en cualquier móvil sin instalar nada y quien use Padel Metric puede **guardarlo en su historial**. Los datos van comprimidos dentro del propio enlace: no se suben a ningún servidor y el enlace no caduca.
- **Inscripción con QR** (americanos): en **Nuevo evento → Inscripción con QR**, cada jugador escanea el código y se apunta desde su móvil con su nombre (en el mixto, también si es hombre o mujer). La lista llega sola al evento, cada uno puede cambiar su nombre o borrarse y el organizador puede quitar a quien quiera. Al crear el evento, el mismo enlace pasa a mostrar la ronda en juego y la clasificación. Necesita ejecutar una vez `supabase/inscripcion.sql` en el proyecto de Supabase.
- **Perfil para compartir**: desde la ficha de un jugador (o su carta), **Compartir perfil** crea un enlace con su carta, el ELO y su evolución, el balance, la mejor pareja, el rival más difícil, los títulos y sus golpes. Se abre en cualquier móvil y muestra los datos del día en que se compartió.
- **Clasificación en directo**: en americanos, mexicanos, pozo y torneos, **Emitir en directo** genera un enlace y un QR. Jugadores y público ven la ronda en juego y la clasificación (o el cuadro) en su móvil o en una tele, y se actualiza sola con cada resultado.
- **Imágenes para WhatsApp** de clasificaciones de americanos, ligas, grupos y cuadros de torneo.
- **Sincronizar entre móviles**: un club compartido en Supabase (gratis) para que todo el grupo vea el mismo ranking, partidos, torneos y americanos. Guía en [`supabase/LEEME.md`](supabase/LEEME.md).

**Funcionamiento**
- Se abre al momento aunque haya poca cobertura en la pista (si la red tarda más de 3 segundos usa la versión guardada y se actualiza por detrás) y funciona sin conexión.
- **Accesos directos**: mantén pulsado el icono de la app para ir a Nuevo partido, Americano, Ranking o Historial.
- El botón atrás del móvil cierra hojas y menús antes de salir, y Escape hace lo mismo en el ordenador.
- **Copia de seguridad en un toque** (Ajustes → Datos): en el móvil se envía a Drive, WhatsApp, el correo o Archivos. Si no usas el club compartido, el inicio avisa cuando tienes partidos sin copia.
- Al borrar un partido del historial se puede **deshacer** durante unos segundos.
- Tras cada actualización se muestran una vez las **novedades** (también en Ajustes).

## Diseño

Sistema de diseño en [`DESIGN.md`](DESIGN.md): fondo negro, un único acento lima reservado para la acción principal, tipografía Barlow con cifras tabulares y una lista de "señales de diseño hecho con IA" que la app evita (franjas laterales de color, rótulos en mayúsculas encima de los títulos, recuadros de cifras, tarjetas dentro de tarjetas, iconos en todos los botones, desenfoques, degradados, contadores animados, saludos genéricos).

## Pruebas automáticas

`npm test` abre la app en un navegador sin ventana y comprueba la bienvenida, el menú, un partido completo (saque, golpes, deshacer, tie-break y cierre), el enlace del partido, la clasificación en directo, los datos (deshacer, copia, novedades y restaurar de fábrica), el botón atrás, el diseño (sin desbordes a 360 px en modo oscuro y claro), la inscripción con QR (cuatro jugadores apuntándose desde sus móviles) y el perfil para compartir. Necesita Node 18 o superior y Playwright (`npm install --no-save playwright` y `npx playwright install chromium`). En GitHub se ejecutan solas en cada subida a `main` (pestaña **Actions**).

## App para Android

`descargas/PadelMetric.apk` (también en el menú de la web desde un móvil Android → **Descargar la app para Android**). Es una app nativa que lleva la web dentro, funciona sin conexión y se actualiza sola cuando se publica una versión nueva de la web. Detalles en [`android/README.md`](android/README.md).

## Datos de ejemplo

`assets/demo/padel-metric-demo.json` trae 30 jugadores con nombres inventados (15 hombres y 15 mujeres de clubes ficticios), 73 partidos simulados punto a punto (masculinos, femeninos y mixtos), 3 torneos y 6 americanos (Americano, por parejas, Mexicano, Mexicano mixto y Pozo). Se carga desde el menú con **Cargar datos de ejemplo**, o importando el archivo con **Restaurar copia de seguridad**. Los resultados y estadísticas son simulados.

Al cargarlos, las fechas se mueven para que el último partido sea reciente. Se regeneran con `node tools/generar-datos-demo.mjs` (con el servidor local en marcha).

Para empezar de cero: menú → **Restaurar de fábrica** (permite exportar una copia antes de borrar).

## Estructura del código

Consulta [`CLAUDE.md`](CLAUDE.md).

## Publicar desde GitHub (como USAR)

La web ya está lista para GitHub Pages (rutas relativas y archivo `.nojekyll`). En GitHub:
1. **Settings → General → Danger Zone → Change visibility → Public** (GitHub Pages gratis solo funciona con repositorios públicos; las claves de firma del APK no están en el repositorio).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
3. En un par de minutos estará en `https://juancbr9.github.io/padel_metric_2026/`. La app usa como enlace para compartir la dirección desde la que se abre.
