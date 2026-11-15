/**
 * @file Minijuego "Recarga de oxígeno".
 *
 * Reconstruye la interacción del diseño `RECARGA_OXIGENO.jpeg`: una mochila
 * con dos válvulas (O₂ y CO₂), dos conectores y dos paneles laterales
 * (Reserva de O₂ y Extracción de CO₂) con mangueras que se arrastran.
 *
 * Flujo (máquina de estados):
 *   1. CONECTANDO → arrastrar cada manguera al puerto correspondiente;
 *                   un error muestra una fuga temporal y permite reintentar.
 *   2. AUTORIZADO → con ambas líneas conectadas se muestra la activación
 *                   "Extracción y recarga autorizada" y el estado pasa a
 *                   CONECTADO.
 *   3. VALVULAS   → girar ambos volantes en sentido horario hasta cerrarlos.
 *   4. COMPLETADO → recarga terminada y callback emitido una sola vez.
 *
 * La clase es independiente del motor: sólo necesita un `renderer` compatible
 * (con `.context` de Canvas 2D y `begin/end`) y un `<canvas>` para montar los
 * eventos de puntero. Se puede usar desde una escena del juego o desde una
 * página de prueba.
 *
 * Soporta sprites opcionales (pixel art). Si no hay sprites, cae a dibujo
 * procedimental.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../config.js';

// ============================================================================
// Constantes de estado
// ============================================================================

/** Fases del minijuego. */
export const RECARGA_CONFIG = Object.freeze({
  vueltasPorValvula: 2,
  toleranciaPuerto: 6,
  // Los puertos dibujados son más pequeños que su hitbox para facilitar el touch.
  anchoVisualPuerto: 11,
  duracionIman: 0.22,
  duracionRetorno: 0.35,
  duracionFuga: 1.2,
  duracionAutorizado: 1.5,
});

export const FASE = Object.freeze({
  CONECTANDO: 'conectando',
  AUTORIZADO: 'autorizado',
  VALVULAS: 'valvulas',
  COMPLETADO: 'completado',
});

/** Estado de cada línea (manguera). */
export const ESTADO_LINEA = Object.freeze({
  DESCONECTADO: 'desconectado',
  CONECTADO: 'conectado',
  FUGA: 'fuga',
});

const COLOR = Object.freeze({
  fondo: '#10151d',
  pared: '#2a303b',
  paredOscura: '#1f242d',
  remache: '#141820',
  panel: '#0c1a29',
  panelBorde: '#22415e',
  modulo: '#d9dee6',
  moduloOscuro: '#aab3bf',
  moduloBorde: '#7c8794',
  metal: '#cbd4de',
  metalOscuro: '#8b96a4',
  o2: '#43d3ff',
  o2Oscuro: '#1c7fa6',
  co2: '#4ce08c',
  co2Oscuro: '#1f8a52',
  valvula: '#e6433c',
  valvulaOscura: '#8f1f1b',
  valvulaBrillo: '#f27b74',
  texto: '#eaf6ff',
  textoSuave: '#a9b7c6',
  ok: '#4ce08c',
  fuga: '#ff5a5a',
  ambar: '#ffc857',
  oscuro: 'rgba(6,10,16,0.78)',
});

const FONT = Object.freeze({
  titulo: '5px "Press Start 2P", Arial, sans-serif',
  sub: 'bold 7px Verdana, Arial, sans-serif',
  cuerpo: 'bold 6px Verdana, Arial, sans-serif',
  mini: '5px Verdana, Arial, sans-serif',
});

/**
 * Distribución en píxeles lógicos (320×180) derivada del mockup 16:9.
 * Todos los valores son ajustables sin tocar la lógica.
 */
const xPct = (value) => LOGICAL_WIDTH * value / 100;
const yPct = (value) => LOGICAL_HEIGHT * value / 100;
// Porcentajes del lienzo 1600×900 de referencia; el Renderer escala el lienzo
// lógico 320×180 de manera uniforme para ratón y touch.
export const RECARGA_LAYOUT = Object.freeze({
  banner: { x: xPct(11.5), y: yPct(1.8), w: xPct(77), h: yPct(9) },
  estado: { x: xPct(72), y: yPct(13), w: xPct(26), h: yPct(19) },
  modulo: { x: xPct(28.8), y: yPct(15), w: xPct(42.4), h: yPct(68) },
  panelO2: { x: xPct(1.5), y: yPct(37), w: xPct(20), h: yPct(38) },
  panelCO2: { x: xPct(78.5), y: yPct(37), w: xPct(20), h: yPct(38) },
  barra: { x: xPct(2.5), y: yPct(87), w: xPct(95), h: yPct(10) },
  valvulaO2: { x: xPct(37.4), y: yPct(39), r: xPct(3.2) },
  valvulaCO2: { x: xPct(62.6), y: yPct(39), r: xPct(3.2) },
  slotO2: { x: xPct(37.4), y: yPct(61), r: xPct(3.5) },
  slotCO2: { x: xPct(62.6), y: yPct(61), r: xPct(3.5) },
  mangueraO2: { anchorX: xPct(11.75), anchorY: yPct(46), reposoX: xPct(24), reposoY: yPct(61) },
  mangueraCO2: { anchorX: xPct(88.5), anchorY: yPct(46), reposoX: xPct(76), reposoY: yPct(61) },
  flechaO2: { x: xPct(24.5), y: yPct(54) },
  flechaCO2: { x: xPct(75.5), y: yPct(54) },
});

// Coordenadas medidas en los PNG nuevos 1160×1420; sólo la zona entre la boca
// del cilindro y el conector libre se deforma. El depósito se dibuja intacto.
const HOSE_ART = Object.freeze({
  o2: { fixed: { x: 248, y: 243 }, free: { x: 1005, y: 238 }, start: 240, end: 1030, top: 200, bottom: 345 },
  co2: { fixed: { x: 900, y: 255 }, free: { x: 131, y: 258 }, start: 106, end: 921, top: 209, bottom: 351 },
});

// ============================================================================
// Utilidades
// ============================================================================

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

