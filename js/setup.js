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
    // Nombre grande (como en el marcador) y debajo el apellido y el club
    const parts = isGeneric ? [] : String(currentVal).trim().split(/\s+/);
    const surname = shortPlayerName(currentVal, setupConfig.slots.filter(s => !String(s).startsWith('GEN_')));
    const subLine = !isGeneric ? [parts.length > 1 ? parts.slice(1).join(' ') : '', prof && prof.club].filter(Boolean).join(' · ') : 'Toca para elegir';
    const clubLine = subLine ? `<div class="lineup-club-sub">${escapeHtml(subLine)}</div>` : '';
    const avClass = i < 2 ? 'avatar-p1' : 'avatar-p2';
    const avatarNode = renderAvatarHTML(currentVal, avClass, '', isGeneric, `J${i+1}`);

    card.className = `lineup-slot-card ${!isGeneric ? 'assigned' : ''} ${isSrv ? 'initial-srv' : ''}`;
    card.innerHTML = `
      <div class="lineup-slot-top">
        <span class="lineup-pos-tag ${i < 2 ? 'pair-a-txt' : 'pair-b-txt'}">Pareja ${i<2?1:2} · ${FIXED_COURT_SIDES[i].toLowerCase()}</span>
        <button type="button" class="srv-toggle-btn ${isSrv ? 'active' : ''}" onclick="event.stopPropagation(); selectInitialServer(${i});" title="Marcar como sacador inicial">
          <svg class="icon icon-xs"><use href="#i-ball"/></svg>
          ${isSrv ? 'Saca' : ''}
        </button>
      </div>
      <div class="lineup-player-row">
        ${avatarNode}
        <div class="u-min0 flex-1">
          <div class="lineup-player-label ${isGeneric ? 'placeholder' : ''}">
            ${isGeneric ? `Jugador ${i+1}` : escapeHtml(surname)}
          </div>
          ${clubLine}
        </div>
      </div>
    `;
  }

  renderSetupRules();
  updatePreMatchProbability();
  checkSavedActiveMatch();
}

// Reglas del partido a la vista (las mismas que la hoja de reglas): un segmentado por regla
function renderSetupRules() {
  const box = document.getElementById('setup-rules');
  if (!box) return;
  const seg = (opts, current, fn) => `<div class="ios-segmented cols-${opts.length}">${opts.map(([v, main]) =>
    `<button type="button" class="ios-seg-option ${v === current ? 'active' : ''}" onclick="${fn}('${v}')"><span class="opt-main">${main}</span></button>`).join('')}</div>`;
  box.innerHTML = `
    <div class="setup-rule"><div class="setup-rule-label">Al llegar a 40-40</div>
      ${seg([['adv', 'Ventaja'], ['star', 'Star point'], ['golden', 'Punto de oro']], setupConfig.deuceRule, 'selectDeuceRule')}</div>
    <div class="setup-rule"><div class="setup-rule-label">Si se llega a 1-1 en sets</div>
      ${seg([['normal', 'Tercer set'], ['supertb', 'Súper tie-break']], setupConfig.thirdSetRule, 'selectThirdRule')}</div>
    <div class="setup-rule"><div class="setup-rule-label">Al deslizar sobre un jugador</div>
      ${seg([['tap', 'Elegir el golpe'], ['swipe', 'Anotar al momento']], setupConfig.inputMode, 'selectInputMode')}</div>`;
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
