// Diseño: sin desbordes a 360 px en modo oscuro y claro, fondo OLED, un solo acento y cifras tabulares
export default async ({ newPage, url, assert }) => {
  const p = await newPage({ viewport: { width: 360, height: 760 } });
  await p.goto(url);
  await p.evaluate(() => loadDemoData());
  await p.waitForTimeout(800);
  const style = await p.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, num: getComputedStyle(document.body).fontVariantNumeric }));
  assert.equal(style.bg, 'rgb(3, 5, 8)', 'Fondo OLED');
  assert(style.num.includes('tabular-nums'), 'Cifras tabulares');
  for (const light of [false, true]) {
    if (light) await p.evaluate(() => toggleThemeMode());
    for (const tab of ['home', 'setup', 'tournaments', 'americano', 'ranking', 'history']) {
      await p.evaluate(t => switchMainTab(t), tab);
      await p.waitForTimeout(120);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(over <= 0, `Sin desborde horizontal en ${tab}${light ? ' (claro)' : ''}: ${over} px`);
      const volt = await p.evaluate(() => getComputedStyle(document.body).getPropertyValue('--volt').trim().toUpperCase());
      assert.equal(volt, light ? '#4D7C0F' : '#D4FF2A', `Acento único en ${tab}`);
    }
  }
  // index.html sin style="..." fijos (solo valores que se calculan, como el ancho inicial de las barras)
  const html = await (await p.request.get(url + 'index.html')).text();
  const inline = [...html.matchAll(/style="([^"]*)"/g)].map(m => m[1]).filter(v => !/^width:\s*50%;?$/.test(v));
  assert.equal(inline.length, 0, `Sin estilos en línea fijos en index.html (${inline.join(' | ')})`);
};
