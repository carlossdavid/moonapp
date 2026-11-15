/**
 * Visor de la prueba: consume la MISMA instancia de clima-espacial que el
 * monitor de la página. Nunca crea otro reloj, sorteo ni sensor.
 */
const channels = [
  {
    key: 'solar',
    color: '#ffc06b',
    name: 'Actividad solar',
    description: 'Actividad solar · no mide dosis',
  },
  {
    key: 'particles',
    color: '#71f5dc',
    name: 'Partículas',
    description: 'Proxy terrestre · no es sensor del traje',
  },
  {
    key: 'earth',
    color: '#9ab8ff',
    name: 'Campo terrestre',
    description: 'Geomagnetismo terrestre · no dosis lunar',
  },
];

const launcher = document.createElement('button');
launcher.type = 'button';
launcher.className = 'visor-launcher';
launcher.textContent = '◈ Abrir visor  [SHIFT]';
launcher.setAttribute('aria-controls', 'visor-overlay');
launcher.setAttribute('aria-expanded', 'false');

const overlay = document.createElement('section');
overlay.id = 'visor-overlay';
overlay.className = 'visor-overlay';
overlay.hidden = true;
overlay.setAttribute('role', 'dialog');
overlay.setAttribute('aria-modal', 'true');
overlay.setAttribute('aria-label', 'Visor de clima espacial simulado');
overlay.innerHTML = `
  <div class="visor-toolbar">
    <span>VISOR · ÍNDICES SIMULADOS 0–100 · NO pfu NI mSv</span>
    <button type="button" class="visor-close" aria-label="Cerrar visor">Cerrar [SHIFT / ESC]</button>
  </div>
  <div class="visor-frame">
    <img class="visor-art" src="pruebas/MonitorVisor/Imagenes/Visor.png" alt="" draggable="false">
    ${channels.map(({ key, name, description }) => `
      <section class="visor-channel visor-${key}" aria-label="${name}">
        <div class="visor-channel-header"><strong>${name}</strong><span class="visor-value" id="visor-${key}-value">—</span></div>
        <canvas class="visor-canvas" id="visor-${key}-chart" role="img" aria-label="Serie temporal de ${name.toLowerCase()}, índice simulado de 0 a 100"></canvas>
        <p>${description}</p>
      </section>`).join('')}
    <div class="visor-alerts" aria-label="Alertas simuladas" role="log" aria-live="polite" aria-relevant="additions"><span class="visor-empty">Sin alertas registradas</span></div>
    <div class="visor-vega" aria-label="Mensajes de VEGA" aria-live="polite"></div>
  </div>`;
document.body.append(launcher, overlay);

const closeButton = overlay.querySelector('.visor-close');
const alertBox = overlay.querySelector('.visor-alerts');
const vegaBox = overlay.querySelector('.visor-vega');
const series = [];
let lastFocus = null;
let vegaTimer = null;

function toggle(force) {
  const opened = force ?? overlay.hidden;
  if (opened === !overlay.hidden) return;
  overlay.hidden = !opened;
  launcher.setAttribute('aria-expanded', String(opened));
  document.querySelector('.monitor')?.toggleAttribute('inert', opened);
  if (opened) {
    lastFocus = document.activeElement;
    closeButton.focus();
    drawAll();
    // En pantallas estrechas se puede desplazar horizontalmente por el arte.
    if (innerWidth < 700) overlay.scrollLeft = 300;
  } else {
    (lastFocus instanceof HTMLElement ? lastFocus : launcher).focus();
  }
}
launcher.addEventListener('click', () => toggle(true));
closeButton.addEventListener('click', () => toggle(false));
window.addEventListener('keydown', event => {
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    toggle();
  } else if (event.code === 'Escape' && !overlay.hidden) {
    event.preventDefault();
    toggle(false);
  } else if (event.code === 'Tab' && !overlay.hidden) {
    // El único control dentro del diálogo es Cerrar.
    event.preventDefault();
    closeButton.focus();
  }
});

function drawChannel(channel) {
  const canvas = document.getElementById(`visor-${channel.key}-chart`);
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const pixelRatio = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(rect.width * pixelRatio);
  const h = Math.round(rect.height * pixelRatio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#102332';
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.strokeStyle = '#355063';
  ctx.lineWidth = 1;
  for (const level of [0, 25, 50, 75, 100]) {
    const y = 9 + (height - 18) * (1 - level / 100);
    ctx.beginPath();
    ctx.moveTo(27, y);
    ctx.lineTo(width - 8, y);
    ctx.stroke();
    if (level === 0 || level === 50 || level === 100) {
      ctx.fillStyle = '#91aeb8';
      ctx.font = '10px Consolas, monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(level), 3, y + 3);
    }
  }
  if (!series.length) return;
  ctx.beginPath();
  series.forEach((point, index) => {
    const x = 28 + index * (width - 37) / (Math.max(1, series.length - 1));
    const y = 9 + (height - 18) * (1 - point[channel.key] / 100);
    if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = channel.color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'bevel';
  ctx.stroke();
  const latest = series.at(-1);
  const y = 9 + (height - 18) * (1 - latest[channel.key] / 100);
  ctx.fillStyle = channel.color;
  ctx.fillRect(width - 8, y - 3, 6, 6);
}

function drawAll() {
  if (overlay.hidden) return;
  channels.forEach(drawChannel);
}

document.addEventListener('lunar:simulated-weather-reading', ({ detail }) => {
  series.push(detail);
  if (series.length > 210) series.shift();
  channels.forEach(channel => {
    const label = document.getElementById(`visor-${channel.key}-value`);
    label.textContent = `${detail[channel.key]}/100`;
    label.style.color = channel.color;
  });
  drawAll();
});
window.addEventListener('resize', drawAll);

const types = {
  FLR: 'Fulguración',
  CME: 'Eyección solar',
  SEP: 'Partículas solares',
  GST: 'Geomagnetismo terrestre',
};
document.addEventListener('lunar:simulated-weather', ({ detail }) => {
  const { assessment } = detail;
  alertBox.querySelector('.visor-empty')?.remove();
  const card = document.createElement('article');
  card.className = `visor-alert visor-alert-${assessment.level}`;
  const title = document.createElement('strong');
  title.textContent = `${detail.test ? 'PRUEBA · ' : ''}${detail.type} / ${types[detail.type] ?? 'Evento'}`;
  const text = document.createElement('span');
  text.textContent = assessment.title;
  card.append(title, text);
  alertBox.prepend(card);
  while (alertBox.children.length > 5) alertBox.lastElementChild.remove();

  // VEGA no habla si no hay alerta y nunca deduce dosis personales de DONKI.
  vegaBox.replaceChildren();
  const name = document.createElement('strong');
  name.textContent = 'VEGA / ALERTA';
  const message = document.createElement('p');
  message.textContent = `${assessment.title}. ${assessment.action}`;
  vegaBox.append(name, message);
  clearTimeout(vegaTimer);
  vegaTimer = setTimeout(() => vegaBox.replaceChildren(), 18000);
});