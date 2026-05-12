const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen       = document.getElementById('startScreen');
const holeCompleteScreen = document.getElementById('holeCompleteScreen');
const gameOverScreen    = document.getElementById('gameOverScreen');
const startBtn          = document.getElementById('startBtn');
const nextHoleBtn       = document.getElementById('nextHoleBtn');
const restartBtn        = document.getElementById('restartBtn');
const holeDisplay       = document.getElementById('holeDisplay');
const parDisplay        = document.getElementById('parDisplay');
const strokeDisplay     = document.getElementById('strokeDisplay');
const holeTitle         = document.getElementById('holeTitle');
const holeMsg           = document.getElementById('holeMsg');
const totalShotsEl      = document.getElementById('totalShots');
const totalParEl        = document.getElementById('totalPar');
const scoreSummaryEl    = document.getElementById('scoreSummary');

// ── Sizing ──────────────────────────────────────────────────
function resize() {
    const size = Math.min(window.innerWidth, window.innerHeight, 700);
    canvas.width = size; canvas.height = size;
}
window.addEventListener('resize', () => { resize(); if (gameState === 'PLAYING') loadHole(currentHole); });
resize();

// ── State ───────────────────────────────────────────────────
let gameState = 'START';
let currentHole = 0;
let strokes = 0;
let totalStrokes = 0;
let animationId;

// ── Physics ─────────────────────────────────────────────────
const ball = {
    x: 0, y: 0, vx: 0, vy: 0,
    r: 9,
    moving: false,
    inHole: false,
    trail: []
};

const hole = { x: 0, y: 0, r: 13 };
let walls = [];     // [{x,y,w,h}]
let obstacles = []; // {x, y, r, vx, vy}  – moving circular bumpers

// ── 9 Hole Definitions  (all coordinates 0‒1, scaled at runtime) ──
const HOLES = [
    // 1 – straight shot
    { par: 2, ball: [0.5, 0.8], hole: [0.5, 0.12],
      walls: [[0.3,0.05,0.4,0.04],[0.3,0.91,0.4,0.04],[0.3,0.05,0.04,0.9],[0.66,0.05,0.04,0.9]],
      obs: [] },
    // 2 – slight dogleg
    { par: 3, ball: [0.2, 0.8], hole: [0.8, 0.15],
      walls: [[0.05,0.05,0.9,0.04],[0.05,0.91,0.9,0.04],[0.05,0.05,0.04,0.9],[0.91,0.05,0.04,0.9],
              [0.3,0.45,0.5,0.06]],
      obs: [] },
    // 3 – one bumper
    { par: 3, ball: [0.5, 0.85], hole: [0.5, 0.1],
      walls: [[0.1,0.05,0.8,0.04],[0.1,0.91,0.8,0.04],[0.1,0.05,0.04,0.9],[0.86,0.05,0.04,0.9]],
      obs: [{ x: 0.5, y: 0.5, vx: 0.003, vy: 0 }] },
    // 4 – narrow corridor
    { par: 4, ball: [0.5, 0.88], hole: [0.5, 0.1],
      walls: [[0.05,0.05,0.9,0.04],[0.05,0.91,0.9,0.04],[0.05,0.05,0.04,0.9],[0.91,0.05,0.04,0.9],
              [0.05,0.4,0.38,0.06],[0.57,0.4,0.38,0.06],[0.05,0.6,0.38,0.06],[0.57,0.6,0.38,0.06]],
      obs: [] },
    // 5 – two bumpers moving
    { par: 4, ball: [0.15, 0.85], hole: [0.85, 0.12],
      walls: [[0.05,0.05,0.9,0.04],[0.05,0.91,0.9,0.04],[0.05,0.05,0.04,0.9],[0.91,0.05,0.04,0.9],
              [0.35,0.35,0.06,0.35]],
      obs: [{ x: 0.65, y: 0.55, vx: 0, vy: 0.003 }, { x: 0.25, y: 0.35, vx: 0.002, vy: 0.002 }] },
    // 6 – L-shape
    { par: 3, ball: [0.12, 0.85], hole: [0.85, 0.12],
      walls: [[0.05,0.05,0.9,0.04],[0.05,0.91,0.9,0.04],[0.05,0.05,0.04,0.9],[0.91,0.05,0.04,0.9],
              [0.05,0.5,0.55,0.06],[0.55,0.05,0.06,0.55]],
      obs: [] },
    // 7 – pinball bumpers
    { par: 5, ball: [0.5, 0.88], hole: [0.5, 0.1],
      walls: [[0.05,0.05,0.9,0.04],[0.05,0.91,0.9,0.04],[0.05,0.05,0.04,0.9],[0.91,0.05,0.04,0.9]],
      obs: [{ x:0.3,y:0.35,vx:0.004,vy:0 },{ x:0.7,y:0.35,vx:-0.004,vy:0 },
            { x:0.5,y:0.6,vx:0,vy:0.003 }] },
    // 8 – zig-zag
    { par: 5, ball: [0.12, 0.85], hole: [0.85, 0.12],
      walls: [[0.05,0.05,0.9,0.04],[0.05,0.91,0.9,0.04],[0.05,0.05,0.04,0.9],[0.91,0.05,0.04,0.9],
              [0.2,0.3,0.5,0.05],[0.3,0.5,0.5,0.05],[0.2,0.7,0.5,0.05]],
      obs: [{ x:0.8,y:0.4,vx:0,vy:0.004 }] },
    // 9 – final boss
    { par: 6, ball: [0.1, 0.88], hole: [0.88, 0.1],
      walls: [[0.05,0.05,0.9,0.04],[0.05,0.91,0.9,0.04],[0.05,0.05,0.04,0.9],[0.91,0.05,0.04,0.9],
              [0.05,0.38,0.6,0.05],[0.35,0.6,0.6,0.05],[0.2,0.76,0.45,0.05]],
      obs: [{ x:0.75,y:0.6,vx:0.003,vy:0.002 },{ x:0.5,y:0.3,vx:-0.003,vy:0 },
            { x:0.2,y:0.55,vx:0,vy:0.004 }] },
];

