import { Input } from './Input.js';
import { Time } from './Time.js';
import { GameLoop } from './GameLoop.js';
import { Renderer } from '../graphics/Renderer.js';
import { AssetLoader } from '../graphics/AssetLoader.js';
import { FIXED_DT, LOGICAL_WIDTH, LOGICAL_HEIGHT, BASE_SCALE, DEBUG_TOGGLE_KEY } from '../config.js';

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
    /** @type {'loading'|'menu'|'playing'} */
    this.state = 'loading';
    this.mouse = { x: 0, y: 0, over: false };

    this.loop = new GameLoop({
      fixedDt: FIXED_DT,
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
    });

    window.addEventListener('resize', () => this.renderer.resize());
    canvas.addEventListener('click', (e) => this._onCanvasClick(e));
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mouseleave', () => { this.mouse.over = false; });
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: true });
  }

  /** @param {MouseEvent|Touch} e */
  _updateMouseFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (LOGICAL_WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (LOGICAL_HEIGHT / rect.height);
    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.over = true;
  }

  /** @param {MouseEvent} e */
  _onMouseMove(e) {
    this._updateMouseFromEvent(e);
  }

  /** @param {MouseEvent} e */
  _onCanvasClick(e) {
    this._updateMouseFromEvent(e);
    this._onStartAction(true);
  }

  /** @param {TouchEvent} e */
  _onTouchStart(e) {
    const t = e.changedTouches && e.changedTouches[0];
    if (t) this._updateMouseFromEvent(t);
    this._onStartAction(true);
  }

  /** Initialize assets and scene hook. Override/extend as needed. */
  async init() {
    try {
      // Load UI font for menu
      try {
        const font = new FontFace('Press Start 2P', 'url(./assets/fonts/PressStart2P-Regular.ttf)');
        const loaded = await font.load();
        document.fonts.add(loaded);
      } catch (e) {
        console.warn('Font load skipped:', e.message);
      }

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

  /**
   * Switch to a new scene (inits it). Use during gameplay transitions.
   * @param {import('../scenes/Scene.js').Scene} scene
   */
  async changeScene(scene) {
    this.setScene(scene);
    if (scene && typeof scene.init === 'function') {
      await scene.init();
    }
  }

  /** Start the game loop (shows menu when ready). */
  start() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');
    this.state = 'menu';
    this.loop.start();
  }

  /** Stop the game loop. */
  stop() {
    this.loop.stop();
  }

  /** Begin gameplay from menu. */
  beginPlay() {
    if (this.state === 'playing') return;
    this.state = 'playing';
  }

  _getMenuButtonRect() {
    const btnW = 180;
    const btnH = 32;
    const btnX = Math.floor((LOGICAL_WIDTH - btnW) / 2);
    const btnY = Math.floor(LOGICAL_HEIGHT * 0.68);
    return { x: btnX, y: btnY, w: btnW, h: btnH };
  }

  _isPointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  /** @param {boolean} [fromPointer=false] */
  _onStartAction(fromPointer = false) {
    if (this.state !== 'menu') return;
    if (fromPointer) {
      const r = this._getMenuButtonRect();
      if (!this._isPointInRect(this.mouse.x, this.mouse.y, r)) return;
    }
    this.beginPlay();
  }

  /** @param {number} dt */
  update(dt) {
    if (this.state === 'menu') {
      if (this.input.isPressed('Enter') || this.input.isPressed('Space')) {
        this.beginPlay();
      }
      this.input.update();
      return;
    }

    if (this.input.isPressed(DEBUG_TOGGLE_KEY)) {
      this.debug = !this.debug;
    }
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
    if (this.state === 'menu') {
      this._renderMenu();
      return;
    }

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

  _renderMenu() {
    this.renderer.clear('#000000');
    const bg = this.assets.get('menu_bg');
    const btnNormal = this.assets.get('btn_normal');
    const btnHover = this.assets.get('btn_hover');
    const btnPressed = this.assets.get('btn_pressed');
    this.renderer.begin(null);

    if (bg) {
      this.renderer.drawImage(bg, 0, 0, bg.width, bg.height, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, false);
    }

    const r = this._getMenuButtonRect();
    const hovered = this.mouse.over && this._isPointInRect(this.mouse.x, this.mouse.y, r);
    const btnImg = hovered ? (btnHover || btnNormal) : btnNormal;

    if (btnImg) {
      this.renderer.drawImage(btnImg, 0, 0, btnImg.width, btnImg.height, r.x, r.y, r.w, r.h, false);
    } else {
      this.renderer.drawRect(r.x, r.y, r.w, r.h, 'rgba(20,24,36,0.75)', true);
      this.renderer.drawRect(r.x, r.y, r.w, r.h, '#ffffff', false);
    }

    // Button label with Press Start 2P
    const ctx = this.renderer.context;
    ctx.save();
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('INICIAR JUEGO', Math.round(r.x + r.w / 2), Math.round(r.y + r.h / 2) + 1);
    ctx.restore();

    ctx.save();
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = '#e0e0e0';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText('ENTER / CLICK', Math.round(LOGICAL_WIDTH / 2), Math.round(r.y + r.h + 8));
    ctx.restore();

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
