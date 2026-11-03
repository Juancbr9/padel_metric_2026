// ==========================================================
// CARTA DE JUGADOR Y PERFIL PROPIO ("SOY YO")
// Seis atributos de 0 a 99 calculados con el registro punto a punto de todos sus partidos,
// una media global (con su ELO) y un nivel: bronce, plata, oro o élite.
// ==========================================================
const CARD_ATTRS = [
  ['red', 'RED'], ['fondo', 'FON'], ['saque', 'SAQ'],
  ['resto', 'RES'], ['presion', 'PRE'], ['regularidad', 'REG']
];
const CARD_ATTR_NAMES = { red: 'Red y volea', fondo: 'Fondo', saque: 'Saque', resto: 'Resto', presion: 'Presión', regularidad: 'Regularidad' };
const CARD_TIERS = [[84, 'elite', 'Élite'], [72, 'oro', 'Oro'], [60, 'plata', 'Plata'], [0, 'bronce', 'Bronce']];
// Nombres cortos de los atributos dentro de la carta
const CARD_ATTR_SHORT = { red: 'Red', fondo: 'Fondo', saque: 'Saque', resto: 'Resto', presion: 'Presión', regularidad: 'Regularidad' };
// Color de la pista de cada carta (colores reales de pista). Cada jugador elige el suyo; si no, se le asigna uno por su nombre
const CARD_COURTS = [
  ['azul', 'Azul', '#1E4D8C'], ['noche', 'Azul noche', '#17284A'], ['verde', 'Verde', '#1D6646'],
  ['terracota', 'Terracota', '#9A4A2F'], ['gris', 'Gris', '#39424F'], ['negro', 'Negra', '#121519']
];

function cardCourtOf(name, prof) {
  const chosen = prof && CARD_COURTS.find(c => c[0] === prof.cardColor);
  if (chosen) return chosen;
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CARD_COURTS[h % CARD_COURTS.length];
}

let myPlayerName = localStorage.getItem('pm_yo_v1') || null;

// Lleva una proporción (con pocos datos se acerca al valor medio) a la escala 30-99
function cardScale(won, total, lo, hi, base) {
  const r = (won + 10 * base) / (total + 10);
  return Math.round(Math.max(30, Math.min(99, 45 + ((r - lo) / (hi - lo)) * 50)));
}

function computePlayerCard(name, statsMap = computeAllPlayersStats().statsMap) {
  const st = statsMap[name] || emptyPlayerStats(name);
  const c = { R: [0, 0], F: [0, 0], serve: [0, 0], ret: [0, 0], clutch: [0, 0], pts: 0 };
  matchHistory.forEach(m => {
    if (!m || !m.players) return;
    const idx = m.players.findIndex(p => p.name === name);
    if (idx === -1) return;
    const pair = idx < 2 ? 0 : 1;
    (m.points || []).forEach(pt => {
      c.pts++;
      if (pt.n === name && (pt.z === 'R' || pt.z === 'F')) {
        if (pt.t === 'W') { c[pt.z][0]++; c[pt.z][1]++; } else if (ERROR_TYPES.includes(pt.t)) c[pt.z][1]++;
      }
      if (pt.sv === undefined || pt.sv === null) return;
      const srvPair = pt.sv < 2 ? 0 : 1;
      const won = pt.w === pair;
      if (m.players[pt.sv] && m.players[pt.sv].name === name) { c.serve[1]++; if (won) c.serve[0]++; }
      else if (srvPair !== pair) { c.ret[1]++; if (won) c.ret[0]++; }
      if (pt.bp || pt.gp || pt.tb) { c.clutch[1]++; if (won) c.clutch[0]++; }
    });
  });
  const enfPerMatch = st.PJ ? st.ENF / st.PJ : 6;
  const attrs = {
    red: cardScale(c.R[0], c.R[1], 0.4, 0.8, 0.6),
    fondo: cardScale(c.F[0], c.F[1], 0.25, 0.65, 0.45),
    saque: cardScale(c.serve[0], c.serve[1], 0.45, 0.7, 0.57),
    resto: cardScale(c.ret[0], c.ret[1], 0.36, 0.6, 0.45),
    presion: cardScale(c.clutch[0], c.clutch[1], 0.35, 0.65, 0.5),
    regularidad: Math.round(Math.max(30, Math.min(99, 95 - (enfPerMatch - 2) * 5 * (st.PJ / (st.PJ + 2)) - (2 / (st.PJ + 2)) * 25)))
  };
  const avgAttr = CARD_ATTRS.reduce((a, [k]) => a + attrs[k], 0) / CARD_ATTRS.length;
  const eloScore = Math.max(30, Math.min(99, 45 + ((st.elo - 1350) / 400) * 50));
  const overall = Math.round(st.PJ ? 0.6 * avgAttr + 0.4 * eloScore : Math.min(avgAttr, 60));
  const tier = CARD_TIERS.find(([min]) => overall >= min);
  const best = CARD_ATTRS.reduce((a, [k]) => (attrs[k] > attrs[a] ? k : a), 'red');
  const rank = st.PJ ? Object.values(statsMap).filter(x => x.PJ > 0).sort((x, y) => y.elo - x.elo).findIndex(x => x.name === name) + 1 : 0;
  return { name, attrs, overall, tier: tier[1], tierLabel: tier[2], best, elo: st.elo, PJ: st.PJ, V: st.V, form: st.form, hasPoints: c.pts > 0, rank };
}

