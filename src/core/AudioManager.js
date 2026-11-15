/**
 * Lightweight audio manager with Web Audio beeps as fallback (no external assets required).
 * Safe to use when AudioContext is unavailable or blocked.
 */
export class AudioManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this._unlocked = false;
  }

  _ensure() {
    if (this.ctx || !this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
    } catch (_) {
      this.ctx = null;
    }
  }

  unlock() {
    this._ensure();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this._unlocked = true;
  }

  /**
   * Play a short synthesized cue.
   * @param {'ui_confirm'|'ui_denied'|'ui_open'|'success'|'alert'|'step'|'pickup'|'power'} type
   * @param {{volume?:number, rate?:number}} [opts]
   */
  play(type, opts = {}) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const now = this.ctx.currentTime;
    const vol = Math.max(0, Math.min(1, opts.volume ?? 1));
    const rate = opts.rate ?? 1;

    const tone = (freq, start, dur, gain = 0.08, shape = 'sine', slideTo = null) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = shape;
      o.frequency.setValueAtTime(freq * rate, now + start);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo * rate), now + start + dur);
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.exponentialRampToValueAtTime(gain * vol, now + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.connect(g); g.connect(this.master);
      o.start(now + start); o.stop(now + start + dur + 0.02);
    };

    const noise = (start, dur, gain = 0.03) => {
      const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      src.buffer = buffer;
      g.gain.setValueAtTime(gain * vol, now + start);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      src.connect(g); g.connect(this.master);
      src.start(now + start);
    };

    switch (type) {
      case 'ui_confirm':
        tone(660, 0, 0.08, 0.06, 'square'); tone(880, 0.05, 0.09, 0.05, 'square');
        break;
      case 'ui_denied':
        tone(220, 0, 0.14, 0.07, 'sawtooth', 140); tone(160, 0.08, 0.12, 0.05, 'sawtooth', 120);
        break;
      case 'ui_open':
        tone(330, 0, 0.12, 0.05, 'triangle'); tone(494, 0.06, 0.16, 0.05, 'triangle');
        break;
      case 'success':
        tone(523, 0, 0.12, 0.06, 'triangle'); tone(659, 0.09, 0.12, 0.06, 'triangle'); tone(784, 0.18, 0.22, 0.07, 'triangle');
        break;
      case 'alert':
        tone(740, 0, 0.12, 0.07, 'square'); tone(520, 0.14, 0.16, 0.07, 'square');
        break;
      case 'step':
        noise(0, 0.045, 0.025); tone(90, 0, 0.03, 0.02, 'triangle', 70);
        break;
      case 'pickup':
        tone(880, 0, 0.08, 0.05, 'sine'); tone(1320, 0.06, 0.14, 0.05, 'sine');
        break;
      case 'power':
        tone(196, 0, 0.18, 0.05, 'sawtooth', 392); tone(392, 0.12, 0.25, 0.04, 'triangle', 523);
        break;
      default:
        tone(440, 0, 0.08, 0.04, 'sine');
    }
  }
}
