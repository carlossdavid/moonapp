import { BeamCleaning, BOARD, COLS, ROWS, PANEL, PORTS } from './beamCleaning.js';
import { drawSpriteArt } from './spriteArt.js';

const LABELS = ['A', 'B'];
const near = (point, x, y) => Math.hypot(point.x - x, point.y - y) <= 22;

/** Pantalla aislada: conectar dos cables al mismo imán, activar y observar barrido. */
export class PanelCleaningTask {
  constructor({ root, canvas, sprites, onFinish, onNeedMagnet, onCompleted }) {
    this.root = root;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D no disponible para la tarea');
    this.ctx.imageSmoothingEnabled = false;
    this.sprites = sprites;
    this.onFinish = onFinish;
    this.onNeedMagnet = onNeedMagnet;
    this.onCompleted = onCompleted;
    this.hasMagnet = false;
    this.model = new BeamCleaning();
    this.opened = false;
    this.dragging = null;
    this.pointer = null;
    this.lastFrame = 0;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.previousFocus = null;
    this.feedback = '';
    this.status = root.querySelector('#task-status');
    this.finishButton = root.querySelector('#finish-task');
    this.activateButton = root.querySelector('#activate-task');
    this.discoverButton = root.querySelector('#discover-action');
    this.findMagnetButton = root.querySelector('#find-magnet');
    this.discoveryMessage = root.querySelector('#discovery-message');
    this.connectButtons = [
      root.querySelector('#connect-a'),
      root.querySelector('#connect-b'),
    ];

    canvas.addEventListener('pointerdown', event => {
      if (!this.opened || this.model.phase !== 'connect') return;
      const point = this.localPoint(event);
      const index = PORTS.findIndex((port, i) => !this.model.connected[i] && near(port.source, point.x, point.y));
      if (index < 0) return;
      this.dragging = index;
      this.pointer = point;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (this.dragging !== null) this.pointer = this.localPoint(event);
    });
    canvas.addEventListener('pointerup', event => {
      if (this.opened && this.model.phase === 'discover') {
        const point = this.localPoint(event);
        if (point.x >= PANEL.x && point.x <= PANEL.x + PANEL.w &&
            point.y >= PANEL.y && point.y <= PANEL.y + PANEL.h) {
          this.advanceDiscovery();
        }
        return;
      }
      if (this.dragging === null) return;
      const point = this.localPoint(event);
      const index = this.dragging;
      if (near(PORTS[index].socket, point.x, point.y)) {
        this.connect(index);
      } else {
        this.feedback = `Cable ${LABELS[index]} suelto. Conéctalo a la toma ${LABELS[index]}.`;
        this.updateStatus();
      }
      this.dragging = null;
      this.pointer = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });
    for (const type of ['pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(type, () => {
        this.dragging = null;
        this.pointer = null;
      });
    }
    root.addEventListener('keydown', event => {
      if (this.opened && event.code === 'Tab') {
        const focusable = [...root.querySelectorAll('button:not(:disabled):not([hidden]), summary, canvas[tabindex]')]
          .filter(element => element.getClientRects().length);
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      if (this.opened && event.code === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
    root.querySelector('#cancel-task').addEventListener('click', () => this.close());
    root.querySelector('#reset-task').addEventListener('click', () => {
      if (this.onReset?.() === false) return;
      this.model.reset();
      this.onPrepare?.();
      this.feedback = '';
      this.updateStatus();
    });
    this.discoverButton.addEventListener('click', () => this.advanceDiscovery());
    this.findMagnetButton.addEventListener('click', () => this.close());
    this.connectButtons.forEach((button, index) => {
      button.addEventListener('click', () => this.connect(index));
    });
    this.activateButton.addEventListener('click', () => {
      if (this.model.activate()) {
        this.feedback = '';
        this.updateStatus();
      }
    });
    this.finishButton.addEventListener('click', () => {
      if (!this.model.complete) return;
      this.onCompleted?.(this.model);
      this.onFinish(this.model.progress);
      this.close();
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  get isOpen() { return this.opened; }

  resize() {
    const scale = Math.max(1, Math.floor(Math.min(
      (window.innerWidth - 40) / BOARD.w, (window.innerHeight - 295) / BOARD.h
    )));
    this.canvas.style.width = `${BOARD.w * scale}px`;
    this.canvas.style.height = `${BOARD.h * scale}px`;
  }

  localPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * BOARD.w / rect.width,
      y: (event.clientY - rect.top) * BOARD.h / rect.height,
    };
  }

  connect(index) {
    if (!this.model.connect(index)) return;
    this.feedback = `Cable ${LABELS[index]} conectado al imán.`;
    this.updateStatus();
  }

  advanceDiscovery() {
    if (this.model.phase !== 'discover') return;
    if (this.model.discoveryStep < 2) this.model.observe();
    else {
      this.onDiscoveryComplete?.();
      this.model.beginCleaning(this.hasMagnet);
      if (this.model.phase === 'needMagnet') this.onNeedMagnet?.();
    }
    this.updateStatus();
    if (this.model.phase === 'needMagnet') this.findMagnetButton.focus();
    else if (this.model.phase === 'connect') this.canvas.focus();
  }

  open() {
    if (this.opened) return;
    this.previousFocus = document.activeElement;
    this.opened = true;
    this.root.hidden = false;
    this.dragging = null;
    this.pointer = null;
    this.feedback = '';
    this.lastFrame = performance.now();
    this.updateStatus();
    const focusTarget = this.model.phase === 'discover' ? this.discoverButton :
      this.model.phase === 'needMagnet' ? this.findMagnetButton :
      this.model.phase === 'connect' ? this.canvas : (this.model.phase === 'ready'
      ? this.activateButton
      : this.model.complete ? this.finishButton : this.root.querySelector('#cancel-task'));
    focusTarget.focus();
    requestAnimationFrame(time => this.frame(time));
  }

  close() {
    if (!this.opened) return;
    this.opened = false;
    this.dragging = null;
    this.pointer = null;
    this.root.hidden = true;
    if (this.previousFocus?.focus) this.previousFocus.focus();
  }

  updateStatus() {
    const model = this.model;
    this.connectButtons.forEach((button, i) => {
      button.disabled = model.phase !== 'connect' || model.connected[i];
      button.textContent = model.connected[i] ? `Cable ${LABELS[i]} conectado ✓` : `Conectar cable ${LABELS[i]}`;
    });
    this.activateButton.disabled = model.phase !== 'ready';
    this.finishButton.hidden = !model.complete;
    this.discoverButton.hidden = model.phase !== 'discover';
    this.findMagnetButton.hidden = model.phase !== 'needMagnet';
    const magnetMessage = this.root.querySelector('#magnet-message');
    magnetMessage.hidden = model.phase !== 'needMagnet';
    magnetMessage.textContent = model.wornMagnet
      ? 'VEGA: El electroimán se desgastó al limpiar. Busca otro detrás de una roca al sureste de la base, recógelo con E y vuelve al panel.'
      : 'VEGA: Para limpiar necesitas un electroimán. Búscalo junto a la base, recógelo con E y vuelve a este panel.';
    this.root.querySelector('#completion-card').hidden = !model.complete;
    this.discoveryMessage.hidden = model.phase !== 'discover';
    if (model.phase === 'discover') {
      const messages = [
        'Toca el panel o usa el botón: descubre de dónde viene su energía.',
        'Un panel solar tiene celdas que transforman la luz del Sol en electricidad para la base.',
        'El polvo tapa algunas celdas y deja pasar menos luz. Ahora puedes comenzar la limpieza.',
      ];
      this.discoveryMessage.textContent = messages[model.discoveryStep];
      this.discoverButton.textContent = [
        'Mostrar luz del Sol',
        'Cubrir algunas celdas con polvo',
        this.hasMagnet ? 'Continuar: conectar A y B' : 'Continuar: buscar imán',
      ][model.discoveryStep];
    }
    const instruction = model.phase === 'discover'
      ? 'Paso 1/5 · Toca el panel o usa el botón para explorar.'
      : model.phase === 'needMagnet'
        ? model.wornMagnet
          ? 'Paso 2/5 · El imán está gastado. Busca el repuesto detrás de una roca y recógelo con E.'
          : 'Paso 2/5 · Busca el imán cerca de la base y pulsa E para recogerlo.'
      : model.phase === 'connect'
      ? `Fase 3/5 · Ya tienes el imán. Arrastra A a A y B a B. ${model.connected.filter(Boolean).length}/2 conectados.`
      : model.phase === 'ready'
        ? 'Fase 4/5 · Circuito listo. Pulsa «Activar haz» para iniciar la limpieza.'
        : model.phase === 'sweeping'
          ? `Fase 5/5 · Barrido automático: ${model.cleanCells}/${COLS * ROWS} zonas limpias (${model.progress}%).`
          : `¡Felicidades! Limpiaste ${COLS * ROWS}/${COLS * ROWS} zonas. Pulsa «Finalizar» para volver al mapa.`;
    const text = this.feedback && model.phase === 'connect' ? `${this.feedback} ${instruction}` : instruction;
    if (this.status.textContent !== text) this.status.textContent = text;
    this.root.querySelector('#progress-display').textContent =
      model.phase === 'discover' ? 'Explora el panel'
        : model.phase === 'needMagnet' ? model.wornMagnet ? 'Imán gastado' : 'Falta el imán'
          : `${model.cleanCells} / ${COLS * ROWS} zonas`;
    this.root.querySelector('#panel-name').textContent = this.panelName || 'Panel solar';
    this.canvas.setAttribute('aria-label', model.phase === 'discover'
      ? `Panel solar a la derecha: ${this.discoveryMessage.textContent} Toca el panel para avanzar.`
      : model.phase === 'needMagnet'
        ? model.wornMagnet
          ? 'El imán gastado está en el circuito; busca otro detrás de una roca al sureste de la base.'
          : 'El panel está cubierto de polvo; falta el electroimán. Sal a buscarlo junto a la base.'
        : 'Generador a la izquierda, un imán con tomas A y B en el centro: arrastra A hasta A y B hasta B.');
    this.root.dataset.phase = model.phase;
  }

  frame(now) {
    if (!this.opened) return;
    const dt = Math.min(Math.max((now - this.lastFrame) / 1000, 0), 0.1);
    this.lastFrame = now;
    const before = this.model.cleanCells;
    this.model.tick(dt);
    if (this.model.complete && !this.model.magnetSpent) this.onCompleted?.(this.model);
    if (before !== this.model.cleanCells) this.updateStatus();
    drawSpriteArt(this.ctx, this.sprites, this.model, this.reduceMotion ? 0 : now, this.dragging, this.pointer);
    requestAnimationFrame(time => this.frame(time));
  }
}
