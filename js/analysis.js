// ==========================================================
// ANÁLISIS AVANZADO A PARTIR DEL REGISTRO PUNTO A PUNTO
// (mapa de calor por zonas, momentos clave, saque y entrenador)
// ==========================================================
const ZONES = ['R', 'T', 'F'];
const LANES = ['D', 'V'];
const ZONE_NAMES = { R: 'Red / Volea', T: 'Transición', F: 'Fondo' };
const ERROR_TYPES = ['ENF', 'EF', 'DF'];

function pairOfIndex(idx) {
  return idx < 2 ? 0 : 1;
}

function matchPoints(match, setFilter = 'all') {
  const pts = (match && match.points) || [];
  return setFilter === 'all' ? pts : pts.filter(p => p.s === setFilter);
}

function playerPair(match, name) {
  const idx = match.players.findIndex(p => p.name === name);
  return idx === -1 ? null : pairOfIndex(idx);
}

// Cuenta golpes por zona: { 'pair-zone-lane': { W, E } } y por jugador
function computeZoneCounts(match, { setFilter = 'all', player = 'all' } = {}) {
  const cells = {};
  const byPlayer = {};
  let withZone = 0;
  matchPoints(match, setFilter).forEach(pt => {
    if (!pt.n || !pt.z) return;
    if (player !== 'all' && pt.n !== player) return;
    const pair = playerPair(match, pt.n);
    if (pair === null) return;
    const key = `${pair}-${pt.z}-${pt.l || 'D'}`;
    const isW = pt.t === 'W';
    const isE = ERROR_TYPES.includes(pt.t);
    if (!isW && !isE) return;
    withZone++;
    cells[key] = cells[key] || { W: 0, E: 0 };
    cells[key][isW ? 'W' : 'E']++;
    byPlayer[pt.n] = byPlayer[pt.n] || { R: { W: 0, E: 0 }, T: { W: 0, E: 0 }, F: { W: 0, E: 0 } };
    byPlayer[pt.n][pt.z][isW ? 'W' : 'E']++;
  });
  return { cells, byPlayer, withZone };
}

function computePressureStats(match, setFilter = 'all') {
  const pts = matchPoints(match, setFilter);
  const blank = () => ({
    bpChances: 0, bpWon: 0, bpFaced: 0, bpSaved: 0, goldPlayed: 0, goldWon: 0, tbWon: 0, tbPlayed: 0,
    servePts: 0, serveWon: 0, first: 0, firstWon: 0, second: 0, secondWon: 0, returnPts: 0, returnWon: 0,
    maxRun: 0, total: 0
  });
  const pair = [blank(), blank()];
  let run = 0, runPair = null;
  const clutch = {};

  pts.forEach(pt => {
    const srv = pairOfIndex(pt.sv);
    const rec = 1 - srv;
    pair[pt.w].total++;
    pair[srv].servePts++;
    pair[rec].returnPts++;
    if (pt.w === srv) pair[srv].serveWon++; else pair[rec].returnWon++;
    if (pt.sn === 1) { pair[srv].first++; if (pt.w === srv) pair[srv].firstWon++; }
    else { pair[srv].second++; if (pt.w === srv) pair[srv].secondWon++; }
    if (pt.bp) {
      pair[rec].bpChances++;
      pair[srv].bpFaced++;
      if (pt.w === rec) pair[rec].bpWon++; else pair[srv].bpSaved++;
    }
    if (pt.gp) {
      pair[0].goldPlayed++; pair[1].goldPlayed++;
      pair[pt.w].goldWon++;
    }
    if (pt.tb) {
      pair[0].tbPlayed++; pair[1].tbPlayed++;
      pair[pt.w].tbWon++;
    }
    if (pt.w === runPair) run++; else { run = 1; runPair = pt.w; }
    pair[pt.w].maxRun = Math.max(pair[pt.w].maxRun, run);
    if ((pt.bp || pt.gp || pt.tb) && pt.t === 'W' && pt.n) clutch[pt.n] = (clutch[pt.n] || 0) + 1;
  });

  const clutchTop = Object.entries(clutch).sort((a, b) => b[1] - a[1])[0] || null;
  return { pair, clutchTop, total: pts.length };
}

