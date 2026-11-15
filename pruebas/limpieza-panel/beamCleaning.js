// Modelo de JUEGO, no un simulador físico. El electroimán orienta el
// emisor; es la carga eléctrica impartida por el haz la que repele el polvo.
export const COLS = 6;
export const ROWS = 4;
export const BOARD = Object.freeze({ w: 640, h: 360 });
export const PANEL = Object.freeze({ x: 337, y: 81, w: 252, h: 168 });
export const PORTS = Object.freeze([
  { source: { x: 130, y: 158 }, socket: { x: 245, y: 217 } },
  { source: { x: 130, y: 198 }, socket: { x: 277, y: 217 } },
]);
const SWEEP_STEP = 0.24; // segundos por zona, animación abreviada para la prueba.

export class BeamCleaning {
  constructor() { this.reset(); }

  reset() {
    this.connected = [false, false];
    this.dust = Array(COLS * ROWS).fill(true);
    this.phase = 'connect'; // connect → ready → sweeping → complete
    this.elapsedInStep = 0;
    this.cleanCells = 0;
  }

  get progress() { return Math.round(this.cleanCells * 100 / this.dust.length); }
  get complete() { return this.phase === 'complete'; }

  connect(index) {
    if (index !== 0 && index !== 1) return false;
    if (this.phase !== 'connect' || this.connected[index]) return false;
    this.connected[index] = true;
    if (this.connected.every(Boolean)) this.phase = 'ready';
    return true;
  }

  activate() {
    if (this.phase !== 'ready') return false;
    this.phase = 'sweeping';
    return true;
  }

  tick(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Tiempo inválido');
    if (this.phase !== 'sweeping') return;
    this.elapsedInStep += seconds;
    while (this.elapsedInStep >= SWEEP_STEP && this.cleanCells < this.dust.length) {
      this.elapsedInStep -= SWEEP_STEP;
      this.dust[this.cleanCells] = false;
      this.cleanCells++;
    }
    if (this.cleanCells === this.dust.length) {
      this.phase = 'complete';
      this.elapsedInStep = 0;
    }
  }
}
