// ==========================================================
// TORNEOS: ELIMINATORIA, LIGA (TODOS CONTRA TODOS) Y GRUPOS + FASE FINAL
// ==========================================================
const TOURNAMENT_FORMATS = {
  ko: { main: 'Eliminatoria', sub: 'Cuadro directo', min: 2 },
  league: { main: 'Liga', sub: 'Todos contra todos', min: 3 },
  groups: { main: 'Grupos + cuadro', sub: 'Como un open', min: 6 }
};
let tView = { mode: 'list', tid: null, tab: null };

function findTournament(tid) {
  return tournaments.find(t => t.id === tid);
}

function findTMatch(t, mid) {
  return t.matches.find(m => m.id === mid);
}

function teamById(t, id) {
  return t.teams.find(x => x.id === id);
}

function teamName(t, id) {
  const team = teamById(t, id);
  return team ? pairLabel(team.players) : '';
}

// ---------- Construcción del torneo ----------
function bracketOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    order = order.flatMap(s => [s, n - s]);
  }
  return order;
}

function koRoundName(totalRounds, r) {
  const left = Math.pow(2, totalRounds - r);
  return { 2: 'Final', 4: 'Semifinales', 8: 'Cuartos de final', 16: 'Octavos de final', 32: 'Dieciseisavos' }[left] || `Ronda ${r + 1}`;
}

function buildKnockout(t, seededIds) {
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(2, seededIds.length))));
  const rounds = Math.log2(size);
  const order = bracketOrder(size);
  t.koRounds = rounds;
  t.matches = t.matches.filter(m => m.stage !== 'ko');
  for (let r = 0; r < rounds; r++) {
    const count = size / Math.pow(2, r + 1);
    for (let i = 0; i < count; i++) {
      t.matches.push({
        id: `K${r}-${i}`, stage: 'ko', round: r, a: null, b: null, sets: null, winner: null, bye: false,
        next: r < rounds - 1 ? { id: `K${r + 1}-${Math.floor(i / 2)}`, side: i % 2 ? 'b' : 'a' } : null
      });
    }
  }
  const first = t.matches.filter(m => m.stage === 'ko' && m.round === 0);
  first.forEach((m, i) => {
    m.a = seededIds[order[2 * i] - 1] || null;
    m.b = seededIds[order[2 * i + 1] - 1] || null;
  });
  avoidSameGroupClashes(t, first);
  first.forEach(m => {
    if (m.a && !m.b) { m.winner = m.a; m.bye = true; }
    if (m.b && !m.a) { m.winner = m.b; m.bye = true; }
    placeWinner(t, m);
  });
}

// En la fase final, evita que dos parejas del mismo grupo se crucen en la primera ronda
function avoidSameGroupClashes(t, first) {
  const groupOf = id => (t.groups || []).find(g => g.teamIds.includes(id))?.name;
  if (!t.groups || !t.groups.length) return;
  first.forEach(m => {
    if (!m.a || !m.b || groupOf(m.a) !== groupOf(m.b)) return;
    const other = first.find(o => o !== m && o.b && groupOf(o.b) !== groupOf(m.a) && groupOf(m.b) !== groupOf(o.a));
    if (other) [m.b, other.b] = [other.b, m.b];
  });
}

// Liga a una vuelta con el método del círculo
function buildRoundRobin(t, teamIds, stage, groupName) {
  const ids = [...teamIds];
  if (ids.length % 2) ids.push(null);
  const n = ids.length;
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i], b = ids[n - 1 - i];
      if (a && b) {
        t.matches.push({ id: `${stage === 'group' ? 'G' + groupName : 'L'}${r}-${i}`, stage, group: groupName, round: r, a, b, sets: null, winner: null });
      }
    }
    ids.splice(1, 0, ids.pop());
  }
}

