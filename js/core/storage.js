function ensureProfile(key) {
  if (!dbProfiles[key]) {
    const parts = key.trim().split(/\s+/);
    dbProfiles[key] = {
      firstName: parts[0] || key,
      lastName: parts.slice(1).join(' ') || '',
      gender: 'M',
      club: '',
      hand: 'Diestro',
      prefSide: 'Ambas',
      notes: '',
      photo: null
    };
  }
  return dbProfiles[key];
}

function saveDB() {
  // Marca qué ha cambiado (para la sincronización entre móviles) antes de guardar
  if (typeof trackChanges === 'function') trackChanges();
  try {
    localStorage.setItem('pm_jugadores_v5', JSON.stringify(dbPlayers));
    localStorage.setItem('pm_perfiles_v6', JSON.stringify(dbProfiles));
    localStorage.setItem('pm_historial_v5', JSON.stringify(matchHistory));
    localStorage.setItem('pm_torneos_v1', JSON.stringify(tournaments));
    localStorage.setItem('pm_americanos_v1', JSON.stringify(americanos));
  } catch (err) {
    showToast('Memoria llena: exporta una copia y quita fotos o la portada');
  }
  if (typeof scheduleSync === 'function') scheduleSync();
}
