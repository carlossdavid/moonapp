/**
 * Reglas de puntuación de OPERACIÓN ELECTRÓLISIS.
 * Módulo puro (sin DOM) para poder probarlo con Node.
 *
 * Los resultados de energía y agua son INDICADORES SIMULADOS con fin educativo:
 * no representan una medición real de un electrolizador.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ElectrolisisScoring = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  /** Precisión en % = aciertos / disparos. Sin disparos vale 0. */
  function precision(hits, shots) {
    if (!shots || shots <= 0) return 0;
    return clamp(Math.round((hits / shots) * 100), 0, 100);
  }

  /**
   * Energía simulada (Wh). Cada acierto aporta entre 6 y 12 Wh según la
   * precisión: 12 × (0.5 + 0.5 × precisión/100).
   */
  function energy(hits, precisionPct) {
    if (hits <= 0) return 0;
    var factor = 0.5 + 0.5 * (clamp(precisionPct, 0, 100) / 100);
    return Math.round(hits * 12 * factor);
  }

  /**
   * Agua perdida simulada (%). Parte de una pérdida de base del 6 % por
   * operar la cámara y sube con cada fallo y con la imprecisión.
   */
  function waterLost(fails, precisionPct, shots) {
    if (!shots || shots <= 0) return 0;
    var raw = 6 + fails * 2.6 + (100 - clamp(precisionPct, 0, 100)) * 0.22;
    return clamp(Math.round(raw), 0, 100);
  }

  function rank(precisionPct, hits) {
    if (hits >= 18 && precisionPct >= 85) return 'ESPECIALISTA EN ELECTRÓLISIS';
    if (hits >= 12 && precisionPct >= 70) return 'TÉCNICO DE REACTOR';
    if (hits >= 6) return 'APRENDIZ DE PLANTA';
    return 'OPERADOR EN PRÁCTICAS';
  }

  function stars(precisionPct, hits) {
    if (hits >= 15 && precisionPct >= 85) return 3;
    if (hits >= 8 && precisionPct >= 65) return 2;
    if (hits >= 3) return 1;
    return 0;
  }

  /**
   * Resumen completo de la partida.
   * @param {{hits:number, wrong:number, misses:number, shots:number}} stats
   */
  function summary(stats) {
    var hits = Math.max(0, stats.hits || 0);
    var wrong = Math.max(0, stats.wrong || 0);
    var misses = Math.max(0, stats.misses || 0);
    var shots = Math.max(stats.shots || 0, hits + wrong + misses);
    var fails = wrong + misses;
    var prec = precision(hits, shots);
    return {
      hits: hits,
      wrong: wrong,
      misses: misses,
      fails: fails,
      shots: shots,
      precision: prec,
      energyWh: energy(hits, prec),
      waterPct: waterLost(fails, prec, shots),
      rank: rank(prec, hits),
      stars: stars(prec, hits)
    };
  }

  return {
    clamp: clamp,
    precision: precision,
    energy: energy,
    waterLost: waterLost,
    rank: rank,
    stars: stars,
    summary: summary
  };
});
