/* Navegación compartida: identidad, destinos centrales y herramientas a la derecha. */
(function () {
  'use strict';
  const container = document.querySelector('.site-header .header-container');
  const nav = container?.querySelector('.header-nav');
  if (!container || !nav) return;
  const links = [
    ['catalogo.html', 'Catálogo', 'catalogo'],
    ['sube-tu-sena.html', 'Sube tu seña', 'sube-tu-sena'],
    ['comunidad.html', 'Comunidad', 'comunidad'],
    ['leaderboard.html', 'Leaderboard', 'leaderboard'],
    ['colaboradores.html', 'Equipo de trabajo', 'colaboradores']
  ];
  const page = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
  const theme = nav.querySelector('[data-theme-toggle]');
  const userMenu = nav.querySelector('#admin-user-menu');
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
  for (const [href, label, key] of links) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (page === key) link.setAttribute('aria-current', 'page');
    list.appendChild(link);
  }
  menu.append(summary, list);
  nav.appendChild(menu);
  const tools = document.createElement('div');
  tools.className = 'site-tools';
  tools.setAttribute('role', 'group');
  tools.setAttribute('aria-label', 'Herramientas de la plataforma');
  if (theme) tools.appendChild(theme);
  const accessibility = document.createElement('button');
  accessibility.type = 'button';
  accessibility.className = 'btn btn-outline btn-sm site-accessibility-button';
  accessibility.dataset.accessibilityToggle = '';
  accessibility.innerHTML = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="4" r="2"/><path d="m4 8 8 2 8-2M12 10v5m0 0-4 6m4-6 4 6"/></svg>';
  accessibility.setAttribute('aria-label', 'Accesibilidad');
  accessibility.setAttribute('aria-expanded', 'false');
  accessibility.setAttribute('aria-controls', 'site-accessibility-panel');
  accessibility.title = 'Accesibilidad';
  tools.appendChild(accessibility);
  const admin = document.createElement('a');
  admin.className = 'site-admin-link';
  admin.href = 'admin.html';
  admin.setAttribute('aria-label', 'Panel de administración');
  admin.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>Admin</span>';
  tools.appendChild(admin);
  container.appendChild(tools);
  if (userMenu) {
    userMenu.classList.add('site-admin-session');
    container.appendChild(userMenu);
  }
  const desktop = matchMedia('(min-width: 1200px)');
  const sync = () => { menu.open = desktop.matches; };
  sync();
  desktop.addEventListener('change', sync);
  document.addEventListener('click', event => {
    if (!desktop.matches && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open && !desktop.matches) {
      menu.open = false;
      summary.focus();
    }
  });
  list.addEventListener('click', () => { if (!desktop.matches) menu.open = false; });
  accessibility.addEventListener('click', () => { if (!desktop.matches) menu.open = false; });
  menu.addEventListener('toggle', () => {
    if (menu.open && !desktop.matches) document.dispatchEvent(new CustomEvent('ensenas:navigation-open'));
  });
})();
