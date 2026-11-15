export const BASE_LOCATION = 'Cerca de Shackleton (89,45° S; 222,69° E)';
export const GOES_S1_PFU = 10; // NOAA: protones >= 10 MeV medidos por GOES cerca de la Tierra.
export const LOCAL_SENSOR_ALERT = 60; // Umbral INVENTADO del sensor de juego, NO mSv.

/**
 * Tres niveles de evidencia, no un cálculo de dosis:
 * info -> precaución -> alteración local SIMULADA del exterior.
 * GOES y un instrumento en órbita lunar son observadores diferentes.
 */
export function assessRisk(event, { crew = 'refugio' } = {}) {
  if (!['refugio', 'eva'].includes(crew)) throw new Error('Actividad de tripulación inválida');
  const evidence = [];
  let level = 'info';
  let title = 'Observación sin impacto lunar confirmado';
  let action = 'Seguir vigilando. No asignar daño a la estación.';
  const type = event?.type;

  if (type === 'FLR') {
    evidence.push('Fulguración solar: por sí sola no mide partículas ni dosis lunar.');
  } else if (type === 'CME') {
    if (event.trajectory === 'compatible') {
      level = 'precaution';
      title = 'Trayectoria posiblemente compatible';
      action = 'Preparar seguimiento y revisar partículas; no asumir impacto.';
      evidence.push('Dirección hacia el entorno Tierra–Luna: estimación simulada, no impacto confirmado.');
    } else if (event.trajectory === 'desviada') {
      evidence.push('Dirección estimada fuera del entorno Tierra–Luna: sin amenaza directa por esta CME.');
    } else {
      evidence.push('Sin dirección fiable: no se puede afirmar que vaya hacia la Luna.');
    }
    if (Number.isFinite(event.speedKms)) {
      evidence.push(`Velocidad simulada: ${Math.round(event.speedKms)} km/s. La velocidad no indica destino.`);
    }
  } else if (type === 'SEP') {
    if (Number.isFinite(event.goesPfu) && event.goesPfu >= 0) {
      evidence.push(`GOES simulado cerca de la Tierra: ${event.goesPfu} pfu (protones ≥10 MeV); no es dosis lunar.`);
      if (event.goesPfu >= GOES_S1_PFU) {
        level = 'precaution';
        title = 'Precaución por partículas cerca de la Tierra';
        action = crew === 'eva' ? 'Valorar suspender EVA y buscar refugio.' : 'Mantener el refugio listo y vigilar.';
      }
    } else {
      evidence.push('El JSON SEP de DONKI solo indica el canal de energía; no incluye un flujo en pfu.');
    }
    if (event.lunarNearby === true) {
      level = 'precaution';
      title = 'Partículas detectadas cerca de la Luna';
      action = crew === 'eva' ? 'Suspender EVA por precaución.' : 'Permanecer atento en el refugio.';
      evidence.push('Instrumento lunar ficticio en órbita: indica el entorno, NO mide dentro de la estación.');
    } else {
      evidence.push('Sin lectura de un instrumento próximo a la Luna.');
    }
    if (Number.isFinite(event.localIndex) && event.localIndex >= 0 &&
        event.localIndex <= 100) {
      evidence.push(`Sensor exterior ficticio de Shackleton: ${event.localIndex}/100 (índice del juego, NO mSv).`);
      if (event.localIndex >= LOCAL_SENSOR_ALERT) {
        level = 'local';
        title = 'Alteración exterior medida en la simulación';
        action = crew === 'eva'
          ? 'Tripulación en EVA: regresar al refugio. Consecuencias aún sin conectar a recursos.'
          : 'Tripulación en refugio: el exterior está alterado; NO se ha calculado dosis personal.';
      }
    } else {
      evidence.push('Sin lectura local: no se confirma efecto sobre la estación.');
    }
  } else if (type === 'GST') {
    evidence.push('Kp describe el campo magnético TERRESTRE, no la exposición lunar.');
    if (Number.isFinite(event.kp)) evidence.push(`Kp terrestre simulado: ${event.kp}/9 (sin unidad).`);
  } else {
    throw new Error('Fenómeno no reconocido');
  }
  return { level, title, action, evidence, crew };
}
