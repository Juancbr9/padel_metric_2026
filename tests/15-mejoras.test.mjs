// Nuevo partido rediseñado, compartir (imagen de estadísticas), código de pruebas de la IA, fotos de perfil desde la
// foto del grupo, buscador del cara a cara, americanos con lista y duración total, ranking solo con puntos de colores
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGNkYPjPgAGYcAkMHgEAJ+4BD4XyBTAAAAAASUVORK5CYII=', 'base64');
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  let lastHeaders = null, lastBody = null;
  await p.route('**/functions/v1/resumen-partido', r => {
    lastHeaders = r.request().headers();
    lastBody = r.request().postDataJSON();
    if (lastBody.tipo === 'caras') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ caras: [{ x: 0.1, y: 0.1, w: 0.3, h: 0.4 }, { x: 0.6, y: 0.1, w: 0.3, h: 0.4 }], restantes: 99 }) });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ texto: 'Titular\n\nTexto.', restantes: 99 }) });
  });
  await p.goto(url);
  await p.evaluate(() => loadDemoData());
  await p.waitForFunction(() => matchHistory.length > 20);

  // Nuevo partido: jugadores en la pista con su lado, rótulo de pareja, sortear y botón fijo abajo
  await p.evaluate(() => { switchMainTab('setup'); setupConfig.slots = dbPlayers.slice(0, 4); renderSetupCourt(); });
  assert.equal(await p.locator('.np-slot.assigned').count(), 4, 'Los cuatro jugadores en la pista');
  assert((await p.textContent('#np-pair-a')).includes('ELO medio'), 'Cada pareja con su nivel');
  const before = await p.evaluate(() => setupConfig.slots.join('|'));
  let changed = false;
  for (let k = 0; k < 5 && !changed; k++) { await p.click('button:has-text("Sortear parejas")'); changed = (await p.evaluate(() => setupConfig.slots.join('|'))) !== before; }
  assert(changed, 'Sortear cambia las parejas');
  assert((await p.textContent('#np-summary')).includes('contra'), 'Resumen del partido junto al botón de empezar');

  // Compartir: tres opciones y la imagen de estadísticas
  await p.evaluate(() => openShareMatchSheet(matchHistory[0]));
  assert.equal(await p.locator('.share-opt').count(), 3, 'Imagen del resultado, de estadísticas y texto');
  await p.click('.share-opt:has-text("Imagen de las estadísticas")');
  await p.waitForSelector('#poster-modal', { state: 'visible' });
  assert.equal(await p.textContent('#poster-modal-title'), 'Estadísticas del partido', 'Se crea la imagen de estadísticas');
  await p.evaluate(() => closePosterModal());

  // Código de pruebas: se envía con la crónica
  await p.evaluate(() => { localStorage.setItem('pm_codigo_pruebas_v1', 'PM-PRUEBA'); openMatchSummary('history', 0); });
  assert((await p.textContent('.ai-cta')).includes('sin límite'), 'Con código de pruebas, sin límite');
  await p.click('#ai-go');
  await p.waitForSelector('.ai-text');
  assert.equal(lastHeaders['x-pm-codigo'], 'PM-PRUEBA', 'El código viaja en la cabecera');
  await p.evaluate(() => closeEventModal());

  // Fotos de perfil desde la foto del grupo
  const players = await p.evaluate(() => { const m = matchHistory.find(x => x.players.every(y => !y.isGeneric)); posterTargetState = m; openPosterModal(); return m.players.map(x => x.name); });
  await p.setInputFiles('#poster-photo-tools input[type=file]', { name: 'grupo.png', mimeType: 'image/png', buffer: PNG });
  await p.waitForFunction(() => !!posterPhoto);
  await p.click('#poster-faces-btn');
  await p.waitForSelector('.face-grid');
  assert.equal(lastBody.tipo, 'caras', 'Se pide a la IA que busque las caras');
  assert.equal(await p.locator('.face-item').count(), 2, 'Una por cada cara encontrada');
  await p.click('button:has-text("Guardar fotos")');
  assert(await p.evaluate(n => !!dbProfiles[n[0]].photo && !!dbProfiles[n[1]].photo, players), 'Las caras pasan a ser fotos de perfil');
  await p.evaluate(() => closePosterModal());

  // Cara a cara con buscador
  await p.evaluate(() => { switchMainTab('ranking'); setRankingTab('h2h'); });
  await p.click('#h2h-b2');
  await p.fill('#ps-search', players[2].split(' ')[0]);
  await p.click(`#ps-list .me-row:not(.hidden) >> nth=0`);
  assert.equal(await p.evaluate(() => document.getElementById('h2h-p2').value.split(' ')[0]), players[2].split(' ')[0], 'Se elige con el buscador');
  assert.equal(await p.locator('#rk-panel-h2h select').count(), 0, 'Sin desplegables gigantes');

  // Americano: lista con buscador, pistas y duración total
  await p.evaluate(() => { switchMainTab('americano'); startAmericanoDraft(); });
  await p.fill('.chooser-search', players[0].split(' ')[0]);
  assert(await p.locator('.chooser-row:not(.hidden)').count() >= 1, 'El buscador filtra la lista');
  await p.evaluate(() => dbPlayers.slice(0, 8).forEach(n => toggleAPlayer(n)));
  assert.equal(await p.locator('.chooser-row.on').count(), 8, 'Ocho jugadores marcados');
  await p.click('.dur-chips button:has-text("1 h 30")');
  const plan = await p.evaluate(() => ({ r: draftDefaults(eventDraft).rounds, txt: document.querySelector('.bento-card:last-of-type')?.textContent || '' }));
  assert.equal(plan.r, Math.floor(90 / 14), 'Las rondas salen de la duración total (24 puntos ≈ 14 min)');
  assert((await p.textContent('#view-americano')).includes('duración estimada'), 'Se ve el plan con la duración');
};
