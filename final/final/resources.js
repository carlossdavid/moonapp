import { Game } from '../src/core/Game.js';
import { drawBatteryHUD } from '../pruebas/Hud_bateria/BatteryHUD.js';
import { createBatterySimulation, advanceBatterySimulation } from '../pruebas/Hud_bateria/BatterySimulation.js';
import { foodPercent } from '../pruebas/Hud_bateria/FoodSystem.js';
import { SuitWater } from '../pruebas/Hud_bateria/WaterSystem.js';
import { SistemaOxigeno } from '../oxygen_system.js';

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
  }

  async changeScene(scene) {
    if (this.transitioning) return;
    this.transitioning = true;
    const previous = this.scene;
    try {
      previous?.destroy?.();
      await super.changeScene(scene);
    } finally {
      this.transitioning = false;
      this.input.update();
    }
  }

  update(dt) {
    if (this.transitioning) { this.input._down.clear(); this.input.update(); return; }
    if (this.state === 'playing' && this.ui.blocked) {
      // Un iframe puede recibir keyup: no conservar WASD pulsado al volver.
      this.input._down.clear();
      this.input.update();
      return;
    }
    const playing = this.state === 'playing';
    const interior = this.scene?.isInterior === true;
    if (playing && !this.scene?.isRecarga) {
      if (this.input.isPressed('Digit1')) this.powerW = 144.375;
      if (this.input.isPressed('Digit2')) this.powerW = 180;
      if (this.input.isPressed('Digit3')) this.powerW = 233;
      if (this.input.isPressed('KeyC') && interior) this.charging = !this.charging;
      if (this.input.isPressed('KeyO') && interior) this.oxygenCharging = !this.oxygenCharging;
      if (this.input.isPressed('KeyV') && interior) this.water.refill(true);
      if (this.input.isPressed('KeyX')) this.shadowed = !this.shadowed;
      if (this.input.isPressed('KeyN')) {
        this.energy = createBatterySimulation(() => this.shadowed);
        this.water = new SuitWater();
        this.oxygen = new SistemaOxigeno();
        this.charging = false;
        this.oxygenCharging = false;
      }
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
  }

  render(alpha) {
    super.render(alpha);
    if (this.state !== 'playing' || this.scene?.isRecarga || !this.hudVisible) return;
    const snapshot = this.energy.getSnapshot();
    const water = this.water.snapshot();
    const oxygen = this.oxygen.getSnapshot().traje;
    this.renderer.begin(null);
    drawBatteryHUD(this.renderer, this.assets, snapshot.traje,
      foodPercent(snapshot.tiempo.transcurridoHoras), water, oxygen);
    this.renderer.end();
    this.canvas.title = `Batería: ${snapshot.traje.porcentaje.toFixed(1)} % · Agua: ${water.ml.toFixed(1)} mL · O₂: ${oxygen.oxigenoKg.toFixed(3)} kg`;
  }
}
