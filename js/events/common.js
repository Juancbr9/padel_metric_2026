// ==========================================================
// UTILIDADES COMPARTIDAS POR TORNEOS Y AMERICANOS
// ==========================================================
let eventDraft = null;

function eloMap() {
  const { statsMap } = computeAllPlayersStats();
  const out = {};
  Object.values(statsMap).forEach(st => { out[st.name] = st.elo; });
  return out;
}

function eloOfName(name, map) {
  return (map && map[name]) || ELO_START;
}

function ensurePlayerInDB(name) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  if (!dbPlayers.includes(clean)) dbPlayers.push(clean);
  ensureProfile(clean);
  return clean;
}

function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
}

function pairLabel(players) {
  return players.map(shortName).join(' / ');
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatEventDate(ts) {
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Selector de jugadores por chips (base de datos + alta rápida)
function renderPlayerChooserHTML(selected, { onToggle, onAdd, showGender = false, exclude = [] }) {
  const elos = eloMap();
  const all = [...new Set([...dbPlayers, ...selected])].filter(n => !exclude.includes(n)).sort((a, b) => eloOfName(b, elos) - eloOfName(a, elos));
  const chips = all.map(name => {
    const on = selected.includes(name);
    const g = showGender ? (ensureProfile(name).gender === 'F' ? ' · F' : ' · M') : '';
    return `<button type="button" class="player-chip ${on ? 'on' : ''}" onclick="${onToggle}(${jsArg(name)})">${escapeHtml(name)}<small>${eloOfName(name, elos)}${g}</small></button>`;
  }).join('');
  return `
    <div class="player-chips">${chips || '<span class="empty-note" style="padding:4px;">No hay jugadores todavía: añádelos abajo.</span>'}</div>
    <div class="input-row" style="margin-top:8px;">
      <input type="text" id="quick-player-name" placeholder="Añadir jugador nuevo (nombre y apellido)" onkeydown="if(event.key==='Enter'){${onAdd}();}">
      ${showGender ? `<select id="quick-player-gender" style="max-width:90px;"><option value="M">Hombre</option><option value="F">Mujer</option></select>` : ''}
      <button type="button" class="btn-icon" onclick="${onAdd}()"><svg class="icon"><use href="#i-plus"/></svg></button>
    </div>`;
}

function readQuickPlayer() {
  const input = document.getElementById('quick-player-name');
  const name = ensurePlayerInDB(input ? input.value : '');
  if (!name) return null;
  const g = document.getElementById('quick-player-gender');
  if (g) ensureProfile(name).gender = g.value;
  saveDB();
  return name;
}

// Modal genérico para resultados de torneos y americanos
function openEventModal(html) {
  document.getElementById('event-modal-body').innerHTML = html;
  document.getElementById('event-modal').classList.remove('hidden');
}

function closeEventModal() {
  document.getElementById('event-modal').classList.add('hidden');
}

function segOptionsHTML(options, current, onPick) {
  return `<div class="ios-segmented cols-${options.length}">${options.map(o => `
    <button type="button" class="ios-seg-option ${o.value === current ? 'active' : ''}" onclick="${onPick}(${jsArg(o.value)})">
      <span class="opt-main">${o.main}</span>${o.sub ? `<span class="opt-sub">${o.sub}</span>` : ''}
    </button>`).join('')}</div>`;
}
