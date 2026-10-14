# Activar Comunidad y accesibilidad LSC

Implementado en `codex/ajustes-innovafest`. La landing conserva su diseño. No ejecutar de nuevo `schema.sql`: esta actualización tiene su propia migración aditiva.

## 1. Preparar Supabase

1. Selecciona el proyecto que usa el despliegue **Preview**. Es preferible un proyecto de pruebas separado; si comparte la base de producción, estas tablas son nuevas y no modifican los objetos ni los administradores existentes.
2. Conserva una copia de seguridad disponible de la base. Abre SQL Editor y ejecuta **todo** `migrations/20261013_comunidad_lsc.sql` en una sola consulta. Debe terminar sin errores. Crea perfiles, aportes, interpretaciones, funciones y el bucket privado `ensenas-comunidad`.
3. En Authentication habilita el proveedor Email, el registro de usuarios y la confirmación de correo. Los participantes usan **Supabase Auth**, no la tabla `administradores`. Nunca compartas una cuenta Admin para que alguien aporte una seña.
4. En la configuración de URL de Auth, establece el sitio de prueba y autoriza sus direcciones `/sube-tu-sena` y `/sube-tu-sena.html` como redirecciones. La URL debe coincidir con `PUBLIC_APP_URL`. Usa una URL de rama estable para no cambiarla en cada despliegue.
5. Comprueba que la Data API exponga el esquema `public`. Las tablas nuevas tienen RLS y no conceden acceso directo a `anon` ni a `authenticated`. El backend consulta con la clave secreta y comprueba cada permiso.

No hagas público el bucket de Comunidad ni le añadas políticas de lectura o escritura generales. Si ya existen políticas amplias personalizadas sobre Storage, revisa que **no incluyan** `ensenas-comunidad`.

## 2. Variables de Vercel Preview

