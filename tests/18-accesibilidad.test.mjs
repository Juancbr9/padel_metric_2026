// Accesibilidad (Web Interface Guidelines y skill taste): zoom permitido, saltar al contenido, un h1 por pantalla,
// todo lo que se toca es un botón con nombre y de 44 px, campos con etiqueta, fondo inerte bajo las hojas,
// números y fechas con Intl
export default async ({ newPage, url, assert }) => {
  const p = await newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(url);
  assert(!(await p.getAttribute('meta[name="viewport"]', 'content')).match(/maximum-scale|user-scalable/), 'El zoom no está bloqueado');
  assert.equal(await p.locator('a.skip-link[href="#contenido"]').count(), 1, 'Enlace «Saltar al contenido»');
  assert.equal(await p.locator('main#contenido').count(), 1, 'Contenido principal en <main>');
  await p.evaluate(() => loadDemoData());
  await p.waitForFunction(() => matchHistory.length > 20);

  // Lo que se ve en cada pantalla
  const audit = () => p.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) return false; for (let x = el; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
    const h1 = [...document.querySelectorAll('h1')].filter(h => { for (let x = h; x; x = x.parentElement) if (getComputedStyle(x).display === 'none') return false; return true; }).length;
    const clicks = [...document.querySelectorAll('[onclick]')].filter(el => !/^(BUTTON|A|INPUT|LABEL)$/.test(el.tagName) && !el.matches('.sheet-backdrop, .app-menu, .app-menu-panel, .match-end, [role=dialog]') && vis(el)).map(el => el.className);
    const unnamed = [...document.querySelectorAll('button, a[href]')].filter(el => vis(el) && !(el.getAttribute('aria-label') || el.textContent.trim())).map(el => el.className);
    const unlabeled = [...document.querySelectorAll('input:not([type=hidden]):not([type=file]), select, textarea')].filter(el => vis(el) && !(el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label'))).map(el => el.id);
    return { h1, clicks, unnamed, unlabeled };
  });
  for (const [name, go] of [
    ['inicio', () => switchMainTab('home')],
    ['nuevo partido', () => switchMainTab('setup')],
    ['ranking', () => switchMainTab('ranking')],
    ['historial', () => switchMainTab('history')],
    ['americanos', () => switchMainTab('americano')],
    ['partido', () => repeatMatch(0)],
  ]) {
    await p.evaluate(go);
    const a = await audit();
    assert.equal(a.h1, 1, `Un h1 en ${name}`);
    assert.deepEqual(a.clicks, [], `Sin <div onclick> en ${name}`);
    assert.deepEqual(a.unnamed, [], `Botones con nombre en ${name}`);
    assert.deepEqual(a.unlabeled, [], `Campos con etiqueta en ${name}`);
  }
  // Botones del partido de 44 px como mínimo
  const sizes = await p.evaluate(() => ['.qp.a', '#btn-undo', '#btn-match-options', '#btn-match-exit', '.serve-fault'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().height)));
  assert(sizes.every(h => h >= 44), `Zonas táctiles de 44 px (${sizes.join(', ')})`);

  // Con una hoja abierta, el fondo queda inerte y el foco entra en ella
  await p.evaluate(() => openMatchOptions());
  await p.waitForFunction(() => document.getElementById('contenido').inert);
  assert(await p.evaluate(() => document.getElementById('event-modal').contains(document.activeElement)), 'El foco entra en la hoja');
  await p.evaluate(() => closeEventModal());
  await p.waitForFunction(() => !document.getElementById('contenido').inert);
  await p.evaluate(() => discardCurrentMatch());

  // Números y fechas en español con Intl
  assert.equal(await p.evaluate(() => fmtNum(6.53, 1)), '6,5');
  assert.equal(await p.evaluate(() => fmtNum(12345)), '12.345');
  assert.equal(await p.evaluate(() => fmtDate(new Date(2026, 10, 2, 21, 41), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })), '02 nov, 21:41');
};
