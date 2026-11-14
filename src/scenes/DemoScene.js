import { Scene } from './Scene.js';
import { Camera } from '../graphics/Camera.js';
import { TileMap } from '../graphics/TileMap.js';
import { SpriteSheet } from '../graphics/SpriteSheet.js';
import { Animation } from '../graphics/Animation.js';
import { Sprite } from '../graphics/Sprite.js';
import { Player } from '../entities/Player.js';
import { Obstacle } from '../entities/Obstacle.js';
import { InteractableZone } from '../entities/InteractableZone.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { PhysicsBody } from '../physics/PhysicsBody.js';
import { BoxCollider } from '../physics/BoxCollider.js';
import { InteriorBaseScene } from './InteriorBaseScene.js';
import {
  LOGICAL_WIDTH, LOGICAL_HEIGHT, TILE_SIZE, MAP_COLS, MAP_ROWS, CAMERA_LERP,
  PLAYER_FOOT_WIDTH, PLAYER_FOOT_HEIGHT, SPATIAL_CELL_SIZE, Layer,
} from '../config.js';

/**
 * Escala visual y configuración por estructura (relativa al astronauta ~22x29 px).
 * - scale: factor aplicado a las dimensiones originales del PNG (sin modificar el PNG).
 * - footW/footH: proporción del tamaño ESCALADO usada como huella sólida (base).
 * - interact: tamaño/offset de la zona de interacción (en píxeles ya escalados, relativo a la base).
 * - door: (solo base principal) trigger de puerta/entrada.
 * Ajusta estos valores para afinar proporciones y accesibilidad.
 */
const STRUCTURE_CONFIG = {
  struct_base_main: {
    scale: 0.16, footW: 0.55, footH: 0.16,
    interact: { w: 24, h: 12, offsetY: 6 },
    door: { w: 24, h: 12, offsetY: 6 },
  },
  struct_solar: {
    scale: 0.10, footW: 0.7, footH: 0.22,
    interact: { w: 14, h: 10, offsetY: 4 },
  },
  struct_antenna: {
    scale: 0.11, footW: 0.45, footH: 0.18,
    interact: { w: 12, h: 10, offsetY: 4 },
  },
  struct_tanks: {
    scale: 0.07, footW: 0.65, footH: 0.2,
    interact: { w: 16, h: 10, offsetY: 4 },
  },
  struct_antenna_damaged: {
    scale: 0.07, footW: 0.45, footH: 0.18,
    interact: { w: 12, h: 10, offsetY: 4 },
  },
  struct_wreckage: {
    scale: 0.06, footW: 0.7, footH: 0.22,
    interact: { w: 18, h: 10, offsetY: 4 },
  },
};

function createTileset(tileSize) {
  const cols = 4, rows = 1;
  const c = document.createElement('canvas');
  c.width = tileSize * cols; c.height = tileSize * rows;
  const ctx = c.getContext('2d');
  if (!ctx) return { image: c, cols };
  const colors = ['#6f6a63', '#736e66', '#7a746c', '#69645d'];
  for (let i = 0; i < cols; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(i * tileSize, 0, tileSize, tileSize);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(i * tileSize + 2, 2, 2, 2);
  }
  return { image: c, cols };
}

function buildGround(cols, rows) {
  const data = new Array(cols * rows).fill(1);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      data[iFrom(x, y, cols)] = 1 + ((x * 7 + y * 13) % 4);
    }
  }
  return data;
}
function iFrom(x, y, cols) { return y * cols + x; }

function createAstronautSheet(assets) {
  const srcW = 44, srcH = 58, fw = 22, fh = 29, cols = 4;
  const rowsDef = [
    ['astro_idle_0', 'astro_idle_1', 'astro_idle_2', 'astro_idle_3'],
    ['astro_walk_down_0', 'astro_walk_down_1', 'astro_walk_down_2', 'astro_walk_down_3'],
    ['astro_idle_0', 'astro_idle_1', 'astro_idle_2', 'astro_idle_3'],
    ['astro_walk_up_0', 'astro_walk_up_1', 'astro_walk_up_2', 'astro_walk_up_3'],
    ['astro_idle_0', 'astro_idle_1', 'astro_idle_2', 'astro_idle_3'],
    ['astro_walk_right_0', 'astro_walk_right_1', 'astro_walk_right_2', 'astro_walk_right_3'],
    ['astro_idle_0', 'astro_idle_1', 'astro_idle_2', 'astro_idle_3'],
    ['astro_walk_left_0', 'astro_walk_left_1', 'astro_walk_left_2', 'astro_walk_left_3'],
  ];
  const c = document.createElement('canvas');
  c.width = fw * cols; c.height = fh * rowsDef.length;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.imageSmoothingEnabled = false;
  rowsDef.forEach((keys, r) => {
    keys.forEach((key, col) => {
      const img = assets.get(key);
      if (img) ctx.drawImage(img, 0, 0, srcW, srcH, col * fw, r * fh, fw, fh);
    });
  });
  return c;
}

