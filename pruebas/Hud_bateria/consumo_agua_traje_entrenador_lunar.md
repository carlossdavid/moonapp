# Consumo de agua potable del traje · Entrenador Lunar

## 1. Datos de partida

La barra **Agua para beber** del visor indica el volumen que queda en la bolsa del traje mientras el astronauta explora fuera de la estación lunar.

| Parámetro | Valor | Justificación |
|---|---:|---|
| Capacidad de la bolsa | **950 mL** | NASA documenta una bolsa de este volumen utilizada durante caminatas espaciales. Los trajes lunares de Apollo 15, 16 y 17 usaron un dispensador de 32 onzas líquidas estadounidenses, aproximadamente 946 mL [1, 2]. |
| Agua disponible según NASA | **240 mL por hora de EVA** | Es la cantidad mínima que el sistema debe poner a disposición del astronauta. En una salida real, el astronauta bebe cuando lo necesita [1]. |
| Consumo simulado | **170 mL por hora de misión** | Valor elegido para la mecánica del juego. Modela el promedio de los sorbos con una disminución uniforme. La tasa de 170 mL/h es una decisión de simulación y queda por debajo de la cantidad que NASA exige poner a disposición para una EVA real. |

La simulación empieza al salir de la estación y termina al regresar al punto en el que el jugador puede reponer el agua. El volumen inicial es el que ya tiene el traje. Vale 950 mL cuando la bolsa está llena. Durante la salida el consumo se aplica aunque el astronauta se detenga, puesto que el modelo depende del tiempo transcurrido.

## 2. Ecuaciones del consumo

Define `t` como el tiempo transcurrido desde la salida, medido en horas de misión, y `V_inicial` como el volumen al salir, medido en mL.

```text
Tasa de consumo = 170 mL/h = 2,8333… mL/min

Consumo previsto [mL] = 170 × t [h]
Consumo efectivo [mL] = mínimo(V_inicial, consumo previsto)
Agua restante [mL] = V_inicial − consumo efectivo
Nivel del visor [%] = 100 × agua restante / 950

Autonomía de agua restante [h] = agua restante / 170
```

Con el depósito lleno, **cada 30 minutos de misión se descuentan 85 mL**. El **1 % del depósito equivale a 9,5 mL** y se consume en **aproximadamente 3 min 21 s**. La bolsa llena dura **5 h 35 min** aproximadamente. A las 8 h, el modelo necesitaría **1.360 mL** en total, por lo que faltarían **410 mL** si toda la misión se hiciera con una sola bolsa de 950 mL.

| Tiempo fuera | Agua consumida | Agua restante | Indicador |
|---:|---:|---:|---:|
| Inicio | 0 mL | 950 mL | 100 % |
| 30 min | 85 mL | 865 mL | 91,1 % |
| 1 h | 170 mL | 780 mL | 82,1 % |
| 2 h | 340 mL | 610 mL | 64,2 % |
| 3 h | 510 mL | 440 mL | 46,3 % |
| 4 h | 680 mL | 270 mL | 28,4 % |
| 5 h | 850 mL | 100 mL | 10,5 % |
| ≈5 h 35 min | 950 mL | 0 mL | 0 % |

**Ejemplo de misión.** Caminar 45 min hasta el objetivo, recoger muestras durante 30 min y volver en 45 min suma **2 h**. Al regresar quedan **610 mL**, o **64,2 %**. El costo de la recolección es de 85 mL porque la tarea añade 30 min a la salida.

## 3. Avisos durante la misión

Los siguientes umbrales son parámetros del juego.

- **«Te queda poca agua»** cuando la barra baja al **25 %**. Quedan **237,5 mL** y aparece a las **4 h 11 min** aproximadamente si el astronauta salió con el depósito lleno.
- **«Regresa a la estación»** cuando el agua restante llega al volumen necesario para volver más el margen elegido. Este aviso depende de la ruta y puede aparecer antes o después del aviso fijo.

```text
Agua necesaria para volver [mL] = (170 / 60) × (minutos de regreso + minutos de margen)

Activar aviso de regreso si agua restante ≤ agua necesaria para volver.
```

Por ejemplo, si regresar toma **60 min** y el margen es de **30 min**, avisa cuando queden **255 mL**. Con el depósito lleno al salir, el aviso aparece aproximadamente a las **4 h 05 min** si esa estimación de regreso se mantiene. Si al llegar a la estación el jugador rellena la bolsa, se añaden los mL que faltan hasta 950. Si se modela un tanque de la estación, limita el relleno al agua disponible y descuenta de él lo transferido al traje.

## 4. Implementación en el reloj del juego

```text
Cada vez que avance el reloj de misión con el astronauta fuera:
    minutos_de_misión = segundos_de_misión_transcurridos / 60
    agua_mL = máximo(0, agua_mL − (170 / 60) × minutos_de_misión)
    porcentaje_agua = 100 × agua_mL / 950
    actualizar el visor y evaluar los avisos
```

Mantén los decimales en el cálculo y redondea solo al mostrar el porcentaje. Si el tiempo está acelerado, aplica el factor del reloj una sola vez. Por ejemplo, con **1 minuto real = 30 minutos de misión**, se descuentan **85 mL por minuto real** mientras dura la salida. Si el reloj de misión se pausa, el volumen queda en su último valor.

## Fuentes

1. NASA, *Spacesuits*, §11.2.3.2, requisito **V2 11030**. Documenta la disponibilidad mínima por hora de EVA y el uso de una bolsa de 950 mL. [NASA](https://www.nasa.gov/reference/11-0-spacesuits-vol-2/).
2. *In-suit food and fluid dispensers*, documentación de Apollo. Describe los dispensadores usados durante Apollo 14–17, incluidos los de 32 onzas líquidas de Apollo 15–17. [NASA Technical Reports Server, documento 19740024444](https://ntrs.nasa.gov/citations/19740024444). El cambio de capacidad también consta en el [*Apollo 15 Mission Report*, §A-3.1](https://www.nasa.gov/wp-content/uploads/static/history/alsj/a15/a15mrp9.pdf).
