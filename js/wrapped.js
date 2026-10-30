// ==========================================================
// RESUMEN DE TEMPORADA EN FORMATO HISTORIAS
// Pantallas a pantalla completa que avanzan solas (toca a la derecha para seguir, a la izquierda para volver
// y mantén pulsado para pausar). Usa los partidos del año en curso o, si hay pocos, todos.
// ==========================================================
const WRAP_SLIDE_MS = 5500;
let wrapState = null;

function seasonMatchesOf(name) {
  const year = new Date().getFullYear();
  const all = matchHistory.filter(m => m && m.players && m.players.some(p => p.name === name));
  const season = all.filter(m => m.id && new Date(m.id).getFullYear() === year);
  return season.length >= 3 ? { matches: season, label: `Temporada ${year}` } : { matches: all, label: 'Tu historia' };
}

function computeWrapped(name) {
  const { matches, label } = seasonMatchesOf(name);
  const { statsMap } = computeAllPlayersStats();
  const st = statsMap[name] || emptyPlayerStats(name);
  const w = { name, label, PJ: 0, V: 0, sec: 0, partners: {}, rivals: {}, shots: {}, zones: { R: 0, T: 0, F: 0 }, clutch: [0, 0], streak: 0, best: 0, badges: {}, comeback: null, W: 0, ENF: 0 };
  [...matches].reverse().forEach(m => {
    const idx = m.players.findIndex(p => p.name === name);
    const pair = idx < 2 ? 0 : 1;
    const p = m.players[idx];
    const won = m.winnerPair === pair;
    w.PJ++; if (won) w.V++;
    w.sec += m.elapsedSec || 0;
    w.W += p.W || 0; w.ENF += p.ENF || 0;
    w.streak = won ? w.streak + 1 : 0; w.best = Math.max(w.best, w.streak);
    const partner = m.players[pair * 2 + (idx % 2 ? 0 : 1)].name;
    w.partners[partner] = w.partners[partner] || { name: partner, pj: 0, v: 0 };
    w.partners[partner].pj++; if (won) w.partners[partner].v++;
    const rk = [m.players[(1 - pair) * 2].name, m.players[(1 - pair) * 2 + 1].name].join(' / ');
    w.rivals[rk] = w.rivals[rk] || { name: rk, pj: 0, v: 0 };
    w.rivals[rk].pj++; if (won) w.rivals[rk].v++;
    (m.points || []).forEach(pt => {
      if (pt.n === name && pt.t === 'W') {
        if (pt.sh && pt.sh !== 'Winner') w.shots[pt.sh] = (w.shots[pt.sh] || 0) + 1;
        if (pt.z) w.zones[pt.z]++;
      }
      if (pt.bp || pt.gp || pt.tb) { w.clutch[1]++; if (pt.w === pair) w.clutch[0]++; }
    });
    badgesForPlayerInMatch(m, idx).forEach(k => { w.badges[k] = (w.badges[k] || 0) + 1; });
    // Mayor remontada: partido ganado en el que su probabilidad de victoria llegó a ser la más baja
    const series = wpSeries(m);
    if (won && series) {
      const low = Math.min(...series.map(s => (pair === 0 ? s.wp : 1 - s.wp)));
      if (!w.comeback || low < w.comeback.low) w.comeback = { low, m, pair };
    }
  });
  const hist = st.eloHistory || [ELO_START];
  w.eloStart = hist[Math.max(0, hist.length - 1 - w.PJ)];
  w.eloEnd = st.elo;
  w.eloPeak = Math.max(...hist.slice(Math.max(0, hist.length - 1 - w.PJ)));
  w.eloSeries = hist.slice(Math.max(0, hist.length - 1 - w.PJ));
  w.bestPartner = Object.values(w.partners).sort((a, b) => b.v - a.v || (b.v / b.pj) - (a.v / a.pj))[0];
  w.toughRival = Object.values(w.rivals).filter(r => r.pj > r.v).sort((a, b) => (b.pj - b.v) - (a.pj - a.v))[0];
  w.topShot = Object.entries(w.shots).sort((a, b) => b[1] - a[1])[0];
  w.topZone = Object.entries(w.zones).sort((a, b) => b[1] - a[1])[0];
  w.card = computePlayerCard(name, statsMap);
  return w;
}

