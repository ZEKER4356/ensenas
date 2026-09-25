/*
 * Piloto aislado de 8th Wall para enseñas.
 * Conserva las URLs obtenidas desde Supabase y solo sustituye el motor de cámara
 * durante esta página de prueba. No modifica el visor ni las rutas existentes.
 */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const objectId = params.get('id') || 'microbit';
  const canvas = document.getElementById('camerafeed');
  const startCard = document.getElementById('pilot-start-card');
  const startButton = document.getElementById('btn-pilot-start');
  const controls = document.getElementById('pilot-controls');
  const reanchorButton = document.getElementById('btn-pilot-reanchor');
  const learnButton = document.getElementById('btn-pilot-learn');
  const lscButton = document.getElementById('btn-pilot-lsc');
  const exitButton = document.getElementById('btn-pilot-exit');
  const standardLink = document.getElementById('pilot-standard-link');
  const status = document.getElementById('pilot-status');
  const objectName = document.getElementById('pilot-object-name');
  const hint = document.getElementById('pilot-hint');
  const lscPanel = document.getElementById('pilot-lsc');
  const lscVideo = document.getElementById('pilot-lsc-video');
  const learningPanel = document.getElementById('pilot-learning');
  const learningVideo = document.getElementById('pilot-learning-video');
  const learningEmpty = document.getElementById('pilot-learning-empty');
  const learningSteps = document.getElementById('pilot-learning-steps');
  const closeLearning = document.getElementById('btn-close-pilot-learning');
  const audioBox = document.getElementById('pilot-audio');
  const audio = document.getElementById('pilot-audio-element');
  const audioButton = document.getElementById('btn-pilot-audio');

  let currentObject = null;
  let scene, camera, renderer, anchorGroup, contentGroup, reticle;
  let engineStarted = false;
  let modelPlaced = false;
  let modelLoaded = false;
  let currentScale = 0.32;
  let touchState = null;
  let speech = null;

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  async function loadObject() {
    const remote = await window.fetchObjectByIdAsync(objectId);
    if (!remote) throw new Error('No encontramos el objeto solicitado.');
    currentObject = remote;
    if (objectName) objectName.textContent = remote.titulo || remote.nombre || objectId;
    document.title = `Piloto 8th Wall · ${remote.titulo || remote.nombre || objectId}`;

    const standardUrl = `objeto.html?id=${encodeURIComponent(remote.id)}`;
    if (standardLink) standardLink.href = standardUrl;
    if (exitButton) exitButton.href = standardUrl;

    configureAccessibleMedia(remote);
  }

  function configureAccessibleMedia(obj) {
    const lscUrl = obj.video_lsc_url || '';
    if (lscUrl) {
      lscVideo.src = lscUrl;
      lscVideo.addEventListener('loadeddata', () => {
        lscButton.disabled = false;
        lscPanel.hidden = false; // LSC se presenta por defecto cuando existe contenido.
        lscVideo.play().catch(() => {});
        lscButton.textContent = 'Cerrar intérprete';
      }, { once: true });
      lscVideo.addEventListener('error', () => {
        lscPanel.hidden = true;
        lscButton.disabled = true;
      }, { once: true });
      lscVideo.load();
    }

    const learningUrl = obj.video_aprender_lsc_url || '';
    if (learningUrl) {
      learningVideo.src = learningUrl;
      learningVideo.hidden = false;
      learningEmpty.hidden = true;
      learningVideo.load();
    }

    const steps = Array.isArray(obj.instrucciones_lsc)
      ? obj.instrucciones_lsc
      : typeof obj.instrucciones_lsc === 'string' ? obj.instrucciones_lsc.split('\n').filter(Boolean) : [];
    learningSteps.innerHTML = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');

    const audioUrl = obj.archivo_audio_url || obj.audio_url || '';
    const audioText = obj.explicacion_texto || obj.audio_texto || '';
    if (audioUrl || audioText) {
      audioBox.hidden = false;
      if (audioUrl) audio.src = audioUrl;
      audioButton.addEventListener('click', () => toggleAudio(audioUrl, audioText));
      audio.addEventListener('play', () => { audioButton.textContent = '❚❚'; }, { passive: true });
      audio.addEventListener('pause', () => { audioButton.textContent = '▶'; }, { passive: true });
      audio.addEventListener('ended', () => { audioButton.textContent = '▶'; }, { passive: true });
    }
  }

  function escapeHtml(value) {
    const span = document.createElement('span');
    span.textContent = value;
    return span.innerHTML;
  }

  function toggleAudio(audioUrl, audioText) {
    if (audioUrl) {
      if (audio.paused) audio.play().catch(() => setStatus('El navegador bloqueó el audio. Toca de nuevo para reproducirlo.'));
      else audio.pause();
      return;
    }
    if (!('speechSynthesis' in window) || !audioText) return;
    if (speech) {
      window.speechSynthesis.cancel();
      speech = null;
      audioButton.textContent = '▶';
      return;
    }
    speech = new SpeechSynthesisUtterance(audioText);
    speech.lang = 'es-CO';
    speech.onend = () => { speech = null; audioButton.textContent = '▶'; };
    audioButton.textContent = '❚❚';
    window.speechSynthesis.speak(speech);
  }

  function waitForEngine() {
    if (window.XR8) return Promise.resolve(window.XR8);
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('El motor 8th Wall tardó demasiado en cargar.')), 20000);
      window.addEventListener('xrloaded', () => {
        window.clearTimeout(timer);
        resolve(window.XR8);
      }, { once: true });
    });
  }

  function makePilotModule() {
    return {
      name: 'ensenas-8thwall-pilot',
      onStart: () => {
        const xrScene = window.XR8.Threejs.xrScene();
        scene = xrScene.scene;
        camera = xrScene.camera;
        renderer = xrScene.renderer;

        scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.25));
        const directional = new THREE.DirectionalLight(0xffffff, 1.2);
        directional.position.set(2, 4, 2);
        scene.add(directional);

        anchorGroup = new THREE.Group();
        contentGroup = new THREE.Group();
        anchorGroup.add(contentGroup);
        anchorGroup.visible = false;
        scene.add(anchorGroup);
        reticle = createReticle();
        scene.add(reticle);

        loadModelIntoScene(currentObject.modelo_3d_url);
        bindCanvasGestures();
        setStatus('Escanea una superficie y toca donde deseas ubicar el objeto.');
        if (hint) hint.hidden = false;
      },
      onUpdate: () => {
        if (!modelPlaced && reticle) updateReticle();
      }
    };
  }

  function createReticle() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.055, 0.075, 40),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24), new THREE.MeshBasicMaterial({ color: 0x8b5cf6 }));
    dot.rotation.x = -Math.PI / 2;
    group.add(dot);
    group.visible = false;
    return group;
  }

  function loadModelIntoScene(url) {
    if (!window.THREE.GLTFLoader) {
      setStatus('No se pudo preparar el cargador de modelos.');
      return;
    }
    const loader = new THREE.GLTFLoader();
    loader.load(url, (gltf) => {
      const model = gltf.scene;
      normalizeModel(model);
      contentGroup.add(model);
      modelLoaded = true;
      setStatus('Modelo listo. Mueve el teléfono para detectar una superficie.');
    }, undefined, () => {
      setStatus('El modelo no pudo cargarse en esta prueba. Puedes volver al visor actual.');
    });
  }

  function normalizeModel(model) {
    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const largestSide = Math.max(size.x, size.y, size.z) || 1;
    const scale = 1.1 / largestSide;
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    model.traverse((node) => { if (node.isMesh) node.castShadow = true; });
    contentGroup.scale.setScalar(currentScale);
  }

  function getHitAt(x, y) {
    try {
      const hits = window.XR8.XrController.hitTest(x, y);
      return Array.isArray(hits) && hits.length ? hits[0] : null;
    } catch (error) {
      return null;
    }
  }

  function applyHit(target, hit) {
    if (!hit || !target) return false;
    const position = hit.position;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) return false;
    target.position.set(position.x, position.y, position.z);
    const rotation = hit.rotation;
    if (rotation && Number.isFinite(rotation.w)) target.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    else if (rotation && Number.isFinite(rotation.x)) target.rotation.set(rotation.x, rotation.y, rotation.z);
    return true;
  }

  function updateReticle() {
    const hit = getHitAt(window.innerWidth / 2, window.innerHeight / 2);
    reticle.visible = applyHit(reticle, hit);
    if (reticle.visible) setStatus('Superficie detectada. Toca el lugar donde ubicarás el objeto.');
  }

  function placeAt(x, y) {
    if (!modelLoaded) {
      setStatus('El modelo aún se está cargando.');
      return;
    }
    const hit = getHitAt(x, y);
    if (!applyHit(anchorGroup, hit)) {
      setStatus('Aún no detectamos una superficie. Mueve el teléfono lentamente e intenta de nuevo.');
      return;
    }
    modelPlaced = true;
    anchorGroup.visible = true;
    reticle.visible = false;
    contentGroup.rotation.set(0, 0, 0);
    contentGroup.scale.setScalar(currentScale);
    reanchorButton.hidden = false;
    hint.hidden = true;
    setStatus('Objeto ubicado. Puedes rotarlo y escalarlo, sin moverlo.');
  }

  function restartPlacement() {
    modelPlaced = false;
    anchorGroup.visible = false;
    reticle.visible = false;
    reanchorButton.hidden = true;
    hint.hidden = false;
    setStatus('Busca otra superficie y toca para cambiar la ubicación.');
  }

  function bindCanvasGestures() {
    canvas.addEventListener('touchstart', (event) => {
      if (!engineStarted) return;
      if (!modelPlaced && event.touches.length === 1) {
        placeAt(event.touches[0].clientX, event.touches[0].clientY);
        return;
      }
      if (!modelPlaced) return;
      if (event.touches.length === 1) {
        touchState = { kind: 'rotate', x: event.touches[0].clientX, y: event.touches[0].clientY };
      } else if (event.touches.length === 2) {
        touchState = { kind: 'scale', distance: touchDistance(event.touches[0], event.touches[1]), scale: currentScale };
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (event) => {
      if (!modelPlaced || !touchState) return;
      if (touchState.kind === 'rotate' && event.touches.length === 1) {
        const touch = event.touches[0];
        contentGroup.rotation.y += (touch.clientX - touchState.x) * 0.012;
        contentGroup.rotation.x += (touch.clientY - touchState.y) * 0.012;
        touchState.x = touch.clientX;
        touchState.y = touch.clientY;
      } else if (touchState.kind === 'scale' && event.touches.length === 2) {
        const distance = touchDistance(event.touches[0], event.touches[1]);
        currentScale = Math.min(Math.max(touchState.scale * (distance / touchState.distance), 0.08), 5);
        contentGroup.scale.setScalar(currentScale);
      }
    }, { passive: true });
    canvas.addEventListener('touchend', () => { touchState = null; }, { passive: true });
  }

  function touchDistance(first, second) {
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY) || 1;
  }

  async function startExperience() {
    try {
      const XR8 = await waitForEngine();
      if (!XR8 || !XR8.XrDevice.isDeviceBrowserCompatible({ allowedDevices: XR8.XrConfig.device().MOBILE })) {
        throw new Error('Este navegador no es compatible con el piloto 8th Wall. Usa Chrome, Edge, Samsung Internet o Safari actualizado.');
      }
      XR8.XrController.configure({ disableWorldTracking: false, enableLighting: true, scale: 'absolute' });
      const modules = [
        XR8.GlTextureRenderer.pipelineModule(),
        XR8.Threejs.pipelineModule(),
        XR8.XrController.pipelineModule()
      ];
      if (window.LandingPage) modules.push(window.LandingPage.pipelineModule());
      if (window.XRExtras) {
        modules.push(window.XRExtras.FullWindowCanvas.pipelineModule());
        modules.push(window.XRExtras.Loading.pipelineModule());
        modules.push(window.XRExtras.RuntimeError.pipelineModule());
      }
      modules.push(makePilotModule());
      XR8.addCameraPipelineModules(modules);
      XR8.run({ canvas, allowedDevices: XR8.XrConfig.device().MOBILE });
      engineStarted = true;
      startCard.hidden = true;
      controls.hidden = false;
      setStatus('Solicitando cámara y preparando el escaneo del entorno…');
    } catch (error) {
      console.error('No se pudo iniciar el piloto 8th Wall:', error);
      setStatus(error.message || 'No se pudo iniciar la prueba.');
      startButton.disabled = false;
      startButton.textContent = 'Reintentar prueba';
    }
  }

  lscButton.addEventListener('click', () => {
    if (lscButton.disabled) return;
    lscPanel.hidden = !lscPanel.hidden;
    const visible = !lscPanel.hidden;
    lscButton.textContent = visible ? 'Cerrar intérprete' : 'Intérprete LSC';
    if (visible) lscVideo.play().catch(() => {});
    else lscVideo.pause();
  });
  learnButton.addEventListener('click', () => { learningPanel.hidden = false; });
  closeLearning.addEventListener('click', () => { learningPanel.hidden = true; learningVideo.pause(); });
  reanchorButton.addEventListener('click', restartPlacement);
  startButton.addEventListener('click', startExperience);
  window.addEventListener('pagehide', () => {
    if (window.XR8 && engineStarted && typeof window.XR8.stop === 'function') window.XR8.stop();
    if (speech && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  });

  loadObject().then(() => waitForEngine()).then(() => {
    startButton.disabled = false;
    startButton.textContent = 'Iniciar prueba de RA';
    setStatus('Modelo listo. Inicia la prueba para activar cámara y escaneo.');
  }).catch((error) => {
    console.error(error);
    startButton.textContent = 'No se pudo preparar la prueba';
    setStatus(error.message || 'No fue posible preparar el piloto.');
  });
})();
