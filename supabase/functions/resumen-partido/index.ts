// ==========================================================
// PADEL METRIC · IA (Supabase Edge Function "resumen-partido")
// Dos tareas, ambas con Claude Haiku 5.5 (el modelo más económico, elegido por el dueño del proyecto):
//   - Crónica del partido: la app envía { device, match } con match = matchToAI(partido) (js/resumen.js).
//   - Caras de una foto: { device, tipo: 'caras', imagen } (JPEG en base64) → { caras: [{ x, y, w, h }] } en
//     proporciones de la imagen, de izquierda a derecha (js/caras.js las recorta como fotos de perfil).
// Antes de llamar a la IA reserva un uso (pm_ia_reservar: límite al mes por dispositivo y tope diario total; tablas en
// supabase/ia.sql). Con el código de pruebas del dueño (cabecera x-pm-codigo, aquí solo su resumen SHA-256) no hay
// límite ni hacen falta las tablas. La clave ANTHROPIC_API_KEY es un secreto de Supabase: nunca llega a la app.
// Secretos: ANTHROPIC_API_KEY (obligatorio), PM_IA_LIMITE_MES (3 por defecto), PM_IA_TOPE_DIA (100 por defecto).
// Se despliega sin verificar JWT (la app usa una clave publicable); la protección son los límites de arriba.
// ==========================================================
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";

const MODELO = "claude-haiku-5-5";
const CODIGO_PRUEBAS_SHA256 = "b6ba0f15eeb2e82dad99321609f7ad79817577151838e079aded8c9e753f2839";

const SISTEMA = `Eres el redactor de las crónicas de partido de una app de pádel. Escribes como las crónicas oficiales del circuito profesional (Premier Padel): estilo informativo de agencia, frases cortas, primero el resultado y después las claves del partido apoyadas en estadísticas.

Reglas:
- Español de España, tono profesional. Sin emojis, sin apodos y sin exageraciones ("histórico", "épico", "brutal").
- Es pádel amateur: llama a cada jugador solo por su nombre de pila, tal como viene en "nombre_corto". Nunca uses apellidos.
- Usa solo los datos que recibes. No inventes jugadas, golpes, marcadores ni ambiente. Si falta un dato, no lo menciones.
- Las claves deben salir de las estadísticas que se usan en el circuito profesional: puntos ganados con el primer y el segundo saque, puntos ganados al resto, bolas de break convertidas y salvadas, puntos de oro, winners, errores no forzados y rachas de puntos. Elige las dos o tres que explican el resultado; no las enumeres todas.
- "errores_no_forzados_por_golpe" son solo errores no forzados; no los mezcles con los forzados.
- Los marcadores de los sets vienen como pareja 1 - pareja 2. Escribe el resultado desde el punto de vista de la pareja ganadora (por ejemplo, 3-6, 6-3 y 6-2 si remontó).
- Si hubo remontada (dato "peor_momento_de_la_ganadora"), cuéntala con el marcador de ese momento.

Formato (texto plano, sin markdown, sin asteriscos ni almohadillas):
Línea 1: un titular de 12 palabras como máximo, con las dos parejas por sus nombres.
Después, una línea en blanco y 2 párrafos cortos, de 90 a 140 palabras en total.
Por último, una línea en blanco, la línea "Para el próximo partido:" y debajo una frase por pareja con un consejo concreto basado en sus datos, empezando con los nombres de la pareja y dos puntos.`;

