// Planet Defense Orbit - Game Logic

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimize drawing

// UI Elements
const uiMainMenu = document.getElementById('main-menu');
const uiTutorial = document.getElementById('tutorial-screen');
const uiGameHud = document.getElementById('game-hud');
const uiUpgradeMenu = document.getElementById('upgrade-menu');
const uiGameOver = document.getElementById('game-over-menu');
const uiWaveAnnouncer = document.getElementById('wave-announcer');

const healthBarFill = document.getElementById('health-bar-fill');
const waveDisplay = document.getElementById('wave-display');
const scoreDisplay = document.getElementById('score-display');
const energyDisplay = document.getElementById('energy-display');
const upgEnergyDisplay = document.getElementById('upgrade-energy-display');
const finalWaveDisplay = document.getElementById('final-wave');
const finalScoreDisplay = document.getElementById('final-score');
const announceText = document.getElementById('announce-text');

// Audio System (Web Audio API)
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let soundEnabled = true;

const sounds = {
    shoot: () => playTone('square', 400, 100, 0.1, 0.1, -1000),
    hit: () => playNoise(0.1, 0.2),
    explosion: () => playNoise(0.3, 0.5),
    upgrade: () => { playTone('sine', 400, 100, 0.1); setTimeout(() => playTone('sine', 600, 200, 0.1), 100); },
    error: () => playTone('sawtooth', 150, 200, 0.1),
    waveStart: () => { playTone('sine', 220, 500, 0.2); setTimeout(() => playTone('sine', 440, 800, 0.2), 500); }
};

function playTone(type, freq, duration, vol, sweep = 0) {
    if (!soundEnabled) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (sweep !== 0) {
        osc.frequency.linearRampToValueAtTime(Math.max(10, freq + sweep), audioCtx.currentTime + duration/1000);
    }
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration/1000);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration/1000);
}

function playNoise(duration, vol) {
    if (!soundEnabled) return;
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = audioCtx.createGain();
    
    // Lowpass filter for explosion thud
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
}

// Game State
let gameState = 'menu'; // menu, tutorial, playing, upgrade, gameover
let lastTime = 0;
let shakeAmount = 0;

const game = {
    width: window.innerWidth,
    height: window.innerHeight,
    cx: window.innerWidth / 2,
    cy: window.innerHeight / 2,
    score: 0,
    energy: 0,
    wave: 1,
    planetMaxHealth: 1000,
    planetHealth: 1000,
    rotationSpeed: 0,
    targetRotationSpeed: 0,
    rotationAccel: 0.002,
    maxRotationSpeed: 0.05,
    orbitAngle: 0,
    time: 0,
    stars: []
};

// Entities
let weapons = [];
let enemies = [];
let particles = [];
let projectiles = [];

// Upgrades State
const upgrades = {
    damage: { level: 1, max: 10, costBase: 50, mult: 1.5 },
    firerate: { level: 1, max: 10, costBase: 75, mult: 1.5 },
    speed: { level: 1, max: 5, costBase: 100, mult: 2 },
    newweapon: { level: 1, max: 4, costBase: 250, mult: 2.5 } // Starts with 1, max 4
};

// Initialize Stars
function initStars() {
    game.stars = [];
    for (let i = 0; i < 200; i++) {
        game.stars.push({
            x: Math.random() * game.width,
            y: Math.random() * game.height,
            r: Math.random() * 2,
            alpha: Math.random(),
            speed: Math.random() * 0.05
        });
    }
}

// Resize handler
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    game.width = canvas.width;
    game.height = canvas.height;
    game.cx = game.width / 2;
    game.cy = game.height / 2;
    if (gameState === 'menu') initStars();
});
window.dispatchEvent(new Event('resize'));

