/**
 * Plataforma enseñas - Sincronizador de Videos Paralelos y Módulo LSC
 * Cumplimiento de Criterios de Aceptación CA3 y CA4
 */

document.addEventListener('DOMContentLoaded', () => {
  const videoUso = document.getElementById('video-uso');
  const videoLsc = document.getElementById('video-lsc');
  const figureVideoUso = document.getElementById('figure-video-uso');
  const figureVideoLsc = document.getElementById('figure-video-lsc');
  const videoGrid = document.getElementById('video-grid-container');

  // Controles
  const btnPlayAll = document.getElementById('btn-play-all');
  const btnPauseAll = document.getElementById('btn-pause-all');
  const btnMuteAll = document.getElementById('btn-mute-all');
  const btnRestartAll = document.getElementById('btn-restart-all');
  const iconVolOn = document.getElementById('icon-vol-on');
  const iconVolOff = document.getElementById('icon-vol-off');
  const labelMute = document.getElementById('label-mute');
  const progressSlider = document.getElementById('shared-progress');
  const currentTimeDisplay = document.getElementById('current-time');
  const durationTimeDisplay = document.getElementById('duration-time');

  // Módulo Aprender Seña LSC
  const btnModeLsc = document.getElementById('btn-mode-lsc');
  const btnModeLscText = document.getElementById('btn-mode-lsc-text');
  const btnCloseLscMode = document.getElementById('btn-close-lsc-mode');
  const lscStepsPanel = document.getElementById('lsc-steps-panel');

  if (!videoUso || !videoLsc) {
    console.warn('Reproductores de video no encontrados en la página.');
    return;
  }

  let isMuted = false;
  let isSeeking = false;
  let isLscLearningActive = false;

  // Generador de fallback si los videos aún no están renderizados físicamente
  setupVideoFallbackIfEmpty(videoUso, 'Uso y Aplicación: ' + (window.ENSENAS_DATA?.objectName || 'Objeto'));
  setupVideoFallbackIfEmpty(videoLsc, 'Intérprete LSC: ' + (window.ENSENAS_DATA?.objectName || 'Seña'));

  /* ========================================================================
     Sincronización Dual de Reproducción (CA3)
     ======================================================================== */

  // Reproducir ambos videos
  async function playBothVideos() {
    try {
      if (isLscLearningActive) {
        // En modo aprendizaje LSC solo reproduce el video de señas
        await videoLsc.play();
      } else {
        await Promise.all([
          videoUso.play().catch(e => console.log('Autoplay policy video uso:', e)),
          videoLsc.play().catch(e => console.log('Autoplay policy video lsc:', e))
        ]);
      }
      updatePlayPauseState(true);
    } catch (err) {
      console.warn('Aviso de reproducción:', err);
    }
  }

  // Pausar ambos videos
  function pauseBothVideos() {
    videoUso.pause();
    videoLsc.pause();
    updatePlayPauseState(false);
  }

  function updatePlayPauseState(isPlaying) {
    if (isPlaying) {
      btnPlayAll.classList.add('is-active');
      btnPauseAll.classList.remove('is-active');
    } else {
      btnPlayAll.classList.remove('is-active');
      btnPauseAll.classList.add('is-active');
    }
  }

  // Reiniciar ambos videos
  function restartBothVideos() {
    videoUso.currentTime = 0;
    videoLsc.currentTime = 0;
    playBothVideos();
  }

  // Conmutar Silencio (Mute / Unmute)
  function toggleMuteAll() {
    isMuted = !isMuted;
    videoUso.muted = isMuted;
    videoLsc.muted = isMuted;

    if (isMuted) {
      iconVolOn.classList.add('is-hidden');
      iconVolOff.classList.remove('is-hidden');
      labelMute.textContent = 'Activar sonido';
      btnMuteAll.setAttribute('aria-label', 'Activar sonido de los videos');
    } else {
      iconVolOn.classList.remove('is-hidden');
      iconVolOff.classList.add('is-hidden');
      labelMute.textContent = 'Silenciar';
      btnMuteAll.setAttribute('aria-label', 'Silenciar los videos');
    }
  }

  // Detección y corrección de desincronización (Drift tolerance: 0.15s)
  function keepVideosInSync() {
    if (isLscLearningActive) return; // En modo práctica no se sincroniza
    const diff = Math.abs(videoUso.currentTime - videoLsc.currentTime);
    if (diff > 0.15 && !isSeeking) {
      // Sincronizar hacia el video principal de uso
      videoLsc.currentTime = videoUso.currentTime;
    }
  }

  // Actualizar línea de tiempo y duración
  function updateProgress() {
    if (isSeeking) return;

    const current = isLscLearningActive ? videoLsc.currentTime : videoUso.currentTime;
    const duration = isLscLearningActive 
      ? (videoLsc.duration || 10) 
      : (videoUso.duration || videoLsc.duration || 10);

    if (duration > 0) {
      const percentage = (current / duration) * 100;
      progressSlider.value = percentage;
      progressSlider.setAttribute('aria-valuenow', Math.round(percentage));
      currentTimeDisplay.textContent = formatTime(current);
      durationTimeDisplay.textContent = formatTime(duration);
    }
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Eventos de controles unificados
  btnPlayAll.addEventListener('click', playBothVideos);
  btnPauseAll.addEventListener('click', pauseBothVideos);
  btnRestartAll.addEventListener('click', restartBothVideos);
  btnMuteAll.addEventListener('click', toggleMuteAll);

  // Escuchar tiempo de reproducción
  videoUso.addEventListener('timeupdate', () => {
    keepVideosInSync();
    updateProgress();
  });

  videoLsc.addEventListener('timeupdate', () => {
    if (isLscLearningActive) {
      updateProgress();
    }
  });

  // Eventos de barra de progreso
  progressSlider.addEventListener('input', () => {
    isSeeking = true;
    const duration = videoUso.duration || videoLsc.duration || 10;
    const targetTime = (progressSlider.value / 100) * duration;
    currentTimeDisplay.textContent = formatTime(targetTime);
  });

  progressSlider.addEventListener('change', () => {
    const duration = videoUso.duration || videoLsc.duration || 10;
    const targetTime = (progressSlider.value / 100) * duration;
    if (!isLscLearningActive) {
      videoUso.currentTime = targetTime;
    }
    videoLsc.currentTime = targetTime;
    isSeeking = false;
  });

  /* ========================================================================
     Módulo Aprender Seña en LSC (CA4)
     ======================================================================== */

  function toggleLscLearningMode() {
    isLscLearningActive = !isLscLearningActive;

    if (isLscLearningActive) {
      activateLscLearningMode();
    } else {
      deactivateLscLearningMode();
    }
  }

  function activateLscLearningMode() {
    isLscLearningActive = true;

    // 1. Pausar y ocultar el video explicativo general de forma accesible
    videoUso.pause();
    figureVideoUso.classList.add('is-hidden-accessible');
    figureVideoUso.setAttribute('aria-hidden', 'true');

    // Ajustar diseño para dar protagonismo total al video LSC
    videoGrid.classList.add('learning-active');

    // 2. El video en LSC cambia a bucle (loop) enfocado en el gesto de la seña
    videoLsc.loop = true;
    videoLsc.currentTime = 0;
    videoLsc.play().catch(e => console.log('LSC loop play:', e));

    // 3. Desplegar el panel accesible con la lista ordenada de pasos
    lscStepsPanel.hidden = false;
    btnModeLsc.setAttribute('aria-expanded', 'true');
    btnModeLsc.classList.add('btn-active');
    btnModeLscText.textContent = 'Finalizar práctica LSC';

    // Desplazar suavemente y enfocar el panel para lectores de pantalla
    lscStepsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstStep = lscStepsPanel.querySelector('h3');
    if (firstStep) firstStep.focus();
  }

  function deactivateLscLearningMode() {
    isLscLearningActive = false;

    // Restaurar vista dual accesible
    figureVideoUso.classList.remove('is-hidden-accessible');
    figureVideoUso.removeAttribute('aria-hidden');
    videoGrid.classList.remove('learning-active');

    // Restaurar modo normal en video LSC
    videoLsc.loop = false;

    // Ocultar panel de pasos
    lscStepsPanel.hidden = true;
    btnModeLsc.setAttribute('aria-expanded', 'false');
    btnModeLsc.classList.remove('btn-active');
    btnModeLscText.textContent = 'Aprender seña en LSC';

    // Pausar para permitir control sincronizado del usuario
    pauseBothVideos();
  }

  btnModeLsc.addEventListener('click', toggleLscLearningMode);
  if (btnCloseLscMode) {
    btnCloseLscMode.addEventListener('click', deactivateLscLearningMode);
  }

  /* ========================================================================
     Generador Visual Demostrativo (Canvas Fallback)
     Permite previsualizar la sincronización incluso antes de cargar archivos mp4
     ======================================================================== */
  function setupVideoFallbackIfEmpty(videoElement, labelText) {
    // Si la fuente da error o no carga en 1 segundo, creamos un canvas demostrativo
    const timeout = setTimeout(() => {
      if (videoElement.readyState < 2) {
        createCanvasStreamForVideo(videoElement, labelText);
      }
    }, 1200);

    videoElement.addEventListener('loadeddata', () => clearTimeout(timeout), { once: true });
    videoElement.addEventListener('error', () => {
      clearTimeout(timeout);
      createCanvasStreamForVideo(videoElement, labelText);
    }, { once: true });
  }

  function createCanvasStreamForVideo(videoEl, title) {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    const isLsc = title.includes('LSC');

    function draw() {
      frame++;
      // Fondo interactivo animado
      const gradient = ctx.createLinearGradient(0, 0, 640, 360);
      if (isLsc) {
        gradient.addColorStop(0, '#4C1D95');
        gradient.addColorStop(1, '#1E1B4B');
      } else {
        gradient.addColorStop(0, '#1E3A8A');
        gradient.addColorStop(1, '#0F172A');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 640, 360);

      // Icono / Gráfico animado
      ctx.fillStyle = isLsc ? '#A78BFA' : '#60A5FA';
      ctx.beginPath();
      const pulse = Math.sin(frame * 0.05) * 15;
      ctx.arc(320, 160, 60 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Representación de mano / onda
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, 320, 270);

      ctx.font = '16px Inter, sans-serif';
      ctx.fillStyle = '#E2E8F0';
      const timeStr = formatTime(videoEl.currentTime || (frame / 30));
      ctx.fillText(`Reproducción Demostrativa: ${timeStr}`, 320, 305);

      if (isLsc) {
        ctx.fillStyle = '#FBBF24';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillText('Gestos y Expresión Facial en Lengua de Señas', 320, 330);
      }

      requestAnimationFrame(draw);
    }

    draw();

    try {
      if (canvas.captureStream) {
        const stream = canvas.captureStream(30);
        videoEl.srcObject = stream;
      }
    } catch (e) {
      console.log('Canvas stream capture no disponible en este entorno:', e);
    }
  }
});
