import { Game } from '../../src/core/Game.js';
import { DemoScene } from '../../src/scenes/DemoScene.js';
import { InteriorBaseScene } from '../../src/scenes/InteriorBaseScene.js';
import { PanelCleaningTask } from './PanelCleaningTask.js';
import { BeamCleaning } from './beamCleaning.js';
import { SolarProgress } from './solarProgress.js';
import { loadPanelSprites } from './spriteAtlas.js';

class SolarInteriorScene extends InteriorBaseScene {
  constructor(game, solarState, opts) {
    super(game, opts);
    this.solarState = solarState;
  }

  update(dt) {
    this.solarState.progress.tick(dt);
    super.update(dt);
  }
}

// Hereda el mapa, el astronauta, los sprites y las zonas del index compartido.
// Sólo reemplaza la acción de E en el panel; src/ permanece intacto.
class SolarCleaningScene extends DemoScene {
  constructor(game, task, solarState, opts = {}) {
    super(game, opts);
    this.task = task;
    this.solarState = solarState;
    this.panelModels = solarState.panelModels;
    this.activeSolarZone = null;
    this.magnetZone = null;
    this.baseDoor = null;
  }

  _spawnStructures(assets, worldW, worldH) {
    super._spawnStructures(assets, worldW, worldH);
    this.baseDoor = this.interactables.find(item => item.name === 'ACCESO A LA BASE');
    const zones = this.interactables.filter(item => /^Panel solar \d+$/.test(item.name));
    if (!zones.length) throw new Error('No se encontraron paneles solares interactivos');
    for (const zone of zones) {
      if (!this.panelModels.has(zone.name)) this.panelModels.set(zone.name, new BeamCleaning());
      const model = this.panelModels.get(zone.name);
      zone.prompt = `${zone.name}: E para explorar y limpiar`;
      zone.onConfirm = () => {
        if (this.solarState.progress.isClean(zone.name)) {
          const remaining = Math.ceil(this.solarState.progress.remaining(zone.name));
          this.inspectMsg = `${zone.name} limpio. Vuelve en ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}.`;
          this.inspectTimer = 4;
          return;
        }
        this.activeSolarZone = zone;
        if (model.complete) {
          this.consumeMagnet(model);
          model.reset();
        }
        this.preparePanel(model);
        this.task.model = model;
        this.task.panelName = zone.name;
        this.task.hasMagnet = this.solarState.hasMagnet;
        this.task.onDiscoveryComplete = () => { this.solarState.progress.discovered = true; };
        this.task.onNeedMagnet = () => this.revealMagnet();
        this.task.onCompleted = completedModel => this.consumeMagnet(completedModel);
        this.task.onFinish = progress => this.completePanel(progress);
        this.task.onReset = () => !this.solarState.progress.isClean(zone.name);
        this.task.onPrepare = () => this.preparePanel(model);
        this.task.open();
      };
    }
    if (this.solarState.magnetQuest && !this.solarState.hasMagnet) this.placeMagnet();
    this.updateDoorPrompt();
  }

  preparePanel(model) {
    if (!this.solarState.hasMagnet && !['discover', 'needMagnet', 'complete'].includes(model.phase)) {
      model.reset();
    }
    if (model.phase === 'discover' && this.solarState.progress.discovered) {
      model.skipDiscovery(this.solarState.hasMagnet, this.solarState.cleaningsCompleted > 0);
    }
    if (model.phase === 'needMagnet') {
      if (this.solarState.hasMagnet) model.beginCleaning(true);
      else this.revealMagnet();
    }
  }

  updateDoorPrompt() {
    if (!this.baseDoor) return;
    const count = this.solarState.progress.cleanCount;
    this.baseDoor.prompt = count >= 2
      ? 'Puerta con energía: pulsa E para entrar'
      : `Puerta sin energía: limpia 2 paneles distintos (${count}/2)`;
  }

  placeMagnet() {
    if (this.magnetZone || this.solarState.hasMagnet) return;
    const { x, y } = this.magnetPosition();
    this.magnetZone = this._addInteractZone(x, y, 26, 18, {
      name: 'Repuesto de electroimán',
      prompt: 'Electroimán: pulsa E para recoger el repuesto',
      onConfirm: () => this.collectMagnet(),
    });
  }