// Input Handling
const keys = { a: false, d: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

// Touch controls for mobile
let touchingLeft = false;
let touchingRight = false;
window.addEventListener('touchstart', (e) => {
    if (gameState !== 'playing') return;
    for (let i = 0; i < e.touches.length; i++) {
        const x = e.touches[i].clientX;
        if (x < game.width / 2) touchingLeft = true;
        else touchingRight = true;
    }
});
window.addEventListener('touchend', (e) => {
    touchingLeft = false;
    touchingRight = false;
    for (let i = 0; i < e.touches.length; i++) {
        const x = e.touches[i].clientX;
        if (x < game.width / 2) touchingLeft = true;
        else touchingRight = true;
    }
});

// Setup Initial Game
function initGame() {
    game.score = 0;
    game.energy = 0;
    game.wave = 1;
    game.planetHealth = game.planetMaxHealth;
    game.orbitAngle = 0;
    game.rotationSpeed = 0;
    game.targetRotationSpeed = 0;
    
    // Reset upgrades
    for (let key in upgrades) upgrades[key].level = 1;
    
    weapons = [];
    enemies = [];
    particles = [];
    projectiles = [];
    
    // Add first weapon
    addWeapon();
    
    updateHUD();
    startWave();
}

function addWeapon() {
    weapons.push({
        angleOffset: 0, // Will be recalculated
        radius: 120,
        fireCooldown: 0,
        type: 'laser'
    });
    // Recalculate offsets
    const step = (Math.PI * 2) / weapons.length;
    weapons.forEach((w, i) => w.angleOffset = step * i);
}

// Wave System
let waveActive = false;
let enemiesToSpawn = 0;
let spawnTimer = 0;

function startWave() {
    waveActive = true;
    enemiesToSpawn = 10 + (game.wave * 5);
    spawnTimer = 500; // start spawning quickly
    
    uiWaveAnnouncer.classList.remove('hidden');
    announceText.innerText = `WAVE ${game.wave}`;
    announceText.style.animation = 'none';
    void announceText.offsetWidth; // trigger reflow
    announceText.style.animation = 'pulseWave 2s ease-in-out forwards';
    sounds.waveStart();
    
    setTimeout(() => {
        uiWaveAnnouncer.classList.add('hidden');
    }, 2000);
}

function spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.max(game.width, game.height) * 0.6 + 100;
    
    // Enemy types based on wave
    const types = ['basic'];
    if (game.wave > 2) types.push('fast');
    if (game.wave > 4) types.push('heavy');
    
    const type = types[Math.floor(Math.random() * types.length)];
    
    let hp = 30 + (game.wave * 10);
    let speed = 1.0 + (game.wave * 0.1);
    let radius = 15;
    let color = '#ff0055';
    let reward = 10;
    
    if (type === 'fast') {
        speed *= 1.8; hp *= 0.5; radius = 10; color = '#ffff00'; reward = 15;
    } else if (type === 'heavy') {
        speed *= 0.6; hp *= 3; radius = 25; color = '#ff5500'; reward = 25;
    }
    
    enemies.push({
        x: game.cx + Math.cos(angle) * distance,
        y: game.cy + Math.sin(angle) * distance,
        hp: hp,
        maxHp: hp,
        speed: speed,
        radius: radius,
        color: color,
        type: type,
        reward: reward
    });
}

// Math utils
function dist(x1, y1, x2, y2) { return Math.hypot(x2-x1, y2-y1); }

