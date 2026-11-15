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
- Base grande: exactamente tres módulos: **recarga O₂/batería**, **DONKI**
  y **cambio de modo**. El módulo de recarga también permite rellenar agua.
- Casa verde: **alimentación**. Casa amarilla: **electrólisis**.
  Usan `EstaciónLunarPequeñaOscura.png`, distinto del interior principal.
- Los modos y el progreso de cultivos se conservan durante la sesión.
  No hay guardado entre recargas del navegador.
- Alimentos tiene pantallas de misión ajustadas al viewport con pestañas,
  sin desplazamiento de página. Usa los seis cultivos y sprites existentes.

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
5. Un imán inicial y uno cada **60 s activos**, máximo tres en el mapa.
   Pedir uno desde un panel solo informa; no genera repuestos.
6. A los **180 s activos** aparece el aviso de limpieza. Ver transmisión
   reproduce `segunda_escena.mp4`; terminar/salir habilita **Shift**.
7. **Recarga + E:** conectar mangueras y girar válvulas para O₂; autorizar
   cargador para batería. La transferencia acelerada de entrenamiento usa las
   reservas y eficiencias reales, sin avanzar el reloj ni rellenar solo el dibujo.
   Sin suficiente reserva, la barra refleja la transferencia parcial.
8. Cada insignia entrega una ración de entrenamiento que recupera la barra de
   comida una sola vez. No representa calorías ni rendimiento agrícola.
9. Las tareas conservan **Salir**, incluso tras completarse. Hay transición
   pixelada al entrar/salir de escenas y módulos.

## HUD de Hud_bateria

Una instancia de `SistemaEnergia`, `SistemaOxigeno` y `SuitWater` por partida:
batería, hambre, agua y oxígeno provienen de los modelos originales. Se elimina
el drenaje ficticio del JSON T/R solo en esta entrada.

- WASD/flechas: mover. E: interactuar. M: minimapa. T: ocultar/mostrar HUD.
- Recargas y agua se realizan desde el módulo del principal, no con C/O/V.
- 1/2/3: esfuerzo normal/alto/pico del traje.
- X: sombra solar manual. N ya no reinicia los recursos.
- Escape: cerrar actividades o volver de recarga.
- En tareas/diálogos y recarga no se consume del traje ni avanza mantenimiento,
  igual que la pausa de limpieza original.
- Un recurso agotado causa daño y muerte a los **cinco segundos continuos**.
  Recuperar todos los recursos reinicia la cuenta y restaura la vida de entrenamiento.
  Cinemáticas y transiciones también pausan la cuenta. La muerte permite Reiniciar.

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
node --test final/mission-state.test.mjs
node --test pruebas/clima-espacial/simulator.test.mjs
node --test pruebas/Hud_bateria/battery.test.mjs
```

La primera prueba inicia su servidor en 8781 y Chrome headless, recorre los
componentes en una partida, verifica consumos, mantenimiento, transiciones,
fondos, distribución especializada, cultivos persistentes y recompensa real,
evento narrativo y visor, modos/electrólisis, transferencia real de O₂/batería
y muerte. Guarda capturas en
`%LOCALAPPDATA%/Temp/opencode/final-*.png` y comprueba que los archivos
originales mantengan sus hashes antes y después de la ejecución.

Verificado: recorrido integrado y seis misiones de alimentos en Chrome sin
excepciones ni HTTP 404; 52 pruebas de lógica y sistemas aprobadas.
Invertir temporalmente el umbral del aviso hace fallar su prueba de regresión;
la condición correcta está restaurada.