const CARAS_PROMPT = `Localiza las caras de las personas de esta foto de un partido de pádel. Para cada cara, de izquierda a derecha, da su recuadro en proporciones de la imagen (de 0 a 1): x e y de la esquina superior izquierda, w de ancho y h de alto. El recuadro debe abarcar la cabeza entera (del pelo a la barbilla). Como mucho 8 caras; ignora las que salgan muy pequeñas, de espaldas o cortadas.`;
const CARAS_SCHEMA = {
  type: "object",
  properties: {
    caras: {
      type: "array",
      items: {
        type: "object",
        properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } },
        required: ["x", "y", "w", "h"],
        additionalProperties: false,
      },
    },
  },
  required: ["caras"],
  additionalProperties: false,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-pm-codigo",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respuesta(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function sha256(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function rpc(nombre: string, args: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL");
  const clave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  const r = await fetch(`${url}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: { apikey: clave, Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${nombre}: ${r.status}`);
  return await r.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return respuesta({ error: "Método no permitido" }, 405);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return respuesta({ error: "Falta la clave de la IA en Supabase (ANTHROPIC_API_KEY)" }, 503);

  let body: { device?: string; match?: unknown; tipo?: string; imagen?: string };
  try { body = await req.json(); } catch { return respuesta({ error: "Datos no válidos" }, 400); }
  const device = String(body.device || "");
  const caras = body.tipo === "caras";
  if (!/^[a-z0-9]{16,64}$/.test(device)) return respuesta({ error: "Dispositivo no válido" }, 400);
  const datos = JSON.stringify(body.match ?? null);
  if (caras) {
    if (typeof body.imagen !== "string" || body.imagen.length < 100 || body.imagen.length > 2_000_000) return respuesta({ error: "Foto no válida" }, 400);
  } else if (!body.match || typeof body.match !== "object" || datos.length > 16000) {
    return respuesta({ error: "Partido no válido" }, 400);
  }

  // Código de pruebas del dueño: sin límite
  const codigo = req.headers.get("x-pm-codigo") || "";
  const esDueno = !!codigo && (await sha256(codigo.trim().toUpperCase())) === CODIGO_PRUEBAS_SHA256;
  const limite = Number(Deno.env.get("PM_IA_LIMITE_MES") || 3);
  const tope = Number(Deno.env.get("PM_IA_TOPE_DIA") || 100);
  let restantes = 99;
  if (!esDueno) {
    try {
      restantes = await rpc("pm_ia_reservar", { p_device: device, p_limite_mes: limite, p_tope_dia: tope });
    } catch {
      return respuesta({ error: "La IA todavía no está activada en el servidor." }, 503);
    }
    if (restantes === -1) return respuesta({ error: `Ya has usado los ${limite} usos de la IA de este mes`, restantes: 0 }, 429);
    if (restantes === -2) return respuesta({ error: "Hoy se ha usado mucho la IA. Prueba mañana." }, 429);
    if (restantes < 0) return respuesta({ error: "Dispositivo no válido" }, 400);
  }

  const client = new Anthropic();
  try {
    if (caras) {
      // deno-lint-ignore no-explicit-any
      const params: any = {
        model: MODELO, max_tokens: 4000, output_config: { effort: "low", format: { type: "json_schema", schema: CARAS_SCHEMA } },
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: body.imagen } },
          { type: "text", text: CARAS_PROMPT },
        ] }],
      };
      const r = await client.messages.create(params);
      if (r.stop_reason === "refusal" || r.stop_reason === "max_tokens") throw new Error(String(r.stop_reason));
      // deno-lint-ignore no-explicit-any
      const txt = (r.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("");
      const out = JSON.parse(txt);
      // deno-lint-ignore no-explicit-any
      const lista = (Array.isArray(out.caras) ? out.caras : []).filter((c: any) => [c.x, c.y, c.w, c.h].every((v) => typeof v === "number" && v >= 0 && v <= 1.01) && c.w > 0.01 && c.h > 0.01).slice(0, 8);
      return respuesta({ caras: lista, restantes });
    }
    // deno-lint-ignore no-explicit-any
    const params: any = { model: MODELO, max_tokens: 12000, system: SISTEMA, messages: [{ role: "user", content: `Datos del partido en JSON:\n${datos}` }], output_config: { effort: "low" } };
    const r = await client.messages.create(params);
    if (r.stop_reason === "refusal" || r.stop_reason === "max_tokens") throw new Error(String(r.stop_reason));
    // deno-lint-ignore no-explicit-any
    const texto = (r.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (!texto) throw new Error("vacío");
    return respuesta({ texto, modelo: r.model, restantes, uso: { entrada: r.usage.input_tokens, salida: r.usage.output_tokens } });
  } catch (e) {
    if (!esDueno) await rpc("pm_ia_devolver", { p_device: device }).catch(() => {});
    console.error("resumen-partido", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
    return respuesta({ error: caras ? "No se han podido encontrar las caras. Prueba con otra foto." : "No se ha podido generar el resumen. Inténtalo de nuevo en un momento." }, 502);
  }
});
