(function () {
  'use strict';
  if (location.hash === '#catalogo') { location.replace('catalogo.html'); return; }
  const video = document.getElementById('welcome-video');
  const hero = document.querySelector('.welcome-hero');
  const guide = document.getElementById('welcome-video-guide');
  const full = document.getElementById('welcome-message-full');
  const animated = document.getElementById('welcome-message-animated');
  const pauseButton = document.getElementById('welcome-pause');
  const replayButton = document.getElementById('welcome-replay');
  if (!full || !animated || !video) return;
  const titleFull = document.getElementById('welcome-title-full');
  const titleAnimated = document.getElementById('welcome-title-animated');
  const title = titleFull.textContent.trim(), description = full.textContent.trim();
  const message = title + ' ' + description, brandIndex = title.indexOf('EnSeñas');
  const prefix = document.createTextNode(''), brand = document.createElement('span'), suffix = document.createTextNode('');
  brand.className = 'welcome-brand-highlight'; titleAnimated.replaceChildren(prefix, brand, suffix);
  const config = window.ENSENAS_WELCOME || {};
  const source = matchMedia('(max-width: 700px)').matches && config.mobileVideoUrl ? config.mobileVideoUrl : config.videoUrl;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionPreference.matches || document.documentElement.hasAttribute('data-reduce-motion');
  const available = () => !userPaused && !document.hidden && !document.documentElement.hasAttribute('data-accessibility-open');
  const canVideo = () => available() && videoInView && !reduced();
  const delay = Number.isFinite(config.replayDelaySeconds) ? Math.max(0, Math.min(30, config.replayDelaySeconds)) * 1000 : 5000;
  let hasVideo = false, userPaused = false, autoplayBlocked = false, videoInView = true, heroInView = true;
  let textDuration = Math.max(6000, Math.min(10000, message.length * 40)), textElapsed = 0, textFrame = null, textTick = null, characters = -1;
  let holding = false, holdRemaining = delay, holdTimer = null, holdStarted = null;
  video.muted = true; video.loop = false;

  function draw(count) {
    const next = Math.max(0, Math.min(message.length, Math.floor(count)));
    if (next !== characters) {
      characters = next;
      const visible = title.slice(0, Math.min(characters, title.length));
      if (brandIndex >= 0) {
        prefix.textContent = visible.slice(0, brandIndex); brand.textContent = visible.slice(brandIndex, brandIndex + 'EnSeñas'.length); suffix.textContent = visible.slice(brandIndex + 'EnSeñas'.length);
      } else prefix.textContent = visible;
      animated.textContent = description.slice(0, Math.max(0, characters - title.length - 1));
    }
    const typing = characters < message.length && available() && heroInView && !reduced();
    titleAnimated.classList.toggle('is-typing', typing && characters <= title.length);
    animated.classList.toggle('is-typing', typing && characters > title.length);
  }
  function updateButton() {
    pauseButton.textContent = userPaused || autoplayBlocked || (reduced() && (!hasVideo || video.paused)) ? 'Continuar bienvenida' : hasVideo ? 'Pausar bienvenida' : 'Pausar texto';
    pauseButton.setAttribute('aria-pressed', String(userPaused));
  }
  function stopText() { if (textFrame !== null) cancelAnimationFrame(textFrame); textFrame = null; textTick = null; draw(characters); }
  function startText() {
    if (reduced()) { stopText(); textElapsed = textDuration; draw(message.length); return; }
    if (!available() || !heroInView || textElapsed >= textDuration || textFrame !== null) return;
    function step(now) {
      textFrame = null;
      if (!available() || !heroInView || reduced()) { textTick = null; return; }
      if (textTick !== null) textElapsed = Math.min(textDuration, textElapsed + Math.min(100, now - textTick));
      textTick = now; draw(message.length * textElapsed / textDuration);
      if (textElapsed < textDuration) textFrame = requestAnimationFrame(step);
      else textTick = null;
    }
    textFrame = requestAnimationFrame(step);
  }
  function stopHold() {
    if (holdTimer !== null) { clearTimeout(holdTimer); holdRemaining = Math.max(0, holdRemaining - (performance.now() - holdStarted)); }
    holdTimer = null; holdStarted = null;
  }
  function startHold() {
    if (!holding || holdTimer !== null || !canVideo() || autoplayBlocked) return;
    holdStarted = performance.now();
    holdTimer = setTimeout(() => {
      holdTimer = null; holdStarted = null;
      if (!canVideo()) { holdRemaining = 0; return; }
      holding = false; holdRemaining = delay; video.currentTime = 0; playVideo();
    }, holdRemaining);
  }
  function playVideo() {
    if (holding) { startHold(); return; }
    video.play().catch(error => { if (error.name !== 'AbortError') { autoplayBlocked = true; updateButton(); } });
  }
  function reconcile() {
    if (available() && heroInView) startText(); else stopText();
    if (reduced()) { stopText(); textElapsed = textDuration; draw(message.length); }
    if (hasVideo && canVideo() && !autoplayBlocked) playVideo();
    else { video.pause(); stopHold(); }
    updateButton();
  }
  // El texto tiene reloj propio y no se borra al repetirse el video.
  // Solo el botón Repetir reinicia ambas partes de la bienvenida.
  full.classList.add('welcome-message-reserve'); full.setAttribute('aria-label', description); full.style.visibility = '';
  hero.dataset.textDurationMs = String(Math.round(textDuration));
  if (typeof source === 'string' && source.trim()) {
    const url = new URL(source, location.href);
    if (['https:', 'http:'].includes(url.protocol)) {
      video.src = url.href;
      video.addEventListener('loadedmetadata', () => {
        hasVideo = true;
        if (Number.isFinite(video.duration) && video.duration > 0) {
          const duration = Math.max(6000, Math.min(10000, video.duration * 450));
          textElapsed = Math.min(duration, textElapsed / textDuration * duration); textDuration = duration;
          hero.dataset.textDurationMs = String(Math.round(textDuration));
        }
        hero.classList.add('has-welcome-video'); document.body.classList.add('has-welcome-video');
        video.hidden = false; guide.hidden = true;
        document.getElementById('welcome-video-caption').textContent = 'Bienvenida a EnSeñas en Lengua de Señas Colombiana.';
        reconcile();
      }, { once: true });
      video.addEventListener('ended', () => {
        if (!video.ended) return;
        holding = true; holdRemaining = delay; startHold(); updateButton();
      });
      video.addEventListener('error', () => {
        hasVideo = false; stopHold(); holding = false;
        hero.classList.remove('has-welcome-video'); document.body.classList.remove('has-welcome-video');
        video.hidden = true; guide.hidden = false;
        guide.querySelector('.welcome-video-pending').textContent = 'Video no disponible';
        guide.querySelector('p').textContent = 'No se pudo cargar la interpretación. Puedes leer la bienvenida y continuar navegando.';
        reconcile();
      });
      video.addEventListener('play', () => { autoplayBlocked = false; updateButton(); });
    }
  }
  pauseButton.addEventListener('click', () => {
    userPaused = !(userPaused || autoplayBlocked || (reduced() && (!hasVideo || video.paused))); autoplayBlocked = false;
    if (userPaused) { stopText(); video.pause(); stopHold(); }
    else {
      startText();
      if (hasVideo) {
        // Con movimiento reducido no hay bucles automáticos, pero sí repetición explícita.
        if (holding && reduced()) { stopHold(); holding = false; holdRemaining = delay; video.currentTime = 0; }
        playVideo();
      }
    }
    updateButton();
  });
  replayButton.addEventListener('click', () => {
    stopText(); stopHold(); holding = false; holdRemaining = delay;
    userPaused = false; autoplayBlocked = false; textElapsed = 0; draw(0); startText();
    if (hasVideo) { video.currentTime = 0; playVideo(); }
    updateButton();
  });
  new MutationObserver(reconcile).observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
  motionPreference.addEventListener('change', reconcile);
  document.addEventListener('visibilitychange', reconcile);
  document.addEventListener('ensenas:accessibility-toggle', reconcile);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target === hero) heroInView = entry.isIntersecting;
        else videoInView = entry.isIntersecting && entry.intersectionRatio >= .15;
      }
      reconcile();
    }, { threshold: [0, .15] });
    observer.observe(hero); observer.observe(document.querySelector('.welcome-video-card'));
  }
  window.addEventListener('pagehide', () => { stopText(); stopHold(); video.pause(); });
  window.addEventListener('pageshow', reconcile);
  draw(0); reconcile();
})();
