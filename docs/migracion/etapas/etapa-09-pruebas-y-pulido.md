# Etapa 9 — Pruebas, pulido y export

## Objetivo
Validar el flujo completo y preparar builds.

## Checklist funcional
- [ ] Menú → (video opcional) → Interior: spawn correcto.
- [ ] Interior: moverse, colisiones, 5 módulos abren COMING SOON, salida a exterior.
- [ ] Exterior: moverse, 3 paneles solares interactivos, entrada a base.
- [ ] HUD traje (T): muestra oxígeno/batería coherentes (EnergySystem + demo oxígeno).
- [ ] Minimap (M) muestra posición básica.
- [ ] Minijuego limpieza: abrir, completar, afecta generación solar.
- [ ] No hay errores en consola/output de Godot en el flujo principal.

## Pruebas técnicas
- Probar en resolución 320×180 escalada y en ventana redimensionada.
- Verificar `delta` y timestep (no depender de FPS para lógica crítica).
- Comprobar exports: Desktop (Linux/Windows) primero; Web si aplica (ajustar renderer y video).

## Documentación a actualizar
- `migracion/README.md`: estado de cada etapa (hecho / pendiente).
- Notas de diferencias respecto al JS (comportamientos intencionales).

## Entregables
- Proyecto Godot en carpeta separada (ej. `godot/` en el repo o repo nuevo) con escenas y scripts de las etapas completadas.
- Lista de bugs conocidos y próximos pasos (Nivel 0 tutoriales, agua/oxígeno de base, etc.).