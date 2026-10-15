# Activar Comunidad y accesibilidad LSC

Implementado en `codex/ajustes-innovafest`. La landing conserva su diseño. No ejecutar de nuevo `schema.sql`: esta actualización tiene su propia migración aditiva.

## 1. Preparar Supabase

1. Selecciona el proyecto que usa el despliegue **Preview**. Es preferible un proyecto de pruebas separado; si comparte la base de producción, estas tablas son nuevas y no modifican los objetos ni los administradores existentes.
2. Conserva una copia de seguridad disponible de la base. Abre SQL Editor y ejecuta **todo** `migrations/20261013_comunidad_lsc.sql` en una sola consulta. Debe terminar sin errores. Crea perfiles, aportes, interpretaciones, funciones y el bucket privado `ensenas-comunidad`.
3. Los participantes usan **Supabase Auth**, no la tabla `administradores`. Para el lanzamiento se recomienda Google, sin depender de correos de confirmación de EnSeñas. Mantén el registro de usuarios permitido. No desactives Confirm email como atajo ni compartas una cuenta Admin.
4. En la configuración de URL de Auth, establece el sitio de prueba y autoriza sus direcciones `/sube-tu-sena`, `/sube-tu-sena.html` y `/api/comunidad?action=google-callback` como redirecciones. La URL debe coincidir con `PUBLIC_APP_URL`. Usa una URL de rama estable para no cambiarla en cada despliegue.
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
| `COMMUNITY_GOOGLE_AUTH_ENABLED` | `true` (predeterminado); `false` desactiva Google en UI y API |
| `COMMUNITY_EMAIL_SIGNUP_ENABLED` | `false` (predeterminado); solo cambiar a `true` después de configurar SMTP y comprobar su entrega |

Guarda los cambios y haz Redeploy del despliegue de la rama. No se necesita otra clave JWT para participantes. Sus sesiones usan cookies HttpOnly independientes y la identidad se verifica en Supabase Auth. El frontend no recibe claves secretas.

### Activar Google (no exige dominio propio ni Gmail SMTP)

