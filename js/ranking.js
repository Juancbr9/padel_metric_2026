// ==========================================================
// RANKING GLOBAL, CARA A CARA, HISTORIAL Y NAVEGACIÓN
// ==========================================================
const ELO_START = 1500;
const ELO_K = 32;

function emptyPlayerStats(name) {
  return { name, PJ: 0, V: 0, W: 0, ENF: 0, EF: 0, ratingSum: 0, form: [], elo: ELO_START, eloDelta: 0, eloHistory: [ELO_START], badges: {}, zones: {} };
}

function computeAllPlayersStats() {
  const statsMap = {};
  dbPlayers.forEach(name => {
    statsMap[name] = emptyPlayerStats(name);
  });

  matchHistory.forEach(m => {
    if (!m || !m.players) return;
    m.players.forEach((p, idx) => {
      if (p.isGeneric) return;
      if (!statsMap[p.name]) {
        statsMap[p.name] = emptyPlayerStats(p.name);
      }
      const st = statsMap[p.name];
      st.PJ++;
      const won = (m.winnerPair === (idx < 2 ? 0 : 1));
      if (won) st.V++;
      st.W += (p.W || 0);
      st.ENF += (p.ENF || 0);
      st.EF += (p.EF || 0);
      st.ratingSum += calcPlayerRating(p);
      if (st.form.length < 5) st.form.push(won ? 'W' : 'L');
      badgesForPlayerInMatch(m, idx).forEach(k => { st.badges[k] = (st.badges[k] || 0) + 1; });
    });
    // Zonas de golpeo acumuladas de cada jugador (para su mapa de calor personal)
    (m.points || []).forEach(pt => {
      if (!pt.n || !pt.z || !statsMap[pt.n]) return;
      const key = `${pt.z}-${pt.l || 'D'}`;
      const z = statsMap[pt.n].zones;
      z[key] = z[key] || { W: 0, E: 0 };
      if (pt.t === 'W') z[key].W++;
      else if (ERROR_TYPES.includes(pt.t)) z[key].E++;
    });
  });

  applyEloRatings(statsMap);
  return { statsMap };
}

// ELO por parejas: se recorre el historial del más antiguo al más reciente
function applyEloRatings(statsMap) {
  const eloOf = (p) => (p.isGeneric || !statsMap[p.name]) ? ELO_START : statsMap[p.name].elo;
  [...matchHistory].reverse().forEach(m => {
    if (!m || !m.players || m.winnerPair === null || m.winnerPair === undefined) return;
    const team = [0, 1].map(t => (eloOf(m.players[t * 2]) + eloOf(m.players[t * 2 + 1])) / 2);
    const expected0 = 1 / (1 + Math.pow(10, (team[1] - team[0]) / 400));
    const games = (m.sets || []).reduce((acc, s) => [acc[0] + s[0], acc[1] + s[1]], [0, 0]);
    const margin = 1 + Math.min(0.5, Math.abs(games[0] - games[1]) / 20);
    const delta0 = ELO_K * margin * ((m.winnerPair === 0 ? 1 : 0) - expected0);
    m.players.forEach((p, idx) => {
      if (p.isGeneric || !statsMap[p.name]) return;
      const d = idx < 2 ? delta0 : -delta0;
      statsMap[p.name].elo += d;
      statsMap[p.name].eloDelta = d;
      statsMap[p.name].eloHistory.push(Math.round(statsMap[p.name].elo));
    });
  });
  Object.values(statsMap).forEach(st => { st.elo = Math.round(st.elo); });
}

function formDotsHTML(form) {
  if (!form || !form.length) return '';
  return `<span class="form-dots">${form.map(r => `<i class="${r}"></i>`).join('')}</span>`;
}

function setRankingGenderFilter(flt) {
  rankingGenderFilter = flt;
  ['all', 'M', 'F'].forEach(k => {
    document.getElementById(`sexflt-${k}`)?.classList.toggle('active', k === flt);
  });
  renderGlobalRanking();
}

