# Prueba aislada: recarga de oxígeno

El motor existente es JavaScript ES modules + Canvas 2D (`Game`, `Renderer`, `Scene`). Esta página arranca **una única instancia** de `Game` y `RecargaOxigenoScene`, sin editar `moonapp/index.html` ni `src/main.js`.

## Ejecutar

Desde `moonapp`:

```bash
python -m http.server 8765
```

Abrir <http://localhost:8765/pruebas/RECARGA%20OXIGENO/>.

Para verificar lógica y render sin navegador:

```bash
node --test "pruebas/RECARGA OXIGENO/recarga.test.mjs"
```

## Flujo

1. **Conectando:** arrastra el extremo libre de cada manguera al puerto de su color. La boca opuesta permanece unida al cilindro. La conexión correcta se imanta y brilla; una equivocada muestra fuga temporal y devuelve la manguera suavemente. La otra línea mantiene su estado.
2. **Autorizado:** ambas líneas figuran «Conectado»; aparece un panel con check. Se cierra al tocarlo o tras 1,5 segundos.
3. **Válvulas:** gira las dos ruedas rojas en sentido horario arrastrando alrededor de sus centros. Cada una necesita dos vueltas por defecto. El avance de cada una aporta 50 % a la barra de la mochila.
4. **Completado:** aparece el mensaje final y se dispara `onComplete(minigame)` **una vez**. Se puede reiniciar con el botón del panel.

Las constantes de tolerancia, vueltas y tiempos están al inicio de `src/minigames/RecargaOxigeno.js` (`RECARGA_CONFIG`). El layout se expresa como porcentajes de la escena lógica 320×180, equivalente a la referencia 1600×900; el renderer la escala uniformemente a la ventana.

Los puertos se muestran ahora con **11 píxeles de ancho visual**, manteniendo la proporción de cada PNG para que encajen con los conectores de las mangueras nuevas. La hitbox circular y su tolerancia siguen siendo mayores: es más fácil acertar con el dedo sin agrandar el dibujo.

Se usan los PNG nuevos `tanque_o2_con_manguera.png` y `tanque_co2_con_manguera.png`, junto con los sprites originales de mochila, puertos, manijas y `icono_autorizado.png`. El azul ocupa «Reserva de O₂» a la izquierda; el verde, «Extracción de CO₂» a la derecha. Los títulos y «Arrastra para conectar» se ajustan al ancho de sus propios recuadros. La tapa central queda lisa: no se dibuja el logo. Tampoco hay etiquetas junto a las ruedas ni sobre los puertos; O₂/CO₂ permanecen en los paneles de tanque y estado para orientar al jugador. Los recuadros metálicos biselados y las letras toman como guía `EJEMPLO TIPOGRAFÍA.jpeg` (títulos pixelados, cuerpo sans-serif marcado).

Cada manguera se dibuja con franjas **diferentes** y consecutivas del propio PNG **tanque con manguera**, desplazadas sobre una curva de cable con oscilación suave. El tanque se dibuja con una máscara que conserva su silueta y el acople fijo, sin duplicar el cable estático del archivo. El extremo libre sigue el puntero y se imanta al puerto. No se repite una tira como resorte ni se estira toda la imagen como una pieza rígida.

El fondo, los paneles, el icono de ratón (no existe como PNG) y el indicador de información se dibujan con Canvas. La fuga usa `fuga_gas.png` ya existente (con partículas de color como alternativa si faltara); **no se creó ningún sprite nuevo**.

La prueba no altera el oxígeno del personaje. Para integrar el resultado en P1, conectar `onComplete` desde la escena que inicie el minijuego.
