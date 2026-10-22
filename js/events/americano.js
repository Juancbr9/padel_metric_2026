// ==========================================================
// AMERICANO Y MEXICANO (INDIVIDUAL, PAREJAS FIJAS Y MIXTO)
// ==========================================================
const AMERICANO_FORMATS = {
  americano: { main: 'Americano', sub: 'Cambias de pareja cada ronda' },
  fixed: { main: 'Americano por parejas', sub: 'Parejas fijas, todos contra todos' },
  mexicano: { main: 'Mexicano', sub: 'Cada ronda se empareja por clasificación' },
  mixicano: { main: 'Mexicano mixto', sub: 'Siempre hombre + mujer' },
  pozo: { main: 'Pozo', sub: 'Ganadores suben de pista, perdedores bajan' }
};
// Tipos de partido: cómo se juega y se anota cada cruce
const MATCH_TYPES = {
  points: { main: 'A puntos', sub: 'Se reparten X puntos', values: [16, 21, 24, 32], unit: 'puntos', fixedTotal: true },
  games: { main: 'Juegos fijos', sub: 'Se juegan X juegos', values: [6, 8, 10, 12], unit: 'juegos', fixedTotal: true },
  time: { main: 'Por tiempo', sub: 'Cuentan los juegos', values: [10, 12, 15, 20], unit: 'juegos', valueUnit: 'min' },
  set: { main: 'A un set', sub: 'Con tie-break', values: [4, 6, 9], unit: 'juegos' }
};
const SET_NAMES = { 4: 'Set corto a 4', 6: 'Set completo a 6', 9: 'Pro set a 9' };

function matchTypeOf(ev) {
  return ev.matchType || { kind: 'points', value: ev.points || 24 };
}

function matchTypeLabel(mt) {
  if (mt.kind === 'points') return `a ${mt.value} puntos`;
  if (mt.kind === 'games') return `${mt.value} juegos fijos`;
  if (mt.kind === 'time') return `${mt.value} minutos`;
  return SET_NAMES[mt.value] ? SET_NAMES[mt.value].toLowerCase() : `set a ${mt.value}`;
}

function scoreUnit(ev) {
  return MATCH_TYPES[matchTypeOf(ev).kind].unit;
}

// Un set es válido si alguien llega a X con 2 de ventaja, o gana X+1 a X-1 / X+1 a X (tie-break)
function validSetScore(a, b, target) {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi === target && lo <= target - 2) || (hi === target + 1 && (lo === target - 1 || lo === target));
}
let aView = { mode: 'list', aid: null, tab: 'rounds' };

function findAmericano(aid) {
  return americanos.find(a => a.id === aid);
}

function isTeamFormat(ev) {
  return ev.format === 'fixed';
}

// ---------- Generación de rondas ----------
function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function eventHistoryCounts(ev) {
  const partner = {}, opp = {}, rest = {};
  ev.players.forEach(p => { rest[p] = 0; });
  ev.rounds.forEach(r => {
    (r.rest || []).forEach(p => { rest[p] = (rest[p] || 0) + 1; });
    r.matches.forEach(m => {
      partner[pairKey(m.a[0], m.a[1])] = (partner[pairKey(m.a[0], m.a[1])] || 0) + 1;
      partner[pairKey(m.b[0], m.b[1])] = (partner[pairKey(m.b[0], m.b[1])] || 0) + 1;
      m.a.forEach(x => m.b.forEach(y => { opp[pairKey(x, y)] = (opp[pairKey(x, y)] || 0) + 1; }));
    });
  });
  return { partner, opp, rest };
}

// Descansan los que menos han descansado (y nunca dos rondas seguidas si se puede)
function pickResting(ev, pool, needed) {
  if (needed <= 0) return [];
  const { rest } = eventHistoryCounts(ev);
  const last = ev.rounds.length ? (ev.rounds[ev.rounds.length - 1].rest || []) : [];
  return shuffleArray(pool)
    .sort((a, b) => (rest[a] - rest[b]) || (last.includes(a) - last.includes(b)))
    .slice(0, needed);
}

