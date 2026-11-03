// ==========================================================
// ANIMACIÓN DE ENTRADA DEL LOGO
// Al abrir la app (una vez por sesión) la "P." se monta sola durante 1,6 s y se funde. Tres estilos que se eligen en
// Ajustes (appSettings.intro): 'A' Saque (la pelota entra botando y se queda como el punto), 'B' Trazo (la P se
// dibuja y se perfora), 'C' Perforado (la pala gira, se perfora en onda y entra el nombre) u 'off'. No sale con
// "reducir movimiento", en la vista de espectador ni en los enlaces de partido o perfil. No bloquea los toques.
// ==========================================================
const INTRO_STYLES = [['A', 'Saque'], ['B', 'Trazo'], ['C', 'Perforado'], ['off', 'Ninguna']];
const LOGO_HOLES = [[256, 135.6], [292, 135.6], [328, 135.6], [238, 166.8], [274, 166.8], [310, 166.8], [346, 166.8], [220, 198], [256, 198], [292, 198], [328, 198], [364, 198], [238, 229.2], [274, 229.2], [310, 229.2], [346, 229.2], [256, 260.4], [292, 260.4], [328, 260.4]];

function introLogoSVG() {
  const holes = LOGO_HOLES.map(([x, y]) => `<circle class="ih" cx="${x}" cy="${y}" r="10.5" style="--d:${(Math.hypot(x - 292, y - 198) / 80).toFixed(2)}"/>`).join('');
  return `<svg class="intro-logo" viewBox="96 60 340 380" aria-hidden="true"><g class="ipg"><circle class="ip ihead" cx="280" cy="198" r="122" pathLength="1"/><rect class="ip ihandle" x="138" y="96" width="70" height="330" rx="35" pathLength="1"/>${holes}</g><circle class="idot" cx="372" cy="388" r="38"/></svg>`;
}

function playIntro(style, { force = false } = {}) {
  const st = style || (typeof appSettings !== 'undefined' && appSettings.intro) || 'A';
  if (st === 'off') return;
  if (!force) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (/#(directo|partido|jugador)=/.test(location.hash)) return;
    try { if (sessionStorage.getItem('pm_intro_vista')) return; sessionStorage.setItem('pm_intro_vista', '1'); } catch (e) {}
  }
  document.getElementById('intro-splash')?.remove();
  const el = document.createElement('div');
  el.id = 'intro-splash';
  el.className = `intro-splash intro-${st}`;
  el.innerHTML = `<div class="intro-stage">${introLogoSVG()}<div class="intro-word">PADEL METRIC</div></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 1900);
  setTimeout(() => el.remove(), 2400);
}

function setIntroStyle(st) {
  appSettings.intro = st;
  try { localStorage.setItem('pm_ajustes_v1', JSON.stringify(appSettings)); } catch (e) {}
  document.querySelectorAll('#intro-seg [data-intro]').forEach(b => b.classList.toggle('active', b.dataset.intro === st));
  if (st !== 'off') playIntro(st, { force: true });
}

playIntro();
