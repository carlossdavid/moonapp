import { createWeatherSimulator, DAY_SECONDS } from '../pruebas/clima-espacial/simulator.js';
import { assessRisk } from '../pruebas/clima-espacial/riskAssessment.js';

export const weatherDelta = (previous, now) =>
  previous === null ? 0 : Math.max(0, Math.min((now - previous) / 1000, 1));

/** Un único controlador local; reutiliza íntegramente el modelo de la prueba. */
export async function startWeather(game) {
  const response = await fetch(new URL('../pruebas/clima-espacial/referencia-enero-2026.json', import.meta.url));
  if (!response.ok) throw new Error(`Referencia DONKI no disponible (${response.status})`);
  const archive = await response.json();
  if (archive.diasMuestreados !== 31 || !archive.modeloProbabilistico) {
    throw new Error('Referencia DONKI incompleta');
  }
  const requested = new URLSearchParams(location.search).get('seed');
  const seed = requested === null ? Math.floor(Math.random() * 4294967296) : Number(requested);
  const simulator = createWeatherSimulator(archive.modeloProbabilistico, { seed });
  const $ = id => document.getElementById(id);
  const panel = $('monitor-content'), canvas = $('weather-chart'), ctx = canvas.getContext('2d');
  const series = [];
  let previousFrame = null, lastReading = -Infinity, lastFocus, testIndex = 0;
  let paused = false, frameId;
  const rates = archive.modeloProbabilistico.tasasCandidatas;
  const chained = archive.modeloProbabilistico.tasasEncadenadas;
  for (const [id, rate] of [
    ['chance-flr', rates.FLR], ['chance-cme', rates.CME], ['chance-gst', rates.GST],
    ['chance-flr-cme', chained.FLR_CME], ['chance-cme-sep', chained.CME_SEP],
  ]) $(id).textContent = `${(rate.numerador / rate.denominador * 100).toFixed(1).replace('.', ',')} %`;
  $('model-note').textContent = `DONKI enero 2026 · semilla ${seed} · jornada de 600 s · índices simulados, no telemetría.`;
  $('reference-status').textContent = archive.periodoUTC.join(' — ');

  function draw() {
    if (panel.hidden) return;
    const width = 400, height = 246;
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    for (const [key, color] of [['solar', '#ffc06b'], ['particles', '#71f5dc'], ['earth', '#9ab8ff']]) {
      ctx.fillStyle = color;
      series.forEach((entry, index) => {
        const x = Math.round(index * 398 / Math.max(1, series.length - 1));
        const y = Math.round(243 * (1 - entry[key] / 100));
        if (index) {
          const px = Math.round((index - 1) * 398 / Math.max(1, series.length - 1));
          const py = Math.round(243 * (1 - series[index - 1][key] / 100));
          ctx.fillRect(px, py, Math.max(1, x - px), 2);
          ctx.fillRect(x, Math.min(py, y), 2, Math.abs(y - py) + 2);
        }
        ctx.fillRect(x, y, 2, 2);
      });
    }
  }

  function reading(now) {
    const values = simulator.readings();
    series.push(values);
    if (series.length > 210) series.shift();
    $('solar-value').textContent = values.solar;
    $('particle-value').textContent = values.particles;
    $('earth-value').textContent = values.earth;
    $('day').textContent = simulator.day;
    const seconds = Math.ceil(simulator.secondsRemaining);
    $('clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    lastReading = now;
    draw();
    document.dispatchEvent(new CustomEvent('lunar:simulated-weather-reading', {
      detail: { ...values, day: simulator.day, remaining: simulator.secondsRemaining },
    }));
  }

  function alert(event) {
    const assessment = assessRisk(event, { crew: game.scene?.isExterior ? 'eva' : 'refugio' });
    $('state').textContent = `${event.test ? 'PRUEBA · ' : ''}${event.type} detectado`;
    $('risk-report').dataset.level = assessment.level;
    $('risk-title').textContent = assessment.title;
    $('risk-action').textContent = assessment.action;
    $('alert-count').textContent = Number($('alert-count').textContent) + 1;
    document.dispatchEvent(new CustomEvent('lunar:simulated-weather', { detail: { ...event, assessment } }));
  }

  $('open-monitor').addEventListener('click', () => {
    if (!panel.hidden) return;
    lastFocus = document.activeElement;
    panel.hidden = false;
    $('open-monitor').setAttribute('aria-expanded', 'true');
    $('close-monitor').focus();
    draw();
  });
  $('close-monitor').addEventListener('click', () => {
    panel.hidden = true;
    $('open-monitor').setAttribute('aria-expanded', 'false');
    lastFocus?.focus?.();
  });
  $('test-alert').addEventListener('click', () => {
    const scenario = ['goes', 'cmeAway', 'gst'][testIndex++ % 3];
    alert(simulator.testAlert(scenario));
    reading(performance.now());
  });
  $('pause').addEventListener('click', () => { paused = !paused; });
  $('advance-day').addEventListener('click', () => {
    for (const event of simulator.advance(simulator.secondsRemaining)) alert(event);
    reading(performance.now());
  });

  function animate(now) {
    // rAF usa el inicio del fotograma, que puede preceder a performance.now()
    // durante el arranque. El primer intervalo es cero y nunca es negativo.
    const delta = weatherDelta(previousFrame, now);
    previousFrame = now;
    if (!paused && !document.hidden) {
      for (const event of simulator.advance(delta)) alert(event);
      if (now - lastReading >= 170) reading(now);
    }
    frameId = requestAnimationFrame(animate);
  }
  reading(performance.now());
  frameId = requestAnimationFrame(animate);
  return {
    simulator, series,
    stop() { cancelAnimationFrame(frameId); },
    // Expuesto solo para probar intervalos de arranque en esta integración.
    get daySeconds() { return DAY_SECONDS; },
  };
}
