// Inscripción con QR: el organizador abre la inscripción, dos jugadores se apuntan desde su móvil (uno cambia de
// nombre y otro se borra), la lista llega al evento y, al crearlo, el mismo enlace pasa a ser la clasificación en directo
export default async ({ newPage, url, assert, mockLive }) => {
  const org = await newPage();
  const store = await mockLive(org);
  await org.goto(url);
  await org.evaluate(() => { switchMainTab('americano'); startAmericanoDraft(); eventDraft.name = 'Americano del viernes'; });
  await org.evaluate(() => renderAmericanoView());
  await org.click('button:has-text("Inscripción con QR")');
  await org.waitForFunction(() => eventDraft.signup && document.querySelector('#su-box .su-count'));
  const code = await org.evaluate(() => eventDraft.signup.code);
  await org.waitForTimeout(400);
  assert.equal(store[code].data.kind, 'signup', 'Se publica la inscripción');
  assert.equal(store[code].data.name, 'Americano del viernes', 'Con el nombre del evento');

  // Cuatro jugadores se apuntan desde sus móviles
  const names = ['Lucía Gómez', 'Pablo Ruiz', 'Marta Díaz', 'Sergio Pérez'];
  const phones = [];
  for (const name of names) {
    const ph = await newPage({ viewport: { width: 360, height: 760 } });
    await mockLive(ph);
    await ph.goto(`${url}#directo=${code}`);
    await ph.waitForSelector('#spj-name');
    await ph.fill('#spj-name', name);
    await ph.click('#spj-send');
    await ph.waitForSelector('text=Estás apuntado como');
    phones.push(ph);
  }
  assert(await phones[0].evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'La página de inscripción cabe a 360 px');

  // Uno cambia su nombre y otro se borra
  await phones[1].click('button:has-text("Cambiar nombre")');
  await phones[1].fill('#spj-name', 'Pablo Ruiz Sanz');
  await phones[1].click('#spj-send');
  await phones[1].waitForSelector('text=Pablo Ruiz Sanz');
  await phones[3].click('button:has-text("Borrarme")');
  await phones[3].waitForSelector('#spj-name');

  // El organizador recibe la lista
  await org.waitForFunction(() => eventDraft.players.includes('Pablo Ruiz Sanz') && !eventDraft.players.includes('Sergio Pérez'), null, { timeout: 9000 });
  const players = await org.evaluate(() => eventDraft.players);
  assert.equal(players.join(','), 'Lucía Gómez,Pablo Ruiz Sanz,Marta Díaz', 'La lista del evento sigue a los apuntados');
  assert(await org.evaluate(() => dbPlayers.includes('Lucía Gómez')), 'Los apuntados quedan en la base de datos');

  // Quitar a uno desde la hoja del organizador
  await org.click('.su-row:has-text("Marta Díaz") button');
  assert.equal(await org.evaluate(() => eventDraft.players.includes('Marta Díaz')), false, 'El organizador puede quitar a un apuntado');
  await org.click('.su-row:has-text("Marta Díaz") button');
  assert(await org.evaluate(() => eventDraft.players.includes('Marta Díaz')), 'Y volver a añadirlo');

  // Se completa con un jugador más a mano y se crea el evento
  await org.evaluate(() => { closeEventModal(); eventDraft.players.push('Invitado Uno'); ensurePlayerInDB('Invitado Uno'); createAmericanoFromDraft(); });
  await org.waitForTimeout(1500);
  assert.equal(store[code].data.kind, 'ev', 'Al crear el evento, el enlace pasa a ser la clasificación en directo');
  await phones[0].waitForSelector('.spe-table', { timeout: 6000 });
  assert(await phones[0].isVisible('.spe-game'), 'Quien se apuntó ve ya la ronda en juego');

  // Con la inscripción cerrada nadie más puede apuntarse
  const late = await newPage();
  await mockLive(late);
  await late.goto(`${url}#directo=${code}`);
  await late.waitForSelector('.spe-table');
  assert.equal(await late.locator('#spj-name').count(), 0, 'Tras empezar ya no aparece el formulario');
};
