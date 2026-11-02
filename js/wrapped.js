// ==========================================================
// RESUMEN DE TEMPORADA EN FORMATO HISTORIAS
// Pantallas a pantalla completa que avanzan solas (toca a la derecha para seguir, a la izquierda para volver,
// mantén pulsado para pausar y desliza hacia abajo para cerrar). Se puede elegir la temporada (cada año con
// partidos o toda la historia) y compartir el resumen como imagen vertical para historias (1080 × 1920).
// Habla de "tu" en el perfil propio y de "su" en el de los demás.
// ==========================================================
const WRAP_SLIDE_MS = 6000;
const WRAP_MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const WRAP_MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
let wrapState = null;

function wrapTimeOf(m) {
  const t = +m.id;
  return t > 1e11 ? t : (Date.parse(m.date) || 0);
}

// Temporadas de un jugador: cada año con partidos (del más reciente al más antiguo) y, si hay varias, toda la historia
function seasonOptionsOf(name) {
  const all = matchHistory.filter(m => m && m.players && m.players.some(p => p.name === name));
  const years = {};
  all.forEach(m => {
    const t = wrapTimeOf(m);
    if (t) (years[new Date(t).getFullYear()] = years[new Date(t).getFullYear()] || []).push(m);
  });
  const opts = Object.keys(years).sort((a, b) => b - a).map(y => ({ key: y, label: `Temporada ${y}`, matches: years[y] }));
  if (opts.length !== 1 || opts[0].matches.length !== all.length) opts.push({ key: 'all', label: 'Toda la historia', matches: all });
  return opts.filter(o => o.matches.length);
}

// Por defecto, el año más reciente con al menos 3 partidos; si no hay, toda la historia
function defaultSeasonKey(opts) {
  const good = opts.find(o => o.key !== 'all' && o.matches.length >= 3);
  return good ? good.key : (opts.find(o => o.key === 'all') || opts[0] || {}).key;
}

function wrapRecord(name, matches) {
  const r = { pj: 0, v: 0, W: 0, ENF: 0, rating: 0 };
  matches.forEach(m => {
    const idx = m.players.findIndex(p => p.name === name);
    const p = m.players[idx];
    r.pj++; if (m.winnerPair === (idx < 2 ? 0 : 1)) r.v++;
    r.W += p.W || 0; r.ENF += p.ENF || 0; r.rating += calcPlayerRating({ W: 0, ENF: 0, EF: 0, aces: 0, ...p });
  });
  return r;
}

