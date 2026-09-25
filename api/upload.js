/**
 * api/upload.js - Servicio de subida de archivos multimedia a Cloud Storage
 * (InsForge / Supabase Storage) para modelos 3D, previa, audio MP3 y video LSC
 */

const { getSupabase } = require('./db');
const { verifyToken, isAdminUser } = require('./auth');

const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || 'ensenas-media';
const ALLOWED_FOLDERS = new Set(['models', 'previews', 'audio', 'videos']);
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar token de administrador
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const user = verifyToken(token);

  if (!isAdminUser(user)) {
    return res.status(401).json({ error: 'Acceso no autorizado para subida de medios.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
  }

  const { action, filename, fileData, fileType, folder = 'general' } = req.body || {};

  if (!filename) {
    return res.status(400).json({ error: 'Debes enviar el nombre del archivo.' });
  }

  if (!ALLOWED_FOLDERS.has(folder)) {
    return res.status(400).json({ error: 'Carpeta de medios no válida.' });
  }

  // Se entrega una URL firmada solo a un administrador ya autenticado. El
  // navegador carga el archivo directamente a Storage y no queda limitado por
  // el tamaño del cuerpo de una función serverless (útil para WebP y videos).
  if (action === 'create-upload-slot') {
    const cleanName = filename.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
    const path = `${folder}/${Date.now()}-${cleanName}`;
    const sb = getSupabase();
    if (!sb) {
      return res.status(503).json({ error: 'Supabase Storage no está configurado; el archivo no fue guardado.' });
    }
    try {
      const { data, error } = await sb.storage.from(BUCKET_NAME).createSignedUploadUrl(path, { upsert: false });
      if (error || !data?.signedUrl) throw error || new Error('No se pudo crear una URL de subida.');
      const { data: publicUrlData } = sb.storage.from(BUCKET_NAME).getPublicUrl(path);
      if (!publicUrlData?.publicUrl) throw new Error('No se pudo obtener la URL pública del archivo.');
      return res.status(200).json({ success: true, signedUrl: data.signedUrl, url: publicUrlData.publicUrl, path });
    } catch (err) {
      console.error('Error preparando subida a Supabase Storage:', err.message);
      return res.status(502).json({ error: 'No se pudo preparar la subida a Storage.' });
    }
  }

  if (!fileData) {
    return res.status(400).json({ error: 'Debes enviar el archivo a subir.' });
  }

  const base64Payload = fileData.replace(/^data:.*?;base64,/, '');
  const buffer = Buffer.from(base64Payload, 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_SIZE_BYTES) {
    return res.status(413).json({ error: 'El archivo está vacío o supera el límite de 4 MB.' });
  }

  // Sanitizar nombre de archivo
  const cleanName = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}-${cleanName}`;

  const sb = getSupabase();
  if (!sb) {
    return res.status(503).json({ error: 'Supabase Storage no está configurado; el archivo no fue guardado.' });
  }
  try {
    const { error } = await sb.storage.from(BUCKET_NAME).upload(path, buffer, {
      contentType: fileType || 'application/octet-stream', upsert: false
    });
    if (error) throw error;
    const { data: publicUrlData } = sb.storage.from(BUCKET_NAME).getPublicUrl(path);
    if (!publicUrlData || !publicUrlData.publicUrl) throw new Error('No se pudo obtener la URL pública del archivo.');
    return res.status(201).json({ success: true, url: publicUrlData.publicUrl, path, storage: 'supabase' });
  } catch (err) {
    console.error('Error subiendo a Supabase Storage:', err.message);
    return res.status(502).json({ error: 'No se pudo guardar el archivo de forma permanente.' });
  }
};
