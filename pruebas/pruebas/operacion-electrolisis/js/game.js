/**
 * Lógica del minijuego (sin dibujo).
 * Máquina de estados: idle → playing → ending → over.
 */
(function () {
  'use strict';

  var NS = window.ELECTROLISIS;
  var C = NS.CONFIG;
  var T = NS.TARGET;
  var S = NS.ATOM_INFO;
  var Scoring = window.ElectrolisisScoring;

  var COLORS = C.COLORS;
  var IMPACT_TINT = { correctRed: 'red', correctBlue: 'blue', wrong: 'magenta', miss: 'gray' };

  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[randInt(arr.length)]; }

  function Game(options) {
    options = options || {};
    this.onEvent = options.onEvent || function () {};
    this.onEnd = options.onEnd || function () {};
    this.reset();
  }

  Game.prototype.reset = function () {
    this.state = 'idle';
    this.time = 0;
    this.timeLeft = C.DURATION;
    this.elapsed = 0;

    this.color = C.START_COLOR;
    this.switchTimer = C.SWITCH_EVERY;
    this.colorFlash = 0;

    this.aimAngle = 0;
    this.aimPoint = { x: C.W / 2, y: 150 };
    this.pointerActive = false;

    this.stats = { shots: 0, hits: 0, wrong: 0, misses: 0 };
    this.atoms = [];
    this.shots = [];
    this.impacts = [];
    this.particles = [];
    this.floaters = [];

    this.fireCooldown = 0;
    this.spawnTimer = 0.35;
    this.endTimer = 0;
    this.shake = 0;
    this.muzzle = 0;
    this.kick = 0;
    this.lastResult = null;
    this.summary = null;

    this.seedAtoms();
  };

  /** Átomos iniciales para que la cámara nunca aparezca vacía. */
  Game.prototype.seedAtoms = function () {
    var counts = { O2: 0, H2: 0 };
    for (var i = 0; i < C.START_ATOMS; i += 1) {
      var type = i % 2 === 0 ? 'O2' : 'H2';
      counts[type] += 1;
      this.spawnAtom(type, true);
    }
  };

  Game.prototype.start = function () {
    this.reset();
    this.state = 'playing';
    this.onEvent('start', { color: this.color });
  };

  Game.prototype.aimAt = function (x, y) {
    var cfg = C.CANNON;
    var dx = x - cfg.x;
    var dy = y - cfg.y;
    var angle = Math.atan2(dx, -dy);
    if (angle > cfg.maxAim) angle = cfg.maxAim;
    if (angle < -cfg.maxAim) angle = -cfg.maxAim;
    this.aimAngle = angle;
    this.aimPoint.x = x;
    this.aimPoint.y = y;
  };

  Game.prototype.muzzlePoint = function () {
    var cfg = C.CANNON;
    return {
      x: cfg.x + Math.sin(this.aimAngle) * cfg.muzzleOffset,
      y: cfg.y - Math.cos(this.aimAngle) * cfg.muzzleOffset
    };
  };

  /** Dispara hacia un punto de la cámara. Devuelve true si el disparo salió. */
  Game.prototype.fireAt = function (x, y) {
    if (this.state !== 'playing' || this.fireCooldown > 0) return false;
    if (!isFinite(x) || !isFinite(y)) return false;

    this.aimAt(x, y);
    var muzzle = this.muzzlePoint();
    var dx = Math.sin(this.aimAngle);
    var dy = -Math.cos(this.aimAngle);

    var requested = Math.hypot(x - muzzle.x, y - muzzle.y);
    var distance = Math.max(70, Math.min(requested, C.W));

    this.shots.push({
      x: muzzle.x,
      y: muzzle.y,
      dx: dx,
      dy: dy,
      dist: 0,
      maxDist: distance,
      type: this.color,
      trail: [],
      age: 0
    });

    this.stats.shots += 1;
    this.fireCooldown = C.FIRE_COOLDOWN;
    this.muzzle = 0.16;
    this.kick = 1;
    this.onEvent('fire', { color: this.color });
    return true;
  };

  /** Cambia el color del cañón y avisa para la interfaz. */
  Game.prototype.switchColor = function () {
    this.color = this.color === 'red' ? 'blue' : 'red';
    this.switchTimer = C.SWITCH_EVERY;
    this.colorFlash = 1;
    this.onEvent('switch', { color: this.color });
  };

  Game.prototype.spawnAtom = function (forcedType, initial) {
    var type = forcedType;
    if (!type) {
      var o2 = 0;
      var h2 = 0;
      for (var i = 0; i < this.atoms.length; i += 1) {
        if (this.atoms[i].type === 'O2') o2 += 1; else h2 += 1;
      }
      if (o2 === 0 && this.atoms.length >= 2) type = 'O2';
      else if (h2 === 0 && this.atoms.length >= 2) type = 'H2';
      else type = Math.random() < 0.5 ? 'O2' : 'H2';
    }

    var b = C.BOUNDS;
    var margin = 58;
    var x = 0;
    var y = 0;
    var tries = 0;
    do {
      x = rand(b.left + margin, b.right - margin);
      y = rand(b.top + margin, b.bottom - margin);
      tries += 1;
    } while (tries < 14 && this.isCrowded(x, y));

    var speed = rand(C.ATOM_MIN_SPEED, C.ATOM_MAX_SPEED);
    var dir = rand(0, Math.PI * 2);
    // Evita movimientos casi verticales que amontonan átomos en los bordes.
    if (Math.abs(Math.cos(dir)) < 0.35) dir = rand(-0.5, 0.5) + (Math.random() < 0.5 ? 0 : Math.PI);

    var scale = rand(C.ATOM_MIN_SCALE, C.ATOM_MAX_SCALE);

    this.atoms.push({
      type: type,
      x: x,
      y: y,
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed,
      scale: scale,
      radius: C.ATOM_HIT_RADIUS,
      frame: randInt(4),
      rot: rand(-0.3, 0.3),
      spin: rand(-0.55, 0.55),
      phase: rand(0, Math.PI * 2),
      bob: rand(3, 8),
      flash: 0,
      age: initial ? rand(0, 2) : 0
    });
  };

  Game.prototype.isCrowded = function (x, y) {
    for (var i = 0; i < this.atoms.length; i += 1) {
      var a = this.atoms[i];
      var dx = a.x - x;
      var dy = a.y - y;
      if (dx * dx + dy * dy < 120 * 120) return true;
    }
    var cfg = C.CANNON;
    var mx = cfg.x - x;
    var my = cfg.y - y;
    return mx * mx + my * my < 150 * 150;
  };

  Game.prototype.atomAt = function (x, y, pad) {
    var limit = pad || 0;
    for (var i = 0; i < this.atoms.length; i += 1) {
      var a = this.atoms[i];
      var dx = a.x - x;
      var dy = a.y - y;
      var r = a.radius + limit;
      if (dx * dx + dy * dy <= r * r) return a;
    }
    return null;
  };

  Game.prototype.update = function (dt) {
    if (dt > 0.05) dt = 0.05;
    this.time += dt;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.kick = Math.max(0, this.kick - dt * 6);
    this.colorFlash = Math.max(0, this.colorFlash - dt * 2.4);
    this.shake = Math.max(0, this.shake - dt * 26);

    this.updateAtoms(dt);
    this.updateShots(dt);
    this.updateEffects(dt);

    if (this.state === 'playing') {
      this.elapsed += dt;
      this.timeLeft = Math.max(0, this.timeLeft - dt);

      this.switchTimer -= dt;
      if (this.switchTimer <= 0) this.switchColor();

      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.atoms.length < C.MAX_ATOMS) {
        this.spawnAtom();
        this.spawnTimer = C.SPAWN_INTERVAL * rand(0.78, 1.25);
      }

      if (this.timeLeft <= 0) {
        this.state = 'ending';
        this.endTimer = C.END_GRACE;
        this.onEvent('timeup');
      }
    } else if (this.state === 'ending') {
      this.endTimer -= dt;
      if (this.endTimer <= 0 || this.shots.length === 0) {
        this.finish();
      }
    }
  };

  Game.prototype.finish = function () {
    if (this.state === 'over') return;

    // Los disparos que sigan en vuelo al agotarse el margen cuentan como fallo.
    if (this.shots.length > 0) {
      this.stats.misses += this.shots.length;
      this.shots.length = 0;
    }

    this.state = 'over';
    this.summary = Scoring.summary(this.stats);
    this.onEvent('end', this.summary);
    this.onEnd(this.summary);
  };

  Game.prototype.updateAtoms = function (dt) {
    var b = C.BOUNDS;
    var i;
    var j;

    for (i = 0; i < this.atoms.length; i += 1) {
      var a = this.atoms[i];
      a.age += dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.spin * dt;
      a.flash = Math.max(0, a.flash - dt * 4.5);

      var pad = a.radius * 0.55;
      if (a.x < b.left + pad) { a.x = b.left + pad; a.vx = Math.abs(a.vx); }
      if (a.x > b.right - pad) { a.x = b.right - pad; a.vx = -Math.abs(a.vx); }
      if (a.y < b.top + pad) { a.y = b.top + pad; a.vy = Math.abs(a.vy); }
      if (a.y > b.bottom + 14 - pad) { a.y = b.bottom + 14 - pad; a.vy = -Math.abs(a.vy); }
    }

    // Separación suave para que los átomos no se solapen.
    for (i = 0; i < this.atoms.length; i += 1) {
      for (j = i + 1; j < this.atoms.length; j += 1) {
        var p = this.atoms[i];
        var q = this.atoms[j];
        var dx = q.x - p.x;
        var dy = q.y - p.y;
        var d2 = dx * dx + dy * dy;
        var min = 78;
        if (d2 > 0.01 && d2 < min * min) {
          var d = Math.sqrt(d2);
          var push = (min - d) * 0.5;
          var ux = dx / d;
          var uy = dy / d;
          p.x -= ux * push;
          p.y -= uy * push;
          q.x += ux * push;
          q.y += uy * push;
        }
      }
    }
  };

  Game.prototype.updateShots = function (dt) {
    var b = C.SHOT_BOUNDS;
    for (var s = this.shots.length - 1; s >= 0; s -= 1) {
      var shot = this.shots[s];
      shot.age += dt;

      var frameDist = C.SHOT_SPEED * dt;
      var steps = Math.max(1, Math.ceil(frameDist / 9));
      var step = frameDist / steps;
      var resolved = false;

      for (var k = 0; k < steps && !resolved; k += 1) {
        shot.x += shot.dx * step;
        shot.y += shot.dy * step;
        shot.dist += step;

        var atom = this.atomAt(shot.x, shot.y, C.SHOT_RADIUS);
        if (atom) {
          this.resolveHit(shot, atom);
          resolved = true;
          break;
        }

        var outside = shot.x < b.left - 20 || shot.x > b.right + 20 ||
          shot.y < b.top - 20 || shot.y > b.bottom + 26;
        if (shot.dist >= shot.maxDist || outside) {
          this.resolveMiss(shot);
          resolved = true;
          break;
        }
      }

      if (resolved) {
        this.shots.splice(s, 1);
        continue;
      }

      shot.trail.push({ x: shot.x, y: shot.y });
      if (shot.trail.length > 7) shot.trail.shift();

      if (shot.age > C.SHOT_LIFE) {
        this.resolveMiss(shot);
        this.shots.splice(s, 1);
      }
    }
  };

  Game.prototype.resolveHit = function (shot, atom) {
    var index = this.atoms.indexOf(atom);
    var correct = T[shot.type].atom === atom.type;

    if (correct) {
      if (index >= 0) this.atoms.splice(index, 1);
      this.stats.hits += 1;
      this.lastResult = 'hit';
      this.addImpact(atom.x, atom.y, shot.type === 'red' ? IMPACT_TINT.correctRed : IMPACT_TINT.correctBlue, 1.15);
      this.addParticles(atom.x, atom.y, S[atom.type].color, 12, 260);
      this.addFloater('+' + S[atom.type].label, atom.x, atom.y - 12, S[atom.type].color, 22);
      this.shake = Math.max(this.shake, 5);
      this.onEvent('hit', { type: atom.type, x: atom.x, y: atom.y });
    } else {
      atom.flash = 1;
      atom.vx += shot.dx * 150;
      atom.vy += shot.dy * 150;
      this.stats.wrong += 1;
      this.lastResult = 'wrong';
      this.addImpact(shot.x, shot.y, IMPACT_TINT.wrong, 1.0);
      this.addParticles(shot.x, shot.y, COLORS.red, 9, 240);
      this.addFloater('¡TIPO ERRADO!', shot.x, shot.y - 16, COLORS.red, 17);
      this.shake = Math.max(this.shake, 11);
      this.onEvent('wrong', { expected: T[shot.type].atom, got: atom.type });
    }

    // El átomo acertado reaparece tras un pequeño respiro.
    if (correct) this.spawnTimer = Math.min(this.spawnTimer, 0.55);
  };

  Game.prototype.resolveMiss = function (shot) {
    this.stats.misses += 1;
    this.lastResult = 'miss';
    this.addImpact(shot.x, shot.y, IMPACT_TINT.miss, 0.62, 'miss');
    this.addParticles(shot.x, shot.y, '#8fb8d8', 4, 120);
    this.shake = Math.max(this.shake, 1.6);
    this.onEvent('miss', { x: shot.x, y: shot.y });
  };

  Game.prototype.addImpact = function (x, y, tint, power, kind) {
    this.impacts.push({
      x: x,
      y: y,
      t: 0,
      dur: kind === 'miss' ? 0.26 : 0.34,
      power: power || 1,
      tint: tint || null,
      frame: randInt(5),
      rot: rand(0, Math.PI * 2),
      kind: kind || 'hit'
    });
  };

  Game.prototype.addParticles = function (x, y, color, count, speed) {
    for (var i = 0; i < count; i += 1) {
      var a = rand(0, Math.PI * 2);
      var v = rand(speed * 0.35, speed);
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 40,
        life: rand(0.28, 0.6),
        t: 0,
        size: rand(2, 4.5),
        color: color
      });
    }
  };

  Game.prototype.addFloater = function (text, x, y, color, size) {
    this.floaters.push({
      text: text,
      x: x,
      y: y,
      color: color || COLORS.cyan,
      size: size || 18,
      t: 0,
      dur: 0.85
    });
  };

  Game.prototype.updateEffects = function (dt) {
    var i;
    for (i = this.impacts.length - 1; i >= 0; i -= 1) {
      this.impacts[i].t += dt;
      if (this.impacts[i].t >= this.impacts[i].dur) this.impacts.splice(i, 1);
    }
    for (i = this.particles.length - 1; i >= 0; i -= 1) {
      var p = this.particles[i];
      p.t += dt;
      if (p.t >= p.life) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.vx *= 0.97;
    }
    for (i = this.floaters.length - 1; i >= 0; i -= 1) {
      var f = this.floaters[i];
      f.t += dt;
      f.y -= 34 * dt;
      if (f.t >= f.dur) this.floaters.splice(i, 1);
    }
  };

  /** Métricas en vivo (energía/agua) para los paneles laterales. */
  Game.prototype.liveMetrics = function () {
    var prec = Scoring.precision(this.stats.hits, this.stats.shots);
    var fails = this.stats.wrong + this.stats.misses;
    return {
      precision: prec,
      energyWh: Scoring.energy(this.stats.hits, prec),
      waterPct: Scoring.waterLost(fails, prec, this.stats.shots)
    };
  };

  NS.Game = Game;
})();
