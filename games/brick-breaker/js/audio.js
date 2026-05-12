/**
 * Neon Breaker Audio Engine
 * Synthesizes high-quality arcade sound effects using Web Audio API.
 */
class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.5;
        this.sounds = {};
        this.enabled = true;
    }

    toggle() {
        this.enabled = !this.enabled;
        this.masterGain.gain.setTargetAtTime(this.enabled ? 0.5 : 0, this.ctx.currentTime, 0.1);
        return this.enabled;
    }

    #createOscillator(type, freq, duration, gainValue = 0.5) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        return { osc, gain };
    }

    playHit() {
        if (!this.enabled) return;
        const { osc } = this.#createOscillator('triangle', 150 + Math.random() * 50, 0.1, 0.3);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playBreak() {
        if (!this.enabled) return;
        const { osc } = this.#createOscillator('square', 200 + Math.random() * 100, 0.15, 0.2);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);

        // Add a bit of noise for the crunch
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
        noise.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start();
    }

    playPowerUp() {
        if (!this.enabled) return;
        const now = this.ctx.currentTime;
        const freq = 440;
        const duration = 0.3;
        const { osc } = this.#createOscillator('sine', freq, duration, 0.3);
        osc.frequency.linearRampToValueAtTime(freq * 1.5, now + 0.1);
        osc.frequency.linearRampToValueAtTime(freq * 2, now + 0.2);
        osc.start();
        osc.stop(now + duration);
    }

    playLevelUp() {
        if (!this.enabled) return;
        const now = this.ctx.currentTime;
        [440, 554.37, 659.25].forEach((f, i) => {
            const { osc } = this.#createOscillator('sine', f, 0.6, 0.2);
            osc.start(now + i * 0.1);
            osc.stop(now + 0.6 + i * 0.1);
        });
    }

    playGameOver() {
        if (!this.enabled) return;
        const now = this.ctx.currentTime;
        const { osc } = this.#createOscillator('sawtooth', 200, 1.0, 0.3);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.8);
        osc.start();
        osc.stop(now + 1.0);
    }

    playLaser() {
        if (!this.enabled) return;
        const { osc } = this.#createOscillator('sawtooth', 800, 0.1, 0.1);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.1);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }
}

const audio = new AudioEngine();
export default audio;
