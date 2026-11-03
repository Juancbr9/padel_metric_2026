// Efectos: animación de entrada del logo, trayectoria del golpe, cierre de retransmisión, póster con foto,
// marcador gigante en horizontal y modo tele del directo con avisos
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGNkYPjPgAGYcAkMHgEAJ+4BD4XyBTAAAAAASUVORK5CYII=', 'base64');
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  await p.goto(url);
  // Entrada del logo: aparece, no bloquea y se va sola
  assert(await p.locator('#intro-splash').count() === 1, 'Sale la animación de entrada');
  await p.waitForTimeout(2600);
  assert.equal(await p.locator('#intro-splash').count(), 0, 'Y se quita sola');
  await p.evaluate(() => setIntroStyle('off'));
  assert.equal(await p.evaluate(() => appSettings.intro), 'off', 'Se puede desactivar en Ajustes');

  await p.evaluate(() => loadDemoData());
  await p.waitForFunction(() => matchHistory.length > 20);

  // Trayectoria del golpe al anotar un winner
  await p.evaluate(() => repeatMatch(0));
  await p.evaluate(() => { selectedSlot = 0; recordAction('W', 'Volea'); });
  assert(await p.isVisible('.court-arena .shot-trail'), 'Se dibuja la trayectoria del golpe');

  // Cierre del partido de retransmisión con la carta del mejor
  await p.evaluate(() => { for (let k = 0; k < 300 && !state.matchOver; k++) addNeutralPoint(0); });
  await p.waitForSelector('#match-end.cine', { state: 'visible' });
  assert(await p.locator('#match-end .me-mvp .pcard').count() === 1, 'Carta del mejor del partido en el cierre');

  // Póster con la foto del grupo
  await p.evaluate(() => { closeMatchEnd(); posterTargetState = state; openPosterModal(); });
  await p.setInputFiles('#poster-photo-tools input[type=file]', { name: 'grupo.png', mimeType: 'image/png', buffer: PNG });
  await p.waitForFunction(() => !!posterPhoto);
  assert(await p.isVisible('#poster-photo-adjust'), 'Con foto se puede ajustar el encuadre');
  await p.evaluate(() => { setPosterPhotoY(20); clearPosterPhoto(); closePosterModal(); });

  // Marcador gigante en horizontal
  await p.evaluate(() => { exitMatchScreen(); repeatMatch(0); });
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(200);
  assert(!(await p.isVisible('.court-arena')), 'En horizontal se esconde la pista');
  assert(await p.isVisible('.qp.a') && await p.isVisible('#scoreboard-box'), 'Marcador y botones de punto a la vista');
  const ptsSize = await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('t1-pts')).fontSize));
  assert(ptsSize > 60, `Cifras enormes (${ptsSize}px)`);

  // Modo tele del directo con aviso de bola de break
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.evaluate(() => { for (let k = 0; k < 80; k++) { addNeutralPoint(k % 5 === 0 ? 0 : 1); if (liveChance() && k > 8) break; } });
  const shown = await p.evaluate(() => { const d = livePayload(); d.on = true; d.lagMs = 0; document.body.classList.add('spectator-mode'); document.getElementById('view-spectator').classList.remove('hidden'); renderSpectator(d); return d.status.pair != null; });
  assert(shown, 'Hay una bola de break o de set');
  assert(await p.isVisible('.spx-match .spx-alert.on'), 'En la tele sale el aviso en grande');
};
