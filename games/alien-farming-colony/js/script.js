// Alien Farming Colony - Main Game Logic
// World-class "Jor Dar" Realistic Rendering Engine
// Author: Antigravity

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

// Game Config
const TILE_SIZE = 90;
const GRID_COLS = 20;
const GRID_ROWS = 20;

// Camera definition moved to top to prevent ReferenceError
let camera = {
    x: 0,
    y: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0
};

let width, height;
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    // Auto-center camera on resize
    camera.x = (GRID_COLS * TILE_SIZE) / 2 - width / 2;
    camera.y = (GRID_ROWS * TILE_SIZE) / 2 - height / 2;
}
window.addEventListener('resize', resize);
resize();

// Removed dynamic script injection for audio.js. It is now loaded in index.html.

const COLORS = {
    bg: '#05010a',
    soilNormal: '#140826',
    soilTilled: '#240f42',
    soilWatered: '#1a2254',
    gridLines: 'rgba(188, 19, 254, 0.05)',
    cracks: '#0a0214'
};

const SEED_TYPES = {
    glow: { id: 'glow', name: 'Glow Seed', cost: 10, growTime: 5000, value: 25, color: '#00f3ff', glow: '#00f3ff', level: 1 },
    energy: { id: 'energy', name: 'Energy Fruit', cost: 30, growTime: 12000, value: 80, color: '#ff007c', glow: '#ff007c', level: 3 },
    star: { id: 'star', name: 'Star Berry', cost: 100, growTime: 25000, value: 300, color: '#bc13fe', glow: '#bc13fe', level: 5 }
};

// Game State
const state = {
    energy: 100,
    maxEnergy: 100,
    money: 50,
    level: 1,
    xp: 0,
    xpRequired: 100,
    day: 1,
    time: 8 * 60, // Minutes from midnight (8 AM)
    currentTool: 'cursor',
    upgrades: { hoe: false, water: false, energy: false, bot: false },
    isPlaying: false
};

// Map Generation with procedural noise-like terrain features
const grid = [];
const terrainFeatures = [];
for (let y = 0; y < GRID_ROWS; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_COLS; x++) {
        grid[y][x] = {
            x, y,
            state: 'normal',
            watered: false,
            waterTime: 0,
            crop: null,
            cracks: Array.from({length: 3}, () => ({
                cx: Math.random() * TILE_SIZE,
                cy: Math.random() * TILE_SIZE,
                r: Math.random() * Math.PI * 2,
                l: Math.random() * 20 + 10
            }))
        };
        // Background decorative features
        if(Math.random() < 0.1) {
            terrainFeatures.push({
                x: x * TILE_SIZE + Math.random() * TILE_SIZE,
                y: y * TILE_SIZE + Math.random() * TILE_SIZE,
                size: Math.random() * 15 + 5,
                color: Math.random() > 0.5 ? '#bc13fe' : '#00f3ff',
                pulseSpeed: Math.random() * 0.002 + 0.001
            });
        }
    }
}

// Background Stars Layer
const stars = Array.from({length: 150}, () => ({
    x: Math.random() * 3000,
    y: Math.random() * 3000,
    size: Math.random() * 2,
    blinkSpeed: Math.random() * 0.002 + 0.001,
    offset: Math.random() * Math.PI * 2
}));

// Ambient Floating Dust
const dustParticles = Array.from({length: 80}, () => ({
    x: Math.random() * 2000,
    y: Math.random() * 2000,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    size: Math.random() * 3 + 1,
    hue: Math.random() > 0.5 ? 280 : 190
}));

// Particles for actions
let particles = [];
let texts = [];

