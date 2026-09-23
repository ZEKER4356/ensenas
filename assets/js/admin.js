/**
 * assets/js/admin.js - Lógica del Panel de Control de Administración de enseñas
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'ensenas_admin_token';
  const USER_KEY = 'ensenas_admin_user';

  // Referencias al DOM
  const authView = document.getElementById('auth-view');
  const dashboardView = document.getElementById('dashboard-view');
  const formLogin = document.getElementById('form-login');
  const authAlert = document.getElementById('auth-alert');
  const adminUserMenu = document.getElementById('admin-user-menu');
  const adminUserName = document.getElementById('admin-user-name');
  const btnLogout = document.getElementById('btn-logout');

  // Métricas
  const statTotal = document.getElementById('stat-total');
  const statActive = document.getElementById('stat-active');
  const statAudio = document.getElementById('stat-audio');
  const statLsc = document.getElementById('stat-lsc');

  // Tabla
  const tableBody = document.getElementById('objects-table-body');
  const filterSearch = document.getElementById('filter-search');
  const btnRefresh = document.getElementById('btn-refresh-list');

  // Modal y Formulario
  const modalObject = document.getElementById('modal-object-form');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const btnOpenModal = document.getElementById('btn-open-new-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const formUpsert = document.getElementById('form-upsert-object');
  const modalAlert = document.getElementById('modal-alert');
  const modalTitle = document.getElementById('modal-form-title');
  const btnSaveText = document.getElementById('btn-save-text');

  // Campos del Formulario
  const fieldIsEdit = document.getElementById('field-is-edit');
  const fieldId = document.getElementById('field-id');
  const fieldTitulo = document.getElementById('field-titulo');
  const fieldCategoria = document.getElementById('field-categoria');
  const fieldActivo = document.getElementById('field-activo');
  const fieldDescripcion = document.getElementById('field-descripcion');
  const fieldModeloUrl = document.getElementById('field-modelo-url');
  const fieldPreviewUrl = document.getElementById('field-preview-url');
  const fieldExplicacionTexto = document.getElementById('field-explicacion-texto');
  const fieldAudioUrl = document.getElementById('field-audio-url');
  const fieldVideoLsc = document.getElementById('field-video-lsc');
  const fieldInstruccionesLsc = document.getElementById('field-instrucciones-lsc');

  // Subidas de archivos
  const upload3D = document.getElementById('file-upload-3d');
  const uploadPreview = document.getElementById('file-upload-preview');
  const uploadAudio = document.getElementById('file-upload-audio');
  const uploadVideoLsc = document.getElementById('file-upload-video-lsc');
  const btnTestTts = document.getElementById('btn-test-tts');

  // Modal QR Personalizado
  const modalQr = document.getElementById('modal-qr-preview');
  const modalQrBackdrop = document.getElementById('modal-qr-backdrop');
  const btnCloseQrModal = document.getElementById('btn-close-qr-modal');
  const qrCanvasTarget = document.getElementById('qr-canvas-target');
  const qrObjectName = document.getElementById('qr-object-name-heading');
  const qrObjectCategory = document.getElementById('qr-object-category-badge');
  const qrTargetUrlDisplay = document.getElementById('qr-target-url-display');
  const btnCopyQrUrl = document.getElementById('btn-copy-qr-url');
  const btnDownloadQrPng = document.getElementById('btn-download-qr-png');
  const btnDownloadQrSvg = document.getElementById('btn-download-qr-svg');
  const btnPrintQrCard = document.getElementById('btn-print-qr-card');
  const btnBatchQrs = document.getElementById('btn-batch-qrs');

  let allObjects = [];
  let currentQrObject = null;

  // ========================================================================
  // 1. GESTIÓN DE SESIÓN Y AUTENTICACIÓN
  // ========================================================================
  function getToken() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function setSession(token, user) {
    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function checkAuth() {
    const token = getToken();
    if (!token) {
      showLoginView();
      return;
    }

    try {
      const res = await fetch('/api/auth?action=verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        showDashboardView(data.user);
        loadObjects();
      } else {
        clearSession();
        showLoginView();
      }
    } catch (err) {
      clearSession();
      showLoginView();
      showAuthAlert('No se pudo verificar la sesión. Intenta de nuevo.');
    }
  }

  function showLoginView() {
    authView.classList.remove('is-hidden');
    dashboardView.classList.add('is-hidden');
    adminUserMenu.classList.add('is-hidden');
  }

  function showDashboardView(user) {
    authView.classList.add('is-hidden');
    dashboardView.classList.remove('is-hidden');
    adminUserMenu.classList.remove('is-hidden');
    if (user && user.nombre) {
      adminUserName.textContent = user.nombre;
    }
  }

  // Submit Login
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      authAlert.classList.add('is-hidden');

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch('/api/auth?action=login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setSession(data.token, data.user);
          showDashboardView(data.user);
          loadObjects();
        } else {
          showAuthAlert(data.error || 'Credenciales inválidas.');
        }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      showAuthAlert('Error al conectar con el servicio de autenticación.');
      }
    });
  }

  function showAuthAlert(msg) {
    authAlert.textContent = msg;
    authAlert.classList.remove('is-hidden');
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      clearSession();
      showLoginView();
    });
  }

  // ========================================================================
  // 2. CARGA Y VISUALIZACIÓN DE OBJETOS EDUCATIVOS
  // ========================================================================
  async function loadObjects() {
    tableBody.innerHTML = '<tr><td colspan="5" class="table-loading">Cargando modelos...</td></tr>';
    const token = getToken();

    try {
      const res = await fetch('/api/objetos?all=true', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        allObjects = await res.json();
      } else {
        throw new Error('API respondió con estado ' + res.status);
      }
    } catch (err) {
      console.error('No se pudo cargar el catálogo administrativo:', err);
      allObjects = [];
      showAuthAlert('No se pudo cargar la información persistida.');
    }

    renderTable(allObjects);
    updateStats(allObjects);
  }

  function updateStats(items) {
    statTotal.textContent = items.length;
    statActive.textContent = items.filter(i => i.activo !== false).length;
    statAudio.textContent = items.filter(i => i.archivo_audio_url && i.archivo_audio_url.trim() !== '').length;
    statLsc.textContent = items.filter(i => i.video_lsc_url && i.video_lsc_url.trim() !== '').length;
  }

  function renderTable(items) {
    if (!items || items.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="table-empty">No hay objetos registrados aún. Haz clic en "Registrar Nueva Parte" para crear el primero.</td></tr>';
      return;
    }

    let html = '';
    items.forEach((item) => {
      const isActive = item.activo !== false;
      const hasAudio = !!(item.archivo_audio_url && item.archivo_audio_url.trim());
      const hasLsc = !!(item.video_lsc_url && item.video_lsc_url.trim());
      const has3D = !!(item.modelo_3d_url && item.modelo_3d_url.trim());

      html += `
        <tr data-id="${item.id}">
          <td>
            <div class="table-object-cell">
              <div class="table-thumb-box">
                <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              </div>
              <div>
                <strong class="table-obj-title">${escapeHtml(item.titulo || item.nombre || item.id)}</strong>
                <span class="table-obj-id">ID: <code>${escapeHtml(item.id)}</code></span>
              </div>
            </div>
          </td>
          <td>
            <span class="badge-category">${escapeHtml(item.categoria_lsc || 'Ciencia y Tecnología')}</span>
          </td>
          <td>
            <div class="media-badges-list">
              <span class="badge-media ${has3D ? 'is-active' : ''}" title="${has3D ? 'Modelo 3D disponible' : 'Sin modelo 3D'}">3D</span>
              <span class="badge-media ${hasAudio ? 'is-active' : ''}" title="${hasAudio ? 'Audio grabado (.mp3)' : 'Lectura por voz sintética TTS'}">${hasAudio ? 'MP3' : 'TTS'}</span>
              <span class="badge-media ${hasLsc ? 'is-active' : ''}" title="${hasLsc ? 'Video LSC disponible' : 'Sin video LSC'}">LSC</span>
            </div>
          </td>
          <td>
            <label class="switch-toggle" aria-label="Alternar estado activo del objeto">
              <input type="checkbox" class="toggle-status-checkbox" data-id="${item.id}" ${isActive ? 'checked' : ''}>
              <span class="slider round"></span>
              <span class="switch-label">${isActive ? 'Activo' : 'Inactivo'}</span>
            </label>
          </td>
          <td class="text-right">
            <div class="action-buttons-group">
              <a href="objeto.html?id=${encodeURIComponent(item.id)}&ar=true" target="_blank" class="btn btn-primary btn-xs" title="Probar en Realidad Aumentada">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>Ver RA</span>
              </a>
              <button type="button" class="btn btn-outline btn-xs btn-view-qr" data-id="${item.id}" title="Ver y descargar Código QR personalizado">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/></svg>
                <span>QR</span>
              </button>
              <button type="button" class="btn btn-secondary btn-xs btn-edit-object" data-id="${item.id}" title="Editar objeto">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Editar</span>
              </button>
              <button type="button" class="btn btn-danger btn-xs btn-delete-object" data-id="${item.id}" title="Eliminar objeto">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
    attachTableEvents();
  }

  function attachTableEvents() {
    // Toggle Activo/Inactivo
    document.querySelectorAll('.toggle-status-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const activo = e.target.checked;
        const label = e.target.parentElement.querySelector('.switch-label');
        if (label) label.textContent = activo ? 'Activo' : 'Inactivo';

        try {
          const res = await fetch('/api/objetos', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getToken()}`
            },
            body: JSON.stringify({ id, activo })
          });
          if (!res.ok) throw new Error('No se pudo actualizar el estado.');
        } catch (err) {
          e.target.checked = !activo;
          if (label) label.textContent = activo ? 'Inactivo' : 'Activo';
          showModalAlert('No se pudo guardar el cambio.');
          return;
        }

        const obj = allObjects.find(o => o.id === id);
        if (obj) obj.activo = activo;
        updateStats(allObjects);
      });
    });

    // Botones Ver / Descargar QR
    document.querySelectorAll('.btn-view-qr').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const obj = allObjects.find(o => o.id === id);
        if (obj) openQrModal(obj);
      });
    });

    // Botones Editar
    document.querySelectorAll('.btn-edit-object').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const obj = allObjects.find(o => o.id === id);
        if (obj) openEditModal(obj);
      });
    });

    // Botones Eliminar
    document.querySelectorAll('.btn-delete-object').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        if (!confirm(`¿Estás seguro de que deseas eliminar el objeto "${id}"? Esta acción no se puede deshacer.`)) {
          return;
        }

        try {
          const res = await fetch(`/api/objetos?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getToken()}` }
          });
          if (!res.ok) throw new Error('Error al eliminar');
          allObjects = allObjects.filter(o => o.id !== id);
          renderTable(allObjects);
          updateStats(allObjects);
        } catch (err) {
          console.error(err);
          alert('Error al eliminar el objeto.');
        }
      });
    });
  }

  // Filtrado en búsqueda
  if (filterSearch) {
    filterSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderTable(allObjects);
        return;
      }
      const filtered = allObjects.filter((item) => {
        const title = (item.titulo || item.nombre || '').toLowerCase();
        const cat = (item.categoria_lsc || '').toLowerCase();
        const id = (item.id || '').toLowerCase();
        return title.includes(q) || cat.includes(q) || id.includes(q);
      });
      renderTable(filtered);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadObjects);
  }

  // ========================================================================
  // 3. FORMULARIO MODAL (CREAR / EDITAR OBJETOS)
  // ========================================================================
  function openNewModal() {
    formUpsert.reset();
    fieldIsEdit.value = 'false';
    fieldId.disabled = false;
    modalTitle.textContent = 'Registrar Nueva Parte Educativa';
    btnSaveText.textContent = 'Guardar Objeto Educativo';
    modalAlert.classList.add('is-hidden');
    modalObject.classList.remove('is-hidden');
  }

  function openEditModal(obj) {
    formUpsert.reset();
    fieldIsEdit.value = 'true';
    fieldId.value = obj.id || '';
    fieldId.disabled = true; // El ID slug no se cambia en edición
    fieldTitulo.value = obj.titulo || obj.nombre || '';
    fieldCategoria.value = obj.categoria_lsc || 'Ciencia y Tecnología';
    fieldActivo.value = obj.activo !== false ? 'true' : 'false';
    fieldDescripcion.value = obj.descripcion || '';
    fieldModeloUrl.value = obj.modelo_3d_url || '';
    fieldPreviewUrl.value = obj.icono_preview_url || '';
    fieldExplicacionTexto.value = obj.explicacion_texto || obj.audio_texto || '';
    fieldAudioUrl.value = obj.archivo_audio_url || obj.audio_url || '';
    fieldVideoLsc.value = obj.video_lsc_url || '';

    if (Array.isArray(obj.instrucciones_lsc)) {
      fieldInstruccionesLsc.value = obj.instrucciones_lsc.join('\n');
    } else {
      fieldInstruccionesLsc.value = obj.instrucciones_lsc || '';
    }

    modalTitle.textContent = `Editar Objeto: ${obj.titulo || obj.nombre || obj.id}`;
    btnSaveText.textContent = 'Guardar Cambios';
    modalAlert.classList.add('is-hidden');
    modalObject.classList.remove('is-hidden');
  }

  function closeModal() {
    modalObject.classList.add('is-hidden');
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  if (btnOpenModal) btnOpenModal.addEventListener('click', openNewModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  // Enviar formulario (Guardar o Actualizar)
  if (formUpsert) {
    formUpsert.addEventListener('submit', async (e) => {
      e.preventDefault();
      modalAlert.classList.add('is-hidden');

      const isEdit = fieldIsEdit.value === 'true';
      const payload = {
        id: fieldId.value.trim(),
        titulo: fieldTitulo.value.trim(),
        categoria_lsc: fieldCategoria.value.trim() || 'Ciencia y Tecnología',
        descripcion: fieldDescripcion.value.trim(),
        activo: fieldActivo.value === 'true',
        modelo_3d_url: fieldModeloUrl.value.trim(),
        icono_preview_url: fieldPreviewUrl.value.trim(),
        explicacion_texto: fieldExplicacionTexto.value.trim(),
        archivo_audio_url: fieldAudioUrl.value.trim(),
        video_lsc_url: fieldVideoLsc.value.trim(),
        instrucciones_lsc: fieldInstruccionesLsc.value.split('\n').map(s => s.trim()).filter(Boolean)
      };

      if (!payload.titulo || !payload.modelo_3d_url || !payload.explicacion_texto) {
        showModalAlert('Por favor completa todos los campos requeridos (*).');
        return;
      }

      btnSaveText.textContent = 'Guardando...';

      try {
        const method = isEdit ? 'PUT' : 'POST';
        const res = await fetch('/api/objetos', {
          method: method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          closeModal();
          await loadObjects();
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo guardar el objeto.');
      } catch (err) {
        console.error('Error guardando objeto:', err);
        showModalAlert(err.message || 'No se pudo guardar el objeto de forma permanente.');
        btnSaveText.textContent = isEdit ? 'Guardar Cambios' : 'Guardar Objeto Educativo';
        return;
      }
    });
  }

  function showModalAlert(msg) {
    modalAlert.textContent = msg;
    modalAlert.classList.remove('is-hidden');
  }

  // ========================================================================
  // 4. SUBIDA DE ARCHIVOS A CLOUD STORAGE (InsForge / Supabase Storage)
  // ========================================================================
  function setupFileUpload(inputElement, targetField, folder) {
    if (!inputElement) return;

    inputElement.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const label = inputElement.parentElement.querySelector('span');
      const originalText = label ? label.textContent : '';
      if (label) label.textContent = 'Subiendo...';

      try {
        targetField.value = await uploadFileToStorage(file, folder);
        if (label) label.textContent = '¡Listo!';
        setTimeout(() => { if (label) label.textContent = originalText; }, 2000);
      } catch (err) {
        console.error('Error subiendo archivo:', err);
        if (label) label.textContent = 'Error al subir';
        showModalAlert(err.message || 'El archivo no se guardó. Corrige la configuración de Storage e intenta de nuevo.');
        setTimeout(() => { if (label) label.textContent = originalText; }, 2500);
      }
    });
  }

  async function uploadFileToStorage(file, folder, filename = file.name) {
    const base64 = await readFileAsBase64(file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        filename,
        fileData: base64,
        fileType: file.type || 'application/octet-stream',
        folder
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Error en subida');
    }
    return data.url;
  }

  function setupModelUpload(inputElement, targetField) {
    if (!inputElement) return;

    inputElement.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      const modelFile = files.find((file) => /\.(glb|gltf|usdz)$/i.test(file.name));
      if (!modelFile) return;

      const label = inputElement.parentElement.querySelector('span');
      const originalText = label ? label.textContent : '';
      if (label) label.textContent = 'Preparando modelo...';

      try {
        if (/\.gltf$/i.test(modelFile.name)) {
          const gltf = JSON.parse(await modelFile.text());
          const resourceUris = [
            ...(gltf.buffers || []).map((buffer) => buffer.uri),
            ...(gltf.images || []).map((image) => image.uri)
          ].filter((uri) => uri && !uri.startsWith('data:'));

          for (const resourceUri of resourceUris) {
            const resourceName = decodeURIComponent(resourceUri.split('/').pop().split('?')[0]);
            const resourceFile = files.find((file) => file.name === resourceName);
            if (!resourceFile) {
              throw new Error(`Selecciona también el archivo auxiliar \"${resourceName}\" junto al .gltf.`);
            }
            if (label) label.textContent = `Subiendo ${resourceName}...`;
            const publicUrl = await uploadFileToStorage(resourceFile, 'models');
            (gltf.buffers || []).forEach((buffer) => {
              if (buffer.uri === resourceUri) buffer.uri = publicUrl;
            });
            (gltf.images || []).forEach((image) => {
              if (image.uri === resourceUri) image.uri = publicUrl;
            });
          }

          if (label) label.textContent = 'Subiendo modelo...';
          const updatedGltf = new Blob([JSON.stringify(gltf)], { type: 'model/gltf+json' });
          targetField.value = await uploadFileToStorage(updatedGltf, 'models', modelFile.name);
        } else {
          if (label) label.textContent = 'Subiendo modelo...';
          targetField.value = await uploadFileToStorage(modelFile, 'models');
        }

        if (label) label.textContent = '¡Listo!';
        setTimeout(() => { if (label) label.textContent = originalText; }, 2500);
      } catch (err) {
        console.error('Error subiendo modelo 3D:', err);
        if (label) label.textContent = 'Error al subir';
        showModalAlert(err.message || 'El modelo no se guardó. Intenta subir un .glb o selecciona todos los archivos del .gltf.');
        setTimeout(() => { if (label) label.textContent = originalText; }, 3000);
      } finally {
        inputElement.value = '';
      }
    });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  setupModelUpload(upload3D, fieldModeloUrl);
  setupFileUpload(uploadPreview, fieldPreviewUrl, 'previews');
  setupFileUpload(uploadAudio, fieldAudioUrl, 'audio');
  setupFileUpload(uploadVideoLsc, fieldVideoLsc, 'videos');

  // Botón de prueba de síntesis de voz (Text-to-Speech)
  if (btnTestTts) {
    btnTestTts.addEventListener('click', () => {
      const texto = fieldExplicacionTexto.value.trim();
      if (!texto) {
        alert('Escribe un texto en la explicación para probar la voz sintética.');
        return;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(texto);
        utter.lang = 'es-CO';
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
      } else {
        alert('Tu navegador no soporta síntesis de voz.');
      }
    });
  }

  // ========================================================================
  // 5. GESTIÓN DE CÓDIGOS QR PERSONALIZADOS (EnsenasQR)
  // ========================================================================
  async function openQrModal(obj) {
    currentQrObject = obj;
    if (!obj || !modalQr) return;

    qrObjectName.textContent = obj.titulo || obj.nombre || obj.id;
    qrObjectCategory.textContent = obj.categoria_lsc || 'Ciencia y Tecnología';

    const targetUrl = EnsenasQR.buildTargetUrl(obj.id);
    qrTargetUrlDisplay.value = targetUrl;

    modalQr.classList.remove('is-hidden');

    if (qrCanvasTarget) {
      qrCanvasTarget.innerHTML = '<div style="padding: 30px; text-align: center; color: #94A3B8;">Generando QR de marca...</div>';
      try {
        await EnsenasQR.render(qrCanvasTarget, obj.id, {
          size: 300,
          title: obj.titulo
        });
      } catch (err) {
        console.error('Error renderizando QR:', err);
        qrCanvasTarget.innerHTML = '<div style="color: #EF4444; padding: 20px;">Error al generar código QR.</div>';
      }
    }
  }

  function closeQrModal() {
    if (modalQr) modalQr.classList.add('is-hidden');
    currentQrObject = null;
  }

  if (btnCloseQrModal) btnCloseQrModal.addEventListener('click', closeQrModal);
  if (modalQrBackdrop) modalQrBackdrop.addEventListener('click', closeQrModal);

  // Copiar URL al portapapeles
  if (btnCopyQrUrl) {
    btnCopyQrUrl.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(qrTargetUrlDisplay.value);
        const originalText = btnCopyQrUrl.textContent;
        btnCopyQrUrl.textContent = '¡Copiado!';
        setTimeout(() => { btnCopyQrUrl.textContent = originalText; }, 2000);
      } catch (e) {
        qrTargetUrlDisplay.select();
        document.execCommand('copy');
      }
    });
  }

  // Descargar PNG Alta Resolución
  if (btnDownloadQrPng) {
    btnDownloadQrPng.addEventListener('click', async () => {
      if (!currentQrObject) return;
      btnDownloadQrPng.disabled = true;
      const originalText = btnDownloadQrPng.innerHTML;
      btnDownloadQrPng.innerHTML = '<span>Generando 1024px...</span>';
      try {
        await EnsenasQR.downloadPNG(currentQrObject.id, {
          size: 1024,
          filename: `QR-ensenas-${currentQrObject.id}-1024px.png`
        });
      } catch (err) {
        console.error(err);
        alert('Error descargando PNG.');
      } finally {
        btnDownloadQrPng.disabled = false;
        btnDownloadQrPng.innerHTML = originalText;
      }
    });
  }

  // Descargar SVG Vectorial
  if (btnDownloadQrSvg) {
    btnDownloadQrSvg.addEventListener('click', async () => {
      if (!currentQrObject) return;
      try {
        await EnsenasQR.downloadSVG(currentQrObject.id, {
          filename: `QR-ensenas-${currentQrObject.id}-vector.svg`
        });
      } catch (err) {
        console.error(err);
        alert('Error descargando SVG.');
      }
    });
  }

  // Imprimir Ficha de Aula
  if (btnPrintQrCard) {
    btnPrintQrCard.addEventListener('click', () => {
      if (!currentQrObject) return;
      EnsenasQR.openPrintCard(currentQrObject);
    });
  }

  // ========================================================================
  // 6. ACTUALIZACIÓN MASIVA DE CÓDIGOS QR
  // ========================================================================
  if (btnBatchQrs) {
    btnBatchQrs.addEventListener('click', async () => {
      if (!allObjects || allObjects.length === 0) {
        alert('No hay objetos registrados para actualizar.');
        return;
      }

      const total = allObjects.length;
      if (!confirm(`¿Deseas regenerar y aplicar el nuevo diseño oficial de Código QR personalizado a los ${total} objetos registrados en la plataforma?`)) {
        return;
      }

      btnBatchQrs.disabled = true;
      const originalText = btnBatchQrs.innerHTML;
      btnBatchQrs.innerHTML = '<span>Actualizando QRs...</span>';

      try {
        let updatedCount = 0;
        for (let i = 0; i < allObjects.length; i++) {
          const item = allObjects[i];
          const canonicalQrTarget = `/objeto.html?id=${encodeURIComponent(item.id)}`;
          item.qr_code_url = canonicalQrTarget;

          // Guardar en la base de datos a través del endpoint /api/objetos
          const res = await fetch('/api/objetos', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getToken()}`
            },
            body: JSON.stringify({
              id: item.id,
              qr_code_url: canonicalQrTarget
            })
          });

          if (res.ok) {
            updatedCount++;
          }
        }

        alert(`¡Actualización masiva completada exitosamente!\n\nSe regeneraron y sincronizaron los Códigos QR de ${updatedCount} de ${total} objetos con el nuevo diseño institucional y redirección directa.`);
        await loadObjects();
      } catch (err) {
        console.error('Error en actualización masiva de QRs:', err);
        alert('Ocurrió un inconveniente durante la actualización masiva: ' + err.message);
      } finally {
        btnBatchQrs.disabled = false;
        btnBatchQrs.innerHTML = originalText;
      }
    });
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

  // Inicializar verificación
  checkAuth();

})();
