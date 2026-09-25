/**
 * api/db.js - Conector centralizado a PostgreSQL (InsForge / Supabase / Neon)
 * con tolerancia a fallos y fallback en memoria.
 */

let pgPool = null;
let supabaseClient = null;

// Catálogo base de respaldo en memoria si la BD aún no está enlazada
const DEFAULT_SEED_OBJECTS = [
  {
    id: 'microbit',
    titulo: 'Tarjeta Programable Micro:bit',
    categoria_lsc: 'Tecnología y Programación',
    descripcion: 'La BBC micro:bit es una pequeña tarjeta programable diseñada para facilitar el aprendizaje de la programación, electrónica y robótica educativa mediante sensores y matriz LED.',
    activo: true,
    modelo_3d_url: 'assets/models/microbit.glb',
    icono_preview_url: 'assets/models/microbit.glb',
    qr_code_url: '/objeto.html?id=microbit',
    explicacion_texto: 'Bienvenido a enseñas. Estás observando la tarjeta programable Micro:bit en Realidad Aumentada. Este dispositivo cuenta con una matriz de 25 luces LED, sensores de movimiento, brújula y botones interactivos. Es una herramienta pedagógica diseñada para aprender programación, electrónica y robótica de manera práctica e inclusiva.',
    archivo_audio_url: 'assets/audio/microbit-audio.wav',
    video_lsc_url: 'assets/videos/microbit-lsc.mp4',
    video_aprender_lsc_url: '',
    video_uso_url: 'assets/videos/microbit-uso.mp4',
    instrucciones_lsc: [
      '1. Configuración manual: Mano dominante en letra M (o palma hacia abajo simulando la forma de una tarjeta rectangular pequeña).',
      '2. Movimiento: Desplazar suavemente de izquierda a derecha delineando el contorno del circuito.',
      '3. Orientación y gesto: Acompañar con gesto facial de precisión y señalar la matriz de luces o pines de conexión con el dedo índice.'
    ],
    orden: 1,
    creado_en: new Date().toISOString()
  },
  {
    id: 'telescopio',
    titulo: 'Telescopio Astronómico',
    categoria_lsc: 'Astronomía y Ciencias',
    descripcion: 'Instrumento óptico que permite observar objetos lejanos, especialmente cuerpos celestes en el espacio como planetas, estrellas y nebulosas.',
    activo: true,
    modelo_3d_url: 'assets/models/telescopio.glb',
    icono_preview_url: 'assets/models/telescopio.glb',
    qr_code_url: '/objeto.html?id=telescopio',
    explicacion_texto: 'Bienvenido a enseñas. Este es el telescopio astronómico en Realidad Aumentada. Es un instrumento óptico compuesto por lentes y espejos diseñado para observar cuerpos celestes lejanos como la Luna, planetas y nebulosas. Permite acercar el fascinante estudio de la astronomía al aula de clase.',
    archivo_audio_url: 'assets/audio/telescopio-audio.wav',
    video_lsc_url: 'assets/videos/telescopio-lsc.mp4',
    video_aprender_lsc_url: '',
    video_uso_url: 'assets/videos/telescopio-uso.mp4',
    instrucciones_lsc: [
      '1. Configuración manual: Ambas manos en forma de cilindro (letra C / puño hueco) alineadas a la altura del ojo dominante.',
      '2. Movimiento: Extender levemente la mano delantera simulando el tubo óptico y ajustar el foco con los dedos índice y pulgar.',
      '3. Orientación y gesto: Inclinar la cabeza hacia arriba manteniendo la mirada en el visor con expresión de observación atenta.'
    ],
    orden: 2,
    creado_en: new Date().toISOString()
  },
  {
    id: 'microscopio',
    titulo: 'Microscopio Óptico',
    categoria_lsc: 'Biología y Laboratorio',
    descripcion: 'Herramienta de laboratorio que amplifica imágenes de objetos diminutos que no pueden ser observados a simple vista por el ojo humano.',
    activo: true,
    modelo_3d_url: 'assets/models/microscopio.glb',
    icono_preview_url: 'assets/models/microscopio.glb',
    qr_code_url: '/objeto.html?id=microscopio',
    explicacion_texto: 'Bienvenido a enseñas. Estás viendo el microscopio óptico en Realidad Aumentada. Esta herramienta de laboratorio utiliza lentes de gran aumento para observar muestras y microorganismos invisibles a simple vista, como células y bacterias, facilitando el aprendizaje en ciencias y biología.',
    archivo_audio_url: 'assets/audio/microscopio-audio.wav',
    video_lsc_url: 'assets/videos/microscopio-lsc.mp4',
    video_aprender_lsc_url: '',
    video_uso_url: 'assets/videos/microscopio-uso.mp4',
    instrucciones_lsc: [
      '1. Configuración manual: Mano no dominante como base plana (platina). Mano dominante forma un ángulo sobre la base representando el tubo ocular.',
      '2. Movimiento: Con los dedos índice y pulgar de la mano derecha, realizar giros leves simulando el tornillo micrométrico de enfoque.',
      '3. Orientación y gesto: Acercar el rostro en ademán de mirar a través del ocular con un ojo cerrado o enfocado.'
    ],
    orden: 3,
    creado_en: new Date().toISOString()
  }
];

