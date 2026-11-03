// Regenera las capturas de assets/screenshots (780 × 1688) para la ventana de instalación y la página de presentación.
// Uso: python3 -m http.server 8765 (en la raíz) y después: node tools/capturas.mjs [http://localhost:8765/]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const url = process.argv[2] || 'http://localhost:8765/';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
await ctx.addInitScript(() => { if (!sessionStorage.getItem('c')) { sessionStorage.setItem('c', '1'); ['pm_bienvenida_v1', 'pm_guia_partido_v1'].forEach(k => localStorage.setItem(k, '1')); localStorage.setItem('pm_novedades_v1', '999'); } });
const p = await ctx.newPage();
await p.goto(url);
await p.evaluate(() => loadDemoData());
await p.waitForFunction(() => matchHistory.length > 20);
await p.evaluate(() => { chooseMe(dbPlayers[0]); markBackupDone?.(); appSettings.installHintHidden = true; closeEventModal(); switchMainTab('home'); });
await p.waitForTimeout(2600);
const shot = n => p.screenshot({ path: `assets/screenshots/${n}.jpg`, type: 'jpeg', quality: 86 });
await shot('inicio');
await p.evaluate(() => { switchMainTab('ranking'); });
await p.waitForTimeout(600);
await shot('ranking');
await p.evaluate(() => { const i = matchHistory.findIndex(m => m.players.every(x => !x.isGeneric)); repeatMatch(i); });
await p.waitForTimeout(400);
await p.evaluate(() => { [0, 0, 1, 0, 1, 0, 0, 0, 1, 1, 0].forEach(t => addNeutralPoint(t)); });
await p.waitForTimeout(2600);
await shot('partido');
await p.evaluate(() => discardCurrentMatch());
await p.waitForTimeout(5600); // que se vaya el aviso
// Capturas para la página de entrenadores: estadísticas (mapa de calor) y resumen del partido con su crónica
// (texto real escrito por la IA para este partido de los datos de ejemplo)
const CRONICA = `Javier e Iván vencen a Marcos y Sergio en el súper tie-break

Javier e Iván se impusieron por 6-3, 5-7 y 14-12 en el súper tie-break, tras 109 minutos de juego. La pareja perdió el segundo set por 5-7 y llegó al tercero con una probabilidad de victoria del 4 %, según el registro del partido. Marcos y Sergio habían igualado el encuentro, pero no supieron cerrarlo en el momento decisivo.

En el resto, la pareja ganadora acertó el 46 % de sus puntos, frente al 41 % de sus rivales. Javier fue el jugador con más golpes ganadores en puntos decisivos, ocho, y terminó con 26 winners.

Para el próximo partido:
Javier / Iván: mantener la eficacia al resto y reducir los 27 errores no forzados de la pareja.
Marcos / Sergio: bajar los 31 errores no forzados de la pareja y mejorar el 41 % de acierto al resto.`;
const hi = await p.evaluate(t => { const i = matchHistory.findIndex(m => m.sets.filter(s => s[0] + s[1]).length === 3 && m.players.every(x => !x.isGeneric)); matchHistory[i].aiSummary = { texto: t, at: Date.now() }; return i; }, CRONICA);
await p.evaluate(i => { switchMainTab('history'); openHistoryMatchStats(i); renderStats('heatmap'); }, hi);
await p.waitForTimeout(900);
await shot('estadisticas');
await p.evaluate(i => { switchMainTab('home'); openMatchSummary('history', i); }, hi);
await p.waitForTimeout(900);
await shot('resumen');
await b.close();
console.log('capturas listas');
