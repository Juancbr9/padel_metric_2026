// Clasificación en directo de un americano y de un torneo (con un servidor de directo simulado)
export default async ({ newPage, url, assert, mockLive }) => {
  const org = await newPage();
  const store = await mockLive(org);
  await org.goto(url);
  await org.evaluate(() => loadDemoData());
  await org.waitForTimeout(800);

  // Americano: emitir
  const aid = await org.evaluate(() => americanos.find(a => a.status !== 'finished').id);
  await org.evaluate(id => { switchMainTab('americano'); openAmericano(id); }, aid);
  await org.click('.event-share-row button:has-text("Emitir en directo")');
  await org.waitForFunction(() => document.querySelector('#ev-bc-status.ok'));
  const code = await org.evaluate(id => findAmericano(id).live.code, aid);
  assert(store[code], 'Se publica la clasificación');
  assert.equal(store[code].data.kind, 'ev', 'Datos de evento');
  await org.evaluate(() => closeEventModal());
  assert(await org.isVisible('.event-share-row .is-live'), 'El botón indica que está en directo');

  // Espectador
  const fan = await newPage({ viewport: { width: 360, height: 760 } });
  await mockLive(fan);
  await fan.goto(`${url}#directo=${code}`);
  await fan.waitForSelector('.spe-table');
  const rows = await fan.locator('.spe-table tbody tr').count();
  assert.equal(rows, await org.evaluate(id => americanoStandings(findAmericano(id)).length, aid), 'El espectador ve toda la clasificación');
  assert(await fan.isVisible('.spe-game'), 'Y los partidos de la ronda');
  assert(await fan.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'La clasificación cabe a 360 px');

  // Nuevo resultado → se vuelve a publicar solo
  const n = store[code].n;
  await org.evaluate(id => {
    const ev = findAmericano(id);
    if (ev.rounds.every(roundComplete) && ev.rounds.length < ev.totalRounds) nextAmericanoRound(id);
    const ri = ev.rounds.findIndex(r => !roundComplete(r));
    const mi = ev.rounds[ri].matches.findIndex(m => m.sa === null);
    const m = ev.rounds[ri].matches[mi];
    m.sa = 5; m.sb = 3;
    updateAmericanoStatus(ev);
    saveDB();
  }, aid);
  await org.waitForTimeout(1500);
  assert(store[code].n > n, 'Al guardar un resultado se actualiza el directo');

  // Pausar
  await org.evaluate(id => { openEventBroadcast('a', id); toggleEventBroadcast(); }, aid);
  await org.waitForTimeout(400);
  assert.equal(store[code].data.on, false, 'Pausar avisa a los espectadores');

  // Torneo
  const tid = await org.evaluate(() => tournaments[0].id);
  await org.evaluate(id => { closeEventModal(); switchMainTab('tournaments'); openTournament(id); }, tid);
  await org.click('.event-share-row button:has-text("Emitir en directo")');
  await org.waitForTimeout(600);
  const tcode = await org.evaluate(id => findTournament(id).live.code, tid);
  await fan.goto(`${url}#directo=${tcode}`);
  await fan.waitForSelector('.spe-title');
  assert.equal(await fan.textContent('.spe-title'), await org.evaluate(id => findTournament(id).name, tid), 'El espectador ve el torneo');

  // El marcador de un partido sigue funcionando igual
  await org.evaluate(() => { closeEventModal(); switchMainTab('setup'); startMatch(); openBroadcastPanel(); });
  await org.waitForTimeout(600);
  const mcode = await org.evaluate(() => state.live.code);
  await fan.goto(`${url}#directo=${mcode}`);
  await fan.waitForSelector('.spx-row');
  assert.equal(await fan.locator('.spx-row').count(), 2, 'El directo de un partido muestra el marcador');
};
