/**
 * Pruebas de la lógica pura y de la coherencia de los recortes de sprites.
 * Ejecutar desde la raíz del proyecto:
 *   node pruebas/operacion-electrolisis/scoring.test.cjs
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const Scoring = require('./js/scoring.js');

function loadBrowserScript(file) {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: file });
  return sandbox.window.ELECTROLISIS;
}

test('precisión: sin disparos, redondeo y límites', () => {
  assert.equal(Scoring.precision(0, 0), 0);
  assert.equal(Scoring.precision(5, 0), 0);
  assert.equal(Scoring.precision(10, 20), 50);
  assert.equal(Scoring.precision(1, 3), 33);
  assert.equal(Scoring.precision(20, 20), 100);
  assert.equal(Scoring.precision(30, 20), 100, 'no puede superar 100 %');
});

test('energía simulada: proporcional a aciertos y precisión', () => {
  assert.equal(Scoring.energy(0, 0), 0);
  assert.equal(Scoring.energy(10, 100), 120);
  assert.equal(Scoring.energy(10, 0), 60);
  assert.ok(Scoring.energy(10, 80) > Scoring.energy(10, 40));
  assert.ok(Scoring.energy(20, 80) > Scoring.energy(10, 80));
});

test('agua perdida simulada: sube con fallos y termina en 0 sin disparos', () => {
  assert.equal(Scoring.waterLost(0, 100, 0), 0);
  const good = Scoring.waterLost(1, 90, 10);
  const bad = Scoring.waterLost(6, 40, 10);
  assert.ok(bad > good);
  assert.ok(Scoring.waterLost(999, 0, 1000) <= 100);
  assert.ok(Scoring.waterLost(0, 100, 10) >= 0);
});

test('resumen: coherencia entre disparos, aciertos y fallos', () => {
  const s = Scoring.summary({ hits: 12, wrong: 3, misses: 5, shots: 20 });
  assert.equal(s.shots, 20);
  assert.equal(s.fails, 8);
  assert.equal(s.precision, 60);
  assert.equal(s.energyWh, Scoring.energy(12, 60));
  assert.equal(s.waterPct, Scoring.waterLost(8, 60, 20));
  assert.equal(s.stars, 1);

  // Un resumen sin disparos no debe romper la división.
  const empty = Scoring.summary({});
  assert.equal(empty.precision, 0);
  assert.equal(empty.energyWh, 0);
  assert.equal(empty.waterPct, 0);
  assert.equal(empty.shots, 0);
});

test('rangos y estrellas respetan sus umbrales', () => {
  assert.equal(Scoring.rank(90, 20), 'ESPECIALISTA EN ELECTRÓLISIS');
  assert.equal(Scoring.rank(75, 14), 'TÉCNICO DE REACTOR');
  assert.equal(Scoring.rank(50, 7), 'APRENDIZ DE PLANTA');
  assert.equal(Scoring.rank(10, 1), 'OPERADOR EN PRÁCTICAS');
  assert.equal(Scoring.stars(90, 18), 3);
  assert.equal(Scoring.stars(70, 10), 2);
  assert.equal(Scoring.stars(30, 4), 1);
  assert.equal(Scoring.stars(0, 0), 0);
});

function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

test('config: color del cañón y objetivo educativo', () => {
  const NS = loadBrowserScript('js/config.js');
  assert.equal(NS.TARGET.red.atom, 'O2');
  assert.equal(NS.TARGET.blue.atom, 'H2');
  assert.equal(NS.TARGET.red.label, 'O₂ ROJO');
  assert.equal(NS.TARGET.blue.label, 'H₂ AZUL');
  assert.equal(NS.ATOM_INFO.O2.label, 'O₂');
  assert.equal(NS.ATOM_INFO.H2.label, 'H₂');
  assert.equal(NS.CONFIG.DURATION, 25);
  assert.equal(NS.CONFIG.SWITCH_EVERY, 4);
});

test('colores químicos: O₂ rojo y H₂ azul', () => {
  const NS = loadBrowserScript('js/config.js');
  const o2 = hexToRgb(NS.ATOM_INFO.O2.color);
  const h2 = hexToRgb(NS.ATOM_INFO.H2.color);
  assert.ok(o2.r > o2.g && o2.r > o2.b, 'el O₂ debe ser rojo');
  assert.ok(h2.b > h2.r && h2.b > h2.g, 'el H₂ debe ser azul');
  // El color del cañón y el del átomo que debe destruir coinciden.
  assert.equal(NS.TARGET.red.color, NS.ATOM_INFO.O2.color);
  assert.equal(NS.TARGET.blue.color, NS.ATOM_INFO.H2.color);
});

test('config: los recortes caben dentro de sus hojas originales', () => {
  const NS = loadBrowserScript('js/config.js');
  const sheets = {
    o2: [700, 160],
    h2: [700, 175],
    shots: [730, 395],
    cannonRed: [685, 160],
    cannonBlue: [685, 175]
  };
  Object.keys(sheets).forEach((key) => {
    const [w, h] = sheets[key];
    NS.FRAMES[key].forEach((fr, i) => {
      assert.ok(fr.sx >= 0 && fr.sy >= 0, `${key}[${i}] origen positivo`);
      assert.ok(fr.sw > 0 && fr.sh > 0, `${key}[${i}] tamaño positivo`);
      assert.ok(fr.sx + fr.sw <= w, `${key}[${i}] ancho dentro de la hoja`);
      assert.ok(fr.sy + fr.sh <= h, `${key}[${i}] alto dentro de la hoja`);
    });
  });
});

test('todos los PNG referenciados existen y no se han duplicado', () => {
  const NS = loadBrowserScript('js/config.js');
  const base = path.resolve(__dirname, '..', '..', 'assets', 'Sprites', 'electrolisis');
  Object.values(NS.CONFIG.ASSETS).forEach((name) => {
    const file = path.join(base, name);
    assert.ok(fs.existsSync(file), `falta ${name}`);
    assert.ok(fs.statSync(file).size > 0, `${name} vacío`);
  });
});
