# Especificación Técnica e Historia de Usuario: Plataforma "enseñas" (RA + LSC)

## 1. Identidad de Marca
* **Nombre de la plataforma:** **enseñas**
* **Juego de Palabras y Branding:** La palabra combina "enseñar" y "señas". En todos los elementos de la interfaz, títulos e identidades visuales, el prefijo **"en"** mantiene un peso tipográfico suave/regular y la palabra **"señas"** se destaca visualmente mediante mayor grosor (bold/black) y un color de acento diferencial.
* **Isotipo / Logo:** Representa un visor de Realidad Aumentada que enmarca un gesto de mano en Lengua de Señas con un destello tecnológico de interacción.

---

## 2. Resumen del Proyecto
Desarrollo de la plataforma web **enseñas**, una experiencia educativa de **Realidad Aumentada (RA)** accesible mediante la lectura de códigos QR. La plataforma permite a los usuarios interactuar con un objeto 3D en su entorno, ver un video explicativo sobre la función del objeto y, de manera paralela, visualizar la explicación en **Lengua de Señas Colombiana (LSC)**. Además, cuenta con un módulo interactivo para aprender a realizar la seña del objeto. Todo el maquetado frontend debe seguir estrictamente estándares de **HTML5 semántico y accesibilidad web (WCAG / ARIA)**.

---

## 3. Stack Tecnológico
* **Backend:** PHP 8.x
* **Base de Datos:** MySQL
* **Engine Realidad Aumentada:** 8th Wall (WebXR / World Tracking)
* **Framework 3D Frontend:** A-Frame o Three.js
* **Frontend UI:** HTML5 Semántico, CSS3 (Tailwind CSS o BEM), JavaScript Vanilla / ES6

---

## 4. Historia de Usuario

### **Título:** Experiencia de Realidad Aumentada con Explicación Funcional y LSC por Objeto en enseñas
**Como** estudiante o usuario de la plataforma **enseñas**,  
**Quiero** escanear un código QR asignado a un objeto físico para proyectarlo en Realidad Aumentada junto con su explicación en video y en Lengua de Señas Colombiana (LSC),  
**Para** comprender la utilidad del objeto y aprender la seña correspondiente en LSC de forma interactiva, clara y accesible.

### **Criterios de Aceptación**

#### **CA1: Lectura, Redirección vía QR y Estructura Semántica Base**
* Cada objeto físico posee un código QR único que apunta a una URL en PHP: `https://ensenas.edu.co/objeto.php?id={ID_OBJETO}`.
* PHP procesa la petición, consulta la base de datos MySQL y renderiza una estructura HTML5 semántica que incluye:
  * `<header>`: Logotipo de **enseñas** (`en<strong class="text-primary">señas</strong>`), título del objeto (`<h1>`) y navegación de accesibilidad.
  * `<main>`: Contenedor principal que aloja la escena WebXR de 8th Wall y la sección multimedia.
  * `<section>` (Multimedia / Videos): Encabezado `<h2>` descriptivo y estructurado.
  * `<aside>` o `<section>` (Instrucciones LSC): Panel complementario para el módulo "Aprender seña".
  * `<footer>`: Créditos institucionales y avisos de accesibilidad.
* Si el ID no existe, PHP sirve una página de error wrapping en un contenedor `<main>` con estado HTTP 404 semántico.

#### **CA2: Experiencia de Realidad Aumentada (8th Wall)**
* La vista carga el motor WebXR de **8th Wall** dentro de un elemento semántico `<section aria-label="Escena de Realidad Aumentada">` sin requerir la instalación de aplicaciones nativas.
* Solicita permisos de cámara y proyecta el modelo 3D sobre una superficie plana mediante World Tracking (SLAM).
* Soporta interacción mediante gestos multitáctiles en pantalla:
  * **Pinch-to-zoom (Pinch):** Agrandar o reducir el tamaño del modelo 3D en tiempo real.
  * **Drag / Touch rotate:** Rotar el objeto en 360° sobre su eje vertical u horizontal.

#### **CA3: Reproductores de Video Paralelos, Semánticos y Sincronizados**
* Utiliza etiquetas semánticas nativas `<video>` dentro de la estructura HTML:
  * **Izquierda:** Video con la explicación del uso y funcionalidad del objeto (`<video controls>`, `<track kind="subtitles">` e inclusión de `<figcaption>`).
  * **Derecha:** Video del intérprete en **LSC** (`<video>`, acompañado de etiqueta `<track kind="captions">` o descripción textual).
* Los reproductores se agrupan dentro de elementos `<figure>` con sus correspondientes `<figcaption>` explicativos para garantizar semántica y lectura por lectores de pantalla.
* Incluye una barra de controles agrupada en una `<nav aria-label="Controles de reproducción">` con elementos `<button>` nativos (Play / Pause / Mute) que sincroniza la reproducción de ambos videos al mismo tiempo.

