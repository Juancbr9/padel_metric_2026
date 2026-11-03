# Padel Metric · Sistema de diseño

Fuente de verdad visual de la app. **Cualquier cambio estético debe cumplir este documento.** Si algo no está aquí, se decide siguiendo su espíritu: deportivo, sobrio y funcional, en la línea de Apple Sports, Premier Padel y Strava. La lógica (`js/`) y las claves de `localStorage` no forman parte del diseño y no se tocan por motivos estéticos.

Activos de marca (logo, iconos, tipografías): [`docs/brand-index.md`](docs/brand-index.md).

---

## 1. Principios

1. **El dato es el protagonista.** Marcadores, cifras y nombres mandan; la decoración no compite con ellos.
2. **Negro de verdad.** Fondo OLED, superficies planas y bordes finísimos. La profundidad se consigue con capas de gris, no con brillos ni desenfoques.
3. **Un solo acento, y poco.** El lima `#D4FF2A` es para la acción principal de cada pantalla, el saque y los interruptores encendidos. No tiñe cifras, pestañas, etiquetas ni barras.
4. **Color con significado.** Cian y rojo solo identifican a la pareja 1 y la pareja 2. Verde, ámbar y rojo de estado solo indican resultado (winner, error, aviso).
5. **Decisiones propias, no valores por defecto.** Cada elemento tiene un motivo: si un adorno no informa, sobra (ver "Señales de diseño hecho con IA").
6. **Movimiento solo cuando informa.** Hojas y modales con un muelle corto; el resto aparece sin espectáculo.

---

## 2. Color

### 2.1 Tokens (modo oscuro, por defecto)

| Token | Valor | Uso |
|---|---|---|
| `--bg-obsidian` | `#030508` | Fondo absoluto de la app (OLED). También `theme_color` del manifiesto. |
| `--bg-carbon` | `#0D1117` | Tarjetas, hojas, menú lateral. |
| `--surface-1` | `#151B24` | Filas pulsadas, casillas, botones secundarios. |
| `--surface-2` | `#1E2530` | Opción activa de un segmentado, pistas de barras. |
| `--border-subtle` | `rgba(255,255,255,0.06)` | **Borde por defecto de toda tarjeta y contenedor (1 px)** y separadores de lista. |
| `--border-specular` | `rgba(255,255,255,0.10)` | Borde de controles interactivos (botones secundarios, campos, chips). |
| `--border-strong` | `rgba(255,255,255,0.22)` | Línea de corte de una clasificación (zona de clasificados) y asa de las hojas. |
| `--text-primary` | `#F5F7FA` | Texto principal y cifras. |
| `--text-secondary` | `#8B95A5` | Etiquetas, ayudas, metadatos. |
| `--text-tertiary` | `#5C6675` | Posiciones de tabla, cabeceras de columna, pie de página. |
| `--volt` | `#D4FF2A` | **Único acento.** Botón principal, saque, interruptor encendido, logotipo. |
| `--volt-deep` | `#B8E000` | Estado pulsado del acento. |
| `--on-volt` | `#06090F` | Texto sobre el acento. |
| `--cyan` (`--pa`) | `#00F0FF` | **Solo datos de la pareja 1.** |
| `--coral` (`--pb`) | `#FF2E54` | **Solo datos de la pareja 2.** |
| `--emerald` | `#30D158` | Estado: winner, éxito, en juego. |
| `--danger` | `#FF453A` | Estado: error no forzado, borrar, desconexión. |
| `--amber` | `#FF9F0A` | Estado: error forzado, aviso, segundo saque. |

### 2.2 Modo claro y tema automático

El tema se elige en Ajustes: **Oscuro** (por defecto), **Claro** o **Automático** (sigue al del móvil con `prefers-color-scheme`). `applyTheme()` pone `body.light-mode` y cambia la `meta theme-color` (`#030508` / `#F4F6F8`). Lo que es una ilustración o un rótulo (la pista, el marcador, las cartas, las páginas públicas) conserva sus colores en los dos temas; en modo claro, la pista de "Nuevo partido" pasa a un azul pista muy claro (`#E3EBF5`, líneas y red claras) con las fichas de los jugadores en blanco; la pista del partido en directo conserva su azul.

Mismo sistema con valores claros: fondo `#F4F6F8`, tarjetas `#FFFFFF`, borde `rgba(15,23,42,0.08)`, texto `#0B1220` / `#5B6474` / `#8A93A0`. El acento se oscurece para leerse sobre blanco (`--volt: #4D7C0F`, `--on-volt: #FFFFFF`). Parejas `#0284C7` y `#E11D48`; estados `#248A3D`, `#D70015` y `#C93400`.

