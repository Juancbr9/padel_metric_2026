// ==========================================================
// PÓSTER HD PARA WHATSAPP (CON AVATARES CIRCULARES Y SIN DRIVE / REVÉS)
// ==========================================================
// Póster con la foto del grupo: la foto ocupa todo el póster y el resultado va encima, en una franja oscura.
// La foto solo vive en memoria mientras el póster está abierto (no se guarda).
let posterPhoto = null, posterPhotoY = 0.5, posterPhotoFor = null;

function openPosterModal() {
  posterTargetState = posterTargetState || state;
  if (!posterTargetState) return;
  if (posterPhotoFor !== posterTargetState.id) { posterPhoto = null; posterPhotoY = 0.5; }
  drawPosterCanvas(posterTargetState);
  document.getElementById('poster-modal-title').innerText = 'Póster del partido';
  document.getElementById('poster-photo-tools')?.classList.remove('hidden');
  syncPosterPhotoTools();
  document.getElementById('poster-modal').classList.remove('hidden');
}

function syncPosterPhotoTools() {
  const lbl = document.getElementById('poster-photo-label');
  if (lbl) lbl.innerText = posterPhoto ? 'Cambiar la foto' : 'Con la foto del grupo';
  document.getElementById('poster-photo-adjust')?.classList.toggle('hidden', !posterPhoto);
  document.getElementById('poster-faces-btn')?.classList.toggle('hidden', !posterPhoto);
}

function choosePosterPhoto(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file || !posterTargetState) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      posterPhoto = img; posterPhotoY = 0.5; posterPhotoFor = posterTargetState.id;
      const r = document.querySelector('#poster-photo-adjust input[type=range]');
      if (r) r.value = 50;
      syncPosterPhotoTools();
      drawPosterCanvas(posterTargetState);
    };
    img.onerror = () => showToast('No se ha podido abrir la foto');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function setPosterPhotoY(v) {
  posterPhotoY = Math.max(0, Math.min(1, v / 100));
  if (posterPhoto && posterTargetState) drawPosterCanvas(posterTargetState);
}

function clearPosterPhoto() {
  posterPhoto = null;
  syncPosterPhotoTools();
  if (posterTargetState) drawPosterCanvas(posterTargetState);
}

