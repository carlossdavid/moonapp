/**
 * Atlas de barras propuesto en assets/Sprites/barras/_preview.png.
 *
 * La hoja es 760×620 y contiene:
 *  - iconos sueltos (manzana, gota, rayo, engranaje);
 *  - 4 grupos de 5 barras verticales (comida, batería, oxígeno, agua);
 *  - 6 arcos amarillos (mitad derecha, niveles 0-5);
 *  - 3 anillos azules completos (niveles 0-2).
 *
 * Solo se leen coordenadas: el PNG original no se modifica.
 */

export const ATLAS_URL = './assets/Sprites/barras/_preview.png';
export const ATLAS_KEY = 'barras_preview';
export const ATLAS_ANCHO = 760;
export const ATLAS_ALTO = 620;

/** Tono verde usado para retintar en memoria la barra de comida. */
export const VERDE_COMIDA_HUE = 118;

export const ICONOS = Object.freeze({
  manzana: { x: 25, y: 25, w: 70, h: 60 },
  gota: { x: 135, y: 30, w: 50, h: 55 },
  rayo: { x: 235, y: 20, w: 55, h: 75 },
  engranaje: { x: 325, y: 20, w: 70, h: 70 },
});

/** 5 niveles: 0 %, 25 %, 50 %, 75 %, 100 %. Cada barra mide 24×80. */
export const BARRAS = Object.freeze({
  comida: { y: 122, w: 24, h: 80, niveles: [22, 56, 90, 124, 158] },
  bateria: { y: 122, w: 24, h: 80, niveles: [202, 236, 270, 304, 338] },
  oxigeno: { y: 122, w: 24, h: 80, niveles: [382, 416, 450, 484, 518] },
  agua: { y: 122, w: 24, h: 80, niveles: [562, 596, 630, 664, 698] },
});

/** 6 niveles: 0 %, 20 %, 40 %, 60 %, 80 %, 100 %. Cada arco mide 60×120. */
export const ARCOS = Object.freeze({
  y: 232,
  w: 60,
  h: 120,
  niveles: [22, 97, 172, 247, 322, 397],
});

/** 3 niveles: 0 %, 50 %, 100 %. Cada anillo mide 120×120. */
export const ANILLOS = Object.freeze({
  y: 352,
  w: 120,
  h: 120,
  niveles: [22, 202, 382],
});

/** Normaliza al rango 0..100 aceptando porcentajes (80) o proporciones (0.8). */
export function normalizarPorcentaje(valor) {
  if (!Number.isFinite(valor)) return null;
  const ratio = valor > 1 ? valor / 100 : valor;
  return Math.max(0, Math.min(100, ratio * 100));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Barras verticales: 5 niveles (0, 25, 50, 75, 100 %). */
export function nivelBarra(pct) {
  return clamp(Math.round(normalizarPorcentaje(pct) / 25), 0, 4);
}

/** Arcos amarillos de energía: 6 niveles (0, 20, 40, 60, 80, 100 %). */
export function nivelArco(pct) {
  return clamp(Math.round(normalizarPorcentaje(pct) / 20), 0, 5);
}

/** Anillos azules de oxígeno: 3 niveles (0, 50, 100 %). */
export function nivelAnillo(pct) {
  return clamp(Math.round(normalizarPorcentaje(pct) / 50), 0, 2);
}

/** @returns {[number, number, number]} tono 0..360, saturación 0..1, luminosidad 0..1 */
export function rgbAHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

/** @returns {[number, number, number]} RGB 0..255 */
export function hslARgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) { r = c; g = x; } else if (hh < 120) { r = x; g = c; }
  else if (hh < 180) { g = c; b = x; } else if (hh < 240) { g = x; b = c; }
  else if (hh < 300) { r = x; b = c; } else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * Retinta un píxel al tono indicado manteniendo saturación y luminosidad.
 * Los píxeles casi desaturados (contornos y marcos) se conservan.
 * @returns {[number, number, number]}
 */
export function teñirPixel(r, g, b, tono) {
  const [h, s, l] = rgbAHsl(r, g, b);
  if (s < 0.3 || l < 0.08 || l > 0.92) return [r, g, b];
  return hslARgb(tono, Math.min(1, s * 0.85), l);
}

/** Comprueba que todos los rectángulos del atlas existen dentro de la hoja. */
export function validarAtlas() {
  const errores = [];
  const comprueba = (nombre, r) => {
    if (![r.x, r.y, r.w, r.h].every(Number.isInteger)) {
      errores.push(`${nombre}: coordenadas no enteras`);
      return;
    }
    if (r.x < 0 || r.y < 0 || r.x + r.w > ATLAS_ANCHO || r.y + r.h > ATLAS_ALTO) {
      errores.push(`${nombre}: (${r.x},${r.y},${r.w},${r.h}) sale del atlas ${ATLAS_ANCHO}×${ATLAS_ALTO}`);
    }
    if (r.w <= 0 || r.h <= 0) errores.push(`${nombre}: tamaño no positivo`);
  };

  for (const [nombre, rect] of Object.entries(ICONOS)) comprueba(`icono:${nombre}`, rect);
  for (const [recurso, grupo] of Object.entries(BARRAS)) {
    if (!Array.isArray(grupo.niveles) || grupo.niveles.length !== 5) {
      errores.push(`barra:${recurso}: se esperaban 5 niveles`);
    }
    grupo.niveles.forEach((x, i) => comprueba(`barra:${recurso}[${i}]`, { x, y: grupo.y, w: grupo.w, h: grupo.h }));
  }
  if (ARCOS.niveles.length !== 6) errores.push('arcos: se esperaban 6 niveles');
  ARCOS.niveles.forEach((x, i) => comprueba(`arco[${i}]`, { x, y: ARCOS.y, w: ARCOS.w, h: ARCOS.h }));
  if (ANILLOS.niveles.length !== 3) errores.push('anillos: se esperaban 3 niveles');
  ANILLOS.niveles.forEach((x, i) => comprueba(`anillo[${i}]`, { x, y: ANILLOS.y, w: ANILLOS.w, h: ANILLOS.h }));

  return errores;
}
