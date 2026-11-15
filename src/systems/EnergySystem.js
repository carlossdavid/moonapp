/**
 * @file Sistema de energía del Entrenador Lunar (base + traje) para el HUD.
 *
 * Módulo de lógica pura: no toca canvas, DOM ni el GameLoop. Se integra llamando
 * a `update(dt)` desde `Scene.update` y leyendo `getSnapshot()` desde `drawUI`.
 *
 * Escala del juego:
 *   1 día de juego (24 h) = 5 minutos reales = 300 s.
 *   Por tanto, 1 segundo real = 0,08 h de juego (4,8 min de juego).
 *
 * Todas las duraciones de tareas/estaciones se expresan en HORAS DE JUEGO,
 * igual que las tablas de `gestion_energia_entrenador_lunar.md`. La conversión
 * desde el `dt` real (segundos) la hace el módulo internamente.
 *
 * Ecuaciones implementadas (ver md, secciones 3 y 4):
 *   P_solar [kW]      = conjuntos × 10 × factor_solar
 *   balance [kW]      = P_solar − P_cargas_activas
 *   carga base        : E_base += mín(0,90 × P_carga × Δt, espacio libre)
 *   descarga base     : E_base −= P_entregada_por_batería × Δt
 *   tarea             : E_tarea = P_tarea × duración
 *   traje             : E_traje −= P_actividad × Δt
 *   recarga traje     : E_traje += 1000 × 0,90 × P_cargador × Δt
 *   tiempo de recarga : faltante_kWh / (0,90 × P_cargador)
 *
 * Pérdidas: la eficiencia de ida y vuelta (0,90) se aplica UNA sola vez al
 * cargar la batería de la base; al descargar se resta la energía útil entregada.
 * La reserva mostrada es siempre energía útil entregable.
 *
 * Uso rápido (copiar como `moonapp/src/systems/EnergySystem.js`):
 *
 *   import { SistemaEnergia } from '../systems/EnergySystem.js';
 *
 *   // En la escena:
 *   this.energia = new SistemaEnergia({ horaInicio: 6, factorSolar: 0 });
 *
 *   update(dt) {
 *     this.energia.update(dt);          // dt real en segundos
 *   }
 *
 *   drawUI(renderer) {
 *     const hud = this.energia.getSnapshot();
 *     renderer.drawText(
 *       `Base ${hud.base.porcentajeTexto} · ${hud.base.balanceTexto}`,
 *       8, 8,
 *     );
 *     if (hud.traje.alerta) {
 *       renderer.drawText(hud.traje.alerta.texto, 8, 20, '#ffcc00');
 *     }
 *   }
 *
 *   // Gastar / recargar:
 *   this.energia.spendEnergy(0.25, { motivo: 'ejercicio' });
 *   this.energia.rechargeEnergy(10); // 10 kWh de red -> 9 kWh útiles
 */

const EPS = 1e-9;

// ============================================================================
// 1. Escala temporal
// ============================================================================

/** Segundos reales que dura un día de juego. */
export const SEGUNDOS_REALES_POR_DIA = 300;

/** Horas de juego que contiene un día. */
export const HORAS_POR_DIA = 24;

/** Factor de conversión: horas de juego por cada segundo real. */
export const HORAS_JUEGO_POR_SEGUNDO = HORAS_POR_DIA / SEGUNDOS_REALES_POR_DIA; // 0.08

/** Factor de conversión: minutos de juego por cada segundo real. */
export const MINUTOS_JUEGO_POR_SEGUNDO = HORAS_JUEGO_POR_SEGUNDO * 60; // 4.8

/** Segundos reales que dura una hora de juego. */
export const SEGUNDOS_REALES_POR_HORA_JUEGO = 1 / HORAS_JUEGO_POR_SEGUNDO; // 12.5

/** Resumen de la escala, útil para mostrar en el HUD o depurar. */
export const ESCALA_TIEMPO = Object.freeze({
  segundosRealesPorDia: SEGUNDOS_REALES_POR_DIA,
  horasPorDia: HORAS_POR_DIA,
  horasJuegoPorSegundo: HORAS_JUEGO_POR_SEGUNDO,
  minutosJuegoPorSegundo: MINUTOS_JUEGO_POR_SEGUNDO,
  segundosRealesPorHoraJuego: SEGUNDOS_REALES_POR_HORA_JUEGO,
});

// ============================================================================
// 2. Parámetros del modelo (valores del md, listos para ajustar)
// ============================================================================

/**
 * Configuración por defecto. Todas las potencias están en kW y las energías
 * en kWh, salvo las del traje, que están en Wh como en la especificación.
 */
export const CONFIG_ENERGIA = Object.freeze({
  // --- Generación solar (md §3) ---
  conjuntosSolares: 3, // 3 conjuntos VSAT
  potenciaPorConjuntoKW: 10, // 10 kW nominales por conjunto
  factorSolar: 1, // 0 = sombra, 1 = potencia nominal

  // --- Batería de la base (md §3) ---
  capacidadBaseKWh: 300, // capacidad útil entregable
  energiaBaseInicialKWh: 300,
  reservaProtegidaKWh: 24, // 12 h a 2 kW
  eficienciaIdaVuelta: 0.9, // se aplica al cargar, una sola vez
  limiteCargaKW: 20, // configurable
  limiteDescargaKW: 40, // configurable

  // --- Cargas del hábitat (md §2) ---
  cargaFondoKW: 15.3483, // "otros servicios" del modo normal
  modoInicial: 'normal', // 'normal' | 'minimo'
  cargaMinimaKW: 2, // perfil completo de supervivencia

  // --- Traje (md §4) ---
  capacidadTrajeWh: 1155, // requisito Constellation
  energiaTrajeInicialWh: 1155,
  consumoTrajeW: 144.375, // 1155 Wh / 8 h
  potenciaRegresoW: 144.375, // consumo previsto para volver
  tiempoRegresoHoras: 1.5, // 90 min (ejemplo del md)
  reservaLlegadaEVAWh: 115.5, // reserva de llegada (10 %)
  potenciaCargadorKW: 0.5, // 0,5 kW por cargador
  eficienciaCargador: 0.9,

  // --- Umbrales de alerta del traje (md §4) ---
  umbralesTraje: Object.freeze({
    bajo: 0.25,
    critico: 0.15,
    emergencia: 0.1,
  }),
});

