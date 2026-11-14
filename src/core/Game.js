import { Input } from './Input.js';
import { Time } from './Time.js';
import { GameLoop } from './GameLoop.js';
import { Renderer } from '../graphics/Renderer.js';
import { AssetLoader } from '../graphics/AssetLoader.js';
import { FIXED_DT, LOGICAL_WIDTH, LOGICAL_HEIGHT, BASE_SCALE } from '../config.js';

/** Main game orchestrator. */
export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input(window);
    this.time = new Time();
    this.renderer = new Renderer(canvas, LOGICAL_WIDTH, LOGICAL_HEIGHT, BASE_SCALE);
    this.assets = new AssetLoader();
    this.scene = null;
    this.player = null;
    this.debug = false;

    this.loop = new GameLoop({
      fixedDt: FIXED_DT,
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
    });

    window.addEventListener('resize', () => this.renderer.resize());
  }

  /** Initialize assets and scene hook. Override/extend as needed. */
  async init() {
    // Default: try loading manifest if present
    try {
      await this.assets.loadManifest('./assets/manifest.json');
      const loadingEl = document.getElementById('loading');
      await this.assets.loadAll((loaded, total) => {
        if (loadingEl) loadingEl.textContent = total ? `Cargando ${loaded}/${total}` : 'Cargando...';
      });
    } catch (e) {
      console.warn('Manifest load skipped:', e.message);
    }
    if (this.scene && typeof this.scene.init === 'function') {
      await this.scene.init();
    }
  }

  /** Set current scene. @param {import('../scenes/Scene.js').Scene} scene */
  setScene(scene) {
    this.scene = scene;
  }

  /** Start the game loop. */
  start() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');
    this.loop.start();
  }

  /** Stop the game loop. */
  stop() {
    this.loop.stop();
  }

  /** @param {number} dt */
  update(dt) {
    if (this.scene) {
      this.scene.update(dt);
    } else if (this.player) {
      this.player.update(dt, this);
    }
    // Clear per-frame edge states at end of fixed update tick
    this.input.update();
  }

  /** @param {number} alpha */
  render(alpha) {
    this.renderer.clear('#1a1c2c');
    if (this.scene) {
      this.scene.render(this.renderer, alpha);
      return;
    }
    this.renderer.begin(null);
    if (this.player) {
      this.player.render(this.renderer, alpha);
      this.renderer.drawText('Fase 2: mover con WASD/flechas', 8, 8, '#ffffff');
    } else {
      this._renderPhase1Placeholder();
    }
    this.renderer.end();
  }

  /** Temporary fallback visual. */
  _renderPhase1Placeholder() {
    const img = this.assets.get('placeholder');
    if (img) {
      const dw = img.width;
      const dh = img.height;
      const dx = Math.floor((LOGICAL_WIDTH - dw) / 2);
      const dy = Math.floor((LOGICAL_HEIGHT - dh) / 2);
      this.renderer.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh, false);
    }
    this.renderer.drawText('Fase 1: sprite estatico', 8, 8, '#ffffff');
  }
}
