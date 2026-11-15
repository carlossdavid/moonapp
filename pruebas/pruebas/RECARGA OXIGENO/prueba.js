/**
 * Punto de entrada de la prueba aislada "RECARGA OXÍGENO".
 *
 * Crea una única instancia de Game con RecargaOxigenoScene y arranca
 * directamente en modo playing (sin menú).
 *
 * Convención: no modifica moonapp/main.js ni moonapp/index.html.
 */

import { Game } from '../../src/core/Game.js';
import { RecargaOxigenoPruebaScene } from './RecargaOxigenoPruebaScene.js';
import { FASE, ESTADO_LINEA } from '../../src/minigames/RecargaOxigeno.js';

async function bootstrapPrueba() {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas #game no encontrado');
  }

  const game = new Game(canvas);
  const statusEl = document.getElementById('mobile-status');
  const buttons = {
    o2: document.getElementById('mobile-o2'),
    co2: document.getElementById('mobile-co2'),
  };
  const mostrarEstado = (mg) => {
    if (!mg) return;
    const valves = mg.valves;
    const estado = mg.fase === FASE.CONECTANDO
      ? mg.hayFuga ? 'Puerto equivocado. Une cada color con el suyo.'
        : 'Conecta O2 al azul y CO2 al verde.'
      : mg.fase === FASE.AUTORIZADO ? 'Conexiones listas. Ahora gira las válvulas.'
        : mg.fase === FASE.VALVULAS ? 'Cierra ambas válvulas: dos vueltas por cada una.'
          : '¡Recarga completada en esta prueba!';
    if (statusEl.textContent !== estado) statusEl.textContent = estado;
    for (const [id, button] of Object.entries(buttons)) {
      const line = mg.lines.find(item => item.id === id);
      const valve = valves.find(item => item.id === id);
      const conectando = mg.fase === FASE.CONECTANDO;
      const girando = mg.fase === FASE.VALVULAS;
      button.disabled = conectando
        ? line.estado === ESTADO_LINEA.CONECTADO || !!line.animacion
        : !girando || valve.turned >= valve.objetivo - 1e-6;
      button.textContent = conectando
        ? line.estado === ESTADO_LINEA.CONECTADO ? `${id.toUpperCase()} conectado` : `Conectar ${id.toUpperCase()}`
        : girando ? `Girar ${id.toUpperCase()} (${Math.min(2, Math.ceil(valve.turned / (Math.PI * 2)))}/2)`
          : mg.fase === FASE.COMPLETADO ? `${id.toUpperCase()} listo` : 'Espera…';
    }
  };

  // El manifiesto compartido está en conflicto: la escena aislada carga
  // directamente los PNG originales sin editar archivos de P1.
  const scene = new RecargaOxigenoPruebaScene(game, {
    onComplete: (mg) => {
      console.log('[Prueba] Recarga completada', mg.getSnapshot());
    },
    onCancel: (mg) => {
      console.log('[Prueba] Recarga cancelada');
    },
    onStatus: mostrarEstado,
  });
  for (const [id, button] of Object.entries(buttons)) {
    button.addEventListener('click', () => {
      const mg = scene.minigame;
      if (mg.fase === FASE.CONECTANDO) mg.conectarLinea(id);
      else if (mg.fase === FASE.VALVULAS) mg.girarValvula(id);
      mostrarEstado(mg);
    });
  }

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
  mostrarEstado(scene.minigame);
  window.recargaOxigenoPrueba = { game, scene };
}

bootstrapPrueba();
