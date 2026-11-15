/**
 * Copia de prueba del arranque original (src/main.js).
 *
 * No modifica src/, index.html ni los assets: importa los módulos originales
 * y sustituye únicamente la escena interior por una subclase que conecta la
 * imagen del CENTRO DE ENERGÍA con OPERACIÓN ELECTRÓLISIS.
 */
import { Game } from '../../src/core/Game.js';
import { DemoScene } from '../../src/scenes/DemoScene.js';
import { InteriorBaseScene } from '../../src/scenes/InteriorBaseScene.js';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../../src/config.js';

const $ = (id) => document.getElementById(id);
const MINIGAME_URL = 'pruebas/operacion-electrolisis/index.html?embed=1';

let toastTimer = 0;

function showToast(text) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 6000);
}

/**
 * Capa DOM de la actividad: explicación, iframe y cierre.
 * El minijuego avisa con postMessage al terminar o al pedir volver.
 */
class EnergyActivity {
  constructor() {
    this.isOpen = false;
    this.running = false;
    this.onFinish = null;

    this.root = $('activity-overlay');
    this.intro = $('activity-intro');
    this.frame = $('electrolisis-frame');
    this.startButton = $('start-test');
    this.cancelButton = $('cancel-activity');
    this.closeButton = $('close-activity');

    this.startButton.addEventListener('click', () => this.start());
    this.cancelButton.addEventListener('click', () => this.close());
    this.closeButton.addEventListener('click', () => this.close());
    window.addEventListener('message', (event) => this.handleMessage(event));
  }

  /** Abre la explicación. El minijuego todavía no se carga. */
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.running = false;
    this.root.hidden = false;
    this.intro.hidden = false;
    this.frame.hidden = true;
    this.frame.src = 'about:blank';
    document.body.classList.add('activity-open');
    this.startButton.focus({ preventScroll: true });
  }

  /** Carga el iframe del minijuego y oculta la explicación. */
  start() {
    if (!this.isOpen || this.running) return;
    this.running = true;
    this.intro.hidden = true;
    this.frame.hidden = false;
    this.frame.src = MINIGAME_URL;
  }

  /** Cierra la actividad y descarga el iframe para detener audio y bucles. */
  close(silent) {
    if (!this.isOpen) return;
    const wasRunning = this.running;
    this.isOpen = false;
    this.running = false;
    this.root.hidden = true;
    this.intro.hidden = false;
    this.frame.hidden = true;
    this.frame.src = 'about:blank';
    document.body.classList.remove('activity-open');

    if (wasRunning && !silent) showToast('Prueba cerrada. La estación sigue operativa.');
  }

  /** El iframe ha terminado o el jugador ha pedido volver. */
  handleMessage(event) {
    const data = event.data;
    if (!data || data.type !== 'electrolisis:close') return;
    if (event.source && this.frame.contentWindow && event.source !== this.frame.contentWindow) return;
    if (!this.isOpen) return;

    const summary = data.summary || null;
    this.close(true);
    if (summary) {
      showToast(
        'Informe simulado · Energía ' + summary.energyWh + ' Wh' +
        ' · Precisión ' + summary.precision + ' %' +
        ' · Agua perdida ' + summary.waterPct + ' %'
      );
    }
    if (this.onFinish) this.onFinish(summary);
  }
}

/**
 * Escena interior original con la imagen del centro de energía conectada.
 * Se puede abrir con E (zonas originales) o pulsando la propia imagen.
 */
class EnergyStationScene extends InteriorBaseScene {
  constructor(game, opts = {}) {
    super(game, opts);
    this.activity = opts.activity || null;
    this.energyZones = [];
    this.energyModule = null;
    this.lastEnergySummary = null;
    this._pulse = 0;
  }

  _spawnInteriorModules(worldW, worldH) {
    super._spawnInteriorModules(worldW, worldH);

    // La escena original crea cuatro zonas alrededor del módulo; todas
    // comparten nombre. Solo se reemplaza su acción.
    const zones = this.interactables.filter((zone) => zone.name === 'CONTROL DE ENERGÍA');
    if (!zones.length) throw new Error('No se encontró la estación CONTROL DE ENERGÍA');

    for (const zone of zones) {
      zone.prompt = 'E o clic en la imagen: operar la planta de electrólisis (prueba)';
      zone.onConfirm = () => this.openActivity();
    }
    this.energyZones = zones;
    this.energyModule = this.interiorModules.find((module) => module.id === 'energy') || null;
  }

  openActivity() {
    if (this.activity && !this.activity.isOpen) this.activity.open();
  }

  update(dt) {
    // La base se congela mientras la actividad está abierta.
    if (this.activity && this.activity.isOpen) return;
    super.update(dt);
    this._pulse += dt;
  }

  /** Rectángulo del módulo de energía en coordenadas lógicas de pantalla. */
  energyModuleRect() {
    if (!this.energyModule || !this.camera) return null;
    const m = this.energyModule;
    const screen = this.camera.worldToScreen(m.x, m.y);
    return { x: screen.x, y: screen.y, w: m.w, h: m.h, name: m.name };
  }

