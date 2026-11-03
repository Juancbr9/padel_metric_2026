// ==========================================================
// RESUMEN DEL PARTIDO CON IA: DATOS QUE SE ENVÍAN
// matchToAI(partido) resume el partido en un objeto pequeño (resultado, estadísticas de cada jugador y pareja,
// presión, probabilidad de victoria y momento clave) para la función resumen-partido de Supabase, que es la que
// habla con la IA. Solo van nombres y datos del juego. Funciona también con partidos sin registro punto a punto.
// ==========================================================
const AI_TYPE_NAMES = { W: 'golpe ganador', ENF: 'error no forzado', EF: 'error forzado', DF: 'doble falta', N: 'punto' };

function matchToAI(m) {
  if (!m || !m.players) return null;
  const sets = (m.sets || []).filter(s => s[0] + s[1] > 0);
  const pairName = k => livePairName(k, m);
  const hasPoints = Array.isArray(m.points) && m.points.length > 0;
  const press = hasPoints ? computePressureStats(m) : null;
  const ratio = (a, b) => (b ? `${a} de ${b} (${Math.round((a / b) * 100)} %)` : 'sin datos');
  // Golpes por jugador: del registro punto a punto si lo hay; si no, de los contadores del partido (solo nombres conocidos)
  const known = new Set([...SHOT_CATALOG.map(x => x.id), ...SHOT_CATALOG.map(x => x.group)]);
  const shotsOf = obj => Object.fromEntries(Object.entries(obj || {}).filter(([k, v]) => v > 0 && known.has(k)));
  const fromPoints = (name, types) => {
    const c = {};
    (m.points || []).forEach(pt => { if (pt.n === name && types.includes(pt.t) && pt.sh && pt.sh !== 'Winner') c[pt.sh] = (c[pt.sh] || 0) + 1; });
    return c;
  };

  const players = m.players.map((p, i) => ({
    nombre: p.isGeneric ? `Jugador ${i + 1}` : p.name,
    nombre_corto: p.isGeneric ? `Jugador ${i + 1}` : shortPlayerName(p.name, m.players.map(x => x.name)),
    pareja: i < 2 ? 1 : 2,
    lado: p.side || (i % 2 ? 'Revés' : 'Drive'),
    winners: p.W || 0,
    errores_no_forzados: p.ENF || 0,
    errores_forzados: p.EF || 0,
    saques_directos: p.aces || 0,
    dobles_faltas: p.df || 0,
    valoracion: Math.round(calcPlayerRating({ W: 0, ENF: 0, EF: 0, aces: 0, ...p }) * 10) / 10,
    golpes_ganadores: m.points && m.points.length ? fromPoints(p.name, ['W']) : shotsOf(p.shots),
    errores_no_forzados_por_golpe: m.points && m.points.length ? fromPoints(p.name, ['ENF']) : shotsOf(p.errShots)
  }));

  const pairs = [0, 1].map(k => {
    const base = { nombre: pairName(k), juegos_ganados: sets.reduce((a, s) => a + s[k], 0) };
    if (!press) return base;
    const st = press.pair[k];
    return {
      ...base,
      puntos_ganados: st.total,
      puntos_al_saque: ratio(st.serveWon, st.servePts),
      primer_saque: ratio(st.firstWon, st.first),
      segundo_saque: ratio(st.secondWon, st.second),
      puntos_al_resto: ratio(st.returnWon, st.returnPts),
      bolas_de_break_convertidas: ratio(st.bpWon, st.bpChances),
      bolas_de_break_salvadas: ratio(st.bpSaved, st.bpFaced),
      puntos_de_oro_ganados: st.goldPlayed ? ratio(st.goldWon, st.goldPlayed) : undefined,
      racha_maxima_de_puntos: st.maxRun
    };
  });

  const out = {
    fecha: m.date || '',
    duracion_minutos: Math.round((m.elapsedSec || 0) / 60) || undefined,
    reglas: {
      a_40_40: { adv: 'ventaja', star: 'star point', golden: 'punto de oro' }[m.deuceRule] || m.deuceRule || 'ventaja',
      tercer_set: m.thirdSetRule === 'supertb' ? 'súper tie-break' : 'set normal'
    },
    resultado: {
      ganadora: m.winnerPair === 0 || m.winnerPair === 1 ? pairName(m.winnerPair) : 'sin terminar',
      sets: sets.map((s, i) => `${i === 2 && m.thirdSetRule === 'supertb' ? 'Súper tie-break' : `Set ${i + 1}`}: ${s[0]}-${s[1]}`),
      nota: 'Los marcadores van como pareja 1 - pareja 2'
    },
    pareja_1: pairs[0],
    pareja_2: pairs[1],
    jugadores: players
  };

  if (hasPoints) {
    out.puntos_registrados = m.points.length;
    // Puntos ganados por cada pareja en cada set
    out.puntos_por_set = sets.map((_, si) => {
      const pts = m.points.filter(pt => pt.s === si);
      return `Set ${si + 1}: ${pts.filter(pt => pt.w === 0).length}-${pts.filter(pt => pt.w === 1).length}`;
    });
    if (press.clutchTop) out.mas_golpes_ganadores_en_puntos_decisivos = { jugador: press.clutchTop[0], cuantos: press.clutchTop[1] };
    const series = wpSeries(m);
    if (series) {
      const wps = series.map(s => s.wp);
      out.probabilidad_de_victoria_pareja_1 = {
        al_empezar: `${Math.round((m.wpStart ?? 0.5) * 100)} %`,
        minima: `${Math.round(Math.min(...wps) * 100)} %`,
        maxima: `${Math.round(Math.max(...wps) * 100)} %`
      };
      // Peor momento de la pareja ganadora (para contar una remontada)
      if (m.winnerPair === 0 || m.winnerPair === 1) {
        const own = series.map(x => (m.winnerPair === 0 ? x.wp : 1 - x.wp));
        let lo = 0;
        own.forEach((v, k) => { if (v < own[lo]) lo = k; });
        const ptLo = series[lo].i !== undefined ? m.points[series[lo].i] : null;
        if (ptLo && own[lo] < 0.35) {
          const after = m.points[series[lo].i + 1] || ptLo;
          out.peor_momento_de_la_ganadora = {
            probabilidad: `${Math.round(own[lo] * 100)} %`,
            set: (ptLo.s || 0) + 1,
            juegos_en_ese_set_tras_el_punto: Array.isArray(after.g) && after.s === ptLo.s ? `${after.g[0]}-${after.g[1]}` : undefined,
            sets_ya_jugados: sets.slice(0, ptLo.s || 0).map(x => `${x[0]}-${x[1]}`).join(' ') || 'ninguno'
          };
        }
      }
    }
  }
  return JSON.parse(JSON.stringify(out));
}

