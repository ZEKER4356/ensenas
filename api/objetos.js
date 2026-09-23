/**
 * api/objetos.js - Endpoint REST Serverless para gestión de objetos y modelos 3D
 */

const { queryObjetos, queryObjetoById, saveObjeto, deleteObjeto } = require('./db');
const { verifyToken, isAdminUser } = require('./auth');

module.exports = async function handler(req, res) {
  // Manejo de CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extraer token de autorización
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const user = verifyToken(token);
  const isAdmin = isAdminUser(user);

  const { id } = req.query;

  // --------------------------------------------------------------------------
  // GET: Obtener lista de objetos o un objeto específico
  // --------------------------------------------------------------------------
  if (req.method === 'GET') {
    if (id) {
      const objeto = await queryObjetoById(id);
      if (!objeto) {
        return res.status(404).json({ error: `Objeto con ID "${id}" no encontrado.` });
      }
      return res.status(200).json(objeto);
    }

    // Listado: si es admin o solicita explícitamente all=true con token, incluir inactivos
    const incluirTodos = isAdmin;
    const objetos = await queryObjetos({ soloActivos: !incluirTodos });
    return res.status(200).json(objetos);
  }

  // --------------------------------------------------------------------------
  // Operaciones de Escritura / Mutación (Requieren rol de administrador)
  // --------------------------------------------------------------------------
  if (!isAdmin) {
    return res.status(401).json({
      error: 'Acceso no autorizado. Se requiere iniciar sesión como administrador.'
    });
  }

  // --------------------------------------------------------------------------
  // POST: Crear nuevo objeto educativo
  // --------------------------------------------------------------------------
  if (req.method === 'POST') {
    const data = req.body || {};

    if (!data.titulo || !data.modelo_3d_url || !data.explicacion_texto) {
      return res.status(400).json({
        error: 'Campos obligatorios faltantes: título, modelo 3D y texto explicativo.'
      });
    }

    // Generar ID slug limpio si no se especificó
    let objectId = (data.id || data.titulo)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!objectId) objectId = `objeto-${Date.now()}`;

    const nuevoObjeto = {
      id: objectId,
      titulo: data.titulo.trim(),
      categoria_lsc: data.categoria_lsc ? data.categoria_lsc.trim() : 'Ciencia y Tecnología',
      descripcion: data.descripcion ? data.descripcion.trim() : '',
      activo: data.activo !== false,
      modelo_3d_url: data.modelo_3d_url.trim(),
      icono_preview_url: data.icono_preview_url ? data.icono_preview_url.trim() : '',
      qr_code_url: `/objeto.html?id=${encodeURIComponent(objectId)}`,
      explicacion_texto: data.explicacion_texto.trim(),
      archivo_audio_url: data.archivo_audio_url ? data.archivo_audio_url.trim() : '',
      video_lsc_url: data.video_lsc_url ? data.video_lsc_url.trim() : '',
      video_uso_url: data.video_uso_url ? data.video_uso_url.trim() : '',
      instrucciones_lsc: Array.isArray(data.instrucciones_lsc)
        ? data.instrucciones_lsc
        : typeof data.instrucciones_lsc === 'string' && data.instrucciones_lsc.trim()
        ? data.instrucciones_lsc.split('\n').map((s) => s.trim()).filter(Boolean)
        : [],
      orden: typeof data.orden === 'number' ? data.orden : 0
    };

    try {
      const guardado = await saveObjeto(nuevoObjeto);
      return res.status(201).json({
        success: true,
        message: 'Objeto creado exitosamente',
        objeto: guardado
      });
    } catch (err) {
      return res.status(500).json({ error: 'Error al registrar objeto: ' + err.message });
    }
  }

  // --------------------------------------------------------------------------
  // PUT: Actualizar objeto existente o conmutar estado activo/inactivo
  // --------------------------------------------------------------------------
  if (req.method === 'PUT') {
    const data = req.body || {};
    const targetId = id || data.id;

    if (!targetId) {
      return res.status(400).json({ error: 'Debes especificar el ID del objeto a actualizar.' });
    }

    const existente = await queryObjetoById(targetId);
    if (!existente) {
      return res.status(404).json({ error: `Objeto "${targetId}" no encontrado.` });
    }

    // Soporte para toggle rápido de estado activo/inactivo
    const objetoActualizado = {
      ...existente,
      ...data,
      id: targetId // Mantener ID inmutable
    };

    if (data.instrucciones_lsc && typeof data.instrucciones_lsc === 'string') {
      objetoActualizado.instrucciones_lsc = data.instrucciones_lsc.split('\n').map(s => s.trim()).filter(Boolean);
    }

    if (!objetoActualizado.qr_code_url) {
      objetoActualizado.qr_code_url = `/objeto.html?id=${encodeURIComponent(targetId)}`;
    }

    try {
      const guardado = await saveObjeto(objetoActualizado);
      return res.status(200).json({
        success: true,
        message: 'Objeto actualizado exitosamente',
        objeto: guardado
      });
    } catch (err) {
      return res.status(500).json({ error: 'Error al actualizar objeto: ' + err.message });
    }
  }

  // --------------------------------------------------------------------------
  // DELETE: Eliminar objeto
  // --------------------------------------------------------------------------
  if (req.method === 'DELETE') {
    const targetId = id || (req.body && req.body.id);
    if (!targetId) {
      return res.status(400).json({ error: 'Debes especificar el ID del objeto a eliminar.' });
    }

    try {
      await deleteObjeto(targetId);
      return res.status(200).json({
        success: true,
        message: `Objeto "${targetId}" eliminado correctamente.`
      });
    } catch (err) {
      return res.status(500).json({ error: 'Error al eliminar objeto: ' + err.message });
    }
  }

  return res.status(405).json({ error: `Método HTTP ${req.method} no permitido.` });
};
