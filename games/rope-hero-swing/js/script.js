/**
 * ROPE HERO SWING — Complete Game Engine
 * Physics-based swinging game with realistic pendulum motion
 */

'use strict';

// ═══════════════════════════════════════════════════════════
//  CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════════════
const CONFIG = {
  GRAVITY: 0.42,
  AIR_RESISTANCE: 0.995, // Reduced air resistance for better momentum
  ROPE_ELASTICITY: 0.985, // Snappier rope
  MAX_ROPE_LEN: 380, // Longer reach
  MIN_ROPE_LEN: 60,
  SWING_SPEED_MULT: 1.1,
  PLAYER_RADIUS: 14,
  GROUND_Y_FRACTION: 0.86,
  PARALLAX_LAYERS: 4,
  TRAIL_LENGTH: 22,
  PARTICLE_COUNT: 60,
  COMBO_TIMEOUT: 4000,
  LEVELS: 30,
  SLOW_MO_CHANCE: 0.2, // Cinematic slow-mo on big jumps
};

// ═══════════════════════════════════════════════════════════
//  LEVEL DEFINITIONS
// ═══════════════════════════════════════════════════════════
function buildLevels() {
  const levels = [];
  for (let i = 0; i < CONFIG.LEVELS; i++) {
    const n = i + 1;
    const t = n / CONFIG.LEVELS;

    // Tier classification
    let tier;
    if (n <= 3) tier = 'intro';
    else if (n <= 7) tier = 'basic';
    else if (n <= 15) tier = 'advanced';
    else tier = 'expert';

    // Speed multiplier
    const speedMult = 1 + t * 0.8;

    // Target score
    const targetScore = 500 + n * 250;

    // Building count & gap size
    const buildingCount = 6 + Math.floor(t * 6);
    const minGap = tier === 'intro' ? 100 : tier === 'basic' ? 150 : tier === 'advanced' ? 200 : 250;
    const maxGap = minGap + 60;

    // Moving obstacles from level 8+
    const movingObstacles = n >= 8 ? Math.min(Math.floor((n - 7) / 2), 5) : 0;

    // Speed boost zones from level 4+
    const speedZones = n >= 4 ? Math.min(Math.floor((n - 3) / 3) + 1, 4) : 0;

    // Multi-anchor requirement from level 12+
    const multiAnchor = n >= 12;

    // World width scales with level
    const worldWidth = 3000 + n * 400;

    levels.push({
      id: n, tier, speedMult, targetScore,
      buildingCount, minGap, maxGap,
      movingObstacles, speedZones, multiAnchor,
      worldWidth,
      name: `LEVEL ${n}`,
    });
  }
  return levels;
}

const LEVELS = buildLevels();

// ═══════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
const rndInt = (lo, hi) => Math.floor(rnd(lo, hi + 1));

// ═══════════════════════════════════════════════════════════
//  SOUND ENGINE (Web Audio API — synthetic)
// ═══════════════════════════════════════════════════════════
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this.bgNode = null;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.6;
      this.masterGain.connect(this.ctx.destination);
    } catch(e) { this.enabled = false; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  _osc(freq, type, duration, gainVal = 0.3, detune = 0) {
    if (!this.ctx || !this.enabled) return;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    g.connect(this.masterGain);

    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(g);
    o.start();
    o.stop(this.ctx.currentTime + duration);
  }

  swing() {
    if (!this.ctx || !this.enabled) return;
    // Whoosh effect
    const dur = 0.35;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(900, this.ctx.currentTime);
    filt.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + dur);
    filt.Q.value = 1.5;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(this.masterGain);
    src.start();
  }

  attach() {
    if (!this.ctx || !this.enabled) return;
    this._osc(440, 'square', 0.12, 0.15, -200);
    this._osc(660, 'sine', 0.2, 0.1, 0);
  }

  release() {
    if (!this.ctx || !this.enabled) return;
    this._osc(280, 'sine', 0.25, 0.12, 0);
    this._osc(200, 'sawtooth', 0.15, 0.08, 0);
  }

  land() {
    if (!this.ctx || !this.enabled) return;
    this._osc(120, 'sine', 0.3, 0.3, 0);
    this._osc(80, 'square', 0.2, 0.2, 0);
  }

  combo(count) {
    if (!this.ctx || !this.enabled) return;
    const freqs = [523, 659, 784, 1047, 1319];
    const f = freqs[Math.min(count - 1, freqs.length - 1)];
    this._osc(f, 'sine', 0.4, 0.18, 0);
    this._osc(f * 1.5, 'sine', 0.3, 0.1, 0);
  }

  die() {
    if (!this.ctx || !this.enabled) return;
    this._osc(200, 'sawtooth', 0.4, 0.3, 0);
    this._osc(100, 'sine', 0.6, 0.25, 0);
    setTimeout(() => this._osc(60, 'sine', 0.8, 0.2, 0), 300);
  }

  levelComplete() {
    if (!this.ctx || !this.enabled) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => {
        this._osc(f, 'sine', 0.5, 0.15, 0);
        this._osc(f * 1.5, 'triangle', 0.4, 0.08, 0);
      }, i * 120);
    });
  }

  startBG() {
    if (!this.ctx || !this.enabled || this.bgNode) return;
    // Ambient drone
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    g.gain.value = 0.04;
    osc1.type = 'sine';
    osc1.frequency.value = 55;
    osc2.type = 'sine';
    osc2.frequency.value = 110;
    osc1.connect(g);
    osc2.connect(g);
    g.connect(this.masterGain);
    osc1.start();
    osc2.start();
    this.bgNode = { osc1, osc2, g };
  }

  stopBG() {
    if (!this.bgNode) return;
    try {
      this.bgNode.osc1.stop();
      this.bgNode.osc2.stop();
    } catch(e) {}
    this.bgNode = null;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.masterGain) this.masterGain.gain.value = this.enabled ? 0.6 : 0;
    return this.enabled;
  }
}

// ═══════════════════════════════════════════════════════════
//  PARTICLE SYSTEM
// ═══════════════════════════════════════════════════════════
class ParticleSystem {
  constructor() { this.pool = []; }

