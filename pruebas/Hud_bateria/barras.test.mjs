/**
 * Pruebas del arte de barras propuesto (assets/Sprites/barras/_preview.png)
 * y de su acoplamiento con assets/hud/suit_status.json.
 *
 * Ejecutar desde la raíz de moonapp:
 *   node --test pruebas/Hud_bateria/barras.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ATLAS_ANCHO,
  ATLAS_ALTO,
  ATLAS_URL,
  ARCOS,
  ANILLOS,
  BARRAS,
  ICONOS,
  nivelAnillo,
  nivelArco,
  nivelBarra,
  normalizarPorcentaje,
  teñirPixel,
  validarAtlas,
} from './atlasBarras.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const atlasPath = path.join(here, '..', '..', 'assets', 'Sprites', 'barras', '_preview.png');
const jsonPath = path.join(here, '..', '..', 'assets', 'hud', 'suit_status.json');

function pngSize(buffer) {
  assert.equal(buffer.readUInt32BE(0), 0x89504e47, 'firma PNG esperada');
  assert.equal(buffer.toString('ascii', 12, 16), 'IHDR', 'primer bloque IHDR');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('la hoja propuesta existe y mide 760×620', () => {
  const buffer = fs.readFileSync(atlasPath);
  assert.deepEqual(pngSize(buffer), { width: ATLAS_ANCHO, height: ATLAS_ALTO });
});

test('todos los rectángulos del atlas están dentro de la hoja', () => {
  assert.deepEqual(validarAtlas(), []);
  assert.equal(Object.keys(BARRAS).length, 4);
  assert.ok(Object.values(BARRAS).every((grupo) => grupo.niveles.length === 5));
  assert.equal(ARCOS.niveles.length, 6);
  assert.equal(ANILLOS.niveles.length, 3);
});

test('niveles de barra: 5 pasos (0, 25, 50, 75, 100 %)', () => {
  assert.equal(nivelBarra(0), 0);
  assert.equal(nivelBarra(12), 0);
  assert.equal(nivelBarra(25), 1);
  assert.equal(nivelBarra(50), 2);
  assert.equal(nivelBarra(75), 3);
  assert.equal(nivelBarra(100), 4);
  assert.equal(nivelBarra(80), 3);
});

test('niveles de arco: 6 pasos (0, 20, 40, 60, 80, 100 %)', () => {
  assert.equal(nivelArco(0), 0);
  assert.equal(nivelArco(20), 1);
  assert.equal(nivelArco(40), 2);
  assert.equal(nivelArco(60), 3);
  assert.equal(nivelArco(80), 4);
  assert.equal(nivelArco(100), 5);
});

test('niveles de anillo: 3 pasos (0, 50, 100 %)', () => {
  assert.equal(nivelAnillo(0), 0);
  assert.equal(nivelAnillo(24), 0);
  assert.equal(nivelAnillo(25), 1);
  assert.equal(nivelAnillo(50), 1);
  assert.equal(nivelAnillo(74), 1);
  assert.equal(nivelAnillo(75), 2);
  assert.equal(nivelAnillo(100), 2);
});

test('normalizarPorcentaje acepta porcentajes y proporciones', () => {
  assert.equal(normalizarPorcentaje(80), 80);
  assert.equal(normalizarPorcentaje(0.8), 80);
  assert.equal(normalizarPorcentaje(1), 100);
  assert.equal(normalizarPorcentaje(-5), 0);
  assert.equal(normalizarPorcentaje(250), 100);
  assert.equal(normalizarPorcentaje(undefined), null);
  assert.equal(normalizarPorcentaje(Number.NaN), null);
});

test('suit_status.json es el origen del oxígeno y la batería', () => {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  for (const clave of ['oxygen', 'battery']) {
    assert.equal(typeof data[clave], 'number', `${clave} debe ser numérico`);
    assert.ok(data[clave] >= 0 && data[clave] <= 100, `${clave} en 0..100`);
  }
  // La ruta que carga Game.init es exactamente esta.
  assert.ok(ATLAS_URL.startsWith('./assets/'));
});

test('el retinte en memoria vuelve verde la barra naranja de comida', () => {
  const [r, g, b] = teñirPixel(192, 96, 0, 118);
  assert.ok(g > r && g > b, `esperaba verde dominante y sale rgb(${r},${g},${b})`);
  // Los píxeles desaturados (contorno, marco) no se retintan.
  assert.deepEqual(teñirPixel(96, 96, 144, 118), [96, 96, 144]);
  assert.deepEqual(teñirPixel(0, 0, 0, 118), [0, 0, 0]);
});

test('los iconos usados por el HUD existen en la hoja', () => {
  for (const clave of ['manzana', 'gota', 'rayo']) {
    const ic = ICONOS[clave];
    assert.ok(ic.x + ic.w <= ATLAS_ANCHO && ic.y + ic.h <= ATLAS_ALTO, `icono ${clave} fuera`);
  }
});
