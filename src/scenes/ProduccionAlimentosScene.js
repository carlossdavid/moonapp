import { Scene } from './Scene.js';
import { ProduccionAlimentos, CULTIVOS_DEFECTO } from '../minigames/ProduccionAlimentos.js';

/**
 * Escena contenedora del módulo "Producción de alimentos".
 *
 * Carga el pack `sprites_simulador_luna` (carpeta `nativo`, pixel art 1:1) y el
 * JSON de cultivos, y delega todo el dibujo y la interacción al minijuego.
 */

export const BASE = './assets/Sprites/Producción alimentos/files (1)/sprites_simulador_luna/sprites/';
export const CONFIG_URL = './assets/Sprites/Producción alimentos/files (1)/config_cultivos.json';

/** clave local -> ruta relativa dentro de `sprites/nativo`. */
export const ARCHIVOS = {
  // ambiente
  feliz: 'ambiente/carita_feliz.png',
  normal: 'ambiente/carita_normal.png',
  triste: 'ambiente/carita_triste.png',
  co2Alto: 'ambiente/co2_alto.png',
  co2Bajo: 'ambiente/co2_bajo.png',
  co2Ideal: 'ambiente/co2_ideal.png',
  gotaLlena: 'ambiente/gota_llena.png',
  gotaMedia: 'ambiente/gota_media.png',
  gotaSeca: 'ambiente/gota_seca.png',
  flecha: 'ambiente/marcador_flecha.png',
  oxigeno: 'ambiente/oxigeno.png',
  termoCaliente: 'ambiente/termometro_caliente.png',
  termoFrio: 'ambiente/termometro_frio.png',
  termoIdeal: 'ambiente/termometro_ideal.png',

  // cosecha
  bandera: 'cosecha/bandera_meta.png',
  calendario: 'cosecha/calendario.png',
  canasta: 'cosecha/canasta.png',
  estrella: 'cosecha/estrella_exito.png',
  etapa0: 'cosecha/etapa0_semilla.png',
  etapa1: 'cosecha/etapa1_brote.png',
  etapa2: 'cosecha/etapa2_plantita.png',
  etapa3: 'cosecha/etapa3_planta_grande.png',
  etapa4: 'cosecha/etapa4_lista_para_cosechar.png',
  luna: 'cosecha/luna_dia.png',
  sol: 'cosecha/sol.png',

  // iluminación
  lamparaRojoOn: 'iluminacion/lampara_rojo_encendida.png',
  lamparaRojoOff: 'iluminacion/lampara_rojo_apagada.png',
  lamparaAzulOn: 'iluminacion/lampara_azul_encendida.png',
  lamparaAzulOff: 'iluminacion/lampara_azul_apagada.png',
  lamparaVerdeOn: 'iluminacion/lampara_verde_encendida.png',
  lamparaVerdeOff: 'iluminacion/lampara_verde_apagada.png',
  lamparaBlancoOn: 'iluminacion/lampara_blanco_encendida.png',
  lamparaBlancoOff: 'iluminacion/lampara_blanco_apagada.png',
  ledRojoOn: 'iluminacion/led_rojo_encendido.png',
  ledRojoOff: 'iluminacion/led_rojo_apagado.png',
  ledAzulOn: 'iluminacion/led_azul_encendido.png',
  ledAzulOff: 'iluminacion/led_azul_apagado.png',
  ledVerdeOn: 'iluminacion/led_verde_encendido.png',
  ledVerdeOff: 'iluminacion/led_verde_apagado.png',
  ledBlancoOn: 'iluminacion/led_blanco_encendido.png',
  ledBlancoOff: 'iluminacion/led_blanco_apagado.png',
  luminaria: 'iluminacion/luminaria_soporte.png',
  rayoRojo: 'iluminacion/rayo_rojo.png',
  rayoAzul: 'iluminacion/rayo_azul.png',
  rayoVerde: 'iluminacion/rayo_verde.png',
  rayoBlanco: 'iluminacion/rayo_blanco.png',

  // interfaz
  aplicar: 'ui/boton_aplicar.png',
  aplicarP: 'ui/boton_aplicar_presionado.png',
  mas: 'ui/boton_mas.png',
  masP: 'ui/boton_mas_presionado.png',
  menos: 'ui/boton_menos.png',
  menosP: 'ui/boton_menos_presionado.png',
  cajaRojo: 'ui/caja_valor_rojo.png',
  cajaAzul: 'ui/caja_valor_azul.png',
  cajaVerde: 'ui/caja_valor_verde.png',
  alerta: 'ui/icono_alerta.png',
  check: 'ui/icono_check.png',
  marco: 'ui/marco_panel_9slice.png',
  perilla: 'ui/perilla.png',
  segVacio: 'ui/segmento_vacio.png',
  segDias: 'ui/segmento_dias_lleno.png',
  segOptimo: 'ui/segmento_zona_optima_lleno.png',
};

/**
 * Carga una imagen con varios reintentos (la primera carga del pack son 62
 * archivos y algunos navegadores descartan peticiones si se lanzan todas a la vez).
 * @param {import('../graphics/AssetLoader.js').AssetLoader} assets
 * @param {string} key
 * @param {string} src
 * @param {number} [intentos]
 */
async function cargarImagen(assets, key, src, intentos = 3) {
  let ultimoError = null;
  for (let i = 0; i < intentos; i++) {
    try {
      return await assets.loadImage(key, src);
    } catch (e) {
      ultimoError = e;
      await new Promise((r) => setTimeout(r, 120 * (i + 1)));
    }
  }
  throw ultimoError;
}

