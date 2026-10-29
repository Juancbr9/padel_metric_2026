// Orden de saque: tras el primer sacador saca el jugador del mismo lado de la otra pareja, después el compañero
// del primero y por último el compañero del segundo. Empezando el drive de la pareja 1:
// drive pareja 1 → drive pareja 2 → revés pareja 1 → revés pareja 2 (índices 0 → 3 → 1 → 2 → 0)
function firstServePairOf(st) {
  if (st.firstServePair === 0 || st.firstServePair === 1) return st.firstServePair;
  const first = st.points && st.points.length ? st.points[0].sv : st.serverIdx;
  return first < 2 ? 0 : 1;
}

function nextServer(idx) {
  const pair = idx < 2 ? 0 : 1;
  const side = FIXED_COURT_SIDES[idx];
  // La pareja que abrió el saque pasa al mismo lado; la otra, al lado contrario
  const target = pair === firstServePairOf(state) ? side : (side === 'Drive' ? 'Revés' : 'Drive');
  const next = [0, 1, 2, 3].find(i => (i < 2 ? 0 : 1) !== pair && FIXED_COURT_SIDES[i] === target);
  return next ?? 0;
}

function formatPointLabel(teamIdx) {
  if (state.inTieBreak || state.inSuperTB) return String(state.pts[teamIdx]);
  const map = ['0', '15', '30', '40'];
  const p0 = state.pts[0];
  const p1 = state.pts[1];
  if (p0 >= 3 && p1 >= 3) {
    const isGoldenNow = (state.deuceRule === 'golden') || (state.deuceRule === 'star' && state.deuceCount >= 2);
    if (isGoldenNow && p0 === p1) return 'ORO';
    if (p0 === p1) return '40';
    return state.pts[teamIdx] > state.pts[1 - teamIdx] ? 'AD' : '40';
  }
  return map[state.pts[teamIdx]] || '0';
}

function calcPlayerRating(p) {
  const raw = 6.5 + (p.W * 0.35) - (p.ENF * 0.30) - (p.EF * 0.12) + (p.aces * 0.2);
  return Math.min(10, Math.max(1, raw));
}

function isBreakPointSituation() {
  if (!state || state.matchOver || state.inTieBreak || state.inSuperTB) return false;
  const srvPair = state.players[state.serverIdx].pair;
  const recPair = 1 - srvPair;
  const pSrv = state.pts[srvPair];
  const pRec = state.pts[recPair];
  const isGold = (state.deuceRule === 'golden') || (state.deuceRule === 'star' && state.deuceCount >= 2);
  if (pRec === 3 && pSrv < 3) return true;
  if (pRec >= 3 && pSrv >= 3) {
    if (isGold && pRec === pSrv) return true;
    if (pRec > pSrv) return true;
  }
  return false;
}

function isGoldenPointNow() {
  if (!state || state.inTieBreak || state.inSuperTB) return false;
  const isGold = (state.deuceRule === 'golden') || (state.deuceRule === 'star' && state.deuceCount >= 2);
  return isGold && state.pts[0] >= 3 && state.pts[0] === state.pts[1];
}

// Golpes que se pueden anotar, cada uno con su dibujo y la zona donde se juega si no se marca a mano
// (R = red / volea, T = transición, F = fondo). "group" es el total por familia de versiones anteriores,
// que siguen usando las estadísticas y la ficha.
const SHOT_CATALOG = [
  { id: 'Volea', label: 'Volea', hint: 'En la red, sin bote', icon: 'shot-volea', zone: 'R', group: 'Volea' },
  { id: 'Remate', label: 'Remate', hint: 'Por arriba, definitivo', icon: 'shot-remate', zone: 'R', group: 'Remate' },
  { id: 'Dejada', label: 'Dejada', hint: 'Corta, junto a la red', icon: 'shot-dejada', zone: 'R', group: 'Dejada' },
  { id: 'Bandeja', label: 'Bandeja', hint: 'Por alto, cortada', icon: 'shot-bandeja', zone: 'T', group: 'Bandeja/Víbora' },
  { id: 'Víbora', label: 'Víbora', hint: 'Por alto, con efecto', icon: 'shot-vibora', zone: 'T', group: 'Bandeja/Víbora' },
  { id: 'Chiquita', label: 'Chiquita', hint: 'Baja, a los pies', icon: 'shot-chiquita', zone: 'T', group: 'Chiquita' },
  { id: 'Golpe de fondo', label: 'Golpe de fondo', hint: 'Drive o revés atrás', icon: 'shot-fondo', zone: 'F', group: 'Fondo/Bajada' },
  { id: 'Bajada de pared', label: 'Bajada de pared', hint: 'Tras el cristal', icon: 'shot-bajada', zone: 'F', group: 'Fondo/Bajada' },
  { id: 'Globo', label: 'Globo', hint: 'Por encima del rival', icon: 'shot-globo', zone: 'F', group: 'Globo' },
  { id: 'Resto', label: 'Resto', hint: 'Devolución del saque', icon: 'shot-resto', zone: 'F', group: 'Resto' },
  { id: 'Saque Directo', label: 'Saque directo', hint: 'Punto con el saque', icon: 'shot-saque', zone: 'F', group: 'Saque Directo', serveOnly: true, winnerOnly: true }
];
const SHOT_ZONE_NAMES = { R: 'En la red', T: 'Transición', F: 'Fondo' };
const SHOT_BY_ID = Object.fromEntries(SHOT_CATALOG.map(s => [s.id, s]));

