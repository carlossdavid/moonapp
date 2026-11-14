import { Scene } from './Scene.js';
import { Camera } from '../graphics/Camera.js';
import { TileMap } from '../graphics/TileMap.js';
import { SpriteSheet } from '../graphics/SpriteSheet.js';
import { Animation } from '../graphics/Animation.js';
import { Sprite } from '../graphics/Sprite.js';
import { Player } from '../entities/Player.js';
import { Obstacle } from '../entities/Obstacle.js';
import { Entity } from '../entities/Entity.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { PhysicsBody } from '../physics/PhysicsBody.js';
import { BoxCollider } from '../physics/BoxCollider.js';
import {
  LOGICAL_WIDTH, LOGICAL_HEIGHT, TILE_SIZE, MAP_COLS, MAP_ROWS, CAMERA_LERP,
  PLAYER_FOOT_WIDTH, PLAYER_FOOT_HEIGHT, SPATIAL_CELL_SIZE, Layer,
} from '../config.js';

function createTileset(tileSize) {
  const cols = 4;
  const rows = 1;
  const c = document.createElement('canvas');
  c.width = tileSize * cols;
  c.height = tileSize * rows;
  const ctx = c.getContext('2d');
  if (!ctx) return { image: c, cols };
  // 1: grass
  ctx.fillStyle = '#3e8948'; ctx.fillRect(0, 0, tileSize, tileSize);
  ctx.fillStyle = '#4aa356'; ctx.fillRect(2, 2, 3, 3); ctx.fillRect(9, 6, 2, 2); ctx.fillRect(5, 11, 3, 2);
  // 2: grass alt
  ctx.fillStyle = '#3b8244'; ctx.fillRect(tileSize, 0, tileSize, tileSize);
  ctx.fillStyle = '#52ad5f'; ctx.fillRect(tileSize + 4, 3, 2, 2); ctx.fillRect(tileSize + 10, 10, 3, 3);
  // 3: dirt/path
  ctx.fillStyle = '#8a6a4a'; ctx.fillRect(tileSize * 2, 0, tileSize, tileSize);
  ctx.fillStyle = '#9b7b58'; ctx.fillRect(tileSize * 2 + 3, 4, 4, 3); ctx.fillRect(tileSize * 2 + 9, 9, 3, 2);
  // 4: stone
  ctx.fillStyle = '#666a73'; ctx.fillRect(tileSize * 3, 0, tileSize, tileSize);
  ctx.fillStyle = '#7b808a'; ctx.fillRect(tileSize * 3 + 1, 1, tileSize - 2, tileSize - 2);
  return { image: c, cols };
}

