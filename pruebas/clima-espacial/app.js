import { createWeatherSimulator, DAY_SECONDS } from './simulator.js';
import { assessRisk } from './riskAssessment.js';

const $ = id => document.getElementById(id);
const REFERENCE_URL = new URL('./referencia-enero-2026.json', import.meta.url);
const content = $('monitor-content');
const open = $('open-monitor');
const canvas = $('weather-chart');
const ctx = canvas.getContext('2d');
const series = [];
const descriptions = {
  FLR: 'Fulguración solar simulada',
  CME: 'Eyección solar simulada',
  SEP: 'Partículas solares simuladas',
  GST: 'Tormenta geomagnética terrestre simulada'
};
let lastEvent = null;
let evaSuspendedDay = null;
let returnPending = false;
const crewMode = $('crew-mode');
const evaOption = crewMode.querySelector('[value="eva"]');

function show(opened) {
  content.hidden = !opened;
  open.setAttribute('aria-expanded', String(opened));
  if (opened) $('tab-alert').hidden = true;
}
open.addEventListener('click', () => show(content.hidden));
$('close-monitor').addEventListener('click', () => show(false));

function drawChart() {
  if (canvas.closest('.console-frame')) {
    // Coordenadas lógicas fijas: la cuadrícula y los ejes ya están en el sprite.
    const width = 400, height = 246;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    for (const [name, color] of [['solar', '#ffc06b'], ['particles', '#71f5dc'], ['earth', '#9ab8ff']]) {
      ctx.fillStyle = color;
      series.forEach((entry, index) => {
        const x = Math.round(index * (width - 2) / Math.max(1, series.length - 1));
        const y = Math.round((height - 3) * (1 - entry[name] / 100));
        if (index) {
          const previous = series[index - 1];
          const px = Math.round((index - 1) * (width - 2) / Math.max(1, series.length - 1));
          const py = Math.round((height - 3) * (1 - previous[name] / 100));
          // Escalones de píxeles, sin suavizado subpíxel.
          ctx.fillRect(px, py, Math.max(1, x - px), 2);
          ctx.fillRect(x, Math.min(py, y), 2, Math.abs(y - py) + 2);
        }
        ctx.fillRect(x, y, 2, 2);
      });
    }
    return;
  }
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const w = Math.round(rect.width * ratio);
  const h = Math.round(rect.height * ratio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = rect.width, height = rect.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#102332';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#355063';
  ctx.lineWidth = 1;
  for (const level of [0, 25, 50, 75, 100]) {
    const y = 9 + (height - 18) * (1 - level / 100);
    ctx.beginPath(); ctx.moveTo(27, y); ctx.lineTo(width - 8, y); ctx.stroke();
    if (level === 0 || level === 50 || level === 100) {
      ctx.fillStyle = '#91aeb8'; ctx.font = '10px Consolas, monospace';
      ctx.fillText(String(level), 3, y + 3);
    }
  }
  for (const [name, color] of [['solar', '#ffbf76'], ['particles', '#69e0d6'], ['earth', '#8da7ff']]) {
    if (series.length < 2) continue;
    ctx.beginPath(); ctx.lineWidth = 2; ctx.strokeStyle = color;
    series.forEach((entry, index) => {
      const x = 28 + index * (width - 37) / (Math.max(1, series.length - 1));
      const y = 9 + (height - 18) * (1 - entry[name] / 100);
      if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

function renderRisk(item, assessment) {
  $('risk-report').dataset.level = assessment.level;
  $('risk-title').textContent = assessment.title;
  $('risk-action').textContent = assessment.action;
  $('station-reading').textContent = Number.isFinite(item.localIndex)
    ? `Sensor EXTERIOR ficticio: ${item.localIndex}/100 (índice del juego, NO dosis personal).`
    : 'Sensor exterior ficticio: sin lectura. No hay medición de dosis de la tripulación.';
  $('risk-evidence').replaceChildren(...assessment.evidence.map(text => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));
}

function syncSafety() {
  const suspendedToday = simulator && evaSuspendedDay === simulator.day;
  if (returnPending) {
    $('safety-status').textContent = 'EVA suspendida: retorno pendiente. Pulsa «Volver al refugio».';
  } else if (suspendedToday) {
    crewMode.value = 'refugio';
    $('safety-status').textContent = 'EVA suspendida durante esta jornada. Tripulación a resguardo.';
  } else {
    $('safety-status').textContent = crewMode.value === 'eva'
      ? 'EVA en curso. Una alerta local exigiría regresar al refugio.'
      : 'Protocolo normal: EVA disponible.';
  }
  $('safety-status').classList.toggle('unsafe', Boolean(returnPending || suspendedToday));
  evaOption.disabled = Boolean(suspendedToday || returnPending);
  $('return-shelter').hidden = !returnPending;
}

crewMode.addEventListener('change', () => {
  if (returnPending && crewMode.value === 'refugio') returnPending = false;
  syncSafety();
  if (lastEvent) renderRisk(lastEvent, assessRisk(lastEvent, { crew: crewMode.value }));
});
$('return-shelter').addEventListener('click', () => {
  returnPending = false;
  crewMode.value = 'refugio';
  syncSafety();
  if (lastEvent) renderRisk(lastEvent, assessRisk(lastEvent, { crew: 'refugio' }));
});

function displayAlert(item) {
  const assessment = assessRisk(item, { crew: crewMode.value });
  lastEvent = item;
  renderRisk(item, assessment);
  if (assessment.level === 'local') {
    evaSuspendedDay = Math.floor(item.time / DAY_SECONDS) + 1;
    returnPending = crewMode.value === 'eva';
    syncSafety();
  }
  const article = document.createElement('article');
  article.className = 'alert';
  article.dataset.type = item.type;
  article.dataset.level = assessment.level;
  const heading = document.createElement('strong');
  heading.textContent = `${item.test ? 'PRUEBA · ' : ''}${item.type} · ${descriptions[item.type]}`;
  const body = document.createElement('p');
  body.textContent = `${assessment.title}. ${assessment.action}`;
  const meta = document.createElement('small');
  const time = Math.floor(item.time);
  const timeOfDay = time % DAY_SECONDS;
  meta.textContent = `Día ${Math.floor(time / DAY_SECONDS) + 1} · ${String(Math.floor(timeOfDay / 60)).padStart(2, '0')}:${String(timeOfDay % 60).padStart(2, '0')} transcurridos${item.chained ? ' · Continuación del evento anterior' : ''}`;
  article.append(heading, body, meta);
  if ($('alerts').querySelector('.empty')) $('alerts').replaceChildren();
  $('alerts').prepend(article);
  if ($('alerts').children.length > 15) $('alerts').lastElementChild.remove();
  $('alert-count').textContent = String(Number($('alert-count').textContent) + 1);
  $('state').textContent = `${item.type} detectado`;
  $('state').classList.add('warning');
  if (content.hidden) $('tab-alert').hidden = false;
  document.dispatchEvent(new CustomEvent('lunar:simulated-weather', {
    detail: { ...item, assessment }
  }));
}

let simulator;
let paused = false;
let previousFrame = performance.now();
let lastGraph = 0;
let displayedDay = 1;

function showProbabilities(model) {
  const percent = value => `${(value * 100).toFixed(1).replace('.', ',')} %`;
  const base = model.tasasCandidatas;
  const chain = model.tasasEncadenadas;
  $('chance-flr').textContent = percent(base.FLR.numerador / base.FLR.denominador);
  $('chance-cme').textContent = percent(base.CME.numerador / base.CME.denominador);
  $('chance-gst').textContent = percent(base.GST.numerador / base.GST.denominador);
  $('chance-flr-cme').textContent = percent(chain.FLR_CME.numerador / chain.FLR_CME.denominador);
  $('chance-cme-sep').textContent = percent(chain.CME_SEP.numerador / chain.CME_SEP.denominador);
}

$('pause').addEventListener('click', () => {
  paused = !paused;
  $('pause').textContent = paused ? 'Reanudar' : 'Pausar';
  $('state').textContent = paused ? 'En pausa' : 'Monitoreando';
  $('state').classList.remove('warning');
});
$('test-scenario').addEventListener('change', () => {
  const selected = $('test-scenario').selectedOptions[0].textContent;
  $('scenario-preview').textContent = `${selected}: caso seleccionado. Pulsa «Probar alerta» para generar una PRUEBA, no una medición real.`;
});
$('test-alert').addEventListener('click', () => {
  if (simulator) {
    displayAlert(simulator.testAlert($('test-scenario').value));
    show(true);
  }
});
$('advance-day').addEventListener('click', () => {
  if (!simulator) return;
  // Herramienta aislada: termina SOLO la jornada actual sin poner un
  // sorteo extra. Cada día conserva su único momento de muestreo.
  const remaining = simulator.secondsRemaining;
  for (const alert of simulator.advance(remaining)) displayAlert(alert);
  refreshMonitor(performance.now());
});

function refreshMonitor(now) {
  if (!simulator) return;
  if (displayedDay !== simulator.day) {
    displayedDay = simulator.day;
    syncSafety(); // Una EVA suspendida se libera al iniciar otra jornada.
  }
  const values = simulator.readings();
  series.push(values);
  if (series.length > 210) series.shift();
  $('solar-value').textContent = String(values.solar);
  $('particle-value').textContent = String(values.particles);
  $('earth-value').textContent = String(values.earth);
  $('day').textContent = String(simulator.day);
  const remaining = Math.ceil(simulator.secondsRemaining);
  $('clock').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  lastGraph = now;
  if (!content.hidden) drawChart();
  document.dispatchEvent(new CustomEvent('lunar:simulated-weather-reading', {
    detail: { ...values, day: simulator.day, remaining: simulator.secondsRemaining }
  }));
}

function animate(now) {
  const delta = Math.min((now - previousFrame) / 1000, 1);
  previousFrame = now;
  if (simulator && !paused && !document.hidden) {
    for (const alert of simulator.advance(delta)) displayAlert(alert);
    if (now - lastGraph >= 170) {
      refreshMonitor(now);
    }
  }
  requestAnimationFrame(animate);
}
window.addEventListener('resize', drawChart);

try {
  const response = await fetch(REFERENCE_URL);
  if (!response.ok) throw new Error(`No se pudo leer la referencia archivada (${response.status})`);
  const archive = await response.json();
  if (archive.diasMuestreados !== 31 || !archive.modeloProbabilistico) {
    throw new Error('Referencia histórica incompleta');
  }
  const requestedSeed = new URLSearchParams(location.search).get('seed');
  const seed = requestedSeed === null ? Math.floor(Math.random() * 4294967296) : Number(requestedSeed);
  simulator = createWeatherSimulator(archive.modeloProbabilistico, { seed });
  showProbabilities(archive.modeloProbabilistico);
  $('reference-status').textContent =
    `Referencia FIJA: ${archive.periodoUTC[0]} a ${archive.periodoUTC[1]} (${archive.diasMuestreados} días). ` +
    `FLR M/X ${archive.conteos.FLR.diasConEvento} días; CME ≥1000 km/s ${archive.conteos.CME.diasConEvento} días; ` +
    `GST ${archive.conteos.GST.diasConEvento} días; ${archive.conteos.SEP.filas} filas SEP agrupadas en ` +
    `${archive.conteos.SEP.cadenasDistintas} cadena.`;
  $('model-note').textContent = `Semilla ${seed}. Un día de juego dura 10 minutos reales y tiene un solo sorteo aleatorio. Enero de 2026 es referencia fija; gráfica y alertas NO son mediciones NASA.`;
  refreshMonitor(performance.now());
  requestAnimationFrame(animate);
} catch (error) {
  $('model-note').textContent = `No se pudo iniciar el monitor: ${error.message}. Inicia un servidor HTTP desde moonapp.`;
  $('state').textContent = 'Monitor no disponible';
  console.error(error);
}
