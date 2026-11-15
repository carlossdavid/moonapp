import { Scene } from './Scene.js';
import { RecargaOxigeno } from '../minigames/RecargaOxigeno.js';

/**
 * Escena contenedora del minijuego "Recarga de oxígeno".
 *
 * Monta el minijuego directamente al canvas y lo arranca en fase CONECTAR.
 * La escena no usa cámara ni entidades: delega todo el render a
 * `RecargaOxigeno.render(renderer)` dentro de un `renderer.begin(null)/end()`.
 */
export class RecargaOxigenoScene extends Scene {
  /**
   * @param {import('../core/Game.js').Game} game
   * @param {{
   *   onComplete?: (minigame: RecargaOxigeno) => void,
   *   onCancel?: (minigame: RecargaOxigeno) => void,
   *   valvulasNecesarias?: number,
   * }} [opts]
   */
  constructor(game, opts = {}) {
    super(game);
    this.opts = opts;
    /** @type {RecargaOxigeno|null} */
    this.minigame = null;
  }

  async init() {
    const canvas = this.game.canvas;
    if (!canvas) throw new Error('Canvas no disponible en RecargaOxigenoScene');

    // Cargar sprites del minijuego desde el AssetLoader del juego
    const sprites = this._cargarSprites();

    this.minigame = new RecargaOxigeno({
      onComplete: this.opts.onComplete ?? (() => this._onComplete()),
      onCancel: this.opts.onCancel ?? (() => this._onCancel()),
      valvulasNecesarias: this.opts.valvulasNecesarias,
      sprites,
    });

    this.minigame.mount(canvas);
  }

  /**
   * Obtiene los sprites necesarios del AssetLoader.
   * @returns {Object} Objeto con los sprites cargados
   */
  _cargarSprites() {
    const assets = this.game.assets;
    return {
      mochilaBase: assets.get('recarga_mochila_base'),
      puertoO2: assets.get('recarga_puerto_o2'),
      puertoCO2: assets.get('recarga_puerto_co2'),
      tanqueO2: assets.get('recarga_tanque_o2_con_manguera'),
      tanqueCO2: assets.get('recarga_tanque_co2_con_manguera'),
      manija: assets.get('recarga_manija'),
      manijaGiro: assets.get('recarga_manija_giro'),
      cilindroO2: assets.get('recarga_cilindro_o2'),
      cilindroCO2: assets.get('recarga_cilindro_co2'),
      iconoAutorizado: assets.get('recarga_icono_autorizado'),
      iconoAlerta: assets.get('recarga_icono_alerta'),
      fugaGas: assets.get('recarga_fuga_gas'),
    };
  }

  _onComplete() {
    // Hook de integración: enlazar aquí la recarga del traje y el regreso
    // a la escena anterior cuando se incorpore al juego principal.
  }

  _onCancel() {
    // No hay cancelación explícita en este minijuego, pero dejamos el hook.
  }

  /** @param {number} dt */
  update(dt) {
    if (this.minigame) this.minigame.update(dt);
  }

  /**
   * @param {import('../graphics/Renderer.js').Renderer} renderer
   * @param {number} alpha
   */
  render(renderer, alpha) {
    if (!this.minigame) return;

    // El minijuego dibuja en coordenadas lógicas (screen-space).
    // Usamos begin(null) para que no aplique transform de cámara.
    renderer.begin(null);
    this.minigame.render(renderer);
    renderer.end();
  }

  /** Limpieza al cambiar de escena. */
  destroy() {
    if (this.minigame) {
      this.minigame.unmount();
      this.minigame = null;
    }
  }
}

export default RecargaOxigenoScene;
