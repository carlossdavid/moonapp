# Prueba independiente de alimentos

**Integrada en la casa verde de `final/`.** No modifica el principal ni `src/`.
También puede abrirse sola para practicar.

La misión ocupa una pantalla fija ajustada al viewport. Las pestañas **Misión**,
**Cultivo / luz**, **Ficha científica** y **Bitácora** sustituyen la página larga.
**Salir** vuelve al juego conservando el progreso durante la sesión.

## Abrir

Doble clic en **`ABRIR.cmd`**, en esta carpeta. Necesita Python y abre:

**http://localhost:8765/pruebas/Alimentos/**

Si ya tienes un servidor desde moonapp en ese puerto, abre directamente la URL.
También puedes ejecutar desde moonapp:

```powershell
python -m http.server 8765
```

El HTML usa módulos JavaScript y necesita HTTP; no funciona abriendo el HTML
directamente con `file://`.

## Qué cambia por cultivo

- Nombre, icono y selección.
- Fondo de cámara propio, sprite de la planta, animación de dos frames y etapa.
- Cuatro canales de luz, sus porcentajes, lámparas y haces en la vista previa.
- Temperatura, humedad y CO₂ con los rangos y contextos de la tabla.
- Mezcla de referencia y comparación de la configuración actual.

| Cultivo | Roja | Azul | Verde | Blanca |
|---|---:|---:|---:|---:|
| Lechuga romana roja | 75 % | 18,75 % | 6,25 % | 0 % |
| Mizuna | 81,8 % | 9,1 % | 9,1 % | 0 % |
| Tomate enano | 90 % | 10 % | 0 % | 0 % |
| Ají | 27 % | 40 % | 33 % | 0 % |
| Papa | 0 % | 0 % | 0 % | 100 % |
| Trigo enano | 0 % | 0 % | 0 % | 100 % |

El trigo sustituye la receta 50/50 del JSON antiguo **solo en `datos.js`**,
según lo pedido. El archivo `Sprites/config_cultivos.json` no se ha alterado.

Los deslizadores admiten arrastre, teclado y valores numéricos con dos
decimales. Cada cultivo conserva su mezcla propia durante la sesión.
En vista previa, **Aplicar** guarda los cambios sin avanzar días ni inventar
un crecimiento. El engranaje permite cambiar el día/etapa visual y restaurar
la mezcla; esos controles se bloquean durante una misión activa.
No existe guardado persistente entre recargas del navegador.

## Jugar: rescate del invernadero

Pulsa **Iniciar misión** en la planta que quieras cuidar. Las seis tienen
progreso independiente:

1. **Preparar la cámara:** reparar un perfil de iluminación equivocado.
2. **Revisar el cultivo:** recuperar su canal principal apagado.
3. **Recuperar la iluminación:** corregir dos canales descalibrados.

En cada revisión, consulta la receta, ajusta las luces y pulsa **Aplicar**.
Se acepta ±0,5 puntos por canal como regla de dificultad del juego, **no**
como margen agronómico. Después pulsa **Registrar revisión**: queda anotada
en la bitácora, avanza el día simulado y aparece el siguiente incidente.
Las etapas visuales progresan de semilla a joven, madura y lista para cosecha.
No hay cuenta atrás ni muerte de la planta por tardar.

Tras tres cuidados, valida una ficha científica para conseguir la insignia
**Botánico lunar** de esa planta. Las preguntas distinguen los datos de ISS y
Veggie, valores aproximados y cifras no confirmadas. No piden inventar datos.

- Reparación: **100 puntos**, una sola vez por revisión.
- Registro del cuidado: **25 puntos**, una sola vez por revisión.
- Ficha correcta e insignia: **75 puntos**.
- Total: **450 por cultivo**, **2700** y seis insignias para la colección.
- Consultar recetas, pedir diagnóstico a VEGA o equivocarse no resta puntos.
- Al cambiar de planta se conservan fallas, mezclas, bitácora y premios.
- Al completar se puede visitar el siguiente cultivo o volver a la vista previa.

La cosecha y el crecimiento son **mecánicas de entrenamiento**, sin masa,
calorías ni rendimiento físico. En final/, cada insignia entrega una ración
de entrenamiento que recupera la barra de comida una sola vez por cultivo.

## Condiciones y alcance

Los rangos son **condiciones reportadas**, no mediciones de cámara ni una
receta óptima universal. Se distinguen ambiente ISS y Veggie donde lo indica
la tabla. Ají muestra aproximadamente 23 °C, 50 % y 550 ppm.

Tomate, papa y trigo mantienen los datos ambientales sin cifras como `null` y
«Sin dato numérico confirmado», con su contexto. El oxígeno no tiene cifra
por cultivo en las tablas: no se copia el 20,9 % de la maqueta como medición.

«Efecto esperado» compara la mezcla con la referencia, **no predice rendimiento
ni salud biológica**. La cara indica el estado de configuración, no la salud
de un experimento NASA.

## Sprites

Se usa `referenciaINterfaz.jpeg` para la distribución, no como fondo con cifras
incrustadas. Los PNG originales permanecen intactos. Cada cámara usa su propio
`fondos/nativo/fondo_camara_<cultivo>.png`.

En el pack actual hay frames con tierra para mizuna, lechuga, tomate, ají y
papa; los frames de trigo disponibles son los hidropónicos. Se usan esas
imágenes reales. No se crean ni se piden rutas hidropónicas ausentes.

## Pruebas

Desde moonapp:

```powershell
node --test pruebas/Alimentos/datos.test.mjs
node --test pruebas/Alimentos/misiones.test.mjs
node pruebas/Alimentos/verify.mjs
```

La verificación del navegador necesita Chrome, Python y Node. Arranca su
propio servidor en 8785. Verifica los seis escenarios, cada porcentaje y
condición, arrastre real, aplicación y persistencia por planta, cambio de
etapas, Escape y vista móvil. Comprueba que no haya 404 ni excepciones y que
los hashes de `final/`, `src/`, el index principal y los sprites no cambien.
Las capturas se guardan en `%LOCALAPPDATA%/Temp/opencode/alimentos-*.png`.
También completa las seis misiones desde la interfaz y comprueba las fichas,
recompensas únicas, consultas gratuitas y persistencia entre plantas.
