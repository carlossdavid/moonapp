# Datos DONKI usados en la simulación (enero 2026)

Este documento explica **qué datos históricos se tomaron de NASA DONKI**, **cómo se procesaron** para obtener las tasas fijas usadas por el monitor/visor de clima espacial, y **cómo llegar a la información original**.

> Alcance: los datos alimentan una **simulación educativa y de juego**. **No** son telemetría en vivo, pronósticos operativos de NASA, dosis en astronautas, valores físicos medidos en la base ni probabilidades reales de impacto en la Luna (Shackleton u otro punto).

## Fuente

- **Servicio:** Space Weather Database Of Notifications, Knowledge, Information (DONKI), del Community Coordinated Modeling Center (CCMC), NASA GSFC.
- **API:** https://ccmc.gsfc.nasa.gov/tools/DONKI/
- **Referencia de datos y tipos de evento (CME/FLR/SEP/GST):** https://ccmc.gsfc.nasa.gov/DONKI/guide/data-reference/

Los parámetros archivados en el proyecto están en [`referencia-enero-2026.json`](referencia-enero-2026.json).

## Periodo y consultas realizadas

- **Periodo UTC:** 2026-01-01 a 2026-01-31 (31 días).
- **Endpoints consultados (GET, rango mensual):**
  - Flares (FLR): https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR?startDate=2026-01-01&endDate=2026-01-31
  - Eyecciones de masa coronal (CME): https://ccmc.gsfc.nasa.gov/DONKI-API/get/CME?startDate=2026-01-01&endDate=2026-01-31
  - Partículas energéticas solares (SEP): https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2026-01-01&endDate=2026-01-31
  - Tormentas geomagnéticas (GST): https://ccmc.gsfc.nasa.gov/DONKI-API/get/GST?startDate=2026-01-01&endDate=2026-01-31

> Nota: la API puede requerir o aceptar una clave (`api_key`). DONKI ofrece uso con clave; consulta la documentación del portal DONKI/CCMC para el método de acceso vigente. Las respuestas son JSON.

## Cómo se tomaron y procesaron los datos

El criterio aplicado (también resumido en el JSON) fue:

| Tipo | Criterio de inclusión/conteo | Resultado archivado |
| --- | --- | --- |
| **FLR** | Clase M/X. Se cuentan **días distintos** con evento, no registros individuales. | 8 registros; **6 días** con evento; 2 fulguraciones enlazadas a una CME filtrada. |
| **CME** | Velocidad **≥ 1000 km/s** en el análisis del borde delantero (LE) marcado como más preciso. Se cuentan **días distintos**. El umbral corresponde a CME de tipo O o superior según la clasificación SCORE de DONKI; **no** indica trayectoria hacia la Luna. | 14 registros filtrados; **10 días** con evento; 1 CME enlazada a SEP. |
| **SEP** | Las observaciones se agrupan por **ID de CME enlazada**. Las 9 filas del episodio de enero se agrupan en **una sola cadena** (no se tratan como 9 tormentas independientes). No se añade una tirada SEP independiente en el sorteo. | 9 filas; **1 cadena** distinta; CME enlazada: `2026-01-18T18:09:00-CME-001`. |
| **GST** | Se cuentan **días con GST terrestre**. No se interpreta como incidencia lunar. | 2 registros; **2 días** con evento. |

### Encadenamientos considerados

- **FLR → CME filtrada:** 2 FLR enlazadas / 8 FLR M/X = **25,0 %** (tasa encadenada).
- **CME filtrada → SEP:** 1 CME enlazada / 14 CME filtradas = **7,1 %** (tasa encadenada).

### Ejemplos de eventos enlazados (IDs DONKI)

- `2026-01-11T21:53:00-FLR-001`
- `2026-01-11T22:45:00-CME-001`
- `2026-01-18T17:27:00-FLR-001`
- `2026-01-18T18:09:00-CME-001`
- `2026-01-18T22:55:00-SEP-001`
- `2026-01-19T18:00:00-GST-001`

## Tasas usadas en el juego

A partir de los conteos anteriores se derivan tasas candidatas por sorteo (un día de juego = 10 min reales; un sorteo por jornada):

| Evento / continuación | Conteo | Tasa |
| --- | ---: | ---: |
| FLR clase M/X | 6 días / 31 | 19,4 % |
| CME con análisis LE ≥ 1000 km/s | 10 días / 31 | 32,3 % |
| GST terrestre | 2 días / 31 | 6,5 % |
| Tras FLR, CME filtrada enlazada | 2 / 8 | 25,0 % |
| Tras CME filtrada, SEP enlazado | 1 / 14 | 7,1 % |

Estas tasas están codificadas en `referencia-enero-2026.json` bajo `modeloProbabilistico` y son las que lee `final/weather.js` / `pruebas/clima-espacial/simulator.js`.

## Cómo reproducir o verificar la extracción

1. **Abrir las consultas:** usa los cuatro enlaces de la sección “Consultas realizadas” en un navegador o con `curl` para descargar los JSON de enero 2026.
2. **Aplicar filtros:**  
   - FLR: conservar clase M o X y contar fechas/días únicos.  
   - CME: revisar `cmeAnalyses` y tomar la velocidad LE del análisis marcado como más preciso (`isMostAccurate` cuando aplique); filtrar ≥ 1000 km/s y contar días únicos.  
   - SEP: agrupar por el identificador de CME enlazada en los registros; contar cadenas distintas.  
   - GST: contar días/registros con tormenta geomagnética.  
3. **Identificar encadenamientos:** usar los campos de eventos enlazados que proporciona DONKI (por ejemplo, asociaciones entre FLR/CME/SEP) para reproducir las relaciones y los IDs de ejemplo.
4. **Comparar:** contrastar con `conteos`, `modeloProbabilistico` y `ejemplosEnlazados` en `referencia-enero-2026.json`.

## Limitaciones y advertencias

- **Muestra sesgada al alza:** enero de 2026 se eligió por contener un episodio encadenado; sus tasas pueden ser mayores que las de un periodo tranquilo o de un año completo.
- **No es pronóstico ni impacto lunar:** las tasas son parámetros del juego, no frecuencias finales de riesgo físico en la superficie lunar.
- **Curvas 0–100 simuladas:** los índices de actividad solar, partículas y campo terrestre mostrados por el monitor/visor son valores inventados para la interfaz; no son pfu, Kp, mSv ni mediciones de instrumentos reales.
- **GST es terrestre:** se usa como contexto educativo; no implica efecto directo equivalente en la Luna.
- **Dirección/evidencia local ficticia:** trayectorias, sensores locales y escenarios de prueba son reglas del juego, no cálculos de propagación desde DONKI.
- **Referencias complementarias citadas en la prueba:**  
  - Umbral/escala de tormentas de radiación solar (NOAA/SWPC): https://www.swpc.noaa.gov/phenomena/solar-radiation-storm  
  - LRO/CRaTER (contexto de medición en órbita lunar, no integrado en este prototipo): https://science.nasa.gov/mission/lro/science-and-data
