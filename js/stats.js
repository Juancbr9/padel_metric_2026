// ==========================================================
// ESTADÍSTICAS DEL PARTIDO (SIN DRIVE / REVÉS TRAS EL NOMBRE)
// ==========================================================
function toggleStatsView() {
  const statsView = document.getElementById('view-stats');
  const matchView = document.getElementById('view-match');
  if (statsView.classList.contains('hidden')) {
    statsSourceIsHistory = false;
    posterTargetState = state;
    document.body.classList.remove('in-live-match');
    matchView.classList.add('hidden');
    statsView.classList.remove('hidden');
    selectSetFilter('all');
  } else {
    statsView.classList.add('hidden');
    if (statsSourceIsHistory) {
      document.getElementById('main-nav').classList.remove('hidden');
      switchMainTab('history');
    } else {
      document.body.classList.add('in-live-match');
      matchView.classList.remove('hidden');
    }
  }
}

function selectSetFilter(flt) {
  currentSetFilter = flt;
  ['all', 0, 1, 2].forEach(k => {
    document.getElementById(`setflt-${k}`)?.classList.toggle('active', k === flt);
  });
  renderStats(currentStatsMode);
}

function getFilteredPlayerStats(p) {
  if (currentSetFilter === 'all' || !p.setStats) {
    return { W: p.W, ENF: p.ENF, EF: p.EF };
  }
  return p.setStats[currentSetFilter] || { W: 0, ENF: 0, EF: 0 };
}

function renderStats(mode) {
  currentStatsMode = mode;
  const target = posterTargetState || state;
  if (!target) return;

  const playersData = target.players.map(p => {
    const st = getFilteredPlayerStats(p);
    const rating = calcPlayerRating(p);
    return { ...p, fW: st.W, fENF: st.ENF, fEF: st.EF, rating };
  });

  const mvp = [...playersData].sort((a, b) => b.rating - a.rating)[0];
  const sniper = [...playersData].sort((a, b) => b.fW - a.fW)[0];
  const wall = [...playersData].sort((a, b) => a.fENF - b.fENF)[0];

  document.getElementById('mvp-highlights').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">MVP Pista</div><div class="kpi-value">${mvp.name}</div></div>
    <div class="kpi-card"><div class="kpi-label">Más Winners</div><div class="kpi-value">${sniper.name} (${sniper.fW})</div></div>
    <div class="kpi-card"><div class="kpi-label">Más Sólido</div><div class="kpi-value">${wall.name} (${wall.fENF})</div></div>
  `;

  const container = document.getElementById('stats-content');

  if (mode === 'ind') {
    let rows = playersData.map(p => {
      const bal = p.fW - p.fENF;
      const balStr = bal > 0 ? `+${bal}` : `${bal}`;
      return `
        <tr>
          <td style="font-weight:800;">${p.name}</td>
          <td style="color:var(--emerald);font-weight:800;">${p.fW}</td>
          <td style="color:var(--coral);font-weight:800;">${p.fENF}</td>
          <td style="color:var(--amber);">${p.fEF}</td>
          <td style="font-weight:800;">${balStr}</td>
          <td style="color:var(--volt);font-weight:800;">${p.rating.toFixed(1)}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table>
        <thead>
          <tr><th>Jugador</th><th>W</th><th>ENF</th><th>EF</th><th>Bal</th><th>Val</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } else if (mode === 'pair') {
    const p1W = playersData[0].fW + playersData[1].fW;
    const p2W = playersData[2].fW + playersData[3].fW;
    const p1ENF = playersData[0].fENF + playersData[1].fENF;
    const p2ENF = playersData[2].fENF + playersData[3].fENF;
    const wTot = p1W + p2W || 1;
    const enfTot = p1ENF + p2ENF || 1;

    container.innerHTML = `
      <div class="tv-compare-row">
        <div class="tv-compare-header"><span style="color:var(--cyan);">${p1W}</span><span>WINNERS</span><span style="color:var(--coral);">${p2W}</span></div>
        <div class="tv-compare-track">
          <div class="tv-bar-p1" style="width:${(p1W / wTot) * 100}%"></div>
          <div class="tv-bar-p2" style="width:${(p2W / wTot) * 100}%"></div>
        </div>
      </div>
      <div class="tv-compare-row">
        <div class="tv-compare-header"><span style="color:var(--cyan);">${p1ENF}</span><span>ERRORES NO FORZADOS</span><span style="color:var(--coral);">${p2ENF}</span></div>
        <div class="tv-compare-track">
          <div class="tv-bar-p1" style="width:${(p1ENF / enfTot) * 100}%"></div>
          <div class="tv-bar-p2" style="width:${(p2ENF / enfTot) * 100}%"></div>
        </div>
      </div>
    `;
  } else if (mode === 'heatmap') {
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
        ${playersData.map(p => `
          <div style="background:var(--bg-obsidian);border:1px solid var(--border-subtle);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:900;text-transform:uppercase;">${p.name}</div>
            <div style="font-size:0.7rem;color:var(--text-secondary);margin-top:4px;">Participación: <strong style="color:var(--volt);">${p.fW + p.fENF + p.fEF}</strong> ptos</div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (mode === 'shots') {
    let rows = target.players.map(p => {
      const sh = p.shots || {};
      return `
        <tr>
          <td style="font-weight:800;">${p.name}</td>
          <td>${sh['Volea'] || 0}</td>
          <td>${sh['Bandeja/Víbora'] || 0}</td>
          <td>${sh['Remate'] || 0}</td>
          <td>${sh['Fondo/Bajada'] || 0}</td>
        </tr>
      `;
    }).join('');
    container.innerHTML = `
      <table>
        <thead><tr><th>Jugador</th><th>Volea</th><th>Band</th><th>Rem</th><th>Fondo</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }
}
