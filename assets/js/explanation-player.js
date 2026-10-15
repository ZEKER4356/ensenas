/* Una explicación, dos pistas: LSC conserva su velocidad y determina el final. */
(function () {
  'use strict';
  window.EnsenasExplanation = { create };
  function create({ audio, video, hasInterpreter, narration, onState, onProgress, onError }) {
    let playing = false, finished = false, narrationDone = false, videoFailed = false;
    let utterance = null, speechPaused = false, usingSpeech = false, videoWaiting = false, generation = 0;
    const leads = () => hasInterpreter() && !videoFailed;
    const progress = () => {
      const track = leads() ? video : audio;
      onProgress(track.currentTime || 0, Number.isFinite(track.duration) ? track.duration : 0, finished);
    };
    function state(value) { playing = value; onState(value); progress(); }
    function cancelSpeech() {
      if (utterance) { utterance.onstart = null; utterance.onend = null; utterance.onerror = null; }
      if (usingSpeech) window.speechSynthesis?.cancel();
      utterance = null; speechPaused = false; usingSpeech = false;
    }
    function finish() {
      ++generation; finished = true; playing = false;
      audio.pause(); video.pause(); cancelSpeech(); state(false);
    }
    function speech(text) {
      if (!playing || narrationDone || usingSpeech || (videoWaiting && leads())) return;
      if (!text || !window.speechSynthesis) { narrationDone = true; if (!leads()) finish(); return; }
      usingSpeech = true;
      utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-CO'; utterance.rate = .95;
      const voice = window.speechSynthesis.getVoices().find(item => item.lang.startsWith('es'));
      if (voice) utterance.voice = voice;
      utterance.onstart = () => { if (audio.muted || videoWaiting) { window.speechSynthesis.pause(); speechPaused = true; } };
      utterance.onend = () => { narrationDone = true; usingSpeech = false; utterance = null; if (!leads()) finish(); };
      utterance.onerror = () => { narrationDone = true; usingSpeech = false; utterance = null; if (!leads()) finish(); };
      window.speechSynthesis.speak(utterance);
    }
    function startNarration() {
      if (!playing || narrationDone || (videoWaiting && leads())) return;
      if (usingSpeech) {
        if (speechPaused && !audio.muted) { window.speechSynthesis.resume(); speechPaused = false; }
        return;
      }
      const item = narration();
      if (!item.url) { speech(item.text); return; }
      const source = new URL(item.url, location.href).href;
      if (audio.src !== source) { audio.src = item.url; audio.load(); }
      const currentGeneration = generation;
      audio.play().catch(error => {
        // Esperar al video pausa deliberadamente una llamada play() pendiente.
        // Ese AbortError no significa que el archivo de audio haya fallado.
        if (error.name === 'AbortError') return;
        if (playing && currentGeneration === generation) speech(item.text);
      });
    }
    function reset() {
      ++generation; audio.pause(); video.pause(); cancelSpeech();
      finished = false; narrationDone = false; videoWaiting = false;
      try { audio.currentTime = 0; video.currentTime = 0; } catch (_) { /* metadata pendiente */ }
    }
    function play(options = {}) {
      if (options.restart || finished) reset();
      ++generation; state(true);
      if (leads()) {
        const currentGeneration = generation;
        video.play().catch(error => {
          if (!playing || currentGeneration !== generation) return;
          if (error.name === 'NotAllowedError') { pause(); onError('Pulsa reproducir para iniciar la explicación.'); }
          else { videoFailed = true; startNarration(); if (narrationDone) finish(); }
        });
      }
      // Ambas llamadas ocurren dentro del gesto del usuario, sin esperar una descarga.
      startNarration();
    }
    function pause() {
      ++generation; playing = false; audio.pause(); video.pause();
      if (usingSpeech) { window.speechSynthesis.pause(); speechPaused = true; }
      state(false);
    }
    audio.addEventListener('ended', () => { if (!audio.ended) return; narrationDone = true; if (!leads()) finish(); else progress(); });
    audio.addEventListener('error', () => { if (playing) speech(narration().text); });
    video.addEventListener('ended', () => { if (video.ended && leads()) finish(); });
    video.addEventListener('error', () => { videoFailed = true; if (playing) { startNarration(); if (narrationDone) finish(); } });
    video.addEventListener('waiting', () => {
      if (!playing || !leads()) return;
      videoWaiting = true;
      audio.pause();
      if (usingSpeech) { window.speechSynthesis.pause(); speechPaused = true; }
    });
    video.addEventListener('playing', () => { videoWaiting = false; if (playing && leads()) startNarration(); });
    for (const track of [audio, video]) {
      for (const event of ['loadedmetadata', 'durationchange', 'timeupdate']) track.addEventListener(event, progress);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('pagehide', () => { pause(); cancelSpeech(); });
    return { play, pause, progress, get playing() { return playing; }, mute() {
      audio.muted = !audio.muted;
      if (usingSpeech && utterance) {
        if (audio.muted) { window.speechSynthesis.pause(); speechPaused = true; }
        else if (playing && !videoWaiting) { window.speechSynthesis.resume(); speechPaused = false; }
      }
      return audio.muted;
    } };
  }
})();
