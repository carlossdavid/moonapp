import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CULTIVOS, CANALES, crearEstado, evaluarLuz, ambienteTexto, porcentaje, rutaPlanta } from './datos.js';

const esperados = {
  lechuga: [75, 18.75, 6.25, 0], mizuna: [81.8, 9.1, 9.1, 0],
  tomate: [90, 10, 0, 0], chile: [27, 40, 33, 0], papa: [0, 0, 0, 100], trigo: [0, 0, 0, 100],
};
for (const cultivo of CULTIVOS) {
  test(`${cultivo.nombre}: mezcla exacta y sprites existentes de todas las etapas`, () => {
    assert.deepEqual(CANALES.map(c => cultivo.luz[c.id]), esperados[cultivo.id]);
    assert.ok(Math.abs(evaluarLuz(cultivo.luz, cultivo.luz).total - 100) < 1e-9);
    assert.equal(evaluarLuz(cultivo.luz, cultivo.luz).coincide, true);
    for (let etapa = 0; etapa <= 5; etapa++) for (const frame of ['a', 'b']) {
      assert.ok(existsSync(new URL(`./Sprites/${rutaPlanta(cultivo.id, etapa, frame)}`, import.meta.url)));
    }
    assert.ok(existsSync(new URL(`./Sprites/fondos/nativo/fondo_camara_${cultivo.id}.png`, import.meta.url)));
  });
}
test('ambiente reproduce rangos y contextos, sin convertirlos en lecturas de cámara', () => {
  const c = Object.fromEntries(CULTIVOS.map(c => [c.id, c]));
  assert.deepEqual(c.lechuga.ambiente.temperatura.rango, [22.2, 23.3]);
  assert.deepEqual(c.lechuga.ambiente.humedad.rango, [38.3, 43.9]);
  assert.deepEqual(c.lechuga.ambiente.co2.rango, [2559, 2799]);
  assert.deepEqual(c.mizuna.ambiente.temperatura.rango, [22.2, 23.4]);
  assert.deepEqual(c.mizuna.ambiente.humedad.rango, [70.4, 91.9]);
  assert.deepEqual(c.mizuna.ambiente.co2.rango, [2009, 3011]);
  assert.match(c.mizuna.ambiente.co2.contexto, /ISS/);
  assert.match(c.mizuna.ambiente.humedad.contexto, /Veggie/);
  assert.equal(ambienteTexto(c.chile.ambiente.temperatura), '≈ 23 °C');
  assert.equal(ambienteTexto(c.chile.ambiente.humedad), '50 %');
  assert.equal(ambienteTexto(c.chile.ambiente.co2), '550 ppm');
  for (const id of ['tomate', 'trigo', 'papa']) {
    for (const dato of Object.values(c[id].ambiente)) {
      assert.equal(dato.rango, null);
      assert.equal(ambienteTexto(dato), 'Sin dato numérico confirmado');
    }
  }
});
test('los estados son independientes, y los valores originales no se mutan', () => {
  const estados = crearEstado();
  estados.mizuna.borrador.rojo = 0;
  assert.equal(estados.mizuna.aplicada.rojo, 81.8);
  assert.equal(CULTIVOS[0].luz.rojo, 81.8);
  assert.equal(estados.tomate.borrador.rojo, 90);
  assert.equal(crearEstado().mizuna.borrador.rojo, 81.8);
});
test('decimales y ceros se muestran sin pérdida de precisión', () => {
  assert.equal(porcentaje(18.75), '18,75');
  assert.equal(porcentaje(6.25), '6,25');
  assert.equal(porcentaje(81.8), '81,8');
  assert.equal(porcentaje(100), '100');
  assert.equal(porcentaje(0), '0');
});
test('mezcla modificada no se presenta como rendimiento biológico', () => {
  const evaluacion = evaluarLuz({ rojo: 0, azul: 0, verde: 0, blanco: 0 }, CULTIVOS[0].luz);
  assert.equal(evaluacion.total, 0);
  assert.ok(Math.abs(evaluacion.diferencia - 50) < 1e-9);
  assert.equal(evaluacion.coincide, false);
  assert.equal(evaluarLuz({ rojo: 75, azul: 18.75, verde: 6.25, blanco: 0 }, CULTIVOS[3].luz).coincide, true);
});
test('las rutas no admiten etapas ni cultivos desconocidos', () => {
  assert.throws(() => rutaPlanta('otro', 4));
  assert.throws(() => rutaPlanta('mizuna', 6));
  assert.throws(() => rutaPlanta('mizuna', 2, 'c'));
});
