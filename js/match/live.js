// ==========================================================
// PERSISTENCIA DEL PARTIDO ACTIVO Y SALIDA LIMPIA AL FINALIZAR
// ==========================================================
function persistActiveMatchState() {
  if (state && !state.matchOver) {
    localStorage.setItem('pm_partido_activo_v14', JSON.stringify(state));
  } else {
    localStorage.removeItem('pm_partido_activo_v14');
  }
}

function checkSavedActiveMatch() {
  const raw = localStorage.getItem('pm_partido_activo_v14');
  const banner = document.getElementById('resume-match-banner');
  if (!banner) return;
  if (!raw) {
    banner.classList.add('hidden');
    return;
  }
  try {
    const saved = JSON.parse(raw);
    if (saved && !saved.matchOver && saved.players) {
      document.getElementById('resume-match-label').innerText =
        `${saved.players[0].name}/${saved.players[1].name} vs ${saved.players[2].name}/${saved.players[3].name}`;
      banner.classList.remove('hidden');
    } else {
      localStorage.removeItem('pm_partido_activo_v14');
      banner.classList.add('hidden');
    }
  } catch (e) {
    banner.classList.add('hidden');
  }
}

function resumeSavedActiveMatch() {
  const raw = localStorage.getItem('pm_partido_activo_v14');
  if (!raw) return;
  try {
    state = JSON.parse(raw);
    if (state.wp === undefined) initMatchWinProb(state);
    liveUiPrev = { players: {}, server: null };
    historyStack = [];
    requestWakeLock();
    document.body.classList.add('in-live-match');
    setSectionIdentity('match', 'En directo');
    closeAppMenu();
    document.getElementById('resume-match-banner').classList.add('hidden');
    document.getElementById('main-nav').classList.add('hidden');
    document.getElementById('view-setup').classList.add('hidden');
    Object.values(SECTIONS).forEach(c => document.getElementById(c.view)?.classList.add('hidden'));
    document.getElementById('view-match').classList.remove('hidden');
    document.getElementById('btn-undo').classList.remove('hidden');
    document.getElementById('btn-stats').classList.remove('hidden');
    startMatchTimer();
    updateUI();
    showToast('Partido en curso reanudado');
  } catch (e) {}
}

function discardSavedActiveMatch() {
  localStorage.removeItem('pm_partido_activo_v14');
  document.getElementById('resume-match-banner').classList.add('hidden');
  showToast('Partido en curso descartado');
}

// ==========================================================
// MOTOR DE PARTIDO EN VIVO (ALTURA FIJA Y MODO DE REGISTRO EXCLUSIVO)
// ==========================================================
async function requestWakeLock() {
  if (appSettings.wakeLock && 'wakeLock' in navigator) {
    try { wakeLockRef = await navigator.wakeLock.request('screen'); } catch (e) {}
  }
}