function computeWrapped(name, key) {
  const opts = seasonOptionsOf(name);
  const opt = opts.find(o => o.key === String(key)) || opts.find(o => o.key === defaultSeasonKey(opts));
  if (!opt) return { name, PJ: 0 };
  const matches = opt.matches;
  const inSeason = new Set(matches);
  const year = opt.key === 'all' ? null : +opt.key;
  const { statsMap } = computeAllPlayersStats();
  const st = statsMap[name] || emptyPlayerStats(name);
  const w = {
    name, key: opt.key, label: opt.label, year, opts, me: name === myPlayerName,
    PJ: 0, V: 0, sec: 0, partners: {}, rivals: {}, shots: {}, zones: { R: 0, T: 0, F: 0 }, clutch: [0, 0], streak: 0, best: 0,
    badges: {}, comeback: null, W: 0, ENF: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
    months: Array.from({ length: 12 }, () => ({ pj: 0, v: 0 })), bestMatch: null, titles: []
  };
  [...matches].reverse().forEach(m => {
    const idx = m.players.findIndex(p => p.name === name);
    const pair = idx < 2 ? 0 : 1;
    const p = m.players[idx];
    const won = m.winnerPair === pair;
    w.PJ++; if (won) w.V++;
    w.sec += m.elapsedSec || 0;
    w.W += p.W || 0; w.ENF += p.ENF || 0;
    w.streak = won ? w.streak + 1 : 0; w.best = Math.max(w.best, w.streak);
    (m.sets || []).forEach(s => {
      if (s[0] + s[1] === 0) return;
      w.gamesWon += s[pair]; w.gamesLost += s[1 - pair];
      if (s[pair] > s[1 - pair]) w.setsWon++; else w.setsLost++;
    });
    const t = wrapTimeOf(m);
    if (t) { const mo = w.months[new Date(t).getMonth()]; mo.pj++; if (won) mo.v++; }
    const partner = m.players[pair * 2 + (idx % 2 ? 0 : 1)].name;
    w.partners[partner] = w.partners[partner] || { name: partner, pj: 0, v: 0 };
    w.partners[partner].pj++; if (won) w.partners[partner].v++;
    const rivals = [m.players[(1 - pair) * 2].name, m.players[(1 - pair) * 2 + 1].name];
    const rk = [...rivals].sort().join(' / ');
    w.rivals[rk] = w.rivals[rk] || { name: pairLabel(rivals), pj: 0, v: 0 };
    w.rivals[rk].pj++; if (won) w.rivals[rk].v++;
    (m.points || []).forEach(pt => {
      if (pt.n === name && pt.t === 'W') {
        if (pt.sh && pt.sh !== 'Winner') w.shots[pt.sh] = (w.shots[pt.sh] || 0) + 1;
        if (pt.z) w.zones[pt.z]++;
      }
      if (pt.bp || pt.gp || pt.tb) { w.clutch[1]++; if (pt.w === pair) w.clutch[0]++; }
    });
    badgesForPlayerInMatch(m, idx).forEach(k => { w.badges[k] = (w.badges[k] || 0) + 1; });
    // Mejor partido: la valoración más alta (a igualdad, el que ganó)
    const rating = calcPlayerRating({ W: 0, ENF: 0, EF: 0, aces: 0, ...p });
    if (!w.bestMatch || rating > w.bestMatch.rating || (rating === w.bestMatch.rating && won && !w.bestMatch.won)) {
      w.bestMatch = { m, pair, rating, won, partner, rivals, p };
    }
    // Mayor remontada: partido ganado en el que su probabilidad de victoria llegó a ser la más baja
    const series = wpSeries(m);
    if (won && series) {
      const low = Math.min(...series.map(s => (pair === 0 ? s.wp : 1 - s.wp)));
      if (!w.comeback || low < w.comeback.low) w.comeback = { low, m, pair };
    }
  });
  // ELO de la temporada: eloHistory tiene un valor por cada partido con ganador, del más antiguo al más reciente
  const hist = st.eloHistory && st.eloHistory.length ? st.eloHistory : [ELO_START];
  let k = 0, first = -1, last = -1;
  [...matchHistory].reverse().forEach(m => {
    if (!m || !m.players || m.winnerPair === null || m.winnerPair === undefined) return;
    const p = m.players.find(x => x.name === name);
    if (!p || p.isGeneric) return;
    k++;
    if (inSeason.has(m)) { if (first < 0) first = k; last = k; }
  });
  if (first > 0 && last < hist.length) {
    w.eloSeries = hist.slice(first - 1, last + 1);
  } else {
    w.eloSeries = [st.elo];
  }
  w.eloStart = w.eloSeries[0];
  w.eloEnd = w.eloSeries[w.eloSeries.length - 1];
  w.eloPeak = Math.max(...w.eloSeries);
  w.bestPartner = Object.values(w.partners).sort((a, b) => b.v - a.v || (b.v / b.pj) - (a.v / a.pj))[0];
  w.toughRival = Object.values(w.rivals).filter(r => r.pj > r.v).sort((a, b) => (b.pj - b.v) - (a.pj - a.v))[0];
  w.topShots = Object.entries(w.shots).sort((a, b) => b[1] - a[1]).slice(0, 3);
  w.topShot = w.topShots[0];
  w.topZone = Object.entries(w.zones).sort((a, b) => b[1] - a[1])[0];
  // Títulos y podios de la temporada
  const inYear = ts => !year || (ts && new Date(ts).getFullYear() === year);
  tournaments.forEach(tn => {
    const team = (tn.teams || []).find(tm => (tm.players || []).includes(name));
    if (team && tn.champion === team.id && inYear(tn.createdAt)) w.titles.push({ name: tn.name, text: 'Título' });
  });
  americanos.forEach(ev => {
    if (!ev.players.includes(name) || ev.status !== 'finished' || !inYear(ev.createdAt)) return;
    const pos = americanoStandings(ev).findIndex(r => r.members.includes(name)) + 1;
    if (pos >= 1 && pos <= 3) w.titles.push({ name: ev.name, text: pos === 1 ? 'Primer puesto' : `${pos}.º puesto` });
  });
  // Comparación con la temporada anterior (si jugó al menos 3 partidos)
  const prevOpt = year && opts.find(o => o.key === String(year - 1));
  if (prevOpt && prevOpt.matches.length >= 3) {
    w.prev = { year: year - 1, ...wrapRecord(name, prevOpt.matches) };
    w.cur = wrapRecord(name, matches);
  }
  w.card = computePlayerCard(name, statsMap);
  return w;
}

