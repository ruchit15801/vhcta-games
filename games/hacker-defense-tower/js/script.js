// --- Game Configuration & State ---
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;

let canvas, ctx;
let lastTime = 0;
let gameRunning = false;
let waveActive = false;
let soundEnabled = true;

const state = {
    health: 20,
    maxHealth: 20,
    data: 400,
    wave: 1,
    maxWaves: 10,
    enemies: [],
    towers: [],
    projectiles: [],
    particles: [],
    buildSpots: [],
    selectedSpot: null,
    selectedTower: null,
    waveQueue: [],
    spawnTimer: 0
};

// --- Audio Synthesizer (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (!soundEnabled || audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'shoot_firewall') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'shoot_laser') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.15);
        gainNode.gain.setValueAtTime(0.05, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'explosion') {
        // Noise burst
        const bufferSize = audioCtx.sampleRate * 0.2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        noise.start(now);
    } else if (type === 'build') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'core_hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.5);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
}

// --- Asset Loading ---
const assets = {
    tower_firewall: new Image(),
    tower_antivirus: new Image(),
    tower_encryption: new Image(),
    tower_ai: new Image(),
    enemy_virus: new Image(),
    enemy_malware: new Image(),
    enemy_trojan: new Image(),
    enemy_ransomware: new Image(),
    enemy_boss: new Image()
};
let assetsLoaded = 0;
const totalAssets = Object.keys(assets).length;

function loadAssets() {
    assets.tower_firewall.src = 'assets/images/tower_firewall_1776864174400.png?v=2';
    assets.tower_antivirus.src = 'assets/images/tower_antivirus_1776864190756.png?v=2';
    assets.tower_encryption.src = 'assets/images/tower_encryption_1776864210548.png?v=2';
    assets.tower_ai.src = 'assets/images/tower_ai_1776864235540.png?v=2';
    assets.enemy_virus.src = 'assets/images/enemy_virus_1776864255911.png?v=2';
    assets.enemy_malware.src = 'assets/images/enemy_malware_1776864272723.png?v=2';
    assets.enemy_trojan.src = 'assets/images/enemy_trojan_1776864297564.png?v=2';
    assets.enemy_ransomware.src = 'assets/images/enemy_ransomware_1776864319788.png?v=2';
    assets.enemy_boss.src = 'assets/images/enemy_boss_1776864336918.png?v=2';

    for (let key in assets) {
        assets[key].onload = () => assetsLoaded++;
    }
}

// --- Map Definition ---
const pathNodes = [
    {x: -100, y: 250},
    {x: 450, y: 250},
    {x: 450, y: 750},
    {x: 950, y: 750},
    {x: 950, y: 350},
    {x: 1450, y: 350},
    {x: 1450, y: 850},
    {x: 2000, y: 850}
];

const initialBuildSpots = [
    {x: 250, y: 120}, {x: 250, y: 380},
    {x: 650, y: 380}, {x: 650, y: 620},
    {x: 250, y: 620}, {x: 250, y: 880},
    {x: 750, y: 880}, {x: 1150, y: 880},
    {x: 750, y: 220}, {x: 1150, y: 220},
    {x: 1150, y: 480}, {x: 1650, y: 480},
    {x: 1650, y: 220}, {x: 1650, y: 980},
    {x: 1250, y: 720}
];

// --- Tower Data ---
const TOWER_TYPES = {
    firewall: { img: 'tower_firewall', cost: 100, range: 250, damage: 15, fireRate: 0.8, color: '#ff003c', type: 'burst' },
    antivirus: { img: 'tower_antivirus', cost: 150, range: 350, damage: 25, fireRate: 1.5, color: '#00f3ff', type: 'laser' },
    encryption: { img: 'tower_encryption', cost: 200, range: 200, damage: 5, fireRate: 0.2, color: '#bc13fe', type: 'slow' },
    ai: { img: 'tower_ai', cost: 300, range: 450, damage: 80, fireRate: 3.0, color: '#ffffff', type: 'sniper' }
};

