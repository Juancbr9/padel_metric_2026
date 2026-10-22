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
  try {
    localStorage.setItem('pm_jugadores_v5', JSON.stringify(dbPlayers));
    localStorage.setItem('pm_perfiles_v6', JSON.stringify(dbProfiles));
    localStorage.setItem('pm_historial_v5', JSON.stringify(matchHistory));
  } catch (err) {
    showToast('⚠️ Memoria llena: exporta la BD y quita fotos o la portada');
  }
}
