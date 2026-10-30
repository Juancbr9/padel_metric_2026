# Padel Metric · Sistema de diseño

Fuente de verdad visual de la app. **Cualquier cambio estético debe cumplir este documento.** Si algo no está aquí, se decide siguiendo su espíritu: deportivo, sobrio y funcional, en la línea de Apple Sports, Premier Padel y Strava. La lógica (`js/`) y las claves de `localStorage` no forman parte del diseño y no se tocan por motivos estéticos.

Activos de marca (logo, iconos, tipografías): [`docs/brand-index.md`](docs/brand-index.md).

---

## 1. Principios

1. **El dato es el protagonista.** Marcadores, cifras y nombres mandan; la decoración no compite con ellos.
2. **Negro de verdad.** Fondo OLED, superficies planas y bordes finísimos. La profundidad se consigue con capas de gris, no con brillos.
3. **Un solo acento.** El lima `#D4FF2A` marca la acción principal y el estado activo. Nada más compite con él.
4. **Color con significado.** Cian y rojo solo identifican a la pareja 1 y la pareja 2. Verde, ámbar y rojo de estado solo indican resultado (winner, error, aviso).
5. **Movimiento con física.** Lo que aparece lo hace con un muelle corto; lo que cambia, sin saltos.
6. **Menos es más.** Una acción principal por pantalla; el resto, en menús y hojas.

---

## 2. Color

### 2.1 Tokens (modo oscuro, por defecto)

| Token | Valor | Uso |
|---|---|---|
| `--bg-obsidian` | `#030508` | Fondo absoluto de la app (OLED). También `theme_color` del manifiesto. |
| `--bg-carbon` | `#0D1117` | Tarjetas, hojas, menú lateral, cabecera. |
| `--surface-1` | `#151B24` | Elementos dentro de una tarjeta (filas, casillas, campos). |
| `--surface-2` | `#1E2530` | Estados pulsados, pistas de barras, separadores gruesos. |
| `--border-subtle` | `rgba(255,255,255,0.06)` | **Borde por defecto de toda tarjeta y contenedor (1 px).** |
| `--border-specular` | `rgba(255,255,255,0.10)` | Borde de controles interactivos (botones secundarios, campos). |
| `--text-primary` | `#F5F7FA` | Texto principal y cifras. |
| `--text-secondary` | `#8B95A5` | Etiquetas, ayudas, metadatos. |
| `--volt` | `#D4FF2A` | **Único acento.** Botón principal, pestaña activa, indicador de saque, foco. |
| `--volt-deep` | `#B8E000` | Estado pulsado del acento. |
| `--on-volt` | `#06090F` | Texto sobre el acento. |
| `--cyan` (`--pa`) | `#00F0FF` | **Solo datos de la pareja 1.** |
| `--coral` (`--pb`) | `#FF2E54` | **Solo datos de la pareja 2.** |
| `--emerald` | `#00E676` | Estado: winner, éxito, en juego. |
| `--danger` | `#F87171` | Estado: error no forzado, borrar, desconexión. |
| `--amber` | `#FFB800` | Estado: error forzado, aviso, segundo saque. |

### 2.2 Modo claro

Mismo sistema con valores claros: fondo `#F4F6F8`, tarjetas `#FFFFFF`, borde `rgba(15,23,42,0.08)`, texto `#0B1220` / `#5B6474`. El acento conserva el tono pero se oscurece para que se lea sobre blanco (`--volt: #4D7C0F`, `--on-volt: #FFFFFF`). Las parejas usan `#0284C7` y `#E11D48`.

### 2.3 Reglas

- **Cero cambios de acento por sección.** Torneos, ranking o historial usan el mismo `--volt`. El atributo `body[data-section]` solo sirve para la lógica y para la etiqueta de la cabecera, nunca para recolorear.
- **Cian y rojo son exclusivos de las parejas** (marcador, barras de comparación, gráficos de probabilidad, avatares de un partido). No se usan para decorar, para iconos de menú ni para estados.
- **Estados con su color y siempre con texto o icono**, nunca solo color.
- Prohibido introducir colores nuevos fuera de esta tabla. Excepciones documentadas: los tres colores de zona del panel de golpes (red `#22D3EE`, transición `#F5C04A`, fondo `#A78BFA`) y los niveles de la carta de jugador (bronce, plata, oro, élite), que son datos y no decoración.

---

## 3. Superficies

- **Tarjeta:** fondo `--bg-carbon`, borde `1px solid var(--border-subtle)`, radio 16 px, **sin sombra de color, sin degradado, sin brillo**. Una sombra neutra muy suave (`0 1px 0 rgba(255,255,255,0.02) inset`) es lo máximo permitido.
- **Elemento dentro de tarjeta:** `--surface-1`, radio 10–12 px, sin borde o con `--border-subtle`.
- **Hojas inferiores y menú lateral:** `--bg-carbon` sobre un velo `rgba(0,0,0,0.6)` con desenfoque; radio 22 px en las esquinas libres; asa superior gris.
- **Cabecera fija:** `--bg-carbon` al 92 % con desenfoque y borde inferior `--border-subtle`.
- **Pista de pádel** (convocatoria y partido): azul de pista plano `#0D2550`, líneas blancas al 25–30 %. Es una ilustración del deporte, no un fondo decorativo.

### Prohibido ("AI slop")

