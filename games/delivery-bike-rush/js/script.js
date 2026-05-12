const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen    = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn       = document.getElementById('startBtn');
const restartBtn     = document.getElementById('restartBtn');
const scoreDisplay   = document.getElementById('scoreDisplay');
const speedDisplay   = document.getElementById('speedDisplay');
const packageDisplay = document.getElementById('packageDisplay');
const finalScore     = document.getElementById('finalScore');
const finalPackages  = document.getElementById('finalPackages');
const leftBtn        = document.getElementById('leftBtn');
const rightBtn       = document.getElementById('rightBtn');

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// ── Palette ──────────────────────────────────────────────
const C_ROAD     = '#111';
const C_LINE     = '#ffaa00';
const C_CURB     = '#1a1a2e';
const C_BIKE     = '#00f3ff';
const C_EXHAUST  = '#ff7700';
const C_PKG      = '#00ff88';
const C_CAR      = ['#ff003c','#9d00ff','#ff00ea','#ff7700'];

// ── State ─────────────────────────────────────────────────
let gameState = 'START';
let score = 0, packages = 0;
let worldSpeed = 5, throttleLevel = 1;
let animationId;
let frameCount = 0;

const ROAD_LEFT  = () => canvas.width  * 0.08;
const ROAD_RIGHT = () => canvas.width  * 0.92;
const ROAD_W     = () => ROAD_RIGHT() - ROAD_LEFT();
const GROUND_Y   = () => canvas.height * 0.72;  // road surface

// ── Input ─────────────────────────────────────────────────
const input = { left: false, right: false };
window.addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') input.left  = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
});
window.addEventListener('keyup', e => {
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') input.left  = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
});
leftBtn.addEventListener('touchstart',  e => { e.preventDefault(); input.left  = true;  }, { passive: false });
leftBtn.addEventListener('touchend',    e => { e.preventDefault(); input.left  = false; }, { passive: false });
rightBtn.addEventListener('touchstart', e => { e.preventDefault(); input.right = true;  }, { passive: false });
rightBtn.addEventListener('touchend',   e => { e.preventDefault(); input.right = false; }, { passive: false });

// ── Player Bike ───────────────────────────────────────────
const bike = {
    x: 0, y: 0,
    vx: 0,
    tilt: 0,          // degrees visual tilt
    wheelRot: 0,
    wheelR: 0,

    reset() {
        this.x  = canvas.width  * 0.22;
        this.y  = GROUND_Y() - 30;
        this.vx = 0; this.tilt = 0; this.wheelRot = 0;
        this.wheelR = canvas.width * 0.035;
    },

    update() {
        const accel = 0.4, decel = 0.6, maxSpd = 7;

        if (input.right) { this.vx += accel; this.tilt = Math.min(this.tilt + 2, 18); }
        else if (input.left) { this.vx -= decel; this.tilt = Math.max(this.tilt - 2, -18); }
        else { this.vx *= 0.92; this.tilt *= 0.85; }

        this.vx = Math.max(-2, Math.min(maxSpd, this.vx));
        this.x += this.vx;
        this.x = Math.max(ROAD_LEFT() + this.wheelR, Math.min(ROAD_RIGHT() - this.wheelR, this.x));

        // Wheel spin
        this.wheelRot += (worldSpeed + this.vx) * 0.08;
    },

    draw() {
        const wr = this.wheelR;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.tilt * Math.PI / 180);

        // Exhaust particles (behind bike)
        if (input.right && Math.random() < 0.5) {
            exhaustParticles.push(new Particle(-wr * 2.2, wr * 0.6, C_EXHAUST));
        }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.ellipse(0, wr + 4, wr * 1.8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body frame
        ctx.strokeStyle = C_BIKE; ctx.lineWidth = 4;
        ctx.shadowBlur = 12; ctx.shadowColor = C_BIKE;
        // Seat to rear wheel
        ctx.beginPath(); ctx.moveTo(-wr * 0.6, -wr * 0.4); ctx.lineTo(-wr * 0.9, wr); ctx.stroke();
        // Seat to front fork
        ctx.beginPath(); ctx.moveTo(-wr * 0.6, -wr * 0.4); ctx.lineTo(wr * 0.9, -wr * 0.2); ctx.stroke();
        // Front fork
        ctx.beginPath(); ctx.moveTo(wr * 0.9, -wr * 0.2); ctx.lineTo(wr, wr); ctx.stroke();
        // Top bar
        ctx.beginPath(); ctx.moveTo(-wr * 0.6, -wr * 0.4); ctx.lineTo(wr * 0.5, -wr * 0.7); ctx.stroke();
        // Handlebars
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(wr * 0.5, -wr * 0.7); ctx.lineTo(wr * 0.9, -wr * 0.9); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wr * 0.5, -wr * 0.7); ctx.lineTo(wr * 0.9, -wr * 0.5); ctx.stroke();

        // Wheels
        function drawWheel(wx, wy) {
            ctx.strokeStyle = C_BIKE; ctx.lineWidth = 5;
            ctx.shadowBlur = 10; ctx.shadowColor = C_BIKE;
            ctx.beginPath(); ctx.arc(wx, wy, wr, 0, Math.PI * 2); ctx.stroke();
            // Spokes
            ctx.lineWidth = 2;
            for (let s = 0; s < 6; s++) {
                const a = bike.wheelRot + (s / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(wx, wy);
                ctx.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr);
                ctx.stroke();
            }
        }
        drawWheel(-wr * 0.9, wr);
        drawWheel(wr, wr);

        // Rider
        ctx.strokeStyle = C_BIKE; ctx.lineWidth = 3;
        // Torso (leaning)
        ctx.beginPath(); ctx.moveTo(-wr * 0.2, -wr * 0.4); ctx.lineTo(-wr * 0.05, -wr * 1.5); ctx.stroke();
        // Head
        ctx.fillStyle = C_BIKE; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(-wr * 0.05, -wr * 1.7, wr * 0.28, 0, Math.PI * 2); ctx.fill();
        // Arms to bars
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-wr * 0.05, -wr * 1.4); ctx.lineTo(wr * 0.85, -wr * 0.7); ctx.stroke();

        // Package on back
        if (packages < 3) {
            ctx.fillStyle = C_PKG; ctx.shadowColor = C_PKG; ctx.shadowBlur = 8;
            ctx.fillRect(-wr * 1.1, -wr * 0.9, wr * 0.55, wr * 0.55);
        }

        ctx.restore();
    }
};