const SHOT_DEFAULT_ZONE = {
  ...Object.fromEntries(SHOT_CATALOG.map(s => [s.id, s.zone])),
  // Nombres de versiones anteriores
  'Bandeja/Víbora': 'T', 'Fondo/Bajada': 'F', 'Red': 'R', 'Fondo': 'F', 'Defensa': 'F', 'Winner': null, 'Error No Forzado': null
};

function recordAction(type, shotName, zoneOverride = null) {
  if (!state || state.matchOver || selectedSlot === null) return;
  cloneStateForUndo();
  vibrate(18);
  const p = state.players[selectedSlot];
  const sIdx = state.currentSet;
  const zone = zoneOverride || getModalZone(shotName, p);
  const meta = { by: selectedSlot, n: p.name, t: type, sh: shotName, z: zone.z, l: zone.l };

  // Winners por golpe (y por familia, para las estadísticas de siempre); errores por golpe aparte
  const shot = SHOT_BY_ID[shotName];
  if (type === 'W' && shotName !== 'Winner') {
    p.shots = p.shots || {};
    p.shots[shotName] = (p.shots[shotName] || 0) + 1;
    if (shot && shot.group !== shotName) p.shots[shot.group] = (p.shots[shot.group] || 0) + 1;
  } else if (shot) {
    p.errShots = p.errShots || {};
    p.errShots[shotName] = (p.errShots[shotName] || 0) + 1;
  }

  if (type === 'W') {
    p.W++;
    p.setStats[sIdx].W++;
    p.streak++;
    p.maxStreak = Math.max(p.maxStreak || 0, p.streak);
    if (shotName === 'Saque Directo') p.aces++;
    state.players.forEach((other, i) => { if (i !== selectedSlot) other.streak = 0; });
    scorePointForTeam(p.pair, `${p.name.split(' ')[0]} W`, meta);
  } else if (type === 'ENF') {
    p.ENF++;
    p.setStats[sIdx].ENF++;
    p.streak = 0;
    scorePointForTeam(1 - p.pair, `${p.name.split(' ')[0]} ENF`, meta);
  } else if (type === 'EF') {
    p.EF++;
    p.setStats[sIdx].EF++;
    p.streak = 0;
    scorePointForTeam(1 - p.pair, `${p.name.split(' ')[0]} EF`, meta);
  }

  closeModal();
  afterPointScored();
}

function addNeutralPoint(teamIdx) {
  if (!state || state.matchOver) return;
  cloneStateForUndo();
  vibrate(15);
  scorePointForTeam(teamIdx, `Punto P${teamIdx + 1}`, { by: -1, t: 'N' });
  afterPointScored();
}

function afterPointScored() {
  // Probabilidad de victoria tras el punto (se guarda en el punto para el gráfico del partido)
  if (state.points && state.points.length) {
    state.wp = currentWinProb(state);
    state.points[state.points.length - 1].wp = state.wp;
  }
  persistActiveMatchState();
  updateUI();
  if (state.lastEvent) celebrateEvent(state.lastEvent); else fxSound('point');
  announceScore();
}

function handleServeFault() {
  if (!state || state.matchOver) return;
  cloneStateForUndo();
  vibrate(20);
  const srv = state.players[state.serverIdx];
  if (state.serveNumber === 1) {
    state.serveNumber = 2;
    showToast(`2.º saque para ${srv.name}`);
  } else {
    srv.df++;
    srv.ENF++;
    srv.setStats[state.currentSet].ENF++;
    srv.streak = 0;
    showToast(`Doble falta de ${srv.name}`);
    scorePointForTeam(1 - srv.pair, `${srv.name.split(' ')[0]} DF`, { by: state.serverIdx, n: srv.name, t: 'DF', sh: 'Doble falta' });
    afterPointScored();
    return;
  }
  persistActiveMatchState();
  updateUI();
}

