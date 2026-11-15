# Pruebas

Prototipos y pruebas aisladas. Ninguna modifica el juego principal: cada carpeta
contiene su propio código, sus estilos y sus datos.

## OPERACIÓN ELECTRÓLISIS

Minijuego de puntería de 25 segundos con los sprites originales de
`assets/Sprites/electrolisis/`.

Desde `moonapp`:

```bash
python -m http.server 8765
```

Abre <http://localhost:8765/pruebas/operacion-electrolisis/>.

También funciona abriendo `pruebas/operacion-electrolisis/index.html`
directamente (`file://`). Pulsa **INICIAR OPERACIÓN** y dispara con clic, toque
o **ESPACIO**. El cañón alterna entre rojo (objetivo O₂ rojo) y azul (objetivo
H₂ azul) cada 4 segundos; los colores químicos se corrigen en memoria sin
modificar los PNG originales.

La documentación completa, controles, fórmulas y pruebas están en
[`operacion-electrolisis/README.md`](operacion-electrolisis/README.md).

## INTEGRACIÓN · CONTROL DE ENERGÍA

Página que conecta la estación de energía de la base con el minijuego. Es una
copia del `index.html` original en `pruebas/integracion-electrolisis/` con
`<base href="../../">`: conserva menú, video de introducción y panel DONKI, y
no modifica `src/` ni el `index.html` original. Hereda la escena interior y
reemplaza solo la acción de la estación.

Abre <http://localhost:8765/pruebas/integracion-electrolisis/>, pulsa
**INICIAR JUEGO**, ve o salta la introducción y llega hasta **CONTROL DE
ENERGÍA**. Puedes pulsar `E` en sus cuatro zonas originales o hacer clic/tocar
la propia imagen (tiene un contorno cian pulsante). Se muestra una explicación
antes de jugar; al volver, la base se reanuda y aparece un resumen de energía,
precisión y agua perdida.

Detalles, estructura y verificaciones: [`integracion-electrolisis/README.md`](integracion-electrolisis/README.md).

Verificación automática de la integración, con el servidor en marcha:

```bash
node pruebas/integracion-electrolisis/verify.mjs
```

Pruebas automáticas, desde `moonapp`:

```bash
node pruebas/operacion-electrolisis/scoring.test.cjs
```

La energía y el agua perdida son indicadores educativos simulados.

## Otras pruebas

- `CambioDeModo/`
- `clima-espacial/`
- `integracion-electrolisis/`
- `limpieza-panel/`
- `storytelling/`
