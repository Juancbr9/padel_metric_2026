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
  return fmtDate(ts, { day: '2-digit', month: 'short', year: 'numeric' });
}

// Selector de jugadores: lista con buscador (los elegidos arriba), un toque marca o desmarca, y alta rápida.
// El texto buscado se conserva entre repintados (chooserQuery) para poder marcar varios seguidos.
let chooserQuery = '';
function renderPlayerChooserHTML(selected, { onToggle, onAdd, showGender = false, exclude = [] }) {
  const elos = eloMap();
  const all = [...new Set([...dbPlayers, ...selected])].filter(n => !exclude.includes(n))
    .sort((a, b) => (selected.includes(b) - selected.includes(a)) || eloOfName(b, elos) - eloOfName(a, elos));
  const q = chooserQuery.trim().toLowerCase();
  const rows = all.map(name => {
    const on = selected.includes(name);
    const prof = ensureProfile(name);
    const g = showGender ? (prof.gender === 'F' ? 'Mujer · ' : 'Hombre · ') : '';
    const hay = `${name} ${prof.club || ''}`.toLowerCase();
    return `<button type="button" class="chooser-row ${on ? 'on' : ''} ${q && !hay.includes(q) ? 'hidden' : ''}" data-q="${escapeHtml(hay)}" onclick="${onToggle}(${jsArg(name)})">
      ${renderAvatarHTML(name, 'avatar-sm')}
      <span class="chooser-txt"><strong>${escapeHtml(name)}</strong><small>${g}ELO ${eloOfName(name, elos)}${prof.club ? ` · ${escapeHtml(prof.club)}` : ''}</small></span>
      <span class="chooser-check" aria-hidden="true"></span>
    </button>`;
  }).join('');
  return `
    <input type="search" class="chooser-search" placeholder="Buscar jugador…" aria-label="Buscar jugador" autocomplete="off" value="${escapeHtml(chooserQuery)}" oninput="filterChooser(this)">
    <div class="chooser-list">${rows || '<span class="empty-note pad-4">No hay jugadores todavía: añádelos abajo.</span>'}</div>
    <div class="input-row mt-8">
      <input type="text" id="quick-player-name" name="jugador" autocomplete="off" aria-label="Añadir jugador nuevo" placeholder="Ej. Lucía Fernández…" onkeydown="if(event.key==='Enter'){${onAdd}();}">
      ${showGender ? `<select class="mw-90" id="quick-player-gender" aria-label="Sexo del jugador nuevo"><option value="M">Hombre</option><option value="F">Mujer</option></select>` : ''}
      <button type="button" class="btn-icon" onclick="${onAdd}()" aria-label="Añadir jugador"><svg class="icon"><use href="#i-plus"/></svg></button>
    </div>`;
}

function filterChooser(input) {
  chooserQuery = input.value;
  const q = chooserQuery.trim().toLowerCase();
  input.parentElement.querySelectorAll('.chooser-row').forEach(r => r.classList.toggle('hidden', !!q && !r.dataset.q.includes(q)));
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