function createTournamentFromDraft() {
  const d = eventDraft;
  const fmt = TOURNAMENT_FORMATS[d.format];
  if (!d.name.trim()) { showToast('Ponle un nombre al torneo'); return; }
  if (d.pairs.length < fmt.min) { showToast(`El formato ${fmt.main} necesita al menos ${fmt.min} parejas`); return; }
  const elos = eloMap();
  let teams = d.pairs.map((pp, i) => ({
    id: `T${i + 1}`, players: pp, elo: Math.round((eloOfName(pp[0], elos) + eloOfName(pp[1], elos)) / 2)
  }));
  teams = d.seeding === 'elo' ? teams.sort((a, b) => b.elo - a.elo) : shuffleArray(teams);
  teams.forEach((tm, i) => { tm.seed = i + 1; });

  const t = {
    id: uid('t'), name: d.name.trim(), format: d.format, createdAt: Date.now(),
    rules: { deuceRule: d.deuceRule, thirdSetRule: d.thirdSetRule }, teams, matches: [], groups: [], status: 'active', champion: null
  };
  const ids = teams.map(x => x.id);
  if (d.format === 'ko') buildKnockout(t, ids);
  if (d.format === 'league') buildRoundRobin(t, ids, 'league', null);
  if (d.format === 'groups') {
    const G = ids.length >= 24 ? 8 : ids.length >= 12 ? 4 : 2;
    const names = 'ABCDEFGH'.slice(0, G).split('');
    t.groups = names.map(name => ({ name, teamIds: [] }));
    ids.forEach((id, i) => {
      // Reparto en serpiente para que los grupos queden equilibrados
      const row = Math.floor(i / G), col = i % G;
      t.groups[row % 2 ? G - 1 - col : col].teamIds.push(id);
    });
    t.groups.forEach(g => buildRoundRobin(t, g.teamIds, 'group', g.name));
  }
  tournaments.unshift(t);
  saveDB();
  eventDraft = null;
  vibrate([20, 40]);
  showToast('Torneo creado');
  openTournament(t.id);
}

// ---------- Resultados ----------
function setsSummary(sets) {
  let sa = 0, sb = 0, ga = 0, gb = 0;
  (sets || []).forEach(([a, b]) => {
    ga += a; gb += b;
    if (a > b) sa++; else if (b > a) sb++;
  });
  return { sa, sb, ga, gb };
}

function placeWinner(t, m) {
  if (!m.next) return;
  const nm = findTMatch(t, m.next.id);
  const prev = nm[m.next.side];
  nm[m.next.side] = m.winner || null;
  // Si cambia quién pasa, se borra el resultado de la ronda siguiente
  if (prev !== nm[m.next.side] && nm.winner) {
    nm.winner = null;
    nm.sets = null;
    placeWinner(t, nm);
  }
}

function setTournamentResult(t, mid, sets, forcedWinner = null, historyId = null) {
  const m = findTMatch(t, mid);
  if (!m || !m.a || !m.b) return false;
  const { sa, sb } = setsSummary(sets);
  let winner = forcedWinner;
  if (!winner) {
    if (sa === sb) return false;
    winner = sa > sb ? m.a : m.b;
  }
  m.sets = sets;
  m.winner = winner;
  if (historyId) m.historyId = historyId;
  if (m.stage === 'ko') placeWinner(t, m);
  updateTournamentStatus(t);
  saveDB();
  return true;
}

function clearTournamentResult(tid, mid) {
  const t = findTournament(tid);
  const m = findTMatch(t, mid);
  m.sets = null;
  m.winner = null;
  if (m.stage === 'ko') placeWinner(t, m);
  updateTournamentStatus(t);
  saveDB();
  closeEventModal();
  renderTournamentsView();
}

function updateTournamentStatus(t) {
  t.champion = null;
  if (t.format === 'league') {
    const done = t.matches.every(m => m.winner);
    if (done) t.champion = tournamentStandings(t, t.matches, t.teams.map(x => x.id))[0].id;
  } else {
    const final = t.matches.find(m => m.stage === 'ko' && !m.next);
    if (final && final.winner) t.champion = final.winner;
  }
  t.status = t.champion ? 'finished' : 'active';
}

function groupsFinished(t) {
  return t.format === 'groups' && t.matches.filter(m => m.stage === 'group').every(m => m.winner);
}

function buildFinalStage(tid) {
  const t = findTournament(tid);
  if (!groupsFinished(t)) { showToast('Faltan partidos de grupos por jugar'); return; }
  const tables = t.groups.map(g => tournamentStandings(t, t.matches.filter(m => m.group === g.name), g.teamIds));
  const rankRows = rows => [...rows].sort((a, b) => b.pts - a.pts || b.setDiff - a.setDiff || b.gameDiff - a.gameDiff);
  const winners = rankRows(tables.map(tb => tb[0]));
  const runners = rankRows(tables.map(tb => tb[1]).filter(Boolean));
  buildKnockout(t, [...winners, ...runners].map(r => r.id));
  t.koBuilt = true;
  saveDB();
  tView.tab = 'bracket';
  showToast('Fase final generada');
  renderTournamentsView();
}

