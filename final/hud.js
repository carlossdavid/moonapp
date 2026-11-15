import { LOGICAL_HEIGHT } from '../src/config.js';
import { batteryLevel } from '../pruebas/Hud_bateria/BatteryHUD.js';

export function drawMissionHUD(renderer, assets, { suit, food, water, oxygen, health }) {
  const ctx = renderer.context, x = 10, y = LOGICAL_HEIGHT - 50, w = 84, h = 44;
  const key = (name, value) => `${name}_nivel_${String(batteryLevel(value)).padStart(2, '0')}_t`;
  const rows = [
    ['COMIDA', key('comida', food), food <= 20],
    ['AGUA', key('agua', water.percent), water.percent <= 20],
    ['BATERIA', key('bateria', suit.porcentaje), suit.porcentaje <= 20],
    ['OXIGENO', key('oxigeno', oxygen.porcentaje), oxygen.porcentaje <= 20],
    ['VIDA', `final_life_${batteryLevel(health)}`, health < 100],
  ];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0a1429ed'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#a7bddd'; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.strokeStyle = '#47648f'; ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  ctx.fillStyle = '#64e4ee'; ctx.fillRect(x, y + 4, 1, 8);
  ctx.font = '3px "Press Start 2P",monospace'; ctx.textBaseline = 'top';
  rows.forEach(([label, imageKey, warning], index) => {
    const image = assets.get(imageKey), rowY = y + 3 + index * 8;
    if (image) {
      const split = label === 'VIDA' ? Math.round(image.width * .19) : 48;
      ctx.drawImage(image, 0, 0, split, image.height, x + 4, rowY, 7, 7);
      ctx.drawImage(image, split, 0, image.width - split, image.height, x + 43, rowY, 37, 7);
    }
    ctx.fillStyle = warning ? '#ff9d98' : '#e3f0ff';
    ctx.fillText(label, x + 14, rowY + 2);
  });
  ctx.restore();
}