// Update Loop
function update(dt) {
    game.time += dt;

    if (gameState !== 'playing') return;

    // Shake
    if (shakeAmount > 0) shakeAmount *= 0.9;

    // Controls
    let inputDir = 0;
    if (keys.a || keys.ArrowLeft || touchingLeft) inputDir = -1;
    if (keys.d || keys.ArrowRight || touchingRight) inputDir = 1;

    let currentMaxSpeed = game.maxRotationSpeed * (1 + (upgrades.speed.level - 1) * 0.2);
    
    if (inputDir !== 0) {
        game.targetRotationSpeed = inputDir * currentMaxSpeed;
    } else {
        game.targetRotationSpeed = 0; // friction
    }

    // Apply acceleration
    if (game.rotationSpeed < game.targetRotationSpeed) {
        game.rotationSpeed += game.rotationAccel * dt;
        if (game.rotationSpeed > game.targetRotationSpeed) game.rotationSpeed = game.targetRotationSpeed;
    } else if (game.rotationSpeed > game.targetRotationSpeed) {
        game.rotationSpeed -= game.rotationAccel * dt;
        if (game.rotationSpeed < game.targetRotationSpeed) game.rotationSpeed = game.targetRotationSpeed;
    }

    game.orbitAngle += game.rotationSpeed * dt * 0.1;

    // Weapons logic
    let fireRateMult = 1 + (upgrades.firerate.level - 1) * 0.2;
    let baseFireCooldown = 500 / fireRateMult;
    let damage = 20 * (1 + (upgrades.damage.level - 1) * 0.5);

    weapons.forEach(w => {
        w.fireCooldown -= dt;
        let wx = game.cx + Math.cos(game.orbitAngle + w.angleOffset) * w.radius;
        let wy = game.cy + Math.sin(game.orbitAngle + w.angleOffset) * w.radius;
        
        // Find closest enemy
        let closestDist = Infinity;
        let target = null;
        enemies.forEach(e => {
            let d = dist(wx, wy, e.x, e.y);
            if (d < 800 && d < closestDist) {
                closestDist = d;
                target = e;
            }
        });

        if (target && w.fireCooldown <= 0) {
            w.fireCooldown = baseFireCooldown;
            sounds.shoot();
            
            // Aim angle
            let angle = Math.atan2(target.y - wy, target.x - wx);
            
            projectiles.push({
                x: wx, y: wy,
                vx: Math.cos(angle) * 10,
                vy: Math.sin(angle) * 10,
                damage: damage,
                life: 1000
            });
            
            // Muzzle flash particle
            createParticles(wx, wy, 3, '#00f3ff', 5);
        }
    });

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt;
        
        if (p.life <= 0) {
            projectiles.splice(i, 1);
            continue;
        }

        // Collision with enemies
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (dist(p.x, p.y, e.x, e.y) < e.radius + 5) {
                hit = true;
                e.hp -= p.damage;
                sounds.hit();
                createParticles(p.x, p.y, 5, '#00f3ff', 3);
                
                if (e.hp <= 0) {
                    game.score += e.reward;
                    game.energy += e.reward;
                    sounds.explosion();
                    createParticles(e.x, e.y, 15, e.color, 8);
                    enemies.splice(j, 1);
                    updateHUD();
                }
                break;
            }
        }
        if (hit) projectiles.splice(i, 1);
    }

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        let angleToPlanet = Math.atan2(game.cy - e.y, game.cx - e.x);
        e.x += Math.cos(angleToPlanet) * e.speed;
        e.y += Math.sin(angleToPlanet) * e.speed;
        
        // Planet collision
        let distToPlanet = dist(e.x, e.y, game.cx, game.cy);
        if (distToPlanet < 60 + e.radius) { // Planet radius roughly 60
            game.planetHealth -= e.maxHp;
            shakeAmount = 15;
            sounds.explosion();
            createParticles(e.x, e.y, 20, '#ff3366', 10);
            enemies.splice(i, 1);
            updateHUD();
            
            if (game.planetHealth <= 0) {
                gameOver();
            }
        }
    }

    // Wave Spawning
    if (waveActive) {
        spawnTimer -= dt;
        if (spawnTimer <= 0 && enemiesToSpawn > 0) {
            spawnEnemy();
            enemiesToSpawn--;
            spawnTimer = 800 - (game.wave * 20); // Faster spawn later
            if (spawnTimer < 200) spawnTimer = 200;
        }
        
        if (enemiesToSpawn <= 0 && enemies.length === 0) {
            waveActive = false;
            game.wave++;
            updateHUD();
            // Delay next wave slightly
            setTimeout(() => { if (gameState === 'playing') startWave(); }, 3000);
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt;
        p.alpha = p.life / p.maxLife;
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    // Background Stars
    game.stars.forEach(s => {
        s.y += s.speed * dt;
        if (s.y > game.height) s.y = 0;
    });
}

function createParticles(x, y, amount, color, speed) {
    for (let i = 0; i < amount; i++) {
        let angle = Math.random() * Math.PI * 2;
        let v = Math.random() * speed;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * v,
            vy: Math.sin(angle) * v,
            life: 500 + Math.random() * 500,
            maxLife: 1000,
            color: color,
            size: 2 + Math.random() * 3
        });
    }
}

