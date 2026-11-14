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
    if (this.tileMap && this.camera) {
      // Ground layer(s) below entities (assume layer 0 is ground)
      this.tileMap.render(renderer, this.camera, [0]);
    }

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
  renderDebug(renderer) {}

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
