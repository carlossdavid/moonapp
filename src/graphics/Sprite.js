/** Sprite with animations, flip and origin pivot. */
export class Sprite {
  /**
   * @param {import('./SpriteSheet.js').SpriteSheet} spriteSheet
   */
  constructor(spriteSheet) {
    this.spriteSheet = spriteSheet;
    /** @type {Map<string, import('./Animation.js').Animation>} */
    this.animations = new Map();
    /** @type {import('./Animation.js').Animation|null} */
    this.current = null;
    this.currentName = '';
    this.flipX = false;
    // Pivot/origin normalized (0.5,1 = feet bottom-center)
    this.originX = 0.5;
    this.originY = 1;
  }

  /**
   * @param {string} name
   * @param {import('./Animation.js').Animation} animation
   */
  addAnimation(name, animation) {
    this.animations.set(name, animation);
  }

  /**
   * @param {string} name
   * @param {boolean} [fromStart=false]
   */
  play(name, fromStart = false) {
    if (this.currentName === name && !fromStart) {
      if (this.current && !this.current.finished) this.current.play(false);
      return;
    }
    const anim = this.animations.get(name);
    if (!anim) return;
    // use a clone so instances don't share playback state
    this.current = anim.clone();
    this.currentName = name;
    this.current.play(true);
  }

  /** @param {number} dt */
  update(dt) {
    if (this.current) this.current.update(dt);
  }

  /** @param {boolean} value */
  setFlipX(value) {
    this.flipX = !!value;
  }

  /** @returns {{sx:number, sy:number, sw:number, sh:number}} */
  getCurrentFrameRect() {
    const index = this.current ? this.current.frameIndex : 0;
    return this.spriteSheet.getFrameRect(index);
  }

  /** @returns {{w:number,h:number}} */
  getFrameSize() {
    return { w: this.spriteSheet.frameWidth, h: this.spriteSheet.frameHeight };
  }
}
