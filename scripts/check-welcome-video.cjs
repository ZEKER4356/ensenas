/* Video editorial local servido en su URL pública: no modifica Storage ni usa datos personales. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));
const ROOT = path.resolve(__dirname, '..'), ORIGIN = 'http://127.0.0.1:4173';
const SOURCE = 'https://xpznsdwforvjnqnvmivz.supabase.co/storage/v1/object/public/ensenas-media/landing/bienvenida-landing.mp4';
(async () => {
  const clip = await fs.readFile(process.env.ENSENAS_WELCOME_FIXTURE || path.join(ROOT, 'videos-lsc/listos-para-subir/bienvenida-landing.mp4'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => {
      if (route.request().url() !== SOURCE) return route.abort();
      const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
      if (!range) return route.fulfill({ body: clip, contentType: 'video/mp4', headers: { 'accept-ranges': 'bytes' } });
      const start = Number(range[1]), end = Math.min(clip.length - 1, range[2] ? Number(range[2]) : clip.length - 1);
      return route.fulfill({ status: 206, body: clip.subarray(start, end + 1), contentType: 'video/mp4', headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${clip.length}` } });
    });
    await page.route(`${ORIGIN}/**`, async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.startsWith('/api/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, items: [] }) });
      const file = path.resolve(ROOT, '.' + decodeURIComponent(pathname)); assert.ok(file.startsWith(ROOT + path.sep));
      try { return route.fulfill({ body: await fs.readFile(file), contentType: { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream' }); }
      catch (_) { return route.fulfill({ status: 404, body: '' }); }
    });
    await page.goto(`${ORIGIN}/index.html`);
    await page.waitForFunction(() => { const v = document.querySelector('#welcome-video'); return !v.paused && v.readyState >= 2; });
    assert.deepEqual(await page.locator('#welcome-video').evaluate(v => ({ src: v.src, muted: v.muted, loop: v.loop, width: v.videoWidth, height: v.videoHeight })), { src: SOURCE, muted: true, loop: true, width: 1080, height: 1080 });
    for (const width of [320, 360, 390, 430, 768, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => window.EnsenasTheme.applyTheme(theme), theme);
        const media = await page.locator('.welcome-video-card').boundingBox(), copy = await page.locator('.welcome-copy').boundingBox();
        assert.ok(media.x >= 0 && media.x + media.width <= width + 1);
        assert.equal(await page.locator('#welcome-video').evaluate(v => getComputedStyle(v).objectFit), 'contain');
        assert.ok(width <= 700 ? media.y >= copy.y + copy.height : media.x >= copy.x + copy.width, 'Sin texto sobre rostro/manos');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#welcome-pause').click();
    assert.equal(await page.locator('#welcome-video').evaluate(v => v.paused), true);
    const time = await page.locator('#welcome-video').evaluate(v => v.currentTime); await page.waitForTimeout(200);
    assert.ok(Math.abs(await page.locator('#welcome-video').evaluate(v => v.currentTime) - time) < .03);
    await page.locator('#welcome-pause').click();
    await page.waitForFunction(() => !document.querySelector('#welcome-video').paused);
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
    await page.locator('#site-reduce-motion').uncheck();
    await page.getByRole('button', { name: 'Cerrar accesibilidad' }).click();
    await page.locator('#welcome-replay').click();
    await page.waitForFunction(() => { const v = document.querySelector('#welcome-video'); return !v.paused && v.currentTime < 1; });
    await page.locator('#welcome-video').evaluate(v => { v.currentTime = v.duration - .2; });
    await page.waitForFunction(() => document.querySelector('#welcome-video').currentTime < 1);
    await page.waitForFunction(() => { const v = document.querySelector('#welcome-video'); return !v.seeking && v.currentTime > .25 && v.currentTime < 2; });
    for (const width of [390, 1366]) {
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
      await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
      await page.getByRole('button', { name: /Restablecer configuración/ }).click();
      await page.getByRole('button', { name: 'Cerrar accesibilidad' }).click();
    }
    assert.deepEqual(errors, []);
    console.log('OK: bienvenida MP4 real 1080², 6 anchos, claro/oscuro, sin recortes/superposición, pausa/reinicio/bucle, salida de vista, movimiento reducido y texto ampliado. URL servida con copia local; HEAD público verificado aparte.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
