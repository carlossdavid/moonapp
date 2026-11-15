/**
 * @file Sistema de Oxígeno del Entrenador Lunar (base + traje) para el HUD.
 *
 * Módulo de lógica pura: no toca canvas, DOM ni el GameLoop. Se integra llamando
 * a `update(dt)` desde `Scene.update` y leyendo `getSnapshot()` desde `drawUI`.
 *
 * Referencias técnicas y normativas de la NASA (ver metadatos §1 y fuentes):
 *   - NASA-STD-3001: Space Flight Human-System Standard (Volumen 2).
 *   - NASA Technical Reports Server (NTRS): Arquitectura de la mochila PLSS (Portable 
 *     Life Support System) y la Unidad de Movilidad Extravehicular (EMU).
 *   - International Conference on Environmental Systems (ICES): Tasas de consumo 
 *     metabólico de oxígeno ($O_2$) en trajes espaciales y márgenes de seguridad EVA.
 *
 * Escala del juego:
 *   1 día de juego (24 h) = 5 minutos reales = 300 s.
 *   Por tanto, 1 segundo real = 0,08 h de juego (4,8 min de juego).
 *
 * Ecuaciones implementadas:
 *   Generación base (electrólisis) [kg/h] = P_electrolisis_kW × factor_eficiencia
 *   Consumo base (habitantes) [kg/h]      = tasa_metabólica_tripulación
 *   Consumo traje EVA [kg/h]              = 0.15 kg/h (~150 g/h para 8 h de autonomía)
 *   Margen de regreso EVA [kg]            = E_traje − (Consumo_regreso × T_regreso) − Reserva_soportes
 */

const EPS = 1e-9;

// ============================================================================
// 1. Referencias normativas y de ingeniería (NASA / NTRS / ICES)
// ============================================================================

export const FUENTES_OXIGENO = Object.freeze({
  normaPrincipal: 'NASA-STD-3001 Vol. 2 (Space Flight Human-System Standard)',
  repositorioTecnico: 'NASA Technical Reports Server (NTRS) - PLSS & EMU Architecture',
  conferencia: 'International Conference on Environmental Systems (ICES) - Metabolic Rates',
  autonomiaNominalTrajeHoras: 8,
  reservaMinimaTrajePorcentaje: 0.10, // 10 % o 30 min de respaldo secundario (SOP)
});

// ============================================================================
// 2. Parámetros del modelo de Oxígeno
// ============================================================================

export const CONFIG_OXIGENO = Object.freeze({
  // --- Tanque y generación del hábitat (Base) ---
  capacidadTanqueBaseKg: 100,      // kg de O2 almacenados en la base
  oxigenoBaseInicialKg: 100,
  produccionElectrolisisKW: 1.4,   // kW consumidos por la estación de O2 (coincide con EnergySystem)
  produccionO2KgPorHora: 0.8,      // kg de O2 generados por hora de electrólisis activa
  consumoFondoHabitatKgPorHora: 0.3, // consumo base por soporte vital de la tripulación

  // --- Traje EVA (Mochila PLSS) ---
  capacidadTrajeKg: 1.2,           // ~1.2 kg de O2 útil para una EVA estándar de 8 h
  oxigenoTrajeInicialKg: 1.2,
  consumoTrajeKgPorHora: 0.15,     // ~150 g/h en actividad normal (NASA EMU estándar)
  potenciaRegresoKgPorHora: 0.15,  // tasa prevista para volver
  tiempoRegresoHoras: 1.5,         // 90 min de margen de retorno
  reservaLlegadaEVAKg: 0.12,       // Reserva de llegada (10 %)
  potenciaCargadorKgPorHora: 0.2,  // Tasa de recarga de O2 en la esclusa
  eficienciaCargador: 0.95,

  // --- Umbrales de alerta del traje ---
  umbralesTraje: Object.freeze({
    bajo: 0.25,
    critico: 0.15,
    emergencia: 0.10,
  }),
});

// ============================================================================
// 3. Utilidades numéricas y de formato
// ============================================================================

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numero(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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

export function formatearNumero(value, decimales = 2) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(decimales).replace('.', ',');
}

export function formatearPorcentaje(value, decimales = 1) {
  return `${formatearNumero(value, decimales)} %`;
}

// ============================================================================
// 4. Sistema de Oxígeno
// ============================================================================