function wrapSlides(w) {
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const hours = w.sec / 3600;
  const first = w.name.split(' ')[0];
  const slides = [];
  slides.push({ cls: 'w-intro', html: `
    <svg class="w-logo"><use href="#logo-mark"/></svg>
    <div class="w-kicker">${escapeHtml(w.label)}</div>
    <div class="w-huge">${escapeHtml(first)}</div>
    <div class="w-sub">Esto es lo que ha dado de sí tu pádel. Toca para avanzar.</div>` });
  slides.push({ cls: 'w-matches', html: `
    <div class="w-kicker">En la pista</div>
    <div class="w-big"><b data-count="${w.PJ}">0</b></div>
    <div class="w-sub">partidos jugados</div>
    <div class="w-row">
      <div><b data-count="${w.V}">0</b><span>victorias</span></div>
      <div><b data-count="${pct(w.V, w.PJ)}" data-suffix=" %">0</b><span>de acierto</span></div>
      <div><b data-count="${hours >= 1 ? hours.toFixed(1) : Math.round(hours * 60)}" ${hours >= 1 ? 'data-dec="1" data-suffix=" h"' : 'data-suffix=" min"'}>0</b><span>en pista</span></div>
    </div>` });
  const diff = w.eloEnd - w.eloStart;
  const es = w.eloSeries, min = Math.min(...es), max = Math.max(...es), span = Math.max(20, max - min);
  const line = es.map((v, i) => `${i ? 'L' : 'M'}${(es.length > 1 ? i / (es.length - 1) : 0) * 300} ${(110 - ((v - min) / span) * 100).toFixed(1)}`).join('');
  slides.push({ cls: 'w-elo', html: `
    <div class="w-kicker">Tu nivel</div>
    <div class="w-big">${w.eloEnd}</div>
    <div class="w-sub">puntos ELO · ${diff >= 0 ? `${diff} más` : `${-diff} menos`} que al empezar (${w.eloStart})</div>
    ${es.length > 1 ? `<svg class="w-chart" viewBox="0 0 300 120"><path d="${line}" pathLength="1"/></svg>` : ''}
    <div class="w-foot">Máximo alcanzado: <b>${w.eloPeak}</b></div>` });
  if (w.bestPartner) slides.push({ cls: 'w-partner', html: `
    <div class="w-kicker">Tu mejor pareja</div>
    <div class="w-avatar">${renderAvatarHTML(w.bestPartner.name, '', '', false)}</div>
    <div class="w-name">${escapeHtml(w.bestPartner.name)}</div>
    <div class="w-sub">${w.bestPartner.v} victoria${w.bestPartner.v === 1 ? '' : 's'} en ${w.bestPartner.pj} partido${w.bestPartner.pj === 1 ? '' : 's'} juntos</div>` });
  if (w.toughRival) slides.push({ cls: 'w-rival', html: `
    <div class="w-kicker">Tu rival más duro</div>
    <div class="w-name">${escapeHtml(w.toughRival.name)}</div>
    <div class="w-sub">${w.toughRival.pj - w.toughRival.v} derrota${w.toughRival.pj - w.toughRival.v === 1 ? '' : 's'} en ${w.toughRival.pj} enfrentamiento${w.toughRival.pj === 1 ? '' : 's'}. La próxima es la tuya.</div>` });
  if (w.topShot || w.W) slides.push({ cls: 'w-shot', html: `
    <div class="w-kicker">Tu golpe</div>
    <div class="w-name">${w.topShot ? escapeHtml(w.topShot[0].replace('/', ' / ')) : 'Winners'}</div>
    <div class="w-sub">${w.topShot ? `${w.topShot[1]} puntos ganados con este golpe` : ''}${w.topZone && w.topZone[1] ? ` · tu zona fuerte: ${ZONE_NAMES[w.topZone[0]].toLowerCase()}` : ''}</div>
    <div class="w-row"><div><b data-count="${w.W}">0</b><span>winners</span></div><div><b data-count="${w.ENF}">0</b><span>errores NF</span></div><div><b>${w.ENF ? (w.W / w.ENF).toFixed(2).replace('.', ',') : '–'}</b><span>winners por error</span></div></div>` });
  if (w.clutch[1]) slides.push({ cls: 'w-clutch', html: `
    <div class="w-kicker">Bajo presión</div>
    <div class="w-big"><b data-count="${pct(w.clutch[0], w.clutch[1])}" data-suffix=" %">0</b></div>
    <div class="w-sub">de los puntos decisivos ganados (bolas de break, puntos de oro y tie-breaks): ${w.clutch[0]} de ${w.clutch[1]}</div>` });
  if (w.comeback && w.comeback.low < 0.4) {
    const m = w.comeback.m, pr = w.comeback.pair;
    slides.push({ cls: 'w-comeback', html: `
      <div class="w-kicker">Tu mejor remontada</div>
      <div class="w-big">${Math.round(w.comeback.low * 100)} %</div>
      <div class="w-sub">era tu probabilidad de ganar en el peor momento contra ${escapeHtml(pairLabel([m.players[(1 - pr) * 2].name, m.players[(1 - pr) * 2 + 1].name]))}, y ganaste ${m.sets.filter(s => s[0] + s[1]).map(s => `${s[pr]}-${s[1 - pr]}`).join(' ')}.</div>` });
  }
  slides.push({ cls: 'w-streak', html: `
    <div class="w-kicker">Racha</div>
    <div class="w-big"><b data-count="${w.best}">0</b></div>
    <div class="w-sub">victorias seguidas como mejor racha</div>
    ${Object.keys(w.badges).length ? `<div class="w-badges">${Object.entries(w.badges).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `<span>${BADGES[k].name}${n > 1 ? ` ×${n}` : ''}</span>`).join('')}</div>` : ''}` });
  slides.push({ cls: 'w-final', html: `
    <div class="w-kicker">Tu carta</div>
    <div class="w-cardwrap">${playerCardHTML(w.card, { big: true })}</div>
    <div class="w-actions"><button class="btn-volt" onclick="event.stopPropagation(); closeWrapped(); sharePlayerCard(${jsArg(w.name)})">Compartir carta</button>
    <button class="btn-icon" onclick="event.stopPropagation(); wrapGo(0)">Ver de nuevo</button></div>` });
  return slides;
}

