import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ImpactFeedback } from './presentation.js';
import { MissionMessages } from './messages.js';
import { drawMissionHUD } from './hud.js';

test('impacto se dispara por corrección física, rebota sin daño y respeta cooldown', () => {
  const feedback = new ImpactFeedback();
  feedback.motion = false;
  const body = { position: { x: 10, y: 20 }, velocity: { x: -40, y: 0 } };
  const scene = { player: { body }, physicsWorld: {
    _resolveAxisForBody(body, axis) { body.position[axis] += 1; body.velocity[axis] = 0; },
  } };
  feedback.attach(scene);
  feedback.attach(scene);
  scene.physicsWorld._resolveAxisForBody(body, 'x');
  assert.equal(feedback.count, 1);
  assert.equal(body.velocity.x, 32);
  assert.equal(feedback.particles.length, 7);
  body.velocity.x = -40;
  scene.physicsWorld._resolveAxisForBody(body, 'x');
  assert.equal(feedback.count, 1);
  feedback.tick(.5);
  assert.equal(feedback.particles.length, 0);
  body.velocity.x = -40;
  scene.physicsWorld._resolveAxisForBody(body, 'x');
  assert.equal(feedback.count, 2);
  feedback.reset();
  assert.equal(feedback.particles.length, 0);
});

test('no hay partículas en movimiento libre, triggers o correcciones lentas', () => {
  const feedback = new ImpactFeedback();
  const body = { position: { x: 10, y: 20 }, velocity: { x: 40, y: 0 } };
  const scene = { player: { body }, physicsWorld: { _resolveAxisForBody() {} } };
  feedback.attach(scene);
  scene.physicsWorld._resolveAxisForBody(body, 'x');
  assert.equal(feedback.count, 0);
});

test('VEGA: hitos únicos, mensajes pausados en módulos y cola acotada a seis', () => {
  const previousMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    const image = {}, close = {};
    const root = { querySelector: selector => selector === 'img' ? image : close,
      dataset: {}, animate() {} };
    const messages = new MissionMessages(root);
    messages.art = id => id;
    const game = { state: 'playing', mission: { elapsed: 0 }, solar: { progress: { cleanCount: 0 } } };
    messages.tick(0, game, false);
    assert.equal(messages.current, 'Bienvenida');
    messages.tick(10, game, true);
    assert.equal(messages.remaining, 8);
    assert.equal(root.hidden, true);
    game.mission.elapsed = 13;
    game.solar.progress.discovered = true;
    messages.tick(1, game, false);
    assert.equal(root.hidden, false);
    assert.deepEqual(messages.queue, ['movimiento', 'paneles', 'energia']);
    game.solar.progress.cleanCount = 2;
    game.rechargeCompleted = true;
    for (let i = 0; i < 20; i++) messages.tick(9, game, false);
    assert.equal(messages.seen.size, 6);
    assert.equal(messages.queue.length, 0);
    assert.equal(messages.current, null);
  } finally {
    globalThis.matchMedia = previousMatchMedia;
  }
});

test('HUD: cinco recursos y sprites discretos de vida 0..10', () => {
  const keys = [], labels = [], images = [];
  const ctx = new Proxy({
    fillText: text => labels.push(text),
    drawImage: (...args) => images.push(args),
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  const assets = { get: key => { keys.push(key); return { width: key.startsWith('final_life') ? 1830 : 180, height: 64 }; } };
  const state = { suit: { porcentaje: 100 }, food: 80, water: { percent: 60 }, oxygen: { porcentaje: 40 }, health: 1 };
  drawMissionHUD({ context: ctx }, assets, state);
  assert.deepEqual(labels, ['COMIDA', 'AGUA', 'BATERIA', 'OXIGENO', 'VIDA']);
  assert.equal(keys.at(-1), 'final_life_1');
  state.health = 0;
  drawMissionHUD({ context: ctx }, assets, state);
  assert.equal(keys.at(-1), 'final_life_0');
  assert.equal(images.length, 20);
});
