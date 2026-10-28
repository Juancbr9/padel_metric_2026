// ==========================================================
// MOVIMIENTO, CONFETI Y SONIDOS
// Entradas escalonadas al cambiar de sección, contadores que suben, hojas que se cierran arrastrando,
// confeti en sets y partidos y sonidos cortos (opcionales). Respeta "reducir movimiento" del sistema.
// ==========================================================
const fxReduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Entrada escalonada de los bloques de una sección
function fxEnter(root) {
  if (!root || fxReduced()) return;
  const items = [...root.children].filter(el => !el.classList.contains('hidden')).slice(0, 14);
  items.forEach((el, i) => {
    el.classList.remove('fx-in');
    el.style.setProperty('--fx-i', i);
    void el.offsetWidth;
    el.classList.add('fx-in');
  });
}

// Contadores: cualquier elemento con data-count="123" sube desde 0 al aparecer
function fxCountUp(el) {
  const target = parseFloat(el.dataset.count);
  if (!isFinite(target) || el.dataset.counted === String(target)) return;
  el.dataset.counted = String(target);
  const dec = parseInt(el.dataset.dec || '0', 10);
  const suffix = el.dataset.suffix || '';
  const fmt = v => v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix;
  if (fxReduced() || target === 0) { el.textContent = fmt(target); return; }
  const t0 = performance.now(), dur = 900;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = fmt(target * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function fxScanCounters(root = document) {
  root.querySelectorAll?.('[data-count]').forEach(fxCountUp);
}

new MutationObserver(muts => {
  for (const m of muts) m.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    if (n.dataset && n.dataset.count !== undefined) fxCountUp(n);
    fxScanCounters(n);
  });
}).observe(document.documentElement, { childList: true, subtree: true });

// Hojas inferiores: se cierran arrastrando hacia abajo desde la parte de arriba
(() => {
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const sheet = e.target.closest?.('.telemetry-sheet');
    if (!sheet || sheet.classList.contains('full-top-sheet') || sheet.scrollTop > 0) return;
    if (e.clientY - sheet.getBoundingClientRect().top > 56) return;
    if (e.target.closest('button, input, select, textarea, canvas')) return;
    drag = { sheet, y0: e.clientY, dy: 0 };
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    drag.dy = Math.max(0, e.clientY - drag.y0);
    drag.sheet.style.transition = 'none';
    drag.sheet.style.transform = `translateY(${drag.dy}px)`;
  });
  const end = () => {
    if (!drag) return;
    const { sheet, dy } = drag;
    drag = null;
    sheet.style.transition = 'transform 0.25s cubic-bezier(0.16,1,0.3,1)';
    if (dy > 110) {
      sheet.style.transform = 'translateY(100%)';
      setTimeout(() => {
        sheet.style.transform = ''; sheet.style.transition = '';
        sheet.closest('.sheet-backdrop')?.click();
      }, 180);
    } else {
      sheet.style.transform = '';
    }
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
})();

// Confeti sobre toda la pantalla
function fxConfetti({ colors = ['#D4FF2A', '#00F0FF', '#FF2E54', '#FFE066', '#FFFFFF'], count = 120 } = {}) {
  if (fxReduced()) return;
  const cv = document.createElement('canvas');
  cv.className = 'confetti-canvas';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: count }, (_, i) => {
    const fromLeft = i % 2 === 0;
    return {
      x: fromLeft ? -10 : W + 10, y: H * (0.55 + Math.random() * 0.25),
      vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 7), vy: -(9 + Math.random() * 9),
      w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: colors[i % colors.length]
    };
  });
  const t0 = performance.now();
  const tick = now => {
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = t > 2200 ? Math.max(0, 1 - (t - 2200) / 600) : 1;
    parts.forEach(p => {
      p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
      ctx.restore();
    });
    if (t < 2800) requestAnimationFrame(tick); else cv.remove();
  };
  requestAnimationFrame(tick);
}

// Sonidos cortos sintetizados (sin archivos). Desactivados por defecto: Ajustes → Sonidos
let fxAudio = null;
function fxSound(kind) {
  if (!appSettings.sound) return;
  try {
    fxAudio = fxAudio || new (window.AudioContext || window.webkitAudioContext)();
    if (fxAudio.state === 'suspended') fxAudio.resume();
    const notes = {
      point: [[880, 0, 0.07]],
      game: [[660, 0, 0.09], [990, 0.09, 0.14]],
      set: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.22]],
      match: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.18], [784, 0.56, 0.1], [1047, 0.66, 0.4]],
      undo: [[440, 0, 0.06], [330, 0.06, 0.08]]
    }[kind];
    if (!notes) return;
    const t = fxAudio.currentTime + 0.01;
    notes.forEach(([f, at, len]) => {
      const o = fxAudio.createOscillator(), g = fxAudio.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(0.22, t + at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + len);
      o.connect(g).connect(fxAudio.destination);
      o.start(t + at); o.stop(t + at + len + 0.02);
    });
  } catch (e) {}
}
