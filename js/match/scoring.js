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

function recordAction(type, shotName) {
  if (!state || state.matchOver || selectedSlot === null) return;
  cloneStateForUndo();
  vibrate(18);
  const p = state.players[selectedSlot];
  const sIdx = state.currentSet;

  if (p.shots && p.shots[shotName] !== undefined) {
    p.shots[shotName]++;
  }

  if (type === 'W') {
    p.W++;
    p.setStats[sIdx].W++;
    p.streak++;
    if (shotName === 'Saque Directo') p.aces++;
    state.players.forEach((other, i) => { if (i !== selectedSlot) other.streak = 0; });
    scorePointForTeam(p.pair, `${p.name.split(' ')[0]} W`);
  } else if (type === 'ENF') {
    p.ENF++;
    p.setStats[sIdx].ENF++;
    p.streak = 0;
    scorePointForTeam(1 - p.pair, `${p.name.split(' ')[0]} ENF`);
  } else if (type === 'EF') {
    p.EF++;
    p.setStats[sIdx].EF++;
    p.streak = 0;
    scorePointForTeam(1 - p.pair, `${p.name.split(' ')[0]} EF`);
  }

  closeModal();
  persistActiveMatchState();
  updateUI();
}

function addNeutralPoint(teamIdx) {
  if (!state || state.matchOver) return;
  cloneStateForUndo();
  vibrate(15);
  scorePointForTeam(teamIdx, `P${teamIdx + 1} +Pto`);
  persistActiveMatchState();
  updateUI();
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
    scorePointForTeam(1 - srv.pair, `${srv.name.split(' ')[0]} DF`);
  }
  persistActiveMatchState();
  updateUI();
}

function scorePointForTeam(winningTeam, shortTag) {
  state.serveNumber = 1;
  const prevMom = state.momentum[state.momentum.length - 1] || 0;
  state.momentum.push(winningTeam === 0 ? prevMom + 1 : prevMom - 1);

  state.pts[winningTeam]++;

  if (state.inSuperTB) {
    state.gamePointLog.push(`${state.pts[0]}-${state.pts[1]} (${shortTag})`);
    const totalPts = state.pts[0] + state.pts[1];
    if (totalPts % 2 === 1) state.serverIdx = (state.serverIdx + 1) % 4;
    if (totalPts > 0 && totalPts % 6 === 0) showToast('🔄 Cambio de lado en pista (6 ptos)');
    if (state.pts[winningTeam] >= 10 && (state.pts[winningTeam] - state.pts[1 - winningTeam]) >= 2) {
      winSet(winningTeam);
    }
    return;
  }

  if (state.inTieBreak) {
    state.gamePointLog.push(`${state.pts[0]}-${state.pts[1]} (${shortTag})`);
    const totalPts = state.pts[0] + state.pts[1];
    if (totalPts % 2 === 1) state.serverIdx = (state.serverIdx + 1) % 4;
    if (totalPts > 0 && totalPts % 6 === 0) showToast('🔄 Cambio de lado en pista (6 ptos)');
    if (state.pts[winningTeam] >= 7 && (state.pts[winningTeam] - state.pts[1 - winningTeam]) >= 2) {
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
  state.serverIdx = (state.serverIdx + 1) % 4;

  const gW = state.sets[sIdx][winningTeam];
  const gL = state.sets[sIdx][1 - winningTeam];
  const totalGamesInSet = gW + gL;

  if (gW === 6 && gL === 6) {
    state.inTieBreak = true;
    showToast('6-6 · ¡Comienza el Tie-Break!');
  } else if ((gW >= 6 && (gW - gL) >= 2) || gW === 7) {
    winSet(winningTeam);
  } else if (totalGamesInSet % 2 === 1) {
    showToast('🔄 Juego impar completado · Cambio de lado en pista');
  }
}

function winSet(winningTeam) {
  state.pts = [0, 0];
  state.inTieBreak = false;
  state.inSuperTB = false;
  state.deuceCount = 0;
  state.gamePointLog = [];

  let setsWon0 = 0, setsWon1 = 0;
  for (let i = 0; i <= state.currentSet; i++) {
    if (state.sets[i][0] > state.sets[i][1]) setsWon0++;
    else if (state.sets[i][1] > state.sets[i][0]) setsWon1++;
  }

  if (setsWon0 === 2 || setsWon1 === 2) {
    state.matchOver = true;
    state.winnerPair = setsWon0 === 2 ? 0 : 1;
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
  persistActiveMatchState();
  updateUI();
}

function toggleSuperTBHot() {
  if (!state) return;
  state.thirdSetRule = state.thirdSetRule === 'supertb' ? 'normal' : 'supertb';
  if (state.currentSet === 2 && state.sets[2][0] === 0 && state.sets[2][1] === 0) {
    state.inSuperTB = (state.thirdSetRule === 'supertb');
  }
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
  saveMatchToHistory(false);
  persistActiveMatchState();
  updateUI();
  showToast('Partido finalizado y guardado en estadísticas');
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
  saveDB();
  if (manualClick) showToast('Partido guardado en Historial y Estadísticas');
}
