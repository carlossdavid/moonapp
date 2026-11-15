import test from 'node:test';
import assert from 'node:assert/strict';
import { SistemaEnergia } from '../../src/systems/EnergySystem.js';
import { batteryLevel, BATTERY_HUD_BOUNDS, drawBatteryHUD } from './BatteryHUD.js';
import { createBatterySimulation, advanceBatterySimulation } from './BatterySimulation.js';
import { foodPercent, SEGUNDOS_REALES_HASTA_60 } from './FoodSystem.js';
import { SuitWater, WATER_CAPACITY_ML, WATER_CONSUMPTION_ML_PER_HOUR } from './WaterSystem.js';
import { existsSync } from 'node:fs';

test('300 segundos reales son 24 horas de juego', () => {
  const energy = new SistemaEnergia();
  for (let i = 0; i < 300 * 60; i++) energy.update(1 / 60);
  assert.ok(Math.abs(energy.getSnapshot().tiempo.transcurridoHoras - 24) < 1e-8);
});

test('traje consume 144,375 W por hora de juego (12,5 s reales)', () => {
  const energy = new SistemaEnergia();
  energy.updateSuit(12.5, 144.375);
  assert.ok(Math.abs(energy.getSnapshot().traje.energiaWh - 1010.625) < 1e-8);
  energy.updateSuit(12.5, 233);
  assert.ok(Math.abs(energy.getSnapshot().traje.energiaWh - 777.625) < 1e-8);
});

test('recarga del traje a 0,5 kW con eficiencia 90 %', () => {
  const energy = new SistemaEnergia({ energiaTrajeInicialWh: 0 });
  energy.rechargeSuit(12.5);
  assert.ok(Math.abs(energy.getSnapshot().traje.energiaWh - 450) < 1e-8);
});

test('nivel visual discreto sin indicar vacío antes de llegar a cero', () => {
  assert.equal(batteryLevel(0), 0);
  assert.equal(batteryLevel(0.1), 1);
  assert.equal(batteryLevel(10), 1);
  assert.equal(batteryLevel(10.1), 2);
  assert.equal(batteryLevel(99.9), 10);
  assert.equal(batteryLevel(100), 10);
});

test('HUD respeta tamaño y posición de la referencia a 320×180', () => {
  assert.deepEqual(BATTERY_HUD_BOUNDS, { x: 10, y: 139, width: 80, height: 35 });
});

test('alerta de regreso refleja margen y no solo porcentaje', () => {
  const energy = new SistemaEnergia({ energiaTrajeInicialWh: 300 });
  assert.equal(energy.getSnapshot().traje.alerta.nivel, 'regresa');
});

test('el traje solo se gasta durante EVA y se recarga dentro de la base', () => {
  const energy = createBatterySimulation();
  const interior = { exterior: false, interior: true, powerW: 144.375, charging: false };
  advanceBatterySimulation(energy, 12.5, interior);
  assert.equal(energy.energiaTrajeWh, 1155);
  advanceBatterySimulation(energy, 12.5, { ...interior, exterior: true, interior: false });
  assert.ok(Math.abs(energy.energiaTrajeWh - 1010.625) < 1e-8);
  advanceBatterySimulation(energy, 12.5, { ...interior, charging: true });
  assert.equal(energy.energiaTrajeWh, 1155);
  const baseAfterFull = energy.energiaBaseKWh;
  advanceBatterySimulation(energy, 1, { ...interior, charging: true });
  assert.ok(energy.energiaBaseKWh >= baseAfterFull);
});

test('perfil diurno y sombra afectan a la generación de la base', () => {
  let shadow = false;
  const energy = createBatterySimulation(() => shadow);
  assert.equal(energy.getSnapshot().tiempo.factorSolar, 1);
  shadow = true;
  assert.equal(energy.getSnapshot().tiempo.factorSolar, 0);
  shadow = false;
  advanceBatterySimulation(energy, 150, { exterior: false, interior: true, charging: false });
  assert.equal(energy.getSnapshot().tiempo.factorSolar, 0);
});

test('hambre llega a 60 % solo tras 170 segundos reales y no sale de 0..100', () => {
  const hoursTo60 = SEGUNDOS_REALES_HASTA_60 * 24 / 300;
  assert.equal(SEGUNDOS_REALES_HASTA_60, 170);
  assert.equal(foodPercent(0), 100);
  assert.ok(Math.abs(foodPercent(hoursTo60 / 2) - 80) < 1e-9);
  assert.ok(foodPercent(6) > 60);
  assert.ok(Math.abs(foodPercent(hoursTo60) - 60) < 1e-9);
  assert.equal(foodPercent(hoursTo60 * 2.5), 0);
  assert.equal(foodPercent(-1), 100);
});

