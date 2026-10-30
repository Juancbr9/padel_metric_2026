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
  ].map(([v, l]) => `<div class="hero-stat"><div class="hero-stat-val" ${typeof v === 'number' ? `data-count="${v}"` : ''}>${v}</div><div class="hero-stat-lbl">${l}</div></div>`).join('');
}

// ---------- Lista del historial: tarjetas por mes, búsqueda y filtros ----------
let historyFilter = 'all';
const HISTORY_FILTERS = [['all', 'Todos'], ['me', 'Mis partidos'], ['tournament', 'Torneo'], ['M', 'Masculino'], ['F', 'Femenino'], ['X', 'Mixto']];
const DEUCE_NAMES = { adv: 'Ventaja', golden: 'Punto de oro', star: 'Star point' };

function setHistoryFilter(f) {
  historyFilter = f;
  renderHistoryList();
}

function matchGenderOf(m) {
  const g = new Set(m.players.filter(p => !p.isGeneric).map(p => ensureProfile(p.name).gender || 'M'));
  return g.size === 2 ? 'X' : g.has('F') ? 'F' : 'M';
}

function historyMatchPasses(m, q) {
  if (!m || !m.players) return false;
  if (historyFilter === 'me' && !m.players.some(p => p.name === myPlayerName)) return false;
  if (historyFilter === 'tournament' && !m.link) return false;
  if (['M', 'F', 'X'].includes(historyFilter) && matchGenderOf(m) !== historyFilter) return false;
  return !q || m.players.map(p => p.name).join(' ').toLowerCase().includes(q);
}

function historyPairRow(m, pair) {
  const a = m.players[pair * 2], b = m.players[pair * 2 + 1];
  const won = m.winnerPair === pair;
  const sets = (m.sets || []).filter(s => s[0] + s[1] > 0);
  return `<div class="hm-row ${won ? 'won' : ''} ${pair ? 'b' : 'a'}">
    <span class="hm-avs">${renderAvatarHTML(a.name, pair ? 'avatar-p2' : 'avatar-p1', '', a.isGeneric, a.isGeneric ? 'J' : '')}${renderAvatarHTML(b.name, pair ? 'avatar-p2' : 'avatar-p1', '', b.isGeneric, b.isGeneric ? 'J' : '')}</span>
    <span class="hm-names">${escapeHtml(liveSurname(a))} / ${escapeHtml(liveSurname(b))}</span>
    ${won ? '<svg class="icon hm-trophy"><use href="#i-trophy"/></svg>' : ''}
    <span class="hm-sets">${sets.map(s => `<i class="${s[pair] > s[1 - pair] ? 'w' : ''}">${s[pair]}</i>`).join('')}</span>
  </div>`;
}