/** Normaliza un ángulo a (-π, π]. */
function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Punto sobre una curva cuadrática. */
function quadPoint(ax, ay, cx, cy, bx, by, t) {
  const u = 1 - t;
  return {
    x: u * u * ax + 2 * u * t * cx + t * t * bx,
    y: u * u * ay + 2 * u * t * cy + t * t * by,
  };
}

/**
 * Texto con fuente/color/alineación.
 * @param {CanvasRenderingContext2D} ctx
 */
function txt(ctx, text, x, y, opts = {}) {
  ctx.save();
  ctx.font = opts.font || FONT.cuerpo;
  ctx.fillStyle = opts.color || COLOR.texto;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'top';
  ctx.fillText(text, Math.round(x), Math.round(y));
  ctx.restore();
}

/**
 * Dibuja una imagen escalada manteniendo pixel art nítido.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement|HTMLCanvasElement} img
 * @param {number} dx - destino x
 * @param {number} dy - destino y
 * @param {number} dw - destino ancho
 * @param {number} dh - destino alto
 * @param {number} [sx=0] - source x
 * @param {number} [sy=0] - source y
 * @param {number} [sw] - source ancho (default img.width)
 * @param {number} [sh] - source alto (default img.height)
 */
function drawSprite(ctx, img, dx, dy, dw, dh, sx = 0, sy = 0, sw = null, sh = null) {
  if (!img) return false;
  if (img.width === 0 || img.height === 0) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sw || img.width, sh || img.height, Math.round(dx), Math.round(dy), dw, dh);
  return true;
}

/**
 * Dibuja un sprite centrado en un punto.
 */
function drawSpriteCentered(ctx, img, cx, cy, dw, dh) {
  return drawSprite(ctx, img, cx - dw / 2, cy - dh / 2, dw, dh);
}

// ============================================================================
// Minijuego
// ============================================================================

export class RecargaOxigeno {
  /**
   * @param {{
   *   onComplete?: (minigame: RecargaOxigeno) => void,
   *   onCancel?: (minigame: RecargaOxigeno) => void,
    *   valvulasNecesarias?: number, // vueltas completas por válvula para terminar
   *   sprites?: {
   *     mochilaBase?: HTMLImageElement|HTMLCanvasElement,
   *     puertoO2?: HTMLImageElement|HTMLCanvasElement,
   *     puertoCO2?: HTMLImageElement|HTMLCanvasElement,
    *     tanqueO2?: HTMLImageElement|HTMLCanvasElement,
    *     tanqueCO2?: HTMLImageElement|HTMLCanvasElement,
   *     manija?: HTMLImageElement|HTMLCanvasElement,
   *     manijaGiro?: HTMLImageElement|HTMLCanvasElement,
   *     cilindroO2?: HTMLImageElement|HTMLCanvasElement,
   *     cilindroCO2?: HTMLImageElement|HTMLCanvasElement,
   *     iconoAutorizado?: HTMLImageElement|HTMLCanvasElement,
   *     iconoAlerta?: HTMLImageElement|HTMLCanvasElement,
   *     fugaGas?: HTMLImageElement|HTMLCanvasElement,
   *   },
   * }} [opts]
   */
  constructor(opts = {}) {
    this.opts = opts;
    this.onComplete = opts.onComplete || null;
    this.onCancel = opts.onCancel || null;
    /** Vueltas completas que hay que girar cada válvula para completar. */
    this.vueltasObjetivo = Math.max(0.25, opts.valvulasNecesarias ?? RECARGA_CONFIG.vueltasPorValvula);

    /** @type {Object<string, HTMLImageElement|HTMLCanvasElement>} */
    this.sprites = opts.sprites || {};

    this.canvas = null;
    this.time = 0;
    this._listeners = null;

    /** @type {{x:number,y:number,down:boolean,justDown:boolean,justUp:boolean}} */
    this.pointer = { x: 0, y: 0, down: false, justDown: false, justUp: false };

    this._init();
  }

  // --------------------------------------------------------------------------
  // Inicialización / reinicio
  // --------------------------------------------------------------------------

  _init() {
    const L = RECARGA_LAYOUT;
    const objetivo = Math.PI * 2 * this.vueltasObjetivo;

    /** @type {Array<object>} */
    this.lines = [
      {
        id: 'o2',
        short: 'O₂',
        nombre: 'Reserva de O₂',
        color: COLOR.o2,
        colorOscuro: COLOR.o2Oscuro,
        anchor: { x: L.mangueraO2.anchorX, y: L.mangueraO2.anchorY },
        reposo: { x: L.mangueraO2.reposoX, y: L.mangueraO2.reposoY },
        slotCorrecto: 'o2',
        free: { x: L.mangueraO2.reposoX, y: L.mangueraO2.reposoY },
        estado: ESTADO_LINEA.DESCONECTADO,
        leakTimer: 0,
        animacion: null,
      },
      {
        id: 'co2',
        short: 'CO₂',
        nombre: 'Extracción de CO₂',
        color: COLOR.co2,
        colorOscuro: COLOR.co2Oscuro,
        anchor: { x: L.mangueraCO2.anchorX, y: L.mangueraCO2.anchorY },
        reposo: { x: L.mangueraCO2.reposoX, y: L.mangueraCO2.reposoY },
        slotCorrecto: 'co2',
        free: { x: L.mangueraCO2.reposoX, y: L.mangueraCO2.reposoY },
        estado: ESTADO_LINEA.DESCONECTADO,
        leakTimer: 0,
        animacion: null,
      },
    ];

    this.slots = {
      o2: { x: L.slotO2.x, y: L.slotO2.y, r: L.slotO2.r, color: COLOR.o2, short: 'O₂', dueno: 'o2' },
      co2: { x: L.slotCO2.x, y: L.slotCO2.y, r: L.slotCO2.r, color: COLOR.co2, short: 'CO₂', dueno: 'co2' },
    };

    this.valves = [
      {
        id: 'o2', short: 'O₂', color: COLOR.o2,
        x: L.valvulaO2.x, y: L.valvulaO2.y, r: L.valvulaO2.r,
        rotation: 0, turned: 0, objetivo, dragging: false, lastAngle: 0,
      },
      {
        id: 'co2', short: 'CO₂', color: COLOR.co2,
        x: L.valvulaCO2.x, y: L.valvulaCO2.y, r: L.valvulaCO2.r,
        rotation: 0, turned: 0, objetivo, dragging: false, lastAngle: 0,
      },
    ];

    /** @type {Array<{x:number,y:number,vx:number,vy:number,age:number,life:number,size:number,color:string}>} */
    this.particles = [];

    this.fase = FASE.CONECTANDO;
    this.autorizadoTimer = 0;
    this.fuga = null;
    this.drag = null; // { type: 'manguera'|'valvula', id: string }
    this._completadoDisparado = false;
  }

