(function () {
  'use strict';
  const page = location.pathname.split('/').pop().replace(/\.html$/, '');
  const $ = (selector, root = document) => root.querySelector(selector);
  async function api(action, body, adminToken) {
    const options = { credentials: 'same-origin', headers: {} };
    if (adminToken) options.headers.Authorization = `Bearer ${adminToken}`;
    if (body) { options.method = 'POST'; options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify({ ...body, action }); }
    const response = await fetch(`/api/comunidad${body ? '' : `?action=${action}`}`, options);
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('Comunidad no está disponible. Inténtalo de nuevo más tarde.'); }
    if (!response.ok || !data.success) throw Object.assign(new Error(data.error || 'No se pudo completar la operación.'), { status: response.status });
    return data;
  }
  window.EnsenasCommunityAPI = api;
  function status(node, message, error = false) { node.textContent = message; node.dataset.error = String(error); }
  function el(tag, text, className) { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; }
  function videoCard(item, own = false) {
    const card = el('article', '', 'community-sign');
    if (item.video_url) {
      const video = el('video', '', 'community-video');
      video.controls = true; video.playsInline = true; video.preload = 'none'; video.src = item.video_url;
      video.setAttribute('aria-label', `Seña: ${item.significado}`);
      const error = el('p', '', 'community-status'); error.hidden = true;
      video.addEventListener('error', () => { error.hidden = false; error.textContent = 'El video no pudo reproducirse o el enlace temporal caducó. Actualiza la lista; si persiste, usa otro navegador.'; });
      card.append(video, error);
    } else card.append(el('p', 'Video todavía no disponible.', 'community-note'));
    card.append(el('h3', item.significado), el('p', `Por ${item.autor}`, 'community-author'));
    if (item.descripcion) card.append(el('p', item.descripcion));
    if (own) {
      const labels = { borrador: 'Subida sin confirmar', pendiente: 'Pendiente de revisión', aprobado: 'Publicado', rechazado: 'No publicado' };
      card.append(el('span', labels[item.estado] || item.estado, 'community-state'));
      if (item.nota_revision) card.append(el('p', `Revisión: ${item.nota_revision}`));
      if (item.estado === 'borrador') {
        const button = el('button', 'Comprobar y enviar', 'btn btn-outline btn-sm'); button.type = 'button';
        const notice = el('p', '', 'community-status'); notice.setAttribute('role', 'status');
        button.addEventListener('click', async () => {
          button.disabled = true;
          try { const result = await api('enviar', { id: item.id }); status(notice, result.estado === 'pendiente' ? 'Enviado a revisión. Actualiza la lista para ver el estado.' : 'Este aporte ya fue revisado. Actualiza la lista para ver el estado.'); button.remove(); }
          catch (error) { status(notice, error.message, true); button.disabled = false; }
        });
        card.append(button, notice);
      }
    }
    return card;
  }
  // Evita que varios aportes o interpretaciones de interfaz reproduzcan a la vez.
  document.addEventListener('play', event => {
    if (!event.target.matches('.community-video, .lsc-help-panel video')) return;
    document.querySelectorAll('.community-video, .lsc-help-panel video').forEach(video => { if (video !== event.target) video.pause(); });
  }, true);

  const mount = $('.community-empty');
  if (mount && ['sube-tu-sena', 'comunidad', 'leaderboard'].includes(page)) mount.removeAttribute('aria-labelledby');
  function initUpload() {
    mount.className = '';
    mount.innerHTML = `
      <div class="community-box" id="member-auth" data-lsc-key="community.cuenta"><h2>Tu espacio en la comunidad</h2>
        <p>La cuenta es solo para tus aportes; no permite administrar la plataforma. Tu correo no se publica.</p>
        <div class="community-actions"><button type="button" class="btn btn-secondary btn-sm" data-auth-mode="login" aria-pressed="true">Iniciar sesión</button><button type="button" class="btn btn-outline btn-sm" data-auth-mode="registro" aria-pressed="false">Crear cuenta</button></div>
        <form id="community-auth-form" class="community-form">
          <label id="alias-label" hidden>Alias público<input name="alias" minlength="2" maxlength="40" autocomplete="nickname"></label>
          <label>Correo<input name="email" type="email" required maxlength="254" autocomplete="email"></label>
          <label>Contraseña<input name="password" type="password" required minlength="10" maxlength="128" autocomplete="current-password" aria-describedby="community-password-hint"></label><small id="community-password-hint">De 10 a 128 caracteres.</small>
          <label id="account-consent-label" class="community-consent" hidden><input name="consent" type="checkbox">Tengo 18 años o participo con mi representante autorizado. Acepto usar esta cuenta para aportar contenido educativo respetuoso.</label>
          <button type="submit" class="btn btn-primary" data-lsc-key="community.login">Entrar</button>
        </form>
        <p class="community-status" id="auth-status" role="status"></p>
      </div>
      <div id="member-workspace" hidden>
        <div class="community-box"><div class="community-actions"><h2 id="member-greeting"></h2><button class="btn btn-outline btn-sm" type="button" id="member-logout">Cerrar sesión</button></div>
          <p>Comparte cualquier palabra, saludo o expresión en LSC. No tiene que estar relacionada con un objeto del catálogo.</p>
        </div>
        <div class="community-split">
          <section class="community-box"><h2>Comparte una seña</h2>
            <form id="community-upload-form" class="community-form">
              <label>¿Qué significa?<input name="significado" required minlength="2" maxlength="100" placeholder="Por ejemplo: Buenos días"></label>
              <label>Contexto o variante regional (opcional)<textarea name="descripcion" maxlength="500" rows="3"></textarea></label>
              <label>Selecciona un video<input id="community-file" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" required></label>
              <button type="button" id="community-record" class="btn btn-secondary btn-sm">Grabar con la cámara del teléfono</button>
              <input type="file" id="community-camera" accept="video/*" capture="user" hidden>
              <div id="community-mobile-preview" hidden></div>
              <p class="community-note">Hasta 25 MB y 60 segundos. MP4 es la opción más compatible. Encuadra rostro, manos y torso, con buena luz y sin recortar los movimientos.</p>
              <label class="community-consent"><input name="consent" type="checkbox" required>El video es mío o tengo autorización de quienes aparecen. Autorizo su revisión y publicación educativa con mi alias. No incluyo información privada; puedo solicitar su retirada al equipo.</label>
              <button type="submit" class="btn btn-primary" id="community-send" data-lsc-key="community.enviar" disabled>Enviar a revisión</button>
            </form>
            <progress class="community-progress" id="upload-progress" max="100" value="0" hidden aria-label="Progreso de subida"></progress>
            <p class="community-status" id="upload-status" role="status"></p>
          </section>
          <section class="community-box" id="community-preview-card" aria-labelledby="community-preview-heading"><h2 id="community-preview-heading">Revisa antes de enviar</h2><video id="community-preview" class="community-video" controls playsinline preload="metadata" hidden aria-label="Vista previa de tu aporte"></video><p id="preview-help">Selecciona o graba tu video para verlo aquí. Solo se publicará después de la revisión del equipo.</p><p class="community-note">Comprueba que el significado sea correcto en LSC. Si es una variante de tu región, explícalo en el contexto.</p></section>
        </div>
        <section class="community-box"><div class="community-actions"><h2>Mis aportes</h2><button type="button" id="refresh-mine" class="btn btn-outline btn-sm">Actualizar</button></div><p class="community-status" id="mine-status" role="status"></p><div id="my-signs" class="community-grid"></div><button type="button" id="more-mine" class="btn btn-secondary btn-sm" hidden>Ver más aportes</button></section>
      </div>`;
    let mode = 'login', file = null, objectURL = null, validated = false, reservedId = null, busy = false, myPage = 0;
    const form = $('#community-auth-form'), authStatus = $('#auth-status'), uploadForm = $('#community-upload-form');
    const preview = $('#community-preview'), uploadStatus = $('#upload-status'), send = $('#community-send');
    const compact = matchMedia('(max-width: 700px)');
    const previewCard = $('#community-preview-card'), previewSlot = $('#community-mobile-preview');
    function placePreview() {
      previewSlot.hidden = !compact.matches;
      if (compact.matches) previewSlot.append(previewCard);
      else $('.community-split', mount).append(previewCard);
    }
    compact.addEventListener('change', placePreview); placePreview();
    const authButtons = [...document.querySelectorAll('[data-auth-mode]')];
    authButtons.forEach(button => button.addEventListener('click', () => {
      mode = button.dataset.authMode;
      authButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      $('#alias-label').hidden = mode !== 'registro'; form.elements.alias.required = mode === 'registro';
      $('#account-consent-label').hidden = mode !== 'registro'; form.elements.consent.required = mode === 'registro';
      form.elements.password.autocomplete = mode === 'registro' ? 'new-password' : 'current-password';
      form.querySelector('[type=submit]').textContent = mode === 'registro' ? 'Crear cuenta' : 'Entrar';
      form.querySelector('[type=submit]').dataset.lscKey = mode === 'registro' ? 'community.registro' : 'community.login';
      status(authStatus, '');
    }));
    async function mine(append = false) {
      const notice = $('#mine-status'); status(notice, 'Cargando tus aportes…');
      $('#more-mine').disabled = true;
      try {
        if (!append) myPage = 0;
        const data = await api(`mis-senas&page=${myPage}`);
        if (!append) $('#my-signs').replaceChildren();
        data.items.forEach(item => $('#my-signs').append(videoCard(item, true)));
        $('#more-mine').hidden = !data.more; myPage++;
        status(notice, $('#my-signs').children.length ? '' : 'Todavía no has enviado señas. Tu primer aporte puede ser un saludo.');
      } catch (error) { status(notice, error.message, true); }
      finally { $('#more-mine').disabled = false; }
    }
    async function session() {
      try {
        const data = await api('sesion');
        $('#member-auth').hidden = true; $('#member-workspace').hidden = false;
        $('#member-greeting').textContent = `Hola, ${data.user.alias}`;
        await mine();
      } catch (error) {
        $('#member-auth').hidden = false; $('#member-workspace').hidden = true;
        if (error.status !== 401) status(authStatus, error.message, true);
      }
    }
    form.addEventListener('submit', async event => {
      event.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
      authButtons.forEach(item => item.disabled = true);
      status(authStatus, mode === 'registro' ? 'Creando tu cuenta…' : 'Entrando…');
      try {
        const data = await api(mode, { email: form.elements.email.value, password: form.elements.password.value, alias: form.elements.alias.value, consent: form.elements.consent.checked });
        form.elements.password.value = '';
        if (mode === 'registro') status(authStatus, data.message); else await session();
      } catch (error) { status(authStatus, error.message, true); }
      finally { button.disabled = false; authButtons.forEach(item => item.disabled = false); }
    });
    $('#member-logout').addEventListener('click', async event => {
      if (busy) { status(uploadStatus, 'Espera a que termine el envío antes de cerrar sesión.', true); return; }
      event.currentTarget.disabled = true;
      try { await api('logout', {}); $('#my-signs').replaceChildren(); $('#member-workspace').hidden = true; $('#member-auth').hidden = false; uploadForm.reset(); clearPreview(); form.elements.password.value = ''; status(authStatus, 'Sesión cerrada.'); }
      catch (error) { status(uploadStatus, error.message, true); }
      finally { $('#member-logout').disabled = false; }
    });
    function clearPreview() {
      validated = false; reservedId = null; file = null; send.disabled = true;
      preview.pause(); preview.removeAttribute('src'); preview.load(); preview.hidden = true;
      if (objectURL) URL.revokeObjectURL(objectURL); objectURL = null;
      $('#preview-help').hidden = false;
    }
    function selectFile(selected) {
      clearPreview(); status(uploadStatus, '');
      if (!selected) return;
      const extension = selected.name.split('.').pop().toLowerCase();
      const mime = selected.type || ({ mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }[extension]);
      if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(mime) || selected.size > 25 * 1024 * 1024 || selected.size === 0) { status(uploadStatus, 'Elige un video MP4, WebM o MOV de hasta 25 MB.', true); return; }
      file = { value: selected.type === mime ? selected : new File([selected], selected.name, { type: mime }), mime }; objectURL = URL.createObjectURL(file.value);
      preview.src = objectURL; preview.hidden = false; $('#preview-help').hidden = true;
      status(uploadStatus, 'Comprobando el video…');
    }
    function validatePreview() {
      if (!file) return;
      if (!Number.isFinite(preview.duration)) return;
      validated = Number.isFinite(preview.duration) && preview.duration > 0 && preview.duration <= 60 && preview.videoWidth > 0;
      send.disabled = !validated;
      if (preview.currentTime > 60) preview.currentTime = 0;
      status(uploadStatus, validated ? 'Video listo. Reprodúcelo y revisa las manos antes de enviarlo.' : 'El video debe durar entre 1 y 60 segundos. Exporta una versión MP4 si no se puede leer.', !validated);
    }
    preview.addEventListener('loadedmetadata', () => {
      if (!Number.isFinite(preview.duration)) {
        // Algunas grabaciones WebM no escriben duración hasta leer su último bloque.
        preview.currentTime = 1e7;
        return;
      }
      validatePreview();
    });
    preview.addEventListener('durationchange', validatePreview);
    preview.addEventListener('error', () => { if (file) { validated = false; send.disabled = true; status(uploadStatus, 'Este navegador no puede leer el video. Prueba con un MP4 compatible.', true); } });
    $('#community-file').addEventListener('change', event => selectFile(event.target.files[0]));
    $('#community-record').addEventListener('click', () => $('#community-camera').click());
    $('#community-camera').addEventListener('change', event => {
      const selected = event.target.files[0]; if (!selected) return;
      // La grabación nativa entrega el mismo archivo que el selector; no exige otra app.
      const transfer = new DataTransfer(); transfer.items.add(selected); $('#community-file').files = transfer.files; selectFile(selected);
    });
    function upload(url, selected) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest(); xhr.open('PUT', url); xhr.timeout = 180000;
        xhr.upload.onprogress = event => { if (event.lengthComputable) $('#upload-progress').value = Math.round(event.loaded / event.total * 100); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Falló la subida al almacenamiento. No se envió a revisión; vuelve a intentarlo.'));
        xhr.onerror = xhr.ontimeout = () => reject(new Error('La conexión se interrumpió. Comprueba internet y vuelve a intentarlo.'));
        const data = new FormData(); data.append('cacheControl', '3600'); data.append('', selected, selected.name);
        xhr.send(data);
      });
    }
    uploadForm.addEventListener('submit', async event => {
      event.preventDefault(); if (!validated || !file || busy) return;
      busy = true; preview.pause();
      const controls = [...uploadForm.querySelectorAll('input,textarea,button')]; controls.forEach(node => node.disabled = true);
      $('#upload-progress').hidden = false; $('#upload-progress').value = 0;
      try {
        if (!reservedId) {
          status(uploadStatus, 'Preparando una subida privada…');
          const slot = await api('reservar', { significado: uploadForm.elements.significado.value, descripcion: uploadForm.elements.descripcion.value, consent: uploadForm.elements.consent.checked, bytes: file.value.size, mime: file.mime });
          status(uploadStatus, 'Subiendo video… No cierres esta página.');
          await upload(slot.signedUrl, file.value);
          reservedId = slot.id;
        }
        status(uploadStatus, 'Verificando el archivo guardado y enviando a revisión…');
        const result = await api('enviar', { id: reservedId });
        uploadForm.reset(); clearPreview();
        status(uploadStatus, result.estado === 'pendiente' ? 'Tu seña se guardó y quedó pendiente de revisión. Todavía no es pública ni suma al leaderboard.' : 'Tu aporte se había guardado y ya fue revisado. Consulta su estado en Mis aportes.');
        await mine();
      } catch (error) { status(uploadStatus, `${error.message}${reservedId ? ' Pulsa de nuevo para confirmar el envío sin volver a subir el video.' : ''}`, true); }
      finally { busy = false; controls.forEach(node => node.disabled = false); send.disabled = !validated; $('#upload-progress').hidden = true; }
    });
    window.addEventListener('beforeunload', event => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
    $('#refresh-mine').addEventListener('click', () => mine());
    $('#more-mine').addEventListener('click', () => mine(true));
    // No guardar tokens de confirmación en historial ni utilizarlos como sesión implícita.
    if (/access_token=|error_description=/.test(location.hash)) {
      const failed = location.hash.includes('error_description='); history.replaceState(null, '', location.pathname + location.search);
      status(authStatus, failed ? 'El enlace de confirmación no es válido o caducó. Revisa tu correo.' : 'Correo confirmado. Inicia sesión para aportar una seña.', failed);
    }
    session();
  }

  function initGallery() {
    mount.className = '';
    mount.innerHTML = '<form class="community-search"><label>Buscar por significado<input name="q" type="search" maxlength="100" placeholder="Hola, gracias, buenos días…"></label><button class="btn btn-primary" type="submit">Buscar</button></form><p class="community-note">Videos compartidos por la comunidad y revisados antes de publicarse. Las variantes regionales pueden ser diferentes; consulta el contexto de cada aporte.</p><p role="status" class="community-status"></p><div class="community-grid"></div><button type="button" class="btn btn-secondary" id="community-more" hidden>Ver más señas</button>';
    let currentPage = 0, query = '', loading = false;
    const notice = $('.community-status', mount), grid = $('.community-grid', mount), more = $('#community-more');
    async function load(append = false) {
      if (loading) return; loading = true; more.disabled = true;
      status(notice, 'Cargando las señas de la comunidad…');
      try {
        const next = append ? currentPage + 1 : 0;
        const data = await api(`senas&page=${next}&q=${encodeURIComponent(query)}`);
        if (!append) grid.replaceChildren();
        data.items.forEach(item => grid.append(videoCard(item)));
        currentPage = next; more.hidden = !data.more;
        status(notice, grid.children.length ? '' : query ? 'No encontramos señas con ese significado.' : 'Todavía no hay señas aprobadas. Puedes ser la primera persona en aportar.');
      } catch (error) { status(notice, error.message, true); }
      finally { loading = false; more.disabled = false; }
    }
    $('form', mount).addEventListener('submit', event => { event.preventDefault(); if (loading) return; query = event.target.elements.q.value.trim(); load(); });
    more.addEventListener('click', () => load(true)); load();
  }
  async function initRanking() {
    mount.className = 'community-box';
    mount.innerHTML = '<h2>Cada aporte cuenta</h2><p>Solo cuentan las señas aprobadas. Tu cuenta conserva tus aportes aunque otras personas usen un alias parecido. El orden se actualiza al aprobar o retirar publicaciones.</p><p role="status" class="community-status"></p><ol class="community-ranking" aria-label="Personas con más aportes aprobados"></ol><button type="button" class="btn btn-outline btn-sm">Actualizar clasificación</button>';
    const button = $('button', mount), notice = $('.community-status', mount), list = $('ol', mount);
    async function load() {
      button.disabled = true; status(notice, 'Cargando la clasificación…');
      try {
        const data = await api('ranking'); list.replaceChildren();
        let rank = 0, previous = null;
        data.items.forEach((item, index) => {
          if (Number(item.aportes) !== previous) rank = index + 1;
          previous = Number(item.aportes);
          const row = el('li'); row.append(el('span', `#${rank}`), el('strong', item.alias), el('small', `${item.aportes} ${Number(item.aportes) === 1 ? 'seña' : 'señas'}`)); list.append(row);
        });
        status(notice, data.items.length ? '' : 'El leaderboard comenzará con el primer aporte aprobado.');
      } catch (error) { status(notice, error.message, true); }
      finally { button.disabled = false; }
    }
    button.addEventListener('click', load); load();
  }

  let discoveryPromise, pool = [], nextSign = 0;
  const assignments = new Map();
  function discover() {
    if (!discoveryPromise) discoveryPromise = api('descubrir').then(data => { pool = data.items.filter(item => item.video_url); return pool; }).catch(error => { discoveryPromise = null; throw error; });
    return discoveryPromise;
  }
  async function assigned(key) {
    await discover(); if (!pool.length) return null;
    if (!assignments.has(key)) assignments.set(key, pool[nextSign++ % pool.length]);
    return assignments.get(key);
  }
  let dialog;
  async function openRandom(key, opener) {
    if (!dialog) {
      dialog = el('dialog', '', 'community-random-dialog');
      dialog.setAttribute('aria-labelledby', 'community-random-title');
      dialog.innerHTML = '<div class="community-actions"><span class="community-kicker">Una seña de la comunidad</span><button type="button" class="btn btn-outline btn-sm">Cerrar</button></div><h2 id="community-random-title">Aprender seña</h2><p class="community-note">Descubre una palabra o expresión cualquiera; no es la traducción del objeto.</p><p class="community-status" role="status"></p><div class="community-random-content"></div><a class="btn btn-secondary btn-sm" href="comunidad.html">Ver más en Comunidad</a>';
      document.body.append(dialog);
      $('button', dialog).addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => { dialog.querySelectorAll('video').forEach(video => video.pause()); });
    }
    $('.community-random-content', dialog).replaceChildren();
    const notice = $('.community-status', dialog); status(notice, 'Buscando una seña para ti…');
    if (!dialog.open) dialog.showModal();
    try {
      const item = await assigned(key);
      status(notice, item ? '' : 'Todavía no hay señas aprobadas. Visita Sube tu seña para aportar la primera.');
      if (item) $('.community-random-content', dialog).append(videoCard(item));
    } catch (error) { status(notice, error.message, true); }
  }
  let objectSignLoading;
  function loadObjectSign() {
    if (objectSignLoading) return objectSignLoading;
    const video = $('#sign-learning-video'), empty = $('#sign-learning-empty');
    if (!video || !empty) return Promise.resolve();
    objectSignLoading = (async () => {
      try {
        const key = new URLSearchParams(location.search).get('id') || window.CURRENT_OBJETO?.id || 'objeto';
        const item = await assigned(`object-${key}`);
        if (!item) { empty.hidden = false; empty.textContent = 'Todavía no hay señas aprobadas. Puedes compartir una desde Sube tu seña.'; return; }
        $('#community-object-sign-title').textContent = item.significado;
        $('#community-object-sign-author').textContent = `Por ${item.autor}${item.descripcion ? ` · ${item.descripcion}` : ''}`;
        video.src = item.video_url; video.hidden = false; empty.hidden = true;
        video.addEventListener('error', () => { empty.hidden = false; empty.textContent = 'No se pudo reproducir esta seña. Actualiza la página o consulta Comunidad.'; }, { once: true });
      } catch (error) { empty.hidden = false; empty.textContent = error.message; objectSignLoading = null; }
    })();
    return objectSignLoading;
  }
  function playObjectSign() {
    loadObjectSign()?.then(() => { const video = $('#sign-learning-video'); if (video && !video.hidden) video.play().catch(() => {}); });
  }
  window.EnsenasCommunity = { openRandom, loadObjectSign, playObjectSign };
  if (page === 'objeto') loadObjectSign();
  function catalogButtons() {
    for (const card of document.querySelectorAll('.object-card:not([data-community-ready])')) {
      card.dataset.communityReady = 'true';
      const key = card.getAttribute('aria-labelledby') || `card-${nextSign}`;
      const button = el('button', 'Aprender una seña', 'btn btn-outline btn-sm community-learn-button');
      button.type = 'button'; button.dataset.lscKey = 'community.aprender';
      button.addEventListener('click', () => openRandom(key, button)); card.append(button);
    }
  }
  if (page === 'sube-tu-sena' && mount) initUpload();
  if (page === 'comunidad' && mount) initGallery();
  if (page === 'leaderboard' && mount) initRanking();
  if (page === 'catalogo') {
    catalogButtons();
    const container = $('#objects-grid-container');
    if (container) new MutationObserver(catalogButtons).observe(container, { childList: true });
  }
})();
