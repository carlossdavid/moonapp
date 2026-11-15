import { LOGICAL_HEIGHT } from '../../src/config.js';

// Referencia 1600×900 a resolución lógica 320×180: panel x≈10..90, y≈139..174.
export const BATTERY_HUD_BOUNDS = Object.freeze({ x: 10, y: LOGICAL_HEIGHT - 41, width: 80, height: 35 });

/** 0 % → 00; (0, 10] % → 01; ... (90, 100] % → 10. */
export function batteryLevel(percent) {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(10, Math.max(0, Math.ceil(percent / 10)));
}

/** Panel compacto de cuatro filas, con valores de los sistemas de cada recurso. */
export function drawBatteryHUD(renderer, assets, suit, food, water, oxygen) {
  const ctx = renderer.context;
  const { x, y, width: w, height: h } = BATTERY_HUD_BOUNDS;
  const level = batteryLevel(suit.porcentaje);
  const danger = suit.alerta?.regresaAhora || suit.porcentaje <= 25 || water.alert || oxygen.alerta;
  const rows = [
    { label: 'COMIDA', key: `comida_nivel_${String(batteryLevel(food)).padStart(2, '0')}_t`, active: true },
    { label: 'AGUA', key: `agua_nivel_${String(batteryLevel(water.percent)).padStart(2, '0')}_t`, active: true, warning: Boolean(water.alert) },
    { label: 'BATERIA', key: `bateria_nivel_${String(level).padStart(2, '0')}_t`, active: true },
    { label: 'OXIGENO', key: `oxigeno_nivel_${String(batteryLevel(oxygen.porcentaje)).padStart(2, '0')}_t`, active: true, warning: Boolean(oxygen.alerta) },
  ];

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip(); // Ningún icono, segmento o texto puede sobresalir del cuadro.
  ctx.fillStyle = 'rgba(15, 28, 51, 0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#86a5c4';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = danger ? '#ff8276' : '#304c70';
  ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  ctx.font = '3px "Press Start 2P", monospace';
  ctx.textBaseline = 'top';
  rows.forEach((row, index) => {
    const sprite = assets.get(row.key);
    const rowY = y + 3 + index * 8;
    ctx.globalAlpha = row.active ? 1 : 0.45;
    if (sprite) {
      // PNG 180×64: icono a la izquierda, segmentos a la derecha.
      ctx.drawImage(sprite, 0, 0, 48, 64, x + 4, rowY, 7, 7);
      ctx.drawImage(sprite, 48, 0, 132, 64, x + 41, rowY, 36, 7);
    }
    ctx.fillStyle = row.warning || row.label === 'BATERIA' && (suit.alerta?.regresaAhora || suit.porcentaje <= 25)
      ? '#ff9b8e' : '#e6f4ff';
    ctx.fillText(row.label, x + 13, rowY + 2);
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}
