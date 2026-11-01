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
  // En el inicio sin nada abierto → atrás sale
  await p.mouse.click(5, 300);
  await p.goBack();
  await p.waitForTimeout(500);
  assert.equal(p.url(), 'about:blank', 'En el inicio, atrás sale de la app');
};