// ── Road Elements ─────────────────────────────────────────
let roadLines = [];      // dashed centre lines
let curbDots  = [];      // roadside dots
let trees     = [];      // bg silhouettes
let obstacles = [];      // cars / barriers
let pickups   = [];      // package boxes

let roadLineY = 0;

function initRoad() {
    roadLines = []; curbDots = []; trees = []; obstacles = []; pickups = [];
    for (let y = 0; y < canvas.height; y += 80)  roadLines.push({ y });
    for (let y = 0; y < canvas.height; y += 40)  curbDots.push({ y });
    for (let i = 0; i < 6; i++) {
        trees.push({
            x: Math.random() < 0.5 ? ROAD_LEFT() - 30 - Math.random() * 80 : ROAD_RIGHT() + 30 + Math.random() * 80,
            y: Math.random() * canvas.height,
            h: 60 + Math.random() * 80
        });
    }
}

// ── Obstacles / Cars ──────────────────────────────────────
const LANES = 3;
function laneX(lane) {
    const rw = ROAD_W();
    return ROAD_LEFT() + (rw / LANES) * lane + (rw / LANES) / 2;
}

class Car {
    constructor() {
        this.lane  = Math.floor(Math.random() * LANES);
        this.x     = laneX(this.lane);
        this.y     = -120;
        this.w     = 40; this.h = 80;
        this.speed = worldSpeed * (0.4 + Math.random() * 0.5);
        this.color = C_CAR[Math.floor(Math.random() * C_CAR.length)];
    }
    update() { this.y += this.speed * 0.4 + worldSpeed * 0.6; }
    draw() {
        ctx.save();
        ctx.shadowBlur = 12; ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        // Body
        ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
        // Windows
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - this.w/2 + 4, this.y - this.h/2 + 10, this.w - 8, 18);
        ctx.fillRect(this.x - this.w/2 + 4, this.y - this.h/2 + 46, this.w - 8, 18);
        // Headlights
        ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
        ctx.fillRect(this.x - this.w/2 + 3, this.y + this.h/2 - 10, 10, 6);
        ctx.fillRect(this.x + this.w/2 - 13, this.y + this.h/2 - 10, 10, 6);
        ctx.restore();
    }
    get bounds() { return { x: this.x - this.w/2 + 6, y: this.y - this.h/2 + 6, w: this.w - 12, h: this.h - 12 }; }
}

