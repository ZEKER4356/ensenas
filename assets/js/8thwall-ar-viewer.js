/*
 * Adaptador piloto de 8th Wall para enseñas.
 * Conserva el HTML, los controles y los medios del visor oficial. Solamente
 * intercambia el motor de cámara y detección de superficies en la ruta
 * ?ar=true&engine=8th.
 */
(function () {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const sceneContainer = byId('ar-scene-container');
  const canvasHost = byId('ar-canvas-host');
  const directPrompt = byId('ar-direct-start-prompt');
  const directButton = byId('btn-direct-start');
  const status = byId('ar-status-text');
  const loading = byId('ar-loading-overlay');
  const scanOverlay = byId('ar-surface-scan-overlay');
  const anchorButton = byId('btn-anchor-here');
  const toggleArButton = byId('btn-toggle-ar-mode');
  const reanchorButton = byId('btn-reanchor-view');
  const lscButton = byId('btn-toggle-lsc-overlay');
  const learnButton = byId('btn-open-sign-learning');
  const lscOverlay = byId('ar-floating-lsc');
  const lscVideo = byId('ar-overlay-video-lsc');
  const lscPlaceholder = byId('lsc-overlay-placeholder');
  const learningPanel = byId('lsc-steps-panel');
  const learningVideo = byId('sign-learning-video');
  const learningEmpty = byId('sign-learning-empty');
  const closeLearningButton = byId('btn-close-lsc-mode');
  const audio = byId('ar-audio-element');
  const floatingAudio = byId('ar-floating-audio');
  const audioPlay = byId('btn-ar-audio-play');
  const audioMute = byId('btn-ar-audio-mute');
  const audioReplay = byId('btn-ar-audio-replay');
  const audioProgress = byId('ar-audio-progress');
  const audioTime = byId('ar-audio-time');
  const licenseNotice = byId('engine-license-notice');
  const data = window.ENSENAS_DATA || {};

  if (!canvasHost || !sceneContainer) return;

  const objectId = data.objectId || 'microbit';
  const objectName = data.objectName || 'Objeto educativo';
  const modelUrl = data.modelUrl || `assets/models/${objectId}.glb`;
  const audioUrl = data.audioUrl || '';
  const audioText = data.audioTexto || '';
  const lscUrl = data.videoLscUrl || '';
  const learnUrl = data.videoAprenderLscUrl || '';

  let canvas;
  let scene;
  let camera;
  let anchorGroup;
  let contentGroup;
  let reticle;
  let engineStarted = false;
  let modelReady = false;
  let modelPlaced = false;
  let scanning = false;
  let lastHit = null;
  let baseScale = 0.32;
  let speech = null;
  let gesture = null;

  sceneContainer.classList.add('ar-immersive', 'ar-8th-pilot');
  document.body.classList.add('ar-active-body');
  if (licenseNotice) licenseNotice.hidden = false;
  updateStatus('Piloto 8th Wall: prepara el escaneo');
  configureExistingInterface();
  configureAccessibleMedia();
  bindInterface();
  showStartPrompt();

  function updateStatus(message) {
    if (status) status.textContent = message;
  }

  function setButtonText(button, text) {
    const label = button && button.querySelector('.btn-text, span:last-child');
    if (label) label.textContent = text;
  }

  function showStartPrompt(message) {
    if (!directPrompt) return;
    const description = directPrompt.querySelector('.direct-start-desc');
    if (description && message) description.textContent = message;
    directPrompt.classList.add('is-visible');
    if (directButton) directButton.disabled = false;
  }

  function configureExistingInterface() {
    const title = byId('direct-object-title');
    if (title) title.textContent = objectName;
    setButtonText(toggleArButton, 'Iniciar RA');
    if (reanchorButton) reanchorButton.classList.add('is-hidden');
    if (anchorButton) anchorButton.disabled = true;
    // En la ruta de cámara, "Ver ficha" vuelve a la misma ficha sin la cámara.
    const close = byId('btn-close-ar-mode');
    if (close) close.addEventListener('click', () => exitToFicha());
  }

  function configureAccessibleMedia() {
    if (lscButton) {
      lscButton.disabled = !lscUrl;
      lscButton.setAttribute('aria-expanded', 'false');
    }
    if (lscUrl && lscVideo) {
      lscVideo.src = lscUrl;
      lscVideo.addEventListener('loadeddata', () => {
        if (lscPlaceholder) lscPlaceholder.classList.add('is-hidden');
      }, { once: true });
      lscVideo.addEventListener('error', () => {
        if (lscButton) lscButton.disabled = true;
        hideLsc();
      }, { once: true });
      lscVideo.load();
    }

    if (learningVideo) {
      if (learnUrl) {
        learningVideo.src = learnUrl;
        learningVideo.hidden = false;
        if (learningEmpty) learningEmpty.hidden = true;
        learningVideo.load();
      } else {
        learningVideo.hidden = true;
        if (learningEmpty) learningEmpty.hidden = false;
      }
    }

    const configuredAudioUrl = getAudioUrl();
    const configuredAudioText = getAudioText();
    if (audio && (configuredAudioUrl || configuredAudioText)) {
      if (configuredAudioUrl) audio.src = configuredAudioUrl;
      if (floatingAudio) floatingAudio.classList.remove('is-hidden');
      audio.addEventListener('timeupdate', updateAudioProgress);
      audio.addEventListener('loadedmetadata', updateAudioProgress);
      audio.addEventListener('ended', updateAudioButtons);
      audio.addEventListener('play', updateAudioButtons);
      audio.addEventListener('pause', updateAudioButtons);
    }
  }

  function bindInterface() {
    if (directButton) directButton.addEventListener('click', startExperience);
    if (toggleArButton) toggleArButton.addEventListener('click', () => engineStarted ? exitToFicha() : startExperience());
    if (anchorButton) anchorButton.addEventListener('click', () => placeModel(lastHit));
    if (reanchorButton) reanchorButton.addEventListener('click', startScanning);
    if (lscButton) lscButton.addEventListener('click', () => lscOverlay && lscOverlay.classList.contains('is-hidden') ? showLsc() : hideLsc());
    if (learnButton) learnButton.addEventListener('click', toggleLearning);
    if (closeLearningButton) closeLearningButton.addEventListener('click', hideLearning);
    if (audioPlay) audioPlay.addEventListener('click', toggleAudio);
    if (audioMute) audioMute.addEventListener('click', () => { if (audio) audio.muted = !audio.muted; });
    if (audioReplay) audioReplay.addEventListener('click', () => { if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); } });
    window.addEventListener('pagehide', stopEngine, { once: true });
  }

  async function startExperience() {
    if (engineStarted) return;
    if (directButton) directButton.disabled = true;
    updateStatus('Cargando cámara y detector de superficie…');
    try {
      await waitForEngine();
      await waitForExtras();
      if (!window.XR8 || !window.XR8.XrController || !window.XR8.Threejs) throw new Error('El navegador no pudo preparar el motor de RA.');
      canvas = document.createElement('canvas');
      canvas.id = 'ar-8th-canvas';
      canvas.setAttribute('aria-label', 'Vista de cámara de realidad aumentada');
      canvasHost.prepend(canvas);
      fitCanvasToViewport();
      window.XR8.XrController.configure({ disableWorldTracking: false, enableLighting: true, scale: 'absolute' });
      const modules = [
        window.XR8.GlTextureRenderer.pipelineModule(),
        window.XR8.Threejs.pipelineModule(),
        window.XR8.XrController.pipelineModule(),
        makeEnsenasPipelineModule()
      ];
      // Módulo oficial: ajusta la resolución real del lienzo a la cámara y evita
      // que una imagen 300×150 se estire a toda la pantalla del teléfono.
      if (window.XRExtras && window.XRExtras.FullWindowCanvas) {
        modules.splice(3, 0, window.XRExtras.FullWindowCanvas.pipelineModule());
      }
      window.XR8.addCameraPipelineModules(modules);
      // Se marca antes de run(): onStart puede ejecutarse inmediatamente.
      engineStarted = true;
      window.XR8.run({ canvas });
      directPrompt.classList.remove('is-visible');
      setButtonText(toggleArButton, 'Salir de RA');
    } catch (error) {
      console.error(error);
      updateStatus('No fue posible iniciar la cámara en este navegador.');
      showStartPrompt('No pudimos iniciar la cámara. Prueba desde Chrome o Safari actualizado, por HTTPS y acepta el permiso de cámara.');
      if (directButton) directButton.disabled = false;
    }
  }

  function waitForEngine() {
    if (window.XR8) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const check = () => {
        if (window.XR8) return resolve();
        if (Date.now() - startedAt > 20000) return reject(new Error('8th Wall tardó demasiado en cargar.'));
        window.setTimeout(check, 80);
      };
      check();
    });
  }

  // XRExtras es una mejora de tamaño, no una condición para abrir la cámara.
  // Si su CDN no responde, seguimos con el lienzo dimensionado manualmente.
  function waitForExtras() {
    if (window.XRExtras) return Promise.resolve(true);
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const check = () => {
        if (window.XRExtras || Date.now() - startedAt > 3500) return resolve(Boolean(window.XRExtras));
        window.setTimeout(check, 80);
      };
      check();
    });
  }

  function fitCanvasToViewport() {
    if (!canvas) return;
    const rect = canvasHost.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }

  function makeEnsenasPipelineModule() {
    return {
      name: 'ensenas-8thwall-adapter',
      onStart: () => {
        const xrScene = window.XR8.Threejs.xrScene();
        scene = xrScene.scene;
        camera = xrScene.camera;
        camera.position.set(0, 1.6, 0);
        window.XR8.XrController.updateCameraProjectionMatrix({ origin: camera.position, facing: camera.quaternion });
        scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.45));
        const light = new THREE.DirectionalLight(0xffffff, 1.1);
        light.position.set(2, 4, 2);
        scene.add(light);

        anchorGroup = new THREE.Group();
        anchorGroup.visible = false;
        contentGroup = new THREE.Group();
        anchorGroup.add(contentGroup);
        scene.add(anchorGroup);
        reticle = makeReticle();
        scene.add(reticle);
        loadModel();
        bindCanvasGestures();
        startScanning();
      },
      onUpdate: () => {
        if (!scanning || !reticle) return;
        const hit = hitAt(0.5, 0.58);
        if (applyHit(reticle, hit)) {
          lastHit = hit;
          reticle.visible = true;
          enablePlacement();
        } else {
          reticle.visible = false;
        }
      }
    };
  }

  function makeReticle() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.075, 44), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    const center = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24), new THREE.MeshBasicMaterial({ color: 0x8b5cf6, side: THREE.DoubleSide }));
    center.rotation.x = -Math.PI / 2;
    group.add(ring, center);
    group.visible = false;
    return group;
  }

  function loadModel() {
    const loader = new THREE.GLTFLoader();
    loader.load(modelUrl, (gltf) => {
      const model = gltf.scene;
      model.position.set(0, 0, 0);
      model.scale.set(1, 1, 1);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const normalizedScale = 1.05 / Math.max(size.x, size.y, size.z, 0.001);
      model.scale.setScalar(normalizedScale);
      model.position.set(-center.x * normalizedScale, -box.min.y * normalizedScale, -center.z * normalizedScale);
      model.traverse((item) => { if (item.isMesh) item.castShadow = true; });
      contentGroup.add(model);
      contentGroup.scale.setScalar(baseScale);
      modelReady = true;
      if (loading) loading.classList.add('is-hidden');
      updateStatus('Modelo listo. Busca una superficie para ubicarlo.');
      startScanning();
    }, undefined, () => {
      if (loading) loading.classList.add('is-hidden');
      updateStatus('El modelo no pudo cargarse. Vuelve a intentar desde la ficha.');
    });
  }

  // XR8 exige coordenadas normalizadas (0 a 1), no pixeles de pantalla.
  function hitAt(x, y) {
    try {
      const hits = window.XR8.XrController.hitTest(x, y) || [];
      return hits.find((hit) => hit && hit.position) || null;
    } catch (_) {
      return null;
    }
  }

  function hitFromClient(clientX, clientY) {
    return hitAt(clientX / window.innerWidth, clientY / window.innerHeight);
  }

  function applyHit(target, hit) {
    if (!target || !hit || !hit.position) return false;
    const p = hit.position;
    if (![p.x, p.y, p.z].every(Number.isFinite)) return false;
    target.position.set(p.x, p.y, p.z);
    if (hit.rotation && Number.isFinite(hit.rotation.w)) target.quaternion.set(hit.rotation.x, hit.rotation.y, hit.rotation.z, hit.rotation.w);
    return true;
  }

  function enablePlacement() {
    if (anchorButton && anchorButton.disabled) {
      anchorButton.disabled = false;
      const span = anchorButton.querySelector('span');
      if (span) span.textContent = 'Ubicar objeto aquí';
      updateStatus('Superficie detectada. Toca la retícula o pulsa “Ubicar objeto aquí”.');
    }
  }

  function startScanning() {
    if (!engineStarted || !modelReady) {
      updateStatus('Preparando modelo y detector de superficie…');
      return;
    }
    scanning = true;
    modelPlaced = false;
    lastHit = null;
    anchorGroup.visible = false;
    if (reticle) reticle.visible = false;
    if (scanOverlay) scanOverlay.classList.remove('is-hidden');
    if (anchorButton) {
      anchorButton.disabled = true;
      const span = anchorButton.querySelector('span');
      if (span) span.textContent = 'Busca una superficie…';
    }
    if (reanchorButton) reanchorButton.classList.add('is-hidden');
    updateStatus('Escaneando superficie: mueve el teléfono suavemente sobre una mesa o el suelo.');
  }

  function placeModel(hit) {
    if (!modelReady) return updateStatus('El modelo aún está cargando.');
    if (!applyHit(anchorGroup, hit || lastHit)) return updateStatus('Aún no hay una superficie estable. Muévete lentamente e inténtalo de nuevo.');
    scanning = false;
    modelPlaced = true;
    anchorGroup.visible = true;
    if (reticle) reticle.visible = false;
    if (scanOverlay) scanOverlay.classList.add('is-hidden');
    if (reanchorButton) reanchorButton.classList.remove('is-hidden');
    updateStatus('Objeto ubicado. Usa un dedo para rotar y dos para escalar.');
    if (lscUrl) showLsc();
  }

  function bindCanvasGestures() {
    canvas.addEventListener('pointerdown', (event) => {
      if (scanning) {
        placeModel(hitFromClient(event.clientX, event.clientY));
        return;
      }
      if (!modelPlaced) return;
      canvas.setPointerCapture(event.pointerId);
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!gesture || event.pointerId !== gesture.id || !modelPlaced) return;
      contentGroup.rotation.y += (event.clientX - gesture.x) * 0.008;
      contentGroup.rotation.x = THREE.MathUtils.clamp(contentGroup.rotation.x + (event.clientY - gesture.y) * 0.004, -0.75, 0.75);
      gesture.x = event.clientX;
      gesture.y = event.clientY;
    });
    canvas.addEventListener('pointerup', () => { gesture = null; });
    canvas.addEventListener('wheel', (event) => {
      if (!modelPlaced) return;
      event.preventDefault();
      scaleModel(event.deltaY < 0 ? 1.08 : 0.92);
    }, { passive: false });
    let pinch = null;
    canvas.addEventListener('touchstart', (event) => {
      if (!modelPlaced || event.touches.length !== 2) return;
      pinch = touchDistance(event.touches);
    }, { passive: true });
    canvas.addEventListener('touchmove', (event) => {
      if (!modelPlaced || !pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const next = touchDistance(event.touches);
      scaleModel(next / pinch);
      pinch = next;
    }, { passive: false });
    canvas.addEventListener('touchend', () => { pinch = null; }, { passive: true });
  }

  function touchDistance(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  }

  function scaleModel(factor) {
    baseScale = THREE.MathUtils.clamp(baseScale * factor, 0.08, 2.4);
    contentGroup.scale.setScalar(baseScale);
  }

  function showLsc() {
    if (!lscUrl || !lscOverlay) return;
    lscOverlay.classList.remove('is-hidden');
    if (lscButton) { lscButton.setAttribute('aria-expanded', 'true'); setButtonText(lscButton, 'Cerrar intérprete'); }
    if (lscVideo) lscVideo.play().catch(() => {});
  }

  function hideLsc() {
    if (lscOverlay) lscOverlay.classList.add('is-hidden');
    if (lscButton) { lscButton.setAttribute('aria-expanded', 'false'); setButtonText(lscButton, 'Intérprete LSC'); }
    if (lscVideo) lscVideo.pause();
  }

  function toggleLearning() {
    if (!learningPanel) return;
    const visible = !learningPanel.hidden;
    learningPanel.hidden = visible;
    if (learnButton) learnButton.setAttribute('aria-expanded', String(!visible));
    if (!visible) learningPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideLearning() {
    if (learningPanel) learningPanel.hidden = true;
    if (learnButton) learnButton.setAttribute('aria-expanded', 'false');
  }

  function toggleAudio() {
    const configuredAudioUrl = getAudioUrl();
    const configuredAudioText = getAudioText();
    if (configuredAudioUrl && audio) {
      if (audio.src !== configuredAudioUrl) audio.src = configuredAudioUrl;
      (audio.paused ? audio.play() : audio.pause()).catch(() => updateStatus('Toca nuevamente para permitir el audio.'));
      return;
    }
    if (!configuredAudioText || !('speechSynthesis' in window)) return;
    if (speech) { speechSynthesis.cancel(); speech = null; return; }
    speech = new SpeechSynthesisUtterance(configuredAudioText);
    speech.lang = 'es-CO';
    speech.onstart = () => {
      if (audioTime) audioTime.textContent = 'Lectura por voz';
      setAudioVisualState(true);
    };
    speech.onend = () => { speech = null; setAudioVisualState(false); };
    speechSynthesis.speak(speech);
  }

  function updateAudioButtons() {
    setAudioVisualState(Boolean(audio && !audio.paused));
  }

  function setAudioVisualState(playing) {
    const playIcon = audioPlay && audioPlay.querySelector('.icon-play');
    const pauseIcon = audioPlay && audioPlay.querySelector('.icon-pause');
    if (playIcon) playIcon.classList.toggle('is-hidden', playing);
    if (pauseIcon) pauseIcon.classList.toggle('is-hidden', !playing);
  }

  function getAudioUrl() {
    const current = window.CURRENT_OBJETO || {};
    return current.archivo_audio_url || current.audio_url || audioUrl;
  }

  function getAudioText() {
    const current = window.CURRENT_OBJETO || {};
    return current.explicacion_texto || current.audio_texto || audioText || current.descripcion || '';
  }

  function updateAudioProgress() {
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (audioProgress) audioProgress.style.width = duration ? `${(audio.currentTime / duration) * 100}%` : '0%';
    if (audioTime) audioTime.textContent = `${formatTime(audio.currentTime)} / ${formatTime(duration)}`;
  }

  function formatTime(seconds) {
    seconds = Math.floor(seconds || 0);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function stopEngine() {
    if (!engineStarted || !window.XR8) return;
    try { window.XR8.stop(); } catch (_) { /* la página ya está cerrándose */ }
  }

  function exitToFicha() {
    stopEngine();
    window.location.href = `objeto.html?id=${encodeURIComponent(objectId)}`;
  }
})();