### 2.3 Reglas

- **Cero cambios de acento por sección.** Torneos, ranking o historial usan el mismo `--volt`. `body[data-section]` solo sirve para la lógica, nunca para recolorear.
- **El lima no va en cifras, pestañas, chips, barras de progreso, iconos ni enlaces.** La opción activa de un segmentado es `--surface-2` con texto principal; un chip activo es invertido (fondo `--text-primary`, texto `--bg-obsidian`); un enlace es texto principal o secundario.
- **Cian y rojo son exclusivos de las parejas** (marcador, barras de comparación, gráficos de probabilidad, avatares de un partido). La pareja se marca con un **cuadrado pequeño de su color** delante del nombre, nunca con una franja lateral.
- **Estados con su color y siempre con texto o icono**, nunca solo color.
- Prohibido introducir colores nuevos fuera de esta tabla. Excepciones documentadas: los tres colores de zona del panel de golpes (red `#22D3EE`, transición `#F5C04A`, fondo `#A78BFA`), los colores de pista de la carta de jugador (`CARD_COURTS`) y los colores de los estados del marcador (break, punto de oro, set), que son datos.

---

## 3. Superficies

- **Tarjeta:** fondo `--bg-carbon`, borde `1px solid var(--border-subtle)`, radio 12 px, **sin sombra, sin degradado, sin brillo**. Borde *o* fondo distinto, nunca borde + fondo + sombra a la vez.
- **Listas:** dentro de una tarjeta, las filas no son tarjetas: van una debajo de otra con un separador de 1 px (`--border-subtle`). **Nada de tarjetas dentro de tarjetas.**
- **Hojas inferiores y menú lateral:** `--bg-carbon` sobre un velo `rgba(0,0,0,0.6)` **sin desenfoque**; radio 16 px en las esquinas libres; asa superior gris.
- **Cabecera fija:** opaca (`--bg-obsidian`) con borde inferior `--border-subtle`. Solo logotipo y botón ☰; el nombre de la sección es el título grande de cada pantalla (la cabecera solo lo enseña durante el partido).
- **Pista de pádel** (convocatoria y partido): azul de pista plano `#0D2550`, líneas blancas al 25–30 %, sin brillo radial. Es una ilustración del deporte, no un fondo decorativo.

### 3.1 Señales de diseño hecho con IA (prohibidas)

Investigación de noviembre de 2026 sobre lo que delata una interfaz generada por IA ("AI slop"), resumida de guías públicas de diseño (Impeccable, Hallmark, DeSlop y el skill `frontend-design` de Anthropic, entre otras). Ninguna señal por sí sola prueba nada, pero juntas dan esa sensación de "plantilla". En Padel Metric están prohibidas:

| Señal | En su lugar |
|---|---|
| Franja gruesa de color en un lado de la tarjeta (`border-left`, `inset 3px`) — la señal más reconocible | Cuadrado pequeño de color junto al nombre, o nada |
| Rótulo pequeño en mayúsculas espaciadas encima de cada título ("TU ACTIVIDAD", "COMPETICIÓN") | Título directo; si hace falta contexto, una línea normal debajo |
| Fila de 3–4 recuadros con número grande y etiqueta en mayúsculas | Cifras en fila, sin cajas, separadas por una línea fina o por espacio |
| Tarjetas dentro de tarjetas | Filas con separador |
| Radio grande (16–24 px) en todo | Radio según la función: 6 · 10 · 12 · 16 |
| Icono dentro de un cuadrado o círculo de color en cada elemento de un menú o lista | Icono solo, en gris; o sin icono |
| Icono en todos los botones con texto | Botones solo con texto; el icono solo cuando el botón no tiene texto (con `aria-label`) |
| Fuentes por defecto de la IA (Inter, Plus Jakarta Sans, Geist) y monoespaciada "de programador" para las cifras | Barlow y Barlow Condensed con cifras tabulares |
| Plantillas copiadas de otros productos (la carta "tipo FIFA": escudo, media gigante, atributos de tres letras, niveles de metal) | Diseño propio del deporte: la carta es una pista de pádel personalizable |
| Imágenes decorativas de relleno (la antigua portada del partido) | Nada: el contenido empieza arriba |
| Color de marca en más de tres sitios (botones, cifras, pestañas, bordes, iconos) | El lima solo en la acción principal |
| Degradados morados o multicolor, halos radiales, aurora de fondo, brillos de neón | Superficies planas |
| Paneles translúcidos con desenfoque (`backdrop-filter`) sin motivo | Superficies opacas |
| Contadores que suben, entradas escalonadas, brillos al pasar el dedo | Las cifras aparecen con su valor; un fundido corto al cambiar de sección |
| Saludos de panel genérico ("Buenas noches, Arturo") y frases de anuncio ("Cada punto cuenta", "Tu juego, en datos") | Texto concreto y útil |
| Mayúsculas en Cada Palabra (estilo inglés) | Mayúscula solo al principio de la frase |
| Píldoras translúcidas con borde de color y etiquetas con fondo para cualquier dato | Texto seguido separado por " · " |
| Emojis como iconos, signos de exclamación, apodos ("Rey de la pista") | Nada de eso |