function setRankingSort(sortKey) {
  rankingSortBy = sortKey;
  ['elo', 'V', 'winPct', 'avgR', 'W', 'lowENF', 'bal'].forEach(k => {
    document.getElementById(`sort-${k}`)?.classList.toggle('active', k === sortKey);
  });
  renderGlobalRanking();
}

function renderGlobalRanking() {
  const { statsMap } = computeAllPlayersStats();
  const q = (document.getElementById('search-player-input')?.value || '').trim().toLowerCase();

  let list = Object.values(statsMap).filter(item => {
    const prof = ensureProfile(item.name);
    if (rankingGenderFilter !== 'all' && prof.gender !== rankingGenderFilter) return false;
    const hay = `${item.name} ${prof.club} ${prof.notes}`.toLowerCase();
    return hay.includes(q);
  });

  list.sort((a, b) => {
    const winPctA = a.PJ ? (a.V / a.PJ) : 0;
    const winPctB = b.PJ ? (b.V / b.PJ) : 0;
    const avgRA = a.PJ ? (a.ratingSum / a.PJ) : 6.5;
    const avgRB = b.PJ ? (b.ratingSum / b.PJ) : 6.5;
    if (rankingSortBy === 'winPct') return winPctB - winPctA;
    if (rankingSortBy === 'avgR') return avgRB - avgRA;
    if (rankingSortBy === 'W') return b.W - a.W;
    if (rankingSortBy === 'lowENF') return (a.PJ ? a.ENF / a.PJ : 99) - (b.PJ ? b.ENF / b.PJ : 99);
    if (rankingSortBy === 'bal') return (b.W - b.ENF) - (a.W - a.ENF);
    if (rankingSortBy === 'elo') return (b.PJ > 0) - (a.PJ > 0) || b.elo - a.elo || b.V - a.V;
    return b.V - a.V || avgRB - avgRA;
  });

  const wrap = document.getElementById('ranking-table-wrap');
  if (list.length === 0) {
    wrap.innerHTML = `<div style="text-align:center;padding:18px;color:var(--text-secondary);font-size:0.8rem;">No hay jugadores registrados con ese filtro</div>`;
  } else {
    wrap.innerHTML = `<div class="rk-card-list">${list.map((item, i) => {
      const prof = ensureProfile(item.name);
      const avgR = item.PJ ? (item.ratingSum / item.PJ).toFixed(1) : '6.5';
      const winPct = item.PJ ? Math.round((item.V / item.PJ) * 100) : 0;
      const safeName = item.name.replace(/'/g, "\\'");
      return `
        <div class="rk-player-row" onclick="openPlayerProfile('${safeName}')">
          <div class="rk-left">
            <span class="rk-rank-num">${i + 1}</span>
            ${renderAvatarHTML(item.name, 'avatar-p1')}
            <div class="rk-info">
              <div class="rk-name">${item.name}</div>
              <div class="rk-sub">${prof.club ? prof.club + ' · ' : ''}${item.PJ} PJ · ${item.V} V (${winPct}%)${formDotsHTML(item.form)}</div>
            </div>
          </div>
          <div class="rk-right">
            <div class="rk-stat-box">
              <span class="rk-stat-val" style="color:var(--cyan);">${item.elo}</span>
              <span class="rk-stat-lbl">ELO</span>
            </div>
            <div class="rk-stat-box">
              <span class="rk-stat-val">${avgR}</span>
              <span class="rk-stat-lbl">VAL MEDIA</span>
            </div>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  }

  renderRankingPodium(statsMap);
  renderH2HSelectors();
  renderPairsRanking();
}

