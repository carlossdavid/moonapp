# Motor gráfico y de física 2D (top-down 3/4) — Vanilla JS + Canvas 2D

Prototipo jugable construido desde cero con **JavaScript moderno (ES2022, ES modules)** y **Canvas 2D**, sin librerías/frameworks de juego. Incluye loop con timestep fijo, render con interpolación, cámara, tilemap, y-sort por profundidad, animaciones por spritesheet y física AABB con resolución por ejes.

## Cómo ejecutar

Los ES modules no funcionan por `file://`, así que usa un servidor estático local desde la raíz del repositorio:

```bash
python3 -m http.server 8080
```

Luego abre [http://localhost:8080/](http://localhost:8080/).

**Controles**
- `WASD` o flechas: mover en 8 direcciones (diagonal normalizada).
- `F1`: activar/desactivar modo debug.

## Características

- **Resolución lógica fija (320×180)** escalada a pantalla completa del navegador con **escalado entero** y `devicePixelRatio`, `imageSmoothingEnabled = false` (pixel art nítido, sin deformación al redimensionar).
- **Game loop**: física a 60 Hz con acumulador de timestep fijo + render con interpolación (`alpha`) entre estados para movimiento fluido.
- **Movimiento**: aceleración y fricción (sensación suave), velocidad máxima, diagonal normalizada.
- **Perspectiva top-down 3/4**: y-sort por la coordenada Y de la base/pies (lo que está más abajo se dibuja encima); en empate se desempata por `id`.
- **Cámara**: seguimiento suave (lerp estable por `dt`), limitada a los bordes del mundo, redondeo a píxel entero al dibujar.
- **TileMap**: capa de suelo desde matriz, culling por cámara (solo tiles visibles).
- **Física/colisiones**: huella (footprint) `BoxCollider` en la base de las entidades (no el sprite completo), resolución por ejes separados (X luego Y) para deslizarse por paredes, broad-phase con `SpatialGrid`, narrow-phase en `CollisionDetector`, bordes del mundo sólidos, anti-tunneling por subdivisión de paso, triggers con `onEnter/onStay/onExit`, capas y máscaras por bitmask.
- **Sprites/animaciones**: spritesheet, animaciones (idle/walk por dirección), pivote en los pies `(0.5, 1)`. El jugador usa los sprites del astronauta en `assets/Sprites/Astronauta/` (compuestos en runtime) con fallback a placeholders generados por código.
- **Debug (F1)**: colliders/huellas, grilla espacial, FPS, posición del jugador y número de objetos dibujados.

## Arquitectura

```
index.html
assets/
  manifest.json            # manifiesto de imágenes cargadas por AssetLoader
  Sprites/                 # arte (p.ej. astronauta)
src/
  config.js                # constantes y capas/máscaras (sin números mágicos)
  main.js                  # bootstrap: crea Game, escena y arranca
  core/      Game, GameLoop (fixed timestep + interpolación), Input, Time
  math/      Vector2, Rect
  graphics/  Renderer, AssetLoader, SpriteSheet, Animation, Sprite, Camera, TileMap, RenderQueue
  physics/   Collider, BoxCollider, CircleCollider, PhysicsBody,
             PhysicsWorld, CollisionDetector, CollisionResolver, SpatialGrid
  entities/  Entity, Player, Obstacle
  scenes/    Scene, DemoScene
```

### Flujo principal
1. `main.js` crea `Game`, asigna `DemoScene` y llama `game.init()` (carga manifest/assets y `scene.init()`).
2. `GameLoop` acumula tiempo y ejecuta `update(FIXED_DT)` a 60 Hz; luego `render(alpha)`.
3. En cada tick fijo (`Scene.update`): las entidades controladoras ajustan `body.velocity` (p.ej. input del jugador) → `PhysicsWorld.step(dt)` guarda `prevPosition`, mueve y resuelve colisiones por ejes (X, Y) con anti-tunneling → se actualizan triggers/cámara.
4. `render(alpha)` interpola `prevPosition -> position` por entidad: dibuja tilemap de suelo (culling), encola entidades en `RenderQueue` (y-sort por `getSortY()` y luego `id`) y dibuja UI/debug.

La lógica de física no depende del renderer (opera sobre `PhysicsBody`/colliders y puede probarse por separado).

## Cómo añadir...

### Una nueva entidad
1. Crea una clase en `src/entities/` que extienda `Entity` (`src/entities/Entity.js`).
2. Constructor: llama a `super({ x, y, sprite, body })`. Si tiene física, crea y asigna un `PhysicsBody` con su `Collider` (ver abajo) y pásalo como `body`.
3. Implementa `update(dt, game)` para la lógica/control (ajusta `body.velocity` o estado); llama a `super.update(dt, game)` para animar el sprite. Para entidades estáticas no es necesario moverlas.
4. Para render personalizado (p.ej. prop sin `Sprite` animado) sobreescribe `render(renderer, alpha)` usando la interpolación `prevX/prevY -> x/y` y el pivote en pies. Ajusta `getSortY()` si la base de ordenado no coincide con `y`.
5. Instánciala y añádela en la escena: `this.addEntity(ent)` (la escena la registra en el `PhysicsWorld` si tiene `body`). Para triggers, implementa `onTriggerEnter/Stay/Exit(otherBody, otherEntity)`.

### Un nuevo sprite / animación
1. **Con imagen:** añádela a `assets/manifest.json` (`{ "key": "...", "src": "./assets/..." }`) y se cargará con `AssetLoader`. También puedes registrarla en runtime con `assets.set(key, imageOrCanvas)`.
2. Crea un `SpriteSheet(image, frameWidth, frameHeight, { columns })`.
3. Crea un `Sprite(spriteSheet)` con `originX/originY` (p.ej. `0.5, 1` para pies) y registra animaciones: `sprite.addAnimation(name, new Animation({ name, frames:[...], fps, loop }))`, luego `sprite.play(name)`.
4. Asígnalo a la entidad (`sprite` en el constructor o `entity.sprite = ...`). `Entity.render` lo dibuja interpolado con flip y pivote; para casos especiales puedes dibujar manualmente como en `Obstacle`.
5. Si no hay arte, puedes generar un spritesheet en un `<canvas>` offscreen (ver `createAstronautSheet`/placeholders en `DemoScene.js`).

### Un nuevo collider
1. Usa o crea un collider en `src/physics/` (extiende `Collider`). Para cajas usa `BoxCollider` con la **huella/base** (no el sprite completo):
   ```js
   new BoxCollider({
     width, height,
     offsetX: -width / 2, // centrado en los pies (x = posición de la entidad)
     offsetY: -height,    // caja apoyada sobre y de la base
     layer: Layer.SOLID,  // o Layer.PLAYER / Layer.TRIGGER
     mask: Layer.PLAYER,  // con qué capas interactúa (bitmask)
     isTrigger: false,    // true = no bloquea, dispara callbacks
   })
   ```
2. Asígnalo a un `PhysicsBody({ position?, collider, isStatic })` y vincúlalo a la entidad (`body` en el constructor). Los dinámicos se mueven por `body.velocity`; los estáticos (`isStatic: true`) no.
3. Capas/máscaras: define/combina bits en `src/config.js` (`Layer`, `layerMatches`). Dos cuerpos interactúan si sus máscaras aceptan la capa del otro.
4. Para un nuevo tipo de forma, implementa la geometría en el collider y el soporte correspondiente en `CollisionDetector`/`CollisionResolver` y `SpatialGrid._boundsForBody`.

## Notas
- La escena de demostración (`DemoScene`) genera un mapa ~40×30 con suelo, árboles/rocas, una pared con abertura y una zona trigger que muestra un mensaje al entrar.
- El tamaño visual del astronauta se compone escalado en runtime; la colisión del jugador sigue siendo su huella de pies (`PLAYER_FOOT_*` en `config.js`).
