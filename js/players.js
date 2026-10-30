// ==========================================================
// SELECTOR DE JUGADORES ANCLADO EN LA PARTE ALTA DE LA PANTALLA
// ==========================================================
function openPlayerPicker(slotIdx) {
  vibrate(15);
  activePickerSlot = slotIdx;
  document.getElementById('picker-title').innerText = `PAREJA ${slotIdx < 2 ? 1 : 2} · ${FIXED_COURT_SIDES[slotIdx].toUpperCase()}`;
  const inp = document.getElementById('picker-search');
  inp.value = '';
  renderPickerList();
  document.getElementById('player-picker-modal').classList.remove('hidden');
  setTimeout(() => inp.focus(), 60);
}

function closePlayerPicker() {
  document.getElementById('player-picker-modal').classList.add('hidden');
}

function openNewFullPlayerFromPicker() {
  const prefill = (document.getElementById('picker-search')?.value || '').trim();
  pendingAssignSlotAfterCreate = activePickerSlot;
  closePlayerPicker();
  openEditProfileModal(null, prefill);
}

function assignPlayerToSlot(val) {
  vibrate(15);
  setupConfig.slots[activePickerSlot] = val;
  closePlayerPicker();
  renderSetupCourt();
}

function createAndAssignOnTheFly(rawName) {
  const cleanName = (rawName || '').trim();
  if (!cleanName) return;
  const existing = dbPlayers.find(p => p.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    const usedIdx = setupConfig.slots.indexOf(existing);
    if (usedIdx !== -1 && usedIdx !== activePickerSlot) {
      showToast(`${existing} ya está asignado en otra posición`);
      return;
    }
    assignPlayerToSlot(existing);
    return;
  }
  dbPlayers.push(cleanName);
  ensureProfile(cleanName);
  saveDB();
  setupConfig.slots[activePickerSlot] = cleanName;
  vibrate([20, 30]);
  closePlayerPicker();
  renderSetupCourt();
  showToast(`"${cleanName}" creado en BD y convocado`);
}

function handlePickerSearchEnter(e) {
  if (e.key !== 'Enter') return;
  const raw = (document.getElementById('picker-search')?.value || '').trim();
  if (!raw) return;
  createAndAssignOnTheFly(raw);
}