  magnetPosition() {
    const cx = this.tileMap.worldWidth * 0.5;
    const cy = this.tileMap.worldHeight * 0.42;
    return this.solarState.cleaningsCompleted
      ? { x: cx + 47, y: cy + 124 } // parcialmente oculto por la roca pequeña al sureste de la base
      : { x: cx + 48, y: cy + 54 };
  }

  revealMagnet() {
    if (this.solarState.hasMagnet) return;
    this.solarState.magnetQuest = true;
    this.placeMagnet();
  }

  collectMagnet() {
    if (this.solarState.hasMagnet) return;
    this.solarState.hasMagnet = true;
    this.task.hasMagnet = true;
    for (const model of this.panelModels.values()) model.beginCleaning(true);
    if (this.magnetZone) {
      this.magnetZone.active = false;
      this.interactables = this.interactables.filter(zone => zone !== this.magnetZone);
      this.removeEntity(this.magnetZone);
      this.magnetZone = null;
    }
    this.inspectMsg = '¡Electroimán recogido! Vuelve al panel solar.';
    this.inspectTimer = 6;
  }

  consumeMagnet(model) {
    if (!model.complete || model.magnetSpent) return;
    model.magnetSpent = true;
    this.solarState.hasMagnet = false;
    this.task.hasMagnet = false;
    this.solarState.magnetQuest = false;
    this.solarState.cleaningsCompleted++;
    this.solarState.progress.markClean(this.activeSolarZone.name);
    this.updateDoorPrompt();
  }

  renderGroundEffects(renderer, alpha) {
    super.renderGroundEffects(renderer, alpha);
    if (this.exteriorAccessRect && this.solarState.progress.cleanCount < 2) {
      const door = this.exteriorAccessRect;
      renderer.drawRect(door.x, door.y, door.w, door.h, 'rgba(28, 32, 40, .85)', true);
      renderer.drawRect(door.x, door.y, door.w, door.h, '#9b9ca9', false);
    }
    if (!this.solarState.magnetQuest || this.solarState.hasMagnet) return;
    const { x, y } = this.magnetPosition();
    if (!this.solarState.cleaningsCompleted) {
      renderer.drawRect(x - 12, y - 27, 24, 29, 'rgba(80, 218, 242, .25)', true);
    }
    renderer.drawImage(this.task.sprites.magnetOff, 0, 0,
      this.task.sprites.magnetOff.width, this.task.sprites.magnetOff.height,
      x - 11, y - 26, 22, 25, false);
    if (!this.solarState.cleaningsCompleted) renderer.drawText('IMÁN', x - 11, y - 31, '#ffe0a1');
  }

  async _enterBase() {
    if (this.solarState.progress.cleanCount < 2) {
      this.inspectMsg = `Puerta sin energía. Limpia 2 paneles distintos (${this.solarState.progress.cleanCount}/2).`;
      this.inspectTimer = 5;
      return;
    }
    const ret = this._exteriorDoorReturn || {
      x: this.tileMap.worldWidth * 0.5,
      y: this.tileMap.worldHeight * 0.42 + 14,
    };
    await this.game.changeScene(new SolarInteriorScene(this.game, this.solarState, {
      onExit: async () => {
        await this.game.changeScene(new SolarCleaningScene(this.game, this.task, this.solarState,
          { spawnX: ret.x, spawnY: ret.y }));
      },
    }));
  }

  update(dt) {
    // Mientras el modal está abierto, ni el jugador ni la física avanzan.
    if (this.task.isOpen) return;
    this.solarState.progress.tick(dt);
    this.updateDoorPrompt();
    super.update(dt);
  }

  completePanel(progress) {
    this.activeSolarZone.prompt = `${this.activeSolarZone.name} limpio: E para consultar`;
    this.inspectMsg = `${this.activeSolarZone.name}: ${progress}% de zonas del juego. Puerta: ${this.solarState.progress.cleanCount}/2 paneles.`;
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
    const solarState = {
      panelModels: new Map(), progress: new SolarProgress(),
      magnetQuest: false, hasMagnet: false, cleaningsCompleted: 0,
    };
    const task = new PanelCleaningTask({
      root: overlay, canvas: taskCanvas, sprites,
      onFinish: progress => scene.completePanel(progress),
    });
    scene = new SolarCleaningScene(game, task, solarState);
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