---

## 4. Tipografía

| Rol | Fuente | Estilo |
|---|---|---|
| Logotipo | Barlow Condensed | 900, **cursiva**, mayúsculas |
| Marcador en directo (nombres y puntos del marcador, vista del espectador, cierre del partido) | Barlow Condensed | 700–800, **cursiva permitida** solo aquí |
| Título de pantalla | Barlow Condensed | 700, recta, mayúsculas, 2–2.3 rem |
| Título de hoja | Barlow | 700, 1.3 rem, mayúscula solo inicial |
| Título de sección y de tarjeta | Barlow | 700, 1–1.2 rem |
| Nombres en listas | Barlow | 600, ~1 rem, tal como se escribieron |
| Nombres sobre la pista (convocatoria y partido) | Barlow Condensed | 700, mayúsculas (rótulo de televisión) |
| Botones | Barlow | 600–700, mayúscula solo inicial |
| Texto | Barlow | 400–500 |
| Etiquetas pequeñas | Barlow | 500–600, 0.78–0.82 rem, `--text-secondary`, **sin mayúsculas forzadas ni espaciado** |
| Cabeceras de columna de tabla | Barlow | 600, 0.7 rem, mayúsculas con `letter-spacing: 0.03em` (única excepción) |
| Cifras grandes | Barlow Condensed | 600–700, tabulares |
| Cifras en texto y tablas | Barlow | tabulares |

- **Nada de fuentes monoespaciadas**: las cifras usan Barlow o Barlow Condensed con `font-variant-numeric: tabular-nums` (aplicado en `body`), así no "bailan" al cambiar.
- **Cursiva solo en el logotipo y en el marcador en directo.**
- Campos de texto a 16 px como mínimo (si no, el iPhone hace zoom al escribir).
- El tamaño base es fluido (`html { font-size: clamp(15px, 4.15vw, 18px) }`): todo se mide en `rem`.

---

## 5. Espaciado, radios y tamaños

- Escala de espacios: 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 px.
- Radios por función (`--r-sm`, `--r-md`, `--r-lg`, `--r-xl`): 6 (casillas de cifra, etiquetas) · 10 (botones, campos, segmentados) · 12 (tarjetas, filas destacadas) · 16 (hojas y cierre del partido).
- Objetivo táctil mínimo: 44 × 44 px. El botón principal ocupa todo el ancho.
- Ancho máximo de contenido: 560 px centrado.

---

## 6. Componentes

