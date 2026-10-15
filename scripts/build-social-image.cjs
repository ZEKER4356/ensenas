/* Deriva la imagen para compartir del logo oficial; no modifica los originales. */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(require.resolve('sharp', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const icon = await sharp(path.join(ROOT, 'ensenas logo.png')).trim().resize(760, 760, { fit: 'inside' }).png().toBuffer();
  const wordmark = await sharp(path.join(ROOT, 'ensenas imagotipo.png')).trim().resize(760, 230, { fit: 'inside' }).png().toBuffer();
  const iconSize = await sharp(icon).metadata(), wordmarkSize = await sharp(wordmark).metadata();
  const output = path.join(ROOT, 'assets/images/ensenas-compartir-v1.jpg');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#ffffff' } })
    .composite([
      { input: icon, left: Math.round((1200 - iconSize.width) / 2), top: 100 },
      { input: wordmark, left: Math.round((1200 - wordmarkSize.width) / 2), top: 910 }
    ]).jpeg({ quality: 88, mozjpeg: true }).toFile(output);
  const result = await fs.stat(output);
  console.log(`OK: imagen oficial para compartir, 1200×1200, ${Math.round(result.size / 1024)} KB.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
