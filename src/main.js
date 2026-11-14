import { Game } from './core/Game.js';
import { SpriteSheet } from './graphics/SpriteSheet.js';
import { Animation } from './graphics/Animation.js';
import { Sprite } from './graphics/Sprite.js';
import { Player } from './entities/Player.js';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './config.js';

/**
 * Generate an animated placeholder spritesheet for the player.
 * Layout: 4 columns (frames) x 6 rows, each 16x24.
 * Rows: 0 idle-down, 1 walk-down, 2 idle-up, 3 walk-up, 4 idle-side, 5 walk-side.
 * @returns {HTMLCanvasElement}
 */
function createPlayerSheet() {
  const fw = 16;
  const fh = 24;
  const cols = 4;
  const rows = 6;
  const c = document.createElement('canvas');
  c.width = fw * cols;
  c.height = fh * rows;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const rowColors = ['#4aa3df', '#4aa3df', '#5adf4a', '#5adf4a', '#dfaa4a', '#dfaa4a'];
  const drawChar = (x, y, body, dir, bob) => {
    const by = y + bob;
    // body
    ctx.fillStyle = body;
    ctx.fillRect(x + 3, by + 8, 10, 12);
    // head
    ctx.fillStyle = '#ffd4a3';
    ctx.fillRect(x + 4, by + 2, 8, 7);
    // eyes depending on direction
    ctx.fillStyle = '#222';
    if (dir === 'down') {
      ctx.fillRect(x + 5, by + 5, 2, 1);
      ctx.fillRect(x + 9, by + 5, 2, 1);
    } else if (dir === 'up') {
      ctx.fillRect(x + 5, by + 3, 2, 1);
      ctx.fillRect(x + 9, by + 3, 2, 1);
    } else {
      // side (facing right in sheet, flipped for left)
      ctx.fillRect(x + 9, by + 5, 2, 1);
      ctx.fillRect(x + 7, by + 5, 1, 1);
    }
    // feet
    ctx.fillStyle = '#2d2d2d';
    const step = bob === 0 ? 0 : 1;
    ctx.fillRect(x + 4, by + 20 - step, 3, 3);
    ctx.fillRect(x + 9, by + 20 + step - 1, 3, 3);
    // direction marker (back/side hair hint)
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    if (dir === 'up') ctx.fillRect(x + 4, by + 2, 8, 2);
  };

  const dirByRow = ['down', 'down', 'up', 'up', 'side', 'side'];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = col * fw;
      const y = r * fh;
      const isWalk = r % 2 === 1;
      const bob = isWalk ? (col % 2 === 0 ? 0 : -1) : (col === 1 || col === 3 ? -1 : 0);
      drawChar(x, y, rowColors[r], dirByRow[r], bob);
    }
  }
  return c;
}

/**
 * @param {HTMLCanvasElement} sheetImage
 * @returns {Sprite}
 */
function createPlayerSprite(sheetImage) {
  const sheet = new SpriteSheet(sheetImage, 16, 24, { columns: 4 });
  const sprite = new Sprite(sheet);
  sprite.originX = 0.5;
  sprite.originY = 1;

  const def = (name, row, fps, loop = true) => {
    const base = row * 4;
    sprite.addAnimation(name, new Animation({ name, frames: [base, base + 1, base + 2, base + 3], fps, loop }));
  };
  def('idle-down', 0, 4, true);
  def('walk-down', 1, 8, true);
  def('idle-up', 2, 4, true);
  def('walk-up', 3, 8, true);
  def('idle-side', 4, 4, true);
  def('walk-side', 5, 8, true);
  sprite.play('idle-down', true);
  return sprite;
}

async function bootstrap() {
  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas #game no encontrado');
  }

  const game = new Game(canvas);
  const loadingEl = document.getElementById('loading');
  try {
    await game.init();
    // Phase 2 assets: animated player placeholder
    if (!game.assets.has('player')) {
      game.assets.set('player', createPlayerSheet());
    }
    if (!game.assets.has('placeholder')) {
      game.assets.set('placeholder', createPlayerSheet());
    }

    const playerSprite = createPlayerSprite(game.assets.get('player'));
    const player = new Player({
      x: Math.floor(LOGICAL_WIDTH / 2),
      y: Math.floor(LOGICAL_HEIGHT / 2),
      sprite: playerSprite,
    });
    game.player = player;

    if (loadingEl) loadingEl.textContent = 'Listo';
  } catch (err) {
    console.error(err);
    if (loadingEl) loadingEl.textContent = `Error: ${err.message}`;
    return;
  }

  game.start();
}

bootstrap();