function historySpark(m) {
  const series = wpSeries(m);
  if (!series || series.length < 3) return '';
  const w = 120, h = 22, mid = h / 2;
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${((i / (series.length - 1)) * w).toFixed(1)} ${(mid - (p.wp - 0.5) * 2 * (mid - 1.5)).toFixed(1)}`).join('');
  return `<svg class="hm-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Probabilidad de victoria"><line x1="0" y1="${mid}" x2="${w}" y2="${mid}"/><path d="${line}"/></svg>`;
}

function renderHistoryList() {
  renderHistorySummary();
  const el = document.getElementById('history-list');
  if (!el) return;
  const filters = HISTORY_FILTERS.filter(([k]) => k !== 'me' || (myPlayerName && dbPlayers.includes(myPlayerName)));
  if (historyFilter === 'me' && !filters.some(([k]) => k === 'me')) historyFilter = 'all';
  const fbox = document.getElementById('history-filters');
  if (fbox) fbox.innerHTML = filters.map(([k, l]) => `<button type="button" class="sort-chip ${historyFilter === k ? 'active' : ''}" onclick="setHistoryFilter('${k}')">${l}</button>`).join('');
  if (matchHistory.length === 0) {
    el.innerHTML = `<div class="empty-note">Todavía no hay partidos guardados. Juega uno desde <strong>Partido</strong> y aparecerá aquí con sus estadísticas.</div>`;
    return;
  }
  const q = (document.getElementById('history-search')?.value || '').trim().toLowerCase();
  const months = [];
  matchHistory.forEach((m, idx) => {
    if (!historyMatchPasses(m, q)) return;
    const d = new Date(m.id || Date.now());
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = months[months.length - 1];
    if (!g || g.key !== key) {
      const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      g = { key, label: label.charAt(0).toUpperCase() + label.slice(1), items: [] };
      months.push(g);
    }
    g.items.push({ m, idx });
  });
  if (!months.length) {
    el.innerHTML = '<div class="empty-note">Ningún partido coincide con la búsqueda.</div>';
    return;
  }
  el.innerHTML = months.map(g => `
    <div class="hm-month"><span>${g.label}</span><small>${g.items.length} partido${g.items.length === 1 ? '' : 's'}</small></div>
    ${g.items.map(({ m, idx }) => {
      const chips = [
        m.link && m.link.kind === 'tournament' ? '<span class="hm-chip t">Torneo</span>' : '',
        m.deuceRule ? `<span class="hm-chip">${DEUCE_NAMES[m.deuceRule] || ''}</span>` : '',
        m.elapsedSec ? `<span class="hm-chip">${formatMatchDuration(m.elapsedSec)}</span>` : ''
      ].join('');
      return `<div class="hm-card" role="button" tabindex="0" onclick="openHistoryMatchStats(${idx})">
        <div class="hm-top"><span class="hm-date">${escapeHtml(m.date || '')}</span><span class="hm-chips">${chips}</span>
          <button type="button" class="hm-more" onclick="event.stopPropagation(); openHistoryActions(${idx})" aria-label="Más opciones">···</button></div>
        ${historyPairRow(m, 0)}${historyPairRow(m, 1)}
        <div class="hm-foot">${historySpark(m) || '<span></span>'}<span>Ver estadísticas ›</span></div>
      </div>`;
    }).join('')}`).join('');
}

function openHistoryActions(idx) {
  const m = matchHistory[idx];
  if (!m) return;
  const row = (icon, label, action, cls = '') => `<button type="button" class="menu-row ${cls}" onclick="closeEventModal(); ${action}">
    <svg class="icon"><use href="#${icon}"/></svg><span>${label}</span><span class="menu-row-hint">›</span></button>`;
  openEventModal(`
    <div class="mo-title">${escapeHtml(livePairName(0, m))} vs ${escapeHtml(livePairName(1, m))}</div>
    <p class="bc-intro">${escapeHtml(m.date || '')} · ${(m.sets || []).filter(s => s[0] + s[1] > 0).map(s => `${s[0]}-${s[1]}`).join(' ')}</p>
    <div class="menu-list">
      ${row('i-chart', 'Ver estadísticas', `openHistoryMatchStats(${idx})`)}
      ${row('i-share', 'Póster para compartir', `openHistoryMatchPoster(${idx})`)}
      ${row('i-trash', 'Eliminar partido', `deleteHistoryMatch(${idx})`, 'menu-row-danger')}
    </div>`);
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
    <div class="event-modal-title u-bad">Restaurar de fábrica</div>
    <div class="reset-title">Borrar todos los datos</div>
    <p class="reset-text">Se eliminarán <strong>${summary}</strong>, el partido en pausa, la portada y los ajustes de este dispositivo. No se puede deshacer.</p>
    <p class="reset-text">Si quieres conservar algo, exporta antes una copia: luego podrás restaurarla desde el menú.</p>
    <button class="btn-volt" onclick="exportBackupJSON(); setTimeout(factoryReset, 600)">Exportar copia y borrar</button>
    <button class="btn-icon reset-danger" onclick="factoryReset()">Borrar sin copia</button>
    <button class="btn-icon btn-block" onclick="closeEventModal()">Cancelar</button>`);
}

function factoryReset() {
  Object.keys(localStorage).filter(k => k.startsWith('pm_')).forEach(k => localStorage.removeItem(k));
  location.reload();
}
