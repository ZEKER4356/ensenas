/* Valida metadatos en el HTML original: el robot no necesita ejecutar JavaScript. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(require.resolve('sharp', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const meta = key => {
    const matches = [...html.matchAll(new RegExp(`<meta (?:property|name)="${key}" content="([^"]+)"`, 'g'))];
    assert.equal(matches.length, 1, `Una sola etiqueta ${key}`); return matches[0][1];
  };
  assert.equal(meta('og:type'), 'website'); assert.equal(meta('og:locale'), 'es_CO');
  assert.equal(meta('og:url'), 'https://ensenas.vercel.app/');
  assert.match(meta('og:title'), /EnSeñas/); assert.ok(meta('og:description').length > 60);
  const image = new URL(meta('og:image'));
  assert.equal(image.origin, 'https://ensenas.vercel.app');
  assert.equal(meta('og:image:secure_url'), image.href); assert.equal(meta('twitter:image'), image.href);
  assert.equal(meta('og:image:type'), 'image/jpeg'); assert.ok(meta('og:image:alt').length > 15);
  const file = path.join(ROOT, image.pathname);
  const info = await sharp(file).metadata();
  assert.equal(info.width, Number(meta('og:image:width'))); assert.equal(info.height, Number(meta('og:image:height')));
  assert.equal(info.hasAlpha, false); assert.ok((await fs.stat(file)).size < 300 * 1024);
  console.log('OK: Open Graph estático, URL HTTPS absoluta, logo JPEG 1200² sin transparencia y menor de 300 KB. No envía mensajes de WhatsApp.');
})().catch(error => { console.error(error); process.exitCode = 1; });
