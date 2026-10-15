(function () {
  'use strict';
  // Compatibilidad con enlaces guardados antes de separar el catálogo.
  if (window.location.hash === '#catalogo') {
    window.location.replace('catalogo.html');
    return;
  }
  const video = document.getElementById('welcome-video');
  const guide = document.getElementById('welcome-video-guide');
  const full = document.getElementById('welcome-message-full');
  const animated = document.getElementById('welcome-message-animated');
  const pauseButton = document.getElementById('welcome-pause');
  const replayButton = document.getElementById('welcome-replay');
  if (!full || !animated || !video) return;

  const titleFull = document.getElementById('welcome-title-full');
  const titleAnimated = document.getElementById('welcome-title-animated');
  const title = titleFull.textContent.trim();
  const brandIndex = title.indexOf('EnSeñas');
  const prefix = document.createTextNode('');
  const brand = document.createElement('span');
  brand.className = 'welcome-brand-highlight';
  const suffix = document.createTextNode('');
  titleAnimated.replaceChildren(prefix, brand, suffix);
  const description = full.textContent.trim();
  const message = title + ' ' + description;
  const config = window.ENSENAS_WELCOME || {};
  const mobileLayout = window.matchMedia('(max-width: 700px)');
  const configuredSource = mobileLayout.matches && config.mobileVideoUrl
    ? config.mobileVideoUrl : config.videoUrl;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let hasVideo = false;
  let paused = false;
  let userPaused = false;
  let inView = true;
  let timer = null;
  let characters = 0;
  const reducedMotion = () => motionPreference.matches || document.documentElement.hasAttribute('data-reduce-motion');
  const canAutoplay = () => !reducedMotion() && !userPaused && inView && !document.hidden && !document.documentElement.hasAttribute('data-accessibility-open');
  video.muted = true;
  function playVideo() {
    video.play().catch(() => { paused = true; draw(message.length); updateButton(); });
  }
  const cues = Array.isArray(config.cues) ? config.cues
    .filter(cue => Number.isFinite(cue.time) && cue.time >= 0 && Number.isFinite(cue.characters))
    .sort((a, b) => a.time - b.time) : [];

  function draw(count) {
    characters = Math.max(0, Math.min(message.length, Math.floor(count)));
    const visibleTitle = title.slice(0, Math.min(characters, title.length));
    if (brandIndex >= 0) {
      prefix.textContent = visibleTitle.slice(0, brandIndex);
      brand.textContent = visibleTitle.slice(brandIndex, brandIndex + 'EnSeñas'.length);
      suffix.textContent = visibleTitle.slice(brandIndex + 'EnSeñas'.length);
    } else prefix.textContent = visibleTitle;
    animated.textContent = description.slice(0, Math.max(0, characters - title.length - 1));
    const typing = characters < message.length && !paused && !reducedMotion();
    titleAnimated.classList.toggle('is-typing', typing && characters <= title.length);
    animated.classList.toggle('is-typing', typing && characters > title.length);
  }
  function updateButton() {
    pauseButton.textContent = paused ? 'Continuar bienvenida' : (hasVideo ? 'Pausar bienvenida' : 'Pausar texto');
    pauseButton.setAttribute('aria-pressed', String(paused));
  }
  function stopTimer() {
    window.clearInterval(timer);
    timer = null;
  }
  function syncVideoText() {
    if (reducedMotion()) { draw(message.length); return; }
    if (cues.length) {
      const current = cues.filter(cue => cue.time <= video.currentTime).pop();
      draw(current ? current.characters : 0);
    } else if (Number.isFinite(video.duration) && video.duration > 0) {
      draw((video.currentTime / video.duration) * message.length);
    }
  }
  function startText() {
    stopTimer();
    if (reducedMotion()) { draw(message.length); return; }
    if (hasVideo || paused || characters >= message.length) return;
    timer = window.setInterval(() => {
      draw(characters + 1);
      if (characters >= message.length) { stopTimer(); animated.classList.remove('is-typing'); }
    }, 75);
  }
  full.classList.add('welcome-message-reserve');
  full.setAttribute('aria-label', description);
  // Mantener el mensaje íntegro para lectores de pantalla; la copia animada
  // es decorativa y nunca anuncia cada letra.
  full.style.visibility = '';

  if (typeof configuredSource === 'string' && configuredSource.trim()) {
    const source = new URL(configuredSource, window.location.href);
    if (['https:', 'http:'].includes(source.protocol)) {
      video.src = source.href;
      video.addEventListener('loadedmetadata', () => {
        hasVideo = true;
        document.querySelector('.welcome-hero').classList.add('has-welcome-video');
        document.body.classList.add('has-welcome-video');
        stopTimer();
        video.hidden = false;
        guide.hidden = true;
        document.getElementById('welcome-video-caption').textContent = 'Bienvenida a EnSeñas en Lengua de Señas Colombiana.';
        paused = video.paused;
        updateButton();
        if (canAutoplay()) playVideo();
      }, { once: true });
      video.addEventListener('error', () => {
        hasVideo = false;
        document.querySelector('.welcome-hero').classList.remove('has-welcome-video');
        document.body.classList.remove('has-welcome-video');
        video.hidden = true;
        guide.hidden = false;
        guide.querySelector('.welcome-video-pending').textContent = 'Video no disponible';
        guide.querySelector('p').textContent = 'No se pudo cargar la interpretación. Puedes leer la bienvenida y continuar navegando.';
        paused = false;
        updateButton();
        startText();
      });
      video.addEventListener('timeupdate', syncVideoText);
      video.addEventListener('seeked', syncVideoText);
      video.addEventListener('play', () => { paused = false; updateButton(); });
      video.addEventListener('pause', () => { paused = true; syncVideoText(); updateButton(); });
    }
  }
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    userPaused = paused;
    updateButton();
    if (hasVideo) {
      if (paused) video.pause();
      else playVideo();
    } else {
      if (paused) stopTimer();
      else startText();
    }
  });
  replayButton.addEventListener('click', () => {
    paused = false;
    userPaused = false;
    draw(0);
    updateButton();
    if (hasVideo) {
      video.currentTime = 0;
      playVideo();
    } else startText();
  });
  function updateMotion() {
    if (reducedMotion()) {
      stopTimer();
      draw(message.length);
      if (hasVideo) video.pause();
    } else if (hasVideo && canAutoplay()) playVideo();
    else startText();
  }
  new MutationObserver(updateMotion).observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
  motionPreference.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopTimer();
      if (hasVideo) video.pause();
    } else if (hasVideo && canAutoplay()) playVideo();
    else startText();
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting && entries[0].intersectionRatio >= .15;
    if (!hasVideo) return;
    if (!inView) video.pause();
    else if (canAutoplay()) playVideo();
  }, { threshold: [0, .15] }).observe(document.querySelector('.welcome-video-card'));
  document.addEventListener('ensenas:accessibility-toggle', event => {
    if (!hasVideo) return;
    if (event.detail.open) video.pause();
    else if (canAutoplay()) playVideo();
  });
  window.addEventListener('pagehide', stopTimer);
  draw(0);
  startText();
})();
