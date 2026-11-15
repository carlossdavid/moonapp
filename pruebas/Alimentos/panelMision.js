import { CULTIVOS } from './datos.js';
import { REVISIONES, fichaCientifica, misionActiva, resumenMisiones } from './misiones.js';

const $ = id => document.getElementById(id);

export function mostrarMision(cultivo, estado, estados) {
  const mision = estado.mision, resumen = resumenMisiones(estados);
  $('collection-status').textContent = `${resumen.completas}/6 insignias · ${resumen.puntos} puntos`;
  $('mission-card').dataset.phase = mision?.fase || 'inicio';
  $('mission-title').textContent = mision ? `${cultivo.nombre}: misión de cuidado` : 'Rescate del invernadero';
  $('mission-description').textContent = !mision
    ? 'Cuida una planta durante tres revisiones. Repara sus luces, registra tus cuidados y valida su ficha para obtener la cosecha de entrenamiento.'
    : mision.fase === 'completa' ? '¡Cultivo completado! Tu bitácora y tu insignia se conservan al visitar las otras plantas.'
      : `Revisión ${mision.ronda + 1}/3 · ${REVISIONES[mision.ronda].titulo} · Día simulado ${estado.dia}`;
  $('mission-start').hidden = !!mision;
  $('mission-start').textContent = `Iniciar misión de ${cultivo.nombre}`;
  $('mission-hint').hidden = mision?.fase !== 'ajustar';
  $('mission-next').hidden = !['registrar', 'ficha', 'completa'].includes(mision?.fase);
  $('mission-next').textContent = mision?.fase === 'registrar' ? 'Registrar revisión'
    : mision?.fase === 'ficha' ? 'Validar ficha y cosechar'
      : resumen.completas < 6 ? 'Ir al siguiente cultivo' : 'Colección completada';
  $('mission-next').disabled = mision?.fase === 'completa' && resumen.completas === 6;
  $('mission-score').textContent = mision ? `${mision.puntos} puntos en este cultivo` : 'Sin cuenta atrás · pistas gratuitas';
  $('mission-fault').hidden = mision?.fase !== 'ajustar';
  $('mission-fault').textContent = mision?.fase === 'ajustar'
    ? `Incidencia de entrenamiento: ${REVISIONES[mision.ronda].falla}` : '';
  $('mission-vega').textContent = mision?.mensaje
    || 'VEGA: puedes consultar la receta y los datos ambientales en todo momento. Las fallas y el crecimiento son mecánicas del juego.';
  const completadas = mision?.registros.length || 0;
  $('mission-progress').value = completadas;
  $('mission-progress').setAttribute('aria-label', `${completadas} de 3 revisiones registradas`);
  $('mission-steps').replaceChildren();
  for (let i = 0; i < REVISIONES.length; i++) {
    const step = document.createElement('li');
    step.dataset.state = i < completadas ? 'completo' : mision?.ronda === i ? 'actual' : 'pendiente';
    step.textContent = `${i + 1}. ${REVISIONES[i].titulo}`;
    $('mission-steps').append(step);
  }
  const question = $('mission-question');
  const selected = question.dataset.crop === cultivo.id ? question.querySelector('input:checked')?.value : null;
  question.dataset.crop = cultivo.id;
  question.hidden = mision?.fase !== 'ficha';
  question.replaceChildren();
  if (!question.hidden) {
    const ficha = fichaCientifica(cultivo);
    const legend = document.createElement('legend');
    legend.textContent = ficha.pregunta;
    question.append(legend);
    for (const [value, text] of ficha.opciones) {
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'radio'; input.name = 'observacion'; input.value = value;
      input.checked = value === selected;
      label.append(input, text);
      question.append(label);
    }
  }
  $('mission-log').replaceChildren();
  for (const registro of mision?.registros || []) {
    const li = document.createElement('li');
    li.textContent = `Día simulado ${registro.dia} · ${registro.texto}`;
    $('mission-log').append(li);
  }
  $('mission-log-empty').hidden = completadas > 0;
  $('mission-badge').hidden = mision?.fase !== 'completa';
  $('mission-badge-name').textContent = `Botánico lunar: ${cultivo.nombre}`;
  $('day-label').textContent = mision ? 'Día simulado del reto' : 'Día de vista previa';
  for (const id of ['stage-select', 'day-input', 'reset-light']) $(id).disabled = misionActiva(estado);
  const bloquearLuz = misionActiva(estado) && mision.fase !== 'ajustar';
  document.querySelectorAll('#light-sliders input').forEach(input => { input.disabled = bloquearLuz; });
  $('apply').disabled = bloquearLuz;
  document.querySelector('.chamber').dataset.mission = mision?.fase || '';
  for (const planta of CULTIVOS) {
    const button = document.querySelector(`.crop-button[data-crop="${planta.id}"]`);
    let badge = button.querySelector('.crop-progress');
    if (!badge) {
      badge = document.createElement('small');
      badge.className = 'crop-progress';
      button.querySelector('span').append(badge);
    }
    const progreso = estados[planta.id].mision;
    badge.textContent = progreso?.fase === 'completa' ? '★ Insignia obtenida'
      : progreso ? `${progreso.registros.length}/3 cuidados` : '';
  }
}
