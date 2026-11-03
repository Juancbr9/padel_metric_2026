// ==========================================================
// FOTOS DE PERFIL DESDE LA FOTO DEL GRUPO (CON IA)
// En el póster con la foto del grupo, "Sacar las fotos de perfil" envía la foto reducida (JPEG de 1024 px como mucho)
// a la función resumen-partido de Supabase (tipo 'caras', Claude Haiku 5.5), que devuelve el recuadro de cada cara.
// Aquí se recorta cada cara en cuadrado (con margen) a 256 × 256 y se pregunta de quién es cada una (por defecto, en
// el orden de los jugadores del partido). Al guardar, cada recorte pasa a ser la foto de su ficha (perfil.photo).
// Cuenta como un uso de la IA (3 al mes, o sin límite con el código de pruebas).
// ==========================================================
let faceCrops = [];

function imageToJpegBase64(img, max = 1024) {
  const sc = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

function cropFace(img, f) {
  // Cuadrado centrado en la cara, 1,6 veces su tamaño, para que entre la cabeza entera
  const cx = (f.x + f.w / 2) * img.width, cy = (f.y + f.h / 2) * img.height;
  const side = Math.min(Math.max(f.w * img.width, f.h * img.height) * 1.6, img.width, img.height);
  const sx = Math.max(0, Math.min(img.width - side, cx - side / 2)), sy = Math.max(0, Math.min(img.height - side, cy - side / 2));
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
  return c.toDataURL('image/jpeg', 0.86);
}

async function detectFacesFromPosterPhoto() {
  if (!posterPhoto || !posterTargetState) return;
  const players = posterTargetState.players.filter(p => !p.isGeneric).map(p => p.name);
  if (!players.length) { showToast('Los jugadores de este partido no tienen ficha'); return; }
  if (!navigator.onLine) { showToast('Sin conexión: la IA necesita internet'); return; }
  closePosterModal();
  openEventModal(pmLoaderHTML('Buscando las caras en la foto…'));
  let caras = null, error = '';
  try {
    const r = await fetch(AI_SUMMARY_URL, { method: 'POST', headers: aiHeaders(), body: JSON.stringify({ device: aiDeviceId(), tipo: 'caras', imagen: imageToJpegBase64(posterPhoto) }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(d.caras)) caras = d.caras;
    else error = r.status === 429 && d.restantes === 0 ? 'Has usado los usos de la IA de este mes. Con la versión Pro no tendrás límite.' : (d.error || 'No se han podido encontrar las caras.');
  } catch (e) { error = 'No se ha podido conectar. Inténtalo de nuevo en un momento.'; }
  if (!caras || !caras.length) {
    openEventModal(`<div class="mo-title">Fotos de perfil</div><p class="bc-intro">${escapeHtml(error || 'No se ha encontrado ninguna cara. Prueba con una foto en la que se os vea de frente.')}</p>
      <button type="button" class="btn-icon btn-block" onclick="closeEventModal(); openPosterModal()">Volver al póster</button>`);
    return;
  }
  faceCrops = caras.map(f => cropFace(posterPhoto, f));
  renderFaceAssign(players);
}

function renderFaceAssign(players) {
  openEventModal(`
    <div class="mo-title">¿Quién es quién?</div>
    <p class="bc-intro">La IA ha encontrado ${faceCrops.length} cara${faceCrops.length === 1 ? '' : 's'}. Elige de quién es cada una y se guardará como su foto de perfil.</p>
    <div class="face-grid">${faceCrops.map((src, i) => `
      <div class="face-item">
        <img src="${src}" alt="Cara ${i + 1}">
        <select data-face="${i}" aria-label="Jugador de la cara ${i + 1}">
          <option value="">Nadie</option>
          ${players.map((n, k) => `<option value="${escapeHtml(n)}" ${k === i ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}
        </select>
      </div>`).join('')}</div>
    <div class="u-grid-2 mt-14">
      <button type="button" class="btn-volt" onclick="saveFacePhotos()">Guardar fotos</button>
      <button type="button" class="btn-icon" onclick="closeEventModal(); openPosterModal()">Cancelar</button>
    </div>`);
}

function saveFacePhotos() {
  const picks = [...document.querySelectorAll('.face-grid select')].map(s => [s.value, faceCrops[+s.dataset.face]]).filter(([n]) => n);
  const names = new Set();
  picks.forEach(([name, src]) => { if (names.has(name)) return; names.add(name); ensureProfile(name).photo = src; });
  if (!names.size) { showToast('No has elegido a nadie'); return; }
  saveDB();
  faceCrops = [];
  closeEventModal();
  showToast(`Foto de perfil guardada para ${names.size} jugador${names.size === 1 ? '' : 'es'}`);
  if (typeof renderGlobalRanking === 'function') renderGlobalRanking();
  openPosterModal();
}
