/* Preferencias visuales compartidas. No modifican sesiones ni datos del catálogo. */
(function () {
  'use strict';
  const trigger = document.querySelector('[data-accessibility-toggle]');
  if (!trigger) return;
  const storageKey = 'ensenas-accessibility-v1';
  const defaults = {
    textSize: '100', contrast: false, motion: false, saturation: 'normal',
    dyslexia: false, lineHeight: 'normal', letterSpacing: 'normal',
    colors: false, headings: false, links: false, bold: false, guide: false, cursor: false
  };
  const choices = {
    textSize: ['100', '112', '125', '150', '175'],
    saturation: ['normal', 'muted', 'gray', 'vivid'],
    lineHeight: ['normal', 'relaxed', 'wide'],
    letterSpacing: ['normal', 'relaxed', 'wide']
  };
  let preferences = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(defaults)) {
        if (choices[key]?.includes(saved[key])) preferences[key] = saved[key];
        else if (typeof defaults[key] === 'boolean') preferences[key] = saved[key] === true;
      }
    }
  } catch (_) { /* Las opciones funcionan incluso sin almacenamiento. */ }
  const panel = document.createElement('aside');
  panel.id = 'site-accessibility-panel';
  panel.className = 'site-accessibility-dialog';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', 'site-accessibility-title');
  function tile(key, label, icon, id) {
    return '<label class="a11y-tile"><input type="checkbox" data-pref="' + key + '" id="' + id + '"><span class="a11y-tile-icon" aria-hidden="true">' + icon + '</span><span>' + label + '</span><span class="a11y-check" aria-hidden="true">✓</span></label>';
  }
  function select(key, label, icon, id, options) {
    return '<label class="a11y-tile a11y-select" for="' + id + '"><span class="a11y-tile-icon" aria-hidden="true">' + icon + '</span><span>' + label + '</span><select data-pref="' + key + '" id="' + id + '">' + options.map(([value, text]) => '<option value="' + value + '">' + text + '</option>').join('') + '</select></label>';
  }
  function toggle(key, label, icon) {
    return '<label class="a11y-switch"><span class="a11y-switch-icon" aria-hidden="true">' + icon + '</span><span>' + label + '</span><input type="checkbox" data-pref="' + key + '" aria-label="' + label + '"><span class="a11y-switch-track" aria-hidden="true"></span></label>';
  }
  panel.innerHTML = '<div class="site-dialog-heading"><div><span class="a11y-eyebrow">A tu manera</span><h2 id="site-accessibility-title">Accesibilidad</h2></div><button type="button" class="a11y-close" aria-label="Cerrar accesibilidad">×</button></div>' +
    '<div class="a11y-body"><p class="a11y-intro">Personaliza tu experiencia y ve los cambios al instante.</p><div class="a11y-grid">' +
    '<button type="button" class="a11y-tile" id="site-read-page" aria-pressed="false"><span class="a11y-tile-icon" aria-hidden="true">◖))</span><span data-reader-label>Leer en voz alta</span></button>' +
    select('textSize', 'Tamaño del texto', 'T', 'site-text-size', [['100', 'Normal'], ['112', 'Grande'], ['125', 'Muy grande'], ['150', 'Extra grande'], ['175', 'Máximo']]) +
    tile('contrast', 'Alto contraste', '◐', 'site-high-contrast') +
    select('saturation', 'Saturación', '◎', 'site-saturation', [['normal', 'Normal'], ['muted', 'Suave'], ['gray', 'Grises'], ['vivid', 'Intensa']]) +
    tile('motion', 'Pausar animaciones', 'Ⅱ', 'site-reduce-motion') +
    tile('dyslexia', 'Fuente de lectura', 'Aa', 'site-reading-font') +
    select('lineHeight', 'Interlineado', '↕', 'site-line-height', [['normal', 'Normal'], ['relaxed', 'Amplio'], ['wide', 'Muy amplio']]) +
    select('letterSpacing', 'Interletrado', '↔', 'site-letter-spacing', [['normal', 'Normal'], ['relaxed', 'Amplio'], ['wide', 'Muy amplio']]) +
    '</div>' + toggle('colors', 'Ayudas para daltonismo', '◉') +
    '<p class="a11y-help">Paleta azul y ámbar con enlaces subrayados. La fuente de lectura usa Verdana. Las ayudas son preferencias personales.</p>' +
    '<h3 class="a11y-section-title">Opciones avanzadas</h3>' +
    toggle('headings', 'Resaltar títulos', 'H') +
    toggle('links', 'Resaltar enlaces', '↗') +
    toggle('bold', 'Texto en negrita', 'B') +
    toggle('guide', 'Guía de lectura', '☰') +
    toggle('cursor', 'Cursor grande', '↖') +
    '<p class="a11y-help">La guía sigue el puntero; en móvil, toca el punto donde quieres leer. El cursor grande se aplica al usar ratón.</p>' +
    '<p id="site-accessibility-status" class="site-sr-only" aria-live="polite"></p></div>' +
    '<div class="a11y-footer"><button type="button" id="site-reset-preferences">↺ &nbsp; Restablecer configuración</button></div>';
  document.body.appendChild(panel);
  const guide = document.createElement('div');
  guide.id = 'site-reading-guide';
  guide.hidden = true;
  guide.setAttribute('aria-hidden', 'true');
  document.body.appendChild(guide);
  const status = panel.querySelector('#site-accessibility-status');
  const reader = panel.querySelector('#site-read-page');
  let utterance = null;
  const flags = {
    contrast: 'data-high-contrast', motion: 'data-reduce-motion',
    dyslexia: 'data-reading-font', colors: 'data-accessible-colors',
    headings: 'data-highlight-headings', links: 'data-highlight-links',
    bold: 'data-bold-text', cursor: 'data-large-cursor'
  };
  function applyPreferences() {
    const root = document.documentElement;
    root.style.fontSize = preferences.textSize + '%';
    for (const [key, attr] of Object.entries(flags)) root.toggleAttribute(attr, preferences[key]);
    root.dataset.saturation = preferences.saturation;
    root.dataset.lineHeight = preferences.lineHeight;
    root.dataset.letterSpacing = preferences.letterSpacing;
    guide.hidden = !preferences.guide;
    if (preferences.guide && !guide.style.top) guide.style.top = Math.round(innerHeight / 2) + 'px';
    panel.querySelectorAll('[data-pref]').forEach(control => {
      const value = preferences[control.dataset.pref];
      if (control.type === 'checkbox') {
        control.checked = value;
        control.closest('label')?.classList.toggle('is-selected', value);
      } else control.value = value;
    });
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch (_) { /* opcional */ }
  }
  panel.addEventListener('change', event => {
    const control = event.target;
    const key = control.dataset.pref;
    if (!(key in defaults)) return;
    preferences[key] = control.type === 'checkbox' ? control.checked : control.value;
    applyPreferences();
  });
  function stopReading() {
    utterance = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    reader.setAttribute('aria-pressed', 'false');
    reader.querySelector('[data-reader-label]').textContent = 'Leer en voz alta';
  }
  reader.disabled = !('speechSynthesis' in window);
  if (reader.disabled) reader.title = 'La lectura por voz no está disponible en este navegador.';
  reader.addEventListener('click', () => {
    if (utterance) { stopReading(); return; }
    const main = [...document.querySelectorAll('main')].find(el => !el.hidden && getComputedStyle(el).display !== 'none');
    if (!main) return;
    const copy = main.cloneNode(true);
    copy.querySelectorAll('script, style, [aria-hidden="true"], [hidden], .is-hidden, button, video, audio').forEach(el => el.remove());
    const text = copy.textContent.replace(/\s+/g, ' ').trim().slice(0, 12000);
    if (!text) { status.textContent = 'No hay texto disponible para leer.'; return; }
    speechSynthesis.cancel();
    utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    const voice = speechSynthesis.getVoices().find(voice => voice.lang.startsWith('es'));
    if (voice) utterance.voice = voice;
    utterance.onend = () => { utterance = null; reader.setAttribute('aria-pressed', 'false'); reader.querySelector('[data-reader-label]').textContent = 'Leer en voz alta'; };
    utterance.onerror = () => { stopReading(); status.textContent = 'No se pudo iniciar la lectura. Revisa las voces disponibles en tu dispositivo.'; };
    reader.setAttribute('aria-pressed', 'true');
    reader.querySelector('[data-reader-label]').textContent = 'Detener lectura';
    speechSynthesis.speak(utterance);
  });
  panel.querySelector('#site-reset-preferences').addEventListener('click', () => {
    preferences = { ...defaults };
    stopReading();
    applyPreferences();
    status.textContent = 'Preferencias restablecidas.';
  });
  function setOpen(open, restoreFocus = false) {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    document.documentElement.toggleAttribute('data-accessibility-open', open);
    if (open) {
      panel.querySelector('.a11y-body').scrollTop = 0;
      panel.querySelector('.a11y-close').focus();
    }
    if (restoreFocus) trigger.focus();
  }
  trigger.addEventListener('click', () => setOpen(panel.hidden));
  panel.querySelector('.a11y-close').addEventListener('click', () => setOpen(false, true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false, true);
    if (preferences.guide && event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const current = parseInt(guide.style.top, 10) || innerHeight / 2;
      guide.style.top = Math.max(0, Math.min(innerHeight, current + (event.key === 'ArrowDown' ? 24 : -24))) + 'px';
    }
  });
  function followPointer(event) {
    if (preferences.guide && !panel.contains(event.target)) guide.style.top = event.clientY + 'px';
  }
  document.addEventListener('pointermove', followPointer, { passive: true });
  document.addEventListener('pointerdown', followPointer, { passive: true });
  window.addEventListener('pagehide', stopReading);
  applyPreferences();
})();
