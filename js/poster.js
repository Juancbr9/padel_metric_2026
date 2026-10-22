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
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#06090F');
  bg.addColorStop(0.5, '#0C1426');
  bg.addColorStop(1, '#05070C');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#D4FF2A';
  ctx.font = 'italic 900 68px "Barlow Condensed", sans-serif';
  ctx.fillText('PADEL METRIC', 64, 105);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '700 28px "JetBrains Mono", monospace';
  ctx.fillText(matchData.date || 'PARTIDO OFICIAL', 64, 150);

  ctx.fillStyle = '#12192A';
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(60, 190, W - 120, 290, 28);
  ctx.fill();
  ctx.stroke();

  const p1Names = `${matchData.players[0].name} / ${matchData.players[1].name}`;
  const p2Names = `${matchData.players[2].name} / ${matchData.players[3].name}`;

  ctx.fillStyle = '#00F0FF';
  ctx.font = '900 46px "Barlow Condensed", sans-serif';
  ctx.fillText(p1Names.toUpperCase(), 96, 285);

  ctx.fillStyle = '#FF2E54';
  ctx.fillText(p2Names.toUpperCase(), 96, 405);

  matchData.sets.forEach((s, idx) => {
    const sx = 740 + idx * 95;
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 52px "JetBrains Mono", monospace';
    ctx.fillText(String(s[0]), sx, 285);
    ctx.fillText(String(s[1]), sx, 405);
  });

  ctx.fillStyle = '#D4FF2A';
  ctx.font = 'italic 900 42px "Barlow Condensed", sans-serif';
  ctx.fillText('RENDIMIENTO INDIVIDUAL', 64, 560);

  for (let idx = 0; idx < matchData.players.length; idx++) {
    const p = matchData.players[idx];
    const y = 600 + idx * 155;
    ctx.fillStyle = '#12192A';
    ctx.beginPath();
    ctx.roundRect(60, y, W - 120, 132, 22);
    ctx.fill();

    // Avatar circular en el póster
    const avX = 135, avY = y + 66, avR = 40;
    const prof = (!p.isGeneric && dbProfiles[p.name]) ? dbProfiles[p.name] : null;
    if (prof && prof.photo) {
      await new Promise(resolve => {
        const im = new Image();
        im.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(avX, avY, avR, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(im, avX - avR, avY - avR, avR * 2, avR * 2);
          ctx.restore();
          resolve();
        };
        im.onerror = resolve;
        im.src = prof.photo;
      });
    } else {
      ctx.fillStyle = idx < 2 ? 'rgba(0,240,255,0.15)' : 'rgba(255,46,84,0.15)';
      ctx.beginPath();
      ctx.arc(avX, avY, avR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = idx < 2 ? '#00F0FF' : '#FF2E54';
      ctx.font = '900 32px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(getInitials(p.name), avX, avY + 11);
      ctx.textAlign = 'left';
    }

    ctx.strokeStyle = idx < 2 ? '#00F0FF' : '#FF2E54';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(avX, avY, avR, 0, Math.PI * 2);
    ctx.stroke();

    // Solo el nombre del jugador, sin Drive / Revés
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 44px "Barlow Condensed", sans-serif';
    ctx.fillText(p.name.toUpperCase(), 196, y + 60);

    const rating = calcPlayerRating(p).toFixed(1);
    ctx.fillStyle = '#00E676';
    ctx.font = '700 28px "JetBrains Mono", monospace';
    ctx.fillText(`W: ${p.W}`, 196, y + 106);

    ctx.fillStyle = '#FF2E54';
    ctx.fillText(`ENF: ${p.ENF}`, 340, y + 106);

    ctx.fillStyle = '#FFB800';
    ctx.fillText(`EF: ${p.EF}`, 520, y + 106);

    ctx.fillStyle = '#D4FF2A';
    ctx.font = '800 44px "JetBrains Mono", monospace';
    ctx.fillText(`VAL ${rating}`, 790, y + 84);
  }

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
