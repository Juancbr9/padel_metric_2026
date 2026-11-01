// Enlace de resultado: se crea desde el historial, se abre en otro móvil sin datos y se guarda en su historial
export default async ({ newPage, url, assert }) => {
  const a = await newPage();
  await a.goto(url);
  await a.evaluate(() => loadDemoData());
  await a.waitForTimeout(800);
  const original = await a.evaluate(() => ({ id: matchHistory[0].id, sets: JSON.stringify(matchHistory[0].sets), W: matchHistory[0].players.map(x => x.W).join(',') }));
  await a.evaluate(() => { switchMainTab('history'); openHistoryActions(0); });
  await a.click('#event-modal button:has-text("Compartir")');
  await a.waitForFunction(() => shareSheetLink);
  const link = await a.evaluate(() => shareSheetLink);
  assert(link.length < 900, `El enlace es corto (${link.length} caracteres)`);
  assert(await a.isVisible('#share-qr svg'), 'La hoja muestra el QR');

  const b = await newPage({ viewport: { width: 360, height: 760 } });
  await b.goto(url + link.slice(link.indexOf('#')));
  await b.waitForSelector('.spx-row');
  assert(await b.evaluate(() => document.body.classList.contains('spectator-mode')), 'Se abre la ficha pública');
  assert(!(await b.isVisible('#wrapped')), 'La ficha no muestra la bienvenida');
  assert.equal(await b.locator('.spx-player').count(), 4, 'Se ven los cuatro jugadores');
  assert(await b.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'La ficha cabe a 360 px');
  await b.click('button:has-text("Guardar en mi historial")');
  const saved = await b.evaluate(() => ({ n: matchHistory.length, id: matchHistory[0].id, sets: JSON.stringify(matchHistory[0].sets), W: matchHistory[0].players.map(x => x.W).join(','), players: dbPlayers.length }));
  assert.equal(saved.n, 1, 'Se guarda en el historial');
  assert.equal(saved.id, original.id, 'Mantiene el mismo identificador');
  assert.equal(saved.sets, original.sets, 'Mismo resultado');
  assert.equal(saved.W, original.W, 'Mismas estadísticas');
  assert.equal(saved.players, 4, 'Los jugadores pasan a la base de datos');
  assert(await b.isVisible('button:has-text("Ya está en tu historial")'), 'No se puede guardar dos veces');
  await b.click('button:has-text("Abrir la app")');
  assert.equal(await b.evaluate(() => location.hash), '', 'Al abrir la app se limpia el enlace');
  assert(await b.isVisible('#view-home'), 'Y se ve el inicio');

  // Enlace roto
  const c = await newPage();
  await c.goto(url + '#partido=zAAAAAAAAAAAA');
  await c.waitForTimeout(500);
  assert(/no es válido/.test(await c.textContent('#view-spectator')), 'Un enlace roto avisa sin romper la app');
};