/**
 * Carga perezosa de los sprites del pack (reutiliza el cache del AssetLoader).
 * @param {import('../graphics/AssetLoader.js').AssetLoader} assets
 * @returns {Promise<Record<string, HTMLImageElement|undefined>>}
 */
export async function cargarSprites(assets) {
  /** @type {Record<string, HTMLImageElement|undefined>} */
  const sprites = {};
  const entradas = Object.entries(ARCHIVOS);

  // Lotes pequeños para no saturar la red con 62 peticiones simultáneas.
  for (let i = 0; i < entradas.length; i += 8) {
    await Promise.all(entradas.slice(i, i + 8).map(async ([clave, rel]) => {
      const key = `pa_${clave}`;
      if (assets.has(key)) {
        sprites[clave] = /** @type {HTMLImageElement} */ (assets.get(key));
        return;
      }
      try {
        sprites[clave] = await cargarImagen(assets, key, encodeURI(`${BASE}${rel.replace('/', '/nativo/')}`));
      } catch (e) {
        console.warn(`[produccion-alimentos] No se pudo cargar ${rel}`, e);
        sprites[clave] = undefined;
      }
    }));
  }
  return sprites;
}

/**
 * Lee `config_cultivos.json` del pack; si falla usa los valores embebidos.
 * @returns {Promise<Record<string, any>>}
 */
export async function cargarCultivos() {
  try {
    const res = await fetch(encodeURI(CONFIG_URL), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.cultivos) return data.cultivos;
    }
  } catch (e) {
    console.warn('[produccion-alimentos] config_cultivos.json no disponible, usando valores embebidos', e);
  }
  return CULTIVOS_DEFECTO;
}

export class ProduccionAlimentosScene extends Scene {
  /**
   * @param {import('../core/Game.js').Game} game
   * @param {{ onExit?: () => void }} [opts]
   */
  constructor(game, opts = {}) {
    super(game);
    this.opts = opts;
    /** @type {ProduccionAlimentos|null} */
    this.minigame = null;
    this._tiempo = 0;
    /** @type {Error|null} */
    this.error = null;
  }

  async init() {
    try {
      const [sprites, cultivos] = await Promise.all([
        cargarSprites(this.game.assets),
        cargarCultivos(),
      ]);

      const onExit = this.opts.onExit || (() => {});
      const existente = this.game.produccionAlimentos;
      if (existente instanceof ProduccionAlimentos) {
        // Al volver al módulo se conserva la simulación (días, salud, cosechas).
        existente.sprites = sprites;
        existente.cultivos = cultivos && Object.keys(cultivos).length ? cultivos : CULTIVOS_DEFECTO;
        existente.onExit = onExit;
        this.minigame = existente;
      } else {
        this.minigame = new ProduccionAlimentos({ sprites, cultivos, onExit });
        // Guardar en el juego para que el estado sobreviva al cambio de escena.
        this.game.produccionAlimentos = this.minigame;
      }
    } catch (e) {
      console.error('[produccion-alimentos] Error al inicializar el módulo', e);
      this.error = e;
    }
  }

  /** @param {number} dt */
  update(dt) {
    this._tiempo += dt;
    if (!this.minigame) {
      // Mientras carga (o si falla) ESC vuelve al interior.
      if (this.game.input.isPressed('Escape')) this.opts.onExit?.();
      return;
    }
    this.minigame.setPointer(this.game.mouse.x, this.game.mouse.y);
    this.minigame.update(dt, this.game);
  }

  /**
   * Clic del jugador (lo reenvía `Game`).
   * @param {number} x @param {number} y
   */
  handlePointer(x, y) {
    if (this.minigame) this.minigame.pointerClick(x, y);
  }

  /**
   * @param {import('../graphics/Renderer.js').Renderer} renderer
   */
  render(renderer) {
    renderer.begin(null);
    if (!this.minigame) {
      this._renderCarga(renderer);
      renderer.end();
      return;
    }
    // Todo el módulo se dibuja en espacio de pantalla (sin cámara).
    this.minigame.render(renderer);
    renderer.end();
  }

  /** Pantalla de espera mientras se cargan los sprites del pack. */
  _renderCarga(renderer) {
    const ctx = renderer.context;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, 320, 180);

    // Estrellas simples para no dejar el fondo vacío
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + 13) % 320;
      const y = (i * 53 + 7) % 180;
      const a = 0.15 + ((i * 37) % 40) / 100;
      ctx.fillStyle = `rgba(190,220,255,${a.toFixed(3)})`;
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = '#eaf6ff';
    if (this.error) {
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('ERROR AL CARGAR', 160, 86);
      ctx.font = '4px "Press Start 2P", monospace';
      ctx.fillStyle = '#a9b7d8';
      ctx.fillText('ESC PARA VOLVER', 160, 100);
    } else {
      const puntos = '.'.repeat(1 + (Math.floor(this._tiempo * 3) % 3));
      ctx.fillText(`CARGANDO MODULO${puntos}`, 160, 86);
      ctx.font = '4px "Press Start 2P", monospace';
      ctx.fillStyle = '#69779f';
      ctx.fillText('PRODUCCION DE ALIMENTOS', 160, 100);
    }
  }

  drawUI() {}

  destroy() {
    this.minigame = null;
  }
}

export default ProduccionAlimentosScene;
