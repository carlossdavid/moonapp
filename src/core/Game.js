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
    /** Multiplicador de velocidad de simulación (debug: adelantar tiempo). */
    this.timeScale = 1;
    /** Vista de mapa completo en debug (tecla Z). */
    this.debugFullMap = false;
    /** @type {'loading'|'menu'|'playing'} */
    this.state = 'loading';
    this.mouse = { x: 0, y: 0, over: false };
    this.menuWindow = null; // e.g. { title, body }
    this.suitHudOpen = false;
    this.suitStatus = { oxygen: 80, battery: 60 }; // fallback/demo
    this._suitDrainTimer = 0;

    this.loop = new GameLoop({
      fixedDt: FIXED_DT,
      update: (dt) => this.update(dt),
      render: (alpha) => this.render(alpha),
      getTimeScale: () => this.timeScale || 1,
    });
    this.introVideoEl = document.getElementById('introVideo');
    if (this.introVideoEl) {
      this.introVideoEl.src = './assets/video/intro.mp4';
      this.introVideoEl.addEventListener('ended', () => this._onIntroVideoEnded());
    }
    window.addEventListener('resize', () => this.renderer.resize());
    canvas.addEventListener('click', (e) => this._onCanvasClick(e));
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mouseleave', () => { this.mouse.over = false; });
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: true });
  }
  _onIntroVideoEnded() {
    if (this.introVideoEl) this.introVideoEl.style.display = 'none';
    this.state = 'playing';
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
    this._onPointerAction();
  }

  /** @param {TouchEvent} e */
  _onTouchStart(e) {
    const t = e.changedTouches && e.changedTouches[0];
    if (t) this._updateMouseFromEvent(t);
    this._onPointerAction();
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
      // Cargar JSON de estado del traje (demo/inventado)
      try {
        const res = await fetch('./assets/hud/suit_status.json', { cache: 'no-store' });
        if (res.ok) this.suitStatus = await res.json();
      } catch (e) {
        console.warn('suit_status.json no cargado, usando valores demo:', e?.message || e);
      }
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
    this.suitHudOpen = false;
    this.setScene(scene);
    if (scene && typeof scene.init === 'function') {
      await scene.init();
    }
    if (this.energyMode && this.scene && typeof this.scene.applyEnergyMode === 'function') {
      this.scene.applyEnergyMode(this.energyMode);
    }
  }

  /**
   * Establece el modo de energía activo y actualiza la escena actual si corresponde.
   * @param {'tortuga'|'explorador'|'turbo'|string} mode
   */
  setEnergyMode(mode) {
    this.energyMode = mode;
    if (this.scene && typeof this.scene.applyEnergyMode === 'function') {
      this.scene.applyEnergyMode(mode);
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
    if (this.state === 'playing' || this.state === 'video') return;
    this.menuWindow = null;
    this.suitHudOpen = false;
    if (this.introVideoEl && this.introVideoEl.src) {
      this.state = 'video';
      this.introVideoEl.style.display = 'block';
      this.introVideoEl.currentTime = 0;
      this.introVideoEl.muted = true;
      this.introVideoEl.play().catch(() => this._onIntroVideoEnded());
      return;
    }
    this.state = 'playing';
  }

  _getMenuButtons() {
    // Smaller text/buttons aligned to bottom-right
    const btnW = 150;
    const btnH = 22;
    const gap = 6;
    const marginRight = 10;
    const marginBottom = 12;
    const x = LOGICAL_WIDTH - marginRight - btnW;
    const y2 = LOGICAL_HEIGHT - marginBottom - btnH; // configuraciones (bottom)
    const y1 = y2 - gap - btnH; // iniciar juego (above)
    return [
      { id: 'start', label: 'INICIAR JUEGO', x, y: y1, w: btnW, h: btnH },
      { id: 'settings', label: 'CONFIGURACIONES', x, y: y2, w: btnW, h: btnH },
    ];
  }

  _isPointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  _onPointerAction() {
    // Escenas interactivas (módulos/minijuegos) reciben el clic en juego.
    if (this.state === 'playing' && this.scene && typeof this.scene.handlePointer === 'function') {
      this.scene.handlePointer(this.mouse.x, this.mouse.y);
      return;
    }
    if (this.state !== 'menu') return;

    if (this.menuWindow) {
      const close = this._getMenuWindowCloseRect();
      if (close && this._isPointInRect(this.mouse.x, this.mouse.y, close)) {
        this.menuWindow = null;
      }
      return;
    }

    for (const btn of this._getMenuButtons()) {
      if (this._isPointInRect(this.mouse.x, this.mouse.y, btn)) {
        if (btn.id === 'start') this.beginPlay();
        else if (btn.id === 'settings') this.menuWindow = { title: 'CONFIGURACIONES', body: 'pendiente de hacer' };
        return;
      }
    }
  }

  _getMenuWindowCloseRect() {
    if (!this.menuWindow) return null;
    const w = 160;
    const h = 56;
    const x = Math.floor((LOGICAL_WIDTH - w) / 2);
    const y = Math.floor((LOGICAL_HEIGHT - h) / 2);
    const bw = 46;
    const bh = 12;
    const bx = x + Math.floor((w - bw) / 2);
    const by = y + h - 18;
    return { x: bx, y: by, w: bw, h: bh, panel: { x, y, w, h } };
  }

  /** @param {number} dt */
  update(dt) {
    if (this.state === 'menu') {
      if (this.menuWindow) {
        if (this.input.isPressed('Escape') || this.input.isPressed('Enter') || this.input.isPressed('Space')) {
          this.menuWindow = null;
        }
      } else {
        if (this.input.isPressed('Enter') || this.input.isPressed('Space')) {
          this.beginPlay();
        }
        if (this.input.isPressed('KeyC')) {
          this.menuWindow = { title: 'CONFIGURACIONES', body: 'pendiente de hacer' };
        }
      }
      this.input.update();
      return;
    }
    if (this.state === 'video') {
      if (this.input.isPressed('Space') || this.input.isPressed('Enter')) {
        if (this.introVideoEl) { try { this.introVideoEl.pause(); } catch (e) {} }
        this._onIntroVideoEnded();
      }
      this.input.update();
      return;
    }

    if (this.input.isPressed(DEBUG_TOGGLE_KEY)) {
      this.debug = !this.debug;
      if (!this.debug) {
        this.timeScale = 1; // reset al salir de debug
        this.debugFullMap = false;
      }
    }
    if (this.debug && this.input.isPressed('KeyY')) {
      this.timeScale = this.timeScale === 1 ? 8 : 1;
    }
    if (this.debug && this.input.isPressed('KeyZ')) {
      this.debugFullMap = !this.debugFullMap;
    }
    if (this.input.isPressed('KeyT')) {
      this.suitHudOpen = !this.suitHudOpen;
    }
    // Demo: simular agotado/carga cuando el HUD está abierto
    if (this.suitHudOpen && this.suitStatus) {
      this._suitDrainTimer = (this._suitDrainTimer || 0) + dt;
      if (this._suitDrainTimer >= 1.0) {
        this._suitDrainTimer = 0;
        if (typeof this.suitStatus.oxygen === 'number') this.suitStatus.oxygen = Math.max(0, this.suitStatus.oxygen - 2);
        if (typeof this.suitStatus.battery === 'number') this.suitStatus.battery = Math.max(0, this.suitStatus.battery - 1);
      }
      if (this.input.isPressed('KeyR')) {
        this.suitStatus.oxygen = 100;
        this.suitStatus.battery = 100;
      }
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
    if (this.state === 'video') {
      this.renderer.clear('#000000');
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
    this.renderer.begin(null);

    if (bg) {
      this.renderer.drawImage(bg, 0, 0, bg.width, bg.height, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, false);
    }

    const buttons = this._getMenuButtons();
    for (const btn of buttons) {
      const hovered = !this.menuWindow && this.mouse.over && this._isPointInRect(this.mouse.x, this.mouse.y, btn);
      const btnImg = hovered ? (btnHover || btnNormal) : btnNormal;
      if (btnImg) {
        // Draw with "cover" crop to avoid squashing when source aspect differs from button rect
        const iw = btnImg.width || 1;
        const ih = btnImg.height || 1;
        const scale = Math.max(btn.w / iw, btn.h / ih)*0.6;
        const sw = btn.w / scale;
        const sh = btn.h / scale;
        const sx = (iw - sw) / 2;
        const sy = (ih - sh) / 2;
        this.renderer.drawImage(btnImg, sx, sy, sw, sh, btn.x, btn.y, btn.w, btn.h, false);
      } else {
        this.renderer.drawRect(btn.x, btn.y, btn.w, btn.h, 'rgba(20,24,36,0.75)', true);
        this.renderer.drawRect(btn.x, btn.y, btn.w, btn.h, '#ffffff', false);
      }

      const ctx = this.renderer.context;
      ctx.save();
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(btn.label, Math.round(btn.x + btn.w / 2), Math.round(btn.y + btn.h / 2) + 1);
      ctx.restore();
    }

    // Configuraciones window (pending)
    if (this.menuWindow) {
      const close = this._getMenuWindowCloseRect();
      const p = close.panel;
      this.renderer.drawRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 'rgba(0,0,0,0.45)', true);
      this.renderer.drawRect(p.x, p.y, p.w, p.h, 'rgba(16,22,34,0.96)', true);
      this.renderer.drawRect(p.x, p.y, p.w, p.h, '#8fd3ff', false);

      const ctx = this.renderer.context;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#eaf6ff';
      ctx.fillText(this.menuWindow.title, Math.round(p.x + p.w / 2), p.y + 8);
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.menuWindow.body, Math.round(p.x + p.w / 2), p.y + 24);
      ctx.restore();

      const hoveredClose = this.mouse.over && this._isPointInRect(this.mouse.x, this.mouse.y, close);
      this.renderer.drawRect(close.x, close.y, close.w, close.h, hoveredClose ? 'rgba(90,140,190,0.95)' : 'rgba(60,120,170,0.95)', true);
      this.renderer.drawRect(close.x, close.y, close.w, close.h, '#ffffff', false);
      const ctx2 = this.renderer.context;
      ctx2.save();
      ctx2.font = '5px "Press Start 2P", monospace';
      ctx2.fillStyle = '#ffffff';
      ctx2.textAlign = 'center';
      ctx2.textBaseline = 'middle';
      ctx2.fillText('CERRAR', Math.round(close.x + close.w / 2), Math.round(close.y + close.h / 2) + 1);
      ctx2.restore();
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