function renderRankingPodium(statsMap) {
  const box = document.getElementById('ranking-podium');
  if (!box) return;
  const top = Object.values(statsMap).filter(st => st.PJ > 0).sort((a, b) => b.elo - a.elo).slice(0, 3);
  if (!top.length) {
    box.innerHTML = `<div class="podium-empty">Juega partidos con jugadores de la base de datos para formar el podio.</div>`;
    return;
  }
  // Orden visual del podio: 2.º · 1.º · 3.º
  const order = [1, 0, 2];
  const heights = { 0: 64, 1: 46, 2: 34 };
  box.innerHTML = order.map(pos => {
    const st = top[pos];
    if (!st) return '<div></div>';
    const safe = st.name.replace(/'/g, "\\'");
    return `
      <div class="podium-slot ${pos === 0 ? 'first' : ''}" onclick="openPlayerProfile('${safe}')">
        ${renderAvatarHTML(st.name, 'avatar-p1')}
        <div class="podium-name">${st.name.split(' ')[0]}</div>
        <div class="podium-elo">${st.elo}</div>
        <div class="podium-step" style="height:${heights[pos]}px;">${pos + 1}</div>
      </div>`;
  }).join('');
}

let profileTab = 'summary';
let profileName = null;

// Detalle de un jugador recorriendo su historial, sus torneos y sus americanos
function computePlayerDetail(name) {
  const d = {
    matches: [], shots: {}, aces: 0, df: 0, partners: {}, rivals: {}, curStreak: 0, bestStreak: 0,
    titles: [], finals: 0, americanoBest: null, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, timeSec: 0
  };
  [...matchHistory].reverse().forEach((m, revIdx) => {
    if (!m || !m.players) return;
    const idx = m.players.findIndex(p => p.name === name);
    if (idx === -1) return;
    const pair = idx < 2 ? 0 : 1;
    const p = m.players[idx];
    const partner = m.players[pair * 2 + (idx % 2 ? 0 : 1)].name;
    const rivals = [m.players[(1 - pair) * 2].name, m.players[(1 - pair) * 2 + 1].name];
    const won = m.winnerPair === pair;
    d.matches.unshift({ m, histIdx: matchHistory.length - 1 - revIdx, won, partner, rivals, pair });
    Object.entries(p.shots || {}).forEach(([k, v]) => { d.shots[k] = (d.shots[k] || 0) + v; });
    d.aces += p.aces || 0;
    d.df += p.df || 0;
    d.timeSec += m.elapsedSec || 0;
    (m.sets || []).forEach(s => {
      if (s[0] + s[1] === 0) return;
      d.gamesWon += s[pair]; d.gamesLost += s[1 - pair];
      if (s[pair] > s[1 - pair]) d.setsWon++; else d.setsLost++;
    });
    const pk = partner;
    d.partners[pk] = d.partners[pk] || { name: pk, pj: 0, v: 0 };
    d.partners[pk].pj++; if (won) d.partners[pk].v++;
    const rk = [...rivals].sort().join(' / ');
    d.rivals[rk] = d.rivals[rk] || { name: rk, pj: 0, v: 0 };
    d.rivals[rk].pj++; if (won) d.rivals[rk].v++;
    d.curStreak = won ? d.curStreak + 1 : 0;
    d.bestStreak = Math.max(d.bestStreak, d.curStreak);
  });
  tournaments.forEach(t => {
    const team = t.teams.find(tm => tm.players.includes(name));
    if (!team) return;
    if (t.champion === team.id) d.titles.push(t.name);
    const final = t.matches.find(m => m.stage === 'ko' && !m.next);
    if (final && (final.a === team.id || final.b === team.id)) d.finals++;
  });
  americanos.forEach(ev => {
    if (!ev.players.includes(name) || ev.status !== 'finished') return;
    const pos = americanoStandings(ev).findIndex(r => r.members.includes(name)) + 1;
    if (pos && (!d.americanoBest || pos < d.americanoBest.pos)) d.americanoBest = { pos, name: ev.name };
  });
  return d;
}

function eloChartSVG(history) {
  if (!history || history.length < 2) return '<div class="empty-note">Juega al menos un partido para ver la evolución.</div>';
  const w = 300, h = 90, pad = 8;
  const min = Math.min(...history), max = Math.max(...history);
  const span = Math.max(20, max - min);
  const pts = history.map((v, i) => [pad + (i / (history.length - 1)) * (w - pad * 2), h - pad - ((v - min) / span) * (h - pad * 2)]);
  const line = pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const last = pts[pts.length - 1];
  return `
    <svg class="elo-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polygon points="${area}" fill="rgba(var(--volt-rgb),0.14)"/>
      <polyline points="${line}" fill="none" stroke="var(--volt)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="var(--volt)"/>
    </svg>
    <div class="elo-chart-legend"><span>Mín. ${min}</span><span>Máx. ${max}</span></div>`;
}

function setProfileTab(tab) {
  profileTab = tab;
  openPlayerProfile(profileName, true);
}

function openPlayerProfile(name, keepTab = false) {
  if (!keepTab) profileTab = 'summary';
  profileName = name;
  const prof = ensureProfile(name);
  const { statsMap } = computeAllPlayersStats();
  const st = statsMap[name] || emptyPlayerStats(name);
  const d = computePlayerDetail(name);
  const avgR = st.PJ ? (st.ratingSum / st.PJ).toFixed(1) : '6.5';
  const rankPos = Object.values(statsMap).filter(s => s.PJ > 0).sort((a, b) => b.elo - a.elo).findIndex(s => s.name === name) + 1;

  const avEl = document.getElementById('prof-avatar');
  if (prof.photo) {
    avEl.innerHTML = `<img src="${prof.photo}" alt="${escapeHtml(name)}">`;
  } else {
    avEl.innerText = getInitials(name);
  }

  document.getElementById('prof-name').innerText = name;
  document.getElementById('prof-meta-badges').innerHTML = `
    ${rankPos ? `<span class="meta-tag" style="color:var(--volt);border-color:var(--volt);">N.º ${rankPos} ELO</span>` : ''}
    <span class="meta-tag">${prof.gender === 'F' ? 'Femenino' : 'Masculino'}</span>
    <span class="meta-tag">${escapeHtml(prof.hand || 'Diestro')}</span>
    <span class="meta-tag">${escapeHtml(prof.prefSide || 'Ambas')}</span>
    ${prof.club ? `<span class="meta-tag">${escapeHtml(prof.club)}</span>` : ''}
  `;

  document.getElementById('btn-open-edit-prof').onclick = () => {
    closePlayerProfile();
    openEditProfileModal(name);
  };

  const per = (v) => (st.PJ ? (v / st.PJ).toFixed(1).replace('.', ',') : '0');
  const winPct = st.PJ ? Math.round((st.V / st.PJ) * 100) : 0;
  const tabs = [['summary', 'Resumen'], ['card', 'Carta'], ['game', 'Juego'], ['matches', 'Partidos']];
  let body = '';

  if (profileTab === 'summary') {
    const bestPartner = Object.values(d.partners).filter(x => x.pj >= 1).sort((a, b) => (b.v / b.pj) - (a.v / a.pj) || b.pj - a.pj)[0];
    const toughRival = Object.values(d.rivals).filter(x => x.pj - x.v > 0).sort((a, b) => (b.pj - b.v) - (a.pj - a.v) || (a.v / a.pj) - (b.v / b.pj))[0];
    body = `
      <div class="kpi-trio">
        <div class="kpi-card"><div class="kpi-label">ELO</div><div class="kpi-value">${st.elo}</div></div>
        <div class="kpi-card"><div class="kpi-label">Victorias</div><div class="kpi-value">${st.V}/${st.PJ} · ${winPct}%</div></div>
        <div class="kpi-card"><div class="kpi-label">Valoración</div><div class="kpi-value">${avgR}</div></div>
      </div>
      <div class="sheet-category-label" style="color:var(--volt);">Evolución del ELO</div>
      ${eloChartSVG(st.eloHistory)}
      <div class="detail-grid">
        <div><span>Forma reciente</span><strong>${formDotsHTML(st.form) || '–'}</strong></div>
        <div><span>Racha actual</span><strong>${d.curStreak} victoria${d.curStreak === 1 ? '' : 's'}</strong></div>
        <div><span>Mejor racha</span><strong>${d.bestStreak} victoria${d.bestStreak === 1 ? '' : 's'}</strong></div>
        <div><span>Último cambio ELO</span><strong style="color:${st.eloDelta >= 0 ? 'var(--emerald)' : 'var(--coral)'};">${st.PJ ? (st.eloDelta >= 0 ? '+' : '') + Math.round(st.eloDelta) : '–'}</strong></div>
        <div><span>Sets ganados</span><strong>${d.setsWon} de ${d.setsWon + d.setsLost}</strong></div>
        <div><span>Juegos ganados</span><strong>${d.gamesWon} de ${d.gamesWon + d.gamesLost}</strong></div>
        <div><span>Tiempo en pista</span><strong>${d.timeSec >= 3600 ? (d.timeSec / 3600).toFixed(1).replace('.', ',') + ' h' : Math.round(d.timeSec / 60) + ' min'}</strong></div>
        <div><span>Torneos ganados</span><strong>${d.titles.length}${d.finals ? ` · ${d.finals} final${d.finals > 1 ? 'es' : ''}` : ''}</strong></div>
      </div>
      ${bestPartner || toughRival || d.americanoBest || d.titles.length ? `
      <div class="sheet-category-label" style="color:var(--volt);">Compañeros y rivales</div>
      <div class="coach-list">
        ${bestPartner ? `<div class="coach-tip"><span class="coach-tag">Pareja</span><span>Mejor compañero: <strong>${escapeHtml(bestPartner.name)}</strong> · ${bestPartner.v} de ${bestPartner.pj} ganados juntos</span></div>` : ''}
        ${toughRival ? `<div class="coach-tip" style="border-left-color:var(--coral);"><span class="coach-tag">Rival</span><span>Pareja más difícil: <strong>${escapeHtml(toughRival.name)}</strong> · ${toughRival.pj - toughRival.v} derrota${toughRival.pj - toughRival.v > 1 ? 's' : ''} en ${toughRival.pj}</span></div>` : ''}
        ${d.titles.length ? `<div class="coach-tip"><span class="coach-tag">Títulos</span><span>${d.titles.map(escapeHtml).join(', ')}</span></div>` : ''}
        ${d.americanoBest ? `<div class="coach-tip"><span class="coach-tag">Americano</span><span>Mejor puesto: <strong>${d.americanoBest.pos}.º</strong> en ${escapeHtml(d.americanoBest.name)}</span></div>` : ''}
      </div>` : ''}
      ${Object.keys(st.badges).length ? `<div class="sheet-category-label" style="color:var(--amber);">Hitos</div>${badgeChipsHTML(Object.keys(st.badges), st.badges)}` : ''}
      ${prof.notes ? `<div class="notes-box">${escapeHtml(prof.notes)}</div>` : ''}`;
  }

  if (profileTab === 'game') {
    const shotNames = [['Volea', 'Volea'], ['Bandeja/Víbora', 'Bandeja / Víbora'], ['Remate', 'Remate'], ['Fondo/Bajada', 'Fondo / Bajada'], ['Saque Directo', 'Saque directo']];
    const maxShot = Math.max(1, ...shotNames.map(([k]) => d.shots[k] || 0));
    body = `
      <div class="kpi-trio">
        <div class="kpi-card"><div class="kpi-label">Winners / partido</div><div class="kpi-value">${per(st.W)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Errores NF / partido</div><div class="kpi-value">${per(st.ENF)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Balance total</div><div class="kpi-value">${st.W - st.ENF > 0 ? '+' : ''}${st.W - st.ENF}</div></div>
      </div>
      <div class="detail-grid">
        <div><span>Winners</span><strong>${st.W}</strong></div>
        <div><span>Errores no forzados</span><strong>${st.ENF}</strong></div>
        <div><span>Errores forzados</span><strong>${st.EF}</strong></div>
        <div><span>Saques directos</span><strong>${d.aces}</strong></div>
        <div><span>Dobles faltas</span><strong>${d.df}</strong></div>
        <div><span>Winners por error</span><strong>${st.ENF ? (st.W / st.ENF).toFixed(2).replace('.', ',') : '–'}</strong></div>
      </div>
      <div class="sheet-category-label" style="color:var(--volt);">Golpes ganadores</div>
      ${shotNames.map(([k, label]) => `
        <div class="shot-bar">
          <span>${label}</span>
          <div class="shot-bar-track"><i style="width:${((d.shots[k] || 0) / maxShot) * 100}%"></i></div>
          <strong>${d.shots[k] || 0}</strong>
        </div>`).join('')}
      ${renderProfileZonesHTML(st)}`;
  }

  if (profileTab === 'card') body = playerCardTabHTML(name);

  if (profileTab === 'matches') {
    body = d.matches.length ? `<div class="profile-matches">${d.matches.slice(0, 15).map(x => `
      <button type="button" class="profile-match ${x.won ? 'won' : 'lost'}" onclick="closePlayerProfile(); openHistoryMatchStats(${x.histIdx})">
        <span class="profile-match-res">${x.won ? 'V' : 'D'}</span>
        <span class="profile-match-body">
          <small>${escapeHtml(x.m.date || '')} · con ${escapeHtml(shortName(x.partner))}</small>
          <strong>vs ${escapeHtml(x.rivals.map(shortName).join(' / '))}</strong>
        </span>
        <span class="profile-match-score">${(x.m.sets || []).filter(s => s[0] + s[1] > 0).map(s => `${s[x.pair]}-${s[1 - x.pair]}`).join(' ')}</span>
      </button>`).join('')}</div>` : '<div class="empty-note">Todavía no ha jugado partidos.</div>';
  }

  document.getElementById('prof-body').innerHTML = `
    <div class="sort-strip" style="margin-top:6px;">${tabs.map(([k, l]) => `<button type="button" class="sort-chip ${profileTab === k ? 'active' : ''}" onclick="setProfileTab('${k}')">${l}</button>`).join('')}</div>
    ${body}
    <button type="button" class="btn-icon" style="width:100%;color:var(--coral);padding:10px;margin-top:12px;" onclick="deletePlayerFromDB(${jsArg(name)})">
      <svg class="icon"><use href="#i-trash"/></svg> Eliminar jugador
    </button>
  `;

  document.getElementById('player-profile-modal').classList.remove('hidden');
  initCardTilt(document.getElementById('prof-body'));
}

function renderProfileZonesHTML(st) {
  const cells = Object.values(st.zones);
  if (!cells.length) return '';
  const zoneTot = { R: { W: 0, E: 0 }, T: { W: 0, E: 0 }, F: { W: 0, E: 0 } };
  Object.entries(st.zones).forEach(([k, v]) => { const z = k[0]; zoneTot[z].W += v.W; zoneTot[z].E += v.E; });
  const net = z => zoneTot[z].W - zoneTot[z].E;
  const withW = ZONES.filter(z => zoneTot[z].W > 0);
  const withE = ZONES.filter(z => zoneTot[z].E > 0);
  const strong = withW.length ? withW.reduce((a, z) => (net(z) > net(a) ? z : a)) : null;
  const weak = withE.length ? withE.reduce((a, z) => (net(z) < net(a) ? z : a)) : null;
  return `
    <div class="sheet-category-label" style="color:var(--cyan);">Mapa de calor · todos sus partidos</div>
    ${renderHalfCourtHeatSVG(st.zones, 'all')}
    <div class="coach-list">
      ${strong ? `<div class="coach-tip"><span class="coach-tag">Fuerte</span><span>Zona fuerte: <strong>${ZONE_NAMES[strong]}</strong> (${zoneTot[strong].W} winners, ${zoneTot[strong].E} errores)</span></div>` : ''}
      ${weak && weak !== strong ? `<div class="coach-tip" style="border-left-color:var(--coral);"><span class="coach-tag">Mejorar</span><span>A mejorar: <strong>${ZONE_NAMES[weak]}</strong> (${zoneTot[weak].E} errores, ${zoneTot[weak].W} winners)</span></div>` : ''}
    </div>`;
}

function closePlayerProfile() {
  document.getElementById('player-profile-modal').classList.add('hidden');
}

function deletePlayerFromDB(name) {
  if (!confirm(`¿Eliminar a ${name} de la base de datos? Sus partidos seguirán en el historial.`)) return;
  dbPlayers = dbPlayers.filter(p => p !== name);
  delete dbProfiles[name];
  saveDB();
  closePlayerProfile();
  renderSetupCourt();
  renderGlobalRanking();
  showToast(`"${name}" eliminado`);
}

function renderH2HSelectors() {
  const s1 = document.getElementById('h2h-p1');
  const s2 = document.getElementById('h2h-p2');
  if (!s1 || !s2) return;
  const opts = dbPlayers.map(p => `<option value="${p}">${p}</option>`).join('');
  s1.innerHTML = opts;
  s2.innerHTML = opts;
  if (dbPlayers.length > 1) s2.selectedIndex = 1;
  renderH2H();
}

function renderH2H() {
  const p1 = document.getElementById('h2h-p1')?.value;
  const p2 = document.getElementById('h2h-p2')?.value;
  const box = document.getElementById('h2h-content');
  if (!box || !p1 || !p2) return;
  const { statsMap } = computeAllPlayersStats();
  const a = statsMap[p1] || { PJ: 0, V: 0, W: 0, ENF: 0 };
  const b = statsMap[p2] || { PJ: 0, V: 0, W: 0, ENF: 0 };
  box.innerHTML = `
    <table>
      <thead><tr><th>Métrica</th><th>${p1}</th><th>${p2}</th></tr></thead>
      <tbody>
        <tr><td>Victorias</td><td>${a.V}</td><td>${b.V}</td></tr>
        <tr><td>Winners</td><td>${a.W}</td><td>${b.W}</td></tr>
        <tr><td>Errores No Forzados</td><td>${a.ENF}</td><td>${b.ENF}</td></tr>
      </tbody>
    </table>
  `;
}

function renderPairsRanking() {
  const wrap = document.getElementById('pairs-ranking-wrap');
  if (!wrap) return;
  const pairs = {};
  matchHistory.forEach(m => {
    if (!m || !m.players) return;
    const k1 = [m.players[0].name, m.players[1].name].sort().join(' / ');
    const k2 = [m.players[2].name, m.players[3].name].sort().join(' / ');
    if (!pairs[k1]) pairs[k1] = { name: k1, PJ: 0, V: 0 };
    if (!pairs[k2]) pairs[k2] = { name: k2, PJ: 0, V: 0 };
    pairs[k1].PJ++;
    pairs[k2].PJ++;
    if (m.winnerPair === 0) pairs[k1].V++;
    else if (m.winnerPair === 1) pairs[k2].V++;
  });
  const list = Object.values(pairs).sort((a, b) => b.V - a.V || (b.V / b.PJ) - (a.V / a.PJ));
  const shown = showAllPairs ? list : list.slice(0, 10);
  if (list.length === 0) {
    wrap.innerHTML = `<div style="font-size:0.76rem;color:var(--text-secondary);">Sin partidos registrados aún.</div>`;
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Pareja</th><th>PJ</th><th>V</th><th>%</th></tr></thead>
      <tbody>
        ${shown.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${p.PJ}</td><td style="color:var(--volt);font-weight:800;">${p.V}</td><td>${Math.round((p.V/p.PJ)*100)}%</td></tr>`).join('')}
      </tbody>
    </table>
    ${list.length > 10 ? `<button type="button" class="btn-icon" style="width:100%;padding:10px;margin-top:8px;" onclick="showAllPairs = !showAllPairs; renderPairsRanking()">${showAllPairs ? 'Ver solo las 10 mejores' : `Ver las ${list.length} parejas`}</button>` : ''}
  `;
}

let showAllPairs = false;
