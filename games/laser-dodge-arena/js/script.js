const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen    = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn       = document.getElementById('startBtn');
const restartBtn     = document.getElementById('restartBtn');
const scoreDisplay   = document.getElementById('scoreDisplay');
const waveDisplay    = document.getElementById('waveDisplay');
const finalTime      = document.getElementById('finalTime');
const finalWave      = document.getElementById('finalWave');

// ── Sizing ─────────────────────────────────────────────────
function resize() {
    const size = Math.min(window.innerWidth, window.innerHeight);
    canvas.width = size; canvas.height = size;
}
window.addEventListener('resize', () => { resize(); });
resize();

const CX = () => canvas.width  / 2;
const CY = () => canvas.height / 2;
const R  = () => canvas.width  * 0.46; // arena radius

// ── State ──────────────────────────────────────────────────
let gameState = 'START';
let survived = 0, wave = 1;
let animationId, lastTime = 0;
let frameCount = 0;

// ── Player ─────────────────────────────────────────────────
const player = {
    x: 0, y: 0, r: 12,
    trail: [],

    reset() { this.x = CX(); this.y = CY(); this.trail = []; },

    moveTo(mx, my) {
        const dx = mx - CX(), dy = my - CY();
        const dist = Math.hypot(dx, dy);
        const maxR = R() - this.r - 4;
        if (dist > maxR) {
            const a = Math.atan2(dy, dx);
            this.x = CX() + Math.cos(a) * maxR;
            this.y = CY() + Math.sin(a) * maxR;
        } else {
            this.x = mx; this.y = my;
        }
        this.trail.push({ x: this.x, y: this.y, life: 1 });
        if (this.trail.length > 15) this.trail.shift();
    },

    draw() {
        // Trail
        this.trail.forEach((t, i) => {
            ctx.save();
            ctx.globalAlpha = (i / this.trail.length) * 0.5;
            ctx.fillStyle = '#00f3ff';
            ctx.beginPath(); ctx.arc(t.x, t.y, this.r * (i / this.trail.length), 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });

        // Core
        ctx.save();
        ctx.fillStyle = '#00f3ff'; ctx.shadowBlur = 20; ctx.shadowColor = '#00f3ff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
        // Inner
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
};

// ── Laser types ────────────────────────────────────────────
// Each laser: { type: 'sweep'|'line'|'cross', phase, duration, warningDur, angle, ... }
let lasers = [];
let particles = [];

const WARN_COLOR  = 'rgba(255, 60, 0, 0.25)';
const LASER_COLOR = '#ff003c';

class SweepLaser {
    constructor(startAngle, clockwise, speed) {
        this.type = 'sweep';
        this.angle = startAngle;          // current angle (radians)
        this.clockwise = clockwise;
        this.speed = speed;               // radians per second
        this.width = Math.PI / 30;        // beam arc width
        this.phase = 'WARNING';           // WARNING → ACTIVE → DONE
        this.timer = 0;
        this.warnDur = 1.2;              // seconds
        this.activeDur = 2.0 + Math.random() * 1.5;
    }

    update(dt) {
        this.timer += dt;
        if (this.phase === 'WARNING' && this.timer > this.warnDur) {
            this.phase = 'ACTIVE';
            this.timer = 0;
        }
        if (this.phase === 'ACTIVE') {
            this.angle += this.speed * dt * (this.clockwise ? 1 : -1);
            if (this.timer > this.activeDur) this.phase = 'DONE';
        }
    }

    draw() {
        const cx = CX(), cy = CY(), r = R();
        ctx.save();
        if (this.phase === 'WARNING') {
            // show sweep arc outline
            ctx.strokeStyle = 'rgba(255, 60, 0, 0.4)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, this.angle - this.width, this.angle + this.width);
            ctx.closePath();
            ctx.stroke();
        } else if (this.phase === 'ACTIVE') {
            // Glow fill
            ctx.fillStyle = 'rgba(255, 0, 60, 0.18)';
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, this.angle - this.width, this.angle + this.width);
            ctx.closePath(); ctx.fill();

            // Bright edge lines
            ctx.strokeStyle = LASER_COLOR; ctx.lineWidth = 4;
            ctx.shadowBlur = 20; ctx.shadowColor = LASER_COLOR;
            [this.angle - this.width, this.angle + this.width].forEach(a => {
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
                ctx.stroke();
            });
        }
        ctx.restore();
    }

    hitsPlayer() {
        if (this.phase !== 'ACTIVE') return false;
        const dx = player.x - CX(), dy = player.y - CY();
        const pAngle = Math.atan2(dy, dx);
        // Normalise angle difference
        let diff = pAngle - this.angle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const inArc  = Math.abs(diff) < this.width + 0.05;
        const inDisk = Math.hypot(dx, dy) < R() - player.r;
        return inArc && inDisk;
    }
}

class CrossLaser {
    // 2 or 4 lines from center outward at fixed angles
    constructor(count) {
        this.type  = 'cross';
        this.count = count; // 2 or 4
        this.baseAngle = Math.random() * Math.PI;
        this.phase = 'WARNING';
        this.timer = 0;
        this.warnDur   = 1.5;
        this.activeDur = 0.8 + Math.random() * 0.5;
        this.flashFreq = 0.12;
    }

    update(dt) {
        this.timer += dt;
        if (this.phase === 'WARNING' && this.timer > this.warnDur) {
            this.phase = 'ACTIVE'; this.timer = 0;
        }
        if (this.phase === 'ACTIVE' && this.timer > this.activeDur) this.phase = 'DONE';
    }

    _angles() {
        const a = [];
        for (let i = 0; i < this.count; i++) a.push(this.baseAngle + (i / this.count) * Math.PI * 2);
        return a;
    }

    draw() {
        const cx = CX(), cy = CY(), r = R();
        ctx.save();
        const angles = this._angles();

        if (this.phase === 'WARNING') {
            ctx.strokeStyle = 'rgba(255, 60, 0, 0.5)'; ctx.lineWidth = 3;
            ctx.setLineDash([10, 10]);
            angles.forEach(a => {
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
                ctx.stroke();
            });
            ctx.setLineDash([]);
        } else if (this.phase === 'ACTIVE') {
            // Flash
            const flash = Math.sin(this.timer / this.flashFreq * Math.PI) > 0;
            if (flash) {
                ctx.strokeStyle = LASER_COLOR; ctx.lineWidth = 6;
                ctx.shadowBlur = 30; ctx.shadowColor = LASER_COLOR;
                angles.forEach(a => {
                    ctx.beginPath();
                    ctx.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
                    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
                    ctx.stroke();
                });
            }
        }
        ctx.restore();
    }

    hitsPlayer() {
        if (this.phase !== 'ACTIVE') return false;
        const cx = CX(), cy = CY();
        const dx = player.x - cx, dy = player.y - cy;
        const pr = player.r + 5;
        return this._angles().some(a => {
            // distance from point to line through center at angle a
            const nx = -Math.sin(a), ny = Math.cos(a);
            const dist = Math.abs(dx * nx + dy * ny);
            return dist < pr;
        });
    }
}

class WallLaser {
    // Horizontal or vertical beam from one wall to other
    constructor() {
        this.type = 'wall';
        this.isHoriz = Math.random() < 0.5;
        this.pos = CY() + (Math.random() - 0.5) * R() * 1.2;   // offset from center
        this.phase = 'WARNING';
        this.timer = 0;
        this.warnDur   = 1.0;
        this.activeDur = 0.6;
    }

    update(dt) {
        this.timer += dt;
        if (this.phase === 'WARNING' && this.timer > this.warnDur) { this.phase = 'ACTIVE'; this.timer = 0; }
        if (this.phase === 'ACTIVE'  && this.timer > this.activeDur) this.phase = 'DONE';
    }

    draw() {
        const cx = CX(), cy = CY(), r = R();
        ctx.save();
        const p = this.pos;

        if (this.phase === 'WARNING') {
            ctx.strokeStyle = 'rgba(255,60,0,0.5)'; ctx.lineWidth = 16;
            ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.timer * 8);
            ctx.beginPath();
            if (this.isHoriz) { ctx.moveTo(cx - r, p); ctx.lineTo(cx + r, p); }
            else               { ctx.moveTo(p, cy - r); ctx.lineTo(p, cy + r); }
            ctx.stroke();
        } else if (this.phase === 'ACTIVE') {
            // Blinding beam
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;
            ctx.shadowBlur = 40; ctx.shadowColor = LASER_COLOR;
            ctx.beginPath();
            if (this.isHoriz) { ctx.moveTo(cx - r, p); ctx.lineTo(cx + r, p); }
            else               { ctx.moveTo(p, cy - r); ctx.lineTo(p, cy + r); }
            ctx.stroke();
            ctx.strokeStyle = LASER_COLOR; ctx.lineWidth = 14; ctx.globalAlpha = 0.5;
            ctx.beginPath();
            if (this.isHoriz) { ctx.moveTo(cx - r, p); ctx.lineTo(cx + r, p); }
            else               { ctx.moveTo(p, cy - r); ctx.lineTo(p, cy + r); }
            ctx.stroke();
        }
        ctx.restore();
    }

    hitsPlayer() {
        if (this.phase !== 'ACTIVE') return false;
        const pr = player.r + 6;
        if (this.isHoriz) return Math.abs(player.y - this.pos) < pr;
        else               return Math.abs(player.x - this.pos) < pr;
    }
}