#### **CA4: Módulo "Aprender Seña en LSC"**
* Un botón accesible `<button id="btn-aprender-lsc">` activa la modalidad de aprendizaje.
* Al ser accionado:
  1. Se pausa o oculta el video explicativo general de forma accesible (`aria-hidden="true"`).
  2. El video en LSC cambia a un bucle (*loop*) enfocado en el gesto de la seña.
  3. Se despliega un panel `<article>` o `<aside>` con una lista ordenada `<ol>` de los pasos a seguir (posición de manos, movimiento y orientación).

---

## 5. Requerimientos de Base de Datos (MySQL)

### Tabla `objetos`
```sql
CREATE TABLE objetos (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    modelo_3d_url VARCHAR(255) NOT NULL,
    video_uso_url VARCHAR(255) NOT NULL,
    video_lsc_url VARCHAR(255) NOT NULL,
    instrucciones_lsc TEXT NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Estructura de Maquetado HTML5 Semántico (Ejemplo de Referencia)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>enseñas | Plataforma Educativa RA + LSC</title>
  <style>
    /* Ejemplo de resaltado del juego de palabras */
    .brand-logo { font-size: 1.8rem; font-weight: 300; color: #1e293b; }
    .brand-logo .highlight { font-weight: 900; color: #7c3aed; }
  </style>
</head>
<body>

  <header>
    <!-- Marca enseñas con resalte semántico -->
    <a href="/" class="brand-logo" aria-label="Inicio enseñas">
      en<span class="highlight">señas</span>
    </a>
    <h1>Objeto Educativo: Micro:bit</h1>
  </header>

  <main>
    <!-- Escena 8th Wall / Canvas 3D -->
    <section id="ar-scene-container" aria-label="Visor de Realidad Aumentada">
      <!-- 8th Wall renderiza el canvas WebXR aquí -->
    </section>

    <!-- Panel de Videos y Explicaciones -->
    <section id="media-container" aria-labelledby="media-heading">
      <h2 id="media-heading" class="sr-only">Explicación del objeto y Lengua de Señas</h2>

      <div class="video-grid">
        <!-- Video 1: Uso del Objeto -->
        <figure>
          <video id="video-uso" src="path/to/video-uso.mp4" preload="metadata"></video>
          <figcaption>Uso y funcionalidad del objeto</figcaption>
        </figure>

        <!-- Video 2: Lengua de Señas Colombiana (LSC) -->
        <figure>
          <video id="video-lsc" src="path/to/video-lsc.mp4" preload="metadata"></video>
          <figcaption>Explicación en Lengua de Señas Colombiana (LSC)</figcaption>
        </figure>
      </div>

      <!-- Controles unificados -->
      <nav aria-label="Controles unificados de video" class="video-controls">
        <button id="btn-play-all" type="button" aria-label="Reproducir ambos videos">Reproducir</button>
        <button id="btn-pause-all" type="button" aria-label="Pausar ambos videos">Pausar</button>
        <button id="btn-mode-lsc" type="button" aria-expanded="false">Aprender seña en LSC</button>
      </nav>
    </section>

    <!-- Módulo de Aprendizaje de Seña -->
    <aside id="lsc-steps-panel" aria-labelledby="lsc-steps-heading" hidden>
      <h3 id="lsc-steps-heading">Pasos para realizar la seña</h3>
      <ol id="lsc-steps-list">
        <!-- Pasos inyectados por PHP / JS -->
      </ol>
    </aside>
  </main>

  <footer>
    <p>&copy; 2026 enseñas - Plataforma Educativa RA + LSC. Todos los derechos reservados.</p>
  </footer>

</body>
</html>
```

---

## 7. Instrucciones Técnicas Finales para Antigravity

1. **Implementar Identidad Visual "enseñas":**
   * Aplicar la tipografía y estilizado para destacar la palabra **"señas"** dentro de **"enseñas"** en la barra superior, encabezados principales y favicon.
   * Utilizar el logo vectorial SVG provisto (`logo_ensenas.svg`).

2. **Garantizar HTML5 Semántico y Accesibilidad (WCAG):**
   * Utilizar etiquetas semánticas (`<header>`, `<main>`, `<section>`, `<article>`, `<figure>`, `<figcaption>`, `<aside>`, `<footer>`).
   * No usar `<div>` para elementos interactivos; emplear elementos nativos (`<button>`, `<a>`, `<video>`).
   * Atributos ARIA aplicados en elementos dinámicos (`aria-expanded`, `aria-hidden`, `aria-label`).

3. **Backend en PHP (`objeto.php`):**
   * Capturar `$_GET['id']`, consultar MySQL e inyectar dinámicamente los modelos 3D, videos e instrucciones en las etiquetas semánticas.

4. **WebXR con 8th Wall y Sincronización JS:**
   * Montar la escena WebXR de 8th Wall y programar la sincronización nativa de los dos elementos `<video>` paralelos.
