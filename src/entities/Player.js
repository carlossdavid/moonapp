import { Entity } from './Entity.js';
import { PLAYER_ACCEL, PLAYER_FRICTION, PLAYER_SPEED } from '../config.js';

/** Player character with smooth movement and directional animations. */
export class Player extends Entity {
  /**
   * @param {{ x?: number, y?: number, sprite: import('../graphics/Sprite.js').Sprite, body?: any }} opts
   */
  constructor(opts) {
    super(opts);
    /** @type {'down'|'up'|'left'|'right'} */
    this.facing = 'down';
  }

  /**
   * Apply input as velocity; physics world integrates and resolves.
   * @param {number} dt
   * @param {import('../core/Game.js').Game} game
   */
  update(dt, game) {
    const input = game.input;
    let ix = 0;
    let iy = 0;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) ix -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) ix += 1;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) iy -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) iy += 1;

    let len = Math.hypot(ix, iy);
    if (len > 0) { ix /= len; iy /= len; }

    const vel = this.body ? this.body.velocity : null;
    if (vel) {
      if (len > 0) {
        vel.x += ix * PLAYER_ACCEL * dt;
        vel.y += iy * PLAYER_ACCEL * dt;
        const speed = Math.hypot(vel.x, vel.y);
        if (speed > PLAYER_SPEED) {
          vel.x = (vel.x / speed) * PLAYER_SPEED;
          vel.y = (vel.y / speed) * PLAYER_SPEED;
        }
        this._updateFacing(ix, iy);
      } else {
        vel.x = this._approach(vel.x, 0, PLAYER_FRICTION * dt);
        vel.y = this._approach(vel.y, 0, PLAYER_FRICTION * dt);
      }
      const moving = Math.abs(vel.x) > 0.5 || Math.abs(vel.y) > 0.5 || len > 0;
      this._updateAnimation(moving);
    } else {
      // Fallback (no physics body)
      this._updateAnimation(len > 0);
    }

    super.update(dt, game);
  }

  /**
   * @param {number} ix
   * @param {number} iy
   */
  _updateFacing(ix, iy) {
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
