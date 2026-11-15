/**
 * Efectos de sonido sintetizados con WebAudio (sin archivos externos).
 * El contexto se crea en el primer gesto del usuario para respetar las
 * políticas de reproducción automática de los navegadores.
 */
(function () {
  'use strict';

  var NS = window.ELECTROLISIS;
  var STORAGE_KEY = 'electrolisis.muted';

  function readMuted() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }

  function writeMuted(value) {
    try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch (e) { /* modo privado */ }
  }

  function Sfx() {
    this.ctx = null;
    this.master = null;
    this.muted = readMuted();
    this.noiseBuffer = null;
  }

  Sfx.prototype.unlock = function () {
    if (!this.ctx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  };

  Sfx.prototype.setMuted = function (muted) {
    this.muted = muted;
    writeMuted(muted);
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  };

  Sfx.prototype.toggleMuted = function () {
    this.setMuted(!this.muted);
    return this.muted;
  };

  /** Tono simple con envolvente. */
  Sfx.prototype.tone = function (opts) {
    if (!this.ctx || this.muted) return;
    var t0 = this.ctx.currentTime + (opts.delay || 0);
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1 && opts.f1 !== opts.f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t0 + opts.dur);
    }
    var peak = opts.gain == null ? 0.16 : opts.gain;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  };

  /** Chispa de ruido filtrado para impactos. */
  Sfx.prototype.noise = function (opts) {
    if (!this.ctx || this.muted) return;
    if (!this.noiseBuffer) {
      var len = Math.floor(this.ctx.sampleRate * 0.35);
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      this.noiseBuffer = buf;
    }
    var t0 = this.ctx.currentTime;
    var src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    var filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = opts.freq || 1800;
    filter.Q.value = 0.9;
    var gain = this.ctx.createGain();
    gain.gain.setValueAtTime(opts.gain || 0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (opts.dur || 0.16));
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + (opts.dur || 0.16) + 0.02);
  };

  Sfx.prototype.fire = function (color) {
    this.tone({ type: 'square', f0: color === 'red' ? 420 : 640, f1: 120, dur: 0.11, gain: 0.13 });
    this.noise({ freq: 1400, gain: 0.05, dur: 0.08 });
  };

  Sfx.prototype.hit = function (color) {
    var base = color === 'red' ? 660 : 880;
    this.tone({ type: 'triangle', f0: base, f1: base * 1.8, dur: 0.13, gain: 0.2 });
    this.tone({ type: 'sine', f0: base * 2, f1: base * 2.4, dur: 0.16, gain: 0.1, delay: 0.04 });
    this.noise({ freq: 2600, gain: 0.07, dur: 0.12 });
  };

  Sfx.prototype.error = function () {
    this.tone({ type: 'sawtooth', f0: 170, f1: 70, dur: 0.24, gain: 0.19 });
    this.tone({ type: 'square', f0: 120, f1: 60, dur: 0.3, gain: 0.1, delay: 0.05 });
    this.noise({ freq: 500, gain: 0.1, dur: 0.2 });
  };

  Sfx.prototype.miss = function () {
    this.tone({ type: 'sine', f0: 240, f1: 160, dur: 0.09, gain: 0.08 });
  };

  Sfx.prototype.switchColor = function (color) {
    var base = color === 'red' ? 520 : 760;
    this.tone({ type: 'square', f0: base, dur: 0.07, gain: 0.09 });
    this.tone({ type: 'square', f0: base * 1.5, dur: 0.09, gain: 0.09, delay: 0.08 });
  };

  Sfx.prototype.start = function () {
    this.tone({ type: 'sine', f0: 330, f1: 660, dur: 0.18, gain: 0.14 });
    this.tone({ type: 'sine', f0: 495, f1: 990, dur: 0.24, gain: 0.1, delay: 0.12 });
  };

  Sfx.prototype.end = function (good) {
    var notes = good ? [523, 659, 784, 1046] : [392, 330, 262];
    var self = this;
    notes.forEach(function (f, i) {
      self.tone({ type: 'triangle', f0: f, f1: f, dur: 0.22, gain: 0.13, delay: i * 0.12 });
    });
  };

  NS.Sfx = Sfx;
})();
