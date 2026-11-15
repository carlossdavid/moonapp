# Etapa 5 — Escena exterior (superficie lunar)

## Objetivo
Mapa exterior con base, rocas, 3 paneles solares interactivos, acceso a base y transición al interior, equivalente a `DemoScene.js`.

## Tareas
1. **Escena `ExteriorLunar.tscn`**
   - Fondo `mapa_bg` (Sprite2D o TextureRect en capa de fondo).
   - `TileMapLayer` opcional si hay suelo tileado; en el JS actual hay tilemap procedural en parte — puede simplificarse a fondo estático primero.
   - `StaticBody2D` para estructuras sólidas (base, rocas, paneles) con `CollisionShape2D`.
   - `Area2D` para puerta/acceso a base: prompt “Presiona E para entrar a la base” → cambiar a `InteriorBase.tscn` con spawn en pasillo (coordenadas acordadas).
   - `Camera2D` con límites del mundo.

2. **Paneles solares (3)**
   - Cada uno: sprite + colisión sólida + `Area2D` trigger.
   - Interacción: al presionar `E` abrir minijuego de limpieza (Etapa 8) o, temporalmente, modal COMING SOON. Al “completar” (o marcar), incrementar contador en `GameState` y actualizar `EnergySystem.set_solar_factor(activos/3)`.

3. **Spawn y retorno**
   - Al entrar desde interior: usar `Marker2D` “spawn_from_interior” (ej. cerca de puerta exterior, coordenadas equivalentes a las del JS, p. ej. (292,210) en espacio de mundo del JS — convertir a unidades Godot según escala).
   - Al salir del interior: spawn definido en InteriorBase apunta a Exterior.

4. **Elementos visuales**
   - Huellas/rastro: opcional en primera versión (puede hacerse con `Line2D` o partículas simples después).

## Criterios de aceptación
- [ ] Se puede caminar por el exterior, colisiones correctas.
- [ ] 3 paneles solares con interacción; estado de “activos” persiste mientras la escena no se reinicie (o se guarda en `GameState`).
- [ ] Entrada/salida a base funciona en ambos sentidos.

## Referencia JS
- `src/scenes/DemoScene.js` (estructuras, solarPositions, `_enterBase`, spawns).