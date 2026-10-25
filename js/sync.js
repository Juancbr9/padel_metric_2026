// ==========================================================
// SINCRONIZACIÓN ENTRE MÓVILES (CLUB COMPARTIDO EN SUPABASE)
// Cada móvil trabaja sin conexión; al sincronizar se descargan los datos del club,
// se mezclan con los locales (por id y fecha de cambio, respetando borrados) y se suben.
// ==========================================================
const SYNC_KEY = 'pm_sync_v1';
const SYNC_META_KEY = 'pm_sync_meta_v1';
const SYNC_COLLECTIONS = ['matches', 'tournaments', 'americanos'];
const TOMBSTONE_DAYS = 180;
// Proyecto de Supabase de Padel Metric. La clave "publishable" es pública por diseño:
// sin el código secreto del club no permite leer ni escribir nada.
const DEFAULT_SUPABASE_URL = 'https://ijmxhzdgcwxihfzllnoj.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_UKoPjQVMqi4ApeXJNkUN9A_swG4xZ0X';

let syncConfig = null;
let syncMeta = { deleted: { players: {}, matches: {}, tournaments: {}, americanos: {} } };
try { syncConfig = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); } catch (e) {}
try { Object.assign(syncMeta, JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}')); } catch (e) {}

let entityHashes = null;
let syncTimer = null;
let syncRunning = false;
let syncPending = false;
let suppressSync = false;
let syncStatus = { state: 'idle', message: '' };

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h;
}

function hashEntity(obj) {
  const { updatedAt, ...rest } = obj || {};
  return hashString(JSON.stringify(rest));
}

function saveSyncMeta() {
  try { localStorage.setItem(SYNC_META_KEY, JSON.stringify(syncMeta)); } catch (e) {}
}

function saveSyncConfig() {
  try {
    if (syncConfig) localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
    else localStorage.removeItem(SYNC_KEY);
  } catch (e) {}
}

// Se llama desde saveDB(): pone fecha de cambio a lo modificado y apunta lo borrado
function trackChanges() {
  const now = Date.now();
  const first = entityHashes === null;
  const next = { players: {}, profiles: {}, matches: {}, tournaments: {}, americanos: {} };
  const visit = (type, id, obj) => {
    const h = hashEntity(obj);
    if (!first && entityHashes[type][id] !== h) obj.updatedAt = now;
    next[type][id] = hashEntity(obj);
  };
  dbPlayers.forEach(n => { next.players[n] = 1; });
  Object.entries(dbProfiles).forEach(([n, p]) => visit('profiles', n, p));
  matchHistory.forEach(m => m && visit('matches', String(m.id), m));
  tournaments.forEach(t => visit('tournaments', t.id, t));
  americanos.forEach(a => visit('americanos', a.id, a));
  if (!first) {
    let changed = false;
    ['players', ...SYNC_COLLECTIONS].forEach(type => {
      Object.keys(entityHashes[type]).forEach(id => {
        if (!(id in next[type])) { syncMeta.deleted[type][id] = now; changed = true; }
      });
    });
    if (changed) saveSyncMeta();
  }
  entityHashes = next;
}

// Tras importar datos o mezclar con el club: se toma lo actual como punto de partida
function resetChangeTracking() {
  entityHashes = null;
  trackChanges();
}

function localPayload() {
  return { dbPlayers, dbProfiles, matchHistory, tournaments, americanos, deleted: syncMeta.deleted };
}

function normalizePayload(data) {
  const d = data || {};
  const del = d.deleted || {};
  return {
    dbPlayers: d.dbPlayers || [], dbProfiles: d.dbProfiles || {}, matchHistory: d.matchHistory || [],
    tournaments: d.tournaments || [], americanos: d.americanos || [],
    deleted: { players: del.players || {}, matches: del.matches || {}, tournaments: del.tournaments || {}, americanos: del.americanos || {} }
  };
}

