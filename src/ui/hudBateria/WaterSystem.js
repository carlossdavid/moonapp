/** Agua potable del traje; los tiempos están en horas de misión (juego). */
export const WATER_CAPACITY_ML = 950;
export const WATER_CONSUMPTION_ML_PER_HOUR = 170;
export const RETURN_MINUTES = 60;
export const SAFETY_MARGIN_MINUTES = 30;

export class SuitWater {
  constructor(initialMl = WATER_CAPACITY_ML, { returnMinutes = RETURN_MINUTES, marginMinutes = SAFETY_MARGIN_MINUTES } = {}) {
    this.ml = Math.max(0, Math.min(WATER_CAPACITY_ML, initialMl));
    this.returnMinutes = Math.max(0, returnMinutes);
    this.marginMinutes = Math.max(0, marginMinutes);
  }

  /** Consumir únicamente durante una EVA; no reinicia al cambiar de escena. */
  update(gameHours, exterior) {
    if (exterior && Number.isFinite(gameHours) && gameHours > 0) {
      this.ml = Math.max(0, this.ml - WATER_CONSUMPTION_ML_PER_HOUR * gameHours);
    }
    return this.snapshot();
  }

  /** Rellenar la bolsa solo en la base; devuelve los mL transferidos. */
  refill(interior) {
    if (!interior) return 0;
    const addedMl = WATER_CAPACITY_ML - this.ml;
    this.ml = WATER_CAPACITY_ML;
    return addedMl;
  }

  snapshot() {
    const percent = 100 * this.ml / WATER_CAPACITY_ML;
    const returnMl = WATER_CONSUMPTION_ML_PER_HOUR * (this.returnMinutes + this.marginMinutes) / 60;
    let alert = null;
    if (this.ml <= 0) alert = 'Agua agotada';
    else if (this.ml <= returnMl) alert = 'Regresa a la estación';
    else if (percent <= 25) alert = 'Te queda poca agua';
    return {
      ml: this.ml,
      percent,
      autonomyHours: this.ml / WATER_CONSUMPTION_ML_PER_HOUR,
      returnMl,
      alert,
    };
  }
}
