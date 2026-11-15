import { IntegratedGame } from './resources.js';
import { FinalExterior } from './scenes.js';
import { mountActivities } from './activities.js';
import { mountVisor } from './visor.js';
import { SolarProgress } from '../pruebas/limpieza-panel/solarProgress.js';
import { FASE } from '../src/minigames/RecargaOxigeno.js';
import { startWeather } from './weather.js';
import { MissionMessages } from './messages.js';
import { localizeDocument, translate } from './i18n.js';

const extraImages = {
  final_station: 'assets/Sprites/Estructuras exteriores/EstaciónLunar.png',
  final_green: 'assets/Sprites/Estructuras exteriores/01_base_nueva.png',
  final_yellow: 'assets/Sprites/Estructuras exteriores/01_base_nueva_amarilla.png',
  base_interior: 'assets/Sprites/estructuras_interiores/BaseLunarGrandeInterior.png',
  final_room_main: 'assets/Sprites/estructuras_interiores/BaseLunarGrandeInterior.png',
  final_room_clear: 'pruebas/CambioDeModo/ModosDeEstacion/EstaciónLunarGrandeClaro.png',
  final_room_saving: 'pruebas/CambioDeModo/ModosDeEstacion/EstaciónLunarGrandeAhorro.png',
  final_room_dark: 'pruebas/CambioDeModo/ModosDeEstacion/EstaciónLunarGrandeOscuro.png',
  final_room_small: 'pruebas/CambioDeModo/ModosDeEstacion/EstaciónLunarPequeñaOscura.png',
  astro_dead_1: 'assets/Sprites/Astronauta/dead_1.png',
  astro_dead_2: 'assets/Sprites/Astronauta/dead_2.png',
  astro_dead_3: 'assets/Sprites/Astronauta/dead_3.png',
  astro_dead_4: 'assets/Sprites/Astronauta/dead_4.png',
  astro_dead_5: 'assets/Sprites/Astronauta/dead_5.png',
  pantalla_fallo: 'assets/Sprites/Astronauta/Pantalla_fallo.png',
  boton_reintentar: 'assets/Sprites/Astronauta/boton_reintentar.png',
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
  localizeDocument(document, game.language);
  if (game.language === 'en') {
    document.title = 'Entropy Zero · Integrated system';
    document.body.classList.add('language-en');
    document.getElementById('death-screen-img').src =
      'assets/Sprites/Astronauta/Pantalla_Fallo_Ingles.png';
    const consoleFrame = document.querySelector('#monitor-content .console-frame');
    for (const [label, top] of [
      ['DONKI CONTROL CENTER · JANUARY 2026', '15%'],
      ['FLR M/X', '31.3%'], ['CME ≥1000 km/s', '39.8%'],
      ['Terrestrial GST', '48.3%'], ['FLR → filtered CME', '56.7%'],
      ['CME → SEP', '65.1%'],
    ]) {
      const row = document.createElement('span');
      row.className = 'english-console-label';
      row.textContent = label;
      row.style.top = top;
      consoleFrame.append(row);
    }
    // Los mensajes de VEGA son imágenes con texto en español, no texto editable.
    ui.disableArtMessages = true;
  }
  const settings = document.getElementById('settings');
  const language = document.getElementById('language-setting');
  const collisions = document.getElementById('collision-setting');
  ui.settingsOpen = false;
  ui.openSettings = () => {
    if (game.state !== 'menu' || ui.settingsOpen) return;
    ui.settingsOpen = true;
    settings.hidden = false;
    language.value = game.language;
    collisions.checked = game.collisionsEnabled;
    language.focus();
  };
  function closeSettings() { settings.hidden = true; ui.settingsOpen = false; game.input.update(); }
  document.getElementById('settings-close').onclick = closeSettings;
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && ui.settingsOpen) { e.preventDefault(); closeSettings(); }
  });
  language.onchange = () => {
    sessionStorage.setItem('final-language', language.value);
    location.reload();
  };
  collisions.onchange = () => {
    game.collisionsEnabled = collisions.checked;
    localStorage.setItem('final-collisions', String(collisions.checked));
    document.getElementById('collision-label').textContent = collisions.checked
      ? (game.language === 'en' ? 'Collisions on' : 'Colisiones activadas')
      : (game.language === 'en' ? 'Collisions off' : 'Colisiones desactivadas');
  };
  collisions.checked = game.collisionsEnabled;
  collisions.onchange();
  document.getElementById('restart-mission').onclick = () => location.reload();
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
    for (let i = 0; i <= 10; i++) {
      images.push({ key: `final_life_${i}`, src: `assets/Sprites/Pantalla/niveles/vida/vida_${String(i).padStart(2, '0')}.png` });
    }
    for (const id of ['Bienvenida', 'movimiento', 'paneles', 'energia', 'recarga_oxigeno', 'agua_comida']) {
      images.push({ key: `final_message_${id}`, src: encodeURI(`assets/Sprites/diseño_ia/Mensajes/${id}.png`) });
    }
    game.assets._manifestImages = images;
  };
  // Un adaptador local reutiliza el modelo original con intervalos rAF seguros.
  window.finalSystem.weather = await startWeather(game);
  game.setScene(new FinalExterior(game, { spawnX: 285, spawnY: 198 }));
  await game.init();
  game.messages = new MissionMessages(document.getElementById('vega-message'), game.assets);
  game.impacts.motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    document.getElementById('location-label').textContent = translate(game.scene?.station?.name
      ?? (game.scene?.isRecarga ? 'RECARGA INTEGRAL DEL TRAJE' : 'SUPERFICIE LUNAR · SISTEMA INTEGRADO'), game.language);
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
