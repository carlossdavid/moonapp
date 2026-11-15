# Consola DONKI — diseño aprobado

Solo esta carpeta de prueba cambia. Se reutiliza el juego completo mediante
una subclase local del interior; su consola abre con E el sprite subido.
No se modifica el principal, src/ ni MonitorVisor.

La interfaz superpone tres curvas y valores 0–100 en la cuadrícula y leyendas
del sprite, y cinco porcentajes en las filas históricas correspondientes.
La referencia es DONKI enero 2026, no telemetría en vivo ni exposición lunar.
Se conserva app.js como dueño del único simulador, reloj y sorteo diario.

Se descarta la página independiente: no cumple el flujo del juego solicitado.
Se descarta integrar en el visor: pertenece a otra prueba.

Plan: recuperar entrada del juego; conectar acción local de consola; ajustar
render al sprite sin alterar probabilidades; probar apertura, cierre,
movimiento, curvas, referencia y reloj de diez minutos en navegador.