/**
 * Estaciones del md §2. Por defecto solo están encendidas las continuas:
 * fondo (15,3483 kW) + gestión (1 kW) + comunicaciones (2 kW) + oxígeno (1,4 kW)
 * = 19,7483 kW, coherente con el promedio de calibración de 20 kW.
 * Las tareas opcionales se activan desde la escena o el HUD.
 */
export const ESTACIONES_POR_DEFECTO = Object.freeze([
  Object.freeze({
    id: 'energia',
    nombre: 'Gestión de energía',
    potenciaKW: 1.0,
    horasReferencia: 24,
    activa: true,
    prioridad: 1,
    opcional: false,
  }),
  Object.freeze({
    id: 'comunicaciones',
    nombre: 'Sala de control y comunicaciones',
    potenciaKW: 2.0,
    horasReferencia: 24,
    activa: true,
    prioridad: 2,
    opcional: false,
  }),
  Object.freeze({
    id: 'oxigeno',
    nombre: 'Gestión de oxígeno',
    potenciaKW: 1.4,
    horasReferencia: 24,
    activa: true,
    prioridad: 3,
    opcional: false,
  }),
  Object.freeze({
    id: 'ejercicio',
    nombre: 'Ejercicio',
    potenciaKW: 0.5,
    horasReferencia: 4,
    activa: false,
    prioridad: 5,
    opcional: true,
  }),
  Object.freeze({
    id: 'alimentos',
    nombre: 'Preparación de alimentos',
    potenciaKW: 0.6,
    horasReferencia: 3,
    activa: false,
    prioridad: 4,
    opcional: true,
  }),
  Object.freeze({
    id: 'cultivos',
    nombre: 'Cultivos pequeños',
    potenciaKW: 0.14,
    horasReferencia: 16,
    activa: false,
    prioridad: 4,
    opcional: true,
  }),
]);

