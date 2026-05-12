const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hud = document.getElementById('hud');
const startMenu = document.getElementById('start-menu');
const levelCompleteScreen = document.getElementById('level-complete');
const gameOverScreen = document.getElementById('game-over');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const timeEl = document.getElementById('time');
const timerProgress = document.getElementById('timer-progress');
const sizeProgress = document.getElementById('size-progress');

const btnStart = document.getElementById('btn-start');
const btnNext = document.getElementById('btn-next');
const btnRestart = document.getElementById('btn-restart');
const btnSound = document.getElementById('btn-sound');

// Game State
let GAME_STATE = {
    state: 'MENU', // MENU, PLAYING, LEVEL_COMPLETE, GAME_OVER
    level: 1,
    score: 0,
    time: 60,
    maxTime: 60,
    objectsEaten: 0,
    soundEnabled: true,
    lastTime: 0
};

// Physics / View
let VIEW = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    scale: 1,
    worldWidth: 2000,
    worldHeight: 2000
};

// Input
let INPUT = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    isDown: false
};

const MAP_SIZES = [2000, 2500, 3000, 3500, 4000, 4500, 5000];

// Entity arrays
let holes = [];
let objects = [];
let particles = [];

// Object Definitions
const OBJ_TYPES = [
    { type: 'cone', rad: 15, points: 10, reqSize: 25, emoji: '🚸' },
    { type: 'trash', rad: 18, points: 15, reqSize:  25, emoji: '🗑️' },
    { type: 'bench', rad: 22, points: 20, reqSize: 35, emoji: '🪑' },
    { type: 'tree', rad: 30, points: 30, reqSize: 45, emoji: '🌲' },
    { type: 'car', rad: 40, points: 50, reqSize: 60, emoji: '🚗' },
    { type: 'bus', rad: 60, points: 100, reqSize: 90, emoji: '🚌' },
    { type: 'house', rad: 90, points: 200, reqSize: 120, emoji: '🏠' },
    { type: 'building', rad: 150, points: 500, reqSize: 200, emoji: '🏢' }
];

class Hole {
    constructor(x, y, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.radius = 25;
        this.targetRadius = 25;
        this.isPlayer = isPlayer;
        this.vx = 0;
        this.vy = 0;
        this.speed = 250; // pixels per sec
        this.score = 0;
        
        // AI logic
        this.targetObj = null;
        this.aiWanderX = x;
        this.aiWanderY = y;
    }

    update(dt) {
        if (this.isPlayer) {
            // Smooth follow input
            let dx = INPUT.targetX - this.x;
            let dy = INPUT.targetY - this.y;
            let dist = Math.hypot(dx, dy);
            
            if (dist > 5) {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            }
        } else {
            // AI Movement
            this.aiUpdate(dt);
        }

        // Clamp to world
        this.x = Math.max(this.radius, Math.min(VIEW.worldWidth - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(VIEW.worldHeight - this.radius, this.y));

        // Smooth growth
        this.radius += (this.targetRadius - this.radius) * 5 * dt;
    }

    aiUpdate(dt) {
        // Simple AI: Find nearest edible object, or wander
        if (!this.targetObj || this.targetObj.eaten) {
            let nearest = null;
            let minDist = Infinity;
            for (let obj of objects) {
                if (!obj.eaten && this.radius > obj.type.reqSize) {
                    let d = Math.hypot(this.x - obj.x, this.y - obj.y);
                    if (d < minDist) {
                        minDist = d;
                        nearest = obj;
                    }
                }
            }
            if (nearest) {
                this.targetObj = nearest;
            } else {
                // Wander
                if (Math.hypot(this.x - this.aiWanderX, this.y - this.aiWanderY) < 50) {
                    this.aiWanderX = this.x + (Math.random() - 0.5) * 500;
                    this.aiWanderY = this.y + (Math.random() - 0.5) * 500;
                }
            }
        }

        let tx = this.targetObj ? this.targetObj.x : this.aiWanderX;
        let ty = this.targetObj ? this.targetObj.y : this.aiWanderY;
        
        let dx = tx - this.x;
        let dy = ty - this.y;
        let dist = Math.hypot(dx, dy);
        
        let aiSpeed = this.speed * 0.8; // slightly slower than player
        
        if (dist > 5) {
            this.x += (dx / dist) * aiSpeed * dt;
            this.y += (dy / dist) * aiSpeed * dt;
        }
    }

    grow(points) {
        this.score += points;
        if (this.isPlayer) {
            GAME_STATE.score = this.score;
            scoreEl.innerText = this.score;
            GAME_STATE.objectsEaten++;
            updateSizeProgress();
        }
        
        // Growth formula
        let expectedRadius = 25 + Math.sqrt(this.score) * 3;
        this.targetRadius = expectedRadius;
        
        // Decrease speed slightly as size increases
        this.speed = Math.max(150, 250 - (expectedRadius - 25) * 0.4);
    }
}

class GameObject {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.eaten = false;
        this.falling = false;
        this.fallTime = 0;
        this.scale = 1;
        this.rot = (Math.random() - 0.5) * Math.PI * 2; // Random rotation
        this.targetHole = null;
    }