function buildAmericanoRound(ev) {
  const active = ev.courts * 4;
  const resting = pickResting(ev, ev.players, ev.players.length - active);
  const playing = ev.players.filter(p => !resting.includes(p));
  const { partner, opp } = eventHistoryCounts(ev);
  let best = null, bestCost = Infinity;
  // Búsqueda aleatoria: minimiza repetir compañero (pesa mucho) y rival
  for (let tries = 0; tries < 600; tries++) {
    const s = shuffleArray(playing);
    let cost = 0;
    const matches = [];
    for (let c = 0; c < ev.courts; c++) {
      const [p1, p2, p3, p4] = s.slice(c * 4, c * 4 + 4);
      cost += (partner[pairKey(p1, p2)] || 0) * 10 + (partner[pairKey(p3, p4)] || 0) * 10;
      [p1, p2].forEach(x => [p3, p4].forEach(y => { cost += (opp[pairKey(x, y)] || 0) * 2; }));
      matches.push({ court: c + 1, a: [p1, p2], b: [p3, p4], sa: null, sb: null });
    }
    if (cost < bestCost) { bestCost = cost; best = matches; }
    if (cost === 0) break;
  }
  return { matches: best, rest: resting };
}

function rankedForMexicano(ev, pool) {
  const st = americanoStandings(ev);
  const elos = eloMap();
  const pos = {};
  st.forEach((r, i) => { r.members.forEach(m => { pos[m] = i; }); });
  return [...pool].sort((a, b) => ev.rounds.length
    ? (pos[a] ?? 999) - (pos[b] ?? 999)
    : eloOfName(b, elos) - eloOfName(a, elos));
}

function buildMexicanoRound(ev) {
  const active = ev.courts * 4;
  const resting = pickResting(ev, ev.players, ev.players.length - active);
  const ranked = rankedForMexicano(ev, ev.players.filter(p => !resting.includes(p)));
  const matches = [];
  for (let c = 0; c < ev.courts; c++) {
    const [p1, p2, p3, p4] = ranked.slice(c * 4, c * 4 + 4);
    // En cada pista: 1.º + 4.º contra 2.º + 3.º
    matches.push({ court: c + 1, a: [p1, p4], b: [p2, p3], sa: null, sb: null });
  }
  return { matches, rest: resting };
}

function buildMixicanoRound(ev) {
  const gender = p => (ensureProfile(p).gender === 'F' ? 'F' : 'M');
  const men = ev.players.filter(p => gender(p) === 'M');
  const women = ev.players.filter(p => gender(p) === 'F');
  const perSide = ev.courts * 2;
  const restM = pickResting(ev, men, men.length - perSide);
  const restW = pickResting(ev, women, women.length - perSide);
  const M = rankedForMexicano(ev, men.filter(p => !restM.includes(p)));
  const W = rankedForMexicano(ev, women.filter(p => !restW.includes(p)));
  const matches = [];
  for (let c = 0; c < ev.courts; c++) {
    matches.push({ court: c + 1, a: [M[2 * c], W[2 * c + 1]], b: [M[2 * c + 1], W[2 * c]], sa: null, sb: null });
  }
  return { matches, rest: [...restM, ...restW] };
}

// Parejas fijas: liga todos contra todos (método del círculo)
function buildFixedRounds(ev) {
  const ids = ev.teams.map((_, i) => i);
  if (ids.length % 2) ids.push(null);
  const n = ids.length;
  const rounds = [];
  for (let r = 0; r < n - 1 && rounds.length < ev.totalRounds; r++) {
    const matches = [], rest = [];
    let court = 1;
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i], b = ids[n - 1 - i];
      if (a === null || b === null) { rest.push(...ev.teams[a ?? b]); continue; }
      matches.push({ court: court++, a: [...ev.teams[a]], b: [...ev.teams[b]], sa: null, sb: null });
    }
    rounds.push({ matches, rest });
    ids.splice(1, 0, ids.pop());
  }
  return rounds;
}

// Pozo: la pista 1 es la más alta. Los ganadores suben una pista y los perdedores bajan;
// en cada pista se separan las dos parejas que llegan para formar parejas nuevas.
function buildPozoRound(ev) {
  const N = ev.courts;
  if (!ev.rounds.length) {
    const ranked = rankedForMexicano(ev, ev.players);
    const matches = [];
    for (let c = 0; c < N; c++) {
      const [p1, p2, p3, p4] = ranked.slice(c * 4, c * 4 + 4);
      matches.push({ court: c + 1, a: [p1, p4], b: [p2, p3], sa: null, sb: null });
    }
    return { matches, rest: [] };
  }
  const last = ev.rounds[ev.rounds.length - 1].matches;
  const incoming = Array.from({ length: N }, () => []);
  last.forEach(m => {
    const c = m.court - 1;
    const winners = m.sa > m.sb ? m.a : m.b;
    const losers = m.sa > m.sb ? m.b : m.a;
    incoming[Math.max(0, c - 1)].push(winners);
    incoming[Math.min(N - 1, c + 1)].push(losers);
  });
  const matches = incoming.map(([x, y], c) => ({ court: c + 1, a: [x[0], y[0]], b: [x[1], y[1]], sa: null, sb: null }));
  return { matches, rest: [] };
}