function createPlayerSprite(sheetImage) {
  const imgW = /** @type {any} */ (sheetImage).width || 64;
  const isAstronaut = imgW >= 88;
  if (isAstronaut) {
    const imgH = /** @type {any} */ (sheetImage).height || 232;
    const cols = 4, rows = 8;
    const fw = Math.floor(imgW / cols), fh = Math.floor(imgH / rows);
    const sheet = new SpriteSheet(sheetImage, fw, fh, { columns: cols });
    const sprite = new Sprite(sheet);
    sprite.originX = 0.5; sprite.originY = 1;
    const def = (name, row, fps) => {
      const base = row * cols;
      sprite.addAnimation(name, new Animation({ name, frames: [base, base + 1, base + 2, base + 3], fps, loop: true }));
    };
    def('idle-down', 0, 4); def('walk-down', 1, 8);
    def('idle-up', 2, 4); def('walk-up', 3, 8);
    def('idle-right', 4, 4); def('walk-right', 5, 8);
    def('idle-left', 6, 4); def('walk-left', 7, 8);
    sprite.play('idle-down', true);
    return sprite;
  }
  const sheet = new SpriteSheet(sheetImage, 16, 24, { columns: 4 });
  const sprite = new Sprite(sheet);
  sprite.originX = 0.5; sprite.originY = 1;
  const def = (name, row, fps) => { const base = row * 4; sprite.addAnimation(name, new Animation({ name, frames: [base, base + 1, base + 2, base + 3], fps, loop: true })); };
  def('idle-down', 0, 4); def('walk-down', 1, 8);
  def('idle-up', 2, 4); def('walk-up', 3, 8);
  def('idle-right', 4, 4); def('walk-right', 5, 8);
  def('idle-left', 4, 4); def('walk-left', 5, 8);
  sprite.play('idle-down', true);
  return sprite;
}

/** Exterior lunar map (formerly demo). */
export class DemoScene extends Scene {
  /** @param {import('../core/Game.js').Game} game @param {{ spawnX?:number, spawnY?:number }=} opts */
  constructor(game, opts = {}) {
    super(game);
    this.opts = opts;
    this.player = null;
    this.interactables = [];
    this.activePrompt = '';
    this.inspectMsg = '';
    this.inspectTimer = 0;
    /** Posición de retorno frente a la puerta exterior (se calcula al colocar la base). */
    this._exteriorDoorReturn = null;
    /** Huellas del jugador en el suelo: {x,y,age,life,side} */
    this.footprints = [];
    this._footstepTimer = 0;
    this._footstepSide = 1;
  }

  async init() {
    const assets = this.game.assets;
    if (!assets.has('tileset')) {
      const ts = createTileset(TILE_SIZE);
      assets.set('tileset', ts.image);
      this._tilesetCols = ts.cols;
    } else {
      this._tilesetCols = 4;
    }
    if (assets.has('astro_idle_0')) {
      assets.set('player', createAstronautSheet(assets));
    }

    const ground = buildGround(MAP_COLS, MAP_ROWS);
    this.tileMap = new TileMap({
      tileSize: TILE_SIZE, cols: MAP_COLS, rows: MAP_ROWS,
      layers: [ground], tilesetImage: assets.get('tileset'), tilesetCols: this._tilesetCols || 4,
    });
    // Asset 10: terreno lunar / fondo base exterior
    if (assets.has('mapa_bg')) this.backgroundImage = assets.get('mapa_bg');

    const worldW = this.tileMap.worldWidth;
    const worldH = this.tileMap.worldHeight;
    this.camera = new Camera(LOGICAL_WIDTH, LOGICAL_HEIGHT, worldW, worldH);
    this.physicsWorld = new PhysicsWorld({ worldWidth: worldW, worldHeight: worldH, cellSize: SPATIAL_CELL_SIZE });

    this._spawnStructures(assets, worldW, worldH);
    this._spawnPlayer(assets, worldW, worldH);

    this.camera.setTarget(this.player);
    this.camera.follow(this.player, 1);
  }

