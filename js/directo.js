// ==========================================================
// DIRECTO PARA ESPECTADORES
// El móvil que anota publica el marcador en Supabase (tabla pm_live) y cualquiera con el enlace o el QR
// lo sigue en su móvil o en una tele (…/#directo=CÓDIGO). Solo publica quien tiene la clave secreta.
// ==========================================================
const LIVE_CFG = { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_KEY };
const LIVE_HEARTBEAT_MS = 30000;
let livePublishTimer = null, liveHeartbeat = null, livePublishing = false, liveLastError = '';

function liveRandom(len) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map(b => abc[b % abc.length]).join('');
}

function liveLink(code) {
  return `${appPublicUrl()}#directo=${code}`;
}

// Lo que ven los espectadores (sin fotos ni datos personales: nombres, marcador y estadísticas del partido)
function livePayload() {
  const st = liveStatus();
  const ch = liveChance();
  return {
    v: 1,
    on: !!(state.live && state.live.on),
    pairs: [livePairName(0), livePairName(1)],
    full: [0, 1].map(t => `${state.players[t * 2].name} / ${state.players[t * 2 + 1].name}`),
    players: state.players.map(p => ({ n: p.name, s: liveSurname(p), W: p.W, ENF: p.ENF, EF: p.EF, r: Math.round(calcPlayerRating(p) * 10) / 10 })),
    sets: state.sets, cur: state.currentSet, stb: !!state.inSuperTB, tb: !!state.inTieBreak, third: state.thirdSetRule,
    pts: state.matchOver ? ['', ''] : [formatPointLabel(0), formatPointLabel(1)],
    srv: state.matchOver ? null : state.serverIdx, sn: state.serveNumber,
    status: { cls: st.cls, text: st.html.replace(/<[^>]+>/g, ''), pair: ch ? ch.pair : null },
    wp: Math.round((state.wp ?? 0.5) * 1000) / 1000,
    spark: [state.wpStart ?? 0.5, ...(state.points || []).filter(p => p.wp !== undefined).map(p => p.wp)].slice(-160).map(v => Math.round(v * 100) / 100),
    log: (state.gamePointLog || []).slice(-6),
    over: !!state.matchOver, winner: state.winnerPair,
    t: state.elapsedSec, paused: !!state.timerPaused, at: Date.now()
  };
}

async function livePublishNow() {
  if (!state || !state.live || livePublishing) return;
  livePublishing = true;
  try {
    const ok = await syncRpc('pm_live_publish', { p_code: state.live.code, p_secret: state.live.secret, p_data: livePayload() }, LIVE_CFG);
    liveLastError = ok === false ? 'Este código de directo pertenece a otro móvil' : '';
  } catch (e) {
    liveLastError = navigator.onLine === false ? 'Sin conexión: se reintentará solo' : e.message;
  }
  livePublishing = false;
  renderBroadcastStatus();
}

// Se llama en cada cambio del marcador: agrupa los cambios rápidos en un solo envío
function scheduleLivePublish() {
  if (!state || !state.live || !state.live.on) return;
  clearTimeout(livePublishTimer);
  livePublishTimer = setTimeout(livePublishNow, 900);
  if (!liveHeartbeat) liveHeartbeat = setInterval(() => {
    if (state && state.live && state.live.on) livePublishNow();
    else { clearInterval(liveHeartbeat); liveHeartbeat = null; }
  }, LIVE_HEARTBEAT_MS);
}

