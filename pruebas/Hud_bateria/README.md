# Prueba del HUD de batería del traje

Desde la raíz de `moonapp`, ejecutar `python -m http.server 8080` y abrir
`http://localhost:8080/pruebas/Hud_bateria/`. No abrir mediante `file://`.

Es un prototipo independiente sobre las escenas reales del juego; no cambia
`src/` ni el arranque normal. El indicador inferior izquierdo usa los 11 PNG
de `assets/Sprites/Pantalla/niveles/bateria/` ya incluidos en el manifiesto.
Los porcentajes y alertas proceden de `SistemaEnergia.getSnapshot().traje`.
`BatterySimulation.js` conecta el avance temporal y los cambios de escena con
el sistema, sin reemplazar sus fórmulas ni crear un segundo contador de batería.

El panel reproduce la posición y escala de `REFERENCIA DE POSICIÓN Y BARRA.jpeg`:
80 × 35 píxeles lógicos a 10 px de la izquierda y 6 px del borde inferior.
Comida, agua y oxígeno aparecen atenuados y vacíos, pues este prototipo no
dispone de valores reales para esos recursos; solo la batería cambia de nivel.
Todo se recorta dentro del cuadro. Se eliminó el panel lateral de pruebas; el
marco del HUD se vuelve rojo cuando corresponde regresar o la batería baja
al 25 %.

- 300 segundos reales equivalen a 24 horas del juego; `update(dt)` y
  `updateSuit(dt, W)` realizan la conversión dentro del sistema, sin multiplicar
  el tiempo otra vez en este prototipo.
- En el exterior el traje consume 144,375 W (normal), 180 W (alto) o 233 W
  (pico). En el interior no consume; con el cargador conectado se llama a
  `rechargeSuit(dt)` (0,5 kW y 90 % de eficiencia).
- La base usa el perfil solar 06:00–18:00 y sombra de 18:00–06:00, las cargas
  y límites del modelo. La sombra manual sirve para simular ausencia de luz.
- Los PNG son niveles discretos del 00 al 10; el porcentaje, autonomía y
  alertas siguen mostrando el valor exacto del modelo. «Regresa ahora» depende
  del margen de regreso, no solo de un porcentaje fijo.
- Los controles T/R originales del juego activan un estado JSON ficticio;
  están desactivados solo en esta prueba para evitar doble consumo/recarga.

Controles de la prueba (sin barras laterales): `1` actividad normal, `2` alta,
`3` pico; `C` conectar/desconectar cargador (recarga solo dentro); `X` activar
o desactivar sombra solar; `N` reiniciar energía. Movimiento: WASD/flechas,
`E` interactuar. Los cambios de actividad y recarga se ven en la batería.

Nota: la recarga del traje utiliza la API del módulo, que prioriza el excedente
solar y después la batería de la base. El cálculo del excedente solar de la
base y del cargador en el mismo paso aún no comparte un presupuesto único:
esta prueba no debe emplearse como contabilidad energética de precisión.

Verificación en la base actual: `node --test pruebas/Hud_bateria/battery.test.mjs`.
