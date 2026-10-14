const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const shots = await fs.mkdtemp(path.join(process.env.ENSENAS_SCREENSHOTS_DIR || os.tmpdir(), 'ensenas-welcome-'));
  try {
    const page = await browser.newPage();
    await page.route('https://**/*', route => route.abort());
    await page.route('http://127.0.0.1:4173/**', async route => {
      const url = new URL(route.request().url());
      let name = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      try {
        const body = await fs.readFile(path.resolve(__dirname, '..', '.' + name));
        const contentType = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(name)] || 'application/octet-stream';
        await route.fulfill({ body, contentType });
      } catch (_) { await route.fulfill({ status: 404, body: 'Not found' }); }
    });
    for (const width of [390, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('#objects-grid-container').count(), 0, 'El inicio no incluye el catálogo');
      assert.equal(await page.locator('.welcome-path').count(), 5);
      const videoBox = await page.locator('.welcome-video-card').boundingBox();
      const textBox = await page.locator('.welcome-copy').boundingBox();
      assert.ok(textBox.x >= videoBox.x && textBox.y >= videoBox.y, 'Texto superpuesto dentro del video');
      assert.ok(textBox.y + textBox.height <= videoBox.y + videoBox.height + 1);
      assert.ok((await page.locator('.welcome-path').first().boundingBox()).y < 850, 'Accesos próximos a la bienvenida');
      await page.locator('#welcome-pause').click();
      const pausedText = await page.locator('#welcome-message-animated').textContent();
      await page.waitForTimeout(180);
      assert.equal(await page.locator('#welcome-message-animated').textContent(), pausedText);
      await page.locator('#welcome-replay').click();
      await page.waitForTimeout(140);
      assert.ok((await page.locator('#welcome-title-animated').textContent()).length > 0, 'También se escribe el título');
      await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
      await page.locator('#site-reduce-motion').check();
      assert.equal(await page.locator('#welcome-message-animated').textContent(), await page.locator('#welcome-message-full').textContent());
      assert.equal(await page.locator('#welcome-title-animated').textContent(), await page.locator('#welcome-title-full').textContent());
      // Cambiar contraste y tamaño se aplica con el panel abierto, sin modal.
      await page.locator('#site-high-contrast').check();
      assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-high-contrast')), true);
      for (const key of ['dyslexia', 'colors', 'headings', 'links', 'bold', 'guide', 'cursor']) {
        await page.locator('[data-pref="' + key + '"]').check();
      }
      await page.locator('#site-saturation').selectOption('gray');
      await page.locator('#site-line-height').selectOption('wide');
      await page.locator('#site-letter-spacing').selectOption('wide');
      await page.locator('#site-text-size').selectOption('150');
      assert.ok((await page.locator('#welcome-message-full').evaluate(el => getComputedStyle(el).fontFamily)).includes('Verdana'));
      assert.equal(await page.locator('#site-reading-guide').isVisible(), true);
      await page.mouse.move(100, 100);
      assert.equal(await page.locator('#site-reading-guide').evaluate(el => el.style.top), '100px');
      await page.getByRole('button', { name: 'Cerrar accesibilidad' }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Preferencias combinadas no desbordan la página');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.evaluate(() => document.documentElement.dataset.saturation), 'gray');
      assert.equal(await page.evaluate(() => document.documentElement.dataset.lineHeight), 'wide');
      assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-reading-font')), true);
      await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
      await page.getByRole('button', { name: /Restablecer configuración/ }).click();
      assert.equal(await page.evaluate(() => document.documentElement.style.fontSize), '100%');
      assert.equal(await page.locator('#site-reading-guide').isVisible(), false);
      await page.getByRole('button', { name: 'Cerrar accesibilidad' }).click();
      await page.locator('#welcome-pause').click();
      await page.screenshot({ path: path.join(shots, 'inicio-' + width + '.png'), fullPage: true });
      await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
      await page.screenshot({ path: path.join(shots, 'panel-' + width + '.png') });
      await page.getByRole('button', { name: 'Cerrar accesibilidad' }).click();
      await page.locator('.welcome-path[href="catalogo.html"]').click();
      assert.ok(page.url().endsWith('/catalogo.html'));
      await page.locator('.brand-link').click();
      assert.ok(page.url().endsWith('/index.html'));
    }
    console.log('OK: video de fondo y texto superpuesto, título animado, accesos próximos, pausa, movimiento reducido y regreso por logo.');
    console.log(shots);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
