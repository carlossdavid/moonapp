import { Game } from '../src/core/Game.js';
import { drawMissionHUD } from './hud.js';
import { createBatterySimulation, advanceBatterySimulation } from '../pruebas/Hud_bateria/BatterySimulation.js';
import { SuitWater } from '../pruebas/Hud_bateria/WaterSystem.js';
import { SistemaOxigeno } from '../oxygen_system.js';
import { MissionState } from './mission-state.js';
import { ImpactFeedback } from './presentation.js';

/** Una sola instancia de cada sistema, independiente de las escenas visitadas. */
export class IntegratedGame extends Game {
  constructor(canvas, ui, solar) {
    super(canvas);
    this.ui = ui;
    this.solar = solar;
    this.shadowed = false;
    this.charging = false;
    this.oxygenCharging = false;
    this.powerW = 144.375;
    this.energy = createBatterySimulation(() => this.shadowed);
    this.water = new SuitWater();
    this.oxygen = new SistemaOxigeno();
    this.hudVisible = true;
    this.stationModes = new Map();
    this.transitioning = false;
    this.mission = new MissionState();
    this.foodBonus = 0;
    this.claimedCrops = new Set();
    this.impacts = new ImpactFeedback();
    this.rechargeCompleted = false;
    // Adaptador local: también los textos dibujados sobre canvas usan la fuente del juego.
    this.renderer.drawText = (text, x, y, color = '#ffffff') => {
      const ctx = this.renderer.context;
      ctx.fillStyle = color; ctx.font = '4px "Press Start 2P",monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(text, Math.round(x), Math.round(y));
    };
  }

  async changeScene(scene) {
    if (this.transitioning) return;
    this.transitioning = true;
    const previous = this.scene;
    try {
      await this.ui.transition(async () => {
        this.impacts.reset();
        previous?.destroy?.();
        await super.changeScene(scene);
      });
    } finally {
      this.transitioning = false;
      this.input.update();
    }
  }

  update(dt) {
    this.messages?.tick(dt, this, this.ui.blocked || this.transitioning || this.ui.transitionActive || this.scene?.isRecarga || this.mission.dead);
    if (this.mission.dead) {
      this.input._down.clear();
      this.ui.updateSurvival();
      if (this.state === 'playing' && this.scene) this.scene.update(dt);
      this.input.update();
      return;
    }
    if (this.transitioning || this.ui.transitionActive) { this.input._down.clear(); this.input.update(); return; }
    if (this.state === 'playing' && this.ui.blocked) {
      // Un iframe puede recibir keyup: no conservar WASD pulsado al volver.
      this.input._down.clear();
      this.input.update();
      return;
    }
    const playing = this.state === 'playing';
    if (playing) this.impacts.tick(dt);
    if (playing && !this.scene?.isRecarga) {
      if (this.input.isPressed('Digit1')) this.powerW = 144.375;
      if (this.input.isPressed('Digit2')) this.powerW = 180;
      if (this.input.isPressed('Digit3')) this.powerW = 233;
      if (this.input.isPressed('KeyX')) this.shadowed = !this.shadowed;
      if (this.input.isPressed('KeyT')) this.hudVisible = !this.hudVisible;
    }
    // No permitir que Game vuelva a abrir y drenar el JSON ficticio del traje.
    this.input._pressed.delete('KeyT');
    this.suitHudOpen = false;
    super.update(dt);
    this.suitHudOpen = false;
    if (this.state !== 'playing' || this.ui.blocked || this.scene?.isRecarga) return;

    this.solar.progress.tick(dt);
    const previousHours = this.energy.tiempoHoras;
    const snapshot = advanceBatterySimulation(this.energy, dt, {
      exterior: this.scene?.isExterior === true,
      interior: this.scene?.isInterior === true,
      powerW: this.powerW, charging: this.charging,
    });
    this.water.update(snapshot.tiempo.transcurridoHoras - previousHours, this.scene?.isExterior === true);
    const station = snapshot.estaciones.find(item => item.id === 'oxigeno');
    this.oxygen.activarElectrolisis(snapshot.base.modo === 'normal' && station?.activa === true && !station.pausada);
    this.oxygen.update(dt);
    if (this.scene?.isExterior) this.oxygen.updateSuit(dt);
    else if (this.scene?.isInterior && this.oxygenCharging
      && this.oxygen.oxigenoTrajeKg < this.oxygen.config.capacidadTrajeKg - 1e-9) this.oxygen.rechargeSuit(dt);
    this.mission.tick(dt, [this.foodLevel, this.water.snapshot().ml,
      this.energy.energiaTrajeWh, this.oxygen.oxigenoTrajeKg]);
    this.ui.updateSurvival();
    if (this.mission.alertPending && !this.ui.blocked) this.ui.openStory();
  }

  get foodLevel() {
    return Math.max(0, Math.min(100, 100 - this.energy.tiempoHoras * (40 / 13.6) + this.foodBonus));
  }

  completeRecharge() {
    // Transferencia acelerada de entrenamiento, sin avanzar el reloj de misión.
    const oxygenMissing = this.oxygen.config.capacidadTrajeKg - this.oxygen.oxigenoTrajeKg;
    this.oxygen.rechargeSuit(1, { tasaKgH: oxygenMissing / (.08 * this.oxygen.velocidadTiempo * this.oxygen.config.eficienciaCargador) });
    const batteryMissing = this.energy.config.capacidadTrajeWh - this.energy.energiaTrajeWh;
    this.energy.rechargeSuit(300, { potenciaKW: batteryMissing / (24000 * this.energy.velocidadTiempo * this.energy.config.eficienciaCargador) });
    this.water.refill(true);
    this.rechargeCompleted = true;
    this.ui.updateSurvival();
    this.ui.notify('Recarga integral lista: O₂, agua y batería. Retorno CO₂ conectado.', 'SOPORTE VITAL');
  }

  harvest(crop) {
    if (this.claimedCrops.has(crop)) return;
    this.claimedCrops.add(crop);
    this.foodBonus = this.energy.tiempoHoras * (40 / 13.6);
    this.ui.notify('Insignia obtenida: ración de entrenamiento consumida. Alimentación recuperada.');
  }

  render(alpha) {
    super.render(alpha);
    if (this.state !== 'playing' || this.scene?.isRecarga || !this.hudVisible) return;
    const snapshot = this.energy.getSnapshot();
    const water = this.water.snapshot();
    const oxygen = this.oxygen.getSnapshot().traje;
    this.renderer.begin(null);
    drawMissionHUD(this.renderer, this.assets, {
      suit: snapshot.traje, food: this.foodLevel, water, oxygen, health: this.mission.health,
    });
    this.renderer.end();
    this.canvas.title = `Batería: ${snapshot.traje.porcentaje.toFixed(1)} % · Agua: ${water.ml.toFixed(1)} mL · O₂: ${oxygen.oxigenoKg.toFixed(3)} kg`;
  }
}