const TOTAL_HOLES = HOLES.length;
let totalPar = 0;

// ── Load Hole ──────────────────────────────────────────────
function loadHole(idx) {
    const def = HOLES[idx];
    const s = canvas.width;

    ball.x = def.ball[0] * s; ball.y = def.ball[1] * s;
    ball.vx = 0; ball.vy = 0; ball.moving = false; ball.inHole = false; ball.trail = [];

    hole.x = def.hole[0] * s; hole.y = def.hole[1] * s;

    walls = def.walls.map(([x,y,w,h]) => ({ x:x*s, y:y*s, w:w*s, h:h*s }));

    obstacles = def.obs.map(o => ({
        x: o.x * s, y: o.y * s,
        vx: o.vx * s, vy: o.vy * s, r: s * 0.045
    }));

    strokes = 0;
    holeDisplay.textContent  = `HOLE ${idx + 1} / ${TOTAL_HOLES}`;
    parDisplay.textContent   = `PAR ${def.par}`;
    strokeDisplay.textContent = `SHOTS: 0`;
}

// ── Drag to shoot ──────────────────────────────────────────
let dragging = false;
let dragSX = 0, dragSY = 0, dragCX = 0, dragCY = 0;
const MAX_POWER = canvas.width * 0.45;
const POWER_SCALE = 0.22;

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width  / rect.width;
    const sy = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
}

canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('touchstart', e => { e.preventDefault(); onDown(e); }, { passive: false });
canvas.addEventListener('mousemove', onMove);
canvas.addEventListener('touchmove', e => { e.preventDefault(); onMove(e); }, { passive: false });
canvas.addEventListener('mouseup', onUp);
canvas.addEventListener('touchend', e => { e.preventDefault(); onUp(e); }, { passive: false });

function onDown(e) {
    if (gameState !== 'PLAYING' || ball.moving || ball.inHole) return;
    const { x, y } = getPos(e);
    const dist = Math.hypot(x - ball.x, y - ball.y);
    if (dist < ball.r * 4) { dragging = true; dragSX = x; dragSY = y; dragCX = x; dragCY = y; }
}
function onMove(e) {
    if (!dragging) return;
    const { x, y } = getPos(e); dragCX = x; dragCY = y;
}
function onUp() {
    if (!dragging || gameState !== 'PLAYING') return;
    dragging = false;
    const dx = dragSX - dragCX, dy = dragSY - dragCY;
    const dist = Math.hypot(dx, dy);
    if (dist < 5) return;
    const power = Math.min(dist, MAX_POWER) * POWER_SCALE;
    const angle = Math.atan2(dy, dx);
    ball.vx = Math.cos(angle) * power;
    ball.vy = Math.sin(angle) * power;
    ball.moving = true;
    strokes++;
    strokeDisplay.textContent = `SHOTS: ${strokes}`;
}

// ── Physics Update ─────────────────────────────────────────
const FRICTION = 0.985;
const STOP_SPEED = 0.4;

