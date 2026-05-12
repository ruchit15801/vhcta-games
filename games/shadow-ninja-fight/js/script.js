/* ============================================================
   SHADOW NINJA FIGHT — COMPLETE GAME ENGINE
   Version 1.0 | Canvas + Vanilla JS | Fully Responsive
   ============================================================ */

'use strict';

// ─── CONSTANTS ───────────────────────────────────────────────
const C = {
  FPS: 60,
  GRAVITY: 0.65,
  FLOOR_Y: 0,          // set dynamically
  JUMP_FORCE: -18,
  PLAYER_SPEED: 5.5,
  SHADOW_ALPHA: 0.88,

  // Combat
  PUNCH_DMG: 12,
  KICK_DMG: 18,
  SPECIAL_DMG: 30,
  BLOCK_REDUCE: 0.25,
  COMBO_TIMEOUT: 1400,  // ms between hits to keep combo
  MAX_COMBO: 40,

  // Energy
  ENERGY_MAX: 100,
  ENERGY_REGEN: 0.3,
  ENERGY_COST_SPECIAL: 35,
  ENERGY_COST_SHADOWMODE: 50,

  // Round
  ROUND_TIME: 90,
  MAX_ROUNDS: 3,

  // Colours (canvas)
  PLAYER_BASE: '#1a0a30',
  PLAYER_GLOW: '#c8102e',
  ENEMY_BASE:  '#0a1a30',
  ENEMY_GLOW:  '#00cfff',
  PARTICLE_FIRE: ['#ff4d00','#ffd700','#c8102e','#ff7300'],
  PARTICLE_ICE:  ['#00cfff','#0080ff','#00e5ff','#ffffff'],
};

