/**
 * Gravity Switch Run - Core Logic
 */

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

const sfx = {
    init: () => { if (!audioCtx) audioCtx = new AudioCtx(); },
    play: (type) => {
        if (!audioCtx || !gameState.soundEnabled) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        
        if (type === 'flip') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'die') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'levelUp') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.setValueAtTime(400, now + 0.1);
            osc.frequency.setValueAtTime(600, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        }
    }
};

const assets = {
    char: new Image(),
    trap: new Image(),
    loaded: 0,
    total: 2,
    processed: { char: null, trap: null }
};

assets.char.src = 'assets/images/character.png';
assets.trap.src = 'assets/images/trap.png';

function processTransparent(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 30 && data[i+1] < 30 && data[i+2] < 30) {
            data[i+3] = 0;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

function checkLoad() {
    assets.loaded++;
    if (assets.loaded === assets.total) {
        assets.processed.char = processTransparent(assets.char);
        assets.processed.trap = processTransparent(assets.trap);
    }
}
assets.char.onload = checkLoad;
assets.trap.onload = checkLoad;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
let cw, ch;

// Game constants
const PLATFORM_HEIGHT = 40;
const FLOOR_Y = () => ch - PLATFORM_HEIGHT;
const CEIL_Y = () => PLATFORM_HEIGHT;

function resize() {
    cw = canvas.width = window.innerWidth;
    ch = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const gameState = {
    active: false,
    paused: false,
    soundEnabled: true,
    distance: 0,
    speed: 6,
    baseSpeed: 6,
    level: 1,
    bestDist: localStorage.getItem('gravityRunBest') || 0,
    particles: [],
    trails: [],
    platforms: [],
    obstacles: []
};

const player = {
    x: 100,
    y: 0,
    width: 40,
    height: 60,
    vy: 0,
    gravity: 0.8,
    isFlipped: false, // false = on floor, true = on ceiling
    rotation: 0, // visual rotation
    state: 'running' // running, jumping, dead
};

const ui = {
    startScreen: document.getElementById('start-screen'),
    instructionsScreen: document.getElementById('instructions-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    gameOverScreen: document.getElementById('game-over-screen'),
    uiLayer: document.getElementById('ui-layer'),
    score: document.getElementById('score'),
    level: document.getElementById('level-display'),
    speed: document.getElementById('speed-display'),
    finalScore: document.getElementById('final-score-value'),
    bestScore: document.getElementById('best-score-value'),
    soundToggle: document.getElementById('sound-toggle')
};

// --- Level Generation ---

class Platform {
    constructor(x, y, w, isTop) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = PLATFORM_HEIGHT;
        this.isTop = isTop;
    }
    update() { this.x -= gameState.speed; }
    draw(ctx) {
        ctx.fillStyle = '#050015';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        
        // Neon edge
        ctx.fillStyle = this.isTop ? '#7b00ff' : '#00ffcc';
        if (this.isTop) {
            ctx.fillRect(this.x, this.y + this.h - 3, this.w, 3);
        } else {
            ctx.fillRect(this.x, this.y, this.w, 3);
        }
    }
}

class Obstacle {
    constructor(x, y, isTop) {
        this.x = x;
        this.y = y;
        this.w = 30;
        this.h = 40;
        this.isTop = isTop;
    }
    update() { this.x -= gameState.speed; }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.w/2, this.y + (this.isTop ? 0 : this.h));
        if (this.isTop) ctx.scale(1, -1);
        
        if (assets.processed.trap) {
            ctx.drawImage(assets.processed.trap, -this.w/2, -this.h, this.w, this.h);
        } else {
            ctx.fillStyle = '#ff0055';
            ctx.beginPath();
            ctx.moveTo(-this.w/2, 0);
            ctx.lineTo(0, -this.h);
            ctx.lineTo(this.w/2, 0);
            ctx.fill();
        }
        ctx.restore();
    }
}

function generateLevelChunk() {
    let lastX = gameState.platforms.length > 0 ? 
        gameState.platforms[gameState.platforms.length-1].x + gameState.platforms[gameState.platforms.length-1].w : 0;
    
    // Generate until we have enough ahead
    while (lastX < cw + 1000) {
        const gap = Math.random() < 0.3 ? Math.random() * 200 + 100 : 0; // Gap between platforms
        lastX += gap;
        
        const platWidth = Math.random() * 500 + 300;
        
        // Bottom platform
        if (Math.random() > 0.2 || gap === 0) {
            gameState.platforms.push(new Platform(lastX, FLOOR_Y(), platWidth, false));
            // Add obstacle
            if (Math.random() < 0.4 && platWidth > 200) {
                gameState.obstacles.push(new Obstacle(lastX + platWidth/2, FLOOR_Y() - 40, false));
            }
        }
        
        // Top platform
        if (Math.random() > 0.2 || gap === 0) {
            gameState.platforms.push(new Platform(lastX, 0, platWidth, true));
            // Add obstacle
            if (Math.random() < 0.4 && platWidth > 200) {
                gameState.obstacles.push(new Obstacle(lastX + platWidth/2, PLATFORM_HEIGHT, true));
            }
        }
        
        lastX += platWidth;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life -= 0.05;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.globalAlpha = 1.0;
    }
}

