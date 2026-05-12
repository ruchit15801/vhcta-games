const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen    = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn       = document.getElementById('startBtn');
const restartBtn     = document.getElementById('restartBtn');
const scoreDisplay   = document.getElementById('scoreDisplay');
const coinDisplay    = document.getElementById('coinDisplay');
const finalDist      = document.getElementById('finalDist');
const finalCoins     = document.getElementById('finalCoins');

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// ── Colors ─────────────────────────────────────────────────
const C_ROBOT   = '#9d00ff';
const C_EYE     = '#00f3ff';
const C_GROUND  = '#1a1a2e';
const C_HAZARD  = '#ff003c';
const C_COIN    = '#fff200';
const C_PLATFORM = '#2a0044';
const C_SKY1    = '#050008';
const C_SKY2    = '#0a001a';

// ── State ──────────────────────────────────────────────────
let gameState = 'START';
let distance  = 0, coins = 0;
let worldSpeed = 7;
let animationId;
let frameCount = 0;

// ── Ground ─────────────────────────────────────────────────
const GROUND_H = () => canvas.height * 0.12;
const FLOOR_Y  = () => canvas.height - GROUND_H();

// ── Robot ──────────────────────────────────────────────────
const robot = {
    x: 0, y: 0,
    w: 36, h: 52,
    vy: 0,
    jumpsLeft: 2,
    onGround: false,
    runFrame: 0,
    dead: false,

    gravity: 0.65,
    jumpStr: -16,

    reset() {
        this.x = canvas.width * 0.18;
        this.y = FLOOR_Y() - this.h;
        this.vy = 0;
        this.jumpsLeft = 2;
        this.onGround = false;
        this.runFrame = 0;
        this.dead = false;
    },

    jump() {
        if (this.dead) return;
        if (this.jumpsLeft > 0) {
            this.vy = this.jumpStr;
            this.jumpsLeft--;
            spawnParticles(this.x + this.w/2, this.y + this.h, C_ROBOT, 8);
        }
    },

    update() {
        if (this.dead) return;
        this.vy += this.gravity;
        this.y  += this.vy;
        this.runFrame += 0.25;

        // Land on ground
        const gy = FLOOR_Y() - this.h;
        if (this.y >= gy) {
            this.y = gy;
            this.vy = 0;
            this.jumpsLeft = 2;
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        // Platform landing
        platforms.forEach(p => {
            if (this.vy >= 0 && this.y + this.h >= p.y && this.y + this.h <= p.y + 14 &&
                this.x + this.w > p.x && this.x < p.x + p.w) {
                this.y = p.y - this.h;
                this.vy = 0;
                this.jumpsLeft = 2;
                this.onGround = true;
            }
        });
    },

    draw() {
        if (this.dead) return;
        const t = this.runFrame;
        const legSwing = this.onGround ? Math.sin(t) * 8 : 0;

        ctx.save();
        ctx.translate(this.x + this.w/2, this.y);
        ctx.shadowBlur = 12; ctx.shadowColor = C_ROBOT;

        const hw = this.w / 2;

        // Legs (running)
        ctx.strokeStyle = C_ROBOT; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-hw * 0.4, this.h * 0.65); ctx.lineTo(-hw * 0.4 + legSwing, this.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( hw * 0.4, this.h * 0.65); ctx.lineTo( hw * 0.4 - legSwing, this.h); ctx.stroke();
        // Feet
        ctx.fillStyle = C_ROBOT;
        ctx.fillRect(-hw * 0.4 + legSwing - 8, this.h - 8, 16, 8);
        ctx.fillRect( hw * 0.4 - legSwing - 8, this.h - 8, 16, 8);

        // Body
        ctx.fillStyle = '#1a0030';
        ctx.strokeStyle = C_ROBOT; ctx.lineWidth = 3;
        ctx.fillRect(-hw, this.h * 0.28, this.w, this.h * 0.4);
        ctx.strokeRect(-hw, this.h * 0.28, this.w, this.h * 0.4);

        // Chest gem
        ctx.fillStyle = C_EYE; ctx.shadowColor = C_EYE; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, this.h * 0.48, 6, 0, Math.PI * 2); ctx.fill();

        // Arms (swinging)
        const armSwing = this.onGround ? Math.sin(t + Math.PI) * 12 : 0;
        ctx.strokeStyle = C_ROBOT; ctx.lineWidth = 7; ctx.shadowColor = C_ROBOT; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(-hw, this.h * 0.33); ctx.lineTo(-hw - 10, this.h * 0.33 + armSwing); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( hw, this.h * 0.33); ctx.lineTo( hw + 10, this.h * 0.33 - armSwing); ctx.stroke();

        // Head
        ctx.fillStyle = '#1a0030'; ctx.strokeStyle = C_ROBOT; ctx.lineWidth = 3;
        ctx.fillRect(-hw, 0, this.w, this.h * 0.3);
        ctx.strokeRect(-hw, 0, this.w, this.h * 0.3);

        // Eyes
        ctx.fillStyle = C_EYE; ctx.shadowColor = C_EYE; ctx.shadowBlur = 15;
        ctx.fillRect(-hw * 0.65, this.h * 0.06, hw * 0.5, this.h * 0.1);
        ctx.fillRect( hw * 0.15, this.h * 0.06, hw * 0.5, this.h * 0.1);

        // Antenna
        ctx.strokeStyle = C_ROBOT; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -14); ctx.stroke();
        ctx.fillStyle = C_EYE; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(0, -18, 4, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
};

// ── Obstacles ──────────────────────────────────────────────
let obstacles = [], platforms = [], coinList = [];

class Spike {
    constructor(x) {
        this.x = x; this.y = FLOOR_Y();
        this.w = 28; this.h = 32;
        this.type = 'spike';
    }
    update() { this.x -= worldSpeed; }
    draw() {
        ctx.save(); ctx.fillStyle = C_HAZARD; ctx.shadowBlur = 10; ctx.shadowColor = C_HAZARD;
        const n = 3, sw = this.w / n;
        for (let i = 0; i < n; i++) {
            ctx.beginPath();
            ctx.moveTo(this.x + i * sw, this.y);
            ctx.lineTo(this.x + i * sw + sw / 2, this.y - this.h);
            ctx.lineTo(this.x + i * sw + sw, this.y);
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }
    get bounds() { return { x: this.x + 4, y: this.y - this.h + 8, w: this.w - 8, h: this.h - 8 }; }
}

class WallBarrier {
    constructor(x) {
        this.x = x; this.y = FLOOR_Y() - 80;
        this.w = 22; this.h = 80;
    }
    update() { this.x -= worldSpeed; }
    draw() {
        ctx.save();
        ctx.fillStyle = 'rgba(255,0,60,0.2)'; ctx.strokeStyle = C_HAZARD; ctx.lineWidth = 3;
        ctx.shadowBlur = 10; ctx.shadowColor = C_HAZARD;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeRect(this.x, this.y, this.w, this.h);
        // Danger stripes
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i % 2 === 0 ? 'rgba(255,0,60,0.6)' : 'rgba(255,255,255,0.15)';
            ctx.fillRect(this.x, this.y + i * 20, this.w, 20);
        }
        ctx.restore();
    }
    get bounds() { return { x: this.x + 2, y: this.y, w: this.w - 4, h: this.h }; }
}

class Platform {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 90 + Math.random() * 60; this.h = 14;
    }
    update() { this.x -= worldSpeed; }
    draw() {
        ctx.save();
        ctx.fillStyle = C_PLATFORM; ctx.strokeStyle = C_ROBOT; ctx.lineWidth = 2;
        ctx.shadowBlur = 8; ctx.shadowColor = C_ROBOT;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeRect(this.x, this.y, this.w, this.h);
        ctx.restore();
    }
}