function pct(a, b) {
  return b ? Math.round((a / b) * 100) : 0;
}

// Consejos automáticos tipo "entrenador" a partir de los datos del partido
function generateCoachInsights(match, setFilter = 'all') {
  const tips = [];
  const pts = matchPoints(match, setFilter);
  if (pts.length < 6) {
    return [{ icon: '⏳', text: 'Registra más puntos con el modo Toque para que el entrenador pueda analizar el partido.' }];
  }
  const { pair } = computePressureStats(match, setFilter);
  const { byPlayer } = computeZoneCounts(match, { setFilter });
  const pairName = i => `${match.players[i * 2].name.split(' ')[0]}/${match.players[i * 2 + 1].name.split(' ')[0]}`;

  // Zonas: dónde gana y dónde pierde cada pareja
  [0, 1].forEach(pi => {
    const zone = { R: { W: 0, E: 0 }, T: { W: 0, E: 0 }, F: { W: 0, E: 0 } };
    match.players.forEach((p, idx) => {
      if (pairOfIndex(idx) !== pi || !byPlayer[p.name]) return;
      ZONES.forEach(z => { zone[z].W += byPlayer[p.name][z].W; zone[z].E += byPlayer[p.name][z].E; });
    });
    const totW = ZONES.reduce((a, z) => a + zone[z].W, 0);
    const totE = ZONES.reduce((a, z) => a + zone[z].E, 0);
    if (totE >= 4 && zone.F.E / totE >= 0.55) {
      tips.push({ icon: '🎯', text: `${pairName(pi)}: el ${pct(zone.F.E, totE)}% de sus errores llegan desde el fondo. Más globo y paciencia; no forzar la bajada.` });
    }
    if (totE >= 4 && zone.R.E / totE >= 0.55) {
      tips.push({ icon: '🧱', text: `${pairName(pi)}: falla mucho en la red (${zone.R.E} errores). Voleas más largas y al centro, menos ángulo.` });
    }
    if (totW >= 4 && zone.R.W / totW >= 0.6) {
      tips.push({ icon: '👑', text: `${pairName(pi)} manda en la red: ${pct(zone.R.W, totW)}% de sus winners son en zona de volea. Recuperar la red cuanto antes.` });
    }
    if (totW >= 3 && zone.T.W + zone.T.E >= 4 && zone.T.E > zone.T.W * 2) {
      tips.push({ icon: '⚠️', text: `${pairName(pi)} sufre en la transición (${zone.T.E} errores). No quedarse en "tierra de nadie".` });
    }
  });

  // Saque y resto
  [0, 1].forEach(pi => {
    const st = pair[pi];
    if (st.second >= 4 && pct(st.secondWon, st.second) < 40) {
      tips.push({ icon: '🎾', text: `${pairName(pi)} solo gana el ${pct(st.secondWon, st.second)}% con segundo saque. Priorizar meter el primero aunque sea más lento.` });
    }
    if (st.bpChances >= 3 && pct(st.bpWon, st.bpChances) < 35) {
      tips.push({ icon: '🔓', text: `${pairName(pi)} convirtió ${st.bpWon} de ${st.bpChances} bolas de break. Falta acierto en los puntos clave.` });
    }
    if (st.bpFaced >= 3 && pct(st.bpSaved, st.bpFaced) >= 70) {
      tips.push({ icon: '🛡️', text: `${pairName(pi)} salvó ${st.bpSaved} de ${st.bpFaced} bolas de break. Muy sólidos bajo presión.` });
    }
    if (st.maxRun >= 6) {
      tips.push({ icon: '⚡', text: `${pairName(pi)} llegó a encadenar ${st.maxRun} puntos seguidos.` });
    }
  });

  // Jugadores: el que más regala y el más determinante
  const ps = match.players;
  const worst = [...ps].sort((a, b) => (b.ENF || 0) - (a.ENF || 0))[0];
  const total = ps.reduce((a, p) => a + (p.ENF || 0), 0);
  if (worst && worst.ENF >= 4 && worst.ENF / Math.max(1, total) >= 0.4) {
    tips.push({ icon: '📉', text: `${worst.name} acumula ${worst.ENF} errores no forzados (${pct(worst.ENF, total)}% de los del partido). Bajar el riesgo.` });
  }
  const best = [...ps].sort((a, b) => ((b.W || 0) - (b.ENF || 0)) - ((a.W || 0) - (a.ENF || 0)))[0];
  if (best && (best.W - best.ENF) >= 3) {
    tips.push({ icon: '🏆', text: `${best.name} es el jugador más determinante: balance de +${best.W - best.ENF} (winners menos errores).` });
  }

  if (tips.length === 0) tips.push({ icon: '⚖️', text: 'Partido muy igualado: ninguna zona ni fase del juego marca diferencias claras.' });
  return tips.slice(0, 6);
}

