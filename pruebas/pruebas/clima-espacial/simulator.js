export const DAY_SECONDS = 10 * 60; // Diez minutos reales de juego a velocidad normal.
const TYPES = ['FLR', 'CME', 'GST'];

function seededRandom(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('La semilla debe ser un entero de 32 bits');
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function probability(rate) {
  if (!rate || !Number.isFinite(rate.numerador) || !Number.isFinite(rate.denominador) ||
      rate.denominador <= 0 || rate.numerador < 0 || rate.numerador > rate.denominador) {
    throw new Error('Frecuencia DONKI inválida');
  }
  return rate.numerador / rate.denominador;
}

const clamp = value => Math.max(0, Math.min(100, value));

/**
 * Reloj continuo de 10 min por jornada de JUEGO. Como máximo una
 * oportunidad de sorteo por día, en un momento elegido por la semilla.
 * No representa las horas ni los días terrestres de los archivos DONKI.
 */
export function createWeatherSimulator(model, { seed = 2026 } = {}) {
  const random = seededRandom(seed);
  let rates, linked;
  function updateModel(next) {
    if (!next?.tasasCandidatas || !next?.tasasEncadenadas) {
      throw new Error('Modelo de simulación inválido');
    }
    for (const type of [...TYPES, 'SEP']) probability(next.tasasCandidatas[type]);
    probability(next.tasasEncadenadas.FLR_CME);
    probability(next.tasasEncadenadas.CME_SEP);
    rates = next.tasasCandidatas;
    linked = next.tasasEncadenadas;
  }
  updateModel(model);

  let elapsed = 0;
  const rollTimeForDay = dayStart => dayStart + 60 + random() * 480;
  let nextSample = rollTimeForDay(0);
  let previousType = null;
  let lastCmeTrajectory = null;
  let sequence = 0;
  const episodes = [];

  function simulatedEvidence(type) {
    if (type === 'CME') {
      const trajectory = ['compatible', 'desviada', 'desconocida'][Math.floor(random() * 3)];
      lastCmeTrajectory = trajectory;
      return { trajectory, speedKms: Math.round(1000 + random() * 900) };
    }
    if (type === 'SEP') {
      // Escenarios inventados de juego, NO pronóstico ni conversión de DONKI.
      const lunarChance = lastCmeTrajectory === 'compatible' ? 0.55
        : lastCmeTrajectory === 'desviada' ? 0.12 : 0.25;
      const lunarNearby = random() < lunarChance;
      return {
        goesPfu: random() < 0.7 ? Math.round(10 + random() * 65) : Math.round(random() * 9),
        lunarNearby,
        localIndex: lunarNearby && random() < 0.5 ? Math.round(45 + random() * 45) : null
      };
    }
    if (type === 'GST') return { kp: 5 + Math.floor(random() * 4) };
    return {};
  }

  function begin(type, { test = false, chained = false, evidence } = {}) {
    const item = {
      id: ++sequence, type, time: elapsed, test, chained,
      ...(test ? evidence : simulatedEvidence(type))
    };
    episodes.push(item);
    // El efecto visual ya se ha disipado tras varios ciclos.
    if (episodes.length > 100) episodes.splice(0, episodes.length - 100);
    if (!test) previousType = type;
    return item;
  }

  function sample() {
    let type = null;
    let chained = false;
    const continuation = previousType === 'FLR'
      ? { type: 'CME', rate: linked.FLR_CME }
      : previousType === 'CME'
        ? { type: 'SEP', rate: linked.CME_SEP }
        : null;
    if (continuation && random() < probability(continuation.rate)) {
      type = continuation.type;
      chained = true;
    } else {
      const candidates = TYPES.filter(candidate => random() < probability(rates[candidate]));
      if (candidates.length) type = candidates[Math.floor(random() * candidates.length)];
    }
    previousType = null; // Un enlace no queda pendiente si este sorteo no lo produce.
    return type ? begin(type, { chained }) : null;
  }

  function advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > DAY_SECONDS) {
      throw new Error('Intervalo de simulación inválido');
    }
    const alerts = [];
    const until = elapsed + seconds;
    while (nextSample <= until) {
      elapsed = nextSample;
      const alert = sample();
      if (alert) alerts.push(alert);
      const nextDayStart = Math.floor(nextSample / DAY_SECONDS) * DAY_SECONDS + DAY_SECONDS;
      nextSample = rollTimeForDay(nextDayStart);
    }
    elapsed = until;
    return alerts;
  }

  function readings() {
    // Los números son índices de interfaz inventados, no flujo físico ni Kp.
    let solar = 15 + 3 * Math.sin(elapsed / 8);
    let particles = 9 + 2 * Math.sin(elapsed / 11 + 1);
    let earth = 12 + 2 * Math.sin(elapsed / 14);
    for (const episode of episodes) {
      const age = elapsed - episode.time;
      if (age < 0 || age > 320) continue;
      if (episode.type === 'FLR') solar += 68 * Math.exp(-age / 22);
      if (episode.type === 'CME') {
        solar += 38 * Math.exp(-age / 48);
        particles += 12 * Math.exp(-age / 38);
      }
      if (episode.type === 'SEP') particles += 75 * Math.exp(-age / 42);
      if (episode.type === 'GST') earth += 72 * Math.exp(-age / 60);
    }
    return {
      solar: Math.round(clamp(solar)),
      particles: Math.round(clamp(particles)),
      earth: Math.round(clamp(earth))
    };
  }

  return {
    advance,
    readings,
    updateModel,
    testAlert: (scenario = 'goes') => {
      const examples = {
        goes: { type: 'SEP', evidence: { goesPfu: 18, lunarNearby: false, localIndex: null } },
        lunar: { type: 'SEP', evidence: { goesPfu: 18, lunarNearby: true, localIndex: null } },
        station: { type: 'SEP', evidence: { goesPfu: 18, lunarNearby: true, localIndex: 82 } },
        cmeAway: { type: 'CME', evidence: { trajectory: 'desviada', speedKms: 730 } },
        gst: { type: 'GST', evidence: { kp: 6 } }
      };
      const example = examples[scenario];
      if (!example) throw new Error('Escenario de prueba desconocido');
      return begin(example.type, { test: true, evidence: example.evidence });
    },
    get elapsed() { return elapsed; },
    get day() { return Math.floor(elapsed / DAY_SECONDS) + 1; },
    get secondsRemaining() { return DAY_SECONDS - elapsed % DAY_SECONDS; }
  };
}
