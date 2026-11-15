const MESSAGES = {
  Bienvenida: 'Bienvenido investigador. VEGA te acompañará durante la misión.',
  movimiento: 'Usa las flechas o WASD para moverte por la base lunar.',
  paneles: 'Consigue energía limpiando los paneles solares.',
  energia: 'La energía permite operar las puertas y los módulos.',
  recarga_oxigeno: 'Dos paneles listos. Regresa a la base para recargar el traje.',
  agua_comida: 'Recarga agua en el principal y consigue alimentos en la casa verde.',
};

/** Hitos de una sesión. El arte original solo se recorta en memoria. */
export class MissionMessages {
  constructor(root, assets) {
    this.root = root;
    this.image = root.querySelector('img');
    this.assets = assets;
    this.seen = new Set();
    this.queue = [];
    this.current = null;
    this.remaining = 0;
    this.cache = new Map();
    root.querySelector('button').onclick = () => this.dismiss();
  }
  once(id, condition) {
    if (!condition || this.seen.has(id)) return;
    this.seen.add(id);
    this.queue.push(id);
  }
  dismiss() { this.current = null; this.remaining = 0; this.root.hidden = true; }
  tick(dt, game, paused) {
    if (game.state !== 'playing' || game.mission.dead) { this.root.hidden = true; return; }
    this.once('Bienvenida', true);
    this.once('movimiento', game.mission.elapsed >= 6);
    this.once('paneles', game.mission.elapsed >= 12 && game.solar.progress.cleanCount < 2);
    this.once('energia', game.solar.progress.discovered && game.solar.progress.cleanCount < 2);
    this.once('recarga_oxigeno', game.solar.progress.cleanCount >= 2);
    this.once('agua_comida', game.rechargeCompleted);
    const obsolete = id => (game.solar.progress.cleanCount >= 2
      && ['movimiento', 'paneles', 'energia'].includes(id))
      || (game.rechargeCompleted && id === 'recarga_oxigeno');
    this.queue = this.queue.filter(id => !obsolete(id));
    if (obsolete(this.current)) this.dismiss();
    if (paused) { this.root.hidden = true; return; }
    if (this.current) {
      this.remaining -= dt;
      if (this.remaining <= 0) this.dismiss();
    }
    if (!this.current && this.queue.length) {
      this.current = this.queue.shift();
      this.remaining = 8;
      this.image.src = this.art(this.current);
      this.image.alt = MESSAGES[this.current];
      this.root.dataset.message = this.current;
      this.root.animate([{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }],
        { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300, easing: 'ease-out' });
    }
    this.root.hidden = !this.current;
  }
  art(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const image = this.assets.get(`final_message_${id}`);
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let left = image.width, top = image.height, right = 0, bottom = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      if (data[(y * image.width + x) * 4 + 3] > 12) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    const cropped = document.createElement('canvas');
    cropped.width = Math.max(1, right - left + 1); cropped.height = Math.max(1, bottom - top + 1);
    cropped.getContext('2d').drawImage(image, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
    const url = cropped.toDataURL();
    this.cache.set(id, url);
    return url;
  }
}
