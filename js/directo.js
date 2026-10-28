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
  const base = window.PadelNative ? PadelNative.urlPublica() : `${location.origin}${location.pathname}`;
  return `${base}#directo=${code}`;
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
    <p class="bc-intro">Quien abra este enlace o escanee el código verá el marcador en directo, en el móvil o en una tele. No necesita instalar nada.</p>
    <div class="bc-qr">${QR.svg(link, 2)}</div>
    <div class="bc-link">${escapeHtml(link)}</div>
    <div id="bc-status" class="bc-status"></div>
    <div class="bc-actions">
      <button class="btn-volt" onclick="shareLiveLink()"><svg class="icon"><use href="#i-share"/></svg> Compartir enlace</button>
      <button class="btn-icon" onclick="copyLiveLink()"><svg class="icon"><use href="#i-copy"/></svg> Copiar</button>
      <button class="btn-icon" onclick="window.open(${jsArg(link)}, '_blank')"><svg class="icon"><use href="#i-tv"/></svg> Ver como espectador</button>
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
    renderSpectator({ ...row.data, lagMs: lag });
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

function renderSpectator(d) {
  const box = document.getElementById('view-spectator');
  const head = `<div class="spx-top"><span class="spx-brand"><svg><use href="#logo-mark"/></svg>PADEL METRIC</span>
    <button class="btn-icon" onclick="leaveSpectator()">Abrir la app</button></div>`;
  if (!d || d.missing || d.error) {
    box.innerHTML = `${head}<div class="spx-empty">${!d ? 'Conectando con el directo…' : d.missing ? 'Este directo no existe o ya ha caducado.' : `No se puede conectar: ${escapeHtml(d.error)}`}</div>`;
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
  const sp = d.spark || [];
  const W = 600, H = 60, mid = H / 2;
  const line = sp.map((v, i) => `${i ? 'L' : 'M'}${(sp.length > 1 ? i / (sp.length - 1) : 0) * W} ${(mid - (v - 0.5) * 2 * (mid - 3)).toFixed(1)}`).join('');
  const spark = sp.length > 1 ? `<svg class="spx-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><clipPath id="spx-t"><rect width="${W}" height="${mid}"/></clipPath><clipPath id="spx-b"><rect y="${mid}" width="${W}" height="${mid}"/></clipPath></defs>
    <line x1="0" y1="${mid}" x2="${W}" y2="${mid}" class="sb-spark-mid"/>
    <path d="${line}L${W} ${mid}L0 ${mid}Z" clip-path="url(#spx-t)" class="sb-spark-a"/><path d="${line}L${W} ${mid}L0 ${mid}Z" clip-path="url(#spx-b)" class="sb-spark-b"/>
    <path d="${line}" class="sb-spark-line"/></svg>` : '';
  box.innerHTML = `${head}
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
