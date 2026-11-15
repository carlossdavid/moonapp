import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecargaOxigeno, RECARGA_CONFIG, RECARGA_LAYOUT, FASE, ESTADO_LINEA } from '../../src/minigames/RecargaOxigeno.js';

function avanzar(juego, segundos) {
  for (let i = 0; i < Math.ceil(segundos * 60); i++) juego.update(1 / 60);
}

function arrastrar(juego, linea, destino) {
  Object.assign(juego.pointer, { ...linea.free, down: true, justDown: true });
  juego.update(1 / 60);
  Object.assign(juego.pointer, { x: destino.x, y: destino.y });
  juego.update(1 / 60);
  Object.assign(juego.pointer, { down: false, justUp: true });
  juego.update(1 / 60);
}

function girar(juego, valvula, horario = true) {
  const radio = 8;
  Object.assign(juego.pointer, { x: valvula.x + radio, y: valvula.y, down: true, justDown: true });
  juego.update(1 / 60);
  for (let i = 1; i <= 40; i++) {
    const a = (horario ? 1 : -1) * i * Math.PI / 16;
    Object.assign(juego.pointer, { x: valvula.x + radio * Math.cos(a), y: valvula.y + radio * Math.sin(a) });
    juego.update(1 / 60);
  }
  Object.assign(juego.pointer, { down: false, justUp: true });
  juego.update(1 / 60);
}

test('layout proporcional, sin logo; manijas y puertos centrados', () => {
  const juego = new RecargaOxigeno();
  assert.equal(RECARGA_LAYOUT.banner.w / 320, 0.77);
  assert.ok(RECARGA_LAYOUT.modulo.w / 320 > 0.4);
  assert.equal('logo' in RECARGA_LAYOUT, false);
  assert.deepEqual(juego.valves.map((v) => v.x), [RECARGA_LAYOUT.valvulaO2.x, RECARGA_LAYOUT.valvulaCO2.x]);
  assert.equal(juego.progreso, 0);
  assert.equal(juego.fase, FASE.CONECTANDO);
  assert.ok(juego.slots.o2.r * 2 > RECARGA_CONFIG.anchoVisualPuerto);
});

test('error amigable en puerto incorrecto y retorno suave, sin perder la otra conexión', () => {
  const juego = new RecargaOxigeno();
  const [azul, verde] = juego.lines;
  arrastrar(juego, verde, juego.slots.co2);
  avanzar(juego, RECARGA_CONFIG.duracionIman + 0.1);
  assert.equal(verde.estado, ESTADO_LINEA.CONECTADO);
  arrastrar(juego, azul, juego.slots.co2);
  assert.equal(juego.hayFuga, true);
  assert.equal(azul.estado, ESTADO_LINEA.DESCONECTADO);
  assert.equal(juego.fuga.x, juego.slots.co2.x);
  assert.ok(juego.particles.length);
  avanzar(juego, RECARGA_CONFIG.duracionRetorno + 0.1);
  assert.deepEqual(azul.free, azul.reposo);
  assert.equal(verde.estado, ESTADO_LINEA.CONECTADO);
  avanzar(juego, RECARGA_CONFIG.duracionFuga);
  assert.equal(juego.hayFuga, false);
});

test('autorización temporizada, cierre horario y callback una sola vez', () => {
  let completados = 0;
  const juego = new RecargaOxigeno({ onComplete: () => completados++ });
  girar(juego, juego.valves[0]);
  assert.equal(juego.progreso, 0);
  arrastrar(juego, juego.lines[0], juego.slots.o2);
  arrastrar(juego, juego.lines[1], juego.slots.co2);
  avanzar(juego, RECARGA_CONFIG.duracionIman + 0.1);
  assert.equal(juego.fase, FASE.AUTORIZADO);
  assert.equal(juego.ambosConectados, true);
  avanzar(juego, RECARGA_CONFIG.duracionAutorizado + 0.1);
  assert.equal(juego.fase, FASE.VALVULAS);
  girar(juego, juego.valves[0], false);
  assert.equal(juego.progreso, 0);
  girar(juego, juego.valves[0]);
  assert.ok(juego.progreso > 0 && juego.progreso <= 0.5);
  girar(juego, juego.valves[0]);
  girar(juego, juego.valves[1]);
  girar(juego, juego.valves[1]);
  assert.equal(juego.progreso, 1);
  assert.equal(juego.fase, FASE.COMPLETADO);
  avanzar(juego, 1);
  assert.equal(completados, 1);
});

