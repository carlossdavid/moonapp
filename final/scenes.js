import { DemoScene } from '../src/scenes/DemoScene.js';
import { InteriorBaseScene } from '../src/scenes/InteriorBaseScene.js';
import { RecargaOxigenoPruebaScene } from '../pruebas/RECARGA OXIGENO/RecargaOxigenoPruebaScene.js';
import { BeamCleaning } from '../pruebas/limpieza-panel/beamCleaning.js';
import { FASE } from '../src/minigames/RecargaOxigeno.js';
import { drawAccess, drawWorkstation, drawSceneUI, adaptRechargeSummary } from './presentation.js';
import { translate } from './i18n.js';
import { localizeRechargeRender } from './recharge-i18n.js';

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
    this.magnetZones = new Map();
    this.stationDoors = [];
  }
  async init() {
    await super.init();
    this.game.impacts.attach(this);
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
        name: station.name, prompt: translate('E para entrar', this.game.language), onConfirm: () => this.enterStation(station),
      });
      this.stationDoors.push({ station, zone });
    }
    this.exteriorAccessRect = null; // Se sustituye el marcador heredado por la baldosa naranja.
    const panels = [[95, 230], [175, 230], [95, 325], [175, 325]];
    panels.forEach(([x, y], i) => {
      const image = assets.get('struct_solar');
      this._addSolidStructure(image, x, y, { scale: 56 / image.width, footW: .72, footH: .16 });
      const name = `Panel solar ${i + 1}`;
      if (!this.panelModels.has(name)) this.panelModels.set(name, new BeamCleaning());
      const zone = this._addInteractZone(x, y + 13, 34, 14, {
        name, prompt: translate(`${name}: E para explorar y limpiar`, this.game.language),
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
    this.placeMagnet();
    this.updateDoorPrompts();
  }

  async enterStation(station) {
    if (this.game.transitioning || this.game.ui.transitionActive) return;
    if (this.solarState.progress.cleanCount < 2) {
      this.game.ui.notify(this.game.language === 'en'
        ? `Clean two different panels to unlock the doors (${this.solarState.progress.cleanCount}/2).`
        : `Limpia dos paneles distintos para habilitar las puertas (${this.solarState.progress.cleanCount}/2).`);
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
      zone.prompt = count >= 2 ? this.game.language === 'en'
        ? `E: enter ${translate(station.name, 'en').toLowerCase()}` : `E: entrar a ${station.name.toLowerCase()}`
        : this.game.language === 'en' ? `Clean 2 panels (${count}/2) to enter` : `Limpia 2 paneles (${count}/2) para entrar`;
    }
  }

  openPanel(zone) {
    if (this.solarState.progress.isClean(zone.name)) {
      this.game.ui.notify(this.game.language === 'en'
        ? `${translate(zone.name, 'en')} clean: ${Math.ceil(this.solarState.progress.remaining(zone.name))} s remaining.`
        : `${zone.name} limpio: ${Math.ceil(this.solarState.progress.remaining(zone.name))} s restantes.`);
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
      onFinish: () => {},
      onReset: () => !this.solarState.progress.isClean(zone.name),
      onPrepare: () => this.preparePanel(model),
    });
    this.task.open();
    this.game.ui.transition();
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

  revealMagnet() {
    if (this.solarState.hasMagnet) return;
    this.solarState.magnetQuest = true;
    this.game.ui.notify(this.game.language === 'en' ? 'Find magnets on the surface. The first spare appears after 20 s; the next ones every 60 s.'
      : 'Busca los imanes de la superficie. El primer repuesto aparece a los 20 s; los siguientes, cada 60 s.');
  }
  placeMagnet() {
    for (const p of this.game.mission.magnets) {
      if (this.magnetZones.has(p.id)) continue;
      const zone = this._addInteractZone(p.x, p.y, 26, 20, {
       name: 'Repuesto de electroimán', prompt: this.game.language === 'en' ? 'E: pick up electromagnet' : 'E: recoger electroimán',
      onConfirm: () => {
        if (this.solarState.hasMagnet) { this.game.ui.notify(this.game.language === 'en'
          ? 'You already carry a magnet. Use it before taking another.'
          : 'Ya llevas un imán. Úsalo antes de recoger otro.'); return; }
        this.solarState.hasMagnet = true;
        this.task.hasMagnet = true;
        for (const model of this.panelModels.values()) model.beginCleaning(true);
        zone.active = false;
        this.interactables = this.interactables.filter(item => item !== zone);
        this.removeEntity(zone);
        this.magnetZones.delete(p.id);
        this.game.mission.magnets = this.game.mission.magnets.filter(item => item.id !== p.id);
        this.game.ui.notify(this.game.language === 'en' ? 'Electromagnet collected. Return to the solar panel.'
          : 'Electroimán recogido. Vuelve al panel solar.');
      },
    });
      this.magnetZones.set(p.id, zone);
    }
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
  update(dt) { this.placeMagnet(); this.updateDoorPrompts(); super.update(dt); }
  drawUI(renderer) { drawSceneUI(this, renderer, this.activePrompt); }
  renderGroundEffects(renderer, alpha) {
    super.renderGroundEffects(renderer, alpha);
    for (const { station, zone } of this.stationDoors) {
      const ctx = renderer.context;
      ctx.save(); ctx.font = '4px "Press Start 2P",monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = this.solarState.progress.cleanCount >= 2 ? '#83e9d1' : '#ffcf70';
      ctx.fillText(translate(station.name, this.game.language), station.x + station.doorX, zone.y - 12); ctx.restore();
    }
    for (const { station, zone } of this.stationDoors) {
      drawAccess(renderer, station.x + station.doorX, zone.y, zone.playerInside);
    }
    for (const p of this.game.mission.magnets) {
      const image = this.task.sprites.magnetOff;
      renderer.drawImage(image, 0, 0, image.width, image.height, p.x - 10, p.y - 24, 20, 24);
    }
    this.game.impacts.draw(renderer);
  }
}

/** Cada edificio tiene una única especialidad; el principal reúne tres módulos. */
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
    this.game.impacts.attach(this);
    this.exitMarker = { x: 372, y: 326 };
    this.applyEnergyMode(this.game.stationModes.get(this.station.id));
  }
  _getInteriorBackgroundForMode(mode) {
    if (this.station.id !== 'principal') return this.game.assets.get('final_room_small');
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
      name: 'Salida', prompt: this.game.language === 'en' ? 'E: return to surface' : 'E: salir a la superficie',
      onConfirm: this.opts.onExit,
    });
  }
  _spawnInteriorModules() {
    this.interiorModules = [];
    const module = (id, name, label, x, y, key, action) => {
      const w = 38, h = 38;
      this._addSolidBox(x - 5, y, w + 10, h + 6);
      const access = { x: x + w / 2, y: y + h + 17 };
      const zone = this._addInteractZone(access.x, access.y, 38, 15, {
          name, prompt: this.game.language === 'en' ? `E: ${translate(name, 'en').toLowerCase()}` : `E: ${name.toLowerCase()}`, onConfirm: action,
      });
      this.interiorModules.push({ id, name, displayName: translate(name, this.game.language), label: translate(label, this.game.language), x, y, w, h, imageKey: key, access, zone });
    };
    if (this.station.id === 'principal') {
      module('recharge', 'RECARGA INTEGRAL', '01 RECARGA', 232, 202, 'mod_oxigeno', () => this.openOxygen());
      module('console', 'CONSOLA DE CONTROL', '02 DONKI', 352, 202, null, () => this.game.ui.openConsole());
      module('modes', 'CAMBIO DE MODO', '03 MODOS', 472, 202, 'mod_energia', () => this.game.ui.open('modes', this.station.id));
    } else if (this.station.id === 'verde') {
      module('food', 'ALIMENTACIÓN', 'INVERNADERO', 353, 202, 'mod_alimentos', () => this.game.ui.open('food'));
    } else {
      module('electrolysis', 'ELECTRÓLISIS', 'ELECTRÓLISIS', 353, 202, 'mod_energia', () => this.game.ui.open('electrolysis', this.station.id));
    }
  }
  renderGroundEffects(renderer) {
    const ctx = renderer.context;
    for (const module of this.interiorModules) {
      drawWorkstation(renderer, module);
      if (module.imageKey) {
        const image = this.game.assets.get(module.imageKey);
        renderer.drawImage(image, 0, 0, image.width, image.height, module.x, module.y, module.w, module.h);
      } else {
        ctx.save();
        const { x, y, w } = module;
        ctx.fillStyle = '#627c9d'; ctx.fillRect(x + 1, y + 1, w - 2, 27);
        ctx.fillStyle = '#0a1b2f'; ctx.fillRect(x + 4, y + 4, w - 8, 19);
        ctx.fillStyle = '#55e6eb';
        for (let i = 0; i < 5; i++) ctx.fillRect(x + 7 + i * 5, y + 17 - i % 3 * 3, 3, 2);
        ctx.fillStyle = '#a1b9d0'; ctx.fillRect(x + 15, y + 28, 8, 4);
        ctx.fillRect(x + 4, y + 33, w - 8, 3);
        ctx.restore();
      }
      drawAccess(renderer, module.access.x, module.access.y, module.zone.playerInside);
    }
    const exit = this.interactables.find(zone => zone.name === 'Salida');
    drawAccess(renderer, 372, 326, exit?.playerInside, 'SALIR');
    this.game.impacts.draw(renderer);
  }
  handlePointer(x, y) {
    // Conserva interacción por E; evita el handler heredado de alimentos.
    if (!this.camera || this.game.ui.blocked) return;
    const wx = x + this.camera.x, wy = y + this.camera.y;
    const module = this.interiorModules.find(m => wx >= m.x && wx <= m.x + m.w && wy >= m.y && wy <= m.y + m.h);
    if (!module || Math.hypot(this.player.x - module.x - module.w / 2, this.player.y - module.y - module.h) > 65) return;
    this.interactables.find(zone => zone.name === module.name)?.onConfirm?.();
  }
  drawUI(renderer) { drawSceneUI(this, renderer, this.promptText); }
  openOxygen() {
    if (this.game.transitioning || this.game.ui.blocked || this.game.ui.transitionActive) return;
    const back = () => this.game.changeScene(this);
    const scene = new RecargaOxigenoPruebaScene(this.game, {
      onCancel: back,
      onComplete: () => {
        this.game.completeRecharge();
      },
      onStatus: mg => updateOxygenControls(mg, this.game),
    });
    scene.isRecarga = true;
    localizeRechargeRender(scene, this.game.language);
    const update = scene.update.bind(scene);
    scene.update = dt => {
      if (this.game.input.isPressed('Escape')) { back(); return; }
      if (scene.minigame?.fase === FASE.COMPLETADO && this.game.input.isPressed('Enter')) { back(); return; }
      update(dt);
    };
    this.game.changeScene(scene).then(() => {
      adaptRechargeSummary(scene.minigame, this.game, back);
      document.getElementById('recarga-tools').hidden = false;
      updateOxygenControls(scene.minigame, this.game);
    });
  }
}

function updateOxygenControls(mg, game) {
  if (!mg) return;
  document.getElementById('recarga-status').textContent = mg.fase === FASE.COMPLETADO
    ? `O₂ ${game.oxygen.porcentajeTraje.toFixed(0)} % · ${game.language === 'en' ? 'Water' : 'Agua'} ${game.water.snapshot().ml.toFixed(0)} mL · ${game.language === 'en' ? 'Battery' : 'Batería'} ${game.energy.getSnapshot().traje.porcentaje.toFixed(0)} %`
    : game.language === 'en' ? 'O₂ / CO₂ return · Connect and turn. Restore water and battery.'
      : 'O₂ / retorno CO₂ · Conecta y gira. Recupera agua y batería.';
  for (const id of ['o2', 'co2']) {
    const button = document.getElementById(`recarga-${id}`);
    button.textContent = `${mg.fase === FASE.VALVULAS
      ? game.language === 'en' ? 'Turn' : 'Girar'
      : game.language === 'en' ? 'Connect' : 'Conectar'} ${id.toUpperCase()}`;
    button.disabled = ![FASE.CONECTANDO, FASE.VALVULAS].includes(mg.fase);
  }
}