// Versión con foto: foto a sangre, logo arriba y el resultado abajo sobre una franja oscura (sin degradados)
function drawPhotoPoster(ctx, W, H, m) {
  const img = posterPhoto;
  const sc = Math.max(W / img.width, H / img.height);
  const dw = img.width * sc, dh = img.height * sc;
  ctx.drawImage(img, (W - dw) / 2, -(dh - H) * posterPhotoY, dw, dh);
  const X = 64, R = W - 64;
  const font = (w, px, fam = 'Barlow') => `${w} ${px}px "${fam}", sans-serif`;
  // Logo arriba, sobre una pastilla oscura
  ctx.fillStyle = 'rgba(3,5,8,0.78)'; ctx.beginPath(); ctx.roundRect(X - 16, 44, 372, 84, 42); ctx.fill();
  drawLogoMark(ctx, X + 4, 58, 56, '#D4FF2A');
  ctx.fillStyle = '#F5F7FA'; ctx.font = font('italic 900', 36, 'Barlow Condensed'); ctx.textAlign = 'left';
  ctx.fillText('PADEL METRIC', X + 74, 98);
  // Franja inferior con el resultado
  const sets = (m.sets || []).filter(s => s[0] + s[1] > 0);
  const winner = m.winnerPair === 0 || m.winnerPair === 1 ? m.winnerPair : null;
  const top = H - 470;
  ctx.fillStyle = 'rgba(3,5,8,0.9)'; ctx.fillRect(0, top, W, H - top);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0, top, W, 2);
  let y = top + 70;
  ctx.fillStyle = '#8B95A5'; ctx.font = font(600, 28);
  ctx.fillText(winner !== null ? 'Ganan' : 'Partido', X, y);
  ctx.textAlign = 'right'; ctx.font = font(500, 26);
  ctx.fillText([m.date, m.elapsedSec ? formatMatchDuration(m.elapsedSec) : ''].filter(Boolean).join(' · '), R, y);
  ctx.textAlign = 'left';
  y += 92;
  ctx.fillStyle = '#F5F7FA'; ctx.font = font(700, 92, 'Barlow Condensed');
  ctx.fillText(fitText(ctx, livePairName(winner ?? 0, m).toUpperCase(), R - X), X, y);
  y += 30;
  const colW = 84, setsX0 = R - colW * sets.length;
  [0, 1].forEach(k => {
    const mid = y + 44 + k * 70;
    ctx.fillStyle = k ? '#FF2E54' : '#00F0FF'; ctx.fillRect(X, mid - 22, 16, 16);
    ctx.fillStyle = winner === k ? '#F5F7FA' : '#AEB6C2'; ctx.font = font(winner === k ? 700 : 600, 44, 'Barlow Condensed');
    ctx.fillText(fitText(ctx, livePairName(k, m).toUpperCase(), setsX0 - X - 60), X + 34, mid - 2);
    sets.forEach((s, c) => {
      ctx.textAlign = 'center'; ctx.fillStyle = s[k] > s[1 - k] ? '#F5F7FA' : '#6B7584';
      ctx.font = font(700, 52, 'Barlow Condensed'); ctx.fillText(String(s[k]), setsX0 + c * colW + colW / 2, mid);
      ctx.textAlign = 'left';
    });
  });
  const sum = (key, k) => m.players.slice(k * 2, k * 2 + 2).reduce((a, p) => a + (p[key] || 0), 0);
  const wk = winner ?? 0;
  const facts = [`${sum('W', wk)} winners`, `${sum('ENF', wk)} errores no forzados`];
  if (Array.isArray(m.points) && m.points.length) facts.unshift(`${m.points.filter(p => p.w === wk).length} puntos ganados`);
  ctx.fillStyle = '#C9D1DC'; ctx.font = font(500, 28);
  ctx.fillText(facts.join(' · '), X, H - 70);
  ctx.fillStyle = '#8B95A5'; ctx.font = font(500, 22); ctx.textAlign = 'right';
  ctx.fillText('juancbr9.github.io/padel_metric_2026', R, H - 30);
  ctx.textAlign = 'left';
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
  if (posterPhoto) {
    drawPhotoPoster(ctx, W, H, m);
    document.getElementById('poster-preview').src = canvas.toDataURL('image/jpeg', 0.92);
    return;
  }
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

  // Cuatro datos clave con barras (todas las estadísticas van en su propia imagen: shareMatchStatsImage)
  let y = boxY + rowH * 2 + 70;
  const keys = ['Puntos ganados', 'Puntos ganados con el 1.er saque', 'Bolas de break convertidas', 'Winners', 'Juegos ganados'];
  const rows = proStatsRows(m).filter(r => keys.includes(r[0])).slice(0, 4);
  y = drawStatBars(ctx, rows, X, R, y, 92, 38);

  // Mejor del partido, con su foto o sus iniciales
  const best = m.players.map((p, i) => ({ p, i, r: calcPlayerRating(p) })).sort((a, b) => b.r - a.r)[0];
  if (best && !best.p.isGeneric) {
    y += 10;
    ctx.fillStyle = C.line; ctx.fillRect(X, y, R - X, 2);
    const cy = y + 90;
    await drawPosterAvatar(ctx, best.p, X + 52, cy, 52, best.i < 2 ? C.a : C.b);
    ctx.fillStyle = C.muted; ctx.font = font(500, 26); ctx.fillText('Mejor del partido', X + 130, cy - 14);
    ctx.fillStyle = C.text; ctx.font = font(700, 54, 'Barlow Condensed');
    ctx.fillText(fitText(ctx, liveSurname(best.p, m).toUpperCase(), 420), X + 130, cy + 38);
    ctx.textAlign = 'right'; ctx.font = font(700, 64, 'Barlow Condensed'); ctx.fillText(fmtNum(best.r, 1), R, cy + 12);
    ctx.fillStyle = C.muted; ctx.font = font(500, 24); ctx.fillText(`valoración · ${best.p.W || 0} winners`, R, cy + 46);
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

// Barras pareja contra pareja (cian / rojo) con la cifra de cada una y la etiqueta en medio
function drawStatBars(ctx, rows, X, R, y, step = 80, size = 34) {
  const W = X + R;
  rows.forEach(([label, va, vb, a, b, low]) => {
    const better = a === b ? 0 : (low ? a < b : a > b) ? 1 : 2;
    ctx.font = `${better === 1 ? 700 : 500} ${size}px "Barlow Condensed", sans-serif`; ctx.fillStyle = better === 1 ? '#F5F7FA' : '#AEB6C2';
    ctx.textAlign = 'left'; ctx.fillText(String(va), X, y + size);
    ctx.font = `${better === 2 ? 700 : 500} ${size}px "Barlow Condensed", sans-serif`; ctx.fillStyle = better === 2 ? '#F5F7FA' : '#AEB6C2';
    ctx.textAlign = 'right'; ctx.fillText(String(vb), R, y + size);
    ctx.textAlign = 'center'; ctx.fillStyle = '#8B95A5'; ctx.font = `500 ${Math.round(size * 0.68)}px "Barlow", sans-serif`; ctx.fillText(label, W / 2, y + size - 4);
    ctx.textAlign = 'left';
    const tot = Math.abs(a) + Math.abs(b) || 1, bw = R - X, wa = Math.max(4, (Math.abs(a) / tot) * bw - 3);
    ctx.fillStyle = '#00F0FF'; ctx.beginPath(); ctx.roundRect(X, y + size + 16, wa, 9, 4.5); ctx.fill();
    ctx.fillStyle = '#FF2E54'; ctx.beginPath(); ctx.roundRect(X + wa + 6, y + size + 16, bw - wa - 6, 9, 4.5); ctx.fill();
    y += step;
  });
  return y;
}

// Foto del jugador en círculo (o sus iniciales) con el aro del color de su pareja
async function drawPosterAvatar(ctx, p, cx, cy, r, color) {
  const prof = (!p.isGeneric && dbProfiles[p.name]) ? dbProfiles[p.name] : null;
  let drawn = false;
  if (prof && prof.photo) {
    const im = new Image(); im.src = prof.photo;
    try { await im.decode(); ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(im, cx - r, cy - r, r * 2, r * 2); ctx.restore(); drawn = true; } catch (e) {}
  }
  if (!drawn) {
    ctx.fillStyle = '#151B24'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.font = `700 ${Math.round(r * 0.8)}px "Barlow Condensed", sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(p.isGeneric ? 'J' : getInitials(p.name), cx, cy + r * 0.28); ctx.textAlign = 'left';
  }
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}

// Imagen de las estadísticas del partido (1080 × 1350): resultado, estadísticas del circuito y cada jugador
function shareMatchStatsImage(m) {
  m = m || posterTargetState || state;
  if (!m || !m.players) return;
  posterTargetState = m;
  const sets = (m.sets || []).filter(s => s[0] + s[1] > 0);
  openShareImage((ctx, W, H) => {
    const X = 64, R = W - 64;
    ctx.fillStyle = '#030508'; ctx.fillRect(0, 0, W, H);
    drawLogoMark(ctx, X, 50, 52, '#D4FF2A');
    ctx.fillStyle = '#F5F7FA'; ctx.font = 'italic 900 34px "Barlow Condensed", sans-serif'; ctx.fillText('PADEL METRIC', X + 64, 88);
    ctx.textAlign = 'right'; ctx.fillStyle = '#8B95A5'; ctx.font = '500 24px "Barlow", sans-serif';
    ctx.fillText([m.date, m.elapsedSec ? formatMatchDuration(m.elapsedSec) : ''].filter(Boolean).join(' · '), R, 88); ctx.textAlign = 'left';
    ctx.fillStyle = '#F5F7FA'; ctx.font = '700 60px "Barlow Condensed", sans-serif'; ctx.fillText('ESTADÍSTICAS DEL PARTIDO', X, 178);
    // Marcador compacto
    let y = 214;
    [0, 1].forEach(k => {
      const mid = y + 34 + k * 58, won = m.winnerPair === k;
      ctx.fillStyle = k ? '#FF2E54' : '#00F0FF'; ctx.fillRect(X, mid - 20, 16, 16);
      ctx.fillStyle = won ? '#F5F7FA' : '#AEB6C2'; ctx.font = `${won ? 700 : 600} 38px "Barlow Condensed", sans-serif`;
      ctx.fillText(fitText(ctx, livePairName(k, m).toUpperCase(), 600), X + 30, mid);
      sets.forEach((s, c) => {
        ctx.textAlign = 'center'; ctx.fillStyle = s[k] > s[1 - k] ? '#F5F7FA' : '#6B7584'; ctx.font = '700 44px "Barlow Condensed", sans-serif';
        ctx.fillText(String(s[k]), R - (sets.length - c - 0.5) * 72, mid); ctx.textAlign = 'left';
      });
    });
    y += 150;
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(X, y, R - X, 2);
    y = drawStatBars(ctx, proStatsRows(m).slice(0, 8), X, R, y + 26, 74, 30);
    // Cada jugador
    y += 12;
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(X, y, R - X, 2);
    y += 48;
    const cols = [['W', 'Winners', 560], ['ENF', 'Err. NF', 700], ['EF', 'Err. F', 830], ['val', 'Valor.', R]];
    ctx.fillStyle = '#8B95A5'; ctx.font = '600 22px "Barlow", sans-serif'; ctx.fillText('Jugador', X, y);
    cols.forEach(([, l, x]) => { ctx.textAlign = 'right'; ctx.fillText(l, x, y); ctx.textAlign = 'left'; });
    const best = Math.max(...m.players.map(p => calcPlayerRating(p)));
    m.players.forEach((p, i) => {
      const ry = y + 52 + i * 54;
      ctx.fillStyle = i < 2 ? '#00F0FF' : '#FF2E54'; ctx.fillRect(X, ry - 18, 14, 14);
      ctx.fillStyle = '#F5F7FA'; ctx.font = '600 32px "Barlow Condensed", sans-serif'; ctx.fillText(fitText(ctx, p.isGeneric ? `Jugador ${i + 1}` : p.name, 440), X + 26, ry);
      const r = calcPlayerRating(p);
      const vals = { W: p.W || 0, ENF: p.ENF || 0, EF: p.EF || 0, val: fmtNum(r, 1) };
      cols.forEach(([k, , x]) => {
        ctx.textAlign = 'right'; ctx.fillStyle = k === 'val' && r === best ? '#F5F7FA' : '#C9D1DC';
        ctx.font = `${k === 'val' && r === best ? 700 : 500} 32px "Barlow Condensed", sans-serif`; ctx.fillText(String(vals[k]), x, ry); ctx.textAlign = 'left';
      });
    });
  }, 'Estadísticas del partido');
}
