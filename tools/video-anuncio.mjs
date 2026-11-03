// Graba el vídeo de anuncio (vertical 1080 × 1920) usando la app real con los datos de ejemplo.
// Uso: python3 -m http.server 8765 (en la raíz) y después: node tools/video-anuncio.mjs
// Deja descargas/padel-metric-anuncio.mp4 (necesita ffmpeg). Los rótulos se dibujan encima de la app.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const url = process.argv[2] || 'http://localhost:8765/';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-video-'));
const b = await chromium.launch();
// Pantalla de móvil de 432 × 768 a 2,5 píxeles por punto = 1080 × 1920. Se graba con el "screencast" de Chromium
// (fotogramas a resolución real; la grabación de Playwright los reduce al tamaño de la ventana)
const ctx = await b.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, colorScheme: 'dark' });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('v')) return;
  sessionStorage.setItem('v', '1');
  ['pm_bienvenida_v1', 'pm_guia_partido_v1'].forEach(k => localStorage.setItem(k, '1'));
  localStorage.setItem('pm_novedades_v1', '999');
});
const p = await ctx.newPage();
const wait = ms => p.waitForTimeout(ms);
await p.goto(url);
await p.evaluate(() => loadDemoData());
await p.waitForFunction(() => matchHistory.length > 20);
const frames = [];
const cdp = await ctx.newCDPSession(p);
cdp.on('Page.screencastFrame', async f => {
  const file = path.join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
  fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
  frames.push({ file, t: f.metadata.timestamp });
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await p.evaluate(() => {
  chooseMe(dbPlayers[0]); markBackupDone(); appSettings.installHintHidden = true; closeEventModal(); switchMainTab('home');
  // Capa de rótulos (solo para el vídeo)
  const css = document.createElement('style');
  css.textContent = `
    #toast-hud { display: none !important; }
    #promo-cap { position: fixed; left: 0; right: 0; top: 0; z-index: 400; padding: calc(16px + var(--sa-t, 0px)) 22px 16px; background: #030508; border-bottom: 1px solid rgba(255,255,255,0.08); transform: translateY(-110%); transition: transform .45s cubic-bezier(.2,.8,.2,1); }
    #promo-cap.on { transform: none; }
    #promo-cap b { display: block; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 34px; line-height: 1; color: #F5F7FA; text-transform: uppercase; }
    #promo-cap span { display: block; margin-top: 6px; font: 500 16px 'Barlow', sans-serif; color: #A8B1BE; }
    #promo-full { position: fixed; inset: 0; z-index: 500; background: #030508; display: flex; flex-direction: column; justify-content: center; padding: 36px; gap: 14px; opacity: 0; pointer-events: none; transition: opacity .5s; }
    #promo-full.on { opacity: 1; }
    #promo-full svg { width: 78px; height: 78px; color: #D4FF2A; }
    #promo-full .t1 { font-family: 'Barlow Condensed', sans-serif; font-style: italic; font-weight: 900; font-size: 54px; line-height: .9; color: #F5F7FA; }
    #promo-full .t2 { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 40px; line-height: .95; color: #F5F7FA; text-transform: uppercase; }
    #promo-full .t3 { font: 500 18px/1.45 'Barlow', sans-serif; color: #A8B1BE; }
    #promo-full .t4 { margin-top: 10px; display: inline-block; align-self: flex-start; background: #D4FF2A; color: #06090F; font: 700 18px 'Barlow', sans-serif; padding: 12px 18px; border-radius: 12px; }`;
  document.head.appendChild(css);
  const cap = document.createElement('div'); cap.id = 'promo-cap'; document.body.appendChild(cap);
  const full = document.createElement('div'); full.id = 'promo-full'; document.body.appendChild(full);
  window.promoCap = (t, s = '') => { cap.innerHTML = `<b>${t}</b>${s ? `<span>${s}</span>` : ''}`; cap.classList.add('on'); };
  window.promoCapOff = () => cap.classList.remove('on');
  window.promoFull = html => { full.innerHTML = html; full.classList.add('on'); };
  window.promoFullOff = () => full.classList.remove('on');
});
const logo = '<svg><use href="#logo-mark"/></svg>';
await p.evaluate(() => promoFull(''));
await wait(600);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });

// 1. Portada
await p.evaluate(l => promoFull(`${l}<div class="t1">PADEL METRIC</div><div class="t2">Tu pádel,<br>punto a punto</div><div class="t3">Marcador, estadísticas y crónica de cada partido.</div>`), logo);
await wait(2600);
await p.evaluate(() => promoFullOff());
await wait(400);

// 2. Inicio
await p.evaluate(() => promoCap('Empieza en un toque', 'Repite el último partido o juega uno rápido'));
await wait(2400);

