/**
 * Blade Spin Arena - Core Logic
 */

// --- Audio Synthesizer ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

const soundEffects = {
    init: () => {
        if (!audioCtx) audioCtx = new AudioCtx();
    },
    playTone: (freq, type, duration, vol=0.1) => {
        if (!audioCtx || !gameState.soundEnabled) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },
    hit: () => soundEffects.playTone(150, 'square', 0.1, 0.1),
    destroy: () => {
        if (!audioCtx || !gameState.soundEnabled) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.3);
        
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    },
    powerup: () => {
        soundEffects.playTone(400, 'sine', 0.1, 0.1);
        setTimeout(() => soundEffects.playTone(600, 'sine', 0.2, 0.1), 100);
    },
    damage: () => {
        if (!audioCtx || !gameState.soundEnabled) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(50, audioCtx.currentTime);
        
        // Add a bit of distortion
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    },
    gameover: () => {
        soundEffects.playTone(300, 'sawtooth', 0.2, 0.2);
        setTimeout(() => soundEffects.playTone(250, 'sawtooth', 0.2, 0.2), 200);
        setTimeout(() => soundEffects.playTone(200, 'sawtooth', 0.6, 0.2), 400);
    }
};

// --- Asset Manager ---
const assets = {
    blade: new Image(),
    enemy: new Image(),
    loaded: 0,
    total: 2,
    processed: {
        blade: null,
        enemy: null
    }
};

assets.blade.src = 'assets/images/blade.png';
assets.enemy.src = 'assets/images/enemy.png';

// Function to remove black background from AI generated assets
function processTransparent(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        // If pixel is very dark (black background), make it transparent
        if (r < 20 && g < 20 && b < 20) {
            data[i+3] = 0; // Alpha to 0
        }
    }
    
    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

function checkLoad() {
    assets.loaded++;
    if (assets.loaded === assets.total) {
        assets.processed.blade = processTransparent(assets.blade);
        assets.processed.enemy = processTransparent(assets.enemy);
        console.log("Assets loaded and processed.");
    }
}
assets.blade.onload = checkLoad;
assets.enemy.onload = checkLoad;


// --- Game Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for speed

