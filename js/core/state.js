const FIXED_COURT_SIDES = ['Drive', 'Revés', 'Revés', 'Drive'];

let dbPlayers = JSON.parse(localStorage.getItem('pm_jugadores_v5')) || [];
let dbProfiles = JSON.parse(localStorage.getItem('pm_perfiles_v6')) || {};
let matchHistory = JSON.parse(localStorage.getItem('pm_historial_v5')) || [];
let tournaments = JSON.parse(localStorage.getItem('pm_torneos_v1')) || [];
let americanos = JSON.parse(localStorage.getItem('pm_americanos_v1')) || [];

// Preferencias de la app (menú de ajustes)
let appSettings = Object.assign({ vibration: true, wakeLock: true }, JSON.parse(localStorage.getItem('pm_ajustes_v1') || '{}'));

let setupConfig = {
  slots: ['GEN_0', 'GEN_1', 'GEN_2', 'GEN_3'],
  deuceRule: 'adv',
  thirdSetRule: 'normal',
  inputMode: 'tap', // 'tap' o 'swipe'
  initialServer: 0
};
let rankingSortBy = 'elo';
let rankingGenderFilter = 'all';
let editingOriginalKey = null;
let pendingAssignSlotAfterCreate = null;
let editFormState = { gender: 'M', hand: 'Diestro', prefSide: 'Ambas', photo: null };

// Estado del encuadrador circular interactivo
let cropState = {
  img: null,
  scale: 1,
  baseScale: 1,
  offsetX: 0,
  offsetY: 0,
  dragging: false,
  startX: 0,
  startY: 0
};

let activePickerSlot = null;
let state = null;
let posterTargetState = null;
let statsSourceIsHistory = false;
let historyStack = [];
let selectedSlot = null;
let currentStatsMode = 'ind';
let currentSetFilter = 'all';
let wakeLockRef = null;
let timerInterval = null;
let toastTimeout = null;
