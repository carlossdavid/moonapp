# Prueba del HUD de recursos del traje

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
Comida, agua y batería cambian de nivel; oxígeno permanece atenuado porque
este prototipo no dispone de un valor real para ese recurso.
Los 11 PNG por recurso de `assets/Sprites/Pantalla/niveles/{comida,agua}/`
se cargan desde esta prueba (no están en el manifiesto global).
Todo se recorta dentro del cuadro. Se eliminó el panel lateral de pruebas; el
marco del HUD se vuelve rojo cuando corresponde regresar o la batería baja
al 25 %.

- 300 segundos reales equivalen a 24 horas del juego; `update(dt)` y
  `updateSuit(dt, W)` realizan la conversión dentro del sistema, sin multiplicar
  el tiempo otra vez en este prototipo.
- El hambre parte de 100 % y baja gradualmente hasta 60 % en 170 segundos
  reales (2 min 50 s, equivalentes a 13,6 horas de juego). No se altera la
  escala global de 300 s por día. Se calcula desde el tiempo transcurrido del
  `SistemaEnergia`, tanto dentro como fuera de la base. Como todavía no existe
  una acción de comer, sigue bajando al mismo ritmo hasta 0 %; `N` reinicia
  ambos indicadores.
- Agua potable: bolsa de 950 mL; durante EVA descuenta 170 mL por hora de
  juego, también con el jugador quieto. Dentro de la base conserva el volumen
  restante. `V` rellena manualmente la bolsa solo en el interior; no se simula
  tanque de la estación. El aviso «Regresa a la estación» aparece cuando
  quedan 255 mL o menos (60 min para volver + 30 min de margen); el aviso de
  poca agua corresponde al 25 %. Se mantiene la precisión en mL y solo se
  discretiza la imagen entre 00 y 10. Al pasar el ratón sobre el juego se puede
  consultar el volumen exacto y el aviso. Parámetros según
  `consumo_agua_traje_entrenador_lunar.md`.
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
`3` pico; `C` conectar/desconectar cargador (recarga solo dentro); `V` rellenar
agua en la base; `X` activar o desactivar sombra solar; `N` reiniciar los
recursos. Movimiento: WASD/flechas, `E` interactuar.

Nota: la recarga del traje utiliza la API del módulo, que prioriza el excedente
solar y después la batería de la base. El cálculo del excedente solar de la
base y del cargador en el mismo paso aún no comparte un presupuesto único:
esta prueba no debe emplearse como contabilidad energética de precisión.

Verificación en la base actual: `node --test pruebas/Hud_bateria/battery.test.mjs`.
