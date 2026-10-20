/* Optimización de retratos originales; nunca modifica las fotos de origen. */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(require.resolve('sharp', { paths: [process.env.ENSENAS_RUNTIME_PACKAGES || process.cwd()] }));
const root = path.resolve(__dirname, '..');
const people = [
  ['edward-rojas', 'profe EDWARD IGNACIO ROJAS DIAZ.jpg'],
  ['elizabeth-cordoba', 'profe Elizabeth Carolina Cordoba Pinedo.jpeg'],
  ['orlando-laborde', 'profe ORLANDO CLARETH LABORDE MONTES.jpeg'],
  ['merky-ariza', 'Merky Sebastian Ariza Campo.jpg'],
  ['luis-almanza', 'Luis David Almanza Aritama.jpeg'],
  ['daniel-oliveros', 'Daniel Santiago Oliveros Benjumea.jpeg'],
  ['alvaro-rudas', 'ALVARO JAVIER RUDAS HERRERA.jpeg'],
  ['tahir-delgahan', 'TAHIR DAVID DELGAHAN ARITAMA.jpeg']
];
(async () => {
  const out = path.join(root, 'assets/images/equipo');
  await fs.mkdir(out, { recursive: true });
  for (const [slug, filename] of people) {
    if (slug === 'elizabeth-cordoba' && !process.env.ENSENAS_ELIZABETH_CUTOUT) {
      // El recorte se prepara con edición de imagen, no con este optimizador.
      await fs.access(path.join(out, slug + '.webp'));
      continue;
    }
    const source = slug === 'elizabeth-cordoba' && process.env.ENSENAS_ELIZABETH_CUTOUT
      ? process.env.ENSENAS_ELIZABETH_CUTOUT : path.join(root, 'img/equipo-de-trabajo', filename);
    await sharp(source).rotate().resize({ width: 900, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toFile(path.join(out, slug + '.webp'));
  }
  await sharp(path.join(root, 'img/cultura-sorda-1-1-624x399.png')).resize({ width: 624, withoutEnlargement: true }).webp({ quality: 88 }).toFile(path.join(root, 'assets/images/curso-lsc-cultura-sorda.webp'));
  if (process.env.ENSENAS_SCREENSHOTS_DIR) {
    const tiles = [];
    for (let i = 0; i < people.length; i++) {
      const [slug] = people[i];
      const portrait = await sharp(path.join(out, slug + '.webp')).resize(220, 280, { fit: 'contain', background: '#eae5f7' }).png().toBuffer();
      const label = Buffer.from(`<svg width="220" height="40"><rect width="220" height="40" fill="white"/><text x="10" y="24" font-size="16">${slug}</text></svg>`);
      tiles.push({ input: portrait, left: i % 4 * 220, top: Math.floor(i / 4) * 320 }, { input: label, left: i % 4 * 220, top: Math.floor(i / 4) * 320 + 280 });
    }
    await sharp({ create: { width: 880, height: 640, channels: 3, background: '#ffffff' } }).composite(tiles).png().toFile(path.join(process.env.ENSENAS_SCREENSHOTS_DIR, 'team-contact-sheet.png'));
  }
  console.log('8 retratos y miniatura del curso optimizados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
