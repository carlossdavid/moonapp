/**
 * Mazo DONKI independiente de la escena de P1.
 * Las tasas son frecuencias de una muestra archivada, NO pronósticos lunares.
 */
const DECK_URL = new URL('./eventos-donki.json', import.meta.url);
const TYPES = ['FLR', 'CME', 'SEP', 'GST'];

export async function loadSpaceWeatherEvents() {
  const response = await fetch(DECK_URL);
  if (!response.ok) throw new Error(`No se pudieron cargar las alertas (${response.status})`);
  const deck = await response.json();
  if (!Array.isArray(deck.eventos) || !deck.modeloProbabilistico ||
    !TYPES.every((type) =>
      deck.eventos.filter((event) => event.tipo === type).length === 1 &&
      deck.modeloProbabilistico.tasasCandidatas?.[type]
    ) ||
    !deck.eventos.every((event) =>
    TYPES.includes(event.tipo) &&
    typeof event.urlNASA === 'string' &&
    Array.isArray(event.opciones) && event.opciones.length >= 2
  )) {
    throw new Error('El mazo DONKI tiene un formato no válido');
  }
  return deck;
}

function ratio(rate) {
  if (!rate || !Number.isInteger(rate.numerador) || !Number.isInteger(rate.denominador) ||
    rate.denominador < 1 || rate.numerador < 0 || rate.numerador > rate.denominador) {
    throw new Error('Frecuencia DONKI no válida');
  }
  return rate.numerador / rate.denominador;
}

/**
 * Un llamado a next() = una oportunidad de muestreo en un turno de juego.
 * Los enlaces FLR->CME->SEP se generan con tasas condicionales archivadas;
 * GST es siempre una observación terrestre, no un riesgo lunar.
 * Como se muestra COMO MÁXIMO una tarjeta por turno y cada caso una vez,
 * las tasas candidatas NO son la frecuencia final de tarjetas mostradas.
 */
export function createSpaceWeatherGenerator(deck, { random = Math.random } = {}) {
  if (typeof random !== 'function') throw new Error('Se necesita un generador aleatorio');
  const byType = new Map(deck.eventos.map((event) => [event.tipo, event]));
  const rates = deck.modeloProbabilistico.tasasCandidatas;
  const linked = deck.modeloProbabilistico.tasasEncadenadas;
  const seen = new Set();
  let previousType = null;
  let turn = 0;

  function next() {
    turn++;
    const potential = previousType === 'FLR'
      ? { type: 'CME', rate: linked.FLR_CME }
      : previousType === 'CME'
        ? { type: 'SEP', rate: linked.CME_SEP }
        : null;
    let selected = null;
    let origin = null;
    let appliedRate = null;
    if (potential && !seen.has(potential.type) && random() < ratio(potential.rate)) {
      selected = potential.type;
      origin = 'cadena';
      appliedRate = potential.rate;
    } else {
      const candidates = TYPES.filter((type) =>
        !seen.has(type) && random() < ratio(rates[type])
      );
      if (candidates.length) {
        selected = candidates[Math.floor(random() * candidates.length)];
        origin = 'frecuencia-base';
        appliedRate = rates[selected];
      }
    }
    // Si no hay alerta, la relación no queda pendiente indefinidamente.
    previousType = selected;
    if (!selected) return { turn, event: null, origin: null, rate: null };
    seen.add(selected);
    return { turn, event: byType.get(selected), origin, rate: appliedRate };
  }
  return { next };
}

/** Semilla opcional para repetir exactamente una partida durante pruebas o demo. */
export function seededRandom(seed) {
  if (!Number.isInteger(seed)) throw new Error('La semilla debe ser un entero');
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Resuelve una opción; el llamador decide si acepta el estado nuevo.
 * Máximo de exposición y demás condiciones pertenecen al juego, no a DONKI.
 */
export function resolveSpaceWeatherChoice(event, optionId, resources) {
  const option = event.opciones.find((candidate) => candidate.id === optionId);
  if (!option) throw new Error(`Opción no disponible: ${optionId}`);
  const next = { ...resources };
  for (const [key, delta] of Object.entries(option.efectosDeJuego)) {
    if (!Number.isFinite(delta) || !Number.isFinite(next[key])) {
      throw new Error(`Recurso no válido para la alerta: ${key}`);
    }
    next[key] += delta;
  }
  return { resources: next, outcome: option.resultado };
}
