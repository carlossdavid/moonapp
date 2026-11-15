import { MAX_FIXED_STEPS_PER_FRAME } from '../config.js';

/** Fixed timestep update loop with render interpolation. */
export class GameLoop {
  /**
   * @param {{ update: (dt:number)=>void, render: (alpha:number)=>void, fixedDt: number, getTimeScale?: ()=>number }} opts
   */
  constructor({ update, render, fixedDt, getTimeScale }) {
    this._update = update;
    this._render = render;
    this._fixedDt = fixedDt;
    this._getTimeScale = typeof getTimeScale === 'function' ? getTimeScale : () => 1;
    this._accumulator = 0;
    this._lastTime = 0;
    this._rafId = 0;
    this._running = false;
    this._tick = this._tick.bind(this);
  }

  /** Start the loop. */
  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = 0;
    this._accumulator = 0;
    this._rafId = requestAnimationFrame(this._tick);
  }

  /** Stop the loop. */
  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  /** @param {number} timestampMs */
  _tick(timestampMs) {
    if (!this._running) return;
    if (this._lastTime === 0) this._lastTime = timestampMs;
    let frameTime = (timestampMs - this._lastTime) / 1000;
    this._lastTime = timestampMs;
    if (frameTime < 0) frameTime = 0;
    if (frameTime > 0.25) frameTime = 0.25;

    const timeScale = Math.max(1, this._getTimeScale() || 1);
    this._accumulator += frameTime * timeScale;
    let steps = 0;
    const maxSteps = MAX_FIXED_STEPS_PER_FRAME * timeScale;
    while (this._accumulator >= this._fixedDt && steps < maxSteps) {
      this._update(this._fixedDt);
      this._accumulator -= this._fixedDt;
      steps += 1;
    }
    // Prevent accumulator buildup if we hit step cap
    if (steps === maxSteps && this._accumulator >= this._fixedDt) {
      this._accumulator = 0;
    }

    const alpha = this._accumulator / this._fixedDt;
    this._render(alpha);
    this._rafId = requestAnimationFrame(this._tick);
  }
}