// Almacén en memoria compartido en el ciclo de vida del contenedor
let memoryObjects = [...DEFAULT_SEED_OBJECTS];

function hasPersistentStoreConfig() {
  return Boolean(process.env.DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.INSFORGE_API_URL);
}

/**
 * Inicializar cliente de conexión a PostgreSQL
 */
function getPgPool() {
  if (pgPool) return pgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000
    });
    return pgPool;
  } catch (err) {
    console.warn('Modulo "pg" no disponible o error al conectar:', err.message);
    return null;
  }
}

/**
 * Inicializar cliente Supabase / InsForge REST
 */
function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.INSFORGE_API_URL;
  // La clave secreta solo existe en las funciones de Vercel, nunca en el navegador.
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  try {
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false }
    });
    return supabaseClient;
  } catch (err) {
    console.warn('Modulo "@supabase/supabase-js" no disponible:', err.message);
    return null;
  }
}

/**
 * Consultar objetos (desde PostgreSQL o memoria)
 */
async function queryObjetos({ soloActivos = true } = {}) {
  const pool = getPgPool();
  if (pool) {
    try {
      const query = soloActivos
        ? 'SELECT * FROM objetos WHERE activo = true ORDER BY orden ASC, creado_en DESC'
        : 'SELECT * FROM objetos ORDER BY orden ASC, creado_en DESC';
      const res = await pool.query(query);
      return res.rows;
    } catch (err) {
      console.warn('Error en consulta PostgreSQL, utilizando fallback:', err.message);
    }
  }

  const sb = getSupabase();
  if (sb) {
    try {
      let query = sb.from('objetos').select('*').order('orden', { ascending: true });
      if (soloActivos) query = query.eq('activo', true);
      const { data, error } = await query;
      if (!error && data) return data;
    } catch (err) {
      console.warn('Error en Supabase, utilizando fallback:', err.message);
    }
  }

  // Fallback en memoria
  return soloActivos ? memoryObjects.filter((o) => o.activo) : memoryObjects;
}

/**
 * Consultar un objeto por ID
 */
async function queryObjetoById(id) {
  if (!id) return null;

  const pool = getPgPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM objetos WHERE id = $1 LIMIT 1', [id]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn('Error en consulta por ID PostgreSQL:', err.message);
    }
  }

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from('objetos').select('*').eq('id', id).single();
      if (!error && data) return data;
    } catch (err) {
      console.warn('Error en Supabase por ID:', err.message);
    }
  }

  return memoryObjects.find((o) => o.id === id) || null;
}

/**
 * Crear o actualizar objeto
 */