class Particle {
    constructor(x, y, color, isWater = false) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 1) * 8;
        this.life = 1;
        this.decay = Math.random() * 0.015 + 0.015;
        this.color = color;
        this.size = Math.random() * 6 + 3;
        this.isWater = isWater;
        this.gravity = isWater ? 0.4 : 0.2;
    }
    update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        
        // Bounce
        if(this.y > this.y + 20) {
            this.y = this.y + 20;
            this.vy *= -0.5;
            this.vx *= 0.8;
        }

        this.life -= this.decay;
        this.size = Math.max(0, this.size - 0.1);
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = this.isWater ? 5 : 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1;
        this.vy = -1.5;
        this.scale = 0.5;
    }
    update() {
        this.y += this.vy;
        this.life -= 0.02;
        if(this.scale < 1) this.scale += 0.1;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = "bold 24px Outfit";
        ctx.textAlign = "center";
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.fillText(this.text, 0, 0);
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

function spawnParticles(x, y, color, count = 10, isWater = false) {
    for(let i=0; i<count; i++) {
        particles.push(new Particle(x, y, color, isWater));
    }
}

function showFloatingText(x, y, text, color) {
    texts.push(new FloatingText(x, y, text, color));
}

// Input Handling
let pointerX = 0, pointerY = 0;

function pointerDown(x, y) {
    pointerX = x; pointerY = y;
    camera.isDragging = true;
    camera.lastX = pointerX;
    camera.lastY = pointerY;
}
function pointerMove(x, y) {
    pointerX = x; pointerY = y;
    if (camera.isDragging && state.currentTool === 'cursor') {
        camera.x -= (pointerX - camera.lastX);
        camera.y -= (pointerY - camera.lastY);
        camera.lastX = pointerX;
        camera.lastY = pointerY;
    }
}
function pointerUp(x, y) {
    camera.isDragging = false;
    if (Math.abs(x - pointerX) < 10 && Math.abs(y - pointerY) < 10) {
        handleGridInteraction(x, y);
    }
}

canvas.addEventListener('mousedown', e => pointerDown(e.clientX, e.clientY));
canvas.addEventListener('mousemove', e => pointerMove(e.clientX, e.clientY));
canvas.addEventListener('mouseup', e => pointerUp(e.clientX, e.clientY));

canvas.addEventListener('touchstart', e => pointerDown(e.touches[0].clientX, e.touches[0].clientY));
canvas.addEventListener('touchmove', e => pointerMove(e.touches[0].clientX, e.touches[0].clientY));
canvas.addEventListener('touchend', e => pointerUp(pointerX, pointerY));

function handleGridInteraction(screenX, screenY) {
    if(!state.isPlaying) return;

    const worldX = screenX + camera.x;
    const worldY = screenY + camera.y;
    
    const col = Math.floor(worldX / TILE_SIZE);
    const row = Math.floor(worldY / TILE_SIZE);
    
    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
        const tile = grid[row][col];
        const cx = col * TILE_SIZE + TILE_SIZE/2 - camera.x;
        const cy = row * TILE_SIZE + TILE_SIZE/2 - camera.y;

        if (state.currentTool === 'hoe') {
            if (tile.state === 'normal' && state.energy >= (state.upgrades.hoe ? 1 : 2)) {
                tile.state = 'tilled';
                consumeEnergy(state.upgrades.hoe ? 1 : 2);
                window.SoundEffects && window.SoundEffects.till();
                spawnParticles(cx, cy, '#6b4e85', 8); // Dirt particles
            } else if(tile.state === 'normal') {
                showFloatingText(cx, cy, "Low Energy!", "#ff0044");
                window.SoundEffects && window.SoundEffects.error();
            }
        } 
        else if (state.currentTool === 'water') {
            if (tile.state === 'tilled' && !tile.watered && state.energy >= 1) {
                tile.watered = true;
                tile.waterTime = performance.now();
                consumeEnergy(1);
                window.SoundEffects && window.SoundEffects.water();
                spawnParticles(cx, cy, '#00f3ff', 12, true);
            } else if(!tile.watered && tile.state === 'tilled') {
                showFloatingText(cx, cy, "Low Energy!", "#ff0044");
                window.SoundEffects && window.SoundEffects.error();
            }
        }
        else if (state.currentTool.startsWith('seed_')) {
            const seedType = state.currentTool.replace('seed_', '');
            const seedInfo = SEED_TYPES[seedType];
            
            if (tile.state === 'tilled' && !tile.crop) {
                if (state.money >= seedInfo.cost && state.energy >= 1) {
                    state.money -= seedInfo.cost;
                    consumeEnergy(1);
                    tile.crop = {
                        type: seedType,
                        stage: 0,
                        plantTime: performance.now(),
                        offset: Math.random() * Math.PI * 2 // For unique wind sway phase
                    };
                    window.SoundEffects && window.SoundEffects.plant();
                    updateHUD();
                } else {
                    showFloatingText(cx, cy, "No Money/Energy", "#ff0044");
                    window.SoundEffects && window.SoundEffects.error();
                }
            }
        }
        else if (state.currentTool === 'cursor') {
            if (tile.crop && tile.crop.stage === 2 && state.energy >= 1) {
                const seedInfo = SEED_TYPES[tile.crop.type];
                state.money += seedInfo.value;
                gainXP(20 * seedInfo.level);
                consumeEnergy(1);
                
                spawnParticles(cx, cy, seedInfo.glow, 25);
                showFloatingText(cx, cy, `+${seedInfo.value}💎`, "#00f3ff");
                window.SoundEffects && window.SoundEffects.harvest();
                
                tile.crop = null;
                tile.watered = false;
                updateHUD();
            }
        }
    }
}

