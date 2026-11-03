// Botón atrás del móvil en el navegador y en la app instalada desde la web
export default async ({ newPage, url, assert }) => {
  const p = await newPage();
  await p.goto('about:blank');
  await p.goto(url);
  await p.waitForTimeout(400);
  // Menú abierto → atrás lo cierra sin salir de la app
  await p.click('#main-nav');
  assert(await p.isVisible('#app-menu'), 'Menú abierto');
  await p.goBack();
  await p.waitForTimeout(300);
  assert(!(await p.isVisible('#app-menu')), 'Atrás cierra el menú');
  assert(p.url().startsWith(url), 'Y sigue en la app');
  // Sección distinta de inicio → atrás vuelve al inicio
  await p.click('#main-nav');
  await p.click('#menu-ranking');
  await p.waitForTimeout(200);
  await p.mouse.click(5, 300);
  await p.goBack();
  await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => currentTab), 'home', 'Atrás vuelve al inicio');
  // Varias secciones → atrás vuelve a la anterior, y luego al inicio
  for (const id of ['#menu-ranking', '#menu-history']) { await p.click('#main-nav'); await p.click(id); await p.waitForTimeout(150); }
  await p.mouse.click(5, 300); await p.goBack(); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => currentTab), 'ranking', 'Atrás vuelve a la sección anterior');
  await p.mouse.click(5, 300); await p.goBack(); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => currentTab), 'home', 'Y después al inicio');
  // Durante el partido, atrás abre "Salir del partido"
  await p.evaluate(() => quickMatch());
  await p.click('.serve-text'); await p.goBack();
  await p.waitForFunction(() => document.body.textContent.includes('Salir del partido'), null, { timeout: 3000 }).catch(() => {});
  assert((await p.textContent('body')).includes('Salir del partido'), 'En el partido, atrás abre Salir del partido');
  await p.click('button:has-text("Pausar y seguir más tarde")');
  await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => currentTab), 'home', 'Pausar vuelve al inicio');
  // En el inicio sin nada abierto → atrás sale
  await p.mouse.click(5, 300);
  await p.goBack();
  await p.waitForTimeout(500);
  assert.equal(p.url(), 'about:blank', 'En el inicio, atrás sale de la app');
};