async function saveObjeto(objeto) {
  const persistenceErrors = [];
  const pool = getPgPool();
  if (pool) {
    try {
      const query = `
        INSERT INTO objetos (
          id, titulo, categoria_lsc, descripcion, activo,
          modelo_3d_url, icono_preview_url, qr_code_url, explicacion_texto,
          archivo_audio_url, video_lsc_url, video_aprender_lsc_url, video_uso_url, instrucciones_lsc, orden
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          titulo = EXCLUDED.titulo,
          categoria_lsc = EXCLUDED.categoria_lsc,
          descripcion = EXCLUDED.descripcion,
          activo = EXCLUDED.activo,
          modelo_3d_url = EXCLUDED.modelo_3d_url,
          icono_preview_url = EXCLUDED.icono_preview_url,
          qr_code_url = EXCLUDED.qr_code_url,
          explicacion_texto = EXCLUDED.explicacion_texto,
          archivo_audio_url = EXCLUDED.archivo_audio_url,
          video_lsc_url = EXCLUDED.video_lsc_url,
          video_aprender_lsc_url = EXCLUDED.video_aprender_lsc_url,
          video_uso_url = EXCLUDED.video_uso_url,
          instrucciones_lsc = EXCLUDED.instrucciones_lsc,
          orden = EXCLUDED.orden,
          actualizado_en = NOW()
        RETURNING *;
      `;
      const values = [
        objeto.id,
        objeto.titulo,
        objeto.categoria_lsc || 'Ciencia y Tecnología',
        objeto.descripcion || '',
        objeto.activo !== false,
        objeto.modelo_3d_url,
        objeto.icono_preview_url || '',
        objeto.qr_code_url || `/objeto.html?id=${encodeURIComponent(objeto.id)}`,
        objeto.explicacion_texto,
        objeto.archivo_audio_url || '',
        objeto.video_lsc_url || '',
        objeto.video_aprender_lsc_url || '',
        objeto.video_uso_url || '',
        JSON.stringify(objeto.instrucciones_lsc || []),
        objeto.orden || 0
      ];
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (err) {
      persistenceErrors.push(`PostgreSQL: ${err.message}`);
    }
  }

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from('objetos').upsert(objeto).select().single();
      if (!error && data) return data;
      if (error) persistenceErrors.push(`Supabase: ${error.message}`);
    } catch (err) {
      persistenceErrors.push(`Supabase: ${err.message}`);
    }
  }

  // Nunca confirmar un guardado en memoria si el despliegue tiene BD configurada.
  if (hasPersistentStoreConfig()) {
    throw new Error(`No fue posible persistir el objeto. ${persistenceErrors.join(' | ') || 'La conexión no está disponible.'}`);
  }

  // Guardar en memoria
  const idx = memoryObjects.findIndex((o) => o.id === objeto.id);
  if (idx >= 0) {
    memoryObjects[idx] = { ...memoryObjects[idx], ...objeto, actualizado_en: new Date().toISOString() };
    return memoryObjects[idx];
  } else {
    const nuevo = { ...objeto, creado_en: new Date().toISOString() };
    memoryObjects.push(nuevo);
    return nuevo;
  }
}

/**
 * Eliminar objeto
 */
async function deleteObjeto(id) {
  const persistenceErrors = [];
  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query('DELETE FROM objetos WHERE id = $1', [id]);
      return true;
    } catch (err) {
      persistenceErrors.push(`PostgreSQL: ${err.message}`);
    }
  }

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from('objetos').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      persistenceErrors.push(`Supabase: ${err.message}`);
    }
  }

  if (hasPersistentStoreConfig()) {
    throw new Error(`No fue posible eliminar el objeto. ${persistenceErrors.join(' | ') || 'La conexión no está disponible.'}`);
  }

  memoryObjects = memoryObjects.filter((o) => o.id !== id);
  return true;
}

module.exports = {
  getPgPool,
  getSupabase,
  hasPersistentStoreConfig,
  queryObjetos,
  queryObjetoById,
  saveObjeto,
  deleteObjeto
};
