/* Panel real de objeto.html, CSS/JS reales, datos simulados; no inicia RA ni publica contenido. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));
const ROOT = path.resolve(__dirname, '..'), ORIGIN = 'http://127.0.0.1:4173';
(async () => {
  const html = await fs.readFile(path.join(ROOT, 'objeto.html'), 'utf8');
  const panel = html.match(/<aside id="lsc-steps-panel"[\s\S]*?<\/aside>/)[0];
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage(); const errors = []; let hasSign = true;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.route(`${ORIGIN}/**`, async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/objeto.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="assets/css/style.css"><link rel="stylesheet" href="assets/css/site-navigation.css"><link rel="stylesheet" href="assets/css/community.css"><script src="assets/js/theme.js"></script><script src="assets/js/community.js" defer></script></head><body class="experience-page"><main class="main-layout">${panel}</main></body></html>` });
      if (url.pathname === '/api/comunidad') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, items: hasSign ? [{ id: 'test', significado: 'Buenos días', autor: 'Merky', descripcion: 'Variante regional. Contexto largo para comprobar lectura y ajuste en pantallas pequeñas.', video_url: `${ORIGIN}/fixture.mp4` }] : [] }) });
      if (url.pathname === '/fixture.mp4') return route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.alloc(0) });
      const file = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
      assert.ok(file.startsWith(ROOT + path.sep));
      return route.fulfill({ body: await fs.readFile(file), contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript' });
    });
    async function contrast() {
      return page.evaluate(() => {
        const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
        const luminance = color => rgb(color).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        const ratio = (a, b) => { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + .05) / (values[1] + .05); };
        const selectors = ['.panel-title', '.panel-desc', '#community-object-sign-title', '#community-object-sign-author', '#sign-learning-empty', '.tip-box span', '#btn-close-lsc-mode'];
        const swatch = document.createElement('div'); document.body.append(swatch);
        const token = key => { swatch.style.backgroundColor = `var(${key})`; return getComputedStyle(swatch).backgroundColor; };
        const backgrounds = [token('--bg-surface'), token('--bg-surface-alt')];
        const results = selectors.map(selector => {
          const node = document.querySelector(selector), style = getComputedStyle(node);
          let colors;
          if (selector.startsWith('.tip-box')) colors = [getComputedStyle(node.closest('.tip-box')).backgroundColor];
          else if (selector.startsWith('#community-object') || selector === '#sign-learning-empty') colors = [getComputedStyle(document.querySelector('.lsc-learning-video-wrap')).backgroundColor];
          else colors = backgrounds;
          return { selector, visible: node.getClientRects().length > 0, color: style.color, backgrounds: colors, minimum: Math.min(...colors.map(background => ratio(style.color, background))) };
        });
        swatch.remove(); return results;
      });
    }
    for (const available of [true, false]) {
      hasSign = available; await page.goto(`${ORIGIN}/objeto.html?id=test`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.documentElement.setAttribute('data-reduce-motion', ''));
      await page.waitForFunction(available => available ? document.querySelector('#community-object-sign-title').textContent === 'Buenos días' : document.querySelector('#sign-learning-empty').textContent.includes('Todavía no'), available);
      for (const width of [320, 360, 390, 430, 768, 1366]) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ['light', 'dark']) for (const highContrast of [false, true]) for (const zoom of [100, 150]) {
          await page.evaluate(({ theme, highContrast, zoom }) => { window.EnsenasTheme.applyTheme(theme); document.documentElement.toggleAttribute('data-high-contrast', highContrast); document.documentElement.style.fontSize = `${zoom}%`; }, { theme, highContrast, zoom });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          for (const result of await contrast()) if (result.visible) {
            assert.ok(result.minimum >= 4.5, `${result.selector}: contraste ${result.minimum.toFixed(2)} (${result.color} sobre ${result.backgrounds.join('/')}) a ${width}px, ${theme}, alto contraste ${highContrast}, texto ${zoom}%`);
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Desbordamiento: ${width}px, ${theme}, texto ${zoom}%`);
          if (process.env.ENSENAS_SCREENSHOTS_DIR && width === 390 && !highContrast && zoom === 100 && available) await page.screenshot({ path: path.join(process.env.ENSENAS_SCREENSHOTS_DIR, `lsc-practice-${theme}-mobile.png`), fullPage: true });
        }
      }
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => { document.documentElement.removeAttribute('data-reduce-motion'); document.documentElement.removeAttribute('data-high-contrast'); });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => window.EnsenasTheme.applyTheme(theme), theme);
      await page.waitForTimeout(250);
      for (const result of await contrast()) if (result.visible) assert.ok(result.minimum >= 4.5, `Tema normal sin preferencias de movimiento: ${result.selector}`);
    }
    assert.deepEqual(errors, []);
    console.log('OK: panel LSC real, claro/oscuro, alto contraste, texto 100/150%, 6 anchos, con/sin aporte. Textos ≥4.5:1 y sin desbordamiento. API simulada, sin modificar RA.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
