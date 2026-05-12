/**
 * CYBER-RUN: Production-Ready Endless Runner
 * Developed by Antigravity (Google Deepmind)
 */

// --- CONFIGURATION & CONSTANTS ---
const CONFIG = {
    LANES: 3,
    LANE_WIDTH: 200,
    INITIAL_SPEED: 8,
    SPEED_INC: 0.0001,
    MAX_SPEED: 25,
    GRAVITY: 0.8,
    JUMP_FORCE: -18,
    SLIDE_DURATION: 800,
    CAMERA_FOV: 800,
    SPAWN_DIST: 5000, // Massive distance for vanishing point
    BASE_LANE_WIDTH: 200,
    LANE_WIDTH: 200,
    HORIZON_Y: 0.35, // % of canvas height
    GROUND_Y: 0.85,  // % of canvas height
    COLORS: {
        NEON_BLUE: '#00e5ff',
        NEON_PINK: '#ff00e5',
        NEON_GREEN: '#39ff14',
        CYBER_YELLOW: '#fff200',
        BG_DARK: '#050510'
    }
};

// --- AUDIO SYNTHESIZER ---
class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    toggle(val) { this.enabled = val; }

    play(type) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;

        switch (type) {
            case 'jump':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'slide':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.linearRampToValueAtTime(50, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;
            case 'collect':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'crash':
                osc.type = 'square';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(10, now + 0.4);
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
                break;
        }
    }
}

const Audio = new AudioManager();

// --- VISUAL EFFECTS ---
class Particle {
    constructor(x, y, color, speed, angle, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = life;
        this.maxLife = life;
    }

    update(dt) {
        this.x += this.vx * (dt / 16);
        this.y += this.vy * (dt / 16);
        this.life -= dt;
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class ParticleEmitter {
    constructor() {
        this.particles = [];
    }

    emit(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const speed = Math.random() * 5 + 2;
            const angle = Math.random() * Math.PI * 2;
            const life = Math.random() * 500 + 500;
            this.particles.push(new Particle(x, y, color, speed, angle, life));
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }
}

// --- GAME LOGIC ---
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = 'MENU';
        this.score = 0;
        this.coins = 0;
        this.highScore = localStorage.getItem('cyberrun_highscore') || 0;
        this.speed = CONFIG.INITIAL_SPEED;

        this.player = new Player(this);
        this.obstacles = [];
        this.background = new Background(this);
        this.particles = new ParticleEmitter();
        this.shake = 0;
        this.lastTime = 0;
        this.spawnTimer = 0;

        this.initResize();
        this.initControls();
        this.bindUI();

        document.getElementById('top-score-val').textContent = Math.floor(this.highScore);
    }

