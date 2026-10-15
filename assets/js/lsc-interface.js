/* Solo interpretar elementos con video editorial asignado. Nunca inventar LSC. */
(function () {
  'use strict';
  const sources = new Map();
  const savedTimes = new Map();
  let active = null, trigger = null, anchor = null, suppressed = null, enterTimer, leaveTimer, restoringFocus = false, placementFrame;
  let pointer = { x: 0, y: 0 }, dismissedAt = null;
  const panel = document.createElement('section');
  panel.className = 'lsc-help-panel';
  panel.id = 'lsc-interface-player';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Interpretación LSC del elemento');
  panel.innerHTML = '<div class="lsc-help-heading"><h2>Interpretación LSC</h2><button type="button" aria-label="Cerrar interpretación LSC">×</button></div><video muted loop playsinline preload="none" tabindex="-1" aria-label="Interpretación en Lengua de Señas Colombiana"></video><p hidden role="status"></p>';
  document.body.append(panel);
  const video = panel.querySelector('video');
  video.muted = true;
  const title = panel.querySelector('h2');
  const message = panel.querySelector('p');
  const coarse = matchMedia('(hover: none)');
  const compact = matchMedia('(max-width: 700px)');
  const reduced = () => document.documentElement.hasAttribute('data-reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 700px), (hover: none)');
  const inlineClips = new Map();
  let inlineActive = null, inlineTimer;
  function stopInline() {
    for (const clip of inlineClips.values()) { clip.video.pause(); clip.element.classList.remove('is-lsc-active'); }
    inlineActive = null;
  }
  function chooseInline() {
    clearTimeout(inlineTimer);
    if (!mobile.matches || !autoEnabled || reduced() || document.hidden || !panel.hidden || document.documentElement.hasAttribute('data-accessibility-open')) { stopInline(); return; }
    const visible = [...inlineClips.values()].filter(clip => clip.ratio >= .5);
    for (const clip of visible) {
      const rect = clip.video.getBoundingClientRect();
      clip.center = rect.top + rect.height / 2;
      clip.score = clip.ratio * .6 + .4 * Math.max(0, 1 - Math.abs(clip.center - innerHeight / 2) / (innerHeight / 2));
    }
    visible.sort((a, b) => b.score - a.score);
    let next = visible[0];
    if (inlineActive && inlineActive.ratio >= .5 && next && next.score - inlineActive.score < .05) next = inlineActive;
    if (!next) { stopInline(); return; }
    if (next === inlineActive) return;
    stopInline(); inlineActive = next;
    if (!next.video.getAttribute('src')) next.video.src = sources.get(next.element.dataset.lscKey).video_url;
    next.element.classList.add('is-lsc-active'); next.note.hidden = true;
    next.video.play().catch(() => {
      if (inlineActive !== next) return;
      next.note.textContent = 'El navegador no pudo iniciar esta interpretación automáticamente.'; next.note.hidden = false;
    });
  }
  const inlineObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const clip = inlineClips.get(entry.target.parentElement.parentElement);
      if (clip) { clip.ratio = entry.intersectionRatio; clip.center = entry.boundingClientRect.top + entry.boundingClientRect.height / 2; }
    }
    if (inlineActive && inlineActive.ratio < .15) stopInline();
    clearTimeout(inlineTimer); inlineTimer = setTimeout(chooseInline, 180);
  }, { threshold: Array.from({ length: 11 }, (_, index) => index / 10) }) : null;
  mobile.addEventListener('change', () => { close(); chooseInline(); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { if (reduced()) close(); chooseInline(); });
  window.addEventListener('scroll', () => {
    if (!mobile.matches || !inlineClips.size) return;
    clearTimeout(inlineTimer); inlineTimer = setTimeout(chooseInline, 180);
  }, { passive: true });
  let autoEnabled = true;
  try { autoEnabled = localStorage.getItem('ensenas-lsc-auto') !== 'false'; } catch (_) { /* Valor accesible predeterminado. */ }
  const a11yBody = document.querySelector('.a11y-body');
  if (a11yBody) {
    const setting = document.createElement('label'); setting.className = 'a11y-switch';
    setting.innerHTML = '<span class="a11y-switch-icon" aria-hidden="true">LSC</span><span>Interpretación LSC al explorar</span><input type="checkbox"><span class="a11y-switch-track" aria-hidden="true"></span>';
    const input = setting.querySelector('input'); input.checked = autoEnabled;
    input.addEventListener('change', () => { autoEnabled = input.checked; try { localStorage.setItem('ensenas-lsc-auto', String(autoEnabled)); } catch (_) {} if (!autoEnabled) close(); chooseInline(); });
    document.querySelector('#site-reset-preferences')?.addEventListener('click', () => {
      autoEnabled = true; input.checked = true; try { localStorage.removeItem('ensenas-lsc-auto'); } catch (_) {}
      chooseInline();
    });
    a11yBody.prepend(setting);
  }
  function pause() {
    if (active) savedTimes.set(active, video.ended ? 0 : video.currentTime || 0);
    video.pause();
  }
  function place() {
    placementFrame = null;
    if (panel.hidden) return;
    if (compact.matches || coarse.matches || !anchor?.isConnected || !anchor.getClientRects().length) {
      panel.classList.remove('is-anchored'); panel.style.removeProperty('left'); panel.style.removeProperty('top');
      return;
    }
    const rect = anchor.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) { close(); return; }
    panel.classList.add('is-anchored');
    const width = panel.offsetWidth, height = panel.offsetHeight, gap = 10, margin = 12;
    const left = Math.max(margin, Math.min(innerWidth - width - margin, rect.left + (rect.width - width) / 2));
    let top = rect.bottom + gap;
    const above = top + height > innerHeight - margin && rect.top - height - gap >= margin;
    if (above) top = rect.top - height - gap;
    top = Math.max(margin, Math.min(top, innerHeight - height - margin));
    panel.style.left = `${Math.round(left)}px`; panel.style.top = `${Math.round(top)}px`;
    panel.style.setProperty('--lsc-arrow-left', `${Math.max(16, Math.min(width - 24, rect.left + rect.width / 2 - left - 6))}px`);
    panel.classList.toggle('is-above', above);
  }
  function schedulePlace() {
    if (!panel.hidden && !placementFrame) placementFrame = requestAnimationFrame(place);
  }
  function close(restore = false) {
    clearTimeout(enterTimer); clearTimeout(leaveTimer);
    pause(); panel.hidden = true;
    anchor = null;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    suppressed = active;
    if (restore && trigger) {
      dismissedAt = { ...pointer };
      restoringFocus = true;
      if (trigger.getClientRects().length) trigger.focus();
      else document.querySelector('[data-accessibility-toggle]')?.focus();
      restoringFocus = false;
    }
  }
  function show(key, button, explicit = false, target) {
    const item = sources.get(key);
    if (!item || document.documentElement.hasAttribute('data-accessibility-open') || ((!autoEnabled || reduced()) && !explicit) || (suppressed === key && !explicit)) return;
    clearTimeout(leaveTimer);
    stopInline();
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    anchor = target || button;
    trigger = button || target;
    if (active !== key) {
      pause(); active = key;
      title.textContent = item.etiqueta;
      message.hidden = true;
      video.src = item.video_url;
      video.onloadedmetadata = () => { if (savedTimes.has(key)) video.currentTime = Math.min(savedTimes.get(key), video.duration || 0); schedulePlace(); };
    }
    panel.hidden = false;
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    place();
    if (explicit) panel.querySelector('button').focus({ preventScroll: true });
    video.play().catch(() => { message.textContent = 'No se pudo iniciar el video. Abre esta interpretación desde Accesibilidad para intentarlo de nuevo.'; message.hidden = false; schedulePlace(); });
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
  video.addEventListener('error', () => { message.textContent = 'No se pudo reproducir esta interpretación. El contenido escrito sigue disponible.'; message.hidden = false; schedulePlace(); });
  video.addEventListener('ended', () => { savedTimes.set(active, 0); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else if (!panel.hidden) video.play().catch(() => { /* Reintento explícito desde Accesibilidad. */ });
    chooseInline();
  });
  window.addEventListener('resize', schedulePlace, { passive: true });
  window.addEventListener('scroll', schedulePlace, { passive: true, capture: true });
  if ('ResizeObserver' in window) new ResizeObserver(schedulePlace).observe(panel);
  document.addEventListener('ensenas:navigation-open', () => close());
  document.addEventListener('ensenas:accessibility-toggle', event => { if (event.detail.open) close(); chooseInline(); });
  document.addEventListener('ensenas:accessibility-change', event => { if (event.detail.motion) close(); chooseInline(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(true); } });
  function targetFor(node) {
    if (!(node instanceof Element)) return null;
    let target = node.closest('[data-lsc-key]');
    while (target && !sources.has(target.dataset.lscKey)) target = target.parentElement?.closest('[data-lsc-key]');
    return target;
  }
  function scheduleOpen(target) {
    suppressed = null; clearTimeout(leaveTimer); clearTimeout(enterTimer);
    enterTimer = setTimeout(() => show(target.dataset.lscKey, null, false, target), 300);
  }
  document.addEventListener('pointermove', event => {
    pointer = { x: event.clientX, y: event.clientY };
    if (!dismissedAt || (dismissedAt.x === pointer.x && dismissedAt.y === pointer.y)) return;
    dismissedAt = null;
    const target = targetFor(event.target);
    if (target && !coarse.matches && event.pointerType !== 'touch') scheduleOpen(target);
  }, { passive: true });
  document.addEventListener('pointerover', event => {
    if (coarse.matches || event.pointerType === 'touch' || dismissedAt) return;
    const target = targetFor(event.target);
    if (!target || target === targetFor(event.relatedTarget)) return;
    scheduleOpen(target);
  });
  document.addEventListener('pointerout', event => {
    const target = targetFor(event.target);
    if (target && target !== targetFor(event.relatedTarget)) { suppressed = null; if (!coarse.matches) scheduleClose(); }
  });
  document.addEventListener('focusin', event => {
    const target = targetFor(event.target);
    if (target && !coarse.matches && !restoringFocus) { suppressed = null; clearTimeout(leaveTimer); clearTimeout(enterTimer); enterTimer = setTimeout(() => show(target.dataset.lscKey, null, false, target), 300); }
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
      if (!sources.has(key) || element.dataset.lscBound === key) continue;
      element.dataset.lscBound = key;
      // Interpretar el elemento original sin añadir botones ni alterar su diseño.
      // El acceso táctil/manual permanece reunido dentro de Accesibilidad.
      if (!element.matches('a, button, input, select, textarea, [tabindex]')) element.tabIndex = 0;
      element.setAttribute('aria-controls', panel.id);
      if (element.matches('.welcome-path') && inlineObserver && !inlineClips.has(element)) {
        const slot = document.createElement('span'); slot.className = 'lsc-inline-media';
        const clipVideo = document.createElement('video'); clipVideo.muted = true; clipVideo.loop = true; clipVideo.playsInline = true; clipVideo.preload = 'none';
        clipVideo.setAttribute('aria-label', `Interpretación LSC: ${sources.get(key).etiqueta}`);
        const note = document.createElement('span'); note.className = 'lsc-inline-status'; note.textContent = 'Interpretación LSC · se activa al verla';
        slot.append(clipVideo, note); element.append(slot);
        inlineClips.set(element, { element, video: clipVideo, note, ratio: 0, center: 0 });
        inlineObserver.observe(clipVideo);
      }
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
      const heading = document.createElement('p'); heading.className = 'a11y-help'; heading.textContent = 'Interpretaciones LSC disponibles';
      for (const [key, item] of sources) {
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