function generateNextRound(ev) {
  const round = ev.format === 'americano' ? buildAmericanoRound(ev)
    : ev.format === 'mixicano' ? buildMixicanoRound(ev)
    : ev.format === 'pozo' ? buildPozoRound(ev)
    : buildMexicanoRound(ev);
  ev.rounds.push(round);
}

// ---------- Clasificación ----------
function americanoStandings(ev) {
  const rows = {};
  const add = (key, members) => { rows[key] = rows[key] || { key, members, pts: 0, pj: 0, w: 0, d: 0, l: 0, diff: 0 }; return rows[key]; };
  if (isTeamFormat(ev)) ev.teams.forEach(tm => add(tm.join(' / '), tm));
  else ev.players.forEach(p => add(p, [p]));
  ev.rounds.forEach(r => r.matches.forEach(m => {
    if (m.sa === null || m.sb === null) return;
    [[m.a, m.sa, m.sb], [m.b, m.sb, m.sa]].forEach(([side, own, other]) => {
      const targets = isTeamFormat(ev) ? [add(side.join(' / '), side)] : side.map(p => add(p, [p]));
      targets.forEach(row => {
        row.pts += own; row.pj++; row.diff += own - other;
        if (own > other) row.w++; else if (own < other) row.l++; else row.d++;
      });
    });
  }));
  // A un set manda el número de partidos ganados; en el resto, los puntos o juegos sumados
  const byWins = matchTypeOf(ev).kind === 'set';
  const byPoints = Object.values(rows).sort((a, b) => byWins
    ? (b.w - a.w || b.diff - a.diff || b.pts - a.pts)
    : (b.pts - a.pts || b.diff - a.diff || b.w - a.w));
  if (ev.format !== 'pozo') return byPoints;
  // Pozo: manda la pista de la última ronda jugada (ganadores de la pista 1 primero)
  const lastDone = [...ev.rounds].reverse().find(roundComplete);
  if (!lastDone) return byPoints;
  const order = {};
  lastDone.matches.forEach(m => {
    const winners = m.sa > m.sb ? m.a : m.b;
    m.a.concat(m.b).forEach(p => { order[p] = (m.court - 1) * 2 + (winners.includes(p) ? 0 : 1); });
  });
  byPoints.forEach(r => { r.court = Math.floor((order[r.key] ?? 99) / 2) + 1; });
  return byPoints.sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99) || b.pts - a.pts);
}

function roundComplete(r) {
  return r.matches.every(m => m.sa !== null && m.sb !== null);
}

function updateAmericanoStatus(ev) {
  const done = ev.rounds.length >= ev.totalRounds && ev.rounds.every(roundComplete);
  ev.status = done ? 'finished' : 'active';
}

// ---------- Anotar resultados ----------
let scoreDraft = { a: 0, b: 0 };

function openAmericanoScore(aid, ri, mi) {
  const ev = findAmericano(aid);
  const m = ev.rounds[ri].matches[mi];
  const mt = matchTypeOf(ev);
  const head = `
    <div class="event-modal-title">Ronda ${ri + 1} · Pista ${m.court} · ${escapeHtml(matchTypeLabel(mt))}</div>
    <div class="result-teams">
      <div class="result-team a">${escapeHtml(m.a.join(' / '))}</div>
      <div class="result-vs">VS</div>
      <div class="result-team b">${escapeHtml(m.b.join(' / '))}</div>
    </div>`;
  const clear = m.sa !== null ? `<button class="btn-icon" style="width:100%;padding:11px;margin-top:10px;color:var(--coral);" onclick="saveAmericanoScore(${jsArg(aid)}, ${ri}, ${mi}, null)">Borrar resultado</button>` : '';

  if (MATCH_TYPES[mt.kind].fixedTotal) {
    // Total fijo: basta con elegir lo de una pareja. En el Pozo no puede haber empate.
    const buttons = Array.from({ length: mt.value + 1 }, (_, v) => (ev.format === 'pozo' && v * 2 === mt.value) ? '' :
      `<button type="button" class="score-pick ${m.sa === v ? 'on' : ''}" onclick="saveAmericanoScore(${jsArg(aid)}, ${ri}, ${mi}, ${v})">${v}<small>${mt.value - v}</small></button>`).join('');
    openEventModal(`${head}
      <div class="form-label">${MATCH_TYPES[mt.kind].unit === 'puntos' ? 'Puntos' : 'Juegos'} de ${escapeHtml(pairLabel(m.a))} · entre las dos parejas suman ${mt.value}</div>
      <div class="score-grid-pick">${buttons}</div>${clear}`);
    return;
  }

  scoreDraft = { a: m.sa ?? 0, b: m.sb ?? 0 };
  const hint = mt.kind === 'set'
    ? `Set a ${mt.value} juegos: hay que ganar con 2 de diferencia o en el tie-break (${mt.value + 1}-${mt.value}).`
    : `Anota los juegos que ha ganado cada pareja al acabar el tiempo.${ev.format === 'pozo' ? ' En el Pozo no puede haber empate.' : ''}`;
  openEventModal(`${head}
    <div class="score-steppers">
      ${['a', 'b'].map(side => `
        <div class="score-stepper ${side}">
          <button type="button" class="btn-icon" onclick="stepScoreDraft('${side}', 1)">+</button>
          <span id="score-draft-${side}">${scoreDraft[side]}</span>
          <button type="button" class="btn-icon" onclick="stepScoreDraft('${side}', -1)">−</button>
        </div>`).join('<div class="score-stepper-sep">–</div>')}
    </div>
    <div class="empty-note" style="padding:4px 0 10px;">${hint}</div>
    <button class="btn-volt" onclick="saveAmericanoScore(${jsArg(aid)}, ${ri}, ${mi}, scoreDraft.a, scoreDraft.b)">Guardar resultado</button>${clear}`);
}

