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
   visual sin porcentajes físicos: al continuar comienza la limpieza del
   panel polvoriento del juego.
2. **Conectar un solo electroimán con dos tomas:** arrastra tú mismo el cable
   A del generador a la toma A del imán y el B a la toma B. Los cables no
   aparecen conectados antes del arrastre. «Alternativa sin arrastrar»
   despliega botones para conectar A/B con teclado o pantalla táctil.
3. **Activar el haz:** el botón se habilita solo cuando las dos conexiones
   están hechas. Antes de activarlo, nada se limpia.
4. **Observar el barrido automático** hasta limpiar **las 24/24 zonas**.
   Únicamente entonces se habilita **Finalizar limpieza**. No hay meta de
   80 % ni basta con mover el ratón por el panel.

**Esc** sale conservando el progreso de esa actividad. «Reiniciar» permite
volver al principio; al repetir una actividad ya completada se reinicia
ese panel. No cambia la energía del juego de P1.

El tiempo y la física del mapa quedan detenidos al abrir la tarea. El
porcentaje y el polvo son **valores ficticios de la mecánica**; 100 %
significa que se limpiaron todas las zonas del dibujo, NO garantiza que un
panel lunar real quede totalmente limpio ni que recupere cierta potencia.
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
cables sueltos, conectores, paneles con polvo/limpios y partículas se ven en
la tarea. La lógica
permanece en 24 zonas (rejilla visual de 6×4) y el tablero usa
resolución lógica 640×360 para reducir la pérdida de detalle. En pantallas
pequeñas se escala para caber: no puede mostrar los mismos detalles físicos
que una pantalla grande. Los controles HTML siguen accesibles con
teclado, tacto y en pantallas pequeñas. Antes de publicar fuera del
equipo, confirmar la autoría y licencia de los tres PNG aportados.

Prueba lógica:

```bash
node pruebas/limpieza-panel/beamCleaning.test.mjs
```