function createProp(kind) {
  let w = 16, h = 16;
  if (kind === 'tree') { w = 24; h = 40; }
  if (kind === 'rock') { w = 20; h = 14; }
  if (kind === 'wall') { w = 16; h = 24; }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  if (kind === 'tree') {
    ctx.fillStyle = '#7a4a2b'; ctx.fillRect(9, 24, 6, 16);
    ctx.fillStyle = '#2f7d32'; ctx.fillRect(2, 8, 20, 18);
    ctx.fillStyle = '#3f9b43'; ctx.fillRect(4, 2, 16, 12);
    ctx.fillStyle = '#58b85b'; ctx.fillRect(7, 0, 10, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(7, 38, 10, 2);
  } else if (kind === 'rock') {
    ctx.fillStyle = '#6b6f78'; ctx.fillRect(2, 4, 16, 10);
    ctx.fillStyle = '#8a909b'; ctx.fillRect(4, 2, 10, 5);
    ctx.fillStyle = '#555962'; ctx.fillRect(3, 10, 14, 3);
  } else if (kind === 'wall') {
    ctx.fillStyle = '#777d88'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#5c616b';
    for (let y = 0; y < h; y += 6) ctx.strokeRect(0.5, y + 0.5, w - 1, 6);
    ctx.strokeRect(8.5, 0.5, 0, h);
  }
  return c;
}

function createPlaceholderPlayerSheet() {
  const fw = 16, fh = 24, cols = 4, rows = 6;
  const c = document.createElement('canvas');
  c.width = fw * cols; c.height = fh * rows;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const rowColors = ['#4aa3df', '#4aa3df', '#5adf4a', '#5adf4a', '#dfaa4a', '#dfaa4a'];
  const drawChar = (x, y, body, dir, bob) => {
    const by = y + bob;
    ctx.fillStyle = body; ctx.fillRect(x + 3, by + 8, 10, 12);
    ctx.fillStyle = '#ffd4a3'; ctx.fillRect(x + 4, by + 2, 8, 7);
    ctx.fillStyle = '#222';
    if (dir === 'down') { ctx.fillRect(x + 5, by + 5, 2, 1); ctx.fillRect(x + 9, by + 5, 2, 1); }
    else if (dir === 'up') { ctx.fillRect(x + 5, by + 3, 2, 1); ctx.fillRect(x + 9, by + 3, 2, 1); }
    else { ctx.fillRect(x + 9, by + 5, 2, 1); ctx.fillRect(x + 7, by + 5, 1, 1); }
    ctx.fillStyle = '#2d2d2d';
    const step = bob === 0 ? 0 : 1;
    ctx.fillRect(x + 4, by + 20 - step, 3, 3);
    ctx.fillRect(x + 9, by + 20 + step - 1, 3, 3);
  };
  const dirByRow = ['down', 'down', 'up', 'up', 'right', 'right'];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const isWalk = r % 2 === 1;
      const bob = isWalk ? (col % 2 === 0 ? 0 : -1) : (col === 1 || col === 3 ? -1 : 0);
      drawChar(col * fw, r * fh, rowColors[r], dirByRow[r], bob);
    }
  }
  return c;
}

function createAstronautSheet(assets) {
  const srcW = 44;
  const srcH = 58;
  const fw = 22; // scaled down (50%) for smaller in-game character
  const fh = 29;
  const cols = 4;
  const rowsDef = [
    ['astro_idle_0', 'astro_idle_1', 'astro_idle_2', 'astro_idle_3'], // idle-down
    ['astro_walk_down_0', 'astro_walk_down_1', 'astro_walk_down_2', 'astro_walk_down_3'],
    ['astro_idle_0', 'astro_idle_1', 'astro_idle_2', 'astro_idle_3'], // idle-up
    ['astro_walk_up_0', 'astro_walk_up_1', 'astro_walk_up_2', 'astro_walk_up_3'],
    ['astro_idle_0', 'astro_idle_1', 'astro_idle_2', 'astro_idle_3'], // idle-right
    ['astro_walk_right_0', 'astro_walk_right_1', 'astro_walk_right_2', 'astro_walk_right_3'],
    ['astro_idle_0', 'astro_idle_1', 'astro_idle_2', 'astro_idle_3'], // idle-left
    ['astro_walk_left_0', 'astro_walk_left_1', 'astro_walk_left_2', 'astro_walk_left_3'],
  ];
  const c = document.createElement('canvas');
  c.width = fw * cols;
  c.height = fh * rowsDef.length;
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
  const isAstronaut = imgW >= 88; // astronaut composed sheet (scaled 88x232 or original 176x464)
  if (isAstronaut) {
    const imgH = /** @type {any} */ (sheetImage).height || 232;
    const cols = 4;
    const rows = 8;
    const fw = Math.floor(imgW / cols);
    const fh = Math.floor(imgH / rows);
    const sheet = new SpriteSheet(sheetImage, fw, fh, { columns: cols });
    const sprite = new Sprite(sheet);
    sprite.originX = 0.5; sprite.originY = 1;
    const def = (name, row, fps) => {
      const base = row * cols;
      sprite.addAnimation(name, new Animation({ name, frames: [base, base + 1, base + 2, base + 3], fps, loop: true }));
    };
    def('idle-down', 0, 4);  def('walk-down', 1, 8);
    def('idle-up', 2, 4);    def('walk-up', 3, 8);
    def('idle-right', 4, 4); def('walk-right', 5, 8);
    def('idle-left', 6, 4);  def('walk-left', 7, 8);
    sprite.play('idle-down', true);
    return sprite;
  }

  // Fallback placeholder (16x24, 6 rows: down, up, right; left handled by flip/map)
  const sheet = new SpriteSheet(sheetImage, 16, 24, { columns: 4 });
  const sprite = new Sprite(sheet);
  sprite.originX = 0.5; sprite.originY = 1;
  const def = (name, row, fps) => {
    const base = row * 4;
    sprite.addAnimation(name, new Animation({ name, frames: [base, base + 1, base + 2, base + 3], fps, loop: true }));
  };
  def('idle-down', 0, 4); def('walk-down', 1, 8);
  def('idle-up', 2, 4);   def('walk-up', 3, 8);
  def('idle-right', 4, 4); def('walk-right', 5, 8);
  def('idle-left', 4, 4);  def('walk-left', 5, 8);
  sprite.play('idle-down', true);
  return sprite;
}