1. Abre Google Cloud con la cuenta responsable de la plataforma y crea/selecciona un proyecto. En Google Auth Platform configura la audiencia **External**, el nombre EnSeñas y los correos de soporte/contacto. No actives servicios de pago para este acceso.
2. Solicita únicamente `openid`, `userinfo.email` y `userinfo.profile`. No solicites Gmail, Drive ni permisos sensibles. Sin dominio personalizado la pantalla de Google puede mostrar el identificador de Supabase; no prometas una marca verificada instantáneamente.
3. Crea un cliente OAuth de tipo **Web application**. Origen autorizado: el origen HTTPS de EnSeñas. URI de redirección de Google: copia **exactamente** el callback mostrado en Supabase → Authentication → Sign In / Providers → Google (`https://ID_PROYECTO.supabase.co/auth/v1/callback`). No confundas este callback de Google con el callback de nuestra API.
4. Pega Client ID y Client Secret exclusivamente en ese proveedor de Supabase y habilítalo. No publiques el secreto en el repositorio, HTML o capturas.
5. Añade en Supabase → URL Configuration la redirección exacta `https://ORIGEN_ENSEÑAS/api/comunidad?action=google-callback`. El navegador debe iniciar en la misma dirección estable configurada en `PUBLIC_APP_URL`; no uses la URL única del despliegue para esta prueba.
6. Revisa **Audience → External** y el estado de publicación antes del lanzamiento. Google contempla una excepción a las restricciones de Testing cuando solo se solicitan `openid`, correo y perfil: no hace falta añadir cada correo a usuarios de prueba. Si hay otros permisos, esa excepción no aplica. Revisa **Publish app / In production** para el uso público y atiende las verificaciones que Google solicite. No compartas las credenciales de tu cuenta personal. [Reglas oficiales de audiencia y permisos básicos](https://support.google.com/cloud/answer/15549945?hl=en).
7. Prueba entrada, cancelación, salida y reentrada desde un móvil. Google crea o accede a la cuenta de Supabase y el alias público elegido se conserva al volver. Google no otorga permisos Admin ni publica automáticamente videos.

La API usa PKCE, un verificador temporal firmado y cookies HttpOnly. El callback intercambia el código en el servidor; no guarda tokens en localStorage ni los expone al JavaScript público. El registro nuevo por correo permanece cerrado sin SMTP; las cuentas confirmadas existentes pueden seguir entrando con contraseña. Para publicar en el dominio de producción, repite los orígenes/redirecciones para ese dominio y actualiza `PUBLIC_APP_URL` de Production antes de la prueba final.

## 3. Prueba completa antes de publicar

1. Abre **Sube tu seña**, elige un alias público, acepta las condiciones y pulsa **Continuar con Google**. Comprueba que regresas con la sesión abierta. Una cuenta nueva con correo/contraseña solo estará disponible si el equipo activa esa alternativa con SMTP funcional.
2. Pulsa **Grabar mi seña aquí**, permite la cámara frontal y luego **Comenzar grabación**. Pulsa **Terminar y revisar**: el archivo se prepara en memoria y aparece en la vista previa sin descargar/subir archivos manualmente. Escribe el significado, acepta la autorización y envía a revisión. Siempre puedes seleccionar un video existente; si el navegador no admite grabación, se ofrece la cámara nativa.
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

En escritorio, con un video activo, el reproductor aparece debajo del enlace o tarjeta al pasar el mouse o enfocar con teclado; ajusta su posición si no cabe en la pantalla. Reproduce el MP4 en bucle silencioso, sin controles de pausa y sin convertirlo a GIF. Puede cerrarse con × o Escape. No se añaden botones LSC junto a los enlaces ni sobre las tarjetas. Como alternativa manual, también está **Accesibilidad → Interpretaciones LSC disponibles**, sin interceptar la navegación. La apertura automática puede desactivarse desde Accesibilidad y respeta movimiento reducido. Solo se reproduce un aporte/intérprete de interfaz a la vez; los videos de fondo no se interrumpen. No se recorta ni deforma al intérprete.

En teléfonos, el inicio conserva el logo, tema, Accesibilidad y Admin; los cinco destinos se muestran como tarjetas de ancho completo. Cada tarjeta con LSC editorial incorpora su interpretación: se carga al activarse por visibilidad y solo una se reproduce a la vez, después de una pausa breve del desplazamiento. La selección combina visibilidad y cercanía al centro, evitando cambios por movimientos pequeños. No intercepta el enlace ni requiere abrir Accesibilidad. Movimiento reducido o desactivar la apertura automática detiene esos bucles; el acceso manual sigue disponible como alternativa. El menú sigue disponible en páginas interiores. Accesibilidad ocupa la pantalla móvil completa: solo su contenido central se desplaza y los controles de cerrar/restablecer permanecen accesibles. En escritorio sigue siendo un panel lateral.

### Video grande de bienvenida

La landing usa `assets/js/welcome-config.js` → `videoUrl`, no la clave contextual `page.bienvenida`. El MP4 editorial se sirve desde `ensenas-media/landing/bienvenida-landing.mp4`, con URL pública permanente, sin cambiar variables de Vercel. `mobileVideoUrl` es opcional; el mismo archivo cuadrado funciona sin recortes en ambas pantallas.

El intérprete aparece junto al texto en PC. En teléfonos hay dos capas del mismo video: la interpretación nítida conserva el cuadrado completo y el texto se superpone a un fondo de fotogramas con degradado blanco (oscuro según el tema), sin poner letras sobre rostro ni manos. El fondo decorativo usa un canvas pequeño a un máximo de 6 fps del mismo video: no duplica descargas ni decodificadores, y se detiene con la reproducción. Los accesos conservan texto al lado del video, con tarjetas más altas (mínimo 190 px), tipografía mayor y clips adaptables de 118–180 px, sin recortes y menores que la bienvenida. Se reproduce silencioso y repite después de mantener el último fotograma durante 5 segundos (`replayDelaySeconds`). El texto usa `requestAnimationFrame`, sin depender de `timeupdate`: en PC dura el 45 % del video, limitado a 6–10 segundos (unos 8,2 s); en móviles, el 70 %, limitado a 10–14 segundos (unos 12,8 s para el video de 18,2 s). Cambiar de orientación conserva el progreso. Se escribe una vez y permanece completo durante los siguientes ciclos del video; solo Repetir reinicia ambos. Pausar también congela la espera restante del bucle.

Respeta movimiento reducido, pausa al salir de vista o abrir Accesibilidad y conserva el contenido escrito si el video falla o el navegador bloquea autoplay. Cambiar el archivo/configuración se valida primero en Preview; no publica automáticamente esta rama en `main`.

`node scripts/check-welcome-video.cjs` comprueba el MP4 real, seis anchos, temas, pausa/reinicio/bucle y preferencias. Usa la copia optimizada local (no se añade al repositorio); puede indicarse otra ruta mediante `ENSENAS_WELCOME_FIXTURE`. La disponibilidad de la URL pública se comprueba aparte.

### Explicación de los objetos y RA

El intérprete de los objetos conserva su velocidad original y controla el final de la explicación. Audio/TTS y LSC arrancan juntos desde Reproducir; si la narración acaba antes, la seña sigue hasta terminar. Si la narración es más larga, se detiene al finalizar el intérprete. No se estiran los medios para igualar duraciones: el equipo debe comprobar que ambos contenidos correspondan. Pausa y reanudación controlan ambas pistas; reiniciar vuelve al comienzo. Sin LSC válida se mantiene la explicación de audio/TTS.

El intérprete permanece dentro del visualizador, tanto en 3D como en RA, sin recortar manos o rostro. Su tamaño compacto es de 230 px en escritorio y aproximadamente 150–200 px en teléfonos; se limita además por el espacio disponible en RA horizontal. No se mueve debajo del visor y deja libres los controles de reproducción. Colocar/anclar el objeto inicia automáticamente la explicación desde cero; volver a escanear la pausa. El inicio sucede dentro del clic de colocación y no al entrar en la página. Los navegadores pueden bloquear reproducción o cámara; hay que verificarlo también en Android/iPhone físicos, especialmente WebXR.

En Accesibilidad se puede desactivar la apertura automática; los botones manuales siguen funcionando. Allí también aparecen los destinos de navegación con traducción disponible, para no apretar el logo y las herramientas del encabezado con botones extra. Restablecer configuración reactiva la apertura automática. Sin video asignado no aparecen controles engañosos ni reproducciones vacías.

## 5. Operación y límites

- No se incluyeron señas ficticias ni videos de terceros. Al principio la comunidad y el leaderboard estarán vacíos. Los videos de pruebas automatizadas no se publican como LSC.
- Las cuentas de participantes no pueden modificar objetos, aprobar aportes ni editar interpretaciones. El correo no aparece en publicaciones ni en el ranking. Los alias iguales no mezclan puntajes: la identidad es la cuenta.
- Se permiten hasta 5 aportes pendientes/borradores recientes por cuenta y 10 reservas de subida al día. Una reserva fallida también cuenta como intento. Esto es un límite funcional de aportes, no una solución DDoS general.
- Los enlaces firmados duran una hora. Si una publicación se retira, no se generan nuevos enlaces públicos; uno emitido anteriormente puede seguir siendo válido hasta caducar. No es protección anticopia. Actualizar la lista renueva los enlaces caducados.
- Rechazar o retirar no elimina automáticamente el archivo. Revisa periódicamente Storage y el consumo de tu plan. Para una solicitud de eliminación completa, retira primero la publicación y elimina **ese archivo exacto** desde Storage; no borres registros directamente de `storage.objects` mediante SQL. Conserva o elimina los metadatos según la política de retención que defina el equipo.
- Los borradores abandonados y videos rechazados requieren limpieza supervisada. Nunca vacíes el bucket completo para hacer esta limpieza.
- La grabación necesita HTTPS y permiso de cámara; no se pide micrófono. Se intenta MP4 compatible primero y luego WebM según `MediaRecorder.isTypeSupported`. Objetivo: 640×480, 30 fps y 1,5 Mbps (aproximadamente 11 MB por minuto, no garantizado). Se detiene a 60 segundos o al acercarse al límite de tamaño. La vista de cámara está en espejo para encuadrar, pero el video final no se invierte ni recorta las señas. La cámara se libera al terminar/cancelar/salir. No hay conversión universal a MP4 ni transcodificación en el servidor; prueba especialmente reproducción cruzada de WebM entre Android e iPhone antes del evento.
- No se envían videos automáticamente: la persona siempre revisa y confirma. No cierres la pestaña antes de enviarlos; la grabación vive en memoria hasta que se guarda en Storage. Cerrar sesión elimina la vista previa local.
- Google evita nuestros correos de confirmación, pero requiere una cuenta Google y no elimina los límites gratuitos de usuarios, almacenamiento o tráfico. Si se activa correo/contraseña, la entrega depende de SMTP y sus límites. La recuperación con contraseña no tiene pantalla propia todavía; Google gestiona la recuperación de sus cuentas y el equipo puede gestionar las cuentas de contraseña desde Supabase Auth.

## Comprobaciones hechas en desarrollo

### Puerta de salida a producción

No hace falta repetir la migración ni desarrollar otro sistema de correo para Google. Orden de cierre:

1. Activar Google en Preview y verificar entrada/cancelación/salida con una cuenta real.
2. Desde un móvil, grabar una seña propia y enviarla. Comprobar pendiente → aprobación Admin → Comunidad → leaderboard → aprender desde catálogo. Verificar también con una persona distinta a la administradora.
3. Comprobar en Android y Safari de iPhone el formato generado y la reproducción cruzada; sin videos reales de bienvenida/interfaz esas áreas conservan su guía/estado vacío, no una interpretación ficticia.
4. Preparar Google para audiencia pública y las redirecciones del dominio de producción. Establecer `PUBLIC_APP_URL` de Production al dominio público real, sin sobreescribir el valor específico de la rama Preview. Mantener `COMMUNITY_EMAIL_SIGNUP_ENABLED=false` si no hay SMTP.
5. Promover/integrar únicamente la revisión probada a `main`; verificar página pública, catálogo/QR, Admin, sesión Google, cámara y subida nuevamente en el dominio final. Conservar el despliegue anterior listo para revertir. Una reversión de frontend no revierte los datos añadidos; no borrar las tablas/bucket nuevos.

La configuración de Google y esta prueba real son requisitos externos al código. No declarar listo para público solamente porque el despliegue diga Ready.

`node scripts/check-community-api.cjs`: API aislada con servicios simulados: permisos, identidad, cuotas, comprobación de archivos, idempotencia, revisión, ranking, cookies y errores persistentes.

`node scripts/check-community-ui.cjs`: navegador con API y Storage simulados: hover, teclado, móvil, formularios, vista previa, fallo/reintento de confirmación, moderación, publicación y descubrimiento aleatorio.

`node scripts/check-community-oauth.cjs`: usa la librería oficial de Supabase instalada (o `ENSENAS_AUTH_PACKAGES` para un entorno temporal), con HTTP simulado. Verifica PKCE, callback, cuenta confirmada, alias, cookies, cancelación, manipulación/caducidad y registro por correo cerrado.

`node scripts/check-community-recording.cjs`: cámara simulada mediante canvas con MediaRecorder real en Chrome. Prueba MP4 y alternativa WebM, archivo automático, permisos rechazados, grabar/cancelar/repetir, envío a revisión, liberación de cámara y tamaños móviles. No sustituye la prueba con cámaras Android/iPhone físicas.

`node scripts/check-navigation.cjs` y `node scripts/check-welcome.cjs`: regresión de navegación, accesibilidad, tema y landing.

El usuario ejecutó la migración y comprobó en Preview el acceso con Google, la grabación/envío desde teléfono, rechazo con nota, aprobación, comunidad pública y clasificación. No hay que recrear esas cuentas si Production utiliza el mismo Supabase. Antes de publicar falta verificar la configuración del host final y repetir entrada/envío con otra cuenta desde ese host.

Dominio de producción indicado por el usuario: `https://ensenas.vercel.app`. Comprobar `PUBLIC_APP_URL` con ese origen en Vercel **Production** (sin tocar el valor específico de Preview), Site URL de Supabase y la redirección exacta `https://ensenas.vercel.app/api/comunidad?action=google-callback`. Añadir el origen de producción al cliente web de Google; el callback de Google sigue siendo el mismo de Supabase, no hay que crear otro cliente ni volver a compartir secretos. Mantener también autorizadas las URLs de Preview. En la comprobación previa al despliegue, el endpoint público `/api/comunidad?action=config` de producción devolvió 404: todavía no permite certificar ese flujo final.

Referencias de implementación: [Supabase: verificar usuarios](https://supabase.com/docs/reference/javascript/auth-getuser), [subidas firmadas](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl), [buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals) y [relaciones en funciones PostgREST](https://docs.postgrest.org/en/v13/references/api/resource_embedding.html).
