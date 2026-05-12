const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const resultTitle = document.getElementById('resultTitle');
const resultMsg = document.getElementById('resultMsg');
const finalLevel = document.getElementById('finalLevel');

// Sizing
function resize() {
    const size = Math.min(window.innerWidth, window.innerHeight, 600);
    canvas.width = size;
    canvas.height = size;
}
window.addEventListener('resize', resize);
resize();

// ── Palette ──────────────────────────────────────────────
const WIRE_COLORS = ['#ff003c', '#00f3ff', '#00ff88', '#fff200', '#ff7700', '#cc00ff'];
const WIRE_NAMES  = ['RED', 'CYAN', 'GREEN', 'YELLOW', 'ORANGE', 'VIOLET'];

// ── State ─────────────────────────────────────────────────
let level, timeLeft, timerInterval;
let wires = [];               // {color, name, cut, correct, y, shake}
let clue = '';                // text clue on-screen
let cutOrder = [];            // correct cut sequence indices
let cutsRemaining = [];       // remaining indices to cut
let animationId;
let screenShakeAmt = 0;
let defuseParticles = [];
let flashTimer = 0;           // green flash on success
let gameState = 'START';

// ── Bomb geometry helpers ──────────────────────────────────
const B = () => ({
    cx: canvas.width / 2,
    cy: canvas.height / 2,
    r:  Math.min(canvas.width, canvas.height) * 0.22,
    boxW: canvas.width * 0.72,
    boxH: canvas.height * 0.52,
    boxX: canvas.width * 0.14,
    boxY: canvas.height * 0.24,
});

