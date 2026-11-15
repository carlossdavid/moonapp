import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../config.js';

/**
 * Lightweight visual effects helpers (screen-space overlays, ambient particles).
 * Designed for the 320x180 logical canvas pipeline.
 */

export function drawVignette(ctx, w = LOGICAL_WIDTH, h = LOGICAL_HEIGHT, strength = 0.38) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.48, Math.min(w, h) * 0.2, w * 0.5, h * 0.52, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.18})`);
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function drawColorGrade(ctx, mode = 'exterior', w = LOGICAL_WIDTH, h = LOGICAL_HEIGHT, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (mode === 'exterior') {
    // Cool lunar tint + subtle contrast lift
    ctx.fillStyle = 'rgba(110, 145, 200, 0.06)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(15, 25, 40, 0.08)';
    ctx.fillRect(0, 0, w, h);
    // soft top highlight
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(180,210,255,0.04)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (mode === 'interior') {
    // Warm artificial station light
    ctx.fillStyle = 'rgba(255, 214, 160, 0.055)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(10, 20, 35, 0.06)';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    g.addColorStop(0, 'rgba(255,245,220,0.03)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (mode === 'menu') {
    ctx.fillStyle = 'rgba(40, 60, 90, 0.10)';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

export function drawAlertPulse(ctx, level = 0, time = 0, w = LOGICAL_WIDTH, h = LOGICAL_HEIGHT) {
  if (!(level > 0)) return;
  const pulse = 0.5 + 0.5 * Math.sin(time * (2.5 + level * 2.5));
  ctx.save();
  ctx.globalAlpha = (0.05 + level * 0.08) * pulse;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.15, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(255,80,60,0)');
  g.addColorStop(1, 'rgba(255,60,40,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function drawStatusVignette(ctx, health01 = 1, fatigue01 = 1, w = LOGICAL_WIDTH, h = LOGICAL_HEIGHT) {
  const damage = clamp01(1 - health01);
  const tired = clamp01(1 - fatigue01);
  const strength = 0.10 * damage + 0.06 * tired;
  if (strength <= 0.001) return;
  ctx.save();
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.25, w * 0.5, h * 0.55, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(20,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function clamp01(v) { return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)); }

export function drawFilmDust(ctx, time = 0, w = LOGICAL_WIDTH, h = LOGICAL_HEIGHT, amount = 14, alpha = 0.05) {
  // Deterministic pseudo-random specks based on time slice for subtle texture
  const t = Math.floor(time * 12);
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < amount; i++) {
    const seed = (i * 73856093) ^ (t * 19349663);
    const x = Math.abs((seed % w) + w) % w;
    const y = Math.abs(((seed / 97) | 0) % h + h) % h;
    const s = (i % 3 === 0) ? 1 : 1;
    ctx.fillStyle = (i % 2 === 0) ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

export function drawScanlineSoft(ctx, w = LOGICAL_WIDTH, h = LOGICAL_HEIGHT, alpha = 0.03) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

export class BurstParticles {
  constructor() { this.items = []; }
  emit(x, y, opts = {}) {
    const n = opts.count ?? 10;
    const color = opts.color ?? 'rgba(255,240,200,1)';
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.6;
      const sp = (opts.speed ?? 18) * (0.4 + Math.random() * 0.8);
      this.items.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opts.lift ?? 0),
        life: (opts.life ?? 0.6) * (0.6 + Math.random() * 0.7),
        age: 0,
        size: opts.size ?? 1,
        color,
        gravity: opts.gravity ?? 12,
        drag: opts.drag ?? 2.5,
      });
    }
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      if (p.age >= p.life) { this.items.splice(i, 1); continue; }
      p.vx *= Math.max(0, 1 - p.drag * dt);
      p.vy += p.gravity * dt;
      p.vy *= Math.max(0, 1 - p.drag * dt * 0.5);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  render(ctx) {
    if (!this.items.length) return;
    ctx.save();
    for (const p of this.items) {
      const t = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, t) * 0.9;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.restore();
  }
}

export class AmbientParticles {
  constructor(count = 28, w = LOGICAL_WIDTH, h = LOGICAL_HEIGHT) {
    this.w = w; this.h = h;
    this.particles = [];
    for (let i = 0; i < count; i++) this.particles.push(this._spawn(true));
  }
  _spawn(initial = false) {
    return {
      x: Math.random() * this.w,
      y: initial ? Math.random() * this.h : (Math.random() < 0.5 ? -2 : this.h + 2),
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 3,
      r: Math.random() < 0.8 ? 0.5 : 1,
      a: 0.06 + Math.random() * 0.12,
      life: 6 + Math.random() * 10,
      age: Math.random() * 6,
      tw: Math.random() * Math.PI * 2,
    };
  }
  update(dt, windX = 0, windY = 0) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.age += dt;
      p.tw += dt * (0.8 + p.r);
      p.x += (p.vx + windX + Math.sin(p.tw) * 1.5) * dt;
      p.y += (p.vy + windY) * dt;
      if (p.age > p.life || p.x < -4 || p.x > this.w + 4 || p.y < -4 || p.y > this.h + 4) {
        this.particles[i] = this._spawn(false);
      }
    }
  }
  render(ctx, color = 'rgba(230,240,255,1)') {
    ctx.save();
    for (const p of this.particles) {
      const fade = Math.min(1, p.age * 0.5) * Math.min(1, (p.life - p.age) * 0.5);
      ctx.globalAlpha = Math.max(0, p.a * fade);
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.r >= 1 ? 1 : 1, p.r >= 1 ? 1 : 1);
    }
    ctx.restore();
  }
}

export function drawInteractHighlight(renderer, zone, t = 0) {
  if (!zone || !zone.playerInside || !zone.body || !zone.body.collider) return;
  const aabb = zone.body.collider.getWorldAABB(zone.body.position);
  if (!aabb) return;
  const pulse = 0.55 + 0.45 * Math.sin(t * 6);
  const ctx = renderer.context;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 224, 120, ${0.25 + pulse * 0.35})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(aabb.x) - 1 + 0.5, Math.round(aabb.y) - 1 + 0.5, aabb.w + 1, aabb.h + 1);
  ctx.fillStyle = `rgba(255, 224, 120, ${0.04 + pulse * 0.06})`;
  ctx.fillRect(Math.round(aabb.x) - 1, Math.round(aabb.y) - 1, aabb.w + 2, aabb.h + 2);
  ctx.restore();
}
