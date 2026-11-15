import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CULTIVOS, CANALES, crearEstado } from './datos.js';
import {
  REVISIONES, crearFalla, iniciarMision, repararRevision, registrarRevision,
  validarFicha, fichaCientifica, pistaMision, resumenMisiones, misionActiva,
} from './misiones.js';

for (const cultivo of CULTIVOS) {
  test(`${cultivo.nombre}: tres cuidados, fallas, bitácora e insignia sin premios repetidos`, () => {
    const original = JSON.stringify(cultivo);
    const estado = crearEstado()[cultivo.id];
    assert.equal(iniciarMision(estado, cultivo), true);
    assert.equal(iniciarMision(estado, cultivo), false);
    assert.equal(misionActiva(estado), true);
    assert.equal(estado.etapa, 0);
    assert.equal(estado.dia, 1);
    assert.equal(registrarRevision(estado, cultivo), false);
    assert.equal(validarFicha(estado, cultivo, fichaCientifica(cultivo).correcta), false);
    for (let ronda = 0; ronda < 3; ronda++) {
      assert.equal(estado.mision.ronda, ronda);
      assert.equal(estado.mision.fase, 'ajustar');
      assert.notDeepEqual(estado.borrador, cultivo.luz);
      assert.ok(CANALES.every(c => estado.borrador[c.id] >= 0 && estado.borrador[c.id] <= 100));
      const puntos = estado.mision.puntos;
      assert.equal(repararRevision(estado, cultivo), false);
      assert.equal(estado.mision.puntos, puntos, 'equivocarse no resta puntos ni da premios');
      assert.ok(pistaMision(estado, cultivo).includes('VEGA'));
      assert.equal(estado.mision.puntos, puntos, 'consultar no penaliza');
      estado.borrador = { ...cultivo.luz };
      assert.equal(repararRevision(estado, cultivo), true);
      assert.equal(estado.etapa, REVISIONES[ronda].etapa);
      assert.equal(estado.mision.puntos, puntos + 100);
      assert.equal(repararRevision(estado, cultivo), false);
      assert.equal(estado.mision.puntos, puntos + 100);
      assert.equal(registrarRevision(estado, cultivo), true);
      assert.equal(estado.mision.puntos, puntos + 125);
      assert.equal(registrarRevision(estado, cultivo), false);
      assert.equal(estado.mision.registros.length, ronda + 1);
    }
    assert.equal(estado.mision.fase, 'ficha');
    assert.equal(estado.mision.puntos, 375);
    assert.equal(validarFicha(estado, cultivo), false);
    assert.equal(validarFicha(estado, cultivo, 'incorrecta'), false);
    assert.equal(estado.mision.puntos, 375);
    assert.equal(validarFicha(estado, cultivo, fichaCientifica(cultivo).correcta), true);
    assert.equal(validarFicha(estado, cultivo, fichaCientifica(cultivo).correcta), false);
    assert.equal(estado.mision.puntos, 450);
    assert.equal(misionActiva(estado), false);
    assert.equal(estado.mision.registros.length, 3);
    assert.equal(estado.etapa, 5);
    assert.equal(estado.dia, 3);
    assert.equal(JSON.stringify(cultivo), original, 'referencias ambientales y recetas intactas');
  });
}
test('tolerancia del juego por canal, sin aceptar NaN ni valores fuera de 0..100', () => {
  const cultivo = CULTIVOS[0];
  const estado = crearEstado().mizuna;
  iniciarMision(estado, cultivo);
  for (const valor of [NaN, Infinity, -1, 101]) {
    estado.borrador = { ...cultivo.luz, rojo: valor };
    assert.equal(repararRevision(estado, cultivo), false);
  }
  estado.borrador = { ...cultivo.luz, rojo: cultivo.luz.rojo + .51 };
  assert.equal(repararRevision(estado, cultivo), false);
  estado.borrador = { ...cultivo.luz, rojo: cultivo.luz.rojo + .5 };
  assert.equal(repararRevision(estado, cultivo), true);
});
test('datos desconocidos se aprenden como desconocidos; no se exige inventar ambiente', () => {
  for (const cultivo of CULTIVOS.filter(c => ['tomate', 'papa', 'trigo'].includes(c.id))) {
    assert.equal(fichaCientifica(cultivo).correcta, 'sin_dato');
    assert.ok(Object.values(cultivo.ambiente).every(d => d.rango === null));
  }
  assert.deepEqual(CULTIVOS.find(c => c.id === 'trigo').luz, { rojo: 0, azul: 0, verde: 0, blanco: 100 });
});
test('las seis plantas suman 2700 puntos; sus misiones no se mezclan', () => {
  const estados = crearEstado();
  assert.deepEqual(resumenMisiones(estados), { completas: 0, puntos: 0 });
  for (const cultivo of CULTIVOS) {
    const estado = estados[cultivo.id];
    iniciarMision(estado, cultivo);
    for (let i = 0; i < 3; i++) {
      estado.borrador = { ...cultivo.luz };
      repararRevision(estado, cultivo);
      registrarRevision(estado, cultivo);
    }
    validarFicha(estado, cultivo, fichaCientifica(cultivo).correcta);
  }
  assert.deepEqual(resumenMisiones(estados), { completas: 6, puntos: 2700 });
});
test('las fallas no mutan la receta ni aceptan revisiones desconocidas', () => {
  const receta = { rojo: 0, azul: 0, verde: 0, blanco: 100 };
  assert.deepEqual(crearFalla(receta, 1), { rojo: 0, azul: 0, verde: 0, blanco: 0 });
  assert.equal(receta.blanco, 100);
  assert.throws(() => crearFalla(receta, 3));
});
