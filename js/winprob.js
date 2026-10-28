// ==========================================================
// PROBABILIDAD DE VICTORIA EN DIRECTO
// Modelo punto → juego → set → partido con las reglas de la app (ventaja, star point, punto de oro,
// tie-break y súper tie-break). Parte del ELO de las parejas y se ajusta con los puntos ganados
// al saque y al resto durante el partido. Todo desde el punto de vista de la pareja 1 ("A").
// ==========================================================
const WP_SERVE_EDGE = 0.06;   // con parejas iguales, quien saca gana ~56 % de los puntos
const WP_PRIOR_WEIGHT = 24;   // cuánto pesa la previsión inicial, medido en "puntos jugados"

function wpClamp(p) {
  return Math.min(0.95, Math.max(0.05, p));
}

// Juego: p = probabilidad de que A gane cada punto de este juego (el saque no cambia dentro del juego)
function wpGame(p, a, b, d, deuceRule) {
  const q = 1 - p;
  const golden = dd => deuceRule === 'golden' || (deuceRule === 'star' && dd >= 2);
  const memo = new Map();
  const G = (a, b, d) => {
    if (a >= 4 && a - b >= 2) return 1;
    if (b >= 4 && b - a >= 2) return 0;
    if (a === 3 && b === 3) {
      if (golden(d)) return p;
      if (deuceRule !== 'star') return (p * p) / (1 - 2 * p * q);
      return p * G(4, 3, d) + q * G(3, 4, d);
    }
    if (a === 4 && b === 3) return p + q * G(3, 3, d + 1);
    if (a === 3 && b === 4) return p * G(3, 3, d + 1);
    const key = a * 100 + b * 10 + d;
    if (memo.has(key)) return memo.get(key);
    const v = p * G(a + 1, b, d) + q * G(a, b + 1, d);
    memo.set(key, v);
    return v;
  };
  return G(a, b, d);
}

// Pareja que saca el punto k (empezando en 0) de un tie-break que abrió la pareja t0:
// el 1.er punto lo saca t0 y después el saque cambia cada dos puntos
function wpTiebreakServer(k, t0) {
  return Math.floor((k + 1) / 2) % 2 === 0 ? t0 : 1 - t0;
}

// Tie-break a "target" puntos con diferencia de 2. ps / pr: A gana el punto con saque propio / del rival
function wpTiebreak(ps, pr, a, b, target, t0) {
  const memo = new Map();
  const T = (a, b) => {
    if (a >= target && a - b >= 2) return 1;
    if (b >= target && b - a >= 2) return 0;
    if (a === b && a >= target - 1) {
      // Desde el empate, los dos puntos siguientes los saca uno cada pareja
      const w = ps * pr, l = (1 - ps) * (1 - pr);
      return w / (w + l);
    }
    const key = a * 1000 + b;
    if (memo.has(key)) return memo.get(key);
    const p = wpTiebreakServer(a + b, t0) === 0 ? ps : pr;
    const v = p * T(a + 1, b) + (1 - p) * T(a, b + 1);
    memo.set(key, v);
    return v;
  };
  return T(a, b);
}

