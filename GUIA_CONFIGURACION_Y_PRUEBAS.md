# Guía simple: conectar, publicar y comprobar enseñas

Esta guía no exige saber programar. No compartas contraseñas, claves ni capturas donde se lean: puedes completar estos pasos tú y decirme qué mensaje aparece si algo falla.

## 1. Qué hace cada servicio

- **Supabase** guarda los objetos, los archivos 3D, los audios y los videos.
- **Vercel** publica la página para que se abra desde Internet.
- **El panel Admin** es la pantalla desde la cual agregarás o editarás objetos.

## 2. Preparar Supabase (solo la primera vez)

1. Entra a tu proyecto en Supabase.
2. Abre **SQL Editor** y crea una consulta nueva.
3. Abre el archivo `schema.sql` de este proyecto, copia todo su contenido, pégalo y pulsa **Run**.
4. Sigue en SQL Editor y ejecuta este bloque. Cambia únicamente los tres textos entre comillas por tus propios datos antes de pulsar **Run**:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO administradores (email, password_hash, nombre, rol, activo)
VALUES (
  'tu-correo@ejemplo.com',
  crypt('elige-una-contraseña-larga-y-unica', gen_salt('bf', 12)),
  'Tu nombre',
  'superadmin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  nombre = EXCLUDED.nombre,
  rol = EXCLUDED.rol,
  activo = true;
```

La contraseña no queda guardada como texto legible: `crypt(...)` la convierte en un **hash**, una huella irreversible que el sistema puede comprobar al iniciar sesión.

## 3. Añadir las claves en Vercel

En Vercel abre el proyecto, entra a **Settings > Environment Variables** y agrega estos valores para **Production**, **Preview** y **Development**:

| Nombre | De dónde sale | Importante |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase: Connect / API Keys | Es la dirección que empieza por `https://`. |
| `SUPABASE_SECRET_KEY` | Supabase: Settings > API Keys | Es la clave secreta. No la pongas en HTML ni la compartas. |
| `JWT_SECRET` | La creas tú | Frase aleatoria de 32 o más caracteres. No reutilices una contraseña. |
| `STORAGE_BUCKET_NAME` | Escribe `ensenas-media` | Debe coincidir con el bucket creado por `schema.sql`. |
| `PUBLIC_APP_URL` | La URL final de Vercel | Ejemplo: `https://tu-proyecto.vercel.app`. |

Al guardar las variables, haz un redeploy en Vercel. La plantilla segura está en `.env.example`; no crees ni subas al repositorio un archivo `.env.local` con claves reales.

## 4. Prueba de funcionamiento, en este orden

1. Entra a `https://tu-dominio/admin.html` e inicia sesión con el correo y la contraseña que acabas de crear.
2. Crea un objeto de prueba, adjunta un `.glb` pequeño, guarda y espera el mensaje de éxito de subida.
3. Actualiza la página por completo. El objeto y la URL del archivo deben seguir en la lista: eso confirma que se guardó en Supabase y no solo en el navegador.
4. Abre el objeto desde el botón **Ver RA**. Debe mostrar exactamente el modelo que subiste.
5. Genera y escanea su QR desde otro teléfono. Debe abrir `objeto.html?id=...` en tu propio dominio.
6. En Android Chrome, pulsa **Ver en mi entorno (RA)**, mueve el teléfono hacia una mesa o piso y espera la retícula. Al anclar, rota con un dedo y escala/mueve con dos dedos. No debe girar solo.
7. Comprueba que el audio y el video de LSC aparecen dentro del visor, y que no aparecen reproductores duplicados debajo.

Si un paso falla, anota el número de paso y copia solo el mensaje de error (sin claves). Con eso puedo corregirlo contigo.

## 5. Qué pruebas puedo ejecutar yo

En esta carpeta ya comprobé que los archivos JavaScript no tienen errores de sintaxis. Para pruebas completas necesitamos dos cosas que dependen de tu cuenta: un proyecto Supabase configurado y una URL de prueba de Vercel. Una vez estén, puedo ayudarte a hacer una lista de pruebas, revisar los errores que veas y automatizar las pruebas repetitivas.