export class SistemaOxigeno {
  /**
   * @param {Partial<typeof CONFIG_OXIGENO> & {
   *   umbralesTraje?: { bajo?: number, critico?: number, emergencia?: number },
   *   velocidadTiempo?: number,
   *   electrolisisActiva?: boolean,
   * }} [opciones]
   */
  constructor(opciones = {}) {
    const {
      umbralesTraje,
      velocidadTiempo = 1,
      electrolisisActiva = true,
      ...resto
    } = opciones;

    this.config = Object.freeze({
      ...CONFIG_OXIGENO,
      ...resto,
      umbralesTraje: Object.freeze({
        ...CONFIG_OXIGENO.umbralesTraje,
        ...(umbralesTraje ?? {}),
      }),
    });

    this.velocidadTiempo = Math.max(0, numero(velocidadTiempo, 1));
    this.electrolisisActiva = Boolean(electrolisisActiva);

    const capacidadBase = Math.max(0, numero(this.config.capacidadTanqueBaseKg, 100));
    this.oxigenoBaseKg = clamp(
      numero(this.config.oxigenoBaseInicialKg, capacidadBase),
      0,
      capacidadBase,
    );

    const capacidadTraje = Math.max(0, numero(this.config.capacidadTrajeKg, 1.2));
    this.oxigenoTrajeKg = clamp(
      numero(this.config.oxigenoTrajeInicialKg, capacidadTraje),
      0,
      capacidadTraje,
    );

    this.consumoTrajeKgPorHora = Math.max(0, numero(this.config.consumoTrajeKgPorHora, 0.15));
    this.potenciaRegresoKgPorHora = Math.max(0, numero(this.config.potenciaRegresoKgPorHora, 0.15));
    this.tiempoRegresoHoras = Math.max(0, numero(this.config.tiempoRegresoHoras, 1.5));

    /** Horas de juego transcurridas desde el inicio. */
    this.tiempoHoras = 0;
    this.oxigenoDesperdiciadoKg = 0;
    this.deficitOxigenoKg = 0;

    this._reporte = this._reporteVacio();
    this._paso(0);
  }

  get porcentajeBase() {
    const cap = this.config.capacidadTanqueBaseKg;
    return cap > 0 ? (100 * this.oxigenoBaseKg) / cap : 0;
  }

  get porcentajeTraje() {
    const cap = this.config.capacidadTrajeKg;
    return cap > 0 ? (100 * this.oxigenoTrajeKg) / cap : 0;
  }

  _reporteVacio() {
    return {
      produccionKgH: 0,
      consumoKgH: 0,
      balanceKgH: 0,
      falloOxigeno: false,
    };
  }

  _paso(dtHoras) {
    const produccionKgH = this.electrolisisActiva ? this.config.produccionO2KgPorHora : 0;
    const consumoKgH = this.config.consumoFondoHabitatKgPorHora;
    const balanceKgH = produccionKgH - consumoKgH;

    if (dtHoras > 0) {
      const cambioKg = balanceKgH * dtHoras;
      const nuevoValor = this.oxigenoBaseKg + cambioKg;
      const capacidad = this.config.capacidadTanqueBaseKg;

      if (nuevoValor > capacidad) {
        this.oxigenoDesperdiciadoKg += (nuevoValor - capacidad);
        this.oxigenoBaseKg = capacidad;
      } else if (nuevoValor < 0) {
        this.deficitOxigenoKg += Math.abs(nuevoValor);
        this.oxigenoBaseKg = 0;
      } else {
        this.oxigenoBaseKg = nuevoValor;
      }
    }

    const falloOxigeno = this.oxigenoBaseKg <= EPS;

    this._reporte = {
      produccionKgH,
      consumoKgH,
      balanceKgH,
      falloOxigeno,
    };

    return this._reporte;
  }

  activarElectrolisis(activa = true) {
    this.electrolisisActiva = Boolean(activa);
    return this.electrolisisActiva;
  }

  spendSuitOxygen(kg) {
    const solicitadaKg = Math.max(0, numero(kg, 0));
    const entregadaKg = Math.min(solicitadaKg, this.oxigenoTrajeKg);
    this.oxigenoTrajeKg = clamp(
      this.oxigenoTrajeKg - entregadaKg,
      0,
      this.config.capacidadTrajeKg,
    );
    return {
      solicitadaKg,
      entregadaKg,
      faltanteKg: Math.max(0, solicitadaKg - entregadaKg),
      oxigenoTrajeKg: this.oxigenoTrajeKg,
      porcentaje: this.porcentajeTraje,
      agotado: this.oxigenoTrajeKg <= EPS,
    };
  }

  updateSuit(dtSegundos, consumoKgPorHora = this.consumoTrajeKgPorHora) {
    this.consumoTrajeKgPorHora = Math.max(0, numero(consumoKgPorHora, this.consumoTrajeKgPorHora));
    const dt = numero(dtSegundos, 0);
    const dtHoras = Math.max(0, dt * (24 / 300) * this.velocidadTiempo); // 1 día = 300s
    return this.spendSuitOxygen(this.consumoTrajeKgPorHora * dtHoras);
  }

