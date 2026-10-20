/* LSC visible conserva su velocidad y determina el final; oculta, el audio es independiente. */
(function () {
  'use strict';
  window.EnsenasExplanation = { create };
  function create({ audio, video, hasInterpreter, narration, onState, onProgress, onError }) {
    let playing = false, finished = false, narrationDone = false, videoFailed = false;
    let utterance = null, speechPaused = false, usingSpeech = false, videoWaiting = false, generation = 0;
    let interpreterVisible = true, audioTail = false, videoRequest = 0;
    let pendingSeek = null, requestedEndFrame = false;
    let hiddenVideoTime = 0, hiddenAudioTime = 0, hiddenAt = null, hiddenUsesAudio = false;
    const leads = () => hasInterpreter() && !videoFailed && interpreterVisible && !audioTail;
    const hiddenPosition = () => hiddenVideoTime + (hiddenUsesAudio
      ? Math.max(0, (audio.currentTime || 0) - hiddenAudioTime)
      : hiddenAt === null ? 0 : Math.max(0, Date.now() - hiddenAt) / 1000);
    function snapshotHidden(position, useAudio = hiddenUsesAudio, running = playing) {
      hiddenVideoTime = position; hiddenAudioTime = audio.currentTime || 0;
      hiddenUsesAudio = useAudio; hiddenAt = running ? Date.now() : null;
    }
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
      if (!interpreterVisible) snapshotHidden(hiddenPosition(), hiddenUsesAudio, false);
      ++generation; finished = true; playing = false;
      audio.pause(); video.pause(); cancelSpeech(); state(false);
    }
    function speech(text) {
      if (!playing || narrationDone || usingSpeech || (videoWaiting && leads())) return;
      if (!text || !window.speechSynthesis) { narrationDone = true; if (!leads()) finish(); return; }
      if (!interpreterVisible && hiddenUsesAudio) snapshotHidden(hiddenPosition(), false);
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
      audioTail = false;
      pendingSeek = null; ++videoRequest;
      try { audio.currentTime = 0; video.currentTime = 0; } catch (_) { /* metadata pendiente */ }
      snapshotHidden(0, !!narration().url, false);
    }
    function playVideo() {
      const currentGeneration = generation, request = ++videoRequest;
      video.play().catch(error => {
        if (!playing || currentGeneration !== generation || request !== videoRequest || !interpreterVisible || error.name === 'AbortError') return;
        if (error.name === 'NotAllowedError') { pause(); onError('Pulsa reproducir para iniciar la explicación.'); }
        else { videoFailed = true; startNarration(); if (narrationDone) finish(); }
      });
    }
    function play(options = {}) {
      if (options.restart || finished) reset();
      if (!interpreterVisible) snapshotHidden(hiddenPosition(), hiddenUsesAudio, true);
      ++generation; state(true);
      if (leads() && pendingSeek === null) playVideo();
      // Ambas llamadas ocurren dentro del gesto del usuario, sin esperar una descarga.
      startNarration();
    }
    function pause() {
      if (!interpreterVisible) snapshotHidden(hiddenPosition(), hiddenUsesAudio, false);
      ++generation; playing = false; audio.pause(); video.pause();
      if (usingSpeech) { window.speechSynthesis.pause(); speechPaused = true; }
      state(false);
    }
    function setInterpreterVisible(visible) {
      if (interpreterVisible === visible) return;
      if (!visible) {
        snapshotHidden(video.currentTime || 0, !!narration().url && !usingSpeech);
        interpreterVisible = false; pendingSeek = null; ++videoRequest; video.pause(); videoWaiting = false;
        // Cerrar la imagen no pausa la narración, ni la hace esperar al video oculto.
        if (playing) { startNarration(); if (narrationDone) finish(); }
      } else {
        const position = hiddenPosition();
        interpreterVisible = true;
        seekInterpreter(position);
      }
      progress();
    }
    function seekInterpreter(position) {
      pendingSeek = position; requestedEndFrame = false; ++videoRequest;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      audioTail = duration > 0 && position >= duration;
      try { video.currentTime = duration > 0 ? Math.min(position, duration) : position; } catch (_) { return; }
      if (!video.seeking) completeInterpreterSeek();
    }
    function completeInterpreterSeek() {
      if (pendingSeek === null || !interpreterVisible || video.seeking) return;
      const position = pendingSeek;
      // La duración de ciertos WebM solo se conoce tras buscar el fotograma.
      // Esperar seeked evita que play() reinicie un video que ya había terminado.
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      audioTail = video.ended || (duration > 0 && position >= duration);
      if (audioTail && duration > 0 && video.currentTime < duration - .02 && !requestedEndFrame) {
        requestedEndFrame = true;
        try { video.currentTime = Math.max(0, duration - .001); } catch (_) { /* búsqueda no disponible */ }
        if (video.seeking) return;
      }
      pendingSeek = null; hiddenAt = null;
      videoWaiting = false;
      if (playing) { if (leads()) playVideo(); else startNarration(); }
      progress();
    }
    video.addEventListener('seeked', completeInterpreterSeek);
    video.addEventListener('loadedmetadata', () => {
      if (pendingSeek !== null && interpreterVisible) seekInterpreter(hiddenPosition());
    });
    audio.addEventListener('ended', () => { if (!audio.ended) return; narrationDone = true; if (!leads()) finish(); else progress(); });
    audio.addEventListener('error', () => { if (playing) speech(narration().text); });
    video.addEventListener('ended', () => {
      if (pendingSeek !== null) { completeInterpreterSeek(); return; }
      if (video.ended && leads()) finish();
    });
    video.addEventListener('error', () => { videoFailed = true; if (playing) { startNarration(); if (narrationDone) finish(); } });
    video.addEventListener('waiting', () => {
      if (!playing || !leads()) return;
      videoWaiting = true;
      audio.pause();
      if (usingSpeech) { window.speechSynthesis.pause(); speechPaused = true; }
    });
    video.addEventListener('playing', () => {
      if (!interpreterVisible) { video.pause(); return; }
      videoWaiting = false; if (playing && leads()) startNarration();
    });
    for (const track of [audio, video]) {
      for (const event of ['loadedmetadata', 'durationchange', 'timeupdate']) track.addEventListener(event, progress);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('pagehide', () => { pause(); cancelSpeech(); });
    return { play, pause, progress, setInterpreterVisible, get playing() { return playing; }, mute() {
      audio.muted = !audio.muted;
      if (usingSpeech && utterance) {
        if (audio.muted) { window.speechSynthesis.pause(); speechPaused = true; }
        else if (playing && !videoWaiting) { window.speechSynthesis.resume(); speechPaused = false; }
      }
      return audio.muted;
    } };
  }
})();