  /** Reinicia el minijuego a su estado inicial. */
  reset() {
    this.time = 0;
    this._init();
    Object.assign(this.pointer, { down: false, justDown: false, justUp: false });
  }

  // --------------------------------------------------------------------------
  // Montaje de eventos de puntero
  // --------------------------------------------------------------------------

  /** @param {HTMLCanvasElement} canvas */
  mount(canvas) {
    if (!canvas) return;
    this.canvas = canvas;
    if (this._listeners) this.unmount();

    const toLogical = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0, y: 0 };
      return {
        x: (e.clientX - rect.left) * (LOGICAL_WIDTH / rect.width),
        y: (e.clientY - rect.top) * (LOGICAL_HEIGHT / rect.height),
      };
    };

    const onDown = (e) => {
      const p = toLogical(e);
      this.pointer.x = p.x; this.pointer.y = p.y;
      this.pointer.down = true;
      this.pointer.justDown = true;
      if (canvas.setPointerCapture && e.pointerId != null) {
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      }
      e.preventDefault();
    };
    const onMove = (e) => {
      const p = toLogical(e);
      this.pointer.x = p.x; this.pointer.y = p.y;
    };
    const onUp = (e) => {
      const p = toLogical(e);
      this.pointer.x = p.x; this.pointer.y = p.y;
      this.pointer.down = false;
      this.pointer.justUp = true;
      e.preventDefault();
    };
    const onCancel = (e) => {
      this.pointer.down = false;
      this.pointer.justDown = false;
      this.pointer.justUp = false;
      if (this.drag?.type === 'manguera') {
        const line = this.lines.find((l) => l.id === this.drag.id);
        if (line) this._animarManguera(line, line.reposo, RECARGA_CONFIG.duracionRetorno);
      }
      this.drag = null;
      for (const v of this.valves) v.dragging = false;
      e.preventDefault();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);

    const prevTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';

    this._listeners = { onDown, onMove, onUp, onCancel, prevTouchAction };
  }

  /** Quita los eventos de puntero. */
  unmount() {
    if (!this.canvas || !this._listeners) return;
    const { onDown, onMove, onUp, onCancel, prevTouchAction } = this._listeners;
    this.canvas.removeEventListener('pointerdown', onDown);
    this.canvas.removeEventListener('pointermove', onMove);
    this.canvas.removeEventListener('pointerup', onUp);
    this.canvas.removeEventListener('pointercancel', onCancel);
    this.canvas.style.touchAction = prevTouchAction || '';
    this._listeners = null;
  }

  // --------------------------------------------------------------------------
  // Consultas de estado
  // --------------------------------------------------------------------------

  get ambosConectados() {
    return this.lines.every((l) => l.estado === ESTADO_LINEA.CONECTADO);
  }

  get hayFuga() {
    return this.fuga !== null;
  }

  get completado() {
    return this.fase === FASE.COMPLETADO;
  }

  /** Progreso 0..1 de la recarga (promedio de ambas válvulas). */
  get progreso() {
    if (!this.valves.length) return 0;
    const total = this.valves.reduce((acc, v) => acc + clamp(v.turned / v.objetivo, 0, 1), 0);
    return total / this.valves.length;
  }

  /** Instantánea lista para HUD / pruebas. */
  getSnapshot() {
    return {
      fase: this.fase,
      completado: this.completado,
      progreso: this.progreso,
      estados: this.lines.map((l) => ({ id: l.id, short: l.short, estado: l.estado })),
    };
  }

  // --------------------------------------------------------------------------
  // Actualización
  // --------------------------------------------------------------------------

  /** @param {number} dt segundos reales */
  update(dt) {
    const step = Math.max(0, Math.min(dt, 0.1));
    this.time += step;

    if (this.fase === FASE.CONECTANDO) this._updateConectar();
    else if (this.fase === FASE.AUTORIZADO) this._updateAutorizado(step);
    else if (this.fase === FASE.VALVULAS) this._updateRecarga();
    else if (this.fase === FASE.COMPLETADO) this._updateCompleto();

    this._updateAnimaciones(step);
    this._updateFugas(step);
    this._updateParticulas(step);

    this.pointer.justDown = false;
    this.pointer.justUp = false;
  }

  _pickManguera(x, y) {
    let best = null;
    let bestD = 14 * 14;
    for (const line of this.lines) {
      if (line.estado === ESTADO_LINEA.CONECTADO || line.animacion) continue;
      const d = dist2(x, y, line.free.x, line.free.y);
      if (d < bestD) { bestD = d; best = line; }
    }
    return best;
  }

  _pickValvula(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const v of this.valves) {
      if (this._valvulaCompleta(v)) continue;
      const d = dist2(x, y, v.x, v.y);
      if (d < bestD && d < (v.r + 5) * (v.r + 5) && d > 4) { bestD = d; best = v; }
    }
    return best;
  }

  _valvulaCompleta(v) {
    return v.turned >= v.objetivo - 1e-6;
  }

  // ----- Fase CONECTAR -------------------------------------------------------

  _updateConectar() {
    const p = this.pointer;

    if (p.justDown) {
      const line = this._pickManguera(p.x, p.y);
      if (line) {
        this.drag = { type: 'manguera', id: line.id };
      }
    }

    if (this.drag && this.drag.type === 'manguera') {
      const line = this.lines.find((l) => l.id === this.drag.id);
      if (line) {
        line.free.x = clamp(p.x, 4, LOGICAL_WIDTH - 4);
        line.free.y = clamp(p.y, 24, LOGICAL_HEIGHT - 20);
      }
    }

    if (p.justUp && this.drag && this.drag.type === 'manguera') {
      const line = this.lines.find((l) => l.id === this.drag.id);
      if (line) this._resolverSoltarManguera(line);
      this.drag = null;
    }

    // ¿Ya están ambas conectadas? → activación
    if (this.ambosConectados && this.lines.every((line) => !line.animacion)) {
      this.drag = null;
      this.fase = FASE.AUTORIZADO;
      this.autorizadoTimer = RECARGA_CONFIG.duracionAutorizado;
    }
  }

  _animarManguera(line, destino, duracion) {
    line.animacion = { inicio: { ...line.free }, destino: { ...destino }, tiempo: 0, duracion };
  }

  _updateAnimaciones(dt) {
    for (const line of this.lines) {
      const anim = line.animacion;
      if (!anim) continue;
      anim.tiempo += dt;
      const t = clamp(anim.tiempo / anim.duracion, 0, 1);
      const suave = t * t * (3 - 2 * t);
      line.free.x = anim.inicio.x + (anim.destino.x - anim.inicio.x) * suave;
      line.free.y = anim.inicio.y + (anim.destino.y - anim.inicio.y) * suave;
      if (t === 1) line.animacion = null;
    }
  }

  _resolverSoltarManguera(line) {
    const p = this.pointer;
    const slotO2 = this.slots.o2;
    const slotCO2 = this.slots.co2;
    const dO2 = dist2(p.x, p.y, slotO2.x, slotO2.y);
    const dCO2 = dist2(p.x, p.y, slotCO2.x, slotCO2.y);

    if (dO2 <= (slotO2.r + RECARGA_CONFIG.toleranciaPuerto) ** 2 && dO2 <= dCO2) this._conectarManguera(line, 'o2');
    else if (dCO2 <= (slotCO2.r + RECARGA_CONFIG.toleranciaPuerto) ** 2) this._conectarManguera(line, 'co2');
    else {
      this._animarManguera(line, line.reposo, RECARGA_CONFIG.duracionRetorno);
    }
  }

  /** @param {object} line @param {'o2'|'co2'} slotId */
  _conectarManguera(line, slotId) {
    const slot = this.slots[slotId];
    if (slotId === line.slotCorrecto) {
      line.estado = ESTADO_LINEA.CONECTADO;
      this._animarManguera(line, slot, RECARGA_CONFIG.duracionIman);
    } else {
      this.fuga = { x: slot.x, y: slot.y, color: line.color, tiempo: RECARGA_CONFIG.duracionFuga };
      this._animarManguera(line, line.reposo, RECARGA_CONFIG.duracionRetorno);
    }
  }

  // ----- Fase AUTORIZADO -----------------------------------------------------

  _updateAutorizado(dt) {
    const p = this.pointer;
    this.autorizadoTimer -= dt;
    if (this.autorizadoTimer <= 0 || (p.justDown && this._enPanelCentral(p.x, p.y))) this.fase = FASE.VALVULAS;
  }

  // ----- Fase RECARGA --------------------------------------------------------

  _updateRecarga() {
    const p = this.pointer;

    if (p.justDown) {
      const v = this._pickValvula(p.x, p.y);
      if (v) {
        v.dragging = true;
        v.lastAngle = Math.atan2(p.y - v.y, p.x - v.x);
        this.drag = { type: 'valvula', id: v.id };
      }
    }

    if (p.justUp) {
      for (const v of this.valves) v.dragging = false;
      if (this.drag && this.drag.type === 'valvula') this.drag = null;
    }

    // Giro por arrastre circular mientras el puntero está pulsado.
    if (p.down) {
      for (const v of this.valves) {
        if (!v.dragging || this._valvulaCompleta(v)) continue;
        const a = Math.atan2(p.y - v.y, p.x - v.x);
        const d = normAngle(a - v.lastAngle);
        v.lastAngle = a;
        v.rotation += d;
        // En coordenadas Canvas, el giro horario aumenta el ángulo.
        // Ignorar saltos bruscos del puntero para no contar vueltas falsas.
        if (d > 0 && d < Math.PI / 2) v.turned = clamp(v.turned + d, 0, v.objetivo);
      }
    }

    if (this.valves.every((v) => this._valvulaCompleta(v))) {
      this.fase = FASE.COMPLETADO;
      if (!this._completadoDisparado) {
        this._completadoDisparado = true;
        if (this.onComplete) this.onComplete(this);
      }
    }
  }

  // ----- Fase COMPLETO -------------------------------------------------------

  _updateCompleto() {
    const p = this.pointer;
    const btn = this._rectBotonReiniciar();
    const hover = p.x >= btn.x && p.x <= btn.x + btn.w && p.y >= btn.y && p.y <= btn.y + btn.h;
    if (p.justDown && hover) this.reset();
  }

  // ----- Fugas y partículas --------------------------------------------------

  _updateFugas(dt) {
    if (this.fuga) {
      this.fuga.tiempo -= dt;
      if (this.fuga.tiempo <= 0) this.fuga = null;
      else if (this.particles.length < 100) {
        const s = this.fuga;
        this.particles.push({
          x: s.x + (Math.random() - 0.5) * 6,
          y: s.y - 2,
          vx: (Math.random() - 0.5) * 14,
          vy: -18 - Math.random() * 16,
          age: 0,
          life: 0.9 + Math.random() * 0.5,
          size: 1 + Math.random() * 2,
          color: s.color,
        });
      }
    }
  }

  _updateParticulas(dt) {
    for (const pt of this.particles) {
      pt.age += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 6 * dt;
    }
    this.particles = this.particles.filter((pt) => pt.age < pt.life);
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  /** @param {import('../graphics/Renderer.js').Renderer} renderer */
  render(renderer) {
    const ctx = renderer.context;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    this._drawFondo(ctx);
    this._drawBanner(ctx);
    this._drawPanelLateral(ctx, RECARGA_LAYOUT.panelO2, 'Reserva de O₂', COLOR.o2, 'o2');
    this._drawPanelLateral(ctx, RECARGA_LAYOUT.panelCO2, 'Extracción de CO₂', COLOR.co2, 'co2');
    this._drawModulo(ctx);
    this._drawFlechas(ctx);
    this._drawEstado(ctx);
    this._drawBarraPasos(ctx);

    // Mangueras por encima del módulo; la boca fija queda bajo el tanque.
    for (const line of this.lines) this._drawManguera(ctx, line);
    // Los cilindros tapan el acople fijo; su otro extremo sigue siendo arrastrable.
    this._drawCilindro(ctx, RECARGA_LAYOUT.panelO2, 'o2');
    this._drawCilindro(ctx, RECARGA_LAYOUT.panelCO2, 'co2');

    this._drawParticulas(ctx);

    if (this.fase === FASE.AUTORIZADO) this._drawModalActivacion(ctx);
    if (this.fase === FASE.COMPLETADO) this._drawModalCompleto(ctx);
    if (this.fase === FASE.AUTORIZADO || this.fase === FASE.COMPLETADO) {
      this._drawEstado(ctx);
      this._drawBarraPasos(ctx);
    }

    ctx.restore();
  }

  _drawFondo(ctx) {
    ctx.fillStyle = COLOR.fondo;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Placas metálicas rectangulares gris azulado, con uniones oscuras.
    const bs = 32;
    for (let y = 0; y < LOGICAL_HEIGHT; y += bs) {
      for (let x = 0; x < LOGICAL_WIDTH; x += bs) {
        ctx.fillStyle = ((x / bs + y / bs) % 2 === 0) ? COLOR.pared : COLOR.paredOscura;
        ctx.fillRect(x, y, bs - 1, bs - 1);
        ctx.fillStyle = COLOR.remache;
        ctx.fillRect(x + 2, y + 2, 2, 2);
      }
    }
    ctx.fillStyle = 'rgba(72,90,130,0.18)';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  _bannerMensaje() {
    if (this.fuga) return '¡Fuga! Conecta la manguera en el puerto correcto';
    return 'Conecta las líneas de O₂ y CO₂ y cierra las válvulas de la mochila';
  }

  _drawBanner(ctx) {
    const b = RECARGA_LAYOUT.banner;
    this._panelBiselado(ctx, b, COLOR.panelBorde);
    // Icono de información de la referencia.
    ctx.fillStyle = '#eaf6ff';
    ctx.beginPath();
    ctx.arc(b.x + 12, b.y + b.h / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    txt(ctx, 'i', b.x + 12, b.y + b.h / 2, { font: FONT.titulo, color: COLOR.panel, align: 'center', baseline: 'middle' });
    txt(ctx, this._bannerMensaje(), b.x + 24, b.y + b.h / 2,
      { font: FONT.cuerpo, color: this.fuga ? COLOR.fuga : COLOR.texto, baseline: 'middle' });
  }

  // Recuadro de ocho lados como el de la referencia.
  _panelBiselado(ctx, rect, borde) {
    const { x, y, w, h } = rect;
    const c = 3;
    ctx.beginPath();
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + c);
    ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x + c, y + h);
    ctx.lineTo(x, y + h - c);
    ctx.lineTo(x, y + c);
    ctx.closePath();
    ctx.fillStyle = '#091b33';
    ctx.fill();
    ctx.strokeStyle = '#050e20';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = borde;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // Brillos de la moldura metálica vistos en EJEMPLO TIPOGRAFÍA.
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#a1bde8';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x + c + 2, y + 2);
    ctx.lineTo(x + w - c - 2, y + 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawPanelLateral(ctx, rect, titulo, color, id) {
    this._panelBiselado(ctx, rect, color);
    const escribirDentro = (texto, y, colorTexto, negrita) => {
      let tamano = negrita ? 6 : 5;
      let fuente;
      do {
        fuente = `${negrita ? 'bold ' : ''}${tamano}px Verdana, Arial, sans-serif`;
        ctx.font = fuente;
        if (ctx.measureText(texto).width <= rect.w - 8) break;
        tamano -= 0.25;
      } while (tamano >= 4);
      txt(ctx, texto, rect.x + rect.w / 2, y, { font: fuente, color: colorTexto, align: 'center' });
    };
    escribirDentro(titulo, rect.y + 5, COLOR.texto, true);
    escribirDentro('Arrastra para conectar', rect.y + rect.h - 8, COLOR.textoSuave, false);
  }

  _drawCilindro(ctx, rect, id) {
    const spriteTanque = id === 'o2' ? this.sprites.tanqueO2 : this.sprites.tanqueCO2;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2 + 2;

    if (spriteTanque) {
      // Ambos PNG compuestos se muestran en su panel original, sin estirar el
      // depósito. El clip elimina únicamente el tramo de cable que ya se
      // dibujó animado; conserva el acople fijo y toda la silueta del tanque.
      const dw = spriteTanque.width * 50 / spriteTanque.height;
      const x = id === 'o2' ? cx - 8 : cx - 32;
      const y = rect.y + 7;
      ctx.save();
      ctx.beginPath();
      const corte = spriteTanque.width * 0.31 / spriteTanque.height * 50;
      if (id === 'o2') ctx.rect(x, y, corte, 13);
      else ctx.rect(x + dw - corte, y, corte, 13);
      ctx.rect(x, y + 13, dw, 50 - 13);
      ctx.clip();
      drawSprite(ctx, spriteTanque, x, y, dw, 50);
      ctx.restore();
    } else {
      // Alternativa sólo si el compuesto no está disponible.
      const spriteCilindro = id === 'o2' ? this.sprites.cilindroO2 : this.sprites.cilindroCO2;
      if (spriteCilindro) {
        drawSpriteCentered(ctx, spriteCilindro, cx, cy, 32, 48);
        return;
      }
      roundRect(ctx, cx - 12, cy - 20, 24, 40, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.strokeStyle = id === 'o2' ? COLOR.o2 : COLOR.co2;
      ctx.stroke();
      ctx.fillStyle = id === 'o2' ? COLOR.o2 : COLOR.co2;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(cx - 10, cy + 5, 20, 15);
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLOR.metal;
      ctx.fillRect(cx - 3, cy - 24, 6, 5);
      txt(ctx, id === 'o2' ? 'O₂' : 'CO₂', cx, cy + 5, { font: FONT.sub, align: 'center' });
    }

  }

  _drawModulo(ctx) {
    const m = RECARGA_LAYOUT.modulo;

    // Usar sprite de mochila base si existe
    if (this.sprites.mochilaBase) {
      drawSprite(ctx, this.sprites.mochilaBase, m.x, m.y, m.w, m.h);
    } else {
      // Fallback procedimental
      roundRect(ctx, m.x, m.y, m.w, m.h, 8);
      ctx.fillStyle = COLOR.modulo;
      ctx.fill();
      ctx.strokeStyle = COLOR.moduloBorde;
      ctx.lineWidth = 2;
      ctx.stroke();

      roundRect(ctx, m.x + 4, m.y + 4, m.w - 8, m.h - 8, 6);
      ctx.strokeStyle = 'rgba(124,135,148,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.strokeStyle = COLOR.moduloOscuro;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x + m.w / 2, m.y + 3, 14, Math.PI, 0);
      ctx.stroke();

      const rivets = [
        [m.x + 6, m.y + 6], [m.x + m.w - 6, m.y + 6],
        [m.x + 6, m.y + m.h - 6], [m.x + m.w - 6, m.y + m.h - 6],
      ];
      for (const [rx, ry] of rivets) {
        ctx.beginPath(); ctx.arc(rx, ry, 2, 0, Math.PI * 2);
        ctx.fillStyle = COLOR.moduloOscuro; ctx.fill();
      }

      ctx.fillStyle = 'rgba(124,135,148,0.5)';
      ctx.fillRect(RECARGA_LAYOUT.valvulaO2.x - 16, m.y + 24, 5, 74);
      ctx.fillRect(RECARGA_LAYOUT.valvulaCO2.x + 11, m.y + 24, 5, 74);
    }

    if (this.fase === FASE.VALVULAS || this.fase === FASE.COMPLETADO) this._drawProgress(ctx);
    for (const line of this.lines) this._drawSlot(ctx, line);
    for (const v of this.valves) this._drawValvula(ctx, v);
  }

  _drawValvula(ctx, v) {
    ctx.save();
    ctx.translate(v.x, v.y);

    if (this.fase === FASE.CONECTANDO || this.fase === FASE.AUTORIZADO) ctx.globalAlpha = 0.6;

    // Usar sprites de manija para mostrar rotación
    const manijaBase = this.sprites.manija;
    const manijaGiro = this.sprites.manijaGiro;

    if (manijaBase && manijaGiro) {
      const r = v.r;
      const faseGiro = ((v.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const usarGiro = faseGiro > Math.PI / 2 && faseGiro < Math.PI * 1.5;

      const spriteActual = usarGiro ? manijaGiro : manijaBase;
      ctx.save();
      ctx.rotate(v.rotation);
      drawSpriteCentered(ctx, spriteActual, 0, 0, r * 2, r * 2);
      ctx.restore();

      // Halo ámbar cuando está activa
      const activa = this.fase === FASE.VALVULAS && !this._valvulaCompleta(v);
      if (activa) {
        ctx.beginPath();
        ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,200,87,${0.5 + 0.4 * Math.sin(this.time * 6)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    } else if (manijaBase) {
      // Solo manija base, rotar el sprite
      const r = v.r;
      ctx.save();
      ctx.rotate(v.rotation);
      drawSpriteCentered(ctx, manijaBase, 0, 0, r * 2, r * 2);
      ctx.restore();
    } else {
      // Fallback procedimental
      roundRect(ctx, -6, v.r - 2, 12, 7, 2);
      ctx.fillStyle = COLOR.valvulaOscura;
      ctx.fill();

      const activa = this.fase === FASE.VALVULAS && !this._valvulaCompleta(v);
      if (activa) {
        ctx.beginPath();
        ctx.arc(0, 0, v.r + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,200,87,${0.5 + 0.4 * Math.sin(this.time * 6)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.save();
      ctx.rotate(v.rotation);
      ctx.beginPath();
      ctx.arc(0, 0, v.r, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.valvula;
      ctx.fill();
      ctx.strokeStyle = COLOR.valvulaBrillo;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = COLOR.valvulaOscura;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        const a = i * (Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * (v.r - 1), Math.sin(a) * (v.r - 1));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.ambar;
      ctx.fill();
      ctx.restore();
    }

    if (this._valvulaCompleta(v)) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLOR.ok;
      ctx.fillRect(-2, -2, 4, 4);
    }
    ctx.restore();
  }

  _drawSlot(ctx, line) {
    const s = this.slots[line.id];
    const fuga = this.fuga && dist2(this.fuga.x, this.fuga.y, s.x, s.y) < 1;
    const conectado = line.estado === ESTADO_LINEA.CONECTADO;
    const color = fuga ? COLOR.fuga : s.color;
    const radioVisual = RECARGA_CONFIG.anchoVisualPuerto / 2;

    // Usar sprite de puerto si existe
    const spritePuerto = line.id === 'o2' ? this.sprites.puertoO2 : this.sprites.puertoCO2;

    if (spritePuerto) {
      const ancho = RECARGA_CONFIG.anchoVisualPuerto;
      const alto = ancho * spritePuerto.height / spritePuerto.width;
      const sacudida = fuga ? Math.round(Math.sin(this.time * 60) * 1.5) : 0;
      drawSpriteCentered(ctx, spritePuerto, s.x + sacudida, s.y, ancho, alto);

      // Overlay de estado
      if (fuga) {
        ctx.fillStyle = 'rgba(255,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, radioVisual + 1, 0, Math.PI * 2);
        ctx.fill();
        txt(ctx, 'FUGA', s.x, s.y + alto / 2 + 3, {
          font: FONT.mini, color: COLOR.fuga, align: 'center',
        });
      } else if (conectado) {
        ctx.strokeStyle = COLOR.ok;
        ctx.globalAlpha = 0.7 + 0.2 * Math.sin(this.time * 8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, radioVisual + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    } else {
      // Fallback procedimental
      ctx.beginPath();
      ctx.arc(s.x, s.y, radioVisual + 2, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.globalAlpha = conectado ? 0.85 : 0.3;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.arc(s.x, s.y, radioVisual, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0f15';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.stroke();


      if (fuga) {
        txt(ctx, 'FUGA', s.x, s.y + radioVisual + 3, {
          font: FONT.mini, color: COLOR.fuga, align: 'center',
        });
      }
    }
  }

  _drawProgress(ctx) {
    const m = RECARGA_LAYOUT.modulo;
    const barW = 96;
    const barH = 6;
    const x = m.x + (m.w - barW) / 2;
    const y = m.y + m.h - 10;
    const prog = this.progreso;

    txt(ctx, 'RECARGA O₂', m.x + m.w / 2, y - 9, { font: FONT.mini, color: COLOR.textoSuave, align: 'center' });
    ctx.fillStyle = 'rgba(20,26,34,0.9)';
    ctx.fillRect(x, y, barW, barH);
    ctx.strokeStyle = COLOR.moduloBorde;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, barW - 1, barH - 1);
    ctx.fillStyle = prog >= 1 ? COLOR.ok : COLOR.o2;
    ctx.fillRect(x + 1, y + 1, Math.max(0, (barW - 2) * prog), barH - 2);
    txt(ctx, `${Math.round(prog * 100)}%`, x + barW / 2, y - 1, { font: FONT.mini, color: '#ffffff', align: 'center' });
  }

  _drawManguera(ctx, line) {
    const a = line.anchor;
    const f = line.free;
    const spriteManguera = line.id === 'o2' ? this.sprites.tanqueO2 : this.sprites.tanqueCO2;

    if (spriteManguera) {
      // Las franjas provienen de la zona de la manguera en el MISMO PNG del
      // tanque. Su conexión al depósito y el acople móvil se mantienen en
      // posiciones fijas; sólo el tramo intermedio cede como cable flexible.
      const art = HOSE_ART[line.id];
      const escala = 50 / spriteManguera.height;
      const fixedX = art.fixed.x * escala, fixedY = art.fixed.y * escala;
      const freeX = art.free.x * escala, freeY = art.free.y * escala;
      const baseDx = freeX - fixedX, baseDy = freeY - fixedY;
      const baseAngle = Math.atan2(baseDy, baseDx);
      const targetAngle = Math.atan2(f.y - a.y, f.x - a.x);
      const length = Math.hypot(f.x - a.x, f.y - a.y);
      const baseLength = Math.hypot(baseDx, baseDy);
      const moviendo = this.drag?.id === line.id || !!line.animacion;
      const holgura = Math.min(5, length * 0.06);
      const fase = this.time * (moviendo ? 9 : 2.4);
      const franjas = 32;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(targetAngle);
      ctx.scale(length / baseLength, 1);
      ctx.rotate(-baseAngle);
      for (let i = 0; i < franjas; i++) {
        const sx = art.start + (art.end - art.start) * i / franjas;
        const sxFin = art.start + (art.end - art.start) * (i + 1) / franjas;
        const lx = sx * escala;
        const siguiente = sxFin * escala;
        const t = clamp(((lx + siguiente) / 2 - fixedX) / (freeX - fixedX), 0, 1);
        const curva = Math.sin(Math.PI * t);
        const desplazamiento = curva * (holgura + Math.sin(fase + t * Math.PI * 2) * (moviendo ? 1.8 : 0.35));
        ctx.save();
        ctx.translate(-fixedX, -fixedY + desplazamiento);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spriteManguera, sx, art.top, sxFin - sx, art.bottom - art.top,
          lx - 0.05, art.top * escala, siguiente - lx + 0.1, (art.bottom - art.top) * escala);
        ctx.restore();
      }
      ctx.restore();
    } else {
      // Fallback procedimental
      const cx = (a.x + f.x) / 2;
      const cy = (a.y + f.y) / 2 + 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cx, cy, f.x, f.y);
      ctx.strokeStyle = line.colorOscuro;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cx, cy, f.x, f.y);
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 3.4;
      ctx.stroke();

      ctx.strokeStyle = line.colorOscuro;
      ctx.lineWidth = 1;
      for (let i = 1; i < 9; i++) {
        const p = quadPoint(a.x, a.y, cx, cy, f.x, f.y, i / 9);
        const q = quadPoint(a.x, a.y, cx, cy, f.x, f.y, Math.min(1, i / 9 + 0.01));
        const ang = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(ang) * 2.5, p.y - Math.sin(ang) * 2.5);
        ctx.lineTo(p.x + Math.cos(ang) * 2.5, p.y + Math.sin(ang) * 2.5);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(f.x, f.y, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.metal;
      ctx.fill();
      ctx.strokeStyle = COLOR.metalOscuro;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _drawFlechas(ctx) {
    const dibujar = (x, y, dir, color) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(dir * 5, 0);
      ctx.lineTo(-dir * 4, -5);
      ctx.lineTo(-dir * 4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    dibujar(RECARGA_LAYOUT.flechaO2.x, RECARGA_LAYOUT.flechaO2.y, 1, COLOR.o2);
    dibujar(RECARGA_LAYOUT.flechaCO2.x, RECARGA_LAYOUT.flechaCO2.y, -1, COLOR.co2);
  }

  _estadoTexto(estado) {
    if (estado === ESTADO_LINEA.CONECTADO) return 'Conectado';
    if (estado === ESTADO_LINEA.FUGA) return 'Fuga';
    return 'Desconectado';
  }

  _estadoColor(estado) {
    if (estado === ESTADO_LINEA.CONECTADO) return COLOR.ok;
    if (estado === ESTADO_LINEA.FUGA) return COLOR.fuga;
    return COLOR.textoSuave;
  }

  _drawEstado(ctx) {
    const p = RECARGA_LAYOUT.estado;
    this._panelBiselado(ctx, p, COLOR.panelBorde);

    txt(ctx, 'ESTADO DE LÍNEAS', p.x + p.w / 2, p.y + 3, { font: FONT.mini, color: COLOR.textoSuave, align: 'center' });

    let ry = p.y + 12;
    for (const line of this.lines) {
      ctx.beginPath();
      ctx.arc(p.x + 9, ry + 3, 4, 0, Math.PI * 2);
      ctx.fillStyle = line.color;
      ctx.fill();
      txt(ctx, line.short, p.x + 9, ry + 1, { font: FONT.mini, color: '#06121d', align: 'center' });
      txt(ctx, 'Estado:', p.x + 20, ry, { font: FONT.mini, color: COLOR.texto });
      txt(ctx, this._estadoTexto(line.estado), p.x + 20, ry + 7, { font: FONT.mini, color: line.color });
      ry += 14;
    }
  }

  _drawBarraPasos(ctx) {
    const b = RECARGA_LAYOUT.barra;
    this._panelBiselado(ctx, b, COLOR.panelBorde);

    const conectado = this.ambosConectados;
    const pasos = [
      { icon: '◀', label: 'Arrastra las conexiones', done: conectado, active: this.fase === FASE.CONECTANDO },
      { icon: '✚', label: 'Cierra las válvulas', done: this.completado, active: this.fase === FASE.AUTORIZADO || this.fase === FASE.VALVULAS },
      { icon: '✓', label: 'Activa la extracción y recarga', done: this.completado, active: false },
    ];

    const sep = '  |  ';
    ctx.font = FONT.mini;
    const widths = pasos.map((s) => ctx.measureText(s.label).width + 17);
    const sepW = ctx.measureText(sep).width;
    const total = widths.reduce((a, c) => a + c, 0) + sepW * (pasos.length - 1);
    let x = b.x + Math.max(6, (b.w - total) / 2);
    const y = b.y + b.h / 2 - 3;

    pasos.forEach((s, i) => {
      const color = s.active ? COLOR.ambar : s.done ? COLOR.ok : COLOR.textoSuave;
      if ((s.done || i === 2) && s.done && this.sprites.iconoAutorizado) {
        drawSpriteCentered(ctx, this.sprites.iconoAutorizado, x + 6, y + 3, 10, 10);
      } else if (s.done || i === 2) {
        txt(ctx, '✓', x + 2, y, { font: FONT.sub, color: s.done ? COLOR.ok : COLOR.textoSuave });
      } else if (i === 1 && this.sprites.manija) {
        drawSpriteCentered(ctx, this.sprites.manija, x + 5, y + 3, 9, 9);
      } else if (i === 0) {
        // No hay sprite de ratón: icono pequeño en Canvas.
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        roundRect(ctx, x + 2, y - 2, 7, 11, 3);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(x + 5, y, 1, 3);
      } else {
        txt(ctx, '✚', x + 2, y, { font: FONT.sub, color: COLOR.valvula });
      }
      txt(ctx, s.label, x + 12, y, { font: FONT.mini, color });
      x += widths[i];
      if (i < pasos.length - 1) {
        txt(ctx, sep, x, y, { font: FONT.mini, color: COLOR.panelBorde });
        x += sepW;
      }
    });
  }

  _drawParticulas(ctx) {
    const spriteFuga = this.sprites.fugaGas;

    for (const pt of this.particles) {
      const t = 1 - pt.age / pt.life;
      ctx.globalAlpha = clamp(t, 0, 1) * 0.8;

      if (spriteFuga) {
        const size = pt.size * 8;
        drawSpriteCentered(ctx, spriteFuga, pt.x, pt.y, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // --------------------------------------------------------------------------
  // Modales
  // --------------------------------------------------------------------------

  _rectPanelCentral(w, h) {
    return { x: (LOGICAL_WIDTH - w) / 2, y: (LOGICAL_HEIGHT - h) / 2, w, h };
  }

  _enPanelCentral(x, y) {
    const p = this._rectPanelCentral(160, 46);
    return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
  }

  _rectBotonReiniciar() {
    const p = this._rectPanelCentral(180, 60);
    return { x: p.x + (p.w - 90) / 2, y: p.y + p.h - 22, w: 90, h: 15 };
  }

  _drawModalActivacion(ctx) {
    ctx.fillStyle = COLOR.oscuro;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const p = this._rectPanelCentral(160, 46);
    this._panelBiselado(ctx, p, COLOR.ok);
    ctx.fillStyle = `rgba(76,224,140,${0.22 * this.autorizadoTimer / RECARGA_CONFIG.duracionAutorizado})`;
    ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
    if (this.sprites.iconoAutorizado) drawSprite(ctx, this.sprites.iconoAutorizado, p.x + 7, p.y + 10, 19, 19);
    else txt(ctx, '✓', p.x + 18, p.y + 8, { font: 'bold 20px Arial, sans-serif', color: COLOR.ok });
    txt(ctx, 'Extracción y recarga autorizada', p.x + 34, p.y + 12, { font: FONT.sub });
    txt(ctx, 'Ambas líneas conectadas · toca para continuar', p.x + 34, p.y + 27, { font: FONT.mini, color: COLOR.textoSuave });
  }

  _drawModalCompleto(ctx) {
    ctx.fillStyle = COLOR.oscuro;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const p = this._rectPanelCentral(180, 60);
    this._panelBiselado(ctx, p, COLOR.ok);
    if (this.sprites.iconoAutorizado) drawSpriteCentered(ctx, this.sprites.iconoAutorizado, p.x + p.w / 2, p.y + 14, 21, 21);
    else txt(ctx, '✓', p.x + p.w / 2, p.y + 4, { font: 'bold 18px Arial, sans-serif', color: COLOR.ok, align: 'center' });
    txt(ctx, '¡Recarga de oxígeno completada!', p.x + p.w / 2, p.y + 23, { font: FONT.titulo, color: COLOR.ok, align: 'center' });
    txt(ctx, 'O₂ al 100% · válvulas cerradas', p.x + p.w / 2, p.y + 34, { font: FONT.mini, color: COLOR.texto, align: 'center' });

    const btn = this._rectBotonReiniciar();
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 3);
    ctx.fillStyle = 'rgba(60,120,170,0.96)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    txt(ctx, 'REINICIAR', btn.x + btn.w / 2, btn.y + 5, { font: FONT.cuerpo, color: '#ffffff', align: 'center' });
  }
}

export default RecargaOxigeno;
