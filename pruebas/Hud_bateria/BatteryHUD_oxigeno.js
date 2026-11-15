import { normalizarPorcentaje } from './atlasBarras.js';

/**
 * Rutas de sprite para la barra de oxígeno en la hoja _preview.png.
 * Cada entrada: { x, y, w, h, morado } donde morado es el tono RGB
 * al que se retintará el sprite (los sprites originales son naranjas/rojos).
 * El color morado por defecto es [128, 0, 128].
 */
const O2_SPRITE_RECTS = [
  { x: 382, y: 122, w: 24, h: 80, morado: [128, 0, 128] }, // nivel 0 (vacío)
  { x: 416, y: 122, w: 24, h: 80, morado: [128, 0, 128] }, // nivel 1 (25%)
  { x: 450, y: 122, w: 24, h: 80, morado: [128, 0, 128] }, // nivel 2 (50%)
  { x: 484, y: 122, w: 24, h: 80, morado: [128, 0, 128] }, // nivel 3 (75%)
  { x: 518, y: 122, w: 24, h: 80, morado: [128, 0, 128] }, // nivel 4 (100%)
];

/**
 * Datos del HUD de barras (óxígeno, batería, comida, agua).
 * Se actualiza con setHUDData() y se dibuja con drawBatteryHUD().
 */
let cachedHUDData = {
  oxygenPct: null,
  batteryPct: null,
  foodPct: null,
  waterPct: null,
  centro: null,
  alerta: false,
};

/**
 * Carga y fusiona los datos del JSON oxygen_system.json con los datos
 * recibidos por parámetro. Se llama internamente o desde el arranque.
 * @param {{oxygenPct?:number, batteryPct?:number, foodPct?:number, waterPct?:number, centro?:{x:number,y:number}, alerta?:boolean}} datos
 */
function loadO2JSONAndSet(datos) {
  // Leer JSON local si no hay datos override
  if (datos.oxygenPct === undefined) {
    try {
      const jsonPath = path.join(__dirname, 'oxygen_system.json');
      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const json = JSON.parse(raw);
        // Usar valores del JSON como respaldo
        if (json.oxygen != null && datos.oxygenPct === undefined) {
          datos = { ...datos, oxygenPct: json.oxygen };
        }
        if (json.battery != null && datos.batteryPct === undefined) {
          datos = { ...datos, batteryPct: json.battery };
        }
      }
    } catch (e) {
      console.warn('No se pudo cargar oxygen_system.json:', e);
    }
  }
  setHUDData(datos);
}

/**
 * Establece los datos que el HUD dibujará a continuación.
 * @param {{oxygenPct?:number, batteryPct?:number, foodPct?:number, waterPct?:number, centro?:{x:number,y:number}, alerta?:boolean}} datos
 */
export function setHUDData(datos) {
  cachedHUDData = {
    oxygenPct: datos.oxygenPct != null ? normalizarPorcentaje(datos.oxygenPct) : null,
    batteryPct: datos.batteryPct != null ? Math.min(10, Math.ceil(datos.batteryPct / 10)) : null,
    foodPct: datos.foodPct != null ? Math.max(0, Math.min(100, datos.foodPct)) : null,
    waterPct: datos.waterPct != null ? Math.max(0, Math.min(100, datos.waterPct)) : null,
    centro: datos.centro || null,
    alerta: datos.alerta ?? false,
  };
}

/** @returns {typeof cachedHUDData} */
export function getHUDData() {
  return { ...cachedHUDData };
}

/**
 * Dibuja el HUD de barras usando la hoja de sprites de `assets/Sprites/barras/_preview.png`.
 * Incluye:
 * - Anillo amarillo de energía (arco derecha + espejo) 6 niveles (0,20,40,60,80,100%).
 * - Anillo azul de oxígeno (anillo completo) 3 niveles (0,50,100%).
 * - Barras laterales de comida (verde, retintada en memoria) y agua.
 * - Nueva barra de oxígeno lateral usando sprites retintados al color cian.
 * Debe llamarse dentro de renderer.begin()/end() después de setHUDData().
 * @param {import('../../src/graphics/Renderer.js').Renderer} renderer
 */
