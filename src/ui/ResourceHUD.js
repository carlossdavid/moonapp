import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../config.js';

/**
 * HUD de recursos del traje (solo visualización).
 * Lee valores reales de sistemas existentes si están disponibles; no crea contadores.
 */
export const RESOURCE_HUD_CONFIG = {
  x: 6,
  y: 6,
  width: 128,
  rowHeight: 22,
  gap: 4,
  padding: 4,
  barHeight: 6,
  iconSize: 8,
  bg: 'rgba(10,14,20,0.62)',
  border: 'rgba(230,240,255,0.45)',
  text: '#eaf6ff',
  oxygenColor: '#56C9ED',
  batteryColor: '#F7B955',
  warnColor: '#ff3b3b',
  warnThreshold: 0.2,
  fontLabel: '5px "Press Start 2P", monospace',
  fontPct: '5px "Press Start 2P", monospace',
};

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function readResource(obj, names) {
  if (!obj || typeof obj !== 'object') return null;
  for (const name of names) {
    const v = obj[name];
    if (v == null) continue;
    if (typeof v === 'number' && Number.isFinite(v)) {
      // interpret as percent 0-100 or ratio 0-1
      const ratio = v > 1 ? v / 100 : v;
      return { current: v, max: v > 1 ? 100 : 1, ratio: clamp01(ratio) };
    }
    if (typeof v === 'object') {
      const cur = v.current ?? v.value ?? v.level ?? v.amount;
      const max = v.max ?? v.maximum ?? v.capacity ?? (v.percent != null ? 100 : 1);
      if (Number.isFinite(cur)) {
        const m = Number.isFinite(max) && max > 0 ? max : (cur > 1 ? 100 : 1);
        const ratio = v.percent != null ? clamp01(Number(v.percent) / 100) : clamp01(cur / m);
        return { current: cur, max: m, ratio };
      }
    }
  }
  return null;
}

/**
 * Busca sistemas existentes de oxígeno y batería del traje sin inventar valores.
 * @param {any} game
 * @param {any} scene
 * @returns {{ oxygen: {ratio:number, percent:number}|null, battery: {ratio:number, percent:number}|null, sourceFound: boolean }}
 */
export function readSuitResources(game, scene) {
  const candidates = [
    game?.suit,
    game?.suitSystems,
    game?.resources?.suit,
    game?.resources,
    game?.astronaut?.suit,
    scene?.suit,
    scene?.suitSystems,
    scene?.resources?.suit,
    scene?.resources,
    game?.player?.suit,
    scene?.player?.suit,
  ].filter(Boolean);

  let oxygen = null;
  let battery = null;
  for (const c of candidates) {
    if (!oxygen) oxygen = readResource(c, ['oxygen', 'o2', 'oxigeno', 'oxígeno']);
    if (!battery) battery = readResource(c, ['battery', 'bateria', 'batería', 'power', 'energy', 'suitBattery']);
    if (oxygen && battery) break;
  }
  // direct fallbacks
  if (!oxygen) oxygen = readResource(game?.player, ['oxygen', 'o2']) || readResource(scene?.player, ['oxygen', 'o2']);
  if (!battery) battery = readResource(game?.player, ['battery', 'bateria', 'power']) || readResource(scene?.player, ['battery', 'bateria', 'power']);

  const norm = (r) => (r ? { ratio: r.ratio, percent: Math.round(r.ratio * 100) } : null);
  return { oxygen: norm(oxygen), battery: norm(battery), sourceFound: !!(oxygen || battery) };
}

/**
 * Determina si el HUD de recursos debe mostrarse según contexto/escena.
 * Exterior: mostrar mientras explora. Interior: respetar reglas existentes (no asumir recarga);
 * se muestra si hay datos disponibles (lectura pasiva).
 * @param {any} scene
 * @returns {boolean}
 */
export function shouldShowResourceHUD(scene) {
  if (!scene) return false;
  if (scene.isExterior === true) return true;
  if (scene.isInterior === true) return true; // lectura pasiva, sin alterar consumo/recarga
  // Heurística por tipo de escena conocida
  const name = scene.constructor?.name || '';
  if (name === 'DemoScene' || /Exterior/i.test(name)) return true;
  if (name === 'InteriorBaseScene' || /Interior/i.test(name)) return true;
  return false;
}

function drawPixelIcon(ctx, type, x, y, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  if (type === 'oxygen') {
    // simple O2 droplet/bubble pixel icon
    ctx.fillRect(x + 2, y, 4, 2);
    ctx.fillRect(x + 1, y + 2, 6, 3);
    ctx.fillRect(x + 2, y + 5, 4, 2);
    ctx.fillRect(x + 3, y + 7, 2, 1);
  } else {
    // battery icon
    ctx.fillRect(x, y + 1, 7, 6);
    ctx.fillRect(x + 7, y + 3, 1, 2);
    ctx.clearRect(x + 1, y + 2, 5, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 2, 5, 4);
  }
  ctx.restore();
}

/**
 * Renderiza el HUD de recursos (pantalla/UI).
 * @param {import('../graphics/Renderer.js').Renderer} renderer
 * @param {{ oxygen: {ratio:number,percent:number}|null, battery: {ratio:number,percent:number}|null }} data
 * @param {Partial<typeof RESOURCE_HUD_CONFIG>} [cfgOverride]
 * @returns {{ height:number }} altura ocupada
 */
export function renderResourceHUD(renderer, data, cfgOverride = {}) {
  const c = { ...RESOURCE_HUD_CONFIG, ...cfgOverride };
  const rows = [
    { key: 'oxygen', label: 'OXIGENO', color: c.oxygenColor, value: data.oxygen },
    { key: 'battery', label: 'BATERIA', color: c.batteryColor, value: data.battery },
  ].filter((r) => r.value != null);
  if (rows.length === 0) return { height: 0 };

  const ctx = renderer.context;
  const boxW = c.width;
  const boxH = c.padding * 2 + rows.length * c.rowHeight + (rows.length - 1) * c.gap;
  const x = c.x;
  const y = c.y;

  // Panel background
  ctx.save();
  ctx.fillStyle = c.bg;
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);

  let ry = y + c.padding;
  for (const row of rows) {
    const pct = row.value.percent;
    const ratio = row.value.ratio;
    const warn = ratio < c.warnThreshold;
    const fillColor = warn ? c.warnColor : row.color;

    // Icon
    drawPixelIcon(ctx, row.key, x + c.padding, ry + 1, c.iconSize, fillColor);

    // Label and percent
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = c.fontLabel;
    ctx.fillStyle = warn ? c.warnColor : c.text;
    ctx.fillText(row.label, x + c.padding + c.iconSize + 4, ry);
    ctx.textAlign = 'right';
    ctx.font = c.fontPct;
    ctx.fillText(`${pct}%`, x + boxW - c.padding, ry);

    // Bar background
    const barX = x + c.padding;
    const barY = ry + 12;
    const barW = boxW - c.padding * 2;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(barX, barY, barW, c.barHeight);
    // Bar fill (pixel-stepped feel)
    ctx.fillStyle = fillColor;
    const fillW = Math.max(0, Math.round(barW * ratio));
    ctx.fillRect(barX, barY, fillW, c.barHeight);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, c.barHeight - 1);

    ry += c.rowHeight + c.gap;
  }

  // Reset alignment
  ctx.textAlign = 'left';
  ctx.restore();
  return { height: boxH };
}
