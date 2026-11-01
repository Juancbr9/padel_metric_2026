// ==========================================================
// INSCRIPCIÓN CON QR (americanos)
// El organizador la abre desde "Nuevo evento": la app publica en pm_live una inscripción abierta
// (kind 'signup') y enseña un QR. Cada jugador lo escanea, escribe su nombre (en el mixto, también si es hombre o
// mujer) y se apunta con pm_live_join. El organizador ve la lista al momento (pm_live_joins) y los nombres se añaden
// al evento. Al crear el evento, el mismo enlace pasa a mostrar la clasificación en directo.
// Cada móvil guarda su clave de inscripción en pm_inscripciones_v1 para poder cambiar el nombre o borrarse.
// ==========================================================
const SIGNUP_POLL_MS = 3000;
let signupTimer = null, signupError = '', signupGender = 'M', signupEditing = false, spjDraw = null;

function cleanSignupName(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

// Si el nombre coincide con un jugador de la base de datos (sin contar mayúsculas ni tildes), se usa ese
function matchKnownPlayer(name) {
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const n = norm(name);
  return dbPlayers.find(p => norm(p) === n) || null;
}

function signupMissingSQL(msg) {
  return /Falta ejecutar/.test(msg || '');
}

// ---------- Organizador ----------
function signupLobbyData(d) {
  return { v: 1, kind: 'signup', open: !!d.signup.open, name: (d.name || '').trim() || 'Americano', fmt: AMERICANO_FORMATS[d.format].main, mixed: d.format === 'mixicano', at: Date.now() };
}

async function publishSignupLobby(d = eventDraft) {
  if (!d || !d.signup) return;
  try {
    const ok = await syncRpc('pm_live_publish', { p_code: d.signup.code, p_secret: d.signup.secret, p_data: signupLobbyData(d) }, LIVE_CFG);
    signupError = ok === false ? 'Este código pertenece a otro móvil' : '';
  } catch (e) {
    signupError = navigator.onLine === false ? 'Sin conexión: se reintentará solo' : e.message;
  }
  renderSignupSheetList();
}

function openSignupSheet() {
  const d = eventDraft;
  if (!d || d.kind !== 'americano') return;
  vibrate(10);
  if (!d.signup) d.signup = { code: liveRandom(10), secret: liveRandom(32), open: true, rows: [], added: {}, removed: {} };
  const link = liveLink(d.signup.code);
  openEventModal(`
    <div class="mo-title">Inscripción con QR</div>
    <p class="bc-intro">Cada jugador escanea el código con su móvil y escribe su nombre: aparece aquí y se añade a la lista del evento. Cuando crees el evento, el mismo enlace mostrará la ronda en juego y la clasificación.</p>
    <div class="bc-qr">${QR.svg(link, 2)}</div>
    <div class="bc-link">${escapeHtml(link)}</div>
    <div id="su-box"></div>
    <div class="bc-actions">
      <button class="btn-volt" onclick="shareSignupLink()">Compartir enlace</button>
      <button class="btn-icon" onclick="copySignupLink()">Copiar</button>
      <button class="btn-icon" onclick="toggleSignupOpen()">${d.signup.open ? 'Cerrar inscripción' : 'Reabrir inscripción'}</button>
    </div>`);
  renderSignupSheetList();
  publishSignupLobby(d);
  startSignupPolling();
}

function signupActiveRows(s) {
  return (s.rows || []).filter(r => r && r.data && !r.data.out && cleanSignupName(r.data.name));
}

function renderSignupSheetList() {
  const box = document.getElementById('su-box');
  const d = eventDraft;
  if (!box || !d || !d.signup) return;
  const s = d.signup;
  const rows = signupActiveRows(s);
  const warn = signupError ? `<div class="su-warn">${signupMissingSQL(signupError)
    ? 'La inscripción con QR necesita un paso en Supabase que todavía no está hecho: ejecuta una vez el archivo <strong>supabase/inscripcion.sql</strong> en el editor SQL del proyecto y vuelve a abrir esta hoja.'
    : escapeHtml(signupError)}</div>` : '';
  const kept = rows.filter(r => !s.removed[r.id]).length;
  box.innerHTML = `${warn}
    <div class="su-count"><strong>Apuntados: ${kept}</strong><span>${s.open ? 'Inscripción abierta' : 'Inscripción cerrada'}</span></div>
    <div class="su-list">${rows.length ? rows.map(r => {
      const name = (s.added[r.id] && s.added[r.id].name) || matchKnownPlayer(r.data.name) || cleanSignupName(r.data.name);
      const off = !!s.removed[r.id];
      return `<div class="su-row ${off ? 'out' : ''}">
        <span class="su-row-name">${escapeHtml(name)}</span>
        ${d.format === 'mixicano' ? `<span class="su-row-sub">${r.data.g === 'F' ? 'Mujer' : 'Hombre'}</span>` : ''}
        <button type="button" class="btn-icon" onclick="toggleSignupRow('${r.id}')">${off ? 'Volver a añadir' : 'Quitar'}</button>
      </div>`;
    }).join('') : '<div class="su-empty">Todavía no se ha apuntado nadie.</div>'}</div>`;
}

function startSignupPolling() {
  clearInterval(signupTimer);
  signupTimer = setInterval(pollSignups, SIGNUP_POLL_MS);
  pollSignups();
}

function stopSignupPolling() {
  clearInterval(signupTimer);
  signupTimer = null;
}

async function pollSignups() {
  const d = eventDraft;
  if (!d || !d.signup || aView.mode !== 'create') { stopSignupPolling(); return; }
  if (document.visibilityState === 'hidden') return;
  try {
    const rows = await syncRpc('pm_live_joins', { p_code: d.signup.code }, LIVE_CFG);
    if (eventDraft !== d) return;
    signupError = '';
    d.signup.rows = Array.isArray(rows) ? rows : [];
    applySignupsToDraft(d);
  } catch (e) {
    signupError = navigator.onLine === false ? 'Sin conexión: se reintentará solo' : e.message;
  }
  renderSignupSheetList();
}

// Pasa la lista de apuntados a los jugadores del evento (altas, bajas y cambios de nombre)
function applySignupsToDraft(d) {
  const s = d.signup;
  let changed = false;
  const fresh = [];
  s.rows.forEach(r => {
    const data = r.data || {};
    const prev = s.added[r.id];
    const raw = !data.out && !s.removed[r.id] ? cleanSignupName(data.name) : '';
    const wanted = raw ? (matchKnownPlayer(raw) || raw) : '';
    if (prev && prev.name !== wanted) {
      const i = d.players.indexOf(prev.name);
      // Cambio de nombre: el jugador conserva su sitio en la lista
      if (prev.own && wanted && i >= 0 && !d.players.includes(wanted)) {
        const known = matchKnownPlayer(wanted);
        const name = known || ensurePlayerInDB(wanted);
        if (name && !known && (data.g === 'F' || data.g === 'M')) ensureProfile(name).gender = data.g;
        d.players[i] = name;
        s.added[r.id] = { name, own: true };
        changed = true;
        return;
      }
      if (prev.own) d.players = d.players.filter(p => p !== prev.name);
      delete s.added[r.id];
      changed = true;
    }
    if (wanted && !s.added[r.id]) {
      const known = matchKnownPlayer(wanted);
      const name = known || ensurePlayerInDB(wanted);
      if (!name) return;
      if (!known && (data.g === 'F' || data.g === 'M')) ensureProfile(name).gender = data.g;
      const own = !d.players.includes(name);
      if (own) { d.players.push(name); fresh.push(name); }
      s.added[r.id] = { name, own };
      changed = true;
    }
  });
  if (!changed) {
    if (s.pendingRender) refreshAmericanoCreateView();
    return;
  }
  d.courts = null;
  d.rounds = null;
  saveDB();
  if (fresh.length) {
    vibrate(10);
    showToast(fresh.length === 1 ? `Se ha apuntado ${fresh[0]}` : `Se han apuntado ${fresh.length} jugadores`);
  }
  s.pendingRender = true;
  refreshAmericanoCreateView();
}

// Vuelve a dibujar la pantalla del evento sin interrumpir a quien está escribiendo
function refreshAmericanoCreateView() {
  const d = eventDraft;
  if (!d || !d.signup || currentTab !== 'americano' || aView.mode !== 'create') return;
  const view = document.getElementById('view-americano');
  const ae = document.activeElement;
  if (ae && view && view.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
  d.signup.pendingRender = false;
  renderAmericanoView();
}

function toggleSignupRow(id) {
  const d = eventDraft;
  if (!d || !d.signup) return;
  d.signup.removed[id] = !d.signup.removed[id];
  applySignupsToDraft(d);
  renderSignupSheetList();
}

function toggleSignupOpen() {
  const d = eventDraft;
  if (!d || !d.signup) return;
  d.signup.open = !d.signup.open;
  publishSignupLobby(d);
  openSignupSheet();
}

async function shareSignupLink() {
  const d = eventDraft;
  if (!d || !d.signup) return;
  const url = liveLink(d.signup.code);
  const name = (d.name || '').trim() || 'el americano';
  try {
    if (navigator.share) await navigator.share({ title: 'Padel Metric · Inscripción', text: `Apúntate a ${name}`, url });
    else { await navigator.clipboard.writeText(url); showToast('Enlace copiado'); }
  } catch (e) {}
}

async function copySignupLink() {
  const d = eventDraft;
  if (!d || !d.signup) return;
  try { await navigator.clipboard.writeText(liveLink(d.signup.code)); showToast('Enlace copiado'); } catch (e) { showToast('No se pudo copiar'); }
}

// Al crear el evento, el mismo código pasa a ser el directo de la clasificación
function signupLiveFor(d) {
  if (!d || !d.signup) return null;
  stopSignupPolling();
  return { code: d.signup.code, secret: d.signup.secret, on: true };
}

// Si se cancela el evento, la inscripción se cierra para que nadie más se apunte
function closeSignupOnCancel(d) {
  if (!d || !d.signup) return;
  stopSignupPolling();
  d.signup.open = false;
  publishSignupLobby(d);
}

function signupButtonHTML(d) {
  const n = d.signup ? signupActiveRows(d.signup).filter(r => !d.signup.removed[r.id]).length : 0;
  return `<button type="button" class="btn-icon btn-block" onclick="openSignupSheet()">${d.signup ? `Inscripción con QR · ${n} apuntado${n === 1 ? '' : 's'}` : 'Inscripción con QR'}</button>`;
}

// ---------- Jugador que se apunta (#directo=CÓDIGO con una inscripción) ----------
function mySignups() {
  try { return JSON.parse(localStorage.getItem('pm_inscripciones_v1') || '{}') || {}; } catch (e) { return {}; }
}

function saveMySignups(all) {
  try { localStorage.setItem('pm_inscripciones_v1', JSON.stringify(all)); } catch (e) {}
}

function signupListHTML(d, mine) {
  const joins = Array.isArray(d.joins) ? d.joins.filter(j => j && j.data && !j.data.out && cleanSignupName(j.data.name)) : [];
  if (!joins.length) return '<div><span>Todavía no se ha apuntado nadie</span></div>';
  return joins.map(j => {
    const name = cleanSignupName(j.data.name);
    const me = mine && !mine.out && mine.name === name;
    return `<div class="${me ? 'me' : ''}">${escapeHtml(name)}${me ? '<span>tú</span>' : d.mixed ? `<span>${j.data.g === 'F' ? 'Mujer' : 'Hombre'}</span>` : ''}</div>`;
  }).join('');
}

function renderSignupSpectator(d) {
  const box = document.getElementById('view-spectator');
  spectatorLast = d;
  const mine = mySignups()[spectatorCode];
  const signed = mine && !mine.out;
  const mode = !d.open ? 'closed' : signed && !signupEditing ? 'in' : 'form';
  const count = Array.isArray(d.joins) ? d.joins.filter(j => j && j.data && !j.data.out).length : 0;
  const key = [spectatorCode, mode, d.mixed, d.name, mine && mine.name, d.joins ? 1 : 0].join('|');
  // Mientras no cambie nada importante solo se actualiza la lista (así no se borra lo que se está escribiendo)
  if (spjDraw === key && document.getElementById('spj-list')) {
    document.getElementById('spj-list').innerHTML = signupListHTML(d, mine);
    document.getElementById('spj-count').textContent = String(count);
    return;
  }
  spjDraw = key;
  const prefill = (mine && mine.name) || (typeof myPlayerName !== 'undefined' && myPlayerName) || '';
  if (mine && mine.g) signupGender = mine.g;
  const form = `
    <div class="spe-card-title">${signupEditing ? 'Cambia tu nombre' : 'Apúntate'}</div>
    <div class="spj-form">
      <input type="text" id="spj-name" maxlength="40" placeholder="Nombre y apellido" value="${escapeHtml(prefill)}" autocomplete="name" onkeydown="if(event.key==='Enter') submitSignup()">
      ${d.mixed ? `<div class="spj-seg">
        <button type="button" id="spj-g-M" class="${signupGender === 'M' ? 'active' : ''}" onclick="pickSignupGender('M')">Hombre</button>
        <button type="button" id="spj-g-F" class="${signupGender === 'F' ? 'active' : ''}" onclick="pickSignupGender('F')">Mujer</button>
      </div>` : ''}
      <button class="btn-volt" id="spj-send" onclick="submitSignup()">${signupEditing ? 'Guardar' : 'Apuntarme'}</button>
      <div class="spj-done" id="spj-msg"></div>
    </div>`;
  const done = `
    <div class="spj-done">Estás apuntado como <strong>${escapeHtml(mine ? mine.name : '')}</strong>. Si te has equivocado, puedes cambiarlo mientras la inscripción siga abierta.</div>
    <div class="spj-actions mt-12">
      <button class="btn-icon" onclick="editSignup()">Cambiar nombre</button>
      <button class="btn-icon" onclick="leaveSignup()">Borrarme</button>
    </div>`;
  const closed = `<div class="spj-done">La inscripción está cerrada.${signed ? ` Estás apuntado como <strong>${escapeHtml(mine.name)}</strong>.` : ''}</div>`;
  box.innerHTML = `${spectatorHeadHTML()}
    <div class="spx-board">
      <div class="spx-status sb-status">
        <span class="spx-badge ${d.open ? 'over' : 'off'}">${d.open ? 'Inscripción abierta' : 'Inscripción cerrada'}</span>
        <span class="spx-status-txt">${escapeHtml(d.fmt || 'Americano')}</span>
      </div>
      <div class="spe-head">
        <div class="spe-title">${escapeHtml(d.name || 'Americano')}</div>
        <div class="spe-sub">Apúntate desde aquí. Cuando empiece, esta misma página mostrará la ronda en juego y la clasificación.</div>
      </div>
    </div>
    <div class="spe-card">${mode === 'form' ? form : mode === 'in' ? done : closed}</div>
    <div class="spe-card">
      <div class="spe-card-title">Apuntados <small id="spj-count">${count}</small></div>
      <div class="spj-list" id="spj-list">${signupListHTML(d, mine)}</div>
    </div>
    <div class="spx-foot">Se actualiza sola cada pocos segundos</div>`;
}

function pickSignupGender(g) {
  signupGender = g === 'F' ? 'F' : 'M';
  document.getElementById('spj-g-M')?.classList.toggle('active', signupGender === 'M');
  document.getElementById('spj-g-F')?.classList.toggle('active', signupGender === 'F');
}

async function submitSignup() {
  const input = document.getElementById('spj-name');
  const msg = document.getElementById('spj-msg');
  const btn = document.getElementById('spj-send');
  const name = cleanSignupName(input && input.value);
  if (name.length < 2) { if (msg) msg.textContent = 'Escribe tu nombre y apellido.'; return; }
  const all = mySignups();
  const mine = all[spectatorCode] || { player: liveRandom(24) };
  const g = spectatorLast && spectatorLast.mixed ? signupGender : undefined;
  if (btn) btn.disabled = true;
  try {
    const ok = await syncRpc('pm_live_join', { p_code: spectatorCode, p_player: mine.player, p_data: g ? { name, g } : { name } }, LIVE_CFG);
    if (ok === false) {
      if (msg) msg.textContent = 'La inscripción está cerrada o ya está completa.';
    } else {
      all[spectatorCode] = { player: mine.player, name, g, at: Date.now() };
      saveMySignups(all);
      signupEditing = false;
      vibrate([10, 30]);
      spjDraw = null;
      showToast('Te has apuntado');
      pollSpectator();
    }
  } catch (e) {
    if (msg) msg.textContent = signupMissingSQL(e.message)
      ? 'La inscripción todavía no está disponible. Avisa al organizador.'
      : 'No se ha podido enviar. Revisa la conexión y vuelve a intentarlo.';
  }
  if (btn) btn.disabled = false;
}

function editSignup() {
  signupEditing = true;
  spjDraw = null;
  if (spectatorLast) renderSignupSpectator(spectatorLast);
  document.getElementById('spj-name')?.focus();
}

async function leaveSignup() {
  const all = mySignups();
  const mine = all[spectatorCode];
  if (!mine || !confirm('¿Borrarte de la inscripción?')) return;
  try {
    await syncRpc('pm_live_join', { p_code: spectatorCode, p_player: mine.player, p_data: { name: mine.name, out: true } }, LIVE_CFG);
    all[spectatorCode] = { ...mine, out: true };
    saveMySignups(all);
    signupEditing = false;
    spjDraw = null;
    showToast('Te has borrado de la inscripción');
    pollSpectator();
  } catch (e) {
    showToast('No se ha podido borrar: revisa la conexión');
  }
}
