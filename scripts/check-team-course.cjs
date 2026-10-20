/* UI real, recursos locales y API simulada: ninguna escritura en producción. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));
const ROOT = path.resolve(__dirname, '..'), ORIGIN = 'http://127.0.0.1:4173';
const COURSE = 'https://bloque10.unimagdalena.edu.co/courses/lsc-y-cultura-sorda/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.route(ORIGIN + '/**', async route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      if (pathname.startsWith('/api/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, items: [] }) });
      const file = path.resolve(ROOT, '.' + pathname); assert.ok(file.startsWith(ROOT + path.sep));
      try { await route.fulfill({ body: await fs.readFile(file), contentType: { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream' }); }
      catch (_) { await route.fulfill({ status: 404, body: '' }); }
    });
    for (const width of [320, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(ORIGIN + '/colaboradores.html');
      assert.equal(await page.locator('.team-grid-pillars .team-card').count(), 3);
      assert.equal(await page.locator('.team-grid-developers .team-card').count(), 5);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => window.EnsenasTheme.applyTheme(theme), theme);
        for (const size of ['100', '150']) {
          await page.evaluate(size => document.documentElement.style.fontSize = size + '%', size);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Equipo sin desbordar ${width}/${theme}/${size}`);
          for (const photo of await page.locator('.team-portrait img').all()) {
            await photo.scrollIntoViewIfNeeded();
            await photo.evaluate(img => img.decode());
            assert.ok(await photo.evaluate(img => img.complete && img.naturalWidth > 0), 'Cada retrato carga');
          }
        }
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; window.EnsenasTheme.applyTheme('light'); });
      await page.evaluate(() => scrollTo(0, 0));
      if (process.env.ENSENAS_SCREENSHOTS_DIR && [390, 1366].includes(width)) await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, `team-${width}.png`), fullPage: true });
      if (process.env.ENSENAS_SCREENSHOTS_DIR && width === 1366) {
        await page.evaluate(() => window.EnsenasTheme.applyTheme('dark'));
        await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, 'team-dark-desktop.png') });
      }
    }
    for (const file of ['index.html', 'catalogo.html', 'sube-tu-sena.html', 'comunidad.html', 'leaderboard.html', 'colaboradores.html', 'objeto.html']) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(ORIGIN + '/' + file + (file === 'objeto.html' ? '?id=microbit' : ''));
      console.log('Verificando curso:', file);
      const toggle = page.locator('.site-course-toggle');
      await toggle.click();
      const link = page.locator('.site-course-link');
      assert.equal(await link.getAttribute('href'), COURSE);
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.ok((await link.getAttribute('rel')).includes('noopener'));
      const photo = page.locator('.site-course-body > img');
      await photo.evaluate(img => img.decode());
      assert.ok(await photo.evaluate(img => img.naturalWidth > 0));
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => window.EnsenasTheme.applyTheme(theme), theme);
        for (const size of ['100', '150']) {
          await page.evaluate(size => document.documentElement.style.fontSize = size + '%', size);
          await link.scrollIntoViewIfNeeded();
          const box = await link.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= 391 && box.y >= 0 && box.y + box.height <= 845, `CTA alcanzable ${file}/${theme}/${size}`);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        }
      }
      await link.focus(); await page.keyboard.press('Escape');
      assert.equal(await page.locator('.site-course-details').getAttribute('open'), null);
      assert.equal(await toggle.evaluate(el => el === document.activeElement), true, 'Escape devuelve el foco');
      await toggle.click(); await page.locator('.site-course-close').click();
      assert.equal(await page.locator('.site-course-details').getAttribute('open'), null);
      if (file === 'index.html' && process.env.ENSENAS_SCREENSHOTS_DIR) {
        await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; window.EnsenasTheme.applyTheme('light'); });
        await toggle.click();
        await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, 'course-mobile.png') });
        await page.locator('.site-course-close').click();
      }
      if (file === 'objeto.html') {
        assert.equal(await page.locator('.site-course').evaluate(el => getComputedStyle(el).position), 'relative');
        assert.equal(await page.locator('#ar-canvas-host .site-course').count(), 0);
        await page.evaluate(() => document.querySelector('.ar-section').classList.add('ar-immersive'));
        assert.equal(await toggle.isVisible(), false);
      }
      if (file === 'index.html') assert.match(await page.locator('.welcome-interpreter-credit').textContent(), /Edward Ignacio Rojas Díaz/);
    }
    // Las dependencias externas del visor se simulan; no se valida aquí su render 3D.
    assert.deepEqual(errors.filter(message => !/THREE is not defined|QRCodeStyling is not defined/.test(message)), []);
    console.log('Equipo: 8 fotos, secciones, móvil/PC y texto al 150%. Curso: 7 páginas, temas, cierre y visor. Crédito de Edward: OK.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