function tournamentStandings(t, matches, teamIds) {
  const rows = {};
  teamIds.forEach(id => { rows[id] = { id, pj: 0, pg: 0, pp: 0, sf: 0, sc: 0, gf: 0, gc: 0, pts: 0 }; });
  matches.forEach(m => {
    if (!m.winner || !rows[m.a] || !rows[m.b]) return;
    const s = setsSummary(m.sets);
    const A = rows[m.a], B = rows[m.b];
    A.pj++; B.pj++;
    A.sf += s.sa; A.sc += s.sb; B.sf += s.sb; B.sc += s.sa;
    A.gf += s.ga; A.gc += s.gb; B.gf += s.gb; B.gc += s.ga;
    if (m.winner === m.a) { A.pg++; B.pp++; A.pts += 3; } else { B.pg++; A.pp++; B.pts += 3; }
  });
  return Object.values(rows)
    .map(r => ({ ...r, setDiff: r.sf - r.sc, gameDiff: r.gf - r.gc }))
    .sort((a, b) => b.pts - a.pts || b.setDiff - a.setDiff || b.gameDiff - a.gameDiff || b.gf - a.gf);
}

// Resultado que llega desde el marcador en directo
function applyLinkedMatchResult(st) {
  if (!st.link || st.link.kind !== 'tournament') return;
  const t = findTournament(st.link.tid);
  const m = t && findTMatch(t, st.link.mid);
  if (!m) return;
  const sets = st.sets.filter(s => s[0] + s[1] > 0).map(s => [...s]);
  setTournamentResult(t, m.id, sets, st.winnerPair === 0 ? m.a : m.b, st.id);
}

function startTournamentLiveMatch(tid, mid) {
  const t = findTournament(tid);
  const m = findTMatch(t, mid);
  if (!m || !m.a || !m.b) return;
  const players = [...teamById(t, m.a).players, ...teamById(t, m.b).players].map(ensurePlayerInDB);
  saveDB();
  setupConfig.slots = players;
  setupConfig.deuceRule = t.rules.deuceRule;
  setupConfig.thirdSetRule = t.rules.thirdSetRule;
  setupConfig.initialServer = 0;
  closeEventModal();
  startMatch({ kind: 'tournament', tid, mid });
  showToast(`${t.name}: partido en directo`);
}

function openTournamentResult(tid, mid) {
  const t = findTournament(tid);
  const m = findTMatch(t, mid);
  if (!m || !m.a || !m.b) { showToast('Este cruce aún no tiene las dos parejas'); return; }
  const sets = m.sets || [];
  const val = (i, k) => (sets[i] ? sets[i][k] : '');
  const rows = [0, 1, 2].map(i => `
    <div class="set-input-row">
      <span>Set ${i + 1}</span>
      <input type="number" inputmode="numeric" min="0" max="20" id="rs-${i}-a" value="${val(i, 0)}" placeholder="–">
      <span class="set-dash">–</span>
      <input type="number" inputmode="numeric" min="0" max="20" id="rs-${i}-b" value="${val(i, 1)}" placeholder="–">
    </div>`).join('');
  openEventModal(`
    <div class="event-modal-title">${escapeHtml(stageLabel(t, m))}</div>
    <div class="result-teams">
      <div class="result-team a">${escapeHtml(teamName(t, m.a))}</div>
      <div class="result-vs">VS</div>
      <div class="result-team b">${escapeHtml(teamName(t, m.b))}</div>
    </div>
    ${rows}
    <div class="empty-note" style="padding:6px 0 10px;">El súper tie-break se anota como un set (por ejemplo 10–8).</div>
    <button class="btn-volt" onclick="saveTournamentResultFromModal(${jsArg(tid)}, ${jsArg(mid)})">Guardar resultado</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
      <button class="btn-icon" style="padding:11px;color:var(--volt);" onclick="startTournamentLiveMatch(${jsArg(tid)}, ${jsArg(mid)})"><svg class="icon"><use href="#i-play"/></svg> Jugar en directo</button>
      ${m.winner ? `<button class="btn-icon" style="padding:11px;color:var(--coral);" onclick="clearTournamentResult(${jsArg(tid)}, ${jsArg(mid)})">Borrar resultado</button>` : `<button class="btn-icon" style="padding:11px;" onclick="closeEventModal()">Cancelar</button>`}
    </div>`);
}