function stepScoreDraft(side, delta) {
  scoreDraft[side] = Math.max(0, Math.min(99, scoreDraft[side] + delta));
  document.getElementById(`score-draft-${side}`).innerText = scoreDraft[side];
  vibrate(6);
}

function saveAmericanoScore(aid, ri, mi, v, vb) {
  const ev = findAmericano(aid);
  const m = ev.rounds[ri].matches[mi];
  const mt = matchTypeOf(ev);
  if (v !== null && vb !== undefined) {
    if (mt.kind === 'set' && !validSetScore(v, vb, mt.value)) { showToast(`Resultado no válido para un set a ${mt.value}`); return; }
    if (ev.format === 'pozo' && v === vb) { showToast('En el Pozo tiene que haber un ganador'); return; }
  }
  if (v === null) { m.sa = null; m.sb = null; }
  else if (vb !== undefined) { m.sa = v; m.sb = vb; }
  else { m.sa = v; m.sb = mt.value - v; }
  // Mexicano: si se corrige una ronda antigua, las posteriores sin jugar se rehacen con la nueva clasificación
  if (['mexicano', 'mixicano', 'pozo'].includes(ev.format)) {
    while (ev.rounds.length - 1 > ri && !ev.rounds[ev.rounds.length - 1].matches.some(x => x.sa !== null)) ev.rounds.pop();
  }
  updateAmericanoStatus(ev);
  saveDB();
  vibrate(15);
  closeEventModal();
  renderAmericanoView();
}

function nextAmericanoRound(aid) {
  const ev = findAmericano(aid);
  if (!roundComplete(ev.rounds[ev.rounds.length - 1])) { showToast('Termina de anotar la ronda actual'); return; }
  generateNextRound(ev);
  saveDB();
  showToast(`Ronda ${ev.rounds.length} generada`);
  renderAmericanoView();
}

function deleteAmericano(aid) {
  if (!confirm('¿Eliminar este evento?')) return;
  americanos = americanos.filter(a => a.id !== aid);
  saveDB();
  aView = { mode: 'list', aid: null, tab: 'rounds' };
  renderAmericanoView();
}

// ---------- Alta ----------
function startAmericanoDraft() {
  eventDraft = { kind: 'americano', name: '', format: 'americano', players: [], matchKind: 'points', matchValue: 24, courts: null, rounds: null };
  aView = { mode: 'create', aid: null, tab: 'rounds' };
  renderAmericanoView();
}

function setADraft(key, val) {
  eventDraft[key] = key === 'matchValue' ? parseInt(val, 10) : val;
  if (key === 'matchKind') eventDraft.matchValue = MATCH_TYPES[val].values[val === 'set' ? 1 : Math.min(2, MATCH_TYPES[val].values.length - 1)];
  if (key === 'format') { eventDraft.courts = null; eventDraft.rounds = null; }
  renderAmericanoView();
}

function toggleAPlayer(name) {
  const p = eventDraft.players;
  eventDraft.players = p.includes(name) ? p.filter(x => x !== name) : [...p, name];
  eventDraft.courts = null;
  eventDraft.rounds = null;
  renderAmericanoView();
}

function addAPlayer() {
  const name = readQuickPlayer();
  if (name && !eventDraft.players.includes(name)) eventDraft.players.push(name);
  eventDraft.courts = null;
  eventDraft.rounds = null;
  renderAmericanoView();
}

