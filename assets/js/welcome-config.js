/* URL permanente del video editorial de bienvenida, no una URL firmada temporal.
 * Puede ser una ruta del proyecto, por ejemplo assets/videos/bienvenida.mp4,
 * o una URL HTTPS de Supabase Storage. No usar una URL temporal de subida.
 * El texto se anima con reloj independiente y queda completo al terminar.
 * replayDelaySeconds mantiene el último fotograma antes de repetir el video.
 * Se conserva el encuadre completo (object-fit: contain).
 * mobileVideoUrl es opcional; si está vacío, usa el mismo video en teléfonos.
 */
window.ENSENAS_WELCOME = {
  videoUrl: 'https://xpznsdwforvjnqnvmivz.supabase.co/storage/v1/object/public/ensenas-media/landing/bienvenida-landing.mp4',
  mobileVideoUrl: '',
  replayDelaySeconds: 5
};
