import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../config.js';

/**
 * Ventana modal reutilizable "COMING SOON".
 */
export function renderComingSoonModal(renderer, modal) {
  if (!modal) return;
  const ctx = renderer.context;
  const w = 200;
  const h = 90;
  const x = Math.floor((LOGICAL_WIDTH - w) / 2);
  const y = Math.floor((LOGICAL_HEIGHT - h) / 2);

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  // Fondo azul oscuro
  ctx.fillStyle = '#1a1f3a';
  ctx.fillRect(x, y, w, h);
  // Borde violeta
  ctx.strokeStyle = '#7b5cff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  // Detalle cian
  ctx.fillStyle = '#56C9ED';
  ctx.fillRect(x + 8, y + 8, 24, 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = '#f5f0dc'; // crema
  ctx.fillText(modal.title || 'SISTEMA', x + 8, y + 14);
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.fillStyle = '#56C9ED';
  ctx.fillText('COMING SOON', x + 8, y + 26);
  // descripción (wrap simple por líneas cortas)
  ctx.fillStyle = '#f5f0dc';
  const desc = modal.description || '';
  const maxChars = 28;
  let dy = y + 40;
  for (let i = 0; i < desc.length; i += maxChars) {
    ctx.fillText(desc.slice(i, i + maxChars), x + 8, dy);
    dy += 10;
    if (dy > y + h - 24) break;
  }
  // botón cerrar
  const bw = 60, bh = 14;
  const bx = x + w - bw - 8;
  const by = y + h - bh - 6;
  ctx.fillStyle = '#3c78aa';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.fillText(modal.button || 'CERRAR', bx + bw / 2, by + bh / 2 + 1);
  ctx.restore();
}
