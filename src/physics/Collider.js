/** Base collider. */
export class Collider {
  /**
   * @param {{
   *  type: 'box'|'circle',
   *  offsetX?: number,
   *  offsetY?: number,
   *  isTrigger?: boolean,
   *  layer?: number,
   *  mask?: number
   * }} opts
   */
  constructor(opts) {
    this.type = opts.type;
    this.offsetX = opts.offsetX ?? 0;
    this.offsetY = opts.offsetY ?? 0;
    this.isTrigger = !!opts.isTrigger;
    this.layer = opts.layer ?? 0;
    this.mask = opts.mask ?? 0;
  }
}
