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

  // Recurso externo opcional. En las fichas queda fuera del visor y sus controles.
  if (!['admin', '404'].includes(page)) {
    const objectPage = document.body.classList.contains('experience-page');
    const course = document.createElement('aside');
    course.className = 'site-course' + (objectPage ? ' site-course-inline' : '');
    course.setAttribute('aria-label', 'Curso de Lengua de Señas Colombiana');
    course.innerHTML = '<details class="site-course-details"><summary class="site-course-toggle">Aprende LSC <span aria-hidden="true">＋</span></summary>' +
      '<div class="site-course-body"><div class="site-course-heading"><span>Continúa aprendiendo</span><button type="button" class="site-course-close" aria-label="Cerrar información del curso">×</button></div>' +
      '<img src="assets/images/curso-lsc-cultura-sorda.webp" alt="LSC y Cultura Sorda, curso en Bloque 10" width="624" height="399" loading="lazy" decoding="async">' +
      '<div class="site-course-copy"><p class="site-course-university">Bloque 10 · Universidad del Magdalena</p><h2>LSC y Cultura Sorda</h2><p>Con el profesor Edward Ignacio Rojas Díaz, intérprete de EnSeñas.</p>' +
      '<a class="site-course-link" href="https://bloque10.unimagdalena.edu.co/courses/lsc-y-cultura-sorda/" target="_blank" rel="noopener noreferrer">Acceder al curso <span aria-hidden="true">↗</span></a><small>Se abre en otra pestaña. El acceso al curso requiere iniciar sesión en Bloque 10.</small></div></div></details>';
    const footer = document.querySelector('.site-footer');
    if (footer) footer.before(course); else document.body.appendChild(course);
    if (!objectPage) document.body.classList.add('has-course-access');
    const details = course.querySelector('details');
    const toggle = course.querySelector('summary');
    const close = (restoreFocus = false) => {
      if (!details.open) return;
      details.open = false;
      if (restoreFocus) toggle.focus();
    };
    course.querySelector('.site-course-close').addEventListener('click', () => close(true));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(course.contains(document.activeElement)); });
    document.addEventListener('click', event => { if (!course.contains(event.target)) close(); });
    document.addEventListener('ensenas:navigation-open', () => close());
    document.addEventListener('ensenas:accessibility-toggle', event => { if (event.detail.open) close(); });
  }
})();