class Coin {
    constructor(x, y) {
        this.x = x; this.y = y; this.r = 10; this.pulse = Math.random() * Math.PI * 2; this.active = true;
    }
    update() { this.x -= worldSpeed; this.pulse += 0.1; }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.fillStyle = C_COIN; ctx.shadowBlur = 10 + 4 * Math.sin(this.pulse); ctx.shadowColor = C_COIN;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
        ctx.font = `bold ${this.r}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚡', this.x, this.y);
        ctx.restore();
    }
}

// ── Particles ──────────────────────────────────────────────
let particles = [];
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        const a = Math.random() * Math.PI * 2, s = Math.random() * 6 + 2;
        this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
        this.life = 1; this.decay = Math.random() * 0.04 + 0.02;
        this.color = color; this.size = Math.random() * 4 + 2;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.2; this.life -= this.decay; }
    draw() {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color; ctx.shadowBlur = 6; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}
function spawnParticles(x, y, color, n = 12) {
    for (let i = 0; i < n; i++) particles.push(new Particle(x, y, color));
}

// ── Background ─────────────────────────────────────────────
let stars = [];
let bgX = 0;
function initStars() {
    stars = Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * FLOOR_Y(),
        r: Math.random() * 1.5 + 0.5, speed: Math.random() * 1 + 0.2
    }));
}

function drawBackground() {
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y());
    sky.addColorStop(0, C_SKY1); sky.addColorStop(1, C_SKY2);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, FLOOR_Y());

    // Stars parallax
    stars.forEach(s => {
        s.x -= s.speed;
        if (s.x < 0) { s.x = canvas.width; s.y = Math.random() * FLOOR_Y(); }
        ctx.fillStyle = `rgba(255,255,255,${0.4 + s.r * 0.2})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });

    // City silhouette (scrolling)
    ctx.fillStyle = '#0a0015';
    bgX -= worldSpeed * 0.15;
    if (bgX < -canvas.width) bgX += canvas.width;
    for (let xi = bgX; xi < canvas.width + 200; xi += 200) {
        const bw = 40 + (xi % 7) * 15;
        const bh = 60 + (xi % 11) * 18;
        ctx.fillRect(xi, FLOOR_Y() - bh, bw, bh);
        // Windows
        ctx.fillStyle = 'rgba(157,0,255,0.3)';
        for (let wy = FLOOR_Y() - bh + 10; wy < FLOOR_Y() - 10; wy += 14) {
            for (let wx = xi + 6; wx < xi + bw - 6; wx += 10) {
                if ((wx + wy) % 30 < 15) ctx.fillRect(wx, wy, 5, 6);
            }
        }
        ctx.fillStyle = '#0a0015';
    }

    // Ground
    ctx.fillStyle = C_GROUND;
    ctx.fillRect(0, FLOOR_Y(), canvas.width, GROUND_H());
    ctx.strokeStyle = C_ROBOT; ctx.lineWidth = 2;
    ctx.shadowBlur = 8; ctx.shadowColor = C_ROBOT;
    ctx.beginPath(); ctx.moveTo(0, FLOOR_Y()); ctx.lineTo(canvas.width, FLOOR_Y()); ctx.stroke();
    ctx.shadowBlur = 0;
}

