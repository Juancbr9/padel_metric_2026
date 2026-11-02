// Tema (oscuro, claro y automático), nuevo partido sin portada y con las reglas a la vista,
// carta personalizable (color de pista y pala) y "¿Quién eres?"
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  await p.goto(url);
  // Tema
  await p.evaluate(() => openSettingsSheet());
  await p.click('#theme-seg [data-theme="light"]');
  assert(await p.evaluate(() => document.body.classList.contains('light-mode')), 'Tema claro');
  assert.equal(await p.getAttribute('meta[name="theme-color"]', 'content'), '#F4F6F8', 'La barra del navegador sigue al tema');
  assert.equal(await p.evaluate(() => localStorage.getItem('pm_theme_light')), '1', 'Se guarda con la misma clave de siempre');
  await p.click('#theme-seg [data-theme="auto"]');
  assert.equal(await p.evaluate(() => localStorage.getItem('pm_theme_light')), 'auto', 'Automático');
  await p.emulateMedia({ colorScheme: 'light' });
  await p.waitForTimeout(100);
  assert(await p.evaluate(() => document.body.classList.contains('light-mode')), 'En automático sigue al móvil (claro)');
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.waitForTimeout(100);
  assert(!(await p.evaluate(() => document.body.classList.contains('light-mode'))), 'En automático sigue al móvil (oscuro)');
  await p.click('#theme-seg [data-theme="dark"]');
  await p.evaluate(() => closeEventModal());

  // Nuevo partido: sin portada y con las reglas a la vista
  await p.evaluate(() => { localStorage.setItem('pm_custom_cover', 'data:image/jpeg;base64,AAAA'); });
  await p.reload();
  assert.equal(await p.evaluate(() => localStorage.getItem('pm_custom_cover')), null, 'La portada antigua se borra para liberar espacio');
  await p.evaluate(() => switchMainTab('setup'));
  assert.equal(await p.locator('#hero-card-box, #cover-upload').count(), 0, 'Ya no hay portada');
  await p.click('#setup-rules button:has-text("Punto de oro")');
  assert.equal(await p.evaluate(() => setupConfig.deuceRule), 'golden', 'La regla se elige en la propia pantalla');
  await p.click('#setup-rules button:has-text("Súper tie-break")');
  assert.equal(await p.evaluate(() => setupConfig.thirdSetRule), 'supertb', 'Y el tercer set');

  // Carta personalizable
  await p.evaluate(() => loadDemoData());
  await p.waitForTimeout(800);
  const name = await p.evaluate(() => dbPlayers[0]);
  await p.evaluate(n => { openPlayerProfile(n); setProfileTab('card'); }, name);
  assert(!(await p.locator('.pcard-ovr, .pcard-shine').count()), 'La carta nueva no es la del FIFA');
  await p.click('.pc-swatch[aria-label="Verde"]');
  assert.equal(await p.evaluate(n => ensureProfile(n).cardColor, name), 'verde', 'Se guarda el color de la pista');
  assert((await p.getAttribute('.pcard-stage .pcard', 'style')).includes('#1D6646'), 'La carta usa ese color');
  await p.evaluate(n => { closePlayerProfile(); openEditProfileModal(n); }, name);
  await p.fill('#edit-racket', 'Mi pala 2026');
  await p.click('#player-edit-modal .btn-volt');
  assert.equal(await p.evaluate(n => ensureProfile(n).racket, name), 'Mi pala 2026', 'La pala se guarda en la ficha');
  assert.equal(await p.evaluate(n => ensureProfile(n).cardColor, name), 'verde', 'Editar la ficha conserva el color');
  await p.evaluate(n => { openPlayerProfile(n); setProfileTab('card'); }, name);
  assert((await p.textContent('.pcard-stage .pcard-foot')).includes('Mi pala 2026'), 'La pala sale en la carta');
  const colors = await p.evaluate(() => new Set(dbPlayers.slice(0, 12).map(n => cardCourtOf(n, {})[0])).size);
  assert(colors >= 3, 'Sin elegir, cada jugador tiene un color según su nombre');

  // ¿Quién eres?
  // (el aviso de copia de seguridad va antes; aquí se da por hecha)
  await p.evaluate(() => { appSettings.lastBackupAt = Date.now(); appSettings.lastBackupCount = matchHistory.length; closePlayerProfile(); switchMainTab('home'); });
  assert(await p.isVisible('text=¿Quién eres?'), 'El inicio propone elegir quién eres');
  await p.click('.home-install-main:has-text("¿Quién eres?")');
  await p.fill('#me-search', name.split(' ')[0]);
  await p.click(`#me-list .me-row:has-text("${name}")`);
  assert.equal(await p.evaluate(() => myPlayerName), name, 'Queda elegido el perfil propio');
  assert(await p.isVisible('.home-me'), 'Y el inicio muestra su carta');
  await p.evaluate(() => switchMainTab('ranking'));
  assert(await p.isVisible('.rk-player-row.is-me .me-tag'), 'El ranking le marca como "Tú"');
};