// ── Generate Level ─────────────────────────────────────────
function generateLevel() {
    const numWires = Math.min(3 + level, WIRE_COLORS.length);
    const numCuts  = Math.min(1 + Math.floor(level / 2), numWires);
    const timeBonus = Math.max(8, 30 - level * 2);
    timeLeft = timeBonus;

    // Shuffle wire colors
    const indices = [...Array(WIRE_COLORS.length).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const chosenIndices = indices.slice(0, numWires);

    const b = B();
    wires = chosenIndices.map((ci, i) => {
        const y = b.boxY + 60 + i * ((b.boxH - 80) / (numWires - 1 || 1));
        return {
            colorIdx: ci,
            color: WIRE_COLORS[ci],
            name: WIRE_NAMES[ci],
            cut: false,
            y,
        };
    });

    // Pick random cut sequence
    const shuffled = [...Array(numWires).keys()];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    cutOrder = shuffled.slice(0, numCuts);
    cutsRemaining = [...cutOrder];

    // Build clue text
    const names = cutOrder.map(i => wires[i].name);
    if (names.length === 1) {
        clue = `Cut the ${names[0]} wire.`;
    } else {
        clue = `Cut in order: ${names.join(' → ')}`;
    }
}

// ── Particles ──────────────────────────────────────────────
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * 7 + 2;
        this.vx = Math.cos(a) * s;
        this.vy = Math.sin(a) * s;
        this.life = 1; this.decay = Math.random() * 0.04 + 0.015;
        this.color = color; this.size = Math.random() * 4 + 2;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.15; this.life -= this.decay; }
    draw() {
        ctx.save(); ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color; ctx.shadowBlur = 8; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

function spawnBoom(x, y, color, n = 20) {
    for (let i = 0; i < n; i++) defuseParticles.push(new Particle(x, y, color));
}

// ── Draw Functions ─────────────────────────────────────────
function drawBackground() {
    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(0,243,255,0.06)';
    ctx.lineWidth = 1;
    const gs = 40;
    for (let x = 0; x < canvas.width; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
}

function drawBombBox() {
    const b = B();
    // Glow flash when level cleared
    const glowColor = flashTimer > 0 ? '#00ff88' : '#ff003c';
    const glowAmt   = flashTimer > 0 ? 30 + flashTimer * 3 : 15;

    // Main case
    ctx.save();
    ctx.shadowBlur = glowAmt; ctx.shadowColor = glowColor;
    ctx.fillStyle = '#111118';
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 3;
    roundRect(b.boxX, b.boxY, b.boxW, b.boxH, 16);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Screws
    const screwPos = [
        [b.boxX + 14, b.boxY + 14], [b.boxX + b.boxW - 14, b.boxY + 14],
        [b.boxX + 14, b.boxY + b.boxH - 14], [b.boxX + b.boxW - 14, b.boxY + b.boxH - 14]
    ];
    screwPos.forEach(([sx, sy]) => {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx - 3, sy); ctx.lineTo(sx + 3, sy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx, sy - 3); ctx.lineTo(sx, sy + 3); ctx.stroke();
    });
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function drawTimer() {
    const b = B();
    const timerX = b.cx;
    const timerY = b.boxY + 35;
    const displayTime = Math.max(0, timeLeft);
    const isUrgent = timeLeft <= 5;

    ctx.save();
    ctx.font = `bold ${canvas.width * 0.085}px 'Share Tech Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const pulse = isUrgent ? 0.7 + 0.3 * Math.sin(Date.now() / 100) : 1;
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = isUrgent ? '#ff003c' : '#ff7700';
    ctx.shadowBlur  = isUrgent ? 25 : 12;
    ctx.shadowColor = isUrgent ? '#ff003c' : '#ff7700';
    ctx.fillText(String(displayTime).padStart(2, '0'), timerX, timerY);
    ctx.restore();
}

function drawWires() {
    const b = B();
    const leftX  = b.boxX + 18;
    const rightX = b.boxX + b.boxW - 18;

    wires.forEach((w, idx) => {
        const y = w.y;
        const isCut = w.cut;
        const isNextToCut = cutsRemaining.length > 0 && cutsRemaining[0] === idx;

        // Connector pegs
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.arc(leftX,  y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.arc(rightX, y, 5, 0, Math.PI * 2); ctx.fill();

        if (!isCut) {
            ctx.save();
            ctx.strokeStyle = w.color;
            ctx.lineWidth   = 5;
            ctx.shadowBlur  = isNextToCut ? 18 : 6;
            ctx.shadowColor = w.color;
            ctx.lineCap = 'round';

            // Draw wavy wire
            ctx.beginPath();
            ctx.moveTo(leftX, y);
            const segments = 8;
            const segW = (rightX - leftX) / segments;
            for (let s = 0; s <= segments; s++) {
                const sx = leftX + s * segW;
                const sy = y + Math.sin((s / segments) * Math.PI * 2.5 + idx) * 6;
                s === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
            }
            ctx.stroke();
            ctx.restore();

            // Scissors icon on hover wire
            if (isNextToCut) {
                ctx.save();
                ctx.fillStyle = '#fff';
                ctx.font = `${canvas.width * 0.05}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 200);
                ctx.fillText('✂', b.cx, y - 18);
                ctx.restore();
            }
        } else {
            // Left stub
            ctx.save();
            ctx.strokeStyle = w.color; ctx.lineWidth = 5; ctx.lineCap = 'round';
            ctx.shadowBlur = 4; ctx.shadowColor = w.color;
            ctx.beginPath(); ctx.moveTo(leftX, y); ctx.lineTo(b.cx - 18, y + 3); ctx.stroke();
            // Right stub
            ctx.beginPath(); ctx.moveTo(rightX, y); ctx.lineTo(b.cx + 18, y - 3); ctx.stroke();
            ctx.restore();

            // Spark at cut point
            spawnBoom(b.cx, y, w.color, 1);
        }

        // Wire label
        ctx.save();
        ctx.fillStyle = w.cut ? 'rgba(255,255,255,0.25)' : '#fff';
        ctx.font = `${canvas.width * 0.032}px 'Orbitron', sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(w.name, leftX + 12, y - 14);
        ctx.restore();
    });
}

function drawClue() {
    const b = B();
    ctx.save();
    ctx.fillStyle = '#00f3ff';
    ctx.shadowBlur = 8; ctx.shadowColor = '#00f3ff';
    ctx.font = `${canvas.width * 0.038}px 'Orbitron', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ty = b.boxY + b.boxH + 32;
    ctx.fillText(clue, b.cx, ty);

    // Step counter
    if (cutsRemaining.length > 0) {
        ctx.font = `${canvas.width * 0.03}px 'Orbitron', sans-serif`;
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
        ctx.fillText(`Step ${cutOrder.length - cutsRemaining.length + 1} / ${cutOrder.length}`, b.cx, ty + 28);
    }
    ctx.restore();
}

