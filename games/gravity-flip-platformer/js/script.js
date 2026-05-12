// Audio System (Synth based, 100% reliable without external files)
const AudioSys = {
    ctx: null,
    enabled: true,
    init() {
        if (!this.ctx) {
            const AContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AContext();
        }
    },
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    },
    playTone(freq, type, duration, vol, slideFreq) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    playNoise(duration, vol) {
        if (!this.enabled || !this.ctx) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        // lowpass filter for explosion
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    },
    flip() { this.playTone(400, 'sine', 0.15, 0.1, 800); },
    die() { this.playNoise(0.5, 0.3); this.playTone(150, 'sawtooth', 0.4, 0.2, 50); },
    checkpoint() { this.playTone(600, 'square', 0.1, 0.1, 900); setTimeout(()=>this.playTone(900, 'square', 0.2, 0.1, 1200), 100); },
    win() {
        [523, 659, 783, 1046].forEach((f, i) => {
            setTimeout(() => this.playTone(f, 'sine', 0.2, 0.1), i * 150);
        });
    }
};

// Procedural Level Generator
const LevelGen = {
    TILE: 40,
    generate(levelNum) {
        // levelNum 1 to 40
        let blocks = [];
        let length = 40 + levelNum * 20; // Increases length
        let width = length * this.TILE;
        let height = 15 * this.TILE; // 600px height

        // Always have ground and ceiling
        blocks.push({ x: 0, y: 0, w: width + 800, h: this.TILE, type: 'wall' });
        blocks.push({ x: 0, y: height - this.TILE, w: width + 800, h: this.TILE, type: 'wall' });

        let speed = 300 + (levelNum * 12); // Speed increases with levels
        let traps = [];
        let checkpoints = [];

        let currentX = 800; // start safe
        // Difficulty thresholds
        let hasSpikes = levelNum >= 4;
        let hasMoving = levelNum >= 8;
        let hasComplexity = levelNum >= 16;

        while (currentX < width) {
            let gap = hasComplexity ? 300 : 400; // Space between obstacle chunks
            
            // Generate a chunk
            let r = Math.random();

            if (r < 0.2 && hasSpikes) {
                // Ground Spikes
                traps.push({ x: currentX, y: height - this.TILE - 20, w: 40, h: 20, type: 'spike_up' });
                if (Math.random() > 0.5) currentX += 40;
                traps.push({ x: currentX, y: height - this.TILE - 20, w: 40, h: 20, type: 'spike_up' });
            } 
            else if (r < 0.4 && hasSpikes) {
                // Ceiling Spikes
                traps.push({ x: currentX, y: this.TILE, w: 40, h: 20, type: 'spike_down' });
                if (Math.random() > 0.5) currentX += 40;
                traps.push({ x: currentX, y: this.TILE, w: 40, h: 20, type: 'spike_down' });
            }
            else if (r < 0.6 && hasMoving) {
                // Floating block to act as wall, forces flip
                blocks.push({ x: currentX, y: height/2 - 60, w: 60, h: 120, type: 'wall' });
                // Spikes on it
                traps.push({ x: currentX, y: height/2 - 80, w: 60, h: 20, type: 'spike_up' });
                traps.push({ x: currentX, y: height/2 + 60, w: 60, h: 20, type: 'spike_down' });
            }
            else if (r < 0.8 && hasComplexity) {
                // Tunnel
                blocks.push({ x: currentX, y: this.TILE, w: 300, h: 200, type: 'wall' });
                blocks.push({ x: currentX, y: height - this.TILE - 200, w: 300, h: 200, type: 'wall' });
                // Requires exact flip timing
                traps.push({ x: currentX + 100, y: 200 + this.TILE, w: 40, h: 20, type: 'spike_down' });
                traps.push({ x: currentX + 200, y: height - this.TILE - 220, w: 40, h: 20, type: 'spike_up' });
                currentX += 300;
                gap = 200;
            }
            else {
                // Just a gap/easy
                blocks.push({ x: currentX, y: height/2 - 20, w: 200, h: 40, type: 'wall' });
            }

            currentX += gap;

            // Occasional checkpoint
            if (currentX % 2000 < gap && currentX < width - 1000) {
                checkpoints.push({ x: currentX, y: height/2 - 100, w: 20, h: 200, active: true });
            }
        }

        let finish = { x: width + 400, y: 0, w: 100, h: height };

        return { blocks, traps, checkpoints, finish, baseSpeed: speed, height, limit: width + 500 };
    }
};

