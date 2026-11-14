/** Collects drawables and renders them sorted by depth (y-sort). */
export class RenderQueue {
  constructor() {
    /** @type {{sortY:number,id:number,draw:(r:any)=>void}[]} */
    this._items = [];
  }

  /**
   * @param {{sortY:number,id?:number,draw:(renderer:any)=>void}|{getSortY():number,id:number,render:(r:any,a:number)=>void}} item
   * @param {number} [alpha=1]
   */
  add(item, alpha = 1) {
    if (typeof item.draw === 'function' && typeof item.sortY === 'number') {
      this._items.push({ sortY: item.sortY, id: item.id ?? 0, draw: item.draw });
      return;
    }
    if (typeof item.getSortY === 'function' && typeof item.render === 'function') {
      this._items.push({
        sortY: item.getSortY(),
        id: item.id ?? 0,
        draw: (renderer) => item.render(renderer, alpha),
      });
    }
  }

  /**
   * Sort and draw all queued items, then clear.
   * @param {import('./Renderer.js').Renderer} renderer
   */
  flush(renderer) {
    this._items.sort((a, b) => {
      if (a.sortY === b.sortY) return a.id - b.id;
      return a.sortY - b.sortY;
    });
    for (const item of this._items) {
      item.draw(renderer);
    }
    this._items.length = 0;
  }

  clear() {
    this._items.length = 0;
  }

  /** @returns {number} */
  get size() {
    return this._items.length;
  }
}
