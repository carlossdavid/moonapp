import { BOARD, COLS, ROWS, PANEL, PORTS } from './beamCleaning.js';

/** Compone los PNG individuales a resolución 640×360; nunca modifica sus archivos. */
export function drawSpriteArt(ctx, sprites, model, now, dragging, pointer) {
  const art = (key, x, y, w, h) => {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sprites[key], x, y, w, h);
  };
  const block = (color, x, y, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const text = (value, x, y, color = '#eff9ff', size = 16) => {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px monospace`;
    ctx.fillText(value, x, y);
  };
  const cable = (start, end, color, index) => {
    const bend = index === 0 ? 181 : 239;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(162, start.y, 158, bend, 195, bend);
    ctx.bezierCurveTo(end.x - 30, bend, end.x - 31, end.y, end.x, end.y);
    ctx.lineCap = 'round';
    ctx.lineWidth = 13;
    ctx.strokeStyle = '#071329';
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffffa0';
    ctx.stroke();
  };

  block('#081126', 0, 0, BOARD.w, BOARD.h);
  art('frame', 2, 2, 636, 356);
  // El área útil queda en el interior del sprite de marco, sin tapar
  // los bordes iluminados ni solapar la franja inferior.
  block('#0d1930', 36, 58, 568, 243);
  text('GENERADOR', 49, 74, '#c9e5f8', 13);
  text('IMÁN A / B', 203, 74, '#c9e5f8', 13);
  text('PANEL SOLAR', 414, 74, '#c9e5f8', 13);

  // Sólo UN ejemplar del imán: sus dos tomas ya vienen rotuladas A y B.
  art('generator', 45, 82, 122, 178);
  art(model.phase === 'sweeping' || model.complete ? 'magnetOn' : 'magnetOff',
    194, 98, 130, 151);

  // El cable no aparece conectado hasta que el jugador acierta la toma.
  PORTS.forEach((port, i) => {
    const color = i === 0 ? '#40d9fc' : '#f4ae42';
    if (model.connected[i]) {
      cable(port.source, port.socket, color, i);
      art(i === 0 ? 'plugA' : 'plugB', port.socket.x - 16, port.socket.y - 11, 32, 22);
    } else {
      if (dragging !== i) art(i === 0 ? 'cableA' : 'cableB',
        114, port.source.y - 13, 76, 40);
      art(i === 0 ? 'plugA' : 'plugB', port.source.x - 16, port.source.y - 11, 32, 22);
    }
  });
  if (dragging !== null && pointer) {
    const start = PORTS[dragging].source;
    const color = dragging === 0 ? '#40d9fc' : '#f4ae42';
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(start.x + 48, start.y, pointer.x - 48, pointer.y, pointer.x, pointer.y);
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#071329';
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.strokeStyle = color;
    ctx.stroke();
    art(dragging === 0 ? 'plugA' : 'plugB', pointer.x - 16, pointer.y - 11, 32, 22);
  }

  // Las 24 celdas ahora son casi cuadradas y ocupan el ancho libre del marco.
  block('#0a1227', PANEL.x - 6, PANEL.y - 6, PANEL.w + 12, PANEL.h + 12);
  const cw = PANEL.w / COLS;
  const ch = PANEL.h / ROWS;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col;
      const frame = model.phase === 'discover'
        ? model.discoveryStep === 2 && i % 3 === 0 ? 'dusty' : 'clean'
        : !model.dust[i] ? 'clean'
        : model.phase === 'sweeping' && i === model.cleanCells ? 'partial' : 'dusty';
      art(frame, PANEL.x + col * cw, PANEL.y + row * ch, cw, ch);
    }
  }
  if (model.phase === 'discover') {
    if (model.discoveryStep > 0) {
      // Sol y flecha de luz: ilustración conceptual, no medidor de potencia.
      const sunX = PANEL.x + 28;
      const sunY = PANEL.y + 26;
      ctx.fillStyle = '#ffd877';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff1ad';
      ctx.lineWidth = 3;
      for (let ray = 0; ray < 8; ray++) {
        const angle = ray * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(sunX + Math.cos(angle) * 17, sunY + Math.sin(angle) * 17);
        ctx.lineTo(sunX + Math.cos(angle) * 23, sunY + Math.sin(angle) * 23);
        ctx.stroke();
      }
      block('#0b1c38e6', PANEL.x + 13, PANEL.y + 119, PANEL.w - 26, 37);
      text(model.discoveryStep === 1 ? 'LUZ → ELECTRICIDAD' : 'POLVO → MENOS LUZ',
        PANEL.x + 20, PANEL.y + 143, '#fff0ba', 17);
    } else {
      block('#0b1c38e6', PANEL.x + 27, PANEL.y + 118, PANEL.w - 54, 37);
      text('TOCA EL PANEL', PANEL.x + 44, PANEL.y + 143, '#e8f8ff', 17);
    }
    block('#162a47', 38, 261, 564, 37);
    text(model.discoveryStep === 0 ? '¿QUÉ HACE UN PANEL SOLAR?'
      : model.discoveryStep === 1 ? 'SOL → CELDAS → ELECTRICIDAD → BASE'
        : 'EL POLVO TAPA PARTE DE LAS CELDAS', 48, 285, '#f6e4b3', 15);
    return;
  }
  if (model.phase === 'sweeping') {
    const sx = PANEL.x + (model.cleanCells % COLS + .5) * cw;
    const sy = PANEL.y + (Math.floor(model.cleanCells / COLS) + .5) * ch;
    ctx.strokeStyle = '#51e9fc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(318, 172);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    art('marker', sx - 20, sy - 20, 40, 40);
    if (now % 280 < 190) {
      art('burst', sx + 7, sy - 18, 27, 26);
      art('particles', sx + 9, sy - 28, 32, 24);
    }
  }
  block('#162a47', 38, 261, 564, 37);
  text('ZONAS LIMPIAS', 48, 285, '#cfe5ff', 15);
  block('#7797b1', 214, 269, 312, 22);
  block('#071327', 217, 272, 306, 16);
  const fill = Math.round(294 * model.cleanCells / (COLS * ROWS));
  if (fill) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(220, 274, fill, 12);
    ctx.clip();
    art('progressFill', 218, 270, 306, 20);
    ctx.restore();
  }
  text(`${model.cleanCells}/${COLS * ROWS}`, 541, 285, model.complete ? '#92ffde' : '#ffd08d', 16);
  if (model.complete) {
    block('#0b1934', 388, 138, 150, 54);
    art('success', 392, 145, 40, 40);
    text('COMPLETO', 433, 163, '#e1ffed', 14);
    text('24 / 24', 434, 181, '#92ffde', 14);
  }
}
