/** Axis-aligned rectangle. */
export class Rect {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  constructor(x = 0, y = 0, w = 0, h = 0) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  /** @returns {this} */
  set(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    return this;
  }

  /** @returns {this} */
  copy(r) {
    this.x = r.x;
    this.y = r.y;
    this.w = r.w;
    this.h = r.h;
    return this;
  }

  /** @returns {Rect} */
  clone() {
    return new Rect(this.x, this.y, this.w, this.h);
  }

  get left() { return this.x; }
  get right() { return this.x + this.w; }
  get top() { return this.y; }
  get bottom() { return this.y + this.h; }

  /**
   * @param {Rect} other
   * @returns {boolean}
   */
  intersects(other) {
    return (
      this.x < other.x + other.w &&
      this.x + this.w > other.x &&
      this.y < other.y + other.h &&
      this.y + this.h > other.y
    );
  }

  /**
   * @param {number} px
   * @param {number} py
   * @returns {boolean}
   */
  contains(px, py) {
    return px >= this.x && px <= this.right && py >= this.y && py <= this.bottom;
  }

  /**
   * @param {Rect} other
   * @returns {boolean}
   */
  containsRect(other) {
    return (
      other.x >= this.x &&
      other.y >= this.y &&
      other.right <= this.right &&
      other.bottom <= this.bottom
    );
  }
}