function openWrapped(name) {
  if (!name) return;
  const w = computeWrapped(name);
  if (!w.PJ) { showToast('Todavía no hay partidos para el resumen'); return; }
  openStories(wrapSlides(w));
}

// Muestra una serie de pantallas tipo historia (resumen de temporada, bienvenida)
function openStories(slides, { auto = true, onClose = null } = {}) {
  closeAppMenu();
  const el = document.getElementById('wrapped');
  el.innerHTML = `
    <div class="w-bars">${slides.map(() => '<i><b></b></i>').join('')}</div>
    <button class="w-close" onclick="event.stopPropagation(); closeWrapped()" aria-label="Cerrar"><svg class="icon"><use href="#i-close"/></svg></button>
    <div class="w-stage"></div>`;
  el.classList.remove('hidden');
  wrapState = { slides, i: 0, t0: 0, elapsed: 0, paused: false, raf: null, auto, onClose };
  wrapGo(0);
  wrapState.raf = requestAnimationFrame(wrapTick);
}

function wrapGo(i) {
  if (!wrapState) return;
  const n = wrapState.slides.length;
  if (i >= n) { closeWrapped(); return; }
  wrapState.i = Math.max(0, i);
  wrapState.elapsed = 0;
  wrapState.t0 = performance.now();
  const s = wrapState.slides[wrapState.i];
  const stage = document.querySelector('#wrapped .w-stage');
  stage.className = `w-stage ${s.cls}`;
  stage.innerHTML = `<div class="w-slide">${s.html}</div>`;
  initCardTilt(stage);
  document.querySelectorAll('#wrapped .w-bars i').forEach((bar, k) => {
    bar.querySelector('b').style.width = k < wrapState.i ? '100%' : '0%';
  });
  vibrate(6);
}

function wrapTick(now) {
  if (!wrapState) return;
  if (!wrapState.paused) {
    const k = wrapState.auto ? Math.min(1, (wrapState.elapsed + now - wrapState.t0) / WRAP_SLIDE_MS) : 1;
    const bar = document.querySelectorAll('#wrapped .w-bars i')[wrapState.i];
    if (bar) bar.querySelector('b').style.width = `${k * 100}%`;
    if (k >= 1 && wrapState.auto && wrapState.i < wrapState.slides.length - 1) wrapGo(wrapState.i + 1);
  }
  wrapState.raf = requestAnimationFrame(wrapTick);
}

