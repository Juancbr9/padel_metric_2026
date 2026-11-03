// ==========================================================
// EMPEZAR MÁS RÁPIDO: PARTIDO RÁPIDO, REPETIR EL ÚLTIMO, REVANCHA Y GRUPOS
// - Partido rápido: cuatro jugadores sin nombre y las reglas por defecto, sin pasar por "Nuevo partido".
// - Repetir: los mismos cuatro jugadores y las mismas reglas que un partido anterior.
// - Grupos: conjuntos de cuatro jugadores habituales guardados en appSettings.groups (en este móvil).
// - Si hay un partido en pausa, se pregunta antes de empezar otro (si no, se perdería).
// ==========================================================
function pausedMatchExists() {
  try {
    const saved = JSON.parse(localStorage.getItem('pm_partido_activo_v14') || 'null');
    return !!(saved && !saved.matchOver && saved.players);
  } catch (e) { return false; }
}

// Empieza un partido con estos jugadores (nombres o GEN_n) y, si se indican, estas reglas
function startMatchWith(slots, rules = {}, link = null) {
  const go = () => {
    setupConfig.slots = slots.map((s, i) => (s && !String(s).startsWith('GEN_') && dbPlayers.includes(s) ? s : `GEN_${i}`));
    ['deuceRule', 'thirdSetRule', 'inputMode'].forEach(k => { if (rules[k]) setupConfig[k] = rules[k]; });
    setupConfig.initialServer = 0;
    closeEventModal();
    closeMatchEnd();
    startMatch(link);
  };
  if (!pausedMatchExists()) { go(); return; }
  window.__pendingStart = go;
  openEventModal(`
    <div class="mo-title">Tienes un partido en pausa</div>
    <p class="bc-intro">${escapeHtml((pausedMatchSummary() || {}).label || '')}. Si empiezas otro, el partido en pausa se perderá.</p>
    <div class="exit-options">
      <button type="button" class="btn-volt" onclick="closeEventModal(); resumeSavedActiveMatch()">Continuar el partido en pausa</button>
      <button type="button" class="btn-icon exit-discard" onclick="window.__pendingStart && window.__pendingStart()">Empezar el nuevo partido</button>
    </div>`);
}

// Botón "Empezar partido" de la pantalla Nuevo partido
function startNewMatch() {
  startMatchWith([...setupConfig.slots]);
}

function quickMatch() {
  startMatchWith(['GEN_0', 'GEN_1', 'GEN_2', 'GEN_3']);
}

function rulesOf(m) {
  return { deuceRule: m.deuceRule, thirdSetRule: m.thirdSetRule, inputMode: m.inputMode };
}

function repeatMatch(idx = 0) {
  const m = matchHistory[idx];
  if (!m || !m.players) return;
  startMatchWith(m.players.map(p => (p.isGeneric ? 'GEN' : p.name)), rulesOf(m));
}

// Último partido que se puede repetir: con al menos un jugador con ficha
function lastRepeatable() {
  const m = matchHistory[0];
  if (!m || !m.players || m.players.every(p => p.isGeneric)) return null;
  return m;
}

function homeQuickStartHTML() {
  const m = lastRepeatable();
  const row = (title, sub, action) => `<button type="button" class="home-quick-row" onclick="${action}"><span><strong>${title}</strong><small>${sub}</small></span><span class="menu-row-hint">›</span></button>`;
  return `<div class="home-quick">
    ${m ? row('Repetir el último partido', escapeHtml(`${livePairName(0, m)} contra ${livePairName(1, m)}`), 'repeatMatch(0)') : ''}
    ${row('Partido rápido', 'Solo el marcador, sin elegir jugadores', 'quickMatch()')}
  </div>`;
}

// ---------- Grupos de jugadores habituales ----------
function playerGroups() {
  if (!Array.isArray(appSettings.groups)) appSettings.groups = [];
  return appSettings.groups;
}

function saveGroups() {
  try { localStorage.setItem('pm_ajustes_v1', JSON.stringify(appSettings)); } catch (e) {}
}

// Jugadores con los que más se ha jugado en los últimos 20 partidos (para sugerirlos arriba en el selector)
function recentPlayers(limit = 8) {
  const count = {};
  matchHistory.slice(0, 20).forEach(m => (m.players || []).forEach(p => {
    if (!p.isGeneric && dbPlayers.includes(p.name)) count[p.name] = (count[p.name] || 0) + 1;
  }));
  return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([n]) => n);
}

function openGroupsSheet() {
  const groups = playerGroups();
  const named = setupConfig.slots.filter(s => !s.startsWith('GEN_'));
  openEventModal(`
    <div class="mo-title">Grupos</div>
    <p class="bc-intro">Guarda a los cuatro jugadores con los que sueles jugar para ponerlos en la pista con un toque.</p>
    ${groups.length ? `<div class="menu-list">${groups.map((g, i) => `
      <div class="group-row">
        <button type="button" class="group-main" onclick="loadGroup(${i})">
          <strong>${escapeHtml(g.name)}</strong>
          <small>${escapeHtml(pairLabel(g.players.slice(0, 2)))} contra ${escapeHtml(pairLabel(g.players.slice(2, 4)))}</small>
        </button>
        <button type="button" class="btn-icon btn-sm" onclick="deleteGroup(${i})" aria-label="Borrar el grupo ${escapeHtml(g.name)}"><svg class="icon"><use href="#i-trash"/></svg></button>
      </div>`).join('')}</div>` : '<p class="empty-note">Todavía no hay grupos guardados.</p>'}
    ${named.length === 4 ? `
      <div class="group-save">
        <input type="text" id="group-name" maxlength="40" placeholder="Nombre del grupo (por ejemplo, Martes)">
        <button type="button" class="btn-volt" onclick="saveCurrentGroup()">Guardar los cuatro de la pista</button>
      </div>` : '<p class="exit-note">Para guardar un grupo, pon primero a cuatro jugadores con ficha en la pista.</p>'}`);
}

function saveCurrentGroup() {
  const players = [...setupConfig.slots];
  if (players.some(s => s.startsWith('GEN_'))) return;
  const name = (document.getElementById('group-name')?.value || '').trim() || `Grupo ${playerGroups().length + 1}`;
  playerGroups().unshift({ name: name.slice(0, 40), players });
  appSettings.groups = playerGroups().slice(0, 12);
  saveGroups();
  vibrate(10);
  showToast(`Grupo «${name}» guardado`);
  openGroupsSheet();
}

function loadGroup(i) {
  const g = playerGroups()[i];
  if (!g) return;
  setupConfig.slots = g.players.map((s, k) => (dbPlayers.includes(s) ? s : `GEN_${k}`));
  closeEventModal();
  renderSetupCourt();
  vibrate(10);
  showToast(`Grupo «${g.name}» en la pista`);
}

function deleteGroup(i) {
  const g = playerGroups()[i];
  if (!g) return;
  playerGroups().splice(i, 1);
  saveGroups();
  showToast(`Grupo «${g.name}» borrado`, { label: 'Deshacer', run: () => { playerGroups().splice(i, 0, g); saveGroups(); } });
  openGroupsSheet();
}
