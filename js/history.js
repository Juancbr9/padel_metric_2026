function renderHistoryList() {
  const el = document.getElementById('history-list');
  if (!el) return;
  if (matchHistory.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:0.8rem;">Todavía no hay partidos guardados en el historial.</div>`;
    return;
  }
  el.innerHTML = matchHistory.map((m, idx) => {
    const scoreStr = m.sets.map(s => `${s[0]}-${s[1]}`).join(' · ');
    return `
      <div class="rk-player-row" style="margin-bottom:8px;cursor:default;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.64rem;color:var(--volt);font-weight:800;">${m.date || ''} · ${scoreStr}</div>
          <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:800;text-transform:uppercase;">
            ${m.players[0].name}/${m.players[1].name} vs ${m.players[2].name}/${m.players[3].name}
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn-icon" onclick="openHistoryMatchStats(${idx})"><svg class="icon"><use href="#i-chart"/></svg></button>
          <button class="btn-icon" style="color:var(--volt);" onclick="openHistoryMatchPoster(${idx})"><svg class="icon"><use href="#i-share"/></svg></button>
          <button class="btn-icon" style="color:var(--coral);" onclick="deleteHistoryMatch(${idx})"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div>
      </div>
    `;
  }).join('');
}

function openHistoryMatchStats(idx) {
  posterTargetState = matchHistory[idx];
  statsSourceIsHistory = true;
  document.getElementById('view-history').classList.add('hidden');
  document.getElementById('view-stats').classList.remove('hidden');
  selectSetFilter('all');
}

function openHistoryMatchPoster(idx) {
  posterTargetState = matchHistory[idx];
  openPosterModal();
}

function deleteHistoryMatch(idx) {
  matchHistory.splice(idx, 1);
  saveDB();
  renderHistoryList();
  renderGlobalRanking();
  showToast('Partido eliminado del historial');
}

function clearAllHistory() {
  matchHistory = [];
  saveDB();
  renderHistoryList();
  renderGlobalRanking();
  showToast('Historial vaciado');
}

function exportBackupJSON() {
  const payload = { dbPlayers, dbProfiles, matchHistory };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = `PadelMetric_BD_${Date.now()}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
}

function importBackupJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.dbPlayers) dbPlayers = data.dbPlayers;
      if (data.dbProfiles) dbProfiles = data.dbProfiles;
      if (data.matchHistory) matchHistory = data.matchHistory;
      saveDB();
      renderSetupCourt();
      renderGlobalRanking();
      renderHistoryList();
      showToast('Base de datos importada con éxito');
    } catch (err) {
      showToast('Archivo JSON no válido');
    }
  };
  reader.readAsText(file);
}