// ─── AUDIO ENGINE ────────────────────────────────────────────
const Audio = (() => {
  let ctx = null, muted = false, bgGain = null, nextBeatTime = 0;
  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function createOscBuffer(freq, type, dur, attack, decay, vol = 0.5) {
    try {
      const c = getCtx();
      const src = c.createOscillator();
      const gain = c.createGain();
      src.connect(gain);
      gain.connect(c.destination);
      src.type = type;
      src.frequency.setValueAtTime(freq, c.currentTime);
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(muted ? 0 : vol, c.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      src.start(c.currentTime);
      src.stop(c.currentTime + dur + 0.05);
    } catch(e) {}
  }

  function noise(dur, vol = 0.3) {
    try {
      const c = getCtx();
      const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const filt = c.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 800;
      const gain = c.createGain();
      gain.gain.setValueAtTime(muted ? 0 : vol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      src.connect(filt); filt.connect(gain); gain.connect(c.destination);
      src.start(); src.stop(c.currentTime + dur + 0.05);
    } catch(e) {}
  }

  return {
    punch()   { noise(0.08, 0.4); createOscBuffer(180, 'sine', 0.12, 0.005, 0.1, 0.3); },
    kick()    { noise(0.12, 0.5); createOscBuffer(100, 'sawtooth', 0.18, 0.005, 0.15, 0.35); },
    hit()     { noise(0.18, 0.6); createOscBuffer(80, 'square', 0.25, 0.005, 0.2, 0.4); },
    special() { createOscBuffer(300, 'sine', 0.05, 0.005, 0.04, 0.5); createOscBuffer(600, 'sine', 0.3, 0.01, 0.25, 0.4); noise(0.2, 0.3); },
    combo()   { [440,550,660,880].forEach((f,i) => setTimeout(() => createOscBuffer(f,'sine',0.15,0.01,0.12,0.35), i*80)); },
    block()   { noise(0.06, 0.35); createOscBuffer(250, 'square', 0.1, 0.005, 0.09, 0.25); },
    win()     { [523,659,784,1047].forEach((f,i) => setTimeout(() => createOscBuffer(f,'sine',0.4,0.02,0.35,0.4), i*120)); },
    lose()    { [440,349,294,220].forEach((f,i) => setTimeout(() => createOscBuffer(f,'sawtooth',0.5,0.02,0.45,0.3), i*150)); },
    ui()      { createOscBuffer(520, 'sine', 0.1, 0.005, 0.09, 0.2); },
    startBg() {
      // Generate a subtle procedural beat
      if (muted) return;
      function scheduleBeat() {
        try {
          const c = getCtx();
          const t = c.currentTime;
          if (t >= nextBeatTime - 0.1) {
            const g = c.createGain();
            g.gain.setValueAtTime(muted ? 0 : 0.06, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            g.connect(c.destination);
            const o = c.createOscillator();
            o.type = 'sine'; o.frequency.value = 55;
            o.connect(g); o.start(t); o.stop(t + 0.3);
            // hi-hat
            const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            const s = c.createBufferSource(); s.buffer = buf;
            const gHat = c.createGain();
            gHat.gain.setValueAtTime(muted ? 0 : 0.04, t + 0.25);
            gHat.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            s.connect(gHat); gHat.connect(c.destination);
            s.start(t + 0.25); s.stop(t + 0.31);
            nextBeatTime = t + 0.5;
          }
        } catch(e) {}
        bgTimer = setTimeout(scheduleBeat, 400);
      }
      scheduleBeat();
    },
    stopBg() { clearTimeout(bgTimer); bgTimer = null; },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
  };
})();
let bgTimer = null;

// ─── PARTICLE SYSTEM ─────────────────────────────────────────
class Particle {
  constructor(x, y, vx, vy, color, size, life, gravity = 0) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.size = size; this.life = life;
    this.maxLife = life; this.gravity = gravity; this.alpha = 1;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.life -= dt;
    this.alpha = Math.max(0, this.life / this.maxLife);
    this.size *= 0.985;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha * C.SHADOW_ALPHA;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = this.size * 3;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() { this.particles = []; }
  spawn(x, y, opts = {}) {
    const count = opts.count || 12;
    const colors = opts.colors || C.PARTICLE_FIRE;
    for (let i = 0; i < count; i++) {
      const angle = (opts.angle || 0) + (Math.random() - 0.5) * (opts.spread || Math.PI * 2);
      const speed = (opts.speed || 4) * (0.5 + Math.random());
      this.particles.push(new Particle(
        x + (Math.random() - 0.5) * (opts.scatter || 10),
        y + (Math.random() - 0.5) * (opts.scatter || 10),
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        colors[Math.floor(Math.random() * colors.length)],
        opts.size || (2 + Math.random() * 3),
        opts.life || (0.5 + Math.random() * 0.5),
        opts.gravity || 0.15
      ));
    }
  }
  update(dt) {
    this.particles = this.particles.filter(p => { p.update(dt); return p.life > 0; });
  }
  draw(ctx) { this.particles.forEach(p => p.draw(ctx)); }
  clear() { this.particles = []; }
}

// ─── COMBO SEQUENCE DETECTOR ──────────────────────────────────
const COMBOS = [
  { seq: ['punch','punch','kick'],         name: 'Shadow Strike',   dmgMulti: 1.8, special: 'flash',    energyCost: 0 },
  { seq: ['kick','kick','punch'],          name: 'Tornado Kick',    dmgMulti: 2.0, special: 'knockback',energyCost: 0 },
  { seq: ['punch','kick','punch','punch'], name: 'Dragon Barrage',  dmgMulti: 2.5, special: 'stun',     energyCost: 0 },
  { seq: ['kick','punch','kick','kick'],   name: 'Rising Storm',    dmgMulti: 2.8, special: 'knockup',  energyCost: 0 },
  { seq: ['punch','punch','punch','kick','kick'], name: 'Inferno Fury', dmgMulti: 3.5, special: 'burn', energyCost: 0 },
  { seq: ['special'],                      name: 'Power Strike',    dmgMulti: 1.0, special: 'explosion',energyCost: C.ENERGY_COST_SPECIAL },
];

class ComboDetector {
  constructor() {
    this.buffer = [];
    this.timer = 0;
    this.active = false;
  }
  push(move) {
    this.buffer.push(move);
    if (this.buffer.length > 8) this.buffer.shift();
    this.timer = C.COMBO_TIMEOUT;
    // check from longest combos first
    for (let combo of [...COMBOS].sort((a,b) => b.seq.length - a.seq.length)) {
      const seq = combo.seq;
      if (this.buffer.length >= seq.length) {
        const tail = this.buffer.slice(-seq.length);
        if (tail.every((m,i) => m === seq[i])) {
          this.buffer = [];
          return combo;
        }
      }
    }
    return null;
  }
  tick(dt) {
    if (this.timer > 0) {
      this.timer -= dt * 1000;
      if (this.timer <= 0) { this.buffer = []; this.timer = 0; }
    }
  }
}

// ─── FIGHTER (base class) ─────────────────────────────────────
class Fighter {
  constructor(cfg) {
    this.id = cfg.id;
    this.x = cfg.x;
    this.y = C.FLOOR_Y;
    this.w = cfg.w || 60;
    this.h = cfg.h || 110;
    this.facing = cfg.facing || 1; // 1=right, -1=left
    this.color = cfg.color;
    this.glowColor = cfg.glowColor;

    this.hp = cfg.maxHp || 100;
    this.maxHp = cfg.maxHp || 100;
    this.energy = C.ENERGY_MAX;

    this.vx = 0; this.vy = 0;
    this.onGround = true;
    this.blocking = false;
    this.stunned = false;
    this.stunTimer = 0;
    this.shadowMode = false;
    this.shadowTimer = 0;

    // Animation state
    this.state = 'idle'; // idle | walk | jump | punch | kick | special | hurt | block | dead
    this.stateTimer = 0;
    this.animFrame = 0;
    this.animTick = 0;

    // Hit recovery
    this.hitFlash = 0;
    this.knockbackX = 0;

    // Damage dealt this fight
    this.totalDmg = 0;
    this.maxCombo = 0;

    // Skill modifiers
    this.dmgMult = 1;
    this.speedMult = 1;
    this.defMult = 1;
    this.shadow  = false;
  }

  get centerX() { return this.x + this.w / 2; }
  get centerY() { return this.y + this.h / 2; }
  get hitboxX()  { return this.x + this.w * 0.1; }
  get hitboxW()  { return this.w * 0.8; }

  takeDamage(amount, knockback = 8, { stun = false, knockup = false } = {}) {
    if (this.state === 'dead') return 0;
    let dmg = amount;
    if (this.blocking) dmg = Math.max(1, dmg * C.BLOCK_REDUCE);
    if (this.shadowMode) dmg *= 0.3;
    this.hp = Math.max(0, this.hp - dmg);
    this.hitFlash = 8;
    this.vx -= knockback * (this.facing); // push back
    if (knockup) this.vy = -14;
    if (!this.blocking) {
      this.setState('hurt');
      this.stateTimer = stun ? 40 : 20;
      this.stunned = stun;
      this.stunTimer = stun ? 45 : 0;
    }
    if (this.hp <= 0) this.setState('dead');
    return dmg;
  }

  setState(s) {
    if (this.state === 'dead' && s !== 'dead') return;
    this.state = s;
    this.stateTimer = 0;
    this.animFrame = 0;
  }

  get isAttacking() {
    return ['punch','kick','special'].includes(this.state);
  }
  get isDead() { return this.state === 'dead'; }
  get isHurt() { return this.state === 'hurt'; }

  updatePhysics(canvasW) {
    this.y += this.vy;
    this.x += this.vx * this.speedMult;
    this.vy += C.GRAVITY;

    if (this.knockbackX !== 0) {
      this.x += this.knockbackX;
      this.knockbackX *= 0.75;
      if (Math.abs(this.knockbackX) < 0.5) this.knockbackX = 0;
    }

    // Floor
    if (this.y >= C.FLOOR_Y) {
      this.y = C.FLOOR_Y;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Walls
    const minX = 20, maxX = canvasW - this.w - 20;
    if (this.x < minX) { this.x = minX; this.vx = 0; }
    if (this.x > maxX) { this.x = maxX; this.vx = 0; }

    // Friction
    if (this.onGround) this.vx *= 0.8;

    // Timers
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.stunTimer > 0) { this.stunTimer--; if (this.stunTimer === 0) this.stunned = false; }
    if (this.shadowTimer > 0) { this.shadowTimer--; if (this.shadowTimer === 0) this.shadowMode = false; }

    // State timers
    if (this.stateTimer > 0) {
      this.stateTimer--;
      if (this.stateTimer === 0 && !this.isDead) {
        if (this.state === 'hurt' || this.isAttacking) {
          this.setState(this.onGround ? 'idle' : 'jump');
        }
      }
    }

    // Energy regen
    this.energy = Math.min(C.ENERGY_MAX, this.energy + C.ENERGY_REGEN);

    // State auto transitions
    if (!this.stateTimer && !this.stunned && !this.isAttacking && !this.isHurt && !this.isDead) {
      if (!this.onGround) this.state = 'jump';
      else if (Math.abs(this.vx) > 0.5) this.state = 'walk';
      else if (!['block','idle'].includes(this.state)) this.state = 'idle';
    }
  }

  // ─── DRAW ────────────────────────────────────────────────────
  draw(ctx, particles) {
    ctx.save();

    const x = this.x + this.w / 2;
    const y = this.y + this.h;
    const flip = this.facing < 0;
    const t = Date.now() / 1000;

    // Shadow on floor
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, C.FLOOR_Y + this.h + 4, this.w * 0.45, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body transform
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);

    // Shadow mode aura
    if (this.shadowMode) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 8);
      ctx.shadowBlur = 40;
      ctx.shadowColor = this.glowColor;
      ctx.fillStyle = this.glowColor;
      ctx.beginPath();
      ctx.ellipse(0, -this.h / 2, this.w * 0.8, this.h * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Attack glow
    if (this.isAttacking) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.shadowBlur = 30;
      ctx.shadowColor = this.glowColor;
      ctx.strokeStyle = this.glowColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -this.h / 2, this.w * 0.6, this.h * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw silhouette body
    const scaleY = this.isDead ? 0.3 : 1;
    const offsetY = this.isDead ? this.h * 0.3 : 0;
    const bobY = (this.state === 'idle') ? Math.sin(t * 3) * 1.5 : 0;
    const hurtShake = this.hitFlash > 0 ? (Math.random() - 0.5) * 6 : 0;

    ctx.save();
    ctx.translate(hurtShake, bobY - offsetY);
    ctx.scale(1, scaleY);
    this._drawBody(ctx, t);
    ctx.restore();

    ctx.restore(); // body transform

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = (this.hitFlash / 8) * 0.6;
      ctx.fillStyle = '#fff';
      ctx.translate(x, y);
      if (flip) ctx.scale(-1, 1);
      this._drawBodyOutline(ctx);
      ctx.restore();
    }

    // Spawn particles on attacks
    if (this.state === 'punch' && this.stateTimer === 14 && particles) {
      const px = this.x + (this.facing > 0 ? this.w : 0);
      particles.spawn(px, this.y + this.h * 0.35, {
        count: 8, colors: C.PARTICLE_FIRE,
        angle: this.facing > 0 ? 0 : Math.PI,
        spread: 0.8, speed: 5, size: 3, life: 0.3
      });
    }
    if (this.state === 'kick' && this.stateTimer === 12 && particles) {
      const px = this.x + (this.facing > 0 ? this.w : 0);
      particles.spawn(px, this.y + this.h * 0.65, {
        count: 10, colors: C.PARTICLE_FIRE,
        angle: this.facing > 0 ? 0 : Math.PI,
        spread: 0.6, speed: 7, size: 4, life: 0.35
      });
    }
    if (this.state === 'special' && this.stateTimer === 22 && particles) {
      particles.spawn(this.centerX, this.centerY, {
        count: 20, colors: [...C.PARTICLE_FIRE, '#ffd700'],
        spread: Math.PI * 2, speed: 8, size: 5, life: 0.6
      });
    }
  }

  _drawBody(ctx, t) {
    const h = this.h;
    const riseKnee = (this.state === 'kick') ? -20 : 0;
    const punchArm = this.isAttacking ? 20 : 0;

    ctx.fillStyle = this.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.glowColor;
    ctx.globalAlpha = C.SHADOW_ALPHA;

    // Head
    ctx.beginPath();
    ctx.ellipse(0, -h + 14, 13, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes glow
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.glowColor;
    ctx.fillStyle = this.glowColor;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(5, -h + 11, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Torso
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(-14, -h + 28);
    ctx.lineTo(14, -h + 28);
    ctx.lineTo(12, -h + 70);
    ctx.lineTo(-12, -h + 70);
    ctx.closePath();
    ctx.fill();

    // Belt glow
    ctx.save();
    ctx.fillStyle = this.glowColor;
    ctx.globalAlpha = 0.4;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.glowColor;
    ctx.fillRect(-14, -h + 62, 28, 5);
    ctx.restore();

    // Left arm
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(-14, -h + 30);
    ctx.lineTo(-24, -h + 55 + (this.blocking ? -10 : 0));
    ctx.lineTo(-19, -h + 58 + (this.blocking ? -10 : 0));
    ctx.lineTo(-12, -h + 36);
    ctx.closePath();
    ctx.fill();

    // Right arm (punch)
    ctx.beginPath();
    ctx.moveTo(14, -h + 30);
    ctx.lineTo(24 + punchArm, -h + 50 - punchArm * 0.3);
    ctx.lineTo(19 + punchArm, -h + 55 - punchArm * 0.3);
    ctx.lineTo(12, -h + 36);
    ctx.closePath();
    ctx.fill();

    // Legs
    // Left leg
    ctx.beginPath();
    ctx.moveTo(-8, -h + 70);
    ctx.lineTo(-14, -h + 100);
    ctx.lineTo(-8, -h + 103);
    ctx.lineTo(-5, -h + 72);
    ctx.closePath();
    ctx.fill();

    // Right leg (kick)
    ctx.beginPath();
    ctx.moveTo(5, -h + 72);
    ctx.lineTo(14, -h + 100 + riseKnee);
    ctx.lineTo(8, -h + 103 + riseKnee);
    ctx.lineTo(8, -h + 70);
    ctx.closePath();
    ctx.fill();

    // Weapon / scarf trail
    if (this.isAttacking || this.state === 'walk') {
      ctx.save();
      ctx.strokeStyle = this.glowColor;
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.glowColor;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -h + 30);
      ctx.quadraticCurveTo(-20 + punchArm, -h + 20 + punchArm, -30 - punchArm, -h + 10 + Math.sin(t * 8) * 5);
      ctx.stroke();
      ctx.restore();
    }

    // Jump pose
    if (!this.onGround) {
      ctx.save();
      ctx.fillStyle = this.glowColor;
      ctx.globalAlpha = 0.15;
      ctx.shadowBlur = 25;
      ctx.shadowColor = this.glowColor;
      ctx.beginPath();
      ctx.ellipse(0, -h / 2, this.w * 0.5, this.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  _drawBodyOutline(ctx) {
    const h = this.h;
    ctx.beginPath();
    ctx.ellipse(0, -h + 14, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-15, -h + 28, 30, 75);
  }
}

// ─── ENEMY AI ─────────────────────────────────────────────────
const EnemyTypes = {
  basic: {
    name: 'Shadow Grunt',
    maxHp: 80, color: '#0a1020', glowColor: '#5080ff',
    speed: 1.0, aggressiveness: 0.5, blockChance: 0.2,
    attackDelay: [60, 90], retreatChance: 0.1,
    punchDmgScale: 0.9, kickDmgScale: 0.9,
  },
  fast: {
    name: 'Shadow Blade',
    maxHp: 65, color: '#1a0a25', glowColor: '#a040ff',
    speed: 1.7, aggressiveness: 0.7, blockChance: 0.15,
    attackDelay: [30, 55], retreatChance: 0.15,
    punchDmgScale: 0.8, kickDmgScale: 0.8,
  },
  heavy: {
    name: 'Iron Shadow',
    maxHp: 140, color: '#1a1010', glowColor: '#ff8000',
    speed: 0.6, aggressiveness: 0.4, blockChance: 0.35,
    attackDelay: [80, 120], retreatChance: 0.05,
    punchDmgScale: 1.4, kickDmgScale: 1.4,
  },
  boss: {
    name: 'Dark Lord',
    maxHp: 250, color: '#150010', glowColor: '#ff0066',
    speed: 1.1, aggressiveness: 0.8, blockChance: 0.4,
    attackDelay: [40, 70], retreatChance: 0.2,
    punchDmgScale: 1.6, kickDmgScale: 1.8,
    phases: 3,
  },
};

class Enemy extends Fighter {
  constructor(type, x, canvasW, levelNum) {
    const cfg = EnemyTypes[type];
    const scale = 1 + levelNum * 0.025; // Scale HP and damage with level
    super({
      id: 'enemy',
      x, facing: -1,
      w: type === 'heavy' || type === 'boss' ? 72 : 60,
      h: type === 'heavy' || type === 'boss' ? 120 : 110,
      maxHp: Math.floor(cfg.maxHp * scale),
      color: cfg.color,
      glowColor: cfg.glowColor,
    });
    this.type = type;
    this.typeCfg = cfg;
    this.name = cfg.name + (type === 'boss' ? ` Lv.${levelNum}` : '');
    this.aiTimer = 0;
    this.aiState = 'approach';
    this.aiTarget = null;
    this.canvasW = canvasW;
    this.speed = C.PLAYER_SPEED * cfg.speed;
    this.levelScale = scale;
    this.phase = 1;
    this.comboCount = 0;
    this.comboMax = type === 'boss' ? 4 : (type === 'fast' ? 3 : 2);
  }

  facePlayer(player) {
    this.facing = player.centerX < this.centerX ? -1 : 1;
  }

  ai(player, dt) {
    if (this.isDead || this.stunned || this.isAttacking || this.isHurt) return;
    this.facePlayer(player);

    const dx = player.centerX - this.centerX;
    const dist = Math.abs(dx);
    const cfg = this.typeCfg;

    // Boss phase transitions
    if (this.type === 'boss') {
      const hpPct = this.hp / this.maxHp;
      if (hpPct < 0.66 && this.phase === 1) {
        this.phase = 2;
        this.speed *= 1.2;
        this.typeCfg = { ...cfg, aggressiveness: 0.9 };
      }
      if (hpPct < 0.33 && this.phase === 2) {
        this.phase = 3;
        this.typeCfg = { ...cfg, aggressiveness: 1.0, blockChance: 0.1 };
        this.shadowMode = true; this.shadowTimer = 9999;
      }
    }

    this.aiTimer -= dt * 60;

    if (this.aiTimer > 0) return;

    const [minDelay, maxDelay] = cfg.attackDelay;
    const agr = cfg.aggressiveness;
    const attackRange = 90;

    if (dist < attackRange) {
      // In range
      if (Math.random() < cfg.blockChance && player.isAttacking) {
        this.blocking = true;
        this.state = 'block';
        this.aiTimer = 20;
        return;
      }
      this.blocking = false;

      if (Math.random() < agr) {
        // Attack
        if (Math.random() < cfg.retreatChance) {
          this.vx = -this.facing * this.speed * 1.5;
          this.aiTimer = 20;
        } else {
          this.comboCount++;
          if (this.comboCount < this.comboMax) {
            this.aiTimer = Math.floor(Math.random() * (maxDelay - minDelay) + minDelay) * 0.5;
          } else {
            this.comboCount = 0;
            this.aiTimer = Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
          }
          const r = Math.random();
          if (r < 0.4) return [this.doAttack('punch')];
          if (r < 0.75) return [this.doAttack('kick')];
          if (this.energy >= C.ENERGY_COST_SPECIAL && Math.random() < 0.3) return [this.doAttack('special')];
          return [this.doAttack('punch')];
        }
      } else {
        // Retreat or wait
        this.vx = -this.facing * this.speed * 0.5;
        this.aiTimer = 15;
      }
    } else {
      // Approach
      this.blocking = false;
      this.vx = this.facing * this.speed;
      this.aiTimer = 5;
    }
  }

  doAttack(type) {
    this.setState(type);
    this.stateTimer = type === 'special' ? 30 : type === 'kick' ? 22 : 18;
    if (type === 'special') this.energy -= C.ENERGY_COST_SPECIAL;
    return type;
  }

  getAttackData() {
    const cfg = this.typeCfg;
    if (this.state === 'punch') return { dmg: C.PUNCH_DMG * cfg.punchDmgScale * this.levelScale, hitFrame: 10, range: 85 };
    if (this.state === 'kick')  return { dmg: C.KICK_DMG * cfg.kickDmgScale * this.levelScale, hitFrame: 14, range: 95 };
    if (this.state === 'special') return { dmg: C.SPECIAL_DMG * cfg.punchDmgScale * this.levelScale, hitFrame: 20, range: 100 };
    return null;
  }
}

// ─── LEVEL DEFINITION SYSTEM ──────────────────────────────────
function buildLevels() {
  const levels = [];
  for (let i = 1; i <= 40; i++) {
    let enemies = [];
    let bg = 'temple';
    let timeLimit = 90;

    if (i <= 3) {
      enemies = [{ type: 'basic', count: 1 }];
      bg = 'temple';
    } else if (i <= 7) {
      enemies = [{ type: 'fast', count: 1 }];
      bg = 'temple';
    } else if (i <= 10) {
      enemies = [{ type: 'basic', count: 1 }, { type: 'fast', count: 1 }];
      bg = 'arena';
      timeLimit = 80;
    } else if (i <= 15) {
      enemies = [{ type: 'heavy', count: 1 }];
      bg = 'arena';
      timeLimit = 75;
    } else if (i <= 20) {
      enemies = [{ type: 'fast', count: 2 }];
      bg = 'night';
      timeLimit = 70;
    } else if (i === 10 || i === 20 || i === 25 || i === 30 || i === 35 || i === 40) {
      enemies = [{ type: 'boss', count: 1 }];
      bg = 'night';
      timeLimit = 120;
    } else if (i <= 28) {
      enemies = [{ type: 'heavy', count: 1 }, { type: 'fast', count: 1 }];
      bg = 'night';
      timeLimit = 75;
    } else if (i <= 35) {
      enemies = [{ type: 'heavy', count: 1 }, { type: 'basic', count: 2 }];
      bg = 'night';
      timeLimit = 65;
    } else {
      enemies = [{ type: 'boss', count: 1 }, { type: 'fast', count: 1 }];
      bg = 'night';
      timeLimit = 90;
    }

    // Ensure boss levels
    const bossLevels = [10, 20, 25, 30, 35, 40];
    if (bossLevels.includes(i)) {
      enemies = [{ type: 'boss', count: 1 }];
      bg = 'night';
      timeLimit = 120;
    }

    levels.push({
      id: i,
      name: getLevelName(i),
      enemies,
      bg,
      timeLimit,
      isBoss: [10, 20, 25, 30, 35, 40].includes(i),
      reward: i % 5 === 0 ? 150 : 50 + i * 5,
    });
  }
  return levels;
}

function getLevelName(i) {
  const names = [
    'First Blood','Shadow Trial','Street Duel','Blade Rush','Night Stalker',
    'Iron Fist','Crimson Storm','Death Blow','Phantom Strike','BOSS: Shadow Lord',
    'Twin Fangs','Dark Pulse','Void Walker','Blood Moon','Serpent Dance',
    'Iron Rain','Chaos Flame','Ghost Blade','Demon Rush','BOSS: Iron Titan',
    'Hell\'s Gate','Thunder Claw','Shadow Wall','Dark Matter','BOSS: Void King',
    'Crimson Throne','Death March','Bone Crusher','Shadow Realm','BOSS: Umbra',
    'Final Dawn','Soul Reaper','Red Eclipse','Dark Ascension','BOSS: Leviathan',
    'Oblivion Rise','Eternal Night','Armageddon','Omega Rush','BOSS: Dark Lord',
  ];
  return names[i - 1] || `Level ${i}`;
}

// ─── BACKGROUND RENDERER ──────────────────────────────────────
class BackgroundRenderer {
  constructor() { this.t = 0; }
  update(dt) { this.t += dt; }

  draw(ctx, cw, ch, type) {
    if (type === 'temple')  this._temple(ctx, cw, ch);
    else if (type === 'arena') this._arena(ctx, cw, ch);
    else this._night(ctx, cw, ch);
  }

  _temple(ctx, cw, ch) {
    const t = this.t;
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, ch * 0.65);
    sky.addColorStop(0, '#0a0015');
    sky.addColorStop(0.6, '#18003a');
    sky.addColorStop(1, '#2a0010');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);

    // Moon
    ctx.save();
    ctx.beginPath();
    ctx.arc(cw * 0.75, ch * 0.15, 45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,200,255,0.85)';
    ctx.shadowBlur = 40; ctx.shadowColor = 'rgba(180,150,255,0.6)';
    ctx.fill();
    ctx.restore();

    // Pillars
    for (let p = 0; p < 5; p++) {
      const px = cw * 0.1 + p * cw * 0.2;
      const pGrad = ctx.createLinearGradient(px, 0, px + 30, 0);
      pGrad.addColorStop(0, 'rgba(80,20,60,0.6)');
      pGrad.addColorStop(0.5, 'rgba(120,40,80,0.5)');
      pGrad.addColorStop(1, 'rgba(60,10,40,0.6)');
      ctx.fillStyle = pGrad;
      ctx.fillRect(px - 15, ch * 0.1, 30, ch * 0.55);
      // Pillar top
      ctx.fillStyle = 'rgba(150,60,90,0.5)';
      ctx.fillRect(px - 20, ch * 0.08, 40, 14);

      // Glowing rune
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.15 * Math.sin(t * 2 + p);
      ctx.fillStyle = '#c8102e';
      ctx.shadowBlur = 15; ctx.shadowColor = '#c8102e';
      ctx.fillRect(px - 5, ch * 0.3 + p * 15, 10, 14);
      ctx.restore();
    }

    // Floor
    const flrGrad = ctx.createLinearGradient(0, ch * 0.65, 0, ch);
    flrGrad.addColorStop(0, '#1a0020');
    flrGrad.addColorStop(1, '#0d0010');
    ctx.fillStyle = flrGrad;
    ctx.fillRect(0, ch * 0.65, cw, ch * 0.35);

    // Floor pattern
    for (let fx = 0; fx < cw; fx += 60) {
      ctx.save();
      ctx.strokeStyle = 'rgba(180,20,80,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx, ch * 0.65);
      ctx.lineTo(fx, ch);
      ctx.stroke();
      ctx.restore();
    }

    // Floating particles
    for (let i = 0; i < 8; i++) {
      const px = ((cw * 0.15 * i + t * 20 * (i % 2 === 0 ? 1 : -0.5)) % cw + cw) % cw;
      const py = ch * 0.3 + Math.sin(t * 1.5 + i) * ch * 0.12;
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 2 + i * 0.7);
      ctx.fillStyle = i % 2 === 0 ? '#c8102e' : '#ffd700';
      ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _arena(ctx, cw, ch) {
    const t = this.t;
    // Dark sky
    const sky = ctx.createLinearGradient(0, 0, 0, ch * 0.65);
    sky.addColorStop(0, '#050510');
    sky.addColorStop(0.7, '#100520');
    sky.addColorStop(1, '#200010');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);

    // Stars
    for (let s = 0; s < 60; s++) {
      const sx = (s * 137.5) % cw;
      const sy = (s * 97.3) % (ch * 0.5);
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 2 + s);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Arena walls
    const wallGrad = ctx.createLinearGradient(0, ch * 0.1, 0, ch * 0.65);
    wallGrad.addColorStop(0, 'rgba(40,10,20,0.8)');
    wallGrad.addColorStop(1, 'rgba(20,5,10,0.8)');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, ch * 0.1, cw, ch * 0.55);

    // Arena floor
    const aFloor = ctx.createLinearGradient(0, ch * 0.65, 0, ch);
    aFloor.addColorStop(0, '#1e0010');
    aFloor.addColorStop(1, '#0a000a');
    ctx.fillStyle = aFloor;
    ctx.fillRect(0, ch * 0.65, cw, ch * 0.35);

    // Torch lights
    for (let tc = 0; tc < 4; tc++) {
      const tx = cw * (0.15 + tc * 0.23);
      const ty = ch * 0.25;
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 5 + tc);
      ctx.fillStyle = '#ff8000';
      ctx.shadowBlur = 30; ctx.shadowColor = '#ff8000';
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();
      // Light cone
      ctx.globalAlpha = 0.06 + 0.02 * Math.sin(t * 5 + tc);
      const coneGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, 120);
      coneGrad.addColorStop(0, '#ff8000');
      coneGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.arc(tx, ty, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _night(ctx, cw, ch) {
    const t = this.t;
    // Deep night sky
    const sky = ctx.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, '#000005');
    sky.addColorStop(0.5, '#05000f');
    sky.addColorStop(1, '#0a0005');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);

    // Nebula
    ctx.save();
    ctx.globalAlpha = 0.07;
    const nebula = ctx.createRadialGradient(cw * 0.5, ch * 0.3, 0, cw * 0.5, ch * 0.3, cw * 0.6);
    nebula.addColorStop(0, '#8000ff');
    nebula.addColorStop(0.5, '#ff0040');
    nebula.addColorStop(1, 'transparent');
    ctx.fillStyle = nebula;
    ctx.beginPath();
    ctx.ellipse(cw * 0.5, ch * 0.3, cw * 0.6, ch * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Floating shadow rocks
    for (let r = 0; r < 5; r++) {
      const rx = cw * (0.1 + r * 0.2) + Math.sin(t * 0.4 + r) * 15;
      const ry = ch * 0.2 + Math.cos(t * 0.3 + r * 1.4) * 10 + r * 18;
      ctx.save();
      ctx.fillStyle = 'rgba(20,5,30,0.85)';
      ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(100,0,150,0.5)';
      ctx.beginPath();
      ctx.ellipse(rx, ry, 50 + r * 15, 15 + r * 5, 0.1 * r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ground
    const grd = ctx.createLinearGradient(0, ch * 0.65, 0, ch);
    grd.addColorStop(0, '#0d000f');
    grd.addColorStop(1, '#050005');
    ctx.fillStyle = grd;
    ctx.fillRect(0, ch * 0.65, cw, ch * 0.35);

    // Energy lines on floor
    for (let fl = 0; fl < 6; fl++) {
      const flx = (cw * fl / 6 + t * 30) % cw;
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#8000ff';
      ctx.shadowBlur = 8; ctx.shadowColor = '#8000ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(flx, ch * 0.65);
      ctx.lineTo(flx, ch);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ─── MAIN GAME CLASS ──────────────────────────────────────────
class ShadowNinjaFight {
  constructor() {
    // Canvas
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // State
    this.screen = 'loading'; // loading | title | instructions | levelSelect | skill | fight | pause | result
    this.currentLevel = 0;
    this.maxUnlocked = 1;
    this.coins = 0;

    // Skills (each 0–3 levels)
    this.skills = {
      damage:  { level: 0, maxLevel: 3, cost: [80, 160, 320], name: 'Damage Up',   icon: '⚔️', desc: '+20% attack damage per level' },
      speed:   { level: 0, maxLevel: 3, cost: [80, 160, 320], name: 'Shadow Speed',icon: '💨', desc: '+15% movement speed per level' },
      defense: { level: 0, maxLevel: 3, cost: [100, 200, 400], name: 'Iron Guard', icon: '🛡️', desc: '+15% damage reduction per level' },
      health:  { level: 0, maxLevel: 3, cost: [100, 200, 400], name: 'Life Force',  icon: '❤️', desc: '+25 max HP per level' },
      energy:  { level: 0, maxLevel: 3, cost: [60, 120, 240],  name: 'Chi Flow',   icon: '⚡', desc: '+30% energy regen per level' },
      combo:   { level: 0, maxLevel: 3, cost: [120, 240, 480], name: 'Combo Master',icon: '🔥', desc: '+0.3 combo multiplier per level' },
    };

    // Fight state
    this.player = null;
    this.enemies = [];
    this.currentEnemyIdx = 0;
    this.particles = new ParticleSystem();
    this.bgRenderer = new BackgroundRenderer();
    this.comboDetector = new ComboDetector();

    this.roundTimer = 90;
    this.roundTimerFrac = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.roundWins = { player: 0, enemy: 0 };
    this.roundNum = 1;
    this.fightResult = null;

    this.screenShake = 0;
    this.hitStopFrames = 0;
    this.flashAlpha = 0;
    this.slowMoTimer = 0;

    // Input
    this.keys = {};
    this.touchState = {};

    // Level data
    this.levels = buildLevels();

    // RAF
    this.lastTime = 0;
    this.rafId = null;

    // Sound
    this.soundOn = true;

    // Player stats for result
    this.resultStats = { playerDmg: 0, maxCombo: 0, roundTime: 0 };

    this._resize();
    this._setupDOM();
    this._setupInput();
    this._startLoop();
    this._startLoading();
  }

  // ─── RESIZE ────────────────────────────────────────────────
  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Maintain 16:9 with max fit
    let cw = w, ch = h;
    if (w / h > 16 / 9) { cw = Math.floor(h * 16 / 9); ch = h; }
    else { ch = Math.floor(w * 9 / 16); cw = w; }
    // On mobile, allow taller canvas
    if (w < 600) { cw = w; ch = Math.floor(w * 0.7); }
    this.canvas.width = cw;
    this.canvas.height = ch;
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    C.FLOOR_Y = ch * 0.6;
    this.cw = cw; this.ch = ch;
  }

  // ─── LOADING ───────────────────────────────────────────────
  _startLoading() {
    const bar = document.querySelector('.loading-bar-fill');
    const txt = document.querySelector('.loading-text');
    const msgs = ['Initializing engine…','Loading assets…','Building levels…','Preparing shadows…','Ready!'];
    let prog = 0;
    const step = () => {
      prog += 20;
      bar.style.width = prog + '%';
      txt.textContent = msgs[Math.floor(prog / 20) - 1] || 'Ready!';
      if (prog < 100) setTimeout(step, 280);
      else setTimeout(() => { this._showScreen('title'); }, 400);
    };
    setTimeout(step, 200);
  }

  // ─── DOM SETUP ─────────────────────────────────────────────
  _setupDOM() {
    // Screen transitions
    this._showScreen = (name) => {
      document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
      const el = document.getElementById(name + '-screen');
      if (el) el.classList.remove('hidden');
      this.screen = name;
      if (name === 'fight') {
        document.getElementById('hud').classList.remove('hidden');
        this._showTouchControls();
      } else {
        document.getElementById('hud').classList.add('hidden');
        this._hideTouchControls();
      }
    };

    // Buttons
    this._bind('start-btn',      () => { Audio.ui(); this._showScreen('instructions'); });
    this._bind('level-select-btn', () => { Audio.ui(); this._buildLevelSelect(); this._showScreen('levelSelect'); });
    this._bind('skills-btn',     () => { Audio.ui(); this._buildSkillUI(); this._showScreen('skill'); });
    this._bind('inst-start-btn', () => { Audio.ui(); this._startFight(this.currentLevel || 0); });
    this._bind('inst-skip-btn',  () => { Audio.ui(); this._startFight(this.currentLevel || 0); });
    this._bind('pause-resume-btn', () => { Audio.ui(); this._resume(); });
    this._bind('pause-restart-btn', () => { Audio.ui(); this._startFight(this.currentLevel); });
    this._bind('pause-quit-btn', () => { Audio.ui(); this._quitToTitle(); });
    this._bind('result-next-btn', () => { Audio.ui(); this._nextLevel(); });
    this._bind('result-retry-btn', () => { Audio.ui(); this._startFight(this.currentLevel); });
    this._bind('result-menu-btn', () => { Audio.ui(); this._quitToTitle(); });
    this._bind('ls-back-btn', () => { Audio.ui(); this._showScreen('title'); });
    this._bind('skill-back-btn', () => { Audio.ui(); this._showScreen('title'); });
    this._bind('sound-toggle', () => {
      const m = Audio.toggleMute();
      document.getElementById('sound-toggle').textContent = m ? '🔇' : '🔊';
      document.getElementById('sound-toggle').classList.toggle('muted', m);
    });

    window.addEventListener('resize', () => this._resize());
  }

  _bind(id, fn) {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('click', fn); el.addEventListener('touchend', (e) => { e.preventDefault(); fn(); }); }
  }

  // ─── INPUT ─────────────────────────────────────────────────
  _setupInput() {
    window.addEventListener('keydown', e => {
      if (this.screen !== 'fight') return;
      const k = e.code;
      if (!this.keys[k]) {
        this.keys[k] = true;
        this._handleKeyDown(k);
      }
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (this.player) this.player.blocking = false;
      }
    });

    // Pause with P or Escape
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.screen === 'fight') this._pause();
        else if (this.screen === 'pause') this._resume();
      }
    });

    // Touch controls
    this._setupTouchControls();
  }

  _handleKeyDown(k) {
    if (!this.player || this.player.isDead || this.player.stunned) return;
    const p = this.player;
    if (k === 'ArrowLeft')  { p.vx = -C.PLAYER_SPEED * p.speedMult; p.facing = -1; }
    if (k === 'ArrowRight') { p.vx = C.PLAYER_SPEED * p.speedMult;  p.facing = 1; }
    if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') {
      if (p.onGround) { p.vy = C.JUMP_FORCE; Audio.ui(); }
    }
    if ((k === 'ShiftLeft' || k === 'ShiftRight') && !p.isAttacking) {
      p.blocking = true; p.state = 'block'; Audio.block();
    }
    if (k === 'KeyZ' || k === 'KeyJ') this._playerAttack('punch');
    if (k === 'KeyX' || k === 'KeyK') this._playerAttack('kick');
    if (k === 'KeyC' || k === 'KeyL') this._playerAttack('special');
    if (k === 'KeyS' || k === 'KeyV') this._playerShadowMode();
  }

  _setupTouchControls() {
    const tc = document.getElementById('touch-controls');
    const setupBtn = (id, onPress, onRelease) => {
      const el = document.getElementById(id);
      if (!el) return;
      const press = (e) => { e.preventDefault(); el.classList.add('active'); onPress(); };
      const release = (e) => { e.preventDefault(); el.classList.remove('active'); if (onRelease) onRelease(); };
      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release, { passive: false });
      el.addEventListener('mousedown', press);
      el.addEventListener('mouseup', release);
    };

    setupBtn('tc-left', () => {
      if (this.player) { this.player.vx = -C.PLAYER_SPEED * this.player.speedMult; this.player.facing = -1; }
      this.touchState.left = true;
    }, () => { this.touchState.left = false; if (this.player && !this.touchState.right) this.player.vx = 0; });

    setupBtn('tc-right', () => {
      if (this.player) { this.player.vx = C.PLAYER_SPEED * this.player.speedMult; this.player.facing = 1; }
      this.touchState.right = true;
    }, () => { this.touchState.right = false; if (this.player && !this.touchState.left) this.player.vx = 0; });

    setupBtn('tc-jump', () => {
      if (this.player && this.player.onGround) { this.player.vy = C.JUMP_FORCE; Audio.ui(); }
    });

    setupBtn('tc-block', () => {
      if (this.player) { this.player.blocking = true; this.player.state = 'block'; }
    }, () => { if (this.player) this.player.blocking = false; });

    setupBtn('tc-punch',   () => this._playerAttack('punch'));
    setupBtn('tc-kick',    () => this._playerAttack('kick'));
    setupBtn('tc-special', () => this._playerAttack('special'));
  }

  _showTouchControls() {
    if ('ontouchstart' in window || window.innerWidth < 900) {
      document.getElementById('touch-controls').classList.add('visible');
    }
  }
  _hideTouchControls() {
    document.getElementById('touch-controls').classList.remove('visible');
  }

  // Continuous key poll
  _pollKeys() {
    if (!this.player || this.player.isDead || this.player.stunned || this.player.isAttacking || this.player.isHurt) return;
    const p = this.player;
    if (this.keys['ArrowLeft'])  { p.vx = -C.PLAYER_SPEED * p.speedMult; p.facing = -1; }
    if (this.keys['ArrowRight']) { p.vx = C.PLAYER_SPEED * p.speedMult;  p.facing = 1; }
  }

  // ─── PLAYER ATTACK ─────────────────────────────────────────
  _playerAttack(type) {
    const p = this.player;
    if (!p || p.isDead || p.stunned || p.isHurt) return;
    if (type === 'special' && p.energy < C.ENERGY_COST_SPECIAL) return;

    if (type === 'special') {
      p.energy -= C.ENERGY_COST_SPECIAL;
      Audio.special();
    } else if (type === 'punch') {
      Audio.punch();
    } else {
      Audio.kick();
    }

    p.setState(type);
    p.stateTimer = type === 'special' ? 30 : type === 'kick' ? 22 : 18;

    // Check combo
    const combo = this.comboDetector.push(type);
    if (combo) {
      this._triggerCombo(combo);
    } else {
      this.comboCount++;
      this.comboTimer = C.COMBO_TIMEOUT;
      this._updateComboUI();
    }
  }

  _playerShadowMode() {
    const p = this.player;
    if (!p || p.energy < C.ENERGY_COST_SHADOWMODE) return;
    p.energy -= C.ENERGY_COST_SHADOWMODE;
    p.shadowMode = true;
    p.shadowTimer = 240; // 4s at 60fps
    Audio.special();
    // Big particle burst
    this.particles.spawn(p.centerX, p.centerY, {
      count: 25, colors: ['#c8102e','#ff4d00','#ffd700','#000000'],
      spread: Math.PI * 2, speed: 10, size: 6, life: 0.8
    });
  }

  _triggerCombo(combo) {
    this.comboCount += combo.seq.length;
    Audio.combo();
    this.comboTimer = C.COMBO_TIMEOUT;
    this._updateComboUI();

    // Show combo popup
    const cd = document.getElementById('combo-display');
    cd.querySelector('.combo-count').textContent = `${this.comboCount}x`;
    cd.querySelector('.combo-label').textContent = combo.name;
    cd.querySelector('.combo-multiplier').textContent = `×${combo.dmgMulti.toFixed(1)} DAMAGE`;
    cd.classList.remove('hidden');

    // Apply bonus damage to current enemy
    const enemy = this.enemies[this.currentEnemyIdx];
    if (enemy && !enemy.isDead) {
      const bonusDmg = C.PUNCH_DMG * combo.dmgMulti * 0.6;
      const dealt = enemy.takeDamage(bonusDmg, 5, {});
      this._spawnDamageNum(enemy.centerX, enemy.y, dealt, '#ffd700');
      this._doScreenShake(6);
    }

    // Special effects
    if (combo.special === 'flash') this.flashAlpha = 0.4;
    if (combo.special === 'explosion') {
      this.particles.spawn(this.player.centerX, this.player.centerY, {
        count: 30, colors: [...C.PARTICLE_FIRE, '#ffd700'],
        spread: Math.PI * 2, speed: 9, size: 6, life: 0.7
      });
    }
  }

  // ─── FIGHT : START ─────────────────────────────────────────
  _startFight(levelIdx) {
    const levelData = this.levels[levelIdx];
    if (!levelData) return;
    this.currentLevel = levelIdx;

    const cw = this.cw;

    // Create player
    const maxHp = 100 + this.skills.health.level * 25;
    this.player = new Fighter({
      id: 'player', x: cw * 0.18, facing: 1,
      color: C.PLAYER_BASE, glowColor: C.PLAYER_GLOW,
      maxHp,
    });
    // Apply skills
    this.player.dmgMult   = 1 + this.skills.damage.level * 0.2;
    this.player.speedMult = 1 + this.skills.speed.level * 0.15;
    this.player.defMult   = 1 - this.skills.defense.level * 0.15;

    // Create enemies
    this.enemies = [];
    let ex = cw * 0.78;
    for (const eg of levelData.enemies) {
      for (let c = 0; c < eg.count; c++) {
        this.enemies.push(new Enemy(eg.type, ex, cw, levelIdx + 1));
        ex += 80;
      }
    }
    this.currentEnemyIdx = 0;

    // Reset fight state
    this.particles.clear();
    this.comboDetector = new ComboDetector();
    this.comboCount = 0;
    this.comboTimer = 0;
    this.roundTimer = levelData.timeLimit;
    this.roundTimerFrac = 0;
    this.fightResult = null;
    this.roundWins = { player: 0, enemy: 0 };
    this.roundNum = 1;
    this.resultStats = { playerDmg: 0, maxCombo: 0, roundTime: levelData.timeLimit };
    this.bgType = levelData.bg;
    this.levelData = levelData;

    document.getElementById('level-badge').textContent = `LEVEL ${levelData.id} — ${levelData.name.toUpperCase()}`;
    document.getElementById('enemy-name').textContent = this.enemies[0].name.toUpperCase();
    this._updateHUD();
    this._showScreen('fight');
    Audio.startBg();
  }

  // ─── FIGHT : LOOP ──────────────────────────────────────────
  _startLoop() {
    const loop = (ts) => {
      this.rafId = requestAnimationFrame(loop);
      const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
      this.lastTime = ts;
      this._tick(dt);
      this._render();
    };
    this.rafId = requestAnimationFrame(loop);
    this.lastTime = performance.now();
  }

  _tick(dt) {
    if (this.screen !== 'fight') return;

    // Hit-stop
    if (this.hitStopFrames > 0) { this.hitStopFrames--; return; }

    // Slow-mo
    const gameSpeed = this.slowMoTimer > 0 ? 0.25 : 1;
    if (this.slowMoTimer > 0) this.slowMoTimer--;
    const adt = dt * gameSpeed;

    this._pollKeys();

    const p = this.player;
    const enemy = this.enemies[this.currentEnemyIdx];

    // Update player
    if (p) {
      p.updatePhysics(this.cw);
      // Energy regen bonus from skill
      p.energy = Math.min(C.ENERGY_MAX, p.energy + C.ENERGY_REGEN * this.skills.energy.level * 0.4);
    }

    // Update enemies
    this.enemies.forEach((e, i) => {
      if (!e.isDead) {
        if (i === this.currentEnemyIdx && p) {
          const atk = e.ai(p, adt);
        }
        e.updatePhysics(this.cw);
      }
    });

    // Make players face each other
    if (p && enemy && !p.isDead && !enemy.isDead) {
      if (!p.isAttacking && !p.isHurt && this.keys['ArrowLeft'] === undefined || (!this.keys['ArrowLeft'] && !this.keys['ArrowRight'])) {
        // Auto-face during idle
      }
    }

    // Collision / hit detection
    if (p && enemy && !p.isDead && !enemy.isDead) {
      this._checkHits(p, enemy);
    }

    // Timer
    this.roundTimerFrac += dt;
    if (this.roundTimerFrac >= 1) {
      this.roundTimerFrac -= 1;
      this.roundTimer--;
      if (this.roundTimer <= 0) {
        this._endRound('timeout');
      }
    }

    // Particle system
    this.particles.update(adt);
    this.bgRenderer.update(adt);

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt * 1000;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.comboCount = 0;
        document.getElementById('combo-display').classList.add('hidden');
      }
    }
    this.comboDetector.tick(adt);

    // Screen shake decay
    if (this.screenShake > 0) this.screenShake *= 0.85;
    if (this.flashAlpha > 0) this.flashAlpha -= 0.05;

    // HUD update (throttled)
    this._updateHUD();

    // Death check
    if (p && p.isDead && !this.fightResult) {
      setTimeout(() => this._endRound('playerDead'), 800);
      this.fightResult = 'pending';
    }
    if (enemy && enemy.isDead && !this.fightResult) {
      // Check if more enemies
      const nextAlive = this.enemies.findIndex((e, i) => i > this.currentEnemyIdx && !e.isDead);
      if (nextAlive >= 0) {
        this.currentEnemyIdx = nextAlive;
        document.getElementById('enemy-name').textContent = this.enemies[nextAlive].name.toUpperCase();
      } else {
        setTimeout(() => this._endRound('enemyDead'), 800);
        this.fightResult = 'pending';
      }
    }
  }

  _checkHits(p, enemy) {
    // Player attacks enemy
    if (p.isAttacking) {
      const hitFrame = p.state === 'punch' ? 10 : p.state === 'kick' ? 14 : 20;
      if (p.stateTimer === hitFrame) {
        const dist = Math.abs(p.centerX - enemy.centerX);
        const range = p.state === 'special' ? 110 : p.state === 'kick' ? 100 : 90;
        if (dist < range) {
          let dmg = (p.state === 'punch' ? C.PUNCH_DMG : p.state === 'kick' ? C.KICK_DMG : C.SPECIAL_DMG);
          dmg *= p.dmgMult;
          // Combo multiplier
          const comboBonus = 1 + Math.min(this.comboCount, C.MAX_COMBO) * 0.04 + this.skills.combo.level * 0.3;
          dmg *= comboBonus;
          if (p.shadowMode) dmg *= 1.8;

          const dealt = enemy.takeDamage(dmg, 10);
          p.totalDmg += dealt;
          this.resultStats.playerDmg += dealt;
          this.resultStats.maxCombo = Math.max(this.resultStats.maxCombo, this.comboCount);

          Audio.hit();
          this._doScreenShake(8);
          this._doHitStop(3);
          this.particles.spawn(enemy.centerX, enemy.y + 30, {
            count: 12, colors: C.PARTICLE_FIRE,
            angle: -Math.PI / 2, spread: 1.5, speed: 5, size: 4, life: 0.4
          });
          this._spawnDamageNum(enemy.centerX, enemy.y - 10, Math.floor(dealt), '#ff4d00');
        }
      }
    }

    // Enemy attacks player
    if (enemy.isAttacking) {
      const atkData = enemy.getAttackData();
      if (atkData && enemy.stateTimer === atkData.hitFrame) {
        const dist = Math.abs(enemy.centerX - p.centerX);
        if (dist < atkData.range) {
          let dmg = atkData.dmg;
          dmg *= (1 + this.skills.defense.level * 0.15) < 1 ? 1 : (1 - this.skills.defense.level * 0.15); // defense reduces dmg
          const dealt = p.takeDamage(dmg, 8);
          Audio.hit();
          this._doScreenShake(5);
          this._doHitStop(2);
          this.particles.spawn(p.centerX, p.y + 30, {
            count: 8, colors: C.PARTICLE_ICE,
            angle: -Math.PI / 2, spread: 1.5, speed: 4, size: 3, life: 0.3
          });
          this._spawnDamageNum(p.centerX, p.y - 10, Math.floor(dealt), '#00cfff');
        }
      }
    }
  }

  _endRound(reason) {
    if (this.fightResult && this.fightResult !== 'pending') return;
    Audio.stopBg();

    let playerWon = false;
    const enemy = this.enemies[this.currentEnemyIdx];
    const p = this.player;

    if (reason === 'enemyDead') playerWon = true;
    else if (reason === 'timeout') {
      // Whoever has more HP wins
      const enemyHpTotal = this.enemies.reduce((s, e) => s + e.hp, 0);
      playerWon = p.hp > enemyHpTotal;
    } else {
      playerWon = false;
    }

    // Slow-mo finish
    this.slowMoTimer = 60;
    this.flashAlpha = playerWon ? 0.3 : 0.2;

    if (playerWon) Audio.win();
    else Audio.lose();

    if (playerWon) {
      this.roundWins.player++;
      this.coins += this.levelData.reward;
      if (this.currentLevel + 1 >= this.maxUnlocked) {
        this.maxUnlocked = Math.min(40, this.currentLevel + 2);
      }
      // Skill unlock check
      const unlockLevel = this.currentLevel + 1;
      let unlockedSkill = null;
      if (unlockLevel === 5) unlockedSkill = 'damage';
      if (unlockLevel === 10) unlockedSkill = 'speed';
      if (unlockLevel === 15) unlockedSkill = 'defense';
      if (unlockLevel === 20) unlockedSkill = 'health';
      if (unlockLevel === 25) unlockedSkill = 'energy';
      if (unlockLevel === 30) unlockedSkill = 'combo';
    }

    setTimeout(() => this._showResult(playerWon, reason), 1200);
    this.fightResult = playerWon ? 'win' : 'lose';
  }

  _showResult(won, reason) {
    const rt = document.getElementById('result-title');
    rt.textContent = won ? (this.levelData.isBoss ? '⚔ BOSS DEFEATED ⚔' : 'VICTORY!') : 'DEFEAT';
    rt.className = 'result-title ' + (won ? 'win' : 'lose');

    document.getElementById('result-stat-damage').textContent = Math.floor(this.resultStats.playerDmg);
    document.getElementById('result-stat-combo').textContent  = this.resultStats.maxCombo + 'x';
    document.getElementById('result-stat-time').textContent   = (this.levelData.timeLimit - this.roundTimer) + 's';
    document.getElementById('result-stat-coins').textContent  = '+' + (won ? this.levelData.reward : 0);

    const nextBtn = document.getElementById('result-next-btn');
    if (nextBtn) nextBtn.style.display = won && this.currentLevel < 39 ? '' : 'none';

    this._showScreen('result');
  }

  // ─── HUD UPDATE ────────────────────────────────────────────
  _updateHUD() {
    const p = this.player;
    const enemy = this.enemies[this.currentEnemyIdx];

    if (p) {
      document.getElementById('player-hp-bar').style.width = (p.hp / p.maxHp * 100) + '%';
      document.getElementById('player-energy-bar').style.width = (p.energy / C.ENERGY_MAX * 100) + '%';
    }
    if (enemy) {
      document.getElementById('enemy-hp-bar').style.width = (enemy.hp / enemy.maxHp * 100) + '%';
      document.getElementById('enemy-energy-bar').style.width = (enemy.energy / C.ENERGY_MAX * 100) + '%';
    }

    const timerEl = document.getElementById('timer-display');
    timerEl.textContent = Math.max(0, Math.ceil(this.roundTimer)).toString().padStart(2, '0');
    timerEl.classList.toggle('urgent', this.roundTimer <= 10);
  }

  _updateComboUI() {
    if (this.comboCount < 2) return;
    const cd = document.getElementById('combo-display');
    cd.querySelector('.combo-count').textContent = `${this.comboCount}x`;
    const mult = (1 + Math.min(this.comboCount, C.MAX_COMBO) * 0.04 + this.skills.combo.level * 0.3).toFixed(2);
    cd.querySelector('.combo-multiplier').textContent = `×${mult} DAMAGE`;
    cd.classList.remove('hidden');
    this.resultStats.maxCombo = Math.max(this.resultStats.maxCombo, this.comboCount);
  }

  // ─── RENDER ────────────────────────────────────────────────
  _render() {
    const ctx = this.ctx;
    const cw = this.cw, ch = this.ch;

    ctx.clearRect(0, 0, cw, ch);

    if (this.screen !== 'fight') {
      // Animated background for menus
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, cw, ch);
      return;
    }

    // Screen shake
    let sx = 0, sy = 0;
    if (this.screenShake > 0.5) {
      sx = (Math.random() - 0.5) * this.screenShake;
      sy = (Math.random() - 0.5) * this.screenShake;
    }
    ctx.save();
    ctx.translate(sx, sy);

    // Background
    this.bgRenderer.draw(ctx, cw, ch, this.bgType);

    // Floor highlight
    const floorGrad = ctx.createLinearGradient(0, C.FLOOR_Y + 90, 0, C.FLOOR_Y + 100);
    floorGrad.addColorStop(0, 'rgba(200,16,46,0.08)');
    floorGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, C.FLOOR_Y + 90, cw, 10);

    // Particles (behind chars)
    this.particles.draw(ctx);

    // Draw fighters
    this.enemies.forEach(e => {
      if (!e.isDead) e.draw(ctx, this.particles);
    });
    if (this.player) this.player.draw(ctx, this.particles);

    // Flash overlay
    if (this.flashAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }

    ctx.restore();

    // Vignette
    const vig = ctx.createRadialGradient(cw / 2, ch / 2, cw * 0.3, cw / 2, ch / 2, cw * 0.8);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, cw, ch);
  }

  // ─── HELPERS ───────────────────────────────────────────────
  _doScreenShake(amount) { this.screenShake = Math.max(this.screenShake, amount); }
  _doHitStop(frames) { this.hitStopFrames = Math.max(this.hitStopFrames, frames); }

  _spawnDamageNum(x, y, val, color) {
    const el = document.createElement('div');
    el.className = 'damage-num';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color;
    el.style.fontSize = Math.min(28, 14 + val / 8) + 'px';
    el.textContent = Math.floor(val);
    const wrapper = document.getElementById('game-wrapper');
    wrapper.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  _pause() {
    this.screen = 'pause';
    document.getElementById('pause-screen').classList.remove('hidden');
    Audio.stopBg();
  }

  _resume() {
    document.getElementById('pause-screen').classList.add('hidden');
    this.screen = 'fight';
    Audio.startBg();
  }

  _nextLevel() {
    if (this.currentLevel < 39) {
      this.currentLevel++;
      this._startFight(this.currentLevel);
    }
  }

  _quitToTitle() {
    Audio.stopBg();
    this.player = null;
    this.enemies = [];
    this.particles.clear();
    this.fightResult = null;
    this._showScreen('title');
  }

  // ─── LEVEL SELECT ──────────────────────────────────────────
  _buildLevelSelect() {
    const container = document.getElementById('ls-levels-container');
    container.innerHTML = '';

    const chapters = [
      { title: 'Chapter I — Awakening (Lv 1–3)', range: [0, 2] },
      { title: 'Chapter II — Shadow Path (Lv 4–9)', range: [3, 8] },
      { title: 'Chapter III — Iron Trial (Lv 10–19)', range: [9, 18] },
      { title: 'Chapter IV — Dark Descent (Lv 20–29)', range: [19, 28] },
      { title: 'Chapter V — Oblivion (Lv 30–40)', range: [29, 39] },
    ];

    chapters.forEach(ch => {
      const chDiv = document.createElement('div');
      chDiv.className = 'ls-chapter';
      chDiv.innerHTML = `<div class="ls-chapter-title">${ch.title}</div><div class="ls-levels" id="ch-${ch.range[0]}"></div>`;
      container.appendChild(chDiv);

      const grid = chDiv.querySelector('.ls-levels');
      for (let i = ch.range[0]; i <= ch.range[1]; i++) {
        const lvl = this.levels[i];
        const unlocked = i < this.maxUnlocked;
        const completed = i < this.currentLevel;
        const current   = i === this.currentLevel;
        const btn = document.createElement('div');
        btn.className = `ls-level-btn${lvl.isBoss ? ' boss' : ''}${completed ? ' completed' : ''}${current ? ' current' : ''}${unlocked ? '' : ' locked'}`;
        btn.innerHTML = `
          <span class="ls-level-num">${lvl.isBoss ? '👑' : i + 1}</span>
          <span class="ls-level-type">${lvl.isBoss ? 'BOSS' : lvl.enemies[0]?.type?.toUpperCase() || ''}</span>
          <div class="ls-level-stars">${completed ? '⭐⭐⭐' : unlocked ? '☆☆☆' : '🔒'}</div>
        `;
        if (unlocked) {
          btn.addEventListener('click', () => {
            Audio.ui();
            this._startFight(i);
          });
        }
        grid.appendChild(btn);
      }
    });
  }

  // ─── SKILL UI ──────────────────────────────────────────────
  _buildSkillUI() {
    document.getElementById('skill-coin-count').textContent = this.coins;
    const grid = document.getElementById('skills-grid');
    grid.innerHTML = '';
    Object.entries(this.skills).forEach(([key, skill]) => {
      const cost = skill.cost[skill.level] || null;
      const maxed = skill.level >= skill.maxLevel;
      const canBuy = !maxed && cost && this.coins >= cost;
      const card = document.createElement('div');
      card.className = 'skill-card';
      card.innerHTML = `
        <div class="skill-card-header">
          <div class="skill-icon">${skill.icon}</div>
          <div>
            <div class="skill-name">${skill.name}</div>
            <div class="skill-level-dots">
              ${[0,1,2].map(d => `<div class="skill-dot${d < skill.level ? ' filled' : ''}"></div>`).join('')}
            </div>
          </div>
        </div>
        <div class="skill-desc">${skill.desc}</div>
        <button class="skill-upgrade-btn" ${maxed || !canBuy ? 'disabled' : ''}>
          ${maxed ? 'MAXED' : `UPGRADE — ${cost}🪙`}
        </button>
      `;
      if (!maxed && canBuy) {
        card.querySelector('.skill-upgrade-btn').addEventListener('click', () => {
          this.coins -= cost;
          skill.level++;
          Audio.combo();
          this._buildSkillUI();
        });
      }
      grid.appendChild(card);
    });
  }
}

// ─── BOOT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.game = new ShadowNinjaFight();
});
