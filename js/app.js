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
  closeMatchEnd();
  // Las estadísticas de un partido del historial se cierran al ir a otra sección
  if (!document.body.classList.contains('in-live-match')) document.getElementById('view-stats')?.classList.add('hidden');
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
  fxEnter(document.getElementById(SECTIONS[tab].view));
}

function toggleAppMenu() {
  // Durante un partido en directo el menú queda bloqueado (se sale con "Salir")
  if (document.getElementById('main-nav')?.classList.contains('hidden')) return;
  const menu = document.getElementById('app-menu');
  if (menu.classList.contains('hidden')) {
    renderDrawerMe();
    renderSyncHint();
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

// Tocar el logo lleva al inicio (salvo durante un partido en directo)
function brandTap() {
  if (document.body.classList.contains('in-live-match') || document.getElementById('main-nav')?.classList.contains('hidden')) return;
  if (currentTab !== 'home') switchMainTab('home');
}

// Cabecera del menú lateral: tu perfil si has elegido "Soy yo"
function renderDrawerMe() {
  const box = document.getElementById('drawer-me');
  if (!box) return;
  if (!myPlayerName || !dbPlayers.includes(myPlayerName)) {
    box.innerHTML = `<button type="button" class="drawer-me empty" onclick="closeAppMenu(); openMyCard()">
      <span class="drawer-ico"><svg class="icon"><use href="#i-users"/></svg></span>
      <span class="drawer-txt"><strong>Elige tu perfil</strong><small>Para ver tu carta, tu ELO y tu temporada</small></span></button>`;
    return;
  }
  const { statsMap } = computeAllPlayersStats();
  const st = statsMap[myPlayerName] || emptyPlayerStats(myPlayerName);
  box.innerHTML = `<button type="button" class="drawer-me" onclick="closeAppMenu(); openMyCard()">
    ${renderAvatarHTML(myPlayerName, 'avatar-md')}
    <span class="drawer-txt"><strong>${escapeHtml(myPlayerName)}</strong><small>ELO ${st.elo} · ${st.PJ} partidos · ${st.PJ ? Math.round((st.V / st.PJ) * 100) : 0} % victorias</small></span></button>`;
}

function openMyCard() {
  if (myPlayerName && dbPlayers.includes(myPlayerName)) {
    openPlayerProfile(myPlayerName);
    setProfileTab('card');
    return;
  }
  switchMainTab('ranking');
  showToast('Toca tu nombre, abre la pestaña Carta y pulsa "Soy yo"');
}

// Ajustes: interruptores y reglas en una sola hoja
function openSettingsSheet() {
  const sw = (id, icon, label, action) => `<button type="button" class="menu-row" onclick="${action}">
    <svg class="icon"><use href="#${icon}"/></svg><span>${label}</span><span class="switch" id="sw-${id}"></span></button>`;
  openEventModal(`
    <div class="mo-title">Ajustes</div>
    <div class="menu-list">
      ${sw('theme', 'i-moon', 'Modo claro', 'toggleThemeMode()')}
      ${sw('voice', 'i-volume', 'Narrador de voz', 'toggleVoiceNarrator()')}
      ${sw('vibration', 'i-vibrate', 'Vibración al anotar', "toggleAppSetting('vibration')")}
      ${sw('wakeLock', 'i-screen', 'Pantalla siempre encendida en partido', "toggleAppSetting('wakeLock')")}
      ${sw('sound', 'i-music', 'Sonidos en juegos, sets y partido', "toggleAppSetting('sound')")}
    </div>
    <div class="menu-group-title">Partido</div>
    <div class="menu-list">
      <button type="button" class="menu-row" onclick="closeEventModal(); openRulesModal()">
        <svg class="icon"><use href="#i-sliders"/></svg><span>Reglas y modo de anotación</span><span class="menu-row-hint">›</span></button>
      <button type="button" class="menu-row" onclick="closeEventModal(); document.getElementById('cover-upload').click()">
        <svg class="icon"><use href="#i-camera"/></svg><span>Foto de portada del partido</span><span class="menu-row-hint">›</span></button>
    </div>
    <div class="menu-group-title">Datos</div>
    <div class="menu-list">
      <button type="button" class="menu-row" onclick="openDataSheet()">
        <svg class="icon"><use href="#i-save"/></svg><span>Copias de seguridad, Excel y restaurar</span><span class="menu-row-hint">›</span></button>
    </div>
    <div class="menu-group-title">Acerca de</div>
    <div class="menu-list">
      <button type="button" class="menu-row" onclick="openNewsSheet()">
        <svg class="icon"><use href="#i-star"/></svg><span>Novedades de la versión ${APP_VERSION}</span><span class="menu-row-hint">›</span></button>
    </div>`);
  renderMenuSwitches();
}

// Datos: copias de seguridad, Excel, datos de ejemplo y borrar
function openDataSheet() {
  const row = (icon, label, hint, action, cls = '') => `<button type="button" class="menu-row ${cls}" onclick="${action}">
    <svg class="icon"><use href="#${icon}"/></svg><span>${label}</span><span class="menu-row-hint">${hint}</span></button>`;
  openEventModal(`
    <div class="mo-title">Datos y copias de seguridad</div>
    <p class="bc-intro">Todo se guarda en este dispositivo. Exporta una copia de vez en cuando o activa el club compartido para tenerlo también en la nube.</p>
    <div class="menu-list">
      ${row('i-download', 'Guardar copia de seguridad', appSettings.lastBackupAt ? `última: ${new Date(appSettings.lastBackupAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : '.json', 'exportBackupJSON()')}
      ${row('i-upload', 'Restaurar copia de seguridad', '.json', "closeEventModal(); document.getElementById('import-file').click()")}
      ${row('i-file', 'Exportar partidos a Excel', '.csv', 'exportHistoryCSV()')}
    </div>
    <div class="menu-group-title">Pruebas</div>
    <div class="menu-list">
      ${row('i-users', 'Cargar datos de ejemplo', 'top 15', 'closeEventModal(); loadDemoData()')}
      ${row('i-trash', 'Vaciar el historial de partidos', '›', 'closeEventModal(); clearAllHistory()', 'menu-row-danger')}
      ${row('i-trash', 'Restaurar de fábrica', '›', 'closeEventModal(); openFactoryReset()', 'menu-row-danger')}
    </div>`);
}

function renderMenuSwitches() {
  document.getElementById('sw-theme')?.classList.toggle('on', document.body.classList.contains('light-mode'));
  document.getElementById('sw-voice')?.classList.toggle('on', voiceEnabled);
  document.getElementById('sw-vibration')?.classList.toggle('on', appSettings.vibration);
  document.getElementById('sw-wakeLock')?.classList.toggle('on', appSettings.wakeLock);
  document.getElementById('sw-sound')?.classList.toggle('on', appSettings.sound);
}

function toggleAppSetting(key) {
  appSettings[key] = !appSettings[key];
  try { localStorage.setItem('pm_ajustes_v1', JSON.stringify(appSettings)); } catch (e) {}
  renderMenuSwitches();
  vibrate(12);
  if (key === 'sound' && appSettings.sound) fxSound('game');
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

// Cierra lo que esté encima (hojas, menú, historias, cierre del partido). Devuelve true si ha cerrado algo.
function closeTopOverlay() {
  if (!document.getElementById('wrapped').classList.contains('hidden')) { closeWrapped(); return true; }
  const open = [...document.querySelectorAll('.sheet-backdrop')].filter(el => !el.classList.contains('hidden'));
  if (open.length) { open.forEach(el => el.classList.add('hidden')); return true; }
  if (!document.getElementById('match-end').classList.contains('hidden')) { closeMatchEnd(); return true; }
  if (!document.getElementById('app-menu').classList.contains('hidden')) { closeAppMenu(); return true; }
  return false;
}

// Botón atrás (app de Android, navegador y app instalada): cierra lo que esté abierto o vuelve a Inicio.
// Devuelve false para salir de la app.
window.__padelAtras = () => {
  if (closeTopOverlay()) return true;
  if (!document.getElementById('view-stats').classList.contains('hidden')) { toggleStatsView(); return true; }
  if (document.body.classList.contains('in-live-match')) { showToast('Para salir del partido usa el botón Salir'); return true; }
  if (currentTab === 'tournaments' && tView.mode !== 'list') { eventDraft = null; showTournamentList(); return true; }
  if (currentTab === 'americano' && aView.mode !== 'list') { eventDraft = null; showAmericanoList(); return true; }
  if (currentTab !== 'home') { switchMainTab('home'); return true; }
  return false;
};

// En el navegador y en la app instalada desde la web, el botón atrás del móvil también cierra hojas y menús
// en vez de salir de golpe. Se deja una entrada de "guardia" en el historial al tocar la pantalla (los navegadores
// ignoran las que se crean sin que el usuario haya tocado nada) y se gasta al pulsar atrás.
let backGuardArmed = false, backGuardHref = '';
function backGuardAllowed() {
  return !window.PadelNative && !document.body.classList.contains('spectator-mode');
}

function armBackGuard() {
  if (backGuardArmed || !backGuardAllowed()) return;
  try {
    history.pushState({ pmGuard: 1 }, '');
    backGuardArmed = true;
    backGuardHref = location.href;
  } catch (e) {}
}

function initBackGuard() {
  document.addEventListener('pointerdown', armBackGuard, true);
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.pmGuard) { backGuardArmed = true; backGuardHref = location.href; return; }
    if (!backGuardArmed) return;
    backGuardArmed = false;
    if (location.href !== backGuardHref || !backGuardAllowed()) return;
    if (!window.__padelAtras()) history.back();
  });
  // En el ordenador, Escape cierra la hoja o el menú abierto
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && closeTopOverlay()) e.preventDefault();
  });
}

// Novedades: se muestran una vez tras actualizar (no a quien abre la app por primera vez)
const APP_VERSION = 10;
const APP_NEWS = [
  ['i-share', 'Comparte un partido con un enlace', 'Resultado, estadísticas y gráfico de probabilidad en un enlace o un QR. Se abre en cualquier móvil sin instalar nada y quien lo recibe puede guardarlo en su historial.'],
  ['i-broadcast', 'Clasificación en directo', 'En americanos, mexicanos, pozo y torneos: "Emitir en directo" y todos ven la ronda en juego y la clasificación en su móvil o en una tele.'],
  ['i-save', 'Copia de seguridad en un toque', 'Se envía a Drive, WhatsApp o el correo desde el menú de compartir del móvil, y el inicio te avisa si llevas tiempo sin copia.'],
  ['i-play', 'Accesos directos', 'Mantén pulsado el icono de la app para ir directo a Nuevo partido, Americano, Ranking o Historial.'],
  ['i-screen', 'Más rápida con poca cobertura', 'Si la red tarda, la app se abre al momento con la versión guardada. El botón atrás del móvil cierra hojas y menús, y al borrar un partido puedes deshacerlo.']
];

function openNewsSheet() {
  openEventModal(`
    <div class="mo-title">Novedades · versión ${APP_VERSION}</div>
    <div class="news-list">${APP_NEWS.map(([icon, title, text]) => `
      <div class="wl-feat"><svg class="icon"><use href="#${icon}"/></svg><div><strong>${title}</strong><span>${text}</span></div></div>`).join('')}
    </div>
    <button type="button" class="btn-volt btn-block mt-14" onclick="closeEventModal()">Entendido</button>`);
}

function maybeShowNews() {
  let seen = 0;
  try { seen = +localStorage.getItem('pm_novedades_v1') || 0; } catch (e) {}
  if (seen >= APP_VERSION) return;
  const mark = () => { try { localStorage.setItem('pm_novedades_v1', String(APP_VERSION)); } catch (e) {} };
  // Primera vez (sin datos): ya ve la bienvenida
  if (!seen && !hasAnyData()) { mark(); return; }
  // Si se ha abierto un enlace (directo o partido) se deja para la próxima vez
  if (document.body.classList.contains('spectator-mode')) return;
  mark();
  setTimeout(openNewsSheet, 700);
}

// Ofrece el APK en los navegadores de Android (fuera de la app)
function setupAppDownload() {
  if (window.PadelNative) {
    const el = document.getElementById('app-version-label');
    try { if (el) el.innerText = `Padel Metric · app ${PadelNative.versionApp()} · ${PadelNative.version()}`; } catch (e) {}
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadCustomCover();
  initAvatarCropperEvents();
  initPlayerCardInteractions();
  renderVoiceToggle();
  switchMainTab('home');
  initSync();
  initLiveSpectator();
  initLinks();
  maybeShowWelcome();
  maybeShowNews();
  initBackGuard();
  setupAppDownload();
  syncNativeTheme();
});

// Botón "Instalar app": el navegador avisa cuando la app se puede instalar
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (currentTab === 'home') renderHome();
});

async function triggerInstallPWA() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  try { await deferredInstallPrompt.userChoice; } catch (e) {}
  deferredInstallPrompt = null;
  closeEventModal();
}

window.addEventListener('appinstalled', () => {
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
