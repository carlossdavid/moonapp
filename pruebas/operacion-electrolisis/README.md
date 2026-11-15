# OPERACIÓN ELECTRÓLISIS

Minijuego de puntería de 25 segundos para el proyecto de la estación lunar.
Se ejecuta entero dentro de esta carpeta y **lee los PNG originales de
`assets/Sprites/electrolisis/` sin copiarlos ni modificarlos**.

## Cómo ejecutarlo

### Opción recomendada (servidor local)

Desde la carpeta `moonapp`:

```bash
python -m http.server 8765
```

Abre en el navegador:

```text
http://localhost:8765/pruebas/operacion-electrolisis/
```

### Opción directa

También funciona abriendo `index.html` con doble clic (`file://`): el juego
usa scripts clásicos, no módulos ES, y las rutas de los sprites son relativas.

## Controles

| Acción | Ratón | Táctil | Teclado |
| --- | --- | --- | --- |
| Apuntar | mover el puntero sobre la cámara | arrastrar el dedo | ← → |
| Disparar | clic en la cámara o botón DISPARAR | toque en la cámara o botón DISPARAR | ESPACIO / ENTER |
| Silenciar | botón SONIDO | botón SONIDO | M |

El cañón está fijo en la base de la cámara y gira hacia el puntero dentro de un
límite de ±1.02 rad. El proyectil sigue la dirección del cañón, no una línea
recta al puntero.

## Reglas

- El cañón alterna entre **rojo** y **azul** automáticamente cada 4 segundos.
- **Cañón rojo** → solo destruye átomos **O₂ rojo**.
- **Cañón azul** → solo destruye átomos **H₂ azul**.
- Colores químicos coherentes en todo el juego: O₂ rojo, H₂ azul. Los PNG
  originales son naranja (O₂) y rojo (H₂); se tiñen en memoria al cargar.
- Acierto: el átomo desaparece y suma un acierto.
- Disparar a un átomo del tipo equivocado: suma un fallo (el átomo no se destruye).
- Disparar al vacío: suma un fallo.
- Al terminar el tiempo queda un margen de 0.8 s para que aterricen los
  disparos en vuelo; los que no lleguen cuentan como fallo.

## Puntuación

La lógica vive en `js/scoring.js` y no depende del DOM, por lo que se puede
probar con Node.

```text
precisión (%)   = aciertos / disparos × 100
energía (Wh)    = aciertos × 12 × (0.5 + 0.5 × precisión/100)
agua perdida    = 6 + fallos × 2.6 + (100 − precisión) × 0.22   (0–100 %)
fallos          = disparos errados + disparos sin objetivo
```

La energía y el agua son **indicadores educativos simulados**: no provienen de
un electrolizador real ni de una medición física.

La pantalla final muestra aciertos, fallos, precisión, energía, agua perdida,
rango, estrellas y el récord local de energía (guardado en `localStorage` con
protección para modo privado). Incluye un desplegable con las fórmulas y un
botón para repetir la operación.

## Recursos utilizados

Todos salen de `moonapp/assets/Sprites/electrolisis/`:

| Archivo | Uso |
| --- | --- |
| `01_atomos_O2_naranja.png` | átomos O₂ (4 recortes) y vista previa del HUD |
| `02_atomos_H2_rojo.png` | átomos H₂ (4 recortes) y vista previa del HUD |
| `03_canon_rojo.png` | cañón activo en la cámara |
| `04_canon_azul.png` | cañón activo en la cámara |
| `05_proyectiles_y_impactos.png` | proyectiles, impactos y fogonazo de boca |
| `06_fondo_arena_reactor.png` | fondo de la cámara de reacción |
| `07_animacion_canon_rojo.png` | pantalla inferior del cañón rojo (5 fotogramas) |
| `08_animacion_canon_azul.png` | pantalla inferior del cañón azul (5 fotogramas) |

La hoja de proyectiles es azul; los disparos del cañón rojo se tiñen en memoria
con un canvas auxiliar (`hue-rotate` + capa `hard-light`), sin escribir ningún
archivo nuevo ni tocar el PNG original. El mismo procedimiento convierte el
naranja original del O₂ en rojo y el rojo original del H₂ en azul.

Promedios medidos sobre los sprites teñidos (canal alfa > 90): O₂
`rgb(250, 53, 18)` y H₂ `rgb(36, 137, 208)`. La comprobación automática
`colores químicos: O₂ rojo y H₂ azul` verifica que el canal dominante sea el
rojo en O₂ y el azul en H₂.

Los recortes exactos de cada hoja están en `js/config.js` (`FRAMES`) y se
validaron contra el tamaño real de los PNG. El test comprueba que ningún
recorte se sale de su hoja.

