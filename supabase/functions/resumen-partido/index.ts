// ==========================================================
// PADEL METRIC · RESUMEN DEL PARTIDO CON IA (Supabase Edge Function "resumen-partido")
// La app envía { device, match, modelo? } con match = matchToAI(partido) (js/resumen.js). Esta función:
//   1. Comprueba los datos y reserva un uso (pm_ia_reservar: límite al mes por dispositivo y tope diario total).
//   2. Pide a Claude la crónica del partido. La clave ANTHROPIC_API_KEY es un secreto de Supabase: nunca llega a la app.
//   3. Devuelve { texto, modelo, restantes } o { error }. Si la IA falla, devuelve la reserva.
// Secretos: ANTHROPIC_API_KEY (obligatorio), PM_IA_LIMITE_MES (3 por defecto), PM_IA_TOPE_DIA (100 por defecto).
// Se despliega sin verificar JWT (la app usa una clave publicable); la protección son los límites de arriba.
// ==========================================================
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";

const MODELOS: Record<string, string> = {
  opus: "claude-opus-5-5",
  haiku: "claude-haiku-5-5",
};
const MODELO_POR_DEFECTO = Deno.env.get("PM_IA_MODELO") || "opus";

const SISTEMA = `Eres un periodista deportivo especializado en pádel. Escribes la crónica de un partido amateur a partir de sus estadísticas, para que los jugadores la lean y la compartan.

Reglas:
- Español de España, tono profesional y cercano. Sin emojis, sin apodos y sin exageraciones ("histórico", "épico", "brutal").
- Usa solo los datos que recibes. No inventes jugadas, golpes, marcadores ni ambiente. Si falta un dato, no lo menciones.
- Apóyate en cifras concretas (porcentajes al saque y al resto, bolas de break, winners, errores no forzados, rachas), pero sin convertir el texto en una lista de números: elige las que explican el partido.
- Los marcadores de los sets vienen como pareja 1 - pareja 2. Cuando cites el resultado, escríbelo desde el punto de vista de la pareja ganadora.
- "Lado" es la posición en la pista (drive o revés). "Valoración" es una nota de 1 a 10 calculada por la app.
- Si hubo remontada (dato "peor_momento_de_la_ganadora"), cuéntala con el marcador de ese momento.
- Nombra a los jugadores por su nombre y apellido la primera vez y después solo por el apellido.

Formato (texto plano, sin markdown, sin asteriscos ni almohadillas):
Línea 1: un titular de 12 palabras como máximo.
Después, una línea en blanco y 2 o 3 párrafos cortos, de 120 a 180 palabras en total: cómo fue el partido, qué lo decidió y quién destacó y por qué.
Por último, una línea en blanco, la línea "Para el próximo partido:" y debajo una frase por pareja con un consejo concreto basado en sus datos, empezando cada una con los apellidos de la pareja y dos puntos.`;

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

  let body: { device?: string; match?: unknown; modelo?: string };
  try { body = await req.json(); } catch { return respuesta({ error: "Datos no válidos" }, 400); }
  const device = String(body.device || "");
  const datos = JSON.stringify(body.match ?? null);
  if (!/^[a-z0-9]{16,64}$/.test(device)) return respuesta({ error: "Dispositivo no válido" }, 400);
  if (!body.match || typeof body.match !== "object" || datos.length > 16000) return respuesta({ error: "Partido no válido" }, 400);
  const clave = body.modelo && MODELOS[body.modelo] ? body.modelo : MODELO_POR_DEFECTO;
  const modelo = MODELOS[clave] || MODELOS.opus;

  const limite = Number(Deno.env.get("PM_IA_LIMITE_MES") || 3);
  const tope = Number(Deno.env.get("PM_IA_TOPE_DIA") || 100);
  const restantes = await rpc("pm_ia_reservar", { p_device: device, p_limite_mes: limite, p_tope_dia: tope });
  if (restantes === -1) return respuesta({ error: `Ya has usado los ${limite} resúmenes de este mes`, restantes: 0 }, 429);
  if (restantes === -2) return respuesta({ error: "Hoy se han pedido muchos resúmenes. Prueba mañana." }, 429);
  if (restantes < 0) return respuesta({ error: "Dispositivo no válido" }, 400);

  const client = new Anthropic();
  const mensajes = [{ role: "user" as const, content: `Datos del partido en JSON:\n${datos}` }];
  try {
    // Opus 5.5 lleva el respaldo del servidor por si declina (fallbacks: "default"); Haiku 5.5 no lo admite
    // deno-lint-ignore no-explicit-any
    const params: any = { model: modelo, max_tokens: 12000, system: SISTEMA, messages: mensajes, output_config: { effort: "medium" } };
    const r = modelo === MODELOS.opus
      ? await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : await client.messages.create(params);
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