function balanceADraftPairs() {
  const elos = eloMap();
  const s = [...eventDraft.players].sort((a, b) => eloOfName(b, elos) - eloOfName(a, elos));
  const out = [];
  for (let i = 0; i < s.length / 2; i++) out.push(s[i], s[s.length - 1 - i]);
  eventDraft.players = out.filter(Boolean);
  renderAmericanoView();
}

function draftDefaults(d) {
  const n = d.players.length;
  const teams = Math.floor(n / 2);
  const maxCourts = d.format === 'fixed' ? Math.max(1, Math.floor(teams / 2)) : Math.max(1, Math.floor(n / 4));
  if (d.format === 'pozo') return { courts: maxCourts, maxCourts, rounds: d.rounds || 6 };
  const courts = Math.min(d.courts || maxCourts, maxCourts);
  let rounds = d.rounds;
  if (!rounds) {
    if (d.format === 'fixed') rounds = Math.max(1, teams % 2 ? teams : teams - 1);
    else if (d.format === 'americano') rounds = Math.max(3, n % 4 === 0 ? n - 1 : n);
    else rounds = 5;
  }
  return { courts, maxCourts, rounds };
}

function stepADraft(key, delta) {
  const def = draftDefaults(eventDraft);
  if (key === 'courts') eventDraft.courts = Math.max(1, Math.min(def.maxCourts, def.courts + delta));
  if (key === 'rounds') eventDraft.rounds = Math.max(1, Math.min(30, def.rounds + delta));
  renderAmericanoView();
}

function validateADraft(d) {
  const n = d.players.length;
  if (!d.name.trim()) return 'Ponle un nombre al evento';
  if (n < 4) return 'Hacen falta al menos 4 jugadores';
  if (d.format === 'fixed' && n % 2) return 'En parejas fijas el número de jugadores tiene que ser par';
  if (d.format === 'pozo' && n % 4) return 'El Pozo necesita un múltiplo de 4 jugadores (4, 8, 12, 16...)';
  if (d.format === 'mixicano') {
    const f = d.players.filter(p => ensureProfile(p).gender === 'F').length;
    if (f < 2 || n - f < 2) return 'El mixto necesita al menos 2 hombres y 2 mujeres';
  }
  return null;
}

function createAmericanoFromDraft() {
  const d = eventDraft;
  const err = validateADraft(d);
  if (err) { showToast(err); return; }
  const def = draftDefaults(d);
  const ev = {
    id: uid('a'), name: d.name.trim(), format: d.format, createdAt: Date.now(), players: [...d.players],
    matchType: { kind: d.matchKind, value: d.matchValue }, courts: def.courts, totalRounds: def.rounds, rounds: [], status: 'active'
  };
  if (d.format === 'mixicano') {
    const f = ev.players.filter(p => ensureProfile(p).gender === 'F').length;
    ev.courts = Math.max(1, Math.min(ev.courts, Math.floor(Math.min(f, ev.players.length - f) / 2)));
  }
  if (d.format === 'fixed') {
    ev.teams = [];
    for (let i = 0; i + 1 < ev.players.length; i += 2) ev.teams.push([ev.players[i], ev.players[i + 1]]);
    ev.rounds = buildFixedRounds(ev);
    ev.totalRounds = ev.rounds.length;
  } else if (d.format === 'americano') {
    for (let r = 0; r < ev.totalRounds; r++) generateNextRound(ev);
  } else {
    generateNextRound(ev);
  }
  americanos.unshift(ev);
  saveDB();
  eventDraft = null;
  vibrate([20, 40]);
  showToast(`${AMERICANO_FORMATS[ev.format].main} creado`);
  aView = { mode: 'detail', aid: ev.id, tab: 'rounds' };
  renderAmericanoView();
}

// ---------- Pantallas ----------
function renderAmericanoView() {
  const box = document.getElementById('view-americano');
  if (!box) return;
  setTimeout(ensureRoundTimerTick, 0);
  if (aView.mode === 'create' && eventDraft && eventDraft.kind === 'americano') box.innerHTML = renderAmericanoCreateHTML();
  else if (aView.mode === 'detail' && findAmericano(aView.aid)) box.innerHTML = renderAmericanoDetailHTML(findAmericano(aView.aid));
  else box.innerHTML = renderAmericanoListHTML();
}

function openAmericano(aid) {
  aView = { mode: 'detail', aid, tab: 'rounds' };
  renderAmericanoView();
  window.scrollTo(0, 0);
}

function showAmericanoList() {
  aView = { mode: 'list', aid: null, tab: 'rounds' };
  renderAmericanoView();
}

