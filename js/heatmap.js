// ==========================================================
// MAPA DE CALOR DE GOLPES: ZONA DE VOLEA (RED) Y GOLPES DE ATRÁS (FONDO)
// ==========================================================
let heatFilterPlayer = 'all';
let heatFilterType = 'all';

const HEAT_COLORS = { W: '0,230,118', E: '255,46,84' };

function heatCellStyle(cell, maxVal, type) {
  const W = cell ? cell.W : 0;
  const E = cell ? cell.E : 0;
  const val = type === 'W' ? W : type === 'E' ? E : W + E;
  const intensity = maxVal ? val / maxVal : 0;
  let rgb = HEAT_COLORS.W;
  if (type === 'E' || (type === 'all' && E > W)) rgb = HEAT_COLORS.E;
  if (type === 'all' && E === W && val > 0) rgb = '212,255,42';
  return { val, W, E, intensity, rgb };
}

// Pista completa vista desde arriba: Pareja 1 arriba, Pareja 2 abajo (igual que en la pantalla del partido)
function renderFullCourtHeatSVG(cells, type) {
  const vals = Object.values(cells).map(c => (type === 'W' ? c.W : type === 'E' ? c.E : c.W + c.E));
  const maxVal = Math.max(1, ...vals);
  const X0 = 10, Y0 = 10, CW = 280, NET = 220, BAND = 70;
  const bandY = (pair, z) => {
    const order = pair === 0 ? ['F', 'T', 'R'] : ['R', 'T', 'F'];
    return (pair === 0 ? Y0 : NET) + order.indexOf(z) * BAND;
  };
  // Pareja 1: drive a la izquierda de la pantalla; Pareja 2: drive a la derecha
  const laneX = (pair, l) => X0 + ((pair === 0 ? l === 'D' : l === 'V') ? 0 : CW / 2);

  let blobs = '', grid = '', labels = '';
  [0, 1].forEach(pair => ZONES.forEach(z => LANES.forEach(l => {
    const st = heatCellStyle(cells[`${pair}-${z}-${l}`], maxVal, type);
    const x = laneX(pair, l), y = bandY(pair, z), w = CW / 2, h = BAND;
    const cx = x + w / 2, cy = y + h / 2;
    if (st.val > 0) {
      blobs += `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="8" fill="rgba(${st.rgb},${(0.12 + st.intensity * 0.35).toFixed(2)})"/>`;
      blobs += `<circle cx="${cx}" cy="${cy}" r="${(16 + st.intensity * 30).toFixed(1)}" fill="rgba(${st.rgb},${(0.35 + st.intensity * 0.5).toFixed(2)})" filter="url(#heatBlur)"/>`;
      const sub = type === 'all' ? `${st.W}W · ${st.E}E` : (type === 'W' ? 'winners' : 'errores');
      labels += `<text x="${cx}" y="${cy + 4}" class="heat-num">${st.val}</text><text x="${cx}" y="${cy + 20}" class="heat-sub">${sub}</text>`;
    }
    grid += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="rgba(255,255,255,0.08)"/>`;
  })));

  const bandLabel = (pair, z) => `<text x="${X0 + 6}" y="${bandY(pair, z) + 13}" class="heat-band">${ZONE_NAMES[z].toUpperCase()}</text>`;
  [0, 1].forEach(pair => ZONES.forEach(z => { labels += bandLabel(pair, z); }));

  return `
    <svg class="heat-court" viewBox="0 0 300 440" role="img" aria-label="Mapa de calor de golpes por zona">
      <defs><filter id="heatBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>
      <rect x="${X0}" y="${Y0}" width="${CW}" height="420" rx="6" fill="#0E2756"/>
      ${grid}${blobs}
      <rect x="${X0}" y="${Y0}" width="${CW}" height="420" rx="6" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
      <line x1="${X0}" y1="${NET - BAND}" x2="${X0 + CW}" y2="${NET - BAND}" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
      <line x1="${X0}" y1="${NET + BAND}" x2="${X0 + CW}" y2="${NET + BAND}" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
      <line x1="150" y1="${NET - BAND}" x2="150" y2="${NET + BAND}" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
      <line x1="2" y1="${NET}" x2="298" y2="${NET}" stroke="#D4FF2A" stroke-width="3"/>
      <text x="150" y="${NET - 4}" class="heat-net">RED</text>
      ${labels}
      <text x="286" y="${NET - 5}" class="heat-pair" fill="#00F0FF" text-anchor="end">▲ PAREJA 1</text>
      <text x="286" y="${NET + 13}" class="heat-pair" fill="#FF2E54" text-anchor="end">▼ PAREJA 2</text>
    </svg>`;
}

// Media pista desde el punto de vista del jugador (red arriba): usada en la ficha de cada jugador
function renderHalfCourtHeatSVG(zoneLaneCounts, type = 'all') {
  const vals = Object.values(zoneLaneCounts).map(c => (type === 'W' ? c.W : type === 'E' ? c.E : c.W + c.E));
  const maxVal = Math.max(1, ...vals);
  let body = '';
  ZONES.forEach((z, zi) => ['V', 'D'].forEach((l, li) => {
    const st = heatCellStyle(zoneLaneCounts[`${z}-${l}`], maxVal, type);
    const x = 10 + li * 140, y = 22 + zi * 60;
    body += `<rect x="${x + 2}" y="${y + 2}" width="136" height="56" rx="8" fill="rgba(${st.rgb},${st.val ? (0.12 + st.intensity * 0.55).toFixed(2) : 0.04})"/>`;
    body += `<text x="${x + 70}" y="${y + 30}" class="heat-num">${st.val || ''}</text>`;
    body += `<text x="${x + 70}" y="${y + 47}" class="heat-sub">${ZONE_NAMES[z]} · ${l === 'D' ? 'Drive' : 'Revés'}</text>`;
  }));
  return `
    <svg class="heat-court half" viewBox="0 0 300 206" role="img" aria-label="Mapa de calor del jugador">
      <rect x="10" y="22" width="280" height="180" rx="6" fill="#0E2756" stroke="rgba(255,255,255,0.3)"/>
      <line x1="2" y1="20" x2="298" y2="20" stroke="#D4FF2A" stroke-width="3"/>
      <text x="150" y="14" class="heat-net">RED</text>
      ${body}
    </svg>`;
}

function setHeatFilter(kind, val) {
  if (kind === 'player') heatFilterPlayer = val;
  if (kind === 'type') heatFilterType = val;
  renderStats('heatmap');
}

function renderHeatmapPanel(target) {
  const hasZones = (target.points || []).some(pt => pt.z);
  if (!hasZones) {
    return `<div class="empty-note">Este partido no tiene golpes con zona registrada.<br>
      Usa el modo <strong>Toque</strong>: al elegir el golpe se guarda su zona (red, transición o fondo) y aquí verás el mapa de calor.</div>`;
  }
  if (heatFilterPlayer !== 'all' && !target.players.some(p => p.name === heatFilterPlayer)) heatFilterPlayer = 'all';
  const { cells, byPlayer } = computeZoneCounts(target, { setFilter: currentSetFilter, player: heatFilterPlayer });

  const chip = (kind, val, label, active) =>
    `<button type="button" class="sort-chip ${active ? 'active' : ''}" onclick="setHeatFilter('${kind}', ${typeof val === 'string' ? `'${val.replace(/'/g, "\\'")}'` : val})">${label}</button>`;
  const playerChips = [chip('player', 'all', 'Todos', heatFilterPlayer === 'all')]
    .concat(target.players.map(p => chip('player', p.name, p.name.split(' ')[0], heatFilterPlayer === p.name))).join('');
  const typeChips = [['all', 'Todo'], ['W', 'Winners'], ['E', 'Errores']]
    .map(([v, l]) => chip('type', v, l, heatFilterType === v)).join('');

  // Resumen por jugador: red vs fondo
  const rows = target.players.map(p => {
    const z = byPlayer[p.name] || { R: { W: 0, E: 0 }, T: { W: 0, E: 0 }, F: { W: 0, E: 0 } };
    const cell = k => `<span style="color:var(--emerald);">${z[k].W}</span>/<span style="color:var(--coral);">${z[k].E}</span>`;
    const totW = z.R.W + z.T.W + z.F.W;
    return `<tr><td style="font-weight:800;">${p.name}</td><td>${cell('R')}</td><td>${cell('T')}</td><td>${cell('F')}</td><td style="color:var(--volt);font-weight:800;">${pct(z.R.W, totW)}%</td></tr>`;
  }).join('');

  return `
    <div class="sort-strip" style="margin-top:10px;">${playerChips}</div>
    <div class="sort-strip">${typeChips}</div>
    ${renderFullCourtHeatSVG(cells, heatFilterType)}
    <div class="heat-legend"><span><i style="background:#00E676"></i>Winners</span><span><i style="background:#FF2E54"></i>Errores</span><span>Más intenso = más golpes</span></div>
    <table>
      <thead><tr><th>Jugador</th><th>Red</th><th>Trans.</th><th>Fondo</th><th>W en red</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="empty-note" style="margin-top:6px;">Cada casilla: <span style="color:var(--emerald);">winners</span>/<span style="color:var(--coral);">errores</span>.</div>`;
}
