/**
 * api/upload.js - Servicio de subida de archivos multimedia a Cloud Storage
 * (InsForge / Supabase Storage) para modelos 3D, previa, audio MP3 y video LSC
 */

const { getSupabase } = require('./db');
const { verifyToken } = require('./auth');

const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || 'ensenas-media';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar token de administrador
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Acceso no autorizado para subida de medios.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
  }

  const { filename, fileData, fileType, folder = 'general' } = req.body || {};

  if (!filename || !fileData) {
    return res.status(400).json({ error: 'Debes enviar filename y fileData (base64).' });
  }

  // Sanitizar nombre de archivo
  const cleanName = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}-${cleanName}`;

  const sb = getSupabase();
  if (sb) {
    try {
      // Convertir base64 a Buffer
      const buffer = Buffer.from(fileData.replace(/^data:.*?;base64,/, ''), 'base64');
      const { data, error } = await sb.storage
        .from(BUCKET_NAME)
        .upload(path, buffer, {
          contentType: fileType || 'application/octet-stream',
          upsert: true
        });

      if (error) {
        console.warn('Error subiendo a Supabase Storage:', error.message);
      } else {
        // Obtener URL pública
        const { data: publicUrlData } = sb.storage.from(BUCKET_NAME).getPublicUrl(path);
        return res.status(200).json({
          success: true,
          url: publicUrlData.publicUrl,
          path: path,
          storage: 'cloud'
        });
      }
    } catch (err) {
      console.warn('Excepción en Supabase Storage:', err.message);
    }
  }

  // Fallback para desarrollo sin Cloud Storage conectado
  // Genera un data-URI o URL referencial
  const mimeType = fileType || 'application/octet-stream';
  const dataUri = fileData.startsWith('data:') ? fileData : `data:${mimeType};base64,${fileData}`;

  return res.status(200).json({
    success: true,
    url: dataUri.length < 2000000 ? dataUri : `assets/${folder}/${cleanName}`,
    path: `local/${folder}/${cleanName}`,
    storage: 'fallback'
  });
};
