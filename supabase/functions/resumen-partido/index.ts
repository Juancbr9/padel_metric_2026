// ==========================================================
// PADEL METRIC · RESUMEN DEL PARTIDO CON IA (Supabase Edge Function "resumen-partido")
// La app envía { device, match } con match = matchToAI(partido) (js/resumen.js). Esta función:
//   1. Comprueba los datos y reserva un uso (pm_ia_reservar: límite al mes por dispositivo y tope diario total).
//   2. Pide a Claude la crónica del partido. La clave ANTHROPIC_API_KEY es un secreto de Supabase: nunca llega a la app.
//   3. Devuelve { texto, modelo, restantes } o { error }. Si la IA falla, devuelve la reserva.
// Secretos: ANTHROPIC_API_KEY (obligatorio), PM_IA_LIMITE_MES (3 por defecto), PM_IA_TOPE_DIA (100 por defecto).
// Se despliega sin verificar JWT (la app usa una clave publicable); la protección son los límites de arriba.
// ==========================================================
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";

// Claude Haiku 5.5: el más económico (unos 0,25 céntimos por resumen), elegido por el dueño del proyecto
const MODELO = "claude-haiku-5-5";

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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respuesta(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
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

  let body: { device?: string; match?: unknown };
  try { body = await req.json(); } catch { return respuesta({ error: "Datos no válidos" }, 400); }
  const device = String(body.device || "");
  const datos = JSON.stringify(body.match ?? null);
  if (!/^[a-z0-9]{16,64}$/.test(device)) return respuesta({ error: "Dispositivo no válido" }, 400);
  if (!body.match || typeof body.match !== "object" || datos.length > 16000) return respuesta({ error: "Partido no válido" }, 400);

  const limite = Number(Deno.env.get("PM_IA_LIMITE_MES") || 3);
  const tope = Number(Deno.env.get("PM_IA_TOPE_DIA") || 100);
  let restantes: number;
  try {
    restantes = await rpc("pm_ia_reservar", { p_device: device, p_limite_mes: limite, p_tope_dia: tope });
  } catch {
    return respuesta({ error: "Las crónicas todavía no están activadas en el servidor." }, 503);
  }
  if (restantes === -1) return respuesta({ error: `Ya has usado los ${limite} resúmenes de este mes`, restantes: 0 }, 429);
  if (restantes === -2) return respuesta({ error: "Hoy se han pedido muchos resúmenes. Prueba mañana." }, 429);
  if (restantes < 0) return respuesta({ error: "Dispositivo no válido" }, 400);

  const client = new Anthropic();
  const mensajes = [{ role: "user" as const, content: `Datos del partido en JSON:\n${datos}` }];
  try {
    // Esfuerzo bajo: para un texto corto basta y piensa menos (más rápido y más barato)
    const r = await client.messages.create({ model: MODELO, max_tokens: 12000, system: SISTEMA, messages: mensajes, output_config: { effort: "low" } });
    if (r.stop_reason === "refusal" || r.stop_reason === "max_tokens") throw new Error(String(r.stop_reason));
    // deno-lint-ignore no-explicit-any
    const texto = (r.content as any[]).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (!texto) throw new Error("vacío");
    return respuesta({ texto, modelo: r.model, restantes, uso: { entrada: r.usage.input_tokens, salida: r.usage.output_tokens } });
  } catch (e) {
    await rpc("pm_ia_devolver", { p_device: device }).catch(() => {});
    console.error("resumen-partido", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e));
    return respuesta({ error: "No se ha podido generar el resumen. Inténtalo de nuevo en un momento." }, 502);
  }
});
