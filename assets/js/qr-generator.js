/**
 * assets/js/qr-generator.js - Módulo Oficial de Generación de Códigos QR Personalizados
 * Plataforma enseñas (RA + LSC)
 * 
 * Implementa renderizado de alta fidelidad con la librería qr-code-styling y Canvas HTML5,
 * integrando la paleta institucional (#7C3AED, #2563EB) y el imagotipo oficial (ensenas logo.png)
 * con nivel de corrección de error 'H' (30%) para garantizar escaneos inmediatos y confiables.
 */

(function (global) {
  'use strict';

  // Configuración de Identidad Visual Institucional
  const BRAND_CONFIG = {
    primaryColor: '#7C3AED',       // Púrpura oficial enseñas
    secondaryColor: '#2563EB',     // Azul tecnológico
    darkIndigo: '#1E1B4B',         // Azul noche de alto contraste para esquinas
    backgroundColor: '#FFFFFF',
    logoPath: 'ensenas logo.png',
    errorCorrectionLevel: 'H',     // 30% de redundancia para soportar logo central
    defaultSize: 400
  };

  /**
   * Construye la URL canónica de destino directo a RA
   * @param {string} objectId - Identificador slug del objeto
   * @param {string} [customBaseUrl] - Dominio base opcional
   * @returns {string} URL absoluta https://midominio.com/objeto.html?id=[id]
   */
  function buildTargetUrl(objectId, customBaseUrl) {
    let base = customBaseUrl;
    if (!base && typeof window !== 'undefined') {
      base = window.location.origin;
    }
    base = (base || '').replace(/\/$/, '');
    return `${base}/objeto.html?id=${encodeURIComponent(objectId)}`;
  }

  /**
   * Instancia un objeto QRCodeStyling configurado con la marca institucional
   * @param {string} targetUrl - URL de destino a codificar
   * @param {object} [options] - Opciones de personalización
   * @returns {QRCodeStyling|null}
   */
  function createStylingInstance(targetUrl, options) {
    const opts = options || {};
    const size = opts.size || BRAND_CONFIG.defaultSize;

    if (typeof QRCodeStyling !== 'undefined') {
      return new QRCodeStyling({
        width: size,
        height: size,
        type: 'canvas',
        data: targetUrl,
        image: opts.logoUrl || BRAND_CONFIG.logoPath,
        margin: opts.margin !== undefined ? opts.margin : 12,
        qrOptions: {
          typeNumber: 0,
          mode: 'Byte',
          errorCorrectionLevel: BRAND_CONFIG.errorCorrectionLevel
        },
        imageOptions: {
          hideBackgroundDots: true,
          imageSize: 0.32,
          margin: 6,
          crossOrigin: 'anonymous'
        },
        dotsOptions: {
          color: BRAND_CONFIG.primaryColor,
          type: 'rounded',
          gradient: {
            type: 'linear',
            rotation: 45,
            colorStops: [
              { offset: 0, color: BRAND_CONFIG.primaryColor },
              { offset: 1, color: BRAND_CONFIG.secondaryColor }
            ]
          }
        },
        backgroundOptions: {
          color: BRAND_CONFIG.backgroundColor
        },
        cornersSquareOptions: {
          color: BRAND_CONFIG.darkIndigo,
          type: 'extra-rounded'
        },
        cornersDotOptions: {
          color: BRAND_CONFIG.primaryColor,
          type: 'dot'
        }
      });
    }

    return null;
  }

  /**
   * Fallback sobre HTML5 Canvas puro en caso de no cargar la librería externa
   * @param {HTMLCanvasElement} canvas 
   * @param {string} targetUrl 
   * @param {string} title 
   */
  function renderCanvasFallback(canvas, targetUrl, title) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Fondo
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Borde institucional
    ctx.strokeStyle = BRAND_CONFIG.primaryColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, width - 12, height - 12);

    // Cargar imagen QR externa como fallback o dibujar matriz ilustrativa
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=${width - 40}x${height - 40}&margin=10&color=7C3AED&data=${encodeURIComponent(targetUrl)}`;

    qrImg.onload = function () {
      ctx.drawImage(qrImg, 20, 20, width - 40, height - 40);

      // Superponer placa blanca central con imagotipo
      const logoSize = width * 0.26;
      const logoX = (width - logoSize) / 2;
      const logoY = (height - logoSize) / 2;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, logoSize / 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = BRAND_CONFIG.secondaryColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      const logoImg = new Image();
      logoImg.src = BRAND_CONFIG.logoPath;
      logoImg.onload = function () {
        ctx.drawImage(logoImg, logoX + 5, logoY + (logoSize * 0.25), logoSize - 10, logoSize * 0.5);
      };
    };
  }

  /**
   * Renderiza el código QR dentro de un elemento contenedor del DOM
   * @param {HTMLElement} containerElement 
   * @param {string} objectId 
   * @param {object} [options]
   * @returns {Promise<QRCodeStyling|HTMLCanvasElement>}
   */
  async function render(containerElement, objectId, options) {
    if (!containerElement) throw new Error('Contenedor DOM no proporcionado para el QR.');

    containerElement.innerHTML = '';
    const opts = options || {};
    const targetUrl = buildTargetUrl(objectId, opts.baseUrl);
    const stylingInstance = createStylingInstance(targetUrl, opts);

    if (stylingInstance) {
      stylingInstance.append(containerElement);
      return stylingInstance;
    }

    // Fallback con canvas
    const canvas = document.createElement('canvas');
    canvas.width = opts.size || BRAND_CONFIG.defaultSize;
    canvas.height = opts.size || BRAND_CONFIG.defaultSize;
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
    containerElement.appendChild(canvas);
    renderCanvasFallback(canvas, targetUrl, opts.title || objectId);
    return canvas;
  }

  /**
   * Descarga el código QR en formato PNG en alta resolución (1024x1024 px)
   * @param {string} objectId 
   * @param {object} [options]
   */
  async function downloadPNG(objectId, options) {
    const opts = options || {};
    const size = opts.size || 1024; // Alta resolución por defecto para impresión
    const targetUrl = buildTargetUrl(objectId, opts.baseUrl);
    const filename = opts.filename || `QR-ensenas-${objectId}-1024px.png`;

    const instance = createStylingInstance(targetUrl, { ...opts, size: size });
    if (instance) {
      await instance.download({ name: filename.replace(/\.png$/i, ''), extension: 'png' });
      return;
    }

    // Fallback de descarga vía canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    renderCanvasFallback(tempCanvas, targetUrl, objectId);

    setTimeout(() => {
      const link = document.createElement('a');
      link.download = filename;
      link.href = tempCanvas.toDataURL('image/png');
      link.click();
    }, 600);
  }

  /**
   * Descarga el código QR en formato vectorial SVG
   * @param {string} objectId 
   * @param {object} [options]
   */
  async function downloadSVG(objectId, options) {
    const opts = options || {};
    const targetUrl = buildTargetUrl(objectId, opts.baseUrl);
    const filename = opts.filename || `QR-ensenas-${objectId}-vector.svg`;

    const instance = createStylingInstance(targetUrl, { ...opts, size: 800 });
    if (instance) {
      await instance.download({ name: filename.replace(/\.svg$/i, ''), extension: 'svg' });
      return;
    }

    alert('La exportación SVG requiere la librería QRCodeStyling.');
  }

  /**
   * Abre la ficha imprimible institucional para recortar y pegar en el objeto físico del aula
   * @param {object} objectData - Datos completos del objeto
   * @param {string} [baseUrl] - URL base
   */
  async function openPrintCard(objectData, baseUrl) {
    if (!objectData) return;
    const objectId = objectData.id;
    const title = objectData.titulo || objectData.nombre || objectId;
    const category = objectData.categoria_lsc || 'Ciencia y Tecnología';
    const targetUrl = buildTargetUrl(objectId, baseUrl);

    // Crear un canvas temporal para obtener el DataURL del QR en alta resolución
    const qrSize = 600;
    const styling = createStylingInstance(targetUrl, { size: qrSize, baseUrl: baseUrl });

    let qrDataUrl = '';
    if (styling) {
      const blob = await styling.getRawData('png');
      if (blob) {
        qrDataUrl = URL.createObjectURL(blob);
      }
    }

    if (!qrDataUrl) {
      qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=15&data=${encodeURIComponent(targetUrl)}`;
    }

    // Ventana emergente con diseño de tarjeta lista para recortar en hoja A4 / Carta
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert('Por favor permite ventanas emergentes (popups) para imprimir la ficha del QR.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Ficha Imprimible QR: ${escapeHtml(title)} - enseñas</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Montserrat:wght@700;900&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', system-ui, sans-serif;
            background: #F1F5F9;
            color: #0F172A;
            padding: 30px;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .print-toolbar {
            margin-bottom: 24px;
            display: flex;
            gap: 12px;
          }
          .btn-print {
            background: #7C3AED;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 1rem;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(124, 58, 237, 0.3);
          }
          .btn-print:hover { background: #6D28D9; }
          .btn-close {
            background: #E2E8F0;
            color: #334155;
            border: none;
            padding: 12px 20px;
            font-size: 1rem;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
          }
          
          /* Tarjeta Imprimible de Aula */
          .classroom-card {
            background: #FFFFFF;
            width: 420px;
            border: 2px dashed #94A3B8;
            border-radius: 16px;
            padding: 28px;
            text-align: center;
            box-shadow: 0 10px 25px rgba(0,0,0,0.08);
            position: relative;
          }
          .cut-hint {
            position: absolute;
            top: -12px;
            left: 20px;
            background: #FFFFFF;
            padding: 2px 10px;
            font-size: 0.72rem;
            color: #64748B;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .card-header-logo {
            max-height: 44px;
            width: auto;
            margin-bottom: 12px;
          }
          .card-badge {
            display: inline-block;
            background: rgba(124, 58, 237, 0.1);
            color: #7C3AED;
            font-size: 0.75rem;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 20px;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
          .card-title {
            font-family: 'Montserrat', sans-serif;
            font-size: 1.4rem;
            font-weight: 900;
            color: #0F172A;
            line-height: 1.25;
            margin-bottom: 6px;
          }
          .card-desc {
            font-size: 0.82rem;
            color: #64748B;
            line-height: 1.4;
            margin-bottom: 18px;
          }
          .qr-frame {
            background: #FAF5FF;
            border: 2px solid #E9D5FF;
            border-radius: 14px;
            padding: 14px;
            display: inline-block;
            margin-bottom: 16px;
          }
          .qr-img {
            width: 250px;
            height: 250px;
            display: block;
            border-radius: 8px;
          }
          .scan-instructions {
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 10px 14px;
            font-size: 0.8rem;
            color: #334155;
            line-height: 1.4;
            margin-bottom: 14px;
          }
          .scan-instructions strong {
            color: #7C3AED;
          }
          .direct-url {
            font-size: 0.7rem;
            color: #94A3B8;
            font-family: monospace;
            word-break: break-all;
          }

          @media print {
            body { background: white; padding: 0; }
            .print-toolbar { display: none; }
            .classroom-card {
              box-shadow: none;
              margin: 40px auto;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar">
          <button class="btn-print" onclick="window.print()">🖨️ Imprimir Ficha para Aula</button>
          <button class="btn-close" onclick="window.close()">Cerrar</button>
        </div>

        <div class="classroom-card">
          <span class="cut-hint">✂ Línea de recorte para pegar en el objeto físico</span>
          <img src="${BRAND_CONFIG.logoPath}" alt="enseñas" class="card-header-logo">
          <div><span class="card-badge">${escapeHtml(category)}</span></div>
          <h1 class="card-title">${escapeHtml(title)}</h1>
          <p class="card-desc">Escanea con la cámara de tu teléfono móvil o tablet</p>

          <div class="qr-frame">
            <img src="${qrDataUrl}" alt="Código QR de ${escapeHtml(title)}" class="qr-img">
          </div>

          <div class="scan-instructions">
            <strong>Experiencia Inclusiva:</strong> Modelo 3D interactivo en Realidad Aumentada + Audio Explicativo + Intérprete en <strong>Lengua de Señas Colombiana (LSC)</strong>.
          </div>

          <p class="direct-url">${escapeHtml(targetUrl)}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  /**
   * Rutina de actualización masiva de Códigos QR para todos los objetos
   * @param {Array} objectsList - Lista de objetos a procesar
   * @param {string} [baseUrl] - URL base
   * @param {Function} [onProgress] - Callback (current, total, item)
   * @returns {Promise<Array>}
   */
  async function batchRegenerateAll(objectsList, baseUrl, onProgress) {
    if (!Array.isArray(objectsList)) return [];

    const updated = [];
    const total = objectsList.length;

    for (let i = 0; i < total; i++) {
      const item = objectsList[i];
      const targetUrl = buildTargetUrl(item.id, baseUrl);

      const qrInstance = createStylingInstance(targetUrl, {
        size: 800,
        baseUrl: baseUrl
      });

      // Asegurar referencia canónica
      item.qr_code_url = `/objeto.html?id=${encodeURIComponent(item.id)}`;
      updated.push(item);

      if (typeof onProgress === 'function') {
        onProgress(i + 1, total, item);
      }
    }

    return updated;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Exportar API global
  global.EnsenasQR = {
    BRAND_CONFIG,
    buildTargetUrl,
    createStylingInstance,
    render,
    downloadPNG,
    downloadSVG,
    openPrintCard,
    batchRegenerateAll
  };

})(typeof window !== 'undefined' ? window : this);
