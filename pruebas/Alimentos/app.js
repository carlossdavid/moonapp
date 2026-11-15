import { CULTIVOS, CANALES, crearEstado, evaluarLuz, ambienteTexto, porcentaje, rutaPlanta } from './datos.js';
import { EscenarioCultivo } from './escenario.js';
import { mostrarMision } from './panelMision.js';
import { misionActiva, iniciarMision, repararRevision, registrarRevision, validarFicha, pistaMision } from './misiones.js';

const $ = id => document.getElementById(id);
const estados = crearEstado();
let seleccionado = 'mizuna';
const cultivoActual = () => CULTIVOS.find(c => c.id === seleccionado);
const estadoActual = () => estados[seleccionado];

function crearSelectores() {
  for (const cultivo of CULTIVOS) {
    const option = document.createElement('option');
    option.value = cultivo.id;
    option.textContent = cultivo.nombre;
    $('crop-select').append(option);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'crop-button';
    button.dataset.crop = cultivo.id;
    button.setAttribute('aria-pressed', 'false');
    const image = document.createElement('img');
    image.src = `Sprites/cultivos/iconos/nativo/icono_${cultivo.id}.png`;
    image.alt = '';
    const text = document.createElement('span');
    text.textContent = cultivo.nombre;
    if (cultivo.subtitulo) {
      const subtitle = document.createElement('small');
      subtitle.textContent = cultivo.subtitulo;
      text.append(subtitle);
    }
    button.append(image, text);
    button.addEventListener('click', () => seleccionar(cultivo.id));
    $('crop-buttons').append(button);
  }
  $('crop-select').addEventListener('change', event => seleccionar(event.target.value));
}

function crearSliders() {
  for (const canal of CANALES) {
    const row = document.createElement('div');
    row.className = 'light-row';
    row.style.setProperty('--channel', canal.color);
    row.innerHTML = `<img src="Sprites/iluminacion/nativo/lampara_${canal.id}_encendida.png" alt="">
      <label for="range-${canal.id}">Luz ${canal.nombre}</label>
      <label class="light-number"><input id="number-${canal.id}" type="number" min="0" max="100" step="0.01"
        aria-label="Porcentaje de luz ${canal.nombre.toLowerCase()}"><span>%</span></label>
      <input id="range-${canal.id}" type="range" min="0" max="100" step="0.01">`;
    const cambiarValor = valor => {
      if (!Number.isFinite(valor)) return;
      if (misionActiva(estadoActual()) && estadoActual().mision.fase !== 'ajustar') return;
      estadoActual().borrador[canal.id] = Math.round(Math.max(0, Math.min(100, valor)) * 100) / 100;
      actualizarLuz();
      escenario.dibujar();
      $('feedback').textContent = 'Vista previa modificada. Pulsa Aplicar para guardar esta mezcla.';
    };
    for (const input of row.querySelectorAll('input')) {
      input.addEventListener('input', () => cambiarValor(input.valueAsNumber));
    }
    const range = row.querySelector('input[type=range]');
    let pointerActivo = null;
    let cultivoArrastrado;
    const arrastrar = event => {
      if (cultivoArrastrado !== seleccionado) { pointerActivo = null; return; }
      const rect = range.getBoundingClientRect();
      const radio = 13;
      cambiarValor((event.clientX - rect.left - radio) / Math.max(1, rect.width - radio * 2) * 100);
    };
    // Captura explícita para mantener el arrastre fuera de la pista y en táctil.
    // El teclado sigue usando los eventos nativos del input accesible.
    range.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      range.focus();
      pointerActivo = event.pointerId;
      cultivoArrastrado = seleccionado;
      range.setPointerCapture(event.pointerId);
      arrastrar(event);
    });
    window.addEventListener('pointermove', event => {
      if (pointerActivo === event.pointerId) arrastrar(event);
    });
    window.addEventListener('pointerup', event => {
      if (pointerActivo !== event.pointerId) return;
      arrastrar(event);
      pointerActivo = null;
      if (range.hasPointerCapture(event.pointerId)) range.releasePointerCapture(event.pointerId);
    });
    window.addEventListener('pointercancel', event => {
      if (pointerActivo === event.pointerId) pointerActivo = null;
    });
    $('light-sliders').append(row);
  }
}

function actualizarLuz() {
  const cultivo = cultivoActual(), estado = estadoActual();
  const evaluacion = evaluarLuz(estado.borrador, cultivo.luz);
  $('distribution').replaceChildren();
  for (const canal of CANALES) {
    const valor = estado.borrador[canal.id];
    $(`range-${canal.id}`).value = valor;
    $(`number-${canal.id}`).value = valor;
    $(`range-${canal.id}`).style.setProperty('--value', `${valor}%`);
    $(`range-${canal.id}`).setAttribute('aria-valuetext', `${porcentaje(valor)} por ciento`);
    const span = document.createElement('span');
    const dot = document.createElement('i');
    dot.className = 'distribution-dot';
    dot.style.setProperty('--channel', canal.color);
    span.append(dot, `${porcentaje(valor)} %`);
    $('distribution').append(span);
  }
  $('total').textContent = `Total de canales: ${porcentaje(evaluacion.total)} % · ajustes independientes`;
  $('light-reference').textContent = CANALES.map(c => `${c.nombre}: ${porcentaje(cultivo.luz[c.id])} %`).join(' · ');
  $('light-note').textContent = cultivo.notaLuz || 'Mezcla de referencia de la tabla; no es una garantía de cosecha.';
  $('crop-status').textContent = evaluacion.coincide ? 'Luz de referencia' : 'Mezcla modificada';
  $('status-face').src = `Sprites/caritas/nativo/carita_${evaluacion.coincide ? 'feliz' : 'normal'}_a.png`;
  $('effect-lines').replaceChildren();
  const mensajes = [
    evaluacion.coincide ? 'Coincide con la mezcla de referencia.' : `Desviación de la referencia: ${porcentaje(evaluacion.diferencia)} puntos.`,
    CANALES.every(c => estado.borrador[c.id] === estado.aplicada[c.id]) ? 'Mezcla guardada para este cultivo.' : 'Cambios de luz pendientes de aplicar.',
    Object.values(cultivo.ambiente).some(d => d.rango === null)
      ? 'Ambiente: faltan cifras confirmadas.' : 'Ambiente: consultar rangos y contexto.',
  ];
  for (const mensaje of mensajes) {
    const li = document.createElement('li');
    li.textContent = mensaje;
    $('effect-lines').append(li);
  }
  mostrarMision(cultivo, estado, estados);
}

