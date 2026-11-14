import { Game } from './core/Game.js';
import { DemoScene } from './scenes/DemoScene.js';
import { InteriorBaseScene } from './scenes/InteriorBaseScene.js';

async function bootstrap() {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas #game no encontrado');
  }

  const game = new Game(canvas);
  const loadingEl = document.getElementById('loading');
  try {
    // Nivel 0: iniciar dentro de la base
    const scene = new InteriorBaseScene(game, {
      spawnX: undefined,
      spawnY: undefined,
      onExit: async () => {
        // Salir al exterior
        const exterior = new DemoScene(game, { spawnX: 292, spawnY: 210 });
        await game.changeScene(exterior);
      },
    });
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
