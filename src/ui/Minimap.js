/**
 * Minimap HUD reutilizable (diseño original, minimalista).
 * - Lógica de conversión de coordenadas (mundo -> minimapa)
 * - Definición visual simplificada del mapa interior
 * - Render del HUD (pantalla), desacoplado de escenas/motor
 */

export const DEFAULT_MINIMAP_CONFIG = {
  // Posición y tamaño en pantalla (esquina inferior izquierda por defecto)
  x: 6,
  y: 118, // 320x180 con height=56
  width: 72,
  height: 56,
  padding: 5,
  // Estilo visual
  backgroundColor: 'rgba(12, 16, 22, 0.72)',
  borderColor: 'rgba(220, 230, 240, 0.55)',
  borderWidth: 1,
  borderRadius: 6,
  outlineColor: 'rgba(235, 242, 255, 0.85)',
  outlineWidth: 1,
  sectorColor: 'rgba(200, 215, 235, 0.18)',
  terrainColor: 'rgba(200, 210, 220, 0.10)',
  // Jugador
  playerColor: '#ffd400', // puntito amarillo brillante
  playerRadius: 2.5,
  showDirection: true,
  directionLength: 4,
  directionColor: '#ffd400',
  // Salida/puerta/entrada
  exitColor: '#6fe3a1',
  exitRadius: 2,
  // Tipo de esquema: 'interior' | 'exterior' | función personalizada
  schematic: 'interior',
  // Visibilidad (se evalúa externamente; true por defecto)
  visible: true,
};

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

/** @typedef {{ x:number, y:number, color?:string, radius?:number }} MinimapMarker */

export class Minimap {
  /** @param {Partial<typeof DEFAULT_MINIMAP_CONFIG>} [config] */
  constructor(config = {}) {
    this.config = { ...DEFAULT_MINIMAP_CONFIG, ...config };
  }

  /** @param {Partial<typeof DEFAULT_MINIMAP_CONFIG>} patch */
  setConfig(patch) {
    Object.assign(this.config, patch);
  }

  /**
   * Rectángulo interno donde se dibuja el mapa (excluye padding).
   * @returns {{ x:number, y:number, w:number, h:number }}
   */
  getInnerRect() {
    const c = this.config;
    const p = c.padding;
    return { x: c.x + p, y: c.y + p, w: Math.max(1, c.width - p * 2), h: Math.max(1, c.height - p * 2) };
  }

  /**
   * Convierte coordenadas del mundo a coordenadas del minimapa (pantalla).
   * @param {number} wx
   * @param {number} wy
   * @param {number} worldW
   * @param {number} worldH
   * @returns {{ x:number, y:number }}
   */
  worldToMinimap(wx, wy, worldW, worldH) {
    const r = this.getInnerRect();
    const nx = worldW > 0 ? (wx / worldW) : 0;
    const ny = worldH > 0 ? (wy / worldH) : 0;
    const x = r.x + clamp(nx, 0, 1) * r.w;
    const y = r.y + clamp(ny, 0, 1) * r.h;
    return { x, y };
  }

  /**
   * Renderiza el minimapa (llamar en espacio de pantalla/UI).
   * @param {import('../graphics/Renderer.js').Renderer} renderer
   * @param {{
   *  playerX:number, playerY:number, worldW:number, worldH:number,
   *  facing?: 'up'|'down'|'left'|'right',
   *  exit?: { x:number, y:number }|null,
   *  markers?: MinimapMarker[],
   * }} data
   */
  render(renderer, data) {
    if (!this.config.visible) return;
    const { playerX, playerY, worldW, worldH, facing, exit, markers } = data;
    const c = this.config;
    const ctx = renderer.context;

    // Panel y recorte para no dibujar fuera del minimapa
    ctx.save();
    this._clipRoundedRect(ctx, c.x, c.y, c.width, c.height, c.borderRadius);

    // Fondo
    ctx.fillStyle = c.backgroundColor;
    ctx.fillRect(c.x, c.y, c.width, c.height);

    // Esquema simplificado del mapa (interior o exterior)
    this._drawSchematic(ctx, worldW, worldH);

    // Marcadores adicionales (objetivos, etc.)
    if (markers && markers.length) {
      for (const m of markers) {
        const p = this.worldToMinimap(m.x, m.y, worldW, worldH);
        this._drawDot(ctx, p.x, p.y, m.radius ?? 2, m.color ?? '#66ccff');
      }
    }

    // Marca de salida/puerta
    if (exit) {
      const ep = this.worldToMinimap(exit.x, exit.y, worldW, worldH);
      this._drawDot(ctx, ep.x, ep.y, c.exitRadius, c.exitColor);
    }

    // Jugador: puntito amarillo brillante (+ orientación opcional)
    const pp = this.worldToMinimap(clamp(playerX, 0, worldW), clamp(playerY, 0, worldH), worldW, worldH);
    if (c.showDirection && facing) {
      this._drawDirection(ctx, pp.x, pp.y, facing, c.directionLength, c.directionColor);
    }
    this._drawDot(ctx, pp.x, pp.y, c.playerRadius, c.playerColor);

    ctx.restore();

    // Borde/marco HUD discreto (fuera del recorte de contenido, pero dentro del panel)
    ctx.save();
    ctx.strokeStyle = c.borderColor;
    ctx.lineWidth = c.borderWidth;
    this._strokeRoundedRect(ctx, c.x + 0.5, c.y + 0.5, c.width - 1, c.height - 1, c.borderRadius);
    ctx.restore();
  }

