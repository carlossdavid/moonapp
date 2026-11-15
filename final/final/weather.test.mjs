import assert from 'node:assert/strict';
import { test } from 'node:test';
import { weatherDelta } from './weather.js';

test('el primer fotograma no adelanta el reloj', () => {
  assert.equal(weatherDelta(null, 100), 0);
});
test('un timestamp rAF anterior no envía intervalos negativos al simulador', () => {
  assert.equal(weatherDelta(100.5, 100), 0);
  assert.equal(weatherDelta(500, 0), 0);
});
test('el reloj mantiene segundos reales sin aceleración ni saltos de pestaña', () => {
  assert.ok(Math.abs(weatherDelta(100, 116.7) - .0167) < 1e-10);
  assert.equal(weatherDelta(0, 5000), 1);
});
