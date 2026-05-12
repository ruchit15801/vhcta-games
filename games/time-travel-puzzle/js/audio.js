const AudioSys = {
    ctx: null,
    enabled: true,
    bgmNode: null,
    
    init: function() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    toggle: function() {
        this.enabled = !this.enabled;
        return this.enabled;
    },

    playTone: function(freq, type, duration, vol=0.1) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    playJump: function() {
        this.playTone(300, 'sine', 0.3, 0.1);
        setTimeout(() => this.playTone(400, 'sine', 0.2, 0.1), 50);
    },

    playTimeSwitch: function(toPast) {
        if (!this.enabled || !this.ctx) return;
        
        // Cinematic swoosh sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = 'sawtooth';
        
        if (toPast) {
            osc.frequency.setValueAtTime(800, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.5);
            filter.type = 'lowpass';
        } else {
            osc.frequency.setValueAtTime(100, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.5);
            filter.type = 'highpass';
        }
        
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    },

    playPickup: function() {
        this.playTone(600, 'square', 0.1, 0.1);
        setTimeout(() => this.playTone(800, 'square', 0.2, 0.1), 100);
    },
    
    playHeavyMove: function() {
        this.playTone(100, 'sawtooth', 0.2, 0.1);
    },

    playDoorOpen: function() {
        this.playTone(150, 'triangle', 0.8, 0.15);
    }
};