// ── Particles ──────────────────────────────────────────────
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        const a = Math.random() * Math.PI * 2, s = Math.random() * 8 + 2;
        this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
        this.life = 1; this.decay = Math.random() * 0.03 + 0.015;
        this.color = color; this.size = Math.random() * 4 + 2;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= this.decay; this.vx *= 0.92; this.vy *= 0.92; }
    draw() {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color; ctx.shadowBlur = 8; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}
function spawnParticles(x, y, color, n = 20) {
    for (let i = 0; i < n; i++) particles.push(new Particle(x, y, color));
}

// ── Draw arena ─────────────────────────────────────────────
function drawArena() {
    const cx = CX(), cy = CY(), r = R();

    ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Outer dark region
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Arena floor
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#07070f'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid floor
    ctx.strokeStyle = 'rgba(255,0,60,0.06)'; ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    ctx.restore();

    // Arena border ring
    ctx.strokeStyle = 'rgba(255,0,60,0.6)'; ctx.lineWidth = 4;
    ctx.shadowBlur = 20; ctx.shadowColor = '#ff003c';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    // Safe zone hint (pulsing center dot)
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500);
    ctx.strokeStyle = `rgba(0, 243, 255, ${pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
}

// ── Input ──────────────────────────────────────────────────
let mouseX = CX(), mouseY = CY();

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top)  * scaleY;
});
canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    mouseX = (e.touches[0].clientX - rect.left) * scaleX;
    mouseY = (e.touches[0].clientY - rect.top)  * scaleY;
}, { passive: false });
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    mouseX = (e.touches[0].clientX - rect.left) * scaleX;
    mouseY = (e.touches[0].clientY - rect.top)  * scaleY;
    if (gameState === 'START') init();
    else if (gameState === 'GAMEOVER') init();
}, { passive: false });

// ── Spawner ────────────────────────────────────────────────
let spawnTimer = 0;

function getSpawnRate() {
    return Math.max(1.0, 4.0 - wave * 0.3);
}

function spawnLaser() {
    const r = Math.random();
    const waveFactor = Math.min(wave, 6);

    if (r < 0.35) {
        lasers.push(new SweepLaser(
            Math.random() * Math.PI * 2,
            Math.random() < 0.5,
            0.6 + waveFactor * 0.1
        ));
    } else if (r < 0.65) {
        lasers.push(new CrossLaser(wave >= 4 ? 4 : 2));
    } else {
        lasers.push(new WallLaser());
        if (wave >= 3 && Math.random() < 0.5) lasers.push(new WallLaser()); // double wall
    }
}

// ── Game Loop ──────────────────────────────────────────────
function gameLoop(timestamp) {
    if (gameState !== 'PLAYING') return;

    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    frameCount++;

    survived += dt;
    if (Math.floor(survived) !== Math.floor(survived - dt)) {
        scoreDisplay.textContent = `SURVIVED: ${Math.floor(survived)}S`;
    }

    // Wave progression every 10s
    wave = 1 + Math.floor(survived / 10);
    waveDisplay.textContent = `WAVE: ${wave}`;

    // Spawn
    spawnTimer += dt;
    if (spawnTimer > getSpawnRate()) { spawnTimer = 0; spawnLaser(); }

    // Move player toward mouse smoothly
    player.moveTo(
        player.x + (mouseX - player.x) * 0.25,
        player.y + (mouseY - player.y) * 0.25
    );

    // Update lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
        lasers[i].update(dt);
        if (lasers[i].hitsPlayer()) { die(); return; }
        if (lasers[i].phase === 'DONE') lasers.splice(i, 1);
    }

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => p.update());

    // Draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawArena();
    lasers.forEach(l => l.draw());
    particles.forEach(p => p.draw());
    player.draw();

    animationId = requestAnimationFrame(gameLoop);
}

function die() {
    gameState = 'GAMEOVER';
    spawnParticles(player.x, player.y, '#00f3ff', 50);
    spawnParticles(player.x, player.y, '#ff003c', 30);
    cancelAnimationFrame(animationId);

    function flush() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawArena();
        particles.forEach(p => { p.update(); p.draw(); });
        if (particles.some(p => p.life > 0)) requestAnimationFrame(flush);
        else {
            finalTime.textContent = Math.floor(survived);
            finalWave.textContent = wave;
            gameOverScreen.classList.add('active');
        }
    }
    flush();
}

function init() {
    survived = 0; wave = 1; frameCount = 0;
    spawnTimer = 0; lasers = []; particles = [];
    player.reset();
    mouseX = CX(); mouseY = CY();
    scoreDisplay.textContent = `SURVIVED: 0S`;
    waveDisplay.textContent  = `WAVE: 1`;
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(gameLoop);
}

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);
canvas.addEventListener('click', () => {
    if (gameState === 'START') init();
    else if (gameState === 'GAMEOVER') init();
});

// Boot frame
drawArena();