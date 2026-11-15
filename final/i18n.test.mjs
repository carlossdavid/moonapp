import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from './i18n.js';

test('la localización no altera los textos españoles ni los identificadores del juego', () => {
  assert.equal(translate('Circuito de limpieza', 'es'), 'Circuito de limpieza');
  assert.equal(translate('Modo Tortuga', 'en'), 'Turtle mode');
  assert.equal(translate('Panel solar 2', 'en'), 'Solar panel 2');
  assert.equal(translate('Step 1/5', 'en'), 'Step 1/5');
});

test('las instrucciones variables de limpieza se traducen sin cambiar su progreso', () => {
  assert.equal(translate('Fase 3/5 · Ya tienes el imán. Arrastra A a A y B a B. 1/2 conectados.', 'en'),
    'Step 3/5 · You have the magnet. Drag A to A and B to B. 1/2 connected.');
});

test('recarga, luces y electrólisis traducen texto dinámico sin tocar el español', () => {
  for (const [es, en] of [
    ['Luz Blanca', 'White light'], ['Porcentaje de luz verde', 'Green light percentage'],
    ['DISPARAR', 'FIRE'], ['CAÑÓN ROJO · OBJETIVO O₂ ROJO', 'RED CANNON · TARGET RED O₂'],
    ['Cañón azul. Objetivo: H₂ AZUL.', 'Blue cannon. Target: BLUE H₂.'],
    ['O2 SIN CONECTAR', 'O2 NOT CONNECTED'], ['¡Conexiones listas!', 'Connections ready!'],
    ['3 disparos · 2 aciertos · 1 de tipo erróneo · 0 sin objetivo', '3 shots · 2 hits · 1 wrong type · 0 missed target'],
  ]) {
    assert.equal(translate(es, 'en'), en);
    assert.equal(translate(es, 'es'), es);
  }
});
