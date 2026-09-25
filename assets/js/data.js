/**
 * Plataforma enseñas - Capa de Datos de Objetos Educativos
 * Soporte híbrido: Consulta API REST Serverless (/api/objetos) en Vercel
 * con respaldo automático a catálogo local para ejecución estática offline.
 */

const ENSENAS_CATALOG = {
  microbit: {
    id: 'microbit',
    titulo: 'Tarjeta Programable Micro:bit',
    nombre: 'Tarjeta Programable Micro:bit',
    categoria_lsc: 'Tecnología y Programación',
    descripcion: 'La BBC micro:bit es una pequeña tarjeta programable diseñada para facilitar el aprendizaje de la programación, electrónica y robótica educativa mediante sensores y matriz LED.',
    activo: true,
    modelo_3d_url: 'assets/models/microbit.glb',
    icono_preview_url: 'assets/models/microbit.glb',
    audio_url: 'assets/audio/microbit-audio.wav',
    archivo_audio_url: 'assets/audio/microbit-audio.wav',
    audio_texto: 'Bienvenido a enseñas. Estás observando la tarjeta programable Micro:bit en Realidad Aumentada. Este dispositivo cuenta con una matriz de 25 luces LED, sensores de movimiento, brújula y botones interactivos. Es una herramienta pedagógica diseñada para aprender programación, electrónica y robótica de manera práctica e inclusiva.',
    explicacion_texto: 'Bienvenido a enseñas. Estás observando la tarjeta programable Micro:bit en Realidad Aumentada. Este dispositivo cuenta con una matriz de 25 luces LED, sensores de movimiento, brújula y botones interactivos. Es una herramienta pedagógica diseñada para aprender programación, electrónica y robótica de manera práctica e inclusiva.',
    video_uso_url: 'assets/videos/microbit-uso.mp4',
    video_lsc_url: 'assets/videos/microbit-lsc.mp4',
    video_aprender_lsc_url: '',
    instrucciones_lsc: [
      '1. Configuración manual: Mano dominante en letra M (o palma hacia abajo simulando la forma de una tarjeta rectangular pequeña).',
      '2. Movimiento: Desplazar suavemente de izquierda a derecha delineando el contorno del circuito.',
      '3. Orientación y gesto: Acompañar con gesto facial de precisión y señalar la matriz de luces o pines de conexión con el dedo índice.'
    ],
    orden: 1
  },
  telescopio: {
    id: 'telescopio',
    titulo: 'Telescopio Astronómico',
    nombre: 'Telescopio Astronómico',
    categoria_lsc: 'Astronomía y Ciencias',
    descripcion: 'Instrumento óptico que permite observar objetos lejanos, especialmente cuerpos celestes en el espacio como planetas, estrellas y nebulosas.',
    activo: true,
    modelo_3d_url: 'assets/models/telescopio.glb',
    icono_preview_url: 'assets/models/telescopio.glb',
    audio_url: 'assets/audio/telescopio-audio.wav',
    archivo_audio_url: 'assets/audio/telescopio-audio.wav',
    audio_texto: 'Bienvenido a enseñas. Este es el telescopio astronómico en Realidad Aumentada. Es un instrumento óptico compuesto por lentes y espejos diseñado para observar cuerpos celestes lejanos como la Luna, planetas y nebulosas. Permite acercar el fascinante estudio de la astronomía al aula de clase.',
    explicacion_texto: 'Bienvenido a enseñas. Este es el telescopio astronómico en Realidad Aumentada. Es un instrumento óptico compuesto por lentes y espejos diseñado para observar cuerpos celestes lejanos como la Luna, planetas y nebulosas. Permite acercar el fascinante estudio de la astronomía al aula de clase.',
    video_uso_url: 'assets/videos/telescopio-uso.mp4',
    video_lsc_url: 'assets/videos/telescopio-lsc.mp4',
    video_aprender_lsc_url: '',
    instrucciones_lsc: [
      '1. Configuración manual: Ambas manos en forma de cilindro (letra C / puño hueco) alineadas a la altura del ojo dominante.',
      '2. Movimiento: Extender levemente la mano delantera simulando el tubo óptico y ajustar el foco con los dedos índice y pulgar.',
      '3. Orientación y gesto: Inclinar la cabeza hacia arriba manteniendo la mirada en el visor con expresión de observación atenta.'
    ],
    orden: 2
  },
  microscopio: {
    id: 'microscopio',
    titulo: 'Microscopio Óptico',
    nombre: 'Microscopio Óptico',
    categoria_lsc: 'Biología y Laboratorio',
    descripcion: 'Herramienta de laboratorio que amplifica imágenes de objetos diminutos que no pueden ser observados a simple vista por el ojo humano.',
    activo: true,
    modelo_3d_url: 'assets/models/microscopio.glb',
    icono_preview_url: 'assets/models/microscopio.glb',
    audio_url: 'assets/audio/microscopio-audio.wav',
    archivo_audio_url: 'assets/audio/microscopio-audio.wav',
    audio_texto: 'Bienvenido a enseñas. Estás viendo el microscopio óptico en Realidad Aumentada. Esta herramienta de laboratorio utiliza lentes de gran aumento para observar muestras y microorganismos invisibles a simple vista, como células y bacterias, facilitando el aprendizaje en ciencias y biología.',
    explicacion_texto: 'Bienvenido a enseñas. Estás viendo el microscopio óptico en Realidad Aumentada. Esta herramienta de laboratorio utiliza lentes de gran aumento para observar muestras y microorganismos invisibles a simple vista, como células y bacterias, facilitando el aprendizaje en ciencias y biología.',
    video_uso_url: 'assets/videos/microscopio-uso.mp4',
    video_lsc_url: 'assets/videos/microscopio-lsc.mp4',
    video_aprender_lsc_url: '',
    instrucciones_lsc: [
      '1. Configuración manual: Mano no dominante como base plana (platina). Mano dominante forma un ángulo sobre la base representando el tubo ocular.',
      '2. Movimiento: Con los dedos índice y pulgar de la mano derecha, realizar giros leves simulando el tornillo micrométrico de enfoque.',
      '3. Orientación y gesto: Acercar el rostro en ademán de mirar a través del ocular con un ojo cerrado o enfocado.'
    ],
    orden: 3
  }
};

