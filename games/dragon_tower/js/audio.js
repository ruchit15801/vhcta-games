/**
 * Dragon Tower — Audio Engine
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = false;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.4;
    this.enabled = true;
  }

  tone(freq, type = 'sine', dur = 0.08, vol = 0.1, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    
    // Resume context if suspended (browser security)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    
    o.connect(g);
    g.connect(this.masterGain);
    
    o.type = type;
    o.frequency.value = freq;
    
    const t = this.ctx.currentTime + delay;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(effect) {
    switch (effect) {
      case 'place':
        this.tone(440, 'sine', 0.1, 0.12);
        this.tone(660, 'sine', 0.08, 0.08, 0.05);
        break;
      case 'shoot':
        this.tone(880, 'square', 0.04, 0.06);
        break;
      case 'hit':
        this.tone(220, 'sawtooth', 0.07, 0.15);
        break;
      case 'death':
        [220, 180, 140, 100].forEach((f, i) => this.tone(f, 'sawtooth', 0.12, 0.2, i * 0.04));
        break;
      case 'waveStart':
        [330, 440, 550, 660].forEach((f, i) => this.tone(f, 'sine', 0.12, 0.22, i * 0.07));
        break;
      case 'gold':
        this.tone(880, 'sine', 0.07, 0.15);
        this.tone(1108, 'sine', 0.05, 0.1, 0.06);
        break;
      case 'damage':
        this.tone(180, 'sawtooth', 0.15, 0.3);
        this.tone(120, 'sine', 0.12, 0.25, 0.04);
        break;
      case 'sell':
        this.tone(330, 'sine', 0.12, 0.15);
        break;
      case 'upgrade':
        [440, 554, 659, 880].forEach((f, i) => this.tone(f, 'sine', 0.1, 0.2, i * 0.06));
        break;
      case 'win':
        [440, 554, 659, 880, 1108, 1318].forEach((f, i) => this.tone(f, 'sine', 0.16, 0.28, i * 0.08));
        break;
      case 'lose':
        [440, 330, 220, 110].forEach((f, i) => this.tone(f, 'sawtooth', 0.18, 0.3, i * 0.08));
        break;
    }
  }

  // Procedural ambience
  startAmbience() {
    if (!this.enabled) return;
    this.tone(60, 'sine', 10, 0.02, 0); // Low hum
  }
}

export const sfx = new AudioEngine();