function openBroadcastPanel() {
  if (!state) return;
  vibrate(10);
  if (!state.live) {
    state.live = { code: liveRandom(10), secret: liveRandom(32), on: true };
    persistActiveMatchState();
    updateUI();
    livePublishNow();
    showToast('Directo iniciado');
  }
  const link = liveLink(state.live.code);
  openEventModal(`
    <div class="mo-title">Directo para espectadores</div>
    <p class="bc-intro">Quien abra el enlace o escanee el código sigue el marcador al momento.</p>
    <div class="bc-qr">${QR.svg(link, 2)}</div>
    <div class="bc-link">${escapeHtml(link)}</div>
    <div id="bc-status" class="bc-status"></div>
    <div class="bc-actions">
      <button class="btn-volt" onclick="shareLiveLink()">Compartir enlace</button>
      <button class="btn-icon" onclick="copyLiveLink()">Copiar</button>
      <button class="btn-icon" onclick="window.open(${jsArg(link)}, '_blank')">Ver como espectador</button>
      <button class="btn-icon bc-toggle" onclick="toggleLiveBroadcast()">${state.live.on ? 'Pausar directo' : 'Reanudar directo'}</button>
    </div>`);
  renderBroadcastStatus();
}

function renderBroadcastStatus() {
  const el = document.getElementById('bc-status');
  if (!el || !state || !state.live) return;
  const cls = !state.live.on ? 'off' : liveLastError ? 'err' : 'ok';
  const txt = !state.live.on ? 'Directo en pausa: los espectadores ven el último marcador'
    : liveLastError ? liveLastError : 'Emitiendo: el marcador se actualiza al momento';
  el.className = `bc-status ${cls}`;
  el.innerHTML = `<span class="live-dot"></span>${escapeHtml(txt)}`;
}

