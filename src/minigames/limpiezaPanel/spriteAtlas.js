// Se cargan las piezas originales como imágenes completas (assets principales).
const FILES = Object.freeze({
  generator: 'generador.png',
  magnetOff: 'electroiman_apagado.png',
  magnetOn: 'electroiman_energizado.png',
  frame: 'marco_panel.png',
  clean: 'celda_limpia.png',
  dusty: 'celda_sucia.png',
  partial: 'celda_parcial.png',
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
      image.onerror = () => reject(new Error(`No se pudo cargar assets/limpieza-panel/${name}`));
      image.src = `./assets/limpieza-panel/${name}`;
    })
  ));
  return Object.fromEntries(entries);
}
