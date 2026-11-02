// Temporada en historias: selector de temporada, comparación con el año anterior, "tu"/"su",
// pantallas nuevas (mes a mes, mejor partido, títulos) e imagen vertical para compartir
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  await p.goto(url);
  await p.evaluate(() => loadDemoData());
  await p.waitForFunction(() => matchHistory.length > 20);
  // Pasa los 5 partidos más antiguos del primer jugador al año anterior
  const name = await p.evaluate(() => {
    const n = dbPlayers[0];
    const year = new Date().getFullYear();
    const mine = matchHistory.filter(m => m.players.some(x => x.name === n));
    mine.slice(-5).forEach((m, i) => { m.id = new Date(year - 1, 9, 10 + i).getTime(); });
    matchHistory.sort((a, b) => b.id - a.id);
    saveDB();
    chooseMe(n);
    return n;
  });
  const year = new Date().getFullYear();

  await p.evaluate(n => openWrapped(n), name);
  assert(await p.isVisible('#wrapped'), 'Se abren las historias');
  const seasons = await p.locator('#wrapped .w-season').allTextContents();
  assert.deepEqual(seasons, [String(year), String(year - 1), 'Todo'], 'Se puede elegir la temporada');
  const cls = await p.evaluate(() => wrapState.slides.map(s => s.cls));
  for (const c of ['w-matches', 'w-elo', 'w-best', 'w-prev', 'w-final']) assert(cls.includes(c), `Pantalla ${c}`);
  assert((await p.textContent('#wrapped .w-slide')).includes('Tu temporada'), 'En el perfil propio habla de "tu"');

  // ELO de la temporada: empieza donde acabó la anterior
  const elo = await p.evaluate(n => {
    const a = computeWrapped(n, String(new Date().getFullYear() - 1));
    const b = computeWrapped(n, String(new Date().getFullYear()));
    const all = computeWrapped(n, 'all');
    return { aEnd: a.eloEnd, bStart: b.eloStart, bEnd: b.eloEnd, allEnd: all.eloEnd, cur: computeAllPlayersStats().statsMap[n].elo, aPJ: a.PJ, allPJ: all.PJ, bPJ: b.PJ };
  }, name);
  assert.equal(elo.aEnd, elo.bStart, 'El ELO de una temporada empieza donde terminó la anterior');
  assert.equal(elo.bEnd, elo.cur, 'Y la actual termina en el ELO de hoy');
  assert.equal(elo.aPJ + elo.bPJ, elo.allPJ, 'Las temporadas suman toda la historia');

  // Cambiar de temporada desde la portada
  await p.click(`#wrapped .w-season:has-text("${year - 1}")`);
  assert((await p.textContent('#wrapped .w-kicker')).includes(`Temporada ${year - 1}`), 'Cambia a la temporada anterior');

  // Navegación: flechas y deslizar hacia abajo para cerrar
  await p.keyboard.press('ArrowRight');
  assert.equal(await p.evaluate(() => wrapState.i), 1, 'La flecha derecha avanza');
  await p.keyboard.press('ArrowLeft');
  assert.equal(await p.evaluate(() => wrapState.i), 0, 'La flecha izquierda vuelve');
  await p.mouse.move(200, 300); await p.mouse.down(); await p.mouse.move(200, 520, { steps: 4 }); await p.mouse.up();
  assert(!(await p.isVisible('#wrapped')), 'Deslizar hacia abajo cierra');

  // Imagen para historias (1080 × 1920) y vuelta al tamaño normal para el resto
  await p.evaluate(n => openWrapped(n), name);
  await p.evaluate(() => wrapGo(wrapState.slides.length - 1));
  await p.click('#wrapped button:has-text("Compartir el resumen")');
  assert(await p.isVisible('#poster-modal'), 'Se abre la imagen del resumen');
  assert.deepEqual(await p.evaluate(() => { const c = document.getElementById('poster-canvas'); return [c.width, c.height]; }), [1080, 1920], 'Formato vertical de historia');
  await p.evaluate(n => { closePosterModal(); sharePlayerCard(n); }, name);
  await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.getElementById('poster-canvas').height), 1350, 'La carta vuelve a 1080 × 1350');
  await p.evaluate(() => closePosterModal());

  // Otro jugador: habla de "su"
  const other = await p.evaluate(() => dbPlayers.find(n => n !== myPlayerName && computeWrapped(n).PJ));
  await p.evaluate(n => openWrapped(n), other);
  const intro = await p.textContent('#wrapped .w-slide');
  assert(intro.includes(`de ${other}`) && !intro.includes('Tu temporada'), 'En otro jugador habla de "su"');
  assert((await p.evaluate(() => wrapState.slides.map(s => s.html).join(' '))).includes('Su nivel'), 'Y "Su nivel"');
};
