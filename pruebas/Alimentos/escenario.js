import { CULTIVOS, CANALES, rutaPlanta } from './datos.js';

export class EscenarioCultivo {
  constructor(canvas, leerEstado) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.leerEstado = leerEstado;
    this.imagenes = new Map();
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.frame = 'a';
    this.lastFrame = 0;
  }

  async cargar() {
    const rutas = new Set(['iluminacion/nativo/luminaria_soporte.png']);
    for (const cultivo of CULTIVOS) {
      rutas.add(`fondos/nativo/fondo_camara_${cultivo.id}.png`);
      for (let etapa = 0; etapa <= 5; etapa++) {
        for (const frame of ['a', 'b']) rutas.add(rutaPlanta(cultivo.id, etapa, frame));
      }
    }
    for (const { id } of CANALES) {
      rutas.add(`iluminacion/nativo/lampara_${id}_encendida.png`);
      rutas.add(`iluminacion/nativo/lampara_${id}_apagada.png`);
      rutas.add(`iluminacion/nativo/rayo_${id}.png`);
    }
    await Promise.all([...rutas].map(async ruta => {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error(`No se pudo cargar el sprite: ${ruta}`));
        image.src = new URL(`./Sprites/${ruta}`, import.meta.url).href;
      });
      this.imagenes.set(ruta, image);
    }));
    this.dibujar();
    const animar = now => {
      if (now - this.lastFrame >= 450 && !document.hidden) {
        this.frame = this.reduceMotion.matches ? 'a' : this.frame === 'a' ? 'b' : 'a';
        this.lastFrame = now;
        this.dibujar();
      }
      this.raf = requestAnimationFrame(animar);
    };
    this.raf = requestAnimationFrame(animar);
  }

  dibujar() {
    const { cultivo, estado } = this.leerEstado();
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 256, 224);
    const imagen = (ruta, x, y, w, h, alpha = 1) => {
      const img = this.imagenes.get(ruta);
      if (!img) return;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.drawImage(img, x, y, w, h); ctx.restore();
    };
    const fondo = `fondos/nativo/fondo_camara_${cultivo.id}.png`;
    imagen(fondo, 0, 0, 256, 224);
    this.canvas.dataset.crop = cultivo.id;
    this.canvas.dataset.background = fondo;
    this.canvas.dataset.plant = rutaPlanta(cultivo.id, estado.etapa, this.frame);
    this.canvas.setAttribute('aria-label', `Cámara de ${cultivo.nombre}, etapa visual ${estado.etapa}. Luz de vista previa.`);
    imagen('iluminacion/nativo/luminaria_soporte.png', 36, 18, 184, 20);
    for (let i = 0; i < CANALES.length; i++) {
      const { id } = CANALES[i], valor = estado.borrador[id], x = 42 + i * 45;
      if (valor > 0) imagen(`iluminacion/nativo/rayo_${id}.png`, x - 14, 55, 62, 132, valor / 100 * .32);
      imagen(`iluminacion/nativo/lampara_${id}_${valor > 0 ? 'encendida' : 'apagada'}.png`, x, 33, 32, 32);
    }
    const planta = rutaPlanta(cultivo.id, estado.etapa, this.frame);
    for (const x of [3, 83, 163]) imagen(planta, x, 116, 90, 90);
    // Testigo del canal: la lámpara no cambia de posición, solo su estado.
    this.canvas.dataset.lights = CANALES.map(c => estado.borrador[c.id]).join(',');
  }

  detener() { cancelAnimationFrame(this.raf); }
}
