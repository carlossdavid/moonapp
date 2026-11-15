/**
 * @file Módulo "Producción de alimentos" (simulador de cultivo lunar).
 *
 * Consola para la cámara de cultivo de la base:
 *   - Se ven las variables del invernadero (temperatura, humedad, CO₂ y las
 *     cuatro luces de crecimiento) y se pueden modificar con los botones.
 *   - `APLICAR` fija los cambios y hace avanzar el tiempo (3 días por pulsación),
 *     por lo que la planta crece, su salud cambia y se puede cosechar.
 *   - Cada cultivo tiene sus valores óptimos (tomados de `config_cultivos.json`).
 *
 * Todo el arte es pixel art del pack `sprites_simulador_luna` (carpeta `nativo`,
 * 1:1 con el lienzo lógico 320x180). Si un sprite falta, se dibuja un
 * rectángulo de respaldo para que el módulo nunca se rompa.
 *
 * La clase no conoce el motor: recibe un `renderer` compatible con
 * `Renderer` y se controla con `pointerClick()` / `update(dt, game)`.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../config.js';

// ============================================================================
// Datos de cultivos (respaldo; la escena intenta leer el JSON del pack)
// ============================================================================

/** @typedef {{rojo:number,azul:number,verde:number,blanco:number}} Luz */
/** @typedef {{luz:Luz,temperatura_C:number[]|null,humedad_pct:number[]|null,co2_ppm:number[]|null,dias_cosecha:number[],cosecha:string}} Cultivo */

/** @type {Record<string, Cultivo>} */
export const CULTIVOS_DEFECTO = {
  lechuga: { luz: { rojo: 75, azul: 18.75, verde: 6.25, blanco: 0 }, temperatura_C: [22.2, 23.3], humedad_pct: [38.3, 43.9], co2_ppm: [2559, 2799], dias_cosecha: [33, 33], cosecha: 'hojas' },
  mizuna: { luz: { rojo: 81.8, azul: 9.1, verde: 9.1, blanco: 0 }, temperatura_C: [22.2, 23.4], humedad_pct: [70.4, 91.9], co2_ppm: [2009, 3011], dias_cosecha: [35, 58], cosecha: 'hojas' },
  tomate: { luz: { rojo: 90, azul: 10, verde: 0, blanco: 0 }, temperatura_C: null, humedad_pct: null, co2_ppm: null, dias_cosecha: [83, 104], cosecha: 'frutos' },
  chile: { luz: { rojo: 27, azul: 40, verde: 33, blanco: 0 }, temperatura_C: [23, 23], humedad_pct: [50, 50], co2_ppm: [550, 550], dias_cosecha: [109, 137], cosecha: 'frutos' },
  papa: { luz: { rojo: 0, azul: 0, verde: 0, blanco: 100 }, temperatura_C: null, humedad_pct: null, co2_ppm: null, dias_cosecha: [90, 105], cosecha: 'tuberculos' },
  trigo: { luz: { rojo: 50, azul: 0, verde: 0, blanco: 50 }, temperatura_C: null, humedad_pct: null, co2_ppm: null, dias_cosecha: [64, 86], cosecha: 'grano' },
};

const ORDEN_CULTIVOS = ['lechuga', 'mizuna', 'tomate', 'chile', 'papa', 'trigo'];
const NOMBRE = {
  lechuga: 'LECHUGA', mizuna: 'MIZUNA', tomate: 'TOMATE',
  chile: 'CHILE', papa: 'PAPA', trigo: 'TRIGO',
};

/** Luces de crecimiento: sprite de lámpara, led, rayo y color guía. */
const LUCES = [
  { id: 'rojo', etiqueta: 'ROJO', color: '#ff6b6b', lampOn: 'lamparaRojoOn', lampOff: 'lamparaRojoOff', ledOn: 'ledRojoOn', ledOff: 'ledRojoOff', rayo: 'rayoRojo' },
  { id: 'azul', etiqueta: 'AZUL', color: '#4fa3ff', lampOn: 'lamparaAzulOn', lampOff: 'lamparaAzulOff', ledOn: 'ledAzulOn', ledOff: 'ledAzulOff', rayo: 'rayoAzul' },
  { id: 'verde', etiqueta: 'VERDE', color: '#5fe08a', lampOn: 'lamparaVerdeOn', lampOff: 'lamparaVerdeOff', ledOn: 'ledVerdeOn', ledOff: 'ledVerdeOff', rayo: 'rayoVerde' },
  { id: 'blanco', etiqueta: 'BLANCO', color: '#ffffff', lampOn: 'lamparaBlancoOn', lampOff: 'lamparaBlancoOff', ledOn: 'ledBlancoOn', ledOff: 'ledBlancoOff', rayo: 'rayoBlanco' },
];

/** Paleta pixel-art (coherente con el pack). */
const P = {
  texto: '#eaf6ff', suave: '#a9b7d8', tenue: '#69779f', borde: '#3c4678',
  verde: '#6fe3a1', ambar: '#ffc857', rojo: '#ff6b6b', azul: '#4fc3ff',
  suelo: '#2f2317', sueloClaro: '#4a3722',
};