// Golpe del catálogo (o el primero de su familia, en partidos antiguos que guardan "Bandeja/Víbora", "Fondo/Bajada"…)
function wrapShotOf(id) {
  if (typeof SHOT_CATALOG === 'undefined') return null;
  return SHOT_BY_ID[id] || SHOT_CATALOG.find(s => s.group === id) || null;
}

function wrapShotLabel(id) {
  const s = typeof SHOT_BY_ID !== 'undefined' && SHOT_BY_ID[id];
  return s ? s.label : String(id).replace('/', ' / ');
}

function wrapMonthsSVG(months) {
  const max = Math.max(1, ...months.map(m => m.pj));
  const bw = 15, step = 25, h = 108;
  return `<svg class="w-months" viewBox="0 0 300 130" role="img" aria-label="Partidos por mes">${months.map((m, i) => {
    const x = i * step + (step - bw) / 2;
    const tot = m.pj ? Math.max(3, (m.pj / max) * h) : 0;
    const win = m.pj ? (m.v / m.pj) * tot : 0;
    return `<g>${tot ? `<rect class="lost" x="${x}" y="${h - tot}" width="${bw}" height="${tot}" rx="2"/>` : `<rect class="none" x="${x}" y="${h - 2}" width="${bw}" height="2"/>`}${win ? `<rect class="won" x="${x}" y="${h - win}" width="${bw}" height="${win}" rx="2"/>` : ''}<text x="${x + bw / 2}" y="${h + 18}">${WRAP_MONTHS[i]}</text></g>`;
  }).join('')}</svg>`;
}

