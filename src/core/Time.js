import { MAX_FRAME_TIME } from '../config.js';

/** Tracks delta time and FPS. */
export class Time {
  constructor() {
    this._last = 0;
    this._delta = 0;
    this._fps = 0;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
  }

  /**
   * Update timing from a RAF timestamp.
   * @param {number} timestampMs
   */
  update(timestampMs) {
    if (this._last === 0) {
      this._last = timestampMs;
      this._delta = 0;
      return;
    }
    let dt = (timestampMs - this._last) / 1000;
    this._last = timestampMs;
    if (dt < 0) dt = 0;
    if (dt > MAX_FRAME_TIME) dt = MAX_FRAME_TIME;
    this._delta = dt;

    this._fpsAccum += dt;
    this._fpsFrames += 1;
    if (this._fpsAccum >= 0.5) {
      this._fps = Math.round(this._fpsFrames / this._fpsAccum);
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }
  }

  /** @returns {number} clamped delta time in seconds */
  get delta() {
    return this._delta;
  }

  /** @returns {number} smoothed frames per second */
  get fps() {
    return this._fps;
  }
}
