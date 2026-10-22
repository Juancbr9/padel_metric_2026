// ==========================================================
// RANKING GLOBAL, CARA A CARA, HISTORIAL Y NAVEGACIÓN
// ==========================================================
function computeAllPlayersStats() {
  const statsMap = {};
  dbPlayers.forEach(name => {
    statsMap[name] = { name, PJ: 0, V: 0, W: 0, ENF: 0, EF: 0, ratingSum: 0, form: [] };
  });

  matchHistory.forEach(m => {
    if (!m || !m.players) return;
    m.players.forEach((p, idx) => {
      if (p.isGeneric) return;
      if (!statsMap[p.name]) {
        statsMap[p.name] = { name: p.name, PJ: 0, V: 0, W: 0, ENF: 0, EF: 0, ratingSum: 0, form: [] };
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
    });
  });

  return { statsMap };
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
  ['V', 'winPct', 'avgR', 'W', 'lowENF', 'bal'].forEach(k => {
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
              <div class="rk-sub">${prof.club ? prof.club + ' · ' : ''}${item.PJ} PJ · ${item.V} V (${winPct}%)</div>
            </div>
          </div>
          <div class="rk-right">
            <div class="rk-stat-box">
              <span class="rk-stat-val">${avgR}</span>
              <span class="rk-stat-lbl">VAL MEDIA</span>
            </div>
          </div>
        </div>
      `;
    }).join('')}</div>`;
  }

  renderH2HSelectors();
  renderPairsRanking();
}

function openPlayerProfile(name) {
  const prof = ensureProfile(name);
  const { statsMap } = computeAllPlayersStats();
  const st = statsMap[name] || { PJ: 0, V: 0, W: 0, ENF: 0, EF: 0, ratingSum: 0 };
  const avgR = st.PJ ? (st.ratingSum / st.PJ).toFixed(1) : '6.5';

  const avEl = document.getElementById('prof-avatar');
  if (prof.photo) {
    avEl.innerHTML = `<img src="${prof.photo}" alt="${name}">`;
  } else {
    avEl.innerText = getInitials(name);
  }

  document.getElementById('prof-name').innerText = name;
  document.getElementById('prof-meta-badges').innerHTML = `
    <span class="meta-tag">${prof.hand || 'Diestro'}</span>
    <span class="meta-tag">${prof.prefSide || 'Ambas'}</span>
    ${prof.club ? `<span class="meta-tag">${prof.club}</span>` : ''}
  `;

  document.getElementById('btn-open-edit-prof').onclick = () => {
    closePlayerProfile();
    openEditProfileModal(name);
  };

  const safeName = name.replace(/'/g, "\\'");
  document.getElementById('prof-body').innerHTML = `
    <div class="kpi-trio">
      <div class="kpi-card"><div class="kpi-label">Partidos / Vict</div><div class="kpi-value">${st.PJ} / ${st.V}</div></div>
      <div class="kpi-card"><div class="kpi-label">Winners / ENF</div><div class="kpi-value">${st.W} / ${st.ENF}</div></div>
      <div class="kpi-card"><div class="kpi-label">Valoración</div><div class="kpi-value">${avgR}</div></div>
    </div>
    ${prof.notes ? `<div class="notes-box">${prof.notes}</div>` : ''}
    <button type="button" class="btn-icon" style="width:100%;color:var(--coral);padding:10px;margin-top:8px;" onclick="deletePlayerFromDB('${safeName}')">
      <svg class="icon"><use href="#i-trash"/></svg> ELIMINAR JUGADOR DE LA BD
    </button>
  `;

  document.getElementById('player-profile-modal').classList.remove('hidden');
}

function closePlayerProfile() {
  document.getElementById('player-profile-modal').classList.add('hidden');
}

function deletePlayerFromDB(name) {
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
  const list = Object.values(pairs).sort((a, b) => b.V - a.V);
  if (list.length === 0) {
    wrap.innerHTML = `<div style="font-size:0.76rem;color:var(--text-secondary);">Sin partidos registrados aún.</div>`;
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Pareja</th><th>PJ</th><th>V</th><th>%</th></tr></thead>
      <tbody>
        ${list.map(p => `<tr><td>${p.name}</td><td>${p.PJ}</td><td style="color:var(--volt);font-weight:800;">${p.V}</td><td>${Math.round((p.V/p.PJ)*100)}%</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}
