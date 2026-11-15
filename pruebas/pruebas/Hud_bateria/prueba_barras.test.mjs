/**
 * Prueba rápida de la barra de oxígeno usando la hoja de sprites de barras.
 * 
 * Ejecutar desde la raíz de moonapp:
 *   node --test pruebas/Hud_bateria/prueba_barras.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setHUDData, getHUDData, normalizarPorcentaje } from './BatteryHUD_oxigeno.js';

test('setHUDData y getHUDData funcionan correctamente', () => {
  setHUDData({ oxygenPct: 80, batteryPct: 60, foodPct: 50, waterPct: 40, centro: { x: 100, y: 100 } });
  const data = getHUDData();
  assert.equal(data.oxygenPct, 80);
  assert.equal(data.batteryPct, 6);
  assert.equal(data.foodPct, 50);
  assert.equal(data.waterPct, 40);
  assert.equal(data.centro.x, 100);
  assert.equal(data.centro.y, 100);
});

test('niveles de anillo de oxígeno con setHUDData', () => {
  setHUDData({ oxygenPct: 0 });
  assert.equal(getHUDData().oxygenPct, 0);

  setHUDData({ oxygenPct: 50 });

  setHUDData({ oxygenPct: 100 });
});

test('normalizarPorcentaje funciona', () => {
  assert.equal(normalizarPorcentaje(80), 80);
  assert.equal(normalizarPorcentaje(0.8), 80);
  assert.equal(normalizarPorcentaje(0), 0);
  assert.equal(normalizarPorcentaje(100), 100);
  assert.equal(normalizarPorcentaje(undefined), null);
});