/* Flujo de navegador con API/Storage simulados. No publica videos reales. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    // Crear un clip de prueba local, no contenido que se presentará como LSC.
    const bytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120; document.body.append(canvas);
      const context = canvas.getContext('2d'); context.fillStyle = '#7c3aed'; context.fillRect(0, 0, 160, 120);
      const stream = canvas.captureStream(10), recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      return await new Promise(resolve => {
        const chunks = []; recorder.ondataavailable = event => chunks.push(event.data);
        recorder.onstop = async () => { stream.getTracks().forEach(track => track.stop()); resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]); };
        let tick = 0;
        recorder.start(100);
        const interval = setInterval(() => { context.fillStyle = tick++ % 2 ? '#2563eb' : '#7c3aed'; context.fillRect(0, 0, 160, 120); }, 100);
        setTimeout(() => { clearInterval(interval); recorder.stop(); }, 1500);
      });
    });
    const clip = Buffer.from(bytes);
    assert.ok(clip.length > 200, 'El clip de prueba debe contener frames de video');
    const initialSigns = [
      { id: 's1', significado: 'Buenos días', descripcion: 'Saludo de ejemplo para pruebas', autor: 'Ana', autor_id: 'a1', video_url: `${ORIGIN}/test-video.webm`, estado: 'aprobado' },
      { id: 's2', significado: 'Gracias', descripcion: '', autor: 'Luis', autor_id: 'a2', video_url: `${ORIGIN}/test-video.webm`, estado: 'aprobado' }
    ];
    const signs = [...initialSigns];
    const sources = ['nav.inicio', 'nav.admin', 'nav.catalogo', 'nav.sube-tu-sena', 'nav.comunidad', 'nav.leaderboard', 'nav.equipo', 'community.enviar', 'community.login', 'community.registro', 'object.microbit', 'page.bienvenida'].map(clave => ({ clave, etiqueta: clave, video_url: 'https://media.example.test/video.webm', activo: true }));
    let loggedIn = false, storageUploaded = false, failFinalization = false, uploadedMeaning = '';
    const externalRoute = async route => {
      if (route.request().url().startsWith('https://media.example.test/')) return route.fulfill({ contentType: 'video/webm', body: clip });
      return route.abort();
    };
    await page.route('https://**/*', externalRoute);
    const appRoute = async route => {
      const url = new URL(route.request().url());
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
      const action = body.action || url.searchParams.get('action');
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (url.pathname === '/storage-upload') { storageUploaded = true; return json({ Key: 'test' }); }
      if (url.pathname === '/test-video.webm') return route.fulfill({ body: clip, contentType: 'video/webm' });
      if (url.pathname === '/api/objetos') return json([{ id: 'microbit', titulo: 'Micro:bit', descripcion: 'Placa educativa', activo: true }, { id: 'telescopio', titulo: 'Telescopio', descripcion: 'Explora el cielo', activo: true }]);
      if (url.pathname === '/api/auth') return json({ user: { nombre: 'Equipo', rol: 'admin' } });
      if (url.pathname === '/api/comunidad') {
        if (action === 'config') return json({ success: true, google: true, email_signup: true, app_url: ORIGIN });
        if (action === 'interpretaciones') return json({ success: true, items: sources.filter(row => row.activo) });
        if (action === 'interpretaciones-admin') return json({ success: true, items: sources });
        if (action === 'sesion') return loggedIn ? json({ success: true, user: { id: 'a1', alias: 'Ana' } }) : json({ success: false, error: 'Inicia sesión.' }, 401);
        if (action === 'registro') return json({ success: true, message: 'Revisa tu correo para confirmar la cuenta.' });
        if (action === 'login') { loggedIn = true; return json({ success: true }); }
        if (action === 'logout') { loggedIn = false; return json({ success: true }); }
        if (action === 'mis-senas') return json({ success: true, items: signs.filter(row => row.autor_id === 'a1'), more: false });
        if (action === 'senas' || action === 'descubrir') return json({ success: true, items: signs.filter(row => row.estado === 'aprobado' && row.significado.toLowerCase().includes((url.searchParams.get('q') || '').toLowerCase())), more: false });
        if (action === 'reservar') { uploadedMeaning = body.significado; storageUploaded = false; return json({ success: true, id: 's3', signedUrl: `${ORIGIN}/storage-upload` }); }
        if (action === 'enviar') {
          if (!storageUploaded || failFinalization) return json({ success: false, error: 'No se pudo confirmar el archivo.' }, 409);
          if (!signs.some(row => row.id === 's3')) signs.push({ id: 's3', significado: uploadedMeaning, descripcion: 'Aporte de prueba', autor: 'Ana', autor_id: 'a1', video_url: `${ORIGIN}/test-video.webm`, estado: 'pendiente' });
          return json({ success: true, estado: 'pendiente' });
        }
        if (action === 'moderacion') return json({ success: true, items: signs.filter(row => row.estado === (url.searchParams.get('estado') || 'pendiente')), more: false });
        if (action === 'revisar') { const row = signs.find(row => row.id === body.id); row.estado = body.estado; return json({ success: true }); }
        if (action === 'ranking') {
          const items = ['a1', 'a2'].map(id => ({ autor_id: id, alias: id === 'a1' ? 'Ana' : 'Luis', aportes: signs.filter(row => row.autor_id === id && row.estado === 'aprobado').length })).sort((a, b) => b.aportes - a.aportes);
          return json({ success: true, items });
        }
        if (action === 'interpretacion') { Object.assign(sources.find(item => item.clave === body.clave), body); return json({ success: true }); }
      }
      const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
      const filePath = path.resolve(ROOT, name);
      if (!filePath.startsWith(ROOT + path.sep)) return route.fulfill({ status: 404, body: '' });
      try {
        const file = await fs.readFile(filePath);
        return route.fulfill({ body: file, contentType: { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(filePath)] || 'application/octet-stream' });
      } catch (_) { return route.fulfill({ status: 404, body: '' }); }
    };
    await page.route(`${ORIGIN}/**`, appRoute);
    // Configuración LSC: aparece solo donde existe video, sin interceptar el enlace.
    await page.goto(`${ORIGIN}/index.html`); await page.waitForSelector('.welcome-paths [data-lsc-bound="nav.catalogo"]');
    assert.equal(await page.locator('.welcome-path').count(), 5);
    assert.equal(await page.locator('.site-header .lsc-help-trigger, .welcome-paths .lsc-help-trigger, .lsc-target-group').count(), 0, 'Sin botones LSC laterales ni envoltorios que alteren el diseño');
    await page.setViewportSize({ width: 1366, height: 900 });
    const catalogLink = page.locator('.site-menu a[href="catalogo.html"]');
    for (const link of await page.locator('.site-menu-links a').all()) {
      await link.hover();
      await page.waitForTimeout(500);
      const box = await page.locator('#lsc-interface-player').boundingBox(), target = await link.boundingBox();
      assert.ok(box && box.y >= target.y + target.height + 8, 'LSC debajo del enlace que se está explorando');
      assert.ok(box.x >= 0 && box.x + box.width <= 1366, 'Intérprete dentro de la pantalla');
      assert.equal(await page.locator('#lsc-interface-player h2').textContent(), await link.getAttribute('data-lsc-key'));
    }
    await catalogLink.hover(); await page.waitForTimeout(600);
    assert.equal(await page.locator('#lsc-interface-player').isVisible(), true);
    assert.equal(await page.locator('#lsc-interface-player h2').textContent(), 'nav.catalogo');
    assert.deepEqual(await page.locator('#lsc-interface-player video').evaluate(video => ({ loop: video.loop, muted: video.muted, controls: video.controls, pointer: getComputedStyle(video).pointerEvents })), { loop: true, muted: true, controls: false, pointer: 'none' }, 'Bucle silencioso sin controles ni pausa al tocar');
    await page.locator('#lsc-interface-player video').evaluate(video => { window.testLoopCount = 0; let previous = video.currentTime; video.addEventListener('timeupdate', () => { if (video.currentTime + .2 < previous) window.testLoopCount++; previous = video.currentTime; }); });
    await page.waitForFunction(() => window.testLoopCount > 0, null, { timeout: 10000 });
    if (process.env.ENSENAS_SCREENSHOTS_DIR) await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, 'lsc-nav-desktop.png') });
    await page.locator('#lsc-interface-player').hover(); await page.waitForTimeout(750);
    assert.equal(await page.locator('#lsc-interface-player').isVisible(), true, 'El panel puede mantenerse bajo el mouse');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    assert.equal(await page.locator('#lsc-interface-player').isVisible(), false);
    await page.locator('h1').hover(); await page.waitForTimeout(700);
    await catalogLink.focus(); await page.waitForTimeout(500);
    assert.equal(await page.locator('#lsc-interface-player').isVisible(), true, 'Interpretación con teclado');
    await page.keyboard.press('Escape');
    await page.locator('.welcome-path[href="comunidad.html"]').hover(); await page.waitForTimeout(500);
    assert.equal(await page.locator('#lsc-interface-player').isVisible(), true, 'Las tarjetas se interpretan sin botones adicionales');
    const cardPanel = await page.locator('#lsc-interface-player').boundingBox();
    assert.ok(cardPanel.y >= 0 && cardPanel.y + cardPanel.height <= 900);
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await catalogLink.hover(); await page.waitForTimeout(600);
    assert.equal(await page.locator('#lsc-interface-player').isVisible(), false, 'Movimiento reducido no abre un bucle automático');
    await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
    await page.locator('#site-accessibility-panel [data-lsc-open="nav.catalogo"]').click();
    assert.equal(await page.locator('#lsc-interface-player').isVisible(), true, 'Acceso manual disponible con movimiento reducido');
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const width of [320, 360, 390, 430, 768, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      for (const name of ['index.html', 'catalogo.html', 'comunidad.html', 'leaderboard.html']) {
        await page.goto(`${ORIGIN}/${name}`, { waitUntil: 'networkidle' });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name} con LSC a ${width}px`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ORIGIN}/index.html`); await page.waitForSelector('.welcome-paths [data-lsc-bound="nav.catalogo"]');
    await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
    await page.locator('#site-accessibility-panel [data-lsc-open="nav.catalogo"]').click();
    assert.ok(page.url().endsWith('index.html')); assert.equal(await page.locator('#lsc-interface-player').isVisible(), true);
    await page.getByRole('button', { name: 'Cerrar interpretación LSC' }).click();
    await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
    await page.getByLabel('Interpretación LSC al explorar').uncheck();
    await page.locator('#site-accessibility-panel [data-lsc-open="nav.catalogo"]').click();
    assert.equal(await page.locator('#lsc-interface-player').isVisible(), true, 'El botón manual funciona sin apertura automática');
    await page.keyboard.press('Escape');
    // Cuenta y envío: un fallo de confirmación jamás se presenta como éxito.
    await page.goto(`${ORIGIN}/sube-tu-sena.html`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await page.waitForSelector('#community-auth-form [data-lsc-bound="community.registro"]');
    await page.getByLabel('Alias público').fill('Ana'); await page.getByLabel('Correo', { exact: true }).fill('ana@example.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('valid-password'); await page.locator('#account-consent-label input').check();
    await page.locator('#community-auth-form [type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#auth-status').textContent.includes('Revisa tu correo'));
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await page.getByLabel('Contraseña', { exact: true }).fill('valid-password'); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForSelector('#member-workspace:not([hidden])');
    await page.getByLabel('¿Qué significa?').fill('<img src=x onerror=alert(1)>');
    await page.locator('#community-file').setInputFiles({ name: 'prueba.webm', mimeType: 'video/webm', buffer: clip });
    try { await page.waitForFunction(() => !document.querySelector('#community-send').disabled, null, { timeout: 10000 }); }
    catch (error) { console.log(await page.locator('#community-preview').evaluate(video => ({ duration: String(video.duration), width: video.videoWidth, ready: video.readyState, time: video.currentTime, error: video.error?.message, status: document.querySelector('#upload-status').textContent }))); throw error; }
    await page.locator('#community-upload-form input[name=consent]').check();
    assert.equal(await page.locator('#community-preview-card').evaluate(element => !!element.closest('#community-upload-form')), true, 'La vista previa está antes de Enviar en móvil');
    failFinalization = true; await page.locator('#community-send').click();
    await page.waitForFunction(() => document.querySelector('#upload-status').textContent.includes('sin volver a subir'));
    assert.equal(await page.locator('#upload-status').getAttribute('data-error'), 'true');
    assert.equal(signs.filter(row => row.estado === 'pendiente').length, 0);
    failFinalization = false; await page.locator('#community-send').click();
    await page.waitForFunction(() => document.querySelector('#upload-status').textContent.includes('quedó pendiente'));
    assert.equal(await page.locator('#my-signs h3').last().textContent(), '<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('#my-signs img').count(), 0, 'El aporte no se interpreta como HTML');
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Subida autenticada a ${width}`);
    }
    // Moderación en el Admin existente; pendientes no publicados ni puntuados.
    await page.evaluate(() => localStorage.setItem('ensenas_admin_token', 'admin'));
    await page.goto(`${ORIGIN}/admin.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#moderation-list .community-sign');
    await page.getByRole('button', { name: 'Aprobar y publicar' }).click();
    assert.match(await page.locator('#moderation-list .community-status').textContent(), /Confirma la revisión/);
    await page.locator('#moderation-list input[type=checkbox]').check(); await page.getByRole('button', { name: 'Aprobar y publicar' }).click();
    await page.waitForFunction(() => document.querySelector('#moderation-list .community-status').textContent.includes('Publicado'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Moderación móvil');
    await page.goto(`${ORIGIN}/comunidad.html`, { waitUntil: 'networkidle' }); assert.equal(await page.locator('.community-sign').count(), 3);
    await page.getByLabel('Buscar por significado').fill('Gracias'); await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.community-sign').length === 1);
    assert.equal(await page.locator('.community-sign h3').textContent(), 'Gracias');
    await page.goto(`${ORIGIN}/leaderboard.html`, { waitUntil: 'networkidle' });
    assert.match(await page.locator('.community-ranking li').first().textContent(), /Ana.*2 señas/);
    await page.goto(`${ORIGIN}/catalogo.html`, { waitUntil: 'networkidle' });
    const buttons = page.getByRole('button', { name: 'Aprender una seña', exact: true }); assert.equal(await buttons.count(), 2);
    await buttons.first().click(); const first = await page.locator('.community-random-content h3').textContent();
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click(); await buttons.nth(1).click();
    assert.notEqual(await page.locator('.community-random-content h3').textContent(), first, 'Asignación sin repetir mientras haya señas');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click(); await buttons.first().click();
    assert.equal(await page.locator('.community-random-content h3').textContent(), first, 'Estable durante la visita');
    assert.deepEqual(errors, [], 'Errores de JavaScript');
    if (process.env.ENSENAS_SCREENSHOTS_DIR) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, 'community-learn-mobile.png') });
      await page.goto(`${ORIGIN}/sube-tu-sena.html`, { waitUntil: 'networkidle' }); await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, 'community-upload-mobile.png'), fullPage: true });
    }
    const touch = await browser.newPage({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
    touch.on('pageerror', error => errors.push(error.message));
    await touch.route('https://**/*', externalRoute); await touch.route(`${ORIGIN}/**`, appRoute);
    await touch.goto(`${ORIGIN}/index.html`, { waitUntil: 'networkidle' });
    for (const size of [{ width: 320, height: 844 }, { width: 430, height: 844 }, { width: 844, height: 390 }]) {
      await touch.setViewportSize(size);
      assert.equal(await touch.locator('.site-navigation').isVisible(), false);
      await touch.getByRole('button', { name: 'Accesibilidad', exact: true }).tap();
      const panel = touch.locator('#site-accessibility-panel');
      assert.deepEqual(await panel.boundingBox(), { x: 0, y: 0, ...size });
      await touch.locator('#site-text-size').selectOption('150');
      await touch.locator('.a11y-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
      for (const selector of ['.a11y-close', '#site-reset-preferences']) {
        assert.equal(await touch.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(); return r.y >= 0 && r.bottom <= innerHeight && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, 'Cerrar y restablecer accesibles incluso al ampliar texto y desplazar el contenido');
      }
      await touch.locator('.a11y-close').focus(); await touch.keyboard.press('Shift+Tab');
      assert.equal(await touch.locator('#site-reset-preferences').evaluate(el => el === document.activeElement), true);
      await touch.keyboard.press('Tab');
      assert.equal(await touch.locator('.a11y-close').evaluate(el => el === document.activeElement), true);
      await touch.locator('#site-reset-preferences').tap();
      await touch.getByRole('button', { name: 'Cerrar accesibilidad' }).tap();
      assert.equal(await touch.evaluate(() => document.documentElement.hasAttribute('data-accessibility-open')), false);
    }
    await touch.setViewportSize({ width: 390, height: 844 });
    assert.equal(await touch.evaluate(() => matchMedia('(hover: none)').matches), true);
    assert.equal(await touch.locator('#lsc-interface-player').isVisible(), false);
    assert.equal(await touch.locator('.site-navigation').isVisible(), false, 'Inicio móvil sin menú que tape la bienvenida');
    await touch.getByRole('button', { name: 'Accesibilidad', exact: true }).tap();
    assert.deepEqual(await touch.locator('#site-accessibility-panel').boundingBox(), { x: 0, y: 0, width: 390, height: 844 });
    if (process.env.ENSENAS_SCREENSHOTS_DIR) await touch.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, 'accessibility-fullscreen-mobile.png') });
    await touch.locator('#site-accessibility-panel [data-lsc-open="nav.catalogo"]').tap();
    assert.equal(await touch.locator('#lsc-interface-player').isVisible(), true); assert.ok(touch.url().endsWith('index.html'));
    await touch.getByRole('button', { name: 'Cerrar interpretación LSC' }).tap();
    await touch.locator('.welcome-path[href="catalogo.html"]').tap();
    await touch.waitForURL('**/catalogo.html');
    assert.equal(await touch.locator('#lsc-interface-player').isVisible(), false, 'La navegación táctil no abre un hover accidental');
    await touch.locator('.site-menu-toggle').tap();
    const navLink = touch.locator('.site-menu-links a[href="comunidad.html"]');
    assert.equal(await navLink.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, 'Menú interior móvil encima del contenido, sin bloqueo por videos');
    await navLink.tap(); await touch.waitForURL('**/comunidad.html');
    await touch.close(); assert.deepEqual(errors, [], 'Errores también en contexto táctil');
    console.log('OK: LSC por hover/teclado/control móvil, no desbordamiento, registro, subida con fallo/reintento, revisión, comunidad, ranking y asignación de señas. API y Storage simulados.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
