// ==========================================================
// INSTALAR Y COMPARTIR LA APP
// Un enlace y un QR para pasársela a los compañeros, con los pasos para instalarla en Android y en iPhone
// (desde el navegador, sin tienda) y el APK de Android como alternativa.
// ==========================================================
const PUBLIC_APP_URL = 'https://juancbr9.github.io/padel_metric_2026/';

function appPublicUrl() {
  if (window.PadelNative) { try { return PadelNative.urlPublica(); } catch (e) {} }
  if (/^https:/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname)) {
    return `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;
  }
  return PUBLIC_APP_URL;
}

function devicePlatform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

function isInstalledApp() {
  return !!window.PadelNative || window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

let installTab = null;

function openInstallSheet(tab) {
  installTab = tab || installTab || devicePlatform();
  const url = appPublicUrl();
  const step = (n, html) => `<li><span class="in-num">${n}</span><span>${html}</span></li>`;
  const shareIcon = '<svg class="icon in-inline"><use href="#i-ios-share"/></svg>';
  const steps = {
    android: `
      ${deferredInstallPrompt ? '<button class="btn-volt in-now" onclick="triggerInstallPWA()">Instalar ahora en este móvil</button>' : ''}
      <ol class="in-steps">
        ${step(1, 'Abre el enlace en <strong>Chrome</strong>.')}
        ${step(2, 'Pulsa <strong>Instalar</strong> en el aviso que aparece abajo o, si no sale, abre el menú <strong>⋮</strong> y elige <strong>Instalar aplicación</strong> (o <strong>Añadir a pantalla de inicio</strong>).')}
        ${step(3, 'Ya tienes el icono de Padel Metric con el resto de tus apps. Funciona sin conexión y se actualiza sola.')}
      </ol>
      <a class="in-apk" href="descargas/PadelMetric.apk" download="PadelMetric.apk"><svg class="icon"><use href="#i-download"/></svg><span><strong>¿Prefieres la app de Android?</strong><small>Descarga el APK e instálalo (permite instalar desde el navegador si lo pide).</small></span></a>`,
    ios: `
      <ol class="in-steps">
        ${step(1, 'Abre el enlace en <strong>Safari</strong>. Si lo abriste desde WhatsApp, pulsa los tres puntos y elige <strong>Abrir en Safari</strong>.')}
        ${step(2, `Pulsa el botón <strong>Compartir</strong> ${shareIcon} de la barra de abajo.`)}
        ${step(3, 'Desliza y elige <strong>Añadir a pantalla de inicio</strong>.')}
        ${step(4, 'Pulsa <strong>Añadir</strong>. La app se abre a pantalla completa desde su icono, como cualquier otra.')}
      </ol>`,
    desktop: `
      <ol class="in-steps">
        ${step(1, 'Abre el enlace en <strong>Chrome</strong> o <strong>Edge</strong>.')}
        ${step(2, 'Pulsa el icono de <strong>instalar</strong> que aparece a la derecha de la barra de direcciones.')}
        ${step(3, 'Para el móvil, escanea el código QR con la cámara.')}
      </ol>`
  };
  openEventModal(`
    <div class="mo-title">Instalar y compartir</div>
    <p class="bc-intro">Pásale este enlace a tus compañeros: lo abren en el navegador del móvil, lo instalan como una app y listo. No hace falta tienda de aplicaciones.</p>
    ${isInstalledApp() ? '<div class="in-ok"><svg class="icon"><use href="#i-ball"/></svg> En este dispositivo ya usas la app instalada</div>' : ''}
    <div class="bc-qr">${QR.svg(url, 2)}</div>
    <div class="bc-link">${escapeHtml(url)}</div>
    <div class="bc-actions">
      <button class="btn-volt" onclick="shareAppLink()"><svg class="icon"><use href="#i-share"/></svg> Enviar enlace</button>
      <button class="btn-icon" onclick="copyAppLink()"><svg class="icon"><use href="#i-copy"/></svg> Copiar</button>
      <button class="btn-icon" onclick="shareAppQR()"><svg class="icon"><use href="#i-qr"/></svg> Imagen del QR</button>
    </div>
    <div class="menu-group-title">Cómo instalarla</div>
    <div class="in-tabs">${[['android', 'Android'], ['ios', 'iPhone'], ['desktop', 'Ordenador']].map(([k, l]) =>
      `<button type="button" class="${k === installTab ? 'active' : ''}" onclick="openInstallSheet('${k}')">${l}</button>`).join('')}</div>
    <div class="in-body">${steps[installTab]}</div>`);
}

async function shareAppLink() {
  const url = appPublicUrl();
  try {
    if (navigator.share) await navigator.share({ title: 'Padel Metric', text: 'Marcador y estadísticas de pádel. Ábrelo y pulsa "Instalar" o "Añadir a pantalla de inicio":', url });
    else { await navigator.clipboard.writeText(url); showToast('Enlace copiado'); }
  } catch (e) {}
}

async function copyAppLink() {
  try { await navigator.clipboard.writeText(appPublicUrl()); showToast('Enlace copiado'); } catch (e) { showToast('No se pudo copiar'); }
}

// Imagen 1080 × 1350 con el QR para enviarla por WhatsApp o imprimirla en el club
function shareAppQR() {
  const url = appPublicUrl();
  const img = new Image();
  img.onload = () => openShareImage((ctx, W, H) => {
    drawShareFrame(ctx, W, H, { kicker: 'Instala la app', title: 'Padel Metric', subtitle: 'Marcador en directo, estadísticas, torneos y americanos' });
    const size = 640, x = (W - size) / 2, y = 400;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.roundRect(x - 30, y - 30, size + 60, size + 60, 36); ctx.fill();
    ctx.drawImage(img, x, y, size, size);
    ctx.fillStyle = '#F8FAFC'; ctx.textAlign = 'center';
    ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Escanéalo con la cámara del móvil', W / 2, y + size + 100);
    ctx.fillStyle = '#94A3B8'; ctx.font = '600 26px "JetBrains Mono", monospace';
    ctx.fillText(url.replace(/^https:\/\//, ''), W / 2, y + size + 150);
    ctx.textAlign = 'left';
  }, 'Código QR de la app');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(QR.svg(url, 1));
}

// Aviso en el inicio para instalarla (iPhone siempre que no esté instalada; Android cuando el navegador lo permite)
function installBannerHTML() {
  if (isInstalledApp() || appSettings.installHintHidden) return '';
  const p = devicePlatform();
  if (p === 'desktop' || (p === 'android' && !deferredInstallPrompt)) return '';
  return `<div class="home-install">
    <svg class="icon icon-lg"><use href="#${p === 'ios' ? 'i-ios-share' : 'i-download'}"/></svg>
    <button type="button" class="home-install-main" onclick="openInstallSheet()"><strong>Instala Padel Metric</strong><small>${p === 'ios' ? 'Añádela a la pantalla de inicio de tu iPhone' : 'Tenla como una app más en tu móvil'}</small></button>
    <button type="button" class="home-install-x" onclick="hideInstallHint()" aria-label="Ocultar"><svg class="icon"><use href="#i-close"/></svg></button>
  </div>`;
}

function hideInstallHint() {
  appSettings.installHintHidden = true;
  try { localStorage.setItem('pm_ajustes_v1', JSON.stringify(appSettings)); } catch (e) {}
  renderHome();
}
