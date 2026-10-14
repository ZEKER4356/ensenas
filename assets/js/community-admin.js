(function () {
  'use strict';
  const mount = document.getElementById('community-admin-content');
  if (!mount) return;
  let initialized = false, currentPage = 0, loading = false, generation = 0;
  const $ = selector => mount.querySelector(selector);
  const node = (tag, text, className) => { const element = document.createElement(tag); if (text) element.textContent = text; if (className) element.className = className; return element; };
  const token = () => localStorage.getItem('ensenas_admin_token');
  async function request(action, body) {
    const options = { headers: { Authorization: `Bearer ${token() || ''}` } };
    if (body) { options.method = 'POST'; options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify({ ...body, action }); }
    const response = await fetch(`/api/comunidad${body ? '' : `?action=${action}`}`, options);
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('Comunidad todavía no está configurada o no está disponible.'); }
    if (!response.ok || !data.success) throw new Error(data.error || 'No se pudo completar la operación.');
    return data;
  }
  function notice(target, message, error = false) { target.textContent = message; target.dataset.error = String(error); }
  function initialize() {
    if (initialized) return;
    initialized = true;
    mount.innerHTML = `
      <details open><summary>Revisar señas de la comunidad</summary>
        <form class="community-search" id="moderation-filter"><label>Mostrar<select name="estado"><option value="pendiente">Pendientes</option><option value="aprobado">Publicadas</option><option value="rechazado">No publicadas</option></select></label><button type="submit" class="btn btn-secondary btn-sm">Actualizar lista</button></form>
        <p class="community-note">Revisa el significado en LSC, el encuadre, la autorización y la ausencia de datos personales. Aprobar publica el video y suma un aporte. Retirarlo lo quita del leaderboard.</p>
        <p class="community-status" id="moderation-status" role="status"></p><div class="community-grid" id="moderation-list"></div>
        <button type="button" id="moderation-more" class="btn btn-secondary btn-sm" hidden>Ver más aportes</button>
      </details>
      <details><summary>Interpretación LSC de tarjetas, enlaces y botones</summary>
        <p class="community-note">Asigna una traducción exacta a cada elemento. Solo los elementos con video activo muestran el control LSC; el mismo video se usa con mouse, teclado y el botón LSC del teléfono.</p>
        <form class="community-form" id="interpretation-form">
          <label>Elemento (clave)<input name="clave" required maxlength="100" pattern="[a-z0-9_.-]+" list="lsc-keys" placeholder="nav.catalogo"></label>
          <datalist id="lsc-keys"><option value="nav.inicio"><option value="nav.catalogo"><option value="nav.sube-tu-sena"><option value="nav.comunidad"><option value="nav.leaderboard"><option value="nav.equipo"><option value="nav.admin"><option value="page.bienvenida"><option value="page.catalogo"><option value="page.sube-tu-sena"><option value="page.comunidad"><option value="page.leaderboard"><option value="page.equipo"><option value="team.presentacion"><option value="community.cuenta"><option value="community.enviar"><option value="community.aprender"></datalist>
          <label>Texto interpretado<input name="etiqueta" required minlength="2" maxlength="160" placeholder="Explorar el catálogo de EnSeñas"></label>
          <label>Video LSC (URL HTTPS)<input name="video_url" type="url" required maxlength="2000" placeholder="https://…/catalogo.mp4"></label>
          <label>O sube un MP4<input id="interpretation-file" type="file" accept="video/mp4,.mp4"></label>
          <label class="community-consent"><input type="checkbox" name="activo" checked>Interpretación activa (desmarca para retirarla)</label>
          <button class="btn btn-primary" type="submit">Guardar interpretación</button>
        </form>
        <p class="community-status" id="interpretation-status" role="status"></p>
        <p class="community-note">Para una tarjeta del catálogo: <code>object.ID_DEL_OBJETO</code>. Para un botón de la página con id: <code>element.ID_DEL_BOTON</code>. El HUD de RA mantiene su propio intérprete sin modificar sus controles. Usa MP4 horizontal o cuadrado con rostro y manos completos. Guarda una entrada por cada texto diferente.</p>
        <div id="interpretation-list" class="community-grid"></div>
      </details>`;
    $('#moderation-filter').addEventListener('submit', event => { event.preventDefault(); load(false); });
    $('#moderation-more').addEventListener('click', () => load(true));
    const form = $('#interpretation-form'), fileInput = $('#interpretation-file');
    fileInput.addEventListener('change', () => { form.elements.video_url.required = !fileInput.files.length; });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const status = $('#interpretation-status');
      const controls = [...form.querySelectorAll('input,button')]; controls.forEach(input => input.disabled = true);
      try {
        let url = form.elements.video_url.value;
        const file = fileInput.files[0];
        if (file) {
          if (file.size > 25 * 1024 * 1024 || file.size === 0 || !/\.mp4$/i.test(file.name)) throw new Error('Selecciona un MP4 de hasta 25 MB.');
          notice(status, 'Subiendo el video de interpretación…');
          const response = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ action: 'create-upload-slot', folder: 'videos', filename: file.name }) });
          const slot = await response.json(); if (!response.ok || !slot.success) throw new Error(slot.error || 'No se pudo preparar la subida.');
          const data = new FormData(); data.append('cacheControl', '3600'); data.append('', file, file.name);
          const uploaded = await fetch(slot.signedUrl, { method: 'PUT', body: data });
          if (!uploaded.ok) throw new Error('Falló la subida del video. La interpretación no se guardó.');
          url = slot.url; form.elements.video_url.value = url;
        }
        notice(status, 'Guardando interpretación…');
        await request('interpretacion', { clave: form.elements.clave.value, etiqueta: form.elements.etiqueta.value, video_url: url, activo: form.elements.activo.checked });
        fileInput.value = ''; form.elements.video_url.required = true;
        notice(status, 'Interpretación guardada. Actualiza la página pública para comprobarla.'); await interpretations();
      } catch (error) { notice(status, error.message, true); }
      finally { controls.forEach(input => input.disabled = false); }
    });
    load(false); interpretations();
    for (const key of ['community.login', 'community.registro']) { const option = node('option'); option.value = key; $('#lsc-keys').append(option); }
    // Añadir las claves reales de objetos existentes sin editar sus datos.
    if (window.fetchAllObjectsAsync) window.fetchAllObjectsAsync().then(items => {
      items.forEach(item => { const option = node('option'); option.value = `object.${item.id}`; $('#lsc-keys').append(option); });
    }).catch(() => {});
  }
  async function interpretations() {
    const version = generation;
    try {
      const data = await request('interpretaciones-admin');
      if (version !== generation) return;
      const list = $('#interpretation-list'); list.replaceChildren();
      for (const item of data.items) {
        const card = node('article', '', 'community-sign');
        const button = node('button', 'Editar', 'btn btn-outline btn-sm'); button.type = 'button';
        button.addEventListener('click', () => {
          const form = $('#interpretation-form');
          for (const key of ['clave', 'etiqueta', 'video_url']) form.elements[key].value = item[key];
          form.elements.activo.checked = item.activo;
          $('#interpretation-file').value = ''; form.elements.video_url.required = true; form.elements.clave.focus();
        });
        card.append(node('strong', item.etiqueta), node('code', item.clave), node('p', item.activo ? 'Activa' : 'Retirada'), button); list.append(card);
      }
    } catch (error) { if (version === generation) notice($('#interpretation-status'), error.message, true); }
  }
  async function load(append) {
    if (loading) return; loading = true;
    const version = generation;
    const status = $('#moderation-status'), more = $('#moderation-more'), filter = $('#moderation-filter');
    filter.querySelector('button').disabled = true; filter.elements.estado.disabled = true; more.disabled = true;
    notice(status, 'Cargando aportes…');
    try {
      const next = append ? currentPage + 1 : 0;
      const data = await request(`moderacion&estado=${filter.elements.estado.value}&page=${next}`);
      if (version !== generation) return;
      if (!append) $('#moderation-list').replaceChildren();
      for (const item of data.items) {
        const card = node('article', '', 'community-sign');
        if (item.video_url) {
          const video = node('video', '', 'community-video'); video.src = item.video_url; video.controls = true; video.playsInline = true; video.preload = 'none'; video.setAttribute('aria-label', `Revisar seña: ${item.significado}`); card.append(video);
          video.addEventListener('play', () => { mount.querySelectorAll('video').forEach(other => { if (video !== other) other.pause(); }); });
        }
        card.append(node('h3', item.significado), node('p', `Por ${item.autor}`, 'community-author'), node('p', item.descripcion), node('p', `Estado: ${item.estado}`, 'community-state'));
        const label = node('label', 'Nota de revisión (obligatoria para retirar o rechazar)');
        const input = node('textarea'); input.maxLength = 500; input.rows = 2; input.value = item.nota_revision || ''; label.append(input);
        const approvedLabel = node('label', '', 'community-consent');
        const checked = node('input'); checked.type = 'checkbox'; approvedLabel.append(checked, document.createTextNode('Revisé el video, su significado en LSC y su autorización.'));
        const form = node('div', '', 'community-form'); form.append(label, approvedLabel); card.append(form);
        const actions = node('div', '', 'community-actions');
        const result = node('p', '', 'community-status'); result.setAttribute('role', 'status');
        for (const [state, title] of [['aprobado', 'Aprobar y publicar'], ['rechazado', item.estado === 'aprobado' ? 'Retirar publicación' : 'No publicar']]) {
          if (item.estado === state) continue;
          const button = node('button', title, 'btn btn-outline btn-sm'); button.type = 'button';
          if (!item.video_url && state === 'aprobado') button.disabled = true;
          button.addEventListener('click', async () => {
            if (state === 'aprobado' && !checked.checked) { notice(result, 'Confirma la revisión antes de aprobar.', true); return; }
            if (state === 'rechazado' && input.value.trim().length < 3) { notice(result, 'Escribe el motivo de la revisión.', true); input.focus(); return; }
            const buttons = [...actions.querySelectorAll('button')]; buttons.forEach(item => item.disabled = true);
            try { await request('revisar', { id: item.id, estado: state, nota: input.value }); card.querySelector('video')?.pause(); notice(result, state === 'aprobado' ? 'Publicado. Ya cuenta en el leaderboard.' : 'No publicado. No suma al leaderboard.'); actions.remove(); }
            catch (error) { notice(result, error.message, true); buttons.forEach(item => item.disabled = false); }
          });
          actions.append(button);
        }
        card.append(actions, result); $('#moderation-list').append(card);
      }
      currentPage = next; more.hidden = !data.more;
      notice(status, $('#moderation-list').children.length ? '' : 'No hay aportes en este estado.');
    } catch (error) { if (version === generation) notice(status, error.message, true); }
    finally { if (version === generation) { loading = false; filter.querySelector('button').disabled = false; filter.elements.estado.disabled = false; more.disabled = false; } }
  }
  window.addEventListener('ensenas:admin-session', event => {
    if (event.detail.active) initialize();
    else { generation++; loading = false; mount.querySelectorAll('video').forEach(video => video.pause()); mount.replaceChildren(); initialized = false; }
  });
  if (!document.getElementById('dashboard-view').classList.contains('is-hidden')) initialize();
})();
