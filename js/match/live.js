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
  updateUI();
  showToast('Último punto deshecho');
}

function updateUI() {
  if (!state) return;

  document.getElementById('t1-label').innerText = `${state.players[0].name} / ${state.players[1].name}`;
  document.getElementById('t2-label').innerText = `${state.players[2].name} / ${state.players[3].name}`;

  for (let s = 0; s < 3; s++) {
    const c1 = document.getElementById(`t1-s${s}`);
    const c2 = document.getElementById(`t2-s${s}`);
    c1.innerText = state.sets[s][0];
    c2.innerText = state.sets[s][1];
    c1.classList.toggle('current', s === state.currentSet);
    c2.classList.toggle('current', s === state.currentSet);
  }

  document.getElementById('t1-pts').innerText = formatPointLabel(0);
  document.getElementById('t2-pts').innerText = formatPointLabel(1);

  const isDeuce = !state.inTieBreak && !state.inSuperTB && state.pts[0] >= 3 && state.pts[1] >= 3 && state.pts[0] === state.pts[1];
  const isGoldenPointActive = isDeuce && (state.deuceRule === 'golden' || (state.deuceRule === 'star' && state.deuceCount >= 2));
  const isBreakPt = isBreakPointSituation();

  const banner = document.getElementById('status-banner');
  const bannerTxt = document.getElementById('banner-text');
  banner.className = 'tv-status-bar';

  if (state.matchOver) {
    bannerTxt.innerText = `FINALIZADO · GANAN PAREJA ${state.winnerPair + 1} (VER PÓSTER)`;
    banner.classList.add('gold-mode');
  } else if (isGoldenPointActive) {
    bannerTxt.innerText = 'PUNTO DE ORO DECISIVO';
    banner.classList.add('gold-mode');
  } else if (isBreakPt) {
    bannerTxt.innerText = `SET ${state.currentSet + 1} · BOLA DE BREAK`;
    banner.classList.add('break-mode');
  } else if (state.inSuperTB) {
    bannerTxt.innerText = 'SÚPER TIE-BREAK (A 10 PTOS)';
  } else if (state.inTieBreak) {
    bannerTxt.innerText = `SET ${state.currentSet + 1} · TIE-BREAK`;
  } else {
    bannerTxt.innerText = `SET ${state.currentSet + 1} · EN JUEGO`;
  }

  const goldBar = document.getElementById('gold-receive-bar');
  if (isGoldenPointActive && !state.matchOver) {
    goldBar.classList.remove('hidden');
    document.getElementById('gold-side-D').style.borderColor = state.goldReceiveSide === 'Drive' ? '#D4FF2A' : '';
    document.getElementById('gold-side-R').style.borderColor = state.goldReceiveSide === 'Revés' ? '#D4FF2A' : '';
  } else {
    goldBar.classList.add('hidden');
  }

  renderGameTicker();
  renderMomentumChart();

  const srvPlayer = state.players[state.serverIdx];
  document.getElementById('server-name').innerText = srvPlayer ? srvPlayer.name : '-';
  const srvBadge = document.getElementById('serve-badge');
  srvBadge.innerText = state.serveNumber === 1 ? '1.er Saque' : '2.º Saque';
  srvBadge.className = `serve-pill ${state.serveNumber === 1 ? 'serve-1' : 'serve-2'}`;

  document.getElementById('btn-toggle-stb').innerText = state.thirdSetRule === 'supertb' ? '3.er: Súper TB' : '3.er: Normal';

  const hintEl = document.getElementById('live-input-mode-hint');
  if (state.inputMode === 'swipe') {
    hintEl.innerText = 'MODO GESTOS: Desliza ↑ para Winner o ↓ para Error No Forzado';
  } else {
    hintEl.innerText = 'MODO TOQUE: Pulsa sobre un jugador para elegir su golpe';
  }

  const circumference = 2 * Math.PI * 11;
  state.players.forEach((p, idx) => {
    const card = document.getElementById(`pcard-${idx}`);
    const isSrv = (state.serverIdx === idx && !state.matchOver);
    const isFire = (p.streak >= 3);
    const rating = calcPlayerRating(p);
    const dashOffset = circumference * (1 - rating / 10);
    const avClass = idx < 2 ? 'avatar-p1' : 'avatar-p2';

    card.className = `hud-player-card ${isSrv ? 'is-serving' : ''} ${isFire ? 'is-onfire' : ''}`;
    card.innerHTML = `
      <div class="swipe-live-badge up">↑ WINNER</div>
      <div class="swipe-live-badge down">↓ ERROR NF</div>
      ${isFire ? `<span class="streak-pill">RACHA ×${p.streak}</span>` : ''}
      <div class="hud-card-top">
        <span class="hud-side-label">
          ${isSrv ? '<svg class="icon" style="width:11px;height:11px;"><use href="#i-ball"/></svg>' : ''}
          ${p.side}
        </span>
        <div class="rating-ring-wrap">
          <svg class="rating-ring-svg" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.12)" stroke-width="2.5" fill="none"/>
            <circle cx="14" cy="14" r="11" stroke="${idx < 2 ? '#00F0FF' : '#FF2E54'}" stroke-width="2.5" fill="none"
              stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${dashOffset.toFixed(1)}" stroke-linecap="round"/>
          </svg>
          <span class="rating-ring-val">${rating.toFixed(1)}</span>
        </div>
      </div>
      <div class="hud-player-mid">
        ${renderAvatarHTML(p.name, avClass, 'width:26px;height:26px;font-size:0.72rem;', p.isGeneric, `J${idx+1}`)}
        <div class="hud-player-name">${p.name}</div>
      </div>
      <div class="hud-micro-telemetry">
        <span style="color:var(--emerald);">W:${p.W}</span>
        <span style="color:var(--coral);">ENF:${p.ENF}</span>
        <span style="color:var(--amber);">EF:${p.EF}</span>
      </div>
    `;
  });
}

function renderGameTicker() {
  const strip = document.getElementById('game-log-strip');
  if (!strip || !state) return;
  if (!state.gamePointLog || state.gamePointLog.length === 0) {
    strip.innerHTML = `<span style="opacity:0.65;">Juego en curso: 0-0 (Esperando primer punto)</span>`;
    return;
  }
  strip.innerHTML = state.gamePointLog.map(item => `<span class="game-pt-pill">${item}</span>`).join('');
  strip.scrollLeft = strip.scrollWidth;
}

function renderMomentumChart() {
  const svg = document.getElementById('momentum-svg');
  if (!svg || !state) return;
  const data = state.momentum && state.momentum.length > 0 ? state.momentum : [0];
  const w = 400, h = 22, mid = 11;
  const maxAbs = Math.max(4, ...data.map(v => Math.abs(v)));

  let pointsStr = data.map((val, i) => {
    const x = data.length === 1 ? 0 : (i / (data.length - 1)) * w;
    const y = mid - (val / maxAbs) * (mid - 3);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  if (data.length === 1) pointsStr = `0,${mid} 400,${mid}`;

  svg.innerHTML = `
    <line x1="0" y1="${mid}" x2="${w}" y2="${mid}" stroke="rgba(255,255,255,0.14)" stroke-width="1" stroke-dasharray="3 3"/>
    <polyline fill="none" stroke="#D4FF2A" stroke-width="2" points="${pointsStr}" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

function setGoldReceiveSide(side) {
  if (!state) return;
  state.goldReceiveSide = side;
  updateUI();
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
  if (timerInterval) clearInterval(timerInterval);
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
    switchMainTab('setup');
  }
}
