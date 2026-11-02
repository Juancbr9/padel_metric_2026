function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Para pasar un texto como argumento dentro de un onclick="..."
function jsArg(text) {
  return escapeHtml(JSON.stringify(String(text ?? '')));
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function vibrate(pattern = 15) {
  if (appSettings.vibration && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

function getInitials(name) {
  const parts = (name || 'J').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

// extraClass: tamaño (avatar-sm, avatar-md…) y, solo en un partido, el color de su pareja (avatar-p1 / avatar-p2)
function renderAvatarHTML(playerName, extraClass = '', customStyle = '', isGeneric = false, fallbackLabel = '') {
  const style = customStyle ? ` style="${customStyle}"` : '';
  if (!isGeneric && playerName && dbProfiles[playerName] && dbProfiles[playerName].photo) {
    return `<span class="avatar-circle ${extraClass}"${style}><img src="${dbProfiles[playerName].photo}" alt="${escapeHtml(playerName)}"></span>`;
  }
  const text = fallbackLabel || getInitials(playerName);
  return `<span class="avatar-circle ${extraClass}"${style}>${escapeHtml(text)}</span>`;
}

dbPlayers.forEach(k => ensureProfile(k));

// Pantalla vacía: qué es la sección y qué hacer para empezar (alineada a la izquierda, sin icono)
function emptyStateHTML(title, text, actions = '') {
  return `<div class="empty-block"><h2>${title}</h2><p>${text}</p>${actions ? `<div class="empty-actions">${actions}</div>` : ''}</div>`;
}

// ---------- Tema: oscuro (por defecto), claro o automático (sigue al móvil) ----------
// Se guarda en pm_theme_light: '1' claro, '0' oscuro, 'auto' automático (sin valor = oscuro)
const themeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

function themePref() {
  let v = null;
  try { v = localStorage.getItem('pm_theme_light'); } catch (e) {}
  return v === '1' ? 'light' : v === 'auto' ? 'auto' : 'dark';
}

function applyTheme() {
  const pref = themePref();
  const light = pref === 'light' || (pref === 'auto' && !!themeQuery && themeQuery.matches);
  document.body.classList.toggle('light-mode', light);
  // Color de la barra del navegador y de la barra de estado del móvil
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#F4F6F8' : '#030508');
  syncNativeTheme();
}

function setThemePref(pref) {
  try { localStorage.setItem('pm_theme_light', pref === 'light' ? '1' : pref === 'auto' ? 'auto' : '0'); } catch (e) {}
  applyTheme();
  if (typeof renderMenuSwitches === 'function') renderMenuSwitches();
  vibrate(10);
}

// Cambia entre claro y oscuro (se mantiene por compatibilidad: deja el tema fijo, no automático)
function toggleThemeMode() {
  setThemePref(document.body.classList.contains('light-mode') ? 'dark' : 'light');
  showToast(document.body.classList.contains('light-mode') ? 'Tema claro' : 'Tema oscuro');
}

// En la app de Android, los iconos de la barra de estado siguen al tema (oscuros en modo claro)
function syncNativeTheme() {
  if (window.PadelNative) PadelNative.temaClaro(document.body.classList.contains('light-mode'));
}

applyTheme();
if (themeQuery) {
  const onSystemTheme = () => { if (themePref() === 'auto') applyTheme(); };
  if (themeQuery.addEventListener) themeQuery.addEventListener('change', onSystemTheme);
  else if (themeQuery.addListener) themeQuery.addListener(onSystemTheme);
}

// Aviso breve. Con action = { label, run } muestra un botón (por ejemplo "Deshacer") durante 5 segundos.
let toastActionFn = null;
function showToast(msg, action = null) {
  const t = document.getElementById('toast-hud');
  document.getElementById('toast-msg').innerText = msg;
  const btn = document.getElementById('toast-action');
  toastActionFn = action ? action.run : null;
  if (btn) { btn.classList.toggle('hidden', !action); if (action) btn.innerText = action.label; }
  t.classList.toggle('has-action', !!action);
  t.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { t.classList.remove('show', 'has-action'); toastActionFn = null; }, action ? 5000 : 2300);
}

function runToastAction() {
  const fn = toastActionFn;
  toastActionFn = null;
  clearTimeout(toastTimeout);
  document.getElementById('toast-hud').classList.remove('show', 'has-action');
  if (fn) fn();
}
