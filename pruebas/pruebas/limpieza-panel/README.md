# Prueba aislada: limpieza del panel solar

Se usa **el mismo mapa pixel art y los cuatro paneles solares** del `index.html` actual,
con el mismo motor Canvas (`src/`). El archivo `app.js` crea una subclase
local de `DemoScene` que sustituye **solo en esta página** el efecto de la
tecla E en el panel. Ni `src/`, ni `index.html` de P1, ni los assets
compartidos se modifican.

Desde `moonapp`:

```bash
python -m http.server 8765
```

Abre <http://localhost:8765/pruebas/limpieza-panel/>. Pulsa
**Enter / clic** en el menú; camina a **cualquiera de los cuatro paneles
solares a la izquierda de la base** con WASD o flechas, acércate por su
borde inferior y pulsa **E**. Cada panel conserva su propio progreso.
Se abre una actividad superpuesta, al estilo de una tarea corta de juego:

1. **Descubrir el panel solar:** toca el panel o usa el botón para ver cómo
   recibe luz del Sol, cómo sus celdas la convierten en electricidad para
   la base y qué cambia cuando el polvo tapa parte de ellas. Es un ejemplo
   visual sin porcentajes físicos: al continuar se descubre que falta el
   electroimán para limpiar el panel polvoriento del juego. Esta explicación
   se muestra una sola vez, aunque después abras otro panel o regreses al mismo.
2. **Buscar el electroimán:** al acabar la explicación, VEGA indica que falta
   un imán. Sal de la actividad y recógelo con **E** junto a la base. El
   icono aparece solo cuando empieza la búsqueda. Regresa al panel: esa
   recogida permite completar la primera limpieza, incluso si entras y
   sales de la base antes de usarlo.
3. **Conectar un solo electroimán con dos tomas:** arrastra tú mismo el cable
    A del generador a la toma A del imán y el B a la toma B. Los cables no
    aparecen conectados antes del arrastre; solo se ven las borneras, sin los
    PNG de cables sueltos. «Alternativa sin arrastrar»
   despliega botones para conectar A/B con teclado o pantalla táctil.
4. **Activar el haz:** el botón se habilita solo cuando las dos conexiones
   están hechas. Antes de activarlo, nada se limpia.
5. **Observar el barrido automático** hasta limpiar **las 24/24 zonas**.
   Únicamente entonces se habilita **Finalizar limpieza**. No hay meta de
   80 % ni basta con mover el ratón por el panel.

Al completar una limpieza, el electroimán de juego se desgasta. Al abrir
después **cualquier panel (incluso el mismo)**, el circuito muestra el imán
gastado y VEGA pide un repuesto. Esta vez aparece parcialmente oculto
detrás de una roca al sureste de la base; hay que recogerlo con **E**
antes de volver a conectar los cables. Cada limpieza completa consume
un imán, pero cerrar y reabrir una tarea sin terminarla no lo desgasta.

La **puerta de la base** permanece bloqueada hasta que haya al menos **dos
paneles distintos limpios**. Cada panel terminado sigue limpio durante un
día de juego (**300 segundos / 5 minutos de juego activo**, escala definida
en `src/systems/EnergySystem.js`); no se puede repetir la limpieza mientras
está limpio. El tiempo avanza en el exterior y dentro de la base, pero se
pausa al abrir esta tarea. Después se ensucia de nuevo y deja de contar para
la puerta, que vuelve a bloquearse si quedan menos de dos limpios. Este
umbral es una regla de la prueba, no un cálculo real de la energía de la base.

**Esc** sale conservando el progreso de esa actividad. «Reiniciar» permite
reiniciar la tarea en curso, pero no evita la espera de un día para un panel
ya limpio. No cambia la energía del juego de P1.

El tiempo y la física del mapa quedan detenidos al abrir la tarea. El
porcentaje y el polvo son **valores ficticios de la mecánica**; 100 %
significa que se limpiaron todas las zonas del dibujo, NO garantiza que un
panel lunar real quede totalmente limpio ni que recupere cierta potencia.
Al completar aparece una felicitación: el panel del juego puede recibir
más luz y aportar electricidad, sin prometer toda la energía posible.
El electroimán ficticio orienta el emisor, **no atrae el polvo**:
el mecanismo representado es la **carga electrostática y repulsión del
polvo**, no quemarlo con un láser. [LASP (2025)](https://lasp.colorado.edu/2025/07/28/solving-the-dilemma-of-space-dust-lasp-researchers-win-prestigious-nasa-prize-for-dust-mitigation-instrument/)
describe investigación de mitigación mediante haces de electrones para
superficies que incluyen paneles solares. Su aplicación en esta estación
es ficción; no presentamos la tecnología experimental como equipo NASA
ya operativo allí.

La interfaz usa directamente los **PNG individuales suministrados por
el proyecto** en `ImagenesLimpiezaPaneles/`. `spriteAtlas.js` carga las
piezas originales completas y `spriteArt.js` las compone al dibujar: no
se modifican ni duplican los PNG. Generador, electroimán apagado/energizado,
cables trazados al conectarlos, borneras, paneles con polvo/limpios y partículas se ven en
la tarea. La lógica
permanece en 24 zonas (rejilla visual de 6×4) y el tablero usa
resolución lógica 640×360 para reducir la pérdida de detalle. En pantallas
pequeñas se escala para caber: no puede mostrar los mismos detalles físicos
que una pantalla grande. Los controles HTML siguen accesibles con
teclado, tacto y en pantallas pequeñas. El texto del cuadro y del Canvas usa
la fuente `Press Start 2P` ya presente en el proyecto. Antes de publicar fuera del
equipo, confirmar la autoría y licencia de los tres PNG aportados.

Prueba lógica:

```bash
node pruebas/limpieza-panel/beamCleaning.test.mjs
node pruebas/limpieza-panel/solarProgress.test.mjs
```