function renderAmericanoListHTML() {
  const cards = americanos.map(ev => {
    const leader = americanoStandings(ev)[0];
    const doneRounds = ev.rounds.filter(roundComplete).length;
    return `
      <button type="button" class="event-card" onclick="openAmericano(${jsArg(ev.id)})">
        <div class="event-card-top">
          <span class="event-tag">${AMERICANO_FORMATS[ev.format].main}</span>
          <span class="event-status ${ev.status}">${ev.status === 'finished' ? 'Finalizado' : 'En juego'}</span>
        </div>
        <div class="event-card-title">${escapeHtml(ev.name)}</div>
        <div class="event-card-sub">${ev.players.length} jugadores · ${ev.courts} pista${ev.courts > 1 ? 's' : ''} · ${matchTypeLabel(matchTypeOf(ev))} · ${formatEventDate(ev.createdAt)}</div>
        <div class="event-progress"><i style="width:${(doneRounds / ev.totalRounds) * 100}%"></i></div>
        <div class="event-card-sub">Ronda ${Math.min(doneRounds + 1, ev.totalRounds)} de ${ev.totalRounds}${leader && leader.pj ? ` · Lidera ${escapeHtml(leader.members.map(shortName).join(' / '))} (${leader.pts})` : ''}</div>
      </button>`;
  }).join('');
  return `
    <div class="section-hero">
      <div class="section-hero-kicker">Competición social</div>
      <div class="section-hero-title">Americano · Mexicano</div>
      <div class="format-explainer">
        ${Object.values(AMERICANO_FORMATS).map(f => `<div><strong>${f.main}</strong><span>${f.sub}</span></div>`).join('')}
      </div>
      <div class="section-hero-actions"><button class="btn-volt" onclick="startAmericanoDraft()"><svg class="icon icon-lg"><use href="#i-plus"/></svg> Nuevo evento</button></div>
    </div>
    ${cards ? `<div class="event-list">${cards}</div>` : `<div class="bento-card"><div class="empty-note">Organiza una tarde de pádel para 4, 8, 12 o más jugadores.<br>La app hace los cruces, reparte los descansos y lleva la clasificación por puntos.</div></div>`}`;
}

function renderAmericanoCreateHTML() {
  const d = eventDraft;
  const def = draftDefaults(d);
  const n = d.players.length;
  const err = validateADraft({ ...d, name: d.name || 'x' });
  const resting = d.format === 'fixed' ? Math.max(0, Math.floor(n / 2) - def.courts * 2) * 2 : Math.max(0, n - def.courts * 4);
  const pairsPreview = d.format === 'fixed' && n >= 2 ? `
    <div class="form-label">Parejas (en el orden en que los marcas)</div>
    ${Array.from({ length: Math.floor(n / 2) }, (_, i) => `<div class="pair-row"><span class="pair-num">${i + 1}</span><span class="pair-names">${escapeHtml(d.players[2 * i])} / ${escapeHtml(d.players[2 * i + 1])}</span></div>`).join('')}
    <button type="button" class="btn-icon" style="width:100%;padding:10px;margin-top:6px;color:var(--volt);" onclick="balanceADraftPairs()">Equilibrar parejas por ELO</button>` : '';
  const stepper = (key, val, label) => `
    <div class="stepper">
      <span class="stepper-label">${label}</span>
      <button type="button" class="btn-icon" onclick="stepADraft('${key}', -1)">−</button>
      <span class="stepper-val">${val}</span>
      <button type="button" class="btn-icon" onclick="stepADraft('${key}', 1)">+</button>
    </div>`;
  return `
    <div class="section-hero">
      <div class="section-hero-kicker">Nuevo evento</div>
      <div class="section-hero-title">Configurar</div>
    </div>
    <div class="bento-card">
      <div class="form-label">Nombre</div>
      <input type="text" value="${escapeHtml(d.name)}" placeholder="Ej. Americano del viernes" oninput="eventDraft.name=this.value">
      <div class="form-label">Modalidad</div>
      ${segOptionsHTML(Object.entries(AMERICANO_FORMATS).map(([value, f]) => ({ value, main: f.main, sub: f.sub })), d.format, "setADraft.bind(null,'format')")}
      <div class="form-label">Tipo de partido</div>
      ${segOptionsHTML(Object.entries(MATCH_TYPES).map(([value, t]) => ({ value, main: t.main, sub: t.sub })), d.matchKind, "setADraft.bind(null,'matchKind')")}
      <div style="height:6px;"></div>
      ${segOptionsHTML(MATCH_TYPES[d.matchKind].values.map(v => ({
        value: v,
        main: d.matchKind === 'set' ? SET_NAMES[v] : String(v),
        sub: d.matchKind === 'set' ? `Tie-break a ${v}-${v}` : (MATCH_TYPES[d.matchKind].valueUnit || MATCH_TYPES[d.matchKind].unit)
      })), d.matchValue, "setADraft.bind(null,'matchValue')")}
    </div>
    <div class="bento-card">
      <div class="section-header"><div class="section-title">Jugadores (${n})</div></div>
      ${renderPlayerChooserHTML(d.players, { onToggle: 'toggleAPlayer', onAdd: 'addAPlayer', showGender: d.format === 'mixicano' })}
      ${pairsPreview}
    </div>
    <div class="bento-card">
      ${['fixed', 'pozo'].includes(d.format) ? `<div class="stepper"><span class="stepper-label">Pistas</span><span class="stepper-val">${def.courts}</span></div>` : stepper('courts', def.courts, 'Pistas')}
      ${d.format === 'fixed' ? '' : stepper('rounds', def.rounds, 'Rondas')}
      <div class="empty-note" style="text-align:left;padding:8px 0 0;">
        ${err ? escapeHtml(err) : `${def.courts * 4} jugadores en pista por ronda${resting ? ` · ${resting} descansa${resting > 1 ? 'n' : ''} por turnos` : ''}${d.format === 'fixed' ? ` · ${Math.floor(n / 2) % 2 ? Math.floor(n / 2) : Math.floor(n / 2) - 1} rondas` : ''}`}
      </div>
    </div>
    <button class="btn-volt" onclick="createAmericanoFromDraft()">Crear y generar cruces</button>
    <button class="btn-icon" style="width:100%;padding:12px;margin-top:8px;" onclick="showAmericanoList()">Cancelar</button>`;
}