// Render Loop
function render() {
    ctx.fillStyle = 'rgba(5, 5, 16, 1)';
    ctx.fillRect(0, 0, game.width, game.height);
    
    ctx.save();
    
    // Camera shake
    if (shakeAmount > 0) {
        let dx = (Math.random() - 0.5) * shakeAmount;
        let dy = (Math.random() - 0.5) * shakeAmount;
        ctx.translate(dx, dy);
    }

    // Draw Stars
    game.stars.forEach(s => {
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });

    if (gameState === 'playing' || gameState === 'gameover' || gameState === 'upgrade') {
        // Draw Planet Core
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#00f3ff';
        let gradient = ctx.createRadialGradient(game.cx, game.cy, 20, game.cx, game.cy, 60);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, '#00f3ff');
        gradient.addColorStop(1, '#0055aa');
        
        ctx.beginPath();
        ctx.arc(game.cx, game.cy, 60, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Planet health visual
        if (game.planetHealth < game.planetMaxHealth) {
            ctx.strokeStyle = `rgba(255, 51, 102, 0.8)`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(game.cx, game.cy, 65, 0, (Math.PI * 2) * (game.planetHealth / game.planetMaxHealth));
            ctx.stroke();
        }

        // Draw Orbit Rings
        ctx.beginPath();
        ctx.arc(game.cx, game.cy, 120, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Weapons
        weapons.forEach(w => {
            let wx = game.cx + Math.cos(game.orbitAngle + w.angleOffset) * w.radius;
            let wy = game.cy + Math.sin(game.orbitAngle + w.angleOffset) * w.radius;
            
            // Turret Base
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff00ff';
            ctx.fillStyle = '#ff00ff';
            ctx.beginPath();
            ctx.arc(wx, wy, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Turret barrel
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.lineTo(wx + Math.cos(game.orbitAngle + w.angleOffset) * 20, wy + Math.sin(game.orbitAngle + w.angleOffset) * 20);
            ctx.stroke();
            ctx.shadowBlur = 0;
        });

        // Draw Projectiles
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f3ff';
        ctx.fillStyle = '#ffffff';
        projectiles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;

        // Draw Enemies
        enemies.forEach(e => {
            ctx.shadowBlur = 15;
            ctx.shadowColor = e.color;
            ctx.fillStyle = e.color;
            
            ctx.beginPath();
            if (e.type === 'fast') {
                // Triangle
                let a = Math.atan2(game.cy - e.y, game.cx - e.x);
                ctx.moveTo(e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius);
                ctx.lineTo(e.x + Math.cos(a + 2.5) * e.radius, e.y + Math.sin(a + 2.5) * e.radius);
                ctx.lineTo(e.x + Math.cos(a - 2.5) * e.radius, e.y + Math.sin(a - 2.5) * e.radius);
            } else if (e.type === 'heavy') {
                // Hexagon
                for(let i=0; i<6; i++) {
                    ctx.lineTo(e.x + e.radius * Math.cos(a = i * Math.PI / 3), e.y + e.radius * Math.sin(a));
                }
            } else {
                // Circle
                ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // HP Bar
            if (e.hp < e.maxHp) {
                ctx.fillStyle = 'red';
                ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, e.radius * 2, 4);
                ctx.fillStyle = 'lime';
                ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, (e.radius * 2) * (e.hp / e.maxHp), 4);
            }
        });

        // Draw Particles
        particles.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;
    }

    ctx.restore();
}

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(loop);
}

