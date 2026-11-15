(() => {
  'use strict';

  const MODES = {
    tortuga:   { label: 'Modo Tortuga',   color: '#22c55e', escudo: 7, motor: 1, radar: 2, game: 'secuencia' },
    explorador:{ label: 'Modo Explorador', color: '#38bdf8', escudo: 2, motor: 2, radar: 6, game: 'frecuencia' },
    turbo:     { label: 'Modo Turbo',      color: '#f97316', escudo: 1, motor: 8, radar: 1, game: 'tuberias' }
  };
  const DESCS = {
    secuencia: 'Observa la secuencia de luces y repítela en el mismo orden.',
    frecuencia: 'Mueve los controles hasta que la onda azul coincida con la verde y mantenla 1 segundo.',
    tuberias: 'Haz clic en las tuberías para girarlas y conecta el reactor con el propulsor.'
  };

  const state = {
    activeMode: null,
    calibrated: { tortuga: false, explorador: false, turbo: false }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const statusText = $('#statusText');
  const modal = $('#modal');
  const modalTitle = $('#modalTitle');
  const modalDesc = $('#modalDesc');
  const modalBody = $('#modalBody');
  const modalFoot = $('#modalFoot');
  const toast = $('#toast');
  let toastTimer = null;
  let cleanupGame = null;

  function init() {
    $$('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => onModeClick(btn.dataset.mode));
    });
    $('#modalClose').addEventListener('click', closeModal);
    $('#btn-recalibrar').addEventListener('click', recalibrar);
    initBars();
    renderBars(null, false);
  }

  function onModeClick(mode) {
    if (!state.calibrated[mode]) {
      openMinigame(mode);
      return;
    }
    activarModo(mode, false);
  }

  function activarModo(mode, powerOn = false) {
    state.activeMode = mode;
    $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    renderBars(mode, true, powerOn);
    statusText.textContent = `${MODES[mode].label} activo`;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'energyModeChanged', mode: mode }, '*');
      }
    } catch (e) {}
  }

  const barState = { escudo: 0, motor: 0, radar: 0 };
  const numberAnims = new WeakMap();

  function initBars() {
    const colorMap = { escudo: '#22c55e', motor: '#f97316', radar: '#38bdf8' };
    for (const key of ['escudo', 'motor', 'radar']) {
      const box = $(`#bar-${key}`);
      box.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const slot = document.createElement('div');
        slot.className = 'block-slot';
        slot.style.setProperty('--i', i);
        slot.style.setProperty('--fill', colorMap[key]);
        slot.style.setProperty('--display-fill', colorMap[key]);
        slot.innerHTML = '' +
          '<img class="block empty" src="assets/ui_energia/bloque_energia_vacio.png" alt="">' +
          '<img class="block filled" src="assets/ui_energia/bloque_energia_lleno.png" alt="">' +
          '<div class="block tint" aria-hidden="true"></div>';
        box.appendChild(slot);
      }
      const valEl = $(`#val-${key}`);
      if (valEl) valEl.dataset.value = '0';
    }
  }

  function animateValue(el, to) {
    const from = +(el.dataset.value || el.textContent || 0);
    if (from === to) { el.textContent = to; el.dataset.value = to; return; }
    const prev = numberAnims.get(el);
    if (prev) cancelAnimationFrame(prev);
    const start = performance.now();
    const dur = 420;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (to - from) * e);
      el.textContent = v;
      if (t < 1) numberAnims.set(el, requestAnimationFrame(step));
      else { el.dataset.value = to; numberAnims.delete(el); }
    };
    numberAnims.set(el, requestAnimationFrame(step));
  }

  function renderBars(mode, animate = true, powerOn = false) {
    const cfg = mode ? MODES[mode] : null;
    const vals = {
      escudo: cfg ? cfg.escudo : 0,
      motor:  cfg ? cfg.motor  : 0,
      radar:  cfg ? cfg.radar  : 0
    };
    const flash = '#ffffff';
    animateValue($('#val-escudo'), vals.escudo);
    animateValue($('#val-motor'), vals.motor);
    animateValue($('#val-radar'), vals.radar);

    const energyEl = document.querySelector('.energy');
    if (powerOn) {
      energyEl.classList.add('power-on');
      clearTimeout(energyEl._powerTimer);
    }

    for (const key of ['escudo', 'motor', 'radar']) {
      const box = $(`#bar-${key}`);
      const slots = $$('.block-slot', box);
      const prev = barState[key] || 0;
      const next = vals[key];
      const filling = next > prev;
      slots.forEach((slot, i) => {
        const on = i < next;
        let delay = 0;
        if (animate) {
          if (filling && on && i >= prev) delay = (i - prev) * 55;
          else if (!filling && !on && i < prev) delay = (prev - 1 - i) * 45;
        }
        slot.style.setProperty('--delay', delay + 'ms');
        slot.classList.toggle('on', on);
        slot.classList.toggle('just-on', animate && filling && on && i >= prev);
        slot.classList.toggle('just-off', animate && !filling && !on && i < prev);

        if (powerOn && on) {
          slot.style.setProperty('--display-fill', flash);
          const settle = 420 + delay + 220;
          clearTimeout(slot._flashTimer);
          slot._flashTimer = setTimeout(() => {
            slot.style.setProperty('--display-fill', 'var(--fill)');
          }, settle);
        } else if (!on) {
          clearTimeout(slot._flashTimer);
          slot.style.removeProperty('--display-fill');
        } else if (!powerOn) {
          clearTimeout(slot._flashTimer);
          slot.style.setProperty('--display-fill', 'var(--fill)');
        }
      });
      barState[key] = next;
    }

    if (powerOn) {
      energyEl._powerTimer = setTimeout(() => energyEl.classList.remove('power-on'), 1400);
    } else if (energyEl) {
      energyEl.classList.remove('power-on');
    }
  }

  function openMinigame(mode) {
    const game = MODES[mode].game;
    modalTitle.textContent = `Calibración: ${MODES[mode].label}`;
    modalDesc.textContent = DESCS[game];
    modalBody.innerHTML = '';
    modalFoot.textContent = '';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    const onDone = () => {
      state.calibrated[mode] = true;
      $(`#btn-${mode}`).classList.add('calibrated');
      showToast(`${MODES[mode].label} calibrado`);
      setTimeout(() => { closeModal(); activarModo(mode, true); }, 650);
    };

    if (game === 'frecuencia') cleanupGame = startFrecuencia(modalBody, modalFoot, onDone);
    else if (game === 'tuberias') cleanupGame = startTuberias(modalBody, modalFoot, onDone);
    else cleanupGame = startSecuencia(modalBody, modalFoot, onDone);
  }

  function closeModal() {
    if (cleanupGame) { cleanupGame(); cleanupGame = null; }
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    modalBody.innerHTML = '';
    modalFoot.textContent = '';
  }

  function recalibrar() {
    state.calibrated = { tortuga: false, explorador: false, turbo: false };
    state.activeMode = null;
    $$('.mode-btn').forEach(b => { b.classList.remove('calibrated', 'active'); });
    renderBars(null, true);
    statusText.textContent = 'Sistemas descalibrados. Elige un modo para calibrar.';
    showToast('Sistemas descalibrados');
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  // ---------- FRECUENCIA ----------
  function startFrecuencia(root, foot, onDone) {
    root.innerHTML = `
      <div class="freq-wrap">
        <div class="oscilloscope">
          <img class="screen-bg" src="assets/minijuegos/frecuencia/fondo_osciloscopio.png" alt="">
          <canvas id="scopeCanvas" width="508" height="168"></canvas>
          <img class="frame" src="assets/minijuegos/frecuencia/marco_osciloscopio.png" alt="">
          <img class="led led-l" id="ledLock" src="assets/minijuegos/frecuencia/led_apagado.png" alt="Bloqueo">
          <img class="led led-r" id="ledOk" src="assets/minijuegos/frecuencia/led_apagado.png" alt="Sintonía">
        </div>
        <div class="freq-controls">
          <div class="ctrl">
            <label><img src="assets/minijuegos/frecuencia/icono_onda.png" alt=""> Frecuencia <output id="outFreq">50</output></label>
            <input id="sFreq" type="range" min="10" max="90" value="50">
          </div>
          <div class="ctrl">
            <label><img src="assets/minijuegos/frecuencia/icono_onda.png" alt=""> Altura <output id="outAmp">50</output></label>
            <input id="sAmp" type="range" min="10" max="90" value="50">
          </div>
        </div>
        <div class="hold-meter" aria-label="Sintonía mantenida"><div class="hold-fill" id="holdFill"></div></div>
      </div>`;
    foot.textContent = 'Haz coincidir las ondas y mantén la sintonía.';

    const canvas = $('#scopeCanvas', root);
    const ctx = canvas.getContext('2d');
    const sFreq = $('#sFreq', root), sAmp = $('#sAmp', root);
    const outFreq = $('#outFreq', root), outAmp = $('#outAmp', root);
    const ledLock = $('#ledLock', root), ledOk = $('#ledOk', root);
    const holdFill = $('#holdFill', root);

    const target = { f: randInt(20, 80), a: randInt(25, 75) };
    // ensure not already equal
    let pf = +sFreq.value, pa = +sAmp.value;
    if (Math.abs(pf - target.f) < 12) sFreq.value = pf = target.f > 50 ? 15 : 85;
    if (Math.abs(pa - target.a) < 12) sAmp.value = pa = target.a > 50 ? 15 : 85;

    let t = 0, hold = 0, done = false, last = performance.now(), raf = 0;

    function drawWave(freq, amp, color, width, phaseShift = 0) {
      const w = canvas.width, h = canvas.height, mid = h / 2;
      const cycles = 1.2 + (freq / 100) * 3.2;
      const amplitude = 12 + (amp / 100) * 52;
      ctx.beginPath();
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      for (let x = 0; x <= w; x++) {
        const y = mid + Math.sin((x / w) * Math.PI * 2 * cycles + t * 2.2 + phaseShift) * amplitude;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      pf = +sFreq.value; pa = +sAmp.value;
      outFreq.textContent = pf; outAmp.textContent = pa;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawWave(target.f, target.a, 'rgba(34,197,94,0.95)', 3, 0);
      drawWave(pf, pa, 'rgba(56,189,248,0.95)', 3, 0.6);

      const close = Math.abs(pf - target.f) <= 6 && Math.abs(pa - target.a) <= 6;
      if (close) hold += dt; else hold = Math.max(0, hold - dt * 1.8);
      const pct = Math.min(1, hold / 1.0);
      holdFill.style.width = (pct * 100) + '%';
      ledLock.src = close ? 'assets/minijuegos/frecuencia/led_encendido.png' : 'assets/minijuegos/frecuencia/led_apagado.png';
      ledOk.src = pct >= 1 ? 'assets/minijuegos/frecuencia/led_encendido.png' : 'assets/minijuegos/frecuencia/led_apagado.png';
      foot.textContent = pct >= 1 ? '¡Frecuencia sincronizada!' : (close ? 'Mantén la sintonía…' : 'Ajusta frecuencia y altura hasta que coincidan.');

      if (!done && pct >= 1) { done = true; onDone(); }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }

  // ---------- TUBERIAS ----------
  function startTuberias(root, foot, onDone) {
    root.innerHTML = `<div class="pipes-wrap"><div class="board" id="board"></div><div class="pipes-hint">Haz clic para girar las piezas.</div></div>`;
    foot.textContent = 'Conecta el reactor (inicio) con el propulsor (fin).';
    const board = $('#board', root);

    // Grid 3x3, (r,c). (0,0) start, (2,2) end.
    const layout = [
      [{type:'start',rot:0}, {type:'straight',rot:0}, {type:'elbow',rot:0}],
      [{type:'elbow',rot:0},  {type:'straight',rot:0}, {type:'elbow',rot:0}],
      [{type:'elbow',rot:0},  {type:'straight',rot:0}, {type:'end',rot:0}]
    ];
    // Scramble rotatable tiles
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const t = layout[r][c];
      if (t.type !== 'start' && t.type !== 'end') t.rot = randInt(0, 3) * 90;
    }
    // ensure not already solved
    for (let tries = 0; tries < 5 && isSolved(layout); tries++) {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const t = layout[r][c]; if (t.type !== 'start' && t.type !== 'end') t.rot = (t.rot + 90) % 360;
      }
    }

    let done = false;
    const imgs = [];

    function render() {
      board.innerHTML = '';
      imgs.length = 0;
      const active = flowActive(layout);
      if (!done && active.won) { done = true; foot.textContent = '¡Circuito conectado!'; onDone(); }
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const t = layout[r][c];
        const tile = document.createElement('div');
        tile.className = 'tile' + (t.type === 'start' || t.type === 'end' ? ' fixed' : '');
        tile.style.left = (c * 140 + 10) + 'px';
        tile.style.top  = (r * 140 + 10) + 'px';
        const img = document.createElement('img');
        img.alt = '';
        const on = active.cells.has(`${r},${c}`);
        img.src = tileSrc(t, on);
        img.style.transform = `rotate(${t.rot}deg)`;
        tile.appendChild(img);
        if (t.type !== 'start' && t.type !== 'end') {
          tile.addEventListener('click', () => {
            if (done) return;
            t.rot = (t.rot + 90) % 360;
            render();
          });
        }
        board.appendChild(tile);
        imgs.push(img);
      }
      if (!done) foot.textContent = active.cells.size > 2 ? 'Buen camino… sigue conectando.' : 'Conecta el reactor (inicio) con el propulsor (fin).';
    }

    render();
    return () => {};
  }

  function tileSrc(t, active) {
    if (t.type === 'start') return 'assets/minijuegos/tuberias/nodo_reactor_inicio.png';
    if (t.type === 'end') return 'assets/minijuegos/tuberias/nodo_propulsor_fin.png';
    if (t.type === 'straight') return active ? 'assets/minijuegos/tuberias/tubo_recto_activo.png' : 'assets/minijuegos/tuberias/tubo_recto_apagado.png';
    return active ? 'assets/minijuegos/tuberias/tubo_codo_activo.png' : 'assets/minijuegos/tuberias/tubo_codo_apagado.png';
  }

  function connections(t) {
    // base: straight left-right, elbow up-right
    let dirs;
    if (t.type === 'straight') dirs = ['L', 'R'];
    else if (t.type === 'elbow') dirs = ['U', 'R'];
    else if (t.type === 'start') dirs = ['R', 'D'];
    else if (t.type === 'end') dirs = ['L', 'U'];
    else dirs = [];
    const steps = ((t.rot % 360) + 360) % 360 / 90;
    const order = ['U', 'R', 'D', 'L'];
    return dirs.map(d => order[(order.indexOf(d) + steps) % 4]);
  }

  function flowActive(layout) {
    const active = new Set();
    const q = [[0, 0]];
    const seen = new Set(['0,0']);
    const opp = { U: 'D', D: 'U', L: 'R', R: 'L' };
    const delta = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
    while (q.length) {
      const [r, c] = q.shift();
      active.add(`${r},${c}`);
      for (const d of connections(layout[r][c])) {
        const [dr, dc] = delta[d];
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
        const key = `${nr},${nc}`;
        if (seen.has(key)) continue;
        if (connections(layout[nr][nc]).includes(opp[d])) { seen.add(key); q.push([nr, nc]); }
      }
    }
    return { cells: active, won: active.has('2,2') };
  }
  function isSolved(layout) { return flowActive(layout).won; }

  // ---------- SECUENCIA ----------
  function startSecuencia(root, foot, onDone) {
    root.innerHTML = `
      <div class="seq-wrap">
        <div class="seq-panel" id="seqPanel"></div>
        <div class="seq-dots" id="seqDots"></div>
        <div class="seq-hint" id="seqHint">Observa la secuencia…</div>
      </div>`;
    foot.textContent = 'Repite los 4 símbolos en orden.';

    const panel = $('#seqPanel', root);
    const dotsBox = $('#seqDots', root);
    const hint = $('#seqHint', root);
    const names = ['escudo', 'rayo', 'estrella', 'planeta'];
    const positions = [ [80,36], [260,36], [80,188], [260,188] ];
    const btns = [];
    let sequence = names.map(() => names[randInt(0, 3)]);
    // ensure not trivial repeats only? fine either way
    let inputIndex = 0;
    let accepting = false;
    let timers = [];
    let done = false;

    names.forEach((name, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seq-btn';
      b.style.left = positions[i][0] + 'px';
      b.style.top = positions[i][1] + 'px';
      b.dataset.name = name;
      b.innerHTML = `<img src="assets/minijuegos/secuencia/btn_${name}_normal.png" alt="${name}">`;
      b.addEventListener('click', () => onPress(name, b));
      panel.appendChild(b);
      btns.push(b);
    });

    function renderDots(okCount) {
      dotsBox.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        const img = document.createElement('img');
        img.src = i < okCount ? 'assets/minijuegos/secuencia/punto_secuencia_ok.png' : 'assets/minijuegos/secuencia/punto_secuencia_vacio.png';
        img.alt = '';
        dotsBox.appendChild(img);
      }
    }

    function setLit(name, lit) {
      const b = btns.find(x => x.dataset.name === name);
      if (!b) return;
      b.classList.toggle('lit', lit);
      $('img', b).src = `assets/minijuegos/secuencia/btn_${name}_${lit ? 'brillo' : 'normal'}.png`;
    }

    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function playDemo() {
      accepting = false; inputIndex = 0; renderDots(0);
      hint.textContent = 'Observa la secuencia…';
      btns.forEach(b => b.disabled = true);
      let delay = 500;
      sequence.forEach((name, idx) => {
        timers.push(setTimeout(() => setLit(name, true), delay));
        timers.push(setTimeout(() => setLit(name, false), delay + 450));
        delay += 700;
        if (idx === sequence.length - 1) {
          timers.push(setTimeout(() => {
            accepting = true;
            btns.forEach(b => b.disabled = false);
            hint.textContent = 'Tu turno: repite la secuencia.';
          }, delay + 100));
        }
      });
    }

    function onPress(name, b) {
      if (!accepting || done) return;
      setLit(name, true);
      timers.push(setTimeout(() => setLit(name, false), 180));
      if (name === sequence[inputIndex]) {
        inputIndex++;
        renderDots(inputIndex);
        if (inputIndex >= sequence.length) {
          done = true; accepting = false;
          btns.forEach(x => x.disabled = true);
          hint.textContent = '¡Secuencia correcta!';
          foot.textContent = 'Acceso autorizado.';
          onDone();
        }
      } else {
        accepting = false;
        btns.forEach(x => x.disabled = true);
        hint.textContent = 'Secuencia incorrecta. Observa de nuevo…';
        foot.textContent = 'Inténtalo otra vez.';
        timers.push(setTimeout(playDemo, 900));
      }
    }

    renderDots(0);
    playDemo();

    return () => { clearTimers(); };
  }

  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  init();
})();
