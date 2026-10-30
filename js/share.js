// ==========================================================
// COMPARTIR CLASIFICACIONES Y CUADROS COMO IMAGEN (WHATSAPP)
// ==========================================================
const SHARE_THEME = {
  bg1: '#030508', bg2: '#030508', accent: '#D4FF2A', accentDeep: '#B8E000', text: '#F5F7FA', muted: '#8B95A5',
  row: 'rgba(255,255,255,0.04)', rowAlt: 'rgba(255,255,255,0.075)', gold: '#F5C04A', silver: '#CBD5E1', bronze: '#D08A4E'
};

// Logo "P." dibujado en el lienzo (misma geometría que assets/logo.svg)
function drawLogoMark(ctx, x, y, size, color) {
  const s = size / 380;
  const off = document.createElement('canvas');
  off.width = Math.ceil(340 * s);
  off.height = Math.ceil(380 * s);
  const c = off.getContext('2d');
  c.scale(s, s);
  c.translate(-96, -60);
  c.fillStyle = color;
  c.beginPath(); c.arc(280, 198, 122, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.roundRect(138, 96, 70, 330, 35); c.fill();
  c.globalCompositeOperation = 'destination-out';
  const step = 36;
  for (let j = -3; j <= 3; j++) {
    const yy = 198 + j * step * 0.866;
    for (let i = -8; i <= 8; i++) {
      const xx = 292 + i * step + (j % 2 ? step / 2 : 0);
      if ((xx - 292) ** 2 + (yy - 198) ** 2 <= 78 * 78 && xx > 205) { c.beginPath(); c.arc(xx, yy, 10.5, 0, Math.PI * 2); c.fill(); }
    }
  }
  c.globalCompositeOperation = 'source-over';
  c.beginPath(); c.arc(372, 388, 38, 0, Math.PI * 2); c.fill();
  ctx.drawImage(off, x, y);
}

function fitText(ctx, text, maxWidth) {
  let t = String(text);
  if (ctx.measureText(t).width <= maxWidth) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

function drawShareFrame(ctx, W, H, { kicker, title, subtitle }) {
  // Fondo plano (DESIGN.md): sin degradados ni halos
  ctx.fillStyle = SHARE_THEME.bg1;
  ctx.fillRect(0, 0, W, H);

  drawLogoMark(ctx, 64, 60, 70, SHARE_THEME.accent);
  ctx.fillStyle = SHARE_THEME.text;
  ctx.font = 'italic 900 40px "Barlow Condensed", sans-serif';
  ctx.fillText('PADEL METRIC', 140, 112);

  ctx.fillStyle = SHARE_THEME.accent;
  ctx.font = '800 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(kicker.toUpperCase(), 64, 200);
  ctx.fillStyle = SHARE_THEME.text;
  ctx.font = '700 78px "Barlow Condensed", sans-serif';
  ctx.fillText(fitText(ctx, title.toUpperCase(), W - 128), 64, 280);
  if (subtitle) {
    ctx.fillStyle = SHARE_THEME.muted;
    ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(fitText(ctx, subtitle, W - 128), 64, 324);
  }
  ctx.fillStyle = SHARE_THEME.muted;
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }), W - 64, 112);
  ctx.textAlign = 'left';
}