function wrapSlides(w) {
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const dec = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const me = w.me;
  const Su = me ? 'Tu' : 'Su', su = me ? 'tu' : 'su';
  const hours = w.sec / 3600;
  const parts = w.name.trim().split(/\s+/);
  const first = parts[0];
  const line = (label, value) => `<div><span>${label}</span><b>${value}</b></div>`;
  const slides = [];
  const others = w.opts.length > 1 ? `<div class="w-seasons">${w.opts.map(o => `<button class="w-season${o.key === w.key ? ' on' : ''}" onclick="event.stopPropagation(); openWrapped(${jsArg(w.name)}, ${jsArg(o.key)})">${o.key === 'all' ? 'Todo' : o.key}</button>`).join('')}</div>` : '';
  slides.push({ cls: 'w-intro', html: `
    <svg class="w-logo"><use href="#logo-mark"/></svg>
    <div class="w-kicker">${escapeHtml(w.label)}</div>
    <div class="w-huge">${escapeHtml(first)}</div>
    <div class="w-sub">${me ? (w.year ? 'Tu temporada' : 'Tu historia') : `${w.year ? 'La temporada' : 'La historia'} de ${escapeHtml(w.name)}`} en cifras. Toca la derecha para avanzar y la izquierda para volver.</div>
    ${others}` });

  slides.push({ cls: 'w-matches', html: `
    <div class="w-kicker">En la pista</div>
    <div class="w-big">${w.PJ}</div>
    <div class="w-sub">${w.PJ === 1 ? 'partido jugado' : 'partidos jugados'}</div>
    <div class="w-lines">
      ${line('Victorias', `${w.V} de ${w.PJ} · ${pct(w.V, w.PJ)} %`)}
      ${w.setsWon + w.setsLost ? line('Sets', `${w.setsWon} ganados, ${w.setsLost} perdidos`) : ''}
      ${w.gamesWon + w.gamesLost ? line('Juegos', `${w.gamesWon} a ${w.gamesLost}`) : ''}
      ${w.sec ? line('Tiempo en pista', hours >= 1 ? `${dec(hours)} h` : `${Math.round(hours * 60)} min`) : ''}
    </div>` });

  const active = w.months.filter(m => m.pj).length;
  if (w.year && active >= 2) {
    const top = w.months.reduce((b, m, i) => (m.pj > w.months[b].pj ? i : b), 0);
    const mt = w.months[top];
    slides.push({ cls: 'w-month', html: `
      <div class="w-kicker">Mes a mes</div>
      <div class="w-name">${WRAP_MONTH_NAMES[top]}</div>
      <div class="w-sub">fue ${su} mes con más partidos: ${plural(mt.pj, 'partido', 'partidos')} y ${plural(mt.v, 'victoria', 'victorias')}.</div>
      ${wrapMonthsSVG(w.months)}
      <div class="w-legend"><span class="won">Victorias</span><span class="lost">Derrotas</span></div>` });
  }

  const diff = w.eloEnd - w.eloStart;
  const es = w.eloSeries, min = Math.min(...es), max = Math.max(...es), span = Math.max(20, max - min);
  const path = es.map((v, i) => `${i ? 'L' : 'M'}${(es.length > 1 ? i / (es.length - 1) : 0) * 300} ${(110 - ((v - min) / span) * 100).toFixed(1)}`).join('');
  const current = !w.year || w.year === new Date().getFullYear();
  slides.push({ cls: 'w-elo', html: `
    <div class="w-kicker">${Su} nivel</div>
    <div class="w-big">${w.eloEnd}</div>
    <div class="w-sub">puntos ELO, ${diff > 0 ? `${diff} más` : diff < 0 ? `${-diff} menos` : 'los mismos'} que al empezar (${w.eloStart}).</div>
    ${es.length > 1 ? `<svg class="w-chart" viewBox="0 0 300 120"><path d="${path}" pathLength="1"/></svg>` : ''}
    <div class="w-foot">Máximo alcanzado: <b>${w.eloPeak}</b>${current && w.card.rank ? ` · Puesto <b>${w.card.rank}</b> del ranking` : ''}</div>` });

  if (w.bestMatch && w.PJ >= 2) {
    const b = w.bestMatch, m = b.m;
    const score = (m.sets || []).filter(s => s[0] + s[1]).map(s => `${s[b.pair]}-${s[1 - b.pair]}`).join('  ');
    const t = wrapTimeOf(m);
    slides.push({ cls: 'w-best', html: `
      <div class="w-kicker">${Su} mejor partido</div>
      <div class="w-name">${score || (b.won ? 'Victoria' : 'Derrota')}</div>
      <div class="w-sub">${b.won ? 'Victoria' : 'Derrota'} con ${escapeHtml(shortName(b.partner))} contra ${escapeHtml(pairLabel(b.rivals))}${t ? `, el ${new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}` : ''}.</div>
      <div class="w-lines">
        ${line('Valoración', dec(b.rating))}
        ${line('Winners', b.p.W || 0)}
        ${line('Errores no forzados', b.p.ENF || 0)}
      </div>` });
  }

  if (w.bestPartner) slides.push({ cls: 'w-partner', html: `
    <div class="w-kicker">${Su} mejor pareja</div>
    <div class="w-avatar">${renderAvatarHTML(w.bestPartner.name, '', '', false)}</div>
    <div class="w-name">${escapeHtml(w.bestPartner.name)}</div>
    <div class="w-sub">${plural(w.bestPartner.v, 'victoria', 'victorias')} en ${plural(w.bestPartner.pj, 'partido', 'partidos')} juntos (${pct(w.bestPartner.v, w.bestPartner.pj)} %).</div>` });

  if (w.toughRival) {
    const lost = w.toughRival.pj - w.toughRival.v;
    slides.push({ cls: 'w-rival', html: `
      <div class="w-kicker">${Su} rival más difícil</div>
      <div class="w-name">${escapeHtml(w.toughRival.name)}</div>
      <div class="w-sub">${plural(lost, 'derrota', 'derrotas')} en ${plural(w.toughRival.pj, 'enfrentamiento', 'enfrentamientos')}${w.toughRival.v ? ` y ${plural(w.toughRival.v, 'victoria', 'victorias')}` : ''}.</div>` });
  }

  if (w.topShot || w.W) {
    const s = w.topShot && wrapShotOf(w.topShot[0]);
    slides.push({ cls: 'w-shot', html: `
      <div class="w-kicker">${Su} golpe</div>
      ${s ? `<svg class="w-shotfig" viewBox="0 0 72 40"><use href="#${s.icon}"/></svg>` : ''}
      <div class="w-name">${w.topShot ? escapeHtml(wrapShotLabel(w.topShot[0])) : 'Winners'}</div>
      <div class="w-sub">${w.topShot ? `${plural(w.topShot[1], 'punto ganado', 'puntos ganados')} con este golpe` : `${plural(w.W, 'winner', 'winners')}`}${w.topZone && w.topZone[1] ? `. ${Su} zona fuerte: ${ZONE_NAMES[w.topZone[0]].toLowerCase()}.` : '.'}</div>
      <div class="w-lines">
        ${w.topShots.slice(1).map(([id, n]) => line(escapeHtml(wrapShotLabel(id)), n)).join('')}
        ${line('Winners por cada error no forzado', w.ENF ? dec(w.W / w.ENF, 2) : '–')}
      </div>` });
  }

  if (w.clutch[1]) slides.push({ cls: 'w-clutch', html: `
    <div class="w-kicker">Bajo presión</div>
    <div class="w-big">${pct(w.clutch[0], w.clutch[1])} %</div>
    <div class="w-sub">de los puntos decisivos ganados: ${w.clutch[0]} de ${w.clutch[1]} entre bolas de break, puntos de oro y tie-breaks.</div>` });

  if (w.comeback && w.comeback.low < 0.4) {
    const m = w.comeback.m, pr = w.comeback.pair;
    slides.push({ cls: 'w-comeback', html: `
      <div class="w-kicker">${Su} mejor remontada</div>
      <div class="w-big">${Math.round(w.comeback.low * 100)} %</div>
      <div class="w-sub">era ${su} probabilidad de ganar en el peor momento contra ${escapeHtml(pairLabel([m.players[(1 - pr) * 2].name, m.players[(1 - pr) * 2 + 1].name]))}. Terminó ${(m.sets || []).filter(s => s[0] + s[1]).map(s => `${s[pr]}-${s[1 - pr]}`).join(' ')}.</div>` });
  }

  if (w.titles.length) slides.push({ cls: 'w-titles', html: `
    <div class="w-kicker">Títulos y podios</div>
    <div class="w-big">${w.titles.length}</div>
    <div class="w-sub">${w.titles.length === 1 ? 'podio' : 'podios'} en torneos y americanos.</div>
    <div class="w-lines">${w.titles.slice(0, 5).map(t => line(escapeHtml(t.name), t.text)).join('')}</div>` });

  if (w.prev) {
    const a = w.prev, b = w.cur;
    const d = pct(b.v, b.pj) - pct(a.v, a.pj);
    slides.push({ cls: 'w-prev', html: `
      <div class="w-kicker">Frente a ${a.year}</div>
      <div class="w-name">${d > 0 ? `${d} puntos mejor` : d < 0 ? `${-d} puntos menos` : 'Igual que el año pasado'}</div>
      <div class="w-sub">en porcentaje de victorias.</div>
      <div class="w-lines">
        ${line('Victorias', `${pct(a.v, a.pj)} % → ${pct(b.v, b.pj)} %`)}
        ${line('Partidos', `${a.pj} → ${b.pj}`)}
        ${line('Winners por partido', `${dec(a.W / a.pj)} → ${dec(b.W / b.pj)}`)}
        ${line('Valoración media', `${dec(a.rating / a.pj)} → ${dec(b.rating / b.pj)}`)}
      </div>` });
  }

  slides.push({ cls: 'w-streak', html: `
    <div class="w-kicker">Racha</div>
    <div class="w-big">${w.best}</div>
    <div class="w-sub">${w.best === 1 ? 'victoria seguida como mejor racha.' : 'victorias seguidas como mejor racha.'}</div>
    ${Object.keys(w.badges).length ? `<div class="w-badges">${Object.entries(w.badges).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `<span>${BADGES[k].name}${n > 1 ? ` ×${n}` : ''}</span>`).join('')}</div>` : ''}` });

  slides.push({ cls: 'w-final', html: `
    <div class="w-kicker">${Su} carta</div>
    <div class="w-cardwrap">${playerCardHTML(w.card, { big: true })}</div>
    <div class="w-actions">
      <button class="btn-volt" onclick="event.stopPropagation(); shareWrappedImage(${jsArg(w.name)}, ${jsArg(w.key)})">Compartir el resumen</button>
      <button class="btn-icon" onclick="event.stopPropagation(); closeWrapped(); sharePlayerCard(${jsArg(w.name)})">Compartir la carta</button>
      <button class="btn-icon" onclick="event.stopPropagation(); wrapGo(0)">Ver de nuevo</button>
    </div>` });
  return slides;
}

