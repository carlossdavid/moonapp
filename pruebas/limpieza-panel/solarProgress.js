import { SEGUNDOS_REALES_POR_DIA } from '../../src/systems/EnergySystem.js';

/** Estado de esta prueba: no representa la batería ni la potencia real de la base. */
export class SolarProgress {
  constructor() {
    this.seconds = 0;
    this.discovered = false;
    this.cleanUntil = new Map();
  }

  tick(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Tiempo inválido');
    this.seconds += dt;
  }

  markClean(panelName) {
    this.cleanUntil.set(panelName, this.seconds + SEGUNDOS_REALES_POR_DIA);
  }

  remaining(panelName) {
    return Math.max(0, (this.cleanUntil.get(panelName) ?? 0) - this.seconds);
  }

  isClean(panelName) {
    return this.remaining(panelName) > 0;
  }

  get cleanCount() {
    let count = 0;
    for (const name of this.cleanUntil.keys()) if (this.isClean(name)) count++;
    return count;
  }
}
