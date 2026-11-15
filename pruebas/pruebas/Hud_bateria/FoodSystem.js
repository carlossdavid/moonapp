import { HORAS_POR_DIA, SEGUNDOS_REALES_POR_DIA } from '../../src/systems/EnergySystem.js';

export const SEGUNDOS_REALES_HASTA_60 = 170;
const HORAS_JUEGO_HASTA_60 = SEGUNDOS_REALES_HASTA_60 * HORAS_POR_DIA / SEGUNDOS_REALES_POR_DIA;

/** 100 % al iniciar; 60 % tras 170 s reales (13,6 h de juego).
 * Sin comidas implementadas, continúa descendiendo al mismo ritmo hasta 0 %.
 * El tiempo procede de SistemaEnergia: no se crea un segundo reloj.
 */
export function foodPercent(elapsedGameHours) {
  if (!Number.isFinite(elapsedGameHours)) return 100;
  return Math.max(0, Math.min(100, 100 - Math.max(0, elapsedGameHours) * (40 / HORAS_JUEGO_HASTA_60)));
}