  /** Selecciona y dibuja el esquema según configuración. */
  _drawSchematic(ctx, worldW, worldH) {
    const { schematic } = this.config;
    if (typeof schematic === 'function') {
      const r = this.getInnerRect();
      const toMap = (wx, wy) => this.worldToMinimap(wx, wy, worldW, worldH);
      schematic(ctx, { worldW, worldH, toMap, inner: r, config: this.config });
      return;
    }
    if (schematic === 'exterior') {
      this._drawExteriorSchematic(ctx, worldW, worldH);
    } else {
      this._drawInteriorSchematic(ctx, worldW, worldH);
    }
  }

  /** Dibuja un esquema/plano simple del interior (original). */
  _drawInteriorSchematic(ctx, worldW, worldH) {
    const c = this.config;
    const r = this.getInnerRect();
    ctx.save();
    ctx.strokeStyle = c.outlineColor;
    ctx.lineWidth = c.outlineWidth;

    // Sala principal circular (simplificación del interior)
    const center = this.worldToMinimap(worldW / 2, worldH / 2, worldW, worldH);
    const edgeX = this.worldToMinimap(worldW, worldH / 2, worldW, worldH);
    const edgeY = this.worldToMinimap(worldW / 2, worldH, worldW, worldH);
    const rad = Math.min(Math.abs(edgeX.x - center.x), Math.abs(edgeY.y - center.y)) * 0.82;

    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.max(4, rad), 0, Math.PI * 2);
    ctx.stroke();

    // Sectores/bloques interiores simplificados
    ctx.fillStyle = c.sectorColor;
    const block = (wx, wy, ww, wh) => {
      const p1 = this.worldToMinimap(wx, wy, worldW, worldH);
      const p2 = this.worldToMinimap(wx + ww, wy + wh, worldW, worldH);
      ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    };
    block(worldW * 0.5 - 30, worldH * 0.5 - 35, 22, 14);
    block(worldW * 0.5 + 8, worldH * 0.5 - 35, 22, 14);
    block(worldW * 0.5 - 10, worldH * 0.5 - 55, 20, 12);

    // Pasillo/entrada inferior (marca simple)
    const entryTop = this.worldToMinimap(worldW / 2, worldH * 0.78, worldW, worldH);
    const entryBot = this.worldToMinimap(worldW / 2, worldH, worldW, worldH);
    ctx.beginPath();
    ctx.moveTo(entryTop.x, entryTop.y);
    ctx.lineTo(entryBot.x, Math.min(r.y + r.h, entryBot.y));
    ctx.stroke();
    const e1 = this.worldToMinimap(worldW * 0.5 - 14, worldH * 0.82, worldW, worldH);
    const e2 = this.worldToMinimap(worldW * 0.5 + 14, worldH, worldW, worldH);
    ctx.strokeRect(e1.x, e1.y, e2.x - e1.x, Math.min(r.y + r.h, e2.y) - e1.y);

    ctx.restore();
  }

  /** Dibuja un esquema/plano simple del mapa exterior (original). */
  _drawExteriorSchematic(ctx, worldW, worldH) {
    const c = this.config;
    const r = this.getInnerRect();
    ctx.save();

    // Contorno del terreno/mapa
    ctx.fillStyle = c.terrainColor || 'rgba(200,210,220,0.08)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = c.outlineColor;
    ctx.lineWidth = c.outlineWidth;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

    // Zona/base principal (marca simplificada al centro)
    ctx.fillStyle = c.sectorColor;
    const base = (wx, wy, ww, wh) => {
      const p1 = this.worldToMinimap(wx - ww / 2, wy - wh / 2, worldW, worldH);
      const p2 = this.worldToMinimap(wx + ww / 2, wy + wh / 2, worldW, worldH);
      ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    };
    const cx = worldW * 0.5, cy = worldH * 0.42;
    base(cx, cy, 70, 40);          // estación principal
    base(cx - 110, cy + 10, 30, 18); // panel solar
    base(cx + 120, cy - 70, 18, 28); // antena
    base(cx - 120, cy - 60, 28, 22); // tanques
    base(cx + 190, cy - 40, 16, 24); // antena dañada
    base(cx + 140, cy + 90, 40, 22); // restos

    ctx.restore();
  }

  _drawDot(ctx, x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawDirection(ctx, x, y, facing, len, color) {
    let dx = 0, dy = 0;
    if (facing === 'up') dy = -1;
    else if (facing === 'down') dy = 1;
    else if (facing === 'left') dx = -1;
    else if (facing === 'right') dx = 1;
    else return;
    const tipX = x + dx * (len + 1.5);
    const tipY = y + dy * (len + 1.5);
    const px = -dy, py = dx; // perpendicular
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(x + px * 2, y + py * 2);
    ctx.lineTo(x - px * 2, y - py * 2);
    ctx.closePath();
    ctx.fill();
  }

  _clipRoundedRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
    ctx.clip();
  }

  _strokeRoundedRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
    ctx.stroke();
  }
}
