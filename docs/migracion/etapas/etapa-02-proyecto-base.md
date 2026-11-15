# Etapa 2 — Proyecto base en Godot

## Objetivo
Tener un proyecto Godot ejecutable con ventana/viewport pixel art, input map y flujo mínimo: menú → (video opcional) → escena de juego.

## Tareas
1. **Crear proyecto**
   - Godot 4.x, renderer `Forward+` o `Compatibility` según target (web puede requerir Compatibility).
   - Nombre sugerido: `EntropiaCero`.

2. **Display / viewport**
   - `Project Settings > Display > Window`: Width 320, Height 180, Mode `Windowed` (desarrollo), luego export.
   - `Stretch`: Mode `canvas_items`, Aspect `keep` (o `keep_width` según prefieras barras).
   - `TextureFilter`: por defecto en import usar `Nearest` para sprites pixel art.

3. **Input Map** (Project Settings > Input Map)
   - `move_left` (A, Left), `move_right` (D, Right), `move_up` (W, Up), `move_down` (S, Down)
   - `interact` (E)
   - `toggle_suit_hud` (T)
   - `toggle_map` (M)
   - `debug` (F1)
   - `cancel` (Escape) — opcional

4. **Estructura de carpetas** (crear en el proyecto)
   - `scenes/main/Main.tscn`, `scenes/main/MainMenu.tscn`
   - `scenes/levels/InteriorBase.tscn`, `scenes/levels/ExteriorLunar.tscn`
   - `scenes/ui/*.tscn`
   - `scripts/autoload/`, `scripts/player/`
   - `assets/` (copiar desde repo actual)

5. **Escena Main**
   - `Main.tscn` (Node) como escena principal: carga menú o niveles según estado.
   - Autoload `GameState.gd` (ver Etapa 6) registrado en Project Settings.

6. **Menú mínimo**
   - `MainMenu.tscn`: `Control` + fondo (TextureRect) + botones (`Button` o `TextureButton`).
   - Señal `pressed` → cambiar a escena interior (Nivel 0) o reproducir video antes.

7. **Video intro (opcional en esta etapa)**
   - Usar `VideoStreamPlayer` con un `.ogv`/convertido desde `intro.mp4` (Godot soporta OGV/Theora; puede requerir conversión). Alternativa: saltar video en primera versión.

## Criterios de aceptación
- [ ] Proyecto abre sin errores.
- [ ] Ventana escala correctamente en pixel art (sin blur no deseado).
- [ ] Se puede navegar del menú a una escena vacía de prueba con transición simple (`change_scene_to_file`).

## Notas
- Copiar `assets/fonts/PressStart2P-Regular.ttf` e importarlo como fuente en Godot.