import { Scene } from './Scene.js';
import { Camera } from '../graphics/Camera.js';
import { TileMap } from '../graphics/TileMap.js';
import { SpriteSheet } from '../graphics/SpriteSheet.js';
import { Animation } from '../graphics/Animation.js';
import { Sprite } from '../graphics/Sprite.js';
import { Player } from '../entities/Player.js';
import { Obstacle } from '../entities/Obstacle.js';
import {
  LOGICAL_WIDTH, LOGICAL_HEIGHT, TILE_SIZE, MAP_COLS, MAP_ROWS, CAMERA_LERP,
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
  ctx.fillStyle = '#3e8948';
  ctx.fillRect(0, 0, tileSize, tileSize);
  ctx.fillStyle = '#4aa356';
  ctx.fillRect(2, 2, 3, 3); ctx.fillRect(9, 6, 2, 2); ctx.fillRect(5, 11, 3, 2);
  // 2: grass alt
  ctx.fillStyle = '#3b8244';
  ctx.fillRect(tileSize, 0, tileSize, tileSize);
  ctx.fillStyle = '#52ad5f';
  ctx.fillRect(tileSize + 4, 3, 2, 2); ctx.fillRect(tileSize + 10, 10, 3, 3);
  // 3: dirt/path
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(tileSize * 2, 0, tileSize, tileSize);
  ctx.fillStyle = '#9b7b58';
  ctx.fillRect(tileSize * 2 + 3, 4, 4, 3); ctx.fillRect(tileSize * 2 + 9, 9, 3, 2);
  // 4: wall/block tile (visual ground marker)
  ctx.fillStyle = '#666a73';
  ctx.fillRect(tileSize * 3, 0, tileSize, tileSize);
  ctx.fillStyle = '#7b808a';
  ctx.fillRect(tileSize * 3 + 1, 1, tileSize - 2, tileSize - 2);
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
    // trunk
    ctx.fillStyle = '#7a4a2b';
    ctx.fillRect(9, 24, 6, 16);
    // canopy layers
    ctx.fillStyle = '#2f7d32';
    ctx.fillRect(2, 8, 20, 18);
    ctx.fillStyle = '#3f9b43';
    ctx.fillRect(4, 2, 16, 12);
    ctx.fillStyle = '#58b85b';
    ctx.fillRect(7, 0, 10, 6);
    // base shadow hint
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(7, 38, 10, 2);
  } else if (kind === 'rock') {
    ctx.fillStyle = '#6b6f78';
    ctx.fillRect(2, 4, 16, 10);
    ctx.fillStyle = '#8a909b';
    ctx.fillRect(4, 2, 10, 5);
    ctx.fillStyle = '#555962';
    ctx.fillRect(3, 10, 14, 3);
  } else if (kind === 'wall') {
    ctx.fillStyle = '#777d88';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#5c616b';
    for (let y = 0; y < h; y += 6) ctx.strokeRect(0.5, y + 0.5, w - 1, 6);
    ctx.strokeRect(8.5, 0.5, 0, h);
  }
  return c;
}

function createPlayerSheet() {
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
  const dirByRow = ['down', 'down', 'up', 'up', 'side', 'side'];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const isWalk = r % 2 === 1;
      const bob = isWalk ? (col % 2 === 0 ? 0 : -1) : (col === 1 || col === 3 ? -1 : 0);
      drawChar(col * fw, r * fh, rowColors[r], dirByRow[r], bob);
    }
  }
  return c;
}

function createPlayerSprite(sheetImage) {
  const sheet = new SpriteSheet(sheetImage, 16, 24, { columns: 4 });
  const sprite = new Sprite(sheet);
  sprite.originX = 0.5; sprite.originY = 1;
  const def = (name, row, fps) => {
    const base = row * 4;
    sprite.addAnimation(name, new Animation({ name, frames: [base, base + 1, base + 2, base + 3], fps, loop: true }));
  };
  def('idle-down', 0, 4); def('walk-down', 1, 8);
  def('idle-up', 2, 4); def('walk-up', 3, 8);
  def('idle-side', 4, 4); def('walk-side', 5, 8);
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
      // a dirt path
      if (y === Math.floor(rows / 2) || x === Math.floor(cols / 2)) data[i] = 3;
    }
  }
  return data;
}

