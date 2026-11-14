# Prueba aislada: clima espacial simulado

Esta carpeta **no modifica el juego de P1**. `index.html` carga el juego de
`moonapp/src/main.js` y añade un monitor que solo existe en esta página de
prueba. No carga `liveEventPanel.js`: no presenta registros reales como
alertas de misión. **No consulta DONKI en vivo durante la partida**:
las probabilidades se cargan del archivo local
[`referencia-enero-2026.json`](referencia-enero-2026.json).

Desde `moonapp`:

```bash
python -m http.server 8765
```

Abrir http://localhost:8765/pruebas/clima-espacial/ y pulsar **Monitor
simulado**. La gráfica muestra índices relativos inventados para el juego
(0–100): actividad solar, partículas y campo geomagnético **terrestre**. No
son valores medidos, dosis en astronautas ni pronósticos de NASA. **Probar
alerta** genera el escenario seleccionado, identificado como PRUEBA, sin
cambiar las probabilidades posteriores. **Cambiar «Caso de prueba» solo
muestra una vista previa**; pulsa el botón para iniciar el escenario.
Un día de juego dura **10 minutos reales** mientras la pestaña está visible,
con **un único sorteo aleatorio dentro de cada jornada**. Pausa detiene
el reloj; «Avanzar día» solo sirve para pruebas y **no hace un sorteo
adicional**. Ya no hay botones de 8×/24×. Opcionalmente `?seed=42`
reproduce la misma secuencia.
Pruebas de la lógica: `node pruebas/clima-espacial/simulator.test.mjs`.

## ¿Afecta a la estación?

Se fijó una **estación ficticia cerca de Shackleton** (89,45° S; 222,69° E).
El monitor permite elegir **refugio** o **EVA** y probar cinco escenarios:
una señal indirecta GOES, un instrumento cercano a la Luna, el sensor
exterior de la base, una CME desviada y un GST terrestre.

`riskAssessment.js` distingue **información**, **precaución** y
**alteración local simulada**. Una FLR aislada no causa daño; una CME rápida
pero desviada no impacta; GOES ≥10 pfu (protones ≥10 MeV) solo recomienda
precaución; un instrumento lunar ficticio aporta evidencia próxima pero
no mide la base. Únicamente el **sensor exterior ficticio** puede marcar
una alteración local; su umbral `60/100` es una regla del juego, **NO mSv**.
En EVA se muestra **retorno pendiente** y el botón «Volver al refugio»;
al volver, la EVA queda **suspendida hasta la próxima jornada**. Si la
tripulación ya estaba en el refugio, la EVA también se suspende durante
esa jornada. Cambiar la tripulación afecta inmediatamente el protocolo
visible. Es una consecuencia funcional **solo de esta interfaz de prueba**:
no bloquea aún el movimiento del personaje ni descuenta recursos de P1;
NO se inventa dosis personal. GST/Kp es terrestre.

**Los JSON SEP entregados incluyen un canal `>10 MeV`, pero NO un valor
en pfu.** Los pfu de los escenarios de prueba son números *simulados*,
no extracciones de esos JSON. La dirección de las CME y la posible
conexión lunar generadas por el simulador son también escenarios ficticios,
NO un cálculo de órbita o propagación desde las coordenadas de la base.
CRaTER de LRO mide en órbita lunar, pero no se ha conectado su telemetría
a este prototipo ni se le atribuye una lectura inexistente. Las curvas
0–100 siguen siendo índices de juego sin unidades físicas.

Referencias: [DONKI y tipos de CME](https://ccmc.gsfc.nasa.gov/DONKI/guide/data-reference/),
[NOAA y el umbral terrestre GOES S1](https://www.swpc.noaa.gov/phenomena/solar-radiation-storm),
[LRO/CRaTER](https://science.nasa.gov/mission/lro/science-and-data).

## Tasas fijas tomadas de un mes con eventos

La referencia es **1–31 de enero de 2026 (31 días)**, con los cuatro tipos
presentes y una cadena FLR→CME→SEP. Se verificaron los cuatro endpoints
mensuales de DONKI enlazados en el JSON. Los recuentos son:

| Candidato / continuación | Conteo archivado | Tasa candidata por sorteo |
| --- | ---: | ---: |
| FLR clase M/X | 6 días con FLR / 31 días | 19,4 % |
| CME con análisis principal LE ≥1000 km/s | 10 días con CME / 31 días | 32,3 % |
| GST **terrestre** | 2 días / 31 días | 6,5 % |
| Tras FLR, CME filtrada enlazada | 2 FLR / 8 FLR M/X | 25 % |
| Tras CME filtrada, SEP enlazado | 1 CME / 14 CME filtradas | 7,1 % |

Las **nueve filas SEP** de enero se agrupan en **una** cadena por ID de
CME enlazada, en vez de tratarlas como nueve tormentas. No se añade una
tirada SEP independiente. El filtro de **1000 km/s** selecciona CME tipo
«ocasional» o superiores según la escala SCORE de DONKI; NO afirma que
vayan hacia la estación lunar. La dirección y la evidencia local se
evalúan por separado en los escenarios ficticios del monitor.

**Sesgo explícito:** enero de 2026 se eligió porque sí contiene un episodio
encadenado; sus tasas pueden ser más altas que las de un periodo tranquilo
o un año completo. Las tasas son **candidatas**, no frecuencias finales:
solo se muestra una tarjeta por sorteo. No son pronósticos de NASA ni
probabilidades de impacto lunar.

Cada día jugable dura **600 segundos reales** (10 minutos), y su único
sorteo ocurre entre el minuto 1 y el 9. El reloj no corre cuando la
pestaña está oculta. FLR puede preceder a CME en una jornada siguiente
y CME a SEP; GST es terrestre e independiente. Un día puede acabar sin
alertas. La consulta dinámica anterior, el caché y el botón «Actualizar»
se retiraron de esta página. Diez minutos son una duración de **juego**,
no un día lunar físico. Los 31 días históricos sirven únicamente como
denominador para las frecuencias educativas.

Los avisos de esta prueba emiten `lunar:simulated-weather` en `document`.
**No cambian recursos, turnos ni la escena de P1.** Para incorporar el
prototipo al juego principal habrá que revisarlo juntos y aprobar
explícitamente qué archivos de P1 tocar.
