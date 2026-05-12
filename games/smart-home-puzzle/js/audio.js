// audio.js - Procedural Sound Generation for Premium UI feel

class AudioSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.masterVolume = null;
        this.bgOscillator = null;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        this.masterVolume = this.ctx.createGain();
        this.masterVolume.gain.value = 0.5; // default volume
        this.masterVolume.connect(this.ctx.destination);
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.ctx) {
            if (this.enabled) {
                if(this.ctx.state === 'suspended') this.ctx.resume();
                this.masterVolume.gain.rampToValueAtTime(0.5, this.ctx.currentTime + 0.1);
            } else {
                this.masterVolume.gain.rampToValueAtTime(0, this.ctx.currentTime + 0.1);
            }
        }
        return this.enabled;
    }

    playTone(freq, type, duration, vol = 0.5) {
        if (!this.enabled || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterVolume);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playClick() {
        // High pitched short beep
        this.playTone(800, 'sine', 0.1, 0.3);
    }

    playConnect() {
        // Double ascending tone
        if (!this.enabled || !this.ctx) return;
        this.playTone(400, 'triangle', 0.15, 0.4);
        setTimeout(() => this.playTone(600, 'triangle', 0.2, 0.4), 100);
    }

    playDisconnect() {
        // Descending tone
        if (!this.enabled || !this.ctx) return;
        this.playTone(600, 'sawtooth', 0.1, 0.2);
        setTimeout(() => this.playTone(300, 'sawtooth', 0.2, 0.2), 80);
    }

    playActivate() {
        // Device activated
        this.playTone(1200, 'sine', 0.3, 0.5);
    }

    playError() {
        // Low buzz
        this.playTone(150, 'sawtooth', 0.4, 0.6);
    }

    playSuccess() {
        // Melodic success chime
        if (!this.enabled || !this.ctx) return;
        const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'sine', 0.5, 0.4), i * 150);
        });
    }

    startAmbient() {
        if (!this.enabled || !this.ctx) return;
        if (this.bgOscillator) return;

        this.bgOscillator = this.ctx.createOscillator();
        const bgGain = this.ctx.createGain();

        this.bgOscillator.type = 'sine';
        this.bgOscillator.frequency.setValueAtTime(50, this.ctx.currentTime); // Low drone

        // LFO for volume pulsing
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.1, this.ctx.currentTime); // 10s cycle
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        
        lfo.connect(lfoGain);
        lfoGain.connect(bgGain.gain);

        bgGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        
        this.bgOscillator.connect(bgGain);
        bgGain.connect(this.masterVolume);

        this.bgOscillator.start();
        lfo.start();
    }
}

const audio = new AudioSystem();
window.gameAudio = audio;