function scorePointForTeam(winningTeam, shortTag, meta = {}) {
  // Registro punto a punto: alimenta el mapa de calor, los momentos clave y el análisis del entrenador
  if (!state.points) state.points = [];
  state.points.push({
    s: state.currentSet,
    by: meta.by ?? -1,
    n: meta.n || null,
    t: meta.t || 'N',
    sh: meta.sh || null,
    z: meta.z || null,
    l: meta.l || null,
    w: winningTeam,
    sv: state.serverIdx,
    sn: state.serveNumber,
    bp: isBreakPointSituation(),
    gp: isGoldenPointNow(),
    tb: state.inTieBreak || state.inSuperTB,
    at: state.elapsedSec,
    svn: state.players[state.serverIdx] ? state.players[state.serverIdx].name : null,
    g: [...state.sets[state.currentSet]],
    pl: [formatPointLabel(0), formatPointLabel(1)]
  });
  state.lastEvent = null;
  state.serveNumber = 1;
  const prevMom = state.momentum[state.momentum.length - 1] || 0;
  state.momentum.push(winningTeam === 0 ? prevMom + 1 : prevMom - 1);

  state.pts[winningTeam]++;

  if (state.inSuperTB) {
    state.gamePointLog.push(`${state.pts[0]}-${state.pts[1]} (${shortTag})`);
    const totalPts = state.pts[0] + state.pts[1];
    if (totalPts % 2 === 1) state.serverIdx = nextServer(state.serverIdx);
    if (totalPts > 0 && totalPts % 6 === 0) showToast('Cambio de lado (6 puntos)');
    if (state.pts[winningTeam] >= 10 && (state.pts[winningTeam] - state.pts[1 - winningTeam]) >= 2) {
      // El súper tie-break se apunta con sus puntos (p. ej. 10-8) para que cuente como set ganado
      state.sets[state.currentSet] = [...state.pts];
      winSet(winningTeam);
    }
    return;
  }

  if (state.inTieBreak) {
    state.gamePointLog.push(`${state.pts[0]}-${state.pts[1]} (${shortTag})`);
    const totalPts = state.pts[0] + state.pts[1];
    if (totalPts % 2 === 1) state.serverIdx = nextServer(state.serverIdx);
    if (totalPts > 0 && totalPts % 6 === 0) showToast('Cambio de lado (6 puntos)');
    if (state.pts[winningTeam] >= 7 && (state.pts[winningTeam] - state.pts[1 - winningTeam]) >= 2) {
      state.sets[state.currentSet][winningTeam]++;
      // Tras el tie-break empieza sacando la pareja que restó el primer punto del tie-break
      if (state.tbFirstServer !== undefined && state.tbFirstServer !== null) state.serverIdx = nextServer(state.tbFirstServer);
      state.tbFirstServer = null;
      winSet(winningTeam);
    }
    return;
  }

  const pW = state.pts[winningTeam];
  const pL = state.pts[1 - winningTeam];

  const useGoldenNow = (state.deuceRule === 'golden') || (state.deuceRule === 'star' && state.deuceCount >= 2);

  if (pW >= 4) {
    if (useGoldenNow && pL === 3) {
      winGame(winningTeam);
      return;
    }
    if ((pW - pL) >= 2) {
      winGame(winningTeam);
      return;
    }
    if (pW === pL && pW >= 4) {
      state.pts[0] = 3;
      state.pts[1] = 3;
      state.deuceCount++;
    }
  }

  state.gamePointLog.push(`${formatPointLabel(0)}-${formatPointLabel(1)} (${shortTag})`);
}

function winGame(winningTeam) {
  const sIdx = state.currentSet;
  state.sets[sIdx][winningTeam]++;
  state.pts = [0, 0];
  state.deuceCount = 0;
  state.gamePointLog = [];
  state.serverIdx = nextServer(state.serverIdx);

  const gW = state.sets[sIdx][winningTeam];
  const gL = state.sets[sIdx][1 - winningTeam];
  const totalGamesInSet = gW + gL;
  state.lastEvent = { kind: 'game', pair: winningTeam };

  if (gW === 6 && gL === 6) {
    state.inTieBreak = true;
    state.tbFirstServer = state.serverIdx;
    showToast('6-6 · ¡Comienza el Tie-Break!');
  } else if ((gW >= 6 && (gW - gL) >= 2) || gW === 7) {
    winSet(winningTeam);
  } else if (totalGamesInSet % 2 === 1) {
    showToast('Cambio de lado');
  }
}

