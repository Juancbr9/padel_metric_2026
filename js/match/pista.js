// ==========================================================
// MODOS DE ANOTAR, PERSPECTIVA DE LA PISTA Y PUNTO DEL GOLPE
// - Modo sencillo (state.inputMode 'swipe', por defecto): deslizar ↑ winner, ↓ error no forzado; tocar al jugador
//   abre tres botones grandes (winner, error no forzado, error forzado). No se elige golpe ni lugar.
// - Modo avanzado ('tap'): se elige el golpe con su dibujo y después se toca en la pista desde dónde golpeó.
// - Perspectiva (state.view / setupConfig.view): desde dónde se ve el partido. 'p2' = detrás de la pareja 2 (la
//   pareja 1 al fondo), 'p1' = detrás de la pareja 1, 'side' = desde el lateral (pareja 1 a la izquierda). La pista
//   del partido y la del punto del golpe se dibujan como las ve quien anota.
// Cambio de lado (state.ends, js/match/scoring.js): quien anota no se mueve, así que en los juegos impares la pista
// se gira (liveView: 'p2' ↔ 'p1' y 'side' ↔ 'side2', el lateral con la pareja 1 a la derecha). En el modo sencillo la
// base es siempre 'p2'. Las coordenadas se guardan respecto a cada pareja, así que el mapa de calor no cambia.
// Coordenadas guardadas en cada punto (cx, cy): X de 0 a 1 a lo ancho tal como se ve desde detrás de la pareja 2
// (0 = izquierda) e Y de 0 (fondo de la pareja 1) a 1 (fondo de la pareja 2); la red está en Y = 0,5. De ahí salen
// la zona (red < 3,4 m de la red, transición hasta la línea de saque a 6,95 m, fondo) y el lado (drive o revés).
// ==========================================================
const COURT_VIEWS = [['p2', 'Detrás de la pareja 2'], ['p1', 'Detrás de la pareja 1'], ['side', 'Desde el lateral']];
const INPUT_MODES = [['swipe', 'Sencillo'], ['tap', 'Avanzado']];

function viewToCanon(view, x, y) {
  if (view === 'p1') return [1 - x, 1 - y];
  if (view === 'side') return [1 - y, x];
  if (view === 'side2') return [y, 1 - x];
  return [x, y];
}

function canonToView(view, X, Y) {
  if (view === 'p1') return [1 - X, 1 - Y];
  if (view === 'side') return [Y, 1 - X];
  if (view === 'side2') return [1 - Y, X];
  return [X, Y];
}

function zoneFromCanon(pair, X, Y) {
  const d = (pair === 0 ? 0.5 - Y : Y - 0.5) * 20;
  const z = d < 3.4 ? 'R' : d < 6.95 ? 'T' : 'F';
  // La pareja 2 mira hacia arriba (su derecha es la derecha de la pantalla); la pareja 1, al revés
  const right = pair === 0 ? X < 0.5 : X > 0.5;
  return { z, l: right ? 'D' : 'V' };
}

function currentView() {
  return (state && state.view) || setupConfig.view || 'p2';
}

// Cómo se ve ahora la pista del partido: la perspectiva elegida, girada si las parejas han cambiado de lado
function liveView() {
  if (!state) return 'p2';
  const base = state.inputMode === 'tap' ? currentView() : 'p2';
  if (!state.ends) return base;
  return base === 'p2' ? 'p1' : base === 'p1' ? 'p2' : 'side2';
}

let shownCourtView = null;
function applyCourtView() {
  const arena = document.querySelector('#view-match .court-arena');
  if (!arena || !state) return;
  const view = liveView();
  const key = `${state.id}:${view}`;
  arena.classList.remove('view-p1', 'view-p2', 'view-side', 'view-side2');
  arena.classList.add(`view-${view}`);
  // Al cambiar de lado, las tarjetas entran con un fundido breve en su nuevo sitio
  if (shownCourtView && shownCourtView !== key && shownCourtView.split(':')[0] === String(state.id)) {
    arena.classList.remove('ends-swap'); void arena.offsetWidth; arena.classList.add('ends-swap');
  }
  shownCourtView = key;
}

