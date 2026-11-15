# Etapa 4 — Escena interior (base lunar)

## Objetivo
Sala rectangular jugable con colisiones, módulos interactivos y ventana “COMING SOON”, equivalente a `InteriorBaseScene.js`.

## Tareas
1. **Escena `InteriorBase.tscn`**
   - Nodo raíz (Node2D o Node).
   - Fondo: `Sprite2D` con `estructura_interna.png` (o dibujado) ajustado al tamaño del mundo.
   - `TileMapLayer` opcional si usan tiles; si no, solo colisiones manuales.
   - `Camera2D` con límites al tamaño de la sala/hallway.
   - Contenedor de colisiones: `StaticBody2D` con varios `CollisionShape2D` rectangulares (muros, obstáculos) — reemplaza `_spawnInteriorCollisions` del JS.
   - `Marker2D` para spawn del jugador y para salida (pasillo).

2. **Módulos interactivos (5)**
   - Para cada módulo: `StaticBody2D` (colisión sólida del mueble) + `Area2D` (trigger de interacción) con script que exponga `prompt_text` y señal `interact_requested`.
   - Visual: `Sprite2D` con imágenes `mod_oxigeno`, `mod_energia`, etc. (o `compass_ui` para consola según estado actual).
   - Posiciones/tamaños: trasladar valores de `_spawnInteriorModules` (coordenadas en mundo). Documentar en un comentario o en `data/interior_modules.json` opcional.

3. **Interacción**
   - En `Player` o en un sistema global: detectar `Area2D` en rango y mostrar prompt en `CanvasLayer` (Label). Al presionar `interact`, emitir acción.
   - Abrir modal “COMING SOON”: escena `scenes/ui/ComingSoonModal.tscn` (Panel + textos + botón Cerrar). Instanciar o mostrar/ocultar; pausar input de movimiento mientras está abierto (`set_process_input` o flag).

4. **Salida al exterior**
   - `Area2D` en la puerta/salida con prompt “Presiona E para salir”. Al interactuar: `get_tree().change_scene_to_file("res://scenes/levels/ExteriorLunar.tscn")` pasando datos de spawn (grupo `GameState` o parámetro).

5. **HUD y minimapa**
   - Instanciar `HUD.tscn` (CanvasLayer) con `ResourceHUD` y toggle `T`. Minimap como `SubViewport` + `TextureRect` o dibujo simple (Etapa 7).

## Criterios de aceptación
- [ ] Sala rectangular con colisiones correctas; no se atraviesan muros.
- [ ] 5 módulos: prompt al acercarse, `E` abre modal COMING SOON, cerrar vuelve al juego.
- [ ] Salida lleva a escena exterior en spawn definido.

## Referencia JS
- `src/scenes/InteriorBaseScene.js` (colisiones, módulos, modal).