// --- Logic ---

function flipGravity() {
    if (!gameState.active || gameState.paused || player.state === 'dead') return;
    
    // Only allow flip if we are touching a platform
    if (player.state === 'jumping') return; 

    sfx.play('flip');
    player.isFlipped = !player.isFlipped;
    player.state = 'jumping';
    
    // Add flip particles
    for(let i=0; i<10; i++) {
        gameState.particles.push(new Particle(player.x + player.width/2, player.isFlipped ? FLOOR_Y() : CEIL_Y(), '#7b00ff'));
    }
}

document.addEventListener('mousedown', flipGravity);
document.addEventListener('touchstart', flipGravity, {passive: false});

function update() {
    if (!gameState.active || gameState.paused) return;

    // Progression
    gameState.distance += gameState.speed * 0.01;
    ui.score.innerText = Math.floor(gameState.distance);
    
    if (Math.floor(gameState.distance / 100) > gameState.level - 1) {
        gameState.level++;
        gameState.speed = gameState.baseSpeed + (gameState.level * 0.5);
        ui.level.innerText = gameState.level;
        ui.speed.innerText = (gameState.speed / gameState.baseSpeed).toFixed(1) + 'x';
        sfx.play('levelUp');
    }

    // Player physics
    if (player.state !== 'dead') {
        if (player.isFlipped) {
            player.vy -= player.gravity; // fall up
        } else {
            player.vy += player.gravity; // fall down
        }
        player.y += player.vy;

        // Rotation animation
        const targetRot = player.isFlipped ? Math.PI : 0;
        player.rotation += (targetRot - player.rotation) * 0.2;

        // Trail effect
        if (Math.random() < 0.3) {
            gameState.trails.push({
                x: player.x, y: player.y, rot: player.rotation, life: 0.5
            });
        }
    }

    // Platform collisions
    let touchingPlatform = false;
    
    for (let i = 0; i < gameState.platforms.length; i++) {
        const p = gameState.platforms[i];
        p.update();
        
        // AABB Collision loosely
        if (player.x < p.x + p.w && player.x + player.width > p.x) {
            if (!p.isTop && !player.isFlipped && player.y + player.height >= p.y && player.vy >= 0) {
                player.y = p.y - player.height;
                player.vy = 0;
                player.state = 'running';
                touchingPlatform = true;
            } else if (p.isTop && player.isFlipped && player.y <= p.y + p.h && player.vy <= 0) {
                player.y = p.y + p.h;
                player.vy = 0;
                player.state = 'running';
                touchingPlatform = true;
            }
        }
    }

    // Death by falling
    if (player.y > ch + 100 || player.y < -100) {
        die();
    }

    // If not touching platform, we are falling
    if (!touchingPlatform && player.state === 'running') {
        player.state = 'jumping'; // fall off edge
    }

    // Obstacle collisions
    for (let i = 0; i < gameState.obstacles.length; i++) {
        const obs = gameState.obstacles[i];
        obs.update();
        
        // Simple circle-based collision for spikes
        const px = player.x + player.width/2;
        const py = player.y + player.height/2;
        const ox = obs.x + obs.w/2;
        const oy = obs.isTop ? obs.y + obs.h/2 : obs.y + obs.h/2 - 10;
        
        const dist = Math.hypot(px - ox, py - oy);
        if (dist < 25) {
            die();
        }
    }

    // Cleanup offscreen objects
    gameState.platforms = gameState.platforms.filter(p => p.x + p.w > -100);
    gameState.obstacles = gameState.obstacles.filter(o => o.x + o.w > -100);
    generateLevelChunk();

    // Particles & trails
    gameState.particles.forEach(p => p.update());
    gameState.particles = gameState.particles.filter(p => p.life > 0);
    
    gameState.trails.forEach(t => {
        t.x -= gameState.speed;
        t.life -= 0.05;
    });
    gameState.trails = gameState.trails.filter(t => t.life > 0);
}