function openWrapped(name, key) {
  if (!name) return;
  const w = computeWrapped(name, key);
  if (!w.PJ) { showToast('Todavía no hay partidos para el resumen'); return; }
  openStories(wrapSlides(w));
}

// Resumen como imagen vertical para historias (1080 × 1920)
function shareWrappedImage(name, key) {
  const w = computeWrapped(name, key);
  if (!w.PJ) return;
  closeWrapped();
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const parts = w.name.trim().split(/\s+/);
  const first = parts.length > 1 ? parts[0] : '';
  const surname = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  const diff = w.eloEnd - w.eloStart;
  const lines = [
    ['Victorias', `${w.V} de ${w.PJ} (${pct(w.V, w.PJ)} %)`],
    ['ELO', `${w.eloEnd} (${diff > 0 ? '+' : ''}${diff})`],
    ['Mejor racha', `${w.best} seguida${w.best === 1 ? '' : 's'}`],
    w.bestPartner ? ['Mejor pareja', shortName(w.bestPartner.name)] : null,
    w.topShot ? ['Golpe', wrapShotLabel(w.topShot[0])] : null,
    w.clutch[1] ? ['Bajo presión', `${pct(w.clutch[0], w.clutch[1])} %`] : null,
    w.titles.length ? ['Podios', String(w.titles.length)] : null
  ].filter(Boolean);
  openShareImage((ctx, W, H) => {
    const T = SHARE_THEME;
    ctx.fillStyle = T.bg1; ctx.fillRect(0, 0, W, H);
    drawLogoMark(ctx, 72, 92, 64, T.accent);
    ctx.textAlign = 'left'; ctx.fillStyle = T.text; ctx.font = 'italic 900 38px "Barlow Condensed", sans-serif';
    ctx.fillText('PADEL METRIC', 146, 140);
    ctx.textAlign = 'right'; ctx.fillStyle = T.muted; ctx.font = '600 30px "Barlow", sans-serif';
    ctx.fillText(w.label, W - 72, 140);
    ctx.textAlign = 'left';
    if (first) { ctx.fillStyle = 'rgba(245,247,250,0.8)'; ctx.font = '600 46px "Barlow", sans-serif'; ctx.fillText(first, 72, 300); }
    ctx.fillStyle = T.text; ctx.font = '700 150px "Barlow Condensed", sans-serif';
    ctx.fillText(fitText(ctx, surname.toUpperCase(), W - 144), 72, first ? 440 : 410);
    ctx.font = '700 250px "Barlow Condensed", sans-serif';
    ctx.fillText(String(w.PJ), 64, 710);
    ctx.fillStyle = T.muted; ctx.font = '600 42px "Barlow", sans-serif';
    ctx.fillText(w.PJ === 1 ? 'partido jugado' : 'partidos jugados', 72, 772);
    let y = 840;
    lines.forEach(([label, value]) => {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(72, y, W - 144, 2);
      ctx.textAlign = 'left'; ctx.fillStyle = T.muted; ctx.font = '500 36px "Barlow", sans-serif';
      ctx.fillText(label, 72, y + 58);
      ctx.textAlign = 'right'; ctx.fillStyle = T.text; ctx.font = '700 50px "Barlow Condensed", sans-serif';
      ctx.fillText(fitText(ctx, value, W - 520), W - 72, y + 60);
      y += 88;
    });
    ctx.textAlign = 'left';
    // Partidos por mes (solo en una temporada de un año y si queda sitio)
    const active = w.months.filter(m => m.pj).length;
    if (w.year && active >= 2 && H - 200 - y >= 240) {
      const top = y + 90, h = Math.min(240, H - 210 - top), step = (W - 144) / 12, bw = step * 0.56;
      const max = Math.max(1, ...w.months.map(m => m.pj));
      ctx.fillStyle = T.muted; ctx.font = '500 30px "Barlow", sans-serif';
      ctx.fillText('Partidos por mes; en blanco, las victorias', 72, top - 8);
      w.months.forEach((m, i) => {
        const x = 72 + i * step + (step - bw) / 2;
        const tot = m.pj ? Math.max(6, (m.pj / max) * h) : 3;
        const win = m.pj ? (m.v / m.pj) * tot : 0;
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.roundRect(x, top + h - tot, bw, tot, 4); ctx.fill();
        if (win) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(x, top + h - win, bw, win, 4); ctx.fill(); }
        ctx.fillStyle = T.muted; ctx.font = '600 26px "Barlow", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(WRAP_MONTHS[i], x + bw / 2, top + h + 40);
      });
      ctx.textAlign = 'left';
    }
  }, 'Resumen de temporada', { height: 1920 });
}