function mergeDeleted(a, b) {
  const out = {};
  const limit = Date.now() - TOMBSTONE_DAYS * 864e5;
  ['players', ...SYNC_COLLECTIONS].forEach(type => {
    out[type] = {};
    [a[type] || {}, b[type] || {}].forEach(src => Object.entries(src).forEach(([id, ts]) => {
      if (ts > limit) out[type][id] = Math.max(out[type][id] || 0, ts);
    }));
  });
  return out;
}

function mergeById(a, b, deleted, idOf) {
  const map = new Map();
  [...a, ...b].forEach(item => {
    if (!item) return;
    const id = String(idOf(item));
    const cur = map.get(id);
    if (!cur || (item.updatedAt || 0) > (cur.updatedAt || 0)) map.set(id, item);
  });
  return [...map.entries()].filter(([id, item]) => !((deleted[id] || 0) >= (item.updatedAt || 0) && deleted[id])).map(([, item]) => item);
}

function mergePayloads(local, remote) {
  const deleted = mergeDeleted(local.deleted, remote.deleted);
  const profiles = {};
  [remote.dbProfiles, local.dbProfiles].forEach(src => Object.entries(src).forEach(([n, p]) => {
    if (!profiles[n] || (p.updatedAt || 0) > (profiles[n].updatedAt || 0)) profiles[n] = p;
  }));
  const players = [...new Set([...remote.dbPlayers, ...local.dbPlayers])]
    .filter(n => !(deleted.players[n] && deleted.players[n] >= ((profiles[n] && profiles[n].updatedAt) || 0)));
  players.forEach(n => { if (deleted.players[n]) delete deleted.players[n]; });
  return {
    dbPlayers: players,
    dbProfiles: profiles,
    matchHistory: mergeById(local.matchHistory, remote.matchHistory, deleted.matches, m => m.id).sort((x, y) => y.id - x.id),
    tournaments: mergeById(local.tournaments, remote.tournaments, deleted.tournaments, t => t.id).sort((x, y) => y.createdAt - x.createdAt),
    americanos: mergeById(local.americanos, remote.americanos, deleted.americanos, a => a.id).sort((x, y) => y.createdAt - x.createdAt),
    deleted
  };
}

// ¿Tiene lo mezclado algo que el club todavía no tenga?
function differsFromRemote(merged, remote) {
  const stamps = (list, idOf) => new Map(list.map(x => [String(idOf(x)), x.updatedAt || 0]));
  const differs = (a, b) => a.size !== b.size || [...a].some(([id, ts]) => b.get(id) !== ts);
  if (differs(new Map(merged.dbPlayers.map(n => [n, 1])), new Map(remote.dbPlayers.map(n => [n, 1])))) return true;
  if (differs(new Map(Object.entries(merged.dbProfiles).map(([n, p]) => [n, p.updatedAt || 0])), new Map(Object.entries(remote.dbProfiles).map(([n, p]) => [n, p.updatedAt || 0])))) return true;
  if (differs(stamps(merged.matchHistory, m => m.id), stamps(remote.matchHistory, m => m.id))) return true;
  if (differs(stamps(merged.tournaments, t => t.id), stamps(remote.tournaments, t => t.id))) return true;
  if (differs(stamps(merged.americanos, a => a.id), stamps(remote.americanos, a => a.id))) return true;
  return ['players', ...SYNC_COLLECTIONS].some(type => differs(new Map(Object.entries(merged.deleted[type])), new Map(Object.entries(remote.deleted[type]))));
}

function applyMerged(merged) {
  dbPlayers = merged.dbPlayers;
  dbProfiles = merged.dbProfiles;
  matchHistory = merged.matchHistory;
  tournaments = merged.tournaments;
  americanos = merged.americanos;
  syncMeta.deleted = merged.deleted;
  saveSyncMeta();
  entityHashes = null;
  suppressSync = true;
  saveDB();
  suppressSync = false;
}