- Píldoras translúcidas con borde de color (`background: rgba(color,0.15); border: 1px solid rgba(color,0.4)`). Las etiquetas son grises y planas; el color, si hace falta, va en el texto o en un punto.
- Brillos de aurora o halos animados de fondo (`body::before` con degradados radiales).
- Tramas diagonales o rayadas (`repeating-linear-gradient`) en tarjetas o cabeceras.
- Degradados de varios colores en tarjetas, botones, banners o contenedores. Un botón es un color plano.
- Sombras de color (`box-shadow` con el acento o con colores de pareja) y textos con resplandor.
- Emojis y apodos ("Rey de la pista").

---

## 4. Tipografía

| Rol | Fuente | Estilo |
|---|---|---|
| Logotipo | Barlow Condensed | 900, **cursiva**, mayúsculas, `letter-spacing: 0.04em` |
| Marcador en directo (nombres y puntos del marcador, vista del espectador) | Barlow Condensed / JetBrains Mono | 800–900, **cursiva permitida** solo aquí |
| Título de pantalla | Barlow Condensed | 700, recta, mayúsculas, 1.9–2.2 rem |
| Título de tarjeta / sección | Plus Jakarta Sans | 700, 0.9–1 rem |
| Nombre de jugador en listas | Barlow Condensed | 700, recta, mayúsculas |
| Botones | Plus Jakarta Sans | 700, recta, sin mayúsculas forzadas (salvo el botón principal, que puede ir en mayúsculas) |
| Texto | Plus Jakarta Sans | 500–600 |
| Etiquetas pequeñas | Plus Jakarta Sans | 700, 0.6–0.68 rem, mayúsculas, `letter-spacing: 0.08em`, `--text-secondary` |
| Cifras | JetBrains Mono o la fuente del contexto | **`font-variant-numeric: tabular-nums` siempre** |

- **Cursiva solo en el logotipo y en el marcador en directo.** En el resto de la app, nada en cursiva.
- **Números tabulares obligatorios** en marcadores, cronómetros, ELO, porcentajes, tablas y cualquier cifra que cambie. Se aplica de forma global en `body` y se refuerza en los componentes de cifras.
- El tamaño base es fluido (`html { font-size: clamp(15px, 4.15vw, 18px) }`): todo se mide en `rem`.

---

## 5. Espaciado, radios y tamaños

- Escala de espacios: 4 · 6 · 8 · 10 · 12 · 16 · 20 · 24 px.
- Radios: 6 (casillas de cifra) · 10 (controles) · 12–14 (filas, botones) · 16 (tarjetas) · 22 (hojas).
- Objetivo táctil mínimo: 44 × 44 px. El botón principal ocupa todo el ancho.
- Ancho máximo de contenido: 560 px centrado.

---

## 6. Componentes

- **Botón principal (`.btn-volt`):** fondo `--volt` plano, texto `--on-volt`, 700, radio 14 px, sin sombra de color. Uno por pantalla.
- **Botón secundario (`.btn-icon`):** fondo `--surface-1`, borde `--border-specular`, texto `--text-primary`.
- **Pestañas y segmentados:** contenedor `--bg-carbon` con borde sutil; la opción activa en `--volt` plano.
- **Etiquetas (chips):** `--surface-1`, sin borde de color, texto `--text-secondary` en mayúsculas pequeñas. El estado se indica con un punto de color delante, no tiñendo la píldora.
- **Interruptores:** pista `--surface-2`; activo en `--volt`.
- **Marcador en directo:** siempre oscuro (como un rótulo de televisión), celdas de cifra en mono tabular, punto lima de saque, barra de probabilidad con los colores de pareja.
- **Tarjetas de jugador en pista:** superficie oscura translúcida sobre la pista, franja lateral con el color de su pareja, borde lima si saca.
- **Panel de golpes:** casillas planas, esquema en el color de su zona y una línea superior con el color del tipo de punto (verde, rojo o ámbar).
- **Gráficos:** líneas de 1.5–2 px, rejilla y ejes en gris, áreas con el color de pareja al 25 %, una sola escala. Ver la guía `dataviz` para cualquier gráfico nuevo.

---

## 7. Movimiento

| Token | Curva | Uso |
|---|---|---|
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | **Obligatoria para modales, hojas inferiores, menú lateral, cierre del partido y carta.** |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entradas de contenido, barras que crecen, cambios de valor. |

- Duraciones: 180–250 ms para respuestas (pulsar, cambiar pestaña), 350–450 ms para hojas y modales, hasta 700 ms para celebraciones.
- Pulsar un botón: `scale(0.96)`.
- Las cifras que cambian se animan sin desplazar el diseño (gracias a los números tabulares).
- Sin animaciones en bucle salvo indicadores de "en directo" (punto que parpadea) y el brillo de la carta de jugador.
- **`prefers-reduced-motion: reduce`** desactiva todas las animaciones.

---

## 8. Lista de comprobación antes de publicar un cambio visual

- [ ] Fondo `#030508`, tarjetas `#0D1117` con borde `rgba(255,255,255,0.06)`.
- [ ] Ningún acento distinto de `--volt`; cian y rojo solo en datos de pareja.
- [ ] Ninguna píldora con borde de color, aurora, trama diagonal ni degradado multicolor.
- [ ] Cursiva solo en el logotipo y el marcador en directo.
- [ ] Cifras con `tabular-nums`.
- [ ] Hojas y modales con `--ease-spring`.
- [ ] Sin `style="..."` estáticos nuevos: los estilos van en `css/styles.css` (los únicos estilos en línea permitidos son valores calculados: anchos en %, posiciones, colores de un dato).
- [ ] Comprobado en oscuro y claro, a 360 y 400 px de ancho.
- [ ] Subida la versión de `CACHE` en `sw.js`.
