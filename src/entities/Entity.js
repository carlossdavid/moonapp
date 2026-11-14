let NEXT_ID = 1;

/** Base entity. */
export class Entity {
  /**
   * @param {{ id?: number, x?: number, y?: number, sprite?: any, body?: any }} [opts]
   */
  constructor(opts = {}) {
    this.id = opts.id ?? NEXT_ID++;
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.prevX = this.x;
    this.prevY = this.y;
    this.sprite = opts.sprite ?? null;
    this.body = opts.body ?? null;
    this.active = true;
  }

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
    const dx = ix - w * this.sprite.originX;
    const dy = iy - h * this.sprite.originY;
    renderer.drawImage(
      this.sprite.spriteSheet.image,
      frame.sx, frame.sy, frame.sw, frame.sh,
      dx, dy, w, h,
      this.sprite.flipX,
    );
  }

  /** @returns {number} */
  getSortY() {
    return this.y;
  }

  syncPrev() {
    this.prevX = this.x;
    this.prevY = this.y;
  }
}
