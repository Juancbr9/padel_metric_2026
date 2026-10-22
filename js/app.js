function switchMainTab(tab) {
  ['setup', 'ranking', 'history'].forEach(t => {
    document.getElementById(`view-${t}`)?.classList.toggle('hidden', t !== tab);
    document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
  });
  if (tab === 'setup') renderSetupCourt();
  if (tab === 'ranking') renderGlobalRanking();
  if (tab === 'history') renderHistoryList();
}

window.addEventListener('DOMContentLoaded', () => {
  loadCustomCover();
  initAvatarCropperEvents();
  initPlayerCardInteractions();
  renderSetupCourt();
});

// App instalable y uso sin conexión
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Pide al sistema que no borre los datos guardados de la app
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
