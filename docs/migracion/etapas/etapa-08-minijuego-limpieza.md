# Etapa 8 — Minijuego de limpieza de paneles

## Objetivo
Integrar el minijuego de limpieza (actualmente web en `pruebas/limpieza-panel/`) dentro de Godot.

## Recomendación
**Reimplementar en Godot** (escena dedicada) en lugar de embeber HTML, para funcionamiento nativo (desktop/mobile) y consistencia.

## Tareas (reimplementación sugerida)
1. **Escena `scenes/minigames/LimpiezaPanel.tscn`**
   - `Control` a pantalla completa o modal sobre el juego.
   - Área de dibujo: `TextureRect`/`ColorRect` + sprites de panel, cables, generador (importar imágenes de `ImagenesLimpiezaPaneles` o recrear estilo).
   - UI: texto de progreso, botones (activar haz, reiniciar, salir), indicadores.

2. **Lógica**
   - Puerto de `beamCleaning.js` / `PanelCleaningTask.js` a GDScript: estados (conectar cables A/B, activar haz, limpiar zonas 24, progreso).
   - Entrada: mouse/touch para arrastrar cables o botones alternativos.
   - Al completar: señal `finished(progress)` → el llamador (ExteriorLunar) marca panel activo y actualiza `EnergySystem`.

3. **Integración**
   - Desde `ExteriorLunar`, al interactuar con un `Area2D` de panel solar: pausar juego, mostrar `LimpiezaPanel.tscn` (instanciada o cambiada de escena modal). Al cerrar/terminar, reanudar y aplicar efecto (solar activo +1).

4. **Alternativa (solo export web)**
   - Usar un overlay HTML externo (`JavaScriptBridge` o abrir URL) — no recomendado para la experiencia integrada.

## Criterios de aceptación
- [ ] Se puede abrir el minijuego desde un panel solar.
- [ ] Flujo básico jugable (al menos conectar y “limpiar” con feedback visual simple).
- [ ] Al completar, el panel queda marcado y afecta `EnergySystem.set_solar_factor`.

## Referencia
- `pruebas/limpieza-panel/` (lógica y assets).