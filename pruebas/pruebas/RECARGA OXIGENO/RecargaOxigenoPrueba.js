import {
  RecargaOxigeno, RECARGA_CONFIG, RECARGA_LAYOUT, FASE, ESTADO_LINEA,
} from '../../src/minigames/RecargaOxigeno.js';

const C = {
  paper: '#eff8ff', muted: '#b9d3e6', blue: '#55d9ff',
  green: '#70f3a8', amber: '#ffda8d', red: '#ff8c84', dark: '#091b33',
};

function texto(ctx, value, x, y, { size = 4, color = C.paper, align = 'left', max = 0, line = 7 } = {}) {
  ctx.save();
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const lines = [''];
  for (const word of value.split(' ')) {
    const current = lines.at(-1);
    const candidate = current ? `${current} ${word}` : word;
    if (max && current && ctx.measureText(candidate).width > max) lines.push(word);
    else lines[lines.length - 1] = candidate;
  }
  lines.forEach((row, i) => ctx.fillText(row, Math.round(x), Math.round(y + i * line)));
  ctx.restore();
}

function puntoCurva(a, mid, b, t) {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * mid.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * mid.y + t * t * b.y };
}

/** La mecánica común queda intacta; esta presentación y sus sprites son solo de la prueba. */
export class RecargaOxigenoPrueba extends RecargaOxigeno {
  /** Alternativa táctil para quien no pueda arrastrar: conserva las mismas fases. */
  conectarLinea(id) {
    if (this.fase !== FASE.CONECTANDO) return false;
    const line = this.lines.find(item => item.id === id);
    if (!line || line.estado === ESTADO_LINEA.CONECTADO || line.animacion) return false;
    this._conectarManguera(line, id);
    return true;
  }

  girarValvula(id) {
    if (this.fase !== FASE.VALVULAS) return false;
    const valve = this.valves.find(item => item.id === id);
    if (!valve || this._valvulaCompleta(valve)) return false;
    valve.turned = Math.min(valve.objetivo, valve.turned + Math.PI * 2);
    valve.rotation += Math.PI / 2;
    return true;
  }

  _drawBanner(ctx) {
    const b = RECARGA_LAYOUT.banner;
    this._panelBiselado(ctx, b, C.blue);
    ctx.fillStyle = C.blue;
    ctx.fillRect(b.x + 7, b.y + 4, 9, 9);
    texto(ctx, 'i', b.x + 11.5, b.y + 5, { size: 5, color: C.dark, align: 'center' });
    const mensaje = this.hayFuga
      ? 'Puerto equivocado. Une cada color con su puerto.'
      : this.fase === FASE.CONECTANDO
        ? 'Arrastra O2 al azul y CO2 al verde.'
        : this.fase === FASE.AUTORIZADO
          ? '¡Bien! Las dos líneas están conectadas.'
          : this.fase === FASE.VALVULAS
            ? 'Gira las dos válvulas en sentido horario.'
            : '¡Recarga terminada en esta prueba!';
    texto(ctx, mensaje, b.x + 22, b.y + 4, {
      size: 4, max: b.w - 29, line: 7, color: this.hayFuga ? C.red : C.paper,
    });
  }

  _drawPanelLateral(ctx, rect, titulo, color) {
    this._panelBiselado(ctx, rect, color);
    ctx.fillStyle = '#102942';
    ctx.fillRect(rect.x + 4, rect.y + rect.h - 14, rect.w - 8, 11);
    texto(ctx, 'Arrastra', rect.x + rect.w / 2, rect.y + rect.h - 13,
      { size: 3.4, align: 'center', color: C.paper });
    texto(ctx, 'al puerto', rect.x + rect.w / 2, rect.y + rect.h - 8,
      { size: 3.4, align: 'center', color: C.muted });
  }

