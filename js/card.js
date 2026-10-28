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
  return { name, attrs, overall, tier: tier[1], tierLabel: tier[2], best, elo: st.elo, PJ: st.PJ, V: st.V, form: st.form, hasPoints: c.pts > 0 };
}

function playerCardHTML(card, { big = false } = {}) {
  const prof = ensureProfile(card.name);
  const parts = card.name.trim().split(/\s+/);
  const surname = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  const side = prof.prefSide && prof.prefSide !== 'Ambas' ? prof.prefSide : 'Pádel';
  const photo = prof.photo ? `<img src="${prof.photo}" alt="">` : `<span>${escapeHtml(getInitials(card.name))}</span>`;
  return `
    <div class="pcard tier-${card.tier} ${big ? 'big' : ''}" data-tilt>
      <div class="pcard-shine"></div>
      <div class="pcard-top">
        <div class="pcard-ovr"><strong>${card.overall}</strong><span>${escapeHtml(side)}</span></div>
        <div class="pcard-photo">${photo}</div>
      </div>
      <div class="pcard-name">${escapeHtml(surname)}</div>
      <div class="pcard-attrs">
        ${CARD_ATTRS.map(([k, lbl]) => `<div class="${k === card.best ? 'best' : ''}"><strong>${card.attrs[k]}</strong><span>${lbl}</span></div>`).join('')}
      </div>
      <div class="pcard-foot"><span>${card.tierLabel}</span><span>ELO ${card.elo}</span><span>${card.PJ} PJ</span></div>
    </div>`;
}