let cw, ch;
function resize() {
    cw = canvas.width = window.innerWidth;
    ch = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- Game State ---
const gameState = {
    active: false,
    paused: false,
    soundEnabled: true,
    score: 0,
    combo: 1,
    comboTimer: 0,
    bestScore: localStorage.getItem('bladeSpinBest') || 0,
    frame: 0
};

// --- Entities ---
const player = {
    x: cw/2,
    y: ch/2,
    radius: 40,
    baseRadius: 40,
    angle: 0,
    baseSpinSpeed: 0.1,
    spinSpeed: 0.1,
    health: 100,
    maxHealth: 100,
    targetX: cw/2,
    targetY: ch/2,
    
    // Upgrades
    shield: 0,
    multiHitTimer: 0,
    fastSpinTimer: 0
};

let enemies = [];
let particles = [];
let powerups = [];
let floatingTexts = [];

// --- Input Handling ---
let isPointerDown = false;

function handlePointerMove(e) {
    if (!gameState.active || gameState.paused) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    player.targetX = clientX;
    player.targetY = clientY;
}

window.addEventListener('mousemove', handlePointerMove);
window.addEventListener('touchmove', handlePointerMove, {passive: false});

// --- UI Elements ---
const ui = {
    startScreen: document.getElementById('start-screen'),
    instructionsScreen: document.getElementById('instructions-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    gameOverScreen: document.getElementById('game-over-screen'),
    uiLayer: document.getElementById('ui-layer'),
    score: document.getElementById('score'),
    combo: document.getElementById('combo'),
    comboContainer: document.getElementById('combo-container'),
    healthBar: document.getElementById('health-bar'),
    finalScore: document.getElementById('final-score-value'),
    bestScore: document.getElementById('best-score-value'),
    soundToggle: document.getElementById('sound-toggle')
};

// --- Classes ---

class Enemy {
    constructor() {
        this.radius = 20;
        // Spawn outside screen
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { this.x = Math.random() * cw; this.y = -50; } // Top
        else if (side === 1) { this.x = cw + 50; this.y = Math.random() * ch; } // Right
        else if (side === 2) { this.x = Math.random() * cw; this.y = ch + 50; } // Bottom
        else { this.x = -50; this.y = Math.random() * ch; } // Left

        this.speed = 1.5 + Math.random() * (1 + gameState.score / 1000); // Progressively faster
        this.hp = 1 + Math.floor(gameState.score / 2000);
        this.angle = 0;
        this.wobbleOffset = Math.random() * Math.PI * 2;
    }

    update() {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        this.angle = Math.atan2(dy, dx);
        
        // Add some wobble
        const wobble = Math.sin(gameState.frame * 0.1 + this.wobbleOffset) * 0.5;
        
        this.x += Math.cos(this.angle + wobble * 0.5) * this.speed;
        this.y += Math.sin(this.angle + wobble * 0.5) * this.speed;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        if (assets.processed.enemy) {
            ctx.drawImage(assets.processed.enemy, -this.radius*1.5, -this.radius*1.5, this.radius*3, this.radius*3);
        } else {
            // Fallback
            ctx.fillStyle = '#ff003c';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, type='spark') {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type; // spark, blast, text
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.02;
        this.size = Math.random() * 3 + 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.size *= 0.95;
    }

    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        const types = ['heal', 'shield', 'spin', 'multi'];
        this.type = types[Math.floor(Math.random() * types.length)];
        this.life = 600; // 10 seconds at 60fps
        this.floatY = 0;
    }

    update() {
        this.life--;
        this.floatY = Math.sin(this.life * 0.1) * 5;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y + this.floatY);
        
        let color = '#ffffff';
        if (this.type === 'heal') color = '#00ff88';
        else if (this.type === 'shield') color = '#00f3ff';
        else if (this.type === 'spin') color = '#ff00ea';
        else if (this.type === 'multi') color = '#ffd700';

        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '12px Orbitron';
        let icon = 'H';
        if (this.type === 'shield') icon = 'S';
        else if (this.type === 'spin') icon = '⚡';
        else if (this.type === 'multi') icon = 'M';
        ctx.fillText(icon, 0, 0);

        ctx.restore();
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.vy = -1;
    }
    update() {
        this.y += this.vy;
        this.life -= 0.02;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 20px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

// --- Game Logic ---

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateHUD() {
    ui.score.innerText = gameState.score;
    
    if (gameState.combo > 1) {
        ui.comboContainer.style.opacity = 1;
        ui.combo.innerText = `x${gameState.combo}`;
    } else {
        ui.comboContainer.style.opacity = 0;
    }

    const hpPercent = Math.max(0, (player.health / player.maxHealth) * 100);
    ui.healthBar.style.width = `${hpPercent}%`;
    
    if (hpPercent < 30) {
        ui.healthBar.classList.add('low');
    } else {
        ui.healthBar.classList.remove('low');
    }
}

function addScore(points) {
    gameState.score += points * gameState.combo;
    gameState.combo++;
    gameState.comboTimer = 180; // 3 seconds to keep combo
    
    ui.comboContainer.classList.remove('combo-pulse');
    void ui.comboContainer.offsetWidth; // trigger reflow
    ui.comboContainer.classList.add('combo-pulse');
    
    updateHUD();
}

function takeDamage(amount) {
    if (player.shield > 0) {
        player.shield -= amount;
        createParticles(player.x, player.y, '#00f3ff', 20);
        soundEffects.hit();
        if (player.shield < 0) {
            player.health += player.shield; // remaining damage
            player.shield = 0;
        }
    } else {
        player.health -= amount;
        createParticles(player.x, player.y, '#ff003c', 30);
        soundEffects.damage();
        
        // Screen shake effect could be added here
        
        if (player.health <= 0) {
            gameOver();
        }
    }
    gameState.combo = 1;
    updateHUD();
}

function spawnEnemy() {
    if (Math.random() < 0.03 + (gameState.score / 100000)) {
        enemies.push(new Enemy());
    }
}

function applyPowerup(type) {
    soundEffects.powerup();
    if (type === 'heal') {
        player.health = Math.min(player.maxHealth, player.health + 30);
        floatingTexts.push(new FloatingText(player.x, player.y - 30, '+30 HP', '#00ff88'));
    } else if (type === 'shield') {
        player.shield = 50;
        floatingTexts.push(new FloatingText(player.x, player.y - 30, 'SHIELD', '#00f3ff'));
    } else if (type === 'spin') {
        player.fastSpinTimer = 300; // 5 seconds
        floatingTexts.push(new FloatingText(player.x, player.y - 30, 'SPEED UP', '#ff00ea'));
    } else if (type === 'multi') {
        player.multiHitTimer = 300; // 5 seconds
        floatingTexts.push(new FloatingText(player.x, player.y - 30, 'MULTI HIT', '#ffd700'));
    }
    updateHUD();
}

function update() {
    if (!gameState.active || gameState.paused) return;
    gameState.frame++;

    // Combo logic
    if (gameState.comboTimer > 0) {
        gameState.comboTimer--;
        if (gameState.comboTimer <= 0) {
            gameState.combo = 1;
            updateHUD();
        }
    }

    // Player movement (smooth follow)
    player.x += (player.targetX - player.x) * 0.1;
    player.y += (player.targetY - player.y) * 0.1;

    // Player modifiers
    let currentSpinSpeed = player.baseSpinSpeed;
    if (player.fastSpinTimer > 0) {
        player.fastSpinTimer--;
        currentSpinSpeed *= 2;
    }
    
    if (player.multiHitTimer > 0) {
        player.multiHitTimer--;
        player.radius = player.baseRadius * 1.5;
    } else {
        player.radius = player.baseRadius;
    }

    player.angle += currentSpinSpeed;

    spawnEnemy();

    // Update Enemies & Collisions
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.update();

        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // Core collision (Enemy hits player center)
        if (dist < e.radius + 10) {
            takeDamage(10);
            enemies.splice(i, 1);
            continue;
        }

        // Blade edge collision
        if (dist < e.radius + player.radius) {
            e.hp--;
            soundEffects.hit();
            createParticles(e.x, e.y, '#ff00ea', 5);
            
            // Knockback
            e.x += (dx / dist) * 20;
            e.y += (dy / dist) * 20;

            if (e.hp <= 0) {
                soundEffects.destroy();
                createParticles(e.x, e.y, '#ff00ea', 15);
                addScore(100);
                
                // Drop powerup chance
                if (Math.random() < 0.05) {
                    powerups.push(new PowerUp(e.x, e.y));
                }
                
                enemies.splice(i, 1);
            }
        }
    }

    // Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.update();
        
        const dx = p.x - player.x;
        const dy = p.y - player.y;
        if (Math.sqrt(dx*dx + dy*dy) < player.radius + p.radius) {
            applyPowerup(p.type);
            powerups.splice(i, 1);
        } else if (p.life <= 0) {
            powerups.splice(i, 1);
        }
    }

    // Particles & Texts
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].update();
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
}

