// App sencilla para los clientes: sin opciones repetidas, sin textos de relleno y sin herramientas del dueño a la vista
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  await p.goto(url);
  await p.evaluate(() => quickMatch());
  await p.evaluate(() => openMatchOptions());
  const opts = await p.textContent('#event-modal');
  for (const t of ['Narrador', 'Mando', 'Cronómetro', 'Guía']) assert(!opts.includes(t), `Opciones sin "${t}" (está en Ajustes o en la primera vez)`);
  for (const t of ['Tercer set', 'Posición en la pista', 'Saque', 'Finalizar partido']) assert(opts.includes(t), `Opciones con "${t}"`);
  await p.evaluate(() => { closeEventModal(); discardCurrentMatch(); });

  await p.evaluate(() => openSettingsSheet());
  assert(!(await p.textContent('#event-modal')).includes('Código de pruebas'), 'El código de pruebas no se ve en Ajustes');
  await p.evaluate(() => closeEventModal());
  await p.evaluate(() => { for (let i = 0; i < 5; i++) versionTap(); });
  assert((await p.textContent('#event-modal')).includes('Código de pruebas'), 'Cinco toques en la versión lo abren');
  await p.evaluate(() => closeEventModal());

  await p.evaluate(() => openDataSheet());
  const data = await p.textContent('#event-modal');
  assert(!data.includes('datos de ejemplo') && !data.includes('Vaciar'), 'Datos sin herramientas de prueba');
  assert(data.includes('Borrar todos los datos'), 'Se pueden borrar los datos');
  await p.evaluate(() => closeEventModal());

  await p.evaluate(() => openSyncPanel());
  assert(!(await p.textContent('#event-modal')).includes('Supabase'), 'El club no habla de Supabase');
  await p.evaluate(() => closeEventModal());

  // Bienvenida en dos pantallas
  const q = await newPage({ seen: false });
  await q.goto(url);
  await q.waitForSelector('#wrapped:not(.hidden)');
  assert.equal(await q.locator('#wrapped .w-final').count() + await q.locator('#wrapped .w-intro').count() >= 1, true);
  assert.equal(await q.evaluate(() => wrapState && wrapState.slides.length), 2, 'Bienvenida de dos pantallas');
};
