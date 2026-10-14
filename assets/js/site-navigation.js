/* Navegación compartida. Mantiene los controles y la sesión existentes. */
(function () {
  'use strict';

  const container = document.querySelector('.site-header .header-container');
  const nav = container?.querySelector('.header-nav');
  if (!container || !nav) return;

  const links = [
    ['index.html#catalogo', 'Catálogo', 'index'],
    ['sube-tu-sena.html', 'Sube tu seña', 'sube-tu-sena'],
    ['comunidad.html', 'Comunidad', 'comunidad'],
    ['leaderboard.html', 'Leaderboard', 'leaderboard'],
    ['colaboradores.html', 'Colaboradores', 'colaboradores']
  ];
  const page = window.location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
  const themeToggle = nav.querySelector('[data-theme-toggle]');
  const userMenu = nav.querySelector('#admin-user-menu');
  const isAdmin = document.body.classList.contains('admin-body');

  // Conservar los nodos: admin.js y theme.js siguen usando los mismos botones.
  nav.replaceChildren();
  container.classList.add('has-global-navigation');
  nav.classList.add('site-navigation');
  nav.setAttribute('aria-label', 'Navegación principal');
  const menu = document.createElement('details');
  menu.className = 'site-menu';
  const summary = document.createElement('summary');
  summary.className = 'btn btn-secondary btn-sm site-menu-toggle';
  summary.textContent = 'Menú';
  const list = document.createElement('div');
  list.className = 'site-menu-links';
  links.forEach(([href, label, key]) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (page === key) link.setAttribute('aria-current', 'page');
    list.appendChild(link);
  });
  const adminLink = document.createElement('a');
  adminLink.href = 'admin.html';
  adminLink.textContent = 'Administración';
  if (isAdmin) adminLink.setAttribute('aria-current', 'page');
  list.appendChild(adminLink);
  menu.append(summary, list);
  nav.appendChild(menu);
  const desktopLayout = window.matchMedia('(min-width: 1200px)');
  const syncMenuLayout = () => { menu.open = desktopLayout.matches; };
  syncMenuLayout();
  desktopLayout.addEventListener('change', syncMenuLayout);
  if (themeToggle) nav.appendChild(themeToggle);

  const accessibilityButton = document.createElement('button');
  accessibilityButton.type = 'button';
  accessibilityButton.className = 'btn btn-outline btn-sm site-accessibility-button';
  accessibilityButton.textContent = 'Accesibilidad';
  accessibilityButton.setAttribute('aria-haspopup', 'dialog');
  nav.appendChild(accessibilityButton);
  if (userMenu) nav.appendChild(userMenu);

  document.addEventListener('click', (event) => {
    if (!desktopLayout.matches && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open && !desktopLayout.matches) {
      menu.open = false;
      summary.focus();
    }
  });
  list.addEventListener('click', () => { if (!desktopLayout.matches) menu.open = false; });

  // Base de preferencias compartidas; las demás ayudas se incorporan en la
  // segunda entrega. No tocar datos de usuario, sesión ni recursos al restablecer.
  const storageKey = 'ensenas-accessibility-v1';
  let preferences = { textSize: '100', contrast: false, motion: false };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved) preferences = {
      textSize: ['100', '112', '125', '150'].includes(saved.textSize) ? saved.textSize : '100',
      contrast: saved.contrast === true,
      motion: saved.motion === true
    };
  } catch (_) { /* Las preferencias siguen funcionando sin almacenamiento. */ }

  const dialog = document.createElement('dialog');
  dialog.className = 'site-accessibility-dialog';
  dialog.setAttribute('aria-labelledby', 'site-accessibility-title');
  dialog.innerHTML = `
    <form method="dialog" class="site-dialog-heading">
      <h2 id="site-accessibility-title">Accesibilidad</h2>
      <button class="btn btn-secondary btn-sm" aria-label="Cerrar accesibilidad">Cerrar</button>
    </form>
    <p>Adapta la lectura a tu comodidad. Tus preferencias se conservan al cambiar de página.</p>
    <label class="site-setting">Tamaño del texto
      <select id="site-text-size">
        <option value="100">Normal</option><option value="112">Grande</option>
        <option value="125">Muy grande</option><option value="150">Extra grande</option>
      </select>
    </label>
    <label class="site-setting"><span>Aumentar contraste</span><input type="checkbox" id="site-high-contrast"></label>
    <label class="site-setting"><span>Reducir animaciones decorativas</span><input type="checkbox" id="site-reduce-motion"></label>
    <button type="button" id="site-reset-preferences" class="btn btn-secondary">Restablecer preferencias</button>`;
  document.body.appendChild(dialog);
  const textSize = dialog.querySelector('#site-text-size');
  const contrast = dialog.querySelector('#site-high-contrast');
  const motion = dialog.querySelector('#site-reduce-motion');

  function applyPreferences() {
    const root = document.documentElement;
    root.style.fontSize = preferences.textSize + '%';
    root.toggleAttribute('data-high-contrast', preferences.contrast);
    root.toggleAttribute('data-reduce-motion', preferences.motion);
    textSize.value = preferences.textSize;
    contrast.checked = preferences.contrast;
    motion.checked = preferences.motion;
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch (_) { /* opcional */ }
  }
  dialog.addEventListener('change', () => {
    preferences = { textSize: textSize.value, contrast: contrast.checked, motion: motion.checked };
    applyPreferences();
  });
  dialog.querySelector('#site-reset-preferences').addEventListener('click', () => {
    preferences = { textSize: '100', contrast: false, motion: false };
    applyPreferences();
  });
  accessibilityButton.addEventListener('click', () => {
    if (!desktopLayout.matches) menu.open = false;
    if (!dialog.open) dialog.showModal();
  });
  dialog.addEventListener('close', () => accessibilityButton.focus());
  applyPreferences();
})();