/** Distribución en píxeles lógicos (320x180). */
const L = {
  panelCultivos: { x: 6, y: 22, w: 84, h: 126 },
  tarjeta: { x: 10, y: 34, w: 76, h: 16, paso: 18 },
  panelVars: { x: 190, y: 22, w: 124, h: 126 },
  panelPie: { x: 6, y: 152, w: 308, h: 24 },
  // Cámara de cultivo (centro)
  soporte: { x: 112, y: 32, w: 64, h: 10 },
  lampara: { x: 112, y: 36, paso: 16, w: 16, h: 16 },
  rayo: { y: 50, w: 32, h: 24 },
  planta: { x: 108, y: 56, w: 72, h: 72 },
  suelo: { x: 104, y: 124, w: 80, h: 12 },
  progreso: { x: 112, y: 138, seg: 8, w: 8, h: 12 },
  calendario: { x: 94, y: 138 },
  cara: { x: 92, y: 42 },
  dia: { x: 94, y: 26 },
};

/** Filas de variables ambientales del panel derecho. */
const FILAS = [
  { id: 'temp', etiqueta: 'TEMPERATURA', icono: 'termo', iconoY: 28, textoY: 30, botonY: 43, caja: 'cajaRojo' },
  { id: 'hum', etiqueta: 'HUMEDAD', icono: 'gota', iconoY: 61, textoY: 60, botonY: 61, caja: 'cajaAzul' },
  { id: 'co2', etiqueta: 'CO2', icono: 'co2', iconoY: 79, textoY: 78, botonY: 79, caja: 'cajaVerde' },
];

const FILA_LUCES_Y = 101;
const PASO_LUCES = 11;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const medio = (r) => (Array.isArray(r) && r.length === 2 ? (r[0] + r[1]) / 2 : null);
const suma = (luz) => LUCES.reduce((acc, c) => acc + (luz[c.id] || 0), 0);
const redondear = (v, d = 0) => Number(v.toFixed(d));

const copiaLuz = (luz) => ({ rojo: luz.rojo, azul: luz.azul, verde: luz.verde, blanco: luz.blanco });

// ============================================================================
// Módulo
// ============================================================================

export class ProduccionAlimentos {
  /**
   * @param {{
   *   sprites?: Record<string, CanvasImageSource>,
   *   cultivos?: Record<string, Cultivo>,
   *   onExit?: () => void,
   *   diasPorAplicar?: number,
   * }} [opts]
   */
  constructor(opts = {}) {
    this.sprites = opts.sprites || {};
    this.cultivos = opts.cultivos && Object.keys(opts.cultivos).length
      ? opts.cultivos
      : CULTIVOS_DEFECTO;
    this.onExit = opts.onExit || (() => {});
    this.diasPorAplicar = opts.diasPorAplicar ?? 3;

    this.pointer = { x: -999, y: -999 };
    this._hit = [];
    this._hoverFila = null;

    this.time = 0;
    this.stars = Array.from({ length: 46 }, (_, i) => ({
      x: (i * 97 + 13) % LOGICAL_WIDTH,
      y: (i * 53 + 7) % 148,
      a: 0.16 + ((i * 37) % 40) / 100,
      p: i * 0.83,
    }));

    this.reset();
  }

  /** Reinicia la simulación completa. */
  reset() {
    /** @type {{temp:number, hum:number, co2:number, luz:Luz}} */
    this.env = { temp: 20, hum: 52, co2: 1200, luz: { rojo: 25, azul: 25, verde: 25, blanco: 25 } };
    /** @type {{temp:number, hum:number, co2:number, luz:Luz}} */
    this.draft = { temp: 20, hum: 52, co2: 1200, luz: copiaLuz(this.env.luz) };

    /** @type {Record<string, {progress:number, health:number, cosechas:number, perdidas:number}>} */
    this.crops = {};
    for (const id of ORDEN_CULTIVOS) {
      this.crops[id] = { progress: 0, health: 72, cosechas: 0, perdidas: 0 };
    }

    this.selected = 'lechuga';
    this.day = 1;
    this.stats = { cosechas: 0, o2: 0 };
    this.particles = [];
    this.flash = 0;
    this.flashTexto = '';
    this.msg = { texto: 'AJUSTA LAS VARIABLES Y PULSA APLICAR', tone: 'info', t: 4 };
  }