// Muestra una serie de pantallas tipo historia (resumen de temporada, bienvenida)
function openStories(slides, { auto = true, onClose = null } = {}) {
  closeAppMenu();
  const el = document.getElementById('wrapped');
  el.innerHTML = `
    <div class="w-bars">${slides.map(() => '<i><b></b></i>').join('')}</div>
    <button class="w-close" onclick="event.stopPropagation(); closeWrapped()" aria-label="Cerrar"><svg class="icon"><use href="#i-close"/></svg></button>
    <div class="w-stage"></div>`;
  el.classList.remove('hidden');
  wrapState = { slides, i: 0, t0: 0, elapsed: 0, paused: false, raf: null, auto, onClose };
  wrapGo(0);
  wrapState.raf = requestAnimationFrame(wrapTick);
}

function wrapGo(i) {
  if (!wrapState) return;
  const n = wrapState.slides.length;
  if (i >= n) { closeWrapped(); return; }
  wrapState.i = Math.max(0, i);
  wrapState.elapsed = 0;
  wrapState.t0 = performance.now();
  const s = wrapState.slides[wrapState.i];
  const stage = document.querySelector('#wrapped .w-stage');
  stage.className = `w-stage ${s.cls}`;
  stage.innerHTML = `<div class="w-slide">${s.html}</div>`;
  initCardTilt(stage);
  document.querySelectorAll('#wrapped .w-bars i').forEach((bar, k) => {
    bar.querySelector('b').style.width = k < wrapState.i ? '100%' : '0%';
  });
  vibrate(6);
}

