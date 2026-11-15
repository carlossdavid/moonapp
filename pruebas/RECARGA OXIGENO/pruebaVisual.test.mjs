import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecargaOxigenoPrueba } from './RecargaOxigenoPrueba.js';
import { FASE } from '../../src/minigames/RecargaOxigeno.js';

function avanzar(juego, seconds) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) juego.update(1 / 60);
}

test('la alternativa táctil respeta conexiones, giros, fin y reinicio', () => {
  let completados = 0;
  const juego = new RecargaOxigenoPrueba({ onComplete: () => completados++ });
  assert.equal(juego.girarValvula('o2'), false, 'no gira antes de conectar');
  assert.equal(juego.conectarLinea('o2'), true);
  assert.equal(juego.conectarLinea('o2'), false, 'no conecta dos veces');
  assert.equal(juego.conectarLinea('co2'), true);
  avanzar(juego, 2.1);
  assert.equal(juego.fase, FASE.VALVULAS);
  assert.equal(juego.conectarLinea('co2'), false, 'no vuelve a conectar tras autorizar');
  for (const id of ['o2', 'co2']) {
    assert.equal(juego.girarValvula(id), true);
    assert.equal(juego.girarValvula(id), true);
    assert.equal(juego.girarValvula(id), false, 'la válvula no supera las dos vueltas');
  }
  juego.update(1 / 60);
  assert.equal(juego.fase, FASE.COMPLETADO);
  assert.equal(juego.progreso, 1);
  avanzar(juego, 1);
  assert.equal(completados, 1);
  juego.reset();
  assert.equal(juego.fase, FASE.CONECTANDO);
});

test('la presentación local usa una sola familia sin modificar los PNG', () => {
  const imagen = { width: 1160, height: 1420 };
  const sprites = Object.fromEntries([
    'mochilaBase', 'puertoO2', 'puertoCO2', 'tanqueO2', 'tanqueCO2',
    'manija', 'manijaGiro', 'iconoAutorizado',
  ].map(key => [key, imagen]));
  const fonts = [];
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop === 'measureText') return text => ({ width: text.length * 3 });
      return target[prop] ?? (() => {});
    },
    set(target, prop, value) {
      if (prop === 'font') fonts.push(value);
      target[prop] = value;
      return true;
    },
  });
  const juego = new RecargaOxigenoPrueba({ sprites });
  juego.render({ context: ctx });
  juego.fase = FASE.VALVULAS;
  juego.render({ context: ctx });
  juego.fase = FASE.COMPLETADO;
  juego.render({ context: ctx });
  assert.ok(fonts.length > 10);
  assert.ok(fonts.every(font => font.includes('Press Start 2P')));
  assert.equal(sprites.tanqueO2, imagen, 'se conservan las imágenes originales');
});