// ── AABB Collision ─────────────────────────────────────────
function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ── Spawner ────────────────────────────────────────────────
let spawnTimer = 0, gapTimer = 0;

function spawnNext() {
    const x = canvas.width + 60;
    const r = Math.random();
    if (r < 0.35) {
        obstacles.push(new Spike(x));
    } else if (r < 0.55) {
        obstacles.push(new WallBarrier(x));
    } else {
        // Floating platform + coins
        const py = FLOOR_Y() - 80 - Math.random() * 120;
        const p = new Platform(x, py);
        platforms.push(p);
        for (let c = 0; c < 4; c++) coinList.push(new Coin(x + p.w * (c / 4) + 12, py - 25));
    }
    // Occasional floor coin
    if (Math.random() < 0.3) coinList.push(new Coin(x + 60, FLOOR_Y() - 20));
}

// ── Game Loop ──────────────────────────────────────────────
function update() {
    if (gameState !== 'PLAYING') return;
    frameCount++;

    // Speed ramp
    worldSpeed = 7 + frameCount / 600;
    if (frameCount % 30 === 0) {
        distance++;
        scoreDisplay.textContent = `DIST: ${distance}M`;
    }

    // Spawn
    spawnTimer++;
    const spawnRate = Math.max(50, 120 - frameCount / 30);
    if (spawnTimer > spawnRate) { spawnTimer = 0; spawnNext(); }

    robot.update();

    const rb = { x: robot.x + 5, y: robot.y + 4, w: robot.w - 10, h: robot.h - 4 };

    // Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i]; o.update();
        if (o.x + (o.w || 30) < -50) { obstacles.splice(i, 1); continue; }
        const ob = o.bounds;
        if (overlap(rb.x, rb.y, rb.w, rb.h, ob.x, ob.y, ob.w, ob.h)) { die(); return; }
    }

    // Platforms
    for (let i = platforms.length - 1; i >= 0; i--) {
        platforms[i].update();
        if (platforms[i].x + platforms[i].w < -50) platforms.splice(i, 1);
    }

    // Coins
    for (let i = coinList.length - 1; i >= 0; i--) {
        const c = coinList[i]; c.update();
        if (c.x < -20) { coinList.splice(i, 1); continue; }
        if (c.active && overlap(rb.x, rb.y, rb.w, rb.h, c.x - c.r, c.y - c.r, c.r * 2, c.r * 2)) {
            c.active = false;
            coins++;
            coinDisplay.textContent = `⚡ ${coins}`;
            spawnParticles(c.x, c.y, C_COIN, 8);
        }
    }

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => p.update());
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    platforms.forEach(p => p.draw());
    obstacles.forEach(o => o.draw());
    coinList.forEach(c => c.draw());
    particles.forEach(p => p.draw());
    robot.draw();
}

