// procedural Web Audio API system for high-quality, local sounds without external MP3s

class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        this.bgmOscillator = null;
        this.bgmGain = null;
    }

    init() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    // A white noise buffer for explosions and gunshots
    createNoiseBuffer() {
        if (!this.noiseBuffer) {
            const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            this.noiseBuffer = buffer;
        }
        return this.noiseBuffer;
    }

    playGunshot(type) {
        if (!this.enabled) return;
        const t = this.ctx.currentTime;
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        
        const noiseGain = this.ctx.createGain();
        
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        
        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);

        // Weapon profiles
        if (type === 'PISTOL') {
            noiseFilter.frequency.value = 4000;
            noiseGain.gain.setValueAtTime(0.5, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.1);
            oscGain.gain.setValueAtTime(0.5, t);
            oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            
            noise.start(t); noise.stop(t + 0.2);
            osc.start(t); osc.stop(t + 0.2);
            
        } else if (type === 'RIFLE') {
            noiseFilter.frequency.value = 6000;
            noiseGain.gain.setValueAtTime(0.6, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.15);
            oscGain.gain.setValueAtTime(0.7, t);
            oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            
            noise.start(t); noise.stop(t + 0.3);
            osc.start(t); osc.stop(t + 0.3);
            
        } else if (type === 'SHOTGUN') {
            noiseFilter.frequency.value = 2000; // deeper
            noiseGain.gain.setValueAtTime(0.9, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
            
            osc.frequency.setValueAtTime(100, t);
            osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.3);
            oscGain.gain.setValueAtTime(0.8, t);
            oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            
            noise.start(t); noise.stop(t + 0.5);
            osc.start(t); osc.stop(t + 0.5);
        } else {
            // default short click for no ammo
            osc.frequency.setValueAtTime(800, t);
            oscGain.gain.setValueAtTime(0.1, t);
            oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
            osc.start(t); osc.stop(t + 0.05);
        }
    }

    playReload() {
        if (!this.enabled) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.setValueAtTime(600, t + 0.2);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
        gain.gain.setValueAtTime(0, t + 0.15);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.25);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);
        
        osc.start(t);
        osc.stop(t + 0.4);
    }

    playHit(isPlayer) {
        if (!this.enabled) return;
        const t = this.ctx.currentTime;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = isPlayer ? 'lowpass' : 'highpass';
        filter.frequency.value = isPlayer ? 1000 : 5000;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(isPlayer ? 0.3 : 0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + (isPlayer ? 0.3 : 0.1));
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        noise.start(t);
        noise.stop(t + 0.5);
    }

    playPickup(type) {
        if (!this.enabled) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        if (type === 'health') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, t);
            osc.frequency.linearRampToValueAtTime(800, t + 0.2);
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.3);
        } else {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.linearRampToValueAtTime(900, t + 0.1);
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.15);
        }
        
        osc.start(t);
        osc.stop(t + 0.4);
    }

    playZoneWarning() {
        if (!this.enabled) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.5);
        
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);
        
        osc.start(t);
        osc.stop(t + 0.6);
    }

    startBGM() {
        if (!this.enabled || this.bgmOscillator) return;
        this.bgmOscillator = this.ctx.createOscillator();
        this.bgmGain = this.ctx.createGain();
        
        this.bgmOscillator.type = 'sine';
        this.bgmOscillator.frequency.value = 50; // Deep drone
        
        this.bgmGain.gain.value = 0.05;
        
        this.bgmOscillator.connect(this.bgmGain);
        this.bgmGain.connect(this.ctx.destination);
        
        this.bgmOscillator.start();
    }

    stopBGM() {
        if (this.bgmOscillator) {
            this.bgmOscillator.stop();
            this.bgmOscillator.disconnect();
            this.bgmOscillator = null;
        }
    }
}

// Global instance
const audioSys = new AudioSystem();