function saveTournamentResultFromModal(tid, mid) {
  const sets = [];
  for (let i = 0; i < 3; i++) {
    const a = document.getElementById(`rs-${i}-a`).value;
    const b = document.getElementById(`rs-${i}-b`).value;
    if (a === '' && b === '') continue;
    sets.push([parseInt(a || '0', 10), parseInt(b || '0', 10)]);
  }
  const t = findTournament(tid);
  if (!sets.length || !setTournamentResult(t, mid, sets)) {
    showToast('Resultado incompleto: tiene que haber un ganador');
    return;
  }
  vibrate(18);
  closeEventModal();
  showToast(t.champion ? `Campeones: ${teamName(t, t.champion)}` : 'Resultado guardado');
  renderTournamentsView();
}

function deleteTournament(tid) {
  if (!confirm('¿Eliminar este torneo? Los partidos jugados seguirán en el historial.')) return;
  tournaments = tournaments.filter(t => t.id !== tid);
  saveDB();
  tView = { mode: 'list', tid: null, tab: null };
  renderTournamentsView();
}

// ---------- Pantallas ----------
function openTournament(tid) {
  tView = { mode: 'detail', tid, tab: null };
  switchMainTab('tournaments');
}

function showTournamentList() {
  tView = { mode: 'list', tid: null, tab: null };
  renderTournamentsView();
}

function renderTournamentsView() {
  const box = document.getElementById('view-tournaments');
  if (!box) return;
  if (tView.mode === 'create' && eventDraft && eventDraft.kind === 'tournament') box.innerHTML = renderTournamentCreateHTML();
  else if (tView.mode === 'detail' && findTournament(tView.tid)) box.innerHTML = renderTournamentDetailHTML(findTournament(tView.tid));
  else box.innerHTML = renderTournamentListHTML();
}

function renderTournamentListHTML() {
  const active = tournaments.filter(t => t.status !== 'finished').length;
  const cards = tournaments.map(t => {
    const played = t.matches.filter(m => m.winner && !m.bye).length;
    const total = t.matches.filter(m => !m.bye).length;
    return `
      <button type="button" class="event-card" onclick="openTournament(${jsArg(t.id)})">
        <div class="event-card-top">
          <span class="event-tag">${TOURNAMENT_FORMATS[t.format].main}</span>
          <span class="event-status ${t.status}">${t.status === 'finished' ? 'Finalizado' : 'En juego'}</span>
        </div>
        <div class="event-card-title">${escapeHtml(t.name)}</div>
        <div class="event-card-sub">${t.teams.length} parejas · ${formatEventDate(t.createdAt)}</div>
        ${t.champion ? `<div class="event-champion"><svg class="icon"><use href="#i-trophy"/></svg> ${escapeHtml(teamName(t, t.champion))}</div>`
          : `<div class="event-progress"><i style="width:${total ? (played / total) * 100 : 0}%"></i></div><div class="event-card-sub">${played} de ${total} partidos jugados</div>`}
      </button>`;
  }).join('');
  return `
    <div class="section-hero">
      <div class="section-hero-kicker">Competición</div>
      <div class="section-hero-title">Torneos</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="hero-stat-val">${tournaments.length}</div><div class="hero-stat-lbl">Torneos</div></div>
        <div class="hero-stat"><div class="hero-stat-val">${active}</div><div class="hero-stat-lbl">En juego</div></div>
        <div class="hero-stat"><div class="hero-stat-val">${tournaments.filter(t => t.status === 'finished').length}</div><div class="hero-stat-lbl">Finalizados</div></div>
      </div>
      <div class="section-hero-actions"><button class="btn-volt" onclick="startTournamentDraft()"><svg class="icon icon-lg"><use href="#i-plus"/></svg> Nuevo torneo</button></div>
    </div>
    ${cards ? `<div class="event-list">${cards}</div>` : `<div class="bento-card"><div class="empty-note">Crea tu primer torneo: eliminatoria con cuadro, liga todos contra todos o fase de grupos con cuadro final.<br>Los partidos se pueden jugar con el marcador en directo y el resultado pasa solo al cuadro.</div></div>`}`;
}

