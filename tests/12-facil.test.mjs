// Empezar y terminar fácil: guía del primer partido, partido rápido, repetir, revancha, grupos, deshacer abajo,
// terminar sin guardar (con deshacer), mando, botón atrás, pista clara en modo claro y Acerca de
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  await p.goto(url);
  await p.evaluate(() => localStorage.removeItem('pm_guia_partido_v1'));

  // Partido rápido + guía la primera vez
  await p.evaluate(() => quickMatch());
  await p.waitForSelector('#match-guide .mg-tip', { state: 'visible' });
  assert((await p.textContent('#match-guide')).includes('Sumar un punto'), 'La guía sale en el primer partido');
  for (let i = 0; i < 4; i++) await p.click('#match-guide .btn-volt');
  assert(!(await p.isVisible('#match-guide')), 'La guía se cierra al terminar');
  assert.equal(await p.evaluate(() => localStorage.getItem('pm_guia_partido_v1')), '1', 'Y no vuelve a salir');
  assert.equal(await p.evaluate(() => state.players.every(x => x.isGeneric)), true, 'Partido rápido sin jugadores');

  // Deshacer abajo
  assert(await p.evaluate(() => document.getElementById('btn-undo').classList.contains('is-empty')), 'Deshacer apagado sin puntos');
  await p.click('.qp.a');
  assert(!(await p.evaluate(() => document.getElementById('btn-undo').classList.contains('is-empty'))), 'Deshacer se enciende');
  await p.click('#btn-undo');
  assert.equal(await p.evaluate(() => state.points.length), 0, 'Deshacer quita el punto');

  // Mando: flecha arriba = pareja 1, abajo = pareja 2, mantener = deshacer
  await p.keyboard.press('ArrowUp');
  await p.keyboard.press('ArrowDown');
  assert.deepEqual(await p.evaluate(() => state.points.map(x => x.w)), [0, 1], 'El mando suma a cada pareja');
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(800); await p.keyboard.up('ArrowUp');
  assert.equal(await p.evaluate(() => state.points.length), 1, 'Mantener pulsado deshace');
  assert.equal(await p.evaluate(() => window.__padelMando('b', 0)), 'true', 'La app de Android puede anotar');

  // Terminar sin guardar y deshacerlo
  await p.click('#btn-match-exit');
  assert((await p.textContent('body')).includes('Terminar sin guardar'), 'Salir ofrece terminar sin guardar');
  await p.click('.exit-options .exit-discard');
  assert.equal(await p.evaluate(() => state), null, 'Partido borrado');
  assert.equal(await p.evaluate(() => localStorage.getItem('pm_partido_activo_v14')), null, 'Sin partido en pausa');
  assert.equal(await p.evaluate(() => matchHistory.length), 0, 'No se guarda en el historial');
  await p.click('#toast-action');
  assert.equal(await p.evaluate(() => state && state.points.length), 2, 'Deshacer lo recupera');

  // Terminar y guardar → "No guardar este partido" en el cierre
  await p.evaluate(() => finishMatchManually());
  await p.waitForSelector('#match-end', { state: 'visible' });
  assert.equal(await p.evaluate(() => matchHistory.length), 1, 'Guardado');
  await p.click('#match-end .me-discard');
  assert.equal(await p.evaluate(() => matchHistory.length), 0, 'Se puede quitar desde el cierre');

  // Repetir el último partido, revancha y grupos (con datos de ejemplo)
  await p.evaluate(() => loadDemoData());
  await p.waitForFunction(() => matchHistory.length > 20);
  await p.evaluate(() => switchMainTab('home'));
  assert.equal(await p.locator('.home-quick-row').count(), 0, 'El inicio ya no tiene "Repetir" ni "Partido rápido"');
  const last = await p.evaluate(() => matchHistory[0].players.map(x => x.name));
  await p.evaluate(() => repeatMatch(0));
  assert.deepEqual(await p.evaluate(() => state.players.map(x => x.name)), last, 'Repite los mismos jugadores');
  await p.evaluate(() => finishMatchManually());
  await p.waitForSelector('#match-end', { state: 'visible' });
  const id1 = await p.evaluate(() => state.id);
  await p.click('#match-end button:has-text("Revancha")');
  assert(await p.evaluate(id => state && state.id !== id && !state.matchOver, id1), 'La revancha empieza otro partido');
  assert.deepEqual(await p.evaluate(() => state.players.map(x => x.name)), last, 'Con los mismos jugadores');
  assert(await p.evaluate(id => matchHistory.some(m => m.id === id), id1), 'Y el anterior queda guardado');
  // Con un partido en pausa, empezar otro pregunta antes
  await p.evaluate(() => exitMatchScreen());
  await p.evaluate(() => quickMatch());
  assert((await p.textContent('body')).includes('Tienes un partido en pausa'), 'Avisa del partido en pausa');
  await p.click('button:has-text("Continuar el partido en pausa")');
  assert.deepEqual(await p.evaluate(() => state.players.map(x => x.name)), last, 'Continúa el que estaba');
  await p.evaluate(() => discardCurrentMatch());

  await p.evaluate(() => { switchMainTab('setup'); setupConfig.slots = dbPlayers.slice(0, 4); renderSetupCourt(); });
  await p.click('button:has-text("Grupos")');
  await p.fill('#group-name', 'Martes');
  await p.click('button:has-text("Guardar los cuatro de la pista")');
  await p.evaluate(() => { closeEventModal(); clearSetupCourt(); });
  await p.click('button:has-text("Grupos")');
  await p.click('.group-main:has-text("Martes")');
  assert.deepEqual(await p.evaluate(() => setupConfig.slots), await p.evaluate(() => dbPlayers.slice(0, 4)), 'El grupo pone a los cuatro en la pista');
  await p.evaluate(() => openPlayerPicker(0));
  assert(await p.isVisible('.picker-group-label:has-text("Habituales")'), 'El selector muestra primero los habituales');
  await p.evaluate(() => closePlayerPicker());

  // Modo claro: la pista de Nuevo partido ya no es oscura
  await p.evaluate(() => setThemePref('light'));
  const bg = await p.evaluate(() => getComputedStyle(document.querySelector('.np-field')).backgroundColor);
  assert.equal(bg, 'rgb(227, 235, 245)', 'Pista clara en modo claro');
  await p.evaluate(() => setThemePref('dark'));

  // Acerca de: contacto y privacidad
  await p.evaluate(() => openAboutSheet());
  const mail = await p.getAttribute('a.menu-row:has-text("Enviar una sugerencia")', 'href');
  assert(mail.startsWith('mailto:juancbr9@gmail.com'), 'Contacto por correo');
  assert(await p.isVisible('a.menu-row:has-text("Política de privacidad")'), 'Enlace a la privacidad');
  const r = await p.request.get(new URL('privacidad.html', url).href);
  assert.equal(r.status(), 200, 'La página de privacidad existe');
  const r2 = await p.request.get(new URL('presentacion.html', url).href);
  assert.equal(r2.status(), 200, 'La página de presentación existe');
};
