import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MissionState } from './mission-state.js';

test('primer repuesto a 20 s; siguientes cada 60 s, máximo tres', () => {
  const m = new MissionState();
  m.tick(19, [100]); assert.equal(m.magnets.length, 1);
  m.tick(1, [100]); assert.equal(m.magnets.length, 2);
  m.tick(60, [100]); assert.equal(m.magnets.length, 3);
  m.tick(60, [100]); assert.equal(m.magnets.length, 3);
  m.magnets.shift();
  m.tick(60, [100]); assert.equal(m.magnets.length, 3);
  assert.equal(new Set(m.magnets.map(p => `${p.x},${p.y}`)).size, 3);
});
test('aviso a 3 minutos reales de partida aunque el tiempo activo esté pausado', () => {
  const m = new MissionState();
  m.checkAlert(180000); assert.equal(m.alertPending, false);
  m.start(1000);
  m.checkAlert(180999); assert.equal(m.alertPending, false);
  m.checkAlert(181000); assert.equal(m.alertPending, true);
  assert.equal(m.remainingAlertSeconds(1000), 180);
  assert.equal(m.remainingAlertSeconds(121000), 60);
  assert.equal(m.remainingAlertSeconds(181000), 0);
  assert.equal(m.elapsed, 0);
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
