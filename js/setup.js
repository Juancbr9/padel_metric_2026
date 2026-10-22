function clearSetupCourt() {
  vibrate(15);
  setupConfig.slots = ['GEN_0', 'GEN_1', 'GEN_2', 'GEN_3'];
  renderSetupCourt();
  showToast('Pista vaciada');
}

function updatePreMatchProbability() {
  const { statsMap } = computeAllPlayersStats();
  // Probabilidad de victoria según el ELO medio de cada pareja
  function getStrength(slotVal) {
    if (!slotVal || slotVal.startsWith('GEN_') || !statsMap[slotVal]) return ELO_START;
    return statsMap[slotVal].elo;
  }

  const p1Str = (getStrength(setupConfig.slots[0]) + getStrength(setupConfig.slots[1])) / 2;
  const p2Str = (getStrength(setupConfig.slots[2]) + getStrength(setupConfig.slots[3])) / 2;
  const expected = 1 / (1 + Math.pow(10, (p2Str - p1Str) / 400));
  const p1Prob = Math.min(95, Math.max(5, Math.round(expected * 100)));
  const p2Prob = 100 - p1Prob;

  const t1 = document.getElementById('prob-p1-txt');
  const t2 = document.getElementById('prob-p2-txt');
  const b1 = document.getElementById('prob-bar-1');
  const b2 = document.getElementById('prob-bar-2');
  if (t1 && t2 && b1 && b2) {
    t1.innerText = `P1 ${p1Prob}%`;
    t2.innerText = `P2 ${p2Prob}%`;
    b1.style.width = `${p1Prob}%`;
    b2.style.width = `${p2Prob}%`;
  }
}

function balancePairsAutomatically() {
  const assigned = setupConfig.slots.filter(s => !s.startsWith('GEN_'));
  if (assigned.length < 4) {
    showToast('Convoca a 4 jugadores de la BD para equilibrar las parejas');
    return;
  }
  vibrate([20, 30]);
  const { statsMap } = computeAllPlayersStats();
  function ratingOf(name) {
    const st = statsMap[name];
    return st ? st.elo : ELO_START;
  }

  const p = [...setupConfig.slots];
  const combos = [
    [p[0], p[1], p[2], p[3]],
    [p[0], p[2], p[1], p[3]],
    [p[0], p[3], p[1], p[2]]
  ];
  let bestCombo = combos[0];
  let minDiff = Infinity;

  combos.forEach(c => {
    const d = Math.abs((ratingOf(c[0]) + ratingOf(c[1])) - (ratingOf(c[2]) + ratingOf(c[3])));
    if (d < minDiff) {
      minDiff = d;
      bestCombo = c;
    }
  });

  setupConfig.slots = bestCombo;
  renderSetupCourt();
  showToast('Parejas equilibradas según su ELO');
}

function renderSetupCourt() {
  const pairColors = ['#00F0FF', '#00F0FF', '#FF2E54', '#FF2E54'];
  for (let i = 0; i < 4; i++) {
    const val = setupConfig.slots[i];
    if (!val.startsWith('GEN_') && !dbPlayers.includes(val)) {
      setupConfig.slots[i] = `GEN_${i}`;
    }
    const currentVal = setupConfig.slots[i];
    const isGeneric = currentVal.startsWith('GEN_');
    const isSrv = (setupConfig.initialServer === i);
    const card = document.getElementById(`setup-slot-${i}`);
    if (!card) continue;

    const prof = !isGeneric ? ensureProfile(currentVal) : null;
    const clubLine = (prof && prof.club) ? `<div class="lineup-club-sub">${prof.club}</div>` : '';
    const avClass = i < 2 ? 'avatar-p1' : 'avatar-p2';
    const avatarNode = renderAvatarHTML(currentVal, avClass, '', isGeneric, `J${i+1}`);

    card.className = `lineup-slot-card ${!isGeneric ? 'assigned' : ''} ${isSrv ? 'initial-srv' : ''}`;
    card.innerHTML = `
      <div class="lineup-slot-top">
        <span class="lineup-pos-tag" style="color:${pairColors[i]};">P${i<2?1:2} · ${FIXED_COURT_SIDES[i]}</span>
        <button type="button" class="srv-toggle-btn ${isSrv ? 'active' : ''}" onclick="event.stopPropagation(); selectInitialServer(${i});" title="Marcar como sacador inicial">
          <svg class="icon" style="width:12px;height:12px;"><use href="#i-ball"/></svg>
          ${isSrv ? 'SACA' : ''}
        </button>
      </div>
      <div class="lineup-player-row">
        ${avatarNode}
        <div style="min-width:0;flex:1;">
          <div class="lineup-player-label ${isGeneric ? 'placeholder' : ''}">
            ${isGeneric ? `Jugador ${i+1}` : currentVal}
          </div>
          ${clubLine}
        </div>
      </div>
    `;
  }

  const deuceLabels = { adv: 'Ventaja', star: 'Star Point', golden: 'Punto de Oro' };
  const thirdLabels = { normal: '3 Sets', supertb: 'Súper TB' };
  const inputLabels = { tap: 'Toque', swipe: 'Gestos' };
  const sumEl = document.getElementById('rules-summary-text');
  if (sumEl) {
    sumEl.innerText = `${thirdLabels[setupConfig.thirdSetRule]} · ${deuceLabels[setupConfig.deuceRule]} · ${inputLabels[setupConfig.inputMode]}`;
  }

  updatePreMatchProbability();
  checkSavedActiveMatch();
}

function selectInitialServer(slotIdx) {
  vibrate(12);
  setupConfig.initialServer = slotIdx;
  renderSetupCourt();
}

function openRulesModal() {
  vibrate(12);
  document.getElementById('rules-modal').classList.remove('hidden');
}

function closeRulesModal() {
  document.getElementById('rules-modal').classList.add('hidden');
}

function selectDeuceRule(rule) {
  vibrate(10);
  setupConfig.deuceRule = rule;
  ['adv', 'star', 'golden'].forEach(r => {
    document.getElementById(`deuce-${r}`)?.classList.toggle('active', r === rule);
  });
  renderSetupCourt();
}

function selectThirdRule(rule) {
  vibrate(10);
  setupConfig.thirdSetRule = rule;
  ['normal', 'supertb'].forEach(r => {
    document.getElementById(`third-${r}`)?.classList.toggle('active', r === rule);
  });
  renderSetupCourt();
}

function selectInputMode(mode) {
  vibrate(12);
  setupConfig.inputMode = mode;
  ['tap', 'swipe'].forEach(m => {
    document.getElementById(`inp-${m}`)?.classList.toggle('active', m === mode);
  });
  renderSetupCourt();
}
