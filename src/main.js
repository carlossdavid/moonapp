import { Game } from './core/Game.js';
import { DemoScene } from './scenes/DemoScene.js';

async function bootstrap() {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas #game no encontrado');
  }

  const game = new Game(canvas);
  const loadingEl = document.getElementById('loading');
  try {
    const scene = new DemoScene(game);
    game.setScene(scene);
    await game.init();
    if (loadingEl) loadingEl.textContent = 'Listo';
  } catch (err) {
    console.error(err);
    if (loadingEl) loadingEl.textContent = `Error: ${err.message}`;
    return;
  }

  game.start();
}

bootstrap();
