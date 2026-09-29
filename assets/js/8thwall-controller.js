/*
 * Adaptador de RA para la ruta experimental de enseñas.
 *
 * Usa 8th Wall XR Engine únicamente para cámara, SLAM y detección de
 * superficies. Los controles, audio, LSC y HTML siguen siendo los del visor
 * principal; este archivo no crea una interfaz paralela.
 */
(function () {
  'use strict';

  let active = null;

  function waitForEngine() {
    if (window.XR8 && window.XR8.XrController && window.XR8.Threejs) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const wait = () => {
        if (window.XR8 && window.XR8.XrController && window.XR8.Threejs) {
          resolve();
          return;
        }
        if (Date.now() - startedAt > 20000) {
          reject(new Error('El motor de RA tardó demasiado en prepararse.'));
          return;
        }
        window.setTimeout(wait, 100);
      };
      wait();
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normaliseModel(model) {
    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const largestSide = Math.max(size.x, size.y, size.z, 0.001);
    const scale = 1.05 / largestSide;

    model.scale.setScalar(scale);
    // El punto de anclaje siempre coincide con la base del objeto, no con su centro.
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  }

  function createReticle() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.055, 0.075, 44),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;

    const centre = new THREE.Mesh(
      new THREE.CircleGeometry(0.012, 24),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6, side: THREE.DoubleSide })
    );
    centre.rotation.x = -Math.PI / 2;
    group.add(ring, centre);
    group.visible = false;
    return group;
  }

  function applyHit(target, hit) {
    if (!target || !hit || !hit.position) return false;
    const position = hit.position;
    if (![position.x, position.y, position.z].every(Number.isFinite)) return false;

    target.position.set(position.x, position.y, position.z);
    if (hit.rotation && Number.isFinite(hit.rotation.w)) {
      target.quaternion.set(hit.rotation.x, hit.rotation.y, hit.rotation.z, hit.rotation.w);
    }
    return true;
  }

  function getHitAt(x, y) {
    try {
      const hits = window.XR8.XrController.hitTest(x, y) || [];
      return hits.find((hit) => hit && hit.position) || null;
    } catch (_) {
      return null;
    }
  }

  function bindGestures(state) {
    const { canvas } = state;
    let pointer = null;
    let pinchDistance = null;

    canvas.addEventListener('pointerdown', (event) => {
      if (state.scanning) {
        const bounds = canvas.getBoundingClientRect();
        const hit = getHitAt(
          clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
          clamp((event.clientY - bounds.top) / bounds.height, 0, 1)
        );
        place(state, hit);
        return;
      }
      if (!state.placed) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!pointer || pointer.id !== event.pointerId || !state.placed) return;
      state.content.rotation.y += (event.clientX - pointer.x) * 0.008;
      state.content.rotation.x = clamp(
        state.content.rotation.x + (event.clientY - pointer.y) * 0.004,
        -0.75,
        0.75
      );
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });

    const releasePointer = () => { pointer = null; };
    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);

    canvas.addEventListener('wheel', (event) => {
      if (!state.placed) return;
      event.preventDefault();
      setScale(state, event.deltaY < 0 ? 1.08 : 0.92);
    }, { passive: false });

    canvas.addEventListener('touchstart', (event) => {
      if (state.placed && event.touches.length === 2) {
        pinchDistance = distanceBetweenTouches(event.touches);
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (event) => {
      if (!state.placed || !pinchDistance || event.touches.length !== 2) return;
      event.preventDefault();
      const nextDistance = distanceBetweenTouches(event.touches);
      setScale(state, nextDistance / pinchDistance);
      pinchDistance = nextDistance;
    }, { passive: false });

    canvas.addEventListener('touchend', () => { pinchDistance = null; }, { passive: true });
  }

  function distanceBetweenTouches(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  function setScale(state, factor) {
    state.scale = clamp(state.scale * factor, 0.08, 2.4);
    state.content.scale.setScalar(state.scale);
  }

  function updateSurfaceHit(state) {
    if (!state.scanning || !state.reticle) return;
    const hit = getHitAt(0.5, 0.58);
    if (!applyHit(state.reticle, hit)) {
      state.reticle.visible = false;
      state.lastHit = null;
      return;
    }

    state.lastHit = hit;
    state.reticle.visible = true;
    state.callbacks.onSurfaceFound?.();
  }

  function beginScanning(state) {
    if (!state.running) return;
    state.scanning = true;
    state.placed = false;
    state.lastHit = null;
    if (state.anchor) state.anchor.visible = false;
    if (state.reticle) state.reticle.visible = false;
    state.callbacks.onScanning?.();
  }

  function place(state, hit) {
    if (!state.running || !state.modelReady) return false;
    if (!applyHit(state.anchor, hit || state.lastHit)) {
      state.callbacks.onStatus?.('Aún no hay una superficie estable. Mueve suavemente el teléfono e inténtalo de nuevo.');
      return false;
    }

    state.scanning = false;
    state.placed = true;
    state.anchor.visible = true;
    if (state.reticle) state.reticle.visible = false;
    state.callbacks.onPlaced?.();
    return true;
  }

  async function start(options) {
    if (active?.running) return true;

    const canvas = document.createElement('canvas');
    canvas.id = 'ar-8th-canvas';
    canvas.setAttribute('aria-label', 'Vista de cámara de realidad aumentada');
    canvas.setAttribute('data-engine', '8th-wall');

    const state = {
      ...options,
      canvas,
      running: false,
      modelReady: false,
      scanning: false,
      placed: false,
      lastHit: null,
      scene: null,
      anchor: null,
      content: null,
      reticle: null,
      scale: 0.32,
      callbacks: options.callbacks || {}
    };
    active = state;

    options.callbacks?.onStatus?.('Preparando cámara y detección de superficie…');
    try {
      await waitForEngine();
      if (active !== state) return false;

      options.canvasHost.appendChild(canvas);
      if (options.normalCanvas) options.normalCanvas.style.visibility = 'hidden';

      window.XR8.XrController.configure({
        disableWorldTracking: false,
        enableLighting: true,
        scale: 'absolute'
      });

      window.XR8.addCameraPipelineModules([
        window.XR8.GlTextureRenderer.pipelineModule(),
        window.XR8.Threejs.pipelineModule(),
        window.XR8.XrController.pipelineModule(),
        {
          name: 'ensenas-8thwall-surface-adapter',
          onStart: () => {
            if (active !== state) return;
            const xrScene = window.XR8.Threejs.xrScene();
            state.scene = xrScene.scene;
            const camera = xrScene.camera;
            camera.position.set(0, 1.6, 0);
            window.XR8.XrController.updateCameraProjectionMatrix({
              origin: camera.position,
              facing: camera.quaternion
            });

            state.scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.45));
            const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
            keyLight.position.set(2, 4, 2);
            state.scene.add(keyLight);

            state.anchor = new THREE.Group();
            state.anchor.visible = false;
            state.content = new THREE.Group();
            state.anchor.add(state.content);
            state.scene.add(state.anchor);
            state.reticle = createReticle();
            state.scene.add(state.reticle);

            const loader = new THREE.GLTFLoader();
            loader.load(state.modelUrl, (gltf) => {
              if (active !== state || !state.running) return;
              normaliseModel(gltf.scene);
              state.content.add(gltf.scene);
              state.content.scale.setScalar(state.scale);
              state.modelReady = true;
              state.callbacks.onModelReady?.();
              beginScanning(state);
            }, undefined, () => {
              state.callbacks.onError?.('El modelo 3D no pudo cargarse para la prueba de RA.');
            });

            bindGestures(state);
          },
          onUpdate: () => updateSurfaceHit(state)
        }
      ]);

      state.running = true;
      state.callbacks.onStarted?.();
      window.XR8.run({ canvas });
      return true;
    } catch (error) {
      console.error('No fue posible iniciar 8th Wall:', error);
      stop();
      options.callbacks?.onError?.('No se pudo abrir la cámara. Usa Safari o Chrome actualizado, por HTTPS, y acepta el permiso de cámara.');
      return false;
    }
  }

  function stop() {
    if (!active) return;
    const state = active;
    active = null;
    state.running = false;
    try { window.XR8?.stop(); } catch (_) { /* la cámara ya puede estar cerrándose */ }
    state.canvas?.remove();
    if (state.normalCanvas) state.normalCanvas.style.visibility = '';
    state.callbacks.onStopped?.();
  }

  window.Ensenas8thWallController = {
    start,
    stop,
    startScanning() { if (active) beginScanning(active); },
    placeAtReticle() { return active ? place(active) : false; },
    isActive() { return Boolean(active?.running); }
  };
})();
