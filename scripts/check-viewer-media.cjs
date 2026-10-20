/* HTML/CSS y controlador reales; modelo 3D/cámara simulados, MP3 equivalente WAV y video reales. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));
const ROOT = path.resolve(__dirname, '..'), ORIGIN = 'http://127.0.0.1:4173';
function wav(seconds) {
  const rate = 8000, size = rate * seconds * 2, bytes = Buffer.alloc(44 + size);
  bytes.write('RIFF'); bytes.writeUInt32LE(size + 36, 4); bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(size, 40);
  return bytes;
}
(async () => {
  const html = await fs.readFile(path.join(ROOT, 'objeto.html'), 'utf8');
  const section = html.match(/<section id="ar-scene-container"[\s\S]*?<\/section>/)[0];
  const ar = (await fs.readFile(path.join(ROOT, 'assets/js/ar-viewer.js'), 'utf8')).replace('  initThreeScene();', `
    const pose = () => ({ set() {}, copy() {}, identity() {} });
    const group = () => ({ position: pose(), quaternion: pose(), scale: pose(), visible: true });
    scene = { getObjectByName: () => ({ visible: true }) }; objectGroup = group(); reticleGroup = group(); groundShadow = group();
    camera = { updateProjectionMatrix() {}, lookAt() {} }; renderer = { setSize() {} };
  `);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    // Este clip no representa LSC y nunca se sube a la plataforma.
    const clip = Buffer.from(await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240; document.body.append(canvas);
      const ctx = canvas.getContext('2d'), stream = canvas.captureStream(12), chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      return new Promise(resolve => {
        recorder.ondataavailable = event => chunks.push(event.data);
        const timer = setInterval(() => { ctx.fillStyle = Date.now() % 1000 < 500 ? '#2563eb' : '#7c3aed'; ctx.fillRect(0, 0, 240, 240); }, 80);
        recorder.onstop = async () => { clearInterval(timer); stream.getTracks().forEach(track => track.stop()); resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]); };
        recorder.start(100); setTimeout(() => recorder.stop(), 3000);
      });
    }));
    assert.ok(clip.length > 200);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'xr', { value: undefined, configurable: true });
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
        const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120;
        const ctx = canvas.getContext('2d'); setInterval(() => { ctx.fillStyle = '#475569'; ctx.fillRect(0, 0, 160, 120); }, 80);
        return canvas.captureStream(12);
      } });
    });
    let audioSeconds = 1;
    await page.route(`${ORIGIN}/**`, async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/clip.webm') return route.fulfill({ body: clip, contentType: 'video/webm' });
      if (pathname === '/audio.wav') return route.fulfill({ body: wav(audioSeconds), contentType: 'audio/wav' });
      if (pathname === '/objeto.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="assets/css/style.css"><link rel="stylesheet" href="assets/css/community.css"><script src="assets/js/explanation-player.js"></script></head><body><main class="main-layout">${section}</main><script>window.ENSENAS_DATA={objectId:'prueba',videoLscUrl:'${ORIGIN}/clip.webm',audioUrl:'${ORIGIN}/audio.wav'};</script></body></html>` });
      const file = path.resolve(ROOT, '.' + pathname); assert.ok(file.startsWith(ROOT + path.sep));
      return route.fulfill({ body: await fs.readFile(file), contentType: pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
    });
    async function load() {
      await page.goto(`${ORIGIN}/objeto.html`, { waitUntil: 'networkidle' }); await page.addScriptTag({ content: ar });
      await page.waitForFunction(() => document.querySelector('#ar-overlay-video-lsc').readyState >= 2);
      assert.equal(await page.locator('#ar-overlay-video-lsc').evaluate(video => video.paused), true, 'Sin autoplay de audio al abrir la ficha');
    }
    await load();
    for (const width of [320, 360, 390, 430, 768, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      const box = await page.locator('#ar-floating-lsc').boundingBox();
      assert.ok(box.width >= 149 && box.width <= (width <= 700 ? 221 : 256), 'Intérprete ligeramente mayor, dejando libre la interacción');
      assert.equal(await page.locator('#ar-floating-lsc').evaluate(el => el.parentElement.id), 'ar-canvas-host');
      const host = await page.locator('#ar-canvas-host').boundingBox();
      assert.ok(box.x >= host.x && box.y >= host.y && box.x + box.width <= host.x + host.width + 1 && box.y + box.height <= host.y + host.height + 1, `Intérprete dentro del visualizador a ${width}px: ${JSON.stringify({ box, host })}`);
      if (width <= 700) {
        const audio = await page.locator('#ar-floating-audio').boundingBox();
        assert.ok(box.y + box.height + 8 <= audio.y, 'No tapa los controles de reproducción');
      }
      assert.equal(await page.locator('#ar-overlay-video-lsc').evaluate(el => getComputedStyle(el).objectFit), 'contain');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (process.env.ENSENAS_SCREENSHOTS_DIR) await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, 'viewer-large-lsc-mobile.png'), fullPage: true });
    await page.locator('#btn-ar-audio-play').click();
    await page.waitForFunction(() => document.querySelector('#ar-audio-element').ended);
    assert.equal(await page.locator('#ar-overlay-video-lsc').evaluate(video => video.paused), false, 'Audio terminado, intérprete todavía reproduciéndose');
    assert.equal(await page.locator('#btn-ar-audio-play').evaluate(el => el.classList.contains('is-playing')), true);
    await page.locator('#btn-ar-audio-play').click();
    const paused = await page.locator('#ar-overlay-video-lsc').evaluate(video => video.currentTime);
    await page.waitForTimeout(200);
    assert.ok(Math.abs(await page.locator('#ar-overlay-video-lsc').evaluate(video => video.currentTime) - paused) < .05);
    await page.locator('#btn-ar-audio-play').click();
    await page.waitForFunction(() => document.querySelector('#ar-overlay-video-lsc').ended);
    assert.equal(await page.locator('#btn-ar-audio-play').evaluate(el => el.classList.contains('is-playing')), false);
    // Cambia a cámara simulada, coloca y ambos arrancan en ese mismo clic.
    await page.locator('#btn-toggle-ar-mode').click();
    await page.waitForSelector('.ar-mode-active.is-scanning');
    await page.evaluate(() => { window.testMediaEvents = []; for (const el of document.querySelectorAll('audio, #ar-overlay-video-lsc')) for (const type of ['play', 'playing', 'pause', 'ended', 'seeking', 'seeked', 'error']) el.addEventListener(type, () => window.testMediaEvents.push({ id: el.id, type, time: el.currentTime, now: performance.now() })); });
    await page.locator('#btn-anchor-here').click();
    try { await page.waitForFunction(() => !document.querySelector('#ar-overlay-video-lsc').paused && !document.querySelector('#ar-audio-element').paused, null, { timeout: 5000 }); }
    catch (error) { console.log(JSON.stringify({ errors, state: await page.evaluate(() => ({ events: window.testMediaEvents, videos: [...document.querySelectorAll('video, audio')].map(el => ({ id: el.id, paused: el.paused, ended: el.ended, time: el.currentTime, duration: el.duration, error: el.error?.message })), status: document.querySelector('#ar-audio-time').textContent, playing: document.querySelector('#btn-ar-audio-play').className })) }, null, 2)); throw error; }
    assert.equal(await page.locator('#ar-floating-lsc').evaluate(el => el.parentElement.id), 'ar-canvas-host');
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      const box = await page.locator('#ar-floating-lsc').boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1, `Intérprete ampliado dentro de RA ${JSON.stringify(size)}: ${JSON.stringify(box)}`);
    }
    if (process.env.ENSENAS_SCREENSHOTS_DIR) await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, 'viewer-ra-lsc-landscape.png') });
    await page.locator('#btn-reanchor-view').click();
    assert.equal(await page.locator('#ar-overlay-video-lsc').evaluate(video => video.paused), true, 'Volver a escanear pausa la explicación');
    assert.equal(await page.locator('#ar-audio-element').evaluate(audio => audio.paused), true);
    audioSeconds = 6; await load();
    await page.locator('#btn-ar-audio-play').click();
    await page.waitForFunction(() => document.querySelector('#ar-overlay-video-lsc').ended);
    assert.equal(await page.locator('#ar-audio-element').evaluate(audio => audio.paused && audio.currentTime < audio.duration - 1), true, 'Final LSC detiene el audio largo');
    assert.deepEqual(errors, []);
    console.log('OK: medios reales, audio corto/largo, pausa/reanudar, intérprete grande sin recorte, colocación RA con inicio automático y reanclaje. 3D y cámara simulados; no certifica WebXR físico.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
