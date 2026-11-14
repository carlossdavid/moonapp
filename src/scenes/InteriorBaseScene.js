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
import { Minimap } from '../ui/Minimap.js';
import { readSuitResources, shouldShowResourceHUD, renderResourceHUD } from '../ui/ResourceHUD.js';
import { renderInventoryPanel } from '../ui/InventoryPanel.js';
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
  // New astronaut sprites: 327x507 source frames, scaled down to keep in-game size small
  const srcW = 327;
  const srcH = 507;
  const fw = 18; // a bit smaller
  const fh = 28; // proportional-ish smaller display height
  const cols = 4;
  const rowsDef = [
    ['astro_stay_down_1', 'astro_stay_down_1', 'astro_stay_down_1', 'astro_stay_down_1'], // idle-down (frente)
    ['astro_stay_down_1', 'astro_down_2', 'astro_stay_down_1', 'astro_down_3'],           // walk-down
    ['astro_stay_up_1', 'astro_stay_up_1', 'astro_stay_up_1', 'astro_stay_up_1'],         // idle-up (espalda)
    ['astro_stay_up_1', 'astro_up_2', 'astro_stay_up_1', 'astro_up_3'],                   // walk-up
    ['astro_stay_up_1', 'astro_stay_up_1', 'astro_stay_up_1', 'astro_stay_up_1'],         // idle-right -> stay_up
    ['astro_right_1', 'astro_right_2', 'astro_right_1', 'astro_right_3'],                 // walk-right
    ['astro_stay_up_1', 'astro_stay_up_1', 'astro_stay_up_1', 'astro_stay_up_1'],         // idle-left -> stay_up
    ['astro_left_1', 'astro_left_2', 'astro_left_1', 'astro_left_3'],                     // walk-left
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
  c.dataset.kind = 'astronaut';
  return c;
}