export function drawBatteryHUD(renderer) {
  const atlas = renderer.assets?.get('barras_preview');
  if (!atlas) return;

  const datos = getHUDData();
  const ctx = renderer.context;
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  if (datos.centro) {
    const cx = Math.round(datos.centro.x);
    const cy = Math.round(datos.centro.y);

    // --- Anillo amarillo de energía (6 niveles) ---
    const bateriaLevel = datos.batteryPct != null ? Math.round(datos.batteryPct / 20) : 0;
    const bateriaNivel = Math.min(5, Math.max(0, bateriaLevel));
    const fxB = 22 + bateriaNivel * 65;
    const d = 52;
    const xB = cx - d / 2;
    const yB = cx - d / 2;

    ctx.drawImage(atlas, fxB, 232, 60, 120, xB, yB, d, d);
    ctx.save();
    ctx.translate(xB + d, yB);
    ctx.scale(-1, 1);
    ctx.drawImage(atlas, fxB, 232, 60, 120, 0, 0, d, d);
    ctx.restore();

    // --- Anillo azul de oxígeno (3 niveles) ---
    const oxigenoLevel = datos.oxygenPct != null ? Math.round(datos.oxygenPct / 50) : 0;
    const oxigenoNivel = Math.min(2, Math.max(0, oxigenoLevel));
    const fxO = 22 + oxigenoNivel * 120;
    const dO = 40;

    ctx.drawImage(atlas, fxO, 352, 120, 120, cx - dO / 2, cy - dO / 2, dO, dO);
  }

  // --- Barras laterales ---
  const ctx2 = ctx;

  // Comida: sprite de manzana + barra vertical del atlas.
  const comidaNivel = datos.foodPct != null ? Math.round(datos.foodPct / 25) : 0;
  ctx2.drawImage(atlas, 22 + comidaNivel * 24, 122, 24, 80, 5, 15, 24, 80);

  // Agua: barra del atlas (atenuada si sin datos).
  const aguaNivel = datos.waterPct != null ? Math.round(datos.waterPct / 10) : 0;
  ctx2.globalAlpha = datos.waterPct == null ? 0.4 : 1;
  ctx2.drawImage(atlas, 562 + aguaNivel * 24, 122, 24, 80, 5, 70, 24, 80);
  ctx2.globalAlpha = 1;

  // --- NUEVA: Barra de oxígeno lateral ---
  // Usa los sprites del atlas en la sección derecha (x: 382-518, y: 122)
  // y los retinta al color morado representativo del O₂.
  if (datos.oxygenPct != null) {
    const o2Nivel = Math.round(datos.oxygenPct / 25); // 0-4
    const o2Sprite = O2_SPRITE_RECTS[Math.min(4, Math.max(0, o2Nivel))];
    const [mR, mG, mB] = o2Sprite.morado;
    // Retintado en memoria: dibujamos el sprite y recoloramos los píxeles naranjas
    const spriteW = o2Sprite.w;
    const spriteH = o2Sprite.h;
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = spriteW;
    tmpCanvas.height = spriteH;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(atlas, o2Sprite.x, o2Sprite.y, spriteW, spriteH, 0, 0, spriteW, spriteH);
    const imgData = tmpCtx.getImageData(0, 0, spriteW, spriteH);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      // Si el pixel es rojo/naranja (aproximado: alto rojo, bajo verde/azul)
      if (d[i] > 90 && d[i + 1] < 120 && d[i + 2] < 120 && d[i + 3] > 0) {
        d[i] = mR;     // rojo → morado
        d[i + 1] = mG; // verde → morado
        d[i + 2] = mB; // azul → morado
      }
    }
    tmpCtx.putImageData(d, 0, 0);
    // Dibujar el sprite retintado en la barra lateral (izquierda, arriba de comida)
    ctx2.drawImage(tmpCanvas, 5, 5, spriteW, spriteH);
  }

  ctx2.font = '4px "Press Start 2P", monospace';
  ctx2.textAlign = 'left';
  ctx2.textBaseline = 'top';
  ctx2.fillStyle = '#eaf6ff';

  if (datos.oxygenPct != null) {
    ctx2.fillText(`${Math.round(datos.oxygenPct)}% O2`, 5, 3);
  }
  if (datos.batteryPct != null) {
    ctx2.fillText(`Bateria ${Math.round(datos.batteryPct)}%`, 5, 15);
  }
  if (datos.foodPct != null) {
    ctx2.fillText(`Alim ${Math.round(datos.foodPct)}%`, 5, 27);
  }
  if (datos.waterPct != null) {
    ctx2.fillText(`Agua ${Math.round(datos.waterPct)}%`, 5, 39);
  }

  ctx.restore();
} export { normalizarPorcentaje, loadO2JSONAndSet };