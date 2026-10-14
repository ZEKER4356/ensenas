/* Prueba local: sirve archivos al navegador sin depender de una conexión. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', {
  paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()]
}));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Sin depender de internet para validar el encabezado.
    await page.route('https://**/*', (route) => route.abort());
    await page.route('http://127.0.0.1:4173/**', async (route) => {
      const filePath = path.resolve(__dirname, '..', '.' + decodeURIComponent(new URL(route.request().url()).pathname));
      try {
        const body = await fs.readFile(filePath);
        const contentType = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(filePath)] || 'application/octet-stream';
        await route.fulfill({ status: 200, body, contentType });
      } catch (_) {
        await route.fulfill({ status: 404, body: 'Not found' });
      }
    });
    const paths = ['index.html', 'catalogo.html', 'sube-tu-sena.html', 'comunidad.html', 'leaderboard.html', 'colaboradores.html', 'admin.html', '404.html'];
    for (const width of [320, 360, 390, 430, 768, 1366]) {
      await page.setViewportSize({ width, height: 850 });
      for (const path of paths) {
        await page.goto(`http://127.0.0.1:4173/${path}`, { waitUntil: 'networkidle' });
        await page.locator('.site-navigation').waitFor();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `Desbordamiento en ${path} a ${width}px`);
        const menu = page.locator('.site-menu');
        if (width < 1200) await page.locator('.site-menu-toggle').click();
        assert.equal(await menu.locator('a').count(), 5);
        assert.equal(await menu.locator('a[href="admin.html"]').count(), 0);
        assert.equal(await page.locator('.site-tools a[href="admin.html"]').isVisible(), true);
        assert.equal(await menu.locator('a').first().isVisible(), true);
        if (width < 1200) {
          await page.keyboard.press('Escape');
          assert.equal(await menu.getAttribute('open'), null);
        }
        await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
        const panel = page.getByRole('region', { name: 'Accesibilidad', exact: true });
        assert.equal(await panel.isVisible(), true);
        assert.equal(await page.getByRole('dialog').count(), 0);
        // El panel no vuelve inerte el contenido: permite seguir usando la página.
        assert.equal(await page.locator('main').first().evaluate(el => el.inert), false);
        await page.locator('#site-text-size').selectOption('150');
        await page.keyboard.press('Escape');
        assert.equal(await panel.isVisible(), false);
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) {
          console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, class: el.className, right: Math.round(el.getBoundingClientRect().right) })).slice(0, 12)));
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Texto ampliado en ${path} a ${width}px`);
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await page.evaluate(() => document.documentElement.style.fontSize), '150%');
        await page.getByRole('button', { name: 'Accesibilidad', exact: true }).click();
        await page.getByRole('button', { name: /Restablecer configuración/ }).click();
        await page.getByRole('button', { name: 'Cerrar accesibilidad' }).click();
      }
    }
    assert.deepEqual(errors, [], 'Errores JavaScript durante la navegación');
    console.log('OK: 8 páginas, 6 tamaños, menú, teclado, panel no modal y persistencia de texto.');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