export class DemoScene extends Scene {
  async init() {
    const assets = this.game.assets;
    if (!assets.has('tileset')) {
      const ts = createTileset(TILE_SIZE);
      assets.set('tileset', ts.image);
      this._tilesetCols = ts.cols;
    } else {
      this._tilesetCols = 4;
    }
    if (!assets.has('player')) assets.set('player', createPlayerSheet());
    if (!assets.has('tree')) assets.set('tree', createProp('tree'));
    if (!assets.has('rock')) assets.set('rock', createProp('rock'));
    if (!assets.has('wall')) assets.set('wall', createProp('wall'));

    const ground = buildGround(MAP_COLS, MAP_ROWS);
    this.tileMap = new TileMap({
      tileSize: TILE_SIZE,
      cols: MAP_COLS,
      rows: MAP_ROWS,
      layers: [ground],
      tilesetImage: assets.get('tileset'),
      tilesetCols: this._tilesetCols || 4,
    });

    const worldW = this.tileMap.worldWidth;
    const worldH = this.tileMap.worldHeight;
    this.camera = new Camera(LOGICAL_WIDTH, LOGICAL_HEIGHT, worldW, worldH);

    const player = new Player({
      x: worldW / 2,
      y: worldH / 2,
      sprite: createPlayerSprite(assets.get('player')),
    });
    this.player = player;
    this.addEntity(player);
    this.camera.setTarget(player);
    this.camera.follow(player, 1); // snap initially

    this._spawnProps(assets, worldW, worldH);
  }

  _spawnProps(assets, worldW, worldH) {
    const treeImg = assets.get('tree');
    const rockImg = assets.get('rock');
    const wallImg = assets.get('wall');
    const addTree = (x, y) => this.addEntity(new Obstacle({ x, y, image: treeImg, w: 24, h: 40, sortOffset: 0 }));
    const addRock = (x, y) => this.addEntity(new Obstacle({ x, y, image: rockImg, w: 20, h: 14, sortOffset: 0 }));
    const addWall = (x, y) => this.addEntity(new Obstacle({ x, y, image: wallImg, w: 16, h: 24, sortOffset: 0 }));

    // A grove of trees (good for y-sort testing)
    const baseX = worldW * 0.5, baseY = worldH * 0.45;
    [[0,0],[30,-10],[-28,12],[14,26],[-18,34],[40,18]].forEach(([dx,dy]) => addTree(baseX+dx, baseY+dy));
    // Rocks
    [[-60,-40],[80,50],[-120,80],[140,-30]].forEach(([dx,dy]) => addRock(baseX+dx, baseY+dy));
    // Wall with an opening (horizontal line with a gap)
    const wallY = Math.floor(worldH * 0.3);
    for (let x = 160; x < 320; x += 16) {
      if (x >= 224 && x <= 256) continue; // opening
      addWall(x + 8, wallY);
    }
  }

  update(dt) {
    super.update(dt);
    if (this.player && this.camera) {
      // Smooth camera follow
      const target = { x: this.player.x, y: this.player.y };
      const desiredX = target.x - this.camera.viewWidth / 2;
      const desiredY = target.y - this.camera.viewHeight / 2;
      // exponential-ish smoothing stable across dt
      const t = 1 - Math.exp(-CAMERA_LERP * dt);
      this.camera.x += (desiredX - this.camera.x) * t;
      this.camera.y += (desiredY - this.camera.y) * t;
      this.camera._clamp();
    }
  }

  drawUI(renderer) {
    renderer.drawText('Fase 3: camara + tilemap + y-sort (WASD/flechas)', 8, 8, '#ffffff');
    renderer.drawText('Pasa delante/detras de los arboles para probar el y-sort', 8, 18, '#d0d0d0');
  }
}
