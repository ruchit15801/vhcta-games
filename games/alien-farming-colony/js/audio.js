// Audio System using Web Audio API for procedural sound effects
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const SoundEffects = {
    playTone: (freq, type, duration, vol = 0.1) => {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },
    
    click: () => {
        SoundEffects.playTone(800, 'sine', 0.1, 0.05);
    },
    
    till: () => {
        // Deep crunch
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },
    
    water: () => {
        // High pitch droplet
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    },
    
    plant: () => {
        SoundEffects.playTone(300, 'triangle', 0.15, 0.1);
        setTimeout(() => SoundEffects.playTone(400, 'sine', 0.2, 0.1), 50);
    },
    
    harvest: () => {
        // Magical chime
        SoundEffects.playTone(600, 'sine', 0.1, 0.1);
        setTimeout(() => SoundEffects.playTone(800, 'sine', 0.1, 0.1), 50);
        setTimeout(() => SoundEffects.playTone(1200, 'sine', 0.3, 0.1), 100);
    },
    
    error: () => {
        SoundEffects.playTone(150, 'sawtooth', 0.2, 0.1);
    },

    upgrade: () => {
        SoundEffects.playTone(400, 'square', 0.1, 0.1);
        setTimeout(() => SoundEffects.playTone(600, 'square', 0.1, 0.1), 100);
        setTimeout(() => SoundEffects.playTone(800, 'square', 0.4, 0.1), 200);
    }
};

window.SoundEffects = SoundEffects;
