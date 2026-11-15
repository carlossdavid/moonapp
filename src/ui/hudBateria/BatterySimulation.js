import { SistemaEnergia, crearPerfilSolarPorTramos } from '../../systems/EnergySystem.js';

const solarDay = crearPerfilSolarPorTramos([
  { desde: 6, hasta: 18, factor: 1 },
  { desde: 18, hasta: 6, factor: 0 },
]);

/** Una instancia por partida; el perfil consulta la sombra en cada paso. */
export function createBatterySimulation(isShadowed = () => false) {
  return new SistemaEnergia({
    horaInicio: 6,
    perfilSolar: (hour) => isShadowed() ? 0 : solarDay(hour),
  });
}

/** dt se pasa en segundos reales: el módulo convierte 300 s a 24 h. */
export function advanceBatterySimulation(energy, dt, { exterior, interior, powerW, charging }) {
  energy.update(dt);
  if (exterior) {
    energy.updateSuit(dt, powerW);
  } else if (interior && charging && energy.energiaTrajeWh < energy.config.capacidadTrajeWh - 1e-9) {
    energy.rechargeSuit(dt);
  }
  return energy.getSnapshot();
}
