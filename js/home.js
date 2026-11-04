// ==========================================================
// PÁGINA DE INICIO: RESUMEN Y ACCESOS RÁPIDOS
// ==========================================================
function pausedMatchSummary() {
  try {
    const saved = JSON.parse(localStorage.getItem('pm_partido_activo_v14') || 'null');
    if (!saved || saved.matchOver || !saved.players) return null;
    const p = saved.players;
    const score = saved.sets.slice(0, saved.currentSet + 1).map(s => `${s[0]}-${s[1]}`).join(' ');
    return { label: `${pairLabel([p[0].name, p[1].name])} vs ${pairLabel([p[2].name, p[3].name])}`, score };
  } catch (e) {
    return null;
  }
}

function nextTournamentMatch(t) {
  return t.matches.find(m => m.a && m.b && !m.winner);
}

function homeSectionHTML(title, link = '', action = '') {
  return `<div class="home-section"><h2>${title}</h2>${link ? `<button type="button" class="home-link" onclick="${action}">${link} ›</button>` : ''}</div>`;
}

function renderHome() {
  const box = document.getElementById('view-home');
  if (!box) return;
  const paused = pausedMatchSummary();
  const activeT = tournaments.filter(t => t.status !== 'finished');
  const activeA = americanos.filter(a => a.status !== 'finished');
  const last = matchHistory[0];
  const { statsMap } = computeAllPlayersStats();
  const top = Object.values(statsMap).filter(s => s.PJ > 0).sort((a, b) => b.elo - a.elo).slice(0, 3);
  const isEmpty = !matchHistory.length && !tournaments.length && !americanos.length && !dbPlayers.length;

  const live = [
    ...activeT.slice(0, 3).map(t => {
      const nm = nextTournamentMatch(t);
      return `
        <button type="button" class="home-live" data-section="events" onclick="openTournament(${jsArg(t.id)})">
          <span class="home-live-kind">Torneo · ${TOURNAMENT_FORMATS[t.format].main}${t.live && t.live.on ? ' · en directo' : ''}</span>
          <span class="home-live-title">${escapeHtml(t.name)}</span>
          <span class="home-live-sub">${nm ? `Siguiente: ${escapeHtml(teamName(t, nm.a))} contra ${escapeHtml(teamName(t, nm.b))}` : 'Esperando resultados'}</span>
        </button>`;
    }),
    ...activeA.slice(0, 3).map(ev => `
      <button type="button" class="home-live" data-section="events" onclick="switchMainTab('americano'); openAmericano(${jsArg(ev.id)})">
        <span class="home-live-kind">${AMERICANO_FORMATS[ev.format].main}${ev.live && ev.live.on ? ' · en directo' : ''}</span>
        <span class="home-live-title">${escapeHtml(ev.name)}</span>
        <span class="home-live-sub">Ronda ${Math.min(ev.rounds.filter(roundComplete).length + 1, ev.totalRounds)} de ${ev.totalRounds} · ${ev.players.length} jugadores</span>
      </button>`)
  ].join('');

  // Último partido con el mismo aspecto que en el historial
  const lastCard = last ? `
    <div class="hm-card home-last">
      <div class="hm-top"><span class="hm-date">${escapeHtml(last.date || '')}</span></div>
      ${historyPairRow(last, 0)}${historyPairRow(last, 1)}
      <div class="hm-foot"><button type="button" class="hm-open" onclick="openHistoryMatchStats(0)">Ver estadísticas ›</button></div>
    </div>` : '';

  const topList = top.length ? `
    <div class="home-list">
      ${top.map((st, i) => `
        <button type="button" class="home-row" onclick="openPlayerProfile(${jsArg(st.name)})">
          <span class="home-row-pos">${i + 1}</span>
          ${renderAvatarHTML(st.name, 'avatar-sm')}
          <span class="home-row-name">${escapeHtml(st.name)}</span>
          <span class="home-row-val">${st.elo}<small>ELO</small></span>
        </button>`).join('')}
    </div>` : '';

  const primary = paused ? `
    <div class="home-resume">
      <div class="home-resume-text">
        <small><span class="live-dot"></span>Partido en pausa</small>
        <strong>${escapeHtml(paused.label)}</strong>
        <span>${escapeHtml(paused.score)}</span>
      </div>
      <button type="button" class="btn-volt" onclick="resumeSavedActiveMatch()">Continuar</button>
    </div>
    <button type="button" class="btn-icon btn-block home-new" onclick="switchMainTab('setup')">Nuevo partido</button>`
    : `<button type="button" class="btn-volt home-cta" onclick="switchMainTab('setup')">Nuevo partido</button>`;

  box.innerHTML = `
    <h1 class="sr-only">Inicio</h1>
    ${primary}
    ${installBannerHTML() || backupReminderHTML() || chooseMeBannerHTML()}
    ${myHomeCardHTML(statsMap)}
    ${live ? `${homeSectionHTML('En juego')}<div class="home-live-list">${live}</div>` : ''}
    ${lastCard ? `${homeSectionHTML('Último partido', 'Historial', "switchMainTab('history')")}${lastCard}` : ''}
    ${topList ? `${homeSectionHTML('Ranking', 'Ver todo', "switchMainTab('ranking')")}${topList}` : ''}
    ${isEmpty ? `
      <div class="home-empty">
        <h2>Para empezar</h2>
        <ol class="home-steps">
          <li><span>Pulsa <strong>Nuevo partido</strong>, elige a los cuatro jugadores (o déjalos sin nombre) y anota punto a punto.</span></li>
          <li><span>Al terminar tendrás el mapa de calor, los puntos clave y la probabilidad de victoria de cada momento.</span></li>
          <li><span>Para jugar con más gente, crea un <strong>americano</strong> o un <strong>torneo</strong> desde el menú.</span></li>
        </ol>
        <button class="btn-icon btn-block mt-14" onclick="loadDemoData()">Ver la app con datos de ejemplo</button>
      </div>` : ''}`;
  initCardTilt(box);
}
