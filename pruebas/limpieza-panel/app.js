import { Game } from '../../src/core/Game.js';
import { DemoScene } from '../../src/scenes/DemoScene.js';
import { PanelCleaningTask } from './PanelCleaningTask.js';
import { BeamCleaning } from './beamCleaning.js';
import { loadPanelSprites } from './spriteAtlas.js';

// Hereda el mapa, el astronauta, los sprites y las zonas del index compartido.
// Sólo reemplaza la acción de E en el panel; src/ permanece intacto.
class SolarCleaningScene extends DemoScene {
  constructor(game, task) {
    super(game);
    this.task = task;
    this.panelModels = new Map();
    this.activeSolarZone = null;
  }

  _spawnStructures(assets, worldW, worldH) {
    super._spawnStructures(assets, worldW, worldH);
    const zones = this.interactables.filter(item => /^Panel solar \d+$/.test(item.name));
    if (!zones.length) throw new Error('No se encontraron paneles solares interactivos');
    for (const zone of zones) {
      const model = new BeamCleaning();
      this.panelModels.set(zone.name, model);
      zone.prompt = `${zone.name}: E para limpiar (prueba)`;
      zone.onConfirm = () => {
        this.activeSolarZone = zone;
        if (model.complete) model.reset();
        this.task.model = model;
        this.task.panelName = zone.name;
        this.task.open();
      };
    }
  }

  update(dt) {
    // Mientras el modal está abierto, ni el jugador ni la física avanzan.
    if (this.task.isOpen) return;
    super.update(dt);
  }

  completePanel(progress) {
    this.activeSolarZone.prompt = `${this.activeSolarZone.name} tratado: E para repetir`;
    this.inspectMsg = `${this.activeSolarZone.name}: ${progress}% (simulado)`;
    this.inspectTimer = 4;
  }
}

async function bootstrap() {
  const canvas = document.querySelector('#game');
  const overlay = document.querySelector('#cleaning-task');
  const taskCanvas = document.querySelector('#task-canvas');
  if (!(canvas instanceof HTMLCanvasElement) || !(taskCanvas instanceof HTMLCanvasElement)) {
    throw new Error('Falta el canvas del juego o de la tarea');
  }
  const game = new Game(canvas);
  let scene;
  try {
    const sprites = await loadPanelSprites();
    const task = new PanelCleaningTask({
      root: overlay, canvas: taskCanvas, sprites,
      onFinish: progress => scene.completePanel(progress),
    });
    scene = new SolarCleaningScene(game, task);
    game.setScene(scene);
    await game.init();
    document.querySelector('#loading').textContent = 'Listo';
    document.querySelector('#loading').classList.add('hidden');
    game.start();
    // Sólo para comprobar la prueba aislada en un navegador automatizado.
    window.panelCleaningTest = { game, scene, task };
  } catch (error) {
    document.querySelector('#loading').textContent = `Error: ${error.message}`;
    console.error(error);
  }
}

bootstrap();