// ---------- Cronómetro de ronda (partidos por tiempo) ----------
let roundTimerInterval = null;

function roundTimerHTML(ev, ri, r) {
  const mt = matchTypeOf(ev);
  if (mt.kind !== 'time' || roundComplete(r)) return '';
  const t = ev.timer && ev.timer.round === ri ? ev.timer : null;
  if (!t) {
    return `<button type="button" class="round-timer-btn" onclick="startRoundTimer(${jsArg(ev.id)}, ${ri})"><svg class="icon"><use href="#i-play"/></svg> Iniciar ${mt.value}:00</button>`;
  }
  return `
    <div class="round-timer-box">
      <span class="round-timer" data-ends="${t.endsAt}" data-aid="${escapeHtml(ev.id)}">${formatCountdown(t.endsAt - Date.now())}</span>
      <button type="button" class="btn-icon" onclick="startRoundTimer(${jsArg(ev.id)}, ${ri})">Reiniciar</button>
    </div>`;
}

function formatCountdown(ms) {
  if (ms <= 0) return 'TIEMPO';
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function startRoundTimer(aid, ri) {
  const ev = findAmericano(aid);
  ev.timer = { round: ri, endsAt: Date.now() + matchTypeOf(ev).value * 60000, alerted: false };
  saveDB();
  vibrate([20, 40]);
  renderAmericanoView();
  ensureRoundTimerTick();
}

function ensureRoundTimerTick() {
  if (roundTimerInterval) return;
  roundTimerInterval = setInterval(() => {
    const els = document.querySelectorAll('.round-timer');
    if (!els.length) { clearInterval(roundTimerInterval); roundTimerInterval = null; return; }
    els.forEach(el => {
      const left = Number(el.dataset.ends) - Date.now();
      el.innerText = formatCountdown(left);
      el.classList.toggle('ending', left > 0 && left <= 60000);
      el.classList.toggle('over', left <= 0);
      const ev = findAmericano(el.dataset.aid);
      if (left <= 0 && ev && ev.timer && !ev.timer.alerted) {
        ev.timer.alerted = true;
        saveDB();
        vibrate([300, 120, 300, 120, 500]);
        playTimeUpBeep();
        speak('Tiempo. Fin de la ronda');
        showToast('Tiempo: fin de la ronda');
      }
    });
  }, 500);
}

function playTimeUpBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch (e) {}
}

function setAmericanoTab(tab) {
  aView.tab = tab;
  renderAmericanoView();
}