// Probabilidad de que la pareja A gane el partido desde el estado actual
function wpMatch(st, ps, pr) {
  if (st.matchOver) return st.winnerPair === 0 ? 1 : st.winnerPair === 1 ? 0 : 0.5;
  const rule = st.deuceRule || 'adv';
  const superTb = st.thirdSetRule === 'supertb';
  const pTeam = t => (t === 0 ? ps : pr);
  const gameFresh = [wpGame(pTeam(0), 0, 0, 0, rule), wpGame(pTeam(1), 0, 0, 0, rule)];
  const setWon = (x, y) => (x >= 6 && x - y >= 2) || x === 7;
  const memo = new Map();

  // M: A gana el partido, al empezar un juego con sets (sa, sb), juegos (ga, gb) y saque de la pareja T
  const M = (sa, sb, ga, gb, T) => {
    if (sa === 2) return 1;
    if (sb === 2) return 0;
    const key = `${sa}${sb}|${ga}|${gb}|${T}`;
    if (memo.has(key)) return memo.get(key);
    let v;
    if (superTb && sa === 1 && sb === 1) {
      v = wpTiebreak(ps, pr, 0, 0, 10, T);
    } else if (ga === 6 && gb === 6) {
      // Tras el tie-break empieza sacando la pareja que restó el primer punto
      const t = wpTiebreak(ps, pr, 0, 0, 7, T);
      v = t * M(sa + 1, sb, 0, 0, 1 - T) + (1 - t) * M(sa, sb + 1, 0, 0, 1 - T);
    } else {
      const g = gameFresh[T];
      v = g * afterGame(sa, sb, ga + 1, gb, 1 - T) + (1 - g) * afterGame(sa, sb, ga, gb + 1, 1 - T);
    }
    memo.set(key, v);
    return v;
  };
  const afterGame = (sa, sb, ga, gb, T) => {
    if (setWon(ga, gb)) return M(sa + 1, sb, 0, 0, T);
    if (setWon(gb, ga)) return M(sa, sb + 1, 0, 0, T);
    return M(sa, sb, ga, gb, T);
  };

  let sa = 0, sb = 0;
  for (let i = 0; i < st.currentSet; i++) {
    const s = st.sets[i];
    if (s[0] > s[1]) sa++;
    else if (s[1] > s[0]) sb++;
  }
  if (sa >= 2) return 1;
  if (sb >= 2) return 0;
  const T = st.serverIdx < 2 ? 0 : 1;
  const [a, b] = st.pts;
  if (st.inSuperTB) {
    const t0 = wpTiebreakServer(a + b, 0) === 0 ? T : 1 - T;
    return wpTiebreak(ps, pr, a, b, 10, t0);
  }
  const [ga, gb] = st.sets[st.currentSet];
  if (st.inTieBreak) {
    const t0 = wpTiebreakServer(a + b, 0) === 0 ? T : 1 - T;
    const t = wpTiebreak(ps, pr, a, b, 7, t0);
    return t * M(sa + 1, sb, 0, 0, 1 - t0) + (1 - t) * M(sa, sb + 1, 0, 0, 1 - t0);
  }
  const g = wpGame(pTeam(T), a, b, st.deuceCount || 0, rule);
  return g * afterGame(sa, sb, ga + 1, gb, 1 - T) + (1 - g) * afterGame(sa, sb, ga, gb + 1, 1 - T);
}

// Previsión inicial: ventaja por punto que reproduce la probabilidad del ELO (1 / (1 + 10^(dif/400)))
function wpPriorFromElo(eloA, eloB, rules) {
  const E = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  const fresh = {
    sets: [[0, 0], [0, 0], [0, 0]], currentSet: 0, pts: [0, 0], deuceCount: 0,
    deuceRule: rules.deuceRule, thirdSetRule: rules.thirdSetRule
  };
  const evalEdge = d => {
    const ps = wpClamp(0.5 + WP_SERVE_EDGE + d), pr = wpClamp(0.5 - WP_SERVE_EDGE + d);
    return 0.5 * (wpMatch({ ...fresh, serverIdx: 0 }, ps, pr) + wpMatch({ ...fresh, serverIdx: 2 }, ps, pr));
  };
  let lo = -0.3, hi = 0.3;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (evalEdge(mid) < E) lo = mid; else hi = mid;
  }
  const d = (lo + hi) / 2;
  return { ps: wpClamp(0.5 + WP_SERVE_EDGE + d), pr: wpClamp(0.5 - WP_SERVE_EDGE + d), E };
}

// Probabilidades por punto: la previsión inicial corregida con lo que está pasando en la pista
function wpPointRates(st) {
  const prior = st.prior || { ps: 0.5 + WP_SERVE_EDGE, pr: 0.5 - WP_SERVE_EDGE };
  let ns = 0, ws = 0, nr = 0, wr = 0;
  (st.points || []).forEach(pt => {
    if (pt.sv === undefined || pt.sv === null) return;
    if (pt.sv < 2) { ns++; if (pt.w === 0) ws++; }
    else { nr++; if (pt.w === 0) wr++; }
  });
  const W = WP_PRIOR_WEIGHT;
  return { ps: wpClamp((W * prior.ps + ws) / (W + ns)), pr: wpClamp((W * prior.pr + wr) / (W + nr)) };
}

