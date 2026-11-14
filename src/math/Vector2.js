/** Simple 2D vector. */
export class Vector2 {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /** @returns {this} */
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /** @param {Vector2} v @returns {this} */
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  /** @returns {Vector2} */
  clone() {
    return new Vector2(this.x, this.y);
  }

  /** @param {Vector2} v @returns {this} */
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  /** @param {number} s @returns {this} */
  addScalar(s) {
    this.x += s;
    this.y += s;
    return this;
  }

  /** @param {Vector2} v @returns {this} */
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  /** @param {number} s @returns {this} */
  scale(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }

  /** @returns {number} */
  length() {
    return Math.hypot(this.x, this.y);
  }

  /** @returns {number} */
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }

  /** Normalize in place (safe for zero vector). @returns {this} */
  normalize() {
    const len = this.length();
    if (len > 0) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }

  /** @param {Vector2} v @returns {number} */
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  /**
   * Linear interpolation in place.
   * @param {Vector2} v
   * @param {number} t
   * @returns {this}
   */
  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    return this;
  }

  /**
   * @param {Vector2} v
   * @param {number} [eps=1e-6]
   * @returns {boolean}
   */
  equals(v, eps = 1e-6) {
    return Math.abs(this.x - v.x) <= eps && Math.abs(this.y - v.y) <= eps;
  }

  /** @returns {Vector2} */
  static zero() {
    return new Vector2(0, 0);
  }
}