function renderPickerList() {
  const rawQuery = (document.getElementById('picker-search')?.value || '').trim();
  const q = rawQuery.toLowerCase();
  const listEl = document.getElementById('picker-list');
  const currentAssigned = setupConfig.slots[activePickerSlot];
  const { statsMap } = computeAllPlayersStats();

  let html = '';

  const exactMatch = dbPlayers.some(p => p.toLowerCase() === q);
  if (rawQuery.length > 0 && !exactMatch) {
    const safeName = rawQuery.replace(/'/g, "\\'");
    html += `
      <div class="picker-item create-instant" onclick="createAndAssignOnTheFly('${safeName}')">
        <span class="picker-name">
          + CREAR Y CONVOCAR A "${rawQuery}"
        </span>
        <span class="picker-badge accent">RÁPIDO</span>
      </div>
    `;
  }

  const genKey = `GEN_${activePickerSlot}`;
  html += `
    <div class="picker-item ${currentAssigned === genKey ? 'current-slot' : ''}" onclick="assignPlayerToSlot('${genKey}')">
      <div class="u-row-10">
        <span class="avatar-circle">J${activePickerSlot + 1}</span>
        <div>
          <div class="picker-name">Jugador ${activePickerSlot + 1} (Genérico)</div>
          <div class="picker-sub">Sin guardar estadísticas individuales en BD</div>
        </div>
      </div>
      <span class="picker-badge">LIBRE</span>
    </div>
  `;

  const filtered = dbPlayers.filter(name => {
    const prof = ensureProfile(name);
    const haystack = `${name} ${prof.firstName} ${prof.lastName} ${prof.club}`.toLowerCase();
    return haystack.includes(q);
  });

  filtered.forEach(name => {
    const prof = ensureProfile(name);
    const st = statsMap[name] || { PJ: 0, V: 0, ratingSum: 0 };
    const avgR = st.PJ > 0 ? (st.ratingSum / st.PJ).toFixed(1) : '6.5';
    const usedIdx = setupConfig.slots.indexOf(name);
    const isCurrent = (usedIdx === activePickerSlot);
    const isOtherSlot = (usedIdx !== -1 && usedIdx !== activePickerSlot);
    const safeName = name.replace(/'/g, "\\'");
    const subInfo = [prof.club, prof.prefSide ? `Lado: ${prof.prefSide}` : ''].filter(Boolean).join(' · ') || `${st.PJ} PJ · ${st.V} V`;

    html += `
      <div class="picker-item ${isCurrent ? 'current-slot' : ''} ${isOtherSlot ? 'disabled-slot' : ''}" onclick="assignPlayerToSlot('${safeName}')">
        <div class="u-row-10 u-min0">
          ${renderAvatarHTML(name, '')}
          <div class="u-min0">
            <div class="picker-name u-ellipsis">${name}</div>
            <div class="picker-sub u-ellipsis">${subInfo}</div>
          </div>
        </div>
        <span class="picker-badge accent">
          ${isOtherSlot ? `EN PISTA` : `VAL ${avgR}`}
        </span>
      </div>
    `;
  });

  listEl.innerHTML = html;
}

// ==========================================================
// ENCUADRADOR CIRCULAR INTERACTIVO DE FOTO (DRAG + ZOOM + CENTRADO)
// ==========================================================
function initAvatarCropperEvents() {
  const vp = document.getElementById('cropper-viewport');
  if (!vp) return;

  const startDrag = (clientX, clientY) => {
    if (!cropState.img) return;
    cropState.dragging = true;
    cropState.startX = clientX - cropState.offsetX;
    cropState.startY = clientY - cropState.offsetY;
  };

  const moveDrag = (clientX, clientY) => {
    if (!cropState.dragging || !cropState.img) return;
    cropState.offsetX = clientX - cropState.startX;
    cropState.offsetY = clientY - cropState.startY;
    clampCropOffsets();
    drawAvatarCropCanvas();
  };

  const endDrag = () => {
    cropState.dragging = false;
  };

  vp.addEventListener('pointerdown', (e) => {
    if (!cropState.img) return;
    vp.setPointerCapture(e.pointerId);
    startDrag(e.clientX, e.clientY);
  });
  vp.addEventListener('pointermove', (e) => moveDrag(e.clientX, e.clientY));
  vp.addEventListener('pointerup', endDrag);
  vp.addEventListener('pointercancel', endDrag);
}

function clampCropOffsets() {
  if (!cropState.img) return;
  const canvasSize = 240;
  const totalScale = cropState.baseScale * cropState.scale;
  const drawW = cropState.img.width * totalScale;
  const drawH = cropState.img.height * totalScale;
  const maxOffX = Math.max(40, (drawW - canvasSize) / 2 + 40);
  const maxOffY = Math.max(40, (drawH - canvasSize) / 2 + 40);
  cropState.offsetX = Math.max(-maxOffX, Math.min(maxOffX, cropState.offsetX));
  cropState.offsetY = Math.max(-maxOffY, Math.min(maxOffY, cropState.offsetY));
}

function drawAvatarCropCanvas() {
  const canvas = document.getElementById('avatar-crop-canvas');
  const initialsEl = document.getElementById('avatar-crop-initials');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;

  ctx.clearRect(0, 0, size, size);
  if (!cropState.img) {
    canvas.classList.add('hidden');
    initialsEl.classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  initialsEl.classList.add('hidden');

  ctx.fillStyle = '#0C111D';
  ctx.fillRect(0, 0, size, size);

  const totalScale = cropState.baseScale * cropState.scale;
  const drawW = cropState.img.width * totalScale;
  const drawH = cropState.img.height * totalScale;
  const x = (size - drawW) / 2 + cropState.offsetX * 2.5;
  const y = (size - drawH) / 2 + cropState.offsetY * 2.5;

  ctx.drawImage(cropState.img, x, y, drawW, drawH);
}

function loadPhotoIntoCropper(dataUrl) {
  const img = new Image();
  img.onload = () => {
    cropState.img = img;
    const size = 240;
    cropState.baseScale = Math.max(size / img.width, size / img.height);
    cropState.scale = 1;
    cropState.offsetX = 0;
    cropState.offsetY = 0;
    const slider = document.getElementById('avatar-zoom-slider');
    if (slider) slider.value = '1';
    document.getElementById('avatar-zoom-controls').classList.remove('hidden');
    document.getElementById('btn-remove-avatar').classList.remove('hidden');
    document.getElementById('btn-center-avatar').classList.remove('hidden');
    drawAvatarCropCanvas();
  };
  img.src = dataUrl;
}

function handleEditAvatarFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    loadPhotoIntoCropper(e.target.result);
  };
  reader.readAsDataURL(file);
}

function onAvatarZoomChange(val) {
  cropState.scale = parseFloat(val) || 1;
  clampCropOffsets();
  drawAvatarCropCanvas();
}

function resetAvatarCrop() {
  cropState.scale = 1;
  cropState.offsetX = 0;
  cropState.offsetY = 0;
  const slider = document.getElementById('avatar-zoom-slider');
  if (slider) slider.value = '1';
  drawAvatarCropCanvas();
}

function clearEditAvatarPhoto() {
  cropState.img = null;
  editFormState.photo = null;
  document.getElementById('edit-avatar-input').value = '';
  document.getElementById('avatar-zoom-controls').classList.add('hidden');
  document.getElementById('btn-remove-avatar').classList.add('hidden');
  document.getElementById('btn-center-avatar').classList.add('hidden');
  drawAvatarCropCanvas();
  updateEditAvatarInitialsPreview();
}

function updateEditAvatarInitialsPreview() {
  const fn = document.getElementById('edit-first-name')?.value || '';
  const ln = document.getElementById('edit-last-name')?.value || '';
  const full = `${fn} ${ln}`.trim() || 'JR';
  document.getElementById('avatar-crop-initials').innerText = getInitials(full);
}

function openEditProfileModal(playerKey = null, prefillName = '') {
  editingOriginalKey = playerKey;
  document.getElementById('edit-modal-title').innerText = playerKey ? 'EDITAR JUGADOR' : 'NUEVO JUGADOR';

  if (playerKey) {
    const prof = ensureProfile(playerKey);
    document.getElementById('edit-first-name').value = prof.firstName || playerKey;
    document.getElementById('edit-last-name').value = prof.lastName || '';
    document.getElementById('edit-club').value = prof.club || '';
    document.getElementById('edit-notes').value = prof.notes || '';
    selectEditSex(prof.gender || 'M');
    selectEditHand(prof.hand || 'Diestro');
    selectEditPrefSide(prof.prefSide || 'Ambas');
    if (prof.photo) {
      loadPhotoIntoCropper(prof.photo);
    } else {
      clearEditAvatarPhoto();
    }
  } else {
    const parts = (prefillName || '').trim().split(/\s+/);
    document.getElementById('edit-first-name').value = parts[0] || '';
    document.getElementById('edit-last-name').value = parts.slice(1).join(' ') || '';
    document.getElementById('edit-club').value = '';
    document.getElementById('edit-notes').value = '';
    selectEditSex('M');
    selectEditHand('Diestro');
    selectEditPrefSide('Ambas');
    clearEditAvatarPhoto();
  }

  updateEditAvatarInitialsPreview();
  document.getElementById('player-edit-modal').classList.remove('hidden');
}

function closeEditProfileModal() {
  document.getElementById('player-edit-modal').classList.add('hidden');
  pendingAssignSlotAfterCreate = null;
}

function selectEditSex(g) {
  editFormState.gender = g;
  document.getElementById('edit-sex-M').classList.toggle('active', g === 'M');
  document.getElementById('edit-sex-F').classList.toggle('active', g === 'F');
}

function selectEditHand(h) {
  editFormState.hand = h;
  document.getElementById('edit-hand-R').classList.toggle('active', h === 'Diestro');
  document.getElementById('edit-hand-L').classList.toggle('active', h === 'Zurdo');
}

function selectEditPrefSide(s) {
  editFormState.prefSide = s;
  ['Drive', 'Revés', 'Ambas'].forEach(side => {
    document.getElementById(`edit-side-${side}`)?.classList.toggle('active', side === s);
  });
}

function saveEditedProfile() {
  const fn = (document.getElementById('edit-first-name').value || '').trim();
  const ln = (document.getElementById('edit-last-name').value || '').trim();
  if (!fn) {
    showToast('El nombre es obligatorio');
    return;
  }
  const fullKey = ln ? `${fn} ${ln}` : fn;

  let finalPhotoData = null;
  if (cropState.img) {
    const canvas = document.getElementById('avatar-crop-canvas');
    finalPhotoData = canvas.toDataURL('image/jpeg', 0.88);
  }

  if (editingOriginalKey && editingOriginalKey !== fullKey) {
    const idx = dbPlayers.indexOf(editingOriginalKey);
    if (idx !== -1) dbPlayers[idx] = fullKey;
    delete dbProfiles[editingOriginalKey];
    setupConfig.slots = setupConfig.slots.map(s => s === editingOriginalKey ? fullKey : s);
  } else if (!dbPlayers.includes(fullKey)) {
    dbPlayers.push(fullKey);
  }

  dbProfiles[fullKey] = {
    firstName: fn,
    lastName: ln,
    club: (document.getElementById('edit-club').value || '').trim(),
    gender: editFormState.gender,
    hand: editFormState.hand,
    prefSide: editFormState.prefSide,
    notes: (document.getElementById('edit-notes').value || '').trim(),
    photo: finalPhotoData
  };

  if (pendingAssignSlotAfterCreate !== null) {
    setupConfig.slots[pendingAssignSlotAfterCreate] = fullKey;
    pendingAssignSlotAfterCreate = null;
  }

  saveDB();
  closeEditProfileModal();
  renderSetupCourt();
  renderGlobalRanking();
  showToast(`Ficha de "${fullKey}" guardada`);
}
