/**
 * Plataforma enseñas - Visor de Realidad Aumentada Inclusivo (WebXR / Cámara SLAM)
 * Anclaje y Detección de Plano (Floor Tracking con Retícula),
 * Audio Explicativo Híbrido (MP3 o Web Speech API) y Overlay LSC Sincronizado.
 */

(function () {
  'use strict';

  // Referencias al DOM del Visor RA
  const sceneContainer = document.getElementById('ar-scene-container');
  const canvasHost = document.getElementById('ar-canvas-host');
  const loadingOverlay = document.getElementById('ar-loading-overlay');
  const btnToggleAr = document.getElementById('btn-toggle-ar-mode');
  const btnResetView = document.getElementById('btn-reset-view');
  const btnFlipCamera = document.getElementById('btn-flip-camera');
  const btnToggleFullscreen = document.getElementById('btn-toggle-fullscreen');
  const btnCloseArMode = document.getElementById('btn-close-ar-mode');
  const cameraVideo = document.getElementById('ar-camera-video');
  const directStartPrompt = document.getElementById('ar-direct-start-prompt');
  const btnDirectStart = document.getElementById('btn-direct-start');
  const arStatusText = document.getElementById('ar-status-text');

  // Referencias a la Detección de Plano y Retícula (Floor Tracking)
  const surfaceScanOverlay = document.getElementById('ar-surface-scan-overlay');
  const btnAnchorHere = document.getElementById('btn-anchor-here');
  const btnReanchorView = document.getElementById('btn-reanchor-view');
  const btnToggleLscOverlay = document.getElementById('btn-toggle-lsc-overlay');
  const btnOpenSignLearning = document.getElementById('btn-open-sign-learning');

  // Referencias al Audio Explicativo en RA
  const audioElement = document.getElementById('ar-audio-element');
  const floatingAudio = document.getElementById('ar-floating-audio');
  const btnArAudioPlay = document.getElementById('btn-ar-audio-play');
  const btnArAudioMute = document.getElementById('btn-ar-audio-mute');
  const btnArAudioReplay = document.getElementById('btn-ar-audio-replay');
  const arAudioProgress = document.getElementById('ar-audio-progress');
  const arAudioTime = document.getElementById('ar-audio-time');
  const arAudioWave = document.getElementById('ar-audio-wave');

  // Referencias al Overlay LSC en RA
  const lscOverlay = document.getElementById('ar-floating-lsc');
  const lscVideo = document.getElementById('ar-overlay-video-lsc');
  const lscPlaceholder = document.getElementById('lsc-overlay-placeholder');
  const lscLearningPanel = document.getElementById('lsc-steps-panel');
  const signLearningVideo = document.getElementById('sign-learning-video');
  const signLearningEmpty = document.getElementById('sign-learning-empty');
  const btnCloseSignLearning = document.getElementById('btn-close-lsc-mode');

  if (!canvasHost) return;

  // Parámetros y datos del objeto educativo
  const data = window.ENSENAS_DATA || {};
  const objectId = data.objectId || 'microbit';
  const objectName = data.objectName || 'Objeto Educativo';
  const modelUrl = data.modelUrl || `assets/models/${objectId}.glb`;
  const audioUrl = data.audioUrl || '';
  const audioTexto = data.audioTexto || '';
  const videoLscUrl = data.videoLscUrl || '';

  // Variables Three.js y estado de la experiencia
  let scene, camera, renderer, objectGroup, modelRoot, groundShadow;
  let reticleGroup, reticleOuterRing, reticleInnerRing, reticleDots = [];
  let isArMode = false;
  let isFullscreen = false;
  let currentFacingMode = 'environment'; // Cámara trasera por defecto
  let mediaStream = null;
  let xrSession = null;
  let xrHitTestSource = null;
  let xrReferenceSpace = null;
  let xrViewerSpace = null;
  let isWebXrAr = false;
  let hasSurfaceHit = false;
  let activeVideoLsc = '';

  // Estados de escaneo y anclaje (Floor Tracking)
  let isScanningSurface = false;
  let isAnchored = false;
  let scanningTime = 0;
  let speechSynthActive = false;
  let speechSynthUtterance = null;

  // Variables de gestos táctiles (Pinch, Drag & Rotate)
  let isPointerDown = false;
  let isDraggingTwoFingers = false;
  let previousPointerPos = { x: 0, y: 0 };
  let initialTouchDist = null;
  let initialScale = 1;
  let touchStartPosTwo = { x: 0, y: 0 };
  let lastTapTime = 0;

  // Inicializar componentes
  initThreeScene();
  setupAudioController();
  setupLscOverlay();
  setupSignLearning();
  showMultimediaControls();
  setupFloorTrackingUI();
  setupArDirectFlow();

  /* ========================================================================
     1. Inicialización de la Escena 3D (Three.js) y Retícula de Anclaje
     ======================================================================== */
  function initThreeScene() {
    scene = new THREE.Scene();

    const width = canvasHost.clientWidth || window.innerWidth;
    const height = canvasHost.clientHeight || 420;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3.2);
    camera.lookAt(0, 0, 0);

    // Renderizador WebGL con transparencia alpha para ver la cámara de fondo
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    canvasHost.appendChild(renderer.domElement);

    // Iluminación realista para AR
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight1.position.set(4, 8, 5);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa78bfa, 0.5);
    dirLight2.position.set(-4, -2, -3);
    scene.add(dirLight2);

    // Grupo contenedor del objeto 3D para interacción táctil
    objectGroup = new THREE.Group();
    scene.add(objectGroup);

    // Sombra de contacto en el piso
    createContactShadow();

    // Rejilla de referencia 3D
    const grid = new THREE.GridHelper(8, 16, 0x7c3aed, 0x334155);
    grid.position.y = -0.75;
    grid.name = 'ar-reference-grid';
    scene.add(grid);

    // Crear la retícula visual de detección de plano (Floor Tracking)
    createFloorReticle();

    // Cargar modelo 3D
    loadModel(modelUrl);

    // Gestos táctiles
    setupGestureControls();

    // Bucle de animación
    renderer.setAnimationLoop(renderFrame);

    // Redimensionamiento
    window.addEventListener('resize', onWindowResize);
  }

  /**
   * Construye la retícula visual tridimensional con anillos pulsantes
   * y cuadrícula de puntos para representar el escaneo de plano en el suelo
   */
  function createFloorReticle() {
    reticleGroup = new THREE.Group();
    reticleGroup.position.set(0, -0.74, 0);

    // Anillo interior verde esmeralda
    const innerRingGeo = new THREE.RingGeometry(0.24, 0.28, 48);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    reticleInnerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    reticleInnerRing.rotation.x = -Math.PI / 2;
    reticleGroup.add(reticleInnerRing);

    // Anillo exterior pulsante
    const outerRingGeo = new THREE.RingGeometry(0.40, 0.43, 48);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    reticleOuterRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    reticleOuterRing.rotation.x = -Math.PI / 2;
    reticleGroup.add(reticleOuterRing);

    // Cruz central de mira / target
    const crossMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const crossGeoH = new THREE.PlaneGeometry(0.18, 0.02);
    const crossH = new THREE.Mesh(crossGeoH, crossMat);
    crossH.rotation.x = -Math.PI / 2;
    const crossV = crossH.clone();
    crossV.rotation.z = Math.PI / 2;
    reticleGroup.add(crossH, crossV);

    // Puntos de escaneo de plano (simulan nube de puntos SLAM)
    const dotGeo = new THREE.CircleGeometry(0.015, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });

    reticleDots = [];
    const radiuses = [0.15, 0.32, 0.55];
    radiuses.forEach((rad, rIdx) => {
      const count = 6 + rIdx * 4;
      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count;
        const dot = new THREE.Mesh(dotGeo, dotMat.clone());
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(Math.cos(angle) * rad, 0, Math.sin(angle) * rad);
        reticleGroup.add(dot);
        reticleDots.push({ mesh: dot, phase: i * 0.4 + rIdx });
      }
    });

    reticleGroup.visible = false;
    scene.add(reticleGroup);
  }

  function createContactShadow() {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.18)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(2.4, 2.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false
    });
    groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.y = -0.74;
    scene.add(groundShadow);
  }

  /* ========================================================================
     2. Carga y Normalización del Modelo 3D (GLTF/GLB)
     ======================================================================== */
  function loadModel(url) {
    if (typeof THREE.GLTFLoader !== 'undefined') {
      const loader = new THREE.GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          modelRoot = gltf.scene;
          normalizeAndAddModel(modelRoot);
          hideLoading();
        },
        null,
        (err) => {
          console.error('No se pudo cargar el modelo 3D:', err);
          showModelLoadError();
        }
      );
    } else {
      console.error('GLTFLoader no está disponible.');
      showModelLoadError();
    }
  }

  function normalizeAndAddModel(model) {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z);

    let scale = 1.0;
    if (maxAxis > 0) {
      // En la vista previa móvil, un objetivo más contenido evita que un modelo
      // correcto parezca "estirado" o invada toda la pantalla vertical.
      scale = 1.25 / maxAxis;
      model.scale.set(scale, scale, scale);
    }

    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    const halfHeight = (size.y * scale) / 2;
    if (groundShadow) {
      groundShadow.position.set(0, -halfHeight - 0.02, 0);
    }
    if (reticleGroup) {
      reticleGroup.position.set(0, -halfHeight - 0.02, 0);
    }
    const grid = scene ? scene.getObjectByName('ar-reference-grid') : null;
    if (grid) {
      grid.position.y = -halfHeight - 0.03;
    }

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    objectGroup.add(model);
  }

  function createProceduralModel(type) {
    const group = new THREE.Group();

    if (type === 'microbit') {
      const pcbGeo = new THREE.BoxGeometry(2.0, 1.6, 0.08);
      const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.2 });
      const pcb = new THREE.Mesh(pcbGeo, pcbMat);
      group.add(pcb);

      const pinGeo = new THREE.BoxGeometry(1.9, 0.25, 0.09);
      const pinMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.15 });
      const pins = new THREE.Mesh(pinGeo, pinMat);
      pins.position.y = -0.68;
      group.add(pins);

      const ledMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 0.8
      });
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const ledGeo = new THREE.BoxGeometry(0.08, 0.08, 0.1);
          const led = new THREE.Mesh(ledGeo, ledMat);
          led.position.set(-0.36 + c * 0.18, 0.36 - r * 0.18, 0.05);
          group.add(led);
        }
      }

      const btnGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 20);
      const btnMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.3, metalness: 0.3 });
      const btnA = new THREE.Mesh(btnGeo, btnMat);
      btnA.rotation.x = Math.PI / 2;
      btnA.position.set(-0.7, 0, 0.05);
      const btnB = btnA.clone();
      btnB.position.set(0.7, 0, 0.05);
      group.add(btnA, btnB);

      const chipGeo = new THREE.BoxGeometry(0.45, 0.45, 0.06);
      const chipMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
      const chip = new THREE.Mesh(chipGeo, chipMat);
      chip.position.set(0, -0.15, 0.05);
      group.add(chip);

    } else if (type === 'telescopio') {
      const tubeGeo = new THREE.CylinderGeometry(0.2, 0.28, 2.2, 32);
      const tubeMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.6, roughness: 0.25 });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.rotation.z = Math.PI / 4;
      tube.position.y = 0.3;
      group.add(tube);

      const ringGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.08, 32);
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
      const ring1 = new THREE.Mesh(ringGeo, goldMat);
      ring1.rotation.z = Math.PI / 4;
      ring1.position.set(-0.6, 0.9, 0);
      group.add(ring1);

      const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 12);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7 });
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Mesh(legGeo, legMat);
        const angle = (i * Math.PI * 2) / 3;
        leg.position.set(Math.cos(angle) * 0.4, -0.75, Math.sin(angle) * 0.4);
        leg.rotation.z = Math.cos(angle) * 0.3;
        leg.rotation.x = Math.sin(angle) * 0.3;
        group.add(leg);
      }

    } else {
      const baseGeo = new THREE.BoxGeometry(1.2, 0.16, 1.2);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = -0.7;
      group.add(base);

      const armGeo = new THREE.CylinderGeometry(0.12, 0.15, 1.3, 20);
      const armMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: 0.4, roughness: 0.3 });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(-0.35, 0, 0);
      group.add(arm);

      const stageGeo = new THREE.BoxGeometry(0.9, 0.06, 0.9);
      const stageMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7 });
      const stage = new THREE.Mesh(stageGeo, stageMat);
      stage.position.set(0.1, -0.15, 0);
      group.add(stage);

      const tubeGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.85, 24);
      const tubeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.position.set(0.1, 0.35, 0);
      tube.rotation.z = -0.3;
      group.add(tube);
    }

    modelRoot = group;
    normalizeAndAddModel(modelRoot);
  }

  function hideLoading() {
    if (loadingOverlay) {
      loadingOverlay.classList.add('fade-out');
      setTimeout(() => {
        if (loadingOverlay.parentNode) loadingOverlay.style.display = 'none';
      }, 350);
    }
  }

  function showModelLoadError() {
    if (arStatusText) arStatusText.textContent = 'No se pudo cargar el modelo 3D';
    if (loadingOverlay) {
      loadingOverlay.classList.remove('fade-out');
      loadingOverlay.style.display = 'flex';
      loadingOverlay.innerHTML = '<div class="ar-model-error"><strong>No se pudo cargar este modelo.</strong><p>Vuelve al panel Admin y súbelo de nuevo. Si es un archivo .gltf, selecciónalo junto con su archivo .bin y sus texturas.</p></div>';
    }
  }

  /* ========================================================================
     3. Anclaje y Detección de Plano (Floor Tracking)
     - Desactiva aparición flotante sin referencia
     - Flujo previo de escaneo con retícula visual
     - Anclaje al piso mediante botón o toque en pantalla
     ======================================================================== */
  function setupFloorTrackingUI() {
    // Botón de confirmar anclaje en el banner
    if (btnAnchorHere) {
      btnAnchorHere.addEventListener('click', confirmObjectAnchor);
    }

    // Botones de re-anclar
    if (btnReanchorView) {
      btnReanchorView.addEventListener('click', startSurfaceScanning);
    }
    // El intérprete es una ayuda independiente: solo se abre a petición de la persona.
    if (btnToggleLscOverlay) {
      btnToggleLscOverlay.addEventListener('click', () => {
        if (!lscOverlay || !activeVideoLsc) return;
        setInterpreterVisibility(lscOverlay.classList.contains('is-hidden'));
      });
    }
  }

  /**
   * Inicia el estado de escaneo de superficie (oculta el objeto 3D flotante)
   */
  function startSurfaceScanning() {
    isScanningSurface = true;
    isAnchored = false;
    hasSurfaceHit = false;

    // Desactivar aparición del objeto flotante
    if (objectGroup) objectGroup.visible = false;
    if (groundShadow) groundShadow.visible = false;

    // Activar retícula y panel de escaneo
    if (reticleGroup) reticleGroup.visible = !isWebXrAr;
    if (surfaceScanOverlay) surfaceScanOverlay.classList.remove('is-hidden');
    if (btnReanchorView) btnReanchorView.classList.add('is-hidden');
    setAnchorActionAvailability(!isWebXrAr);
    setInterpreterVisibility(false);

    if (arStatusText) {
      arStatusText.textContent = isWebXrAr
        ? 'Busca una mesa o el suelo'
        : 'Vista 3D manual: este navegador no dispone de detección WebXR';
    }
  }

  /**
   * Confirma la posición y ancla el objeto 3D en el plano detectado
   */
  function confirmObjectAnchor() {
    if (!isScanningSurface && isAnchored) return;
    if (isWebXrAr && !hasSurfaceHit) return;

    isScanningSurface = false;
    isAnchored = true;

    // Ocultar retícula y banner de escaneo
    if (reticleGroup) reticleGroup.visible = false;
    if (surfaceScanOverlay) surfaceScanOverlay.classList.add('is-hidden');

    // Ubicar objeto exactamente sobre la retícula
    if (objectGroup && reticleGroup) {
      // La pose de la retícula procede del hit-test WebXR; se copia completa para
      // conservar posición y orientación del plano físico detectado.
      objectGroup.position.copy(reticleGroup.position);
      objectGroup.quaternion.copy(reticleGroup.quaternion);
      if (groundShadow) {
        groundShadow.position.copy(reticleGroup.position);
        groundShadow.quaternion.copy(reticleGroup.quaternion);
        groundShadow.visible = true;
      }

      // Animación suave de aparición y anclaje
      objectGroup.visible = true;
      // Three.js usa metros en WebXR. Un modelo normalizado para la vista 3D
      // sería enorme en el mundo real, por eso se presenta a escala de mesa.
      const targetArScale = isWebXrAr ? 0.32 : 1;
      let s = isWebXrAr ? 0.03 : 0.1;
      objectGroup.scale.set(s, s, s);
      const scaleInterval = setInterval(() => {
        s += targetArScale / 7;
        if (s >= targetArScale) {
          s = targetArScale;
          clearInterval(scaleInterval);
        }
        objectGroup.scale.set(s, s, s);
      }, 20);
    }

    // Mostrar botones de re-anclar
    if (btnReanchorView) btnReanchorView.classList.remove('is-hidden');

    if (arStatusText) {
      arStatusText.textContent = isWebXrAr ? 'Objeto ubicado' : 'Objeto ubicado manualmente';
    }

    showMultimediaControls();
  }

  function setAnchorActionAvailability(canAnchor) {
    if (!btnAnchorHere) return;
    btnAnchorHere.disabled = !canAnchor;
    const textSpan = btnAnchorHere.querySelector('span');
    if (textSpan) {
      textSpan.textContent = canAnchor
        ? (isWebXrAr ? 'Ubicar objeto aquí' : 'Ubicar objeto manualmente')
        : 'Busca una superficie...';
    }
  }

  /* ========================================================================
     4. Gestos Multitáctiles y Control Táctil
     ======================================================================== */
  function setupGestureControls() {
    const el = renderer.domElement;

    // Toque en pantalla para anclar si estamos en modo escaneo
    el.addEventListener('click', (e) => {
      if (isArMode && isScanningSurface && (!isWebXrAr || hasSurfaceHit)) {
        confirmObjectAnchor();
      }
    });

    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isPointerDown = true;
        previousPointerPos = { x: e.clientX, y: e.clientY };
      } else if (e.button === 2) {
        isDraggingTwoFingers = true;
        touchStartPosTwo = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isPointerDown && objectGroup && objectGroup.visible) {
        const deltaX = e.clientX - previousPointerPos.x;
        const deltaY = e.clientY - previousPointerPos.y;
        objectGroup.rotation.y += deltaX * 0.01;
        objectGroup.rotation.x += deltaY * 0.01;
        previousPointerPos = { x: e.clientX, y: e.clientY };
      } else if (isDraggingTwoFingers && objectGroup && objectGroup.visible) {
        const deltaX = e.clientX - touchStartPosTwo.x;
        const deltaY = e.clientY - touchStartPosTwo.y;
        objectGroup.position.x += deltaX * 0.003;
        objectGroup.position.y -= deltaY * 0.003;
        if (groundShadow) groundShadow.position.x = objectGroup.position.x;
        touchStartPosTwo = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', () => {
      isPointerDown = false;
      isDraggingTwoFingers = false;
    });

    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!objectGroup || !objectGroup.visible) return;
      const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
      const newScale = objectGroup.scale.x * zoomFactor;
      if (newScale >= 0.25 && newScale <= 3.8) {
        objectGroup.scale.set(newScale, newScale, newScale);
      }
    }, { passive: false });

    // Móvil / Pantallas táctiles
    el.addEventListener('touchstart', (e) => {
      const now = Date.now();
      if (e.touches.length === 1) {
        if (isArMode && isScanningSurface && (!isWebXrAr || hasSurfaceHit)) {
          confirmObjectAnchor();
          return;
        }

        if (now - lastTapTime < 300) {
          reset3DView();
        }
        lastTapTime = now;

        isPointerDown = true;
        isDraggingTwoFingers = false;
        previousPointerPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        isPointerDown = false;
        isDraggingTwoFingers = true;
        initialTouchDist = getTouchDist(e.touches[0], e.touches[1]);
        initialScale = objectGroup ? objectGroup.scale.x : 1;
        touchStartPosTwo = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
      }
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && isPointerDown && objectGroup && objectGroup.visible) {
        const deltaX = e.touches[0].clientX - previousPointerPos.x;
        const deltaY = e.touches[0].clientY - previousPointerPos.y;

        objectGroup.rotation.y += deltaX * 0.012;
        objectGroup.rotation.x += deltaY * 0.012;
        previousPointerPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && objectGroup && objectGroup.visible) {
        const currentDist = getTouchDist(e.touches[0], e.touches[1]);
        if (initialTouchDist && currentDist > 0) {
          const scaleMultiplier = currentDist / initialTouchDist;
          const newScale = Math.min(Math.max(initialScale * scaleMultiplier, 0.3), 3.8);
          objectGroup.scale.set(newScale, newScale, newScale);
        }

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const deltaX = midX - touchStartPosTwo.x;
        const deltaY = midY - touchStartPosTwo.y;

        objectGroup.position.x += deltaX * 0.004;
        objectGroup.position.y -= deltaY * 0.004;
        if (groundShadow) groundShadow.position.x = objectGroup.position.x;
        touchStartPosTwo = { x: midX, y: midY };
      }
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        initialTouchDist = null;
        isDraggingTwoFingers = false;
      }
      if (e.touches.length === 0) {
        isPointerDown = false;
      }
    });
  }

  function getTouchDist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function reset3DView() {
    if (!objectGroup) return;
    objectGroup.rotation.set(0, 0, 0);
    objectGroup.position.set(0, 0, 0);
    objectGroup.scale.set(1, 1, 1);
    if (camera) {
      camera.position.set(0, 0, 3.2);
      camera.lookAt(0, 0, 0);
    }
    if (groundShadow) {
      groundShadow.position.x = 0;
      groundShadow.position.z = 0;
    }
  }

  if (btnResetView) btnResetView.addEventListener('click', reset3DView);

  /* ========================================================================
     5. Motor de Cámara en Realidad Aumentada (SLAM Passthrough)
     ======================================================================== */
  async function startArMode() {
    try {
      if (navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')) {
        await startWebXrSession();
        return;
      }

      // Alternativa sin WebXR: cámara de fondo y controles manuales, sin afirmar
      // detección real de superficies.
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador o dispositivo no soporta acceso a cámara en tiempo real.');
        return;
      }

      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          facingMode: { ideal: currentFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (cameraVideo) {
        cameraVideo.srcObject = mediaStream;
        cameraVideo.setAttribute('playsinline', 'true');
        cameraVideo.setAttribute('muted', 'true');
        await cameraVideo.play();
        cameraVideo.classList.add('is-active');
      }

      isArMode = true;
      sceneContainer.classList.add('ar-mode-active');
      sceneContainer.classList.add('ar-immersive');
      document.body.classList.add('ar-active-body');

      const grid = scene.getObjectByName('ar-reference-grid');
      if (grid) grid.visible = false;

      if (btnToggleAr) {
        const textSpan = btnToggleAr.querySelector('.btn-text');
        if (textSpan) textSpan.textContent = 'Salir de RA';
      }

      // Iniciar inmediatamente el escaneo de superficie (desactiva objeto flotante)
      startSurfaceScanning();

      onWindowResize();

    } catch (err) {
      console.error('Error al iniciar la cámara en RA:', err);
      alert('Para experimentar la Realidad Aumentada en tu entorno, por favor concede permisos de acceso a la cámara.');
    }
  }

  async function startWebXrSession() {
    xrSession = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: sceneContainer }
    });
    isWebXrAr = true;
    xrSession.addEventListener('end', endWebXrSession);
    await renderer.xr.setSession(xrSession);
    xrViewerSpace = await xrSession.requestReferenceSpace('viewer');
    xrReferenceSpace = await xrSession.requestReferenceSpace('local');
    xrHitTestSource = await xrSession.requestHitTestSource({ space: xrViewerSpace });

    isArMode = true;
    sceneContainer.classList.add('ar-mode-active');
    sceneContainer.classList.add('ar-immersive');
    document.body.classList.add('ar-active-body');
    const grid = scene.getObjectByName('ar-reference-grid');
    if (grid) grid.visible = false;
    if (btnToggleAr) {
      const textSpan = btnToggleAr.querySelector('.btn-text');
      if (textSpan) textSpan.textContent = 'Salir de RA';
    }
    startSurfaceScanning();
  }

  function endWebXrSession() {
    if (xrHitTestSource) xrHitTestSource.cancel();
    xrSession = null;
    xrHitTestSource = null;
    xrViewerSpace = null;
    xrReferenceSpace = null;
    isWebXrAr = false;
    if (isArMode) stopArMode();
  }

  function stopArMode() {
    if (xrSession) {
      const session = xrSession;
      xrSession = null;
      session.end().catch(() => {});
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
      cameraVideo.classList.remove('is-active');
    }

    isArMode = false;
    isScanningSurface = false;
    isAnchored = false;

    sceneContainer.classList.remove('ar-mode-active');
    sceneContainer.classList.remove('ar-immersive');
    document.body.classList.remove('ar-active-body');

    // Restaurar objeto para vista normal 3D
    if (objectGroup) objectGroup.visible = true;
    if (objectGroup) {
      objectGroup.position.set(0, 0, 0);
      objectGroup.quaternion.identity();
      objectGroup.scale.set(1, 1, 1);
    }
    if (groundShadow) groundShadow.visible = true;
    if (reticleGroup) reticleGroup.visible = false;
    if (surfaceScanOverlay) surfaceScanOverlay.classList.add('is-hidden');
    setInterpreterVisibility(false);
    if (btnReanchorView) btnReanchorView.classList.add('is-hidden');

    const grid = scene.getObjectByName('ar-reference-grid');
    if (grid) grid.visible = true;

    if (btnToggleAr) {
      const textSpan = btnToggleAr.querySelector('.btn-text');
      if (textSpan) textSpan.textContent = 'Ver en mi entorno (RA)';
    }

    pauseExplanationAudio();
    onWindowResize();
  }

  if (btnToggleAr) {
    btnToggleAr.addEventListener('click', () => {
      if (!isArMode) {
        startArMode();
      } else {
        stopArMode();
      }
    });
  }

  if (btnFlipCamera) {
    btnFlipCamera.addEventListener('click', () => {
      currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
      if (isArMode) {
        startArMode();
      }
    });
  }

  if (btnToggleFullscreen) {
    btnToggleFullscreen.addEventListener('click', toggleImmersiveFullscreen);
  }

  function toggleImmersiveFullscreen() {
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
      sceneContainer.classList.add('ar-immersive');
      if (sceneContainer.requestFullscreen) {
        sceneContainer.requestFullscreen().catch(() => {});
      }
    } else {
      sceneContainer.classList.remove('ar-immersive');
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
    setTimeout(onWindowResize, 150);
  }

  if (btnCloseArMode) {
    btnCloseArMode.addEventListener('click', () => {
      if (isFullscreen) toggleImmersiveFullscreen();
      stopArMode();
      sceneContainer.scrollIntoView({ behavior: 'smooth' });
    });
  }

  /* ========================================================================
     6. Flujo de Acceso Directo por Escaneo de Código QR
     ======================================================================== */
  function setupArDirectFlow() {
    const params = new URLSearchParams(window.location.search);
    const isDirectAr = params.get('ar') === 'true' || params.get('ar') === '1' || params.get('direct') === '1';

    if (isDirectAr) {
      sceneContainer.classList.add('ar-immersive');
      sceneContainer.classList.add('ar-direct-open');

      if (directStartPrompt) {
        directStartPrompt.classList.add('is-visible');
      }

      if (btnDirectStart) {
        btnDirectStart.addEventListener('click', async () => {
          if (directStartPrompt) directStartPrompt.classList.remove('is-visible');
          await startArMode();
        }, { once: true });
      }

      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'camera' }).then((res) => {
          if (res.state === 'granted') {
            if (directStartPrompt) directStartPrompt.classList.remove('is-visible');
            startArMode();
          }
        }).catch(() => {});
      }
    }
  }

  /* ========================================================================
     7. Audio Explicativo Híbrido (MP3 con Fallback a Web Speech API)
     - Si el objeto tiene archivo_audio en BD, reproduce MP3.
     - De lo contrario, lee explicacion_texto mediante Web Speech API.
     ======================================================================== */
  function setupAudioController() {
    if (!audioElement) return;

    if (btnArAudioPlay) {
      btnArAudioPlay.addEventListener('click', () => {
        if (!audioElement.paused || speechSynthActive) {
          pauseExplanationAudio();
        } else {
          playExplanationAudio();
        }
      });
    }

    if (btnArAudioMute) {
      btnArAudioMute.addEventListener('click', () => {
        audioElement.muted = !audioElement.muted;
        const isMuted = audioElement.muted;
        btnArAudioMute.classList.toggle('is-muted', isMuted);
        btnArAudioMute.setAttribute('aria-label', isMuted ? 'Activar sonido de audio' : 'Silenciar audio');

        if ('speechSynthesis' in window && speechSynthActive) {
          if (isMuted) {
            window.speechSynthesis.pause();
          } else {
            window.speechSynthesis.resume();
          }
        }
      });
    }

    if (btnArAudioReplay) {
      btnArAudioReplay.addEventListener('click', () => {
        audioElement.currentTime = 0;
        playExplanationAudio();
      });
    }

    audioElement.addEventListener('timeupdate', () => {
      const current = audioElement.currentTime;
      const duration = audioElement.duration || 1;
      if (arAudioProgress) {
        arAudioProgress.style.width = `${(current / duration) * 100}%`;
      }
      if (arAudioTime) {
        arAudioTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
      }

      // Sincronizar video de overlay LSC
      if (lscVideo && Math.abs(lscVideo.currentTime - current) > 0.4) {
        lscVideo.currentTime = current;
      }
    });

    audioElement.addEventListener('ended', () => {
      pauseExplanationAudio();
      if (arAudioProgress) arAudioProgress.style.width = '100%';
    });
  }

  /**
   * Lógica condicional de reproducción de explicación
   */
  function playExplanationAudio() {
    const curObj = window.CURRENT_OBJETO || {};
    const targetAudio = curObj.archivo_audio_url || curObj.audio_url || audioUrl;
    const targetText = curObj.explicacion_texto || curObj.audio_texto || audioTexto;

    const hasAudioFile = targetAudio && targetAudio.trim() !== '';

    if (hasAudioFile) {
      audioElement.src = targetAudio;
      audioElement.play().then(() => {
        updateAudioVisualState(true);
        if (lscVideo && lscVideo.paused) lscVideo.play().catch(() => {});
      }).catch((e) => {
        console.warn('Reproducción MP3 falló o bloqueada, utilizando Web Speech API:', e);
        speakExplanationWithTTS(targetText);
      });
    } else if (targetText) {
      speakExplanationWithTTS(targetText);
    }
  }

  /**
   * Lectura por voz sintética con Web Speech API
   */
  function speakExplanationWithTTS(text) {
    if (!('speechSynthesis' in window) || !text) return;

    window.speechSynthesis.cancel();
    speechSynthUtterance = new SpeechSynthesisUtterance(text);
    speechSynthUtterance.lang = 'es-CO';
    speechSynthUtterance.rate = 0.95;

    // Buscar voz en español óptima
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith('es-CO') || v.lang.startsWith('es-419') || v.lang.startsWith('es'));
    if (esVoice) speechSynthUtterance.voice = esVoice;

    speechSynthUtterance.onstart = () => {
      speechSynthActive = true;
      updateAudioVisualState(true);
      if (lscVideo && lscVideo.paused) lscVideo.play().catch(() => {});
      if (arAudioTime) arAudioTime.textContent = 'Lectura por Voz TTS';
    };

    speechSynthUtterance.onend = () => {
      speechSynthActive = false;
      updateAudioVisualState(false);
      if (arAudioProgress) arAudioProgress.style.width = '100%';
    };

    speechSynthUtterance.onerror = () => {
      speechSynthActive = false;
      updateAudioVisualState(false);
    };

    window.speechSynthesis.speak(speechSynthUtterance);
  }

  function pauseExplanationAudio() {
    if (audioElement) audioElement.pause();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
      window.speechSynthesis.cancel();
    }
    speechSynthActive = false;
    updateAudioVisualState(false);
    if (lscVideo && !lscVideo.paused) lscVideo.pause();
  }

  function updateAudioVisualState(isPlaying) {
    if (btnArAudioPlay) {
      btnArAudioPlay.classList.toggle('is-playing', isPlaying);
      const iconPlay = btnArAudioPlay.querySelector('.icon-play');
      const iconPause = btnArAudioPlay.querySelector('.icon-pause');
      if (iconPlay && iconPause) {
        iconPlay.classList.toggle('is-hidden', isPlaying);
        iconPause.classList.toggle('is-hidden', !isPlaying);
      }
    }
    if (arAudioWave) {
      arAudioWave.classList.toggle('is-animating', isPlaying);
    }
  }

  function formatTime(sec) {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  /* ========================================================================
     8. Overlay Flotante de Video en Lengua de Señas Colombiana (LSC)
     ======================================================================== */
  function setupLscOverlay() {
    if (!lscOverlay) return;

    const curObj = window.CURRENT_OBJETO || {};
    activeVideoLsc = curObj.video_lsc_url || videoLscUrl;
    if (lscVideo && activeVideoLsc) {
      lscVideo.src = activeVideoLsc;
      lscVideo.load();
      lscVideo.addEventListener('loadeddata', () => {
        if (lscPlaceholder) lscPlaceholder.classList.add('is-hidden');
      }, { once: true });
      lscVideo.addEventListener('error', () => {
        activeVideoLsc = '';
        if (lscPlaceholder) lscPlaceholder.classList.remove('is-hidden');
        setInterpreterVisibility(false);
        updateLscAvailability();
      }, { once: true });
    }
    updateLscAvailability();
  }

  function updateLscAvailability() {
    if (!btnToggleLscOverlay) return;
    btnToggleLscOverlay.disabled = !activeVideoLsc;
    btnToggleLscOverlay.title = activeVideoLsc
      ? 'Abrir intérprete LSC'
      : 'Este objeto aún no tiene video de intérprete LSC.';
  }

  function setupSignLearning() {
    if (signLearningVideo && activeVideoLsc) {
      signLearningVideo.src = activeVideoLsc;
      signLearningVideo.load();
    }
    if (signLearningEmpty) signLearningEmpty.hidden = Boolean(activeVideoLsc);

    if (btnOpenSignLearning) {
      btnOpenSignLearning.addEventListener('click', openSignLearning);
    }
    if (btnCloseSignLearning) {
      btnCloseSignLearning.addEventListener('click', closeSignLearning);
    }
  }

  function openSignLearning() {
    if (!lscLearningPanel) return;
    lscLearningPanel.hidden = false;
    if (btnOpenSignLearning) btnOpenSignLearning.setAttribute('aria-expanded', 'true');
    if (signLearningVideo && activeVideoLsc) {
      signLearningVideo.currentTime = 0;
      signLearningVideo.play().catch(() => {});
    }
    lscLearningPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeSignLearning() {
    if (!lscLearningPanel) return;
    if (signLearningVideo) signLearningVideo.pause();
    lscLearningPanel.hidden = true;
    if (btnOpenSignLearning) {
      btnOpenSignLearning.setAttribute('aria-expanded', 'false');
      btnOpenSignLearning.focus();
    }
  }

  function setInterpreterVisibility(shouldShow) {
    if (!lscOverlay) return;
    lscOverlay.classList.toggle('is-hidden', !shouldShow);
    if (btnToggleLscOverlay) {
      btnToggleLscOverlay.classList.toggle('is-active-overlay', shouldShow);
      btnToggleLscOverlay.setAttribute('aria-expanded', String(shouldShow));
      const textSpan = btnToggleLscOverlay.querySelector('.btn-text');
      if (textSpan) textSpan.textContent = shouldShow ? 'Cerrar intérprete' : 'Intérprete LSC';
    }
    if (lscVideo) {
      if (shouldShow && activeVideoLsc) lscVideo.play().catch(() => {});
      if (!shouldShow) lscVideo.pause();
    }
  }

  function showMultimediaControls() {
    // Solo se muestra audio cuando el objeto tiene una explicación configurada.
    const curObj = window.CURRENT_OBJETO || {};
    const targetAudio = curObj.archivo_audio_url || curObj.audio_url || audioUrl;
    const targetText = curObj.explicacion_texto || curObj.audio_texto || audioTexto;
    if (floatingAudio) floatingAudio.classList.toggle('is-hidden', !(targetAudio || targetText));
    // LSC se habilita por defecto cuando hay un video real. Quien no lo necesite
    // puede cerrarlo con el mismo botón, pero nunca se muestra un recuadro vacío.
    if (activeVideoLsc) setInterpreterVisibility(true);
  }

  /* ========================================================================
     9. Bucle de Renderizado y Animaciones de Escaneo
     ======================================================================== */
  function onWindowResize() {
    if (!canvasHost || !camera || !renderer) return;

    let width = canvasHost.clientWidth;
    let height = canvasHost.clientHeight;

    if (isFullscreen || sceneContainer.classList.contains('ar-immersive')) {
      width = window.innerWidth;
      height = window.innerHeight;
    }

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
    renderer.setSize(width, height);
  }

  function renderFrame(time, frame) {

    scanningTime += 0.04;

    // Actualiza la retícula con un hit-test de WebXR sobre una superficie real.
    if (isWebXrAr && frame && xrHitTestSource && xrReferenceSpace) {
      const hit = frame.getHitTestResults(xrHitTestSource)[0];
      if (hit) {
        const pose = hit.getPose(xrReferenceSpace);
        if (pose && reticleGroup) {
          hasSurfaceHit = true;
          setAnchorActionAvailability(true);
          reticleGroup.visible = isScanningSurface;
          reticleGroup.matrix.fromArray(pose.transform.matrix);
          reticleGroup.matrix.decompose(reticleGroup.position, reticleGroup.quaternion, reticleGroup.scale);
        }
      }
    }

    // Animación de apoyo solo para el estado visual de escaneo en modo alternativo.
    if (isArMode && isScanningSurface && reticleGroup && reticleGroup.visible) {
      // Pulso suave del anillo exterior
      const pulseScale = 1.0 + Math.sin(scanningTime * 2.5) * 0.12;
      reticleOuterRing.scale.set(pulseScale, pulseScale, 1);
      reticleInnerRing.rotation.z += 0.015;

      // Animación de puntos de calibración
      reticleDots.forEach((item) => {
        const dotAlpha = 0.3 + 0.5 * Math.sin(scanningTime * 3 + item.phase);
        item.mesh.material.opacity = Math.max(0.1, dotAlpha);
      });

      if (!isWebXrAr) reticleGroup.position.x = Math.sin(scanningTime * 0.8) * 0.15;
    }

    renderer.render(scene, camera);
  }

})();
