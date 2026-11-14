import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWeatherSimulator, DAY_SECONDS } from './simulator.js';
import { assessRisk, BASE_LOCATION } from './riskAssessment.js';

const archive = JSON.parse(readFileSync(
  new URL('./referencia-enero-2026.json', import.meta.url), 'utf8'
));
const model = archive.modeloProbabilistico;
assert.equal(DAY_SECONDS, 600, 'una jornada dura 10 minutos reales a velocidad 1x');
assert.deepEqual(archive.periodoUTC, ['2026-01-01', '2026-01-31']);
assert.equal(archive.diasMuestreados, 31);
assert.equal(model.tasasCandidatas.FLR.numerador / model.tasasCandidatas.FLR.denominador, 6 / 31);
assert.equal(model.tasasCandidatas.CME.numerador / model.tasasCandidatas.CME.denominador, 10 / 31);
assert.equal(model.tasasCandidatas.GST.numerador / model.tasasCandidatas.GST.denominador, 2 / 31);
assert.equal(model.tasasCandidatas.SEP.numerador, 0);
assert.equal(model.tasasEncadenadas.FLR_CME.numerador / model.tasasEncadenadas.FLR_CME.denominador, 2 / 8);
assert.equal(model.tasasEncadenadas.CME_SEP.numerador / model.tasasEncadenadas.CME_SEP.denominador, 1 / 14);
assert.equal(archive.conteos.SEP.filas, 9);
assert.equal(archive.conteos.SEP.cadenasDistintas, 1);

function run(seed) {
  const simulator = createWeatherSimulator(model, { seed });
  const alerts = [];
  for (let i = 0; i < 120; i++) {
    const today = simulator.advance(DAY_SECONDS);
    assert.ok(today.length <= 1, 'máximo un sorteo/evento por día');
    alerts.push(...today);
  }
  assert.equal(simulator.day, 121);
  return alerts;
}

assert.deepEqual(run(42), run(42), 'una semilla repite la misma secuencia');
let sepCount = 0;
let emptyDays = 0;
for (let seed = 0; seed < 200; seed++) {
  const events = run(seed);
  emptyDays += 120 - events.length;
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (event.type === 'CME') assert.ok(event.speedKms >= 1000 && event.speedKms <= 1900);
    if (event.type === 'SEP') {
      sepCount++;
      assert.equal(events[index - 1]?.type, 'CME', 'SEP sigue una CME');
    }
    if (event.chained) {
      assert.ok(
        (event.type === 'CME' && events[index - 1]?.type === 'FLR') ||
        (event.type === 'SEP' && events[index - 1]?.type === 'CME'),
        'solo se marcan cadenas compatibles'
      );
    }
  }
}
assert.ok(sepCount > 0, 'las cadenas SEP son posibles');
assert.ok(emptyDays > 0, 'hay días sin alertas');
const simulator = createWeatherSimulator(model, { seed: 42 });
const baseline = simulator.readings();
assert.equal(simulator.advance(59).length, 0, 'no ocurre nada antes del primer minuto');
assert.equal(simulator.day, 1);
assert.equal(Math.ceil(simulator.secondsRemaining), 541);
assert.deepEqual(simulator.advance(541).length <= 1, true);
assert.equal(simulator.day, 2, 'tras 600 segundos empieza el siguiente día');
simulator.testAlert();
assert.ok(simulator.readings().particles > baseline.particles);
assert.ok(Object.values(simulator.readings()).every(value => value >= 0 && value <= 100));
assert.throws(() => simulator.advance(-1));
assert.throws(() => simulator.advance(601));
assert.match(BASE_LOCATION, /Shackleton/);
assert.equal(assessRisk({ type: 'FLR' }).level, 'info');
assert.equal(assessRisk({ type: 'CME', trajectory: 'desviada', speedKms: 1500 }).level, 'info');
assert.equal(assessRisk({ type: 'CME', trajectory: 'compatible' }).level, 'precaution');
assert.equal(assessRisk({ type: 'GST', kp: 6 }).level, 'info');
assert.equal(assessRisk({ type: 'SEP' }).level, 'info',
  'el canal >10 MeV sin pfu no demuestra peligro');
assert.equal(assessRisk({ type: 'SEP', goesPfu: 9 }).level, 'info');
assert.equal(assessRisk({ type: 'SEP', goesPfu: 18 }).level, 'precaution');
assert.equal(assessRisk({ type: 'SEP', lunarNearby: true }).level, 'precaution');
assert.equal(assessRisk({ type: 'SEP', goesPfu: 18, localIndex: 82 },
  { crew: 'eva' }).level, 'local');
assert.match(assessRisk({ type: 'SEP', goesPfu: 18, localIndex: 82 },
  { crew: 'refugio' }).action, /NO se ha calculado dosis personal/);
assert.equal(assessRisk({ type: 'SEP', localIndex: 59 }).level, 'info');
assert.throws(() => assessRisk({ type: 'SEP' }, { crew: 'otro' }));
const evidenceDemo = createWeatherSimulator(model, { seed: 22 });
assert.equal(assessRisk(evidenceDemo.testAlert('goes')).level, 'precaution');
assert.equal(assessRisk(evidenceDemo.testAlert('station')).level, 'local');
assert.equal(assessRisk(evidenceDemo.testAlert('cmeAway')).level, 'info');
assert.equal(assessRisk(evidenceDemo.testAlert('gst')).level, 'info');
console.log('Enero 2026 fijo, cadenas, evaluación local y reproducibilidad: OK');
