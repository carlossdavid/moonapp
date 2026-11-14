# Entrenador Lunar — propuesta de inicio

> **Documento narrativo de prueba.** Describe solamente la apertura de la
> partida, desde la primera imagen hasta que se habilita la primera jornada.
> **No fija cuántos días dura la campaña ni escribe sus acontecimientos.**
> No modifica escenas, recursos, diálogos ni archivos de P1.

## La promesa de la historia

**Premisa:** la persona que juega forma parte de la tripulación de una
estación **ficticia** situada en una elevación cercana al cráter Shackleton,
en el polo sur lunar. Ha llegado para mantener la base operativa, investigar
su entorno y dejarla preparada para quienes vendrán después. No controla
el Sol: controla **qué hace con información incompleta y recursos limitados**.

**Pregunta que abre la partida:** «Si hoy no puedes atenderlo todo, ¿qué
proteges primero?». La respuesta empieza con una tarea cotidiana, no con una
catástrofe obligatoria.

**Tono:** curiosidad y responsabilidad, no terror apocalíptico. La Luna es
hermosa y difícil; la tripulación es competente, pero no omnisciente. El
jugador debe sentir que sus decisiones tienen sentido, incluso cuando
decide esperar para conocer mejor una señal.

**Punto de vista propuesto:** personaje astronauta sin nombre ni género
impuestos. **VEGA** es la voz de apoyo de la estación; se propone como
interfaz de comunicaciones y procedimientos, no como una autoridad que
adivina el futuro ni como una persona con historia ya confirmada por P1.
Los textos pueden mostrarse sin doblaje.

## Antes de mostrar nada

- El lugar es una **base inventada**; los datos NASA son referencias de
  fenómenos y geografía, no pruebas de que exista esta estación.
- La coordenada de referencia de diseño es aproximadamente **89,45° S,
  222,69° E**, cerca de Shackleton. No presentarla como emplazamiento
  aprobado para una misión real. La iluminación polar varía: no prometer
  «Sol eterno». Una comunicación con la Tierra puede depender de un relevo;
  no prometer visibilidad directa permanente.
- Al inicio **no hay una tormenta programada**, ni un indicador de «dosis
  lunar» calculado a partir de FLR, CME, GOES o Kp. Si más adelante hay
  alertas, serán situaciones **simuladas** y podrán no suceder ese día.
- El jugador no debería perder por no conocer siglas antes de aprender
  dónde está la esclusa, cómo se lee una lectura y cómo pedir contexto.

## Apertura jugable: propuesta de 3–5 minutos, saltable

El tiempo es una meta de ritmo narrativo, **no duración obligatoria de una
jornada**. Los siguientes momentos ocurren antes del primer día jugable.

### 1. Exterior: un lugar concreto

**Imagen:** pantalla oscura; un clic leve dentro del casco y aparece el
terreno gris azulado. La luz solar llega rasante sobre una cresta. A lo
lejos, el interior del cráter permanece oscuro. Se distinguen la esclusa,
un conjunto de paneles y el camino hacia un punto de observación. No hace
falta una cinemática de aterrizaje ni un vehículo que todavía no existan en
el juego.

**Texto inicial en pantalla:**

> Sector Shackleton. Estación de entrenamiento lunar.  
> Enlace de comunicaciones disponible. Integridad del traje: estable.

**VEGA:**

> «Señal recibida. Estás junto a la estación. Antes de explorar, encontremos
> la esclusa y comprobemos cómo sigue la base».

**Primera acción:** mover al personaje y acercarse a la esclusa. Mostrar
controles de movimiento **solo al tomar el control**, con alternativa
visible para teclado y mando si llega a implementarse. Si el jugador se
aleja, VEGA señala el camino una vez, sin interrumpir ni teletransportar.

**Para qué sirve:** situar el cuerpo del jugador en el mapa y dejar que vea
los dos polos del juego: seguridad de la base y exploración.

### 2. Umbral: un problema ordinario

Al llegar a la esclusa, una lectura breve presenta los sistemas. Evitar
soltar cinco números sin contexto.

**VEGA:**

> «El soporte vital funciona. Los paneles podrían darnos más margen, pero
> revisar su conexión llevará tiempo. También tenemos una ruta de muestras
> sin explorar. No podremos hacerlo todo en la próxima jornada».

**Interacción opcional para aprender sin castigo:** elegir qué inspeccionar
primero, **paneles** o **esclusa**. Ambas inspecciones enseñan a usar el
monitor y convergen en la misma situación; **no consumen recursos ni
deciden todavía el primer día**. Si P1 prefiere un inicio más corto, una
sola interacción con la esclusa cumple la misma función.

**Respuesta si se miran los paneles:**

> «Reciben luz. Eso no nos dice cuánto podremos almacenar hasta revisar
> la instalación».

**Respuesta si se mira la esclusa:**

> «El acceso al refugio está libre. Tenerlo cerca no reemplaza preparar
> provisiones y procedimientos».

**Para qué sirve:** mostrar que las lecturas tienen contexto y que
«seguridad» no equivale a bloquear al jugador o a prometer protección total.

### 3. Monitor: señales que vienen de lugares distintos

En el interior —o en una pantalla junto a la esclusa, si el mapa todavía
no tiene interiores— se activa un monitor con **tres áreas separadas**:

1. **La estación:** energía, aire, alimento y estado del refugio, todos
   expresados como *recursos de juego* hasta que existan sistemas físicos
   fundamentados.
2. **Entorno solar:** observaciones recibidas de instrumentos lejanos,
   identificadas por **origen y unidad** cuando haya un valor real
   comparable. Una fuente en la Tierra no es un sensor de Shackleton.
3. **Aquí afuera:** «sensor exterior de la estación: simulación / sin
   lectura inicial». No mostrar mSv inventados.