function consumeEnergy(amount) {
    state.energy = Math.max(0, state.energy - amount);
    updateHUD();
}

function gainXP(amount) {
    state.xp += amount;
    if (state.xp >= state.xpRequired) {
        state.level++;
        state.xp -= state.xpRequired;
        state.xpRequired = Math.floor(state.xpRequired * 1.5);
        state.maxEnergy += 10;
        state.energy = state.maxEnergy;
        showFloatingText(width/2, height/2, "LEVEL UP!", "#bc13fe");
        window.SoundEffects && window.SoundEffects.upgrade();
        unlockTools();
    }
    updateHUD();
}

function unlockTools() {
    document.querySelectorAll('.tool-slot').forEach(slot => {
        const tool = slot.dataset.tool;
        if (tool === 'seed_energy' && state.level >= 3) {
            slot.classList.remove('locked');
            slot.querySelector('.tool-name').textContent = 'Energy Fruit';
        }
        if (tool === 'seed_star' && state.level >= 5) {
            slot.classList.remove('locked');
            slot.querySelector('.tool-name').textContent = 'Star Berry';
        }
    });
}

function updateHUD() {
    document.getElementById('energyValue').textContent = `${Math.floor(state.energy)}/${state.maxEnergy}`;
    document.getElementById('energyBar').style.width = `${(state.energy / state.maxEnergy) * 100}%`;
    document.getElementById('moneyValue').textContent = state.money;
    document.getElementById('levelValue').textContent = `Lvl ${state.level}`;
    document.getElementById('xpBar').style.width = `${(state.xp / state.xpRequired) * 100}%`;
    
    const hours = Math.floor(state.time / 60);
    const mins = Math.floor(state.time % 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    document.getElementById('timeDisplay').textContent = `${displayHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${ampm}`;
    document.getElementById('dayDisplay').textContent = `DAY ${state.day}`;
}

// UI Modals
document.getElementById('btnUpgrades').addEventListener('click', () => {
    document.getElementById('shopScreen').classList.remove('hidden');
    document.getElementById('shopScreen').classList.add('active');
    window.SoundEffects && window.SoundEffects.click();
});

document.getElementById('btnCloseShop').addEventListener('click', () => {
    document.getElementById('shopScreen').classList.remove('active');
    setTimeout(() => { document.getElementById('shopScreen').classList.add('hidden'); }, 300);
    window.SoundEffects && window.SoundEffects.click();
});

document.querySelectorAll('.tool-slot').forEach(slot => {
    slot.addEventListener('click', () => {
        if (slot.classList.contains('locked')) return;
        document.querySelectorAll('.tool-slot').forEach(s => s.classList.remove('active'));
        slot.classList.add('active');
        state.currentTool = slot.dataset.tool;
        window.SoundEffects && window.SoundEffects.click();
    });
});

document.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const upgrade = e.target.dataset.upgrade;
        const cost = parseInt(e.target.dataset.cost);
        
        if (!state.upgrades[upgrade] && state.money >= cost) {
            state.money -= cost;
            state.upgrades[upgrade] = true;
            e.target.textContent = "PURCHASED";
            e.target.classList.add("purchased");
            if(upgrade === 'energy') { state.maxEnergy += 50; state.energy += 50; }
            updateHUD();
            window.SoundEffects && window.SoundEffects.upgrade();
        } else if(!state.upgrades[upgrade]) {
            window.SoundEffects && window.SoundEffects.error();
        }
    });
});

document.getElementById('btnStartGame').addEventListener('click', () => {
    document.getElementById('introScreen').classList.remove('active');
    setTimeout(() => {
        document.getElementById('introScreen').classList.add('hidden');
        state.isPlaying = true;
        updateHUD();
        window.SoundEffects && window.SoundEffects.click();
    }, 300);
});

