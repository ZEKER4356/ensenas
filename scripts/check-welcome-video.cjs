/* Video editorial local servido en su URL pública: no modifica Storage ni usa datos personales. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));
const ROOT = path.resolve(__dirname, '..'), ORIGIN = 'http://127.0.0.1:4173';
const SOURCE = 'https://xpznsdwforvjnqnvmivz.supabase.co/storage/v1/object/public/ensenas-media/landing/bienvenida-landing.mp4';
(async () => {
  const clip = await fs.readFile(process.env.ENSENAS_WELCOME_FIXTURE || path.join(ROOT, 'videos-lsc/listos-para-subir/bienvenida-landing.mp4'));
  const clips = new Map([[SOURCE, clip]]), sources = [];
  for (const [key, file] of [['catalogo', 'catalogo'], ['sube-tu-sena', 'sube-tu-sena'], ['comunidad', 'comunidad'], ['leaderboard', 'leaderboard'], ['equipo', 'equipo-trabajo']]) {
    const url = `https://media.example.test/${file}.mp4`;
    clips.set(url, await fs.readFile(path.join(ROOT, 'videos-lsc/listos-para-subir/tarjetas', file + '.mp4')));
    sources.push({ clave: 'nav.' + key, etiqueta: file, video_url: url, activo: true });
  }
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => {
      const clip = clips.get(route.request().url());
      if (!clip) return route.abort();
      const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
      if (!range) return route.fulfill({ body: clip, contentType: 'video/mp4', headers: { 'accept-ranges': 'bytes' } });
      const start = Number(range[1]), end = Math.min(clip.length - 1, range[2] ? Number(range[2]) : clip.length - 1);
      return route.fulfill({ status: 206, body: clip.subarray(start, end + 1), contentType: 'video/mp4', headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${clip.length}` } });
    });
    await page.route(`${ORIGIN}/**`, async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.startsWith('/api/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, items: route.request().url().includes('action=interpretaciones') ? sources : [] }) });
      const file = path.resolve(ROOT, '.' + decodeURIComponent(pathname)); assert.ok(file.startsWith(ROOT + path.sep));
      try { return route.fulfill({ body: await fs.readFile(file), contentType: { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream' }); }
      catch (_) { return route.fulfill({ status: 404, body: '' }); }
    });
    await page.goto(`${ORIGIN}/index.html`);
    await page.waitForFunction(() => { const v = document.querySelector('#welcome-video'); return !v.paused && v.readyState >= 2; });
    assert.deepEqual(await page.locator('#welcome-video').evaluate(v => ({ src: v.src, muted: v.muted, loop: v.loop, width: v.videoWidth, height: v.videoHeight })), { src: SOURCE, muted: true, loop: false, width: 1080, height: 1080 });
    for (const width of [320, 360, 390, 430, 768, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => window.EnsenasTheme.applyTheme(theme), theme);
        const media = await page.locator('.welcome-video-card').boundingBox(), copy = await page.locator('.welcome-copy').boundingBox();
        assert.ok(media.x >= 0 && media.x + media.width <= width + 1);
        assert.equal(await page.locator('#welcome-video').evaluate(v => getComputedStyle(v).objectFit), 'contain');
        if (width <= 700) {
          assert.ok(copy.y >= media.y + media.width - 1, 'Cuadrado completo antes del texto, sin tapar rostro/manos');
          assert.ok(copy.y + copy.height <= media.y + media.height + 1, 'Texto integrado sobre la extensión inferior del escenario');
          const frame = await page.locator('#welcome-video').boundingBox();
          assert.ok(Math.abs(frame.width - frame.height) < 1 && frame.y < copy.y, 'Video cuadrado, primero y sin recorte');
          const backdrop = await page.locator('#welcome-video-backdrop').boundingBox();
          assert.ok(backdrop.y < copy.y && backdrop.y + backdrop.height >= copy.y + copy.height, 'Fotogramas del video detrás de todo el texto, no caja blanca independiente');
          assert.equal(await page.locator('.welcome-copy').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
          assert.equal(await page.locator('.welcome-copy').evaluate(el => getComputedStyle(el).gridArea), await page.locator('.welcome-video-card').evaluate(el => getComputedStyle(el).gridArea), 'Video y copia comparten una celda: capas superpuestas, no dos filas');
        } else assert.ok(media.x >= copy.x + copy.width, 'PC conserva dos columnas');
        const typingDuration = Number(await page.locator('.welcome-hero').getAttribute('data-text-duration-ms'));
        assert.ok(width <= 700 ? typingDuration >= 12500 && typingDuration <= 13000 : typingDuration >= 8000 && typingDuration <= 8500, 'Móvil más lento sin alterar el ritmo de PC');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        if (width <= 700) {
          const preview = await page.locator('.lsc-inline-media').first().boundingBox();
          assert.ok(preview.width <= 181 && preview.width < media.width / 2, 'Tarjetas mayores pero subordinadas al video principal');
          assert.ok((await page.locator('.welcome-path').first().boundingBox()).height >= 190, 'Tarjetas móviles más altas');
          assert.ok(await page.locator('.welcome-path p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 13), 'Texto base de las tarjetas más legible');
          assert.ok(await page.locator('.welcome-path h3').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 18), 'Título de acceso más grande');
          const button = await page.locator('.welcome-path-action').first().boundingBox();
          const card = await page.locator('.welcome-path').first().boundingBox();
          assert.ok(button.height >= 48 && button.width >= card.width - 40, 'Acción con aspecto de botón ancho y área táctil suficiente');
          assert.ok(await page.locator('.welcome-path-action').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16 && getComputedStyle(el).color === 'rgb(255, 255, 255)' && getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'), 'Botón de color sólido, letra grande y contrastada');
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#welcome-video-backdrop').evaluate(canvas => {
      const context = canvas.getContext('2d'), draw = context.drawImage;
      window.testBackdropPaints = 0;
      context.drawImage = function (...args) { window.testBackdropPaints++; return draw.apply(this, args); };
    });
    await page.locator('#welcome-pause').click();
    assert.equal(await page.locator('#welcome-video').evaluate(v => v.paused), true);
    const time = await page.locator('#welcome-video').evaluate(v => v.currentTime); await page.waitForTimeout(200);
    assert.ok(Math.abs(await page.locator('#welcome-video').evaluate(v => v.currentTime) - time) < .03);
    const pausedPaints = await page.evaluate(() => window.testBackdropPaints);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.testBackdropPaints), pausedPaints, 'La pausa detiene también el fondo del video');
    await page.locator('#welcome-pause').click();
    await page.waitForFunction(() => !document.querySelector('#welcome-video').paused);
    await page.waitForFunction(count => window.testBackdropPaints > count, pausedPaints);
    // Al salir de vista no descarga/reproduce continuamente la bienvenida.
    await page.evaluate(() => {
      const spacer = document.createElement('div'); spacer.id = 'test-scroll-space'; spacer.style.height = '100vh'; document.body.append(spacer);
      scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
    });
    await page.waitForFunction(() => document.querySelector('#welcome-video').paused);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForFunction(() => !document.querySelector('#welcome-video').paused);
    await page.locator('#test-scroll-space').evaluate(el => el.remove());
    await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
    await page.locator('#site-reduce-motion').check();
    assert.equal(await page.locator('#welcome-video').evaluate(v => v.paused), true);
    assert.equal(await page.locator('#welcome-message-animated').textContent(), await page.locator('#welcome-message-full').textContent());
    await page.getByRole('button', { name: 'Cerrar accesibilidad' }).click();
    await page.locator('#welcome-pause').click();
    await page.waitForFunction(() => !document.querySelector('#welcome-video').paused);
    await page.locator('#welcome-pause').click();
    assert.equal(await page.locator('#welcome-video').evaluate(v => v.paused), true, 'Puede pausar una reproducción manual incluso con movimiento reducido');
    await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
    await page.locator('#site-reduce-motion').uncheck();
    await page.getByRole('button', { name: 'Cerrar accesibilidad' }).click();
    await page.locator('#welcome-replay').click();
    await page.waitForFunction(() => { const v = document.querySelector('#welcome-video'); return !v.paused && v.currentTime < 1; });
    const duration = Number(await page.locator('.welcome-hero').getAttribute('data-text-duration-ms'));
    assert.ok(duration >= 12500 && duration <= 13000, 'Texto móvil calculado a ~12,8 s para el video de ~18,2 s');
    // Pausar únicamente la pista de video simula buffering: el texto tiene reloj propio.
    await page.locator('#welcome-video').evaluate(v => v.pause());
    await page.evaluate(() => {
      window.welcomeTextSamples = [];
      new MutationObserver(() => window.welcomeTextSamples.push(document.querySelector('#welcome-title-animated').textContent.length + document.querySelector('#welcome-message-animated').textContent.length))
        .observe(document.querySelector('.welcome-copy'), { childList: true, characterData: true, subtree: true });
    });
    const textStart = Date.now();
    try { await page.waitForFunction(() => document.querySelector('#welcome-message-animated').textContent === document.querySelector('#welcome-message-full').textContent, null, { timeout: 16000 }); }
    catch (error) {
      console.log(await page.evaluate(() => ({ animated: document.querySelector('#welcome-message-animated').textContent, full: document.querySelector('#welcome-message-full').textContent, title: document.querySelector('#welcome-title-animated').textContent, duration: document.querySelector('.welcome-hero').dataset.textDurationMs, hero: document.querySelector('.welcome-hero').getBoundingClientRect().toJSON(), hidden: document.hidden, paused: document.querySelector('#welcome-pause').textContent, root: document.documentElement.outerHTML.slice(0, 450) })));
      throw error;
    }
    assert.ok(Date.now() - textStart < 15500, 'No depende del avance del video');
    assert.equal(await page.locator('#welcome-video').evaluate(v => v.paused && v.currentTime < 1), true);
    const samples = await page.evaluate(() => window.welcomeTextSamples);
    assert.ok(samples.length > 100, 'Actualizaciones pequeñas por requestAnimationFrame, no saltos de timeupdate');
    assert.ok(samples.every((value, index) => !index || value >= samples[index - 1]), 'El texto no retrocede');
    await page.locator('#welcome-video').evaluate(v => v.play());
    await page.locator('#welcome-video').evaluate(v => { v.currentTime = v.duration - .2; });
    await page.waitForFunction(() => document.querySelector('#welcome-video').ended);
    const holdStart = Date.now();
    await page.waitForTimeout(2000);
    assert.equal(await page.locator('#welcome-video').evaluate(v => v.ended && v.paused), true, 'Mantiene el último fotograma durante la tolerancia');
    await page.locator('#welcome-pause').click(); await page.waitForTimeout(500);
    assert.equal(await page.locator('#welcome-video').evaluate(v => v.ended), true, 'Pausa también congela la espera restante');
    await page.locator('#welcome-pause').click();
    await page.waitForFunction(() => !document.querySelector('#welcome-video').paused && document.querySelector('#welcome-video').currentTime < 1);
    assert.ok(Date.now() - holdStart >= 5350, 'Espera 5 s más la pausa manual antes de repetir');
    assert.equal(await page.locator('#welcome-message-animated').textContent(), await page.locator('#welcome-message-full').textContent(), 'El bucle del video no borra el texto completo');
    await page.waitForFunction(() => { const v = document.querySelector('#welcome-video'); return !v.seeking && v.currentTime > .25 && v.currentTime < 2; });
    for (const width of [320, 390, 430, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#welcome-video').evaluate(async v => { v.pause(); v.currentTime = 5; await new Promise(resolve => v.addEventListener('seeked', resolve, { once: true })); });
      try { await page.waitForFunction(() => document.querySelector('#welcome-title-animated').textContent.length > 0, null, { timeout: 3000 }); }
      catch (error) { console.log(await page.evaluate(() => ({ current: document.querySelector('#welcome-video').currentTime, duration: document.querySelector('#welcome-video').duration, title: document.querySelector('#welcome-title-animated').textContent, message: document.querySelector('#welcome-message-animated').textContent, config: window.ENSENAS_WELCOME, errors: document.querySelector('#welcome-video').error?.message }))); throw error; }
      if (process.env.ENSENAS_SCREENSHOTS_DIR) {
        for (const theme of ['light', 'dark']) {
          await page.evaluate(theme => window.EnsenasTheme.applyTheme(theme), theme);
          await page.waitForTimeout(200);
          await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, `welcome-real-${width}-${theme}.png`), fullPage: true });
        }
      }
      await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
      await page.locator('#site-text-size').selectOption('150');
      await page.getByRole('button', { name: 'Cerrar accesibilidad' }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Texto ampliado sin desbordamiento');
      if (width <= 700) {
        const frame = await page.locator('#welcome-video').boundingBox(), copy = await page.locator('.welcome-copy').boundingBox();
        assert.ok(copy.y >= frame.y + frame.height - 1, 'Ampliar texto no invade el espacio del intérprete');
      }
      await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
      await page.getByRole('button', { name: /Restablecer configuración/ }).click();
      await page.getByRole('button', { name: 'Cerrar accesibilidad' }).click();
    }
    assert.deepEqual(errors, []);
    console.log('OK: MP4 real 1080², video primero y texto inferior integrado en móvil, texto independiente ~12,8 s móvil / ~8,2 s PC, espera de 5 s pausable, 6 anchos, temas, pausa/reinicio, salida de vista, movimiento reducido y texto ampliado.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