// Main Game Engine
const Game = {
    canvas: null,
    ctx: null,
    w: 0, h: 0,
    state: 'START', // START, PLAYING, PAUSED, DEAD, CLEAR
    level: 1,
    time: 0,
    deaths: 0,
    
    // Camera
    camX: 0,
    
    // Physics & Player
    player: {
        x: 200,
        y: 300,
        w: 26,
        h: 26,
        vx: 400, // speed
        vy: 0,
        gravity: 2500, // pull
        flipped: false,
        isDead: false,
        trail: [],
        rot: 0
    },

    world: null,
    lastTime: 0,
    particles: [],

    // UI elements
    ui: {},
    scale: 1,

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        // Setup UI
        this.ui = {
            time: document.getElementById('time-display'),
            deaths: document.getElementById('death-display'),
            prog: document.getElementById('progress-bar'),
            lvl: document.getElementById('level-display'),
            startScn: document.getElementById('start-screen'),
            resultScn: document.getElementById('result-screen'),
            pauseScn: document.getElementById('pause-screen'),
            notif: document.getElementById('notification'),
            rTime: document.getElementById('result-time'),
            rDeaths: document.getElementById('result-deaths'),
            rTitle: document.getElementById('result-title'),
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Controls
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                if (this.state === 'PLAYING') this.flipGravity();
                else if (this.state === 'START' || this.state === 'CLEAR' || this.state === 'DEAD') this.startLevel();
            }
            if (e.code === 'Escape') {
                this.togglePause();
            }
        });
        
        this.canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (this.state === 'PLAYING') this.flipGravity();
        });

        // Buttons
        document.getElementById('start-btn').addEventListener('click', () => this.startLevel());
        document.getElementById('next-btn').addEventListener('click', () => {
            this.level++;
            this.startLevel();
        });
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());

        const snd1 = document.getElementById('toggle-sound-start');
        snd1.addEventListener('click', () => {
            let s = AudioSys.toggle();
            snd1.innerText = "SOUND: " + (s ? "ON" : "OFF");
        });

        requestAnimationFrame((t) => this.loop(t));
    },

    resize() {
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = this.w;
        this.canvas.height = this.h;
        
        // Compute game scale for narrow or short screens
        this.scale = 1;
        let worldHeight = 15 * LevelGen.TILE; // 600px
        if (this.h < worldHeight + 40) {
            this.scale = this.h / (worldHeight + 40);
        }
        if (this.w < 800 * this.scale) {
            let altScale = this.w / 800;
            if (altScale < this.scale) this.scale = altScale;
        }
    },

    startLevel() {
        AudioSys.init();
        this.state = 'PLAYING';
        this.ui.startScn.classList.add('hidden');
        this.ui.resultScn.classList.add('hidden');
        this.ui.lvl.innerText = this.level;
        this.ui.deaths.innerText = this.deaths;
        this.time = 0;
        this.deaths = 0;
        
        this.world = LevelGen.generate(this.level);
        
        this.resetPlayer(true);
        this.lastTime = performance.now();
    },

    resetPlayer(fullReset = false) {
        if (fullReset) {
            this.player.x = 200;
        } else {
            // Find latest checkpoint
            let cpX = 200;
            this.world.checkpoints.forEach(cp => {
                if (!cp.active && cp.x < this.player.x) cpX = cp.x + 50;
            });
            this.player.x = cpX;
        }
        
        this.player.y = this.world.height / 2;
        this.player.vx = this.world.baseSpeed;
        this.player.vy = 0;
        this.player.flipped = false;
        this.player.isDead = false;
        this.player.trail = [];
        this.player.rot = 0;
        
        this.particles = [];
        this.camX = this.player.x - this.w * 0.2;
    },

    flipGravity() {
        if (this.player.isDead) return;
        
        // In true VVVVVV we can only flip when touching ground/ceiling.
        // Let's allow buffer or slight air flipping for hyper-casual feel, but mostly grounded.
        // Check if on ground/ceil
        let onSur = false;
        let pbox = { x: this.player.x, y: this.player.y + (this.player.flipped ? -2 : 2), w: this.player.w, h: this.player.h };
        
        for (let b of this.world.blocks) {
            if (this.intersects(pbox, b)) {
                onSur = true; break;
            }
        }

        // Allow flip if close to surface
        if (onSur || Math.abs(this.player.vy) < 50) { 
            this.player.flipped = !this.player.flipped;
            this.player.vy = 0;
            AudioSys.flip();
            // Burst particles
            this.spawnParticles(this.player.x + this.player.w/2, this.player.y + this.player.h/2, '#00f3ff', 5);
        }
    },

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.ui.pauseScn.classList.remove('hidden');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.ui.pauseScn.classList.add('hidden');
            this.lastTime = performance.now();
        }
    },

    die() {
        if (this.player.isDead) return;
        this.player.isDead = true;
        this.deaths++;
        this.ui.deaths.innerText = this.deaths;
        AudioSys.die();
        this.spawnParticles(this.player.x + this.player.w/2, this.player.y + this.player.h/2, '#ff00ea', 20);
        
        setTimeout(() => {
            if (this.state === 'PLAYING') this.resetPlayer();
        }, 600);
    },

    completeLevel() {
        this.state = 'CLEAR';
        AudioSys.win();
        this.ui.rTime.innerText = this.time.toFixed(2) + 's';
        this.ui.rDeaths.innerText = this.deaths;
        this.ui.resultScn.classList.remove('hidden');
    },

    showCheckpoint() {
        AudioSys.checkpoint();
        this.ui.notif.classList.remove('hidden');
        setTimeout(() => this.ui.notif.classList.add('hidden'), 1500);
    },

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 400,
                vy: (Math.random() - 0.5) * 400,
                l: 1,
                color,
                size: Math.random() * 4 + 2
            });
        }
    },

    intersects(r1, r2) {
        return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
               r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
    },

    update(dt) {
        if (this.state !== 'PLAYING') return;

        this.time += dt;
        this.ui.time.innerText = this.time.toFixed(1);
        
        let p = this.player;

        if (!p.isDead) {
            // Apply Gravity
            p.vy += (p.flipped ? -p.gravity : p.gravity) * dt;
            
            // Limit Fall Speed
            if (p.vy > 1000) p.vy = 1000;
            if (p.vy < -1000) p.vy = -1000;

            // X Movement
            let nextX = p.x + p.vx * dt;
            let curBox = { x: p.x, y: p.y, w: p.w, h: p.h };
            let testX = { x: nextX, y: p.y, w: p.w, h: p.h };
            let hitWall = false;

            for (let b of this.world.blocks) {
                if (this.intersects(testX, b)) {
                    hitWall = true;
                    this.die();
                    break;
                }
            }

            if (!hitWall) p.x = nextX;

            // Y Movement
            let nextY = p.y + p.vy * dt;
            let testY = { x: p.x, y: nextY, w: p.w, h: p.h };
            let hitGround = false;

            for (let b of this.world.blocks) {
                if (this.intersects(testY, b)) {
                    if (p.vy > 0) { // falling down
                        p.y = b.y - p.h;
                    } else { // falling up
                        p.y = b.y + b.h;
                    }
                    p.vy = 0;
                    hitGround = true;
                    break;
                }
            }

            if (!hitGround) p.y = nextY;

            // Bounds check
            if (p.y < -100 || p.y > this.world.height + 100) this.die();

            // Collision with Traps
            let pSmallBox = { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 8 };
            for (let t of this.world.traps) {
                if (this.intersects(pSmallBox, t)) {
                    this.die();
                    break;
                }
            }

            // Checkpoints
            for (let cp of this.world.checkpoints) {
                if (cp.active && this.intersects(curBox, cp)) {
                    cp.active = false;
                    this.showCheckpoint();
                    this.spawnParticles(cp.x, cp.y + cp.h/2, '#00ffaa', 10);
                }
            }

            // Finish
            if (this.intersects(curBox, this.world.finish)) {
                this.completeLevel();
            }

            // Trail
            if (this.time % 0.05 < 0.02) {
                p.trail.push({ x: p.x, y: p.y, a: 1 });
            }
            if (p.trail.length > 8) p.trail.shift();
            
            // Rotation animation based on flip
            let targetRot = p.flipped ? Math.PI : 0;
            p.rot += (targetRot - p.rot) * 10 * dt;
            
            // Progress Bar
            let prog = Math.min(100, Math.max(0, (p.x / this.world.limit) * 100));
            this.ui.prog.style.width = prog + '%';
        }

        // Update trail
        for (let t of p.trail) t.a -= 2 * dt;
        p.trail = p.trail.filter(t => t.a > 0);

        // Update particles
        for (let pt of this.particles) {
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vy += 800 * dt; // gravity for particles
            pt.l -= dt * 1.5;
        }
        this.particles = this.particles.filter(pt => pt.l > 0);

        // Camera follow
        let targetCamX = p.x - (this.w / this.scale) * 0.25;
        this.camX += (targetCamX - this.camX) * 5 * dt;
    },

    draw() {
        // Gradient Background
        const grad = this.ctx.createRadialGradient(this.w/2, this.h/2, 0, this.w/2, this.h/2, this.w);
        grad.addColorStop(0, '#111122');
        grad.addColorStop(1, '#05050a');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.w, this.h);

        if (!this.world) return;

        this.ctx.save();
        
        let renderOffsetY = Math.max(0, (this.h - this.world.height * this.scale) / 2);
        
        // Parallax Grid Background
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        let bgOffsetX = (this.camX * 0.2) % 40;
        for (let i = 0; i < this.w; i += 40) {
            this.ctx.moveTo(i - bgOffsetX, 0);
            this.ctx.lineTo(i - bgOffsetX, this.h);
        }
        for (let i = 0; i < this.h; i += 40) {
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(this.w, i);
        }
        this.ctx.stroke();

        this.ctx.translate(0, renderOffsetY);
        this.ctx.scale(this.scale, this.scale);
        this.ctx.translate(-this.camX, 0);

        // Draw Checkpoints
        for (let cp of this.world.checkpoints) {
            this.ctx.fillStyle = cp.active ? 'rgba(0, 255, 170, 0.2)' : 'rgba(100, 100, 100, 0.2)';
            this.ctx.fillRect(cp.x, cp.y, cp.w, cp.h);
            this.ctx.strokeStyle = cp.active ? '#00ffaa' : '#555';
            this.ctx.strokeRect(cp.x, cp.y, cp.w, cp.h);
        }

        // Draw Finish Line
        let f = this.world.finish;
        const fGrad = this.ctx.createLinearGradient(f.x, 0, f.x + f.w, 0);
        fGrad.addColorStop(0, 'rgba(0, 243, 255, 0)');
        fGrad.addColorStop(1, 'rgba(0, 243, 255, 0.8)');
        this.ctx.fillStyle = fGrad;
        this.ctx.fillRect(f.x, f.y, f.w, f.h);

        // Draw Blocks
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        
        for (let b of this.world.blocks) {
            // Ignore blocks far out of view
            if (b.x + b.w < this.camX - 100 || b.x > this.camX + (this.w / this.scale) + 200) continue;

            const bGrad = this.ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
            bGrad.addColorStop(0, '#1a1a3a');
            bGrad.addColorStop(1, '#0f0f20');
            this.ctx.fillStyle = bGrad;
            
            this.ctx.beginPath();
            this.ctx.roundRect(b.x, b.y, b.w, b.h, 4);
            this.ctx.fill();
            
            this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.6)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Internal neon line
            this.ctx.strokeStyle = 'rgba(255, 0, 234, 0.2)';
            this.ctx.strokeRect(b.x+4, b.y+4, b.w-8, b.h-8);
        }

        // Draw Traps (Spikes)
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = 'rgba(255, 0, 234, 0.6)';
        this.ctx.fillStyle = '#ff00ea';
        for (let t of this.world.traps) {
            if (t.x + t.w < this.camX - 100 || t.x > this.camX + (this.w / this.scale) + 200) continue;
            
            this.ctx.beginPath();
            if (t.type === 'spike_up') {
                this.ctx.moveTo(t.x, t.y + t.h);
                this.ctx.lineTo(t.x + t.w/2, t.y);
                this.ctx.lineTo(t.x + t.w, t.y + t.h);
            } else if (t.type === 'spike_down') {
                this.ctx.moveTo(t.x, t.y);
                this.ctx.lineTo(t.x + t.w/2, t.y + t.h);
                this.ctx.lineTo(t.x + t.w, t.y);
            }
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }

        // Draw Player Trail
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#00f3ff';
        for (let tr of this.player.trail) {
            this.ctx.fillStyle = `rgba(0, 243, 255, ${tr.a * 0.5})`;
            this.ctx.fillRect(tr.x + 2, tr.y + 2, this.player.w - 4, this.player.h - 4);
        }

        // Draw Player
        if (!this.player.isDead) {
            this.ctx.save();
            this.ctx.translate(this.player.x + this.player.w/2, this.player.y + this.player.h/2);
            this.ctx.rotate(this.player.rot);
            
            // Glow
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#00f3ff';
            
            this.ctx.fillStyle = '#fff';
            this.ctx.fillRect(-this.player.w/2, -this.player.h/2, this.player.w, this.player.h);
            
            // Inner Core
            this.ctx.fillStyle = '#00f3ff';
            this.ctx.fillRect(-this.player.w/4, -this.player.h/4, this.player.w/2, this.player.h/2);
            
            // Eye slice
            this.ctx.fillStyle = '#050510';
            this.ctx.fillRect(this.player.w/4 - 2, -this.player.h/4, 4, 8);
            
            this.ctx.restore();
        }

        // Particles
        this.ctx.shadowBlur = 10;
        for (let pt of this.particles) {
            this.ctx.globalAlpha = pt.l;
            this.ctx.shadowColor = pt.color;
            this.ctx.fillStyle = pt.color;
            this.ctx.beginPath();
            this.ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI*2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
        this.ctx.shadowBlur = 0;

        this.ctx.restore();
    },

    loop(t) {
        requestAnimationFrame((nt) => this.loop(nt));
        if (!this.lastTime) this.lastTime = t;
        let dt = (t - this.lastTime) / 1000;
        this.lastTime = t;
        
        // Cap delta time to prevent physics clipping on lag
        if (dt > 0.05) dt = 0.05;

        this.update(dt);
        this.draw();
    }
};

window.onload = () => Game.init();
