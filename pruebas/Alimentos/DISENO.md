# Prueba de alimentos — diseño aprobado

Entrada independiente `index.html`, sin tocar final/, src/, index principal ni
los sprites. La interfaz sigue referenciaINterfaz.jpeg: cultivos a la izquierda,
cuatro deslizadores al centro, cámara y efecto esperado a la derecha, ambiente
abajo. Se reutilizan PNG de Sprites, no se genera ni modifica arte.

## Datos y comportamiento
- Seis cultivos: cada selección cambia icono, cámara, planta, mezcla y ambiente.
- Mezclas: lechuga 75/18,75/6,25/0; mizuna 81,8/9,1/9,1/0;
  tomate 90/10/0/0; ají 27/40/33/0; papa y trigo 0/0/0/100.
- El trigo se configura en los archivos nuevos, sin alterar el JSON del pack.
- Se conservan rangos y contextos de los experimentos de la tabla del usuario.
  Los datos no confirmados siguen como null, nunca como cero ni lecturas falsas.
- Los sliders son independientes, conservan decimales y estado por cultivo.
  Aplicar guarda la mezcla; no inventa rendimiento, salud ni avance biológico.
- La etapa y el día son controles de vista previa, no cronología de NASA.
  La escena anima los dos frames de la etapa seleccionada.
- El pack tiene frames normales para cinco plantas e hidropónicos para trigo;
  se usan las piezas existentes, sin pedir archivos que no están en el pack.

## Diseño visual
Paneles pixel art con el marco 9-slice del pack. Azul oscuro #10162a,
acero #687ba7, texto hielo #edf2ff; rojo #ff6069, azul #4caaff,
verde #69e94d y blanco #edf5ff distinguen los canales.
Press Start 2P para encabezados cortos; monospace para cifras/explicaciones.
Se prioriza la composición de la referencia, no un dashboard genérico.

## Enfoque y plan
Se elige HTML/CSS y Canvas para la cámara: controles accesibles y reutilizables
en la futura integración. Se descarta modificar el juego ahora, por petición
expresa, y usar la captura de referencia como fondo, porque sus cifras fijas
confundirían los datos reales de cada selección.

1. Definir datos y modelo independiente, sin mutar assets.
2. Montar interfaz y componer cada escenario con sus sprites.
3. Probar datos, seis escenarios, decimales, ajustes, aplicar, teclado/móvil,
   carga de todos los PNG y ausencia de modificaciones fuera de esta carpeta.
