/* Deriva la imagen para compartir del logo oficial; no modifica los originales. */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(require.resolve('sharp', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const icon = await sharp(path.join(ROOT, 'ensenas logo.png')).trim().resize(960, 960, { fit: 'inside' }).png().toBuffer();
  const iconSize = await sharp(icon).metadata();
  const output = path.join(ROOT, 'assets/images/ensenas-icono-compartir-v2.jpg');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#ffffff' } })
    .composite([
      { input: icon, left: Math.round((1200 - iconSize.width) / 2), top: Math.round((1200 - iconSize.height) / 2) }
    ]).jpeg({ quality: 88, mozjpeg: true }).toFile(output);
  const result = await fs.stat(output);
  console.log(`OK: imagen oficial para compartir, 1200×1200, ${Math.round(result.size / 1024)} KB.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