// ============================================================================
// 3. Utilidades numéricas y de formato (solo para mostrar; el estado no redondea)
// ============================================================================

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function numero(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Formatea horas de juego como "2 h 34 min".
 * @param {number|null|undefined} horas
 * @returns {string}
 */
export function formatearHoras(horas) {
  if (horas === null || horas === undefined || !Number.isFinite(horas)) return '—';
  if (horas <= 0) return '0 min';
  const totalMin = Math.round(horas * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

/**
 * Formatea una hora del día como "06:30".
 * @param {number} horas
 * @returns {string}
 */
export function formatearHoraDelDia(horas) {
  const normalizada = ((horas % 24) + 24) % 24;
  const totalMin = Math.floor(normalizada * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formatea un número con coma decimal: 73,5.
 * @param {number} value
 * @param {number} [decimales=1]
 * @returns {string}
 */
export function formatearNumero(value, decimales = 1) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(decimales).replace('.', ',');
}

/**
 * @param {number} value valor 0..100
 * @param {number} [decimales=1]
 * @returns {string}
 */
export function formatearPorcentaje(value, decimales = 1) {
  return `${formatearNumero(value, decimales)} %`;
}

/**
 * Crea un perfil solar por tramos horarios. Ejemplo:
 *   crearPerfilSolarPorTramos([
 *     { desde: 0, hasta: 6, factor: 0 },
 *     { desde: 6, hasta: 18, factor: 1 },
 *     { desde: 18, hasta: 24, factor: 0 },
 *   ])
 * Si la hora no cae en ningún tramo, el factor es 0 (sombra).
 * @param {Array<{ desde: number, hasta: number, factor: number }>} tramos
 * @returns {(horaDelDia: number) => number}
 */
export function crearPerfilSolarPorTramos(tramos) {
  const lista = Array.isArray(tramos) ? tramos.slice() : [];
  return (horaDelDia) => {
    const hora = ((horaDelDia % 24) + 24) % 24;
    for (const tramo of lista) {
      const desde = numero(tramo.desde, 0);
      const hasta = numero(tramo.hasta, 0);
      const dentro = desde <= hasta
        ? hora >= desde && hora < hasta
        : hora >= desde || hora < hasta;
      if (dentro) return clamp(numero(tramo.factor, 0), 0, 1);
    }
    return 0;
  };
}

// ============================================================================
// 4. Sistema de energía
// ============================================================================

/**
 * Estado y reglas de energía de la base y del traje.
 * Una instancia = una partida. `update(dt)` avanza la simulación.
 */
export class SistemaEnergia {
  /**
   * @param {Partial<typeof CONFIG_ENERGIA> & {
   *   estaciones?: Array<object>,
   *   umbralesTraje?: { bajo?: number, critico?: number, emergencia?: number },
   *   perfilSolar?: ((horaDelDia: number, sistema: SistemaEnergia) => number) | null,
   *   velocidadTiempo?: number,
   *   horaInicio?: number,
   *   factorSolar?: number,
   *   modo?: 'normal'|'minimo',
   * }} [opciones]
   */
  constructor(opciones = {}) {
    const {
      estaciones,
      umbralesTraje,
      perfilSolar = null,
      velocidadTiempo = 1,
      horaInicio = 6,
      factorSolar = 1,
      modo = 'normal',
      ...resto
    } = opciones;

    this.config = Object.freeze({
      ...CONFIG_ENERGIA,
      ...resto,
      umbralesTraje: Object.freeze({
        ...CONFIG_ENERGIA.umbralesTraje,
        ...(umbralesTraje ?? {}),
      }),
    });

    this.perfilSolar = typeof perfilSolar === 'function' ? perfilSolar : null;
    this.velocidadTiempo = Math.max(0, numero(velocidadTiempo, 1));
    this.horaInicio = ((numero(horaInicio, 6) % 24) + 24) % 24;
    this.factorSolar = clamp(numero(factorSolar, 1), 0, 1);
    this.modo = modo === 'minimo' ? 'minimo' : 'normal';

    const capacidadBase = Math.max(0, numero(this.config.capacidadBaseKWh, 300));
    this.energiaBaseKWh = clamp(
      numero(this.config.energiaBaseInicialKWh, capacidadBase),
      0,
      capacidadBase,
    );

    const capacidadTraje = Math.max(0, numero(this.config.capacidadTrajeWh, 1155));
    this.energiaTrajeWh = clamp(
      numero(this.config.energiaTrajeInicialWh, capacidadTraje),
      0,
      capacidadTraje,
    );

    this.consumoTrajeW = Math.max(0, numero(this.config.consumoTrajeW, 144.375));
    this.potenciaRegresoW = Math.max(0, numero(this.config.potenciaRegresoW, 144.375));
    this.tiempoRegresoHoras = Math.max(0, numero(this.config.tiempoRegresoHoras, 1.5));

    const estacionesBase = Array.isArray(estaciones) ? estaciones : ESTACIONES_POR_DEFECTO;
    this.estaciones = estacionesBase.map((e) => ({
      id: String(e.id),
      nombre: e.nombre ?? String(e.id),
      potenciaKW: Math.max(0, numero(e.potenciaKW, 0)),
      horasReferencia: Math.max(0, numero(e.horasReferencia, 0)),
      activa: Boolean(e.activa),
      prioridad: numero(e.prioridad, 99),
      opcional: Boolean(e.opcional),
      pausada: false,
    }));

    /** Horas de juego transcurridas desde el inicio de la partida. */
    this.tiempoHoras = 0;

    /** Energía solar que no se pudo almacenar (acumulada). */
    this.energiaDesperdiciadaKWh = 0;

    /** Energía demandada que no pudo atenderse (acumulada). */
    this.energiaNoAtendidaKWh = 0;

    /** Estaciones pausadas en el último paso por falta de suministro. */
    this.cargasPausadas = [];

    this._reporte = this._reporteVacio();

    this._paso(0); // deja un reporte inicial coherente para el HUD
  }

  // --------------------------------------------------------------------------
  // Consultas de tiempo y estado
  // --------------------------------------------------------------------------

  /** @returns {number} hora del día 0..24 */
  get horaDelDia() {
    return ((this.horaInicio + this.tiempoHoras) % 24 + 24) % 24;
  }

  /** @returns {number} día de juego, empieza en 1 */
  get diaJuego() {
    return Math.floor((this.horaInicio + this.tiempoHoras) / 24) + 1;
  }

  /** @returns {number} porcentaje 0..100 */
  get porcentajeBase() {
    const cap = this.config.capacidadBaseKWh;
    return cap > 0 ? (100 * this.energiaBaseKWh) / cap : 0;
  }

  /** @returns {number} porcentaje 0..100 */
  get porcentajeTraje() {
    const cap = this.config.capacidadTrajeWh;
    return cap > 0 ? (100 * this.energiaTrajeWh) / cap : 0;
  }

  /**
   * Factor solar efectivo (0..1). Si hay perfilSolar, manda el perfil.
   * @returns {number}
   */
  factorSolarActual() {
    if (this.perfilSolar) {
      return clamp(numero(this.perfilSolar(this.horaDelDia, this), 0), 0, 1);
    }
    return clamp(this.factorSolar, 0, 1);
  }

  /**
   * P_solar [kW] = conjuntos × potencia nominal × factor_solar.
   * @returns {number}
   */
  generacionSolarKW() {
    return this.config.conjuntosSolares
      * this.config.potenciaPorConjuntoKW
      * this.factorSolarActual();
  }

  /**
   * Carga instantánea solicitada por el perfil activo (normal o mínimo).
   * @returns {number} kW
   */
  cargaActivaKW() {
    return this._cargasDelPaso().reduce((total, c) => total + c.potenciaKW, 0);
  }

  /**
   * @returns {Array<{ id: string, nombre: string, potenciaKW: number, prioridad: number, esFondo: boolean }>}
   */
  _cargasDelPaso() {
    if (this.modo === 'minimo') {
      return [{
        id: 'supervivencia',
        nombre: 'Soporte vital mínimo',
        potenciaKW: Math.max(0, this.config.cargaMinimaKW),
        prioridad: 0,
        esFondo: true,
      }];
    }

    const cargas = [{
      id: 'fondo',
      nombre: 'Otros servicios del hábitat',
      potenciaKW: Math.max(0, this.config.cargaFondoKW),
      prioridad: 0,
      esFondo: true,
    }];

    for (const estacion of this.estaciones) {
      if (!estacion.activa) continue;
      cargas.push({
        id: estacion.id,
        nombre: estacion.nombre,
        potenciaKW: estacion.potenciaKW,
        prioridad: estacion.prioridad,
        esFondo: false,
      });
    }
    return cargas;
  }

  /** @returns {object} reporte vacío */
  _reporteVacio() {
    return {
      generacionKW: 0,
      demandaKW: 0,
      servidaKW: 0,
      cargaBateriaKW: 0,
      descargaBateriaKW: 0,
      excedenteKW: 0,
      noAtendidaKW: 0,
      falloEnergia: false,
      pausadas: [],
    };
  }

  // --------------------------------------------------------------------------
  // Paso de simulación
  // --------------------------------------------------------------------------

  /**
   * Avanza un intervalo. Reparte el suministro por prioridad (el fondo primero),
   * carga o descarga la batería y registra cargas pausadas y energía no atendida.
   * @param {number} dtHoras duración en horas de juego
   * @returns {object} reporte del paso
   */
  _paso(dtHoras) {
    for (const estacion of this.estaciones) estacion.pausada = false;

    const generacionKW = this.generacionSolarKW();
    const cargas = this._cargasDelPaso();
    const demandaKW = cargas.reduce((total, c) => total + c.potenciaKW, 0);

    // Descarga instantánea posible: límite del inversor y energía disponible.
    const descargaMaxKW = Math.min(
      Math.max(0, this.config.limiteDescargaKW),
      dtHoras > 0 ? this.energiaBaseKWh / dtHoras : Math.max(0, this.config.limiteDescargaKW),
    );
    const suministroKW = generacionKW + descargaMaxKW;

    // Reparto por prioridad: prioridad baja = más importante.
    let restanteKW = suministroKW;
    let servidaKW = 0;
    let falloEnergia = false;
    const pausadas = [];
    const ordenadas = cargas.slice().sort((a, b) => a.prioridad - b.prioridad);

    for (const carga of ordenadas) {
      const atendidaKW = Math.min(carga.potenciaKW, restanteKW);
      restanteKW -= atendidaKW;
      servidaKW += atendidaKW;
      if (atendidaKW + EPS < carga.potenciaKW) {
        if (carga.esFondo) {
          // Soporte vital / fondo sin cubrir: evento de fallo de energía.
          falloEnergia = true;
        } else {
          // Tarea opcional pausada: conserva su estado para reanudarla.
          pausadas.push(carga.id);
        }
      }
    }

    const noAtendidaKW = Math.max(0, demandaKW - servidaKW);

    let cargaBateriaKW = 0;
    let descargaBateriaKW = 0;
    let excedenteKW = 0;
    const netoKW = generacionKW - servidaKW;
    const espacioKWh = Math.max(
      0,
      this.config.capacidadBaseKWh - this.energiaBaseKWh,
    );

    if (netoKW >= 0) {
      // Solo se solicita carga si la batería tiene espacio.
      cargaBateriaKW = espacioKWh > EPS
        ? Math.min(netoKW, Math.max(0, this.config.limiteCargaKW))
        : 0;

      if (dtHoras > 0) {
        const entradaKWh = cargaBateriaKW * dtHoras;
        const eficiencia = clamp(this.config.eficienciaIdaVuelta, 0, 1);
        const almacenableKWh = Math.min(espacioKWh, entradaKWh * eficiencia);
        this.energiaBaseKWh = clamp(
          this.energiaBaseKWh + almacenableKWh,
          0,
          this.config.capacidadBaseKWh,
        );
        const entradaUsadaKWh = eficiencia > 0 ? almacenableKWh / eficiencia : 0;
        excedenteKW = Math.max(0, netoKW - entradaUsadaKWh / dtHoras);
      } else {
        excedenteKW = Math.max(0, netoKW - cargaBateriaKW);
      }
    } else {
      descargaBateriaKW = Math.min(-netoKW, descargaMaxKW);
      if (dtHoras > 0) {
        this.energiaBaseKWh = clamp(
          this.energiaBaseKWh - descargaBateriaKW * dtHoras,
          0,
          this.config.capacidadBaseKWh,
        );
      }
    }

    if (dtHoras > 0) {
      this.energiaDesperdiciadaKWh += excedenteKW * dtHoras;
      this.energiaNoAtendidaKWh += noAtendidaKW * dtHoras;
    }

    for (const id of pausadas) {
      const estacion = this.estaciones.find((e) => e.id === id);
      if (estacion) estacion.pausada = true;
    }

    this.cargasPausadas = pausadas;
    this._reporte = {
      generacionKW,
      demandaKW,
      servidaKW,
      cargaBateriaKW,
      descargaBateriaKW,
      excedenteKW,
      noAtendidaKW,
      falloEnergia,
      pausadas,
    };
    return this._reporte;
  }

  // --------------------------------------------------------------------------
  // Control del modelo (nivel, sol, estaciones)
  // --------------------------------------------------------------------------

  /**
   * Fija el factor solar (0 = sombra, 1 = nominal).
   * @param {number} factor
   */
  setSolarFactor(factor) {
    this.factorSolar = clamp(numero(factor, 0), 0, 1);
    return this.factorSolar;
  }

  /**
   * Cambia el perfil de carga. En 'minimo' se sustituye TODO el perfil por 2 kW,
   * tal como indica el md §3.
   * @param {'normal'|'minimo'} modo
   */
  setModo(modo) {
    if (modo !== 'normal' && modo !== 'minimo') {
      throw new Error(`Modo de energía desconocido: ${modo}`);
    }
    this.modo = modo;
    return this.getSnapshot();
  }

  /**
   * @param {string} id
   * @returns {object|undefined}
   */
  getEstacion(id) {
    return this.estaciones.find((e) => e.id === id);
  }

  /**
   * Enciende o apaga una estación. La energía se descuenta en cada `update`.
   * @param {string} id
   * @param {boolean} [activa=true]
   */
  activarEstacion(id, activa = true) {
    const estacion = this.getEstacion(id);
    if (!estacion) throw new Error(`Estación desconocida: ${id}`);
    estacion.activa = Boolean(activa);
    if (!estacion.activa) estacion.pausada = false;
    return estacion;
  }

  /**
   * @param {string} id
   * @returns {boolean} nuevo estado
   */
  alternarEstacion(id) {
    const estacion = this.activarEstacion(id, !(this.getEstacion(id)?.activa ?? false));
    return estacion.activa;
  }

  // --------------------------------------------------------------------------
  // Gastar y recargar energía (base)
  // --------------------------------------------------------------------------

  /**
   * GASTAR ENERGÍA DE LA BASE.
   *
   * Para costes puntuales (una tarea resuelta de golpe, un imprevisto, etc.).
   * Si la estación ya está activa, su consumo continuo lo descuenta `update`:
   * no llames a este método otra vez para la misma carga.
   *
   * `options.respetarReserva` impide bajar de los 24 kWh protegidos.
   * @param {number} kWh
   * @param {{ respetarReserva?: boolean, motivo?: string }} [options]
   * @returns {{
   *   solicitadaKWh: number, entregadaKWh: number, faltanteKWh: number,
   *   energiaBaseKWh: number, porcentaje: number,
   *   entroEnReservaProtegida: boolean, motivo: string|null,
   * }}
   */
  spendEnergy(kWh, options = {}) {
    const solicitadaKWh = Math.max(0, numero(kWh, 0));
    const reserva = Math.max(0, numero(this.config.reservaProtegidaKWh, 0));
    const respetarReserva = Boolean(options.respetarReserva);

    const minimoPermitido = respetarReserva ? Math.min(reserva, this.energiaBaseKWh) : 0;
    const disponibleKWh = Math.max(0, this.energiaBaseKWh - minimoPermitido);
    const entregadaKWh = Math.min(solicitadaKWh, disponibleKWh);
    const antesKWh = this.energiaBaseKWh;

    this.energiaBaseKWh = clamp(
      this.energiaBaseKWh - entregadaKWh,
      0,
      this.config.capacidadBaseKWh,
    );

    const entroEnReservaProtegida = antesKWh > reserva + EPS
      && this.energiaBaseKWh < reserva - EPS;

    return {
      solicitadaKWh,
      entregadaKWh,
      faltanteKWh: Math.max(0, solicitadaKWh - entregadaKWh),
      energiaBaseKWh: this.energiaBaseKWh,
      porcentaje: this.porcentajeBase,
      entroEnReservaProtegida,
      motivo: options.motivo ?? null,
    };
  }

  /**
   * RECARGAR ENERGÍA DE LA BASE.
   *
   * `kWhRed` es la energía tomada de la fuente (red/excedente). Por defecto se
   * aplica la eficiencia de ida y vuelta del 90 %: 10 kWh de entrada dejan
   * 9 kWh útiles. El exceso que no cabe en la batería se devuelve como
   * `rechazadaPorCapacidadKWh`.
   * @param {number} kWhRed
   * @param {{ conEficiencia?: boolean, eficiencia?: number }} [options]
   * @returns {{
   *   solicitadaKWh: number, almacenadaKWh: number, perdidaPorEficienciaKWh: number,
   *   rechazadaPorCapacidadKWh: number, energiaBaseKWh: number, porcentaje: number,
   * }}
   */
  rechargeEnergy(kWhRed, options = {}) {
    const solicitadaKWh = Math.max(0, numero(kWhRed, 0));
    const conEficiencia = options.conEficiencia !== false;
    const eficiencia = conEficiencia
      ? clamp(numero(options.eficiencia, this.config.eficienciaIdaVuelta), 0, 1)
      : 1;

    const almacenableBrutoKWh = solicitadaKWh * eficiencia;
    const espacioKWh = Math.max(
      0,
      this.config.capacidadBaseKWh - this.energiaBaseKWh,
    );
    const almacenadaKWh = Math.min(almacenableBrutoKWh, espacioKWh);

    this.energiaBaseKWh = clamp(
      this.energiaBaseKWh + almacenadaKWh,
      0,
      this.config.capacidadBaseKWh,
    );

    return {
      solicitadaKWh,
      almacenadaKWh,
      perdidaPorEficienciaKWh: solicitadaKWh * (1 - eficiencia),
      rechazadaPorCapacidadKWh: Math.max(0, almacenableBrutoKWh - almacenadaKWh),
      energiaBaseKWh: this.energiaBaseKWh,
      porcentaje: this.porcentajeBase,
    };
  }

  // --------------------------------------------------------------------------
  // Avance de la simulación
  // --------------------------------------------------------------------------

  /**
   * Avanza la simulación con el `dt` real del juego (segundos).
   * Internamente lo convierte a horas de juego con la escala 1 día = 5 min.
   * @param {number} dtSegundos
   * @returns {object} snapshot listo para el HUD
   */
  update(dtSegundos) {
    const dt = numero(dtSegundos, 0);
    if (dt <= 0) return this.getSnapshot();
    const dtHoras = dt * HORAS_JUEGO_POR_SEGUNDO * this.velocidadTiempo;
    if (dtHoras <= 0) return this.getSnapshot();
    this.tiempoHoras += dtHoras;
    this._paso(dtHoras);
    return this.getSnapshot();
  }

  // --------------------------------------------------------------------------
  // Batería del traje
  // --------------------------------------------------------------------------

  /**
   * GASTAR ENERGÍA DEL TRAJE (una actividad puntual).
   * @param {number} wh
   * @returns {{
   *   solicitadaWh: number, entregadaWh: number, faltanteWh: number,
   *   energiaTrajeWh: number, porcentaje: number, agotado: boolean,
   * }}
   */
  spendSuitEnergy(wh) {
    const solicitadaWh = Math.max(0, numero(wh, 0));
    const entregadaWh = Math.min(solicitadaWh, this.energiaTrajeWh);
    this.energiaTrajeWh = clamp(
      this.energiaTrajeWh - entregadaWh,
      0,
      this.config.capacidadTrajeWh,
    );
    return {
      solicitadaWh,
      entregadaWh,
      faltanteWh: Math.max(0, solicitadaWh - entregadaWh),
      energiaTrajeWh: this.energiaTrajeWh,
      porcentaje: this.porcentajeTraje,
      agotado: this.energiaTrajeWh <= EPS,
    };
  }

  /**
   * Consumo continuo del traje durante una EVA.
   * @param {number} dtSegundos
   * @param {number} [potenciaW] potencia prevista (144,375 W normal; 180 W alto; 233 W pico)
   * @returns {ReturnType<SistemaEnergia['spendSuitEnergy']>}
   */
  updateSuit(dtSegundos, potenciaW = this.consumoTrajeW) {
    this.consumoTrajeW = Math.max(0, numero(potenciaW, this.consumoTrajeW));
    const dt = numero(dtSegundos, 0);
    const dtHoras = Math.max(0, dt * HORAS_JUEGO_POR_SEGUNDO * this.velocidadTiempo);
    return this.spendSuitEnergy(this.consumoTrajeW * dtHoras);
  }

  /**
   * RECARGAR EL TRAJE DESDE LA BASE.
   *
   * La base entrega `potenciaKW × Δt` kWh (lo registra como carga) y el traje
   * recibe el 90 % en Wh. Si no se pasa `potenciaDisponibleKW`, se usa primero
   * el excedente solar libre y, si falta, la batería de la base.
   * @param {number} dtSegundos
   * @param {{ potenciaKW?: number, potenciaDisponibleKW?: number }} [options]
   * @returns {{
   *   potenciaKW: number, energiaAnadidaWh: number, energiaBaseKWh: number,
   *   tomadaDeBateriaKWh: number, completo: boolean,
   *   tiempoRestanteHoras: number, tiempoRestanteTexto: string, porcentajeTraje: number,
   * }}
   */
  rechargeSuit(dtSegundos, options = {}) {
    const dt = numero(dtSegundos, 0);
    const dtHoras = Math.max(0, dt * HORAS_JUEGO_POR_SEGUNDO * this.velocidadTiempo);
    const potenciaSolicitadaKW = Math.max(
      0,
      numero(options.potenciaKW, this.config.potenciaCargadorKW),
    );
    const eficiencia = clamp(this.config.eficienciaCargador, 0, 1);
    const faltanteWh = Math.max(
      0,
      this.config.capacidadTrajeWh - this.energiaTrajeWh,
    );

    let potenciaRealKW = 0;
    let tomadaDeBateriaKW = 0;

    if (options.potenciaDisponibleKW !== undefined) {
      potenciaRealKW = Math.min(
        potenciaSolicitadaKW,
        Math.max(0, numero(options.potenciaDisponibleKW, 0)),
      );
    } else {
      // 1) excedente solar después de las cargas; 2) batería de la base.
      const solarLibreKW = Math.max(0, this.generacionSolarKW() - this.cargaActivaKW());
      potenciaRealKW = Math.min(potenciaSolicitadaKW, solarLibreKW);
      const faltanteKW = potenciaSolicitadaKW - potenciaRealKW;
      const despachableKW = Math.min(
        Math.max(0, this.config.limiteDescargaKW),
        dtHoras > 0
          ? this.energiaBaseKWh / dtHoras
          : Math.max(0, this.config.limiteDescargaKW),
      );
      tomadaDeBateriaKW = Math.min(faltanteKW, despachableKW);
      potenciaRealKW += tomadaDeBateriaKW;
    }

    if (dtHoras <= 0) {
      return {
        potenciaKW: potenciaRealKW,
        energiaAnadidaWh: 0,
        energiaBaseKWh: 0,
        tomadaDeBateriaKWh: 0,
        completo: faltanteWh <= EPS,
        tiempoRestanteHoras: this._tiempoRecargaHoras(faltanteWh, potenciaRealKW),
        tiempoRestanteTexto: formatearHoras(
          this._tiempoRecargaHoras(faltanteWh, potenciaRealKW),
        ),
        porcentajeTraje: this.porcentajeTraje,
      };
    }

    const energiaAnadidaWh = Math.min(
      faltanteWh,
      1000 * eficiencia * potenciaRealKW * dtHoras,
    );
    this.energiaTrajeWh = clamp(
      this.energiaTrajeWh + energiaAnadidaWh,
      0,
      this.config.capacidadTrajeWh,
    );

    const tomadaDeBateriaKWh = tomadaDeBateriaKW * dtHoras;
    this.energiaBaseKWh = clamp(
      this.energiaBaseKWh - tomadaDeBateriaKWh,
      0,
      this.config.capacidadBaseKWh,
    );

    const restanteWh = Math.max(
      0,
      this.config.capacidadTrajeWh - this.energiaTrajeWh,
    );
    const tiempoRestanteHoras = this._tiempoRecargaHoras(
      restanteWh,
      potenciaRealKW,
    );

    return {
      potenciaKW: potenciaRealKW,
      energiaAnadidaWh,
      energiaBaseKWh: potenciaRealKW * dtHoras,
      tomadaDeBateriaKWh,
      completo: restanteWh <= EPS,
      tiempoRestanteHoras,
      tiempoRestanteTexto: formatearHoras(tiempoRestanteHoras),
      porcentajeTraje: this.porcentajeTraje,
    };
  }

  /**
   * Tiempo de recarga (h de juego) = faltante_kWh / (0,90 × P_cargador).
   * @param {number} faltanteWh
   * @param {number} potenciaKW
   * @returns {number}
   */
  _tiempoRecargaHoras(faltanteWh, potenciaKW) {
    const potencia = Math.max(0, numero(potenciaKW, 0));
    const eficiencia = clamp(this.config.eficienciaCargador, 0, 1);
    if (potencia <= 0 || eficiencia <= 0) return Infinity;
    return (Math.max(0, numero(faltanteWh, 0)) / 1000) / (eficiencia * potencia);
  }

  // --------------------------------------------------------------------------
  // Previsualización para el HUD
  // --------------------------------------------------------------------------

  /**
   * Copia profunda del estado para simular sin tocar la partida real.
   * @returns {SistemaEnergia}
   */
  _clonar() {
    const copia = new SistemaEnergia({
      ...this.config,
      umbralesTraje: { ...this.config.umbralesTraje },
      estaciones: this.estaciones.map((e) => ({ ...e })),
      perfilSolar: this.perfilSolar,
      velocidadTiempo: this.velocidadTiempo,
      horaInicio: this.horaInicio,
      factorSolar: this.factorSolar,
      modo: this.modo,
      energiaBaseInicialKWh: this.energiaBaseKWh,
      energiaTrajeInicialWh: this.energiaTrajeWh,
    });
    copia.tiempoHoras = this.tiempoHoras;
    copia.energiaDesperdiciadaKWh = this.energiaDesperdiciadaKWh;
    copia.energiaNoAtendidaKWh = this.energiaNoAtendidaKWh;
    copia.consumoTrajeW = this.consumoTrajeW;
    copia.potenciaRegresoW = this.potenciaRegresoW;
    copia.tiempoRegresoHoras = this.tiempoRegresoHoras;
    return copia;
  }

  /**
   * ESTIMACIÓN ANTES DE CONFIRMAR UNA TAREA (md §3, decisión 1).
   * Simula la tarea con la generación prevista y todas las cargas activas.
   * `energiaTareaKWh` es solo el consumo propio de la estación; el efecto real
   * sobre la batería es `energiaBaseNetaKWh` (incluye fondo y generación).
   * @param {{ id: string, horas?: number, duracionHoras?: number, activar?: boolean }} options
   * @returns {object}
   */
  estimateTask(options = {}) {
    const id = options.id;
    const estacion = this.getEstacion(id);
    if (!estacion) throw new Error(`Estación desconocida: ${id}`);

    const duracionHoras = Math.max(
      0,
      numero(options.horas ?? options.duracionHoras, 0),
    );
    const energiaTareaKWh = estacion.potenciaKW * duracionHoras;

    const simulacion = this._clonar();
    const estacionSimulada = simulacion.getEstacion(id);
    if (options.activar !== false && estacionSimulada) {
      estacionSimulada.activa = true;
    }

    const inicialKWh = simulacion.energiaBaseKWh;
    const pasos = Math.max(1, Math.ceil(duracionHoras / 0.05));
    const dtHoras = duracionHoras / pasos;
    let pausada = false;
    let energiaNoAtendidaKWh = 0;

    for (let i = 0; i < pasos && dtHoras > 0; i += 1) {
      simulacion.tiempoHoras += dtHoras;
      const reporte = simulacion._paso(dtHoras);
      if (reporte.pausadas.includes(id)) pausada = true;
      energiaNoAtendidaKWh += reporte.noAtendidaKW * dtHoras;
    }

    const finalKWh = simulacion.energiaBaseKWh;
    const porcentajeInicial = simulacion.config.capacidadBaseKWh > 0
      ? (100 * inicialKWh) / simulacion.config.capacidadBaseKWh
      : 0;

    return {
      id,
      nombre: estacion.nombre,
      duracionHoras,
      duracionTexto: formatearHoras(duracionHoras),
      potenciaKW: estacion.potenciaKW,
      energiaTareaKWh,
      energiaBaseInicialKWh: inicialKWh,
      energiaBaseFinalKWh: finalKWh,
      energiaBaseNetaKWh: inicialKWh - finalKWh,
      porcentajeInicial,
      porcentajeFinal: simulacion.porcentajeBase,
      porcentajeFinalTexto: formatearPorcentaje(simulacion.porcentajeBase),
      pausada,
      energiaNoAtendidaKWh,
      alerta: simulacion._alertaBase(),
    };
  }

  /**
   * ESTIMACIÓN DE UNA SALIDA (md §4): consumo, batería final y margen de regreso.
   * @param {{
   *   duracionHoras?: number, horas?: number,
   *   potenciaW?: number, potenciaRegresoW?: number, tiempoRegresoHoras?: number,
   * }} [options]
   * @returns {object}
   */
  estimateSuitTrip(options = {}) {
    const duracionHoras = Math.max(
      0,
      numero(options.duracionHoras ?? options.horas, 0),
    );
    const potenciaW = Math.max(
      0,
      numero(options.potenciaW, this.consumoTrajeW),
    );
    const potenciaRegresoW = Math.max(
      0,
      numero(options.potenciaRegresoW, this.potenciaRegresoW),
    );
    const tiempoRegresoHoras = Math.max(
      0,
      numero(options.tiempoRegresoHoras, this.tiempoRegresoHoras),
    );

    const consumoWh = potenciaW * duracionHoras;
    const energiaFinalWh = Math.max(0, this.energiaTrajeWh - consumoWh);
    const margenWh = energiaFinalWh
      - potenciaRegresoW * tiempoRegresoHoras
      - Math.max(0, this.config.reservaLlegadaEVAWh);
    const capacidad = this.config.capacidadTrajeWh;
    const porcentajeFinal = capacidad > 0 ? (100 * energiaFinalWh) / capacidad : 0;

    return {
      duracionHoras,
      duracionTexto: formatearHoras(duracionHoras),
      potenciaW,
      consumoWh,
      energiaFinalWh,
      porcentajeFinal,
      porcentajeFinalTexto: formatearPorcentaje(porcentajeFinal),
      potenciaRegresoW,
      tiempoRegresoHoras,
      margenWh,
      requiereRegreso: margenWh <= 0,
      alerta: this._alertaTraje(energiaFinalWh, margenWh),
    };
  }

  /**
   * ESTIMACIÓN DEL TIEMPO DE RECARGA DEL TRAJE (md §4):
   * faltante_kWh / (0,90 × P_cargador).
   * @param {number} [energiaFaltanteWh]
   * @param {number} [potenciaKW]
   * @returns {object}
   */
  estimateSuitRecharge(
    energiaFaltanteWh = this.config.capacidadTrajeWh - this.energiaTrajeWh,
    potenciaKW = this.config.potenciaCargadorKW,
  ) {
    const faltanteWh = Math.max(0, numero(energiaFaltanteWh, 0));
    const potencia = Math.max(
      0,
      numero(potenciaKW, this.config.potenciaCargadorKW),
    );
    const tiempoHoras = this._tiempoRecargaHoras(faltanteWh, potencia);
    return {
      energiaFaltanteWh: faltanteWh,
      potenciaKW: potencia,
      eficienciaCargador: clamp(this.config.eficienciaCargador, 0, 1),
      tiempoHoras,
      tiempoTexto: formatearHoras(tiempoHoras),
      energiaBaseKWh: potencia * tiempoHoras,
    };
  }

  // --------------------------------------------------------------------------
  // Alertas y snapshot para el HUD
  // --------------------------------------------------------------------------

  /**
   * Margen de regreso del traje [Wh] = E_traje − E_regreso − E_reserva_EVA.
   * @returns {number}
   */
  _margenTrajeWh() {
    return this.energiaTrajeWh
      - this.potenciaRegresoW * this.tiempoRegresoHoras
      - Math.max(0, numero(this.config.reservaLlegadaEVAWh, 0));
  }

  /**
   * Alerta del traje. "Regresa ahora" tiene prioridad sobre los umbrales fijos.
   * @param {number} [energiaWh]
   * @param {number} [margenWh]
   * @returns {{ nivel: string, prioridad: number, texto: string, regresaAhora: boolean, margenWh: number }|null}
   */
  _alertaTraje(energiaWh = this.energiaTrajeWh, margenWh = this._margenTrajeWh()) {
    const capacidad = this.config.capacidadTrajeWh;
    const fraccion = capacidad > 0 ? energiaWh / capacidad : 0;
    const umbrales = this.config.umbralesTraje;

    if (energiaWh <= EPS) {
      return {
        nivel: 'agotada',
        prioridad: 0,
        texto: 'Batería agotada. Fin de la EVA.',
        regresaAhora: true,
        margenWh,
      };
    }
    if (margenWh <= 0) {
      return {
        nivel: 'regresa',
        prioridad: 1,
        texto: 'Regresa ahora',
        regresaAhora: true,
        margenWh,
      };
    }
    if (fraccion <= numero(umbrales.emergencia, 0.1) + EPS) {
      return {
        nivel: 'emergencia',
        prioridad: 2,
        texto: 'Reserva de emergencia. Prioriza la esclusa.',
        regresaAhora: false,
        margenWh,
      };
    }
    if (fraccion <= numero(umbrales.critico, 0.15) + EPS) {
      return {
        nivel: 'critico',
        prioridad: 3,
        texto: 'Batería crítica. Termina la actividad y regresa.',
        regresaAhora: false,
        margenWh,
      };
    }
    if (fraccion <= numero(umbrales.bajo, 0.25) + EPS) {
      return {
        nivel: 'bajo',
        prioridad: 4,
        texto: 'Batería baja. Revisa la ruta.',
        regresaAhora: false,
        margenWh,
      };
    }
    return null;
  }

  /**
   * Alerta de la base: fallo, batería agotada o reserva protegida.
   * @returns {{ nivel: string, texto: string }|null}
   */
  _alertaBase() {
    const reserva = Math.max(0, numero(this.config.reservaProtegidaKWh, 0));
    if (this._reporte.falloEnergia) {
      return {
        nivel: 'fallo',
        texto: 'Fallo de energía: el soporte vital no tiene suministro.',
      };
    }
    if (this.energiaBaseKWh <= EPS) {
      return {
        nivel: 'critico',
        texto: 'Batería de la base agotada.',
      };
    }
    if (this.energiaBaseKWh <= reserva + EPS) {
      return {
        nivel: 'aviso',
        texto: 'Reserva protegida: aplaza ejercicio, cultivos o recargas no urgentes.',
      };
    }
    return null;
  }

  /**
   * @returns {'fallo'|'agotada'|'reserva'|'cargando'|'descargando'|'estable'}
   */
  _estadoBase() {
    const reserva = Math.max(0, numero(this.config.reservaProtegidaKWh, 0));
    if (this._reporte.falloEnergia) return 'fallo';
    if (this.energiaBaseKWh <= EPS) return 'agotada';
    if (this.energiaBaseKWh <= reserva + EPS) return 'reserva';
    if (this._reporte.cargaBateriaKW > EPS) return 'cargando';
    if (this._reporte.descargaBateriaKW > EPS) return 'descargando';
    return 'estable';
  }

  /**
   * Instantánea lista para pintar en el HUD (canvas o DOM).
   * No redondea el estado interno: solo los textos de presentación.
   * @returns {object}
   */
  getSnapshot() {
    const reporte = this._reporte;
    const basePct = this.porcentajeBase;
    const trajePct = this.porcentajeTraje;
    const reserva = Math.max(0, numero(this.config.reservaProtegidaKWh, 0));
    const capacidadBase = this.config.capacidadBaseKWh;

    // Autonomía [h] = E_base / potencia neta extraída de la batería.
    // Si no se extrae nada, el md pide mostrar «Sin descarga en este momento».
    const extraccionKW = Math.max(0, reporte.servidaKW - reporte.generacionKW);
    const autonomiaBaseH = extraccionKW > EPS
      ? this.energiaBaseKWh / extraccionKW
      : null;

    const autonomiaTrajeH = this.consumoTrajeW > EPS
      ? this.energiaTrajeWh / this.consumoTrajeW
      : null;

    const margenWh = this._margenTrajeWh();
    const balanceKW = reporte.generacionKW - reporte.demandaKW;

    return {
      tiempo: {
        dia: this.diaJuego,
        horaDelDia: this.horaDelDia,
        horaTexto: formatearHoraDelDia(this.horaDelDia),
        transcurridoHoras: this.tiempoHoras,
        transcurridoTexto: formatearHoras(this.tiempoHoras),
        factorSolar: this.factorSolarActual(),
      },
      base: {
        energiaKWh: this.energiaBaseKWh,
        capacidadKWh: capacidadBase,
        porcentaje: basePct,
        porcentajeTexto: formatearPorcentaje(basePct),
        reservaProtegidaKWh: reserva,
        reservaProtegidaPorcentaje: capacidadBase > 0
          ? (100 * reserva) / capacidadBase
          : 0,
        enReservaProtegida: this.energiaBaseKWh <= reserva + EPS,
        generacionKW: reporte.generacionKW,
        demandaKW: reporte.demandaKW,
        servidaKW: reporte.servidaKW,
        balanceKW,
        balanceTexto: `${balanceKW >= 0 ? '+' : ''}${formatearNumero(balanceKW, 1)} kW`,
        cargaBateriaKW: reporte.cargaBateriaKW,
        descargaBateriaKW: reporte.descargaBateriaKW,
        excedenteKW: reporte.excedenteKW,
        noAtendidaKW: reporte.noAtendidaKW,
        autonomiaH: autonomiaBaseH,
        autonomiaTexto: autonomiaBaseH === null
          ? 'Sin descarga en este momento'
          : formatearHoras(autonomiaBaseH),
        energiaDesperdiciadaKWh: this.energiaDesperdiciadaKWh,
        energiaNoAtendidaKWh: this.energiaNoAtendidaKWh,
        modo: this.modo,
        estado: this._estadoBase(),
        alerta: this._alertaBase(),
      },
      traje: {
        energiaWh: this.energiaTrajeWh,
        capacidadWh: this.config.capacidadTrajeWh,
        porcentaje: trajePct,
        porcentajeTexto: formatearPorcentaje(trajePct),
        consumoW: this.consumoTrajeW,
        autonomiaH: autonomiaTrajeH,
        autonomiaTexto: autonomiaTrajeH === null
          ? '—'
          : formatearHoras(autonomiaTrajeH),
        potenciaRegresoW: this.potenciaRegresoW,
        tiempoRegresoHoras: this.tiempoRegresoHoras,
        reservaLlegadaWh: this.config.reservaLlegadaEVAWh,
        margenWh,
        margenTexto: margenWh <= 0
          ? 'Margen agotado: regresa ahora'
          : `Margen ${formatearNumero(margenWh, 0)} Wh`,
        alerta: this._alertaTraje(),
      },
      estaciones: this.estaciones.map((e) => ({ ...e })),
      cargasPausadas: this.cargasPausadas.slice(),
    };
  }
}