  /**
   * Abre la actividad si el puntero cae sobre la imagen del centro de energía.
   * Convierte píxeles del canvas a coordenadas lógicas y luego a mundo.
   */
  tryOpenAt(clientX, clientY) {
    if (!this.game || this.game.state !== 'playing') return false;
    if (!this.energyModule || !this.camera) return false;
    if (this.comingSoonModal || this.game.menuWindow) return false;
    if (this.activity && this.activity.isOpen) return false;

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;

    const sx = (clientX - rect.left) * (LOGICAL_WIDTH / rect.width);
    const sy = (clientY - rect.top) * (LOGICAL_HEIGHT / rect.height);
    const m = this.energyModule;
    const screen = this.camera.worldToScreen(m.x, m.y);
    const pad = 4;

    if (
      sx >= screen.x - pad && sx <= screen.x + m.w + pad &&
      sy >= screen.y - pad && sy <= screen.y + m.h + pad
    ) {
      this.openActivity();
      return true;
    }
    return false;
  }

  drawUI(renderer, alpha) {
    super.drawUI(renderer, alpha);

    // Señal visual sobre la imagen que abre el minijuego.
    if (!this.energyModule || !this.camera || !this.activity) return;
    if (this.activity.isOpen || this.game.state !== 'playing') return;

    const rect = this.energyModuleRect();
    if (!rect) return;
    if (
      rect.x + rect.w < 0 || rect.y + rect.h < 0 ||
      rect.x > LOGICAL_WIDTH || rect.y > LOGICAL_HEIGHT
    ) return;

    const pulse = 0.5 + 0.35 * (0.5 + 0.5 * Math.sin(this._pulse * 3.2));
    const ctx = renderer.context;
    ctx.save();
    ctx.strokeStyle = 'rgba(99, 233, 255, ' + pulse.toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(rect.x) - 1.5,
      Math.round(rect.y) - 1.5,
      rect.w + 3,
      rect.h + 3
    );
    ctx.restore();
  }

  /** Informe que devuelve el minijuego al volver a la base. */
  completeStation(summary) {
    this.lastEnergySummary = summary || null;
    for (const zone of this.energyZones) {
      zone.prompt = 'E o clic: repetir OPERACIÓN ELECTRÓLISIS';
    }
  }
}

async function bootstrap() {
  const canvas = $('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Falta el canvas #game');
  }

  const loading = $('loading');
  const activity = new EnergyActivity();
  const game = new Game(canvas);

  // Mismo recorrido que src/main.js: interior y salida al exterior.
  const scene = new EnergyStationScene(game, {
    activity,
    onExit: async () => {
      const exterior = new DemoScene(game, { spawnX: 292, spawnY: 210 });
      await game.changeScene(exterior);
    },
  });
  activity.onFinish = (summary) => scene.completeStation(summary);

  game.setScene(scene);
  try {
    await game.init();
    if (loading) {
      loading.textContent = 'Listo';
      loading.classList.add('hidden');
    }
    game.start();
  } catch (error) {
    if (loading) loading.textContent = 'Error: ' + error.message;
    console.error(error);
    return;
  }

  // La imagen del centro de energía también abre la actividad con ratón/tacto.
  const openFromPointer = (event) => {
    const point = event.changedTouches ? event.changedTouches[0] : event;
    if (point) scene.tryOpenAt(point.clientX, point.clientY);
  };
  canvas.addEventListener('click', openFromPointer);
  canvas.addEventListener('touchstart', openFromPointer, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (activity.isOpen) {
      event.preventDefault();
      activity.close();
    }
  });

  // API de depuración para la verificación automatizada.
  window.electrolisisIntegration = {
    game,
    scene,
    activity,
    introPlaying() { return game.state === 'video'; },
    skipIntro() {
      if (game.state !== 'video') return false;
      try { game.introVideoEl.pause(); } catch (e) { /* sin video */ }
      game._onIntroVideoEnded();
      return true;
    },
    openStation() { activity.open(); },
    startActivity() { activity.start(); },
    closeActivity() { activity.close(); },
    teleport(x, y) {
      if (!scene.player) return false;
      scene.player.x = x;
      scene.player.y = y;
      return true;
    },
    stationZones() {
      return scene.energyZones.map((zone) => ({
        x: zone.x,
        y: zone.y,
        w: zone.body?.collider?.width ?? 0,
        h: zone.body?.collider?.height ?? 0,
      }));
    },
    energyModuleRect() { return scene.energyModuleRect(); },
    energyModuleScreenRect() {
      const rect = scene.energyModuleRect();
      if (!rect) return null;
      const bounds = canvas.getBoundingClientRect();
      const sx = bounds.width / LOGICAL_WIDTH;
      const sy = bounds.height / LOGICAL_HEIGHT;
      return {
        x: bounds.left + rect.x * sx,
        y: bounds.top + rect.y * sy,
        w: rect.w * sx,
        h: rect.h * sy,
        name: rect.name,
      };
    },
    state() {
      return {
        gameState: game.state,
        activityOpen: activity.isOpen,
        activityRunning: activity.running,
        player: scene.player ? { x: scene.player.x, y: scene.player.y } : null,
        prompt: scene.promptText,
        lastSummary: scene.lastEnergySummary,
        logicalHeight: LOGICAL_HEIGHT,
      };
    },
  };
}

bootstrap();
