// Adaptador de presentación local: no arranca otro juego ni otro simulador.
const channels = [
  ['solar', 'Actividad solar', '#ffc06b', 'Índice simulado · no dosis'],
  ['particles', 'Partículas', '#71f5dc', 'Proxy terrestre · no traje'],
  ['earth', 'Campo terrestre', '#9ab8ff', 'Índice simulado · no Kp'],
];

export function mountVisor(ui) {
  const launcher = document.createElement('button');
  launcher.className = 'visor-launcher';
  launcher.textContent = 'Visor bloqueado';
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'visor-overlay');
  const overlay = document.createElement('section');
  overlay.id = 'visor-overlay';
  overlay.className = 'visor-overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Visor de clima espacial');
  overlay.innerHTML = `<div class="visor-toolbar">
    <span>VISOR · SIMULACIÓN 0–100 · NO DOSIS</span>
    <button class="visor-close">Cerrar · SHIFT / ESC</button></div>
    <div class="visor-frame">
      <img class="visor-art" src="pruebas/MonitorVisor/Imagenes/Visor.png" alt="" draggable="false">
      ${channels.map(([key, name, , description]) => `<section class="visor-channel visor-${key}">
        <div class="visor-channel-header"><strong>${name}</strong><span class="visor-value" id="visor-${key}-value">—</span></div>
        <canvas class="visor-canvas" width="300" height="46" id="visor-${key}-chart" aria-label="${name}: curva simulada"></canvas>
        <p>${description}</p></section>`).join('')}
      <div class="visor-alerts" role="log" aria-live="polite">Sin alertas registradas</div>
      <div class="visor-vega" aria-live="polite"></div>
    </div>`;
  document.body.append(launcher, overlay);
  if (ui.game?.language === 'en') {
    overlay.classList.add('language-en');
    const frame = overlay.querySelector('.visor-frame');
    for (const [text, position] of [
      ['SPACE WEATHER', 'visor-english-title'],
      ['ALERTS', 'visor-english-alerts'],
      ['VEGA', 'visor-english-vega'],
    ]) {
      const label = document.createElement('span');
      label.className = `visor-english-label ${position}`;
      label.textContent = text;
      frame.append(label);
    }
  }
  const close = overlay.querySelector('.visor-close'), points = [];
  const alerts = overlay.querySelector('.visor-alerts'), vega = overlay.querySelector('.visor-vega');
  let previousFocus, timer, count = 0;

  function draw() {
    if (overlay.hidden) return;
    for (const [key, , color] of channels) {
      const canvas = document.getElementById(`visor-${key}-chart`), ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#275877';
      for (const y of [2, 22, 43]) ctx.fillRect(0, y, 300, 1);
      ctx.fillStyle = color;
      points.forEach((point, index) => {
        const x = Math.round(index * 298 / Math.max(1, points.length - 1));
        const y = Math.round(43 - point[key] * .41);
        ctx.fillRect(x, y, 2, 2);
        if (index) {
          const px = Math.round((index - 1) * 298 / Math.max(1, points.length - 1));
          const py = Math.round(43 - points[index - 1][key] * .41);
          ctx.fillRect(px, py, x - px + 1, 2);
          ctx.fillRect(x, Math.min(y, py), 2, Math.abs(y - py) + 2);
        }
      });
    }
  }
  function openVisor() {
    if (!ui.transitionActive) ui.transition();
    overlay.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    previousFocus = document.activeElement;
    close.focus();
    draw();
  }

  function toggle(open = overlay.hidden) {
    if (open && !ui.game?.mission.visorUnlocked) {
      ui.notify('Visor bloqueado hasta salir de la segunda cinemática.');
      return;
    }
    if (open && (ui.blocked || ui.game?.scene?.isRecarga || ui.game?.state !== 'playing')) return;
    if (open && ui.game?.mission && !ui.game.mission.radiacionCinematicShown) {
      if (ui.game.language === 'en') {
        ui.game.mission.radiacionCinematicShown = true;
        ui.game.mission.turtleMission = true;
        ui.notify('FINAL MISSION: enter the main station and set its energy module to Turtle mode.');
        openVisor();
        return;
      }
      const opened = ui.openCinematic({
        src: 'assets/video/radiacion.mp4',
        exitText: 'Salir · abrir visor',
        exitTextOnEnd: 'Salir · abrir visor',
        showAviso: false,
        autoCloseOnEnd: true,
        onClose: () => {
          ui.game.mission.turtleMission = true;
          ui.notify('MISIÓN FINAL: entra en la estación principal y cambia el módulo de energía a modo Tortuga.');
          openVisor();
        },
      });
      if (opened) {
        ui.game.mission.radiacionCinematicShown = true;
        return;
      }
    }
    if (open) {
      openVisor();
    } else {
      ui.transition();
      overlay.hidden = true;
      launcher.setAttribute('aria-expanded', 'false');
      previousFocus?.focus?.();
    }
  }
  launcher.addEventListener('click', () => toggle());
  close.addEventListener('click', () => toggle(false));
  window.addEventListener('keydown', event => {
    if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !event.repeat
      && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); toggle(); }
    else if (event.code === 'Escape' && !overlay.hidden) { event.preventDefault(); toggle(false); }
    else if (event.code === 'Tab' && !overlay.hidden) { event.preventDefault(); close.focus(); }
  });
  document.addEventListener('lunar:simulated-weather-reading', ({ detail }) => {
    points.push(detail);
    if (points.length > 210) points.shift();
    for (const [key, , color] of channels) {
      const label = document.getElementById(`visor-${key}-value`);
      label.textContent = `${detail[key]}/100`;
      label.style.color = color;
    }
    draw();
  });
  document.addEventListener('lunar:simulated-weather', ({ detail }) => {
    if (!count++) alerts.replaceChildren();
    const card = document.createElement('article');
    card.className = 'visor-alert';
    card.textContent = ui.game?.language === 'en'
      ? `${detail.test ? 'TEST · ' : ''}${detail.type} · simulated space weather alert`
      : `${detail.test ? 'PRUEBA · ' : ''}${detail.type} · ${detail.assessment.title}`;
    alerts.prepend(card);
    while (alerts.children.length > 5) alerts.lastElementChild.remove();
    vega.textContent = ui.game?.language === 'en'
      ? 'VEGA: Check the station and adjust your activities before continuing.'
      : `VEGA: ${detail.assessment.title}. ${detail.assessment.action}`;
    clearTimeout(timer);
    timer = setTimeout(() => vega.replaceChildren(), 18000);
  });
}