// ---------- Hoja "Resumen del partido" ----------
// Estadísticas al estilo de las del circuito profesional (se calculan en el móvil, gratis) y la crónica escrita por
// la IA (3 al mes por dispositivo; más, con la versión de pago). La crónica se guarda en el partido (m.aiSummary).
const AI_SUMMARY_URL = `${DEFAULT_SUPABASE_URL}/functions/v1/resumen-partido`;
const AI_FREE_PER_MONTH = 3;
let aiSummaryTarget = null, aiSummaryBusy = false;

function aiDeviceId() {
  let id = null;
  try { id = localStorage.getItem('pm_dispositivo_v1'); } catch (e) {}
  if (!id || !/^[a-z0-9]{16,64}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => (b % 36).toString(36)).join('') + Date.now().toString(36);
    try { localStorage.setItem('pm_dispositivo_v1', id); } catch (e) {}
  }
  return id;
}

// Filas de estadísticas: [etiqueta, valor pareja 1, valor pareja 2, número 1, número 2, menos es mejor]
function proStatsRows(m) {
  const sum = (k, pair) => m.players.slice(pair * 2, pair * 2 + 2).reduce((a, p) => a + (p[k] || 0), 0);
  const sets = (m.sets || []).filter(s => s[0] + s[1] > 0);
  const rows = [];
  const pctTxt = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : '–');
  const pctNum = (a, b) => (b ? a / b : 0);
  if (Array.isArray(m.points) && m.points.length) {
    const { pair } = computePressureStats(m);
    const [a, b] = pair;
    rows.push(['Puntos ganados', a.total, b.total, a.total, b.total]);
    rows.push(['Puntos ganados con el 1.er saque', pctTxt(a.firstWon, a.first), pctTxt(b.firstWon, b.first), pctNum(a.firstWon, a.first), pctNum(b.firstWon, b.first)]);
    rows.push(['Puntos ganados con el 2.º saque', pctTxt(a.secondWon, a.second), pctTxt(b.secondWon, b.second), pctNum(a.secondWon, a.second), pctNum(b.secondWon, b.second)]);
    rows.push(['Puntos ganados al resto', pctTxt(a.returnWon, a.returnPts), pctTxt(b.returnWon, b.returnPts), pctNum(a.returnWon, a.returnPts), pctNum(b.returnWon, b.returnPts)]);
    rows.push(['Bolas de break convertidas', `${a.bpWon}/${a.bpChances}`, `${b.bpWon}/${b.bpChances}`, pctNum(a.bpWon, a.bpChances), pctNum(b.bpWon, b.bpChances)]);
    if (a.goldPlayed) rows.push(['Puntos de oro ganados', `${a.goldWon}/${a.goldPlayed}`, `${b.goldWon}/${b.goldPlayed}`, a.goldWon, b.goldWon]);
    rows.push(['Racha más larga de puntos', a.maxRun, b.maxRun, a.maxRun, b.maxRun]);
  } else {
    const g = [0, 1].map(k => sets.reduce((acc, s) => acc + s[k], 0));
    rows.push(['Juegos ganados', g[0], g[1], g[0], g[1]]);
  }
  rows.push(['Winners', sum('W', 0), sum('W', 1), sum('W', 0), sum('W', 1)]);
  rows.push(['Errores no forzados', sum('ENF', 0), sum('ENF', 1), sum('ENF', 0), sum('ENF', 1), true]);
  if (sum('aces', 0) + sum('aces', 1)) rows.push(['Saques directos', sum('aces', 0), sum('aces', 1), sum('aces', 0), sum('aces', 1)]);
  if (sum('df', 0) + sum('df', 1)) rows.push(['Dobles faltas', sum('df', 0), sum('df', 1), sum('df', 0), sum('df', 1), true]);
  return rows;
}

