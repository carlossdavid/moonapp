/** Spritesheet helper: computes frame rectangles. */
export class SpriteSheet {
  /**
   * @param {CanvasImageSource} image
   * @param {number} frameWidth
   * @param {number} frameHeight
   * @param {{margin?: number, spacing?: number, columns?: number}} [opts]
   */
  constructor(image, frameWidth, frameHeight, opts = {}) {
    this.image = image;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.margin = opts.margin ?? 0;
    this.spacing = opts.spacing ?? 0;
    const imgW = /** @type {any} */ (image).width || 0;
    this.columns = opts.columns ?? Math.floor((imgW - this.margin * 2 + this.spacing) / (frameWidth + this.spacing));
    const imgH = /** @type {any} */ (image).height || 0;
    const rows = Math.floor((imgH - this.margin * 2 + this.spacing) / (frameHeight + this.spacing));
    this.rows = rows;
    this._count = Math.max(0, this.columns * rows);
  }

  /**
   * Get source rect for a frame index.
   * @param {number} index
   * @returns {{sx:number, sy:number, sw:number, sh:number}}
   */
  getFrameRect(index) {
    const i = Math.max(0, Math.min(index, this._count - 1));
    const col = i % this.columns;
    const row = Math.floor(i / this.columns);
    const sx = this.margin + col * (this.frameWidth + this.spacing);
    const sy = this.margin + row * (this.frameHeight + this.spacing);
    return { sx, sy, sw: this.frameWidth, sh: this.frameHeight };
  }

  /** @returns {number} */
  get frameCount() {
    return this._count;
  }
}
