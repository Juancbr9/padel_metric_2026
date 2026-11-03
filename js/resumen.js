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
  const pairName = k => `${m.players[k * 2].name} / ${m.players[k * 2 + 1].name}`;
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
    pareja: i < 2 ? 1 : 2,
    lado: p.side || (i % 2 ? 'Revés' : 'Drive'),
    winners: p.W || 0,
    errores_no_forzados: p.ENF || 0,
    errores_forzados: p.EF || 0,
    saques_directos: p.aces || 0,
    dobles_faltas: p.df || 0,
    valoracion: Math.round(calcPlayerRating({ W: 0, ENF: 0, EF: 0, aces: 0, ...p }) * 10) / 10,
    golpes_ganadores: m.points && m.points.length ? fromPoints(p.name, ['W']) : shotsOf(p.shots),
    errores_por_golpe: m.points && m.points.length ? fromPoints(p.name, ['ENF', 'EF']) : shotsOf(p.errShots)
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
      const km = wpKeyMoment(m);
      if (km && km.point) {
        const pt = km.point;
        out.momento_clave = {
          set: (pt.s || 0) + 1,
          juegos_antes_del_punto: Array.isArray(pt.g) ? `${pt.g[0]}-${pt.g[1]}` : undefined,
          marcador_del_juego: Array.isArray(pt.pl) ? `${pt.pl[0]}-${pt.pl[1]}` : undefined,
          gana_el_punto: pairName(pt.w),
          jugador: pt.n || undefined,
          como: [AI_TYPE_NAMES[pt.t] || '', pt.sh && pt.sh !== 'Winner' ? pt.sh : ''].filter(Boolean).join(' de ') || undefined,
          tipo_de_punto: pt.bp ? 'bola de break' : pt.gp ? 'punto de oro' : pt.tb ? 'tie-break' : undefined,
          cambio_de_probabilidad: `${km.swing > 0 ? '+' : ''}${Math.round(km.swing * 100)} puntos para la pareja 1`
        };
      }
    }
  }
  return JSON.parse(JSON.stringify(out));
}
