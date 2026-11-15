# Etapa 1 — Inventario y mapeo (JS → Godot)

## 1. Inventario del proyecto actual (referencia)
- **Entry:** `index.html`, `src/main.js` (arranca en `InteriorBaseScene`, luego flujo).
- **Core:** `Game.js`, `GameLoop` (timestep fijo), `Input.js`, `Time.js`, `Renderer` (Canvas), `AssetLoader`.
- **Escenas:** `src/scenes/InteriorBaseScene.js`, `src/scenes/DemoScene.js` (exterior), base clase `Scene.js`.
- **Entidades:** `Player`, `Obstacle`, `InteractableZone`, etc. en `src/entities/`.
- **Física:** `PhysicsWorld`, `BoxCollider`, `SpatialGrid` (AABB, capas/máscaras).
- **UI:** `ResourceHUD.js`, `ComingSoonModal.js`, `Minimap.js`, video intro HTML + overlay minijuego (iframe) en `index.html`.
- **Sistemas:** `src/systems/EnergySystem.js` (lógica pura en JS), `assets/hud/suit_status.json` (demo).
- **Assets:** `assets/manifest.json`, sprites en `assets/Sprites/...`, fuentes, video `assets/video/intro.mp4`, minijuego `pruebas/limpieza-panel/` (web).

## 2. Mapeo sugerido a Godot

| Concepto actual | Equivalente Godot |
|-----------------|-------------------|
| Canvas 320×180 escalado | Project Settings: `display/window/size/viewport_width=320`, `viewport_height=180`, `stretch/mode="canvas_items"`, `stretch/aspect="keep"` (o `expand`) |
| Game loop fijo + render | `_physics_process(delta)` para física/lógica fija (o usar `Engine.physics_ticks_per_second=60`), `_process` para UI/anim visual si hace falta |
| Input (Input.js, teclas) | `InputMap`: `move_left/right/up/down`, `interact` (E), `hud_suit` (T), `map` (M), `debug` (F1) |
| Escenas JS | `PackedScene` (.tscn): `MainMenu.tscn`, `InteriorBase.tscn`, `ExteriorLunar.tscn` |
| Player | `CharacterBody2D` + `CollisionShape2D` (huella/feet) + `AnimatedSprite2D` o `Sprite2D` + `AnimationPlayer` |
| Colisiones AABB/capas | `CollisionLayer` / `CollisionMask`, `StaticBody2D` para muros/módulos, `Area2D` para triggers/interactuables |
| Interactuables (E + prompt) | `Area2D` con señal `body_entered`/`body_exited`, variable `can_interact`, UI prompt en `CanvasLayer` |
| Tilemap suelo | `TileMapLayer` (Godot 4) o `TileMap` |
| Cámara | `Camera2D` con límites (`limit_*`) y seguimiento suave (lerp en `_process`) |
| AssetLoader/manifest | Importar recursos en editor; cargar con `preload()` o `load()`; opcional JSON con `FileAccess` |
| EnergySystem.js | `autoload/EnergySystem.gd` (puerto directo de la lógica: variables, `update(delta_game)`, métodos) |
| HUD traje / minimapa | `CanvasLayer` + `Control` (o `TextureRect` para barras/sprites de nivel) |
| Video intro | `VideoStreamPlayer` en escena overlay o `Control` a pantalla completa |
| Minijuego limpieza | Escena `LimpiezaPanel.tscn` (reimplementar en Godot) o embebido web solo en export HTML (no nativo) — **recomendado reimplementar** |
| Coming Soon modal | `Control` modal en `CanvasLayer` (Panel + Label + Button) |

## 3. Entregables de esta etapa
- [ ] Lista confirmada de assets a importar (carpetas `assets/Sprites`, `assets/video`, fuentes).
- [ ] Decisión: GDScript vs C# (recomendado GDScript para velocidad).
- [ ] Decisión: cómo manejar el minijuego (reimplementar en Godot vs mantener versión web solo para HTML export — normalmente reimplementar).

## 4. Riesgos / notas
- El timestep fijo del JS (`FIXED_DT`) en Godot se puede aproximar con `physics_ticks_per_second=60` y lógica en `_physics_process`.
- El minijuego `limpieza-panel` actual es web (JS/canvas). En Godot desktop/mobile hay que reimplementarlo; en export web se podría usar un `HTTPRequest`/overlay distinto, pero lo más limpio es reimplementar.
