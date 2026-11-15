/**
 * OPERACIÓN ELECTRÓLISIS — configuración central.
 * Todo el balance del minijuego vive aquí para poder ajustarlo sin tocar la lógica.
 * Los valores de energía y agua son indicadores educativos simulados.
 */
(function () {
  'use strict';

  var NS = (window.ELECTROLISIS = window.ELECTROLISIS || {});

  // Resolución lógica de la cámara de reacción. El canvas se escala por CSS.
  NS.CONFIG = Object.freeze({
    W: 880,
    H: 600,

    // Partida
    DURATION: 25,            // segundos
    SWITCH_EVERY: 4,         // el cañón alterna rojo/azul cada 4 s
    END_GRACE: 0.8,          // margen para que aterricen los disparos finales
    START_COLOR: 'red',      // rojo -> O2 rojo (el O2 es rojo)

    // Átomos
    MAX_ATOMS: 9,
    START_ATOMS: 6,
    SPAWN_INTERVAL: 0.72,
    ATOM_HIT_RADIUS: 33,     // radio de colisión (algo generoso, público infantil)
    ATOM_MIN_SPEED: 16,
    ATOM_MAX_SPEED: 46,
    ATOM_MIN_SCALE: 0.40,
    ATOM_MAX_SCALE: 0.50,

    // Cañón y disparos
    CANNON: Object.freeze({
      x: 440,
      y: 566,
      scale: 0.66,
      pivotFraction: 0.827,  // fracción de la altura donde apoya la base
      muzzleOffset: 123,     // píxeles locales desde el pivote hasta la boca
      maxAim: 1.02           // radianes (~58°)
    }),
    FIRE_COOLDOWN: 0.14,
    SHOT_SPEED: 1120,
    SHOT_LIFE: 1.4,
    SHOT_RADIUS: 9,

    // Zona de flotación (coordenadas lógicas)
    BOUNDS: Object.freeze({ left: 52, right: 828, top: 52, bottom: 402 }),
    // Límites de vuelo de los proyectiles: casi todo el canvas, porque el
    // cañón está por debajo de la zona de flotación.
    SHOT_BOUNDS: Object.freeze({ left: 6, right: 874, top: 6, bottom: 594 }),

    // Rutas relativas al index.html. Nunca se copian ni modifican los PNG.
    ASSET_BASE: '../../assets/Sprites/electrolisis/',
    ASSETS: Object.freeze({
      bg: '06_fondo_arena_reactor.png',
      o2: '01_atomos_O2_naranja.png',
      h2: '02_atomos_H2_rojo.png',
      cannonRed: '03_canon_rojo.png',
      cannonBlue: '04_canon_azul.png',
      shots: '05_proyectiles_y_impactos.png',
      animRed: '07_animacion_canon_rojo.png',
      animBlue: '08_animacion_canon_azul.png'
    }),

    // Paleta compartida con CSS (solo para efectos de canvas).
    COLORS: Object.freeze({
      red: '#ff4d5e',
      redGlow: 'rgba(255, 70, 90, 0.55)',
      orange: '#ff9d2e',
      orangeGlow: 'rgba(255, 150, 40, 0.55)',
      blue: '#4fd8ff',
      blueGlow: 'rgba(70, 210, 255, 0.55)',
      cyan: '#7df9ff'
    })
  });

  // Recortes exactos dentro de las hojas de sprites (medidos sobre los PNG).
  NS.FRAMES = Object.freeze({
    o2: [
      { sx: 23, sy: 10, sw: 155, sh: 148 },
      { sx: 198, sy: 5, sw: 157, sh: 142 },
      { sx: 380, sy: 8, sw: 139, sh: 136 },
      { sx: 536, sy: 14, sw: 158, sh: 137 }
    ],
    h2: [
      { sx: 21, sy: 15, sw: 156, sh: 147 },
      { sx: 207, sy: 11, sw: 141, sh: 155 },
      { sx: 377, sy: 10, sw: 142, sh: 156 },
      { sx: 542, sy: 12, sw: 157, sh: 153 }
    ],
    shots: [
      { sx: 53, sy: 58, sw: 74, sh: 73 },
      { sx: 175, sy: 57, sw: 141, sh: 75 },
      { sx: 319, sy: 51, sw: 197, sh: 83 }
    ],
    impacts: [
      { sx: 9, sy: 190, sw: 168, sh: 190 },
      { sx: 196, sy: 219, sw: 128, sh: 133 },
      { sx: 340, sy: 204, sw: 181, sh: 171 },
      { sx: 540, sy: 220, sw: 166, sh: 175 },
      { sx: 542, sy: 18, sw: 158, sh: 144 }
    ],
    cannonRed: [
      { sx: 8, sy: 9, sw: 128, sh: 140 },
      { sx: 153, sy: 9, sw: 124, sh: 139 },
      { sx: 289, sy: 14, sw: 121, sh: 131 },
      { sx: 421, sy: 23, sw: 104, sh: 117 },
      { sx: 538, sy: 40, sw: 137, sh: 97 }
    ],
    cannonBlue: [
      { sx: 8, sy: 5, sw: 128, sh: 138 },
      { sx: 153, sy: 5, sw: 124, sh: 137 },
      { sx: 289, sy: 9, sw: 121, sh: 129 },
      { sx: 421, sy: 11, sw: 104, sh: 122 },
      { sx: 536, sy: 27, sw: 146, sh: 106 }
    ]
  });

  // Reglas de color: el cañón rojo solo puede destruir O2 (rojo) y el azul
  // solo H2 (azul). Convención química usada en todo el minijuego.
  NS.TARGET = Object.freeze({
    red: Object.freeze({ atom: 'O2', label: 'O₂ ROJO', color: '#ff4d5e' }),
    blue: Object.freeze({ atom: 'H2', label: 'H₂ AZUL', color: '#4fd8ff' })
  });

  NS.ATOM_INFO = Object.freeze({
    O2: Object.freeze({ label: 'O₂', sheet: 'o2', color: '#ff4d5e', glow: 'rgba(255,70,90,0.58)' }),
    H2: Object.freeze({ label: 'H₂', sheet: 'h2', color: '#4fd8ff', glow: 'rgba(70,210,255,0.58)' })
  });
})();
