/* Tema visual compartido de enseñas. El tema claro es el estado inicial. */
(function () {
  'use strict';

  const STORAGE_KEY = 'ensenas-theme';

  function getSavedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch (_) {
      return 'light';
    }
  }

  function applyTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const isDark = nextTheme === 'dark';
      button.setAttribute('aria-pressed', String(isDark));
      button.setAttribute('aria-label', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
      button.title = isDark ? 'Activar modo claro' : 'Activar modo oscuro';
      const label = button.querySelector('[data-theme-label]');
      if (label) label.textContent = isDark ? 'Modo claro' : 'Modo oscuro';
      const icon = button.querySelector('[data-theme-icon]');
      if (icon) icon.textContent = isDark ? '☀' : '◐';
    });

    document.querySelectorAll('img[data-theme-logo]').forEach((logo) => {
      const src = nextTheme === 'dark' ? logo.dataset.logoDark : logo.dataset.logoLight;
      if (src && logo.getAttribute('src') !== src) logo.setAttribute('src', src);
    });
  }

  function initialize() {
    applyTheme(getSavedTheme());
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        try {
          localStorage.setItem(STORAGE_KEY, nextTheme);
        } catch (_) {
          // El tema sigue funcionando incluso cuando el navegador bloquea almacenamiento.
        }
        applyTheme(nextTheme);
      });
    });
  }

  // Se aplica antes de que se cree la interfaz para evitar que el primer tema sea ambiguo.
  applyTheme(getSavedTheme());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }

  window.EnsenasTheme = { applyTheme };
})();