// --- Enemy Data ---
const ENEMY_TYPES = {
    virus: { img: 'enemy_virus', hp: 50, speed: 150, reward: 10, radius: 30 },
    malware: { img: 'enemy_malware', hp: 120, speed: 100, reward: 20, radius: 35 },
    trojan: { img: 'enemy_trojan', hp: 80, speed: 200, reward: 15, radius: 30 }, // fast
    ransomware: { img: 'enemy_ransomware', hp: 300, speed: 70, reward: 40, radius: 45 }, // tank
    boss: { img: 'enemy_boss', hp: 1500, speed: 60, reward: 200, radius: 70 }
};

// --- Classes ---
class Enemy {
    constructor(typeObj) {
        this.type = typeObj;
        this.x = pathNodes[0].x;
        this.y = pathNodes[0].y;
        this.hp = typeObj.hp * (1 + (state.wave * 0.2)); // Scale HP with wave
        this.maxHp = this.hp;
        this.speed = typeObj.speed;
        this.reward = typeObj.reward;
        this.radius = typeObj.radius;
        this.img = assets[typeObj.img];
        
        this.pathIndex = 1;
        this.slowTimer = 0;
    }

    update(dt) {
        let currentSpeed = this.speed;
        if (this.slowTimer > 0) {
            currentSpeed *= 0.5;
            this.slowTimer -= dt;
        }

        const target = pathNodes[this.pathIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            this.pathIndex++;
            if (this.pathIndex >= pathNodes.length) {
                // Reached core
                takeDamage(1);
                return false; // remove from array
            }
        } else {
            this.x += (dx / dist) * currentSpeed * dt;
            this.y += (dy / dist) * currentSpeed * dt;
        }
        return true; // keep alive
    }

    draw(ctx) {
        if (!this.img) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Face movement direction
        const target = pathNodes[this.pathIndex];
        if (target) {
            const angle = Math.atan2(target.y - this.y, target.x - this.x);
            ctx.rotate(angle + Math.PI/2);
        }

        ctx.drawImage(this.img, -this.radius, -this.radius, this.radius*2, this.radius*2);
        
        // Slow effect
        if (this.slowTimer > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 5, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(188, 19, 254, 0.3)';
            ctx.fill();
        }
        
        ctx.restore();

        // HP Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - 20, this.y - this.radius - 15, 40, 5);
        ctx.fillStyle = '#00ff66';
        ctx.fillRect(this.x - 20, this.y - this.radius - 15, 40 * (this.hp / this.maxHp), 5);
    }
}

class Tower {
    constructor(spot, typeKey) {
        this.x = spot.x;
        this.y = spot.y;
        this.typeKey = typeKey;
        const data = TOWER_TYPES[typeKey];
        this.img = assets[data.img];
        this.range = data.range;
        this.damage = data.damage;
        this.fireRate = data.fireRate;
        this.color = data.color;
        this.shootType = data.type;
        this.cost = data.cost;
        
        this.level = 1;
        this.cooldown = 0;
        this.target = null;
        this.angle = 0;
    }

    upgrade() {
        this.level++;
        this.damage *= 1.5;
        this.range *= 1.1;
    }

    getUpgradeCost() {
        return Math.floor(this.cost * Math.pow(1.5, this.level));
    }

    getSellValue() {
        return Math.floor((this.cost + (this.level-1) * this.cost * 1.5) * 0.5);
    }

    update(dt) {
        this.cooldown -= dt;
        
        // Find target
        if (!this.target || this.target.hp <= 0 || Math.hypot(this.target.x - this.x, this.target.y - this.y) > this.range) {
            this.target = null;
            let closestDist = Infinity;
            for (let e of state.enemies) {
                let dist = Math.hypot(e.x - this.x, e.y - this.y);
                if (dist < this.range && dist < closestDist) {
                    closestDist = dist;
                    this.target = e;
                }
            }
        }

        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            
            if (this.cooldown <= 0) {
                this.shoot();
                this.cooldown = this.fireRate;
            }
        }
    }

    shoot() {
        if (this.shootType === 'laser' || this.shootType === 'sniper') {
            playSound('shoot_laser');
        } else {
            playSound('shoot_firewall');
        }
        
        state.projectiles.push(new Projectile(this.x, this.y, this.target, this.damage, this.color, this.shootType));
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI/2);
        if (this.img) {
            ctx.drawImage(this.img, -50, -50, 100, 100);
        }
        ctx.restore();

        // Draw level indicator
        ctx.fillStyle = this.color;
        ctx.font = '16px Orbitron';
        ctx.fillText(`Lvl ${this.level}`, this.x - 20, this.y + 60);
    }
}

