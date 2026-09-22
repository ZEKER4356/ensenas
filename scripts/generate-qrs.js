/**
 * scripts/generate-qrs.js - Rutina CLI/Servidor para regeneración y actualización masiva
 * de Códigos QR Personalizados en todos los objetos educativos registrados.
 */

const { queryObjetos, saveObjeto } = require('../api/db');

async function runBatchRegeneration() {
  console.log('====================================================');
  console.log('  enseñas - Rutina de Actualización Masiva de QRs');
  console.log('====================================================\n');

  try {
    const objetos = await queryObjetos({ soloActivos: false });
    console.log(`Objetos encontrados en base de datos: ${objetos.length}`);

    let procesados = 0;
    for (const obj of objetos) {
      const canonicalQrTarget = `/ra/${obj.id}`;
      const necesitaActualizacion = obj.qr_code_url !== canonicalQrTarget;

      obj.qr_code_url = canonicalQrTarget;
      await saveObjeto(obj);
      procesados++;

      console.log(`[${procesados}/${objetos.length}] Objeto "${obj.titulo || obj.id}":`);
      console.log(`   -> Destino RA: ${canonicalQrTarget}`);
      console.log(`   -> Estado: ${necesitaActualizacion ? 'QR Actualizado' : 'QR Vigente'}\n`);
    }

    console.log('====================================================');
    console.log(`✓ Proceso completado exitosamente: ${procesados} objetos actualizados.`);
    console.log('====================================================');
  } catch (err) {
    console.error('Error durante la actualización masiva:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runBatchRegeneration();
}

module.exports = { runBatchRegeneration };