  emit(x, y, opts = {}) {
    const count = opts.count || 8;
    for (let i = 0; i < count; i++) {
      const angle = opts.angle !== undefined ? opts.angle + rnd(-0.5, 0.5) : rnd(0, Math.PI * 2);
      const speed = opts.speed || rnd(1.5, 4.5);
      this.pool.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rnd(0, 2),
        life: 1,
        decay: opts.decay || rnd(0.018, 0.035),
        size: opts.size || rnd(2, 6),
        color: opts.color || `hsl(${rnd(180, 220)}, 100%, 70%)`,
        gravity: opts.gravity !== undefined ? opts.gravity : 0.08,
        glow: opts.glow || false,
      });
    }
  }

  update() {
    this.pool = this.pool.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.97;
      p.life -= p.decay;
      return p.life > 0;
    });
  }

  draw(ctx, camX, camY) {
    for (const p of this.pool) {
      ctx.save();
      ctx.globalAlpha = p.life;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y - camY, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  BUILDING GENERATOR
// ═══════════════════════════════════════════════════════════
class Building {
  constructor(x, w, h, canvasH, opts = {}) {
    this.x = x;
    this.w = w;
    this.h = h;
    this.y = canvasH - h;
    this.canvasH = canvasH;
    this.color = opts.color || `hsl(${rndInt(210, 250)}, 30%, ${rndInt(12, 22)}%)`;
    this.accentColor = opts.accentColor || `hsl(${rndInt(180, 260)}, 60%, ${rndInt(40, 60)}%)`;
    this.anchorPoints = this._genAnchors();
    this.windows = this._genWindows();
    this.hasTower = rnd(0, 1) > 0.55;
    this.towerH = this.hasTower ? rnd(20, 50) : 0;
    this.towerW = this.hasTower ? rnd(8, 20) : 0;
  }

  _genAnchors() {
    const anchors = [];
    // Top corners and mid-top
    anchors.push({ x: this.x + this.w * 0.2, y: this.y });
    anchors.push({ x: this.x + this.w * 0.5, y: this.y });
    anchors.push({ x: this.x + this.w * 0.8, y: this.y });
    return anchors;
  }

  _genWindows() {
    const windows = [];
    const cols = Math.floor(this.w / 18);
    const rows = Math.floor(this.h / 22);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        windows.push({
          x: this.x + 6 + c * 18,
          y: this.y + 10 + r * 22,
          lit: Math.random() > 0.35,
          color: Math.random() > 0.4
            ? `rgba(255,220,100,${rnd(0.5, 0.9)})`
            : `rgba(100,200,255,${rnd(0.4, 0.8)})`,
        });
      }
    }
    return windows;
  }

  draw(ctx, camX, scrollY) {
    const sx = this.x - camX;
    if (sx > ctx.canvas.width + 20 || sx + this.w < -20) return;

    // Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx + 6, this.y - scrollY + 6, this.w, this.h);

    // Building body
    const grad = ctx.createLinearGradient(sx, this.y - scrollY, sx + this.w, this.y - scrollY);
    grad.addColorStop(0, this.color);
    grad.addColorStop(0.5, `hsl(${210 + rnd(-10,10)}, 25%, ${rnd(18,26)}%)`);
    grad.addColorStop(1, 'rgba(5,5,20,0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, this.y - scrollY, this.w, this.h);

    // Edge highlight
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(sx, this.y - scrollY, 2, this.h);

    // Tower/antenna
    if (this.hasTower) {
      ctx.fillStyle = this.color;
      ctx.fillRect(sx + (this.w - this.towerW) / 2, this.y - scrollY - this.towerH, this.towerW, this.towerH);
      // Antenna tip light
      ctx.fillStyle = 'rgba(255,80,80,0.9)';
      ctx.beginPath();
      ctx.arc(sx + this.w / 2, this.y - scrollY - this.towerH, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Windows
    for (const w of this.windows) {
      if (!w.lit) continue;
      const wx = w.x - camX;
      if (wx < sx || wx > sx + this.w) continue;
      ctx.fillStyle = w.color;
      ctx.fillRect(wx, w.y - scrollY, 10, 12);
    }

    // Accent line at top
    ctx.fillStyle = this.accentColor;
    ctx.fillRect(sx, this.y - scrollY, this.w, 3);
    ctx.restore();
  }

  getAnchorPoints() { return this.anchorPoints; }
}

// ═══════════════════════════════════════════════════════════
//  MOVING OBSTACLE
// ═══════════════════════════════════════════════════════════
class MovingObstacle {
  constructor(x, y, w, h, speedX, speedY, boundsX, boundsY) {
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.speedX = speedX; this.speedY = speedY;
    this.boundsX = boundsX; this.boundsY = boundsY;
    this.baseX = x; this.baseY = y;
    this.color = `hsl(${rnd(0,30)}, 90%, 50%)`;
  }

  update(ts = 1) {
    this.x += this.speedX * ts;
    this.y += this.speedY * ts;
    if (this.x < this.boundsX[0] || this.x + this.w > this.boundsX[1]) this.speedX *= -1;
    if (this.y < this.boundsY[0] || this.y + this.h > this.boundsY[1]) this.speedY *= -1;
  }

  draw(ctx, camX, scrollY) {
    const sx = this.x - camX;
    if (sx > ctx.canvas.width + 20 || sx + this.w < -20) return;
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(sx, this.y - scrollY, this.w, this.h, 6);
    ctx.fill();
    // Warning stripes
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,0,0.2)';
      ctx.fillRect(sx + i * (this.w / 4), this.y - scrollY, this.w / 4, this.h);
    }
    ctx.restore();
  }

  collidesWith(px, py, r) {
    const nearX = clamp(px, this.x, this.x + this.w);
    const nearY = clamp(py, this.y, this.y + this.h);
    return dist(px, py, nearX, nearY) < r + 4;
  }
}

// ═══════════════════════════════════════════════════════════
//  SPEED ZONE
// ═══════════════════════════════════════════════════════════
class SpeedZone {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.t = 0;
  }

  update(ts = 1) { this.t += 0.05 * ts; }

  contains(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  draw(ctx, camX, scrollY) {
    const sx = this.x - camX;
    if (sx > ctx.canvas.width + 20 || sx + this.w < -20) return;
    ctx.save();
    const alpha = 0.2 + 0.1 * Math.sin(this.t);
    ctx.fillStyle = `rgba(0,255,136,${alpha})`;
    ctx.strokeStyle = `rgba(0,255,136,0.8)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(sx, this.y - scrollY, this.w, this.h, 8);
    ctx.fill();
    ctx.stroke();
    // Arrow indicators
    ctx.fillStyle = `rgba(0,255,136,${0.7 + 0.3 * Math.sin(this.t)})`;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', sx + this.w / 2, this.y - scrollY + this.h / 2 + 6);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
//  GOAL ZONE
// ═══════════════════════════════════════════════════════════
class GoalZone {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.t = 0;
  }
  update(ts = 1) { this.t += 0.04 * ts; }
  contains(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
  draw(ctx, camX, scrollY) {
    const sx = this.x - camX;
    if (sx > ctx.canvas.width + 20 || sx + this.w < -20) return;
    ctx.save();
    const alpha = 0.25 + 0.15 * Math.sin(this.t);
    ctx.fillStyle = `rgba(255,215,0,${alpha})`;
    ctx.strokeStyle = `rgba(255,215,0,0.9)`;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.roundRect(sx, this.y - scrollY, this.w, this.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255,215,0,${0.8 + 0.2 * Math.sin(this.t * 1.5)})`;
    ctx.font = `bold ${22 + 3 * Math.sin(this.t)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('🏁', sx + this.w / 2, this.y - scrollY + this.h / 2 + 8);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
//  PLAYER
// ═══════════════════════════════════════════════════════════
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = CONFIG.PLAYER_RADIUS;

    // Rope state
    this.ropeAttached = false;
    this.ropeAnchorX = 0;
    this.ropeAnchorY = 0;
    this.ropeLen = 0;
    this.ropeAngle = 0;   // angle from anchor to player
    this.ropeAngVel = 0;  // angular velocity of pendulum

    // Trail
    this.trail = [];
    this.trailMax = CONFIG.TRAIL_LENGTH;

    // State
    this.dead = false;
    this.onGround = false;
    this.speedBoost = 1.0;
    this.bodyAngle = 0;      // visual rotation
    this.swingCount = 0;      // total swings performed
    this.lastSwingDir = 0;
  }

  attachRope(ax, ay) {
    this.ropeAttached = true;
    this.ropeAnchorX = ax;
    this.ropeAnchorY = ay;
    this.ropeLen = clamp(dist(this.x, this.y, ax, ay), CONFIG.MIN_ROPE_LEN, CONFIG.MAX_ROPE_LEN);
    // Compute current angle of rope
    this.ropeAngle = Math.atan2(this.y - ay, this.x - ax);
    // Convert current velocity to angular velocity
    const len = this.ropeLen;
    // Tangential component of velocity
    const tangX = -Math.sin(this.ropeAngle);
    const tangY = Math.cos(this.ropeAngle);
    this.ropeAngVel = (this.vx * tangX + this.vy * tangY) / len;
    this.lastSwingDir = Math.sign(this.ropeAngVel) || 1;
  }

  releaseRope() {
    if (!this.ropeAttached) return;
    // Convert angular state back to linear velocity
    const len = this.ropeLen;
    const tangX = -Math.sin(this.ropeAngle);
    const tangY = Math.cos(this.ropeAngle);
    this.vx = this.ropeAngVel * len * tangX * this.speedBoost;
    this.vy = this.ropeAngVel * len * tangY * this.speedBoost;
    this.ropeAttached = false;
    this.swingCount++;
  }

  update(groundY, obstacles) {
    if (this.dead) return;

    // Trail
    this.trail.push({ x: this.x, y: this.y, speed: Math.hypot(this.vx, this.vy) });
    if (this.trail.length > this.trailMax) this.trail.shift();

    if (this.ropeAttached) {
      // Pendulum physics
      const g = CONFIG.GRAVITY / this.ropeLen;
      // Angular acceleration from gravity
      const angAcc = -g * Math.sin(this.ropeAngle);
      this.ropeAngVel += angAcc;
      this.ropeAngVel *= CONFIG.ROPE_ELASTICITY;

      // Pump assist: add angular energy proportional to speed boost
      if (this.speedBoost > 1) {
        this.ropeAngVel += Math.sign(this.ropeAngVel) * 0.006; // More power
      }

      // Forward-bias: keep the hero moving forward gracefully
      const isMovingBack = Math.cos(this.ropeAngle) > 0 && this.ropeAngVel < 0;
      if (!isMovingBack) {
        this.ropeAngVel += 0.002;
      }

      // Advance angle
      this.ropeAngle += this.ropeAngVel;

      // Place player at end of rope
      this.x = this.ropeAnchorX + Math.cos(this.ropeAngle) * this.ropeLen;
      this.y = this.ropeAnchorY + Math.sin(this.ropeAngle) * this.ropeLen;

      // Visual rotation follows pendulum
      this.bodyAngle = this.ropeAngle + Math.PI / 2;
    } else {
      // Free flight with gravity
      this.vy += CONFIG.GRAVITY;
      this.vx *= CONFIG.AIR_RESISTANCE;
      this.vy *= CONFIG.AIR_RESISTANCE;
      this.x += this.vx;
      this.y += this.vy;

      // Body angle matches velocity direction
      if (Math.hypot(this.vx, this.vy) > 0.5) {
        const targetAngle = Math.atan2(this.vy, this.vx) + Math.PI / 2;
        this.bodyAngle = lerp(this.bodyAngle, targetAngle, 0.15);
      }
    }

    // Ground collision
    if (this.y + this.r >= groundY) {
      this.y = groundY - this.r;
      if (Math.abs(this.vy) > 18) {
        this.dead = true;
        return;
      }
      this.vy = -this.vy * 0.25;
      this.vx *= 0.8;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Moving obstacle collision
    for (const obs of obstacles) {
      if (obs.collidesWith(this.x, this.y, this.r)) {
        this.dead = true;
        return;
      }
    }

    // Reset speed boost
    this.speedBoost = 1.0;
  }

  draw(ctx, camX, scrollY) {
    const sx = this.x - camX;
    const sy = this.y - scrollY;

    ctx.save();

    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = i / this.trail.length;
      const tx = this.trail[i].x - camX;
      const ty = this.trail[i].y - scrollY;
      const speed = this.trail[i].speed;
      const hue = 190 + speed * 4;
      ctx.beginPath();
      ctx.arc(tx, ty, this.r * t * 0.7 * (speed / 15), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${t * 0.4})`;
      ctx.fill();
    }

    // Body
    ctx.translate(sx, sy);
    ctx.rotate(this.bodyAngle);

    // Outer glow ring
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, this.r + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,212,255,0.15)';
    ctx.fill();

    // Body circle (suit)
    const bodyGrad = ctx.createRadialGradient(-3, -4, 2, 0, 0, this.r);
    bodyGrad.addColorStop(0, '#ff6b6b');
    bodyGrad.addColorStop(0.5, '#cc3333');
    bodyGrad.addColorStop(1, '#880000');
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff4444';
    ctx.fill();

    // Blue chest detail
    ctx.fillStyle = 'rgba(0,100,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(0, 2, this.r * 0.55, this.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye visor
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(-4, -5, 4, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -5, 4, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Spider emblem
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -2); ctx.lineTo(0, 4);
    ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
    ctx.stroke();

    ctx.restore();

    // Rope
    if (this.ropeAttached) {
      this._drawRope(ctx, camX, scrollY);
    }
  }

  _drawRope(ctx, camX, scrollY) {
    const ax = this.ropeAnchorX - camX;
    const ay = this.ropeAnchorY - scrollY;
    const px = this.x - camX;
    const py = this.y - scrollY;

    // Elastic sag using bezier
    const midX = (ax + px) / 2;
    const midY = (ay + py) / 2 + 10 * (1 - Math.abs(this.ropeAngVel) * 8);

    ctx.save();
    // Glow
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(0,212,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(midX, midY, px, py);
    ctx.stroke();

    // Inner core
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(midX, midY, px, py);
    ctx.stroke();

    // Anchor point glow
    ctx.beginPath();
    ctx.arc(ax, ay, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,212,255,0.9)';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
//  WORLD / LEVEL GENERATOR
// ═══════════════════════════════════════════════════════════
class World {
  constructor(levelDef, canvasW, canvasH) {
    this.levelDef = levelDef;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.groundY = canvasH * CONFIG.GROUND_Y_FRACTION;
    this.worldWidth = levelDef.worldWidth;
    this.buildings = [];
    this.obstacles = [];
    this.speedZones = [];
    this.goalZone = null;
    this.allAnchors = [];
    this.parallaxLayers = this._buildParallax();
    this._generate();
  }

  _buildParallax() {
    return [
      { speed: 0.15, color: 'rgba(15,10,40,0.95)', buildings: this._randBuildings(0.15, 0.6, 0.12, 14) },
      { speed: 0.3,  color: 'rgba(10,15,45,0.8)',  buildings: this._randBuildings(0.2, 0.55, 0.1, 20) },
      { speed: 0.5,  color: 'rgba(8,20,50,0.7)',   buildings: this._randBuildings(0.3, 0.5, 0.08, 28) },
    ];
  }

  _randBuildings(hMin, hMax, alpha, count) {
    const bs = [];
    for (let i = 0; i < count; i++) {
      bs.push({
        x: i / count,
        w: rnd(0.04, 0.09),
        h: rnd(hMin, hMax),
        color: `rgba(${rndInt(5,20)},${rndInt(8,30)},${rndInt(40,80)},${alpha})`,
      });
    }
    return bs;
  }

  _generate() {
    const { levelDef, canvasH, groundY, worldWidth } = this;
    const { buildingCount, minGap, maxGap, movingObstacles, speedZones, speedMult } = levelDef;

    // Start first building close to left edge
    let curX = 60;
    const minBW = 90, maxBW = 150;

    for (let i = 0; i < buildingCount; i++) {
      const bw = rnd(minBW, maxBW);
      // Keep buildings tall enough to swing from (40-72% of ground height)
      const bh = rnd(canvasH * 0.4, canvasH * 0.72);
      const building = new Building(curX, bw, bh, groundY, {});
      this.buildings.push(building);
      this.allAnchors.push(...building.getAnchorPoints());
      // Also add mid-height anchors for easier swinging
      this.allAnchors.push({ x: building.x + building.w * 0.5, y: building.y + building.h * 0.25 });
      curX += bw + rnd(minGap, maxGap);
    }

    // Final goal building (wide, short, at end)
    const goalBW = 140, goalBH = canvasH * 0.3;
    const goalBuilding = new Building(curX, goalBW, goalBH, groundY, {
      color: 'hsl(45, 40%, 18%)',
      accentColor: 'rgba(255,215,0,0.9)',
    });
    this.buildings.push(goalBuilding);
    curX += goalBW;

    // Goal zone on top of last building
    this.goalZone = new GoalZone(
      goalBuilding.x + 10,
      goalBuilding.y - 60,
      goalBW - 20, 60
    );

    // Adjust worldWidth to fit actual content
    this.worldWidth = curX + 200;

    // Moving obstacles
    const midY = groundY * 0.4;
    for (let i = 0; i < movingObstacles; i++) {
      const ox = 300 + i * (this.worldWidth / (movingObstacles + 1));
      const ow = rnd(30, 60);
      const oh = rnd(18, 36);
      const sx_speed = rnd(1.5, 3.5) * (Math.random() > 0.5 ? 1 : -1) * speedMult;
      const sy_speed = Math.random() > 0.5 ? rnd(1, 2.5) * (Math.random() > 0.5 ? 1 : -1) : 0;
      this.obstacles.push(new MovingObstacle(
        ox, midY + rnd(-80, 80),
        ow, oh,
        sx_speed, sy_speed,
        [ox - 100, ox + 150],
        [midY - 120, midY + 120],
      ));
    }

    // Speed zones
    for (let i = 0; i < speedZones; i++) {
      const szX = 200 + i * (this.worldWidth / (speedZones + 1));
      const szW = 60, szH = 80;
      this.speedZones.push(new SpeedZone(
        szX,
        groundY - szH - rnd(30, 120),
        szW, szH
      ));
    }
  }

  findNearestAnchor(px, py, maxDist) {
    let best = null, bestDist = maxDist;
    for (const a of this.allAnchors) {
      const d = dist(px, py, a.x, a.y);
      // Only attach to anchors above the player
      if (d < bestDist && a.y < py) {
        bestDist = d;
        best = a;
      }
    }
    return best;
  }

  update(ts = 1) {
    for (const obs of this.obstacles) obs.update(ts);
    for (const sz of this.speedZones) sz.update(ts);
    if (this.goalZone) this.goalZone.update(ts);
  }

  draw(ctx, camX, scrollY) {
    this._drawParallax(ctx, camX);
    this._drawGround(ctx, camX, scrollY);

    for (const b of this.buildings) b.draw(ctx, camX, 0);
    for (const obs of this.obstacles) obs.draw(ctx, camX, 0);
    for (const sz of this.speedZones) sz.draw(ctx, camX, 0);
    if (this.goalZone) this.goalZone.draw(ctx, camX, 0);

    // Anchor point indicators (subtle)
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (const a of this.allAnchors) {
      const sx = a.x - camX;
      if (sx < -10 || sx > ctx.canvas.width + 10) continue;
      ctx.beginPath();
      ctx.arc(sx, a.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,212,255,0.6)';
      ctx.fill();
    }
    ctx.restore();
  }

  _drawParallax(ctx, camX) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    for (const layer of this.parallaxLayers) {
      const offsetX = -(camX * layer.speed) % cw;
      ctx.save();
      for (let rep = -1; rep <= 1; rep++) {
        for (const b of layer.buildings) {
          const bx = offsetX + rep * cw + b.x * cw;
          const bh = b.h * ch;
          const by = ch * CONFIG.GROUND_Y_FRACTION - bh;
          ctx.fillStyle = b.color;
          ctx.fillRect(bx, by, b.w * cw, bh);
        }
      }
      ctx.restore();
    }
  }

  _drawGround(ctx, camX, scrollY) {
    const cw = ctx.canvas.width;
    const gy = this.groundY;
    const gh = ctx.canvas.height - gy;

    const grad = ctx.createLinearGradient(0, gy, 0, gy + gh);
    grad.addColorStop(0, '#0d1a0d');
    grad.addColorStop(1, '#050a05');
    ctx.fillStyle = grad;
    ctx.fillRect(0, gy, cw, gh);

    // Road line
    ctx.strokeStyle = 'rgba(0,212,255,0.15)';
    ctx.lineWidth = 2;
    ctx.setLineDash([30, 20]);
    ctx.lineDashOffset = -(camX * 0.8) % 50;
    ctx.beginPath();
    ctx.moveTo(0, gy + 18);
    ctx.lineTo(cw, gy + 18);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ═══════════════════════════════════════════════════════════
//  SKY RENDERER
// ═══════════════════════════════════════════════════════════
class SkyRenderer {
  constructor() {
    this.stars = [];
    this.clouds = [];
    this.time = 0;
    this._genStars(120);
    this._genClouds(10);
  }

  _genStars(n) {
    for (let i = 0; i < n; i++) {
      this.stars.push({
        x: Math.random(), y: Math.random() * 0.65,
        r: rnd(0.5, 2.5),
        phase: rnd(0, Math.PI * 2),
        speed: rnd(0.5, 2),
      });
    }
  }

  _genClouds(n) {
    for (let i = 0; i < n; i++) {
      this.clouds.push({
        x: Math.random(),
        y: rnd(0.05, 0.35),
        r: rnd(30, 80),
        speed: rnd(0.00005, 0.0002),
        alpha: rnd(0.04, 0.12),
      });
    }
  }

  update(levelN, ts = 1) {
    this.time += 0.01 * ts;
    for (const c of this.clouds) {
      c.x += c.speed * ts;
      if (c.x > 1.1) c.x = -0.1;
    }
  }

  draw(ctx, camX, levelN) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const groundY = ch * CONFIG.GROUND_Y_FRACTION;

    // Determine palette based on level
    const t = (levelN - 1) / CONFIG.LEVELS;
    let skyTop, skyMid, skyBot;
    if (t < 0.33) {
      // Sunset
      skyTop = '#0a0520';
      skyMid = '#1a0a35';
      skyBot = '#250d20';
    } else if (t < 0.66) {
      // Deep night
      skyTop = '#020210';
      skyMid = '#050520';
      skyBot = '#030315';
    } else {
      // Pre-dawn cityscape
      skyTop = '#000510';
      skyMid = '#001030';
      skyBot = '#000820';
    }

    const grad = ctx.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(0.5, skyMid);
    grad.addColorStop(1, skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, groundY);

    // Moon / sun
    const moonX = cw * 0.8;
    const moonY = ch * 0.12;
    ctx.save();
    ctx.shadowColor = t < 0.33 ? '#ffcc88' : '#aaccff';
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 22, 0, Math.PI * 2);
    ctx.fillStyle = t < 0.33 ? '#ffeecc' : '#ddeeff';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Stars
    for (const s of this.stars) {
      const alpha = 0.5 + 0.5 * Math.sin(this.time * s.speed + s.phase);
      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.beginPath();
      ctx.arc(s.x * cw, s.y * ch, s.r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
    }

    // Clouds
    for (const c of this.clouds) {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.fillStyle = '#8899cc';
      ctx.beginPath();
      ctx.arc(c.x * cw, c.y * ch, c.r, 0, Math.PI * 2);
      ctx.arc(c.x * cw + c.r * 0.6, c.y * ch - 10, c.r * 0.65, 0, Math.PI * 2);
      ctx.arc(c.x * cw - c.r * 0.5, c.y * ch - 5, c.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // City glow at horizon
    const horizGrad = ctx.createLinearGradient(0, groundY - 80, 0, groundY);
    horizGrad.addColorStop(0, 'transparent');
    horizGrad.addColorStop(1, 'rgba(0,212,255,0.06)');
    ctx.fillStyle = horizGrad;
    ctx.fillRect(0, groundY - 80, cw, 80);
  }
}

// ═══════════════════════════════════════════════════════════
//  MAIN GAME CLASS
// ═══════════════════════════════════════════════════════════
class RopeHeroGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Game state
    this.state = 'start';       // start|tutorial|levelSelect|playing|paused|levelComplete|gameOver
    this.currentLevelIdx = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = null;
    this.distance = 0;
    this.highScores = JSON.parse(localStorage.getItem('rhs_scores') || '{}');
    this.starsData = JSON.parse(localStorage.getItem('rhs_stars') || '{}');
    this.unlockedLevels = parseInt(localStorage.getItem('rhs_unlocked') || '1', 10);
    this.soundOn = true;
    this.currentSpeed = 0;

    // Systems
    this.sound = new SoundEngine();
    this.particles = new ParticleSystem();
    this.sky = new SkyRenderer();

    // World & player
    this.world = null;
    this.player = null;

    // Camera
    this.camX = 0;
    this.camY = 0;
    this.camTargetX = 0;

    // Cursor for mouse
    this.mouseX = 0;
    this.mouseY = 0;

    // Input flags
    this.swingHeld = false;
    this.prevSwingHeld = false;

    // Ambient rain particles
    this.rainDrops = [];

    // FX
    this.screenShake = 0;
    this.speedLineAlpha = 0;

    // Frame counter
    this.frame = 0;
    this.startTime = 0;

    this._resize();
    this._bindEvents();
    this._buildUI();

    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this._resize(), 150);
    });

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  // ── Resize ────────────────────────────────────────────────
  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.scale(dpr, dpr);
    
    // Update dependent components
    if (this.world) {
      this.world.canvasW = this.W;
      this.world.canvasH = this.H;
      this.world.groundY = this.H * CONFIG.GROUND_Y_FRACTION;
    }
  }

  // ── UI Build ──────────────────────────────────────────────
  _buildUI() {
    this._buildLevelGrid();
    this._updateHUD();
  }

  _buildLevelGrid() {
    const grid = document.getElementById('levelGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < CONFIG.LEVELS; i++) {
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      btn.id = `lvl-btn-${i + 1}`;
      const locked = i + 1 > this.unlockedLevels;
      const stars = this.starsData[i + 1] || 0;

      if (locked) {
        btn.classList.add('locked');
        btn.innerHTML = `<span class="level-lock">🔒</span>`;
      } else {
        if (stars > 0) btn.classList.add('completed');
        if (i + 1 === this.unlockedLevels) btn.classList.add('current');
        btn.innerHTML = `
          <span class="level-num">${i + 1}</span>
          <div class="level-stars">
            ${[1,2,3].map(s => `<span class="star ${stars >= s ? 'lit' : ''}">★</span>`).join('')}
          </div>`;
        btn.addEventListener('click', () => this._selectLevel(i));
      }
      grid.appendChild(btn);
    }
  }

  // ── Events ────────────────────────────────────────────────
  _bindEvents() {
    // Mouse
    this.canvas.addEventListener('mousemove', e => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    this.canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this._onSwingStart(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('mouseup', e => {
      if (e.button === 0) this._onSwingEnd();
    });

    // Touch
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      this.mouseX = t.clientX;
      this.mouseY = t.clientY;
      this._onSwingStart(t.clientX, t.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      this._onSwingEnd();
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      const t = e.touches[0];
      this.mouseX = t.clientX;
      this.mouseY = t.clientY;
    }, { passive: false });

    // Mobile button
    const swingBtn = document.getElementById('swingBtn');
    if (swingBtn) {
      swingBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        this._onSwingStart(this.mouseX, this.mouseY);
      }, { passive: false });
      swingBtn.addEventListener('touchend', e => {
        e.preventDefault();
        this._onSwingEnd();
      }, { passive: false });
    }

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        this._onSwingStart(this.mouseX, this.mouseY);
      }
      if (e.code === 'Escape') this._onPause();
      if (e.code === 'KeyM') this._toggleSound();
    });

    document.addEventListener('keyup', e => {
      if (e.code === 'Space' || e.code === 'ArrowUp') this._onSwingEnd();
    });

    // HUD buttons
    document.getElementById('pauseBtn')?.addEventListener('click', () => this._onPause());
    document.getElementById('soundBtn')?.addEventListener('click', () => this._toggleSound());

    // Start screen
    document.getElementById('startBtn')?.addEventListener('click', () => this._showTutorial());
    document.getElementById('levelSelectBtn')?.addEventListener('click', () => this._showLevelSelect());
    document.getElementById('howToPlayBtn')?.addEventListener('click', () => this._showTutorial());

    // Tutorial
    document.getElementById('tutorialStartBtn')?.addEventListener('click', () => this._startGame(this.currentLevelIdx));
    document.getElementById('tutorialSkipBtn')?.addEventListener('click', () => this._startGame(this.currentLevelIdx));

    // Level select back
    document.getElementById('levelSelectBackBtn')?.addEventListener('click', () => this._showStart());

    // Pause menu
    document.getElementById('resumeBtn')?.addEventListener('click', () => this._resume());
    document.getElementById('pauseRestartBtn')?.addEventListener('click', () => this._startGame(this.currentLevelIdx));
    document.getElementById('pauseLevelsBtn')?.addEventListener('click', () => {
      this._showLevelSelect();
    });
    document.getElementById('pauseMenuBtn')?.addEventListener('click', () => this._showStart());

    // Level complete
    document.getElementById('nextLevelBtn')?.addEventListener('click', () => {
      const next = Math.min(this.currentLevelIdx + 1, CONFIG.LEVELS - 1);
      this._startGame(next);
    });
    document.getElementById('replayBtn')?.addEventListener('click', () => this._startGame(this.currentLevelIdx));
    document.getElementById('lvlCompLevelsBtn')?.addEventListener('click', () => this._showLevelSelect());

    // Game over
    document.getElementById('goRetryBtn')?.addEventListener('click', () => this._startGame(this.currentLevelIdx));
    document.getElementById('goLevelsBtn')?.addEventListener('click', () => this._showLevelSelect());
    window.addEventListener('resize', () => this._onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._onResize(), 100));
  }

  // ── Swing Input ───────────────────────────────────────────
  _onSwingStart(mx, my) {
    if (this.state !== 'playing') return;
    this.sound.resume();
    if (!this.player || this.player.dead) return;
    if (this.player.ropeAttached) return;

    // Find nearest anchor in world-space
    const worldX = mx + this.camX;
    const worldY = my;

    const anchor = this.world.findNearestAnchor(
      this.player.x, this.player.y, CONFIG.MAX_ROPE_LEN + 200
    );

    if (anchor) {
      this.player.attachRope(anchor.x, anchor.y);
      this.sound.attach();
      this.particles.emit(anchor.x - this.camX, anchor.y, {
        count: 6, color: 'rgba(0,212,255,0.8)', size: 3, speed: 3, glow: true
      });
    }
  }

  _onSwingEnd() {
    if (this.state !== 'playing') return;
    if (!this.player || !this.player.ropeAttached) return;
    this.player.releaseRope();
    this.sound.swing();
    this.sound.release();

    // Add score for swing
    this._addScore(25, 'SWING');
  }

  // ── Game Flow ─────────────────────────────────────────────
  _showStart() {
    this._setScreen('start');
    this.sound.stopBG();
  }

  _showTutorial() {
    this._setScreen('tutorial');
  }

  _showLevelSelect() {
    this._buildLevelGrid();
    this._setScreen('levelSelect');
  }

  _selectLevel(idx) {
    this.currentLevelIdx = idx;
    this._completed = false; // Reset completion flag
    this._startGame(idx);
  }

  _startGame(levelIdx) {
    this.currentLevelIdx = clamp(levelIdx, 0, CONFIG.LEVELS - 1);
    const levelDef = LEVELS[this.currentLevelIdx];

    // Init world
    this.world = new World(levelDef, this.W, this.H);

    // Spawn player on top of first building, with rightward momentum
    const firstBuilding = this.world.buildings[0];
    const spawnX = firstBuilding ? firstBuilding.x + firstBuilding.w * 0.5 : 150;
    const spawnY = firstBuilding ? firstBuilding.y - CONFIG.PLAYER_RADIUS - 2 : this.H * 0.35;
    this._graceFrames = 120; // invincible for first 2 seconds
    this._lastSwingCount = 0;
    this.player = new Player(spawnX, spawnY);
    this.player.vx = 8;    // give player a strong rightward launch
    this.player.vy = -6;   // upward jump so they arc into first swing

    // Camera — start so the player and first gap are visible
    this.camX = Math.max(0, spawnX - this.W * 0.25);
    this.camY = 0;

    // Reset state
    this.score = 0;
    this.combo = 0;
    this.distance = 0;
    this.screenShake = 0;
    this.speedLineAlpha = 0;
    this.particles.pool = [];
    this.frame = 0;
    this.startTime = Date.now();
    this.lastTime = performance.now();
    this.timeScale = 1.0; 

    this.state = 'playing';
    this._setScreen('playing');
    this._updateHUD();
    this.sound.resume();
    this.sound.startBG();
  }

  _onPause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this._setScreen('paused');
    }
  }

  _resume() {
    if (this.state === 'paused') {
      this.state = 'playing';
      this._setScreen('playing');
    }
  }

  _levelComplete() {
    this.state = 'levelComplete';
    this.sound.levelComplete();
    this.sound.stopBG();

    // Compute stars
    const targetScore = LEVELS[this.currentLevelIdx].targetScore;
    const ratio = this.score / targetScore;
    const stars = ratio >= 0.95 ? 3 : ratio >= 0.65 ? 2 : 1;

    // Save progress
    const prevStars = this.starsData[this.currentLevelIdx + 1] || 0;
    if (stars > prevStars) this.starsData[this.currentLevelIdx + 1] = stars;
    localStorage.setItem('rhs_stars', JSON.stringify(this.starsData));

    const prevHigh = this.highScores[this.currentLevelIdx + 1] || 0;
    if (this.score > prevHigh) this.highScores[this.currentLevelIdx + 1] = this.score;
    localStorage.setItem('rhs_scores', JSON.stringify(this.highScores));

    const nextLevel = this.currentLevelIdx + 2;
    if (nextLevel > this.unlockedLevels) {
      this.unlockedLevels = nextLevel;
      localStorage.setItem('rhs_unlocked', nextLevel);
    }

    // Update UI
    document.getElementById('completeScore').textContent = this.score.toLocaleString();
    document.getElementById('completeDistance').textContent = Math.floor(this.distance) + 'm';
    document.getElementById('completeCombo').textContent = this.combo;
    document.getElementById('completeTime').textContent = this._elapsed();

    const starsRow = document.getElementById('completeStars');
    if (starsRow) {
      const starEls = starsRow.querySelectorAll('.star-big');
      starEls.forEach((el, i) => {
        setTimeout(() => {
          if (i < stars) el.classList.add('lit');
        }, 300 + i * 200);
      });
    }

    const nextBtn = document.getElementById('nextLevelBtn');
    if (nextBtn) {
      nextBtn.disabled = this.currentLevelIdx >= CONFIG.LEVELS - 1;
      nextBtn.style.opacity = nextBtn.disabled ? '0.4' : '1';
    }

    this._setScreen('levelComplete');
  }

  _gameOver() {
    this.state = 'gameOver';
    this.sound.die();
    this.sound.stopBG();

    document.getElementById('goScore').textContent = this.score.toLocaleString();
    document.getElementById('goDistance').textContent = Math.floor(this.distance) + 'm';
    document.getElementById('goTime').textContent = this._elapsed();
    document.getElementById('goLevel').textContent = `LVL ${this.currentLevelIdx + 1}`;

    this._setScreen('gameOver');
  }

  _elapsed() {
    const ms = Date.now() - this.startTime;
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  }

  // ── Score & Combo ─────────────────────────────────────────
  _addScore(pts, reason) {
    const mult = this.combo > 0 ? 1 + this.combo * 0.3 : 1;
    this.score += Math.floor(pts * mult);
    this._updateHUD();
  }

  _incrementCombo() {
    this.combo++;
    if (this.comboTimer) clearTimeout(this.comboTimer);
    this.comboTimer = setTimeout(() => { this.combo = 0; this._updateHUD(); }, CONFIG.COMBO_TIMEOUT);
    this.sound.combo(this.combo);
    this._showComboBanner();
  }

  _showComboBanner() {
    const banner = document.getElementById('comboBanner');
    if (!banner) return;
    if (this.combo < 2) { banner.classList.remove('show'); return; }
    const labels = ['', '', 'DOUBLE SWING!', 'TRIPLE HERO!', 'QUAD MASTER!', 'PENTA LEGEND!'];
    banner.textContent = labels[Math.min(this.combo, labels.length - 1)] || `×${this.combo} COMBO!`;
    banner.classList.remove('show');
    requestAnimationFrame(() => banner.classList.add('show'));
    setTimeout(() => banner.classList.remove('show'), 2000);
  }

  _updateHUD() {
    const el = (id) => document.getElementById(id);
    if (el('hudScore')) el('hudScore').textContent = this.score.toLocaleString();
    if (el('hudCombo')) el('hudCombo').textContent = this.combo > 0 ? `×${this.combo}` : '×0';
    if (el('hudSpeed')) {
      const spd = Math.floor(this.currentSpeed);
      el('hudSpeed').textContent = spd.toString();
    }
    if (el('hudDistance')) el('hudDistance').textContent = Math.floor(this.distance) + 'm';
    if (el('hudLevel')) el('hudLevel').textContent = `LVL ${this.currentLevelIdx + 1}`;

    // Progress bar
    if (this.world && el('progressFill')) {
      const pct = clamp(this.player ? this.player.x / this.world.worldWidth * 100 : 0, 0, 100);
      el('progressFill').style.width = pct + '%';
    }
  }

  _toggleSound() {
    this.soundOn = this.sound.toggle();
    const btn = document.getElementById('soundBtn');
    if (btn) btn.textContent = this.soundOn ? '🔊' : '🔇';
    this._showToast(this.soundOn ? 'Sound ON' : 'Sound OFF');
  }

  _showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  // ── Screen Manager ────────────────────────────────────────
  _setScreen(name) {
    const screens = {
      start: 'startScreen',
      tutorial: 'tutorialScreen',
      levelSelect: 'levelScreen',
      playing: null,
      paused: 'pauseScreen',
      levelComplete: 'levelCompleteScreen',
      gameOver: 'gameOverScreen',
    };

    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('hud')?.classList.add('hidden');
    document.getElementById('mobileControls')?.classList.add('hidden');
    document.getElementById('comboBanner')?.classList.remove('show');

    const screenId = screens[name];
    if (screenId) {
      document.getElementById(screenId)?.classList.remove('hidden');
    }

    if (name === 'playing') {
      document.getElementById('hud')?.classList.remove('hidden');
      const isMobile = /Mobi|Android|Touch/i.test(navigator.userAgent) || window.innerWidth < 1024;
      if (isMobile) document.getElementById('mobileControls')?.classList.remove('hidden');
    }
  }

  // ── Main Loop ─────────────────────────────────────────────
  _loop(currentTime) {
    requestAnimationFrame((t) => this._loop(t));

    const deltaTime = currentTime - (this.lastTime || currentTime);
    this.lastTime = currentTime;

    // Cap delta time to prevent spiraling (max 100ms)
    const dt = Math.min(deltaTime, 100) / 16.666; 

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    if (this.state === 'playing') {
      const ts = this.timeScale * dt; 
      this._updatePlaying(ts);
      this._drawPlaying();
    } else if (this.state === 'paused') {
      this._drawPlaying();
    } else {
      this._drawBgAnimation();
    }

    this.frame++;
  }

  // ── Playing Update ────────────────────────────────────────
  _updatePlaying(dt = 1) {
    if (!this.player || !this.world) return;

    // Smooth timeScale lerp
    this.timeScale = lerp(this.timeScale, (this.swingHeld && this.player.ropeAttached) ? 0.75 : 1.0, 0.1);
    
    const ts = this.timeScale;

    // Update world (moving obstacles, zones)
    this.world.update(ts);
    this.sky.update(this.currentLevelIdx + 1, ts);

    // Update player physics (with timescale)
    this.player.update(this.world.groundY, this.world.obstacles, ts);

    // Check speed zones
    for (const sz of this.world.speedZones) {
      if (sz.contains(this.player.x, this.player.y)) {
        this.player.speedBoost = 1.6; // Stronger boost
        this._addScore(5, 'SPEED');
      }
    }

    // Goal check
    if (this.world.goalZone && this.world.goalZone.contains(this.player.x, this.player.y)) {
      this._addScore(1000, 'GOAL');
      setTimeout(() => this._levelComplete(), 200);
    }

    // Update distance
    const newDist = Math.max(this.player.x / 8, this.distance);
    if (newDist > this.distance + 0.5) {
      this._addScore(1, 'DIST');
      this.distance = newDist;
    }

    // Speed for HUD
    this.currentSpeed = Math.hypot(
      this.player.ropeAttached ? this.player.ropeAngVel * this.player.ropeLen : this.player.vx,
      this.player.ropeAttached ? 0 : this.player.vy
    ) * 2;

    // Combo tracking (increment on each swing release)
    if (this.player.swingCount > this._lastSwingCount) {
      this._lastSwingCount = this.player.swingCount;
      this._incrementCombo();
    }

    // Camera follow with smooth lerp
    const targetCamX = this.player.x - this.W * 0.4;
    this.camX = lerp(this.camX, targetCamX, 0.045); // Cinematic camera follow
    this.camX = Math.max(0, this.camX);

    // Particles for fast movement
    if (this.currentSpeed > 12) {
      this.particles.emit(this.player.x, this.player.y, {
        count: 2, size: 2, speed: 2, gravity: 0.02,
        color: `hsl(${180 + this.currentSpeed * 2}, 100%, 70%)`,
        decay: 0.06,
      });
    }

    // Speed lines
    this.speedLineAlpha = clamp(lerp(this.speedLineAlpha, this.currentSpeed / 30, 0.1), 0, 0.85);
    const sl = document.getElementById('speedLines');
    if (sl) sl.style.opacity = this.speedLineAlpha;

    // Screen shake
    if (this.screenShake > 0) this.screenShake *= 0.85;

    // Update particles
    this.particles.update();

    // HUD update
    if (this.frame % 3 === 0) this._updateHUD();

    // Grace period countdown
    if (this._graceFrames > 0) this._graceFrames--;

    // Death check (not during grace)
    if (this.player.dead && this._graceFrames <= 0) {
      this.screenShake = 12;
      this.particles.emit(this.player.x - this.camX, this.player.y, {
        count: 22, size: 8, speed: 5, glow: true,
        color: '#ff4444', decay: 0.025,
      });
      setTimeout(() => this._gameOver(), 500);
    }

    // Goal check (removed redundant check)
    if (this.world.goalZone && this.world.goalZone.contains(this.player.x, this.player.y)) {
      if (!this._completed) {
        this._completed = true;
        this._addScore(1000, 'GOAL');
        setTimeout(() => this._levelComplete(), 200);
      }
    }

    // Out-of-bounds: fell off map
    if (this.player.y > this.H + 200 && this._graceFrames <= 0) {
      this.player.dead = true;
    }

    // Reset death flag during grace period
    if (this._graceFrames > 0 && this.player.dead) {
      this.player.dead = false;
      this.player.vx = Math.max(1, this.player.vx);
      this.player.vy = Math.min(this.player.vy, 0);
    }
  }

  // ── Drawing ───────────────────────────────────────────────
  _drawPlaying() {
    const ctx = this.ctx;

    // Screen shake
    let shakeX = 0, shakeY = 0;
    if (this.screenShake > 0.5) {
      shakeX = (Math.random() - 0.5) * this.screenShake;
      shakeY = (Math.random() - 0.5) * this.screenShake;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Sky
    if (this.sky) this.sky.draw(ctx, this.camX, this.currentLevelIdx + 1);

    // World
    if (this.world) this.world.draw(ctx, this.camX, 0);

    // Particles
    this.particles.draw(ctx, this.camX, 0);

    // Hover anchor hints
    this._drawAnchorHints(ctx);

    // Player
    if (this.player && !this.player.dead) this.player.draw(ctx, this.camX, 0);

    // Vignette
    this._drawVignette(ctx);

    // Speed lines
    if (this.speedLineAlpha > 0.1) this._drawSpeedLines(ctx);

    ctx.restore();
  }

  _drawAnchorHints(ctx) {
    if (!this.player || this.player.ropeAttached || !this.world) return;
    const anchor = this.world.findNearestAnchor(this.player.x, this.player.y, CONFIG.MAX_ROPE_LEN + 80);
    if (!anchor) return;

    const sx = anchor.x - this.camX;
    const sy = anchor.y;
    const px = this.player.x - this.camX;
    const py = this.player.y;
    const d = dist(px, py, sx, sy);

    const alpha = clamp(1 - d / (CONFIG.MAX_ROPE_LEN + 80), 0, 1);

    ctx.save();
    ctx.globalAlpha = alpha * 0.5;

    // Dashed hint line
    ctx.strokeStyle = 'rgba(0,212,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -(this.frame * 0.5) % 14;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pulsing ring at anchor
    const ring = (0.6 + 0.4 * Math.sin(this.frame * 0.12)) * 16;
    ctx.strokeStyle = 'rgba(0,212,255,0.9)';
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.8;
    ctx.beginPath();
    ctx.arc(sx, sy, ring, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  _drawVignette(ctx) {
    const cw = this.W, ch = this.H;
    const grad = ctx.createRadialGradient(cw/2, ch/2, cw*0.25, cw/2, ch/2, cw*0.75);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
  }

  _drawSpeedLines(ctx) {
    const cw = this.W, ch = this.H;
    const cx = cw / 2, cy = ch / 2;
    ctx.save();
    ctx.globalAlpha = this.speedLineAlpha * 0.4;
    ctx.strokeStyle = 'rgba(0,212,255,0.6)';
    ctx.lineWidth = 1;
    const lines = 24;
    for (let i = 0; i < lines; i++) {
      const angle = (i / lines) * Math.PI * 2;
      const r1 = cw * 0.3;
      const r2 = cw * 0.6 + Math.random() * 80;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawBgAnimation() {
    const ctx = this.ctx;
    if (this.sky) this.sky.draw(ctx, 0, 1);

    // Ambient city silhouette
    const ch = this.H, cw = this.W;
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,30,0.7)';
    ctx.fillRect(0, ch * 0.55, cw, ch * 0.45);

    // Simple parallax buildings in bg
    const t = this.frame * 0.002;
    for (let i = 0; i < 12; i++) {
      const bx = ((i * 130 - (this.frame * 0.2)) % (cw + 130)) - 30;
      const bh = 80 + Math.sin(i * 1.7) * 60;
      ctx.fillStyle = `rgba(${8+i*3},${12+i*2},${40+i*4},0.9)`;
      ctx.fillRect(bx, ch * 0.55 - bh, 100 + i * 5, bh);
    }
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  window.game = new RopeHeroGame();
  game._showStart();
  game.sound.init();
});