// 3. Partido: puntos, gestos y golpes
await p.evaluate(() => { promoCapOff(); repeatMatch(0); });
await wait(700);
await p.evaluate(() => promoCap('Anota punto a punto', 'Toca la pareja que gana el punto'));
for (const t of [0, 0, 1, 0]) { await p.click(t ? '.qp.b' : '.qp.a'); await wait(650); }
await p.evaluate(() => promoCap('Golpes ganadores y errores', 'Desliza sobre el jugador y elige el golpe'));
const card = await p.locator('#pcard-1').boundingBox();
await p.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
await p.mouse.down();
await p.mouse.move(card.x + card.width / 2, card.y + card.height / 2 - 70, { steps: 10 });
await p.mouse.up();
await wait(1300);
await p.click('.shot-tile:has-text("Víbora")');
await wait(900);
await p.evaluate(() => promoCap('Probabilidad de victoria', 'Se recalcula después de cada punto'));
for (const t of [1, 0, 0, 1, 0, 0, 0, 1, 0]) { await p.click(t ? '.qp.b' : '.qp.a'); await wait(380); }
await wait(1400);

// 4. Estadísticas de un partido completo
const hi = await p.evaluate(() => {
  discardCurrentMatch();
  return matchHistory.findIndex(m => m.sets.filter(s => s[0] + s[1]).length === 3 && m.players.every(x => !x.isGeneric));
});
await wait(300);
await p.evaluate(i => { promoCap('Estadísticas de profesional', 'Mapa de calor, saque, resto y puntos clave'); switchMainTab('history'); openHistoryMatchStats(i); renderStats('heatmap'); }, hi);
await wait(2600);
await p.evaluate(() => renderStats('clave'));
await wait(2200);

// 5. Resumen con crónica (texto real escrito por la IA para este partido)
await p.evaluate(i => {
  matchHistory[i].aiSummary = { at: Date.now(), texto: `Javier e Iván vencen a Marcos y Sergio en el súper tie-break

Javier e Iván se impusieron por 6-3, 5-7 y 14-12 en el súper tie-break, tras 109 minutos de juego. La pareja perdió el segundo set por 5-7 y llegó al tercero con una probabilidad de victoria del 4 %. Marcos y Sergio habían igualado el encuentro, pero no supieron cerrarlo en el momento decisivo.

En el resto, la pareja ganadora acertó el 46 % de sus puntos, frente al 41 % de sus rivales. Javier fue el jugador con más golpes ganadores en puntos decisivos, ocho, y terminó con 26 winners.

Para el próximo partido:
Javier / Iván: mantener la eficacia al resto y reducir los 27 errores no forzados de la pareja.
Marcos / Sergio: bajar los 31 errores no forzados de la pareja y mejorar el 41 % de acierto al resto.` };
  switchMainTab('home');
  promoCap('Crónica del partido con IA', 'Lista para compartir con tu grupo');
  openMatchSummary('history', i);
}, hi);
await wait(2400);
await p.evaluate(() => document.querySelector('#event-modal .telemetry-sheet, #event-modal [class*="sheet"]')?.scrollBy({ top: 420, behavior: 'smooth' }));
await wait(2000);

// 6. Ranking y carta
await p.evaluate(() => { closeEventModal(); promoCap('Ranking y carta de jugador', 'ELO, atributos y evolución de cada uno'); switchMainTab('ranking'); });
await wait(1800);
await p.evaluate(() => { openPlayerProfile(dbPlayers[0]); setProfileTab('card'); });
await wait(2400);

// 7. Temporada en historias
await p.evaluate(() => { closePlayerProfile(); promoCapOff(); openWrapped(dbPlayers[0]); });
await wait(1200);
await p.evaluate(() => { promoCap('Tu temporada en historias'); wrapGo(2); });
await wait(1800);
await p.evaluate(() => wrapGo(3));
await wait(1800);
await p.evaluate(() => closeWrapped());

// 8. Americanos
await p.evaluate(() => { promoCap('Americanos y torneos', 'Cruces y clasificación automáticos, también en directo'); switchMainTab('americano'); openAmericano(americanos[0].id); });
await wait(2600);

// 9. Cierre
await p.evaluate(l => { promoCapOff(); promoFull(`${l}<div class="t1">PADEL METRIC</div><div class="t3">Gratis en Android y en el navegador.<br>Sin crear cuenta.</div><div class="t4">juancbr9.github.io/padel_metric_2026</div>`); }, logo);
await wait(3200);

await cdp.send('Page.stopScreencast');
const end = Date.now() / 1000;
await b.close();
// Cada fotograma dura hasta el siguiente (Chromium solo manda fotogramas cuando algo cambia)
const list = frames.map((f, k) => `file '${f.file}'\nduration ${Math.max(0.001, ((frames[k + 1] ? frames[k + 1].t : end) - f.t)).toFixed(3)}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`;
fs.writeFileSync(path.join(tmp, 'lista.txt'), list);
fs.mkdirSync('descargas', { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'lista.txt'),
  '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x030508,fps=30,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-movflags', '+faststart', '-an', 'descargas/padel-metric-anuncio.mp4']);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`vídeo listo: descargas/padel-metric-anuncio.mp4 (${frames.length} fotogramas)`);
