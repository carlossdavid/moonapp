import { Collider } from './Collider.js';

/** Circle collider. */
export class CircleCollider extends Collider {
  /**
   * @param {{
   *  radius:number,
   *  offsetX?:number, offsetY?:number,
   *  isTrigger?:boolean, layer?:number, mask?:number
   * }} opts
   */
  constructor(opts) {
    super({ ...opts, type: 'circle' });
    this.radius = opts.radius;
  }

  /**
   * @param {{x:number,y:number}} entityPos
   * @returns {{x:number,y:number,r:number}}
   */
  getWorldCircle(entityPos) {
    return {
      x: entityPos.x + this.offsetX,
      y: entityPos.y + this.offsetY,
      r: this.radius,
    };
  }
}