// Tabla genérica: columnas = [{ label, width, align }]; filas = arrays de textos
function drawShareTable(ctx, x, y, width, maxBottom, { title, columns, rows, medals = true, highlight = 0 }) {
  if (title) {
    ctx.fillStyle = SHARE_THEME.accent;
    ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(title.toUpperCase(), x, y);
    y += 22;
  }
  const rowH = Math.max(40, Math.min(64, Math.floor((maxBottom - y - 50) / Math.max(1, rows.length))));
  ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = SHARE_THEME.muted;
  let cx = x + 70;
  columns.forEach(col => {
    ctx.textAlign = col.align || 'left';
    ctx.fillText(col.label.toUpperCase(), col.align === 'right' ? cx + col.width : cx, y + 26);
    cx += col.width;
  });
  ctx.textAlign = 'left';
  y += 44;
  const medalColors = [SHARE_THEME.gold, SHARE_THEME.silver, SHARE_THEME.bronze];
  rows.forEach((row, i) => {
    const top = y + i * rowH;
    ctx.fillStyle = i < highlight ? 'rgba(212,255,42,0.12)' : (i % 2 ? SHARE_THEME.rowAlt : SHARE_THEME.row);
    ctx.beginPath(); ctx.roundRect(x, top + 3, width, rowH - 6, 14); ctx.fill();
    const mid = top + rowH / 2 + 9;
    if (medals && i < 3) {
      ctx.fillStyle = medalColors[i];
      ctx.beginPath(); ctx.arc(x + 34, top + rowH / 2, Math.min(18, rowH / 2 - 8), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0B0718';
    } else {
      ctx.fillStyle = SHARE_THEME.muted;
    }
    ctx.font = `800 ${Math.min(26, rowH * 0.42)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x + 34, mid);
    let colX = x + 70;
    row.forEach((cell, ci) => {
      const col = columns[ci];
      ctx.textAlign = col.align || 'left';
      ctx.fillStyle = ci === row.length - 1 ? SHARE_THEME.accent : SHARE_THEME.text;
      ctx.font = ci === 0 ? `800 ${Math.min(34, rowH * 0.52)}px "Barlow Condensed", sans-serif` : `700 ${Math.min(26, rowH * 0.42)}px "JetBrains Mono", monospace`;
      const text = ci === 0 ? fitText(ctx, String(cell).toUpperCase(), col.width - 16) : String(cell);
      ctx.fillText(text, col.align === 'right' ? colX + col.width : colX, mid);
      colX += col.width;
    });
    ctx.textAlign = 'left';
  });
  return y + rows.length * rowH + 16;
}

function openShareImage(drawFn, title) {
  const canvas = document.getElementById('poster-canvas');
  const ctx = canvas.getContext('2d');
  drawFn(ctx, canvas.width, canvas.height);
  ctx.fillStyle = SHARE_THEME.muted;
  ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Generado con Padel Metric', canvas.width / 2, canvas.height - 36);
  ctx.textAlign = 'left';
  document.getElementById('poster-preview').src = canvas.toDataURL('image/png');
  document.getElementById('poster-modal-title').innerText = title;
  document.getElementById('poster-modal').classList.remove('hidden');
}

// ---------- Americano / Mexicano / Pozo ----------
function shareAmericanoImage(aid) {
  const ev = findAmericano(aid);
  const st = americanoStandings(ev).slice(0, 16);
  const unit = scoreUnit(ev) === 'puntos' ? 'Pts' : 'Juegos';
  const done = ev.rounds.filter(roundComplete).length;
  openShareImage((ctx, W, H) => {
    drawShareFrame(ctx, W, H, {
      kicker: `${AMERICANO_FORMATS[ev.format].main} · ${ev.status === 'finished' ? 'Clasificación final' : `Tras la ronda ${done} de ${ev.totalRounds}`}`,
      title: ev.name,
      subtitle: `${ev.players.length} jugadores · ${ev.courts} pista${ev.courts > 1 ? 's' : ''} · ${matchTypeLabel(matchTypeOf(ev))}`
    });
    drawShareTable(ctx, 60, 400, W - 120, H - 80, {
      columns: [{ label: isTeamFormat(ev) ? 'Pareja' : 'Jugador', width: 500 }, { label: 'PJ', width: 90, align: 'right' }, { label: 'G', width: 90, align: 'right' }, { label: 'Dif', width: 100, align: 'right' }, { label: unit, width: 100, align: 'right' }],
      rows: st.map(r => [r.members.map(shortName).join(' / '), r.pj, r.w, (r.diff > 0 ? '+' : '') + r.diff, r.pts])
    });
  }, 'Compartir clasificación');
}

// ---------- Torneos ----------
function shareTournamentImage(tid) {
  const t = findTournament(tid);
  const played = t.matches.filter(m => m.winner && !m.bye).length;
  const subtitle = `${t.teams.length} parejas · ${played} partidos jugados`;
  openShareImage((ctx, W, H) => {
    drawShareFrame(ctx, W, H, { kicker: `${TOURNAMENT_FORMATS[t.format].main}${t.champion ? ' · Campeones' : ' · En juego'}`, title: t.name, subtitle });
    let y = 380;
    if (t.champion) {
      ctx.fillStyle = SHARE_THEME.accent;
      ctx.beginPath(); ctx.roundRect(60, y, W - 120, 120, 22); ctx.fill();
      ctx.fillStyle = '#06090F';
      ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('CAMPEONES', 96, y + 42);
      ctx.font = '700 52px "Barlow Condensed", sans-serif';
      ctx.fillText(fitText(ctx, teamById(t, t.champion).players.join(' / ').toUpperCase(), W - 200), 96, y + 96);
      y += 160;
    }
    const cols = [{ label: 'Pareja', width: 520 }, { label: 'PJ', width: 80, align: 'right' }, { label: 'PG', width: 80, align: 'right' }, { label: 'Sets', width: 100, align: 'right' }, { label: 'Pts', width: 100, align: 'right' }];
    const tableRows = rows => rows.map(r => [teamName(t, r.id), r.pj, r.pg, (r.setDiff > 0 ? '+' : '') + r.setDiff, r.pts]);
    if (t.format === 'league') {
      drawShareTable(ctx, 60, y + 20, W - 120, H - 80, { columns: cols, rows: tableRows(tournamentStandings(t, t.matches, t.teams.map(x => x.id))) });
    } else if (t.format === 'groups' && !t.koBuilt) {
      const per = (H - 80 - y) / t.groups.length;
      t.groups.forEach((g, gi) => {
        drawShareTable(ctx, 60, y + 20 + gi * per, W - 120, y + (gi + 1) * per, {
          title: `Grupo ${g.name}`, columns: cols, medals: false, highlight: 2,
          rows: tableRows(tournamentStandings(t, t.matches.filter(m => m.group === g.name), g.teamIds))
        });
      });
    } else {
      // Cuadro: resultados por ronda, de la final hacia atrás
      ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
      for (let r = t.koRounds - 1; r >= 0 && y < H - 140; r--) {
        const ms = t.matches.filter(m => m.stage === 'ko' && m.round === r && !m.bye && m.a && m.b);
        if (!ms.length) continue;
        ctx.fillStyle = SHARE_THEME.accent;
        ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(koRoundName(t.koRounds, r).toUpperCase(), 64, y + 30);
        y += 46;
        ms.forEach(m => {
          if (y > H - 120) return;
          const sets = (m.sets || []).map(s => `${s[0]}-${s[1]}`).join('  ') || 'Pendiente';
          ctx.fillStyle = SHARE_THEME.row;
          ctx.beginPath(); ctx.roundRect(60, y, W - 120, 62, 14); ctx.fill();
          const name = (id) => teamName(t, id).toUpperCase();
          ctx.font = '800 28px "Barlow Condensed", sans-serif';
          ctx.fillStyle = m.winner === m.a ? SHARE_THEME.text : SHARE_THEME.muted;
          ctx.fillText(fitText(ctx, name(m.a), 330), 84, y + 41);
          ctx.fillStyle = SHARE_THEME.muted;
          ctx.fillText('vs', 430, y + 41);
          ctx.fillStyle = m.winner === m.b ? SHARE_THEME.text : SHARE_THEME.muted;
          ctx.fillText(fitText(ctx, name(m.b), 330), 470, y + 41);
          ctx.fillStyle = SHARE_THEME.accent;
          ctx.font = '700 24px "JetBrains Mono", monospace';
          ctx.textAlign = 'right';
          ctx.fillText(sets, W - 84, y + 40);
          ctx.textAlign = 'left';
          y += 72;
        });
        y += 10;
      }
    }
  }, 'Compartir torneo');
}
