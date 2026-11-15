# Etapa 6 — Energía y HUD

## Objetivo
Portar `EnergySystem.js` a Godot y conectar HUD de traje (oxígeno/batería) y energía de base.

## Tareas
1. **Autoload `EnergySystem.gd`**
   - Traducir la clase `SistemaEnergia` del JS a GDScript: constantes, `CONFIG`, `ESTACIONES_POR_DEFECTO`, métodos `update`, `set_solar_factor`, `generacion_solar_kw`, `porcentaje_base`, `porcentaje_traje`, `update_suit`, etc.
   - Mantener misma escala temporal (1 día juego = 300 s reales) o documentar cambio.
   - API similar: `EnergySystem.update(delta)`, `EnergySystem.set_solar_factor(f)`, leer propiedades para UI.

2. **Estado global `GameState.gd` (autoload)**
   - Variables: escena actual, `solar_panels_active_count`, flags de misiones/tutorial (futuro), referencia a `oxygen` del traje si se separa de EnergySystem.
   - Métodos para cambiar escena de forma centralizada (`goto_scene(path, spawn_id)`).

3. **HUD traje**
   - Escena `scenes/ui/SuitHUD.tscn` (CanvasLayer): muestra oxígeno y batería. Batería viene de `EnergySystem.porcentaje_traje` (o equivalente). Oxígeno puede venir de `GameState`/JSON demo inicialmente.
   - Toggle con acción `toggle_suit_hud` (T).
   - Opcional: usar sprites de nivel `oxigeno_nivel_XX_t`, `bateria_nivel_XX_t` importados como `Texture2D` y cambiar frame/textura según porcentaje (0..10).

4. **HUD energía de base (opcional esta etapa)**
   - Texto o barra simple mostrando `% base` y `generación kW` (útil para debug/Level 0).

5. **Integración con paneles solares**
   - En exterior, al “activar” un panel (tras minijuego o acción), llamar `GameState`/`EnergySystem.set_solar_factor(activos/3)`.

## Criterios de aceptación
- [ ] `EnergySystem` actualiza en `_process`/`_physics_process` con delta correcto.
- [ ] HUD muestra batería del traje sincronizada con EnergySystem; oxígeno demo actualizable.
- [ ] Activar paneles cambia generación/factor solar visible en HUD o en logs.

## Referencia JS
- `src/systems/EnergySystem.js`, `src/ui/ResourceHUD.js`, uso en `Game.js`.