// Inclinación con el dedo o el ratón y brillo holográfico que sigue al movimiento
function initCardTilt(root = document) {
  root.querySelectorAll('[data-tilt]').forEach(el => {
    if (el.dataset.tiltReady) return;
    el.dataset.tiltReady = '1';
    const move = e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--rx', `${(0.5 - y) * 16}deg`);
      el.style.setProperty('--ry', `${(x - 0.5) * 18}deg`);
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', move);
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
}

function playerCardTabHTML(name) {
  const card = computePlayerCard(name);
  const isMe = myPlayerName === name;
  return `
    <div class="pcard-stage">${playerCardHTML(card, { big: true })}</div>
    <div class="pcard-legend">
      ${CARD_ATTRS.map(([k]) => `<div><span>${CARD_ATTR_NAMES[k]}</span><div class="shot-bar-track"><i style="width:${card.attrs[k]}%"></i></div><strong>${card.attrs[k]}</strong></div>`).join('')}
    </div>
    <p class="pcard-note">${card.hasPoints ? 'Calculada con todos sus puntos registrados: zonas de golpeo, saque, resto, puntos decisivos y errores. La media incluye su ELO.' : 'Aún no hay partidos con registro punto a punto: la carta se irá afinando al jugar.'}</p>
    <div class="pcard-actions">
      <button class="btn-volt" onclick="sharePlayerCard(${jsArg(name)})"><svg class="icon"><use href="#i-share"/></svg> Compartir carta</button>
      <button class="btn-icon" onclick="closePlayerProfile(); openWrapped(${jsArg(name)})"><svg class="icon"><use href="#i-play-circle"/></svg> Ver su temporada en historias</button>
      <button class="btn-icon ${isMe ? 'is-me' : ''}" onclick="setMyPlayer(${jsArg(name)})">${isMe ? 'Este eres tú · quitar' : 'Soy yo'}</button>
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
const CARD_COLORS = {
  bronce: ['#8A5A36', '#3B2414', '#E7B38A'], plata: ['#9AA7B8', '#2B3442', '#F1F5F9'],
  oro: ['#E8B931', '#5A3F07', '#FFF1B8'], elite: ['#7C3AED', '#0B1027', '#D4FF2A']
};

async function sharePlayerCard(name) {
  const card = computePlayerCard(name);
  const prof = ensureProfile(name);
  let img = null;
  if (prof.photo) {
    img = new Image();
    img.src = prof.photo;
    try { await img.decode(); } catch (e) { img = null; }
  }
  openShareImage((ctx, W, H) => {
    drawShareFrame(ctx, W, H, { kicker: 'Carta de jugador', title: name, subtitle: `${card.tierLabel} · ELO ${card.elo} · ${card.PJ} partidos · ${card.PJ ? Math.round((card.V / card.PJ) * 100) : 0} % de victorias` });
    const [c1, c2, c3] = CARD_COLORS[card.tier];
    const cw = 560, ch = 760, cx = (W - cw) / 2, cy = 400;
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(cx + 40, cy); ctx.lineTo(cx + cw - 40, cy); ctx.lineTo(cx + cw, cy + 60);
      ctx.lineTo(cx + cw, cy + ch - 120); ctx.lineTo(cx + cw / 2, cy + ch); ctx.lineTo(cx, cy + ch - 120);
      ctx.lineTo(cx, cy + 60); ctx.closePath();
    };
    const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.save(); shape(); ctx.fillStyle = g; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 50; ctx.fill(); ctx.restore();
    ctx.save(); shape(); ctx.clip();
    const sh = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch * 0.6);
    sh.addColorStop(0.3, 'rgba(255,255,255,0)'); sh.addColorStop(0.45, 'rgba(255,255,255,0.22)'); sh.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(cx, cy, cw, ch);
    // Foto o iniciales
    const pr = 150, px = cx + cw - pr - 60, py = cy + 70;
    ctx.save(); ctx.beginPath(); ctx.arc(px + pr / 2 + 20, py + pr / 2 + 20, pr / 2 + 20, 0, Math.PI * 2); ctx.clip();
    if (img) ctx.drawImage(img, px, py, pr + 40, pr + 40);
    else { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px, py, pr + 40, pr + 40); ctx.fillStyle = c3; ctx.font = '900 96px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(getInitials(name), px + pr / 2 + 20, py + pr / 2 + 54); ctx.textAlign = 'left'; }
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = c3;
    ctx.font = '900 150px "Barlow Condensed", sans-serif';
    ctx.fillText(String(card.overall), cx + 50, cy + 190);
    ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
    ctx.fillText((prof.prefSide && prof.prefSide !== 'Ambas' ? prof.prefSide : 'Pádel').toUpperCase(), cx + 56, cy + 236);
    const parts = name.trim().split(/\s+/);
    ctx.font = 'italic 900 84px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fitText(ctx, (parts.length > 1 ? parts.slice(1).join(' ') : parts[0]).toUpperCase(), cw - 80), W / 2, cy + 400);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(cx + 70, cy + 425, cw - 140, 3);
    CARD_ATTRS.forEach(([k, lbl], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = cx + 140 + col * 250, y = cy + 500 + row * 70;
      ctx.textAlign = 'right'; ctx.fillStyle = c3; ctx.font = '900 56px "Barlow Condensed", sans-serif';
      ctx.fillText(String(card.attrs[k]), x + 30, y);
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(lbl, x + 45, y - 4);
    });
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
    <button type="button" class="home-card home-me" onclick="openPlayerProfile(${jsArg(myPlayerName)}); setProfileTab('card')">
      <div class="home-me-card">${playerCardHTML(card)}</div>
      <div class="home-me-info">
        <small>Tu perfil</small>
        <strong>${escapeHtml(myPlayerName)}</strong>
        <div class="home-me-stats">
          <div><b data-count="${card.elo}">${card.elo}</b><span>ELO</span></div>
          <div><b>${pos ? `${pos}.º` : '–'}</b><span>Ranking</span></div>
          <div><b data-count="${card.PJ ? Math.round((card.V / card.PJ) * 100) : 0}" data-suffix=" %">0</b><span>Victorias</span></div>
        </div>
        <span class="home-me-form">${formDotsHTML(card.form) || 'Sin partidos todavía'}</span>
      </div>
    </button>
    ${card.PJ ? `<button type="button" class="home-wrapped" onclick="openWrapped(${jsArg(myPlayerName)})">
      <svg class="icon icon-lg"><use href="#i-play-circle"/></svg><span><strong>Tu temporada</strong><small>Tu año de pádel en historias</small></span></button>` : ''}`;
}