function seleccionar(id) {
  if (!estados[id]) throw new Error('Cultivo desconocido');
  seleccionado = id;
  const cultivo = cultivoActual(), estado = estadoActual();
  $('crop-select').value = id;
  document.querySelectorAll('.crop-button').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.crop === id)));
  $('selected-icon').src = `Sprites/cultivos/iconos/nativo/icono_${id}.png`;
  $('selected-icon').alt = cultivo.nombre;
  $('effect-plant').src = `Sprites/${rutaPlanta(id, estado.etapa)}`;
  $('crop-day').textContent = estado.dia;
  $('scene-caption').textContent = `${cultivo.nombre} · escenario de vista previa`;
  $('stage-select').value = estado.etapa;
  $('day-input').value = estado.dia;
  for (const [key, tipo] of [['temperature', 'temperatura'], ['humidity', 'humedad'], ['co2', 'co2']]) {
    const dato = cultivo.ambiente[tipo];
    $(`env-${key}`).textContent = ambienteTexto(dato);
    $(`env-${key}`).classList.toggle('unconfirmed', dato.rango === null);
    $(`context-${key}`).textContent = dato.contexto;
  }
  actualizarLuz();
  escenario.dibujar();
  $('feedback').textContent = `${cultivo.nombre}: cámara, planta, luz y condiciones actualizadas.`;
}

const escenario = new EscenarioCultivo($('chamber'), () => ({
  cultivo: cultivoActual(), estado: estadoActual(),
}));

crearSelectores();
crearSliders();
$('apply').addEventListener('click', () => {
  if (misionActiva(estadoActual())) {
    const reparada = repararRevision(estadoActual(), cultivoActual());
    refrescarMision();
    if (reparada) $('mission-next').focus();
    return;
  }
  estadoActual().aplicada = { ...estadoActual().borrador };
  actualizarLuz();
  $('feedback').textContent = `Mezcla aplicada a ${cultivoActual().nombre}. Las condiciones reportadas no se modifican.`;
});
$('settings-open').addEventListener('click', () => $('settings-dialog').showModal());
$('reset-light').addEventListener('click', () => {
  if (misionActiva(estadoActual())) return;
  estadoActual().borrador = { ...cultivoActual().luz };
  actualizarLuz(); escenario.dibujar();
  $('feedback').textContent = 'Referencia restaurada en la vista previa. Pulsa Aplicar para guardarla.';
});
$('stage-select').addEventListener('change', event => {
  if (misionActiva(estadoActual())) return;
  estadoActual().etapa = Number(event.target.value);
  $('effect-plant').src = `Sprites/${rutaPlanta(seleccionado, estadoActual().etapa)}`;
  escenario.dibujar();
});
$('day-input').addEventListener('change', event => {
  if (misionActiva(estadoActual())) return;
  if (!Number.isFinite(event.target.valueAsNumber)) event.target.value = estadoActual().dia;
  estadoActual().dia = Math.max(1, Math.min(999, Math.round(event.target.valueAsNumber)));
  event.target.value = estadoActual().dia;
  $('crop-day').textContent = estadoActual().dia;
});

function refrescarMision() {
  seleccionar(seleccionado);
  $('feedback').textContent = estadoActual().mision.mensaje || 'Misión iniciada: revisa los canales de luz.';
}
$('mission-start').addEventListener('click', () => {
  iniciarMision(estadoActual(), cultivoActual());
  refrescarMision();
  $('range-rojo').focus({ preventScroll: true });
});
$('mission-hint').addEventListener('click', () => {
  pistaMision(estadoActual(), cultivoActual());
  refrescarMision();
});
$('mission-next').addEventListener('click', () => {
  const estado = estadoActual();
  if (estado.mision?.fase === 'completa') {
    const siguiente = CULTIVOS.find(c => estados[c.id].mision?.fase !== 'completa');
    if (siguiente) seleccionar(siguiente.id);
    return;
  }
  if (estado.mision?.fase === 'registrar') registrarRevision(estado, cultivoActual());
  else if (estado.mision?.fase === 'ficha') {
    const completa = validarFicha(estado, cultivoActual(), $('mission-question').querySelector('input:checked')?.value);
    if (completa && window.parent !== window) window.parent.postMessage({
      type: 'alimentos:harvest', crop: seleccionado,
    }, location.origin);
  }
  refrescarMision();
  if (estado.mision?.fase === 'ficha') {
    $('mission-question').querySelector('input')?.focus({ preventScroll: true });
  }
});

async function iniciar() {
  try {
    await escenario.cargar();
    seleccionar(seleccionado);
    $('loading').hidden = true;
    // API local para las pruebas y una futura integración; no consume recursos del juego.
    window.alimentosTest = { estados, escenario, seleccionar, get seleccionado() { return seleccionado; } };
  } catch (error) {
    $('loading').textContent = error.message;
    console.error(error);
  }
}
iniciar();
