/**
 * Render del minijuego sobre Canvas 2D.
 * Usa exclusivamente los PNG originales de electrolisis/ (sin copiarlos).
 */
(function () {
  'use strict';

  var NS = window.ELECTROLISIS;
  var C = NS.CONFIG;
  var F = NS.FRAMES;
  var T = NS.TARGET;
  var S = NS.ATOM_INFO;
  var COLORS = C.COLORS;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /**
   * Genera una versión tintada del sprite en memoria (los PNG no se tocan).
   * El filtro corrige el tono; la capa `hard-light` opcional fija el color
   * final para que el O₂ quede rojo y no naranja.
   */
  function tinted(img, hue, saturate, overlay, overlayAlpha) {
    if (!img || !img.width) return img;
    var canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    var ctx = canvas.getContext('2d');
    try {
      ctx.filter = 'hue-rotate(' + hue + 'deg) saturate(' + (saturate || 1.15) + ')';
    } catch (e) { /* filtro no soportado: se usa el original */ }
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';

    if (overlay) {
      ctx.globalCompositeOperation = 'hard-light';
      ctx.globalAlpha = overlayAlpha || 0.45;
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // hard-light cubre todo el lienzo: se recupera el alfa original.
      ctx.globalCompositeOperation = 'destination-in';
      ctx.globalAlpha = 1;
      ctx.drawImage(img, 0, 0);
    }
    return canvas;
  }

  function Renderer(canvas, images) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = images;
    this.dpr = 1;
    this.tints = {
      // Los PNG originales no se modifican: se tiñen en memoria.
      // O₂: naranja -> rojo · H₂: rojo -> azul.
      atomsO2: tinted(images.o2, -26, 3, '#ff2030', 0.45),
      atomsH2: tinted(images.h2, 200, 1.3),
      shotsRed: tinted(images.shots, -26, 3, '#ff2030', 0.45),
      shotsBlue: tinted(images.shots, 200, 1.3),
      impactsRed: tinted(images.shots, -26, 3, '#ff2030', 0.4),
      impactsBlue: tinted(images.shots, 200, 1.25),
      impactsMagenta: tinted(images.shots, 300, 1.25),
      impactsGray: tinted(images.shots, 0, 0.25)
    };
    this.resize();
  }

  Renderer.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.canvas.width = Math.round(C.W * dpr);
    this.canvas.height = Math.round(C.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Renderer.prototype.draw = function (game) {
    var ctx = this.ctx;
    var t = game.time;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, C.W, C.H);
    ctx.save();

    if (game.shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    }

    this.drawBackground(ctx, t);
    this.drawAimGuide(ctx, game);
    this.drawAtoms(ctx, game, t);
    this.drawShots(ctx, game);
    this.drawImpacts(ctx, game);
    this.drawParticles(ctx, game);
    this.drawCannon(ctx, game, t);
    this.drawReticle(ctx, game, t);
    this.drawFloaters(ctx, game);
    this.drawColorFlash(ctx, game);

    ctx.restore();
  };

  Renderer.prototype.drawBackground = function (ctx, t) {
    var img = this.images.bg;
    if (img && img.width) {
      var scale = Math.max(C.W / img.width, C.H / img.height);
      var dw = img.width * scale;
      var dh = img.height * scale;
      ctx.drawImage(img, (C.W - dw) / 2, (C.H - dh) / 2, dw, dh);
    } else {
      var fallback = ctx.createLinearGradient(0, 0, 0, C.H);
      fallback.addColorStop(0, '#0a1a33');
      fallback.addColorStop(1, '#02060d');
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, C.W, C.H);
    }

    // Reflejo de cristal de la cámara.
    var glass = ctx.createLinearGradient(0, 0, C.W, C.H);
    glass.addColorStop(0, 'rgba(150, 230, 255, 0.07)');
    glass.addColorStop(0.28, 'rgba(150, 230, 255, 0.015)');
    glass.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
    glass.addColorStop(1, 'rgba(255, 140, 60, 0.03)');
    ctx.fillStyle = glass;
    ctx.fillRect(0, 0, C.W, C.H);

    // Viñeta para concentrar la atención en los átomos.
    var vign = ctx.createRadialGradient(C.W / 2, C.H * 0.42, C.H * 0.28, C.W / 2, C.H * 0.45, C.H * 0.82);
    vign.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vign.addColorStop(1, 'rgba(0, 4, 12, 0.62)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, C.W, C.H);

    // Línea de energía pulsante en el borde superior de la cámara.
    var pulse = 0.18 + 0.12 * Math.sin(t * 2.2);
    var top = ctx.createLinearGradient(0, 0, C.W, 0);
    top.addColorStop(0, 'rgba(80, 220, 255, 0)');
    top.addColorStop(0.5, 'rgba(80, 220, 255, ' + pulse.toFixed(3) + ')');
    top.addColorStop(1, 'rgba(80, 220, 255, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 16, C.W, 2);
  };

  Renderer.prototype.drawAimGuide = function (ctx, game) {
    if (game.state !== 'playing' || !game.pointerActive) return;
    var muzzle = game.muzzlePoint();
    var target = T[game.color];
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = target.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 9]);
    ctx.beginPath();
    ctx.moveTo(muzzle.x, muzzle.y);
    ctx.lineTo(game.aimPoint.x, game.aimPoint.y);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawAtoms = function (ctx, game, t) {
    for (var i = 0; i < game.atoms.length; i += 1) {
      var a = game.atoms[i];
      var info = S[a.type];
      var frames = F[a.type === 'O2' ? 'o2' : 'h2'];
      var fr = frames[a.frame % frames.length];
      var img = a.type === 'O2' ? this.tints.atomsO2 : this.tints.atomsH2;
      if (!img || !img.width) continue;

      var bob = Math.sin(t * 1.7 + a.phase) * a.bob;
      var drawX = a.x;
      var drawY = a.y + bob;
      var dw = fr.sw * a.scale;
      var dh = fr.sh * a.scale;

      // Halo suave del color del átomo.
      var glowR = 52 * (a.scale / 0.45);
      var glow = ctx.createRadialGradient(drawX, drawY, 2, drawX, drawY, glowR);
      glow.addColorStop(0, info.glow);
      glow.addColorStop(0.45, info.glow.replace(/0\.\d+\)/, '0.16)'));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(drawX, drawY, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(a.rot);
      ctx.drawImage(img, fr.sx, fr.sy, fr.sw, fr.sh, -dw / 2, -dh / 2, dw, dh);

      if (a.flash > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a.flash * 0.85;
        ctx.drawImage(img, fr.sx, fr.sy, fr.sw, fr.sh, -dw / 2, -dh / 2, dw, dh);
      }
      ctx.restore();
    }
  };

  Renderer.prototype.drawShots = function (ctx, game) {
    for (var i = 0; i < game.shots.length; i += 1) {
      var s = game.shots[i];
      var color = s.type === 'red' ? COLORS.red : COLORS.blue;
      var tintedSheet = s.type === 'red' ? this.tints.shotsRed : this.tints.shotsBlue;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Estela.
      if (s.trail.length > 1) {
        for (var k = 0; k < s.trail.length; k += 1) {
          var p = s.trail[k];
          var alpha = (k + 1) / s.trail.length;
          ctx.globalAlpha = alpha * 0.4;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 + alpha * 6;
          ctx.lineCap = 'round';
          if (k === 0) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
          } else {
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.stroke();
      }

      // Núcleo luminoso.
      var glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 26);
      glow.addColorStop(0, 'rgba(255,255,255,0.85)');
      glow.addColorStop(0.35, color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 26, 0, Math.PI * 2);
      ctx.fill();

      // Sprite del proyectil teñido según el cañón (rojo o azul).
      var fr = F.shots[0];
      var size = 34;
      var ratio = fr.sw / fr.sh;
      var dw = size * ratio;
      var dh = size;
      ctx.globalAlpha = 1;
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.atan2(s.dy, s.dx) + Math.PI / 2);
      if (tintedSheet && tintedSheet.width) {
        ctx.drawImage(tintedSheet, fr.sx, fr.sy, fr.sw, fr.sh, -dw / 2, -dh / 2, dw, dh);
      }
      ctx.restore();
    }
  };

  Renderer.prototype.drawImpacts = function (ctx, game) {
    for (var i = 0; i < game.impacts.length; i += 1) {
      var e = game.impacts[i];
      var p = clamp(e.t / e.dur, 0, 1);
      var alpha = 1 - p;
      var fr = F.impacts[e.frame % F.impacts.length];
      var sheet = this.images.shots;
      if (e.tint === 'red') sheet = this.tints.impactsRed;
      else if (e.tint === 'blue') sheet = this.tints.impactsBlue;
      else if (e.tint === 'magenta') sheet = this.tints.impactsMagenta;
      else if (e.kind === 'miss' || e.tint === 'gray') sheet = this.tints.impactsGray;
      if (!sheet || !sheet.width) continue;

      var scale = (0.32 + 0.72 * easeOut(p)) * e.power;
      var dw = fr.sw * scale;
      var dh = fr.sh * scale;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;

      // Onda expansiva.
      var ring = 'rgba(140,240,255,0.85)';
      if (e.kind === 'miss') ring = 'rgba(150,190,220,0.7)';
      else if (e.tint === 'red') ring = 'rgba(255,90,110,0.9)';
      else if (e.tint === 'magenta') ring = 'rgba(255,90,210,0.9)';
      ctx.strokeStyle = ring;
      ctx.lineWidth = 2.5 * (1 - p) + 0.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 16 + 58 * easeOut(p), 0, Math.PI * 2);
      ctx.stroke();

      ctx.translate(e.x, e.y);
      ctx.rotate(e.rot + p * 0.4);
      ctx.drawImage(sheet, fr.sx, fr.sy, fr.sw, fr.sh, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();

      // Destello inicial blanco.
      if (p < 0.18) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - p / 0.18) * 0.9;
        var flash = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 34 * e.power);
        flash.addColorStop(0, 'rgba(255,255,255,0.95)');
        flash.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 34 * e.power, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  };

  Renderer.prototype.drawParticles = function (ctx, game) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < game.particles.length; i += 1) {
      var p = game.particles[i];
      var alpha = 1 - p.t / p.life;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  Renderer.prototype.drawCannon = function (ctx, game, t) {
    var img = this.images[game.color === 'red' ? 'cannonRed' : 'cannonBlue'];
    var cfg = C.CANNON;
    var s = cfg.scale;
    var target = T[game.color];

    // Sombra/base luminosa.
    var baseGlow = ctx.createRadialGradient(cfg.x, cfg.y + 6, 4, cfg.x, cfg.y + 6, 116);
    baseGlow.addColorStop(0, game.color === 'red' ? 'rgba(255,90,60,0.24)' : 'rgba(80,210,255,0.24)');
    baseGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = baseGlow;
    ctx.beginPath();
    ctx.arc(cfg.x, cfg.y + 6, 116, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cfg.x, cfg.y);
    ctx.rotate(game.aimAngle);
    ctx.translate(0, game.kick * 7);

    if (img && img.width) {
      var dw = img.width * s;
      var dh = img.height * s;
      ctx.drawImage(img, -dw / 2, -dh * cfg.pivotFraction, dw, dh);
    }

    // Boca del cañón: halo que respira con el color activo.
    var mx = 0;
    var my = -cfg.muzzleOffset;
    var breathe = 0.32 + 0.12 * Math.sin(t * 4.5);
    var muzzleGlow = ctx.createRadialGradient(mx, my, 2, mx, my, 34);
    muzzleGlow.addColorStop(0, target.color);
    muzzleGlow.addColorStop(0.28, game.color === 'red' ? 'rgba(255,70,90,0.5)' : 'rgba(80,220,255,0.5)');
    muzzleGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = breathe;
    ctx.fillStyle = muzzleGlow;
    ctx.beginPath();
    ctx.arc(mx, my, 34, 0, Math.PI * 2);
    ctx.fill();

    // Fogonazo del disparo.
    if (game.muzzle > 0) {
      var m = game.muzzle / 0.16;
      ctx.globalAlpha = m;
      var flash = ctx.createRadialGradient(mx, my - 6, 0, mx, my - 6, 52 * m);
      flash.addColorStop(0, 'rgba(255,255,255,0.95)');
      flash.addColorStop(0.35, target.color);
      flash.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(mx, my - 6, 52 * m, 0, Math.PI * 2);
      ctx.fill();

      // Reutiliza un recorte de impacto como chispa de boca.
      var fr = F.impacts[4];
      var sheet = this.images.shots;
      if (sheet && sheet.width) {
        var size = 90 * (0.5 + 0.8 * (1 - m));
        ctx.globalAlpha = m * 0.9;
        ctx.drawImage(sheet, fr.sx, fr.sy, fr.sw, fr.sh, mx - size / 2, my - size / 2 - 4, size, size);
      }
    }
    ctx.restore();

    // Anillo de estado en la base (LED).
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3);
    ctx.strokeStyle = target.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cfg.x, cfg.y + 14, 74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawReticle = function (ctx, game, t) {
    if (game.state !== 'playing') return;
    var p = game.aimPoint;
    var color = T[game.color].color;
    var inside = p.x > 8 && p.x < C.W - 8 && p.y > 8 && p.y < C.H - 8;
    if (!inside) return;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(0, 0, 23, t * 1.4, t * 1.4 + Math.PI * 1.25);
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    var tick = 5;
    for (var i = 0; i < 4; i += 1) {
      var a = (Math.PI / 2) * i + t * 0.6;
      var x1 = Math.cos(a) * 24;
      var y1 = Math.sin(a) * 24;
      var x2 = Math.cos(a) * 30;
      var y2 = Math.sin(a) * 30;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  Renderer.prototype.drawFloaters = function (ctx, game) {
    for (var i = 0; i < game.floaters.length; i += 1) {
      var f = game.floaters[i];
      var alpha = 1 - f.t / f.dur;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.font = '800 ' + f.size + "px 'Consolas', 'Courier New', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(2, 8, 16, 0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  };

  Renderer.prototype.drawColorFlash = function (ctx, game) {
    if (game.colorFlash <= 0) return;
    var color = game.color === 'red' ? '255, 70, 90' : '80, 220, 255';
    ctx.fillStyle = 'rgba(' + color + ',' + (game.colorFlash * 0.09).toFixed(3) + ')';
    ctx.fillRect(0, 0, C.W, C.H);
  };

  NS.Renderer = Renderer;
})();
