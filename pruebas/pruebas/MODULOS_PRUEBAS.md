# Módulos de `pruebas/` — descripción detallada

Este documento describe en un solo archivo **todos los módulos/carpetas** contenidos en `pruebas/`. Son prototipos y pruebas aisladas: cada uno incluye su propio código, estilos y/o datos y, salvo donde se indica, **no modifica el juego principal** (`src/`, `index.html` raíz, assets compartidos). Muchos están pensados para ejecutarse con un servidor HTTP local desde la raíz `moonapp`.

## Cómo ejecutar las pruebas (general)

- Desde `moonapp`: `python3 -m http.server 8765` (o `8080`, según el módulo).
- Abrir en navegador la ruta indicada por cada módulo (los ES modules y cargas `fetch` no funcionan bien con `file://`, excepto donde el README lo indique explícitamente).
- Pruebas automáticas (cuando existen): `node ...` desde `moonapp`, según lo documentado en cada módulo.

---

## Índice de módulos

1. [CambioDeModo](#1-cambiodemodo)
2. [clima-espacial](#2-clima-espacial)
3. [Hud_bateria](#3-hud_bateria)
4. [integracion-electrolisis](#4-integracion-electrolisis)
5. [limpieza-panel](#5-limpieza-panel)
6. [MonitorVisor](#6-monitorvisor)
7. [operacion-electrolisis](#7-operacion-electrolisis)
8. [Producción alimentos](#8-producción-alimentos)
9. [produccion-alimentos](#9-produccion-alimentos)
10. [RECARGA OXIGENO](#10-recarga-oxigeno)
11. [storytelling](#11-storytelling)

---

## 1. `CambioDeModo`

**Ubicación:** `pruebas/CambioDeModo/ModosDeEstacion/`  
**Tipo:** minijuego/panel HTML-CSS-JS independiente (UI de consola + sub-minijuegos de calibración).  
**Propósito:** simular el **panel de gestión de energía** de la estación/nave (en la UI aparece como “Panel de Energía — Nave Aurora”) y la selección/calibración de modos de energía.

### Qué hace en detalle
- Presenta una consola con 3 modos de energía, cada uno asociado a una calibración:
  - **Modo Tortuga**: calibración tipo “secuencia de seguridad”.
  - **Modo Explorador**: calibración tipo “sintonizar frecuencia”.
  - **Modo Turbo**: calibración tipo “tuberías de luz”.
- Muestra estado de calibración (candados/iconos), distribución de energía en bloques (barras para Escudo, Motor, Radar; total indicado en UI) y acciones como recalibrar/descalibrar.
- Incluye recursos propios de UI y arte: `marco_consola.png`, iconos de modos, candado descalibrado, bloques de energía lleno/vacío, palanca, lámparas/estados visuales, fondos de estación (`EL_A.png`, `EL_E.png`, `EL_R.png`, variantes de estación grande/pequeña, etc.).
- Contiene subcarpetas de minijuegos con sus fondos/assets (`minijuegos/` y `assets/minijuegos/`: `secuencia`, `frecuencia`, `tuberias`).
- `minijuego cambiar modo.html` e `index.html` son puntos de entrada de la interfaz; la lógica vive en `app.js` y estilos en `styles.css`.
- **Integración en el juego principal:** el juego base lo usa como panel de energía en overlay (iframe a `pruebas/CambioDeModo/ModosDeEstacion/minijuego cambiar modo.html`) desde el módulo de Control de Energía del interior y comunica cambios/cierre por `postMessage`/API expuesta en `index.html` raíz.

### Archivos clave
- `ModosDeEstacion/index.html`, `ModosDeEstacion/minijuego cambiar modo.html`, `ModosDeEstacion/app.js`, `ModosDeEstacion/styles.css`
- `ModosDeEstacion/ui_energia/*`, `ModosDeEstacion/EL_*.png`, fondos y elementos visuales, `minijuegos/{secuencia,frecuencia,tuberias}/`

### Cómo probar
- Abrir `pruebas/CambioDeModo/ModosDeEstacion/minijuego cambiar modo.html` (o `index.html`) vía servidor HTTP desde `moonapp`; o probarlo integrado desde la estación de energía en el juego principal.

---

## 2. `clima-espacial`

**Ubicación:** `pruebas/clima-espacial/`  
**Tipo:** simulador + monitor de clima espacial (prueba aislada, con integración visual junto al visor).  
**Propósito:** simular eventos/lecturas de clima espacial para el juego usando probabilidades derivadas de una **referencia histórica archivada** (enero 2026), sin consultar DONKI en vivo durante la partida ni modificar P1.

### Qué hace en detalle
- Carga el juego de `moonapp/src/main.js` y añade un **monitor simulado** solo en esta página (no carga `liveEventPanel.js`; no presenta registros reales como alertas de misión).
- Usa `referencia-enero-2026.json` como fuente fija de tasas/probabilidades (no telemetría en vivo). Referencia: 1–31 de enero de 2026 (31 días), con FLR, CME, GST y cadena FLR→CME→SEP.
- **Simulación temporal:** 1 día de juego = 10 minutos reales (600 s) mientras la pestaña está visible; **un único sorteo aleatorio por jornada** (entre minuto 1 y 9). Pausa detiene el reloj; “Avanzar día” es herramienta de prueba y no añade sorteo extra. Soporta semilla por URL (`?seed=42`). El reloj no corre si la pestaña está oculta.
- **Gráfica/lecturas:** índices relativos simulados 0–100 (actividad solar, partículas, campo geomagnético **terrestre**). No son valores medidos, pfu, mSv, dosis ni pronósticos NASA.
- **Eventos simulados:** FLR, CME, SEP, GST (GST terrestre e independiente). Posibles encadenamientos (FLR→CME, CME→SEP) según el modelo; SEP no se sortea de forma independiente sin CME encadenada. Emite eventos DOM `lunar:simulated-weather` (alertas) y `lunar:simulated-weather-reading` (lecturas) sin cambiar recursos/turnos/escena de P1.
- **Evaluación de riesgo local (ficticia):** estación fijada cerca de Shackleton (89,45° S; 222,69° E), modos refugio/EVA y escenarios de prueba (señal indirecta GOES, instrumento cercano a la Luna, sensor exterior de la base, CME desviada, GST terrestre). `riskAssessment.js` distingue información/precaución/alteración local simulada. Solo el **sensor exterior ficticio** puede marcar alteración local (umbral de juego 60/100, no mSv). Maneja suspensión de EVA, retorno pendiente/refugio y consecuencias funcionales limitadas a esta interfaz de prueba (no bloquea movimiento ni descuenta recursos de P1).
- **Controles/UI:** abrir/cerrar monitor, pausar/reanudar, probar alerta (genera caso marcado como PRUEBA), seleccionar caso, avanzar día (prueba), contador de alertas/historial, estado de seguridad, lecturas y probabilidades candidatas/encadenadas.
- **Límites explícitos:** tasas candidatas con sesgo (enero 2026 activo), no frecuencias finales ni probabilidad de impacto lunar; pfu/dirección/conexión lunar en escenarios son simulados; CRaTER no conectado; curvas sin unidades físicas.

### Archivos clave
- `index.html`, `app.js`, `simulator.js`, `riskAssessment.js`, `style.css`
- `referencia-enero-2026.json`, `simulator.test.mjs`, `package.json`

### Cómo probar
- Servidor: `python -m http.server 8765` desde `moonapp`.
- Abrir: `http://localhost:8765/pruebas/clima-espacial/` y usar **Monitor simulado**.
- Pruebas: `node pruebas/clima-espacial/simulator.test.mjs`.

---

## 3. `Hud_bateria`

**Ubicación:** `pruebas/Hud_bateria/`  
**Tipo:** prototipo independiente de HUD (batería/comida del traje) sobre escenas reales del juego.  
**Propósito:** mostrar y probar el indicador de energía/comida del traje usando el sistema de energía existente y sprites de niveles, sin tocar `src/` ni el arranque normal.

### Qué hace en detalle
- Arranca una prueba sobre escenas reales del juego; el HUD inferior izquierdo usa los 11 PNG de batería `assets/Sprites/Pantalla/niveles/bateria/` (del manifiesto) y los 11 PNG de comida `assets/Sprites/Pantalla/niveles/comida/` cargados desde esta prueba.
- **Fuente de datos:** porcentajes/alertas desde `SistemaEnergia.getSnapshot().traje`. `BatterySimulation.js` conecta el avance temporal y cambios de escena con el sistema (sin reemplazar fórmulas ni crear contador paralelo).
- **Presentación:** panel de 80×35 px lógicos (esquina inferior izquierda, referencia `REFERENCIA DE POSICIÓN Y BARRA.jpeg`), recorte dentro del cuadro, marco en rojo cuando corresponde regresar o batería ≤ 25%. Comida y batería cambian de nivel; agua y oxígeno se muestran atenuados (sin valores reales en este prototipo). Sin panel lateral de pruebas.
- **Modelo temporal/consumo:**
  - 300 s reales = 24 h de juego; conversión dentro de `SistemaEnergia`.
  - Hambre parte de 100% y baja hasta 60% en 170 s reales (13,6 h de juego), luego continúa al mismo ritmo hasta 0% (no hay acción de comer); `N` reinicia.
  - Exterior: consumo de traje 144,375 W (normal), 180 W (alto), 233 W (pico). Interior: sin consumo; con cargador conectado `rechargeSuit(dt)` (0,5 kW, 90% eficiencia).
  - Perfil solar base 06:00–18:00 y sombra 18:00–06:00; cargas/límites del modelo. Sombra manual para simular ausencia de luz.
- **Controles de prueba:** `1` actividad normal, `2` alta, `3` pico; `C` cargador (recarga solo dentro); `X` sombra solar; `N` reiniciar energía. Movimiento WASD/flechas, `E` interactuar. Controles T/R originales del juego desactivados en esta prueba para evitar doble consumo/recarga.
- **Notas:** PNG son niveles discretos 00–10 pero autonomía/alertas usan valores exactos; “Regresa ahora” depende de margen de regreso. Advertencia de contabilidad: recarga prioriza excedente solar y luego batería base, pero excedente solar base y cargador en el mismo paso no comparten presupuesto único (no usar como contabilidad de precisión).

### Archivos clave
- `index.html`, `main.js`, `BatteryHUD.js`, `BatterySimulation.js`, `FoodSystem.js`
- `battery.test.mjs`, `REFERENCIA DE POSICIÓN Y BARRA.jpeg`

### Cómo probar
- Servidor: `python -m http.server 8080` desde `moonapp`.
- Abrir: `http://localhost:8080/pruebas/Hud_bateria/` (no `file://`).
- Pruebas: `node --test pruebas/Hud_bateria/battery.test.mjs`.

---

## 4. `integracion-electrolisis`

**Ubicación:** `pruebas/integracion-electrolisis/`  
**Tipo:** integración de prueba (juego + minijuego embebido).  
**Propósito:** conectar la estación **CONTROL DE ENERGÍA** del interior de la base con el minijuego `operacion-electrolisis` mediante una copia adaptada del arranque del juego, sin modificar `src/`, `index.html` raíz ni sprites originales.

### Qué hace en detalle
- Usa una copia de `index.html` con `<base href="../../">` para resolver recursos/módulos contra la raíz de `moonapp` y conserva menú, video de introducción y panel DONKI.
- **Flujo:** iniciar juego → ver/saltar intro → en interior, la estación de energía se resalta (contorno cian pulsante) → abrir actividad con `E` en las zonas originales o clic/touch directo sobre la imagen → mostrar explicación (O₂ rojo, H₂ azul, cañón rojo→O₂, cañón azul→H₂) → iniciar minijuego embebido en iframe (`?embed=1`) → al terminar, cerrar y volver a la base con resumen (energía, precisión, agua perdida simuladas). `Escape` o “volver” cierran la actividad en cualquier momento.
- **Arquitectura (`app.js`):** importa `Game`, `DemoScene`, `InteriorBaseScene` originales; define `EnergyStationScene` (subclase que reemplaza solo la acción de la estación y conserva salida al exterior) y `EnergyActivity` (gestión de explicación, iframe y `postMessage`); convierte coordenadas de clic (canvas→lógicas 320×180→mundo) y expone `window.electrolisisIntegration` para depuración/pruebas.
- **Comunicación con minijuego:** recibe `{ type: 'electrolisis:close', summary: { energyWh, precision, waterPct, ... } }`, valida origen, detiene iframe/audio/bucle, reanuda escena y muestra resumen.
- **Verificación automática (`verify.mjs`, CDP/Chrome):** comprueba menú/DONKI, inicio/skip de intro, aviso de zona, apertura por clic y por `E`, explicación, arranque embebido, colores medidos (O₂/H₂), acierto/fin/informe/retorno, cancelación y vista móvil sin desbordamiento.

### Archivos clave
- `index.html`, `app.js`, `style.css`, `verify.mjs`

### Cómo probar
- Servidor: `python -m http.server 8765` desde `moonapp`.
- Abrir: `http://localhost:8765/pruebas/integracion-electrolisis/`.
- Verificación: `node pruebas/integracion-electrolisis/verify.mjs` (servidor activo, Chrome disponible; vars opcionales `ELECTRO_CHROME`, `ELECTRO_BASE`, `ELECTRO_PORT`).

---

## 5. `limpieza-panel`

**Ubicación:** `pruebas/limpieza-panel/` (y copia embebible relacionada en `assets/minigames/limpieza-panel/`)  
**Tipo:** minijuego/tarea interactiva de mantenimiento de paneles solares sobre el mapa del juego.  
**Propósito:** simular la limpieza de paneles solares lunares mediante un electroimán y un haz de carga/repulsión electrostática (mecánica educativa ficticia), integrada como prueba aislada con reglas de progresión.

### Qué hace en detalle
- Reutiliza el mismo mapa pixel art y los 4 paneles solares del juego base con el motor Canvas (`src/`), sin modificar `src/`, `index.html` de P1 ni assets compartidos. `app.js` crea una subclase local de `DemoScene` que sustituye solo la acción de `E` en los paneles.
- **Interacción:** caminar a cualquiera de los 4 paneles (izquierda de la base), acercarse por borde inferior y pulsar `E`. Cada panel conserva su propio progreso. El tiempo/física se pausan al abrir la tarea.
- **Fases de la tarea:**
  1. **Descubrir el panel:** explicación visual de cómo recibe luz y genera electricidad y efecto del polvo (se muestra una vez).
  2. **Buscar el electroimán:** tras la explicación, hay que salir y recogerlo con `E` junto a la base (primera vez) o buscar repuesto (tras desgastes), incluyendo ubicación parcialmente oculta tras una roca en limpiezas posteriores.
  3. **Conectar electroimán:** arrastrar cable A→A y B→B (o alternativa accesible sin arrastrar con botones/teclado/táctil). No hay limpieza antes de conectar.
  4. **Activar el haz:** habilitado solo con ambas conexiones.
  5. **Barrido automático:** limpiar 24/24 zonas (rejilla lógica 6×4). Solo al completar se habilita “Finalizar limpieza”.
- **Progresión/reglas de prueba:** cada limpieza completa desgasta/consume el imán (cerrar sin terminar no lo consume). La puerta de la base se bloquea hasta tener al menos **2 paneles distintos limpios** (regla de prueba). Cada panel limpio dura 1 día de juego (300 s / 5 min de juego activo, escala de `EnergySystem`) y luego se ensucia; el tiempo avanza en exterior e interior pero se pausa en la tarea. `Esc` sale conservando progreso de la actividad; “Reiniciar” reinicia la tarea en curso pero no evita la espera de un panel ya limpio.
- **Representación y límites:** porcentaje/polvo ficticios (100% = zonas del dibujo limpias, no eficacia real). El imán orienta el emisor; el mecanismo representado es carga electrostática/repulsión del polvo (referencia LASP 2025 como inspiración, no equipo NASA operativo). Usa PNG originales en `ImagenesLimpiezaPaneles/` compuestos en canvas (`spriteAtlas.js`, `spriteArt.js`) sin modificarlos; tablero lógico 640×360; controles accesibles.
- **Integración en juego principal (actual):** se puede abrir desde la interacción de la antena exterior mediante overlay/iframe hacia `pruebas/limpieza-panel/index.html` (módulo de prueba).

### Archivos clave
- `index.html`, `app.js`, `PanelCleaningTask.js`, `beamCleaning.js`, `solarProgress.js`
- `spriteAtlas.js`, `spriteArt.js`, `style.css`, `ImagenesLimpiezaPaneles/*`
- Pruebas: `beamCleaning.test.mjs`, `solarProgress.test.mjs`

### Cómo probar
- Servidor: `python -m http.server 8765` desde `moonapp`.
- Abrir: `http://localhost:8765/pruebas/limpieza-panel/`.
- Pruebas: `node pruebas/limpieza-panel/beamCleaning.test.mjs`, `node pruebas/limpieza-panel/solarProgress.test.mjs`.

---

## 6. `MonitorVisor`

**Ubicación:** `pruebas/MonitorVisor/`  
**Tipo:** interfaz de visor (HUD/overlay) de clima espacial acoplada al simulador/monitor, montada sobre el juego en páginas de prueba.  
**Propósito:** mostrar en un visor pixel art (fondo `Imagenes/Visor.png`) las mismas lecturas y alertas simuladas del monitor de clima espacial, sin crear un segundo simulador.

### Qué hace en detalle
- Se abre/cierra con **Shift** (y botón “Abrir visor”, `Escape` para cerrar); incluye toolbar y disposición desplazable en móvil. Convive en la misma página con el “Monitor simulado” de `clima-espacial`.
- **Canales mostrados:** Actividad solar, Partículas (proxy terrestre, no sensor del traje) y Campo terrestre (geomagnetismo terrestre, no dosis lunar), como índices simulados 0–100 con gráficas/series temporales.
- **Sincronización:** consume la **misma instancia** del simulador mantenida por `clima-espacial/app.js` mediante eventos DOM (`lunar:simulated-weather-reading`, `lunar:simulated-weather`); no crea reloj/sorteos/sensores propios. Las curvas se actualizan incluso con el visor cerrado (según lecturas recibidas) y comparte alertas.
- **Alertas y VEGA:** historial de alertas en recuadro; cuando llega una alerta, VEGA muestra brevemente evaluación/acción del evento (sin hablar sin alerta; no deduce dosis personales). Alertas de prueba marcadas como **PRUEBA**. Recuadros de oxígeno/batería/agua permanecen vacíos (pendientes de enlace con HUD).
- **Carga de juego en prueba:** `game.js` arranca el juego con escenas/fondos/sprites originales y contiene compatibilidad temporal para recuperar listas de sprites ante conflicto de fusión en `assets/manifest.json` (sin modificar manifiesto ni `src/main.js` principal).
- `clima-espacial/index.html` también monta este visor; sesiones separadas por URL/pestaña (usar `?seed=42` para comparar).

### Archivos clave
- `index.html`, `visor.js`, `visor.css`, `game.js`
- `Imagenes/Visor.png`, `visor.browser.test.mjs`

### Cómo probar
- Servidor: `python -m http.server 8765` desde `moonapp`.
- Abrir: `http://localhost:8765/pruebas/MonitorVisor/` (o ver visor en `pruebas/clima-espacial/`).
- Pruebas: `node --test pruebas/clima-espacial/simulator.test.mjs`; con servidor y Chrome, `node pruebas/MonitorVisor/visor.browser.test.mjs`.

---

## 7. `operacion-electrolisis`

**Ubicación:** `pruebas/operacion-electrolisis/`  
**Tipo:** minijuego de puntería en Canvas 2D (scripts clásicos, sin módulos ES).  
**Propósito:** simular una operación de electrólisis mediante disparos a átomos/moléculas objetivo con coherencia de colores químicos, calculando puntuación/indicadores educativos.

### Qué hace en detalle
- **Duración y mecánica:** ronda de 25 segundos. El cañón está fijo en la base, gira hacia el puntero (±1.02 rad) y el proyectil sigue la dirección del cañón. Cañón alterna automáticamente entre **rojo** y **azul** cada 4 s.
- **Reglas de acierto/fallo:**
  - Cañón rojo destruye solo átomos **O₂ rojo**; cañón azul solo **H₂ azul**.
  - Acierto: destruye objetivo y suma acierto. Tipo equivocado: suma fallo (no destruye). Disparo al vacío: fallo.
  - Al terminar el tiempo hay margen de 0.8 s para proyectiles en vuelo; los que no llegan cuentan como fallo.
- **Colores/sprites:** usa los 8 PNG originales de `assets/Sprites/electrolisis/` sin copiarlos/modificarlos. Los originales O₂/H₂ se tiñen en memoria para coherencia química (O₂ rojo, H₂ azul); proyectiles del cañón rojo se tiñen en memoria. Recortes de hojas definidos y validados en `js/config.js`.
- **Puntuación (`js/scoring.js`, lógica pura, testeable en Node):**
  - `precisión (%) = aciertos / disparos × 100`
  - `energía (Wh) = aciertos × 12 × (0.5 + 0.5 × precisión/100)` (indicador educativo simulado)
  - `agua perdida = clamp(6 + fallos × 2.6 + (100 − precisión) × 0.22, 0, 100)` (indicador educativo simulado)
  - `fallos = disparos errados + disparos sin objetivo`
- **UI/resultado:** HUD, pantallas de inicio/final, aciertos/fallos/precisión/energía/agua/rango/estrellas, récord local de energía (`localStorage` con protección), fórmulas desplegables, repetir operación.
- **Controles:** apuntar (ratón/táctil/flechas), disparar (clic/tap/botón/ESPACIO/ENTER), silenciar (botón/M). Audio con WebAudio (`audio.js`).
- **Modo embebido/integración:** soporta ejecución embebida (usado por `integracion-electrolisis` con `?embed=1`) y envío de resumen al finalizar/cerrar.

### Archivos clave
- `index.html`, `css/estilos.css`
- `js/config.js`, `js/scoring.js`, `js/assets.js`, `js/audio.js`, `js/game.js`, `js/render.js`, `js/main.js`
- `scoring.test.cjs`

### Cómo probar
- Servidor: `python -m http.server 8765` y abrir `http://localhost:8765/pruebas/operacion-electrolisis/` (también funciona por `file://`).
- Pruebas: `node pruebas/operacion-electrolisis/scoring.test.cjs`.

---

## 8. `Producción alimentos`

**Ubicación:** `pruebas/Producción alimentos/files (1)/`  
**Tipo:** paquete de datos/recursos (no es una app ejecutable por sí sola en esta carpeta).  
**Propósito:** almacenar configuración y recursos gráficos preliminares/exportados para el simulador/módulo de producción de alimentos.

### Qué contiene
- `config_cultivos.json`: configuración de cultivos (datos para parámetros de simulación como tipos, tiempos, rendimientos u otras propiedades según esquema del proyecto).
- `sprites_simulador_luna.zip`: paquete comprimido de sprites/arte para el simulador.
- `vista_previa.png`: imagen de vista previa del contenido/diseño.

### Notas
- Carpeta con nombre que incluye espacio y acento (`Producción alimentos`). No incluye HTML/README propio; funciona como insumo/archivo de trabajo asociado al módulo de producción de alimentos.

---

## 9. `produccion-alimentos`

**Ubicación:** `pruebas/produccion-alimentos/`  
**Tipo:** prototipo/visualización de módulo de producción de alimentos (HTML estático de prueba) con capturas.  
**Propósito:** probar y mostrar la interfaz/flujo del módulo de cultivo/producción de alimentos de la estación.

### Qué contiene y hace
- `vista.html`: vista de la interfaz del módulo (simulación/representación visual de producción de alimentos).
- `integracion.html`: página orientada a probar la integración del módulo.
- `test.html`: página de pruebas del módulo.
- `capturas/`: imágenes de referencia/estado (`01_inicial.png`, `02_tomate_avanzado.png`, `03_lechuga_cosecha.png`) que evidencian estados del flujo (inicio, avance de cultivo, cosecha, etc.).
- Relacionado con la escena/mecánica de producción de alimentos presente en el juego (`src/scenes/ProduccionAlimentosScene.js` y assets asociados), sirviendo como entorno de prueba/visualización aislado.

### Cómo probar
- Servir desde `moonapp` con HTTP y abrir los HTML (`vista.html`, `integracion.html`, `test.html`) según lo que se quiera revisar.

---

## 10. `RECARGA OXIGENO`

**Ubicación:** `pruebas/RECARGA OXIGENO/`  
**Tipo:** minijuego de interacción física/gestos en Canvas 2D (escena de prueba con motor del juego).  
**Propósito:** simular la recarga de oxígeno del traje conectando mangueras y abriendo válvulas, como prototipo aislado.

### Qué hace en detalle
- Arranca una única instancia de `Game` y una escena local de prueba usando el motor ES modules + Canvas 2D, sin editar `moonapp/index.html`, `src/main.js` ni la lógica compartida de `src/minigames/RecargaOxigeno.js`. Carga sprites PNG originales desde `sprites_recarga_oxigeno/`.
- **Flujo de fases:**
  1. **Conectando:** arrastrar el extremo libre de cada manguera a su puerto por color; el otro extremo permanece unido al cilindro. Conexión correcta se imanta/brilla; conexión equivocada muestra fuga temporal y devuelve suavemente la manguera.
  2. **Autorizado:** ambas líneas conectadas, panel con check (se cierra al tocar o tras 1,5 s).
  3. **Válvulas:** girar dos ruedas rojas en sentido horario alrededor de sus centros (2 vueltas por defecto cada una); cada una aporta 50% a la barra de la mochila.
  4. **Completado:** mensaje final y disparo de `onComplete(minigame)` una sola vez; permite reiniciar. En la prueba no altera el oxígeno real del personaje de P1.
- **Interacción:** arrastre/giro directo en imagen y controles táctiles alternativos en móvil (conectar líneas y dar vueltas) respetando fases. Layout en porcentajes sobre escena lógica 320×180 (equivalente 1600×900) escalada uniformemente. Puertos con ancho visual reducido y hitbox/tolerancia mayor para facilidad de uso.
- **Visual:** tanques/mangueras/puertos/manijas/iconos con sprites dedicados (azul reserva O2, verde salida CO2), mensajes por fase, efectos de fuga/partículas (sin crear sprites nuevos), dibujo auxiliar en Canvas para fondo/paneles/indicadores; fuente `Press Start 2P`.
- **Configuración:** constantes de tolerancia, vueltas y tiempos en `RECARGA_CONFIG` (`src/minigames/RecargaOxigeno.js`).

### Archivos clave
- `index.html`, `prueba.js`, `RecargaOxigenoPrueba.js`, `RecargaOxigenoPruebaScene.js`
- `sprites_recarga_oxigeno/*`, imágenes de referencia (`RECARGA_OXIGENO.jpeg`, `EJEMPLO TIPOGRAFÍA.jpeg`)
- Pruebas: `recarga.test.mjs`, `pruebaVisual.test.mjs`

### Cómo probar
- Servidor: `python -m http.server 8765` desde `moonapp`.
- Abrir: `http://localhost:8765/pruebas/RECARGA%20OXIGENO/`.
- Pruebas: `node --test "pruebas/RECARGA OXIGENO/recarga.test.mjs"` y `node --test "pruebas/RECARGA OXIGENO/pruebaVisual.test.mjs"`.

---

## 11. `storytelling`

**Ubicación:** `pruebas/storytelling/`  
**Tipo:** documentación narrativa/guiones (no ejecutable).  
**Propósito:** definir y documentar secuencias de historia, contexto y guiones técnicos para cinemáticas/eventos del juego.

### Qué contiene
- `INICIO.md`: documento de inicio/contexto narrativo.
- `PROLOGO-INVESTIGADOR.md`: guion/variante de prólogo (investigador).
- `PROLOGO-RELEVO.md`: guion/variante de prólogo (relevo).
- `PROLOGO-SIMULADOR.md`: guion/variante de prólogo (simulador).
- `SEGUNDO-STORYTELLING-ALERTA-RADIACION.md`: guion técnico detallado del segundo storytelling (“Lo que el visor no ve”) asociado a alerta de radiación; incluye estructura por tiempos/planos, audio, comportamiento del visor/VEGA, niveles de protocolo ficticio del traje (Precaución/Alerta/Crítica), indicaciones de UI/HUD y restricciones de representación (visualizaciones ilustrativas, no telemetría/dosis real, sin umbrales físicos inventados).

### Notas
- Material de diseño narrativo y referencia para implementación audiovisual/interactiva; no incluye código ejecutable del juego.

---

## Notas transversales

- **Aislamiento:** la mayoría de módulos no alteran P1; algunos de integración (`integracion-electrolisis`) copian/adaptan el arranque sin modificar fuentes originales.
- **Dependencias comunes:** varios módulos reutilizan motor/escenas/assets de `src/` y `assets/` cargándolos desde la raíz `moonapp`.
- **Naturaleza educativa/simulada:** energía, agua, dosis/riesgo climático, eficacia de limpieza, etc., se presentan como indicadores o mecánicas de juego salvo que se indique lo contrario; no deben interpretarse como mediciones físicas reales.
- **Ejecución:** preferir servidor HTTP local; revisar rutas con espacios/acentos (p. ej. `Producción alimentos`, `RECARGA OXIGENO`) al abrir URLs o ejecutar pruebas.
