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

// Pila de secciones visitadas: el botón atrás vuelve a la anterior. El inicio es la raíz (la vacía).
let navStack = [], navGoingBack = false;

function switchMainTab(tab) {
  if (tab === 'home') navStack = [];
  else if (!navGoingBack && currentTab && currentTab !== tab) { navStack.push(currentTab); if (navStack.length > 20) navStack.shift(); }
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
    box.innerHTML = `<button type="button" class="drawer-me empty" onclick="openChooseMeSheet()">
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
  openChooseMeSheet();
}

// Ajustes: interruptores y reglas en una sola hoja
function openSettingsSheet() {
  const sw = (id, icon, label, action) => `<button type="button" class="menu-row" onclick="${action}">
    <svg class="icon"><use href="#${icon}"/></svg><span>${label}</span><span class="switch" id="sw-${id}"></span></button>`;
  openEventModal(`
    <div class="mo-title">Ajustes</div>
    <div class="menu-group-title">Tema</div>
    <div class="ios-segmented cols-3" id="theme-seg">
      <button type="button" class="ios-seg-option" data-theme="dark" onclick="setThemePref('dark')"><span class="opt-main">Oscuro</span></button>
      <button type="button" class="ios-seg-option" data-theme="light" onclick="setThemePref('light')"><span class="opt-main">Claro</span></button>
      <button type="button" class="ios-seg-option" data-theme="auto" onclick="setThemePref('auto')"><span class="opt-main">Automático</span><span class="opt-sub">Como el móvil</span></button>
    </div>
    <div class="menu-group-title">Durante el partido</div>
    <div class="menu-list">
      ${sw('voice', 'i-volume', 'Narrador de voz', 'toggleVoiceNarrator()')}
      ${sw('vibration', 'i-vibrate', 'Vibración al anotar', "toggleAppSetting('vibration')")}
      ${sw('wakeLock', 'i-screen', 'Pantalla siempre encendida en partido', "toggleAppSetting('wakeLock')")}
      ${sw('sound', 'i-music', 'Sonidos en juegos, sets y partido', "toggleAppSetting('sound')")}
      ${sw('autoEnds', 'i-swap', 'Cambio de lado automático en la pista', "toggleAppSetting('autoEnds')")}
      ${sw('remote', 'i-target', 'Anotar con mando o botones de volumen', "toggleAppSetting('remote')")}
    </div>
    <div class="menu-list mt-8">
      <button type="button" class="menu-row" onclick="closeEventModal(); openRulesModal()">
        <svg class="icon"><use href="#i-sliders"/></svg><span>Reglas por defecto</span><span class="menu-row-hint">›</span></button>
    </div>
    <div class="menu-group-title">Datos</div>
    <div class="menu-list">
      <button type="button" class="menu-row" onclick="openDataSheet()">
        <svg class="icon"><use href="#i-save"/></svg><span>Copias de seguridad, Excel y restaurar</span><span class="menu-row-hint">›</span></button>
    </div>
    <div class="menu-group-title">Acerca de</div>
    <div class="menu-list">
      ${aiTestCode() ? `<button type="button" class="menu-row" onclick="openTestCodeSheet()">
        <svg class="icon"><use href="#i-sliders"/></svg><span>Código de pruebas</span><span class="menu-row-hint">Activo</span></button>` : ''}
      <button type="button" class="menu-row" onclick="openAboutSheet()">
        <svg class="icon"><use href="#i-info"/></svg><span>Acerca de, privacidad y contacto</span><span class="menu-row-hint">›</span></button>
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
    <p class="bc-intro">Todo se guarda en este móvil. Guarda una copia de vez en cuando.</p>
    <div class="menu-list">
      ${row('i-download', 'Guardar copia de seguridad', appSettings.lastBackupAt ? `última: ${new Date(appSettings.lastBackupAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : '.json', 'exportBackupJSON()')}
      ${row('i-upload', 'Restaurar copia de seguridad', '.json', "closeEventModal(); document.getElementById('import-file').click()")}
      ${row('i-file', 'Exportar partidos a Excel', '.csv', 'exportHistoryCSV()')}
    </div>
    <div class="menu-list mt-8">
      ${row('i-trash', 'Borrar todos los datos', '›', 'closeEventModal(); openFactoryReset()', 'menu-row-danger')}
    </div>`);
}

function renderMenuSwitches() {
  const pref = themePref();
  document.querySelectorAll('#theme-seg [data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === pref));
  document.getElementById('sw-voice')?.classList.toggle('on', voiceEnabled);
  document.getElementById('sw-vibration')?.classList.toggle('on', appSettings.vibration);
  document.getElementById('sw-wakeLock')?.classList.toggle('on', appSettings.wakeLock);
  document.getElementById('sw-sound')?.classList.toggle('on', appSettings.sound);
  document.getElementById('sw-remote')?.classList.toggle('on', !!appSettings.remote);
  document.getElementById('sw-autoEnds')?.classList.toggle('on', appSettings.autoEnds !== false);
}

function toggleAppSetting(key) {
  appSettings[key] = !appSettings[key];
  try { localStorage.setItem('pm_ajustes_v1', JSON.stringify(appSettings)); } catch (e) {}
  renderMenuSwitches();
  vibrate(12);
  if (key === 'sound' && appSettings.sound) fxSound('game');
  if (key === 'remote') { syncNativeRemote(); if (appSettings.remote) openRemoteHelp(); }
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
  const guide = document.getElementById('match-guide');
  if (guide && !guide.classList.contains('hidden')) { closeMatchGuide(); return true; }
  const open = [...document.querySelectorAll('.sheet-backdrop')].filter(el => !el.classList.contains('hidden'));
  if (open.length) { open.forEach(el => el.classList.add('hidden')); return true; }
  if (!document.getElementById('match-end').classList.contains('hidden')) { closeMatchEnd(); return true; }
  if (!document.getElementById('app-menu').classList.contains('hidden')) { closeAppMenu(); return true; }
  return false;
}

// Botón atrás (app de Android, navegador y app instalada), en este orden: cierra lo que esté abierto, sale de las
// estadísticas, en el partido abre "Salir del partido", vuelve de un torneo o americano a su lista, vuelve a la
// sección anterior y, si no hay, al inicio. En el inicio sale; en la app de Android pide pulsar otra vez.
// Devuelve false para salir de la app.
let lastBackAtHome = 0;
window.__padelAtras = () => {
  if (closeTopOverlay()) return true;
  if (!document.getElementById('view-stats').classList.contains('hidden')) { toggleStatsView(); return true; }
  if (document.body.classList.contains('in-live-match')) { openExitMatchSheet(); return true; }
  if (currentTab === 'tournaments' && tView.mode !== 'list') { eventDraft = null; showTournamentList(); return true; }
  if (currentTab === 'americano' && aView.mode !== 'list') { eventDraft = null; showAmericanoList(); return true; }
  if (navStack.length) {
    navGoingBack = true;
    try { switchMainTab(navStack.pop()); } finally { navGoingBack = false; }
    return true;
  }
  if (currentTab !== 'home') { switchMainTab('home'); return true; }
  if (window.PadelNative && Date.now() - lastBackAtHome > 2000) {
    lastBackAtHome = Date.now();
    showToast('Pulsa atrás otra vez para salir');
    return true;
  }
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

// Acerca de: qué es, privacidad en pocas líneas, contacto y enlaces a las páginas públicas
const CONTACT_EMAIL = 'juancbr9@gmail.com';

function contactMailto(kind) {
  const subject = kind === 'bug' ? 'Padel Metric: un fallo' : 'Padel Metric: una sugerencia';
  let where = 'navegador';
  try { if (window.PadelNative) where = `app de Android ${PadelNative.versionApp()}`; else if (window.matchMedia('(display-mode: standalone)').matches) where = 'app instalada'; } catch (e) {}
  const body = `\n\n\n---\nVersión ${APP_VERSION} · ${where} · ${navigator.userAgent}`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function openAboutSheet() {
  const base = appPublicUrl();
  openEventModal(`
    <div class="about-head">
      <svg class="about-logo"><use href="#logo-mark"/></svg>
      <div><strong>Padel Metric</strong><small>Versión ${APP_VERSION}</small></div>
    </div>
    <p class="bc-intro">Marcador y estadísticas de pádel punto a punto, con ranking, torneos, americanos y directo para quien no está en la pista. Gratis y sin anuncios.</p>
    <div class="menu-group-title">Tus datos</div>
    <ul class="about-list">
      <li>Todo se guarda en este dispositivo. No hace falta cuenta ni se piden datos personales.</li>
      <li>Solo sale del móvil lo que tú decides compartir: el directo de un partido, el club compartido, los enlaces de partido o de perfil, las inscripciones con QR y los datos del partido cuando pides su crónica con IA.</li>
      <li>No hay publicidad ni seguimiento de lo que haces en la app.</li>
    </ul>
    <div class="menu-group-title">Contacto</div>
    <div class="menu-list">
      <a class="menu-row" href="${contactMailto('idea')}"><svg class="icon"><use href="#i-star"/></svg><span>Enviar una sugerencia</span><span class="menu-row-hint">›</span></a>
      <a class="menu-row" href="${contactMailto('bug')}"><svg class="icon"><use href="#i-info"/></svg><span>Avisar de un fallo</span><span class="menu-row-hint">›</span></a>
    </div>
    <div class="menu-group-title">Más</div>
    <div class="menu-list">
      <a class="menu-row" href="${base}privacidad.html" target="_blank" rel="noopener"><svg class="icon"><use href="#i-info"/></svg><span>Política de privacidad</span><span class="menu-row-hint">›</span></a>
      <a class="menu-row" href="${base}presentacion.html" target="_blank" rel="noopener"><svg class="icon"><use href="#i-share"/></svg><span>Página de presentación</span><span class="menu-row-hint">›</span></a>
      <button type="button" class="menu-row" onclick="closeEventModal(); openInstallSheet()"><svg class="icon"><use href="#i-share"/></svg><span>Compartir la app</span><span class="menu-row-hint">›</span></button>
    </div>
    <p class="exit-note">Contacto: ${CONTACT_EMAIL}</p>`);
}

// Novedades: se muestran una vez tras actualizar (no a quien abre la app por primera vez)
const APP_VERSION = 20;
const APP_NEWS = [
  ['Más sencilla', 'Menos textos y menos opciones repetidas: cada pantalla muestra solo lo que se usa. Las opciones del partido se quedan en lo imprescindible y el resto está en Ajustes.'],
  ['Cambio de lado en la pista', 'En los juegos impares las parejas cambian de lado y la pista del partido se gira sola, como en la realidad. Si no coincide con lo que ves, en Opciones del partido puedes cambiar de lado las parejas o intercambiar drive y revés. Se puede apagar en Ajustes.'],
  ['Cierre del partido más claro', 'Al terminar quedan las estadísticas, el resumen, compartir y salir.'],
  ['Anotar sencillo o avanzado', 'Por defecto, modo sencillo: desliza hacia arriba para un winner y hacia abajo para un error. En el avanzado eliges el golpe y tocas en la pista desde dónde golpeó, vista desde donde tú estás (detrás de una pareja o desde el lateral). El mapa de calor marca cada golpe en su sitio.'],
  ['Nuevo partido renovado', 'Los jugadores aparecen en su sitio de la pista con su foto, cada pareja con su nivel, botones para equilibrar o sortear parejas y el botón de empezar siempre a mano.'],
  ['Compartir mejor', 'Imagen del resultado, imagen con todas las estadísticas o resumen en texto.'],
  ['Fotos de perfil con IA', 'En el póster con la foto del grupo, la IA encuentra las caras y las guarda como foto de cada jugador.'],
  ['Americanos más fáciles', 'Elige jugadores en una lista con buscador, el número de pistas y la duración total: la app calcula las rondas que caben.'],
  ['Cara a cara con buscador', 'Cada jugador se elige buscándolo, sin listas interminables.']
];

function openNewsSheet() {
  openEventModal(`
    <div class="mo-title">Novedades · versión ${APP_VERSION}</div>
    <div class="news-list">${APP_NEWS.map(([title, text]) => `
      <div class="wl-feat"><strong>${title}</strong><span>${text}</span></div>`).join('')}
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

// El código de pruebas del dueño no se muestra a los clientes: se abre tocando 5 veces la versión del menú
let versionTaps = 0, versionTapTimer = null;
function versionTap() {
  versionTaps++;
  clearTimeout(versionTapTimer);
  versionTapTimer = setTimeout(() => { versionTaps = 0; }, 1500);
  if (versionTaps >= 5) { versionTaps = 0; closeAppMenu(); openTestCodeSheet(); }
}

// Ofrece el APK en los navegadores de Android (fuera de la app)
function setupAppDownload() {
  // Con la app ya instalada, el menú solo ofrece compartirla
  if (isInstalledApp()) { const l = document.getElementById('menu-install-label'); if (l) l.textContent = 'Compartir la app'; }
  if (window.PadelNative) {
    const el = document.getElementById('app-version-label');
    try { if (el) el.innerText = `Padel Metric · app ${PadelNative.versionApp()} · ${PadelNative.version()}`; } catch (e) {}
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // La foto de portada ya no existe: se libera el espacio que ocupaba
  try { localStorage.removeItem('pm_custom_cover'); } catch (e) {}
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
