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
await b.close();
console.log('capturas listas');
