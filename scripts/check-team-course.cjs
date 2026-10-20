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
    for (const width of [320, 390, 768, 1200, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(ORIGIN + '/colaboradores.html');
      assert.equal(await page.locator('.team-grid-pillars .team-card').count(), 3);
      assert.equal(await page.locator('.team-grid-developers .team-card').count(), 5);
      assert.equal(await page.locator('.team-avatar').count(), 8);
      const circles = await page.locator('.team-avatar').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect(); return { width: box.width, height: box.height, radius: getComputedStyle(node).borderRadius };
      }));
      assert.ok(circles.every(box => Math.abs(box.width - box.height) < 1 && box.radius === '50%'), 'Todos los retratos son circulares');
      assert.ok(Math.max(...circles.map(box => box.width)) - Math.min(...circles.map(box => box.width)) < 1, 'Los ocho retratos tienen el mismo tamaño');
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
    const pages = process.env.ENSENAS_COURSE_TEST_PAGE ? [process.env.ENSENAS_COURSE_TEST_PAGE] : ['index.html', 'catalogo.html', 'sube-tu-sena.html', 'comunidad.html', 'leaderboard.html', 'colaboradores.html', 'objeto.html'];
    for (const file of pages) {
      await page.goto(ORIGIN + '/' + file + (file === 'objeto.html' ? '?id=microbit' : ''));
      console.log('Verificando curso:', file);
      assert.equal(await page.locator('.site-course-toggle, .site-course details').count(), 0, 'No hay botón ni desplegable');
      const link = page.locator('.site-course-link');
      assert.equal(await link.getAttribute('href'), COURSE);
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.ok((await link.getAttribute('rel')).includes('noopener'));
      assert.equal(await page.locator('.site-course-thumbnail').getAttribute('href'), COURSE);
      const photo = page.locator('.site-course-thumbnail img');
      await photo.evaluate(img => img.decode());
      assert.ok(await photo.evaluate(img => img.naturalWidth > 0));
      for (const width of [320, 390, 768, 1199, 1200, 1366, 1600]) {
        await page.setViewportSize({ width, height: 844 });
        for (const theme of ['light', 'dark']) {
          await page.evaluate(theme => window.EnsenasTheme.applyTheme(theme), theme);
          for (const size of ['100', '150']) {
            await page.evaluate(size => document.documentElement.style.fontSize = size + '%', size);
            await link.scrollIntoViewIfNeeded();
            const box = await link.boundingBox();
            assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 845, `CTA alcanzable ${file}/${width}/${theme}/${size}`);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
            assert.equal(overflow, false, `Sin desbordamiento ${file}/${width}/${theme}/${size}`);
            const courseBox = await page.locator('.site-course').boundingBox();
            const mainBox = await page.locator('main').boundingBox();
            if (width >= 1200) {
              assert.ok(courseBox.x >= mainBox.x + mainBox.width, 'Lateral reservado: no tapa el contenido');
              assert.equal(await page.locator('.site-course-rail > .site-course').count(), 1);
            } else {
              assert.equal(await page.locator('main > .site-course').count(), 1, 'En móvil se integra al contenido');
              assert.equal(await page.locator('.site-course').evaluate(el => getComputedStyle(el).position), 'relative');
            }
          }
        }
      }
      await page.setViewportSize({ width: 1366, height: 568 });
      await link.scrollIntoViewIfNeeded();
      const shortBox = await link.boundingBox();
      assert.ok(shortBox.y >= 0 && shortBox.y + shortBox.height <= 569, 'Curso alcanzable en pantalla baja con texto grande');
      await page.setViewportSize({ width: 1600, height: 844 });
      const originalHtml = await fs.readFile(path.join(ROOT, file), 'utf8');
      const originalFooter = await page.evaluate(source => new DOMParser().parseFromString(source, 'text/html').querySelector('.site-footer').outerHTML, originalHtml);
      assert.equal(await page.locator('.site-footer').evaluate(el => el.outerHTML), originalFooter, 'Footer sin modificaciones');
      assert.equal(await page.locator('body > .site-footer').count(), 1, 'Footer fuera del lateral');
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).paddingBottom), '0px', 'Sin espacio extra bajo el footer');
      await page.locator('.site-footer').scrollIntoViewIfNeeded();
      const footerBox = await page.locator('.site-footer').boundingBox();
      assert.ok(footerBox.x < 1 && footerBox.width >= 1599, 'Footer de ancho completo');
      if (file === 'index.html') {
        await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; window.EnsenasTheme.applyTheme('light'); });
        for (const width of [390, 1366]) {
          await page.setViewportSize({ width, height: 844 });
          await page.locator('.site-course').scrollIntoViewIfNeeded();
          if (process.env.ENSENAS_SCREENSHOTS_DIR) await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, `course-visible-${width}.png`) });
        }
      }
      if (file === 'objeto.html') {
        assert.equal(await page.locator('#ar-canvas-host .site-course').count(), 0);
        await page.evaluate(() => document.querySelector('.ar-section').classList.add('ar-immersive'));
        assert.equal(await link.isVisible(), false);
      }
      if (file === 'index.html') assert.match(await page.locator('.welcome-interpreter-credit').textContent(), /Edward Ignacio Rojas Díaz/);
    }
    // Las dependencias externas del visor se simulan; no se valida aquí su render 3D.
    assert.deepEqual(errors.filter(message => !/THREE is not defined|QRCodeStyling is not defined/.test(message)), []);
    console.log('Equipo: 8 fotos. Curso visible: 7 páginas, 7 anchos, texto 100/150%, temas, miniatura enlazada, lateral sin superposición, RA y footer intactos.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
