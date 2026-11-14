/** Uniform spatial grid for broad-phase collision queries. */
export class SpatialGrid {
  /**
   * @param {number} cellSize
   * @param {number} worldWidth
   * @param {number} worldHeight
   */
  constructor(cellSize, worldWidth, worldHeight) {
    this.cellSize = cellSize;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cols = Math.max(1, Math.ceil(worldWidth / cellSize));
    this.rows = Math.max(1, Math.ceil(worldHeight / cellSize));
    /** @type {Map<number, Set<import('./PhysicsBody.js').PhysicsBody>>} */
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  _cellIndex(cx, cy) {
    return cy * this.cols + cx;
  }

  _getCellSet(index) {
    let set = this.cells.get(index);
    if (!set) {
      set = new Set();
      this.cells.set(index, set);
    }
    return set;
  }

  _boundsForBody(body) {
    const c = body.collider;
    if (!c) return null;
    if (c.type === 'box') {
      const r = c.getWorldAABB(body.position);
      return { minX: r.x, minY: r.y, maxX: r.right, maxY: r.bottom };
    }
    if (c.type === 'circle') {
      const cc = c.getWorldCircle(body.position);
      return { minX: cc.x - cc.r, minY: cc.y - cc.r, maxX: cc.x + cc.r, maxY: cc.y + cc.r };
    }
    return null;
  }

  /**
   * Insert body into all overlapping cells.
   * @param {import('./PhysicsBody.js').PhysicsBody} body
   */
  insert(body) {
    const b = this._boundsForBody(body);
    if (!b) return;
    const cs = this.cellSize;
    const minCx = Math.max(0, Math.floor(b.minX / cs));
    const maxCx = Math.min(this.cols - 1, Math.floor(b.maxX / cs));
    const minCy = Math.max(0, Math.floor(b.minY / cs));
    const maxCy = Math.min(this.rows - 1, Math.floor(b.maxY / cs));
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        this._getCellSet(this._cellIndex(cx, cy)).add(body);
      }
    }
  }

  /**
   * Query candidate bodies near a body (broad-phase).
   * @param {import('./PhysicsBody.js').PhysicsBody} body
   * @returns {import('./PhysicsBody.js').PhysicsBody[]}
   */
  query(body) {
    const b = this._boundsForBody(body);
    if (!b) return [];
    const cs = this.cellSize;
    const minCx = Math.max(0, Math.floor(b.minX / cs));
    const maxCx = Math.min(this.cols - 1, Math.floor(b.maxX / cs));
    const minCy = Math.max(0, Math.floor(b.minY / cs));
    const maxCy = Math.min(this.rows - 1, Math.floor(b.maxY / cs));
    /** @type {Set<import('./PhysicsBody.js').PhysicsBody>} */
    const found = new Set();
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const set = this.cells.get(this._cellIndex(cx, cy));
        if (!set) continue;
        for (const other of set) {
          if (other !== body) found.add(other);
        }
      }
    }
    return Array.from(found);
  }

  /** @returns {IterableIterator<[number, Set<any>]>} */
  getDebugCells() {
    return this.cells.entries();
  }
}