function closeWrapped() {
  const done = wrapState && wrapState.onClose;
  if (wrapState) cancelAnimationFrame(wrapState.raf);
  wrapState = null;
  document.getElementById('wrapped').classList.add('hidden');
  if (done) done();
}

// ---------- Bienvenida (solo la primera vez) ----------
function maybeShowWelcome() {
  if (localStorage.getItem('pm_bienvenida_v1') || document.body.classList.contains('spectator-mode')) return;
  if (matchHistory.length || dbPlayers.length || localStorage.getItem('pm_partido_activo_v14')) {
    try { localStorage.setItem('pm_bienvenida_v1', '1'); } catch (e) {}
    return;
  }
  const done = () => { try { localStorage.setItem('pm_bienvenida_v1', '1'); } catch (e) {} };
  const feat = (icon, title, text) => `<div class="wl-feat"><svg class="icon"><use href="#${icon}"/></svg><div><strong>${title}</strong><span>${text}</span></div></div>`;
  openStories([
    { cls: 'w-intro', html: `
      <svg class="w-logo"><use href="#logo-mark"/></svg>
      <div class="w-kicker">Bienvenido a</div>
      <div class="w-huge">Padel Metric</div>
      <div class="w-sub">El marcador y las estadísticas de tus partidos, como en la televisión. Toca para continuar.</div>` },
    { cls: 'w-matches', html: `
      <div class="w-kicker">En directo</div>
      <div class="w-name">Cada punto cuenta</div>
      ${feat('i-ball', 'Marcador profesional', 'Saque, bolas de break, de set y de partido, punto de oro y tie-break.')}
      ${feat('i-chart', 'Probabilidad de victoria', 'Se recalcula tras cada punto con el nivel de las parejas.')}
      ${feat('i-broadcast', 'Directo para tus amigos', 'Comparte un enlace o un QR y lo siguen desde su móvil o una tele.')}` },
    { cls: 'w-shot', html: `
      <div class="w-kicker">Analiza</div>
      <div class="w-name">Tu juego, en datos</div>
      ${feat('i-target', 'Mapa de calor', 'Dónde ganas y dónde fallas: red, transición y fondo.')}
      ${feat('i-star', 'Carta de jugador', 'Atributos de red, fondo, saque, resto, presión y regularidad.')}
      ${feat('i-trophy', 'Ranking ELO', 'Torneos, americanos y mexicanos con clasificación automática.')}` },
    { cls: 'w-final', html: `
      <div class="w-kicker">Empezamos</div>
      <div class="w-name">¿Cómo quieres empezar?</div>
      <div class="w-sub">Puedes probar con datos de ejemplo de los mejores jugadores del mundo y borrarlos después desde Ajustes.</div>
      <div class="w-actions">
        <button class="btn-volt" onclick="event.stopPropagation(); closeWrapped(); loadDemoData();">Probar con datos de ejemplo</button>
        <button class="btn-icon" onclick="event.stopPropagation(); closeWrapped(); switchMainTab('setup');">Empezar un partido</button>
      </div>` }
  ], { auto: false, onClose: done });
}

// Toques: derecha avanza, izquierda vuelve, mantener pulsado pausa
(() => {
  let downAt = 0;
  document.addEventListener('pointerdown', e => {
    if (!wrapState || !e.target.closest('#wrapped') || e.target.closest('button')) return;
    downAt = performance.now();
    wrapState.paused = true;
    wrapState.elapsed += downAt - wrapState.t0;
  });
  document.addEventListener('pointerup', e => {
    if (!wrapState || !downAt) return;
    const held = performance.now() - downAt;
    downAt = 0;
    wrapState.paused = false;
    wrapState.t0 = performance.now();
    if (held < 250) wrapGo(wrapState.i + (e.clientX > window.innerWidth * 0.33 ? 1 : -1));
  });
})();

// Desde el menú: el resumen del perfil propio o, si aún no hay, cómo elegirlo
function openMyWrapped() {
  if (myPlayerName && dbPlayers.includes(myPlayerName)) { openWrapped(myPlayerName); return; }
  switchMainTab('ranking');
  showToast('Elige tu jugador, abre su Carta y pulsa "Soy yo"');
}