function proStatsHTML(m) {
  return proStatsRows(m).map(([label, va, vb, a, b, low]) => {
    const tot = Math.abs(a) + Math.abs(b) || 1;
    const better = a === b ? 0 : (low ? a < b : a > b) ? 1 : 2;
    return `<div class="h2h-metric">
      <div class="h2h-mhead"><strong class="${better === 1 ? 'lead' : ''}">${escapeHtml(String(va))}</strong><span>${label}</span><strong class="${better === 2 ? 'lead' : ''}">${escapeHtml(String(vb))}</strong></div>
      <div class="h2h-track"><i class="a" style="flex-basis:${(Math.abs(a) / tot) * 100}%"></i><i class="b"></i></div>
    </div>`;
  }).join('');
}

function aiSummaryMatch() {
  const t = aiSummaryTarget;
  if (!t) return null;
  return t.kind === 'live' ? state : matchHistory.find(m => m && String(m.id) === String(t.id)) || null;
}

function openMatchSummary(kind, idOrIdx) {
  const m = kind === 'live' ? state : (typeof idOrIdx === 'number' ? matchHistory[idOrIdx] : matchHistory.find(x => String(x.id) === String(idOrIdx)));
  if (!m || !m.players) return;
  aiSummaryTarget = { kind, id: m.id };
  renderMatchSummary();
}

