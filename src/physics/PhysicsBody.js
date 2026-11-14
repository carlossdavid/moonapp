import { Vector2 } from '../math/Vector2.js';

/** Physics body state. */
export class PhysicsBody {
  /**
   * @param {{
   *  position?: Vector2,
   *  collider?: import('./Collider.js').Collider,
   *  isStatic?: boolean,
   *  mass?: number,
   *  friction?: number,
   *  maxSpeed?: number
   * }} [opts]
   */
  constructor(opts = {}) {
    this.position = opts.position ?? new Vector2(0, 0);
    this.prevPosition = this.position.clone();
    this.velocity = new Vector2(0, 0);
    this.acceleration = new Vector2(0, 0);
    this.isStatic = !!opts.isStatic;
    this.mass = opts.mass ?? 1;
    this.friction = opts.friction ?? 0;
    this.maxSpeed = opts.maxSpeed ?? Infinity;
    this.collider = opts.collider ?? null;
    /** @type {any} owning entity */
    this.entity = null;
  }

  /** Store previous position for render interpolation. */
  syncPrev() {
    this.prevPosition.copy(this.position);
  }

  /**
   * Integrate velocity/acceleration.
   * @param {number} dt
   */
  integrate(dt) {
    if (this.isStatic) return;
    this.velocity.x += this.acceleration.x * dt;
    this.velocity.y += this.acceleration.y * dt;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    // acceleration is impulse-like per tick in this simple model
    this.acceleration.set(0, 0);
  }
}