/**
 * Normalizar estructura de un objeto garantizando compatibilidad entre
 * nombres de columnas PostgreSQL y frontend
 */
function normalizeObjectData(item) {
  if (!item) return null;
  return {
    ...item,
    nombre: item.titulo || item.nombre || item.id,
    titulo: item.titulo || item.nombre || item.id,
    categoria_lsc: item.categoria_lsc || 'Ciencia y Tecnología',
    audio_texto: item.explicacion_texto || item.audio_texto || '',
    explicacion_texto: item.explicacion_texto || item.audio_texto || '',
    audio_url: item.archivo_audio_url || item.audio_url || '',
    archivo_audio_url: item.archivo_audio_url || item.audio_url || '',
    video_aprender_lsc_url: item.video_aprender_lsc_url || '',
    qr_code_url: item.qr_code_url || `/objeto.html?id=${encodeURIComponent(item.id)}`,
    activo: item.activo !== false
  };
}

/**
 * Obtener un objeto por su ID (Síncrono fallback)
 * @param {string} id 
 * @returns {object|null}
 */
function getObjectById(id) {
  if (!id) return null;
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('ensenas_local_objects');
    if (saved) {
      try {
        const list = JSON.parse(saved);
        const item = list.find((o) => o.id === id);
        if (item) return normalizeObjectData(item);
      } catch (e) {}
    }
  }
  const raw = ENSENAS_CATALOG[id] || null;
  return normalizeObjectData(raw);
}

/**
 * Obtener todos los objetos del catálogo (Síncrono fallback)
 * @returns {Array}
 */
function getAllObjects() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('ensenas_local_objects');
    if (saved) {
      try {
        const list = JSON.parse(saved);
        if (Array.isArray(list) && list.length > 0) {
          return list.map(normalizeObjectData);
        }
      } catch (e) {}
    }
  }
  return Object.values(ENSENAS_CATALOG).map(normalizeObjectData);
}

/**
 * Consultar objetos de forma asíncrona (con fallback automático)
 * @returns {Promise<Array>}
 */
async function fetchAllObjectsAsync() {
  try {
    const res = await fetch('/api/objetos');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(normalizeObjectData);
      }
    }
  } catch (err) {
    console.warn('API /api/objetos no disponible, utilizando catálogo local:', err);
  }
  return getAllObjects();
}

/**
 * Consultar objeto por ID de forma asíncrona
 * @param {string} id 
 * @returns {Promise<object|null>}
 */
async function fetchObjectByIdAsync(id) {
  if (!id) return null;
  try {
    const res = await fetch(`/api/objetos?id=${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        return normalizeObjectData(data);
      }
    }
  } catch (err) {
    console.warn(`API /api/objetos?id=${id} no disponible, utilizando catálogo local:`, err);
  }
  return getObjectById(id);
}

// Exportar en window para uso global
if (typeof window !== 'undefined') {
  window.ENSENAS_CATALOG = ENSENAS_CATALOG;
  window.getObjectById = getObjectById;
  window.getAllObjects = getAllObjects;
  window.fetchAllObjectsAsync = fetchAllObjectsAsync;
  window.fetchObjectByIdAsync = fetchObjectByIdAsync;
  window.normalizeObjectData = normalizeObjectData;
}
