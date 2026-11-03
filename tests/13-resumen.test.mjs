// Resumen del partido: estadísticas al estilo del circuito profesional, crónica con IA (servidor simulado),
// límite de 3 al mes con aviso de la versión Pro, y jugadores por su nombre de pila
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  let calls = 0, lastBody = null;
  await p.route('**/functions/v1/resumen-partido', r => {
    calls++;
    lastBody = r.request().postDataJSON();
    if (calls > 1) return r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'límite', restantes: 0 }) });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ texto: 'Carlos y Javier ganan en tres sets\n\nPrimer párrafo.\n\nSegundo párrafo.', restantes: 2 }) });
  });
  await p.goto(url);
  await p.evaluate(() => loadDemoData());
  await p.waitForFunction(() => matchHistory.length > 20);
  assert(await p.evaluate(() => !dbPlayers.some(n => /Coello|Tapia|Galán|Lebrón/.test(n))), 'Los datos de ejemplo no usan jugadores reales');

  // Nombres de pila (con inicial si se repite)
  assert.equal(await p.evaluate(() => shortPlayerName('Carlos Martín', ['Carlos Martín', 'Javier López'])), 'Carlos', 'Nombre de pila');
  assert.equal(await p.evaluate(() => shortPlayerName('Carlos Martín', ['Carlos Martín', 'Carlos Gil'])), 'Carlos M.', 'Inicial si hay dos iguales');
  await p.evaluate(() => repeatMatch(0));
  const label = await p.textContent('#t1-label');
  const first = await p.evaluate(() => state.players[0].name.split(' ')[0]);
  assert(label.toUpperCase().includes(first.toUpperCase()), 'El marcador muestra el nombre de pila');
  await p.evaluate(() => discardCurrentMatch());

  // Hoja del resumen con estadísticas y crónica
  await p.evaluate(() => openHistoryActions(0));
  await p.click('.menu-row:has-text("Resumen del partido")');
  assert(await p.isVisible('.ai-stats .h2h-metric'), 'Estadísticas al estilo profesional');
  assert((await p.textContent('.ai-stats')).includes('Puntos ganados con el 1.er saque'), 'Con el primer saque');
  await p.click('#ai-go');
  await p.waitForSelector('.ai-text');
  assert((await p.textContent('.ai-text h3')).includes('Carlos y Javier'), 'Se muestra la crónica');
  assert(lastBody.match && lastBody.match.jugadores[0].nombre_corto, 'Se envía el nombre corto de cada jugador');
  assert(/^[a-z0-9]{16,64}$/.test(lastBody.device), 'Con un identificador del dispositivo');
  assert(await p.evaluate(() => !!matchHistory[0].aiSummary), 'La crónica se guarda en el partido');
  assert((await p.evaluate(() => matchSummaryText(matchHistory[0]))).includes('Puntos ganados'), 'El texto para compartir lleva las estadísticas');

  // Cuarta crónica del mes: aviso de la versión Pro
  await p.evaluate(() => { closeEventModal(); openMatchSummary('history', 1); });
  await p.click('#ai-go');
  await p.waitForSelector('.ai-error');
  assert((await p.textContent('.ai-error')).includes('versión Pro'), 'Al pasar del límite se ofrece la versión Pro');
};
