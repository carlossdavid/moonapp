/**
 * Punto de entrada de la prueba aislada "RECARGA OXÍGENO".
 *
 * Crea una única instancia de Game con RecargaOxigenoScene y arranca
 * directamente en modo playing (sin menú).
 *
 * Convención: no modifica moonapp/main.js ni moonapp/index.html.
 */

import { Game } from '../../src/core/Game.js';
import { RecargaOxigenoScene } from '../../src/scenes/RecargaOxigenoScene.js';

async function bootstrapPrueba() {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas #game no encontrado');
  }

  const game = new Game(canvas);

  // Creamos la escena del minijuego y la asignamos ANTES de init()
  // para que Game.init() la inicialice.
  const scene = new RecargaOxigenoScene(game, {
    // Opcional: vueltas por válvula (por defecto 1)
    // valvulasNecesarias: 1,
    onComplete: (mg) => {
      console.log('[Prueba] Recarga completada', mg.getSnapshot());
    },
    onCancel: (mg) => {
      console.log('[Prueba] Recarga cancelada');
    },
  });

  game.setScene(scene);

  const loadingEl = document.getElementById('loading');
  try {
    await game.init();
    if (loadingEl) loadingEl.textContent = 'Listo';
  } catch (err) {
    console.error(err);
    if (loadingEl) loadingEl.textContent = `Error: ${err.message}`;
    return;
  }

  // Arranca el bucle y salta directamente a playing (sin menú).
  game.start();
  game.beginPlay();
}

bootstrapPrueba();