  rechargeSuit(dtSegundos, opciones = {}) {
    const dt = numero(dtSegundos, 0);
    const dtHoras = Math.max(0, dt * (24 / 300) * this.velocidadTiempo);
    const tasaCargaKgH = Math.max(0, numero(opciones.tasaKgH, this.config.potenciaCargadorKgPorHora));
    const eficiencia = clamp(this.config.eficienciaCargador, 0, 1);
    const faltanteKg = Math.max(0, this.config.capacidadTrajeKg - this.oxigenoTrajeKg);

    let tomadaBaseKg = Math.min(tasaCargaKgH * dtHoras, this.oxigenoBaseKg);
    let anadidoTrajeKg = Math.min(faltanteKg, tomadaBaseKg * eficiencia);

    this.oxigenoBaseKg = clamp(this.oxigenoBaseKg - tomadaBaseKg, 0, this.config.capacidadTanqueBaseKg);
    this.oxigenoTrajeKg = clamp(this.oxigenoTrajeKg + anadidoTrajeKg, 0, this.config.capacidadTrajeKg);

    const restanteKg = this.config.capacidadTrajeKg - this.oxigenoTrajeKg;
    const tiempoRestanteHoras = (tasaCargaKgH * eficiencia > 0) ? (restanteKg / (tasaCargaKgH * eficiencia)) : Infinity;

    return {
      energiaAnadidaKg: anadidoTrajeKg,
      completo: restanteKg <= EPS,
      tiempoRestanteHoras,
      tiempoRestanteTexto: formatearHoras(tiempoRestanteHoras),
      porcentajeTraje: this.porcentajeTraje,
    };
  }

  _margenTrajeKg() {
    return this.oxigenoTrajeKg
      - this.potenciaRegresoKgPorHora * this.tiempoRegresoHoras
      - Math.max(0, numero(this.config.reservaLlegadaEVAKg, 0));
  }

  _alertaTraje(oxigenoKg = this.oxigenoTrajeKg, margenKg = this._margenTrajeKg()) {
    const capacidad = this.config.capacidadTrajeKg;
    const fraccion = capacidad > 0 ? oxigenoKg / capacidad : 0;
    const umbrales = this.config.umbralesTraje;

    if (oxigenoKg <= EPS) {
      return { nivel: 'agotada', texto: 'Oxígeno agotado en el traje. Fin de la EVA.', regresaAhora: true };
    }
    if (margenKg <= 0) {
      return { nivel: 'regresa', texto: 'Margen de oxígeno agotado: Regresa ahora.', regresaAhora: true };
    }
    if (fraccion <= umbrales.emergencia) {
      return { nivel: 'emergencia', texto: 'Reserva de emergencia de O2. Activa purga y vuelve.', regresaAhora: false };
    }
    if (fraccion <= umbrales.critico) {
      return { nivel: 'critico', texto: 'Oxígeno crítico. Termina la actividad.', regresaAhora: false };
    }
    if (fraccion <= umbrales.bajo) {
      return { nivel: 'bajo', texto: 'Nivel de oxígeno bajo.', regresaAhora: false };
    }
    return null;
  }

  update(dtSegundos) {
    const dt = numero(dtSegundos, 0);
    if (dt <= 0) return this.getSnapshot();
    const dtHoras = dt * (24 / 300) * this.velocidadTiempo;
    if (dtHoras <= 0) return this.getSnapshot();
    this.tiempoHoras += dtHoras;
    this._paso(dtHoras);
    return this.getSnapshot();
  }

  getSnapshot() {
    const reporte = this._reporte;
    const basePct = this.porcentajeBase;
    const trajePct = this.porcentajeTraje;
    const consumoHabitat = reporte.consumoKgH;

    const autonomiaBaseH = consumoHabitat > EPS ? this.oxigenoBaseKg / consumoHabitat : null;
    const autonomiaTrajeH = this.consumoTrajeKgPorHora > EPS ? this.oxigenoTrajeKg / this.consumoTrajeKgPorHora : null;
    const margenKg = this._margenTrajeKg();

    return {
      fuentes: FUENTES_OXIGENO,
      tiempo: {
        transcurridoHoras: this.tiempoHoras,
      },
      base: {
        oxigenoKg: this.oxigenoBaseKg,
        capacidadKg: this.config.capacidadTanqueBaseKg,
        porcentaje: basePct,
        porcentajeTexto: formatearPorcentaje(basePct),
        produccionKgH: reporte.produccionKgH,
        consumoKgH: reporte.consumoKgH,
        balanceKgH: reporte.produccionKgH - reporte.consumoKgH,
        autonomiaH: autonomiaBaseH,
        autonomiaTexto: autonomiaBaseH === null ? 'Indefinida' : formatearHoras(autonomiaBaseH),
        electrolisisActiva: this.electrolisisActiva,
        falloOxigeno: reporte.falloOxigeno,
      },
      traje: {
        oxigenoKg: this.oxigenoTrajeKg,
        capacidadKg: this.config.capacidadTrajeKg,
        porcentaje: trajePct,
        porcentajeTexto: formatearPorcentaje(trajePct),
        autonomiaH: autonomiaTrajeH,
        autonomiaTexto: autonomiaTrajeH === null ? '—' : formatearHoras(autonomiaTrajeH),
        margenKg,
        margenTexto: margenKg <= 0 ? 'Margen agotado' : `Margen ${formatearNumero(margenKg, 2)} kg`,
        alerta: this._alertaTraje(),
      },
    };
  }
}