import { HORAS_POR_DIA, SEGUNDOS_REALES_POR_DIA } from './EnergySystem.js';

function clamp(v, min, max) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * Sistema ligero de necesidades/condición inspirado en supervivencia (PZ-like) para el prototipo 2D.
 * No sustituye a energía/oxígeno/agua de traje: los complementa con estado del astronauta.
 * Tiempo base: horas de juego derivadas del reloj de energía (24h juego = 300s reales por defecto).
 */
export class SurvivalSystem {
  constructor(opts = {}) {
    this.maxHealth = 100;
    this.maxHunger = 100;   // 100 = saciado
    this.maxThirst = 100;   // 100 = hidratado (sincronizable con agua de traje)
    this.maxFatigue = 100;  // 100 = descansado
    this.maxMorale = 100;

    this.health = opts.health ?? 100;
    this.hunger = opts.hunger ?? 100;
    this.thirst = opts.thirst ?? 100;
    this.fatigue = opts.fatigue ?? 100;
    this.morale = opts.morale ?? 80;

    // Tasas por hora de juego (ajustadas para sesiones cortas pero con presión perceptible)
    this.rates = {
      hungerPerHour: 2.8,      // ~36h juego para vaciar desde lleno
      thirstPerHourExterior: 5.5,
      thirstPerHourInterior: 1.8,
      fatiguePerHourAwake: 3.2,
      fatigueRecoverPerHourRest: 18,
      healthRegenPerHour: 0.8,
      healthDrainPerHourCritical: 4.5,
      moraleDriftPerHour: 0.6,
    };

    this.status = 'Estable';
    this.alerts = [];
    this._lastGameHours = null;
    this.elapsedGameHours = 0;
  }

  reset() {
    this.health = 100;
    this.hunger = 100;
    this.thirst = 100;
    this.fatigue = 100;
    this.morale = 80;
    this.status = 'Estable';
    this.alerts = [];
    this._lastGameHours = null;
    this.elapsedGameHours = 0;
  }

  /**
   * @param {number} dt real seconds
   * @param {{ gameHours?: number, exterior?: boolean, interior?: boolean, activity?: 'idle'|'walk'|'work'|'rest', suitWaterPercent?: number, oxygenAlert?: boolean, energyAlert?: boolean, resting?: boolean }} ctx
   */
  update(dt, ctx = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return this.getSnapshot();

    let dHours = 0;
    if (Number.isFinite(ctx.gameHours)) {
      if (this._lastGameHours == null) this._lastGameHours = ctx.gameHours;
      dHours = Math.max(0, ctx.gameHours - this._lastGameHours);
      // si hubo reset de simulación
      if (dHours > 12) dHours = 0;
      this._lastGameHours = ctx.gameHours;
      this.elapsedGameHours = Math.max(this.elapsedGameHours, ctx.gameHours);
    } else {
      dHours = dt * (HORAS_POR_DIA / SEGUNDOS_REALES_POR_DIA);
      this.elapsedGameHours += dHours;
    }

    const exterior = !!ctx.exterior;
    const interior = !!ctx.interior;
    const activity = ctx.activity || 'idle';
    const resting = !!ctx.resting || (interior && activity === 'rest');

    let hungerRate = this.rates.hungerPerHour;
    let thirstRate = exterior ? this.rates.thirstPerHourExterior : this.rates.thirstPerHourInterior;
    let fatigueRate = this.rates.fatiguePerHourAwake;

    if (activity === 'walk') { hungerRate *= 1.15; thirstRate *= 1.2; fatigueRate *= 1.25; }
    if (activity === 'work') { hungerRate *= 1.35; thirstRate *= 1.35; fatigueRate *= 1.5; }
    if (exterior) { fatigueRate *= 1.15; }

    this.hunger = clamp(this.hunger - hungerRate * dHours, 0, this.maxHunger);
    this.thirst = clamp(this.thirst - thirstRate * dHours, 0, this.maxThirst);

    if (resting) {
      this.fatigue = clamp(this.fatigue + this.rates.fatigueRecoverPerHourRest * dHours, 0, this.maxFatigue);
    } else {
      this.fatigue = clamp(this.fatigue - fatigueRate * dHours, 0, this.maxFatigue);
    }

    // Sincronización suave con agua de traje si está disponible
    if (Number.isFinite(ctx.suitWaterPercent)) {
      const target = clamp(ctx.suitWaterPercent, 0, 100);
      this.thirst = clamp(lerp(this.thirst, target, 0.08), 0, 100);
    }

    // Moral: deriva según comodidad/seguridad
    let moraleDelta = -this.rates.moraleDriftPerHour * dHours;
    if (interior) moraleDelta += 0.9 * dHours;
    if (this.hunger > 60 && this.thirst > 60 && this.fatigue > 50) moraleDelta += 0.5 * dHours;
    if (ctx.oxygenAlert || ctx.energyAlert) moraleDelta -= 2.5 * dHours;
    this.morale = clamp(this.morale + moraleDelta, 0, this.maxMorale);

    // Salud: regen si estable, drenaje si crítico
    const criticalNeeds = (this.hunger <= 10 ? 1 : 0) + (this.thirst <= 10 ? 1 : 0) + (this.fatigue <= 8 ? 1 : 0) + (ctx.oxygenAlert ? 1 : 0);
    if (criticalNeeds === 0 && this.hunger > 35 && this.thirst > 35 && this.fatigue > 25) {
      this.health = clamp(this.health + this.rates.healthRegenPerHour * dHours, 0, this.maxHealth);
    } else if (criticalNeeds > 0) {
      this.health = clamp(this.health - this.rates.healthDrainPerHourCritical * criticalNeeds * dHours, 0, this.maxHealth);
    }
    if (ctx.oxygenAlert) this.health = clamp(this.health - 1.5 * dHours, 0, this.maxHealth);

    this._recomputeStatus();
    return this.getSnapshot();
  }