function updateBall() {
    if (!ball.moving || ball.inHole) return;

    ball.trail.push({ x: ball.x, y: ball.y, life: 1 });
    if (ball.trail.length > 20) ball.trail.shift();

    ball.vx *= FRICTION; ball.vy *= FRICTION;
    ball.x  += ball.vx;  ball.y  += ball.vy;

    // Wall collisions (AABB)
    walls.forEach(w => resolveWall(ball, w));

    // Obstacle collisions (circle vs circle)
    obstacles.forEach(ob => {
        const dx = ball.x - ob.x, dy = ball.y - ob.y;
        const dist = Math.hypot(dx, dy);
        if (dist < ball.r + ob.r) {
            const nx = dx / dist, ny = dy / dist;
            const overlap = ball.r + ob.r - dist;
            ball.x += nx * overlap * 0.5;
            ball.y += ny * overlap * 0.5;
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny;
            ball.vx *= 0.85; ball.vy *= 0.85;
            spawnParticles(ball.x, ball.y, '#fff', 5);
        }
    });

    // Check hole
    const dh = Math.hypot(ball.x - hole.x, ball.y - hole.y);
    if (dh < hole.r + ball.r * 0.5) {
        ball.inHole = true; ball.moving = false;
        ball.vx = 0; ball.vy = 0;
        spawnParticles(hole.x, hole.y, '#00ff88', 40);
        setTimeout(showHoleResult, 800);
        return;
    }

    // Stop
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed < STOP_SPEED) { ball.moving = false; ball.vx = 0; ball.vy = 0; }
}

function resolveWall(b, w) {
    const closest = {
        x: Math.max(w.x, Math.min(b.x, w.x + w.w)),
        y: Math.max(w.y, Math.min(b.y, w.y + w.h))
    };
    const dx = b.x - closest.x, dy = b.y - closest.y;
    const dist = Math.hypot(dx, dy);
    if (dist < b.r && dist > 0) {
        const nx = dx / dist, ny = dy / dist;
        b.x += nx * (b.r - dist); b.y += ny * (b.r - dist);
        const dot = b.vx * nx + b.vy * ny;
        b.vx -= 2 * dot * nx * 0.85; b.vy -= 2 * dot * ny * 0.85;
    }
}

function updateObstacles() {
    const s = canvas.width;
    obstacles.forEach(ob => {
        ob.x += ob.vx; ob.y += ob.vy;
        walls.forEach(w => {
            if (ob.x - ob.r < w.x) { ob.x = w.x + ob.r; ob.vx *= -1; }
            if (ob.x + ob.r > w.x + w.w) { ob.x = w.x + w.w - ob.r; ob.vx *= -1; }
            if (ob.y - ob.r < w.y) { ob.y = w.y + ob.r; ob.vy *= -1; }
            if (ob.y + ob.r > w.y + w.h) { ob.y = w.y + w.h - ob.r; ob.vy *= -1; }
        });
        // Canvas bounds
        if (ob.x - ob.r < 0) { ob.x = ob.r; ob.vx *= -1; }
        if (ob.x + ob.r > s) { ob.x = s - ob.r; ob.vx *= -1; }
        if (ob.y - ob.r < 0) { ob.y = ob.r; ob.vy *= -1; }
        if (ob.y + ob.r > s) { ob.y = s - ob.r; ob.vy *= -1; }
    });
}

// ── Particles ──────────────────────────────────────────────
let parts = [];
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        const a = Math.random() * Math.PI * 2;
        const sp = Math.random() * 6 + 1;
        this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
        this.life = 1; this.decay = Math.random() * 0.04 + 0.015;
        this.color = color; this.size = Math.random() * 3 + 2;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.1; this.life -= this.decay; }
    draw() {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color; ctx.shadowBlur = 8; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}
function spawnParticles(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) parts.push(new Particle(x, y, color));
}