  /**
   * @param {CanvasImageSource|null|undefined} image
   * @param {number} x @param {number} y
   * @param {{ scale:number, footW:number, footH:number }} cfg
   */
  _addSolidStructure(image, x, y, cfg) {
    if (!image) return null;
    const srcW = /** @type {any} */ (image).width || 32;
    const srcH = /** @type {any} */ (image).height || 32;
    const scale = cfg.scale ?? 1;
    // Dimensiones visuales escaladas (PNG original intacto; pixel art preservado por Renderer)
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    // Huella sólida: solo base inferior del sprite escalado
    const footW = Math.max(4, Math.round(w * (cfg.footW ?? 0.6)));
    const footH = Math.max(4, Math.round(h * (cfg.footH ?? 0.18)));
    const body = new PhysicsBody({
      isStatic: true,
      collider: new BoxCollider({
        width: footW,
        height: footH,
        offsetX: -footW / 2,
        offsetY: -footH,
        layer: Layer.SOLID,
        mask: Layer.PLAYER,
      }),
    });
    const ent = new Obstacle({ x, y, image, w, h, sortOffset: 0, body });
    this.addEntity(ent);
    return { x, y, w, h, footW, footH, scale };
  }

  _addInteractZone(x, y, w, h, cfg) {
    const body = new PhysicsBody({
      isStatic: true,
      collider: new BoxCollider({
        width: w, height: h,
        offsetX: -w / 2, offsetY: -h,
        isTrigger: true, layer: Layer.TRIGGER, mask: Layer.PLAYER,
      }),
    });
    const zone = new InteractableZone({ x, y, body, ...cfg });
    this.interactables.push(zone);
    this.addEntity(zone);
    return zone;
  }

  _spawnStructures(assets, worldW, worldH) {
    const cx = worldW * 0.5;
    const cy = worldH * 0.42;
    const C = STRUCTURE_CONFIG;

    // Estación principal (Asset 1) - centro (más grande)
    const main = this._addSolidStructure(assets.get('struct_base_main'), cx, cy, C.struct_base_main);
    // Panel solar (Asset 2) - izquierda
    this._addSolidStructure(assets.get('struct_solar'), cx - 110, cy + 10, C.struct_solar);
    // Antena limpia (Asset 3) - arriba-derecha
    this._addSolidStructure(assets.get('struct_antenna'), cx + 120, cy - 70, C.struct_antenna);
    // Tanques (Asset 4) - arriba-izquierda
    this._addSolidStructure(assets.get('struct_tanks'), cx - 120, cy - 60, C.struct_tanks);
    // Antena dañada (Asset 6) - derecha/noreste
    this._addSolidStructure(assets.get('struct_antenna_damaged'), cx + 190, cy - 40, C.struct_antenna_damaged);
    // Restos de nave (Asset 7) - abajo-derecha (obstáculo)
    this._addSolidStructure(assets.get('struct_wreckage'), cx + 140, cy + 90, C.struct_wreckage);

    // Puerta estación principal: trigger justo frente a la base
    if (main) {
      const door = C.struct_base_main.door || C.struct_base_main.interact;
      const doorX = main.x;
      const doorY = main.y + (door.offsetY ?? 6);
      this._addInteractZone(doorX, doorY, door.w, door.h, {
        name: 'Base principal',
        prompt: '¿Quieres entrar a la base? (E sí / Esc no)',
        requiresConfirm: true,
        onConfirm: () => this._enterBase(),
      });
      // Punto de aparición al volver desde el interior: frente a la puerta
      this._exteriorDoorReturn = { x: doorX, y: doorY + 8 };
    }

    // Interacciones de inspección (zonas escaladas según config)
    const placeInspect = (key, x, y, name, prompt) => {
      const iz = C[key].interact;
      this._addInteractZone(x, y + (iz.offsetY ?? 8), iz.w, iz.h, { name, prompt });
    };
    placeInspect('struct_solar', cx - 110, cy + 10, 'Panel solar', 'Presiona E para inspeccionar panel solar');
    placeInspect('struct_antenna', cx + 120, cy - 70, 'Antena', 'Presiona E para inspeccionar antena');
    placeInspect('struct_tanks', cx - 120, cy - 60, 'Tanques de soporte vital', 'Presiona E para inspeccionar tanques de soporte vital');
    placeInspect('struct_antenna_damaged', cx + 190, cy - 40, 'Antena dañada', 'Presiona E para inspeccionar antena dañada');
    placeInspect('struct_wreckage', cx + 140, cy + 90, 'Restos de nave', 'Presiona E para inspeccionar restos de nave');
  }

  _spawnPlayer(assets, worldW, worldH) {
    let sheet = assets.get('player');
    if (!sheet && assets.has('astro_idle_0')) {
      sheet = createAstronautSheet(assets);
      assets.set('player', sheet);
    }
    const spawnX = this.opts.spawnX ?? (worldW * 0.5);
    const spawnY = this.opts.spawnY ?? (worldH * 0.78);

    const body = new PhysicsBody({
      collider: new BoxCollider({
        width: PLAYER_FOOT_WIDTH, height: PLAYER_FOOT_HEIGHT,
        offsetX: -PLAYER_FOOT_WIDTH / 2, offsetY: -PLAYER_FOOT_HEIGHT,
        layer: Layer.PLAYER, mask: Layer.SOLID | Layer.TRIGGER,
      }),
    });
    const player = new Player({ x: spawnX, y: spawnY, sprite: createPlayerSprite(sheet), body });
    this.player = player;
    this.game.player = player;
    this.addEntity(player);
  }

