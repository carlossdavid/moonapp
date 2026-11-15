# Entrenador Lunar: tarjetas y evidencia DONKI

**Entrega aislada para P1, P3 y P4.** Los datos estructurados están en
[`tarjetas-misiones.json`](tarjetas-misiones.json). Este paquete **todavía no está
integrado al juego**. El motor existente en `moonapp/src/` usa **JavaScript
(.js), no Java (.java)**. El JSON es legible desde ambos lenguajes; confirmar
el lenguaje con P1 antes de implementar integración.

## Calendario del jugador (no corresponde a fechas NASA)

| Turno de juego | Misión | Tarjeta | Actividad | Lo que cambia |
| --- | --- | --- | --- | --- |
| 1 | Energía | `m1-paneles` | Paneles o cráter | Energía futura frente a muestra. |
| 2 | Energía | `m1-aire` | Aire o cráter | Soporte vital frente a ciencia. |
| 3 | Recursos | `m2-cultivo` | Huerto o aire | Dos reservas compiten por energía. |
| 4 | Recursos | `m2-preparacion` | Refugio o huerto | Preparación futura frente a alimento presente. |
| 5 | Alerta | `m3-primera-senal` | Revisar datos o salida corta | Una señal solar no equivale a dosis lunar. |
| 6 | Alerta | `m3-alerta-sep` | Refugio o cráter | Seguridad frente a ciencia. |

Los turnos son **etapas ficticias del entrenamiento**; no duran un día lunar
ni transcurren en las fechas NASA. Las unidades de energía, aire, alimento y
exposición son **puntos de juego**. No son kWh, litros, kg ni mSv.

**Aplicación propuesta de reglas:** empezar con el estado inicial del JSON,
comprobar que la opción cabe en la energía disponible, aplicar cambios,
restar 1 de aire y 1 de alimentos al final de cada turno, comprobar el
límite de exposición y pasar a la tarjeta siguiente. Al elegir «preparar
refugio» en el turno 4, el regreso del turno 6 no gasta energía adicional;
si no se preparó, cuesta **hasta 2 de la energía restante** (sin bajar de
cero). **El acceso al refugio nunca se bloquea**, aun con energía cero. Si
la energía no permite cualquier otra opción, esa opción se muestra
deshabilitada y se explica el costo.

**Pendiente de balance por P3:** estos seis turnos y todos los costos son
propuestas de diseño, no estadísticas NASA ni una simulación médica.

## Línea temporal histórica que inspira la misión 3

| Momento real UTC | Evidencia observada | Cómo se usa |
| --- | --- | --- |
| **1 ene 2016, 23:10** | Fulguración M2.3, ID `2016-01-01T23:10:00-FLR-001`. | Información inicial en turno 5. |
| **1 ene 2016, 23:12** | CME, ID `2016-01-01T23:12:00-CME-001`; [registro con enlaces a FLR y SEP](https://ccmc.gsfc.nasa.gov/DONKI/view/CME/9968/-1). | Contexto de que hay fenómenos relacionados; **no mostrar como pronóstico de impacto lunar**. |
| **2 ene 2016, 02:48** | [SEP detectado por SOHO](https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/9966/-1), ID `2016-01-02T02:48:00-SEP-001`. | Hito de evidencia del turno 6. |
| **2 ene 2016, 04:30** | [SEP detectado por GOES](https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/9964/-1), ID `2016-01-02T04:30:00-SEP-001`. | Hito de evidencia del turno 6. |
| **2 ene 2016, 04:41** | [Notificación DONKI](https://ccmc.gsfc.nasa.gov/DONKI/view/Alert/9965/1), ID `20160102-AL-001`. | Tarjeta de alerta del turno 6. |

DONKI enlaza estos registros, pero **el análisis posterior de la CME no
estaba disponible a la hora inicial de la partida histórica**. Los hitos
UTC son hechos archivados; la base, las elecciones y el resultado son una
hipótesis educativa. No presentar los dos turnos como «dos días reales de
pronóstico».

## Estadísticas útiles, sin inventar probabilidades

El [informe semanal DONKI `20261111-7D-001`](https://ccmc.gsfc.nasa.gov/DONKI/view/Alert/49503/1)
cubre **4–10 de noviembre de 2026**: enumera **7 fulguraciones clase M**,
**7 CME tipo C** y señala que el flujo de protones energéticos (>10 MeV
en GOES/SOHO y 13–100 MeV en STEREO A) se mantuvo **a nivel de fondo**
durante el periodo. **7 registros por semana no significa 1 evento por día,
ni una probabilidad para activar tarjetas.**

El [aviso `20261110-AL-001`](https://ccmc.gsfc.nasa.gov/DONKI/view/Alert/49474/1)
estima una CME de **~726 km/s** del 9 de noviembre y un posible roce en
**Marte** el 13 de noviembre a las 12:00 UTC **±7 horas**. Es ejemplo de
**incertidumbre de trayectoria modelada**, no de impacto lunar.

Para cifras de protección y medidas plausibles: [NASA explica por qué
pueden posponerse salidas y utilizarse refugios más protegidos](https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/).
Una fulguración o CME **no** garantiza un SEP; el jugador no evita el
fenómeno solar, sino que puede reducir la exposición.

## Entrega a P1

- Cargar **el JSON local** como fuente fija para grabar y probar siempre
  la misma partida. No depender de la consulta en vivo para abrir el juego.
- Mantener separados `registrosNASA` (hechos, enlaces y fechas UTC) y
  `tarjetas` (reglas del juego). Nunca calcular dosis lunares desde FLR,
  velocidad CME, flujo GOES o índice geomagnético terrestre.
- Mostrar en interfaz «**Archivo NASA / evento observado**» y «**Situación
  lunar simulada**» junto a la tarjeta del turno 6.
- La [vista gráfica DONKI](https://ccmc.gsfc.nasa.gov/DONKI/events/) sirve
  para explorar y contrastar cadenas; **no hace falta extraer imágenes de
  su gráfica**. Citar las páginas individuales.
- Si P1 efectivamente trabaja en **Java (.java)** en otro proyecto, pedir
  el repositorio correcto antes de integrar; este directorio actualmente
  tiene archivos `.js`.
