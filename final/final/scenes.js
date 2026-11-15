import { DemoScene } from '../src/scenes/DemoScene.js';
import { InteriorBaseScene } from '../src/scenes/InteriorBaseScene.js';
import { RecargaOxigenoPruebaScene } from '../pruebas/RECARGA OXIGENO/RecargaOxigenoPruebaScene.js';
import { BeamCleaning } from '../pruebas/limpieza-panel/beamCleaning.js';
import { FASE } from '../src/minigames/RecargaOxigeno.js';

export const STATIONS = Object.freeze([
  { id: 'principal', name: 'ESTACIÓN LUNAR', image: 'final_station', x: 280, y: 158, width: 230, doorX: -16 },
  { id: 'verde', name: 'ESTACIÓN VERDE', image: 'final_green', x: 493, y: 254, width: 105, doorX: 0 },
  { id: 'amarilla', name: 'ESTACIÓN AMARILLA', image: 'final_yellow', x: 493, y: 411, width: 105, doorX: 0 },
]);

export class FinalExterior extends DemoScene {
  constructor(game, opts = {}) {
    super(game, opts);
    this.solarState = game.solar;
    this.panelModels = this.solarState.panelModels;
    this.task = game.ui.cleaning;
    this.magnetZone = null;
    this.stationDoors = [];
  }

  _spawnStructures(assets) {
    for (const station of STATIONS) {
      const image = assets.get(station.image);
      this._addSolidStructure(image, station.x, station.y, {
        scale: station.width / image.width, footW: .62, footH: .12,
      });
      const doorX = station.x + station.doorX;
      const doorY = station.y + 12;
      const zone = this._addInteractZone(doorX, doorY, 32, 14, {
        name: station.name, prompt: 'E para entrar', onConfirm: () => this.enterStation(station),
      });
      this.stationDoors.push({ station, zone });
    }
    this.exteriorAccessRect = { x: 248, y: 158, w: 32, h: 14 };
    const panels = [[95, 230], [175, 230], [95, 325], [175, 325]];
    panels.forEach(([x, y], i) => {
      const image = assets.get('struct_solar');
      this._addSolidStructure(image, x, y, { scale: 56 / image.width, footW: .72, footH: .16 });
      const name = `Panel solar ${i + 1}`;
      if (!this.panelModels.has(name)) this.panelModels.set(name, new BeamCleaning());
      const zone = this._addInteractZone(x, y + 13, 34, 14, {
        name, prompt: `${name}: E para explorar y limpiar`,
        onConfirm: () => this.openPanel(zone),
      });
    });
    for (const [key, x, y, width] of [
      ['struct_antenna', 110, 120, 45], ['struct_antenna_damaged', 558, 100, 38],
      ['rock_big', 315, 345, 40], ['rock_small', 347, 380, 24],
      ['rock_med', 52, 410, 35], ['rock_med', 590, 319, 32],
    ]) {
      const image = assets.get(key);
      if (image) this._addSolidStructure(image, x, y, { scale: width / image.width, footW: .65, footH: .22 });
    }
    if (this.solarState.magnetQuest && !this.solarState.hasMagnet) this.placeMagnet();
    this.updateDoorPrompts();
  }

  async enterStation(station) {
    if (this.solarState.progress.cleanCount < 2) {
      this.game.ui.notify(`Limpia dos paneles distintos para habilitar las puertas (${this.solarState.progress.cleanCount}/2).`);
      return;
    }
    let interior = this.game.interiors.get(station.id);
    if (!interior) {
      interior = new FinalInterior(this.game, station);
      this.game.interiors.set(station.id, interior);
    }
    await this.game.changeScene(interior);
  }

  updateDoorPrompts() {
    const count = this.solarState.progress.cleanCount;
    for (const { station, zone } of this.stationDoors) {
      zone.prompt = count >= 2 ? `E: entrar a ${station.name.toLowerCase()}`
        : `Limpia 2 paneles (${count}/2) para entrar`;
    }
  }