// ==========================================================
// LOGROS (INSIGNIAS) DE CADA JUGADOR EN UN PARTIDO
// ==========================================================
const BADGES = {
  sniper: { icon: '🎯', name: 'Francotirador', desc: '8 o más winners en un partido' },
  wall: { icon: '🧱', name: 'Muro', desc: 'Máximo 1 error no forzado (con 5+ puntos jugados)' },
  netKing: { icon: '👑', name: 'Rey de la red', desc: '5 o más winners en zona de volea' },
  smash: { icon: '💣', name: 'Cañonero', desc: '3 o más remates ganadores' },
  bagel: { icon: '🍩', name: 'Rosco', desc: 'Ganar un set 6-0' },
  comeback: { icon: '🔥', name: 'Remontada', desc: 'Ganar tras perder el primer set' },
  ace: { icon: '🚀', name: 'Saque bala', desc: '2 o más saques directos' },
  streak: { icon: '⚡', name: 'En llamas', desc: 'Racha de 5 winners seguidos' },
  clutch: { icon: '🧊', name: 'Sangre fría', desc: '2+ winners en bolas de break, punto de oro o tie-break' }
};

function badgesForPlayerInMatch(match, idx) {
  const p = match.players[idx];
  if (!p) return [];
  const pair = pairOfIndex(idx);
  const won = match.winnerPair === pair;
  const out = [];
  const played = (p.W || 0) + (p.ENF || 0) + (p.EF || 0);
  if ((p.W || 0) >= 8) out.push('sniper');
  if (played >= 5 && (p.ENF || 0) <= 1) out.push('wall');
  const netW = (match.points || []).filter(pt => pt.n === p.name && pt.t === 'W' && pt.z === 'R').length;
  if (netW >= 5) out.push('netKing');
  if (((p.shots && p.shots['Remate']) || 0) >= 3) out.push('smash');
  if ((match.sets || []).some(s => s[pair] === 6 && s[1 - pair] === 0)) out.push('bagel');
  const s1 = (match.sets || [])[0];
  if (won && s1 && s1[1 - pair] > s1[pair]) out.push('comeback');
  if ((p.aces || 0) >= 2) out.push('ace');
  if ((p.maxStreak || 0) >= 5) out.push('streak');
  const clutchW = (match.points || []).filter(pt => pt.n === p.name && pt.t === 'W' && (pt.bp || pt.gp || pt.tb)).length;
  if (clutchW >= 2) out.push('clutch');
  return out;
}

function badgeChipsHTML(keys, counts = null) {
  if (!keys.length) return '';
  return `<div class="badge-row">${keys.map(k => {
    const b = BADGES[k];
    const c = counts && counts[k] > 1 ? ` ×${counts[k]}` : '';
    return `<span class="badge-chip" title="${b.desc}">${b.icon} ${b.name}${c}</span>`;
  }).join('')}</div>`;
}