// ---------- Conexión con Supabase ----------
async function syncRpc(fn, body, cfg = syncConfig) {
  const res = await fetch(`${cfg.url.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    // Las claves nuevas (sb_publishable_...) van solo en "apikey"; las antiguas (JWT) también en Authorization
    headers: cfg.key.startsWith('sb_')
      ? { apikey: cfg.key, 'Content-Type': 'application/json' }
      : { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) {}
  if (!res.ok) {
    const msg = (json && (json.message || json.hint)) || `Error ${res.status}`;
    throw new Error(res.status === 404 ? 'Falta ejecutar el script de Supabase (supabase/setup.sql)' : msg);
  }
  return json;
}

function scheduleSync(delay = 4000) {
  if (!syncConfig || suppressSync) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(false), delay);
}

function setSyncStatus(state, message = '') {
  syncStatus = { state, message };
  renderSyncHint();
  const panel = document.getElementById('sync-panel-status');
  if (panel) panel.innerHTML = syncStatusHTML();
}

async function syncNow(manual = false) {
  if (!syncConfig) return;
  if (!navigator.onLine) {
    setSyncStatus('offline', 'Sin conexión: se sincronizará al volver internet');
    if (manual) showToast('Sin conexión: se sincronizará más tarde');
    return;
  }
  if (syncRunning) { syncPending = true; return; }
  syncRunning = true;
  setSyncStatus('syncing');
  try {
    let saved = false;
    for (let attempt = 0; attempt < 4 && !saved; attempt++) {
      const rows = await syncRpc('pm_get_club', { p_code: syncConfig.code });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error('El club no existe o el enlace no es correcto');
      const remote = normalizePayload(row.data);
      const merged = mergePayloads(normalizePayload(localPayload()), remote);
      applyMerged(merged);
      syncConfig.name = row.name || syncConfig.name;
      if (!differsFromRemote(merged, remote)) {
        syncConfig.version = row.version;
        saved = true;
        break;
      }
      const v = await syncRpc('pm_save_club', { p_code: syncConfig.code, p_data: merged, p_base_version: row.version });
      if (v !== -1) { syncConfig.version = v; saved = true; }
    }
    if (!saved) throw new Error('Otro móvil está guardando a la vez; se reintentará');
    syncConfig.lastSync = Date.now();
    saveSyncConfig();
    setSyncStatus('ok');
    refreshCurrentView();
    if (manual) showToast('Datos sincronizados con el club');
  } catch (e) {
    setSyncStatus('error', e.message);
    if (manual) showToast(`No se pudo sincronizar: ${e.message}`);
  } finally {
    syncRunning = false;
    if (syncPending) { syncPending = false; scheduleSync(1500); }
  }
}

// Vuelve a pintar la pantalla actual con los datos nuevos, sin molestar si hay algo abierto
function refreshCurrentView() {
  if (document.body.classList.contains('in-live-match')) return;
  if (!document.getElementById('view-stats').classList.contains('hidden')) return;
  if ([...document.querySelectorAll('.sheet-backdrop')].some(el => !el.classList.contains('hidden') && el.id !== 'event-modal')) return;
  if (eventDraft) return;
  if (currentTab === 'home') renderHome();
  if (currentTab === 'ranking') renderGlobalRanking();
  if (currentTab === 'history') renderHistoryList();
  if (currentTab === 'tournaments') renderTournamentsView();
  if (currentTab === 'americano') renderAmericanoView();
}

// ---------- Club: crear, unirse, invitar y salir ----------
function randomClubCode() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}

function encodeInvite(cfg) {
  const json = JSON.stringify({ u: cfg.url, k: cfg.key, c: cfg.code, n: cfg.name });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeInvite(text) {
  const raw = String(text || '').trim();
  const token = raw.includes('#unirse=') ? raw.split('#unirse=')[1] : raw;
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const obj = JSON.parse(decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4)))));
  if (!obj.u || !obj.k || !obj.c) throw new Error('Enlace incompleto');
  return { url: obj.u, key: obj.k, code: obj.c, name: obj.n || 'Club', version: 0 };
}

function inviteLink() {
  // Dentro de la app el enlace debe apuntar a la web pública, que abre la app o la web según el móvil
  const base = window.PadelNative ? PadelNative.urlPublica() : `${location.origin}${location.pathname}`;
  return `${base}#unirse=${encodeInvite(syncConfig)}`;
}

async function createClubFromForm() {
  const url = document.getElementById('sync-url').value.trim();
  const key = document.getElementById('sync-key').value.trim();
  const name = document.getElementById('sync-name').value.trim() || 'Mi club';
  if (!/^https:\/\/.+/.test(url) || key.length < 20) { showToast('Revisa la URL del proyecto y la clave anon'); return; }
  const cfg = { url, key, code: randomClubCode(), name, version: 0 };
  setSyncStatus('syncing');
  try {
    await syncRpc('pm_create_club', { p_code: cfg.code, p_name: name, p_data: localPayload() }, cfg);
    syncConfig = { ...cfg, version: 1, lastSync: Date.now() };
    saveSyncConfig();
    setSyncStatus('ok');
    showToast(`Club "${name}" creado`);
    openSyncPanel();
  } catch (e) {
    setSyncStatus('error', e.message);
    showToast(`No se pudo crear el club: ${e.message}`);
  }
}

async function joinClub(cfg) {
  syncConfig = cfg;
  saveSyncConfig();
  await syncNow(true);
  if (syncStatus.state === 'ok') showToast(`Te has unido al club "${syncConfig.name}"`);
  if (!document.getElementById('event-modal').classList.contains('hidden')) openSyncPanel();
}

function joinClubFromForm() {
  try {
    const cfg = decodeInvite(document.getElementById('sync-invite').value);
    if (!confirm(`¿Unirte al club "${cfg.name}"? Los datos de este móvil se juntarán con los del club.`)) return;
    joinClub(cfg);
  } catch (e) {
    showToast('El enlace de invitación no es válido');
  }
}

async function shareInvite() {
  const url = inviteLink();
  const text = `Únete al club "${syncConfig.name}" en Padel Metric`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Padel Metric', text, url }); return; } catch (e) {}
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Enlace copiado: pégalo en WhatsApp');
  } catch (e) {
    showToast('Copia el enlace del recuadro');
  }
}