class Projectile {
    constructor(x, y, target, damage, color, type) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.type = type;
        this.speed = type === 'sniper' ? 1500 : 800;
        this.active = true;
    }

    update(dt) {
        if (!this.target || this.target.hp <= 0) {
            this.active = false;
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 20) {
            // Hit
            this.target.hp -= this.damage;
            if (this.type === 'slow') {
                this.target.slowTimer = 2.0;
            }
            if (this.target.hp <= 0) {
                createParticles(this.target.x, this.target.y, this.color);
                playSound('explosion');
                state.data += this.target.reward;
                updateHUD();
            } else {
                playSound('hit');
            }
            this.active = false;
        } else {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        if (this.type === 'laser' || this.type === 'sniper') {
            ctx.arc(this.x, this.y, 5, 0, Math.PI*2);
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
        } else {
            ctx.arc(this.x, this.y, 8, 0, Math.PI*2);
        }
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 200 + 50;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt * 2;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.globalAlpha = 1.0;
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        state.particles.push(new Particle(x, y, color));
    }
}


// --- Wave Logic ---
const WAVE_CONFIGS = [
    { count: 10, type: 'virus', delay: 1.5 },
    { count: 15, type: 'virus', delay: 1.0 },
    { count: 10, type: 'virus', delay: 0.8, mixed: { type: 'malware', rate: 3 } }, // every 3rd is malware
    { count: 20, type: 'malware', delay: 1.0 },
    { count: 25, type: 'trojan', delay: 0.5 },
    { count: 5, type: 'ransomware', delay: 3.0 },
    { count: 30, type: 'virus', delay: 0.3 },
    { count: 20, type: 'malware', delay: 0.8, mixed: { type: 'ransomware', rate: 5 } },
    { count: 40, type: 'trojan', delay: 0.4 },
    { count: 1, type: 'boss', delay: 1.0 }
];

function prepareWave() {
    state.waveQueue = [];
    const config = WAVE_CONFIGS[state.wave - 1];
    if (!config) return;

    for (let i = 0; i < config.count; i++) {
        let type = config.type;
        if (config.mixed && i % config.mixed.rate === 0) {
            type = config.mixed.type;
        }
        state.waveQueue.push({ type: type, delay: config.delay });
    }
    state.spawnTimer = 1.0; // initial delay
}


// --- Main Functions ---

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // UI Elements
    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-restart').addEventListener('click', resetGame);
    document.getElementById('btn-play-again').addEventListener('click', resetGame);
    document.getElementById('btn-next-wave').addEventListener('click', startWave);
    document.getElementById('close-build-menu').addEventListener('click', hideMenus);
    document.getElementById('close-upgrade-menu').addEventListener('click', hideMenus);
    
    document.getElementById('sound-checkbox').addEventListener('change', (e) => {
        soundEnabled = e.target.checked;
        if (soundEnabled && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    });

    // Build actions
    document.querySelectorAll('.tower-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            const type = e.currentTarget.getAttribute('data-type');
            buildTower(type);
        });
    });

    document.getElementById('btn-upgrade').addEventListener('click', upgradeTower);
    document.getElementById('btn-sell').addEventListener('click', sellTower);

    // Canvas click
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', handleCanvasClick, {passive: false});

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    loadAssets();
    
    // Draw background initially even if not started
    requestAnimationFrame(renderInitial);
}

function resizeCanvas() {
    const container = document.getElementById('game-container');
    const targetRatio = GAME_WIDTH / GAME_HEIGHT;
    const containerRatio = container.clientWidth / container.clientHeight;

    let finalWidth, finalHeight;

    if (containerRatio > targetRatio) {
        // Fit height
        finalHeight = container.clientHeight;
        finalWidth = finalHeight * targetRatio;
    } else {
        // Fit width
        finalWidth = container.clientWidth;
        finalHeight = finalWidth / targetRatio;
    }

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    canvas.style.width = `${finalWidth}px`;
    canvas.style.height = `${finalHeight}px`;
}

