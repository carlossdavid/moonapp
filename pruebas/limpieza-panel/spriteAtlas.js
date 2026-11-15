// Se cargan las piezas originales como imágenes completas. No hay recortes
// de hojas ni archivos derivados: cada PNG se mantiene intacto.
const FILES = Object.freeze({
  generator: 'generador.png',
  magnetOff: 'electroiman_apagado.png',
  magnetOn: 'electroiman_energizado.png',
  frame: 'marco_panel.png',
  clean: 'celda_limpia.png',
  dusty: 'celda_sucia.png',
  partial: 'celda_parcial.png',
  cableA: 'cable_a.png',
  cableB: 'cable_b.png',
  plugA: 'conector_a.png',
  plugB: 'conector_b.png',
  burst: 'nube_polvo.png',
  particles: 'particulas_polvo.png',
  marker: 'mira.png',
  beam: 'haz.png',
  success: 'confirmacion.png',
  progressFrame: 'barra_marco.png',
  progressFill: 'barra_relleno.png',
});

export async function loadPanelSprites() {
  const entries = await Promise.all(Object.entries(FILES).map(([key, name]) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve([key, image]);
      image.onerror = () => reject(new Error(`No se pudo cargar ImagenesLimpiezaPaneles/${name}`));
      image.src = new URL(`./ImagenesLimpiezaPaneles/${name}`, import.meta.url).href;
    })
  ));
  return Object.fromEntries(entries);
}