    initResize() {
        const resize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;

            // Dynamic Lane Width based on screen width
            CONFIG.LANE_WIDTH = Math.min(200, this.canvas.width / 5);

            this.player.updatePosition();
        };
        window.addEventListener('resize', resize);
        resize();
    }

    bindUI() {
        document.getElementById('start-btn').onclick = () => this.showTutorial();
        document.getElementById('ready-btn').onclick = () => this.start();
        document.getElementById('restart-btn').onclick = () => this.start();
        document.getElementById('pause-btn').onclick = () => this.pause();
        document.getElementById('resume-btn').onclick = () => this.resume();
        document.getElementById('audio-toggle').onchange = (e) => Audio.toggle(e.target.checked);
        document.getElementById('main-menu-btn').onclick = () => this.resetToMenu();
    }

    initControls() {
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'PLAYING') return;
            switch (e.code) {
                case 'ArrowLeft': case 'KeyA': this.player.moveLane(-1); break;
                case 'ArrowRight': case 'KeyD': this.player.moveLane(1); break;
                case 'ArrowUp': case 'KeyW': case 'Space': this.player.jump(); break;
                case 'ArrowDown': case 'KeyS': this.player.slide(); break;
            }
        });

        // Swipe Support
        let touchStartX = 0;
        let touchStartY = 0;
        this.canvas.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        this.canvas.addEventListener('touchend', (e) => {
            if (this.state !== 'PLAYING') return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            const threshold = 30;

            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > threshold) this.player.moveLane(1);
                else if (dx < -threshold) this.player.moveLane(-1);
            } else {
                if (dy > threshold) this.player.slide();
                else if (dy < -threshold) this.player.jump();
            }
        }, { passive: true });
    }

    showTutorial() {
        this.state = 'TUTORIAL';
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('tutorial-screen').classList.remove('hidden');
    }

    start() {
        Audio.init();
        this.state = 'PLAYING';
        this.score = 0;
        this.coins = 0;
        this.speed = CONFIG.INITIAL_SPEED;
        this.obstacles = [];
        this.player.reset();
        this.spawnTimer = 0;

        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('tutorial-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    pause() {
        if (this.state !== 'PLAYING') return;
        this.state = 'PAUSED';
        document.getElementById('pause-screen').classList.remove('hidden');
    }

    resume() {
        this.state = 'PLAYING';
        document.getElementById('pause-screen').classList.add('hidden');
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    gameOver() {
        this.state = 'GAMEOVER';
        Audio.play('crash');
        this.shake = 500;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('cyberrun_highscore', this.highScore);
            document.getElementById('new-record').classList.remove('hidden');
        } else {
            document.getElementById('new-record').classList.add('hidden');
        }

        document.getElementById('final-score').textContent = Math.floor(this.score);
        document.getElementById('final-coins').textContent = this.coins;
        document.getElementById('top-score-val').textContent = Math.floor(this.highScore);

        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
    }

    resetToMenu() {
        this.state = 'MENU';
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('tutorial-screen').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        this.speed = Math.min(CONFIG.MAX_SPEED, this.speed + CONFIG.SPEED_INC * dt);
        this.score += (this.speed / 10) * (dt / 16);

        this.player.update(dt);
        this.background.update(dt);
        this.particles.update(dt);

        if (this.shake > 0) {
            this.shake -= dt;
            if (this.shake < 0) this.shake = 0;
        }

        // Spawn obstacles
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnObstacle();
            this.spawnTimer = Math.max(400, 1500 - (this.speed * 40));
        }

        // Update obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.update(dt, this.speed);

            // Collision check
            if (obs.z < 20 && obs.z > -20 && obs.lane === this.player.lane) {
                if (this.checkCollision(obs)) {
                    this.gameOver();
                }
            }

            if (obs.z < -100) this.obstacles.splice(i, 1);
        }

        // UI update
        document.getElementById('score-val').textContent = Math.floor(this.score).toString().padStart(5, '0');
        document.getElementById('coins-val').textContent = this.coins;
    }

    spawnObstacle() {
        const lane = Math.floor(Math.random() * 3);
        const types = ['BLOCK', 'HURDLE', 'PIPE', 'COIN'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.obstacles.push(new Obstacle(lane, type, CONFIG.SPAWN_DIST));

        // Sometimes spawn a second obstacle in different lane
        if (Math.random() > 0.7 && this.speed > 12) {
            const lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
            this.obstacles.push(new Obstacle(lane2, type, CONFIG.SPAWN_DIST));
        }
    }

    checkCollision(obs) {
        const scale = CONFIG.CAMERA_FOV / (CONFIG.CAMERA_FOV + obs.z);
        const screenX = this.canvas.width / 2 + (obs.lane - 1) * CONFIG.LANE_WIDTH * scale;
        const screenY = this.canvas.height * CONFIG.GROUND_Y;

        if (obs.type === 'COIN') {
            this.coins++;
            Audio.play('collect');
            this.particles.emit(screenX, screenY - 30 * scale, CONFIG.COLORS.CYBER_YELLOW, 15);
            this.obstacles.splice(this.obstacles.indexOf(obs), 1);
            return false;
        }

        // Hurdle: Jump over it
        if (obs.type === 'HURDLE') {
            return this.player.y > -20;
        }
        // Pipe: Slide under it
        if (obs.type === 'PIPE') {
            return !this.player.isSliding;
        }
        // Block: Fatal
        return true;
    }

    draw() {
        this.ctx.save();
        if (this.shake > 0) {
            const sx = (Math.random() - 0.5) * 10;
            const sy = (Math.random() - 0.5) * 10;
            this.ctx.translate(sx, sy);
        }

        this.ctx.fillStyle = CONFIG.COLORS.BG_DARK;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.background.draw(this.ctx);

        // Sort obstacles by Z (painter's algorithm)
        const sorted = [...this.obstacles].sort((a, b) => b.z - a.z);
        sorted.forEach(obs => obs.draw(this.ctx, this.canvas));

        this.player.draw(this.ctx, this.canvas);
        this.particles.draw(this.ctx);

        this.ctx.restore();

        // Screen glare effect
        const grad = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.width
        );
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, 'rgba(0,0,20,0.3)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    loop(time) {
        if (this.state === 'PAUSED' || this.state === 'GAMEOVER') return;
        const dt = time - (this.lastTime || time);
        this.lastTime = time;

        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

class Player {
    constructor(game) {
        this.game = game;
        this.lane = 1; // 0: Left, 1: Center, 2: Right
        this.targetX = 0;
        this.currentX = 0;
        this.y = 0;
        this.vy = 0;
        this.isJumping = false;
        this.isSliding = false;
        this.slideTimer = 0;
        this.width = 40;
        this.height = 80;
        this.trail = [];
    }

    reset() {
        this.lane = 1;
        this.y = 0;
        this.vy = 0;
        this.isJumping = false;
        this.isSliding = false;
        this.targetX = 0;
        this.currentX = 0;
        this.trail = [];
    }

    moveLane(dir) {
        this.lane = Math.max(0, Math.min(2, this.lane + dir));
    }

    jump() {
        if (this.isJumping || this.isSliding) return;
        this.isJumping = true;
        this.vy = CONFIG.JUMP_FORCE;
        Audio.play('jump');
        this.emitParticles(10);
    }

    slide() {
        if (this.isSliding) return;
        this.isSliding = true;
        this.slideTimer = CONFIG.SLIDE_DURATION;
        if (this.isJumping) this.vy = 10; // Fast fall
        Audio.play('slide');
        this.emitParticles(8);
    }

    update(dt) {
        // Lane Movement Smoothing
        this.targetX = (this.lane - 1) * CONFIG.LANE_WIDTH;
        this.currentX += (this.targetX - this.currentX) * 0.15;

        // Physics
        this.y += this.vy;
        if (this.y < 0 || this.isJumping) {
            this.vy += CONFIG.GRAVITY;
        }

        if (this.y >= 0) {
            if (this.isJumping) {
                this.game.shake = 50;
                this.emitParticles(5);
            }
            this.y = 0;
            this.vy = 0;
            this.isJumping = false;
        }

        // Slide logic
        if (this.isSliding) {
            this.slideTimer -= dt;
            if (this.slideTimer <= 0) this.isSliding = false;
        }

        // Trail logic
        this.trail.push({ x: this.currentX, y: this.y });
        if (this.trail.length > 10) this.trail.shift();
    }

    emitParticles(count = 5) {
        const scale = CONFIG.CAMERA_FOV / (CONFIG.CAMERA_FOV + 10);
        const screenX = this.game.canvas.width / 2 + this.currentX * scale;
        const screenY = this.game.canvas.height * CONFIG.GROUND_Y + this.y;
        this.game.particles.emit(screenX, screenY, CONFIG.COLORS.NEON_BLUE, count);
    }

    updatePosition() {
        // Handle window resizing if needed
    }

    draw(ctx, canvas) {
        const horizon = canvas.height * CONFIG.HORIZON_Y;
        const ground = canvas.height * CONFIG.GROUND_Y;
        
        const scale = CONFIG.CAMERA_FOV / (CONFIG.CAMERA_FOV + 10);
        const screenX = canvas.width / 2 + this.currentX * scale;
        const screenY = horizon + (ground - horizon) * scale + this.y;
        const playerScale = CONFIG.LANE_WIDTH / 200;
        const w = this.width * playerScale;
        const h = (this.isSliding ? this.height / 2 : this.height) * playerScale;

        // Draw Trail
        this.trail.forEach((pos, i) => {
            const alpha = i / this.trail.length * 0.3;
            ctx.fillStyle = CONFIG.COLORS.NEON_BLUE;
            ctx.globalAlpha = alpha;
            const tx = canvas.width / 2 + pos.x * scale;
            const ty = horizon + (ground - horizon) * scale + pos.y;
            ctx.fillRect(tx - w / 2, ty - h, w, h);
        });
        ctx.globalAlpha = 1.0;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(screenX, ground, w / 2, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = CONFIG.COLORS.NEON_BLUE;

        ctx.fillStyle = CONFIG.COLORS.NEON_BLUE;
        ctx.fillRect(screenX - w / 2, screenY - h, w, h);

        // "Head" / visor
        ctx.fillStyle = 'white';
        ctx.fillRect(screenX - w / 2 + 5, screenY - h + 5, w - 10, 15);

        ctx.shadowBlur = 0;
    }
}

class Obstacle {
    constructor(lane, type, z) {
        this.lane = lane;
        this.type = type;
        this.z = z;
        this.size = 60;
    }

    update(dt, speed) {
        this.z -= speed * (dt / 16) * 10;
    }

    draw(ctx, canvas) {
        if (this.z <= 0) return;

        const horizon = canvas.height * CONFIG.HORIZON_Y;
        const ground = canvas.height * CONFIG.GROUND_Y;
        
        const scale = CONFIG.CAMERA_FOV / (CONFIG.CAMERA_FOV + this.z);
        const x = (this.lane - 1) * CONFIG.LANE_WIDTH * scale;
        const screenX = canvas.width / 2 + x;
        const screenY = horizon + (ground - horizon) * scale;
        
        const s = (this.size * (CONFIG.LANE_WIDTH / 200)) * scale;
        const opacity = Math.min(1, (CONFIG.SPAWN_DIST - this.z) / 1000); 

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(screenX, screenY);

        if (this.type === 'COIN') {
            ctx.fillStyle = CONFIG.COLORS.CYBER_YELLOW;
            ctx.shadowBlur = 10 * scale;
            ctx.shadowColor = CONFIG.COLORS.CYBER_YELLOW;
            ctx.beginPath();
            ctx.arc(0, -30 * scale, 15 * scale, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'BLOCK') {
            ctx.fillStyle = CONFIG.COLORS.NEON_PINK;
            ctx.shadowBlur = 20 * scale;
            ctx.shadowColor = CONFIG.COLORS.NEON_PINK;
            ctx.fillRect(-s, -s * 2, s * 2, s * 2);

            // Add grid pattern
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(-s, -s * 2, s * 2, s * 2);
            for (let i = 1; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(-s + (s * 2 / 4) * i, -s * 2);
                ctx.lineTo(-s + (s * 2 / 4) * i, 0);
                ctx.stroke();
            }
        } else if (this.type === 'HURDLE') {
            ctx.fillStyle = CONFIG.COLORS.NEON_GREEN;
            ctx.shadowBlur = 15 * scale;
            ctx.shadowColor = CONFIG.COLORS.NEON_GREEN;
            ctx.fillRect(-s, -s / 2, s * 2, s / 2);
            // Border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2 * scale;
            ctx.strokeRect(-s, -s / 2, s * 2, s / 2);
        } else if (this.type === 'PIPE') {
            ctx.fillStyle = CONFIG.COLORS.NEON_BLUE;
            ctx.shadowBlur = 15 * scale;
            ctx.shadowColor = CONFIG.COLORS.NEON_BLUE;
            ctx.fillRect(-s, -s * 2.5, s * 2, s / 2);
            // Draw supports
            ctx.fillRect(-s, -s * 2.5, 5, s * 2.5);
            ctx.fillRect(s - 5, -s * 2.5, 5, s * 2.5);
        }

        ctx.restore();
    }
}

class Background {
    constructor(game) {
        this.game = game;
        this.offset = 0;
        this.gridSize = 100;
    }

    update(dt) {
        this.offset = (this.offset + this.game.speed * (dt / 16)) % this.gridSize;
    }

    draw(ctx) {
        const canvas = this.game.canvas;
        const horizon = canvas.height * CONFIG.HORIZON_Y;
        const ground = canvas.height * CONFIG.GROUND_Y;

        // Draw sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGrad.addColorStop(0, '#020208');
        skyGrad.addColorStop(1, '#0a0a25');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, canvas.width, horizon);

        // Draw distant city silhouettes
        ctx.fillStyle = '#050510';
        for (let i = 0; i < 10; i++) {
            const bx = (i * 200 + this.offset * 0.1) % canvas.width;
            ctx.fillRect(bx, horizon - 50, 40, 50);
            ctx.fillRect(bx + 60, horizon - 80, 30, 80);
        }

        // Draw Perspective Tracks
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
        ctx.lineWidth = 2;

        for (let i = -2; i <= 2; i++) {
            const x1 = canvas.width / 2 + i * CONFIG.LANE_WIDTH * 1.5; // Wider at bottom
            const x2 = canvas.width / 2; // Exact vanishing point
            ctx.beginPath();
            ctx.moveTo(x1, canvas.height);
            ctx.lineTo(x2, horizon);
            ctx.stroke();
        }

        // Horizon Fog / Gradient
        const horizonGrad = ctx.createLinearGradient(0, horizon - 50, 0, horizon + 50);
        horizonGrad.addColorStop(0, '#020208');
        horizonGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.2)');
        horizonGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = horizonGrad;
        ctx.fillRect(0, horizon - 50, canvas.width, 100);

        // Horizontal Grid lines (Moving)
        for (let z = 0; z < CONFIG.SPAWN_DIST; z += this.gridSize) {
            const posZ = (z - this.offset * 10) % CONFIG.SPAWN_DIST;
            if (posZ < 0) continue;

            const scale = CONFIG.CAMERA_FOV / (CONFIG.CAMERA_FOV + posZ);
            const y = horizon + (ground - horizon) * scale;
            const w = canvas.width * scale;

            ctx.strokeStyle = `rgba(188, 19, 254, ${0.1 * (1 - posZ / CONFIG.SPAWN_DIST)})`;
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2 - w / 2, y);
            ctx.lineTo(canvas.width / 2 + w / 2, y);
            ctx.stroke();

            // Scanning Line
            if (Math.abs(posZ - (this.offset * 5 % CONFIG.SPAWN_DIST)) < 20) {
                ctx.strokeStyle = `rgba(0, 229, 255, ${0.5 * (1 - posZ / CONFIG.SPAWN_DIST)})`;
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.lineWidth = 2;
            }
        }

        // Draw Side Walls (Neon Pillars)
        for (let i = -1; i <= 1; i += 2) {
            for (let z = 0; z < CONFIG.SPAWN_DIST; z += 400) {
                const posZ = (z - this.offset * 10) % CONFIG.SPAWN_DIST;
                if (posZ < 0) continue;
                const scale = CONFIG.CAMERA_FOV / (CONFIG.CAMERA_FOV + posZ);
                const x = canvas.width / 2 + i * CONFIG.LANE_WIDTH * 2.5 * scale;
                const y = horizon + (ground - horizon) * scale;
                const h = 400 * scale;

                ctx.strokeStyle = CONFIG.COLORS.NEON_BLUE;
                ctx.globalAlpha = 0.3 * (1 - posZ / CONFIG.SPAWN_DIST);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y - h);
                ctx.stroke();

                // Neon cap
                ctx.fillStyle = CONFIG.COLORS.NEON_PINK;
                ctx.fillRect(x - 2, y - h - 5, 4, 10);
            }
        }
        ctx.globalAlpha = 1.0;
    }
}

// Start Engine
window.onload = () => {
    window.CyberGame = new Game();
};
