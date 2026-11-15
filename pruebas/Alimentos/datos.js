/** Datos transcritos de las tablas del usuario; no son lecturas en tiempo real. */
export const CANALES = [
  { id: 'rojo', nombre: 'Roja', color: '#ff6069' },
  { id: 'azul', nombre: 'Azul', color: '#4caaff' },
  { id: 'verde', nombre: 'Verde', color: '#69e94d' },
  { id: 'blanco', nombre: 'Blanca', color: '#edf5ff' },
];

export const CULTIVOS = [
  {
    id: 'mizuna', nombre: 'Mizuna', subtitulo: 'Opción roja',
    luz: { rojo: 81.8, azul: 9.1, verde: 9.1, blanco: 0 },
    ambiente: {
      temperatura: { rango: [22.2, 23.4], unidad: '°C', contexto: 'Dentro de Veggie; según tratamiento y ciclo.' },
      humedad: { rango: [70.4, 91.9], unidad: '%', contexto: 'Dentro de Veggie.' },
      co2: { rango: [2009, 3011], unidad: 'ppm', contexto: 'Ambiente de la ISS.' },
    },
  },
  {
    id: 'tomate', nombre: 'Tomate enano', subtitulo: 'Opción roja',
    luz: { rojo: 90, azul: 10, verde: 0, blanco: 0 },
    ambiente: {
      temperatura: { rango: null, unidad: '°C', contexto: 'Registrada durante VEG-05; sin promedio numérico confirmado en la tabla.' },
      humedad: { rango: null, unidad: '%', contexto: 'Registrada durante VEG-05; sin cifra confirmada en la tabla.' },
      co2: { rango: null, unidad: 'ppm', contexto: 'Registrado durante VEG-05; sin cifra confirmada en la tabla.' },
    },
  },
  {
    id: 'chile', nombre: 'Ají', subtitulo: '',
    luz: { rojo: 27, azul: 40, verde: 33, blanco: 0 },
    ambiente: {
      temperatura: { rango: [23, 23], unidad: '°C', aproximado: true, contexto: 'Temperatura aproximada reportada.' },
      humedad: { rango: [50, 50], unidad: '%', contexto: 'Humedad reportada en la tabla.' },
      co2: { rango: [550, 550], unidad: 'ppm', contexto: 'Concentración reportada en la tabla.' },
    },
  },
  {
    id: 'lechuga', nombre: 'Lechuga romana roja', subtitulo: '',
    luz: { rojo: 75, azul: 18.75, verde: 6.25, blanco: 0 },
    ambiente: {
      temperatura: { rango: [22.2, 23.3], unidad: '°C', contexto: 'Rango reportado en el experimento de la tabla.' },
      humedad: { rango: [38.3, 43.9], unidad: '%', contexto: 'Ambiente de la ISS.' },
      co2: { rango: [2559, 2799], unidad: 'ppm', contexto: 'Concentración reportada en la tabla.' },
    },
  },
  {
    id: 'papa', nombre: 'Papa', subtitulo: '',
    luz: { rojo: 0, azul: 0, verde: 0, blanco: 100 },
    ambiente: {
      temperatura: { rango: null, unidad: '°C', contexto: 'Sin receta espacial específica confirmada en la tabla.' },
      humedad: { rango: null, unidad: '%', contexto: 'Sin valor confirmado.' },
      co2: { rango: null, unidad: 'ppm', contexto: 'Sin valor confirmado.' },
    },
  },
  {
    id: 'trigo', nombre: 'Trigo enano', subtitulo: 'Luz blanca',
    luz: { rojo: 0, azul: 0, verde: 0, blanco: 100 },
    ambiente: {
      temperatura: { rango: null, unidad: '°C', contexto: 'Hay datos en APH; sin receta ambiental única confirmada aquí.' },
      humedad: { rango: null, unidad: '%', contexto: 'Sin promedio específico confirmado.' },
      co2: { rango: null, unidad: 'ppm', contexto: 'Sin promedio específico confirmado.' },
    },
    notaLuz: '100 % blanca por indicación del usuario para esta prueba.',
  },
];

export const ETAPAS = ['semilla', 'brote', 'joven', 'creciendo', 'madura', 'lista_cosecha'];
// Fijar la coma decimal de las tablas, independientemente del locale del navegador.
export const porcentaje = valor => Number(valor).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');

export function ambienteTexto(dato) {
  if (!dato.rango) return 'Sin dato numérico confirmado';
  const [min, max] = dato.rango;
  const valor = min === max ? porcentaje(min) : `${porcentaje(min)}–${porcentaje(max)}`;
  return `${dato.aproximado ? '≈ ' : ''}${valor} ${dato.unidad}`;
}

export function rutaPlanta(id, etapa, frame = 'a') {
  if (!CULTIVOS.some(c => c.id === id) || !Number.isInteger(etapa) || etapa < 0 || etapa > 5
    || !['a', 'b'].includes(frame)) throw new Error('Sprite de planta inválido');
  const hidro = id === 'trigo' ? '_hidro' : '';
  return `cultivos/${id}/nativo/${id}${hidro}_etapa${etapa}_${ETAPAS[etapa]}_${frame}.png`;
}

export function crearEstado() {
  return Object.fromEntries(CULTIVOS.map(c => [c.id, {
    borrador: { ...c.luz }, aplicada: { ...c.luz }, etapa: 4, dia: 12,
  }]));
}

export function evaluarLuz(luz, referencia) {
  const total = CANALES.reduce((sum, c) => sum + luz[c.id], 0);
  const diferencia = CANALES.reduce((sum, c) => sum + Math.abs(luz[c.id] - referencia[c.id]), 0) / 2;
  return { total, diferencia, coincide: diferencia < .025 };
}
