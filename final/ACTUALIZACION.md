# Integración de misiones aprobada

Solo final/ y pruebas/Alimentos/ cambian. El index principal y los sprites se conservan.

- Principal: recarga de O₂/batería, DONKI y modos. Verde: alimentos.
  Amarilla: electrólisis. Las casas usan un interior pequeño diferente.
- Alimentos: pantalla fija con pestañas, salida y progreso en iframe conservado.
  Cada insignia entrega una ración de entrenamiento una sola vez (sin calorías físicas).
- Recargas transfieren desde las reservas reales; nunca rellenan solo el dibujo.
- Recursos vacíos dañan durante cinco segundos continuos; recuperar todos los
  recursos detiene el daño y restaura la vida de entrenamiento.
- Imanes: uno inicial y uno cada 60 s activos, máximo tres; persisten entre escenas.
- A los 180 s activos: aviso de limpieza, segunda cinemática y salida que habilita Shift.
- Se pausa la simulación en módulos, cinemáticas y transiciones. El daño se pausa
  también allí; no se pueden abrir módulos ajenos para alterar las reservas.

Plan de implementación: adaptar Alimentos y mensajes con origen/fuente validados;
redistribuir interiores; conectar recursos y supervivencia; programar eventos;
unificar tipografía, transiciones y salidas; verificar lógica y navegador.