// Opciones del partido: la pista tal como se ve en la pantalla, con cada jugador en su sitio, y botones para
// recolocarlos si no coincide con la realidad (cambiar de lado las parejas o el drive y el revés de una pareja)
function courtPositionsHTML() {
  const view = liveView();
  const cells = state.players.map((p, i) => {
    const pair = i < 2 ? 0 : 1;
    const drive = FIXED_COURT_SIDES[i] === 'Drive';
    const X = pair === 0 ? (drive ? 0.25 : 0.75) : (drive ? 0.75 : 0.25);
    const [x, y] = canonToView(view, X, pair === 0 ? 0.25 : 0.75);
    return `<div class="mo-court-p q-${y < 0.5 ? 't' : 'b'}${x < 0.5 ? 'l' : 'r'}"><span><i class="${pair ? 'sw-b' : 'sw-a'}"></i><b>${escapeHtml(liveSurname(p))}</b></span><small>${drive ? 'Drive' : 'Revés'}</small></div>`;
  }).join('');
  const names = pair => `${liveSurname(state.players[pair * 2])} y ${liveSurname(state.players[pair * 2 + 1])}`;
  const help = appSettings.autoEnds === false
    ? 'El cambio de lado automático está apagado en Ajustes.'
    : 'Las parejas cambian de lado solas en los juegos impares.';
  return `<div class="mo-block">
    <div class="mo-block-head"><strong>Posición en la pista</strong><small>${help} Si no coincide con la pista, corrígelo aquí.</small></div>
    <div class="mo-court${view.startsWith('side') ? ' is-side' : ''}" aria-label="Así está ahora la pista">${cells}</div>
    <div class="mo-pos-actions">
      <button type="button" class="btn-icon mo-wide" onclick="changeEndsManual(); openMatchOptions();">Cambiar de lado las parejas</button>
      <button type="button" class="btn-icon" onclick="swapSides(0); openMatchOptions();">Intercambiar ${escapeHtml(names(0))}</button>
      <button type="button" class="btn-icon" onclick="swapSides(1); openMatchOptions();">Intercambiar ${escapeHtml(names(1))}</button>
    </div>
  </div>`;
}

function setMatchView(v) {
  if (!state) return;
  state.view = v;
  persistActiveMatchState();
  applyCourtView();
  openMatchOptions();
}

function selectSetupView(v) {
  vibrate(8);
  setupConfig.view = v;
  renderSetupRules();
}

// ---------- Panel sencillo: tres botones grandes ----------
function renderSimpleSheet() {
  document.getElementById('shot-type-seg').innerHTML = '';
  const p = state.players[selectedSlot];
  const lane = sideToLane(p.side);
  document.getElementById('shot-grid').innerHTML = `<div class="simple-actions">
    <button type="button" class="simple-act w" onclick="recordAction('W', 'Winner', { z: null, l: '${lane}' })"><strong>Winner</strong><span>Punto ganado por ${escapeHtml(liveSurname(p))}</span></button>
    <button type="button" class="simple-act enf" onclick="recordAction('ENF', 'Error No Forzado', { z: null, l: '${lane}' })"><strong>Error no forzado</strong><span>Falló sin presión</span></button>
    <button type="button" class="simple-act ef" onclick="recordAction('EF', 'Error Forzado', { z: null, l: '${lane}' })"><strong>Error forzado</strong><span>Falló por el golpe del rival</span></button>
  </div>`;
}

// ---------- Punto del golpe (modo avanzado) ----------
let courtPick = null;

function pickShotLocation(type, shotId) {
  if (!state || selectedSlot === null) return;
  vibrate(8);
  courtPick = { type, shotId, mark: null };
  const p = state.players[selectedSlot];
  const shot = SHOT_BY_ID[shotId];
  document.getElementById('shot-type-seg').innerHTML = `<div class="pick-head"><strong>¿Desde dónde golpeó ${escapeHtml(liveSurname(p))}?</strong><span>${shot ? escapeHtml(shot.label) : ''} · toca en su campo</span></div>`;
  const grid = document.getElementById('shot-grid');
  grid.classList.add('is-pick');
  grid.innerHTML = `
    <div class="court-pick ${liveView().startsWith('side') ? 'is-side' : ''}">${courtPickSVG(liveView(), p.pair)}</div>
    <div class="pick-actions">
      <button type="button" class="btn-icon" onclick="renderShotSheet()">Atrás</button>
      <button type="button" class="btn-icon" onclick="recordAction(courtPick.type, courtPick.shotId)">Sin marcar el sitio</button>
    </div>`;
  document.querySelector('.court-pick svg')?.addEventListener('pointerup', onCourtPick);
}

