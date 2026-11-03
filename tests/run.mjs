// Pruebas automáticas de Padel Metric: abren la app en un navegador Chromium sin ventana y la usan como una persona.
// Uso: npm test            (todas)
//      npm test -- enlace  (solo las que contengan "enlace" en el nombre)
// Cada archivo tests/NN-nombre.test.mjs exporta una función async que recibe { newPage, url, assert, mockLive }.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.apk': 'application/octet-stream' };

// Servidor estático mínimo (como GitHub Pages)
const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(ROOT, clean);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('No encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

class AssertError extends Error {}
const assert = (cond, msg) => { if (!cond) throw new AssertError(msg); };
assert.equal = (a, b, msg) => { if (a !== b) throw new AssertError(`${msg}: se esperaba ${JSON.stringify(b)} y llegó ${JSON.stringify(a)}`); };
assert.deepEqual = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);

const browser = await chromium.launch();
const filter = process.argv[2] || '';
const files = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.test.mjs') && f.includes(filter)).sort();
let failed = 0;

for (const f of files) {
  const contexts = [];
  const errors = [];
  // Página nueva con almacenamiento vacío; opts.seen = true marca bienvenida y novedades como vistas
  const newPage = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 400, height: 860 }, acceptDownloads: true, colorScheme: 'dark' });
    contexts.push(ctx);
    if (opts.seen !== false) await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); localStorage.setItem('pm_bienvenida_v1', '1'); localStorage.setItem('pm_novedades_v1', '999'); localStorage.setItem('pm_guia_partido_v1', '1'); } } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`Error de la página: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|navigator\.vibrate/.test(m.text())) errors.push(`Consola: ${m.text()}`); });
    page.on('dialog', d => d.accept());
    return page;
  };
  // Servidor de directo simulado (pm_live_publish / pm_live_get) compartido entre páginas
  const liveStore = {}, joinStore = {};
  const mockLive = async (page) => {
    await page.route('**/rest/v1/rpc/pm_live_publish', r => {
      const d = r.request().postDataJSON();
      const prev = liveStore[d.p_code];
      if (prev && prev.secret !== d.p_secret) return r.fulfill({ status: 200, contentType: 'application/json', body: 'false' });
      liveStore[d.p_code] = { secret: d.p_secret, data: d.p_data, updated_at: new Date().toISOString(), n: (prev ? prev.n : 0) + 1 };
      r.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
    });
    await page.route('**/rest/v1/rpc/pm_live_get', r => {
      const row = liveStore[r.request().postDataJSON().p_code];
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [{ data: row.data, updated_at: row.updated_at, server_now: new Date().toISOString() }] : []) });
    });
    // Inscripción con QR: se comporta como las funciones de supabase/inscripcion.sql
    await page.route('**/rest/v1/rpc/pm_live_join', r => {
      const d = r.request().postDataJSON();
      const lobby = liveStore[d.p_code];
      const ok = /^[a-z0-9]{16,64}$/.test(d.p_player) && lobby && lobby.data.kind === 'signup' && lobby.data.open === true;
      if (ok) {
        const joins = joinStore[d.p_code] = joinStore[d.p_code] || {};
        joins[d.p_player] = { data: d.p_data, created: joins[d.p_player] ? joins[d.p_player].created : Date.now() + Object.keys(joins).length };
      }
      r.fulfill({ status: 200, contentType: 'application/json', body: ok ? 'true' : 'false' });
    });
    await page.route('**/rest/v1/rpc/pm_live_joins', r => {
      const joins = joinStore[r.request().postDataJSON().p_code] || {};
      const rows = Object.entries(joins).sort((a, b) => a[1].created - b[1].created).map(([player, j]) => ({ id: player.slice(0, 12), data: j.data, updated_at: new Date().toISOString() }));
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });
    return liveStore;
  };
  const t0 = Date.now();
  try {
    const mod = await import(path.join(ROOT, 'tests', f));
    await mod.default({ newPage, url, assert, mockLive });
    assert(!errors.length, errors.join('\n'));
    console.log(`  ✓ ${f} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${f}\n    ${String(e instanceof AssertError ? e.message : e.stack || e).replace(/\n/g, '\n    ')}`);
    if (errors.length && !(e instanceof AssertError)) console.log(`    ${errors.join('\n    ')}`);
  }
  for (const c of contexts) await c.close();
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} de ${files.length} pruebas han fallado` : `\nLas ${files.length} pruebas han pasado`);
process.exit(failed ? 1 : 0);