function wrapTick(now) {
  if (!wrapState) return;
  if (!wrapState.paused) {
    const ms = wrapState.slides[wrapState.i].ms || WRAP_SLIDE_MS;
    const k = wrapState.auto ? Math.min(1, (wrapState.elapsed + now - wrapState.t0) / ms) : 1;
    const bar = document.querySelectorAll('#wrapped .w-bars i')[wrapState.i];
    if (bar) bar.querySelector('b').style.width = `${k * 100}%`;
    if (k >= 1 && wrapState.auto && wrapState.i < wrapState.slides.length - 1) wrapGo(wrapState.i + 1);
  }
  wrapState.raf = requestAnimationFrame(wrapTick);
}

function closeWrapped() {
  const done = wrapState && wrapState.onClose;
  if (wrapState) cancelAnimationFrame(wrapState.raf);
  wrapState = null;
  document.getElementById('wrapped').classList.add('hidden');
  if (done) done();
}

// ---------- Bienvenida (solo la primera vez) ----------
function maybeShowWelcome() {
  if (localStorage.getItem('pm_bienvenida_v1') || document.body.classList.contains('spectator-mode')) return;
  if (matchHistory.length || dbPlayers.length || localStorage.getItem('pm_partido_activo_v14')) {
    try { localStorage.setItem('pm_bienvenida_v1', '1'); } catch (e) {}
    return;
  }
  const done = () => { try { localStorage.setItem('pm_bienvenida_v1', '1'); } catch (e) {} };
  const feat = (title, text) => `<div class="wl-feat"><strong>${title}</strong><span>${text}</span></div>`;
  openStories([
    { cls: 'w-intro', html: `
      <svg class="w-logo"><use href="#logo-mark"/></svg>
      <div class="w-huge">Padel Metric</div>
      <div class="w-sub">Marcador y estadísticas para tus partidos de pádel. Todo se guarda en este móvil y no hace falta crear una cuenta.</div>
      <div class="w-foot">Toca la pantalla para seguir</div>` },
    { cls: 'w-matches', html: `
      <div class="w-name">Durante el partido</div>
      <div>
        ${feat('Marcador completo', 'Saque, bolas de break y de set, punto de oro, tie-break y súper tie-break.')}
        ${feat('Probabilidad de victoria', 'Se recalcula después de cada punto.')}
        ${feat('Directo', 'Un enlace o un QR para seguir el marcador desde otro móvil o en una tele.')}
      </div>` },
    { cls: 'w-shot', html: `
      <div class="w-name">Después</div>
      <div>
        ${feat('Mapa de calor', 'Dónde ganas y dónde pierdes los puntos: red, transición y fondo.')}
        ${feat('Ranking ELO', 'De jugadores y de parejas, con el cara a cara.')}
        ${feat('Americanos y torneos', 'Cruces, descansos y clasificación automáticos, también en directo.')}
      </div>` },
    { cls: 'w-final', html: `
      <div class="w-name">¿Cómo quieres empezar?</div>
      <div class="w-sub">Puedes ver la app con datos de ejemplo (jugadores del circuito profesional) y borrarlos después en Ajustes.</div>
      <div class="w-actions">
        <button class="btn-volt" onclick="event.stopPropagation(); closeWrapped(); switchMainTab('setup');">Empezar un partido</button>
        <button class="btn-icon" onclick="event.stopPropagation(); closeWrapped(); loadDemoData();">Ver con datos de ejemplo</button>
      </div>` }
  ], { auto: false, onClose: done });
}