function courtPickSVG(view, pair, { marks = [] } = {}) {
  const side = view === 'side' || view === 'side2';
  const W = side ? 400 : 200, H = side ? 200 : 400;
  const pt = (X, Y) => { const [x, y] = canonToView(view, X, Y); return [x * W, y * H]; };
  const line = (X1, Y1, X2, Y2, cls = '') => { const [a, b] = pt(X1, Y1), [c, d] = pt(X2, Y2); return `<line class="${cls}" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`; };
  const rect = (X1, Y1, X2, Y2, cls) => { const [a, b] = pt(X1, Y1), [c, d] = pt(X2, Y2); return `<rect class="${cls}" x="${Math.min(a, c)}" y="${Math.min(b, d)}" width="${Math.abs(c - a)}" height="${Math.abs(d - b)}"/>`; };
  const text = (X, Y, t, cls = '') => { const [a, b] = pt(X, Y); return `<text class="${cls}" x="${a}" y="${b}">${t}</text>`; };
  const srv = 6.95 / 20, red = 3.4 / 20;
  // Mitad de quien golpea: pareja 1 = Y de 0 a 0,5; pareja 2 = de 0,5 a 1
  const y0 = pair === 0 ? 0 : 0.5, y1 = pair === 0 ? 0.5 : 1;
  const dir = pair === 0 ? -1 : 1; // hacia el fondo de su campo
  const mid = (d) => 0.5 + dir * d;
  const laneDrive = pair === 0 ? 0.25 : 0.75, laneRev = pair === 0 ? 0.75 : 0.25;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pista para marcar desde dónde golpeó">
    ${rect(0, 0, 1, 1, 'cp-court')}
    ${rect(0, y0, 1, y1, 'cp-half')}
    ${line(0, 0.5 - srv, 1, 0.5 - srv)}${line(0, 0.5 + srv, 1, 0.5 + srv)}${line(0.5, 0.5 - srv, 0.5, 0.5 + srv)}
    ${line(0, mid(red), 1, mid(red), 'cp-guide')}
    ${rect(0, pair === 0 ? 0.5 : 0, 1, pair === 0 ? 1 : 0.5, 'cp-dim')}
    ${line(0, 0.5, 1, 0.5, 'cp-net')}
    ${text(0.5, mid(red / 2), 'RED', 'cp-zone')}${text(0.5, mid((red + srv) / 2), 'TRANSICIÓN', 'cp-zone')}${text(0.5, mid((srv + 0.5) / 2), 'FONDO', 'cp-zone')}
    ${text(laneDrive, mid(0.47), 'Drive', 'cp-lane')}${text(laneRev, mid(0.47), 'Revés', 'cp-lane')}
    ${marks.map(m => { const [a, b] = pt(m.X, m.Y); return `<circle class="cp-mark ${m.cls || ''}" cx="${a}" cy="${b}" r="${m.r || 7}"/>`; }).join('')}
    <g class="cp-mark-live"></g>
  </svg>`;
}

function onCourtPick(e) {
  if (!courtPick || !state) return;
  const svg = e.currentTarget;
  const r = svg.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  const [X, Y] = viewToCanon(liveView(), x, y);
  const pair = state.players[selectedSlot].pair;
  if ((pair === 0 && Y > 0.5) || (pair === 1 && Y < 0.5)) { vibrate([10, 30, 10]); showToast('Toca en el campo de su pareja'); return; }
  const [vb] = [svg.viewBox.baseVal];
  svg.querySelector('.cp-mark-live').innerHTML = `<circle class="cp-mark" cx="${x * vb.width}" cy="${y * vb.height}" r="9"/>`;
  const zone = zoneFromCanon(pair, X, Y);
  const { type, shotId } = courtPick;
  courtPick = null;
  setTimeout(() => recordAction(type, shotId, { ...zone, cx: Math.round(X * 1000) / 1000, cy: Math.round(Y * 1000) / 1000 }), 180);
}