Mantén las variables actuales del catálogo y Admin. Para Comunidad se utilizan:

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | URL base del mismo proyecto, sin `/rest/v1/` |
| `SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta del servidor, nunca en HTML/JS público |
| `SUPABASE_ANON_KEY` o `SUPABASE_PUBLISHABLE_KEY` | Clave pública anon/publishable para Supabase Auth; es diferente de la anterior |
| `JWT_SECRET` | El secreto actual del Admin, sin cambiarlo |
| `PUBLIC_APP_URL` | Origen HTTPS de la rama de pruebas, sin ruta final |

Guarda los cambios y haz Redeploy del despliegue de la rama. No se necesita otra clave JWT para participantes. Sus sesiones usan cookies HttpOnly independientes y la identidad se verifica en Supabase Auth. El frontend no recibe claves secretas.

## 3. Prueba completa antes de publicar

1. Abre **Sube tu seña**, crea una cuenta con un correo real y alias público, confirma el correo e inicia sesión.
2. Selecciona un video o abre la cámara del teléfono. En equipos sin captura nativa se abrirá el selector de archivos. Deben verse rostro, manos y torso completos. MP4 es la opción preferida; también se admite WebM y MOV si el navegador puede reproducirlos.
3. El límite es 25 MB y 60 segundos. Tamaño y MIME se comprueban también en Storage/servidor; la duración se comprueba en el navegador y debe revisarla la persona moderadora. No existe transcodificación automática.
4. Escribe el significado de **cualquier** palabra, saludo o expresión en LSC, y el contexto o variante regional si corresponde. Acepta la autorización y envía.
5. Verifica que se muestre **pendiente de revisión** en Mis aportes. No debe aparecer todavía en Comunidad ni sumar al leaderboard. El servidor comprueba que el archivo almacenado coincide en tamaño y MIME antes de confirmar.
6. Si una confirmación falla después de subir, vuelve a pulsar Enviar: reintenta la confirmación sin repetir la subida. Tras recargar, un borrador puede verificarse con **Comprobar y enviar**. Si nunca terminó de subirse, selecciona y envía un archivo nuevo.
7. Entra al Admin con tus credenciales de siempre. En **Comunidad e interpretación LSC**, revisa el video y su significado con una persona competente en LSC, comprueba autorización y confirma la revisión antes de aprobar.
8. Al aprobar, debe aparecer en Comunidad y sumar exactamente un aporte. Aprobarlo nuevamente no duplica puntos. **No publicar / Retirar publicación**, con motivo, lo excluye de la galería y del leaderboard.
9. En el catálogo pulsa **Aprender una seña**. Cada tarjeta recibe un aporte aprobado al azar, estable durante esa visita. Se evitan repeticiones hasta agotar el grupo disponible (hasta 24 señas obtenidas aleatoriamente de toda la colección). No tiene relación obligatoria con el objeto 3D. La práctica dentro de la página del objeto también usa Comunidad; los antiguos videos/pasos de práctica se conservan en datos pero ya no se muestran como traducciones del objeto.
10. Repite en Android y Safari de iPhone, con modo claro/oscuro y texto ampliado. Confirma grabación/selección, vista previa, reproducción, subida, sesión y scroll. Las pruebas automatizadas de navegador no sustituyen estos dispositivos físicos.

## 4. Añadir interpretación LSC a la interfaz

En Admin → **Interpretación LSC de tarjetas, enlaces y botones** puedes subir un MP4 o introducir una URL HTTPS de un archivo de video reproducible (no un enlace a una página de YouTube). Indica la clave del elemento, el texto que interpreta y si está activo. Una clave ya existente actualiza su video. Puedes retirarla desmarcando Activa.

| Clave | Elemento |
| --- | --- |
| `nav.inicio`, `nav.catalogo`, `nav.sube-tu-sena` | Enlaces a esos destinos, incluidos accesos de la landing |
| `nav.comunidad`, `nav.leaderboard`, `nav.equipo`, `nav.admin` | Resto de destinos |
| `page.bienvenida` | Texto principal de bienvenida |
| `page.catalogo`, `page.comunidad`, `page.sube-tu-sena`, `page.leaderboard`, `page.equipo` | Introducciones de las páginas |
| `team.presentacion` | Presentación general del equipo |
| `object.microbit` (sustituir por el ID real) | Título y descripción de esa tarjeta del catálogo |
| `community.aprender`, `community.enviar` | Acciones de aprender y aportar |
| `community.cuenta`, `community.login`, `community.registro` | Presentación de la cuenta, botón Entrar y botón Crear cuenta, respectivamente |
| `element.ID_DEL_BOTON` | Botón de página con ese id HTML, fuera del HUD de RA |

Para bloques nuevos se puede asignar `data-lsc-key="team.nombre"` en HTML y registrar esa misma clave en Admin. Las claves usan minúsculas, números, punto, guion o guion bajo. No asignes un video genérico si no interpreta el texto real del elemento. Los videos del intérprete explicativo de cada objeto siguen siendo independientes.

Con un video activo, el reproductor aparece al pasar el mouse o enfocar con teclado. Se puede mantener el mouse sobre el reproductor, pausarlo, cerrarlo con × o Escape y reanudarlo al volver al elemento. En móvil hay un botón **LSC** separado: no activa el enlace original. Solo se reproduce un aporte/intérprete de interfaz a la vez; los videos de fondo no se interrumpen. No se recorta ni deforma al intérprete.

En Accesibilidad se puede desactivar la apertura automática; los botones manuales siguen funcionando. Allí también aparecen los destinos de navegación con traducción disponible, para no apretar el logo y las herramientas del encabezado con botones extra. Restablecer configuración reactiva la apertura automática. Sin video asignado no aparecen controles engañosos ni reproducciones vacías.

## 5. Operación y límites

- No se incluyeron señas ficticias ni videos de terceros. Al principio la comunidad y el leaderboard estarán vacíos. Los videos de pruebas automatizadas no se publican como LSC.
- Las cuentas de participantes no pueden modificar objetos, aprobar aportes ni editar interpretaciones. El correo no aparece en publicaciones ni en el ranking. Los alias iguales no mezclan puntajes: la identidad es la cuenta.
- Se permiten hasta 5 aportes pendientes/borradores recientes por cuenta y 10 reservas de subida al día. Una reserva fallida también cuenta como intento. Esto es un límite funcional de aportes, no una solución DDoS general.
- Los enlaces firmados duran una hora. Si una publicación se retira, no se generan nuevos enlaces públicos; uno emitido anteriormente puede seguir siendo válido hasta caducar. No es protección anticopia. Actualizar la lista renueva los enlaces caducados.
- Rechazar o retirar no elimina automáticamente el archivo. Revisa periódicamente Storage y el consumo de tu plan. Para una solicitud de eliminación completa, retira primero la publicación y elimina **ese archivo exacto** desde Storage; no borres registros directamente de `storage.objects` mediante SQL. Conserva o elimina los metadatos según la política de retención que defina el equipo.
- Los borradores abandonados y videos rechazados requieren limpieza supervisada. Nunca vacíes el bucket completo para hacer esta limpieza.
- La entrega/confirmación de correos depende de Supabase Auth y de la configuración de envío del proyecto. Revisa sus límites antes del evento. No se ha implementado todavía una pantalla de recuperación de contraseña: mientras tanto el equipo puede gestionar la recuperación desde Supabase Auth.

## Comprobaciones hechas en desarrollo

`node scripts/check-community-api.cjs`: API aislada con servicios simulados: permisos, identidad, cuotas, comprobación de archivos, idempotencia, revisión, ranking, cookies y errores persistentes.

`node scripts/check-community-ui.cjs`: navegador con API y Storage simulados: hover, teclado, móvil, formularios, vista previa, fallo/reintento de confirmación, moderación, publicación y descubrimiento aleatorio.

`node scripts/check-navigation.cjs` y `node scripts/check-welcome.cjs`: regresión de navegación, accesibilidad, tema y landing.

No se ha ejecutado la migración contra tu Supabase ni se ha verificado una subida real en Vercel desde este entorno. Completa los pasos 1–3 para validar la integración real antes de llevarla a producción.

Referencias de implementación: [Supabase: verificar usuarios](https://supabase.com/docs/reference/javascript/auth-getuser), [subidas firmadas](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl), [buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals) y [relaciones en funciones PostgREST](https://docs.postgrest.org/en/v13/references/api/resource_embedding.html).
