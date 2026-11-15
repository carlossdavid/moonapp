/** Imanes/supervivencia: tiempo activo. Aviso: tiempo real desde comenzar la partida. */
export class MissionState {
  constructor() {
    this.elapsed = 0;
    this.startedAt = null;
    this.nextMagnet = 20;
    this.magnets = [{ id: 0, x: 320, y: 205 }];
    this.serial = 1;
    this.starved = 0;
    this.health = 100;
    this.dead = false;
    this.alertPending = false;
    this.alertShown = false;
    this.visorUnlocked = false;
    this.radiacionCinematicShown = false;
    this.turtleMission = false;
    this.turtleComplete = false;
  }
  start(now) {
    if (this.startedAt === null && Number.isFinite(now)) this.startedAt = now;
  }
  checkAlert(now) {
    if (this.startedAt !== null && Number.isFinite(now) && now - this.startedAt >= 180000
      && !this.alertShown && !this.dead) this.alertPending = true;
  }
  remainingAlertSeconds(now) {
    return this.startedAt === null ? null : Math.max(0, Math.ceil((180000 - (now - this.startedAt)) / 1000));
  }
  tick(dt, levels) {
    if (this.dead || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    const positions = [[320, 205], [420, 365], [230, 410]];
    while (this.elapsed >= this.nextMagnet) {
      this.nextMagnet += 60;
      if (this.magnets.length < 3) {
        const [x, y] = positions.find(([x, y]) => !this.magnets.some(m => m.x === x && m.y === y));
        this.magnets.push({ id: this.serial++, x, y });
      }
    }
    this.starved = levels.some(value => value <= 0) ? this.starved + dt : 0;
    this.health = Math.max(0, 100 * (1 - this.starved / 5));
    this.dead = this.starved >= 5 - 1e-9;
  }
}
