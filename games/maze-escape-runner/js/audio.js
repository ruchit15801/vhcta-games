// audio.js - Web Audio API Procedural Sound Generator

class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.bgmOscillators = [];
        this.bgmGain = null;
        this.bgmInterval = null;
        this.isPlayingBGM = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(frequency, type, duration, vol=0.1, slideFreq=null) {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
        }
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playMove() {
        // Soft click
        this.playTone(150, 'sine', 0.1, 0.05);
    }

    playCollect() {
        // Bright ping
        this.playTone(880, 'sine', 0.1, 0.1, 1200);
        setTimeout(() => this.playTone(1200, 'sine', 0.15, 0.1, 1600), 50);
    }

    playPowerup() {
        this.playTone(400, 'triangle', 0.2, 0.1, 800);
        setTimeout(() => this.playTone(600, 'triangle', 0.3, 0.1, 1200), 100);
    }

    playHit() {
        // Low distorted crunch
        this.playTone(100, 'sawtooth', 0.3, 0.2, 50);
        this.playTone(150, 'square', 0.2, 0.2, 80);
    }

    playLevelComplete() {
        // Happy arpeggio
        const notes = [440, 554, 659, 880];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, 'sine', 0.3, 0.1);
            }, i * 100);
        });
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) this.stopBGM();
        else this.startBGM();
        return this.enabled;
    }

    startBGM() {
        if (!this.enabled || !this.ctx || this.isPlayingBGM) return;
        this.isPlayingBGM = true;
        
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.02;
        this.bgmGain.connect(this.ctx.destination);
        
        const bassLine = [130.81, 130.81, 146.83, 155.56, 130.81, 110.00, 116.54, 130.81]; // C3, D3, Eb3...
        let step = 0;
        
        this.bgmInterval = setInterval(() => {
            if (!this.isPlayingBGM) return;
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(bassLine[step % bassLine.length], this.ctx.currentTime);
            
            osc.connect(this.bgmGain);
            osc.start();
            
            // Envelope
            this.bgmGain.gain.setValueAtTime(0.03, this.ctx.currentTime);
            this.bgmGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
            
            osc.stop(this.ctx.currentTime + 0.2);
            step++;
        }, 250);
    }

    stopBGM() {
        this.isPlayingBGM = false;
        if (this.bgmInterval) clearInterval(this.bgmInterval);
        if (this.bgmGain) this.bgmGain.disconnect();
    }
}

const audio = new AudioManager();
