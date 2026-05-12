/* ============================================
   AEGIS DEFENSE — WEB AUDIO ENGINE
   ============================================ */

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let enabled = true;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.35;
      masterGain.connect(ctx.destination);
    } catch(e) {
      enabled = false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // Low-level noise burst
  function noise(duration, freq, type='square', vol=0.2, decay=true) {
    if (!enabled || !ctx) return;
    resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (decay) osc.frequency.exponentialRampToValueAtTime(freq * 0.3, ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function noiseBurst(duration, vol=0.15) {
    if (!enabled || !ctx) return;
    resume();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start();
  }

  // Sound FX library
  const sounds = {
    // Tower shots
    pulse: () => { noise(0.12, 880, 'square', 0.25); },
    tesla: () => {
      noise(0.08, 1200, 'sawtooth', 0.15);
      setTimeout(() => noise(0.08, 600, 'sawtooth', 0.12), 60);
    },
    inferno: () => {
      noiseBurst(0.18, 0.2);
      noise(0.18, 200, 'sawtooth', 0.18);
    },
    void: () => {
      noise(0.3, 120, 'sine', 0.3, true);
      noise(0.2, 80, 'square', 0.2, false);
    },

    // Enemy events
    enemyHit: () => { noiseBurst(0.05, 0.08); },
    enemyDie: () => {
      noise(0.25, 300, 'sine', 0.2);
      noise(0.15, 150, 'sawtooth', 0.15);
    },
    bossHit: () => {
      noise(0.1, 200, 'square', 0.3);
      noise(0.08, 100, 'sine', 0.25);
    },

    // UI events
    place: () => {
      noise(0.06, 600, 'square', 0.2, false);
      setTimeout(() => noise(0.06, 900, 'square', 0.15, false), 60);
    },
    upgrade: () => {
      noise(0.08, 400, 'sine', 0.2, false);
      setTimeout(() => noise(0.08, 600, 'sine', 0.18, false), 80);
      setTimeout(() => noise(0.08, 900, 'sine', 0.15, false), 160);
    },
    sell: () => {
      noise(0.08, 500, 'sine', 0.18);
      setTimeout(() => noise(0.08, 350, 'sine', 0.14), 80);
    },
    error: () => {
      noise(0.15, 200, 'sawtooth', 0.2, false);
      setTimeout(() => noise(0.12, 150, 'sawtooth', 0.18, false), 150);
    },

    // Game events
    waveStart: () => {
      [200, 280, 380, 500].forEach((f, i) =>
        setTimeout(() => noise(0.2, f, 'square', 0.25, false), i * 80)
      );
    },
    waveComplete: () => {
      [400, 500, 600, 800, 1000].forEach((f, i) =>
        setTimeout(() => noise(0.15, f, 'sine', 0.2, false), i * 60)
      );
    },
    levelComplete: () => {
      [300, 400, 500, 700, 900, 1200].forEach((f, i) =>
        setTimeout(() => noise(0.2, f, 'sine', 0.25, false), i * 80)
      );
    },
    gameOver: () => {
      [400, 350, 280, 200, 150].forEach((f, i) =>
        setTimeout(() => noise(0.3, f, 'sawtooth', 0.25), i * 120)
      );
    },
    nuke: () => {
      noiseBurst(0.5, 0.4);
      noise(0.5, 60, 'sine', 0.4, true);
      setTimeout(() => noiseBurst(0.4, 0.3), 100);
    },
    lifeLost: () => {
      noise(0.15, 400, 'sawtooth', 0.3, false);
      setTimeout(() => noise(0.2, 250, 'sawtooth', 0.25, true), 150);
    },
    bossAppear: () => {
      [100, 120, 80, 150].forEach((f, i) =>
        setTimeout(() => noise(0.3, f, 'square', 0.3, false), i * 100)
      );
    },
    coin: () => {
      noise(0.1, 1200, 'sine', 0.15, false);
      setTimeout(() => noise(0.08, 1600, 'sine', 0.12, false), 80);
    },
    victory: () => {
      const melody = [523, 659, 784, 1047, 784, 1047, 1175, 1568];
      melody.forEach((f, i) =>
        setTimeout(() => noise(0.25, f, 'sine', 0.2, false), i * 130)
      );
    },
    click: () => { noise(0.05, 1000, 'square', 0.1, false); },
  };

  return {
    init,
    play: (name) => { if (sounds[name]) sounds[name](); },
    resume,
    setEnabled: (v) => { enabled = v; },
  };
})();
