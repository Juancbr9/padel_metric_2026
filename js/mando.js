// ==========================================================
// MANDO: ANOTAR SIN TOCAR LA PANTALLA
// Un mando Bluetooth de los de hacer fotos, un pasador de diapositivas o un teclado suman puntos durante el partido:
//   pareja 1 = subir volumen, flecha arriba o izquierda, Re Pág o "1"
//   pareja 2 = bajar volumen, flecha abajo o derecha, Av Pág o "2"
//   deshacer = mantener pulsado cualquiera de los dos (0,7 s), Retroceso o "Z"
// En la app de Android, con el ajuste "remote" activado, Android pasa los botones de volumen (y los mandos que
// los imitan) a window.__padelMando en lugar de cambiar el volumen. En el navegador no se pueden leer los botones de
// volumen, pero sí los mandos y teclados que envían teclas.
// ==========================================================
const REMOTE_KEYS = {
  a: ['AudioVolumeUp', 'VolumeUp', 'ArrowUp', 'ArrowLeft', 'PageUp', '1'],
  b: ['AudioVolumeDown', 'VolumeDown', 'ArrowDown', 'ArrowRight', 'PageDown', '2'],
  undo: ['Backspace', 'z', 'Z']
};
const REMOTE_HOLD_MS = 700;

function remoteReady() {
  if (!state || state.matchOver || !document.body.classList.contains('in-live-match')) return false;
  if (!document.getElementById('view-match') || document.getElementById('view-match').classList.contains('hidden')) return false;
  if ([...document.querySelectorAll('.sheet-backdrop')].some(el => !el.classList.contains('hidden'))) return false;
  const guide = document.getElementById('match-guide');
  return !(guide && !guide.classList.contains('hidden'));
}

// kind: 'a' | 'b' | 'undo'; held: milisegundos que se ha mantenido pulsado
function remoteAction(kind, held = 0) {
  if (!remoteReady()) return false;
  if (kind === 'undo' || held >= REMOTE_HOLD_MS) { undoLast(); return true; }
  const pair = kind === 'a' ? 0 : 1;
  addNeutralPoint(pair);
  if (state) showToast(`Punto para ${livePairName(pair)}`);
  return true;
}
window.__padelMando = (kind, held) => (remoteAction(kind, +held || 0) ? 'true' : 'false');

(() => {
  const down = {};
  const kindOf = key => Object.keys(REMOTE_KEYS).find(k => REMOTE_KEYS[k].includes(key));
  const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '') || e.target.isContentEditable;
  document.addEventListener('keydown', e => {
    const kind = kindOf(e.key);
    if (!kind || typing(e) || !remoteReady()) return;
    e.preventDefault();
    if (!e.repeat && !down[e.key]) down[e.key] = performance.now();
  });
  document.addEventListener('keyup', e => {
    const kind = kindOf(e.key);
    const t = down[e.key];
    delete down[e.key];
    if (!kind || !t || typing(e)) return;
    e.preventDefault();
    remoteAction(kind, performance.now() - t);
  });
})();

// La app de Android solo se queda con los botones de volumen durante un partido y con el ajuste activado
function syncNativeRemote() {
  const N = window.PadelNative;
  if (!N || typeof N.mando !== 'function') return;
  try { N.mando(!!appSettings.remote && document.body.classList.contains('in-live-match')); } catch (e) {}
}
new MutationObserver(syncNativeRemote).observe(document.body, { attributes: true, attributeFilter: ['class'] });

function openRemoteHelp() {
  const nativeOk = !!(window.PadelNative && typeof window.PadelNative.mando === 'function');
  openEventModal(`
    <div class="mo-title">Anotar con un mando</div>
    <p class="bc-intro">Deja el móvil en el banco o en la valla y suma los puntos desde la pista con un mando Bluetooth de los de hacer fotos (los venden por unos 5 €) o, en la app de Android, con los botones de volumen.</p>
    <div class="remote-keys">
      <div>Punto para la pareja 1<span>Subir volumen · flecha arriba</span></div>
      <div>Punto para la pareja 2<span>Bajar volumen · flecha abajo</span></div>
      <div>Deshacer el último punto<span>Mantener pulsado 1 segundo</span></div>
    </div>
    <p class="exit-note">${nativeOk
      ? 'En esta app los botones de volumen anotan solo mientras hay un partido abierto y el ajuste está activado. Fuera del partido, cambian el volumen como siempre.'
      : 'En el navegador funcionan los mandos y teclados que envían flechas o "Av Pág"/"Re Pág". Los botones de volumen del móvil solo anotan en la app de Android.'}
      Activa el narrador de voz para oír el marcador después de cada punto.</p>
    <button type="button" class="btn-volt btn-block mt-14" onclick="closeEventModal()">Entendido</button>`);
}