class Pickup {
    constructor() {
        this.lane  = Math.floor(Math.random() * LANES);
        this.x     = laneX(this.lane);
        this.y     = -50;
        this.size  = 26;
        this.pulse = Math.random() * Math.PI * 2;
    }
    update() { this.y += worldSpeed * 0.7; this.pulse += 0.1; }
    draw() {
        const glow = 8 + 4 * Math.sin(this.pulse);
        ctx.save();
        ctx.shadowBlur = glow; ctx.shadowColor = C_PKG;
        ctx.fillStyle = C_PKG;
        const s = this.size;
        ctx.fillRect(this.x - s/2, this.y - s/2, s, s);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.shadowBlur = 0;
        ctx.strokeRect(this.x - s/2, this.y - s/2, s, s);
        // Tape cross
        ctx.beginPath(); ctx.moveTo(this.x - s/2, this.y); ctx.lineTo(this.x + s/2, this.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.x, this.y - s/2); ctx.lineTo(this.x, this.y + s/2); ctx.stroke();
        ctx.restore();
    }
    get bounds() { const s = this.size; return { x: this.x - s/2, y: this.y - s/2, w: s, h: s }; }
}

// ── Particles ─────────────────────────────────────────────
let exhaustParticles = [];
let crunchParticles  = [];

class Particle {
    constructor(rx, ry, color) {
        // rx/ry relative to bike, converted to world after
        this.x = bike.x + rx; this.y = bike.y + ry;
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * 4 + 1;
        this.vx = Math.cos(a) * s - worldSpeed; this.vy = Math.sin(a) * s;
        this.life = 1; this.decay = Math.random() * 0.05 + 0.02;
        this.color = color; this.size = Math.random() * 5 + 2;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= this.decay; this.size *= 0.96; }
    draw() {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color; ctx.shadowBlur = 6; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

// ── Scroll & draw road ────────────────────────────────────
function drawRoad() {
    const rl = ROAD_LEFT(), rr = ROAD_RIGHT(), gy = GROUND_Y();

    // Sky / Ground gradient
    const skySplit = gy;
    const sky = ctx.createLinearGradient(0, 0, 0, skySplit);
    sky.addColorStop(0, '#030308'); sky.addColorStop(1, '#0a0a18');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, skySplit);

    // Underground (road continuation)
    ctx.fillStyle = C_ROAD; ctx.fillRect(0, gy, canvas.width, canvas.height - gy);

    // Road surface (perspective strip)
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(rl, 0, rr - rl, canvas.height);

    // Horizon glow
    const grd = ctx.createLinearGradient(0, gy - 40, 0, gy + 40);
    grd.addColorStop(0, 'rgba(255,170,0,0)'); grd.addColorStop(0.5, 'rgba(255,170,0,0.08)'); grd.addColorStop(1, 'rgba(255,170,0,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, gy - 40, canvas.width, 80);

    // Curb strips
    [rl, rr - 8].forEach(cx => {
        ctx.fillStyle = '#c00'; ctx.fillRect(cx, 0, 8, canvas.height);
        ctx.fillStyle = '#fff';
        curbDots.forEach(d => { if (Math.floor(d.y / 40) % 2 === 0) ctx.fillRect(cx, d.y, 8, 20); });
    });

    // Centre dashed lines (3 lanes = 2 dividers)
    for (let l = 1; l < LANES; l++) {
        const lx = ROAD_LEFT() + (ROAD_W() / LANES) * l;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 3;
        ctx.setLineDash([40, 40]);
        ctx.lineDashOffset = -roadLineY;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, canvas.height); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Trees (side silhouettes)
    trees.forEach(t => {
        ctx.fillStyle = '#0a1a0a';
        ctx.fillRect(t.x - 6, t.y - t.h, 12, t.h);   // trunk
        ctx.fillStyle = '#0d280d';
        ctx.beginPath(); ctx.arc(t.x, t.y - t.h, 22, 0, Math.PI * 2); ctx.fill();
    });
}

function scrollWorld() {
    roadLineY = (roadLineY + worldSpeed) % 80;
    curbDots.forEach(d => {
        d.y += worldSpeed * 0.9;
        if (d.y > canvas.height) d.y -= canvas.height;
    });
    trees.forEach(t => {
        t.y += worldSpeed * 0.3;
        if (t.y > canvas.height + 100) {
            t.y = -t.h;
            t.x = Math.random() < 0.5 ? ROAD_LEFT() - 30 - Math.random() * 80 : ROAD_RIGHT() + 30 + Math.random() * 80;
        }
    });
}

// ── AABB Collision ────────────────────────────────────────
function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── Game Logic ────────────────────────────────────────────
let spawnTimer = 0;
let pkgTimer   = 0;

function update() {
    if (gameState !== 'PLAYING') return;

    frameCount++;
    // Gradually increase difficulty
    worldSpeed = 5 + (frameCount / 800);
    throttleLevel = ((worldSpeed - 5) / 6 * 9 + 1).toFixed(1);
    if (frameCount % 60 === 0) {
        score += Math.floor(worldSpeed);
        scoreDisplay.textContent = `SCORE: ${score}`;
        speedDisplay.textContent = `SPEED: ${throttleLevel}X`;
    }

    scrollWorld();
    bike.update();

    // Spawn obstacles
    spawnTimer++;
    const spawnRate = Math.max(45, 120 - frameCount / 40);
    if (spawnTimer > spawnRate) { spawnTimer = 0; obstacles.push(new Car()); }

    pkgTimer++;
    if (pkgTimer > 200) { pkgTimer = 0; pickups.push(new Pickup()); }

    // Bike bounds (for collision – tight around body)
    const bBounds = { x: bike.x - bike.wheelR * 0.7, y: bike.y - bike.wheelR * 1.8, w: bike.wheelR * 1.4, h: bike.wheelR * 2.4 };

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update();
        if (obstacles[i].y > canvas.height + 150) { obstacles.splice(i, 1); continue; }
        if (rectsOverlap(bBounds, obstacles[i].bounds)) {
            die();
            return;
        }
    }

    // Update pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
        pickups[i].update();
        if (pickups[i].y > canvas.height + 80) { pickups.splice(i, 1); continue; }
        if (rectsOverlap(bBounds, pickups[i].bounds)) {
            pickups.splice(i, 1);
            packages++;
            score += 200;
            scoreDisplay.textContent  = `SCORE: ${score}`;
            packageDisplay.textContent = `📦 ${packages}`;
            exhaustParticles.push(...Array.from({ length: 12 }, () => new Particle(-bike.wheelR, 0, C_PKG)));
        }
    }