function currentWinProb(st) {
  const { ps, pr } = wpPointRates(st);
  return Math.round(wpMatch(st, ps, pr) * 1000) / 1000;
}

// Al empezar un partido: previsión según el ELO medio de cada pareja (los genéricos cuentan como 1500)
function initMatchWinProb(st) {
  try {
    const elos = eloMap();
    const elo = p => (p.isGeneric ? ELO_START : eloOfName(p.name, elos));
    const a = (elo(st.players[0]) + elo(st.players[1])) / 2;
    const b = (elo(st.players[2]) + elo(st.players[3])) / 2;
    st.prior = wpPriorFromElo(a, b, st);
  } catch (e) {
    st.prior = null;
  }
  st.wp = currentWinProb(st);
  st.wpStart = st.wp;
}

// Serie de la probabilidad a lo largo del partido (solo partidos jugados con esta versión)
function wpSeries(match) {
  const pts = (match && match.points) || [];
  if (!pts.length || pts[pts.length - 1].wp === undefined) return null;
  const series = [{ wp: match.wpStart ?? 0.5, s: 0 }];
  pts.forEach((pt, i) => { if (pt.wp !== undefined) series.push({ wp: pt.wp, s: pt.s, i }); });
  return series;
}

// Punto que más cambió la probabilidad de victoria
function wpKeyMoment(match) {
  const series = wpSeries(match);
  if (!series || series.length < 3) return null;
  let best = null;
  for (let k = 1; k < series.length; k++) {
    const swing = series[k].wp - series[k - 1].wp;
    if (!best || Math.abs(swing) > Math.abs(best.swing)) best = { swing, idx: series[k].i, k };
  }
  if (!best) return null;
  return { ...best, point: match.points[best.idx] };
}

// Gráfico de la probabilidad de victoria de la pareja 1 a lo largo del partido: por encima de la línea del 50 %
// manda la pareja 1 y por debajo la pareja 2. Separa los sets y marca el momento clave
function wpChartSVG(match, { w = 320, h = 100, idPrefix = 'wpc' } = {}) {
  const series = wpSeries(match);
  if (!series || series.length < 3) return '';
  const pad = 5, n = series.length;
  const X = i => (i / (n - 1)) * w;
  const Y = v => pad + (1 - v) * (h - 2 * pad);
  const mid = Y(0.5);
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.wp).toFixed(1)}`).join('');
  const area = `${line}L${w} ${mid}L0 ${mid}Z`;
  const seps = [];
  for (let k = 2; k < n; k++) if (series[k].s !== series[k - 1].s) seps.push(X(k - 1));
  const key = wpKeyMoment(match);
  const keyDot = key ? `<circle cx="${X(key.k).toFixed(1)}" cy="${Y(series[key.k].wp).toFixed(1)}" r="4.5" class="wpc-key"/>` : '';
  return `<svg class="wp-chart" viewBox="0 0 ${w} ${h}" data-n="${n}" role="img" aria-label="Evolución de la probabilidad de victoria">
    <defs><clipPath id="${idPrefix}-top"><rect width="${w}" height="${mid}"/></clipPath><clipPath id="${idPrefix}-bot"><rect y="${mid}" width="${w}" height="${h - mid}"/></clipPath></defs>
    ${seps.map(x => `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${h}" class="wpc-sep"/>`).join('')}
    <line x1="0" y1="${mid}" x2="${w}" y2="${mid}" class="wpc-mid"/>
    <path d="${area}" clip-path="url(#${idPrefix}-top)" class="wpc-a"/>
    <path d="${area}" clip-path="url(#${idPrefix}-bot)" class="wpc-b"/>
    <path d="${line}" class="wpc-line"/>
    ${keyDot}
    <line class="wpc-cursor" x1="0" y1="0" x2="0" y2="${h}" style="display:none"/>
  </svg>`;
}
