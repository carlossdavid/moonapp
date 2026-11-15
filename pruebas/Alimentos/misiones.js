import { CANALES, CULTIVOS, porcentaje } from './datos.js';

export const TOLERANCIA_RETO = .5;
export const REVISIONES = [
  { titulo: 'Preparar la cámara', falla: 'Perfil de luz equivocado', etapa: 2 },
  { titulo: 'Revisión del cultivo', falla: 'Canal principal apagado', etapa: 4 },
  { titulo: 'Recuperar la iluminación', falla: 'Dos canales descalibrados', etapa: 5 },
];
const FICHAS = {
  mizuna: {
    pregunta: 'En la tabla de Mizuna, ¿dónde se reportó el CO₂ de 2009–3011 ppm?',
    opciones: [['iss', 'En el ambiente de la ISS.'], ['veggie', 'Dentro de Veggie.'], ['traje', 'En el traje del astronauta.']],
    correcta: 'iss', explicacion: 'El CO₂ corresponde al ambiente ISS; temperatura y humedad se reportan dentro de Veggie.',
  },
  lechuga: {
    pregunta: 'Para la lechuga, ¿qué representa la humedad de 38,3–43,9 %?',
    opciones: [['iss', 'Un rango reportado en el ambiente de la ISS.'], ['optimo', 'Un objetivo óptimo universal.'], ['luna', 'Una medición actual de la Luna.']],
    correcta: 'iss', explicacion: 'Es un rango reportado en el ambiente ISS, no una receta óptima universal ni una lectura en vivo.',
  },
  chile: {
    pregunta: '¿Cómo debemos describir la temperatura del ají en nuestra tabla?',
    opciones: [['aproximada', 'Aproximadamente 23 °C.'], ['exacta', 'Siempre exactamente 23 °C.'], ['desconocida', 'No existe ninguna cifra en la tabla.']],
    correcta: 'aproximada', explicacion: 'La tabla indica aproximadamente 23 °C; no debemos quitar esa precisión del dato.',
  },
};
const fichaSinDatos = nombre => ({
  pregunta: `${nombre}: faltan cifras ambientales confirmadas. ¿Cómo completas la bitácora?`,
  opciones: [['sin_dato', 'Registro que faltan cifras numéricas confirmadas.'], ['copiar', 'Copio las condiciones de la Mizuna.'], ['cero', 'Escribo 0 °C, 0 % y 0 ppm.']],
  correcta: 'sin_dato', explicacion: 'Un dato no confirmado no es cero ni se sustituye por el de otra especie.',
});

export function fichaCientifica(cultivo) {
  return FICHAS[cultivo.id] || fichaSinDatos(cultivo.nombre);
}
export const misionActiva = estado => !!estado.mision && estado.mision.fase !== 'completa';

export function crearFalla(referencia, ronda) {
  const orden = [...CANALES].sort((a, b) => referencia[b.id] - referencia[a.id]);
  const principal = orden[0].id;
  const secundario = orden.at(-1).id;
  const luz = { ...referencia };
  if (ronda === 0) [luz[principal], luz[secundario]] = [luz[secundario], luz[principal]];
  else if (ronda === 1) luz[principal] = 0;
  else if (ronda === 2) {
    luz[principal] -= 20;
    luz[secundario] += 20;
  } else throw new Error('Revisión desconocida');
  return luz;
}

export function iniciarMision(estado, cultivo) {
  if (estado.mision) return false;
  estado.mision = { ronda: 0, fase: 'ajustar', puntos: 0, registros: [], pistas: 0, mensaje: '' };
  estado.dia = 1;
  estado.etapa = 0;
  estado.borrador = crearFalla(cultivo.luz, 0);
  estado.aplicada = { ...estado.borrador };
  return true;
}

export function repararRevision(estado, cultivo) {
  const mision = estado.mision;
  if (!mision || mision.fase !== 'ajustar') return false;
  const pendientes = CANALES.filter(c => !Number.isFinite(estado.borrador[c.id])
    || estado.borrador[c.id] < 0 || estado.borrador[c.id] > 100
    || Math.abs(estado.borrador[c.id] - cultivo.luz[c.id]) > TOLERANCIA_RETO + 1e-9);
  if (pendientes.length) {
    mision.mensaje = `Revisa la luz ${pendientes.map(c => c.nombre.toLowerCase()).join(', ')}. Consulta la receta y vuelve a aplicar; no pierdes puntos.`;
    return false;
  }
  estado.aplicada = { ...estado.borrador };
  estado.etapa = REVISIONES[mision.ronda].etapa;
  mision.fase = 'registrar';
  mision.puntos += 100;
  mision.mensaje = 'Luz corregida dentro de la tolerancia del reto. Registra el cuidado del cultivo.';
  return true;
}

export function registrarRevision(estado, cultivo) {
  const mision = estado.mision;
  if (!mision || mision.fase !== 'registrar') return false;
  mision.registros.push({
    dia: estado.dia, revision: mision.ronda + 1,
    texto: `${REVISIONES[mision.ronda].falla}: corregida; revisión registrada.`,
    luz: { ...estado.aplicada },
  });
  mision.puntos += 25;
  if (mision.ronda === REVISIONES.length - 1) {
    mision.fase = 'ficha';
    mision.mensaje = 'Tres revisiones listas. Valida la ficha científica antes de recoger la insignia.';
  } else {
    mision.ronda++;
    estado.dia++;
    estado.borrador = crearFalla(cultivo.luz, mision.ronda);
    estado.aplicada = { ...estado.borrador };
    mision.fase = 'ajustar';
    mision.mensaje = `Nueva revisión: ${REVISIONES[mision.ronda].falla.toLowerCase()}.`;
  }
  return true;
}

export function validarFicha(estado, cultivo, respuesta) {
  const mision = estado.mision;
  if (!mision || mision.fase !== 'ficha') return false;
  const ficha = fichaCientifica(cultivo);
  if (respuesta !== ficha.correcta) {
    mision.mensaje = respuesta ? `VEGA: ${ficha.explicacion} Puedes intentarlo de nuevo, sin penalización.` : 'Selecciona una observación para tu bitácora.';
    return false;
  }
  mision.puntos += 75;
  mision.fase = 'completa';
  mision.mensaje = '¡Cosecha de entrenamiento completada! Ganaste la insignia de este cultivo.';
  return true;
}

export function pistaMision(estado, cultivo) {
  if (!misionActiva(estado) || estado.mision.fase !== 'ajustar') return '';
  estado.mision.pistas++;
  const canales = CANALES.filter(c => Math.abs(estado.borrador[c.id] - cultivo.luz[c.id]) > TOLERANCIA_RETO);
  const texto = canales.length ? canales.map(c => `${c.nombre}: ${porcentaje(cultivo.luz[c.id])} %`).join(' · ')
    : 'Los canales ya están dentro de la tolerancia. Pulsa Aplicar.';
  estado.mision.mensaje = `VEGA: ${texto} Consultar no resta puntos.`;
  return estado.mision.mensaje;
}

export function resumenMisiones(estados) {
  const misiones = CULTIVOS.map(c => estados[c.id].mision).filter(Boolean);
  return {
    completas: misiones.filter(m => m.fase === 'completa').length,
    puntos: misiones.reduce((suma, m) => suma + m.puntos, 0),
  };
}
