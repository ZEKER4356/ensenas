/* URL permanente del video editorial de bienvenida, no una URL firmada temporal.
 * Puede ser una ruta del proyecto, por ejemplo assets/videos/bienvenida.mp4,
 * o una URL HTTPS de Supabase Storage. No usar una URL temporal de subida.
 * cues es opcional: tiempo en segundos y cantidad acumulada de caracteres
 * del título y del mensaje (separados por un espacio) para ajustar la sincronía
 * a la interpretación real. Se conserva el encuadre completo (object-fit: contain).
 * mobileVideoUrl es opcional; si está vacío, usa el mismo video en teléfonos.
 */
window.ENSENAS_WELCOME = {
  videoUrl: 'https://xpznsdwforvjnqnvmivz.supabase.co/storage/v1/object/public/ensenas-media/landing/bienvenida-landing.mp4',
  mobileVideoUrl: '',
  cues: []
};