function buildGround(cols, rows) {
  const data = new Array(cols * rows).fill(1);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const n = (x * 7 + y * 13) % 10;
      data[i] = n === 0 ? 2 : 1;
      if (y === Math.floor(rows / 2) || x === Math.floor(cols / 2)) data[i] = 3;
    }
  }
  return data;
}

class TriggerZone extends Entity {
  constructor(opts) {
    super(opts);
    this.message = opts.message || 'Trigger';
    this.activeMsg = '';
  }
  update() { /* no-op */ }
  render() { /* invisible */ }
  onTriggerEnter(other, otherEntity) {
    if (otherEntity && otherEntity instanceof Player) this.activeMsg = `${this.message} (enter)`;
  }
  onTriggerStay(other, otherEntity) {
    if (otherEntity && otherEntity instanceof Player) this.activeMsg = `${this.message}`;
  }
  onTriggerExit(other, otherEntity) {
    if (otherEntity && otherEntity instanceof Player) this.activeMsg = '';
  }
}

export class DemoScene extends Scene {
  constructor(game) {
    super(game);
    this.player = null;
    this.triggerZone = null;
    this.triggerMessage = '';
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
    } else if (!assets.has('player')) {
      assets.set('player', createPlaceholderPlayerSheet());
    }
    if (!assets.has('tree')) assets.set('tree', createProp('tree'));
    if (!assets.has('rock')) assets.set('rock', createProp('rock'));
    if (!assets.has('wall')) assets.set('wall', createProp('wall'));

    const ground = buildGround(MAP_COLS, MAP_ROWS);
    this.tileMap = new TileMap({
      tileSize: TILE_SIZE, cols: MAP_COLS, rows: MAP_ROWS,
      layers: [ground], tilesetImage: assets.get('tileset'), tilesetCols: this._tilesetCols || 4,
    });
    if (assets.has('mapa_bg')) {
      this.backgroundImage = assets.get('mapa_bg');
    }

    const worldW = this.tileMap.worldWidth;
    const worldH = this.tileMap.worldHeight;
    this.camera = new Camera(LOGICAL_WIDTH, LOGICAL_HEIGHT, worldW, worldH);
    this.physicsWorld = new PhysicsWorld({ worldWidth: worldW, worldHeight: worldH, cellSize: SPATIAL_CELL_SIZE });

    this._spawnPlayer(assets, worldW, worldH);
    this._spawnProps(assets, worldW, worldH);
    this._spawnTrigger(worldW, worldH);

