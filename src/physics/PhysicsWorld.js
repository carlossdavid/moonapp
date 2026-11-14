import { SpatialGrid } from './SpatialGrid.js';
import { CollisionDetector } from './CollisionDetector.js';
import { CollisionResolver } from './CollisionResolver.js';
import { layerMatches, MAX_MOVE_PER_STEP } from '../config.js';

/** Physics simulation world. */
export class PhysicsWorld {
  /**
   * @param {{ worldWidth:number, worldHeight:number, cellSize:number }} opts
   */
  constructor(opts) {
    this.worldWidth = opts.worldWidth;
    this.worldHeight = opts.worldHeight;
    /** @type {import('./PhysicsBody.js').PhysicsBody[]} */
    this.bodies = [];
    this.grid = new SpatialGrid(opts.cellSize, opts.worldWidth, opts.worldHeight);
    /** @type {Set<string>} */
    this._activeTriggers = new Set();
  }

  /** @param {import('./PhysicsBody.js').PhysicsBody} body */
  addBody(body) {
    if (!this.bodies.includes(body)) this.bodies.push(body);
  }

  /** @param {import('./PhysicsBody.js').PhysicsBody} body */
  removeBody(body) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  _pairKey(a, b) {
    const ai = this.bodies.indexOf(a);
    const bi = this.bodies.indexOf(b);
    const x = ai <= bi ? ai : bi;
    const y = ai <= bi ? bi : ai;
    return `${x}:${y}`;
  }

  _canInteract(a, b) {
    const ca = a.collider, cb = b.collider;
    if (!ca || !cb) return false;
    // If layers/masks set (non-zero), require mutual match; if zero treat as wildcard
    const aMaskOk = ca.mask === 0 || layerMatches(ca.mask, cb.layer);
    const bMaskOk = cb.mask === 0 || layerMatches(cb.mask, ca.layer);
    return aMaskOk && bMaskOk;
  }

  _isTriggerPair(a, b) {
    return !!(a.collider?.isTrigger || b.collider?.isTrigger);
  }

  _emitTrigger(a, b, phase) {
    const target = a.collider?.isTrigger ? a : b;
    const other = target === a ? b : a;
    const ent = target.entity;
    const fnName = phase === 'enter' ? 'onTriggerEnter' : phase === 'stay' ? 'onTriggerStay' : 'onTriggerExit';
    if (ent && typeof ent[fnName] === 'function') ent[fnName](other, other.entity);
    if (typeof target[fnName] === 'function') target[fnName](other, other.entity);
  }

  _clampToWorld(body) {
    const c = body.collider;
    if (!c || c.type !== 'box' || c.isTrigger) return;
    const r = c.getWorldAABB(body.position);
    if (r.x < 0) body.position.x += -r.x;
    if (r.y < 0) body.position.y += -r.y;
    if (r.right > this.worldWidth) body.position.x -= (r.right - this.worldWidth);
    if (r.bottom > this.worldHeight) body.position.y -= (r.bottom - this.worldHeight);
  }

  _resolveAxisForBody(body, axis) {
    if (!body.collider || body.isStatic) return;
    // Clamp to world bounds as solid edges
    if (!body.collider.isTrigger) this._clampToWorld(body);
    const candidates = this.grid.query(body);
    for (const other of candidates) {
      if (!other.collider) continue;
      if (!this._canInteract(body, other)) continue;
      if (this._isTriggerPair(body, other)) continue; // triggers handled separately
      const info = CollisionDetector.detect(body, other);
      if (!info.hit || info.overlapX == null) continue;
      CollisionResolver.resolveAxis(body, other, axis, info);
      // re-clamp after resolution
      if (!body.collider.isTrigger) this._clampToWorld(body);
    }
  }

  _gatherTriggerPairs() {
    /** @type {Set<string>} */
    const current = new Set();
    this.grid.clear();
    for (const b of this.bodies) if (b.collider) this.grid.insert(b);
    for (const body of this.bodies) {
      if (!body.collider) continue;
      const candidates = this.grid.query(body);
      for (const other of candidates) {
        if (!other.collider) continue;
        if (!this._canInteract(body, other)) continue;
        if (!this._isTriggerPair(body, other)) continue;
        const info = CollisionDetector.detect(body, other);
        if (!info.hit) continue;
        current.add(this._pairKey(body, other));
      }
    }
    return current;
  }

  _updateTriggers() {
    const current = this._gatherTriggerPairs();
    // enter & stay
    for (const key of current) {
      if (!this._activeTriggers.has(key)) {
        this._activeTriggers.add(key);
        const [a, b] = this._pairFromKey(key);
        if (a && b) this._emitTrigger(a, b, 'enter');
      } else {
        const [a, b] = this._pairFromKey(key);
        if (a && b) this._emitTrigger(a, b, 'stay');
      }
    }
    // exit
    for (const key of Array.from(this._activeTriggers)) {
      if (!current.has(key)) {
        this._activeTriggers.delete(key);
        const [a, b] = this._pairFromKey(key);
        if (a && b) this._emitTrigger(a, b, 'exit');
      }
    }
  }

  _pairFromKey(key) {
    const [i, j] = key.split(':').map(Number);
    return [this.bodies[i], this.bodies[j]];
  }

  /**
   * Step physics by fixed dt.
   * @param {number} dt
   */
  step(dt) {
    // Store previous positions for interpolation
    for (const b of this.bodies) b.syncPrev();

    // Determine substeps for anti-tunneling based on max displacement this step
    let maxDisp = 0;
    for (const b of this.bodies) {
      if (b.isStatic) continue;
      const d = Math.max(Math.abs(b.velocity.x * dt), Math.abs(b.velocity.y * dt));
      if (d > maxDisp) maxDisp = d;
    }
    const substeps = Math.max(1, Math.ceil(maxDisp / MAX_MOVE_PER_STEP));
    const stepDt = dt / substeps;

    for (let s = 0; s < substeps; s++) {
      // Move X then resolve X
      for (const b of this.bodies) {
        if (b.isStatic) continue;
        b.position.x += b.velocity.x * stepDt;
      }
      this.grid.clear();
      for (const b of this.bodies) if (b.collider) this.grid.insert(b);
      for (const b of this.bodies) this._resolveAxisForBody(b, 'x');

      // Move Y then resolve Y
      for (const b of this.bodies) {
        if (b.isStatic) continue;
        b.position.y += b.velocity.y * stepDt;
      }
      this.grid.clear();
      for (const b of this.bodies) if (b.collider) this.grid.insert(b);
      for (const b of this.bodies) this._resolveAxisForBody(b, 'y');
    }

    // Final world clamp for dynamic bodies
    for (const b of this.bodies) if (!b.isStatic) this._clampToWorld(b);

    // Trigger callbacks (after movement)
    this._updateTriggers();
  }
}
