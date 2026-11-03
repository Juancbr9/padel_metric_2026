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

// Sortea las parejas entre los cuatro de la pista (los que no tienen ficha también se mueven)
function shuffleSetupPairs() {
  vibrate([10, 30]);
  const p = [...setupConfig.slots];
  for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  // Los huecos sin nombre conservan su número de posición
  setupConfig.slots = p.map((s, i) => (s.startsWith('GEN_') ? `GEN_${i}` : s));
  renderSetupCourt();
  showToast('Parejas sorteadas');
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
  const named = setupConfig.slots.filter(s => !String(s).startsWith('GEN_'));
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
    // Foto (o iniciales), el nombre grande y el apellido debajo, como en el marcador
    const parts = isGeneric ? [] : String(currentVal).trim().split(/\s+/);
    const first = isGeneric ? `Jugador ${i + 1}` : shortPlayerName(currentVal, named);
    const sub = isGeneric ? 'Toca para elegir' : (parts.slice(1).join(' ') || ensureProfile(currentVal).club || '');
    card.className = `np-slot ${i < 2 ? 'a' : 'b'} ${isGeneric ? 'empty' : 'assigned'} ${isSrv ? 'initial-srv' : ''}`;
    card.innerHTML = `
      <span class="np-side">${FIXED_COURT_SIDES[i]}</span>
      <button type="button" class="np-serve ${isSrv ? 'active' : ''}" onclick="event.stopPropagation(); selectInitialServer(${i});" aria-label="Saca primero" title="Saca primero"><svg class="icon"><use href="#i-ball"/></svg>${isSrv ? '<span>Saca</span>' : ''}</button>
      <span class="np-av">${isGeneric ? `<span class="np-av-empty"><svg class="icon"><use href="#i-plus"/></svg></span>` : renderAvatarHTML(currentVal, i < 2 ? 'avatar-p1' : 'avatar-p2')}</span>
      <strong class="np-name">${escapeHtml(first)}</strong>
      <small class="np-sub">${escapeHtml(sub)}</small>`;
  }
  // Rótulo de cada pareja con su nivel medio
  const { statsMap } = computeAllPlayersStats();
  [0, 1].forEach(k => {
    const el = document.getElementById(`np-pair-${k ? 'b' : 'a'}`);
    if (!el) return;
    const names = setupConfig.slots.slice(k * 2, k * 2 + 2).filter(s => !s.startsWith('GEN_'));
    const elos = names.map(n => (statsMap[n] ? statsMap[n].elo : ELO_START));
    el.innerHTML = `<i></i><strong>Pareja ${k + 1}</strong><span>${names.length ? `ELO medio ${Math.round(elos.reduce((a, b) => a + b, 0) / elos.length)}` : ''}</span>`;
  });
  const sum = document.getElementById('np-summary');
  if (sum) {
    const pn = k => setupConfig.slots.slice(k * 2, k * 2 + 2).map((s, j) => (s.startsWith('GEN_') ? `J${k * 2 + j + 1}` : shortPlayerName(s, named))).join(' / ');
    sum.textContent = named.length ? `${pn(0)} contra ${pn(1)}` : '';
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
      ${seg([['adv', 'Ventaja'], ['star', 'Star point'], ['golden', 'Punto de oro']], setupConfig.deuceRule, 'selectDeuceRule')}
      <div class="setup-rule-hint">${{ adv: 'Hay que ganar dos puntos seguidos.', star: 'Dos ventajas como mucho; a la tercera igualada, un punto decide.', golden: 'Un solo punto decide el juego; la pareja que resta elige el lado.' }[setupConfig.deuceRule] || ''}</div></div>
    <div class="setup-rule"><div class="setup-rule-label">Si se llega a 1-1 en sets</div>
      ${seg([['normal', 'Tercer set'], ['supertb', 'Súper tie-break']], setupConfig.thirdSetRule, 'selectThirdRule')}
      ${setupConfig.thirdSetRule === 'supertb' ? '<div class="setup-rule-hint">Un desempate a 10 puntos con diferencia de dos.</div>' : ''}</div>
    <div class="setup-rule"><div class="setup-rule-label">Cómo anotar</div>
      ${seg(INPUT_MODES, setupConfig.inputMode, 'selectInputMode')}
      <div class="setup-rule-hint">${setupConfig.inputMode === 'tap' ? 'Eliges el golpe y marcas en la pista desde dónde golpeó: el mapa de calor es exacto.' : 'Desliza hacia arriba para un winner y hacia abajo para un error. Lo más rápido.'}</div></div>
    ${setupConfig.inputMode === 'tap' ? `<div class="setup-rule"><div class="setup-rule-label">Ves el partido desde</div>
      ${seg(COURT_VIEWS.map(([v, t]) => [v, t.replace('Detrás de la pareja ', 'Detrás de P').replace('Desde el lateral', 'El lateral')]), setupConfig.view || 'p2', 'selectSetupView')}</div>` : ''}`;
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
  renderSetupRules();
}