    this.camera.setTarget(this.player);
    this.camera.follow(this.player, 1);
  }

  _spawnPlayer(assets, worldW, worldH) {
    const body = new PhysicsBody({
      collider: new BoxCollider({
        width: PLAYER_FOOT_WIDTH,
        height: PLAYER_FOOT_HEIGHT,
        offsetX: -PLAYER_FOOT_WIDTH / 2,
        offsetY: -PLAYER_FOOT_HEIGHT,
        layer: Layer.PLAYER,
        mask: Layer.SOLID | Layer.TRIGGER,
      }),
    });
    const player = new Player({
      x: worldW / 2,
      y: worldH / 2,
      sprite: createPlayerSprite(assets.get('player')),
      body,
    });
    this.player = player;
    this.addEntity(player);
  }

  _spawnProps(assets) {
    const treeImg = assets.get('tree');
    const rockImg = assets.get('rock');
    const wallImg = assets.get('wall');

    const addTree = (x, y) => {
      const body = new PhysicsBody({
        isStatic: true,
        collider: new BoxCollider({ width: 10, height: 6, offsetX: -5, offsetY: -6, layer: Layer.SOLID, mask: Layer.PLAYER }),
      });
      this.addEntity(new Obstacle({ x, y, image: treeImg, w: 24, h: 40, sortOffset: 0, body }));
    };
    const addRock = (x, y) => {
      const body = new PhysicsBody({
        isStatic: true,
        collider: new BoxCollider({ width: 14, height: 5, offsetX: -7, offsetY: -5, layer: Layer.SOLID, mask: Layer.PLAYER }),
      });
      this.addEntity(new Obstacle({ x, y, image: rockImg, w: 20, h: 14, sortOffset: 0, body }));
    };
    const addWall = (x, y) => {
      const body = new PhysicsBody({
        isStatic: true,
        collider: new BoxCollider({ width: 16, height: 8, offsetX: -8, offsetY: -8, layer: Layer.SOLID, mask: Layer.PLAYER }),
      });
      this.addEntity(new Obstacle({ x, y, image: wallImg, w: 16, h: 24, sortOffset: 0, body }));
    };

    const worldW = this.tileMap.worldWidth;
    const worldH = this.tileMap.worldHeight;
    const baseX = worldW * 0.5, baseY = worldH * 0.45;
    [[0,0],[30,-10],[-28,12],[14,26],[-18,34],[40,18],[60,-30],[-50,-20]].forEach(([dx,dy]) => addTree(baseX+dx, baseY+dy));
    [[-60,-40],[80,50],[-120,80],[140,-30],[20,70]].forEach(([dx,dy]) => addRock(baseX+dx, baseY+dy));

    const wallY = Math.floor(worldH * 0.3);
    for (let x = 160; x < 360; x += 16) {
      if (x >= 232 && x <= 264) continue; // opening
      addWall(x + 8, wallY);
    }
  }

  _spawnTrigger(worldW, worldH) {
    const tx = worldW * 0.5;
    const ty = worldH * 0.62;
    const body = new PhysicsBody({
      isStatic: true,
      collider: new BoxCollider({
        width: 48, height: 32, offsetX: -24, offsetY: -32,
        isTrigger: true, layer: Layer.TRIGGER, mask: Layer.PLAYER,
      }),
    });
    const zone = new TriggerZone({ x: tx, y: ty, body, message: 'Zona de prueba: has entrado en el trigger' });
    this.triggerZone = zone;
    this.addEntity(zone);
  }

  update(dt) {
    super.update(dt);
    if (this.player && this.camera) {
      const desiredX = this.player.x - this.camera.viewWidth / 2;
      const desiredY = this.player.y - this.camera.viewHeight / 2;
      const t = 1 - Math.exp(-CAMERA_LERP * dt);
      this.camera.x += (desiredX - this.camera.x) * t;
      this.camera.y += (desiredY - this.camera.y) * t;
      this.camera._clamp();
    }
    this.triggerMessage = this.triggerZone ? this.triggerZone.activeMsg : '';
  }

  drawUI(renderer) {
    renderer.drawText('WASD/flechas: mover | F1: debug', 8, 8, '#ffffff');
    renderer.drawText('Colisiones por huella, y-sort y zona trigger activas', 8, 18, '#d0d0d0');
    if (this.triggerMessage) {
      renderer.drawText(this.triggerMessage, 8, 32, '#ffe066');
    }

    if (this.game.debug) {
      const fps = this.game.time.fps;
      const px = this.player ? this.player.x.toFixed(1) : '-';
      const py = this.player ? this.player.y.toFixed(1) : '-';
      const drawn = this._lastDrawnCount ?? 0;
      const lines = [
        `FPS: ${fps}`,
        `Player: (${px}, ${py})`,
        `Dibujados: ${drawn}`,
        `Bodies: ${this.physicsWorld ? this.physicsWorld.bodies.length : 0}`,
      ];
      let y = 46;
      for (const line of lines) {
        renderer.drawText(line, 8, y, '#00ff88');
        y += 10;
      }
    }
  }
}