  _drawCilindro(ctx, rect, id) {
    const sprite = id === 'o2' ? this.sprites.tanqueO2 : this.sprites.tanqueCO2;
    if (sprite) {
      const h = 44;
      const w = sprite.width * h / sprite.height;
      const x = id === 'o2' ? rect.x + rect.w / 2 - 8 : rect.x + rect.w / 2 - 32;
      const y = rect.y + 9;
      const acople = sprite.width * .31 / sprite.height * h;
      ctx.save();
      ctx.beginPath();
      if (id === 'o2') ctx.rect(x, y, acople, 12);
      else ctx.rect(x + w - acople, y, acople, 12);
      ctx.rect(x, y + 12, w, h - 12);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, x, y, w, h);
      ctx.restore();
    } else super._drawCilindro(ctx, rect, id);
    ctx.fillStyle = '#091b33';
    ctx.fillRect(rect.x + 4, rect.y + 2, rect.w - 8, 8);
    texto(ctx, id === 'o2' ? 'Reserva O2' : 'Salida CO2',
      rect.x + rect.w / 2, rect.y + 4, {
        size: 4, align: 'center', color: id === 'o2' ? C.blue : C.green,
      });
  }

  _drawManguera(ctx, line) {
    const a = line.anchor;
    const b = line.free;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 12 };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mid.x, mid.y, b.x, b.y);
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#071525';
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = line.id === 'o2' ? '#0d5fb4' : '#126d46';
    ctx.stroke();
    ctx.lineWidth = 2.7;
    ctx.strokeStyle = line.id === 'o2' ? '#49c5ff' : '#62e89e';
    ctx.stroke();
    for (let i = 1; i < 22; i++) {
      const t = i / 22;
      const p = puntoCurva(a, mid, b, t);
      const before = puntoCurva(a, mid, b, t - 0.004);
      const after = puntoCurva(a, mid, b, t + 0.004);
      const angle = Math.atan2(after.y - before.y, after.x - before.x) + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(angle) * 2.2, p.y - Math.sin(angle) * 2.2);
      ctx.lineTo(p.x + Math.cos(angle) * 2.2, p.y + Math.sin(angle) * 2.2);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = line.id === 'o2' ? '#0c4677' : '#145a39';
      ctx.stroke();
    }
    // El extremo metálico viene del mismo PNG original del cilindro.
    const sprite = line.id === 'o2' ? this.sprites.tanqueO2 : this.sprites.tanqueCO2;
    if (sprite) {
      const sx = line.id === 'o2' ? 969 : 101;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, sx, 205, 72, 85, b.x - 5, b.y - 5, 10, 10);
    }
    ctx.restore();
  }

  _drawSlot(ctx, line) {
    const slot = this.slots[line.id];
    const sprite = line.id === 'o2' ? this.sprites.puertoO2 : this.sprites.puertoCO2;
    if (!sprite) return super._drawSlot(ctx, line);
    const w = RECARGA_CONFIG.anchoVisualPuerto;
    ctx.drawImage(sprite, slot.x - w / 2, slot.y - w * sprite.height / sprite.width / 2,
      w, w * sprite.height / sprite.width);
    if (line.estado === ESTADO_LINEA.CONECTADO) {
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(slot.x - 6, slot.y - 6, 12, 12);
    }
    if (this.fuga && Math.hypot(this.fuga.x - slot.x, this.fuga.y - slot.y) < 1) {
      texto(ctx, 'PUERTO ERRÓNEO', slot.x, slot.y + 8, {
        size: 3.2, align: 'center', color: C.red,
      });
    }
  }

  _drawEstado(ctx) {
    const p = RECARGA_LAYOUT.estado;
    this._panelBiselado(ctx, p, '#587a9c');
    texto(ctx, 'ESTADO', p.x + 5, p.y + 4, { size: 3.8, color: C.muted });
    this.lines.forEach((line, i) => {
      const y = p.y + 13 + i * 10;
      ctx.fillStyle = line.id === 'o2' ? C.blue : C.green;
      ctx.fillRect(p.x + 5, y, 4, 4);
      const estado = line.estado === ESTADO_LINEA.CONECTADO ? 'CONECTADO' : 'SIN CONECTAR';
      texto(ctx, `${line.id === 'o2' ? 'O2' : 'CO2'} ${estado}`,
        p.x + 12, y - 0.5, { size: 3.2, max: p.w - 16, color: C.paper });
    });
  }

  _drawBarraPasos(ctx) {
    const b = RECARGA_LAYOUT.barra;
    this._panelBiselado(ctx, b, '#587a9c');
    const pasos = [
      ['1', 'Conecta', 'las mangueras', this.ambosConectados, this.fase === FASE.CONECTANDO],
      ['2', 'Gira', 'las válvulas', this.completado, this.fase === FASE.VALVULAS || this.fase === FASE.AUTORIZADO],
      ['3', 'Recarga', 'terminada', this.completado, this.fase === FASE.COMPLETADO],
    ];
    pasos.forEach(([num, title, detail, done, active], index) => {
      const x = b.x + 7 + index * b.w / 3;
      const color = active ? C.amber : done ? C.green : C.muted;
      ctx.fillStyle = active ? '#5b4024' : done ? '#1b533c' : '#203447';
      ctx.fillRect(x, b.y + 5, 9, 9);
      texto(ctx, done ? '✓' : num, x + 4.5, b.y + 7.2, { size: 4, color, align: 'center' });
      texto(ctx, title, x + 13, b.y + 4, { size: 3.7, color });
      texto(ctx, detail, x + 13, b.y + 10, { size: 3.3, color: C.paper });
    });
  }

  _drawProgress(ctx) {
    const m = RECARGA_LAYOUT.modulo;
    const x = m.x + (m.w - 96) / 2;
    const y = m.y + m.h - 10;
    texto(ctx, 'RECARGA O2', m.x + m.w / 2, y - 10,
      { size: 3.6, color: C.muted, align: 'center' });
    ctx.fillStyle = C.dark;
    ctx.fillRect(x, y, 96, 6);
    ctx.strokeStyle = '#718fb0';
    ctx.strokeRect(x + .5, y + .5, 95, 5);
    ctx.fillStyle = this.completado ? C.green : C.blue;
    ctx.fillRect(x + 1, y + 1, 94 * this.progreso, 4);
    texto(ctx, `${Math.round(this.progreso * 100)}%`, m.x + m.w / 2, y + 1,
      { size: 3.3, align: 'center' });
  }

  _drawModalActivacion(ctx) {
    ctx.fillStyle = 'rgba(4, 11, 27, .88)';
    ctx.fillRect(0, 0, 320, 180);
    const p = this._rectPanelCentral(160, 46);
    this._panelBiselado(ctx, p, C.green);
    if (this.sprites.iconoAutorizado) ctx.drawImage(this.sprites.iconoAutorizado, p.x + 8, p.y + 11, 22, 22);
    texto(ctx, '¡Conexiones listas!', p.x + 36, p.y + 11,
      { size: 4.2, max: p.w - 43, color: C.green });
    texto(ctx, 'Gira ahora las dos', p.x + 36, p.y + 21,
      { size: 3.7, color: C.paper });
    texto(ctx, 'válvulas rojas.', p.x + 36, p.y + 28,
      { size: 3.7, color: C.paper });
  }

  _drawModalCompleto(ctx) {
    ctx.fillStyle = 'rgba(4, 11, 27, .88)';
    ctx.fillRect(0, 0, 320, 180);
    const p = this._rectPanelCentral(180, 60);
    this._panelBiselado(ctx, p, C.green);
    if (this.sprites.iconoAutorizado) ctx.drawImage(this.sprites.iconoAutorizado, p.x + 12, p.y + 9, 20, 20);
    texto(ctx, '¡Recarga completada!', p.x + 36, p.y + 13,
      { size: 4.1, max: p.w - 42, color: C.green });
    texto(ctx, 'Mochila lista en esta prueba.', p.x + p.w / 2, p.y + 31,
      { size: 3.4, align: 'center' });
    const btn = this._rectBotonReiniciar();
    ctx.fillStyle = '#245470';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = C.blue;
    ctx.strokeRect(btn.x + .5, btn.y + .5, btn.w - 1, btn.h - 1);
    texto(ctx, 'Reiniciar prueba', btn.x + btn.w / 2, btn.y + 5,
      { size: 3.8, align: 'center' });
  }
}
