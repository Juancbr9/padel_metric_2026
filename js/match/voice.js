// ==========================================================
// NARRADOR DE VOZ: CANTA EL MARCADOR TRAS CADA PUNTO
// ==========================================================
let voiceEnabled = localStorage.getItem('pm_voz') === '1';

const SPOKEN_POINTS = { '0': 'nada', '15': 'quince', '30': 'treinta', '40': 'cuarenta' };

function toggleVoiceNarrator() {
  voiceEnabled = !voiceEnabled;
  try { localStorage.setItem('pm_voz', voiceEnabled ? '1' : '0'); } catch (e) {}
  renderVoiceToggle();
  if (voiceEnabled) speak('Narrador activado');
  showToast(voiceEnabled ? 'Narrador de voz activado' : 'Narrador de voz desactivado');
  renderMenuSwitches();
}

function renderVoiceToggle() {
  document.getElementById('voice-on')?.classList.toggle('active', voiceEnabled);
  document.getElementById('voice-off')?.classList.toggle('active', !voiceEnabled);
  document.getElementById('sw-voice')?.classList.toggle('on', voiceEnabled);
}

function speak(text) {
  // En la app de Android habla la voz del sistema (la ventana web no trae voz propia)
  if (window.PadelNative) { PadelNative.hablar(text); return; }
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 1.05;
    const esVoice = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('es'));
    if (esVoice) u.voice = esVoice;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

function pairSpokenName(pairIdx) {
  return pairIdx === 0 ? 'pareja uno' : 'pareja dos';
}

function buildScoreAnnouncement() {
  if (!state) return '';
  const ev = state.lastEvent;
  if (ev && ev.kind === 'match') return `Juego, set y partido para la ${pairSpokenName(ev.pair)}`;
  if (ev && ev.kind === 'set') {
    const prev = state.sets[Math.max(0, state.currentSet - (state.matchOver ? 0 : 1))];
    return `Set para la ${pairSpokenName(ev.pair)}, ${prev[0]} a ${prev[1]}`;
  }
  if (ev && ev.kind === 'game') {
    const g = state.sets[state.currentSet];
    const extra = state.inTieBreak ? '. Tie-break' : '';
    return `Juego para la ${pairSpokenName(ev.pair)}. ${g[0]}, ${g[1]}${extra}`;
  }
  if (state.inTieBreak || state.inSuperTB) return `${state.pts[0]}, ${state.pts[1]}`;

  const srvPair = state.players[state.serverIdx].pair;
  const a = formatPointLabel(srvPair);
  const b = formatPointLabel(1 - srvPair);
  let text;
  if (a === 'ORO') text = 'Punto de oro';
  else if (a === 'AD') text = 'Ventaja al saque';
  else if (b === 'AD') text = 'Ventaja al resto';
  else if (a === b) text = a === '40' ? 'Iguales' : `${SPOKEN_POINTS[a]} iguales`;
  else text = `${SPOKEN_POINTS[a]}, ${SPOKEN_POINTS[b]}`;
  if (isBreakPointSituation() && a !== 'ORO') text += '. Bola de break';
  return text;
}

function announceScore() {
  if (!voiceEnabled) return;
  speak(buildScoreAnnouncement());
}
