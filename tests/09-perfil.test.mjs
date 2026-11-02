// Perfil público de un jugador: se comparte desde su ficha y se abre en otro móvil sin datos
export default async ({ newPage, url, assert }) => {
  const a = await newPage();
  await a.goto(url);
  await a.evaluate(() => loadDemoData());
  await a.waitForTimeout(800);
  const name = await a.evaluate(() => Object.values(computeAllPlayersStats().statsMap).filter(s => s.PJ > 0).sort((x, y) => y.elo - x.elo)[0].name);
  const expected = await a.evaluate(n => { const st = computeAllPlayersStats().statsMap[n]; return { elo: st.elo, PJ: st.PJ, V: st.V, ovr: computePlayerCard(n).overall }; }, name);
  // Personaliza su carta: color de pista y pala
  await a.evaluate(n => { const pr = ensureProfile(n); pr.cardColor = 'terracota'; pr.racket = 'Pala de prueba'; saveDB(); }, name);
  await a.evaluate(n => { switchMainTab('ranking'); openPlayerProfile(n); }, name);
  await a.click('#prof-body button:has-text("Compartir perfil")');
  await a.waitForFunction(() => shareSheetLink && shareSheetLink.includes('#jugador='));
  const link = await a.evaluate(() => shareSheetLink);
  assert(link.length < 1000, `El enlace es corto (${link.length} caracteres)`);

  const b = await newPage({ viewport: { width: 360, height: 760 } });
  await b.goto(url + link.slice(link.indexOf('#')));
  await b.waitForSelector('.sp-name');
  assert.equal(await b.textContent('.sp-name'), name, 'Se ve el nombre');
  assert((await b.textContent('.sp-meta')).includes(`ELO ${expected.elo}`), 'Y su ELO');
  assert.equal(await b.textContent('.pcard-nums div:first-child strong'), String(expected.ovr), 'La carta tiene su media');
  assert((await b.getAttribute('.pcard', 'style')).includes('#9A4A2F'), 'La carta conserva el color de pista elegido');
  assert((await b.textContent('.pcard-foot')).includes('Pala de prueba'), 'Y la pala');
  assert((await b.textContent('.sm-facts')).includes(String(expected.PJ)), 'Partidos jugados');
  assert(await b.isVisible('.sp-chart'), 'Gráfico de evolución del ELO');
  assert(await b.isVisible('text=Mejor compañero'), 'Mejor compañero');
  assert(await b.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'El perfil cabe a 360 px');
  assert.equal(await b.evaluate(() => dbPlayers.length), 0, 'Ver un perfil no añade nada a la base de datos');
  assert(!(await b.isVisible('#wrapped')), 'No aparece la bienvenida');

  const c = await newPage();
  await c.goto(url + '#jugador=zAAAAAAAAAAA');
  await c.waitForTimeout(500);
  assert(/no es válido/.test(await c.textContent('#view-spectator')), 'Un enlace roto avisa sin romper la app');
};
