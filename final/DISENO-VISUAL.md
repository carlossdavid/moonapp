# Mejora visual y jugable — diseño aprobado

Se conserva el motor Canvas, los sprites originales y el index principal.
Solo final/ recibe esta actualización.

## Dirección
Se eligió reutilizar los mensajes de diseño_ia/Mensajes y construir un marco
azul pixelado adaptable para avisos dinámicos, siguiendo la referencia del usuario.
No se sustituye el arte existente por una familia nueva generada.

Los puestos del principal se alinean en la misma fila; las casas pequeñas
tienen un puesto central. Cada puesto tiene bancada y placa de identificación.
Una baldosa naranja debajo indica E · ENTRAR y coincide con la zona interactiva.
Las puertas de los tres edificios usan la misma señal. El naranja solo identifica
accesos; los avisos y ayudas son azul marino, plata y cian.

## Juego
- Recarga directa, sin selector: el minijuego O₂/retorno CO₂ recupera O₂, agua
  y batería al completarse. CO₂ no es una reserva consumible.
- Mensajes originales de VEGA asociados a hitos, sin repeticiones ni colas
  ilimitadas. No se muestran sobre módulos abiertos ni durante cinemáticas.
- Vida usa los once sprites vida_00..10 dentro del mismo HUD de recursos.
- Impactos en cuerpos sólidos: retroceso breve, partículas y sacudida pequeña.
  No causan daño; cooldown evita vibración continua al mantener una dirección.
  Se respeta movimiento reducido y hay opción para desactivar sacudidas.
- Fundidos suaves de entrada/salida; el mundo se pausa durante la transición.

## Plan
1. Adaptadores locales de HUD, accesos, impactos y mensajes.
2. Ordenar puestos y conectar la recarga única a los modelos de recursos.
3. Aplicar marco adaptable, ayudas y transiciones sin alterar fuentes externas.
4. Pruebas de estados, regresión de recursos y recorrido Chrome con capturas.
