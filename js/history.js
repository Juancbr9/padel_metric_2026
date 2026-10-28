function renderHistorySummary() {
  const box = document.getElementById('history-summary');
  if (!box) return;
  const secs = matchHistory.reduce((a, m) => a + (m.elapsedSec || 0), 0);
  const pts = matchHistory.reduce((a, m) => a + ((m.points && m.points.length) || 0), 0);
  const hours = secs >= 3600 ? `${(secs / 3600).toFixed(1).replace('.', ',')} h` : `${Math.round(secs / 60)} min`;
  box.innerHTML = [
    [matchHistory.length, 'Partidos'],
    [hours, 'En pista'],
    [pts, 'Puntos registrados']
  ].map(([v, l]) => `<div class="hero-stat"><div class="hero-stat-val">${v}</div><div class="hero-stat-lbl">${l}</div></div>`).join('');
}

function renderHistoryList() {
  renderHistorySummary();
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
  Object.values(SECTIONS).forEach(c => document.getElementById(c.view)?.classList.add('hidden'));
  document.getElementById('view-stats').classList.remove('hidden');
  selectSetFilter('all');
}

function openHistoryMatchPoster(idx) {
  posterTargetState = matchHistory[idx];
  openPosterModal();
}

function deleteHistoryMatch(idx) {
  if (!confirm('¿Eliminar este partido del historial?')) return;
  matchHistory.splice(idx, 1);
  saveDB();
  renderHistoryList();
  renderGlobalRanking();
  showToast('Partido eliminado del historial');
}

function clearAllHistory() {
  if (!matchHistory.length) return;
  if (!confirm(`¿Vaciar el historial completo (${matchHistory.length} partidos)? El ranking ELO se recalculará.`)) return;
  matchHistory = [];
  saveDB();
  renderHistoryList();
  renderGlobalRanking();
  showToast('Historial vaciado');
}

function exportBackupJSON() {
  const payload = { app: 'Padel Metric', version: 3, exportedAt: new Date().toISOString(), dbPlayers, dbProfiles, matchHistory, tournaments, americanos };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = `PadelMetric_BD_${Date.now()}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
}

// Sustituye todos los datos por los de una copia (archivo importado o datos de ejemplo)
function applyBackupData(data) {
  if (!data || !Array.isArray(data.dbPlayers)) throw new Error('Copia no válida');
  dbPlayers = data.dbPlayers;
  dbProfiles = data.dbProfiles || {};
  matchHistory = data.matchHistory || [];
  tournaments = data.tournaments || [];
  americanos = data.americanos || [];
  // Lo importado no cuenta como "borrado" de lo anterior: si hay club, se suma a sus datos
  entityHashes = null;
  saveDB();
  closeAppMenu();
  tView = { mode: 'list', tid: null, tab: null };
  aView = { mode: 'list', aid: null, tab: 'rounds' };
  switchMainTab('home');
}

function hasAnyData() {
  return dbPlayers.length || matchHistory.length || tournaments.length || americanos.length;
}

function importBackupJSON(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (hasAnyData() && !confirm('Se sustituirán los datos actuales por los de la copia. ¿Continuar?')) return;
      applyBackupData(data);
      showToast('Copia de seguridad restaurada');
    } catch (err) {
      showToast('El archivo no es una copia válida de Padel Metric');
    }
  };
  reader.readAsText(file);
}

async function loadDemoData() {
  if (hasAnyData() && !confirm('Se sustituirán los datos actuales por los datos de ejemplo. ¿Continuar?')) return;
  try {
    const res = await fetch('assets/demo/padel-metric-demo.json', { cache: 'no-store' });
    const data = await res.json();
    shiftDemoDates(data);
    applyBackupData(data);
    showToast('Datos de ejemplo cargados');
  } catch (e) {
    showToast('No se pudieron cargar los datos de ejemplo');
  }
}

// Los datos de ejemplo se mueven en el tiempo (días completos) para que el último partido sea reciente
function shiftDemoDates(data) {
  const DAY = 864e5;
  const ids = (data.matchHistory || []).map(m => m.id).filter(Number.isFinite);
  if (!ids.length) return;
  const shift = Math.floor((Date.now() - DAY / 2 - Math.max(...ids)) / DAY) * DAY;
  if (shift <= 0) return;
  data.matchHistory.forEach(m => {
    m.id += shift;
    m.date = new Date(m.id).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  });
  [...(data.tournaments || []), ...(data.americanos || [])].forEach(ev => {
    if (ev.createdAt) ev.createdAt += shift;
    (ev.matches || []).forEach(x => { if (x.historyId) x.historyId += shift; });
  });
}

// Restaurar de fábrica: borra todo lo que guarda la app en este dispositivo
function openFactoryReset() {
  closeAppMenu();
  const summary = `${dbPlayers.length} jugadores, ${matchHistory.length} partidos, ${tournaments.length} torneos y ${americanos.length} americanos`;
  openEventModal(`
    <div class="event-modal-title" style="color:var(--coral);">Restaurar de fábrica</div>
    <div class="reset-title">Borrar todos los datos</div>
    <p class="reset-text">Se eliminarán <strong>${summary}</strong>, el partido en pausa, la portada y los ajustes de este dispositivo. No se puede deshacer.</p>
    <p class="reset-text">Si quieres conservar algo, exporta antes una copia: luego podrás restaurarla desde el menú.</p>
    <button class="btn-volt" onclick="exportBackupJSON(); setTimeout(factoryReset, 600)">Exportar copia y borrar</button>
    <button class="btn-icon reset-danger" onclick="factoryReset()">Borrar sin copia</button>
    <button class="btn-icon" style="width:100%;padding:12px;margin-top:8px;" onclick="closeEventModal()">Cancelar</button>`);
}

function factoryReset() {
  Object.keys(localStorage).filter(k => k.startsWith('pm_')).forEach(k => localStorage.removeItem(k));
  location.reload();
}