  consumeFood(amount = 25) {
    this.hunger = clamp(this.hunger + amount, 0, this.maxHunger);
    this.morale = clamp(this.morale + amount * 0.15, 0, this.maxMorale);
    this._recomputeStatus();
  }

  drink(amount = 30) {
    this.thirst = clamp(this.thirst + amount, 0, this.maxThirst);
    this._recomputeStatus();
  }

  rest(hoursGame = 1) {
    this.fatigue = clamp(this.fatigue + hoursGame * 12, 0, this.maxFatigue);
    this.morale = clamp(this.morale + hoursGame * 2, 0, this.maxMorale);
    this._recomputeStatus();
  }

  applyDamage(amount = 0) {
    this.health = clamp(this.health - Math.max(0, amount), 0, this.maxHealth);
    this._recomputeStatus();
  }

  _recomputeStatus() {
    const alerts = [];
    if (this.health <= 20) alerts.push('Salud crítica');
    else if (this.health <= 40) alerts.push('Salud baja');
    if (this.hunger <= 15) alerts.push('Hambre severa');
    else if (this.hunger <= 35) alerts.push('Hambre');
    if (this.thirst <= 15) alerts.push('Sed severa');
    else if (this.thirst <= 35) alerts.push('Sed');
    if (this.fatigue <= 15) alerts.push('Agotamiento');
    else if (this.fatigue <= 35) alerts.push('Fatiga');
    if (this.morale <= 20) alerts.push('Moral baja');
    this.alerts = alerts;

    if (this.health <= 0) this.status = 'Incapacitado';
    else if (criticalScore(this) >= 4) this.status = 'Crítico';
    else if (criticalScore(this) >= 2) this.status = 'En riesgo';
    else if (this.morale >= 70 && this.health > 80) this.status = 'Óptimo';
    else this.status = 'Estable';
  }

  getSnapshot() {
    return {
      health: this.health,
      hunger: this.hunger,
      thirst: this.thirst,
      fatigue: this.fatigue,
      morale: this.morale,
      status: this.status,
      alerts: [...this.alerts],
      dead: this.health <= 0,
      critical: criticalScore(this) >= 3,
    };
  }
}

function criticalScore(s) {
  let n = 0;
  if (s.health <= 25) n++;
  if (s.hunger <= 20) n++;
  if (s.thirst <= 20) n++;
  if (s.fatigue <= 20) n++;
  return n;
}

export function createSurvivalSystem(opts) {
  return new SurvivalSystem(opts);
}
