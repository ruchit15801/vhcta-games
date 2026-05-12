/**
 * TRAFFIC RUSH CONTROL - Core Game Logic
 * A premium traffic simulation game.
 */

const G = {
    // Game Constants
    FPS: 60,
    LIVES: 3,
    LANE_WIDTH: 60,
    VEHICLE_SPEED: 2,
    SPAWN_CHANCE: 0.015,
    
    // State
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    lastTime: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    cleared: 0,
    lives: 3,
    level: 1,
    isPaused: false,
    isGameOver: false,
    isLevelComplete: false,
    soundEnabled: true,
    
    // Objects
    vehicles: [],
    intersections: [],
    signals: [],
    particles: [],
    
    // Level Configuration
    levelConfig: {
        target: 10,
        density: 0.015,
        speed: 2,
        intersections: '4-way'
    },

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        window.addEventListener('resize', () => this.resize());
        this.resize();
        
        // Load High Score
        const savedHi = localStorage.getItem('trafficRush_hiScore');
        if (savedHi) document.getElementById('hiScore').innerText = savedHi;
        
        this.updateHUD();
        this.showScreen('startScreen');
    },

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Recalculate road layouts if game is running
        if (this.intersections.length > 0) {
            this.setupLevel(this.level);
        }
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    },

    startGame() {
        this.level = 1;
        this.score = 0;
        this.cleared = 0;
        this.lives = this.LIVES;
        this.combo = 1;
        this.setupLevel(this.level);
        
        this.showScreen('hud'); // Just show HUD, hide all screens
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('signalPanel').classList.remove('hidden');
        
        this.isGameOver = false;
        this.isPaused = false;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
        this.playSound('start');
    },

    setupLevel(lvl) {
        this.vehicles = [];
        this.signals = [];
        this.intersections = [];
        this.particles = [];
        
        // Progression Logic
        this.levelConfig.target = 5 + lvl * 5;
        this.levelConfig.density = 0.01 + Math.min(lvl * 0.002, 0.03);
        this.levelConfig.speed = 2 + Math.min(lvl * 0.1, 3);
        
        // Define Intersection Layout (Shift left and up on mobile to clear UI)
        const centerX = this.width < 800 ? this.width * 0.35 : this.width / 2;
        const centerY = this.width < 800 ? this.height * 0.4 : this.height / 2;
        
        // 4-Way Intersection (Default)
        const intersection = {
            x: centerX,
            y: centerY,
            lanes: lvl > 15 ? 2 : 1,
            signals: []
        };
        
        // Create 4 Signal Groups (North, South, East, West)
        const directions = ['N', 'S', 'E', 'W'];
        directions.forEach((dir, i) => {
            const sig = {
                id: i,
                dir: dir,
                state: 'red', // red, yellow, green
                timer: 0
            };
            this.signals.push(sig);
            intersection.signals.push(sig);
        });
        
        this.intersections.push(intersection);
        this.renderSignalsUI();
        this.updateHUD();
    },

    renderSignalsUI() {
        const panel = document.getElementById('signalControls');
        panel.innerHTML = '';
        
        this.signals.forEach(sig => {
            const group = document.createElement('div');
            group.className = 'signal-group';
            
            const label = document.createElement('div');
            label.className = 'signal-label';
            label.innerText = sig.dir === 'N' ? 'N' : sig.dir === 'S' ? 'S' : sig.dir === 'E' ? 'E' : 'W';
            
            const btns = document.createElement('div');
            btns.className = 'signal-btns';
            
            ['red', 'green'].forEach(state => {
                const btn = document.createElement('button');
                btn.className = `sig-btn ${state} ${sig.state === state ? 'active' : ''}`;
                btn.innerHTML = `<span class="sig-icon">${state === 'red' ? '🛑' : '🚦'}</span><span>${state.toUpperCase()}</span>`;
                btn.onclick = () => this.changeSignal(sig.id, state);
                btns.appendChild(btn);
            });
            
            group.appendChild(label);
            group.appendChild(btns);
            panel.appendChild(group);
        });
    },

    changeSignal(id, newState) {
        const sig = this.signals[id];
        if (sig.state === newState) return;
        
        // If switching to green, set others to red in the same axis to be safe? 
        // No, let the player manage it, but maybe some auto-logic if we want.
        // For now, simple manual control.
        sig.state = newState;
        this.renderSignalsUI();
        this.playSound('signal');
    },

    spawnVehicle() {
        if (this.isPaused || this.isGameOver) return;
        if (Math.random() > this.levelConfig.density) return;
        
        // Pick a random side to spawn from
        const sides = ['N', 'S', 'E', 'W'];
        const from = sides[Math.floor(Math.random() * 4)];
        
        const typeRoll = Math.random();
        let type = 'car';
        if (typeRoll > 0.8) type = 'truck';
        if (typeRoll > 0.95) type = 'emergency';
        if (typeRoll < 0.2) type = 'bike';
        
        const v = new Vehicle(from, type);
        this.vehicles.push(v);
        
        if (type === 'emergency') {
            document.getElementById('emergencyAlert').style.display = 'block';
            this.playSound('siren');
            setTimeout(() => {
                document.getElementById('emergencyAlert').style.display = 'none';
            }, 3000);
        }
    },

    loop(time) {
        if (this.isPaused) return;
        
        const dt = (time - this.lastTime) / 16.67;
        this.lastTime = time;
        
        this.update(dt);
        this.draw();
        
        if (!this.isGameOver) {
            requestAnimationFrame((t) => this.loop(t));
        }
    },

    update(dt) {
        this.spawnVehicle();
        
        // Update Vehicles
        for (let i = this.vehicles.length - 1; i >= 0; i--) {
            const v = this.vehicles[i];
            v.update(dt, this.vehicles, this.signals);
            
            // Check Collision
            if (v.checkCollisions(this.vehicles)) {
                this.handleCrash(v);
            }
            
            // Remove if off screen
            if (v.isOffScreen(this.width, this.height)) {
                this.vehicles.splice(i, 1);
                this.score += 10 * this.combo;
                this.cleared++;
                this.updateHUD();
                this.triggerCombo();
                
                if (this.cleared >= this.levelConfig.target) {
                    this.completeLevel();
                }
            }
        }
        
        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
        
        // Combo Fade
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 1;
                this.updateHUD();
            }
        }
    },

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw Environment
        this.drawRoads();
        
        // Draw Vehicles
        this.vehicles.forEach(v => v.draw(this.ctx));
        
        // Draw Signals on Road
        this.drawSignals();
        
        // Draw Particles
        this.particles.forEach(p => p.draw(this.ctx));
    },

    drawRoads() {
        if (!this.intersections[0]) return;
        const ctx = this.ctx;
        const cx = this.intersections[0].x;
        const cy = this.intersections[0].y;
        const lw = this.LANE_WIDTH;
        
        // Road Background
        ctx.fillStyle = '#1f2937';
        // Vertical Road
        ctx.fillRect(cx - lw, 0, lw * 2, this.height);
        // Horizontal Road
        ctx.fillRect(0, cy - lw, this.width, lw * 2);
        
        // Markings
        ctx.strokeStyle = '#ffffff88';
        ctx.setLineDash([20, 20]);
        ctx.lineWidth = 2;
        
        // Vertical Lines
        ctx.beginPath();
        ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - lw);
        ctx.moveTo(cx, cy + lw); ctx.lineTo(cx, this.height);
        ctx.stroke();
        
        // Horizontal Lines
        ctx.beginPath();
        ctx.moveTo(0, cy); ctx.lineTo(cx - lw, cy);
        ctx.moveTo(cx + lw, cy); ctx.lineTo(this.width, cy);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Intersection Box
        ctx.fillStyle = '#374151';
        ctx.fillRect(cx - lw, cy - lw, lw * 2, lw * 2);
        
        // Zebra Crossings
        ctx.fillStyle = '#ffffff22';
        for(let i=0; i<4; i++) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(i * Math.PI / 2);
            for(let j=0; j<5; j++) {
                ctx.fillRect(-lw + j*24 + 4, -lw - 30, 16, 20);
            }
            ctx.restore();
        }
    },

    drawSignals() {
        if (!this.intersections[0]) return;
        const ctx = this.ctx;
        const cx = this.intersections[0].x;
        const cy = this.intersections[0].y;
        const lw = this.LANE_WIDTH;
        
        this.signals.forEach(sig => {
            ctx.save();
            ctx.translate(cx, cy);
            if (sig.dir === 'N') ctx.rotate(0);
            if (sig.dir === 'E') ctx.rotate(Math.PI / 2);
            if (sig.dir === 'S') ctx.rotate(Math.PI);
            if (sig.dir === 'W') ctx.rotate(-Math.PI / 2);
            
            // Signal Post
            ctx.fillStyle = '#111';
            ctx.fillRect(lw + 5, -lw - 10, 10, 30);
            
            // Light
            ctx.beginPath();
            ctx.arc(lw + 10, -lw + 5, 8, 0, Math.PI * 2);
            ctx.fillStyle = sig.state === 'red' ? '#ff3366' : '#00ff88';
            ctx.shadowBlur = 15;
            ctx.shadowColor = ctx.fillStyle;
            ctx.fill();
            ctx.restore();
        });
    },

    handleCrash(v) {
        if (this.isGameOver) return;
        
        this.lives--;
        this.updateHUD();
        this.playSound('crash');
        this.createExplosion(v.x, v.y);
        
        if (this.lives <= 0) {
            this.gameOver('Multiple collisions detected');
        } else {
            // Remove crashing vehicle and continue
            this.vehicles = this.vehicles.filter(veh => veh !== v);
        }
    },

    createExplosion(x, y) {
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(x, y));
        }
    },

    triggerCombo() {
        this.combo++;
        this.comboTimer = 120; // 2 seconds at 60fps
        const toast = document.getElementById('comboToast');
        toast.innerText = `COMBO x${this.combo}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 500);
    },

    updateHUD() {
        document.getElementById('scoreVal').innerText = this.score;
        document.getElementById('comboVal').innerText = `x${this.combo}`;
        document.getElementById('carsVal').innerText = this.cleared;
        document.getElementById('levelBadge').innerText = `LVL ${this.level}`;
        document.getElementById('livesVal').innerText = '❤️'.repeat(this.lives);
        
        const progress = (this.cleared / this.levelConfig.target) * 100;
        document.getElementById('timerFill').style.width = `${Math.min(progress, 100)}%`;
    },

    completeLevel() {
        this.isPaused = true;
        this.isLevelComplete = true;
        const lcScreen = document.getElementById('levelCompleteScreen');
        document.getElementById('lcScore').innerText = `+${this.level * 500} PTS`;
        this.score += this.level * 500;
        
        let stars = '⭐';
        if (this.lives === 3) stars = '⭐⭐⭐';
        else if (this.lives === 2) stars = '⭐⭐';
        document.getElementById('lcStars').innerText = stars;
        
        this.showScreen('levelCompleteScreen');
        this.playSound('levelComplete');
    },

    nextLevel() {
        this.level++;
        this.cleared = 0;
        this.lives = Math.min(this.lives + 1, this.LIVES);
        this.setupLevel(this.level);
        this.isPaused = false;
        this.isLevelComplete = false;
        this.showScreen('hud');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('signalPanel').classList.remove('hidden');
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    },

    gameOver(reason) {
        this.isGameOver = true;
        this.showScreen('gameOverScreen');
        document.getElementById('goReason').innerText = reason;
        document.getElementById('goScore').innerText = this.score;
        document.getElementById('goLevel').innerText = this.level;
        document.getElementById('goCleared').innerText = this.cleared;
        
        const hi = localStorage.getItem('trafficRush_hiScore') || 0;
        if (this.score > hi) {
            localStorage.setItem('trafficRush_hiScore', this.score);
            document.getElementById('hiScore').innerText = this.score;
        }
    },

    pause() {
        this.isPaused = true;
        this.showScreen('pauseScreen');
    },

    resume() {
        this.isPaused = false;
        this.showScreen('hud');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('signalPanel').classList.remove('hidden');
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    },

    restart() {
        this.startGame();
    },

    menu() {
        this.showScreen('startScreen');
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('signalPanel').classList.add('hidden');
    },

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        document.getElementById('soundToggle').innerText = this.soundEnabled ? '🔊' : '🔇';
    },

    playSound(type) {
        if (!this.soundEnabled) return;
        // Audio synthesis for premium feel without external files
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        if (type === 'signal') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'crash') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(20, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'start') {
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        }
    }
};

class Vehicle {
    constructor(from, type) {
        this.from = from; // N, S, E, W
        this.type = type; // car, truck, bike, emergency
        this.lw = G.LANE_WIDTH;
        const inter = G.intersections[0];
        this.cx = inter ? inter.x : G.width / 2;
        this.cy = inter ? inter.y : G.height / 2;
        
        this.width = type === 'truck' ? 35 : type === 'bike' ? 15 : 25;
        this.length = type === 'truck' ? 70 : type === 'bike' ? 30 : 50;
        this.color = this.getRandomColor(type);
        this.speed = G.levelConfig.speed * (type === 'emergency' ? 1.5 : type === 'bike' ? 1.2 : 1);
        this.currentSpeed = this.speed;
        this.isStopping = false;
        
        // Initial position and velocity
        switch(from) {
            case 'N':
                this.x = this.cx - this.lw / 2;
                this.y = -100;
                this.vx = 0; this.vy = this.speed;
                this.angle = Math.PI;
                break;
            case 'S':
                this.x = this.cx + this.lw / 2;
                this.y = G.height + 100;
                this.vx = 0; this.vy = -this.speed;
                this.angle = 0;
                break;
            case 'E':
                this.x = G.width + 100;
                this.y = this.cy - this.lw / 2;
                this.vx = -this.speed; this.vy = 0;
                this.angle = -Math.PI / 2;
                break;
            case 'W':
                this.x = -100;
                this.y = this.cy + this.lw / 2;
                this.vx = this.speed; this.vy = 0;
                this.angle = Math.PI / 2;
                break;
        }
    }

    getRandomColor(type) {
        if (type === 'emergency') return '#ff3366';
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ffffff'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    update(dt, vehicles, signals) {
        const sig = signals.find(s => s.dir === this.from);
        
        // Stop line detection
        const stopDistance = 120;
        let shouldStop = false;
        
        if (sig && sig.state === 'red' && this.type !== 'emergency') {
            if (this.from === 'N' && this.y < this.cy - stopDistance && this.y > this.cy - stopDistance - 50) shouldStop = true;
            if (this.from === 'S' && this.y > this.cy + stopDistance && this.y < this.cy + stopDistance + 50) shouldStop = true;
            if (this.from === 'E' && this.x > this.cx + stopDistance && this.x < this.cx + stopDistance + 50) shouldStop = true;
            if (this.from === 'W' && this.x < this.cx - stopDistance && this.x > this.cx - stopDistance - 50) shouldStop = true;
        }

        // Vehicle in front detection
        vehicles.forEach(other => {
            if (other === this) return;
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < 100) {
                // Check if other is in front
                let inFront = false;
                if (this.from === 'N' && dy > 0 && Math.abs(dx) < 20) inFront = true;
                if (this.from === 'S' && dy < 0 && Math.abs(dx) < 20) inFront = true;
                if (this.from === 'E' && dx < 0 && Math.abs(dy) < 20) inFront = true;
                if (this.from === 'W' && dx > 0 && Math.abs(dy) < 20) inFront = true;
                
                if (inFront && dist < 80) shouldStop = true;
            }
        });

        if (shouldStop) {
            this.currentSpeed *= 0.8;
            if (this.currentSpeed < 0.1) this.currentSpeed = 0;
        } else {
            this.currentSpeed = this.speed;
        }

        this.x += (this.vx / this.speed) * this.currentSpeed * dt;
        this.y += (this.vy / this.speed) * this.currentSpeed * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-this.width/2 + 4, -this.length/2 + 4, this.width, this.length);
        
        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        const r = 8;
        ctx.roundRect(-this.width/2, -this.length/2, this.width, this.length, r);
        ctx.fill();
        
        // Roof / Details
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(-this.width/2 + 5, -this.length/2 + 10, this.width - 10, this.length - 25);
        
        // Windows
        ctx.fillStyle = '#add8e6';
        ctx.fillRect(-this.width/2 + 6, -this.length/2 + 12, this.width - 12, 10); // Front
        ctx.fillRect(-this.width/2 + 6, this.length/2 - 15, this.width - 12, 5); // Back
        
        // Headlights
        ctx.fillStyle = '#ffffaa';
        ctx.beginPath();
        ctx.arc(-this.width/2 + 6, this.length/2 - 2, 4, 0, Math.PI*2);
        ctx.arc(this.width/2 - 6, this.length/2 - 2, 4, 0, Math.PI*2);
        ctx.fill();
        
        // Siren if emergency
        if (this.type === 'emergency') {
            ctx.fillStyle = Date.now() % 400 < 200 ? '#ff0000' : '#0000ff';
            ctx.fillRect(-5, -5, 10, 10);
        }
        
        ctx.restore();
    }

    checkCollisions(vehicles) {
        for (let other of vehicles) {
            if (other === this) continue;
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 40) return true;
        }
        return false;
    }

    isOffScreen(w, h) {
        return this.x < -200 || this.x > w + 200 || this.y < -200 || this.y > h + 200;
    }
}

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.size = Math.random() * 5 + 2;
        this.color = Math.random() > 0.5 ? '#ff6600' : '#ffcc00';
        this.life = 1.0;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= 0.02 * dt;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// Global Round Rect Polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

window.onload = () => G.init();
