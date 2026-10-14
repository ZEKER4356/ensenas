/* Solo interpretar elementos con video editorial asignado. Nunca inventar LSC. */
(function () {
  'use strict';
  const sources = new Map();
  const savedTimes = new Map();
  const controls = new WeakMap();
  let active = null, trigger = null, suppressed = null, enterTimer, leaveTimer, restoringFocus = false;
  const panel = document.createElement('section');
  panel.className = 'lsc-help-panel';
  panel.id = 'lsc-interface-player';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Interpretación LSC del elemento');
  panel.innerHTML = '<div class="lsc-help-heading"><h2>Interpretación LSC</h2><button type="button" aria-label="Cerrar interpretación LSC">×</button></div><video controls muted playsinline preload="none" aria-label="Interpretación en Lengua de Señas Colombiana"></video><p hidden role="status"></p>';
  document.body.append(panel);
  const video = panel.querySelector('video');
  const title = panel.querySelector('h2');
  const message = panel.querySelector('p');
  const coarse = matchMedia('(hover: none)');
  const reduced = () => document.documentElement.hasAttribute('data-reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let autoEnabled = true;
  try { autoEnabled = localStorage.getItem('ensenas-lsc-auto') !== 'false'; } catch (_) { /* Valor accesible predeterminado. */ }
  const a11yBody = document.querySelector('.a11y-body');
  if (a11yBody) {
    const setting = document.createElement('label'); setting.className = 'a11y-switch';
    setting.innerHTML = '<span class="a11y-switch-icon" aria-hidden="true">LSC</span><span>Interpretación LSC al explorar</span><input type="checkbox"><span class="a11y-switch-track" aria-hidden="true"></span>';
    const input = setting.querySelector('input'); input.checked = autoEnabled;
    input.addEventListener('change', () => { autoEnabled = input.checked; try { localStorage.setItem('ensenas-lsc-auto', String(autoEnabled)); } catch (_) {} if (!autoEnabled) close(); });
    document.querySelector('#site-reset-preferences')?.addEventListener('click', () => {
      autoEnabled = true; input.checked = true; try { localStorage.removeItem('ensenas-lsc-auto'); } catch (_) {}
    });
    a11yBody.prepend(setting);
  }
  function pause() {
    if (active) savedTimes.set(active, video.ended ? 0 : video.currentTime || 0);
    video.pause();
  }
  function close(restore = false) {
    clearTimeout(enterTimer); clearTimeout(leaveTimer);
    pause(); panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    suppressed = active;
    if (restore && trigger) {
      restoringFocus = true;
      if (trigger.getClientRects().length) trigger.focus();
      else document.querySelector('[data-accessibility-toggle]')?.focus();
      restoringFocus = false;
    }
  }
  function show(key, button, explicit = false) {
    const item = sources.get(key);
    if (!item || (!autoEnabled && !explicit) || (suppressed === key && !explicit)) return;
    clearTimeout(leaveTimer);
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    trigger = button || document.querySelector(`[data-lsc-open="${CSS.escape(key)}"]`);
    if (active !== key) {
      pause(); active = key;
      title.textContent = item.etiqueta;
      message.hidden = true;
      video.src = item.video_url;
      video.onloadedmetadata = () => { if (savedTimes.has(key)) video.currentTime = Math.min(savedTimes.get(key), video.duration || 0); };
    }
    panel.hidden = false;
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    if (explicit || !reduced()) video.play().catch(() => { /* Controles disponibles si el navegador bloquea autoplay. */ });
  }
  function scheduleClose() {
    clearTimeout(enterTimer);
    leaveTimer = setTimeout(() => {
      if (!panel.hidden && !panel.matches(':hover') && !panel.contains(document.activeElement)) close();
    }, 600);
  }
  panel.querySelector('button').addEventListener('click', () => close(true));
  panel.addEventListener('pointerenter', () => clearTimeout(leaveTimer));
  panel.addEventListener('pointerleave', () => { if (!coarse.matches) scheduleClose(); });
  video.addEventListener('error', () => { message.textContent = 'No se pudo reproducir esta interpretación. El contenido escrito sigue disponible.'; message.hidden = false; });
  video.addEventListener('ended', () => { savedTimes.set(active, 0); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(true); } });
  function targetFor(node) {
    if (!(node instanceof Element)) return null;
    let target = node.closest('[data-lsc-key]');
    while (target && !sources.has(target.dataset.lscKey)) target = target.parentElement?.closest('[data-lsc-key]');
    return target;
  }
  document.addEventListener('pointerover', event => {
    if (coarse.matches || event.pointerType === 'touch') return;
    const target = targetFor(event.target);
    if (!target || target === targetFor(event.relatedTarget)) return;
    suppressed = null; clearTimeout(leaveTimer); clearTimeout(enterTimer);
    enterTimer = setTimeout(() => show(target.dataset.lscKey), 450);
  });
  document.addEventListener('pointerout', event => {
    const target = targetFor(event.target);
    if (target && target !== targetFor(event.relatedTarget)) { suppressed = null; if (!coarse.matches) scheduleClose(); }
  });
  document.addEventListener('focusin', event => {
    const target = targetFor(event.target);
    if (target && !coarse.matches && !restoringFocus) { suppressed = null; clearTimeout(leaveTimer); clearTimeout(enterTimer); enterTimer = setTimeout(() => show(target.dataset.lscKey), 350); }
    if (panel.contains(event.target)) clearTimeout(leaveTimer);
  });
  document.addEventListener('focusout', event => {
    if (targetFor(event.target) || panel.contains(event.target)) {
      if (event.relatedTarget && (panel.contains(event.relatedTarget) || event.relatedTarget.closest('[data-lsc-open]'))) return;
      suppressed = null; scheduleClose();
    }
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-lsc-open]');
    if (!button) return;
    event.preventDefault();
    if (button.closest('#site-accessibility-panel')) document.querySelector('[data-accessibility-toggle]')?.click();
    if (!panel.hidden && active === button.dataset.lscOpen) close();
    else { suppressed = null; show(button.dataset.lscOpen, button, true); }
  });
  const hrefs = { catalogo: 'catalogo', 'sube-tu-sena': 'sube-tu-sena', comunidad: 'comunidad', leaderboard: 'leaderboard', colaboradores: 'equipo', index: 'inicio', admin: 'admin' };
  function decorate() {
    for (const element of document.querySelectorAll('a[href], button[id], [data-lsc-key], .object-card')) {
      if (element.closest('.lsc-help-panel')) continue;
      // El HUD de RA ya tiene su intérprete; no envolver sus controles ni alterar gestos.
      if (element.closest('#ar-scene-container')) continue;
      if (!element.dataset.lscKey) {
        if (element.matches('.object-card')) {
          const link = element.querySelector('a[href*="objeto"]');
          const id = link && new URL(link.href).searchParams.get('id');
          if (id) element.dataset.lscKey = `object.${id}`;
        } else if (element.matches('a')) {
          const name = new URL(element.href).pathname.split('/').pop().replace(/\.html$/, '') || 'index';
          if (hrefs[name]) element.dataset.lscKey = `nav.${hrefs[name]}`;
        } else if (element.id) element.dataset.lscKey = `element.${element.id}`;
      }
      const key = element.dataset.lscKey;
      const existing = controls.get(element);
      if (existing) {
        if (existing.dataset.lscOpen !== key && trigger === existing && !panel.hidden) close();
        existing.hidden = !sources.has(key);
        if (sources.has(key) && existing.dataset.lscOpen !== key) {
          existing.dataset.lscOpen = key;
          existing.setAttribute('aria-label', `Ver en LSC: ${sources.get(key).etiqueta}`);
        }
        continue;
      }
      if (!sources.has(key) || element.dataset.lscBound === key) continue;
      element.dataset.lscBound = key;
      // No añadir botones que aprieten el logo o las herramientas del encabezado.
      // En móvil, esos destinos también se interpretan desde Accesibilidad.
      if (element.closest('.brand-group, .site-tools')) continue;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'lsc-help-trigger';
      button.textContent = 'LSC'; button.dataset.lscOpen = key;
      button.setAttribute('aria-label', `Ver en LSC: ${sources.get(key).etiqueta}`);
      button.setAttribute('aria-controls', panel.id); button.setAttribute('aria-expanded', 'false');
      controls.set(element, button);
      if (element.matches('a, button')) {
        const wrapper = document.createElement('div');
        wrapper.className = `lsc-target-group${element.matches('.welcome-path') ? ' lsc-card-group' : ''}`;
        element.before(wrapper); wrapper.append(element, button);
      } else element.append(button);
    }
  }
  fetch('/api/comunidad?action=interpretaciones').then(async response => {
    const data = await response.json();
    if (!response.ok || !data.success) return;
    for (const item of data.items || []) {
      try { if (/^[a-z0-9_.-]{1,100}$/.test(item.clave) && new URL(item.video_url).protocol === 'https:') sources.set(item.clave, item); } catch (_) { /* Fuente inválida. */ }
    }
    if (a11yBody) {
      const section = document.createElement('div'); section.className = 'community-actions';
      const heading = document.createElement('p'); heading.className = 'a11y-help'; heading.textContent = 'Navegación en LSC';
      for (const [key, item] of sources) {
        if (!key.startsWith('nav.')) continue;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'lsc-help-trigger';
        button.dataset.lscOpen = key; button.textContent = item.etiqueta; button.setAttribute('aria-controls', panel.id); button.setAttribute('aria-expanded', 'false');
        section.append(button);
      }
      if (section.children.length) a11yBody.append(heading, section);
    }
    decorate();
    if (!sources.size) return;
    const watched = { childList: true, subtree: true, attributes: true, attributeFilter: ['data-lsc-key'] };
    const observer = new MutationObserver(() => { observer.disconnect(); decorate(); observer.observe(document.body, watched); });
    observer.observe(document.body, watched);
  }).catch(() => { /* Sin videos/configuración no se inventan controles ni traducciones. */ });
})();
