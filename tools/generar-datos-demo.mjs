// Genera assets/demo/padel-metric-demo.json simulando partidos punto a punto con el motor real de la app.
// Uso (desde la raíz del repositorio):
//   python3 -m http.server 8765 &
//   node tools/generar-datos-demo.mjs
// Necesita Playwright con Chromium. La semilla es fija, así que el resultado es reproducible.
import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 860 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('dialog', d => d.accept());
await p.goto('http://localhost:8765/');
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForTimeout(400);
const payload = await p.evaluate(() => {
  // ---------- Semilla aleatoria reproducible ----------
  let seed = 20261022;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  Math.random = rnd;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  const MEN = [
    ['Arturo Coello', 'España', 'Zurdo'], ['Agustín Tapia', 'Argentina'], ['Alejandro Galán', 'España'], ['Federico Chingotto', 'Argentina'],
    ['Juan Lebrón', 'España'], ['Franco Stupaczuk', 'Argentina'], ['Martín Di Nenno', 'Argentina'], ['Paquito Navarro', 'España'],
    ['Mike Yanguas', 'España'], ['Alejandro Ruiz', 'España'], ['Juan Tello', 'Argentina'], ['Javi Garrido', 'España'],
    ['Coki Nieto', 'España'], ['Jon Sanz', 'España'], ['Leo Augsburger', 'Argentina']
  ];
  const WOMEN = [
    ['Ariana Sánchez', 'España'], ['Paula Josemaría', 'España'], ['Gemma Triay', 'España'], ['Delfina Brea', 'Argentina'],
    ['Claudia Fernández', 'España'], ['Bea González', 'España'], ['Marta Ortega', 'España'], ['Aranzazu Osoro', 'España'],
    ['Sofía Araújo', 'Portugal'], ['Andrea Ustero', 'España'], ['Alejandra Salazar', 'España'], ['Virginia Riera', 'Argentina'],
    ['Tamara Icardo', 'España'], ['Lucía Sainz', 'España'], ['Jessica Castelló', 'España']
  ];
  const level = {};
  const note = 'Perfil de ejemplo inspirado en el circuito profesional. Los partidos, estadísticas y ELO son simulados para probar la app.';
  [[MEN, 'M'], [WOMEN, 'F']].forEach(([list, g]) => list.forEach(([name, country, hand], i) => {
    dbPlayers.push(name);
    const parts = name.split(' ');
    dbProfiles[name] = { firstName: parts[0], lastName: parts.slice(1).join(' '), gender: g, club: country, hand: hand || 'Diestro', prefSide: 'Ambas', notes: note, photo: null };
    level[name] = 100 - i * 2.2;
  }));
  const men = MEN.map(x => x[0]), women = WOMEN.map(x => x[0]);
  saveDB();

  // ---------- Reloj simulado: del día -60 a ayer ----------
  const DAY = 864e5;
  let clock = Date.now() - 84 * DAY;
  const tick = (minDays, maxDays) => {
    clock += (minDays + rnd() * (maxDays - minDays)) * DAY;
    // Horarios de club: entre las 9:00 y las 22:00
    const d = new Date(clock);
    if (d.getHours() < 9) d.setHours(9 + Math.floor(rnd() * 4), Math.floor(rnd() * 60));
    else if (d.getHours() >= 22) { d.setDate(d.getDate() + 1); d.setHours(10 + Math.floor(rnd() * 3), Math.floor(rnd() * 60)); }
    clock = Math.min(d.getTime(), Date.now() - DAY / 2);
    return clock;
  };
  const fmtDate = ts => new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const WIN_SHOTS = [['Volea', 30], ['Remate', 18], ['Bandeja/Víbora', 22], ['Fondo/Bajada', 22]];
  const ENF_SHOTS = [['Red', 45], ['Fondo', 55]];
  const weighted = list => { let r = rnd() * list.reduce((a, x) => a + x[1], 0); for (const [v, w] of list) { if ((r -= w) <= 0) return v; } return list[0][0]; };
  const otherZone = z => pick(['R', 'T', 'F'].filter(x => x !== z));

  // Juega un partido completo punto a punto con el motor real de la app
  function simulateMatch(names, { deuceRule = pick(['adv', 'golden', 'star']), thirdSetRule = pick(['supertb', 'normal']), link = null, ts = null } = {}) {
    setupConfig.slots = names;
    setupConfig.deuceRule = deuceRule;
    setupConfig.thirdSetRule = thirdSetRule;
    setupConfig.initialServer = Math.floor(rnd() * 4);
    setupConfig.inputMode = 'tap';
    startMatch(link);
    clearInterval(timerInterval);
    const when = ts || tick(0.3, 1.6);
    state.id = Math.round(when);
    state.date = fmtDate(when);
    const lvl = t => (level[names[t * 2]] + level[names[t * 2 + 1]]) / 2;
    const pA = Math.min(0.68, Math.max(0.32, 0.5 + (lvl(0) - lvl(1)) * 0.006 + (rnd() - 0.5) * 0.06));
    let guard = 0;
    while (!state.matchOver && guard++ < 600) {
      state.elapsedSec += 25 + Math.floor(rnd() * 30);
      if (rnd() < 0.09) { handleServeFault(); if (state.matchOver) break; if (state.serveNumber === 1) continue; }
      const winTeam = rnd() < pA ? 0 : 1;
      const r = rnd();
      if (r < 0.46) {
        const idx = winTeam * 2 + (rnd() < 0.5 ? 0 : 1);
        selectedSlot = idx;
        let shot = weighted(WIN_SHOTS);
        if (state.serverIdx === idx && state.serveNumber === 1 && rnd() < 0.08) shot = 'Saque Directo';
        let z = SHOT_DEFAULT_ZONE[shot];
        if (rnd() < 0.2) z = otherZone(z);
        recordAction('W', shot, { z, l: sideToLane(state.players[idx].side) });
      } else {
        const lose = 1 - winTeam;
        const idx = lose * 2 + (rnd() < 0.5 ? 0 : 1);
        selectedSlot = idx;
        const forced = r > 0.84;
        const shot = forced ? 'Defensa' : weighted(ENF_SHOTS);
        let z = SHOT_DEFAULT_ZONE[shot];
        if (rnd() < 0.25) z = otherZone(z);
        recordAction(forced ? 'EF' : 'ENF', shot, { z, l: sideToLane(state.players[idx].side) });
      }
    }
    if (!state.matchOver) finishMatchManually();
    saveMatchToHistory(false);
    const snap = state;
    state = null;
    localStorage.removeItem('pm_partido_activo_v14');
    return snap;
  }

  const shuffled = arr => shuffleArray(arr);
  const quad = pool => shuffled(pool).slice(0, 4);
  const mixedQuad = () => { const m = shuffled(men).slice(0, 2), w = shuffled(women).slice(0, 2); return [m[0], w[0], m[1], w[1]]; };

  // ---------- Partidos sueltos: masculinos, femeninos y mixtos ----------
  for (let i = 0; i < 14; i++) simulateMatch(quad(men.slice(0, 12 + (i % 4))));
  for (let i = 0; i < 12; i++) simulateMatch(quad(women.slice(0, 12 + (i % 4))));
  for (let i = 0; i < 8; i++) simulateMatch(mixedQuad());

  // ---------- Torneos ----------
  function playTournament(t, maxMatches = Infinity) {
    let played = 0, m;
    while (played < maxMatches && (m = t.matches.find(x => x.a && x.b && !x.winner))) {
      const names = [...teamById(t, m.a).players, ...teamById(t, m.b).players];
      simulateMatch(names, { deuceRule: t.rules.deuceRule, thirdSetRule: t.rules.thirdSetRule, link: { kind: 'tournament', tid: t.id, mid: m.id }, ts: tick(0.02, 0.15) });
      played++;
      if (t.format === 'groups' && !t.koBuilt && groupsFinished(t)) buildFinalStage(t.id);
    }
  }
  function makeTournament(name, format, pairs, seeding = 'elo', rules = { deuceRule: 'golden', thirdSetRule: 'supertb' }) {
    startTournamentDraft();
    Object.assign(eventDraft, { name, format, seeding, pairs, ...rules });
    createTournamentFromDraft();
    const t = tournaments[0];
    t.createdAt = tick(1, 3);
    return t;
  }
  const pairsOf = (list, n) => { const out = []; for (let i = 0; i < n * 2; i += 2) out.push([list[i], list[i + 1]]); return out; };

  const t1 = makeTournament('Open Masculino de Otoño', 'ko', pairsOf(men.slice(0, 14), 7));
  playTournament(t1);
  for (let i = 0; i < 6; i++) simulateMatch(quad(men));
  const t2 = makeTournament('Copa Femenina por Grupos', 'groups', pairsOf(shuffled(women.slice(0, 12)), 6), 'elo', { deuceRule: 'adv', thirdSetRule: 'normal' });
  playTournament(t2);
  for (let i = 0; i < 4; i++) simulateMatch(mixedQuad());
  const mixedPairs = shuffled(men.slice(0, 5)).map((m, i) => [m, women[i]]);
  const t3 = makeTournament('Liga Mixta del Club', 'league', mixedPairs, 'random', { deuceRule: 'golden', thirdSetRule: 'supertb' });
  playTournament(t3, 6);

  // ---------- Americanos ----------
  function makeAmericano(name, format, players, points, opts = {}) {
    switchMainTab('americano');
    startAmericanoDraft();
    Object.assign(eventDraft, { name, format, players, points, ...opts });
    createAmericanoFromDraft();
    const ev = americanos[0];
    ev.createdAt = tick(1, 4);
    return ev;
  }
  function playAmericano(ev, maxRounds = Infinity) {
    const strength = side => side.reduce((a, n) => a + level[n], 0) / side.length;
    let r = 0;
    while (r < maxRounds) {
      const round = ev.rounds[ev.rounds.length - 1];
      round.matches.forEach((m, mi) => {
        const pA = Math.min(0.75, Math.max(0.25, 0.5 + (strength(m.a) - strength(m.b)) * 0.012 + (rnd() - 0.5) * 0.3));
        let v = Math.round(ev.points * pA);
        if (ev.format === 'pozo' && v * 2 === ev.points) v += rnd() < 0.5 ? 1 : -1;
        saveAmericanoScore(ev.id, ev.rounds.length - 1, mi, v);
      });
      r++;
      if (ev.rounds.length >= ev.totalRounds || ['americano', 'fixed'].includes(ev.format)) {
        if (['americano', 'fixed'].includes(ev.format)) {
          ev.rounds.forEach((rd, ri) => rd.matches.forEach((m, mi) => { if (m.sa === null && r < maxRounds) { /* se rellenan abajo */ } }));
        }
        break;
      }
      nextAmericanoRound(ev.id);
    }
  }
  function fillAllRounds(ev, upto) {
    const strength = side => side.reduce((a, n) => a + level[n], 0) / side.length;
    ev.rounds.slice(0, upto).forEach((rd, ri) => rd.matches.forEach((m, mi) => {
      const pA = Math.min(0.75, Math.max(0.25, 0.5 + (strength(m.a) - strength(m.b)) * 0.012 + (rnd() - 0.5) * 0.3));
      saveAmericanoScore(ev.id, ri, mi, Math.round(ev.points * pA));
    }));
  }

  const a1 = makeAmericano('Americano de los Jueves', 'americano', shuffled(men.slice(0, 8)), 24);
  fillAllRounds(a1, a1.rounds.length);
  for (let i = 0; i < 3; i++) simulateMatch(quad(women));
  const a2 = makeAmericano('Mexicano Mixto Nocturno', 'mixicano', [...men.slice(2, 8), ...women.slice(0, 6)], 21, { rounds: 5 });
  playAmericano(a2, 5);
  const a3 = makeAmericano('Americano por Parejas', 'fixed', pairsOf(shuffled(women.slice(0, 10)), 5).flat(), 16);
  fillAllRounds(a3, a3.rounds.length);
  for (let i = 0; i < 3; i++) simulateMatch(quad(men));
  const a4 = makeAmericano('Pozo del Sábado', 'pozo', [...men.slice(4, 12)], 21, { rounds: 6 });
  playAmericano(a4, 6);
  const a5 = makeAmericano('Mexicano Femenino', 'mexicano', women.slice(0, 8), 24, { rounds: 5 });
  playAmericano(a5, 3);
  const a6 = makeAmericano('Pozo Mixto (en juego)', 'pozo', [...men.slice(0, 4), ...women.slice(4, 8)], 21, { rounds: 6 });
  playAmericano(a6, 2);
  for (let i = 0; i < 2; i++) simulateMatch(mixedQuad(), { ts: tick(0.2, 0.6) });

  tView = { mode: 'list', tid: null, tab: null };
  setupConfig.slots = ['GEN_0', 'GEN_1', 'GEN_2', 'GEN_3'];
  return { app: 'Padel Metric', version: 4, exportedAt: new Date().toISOString(), dbPlayers, dbProfiles, matchHistory, tournaments, americanos };
});
fs.writeFileSync('assets/demo/padel-metric-demo.json', JSON.stringify(payload));
const summary = {
  players: payload.dbPlayers.length, matches: payload.matchHistory.length,
  points: payload.matchHistory.reduce((a, m) => a + m.points.length, 0),
  tournaments: payload.tournaments.map(t => [t.name, t.format, t.status, t.champion && t.teams.find(x => x.id === t.champion).players.join(' / ')]),
  americanos: payload.americanos.map(a => [a.name, a.format, a.status, a.rounds.length + '/' + a.totalRounds]),
  first: payload.matchHistory.at(-1).date, last: payload.matchHistory[0].date
};
console.log(JSON.stringify(summary, null, 1));
console.log('errores:', errs.length ? errs.slice(0, 5) : 'ninguno');
await b.close();
