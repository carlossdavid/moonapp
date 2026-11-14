import { Vector2 } from '../math/Vector2.js';

let NEXT_ID = 1;

/** Base entity. */
export class Entity {
  /**
   * @param {{ id?: number, x?: number, y?: number, sprite?: any, body?: any }} [opts]
   */
  constructor(opts = {}) {
    this.id = opts.id ?? NEXT_ID++;
    this.body = opts.body ?? null;
    if (this.body) {
      if (opts.x != null) this.body.position.x = opts.x;
      if (opts.y != null) this.body.position.y = opts.y;
      this.body.entity = this;
    } else {
      this._pos = new Vector2(opts.x ?? 0, opts.y ?? 0);
      this._prevPos = this._pos.clone();
    }
    this.sprite = opts.sprite ?? null;
    this.active = true;
  }

  get x() { return this.body ? this.body.position.x : this._pos.x; }
  set x(v) { if (this.body) this.body.position.x = v; else this._pos.x = v; }
  get y() { return this.body ? this.body.position.y : this._pos.y; }
  set y(v) { if (this.body) this.body.position.y = v; else this._pos.y = v; }
  get prevX() { return this.body ? this.body.prevPosition.x : this._prevPos.x; }
  get prevY() { return this.body ? this.body.prevPosition.y : this._prevPos.y; }

  /** @param {number} dt @param {import('../core/Game.js').Game} game */
  update(dt, game) {
    if (this.sprite) this.sprite.update(dt);
  }

  /**
   * @param {import('../graphics/Renderer.js').Renderer} renderer
   * @param {number} alpha
   */
  render(renderer, alpha) {
    if (!this.sprite) return;
    const frame = this.sprite.getCurrentFrameRect();
    const { w, h } = this.sprite.getFrameSize();
    const ix = this.prevX + (this.x - this.prevX) * alpha;
    const iy = this.prevY + (this.y - this.prevY) * alpha;

    // Simple drop shadow at feet/base
    this.renderShadow(renderer, ix, iy, w, h);

    const dx = ix - w * this.sprite.originX;
    const dy = iy - h * this.sprite.originY;
    renderer.drawImage(
      this.sprite.spriteSheet.image,
      frame.sx, frame.sy, frame.sw, frame.sh,
      dx, dy, w, h,
      this.sprite.flipX,
    );
  }

  /**
   * Draw a simple shadow at the entity's feet.
   * @param {import('../graphics/Renderer.js').Renderer} renderer
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  renderShadow(renderer, x, y, w, h) {
    const ctx = renderer.context;
    const rx = Math.max(4, w * 0.28);
    const ry = Math.max(2, h * 0.08);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** @returns {number} */
  getSortY() {
    return this.y;
  }

  syncPrev() {
    if (this.body) this.body.syncPrev();
    else this._prevPos.copy(this._pos);
  }
}