function drawLevelBadge() {
    const b = B();
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = `${canvas.width * 0.035}px 'Orbitron', sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`LVL ${level}`, b.boxX + 8, b.boxY - 28);
    ctx.restore();
}

// ── Render Loop ────────────────────────────────────────────
function render() {
    if (gameState !== 'PLAYING') return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Screen shake
    if (screenShakeAmt > 0) {
        ctx.save();
        ctx.translate(
            (Math.random() - 0.5) * screenShakeAmt,
            (Math.random() - 0.5) * screenShakeAmt
        );
        screenShakeAmt *= 0.8;
        if (screenShakeAmt < 0.5) screenShakeAmt = 0;
    }

    drawBackground();
    drawBombBox();
    drawTimer();
    drawWires();
    drawClue();
    drawLevelBadge();

    // Particles
    defuseParticles = defuseParticles.filter(p => p.life > 0);
    defuseParticles.forEach(p => { p.update(); p.draw(); });

    if (flashTimer > 0) flashTimer--;

    if (screenShakeAmt > 0) ctx.restore();

    animationId = requestAnimationFrame(render);
}

// ── Timer ──────────────────────────────────────────────────
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (gameState !== 'PLAYING') return clearInterval(timerInterval);
        timeLeft--;
        if (timeLeft <= 0) {
            timeLeft = 0;
            triggerExplosion('TIME\'S UP!', 'The timer ran out. BOOM.');
        }
    }, 1000);
}

// ── Click / Tap ────────────────────────────────────────────
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top)  * scaleY };
}

canvas.addEventListener('mousedown', handleCut);
canvas.addEventListener('touchstart', e => { e.preventDefault(); handleCut(e); }, { passive: false });

function handleCut(e) {
    if (gameState !== 'PLAYING') return;
    const { x, y } = getPos(e);

    // Find tapped wire (hit area ±20px vertically)
    const hit = wires.findIndex(w => !w.cut && Math.abs(y - w.y) < 20);
    if (hit === -1) return;

    if (cutsRemaining[0] === hit) {
        // Correct cut!
        wires[hit].cut = true;
        cutsRemaining.shift();
        const b = B();
        spawnBoom(b.cx, wires[hit].y, wires[hit].color, 18);

        if (cutsRemaining.length === 0) {
            // Level cleared!
            clearInterval(timerInterval);
            flashTimer = 30;
            spawnBoom(b.cx, b.cy, '#00ff88', 60);
            setTimeout(() => {
                level++;
                generateLevel();
                startTimer();
            }, 1500);
        }
    } else {
        // Wrong wire!
        triggerExplosion('WRONG WIRE!', `You cut the ${wires[hit].name} wire. BOOM.`);
    }
}

function triggerExplosion(title, msg) {
    clearInterval(timerInterval);
    gameState = 'GAMEOVER';
    screenShakeAmt = 20;
    const b = B();
    spawnBoom(b.cx, b.cy, '#ff003c', 80);
    spawnBoom(b.cx, b.cy, '#ff7700', 40);
    cancelAnimationFrame(animationId);

    // Final particle flush render
    let t = 0;
    function flush() {
        if (t++ > 40) {
            resultTitle.textContent = title;
            resultMsg.textContent   = msg;
            finalLevel.textContent  = level;
            gameOverScreen.classList.add('active');
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground();
        drawBombBox();
        defuseParticles = defuseParticles.filter(p => p.life > 0);
        defuseParticles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(flush);
    }
    flush();
}

// ── Init ───────────────────────────────────────────────────
function init() {
    level = 1;
    defuseParticles = [];
    flashTimer = 0;
    screenShakeAmt = 0;
    generateLevel();
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    cancelAnimationFrame(animationId);
    startTimer();
    render();
}

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Static bg on start
drawBackground();