async function shareLiveLink() {
  const url = liveLink(state.live.code);
  const text = `Sigue en directo ${livePairName(0)} contra ${livePairName(1)}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Padel Metric · Directo', text, url });
    else { await navigator.clipboard.writeText(url); showToast('Enlace copiado'); }
  } catch (e) {}
}

async function copyLiveLink() {
  try { await navigator.clipboard.writeText(liveLink(state.live.code)); showToast('Enlace copiado'); } catch (e) { showToast('No se pudo copiar'); }
}

function toggleLiveBroadcast() {
  if (!state || !state.live) return;
  state.live.on = !state.live.on;
  persistActiveMatchState();
  livePublishNow();
  updateUI();
  openBroadcastPanel();
}

// ---------- Vista del espectador ----------
let spectatorTimer = null, spectatorCode = null, spectatorLast = null;

function handleLiveHash() {
  const m = /^#directo=([a-z0-9]{8,40})$/i.exec(location.hash);
  if (!m) return false;
  spectatorCode = m[1];
  document.body.classList.add('spectator-mode');
  document.getElementById('view-spectator').classList.remove('hidden');
  renderSpectator(null);
  pollSpectator();
  clearInterval(spectatorTimer);
  spectatorTimer = setInterval(pollSpectator, 2500);
  return true;
}

async function pollSpectator() {
  if (document.visibilityState === 'hidden') return;
  try {
    const rows = await syncRpc('pm_live_get', { p_code: spectatorCode }, LIVE_CFG);
    const row = rows && rows[0];
    if (!row) { renderSpectator({ missing: true }); return; }
    const lag = new Date(row.server_now) - new Date(row.updated_at);
    // Inscripción abierta: además se lee la lista de apuntados
    const joins = row.data && row.data.kind === 'signup'
      ? await syncRpc('pm_live_joins', { p_code: spectatorCode }, LIVE_CFG).catch(() => null) : null;
    renderSpectator({ ...row.data, joins, lagMs: lag });
  } catch (e) {
    renderSpectator(spectatorLast ? { ...spectatorLast, offline: true } : { error: e.message });
  }
}

function leaveSpectator() {
  clearInterval(spectatorTimer);
  spectatorTimer = null;
  document.body.classList.remove('spectator-mode');
  document.getElementById('view-spectator').classList.add('hidden');
  history.replaceState(null, '', location.pathname + location.search);
  switchMainTab('home');
}

function spectatorHeadHTML() {
  return `<div class="spx-top"><span class="spx-brand"><svg><use href="#logo-mark"/></svg>PADEL METRIC</span>
    <button class="btn-icon" onclick="leaveSpectator()">Abrir la app</button></div>`;
}

// Gráfico de probabilidad de victoria (valores de 0 a 1) para las vistas públicas
function spxSparkSVG(sp) {
  if (!sp || sp.length < 2) return '';
  const W = 600, H = 60, mid = H / 2;
  const line = sp.map((v, i) => `${i ? 'L' : 'M'}${(i / (sp.length - 1)) * W} ${(mid - (v - 0.5) * 2 * (mid - 3)).toFixed(1)}`).join('');
  return `<svg class="spx-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><clipPath id="spx-t"><rect width="${W}" height="${mid}"/></clipPath><clipPath id="spx-b"><rect y="${mid}" width="${W}" height="${mid}"/></clipPath></defs>
    <line x1="0" y1="${mid}" x2="${W}" y2="${mid}" class="sb-spark-mid"/>
    <path d="${line}L${W} ${mid}L0 ${mid}Z" clip-path="url(#spx-t)" class="sb-spark-a"/><path d="${line}L${W} ${mid}L0 ${mid}Z" clip-path="url(#spx-b)" class="sb-spark-b"/>
    <path d="${line}" class="sb-spark-line"/></svg>`;
}

let spxAlertPrev = '';
function renderSpectator(d) {
  document.getElementById('view-spectator')?.classList.remove('spx-match');
  if (d && d.kind === 'ev') { renderEventSpectator(d); return; }
  if (d && d.kind === 'signup') { renderSignupSpectator(d); return; }
  const box = document.getElementById('view-spectator');
  const head = spectatorHeadHTML();
  if (!d || d.missing || d.error) {
    box.innerHTML = `${head}${!d ? pmLoaderHTML('Conectando con el directo…') : `<div class="spx-empty">${d.missing ? 'Este directo no existe o ya ha caducado.' : `No se puede conectar: ${escapeHtml(d.error)}`}</div>`}`;
    return;
  }
  spectatorLast = d;
  const stale = d.lagMs > 90000 && !d.over;
  const mm = String(Math.floor((d.t || 0) / 60)).padStart(2, '0'), ss = String((d.t || 0) % 60).padStart(2, '0');
  const badge = d.over ? '<span class="spx-badge over">Final</span>'
    : !d.on || stale || d.offline ? '<span class="spx-badge off">Sin señal</span>'
    : '<span class="spx-badge"><span class="live-dot"></span>En directo</span>';
  const srvPair = d.srv == null ? null : d.srv < 2 ? 0 : 1;
  const row = t => {
    const setsHtml = d.sets.map((s, i) => {
      if (i > d.cur || (i === 2 && d.stb && !d.over)) return '';
      const won = (i < d.cur || d.over) && s[t] > s[1 - t];
      return `<span class="spx-set ${won ? 'won' : ''} ${i === d.cur && !d.over ? 'cur' : ''}">${s[t]}</span>`;
    }).join('');
    return `<div class="spx-row ${t ? 'b' : 'a'} ${d.over ? (d.winner === t ? 'winner' : 'loser') : ''}">
      <span class="spx-serve ${srvPair === t ? 'on' : ''}"></span>
      <span class="spx-names"><strong>${escapeHtml(d.pairs[t])}</strong><small>${escapeHtml(d.full[t])}</small></span>
      <span class="spx-sets">${setsHtml}</span>
      <span class="spx-pts">${d.over ? (d.winner === t ? '<svg class="icon"><use href="#i-trophy"/></svg>' : '') : escapeHtml(d.pts[t])}</span>
    </div>`;
  };
  const pa = Math.round(d.wp * 100);
  const spark = spxSparkSVG(d.spark || []);
  // Aviso grande de bola de break, de set, de partido o punto de oro (en la tele); solo se anima cuando cambia
  const alertTxt = !d.over && d.status && d.status.pair != null ? `${d.status.text.split('·').pop().trim()} · ${d.pairs[d.status.pair]}` : '';
  const alertNew = alertTxt && alertTxt !== spxAlertPrev;
  spxAlertPrev = alertTxt;
  box.classList.add('spx-match');
  box.innerHTML = `${head}
    <div class="spx-alert ${alertTxt ? `on ${d.status.pair ? 'b' : 'a'}` : ''} ${alertNew ? 'enter' : ''}">${escapeHtml(alertTxt)}</div>
    <div class="spx-board">
      <div class="spx-status sb-status ${d.over ? 'is-over' : d.status.cls}">${badge}<span class="spx-status-txt">${escapeHtml(d.status.text)}</span><span class="spx-time">${mm}:${ss}</span></div>
      ${row(0)}${row(1)}
      <div class="spx-wp"><span class="sb-wp-val a">${pa}%</span><div class="sb-wp-track"><i class="a" style="flex-basis:${d.wp * 100}%"></i><i class="b"></i></div><span class="sb-wp-val b">${100 - pa}%</span></div>
      ${spark}
      <div class="spx-wp-label">Probabilidad de victoria</div>
    </div>
    ${d.log && d.log.length ? `<div class="spx-log">${d.log.map(x => `<span>${escapeHtml(x)}</span>`).join('')}</div>` : ''}
    <div class="spx-players">${d.players.map((p, i) => `<div class="spx-player ${i < 2 ? 'a' : 'b'} ${d.srv === i ? 'srv' : ''}">
      <strong>${escapeHtml(p.s)}</strong><span>W ${p.W} · ENF ${p.ENF} · EF ${p.EF}</span><em>${p.r.toFixed(1)}</em></div>`).join('')}</div>
    <div class="spx-foot">${d.offline ? 'Sin conexión: mostrando el último marcador recibido' : stale ? 'El marcador lleva un rato sin actualizarse' : 'Se actualiza solo cada pocos segundos'}</div>`;
}

function initLiveSpectator() {
  handleLiveHash();
  window.addEventListener('hashchange', handleLiveHash);
}

// ==========================================================
// CLASIFICACIÓN EN DIRECTO (americanos, mexicanos, pozo y torneos)
// Usa la misma tabla pm_live que el marcador: el evento guarda su código y su clave en ev.live
// y se vuelve a publicar cada vez que se guarda un resultado (saveDB → scheduleEventLivePublish).
// ==========================================================
let eventLiveTimer = null, eventLiveError = '', eventBroadcastOpen = null;
const eventLiveSent = {};

function findLiveEvent(kind, id) {
  return kind === 'a' ? findAmericano(id) : findTournament(id);
}

const signedNum = n => (n > 0 ? `+${n}` : String(n));

function tMatchLive(t, m) {
  const side = id => (id ? teamName(t, id) : m.bye ? 'Exento' : 'Por decidir');
  const c = m.stage === 'ko' ? '' : m.stage === 'group' ? `${m.group} · J${m.round + 1}` : `Jornada ${m.round + 1}`;
  return { c, a: side(m.a), b: side(m.b),
    sets: (m.sets || []).map(s => `${s[0]}-${s[1]}`).join(' '), w: m.winner ? (m.winner === m.a ? 0 : 1) : null };
}

function eventLivePayload(kind, ev) {
  const base = { v: 1, kind: 'ev', name: ev.name, on: !!(ev.live && ev.live.on), over: ev.status === 'finished', at: Date.now() };
  if (kind === 'a') {
    const unit = scoreUnit(ev) === 'puntos' ? 'Pts' : 'Juegos';
    const pozo = ev.format === 'pozo';
    const done = ev.rounds.filter(roundComplete).length;
    const open = ev.rounds.findIndex(r => !roundComplete(r));
    const shown = open >= 0 ? open : ev.rounds.length - 1;
    const r = ev.rounds[shown];
    return { ...base,
      fmt: AMERICANO_FORMATS[ev.format].main,
      sub: `${ev.players.length} jugadores · ${ev.courts} pista${ev.courts > 1 ? 's' : ''} · ${matchTypeLabel(matchTypeOf(ev))}`,
      prog: ev.totalRounds ? done / ev.totalRounds : 0,
      progText: base.over ? 'Clasificación final' : `Ronda ${Math.min(done + 1, ev.totalRounds)} de ${ev.totalRounds}`,
      champion: base.over ? (americanoStandings(ev)[0] || { members: [] }).members.join(' / ') : '', champLabel: 'Primer puesto',
      games: r && !base.over ? { title: `Ronda ${shown + 1} · ${open >= 0 ? 'en juego' : 'resultados'}`, note: r.rest && r.rest.length ? `Descansa${r.rest.length > 1 ? 'n' : ''}: ${r.rest.map(shortName).join(', ')}` : '',
        list: r.matches.map(m => ({ c: `P${m.court}`, a: pairLabel(m.a), b: pairLabel(m.b), sets: m.sa === null ? '' : `${m.sa}-${m.sb}`, w: m.sa === null || m.sa === m.sb ? null : m.sa > m.sb ? 0 : 1 })) } : null,
      tables: [{ title: 'Clasificación', top: 3, cols: [...(pozo ? ['Pista'] : []), 'PJ', 'G', 'Dif', unit],
        rows: americanoStandings(ev).slice(0, 40).map(x => [x.members.map(shortName).join(' / '), ...(pozo ? [x.court || '–'] : []), x.pj, x.w, signedNum(x.diff), x.pts]) }],
      ko: [] };
  }
  const t = ev;
  const played = t.matches.filter(m => m.winner && !m.bye).length;
  const total = t.matches.filter(m => !m.bye).length;
  const cols = ['PJ', 'PG', 'Sets', 'Pts'];
  const rowsOf = list => list.map(r => [teamName(t, r.id), r.pj, r.pg, signedNum(r.setDiff), r.pts]);
  const tables = [];
  if (t.format === 'league') tables.push({ title: 'Clasificación', top: 3, cols, rows: rowsOf(tournamentStandings(t, t.matches, t.teams.map(x => x.id))) });
  if (t.format === 'groups') t.groups.forEach(g => tables.push({ title: `Grupo ${g.name}`, top: 2, cols, rows: rowsOf(tournamentStandings(t, t.matches.filter(m => m.group === g.name), g.teamIds)) }));
  const ko = [];
  if (t.format === 'ko' || t.koBuilt) {
    for (let r = 0; r < t.koRounds; r++) {
      const ms = t.matches.filter(m => m.stage === 'ko' && m.round === r && !m.bye);
      if (ms.length) ko.push({ title: koRoundName(t.koRounds, r), list: ms.map(m => tMatchLive(t, m)) });
    }
  }
  const pending = t.matches.filter(m => !m.bye && !m.winner && m.a && m.b && m.stage !== 'ko');
  return { ...base,
    fmt: TOURNAMENT_FORMATS[t.format].main, sub: `${t.teams.length} parejas`,
    prog: total ? played / total : 0, progText: `${played} de ${total} partidos`,
    champion: t.champion ? teamById(t, t.champion).players.join(' / ') : '',
    games: pending.length ? { title: 'Próximos partidos', note: '', list: pending.slice(0, 8).map(m => tMatchLive(t, m)) } : null,
    tables, ko };
}

async function publishEventLive(kind, ev, force = false) {
  if (!ev || !ev.live) return;
  const data = eventLivePayload(kind, ev);
  const sig = JSON.stringify({ ...data, at: 0 });
  if (!force && eventLiveSent[ev.live.code] === sig) return;
  try {
    const ok = await syncRpc('pm_live_publish', { p_code: ev.live.code, p_secret: ev.live.secret, p_data: data }, LIVE_CFG);
    eventLiveError = ok === false ? 'Este código de directo pertenece a otro móvil' : '';
    if (ok !== false) eventLiveSent[ev.live.code] = sig;
  } catch (e) {
    eventLiveError = navigator.onLine === false ? 'Sin conexión: se reintentará solo' : e.message;
  }
  renderEventBroadcastStatus();
}

async function publishEventLives(force = false) {
  for (const t of tournaments) if (t.live && t.live.on) await publishEventLive('t', t, force);
  for (const a of americanos) if (a.live && a.live.on) await publishEventLive('a', a, force);
}

// Se llama desde saveDB(): agrupa los cambios rápidos en un solo envío
function scheduleEventLivePublish() {
  if (!tournaments.some(t => t.live && t.live.on) && !americanos.some(a => a.live && a.live.on)) return;
  clearTimeout(eventLiveTimer);
  eventLiveTimer = setTimeout(() => publishEventLives(false), 900);
}

function refreshEventView(kind) {
  if (kind === 'a' && currentTab === 'americano') renderAmericanoView();
  if (kind === 't' && currentTab === 'tournaments') renderTournamentsView();
}

function eventLiveButtonHTML(kind, ev) {
  const on = ev.live && ev.live.on;
  return `<button class="btn-icon ${on ? 'is-live' : ''}" onclick="openEventBroadcast('${kind}', ${jsArg(ev.id)})">${on ? '<span class="live-dot"></span> En directo' : 'Emitir en directo'}</button>`;
}

function openEventBroadcast(kind, id) {
  const ev = findLiveEvent(kind, id);
  if (!ev) return;
  vibrate(10);
  if (!ev.live) {
    ev.live = { code: liveRandom(10), secret: liveRandom(32), on: true };
    saveDB();
    publishEventLive(kind, ev, true);
    refreshEventView(kind);
    showToast('Clasificación en directo');
  }
  eventBroadcastOpen = { kind, id };
  const link = liveLink(ev.live.code);
  openEventModal(`
    <div class="mo-title">Clasificación en directo</div>
    <p class="bc-intro">Quien abra el enlace o escanee el código sigue la clasificación al momento.</p>
    <div class="bc-qr">${QR.svg(link, 2)}</div>
    <div class="bc-link">${escapeHtml(link)}</div>
    <div id="ev-bc-status" class="bc-status"></div>
    <div class="bc-actions">
      <button class="btn-volt" onclick="shareEventLiveLink()">Compartir enlace</button>
      <button class="btn-icon" onclick="copyEventLiveLink()">Copiar</button>
      <button class="btn-icon" onclick="window.open(${jsArg(link)}, '_blank')">Ver como espectador</button>
      <button class="btn-icon bc-toggle" onclick="toggleEventBroadcast()">${ev.live.on ? 'Pausar directo' : 'Reanudar directo'}</button>
    </div>`);
  renderEventBroadcastStatus();
}

function openEventBroadcastTarget() {
  return eventBroadcastOpen ? findLiveEvent(eventBroadcastOpen.kind, eventBroadcastOpen.id) : null;
}

function renderEventBroadcastStatus() {
  const el = document.getElementById('ev-bc-status');
  const ev = openEventBroadcastTarget();
  if (!el || !ev || !ev.live) return;
  const cls = !ev.live.on ? 'off' : eventLiveError ? 'err' : 'ok';
  const txt = !ev.live.on ? 'Directo en pausa: se ve la última clasificación enviada'
    : eventLiveError || 'Emitiendo: se actualiza con cada resultado';
  el.className = `bc-status ${cls}`;
  el.innerHTML = `<span class="live-dot"></span>${escapeHtml(txt)}`;
}

async function shareEventLiveLink() {
  const ev = openEventBroadcastTarget();
  if (!ev || !ev.live) return;
  const url = liveLink(ev.live.code);
  try {
    if (navigator.share) await navigator.share({ title: 'Padel Metric · Clasificación en directo', text: `Sigue en directo la clasificación de ${ev.name}`, url });
    else { await navigator.clipboard.writeText(url); showToast('Enlace copiado'); }
  } catch (e) {}
}

async function copyEventLiveLink() {
  const ev = openEventBroadcastTarget();
  if (!ev || !ev.live) return;
  try { await navigator.clipboard.writeText(liveLink(ev.live.code)); showToast('Enlace copiado'); } catch (e) { showToast('No se pudo copiar'); }
}

function toggleEventBroadcast() {
  const ev = openEventBroadcastTarget();
  if (!ev || !ev.live) return;
  ev.live.on = !ev.live.on;
  saveDB();
  publishEventLive(eventBroadcastOpen.kind, ev, true);
  refreshEventView(eventBroadcastOpen.kind);
  openEventBroadcast(eventBroadcastOpen.kind, ev.id);
}

// ---------- Vista del espectador de un evento ----------
function eventGameHTML(g) {
  return `<div class="spe-game">
    ${g.c ? `<span class="spe-court">${escapeHtml(g.c)}</span>` : ''}
    <span class="spe-side ${g.w === 0 ? 'won' : ''}">${escapeHtml(g.a)}</span>
    <span class="spe-score">${g.sets ? escapeHtml(g.sets) : '<em>–</em>'}</span>
    <span class="spe-side right ${g.w === 1 ? 'won' : ''}">${escapeHtml(g.b)}</span>
  </div>`;
}

function renderEventSpectator(d) {
  const box = document.getElementById('view-spectator');
  spectatorLast = d;
  const ago = Math.max(0, Math.round((d.lagMs || 0) / 60000));
  const badge = d.over ? '<span class="spx-badge over">Final</span>'
    : !d.on || d.offline ? '<span class="spx-badge off">En pausa</span>'
    : '<span class="spx-badge"><span class="live-dot"></span>En directo</span>';
  const table = tb => `<div class="spe-card">
    <div class="spe-card-title">${escapeHtml(tb.title)}</div>
    <table class="spe-table"><thead><tr><th>#</th><th class="spe-name"></th>${tb.cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
    <tbody>${tb.rows.map((r, i) => `<tr class="${i < tb.top && (d.prog > 0 || d.over) ? 'top' : ''}"><td class="spe-pos">${i + 1}</td><td class="spe-name">${escapeHtml(r[0])}</td>${r.slice(1).map((c, ci) => `<td class="${ci === r.length - 2 ? 'spe-pts' : ''}">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
  </div>`;
  box.innerHTML = `${spectatorHeadHTML()}
    <div class="spx-board spe-hero">
      <div class="spx-status sb-status ${d.over ? 'is-over' : ''}">${badge}<span class="spx-status-txt">${escapeHtml(d.fmt)}</span><span class="spx-time">${escapeHtml(d.progText)}</span></div>
      <div class="spe-head">
        <div class="spe-title">${escapeHtml(d.name)}</div>
        <div class="spe-sub">${escapeHtml(d.sub)}</div>
        <div class="spe-progress"><i style="width:${Math.round((d.prog || 0) * 100)}%"></i></div>
      </div>
      ${d.champion ? `<div class="spe-champ"><svg class="icon"><use href="#i-trophy"/></svg><div><small>${escapeHtml(d.champLabel || 'Campeones')}</small><strong>${escapeHtml(d.champion)}</strong></div></div>` : ''}
    </div>
    ${d.games ? `<div class="spe-card"><div class="spe-card-title">${escapeHtml(d.games.title)}${d.games.note ? `<small>${escapeHtml(d.games.note)}</small>` : ''}</div>${d.games.list.map(eventGameHTML).join('')}</div>` : ''}
    ${(d.tables || []).map(table).join('')}
    ${(d.ko || []).length ? `<div class="spe-card"><div class="spe-card-title">Cuadro</div>${d.ko.slice().reverse().map(r => `<div class="spe-round">${escapeHtml(r.title)}</div>${r.list.map(eventGameHTML).join('')}`).join('')}</div>` : ''}
    <div class="spx-foot">${d.offline ? 'Sin conexión: mostrando la última clasificación recibida' : `Actualizado ${ago < 1 ? 'hace un momento' : `hace ${ago} min`} · se actualiza solo`}</div>`;
}
