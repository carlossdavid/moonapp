import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../config.js';
import { readSuitResources } from './ResourceHUD.js';

/**
 * Panel de inventario (UI independiente). Muestra recursos del traje si existen
 * y secciones preparadas para herramientas/consumibles sin inventar objetos.
 */
export const INVENTORY_CONFIG = {
  width: 220,
  height: 130,
  bg: 'rgba(12,16,22,0.94)',
  border: '#8fd3ff',
  text: '#eaf6ff',
  dim: '#b8c7d8',
  accent: '#56C9ED',
  warn: '#ff3b3b',
  fontTitle: '6px "Press Start 2P", monospace',
  font: '5px "Press Start 2P", monospace',
};

/**
 * Recolecta listas existentes (solo si ya están definidas en sistemas actuales).
 * @param {any} game
 * @param {any} scene
 */
function readExistingLists(game, scene) {
  const candidates = [game?.inventory, scene?.inventory, game?.player?.inventory, scene?.player?.inventory].filter(Boolean);
  const findList = (names) => {
    for (const c of candidates) {
      for (const n of names) {
        const v = c[n];
        if (Array.isArray(v)) return v;
      }
    }
    return null;
  };
  return {
    tools: findList(['tools', 'herramientas', 'equipment']),
    consumables: findList(['consumables', 'consumibles', 'items']),
  };
}

/**
 * @param {import('../graphics/Renderer.js').Renderer} renderer
 * @param {any} game
 * @param {any} scene
 * @param {Partial<typeof INVENTORY_CONFIG>} [cfgOverride]
 */
export function renderInventoryPanel(renderer, game, scene, cfgOverride = {}) {
  const c = { ...INVENTORY_CONFIG, ...cfgOverride };
  const ctx = renderer.context;
  const w = c.width;
  const h = c.height;
  const x = Math.floor((LOGICAL_WIDTH - w) / 2);
  const y = Math.floor((LOGICAL_HEIGHT - h) / 2);

  // Overlay + panel
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  ctx.fillStyle = c.bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Title
  ctx.font = c.fontTitle;
  ctx.fillStyle = c.text;
  ctx.fillText('INVENTARIO', x + 8, y + 8);
  ctx.font = c.font;
  ctx.fillStyle = c.dim;
  ctx.fillText('I: cerrar', x + w - 52, y + 9);

  let cy = y + 24;

  // Suit resources (read-only from existing systems)
  ctx.font = c.font;
  ctx.fillStyle = c.accent;
  ctx.fillText('RECURSOS DEL TRAJE', x + 8, cy);
  cy += 10;

  const res = readSuitResources(game, scene);
  if (!res.sourceFound) {
    ctx.fillStyle = c.dim;
    ctx.fillText('Sin datos de sistemas existentes', x + 10, cy);
    cy += 10;
  } else {
    const drawRes = (label, val, color) => {
      if (!val) return;
      const warn = val.ratio < 0.2;
      ctx.fillStyle = warn ? c.warn : c.text;
      ctx.fillText(`${label}: ${val.percent}%`, x + 10, cy);
      cy += 9;
    };
    drawRes('Oxigeno', res.oxygen, c.accent);
    drawRes('Bateria', res.battery, '#F7B955');
    cy += 2;
  }

  // Sections prepared (no invented items)
  ctx.fillStyle = c.accent;
  ctx.fillText('HERRAMIENTAS', x + 8, cy);
  cy += 9;
  const lists = readExistingLists(game, scene);
  ctx.fillStyle = c.dim;
  if (lists.tools && lists.tools.length > 0) {
    for (const it of lists.tools.slice(0, 3)) ctx.fillText(`- ${String(it?.name ?? it)}`, x + 10, cy), (cy += 8);
  } else {
    ctx.fillText('(sin datos / pendiente)', x + 10, cy);
    cy += 9;
  }

  cy += 2;
  ctx.fillStyle = c.accent;
  ctx.fillText('CONSUMIBLES', x + 8, cy);
  cy += 9;
  ctx.fillStyle = c.dim;
  if (lists.consumables && lists.consumables.length > 0) {
    for (const it of lists.consumables.slice(0, 3)) ctx.fillText(`- ${String(it?.name ?? it)}`, x + 10, cy), (cy += 8);
  } else {
    ctx.fillText('(sin datos / pendiente)', x + 10, cy);
  }

  ctx.restore();
}
