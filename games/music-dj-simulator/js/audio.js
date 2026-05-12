/**
 * Music DJ Simulator - Procedural Audio Engine
 * Uses Web Audio API to synthesize 4 synchronous stems: Drums, Bass, Melody, Vocals/FX
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.bpm = 128;
        this.isPlaying = false;
        
        // Scheduling state
        this.current16thNote = 0;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.nextNoteTime = 0.0;
        this.timerID = null;

        // Tracks state
        this.tracks = {
            drums: { vol: 0.8, eq: {low: 0, mid: 0, high: 0}, mute: false },
            bass: { vol: 0.8, eq: {low: 0, mid: 0, high: 0}, mute: false },
            melody: { vol: 0.8, eq: {low: 0, mid: 0, high: 0}, mute: false },
            vocals: { vol: 0.8, eq: {low: 0, mid: 0, high: 0}, mute: false }
        };

        this.masterVolume = 1.0;
        this.crossfader = 0.0; // -1 (Deck A) to 1 (Deck B)
        // Deck A: Drums, Bass. Deck B: Melody, Vocals

        // Nodes map
        this.gainNodes = {};
        this.eqNodes = {};
        
        // Master FX
        this.filterSweepActive = false;
        this.filterSweepValue = 0; // 0 to 1
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Master Out
        this.masterGain = this.ctx.createGain();
        
        // Master Filter for sweep FX
        this.masterFilter = this.ctx.createBiquadFilter();
        this.masterFilter.type = 'lowpass';
        this.masterFilter.frequency.value = 20000;
        
        // Analyser for Visualizer
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;
        
        // Routing
        this.masterGain.connect(this.masterFilter);
        this.masterFilter.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
        
        this.masterGain.gain.value = 0.8; // Headroom

        // Setup channel strips for each track
        ['drums', 'bass', 'melody', 'vocals'].forEach(track => {
            // Channel Volume
            this.gainNodes[track] = this.ctx.createGain();
            
            // 3-Band EQ (Low, Mid, High)
            const lowEQ = this.ctx.createBiquadFilter();
            lowEQ.type = 'lowshelf';
            lowEQ.frequency.value = 250;
            
            const midEQ = this.ctx.createBiquadFilter();
            midEQ.type = 'peaking';
            midEQ.frequency.value = 1000;
            midEQ.Q.value = 1;
            
            const highEQ = this.ctx.createBiquadFilter();
            highEQ.type = 'highshelf';
            highEQ.frequency.value = 4000;

            this.eqNodes[track] = { low: lowEQ, mid: midEQ, high: highEQ };

            // Routing: Source -> High -> Mid -> Low -> TrackGain -> MasterGain
            highEQ.connect(midEQ);
            midEQ.connect(lowEQ);
            lowEQ.connect(this.gainNodes[track]);
            this.gainNodes[track].connect(this.masterGain);
            
            this.updateTrackVolume(track); // Initialize volume
        });
    }

    start() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.current16thNote = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.05;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        clearTimeout(this.timerID);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        // 0.25 of a beat per 16th note
        this.nextNoteTime += 0.25 * secondsPerBeat;
        this.current16thNote++;
        if (this.current16thNote === 16) {
            this.current16thNote = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        // DRUMS (Deck A)
        if (!this.tracks.drums.mute) {
            // Kick on 0, 4, 8, 12
            if (beatNumber % 4 === 0) {
                this.playKick(time);
            }
            // Hihat on off-beats (2, 6, 10, 14) and 16ths randomly
            if (beatNumber % 2 !== 0) {
                this.playHihat(time, 0.4);
            } else if (beatNumber % 4 === 2) {
                this.playHihat(time, 0.8);
            }
            // Snare/Clap on 4, 12
            if (beatNumber === 4 || beatNumber === 12) {
                this.playSnare(time);
            }
        }

        // BASS (Deck A)
        if (!this.tracks.bass.mute) {
            const bassPattern = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0];
            if (bassPattern[beatNumber]) {
                const notes = [36, 36, 36, 36, 39, 39, 41, 41];
                const note = notes[Math.floor(beatNumber / 2) % notes.length];
                this.playBass(time, note);
            }
        }

        // MELODY (Deck B)
        if (!this.tracks.melody.mute) {
            const melPattern = [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0];
            if (melPattern[beatNumber]) {
                const notes = [60, 63, 65, 67, 70, 72];
                const note = notes[(beatNumber * 3) % notes.length];
                this.playSynth(time, note);
            }
        }

        // VOCALS/FX (Deck B)
        if (!this.tracks.vocals.mute) {
            // Just a rhythmic robotic stab on specific beats
            if (beatNumber === 0 || beatNumber === 10) {
                this.playVocals(time);
            }
        }
    }

    scheduler() {
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }
        if (this.isPlaying) {
            this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
        }
    }

    // --- SYNTHESIZERS --- //

    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.eqNodes.drums.high);

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        gain.gain.setValueAtTime(1.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    playHihat(time, vol = 0.5) {
        // Noise buffer for hihat
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        const gain = this.ctx.createGain();
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.eqNodes.drums.high);

        gain.gain.setValueAtTime(vol * 0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        noise.start(time);
    }

    playSnare(time) {
        // Noise part
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.eqNodes.drums.high);

        // Tone part
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, time);
        oscGain.gain.setValueAtTime(0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        osc.connect(oscGain);
        oscGain.connect(this.eqNodes.drums.high);

        noise.start(time);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    playBass(time, midiNote) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.value = this.midiToFreq(midiNote);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, time);
        filter.frequency.exponentialRampToValueAtTime(100, time + 0.2);

        gain.gain.setValueAtTime(0.9, time);
        gain.gain.setTargetAtTime(0.0, time + 0.1, 0.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.eqNodes.bass.high);

        osc.start(time);
        osc.stop(time + 0.3);
    }

    playSynth(time, midiNote) {
        // Simple supersaw
        const freq = this.midiToFreq(midiNote);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.4, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

        for (let i = 0; i < 3; i++) {
            const osc = this.ctx.createOscillator();
            osc.type = 'square';
            // Slight detune
            osc.frequency.value = freq + (i - 1) * 2;
            osc.connect(gain);
            osc.start(time);
            osc.stop(time + 0.25);
        }

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, time);
        filter.frequency.linearRampToValueAtTime(500, time + 0.2);

        gain.connect(filter);
        filter.connect(this.eqNodes.melody.high);
    }

    playVocals(time) {
        // Robotic FX stab
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, time);
        osc.frequency.exponentialRampToValueAtTime(100, time + 0.1);
        
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

        // AM modulation for robotic effect
        const mod = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        mod.frequency.value = 50;
        mod.connect(gain.gain); // Modulate amplitude
        mod.start(time);
        mod.stop(time + 0.2);

        osc.connect(gain);
        gain.connect(this.eqNodes.vocals.high);

        osc.start(time);
        osc.stop(time + 0.2);
    }

    // --- CONTROLS --- //

    setTrackVolume(track, val) {
        this.tracks[track].vol = parseFloat(val);
        this.updateTrackVolume(track);
    }

    toggleTrackMute(track) {
        this.tracks[track].mute = !this.tracks[track].mute;
        this.updateTrackVolume(track);
        return !this.tracks[track].mute; // Returns true if playing
    }

    setEQ(track, band, val) {
        // val is -1 to 1. Map to dB (-20 to +10)
        let db = 0;
        if (val < 0) {
            db = val * 20; // -1 -> -20dB
        } else {
            db = val * 10; // 1 -> +10dB
        }
        this.tracks[track].eq[band] = db;
        if (this.eqNodes[track] && this.eqNodes[track][band]) {
            this.eqNodes[track][band].gain.setTargetAtTime(db, this.ctx.currentTime, 0.1);
        }
    }

    setCrossfader(val) {
        this.crossfader = parseFloat(val); // -1 to 1
        ['drums', 'bass', 'melody', 'vocals'].forEach(t => this.updateTrackVolume(t));
    }

    updateTrackVolume(track) {
        if (!this.gainNodes[track]) return;
        
        let cfMult = 1.0;
        // Deck A: Drums, Bass (Left: -1)
        if (track === 'drums' || track === 'bass') {
            if (this.crossfader > 0) {
                cfMult = 1.0 - this.crossfader;
            }
        }
        // Deck B: Melody, Vocals (Right: 1)
        if (track === 'melody' || track === 'vocals') {
            if (this.crossfader < 0) {
                cfMult = 1.0 + this.crossfader;
            }
        }

        const finalVol = this.tracks[track].mute ? 0 : (this.tracks[track].vol * cfMult * this.masterVolume);
        
        // Smooth transition
        this.gainNodes[track].gain.setTargetAtTime(finalVol, this.ctx.currentTime, 0.05);
    }

    triggerBeatDrop() {
        // Mute everything except vocals for a beat, then max volume
        // Just a simple visual effect here, handled in game.js usually, but we can do a filter open
        if (!this.ctx) return;
        this.masterFilter.frequency.setValueAtTime(200, this.ctx.currentTime);
        this.masterFilter.frequency.exponentialRampToValueAtTime(20000, this.ctx.currentTime + 1.0);
    }

    getAnalyserData() {
        if (!this.analyser) return new Uint8Array(0);
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }
}

// Global audio instance
window.audioEngine = new AudioEngine();
