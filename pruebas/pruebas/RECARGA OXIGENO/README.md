# Prueba aislada: recarga de oxígeno

El motor existente es JavaScript ES modules + Canvas 2D (`Game`, `Renderer`, `Scene`). Esta página arranca **una única instancia** de `Game` y una escena local de prueba, sin editar `moonapp/index.html`, `src/main.js` ni la lógica compartida de `src/minigames/RecargaOxigeno.js`.

Los PNG originales se cargan directamente desde `sprites_recarga_oxigeno/`: el manifiesto compartido `assets/manifest.json` contiene actualmente marcadores de conflicto de fusión y no es JSON válido. No se modifica para esta prueba; sin esta carga local se veía un dibujo genérico en vez de los sprites entregados.

## Ejecutar

Desde `moonapp`:

```bash
python -m http.server 8765
```

Abrir <http://localhost:8765/pruebas/RECARGA%20OXIGENO/>.

Para verificar lógica y render sin navegador:

```bash
node --test "pruebas/RECARGA OXIGENO/recarga.test.mjs"
node --test "pruebas/RECARGA OXIGENO/pruebaVisual.test.mjs"
```

## Flujo

1. **Conectando:** arrastra el extremo libre de cada manguera al puerto de su color. La boca opuesta permanece unida al cilindro. La conexión correcta se imanta y brilla; una equivocada muestra fuga temporal y devuelve la manguera suavemente. La otra línea mantiene su estado.
2. **Autorizado:** ambas líneas figuran «Conectado»; aparece un panel con check. Se cierra al tocarlo o tras 1,5 segundos.
3. **Válvulas:** gira las dos ruedas rojas en sentido horario arrastrando alrededor de sus centros. Cada una necesita dos vueltas por defecto. El avance de cada una aporta 50 % a la barra de la mochila.
4. **Completado:** aparece el mensaje final y se dispara `onComplete(minigame)` **una vez**. Se puede reiniciar con el botón del panel. En la prueba, la mochila queda lista visualmente, sin cambiar aún el oxígeno del personaje de P1.

En móvil hay instrucciones de mayor tamaño y controles táctiles alternativos debajo del Canvas: conectar cada línea y dar las dos vueltas a cada válvula, además de poder arrastrar y girar directamente en la imagen. Los controles respetan las mismas fases; no se puede girar antes de conectar.

Las constantes de tolerancia, vueltas y tiempos están al inicio de `src/minigames/RecargaOxigeno.js` (`RECARGA_CONFIG`). El layout se expresa como porcentajes de la escena lógica 320×180, equivalente a la referencia 1600×900; el renderer la escala uniformemente a la ventana.

Los puertos se muestran ahora con **11 píxeles de ancho visual**, manteniendo la proporción de cada PNG para que encajen con los conectores de las mangueras nuevas. La hitbox circular y su tolerancia siguen siendo mayores: es más fácil acertar con el dedo sin agrandar el dibujo.

Se usan los PNG nuevos `tanque_o2_con_manguera.png` y `tanque_co2_con_manguera.png`, junto con los sprites originales de mochila, puertos, manijas y `icono_autorizado.png`. El azul ocupa «Reserva O2» a la izquierda; el verde, «Salida CO2» a la derecha. La tapa central queda lisa: no se dibuja el logo. Todos los textos de esta prueba, tanto en Canvas como en los controles móviles, usan la misma fuente `Press Start 2P` que la actividad de paneles. Los mensajes cambian según la fase y no desbordan los recuadros.

En la prueba la manguera móvil se dibuja como una curva de color gruesa con anillos, porque la versión anterior quedaba casi invisible al mostrar los PNG reales. **El extremo metálico se recorta del PNG original del tanque** y sigue al puntero; el cilindro y el acople fijo mantienen sus imágenes sin modificar ningún archivo. La conexión correcta se imanta al puerto.

El fondo, los paneles, el icono de ratón (no existe como PNG) y el indicador de información se dibujan con Canvas. La fuga usa `fuga_gas.png` ya existente (con partículas de color como alternativa si faltara); **no se creó ningún sprite nuevo**.

La prueba no altera el oxígeno del personaje. Para integrar el resultado en P1, conectar `onComplete` desde la escena que inicie el minijuego.