test('render sin logo ni progreso inicial; muestra progreso en válvulas', () => {
  const juego = new RecargaOxigeno();
  const textos = [];
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop === 'measureText') return (s) => ({ width: s.length * 3 });
      if (prop === 'fillText') return (s) => textos.push(s);
      return target[prop] ?? (() => {});
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  const renderer = { context: ctx };
  juego.render(renderer);
  assert.equal(textos.some((s) => s.includes('NASA')), false);
  assert.equal(textos.some((s) => s.startsWith('VÁLVULA')), false);
  assert.equal(textos.includes('RECARGA O₂'), false);
  textos.length = 0;
  juego.fase = FASE.VALVULAS;
  juego.render(renderer);
  assert.equal(textos.includes('RECARGA O₂'), true);
});

test('los pointer events comparten coordenadas con ratón y toque; cancelación devuelve el extremo', () => {
  const eventos = new Map();
  const canvas = {
    style: { touchAction: '' },
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 640, height: 360 }),
    addEventListener: (tipo, fn) => eventos.set(tipo, fn),
    removeEventListener: (tipo) => eventos.delete(tipo),
    setPointerCapture: () => {},
  };
  const juego = new RecargaOxigeno();
  juego.mount(canvas);
  assert.equal(canvas.style.touchAction, 'none');
  const evento = (x, y) => ({ clientX: x * 2 + 10, clientY: y * 2 + 20, pointerId: 1, preventDefault() {} });
  eventos.get('pointerdown')(evento(juego.lines[0].free.x, juego.lines[0].free.y));
  juego.update(1 / 60);
  eventos.get('pointermove')(evento(juego.slots.o2.x, juego.slots.o2.y));
  juego.update(1 / 60);
  eventos.get('pointercancel')(evento(juego.slots.o2.x, juego.slots.o2.y));
  avanzar(juego, RECARGA_CONFIG.duracionRetorno + 0.1);
  assert.deepEqual(juego.lines[0].free, juego.lines[0].reposo);
  assert.equal(juego.lines[0].estado, ESTADO_LINEA.DESCONECTADO);
  juego.unmount();
  assert.equal(canvas.style.touchAction, '');
});

test('renderiza las piezas originales sin colocar una insignia en la tapa', () => {
  const imagen = { width: 286, height: 206 };
  const tanqueAzul = { width: 1160, height: 1420 };
  const tanqueVerde = { width: 1160, height: 1420 };
  const puertoAzul = { width: 218, height: 243 };
  const puertoVerde = { width: 218, height: 243 };
  const insignia = { width: 1402, height: 1122 };
  const sprites = Object.fromEntries([
    'mochilaBase',
    'manija', 'manijaGiro', 'fugaGas',
  ].map((clave) => [clave, imagen]));
  sprites.tanqueO2 = tanqueAzul;
  sprites.tanqueCO2 = tanqueVerde;
  sprites.puertoO2 = puertoAzul;
  sprites.puertoCO2 = puertoVerde;
  sprites.insigniaNasa = insignia;
  const dibujos = [];
  const cortes = [];
  const puertos = [];
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop === 'measureText') return (s) => ({ width: s.length * 3 });
      if (prop === 'drawImage') return (img, ...args) => {
        dibujos.push(img);
        if ((img === tanqueAzul || img === tanqueVerde) && args.length === 8) cortes.push([img, args[0]]);
        if (img === puertoAzul || img === puertoVerde) puertos.push(args);
      };
      return target[prop] ?? (() => {});
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  new RecargaOxigeno({ sprites }).render({ context: ctx });
  assert.equal(dibujos.includes(insignia), false);
  assert.ok(dibujos.includes(tanqueAzul));
  assert.ok(dibujos.includes(tanqueVerde));
  assert.equal(puertos.length, 2);
  for (const args of puertos) {
    assert.equal(args[6], RECARGA_CONFIG.anchoVisualPuerto);
    assert.ok(Math.abs(args[7] - RECARGA_CONFIG.anchoVisualPuerto * 243 / 218) < 0.001);
  }
  // Las franjas de la manguera recorren el PNG original, no repiten una banda.
  assert.ok(new Set(cortes.filter(([img]) => img === tanqueAzul).map(([, x]) => x)).size > 20);
  assert.ok(new Set(cortes.filter(([img]) => img === tanqueVerde).map(([, x]) => x)).size > 20);
});
