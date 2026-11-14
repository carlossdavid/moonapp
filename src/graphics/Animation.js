/** Frame-based animation. */
export class Animation {
  /**
   * @param {{ name: string, frames: number[], fps: number, loop?: boolean }} opts
   */
  constructor({ name, frames, fps, loop = true }) {
    this.name = name;
    this.frames = frames.slice();
    this.fps = fps;
    this.loop = loop;
    this._time = 0;
    this._framePos = 0;
    this._playing = true;
    this._finished = false;
  }

  /** @param {boolean} [fromStart=false] */
  play(fromStart = false) {
    this._playing = true;
    if (fromStart) this.reset();
    if (this._finished && fromStart) this._finished = false;
  }

  pause() {
    this._playing = false;
  }

  reset() {
    this._time = 0;
    this._framePos = 0;
    this._finished = false;
  }

  /** @param {number} dt */
  update(dt) {
    if (!this._playing || this._finished || this.frames.length === 0) return;
    this._time += dt;
    const frameDuration = 1 / Math.max(1, this.fps);
    while (this._time >= frameDuration) {
      this._time -= frameDuration;
      this._framePos += 1;
      if (this._framePos >= this.frames.length) {
        if (this.loop) {
          this._framePos = 0;
        } else {
          this._framePos = this.frames.length - 1;
          this._finished = true;
          this._playing = false;
          break;
        }
      }
    }
  }

  /** @returns {number} global spritesheet frame index */
  get frameIndex() {
    if (this.frames.length === 0) return 0;
    return this.frames[this._framePos] ?? this.frames[0];
  }

  /** @returns {boolean} */
  get finished() {
    return this._finished;
  }

  /** @returns {Animation} */
  clone() {
    const a = new Animation({
      name: this.name,
      frames: this.frames,
      fps: this.fps,
      loop: this.loop,
    });
    a._time = this._time;
    a._framePos = this._framePos;
    a._playing = this._playing;
    a._finished = this._finished;
    return a;
  }
}
