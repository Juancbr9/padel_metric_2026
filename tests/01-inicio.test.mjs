// Primera vez: bienvenida, inicio, menú ☰, cambio de sección, accesos directos (?ir=) y Escape
export default async ({ newPage, url, assert }) => {
  const p = await newPage({ seen: false });
  await p.goto(url);
  await p.waitForTimeout(600);
  assert(await p.isVisible('#wrapped'), 'La bienvenida se muestra la primera vez');
  await p.evaluate(() => closeWrapped());
  assert(!(await p.isVisible('#event-modal')), 'Quien entra por primera vez no ve las novedades');
  assert.equal(await p.evaluate(() => localStorage.getItem('pm_novedades_v1')), String(await p.evaluate(() => APP_VERSION)), 'Las novedades quedan marcadas como vistas');

  for (const tab of ['setup', 'tournaments', 'americano', 'ranking', 'history', 'home']) {
    await p.click('#main-nav');
    await p.waitForTimeout(150);
    assert(await p.isVisible('#app-menu'), 'El menú ☰ se abre');
    await p.click(`#menu-${tab}`);
    await p.waitForTimeout(150);
    assert(await p.isVisible(`#${await p.evaluate(t => SECTIONS[t].view, tab)}`), `Se ve la sección ${tab}`);
    assert(!(await p.isVisible('#app-menu')), 'El menú se cierra al elegir');
  }

  // Escape cierra el menú (ordenador)
  await p.click('#main-nav');
  await p.keyboard.press('Escape');
  assert(!(await p.isVisible('#app-menu')), 'Escape cierra el menú');

  // Acceso directo del icono de la app
  await p.goto(url + '?ir=ranking');
  await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => currentTab), 'ranking', 'El acceso directo abre el ranking');
  assert(!(await p.evaluate(() => location.search)), 'La dirección queda limpia');

  // Manifest: accesos directos e iconos existen
  const manifest = await (await p.request.get(url + 'manifest.json')).json();
  assert(manifest.shortcuts.length === 4, 'El manifest tiene 4 accesos directos');
  for (const sc of manifest.shortcuts) {
    const tab = new URL(sc.url, url).searchParams.get('ir');
    assert(await p.evaluate(t => !!SECTIONS[t], tab), `El acceso directo ${sc.name} apunta a una sección`);
    assert((await p.request.get(url + sc.icons[0].src)).ok(), `Existe el icono ${sc.icons[0].src}`);
  }
  for (const s of manifest.screenshots) assert((await p.request.get(url + s.src)).ok(), `Existe la captura ${s.src}`);
};
