/**
 * Arranque, entrada (ratón/tacto/teclado) y sincronización de la interfaz.
 */
(function () {
  'use strict';

  var NS = window.ELECTROLISIS;
  var C = NS.CONFIG;
  var T = NS.TARGET;
  var Scoring = window.ElectrolisisScoring;

  // Modo integración: se abre dentro de un iframe desde la estación de energía.
  var EMBED = /[?&]embed=1(?:&|$)/.test(window.location.search);

  function $(id) { return document.getElementById(id); }
  function fmtTime(seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    return '00:' + (s < 10 ? '0' : '') + s;
  }

  var el = {
    arena: $('arena'),
    loading: $('loading'),
    loadingFill: $('loading-fill'),
    loadingText: $('loading-text'),
    loadingError: $('loading-error'),
    start: $('start-screen'),
    startButton: $('start-button'),
    end: $('end-screen'),
    restartButton: $('restart-button'),
    time: $('hud-time'),
    timeFill: $('time-fill'),
    hits: $('hud-hits'),
    fails: $('hud-fails'),
    precision: $('hud-precision'),
    shots: $('hud-shots'),
    energyFill: $('energy-fill'),
    energyValue: $('energy-value'),
    waterFill: $('water-fill'),
    waterValue: $('water-value'),
    cannonName: $('cannon-name'),
    cannonTarget: $('cannon-target'),
    fireButton: $('fire-button'),
    mini: $('cannon-mini'),
    banner: $('color-banner'),
    status: $('status-line'),
    mute: $('mute-button'),
    arenaWrap: $('arena-wrap'),
    endHits: $('end-hits'),
    endFails: $('end-fails'),
    endPrecision: $('end-precision'),
    endEnergy: $('end-energy'),
    endWater: $('end-water'),
    endRank: $('end-rank'),
    endStars: $('end-stars'),
    endDetail: $('end-detail'),
    best: $('best-record'),
    embedExit: $('embed-exit'),
    returnButton: $('return-button')
  };

  var sfx = new NS.Sfx();
  var game = null;
  var renderer = null;
  var images = null;
  var assetsFailed = [];
  var lastFrame = 0;
  var bannerTimer = 0;
  var errorTimer = 0;
  var cached = {};
  var bestScore = readBest();
  var pointer = { x: C.W / 2, y: 160 };

  // ------------------------------------------------------------------------
  // Récord local (con protección para modo privado / file://).
  // ------------------------------------------------------------------------
  function readBest() {
    try {
      var raw = localStorage.getItem('electrolisis.best');
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch (e) { return 0; }
  }

  function saveBest(value) {
    try { localStorage.setItem('electrolisis.best', String(value)); } catch (e) { /* sin persistencia */ }
  }

  /** Avisa a la página que aloja el iframe (estación de energía). */
  function closeEmbed(summary) {
    var payload = { type: 'electrolisis:close' };
    var data = summary || (game && game.summary) || null;
    if (data) payload.summary = data;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    } catch (e) { /* sin padre: no hay nada que cerrar */ }
  }

  // ------------------------------------------------------------------------
  // Carga de recursos.
  // ------------------------------------------------------------------------
  NS.Assets.loadAll(function (done, total, label) {
    var pct = Math.round((done / total) * 100);
    el.loadingFill.style.width = pct + '%';
    el.loadingText.textContent = 'Cargando ' + label + '… ' + pct + '%';
  }).then(function (result) {
    images = result.images;
    assetsFailed = result.failed;

    // Estado inicial del botón de sonido según la preferencia guardada.
    el.mute.setAttribute('aria-pressed', String(sfx.muted));
    el.mute.textContent = sfx.muted ? 'SONIDO OFF' : 'SONIDO ON';
    el.mute.classList.toggle('is-off', sfx.muted);

    game = new NS.Game({
      onEvent: handleGameEvent,
      onEnd: handleGameEnd
    });
    renderer = new NS.Renderer(el.arena, images);
    setupMini();
    bindInput();
    updateHud(true);
    updateCannonInterface(true);

    el.loading.classList.add('is-hidden');
    if (EMBED) {
      // En modo integración la prueba arranca sola y se ofrece volver a la base.
      document.body.classList.add('is-embed');
      if (el.embedExit) el.embedExit.classList.remove('is-hidden');
      if (el.returnButton) el.returnButton.classList.remove('is-hidden');
      startRound();
    } else {
      el.start.classList.remove('is-hidden');
    }

    if (assetsFailed.length) {
      el.loadingError.textContent = 'No se pudieron cargar: ' + assetsFailed.join(', ') +
        '. Revisa que la carpeta electrolisis/ siga en assets/Sprites/.';
      el.loadingError.hidden = false;
    }

    lastFrame = performance.now();
    requestAnimationFrame(loop);

    // API de depuración para las comprobaciones automáticas.
    window.__ELECTROLISIS__ = {
      get game() { return game; },
      get renderer() { return renderer; },
      images: images,
      assetsFailed: assetsFailed,
      embed: EMBED,
      start: startRound,
      close: closeEmbed,
      fireAt: function (x, y) { return game.fireAt(x, y); },
      aimAt: function (x, y) { game.aimAt(x, y); },
      setTimeLeft: function (s) { game.timeLeft = s; },
      finish: function () { game.timeLeft = 0.01; },
      state: function () {
        return {
          state: game.state,
          timeLeft: game.timeLeft,
          color: game.color,
          stats: Object.assign({}, game.stats),
          atoms: game.atoms.length,
          shots: game.shots.length,
          summary: game.summary
        };
      }
    };
  });

  // ------------------------------------------------------------------------
  // Eventos del modelo → sonido / avisos visuales.
  // ------------------------------------------------------------------------
  function handleGameEvent(type, payload) {
    if (type === 'fire') {
      sfx.fire(payload.color);
    } else if (type === 'hit') {
      sfx.hit(game.color);
      flashArena('hit');
    } else if (type === 'wrong') {
      sfx.error();
      flashArena('error');
      announce('Tipo equivocado: ese átomo no corresponde al cañón ' + (game.color === 'red' ? 'rojo' : 'azul') + '.');
    } else if (type === 'miss') {
      sfx.miss();
    } else if (type === 'switch') {
      sfx.switchColor(payload.color);
      updateCannonInterface(true);
      showBanner(payload.color);
      announce('Cañón ' + (payload.color === 'red' ? 'rojo' : 'azul') + '. Objetivo: ' +
        T[payload.color].label + '.');
    } else if (type === 'timeup') {
      announce('Tiempo terminado. Calculando resultados.');
    }
  }

  function handleGameEnd(summary) {
    var isRecord = summary.energyWh > bestScore;
    if (isRecord) {
      bestScore = summary.energyWh;
      saveBest(bestScore);
    }

    el.endHits.textContent = summary.hits;
    el.endFails.textContent = summary.fails;
    el.endPrecision.textContent = summary.precision + ' %';
    el.endEnergy.textContent = summary.energyWh + ' Wh';
    el.endWater.textContent = summary.waterPct + ' %';
    el.endRank.textContent = summary.rank;

    el.endStars.textContent = '★★★'.slice(0, summary.stars) + '☆☆☆'.slice(0, 3 - summary.stars);
    el.endStars.dataset.stars = String(summary.stars);

    el.endDetail.textContent = summary.shots + ' disparos · ' +
      summary.hits + ' aciertos · ' + summary.wrong + ' de tipo erróneo · ' +
      summary.misses + ' sin objetivo';

    el.best.textContent = 'Récord de energía: ' + bestScore + ' Wh' +
      (isRecord ? ' · ¡nuevo récord!' : '');

    sfx.end(summary.precision >= 70 && summary.hits >= 8);

    setTimeout(function () {
      el.end.classList.remove('is-hidden');
      el.restartButton.focus({ preventScroll: true });
    }, 380);
  }

  function announce(text) {
    el.status.textContent = text;
  }

  function flashArena(kind) {
    el.arenaWrap.classList.remove('is-hit', 'is-error');
    // Reinicia la animación CSS.
    void el.arenaWrap.offsetWidth;
    el.arenaWrap.classList.add(kind === 'error' ? 'is-error' : 'is-hit');
    if (errorTimer) clearTimeout(errorTimer);
    errorTimer = setTimeout(function () {
      el.arenaWrap.classList.remove('is-hit', 'is-error');
    }, 260);
  }

  function showBanner(color) {
    el.banner.textContent = color === 'red' ? 'CAÑÓN ROJO · OBJETIVO O₂ ROJO' : 'CAÑÓN AZUL · OBJETIVO H₂ AZUL';
    el.banner.dataset.color = color;
    el.banner.classList.remove('show');
    void el.banner.offsetWidth;
    el.banner.classList.add('show');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { el.banner.classList.remove('show'); }, 1400);
  }

  // ------------------------------------------------------------------------
  // Entrada.
  // ------------------------------------------------------------------------
  function canvasPoint(evt) {
    var rect = el.arena.getBoundingClientRect();
    var x = ((evt.clientX - rect.left) / rect.width) * C.W;
    var y = ((evt.clientY - rect.top) / rect.height) * C.H;
    return { x: x, y: y };
  }

  function fire() {
    if (!game || game.state !== 'playing') return;
    game.fireAt(pointer.x, pointer.y);
  }

  function bindInput() {
    el.arena.addEventListener('pointermove', function (evt) {
      var p = canvasPoint(evt);
      pointer.x = p.x;
      pointer.y = p.y;
      game.pointerActive = true;
      game.aimAt(p.x, p.y);
    }, { passive: true });

    el.arena.addEventListener('pointerleave', function () {
      game.pointerActive = false;
    });

    el.arena.addEventListener('pointerdown', function (evt) {
      if (game.state !== 'playing') return;
      evt.preventDefault();
      var p = canvasPoint(evt);
      pointer.x = p.x;
      pointer.y = p.y;
      game.pointerActive = true;
      game.fireAt(p.x, p.y);
    });

    el.fireButton.addEventListener('click', function (evt) {
      evt.preventDefault();
      sfx.unlock();
      fire();
    });

    el.startButton.addEventListener('click', function () {
      sfx.unlock();
      startRound();
    });

    el.restartButton.addEventListener('click', function () {
      el.end.classList.add('is-hidden');
      startRound();
    });

    if (el.returnButton) {
      el.returnButton.addEventListener('click', function () {
        closeEmbed();
      });
    }

    if (el.embedExit) {
      el.embedExit.addEventListener('click', function () {
        closeEmbed();
      });
    }

    el.mute.addEventListener('click', function () {
      sfx.unlock();
      var muted = sfx.toggleMuted();
      el.mute.setAttribute('aria-pressed', String(muted));
      el.mute.textContent = muted ? 'SONIDO OFF' : 'SONIDO ON';
      el.mute.classList.toggle('is-off', muted);
    });

    document.addEventListener('keydown', function (evt) {
      if (EMBED && evt.key === 'Escape') {
        evt.preventDefault();
        closeEmbed();
        return;
      }

      if (evt.key === 'm' || evt.key === 'M') {
        if (el.mute) el.mute.click();
        return;
      }

      if (game.state !== 'playing') {
        if ((evt.key === 'Enter' || evt.key === ' ') && !el.start.classList.contains('is-hidden')) {
          evt.preventDefault();
          sfx.unlock();
          startRound();
        }
        return;
      }

      if (evt.key === ' ' || evt.key === 'Enter') {
        evt.preventDefault();
        sfx.unlock();
        fire();
      } else if (evt.key === 'ArrowLeft' || evt.key === 'ArrowRight') {
        evt.preventDefault();
        var step = evt.key === 'ArrowLeft' ? -0.06 : 0.06;
        game.aimAngle = Math.max(-C.CANNON.maxAim, Math.min(C.CANNON.maxAim, game.aimAngle + step));
        var muzzle = game.muzzlePoint();
        game.aimPoint.x = muzzle.x + Math.sin(game.aimAngle) * 260;
        game.aimPoint.y = muzzle.y - Math.cos(game.aimAngle) * 260;
        pointer.x = game.aimPoint.x;
        pointer.y = game.aimPoint.y;
        game.pointerActive = true;
      }
    });

    window.addEventListener('resize', function () {
      if (renderer) renderer.resize();
    });
  }

  function startRound() {
    el.end.classList.add('is-hidden');
    el.start.classList.add('is-hidden');
    el.banner.classList.remove('show');
    game.start();
    pointer.x = C.W / 2;
    pointer.y = 170;
    game.aimAt(pointer.x, pointer.y);
    updateCannonInterface(true);
    updateHud(true);
    showBanner(game.color);
    announce('Operación iniciada. Cañón ' + (game.color === 'red' ? 'rojo' : 'azul') +
      ': objetivo ' + T[game.color].label + '.');
    el.arena.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------------
  // Interfaz inferior: cañón en miniatura con las hojas de animación.
  // ------------------------------------------------------------------------
  var mini = { ctx: null, w: 150, h: 150 };

  function setupMini() {
    mini.ctx = el.mini.getContext('2d');
    el.mini.width = 300;
    el.mini.height = 300;
    mini.ctx.setTransform(2, 0, 0, 2, 0, 0);
  }

  function drawMini() {
    if (!mini.ctx || !game) return;
    var ctx = mini.ctx;
    var w = mini.w;
    var h = mini.h;
    var sheet = images[game.color === 'red' ? 'animRed' : 'animBlue'];
    var frames = NS.FRAMES[game.color === 'red' ? 'cannonRed' : 'cannonBlue'];
    var target = T[game.color];

    ctx.clearRect(0, 0, w, h);

    // Pantalla de la consola.
    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#04121f');
    bg.addColorStop(1, '#020a12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(90, 210, 255, 0.18)';
    ctx.lineWidth = 1;
    for (var y = 8; y < h; y += 10) {
      ctx.beginPath();
      ctx.moveTo(4, y + 0.5);
      ctx.lineTo(w - 4, y + 0.5);
      ctx.stroke();
    }

    var progress = game.muzzle > 0 ? 1 - game.muzzle / 0.16 : 0;
    var frameIndex = game.muzzle > 0 ? Math.min(frames.length - 1, Math.floor(progress * frames.length)) : 0;

    if (sheet && sheet.width) {
      var fr = frames[frameIndex];
      var scale = Math.min((w - 22) / fr.sw, (h - 30) / fr.sh);
      var dw = fr.sw * scale;
      var dh = fr.sh * scale;
      ctx.save();
      ctx.translate(w / 2, h / 2 + 6);
      ctx.drawImage(sheet, fr.sx, fr.sy, fr.sw, fr.sh, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }

    var glow = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * 0.42);
    glow.addColorStop(0, target.color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function updateCannonInterface(force) {
    var color = game ? game.color : C.START_COLOR;
    var target = T[color];
    var name = color === 'red' ? 'CAÑÓN ROJO' : 'CAÑÓN AZUL';
    if (force || cached.cannon !== color) {
      cached.cannon = color;
      el.cannonName.textContent = name;
      el.cannonTarget.textContent = 'OBJETIVO ' + target.label;
      el.cannonName.dataset.color = color;
      el.cannonTarget.dataset.color = color;
      el.fireButton.dataset.color = color;
      el.arenaWrap.dataset.color = color;
    }
  }

  // ------------------------------------------------------------------------
  // Sincronización del HUD.
  // ------------------------------------------------------------------------
  function setText(node, key, value) {
    if (cached[key] === value) return;
    cached[key] = value;
    node.textContent = value;
  }

  function updateHud(force) {
    if (!game) return;

    var timeText = fmtTime(game.timeLeft);
    setText(el.time, 'time', timeText);

    var timePct = Math.max(0, Math.min(100, (game.timeLeft / C.DURATION) * 100));
    el.timeFill.style.width = timePct.toFixed(2) + '%';
    el.time.parentElement.classList.toggle('is-low', game.state === 'playing' && game.timeLeft <= 5);

    var fails = game.stats.wrong + game.stats.misses;
    var metrics = game.liveMetrics();

    setText(el.hits, 'hits', String(game.stats.hits));
    setText(el.fails, 'fails', String(fails));
    setText(el.precision, 'precision', metrics.precision + '%');
    setText(el.shots, 'shots', String(game.stats.shots));

    setText(el.energyValue, 'energy', metrics.energyWh + ' Wh');
    setText(el.waterValue, 'water', metrics.waterPct + ' %');
    var energyFillPct = Math.min(100, metrics.energyWh);
    el.energyFill.style.setProperty('--fill', energyFillPct + '%');
    el.waterFill.style.setProperty('--fill', metrics.waterPct + '%');
    el.energyFill.style.height = energyFillPct + '%';
    el.waterFill.style.height = Math.min(100, metrics.waterPct) + '%';

    updateCannonInterface(force);
  }

  // ------------------------------------------------------------------------
  // Bucle principal.
  // ------------------------------------------------------------------------
  function loop(now) {
    var dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
    if (dt > 0.05) dt = 0.05;

    game.update(dt);
    renderer.draw(game);
    drawMini();
    updateHud(false);

    requestAnimationFrame(loop);
  }

  // Refresco del HUD cada frame es barato gracias a la caché de texto,
  // pero las barras laterales se actualizan con valores ya calculados.
  // `Scoring` queda expuesto para las pruebas de puntuación.
  NS.scoring = Scoring;
})();