function draw() {
    // Fill background with semi-transparent black for motion blur
    ctx.fillStyle = 'rgba(5, 5, 16, 0.4)';
    ctx.fillRect(0, 0, cw, ch);

    if (!gameState.active) return;

    // Draw Powerups
    for (const p of powerups) p.draw(ctx);

    // Draw Enemies
    for (const e of enemies) e.draw(ctx);

    // Draw Player
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Draw Shield
    if (player.shield > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 15, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(0, 243, 255, ${0.5 + Math.sin(gameState.frame*0.1)*0.2})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    ctx.rotate(player.angle);
    
    // Multi-hit visual
    if (player.multiHitTimer > 0) {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 20;
    } else {
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 15;
    }

    if (assets.processed.blade) {
        ctx.drawImage(assets.processed.blade, -player.radius, -player.radius, player.radius*2, player.radius*2);
    } else {
        // Fallback drawing
        ctx.fillStyle = '#00f3ff';
        ctx.beginPath();
        ctx.moveTo(0, -player.radius);
        ctx.lineTo(10, -10);
        ctx.lineTo(player.radius, 0);
        ctx.lineTo(10, 10);
        ctx.lineTo(0, player.radius);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-player.radius, 0);
        ctx.lineTo(-10, -10);
        ctx.fill();
    }
    ctx.restore();

    // Draw Particles & Texts
    for (const p of particles) p.draw(ctx);
    for (const t of floatingTexts) t.draw(ctx);
}

function loop() {
    requestAnimationFrame(loop);
    update();
    draw();
}

// --- Flow Control ---

function resetGame() {
    player.x = cw/2;
    player.y = ch/2;
    player.targetX = cw/2;
    player.targetY = ch/2;
    player.health = 100;
    player.shield = 0;
    player.fastSpinTimer = 0;
    player.multiHitTimer = 0;
    
    enemies = [];
    particles = [];
    powerups = [];
    floatingTexts = [];
    
    gameState.score = 0;
    gameState.combo = 1;
    gameState.comboTimer = 0;
    gameState.frame = 0;
    
    updateHUD();
}

function startGame() {
    soundEffects.init();
    resetGame();
    gameState.active = true;
    gameState.paused = false;
    
    ui.startScreen.classList.remove('active');
    ui.gameOverScreen.classList.remove('active');
    ui.pauseScreen.classList.remove('active');
    ui.uiLayer.style.display = 'block';
}

function gameOver() {
    gameState.active = false;
    soundEffects.gameover();
    
    if (gameState.score > gameState.bestScore) {
        gameState.bestScore = gameState.score;
        localStorage.setItem('bladeSpinBest', gameState.bestScore);
    }
    
    ui.finalScore.innerText = gameState.score;
    ui.bestScore.innerText = gameState.bestScore;
    
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

// --- Event Listeners ---

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);

document.getElementById('instructions-btn').addEventListener('click', () => {
    soundEffects.init();
    ui.startScreen.classList.remove('active');
    ui.instructionsScreen.classList.add('active');
});

document.getElementById('back-btn').addEventListener('click', () => {
    ui.instructionsScreen.classList.remove('active');
    ui.startScreen.classList.add('active');
});

ui.soundToggle.addEventListener('click', () => {
    soundEffects.init();
    gameState.soundEnabled = !gameState.soundEnabled;
    ui.soundToggle.innerText = gameState.soundEnabled ? '🔊' : '🔇';
});

document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('resume-btn').addEventListener('click', togglePause);

document.getElementById('quit-btn').addEventListener('click', () => {
    gameState.active = false;
    ui.pauseScreen.classList.remove('active');
    ui.uiLayer.style.display = 'none';
    ui.startScreen.classList.add('active');
});

// Start loop
requestAnimationFrame(loop);