function leaveClub() {
  if (!confirm('¿Dejar de sincronizar con el club? Los datos se quedan en este móvil.')) return;
  syncConfig = null;
  saveSyncConfig();
  setSyncStatus('idle');
  openSyncPanel();
}

function timeAgo(ts) {
  if (!ts) return 'nunca';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'hace unos segundos';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} días`;
}

function syncStatusHTML() {
  const map = {
    ok: ['ok', `Sincronizado ${timeAgo(syncConfig && syncConfig.lastSync)}`],
    syncing: ['syncing', 'Sincronizando…'],
    error: ['error', syncStatus.message || 'Error de conexión'],
    offline: ['offline', syncStatus.message],
    idle: ['idle', syncConfig ? `Última vez ${timeAgo(syncConfig.lastSync)}` : 'Desactivado']
  };
  const [cls, text] = map[syncStatus.state] || map.idle;
  return `<span class="sync-dot ${cls}"></span>${escapeHtml(text)}`;
}

function renderSyncHint() {
  const el = document.getElementById('sync-hint');
  if (!el) return;
  el.innerText = !syncConfig ? 'Desactivado' : syncStatus.state === 'error' ? 'Error' : syncStatus.state === 'syncing' ? 'Sincronizando…' : 'Activo';
  el.className = `menu-row-hint sync-hint ${syncConfig ? syncStatus.state : ''}`;
}

function openSyncPanel() {
  closeAppMenu();
  if (syncConfig) {
    openEventModal(`
      <div class="event-modal-title">Sincronizar entre móviles</div>
      <div class="reset-title">${escapeHtml(syncConfig.name)}</div>
      <div id="sync-panel-status" class="sync-status">${syncStatusHTML()}</div>
      <p class="reset-text">Todos los móviles del club comparten jugadores, partidos, torneos y americanos. Cada móvil funciona sin conexión y se sincroniza solo al guardar y al abrir la app.</p>
      <button class="btn-volt" onclick="syncNow(true)">Sincronizar ahora</button>
      <div class="form-label">Invitar a otro móvil</div>
      <input type="text" readonly value="${escapeHtml(inviteLink())}" onclick="this.select()">
      <button class="btn-icon" style="width:100%;padding:12px;margin-top:8px;color:#25D366;" onclick="shareInvite()"><svg class="icon"><use href="#i-share"/></svg> Enviar invitación</button>
      <p class="reset-text" style="margin-top:10px;">Cualquiera con este enlace puede ver y cambiar los datos del club: compártelo solo con tu grupo.</p>
      <button class="btn-icon reset-danger" onclick="leaveClub()">Dejar de sincronizar en este móvil</button>`);
    return;
  }
  openEventModal(`
    <div class="event-modal-title">Sincronizar entre móviles</div>
    <div class="reset-title">Club compartido</div>
    <p class="reset-text">Comparte el ranking, los partidos, los torneos y los americanos entre varios móviles. Una persona crea el club y los demás se unen con un enlace.</p>
    <div class="form-label">¿Te han enviado una invitación?</div>
    <input type="text" id="sync-invite" placeholder="Pega aquí el enlace de invitación">
    <button class="btn-volt" style="margin-top:8px;" onclick="joinClubFromForm()">Unirme al club</button>
    <div class="form-label" style="margin-top:20px;">O crea un club nuevo</div>
    <input type="text" id="sync-name" placeholder="Nombre del club (ej. Pádel de los jueves)">
    <button class="btn-icon" style="width:100%;padding:12px;margin-top:8px;color:var(--volt);" onclick="createClubFromForm()">Crear club con los datos de este móvil</button>
    <details class="sync-help" style="margin-top:10px;">
      <summary>Usar otro proyecto de Supabase (opcional)</summary>
      <p style="margin:8px 0;color:var(--text-secondary);">Por defecto se usa la base de datos de Padel Metric. Si prefieres la tuya, ejecuta <strong>supabase/setup.sql</strong> en su SQL Editor y pon aquí su URL y su clave publishable.</p>
      <input type="text" id="sync-url" value="${escapeHtml(DEFAULT_SUPABASE_URL)}" placeholder="Project URL (https://xxxx.supabase.co)">
      <input type="text" id="sync-key" value="${escapeHtml(DEFAULT_SUPABASE_KEY)}" placeholder="Clave publishable (sb_publishable_...)" style="margin-top:8px;">
    </details>`);
}

async function checkRemoteVersion() {
  if (!syncConfig || syncRunning || !navigator.onLine || document.visibilityState !== 'visible') return;
  try {
    const v = await syncRpc('pm_club_version', { p_code: syncConfig.code });
    if (typeof v === 'number' && v !== syncConfig.version) syncNow(false);
  } catch (e) {
    // Proyectos configurados antes de existir esta función: se sincroniza igualmente al guardar y al abrir
  }
}

// ---------- Arranque ----------
// Enlace de invitación abierto en este móvil (…/#unirse=...)
function handleInviteHash() {
  if (!location.hash.startsWith('#unirse=')) return false;
  try {
    const cfg = decodeInvite(location.hash);
    history.replaceState(null, '', location.pathname + location.search);
    if (syncConfig && syncConfig.code === cfg.code) { showToast(`Ya estás en el club "${cfg.name}"`); return true; }
    if (confirm(`¿Unirte al club "${cfg.name}"? Los datos de este móvil se juntarán con los del club.`)) joinClub(cfg);
  } catch (e) {
    showToast('El enlace de invitación no es válido');
  }
  return true;
}

function initSync() {
  resetChangeTracking();
  renderSyncHint();
  if (!handleInviteHash() && syncConfig) syncNow(false);
  // También si la app ya estaba abierta cuando se toca el enlace
  window.addEventListener('hashchange', handleInviteHash);
  window.addEventListener('online', () => scheduleSync(500));
  // Cada minuto, con la app abierta, mira si otro móvil ha guardado algo (consulta de pocos bytes)
  setInterval(checkRemoteVersion, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(800); });
}
