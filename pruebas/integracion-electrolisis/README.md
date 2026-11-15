# INTEGRACIÓN · CONTROL DE ENERGÍA → OPERACIÓN ELECTRÓLISIS

Copia de prueba del juego original que conecta la imagen del **CENTRO DE
ENERGÍA** de la base lunar con el minijuego
[`../operacion-electrolisis/`](../operacion-electrolisis/).

No se modifica nada fuera de `pruebas/`: el `index.html`, los módulos de `src/`
y los PNG de `assets/Sprites/electrolisis/` quedan intactos.

## Cómo ejecutarlo

Desde la carpeta `moonapp`:

```bash
python -m http.server 8765
```

Abre:

```text
http://localhost:8765/pruebas/integracion-electrolisis/
```

## Recorrido

1. Se carga una **copia del `index.html` original** con el menú, el video de
   introducción y el panel DONKI del juego.
2. **INICIAR JUEGO** reproduce la introducción; se puede ver o saltar.
3. En el interior, la estación **CONTROL DE ENERGÍA** muestra un contorno cian
   pulsante.
4. La actividad se abre de dos formas:
   - pulsando `E` dentro de cualquiera de las cuatro zonas originales;
   - haciendo clic o tocando directamente la imagen de la estación.
5. Aparece la explicación (O₂ rojo, H₂ azul, cañón rojo → O₂, cañón azul → H₂).
6. **INICIAR PRUEBA** carga el minijuego embebido, que arranca solo en modo
   `?embed=1`.
7. Al terminar, **VOLVER A LA ESTACIÓN** cierra la actividad, reanuda la base y
   muestra un aviso con energía, precisión y agua perdida simuladas.
8. `Escape` o **← VOLVER** cierran la actividad en cualquier momento.

## Arquitectura

```text
integracion-electrolisis/
├── index.html     copia del index.html original + capa de actividad
├── app.js         arranque adaptado: Game + EnergyStationScene + EnergyActivity
├── style.css      capa modal, panel metálico y aviso de retorno
├── verify.mjs     verificación automática con Chrome DevTools Protocol
└── README.md
```

`index.html` usa `<base href="../../">`, de modo que los recursos y módulos se
resuelven contra la raíz de `moonapp` sin duplicar `src/` ni `assets/`.

`app.js`:

- importa `Game`, `DemoScene` e `InteriorBaseScene` originales;
- define `EnergyStationScene`, subclase que reemplaza únicamente la acción de la
  estación y conserva la salida original al exterior;
- convierte píxeles del canvas a coordenadas lógicas (320 × 180) y luego a mundo
  para detectar el clic sobre la imagen;
- define `EnergyActivity`, que gestiona explicación, iframe y `postMessage`;
- expone `window.electrolisisIntegration` solo para depuración y pruebas.

La ruta original se mantiene: la salida del interior cambia a `DemoScene` con
`spawnX: 292`, `spawnY: 210`.

## Mensaje del minijuego

El iframe envía al terminar o al pedir volver:

```js
{ type: 'electrolisis:close', summary: { energyWh, precision, waterPct, ... } }
```

La página anfitriona valida el origen, descarga el iframe para detener audio y
bucle, reanuda la escena y muestra el resumen.

## Verificación automática

Con el servidor local en marcha y Google Chrome instalado:

```bash
node pruebas/integracion-electrolisis/verify.mjs
```

Variables opcionales: `ELECTRO_CHROME`, `ELECTRO_BASE`, `ELECTRO_PORT`.

El script comprueba, sin errores de consola:

1. menú y panel DONKI cargados;
2. clic en **INICIAR JUEGO** → estado `video`;
3. salto de introducción → estado `playing`;
4. aviso al entrar en la zona de energía;
5. apertura por clic sobre la imagen y por `E`;
6. explicación antes de cargar el iframe;
7. arranque embebido y botones de vuelta;
8. colores medidos: O₂ `rgb(250, 53, 18)`, H₂ `rgb(36, 137, 208)`;
9. acierto, fin de ronda, informe y aviso de retorno;
10. cancelación y vista móvil de 390 × 844 sin desbordamiento horizontal.

## Comprobaciones manuales sugeridas

1. Clic sobre la imagen de energía desde lejos: debe abrir la explicación.
2. `E` dentro de una zona: debe abrir la misma explicación.
3. `Escape` con el minijuego en marcha: debe volver a la base sin resumen.
4. Terminar una ronda y comprobar que el aviso muestra las tres cifras.
5. Repetir en ventana estrecha o móvil.

> La energía y el agua perdida son indicadores educativos simulados; no
> representan un electrolizador real ni una medición física.
