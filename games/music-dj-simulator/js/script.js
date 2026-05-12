/**
 * Music DJ Simulator - Game Logic & UI Controller
 */

class DJGame {
    constructor() {
        this.level = 1;
        this.maxLevel = 30;
        this.score = 0;
        
        // DOM Elements
        this.startBtn = document.getElementById('start-btn');
        this.introScreen = document.getElementById('intro-screen');
        this.hud = document.getElementById('hud');
        this.canvas = document.getElementById('visualizer-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // HUD Elements
        this.levelEl = document.getElementById('level-value');
        this.scoreEl = document.getElementById('score-value');
        this.objectiveEl = document.getElementById('objective-text');
        
        // Level complete
        this.levelCompleteScreen = document.getElementById('level-complete');
        this.completedLevelEl = document.getElementById('completed-level');
        this.finalScoreEl = document.getElementById('final-score');
        this.beatAccuracyEl = document.getElementById('beat-accuracy');
        this.nextLevelBtn = document.getElementById('next-level-btn');

        // Meters
        this.leftMeter = document.querySelector('.left-meter .meter-fill');
        this.rightMeter = document.querySelector('.right-meter .meter-fill');

        // Objectives
        this.currentObjective = null;
        this.objectiveProgress = 0; // 0 to 100
        this.objectiveTimer = 0;

        // Visualizer config
        this.particles = [];
        this.resize();

        this.initEvents();
        this.generateLevels();
        this.loadLevel(this.level);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initEvents() {
        window.addEventListener('resize', () => this.resize());

        this.startBtn.addEventListener('click', () => {
            this.introScreen.classList.add('hidden');
            this.hud.classList.remove('hidden');
            // Start audio engine
            window.audioEngine.start();
            // Start visualizer loop
            this.loop();
        });

        this.nextLevelBtn.addEventListener('click', () => {
            this.levelCompleteScreen.classList.add('hidden');
            if (this.level < this.maxLevel) {
                this.level++;
                this.loadLevel(this.level);
            }
        });

        // Track Mute Buttons
        document.querySelectorAll('.track-mute').forEach(btn => {
            const track = btn.closest('.track-strip').dataset.track;
            // Initialize audio engine state based on UI class
            if (!btn.classList.contains('active')) {
                window.audioEngine.tracks[track].mute = true;
            } else {
                window.audioEngine.tracks[track].mute = false;
            }

            btn.addEventListener('click', () => {
                const isPlaying = window.audioEngine.toggleTrackMute(track);
                if (isPlaying) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
                this.checkObjective();
            });
        });

        // Volume Sliders
        document.querySelectorAll('.fader-vol').forEach(slider => {
            const track = slider.closest('.track-strip').dataset.track;
            slider.addEventListener('input', (e) => {
                window.audioEngine.setTrackVolume(track, e.target.value);
                this.checkObjective();
            });
            // Init
            window.audioEngine.setTrackVolume(track, slider.value);
        });

        // Crossfader
        const crossfader = document.getElementById('crossfader');
        crossfader.addEventListener('input', (e) => {
            window.audioEngine.setCrossfader(e.target.value);
            this.checkObjective();
        });

        // EQ Knobs (Drag Logic)
        document.querySelectorAll('.knob').forEach(knob => {
            let startY = 0;
            let startVal = 0;
            let currentVal = 0; // -1 to 1
            const track = knob.closest('.track-strip').dataset.track;
            const type = knob.dataset.type; // low, mid, high

            const handleMove = (y) => {
                const deltaY = startY - y;
                currentVal = Math.min(1, Math.max(-1, startVal + deltaY * 0.01));
                // Rotate visual: -1 is -135deg, 1 is 135deg
                const deg = currentVal * 135;
                knob.style.transform = `rotate(${deg}deg)`;
                window.audioEngine.setEQ(track, type, currentVal);
                this.checkObjective();
            };

            // Touch
            knob.addEventListener('touchstart', (e) => {
                startY = e.touches[0].clientY;
                startVal = currentVal;
                document.body.style.overflow = 'hidden'; // prevent scroll
            }, {passive: false});

            knob.addEventListener('touchmove', (e) => {
                e.preventDefault();
                handleMove(e.touches[0].clientY);
            }, {passive: false});

            // Mouse
            let isDragging = false;
            knob.addEventListener('mousedown', (e) => {
                isDragging = true;
                startY = e.clientY;
                startVal = currentVal;
            });
            window.addEventListener('mousemove', (e) => {
                if (isDragging) handleMove(e.clientY);
            });
            window.addEventListener('mouseup', () => isDragging = false);
        });

        // FX Buttons
        document.getElementById('fx-drop').addEventListener('mousedown', () => {
            window.audioEngine.triggerBeatDrop();
            document.getElementById('fx-drop').classList.add('active');
            setTimeout(() => document.getElementById('fx-drop').classList.remove('active'), 200);
            this.addScore(50);
        });
        document.getElementById('fx-drop').addEventListener('touchstart', (e) => {
            e.preventDefault();
            window.audioEngine.triggerBeatDrop();
            document.getElementById('fx-drop').classList.add('active');
            setTimeout(() => document.getElementById('fx-drop').classList.remove('active'), 200);
            this.addScore(50);
        });
    }

    generateLevels() {
        this.levels = [];
        for (let i = 1; i <= this.maxLevel; i++) {
            let objective = {};
            if (i === 1) {
                objective = { text: "Unmute the Drums!", check: () => !window.audioEngine.tracks.drums.mute };
            } else if (i === 2) {
                objective = { text: "Bring in the Bass!", check: () => !window.audioEngine.tracks.bass.mute && !window.audioEngine.tracks.drums.mute };
            } else if (i === 3) {
                objective = { text: "Max volume on Drums & Bass", check: () => window.audioEngine.tracks.drums.vol > 0.9 && window.audioEngine.tracks.bass.vol > 0.9 };
            } else if (i <= 10) {
                objective = { 
                    text: `Crossfade to Deck B (Melody & Vocals)`, 
                    check: () => document.getElementById('crossfader').value > 0.8 && !window.audioEngine.tracks.melody.mute
                };
            } else if (i <= 20) {
                objective = {
                    text: `Cut the Low EQ on Bass!`,
                    check: () => window.audioEngine.tracks.bass.eq.low < -10
                };
            } else {
                objective = {
                    text: `Full Mix! All tracks playing, Crossfader center`,
                    check: () => !window.audioEngine.tracks.drums.mute && !window.audioEngine.tracks.vocals.mute && Math.abs(document.getElementById('crossfader').value) < 0.2
                };
            }
            this.levels.push({
                num: i,
                objective: objective
            });
        }
    }

    loadLevel(num) {
        this.levelEl.innerText = num;
        this.currentObjective = this.levels[num - 1].objective;
        this.objectiveEl.innerText = this.currentObjective.text;
        this.objectiveProgress = 0;
        this.objectiveTimer = 0;
    }

    checkObjective() {
        if (!this.currentObjective) return;
        if (this.currentObjective.check()) {
            this.objectiveProgress += 10; // Check periodically
            if (this.objectiveProgress >= 100) {
                this.completeLevel();
            }
        } else {
            this.objectiveProgress = 0;
        }
    }

    completeLevel() {
        this.currentObjective = null;
        this.objectiveEl.innerText = "LEVEL COMPLETE!";
        this.addScore(1000 * this.level);
        
        setTimeout(() => {
            this.completedLevelEl.innerText = this.level;
            this.finalScoreEl.innerText = this.score;
            // Fake beat sync accuracy based on level
            this.beatAccuracyEl.innerText = Math.floor(80 + Math.random() * 20) + "%";
            this.levelCompleteScreen.classList.remove('hidden');
        }, 1000);
    }

    addScore(pts) {
        this.score += pts;
        this.scoreEl.innerText = this.score;
        this.scoreEl.classList.add('pulse');
        setTimeout(() => this.scoreEl.classList.remove('pulse'), 300);
    }

    loop() {
        this.updateVisualizer();
        this.updateMeters();
        
        // Periodically check objective to require holding the state
        this.objectiveTimer++;
        if (this.objectiveTimer > 60) {
            this.checkObjective();
            this.objectiveTimer = 0;
        }

        requestAnimationFrame(() => this.loop());
    }

    updateMeters() {
        const data = window.audioEngine.getAnalyserData();
        if (!data || data.length === 0) return;

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i];
        }
        const avg = sum / data.length;
        
        // Update master meters (add some pseudo-randomness for L/R separation visual)
        const leftVol = Math.min(100, (avg / 128) * 100 + (Math.random()*10 - 5));
        const rightVol = Math.min(100, (avg / 128) * 100 + (Math.random()*10 - 5));

        this.leftMeter.style.height = `${leftVol}%`;
        this.leftMeter.style.width = `${leftVol}%`;
        this.rightMeter.style.height = `${rightVol}%`;
        this.rightMeter.style.width = `${rightVol}%`;

        // Beat Pulse effect on UI
        if (avg > 180) { // Threshold for beat
            document.querySelector('.mixer-board').style.boxShadow = `0 20px 50px rgba(0,0,0,0.8), inset 0 2px 10px rgba(255,255,255,0.1), 0 0 ${avg/4}px var(--neon-blue)`;
        } else {
            document.querySelector('.mixer-board').style.boxShadow = `0 20px 50px rgba(0,0,0,0.8), inset 0 2px 10px rgba(255,255,255,0.1)`;
        }
    }

    updateVisualizer() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const data = window.audioEngine.getAnalyserData();
        if (!data || data.length === 0) return;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Draw frequency spectrum
        const bars = 64;
        const step = Math.floor(data.length / bars);
        const radius = Math.min(centerX, centerY) - 50;

        for (let i = 0; i < bars; i++) {
            const val = data[i * step];
            const angle = (i * Math.PI * 2) / bars;
            
            const barHeight = val * 1.5;
            
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);

            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.lineWidth = 4;
            
            // Gradient color based on frequency
            const hue = (i / bars) * 360;
            this.ctx.strokeStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
            
            // Add glow
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = `hsla(${hue}, 100%, 50%, 1)`;
            
            this.ctx.stroke();
            this.ctx.shadowBlur = 0; // Reset
        }

        // Emit particles on loud beats
        if (data[2] > 200 && Math.random() > 0.5) {
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                color: `hsla(${Math.random()*360}, 100%, 50%, 1)`
            });
        }

        // Draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life;
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;
    }
}

// Start Game on load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new DJGame();
});