// ---------- Alta de torneo ----------
function startTournamentDraft() {
  eventDraft = { kind: 'tournament', name: '', format: 'ko', seeding: 'elo', deuceRule: 'golden', thirdSetRule: 'supertb', pairs: [], pool: [] };
  tView = { mode: 'create', tid: null, tab: null };
  renderTournamentsView();
}

function setTDraft(key, val) {
  eventDraft[key] = val;
  renderTournamentsView();
}

function toggleTPool(name) {
  const p = eventDraft.pool;
  eventDraft.pool = p.includes(name) ? p.filter(x => x !== name) : [...p, name];
  renderTournamentsView();
}

function addTPoolPlayer() {
  const name = readQuickPlayer();
  if (name && !eventDraft.pool.includes(name)) eventDraft.pool.push(name);
  renderTournamentsView();
}

function addPairFromPool() {
  const pool = eventDraft.pool;
  if (pool.length !== 2) { showToast('Marca exactamente 2 jugadores para formar una pareja'); return; }
  eventDraft.pairs.push([...pool]);
  eventDraft.pool = [];
  renderTournamentsView();
}

function autoPairsFromPool() {
  const pool = eventDraft.pool;
  if (pool.length < 4 || pool.length % 2) { showToast('Marca un número par de jugadores (mínimo 4)'); return; }
  const elos = eloMap();
  const sorted = [...pool].sort((a, b) => eloOfName(b, elos) - eloOfName(a, elos));
  // Equilibradas: el mejor con el peor, el 2.º con el penúltimo...
  for (let i = 0; i < sorted.length / 2; i++) eventDraft.pairs.push([sorted[i], sorted[sorted.length - 1 - i]]);
  eventDraft.pool = [];
  showToast(`${sorted.length / 2} parejas equilibradas por ELO`);
  renderTournamentsView();
}

function removeTPair(idx) {
  eventDraft.pairs.splice(idx, 1);
  renderTournamentsView();
}

function renderTournamentCreateHTML() {
  const d = eventDraft;
  const elos = eloMap();
  const used = d.pairs.flat();
  const pairsHTML = d.pairs.map((pp, i) => `
    <div class="pair-row">
      <span class="pair-num">${i + 1}</span>
      <span class="pair-names">${escapeHtml(pp.join(' / '))}</span>
      <span class="elo-pill">${Math.round((eloOfName(pp[0], elos) + eloOfName(pp[1], elos)) / 2)}</span>
      <button type="button" class="btn-icon" style="padding:5px 8px;" onclick="removeTPair(${i})"><svg class="icon"><use href="#i-close"/></svg></button>
    </div>`).join('');
  const poolSelected = d.pool.filter(n => !used.includes(n));
  const chooser = renderPlayerChooserHTML(poolSelected, { onToggle: 'toggleTPool', onAdd: 'addTPoolPlayer', exclude: used });
  return `
    <div class="section-hero">
      <div class="section-hero-kicker">Nuevo torneo</div>
      <div class="section-hero-title">Configurar</div>
    </div>
    <div class="bento-card">
      <div class="form-label">Nombre</div>
      <input type="text" value="${escapeHtml(d.name)}" placeholder="Ej. Open de Otoño 2026" oninput="eventDraft.name=this.value">
      <div class="form-label">Formato</div>
      ${segOptionsHTML(Object.entries(TOURNAMENT_FORMATS).map(([value, f]) => ({ value, main: f.main, sub: f.sub })), d.format, "setTDraft.bind(null,'format')")}
      <div class="form-label">Cabezas de serie</div>
      ${segOptionsHTML([{ value: 'elo', main: 'Por ELO', sub: 'Los mejores no se cruzan pronto' }, { value: 'random', main: 'Sorteo', sub: 'Cuadro aleatorio' }], d.seeding, "setTDraft.bind(null,'seeding')")}
      <div class="form-label">Reglas de los partidos</div>
      ${segOptionsHTML([{ value: 'adv', main: 'Ventaja' }, { value: 'star', main: 'Star point' }, { value: 'golden', main: 'Punto de oro' }], d.deuceRule, "setTDraft.bind(null,'deuceRule')")}
      <div style="height:6px;"></div>
      ${segOptionsHTML([{ value: 'normal', main: '3.er set completo' }, { value: 'supertb', main: 'Súper tie-break' }], d.thirdSetRule, "setTDraft.bind(null,'thirdSetRule')")}
    </div>
    <div class="bento-card">
      <div class="section-header"><div class="section-title">Parejas inscritas (${d.pairs.length})</div></div>
      ${pairsHTML || '<div class="empty-note">Aún no hay parejas. Márcalas abajo.</div>'}
      <div class="form-label" style="margin-top:12px;">Jugadores disponibles · marca 2 para una pareja o varios para emparejar por ELO</div>
      ${chooser}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
        <button type="button" class="btn-icon" style="padding:11px;" onclick="addPairFromPool()">Añadir pareja (${poolSelected.length}/2)</button>
        <button type="button" class="btn-icon" style="padding:11px;color:var(--volt);" onclick="autoPairsFromPool()">Emparejar por ELO</button>
      </div>
    </div>
    <button class="btn-volt" onclick="createTournamentFromDraft()">Crear torneo</button>
    <button class="btn-icon" style="width:100%;padding:12px;margin-top:8px;" onclick="showTournamentList()">Cancelar</button>`;
}