// Advanced Organic Rendering Functions
function drawGlowPlant(ctx, cx, cy, stage, sway, time) {
    ctx.shadowBlur = stage === 2 ? 20 + Math.sin(time*0.005)*10 : 10;
    ctx.shadowColor = '#00f3ff';
    ctx.fillStyle = '#00f3ff';
    ctx.strokeStyle = '#0088aa';
    ctx.lineWidth = 3;

    if (stage === 0) { // Seed
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    } else if (stage === 1) { // Growing
        ctx.beginPath();
        ctx.moveTo(cx, cy + 10);
        ctx.quadraticCurveTo(cx - 15 + sway, cy - 10, cx + sway, cy - 20);
        ctx.quadraticCurveTo(cx + 15 + sway, cy - 10, cx, cy + 10);
        ctx.fill(); ctx.stroke();
    } else if (stage === 2) { // Mature
        // Stem
        ctx.beginPath(); ctx.moveTo(cx, cy+15); ctx.quadraticCurveTo(cx+sway/2, cy, cx+sway, cy-15); ctx.stroke();
        // Leaves/Petals
        for(let i=0; i<3; i++) {
            let angle = (i * Math.PI*2/3) + sway*0.05 + time*0.001;
            let px = cx + sway + Math.cos(angle)*15;
            let py = cy - 20 + Math.sin(angle)*15;
            ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI*2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(cx+sway, cy-20, 12, 0, Math.PI*2); ctx.fillStyle = '#ffffff'; ctx.fill();
    }
}

function drawEnergyFruit(ctx, cx, cy, stage, sway, time) {
    ctx.shadowBlur = stage === 2 ? 25 + Math.sin(time*0.01)*10 : 5;
    ctx.shadowColor = '#ff007c';
    ctx.fillStyle = '#ff007c';
    
    if (stage === 0) {
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    } else if (stage === 1) {
        ctx.strokeStyle = '#880044'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cx, cy+10); ctx.lineTo(cx+sway, cy-15); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx+sway, cy-15, 10, 0, Math.PI*2); ctx.fill();
    } else if (stage === 2) {
        // Base stem
        ctx.strokeStyle = '#4a0033'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(cx, cy+15); ctx.quadraticCurveTo(cx+sway, cy, cx+sway*1.5, cy-25); ctx.stroke();
        // Pulsing Orbs
        ctx.fillStyle = '#ff007c';
        ctx.beginPath(); ctx.arc(cx+sway*1.5, cy-25, 18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffb3d9';
        ctx.beginPath(); ctx.arc(cx+sway*1.5 - 4, cy-28, 6, 0, Math.PI*2); ctx.fill(); // Highlight
        // Extra mini fruits
        ctx.fillStyle = '#ff007c';
        ctx.beginPath(); ctx.arc(cx+sway*0.5 - 15, cy-10, 10, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+sway + 15, cy-5, 12, 0, Math.PI*2); ctx.fill();
    }
}

function drawStarBerry(ctx, cx, cy, stage, sway, time) {
    ctx.shadowBlur = stage === 2 ? 30 : 10;
    ctx.shadowColor = '#bc13fe';
    
    if (stage === 0) {
        ctx.fillStyle = '#bc13fe';
        ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
    } else if (stage === 1) {
        ctx.strokeStyle = '#bc13fe'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx, cy+10); 
        ctx.bezierCurveTo(cx-20+sway, cy-5, cx+20+sway, cy-15, cx+sway, cy-30); 
        ctx.stroke();
    } else if (stage === 2) {
        ctx.strokeStyle = '#5c0082'; ctx.lineWidth = 4;
        // Twisted vine
        ctx.beginPath(); ctx.moveTo(cx, cy+15); 
        ctx.bezierCurveTo(cx-30+sway, cy-10, cx+30+sway, cy-30, cx+sway, cy-45); 
        ctx.stroke();
        
        // Star fruits
        function drawStar(sx, sy, rot, scale) {
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(rot); ctx.scale(scale, scale);
            ctx.fillStyle = '#bc13fe';
            ctx.beginPath();
            for(let i=0; i<5; i++) {
                ctx.lineTo(Math.cos( (18 + i*72)/180 * Math.PI ) * 15, -Math.sin( (18 + i*72)/180 * Math.PI ) * 15);
                ctx.lineTo(Math.cos( (54 + i*72)/180 * Math.PI ) * 6, -Math.sin( (54 + i*72)/180 * Math.PI ) * 6);
            }
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill(); // inner core
            ctx.restore();
        }
        drawStar(cx+sway, cy-45, time*0.002, 1 + Math.sin(time*0.005)*0.2);
        drawStar(cx-15+sway*0.5, cy-20, -time*0.001, 0.7);
        drawStar(cx+20+sway*0.8, cy-25, time*0.003, 0.8);
    }
}

