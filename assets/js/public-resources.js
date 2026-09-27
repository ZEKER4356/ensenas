/* Ficha didáctica pública y QR para docentes. Reutiliza el generador oficial del panel Admin. */
(function (global) {
  'use strict';

  let currentObject = null;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function objectInfo(object) {
    return {
      id: object.id,
      title: object.titulo || object.nombre || object.id,
      category: object.categoria_lsc || 'Ciencia y Tecnología',
      description: object.descripcion || 'Objeto educativo interactivo para aprender con Realidad Aumentada y Lengua de Señas Colombiana.'
    };
  }

  function actionButtons(object, prefix) {
    const info = objectInfo(object);
    return `
      <div class="ficha-actions">
        <button type="button" class="btn btn-primary btn-sm" data-qr-download="${escapeHtml(prefix)}" aria-label="Descargar código QR de ${escapeHtml(info.title)}">Descargar QR</button>
        <button type="button" class="btn btn-secondary btn-sm" data-qr-print="${escapeHtml(prefix)}" aria-label="Imprimir ficha didáctica de ${escapeHtml(info.title)}">Imprimir ficha</button>
      </div>`;
  }

  function bindActions(root, object) {
    root.querySelector('[data-qr-download]')?.addEventListener('click', async () => {
      if (!global.EnsenasQR) return;
      await global.EnsenasQR.downloadPNG(object.id, {
        filename: `QR-ensenas-${object.id}-1024px.png`
      });
    });
    root.querySelector('[data-qr-print]')?.addEventListener('click', () => {
      if (global.EnsenasQR) global.EnsenasQR.openPrintCard(object);
    });
  }

  async function renderQr(container, object, size) {
    if (!container || !global.EnsenasQR) return;
    try {
      await global.EnsenasQR.render(container, object.id, {
        size: size || 220,
        title: objectInfo(object).title
      });
    } catch (error) {
      console.warn('No fue posible preparar el QR público.', error);
      container.textContent = 'No se pudo generar el QR en este momento.';
    }
  }

  function ensureModal() {
    let modal = document.getElementById('public-ficha-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'public-ficha-modal';
    modal.className = 'public-ficha-modal is-hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'public-ficha-title');
    modal.innerHTML = `
      <div class="public-ficha-backdrop" data-ficha-close></div>
      <section class="public-ficha-dialog">
        <button type="button" class="public-ficha-close" data-ficha-close aria-label="Cerrar ficha didáctica">×</button>
        <span class="ficha-kicker">Material para docentes</span>
        <h2 id="public-ficha-title"></h2>
        <p id="public-ficha-description"></p>
        <div class="public-ficha-content">
          <div class="public-ficha-notes">
            <strong>Incluye</strong>
            <span>Modelo 3D, experiencia RA, audio explicativo y recursos LSC cuando estén disponibles.</span>
            <a id="public-ficha-link" class="btn btn-outline btn-sm">Abrir ficha completa</a>
          </div>
          <div id="public-ficha-qr" class="public-ficha-qr" aria-label="Código QR para el aula"></div>
        </div>
        <div id="public-ficha-actions"></div>
      </section>`;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-ficha-close]').forEach((button) => {
      button.addEventListener('click', closeFicha);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('is-hidden')) closeFicha();
    });
    return modal;
  }

  function closeFicha() {
    const modal = document.getElementById('public-ficha-modal');
    if (!modal) return;
    modal.classList.add('is-hidden');
    document.body.classList.remove('modal-open');
  }

  async function openFicha(object) {
    if (!object || !object.id) return;
    currentObject = object;
    const modal = ensureModal();
    const info = objectInfo(object);
    modal.querySelector('#public-ficha-title').textContent = `Ficha didáctica: ${info.title}`;
    modal.querySelector('#public-ficha-description').textContent = info.description;
    const link = modal.querySelector('#public-ficha-link');
    link.href = `objeto.html?id=${encodeURIComponent(info.id)}#ficha-docente`;
    link.textContent = 'Abrir ficha completa';
    const actionHost = modal.querySelector('#public-ficha-actions');
    actionHost.innerHTML = actionButtons(object, 'modal');
    bindActions(actionHost, object);
    modal.classList.remove('is-hidden');
    document.body.classList.add('modal-open');
    await renderQr(modal.querySelector('#public-ficha-qr'), object, 240);
  }

  async function renderObjectFicha(object) {
    const section = document.getElementById('ficha-docente');
    if (!section || !object || !object.id) return;
    const info = objectInfo(object);
    const title = section.querySelector('[data-ficha-title]');
    const description = section.querySelector('[data-ficha-description]');
    const category = section.querySelector('[data-ficha-category]');
    if (title) title.textContent = `Ficha didáctica de ${info.title}`;
    if (description) description.textContent = info.description;
    if (category) category.textContent = info.category;

    const qrHost = section.querySelector('[data-ficha-qr]');
    const actions = section.querySelector('[data-ficha-actions]');
    if (actions) {
      actions.innerHTML = actionButtons(object, 'detail');
      bindActions(actions, object);
    }
    await renderQr(qrHost, object, 260);
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-public-ficha]');
    if (trigger && currentObject && trigger.dataset.openPublicFicha === currentObject.id) {
      openFicha(currentObject);
    }
  });

  global.EnsenasPublicResources = { openFicha, renderObjectFicha, closeFicha };
  global.addEventListener('ensenas:object-ready', (event) => {
    currentObject = event.detail;
    renderObjectFicha(event.detail);
  });
})(window);
