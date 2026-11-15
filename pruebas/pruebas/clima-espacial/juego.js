import { Game } from '../../src/core/Game.js';
import { InteriorBaseScene } from '../../src/scenes/InteriorBaseScene.js';
import { DemoScene } from '../../src/scenes/DemoScene.js';

const panel = document.getElementById('monitor-content');
const close = document.getElementById('close-monitor');
const open = document.getElementById('open-monitor');
let previousFocus;
function openConsole() {
  previousFocus = document.activeElement;
  if (panel.hidden) open.click();
  close.focus();
}
function closeConsole() {
  if (!panel.hidden) close.click();
  previousFocus?.focus?.();
}
window.addEventListener('keydown', event => {
  if (panel.hidden) return;
  if (event.code === 'Escape') {
    event.preventDefault();
    closeConsole();
  } else if (event.code === 'Tab') {
    const buttons = [close, document.getElementById('test-alert')];
    event.preventDefault();
    buttons[(buttons.indexOf(document.activeElement) + 1) % buttons.length].focus();
  }
}, true);

// La clase compartida no cambia: solo esta entrada sustituye la acción
// de la consola. Se aplica también al volver a entrar desde el exterior.
class TestInterior extends InteriorBaseScene {
  async init() {
    await super.init();
    for (const zone of this.interactables) {
      if (zone.name === 'CONSOLA DE CONTROL') zone.onConfirm = openConsole;
    }
  }
  update(dt) {
    if (!panel.hidden) {
      this.player?.body?.velocity?.set?.(0, 0);
      return;
    }
    super.update(dt);
  }
}

const loading = document.getElementById('loading');
const game = new Game(document.getElementById('game'));
const changeScene = game.changeScene.bind(game);
game.changeScene = next => changeScene(
  next instanceof InteriorBaseScene && !(next instanceof TestInterior)
    ? new TestInterior(game, next.opts)
    : next
);
function interior() {
  return new TestInterior(game, {
    onExit: async () => {
      const exterior = new DemoScene(game, { spawnX: 292, spawnY: 210 });
      await game.changeScene(exterior);
    },
  });
}
// Punto de inspección únicamente de la prueba.
window.climaTest = { game, openConsole };
try {
  game.setScene(interior());
  await game.init();
  game.start();
} catch (error) {
  loading.classList.remove('hidden');
  loading.textContent = `No se pudo cargar el juego: ${error.message}`;
  console.error(error);
}
