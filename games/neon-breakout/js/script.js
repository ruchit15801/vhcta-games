const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen    = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn       = document.getElementById('startBtn');
const restartBtn     = document.getElementById('restartBtn');
const scoreDisplay   = document.getElementById('scoreDisplay');
const levelDisplay   = document.getElementById('levelDisplay');
const livesDisplay   = document.getElementById('livesDisplay');
const finalScore     = document.getElementById('finalScore');
const finalLevel     = document.getElementById('finalLevel');
const resultTitle    = document.getElementById('resultTitle');

// ── Sizing ──────────────────────────────────────────────────
function resize() {
    const w = Math.min(window.innerWidth, 500);
    const h = Math.min(window.innerHeight, 750);
    canvas.width  = w;
    canvas.height = h;
}
window.addEventListener('resize', () => { resize(); if (gameState === 'PLAYING') rebuildLevel(); });
resize();

// ── State ───────────────────────────────────────────────────
let gameState = 'START';
let score = 0, level = 1, lives = 3;
let animationId;
let bricksRemaining = 0;

// ── Palette – 8 neon brick colors cycling by row ────────────
const BRICK_COLORS = [
    '#ff003c', '#ff7700', '#fff200', '#00ff88',
    '#00f3ff', '#0044ff', '#9d00ff', '#ff00ea'
];
const POWERUP_COLORS = { wide: '#00ff88', multi: '#fff200', fast: '#ff003c' };

// ── Paddle ──────────────────────────────────────────────────
const paddle = {
    x: 0, y: 0,
    w: 0, h: 12, r: 6,
    speed: 0, targetX: 0,

    reset() {
        this.w = canvas.width * 0.22;
        this.x = canvas.width  / 2 - this.w / 2;
        this.y = canvas.height - 40;
        this.targetX = this.x + this.w / 2;
    },

    moveTo(mx) {
        this.targetX = mx;
    },

    update() {
        const cx = this.x + this.w / 2;
        this.x += (this.targetX - cx) * 0.18;
        this.x = Math.max(0, Math.min(canvas.width - this.w, this.x));
    },

    draw() {
        ctx.save();
        ctx.fillStyle = '#9d00ff'; ctx.shadowBlur = 15; ctx.shadowColor = '#9d00ff';
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.w, this.h, this.r);
        ctx.fill();
        // Glint
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.shadowBlur = 0;
        ctx.fillRect(this.x + 8, this.y + 2, this.w * 0.4, 3);
        ctx.restore();
    }
};