**VEGA:**

> «Los observatorios pueden detectar una fulguración o partículas cerca
> de la Tierra. Nos ayudan a prepararnos; no miden por sí solos lo que
> recibe esta estación. Si llega una señal, miraremos de dónde viene
> antes de decidir».

El jugador puede abrir una ficha **«¿Qué mide cada cosa?»**. No convertir
el texto técnico en diálogo obligatorio:

| En la ficha | Mensaje corto |
| --- | --- |
| FLR | Fulguración solar. Su clase no mide una dosis lunar. |
| CME | Eyección solar. Importan también dirección y trayectoria; su velocidad se expresa en km/s. |
| SEP / GOES | Partículas cerca de la Tierra: posible aviso preventivo, no lectura de la base. Un flujo requiere un valor en pfu; `>10 MeV` por sí solo no lo proporciona. |
| Sensor lunar / de estación | Una lectura en órbita lunar sería más próxima; **solo el sensor ficticio local** puede activar un efecto local dentro de la simulación. |
| GST / Kp | Perturbación magnética **terrestre**; no daña automáticamente la base lunar. |

**Para qué sirve:** establecer la regla ética y jugable de la historia:
información, amenaza posible y consecuencia local son cosas distintas.
La pantalla **no anuncia un evento histórico como si estuviera ocurriendo
ahora**.

### 4. Antes de abrir la jornada: decisión pendiente

VEGA señala dos tareas aún sin resolver; el panel muestra sus nombres,
pero **no ejecuta todavía ninguna**:

- **Asegurar los paneles y el soporte de la base**: margen para sostener
  las jornadas siguientes.
- **Preparar la ruta de exploración**: ciencia y conocimiento del terreno,
  a cambio de tiempo y recursos.

**VEGA:**

> «La estación puede continuar. Lo que no puede es multiplicar nuestro
> tiempo. Elige con qué empezaremos cuando abras la jornada».

**Último botón del prólogo:** «Abrir primera jornada». Debe dejar claro
que la siguiente decisión **sí** tendrá consecuencias; no avanzar por
temporizador ni activar una alerta solar garantizada al pulsarlo.

**Cierre visual:** el jugador mira de la esclusa al borde iluminado de la
cresta. El monitor queda accesible. No hace falta un fundido largo: el
control debe volver enseguida.

## Lo que debería saber y sentir la persona jugadora al terminar

- **Sabe dónde está**: una estación ficticia cerca de Shackleton, no una
  base real de NASA.
- **Sabe qué puede hacer ahora**: comprobar la estación y explorar, aunque
  no pueda priorizar todo a la vez.
- **Confía en VEGA**, porque distingue entre lo que se sabe, lo que se
  sospecha y lo que todavía no se mide.
- **No espera una tormenta a una hora fija**: la tensión nace de
  prepararse sin tener una predicción infalible.
- **Conoce el límite del monitor**: GOES, SOHO y Kp no son dosímetros
  dentro de su refugio.

## Variaciones y protección de la experiencia

- **Inicio rápido:** permitir «Saltar introducción» desde el primer
  diálogo. Al saltar, mostrar un resumen de tres líneas («Dónde estás»,
  «Qué decides» y «Qué no mide el monitor») antes de abrir la jornada.
- **Exploración libre:** quien inspeccione paneles, esclusa o cráter en
  otro orden obtiene la misma información esencial, sin quedar bloqueado.
  El cráter puede verse desde el inicio sin necesitar un nivel terminado.
- **Accesibilidad:** subtítulos permanentes para VEGA; no transmitir
  información esencial solo por audio o color; opción de releer mensajes;
  evitar destellos como única forma de reconocer una alerta.
- **Si todavía no hay modelo 3D, interior o nuevas animaciones:** usar
  el mapa y personaje actuales con puntos interactivos y texto. La
  historia funciona sin una cinemática costosa.
- **Si una futura partida comienza durante actividad solar:** mostrar
  la observación con su origen y estado de evidencia; no cambiar el
  prólogo por un «impacto confirmado» sin sensor local.

## Continuidad: qué se deja deliberadamente para después

Esta propuesta **no decide el número de días**, cuánto dura un día de
juego, qué recursos exactos cambian al abrir la jornada, ni programa
FLR→CME→SEP para días específicos. El archivo
`tarjetas-misiones.json` contiene **seis turnos de entrenamiento
propuestos**: pueden inspirar los días, pero **seis turnos no se
convierten automáticamente en seis días**. La historia por jornadas
comenzará en un segundo documento, una vez acordada su escala.

Tampoco define muertes por radiación, una dosis en mSv, una «llegada
confirmada» desde GOES, ni un efecto lunar causado por Kp.

**Recomendación para el siguiente paso narrativo:** decidir qué duración
y estructura tendrá una jornada; después escribir la primera como
consecuencia del arranque, con variaciones para paneles o exploración
y sin obligar a que ocurra un evento solar.

## Referencias de diseño, no acontecimientos del prólogo

- [NASA: punto bien iluminado cerca de Shackleton](https://www.nasa.gov/exploration/multimedia/highlights/2010-14A.html).
- [NASA: protección frente a radiación durante misiones lunares](https://science.nasa.gov/science-research/heliophysics/how-nasa-will-protect-astronauts-from-space-radiation-at-the-moon/).
- [NOAA: qué significa 10 pfu para protones ≥10 MeV cerca de la Tierra](https://www.swpc.noaa.gov/phenomena/solar-radiation-storm).
- [Tarjetas de misión existentes](../../../tarjetas-misiones.json) y
  [guía DONKI del proyecto](../../Documentacion/GUIA-TARJETAS-DONKI.md):
  inspiración de personajes y tareas, **no calendario aprobado**.
