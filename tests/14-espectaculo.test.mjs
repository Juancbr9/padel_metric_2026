// Efectos: animación de entrada del logo, trayectoria del golpe, cierre de retransmisión, póster con foto,
// marcador gigante en horizontal y modo tele del directo con avisos
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGNkYPjPgAGYcAkMHgEAJ+4BD4XyBTAAAAAASUVORK5CYII=', 'base64');
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  await p.goto(url);
  // Entrada del logo: aparece, no bloquea y se va sola
  assert(await p.evaluate(() => document.documentElement.classList.contains('intro-on')), 'La entrada forma parte del primer pintado');
  assert(await p.isVisible('#intro-splash .intro-logo'), 'Sale la animación de entrada (trazo y bote)');
  await p.waitForTimeout(3000);
  assert.equal(await p.locator('#intro-splash').count(), 0, 'Y se quita sola');
  await p.reload();
  assert.equal(await p.locator('#intro-splash').count(), 0, 'Solo una vez por sesión');
  assert((await p.evaluate(() => pmLoaderHTML('x'))).includes('pm-loader-ball'), 'Cargador con la pelota botando');

  await p.evaluate(() => loadDemoData());
  await p.waitForFunction(() => matchHistory.length > 20);

  // Sin trayectoria del golpe (se quitó)
  await p.evaluate(() => repeatMatch(0));
  await p.evaluate(() => { selectedSlot = 0; recordAction('W', 'Volea'); });
  assert.equal(await p.locator('.court-arena .shot-trail').count(), 0, 'Sin animación del golpe');

  // Cierre del partido de retransmisión con la carta del mejor
  await p.evaluate(() => { for (let k = 0; k < 300 && !state.matchOver; k++) addNeutralPoint(0); });
  await p.waitForSelector('#match-end.cine', { state: 'visible' });
  assert(await p.isVisible('#match-end .me-mvp'), 'El mejor del partido en el cierre, sin recuadros vacíos');

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
