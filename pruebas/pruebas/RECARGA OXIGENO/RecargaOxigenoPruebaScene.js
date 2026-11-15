import { Scene } from '../../src/scenes/Scene.js';
import { RecargaOxigenoPrueba } from './RecargaOxigenoPrueba.js';

const IMAGENES = {
  mochilaBase: 'mochila_base.png',
  puertoO2: 'puerto_o2.png',
  puertoCO2: 'puerto_co2.png',
  tanqueO2: 'tanque_o2_con_manguera.png',
  tanqueCO2: 'tanque_co2_con_manguera.png',
  manija: 'manija.png',
  manijaGiro: 'manija_giro_derecha.png',
  iconoAutorizado: 'icono_autorizado.png',
  iconoAlerta: 'icono_alerta.png',
  fugaGas: 'fuga_gas.png',
};

async function cargarSprites() {
  const pares = await Promise.all(Object.entries(IMAGENES).map(([clave, archivo]) =>
    new Promise((resolve, reject) => {
      const imagen = new Image();
      imagen.onload = () => resolve([clave, imagen]);
      imagen.onerror = () => reject(new Error(`No se pudo cargar ${archivo}`));
      imagen.src = new URL(`./sprites_recarga_oxigeno/${archivo}`, import.meta.url).href;
    })
  ));
  return Object.fromEntries(pares);
}

/** Solo esta prueba: los PNG se cargan sin depender del manifiesto compartido. */
export class RecargaOxigenoPruebaScene extends Scene {
  constructor(game, opts = {}) {
    super(game);
    this.opts = opts;
    this.minigame = null;
  }

  async init() {
    const sprites = await cargarSprites();
    this.minigame = new RecargaOxigenoPrueba({ sprites, ...this.opts });
    this.minigame.mount(this.game.canvas);
    this._lastStatus = '';
  }

  update(dt) {
    if (!this.minigame) return;
    this.minigame.update(dt);
    const snapshot = this.minigame.getSnapshot();
    const status = JSON.stringify([
      snapshot.fase, snapshot.estados.map(line => line.estado),
      this.minigame.valves.map(valve => Math.ceil(valve.turned / (Math.PI * 2) - 1e-6)),
    ]);
    if (status !== this._lastStatus) {
      this._lastStatus = status;
      this.opts.onStatus?.(this.minigame);
    }
  }

  render(renderer) {
    if (!this.minigame) return;
    renderer.begin(null);
    this.minigame.render(renderer);
    renderer.end();
  }

  destroy() { this.minigame?.unmount(); }
}