// Carta de jugador con forma de pista de pádel vista desde arriba: el jugador en su campo, la red en medio
// y sus números en el otro campo. profile: datos de la ficha (la vista pública pasa los suyos y no toca la base
// de datos). mini: versión pequeña para el inicio (solo identidad y media).
function playerCardHTML(card, { big = false, mini = false, profile = null } = {}) {
  const prof = profile || ensureProfile(card.name);
  // Nombre de pila grande y el apellido encima, en pequeño
  const parts = card.name.trim().split(/\s+/);
  const first = parts.length > 1 ? parts.slice(1).join(' ') : '';
  const surname = parts[0];
  const court = cardCourtOf(card.name, prof);
  const side = { Drive: 'Drive', 'Revés': 'Revés' }[prof.prefSide] || 'Drive y revés';
  const photo = prof.photo ? `<img src="${prof.photo}" alt="">` : `<span>${escapeHtml(getInitials(card.name))}</span>`;
  const lost = Math.max(0, (card.PJ || 0) - (card.V || 0));
  const foot = [prof.racket ? `Pala ${prof.racket}` : '', prof.club].filter(Boolean).join(' · ');
  return `
    <div class="pcard ${big ? 'big' : ''} ${mini ? 'mini' : ''}" style="--court:${court[2]}" data-tilt>
      <svg class="pcard-lines" viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true">
        <rect x="6" y="4" width="88" height="192"/><line x1="6" y1="44" x2="94" y2="44"/><line x1="50" y1="44" x2="50" y2="100"/>
        <line x1="6" y1="156" x2="94" y2="156"/><line x1="50" y1="100" x2="50" y2="156"/>
      </svg>
      <div class="pcard-half">
        <div class="pcard-head">
          <span class="pcard-rank">${card.rank ? `N.º ${card.rank}` : 'Sin ranking'}</span>
          <svg class="pcard-logo"><use href="#logo-mark"/></svg>
        </div>
        <div class="pcard-id">
          <div class="pcard-photo">${photo}</div>
          <div class="pcard-names">${first ? `<span>${escapeHtml(first)}</span>` : ''}<strong>${escapeHtml(surname)}</strong></div>
          <div class="pcard-meta">${escapeHtml(side)}${prof.hand ? ` · ${escapeHtml(prof.hand.toLowerCase())}` : ''}</div>
        </div>
      </div>
      <div class="pcard-net"><span>Padel Metric</span></div>
      <div class="pcard-half">
        <div class="pcard-nums">
          <div><strong>${card.overall}</strong><span>Media</span></div>
          <div><strong>${card.elo}</strong><span>ELO</span></div>
          <div><strong>${card.V || 0}-${lost}</strong><span>Balance</span></div>
        </div>
        <div class="pcard-attrs">
          ${CARD_ATTRS.map(([k]) => `<div class="${k === card.best ? 'best' : ''}"><span>${CARD_ATTR_SHORT[k]}</span><i><b style="width:${card.attrs[k]}%"></b></i><strong>${card.attrs[k]}</strong></div>`).join('')}
        </div>
        <div class="pcard-foot">${escapeHtml(foot || 'Padel Metric')}</div>
      </div>
    </div>`;
}

