// ==========================================================
// PÁGINA DE INICIO: RESUMEN Y ACCESOS RÁPIDOS
// ==========================================================
function greetingText() {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 14) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

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

function homeQuickAction(tab, section, icon, title, sub) {
  return `
    <button type="button" class="home-action" data-section="${section}" onclick="switchMainTab('${tab}')">
      <svg class="icon icon-lg"><use href="#${icon}"/></svg>
      <span class="home-action-title">${title}</span>
      <span class="home-action-sub">${sub}</span>
    </button>`;
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
  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = matchHistory.filter(m => (m.id || 0) >= weekAgo).length;
  const hours = matchHistory.reduce((a, m) => a + (m.elapsedSec || 0), 0) / 3600;
  const isEmpty = !matchHistory.length && !tournaments.length && !americanos.length && !dbPlayers.length;
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const live = [
    ...activeT.slice(0, 3).map(t => {
      const nm = nextTournamentMatch(t);
      return `
        <button type="button" class="home-live" data-section="events" onclick="openTournament(${jsArg(t.id)})">
          <span class="home-live-kind">Torneo · ${TOURNAMENT_FORMATS[t.format].main}</span>
          <span class="home-live-title">${escapeHtml(t.name)}</span>
          <span class="home-live-sub">${nm ? `Siguiente: ${escapeHtml(teamName(t, nm.a))} vs ${escapeHtml(teamName(t, nm.b))}` : 'Esperando resultados'}</span>
        </button>`;
    }),
    ...activeA.slice(0, 3).map(ev => `
      <button type="button" class="home-live" data-section="events" onclick="switchMainTab('americano'); openAmericano(${jsArg(ev.id)})">
        <span class="home-live-kind">${AMERICANO_FORMATS[ev.format].main}</span>
        <span class="home-live-title">${escapeHtml(ev.name)}</span>
        <span class="home-live-sub">Ronda ${Math.min(ev.rounds.filter(roundComplete).length + 1, ev.totalRounds)} de ${ev.totalRounds} · ${ev.players.length} jugadores</span>
      </button>`)
  ].join('');

  const lastCard = last ? `
    <button type="button" class="home-card home-last" onclick="openHistoryMatchStats(0)">
      <div class="home-card-head"><span>Último partido</span><small>${escapeHtml(last.date || '')}</small></div>
      ${[0, 1].map(pi => `
        <div class="home-last-row ${last.winnerPair === pi ? 'won' : ''}">
          <span>${escapeHtml(pairLabel([last.players[pi * 2].name, last.players[pi * 2 + 1].name]))}</span>
          <span class="home-last-sets">${last.sets.filter(s => s[0] + s[1] > 0).map(s => `<i>${s[pi]}</i>`).join('')}</span>
        </div>`).join('')}
    </button>` : '';

  const topCard = top.length ? `
    <button type="button" class="home-card" data-section="ranking" onclick="switchMainTab('ranking')">
      <div class="home-card-head"><span>Ranking ELO</span><small>Ver todo ›</small></div>
      ${top.map((st, i) => `
        <div class="home-top-row">
          <span class="home-top-pos">${i + 1}</span>
          ${renderAvatarHTML(st.name, 'avatar-p1', 'width:28px;height:28px;font-size:0.7rem;')}
          <span class="home-top-name">${escapeHtml(st.name)}</span>
          <span class="home-top-elo" data-count="${st.elo}">${st.elo}</span>
        </div>`).join('')}
    </button>` : '';

  box.innerHTML = `
    <div class="home-hero">
      <svg class="home-hero-mark"><use href="#logo-mark"/></svg>
      <div class="home-hero-date">${today}</div>
      <div class="home-hero-title">${greetingText()}${myPlayerName && dbPlayers.includes(myPlayerName) ? `, ${escapeHtml(myPlayerName.split(' ')[0])}` : ''}</div>
      <div class="home-hero-stats">
        <div><strong data-count="${matchHistory.length}">0</strong><span>partidos</span></div>
        <div><strong data-count="${thisWeek}">0</strong><span>esta semana</span></div>
        <div><strong ${hours >= 1 ? `data-count="${hours.toFixed(1)}" data-dec="1" data-suffix=" h"` : `data-count="${Math.round(hours * 60)}" data-suffix=" min"`}>0</strong><span>en pista</span></div>
        <div><strong data-count="${dbPlayers.length}">0</strong><span>jugadores</span></div>
      </div>
    </div>

    ${myHomeCardHTML(statsMap)}

    ${paused ? `
      <button type="button" class="home-resume" onclick="resumeSavedActiveMatch()">
        <span class="live-dot"></span>
        <span class="home-resume-text"><small>Partido en pausa · ${escapeHtml(paused.score)}</small><strong>${escapeHtml(paused.label)}</strong></span>
        <span class="home-resume-cta">Continuar</span>
      </button>` : ''}

    <div class="home-actions">
      ${homeQuickAction('setup', 'match', 'i-ball', 'Partido', 'Marcador en directo')}
      ${homeQuickAction('tournaments', 'events', 'i-bracket', 'Torneo', 'Cuadro, liga o grupos')}
      ${homeQuickAction('americano', 'events', 'i-shuffle', 'Americano', 'Americano, Mexicano y Pozo')}
      ${homeQuickAction('ranking', 'ranking', 'i-trophy', 'Ranking', 'ELO y jugadores')}
    </div>

    ${live ? `<div class="home-section-title">En juego</div><div class="home-live-list">${live}</div>` : ''}
    ${lastCard || topCard ? `<div class="home-section-title">Resumen</div>${lastCard}${topCard}` : ''}

    ${isEmpty ? `
      <div class="home-card home-welcome">
        <div class="home-card-head"><span>Primeros pasos</span></div>
        <ol>
          <li>Crea jugadores en <strong>Ranking</strong> o directamente al preparar un partido.</li>
          <li>Juega un <strong>partido</strong> y registra los golpes: verás el mapa de calor y los puntos clave.</li>
          <li>Organiza un <strong>torneo</strong> o un <strong>americano</strong> con tus amigos.</li>
        </ol>
        <button class="btn-icon" style="width:100%;padding:12px;color:var(--volt);" onclick="loadDemoData()">Cargar datos de ejemplo</button>
      </div>` : ''}`;
  initCardTilt(box);
}