// Toques: derecha avanza, izquierda vuelve, mantener pulsado pausa y deslizar hacia abajo cierra.
// Con teclado: flechas para moverse. Si la app pasa a segundo plano, la historia se detiene.
(() => {
  let downAt = 0, downY = 0;
  const pause = () => { if (wrapState && !wrapState.paused) { wrapState.paused = true; wrapState.elapsed += performance.now() - wrapState.t0; } };
  const resume = () => { if (wrapState && wrapState.paused) { wrapState.paused = false; wrapState.t0 = performance.now(); } };
  document.addEventListener('pointerdown', e => {
    if (!wrapState || !e.target.closest('#wrapped') || e.target.closest('button')) return;
    downAt = performance.now();
    downY = e.clientY;
    pause();
  });
  document.addEventListener('pointerup', e => {
    if (!wrapState || !downAt) return;
    const held = performance.now() - downAt;
    downAt = 0;
    resume();
    if (e.clientY - downY > 90) { closeWrapped(); return; }
    if (held < 250) wrapGo(wrapState.i + (e.clientX > window.innerWidth * 0.33 ? 1 : -1));
  });
  document.addEventListener('pointercancel', () => { downAt = 0; resume(); });
  document.addEventListener('keydown', e => {
    if (!wrapState) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); wrapGo(wrapState.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); wrapGo(wrapState.i - 1); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else resume(); });
})();

// Desde el menú: el resumen del perfil propio o, si aún no hay, elegir quién eres
function openMyWrapped() {
  if (myPlayerName && dbPlayers.includes(myPlayerName)) { openWrapped(myPlayerName); return; }
  openChooseMeSheet();
}