function getCanvasClickPos(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
        e.preventDefault();
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
        clientX: clientX,
        clientY: clientY
    };
}

function handleCanvasClick(e) {
    if (!gameRunning) return;
    
    // Resume audio context on first user interaction
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const pos = getCanvasClickPos(e);
    let clickedSpot = null;
    let clickedTower = null;

    // Check towers first
    for (let t of state.towers) {
        if (Math.hypot(t.x - pos.x, t.y - pos.y) < 60) {
            clickedTower = t;
            break;
        }
    }

    if (clickedTower) {
        state.selectedSpot = null;
        state.selectedTower = clickedTower;
        showUpgradeMenu(pos.clientX, pos.clientY);
        return;
    }

    // Check spots
    for (let s of state.buildSpots) {
        if (Math.hypot(s.x - pos.x, s.y - pos.y) < 60) {
            clickedSpot = s;
            break;
        }
    }

    if (clickedSpot) {
        state.selectedTower = null;
        state.selectedSpot = clickedSpot;
        showBuildMenu(pos.clientX, pos.clientY);
    } else {
        hideMenus();
    }
}

function showBuildMenu(cx, cy) {
    const menu = document.getElementById('build-menu');
    menu.style.left = `${cx}px`;
    menu.style.top = `${cy}px`;
    menu.classList.remove('hidden');
    document.getElementById('upgrade-menu').classList.add('hidden');
}

function showUpgradeMenu(cx, cy) {
    const menu = document.getElementById('upgrade-menu');
    menu.style.left = `${cx}px`;
    menu.style.top = `${cy}px`;
    
    document.getElementById('selected-tower-name').innerText = state.selectedTower.typeKey.toUpperCase();
    document.getElementById('selected-tower-level').innerText = `Lvl ${state.selectedTower.level}`;
    document.getElementById('upgrade-cost').innerText = state.selectedTower.getUpgradeCost();
    document.getElementById('sell-value').innerText = state.selectedTower.getSellValue();
    
    menu.classList.remove('hidden');
    document.getElementById('build-menu').classList.add('hidden');
}

function hideMenus() {
    document.getElementById('build-menu').classList.add('hidden');
    document.getElementById('upgrade-menu').classList.add('hidden');
    state.selectedSpot = null;
    state.selectedTower = null;
}

function buildTower(typeKey) {
    const cost = TOWER_TYPES[typeKey].cost;
    if (state.data >= cost && state.selectedSpot) {
        state.data -= cost;
        state.towers.push(new Tower(state.selectedSpot, typeKey));
        // Remove spot
        state.buildSpots = state.buildSpots.filter(s => s !== state.selectedSpot);
        playSound('build');
        updateHUD();
        hideMenus();
    }
}

function upgradeTower() {
    if (state.selectedTower) {
        const cost = state.selectedTower.getUpgradeCost();
        if (state.data >= cost) {
            state.data -= cost;
            state.selectedTower.upgrade();
            playSound('build');
            updateHUD();
            hideMenus();
        }
    }
}

function sellTower() {
    if (state.selectedTower) {
        state.data += state.selectedTower.getSellValue();
        // Return spot
        state.buildSpots.push({x: state.selectedTower.x, y: state.selectedTower.y});
        // Remove tower
        state.towers = state.towers.filter(t => t !== state.selectedTower);
        updateHUD();
        hideMenus();
    }
}

function updateHUD() {
    document.getElementById('core-health-fill').style.width = `${(state.health / state.maxHealth) * 100}%`;
    document.getElementById('core-health-text').innerText = `${Math.ceil(state.health)}/${state.maxHealth}`;
    document.getElementById('data-points').innerText = state.data;
    document.getElementById('wave-counter').innerText = `${state.wave}/${state.maxWaves}`;
    
    if (state.health <= state.maxHealth * 0.3) {
        document.getElementById('core-health-fill').style.background = 'var(--neon-red)';
        document.getElementById('core-health-fill').style.boxShadow = '0 0 10px var(--neon-red)';
    } else {
        document.getElementById('core-health-fill').style.background = 'var(--neon-green)';
        document.getElementById('core-health-fill').style.boxShadow = '0 0 10px var(--neon-green)';
    }

    if (!waveActive && state.waveQueue.length === 0 && state.enemies.length === 0) {
        document.getElementById('btn-next-wave').style.display = 'block';
    } else {
        document.getElementById('btn-next-wave').style.display = 'none';
    }
}

