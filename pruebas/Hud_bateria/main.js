import { Game } from '../../src/core/Game.js';
import { InteriorBaseScene } from '../../src/scenes/InteriorBaseScene.js';
import { DemoScene } from '../../src/scenes/DemoScene.js';
import { drawBatteryHUD } from './BatteryHUD.js';
import { createBatterySimulation, advanceBatterySimulation } from './BatterySimulation.js';
import { foodPercent } from './FoodSystem.js';
import { SuitWater } from './WaterSystem.js';

class BatteryTestGame extends Game {
  constructor(canvas) {
    super(canvas);
    this.shadowed = false;
    this.charging = false;
    this.powerW = 144.375;
    this.energy = createBatterySimulation(() => this.shadowed);
    this.water = new SuitWater();
  }

  update(dt) {
    if (this.state === 'playing') {
      // Leer antes de super.update: Game borra los pulsos de teclado al terminar.
      if (this.input.isPressed('Digit1')) this.powerW = 144.375;
      if (this.input.isPressed('Digit2')) this.powerW = 180;
      if (this.input.isPressed('Digit3')) this.powerW = 233;
      if (this.input.isPressed('KeyC')) this.charging = !this.charging;
      if (this.input.isPressed('KeyX')) this.shadowed = !this.shadowed;
      if (this.input.isPressed('KeyV')) this.water.refill(this.scene?.isInterior === true);
      if (this.input.isPressed('KeyN')) {
        this.energy = createBatterySimulation(() => this.shadowed);
        this.water = new SuitWater();
        this.charging = false;
      }
    }
    // Desactivar exclusivamente el drenaje ficticio de Game.suitStatus (T/R).
    // La fuente única del indicador es SistemaEnergia.
    this.suitHudOpen = false;
    super.update(dt);
    this.suitHudOpen = false;
    if (this.state !== 'playing') return;

    const previousHours = this.energy.tiempoHoras;
    const snapshot = advanceBatterySimulation(this.energy, dt, {
      exterior: this.scene?.isExterior === true,
      interior: this.scene?.isInterior === true,
      powerW: this.powerW,
      charging: this.charging,
    });
    this.water.update(snapshot.tiempo.transcurridoHoras - previousHours, this.scene?.isExterior === true);
  }

  render(alpha) {
    super.render(alpha);
    if (this.state !== 'playing') return;
    this.renderer.begin(null);
    const snapshot = this.energy.getSnapshot();
    const water = this.water.snapshot();
    drawBatteryHUD(this.renderer, this.assets, snapshot.traje, foodPercent(snapshot.tiempo.transcurridoHoras), water);
    this.canvas.title = `Agua: ${water.ml.toFixed(1)} / 950 mL (${water.percent.toFixed(1)} %). ${water.alert ?? 'Sin avisos'}`;
    this.renderer.end();
  }
}

const game = new BatteryTestGame(document.getElementById('game'));

async function start() {
  try {
    game.setScene(new InteriorBaseScene(game, {
      onExit: async () => game.changeScene(new DemoScene(game, { spawnX: 292, spawnY: 210 })),
    }));
    await game.init();
    // Estos sprites existen en assets, pero no figuran en el manifiesto global.
    // Cargarlos solo para esta prueba mantiene intacto el juego principal.
    await Promise.all(['comida', 'agua'].flatMap((resource) =>
      Array.from({ length: 11 }, (_, level) => {
        const key = `${resource}_nivel_${String(level).padStart(2, '0')}_t`;
        return game.assets.loadImage(key, `./assets/Sprites/Pantalla/niveles/${resource}/${key}.png`);
      })));
    game.start();
    // Prototipo: entrar directamente al juego, sin menú ni vídeo introductorio.
    game.state = 'playing';
  } catch (error) {
    console.error(error);
    document.getElementById('loading').textContent = `No se pudo iniciar: ${error.message}`;
  }
}

start();
