import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MissionState } from './mission-state.js';

test('imanes cada 60 s, máximo tres y espacios libres reutilizados', () => {
  const m = new MissionState();
  m.tick(59, [100]); assert.equal(m.magnets.length, 1);
  m.tick(1, [100]); assert.equal(m.magnets.length, 2);
  m.tick(60, [100]); assert.equal(m.magnets.length, 3);
  m.tick(60, [100]); assert.equal(m.magnets.length, 3);
  m.magnets.shift();
  m.tick(60, [100]); assert.equal(m.magnets.length, 3);
  assert.equal(new Set(m.magnets.map(p => `${p.x},${p.y}`)).size, 3);
});
test('aviso a los 180 s, sin desbloquear por tiempo el visor', () => {
  const m = new MissionState();
  m.tick(179, [100]); assert.equal(m.alertPending, false);
  m.tick(1, [100]); assert.equal(m.alertPending, true);
  assert.equal(m.visorUnlocked, false);
});
test('cinco segundos continuos, recuperación y muerte irreversible', () => {
  const m = new MissionState();
  m.tick(4, [0, 100]); assert.equal(m.dead, false);
  assert.ok(Math.abs(m.health - 20) < 1e-6);
  m.tick(1, [100, 100]); assert.equal(m.health, 100);
  m.tick(4.99, [0]); assert.equal(m.dead, false);
  m.tick(.01, [0]); assert.equal(m.dead, true);
  m.tick(1, [100]); assert.equal(m.dead, true);
});
