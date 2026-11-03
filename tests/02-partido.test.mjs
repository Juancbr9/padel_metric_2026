// Partido completo: saque, golpes, deshacer, tie-break, cierre y compartir desde el cierre
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  await p.goto(url);
  await p.evaluate(() => switchMainTab('setup'));
  await p.click('text=EMPEZAR PARTIDO');
  await p.waitForTimeout(300);
  assert(await p.evaluate(() => document.body.classList.contains('in-live-match')), 'Empieza el partido');

  // Orden de saque: drive P1 → drive P2 → revés P1 → revés P2
  const servers = await p.evaluate(() => {
    const out = [state.serverIdx];
    for (let g = 0; g < 3; g++) { for (let i = 0; i < 4; i++) addNeutralPoint(g % 2); out.push(state.serverIdx); }
    return out;
  });
  assert.equal(servers.join(','), '0,3,1,2', 'Orden de saque');

  // Modo sencillo (por defecto): tocar la tarjeta abre tres botones
  assert.equal(await p.evaluate(() => state.inputMode), 'swipe', 'Por defecto, modo sencillo');
  const before = await p.evaluate(() => state.players[0].W);
  await p.click('#pcard-0');
  await p.waitForTimeout(150);
  assert.equal(await p.locator('#shot-grid .shot-tile').count(), 0, 'En sencillo no se elige golpe');
  await p.click('#shot-grid .simple-act.w');
  await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => state.players[0].W), before + 1, 'El winner suma al jugador');
  await p.click('#btn-undo');
  await p.waitForTimeout(150);
  assert.equal(await p.evaluate(() => state.players[0].W), before, 'Deshacer quita el winner');

  // Modo avanzado: golpe y sitio en la pista, con la perspectiva elegida
  await p.evaluate(() => { setMatchInputMode('tap'); setMatchView('p1'); closeEventModal(); });
  assert(await p.evaluate(() => document.querySelector('.court-arena').classList.contains('view-p1')), 'La pista se gira a la perspectiva elegida');
  await p.click('#pcard-2');
  await p.waitForTimeout(150);
  await p.click('#shot-grid .tile-win >> nth=0');
  await p.waitForTimeout(150);
  assert(await p.isVisible('.court-pick svg'), 'Después del golpe se marca el sitio');
  // Vista detrás de la pareja 1: la pareja 2 (la que golpea) está arriba; tocamos cerca de la red, a la izquierda
  const box = await p.locator('.court-pick svg').boundingBox();
  await p.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.42);
  await p.waitForTimeout(400);
  const last = await p.evaluate(() => state.points[state.points.length - 1]);
  assert(last.cx != null && last.cy > 0.5, 'Se guarda el sitio exacto en el campo de la pareja 2');
  assert.equal(last.z, 'R', 'Cerca de la red es zona de red');
  assert.equal(last.l, 'D', 'Desde detrás de la pareja 1, la izquierda de la pareja 2 es su drive');
  await p.click('#btn-undo');
  await p.evaluate(() => { setMatchInputMode('swipe'); closeEventModal(); });

  // Tie-break a 6-6
  await p.evaluate(() => { state.sets[state.currentSet] = [6, 5]; state.pts = [0, 0]; for (let i = 0; i < 4; i++) addNeutralPoint(1); });
  assert(await p.evaluate(() => state.inTieBreak), 'A 6-6 se juega tie-break');
  await p.evaluate(() => { for (let i = 0; i < 7; i++) addNeutralPoint(0); });
  assert.equal(await p.evaluate(() => JSON.stringify(state.sets[0])), '[7,6]', 'El tie-break da el set 7-6');

  // Segundo set y fin del partido
  await p.evaluate(() => { for (let i = 0; i < 24; i++) addNeutralPoint(0); });
  assert(await p.evaluate(() => state.matchOver), 'El partido termina');
  await p.waitForTimeout(2600);
  assert(await p.isVisible('#match-end'), 'Se abre el cierre del partido');

  // Compartir desde el cierre: la hoja queda por encima y crea el enlace
  await p.click('#match-end button:has-text("Compartir")');
  await p.waitForTimeout(500);
  const onTop = await p.evaluate(() => {
    const b = document.getElementById('share-send').getBoundingClientRect();
    return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest('#event-modal') !== null;
  });
  assert(onTop, 'La hoja de compartir se ve por encima del cierre');
  assert(/#partido=z/.test(await p.evaluate(() => shareSheetLink)), 'Se crea el enlace comprimido');
  await p.evaluate(() => { closeEventModal(); closeMatchEnd(); exitMatchScreen(); });
  await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => matchHistory.length), 1, 'El partido queda en el historial');
};
