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
  document.querySelectorAll('#stats-tabs .sort-chip').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

  const playersData = target.players.map(p => {
    const st = getFilteredPlayerStats(p);
    const rating = calcPlayerRating(p);
    return { ...p, fW: st.W, fENF: st.ENF, fEF: st.EF, rating };
  });

  const mvp = [...playersData].sort((a, b) => b.rating - a.rating)[0];
  const sniper = [...playersData].sort((a, b) => b.fW - a.fW)[0];
  const wall = [...playersData].sort((a, b) => a.fENF - b.fENF)[0];

  document.getElementById('mvp-highlights').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Mejor valorado</div><div class="kpi-value">${mvp.name}</div></div>
    <div class="kpi-card"><div class="kpi-label">Más winners</div><div class="kpi-value">${sniper.name} (${sniper.fW})</div></div>
    <div class="kpi-card"><div class="kpi-label">Menos errores</div><div class="kpi-value">${wall.name} (${wall.fENF})</div></div>
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
    container.innerHTML = renderHeatmapPanel(target);
  } else if (mode === 'clave') {
    container.innerHTML = renderKeyMomentsPanel(target);
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

// ==========================================================
// MOMENTOS CLAVE, SAQUE / RESTO, ENTRENADOR Y LOGROS DEL PARTIDO
// ==========================================================
function renderKeyMomentsPanel(target) {
  if (!(target.points || []).length) {
    return `<div class="empty-note">Este partido se jugó con una versión anterior y no tiene registro punto a punto.<br>Los partidos nuevos mostrarán aquí bolas de break, saque, rachas y consejos.</div>`;
  }
  const { pair, clutchTop } = computePressureStats(target, currentSetFilter);
  const row = (label, a, b) => {
    const tot = (a.n + b.n) || 1;
    return `
      <div class="tv-compare-row">
        <div class="tv-compare-header"><span style="color:var(--cyan);">${a.txt}</span><span>${label}</span><span style="color:var(--coral);">${b.txt}</span></div>
        <div class="tv-compare-track">
          <div class="tv-bar-p1" style="width:${(a.n / tot) * 100}%"></div>
          <div class="tv-bar-p2" style="width:${(b.n / tot) * 100}%"></div>
        </div>
      </div>`;
  };
  const frac = (x, y) => ({ n: pct(x, y), txt: y ? `${x}/${y} (${pct(x, y)}%)` : '–' });
  const [A, B] = pair;
  const tips = generateCoachInsights(target, currentSetFilter);
  const badges = target.players.map((p, idx) => {
    const keys = badgesForPlayerInMatch(target, idx);
    return keys.length ? `<div class="badge-player"><strong>${p.name}</strong>${badgeChipsHTML(keys)}</div>` : '';
  }).join('');

  return `
    <div class="sheet-category-label" style="color:var(--volt);">Puntos clave</div>
    ${row('BOLAS DE BREAK GANADAS', frac(A.bpWon, A.bpChances), frac(B.bpWon, B.bpChances))}
    ${row('BOLAS DE BREAK SALVADAS', frac(A.bpSaved, A.bpFaced), frac(B.bpSaved, B.bpFaced))}
    ${row('PUNTOS DE ORO', { n: A.goldWon, txt: A.goldWon }, { n: B.goldWon, txt: B.goldWon })}
    ${row('PUNTOS EN TIE-BREAK', { n: A.tbWon, txt: A.tbWon }, { n: B.tbWon, txt: B.tbWon })}
    ${row('RACHA MÁXIMA (PTOS SEGUIDOS)', { n: A.maxRun, txt: A.maxRun }, { n: B.maxRun, txt: B.maxRun })}
    <div class="sheet-category-label" style="color:var(--volt);">Saque y resto</div>
    ${row('PUNTOS GANADOS CON 1.ER SAQUE', frac(A.firstWon, A.first), frac(B.firstWon, B.first))}
    ${row('PUNTOS GANADOS CON 2.º SAQUE', frac(A.secondWon, A.second), frac(B.secondWon, B.second))}
    ${row('PUNTOS GANADOS AL RESTO', frac(A.returnWon, A.returnPts), frac(B.returnWon, B.returnPts))}
    ${clutchTop ? `<div class="notes-box" style="margin-top:8px;"><strong>Puntos decisivos:</strong> ${clutchTop[0]} hizo ${clutchTop[1]} winner${clutchTop[1] > 1 ? 's' : ''} en bolas de break, puntos de oro o tie-break.</div>` : ''}
    <div class="sheet-category-label" style="color:var(--cyan);">Análisis del partido</div>
    <div class="coach-list">${tips.map(t => `<div class="coach-tip"><span class="coach-tag">${t.tag}</span><span>${t.text}</span></div>`).join('')}</div>
    ${badges ? `<div class="sheet-category-label" style="color:var(--amber);">Hitos del partido</div>${badges}` : ''}
  `;
}