function winSet(winningTeam) {
  state.pts = [0, 0];
  state.inTieBreak = false;
  state.inSuperTB = false;
  state.deuceCount = 0;
  state.gamePointLog = [];
  state.lastEvent = { kind: 'set', pair: winningTeam };

  let setsWon0 = 0, setsWon1 = 0;
  for (let i = 0; i <= state.currentSet; i++) {
    if (state.sets[i][0] > state.sets[i][1]) setsWon0++;
    else if (state.sets[i][1] > state.sets[i][0]) setsWon1++;
  }

  if (setsWon0 === 2 || setsWon1 === 2) {
    state.matchOver = true;
    state.winnerPair = setsWon0 === 2 ? 0 : 1;
    state.lastEvent = { kind: 'match', pair: state.winnerPair };
    saveMatchToHistory(false);
    persistActiveMatchState();
    showToast(`¡Partido finalizado! Guardado en Estadísticas e Historial`);
  } else if (state.currentSet < 2) {
    state.currentSet++;
    if (state.currentSet === 2 && state.thirdSetRule === 'supertb') {
      state.inSuperTB = true;
      showToast('3.er Set: ¡Súper Tie-Break a 10 puntos!');
    } else {
      showToast(`Comienza el Set ${state.currentSet + 1}`);
    }
  }
}

function swapSides(pairIdx) {
  if (!state) return;
  vibrate(15);
  const i0 = pairIdx === 0 ? 0 : 2;
  const i1 = pairIdx === 0 ? 1 : 3;
  const temp = state.players[i0];
  state.players[i0] = state.players[i1];
  state.players[i1] = temp;
  state.players[i0].side = FIXED_COURT_SIDES[i0];
  state.players[i1].side = FIXED_COURT_SIDES[i1];
  if (state.serverIdx === i0) state.serverIdx = i1;
  else if (state.serverIdx === i1) state.serverIdx = i0;
  persistActiveMatchState();
  updateUI();
}

function cycleServerManual() {
  if (!state) return;
  state.serverIdx = (state.serverIdx + 1) % 4;
  // Antes del primer punto, cambiar el sacador también cambia qué pareja abre el orden de saque
  if (!state.points || !state.points.length) state.firstServePair = state.serverIdx < 2 ? 0 : 1;
  persistActiveMatchState();
  updateUI();
}

function toggleSuperTBHot() {
  if (!state) return;
  state.thirdSetRule = state.thirdSetRule === 'supertb' ? 'normal' : 'supertb';
  if (state.currentSet === 2 && state.sets[2][0] === 0 && state.sets[2][1] === 0) {
    state.inSuperTB = (state.thirdSetRule === 'supertb');
  }
  state.wp = currentWinProb(state);
  persistActiveMatchState();
  updateUI();
}

function finishMatchManually() {
  if (!state) return;
  vibrate([20, 40]);
  let s0 = 0, s1 = 0;
  state.sets.forEach(st => {
    if (st[0] > st[1]) s0++;
    else if (st[1] > st[0]) s1++;
  });
  if (s0 === s1) {
    const tot0 = state.sets.reduce((acc, s) => acc + s[0], 0);
    const tot1 = state.sets.reduce((acc, s) => acc + s[1], 0);
    state.winnerPair = tot0 >= tot1 ? 0 : 1;
  } else {
    state.winnerPair = s0 > s1 ? 0 : 1;
  }
  state.matchOver = true;
  if (state.wp !== undefined) state.wp = state.winnerPair === 0 ? 1 : 0;
  saveMatchToHistory(false);
  persistActiveMatchState();
  updateUI();
  showToast('Partido finalizado y guardado en estadísticas');
  fxConfetti({ colors: state.winnerPair ? ['#FF2E54', '#FFE066', '#FFFFFF'] : ['#00F0FF', '#D4FF2A', '#FFFFFF'], count: 140 });
  clearTimeout(matchEndTimer);
  matchEndTimer = setTimeout(openMatchEnd, 700);
}

function saveMatchToHistory(manualClick = false) {
  if (!state) return;
  const existingIdx = matchHistory.findIndex(m => m.id === state.id);
  const snapshot = JSON.parse(JSON.stringify(state));
  if (existingIdx !== -1) {
    matchHistory[existingIdx] = snapshot;
  } else {
    matchHistory.unshift(snapshot);
  }
  state.savedToHistory = true;
  // Si el partido pertenece a un torneo, su resultado se anota solo en el cuadro
  if (state.link && state.matchOver) applyLinkedMatchResult(state);
  saveDB();
  if (manualClick) showToast('Partido guardado en Historial y Estadísticas');
}