function createPlayerSprite(sheetImage) {
  if (!sheetImage) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 144; // 16x24 frames, 4 cols x 6 rows fallback
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#4aa3df';
      for (let r = 0; r < 6; r++) for (let col = 0; col < 4; col++) ctx.fillRect(col * 16 + 4, r * 24 + 4, 8, 16);
    }
    sheetImage = c;
  }
  const imgW = /** @type {any} */ (sheetImage).width || 64;
  const imgH = /** @type {any} */ (sheetImage).height || 144;
  const isAstronaut = sheetImage.dataset?.kind === 'astronaut' || (imgW >= 72 && imgW !== 64);
  if (isAstronaut) {
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
    this.isInterior = true;
    this.player = null;
    this.interactables = [];
    this.promptText = '';
    /** Posición de la salida/airlock en el mundo (para marcador del minimapa). */
    this.exitMarker = null;
    // Minimap (HUD reutilizable, esquina superior derecha, toggle con M)
    this.minimap = new Minimap({
      x: LOGICAL_WIDTH - 56 - 6,
      y: 18,
      width: 56,
      height: 42,
      padding: 4,
      backgroundColor: 'rgba(12, 16, 22, 0.72)',
      borderColor: 'rgba(220, 230, 240, 0.55)',
      borderWidth: 1,
      borderRadius: 5,
      outlineColor: 'rgba(235, 242, 255, 0.85)',
      outlineWidth: 1,
      sectorColor: 'rgba(200, 215, 235, 0.18)',
      playerColor: '#ffd400',
      playerRadius: 2,
      showDirection: true,
      directionLength: 3,
      directionColor: '#ffd400',
      exitColor: '#6fe3a1',
      exitRadius: 1.5,
      schematic: 'interior',
      visible: false,
    });
  }

  async init() {
    const assets = this.game.assets;
    const bg = assets.has('base_interior') ? assets.get('base_interior') : null;
    // Ajustar mundo a la proporción de la imagen interior para no deformarla
    let worldW = 420;
    let worldH = 300;
    if (bg && bg.width && bg.height) {
      const aspect = bg.width / bg.height;
      worldH = 360;
      worldW = Math.round(worldH * aspect);
    }
    this.camera = new Camera(LOGICAL_WIDTH, LOGICAL_HEIGHT, worldW, worldH);
    this.physicsWorld = new PhysicsWorld({ worldWidth: worldW, worldHeight: worldH, cellSize: SPATIAL_CELL_SIZE });

    // Prefer provided interior asset (Asset 9) if loaded, else procedural fallback
    this.backgroundImage = bg || createInteriorBackground(worldW, worldH);
    this.backgroundFit = 'contain';
    this.compassImg = assets.has('compass_ui') ? assets.get('compass_ui') : null;

    // Player spawn at entrance bottom (aligned with airlock)
    this._spawnPlayer(assets, worldW / 2, worldH - 28);
    this._spawnExitZone(worldW, worldH);
    this.exitMarker = { x: worldW / 2, y: worldH - 10 };
    this._spawnInteriorCollisions(worldW, worldH);

    this.camera.setTarget(this.player);
    this.camera.follow(this.player, 1);
  }

  _addSolidBox(x, y, w, h) {
    // x,y is top-left of solid wall box
    const body = new PhysicsBody({
      isStatic: true,
      collider: new BoxCollider({
        width: w,
        height: h,
        offsetX: 0,
        offsetY: 0,
        layer: Layer.SOLID,
        mask: Layer.PLAYER,
      }),
    });
    // Entity position is used as collider origin; with offset 0,0 AABB starts at (x,y)
    const ent = new InteractableZone({ x, y, body });
    // Make it purely solid (no prompt/interaction)
    ent.prompt = '';
    ent.playerInside = false;
    this.addEntity(ent);
    return ent;
  }

  _spawnInteriorCollisions(worldW, worldH) {
    const cx = worldW / 2;

    // Layout (approx): bottom door -> short central hallway -> circular room
    const doorGap = 44;
    const bottomWallY = worldH - 12;
    const bottomWallH = 12;

    // 1) Door threshold: block passing below/through door except the opening
    this._addSolidBox(0, bottomWallY, cx - doorGap / 2, bottomWallH);
    this._addSolidBox(cx + doorGap / 2, bottomWallY, worldW - (cx + doorGap / 2), bottomWallH);

    // 2) Small central hallway walls (bottom corridor leading up to room)
    const hallTop = worldH * 0.56;
    const hallBottom = bottomWallY;
    const hallW = 54;
    const hallH = Math.max(0, hallBottom - hallTop);
    const hallLeftX = cx - hallW / 2;
    const hallRightX = cx + hallW / 2;
    // Left side blocks flanking hallway from hallTop down to bottom
    this._addSolidBox(0, hallTop, hallLeftX, hallH);
    // Right side blocks
    this._addSolidBox(hallRightX, hallTop, worldW - hallRightX, hallH);

    // 3) Circular room boundary approximated with box segments
    // Walkable circle interior: center above hallway, radius fits inside upper area
    const roomCx = cx;
    const roomCy = worldH * 0.34;
    const roomR = Math.min(worldW, worldH) * 0.30; // walkable radius (interior)
    const wallThickness = 14;
    const segments = 28;
    const hallHalf = hallW / 2;

    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      // Place a wall box centered on the ring just outside the walkable radius
      const ringR = roomR + wallThickness / 2;
      const bx = roomCx + Math.cos(am) * ringR;
      const by = roomCy + Math.sin(am) * ringR;
      const segLen = 2 * ringR * Math.sin(Math.PI / segments) + 6;
      const bw = Math.max(wallThickness, segLen);
      const bh = wallThickness;
      let rx = bx - bw / 2;
      let ry = by - bh / 2;

      // Leave an opening at the bottom of the circle to connect with hallway
      const isBottomOpening = (by > roomCy + roomR * 0.55) && (Math.abs(bx - roomCx) < hallHalf + 10);
      if (isBottomOpening) continue;

      // Skip segments that would intrude into the hallway corridor area
      if (by > hallTop - 4 && Math.abs(bx - roomCx) < hallHalf + wallThickness) continue;

      // Clamp boxes inside world
      if (rx < 0) { /* shrink */ }
      const cw = Math.min(bw, worldW - Math.max(0, rx)) - Math.max(0, -rx);
      const ch = Math.min(bh, worldH - Math.max(0, ry)) - Math.max(0, -ry);
      rx = Math.max(0, rx);
      ry = Math.max(0, ry);
      if (cw > 2 && ch > 2) this._addSolidBox(rx, ry, cw, ch);
    }

    // 4) Upper/side outer blockers to keep player inside room+hally footprint (approx rectangular bounds outside circle sides)
    // Block areas left/right of circular room above hallway (outside the circle)
    const outerTop = 0;
    const outerBottom = hallTop;
    // left outer block: from x=0 to left of circle
    this._addSolidBox(0, outerTop, Math.max(0, roomCx - roomR - 2), outerBottom);
    // right outer block
    const rightBlockX = roomCx + roomR + 2;
    this._addSolidBox(rightBlockX, outerTop, Math.max(0, worldW - rightBlockX), outerBottom);
    // top block above circle
    this._addSolidBox(Math.max(0, roomCx - roomR - 2), outerTop, Math.min(worldW, (roomR + 2) * 2), Math.max(0, roomCy - roomR - 2));
  }

  _spawnPlayer(assets, x, y) {
    let sheet = assets.get('player');
    if (!sheet && assets.has('astro_stay_down_1')) {
      sheet = createAstronautSheet(assets);
      assets.set('player', sheet);
    } else if (sheet && sheet.dataset?.kind !== 'astronaut' && assets.has('astro_stay_down_1')) {
      // Rebuild if cached sheet was created with old astronaut format
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
    // Toggle minimapa con M
    if (this.game.input.isPressed('KeyM') && this.minimap) {
      this.minimap.setConfig({ visible: !this.minimap.config.visible });
    }
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
    // HUD de recursos (solo lectura de sistemas existentes)
    let hudBottom = 0;
    if (shouldShowResourceHUD(this)) {
      const res = readSuitResources(this.game, this);
      if (res.sourceFound) {
        hudBottom = renderResourceHUD(renderer, res).height + 2;
      }
    }
    const topOffset = hudBottom ? (6 + hudBottom) : 0;

    if (this.promptText && !this.game.inventoryOpen) {
      renderer.drawText(this.promptText, 8, 8 + topOffset, '#ffe066');
    }

    // Estado superior derecho
    renderer.drawText('Interior: Base operativa', LOGICAL_WIDTH - 108, 8, '#d8ecff');
    if (this.minimap && !this.minimap.config.visible) {
      renderer.drawText('M: mapa', LOGICAL_WIDTH - 34, 18, '#b8c7d8');
    }

    // Minimap (esquina superior derecha, solo en interior, toggle con M)
    if (this.minimap && this.player && this.camera) {
      const worldW = this.camera.worldWidth;
      const worldH = this.camera.worldHeight;
      this.minimap.render(renderer, {
        playerX: this.player.x,
        playerY: this.player.y,
        worldW,
        worldH,
        facing: this.player.facing,
        exit: this.exitMarker,
      });
    }

    // Asset 8: brújula/panel UI SOLO en interior (esquina inferior izquierda)
    if (this.compassImg) {
      const w = 40;
      const h = 40;
      const x = 6;
      const y = LOGICAL_HEIGHT - h - 6;
      renderer.drawImage(this.compassImg, 0, 0, this.compassImg.width, this.compassImg.height, x, y, w, h, false);
    } else {
      renderer.drawText('Panel/Brújula', 6, LOGICAL_HEIGHT - 14, '#cfe8ff');
    }

    if (this.game.debug) {
      const fps = this.game.time.fps;
      const px = this.player ? this.player.x.toFixed(1) : '-';
      const py = this.player ? this.player.y.toFixed(1) : '-';
      const drawn = this._lastDrawnCount ?? 0;
      const lines = [
        'Interior de la base | WASD: mover | E: salir | M: mapa | I: inventario',
        `FPS: ${fps}`,
        `Player: (${px}, ${py})`,
        `Dibujados: ${drawn}`,
        `Bodies: ${this.physicsWorld ? this.physicsWorld.bodies.length : 0}`,
      ];
      let ly = (this.promptText ? 18 : 8) + topOffset;
      for (const line of lines) {
        renderer.drawText(line, 8, ly, '#00ff88');
        ly += 10;
      }
    }

    // Inventario (overlay)
    if (this.game.inventoryOpen) {
      renderInventoryPanel(renderer, this.game, this);
    }
  }
}