// ── Draw ────────────────────────────────────────────────────
function drawScene() {
    // Background
    ctx.fillStyle = '#03100a'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Turf texture (subtle grid)
    ctx.strokeStyle = 'rgba(0,255,136,0.05)'; ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    // Walls
    walls.forEach(w => {
        ctx.fillStyle = '#222'; ctx.fillRect(w.x + 4, w.y + 4, w.w, w.h);
        ctx.fillStyle = '#1a3a28'; ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
        ctx.shadowBlur = 8; ctx.shadowColor = '#00ff88';
        ctx.strokeRect(w.x, w.y, w.w, w.h);
        ctx.shadowBlur = 0;
    });

    // Obstacles (moving bumpers)
    obstacles.forEach(ob => {
        ctx.save();
        ctx.fillStyle = 'rgba(255,0,234,0.25)';
        ctx.strokeStyle = '#ff00ea'; ctx.lineWidth = 3;
        ctx.shadowBlur = 12; ctx.shadowColor = '#ff00ea';
        ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
    });

    // Hole
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.shadowBlur = 15; ctx.shadowColor = '#00ff88';
    ctx.beginPath(); ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 3;
    ctx.stroke(); ctx.shadowBlur = 0;
    // Flag
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hole.x, hole.y - hole.r); ctx.lineTo(hole.x, hole.y - hole.r - 20); ctx.stroke();
    ctx.fillStyle = '#ff003c';
    ctx.beginPath(); ctx.moveTo(hole.x, hole.y - hole.r - 20); ctx.lineTo(hole.x + 12, hole.y - hole.r - 14); ctx.lineTo(hole.x, hole.y - hole.r - 8); ctx.fill();
    ctx.restore();

    // Trail
    ball.trail.forEach((t, i) => {
        const alpha = (i / ball.trail.length) * 0.6;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#00f3ff'; ctx.shadowBlur = 5; ctx.shadowColor = '#00f3ff';
        ctx.beginPath(); ctx.arc(t.x, t.y, ball.r * 0.5 * (i / ball.trail.length), 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    // Aim line while dragging
    if (dragging && !ball.moving) {
        const dx = dragSX - dragCX, dy = dragSY - dragCY;
        const dist = Math.min(Math.hypot(dx, dy), MAX_POWER);
        const angle = Math.atan2(dy, dx);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ball.x + Math.cos(angle) * dist * 0.8, ball.y + Math.sin(angle) * dist * 0.8);
        ctx.stroke();
        // Power indicator
        ctx.strokeStyle = `hsl(${120 - (dist / MAX_POWER) * 120}, 100%, 60%)`;
        ctx.lineWidth = 3; ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r + 6, 0, (dist / MAX_POWER) * Math.PI * 2); ctx.stroke();
        ctx.restore();
    }

    // Ball (hide when in hole)
    if (!ball.inHole) {
        ctx.save();
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 15; ctx.shadowColor = '#00f3ff';
        ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
        // Glint
        ctx.fillStyle = 'rgba(0,243,255,0.6)';
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // Particles
    parts = parts.filter(p => p.life > 0);
    parts.forEach(p => { p.update(); p.draw(); });
}

// ── Hole complete logic ────────────────────────────────────
function showHoleResult() {
    gameState = 'HOLE_COMPLETE';
    const par = HOLES[currentHole].par;
    const diff = strokes - par;
    totalStrokes += strokes;
    const labels = ['HOLE IN ONE!','EAGLE!','BIRDIE!','PAR','BOGEY','DOUBLE BOGEY','OVER PAR'];
    const msgs    = ['Unbelievable!','Incredible eagle!','Great birdie!','Right on par!','One over.','Two over…','Keep practicing!'];
    const label_idx = Math.min(Math.max(diff + 2, 0), labels.length - 1);

    holeTitle.textContent = labels[label_idx];
    holeMsg.textContent   = `${msgs[label_idx]}  (${strokes} shots, par ${par})`;
    holeCompleteScreen.classList.add('active');
}

function nextHole() {
    holeCompleteScreen.classList.remove('active');
    currentHole++;
    if (currentHole >= TOTAL_HOLES) {
        showGameOver();
    } else {
        loadHole(currentHole);
        gameState = 'PLAYING';
    }
}

function showGameOver() {
    const totalParVal = HOLES.reduce((s, h) => s + h.par, 0);
    const diff = totalStrokes - totalParVal;
    totalShotsEl.textContent = totalStrokes;
    totalParEl.textContent   = totalParVal;
    scoreSummaryEl.textContent = diff === 0 ? 'Dead even — great round!' : diff < 0 ? `${Math.abs(diff)} under par — impressive!` : `${diff} over par — keep practicing!`;
    gameOverScreen.classList.add('active');
    gameState = 'GAMEOVER';
}

// ── Game Loop ──────────────────────────────────────────────
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateObstacles();
    if (gameState === 'PLAYING') updateBall();
    drawScene();
    animationId = requestAnimationFrame(gameLoop);
}

// ── Init ───────────────────────────────────────────────────
function init() {
    currentHole = 0; totalStrokes = 0; parts = [];
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    holeCompleteScreen.classList.remove('active');
    loadHole(0);
    cancelAnimationFrame(animationId);
    gameLoop();
}

startBtn.addEventListener('click', init);
nextHoleBtn.addEventListener('click', nextHole);
restartBtn.addEventListener('click', init);

// Static bg on load
ctx.fillStyle = '#03100a'; ctx.fillRect(0, 0, canvas.width, canvas.height);