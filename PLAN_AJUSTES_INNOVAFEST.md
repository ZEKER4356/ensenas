# Entregas de ajustes para Innovafest

Base: rama `codex/ajustes-innovafest`, creada desde `main`. El experimento de
8th Wall queda apartado. La prioridad de todas las entregas es móvil.

## Acuerdos funcionales

- Conservar identidad visual, catálogo, ficha, QR y visor estable.
- Aprender seña en cada tarjeta enseña una seña aleatoria de la comunidad,
  independiente del objeto 3D. Mostrar significado y autor. Evitar repeticiones
  cuando haya suficientes aportes y conservar la selección durante la visita.
- La traducción LSC del contenido educativo es distinta de la seña comunitaria.
- Solo un intérprete se reproduce a la vez. En computador: hover y teclado.
  En móvil: botón explícito; no interceptar el enlace a la ficha.
- Aportes pendientes no se publican. Leaderboard cuenta solo aportes aprobados.
- Videos de referencia no se presentan como traducciones exactas de otros textos.

## 1. Estructura y navegación móvil — en desarrollo

Menú global en inicio, objeto, administración, error y nuevas páginas:
Sube tu seña, Comunidad, Leaderboard y Colaboradores. Inicio independiente con
bienvenida visual y accesos a las cinco secciones; catálogo en catalogo.html.
Logo enlaza al inicio. Administración como botón independiente a la derecha;
navegación centrada. Estados vacíos
reales, sin cifras ni aportes ficticios. Accesibilidad en panel no modal, con
cambios visibles en tiempo real. En móvil, panel inferior que deja parte de la
página disponible; en computador, barra lateral.

Aceptar cuando: todos los enlaces funcionan; menú y diálogos accesibles por
teclado; sin desbordamiento horizontal a 320/360/390/430 px; modo claro/oscuro;
el panel admin conserva inicio/cierre de sesión y el visor conserva controles.

## 2. Inclusión LSC, bienvenida y accesibilidad completa

Video de fondo en toda la landing, incluida navegación y tarjetas. Texto y
título de accesos flotan sobre degradados, sin caja de bienvenida. EnSeñas
resaltado con color y escritura a un carácter cada 75 ms.
Título y mensaje se escriben; texto íntegro disponible para ayudas de lectura,
pausa/repetición y respeto a movimiento reducido. El intérprete mantiene una
zona despejada a la derecha. Se admite un video vertical específico para móvil
en mobileVideoUrl. Comprobar el encuadre cuando lleguen las grabaciones.
Mientras no haya video, mostrar guía de grabación y animación de texto como
demostración visual. Video permanente configurable en welcome-config.js;
sincronía proporcional inicial y marcas temporales ajustables para traducción
exacta cuando llegue la grabación.
Asignar videos a menús, títulos, descripciones y presentaciones del equipo.
Usar un controlador compartido que pause el video anterior y permita reiniciar.
No descargar todos los videos al abrir el catálogo. No recortar manos ni rostro.

Completar preferencias persistentes: tamaño, contraste, saturación, movimiento,
fuente alternativa de lectura, interlineado/interletrado, títulos/enlaces,
negrita, guía de lectura, cursor y ayudas de color. Lectura en voz alta distinta
de VoiceOver/TalkBack. Restablecer sin borrar sesión ni contenido del usuario.

## 3. Cuentas, almacenamiento y aportes

Preparar base de pruebas separada y cambios de esquema aditivos. Perfiles de
comunidad con identidad estable; modelo de espacios docentes separado del admin
global. No otorgar permisos globales al docente ni al contribuidor.

Guardar significado, autor, estado y ruta en BD; videos pendientes en Storage
privado. Subir desde cámara o archivo con previsualización, permiso de
publicación, validación y reintento. Confirmar envío solo tras persistencia.
Administración: revisar, aprobar, rechazar y retirar; comprobar permisos en API.

Aceptar cuando: un usuario no modifica otro aporte; un pendiente no aparece en
lecturas públicas; cortes de red no causan falsos éxitos ni puntos duplicados.

## 4. Comunidad, aprendizaje aleatorio y Leaderboard

Galería con búsqueda por significado, autoría y video aprobado. Cada tarjeta
abre una lección aleatoria del banco y permite descubrir otra. Estado vacío
cuando no hay señas. Puntaje derivado de aprobados, no editable por el visitante.
Completar Colaboradores solo con nombres, roles y fotos proporcionados.

## 5. Servidor rural en computador y QR de aula

Programa local con inicio sencillo, base SQLite y archivos en disco. Docente
crea sus credenciales locales al configurar su instalación; la contraseña no
se guarda en texto. Respaldo/restauración y recuperación definidos desde inicio.
Sin conexión obligatoria a Supabase, librerías CDN ni fuentes externas.

El computador sirve contenidos a estudiantes en la misma red Wi-Fi, incluso
sin salida a internet. Mostrar dirección local alcanzable, no localhost, en el
panel. Generar QR con la dirección activa y un identificador estable del objeto.
Si cambia la dirección de red se regeneran QR; comunicar que los impresos
anteriores pueden requerir actualización. Elegir interfaz de red cuando haya
varias y documentar permisos de red del sistema.

La administración local no se expone a estudiantes sin autenticar. Cuenta local
no contiene ni necesita credenciales del administrador público. Envíos a la
plataforma pública solo por acción explícita y con revisión; sin sincronización
automática que sobrescriba contenidos.

Resolver y probar HTTPS confiable en los teléfonos antes de prometer cámara/RA
en la red del aula. HTTP en una IP privada no equivale al localhost confiable
del propio dispositivo. Catálogo/medios y cámara se validan por separado.

## 6. Validación y publicación por entregas

Vista previa Vercel por entrega. Pruebas en Android/iPhone y teclado; retrato y
horizontal; zoom/texto ampliado; audio/LSC; rechazo de permisos; regreso de RA;
formulario y login admin; QR y ficha docente. Offline: apagar internet, reiniciar
computador, entrar como docente y acceder desde otro dispositivo a recursos
locales; guardar, respaldar y restaurar contenido.

Registrar por entrega qué se implementó y qué falta. Publicar en producción
solo bloques comprobados. Sin modificar datos reales para probar aportes.
