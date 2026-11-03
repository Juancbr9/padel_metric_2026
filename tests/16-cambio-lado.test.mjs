// Cambio de lado: las parejas cambian de campo en los juegos impares (y cada 6 puntos del tie-break); la pista del
// partido se gira, se puede corregir desde Opciones y se puede apagar en Ajustes. Sin el botón Revancha.
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  await p.goto(url);
  const view = () => p.evaluate(() => ['p1', 'p2', 'side', 'side2'].find(v => document.querySelector('#view-match .court-arena').classList.contains(`view-${v}`)));
  const game = (pair) => p.evaluate(k => { for (let i = 0; i < 4; i++) addNeutralPoint(k); }, pair);

  await p.evaluate(() => { setupConfig.inputMode = 'swipe'; quickMatch(); });
  assert.equal(await view(), 'p2', 'Empieza con la pareja 1 arriba');
  await game(0);
  assert.equal(await p.evaluate(() => state.ends), 1, 'Tras el primer juego cambian de lado');
  assert.equal(await view(), 'p1', 'La pista se gira');
  await game(1);
  assert.equal(await p.evaluate(() => state.ends), 1, 'Tras el segundo juego, no');
  await game(1);
  assert.equal(await p.evaluate(() => state.ends), 0, 'Tras el tercero, otra vez');
  assert.equal(await view(), 'p2');
  await p.evaluate(() => undoLast());
  assert.equal(await p.evaluate(() => state.ends), 1, 'Deshacer devuelve el lado');
  await p.evaluate(() => addNeutralPoint(1));

  // Fin de set con un total impar de juegos (6-3): el set siguiente empieza cambiado
  await p.evaluate(() => { state.sets[0] = [5, 3]; state.ends = 0; });
  await game(0);
  assert.equal(await p.evaluate(() => [state.currentSet, state.ends].join()), '1,1', '6-3: cambian de lado para el segundo set');
  // 6-4 (par): no cambian
  await p.evaluate(() => { state.sets[1] = [5, 4]; state.ends = 0; });
  await game(0);
  assert.equal(await p.evaluate(() => state.matchOver), true);
  await p.evaluate(() => discardCurrentMatch());

  // Tie-break: cada 6 puntos y al terminarlo (cuenta como el juego 13)
  await p.evaluate(() => { quickMatch(); state.sets[0] = [6, 5]; state.ends = 0; });
  await game(1);
  assert.equal(await p.evaluate(() => [state.inTieBreak, state.ends].join()), 'true,0', '6-6 no cambia de lado');
  await p.evaluate(() => { for (let i = 0; i < 3; i++) { addNeutralPoint(0); addNeutralPoint(1); } });
  assert.equal(await p.evaluate(() => state.ends), 1, 'A los 6 puntos del tie-break');
  await p.evaluate(() => { for (let i = 0; i < 4; i++) addNeutralPoint(0); });
  assert.equal(await p.evaluate(() => [state.inTieBreak, state.currentSet, state.ends].join()), 'false,1,0', 'Al acabar el tie-break');

  // Opciones: esquema de la pista y botones para recolocar
  await p.evaluate(() => openMatchOptions());
  assert.equal(await p.locator('.mo-court .mo-court-p').count(), 4, 'Los cuatro jugadores en el esquema');
  await p.click('button:has-text("Cambiar de lado las parejas")');
  assert.equal(await p.evaluate(() => state.ends), 1, 'Cambio de lado a mano');
  assert.equal(await view(), 'p1');
  const before = await p.evaluate(() => state.players[0].name);
  await p.click('.mo-pos-actions button:has-text("Intercambiar J1")');
  assert(await p.evaluate(n => state.players[1].name === n && state.players[0].side === 'Drive', before), 'Intercambia drive y revés de una pareja');
  await p.evaluate(() => closeEventModal());

  // Modo avanzado desde el lateral: con el cambio de lado, la pareja 1 pasa a la derecha y el golpe se guarda bien
  await p.evaluate(() => { setMatchInputMode('tap'); setMatchView('side'); closeEventModal(); });
  assert.equal(await view(), 'side2', 'Lateral girado');
  await p.evaluate(() => { openShotSheet(0, 'W'); pickShotLocation('W', 'volea'); });
  const box = await p.locator('.court-pick svg').boundingBox();
  await p.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.2);
  await p.waitForFunction(() => state.points.at(-1).sh === 'volea');
  const pt = await p.evaluate(() => state.points.at(-1));
  assert(pt.cy < 0.5 && pt.z === 'R' && pt.l === 'D', `Golpe de la pareja 1 en la red y en su drive (${JSON.stringify(pt)})`);

  // Ajustes: apagar el cambio automático (solo avisa)
  await p.evaluate(() => openSettingsSheet());
  assert(await p.evaluate(() => document.getElementById('sw-autoEnds').classList.contains('on')), 'Encendido por defecto');
  await p.click('#sw-autoEnds');
  await p.evaluate(() => closeEventModal());
  const ends = await p.evaluate(() => state.ends);
  await game(0);
  assert.equal(await p.evaluate(() => state.ends), ends, 'Apagado, la pista no se mueve');

  // El cierre del partido ya no tiene Revancha
  await p.evaluate(() => finishMatchManually());
  await p.waitForSelector('#match-end', { state: 'visible' });
  assert.equal(await p.locator('#match-end button:has-text("Revancha")').count(), 0, 'Sin Revancha');
};