  openPanel(zone) {
    if (this.solarState.progress.isClean(zone.name)) {
      this.game.ui.notify(`${zone.name} limpio: ${Math.ceil(this.solarState.progress.remaining(zone.name))} s restantes.`);
      return;
    }
    this.activeSolarZone = zone;
    const model = this.panelModels.get(zone.name);
    if (model.complete) model.reset();
    this.preparePanel(model);
    Object.assign(this.task, {
      model, panelName: zone.name, hasMagnet: this.solarState.hasMagnet,
      onDiscoveryComplete: () => { this.solarState.progress.discovered = true; },
      onNeedMagnet: () => this.revealMagnet(),
      onCompleted: completed => this.consumeMagnet(completed),
      onFinish: () => this.game.ui.notify(`${zone.name} limpio: ${this.solarState.progress.cleanCount}/2 para habilitar puertas.`),
      onReset: () => !this.solarState.progress.isClean(zone.name),
      onPrepare: () => this.preparePanel(model),
    });
    this.task.open();
  }

  preparePanel(model) {
    if (!this.solarState.hasMagnet && !['discover', 'needMagnet', 'complete'].includes(model.phase)) model.reset();
    if (model.phase === 'discover' && this.solarState.progress.discovered) {
      model.skipDiscovery(this.solarState.hasMagnet, this.solarState.cleaningsCompleted > 0);
    }
    if (model.phase === 'needMagnet') {
      if (this.solarState.hasMagnet) model.beginCleaning(true);
      else this.revealMagnet();
    }
  }

  magnetPosition() {
    return this.solarState.cleaningsCompleted ? { x: 347, y: 388 } : { x: 320, y: 205 };
  }
  revealMagnet() {
    if (this.solarState.hasMagnet) return;
    this.solarState.magnetQuest = true;
    this.placeMagnet();
  }
  placeMagnet() {
    if (this.magnetZone || this.solarState.hasMagnet) return;
    const p = this.magnetPosition();
    this.magnetZone = this._addInteractZone(p.x, p.y, 26, 20, {
      name: 'Repuesto de electroimán', prompt: 'E: recoger electroimán',
      onConfirm: () => {
        this.solarState.hasMagnet = true;
        this.task.hasMagnet = true;
        for (const model of this.panelModels.values()) model.beginCleaning(true);
        this.magnetZone.active = false;
        this.interactables = this.interactables.filter(zone => zone !== this.magnetZone);
        this.removeEntity(this.magnetZone);
        this.magnetZone = null;
        this.game.ui.notify('Electroimán recogido. Vuelve al panel solar.');
      },
    });
  }
  consumeMagnet(model) {
    if (!model.complete || model.magnetSpent) return;
    model.magnetSpent = true;
    this.solarState.hasMagnet = false;
    this.task.hasMagnet = false;
    this.solarState.magnetQuest = false;
    this.solarState.cleaningsCompleted++;
    this.solarState.progress.markClean(this.activeSolarZone.name);
    this.updateDoorPrompts();
  }
  update(dt) { this.updateDoorPrompts(); super.update(dt); }
  renderGroundEffects(renderer, alpha) {
    super.renderGroundEffects(renderer, alpha);
    for (const { station } of this.stationDoors) {
      const ctx = renderer.context;
      ctx.save(); ctx.font = '4px "Press Start 2P",monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = this.solarState.progress.cleanCount >= 2 ? '#83e9d1' : '#ffcf70';
      ctx.fillText(station.name, station.x, station.y + 25); ctx.restore();
    }
    if (this.solarState.magnetQuest && !this.solarState.hasMagnet) {
      const p = this.magnetPosition(), image = this.task.sprites.magnetOff;
      renderer.drawImage(image, 0, 0, image.width, image.height, p.x - 10, p.y - 24, 20, 24);
    }
  }
}

/** Tres interiores con instancias y modo propios; no se añaden cultivos. */
export class FinalInterior extends InteriorBaseScene {
  constructor(game, station) {
    super(game, { spawnX: 372, spawnY: 294 });
    this.station = station;
    this.opts.onExit = () => game.changeScene(new FinalExterior(game, {
      spawnX: station.x + station.doorX, spawnY: station.y + 22,
    }));
    this.ready = false;
  }
  async init() {
    if (!this.ready) {
      await super.init();
      this.ready = true;
    }
    this.game.player = this.player;
    this.applyEnergyMode(this.game.stationModes.get(this.station.id));
  }
  _getInteriorBackgroundForMode(mode) {
    const keys = { tortuga: 'final_room_saving', explorador: 'final_room_clear', turbo: 'final_room_dark' };
    const defaultKey = this.station.id === 'principal' ? 'final_room_main' : 'final_room_clear';
    return this.game.assets.get(keys[mode] || defaultKey);
  }
  applyEnergyMode(mode) { this.backgroundImage = this._getInteriorBackgroundForMode(mode); }

