import { IntegratedGame } from './resources.js';
import { FinalExterior } from './scenes.js';
import { mountActivities } from './activities.js';
import { mountVisor } from './visor.js';
import { SolarProgress } from '../pruebas/limpieza-panel/solarProgress.js';
import { FASE } from '../src/minigames/RecargaOxigeno.js';
import { startWeather } from './weather.js';

const extraImages = {
  final_station: 'assets/Sprites/Estructuras exteriores/EstaciónLunar.png',
  final_green: 'assets/Sprites/Estructuras exteriores/01_base_nueva.png',
  final_yellow: 'assets/Sprites/Estructuras exteriores/01_base_nueva_amarilla.png',
  base_interior: 'assets/Sprites/estructuras_interiores/BaseLunarGrandeInterior.png',
  final_room_main: 'assets/Sprites/estructuras_interiores/BaseLunarGrandeInterior.png',
  final_room_clear: 'pruebas/CambioDeModo/ModosDeEstacion/EstaciónLunarGrandeClaro.png',
  final_room_saving: 'pruebas/CambioDeModo/ModosDeEstacion/EstaciónLunarGrandeAhorro.png',
  final_room_dark: 'pruebas/CambioDeModo/ModosDeEstacion/EstaciónLunarGrandeOscuro.png',
};

async function start() {
  const ui = await mountActivities();
  const solar = {
    progress: new SolarProgress(), panelModels: new Map(),
    magnetQuest: false, hasMagnet: false, cleaningsCompleted: 0,
  };
  const game = new IntegratedGame(document.getElementById('game'), ui, solar);
  game.interiors = new Map();
  ui.game = game;
  mountVisor(ui);
  // Contrato público de inspección de esta entrada; no se instala en originales.
  window.finalSystem = { game, ui, solar };
  game.assets.loadManifest = async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Manifiesto no disponible: ${response.status}`);
    const manifest = await response.json();
    // Las rutas antiguas de modos no existen: se sustituyen solo en memoria.
    const images = manifest.images.filter(item => !item.key.startsWith('base_modo_') && !extraImages[item.key]);
    for (const [key, src] of Object.entries(extraImages)) images.push({ key, src: encodeURI(src) });
    for (const resource of ['comida', 'agua']) {
      for (let i = 0; i <= 10; i++) {
        const key = `${resource}_nivel_${String(i).padStart(2, '0')}_t`;
        images.push({ key, src: `assets/Sprites/Pantalla/niveles/${resource}/${key}.png` });
      }
    }
    game.assets._manifestImages = images;
  };
  // Un adaptador local reutiliza el modelo original con intervalos rAF seguros.
  window.finalSystem.weather = await startWeather(game);
  game.setScene(new FinalExterior(game, { spawnX: 285, spawnY: 198 }));
  await game.init();
  for (const key of ['menu_bg', 'mapa_bg', ...Object.keys(extraImages)]) {
    if (!game.assets.has(key)) throw new Error(`No se cargó ${key}`);
  }
  for (const id of ['o2', 'co2']) {
    document.getElementById(`recarga-${id}`).addEventListener('click', () => {
      const mg = game.scene?.minigame;
      if (!game.scene?.isRecarga || !mg) return;
      if (mg.fase === FASE.CONECTANDO) mg.conectarLinea(id);
      else if (mg.fase === FASE.VALVULAS) mg.girarValvula(id);
    });
  }
  document.getElementById('recarga-exit').addEventListener('click', () => game.scene?.minigame?.onCancel?.());
  // El cambio de escena desmonta eventos de recarga y oculta su barra auxiliar.
  const changeScene = game.changeScene.bind(game);
  game.changeScene = async next => {
    document.getElementById('recarga-tools').hidden = true;
    await changeScene(next);
    updateLocation();
  };
  function updateLocation() {
    document.getElementById('location-label').textContent = game.scene?.station?.name
      ?? (game.scene?.isRecarga ? 'RECARGA DE OXÍGENO' : 'SUPERFICIE LUNAR · SISTEMA INTEGRADO');
  }
  updateLocation();
  game.start();
}

start().catch(error => {
  console.error(error);
  const loading = document.getElementById('loading');
  loading.classList.remove('hidden');
  loading.textContent = `No se pudo iniciar: ${error.message}`;
});
