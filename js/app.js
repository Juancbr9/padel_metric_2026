// ==========================================================
// NAVEGACIÓN: MENÚ SUPERIOR Y SECCIONES
// ==========================================================
const SECTIONS = {
  home: { view: 'view-home', section: 'home', label: 'Inicio' },
  setup: { view: 'view-setup', section: 'match', label: 'Partido' },
  tournaments: { view: 'view-tournaments', section: 'events', label: 'Torneos' },
  americano: { view: 'view-americano', section: 'events', label: 'Americano · Mexicano' },
  ranking: { view: 'view-ranking', section: 'ranking', label: 'Ranking' },
  history: { view: 'view-history', section: 'history', label: 'Historial' }
};
let currentTab = 'home';

function setSectionIdentity(section, label) {
  document.body.dataset.section = section;
  const el = document.getElementById('section-label');
  if (el) el.innerText = label;
}

function switchMainTab(tab) {
  closeAppMenu();
  currentTab = tab;
  Object.entries(SECTIONS).forEach(([key, cfg]) => {
    document.getElementById(cfg.view)?.classList.toggle('hidden', key !== tab);
    document.getElementById(`menu-${key}`)?.classList.toggle('active', key === tab);
  });
  setSectionIdentity(SECTIONS[tab].section, SECTIONS[tab].label);
  window.scrollTo(0, 0);
  if (tab === 'home') renderHome();
  if (tab === 'setup') renderSetupCourt();
  if (tab === 'ranking') renderGlobalRanking();
  if (tab === 'history') renderHistoryList();
  if (tab === 'tournaments') renderTournamentsView();
  if (tab === 'americano') renderAmericanoView();
}

function toggleAppMenu() {
  // Durante un partido en directo el menú queda bloqueado (se sale con "Salir")
  if (document.getElementById('main-nav')?.classList.contains('hidden')) return;
  const menu = document.getElementById('app-menu');
  if (menu.classList.contains('hidden')) {
    renderMenuSwitches();
    menu.classList.remove('hidden');
    document.body.classList.add('menu-open');
    vibrate(8);
  } else {
    closeAppMenu();
  }
}

function closeAppMenu() {
  document.getElementById('app-menu')?.classList.add('hidden');
  document.body.classList.remove('menu-open');
}

function renderMenuSwitches() {
  document.getElementById('sw-theme')?.classList.toggle('on', document.body.classList.contains('light-mode'));
  document.getElementById('sw-voice')?.classList.toggle('on', voiceEnabled);
  document.getElementById('sw-vibration')?.classList.toggle('on', appSettings.vibration);
  document.getElementById('sw-wakeLock')?.classList.toggle('on', appSettings.wakeLock);
}

function toggleAppSetting(key) {
  appSettings[key] = !appSettings[key];
  try { localStorage.setItem('pm_ajustes_v1', JSON.stringify(appSettings)); } catch (e) {}
  renderMenuSwitches();
  vibrate(12);
}

// Exporta todos los partidos a un CSV que abre Excel o Google Sheets
function exportHistoryCSV() {
  if (!matchHistory.length) {
    showToast('Todavía no hay partidos para exportar');
    return;
  }
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Fecha', 'Pareja 1', 'Pareja 2', 'Resultado', 'Ganador', 'Duración (min)', 'Jugador', 'Pareja', 'Winners', 'Errores no forzados', 'Errores forzados', 'Saques directos', 'Dobles faltas', 'Valoración'];
  const rows = [header.map(esc).join(';')];
  matchHistory.forEach(m => {
    if (!m || !m.players) return;
    const p1 = `${m.players[0].name} / ${m.players[1].name}`;
    const p2 = `${m.players[2].name} / ${m.players[3].name}`;
    const score = (m.sets || []).filter(s => s[0] + s[1] > 0).map(s => `${s[0]}-${s[1]}`).join(' ');
    const winner = m.winnerPair === 0 ? p1 : m.winnerPair === 1 ? p2 : '';
    m.players.forEach((p, idx) => {
      rows.push([m.date, p1, p2, score, winner, Math.round((m.elapsedSec || 0) / 60), p.name, idx < 2 ? 1 : 2,
        p.W || 0, p.ENF || 0, p.EF || 0, p.aces || 0, p.df || 0, calcPlayerRating(p).toFixed(1).replace('.', ',')].map(esc).join(';'));
    });
  });
  const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.download = `PadelMetric_partidos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.href = URL.createObjectURL(blob);
  a.click();
  showToast('Partidos exportados para Excel');
}

window.addEventListener('DOMContentLoaded', () => {
  loadCustomCover();
  initAvatarCropperEvents();
  initPlayerCardInteractions();
  renderVoiceToggle();
  switchMainTab('home');
  initSync();
});

// Botón "Instalar app": el navegador avisa cuando la app se puede instalar
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('btn-install-pwa')?.classList.remove('hidden');
});

async function triggerInstallPWA() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  try { await deferredInstallPrompt.userChoice; } catch (e) {}
  deferredInstallPrompt = null;
  document.getElementById('btn-install-pwa')?.classList.add('hidden');
}

window.addEventListener('appinstalled', () => {
  document.getElementById('btn-install-pwa')?.classList.add('hidden');
  showToast('Padel Metric instalada');
});

// App instalable y uso sin conexión
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Pide al sistema que no borre los datos guardados de la app
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
