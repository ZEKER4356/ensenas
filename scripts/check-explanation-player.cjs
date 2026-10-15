/* Pistas y TTS controlados: nunca abre cámara ni utiliza datos reales. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Track extends EventTarget {
  constructor(duration) { super(); this.duration = duration; this.currentTime = 0; this.paused = true; this.src = ''; this.muted = false; this.plays = 0; }
  load() {}
  get ended() { return this.currentTime >= this.duration; }
  play() { this.paused = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
  end() { this.currentTime = this.duration; this.paused = true; this.dispatchEvent(new Event('ended')); }
}
function setup({ url = 'https://example.test/audio.mp3', interpreter = true } = {}) {
  const audio = new Track(2), video = new Track(5), doc = new EventTarget();
  const speech = { utterance: null, pauses: 0, resumes: 0, cancelled: 0, getVoices: () => [], speak(value) { this.utterance = value; value.onstart?.(); }, pause() { this.pauses++; }, resume() { this.resumes++; }, cancel() { this.cancelled++; } };
  const win = new EventTarget(); win.speechSynthesis = speech;
  const sandbox = { window: win, document: doc, location: { href: 'https://example.test/objeto' }, URL, SpeechSynthesisUtterance: class {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/explanation-player.js'), 'utf8'), sandbox);
  let latest;
  const player = win.EnsenasExplanation.create({ audio, video, hasInterpreter: () => interpreter, narration: () => ({ url, text: 'Explicación de prueba' }), onState() {}, onError() {}, onProgress(...values) { latest = values; } });
  return { audio, video, player, speech, doc, progress: () => latest };
}
(async () => {
  const shortAudio = setup(); shortAudio.player.play();
  shortAudio.audio.end();
  assert.equal(shortAudio.player.playing, true, 'Audio corto no corta la LSC');
  assert.equal(shortAudio.video.paused, false);
  shortAudio.video.currentTime = 3; shortAudio.video.dispatchEvent(new Event('timeupdate'));
  assert.deepEqual(shortAudio.progress(), [3, 5, false], 'Progreso gobernado por LSC');
  shortAudio.player.pause(); shortAudio.player.play();
  assert.equal(shortAudio.audio.plays, 1, 'Reanudar la seña no repite el audio ya terminado');
  shortAudio.video.end(); assert.equal(shortAudio.player.playing, false);
  shortAudio.player.play(); assert.equal(shortAudio.video.currentTime, 0); assert.equal(shortAudio.audio.currentTime, 0);
  const longAudio = setup(); longAudio.audio.duration = 10; longAudio.player.play(); longAudio.video.end();
  assert.equal(longAudio.audio.paused, true, 'LSC determina el final incluso si queda audio');
  const tts = setup({ url: '' }); tts.player.play(); tts.speech.utterance.onend();
  assert.equal(tts.player.playing, true, 'TTS corto tampoco corta la seña'); tts.video.end(); assert.equal(tts.player.playing, false);
  const speechPause = setup({ url: '' }); speechPause.player.play(); speechPause.player.pause(); speechPause.player.play();
  assert.equal(speechPause.speech.resumes, 1, 'Pausar/reanudar TTS no lo reinicia');
  const buffering = setup(); buffering.player.play(); buffering.video.dispatchEvent(new Event('waiting'));
  assert.equal(buffering.audio.paused, true); buffering.video.dispatchEvent(new Event('playing')); assert.equal(buffering.audio.paused, false);
  const interrupted = setup();
  interrupted.audio.play = () => Promise.reject(Object.assign(new Error(), { name: 'AbortError' }));
  interrupted.player.play(); await Promise.resolve();
  assert.equal(interrupted.speech.utterance, null, 'Buffering intencional no se trata como fallo de audio ni activa TTS');
  interrupted.audio.play = Track.prototype.play; interrupted.video.dispatchEvent(new Event('playing'));
  assert.equal(interrupted.audio.paused, false, 'El audio vuelve cuando el video está listo');
  const onlyAudio = setup({ interpreter: false }); onlyAudio.player.play(); onlyAudio.audio.end(); assert.equal(onlyAudio.player.playing, false);
  const silent = setup({ url: '' }); silent.player.play(); silent.player.mute(); assert.ok(silent.speech.pauses); silent.player.mute(); assert.ok(silent.speech.resumes);
  const failed = setup(); failed.player.play(); failed.video.dispatchEvent(new Event('error')); failed.audio.end(); assert.equal(failed.player.playing, false);
  const blocked = setup(); blocked.video.play = () => Promise.reject(Object.assign(new Error(), { name: 'NotAllowedError' })); blocked.player.play(); await Promise.resolve();
  assert.equal(blocked.player.playing, false); assert.equal(blocked.audio.paused, true);
  const hidden = setup(); hidden.player.play(); hidden.doc.hidden = true; hidden.doc.dispatchEvent(new Event('visibilitychange')); assert.equal(hidden.player.playing, false);
  console.log('OK: LSC completa con MP3/TTS cortos, audio largo, pausa/reanudar/reinicio, buffering, mute, sin intérprete, fallos, bloqueo y pestaña oculta.');
})().catch(error => { console.error(error); process.exitCode = 1; });
