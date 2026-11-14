import { Scene } from './Scene.js';
import { Camera } from '../graphics/Camera.js';
import { SpriteSheet } from '../graphics/SpriteSheet.js';
import { Animation } from '../graphics/Animation.js';
import { Sprite } from '../graphics/Sprite.js';
import { Player } from '../entities/Player.js';
import { InteractableZone } from '../entities/InteractableZone.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { PhysicsBody } from '../physics/PhysicsBody.js';
import { BoxCollider } from '../physics/BoxCollider.js';
import {
  LOGICAL_WIDTH, LOGICAL_HEIGHT, CAMERA_LERP,
  PLAYER_FOOT_WIDTH, PLAYER_FOOT_HEIGHT, SPATIAL_CELL_SIZE, Layer,
} from '../config.js';

function createInteriorBackground(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.fillStyle = '#1b1f26';
  ctx.fillRect(0, 0, w, h);
  // circular base floor
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.42;
  ctx.fillStyle = '#6c7687';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7b8698';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#9aa6b8'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  // entrance/airlock marker at bottom
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(cx - 28, h - 60, 56, 50);
  ctx.fillStyle = '#93a0b5';
  ctx.fillRect(cx - 18, h - 54, 36, 36);
  // some interior details
  ctx.fillStyle = '#5a6475';
  ctx.fillRect(cx - 70, cy - 40, 40, 24);
  ctx.fillRect(cx + 30, cy - 40, 40, 24);
  ctx.fillRect(cx - 20, cy - 70, 40, 20);
  return c;
}

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
    sprite.play('idle-up', true); // facing into base
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
  sprite.play('idle-up', true);
  return sprite;
}

export class InteriorBaseScene extends Scene {
  /** @param {import('../core/Game.js').Game} game @param {{ onExit?: ()=>void }=} opts */
  constructor(game, opts = {}) {
    super(game);
    this.opts = opts;
    this.player = null;
    this.interactables = [];
    this.promptText = '';
  }

  async init() {
    const assets = this.game.assets;
    const worldW = 420;
    const worldH = 300;
    this.camera = new Camera(LOGICAL_WIDTH, LOGICAL_HEIGHT, worldW, worldH);
    this.physicsWorld = new PhysicsWorld({ worldWidth: worldW, worldHeight: worldH, cellSize: SPATIAL_CELL_SIZE });

    // Prefer provided interior asset (Asset 9) if loaded, else procedural fallback
    this.backgroundImage = assets.has('base_interior') ? assets.get('base_interior') : createInteriorBackground(worldW, worldH);
    this.compassImg = assets.has('compass_ui') ? assets.get('compass_ui') : null;

    // Player spawn at entrance bottom (aligned with airlock)
    this._spawnPlayer(assets, worldW / 2, worldH - 28);
    this._spawnExitZone(worldW, worldH);

    this.camera.setTarget(this.player);
    this.camera.follow(this.player, 1);
  }

  _spawnPlayer(assets, x, y) {
    let sheet = assets.get('player');
    if (!sheet && assets.has('astro_idle_0')) {
      sheet = createAstronautSheet(assets);
      assets.set('player', sheet);
    }
    const body = new PhysicsBody({
      collider: new BoxCollider({
        width: PLAYER_FOOT_WIDTH, height: PLAYER_FOOT_HEIGHT,
        offsetX: -PLAYER_FOOT_WIDTH / 2, offsetY: -PLAYER_FOOT_HEIGHT,
        layer: Layer.PLAYER, mask: Layer.SOLID | Layer.TRIGGER,
      }),
    });
    const player = new Player({ x, y, sprite: createPlayerSprite(sheet), body });
    this.player = player;
    this.game.player = player;
    this.addEntity(player);
  }

  _spawnExitZone(worldW, worldH) {
    const x = worldW / 2;
    const y = worldH - 10;
    const body = new PhysicsBody({
      isStatic: true,
      collider: new BoxCollider({
        width: 48, height: 18, offsetX: -24, offsetY: -18,
        isTrigger: true, layer: Layer.TRIGGER, mask: Layer.PLAYER,
      }),
    });
    const zone = new InteractableZone({
      x, y, body,
      name: 'Salida',
      prompt: 'Presiona E para salir de la base',
      requiresConfirm: false,
      onConfirm: () => { if (this.opts.onExit) this.opts.onExit(); },
    });
    this.interactables.push(zone);
    this.addEntity(zone);
  }

  update(dt) {
    super.update(dt);
    for (const z of this.interactables) if (z.tick) z.tick(dt);

    // Interaction handling (E to exit when inside zone)
    this.promptText = '';
    for (const z of this.interactables) {
      if (z.playerInside) {
        this.promptText = z.prompt;
        if (this.game.input.isPressed('KeyE') && z.onConfirm) {
          z.onConfirm(z, this.player);
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

  drawUI(renderer) {
    renderer.drawText('Interior de la base | WASD: mover', 8, 8, '#ffffff');
    if (this.promptText) renderer.drawText(this.promptText, 8, 20, '#ffe066');

    // HUD superior derecho
    const hudW = 118, hudH = 30;
    const hudX = LOGICAL_WIDTH - hudW - 6;
    const hudY = 6;
    renderer.drawRect(hudX, hudY, hudW, hudH, 'rgba(10,16,28,0.65)', true);
    renderer.drawRect(hudX, hudY, hudW, hudH, '#8fd3ff', false);
    renderer.drawText('HUD - MISION LUNAR', hudX + 6, hudY + 6, '#eaf6ff');
    renderer.drawText('Interior: base operativa', hudX + 6, hudY + 16, '#cfe8ff');

    // Asset 8: brújula/panel UI SOLO en interior, esquina inferior izquierda
    if (this.compassImg) {
      const pad = 4;
      const w = 56;
      const h = 56;
      const x = pad;
      const y = LOGICAL_HEIGHT - h - pad;
      renderer.drawImage(this.compassImg, 0, 0, this.compassImg.width, this.compassImg.height, x, y, w, h, false);
    } else {
      renderer.drawText('Panel/Brújula', 6, LOGICAL_HEIGHT - 14, '#cfe8ff');
    }
  }
}