// Game Loop
let lastTime = 0;
function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);
    
    if(!lastTime) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (!state.isPlaying) return;

    // Time passing
    state.time += dt * 0.008; 
    if (state.time >= 24 * 60) {
        state.time = 0;
        state.day++;
        state.energy = state.maxEnergy;
        updateHUD();
    }
    
    // Update crops
    for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
            const tile = grid[y][x];
            
            if (tile.watered && timestamp - tile.waterTime > 20000) tile.watered = false;
            
            if (tile.crop && tile.crop.stage < 2) {
                const seedInfo = SEED_TYPES[tile.crop.type];
                const growthMultiplier = tile.watered ? 2 : 1;
                const elapsed = (timestamp - tile.crop.plantTime) * growthMultiplier;
                
                if (elapsed > seedInfo.growTime) {
                    tile.crop.stage = 2;
                    spawnParticles(x * TILE_SIZE + TILE_SIZE/2 - camera.x, y * TILE_SIZE + TILE_SIZE/2 - camera.y, seedInfo.glow, 15);
                } else if (elapsed > seedInfo.growTime / 2) {
                    tile.crop.stage = 1;
                }
            }
            
            // Auto Harvest bot
            if (state.upgrades.bot && tile.crop && tile.crop.stage === 2 && Math.random() < 0.005) {
                const seedInfo = SEED_TYPES[tile.crop.type];
                state.money += seedInfo.value;
                gainXP(20 * seedInfo.level);
                const cx = x * TILE_SIZE + TILE_SIZE/2 - camera.x;
                const cy = y * TILE_SIZE + TILE_SIZE/2 - camera.y;
                spawnParticles(cx, cy, seedInfo.glow, 15);
                showFloatingText(cx, cy, `+${seedInfo.value}💎`, "#00f3ff");
                tile.crop = null;
                tile.watered = false;
                updateHUD();
            }
            
            // Auto Water Drone
            if (state.upgrades.water && tile.state === 'tilled' && !tile.watered && tile.crop && Math.random() < 0.005) {
                tile.watered = true;
                tile.waterTime = performance.now();
                spawnParticles(x * TILE_SIZE + TILE_SIZE/2 - camera.x, y * TILE_SIZE + TILE_SIZE/2 - camera.y, '#00f3ff', 5, true);
            }
        }
    }

    if(Math.random() < 0.1) updateHUD();

    draw(timestamp);
}

