import { Rect } from '../math/Rect.js';

/** Narrow-phase collision detection. */
export class CollisionDetector {
  /**
   * @param {Rect} a
   * @param {Rect} b
   * @returns {boolean}
   */
  static aabbVsAabb(a, b) {
    return a.intersects(b);
  }

  /**
   * @param {{x:number,y:number,r:number}} a
   * @param {{x:number,y:number,r:number}} b
   * @returns {boolean}
   */
  static circleVsCircle(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const r = a.r + b.r;
    return dx * dx + dy * dy < r * r;
  }

  /**
   * @param {{x:number,y:number,r:number}} c
   * @param {Rect} r
   * @returns {boolean}
   */
  static circleVsAabb(c, r) {
    const nx = Math.max(r.x, Math.min(c.x, r.right));
    const ny = Math.max(r.y, Math.min(c.y, r.bottom));
    const dx = c.x - nx;
    const dy = c.y - ny;
    return dx * dx + dy * dy < c.r * c.r;
  }

  /**
   * Compute AABB overlap info for resolution.
   * @param {Rect} a
   * @param {Rect} b
   * @returns {{hit:boolean, overlapX:number, overlapY:number, dx:number, dy:number}}
   */
  static aabbOverlap(a, b) {
    if (!a.intersects(b)) return { hit: false, overlapX: 0, overlapY: 0, dx: 0, dy: 0 };
    const aCx = a.x + a.w / 2;
    const aCy = a.y + a.h / 2;
    const bCx = b.x + b.w / 2;
    const bCy = b.y + b.h / 2;
    const dx = aCx - bCx;
    const dy = aCy - bCy;
    const overlapX = (a.w / 2 + b.w / 2) - Math.abs(dx);
    const overlapY = (a.h / 2 + b.h / 2) - Math.abs(dy);
    return { hit: true, overlapX, overlapY, dx, dy };
  }

  /**
   * Detect collision between two bodies' colliders.
   * @param {import('./PhysicsBody.js').PhysicsBody} bodyA
   * @param {import('./PhysicsBody.js').PhysicsBody} bodyB
   * @returns {{hit:boolean, overlapX?:number, overlapY?:number, dx?:number, dy?:number}}
   */
  static detect(bodyA, bodyB) {
    const ca = bodyA.collider;
    const cb = bodyB.collider;
    if (!ca || !cb) return { hit: false };
    if (ca.type === 'box' && cb.type === 'box') {
      const ra = ca.getWorldAABB(bodyA.position);
      const rb = cb.getWorldAABB(bodyB.position);
      return CollisionDetector.aabbOverlap(ra, rb);
    }
    // Fallbacks (circle support basic boolean; resolution mainly used for AABB solids)
    if (ca.type === 'circle' && cb.type === 'circle') {
      const hit = CollisionDetector.circleVsCircle(ca.getWorldCircle(bodyA.position), cb.getWorldCircle(bodyB.position));
      return { hit };
    }
    if (ca.type === 'circle' && cb.type === 'box') {
      const hit = CollisionDetector.circleVsAabb(ca.getWorldCircle(bodyA.position), cb.getWorldAABB(bodyB.position));
      return { hit };
    }
    if (ca.type === 'box' && cb.type === 'circle') {
      const hit = CollisionDetector.circleVsAabb(cb.getWorldCircle(bodyB.position), ca.getWorldAABB(bodyA.position));
      return { hit };
    }
    return { hit: false };
  }
}
