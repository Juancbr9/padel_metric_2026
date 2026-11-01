// Datos: borrar con deshacer, copia de seguridad, aviso de copia, novedades tras actualizar y restaurar de fábrica
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  await p.goto(url);
  await p.evaluate(() => loadDemoData());
  await p.waitForTimeout(800);
  const total = await p.evaluate(() => matchHistory.length);
  const firstId = await p.evaluate(() => matchHistory[0].id);

  // Aviso de copia de seguridad en el inicio
  await p.evaluate(() => switchMainTab('home'));
  assert(await p.isVisible('text=Haz una copia de seguridad'), 'El inicio avisa de que no hay copia');

  // Borrar y deshacer
  await p.evaluate(() => { switchMainTab('history'); deleteHistoryMatch(0); });
  assert.equal(await p.evaluate(() => matchHistory.length), total - 1, 'Se borra al momento');
  assert(await p.isVisible('#toast-action'), 'El aviso ofrece deshacer');
  await p.click('#toast-action');
  assert.equal(await p.evaluate(() => matchHistory.length), total, 'Deshacer lo recupera');
  assert.equal(await p.evaluate(() => matchHistory[0].id), firstId, 'En el mismo sitio');
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('pm_historial_v5')).length), total, 'Y queda guardado');

  // Copia de seguridad (en el ordenador se descarga)
  const [download] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportBackupJSON())]);
  assert(/^PadelMetric_copia_\d{4}-\d\d-\d\d\.json$/.test(download.suggestedFilename()), 'Nombre de la copia con fecha');
  const backup = JSON.parse(await (await import('node:fs')).promises.readFile(await download.path(), 'utf8'));
  assert.equal(backup.matchHistory.length, total, 'La copia lleva todos los partidos');
  await p.evaluate(() => switchMainTab('home'));
  assert(!(await p.isVisible('text=Haz una copia de seguridad')), 'Tras la copia desaparece el aviso');

  // Novedades: a quien ya tenía datos de una versión anterior se le muestran una vez
  await p.evaluate(() => localStorage.removeItem('pm_novedades_v1'));
  await p.reload();
  await p.waitForTimeout(1200);
  assert(await p.isVisible('.news-list'), 'Tras actualizar se ven las novedades');
  await p.click('#event-modal button:has-text("Entendido")');
  await p.reload();
  await p.waitForTimeout(1200);
  assert(!(await p.isVisible('.news-list')), 'Solo una vez');

  // Restaurar desde la copia y restaurar de fábrica
  await p.evaluate(data => { applyBackupData(data); }, backup);
  assert.equal(await p.evaluate(() => matchHistory.length), total, 'Restaurar la copia');
  await p.evaluate(() => factoryReset());
  await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('pm_') && !['pm_bienvenida_v1', 'pm_novedades_v1'].includes(k)).length), 0, 'Restaurar de fábrica borra los datos');
};
