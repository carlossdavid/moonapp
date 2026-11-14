import { Entity } from './Entity.js';

/**
 * Visual structure placed in the world. Supports y-sorting and optional
 * footprint collider (handled via a separate body entity in the scene) and
 * an interaction trigger zone (separate entity).
 */
export class Structure extends Entity {
  /**
   * @param {{ x:number, y:number, image:CanvasImageSource, w?:number, h?:number, sortOffset?:number }} opts
   */
  constructor(opts) {
    super({ x: opts.x, y: opts.y });
    this.image = opts.image;
    this.w = opts.w ?? /** @type {any} */ (opts.image).width ?? 32;
    this.h = opts.h ?? /** @type {any} */ (opts.image).height ?? 32;
    this.sortOffset = opts.sortOffset ?? 0;
    this.originX = 0.5;
    this.originY = 1; // base/feet
  }

  update() { /* static */ }

  render(renderer, alpha) {
    const ix = this.prevX + (this.x - this.prevX) * alpha;
    const iy = this.prevY + (this.y - this.prevY) * alpha;
    const dx = ix - this.w * this.originX;
    const dy = iy - this.h * this.originY;
    const sw = /** @type {any} */ (this.image).width ?? this.w;
    const sh = /** @type {any} */ (this.image).height ?? this.h;
    renderer.drawImage(this.image, 0, 0, sw, sh, dx, dy, this.w, this.h, false);
  }

  getSortY() {
    return this.y + this.sortOffset;
  }
}
