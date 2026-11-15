# Integración final — alcance aprobado

## Objetivo
Una entrada `final/index.html` que carga el juego completo y las actividades
ya probadas. No sustituye el index principal ni modifica src/, assets/ o pruebas/.
La carpeta depende de esos recursos compartidos y debe servirse desde moonapp.

## Distribución
- Exterior: EstaciónLunar arriba; verde y amarilla a la derecha, con puertas
  independientes y retorno a la puerta usada. Cuatro paneles a la izquierda.
- Principal: BaseLunarGrandeInterior. Verde/amarilla: fondos de ModosDeEstacion,
  inicialmente Claro, cambiados por el modo calibrado de esa estación.
- Módulos en las mismas zonas relativas: oxígeno arriba/izquierda, energía
  a la derecha, consola central y almacenamiento abajo. Alimentos no se abre.

## Componentes
- Un Game, un sistema de energía/batería, uno de agua y uno de oxígeno.
- HUD de Hud_bateria: cuatro barras originales, sin drenaje ficticio T/R.
- Limpieza: PanelCleaningTask, BeamCleaning y SolarProgress originales; estado
  conservado por panel, búsqueda/consumo de imanes y dos paneles para entrar.
- Recarga: RecargaOxigenoPruebaScene original, con cierre y desmontaje.
  Completar habilita la recarga del sistema de oxígeno, sin inventar kg gratis.
- Electrólisis y modos: actividades originales embebidas, no juegos completos
  dentro de otros juegos. Validar origen y ventana de mensajes.
- Consola: sprite y simulador de clima-espacial, referencia DONKI enero 2026,
  curvas simuladas, sin cambiar tasas ni reloj. Adaptador weather.js local:
  evita el intervalo negativo intermitente del primer rAF del arranque original.
- Visor: adaptación local con los mismos eventos del único simulador.
- Menú/introducción y controles del motor se mantienen.

## Alternativas
Se eligió composición con subclases y adaptadores locales para reutilizar lógica
probada. Se descarta editar código compartido o duplicar juegos completos: el
primero altera originales y el segundo duplica recursos y relojes.

## Tiempo y límites
HUD y limpieza conservan 300 segundos por día; el sorteo DONKI conserva su
jornada de 600 segundos. Son escalas distintas ya existentes, no se convierten
una en otra. Las tareas de limpieza pausan recursos y movimiento como la prueba.
Los resultados educativos de electrólisis no se convierten a kg ni Wh físicos.
El módulo de producción de alimentos queda fuera, aunque el HUD conserva hambre.

## Plan de trabajo
1. Montar fragmentos DOM de las pruebas sin ejecutar sus arranques.
2. Crear Game local con HUD y gestión única de escenas, modales y recursos.
3. Distribuir estructuras y conectar puertas, tareas y fondos por estación.
4. Consumir eventos DONKI desde un visor local, con cierre y foco.
5. Probar menú, tres estaciones, fondos/modos, tareas, estados persistentes,
   consumos únicos, apertura/cierre y aislamiento de archivos originales.
