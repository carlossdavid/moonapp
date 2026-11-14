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
    return entity;
  }

  /**
   * @param {import('../entities/Entity.js').Entity} entity
   */
  removeEntity(entity) {
    const i = this.entities.indexOf(entity);
    if (i >= 0) this.entities.splice(i, 1);
  }

  /** @param {number} dt */
  update(dt) {
    for (const e of this.entities) {
      if (e.active) e.update(dt, this.game);
    }
    if (this.camera && this.camera.update) this.camera.update(dt);
  }

  /**
   * @param {import('../graphics/Renderer.js').Renderer} renderer
   * @param {number} alpha
   */
  render(renderer, alpha) {
    renderer.begin(this.camera);
    if (this.tileMap && this.camera) {
      // Ground layer(s) below entities (assume layer 0 is ground)
      this.tileMap.render(renderer, this.camera, [0]);
    }

    this.renderQueue.clear();
    for (const e of this.entities) {
      if (!e.active) continue;
      // basic camera culling by position (approx)
      if (this.camera) {
        const vr = this.camera.viewRect;
        if (e.x < vr.x - 64 || e.x > vr.right + 64 || e.y < vr.y - 64 || e.y > vr.bottom + 64) {
          continue;
        }
      }
      this.renderQueue.add(e, alpha);
    }
    this.renderQueue.flush(renderer);

    // Optional overlay tile layers above entities could go here later
    renderer.end();

    this.renderUI(renderer, alpha);
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

  /** @param {import('../graphics/Renderer.js').Renderer} renderer @param {number} alpha */
  drawUI(renderer, alpha) {}
}
