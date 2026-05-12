const AudioEngine = {
    ctx: null,
    masterGain: null,
    isMuted: false,
    engineOsc: null,
    engineFilter: null,
    
    init: function() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.masterGain.gain.value = 0.3;
        } catch (e) {
            console.error('Web Audio API not supported', e);
        }
    },

    resume: async function() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    },

    toggleMute: function() {
        this.isMuted = !this.isMuted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.isMuted ? 0 : 0.3;
        }
        return this.isMuted;
    },

    // High-Fidelity Executive Engine Sound
    startEngine: function() {
        if (!this.ctx || this.engineOsc) return;

        // V12 Simulation Engine
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'triangle'; // Smoother than sawtooth
        
        this.engineSub = this.ctx.createOscillator();
        this.engineSub.type = 'sine'; // Pure depth

        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 300;
        this.engineFilter.Q.value = 5; // Resonant hum

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.12;

        this.engineOsc.connect(this.engineFilter);
        this.engineSub.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);

        this.engineOsc.start();
        this.engineSub.start();
        
        // High Speed Wind
        this.windOsc = this.ctx.createOscillator();
        this.windOsc.type = 'sine';
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;
        this.windOsc.connect(this.windGain);
        this.windGain.connect(this.masterGain);
        this.windOsc.start();
    },

    updateEngine: function(speedPercent) {
        if (!this.engineOsc) return;

        // Luxury Gear-Scaling RPM
        const baseFreq = 40 + (speedPercent * 120);
        this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.1);
        this.engineSub.frequency.setTargetAtTime(baseFreq / 2, this.ctx.currentTime, 0.1);
        
        // Dynamic Filter Sweep (Muffled at low, Aggressive at high)
        const filterFreq = 200 + (speedPercent * 1800);
        this.engineFilter.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.2);

        // Wind noise at high speed
        if (this.windGain) {
            this.windGain.gain.setTargetAtTime(speedPercent * 0.05, this.ctx.currentTime, 0.5);
        }
    },

    stopEngine: function() {
        if (this.engineOsc) {
            this.engineOsc.stop();
            this.engineSub.stop();
            if (this.windOsc) this.windOsc.stop();
            this.engineOsc = null;
            this.windOsc = null;
        }
    },

    playSkid: function(intensity) {
        if (!this.ctx) return;
        const skidGain = this.ctx.createGain();
        skidGain.gain.setValueAtTime(intensity * 0.05, this.ctx.currentTime);
        skidGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        
        const noise = this.createNoiseBuffer(0.2);
        const source = this.ctx.createBufferSource();
        source.buffer = noise;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        
        source.connect(filter);
        filter.connect(skidGain);
        skidGain.connect(this.masterGain);
        source.start();
    },

    createNoiseBuffer: function(duration) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    },

    // UI Sounds
    playClick: function() {
        this.playTone(440, 0.05, 'triangle');
    },

    // Effects
    playCrash: function() {
        if (!this.ctx) return;
        const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(1000, this.ctx.currentTime);
        lowpass.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.5);

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        whiteNoise.connect(lowpass);
        lowpass.connect(gainNode);
        gainNode.connect(this.masterGain);

        whiteNoise.start();
    },

    playNitro: function(active) {
        if (!this.ctx) return;
        if (active) {
            this.nitroOsc = this.ctx.createOscillator();
            this.nitroOsc.type = 'sine';
            this.nitroOsc.frequency.setValueAtTime(800, this.ctx.currentTime);
            this.nitroOsc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 1);
            
            this.nitroGain = this.ctx.createGain();
            this.nitroGain.gain.setValueAtTime(0.02, this.ctx.currentTime);
            
            this.nitroOsc.connect(this.nitroGain);
            this.nitroGain.connect(this.masterGain);
            this.nitroOsc.start();
        } else if (this.nitroOsc) {
            this.nitroOsc.stop();
            this.nitroOsc = null;
        }
    },

    playTone: function(freq, duration, type) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.1, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
};
