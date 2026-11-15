# Etapa 3 — Jugador y movimiento

## Objetivo
Recrear al astronauta con movimiento 8 direcciones, animaciones y colisión por “pies” (huella), equivalente a `Player.js` + físicas actuales.

## Tareas
1. **Escena Player**
   - `scenes/player/Player.tscn`: `CharacterBody2D` (root)
     - `CollisionShape2D` (forma pequeña en la base, ej. rectángulo ~ancho x alto de pies) — equivale a `PLAYER_FOOT_*`.
     - `AnimatedSprite2D` (o `Sprite2D` + `AnimationPlayer`). Asignar `SpriteFrames` con animaciones: `idle_down/up/left/right`, `walk_down/up/left/right` (o la convención que usen).
     - Opcional: `Marker2D` para punto de interacción.

2. **Script `scripts/player/player.gd`**
   - Leer input con `Input.get_vector("move_left","move_right","move_up","move_down")` (normalizado).
   - Aplicar aceleración/frenado y velocidad máxima (mover constantes desde `config.js` del JS a export vars o constantes).
   - `move_and_slide()`.
   - Seleccionar animación según dirección/velocidad (similar a `Player.js`).

3. **Ajustes de física**
   - `motion_mode` según prefieran (Floating vs Grounded) — para top-down usar Floating.
   - Capas: jugador en layer propia, colisiona con muros (layer de mundo).

4. **Integración en escenas**
   - Instanciar `Player.tscn` en `InteriorBase.tscn` y en `ExteriorLunar.tscn` con spawns definidos (marcadores `Marker2D`).

## Criterios de aceptación
- [ ] Movimiento fluido en 8 direcciones, diagonal normalizada.
- [ ] No atraviesa `StaticBody2D`/muros con colisión.
- [ ] Animaciones cambian según dirección y estado (idle/walk).

## Referencia del código actual
- `src/entities/Player.js`, `src/config.js` (velocidades, tamaño huella), `src/core/Input.js`.