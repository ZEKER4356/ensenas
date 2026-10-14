/* Añadir aquí la URL permanente del video cuando esté grabado y subido.
 * Puede ser una ruta del proyecto, por ejemplo assets/videos/bienvenida.mp4,
 * o una URL HTTPS de Supabase Storage. No usar una URL temporal de subida.
 * cues es opcional: tiempo en segundos y cantidad acumulada de caracteres
 * del título y del mensaje (separados por un espacio) para ajustar la sincronía
 * a la interpretación real. El video llena la pantalla: grabar al intérprete
 * en la zona derecha, dentro del encuadre. mobileVideoUrl permite una versión
 * vertical para evitar recortes en teléfonos; si está vacío, usa videoUrl.
 */
window.ENSENAS_WELCOME = {
  videoUrl: '',
  mobileVideoUrl: '',
  cues: []
};
