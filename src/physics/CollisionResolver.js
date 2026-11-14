/** Resolves collisions per-axis to allow sliding. */
export class CollisionResolver {
  /**
   * Resolve AABB overlap on one axis.
   * @param {import('./PhysicsBody.js').PhysicsBody} body
   * @param {import('./PhysicsBody.js').PhysicsBody} other
   * @param {'x'|'y'} axis
   * @param {{overlapX:number, overlapY:number, dx:number, dy:number}} info
   */
  static resolveAxis(body, other, axis, info) {
    // Triggers do not block movement
    if (body.collider?.isTrigger || other.collider?.isTrigger) return;
    if (body.isStatic && other.isStatic) return;

    if (axis === 'x') {
      const push = info.overlapX <= 0 ? 0 : info.overlapX;
      if (push === 0) return;
      const dir = info.dx >= 0 ? 1 : -1;
      if (body.isStatic) {
        other.position.x -= push * dir;
        if ((dir > 0 && other.velocity.x > 0) || (dir < 0 && other.velocity.x < 0)) other.velocity.x = 0;
      } else if (other.isStatic) {
        body.position.x += push * dir;
        if ((dir > 0 && body.velocity.x < 0) || (dir < 0 && body.velocity.x > 0)) body.velocity.x = 0;
      } else {
        const half = push / 2;
        body.position.x += half * dir;
        other.position.x -= half * dir;
        body.velocity.x = 0;
        other.velocity.x = 0;
      }
    } else {
      const push = info.overlapY <= 0 ? 0 : info.overlapY;
      if (push === 0) return;
      const dir = info.dy >= 0 ? 1 : -1;
      if (body.isStatic) {
        other.position.y -= push * dir;
        if ((dir > 0 && other.velocity.y > 0) || (dir < 0 && other.velocity.y < 0)) other.velocity.y = 0;
      } else if (other.isStatic) {
        body.position.y += push * dir;
        if ((dir > 0 && body.velocity.y < 0) || (dir < 0 && body.velocity.y > 0)) body.velocity.y = 0;
      } else {
        const half = push / 2;
        body.position.y += half * dir;
        other.position.y -= half * dir;
        body.velocity.y = 0;
        other.velocity.y = 0;
      }
    }
  }
}
