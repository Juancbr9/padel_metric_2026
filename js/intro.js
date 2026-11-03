// ==========================================================
// ANIMACIÓN DE ENTRADA DEL LOGO Y CARGADOR
// Entrada "Trazo y bote" (la misma para todo el mundo): la P se dibuja, se rellena y se perfora mientras la pelota
// entra botando y se queda como el punto. El marcado está en index.html (#intro-splash) y el script del <head> decide
// si se muestra (clase "intro-on" en <html>: una vez por sesión, sin "reducir movimiento" y no en enlaces de directo,
// partido o perfil), así es lo primero que se pinta. Aquí solo se funde al terminar y se quita. No bloquea los toques.
// pmLoaderHTML(texto): el logo con la pelota botando para las esperas (directo, crónica, datos de ejemplo…).
// ==========================================================
(() => {
  const el = document.getElementById('intro-splash');
  if (!el) return;
  if (!document.documentElement.classList.contains('intro-on')) { el.remove(); return; }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.classList.add('out');
    setTimeout(() => { el.remove(); document.documentElement.classList.remove('intro-on'); }, 480);
  };
  el.querySelector('.intro-word')?.addEventListener('animationend', () => setTimeout(finish, 120));
  setTimeout(finish, 3200);
})();

function pmLoaderHTML(text = '') {
  return `<div class="pm-loader" role="status"><svg viewBox="96 60 340 380" aria-hidden="true"><g mask="url(#logo-perf)"><circle cx="280" cy="198" r="122"/><rect x="138" y="96" width="70" height="330" rx="35"/></g><circle class="pm-loader-ball" cx="372" cy="388" r="38"/></svg>${text ? `<span>${escapeHtml(text)}</span>` : ''}</div>`;
}
