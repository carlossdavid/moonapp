/** Loads and caches images/assets. */
export class AssetLoader {
  constructor() {
    /** @type {Map<string, HTMLImageElement|HTMLCanvasElement>} */
    this._cache = new Map();
    /** @type {{key:string, src:string}[]} */
    this._manifestImages = [];
  }

  /**
   * Load a single image and cache it.
   * @param {string} key
   * @param {string} src
   * @returns {Promise<HTMLImageElement>}
   */
  loadImage(key, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this._cache.set(key, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  /**
   * Load manifest describing assets.
   * @param {string} url
   * @returns {Promise<void>}
   */
  async loadManifest(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load manifest: ${url}`);
    const data = await res.json();
    this._manifestImages = Array.isArray(data.images) ? data.images : [];
  }

  /**
   * Load all assets listed in manifest.
   * @param {(loaded:number, total:number)=>void} [onProgress]
   * @returns {Promise<void>}
   */
  async loadAll(onProgress) {
    const total = this._manifestImages.length;
    let loaded = 0;
    if (onProgress) onProgress(loaded, total);
    for (const entry of this._manifestImages) {
      await this.loadImage(entry.key, entry.src);
      loaded += 1;
      if (onProgress) onProgress(loaded, total);
    }
  }

  /**
   * Get a cached asset.
   * @param {string} key
   * @returns {HTMLImageElement|HTMLCanvasElement|undefined}
   */
  get(key) {
    return this._cache.get(key);
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this._cache.has(key);
  }

  /**
   * Manually set/cache an asset (e.g. generated placeholder).
   * @param {string} key
   * @param {HTMLImageElement|HTMLCanvasElement} image
   */
  set(key, image) {
    this._cache.set(key, image);
  }
}
