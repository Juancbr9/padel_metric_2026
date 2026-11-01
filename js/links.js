// ==========================================================
// ENLACES
// - Compartir un partido con un enlace (…/#partido=…): el resultado y las estadísticas van comprimidos dentro
//   del propio enlace, así que no se sube nada a ningún servidor y el enlace no caduca. Quien lo abre ve la
//   ficha del partido sin instalar nada y, si usa Padel Metric, puede guardarlo en su historial.
// - Accesos directos del icono de la app (…/?ir=ranking): abren directamente una sección.
// ==========================================================
const LINK_DEUCE = ['adv', 'golden', 'star'];
const SPARK_ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
let sharedMatch = null, shareSheetLink = null, shareSheetText = '';

function b64urlEncode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

async function pipeBytes(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

// Probabilidad de victoria en un carácter por valor (0-63), como mucho 48 valores
function sparkEncode(m) {
  const vals = [m.wpStart ?? 0.5, ...(m.points || []).filter(p => p.wp !== undefined).map(p => p.wp)];
  if (vals.length < 3) return m.shared && m.shared.spark ? m.shared.spark : '';
  const n = Math.min(48, vals.length);
  let s = '';
  for (let i = 0; i < n; i++) {
    const v = vals[Math.round((i * (vals.length - 1)) / (n - 1))];
    s += SPARK_ABC[Math.max(0, Math.min(63, Math.round(v * 63)))];
  }
  return s;
}

function sparkDecode(s) {
  return [...String(s || '')].map(c => Math.max(0, SPARK_ABC.indexOf(c)) / 63);
}

const flatCounts = obj => Object.entries(obj || {}).filter(([, v]) => v > 0).flat();
const unflatCounts = arr => {
  const out = {};
  for (let i = 0; Array.isArray(arr) && i + 1 < arr.length; i += 2) {
    const n = Math.max(0, Math.round(+arr[i + 1] || 0));
    if (n) out[String(arr[i]).slice(0, 40)] = n;
  }
  return out;
};

function matchPlayedSets(m) {
  return (m.sets || []).filter((s, i) => i <= (m.currentSet ?? 2) && (s[0] || s[1]));
}

// Partido → lista compacta (versión 1)
function matchToShare(m) {
  const label = m.link && m.link.kind === 'tournament' && typeof findTournament === 'function' ? (findTournament(m.link.tid) || {}).name || '' : (m.shared && m.shared.label) || '';
  return [1, m.id || Date.now(), Math.max(0, LINK_DEUCE.indexOf(m.deuceRule)), m.thirdSetRule === 'supertb' ? 1 : 0,
    matchPlayedSets(m), m.matchOver ? m.winnerPair : -1, Math.round(m.elapsedSec || 0),
    m.players.map(p => [p.name, p.isGeneric ? 1 : 0, p.W || 0, p.ENF || 0, p.EF || 0, p.aces || 0, p.df || 0, p.maxStreak || 0, flatCounts(p.shots), flatCounts(p.errShots)]),
    sparkEncode(m), (m.points || []).length || (m.shared && m.shared.n) || 0, label];
}

// Lista compacta → partido con el mismo formato que el historial (sin el registro punto a punto)
function shareToMatch(a) {
  if (!Array.isArray(a) || a[0] !== 1 || !Array.isArray(a[7]) || a[7].length !== 4) throw new Error('Formato no válido');
  const [, id, deuce, third, sets, winner, elapsed, players, spark, nPoints, label] = a;
  const num = v => Math.max(0, Math.min(999, Math.round(+v || 0)));
  const played = (Array.isArray(sets) ? sets : []).slice(0, 3).map(s => [num(s && s[0]), num(s && s[1])]);
  const won = winner === 0 || winner === 1;
  return {
    id: Math.round(+id) || Date.now(),
    date: new Date(Math.round(+id) || Date.now()).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    deuceRule: LINK_DEUCE[deuce] || 'adv',
    thirdSetRule: third ? 'supertb' : 'normal',
    players: players.map((p, i) => ({
      name: String(p[0] || `Jugador ${i + 1}`).slice(0, 60), isGeneric: !!p[1], side: FIXED_COURT_SIDES[i], pair: i < 2 ? 0 : 1,
      W: num(p[2]), ENF: num(p[3]), EF: num(p[4]), aces: num(p[5]), df: num(p[6]), streak: 0, maxStreak: num(p[7]),
      shots: unflatCounts(p[8]), errShots: unflatCounts(p[9])
    })),
    sets: [0, 1, 2].map(i => played[i] || [0, 0]),
    currentSet: Math.max(0, played.length - 1),
    pts: [0, 0],
    matchOver: won,
    winnerPair: won ? winner : null,
    elapsedSec: Math.max(0, Math.min(36000, Math.round(+elapsed || 0))),
    savedToHistory: true,
    shared: { spark: String(spark || '').slice(0, 64), n: num(nPoints), label: String(label || '').slice(0, 80) }
  };
}

async function matchShareCode(m) {
  const json = new TextEncoder().encode(JSON.stringify(matchToShare(m)));
  let code = 'j' + b64urlEncode(json);
  try {
    if (window.CompressionStream) {
      const z = 'z' + b64urlEncode(await pipeBytes(json, new CompressionStream('deflate-raw')));
      if (z.length < code.length) code = z;
    }
  } catch (e) {}
  return code;
}

async function decodeMatchCode(code) {
  const bytes = b64urlDecode(code.slice(1));
  let raw;
  if (code[0] === 'z') {
    if (!window.DecompressionStream) throw new Error('Actualiza el navegador para abrir este enlace');
    raw = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
  } else if (code[0] === 'j') raw = bytes;
  else throw new Error('Formato no válido');
  return shareToMatch(JSON.parse(new TextDecoder().decode(raw)));
}

function matchShareText(m) {
  const sets = matchPlayedSets(m).map(s => `${s[0]}-${s[1]}`).join(' ');
  if (!m.matchOver) return `${livePairName(0, m)} contra ${livePairName(1, m)}, ${sets || '0-0'}. Resultado y estadísticas en Padel Metric:`;
  const w = m.winnerPair;
  const score = matchPlayedSets(m).map(s => `${s[w]}-${s[1 - w]}`).join(' ');
  return `${livePairName(w, m)} ganan a ${livePairName(1 - w, m)} ${score}. Resultado y estadísticas en Padel Metric:`;
}

// ---------- Hoja "Compartir partido" ----------
async function openShareMatchSheet(m) {
  m = m || state;
  if (!m || !m.players) return;
  posterTargetState = m;
  shareSheetLink = null;
  shareSheetText = matchShareText(m);
  vibrate(10);
  openEventModal(`
    <div class="mo-title">Compartir partido</div>
    <p class="bc-intro">Envía el resultado y las estadísticas con un enlace. Se abre en cualquier móvil sin instalar nada y quien use Padel Metric puede guardarlo en su historial. Los datos viajan dentro del propio enlace.</p>
    <div class="bc-qr" id="share-qr"><div class="share-qr-wait">Preparando enlace…</div></div>
    <div class="bc-actions">
      <button class="btn-volt" id="share-send" onclick="sendMatchLink()" disabled><svg class="icon"><use href="#i-share"/></svg> Enviar enlace</button>
      <button class="btn-icon" onclick="copyMatchLink()"><svg class="icon"><use href="#i-copy"/></svg> Copiar enlace</button>
      <button class="btn-icon" onclick="closeEventModal(); closeMatchEnd(); openPosterModal()"><svg class="icon"><use href="#i-camera"/></svg> Póster</button>
    </div>`);
  try {
    shareSheetLink = `${appPublicUrl()}#partido=${await matchShareCode(m)}`;
    const qr = document.getElementById('share-qr');
    if (qr) qr.innerHTML = QR.svg(shareSheetLink, 2);
  } catch (e) {
    const qr = document.getElementById('share-qr');
    if (qr) qr.innerHTML = '<div class="share-qr-wait">No se ha podido crear el código</div>';
  }
  const btn = document.getElementById('share-send');
  if (btn) btn.disabled = !shareSheetLink;
}

async function sendMatchLink() {
  if (!shareSheetLink) return;
  try {
    if (navigator.share) await navigator.share({ title: 'Padel Metric · Resultado', text: shareSheetText, url: shareSheetLink });
    else { await navigator.clipboard.writeText(`${shareSheetText} ${shareSheetLink}`); showToast('Enlace copiado'); }
  } catch (e) {}
}

async function copyMatchLink() {
  if (!shareSheetLink) return;
  try { await navigator.clipboard.writeText(shareSheetLink); showToast('Enlace copiado'); } catch (e) { showToast('No se pudo copiar'); }
}

// ---------- Ficha pública del partido ----------
async function handleMatchHash() {
  const hit = /^#partido=([jz][A-Za-z0-9_-]{8,})$/.exec(location.hash);
  if (!hit) return false;
  clearInterval(spectatorTimer);
  spectatorTimer = null;
  document.body.classList.add('spectator-mode');
  document.getElementById('view-spectator').classList.remove('hidden');
  const box = document.getElementById('view-spectator');
  box.innerHTML = `${spectatorHeadHTML()}<div class="spx-empty">Abriendo el partido…</div>`;
  try {
    sharedMatch = await decodeMatchCode(hit[1]);
    shareSheetLink = location.href;
    shareSheetText = matchShareText(sharedMatch);
    renderSharedMatch();
  } catch (e) {
    sharedMatch = null;
    const update = /^Actualiza/.test(e.message || '');
    box.innerHTML = `${spectatorHeadHTML()}<div class="spx-empty">${update ? escapeHtml(e.message) : 'Este enlace no es válido o está incompleto. Pide que te lo vuelvan a enviar.'}</div>`;
  }
  return true;
}

function sharedMatchSaved() {
  return !!sharedMatch && matchHistory.some(x => x && String(x.id) === String(sharedMatch.id));
}

function renderSharedMatch() {
  const m = sharedMatch;
  const box = document.getElementById('view-spectator');
  if (!m || !box) return;
  const w = m.winnerPair;
  const sets = matchPlayedSets(m);
  const mvp = [...m.players].sort((a, b) => calcPlayerRating(b) - calcPlayerRating(a))[0];
  const full = t => `${m.players[t * 2].name} / ${m.players[t * 2 + 1].name}`;
  const row = t => `
    <div class="spx-row ${t ? 'b' : 'a'} ${m.matchOver ? (w === t ? 'winner' : 'loser') : ''}">
      <span class="spx-serve"></span>
      <span class="spx-names"><strong>${escapeHtml(livePairName(t, m))}</strong><small>${escapeHtml(full(t))}</small></span>
      <span class="spx-sets">${sets.map(s => `<span class="spx-set ${s[t] > s[1 - t] ? 'won' : ''}">${s[t]}</span>`).join('')}</span>
      <span class="spx-pts">${m.matchOver && w === t ? '<svg class="icon"><use href="#i-trophy"/></svg>' : ''}</span>
    </div>`;
  const spark = sparkDecode(m.shared && m.shared.spark);
  const when = new Date(m.id).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const saved = sharedMatchSaved();
  box.innerHTML = `${spectatorHeadHTML()}
    <div class="spx-board">
      <div class="spx-status sb-status ${m.matchOver ? 'is-over' : ''}">
        <span class="spx-badge ${m.matchOver ? 'over' : 'off'}">${m.matchOver ? 'Final' : 'Parcial'}</span>
        <span class="spx-status-txt">${escapeHtml(m.shared.label || 'Resultado del partido')}</span>
        <span class="spx-time">${escapeHtml(new Date(m.id).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}</span>
      </div>
      ${row(0)}${row(1)}
      ${spark.length > 2 ? `${spxSparkSVG(spark)}<div class="spx-wp-label">Probabilidad de victoria, punto a punto</div>` : ''}
    </div>
    <div class="sm-facts">
      <div><strong>${formatMatchDuration(m.elapsedSec)}</strong><span>Duración</span></div>
      <div><strong>${m.shared.n || '–'}</strong><span>Puntos</span></div>
      <div><strong>${escapeHtml(liveSurname(mvp))}</strong><span>Mejor · ${calcPlayerRating(mvp).toFixed(1)}</span></div>
    </div>
    <div class="spx-players">${m.players.map((p, i) => `<div class="spx-player ${i < 2 ? 'a' : 'b'} ${p === mvp ? 'srv' : ''}">
      <strong>${escapeHtml(liveSurname(p))}</strong><span>W ${p.W} · ENF ${p.ENF} · EF ${p.EF}</span><em>${calcPlayerRating(p).toFixed(1)}</em></div>`).join('')}</div>
    <div class="sm-actions">
      <button class="btn-volt" onclick="saveSharedMatch()" ${saved ? 'disabled' : ''}><svg class="icon"><use href="#${saved ? 'i-trophy' : 'i-save'}"/></svg> ${saved ? 'Ya está en tu historial' : 'Guardar en mi historial'}</button>
      <button class="btn-icon" onclick="sendMatchLink()"><svg class="icon"><use href="#i-share"/></svg> Reenviar</button>
    </div>
    <div class="spx-foot">${escapeHtml(when.charAt(0).toUpperCase() + when.slice(1))} · Padel Metric</div>`;
}

function saveSharedMatch() {
  const m = sharedMatch;
  if (!m) return;
  if (sharedMatchSaved()) { showToast('Este partido ya está en tu historial'); return; }
  m.players.forEach(p => { if (!p.isGeneric) ensurePlayerInDB(p.name); });
  if (typeof syncMeta !== 'undefined' && syncMeta.deleted.matches[String(m.id)]) { delete syncMeta.deleted.matches[String(m.id)]; saveSyncMeta(); }
  matchHistory.push(JSON.parse(JSON.stringify(m)));
  matchHistory.sort((a, b) => (b.id || 0) - (a.id || 0));
  saveDB();
  vibrate([10, 30]);
  showToast('Partido guardado en tu historial');
  renderSharedMatch();
}

// ---------- Accesos directos (…/?ir=seccion) ----------
function handleStartParam() {
  const params = new URLSearchParams(location.search);
  const target = params.get('ir');
  if (!target) return;
  params.delete('ir');
  const qs = params.toString();
  history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  if (document.body.classList.contains('spectator-mode') || !SECTIONS[target]) return;
  switchMainTab(target);
}

function initLinks() {
  handleStartParam();
  handleMatchHash();
  window.addEventListener('hashchange', handleMatchHash);
}
