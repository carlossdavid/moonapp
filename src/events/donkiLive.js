/**
 * Consulta los registros recientes de la API pública de CCMC DONKI.
 * No requiere ni acepta api_key: el juego está publicado como frontend estático.
 * «Reciente» significa registrado/publicado en DONKI, no impacto en la Luna.
 */
export const DONKI_TYPES = Object.freeze(['FLR', 'CME', 'SEP', 'GST']);
export const LIVE_POLL_MS = 5 * 60 * 1000;
export const RATE_LIMIT_POLL_MS = 30 * 60 * 1000;
const BASE_URL = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get';
const EVENT_TIME = { FLR: 'beginTime', CME: 'startTime', SEP: 'eventTime', GST: 'startTime' };
const EVENT_ID = { FLR: 'flrID', CME: 'activityID', SEP: 'sepID', GST: 'gstID' };

export function normalizeDonkiEvent(type, raw) {
  if (!DONKI_TYPES.includes(type)) throw new Error(`Tipo DONKI desconocido: ${type}`);
  const id = raw?.[EVENT_ID[type]];
  const time = raw?.[EVENT_TIME[type]];
  if (typeof id !== 'string' || !Number.isFinite(Date.parse(time))) return null;
  const notification = (raw.sentNotifications || []).find(
    (item) => typeof item?.messageID === 'string'
  );
  const analysis = type === 'CME'
    ? (raw.cmeAnalyses || []).find((item) =>
      item?.isMostAccurate && item?.featureCode === 'LE'
    )
    : null;
  const observed = {
    type,
    id,
    time,
    instrument: (raw.instruments || [])
      .map((item) => item?.displayName).filter(Boolean).join(', '),
    linkedIds: (raw.linkedEvents || []).map((item) => item?.activityID).filter(Boolean),
    notificationId: notification?.messageID || null,
    notificationUrl: notification?.messageURL || null,
    url: raw.link || 'https://ccmc.gsfc.nasa.gov/DONKI/events/',
    detail: '',
    guidance: ''
  };
  switch (type) {
    case 'FLR':
      observed.detail = `Fulguración ${raw.classType || 'de clase sin indicar'}`;
      observed.guidance = 'Observar y comprobar información; una fulguración sola no prueba dosis lunar.';
      break;
    case 'CME':
      observed.detail = `CME observada${analysis?.speed ? `; velocidad LE estimada ${Math.round(analysis.speed)} km/s` : ''}`;
      observed.guidance = 'Revisar trayectoria y avisos; no asumir impacto ni dosis en la base lunar.';
      break;
    case 'SEP':
      observed.detail = 'Partículas solares registradas por un instrumento o modelo';
      observed.guidance = 'En un escenario de entrenamiento con riesgo lunar, suspender EVA y buscar refugio. Esta observación no mide la dosis en la base.';
      break;
    case 'GST': {
      const kp = (raw.allKpIndex || []).map((item) => item.kpIndex).filter(Number.isFinite);
      observed.detail = `Tormenta geomagnética terrestre${kp.length ? `; Kp registrado hasta ${Math.max(...kp)}` : ''}`;
      observed.guidance = 'Kp describe el campo magnético de la Tierra; no produce daño lunar automático.';
      break;
    }
  }
  return observed;
}

/**
 * Permite resultados parciales: si un tipo falla se conservan los otros.
 * El llamador no debe interpretar registros antiguos devueltos en el primer
 * sondeo como «una tormenta que acaba de suceder».
 */
export async function fetchDonkiRecent({
  now = new Date(),
  fetchImpl = fetch,
  days = 7,
  timeoutMs = 12000
} = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) ||
      !Number.isInteger(days) || days < 1 || days > 30) {
    throw new Error('Ventana DONKI no válida');
  }
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  const results = await Promise.allSettled(DONKI_TYPES.map(async (type) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const params = new URLSearchParams({ startDate: start, endDate: end });
      const response = await fetchImpl(`${BASE_URL}/${type}?${params}`, {
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error(`DONKI ${type}: HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      const records = await response.json();
      if (!Array.isArray(records)) throw new Error(`DONKI ${type}: respuesta no válida`);
      return { type, events: records.map((raw) => normalizeDonkiEvent(type, raw)).filter(Boolean) };
    } finally {
      clearTimeout(timer);
    }
  }));
  const successfulTypes = [];
  const errors = [];
  const events = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successfulTypes.push(result.value.type);
      events.push(...result.value.events);
    } else {
      errors.push({ type: DONKI_TYPES[index], status: result.reason?.status || null });
    }
  });
  if (!successfulTypes.length) {
    const error = new Error('No se pudo consultar DONKI; usar respaldo archivado');
    error.rateLimited = errors.some((item) => item.status === 429);
    throw error;
  }
  return {
    events: events.sort((a, b) => Date.parse(b.time) - Date.parse(a.time)),
    successfulTypes,
    errors,
    fetchedAt: now.toISOString(),
    window: { start, end }
  };
}
