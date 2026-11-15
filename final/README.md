# Entropía Cero — sistema integrado

Entrada nueva: **`moonapp/final/index.html`**.
No reemplaza `moonapp/index.html`, `src/`, assets ni las pruebas originales.

## Abrir

En Windows, doble clic en **`final/ABRIR.cmd`**. Abre una terminal de servidor
y el navegador. Conserva esa terminal abierta mientras juegas.
Si ya hay un servidor en 8765 desde moonapp, basta visitar la URL.

Manualmente, desde la carpeta `moonapp`:

```powershell
python -m http.server 8765
```

Abre **http://localhost:8765/final/**.
El HTML necesita HTTP (módulos/JSON); el doble clic directo al HTML no inicia
el juego y muestra una indicación. La carpeta final reutiliza archivos de
`../src`, `../assets` y `../pruebas`: no debe moverse fuera de moonapp.

## Distribución

- **Arriba:** `EstaciónLunar.png`, interior `BaseLunarGrandeInterior.png`.
- **Derecha, arriba:** estación verde `01_base_nueva.png`.
- **Derecha, abajo:** estación amarilla `01_base_nueva_amarilla.png`.
- **Izquierda:** cuatro paneles solares; antenas y rocas conservan su arte.
- Las estaciones laterales comienzan con `EstaciónLunarGrandeClaro.png`.
  Tortuga usa `EstaciónLunarGrandeAhorro.png`, Explorador usa Claro y Turbo
  usa `EstaciónLunarGrandeOscuro.png`. La selección y la calibración se
  conservan por estación durante la partida. No hay guardado entre recargas.
- Interiores: oxígeno arriba/izquierda, energía derecha, consola central,
  almacenamiento abajo. Colisiones/puertas adaptadas al nuevo fondo.
- **Producción de alimentos excluida:** no hay módulo, interacción ni arranque
  del simulador de cultivos. La barra de hambre del HUD sí permanece.

## Flujo

1. Iniciar desde el menú (Enter o clic). Se conserva la introducción; se puede
   saltar con Espacio/Enter.
2. Explorar/limpiar los paneles: explicación, recoger imán, conectar A/B,
   activar el barrido, terminar las 24 zonas y buscar repuesto para otro panel.
   Dos paneles distintos limpios habilitan las puertas de las estaciones.
   Conservan la limpieza 300 segundos de juego activo, como en la prueba.
3. Acercarse a una puerta y pulsar E. La salida devuelve a esa puerta.
4. **Consola de control + E:** sprite DONKI con las cinco tasas históricas de
   enero 2026 y curvas/valores simulados; X/Escape cierra.
5. **Shift:** visor con las mismas curvas/alertas. VEGA habla cuando hay alerta.
6. **Control de energía + E:** elegir calibración de modos o electrólisis.
   Se reutilizan las actividades originales, no otra partida completa.
7. **Oxígeno + E:** conectar mangueras y girar válvulas con sus sprites.
   También hay botones de alternativa al arrastre. Completar habilita la
   conexión de recarga; volver deja que el sistema O₂ recargue al caudal
   original, con su eficiencia y reserva. No se inventa un llenado instantáneo.

## HUD de Hud_bateria

Una instancia de `SistemaEnergia`, `SistemaOxigeno` y `SuitWater` por partida:
batería, hambre, agua y oxígeno provienen de los modelos originales. Se elimina
el drenaje ficticio del JSON T/R solo en esta entrada.

- WASD/flechas: mover. E: interactuar. M: minimapa. T: ocultar/mostrar HUD.
- Interior: C conecta/desconecta batería; O conecta/desconecta O₂; V rellena agua.
- 1/2/3: esfuerzo normal/alto/pico del traje.
- X: sombra solar manual; N: reiniciar recursos (herramientas originales del HUD).
- Escape: cerrar actividades o volver de recarga.
- En tareas/diálogos y recarga no se consume del traje ni avanza mantenimiento,
  igual que la pausa de limpieza original.

Las tareas de electrólisis conservan su informe educativo, sin convertir sus
puntos a Wh o kg del modelo. No se altera la contabilidad original del HUD.
El límite previo de presupuesto compartido cargador/base sigue documentado en
`pruebas/Hud_bateria/README.md`.

## DONKI y tiempos

Una instancia del simulador de `pruebas/clima-espacial/simulator.js`, manejada
por `final/weather.js`: referencia de enero de 2026. El adaptador local evita
intervalos negativos en el primer fotograma, sin modificar la prueba original.
No consulta telemetría viva. Porcentajes históricos: FLR 19,4 %, CME 32,3 %,
GST 6,5 %, FLR→CME 25,0 %, CME→SEP 7,1 %.
Las curvas son índices inventados 0–100, **no** pfu/Kp/mSv ni dosis lunar.

Se conservan las escalas previas: recursos/limpieza usan 300 s/día;
el sorteo DONKI usa 600 s/jornada y continúa con su reloj propio. No se
aceleran ni se convierten unas jornadas en otras. «Simular alerta · PRUEBA»
es una acción manual, no genera sorteos diarios extra.

## Verificación

Desde moonapp, con Python, Node y Chrome instalados:

```powershell
node final/verify.mjs
node --test final/weather.test.mjs
node --test pruebas/clima-espacial/simulator.test.mjs
node --test pruebas/Hud_bateria/battery.test.mjs
```

La primera prueba inicia su servidor en 8781 y Chrome headless, recorre los
componentes en una partida, verifica consumos, mantenimiento, transiciones,
fondos, exclusión de cultivos, sincronía de visor y consola, interfaces de
modos/electrólisis y conexión de O₂. Guarda capturas en
`%LOCALAPPDATA%/Temp/opencode/final-*.png` y comprueba que los archivos
originales mantengan sus hashes antes y después de la ejecución.

Verificado: recorrido integrado en Chrome sin excepciones ni HTTP 404; 51
pruebas de lógica/recurso/recarga/limpieza/electrólisis/tiempo aprobadas.
Se comprobó además que invertir temporalmente el bloqueo de puertas hace
fallar la prueba integrada; la condición correcta está restaurada.