// UI Management
function switchState(newState) {
    gameState = newState;
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));

    if (newState === 'menu') {
        uiMainMenu.classList.remove('hidden');
        uiMainMenu.classList.add('active');
    } else if (newState === 'tutorial') {
        uiTutorial.classList.remove('hidden');
        uiTutorial.classList.add('active');
    } else if (newState === 'playing') {
        uiGameHud.classList.remove('hidden');
        uiGameHud.classList.add('active');
    } else if (newState === 'upgrade') {
        uiGameHud.classList.remove('hidden');
        uiGameHud.classList.add('active');
        uiUpgradeMenu.classList.remove('hidden');
        uiUpgradeMenu.classList.add('active');
        updateUpgradeMenu();
    } else if (newState === 'gameover') {
        uiGameOver.classList.remove('hidden');
        uiGameOver.classList.add('active');
        finalWaveDisplay.innerText = game.wave;
        finalScoreDisplay.innerText = game.score;
    }
}

function updateHUD() {
    scoreDisplay.innerText = game.score;
    energyDisplay.innerText = game.energy;
    waveDisplay.innerText = game.wave;
    
    let hpPercent = Math.max(0, game.planetHealth / game.planetMaxHealth) * 100;
    healthBarFill.style.width = `${hpPercent}%`;
}

function getUpgradeCost(type) {
    let u = upgrades[type];
    return Math.floor(u.costBase * Math.pow(u.mult, u.level - 1));
}

function updateUpgradeMenu() {
    upgEnergyDisplay.innerText = game.energy;
    
    ['damage', 'firerate', 'speed', 'newweapon'].forEach(type => {
        let u = upgrades[type];
        let el = document.getElementById(`upg-${type}`);
        let btn = el.querySelector('.btn-buy');
        let lvlEl = el.querySelector('.lvl-val');
        
        if (u.level >= u.max) {
            lvlEl.innerText = 'MAX';
            btn.innerHTML = 'MAXED';
            btn.disabled = true;
        } else {
            let cost = getUpgradeCost(type);
            lvlEl.innerText = u.level;
            btn.innerHTML = `<span class="cost">${cost}</span> 💎`;
            btn.disabled = game.energy < cost;
        }
    });
}

function buyUpgrade(type) {
    let u = upgrades[type];
    if (u.level >= u.max) return;
    
    let cost = getUpgradeCost(type);
    if (game.energy >= cost) {
        game.energy -= cost;
        u.level++;
        sounds.upgrade();
        
        if (type === 'newweapon') {
            addWeapon();
        }
        
        updateHUD();
        updateUpgradeMenu();
    } else {
        sounds.error();
    }
}

function gameOver() {
    switchState('gameover');
}

// Event Listeners
document.getElementById('btn-start').addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    switchState('tutorial');
});

document.getElementById('btn-sound').addEventListener('click', (e) => {
    soundEnabled = !soundEnabled;
    e.target.innerText = soundEnabled ? '🔊' : '🔇';
});

document.getElementById('btn-play-now').addEventListener('click', () => {
    initGame();
    switchState('playing');
});

document.getElementById('btn-open-upgrades').addEventListener('click', () => {
    switchState('upgrade');
});

document.getElementById('btn-close-upgrades').addEventListener('click', () => {
    switchState('playing');
});

document.getElementById('btn-restart').addEventListener('click', () => {
    initGame();
    switchState('playing');
});

document.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', (e) => {
        let type = e.currentTarget.getAttribute('data-type');
        buyUpgrade(type);
    });
});

// Start loop
initStars();
requestAnimationFrame(loop);
