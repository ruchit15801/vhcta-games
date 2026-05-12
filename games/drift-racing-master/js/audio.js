class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.5;

        // Synthesis oscillators for procedural sounds 
        // to conform to "no external link" requirement reliably
        this.engineOsc = null;
        this.slipOsc = null;
        
        this.isPlaying = false;
        this.sfxMuted = false;
        this.bgmMuted = false;
    }
    
    applyMuteState(sfxEnabled, bgmEnabled) {
        this.sfxMuted = !sfxEnabled;
        this.bgmMuted = !bgmEnabled;
        
        if (this.bgmMuted && this.isPlaying) this.stopAll();
    }

    startEngine() {
        if (this.bgmMuted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (this.engineOsc) return;

        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 50;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 150;

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.3;

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);

        this.engineOsc.start();
        this.isPlaying = true;
    }

    updateEngine(rpmRatio) { // 0 to 1
        if (!this.engineOsc || this.bgmMuted) return;
        
        // Throaty engine sound changes dynamically
        const minFreq = 40;
        const maxFreq = 150;
        this.engineOsc.frequency.setTargetAtTime(minFreq + (maxFreq - minFreq) * rpmRatio, this.ctx.currentTime, 0.1);
        this.engineGain.gain.setTargetAtTime(0.2 + rpmRatio * 0.3, this.ctx.currentTime, 0.1);
    }

    startDrift() {
        if (!this.isPlaying || this.sfxMuted) return;
        if (this.slipOsc) return;

        this.slipOsc = this.ctx.createOscillator();
        this.slipOsc.type = 'square';
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 800;

        this.slipGain = this.ctx.createGain();
        this.slipGain.gain.value = 0.1;

        this.slipOsc.connect(filter);
        filter.connect(this.slipGain);
        this.slipGain.connect(this.masterGain);

        this.slipOsc.frequency.value = 1000 + Math.random()*200;
        this.slipOsc.start();
    }

    stopDrift() {
        if (this.slipOsc) {
            this.slipOsc.stop();
            this.slipOsc.disconnect();
            this.slipOsc = null;
        }
    }

    stopAll() {
        this.isPlaying = false;
        if (this.engineOsc) {
            this.engineOsc.stop();
            this.engineOsc.disconnect();
            this.engineOsc = null;
        }
        this.stopDrift();
    }
}
