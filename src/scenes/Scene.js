import { RenderQueue } from '../graphics/RenderQueue.js';

/** Base scene. */
export class Scene {
  /**
   * @param {import('../core/Game.js').Game} game
   */
  constructor(game) {
    this.game = game;
    /** @type {import('../entities/Entity.js').Entity[]} */
    this.entities = [];
    this.tileMap = null;
    this.camera = null;
    this.physicsWorld = null;
    this.backgroundImage = null;
    /** @type {'stretch'|'contain'|'cover'} */
    this.backgroundFit = 'stretch';
    this.renderQueue = new RenderQueue();
  }

  /** @returns {Promise<void>} */
  async init() {}

  /**
   * @param {import('../entities/Entity.js').Entity} entity
   * @returns {import('../entities/Entity.js').Entity}
   */
  addEntity(entity) {
    this.entities.push(entity);
    if (this.physicsWorld && entity.body) this.physicsWorld.addBody(entity.body);
    return entity;
  }

  /**
   * @param {import('../entities/Entity.js').Entity} entity
   */
  removeEntity(entity) {
    const i = this.entities.indexOf(entity);
    if (i >= 0) this.entities.splice(i, 1);
    if (this.physicsWorld && entity.body) this.physicsWorld.removeBody(entity.body);
  }

  /** @param {number} dt */
  update(dt) {
    for (const e of this.entities) {
      if (e.active) e.update(dt, this.game);
    }
    if (this.physicsWorld) this.physicsWorld.step(dt);
    if (this.camera && this.camera.update) this.camera.update(dt);
  }

  /**
   * @param {import('../graphics/Renderer.js').Renderer} renderer
   * @param {number} alpha
   */
  render(renderer, alpha) {
    renderer.begin(this.camera);
    if (this.backgroundImage) {
      const w = this.tileMap ? this.tileMap.worldWidth : (this.camera ? this.camera.worldWidth : 0);
      const h = this.tileMap ? this.tileMap.worldHeight : (this.camera ? this.camera.worldHeight : 0);
      const iw = this.backgroundImage.width || w;
      const ih = this.backgroundImage.height || h;
      let dx = 0, dy = 0, dw = w, dh = h;
      if (this.backgroundFit === 'contain' && iw > 0 && ih > 0 && w > 0 && h > 0) {
        const s = Math.min(w / iw, h / ih);
        dw = iw * s;
        dh = ih * s;
        dx = (w - dw) / 2;
        dy = (h - dh) / 2;
      } else if (this.backgroundFit === 'cover' && iw > 0 && ih > 0 && w > 0 && h > 0) {
        const s = Math.max(w / iw, h / ih);
        dw = iw * s;
        dh = ih * s;
        dx = (w - dw) / 2;
        dy = (h - dh) / 2;
      }
      renderer.drawImage(this.backgroundImage, 0, 0, iw, ih, dx, dy, dw, dh, false);
    } else if (this.tileMap && this.camera) {
      // Ground layer(s) below entities (assume layer 0 is ground)
      this.tileMap.render(renderer, this.camera, [0]);
    }
    this.renderGroundEffects(renderer, alpha);

    this.renderQueue.clear();
    let drawn = 0;
    for (const e of this.entities) {
      if (!e.active) continue;
      if (this.camera) {
        const vr = this.camera.viewRect;
        if (e.x < vr.x - 64 || e.x > vr.right + 64 || e.y < vr.y - 64 || e.y > vr.bottom + 64) {
          continue;
        }
      }
      this.renderQueue.add(e, alpha);
      drawn++;
    }
    this._lastDrawnCount = drawn;
    this.renderQueue.flush(renderer);

    if (this.game.debug) this.renderDebug(renderer);

    renderer.end();

    this.renderUI(renderer, alpha);
  }

  /**
   * World-space debug rendering (inside camera transform).
   * @param {import('../graphics/Renderer.js').Renderer} renderer
   */
  renderDebug(renderer) {
    const world = this.physicsWorld;
    if (!world) return;

    // Spatial grid occupied cells (in/near view)
    if (world.grid) {
      const cs = world.grid.cellSize;
      for (const [index] of world.grid.getDebugCells()) {
        const cx = index % world.grid.cols;
        const cy = Math.floor(index / world.grid.cols);
        renderer.drawRect(cx * cs, cy * cs, cs, cs, 'rgba(80,160,255,0.18)', false);
      }
    }

    // Colliders / footprints
    for (const body of world.bodies) {
      const c = body.collider;
      if (!c) continue;
      if (c.type === 'box') {
        const r = c.getWorldAABB(body.position);
        const color = c.isTrigger ? 'rgba(255,220,0,0.9)' : 'rgba(0,255,120,0.9)';
        renderer.drawRect(r.x, r.y, r.w, r.h, color, false);
        // footprint base marker line
        renderer.drawRect(r.x, r.bottom - 1, r.w, 1, color, true);
      } else if (c.type === 'circle') {
        const cc = c.getWorldCircle(body.position);
        const color = c.isTrigger ? 'rgba(255,220,0,0.9)' : 'rgba(0,255,120,0.9)';
        renderer.drawCircle(cc.x, cc.y, cc.r, color, false);
      }
    }
  }

  /**
   * Screen-space UI rendering.
   * @param {import('../graphics/Renderer.js').Renderer} renderer
   * @param {number} alpha
   */
  renderUI(renderer, alpha) {
    renderer.begin(null);
    this.drawUI(renderer, alpha);
    renderer.end();
  }

  /**
   * World-space effects drawn on the ground (after background, before entities).
   * @param {import('../graphics/Renderer.js').Renderer} renderer
   * @param {number} alpha
   */
  renderGroundEffects(renderer, alpha) {}

  /** @param {import('../graphics/Renderer.js').Renderer} renderer @param {number} alpha */
  drawUI(renderer, alpha) {}
}