  /** @param {number} x @param {number} y */
  setPointer(x, y) {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  // --------------------------------------------------------------------------
  // Entrada
  // --------------------------------------------------------------------------

  /** @param {number} x @param {number} y */
  pointerClick(x, y) {
    this.pointer.x = x;
    this.pointer.y = y;
    for (let i = this._hit.length - 1; i >= 0; i--) {
      const r = this._hit[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        this._accion(r.id);
        return;
      }
    }
  }

  /** @param {string} id */
  _accion(id) {
    if (id === 'salir') { this.onExit(); return; }
    if (id === 'aplicar') { this._aplicar(); return; }
    if (id.startsWith('cultivo:')) {
      this.selected = id.slice(8);
      this.msg = { texto: `${NOMBRE[this.selected]} SELECCIONADA`, tone: 'info', t: 2.2 };
      return;
    }

    const [accion, campo, sub] = id.split(':');
    const delta = accion === 'inc' ? 1 : -1;

    if (campo === 'luz') {
      const paso = 5 * delta;
      this.draft.luz[sub] = clamp(redondear(this.draft.luz[sub] + paso), 0, 100);
      return;
    }

    if (campo === 'temp') this.draft.temp = clamp(redondear(this.draft.temp + delta * 0.5, 1), 5, 45);
    else if (campo === 'hum') this.draft.hum = clamp(Math.round(this.draft.hum + delta), 0, 100);
    else if (campo === 'co2') this.draft.co2 = clamp(Math.round((this.draft.co2 + delta * 50) / 50) * 50, 300, 5000);
  }

  // --------------------------------------------------------------------------
  // Simulación
  // --------------------------------------------------------------------------

  /**
   * Error de una variable respecto a su rango ideal (0 = dentro, 1 = muy lejos).
   * @param {number} valor
   * @param {number[]|null} rango
   * @param {number} escala
   */
  _errorRango(valor, rango, escala) {
    if (!Array.isArray(rango) || rango.length !== 2) return 0;
    const [min, max] = rango;
    if (valor < min) return Math.min(1, (min - valor) / escala);
    if (valor > max) return Math.min(1, (valor - max) / escala);
    return 0;
  }

  /**
   * Evalúa el ambiente contra el cultivo.
   * @param {{temp:number, hum:number, co2:number, luz:Luz}} env
   * @param {Cultivo} cfg
   * @returns {{error:number, issues:string[], detalle:string[]}}
   */
  _evaluar(env, cfg) {
    const eTemp = this._errorRango(env.temp, cfg.temperatura_C, 6);
    const eHum = this._errorRango(env.hum, cfg.humedad_pct, 12);
    const eCo2 = this._errorRango(env.co2, cfg.co2_ppm, 600);

    const total = suma(env.luz);
    let eLuz = 0;
    if (total <= 0) eLuz = 1;
    else {
      // 1) Mezcla: proporción de cada color respecto al total.
      let mezcla = 0;
      for (const c of LUCES) {
        const ideal = (cfg.luz && cfg.luz[c.id]) || 0;
        mezcla += Math.abs((env.luz[c.id] || 0) / total - ideal / 100);
      }
      mezcla = Math.min(1, mezcla / 2);
      // 2) Intensidad: la suma de los cuatro canales debería rondar 100 %.
      const intensidad = Math.min(1, Math.abs(total - 100) / 50);
      eLuz = Math.min(1, mezcla * 0.75 + intensidad * 0.25);
    }

    const error = clamp(eTemp * 0.3 + eHum * 0.2 + eCo2 * 0.2 + eLuz * 0.3, 0, 1);

    const issues = [];
    const detalle = [];
    if (eTemp > 0.02) {
      issues.push('TEMPERATURA');
      const r = cfg.temperatura_C;
      detalle.push(`TEMP ${env.temp.toFixed(1)}C (${r ? `${r[0]}-${r[1]}` : 'S/D'})`);
    }
    if (eHum > 0.02) {
      issues.push('HUMEDAD');
      const r = cfg.humedad_pct;
      detalle.push(`HUM ${Math.round(env.hum)}% (${r ? `${Math.round(r[0])}-${Math.round(r[1])}` : 'S/D'})`);
    }
    if (eCo2 > 0.02) {
      issues.push('CO2');
      const r = cfg.co2_ppm;
      detalle.push(`CO2 ${Math.round(env.co2)} (${r ? `${Math.round(r[0])}-${Math.round(r[1])}` : 'S/D'})`);
    }
    if (eLuz > 0.05) {
      issues.push('LUZ');
      detalle.push(`LUZ R${Math.round(env.luz.rojo)} A${Math.round(env.luz.azul)} V${Math.round(env.luz.verde)} B${Math.round(env.luz.blanco)}`);
    }
    return { error, issues, detalle };
  }

  /** Fija los cambios y hace avanzar el tiempo. */
  _aplicar() {
    this.env = {
      temp: this.draft.temp,
      hum: this.draft.hum,
      co2: this.draft.co2,
      luz: copiaLuz(this.draft.luz),
    };

    const cfg = this.cultivos[this.selected] || CULTIVOS_DEFECTO.lechuga;
    const st = this.crops[this.selected];
    const ciclo = Math.max(1, medio(cfg.dias_cosecha) || 30);

    let cosechas = 0;
    let perdidas = 0;

    for (let d = 0; d < this.diasPorAplicar; d++) {
      const ev = this._evaluar(this.env, cfg);
      const objetivo = Math.max(0, 100 * (1 - ev.error));
      st.health += (objetivo - st.health) * 0.35;
      st.health = clamp(st.health, 0, 100);

      const ritmo = 0.35 + 0.65 * (st.health / 100);
      st.progress += ritmo / ciclo;

      if (st.progress >= 1) {
        st.progress = 0;
        if (st.health >= 40) {
          st.cosechas += 1;
          this.stats.cosechas += 1;
          this.stats.o2 = redondear(this.stats.o2 + 2.4, 1);
          cosechas += 1;
        } else {
          st.perdidas += 1;
          perdidas += 1;
        }
      }
    }

    this.day += this.diasPorAplicar;

    const ev = this._evaluar(this.env, cfg);
    const salud = Math.round(st.health);

    if (cosechas > 0) {
      this.msg = { texto: `COSECHA +${cosechas} ${NOMBRE[this.selected]} - O2 +2.4`, tone: 'ok', t: 3.4 };
      this.flash = 1.4;
      this.flashTexto = 'COSECHA';
      this._particulas(L.planta.x + L.planta.w / 2, L.planta.y + L.planta.h - 8, 26, '#8ef0a8');
    } else if (perdidas > 0) {
      this.msg = { texto: `COSECHA PERDIDA - SALUD ${salud}%`, tone: 'bad', t: 3.4 };
      this._particulas(L.planta.x + L.planta.w / 2, L.planta.y + L.planta.h - 8, 16, '#c46b5a');
    } else if (ev.issues.length === 0) {
      this.msg = { texto: `OPTIMO - +${this.diasPorAplicar} DIAS - SALUD ${salud}%`, tone: 'ok', t: 2.6 };
      this._particulas(L.planta.x + L.planta.w / 2, L.planta.y + L.planta.h - 10, 8, '#7fe3b0');
    } else {
      this.msg = { texto: `AJUSTA: ${ev.issues.slice(0, 2).join(' / ')}`, tone: 'warn', t: 3 };
    }
  }

  _particulas(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const v = 8 + (i % 5) * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: -Math.abs(Math.sin(a)) * v - 6,
        life: 0.7 + (i % 4) * 0.15,
        t: 0,
        color,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Actualización
  // --------------------------------------------------------------------------

  /**
   * @param {number} dt
   * @param {{input?: import('../core/Input.js').Input}} [game]
   */
  update(dt, game) {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.msg && this.msg.t > 0) this.msg.t -= dt;

    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 26 * dt;
    }
    this.particles = this.particles.filter((p) => p.t < p.life);

    const input = game && game.input;
    if (!input) return;

    if (input.isPressed('Escape')) { this.onExit(); return; }

    const indice = ORDEN_CULTIVOS.indexOf(this.selected);
    if (input.isPressed('ArrowDown') || input.isPressed('KeyS')) {
      this.selected = ORDEN_CULTIVOS[(indice + 1) % ORDEN_CULTIVOS.length];
      this.msg = { texto: `${NOMBRE[this.selected]} SELECCIONADA`, tone: 'info', t: 2 };
    }
    if (input.isPressed('ArrowUp') || input.isPressed('KeyW')) {
      this.selected = ORDEN_CULTIVOS[(indice + ORDEN_CULTIVOS.length - 1) % ORDEN_CULTIVOS.length];
      this.msg = { texto: `${NOMBRE[this.selected]} SELECCIONADA`, tone: 'info', t: 2 };
    }
    for (let i = 0; i < ORDEN_CULTIVOS.length; i++) {
      if (input.isPressed(`Digit${i + 1}`) || input.isPressed(`Numpad${i + 1}`)) {
        this.selected = ORDEN_CULTIVOS[i];
        this.msg = { texto: `${NOMBRE[this.selected]} SELECCIONADA`, tone: 'info', t: 2 };
      }
    }
    if (input.isPressed('Enter') || input.isPressed('Space')) this._aplicar();
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  /** @param {import('../graphics/Renderer.js').Renderer} renderer */
  render(renderer) {
    const ctx = renderer.context;
    this._r = renderer;
    this._hit = [];
    this._hoverFila = null;

    this._fondo(ctx);
    this._cabecera(ctx);
    this._panelCultivos(ctx);
    this._camara(ctx);
    this._panelVariables(ctx);
    this._pie(ctx, renderer);
    this._destello(ctx);
  }

  // --- utilidades de dibujo -------------------------------------------------

  _sprite(renderer, clave, x, y, w, h, alpha = 1) {
    const img = this.sprites[clave];
    if (!img) return false;
    const ctx = renderer.context;
    const sw = img.width || w;
    const sh = img.height || h;
    if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
    renderer.drawImage(img, 0, 0, sw, sh, x, y, w ?? sw, h ?? sh, false);
    if (alpha < 1) ctx.restore();
    return true;
  }

  /** Panel con marco 9-slice del pack. */
  _panel(ctx, x, y, w, h, soloBorde = false) {
    const img = this.sprites.marco;
    if (!img) {
      if (!soloBorde) {
        ctx.fillStyle = '#12162e';
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = P.borde;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      return;
    }
    const s = 4; // 24x24 -> esquinas de 4px
    const iw = img.width;
    const ih = img.height;
    const cw = iw - s * 2;
    const ch = ih - s * 2;
    const dw = w - s * 2;
    const dh = h - s * 2;
    const dx = x + s;
    const dy = y + s;

    ctx.drawImage(img, 0, 0, s, s, x, y, s, s);
    ctx.drawImage(img, iw - s, 0, s, s, x + w - s, y, s, s);
    ctx.drawImage(img, 0, ih - s, s, s, x, y + h - s, s, s);
    ctx.drawImage(img, iw - s, ih - s, s, s, x + w - s, y + h - s, s, s);

    if (!soloBorde && dw > 0 && dh > 0) {
      ctx.drawImage(img, s, s, cw, ch, dx, dy, dw, dh);
    }
    // bordes
    ctx.drawImage(img, s, 0, cw, s, dx, y, dw, s);
    ctx.drawImage(img, s, ih - s, cw, s, dx, y + h - s, dw, s);
    ctx.drawImage(img, 0, s, s, ch, x, dy, s, dh);
    ctx.drawImage(img, iw - s, s, s, ch, x + w - s, dy, s, dh);
  }

  _rect(ctx, x, y, w, h, color, alpha = 1) {
    if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
    if (alpha < 1) ctx.restore();
  }

  _texto(ctx, texto, x, y, { size = 4, color = P.texto, align = 'left', baseline = 'top', shadow = true } = {}) {
    ctx.save();
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) {
      ctx.fillStyle = 'rgba(4,8,16,0.85)';
      ctx.fillText(texto, Math.round(x) + 1, Math.round(y) + 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(texto, Math.round(x), Math.round(y));
    ctx.restore();
  }

  _zona(id, x, y, w, h) {
    if (!id) return;
    this._hit.push({ id, x, y, w, h });
  }

  _hover(x, y, w, h) {
    const p = this.pointer;
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  }

  // --- fondo ----------------------------------------------------------------

  _fondo(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    grad.addColorStop(0, '#080d1a');
    grad.addColorStop(0.62, '#0b1424');
    grad.addColorStop(1, '#050810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    for (const s of this.stars) {
      const a = s.a * (0.55 + 0.45 * Math.sin(this.time * 1.4 + s.p));
      ctx.fillStyle = `rgba(190,220,255,${a.toFixed(3)})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    }

    // halo verde del invernadero
    const halo = ctx.createRadialGradient(144, 96, 4, 144, 96, 82);
    halo.addColorStop(0, 'rgba(86,200,140,0.20)');
    halo.addColorStop(1, 'rgba(86,200,140,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(60, 16, 168, 150);

    // suelo de la base
    ctx.fillStyle = '#081120';
    ctx.fillRect(0, 148, LOGICAL_WIDTH, LOGICAL_HEIGHT - 148);
    for (let y = 150; y < LOGICAL_HEIGHT; y += 7) {
      this._rect(ctx, 0, y, LOGICAL_WIDTH, 1, '#0e1c31', 0.9);
    }

    this._panel(ctx, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, true);
  }

  // --- cabecera -------------------------------------------------------------

  _cabecera(ctx) {
    this._texto(ctx, 'PRODUCCION DE ALIMENTOS', 10, 9, { size: 5, color: P.texto });

    const maduro = this.crops[this.selected] && this.crops[this.selected].progress > 0.9;
    if (maduro && Math.sin(this.time * 5) > -0.2) {
      this._sprite(this._r, 'bandera', 150, 4, 16, 16);
    }

    this._sprite(this._r, 'canasta', 176, 4, 16, 16);
    this._texto(ctx, `${this.stats.cosechas}`, 194, 9, { size: 4, color: P.ambar });

    this._sprite(this._r, 'oxigeno', 210, 4, 16, 16);
    this._texto(ctx, `${this.stats.o2.toFixed(0)}`, 228, 9, { size: 4, color: P.azul });

    const lucesOn = suma(this.env.luz) > 0;
    this._sprite(this._r, lucesOn ? 'sol' : 'luna', 242, 4, 16, 16);
    const ciclo = this.cultivos[this.selected]?.dias_cosecha;
    const cicloTxt = Math.max(1, Math.round(medio(ciclo) || 1));
    // Día dentro del ciclo actual (el contador global puede pasar de un ciclo).
    const diaCiclo = ((this.day - 1) % cicloTxt) + 1;
    this._texto(ctx, `DIA ${diaCiclo}/${cicloTxt}`, 260, 9, { size: 4, color: P.suave });
  }

  // --- selector de cultivos -------------------------------------------------

  _panelCultivos(ctx) {
    const { x, y, w, h } = L.panelCultivos;
    this._panel(ctx, x, y, w, h);
    this._texto(ctx, 'CULTIVOS', x + 6, y + 6, { size: 4, color: P.suave });

    ORDEN_CULTIVOS.forEach((id, i) => {
      const cx = L.tarjeta.x;
      const cy = L.tarjeta.y + i * L.tarjeta.paso;
      const cw = L.tarjeta.w;
      const ch = L.tarjeta.h;
      const sel = id === this.selected;
      const hover = this._hover(cx, cy, cw, ch);

      this._rect(ctx, cx, cy, cw, ch, sel ? '#23375c' : hover ? '#1a2946' : '#101a30');
      if (sel) {
        this._rect(ctx, cx, cy, cw, 1, P.verde);
        this._rect(ctx, cx, cy + ch - 1, cw, 1, P.verde);
        this._rect(ctx, cx, cy, 1, ch, P.verde);
        this._rect(ctx, cx + cw - 1, cy, 1, ch, P.verde);
      }

      const st = this.crops[id];
      const etapa = Math.min(4, Math.floor(st.progress * 5));
      this._sprite(this._r, `etapa${etapa}`, cx + 1, cy, 16, 16);

      this._texto(ctx, NOMBRE[id], cx + 20, cy + 2, { size: 4, color: sel ? P.texto : P.suave });

      // barra de progreso mini
      const bx = cx + 20;
      const by = cy + 9;
      this._rect(ctx, bx, by, 38, 3, '#0a1226');
      const pw = Math.round(38 * clamp(st.progress, 0, 1));
      if (pw > 0) this._rect(ctx, bx, by, pw, 3, P.verde);
      this._rect(ctx, bx, by, 38, 1, '#1c2a46', 0.8);

      const color = st.health >= 70 ? P.verde : st.health >= 42 ? P.ambar : P.rojo;
      this._texto(ctx, `${Math.round(st.progress * 100)}%`, cx + cw - 2, cy + 8, { size: 4, color, align: 'right' });

      this._zona(`cultivo:${id}`, cx, cy, cw, ch);
    });
  }

  // --- cámara de cultivo ----------------------------------------------------

  _camara(ctx) {
    const r = this._r;

    // día/noche (mando de la cámara)
    const lucesOn = suma(this.env.luz) > 0;
    this._sprite(r, lucesOn ? 'sol' : 'luna', L.dia.x, L.dia.y, 16, 16);

    // luminaria
    this._sprite(r, 'luminaria', L.soporte.x, L.soporte.y, L.soporte.w, L.soporte.h);
    LUCES.forEach((luz, i) => {
      const x = L.lampara.x + i * L.lampara.paso;
      const pct = this.env.luz[luz.id] || 0;
      const clave = pct > 0 ? luz.lampOn : luz.lampOff;
      this._sprite(r, clave, x, L.lampara.y, 16, 16);
    });

    // suelo / maceta
    this._rect(ctx, L.suelo.x, L.suelo.y, L.suelo.w, L.suelo.h, P.suelo);
    this._rect(ctx, L.suelo.x, L.suelo.y, L.suelo.w, 2, P.sueloClaro);
    this._rect(ctx, L.suelo.x + 3, L.suelo.y + 4, L.suelo.w - 6, L.suelo.h - 5, '#241a11', 0.75);
    for (let i = 0; i < 10; i++) {
      const px = L.suelo.x + 5 + ((i * 17) % (L.suelo.w - 10));
      const py = L.suelo.y + 4 + ((i * 7) % 6);
      this._rect(ctx, px, py, 2, 1, P.sueloClaro, 0.7);
    }

    // planta (etapa 0..4) con leve balanceo
    const st = this.crops[this.selected];
    const etapa = Math.min(4, Math.floor(st.progress * 5));
    const sway = Math.round(Math.sin(this.time * 1.6) * 1);
    const salud = st.health;
    const p = L.planta;
    this._rect(ctx, p.x + 10, p.y + p.h - 5, p.w - 20, 5, 'rgba(0,0,0,0.35)', 1);
    if (!this._sprite(r, `etapa${etapa}`, p.x + sway, p.y, p.w, p.h)) {
      this._rect(ctx, p.x + 24, p.y + 40, 24, 32, '#4fa35f');
    }

    // rayos de luz (encima de la planta, translúcidos)
    LUCES.forEach((luz, i) => {
      const pct = this.env.luz[luz.id] || 0;
      if (pct <= 0) return;
      const cx = L.lampara.x + i * L.lampara.paso + 8;
      const alpha = 0.10 + 0.26 * (pct / 100);
      this._sprite(r, luz.rayo, cx - 16, L.rayo.y, 32, 24, alpha);
    });

    // carita de salud
    const cara = salud >= 72 ? 'feliz' : salud >= 42 ? 'normal' : 'triste';
    this._sprite(r, cara, L.cara.x, L.cara.y, 16, 16);

    // progreso de la planta
    this._sprite(r, 'calendario', L.calendario.x, L.calendario.y, 16, 16);
    const g = L.progreso;
    const llenos = Math.round(clamp(st.progress, 0, 1) * g.seg);
    for (let i = 0; i < g.seg; i++) {
      const clave = i < llenos ? (i === g.seg - 1 ? 'segOptimo' : 'segDias') : 'segVacio';
      this._sprite(r, clave, g.x + i * g.w, g.y, g.w, g.h);
    }

    // partículas
    for (const part of this.particles) {
      const a = 1 - part.t / part.life;
      this._rect(ctx, part.x, part.y, 2, 2, part.color, clamp(a, 0, 1));
    }
  }

  // --- panel de variables ---------------------------------------------------

  _panelVariables(ctx) {
    const r = this._r;
    const { x, y, w, h } = L.panelVars;
    this._panel(ctx, x, y, w, h);
    this._texto(ctx, 'VARIABLES', 214, 25, { size: 4, color: P.suave });

    const cfg = this.cultivos[this.selected] || CULTIVOS_DEFECTO.lechuga;

    for (const fila of FILAS) {
      const hover = this._hover(193, fila.botonY - 3, 112, 19);
      if (hover) {
        this._hoverFila = fila.id;
        this._rect(ctx, 194, fila.botonY - 4, 114, 22, '#1a2946', 0.55);
      }

      // icono indicador (estado actual aplicado)
      const icono = this._iconoAmbiente(fila.id, cfg);
      const ix = fila.id === 'co2' ? 193 : fila.id === 'hum' ? 194 : 196;
      this._sprite(r, icono, ix, fila.iconoY, fila.id === 'temp' ? 12 : fila.id === 'co2' ? 18 : 16, fila.id === 'temp' ? 30 : fila.id === 'co2' ? 14 : 16);

      this._texto(ctx, fila.etiqueta, 212, fila.textoY, { size: 4, color: P.suave });
      this._texto(ctx, this._objetivoTexto(fila.id, cfg), 212, fila.textoY + 6, { size: 4, color: P.tenue });

      const valor = fila.id === 'temp'
        ? this.draft.temp.toFixed(1)
        : fila.id === 'hum'
          ? `${Math.round(this.draft.hum)}`
          : `${Math.round(this.draft.co2)}`;

      this._botonSprite(r, 'menos', 'menosP', 240, fila.botonY, 16, 16, `dec:${fila.id}`);
      this._sprite(r, fila.caja, 256, fila.botonY, 32, 16);
      this._texto(ctx, valor, 272, fila.botonY + 8, { size: 4, color: P.texto, align: 'center', baseline: 'middle', shadow: false });
      this._botonSprite(r, 'mas', 'masP', 288, fila.botonY, 16, 16, `inc:${fila.id}`);
    }

    // luces
    this._texto(ctx, 'LUZ', 198, 97, { size: 4, color: P.suave });
    const total = suma(this.draft.luz);
    this._texto(ctx, `TOTAL ${Math.round(total)}%`, 262, 97, {
      size: 4,
      color: total === 100 ? P.tenue : P.ambar,
    });

    LUCES.forEach((luz, i) => {
      const ry = FILA_LUCES_Y + i * PASO_LUCES;
      const hover = this._hover(194, ry - 1, 108, 11);
      if (hover) {
        this._hoverFila = `luz:${luz.id}`;
        this._rect(ctx, 194, ry - 1, 108, 11, '#1a2946', 0.55);
      }

      const pct = this.draft.luz[luz.id] || 0;
      this._sprite(r, pct > 0 ? luz.ledOn : luz.ledOff, 196, ry + 2, 12, 6);
      this._texto(ctx, luz.etiqueta, 212, ry + 2, { size: 4, color: P.suave });
      const ideal = Math.round((cfg.luz && cfg.luz[luz.id]) || 0);
      this._texto(ctx, `${ideal}`, 240, ry + 2, { size: 4, color: P.tenue });
      this._botonMini(ctx, 252, ry, `dec:luz:${luz.id}`, -1, luz.color);
      this._texto(ctx, `${Math.round(pct)}`, 268, ry + 3, { size: 4, color: pct > 0 ? luz.color : P.tenue, align: 'center', shadow: false });
      this._botonMini(ctx, 286, ry, `inc:luz:${luz.id}`, 1, luz.color);
    });

    // flecha de aviso: señala la primera variable fuera de rango
    const ev = this._evaluar(this.env, cfg);
    if (ev.issues.length && Math.sin(this.time * 7) > -0.35) {
      let fy = 46;
      if (ev.issues[0] === 'HUMEDAD') fy = 64;
      else if (ev.issues[0] === 'CO2') fy = 82;
      else if (ev.issues[0] === 'LUZ') {
        let indice = 0;
        let peor = -1;
        LUCES.forEach((l, i) => {
          const d = Math.abs((this.env.luz[l.id] || 0) - ((cfg.luz && cfg.luz[l.id]) || 0));
          if (d > peor) { peor = d; indice = i; }
        });
        fy = FILA_LUCES_Y + indice * PASO_LUCES + 2;
      }
      this._sprite(this._r, 'flecha', 182, fy, 8, 8);
    }
  }

  _iconoAmbiente(fila, cfg) {
    if (fila === 'temp') {
      const r = cfg.temperatura_C;
      if (!r) return 'termoIdeal';
      if (this.env.temp < r[0]) return 'termoFrio';
      if (this.env.temp > r[1]) return 'termoCaliente';
      return 'termoIdeal';
    }
    if (fila === 'hum') {
      const r = cfg.humedad_pct;
      if (!r) return 'gotaMedia';
      if (this.env.hum < r[0]) return 'gotaSeca';
      if (this.env.hum > r[1]) return 'gotaLlena';
      return 'gotaMedia';
    }
    const r = cfg.co2_ppm;
    if (!r) return 'co2Ideal';
    if (this.env.co2 < r[0]) return 'co2Bajo';
    if (this.env.co2 > r[1]) return 'co2Alto';
    return 'co2Ideal';
  }

  _objetivoTexto(fila, cfg) {
    const r = fila === 'temp' ? cfg.temperatura_C : fila === 'hum' ? cfg.humedad_pct : cfg.co2_ppm;
    const m = medio(r);
    if (m === null) return 'S/D';
    if (fila === 'temp') return `~${m.toFixed(1)}C`;
    if (fila === 'hum') return `~${Math.round(m)}%`;
    return `~${Math.round(m)}`;
  }

  _botonSprite(renderer, clave, claveP, x, y, w, h, id) {
    const hover = this._hover(x, y, w, h);
    this._sprite(renderer, hover ? claveP : clave, x, y, w, h);
    if (hover) {
      const ctx = renderer.context;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.restore();
    }
    this._zona(id, x, y, w, h);
  }

  _botonMini(ctx, x, y, id, signo, color) {
    const hover = this._hover(x, y, 10, 10);
    this._rect(ctx, x, y, 10, 10, hover ? '#33507f' : '#1e2c49');
    this._rect(ctx, x, y, 10, 1, hover ? '#8fd3ff' : '#3c4678');
    this._rect(ctx, x, y + 9, 10, 1, '#0b1220');
    this._rect(ctx, x, y, 1, 10, '#3c4678');
    this._rect(ctx, x + 9, y, 1, 10, '#0b1220');

    ctx.fillStyle = hover ? color : '#dbe6ff';
    ctx.fillRect(x + 2, y + 4, 6, 2);
    if (signo > 0) ctx.fillRect(x + 4, y + 2, 2, 6);

    this._zona(id, x, y, 10, 10);
  }

  // --- pie ------------------------------------------------------------------

  _pie(ctx, renderer) {
    const { x, y, w, h } = L.panelPie;
    this._panel(ctx, x, y, w, h);

    // mensaje / ayuda contextual
    const cfg = this.cultivos[this.selected] || CULTIVOS_DEFECTO.lechuga;
    let texto = this.msg.texto;
    let tono = this.msg.tone;

    if (this._hoverFila) {
      texto = this._textoAyuda(this._hoverFila, cfg);
      tono = 'info';
    } else if (!this.msg || this.msg.t <= 0) {
      texto = 'MODIFICA LAS VARIABLES Y PULSA APLICAR';
      tono = 'info';
    }

    const color = tono === 'ok' ? P.verde : tono === 'warn' ? P.ambar : tono === 'bad' ? P.rojo : P.suave;
    const ev = this._evaluar(this.env, cfg);
    const icono = ev.issues.length === 0 ? 'check' : 'alerta';
    this._sprite(renderer, icono, 10, 156, 16, 16);

    this._texto(ctx, texto.slice(0, 40), 30, 161, { size: 4, color });

    // perilla decorativa + pista de salida + APLICAR
    this._sprite(renderer, 'perilla', 236, 156, 14, 16);
    this._texto(ctx, 'ESC', 196, 162, { size: 4, color: P.tenue });

    const hoverAplicar = this._hover(254, 156, 48, 16);
    this._sprite(renderer, hoverAplicar ? 'aplicarP' : 'aplicar', 254, 156, 48, 16);
    if (hoverAplicar) this._rect(ctx, 254, 156, 48, 1, P.verde, 0.7);
    this._zona('aplicar', 254, 156, 48, 16);

    this._zona('salir', 192, 156, 20, 16);
  }

  _textoAyuda(fila, cfg) {
    if (fila.startsWith('luz:')) {
      const id = fila.slice(4);
      const ideal = Math.round((cfg.luz && cfg.luz[id]) || 0);
      return `OBJ ${id.toUpperCase()}: ${ideal}% DE LUZ`;
    }
    const r = fila === 'temp' ? cfg.temperatura_C : fila === 'hum' ? cfg.humedad_pct : cfg.co2_ppm;
    if (!r) return `${fila.toUpperCase()}: SIN DATO CONFIRMADO`;
    if (fila === 'temp') return `OBJ TEMP: ${r[0]} A ${r[1]} C`;
    if (fila === 'hum') return `OBJ HUMEDAD: ${Math.round(r[0])} A ${Math.round(r[1])} %`;
    return `OBJ CO2: ${Math.round(r[0])} A ${Math.round(r[1])} PPM`;
  }

  // --- destello de cosecha --------------------------------------------------

  _destello(ctx) {
    if (this.flash <= 0) return;
    const a = clamp(this.flash / 1.4, 0, 1);
    const escala = 1 + (1 - a) * 0.6;
    const w = 32 * escala;
    const h = 32 * escala;
    const x = 144 - w / 2;
    const y = 84 - h / 2;
    this._sprite(this._r, 'estrella', x, y, w, h, a);
    this._texto(ctx, this.flashTexto, 144, 104, { size: 5, color: P.ambar, align: 'center' });
  }
}

export default ProduccionAlimentos;