function startWave() {
    if (state.wave > state.maxWaves) return;
    waveActive = true;
    prepareWave();
    document.getElementById('btn-next-wave').style.display = 'none';
    playSound('build');
}

function takeDamage(amt) {
    state.health -= amt;
    playSound('core_hit');
    updateHUD();
    if (state.health <= 0) {
        gameOver();
    }
}

function gameOver() {
    gameRunning = false;
    document.getElementById('final-wave').innerText = state.wave;
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
}

function winGame() {
    gameRunning = false;
    document.getElementById('win-screen').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    resetGame();
}

function resetGame() {
    state.health = state.maxHealth;
    state.data = 400;
    state.wave = 1;
    state.enemies = [];
    state.towers = [];
    state.projectiles = [];
    state.particles = [];
    state.buildSpots = [...initialBuildSpots];
    state.waveQueue = [];
    waveActive = false;
    gameRunning = true;
    
    hideMenus();
    updateHUD();
    
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('win-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function renderInitial() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw map elements purely as aesthetic if needed, background handles the art
    if (!gameRunning) requestAnimationFrame(renderInitial);
}

function gameLoop(timestamp) {
    if (!gameRunning) return;
    
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // clamp
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // Wave Spawning logic
    if (waveActive) {
        if (state.waveQueue.length > 0) {
            state.spawnTimer -= dt;
            if (state.spawnTimer <= 0) {
                const nextEnemy = state.waveQueue.shift();
                state.enemies.push(new Enemy(ENEMY_TYPES[nextEnemy.type]));
                state.spawnTimer = nextEnemy.delay;
            }
        } else if (state.enemies.length === 0) {
            // Wave ended
            waveActive = false;
            state.wave++;
            if (state.wave > state.maxWaves) {
                winGame();
                return;
            } else {
                updateHUD();
            }
        }
    }

    // Update Enemies
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        if (!state.enemies[i].update(dt) || state.enemies[i].hp <= 0) {
            state.enemies.splice(i, 1);
        }
    }

    // Update Towers
    state.towers.forEach(t => t.update(dt));

    // Update Projectiles
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        state.projectiles[i].update(dt);
        if (!state.projectiles[i].active) {
            state.projectiles.splice(i, 1);
        }
    }

    // Update Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
        state.particles[i].update(dt);
        if (state.particles[i].life <= 0) {
            state.particles.splice(i, 1);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Path Line (Holographic effect)
    ctx.beginPath();
    ctx.moveTo(pathNodes[0].x, pathNodes[0].y);
    for (let i = 1; i < pathNodes.length; i++) {
        ctx.lineTo(pathNodes[i].x, pathNodes[i].y);
    }
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
    ctx.lineWidth = 60;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
    ctx.lineWidth = 2;
    // Add dashes to path
    ctx.setLineDash([20, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Build Spots
    ctx.fillStyle = 'rgba(0, 255, 102, 0.1)';
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.5)';
    ctx.lineWidth = 2;
    state.buildSpots.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Inner reticle
        ctx.beginPath();
        ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
        ctx.stroke();
    });

    // Draw selection highlights
    if (state.selectedSpot) {
        ctx.strokeStyle = 'var(--neon-purple)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(state.selectedSpot.x, state.selectedSpot.y, 45, 0, Math.PI * 2);
        ctx.stroke();
    }
    if (state.selectedTower) {
        ctx.strokeStyle = 'var(--neon-green)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(state.selectedTower.x, state.selectedTower.y, state.selectedTower.range, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 102, 0.05)';
        ctx.fill();
        ctx.stroke();
    }

    // Draw Towers
    state.towers.forEach(t => t.draw(ctx));

    // Draw Enemies
    state.enemies.forEach(e => e.draw(ctx));

    // Draw Projectiles
    state.projectiles.forEach(p => p.draw(ctx));

    // Draw Particles
    state.particles.forEach(p => p.draw(ctx));
}

// Init
window.onload = init;
