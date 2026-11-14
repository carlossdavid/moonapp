import { Rect } from '../math/Rect.js';

/** 2D camera with smooth follow, world bounds and culling rect. */
export class Camera {
  /**
   * @param {number} viewWidth
   * @param {number} viewHeight
   * @param {number} worldWidth
   * @param {number} worldHeight
   */
  constructor(viewWidth, viewHeight, worldWidth, worldHeight) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.x = 0;
    this.y = 0;
    this.target = null;
    this._viewRect = new Rect(0, 0, viewWidth, viewHeight);
  }

  /** @param {{x:number,y:number}|null} target */
  setTarget(target) {
    this.target = target;
  }

  /**
   * Immediately or smoothly follow target.
   * @param {{x:number,y:number}} target
   * @param {number} lerpFactor 0..1 snap factor per update call
   */
  follow(target, lerpFactor) {
    this.target = target;
    const desiredX = target.x - this.viewWidth / 2;
    const desiredY = target.y - this.viewHeight / 2;
    this.x += (desiredX - this.x) * lerpFactor;
    this.y += (desiredY - this.y) * lerpFactor;
    this._clamp();
  }

  /** @param {number} dt */
  update(dt) {
    // Follow is driven explicitly with lerp factor from scene/game if desired
    this._clamp();
  }

  _clamp() {
    const maxX = Math.max(0, this.worldWidth - this.viewWidth);
    const maxY = Math.max(0, this.worldHeight - this.viewHeight);
    if (this.x < 0) this.x = 0;
    if (this.y < 0) this.y = 0;
    if (this.x > maxX) this.x = maxX;
    if (this.y > maxY) this.y = maxY;
    this._viewRect.set(this.x, this.y, this.viewWidth, this.viewHeight);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {{x:number,y:number}}
   */
  worldToScreen(x, y) {
    return { x: Math.round(x - this.x), y: Math.round(y - this.y) };
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {{x:number,y:number}}
   */
  screenToWorld(x, y) {
    return { x: x + this.x, y: y + this.y };
  }

  /** @returns {Rect} */
  get viewRect() {
    this._viewRect.set(this.x, this.y, this.viewWidth, this.viewHeight);
    return this._viewRect;
  }
}