function renderAmericanoDetailHTML(ev) {
  const st = americanoStandings(ev);
  const doneRounds = ev.rounds.filter(roundComplete).length;
  const canGenerate = !['americano', 'fixed'].includes(ev.format) && ev.rounds.length < ev.totalRounds && roundComplete(ev.rounds[ev.rounds.length - 1]);
  const podium = ev.status === 'finished' ? `
    <div class="podium" style="margin-top:14px;">
      ${[1, 0, 2].map(pos => st[pos] ? `
        <div class="podium-slot ${pos === 0 ? 'first' : ''}">
          ${renderAvatarHTML(st[pos].members[0], 'avatar-p1')}
          <div class="podium-name">${escapeHtml(st[pos].members.map(shortName).join(' / '))}</div>
          <div class="podium-elo">${matchTypeOf(ev).kind === 'set' ? `${st[pos].w} victorias` : `${st[pos].pts} ${scoreUnit(ev) === 'puntos' ? 'pts' : 'juegos'}`}</div>
          <div class="podium-step" style="height:${[64, 46, 34][pos]}px;">${pos + 1}</div>
        </div>` : '<div></div>').join('')}
    </div>` : `<div class="event-progress" style="margin-top:12px;"><i style="width:${(doneRounds / ev.totalRounds) * 100}%"></i></div>
    <div class="event-card-sub" style="position:relative;">Ronda ${Math.min(doneRounds + 1, ev.totalRounds)} de ${ev.totalRounds} · ${matchTypeLabel(matchTypeOf(ev))} · ${ev.courts} pista${ev.courts > 1 ? 's' : ''}</div>`;

  let body;
  if (aView.tab === 'table') {
    body = `
      <div class="bento-card">
        <table class="standings">
          <thead><tr><th>${isTeamFormat(ev) ? 'Pareja' : 'Jugador'}</th>${ev.format === 'pozo' ? '<th>Pista</th>' : ''}<th>PJ</th><th>G</th><th>Dif</th><th>${scoreUnit(ev) === 'puntos' ? 'Pts' : 'Juegos'}</th></tr></thead>
          <tbody>${st.map((r, i) => `
            <tr class="${i < 3 && r.pj ? 'qualify' : ''}">
              <td><span class="pos">${i + 1}</span>${escapeHtml(r.members.map(shortName).join(' / '))}</td>
              ${ev.format === 'pozo' ? `<td style="color:var(--volt);font-weight:800;">${r.court || '–'}</td>` : ''}<td>${r.pj}</td><td>${r.w}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td>
              <td style="color:var(--volt);font-weight:800;">${r.pts}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  } else {
    body = ev.rounds.map((r, ri) => `
      <div class="round-card ${roundComplete(r) ? 'done' : ''}">
        <div class="round-head"><span>Ronda ${ri + 1}</span>${r.rest && r.rest.length ? `<small>Descansa${r.rest.length > 1 ? 'n' : ''}: ${escapeHtml(r.rest.map(shortName).join(', '))}</small>` : ''}</div>
        ${roundTimerHTML(ev, ri, r)}
        ${r.matches.map((m, mi) => `
          <button type="button" class="court-match" onclick="openAmericanoScore(${jsArg(ev.id)}, ${ri}, ${mi})">
            <span class="court-num">P${m.court}</span>
            <span class="court-side ${m.sa !== null && m.sa > m.sb ? 'won' : ''}">${escapeHtml(pairLabel(m.a))}</span>
            <span class="court-score">${m.sa === null ? '<em>–</em>' : `${m.sa}<i>:</i>${m.sb}`}</span>
            <span class="court-side right ${m.sb !== null && m.sb > m.sa ? 'won' : ''}">${escapeHtml(pairLabel(m.b))}</span>
          </button>`).join('')}
      </div>`).join('') + (canGenerate ? `<button class="btn-volt" onclick="nextAmericanoRound(${jsArg(ev.id)})">Generar ronda ${ev.rounds.length + 1}</button>` : '');
  }

  return `
    <div class="section-hero">
      <button type="button" class="hero-back" onclick="showAmericanoList()">‹ Eventos</button>
      <div class="section-hero-kicker">${AMERICANO_FORMATS[ev.format].main} · ${ev.players.length} jugadores</div>
      <div class="section-hero-title">${escapeHtml(ev.name)}</div>
      ${podium}
    </div>
    <button class="btn-icon share-btn" onclick="shareAmericanoImage(${jsArg(ev.id)})"><svg class="icon"><use href="#i-share"/></svg> Compartir clasificación</button>
    <div class="sort-strip">
      <button type="button" class="sort-chip ${aView.tab === 'rounds' ? 'active' : ''}" onclick="setAmericanoTab('rounds')">Rondas</button>
      <button type="button" class="sort-chip ${aView.tab === 'table' ? 'active' : ''}" onclick="setAmericanoTab('table')">Clasificación</button>
    </div>
    ${body}
    <button class="btn-icon" style="width:100%;padding:11px;margin-top:14px;color:var(--coral);" onclick="deleteAmericano(${jsArg(ev.id)})"><svg class="icon"><use href="#i-trash"/></svg> Eliminar evento</button>`;
}
