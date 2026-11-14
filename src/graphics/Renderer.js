/** Canvas 2D renderer wrapper. */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number} logicalWidth
   * @param {number} logicalHeight
   * @param {number} [baseScale=1]
   */
  constructor(canvas, logicalWidth, logicalHeight, baseScale = 1) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not available');
    this.ctx = ctx;
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    this.baseScale = baseScale;
    this.displayScale = baseScale;
    this._camera = null;
    this.ctx.imageSmoothingEnabled = false;
    this.resize();
  }

  /** Resize canvas to fit window with integer scaling and DPR handling. */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const fitW = Math.floor(window.innerWidth / this.logicalWidth);
    const fitH = Math.floor(window.innerHeight / this.logicalHeight);
    this.displayScale = Math.max(1, Math.min(fitW || 1, fitH || 1));

    const cssW = this.logicalWidth * this.displayScale;
    const cssH = this.logicalHeight * this.displayScale;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.ctx.setTransform(dpr * this.displayScale, 0, 0, dpr * this.displayScale, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  /** @param {string} [color='#000'] */
  clear(color = '#000000') {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  /** @param {import('./Camera.js').Camera|null} camera */
  begin(camera = null) {
    this._camera = camera;
    this.ctx.save();
    // Asegurar pixel art nítido en cada frame (algunos navegadores lo resetean)
    this.ctx.imageSmoothingEnabled = false;
    if (camera) {
      const sx = Math.round(-camera.x);
      const sy = Math.round(-camera.y);
      this.ctx.translate(sx, sy);
    }
  }

  /** End camera transform scope. */
  end() {
    this.ctx.restore();
    this._camera = null;
  }

  /**
   * Draw an image or sprite frame.
   * @param {CanvasImageSource} image
   * @param {number} sx
   * @param {number} sy
   * @param {number} sw
   * @param {number} sh
   * @param {number} dx
   * @param {number} dy
   * @param {number} dw
   * @param {number} dh
   * @param {boolean} [flipX=false]
   */
  drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh, flipX = false) {
    const x = Math.round(dx);
    const y = Math.round(dy);
    if (!flipX) {
      this.ctx.drawImage(image, sx, sy, sw, sh, x, y, dw, dh);
      return;
    }
    this.ctx.save();
    this.ctx.translate(x + dw, y);
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
    this.ctx.restore();
  }

  /**
   * Debug rectangle.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} style
   * @param {boolean} [fill=false]
   */
  drawRect(x, y, w, h, style, fill = false) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (fill) {
      this.ctx.fillStyle = style;
      this.ctx.fillRect(rx, ry, w, h);
    } else {
      this.ctx.strokeStyle = style;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(rx + 0.5, ry + 0.5, w - 1, h - 1);
    }
  }

  /**
   * Debug circle.
   * @param {number} x
   * @param {number} y
   * @param {number} r
   * @param {string} style
   * @param {boolean} [fill=false]
   */
  drawCircle(x, y, r, style, fill = false) {
    this.ctx.beginPath();
    this.ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2);
    if (fill) {
      this.ctx.fillStyle = style;
      this.ctx.fill();
    } else {
      this.ctx.strokeStyle = style;
      this.ctx.stroke();
    }
  }

  /**
   * Draw text in screen space (call without camera or after end()).
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {string} [style='#fff']
   */
  drawText(text, x, y, style = '#ffffff') {
    this.ctx.fillStyle = style;
    this.ctx.font = '8px monospace';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(text, Math.round(x), Math.round(y));
  }

  /** @returns {CanvasRenderingContext2D} */
  get context() {
    return this.ctx;
  }
}