// ── Ball ────────────────────────────────────────────────────
class Ball {
    constructor(x, y, vx, vy) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.r = 8;
        this.trail = [];
    }

    update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 10) this.trail.shift();

        this.x += this.vx;
        this.y += this.vy;

        // Wall bounces
        if (this.x - this.r < 0)              { this.x = this.r;              this.vx = Math.abs(this.vx); }
        if (this.x + this.r > canvas.width)   { this.x = canvas.width - this.r; this.vx = -Math.abs(this.vx); }
        if (this.y - this.r < 55)             { this.y = 55 + this.r;         this.vy = Math.abs(this.vy); }

        // Paddle bounce
        if (this.vy > 0 &&
            this.y + this.r >= paddle.y &&
            this.y + this.r <= paddle.y + paddle.h + 4 &&
            this.x >= paddle.x - 2 &&
            this.x <= paddle.x + paddle.w + 2) {

            const hitPos = (this.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
            const maxAngle = Math.PI / 3;
            const angle = hitPos * maxAngle;
            const speed = Math.hypot(this.vx, this.vy);
            this.vx = Math.sin(angle) * speed;
            this.vy = -Math.abs(Math.cos(angle) * speed);
            this.y = paddle.y - this.r;
            spawnParticles(this.x, this.y, '#9d00ff', 5);
        }
    }

    draw() {
        // Trail
        this.trail.forEach((t, i) => {
            ctx.save();
            ctx.globalAlpha = (i / this.trail.length) * 0.5;
            ctx.fillStyle = '#00f3ff';
            ctx.beginPath(); ctx.arc(t.x, t.y, this.r * 0.5 * (i / this.trail.length), 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });
        // Ball
        ctx.save();
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 18; ctx.shadowColor = '#00f3ff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    get lost() { return this.y - this.r > canvas.height; }
}

// ── Bricks ──────────────────────────────────────────────────
class Brick {
    constructor(x, y, w, h, color, hp) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.color = color; this.hp = hp; this.maxHp = hp;
        this.alive = true;
        this.shake = 0;
        this.hasPowerup = Math.random() < 0.12;
        this.powerupType = ['wide','multi','fast'][Math.floor(Math.random() * 3)];
    }

    hit() {
        this.hp--;
        this.shake = 5;
        if (this.hp <= 0) {
            this.alive = false;
            bricksRemaining--;
            spawnParticles(this.x + this.w/2, this.y + this.h/2, this.color, 14);
            if (this.hasPowerup) powerups.push(new Powerup(this.x + this.w/2, this.y, this.powerupType));
        } else {
            spawnParticles(this.x + this.w/2, this.y + this.h/2, this.color, 4);
        }
    }

    draw() {
        if (!this.alive) return;
        const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
        const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
        this.shake *= 0.6;

        // Damage overlay
        const dmgAlpha = 1 - (this.hp / this.maxHp) * 0.7;

        ctx.save();
        ctx.translate(this.x + sx, this.y + sy);

        // Shadow block (3D effect)
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(3, 3, this.w, this.h);

        // Main face
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 8; ctx.shadowColor = this.color;
        ctx.fillRect(0, 0, this.w, this.h);

        // Damage cracks overlay
        if (this.hp < this.maxHp) {
            ctx.fillStyle = `rgba(0,0,0,${dmgAlpha})`;
            ctx.fillRect(0, 0, this.w, this.h);
        }

        // Glint
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.shadowBlur = 0;
        ctx.fillRect(3, 2, this.w * 0.5, 3);

        // Powerup indicator
        if (this.hasPowerup) {
            ctx.fillStyle = POWERUP_COLORS[this.powerupType];
            ctx.shadowBlur = 5; ctx.shadowColor = POWERUP_COLORS[this.powerupType];
            ctx.beginPath(); ctx.arc(this.w/2, this.h/2, 4, 0, Math.PI*2); ctx.fill();
        }

        // HP pips for multi-HP bricks
        if (this.maxHp > 1) {
            for (let i = 0; i < this.hp; i++) {
                ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
                ctx.fillRect(this.w - 8 - i * 6, this.h - 6, 4, 4);
            }
        }

        ctx.restore();
    }

    // Check ball collision, returns true if hit
    checkBall(ball) {
        if (!this.alive) return false;
        const nearX = Math.max(this.x, Math.min(ball.x, this.x + this.w));
        const nearY = Math.max(this.y, Math.min(ball.y, this.y + this.h));
        const dist = Math.hypot(ball.x - nearX, ball.y - nearY);
        if (dist < ball.r) {
            // Determine reflection axis
            const overlapL = Math.abs(ball.x - this.x);
            const overlapR = Math.abs(ball.x - (this.x + this.w));
            const overlapT = Math.abs(ball.y - this.y);
            const overlapB = Math.abs(ball.y - (this.y + this.h));
            const minH = Math.min(overlapL, overlapR);
            const minV = Math.min(overlapT, overlapB);

            if (minH < minV) ball.vx *= -1;
            else             ball.vy *= -1;

            this.hit();
            return true;
        }
        return false;
    }
}

// ── Powerups ────────────────────────────────────────────────
let powerups = [];
class Powerup {
    constructor(x, y, type) {
        this.x = x; this.y = y;
        this.type = type;
        this.vy = 2; this.r = 10;
        this.active = true;
        this.color = POWERUP_COLORS[type];
        this.pulse = Math.random() * Math.PI * 2;
    }
    update() {
        this.y += this.vy; this.pulse += 0.08;
        if (this.y - this.r > canvas.height) this.active = false;
        // Paddle catch
        if (this.y + this.r >= paddle.y && this.y - this.r <= paddle.y + paddle.h &&
            this.x >= paddle.x && this.x <= paddle.x + paddle.w) {
            this.active = false;
            applyPowerup(this.type);
        }
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 12 + 4 * Math.sin(this.pulse); ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
        ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const icons = { wide: 'W', multi: 'M', fast: 'F' };
        ctx.fillText(icons[this.type], this.x, this.y);
        ctx.restore();
    }
}

let activePowerups = {};
function applyPowerup(type) {
    clearTimeout(activePowerups[type]);
    if (type === 'wide') {
        paddle.w = Math.min(canvas.width * 0.4, paddle.w * 1.6);
        activePowerups.wide = setTimeout(() => {
            paddle.w = canvas.width * 0.22;
        }, 8000);
    } else if (type === 'multi') {
        // Add 2 extra balls
        const b = balls[0] || { x: paddle.x + paddle.w/2, y: paddle.y - 20, vx: 4, vy: -5 };
        for (let i = 0; i < 2; i++) {
            const angle = (Math.random() - 0.5) * Math.PI / 3;
            const spd = Math.hypot(b.vx, b.vy);
            balls.push(new Ball(b.x, b.y,
                Math.sin(angle) * spd,
                -Math.abs(Math.cos(angle) * spd)
            ));
        }
    } else if (type === 'fast') {
        // Slow ball (counter-intuitively the best powerup)
        balls.forEach(b => { b.vx *= 0.7; b.vy *= 0.7; });
        activePowerups.fast = setTimeout(() => {
            balls.forEach(b => { b.vx /= 0.7; b.vy /= 0.7; });
        }, 5000);
    }
}

