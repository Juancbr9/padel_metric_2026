// ==========================================================
// PÓSTER HD PARA WHATSAPP (CON AVATARES CIRCULARES Y SIN DRIVE / REVÉS)
// ==========================================================
function openPosterModal() {
  posterTargetState = posterTargetState || state;
  if (!posterTargetState) return;
  drawPosterCanvas(posterTargetState);
  document.getElementById('poster-modal-title').innerText = 'Póster del partido';
  document.getElementById('poster-modal').classList.remove('hidden');
}

function closePosterModal() {
  document.getElementById('poster-modal').classList.add('hidden');
}

async function drawPosterCanvas(matchData) {
  const canvas = document.getElementById('poster-canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, X = 64, R = W - 64;
  const m = matchData;
  try { await Promise.all(['700 40px "Barlow Condensed"', 'italic 900 40px "Barlow Condensed"', '600 30px "Barlow"', '500 30px "Barlow"'].map(f => document.fonts.load(f))); } catch (e) {}
  const C = { bg: '#030508', card: '#0D1117', line: 'rgba(255,255,255,0.08)', text: '#F5F7FA', muted: '#8B95A5', a: '#00F0FF', b: '#FF2E54', volt: '#D4FF2A' };
  const font = (w, px, fam = 'Barlow') => `${w} ${px}px "${fam}", sans-serif`;
  const sets = (m.sets || []).map((s, i) => ({ s, i })).filter(({ s }) => s[0] + s[1] > 0);
  const winner = m.winnerPair === 0 || m.winnerPair === 1 ? m.winnerPair : null;
  const dur = m.elapsedSec ? formatMatchDuration(m.elapsedSec) : '';

  // Fondo plano y cabecera: logo, nombre y fecha
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  drawLogoMark(ctx, X, 56, 60, C.volt);
  ctx.fillStyle = C.text; ctx.font = font('italic 900', 38, 'Barlow Condensed'); ctx.textAlign = 'left';
  ctx.fillText('PADEL METRIC', X + 72, 100);
  ctx.textAlign = 'right'; ctx.fillStyle = C.muted; ctx.font = font(500, 26);
  ctx.fillText([m.date, dur].filter(Boolean).join(' · '), R, 100);
  ctx.textAlign = 'left';

  // Titular: la pareja ganadora por sus nombres
  if (winner !== null) {
    ctx.fillStyle = C.muted; ctx.font = font(600, 28);
    ctx.fillText('Ganan', X, 178);
    ctx.fillStyle = C.text; ctx.font = font(700, 96, 'Barlow Condensed');
    ctx.fillText(fitText(ctx, livePairName(winner, m).toUpperCase(), R - X), X, 262);
  } else {
    ctx.fillStyle = C.text; ctx.font = font(700, 96, 'Barlow Condensed');
    ctx.fillText('PARTIDO', X, 262);
  }

  // Marcador: una fila por pareja con su cuadrado de color, los nombres y los sets
  const boxY = 300, rowH = 104, colW = 92;
  ctx.fillStyle = C.card; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(X - 8, boxY, R - X + 16, rowH * 2 + 24, 24); ctx.fill(); ctx.stroke();
  const setsX0 = R - 24 - colW * sets.length;
  [0, 1].forEach(k => {
    const y = boxY + 12 + k * rowH, mid = y + rowH / 2;
    const won = winner === k;
    ctx.fillStyle = k ? C.b : C.a; ctx.fillRect(X + 16, mid - 9, 18, 18);
    ctx.fillStyle = won ? C.text : '#AEB6C2'; ctx.font = font(won ? 700 : 600, 44, 'Barlow Condensed');
    ctx.fillText(fitText(ctx, livePairName(k, m).toUpperCase(), setsX0 - (X + 52) - 20), X + 52, mid + 15);
    sets.forEach(({ s }, c) => {
      const cx = setsX0 + c * colW + colW / 2;
      const wonSet = s[k] > s[1 - k];
      ctx.textAlign = 'center'; ctx.fillStyle = wonSet ? C.text : '#6B7584';
      ctx.font = font(700, 56, 'Barlow Condensed'); ctx.fillText(String(s[k]), cx, mid + 20);
      ctx.textAlign = 'left';
    });
    if (k === 0) { ctx.fillStyle = C.line; ctx.fillRect(X + 16, y + rowH, R - X - 32, 2); }
  });

  // Estadísticas como en el circuito profesional (barras pareja contra pareja)
  let y = boxY + rowH * 2 + 88;
  ctx.fillStyle = C.text; ctx.font = font(700, 40, 'Barlow Condensed');
  ctx.fillText('ESTADÍSTICAS', X, y);
  y += 16;
  const rows = proStatsRows(m).filter(r => r[0] !== 'Racha más larga de puntos').slice(0, 7);
  rows.forEach(([label, va, vb, a, b, low]) => {
    const better = a === b ? 0 : (low ? a < b : a > b) ? 1 : 2;
    ctx.font = font(better === 1 ? 700 : 500, 34, 'Barlow Condensed'); ctx.fillStyle = better === 1 ? C.text : '#AEB6C2';
    ctx.textAlign = 'left'; ctx.fillText(String(va), X, y + 38);
    ctx.font = font(better === 2 ? 700 : 500, 34, 'Barlow Condensed'); ctx.fillStyle = better === 2 ? C.text : '#AEB6C2';
    ctx.textAlign = 'right'; ctx.fillText(String(vb), R, y + 38);
    ctx.textAlign = 'center'; ctx.fillStyle = C.muted; ctx.font = font(500, 24); ctx.fillText(label, W / 2, y + 34);
    ctx.textAlign = 'left';
    const tot = Math.abs(a) + Math.abs(b) || 1, bw = R - X, wa = Math.max(4, (Math.abs(a) / tot) * bw - 3);
    ctx.fillStyle = C.a; ctx.beginPath(); ctx.roundRect(X, y + 54, wa, 8, 4); ctx.fill();
    ctx.fillStyle = C.b; ctx.beginPath(); ctx.roundRect(X + wa + 6, y + 54, bw - wa - 6, 8, 4); ctx.fill();
    y += 76;
  });

  // Mejor del partido
  const best = m.players.map((p, i) => ({ p, i, r: calcPlayerRating(p) })).sort((a, b) => b.r - a.r)[0];
  if (best && !best.p.isGeneric) {
    y += 16;
    ctx.fillStyle = C.line; ctx.fillRect(X, y, R - X, 2);
    y += 56;
    ctx.fillStyle = C.muted; ctx.font = font(500, 26); ctx.fillText('Mejor del partido', X, y);
    ctx.fillStyle = C.text; ctx.font = font(700, 44, 'Barlow Condensed');
    ctx.fillText(liveSurname(best.p, m).toUpperCase(), X + 230, y + 4);
    ctx.textAlign = 'right'; ctx.fillStyle = C.text; ctx.font = font(600, 26);
    ctx.fillText(`${best.r.toFixed(1).replace('.', ',')} de valoración · ${best.p.W || 0} winners`, R, y);
    ctx.textAlign = 'left';
  }

  // Pie
  ctx.textAlign = 'center'; ctx.fillStyle = C.muted; ctx.font = font(500, 22);
  ctx.fillText('Hecho con Padel Metric · juancbr9.github.io/padel_metric_2026', W / 2, H - 40);
  ctx.textAlign = 'left';

  document.getElementById('poster-preview').src = canvas.toDataURL('image/png');
}

function downloadPosterPNG() {
  const canvas = document.getElementById('poster-canvas');
  const a = document.createElement('a');
  a.download = `PadelMetric_${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

async function sharePosterWhatsApp() {
  const canvas = document.getElementById('poster-canvas');
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], 'padel_metric.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Resumen Padel Metric' });
        return;
      } catch (e) {}
    }
    downloadPosterPNG();
  }, 'image/png');
}