  async _enterBase() {
    const ret = this._exteriorDoorReturn || { x: this.tileMap.worldWidth * 0.5, y: this.tileMap.worldHeight * 0.42 + 14 };
    const interior = new InteriorBaseScene(this.game, {
      onExit: async () => {
        const back = new DemoScene(this.game, { spawnX: ret.x, spawnY: ret.y });
        await this.game.changeScene(back);
      },
    });
    await this.game.changeScene(interior);
  }

  update(dt) {
    super.update(dt);
    if (this.inspectTimer > 0) this.inspectTimer -= dt;

    // Huellas/rastro del personaje (se desvanecen con el tiempo)
    if (this.player && this.player.body) {
      const vx = this.player.body.velocity.x;
      const vy = this.player.body.velocity.y;
      const speed = Math.hypot(vx, vy);
      // envejecer y limpiar
      for (const fp of this.footprints) fp.age += dt;
      this.footprints = this.footprints.filter((fp) => fp.age < fp.life);

      if (speed > 5) {
        this._footstepTimer -= dt;
        if (this._footstepTimer <= 0) {
          const side = this._footstepSide;
          this._footstepSide *= -1;
          // pequeño desplazamiento lateral según dirección de movimiento
          const nx = speed ? -vy / speed : 0;
          const ny = speed ? vx / speed : 0;
          const off = 2.2 * side;
          this.footprints.push({
            x: this.player.x + nx * off,
            y: this.player.y - 0.5 + ny * off,
            age: 0,
            life: 2.8,
            w: 3,
            h: 2,
          });
          this._footstepTimer = 0.18;
          if (this.footprints.length > 120) this.footprints.shift();
        }
      } else {
        this._footstepTimer = 0;
      }
    }

    this.activePrompt = '';
    let active = null;
    for (const z of this.interactables) {
      if (z.tick) z.tick(dt);
      if (z.playerInside) { active = z; if (z.requiresConfirm) break; }
    }
    if (active) {
      this.activePrompt = active.prompt;
      if (active.requiresConfirm) {
        if (this.game.input.isPressed('KeyE')) {
          if (active.onConfirm) active.onConfirm(active, this.player);
        }
      } else {
        if (this.game.input.isPressed('KeyE')) {
          this.inspectMsg = `${active.name}: inspeccionado`;
          this.inspectTimer = 2.0;
        }
      }
    }

    if (this.player && this.camera) {
      const desiredX = this.player.x - this.camera.viewWidth / 2;
      const desiredY = this.player.y - this.camera.viewHeight / 2;
      const t = 1 - Math.exp(-CAMERA_LERP * dt);
      this.camera.x += (desiredX - this.camera.x) * t;
      this.camera.y += (desiredY - this.camera.y) * t;
      this.camera._clamp();
    }
  }

  renderGroundEffects(renderer, alpha) {
    for (const fp of this.footprints) {
      const t = 1 - fp.age / fp.life;
      if (t <= 0) continue;
      const a = (t * 0.28).toFixed(3);
      renderer.drawRect(fp.x - fp.w / 2, fp.y - fp.h / 2, fp.w, fp.h, `rgba(40, 34, 28, ${a})`, true);
    }
  }

  drawUI(renderer) {
    // HUD superior izquierdo: controles
    renderer.drawText('WASD/flechas: mover | E: interactuar', 8, 8, '#ffffff');
    if (this.inspectTimer > 0 && this.inspectMsg) {
      renderer.drawText(this.inspectMsg, 8, 20, '#b6fcb6');
    }

    // HUD superior derecho
    const hudW = 118, hudH = 30;
    const hudX = LOGICAL_WIDTH - hudW - 6;
    const hudY = 6;
    renderer.drawRect(hudX, hudY, hudW, hudH, 'rgba(10,16,28,0.65)', true);
    renderer.drawRect(hudX, hudY, hudW, hudH, '#8fd3ff', false);
    renderer.drawText('HUD - MISION LUNAR', hudX + 6, hudY + 6, '#eaf6ff');
    renderer.drawText('Exterior: explorar base', hudX + 6, hudY + 16, '#cfe8ff');

    if (this.activePrompt) {
      renderer.drawText(this.activePrompt, 8, LOGICAL_HEIGHT - 18, '#ffe066');
    }
  }
}