// ── Particles ────────────────────────────────────────────────
let particles = [];
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        const a = Math.random() * Math.PI * 2, s = Math.random() * 6 + 2;
        this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
        this.life = 1; this.decay = Math.random() * 0.04 + 0.02;
        this.color = color; this.size = Math.random() * 3 + 1;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.1; this.life -= this.decay; }
    draw() {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color; ctx.shadowBlur = 6; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}
function spawnParticles(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) particles.push(new Particle(x, y, color));
}

// ── Level layouts ────────────────────────────────────────────
let bricks = [], balls = [];

function rebuildLevel() {
    bricks = [];
    const margin = 12, cols = 9, rows = Math.min(4 + level, 11);
    const bw = (canvas.width - margin * (cols + 1)) / cols;
    const bh = 18;
    const startY = 70;
    bricksRemaining = 0;

    for (let r = 0; r < rows; r++) {
        const color = BRICK_COLORS[(r + level) % BRICK_COLORS.length];
        const hp = r < 2 ? 1 : r < 5 ? 2 : 3;
        for (let c = 0; c < cols; c++) {
            if (level > 3 && Math.random() < 0.08) continue; // occasional gaps at high levels
            const x = margin + c * (bw + margin);
            const y = startY + r * (bh + 6);
            bricks.push(new Brick(x, y, bw, bh, color, hp));
            bricksRemaining++;
        }
    }
}

function launchBall() {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 4);
    const speed = 6 + level * 0.4;
    balls.push(new Ball(
        paddle.x + paddle.w / 2,
        paddle.y - 12,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
    ));
}

// ── HUD updates ──────────────────────────────────────────────
function updateHUD() {
    scoreDisplay.textContent = `SCORE: ${score}`;
    levelDisplay.textContent = `LEVEL: ${level}`;
    livesDisplay.textContent = '❤️'.repeat(lives);
}

// ── Draw ─────────────────────────────────────────────────────
function drawBackground() {
    ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(157,0,255,0.05)'; ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    // Ceiling line
    ctx.strokeStyle = 'rgba(157,0,255,0.5)'; ctx.lineWidth = 3;
    ctx.shadowBlur = 8; ctx.shadowColor = '#9d00ff';
    ctx.beginPath(); ctx.moveTo(0, 52); ctx.lineTo(canvas.width, 52); ctx.stroke();
    ctx.shadowBlur = 0;
}

// ── Game Loop ────────────────────────────────────────────────
function gameLoop() {
    if (gameState !== 'PLAYING') return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    // Bricks
    bricks.forEach(b => b.draw());

    // Powerups
    powerups = powerups.filter(p => p.active);
    powerups.forEach(p => { p.update(); p.draw(); });

    // Paddle
    paddle.update(); paddle.draw();

    // Balls
    for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        b.update();

        // Brick collisions
        for (const brick of bricks) {
            brick.checkBall(b);
        }

        b.draw();

        // Ball lost
        if (b.lost) {
            balls.splice(i, 1);
            if (balls.length === 0) {
                lives--;
                updateHUD();
                if (lives <= 0) {
                    gameOver(false);
                    return;
                }
                // Respawn
                setTimeout(() => { if (gameState === 'PLAYING') launchBall(); }, 800);
            }
        }
    }

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.update(); p.draw(); });

    // Level complete?
    if (bricksRemaining <= 0) {
        score += level * 500;
        level++;
        if (level > 10) { gameOver(true); return; }
        updateHUD();
        rebuildLevel();
        balls = [];
        powerups = [];
        setTimeout(() => { if (gameState === 'PLAYING') launchBall(); }, 600);
    }

    animationId = requestAnimationFrame(gameLoop);
}

function gameOver(win) {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationId);
    resultTitle.textContent = win ? '🏆 YOU WIN!' : 'GAME OVER';
    finalScore.textContent  = score;
    finalLevel.textContent  = level;
    setTimeout(() => { gameOverScreen.classList.add('active'); }, 500);
}

// ── Input ────────────────────────────────────────────────────
function moveFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const src = e.touches ? e.touches[0] : e;
    paddle.moveTo((src.clientX - rect.left) * scaleX);
}

canvas.addEventListener('mousemove', moveFromEvent);
canvas.addEventListener('touchmove', e => { e.preventDefault(); moveFromEvent(e); }, { passive: false });

// ── Init ─────────────────────────────────────────────────────
function init() {
    score = 0; level = 1; lives = 3;
    activePowerups = {};
    particles = []; powerups = []; balls = [];
    paddle.reset();
    rebuildLevel();
    updateHUD();
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    cancelAnimationFrame(animationId);
    launchBall();
    gameLoop();
}

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Boot
drawBackground();