function draw(timestamp) {
    // Determine lighting based on time (Day/Night cycle)
    const hour = state.time / 60;
    let ambientLight = 1;
    let bgPulse = Math.sin(timestamp * 0.001) * 0.1;
    
    if (hour > 18 || hour < 6) { // Night
        ambientLight = 0.4;
    } else if (hour > 16) { // Sunset
        ambientLight = 1 - ((hour - 16) / 2) * 0.6;
    } else if (hour < 8) { // Sunrise
        ambientLight = 0.4 + ((hour - 6) / 2) * 0.6;
    }

    // Dynamic Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // Draw Stars (parallax)
    ctx.save();
    ctx.translate(-camera.x * 0.1, -camera.y * 0.1);
    stars.forEach(star => {
        let alpha = Math.max(0, Math.sin(timestamp * star.blinkSpeed + star.offset));
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * (1 - ambientLight)})`; // More visible at night
        ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI*2); ctx.fill();
    });
    ctx.restore();

    // Camera Constraints
    camera.x = Math.max(-width/2, Math.min(camera.x, GRID_COLS * TILE_SIZE - width/2));
    camera.y = Math.max(-height/2, Math.min(camera.y, GRID_ROWS * TILE_SIZE - height/2));

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Alien terrain features (Bioluminescent rocks)
    terrainFeatures.forEach(feat => {
        ctx.shadowBlur = 20;
        ctx.shadowColor = feat.color;
        ctx.fillStyle = feat.color;
        let p = 0.7 + Math.sin(timestamp * feat.pulseSpeed) * 0.3;
        ctx.globalAlpha = p;
        ctx.beginPath(); ctx.arc(feat.x, feat.y, feat.size, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    });

    // Draw Grid
    const startX = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    const startY = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    const endX = Math.min(GRID_COLS, Math.ceil((camera.x + width) / TILE_SIZE));
    const endY = Math.min(GRID_ROWS, Math.ceil((camera.y + height) / TILE_SIZE));

    // Global illumination layer
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - ambientLight})`;
    ctx.fillRect(camera.x, camera.y, width, height);

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const tile = grid[y][x];
            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;

            // Base soil
            if (tile.state === 'normal') {
                ctx.fillStyle = COLORS.soilNormal;
                ctx.fillRect(px+2, py+2, TILE_SIZE-4, TILE_SIZE-4);
                // Draw decorative cracks
                ctx.strokeStyle = COLORS.cracks; ctx.lineWidth = 2;
                tile.cracks.forEach(c => {
                    ctx.beginPath(); ctx.moveTo(px + c.cx, py + c.cy);
                    ctx.lineTo(px + c.cx + Math.cos(c.r)*c.l, py + c.cy + Math.sin(c.r)*c.l); ctx.stroke();
                });
            } else if (tile.state === 'tilled') {
                // Realistic 3D tilled dirt using shadows and layers
                ctx.fillStyle = tile.watered ? COLORS.soilWatered : COLORS.soilTilled;
                ctx.shadowBlur = 10; ctx.shadowColor = '#000';
                ctx.fillRect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12);
                ctx.shadowBlur = 0;
                
                // Furrow highlights
                ctx.fillStyle = tile.watered ? '#2a3575' : '#3d1a6b';
                ctx.fillRect(px + 10, py + TILE_SIZE/3 - 5, TILE_SIZE - 20, 10);
                ctx.fillRect(px + 10, py + (TILE_SIZE/3)*2 - 5, TILE_SIZE - 20, 10);
                
                // Furrow shadows
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.fillRect(px + 10, py + TILE_SIZE/3 + 5, TILE_SIZE - 20, 5);
                ctx.fillRect(px + 10, py + (TILE_SIZE/3)*2 + 5, TILE_SIZE - 20, 5);
            }

            // Draw Crops with Organic Wind Sway
            if (tile.crop) {
                const cx = px + TILE_SIZE / 2;
                const cy = py + TILE_SIZE / 2 + 10;
                // Wind formula based on absolute position and time
                const windPhase = (x * 0.5) + (y * 0.5) + tile.crop.offset;
                const sway = Math.sin(timestamp * 0.002 + windPhase) * 15 * (tile.crop.stage / 2);

                ctx.globalCompositeOperation = 'lighter'; // Enhance glows at night
                if (tile.crop.type === 'glow') {
                    drawGlowPlant(ctx, cx, cy, tile.crop.stage, sway, timestamp);
                } else if (tile.crop.type === 'energy') {
                    drawEnergyFruit(ctx, cx, cy, tile.crop.stage, sway, timestamp);
                } else if (tile.crop.type === 'star') {
                    drawStarBerry(ctx, cx, cy, tile.crop.stage, sway, timestamp);
                }
                ctx.globalCompositeOperation = 'source-over';
            }

            // Hover Highlight
            if (state.currentTool !== 'cursor' && !camera.isDragging) {
                const mouseWorldX = pointerX + camera.x;
                const mouseWorldY = pointerY + camera.y;
                if (mouseWorldX > px && mouseWorldX < px + TILE_SIZE &&
                    mouseWorldY > py && mouseWorldY < py + TILE_SIZE) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    ctx.strokeStyle = '#00f3ff';
                    ctx.lineWidth = 2;
                    ctx.shadowBlur = 10; ctx.shadowColor = '#00f3ff';
                    ctx.strokeRect(px+2, py+2, TILE_SIZE-4, TILE_SIZE-4);
                    ctx.shadowBlur = 0; ctx.lineWidth = 1;
                }
            }
        }
    }

    // Ambient Dust
    ctx.globalCompositeOperation = 'lighter';
    dustParticles.forEach(dust => {
        dust.x += dust.vx; dust.y += dust.vy;
        if(dust.x < camera.x) dust.x = camera.x + width;
        if(dust.x > camera.x + width) dust.x = camera.x;
        if(dust.y < camera.y) dust.y = camera.y + height;
        if(dust.y > camera.y + height) dust.y = camera.y;
        
        ctx.fillStyle = `hsla(${dust.hue}, 100%, 50%, 0.3)`;
        ctx.beginPath(); ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';

    ctx.restore();

    // Draw Particles & Texts (UI Space or World Space? World Space is better)
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(ctx);
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    
    for (let i = texts.length - 1; i >= 0; i--) {
        texts[i].update();
        texts[i].draw(ctx);
        if (texts[i].life <= 0) texts.splice(i, 1);
    }
    ctx.restore();
}

// Initialize
updateHUD();
requestAnimationFrame(gameLoop);
