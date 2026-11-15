/** Marca del suelo, compartida por puertas y puestos. El área coincide con E. */
export function drawAccess(renderer, x, y, active, label = 'ENTRAR') {
  const ctx = renderer.context, w = 38, h = 13;
  x = Math.round(x - w / 2); y = Math.round(y - h / 2);
  ctx.save();
  ctx.fillStyle = '#271e19'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.strokeStyle = active ? '#ffcf87' : '#b97943';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.fillStyle = active ? '#ffbc66' : '#a97140';
  for (const dx of [0, w - 4]) {
    ctx.fillRect(x + dx, y, 4, 2); ctx.fillRect(x + dx, y + h - 2, 4, 2);
  }
  ctx.font = '3px "Press Start 2P",monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`E ${label}`, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

export function drawWorkstation(renderer, module) {
  const ctx = renderer.context, { x, y, w, h, name } = module;
  ctx.save();
  ctx.fillStyle = '#040c1b88'; ctx.fillRect(x - 5, y + h - 1, w + 12, 7);
  ctx.fillStyle = '#1b2d46'; ctx.fillRect(x - 5, y + h - 7, w + 10, 8);
  ctx.fillStyle = '#7594b6'; ctx.fillRect(x - 5, y + h - 7, w + 10, 2);
  ctx.fillStyle = '#345573'; ctx.fillRect(x - 4, y + h + 1, 5, 5);
  ctx.fillRect(x + w - 1, y + h + 1, 5, 5);
  ctx.fillStyle = '#65dbea'; ctx.fillRect(x + 3, y + h - 4, 7, 1);
  ctx.fillStyle = '#0a1728'; ctx.fillRect(x - 8, y - 12, w + 16, 9);
  ctx.font = '3px "Press Start 2P",monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#bcecf7'; ctx.fillText(module.label || name, x + w / 2, y - 6);
  ctx.restore();
}

export function drawSceneUI(scene, renderer, prompt) {
  scene.game.ui.setHint(prompt || '');
  if (scene.minimap && scene.player && scene.camera) scene.minimap.render(renderer, {
    playerX: scene.player.x, playerY: scene.player.y,
    worldW: scene.camera.worldWidth, worldH: scene.camera.worldHeight,
    facing: scene.player.facing, exit: scene.exitMarker || scene._exteriorDoorReturn,
  });
}

/** Presentación local del resultado: no afirma 100 % si la reserva se agotó. */
export function adaptRechargeSummary(minigame, game, exit) {
  minigame._rectBotonReiniciar = () => ({ x: 110, y: 122, w: 100, h: 17 });
  minigame._updateCompleto = () => {
    const p = minigame.pointer, b = minigame._rectBotonReiniciar();
    if (p.justDown && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) exit();
  };
  minigame._drawModalCompleto = ctx => {
    ctx.save();
    ctx.fillStyle = '#060e20ed'; ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#9eb9db'; ctx.fillRect(42, 37, 236, 107);
    ctx.fillStyle = '#304d72'; ctx.fillRect(44, 39, 232, 103);
    ctx.fillStyle = '#101e36'; ctx.fillRect(46, 41, 228, 99);
    ctx.fillStyle = '#63e4eb'; ctx.fillRect(42, 44, 2, 18);
    ctx.fillRect(276, 120, 2, 18);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = '6px "Press Start 2P",monospace';
    ctx.fillStyle = '#7fe9ea'; ctx.fillText('RECARGA INTEGRAL', 160, 50);
    ctx.font = '4px "Press Start 2P",monospace';
    ctx.fillStyle = '#e1eaff';
    const oxygen = game.oxygen.porcentajeTraje, battery = game.energy.getSnapshot().traje.porcentaje;
    ctx.fillText(`O2 ${oxygen.toFixed(0)} %   AGUA ${game.water.snapshot().ml.toFixed(0)} mL`, 160, 72);
    ctx.fillText(`BATERIA ${battery.toFixed(0)} %   RETORNO CO2 LISTO`, 160, 84);
    ctx.fillStyle = oxygen < 99.9 || battery < 99.9 ? '#ffd49a' : '#94e4cb';
    ctx.fillText(oxygen < 99.9 || battery < 99.9 ? 'Reserva insuficiente: transferencia parcial.' : 'Recursos transferidos. Valvulas cerradas.', 160, 103);
    const b = minigame._rectBotonReiniciar();
    ctx.fillStyle = '#24405d'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#8cc9e0'; ctx.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1);
    ctx.fillStyle = '#c9f4fc'; ctx.fillText('SALIR A LA ESTACION', 160, b.y + 6);
    ctx.restore();
  };
}

export class ImpactFeedback {
  constructor() {
    this.particles = [];
    this.cooldown = 0;
    this.count = 0;
    this.motion = true;
  }
  attach(scene) {
    const world = scene.physicsWorld;
    if (!world || world.finalImpactHook) return;
    world.finalImpactHook = true;
    const resolve = world._resolveAxisForBody.bind(world);
    world._resolveAxisForBody = (body, axis) => {
      const position = body.position[axis], velocity = body.velocity[axis];
      resolve(body, axis);
      const correction = body.position[axis] - position;
      if (body === scene.player?.body && Math.abs(correction) > .001 && Math.abs(velocity) > 18
        && this.cooldown <= 0) {
        const normal = Math.sign(correction);
        body.velocity[axis] = normal * 32;
        this.hit(body.position.x, body.position.y, axis === 'x' ? normal : 0, axis === 'y' ? normal : 0);
        if (this.motion) scene.game.canvas.animate([
          { translate: '0 0' }, { translate: `${normal * 3}px 1px` },
          { translate: `${-normal * 2}px -1px` }, { translate: '0 0' },
        ], { duration: 180, easing: 'ease-out' });
      }
    };
  }
  hit(x, y, nx, ny) {
    this.cooldown = .45;
    this.count++;
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      this.particles.push({ x: x - nx * 6, y: y - ny * 5,
        vx: Math.cos(angle) * 25 + nx * 12, vy: Math.sin(angle) * 20 + ny * 12, life: .32 });
    }
  }
  tick(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.particles = this.particles.filter(p => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      return p.life > 0;
    });
  }
  draw(renderer) {
    const ctx = renderer.context;
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 5);
      ctx.fillStyle = p.life > .18 ? '#f9d6a4' : '#79c4dc';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.restore();
  }
  reset() { this.particles = []; this.cooldown = 0; }
}