// ---------- Detalle del torneo ----------
function stageLabel(t, m) {
  if (m.stage === 'ko') return koRoundName(t.koRounds, m.round);
  if (m.stage === 'group') return `Grupo ${m.group} · Jornada ${m.round + 1}`;
  return `Jornada ${m.round + 1}`;
}

function setTournamentTab(tab) {
  tView.tab = tab;
  renderTournamentsView();
}

function renderTournamentDetailHTML(t) {
  const tabs = [];
  if (t.format === 'groups') tabs.push(['groups', 'Grupos']);
  if (t.format === 'league') tabs.push(['table', 'Clasificación']);
  if (t.format === 'ko' || t.koBuilt) tabs.push(['bracket', 'Cuadro']);
  tabs.push(['matches', 'Partidos'], ['teams', 'Parejas']);
  if (!tView.tab || !tabs.some(x => x[0] === tView.tab)) tView.tab = tabs[0][0];
  const played = t.matches.filter(m => m.winner && !m.bye).length;
  const total = t.matches.filter(m => !m.bye).length;

  let body = '';
  if (tView.tab === 'bracket') body = renderBracketHTML(t);
  if (tView.tab === 'table') body = renderStandingsHTML(t, t.matches, t.teams.map(x => x.id), 'Clasificación');
  if (tView.tab === 'groups') {
    body = t.groups.map(g => renderStandingsHTML(t, t.matches.filter(m => m.group === g.name), g.teamIds, `Grupo ${g.name}`, 2)).join('');
    if (!t.koBuilt) {
      body += groupsFinished(t)
        ? `<button class="btn-volt" onclick="buildFinalStage(${jsArg(t.id)})">Generar fase final</button>`
        : `<div class="empty-note">Pasan a la fase final los 2 primeros de cada grupo.</div>`;
    }
  }
  if (tView.tab === 'matches') body = renderTMatchListHTML(t);
  if (tView.tab === 'teams') body = renderTTeamsHTML(t);

  return `
    <div class="section-hero">
      <button type="button" class="hero-back" onclick="showTournamentList()">‹ Torneos</button>
      <div class="section-hero-kicker">${TOURNAMENT_FORMATS[t.format].main} · ${t.teams.length} parejas</div>
      <div class="section-hero-title">${escapeHtml(t.name)}</div>
      ${t.champion ? `<div class="champion-banner"><svg class="icon icon-lg"><use href="#i-trophy"/></svg><div><small>Campeones</small><strong>${escapeHtml(teamById(t, t.champion).players.join(' / '))}</strong></div></div>`
        : `<div class="event-progress" style="margin-top:12px;"><i style="width:${total ? (played / total) * 100 : 0}%"></i></div><div class="event-card-sub" style="position:relative;">${played} de ${total} partidos jugados</div>`}
    </div>
    <button class="btn-icon share-btn" onclick="shareTournamentImage(${jsArg(t.id)})"><svg class="icon"><use href="#i-share"/></svg> Compartir ${t.format === 'ko' || t.koBuilt ? 'cuadro' : 'clasificación'}</button>
    <div class="sort-strip">${tabs.map(([k, l]) => `<button type="button" class="sort-chip ${tView.tab === k ? 'active' : ''}" onclick="setTournamentTab('${k}')">${l}</button>`).join('')}</div>
    ${body}
    <button class="btn-icon" style="width:100%;padding:11px;margin-top:14px;color:var(--coral);" onclick="deleteTournament(${jsArg(t.id)})"><svg class="icon"><use href="#i-trash"/></svg> Eliminar torneo</button>`;
}