- **Botón principal (`.btn-volt`):** fondo `--volt` plano, texto `--on-volt`, Barlow 700, radio 12 px, sin icono. **Uno por pantalla.**
- **Botón secundario (`.btn-icon`):** fondo `--surface-1`, borde `--border-specular`, texto `--text-primary`, sin icono si lleva texto.
- **Botón fuerte sin color de marca (`.btn-accent`):** invertido (fondo `--text-primary`, texto `--bg-obsidian`), para "Listo", "Continuar".
- **Botón de texto (`.btn-text`):** sin caja, en gris: "Volver", "Cancelar", "Eliminar" (este en `--danger`).
- **Segmentados y pestañas:** contenedor con borde sutil; la opción activa en `--surface-2` con texto principal.
- **Chips de filtro:** borde `--border-specular`; activo invertido.
- **Datos sueltos (metadatos):** texto seguido con " · ", sin fondo.
- **Cifras de resumen:** número en Barlow Condensed y etiqueta debajo en `--text-secondary`, sin recuadro (`.hero-stat`, `.kpi-card`, `.me-stat`, `.sm-facts`).
- **Clasificaciones:** posición en `--text-tertiary` (en blanco y negrita dentro de la zona de clasificados) y una línea `--border-strong` donde termina esa zona.
- **Interruptores:** pista `--surface-2`; encendido en `--volt`.
- **Carta de jugador (`.pcard`):** una pista de pádel vista desde arriba, no un escudo de videojuego. Dos campos iguales (proporción de pista) con las líneas en blanco al 22 %: arriba el jugador (foto o iniciales, nombre pequeño y apellido grande, lado y mano), en medio la red con el rótulo "Padel Metric", abajo media, ELO y balance, los seis atributos con su nombre completo y una barra, y al pie la pala y el club. El fondo es el **color de pista que elige cada jugador** (`CARD_COURTS`: azul, azul noche, verde, terracota, gris, negra); si no elige, se le asigna uno por su nombre. Sin niveles bronce/plata/oro, sin brillo holográfico y sin abreviaturas de tres letras. Se escala con su tamaño de letra: normal, `.big` (ficha) y `.mini` (inicio).
- **Pantallas vacías (`emptyStateHTML`):** título, una o dos frases de qué es la sección y qué hacer, y la acción; alineado a la izquierda, sin icono ni caja. Los filtros y buscadores no se enseñan si no hay nada que filtrar.
- **Marcador en directo:** siempre oscuro (rótulo de televisión), cifras en Barlow Condensed, cuadrado del color de la pareja delante del nombre, punto lima de saque, barra de probabilidad con los colores de pareja.
- **Tarjetas de jugador en pista:** opacas sobre la pista, cuadrado de color de la pareja junto al lado (drive / revés), borde lima si saca, valoración como cifra (sin anillo).
- **Panel de golpes:** casillas planas con el esquema en el color de su zona.
- **Gráficos:** líneas de 1.5–2 px en `--text-primary`, rejilla y ejes en gris, áreas con el color de pareja al 25 % solo cuando el dato es de pareja. Ver la guía `dataviz` para cualquier gráfico nuevo.
- **Avisos (toast):** recuadro `#1E2530` con el texto, sin icono. Si llevan acción ("Deshacer"), es texto en lima sin caja y el aviso dura 5 s.
- **Páginas públicas** (directo, clasificación en directo, inscripción, partido y perfil compartidos): siempre oscuras, con colores fijos. Tarjetas `#0D1117`, listas con separadores y el cuadrado de color de pareja.

---

## 7. Movimiento

| Token | Curva | Uso |
|---|---|---|
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | **Obligatoria para modales, hojas inferiores, menú lateral y cierre del partido.** |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Barras que crecen, cambios de valor. |

- Duraciones: 180–250 ms para respuestas, 350–450 ms para hojas y modales, hasta 700 ms para celebraciones del partido.
- Cambio de sección: fundido de 0,2 s, sin entradas escalonadas. Las cifras se escriben con su valor, sin contadores.
- Pulsar un botón: `scale(0.97)`.
- Animaciones con información: rótulos de juego, break y set, giro del punto en el marcador, confeti solo al ganar el partido (color de la pareja y blanco).
- Momentos con "espectáculo" permitidos, todos cortos, sin bucle y sin bloquear los toques: la **entrada del logo** al abrir (2,1 s; por defecto D "Trazo y bote", también C Perforado, en `js/intro.js`), la **trayectoria del golpe** sobre la pista tras un winner (1,5 s), el **cierre del partido** con entrada escalonada y la carta del mejor (hasta 2,2 s en total), el **aviso grande** de bola de break, set, partido o punto de oro en el modo tele y la **inclinación del mapa de calor** al aparecer.
- Marcador gigante en horizontal y modo tele: mismos colores y tipografías; cifras muy grandes, sin franjas laterales (el color de la pareja va siempre en un cuadrado).
- Sin animaciones en bucle salvo los indicadores de "en directo".
- **`prefers-reduced-motion: reduce`** desactiva todas las animaciones.

---

## 8. Lista de comprobación antes de publicar un cambio visual

- [ ] Fondo `#030508`, tarjetas `#0D1117` con borde `rgba(255,255,255,0.06)`.
- [ ] El lima solo en la acción principal, el saque y los interruptores; cian y rojo solo en datos de pareja.
- [ ] Ninguna señal de la tabla 3.1: franjas laterales, rótulos en mayúsculas sobre títulos, recuadros de cifras, tarjetas dentro de tarjetas, iconos en botones con texto, desenfoques, degradados, contadores animados.
- [ ] Textos con mayúscula solo al principio, sin frases de anuncio ni signos de exclamación.
- [ ] Cursiva solo en el logotipo y el marcador en directo.
- [ ] Barlow / Barlow Condensed con cifras tabulares; nada de fuentes monoespaciadas.
- [ ] Hojas y modales con `--ease-spring`.
- [ ] Sin `style="..."` estáticos nuevos: los estilos van en `css/styles.css` (solo se permiten valores calculados: anchos en %, posiciones, colores de un dato).
- [ ] Comprobado en oscuro y claro, a 360 y 400 px de ancho (`npm test` lo revisa).
- [ ] Subida la versión de `CACHE` en `sw.js`.
