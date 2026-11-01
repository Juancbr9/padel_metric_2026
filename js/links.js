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
  return encodeShareCode(matchToShare(m));
}

// Lista compacta → texto para el enlace: comprimida (prefijo z) o tal cual (prefijo j), lo que sea más corto
async function encodeShareCode(arr) {
  const json = new TextEncoder().encode(JSON.stringify(arr));
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
  return shareToMatch(await decodeShareCode(code));
}

async function decodeShareCode(code) {
  const bytes = b64urlDecode(code.slice(1));
  let raw;
  if (code[0] === 'z') {
    if (!window.DecompressionStream) throw new Error('Actualiza el navegador para abrir este enlace');
    raw = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
  } else if (code[0] === 'j') raw = bytes;
  else throw new Error('Formato no válido');
  return JSON.parse(new TextDecoder().decode(raw));
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
      <button class="btn-volt" id="share-send" onclick="sendMatchLink()" disabled>Enviar enlace</button>
      <button class="btn-icon" onclick="copyMatchLink()">Copiar enlace</button>
      <button class="btn-icon" onclick="closeEventModal(); closeMatchEnd(); openPosterModal()">Póster</button>
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
      <div class="spx-status sb-status">
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
      <button class="btn-volt" onclick="saveSharedMatch()" ${saved ? 'disabled' : ''}>${saved ? 'Ya está en tu historial' : 'Guardar en mi historial'}</button>
      <button class="btn-icon" onclick="sendMatchLink()">Reenviar</button>
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

// ---------- Perfil público de un jugador (#jugador=…) ----------
const PLAYER_SHOT_KEYS = [['Volea', 'Volea'], ['Bandeja/Víbora', 'Bandeja / víbora'], ['Remate', 'Remate'], ['Fondo/Bajada', 'Fondo / bajada'],
  ['Globo', 'Globo'], ['Dejada', 'Dejada'], ['Chiquita', 'Chiquita'], ['Resto', 'Resto'], ['Saque Directo', 'Saque directo']];
let sharedPlayer = null;

// Jugador → lista compacta (versión 1): carta, ELO y su evolución, balance, rachas, pareja, rival, títulos y golpes
function playerToShare(name) {
  const { statsMap } = computeAllPlayersStats();
  const st = statsMap[name] || emptyPlayerStats(name);
  const card = computePlayerCard(name, statsMap);
  const d = computePlayerDetail(name);
  const prof = ensureProfile(name);
  const ranked = Object.values(statsMap).filter(s => s.PJ > 0).sort((a, b) => b.elo - a.elo);
  const pos = ranked.findIndex(s => s.name === name) + 1;
  const partner = Object.values(d.partners).filter(x => x.pj >= 1).sort((a, b) => (b.v / b.pj) - (a.v / a.pj) || b.pj - a.pj)[0];
  const rival = Object.values(d.rivals).filter(x => x.pj - x.v > 0).sort((a, b) => (b.pj - b.v) - (a.pj - a.v) || (a.v / a.pj) - (b.v / b.pj))[0];
  const shots = PLAYER_SHOT_KEYS.map(([k, label]) => [label, d.shots[k] || 0]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const hist = st.eloHistory || [];
  const step = Math.max(1, Math.ceil(hist.length / 30));
  const eloLine = hist.filter((_, i) => i % step === 0 || i === hist.length - 1).map(v => Math.round(v));
  return [1, name, card.overall, card.tier, CARD_ATTRS.map(([k]) => card.attrs[k]), card.best, st.elo, pos, ranked.length, st.PJ, st.V,
    (st.form || []).map(r => (r === 'W' ? 'W' : 'L')).join(''), [d.setsWon, d.setsLost], [d.gamesWon, d.gamesLost], d.bestStreak,
    partner ? [partner.name, partner.pj, partner.v] : 0, rival ? [rival.name, rival.pj, rival.pj - rival.v] : 0,
    d.titles.slice(0, 3), d.americanoBest ? [d.americanoBest.pos, d.americanoBest.name] : 0, shots, eloLine,
    prof.hand || '', prof.prefSide || '', prof.club || '', Math.round(d.timeSec / 60), Date.now()];
}

function shareToPlayer(a) {
  if (!Array.isArray(a) || a[0] !== 1 || typeof a[1] !== 'string' || !Array.isArray(a[4])) throw new Error('Formato no válido');
  const num = v => Math.max(0, Math.min(99999, Math.round(+v || 0)));
  const str = (v, n = 60) => String(v || '').slice(0, n);
  const trio = v => (Array.isArray(v) ? [str(v[0]), num(v[1]), num(v[2])] : null);
  const tier = CARD_TIERS.find(([, key]) => key === a[3]) || CARD_TIERS[CARD_TIERS.length - 1];
  const attrs = {};
  CARD_ATTRS.forEach(([k], i) => { attrs[k] = Math.min(99, num(a[4][i])); });
  return {
    name: str(a[1]), overall: Math.min(99, num(a[2])), tier: tier[1], tierLabel: tier[2], attrs,
    best: CARD_ATTRS.some(([k]) => k === a[5]) ? a[5] : 'red', elo: num(a[6]), pos: num(a[7]), of: num(a[8]), PJ: num(a[9]), V: num(a[10]),
    form: String(a[11] || '').replace(/[^WL]/g, '').slice(0, 10).split('').filter(Boolean),
    sets: Array.isArray(a[12]) ? [num(a[12][0]), num(a[12][1])] : [0, 0], games: Array.isArray(a[13]) ? [num(a[13][0]), num(a[13][1])] : [0, 0],
    bestStreak: num(a[14]), partner: trio(a[15]), rival: trio(a[16]),
    titles: (Array.isArray(a[17]) ? a[17] : []).slice(0, 3).map(t => str(t, 80)),
    amBest: Array.isArray(a[18]) ? [num(a[18][0]), str(a[18][1], 80)] : null,
    shots: (Array.isArray(a[19]) ? a[19] : []).slice(0, 3).map(x => [str(x && x[0], 30), num(x && x[1])]),
    eloLine: (Array.isArray(a[20]) ? a[20] : []).slice(0, 40).map(num),
    hand: str(a[21], 20), side: str(a[22], 20), club: str(a[23]), minutes: num(a[24]), at: Math.round(+a[25]) || Date.now()
  };
}

let playerSheetName = null;
async function openSharePlayerSheet(name) {
  if (!name) return;
  playerSheetName = name;
  shareSheetLink = null;
  shareSheetText = `Perfil de ${name} en Padel Metric:`;
  vibrate(10);
  openEventModal(`
    <div class="mo-title">Compartir perfil</div>
    <p class="bc-intro">Un enlace con la carta, el ELO y su evolución, el balance, la mejor pareja, el rival más difícil y los títulos de ${escapeHtml(name)}. Se abre en cualquier móvil sin instalar nada y muestra los datos de hoy.</p>
    <div class="bc-qr" id="share-qr"><div class="share-qr-wait">Preparando enlace…</div></div>
    <div class="bc-actions">
      <button class="btn-volt" id="share-send" onclick="sendMatchLink()" disabled>Enviar enlace</button>
      <button class="btn-icon" onclick="copyMatchLink()">Copiar enlace</button>
      <button class="btn-icon" onclick="closeEventModal(); sharePlayerCard(playerSheetName)">Imagen de la carta</button>
    </div>`);
  try {
    shareSheetLink = `${appPublicUrl()}#jugador=${await encodeShareCode(playerToShare(name))}`;
    const qr = document.getElementById('share-qr');
    if (qr) qr.innerHTML = QR.svg(shareSheetLink, 2);
  } catch (e) {
    const qr = document.getElementById('share-qr');
    if (qr) qr.innerHTML = '<div class="share-qr-wait">No se ha podido crear el código</div>';
  }
  const btn = document.getElementById('share-send');
  if (btn) btn.disabled = !shareSheetLink;
}

async function handlePlayerHash() {
  const hit = /^#jugador=([jz][A-Za-z0-9_-]{8,})$/.exec(location.hash);
  if (!hit) return false;
  clearInterval(spectatorTimer);
  spectatorTimer = null;
  document.body.classList.add('spectator-mode');
  const box = document.getElementById('view-spectator');
  box.classList.remove('hidden');
  box.innerHTML = `${spectatorHeadHTML()}<div class="spx-empty">Abriendo el perfil…</div>`;
  try {
    sharedPlayer = shareToPlayer(await decodeShareCode(hit[1]));
    shareSheetLink = location.href;
    shareSheetText = `Perfil de ${sharedPlayer.name} en Padel Metric:`;
    renderSharedPlayer();
  } catch (e) {
    sharedPlayer = null;
    const update = /^Actualiza/.test(e.message || '');
    box.innerHTML = `${spectatorHeadHTML()}<div class="spx-empty">${update ? escapeHtml(e.message) : 'Este enlace no es válido o está incompleto. Pide que te lo vuelvan a enviar.'}</div>`;
  }
  return true;
}

function sharedEloChartSVG(line) {
  if (!line || line.length < 2) return '';
  const w = 300, h = 70, pad = 6;
  const min = Math.min(...line), max = Math.max(...line), span = Math.max(20, max - min);
  const pts = line.map((v, i) => `${(pad + (i / (line.length - 1)) * (w - pad * 2)).toFixed(1)},${(h - pad - ((v - min) / span) * (h - pad * 2)).toFixed(1)}`);
  return `<svg class="sp-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="Evolución del ELO">
    <line x1="0" y1="${h - pad}" x2="${w}" y2="${h - pad}"/><path d="M${pts.join(' L')}"/></svg>
    <div class="sp-chart-legend"><span>Mín. ${min}</span><span>Ahora ${line[line.length - 1]}</span><span>Máx. ${max}</span></div>`;
}

function renderSharedPlayer() {
  const p = sharedPlayer;
  const box = document.getElementById('view-spectator');
  if (!p || !box) return;
  const sideTxt = { Drive: 'juega de drive', 'Revés': 'juega de revés' }[p.side] || 'juega en los dos lados';
  const pct = p.PJ ? Math.round((p.V / p.PJ) * 100) : 0;
  const mins = p.minutes >= 60 ? `${(p.minutes / 60).toFixed(1).replace('.', ',')} h` : `${p.minutes} min`;
  const row = (label, value) => (value ? `<div class="sp-row"><span>${label}</span><strong>${value}</strong></div>` : '');
  const when = new Date(p.at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  box.innerHTML = `${spectatorHeadHTML()}
    <div class="sp-hero">
      ${playerCardHTML(p, { profile: { prefSide: p.side, photo: null } })}
      <div class="sp-id">
        <div class="sp-name">${escapeHtml(p.name)}</div>
        <div class="sp-meta">${[p.pos ? `N.º ${p.pos} de ${p.of} en el ranking` : '', `ELO ${p.elo}`].filter(Boolean).join(' · ')}</div>
        <div class="sp-meta">${escapeHtml([p.hand || '', sideTxt, p.club].filter(Boolean).join(' · ').replace(/^./, c => c.toUpperCase()))}</div>
      </div>
    </div>
    <div class="sm-facts">
      <div><strong>${p.PJ}</strong><span>Partidos</span></div>
      <div><strong>${pct} %</strong><span>Victorias</span></div>
      <div><strong>${p.bestStreak}</strong><span>Mejor racha</span></div>
    </div>
    ${p.eloLine.length > 1 ? `<div class="sp-section"><h2>Evolución del ELO</h2>${sharedEloChartSVG(p.eloLine)}</div>` : ''}
    <div class="sp-section">
      <h2>Temporada</h2>
      <div class="sp-rows">
        ${row('Forma reciente', p.form.length ? formDotsHTML(p.form) : '')}
        ${row('Partidos ganados', p.PJ ? `${p.V} de ${p.PJ}` : '')}
        ${row('Sets ganados', p.sets[0] + p.sets[1] ? `${p.sets[0]} de ${p.sets[0] + p.sets[1]}` : '')}
        ${row('Juegos ganados', p.games[0] + p.games[1] ? `${p.games[0]} de ${p.games[0] + p.games[1]}` : '')}
        ${row('Tiempo en pista', p.minutes ? mins : '')}
        ${row('Mejor compañero', p.partner ? `${escapeHtml(p.partner[0])} · ${p.partner[2]} de ${p.partner[1]} ganados` : '')}
        ${row('Pareja más difícil', p.rival ? `${escapeHtml(p.rival[0])} · ${p.rival[2]} derrota${p.rival[2] === 1 ? '' : 's'} en ${p.rival[1]}` : '')}
        ${row('Títulos', p.titles.length ? p.titles.map(escapeHtml).join(', ') : '')}
        ${row('Mejor americano', p.amBest ? `${p.amBest[0]}.º en ${escapeHtml(p.amBest[1])}` : '')}
        ${row('Golpes ganadores', p.shots.length ? p.shots.map(([l, n]) => `${escapeHtml(l)} (${n})`).join(', ') : '')}
      </div>
    </div>
    <div class="sm-actions"><button class="btn-volt" onclick="sendMatchLink()">Compartir este perfil</button></div>
    <div class="spx-foot">Datos del ${escapeHtml(when)} · Padel Metric</div>`;
  initCardTilt(box);
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
  handlePlayerHash();
  window.addEventListener('hashchange', () => { handleMatchHash(); handlePlayerHash(); });
}