function die() {
    if (robot.dead) return;
    robot.dead = true;
    gameState = 'GAMEOVER';
    spawnParticles(robot.x + robot.w/2, robot.y + robot.h/2, C_ROBOT, 50);
    spawnParticles(robot.x + robot.w/2, robot.y + robot.h/2, C_HAZARD, 30);
    cancelAnimationFrame(animationId);

    let t = 0;
    function flush() {
        if (t++ > 50) {
            finalDist.textContent  = distance;
            finalCoins.textContent = coins;
            gameOverScreen.classList.add('active');
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground();
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(flush);
    }
    flush();
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    update(); draw();
    animationId = requestAnimationFrame(gameLoop);
}

function handleJump(e) {
    if (e.target.tagName === 'BUTTON') return;
    if (e.type === 'touchstart') e.preventDefault();
    if (gameState === 'START') { init(); return; }
    if (gameState === 'PLAYING') robot.jump();
    if (gameState === 'GAMEOVER' && gameOverScreen.classList.contains('active')) init();
}

window.addEventListener('mousedown', handleJump);
window.addEventListener('touchstart', handleJump, { passive: false });
window.addEventListener('keydown', e => { if (e.code === 'Space') handleJump(e); });

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

function init() {
    distance = 0; coins = 0; frameCount = 0; worldSpeed = 7;
    scoreDisplay.textContent = `DIST: 0M`;
    coinDisplay.textContent  = `⚡ 0`;
    obstacles = []; platforms = []; coinList = []; particles = [];
    spawnTimer = 0;
    robot.reset();
    initStars();
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    cancelAnimationFrame(animationId);
    gameLoop();
}

// Boot
initStars(); drawBackground();