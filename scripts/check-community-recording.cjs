/* Cámara simulada con canvas, MediaRecorder real; API/Storage simulados, sin publicar videos. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));
const ROOT = path.resolve(__dirname, '..'), ORIGIN = 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    let loggedIn = false, googleFails = false, sent = 0, uploads = 0, reserved;
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.cameraMode = 'allow'; window.cameraTracks = []; window.cameraConstraints = [];
      navigator.mediaDevices.getUserMedia = async constraints => {
        window.cameraConstraints.push(constraints);
        if (window.cameraMode === 'deny') throw new DOMException('Permission denied', 'NotAllowedError');
        const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
        const context = canvas.getContext('2d');
        context.fillStyle = '#7c3aed'; context.fillRect(0, 0, canvas.width, canvas.height);
        const stream = canvas.captureStream(30); let frame = 0;
        const interval = setInterval(() => { context.fillStyle = ++frame % 2 ? '#7c3aed' : '#2563eb'; context.fillRect(0, 0, canvas.width, canvas.height); }, 33);
        stream.getTracks().forEach(track => { window.cameraTracks.push(track); const stop = track.stop.bind(track); track.stop = () => { clearInterval(interval); stop(); }; });
        return stream;
      };
    });
    await page.route('https://**/*', route => route.abort());
    await page.route(`${ORIGIN}/**`, async route => {
      const url = new URL(route.request().url());
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.pathname === '/storage-upload') { uploads++; return json({ success: true }); }
      if (url.pathname === '/api/comunidad') {
        const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
        const action = body.action || url.searchParams.get('action');
        if (action === 'config') return json({ success: true, google: true, email_signup: false, app_url: ORIGIN });
        if (action === 'sesion') return loggedIn ? json({ success: true, user: { id: 'member', alias: 'Mi alias' } }) : json({ success: false, error: 'Inicia sesión.' }, 401);
        if (action === 'google') {
          assert.equal(body.alias, 'Mi alias'); assert.equal(body.consent, true);
          if (googleFails) return json({ success: false, error: 'Revisa la configuración de Google.' }, 503);
          loggedIn = true; return json({ success: true, url: `${ORIGIN}/sube-tu-sena.html?acceso=google-ok` });
        }
        if (action === 'reservar') { reserved = body; return json({ success: true, id: 'recorded-sign', signedUrl: `${ORIGIN}/storage-upload` }); }
        if (action === 'enviar') { assert.equal(uploads, 1); sent++; return json({ success: true, estado: 'pendiente' }); }
        if (action === 'logout') { loggedIn = false; return json({ success: true }); }
        return json({ success: true, items: [], more: false });
      }
      const file = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 404, body: '' });
      try { return route.fulfill({ body: await fs.readFile(file), contentType: { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream' }); }
      catch (_) { return route.fulfill({ status: 404, body: '' }); }
    });
    await page.goto(`${ORIGIN}/sube-tu-sena.html`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-auth-mode=registro]').isVisible(), false, 'No ofrece registro con correo sin SMTP');
    await page.getByLabel('Tu alias en la comunidad').fill('Mi alias');
    await page.locator('#community-google-form [name=consent]').check();
    googleFails = true; await page.getByRole('button', { name: 'Continuar con Google', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#auth-status').textContent.includes('Revisa la configuración'));
    assert.equal(await page.getByRole('button', { name: 'Continuar con Google', exact: true }).isEnabled(), true);
    googleFails = false; await page.getByRole('button', { name: 'Continuar con Google', exact: true }).click();
    await page.waitForSelector('#member-workspace:not([hidden])');
    assert.ok(!page.url().includes('acceso='), 'Limpia resultado de OAuth del historial');
    await page.evaluate(() => { window.cameraMode = 'deny'; });
    await page.getByRole('button', { name: 'Grabar mi seña aquí', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#upload-status').textContent.includes('No se permitió'));
    assert.equal(await page.locator('#community-native-camera').isVisible(), true);
    await page.evaluate(() => { window.cameraMode = 'allow'; });
    await page.getByRole('button', { name: 'Grabar mi seña aquí', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#record-start').disabled);
    assert.equal(await page.evaluate(() => window.cameraConstraints.at(-1).audio), false, 'No solicita micrófono');
    await page.getByRole('button', { name: 'Cancelar cámara' }).click();
    assert.equal(await page.evaluate(() => window.cameraTracks.every(track => track.readyState === 'ended')), true);
    assert.equal(sent, 0, 'Cancelar no envía ni publica');
    await page.getByLabel('¿Qué significa?').fill('Buenos días');
    await page.getByRole('button', { name: 'Grabar mi seña aquí', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#record-start').disabled);
    await page.getByRole('button', { name: 'Comenzar grabación', exact: true }).click();
    await page.waitForTimeout(1800);
    if (process.env.ENSENAS_SCREENSHOTS_DIR) await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, 'community-recording-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Terminar y revisar', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#community-send').disabled);
    assert.equal(await page.locator('#community-file').evaluate(input => input.files.length), 0, 'No requiere seleccionar el archivo grabado');
    assert.equal(await page.evaluate(() => window.cameraTracks.every(track => track.readyState === 'ended')), true, 'Libera cámara al terminar');
    assert.equal(await page.locator('#community-preview').isVisible(), true);
    assert.equal(await page.locator('#community-preview').evaluate(video => getComputedStyle(video).transform), 'none', 'No invierte el video de la seña');
    assert.equal(sent, 0, 'No envía hasta confirmar');
    for (const width of [320, 360, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Sin desbordamiento a ${width}px`);
    }
    await page.locator('#community-upload-form [name=consent]').check();
    await page.getByRole('button', { name: 'Enviar a revisión', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#upload-status').textContent.includes('quedó pendiente'));
    assert.equal(sent, 1); assert.equal(uploads, 1); assert.equal(reserved.significado, 'Buenos días');
    assert.ok(['video/mp4', 'video/webm'].includes(reserved.mime)); assert.ok(reserved.bytes > 0 && reserved.bytes < 25 * 1024 * 1024);
    // Otra grabación tras terminar: los botones no quedan deshabilitados.
    await page.getByRole('button', { name: 'Grabar mi seña aquí', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#record-start').disabled);
    await page.getByRole('button', { name: 'Comenzar grabación', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Terminar y revisar', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: 'Cancelar cámara' }).click();
    await page.waitForTimeout(200);
    assert.equal(sent, 1); assert.equal(await page.locator('#community-send').isEnabled(), false);
    // Forzar la alternativa WebM como en navegadores sin grabación MP4.
    await page.evaluate(() => { const supported = MediaRecorder.isTypeSupported.bind(MediaRecorder); MediaRecorder.isTypeSupported = type => !type.startsWith('video/mp4') && supported(type); });
    await page.getByRole('button', { name: 'Grabar mi seña aquí', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#record-start').disabled);
    await page.getByRole('button', { name: 'Comenzar grabación', exact: true }).click();
    await page.waitForTimeout(1300);
    await page.getByRole('button', { name: 'Terminar y revisar', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#community-send').disabled);
    assert.equal(await page.locator('#community-file').evaluate(input => input.files.length), 0);
    assert.equal(await page.locator('#community-preview').evaluate(video => video.readyState > 0), true, 'Vista previa WebM válida');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await page.waitForSelector('#member-auth:not([hidden])');
    assert.equal(await page.evaluate(() => window.cameraTracks.every(track => track.readyState === 'ended')), true);
    assert.deepEqual(errors, []);
    if (process.env.ENSENAS_SCREENSHOTS_DIR) { await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, 'community-google-mobile.png'), fullPage: true }); }
    console.log(`OK: Google simulado, rechazo de permiso, cámara frontal, grabación real ${reserved.mime}, formato/archivo automático, vista previa sin espejo, envío y cancelación, liberación de cámara y móvil. Sin cuentas ni videos reales.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
