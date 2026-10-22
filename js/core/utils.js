function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Para pasar un texto como argumento dentro de un onclick="..."
function jsArg(text) {
  return escapeHtml(JSON.stringify(String(text ?? '')));
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function vibrate(pattern = 15) {
  if (appSettings.vibration && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

function getInitials(name) {
  const parts = (name || 'J').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function renderAvatarHTML(playerName, extraClass = 'avatar-p1', customStyle = '', isGeneric = false, fallbackLabel = '') {
  if (!isGeneric && playerName && dbProfiles[playerName] && dbProfiles[playerName].photo) {
    return `<span class="avatar-circle ${extraClass}" style="${customStyle}"><img src="${dbProfiles[playerName].photo}" alt="${playerName}"></span>`;
  }
  const text = fallbackLabel || getInitials(playerName);
  return `<span class="avatar-circle ${extraClass}" style="${customStyle}">${text}</span>`;
}

dbPlayers.forEach(k => ensureProfile(k));

// ==========================================================
// PORTADA DE PISTA PROFESIONAL INDOOR CON RED "PADEL METRIC"
// ==========================================================
function generateRealisticArenaCoverDataURL() {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 320;
  const ctx = c.getContext('2d');

  const roof = ctx.createLinearGradient(0, 0, 0, 175);
  roof.addColorStop(0, '#02040A');
  roof.addColorStop(0.6, '#071124');
  roof.addColorStop(1, '#0C1E3E');
  ctx.fillStyle = roof;
  ctx.fillRect(0, 0, 1080, 320);

  [190, 420, 660, 890].forEach(lx => {
    const cone = ctx.createRadialGradient(lx, 14, 4, lx, 110, 250);
    cone.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
    cone.addColorStop(0.22, 'rgba(56, 189, 248, 0.22)');
    cone.addColorStop(0.6, 'rgba(14, 116, 144, 0.06)');
    cone.addColorStop(1, 'rgba(6, 9, 15, 0)');
    ctx.fillStyle = cone;
    ctx.fillRect(0, 0, 1080, 320);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(lx - 26, 6, 52, 5);
  });

  for (let i = 0; i < 7; i++) {
    const gx = 90 + i * 128;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.fillRect(gx, 42, 124, 92);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(gx, 42, 124, 92);
  }

  const turf = ctx.createLinearGradient(0, 134, 0, 320);
  turf.addColorStop(0, '#0A224E');
  turf.addColorStop(0.45, '#133B82');
  turf.addColorStop(1, '#081A3A');
  ctx.fillStyle = turf;
  ctx.fillRect(0, 134, 1080, 186);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(70, 166); ctx.lineTo(1010, 166);
  ctx.moveTo(540, 166); ctx.lineTo(610, 320);
  ctx.stroke();

  const netY = 182;
  const netH = 98;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, netY + netH - 4, 1080, 22);
  ctx.fillStyle = 'rgba(6, 9, 16, 0.88)';
  ctx.fillRect(0, netY, 1080, netH);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1080; x += 7) {
    ctx.beginPath(); ctx.moveTo(x, netY); ctx.lineTo(x, netY + netH); ctx.stroke();
  }
  for (let y = netY; y < netY + netH; y += 7) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke();
  }

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, netY, 1080, 12);
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 8px "JetBrains Mono", monospace';
  for (let tx = 40; tx < 1040; tx += 210) {
    ctx.fillText('PADEL METRIC PRO TOUR', tx, netY + 9);
  }

  const signX = 560, signY = netY + 18, signW = 440, signH = 58;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(signX + 16, signY);
  ctx.lineTo(signX + signW, signY);
  ctx.lineTo(signX + signW - 16, signY + signH);
  ctx.lineTo(signX, signY + signH);
  ctx.closePath();
  ctx.fillStyle = '#050811';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.stroke();

  ctx.fillStyle = '#D4FF2A';
  ctx.fillRect(signX + 18, signY + 10, 8, signH - 20);
  ctx.fillStyle = '#E11D48';
  ctx.fillRect(signX + signW - 26, signY + 10, 8, signH - 20);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'italic 900 38px "Barlow Condensed", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PADEL METRIC', signX + signW / 2, signY + 42);
  ctx.restore();

  const leftShade = ctx.createLinearGradient(0, 0, 580, 0);
  leftShade.addColorStop(0, 'rgba(6, 9, 15, 0.88)');
  leftShade.addColorStop(0.6, 'rgba(6, 9, 15, 0.38)');
  leftShade.addColorStop(1, 'rgba(6, 9, 15, 0.0)');
  ctx.fillStyle = leftShade;
  ctx.fillRect(0, 0, 1080, 320);

  return c.toDataURL('image/jpeg', 0.92);
}

function loadCustomCover() {
  const box = document.getElementById('hero-card-box');
  if (!box) return;
  const savedCover = localStorage.getItem('pm_custom_cover');
  if (savedCover) {
    box.style.backgroundImage = `linear-gradient(90deg, rgba(6,9,15,0.85) 0%, rgba(6,9,15,0.45) 55%, rgba(6,9,15,0.12) 100%), url('${savedCover}')`;
    return;
  }
  const fallbackDataURL = generateRealisticArenaCoverDataURL();
  box.style.backgroundImage = `linear-gradient(90deg, rgba(6,9,15,0.75) 0%, rgba(6,9,15,0.3) 55%, rgba(6,9,15,0.1) 100%), url('${fallbackDataURL}')`;
}

function handleCustomCover(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    // Reduce la imagen antes de guardarla para no llenar la memoria del móvil
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1080 / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      try {
        localStorage.setItem('pm_custom_cover', c.toDataURL('image/jpeg', 0.8));
        loadCustomCover();
        showToast('Portada actualizada');
      } catch (err) {
        showToast('Elige una imagen más ligera');
      }
    };
    img.onerror = () => showToast('No se pudo leer la imagen');
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function toggleThemeMode() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  localStorage.setItem('pm_theme_light', isLight ? '1' : '0');
  showToast(isLight ? 'Modo claro activado' : 'Modo oscuro activado');
  renderMenuSwitches();
}

if (localStorage.getItem('pm_theme_light') === '1') {
  document.body.classList.add('light-mode');
}

function showToast(msg) {
  const t = document.getElementById('toast-hud');
  document.getElementById('toast-msg').innerText = msg;
  t.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2300);
}