    update(dt) {
        if (this.falling) {
            this.fallTime += dt;
            let progress = this.fallTime / 0.4; // 0.4s to fall
            if (progress >= 1) {
                this.eaten = true;
                this.targetHole.grow(this.type.points);
                createParticles(this.x, this.y, '#ffffff'); // Generic dust relative to emoji
                if (GAME_STATE.soundEnabled && this.targetHole.isPlayer) playEatSound();
            } else {
                // Suck into hole
                this.scale = 1 - progress;
                let dx = this.targetHole.x - this.x;
                let dy = this.targetHole.y - this.y;
                this.x += dx * dt * 5;
                this.y += dy * dt * 5;
                this.rot += dt * 10;
            }
        } else {
            // Check collisions with all holes
            for (let hole of holes) {
                if (hole.radius >= this.type.reqSize * 0.9) { // Relax the requirement slightly
                    let d = Math.hypot(hole.x - this.x, hole.y - this.y);
                    // Center of object is within hole radius
                    if (d < hole.radius) {
                        this.falling = true;
                        this.targetHole = hole;
                        break;
                    }
                }
            }
        }
    }

    draw(ctx) {
        if (this.eaten) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        ctx.scale(this.scale, this.scale);

        // Fast fake shadow for depth without expensive shadowBlur lag
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(0, this.type.rad * 0.4, this.type.rad * 0.8, this.type.rad * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw Object (Emoji)
        ctx.font = `${this.type.rad * 2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type.emoji, 0, 0);

        ctx.restore();
    }
}

function initGame() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Input Events
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    
    canvas.addEventListener('touchstart', onTouch, {passive: false});
    canvas.addEventListener('touchmove', onTouch, {passive: false});
    window.addEventListener('touchend', onPointerUp);

    // Button Events
    btnStart.addEventListener('click', () => startLevel(1));
    btnNext.addEventListener('click', () => startLevel(GAME_STATE.level + 1));
    btnRestart.addEventListener('click', () => startLevel(1));
    btnSound.addEventListener('click', toggleSound);

    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    VIEW.width = canvas.width;
    VIEW.height = canvas.height;
}

function bindPointer(cx, cy) {
    if (GAME_STATE.state !== 'PLAYING') return;
    
    // Convert screen coord to world coord
    // World is centered on player
    let player = holes[0];
    if (player) {
         INPUT.targetX = player.x + (cx - VIEW.width / 2);
         INPUT.targetY = player.y + (cy - VIEW.height / 2);
    }
}

function onPointerDown(e) { INPUT.isDown = true; bindPointer(e.clientX, e.clientY); }
function onPointerMove(e) { if (INPUT.isDown) bindPointer(e.clientX, e.clientY); }
function onPointerUp(e) { INPUT.isDown = false; }
function onTouch(e) { 
    e.preventDefault(); 
    INPUT.isDown = true; 
    bindPointer(e.touches[0].clientX, e.touches[0].clientY); 
}

function startLevel(lvl) {
    GAME_STATE.level = lvl;
    GAME_STATE.score = 0;
    GAME_STATE.objectsEaten = 0;
    GAME_STATE.maxTime = Math.max(60, 120 - lvl * 5); // Time scales
    GAME_STATE.time = GAME_STATE.maxTime;
    GAME_STATE.state = 'PLAYING';
    
    levelEl.innerText = lvl;
    scoreEl.innerText = '0';
    updateHUDTimer();
    updateSizeProgress();

    // Map size
    let mapIdx = Math.min(lvl - 1, MAP_SIZES.length - 1);
    VIEW.worldWidth = MAP_SIZES[mapIdx];
    VIEW.worldHeight = MAP_SIZES[mapIdx];

    holes = [new Hole(VIEW.worldWidth/2, VIEW.worldHeight/2, true)];
    
    // Add AI based on level
    let numAI = lvl >= 4 ? Math.min(5, lvl - 3) : 0;
    for(let i=0; i<numAI; i++) {
        holes.push(new Hole(
            Math.random() * VIEW.worldWidth, 
            Math.random() * VIEW.worldHeight, 
            false
        ));
    }
    
    INPUT.targetX = holes[0].x;
    INPUT.targetY = holes[0].y;
    INPUT.isDown = false;

    objects = [];
    particles = [];
    spawnObjects(lvl);

    // Flow config
    startMenu.classList.add('hidden');
    levelCompleteScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    GAME_STATE.lastTime = performance.now();
    
    if (GAME_STATE.soundEnabled) playBgMusic();
}

function spawnObjects(lvl) {
    let density = 0.0002; // Objects per sq pixel
    let area = VIEW.worldWidth * VIEW.worldHeight;
    let count = Math.floor(area * density);

    // Limit types by level
    let maxTypeIdx = Math.min(OBJ_TYPES.length - 1, 2 + Math.floor(lvl / 2));

    for (let i = 0; i < count; i++) {
        let type = OBJ_TYPES[Math.floor(Math.random() * (maxTypeIdx + 1))];
        let x = Math.random() * VIEW.worldWidth;
        let y = Math.random() * VIEW.worldHeight;
        
        // Prevent spawn inside player initially
        if (Math.hypot(x - VIEW.worldWidth/2, y - VIEW.worldHeight/2) > 100) {
            objects.push(new GameObject(x, y, type));
        }
    }
}

function updateSizeProgress() {
    let nextThreshold = holes[0] ? holes[0].targetRadius * 2 + 50 : 100;
    let percent = Math.min(100, (GAME_STATE.score / nextThreshold) * 100);
    sizeProgress.style.width = percent + '%';
}

function updateHUDTimer() {
    timeEl.innerText = Math.ceil(GAME_STATE.time);
    let progress = GAME_STATE.time / GAME_STATE.maxTime;
    let offset = 163 * (1 - progress);
    timerProgress.style.strokeDashoffset = offset;
    
    if (GAME_STATE.time <= 10) {
        timerProgress.parentElement.parentElement.classList.add('time-danger');
    } else {
        timerProgress.parentElement.parentElement.classList.remove('time-danger');
    }
}

function endLevel() {
    GAME_STATE.state = 'LEVEL_COMPLETE';
    document.getElementById('level-score').innerText = GAME_STATE.score;
    document.getElementById('level-size').innerText = Math.floor(holes[0].radius * 2) + "m";
    levelCompleteScreen.classList.remove('hidden');
    hud.classList.add('hidden');
    if (GAME_STATE.soundEnabled) playLevelUpSound();
}

function gameOver() {
    GAME_STATE.state = 'GAME_OVER';
    document.getElementById('final-score').innerText = GAME_STATE.score;
    let best = localStorage.getItem('hole_best_score') || 0;
    if (GAME_STATE.score > best) {
        best = GAME_STATE.score;
        localStorage.setItem('hole_best_score', best);
    }
    document.getElementById('best-score').innerText = best;
    gameOverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
}

function createParticles(x, y, color) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 0.5,
            color: color
        });
    }
}

function gameLoop(timestamp) {
    let dt = (timestamp - GAME_STATE.lastTime) / 1000;
    GAME_STATE.lastTime = timestamp;

    if (dt > 0.1) dt = 0.1; // Cap delta

    if (GAME_STATE.state === 'PLAYING') {
        // Update Time
        GAME_STATE.time -= dt;
        updateHUDTimer();

        if (GAME_STATE.time <= 0) {
            // Did they get a decent score?
            if (GAME_STATE.score > GAME_STATE.level * 100) {
                endLevel();
            } else {
                gameOver();
            }
        }

        // Update entities
        for (let hole of holes) hole.update(dt);
        
        objects = objects.filter(o => !o.eaten);
        for (let obj of objects) obj.update(dt);

        particles = particles.filter(p => p.life > 0);
        for (let p of particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
        }
    }

    render();
    requestAnimationFrame(gameLoop);
}

function render() {
    // Clear and draw bg
    ctx.fillStyle = '#2b2e3b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (GAME_STATE.state === 'MENU') return;

    let player = holes[0];
    if (!player) return;

    ctx.save();
    // Camera follow player
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // Draw Grid (Floor)
    ctx.strokeStyle = '#363946';
    ctx.lineWidth = 2;
    let gridSize = 100;
    let startX = Math.floor((player.x - canvas.width / 2) / gridSize) * gridSize;
    let startY = Math.floor((player.y - canvas.height / 2) / gridSize) * gridSize;
    let endX = startX + canvas.width + gridSize;
    let endY = startY + canvas.height + gridSize;
    
    // Bounds clamping for grid drawing
    startX = Math.max(0, startX);
    startY = Math.max(0, startY);
    endX = Math.min(VIEW.worldWidth, endX);
    endY = Math.min(VIEW.worldHeight, endY);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
        ctx.moveTo(x, startY); ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
        ctx.moveTo(startX, y); ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Map boundaries
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, VIEW.worldWidth, VIEW.worldHeight);

    // Draw Holes (as dark masks)
    for (let hole of holes) {
        // Outer glow
        let g = ctx.createRadialGradient(hole.x, hole.y, hole.radius*0.5, hole.x, hole.y, hole.radius*1.2);
        g.addColorStop(0, hole.isPlayer ? 'rgba(0, 229, 255, 0.8)' : 'rgba(255, 51, 102, 0.8)');
        g.addColorStop(1, 'transparent');
        
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, hole.radius * 1.5, 0, Math.PI*2);
        ctx.fill();

        // The black hole
        ctx.fillStyle = '#050505';
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI*2);
        ctx.fill();
        
        ctx.lineWidth = 4;
        ctx.strokeStyle = hole.isPlayer ? '#00e5ff' : '#ff3366';
        ctx.stroke();
    }

    // Sort objects by Y for pseudo-3D overlap (bottom objects drawn last)
    objects.sort((a, b) => a.y - b.y);
    for (let obj of objects) {
        // Viewport culling to vastly improve performance
        let dx = obj.x - player.x;
        let dy = obj.y - player.y;
        if (Math.abs(dx) > canvas.width / 2 + obj.type.rad * 2 ||
            Math.abs(dy) > canvas.height / 2 + obj.type.rad * 2) {
            continue;
        }
        obj.draw(ctx);
    }

    // Draw Particles
    for (let p of particles) {
        ctx.fillStyle = `rgba(${hexToRgb(p.color)}, ${p.life * 2})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.restore();
}

// Helpers
function hexToRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255,255,255';
}

function toggleSound() {
    GAME_STATE.soundEnabled = !GAME_STATE.soundEnabled;
    btnSound.innerText = GAME_STATE.soundEnabled ? '🔊' : '🔇';
}

// Simple Audio synth to ensure it has sounds w/o external assets
function playEatSound() {
    if (!window.AudioContext) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
}

function playLevelUpSound() {
    if (!window.AudioContext) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
    osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.1); // C#5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2); // E5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
}

function playBgMusic() {
    // Optionally trigger looping audio element if loaded, else skip.
}

// Start
initGame();