function startMatch(link = null) {
  vibrate([20, 40]);
  const players = setupConfig.slots.map((slotVal, idx) => {
    const isGeneric = slotVal.startsWith('GEN_');
    return {
      name: isGeneric ? `Jugador ${idx + 1}` : slotVal,
      isGeneric,
      side: FIXED_COURT_SIDES[idx],
      pair: idx < 2 ? 0 : 1,
      W: 0, ENF: 0, EF: 0, aces: 0, df: 0, streak: 0, maxStreak: 0,
      shots: { 'Saque Directo': 0, 'Volea': 0, 'Bandeja/Víbora': 0, 'Remate': 0, 'Fondo/Bajada': 0, 'Red': 0, 'Fondo': 0, 'Defensa': 0 },
      setStats: [
        { W: 0, ENF: 0, EF: 0 },
        { W: 0, ENF: 0, EF: 0 },
        { W: 0, ENF: 0, EF: 0 }
      ]
    };
  });

  state = {
    id: Date.now(),
    date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    deuceRule: setupConfig.deuceRule,
    thirdSetRule: setupConfig.thirdSetRule,
    inputMode: setupConfig.inputMode,
    players,
    sets: [[0, 0], [0, 0], [0, 0]],
    currentSet: 0,
    pts: [0, 0],
    inTieBreak: false,
    inSuperTB: false,
    deuceCount: 0,
    goldReceiveSide: 'Drive',
    serverIdx: setupConfig.initialServer,
    serveNumber: 1,
    gamePointLog: [],
    momentum: [0],
    elapsedSec: 0,
    timerPaused: false,
    matchOver: false,
    winnerPair: null,
    savedToHistory: false,
    points: [],
    link
  };
  initMatchWinProb(state);
  liveUiPrev = { players: {}, server: null };

  historyStack = [];
  requestWakeLock();
  document.body.classList.add('in-live-match');
  setSectionIdentity('match', 'En directo');
  closeAppMenu();
  document.getElementById('main-nav').classList.add('hidden');
  document.getElementById('view-setup').classList.add('hidden');
  document.getElementById('view-ranking').classList.add('hidden');
  document.getElementById('view-history').classList.add('hidden');
  document.getElementById('view-stats').classList.add('hidden');
  Object.values(SECTIONS).forEach(c => document.getElementById(c.view)?.classList.add('hidden'));
  document.getElementById('view-match').classList.remove('hidden');
  document.getElementById('btn-undo').classList.remove('hidden');
  document.getElementById('btn-stats').classList.remove('hidden');

  startMatchTimer();
  persistActiveMatchState();
  updateUI();
}

function startMatchTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!state || state.matchOver || state.timerPaused) return;
    state.elapsedSec++;
    const mm = String(Math.floor(state.elapsedSec / 60)).padStart(2, '0');
    const ss = String(state.elapsedSec % 60).padStart(2, '0');
    const el = document.getElementById('match-timer');
    if (el) el.innerText = `${mm}:${ss}`;
  }, 1000);
}

function toggleTimerPause() {
  if (!state || state.matchOver) return;
  state.timerPaused = !state.timerPaused;
  persistActiveMatchState();
  updateUI();
  showToast(state.timerPaused ? 'Cronómetro en pausa' : 'Cronómetro reanudado');
}

function cloneStateForUndo() {
  if (!state) return;
  historyStack.push(JSON.stringify(state));
  if (historyStack.length > 40) historyStack.shift();
}

function undoLast() {
  if (historyStack.length === 0) {
    showToast('No hay acciones para deshacer');
    return;
  }
  vibrate(20);
  state = JSON.parse(historyStack.pop());
  persistActiveMatchState();
  document.getElementById('cele-layer').innerHTML = '';
  fxSound('undo');
  updateUI();
  showToast('Último punto deshecho');
}

// ==========================================================
// PANTALLA DEL PARTIDO: MARCADOR DE RETRANSMISIÓN, PISTA Y CELEBRACIONES
// ==========================================================

// Apellidos para el marcador ("COELLO / TAPIA"); los jugadores sin ficha se muestran como J1, J2...
function liveSurname(p) {
  if (!p) return '';
  if (p.isGeneric) return String(p.name).replace(/^Jugador\s+/, 'J');
  const parts = String(p.name).trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
}

function livePairName(pair, st = state) {
  const a = st.players[pair * 2], b = st.players[pair * 2 + 1];
  if (a.isGeneric && b.isGeneric) return `Pareja ${pair + 1}`;
  return `${liveSurname(a)} / ${liveSurname(b)}`;
}

