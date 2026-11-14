import { Entity } from './Entity.js';
import { PLAYER_ACCEL, PLAYER_FRICTION, PLAYER_SPEED } from '../config.js';

/** Player character with smooth movement and directional animations. */
export class Player extends Entity {
  /**
   * @param {{ x?: number, y?: number, sprite: import('../graphics/Sprite.js').Sprite }} opts
   */
  constructor(opts) {
    super(opts);
    this.vx = 0;
    this.vy = 0;
    /** @type {'down'|'up'|'left'|'right'} */
    this.facing = 'down';
  }

  /**
   * @param {number} dt
   * @param {import('../core/Game.js').Game} game
   */
  update(dt, game) {
    this.syncPrev();
    const input = game.input;
    let ix = 0;
    let iy = 0;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) ix -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) ix += 1;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) iy -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) iy += 1;

    // Normalize diagonal so speed is constant
    let len = Math.hypot(ix, iy);
    if (len > 0) {
      ix /= len;
      iy /= len;
    }

    if (len > 0) {
      this.vx += ix * PLAYER_ACCEL * dt;
      this.vy += iy * PLAYER_ACCEL * dt;
      // Clamp to max speed
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > PLAYER_SPEED) {
        this.vx = (this.vx / speed) * PLAYER_SPEED;
        this.vy = (this.vy / speed) * PLAYER_SPEED;
      }
      this._updateFacing(ix, iy);
    } else {
      // Apply friction to stop smoothly
      this.vx = this._approach(this.vx, 0, PLAYER_FRICTION * dt);
      this.vy = this._approach(this.vy, 0, PLAYER_FRICTION * dt);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const moving = Math.abs(this.vx) > 0.5 || Math.abs(this.vy) > 0.5;
    this._updateAnimation(moving);

    super.update(dt, game);
  }

  /**
   * @param {number} ix
   * @param {number} iy
   */
  _updateFacing(ix, iy) {
    // 8 directions but animations in 4 (side reused with flip)
    if (Math.abs(ix) > Math.abs(iy)) {
      this.facing = ix < 0 ? 'left' : 'right';
    } else if (Math.abs(iy) > 0) {
      this.facing = iy < 0 ? 'up' : 'down';
    } else if (ix !== 0) {
      this.facing = ix < 0 ? 'left' : 'right';
    }
  }

  /** @param {boolean} moving */
  _updateAnimation(moving) {
    if (!this.sprite) return;
    const dir = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
    const anim = `${moving ? 'walk' : 'idle'}-${dir}`;
    this.sprite.setFlipX(this.facing === 'left');
    this.sprite.play(anim, false);
  }

  /**
   * @param {number} value
   * @param {number} target
   * @param {number} delta
   * @returns {number}
   */
  _approach(value, target, delta) {
    if (value < target) return Math.min(value + delta, target);
    if (value > target) return Math.max(value - delta, target);
    return target;
  }
}
