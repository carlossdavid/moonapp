import { Scene } from './Scene.js';
import { ProduccionAlimentosScene } from './ProduccionAlimentosScene.js';
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
import { readSuitResources, renderResourceHUD } from '../ui/ResourceHUD.js';
import { renderComingSoonModal } from '../ui/ComingSoonModal.js';
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
  // sala rectangular
  const roomLeft = 20, roomTop = 30, roomRight = w - 20, roomBottom = h - 60;
  ctx.fillStyle = '#6c7687';
  ctx.fillRect(roomLeft, roomTop, roomRight - roomLeft, roomBottom - roomTop);
  ctx.fillStyle = '#7b8698';
  ctx.fillRect(roomLeft + 6, roomTop + 6, roomRight - roomLeft - 12, roomBottom - roomTop - 12);
  ctx.strokeStyle = '#9aa6b8'; ctx.lineWidth = 3;
  ctx.strokeRect(roomLeft, roomTop, roomRight - roomLeft, roomBottom - roomTop);
  // hallway
  const cx = w / 2;
  ctx.fillStyle = '#5f6a79';
  ctx.fillRect(cx - 25, roomBottom, 50, h - 60 - roomBottom + 48);
  // entrance marker
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(cx - 28, h - 60, 56, 50);
  ctx.fillStyle = '#93a0b5';
  ctx.fillRect(cx - 18, h - 54, 36, 36);
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
    this.comingSoonModal = null;
    this.interiorModules = [];
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

    // Spawn: conectado al pasillo cerca de (176,285) si cabe, si no fallback
    const spawnX = this.opts.spawnX ?? Math.min(176, worldW - 40);
    const spawnY = this.opts.spawnY ?? Math.min(285, worldH - 40);
    this._spawnPlayer(assets, spawnX, spawnY);
    this._spawnExitZone(worldW, worldH);
    this.exitMarker = { x: worldW / 2, y: worldH - 10 };
    this._spawnInteriorCollisions(worldW, worldH);
    this._spawnInteriorModules(worldW, worldH);

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
    const wallT = 10;
    // Sala rectangular principal
    const roomLeft = 20;
    const roomRight = worldW - 20;
    const roomTop = 30;
    const roomBottom = worldH - 60; // deja espacio para hallway hacia salida

    // Paredes de la sala (rectangular)
    // arriba
    this._addSolidBox(roomLeft, roomTop, roomRight - roomLeft, wallT);
    // izquierda
    this._addSolidBox(roomLeft, roomTop, wallT, roomBottom - roomTop);
    // derecha
    this._addSolidBox(roomRight - wallT, roomTop, wallT, roomBottom - roomTop);
    // abajo (con abertura para hallway)
    const doorGap = 50;
    this._addSolidBox(roomLeft, roomBottom - wallT, (roomRight - roomLeft - doorGap) / 2, wallT);
    this._addSolidBox(roomRight - (roomRight - roomLeft - doorGap) / 2, roomBottom - wallT, (roomRight - roomLeft - doorGap) / 2, wallT);

    // Hallway hacia salida (abajo)
    const hallTopY = roomBottom - wallT;
    const hallBottomY = worldH - 12;
    const hallW = doorGap;
    // paredes laterales del hallway
    this._addSolidBox(cx - hallW / 2 - wallT, hallTopY, wallT, hallBottomY - hallTopY);
    this._addSolidBox(cx + hallW / 2, hallTopY, wallT, hallBottomY - hallTopY);
    // borde inferior de salida (con abertura)
    const exitGap = 44;
    this._addSolidBox(0, worldH - 12, cx - exitGap / 2, 12);
    this._addSolidBox(cx + exitGap / 2, worldH - 12, worldW - (cx + exitGap / 2), 12);
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

  _spawnInteriorModules(worldW, worldH) {
    const cx = worldW / 2;
    const roomLeft = 20, roomTop = 30, roomRight = worldW - 20, roomBottom = worldH - 60;
    this.interiorModules = [];

    const addModule = (id, name, x, y, w, h, title, desc, imageKey = null, onOpen = null) => {
      const bodySolid = new PhysicsBody({
        isStatic: true,
        collider: new BoxCollider({
          width: w, height: h, offsetX: 0, offsetY: 0,
          layer: Layer.SOLID, mask: Layer.PLAYER,
        }),
      });
      const solidEnt = new InteractableZone({ x, y, body: bodySolid });
      solidEnt.prompt = '';
      solidEnt.playerInside = false;
      this.addEntity(solidEnt);
      const gap = 8;
      const th = 12, tw2 = 12;
      const onConfirm = () => {
        if (onOpen) { onOpen(); return; }
        this.comingSoonModal = { title, description: desc, button: 'CERRAR' };
      };
      // 4 bordes, separados de la colisión del módulo
      this._addInteractZone(x + w / 2, y - gap, w, th, { name, prompt: 'Presiona E para interactuar', onConfirm });
      this._addInteractZone(x + w / 2, y + h + gap + th, w, th, { name, prompt: 'Presiona E para interactuar', onConfirm });
      this._addInteractZone(x - gap, y + h / 2, tw2, h, { name, prompt: 'Presiona E para interactuar', onConfirm });
      this._addInteractZone(x + w + gap + tw2, y + h / 2, tw2, h, { name, prompt: 'Presiona E para interactuar', onConfirm });
      this.interiorModules.push({ id, name, x, y, w, h, title, desc, imageKey });
    };

    // A. Oxígeno (sup izq)
    addModule('oxygen', 'SISTEMA DE OXÍGENO', roomLeft + 160, roomTop + 30 , 48, 48,
      'SISTEMA DE OXÍGENO',
      'Próximamente podrás gestionar la extracción de CO₂, el suministro de oxígeno y el mantenimiento del traje.', 'mod_oxigeno');
    addModule('energy', 'CONTROL DE ENERGÍA', roomRight - 100, roomTop + 115, 48, 48,
      'CONTROL DE ENERGÍA',
      'Próximamente podrás gestionar la generación, almacenamiento y distribución de energía de la base lunar.', 'mod_energia');
    addModule('food', 'CONTROL DE ALIMENTACIÓN', roomLeft + 80, roomTop + 80, 48, 48,
      'CONTROL DE ALIMENTACIÓN',
      'Próximamente podrás administrar los cultivos, la iluminación, la ventilación y las condiciones ambientales.', 'mod_alimentos',
      () => this._abrirProduccionAlimentos());
    addModule('storage', 'ALMACENAMIENTO DE RECURSOS', roomRight - 250, roomTop + 150, 48, 48,
      'ALMACENAMIENTO',
      'Próximamente podrás consultar y administrar las reservas de la estación.', 'mod_almacenamiento');
    // E. Consola: usa imagen compass_ui en (180,53) -> bajada 80px
    {
      const name = 'CONSOLA DE CONTROL';
      const x = 160, y = 53 + 80, w = 40, h = 40;
      const bodySolid = new PhysicsBody({
        isStatic: true,
        collider: new BoxCollider({
          width: w, height: h, offsetX: 0, offsetY: 0,
          layer: Layer.SOLID, mask: Layer.PLAYER,
        }),
      });
      const solidEnt = new InteractableZone({ x, y, body: bodySolid });
      solidEnt.prompt = '';
      solidEnt.playerInside = false;
      this.addEntity(solidEnt);
      const tw = w + 16, th = h + 16;
      this._addInteractZone(x + w / 2, y + h, tw, 14, {
        name,
        prompt: 'Presiona E para interactuar',
        requiresConfirm: false,
        onConfirm: () => {
          this.comingSoonModal = { title: 'CONSOLA CENTRAL', description: 'El centro de control de la estación estará disponible próximamente.', button: 'CERRAR' };
        },
      });
      this.interiorModules.push({ id: 'console', name, x, y, w, h, title: 'CONSOLA CENTRAL', desc: 'El centro de control de la estación estará disponible próximamente.', imageKey: 'compass_ui' });
    }
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

  /**
   * Abre el módulo de producción de alimentos a pantalla completa.
   * Al salir se reconstruye el interior en la posición actual del jugador.
   */
  _abrirProduccionAlimentos() {
    const px = this.player ? this.player.x : undefined;
    const py = this.player ? this.player.y : undefined;

    const volverAlInterior = () => {
      const interior = new InteriorBaseScene(this.game, {
        ...this.opts,
        spawnX: px,
        spawnY: py,
      });
      this.game.changeScene(interior);
    };

    const escena = new ProduccionAlimentosScene(this.game, { onExit: volverAlInterior });
    this.game.changeScene(escena);
  }

  renderGroundEffects(renderer, alpha) {
    if (this.interiorModules) {
      for (const m of this.interiorModules) {
        if (m.imageKey && this.game.assets && this.game.assets.has(m.imageKey)) {
          const img = this.game.assets.get(m.imageKey);
          if (img) renderer.drawImage(img, 0, 0, img.width, img.height, m.x, m.y, m.w, m.h, false);
        } else {
          renderer.drawRect(m.x, m.y, m.w, m.h, '#3a4a6a', true);
          renderer.drawRect(m.x, m.y, m.w, m.h, '#7b5cff', false);
        }
        const ctx = renderer.context;
        ctx.save();
        ctx.fillStyle = '#f5f0dc';
        ctx.font = '4px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(m.name.slice(0, 12), m.x + m.w / 2, m.y - 4);
        ctx.restore();
      }
    }
  }

  update(dt) {
    super.update(dt);
    // Toggle minimapa con M
    if (this.game.input.isPressed('KeyM') && this.minimap) {
      this.minimap.setConfig({ visible: !this.minimap.config.visible });
    }
    for (const z of this.interactables) if (z.tick) z.tick(dt);

    // Modal COMING SOON abierta
    if (this.comingSoonModal) {
      this.promptText = '';
      if (this.game.input.isPressed('Escape') || this.game.input.isPressed('KeyE') || this.game.input.isPressed('Enter')) {
        this.comingSoonModal = null;
      }
      if (this.player && this.camera) {
        const desiredX = this.player.x - this.camera.viewWidth / 2;
        const desiredY = this.player.y - this.camera.viewHeight / 2;
        const t = 1 - Math.exp(-CAMERA_LERP * dt);
        this.camera.x += (desiredX - this.camera.x) * t;
        this.camera.y += (desiredY - this.camera.y) * t;
        this.camera._clamp();
      }
      return;
    }
    // Interaction handling
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
    // HUD de recursos (toggle con T)
    let hudBottom = 0;
    if (this.game.suitHudOpen) {
      const res = readSuitResources(this.game, this);
      if (res.sourceFound) {
        hudBottom = renderResourceHUD(renderer, res, this.game.assets).height + 2;
      }
    }
    const topOffset = hudBottom ? (6 + hudBottom) : 0;

    if (this.promptText && !this.game.suitHudOpen) {
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
        'Interior de la base | WASD: mover | E: salir | M: mapa | T: traje (ox/bat) | R: recargar',
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

    if (this.comingSoonModal) {
      renderComingSoonModal(renderer, this.comingSoonModal);
    }
  }
}