test('hambre usa horas de juego en interior y exterior, sin segundo reloj', () => {
  const energy = createBatterySimulation();
  const interior = { exterior: false, interior: true, powerW: 144.375, charging: false };
  // 85 segundos reales = mitad del intervalo hasta el 60 %.
  advanceBatterySimulation(energy, 85, interior);
  assert.ok(Math.abs(foodPercent(energy.getSnapshot().tiempo.transcurridoHoras) - 80) < 1e-9);
  advanceBatterySimulation(energy, 85, { ...interior, exterior: true, interior: false });
  assert.ok(Math.abs(foodPercent(energy.getSnapshot().tiempo.transcurridoHoras) - 60) < 1e-9);
  // Reiniciar la partida reinicia también el hambre calculada desde su tiempo.
  assert.equal(foodPercent(createBatterySimulation().getSnapshot().tiempo.transcurridoHoras), 100);
});

test('agua usa 950 mL y 170 mL/h únicamente durante EVA; pausa en interior', () => {
  const water = new SuitWater();
  assert.equal(WATER_CAPACITY_ML, 950);
  assert.equal(WATER_CONSUMPTION_ML_PER_HOUR, 170);
  water.update(0.5, true);
  assert.equal(water.snapshot().ml, 865);
  water.update(1.5, true);
  assert.equal(water.snapshot().ml, 610);
  assert.ok(Math.abs(water.snapshot().percent - 100 * 610 / 950) < 1e-9);
  water.update(10, false);
  assert.equal(water.snapshot().ml, 610);
  assert.equal(water.refill(false), 0);
  assert.equal(water.snapshot().ml, 610);
  assert.equal(water.refill(true), 340);
  assert.equal(water.snapshot().ml, 950);
});

test('avisos del agua, autonomía y agotamiento respetan los umbrales', () => {
  const water = new SuitWater(255);
  assert.equal(water.snapshot().returnMl, 255);
  assert.equal(water.snapshot().alert, 'Regresa a la estación');
  assert.equal(water.snapshot().autonomyHours, 1.5);
  const lowWater = new SuitWater(237.5, { returnMinutes: 10, marginMinutes: 0 });
  assert.equal(lowWater.snapshot().alert, 'Te queda poca agua');
  water.update(10, true);
  assert.equal(water.snapshot().ml, 0);
  assert.equal(water.snapshot().alert, 'Agua agotada');
  assert.equal(new SuitWater().snapshot().alert, null);
});

test('agua sigue el reloj acelerado sin consumirse dos veces ni reiniciar en la base', () => {
  const energy = createBatterySimulation();
  const water = new SuitWater();
  const options = { exterior: true, interior: false, powerW: 144.375, charging: false };
  let before = energy.tiempoHoras;
  let result = advanceBatterySimulation(energy, 12.5, options); // 1 h de misión
  water.update(result.tiempo.transcurridoHoras - before, options.exterior);
  assert.ok(Math.abs(water.snapshot().ml - 780) < 1e-9);
  before = energy.tiempoHoras;
  result = advanceBatterySimulation(energy, 12.5, { ...options, exterior: false, interior: true });
  water.update(result.tiempo.transcurridoHoras - before, false);
  assert.ok(Math.abs(water.snapshot().ml - 780) < 1e-9);
});

test('las 11 imágenes de agua se usan en el mismo HUD compacto', () => {
  for (let level = 0; level <= 10; level++) {
    const name = `agua_nivel_${String(level).padStart(2, '0')}_t.png`;
    assert.ok(existsSync(new URL(`../../assets/Sprites/Pantalla/niveles/agua/${name}`, import.meta.url)));
  }
  const keys = [];
  const context = new Proxy({}, { get: (_, key) => key === 'save' || key === 'restore' || key === 'beginPath'
    || key === 'rect' || key === 'clip' || key === 'fillRect' || key === 'strokeRect'
    || key === 'drawImage' || key === 'fillText' ? () => {} : undefined, set: () => true });
  const renderer = { context };
  const assets = { get(key) { keys.push(key); return {}; } };
  drawBatteryHUD(renderer, assets, { porcentaje: 100, alerta: null }, 100, new SuitWater(610).snapshot());
  assert.ok(keys.includes('agua_nivel_07_t')); // 610/950 ≈ 64,2 %
});
