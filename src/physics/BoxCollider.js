import { Collider } from './Collider.js';
import { Rect } from '../math/Rect.js';

/** Axis-aligned box collider (footprint/base). */
export class BoxCollider extends Collider {
  /**
   * @param {{
   *  width:number, height:number,
   *  offsetX?:number, offsetY?:number,
   *  isTrigger?:boolean, layer?:number, mask?:number
   * }} opts
   */
  constructor(opts) {
    super({ ...opts, type: 'box' });
    this.width = opts.width;
    this.height = opts.height;
    this._aabb = new Rect();
  }

  /**
   * Get world-space AABB for this collider.
   * @param {{x:number,y:number}} entityPos
   * @returns {Rect}
   */
  getWorldAABB(entityPos) {
    this._aabb.set(
      entityPos.x + this.offsetX,
      entityPos.y + this.offsetY,
      this.width,
      this.height,
    );
    return this._aabb;
  }
}