function matchSideHTML(t, m, side) {
  const id = m[side];
  const team = id ? teamById(t, id) : null;
  const won = m.winner && m.winner === id;
  const scores = (m.sets || []).map(s => `<span class="${(side === 'a' ? s[0] > s[1] : s[1] > s[0]) ? 'w' : ''}">${side === 'a' ? s[0] : s[1]}</span>`).join('');
  return `
    <div class="bk-team ${won ? 'won' : ''} ${m.winner && !won ? 'lost' : ''}">
      ${team ? `<span class="bk-seed">${team.seed}</span>` : ''}
      <span class="bk-name">${team ? escapeHtml(pairLabel(team.players)) : (m.bye ? 'Exento' : '<em>Por decidir</em>')}</span>
      <span class="bk-scores">${scores}</span>
    </div>`;
}

function renderBracketHTML(t) {
  const cols = [];
  for (let r = 0; r < t.koRounds; r++) {
    const ms = t.matches.filter(m => m.stage === 'ko' && m.round === r);
    cols.push(`
      <div class="bk-col">
        <div class="bk-round">${koRoundName(t.koRounds, r)}</div>
        <div class="bk-matches">
          ${ms.map(m => `<button type="button" class="bk-match ${m.bye ? 'bye' : ''} ${!m.next ? 'final' : ''}" onclick="${m.bye ? '' : `openTournamentResult(${jsArg(t.id)}, ${jsArg(m.id)})`}">
            ${matchSideHTML(t, m, 'a')}${matchSideHTML(t, m, 'b')}
          </button>`).join('')}
        </div>
      </div>`);
  }
  return `<div class="bracket">${cols.join('')}</div><div class="empty-note">Toca un cruce para anotar el resultado o jugarlo en directo.</div>`;
}

function renderStandingsHTML(t, matches, teamIds, title, qualify = 0) {
  const rows = tournamentStandings(t, matches, teamIds);
  return `
    <div class="bento-card">
      <div class="section-header"><div class="section-title">${title}</div></div>
      <table class="standings">
        <thead><tr><th>Pareja</th><th>PJ</th><th>PG</th><th>Sets</th><th>Juegos</th><th>Pts</th></tr></thead>
        <tbody>${rows.map((r, i) => `
          <tr class="${qualify && i < qualify ? 'qualify' : ''}">
            <td><span class="pos">${i + 1}</span>${escapeHtml(teamName(t, r.id))}</td>
            <td>${r.pj}</td><td>${r.pg}</td><td>${r.setDiff > 0 ? '+' : ''}${r.setDiff}</td><td>${r.gameDiff > 0 ? '+' : ''}${r.gameDiff}</td>
            <td style="color:var(--volt);font-weight:800;">${r.pts}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function renderTMatchListHTML(t) {
  const list = t.matches.filter(m => !m.bye);
  const pending = list.filter(m => !m.winner && m.a && m.b);
  const waiting = list.filter(m => !m.winner && (!m.a || !m.b));
  const done = list.filter(m => m.winner);
  const item = m => `
    <button type="button" class="match-item ${m.winner ? 'done' : ''}" onclick="openTournamentResult(${jsArg(t.id)}, ${jsArg(m.id)})">
      <div class="match-item-stage">${escapeHtml(stageLabel(t, m))}</div>
      ${matchSideHTML(t, m, 'a')}${matchSideHTML(t, m, 'b')}
    </button>`;
  return `
    ${pending.length ? `<div class="form-label">Por jugar (${pending.length})</div>${pending.map(item).join('')}` : ''}
    ${done.length ? `<div class="form-label">Jugados (${done.length})</div>${done.map(item).join('')}` : ''}
    ${waiting.length ? `<div class="empty-note">${waiting.length} cruces esperan a las rondas anteriores.</div>` : ''}`;
}

function renderTTeamsHTML(t) {
  return `<div class="bento-card">${[...t.teams].sort((a, b) => a.seed - b.seed).map(tm => `
    <div class="pair-row">
      <span class="pair-num">${tm.seed}</span>
      <span class="pair-names">${escapeHtml(tm.players.join(' / '))}</span>
      <span class="elo-pill">ELO ${tm.elo}</span>
    </div>`).join('')}</div>`;
}
