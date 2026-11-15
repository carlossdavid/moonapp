import { Game } from '../../src/core/Game.js';
import { DemoScene } from '../../src/scenes/DemoScene.js';
import { InteriorBaseScene } from '../../src/scenes/InteriorBaseScene.js';

/**
 * Compatibilidad SOLO de estas páginas de prueba: el manifiesto compartido
 * tiene un conflicto sin resolver justo entre dos listas de sprites.
 * Se incluyen ambas listas sin modificar el archivo ni descartar imágenes.
 * Al resolver el conflicto en el repositorio, JSON.parse normal basta.
 */
export function parseTestManifest(source) {
  try {
    return JSON.parse(source);
  } catch (originalError) {
    const starts = source.match(/^<<<<<<< HEAD\r?$/gm) ?? [];
    const splits = source.match(/^=======\r?$/gm) ?? [];
    const ends = source.match(/^>>>>>>> [^\r\n]+\r?$/gm) ?? [];
    if (starts.length !== 1 || splits.length !== 1 || ends.length !== 1) throw originalError;
    const merged = source
      .replace(/^<<<<<<< HEAD\r?\n/m, '')
      .replace(/^=======\r?\n/m, '    },\n    {\n')
      .replace(/^>>>>>>> [^\r\n]+\r?\n/m, '');
    const manifest = JSON.parse(merged);
    if (!Array.isArray(manifest.images)) throw new Error('Lista de imágenes incompleta');
    return manifest;
  }
}

const canvas = document.querySelector('#game');
const loading = document.querySelector('#loading');
const game = new Game(canvas);
game.assets.loadManifest = async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar el manifiesto (${response.status})`);
  const manifest = parseTestManifest(await response.text());
  game.assets._manifestImages = manifest.images;
};

try {
  game.setScene(new InteriorBaseScene(game, {
    spawnX: undefined,
    spawnY: undefined,
    onExit: async () => {
      await game.changeScene(new DemoScene(game, { spawnX: 292, spawnY: 210 }));
    },
  }));
  await game.init();
  // Game.init tolera fallos del manifiesto. En esta prueba los sprites son
  // imprescindibles: no mostrar un menú negro como si hubiese cargado bien.
  if (!game.assets.has('menu_bg') || !game.assets.has('mapa_bg')) {
    throw new Error('No se cargaron los fondos del juego');
  }
  if (loading) loading.textContent = 'Listo';
  game.start();
} catch (error) {
  console.error(error);
  if (loading) loading.textContent = `Error al cargar imágenes: ${error.message}`;
}
