import { TILE_SIZE } from '../config.js';

/** Tile map with layers and camera culling. */
export class TileMap {
  /**
   * @param {{
   *  tileSize:number,
   *  cols:number,
   *  rows:number,
   *  layers:number[][],
   *  tilesetImage: CanvasImageSource,
   *  tilesetCols:number
   * }} opts
   */
  constructor(opts) {
    this.tileSize = opts.tileSize ?? TILE_SIZE;
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.layers = opts.layers; // array of flat arrays (row-major), 0 = empty
    this.tilesetImage = opts.tilesetImage;
    this.tilesetCols = opts.tilesetCols;
  }

  /**
   * @param {any} data
   * @param {import('./AssetLoader.js').AssetLoader} assets
   * @returns {TileMap}
   */
  static async fromJSON(data, assets) {
    const tilesetImage = assets.get(data.tileset) || data.tilesetImage;
    if (!tilesetImage) throw new Error(`Tileset not found: ${data.tileset}`);
    return new TileMap({
      tileSize: data.tileSize ?? TILE_SIZE,
      cols: data.cols,
      rows: data.rows,
      layers: data.layers,
      tilesetImage,
      tilesetCols: data.tilesetCols,
    });
  }

  /** @returns {number} */
  get worldWidth() { return this.cols * this.tileSize; }
  /** @returns {number} */
  get worldHeight() { return this.rows * this.tileSize; }

  /**
   * @param {number} layerIndex
   * @param {number} col
   * @param {number} row
   * @returns {number}
   */
  getTile(layerIndex, col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return 0;
    const layer = this.layers[layerIndex];
    if (!layer) return 0;
    return layer[row * this.cols + col] | 0;
  }

  /**
   * Render visible tiles of specified layers (e.g. ground layers below entities).
   * @param {import('./Renderer.js').Renderer} renderer
   * @param {import('./Camera.js').Camera} camera
   * @param {number[]} [layerIndices]
   */
  render(renderer, camera, layerIndices) {
    const indices = layerIndices ?? this.layers.map((_, i) => i);
    const ts = this.tileSize;
    const view = camera.viewRect;
    const startCol = Math.max(0, Math.floor(view.x / ts));
    const endCol = Math.min(this.cols - 1, Math.floor((view.x + view.w) / ts));
    const startRow = Math.max(0, Math.floor(view.y / ts));
    const endRow = Math.min(this.rows - 1, Math.floor((view.y + view.h) / ts));

    for (const li of indices) {
      const layer = this.layers[li];
      if (!layer) continue;
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const tile = layer[row * this.cols + col] | 0;
          if (tile <= 0) continue;
          const ti = tile - 1; // 1-based in data
          const sx = (ti % this.tilesetCols) * ts;
          const sy = Math.floor(ti / this.tilesetCols) * ts;
          const dx = col * ts;
          const dy = row * ts;
          renderer.drawImage(this.tilesetImage, sx, sy, ts, ts, dx, dy, ts, ts, false);
        }
      }
    }
  }
}
