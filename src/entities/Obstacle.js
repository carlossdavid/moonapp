import { Entity } from './Entity.js';

/** Static obstacle/entity with visual sprite and sortable base. */
export class Obstacle extends Entity {
  /**
   * @param {{
   *  x:number,y:number,image:CanvasImageSource,w:number,h:number,
   *  sortOffset?:number
   * }} opts
   */
  constructor(opts) {
    super({ x: opts.x, y: opts.y });
    this.image = opts.image;
    this.w = opts.w;
    this.h = opts.h;
    this.sortOffset = opts.sortOffset ?? 0;
    // origin at bottom-center (feet/base)
    this.originX = 0.5;
    this.originY = 1;
  }

  update(dt, game) {
    this.syncPrev();
    // static
  }

  render(renderer, alpha) {
    const ix = this.prevX + (this.x - this.prevX) * alpha;
    const iy = this.prevY + (this.y - this.prevY) * alpha;
    const dx = ix - this.w * this.originX;
    const dy = iy - this.h * this.originY;
    renderer.drawImage(this.image, 0, 0, this.w, this.h, dx, dy, this.w, this.h, false);
  }

  getSortY() {
    return this.y + this.sortOffset;
  }
}
