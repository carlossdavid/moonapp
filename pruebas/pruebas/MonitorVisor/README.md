# Visor de clima espacial — prueba aislada

Desde `moonapp`, iniciar `python -m http.server 8765` y abrir
http://localhost:8765/pruebas/MonitorVisor/ . Pulsa **Shift** para abrir o
cerrar el visor; también hay un botón «Abrir visor» para ratón y móvil.
**Escape** lo cierra. El botón «Monitor simulado» abre el monitor original
de `clima-espacial`: ambos paneles están disponibles **en la misma página**.
En móvil, desliza horizontalmente el visor para ver todos los paneles.

La imagen de fondo es `Imagenes/Visor.png` (no se alteró). Sobre sus tres
gráficas se muestran:

1. **Actividad solar:** índice solar simulado.
2. **Partículas:** proxy terrestre simulado; **no** es sensor del traje.
3. **Campo terrestre:** geomagnetismo terrestre; **no** es dosis lunar.

Las tres curvas emplean las **mismas muestras** que la gráfica combinada del
monitor y siguen actualizándose mientras el visor está cerrado. Comparten
también las alertas: se guardan en el recuadro «ALERTAS» y, cuando llega una,
VEGA muestra brevemente la evaluación y la acción de ese evento. Sin alerta,
el espacio de VEGA está vacío. Las alertas del monitor se pueden ensayar con
«Probar alerta»; quedan identificadas como **PRUEBA**. Los recuadros de
**oxígeno, batería y agua permanecen vacíos** para enlazarlos luego al HUD.
La tecla **T** y los recursos del juego no se modificaron.

`clima-espacial/app.js` mantiene la **única instancia** del simulador y emite
sus lecturas al visor mediante eventos DOM; `MonitorVisor/visor.js` no crea
un segundo reloj ni tira eventos. `clima-espacial/index.html` también monta
este visor para que ambos menús estén juntos allí. Al abrir cada URL por
separado comienza una sesión independiente; usa `?seed=42` en ambas si
necesitas comparar reproducciones. **Dos pestañas no comparten sesión**.

Las dos páginas usan `MonitorVisor/game.js` para arrancar **el mismo juego**
con sus fondos, sprites y escenas originales. `assets/manifest.json` todavía
contiene un conflicto de fusión sin resolver. Este arranque de prueba recupera
temporalmente **ambas listas de sprites** para que se vea el juego completo,
sin modificar el manifiesto ni el `src/main.js` principal. Cuando se resuelva
el conflicto, el mismo arranque leerá el JSON normal. Un fallo de carga muestra
un error en vez de ocultar la pantalla negra detrás de «Listo».

La referencia archivada de DONKI de enero de 2026 alimenta las probabilidades
del simulador, como en la prueba anterior. Curvas y alertas de la misión son
**simuladas**, no telemetría en vivo de NASA ni mediciones de exposición
personal. El sensor exterior ficticio de la prueba tampoco es el sensor del
traje del guion cinematográfico.

Pruebas: `node --test pruebas/clima-espacial/simulator.test.mjs`; con el
servidor local y Chrome instalados,
`node pruebas/MonitorVisor/visor.browser.test.mjs` verifica Shift, curvas,
alertas, VEGA, menú con fondo, escena con astronauta y disposición móvil en
**ambas** páginas.