## Estructura

```text
operacion-electrolisis/
├── index.html          estructura, HUD, pantallas de inicio y final
├── css/
│   └── estilos.css     paneles metálicos, LED, diseños adaptables
├── js/
│   ├── config.js       balance, rutas y recortes de sprites
│   ├── scoring.js      fórmulas puras (también se carga en Node)
│   ├── assets.js       precarga de los 8 PNG
│   ├── audio.js        efectos sintetizados con WebAudio
│   ├── game.js         estado, aparición de átomos, disparos, colisiones
│   ├── render.js       dibujo en Canvas 2D, tintado y partículas
│   └── main.js         arranque, entrada, HUD y bucle principal
├── scoring.test.cjs    pruebas de lógica y de recursos
└── README.md
```

## Pruebas

Desde `moonapp`:

```bash
node pruebas/operacion-electrolisis/scoring.test.cjs
```

Cubre precisión, energía, agua, resumen, rangos, estrellas, el mapeo
cañón→átomo, los colores químicos (O₂ rojo, H₂ azul), los límites de los
recortes y la existencia de los ocho PNG.

Verificación manual recomendada:

1. Pulsa **INICIAR OPERACIÓN**.
2. Comprueba que el cañón cambia de color a los 4 s y que el aviso superior lo indica.
3. Acierta un átomo del color correcto y falla otro a propósito. El O₂ debe
   verse rojo y el H₂ azul, igual que el cañón que los destruye.
4. Deja terminar los 25 s y revisa el informe.
5. Pulsa **REPETIR OPERACIÓN**.
6. Repite en ventana estrecha o en móvil: la cámara se reordena y el botón de
   disparo sigue visible.

## Modo integración (`?embed=1`)

El minijuego puede abrirse dentro de un iframe:

```text
http://localhost:8765/pruebas/operacion-electrolisis/index.html?embed=1
```

En ese modo arranca solo, oculta la pantalla de inicio, muestra **← VOLVER** en
la cabecera y **VOLVER A LA ESTACIÓN** en el informe final. Al pulsar cualquiera
de los dos (o `Escape`) envía a la página anfitriona:

```js
{ type: 'electrolisis:close', summary: { energyWh, precision, waterPct, ... } }
```

La página anfitriona decide qué hacer con el informe y descarga el iframe para
detener el bucle y el audio.

## Integración con CONTROL DE ENERGÍA

La prueba de integración vive en
[`../integracion-electrolisis/`](../integracion-electrolisis/) y no modifica
`src/` ni el `index.html` original. Es una **copia del `index.html` original**
con `<base href="../../">` y un arranque adaptado (`app.js`) que importa los
módulos de `src/` sin editarlos. Hereda `InteriorBaseScene`, reemplaza solo la
acción de la estación **CONTROL DE ENERGÍA** y abre este minijuego tras una
pantalla de explicación.

Para probarla, desde `moonapp`:

```bash
python -m http.server 8765
```

Abre <http://localhost:8765/pruebas/integracion-electrolisis/>. Se mantiene el
menú, el video de introducción y el panel DONKI del juego original:

1. **INICIAR JUEGO** y ver o saltar la introducción.
2. Caminar hasta **CONTROL DE ENERGÍA** y pulsar `E` en cualquiera de sus
   cuatro zonas, o hacer clic/tocar directamente la imagen de la estación
   (tiene un contorno cian pulsante que lo indica).
3. Leer la explicación y pulsar **INICIAR PRUEBA**.

Al volver, la base se reanuda y se muestra un resumen de la ronda.

Comprobaciones de la integración:

1. El aviso de la estación aparece solo al entrar en una de sus cuatro zonas.
2. La imagen de la estación abre la actividad con clic o toque, sin necesidad
   de estar exactamente sobre una zona.
3. `E` abre primero la explicación; el minijuego no se carga hasta pulsar
   **INICIAR PRUEBA**.
4. El minijuego arranca solo dentro del iframe y muestra **← VOLVER**.
5. Al terminar, **VOLVER A LA ESTACIÓN** cierra la actividad y muestra el
   informe en un aviso; la base vuelve a responder a los controles.
6. `Escape` cierra la actividad en cualquier momento y descarga el iframe.

## Notas técnicas

- Canvas lógico de 880 × 600 escalado por CSS, con soporte de `devicePixelRatio`.
- Sin dependencias externas: HTML, CSS, Canvas 2D y WebAudio.
- El audio se desbloquea en el primer gesto del usuario.
- Respeta `prefers-reduced-motion`.
- No se modifica ningún archivo fuera de `pruebas/`.