function renderMatchSummary(error = '') {
  const m = aiSummaryMatch();
  if (!m) return;
  const sets = (m.sets || []).filter(s => s[0] + s[1] > 0).map(s => `${s[0]}-${s[1]}`).join('  ');
  const ai = m.aiSummary;
  const [title, ...rest] = ai ? String(ai.texto).split('\n') : [];
  const body = rest.join('\n').trim().split(/\n\s*\n/).map(par => `<p>${escapeHtml(par).replace(/\n/g, '<br>')}</p>`).join('');
  openEventModal(`
    <div class="mo-title">Resumen del partido</div>
    <div class="ai-head">
      <div class="ai-pair a"><i></i>${escapeHtml(livePairName(0, m))}</div>
      <div class="ai-pair b"><i></i>${escapeHtml(livePairName(1, m))}</div>
      <div class="ai-score">${escapeHtml(sets)}${m.date ? ` · ${escapeHtml(m.date)}` : ''}</div>
    </div>
    ${ai ? `<div class="ai-text"><h3>${escapeHtml(title)}</h3>${body}</div>` : `
      <div class="ai-cta">
        <p>La crónica del partido escrita a partir de sus estadísticas, lista para compartir con tu grupo.</p>
        <button type="button" class="btn-volt btn-block" id="ai-go" onclick="generateAiSummary()" ${aiSummaryBusy ? 'disabled' : ''}>${aiSummaryBusy ? 'Escribiendo la crónica…' : 'Escribir la crónica'}</button>
        <small>${AI_FREE_PER_MONTH} crónicas gratis al mes. Más, con la versión Pro.</small>
        ${error ? `<p class="ai-error">${escapeHtml(error)}</p>` : ''}
      </div>`}
    <div class="menu-group-title">Estadísticas</div>
    <div class="ai-stats">${proStatsHTML(m)}</div>
    <div class="u-grid-2 mt-14">
      <button type="button" class="btn-icon" onclick="copyMatchSummary()">Copiar</button>
      <button type="button" class="btn-icon" onclick="shareMatchSummary()">Compartir</button>
    </div>`);
}

async function generateAiSummary() {
  const m = aiSummaryMatch();
  if (!m || aiSummaryBusy) return;
  if (!navigator.onLine) { renderMatchSummary('Sin conexión. La crónica se escribe en internet: prueba cuando tengas cobertura.'); return; }
  aiSummaryBusy = true;
  renderMatchSummary();
  let error = '';
  try {
    const r = await fetch(AI_SUMMARY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: DEFAULT_SUPABASE_KEY },
      body: JSON.stringify({ device: aiDeviceId(), match: matchToAI(m) })
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.texto) {
      m.aiSummary = { texto: d.texto, at: Date.now() };
      const h = matchHistory.find(x => x && x.id === m.id);
      if (h && h !== m) h.aiSummary = m.aiSummary;
      if (m === state) persistActiveMatchState();
      saveDB();
      const left = Number(d.restantes);
      showToast(left >= 0 && left < AI_FREE_PER_MONTH ? `Crónica lista. Te quedan ${left} este mes` : 'Crónica lista');
    } else if (r.status === 429 && d.restantes === 0) {
      error = `Has usado las ${AI_FREE_PER_MONTH} crónicas gratis de este mes. Con la versión Pro tendrás crónicas ilimitadas.`;
    } else {
      error = d.error || 'No se ha podido escribir la crónica. Inténtalo de nuevo en un momento.';
    }
  } catch (e) {
    error = 'No se ha podido conectar. Inténtalo de nuevo en un momento.';
  }
  aiSummaryBusy = false;
  if (aiSummaryMatch()) renderMatchSummary(error);
}

function matchSummaryText(m) {
  const lines = [];
  if (m.aiSummary) lines.push(m.aiSummary.texto.trim(), '');
  const sets = (m.sets || []).filter(s => s[0] + s[1] > 0).map(s => `${s[0]}-${s[1]}`).join(' ');
  lines.push(`${livePairName(0, m)} ${sets} ${livePairName(1, m)}`, '');
  proStatsRows(m).forEach(([label, a, b]) => lines.push(`${label}: ${a} - ${b}`));
  lines.push('', `Hecho con Padel Metric · ${appPublicUrl()}`);
  return lines.join('\n');
}

async function copyMatchSummary() {
  const m = aiSummaryMatch();
  if (!m) return;
  try { await navigator.clipboard.writeText(matchSummaryText(m)); showToast('Resumen copiado'); } catch (e) { showToast('No se ha podido copiar'); }
}

async function shareMatchSummary() {
  const m = aiSummaryMatch();
  if (!m) return;
  const text = matchSummaryText(m);
  if (navigator.share) { try { await navigator.share({ text, title: 'Resumen del partido' }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  copyMatchSummary();
}
