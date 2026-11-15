# moonapp

Videojuego 2D interactivo educativo (NASA Space Apps Challenge 2026) — prototipo con motor y física 2D top-down 3/4 en **JavaScript (ES2022, ES modules) + Canvas 2D**, sin librerías/frameworks de juego. Incluye loop con timestep fijo, render con interpolación, cámara, tilemap, y-sort, animaciones y colisiones AABB por huella.

## Cómo ejecutar

Los ES modules no funcionan por `file://`, así que usa un servidor estático local desde la raíz del repositorio:

```bash
python3 -m http.server 8080
```

Luego abre [http://localhost:8080/](http://localhost:8080/).

**Controles**
- `WASD` o flechas: mover en 8 direcciones (diagonal normalizada).
- `E`: interactuar (entrar/inspeccionar cuando haya prompt).
- `F1`: activar/desactivar modo debug.

## Características

- **Resolución lógica fija (320×180)** escalada con escalado entero y `devicePixelRatio`, `imageSmoothingEnabled = false` (pixel art nítido).
- **Game loop**: física a 60 Hz con acumulador de timestep fijo + render con interpolación (`alpha`).
- **Movimiento**: aceleración, fricción, velocidad máxima, diagonal normalizada.
- **Perspectiva top-down 3/4**: y-sort por la base/pies (desempate por `id`).
- **Cámara**: seguimiento suave, limitada al mundo, redondeo a píxel entero.
- **TileMap**: capa de suelo desde matriz con culling por cámara.
- **Física/colisiones**: huella `BoxCollider` en la base, resolución por ejes (X/Y) para deslizarse por paredes, broad-phase con `SpatialGrid`, bordes del mundo sólidos, anti-tunneling, triggers (`onEnter/onStay/onExit`) y capas/máscaras por bitmask.
- **Sprites/animaciones**: spritesheet con animaciones y pivote en los pies `(0.5, 1)`.
- **Debug (F1)**: colliders/huellas, grilla espacial, FPS, posición del jugador y objetos dibujados.

## Arquitectura

```
index.html
assets/
  manifest.json            # manifiesto de imágenes cargadas por AssetLoader
  Sprites/                 # arte (astronauta, estructuras, fondos, etc.)
src/
  config.js                # constantes y capas/máscaras
  main.js                  # bootstrap: crea Game, escena y arranca
  core/      Game, GameLoop, Input, Time
  math/      Vector2, Rect
  graphics/  Renderer, AssetLoader, SpriteSheet, Animation, Sprite, Camera, TileMap, RenderQueue
  physics/   Collider, BoxCollider, CircleCollider, PhysicsBody,
             PhysicsWorld, CollisionDetector, CollisionResolver, SpatialGrid
  entities/  Entity, Player, Obstacle, Structure, InteractableZone
  scenes/    Scene, DemoScene (exterior), InteriorBaseScene
```

### Flujo principal
1. `main.js` crea `Game`, asigna la escena inicial y llama `game.init()` (carga manifest/assets y `scene.init()`).
2. `GameLoop` ejecuta `update(FIXED_DT)` a 60 Hz y luego `render(alpha)`.
3. En cada tick fijo (`Scene.update`): las entidades ajustan `body.velocity` → `PhysicsWorld.step(dt)` mueve y resuelve colisiones por ejes → se actualizan triggers/cámara.
4. `render(alpha)` interpola posiciones, dibuja fondo/suelo y efectos en el piso, encola entidades en `RenderQueue` (y-sort) y dibuja UI/debug.

## Cómo añadir...

### Una nueva entidad
1. Crea una clase en `src/entities/` que extienda `Entity`.
2. Llama a `super({ x, y, sprite, body })` y, si tiene física, asigna un `PhysicsBody` con `Collider`.
3. Implementa `update(dt, game)` (ajusta `body.velocity`/estado) y `render` si necesitas dibujo personalizado.
4. Añádela con `this.addEntity(ent)`; para triggers implementa `onTriggerEnter/Stay/Exit`.

### Un nuevo sprite / animación
1. Añade la imagen a `assets/manifest.json` o regístrala con `assets.set(key, image)`.
2. Crea `SpriteSheet` + `Sprite`, registra animaciones y asígnalo a la entidad.

### Un nuevo collider
1. Usa `BoxCollider` con huella/base (no el sprite completo), `layer/mask` e `isTrigger` según corresponda.
2. Asígnalo a un `PhysicsBody` y vincúlalo a la entidad.

## Probar alertas DONKI localmente

Desde esta carpeta inicia `python -m http.server 8765`. No abras HTML mediante
`file://`: los módulos JavaScript y los JSON necesitan un servidor HTTP.
El `index.html` principal muestra **solo el juego base**, sin paneles de prueba.
Para probar el simulador y visor, abre
http://localhost:8765/pruebas/MonitorVisor/ . El panel experimental
`src/events/liveEventPanel.js` conserva el código de consulta DONKI, pero ya
no se monta en el index principal.

`src/events/donkiLive.js` consulta la API pública de CCMC para FLR, CME, SEP y
GST sin clave. `src/events/liveEventPanel.js` actualiza el panel cada cinco
minutos cuando la pestaña está visible; la primera consulta establece una
referencia y **no** anuncia eventos antiguos como nuevos. Un ID que aparezca
en consultas posteriores emite `lunar:donki-alert` en `document` con
`event.detail = { event, archived }`. La prueba archivada emite el mismo evento
con `archived: true` y no corresponde a un fenómeno actual.

Si DONKI no responde, el panel muestra datos **ARCHIVADOS** de
`src/events/eventos-donki.json` y `assets/donki/{SEP,GST}.json`. Si la API
responde 429, las consultas se suspenden temporalmente. Los avisos son sobre
publicaciones de DONKI, **no** mediciones de dosis ni pronósticos en la Luna;
GST describe el campo magnético terrestre.

El prototipo `DemoScene.js` todavía no incluye turnos ni recursos: ninguna
alerta cambia automáticamente la misión. Cuando se integre ese estado,
escuchar `lunar:donki-alert` permitirá mostrar la información en la escena
sin confundirla con el generador probabilístico archivado de entrenamiento.
