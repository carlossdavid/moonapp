/** Keyboard input with down/pressed/released states. */
export class Input {
  /**
   * @param {Window|HTMLElement} [target=window]
   */
  constructor(target = window) {
    this._down = new Set();
    this._pressed = new Set();
    this._released = new Set();
    this._target = target;

    this._onKeyDown = (e) => {
      if (!this._down.has(e.code)) {
        this._pressed.add(e.code);
      }
      this._down.add(e.code);
      // Prevent page scroll / browser actions during play
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'F1'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => {
      this._down.delete(e.code);
      this._released.add(e.code);
    };

    this._target.addEventListener('keydown', this._onKeyDown);
    this._target.addEventListener('keyup', this._onKeyUp);
  }

  /** Advance frame edge states. Call once per frame/tick. */
  update() {
    this._pressed.clear();
    this._released.clear();
  }

  /** @param {string} code @returns {boolean} */
  isDown(code) {
    return this._down.has(code);
  }

  /** @param {string} code @returns {boolean} */
  isPressed(code) {
    return this._pressed.has(code);
  }

  /** @param {string} code @returns {boolean} */
  isReleased(code) {
    return this._released.has(code);
  }

  /**
   * Get an axis value from key groups.
   * @param {string[]} negativeCodes
   * @param {string[]} positiveCodes
   * @returns {number} -1, 0, or 1
   */
  getAxis(negativeCodes, positiveCodes) {
    const neg = negativeCodes.some((c) => this._down.has(c)) ? 1 : 0;
    const pos = positiveCodes.some((c) => this._down.has(c)) ? 1 : 0;
    return pos - neg;
  }

  /** Remove listeners. */
  destroy() {
    this._target.removeEventListener('keydown', this._onKeyDown);
    this._target.removeEventListener('keyup', this._onKeyUp);
  }
}