  // Corredores adaptados al sprite grande 2:1, no al cuarto antiguo rectangular.
  _spawnInteriorCollisions() {
    this._addSolidBox(190, 90, 370, 12);
    this._addSolidBox(180, 100, 12, 200);
    this._addSolidBox(550, 100, 12, 200);
    this._addSolidBox(190, 300, 158, 12);
    this._addSolidBox(396, 300, 166, 12);
    this._addSolidBox(338, 310, 10, 35);
    this._addSolidBox(396, 310, 10, 35);
  }
  _spawnExitZone() {
    this.exitMarker = { x: 372, y: 322 };
    this._addInteractZone(372, 326, 48, 20, {
      name: 'Salida', prompt: 'E: salir a la superficie',
      onConfirm: this.opts.onExit,
    });
  }
  _spawnInteriorModules() {
    this.interiorModules = [];
    const module = (id, name, x, y, key, action) => {
      const w = 38, h = 38;
      this._addSolidBox(x, y, w, h);
      for (const [zx, zy, zw, zh] of [
        [x + w / 2, y + h + 12, w + 10, 14],
        [x - 6, y + h, 14, h], [x + w + 6, y + h, 14, h],
      ]) {
        this._addInteractZone(zx, zy, zw, zh, {
          name, prompt: `E: ${name.toLowerCase()}`, onConfirm: action,
        });
      }
      this.interiorModules.push({ id, name, x, y, w, h, imageKey: key });
    };
    module('oxygen', 'SISTEMA DE OXÍGENO', 228, 130, 'mod_oxigeno', () => this.openOxygen());
    module('energy', 'CONTROL DE ENERGÍA', 480, 185, 'mod_energia', () => this.game.ui.openEnergy(this.station.id));
    module('console', 'CONSOLA DE CONTROL', 340, 156, 'compass_ui', () => this.game.ui.openConsole());
    module('storage', 'ALMACENAMIENTO DE RECURSOS', 260, 236, 'mod_almacenamiento', () => {
      this.game.ui.notify('Recursos del traje: C conecta batería; O conecta oxígeno; V rellena agua. Alimentos pendiente.');
    });
  }
  handlePointer(x, y) {
    // Conserva interacción por E; evita el handler heredado de alimentos.
    if (!this.camera || this.game.ui.blocked) return;
    const wx = x + this.camera.x, wy = y + this.camera.y;
    const module = this.interiorModules.find(m => wx >= m.x && wx <= m.x + m.w && wy >= m.y && wy <= m.y + m.h);
    if (!module || Math.hypot(this.player.x - module.x - module.w / 2, this.player.y - module.y - module.h) > 65) return;
    this.interactables.find(zone => zone.name === module.name)?.onConfirm?.();
  }
  openOxygen() {
    if (this.game.transitioning) return;
    const back = () => this.game.changeScene(this);
    const scene = new RecargaOxigenoPruebaScene(this.game, {
      onCancel: back,
      onComplete: () => {
        this.game.oxygenCharging = true;
        this.game.ui.notify('Conexión completada. Al volver, O₂ se recarga con el caudal y reserva del sistema.');
      },
      onStatus: mg => updateOxygenControls(mg),
    });
    scene.isRecarga = true;
    const update = scene.update.bind(scene);
    scene.update = dt => {
      if (this.game.input.isPressed('Escape')) { back(); return; }
      update(dt);
    };
    this.game.changeScene(scene).then(() => {
      document.getElementById('recarga-tools').hidden = false;
      updateOxygenControls(scene.minigame);
    });
  }
}

function updateOxygenControls(mg) {
  if (!mg) return;
  document.getElementById('recarga-status').textContent = mg.fase === FASE.COMPLETADO
    ? 'Conexión lista. Vuelve para recargar el traje.' : 'Conecta ambos colores y gira las válvulas.';
  for (const id of ['o2', 'co2']) {
    const button = document.getElementById(`recarga-${id}`);
    button.textContent = mg.fase === FASE.VALVULAS ? `Girar ${id.toUpperCase()}` : `Conectar ${id.toUpperCase()}`;
    button.disabled = ![FASE.CONECTANDO, FASE.VALVULAS].includes(mg.fase);
  }
}