// Inclinación suave con el dedo o el ratón
function initCardTilt(root = document) {
  root.querySelectorAll('[data-tilt]').forEach(el => {
    if (el.dataset.tiltReady) return;
    el.dataset.tiltReady = '1';
    const move = e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
      el.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', move);
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
}

function playerCardTabHTML(name) {
  const card = computePlayerCard(name);
  const prof = ensureProfile(name);
  const court = cardCourtOf(name, prof);
  const isMe = myPlayerName === name;
  return `
    <div class="pcard-stage">${playerCardHTML(card, { big: true })}</div>
    <div class="pc-colors">
      <div class="pc-colors-label">Color de la pista <span>${court[1]}${prof.cardColor ? '' : ' · asignado'}</span></div>
      <div class="pc-swatches">${CARD_COURTS.map(([key, label, hex]) => `<button type="button" class="pc-swatch ${court[0] === key ? 'on' : ''}" style="--sw:${hex}" aria-label="${label}" onclick="setCardColor(${jsArg(name)}, '${key}')"></button>`).join('')}</div>
    </div>
    <p class="pcard-note">${card.hasPoints ? 'Los atributos se calculan con todos sus puntos registrados (zonas de golpeo, saque, resto, puntos decisivos y errores); la media incluye su ELO.' : 'Aún no hay partidos con registro punto a punto: la carta se irá completando al jugar.'}${prof.racket ? '' : ' Añade su pala en Editar para que salga en la carta.'}</p>
    <div class="pcard-actions">
      <button class="btn-volt" onclick="openSharePlayerSheet(${jsArg(name)})">Compartir perfil</button>
      <button class="btn-icon" onclick="sharePlayerCard(${jsArg(name)})">Imagen de la carta</button>
      <button class="btn-icon" onclick="closePlayerProfile(); openWrapped(${jsArg(name)})">Su temporada en historias</button>
      <button class="btn-icon ${isMe ? 'is-me' : ''}" onclick="setMyPlayer(${jsArg(name)})">${isMe ? 'Este eres tú · quitar' : 'Soy yo'}</button>
    </div>`;
}

function setCardColor(name, key) {
  if (!CARD_COURTS.some(c => c[0] === key)) return;
  ensureProfile(name).cardColor = key;
  saveDB();
  vibrate(10);
  openPlayerProfile(name, true);
  if (currentTab === 'home') renderHome();
}

// Elegir quién eres en esta app: lista de jugadores con buscador
function openChooseMeSheet() {
  closeAppMenu();
  const { statsMap } = computeAllPlayersStats();
  const list = [...dbPlayers].sort((a, b) => ((statsMap[b] && statsMap[b].PJ) || 0) - ((statsMap[a] && statsMap[a].PJ) || 0) || a.localeCompare(b, 'es'));
  if (!list.length) {
    openEditProfileModal(null);
    showToast('Crea primero tu ficha de jugador');
    return;
  }
  openEventModal(`
    <div class="mo-title">¿Quién eres?</div>
    <p class="bc-intro">Elige tu jugador: el inicio mostrará tu carta, tu ELO y tu temporada, y el ranking y el historial te marcarán.</p>
    <input type="search" id="me-search" placeholder="Buscar" oninput="filterChooseMe(this.value)">
    <div class="me-list" id="me-list">${list.map(n => {
      const st = statsMap[n];
      return `<button type="button" class="me-row" data-q="${escapeHtml(n.toLowerCase())}" onclick="chooseMe(${jsArg(n)})">
        ${renderAvatarHTML(n, '')}<span class="me-row-txt"><strong>${escapeHtml(n)}</strong><small>${st && st.PJ ? `${st.PJ} partidos · ELO ${st.elo}` : 'Sin partidos todavía'}</small></span>
        ${n === myPlayerName ? '<span class="me-tag">Tú</span>' : ''}</button>`;
    }).join('')}</div>
    <button class="btn-text btn-block" onclick="closeEventModal(); openEditProfileModal(null)">No estoy en la lista: crear mi ficha</button>`);
}

function filterChooseMe(q) {
  const t = String(q || '').trim().toLowerCase();
  document.querySelectorAll('#me-list .me-row').forEach(r => r.classList.toggle('hidden', !!t && !r.dataset.q.includes(t)));
}

function chooseMe(name) {
  myPlayerName = name;
  try { localStorage.setItem('pm_yo_v1', name); } catch (e) {}
  closeEventModal();
  vibrate(12);
  showToast(`Perfil propio: ${name}`);
  if (currentTab === 'home') renderHome();
  if (currentTab === 'ranking') renderGlobalRanking();
}

// Aviso en el inicio para elegir quién eres (solo si hay jugadores y aún no lo has elegido)
function chooseMeBannerHTML() {
  if ((myPlayerName && dbPlayers.includes(myPlayerName)) || !dbPlayers.length || !matchHistory.length) return '';
  return `<div class="home-install">
    <svg class="icon icon-lg"><use href="#i-users"/></svg>
    <button type="button" class="home-install-main" onclick="openChooseMeSheet()"><strong>¿Quién eres?</strong><small>Elige tu jugador y verás aquí tu carta y tu temporada</small></button>
  </div>`;
}

function setMyPlayer(name) {
  myPlayerName = myPlayerName === name ? null : name;
  try {
    if (myPlayerName) localStorage.setItem('pm_yo_v1', myPlayerName); else localStorage.removeItem('pm_yo_v1');
  } catch (e) {}
  vibrate(12);
  showToast(myPlayerName ? `Perfil propio: ${myPlayerName}` : 'Perfil propio quitado');
  openPlayerProfile(name, true);
  if (currentTab === 'home') renderHome();
}

// ---------- Imagen para compartir (1080 × 1350) ----------
// Imagen de la carta (1080 × 1350) con el mismo diseño de pista que en la app
async function sharePlayerCard(name) {
  const card = computePlayerCard(name);
  const prof = ensureProfile(name);
  const court = cardCourtOf(name, prof);
  let img = null;
  if (prof.photo) {
    img = new Image();
    img.src = prof.photo;
    try { await img.decode(); } catch (e) { img = null; }
  }
  const parts = name.trim().split(/\s+/);
  // Nombre de pila grande y el apellido encima, como en la carta de la app
  const first = parts.length > 1 ? parts.slice(1).join(' ') : '';
  const surname = parts[0];
  const side = { Drive: 'Drive', 'Revés': 'Revés' }[prof.prefSide] || 'Drive y revés';
  openShareImage((ctx, W, H) => {
    ctx.fillStyle = SHARE_THEME.bg1;
    ctx.fillRect(0, 0, W, H);
    // Carta con la proporción de una pista: dos campos iguales y la red en medio
    const cw = 640, ch = 1150, cx = (W - cw) / 2, cy = 80, mid = cy + ch / 2;
    ctx.fillStyle = court[2];
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 34); ctx.fill();
    const lx = cx + cw * 0.06, rx = cx + cw * 0.94, ty = cy + ch * 0.02, by = cy + ch * 0.98;
    const sTop = cy + ch * 0.22, sBot = cy + ch * 0.78;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 4;
    ctx.strokeRect(lx, ty, rx - lx, by - ty);
    [[lx, sTop, rx, sTop], [W / 2, sTop, W / 2, mid], [lx, sBot, rx, sBot], [W / 2, mid, W / 2, sBot]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
    // Campo de arriba: el jugador
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '600 30px "Barlow", sans-serif';
    ctx.fillText(card.rank ? `N.º ${card.rank}` : 'Sin ranking', cx + 62, cy + 78);
    drawLogoMark(ctx, cx + cw - 104, cy + 42, 50, '#FFFFFF');
    const r = 96, pcx = W / 2, pcy = cy + 238;
    ctx.save(); ctx.beginPath(); ctx.arc(pcx, pcy, r, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.clip();
    if (img) ctx.drawImage(img, pcx - r, pcy - r, r * 2, r * 2);
    else { ctx.fillStyle = '#FFFFFF'; ctx.font = '700 80px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(getInitials(name), pcx, pcy + 28); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.88)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(pcx, pcy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center';
    if (first) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '600 34px "Barlow", sans-serif'; ctx.fillText(first, W / 2, cy + 384); }
    ctx.fillStyle = '#FFFFFF'; ctx.font = '700 86px "Barlow Condensed", sans-serif';
    ctx.fillText(fitText(ctx, surname.toUpperCase(), cw - 110), W / 2, cy + (first ? 462 : 450));
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '500 28px "Barlow", sans-serif';
    ctx.fillText(`${side}${prof.hand ? ` · ${prof.hand.toLowerCase()}` : ''}`, W / 2, cy + 506);
    // Red
    ctx.fillStyle = 'rgba(3,5,8,0.5)'; ctx.fillRect(cx, mid - 22, cw, 44);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(cx, mid - 22, cw, 6);
    ctx.font = 'italic 900 26px "Barlow Condensed", sans-serif'; ctx.fillText('PADEL METRIC', W / 2, mid + 14);
    // Campo de abajo: media, ELO, balance y atributos
    const nums = [[card.overall, 'Media'], [card.elo, 'ELO'], [`${card.V || 0}-${Math.max(0, (card.PJ || 0) - (card.V || 0))}`, 'Balance']];
    nums.forEach(([v, l], i) => {
      const x = cx + cw * (i + 0.5) / 3;
      ctx.fillStyle = '#FFFFFF'; ctx.font = '700 74px "Barlow Condensed", sans-serif'; ctx.fillText(String(v), x, mid + 118);
      ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.font = '500 26px "Barlow", sans-serif'; ctx.fillText(l, x, mid + 152);
    });
    CARD_ATTRS.forEach(([k], i) => {
      const y = mid + 222 + i * 50;
      ctx.textAlign = 'left'; ctx.fillStyle = k === card.best ? '#FFFFFF' : 'rgba(255,255,255,0.82)'; ctx.font = `${k === card.best ? 700 : 500} 28px "Barlow", sans-serif`;
      ctx.fillText(CARD_ATTR_SHORT[k], cx + 70, y);
      const bx = cx + 250, bw = cw - 390;
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.roundRect(bx, y - 13, bw, 10, 5); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(bx, y - 13, bw * card.attrs[k] / 100, 10, 5); ctx.fill();
      ctx.textAlign = 'right'; ctx.font = '700 38px "Barlow Condensed", sans-serif'; ctx.fillText(String(card.attrs[k]), cx + cw - 70, y + 3);
    });
    const foot = [prof.racket ? `Pala ${prof.racket}` : '', prof.club].filter(Boolean).join(' · ');
    if (foot) { ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '500 26px "Barlow", sans-serif'; ctx.fillText(fitText(ctx, foot, cw - 140), W / 2, cy + ch - 58); }
    ctx.textAlign = 'left';
  }, 'Carta de jugador');
}

// ---------- Inicio personalizado ----------
function myHomeCardHTML(statsMap) {
  if (!myPlayerName || !dbPlayers.includes(myPlayerName)) return '';
  const card = computePlayerCard(myPlayerName, statsMap);
  const ranked = Object.values(statsMap).filter(s => s.PJ > 0).sort((a, b) => b.elo - a.elo);
  const pos = ranked.findIndex(s => s.name === myPlayerName) + 1;
  return `
    <div class="home-me" role="button" tabindex="0" onclick="openPlayerProfile(${jsArg(myPlayerName)}); setProfileTab('card')">
      <div class="home-me-card">${playerCardHTML(card, { mini: true })}</div>
      <div class="home-me-info">
        <strong>${escapeHtml(myPlayerName)}</strong>
        <span>ELO <b>${card.elo}</b>${pos ? ` · ${pos}.º del ranking` : ''}</span>
        <span>${card.PJ ? `<b>${card.V}</b> de ${card.PJ} ganados` : 'Sin partidos todavía'}${card.form && card.form.length ? ` ${formDotsHTML(card.form)}` : ''}</span>
        ${card.PJ ? `<span class="home-me-link" role="button" onclick="event.stopPropagation(); openWrapped(${jsArg(myPlayerName)})">Tu temporada ›</span>` : ''}
      </div>
    </div>`;
}