    // Particles
    exhaustParticles = exhaustParticles.filter(p => p.life > 0);
    exhaustParticles.forEach(p => p.update());
    crunchParticles  = crunchParticles.filter(p => p.life > 0);
    crunchParticles.forEach(p => p.update());
}

function die() {
    gameState = 'GAMEOVER';
    // Explosion burst
    for (let i = 0; i < 60; i++) crunchParticles.push(new Particle(0, 0, C_BIKE));
    for (let i = 0; i < 30; i++) crunchParticles.push(new Particle(0, 0, '#ff003c'));
    setTimeout(() => {
        finalScore.textContent    = score;
        finalPackages.textContent = packages;
        gameOverScreen.classList.add('active');
    }, 1200);
    cancelAnimationFrame(animationId);
    deathFlush();
}

function deathFlush() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRoad();
    crunchParticles.forEach(p => { p.update(); p.draw(); });
    if (crunchParticles.some(p => p.life > 0)) requestAnimationFrame(deathFlush);
}

// ── Draw ──────────────────────────────────────────────────
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRoad();
    pickups.forEach(p => p.draw());
    obstacles.forEach(o => o.draw());
    exhaustParticles.forEach(p => p.draw());
    bike.draw();
    crunchParticles.forEach(p => p.draw());
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    update();
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

function init() {
    score = 0; packages = 0; frameCount = 0; worldSpeed = 5;
    scoreDisplay.textContent   = `SCORE: 0`;
    speedDisplay.textContent   = `SPEED: 1X`;
    packageDisplay.textContent = `📦 0`;
    exhaustParticles = []; crunchParticles = [];
    obstacles = []; pickups = [];
    spawnTimer = 0; pkgTimer = 0;
    initRoad();
    bike.reset();
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    cancelAnimationFrame(animationId);
    gameLoop();
}

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);
window.addEventListener('keydown', e => { if (e.code === 'Enter') { if (gameState === 'START') init(); else if (gameState === 'GAMEOVER') init(); } });

// Initial bg
ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, canvas.width, canvas.height);