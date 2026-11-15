/**
 * Carga de los PNG originales de assets/Sprites/electrolisis.
 * No se copian ni se transforman en disco: solo se leen desde su ruta original.
 */
(function () {
  'use strict';

  var NS = window.ELECTROLISIS;
  var C = NS.CONFIG;

  var LIST = [
    { key: 'bg', label: 'Cámara de reacción' },
    { key: 'o2', label: 'Átomos O₂' },
    { key: 'h2', label: 'Átomos H₂' },
    { key: 'cannonRed', label: 'Cañón rojo' },
    { key: 'cannonBlue', label: 'Cañón azul' },
    { key: 'shots', label: 'Proyectiles e impactos' },
    { key: 'animRed', label: 'Animación cañón rojo' },
    { key: 'animBlue', label: 'Animación cañón azul' }
  ];

  /**
   * @param {(loaded:number, total:number, label:string) => void} [onProgress]
   * @returns {Promise<{images:Object, failed:string[]}>}
   */
  function loadAll(onProgress) {
    var images = {};
    var failed = [];
    var done = 0;

    return new Promise(function (resolve) {
      LIST.forEach(function (item, index) {
        var img = new Image();
        img.decoding = 'async';

        function finish(ok) {
          if (!ok) failed.push(item.key);
          done += 1;
          if (onProgress) onProgress(done, LIST.length, item.label);
          if (done === LIST.length) resolve({ images: images, failed: failed });
        }

        img.onload = function () { finish(true); };
        img.onerror = function () { finish(false); };
        images[item.key] = img;
        img.src = C.ASSET_BASE + C.ASSETS[item.key];
      });
    });
  }

  NS.Assets = { list: LIST, loadAll: loadAll };
})();