function die() {
    if (player.state === 'dead') return;
    player.state = 'dead';
    sfx.play('die');
    
    // Death explosion
    for(let i=0; i<30; i++) {
        gameState.particles.push(new Particle(player.x + player.width/2, player.y + player.height/2, '#00ffcc'));
        gameState.particles.push(new Particle(player.x + player.width/2, player.y + player.height/2, '#ff0055'));
    }
    
    setTimeout(() => {
        gameOver();
    }, 1000);
}

function draw() {
    // Clear and draw grid background
    ctx.fillStyle = '#020205';
    ctx.fillRect(0, 0, cw, ch);
    
    // Speed lines background
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.05)';
    ctx.beginPath();
    const offset = (gameState.distance * 10) % 100;
    for(let y=0; y<ch; y+=40) {
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
    }
    for(let x=-offset; x<cw; x+=100) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + ch/2, ch);
    }
    ctx.stroke();

    // Draw Trails
    gameState.trails.forEach(t => {
        ctx.save();
        ctx.translate(t.x + player.width/2, t.y + player.height/2);
        ctx.rotate(t.rot);
        ctx.globalAlpha = t.life;
        if (assets.processed.char) {
            ctx.drawImage(assets.processed.char, -player.width/2, -player.height/2, player.width, player.height);
        } else {
            ctx.fillStyle = '#00ffcc';
            ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);
        }
        ctx.restore();
    });

    // Draw Platforms
    gameState.platforms.forEach(p => p.draw(ctx));
    
    // Draw Obstacles
    gameState.obstacles.forEach(o => o.draw(ctx));

    // Draw Player
    if (player.state !== 'dead') {
        ctx.save();
        ctx.translate(player.x + player.width/2, player.y + player.height/2);
        ctx.rotate(player.rotation);
        
        if (assets.processed.char) {
            ctx.drawImage(assets.processed.char, -player.width/2, -player.height/2, player.width, player.height);
        } else {
            ctx.fillStyle = '#00ffcc';
            ctx.shadowColor = '#00ffcc';
            ctx.shadowBlur = 10;
            ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);
        }
        ctx.restore();
    }

    // Draw Particles
    gameState.particles.forEach(p => p.draw(ctx));
}

function loop() {
    requestAnimationFrame(loop);
    update();
    draw();
}

function initGame() {
    player.y = FLOOR_Y() - player.height;
    player.vy = 0;
    player.isFlipped = false;
    player.rotation = 0;
    player.state = 'running';
    
    gameState.distance = 0;
    gameState.speed = gameState.baseSpeed;
    gameState.level = 1;
    gameState.platforms = [];
    gameState.obstacles = [];
    gameState.particles = [];
    gameState.trails = [];
    
    ui.level.innerText = '1';
    ui.speed.innerText = '1.0x';
    
    // Initial platforms
    gameState.platforms.push(new Platform(0, FLOOR_Y(), cw + 200, false));
    gameState.platforms.push(new Platform(0, 0, cw + 200, true));
    
    generateLevelChunk();
}

function startGame() {
    sfx.init();
    initGame();
    gameState.active = true;
    gameState.paused = false;
    
    ui.startScreen.classList.remove('active');
    ui.gameOverScreen.classList.remove('active');
    ui.pauseScreen.classList.remove('active');
    ui.uiLayer.style.display = 'block';
}

function gameOver() {
    gameState.active = false;
    const dist = Math.floor(gameState.distance);
    if (dist > gameState.bestDist) {
        gameState.bestDist = dist;
        localStorage.setItem('gravityRunBest', gameState.bestDist);
    }
    
    ui.finalScore.innerText = dist;
    ui.bestScore.innerText = gameState.bestDist;
    
    ui.uiLayer.style.display = 'none';
    ui.gameOverScreen.classList.add('active');
}

function togglePause() {
    if (!gameState.active) return;
    gameState.paused = !gameState.paused;
    if (gameState.paused) {
        ui.pauseScreen.classList.add('active');
    } else {
        ui.pauseScreen.classList.remove('active');
    }
}

// UI Listeners
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('instructions-btn').addEventListener('click', () => {
    sfx.init();
    ui.startScreen.classList.remove('active');
    ui.instructionsScreen.classList.add('active');
});
document.getElementById('back-btn').addEventListener('click', () => {
    ui.instructionsScreen.classList.remove('active');
    ui.startScreen.classList.add('active');
});
ui.soundToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    sfx.init();
    gameState.soundEnabled = !gameState.soundEnabled;
    ui.soundToggle.innerText = gameState.soundEnabled ? '🔊' : '🔇';
});
document.getElementById('pause-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause();
});
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('quit-btn').addEventListener('click', () => {
    gameState.active = false;
    ui.pauseScreen.classList.remove('active');
    ui.uiLayer.style.display = 'none';
    ui.startScreen.classList.add('active');
});

requestAnimationFrame(loop);