// Vuelve a lanzar una animación CSS aunque ya se haya usado
function replayAnim(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// Cambia un texto y lo anima solo si ha cambiado
function setLiveText(id, text, anim) {
  const el = document.getElementById(id);
  if (!el) return false;
  const t = String(text);
  if (el.textContent === t && !el.children.length) return false;
  el.textContent = t;
  if (anim) replayAnim(el, anim);
  return true;
}

// Situación del punto que se va a jugar: bola de partido, de set o de break (y cuántas seguidas)
const CHANCE_LABEL = { match: ['BOLA DE PARTIDO', 'BOLAS DE PARTIDO'], set: ['BOLA DE SET', 'BOLAS DE SET'], break: ['BOLA DE BREAK', 'BOLAS DE BREAK'] };
const CHANCE_RANK = { match: 3, set: 2, break: 1 };

function liveChance(st = state) {
  if (!st || st.matchOver) return null;
  const isGold = st.deuceRule === 'golden' || (st.deuceRule === 'star' && st.deuceCount >= 2);
  const setsWon = t => st.sets.slice(0, st.currentSet).filter(s => s[t] > s[1 - t]).length;
  const srvPair = st.serverIdx < 2 ? 0 : 1;
  let best = null;
  for (const t of [0, 1]) {
    const me = st.pts[t], op = st.pts[1 - t];
    let winsGame, count = 1;
    if (st.inSuperTB || st.inTieBreak) {
      const target = st.inSuperTB ? 10 : 7;
      winsGame = me + 1 >= target && me + 1 - op >= 2;
      if (winsGame) count = Math.max(1, me - op);
    } else {
      winsGame = me + 1 >= 4 && ((isGold && op === 3) || me + 1 - op >= 2);
      if (winsGame && me === 3 && op < 3) count = 3 - op;
    }
    if (!winsGame) continue;
    let kind = null;
    if (st.inSuperTB) kind = 'match';
    else {
      const g = st.sets[st.currentSet][t] + 1, gl = st.sets[st.currentSet][1 - t];
      const winsSet = st.inTieBreak || (g >= 6 && g - gl >= 2) || g === 7;
      if (winsSet) kind = setsWon(t) + 1 >= 2 ? 'match' : 'set';
      else if (t !== srvPair) kind = 'break';
    }
    if (kind && (!best || CHANCE_RANK[kind] > CHANCE_RANK[best.kind])) best = { kind, pair: t, count };
  }
  return best;
}

function liveStatus() {
  if (state.matchOver) return { cls: 'is-over', html: `Final · ganan ${escapeHtml(livePairName(state.winnerPair))}` };
  const setLbl = state.inSuperTB ? 'Súper tie-break' : `Set ${state.currentSet + 1}${state.inTieBreak ? ' · tie-break' : ''}`;
  const ch = liveChance();
  const chTxt = ch ? `<i class="sb-chance-dot ${ch.pair ? 'b' : 'a'}"></i>${ch.count > 1 ? `${ch.count} ` : ''}${CHANCE_LABEL[ch.kind][ch.count > 1 ? 1 : 0]}` : '';
  if (isGoldenPointNow()) {
    return { cls: ch && ch.kind === 'match' ? 'is-match' : 'is-gold', html: `Punto de oro${ch && ch.kind !== 'break' ? ` · ${chTxt}` : ''}` };
  }
  if (ch) return { cls: `is-${ch.kind}`, html: `${setLbl} · ${chTxt}` };
  if (state.inTieBreak || state.inSuperTB) return { cls: 'is-tb', html: setLbl };
  return { cls: '', html: `${setLbl} · en juego` };
}

// Lo último que se ha dibujado, para animar solo lo que cambia
let liveUiPrev = { players: {}, server: null };

function updateUI() {
  if (!state) return;
  const over = state.matchOver;
  const srvPair = state.serverIdx < 2 ? 0 : 1;
  const ch = liveChance();

  // Franja de estado
  const st = liveStatus();
  const banner = document.getElementById('status-banner');
  banner.className = `sb-status ${st.cls}`;
  const bannerTxt = document.getElementById('banner-text');
  if (bannerTxt.innerHTML !== st.html) bannerTxt.innerHTML = st.html;
  document.getElementById('match-timer').classList.toggle('paused', !!state.timerPaused && !over);

  // Filas de las parejas
  for (const t of [0, 1]) {
    const row = document.getElementById(`sb-row-${t}`);
    row.classList.toggle('winner', over && state.winnerPair === t);
    row.classList.toggle('loser', over && state.winnerPair !== t);
    row.classList.toggle('has-chance', !!ch && ch.pair === t);
    document.getElementById(`sb-serve-${t}`).classList.toggle('on', !over && srvPair === t);
    setLiveText(`t${t + 1}-label`, livePairName(t));
    for (let s = 0; s < 3; s++) {
      const cell = document.getElementById(`t${t + 1}-s${s}`);
      const finished = s < state.currentSet || (over && s === state.currentSet);
      setLiveText(cell.id, state.sets[s][t], 'bump');
      cell.classList.toggle('off', s > state.currentSet || (s === 2 && state.inSuperTB && !over));
      cell.classList.toggle('current', s === state.currentSet && !over);
      cell.classList.toggle('won', finished && state.sets[s][t] > state.sets[s][1 - t]);
    }
    const pts = document.getElementById(`t${t + 1}-pts`);
    const wrap = pts.parentElement;
    if (over) {
      const html = state.winnerPair === t ? '<svg class="icon"><use href="#i-trophy"/></svg>' : '';
      if (pts.innerHTML !== html) pts.innerHTML = html;
      wrap.classList.remove('gold');
    } else {
      const lbl = formatPointLabel(t);
      setLiveText(pts.id, lbl, 'flip');
      wrap.classList.toggle('gold', lbl === 'ORO');
    }
  }

  // Probabilidad de victoria
  if (state.wp === undefined) state.wp = currentWinProb(state);
  const pa = Math.round((state.wp ?? 0.5) * 100);
  setLiveText('wp-a', `${pa}%`);
  setLiveText('wp-b', `${100 - pa}%`);
  document.getElementById('wp-bar-a').style.flexBasis = `${state.wp * 100}%`;
  renderWinProbSpark();

  // Resto en el punto de oro
  const goldBar = document.getElementById('gold-receive-bar');
  goldBar.classList.toggle('hidden', !(isGoldenPointNow() && !over));
  document.getElementById('gold-side-D').classList.toggle('active', state.goldReceiveSide === 'Drive');
  document.getElementById('gold-side-R').classList.toggle('active', state.goldReceiveSide === 'Revés');
  renderGameTicker();

  // Saque
  const srvPlayer = state.players[state.serverIdx];
  document.getElementById('server-name').textContent = srvPlayer ? srvPlayer.name : '-';
  const srvKey = `${state.serverIdx}|${srvPlayer ? srvPlayer.name : ''}`;
  if (liveUiPrev.server !== null && liveUiPrev.server !== srvKey) replayAnim(document.getElementById('serve-ball'), 'spin');
  liveUiPrev.server = srvKey;
  const srvBadge = document.getElementById('serve-badge');
  srvBadge.textContent = state.serveNumber === 1 ? '1.er saque' : '2.º saque';
  srvBadge.className = `serve-pill ${state.serveNumber === 1 ? 'serve-1' : 'serve-2'}`;

  setLiveText('qp-a', livePairName(0));
  setLiveText('qp-b', livePairName(1));
  document.getElementById('btn-live-broadcast')?.classList.toggle('on', !!(state.live && state.live.on));
  setLiveText('live-input-mode-hint', state.inputMode === 'swipe'
    ? 'Desliza hacia arriba: winner · hacia abajo: error no forzado'
    : 'Toca a un jugador para anotar su golpe');

  // Tarjetas de los jugadores
  const circumference = 2 * Math.PI * 11;
  state.players.forEach((p, idx) => {
    const card = document.getElementById(`pcard-${idx}`);
    const isSrv = state.serverIdx === idx && !over;
    const isFire = p.streak >= 3;
    const rating = calcPlayerRating(p);
    const dashOffset = circumference * (1 - rating / 10);
    const pairCls = idx < 2 ? 'pa' : 'pb';
    card.className = `hud-player-card ${pairCls} ${isSrv ? 'is-serving' : ''} ${isFire ? 'is-onfire' : ''}`;
    card.innerHTML = `
      <div class="swipe-live-badge up">↑ Winner</div>
      <div class="swipe-live-badge down">↓ Error NF</div>
      ${isFire ? `<span class="streak-pill">Racha ${p.streak}</span>` : ''}
      <div class="hud-card-top">
        <span class="hud-side-label">${isSrv ? '<svg class="icon"><use href="#i-ball"/></svg>' : ''}${escapeHtml(p.side)}</span>
        <div class="rating-ring-wrap" title="Valoración del partido">
          <svg class="rating-ring-svg" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.12)" stroke-width="2.5" fill="none"/>
            <circle cx="14" cy="14" r="11" stroke="${idx < 2 ? '#00F0FF' : '#FF2E54'}" stroke-width="2.5" fill="none"
              stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${dashOffset.toFixed(1)}" stroke-linecap="round"/>
          </svg>
          <span class="rating-ring-val">${rating.toFixed(1)}</span>
        </div>
      </div>
      <div class="hud-player-mid">
        ${renderAvatarHTML(p.name, idx < 2 ? 'avatar-p1' : 'avatar-p2', '', p.isGeneric, liveSurname(p).slice(0, 2).toUpperCase())}
        <div class="hud-player-name">${escapeHtml(liveSurname(p))}</div>
      </div>
      <div class="hud-micro-telemetry">
        <span class="w">W ${p.W}</span><span class="enf">ENF ${p.ENF}</span><span class="ef">EF ${p.EF}</span>
      </div>`;
    const prev = liveUiPrev.players[p.name];
    if (prev) {
      if (p.W > prev.W) replayAnim(card, 'scored');
      else if (p.ENF + p.EF > prev.ENF + prev.EF) replayAnim(card, 'erred');
    }
    liveUiPrev.players[p.name] = { W: p.W, ENF: p.ENF, EF: p.EF };
  });

  if (!over) closeMatchEnd(true);
  if (typeof scheduleLivePublish === 'function') scheduleLivePublish();
}

function renderGameTicker() {
  const strip = document.getElementById('game-log-strip');
  if (!strip || !state) return;
  if (!state.gamePointLog || state.gamePointLog.length === 0) {
    strip.innerHTML = `<span>${state.matchOver ? 'Partido terminado' : 'Juego en curso · esperando el primer punto'}</span>`;
    return;
  }
  strip.innerHTML = state.gamePointLog.map(item => {
    const m = /^(.*?) \((.*)\)$/.exec(item);
    return m ? `<span class="game-pt-pill"><b>${escapeHtml(m[1])}</b>${escapeHtml(m[2])}</span>` : `<span class="game-pt-pill">${escapeHtml(item)}</span>`;
  }).join('');
  strip.scrollLeft = strip.scrollWidth;
}

// Evolución de la probabilidad de victoria: por encima de la línea manda la pareja 1, por debajo la pareja 2
function renderWinProbSpark() {
  const svg = document.getElementById('momentum-svg');
  if (!svg || !state) return;
  const series = [state.wpStart ?? 0.5, ...(state.points || []).filter(p => p.wp !== undefined).map(p => p.wp)];
  const w = 400, h = 26, mid = h / 2;
  const xy = series.map((v, i) => [series.length === 1 ? 0 : (i / (series.length - 1)) * w, mid - (v - 0.5) * 2 * (mid - 1.5)]);
  if (xy.length === 1) xy.push([w, xy[0][1]]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const area = `${line}L${w} ${mid}L0 ${mid}Z`;
  svg.innerHTML = `
    <defs><clipPath id="spk-top"><rect width="${w}" height="${mid}"/></clipPath><clipPath id="spk-bot"><rect y="${mid}" width="${w}" height="${mid}"/></clipPath></defs>
    <line x1="0" y1="${mid}" x2="${w}" y2="${mid}" class="sb-spark-mid"/>
    <path d="${area}" clip-path="url(#spk-top)" class="sb-spark-a"/>
    <path d="${area}" clip-path="url(#spk-bot)" class="sb-spark-b"/>
    <path d="${line}" class="sb-spark-line"/>`;
}

function setGoldReceiveSide(side) {
  if (!state) return;
  vibrate(8);
  state.goldReceiveSide = side;
  persistActiveMatchState();
  updateUI();
}

// Juego, break y set: rótulo sobre la pista; el partido abre el cierre con confeti
let celeTimer = null, matchEndTimer = null;
function celebrateEvent(ev) {
  if (!ev || !state) return;
  const layer = document.getElementById('cele-layer');
  if (ev.kind === 'match') {
    fxSound('match');
    fxConfetti({ colors: ev.pair ? ['#FF2E54', '#FFE066', '#FFFFFF'] : ['#00F0FF', '#D4FF2A', '#FFFFFF'], count: 160 });
    clearTimeout(matchEndTimer);
    matchEndTimer = setTimeout(openMatchEnd, 900);
    return;
  }
  let kind = 'Juego', score;
  if (ev.kind === 'set') {
    const s = state.sets[Math.max(0, state.currentSet - 1)];
    kind = 'Set';
    score = `${s[0]}-${s[1]}`;
    fxSound('set');
    fxConfetti({ colors: ev.pair ? ['#FF2E54', '#FFFFFF'] : ['#00F0FF', '#FFFFFF'], count: 70 });
  } else {
    const last = state.points[state.points.length - 1];
    if (last && last.sv != null && (last.sv < 2 ? 0 : 1) !== ev.pair) kind = 'Break';
    const g = state.sets[state.currentSet];
    score = `${g[0]}-${g[1]}`;
    fxSound('game');
  }
  layer.innerHTML = `<div class="cele-banner ${ev.pair ? 'b' : 'a'} ${ev.kind === 'set' ? 'big' : ''}">
    <span class="cele-kind">${kind}</span><span class="cele-who">${escapeHtml(livePairName(ev.pair))}</span><span class="cele-score">${score}</span></div>`;
  clearTimeout(celeTimer);
  celeTimer = setTimeout(() => { layer.innerHTML = ''; }, 2000);
}

function formatMatchDuration(sec) {
  const m = Math.round((sec || 0) / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}

// Cierre del partido: ganadores, sets, duración, mejor jugador y la curva de la probabilidad de victoria
function openMatchEnd() {
  // Solo si se sigue en la pantalla del partido (puede llegar con retraso tras el confeti)
  if (!state || !state.matchOver || document.getElementById('view-match').classList.contains('hidden')) return;
  const w = state.winnerPair, l = 1 - w;
  const full = pair => `${state.players[pair * 2].name} / ${state.players[pair * 2 + 1].name}`;
  const sets = state.sets.map((s, i) => ({ s, i })).filter(({ s, i }) => i <= state.currentSet && (s[0] || s[1]));
  const mvp = [...state.players].sort((a, b) => calcPlayerRating(b) - calcPlayerRating(a))[0];
  const chart = wpChartSVG(state, { w: 320, h: 92, idPrefix: 'me' });
  document.getElementById('match-end-card').innerHTML = `
    <div class="me-trophy"><svg class="icon"><use href="#i-trophy"/></svg></div>
    <div class="me-kicker">Partido finalizado</div>
    <div class="me-winners ${w ? 'b' : 'a'}">${escapeHtml(livePairName(w))}</div>
    <div class="me-losers">${escapeHtml(full(w))} ganan a ${escapeHtml(full(l))}</div>
    <div class="me-sets">${sets.map(({ s, i }) => `<div class="me-set"><small>${i === 2 && state.thirdSetRule === 'supertb' ? 'STB' : `SET ${i + 1}`}</small>${s[0]}-${s[1]}</div>`).join('')}</div>
    <div class="me-stats">
      <div class="me-stat"><strong>${formatMatchDuration(state.elapsedSec)}</strong><span>Duración</span></div>
      <div class="me-stat"><strong>${(state.points || []).length || '-'}</strong><span>Puntos</span></div>
      <div class="me-stat"><strong>${escapeHtml(liveSurname(mvp))}</strong><span>Mejor · ${calcPlayerRating(mvp).toFixed(1)}</span></div>
    </div>
    ${chart ? `<div class="me-chart"><div class="me-chart-title"><span>Probabilidad de victoria</span><span>${escapeHtml(livePairName(0))}</span></div>${chart}</div>` : ''}
    <div class="me-actions">
      <button class="btn-volt" onclick="closeMatchEnd(); toggleStatsView();">Ver estadísticas</button>
      <button class="btn-icon" onclick="openPosterModal()"><svg class="icon"><use href="#i-share"/></svg> Póster</button>
      <button class="btn-icon" onclick="closeMatchEnd(); exitMatchScreen();"><svg class="icon"><use href="#i-exit"/></svg> Salir</button>
    </div>`;
  document.getElementById('match-end').classList.remove('hidden');
}

function closeMatchEnd(silent) {
  const el = document.getElementById('match-end');
  if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
}

// Opciones del partido: tercer set, cronómetro, narrador y modo de registro
function openMatchOptions() {
  if (!state) return;
  vibrate(10);
  const row = (label, sub, control) => `<div class="mo-row"><div><strong>${label}</strong><small>${sub}</small></div>${control}</div>`;
  const seg = (opts, current, fn) => `<div class="mo-seg">${opts.map(([v, t]) => `<button type="button" class="${v === current ? 'active' : ''}" onclick="${fn}(${jsArg(v)})">${t}</button>`).join('')}</div>`;
  openEventModal(`
    <div class="mo-title">Opciones del partido</div>
    ${row('Tercer set', 'Se puede cambiar mientras no haya empezado', seg([['normal', 'Set normal'], ['supertb', 'Súper tie-break']], state.thirdSetRule, 'setMatchThirdSet'))}
    ${row('Registro', 'Toque abre el panel de golpes; gestos anota deslizando', seg([['tap', 'Toque'], ['swipe', 'Gestos']], state.inputMode, 'setMatchInputMode'))}
    ${row('Cronómetro', state.timerPaused ? 'En pausa' : 'En marcha', `<button type="button" class="btn-icon" onclick="toggleTimerPause(); openMatchOptions();">${state.timerPaused ? 'Reanudar' : 'Pausar'}</button>`)}
    ${row('Narrador de voz', 'Canta el marcador tras cada punto', `<button type="button" class="btn-icon" onclick="toggleVoiceNarrator(); openMatchOptions();">${voiceEnabled ? 'Desactivar' : 'Activar'}</button>`)}
    ${row('Saque', 'Corrige quién saca si no coincide con la pista', `<button type="button" class="btn-icon" onclick="cycleServerManual(); openMatchOptions();">Siguiente</button>`)}`);
}

function setMatchThirdSet(rule) {
  if (!state) return;
  if (state.thirdSetRule !== rule) toggleSuperTBHot();
  openMatchOptions();
}

function setMatchInputMode(mode) {
  if (!state) return;
  state.inputMode = mode;
  persistActiveMatchState();
  updateUI();
  openMatchOptions();
}

// Interacción exclusiva en las tarjetas de jugador según el modo elegido en Ajustes
function initPlayerCardInteractions() {
  for (let idx = 0; idx < 4; idx++) {
    const card = document.getElementById(`pcard-${idx}`);
    if (!card) continue;

    let startY = null;
    let startX = null;

    card.addEventListener('pointerdown', (e) => {
      if (!state || state.matchOver) return;
      startY = e.clientY;
      startX = e.clientX;
      if (state.inputMode === 'swipe') {
        card.setPointerCapture(e.pointerId);
      }
    });

    card.addEventListener('pointermove', (e) => {
      if (!state || state.matchOver || state.inputMode !== 'swipe' || startY === null) return;
      const dy = e.clientY - startY;
      card.classList.toggle('swipe-up-preview', dy < -26);
      card.classList.toggle('swipe-down-preview', dy > 26);
    });

    card.addEventListener('pointerup', (e) => {
      if (!state || state.matchOver || startY === null) return;
      const dy = e.clientY - startY;
      const dx = e.clientX - startX;
      startY = null;
      startX = null;
      card.classList.remove('swipe-up-preview', 'swipe-down-preview');

      if (state.inputMode === 'swipe') {
        if (dy < -30) {
          selectedSlot = idx;
          recordAction('W', 'Winner', { z: null, l: sideToLane(state.players[idx].side) });
        } else if (dy > 30) {
          selectedSlot = idx;
          recordAction('ENF', 'Error No Forzado', { z: null, l: sideToLane(state.players[idx].side) });
        } else {
          showToast('Modo Gestos: desliza ↑ Winner o ↓ Error NF');
        }
      } else {
        if (Math.abs(dy) < 18 && Math.abs(dx) < 18) {
          openModal(idx);
        }
      }
    });

    card.addEventListener('pointercancel', () => {
      startY = null;
      startX = null;
      card.classList.remove('swipe-up-preview', 'swipe-down-preview');
    });
  }
}

function openModal(slotIdx) {
  if (!state || state.matchOver) return;
  if (state.inputMode !== 'tap') return;
  vibrate(12);
  selectedSlot = slotIdx;
  const p = state.players[slotIdx];
  document.getElementById('modal-player-title').innerText = p.name;
  const aceBtn = document.getElementById('btn-contextual-ace');
  if (aceBtn) {
    aceBtn.classList.toggle('hidden', state.serverIdx !== slotIdx);
  }
  modalZone = { z: null, l: sideToLane(p.side) };
  renderZonePicker();
  document.getElementById('action-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('action-modal').classList.add('hidden');
}

// ==========================================================
// ZONA DEL GOLPE (RED / TRANSICIÓN / FONDO × LADO DRIVE / REVÉS)
// ==========================================================
const ZONE_LABELS = { R: 'Red · Volea', T: 'Transición', F: 'Fondo' };
let modalZone = { z: null, l: 'D' };

function sideToLane(side) {
  return side === 'Drive' ? 'D' : 'V';
}

function selectModalZone(z, l) {
  vibrate(8);
  // Tocar de nuevo la misma casilla vuelve al modo automático
  modalZone = (modalZone.z === z && modalZone.l === l) ? { z: null, l } : { z, l };
  renderZonePicker();
}

function getModalZone(shotName, player) {
  return {
    z: modalZone.z || SHOT_DEFAULT_ZONE[shotName] || null,
    l: modalZone.l || sideToLane(player.side)
  };
}

function renderZonePicker() {
  const box = document.getElementById('zone-picker');
  if (!box) return;
  // Vista desde el jugador mirando a la red: lado revés a la izquierda, drive a la derecha
  const cells = ['R', 'T', 'F'].map(z => ['V', 'D'].map(l => {
    const active = modalZone.z === z && modalZone.l === l;
    const laneHint = modalZone.z === null && modalZone.l === l;
    return `<button type="button" class="zone-cell ${active ? 'active' : ''} ${laneHint ? 'lane-hint' : ''}" onclick="selectModalZone('${z}','${l}')">
      <span>${ZONE_LABELS[z]}</span><small>${l === 'D' ? 'Drive' : 'Revés'}</small>
    </button>`;
  }).join('')).join('');
  box.innerHTML = `<div class="zone-net">RED</div><div class="zone-grid">${cells}</div>`;
  const hint = document.getElementById('zone-picker-hint');
  if (hint) {
    hint.innerText = modalZone.z
      ? `Marcado: ${ZONE_LABELS[modalZone.z]} · lado ${modalZone.l === 'D' ? 'Drive' : 'Revés'}`
      : 'Automático: la zona se deduce del golpe (toca una casilla para precisar)';
  }
}

function exitMatchScreen() {
  vibrate(15);
  clearTimeout(matchEndTimer);
  closeMatchEnd();
  if (timerInterval) clearInterval(timerInterval);
  if (wakeLockRef) { try { wakeLockRef.release(); } catch (e) {} wakeLockRef = null; }
  document.body.classList.remove('in-live-match');

  const link = state ? state.link : null;
  if (state) {
    if (state.matchOver) {
      if (!state.savedToHistory) saveMatchToHistory(false);
      localStorage.removeItem('pm_partido_activo_v14');
      state = null;
      showToast('Partido archivado en Estadísticas e Historial');
    } else {
      persistActiveMatchState();
      showToast('Partido en pausa: puedes continuar cuando quieras');
    }
  }

  document.getElementById('view-match').classList.add('hidden');
  document.getElementById('view-stats').classList.add('hidden');
  document.getElementById('btn-undo').classList.add('hidden');
  document.getElementById('btn-stats').classList.add('hidden');
  document.getElementById('main-nav').classList.remove('hidden');
  if (link && link.kind === 'tournament') {
    openTournament(link.tid);
  } else {
    switchMainTab('home');
  }
}
