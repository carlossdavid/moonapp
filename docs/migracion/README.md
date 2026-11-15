# Migración a Godot (ENTROPÍA CERO) — Plan por etapas

Este directorio contiene la planificación para migrar el prototipo actual (JS/Canvas) a **Godot** (recomendado: Godot 4.x, GDScript).

## Objetivo
Migrar progresivamente el juego manteniendo:
- Flujo: menú → video (intro) → interior de la base (Nivel 0) → salida a exterior → interacción con paneles solares y módulos interiores.
- Sistemas clave: energía (EnergySystem), HUD traje (oxígeno/batería), minimapa, transiciones de escena, interacciones con `E`, minijuego de limpieza de paneles (integrado o aparte).

## Supuestos (ajustables)
- **Motor:** Godot 4.3+ (o la versión estable que elijan). GDScript por rapidez; C# opcional después.
- **Resolución lógica:** equivalente a 320×180 escalado (como en el proyecto actual) usando `SubViewport` + `TextureRect` o `stretch mode` (`canvas_items`) + `viewport width/height` 320x180.
- **Entrada:** `Input Map` con acciones `move_up/down/left/right`, `interact` (E), `toggle_suit_hud` (T), `toggle_map` (M), `debug` (F1).
- **Assets:** copiar sprites/audio/video a `res://assets/…` manteniendo estructura lógica; usar `import` de Godot (texture filter nearest para pixel art).

## Estructura sugerida del proyecto Godot (destino)
```
res://
  project.godot
  scenes/
    main/        (Main.tscn, menú)
    levels/      (InteriorBase.tscn, ExteriorLunar.tscn)
    ui/          (HUD.tscn, Minimap.tscn, ComingSoon.tscn, VideoIntro.tscn)
    minigames/   (LimpiezaPanel.tscn)
  scripts/
    autoload/    (GameState.gd, EnergySystem.gd)
    player/      (Player.gd)
    systems/     (interactions, collisions helpers)
  assets/        (sprites, fonts, audio, video)
  data/          (JSON: suit_status, etc.)
```

## Etapas (índice)
Ver carpeta `etapas/`:
1. `etapa-01-inventario-y-mapeo.md` — Inventario del repo actual y mapeo a nodos Godot.
2. `etapa-02-proyecto-base.md` — Crear proyecto Godot, viewport, input map, escena Main/menú.
3. `etapa-03-jugador-y-movimiento.md` — Player (CharacterBody2D), colisiones, animaciones básicas.
4. `etapa-04-escena-interior.md` — Sala rectangular, colisiones, módulos interactivos, Coming Soon.
5. `etapa-05-escena-exterior.md` — Mapa exterior, paneles solares, transiciones, acceso a base.
6. `etapa-06-energia-y-hud.md` — Port de EnergySystem, HUD traje, integración con paneles.
7. `etapa-07-ui-extra.md` — Minimap, video intro, menús, overlay minijuego (o escena aparte).
8. `etapa-08-minijuego-limpieza.md` — Integrar minijuego de limpieza (iframe en web no aplica; versión Godot o escena).
9. `etapa-09-pruebas-y-pulido.md` — Checklist, bugs, rendimiento, export.

## Convenciones recomendadas
- Nombres de escenas/nodos en PascalCase, scripts en snake_case.gd.
- Señales para interacciones (`interacted`, `area_entered`) en lugar de polling donde sea limpio.
- Un `GameState` (autoload) para estado global (escena actual, flags de paneles solares, energía).
- Mantener JSON externos en `res://data/` cuando sea útil (o `user://` para guardado).
