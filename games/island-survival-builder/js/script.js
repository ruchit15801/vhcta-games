/**
 * Island Survival Builder
 * Core Game Engine
 */

// --- 1. CONFIG & STATE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimize
let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

const TILE_SIZE = 64;
const CHUNK_SIZE = 16; 
const MAP_SIZE = 4000; // 4000x4000 world limits
let camera = { x: 0, y: 0 };

const GAME_STATE = {
    MENU: 0,
    PLAYING: 1,
    DEAD: 2,
    CRAFTING: 3,
    BUILDING: 4
};
let currentState = GAME_STATE.MENU;

// Player Data
let player = {
    x: 0, y: 0,
    width: 30, height: 40,
    speed: 4,
    health: 100, maxHealth: 100,
    hunger: 100, maxHunger: 100,
    energy: 100, maxEnergy: 100,
    inv: { wood: 0, stone: 0, food: 2, water: 2 },
    tools: { axe: false, pickaxe: false, sword: false },
    dirX: 0, dirY: 1,
    isMoving: false,
    frameY: 0
};

// Environment Data
let objects = []; // trees, rocks, bushes
let structures = []; // player built
let animals = []; // wolves, pigs
let particles = [];
let dayCount = 1;
let timeOfDay = 0.2; // 0 = midnight, 0.5 = noon, 1 = midnight
let dayModifier = 0.00015; // smooth slow day cycle
let isSoundEnabled = true;

// UI Elements
const ui = {
    healthFill: document.getElementById('healthFill'),
    hungerFill: document.getElementById('hungerFill'),
    energyFill: document.getElementById('energyFill'),
    dayCount: document.getElementById('dayCount'),
    timeIcon: document.getElementById('timeIcon'),
    lighting: document.getElementById('lightingOverlay'),
    startScreen: document.getElementById('startScreen'),
    deathScreen: document.getElementById('deathScreen'),
    uiContainer: document.getElementById('uiContainer'),
    craftWindow: document.getElementById('craftingWindow'),
    buildWindow: document.getElementById('buildingWindow')
};

// Input State
const keys = {};
let mouse = { x: 0, y: 0, down: false };
let joystick = { active: false, x: 0, y: 0, dx: 0, dy: 0 };

window.addEventListener('resize', () => {
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = width; canvas.height = height;
});

// --- 2. ASSET GENERATOR (PROCEUDURAL 3D LOOK) ---
// We create canvas patterns/images in memory for maximum performance
const assets = {};
function createAsset(name, w, h, drawFn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    drawFn(x, w, h);
    assets[name] = c;
}

// Draw realistic 3D Tree
createAsset('tree', 64, 96, (c, w, h) => {
    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.beginPath(); c.ellipse(w/2, h-10, 20, 10, 0, 0, Math.PI*2); c.fill();
    // Trunk
    const trunkGradient = c.createLinearGradient(w/2-8, 0, w/2+8, 0);
    trunkGradient.addColorStop(0, '#5D4037'); trunkGradient.addColorStop(1, '#3E2723');
    c.fillStyle = trunkGradient;
    c.fillRect(w/2-6, h-40, 12, 35);
    // Leaves (Layered 3D look)
    c.fillStyle = '#2E7D32'; c.beginPath(); c.arc(w/2, h-60, 25, 0, Math.PI*2); c.fill();
    c.fillStyle = '#4CAF50'; c.beginPath(); c.arc(w/2-8, h-65, 20, 0, Math.PI*2); c.fill();
    c.fillStyle = '#1B5E20'; c.beginPath(); c.arc(w/2+10, h-55, 22, 0, Math.PI*2); c.fill();
});

// Rock
createAsset('rock', 48, 48, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.beginPath(); c.ellipse(w/2, h-8, 20, 8, 0, 0, Math.PI*2); c.fill();
    const grad = c.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#B0BEC5'); grad.addColorStop(1, '#546E7A');
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(10, h-10); c.lineTo(w/2, 5); c.lineTo(w-10, h-15); c.lineTo(w-5, h-5); c.lineTo(5, h-5);
    c.fill();
});

// Bush (Food)
createAsset('bush', 40, 40, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(w/2, h-5, 15, 6, 0, 0, Math.PI*2); c.fill();
    c.fillStyle = '#8BC34A'; c.beginPath(); c.arc(w/2, h-20, 15, 0, Math.PI*2); c.fill();
    c.fillStyle = '#e53935'; // berries
    c.beginPath(); c.arc(15, 15, 3, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(28, 22, 3, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(12, 25, 3, 0, Math.PI*2); c.fill();
});

// Player
createAsset('player', 40, 50, (c, w, h) => {
    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(w/2, h-5, 12, 5, 0, 0, Math.PI*2); c.fill();
    // Body
    c.fillStyle = '#1976D2'; c.fillRect(w/2-10, 15, 20, 20);
    // Head
    c.fillStyle = '#FFCA28'; c.beginPath(); c.arc(w/2, 12, 10, 0, Math.PI*2); c.fill();
    // Backpack
    c.fillStyle = '#5D4037'; c.fillRect(w/2-12, 18, 5, 15);
});

// Shelter
createAsset('shelter', 80, 80, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(w/2, h-10, 35, 15, 0, 0, Math.PI*2); c.fill();
    c.fillStyle = '#8D6E63'; c.fillRect(10, 30, 60, 40); // Base
    c.fillStyle = '#3E2723'; c.beginPath(); c.moveTo(0, 35); c.lineTo(40, 0); c.lineTo(80, 35); c.fill(); // Roof
    c.fillStyle = '#000'; c.fillRect(30, 40, 20, 30); // Door
});

// Campfire
createAsset('campfire', 40, 40, (c, w, h) => {
    c.fillStyle = '#5D4037';
    c.fillRect(10, 25, 20, 5); c.fillRect(15, 20, 10, 15);
    c.fillStyle = '#FF9800'; c.beginPath(); c.moveTo(20, 5); c.lineTo(10, 25); c.lineTo(30, 25); c.fill();
    c.fillStyle = '#FFEB3B'; c.beginPath(); c.moveTo(20, 10); c.lineTo(15, 25); c.lineTo(25, 25); c.fill();
});

// Ground Tiles
createAsset('grass', 64, 64, (c, w, h) => {
    c.fillStyle = '#388E3C'; c.fillRect(0,0,w,h);
    c.fillStyle = '#43A047';
    for(let i=0; i<5; i++) {
        c.fillRect(Math.random()*w, Math.random()*h, 4, 4);
    }
});
createAsset('sand', 64, 64, (c, w, h) => {
    c.fillStyle = '#FFE082'; c.fillRect(0,0,w,h);
    c.fillStyle = '#FFD54F';
    for(let i=0; i<5; i++) {
        c.beginPath(); c.arc(Math.random()*w, Math.random()*h, 2, 0, Math.PI*2); c.fill();
    }
});
createAsset('water', 64, 64, (c, w, h) => {
    c.fillStyle = '#0288D1'; c.fillRect(0,0,w,h);
    c.strokeStyle = '#039BE5'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(10, 20); c.lineTo(30, 20); c.stroke();
    c.beginPath(); c.moveTo(40, 40); c.lineTo(50, 40); c.stroke();
});

// --- 3. AUDIO SYSTEM (Procedural / Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if(!isSoundEnabled || audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if(type === 'chop') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'mine') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'collect') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'craft') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    }
}

// --- 4. MAP GENERATION ---
// Pseudo-random seeded hash
function hash(x, y) {
    return Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
}

// Generate world objects based on coordinates
function generateChunkObjects(cx, cy) {
    for(let i=0; i<15; i++) {
        let x = cx * CHUNK_SIZE * TILE_SIZE + hash(cx + i, cy) * CHUNK_SIZE * TILE_SIZE;
        let y = cy * CHUNK_SIZE * TILE_SIZE + hash(cx, cy + i) * CHUNK_SIZE * TILE_SIZE;
        let val = hash(x, y);
        let distFromCenter = Math.sqrt(x*x + y*y);
        
        // Island logic: center is land, edges are beach/water
        if(distFromCenter > MAP_SIZE/2) continue; // Water
        if(distFromCenter > MAP_SIZE/2 - 300) {
            // Beach logic (few objects)
            if(val > 0.95) objects.push({x, y, type: 'rock', hp: 3, maxHp: 3, asset: 'rock'});
        } else {
            // Forest logic
            if(val < 0.6) objects.push({x, y, type: 'tree', hp: 4, maxHp: 4, asset: 'tree'});
            else if(val < 0.8) objects.push({x, y, type: 'rock', hp: 3, maxHp: 3, asset: 'rock'});
            else if(val < 0.9) objects.push({x, y, type: 'bush', hp: 1, maxHp: 1, asset: 'bush'});
        }
    }
}

function initWorld() {
    objects = []; structures = []; animals = [];
    // Spawn simple animals across the map
    for(let i=0; i<30; i++) {
        let isWolf = Math.random() > 0.5;
        let ax = (Math.random()-0.5)*3000;
        let ay = (Math.random()-0.5)*3000;
        // Keep wolves away from center spawn (0,0)
        if (isWolf && Math.abs(ax) < 500 && Math.abs(ay) < 500) {
            ax += (ax > 0 ? 500 : -500);
            ay += (ay > 0 ? 500 : -500);
        }
        
        animals.push({
            x: ax, y: ay,
            type: isWolf ? 'wolf' : 'pig',
            hp: 20, dirX: 1, dirY: 0, timer: 0, speed: 1.5
        });
    }
    // Pre-generate inner chunks
    for(let x=-2; x<=2; x++) {
        for(let y=-2; y<=2; y++) {
            generateChunkObjects(x, y);
        }
    }
}

function getTerrainDist(tx, ty) {
    return Math.sqrt(tx*tx + ty*ty);
}
function getTerrainType(x, y) {
    // Determine biome from math
    let dist = Math.sqrt(x*x + y*y);
    if(dist > MAP_SIZE/2) return 'water';
    if(dist > MAP_SIZE/2 - 300) return 'sand';
    return 'grass';
}

// --- 5. LOGIC & MECHANICS ---

function updateInventoryUI() {
    document.getElementById('count-wood').innerText = player.inv.wood;
    document.getElementById('count-stone').innerText = player.inv.stone;
    document.getElementById('count-food').innerText = player.inv.food;
    document.getElementById('count-water').innerText = player.inv.water;
}

function collectResource(type) {
    let amount = 1;
    if(type === 'tree') {
        amount = player.tools.axe ? 2 : 1;
        player.inv.wood += amount;
        playSound('collect');
    } else if(type === 'rock') {
        if(!player.tools.pickaxe) {
            // Need pickaxe to mine efficiently or at all? Let's say yes, or just gives 1.
            player.inv.stone += 1;
        } else {
            player.inv.stone += 2;
        }
        playSound('mine');
    } else if(type === 'bush') {
        player.inv.food += 1;
        playSound('collect');
    } else if(type === 'water') {
        player.inv.water += 1;
        playSound('collect');
    }
    updateInventoryUI();
    spawnParticles(player.x, player.y, '#fff', 5);
}

function spawnParticles(x, y, color, count) {
    for(let i=0; i<count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
            life: 1.0, color: color
        });
    }
}

function updatePlayer(timeScale = 1) {
    let dx = 0; let dy = 0;
    if(keys['ArrowUp'] || keys['w']) dy = -1;
    if(keys['ArrowDown'] || keys['s']) dy = 1;
    if(keys['ArrowLeft'] || keys['a']) dx = -1;
    if(keys['ArrowRight'] || keys['d']) dx = 1;

    if(joystick.active) {
        dx = joystick.dx; dy = joystick.dy;
    }

    if(dx !== 0 || dy !== 0) {
        let len = Math.sqrt(dx*dx + dy*dy);
        dx /= len; dy /= len;
        
        // Apply timeScale to speed
        let currentSpeed = player.speed * timeScale;
        let targetX = player.x + dx * currentSpeed;
        let targetY = player.y + dy * currentSpeed;

        // Collision with map edge (water layer)
        if(getTerrainType(targetX, targetY) !== 'water') {
            player.x = targetX;
            player.y = targetY;
        }

        player.dirX = dx; player.dirY = dy;
        player.isMoving = true;
        // Energy drain
        player.energy -= 0.01 * timeScale;
    } else {
        player.isMoving = false;
    }

    // Camera follow
    camera.x += (player.x - width/2 - camera.x) * (0.1 * timeScale);
    camera.y += (player.y - height/2 - camera.y) * (0.1 * timeScale);

    // Survival Mechanics Drain
    player.hunger -= 0.005 * timeScale;
    if(player.hunger < 20) player.health -= 0.05 * timeScale; // Starving
    
    // Auto-heal if full hunger and not moving
    if(player.hunger > 80 && player.health < player.maxHealth && !player.isMoving) {
        player.health += 0.05 * timeScale;
    }

    // Cap stats
    player.health = Math.max(0, Math.min(player.maxHealth, player.health));
    player.hunger = Math.max(0, Math.min(player.maxHunger, player.hunger));
    player.energy = Math.max(0, Math.min(player.maxEnergy, player.energy));

    // Update UI HUD
    ui.healthFill.style.width = (player.health / player.maxHealth * 100) + '%';
    ui.hungerFill.style.width = (player.hunger / player.maxHunger * 100) + '%';
    ui.energyFill.style.width = (player.energy / player.maxEnergy * 100) + '%';

    if(player.health <= 0) die();
}

function performAction() {
    // Raycast in dirX, dirY
    const interactDist = 50;
    const ax = player.x + player.dirX * interactDist;
    const ay = player.y + player.dirY * interactDist;

    // Check objects
    for(let i=objects.length-1; i>=0; i--) {
        let obj = objects[i];
        let dx = obj.x - ax; let dy = obj.y - ay;
        if(Math.sqrt(dx*dx + dy*dy) < 40) {
            // Hit object
            obj.hp--;
            playSound(obj.type === 'tree' ? 'chop' : (obj.type === 'rock' ? 'mine' : 'hit'));
            spawnParticles(obj.x, obj.y, obj.type === 'tree' ? '#8D6E63' : '#9E9E9E', 5);
            
            // Animation
            player.x -= player.dirX * 10;
            player.y -= player.dirY * 10;

            if(obj.hp <= 0) {
                collectResource(obj.type);
                objects.splice(i, 1);
            }
            return;
        }
    }

    // Check animals
    for(let i=animals.length-1; i>=0; i--) {
        let ani = animals[i];
        let dx = ani.x - ax; let dy = ani.y - ay;
        if(Math.sqrt(dx*dx + dy*dy) < 40) {
            ani.hp -= player.tools.sword ? 10 : 3;
            playSound('hit');
            spawnParticles(ani.x, ani.y, '#e53935', 10);
            if(ani.hp <= 0) {
                player.inv.food += 2;
                playSound('collect');
                updateInventoryUI();
                animals.splice(i, 1);
            }
            return;
        }
    }

    // Interact with structures
    for(let i=0; i<structures.length; i++) {
        let st = structures[i];
        let dx = st.x - ax; let dy = st.y - ay;
        if(Math.sqrt(dx*dx + dy*dy) < 60) {
            if(st.type === 'shelter') {
                if(timeOfDay > 0.7 || timeOfDay < 0.2) {
                    // Sleep!
                    timeOfDay = 0.25; // skip to morning
                    dayCount++;
                    ui.dayCount.innerText = dayCount;
                    player.energy = player.maxEnergy;
                    playSound('craft');
                    spawnParticles(player.x, player.y, '#FFF', 20);
                }
            }
            return;
        }
    }

    // If nothing hit, try water collection if near beach
    if(getTerrainType(ax, ay) === 'water') {
        collectResource('water');
    } else {
        // Just swing
        player.energy -= 1;
        playSound('hit');
    }
}

function updateEnvironment(timeScale = 1) {
    // Day cycle
    timeOfDay += dayModifier * timeScale;
    if(timeOfDay > 1) {
        timeOfDay = 0;
        dayCount++;
        ui.dayCount.innerText = dayCount;
    }
    
    let lightLevel = 0;
    if(timeOfDay > 0.8) lightLevel = (timeOfDay - 0.8) * 4; // dusk
    else if(timeOfDay < 0.2) lightLevel = 0.8 - (timeOfDay * 4); // dawn
    else if(timeOfDay >= 0.2 && timeOfDay <= 0.8) lightLevel = 0; // day
    
    // Light limits
    lightLevel = Math.max(0, Math.min(0.85, lightLevel));
    
    // Campfire glow
    let hasFire = false;
    for(let st of structures) {
        if(st.type === 'campfire' && Math.sqrt(Math.pow(player.x - st.x, 2) + Math.pow(player.y - st.y, 2)) < 300) {
            hasFire = true;
        }
    }
    
    if(hasFire && lightLevel > 0.3) lightLevel = 0.3; // Fire reduces darkness locally

    ui.lighting.style.backgroundColor = `rgba(15, 15, 30, ${lightLevel})`;
    ui.timeIcon.innerText = (timeOfDay > 0.2 && timeOfDay < 0.8) ? '☀️' : '🌙';

    // Animals AI
    animals.forEach(ani => {
        ani.timer++;
        if(ani.timer > 60) {
            ani.timer = 0;
            ani.dirX = (Math.random() - 0.5);
            ani.dirY = (Math.random() - 0.5);
        }
        
        let tx = ani.x + ani.dirX * ani.speed;
        let ty = ani.y + ani.dirY * ani.speed;
        if(getTerrainType(tx, ty) !== 'water') {
            ani.x = tx; ani.y = ty;
        }

        // Hostile (Wolf) attacks at night
        if(ani.type === 'wolf' && lightLevel > 0.5) {
            let dx = player.x - ani.x; let dy = player.y - ani.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if(dist < 200) {
                ani.dirX = dx/dist; ani.dirY = dy/dist;
                ani.speed = 3 * timeScale; // sprint
                if(dist < 30) {
                    player.health -= 0.5 * timeScale; // continuous bite
                    playSound('hit');
                }
            } else {
                ani.speed = 1.5 * timeScale;
            }
        }
    });

    // Particles
    for(let i=particles.length-1; i>=0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.05;
        if(p.life <= 0) particles.splice(i, 1);
    }
}

function die() {
    currentState = GAME_STATE.DEAD;
    ui.uiContainer.classList.add('hidden');
    ui.deathScreen.classList.remove('hidden');
    ui.deathScreen.classList.add('active');
    ui.deathScreen.style.display = 'flex';
    document.getElementById('finalDays').innerText = dayCount;
}

function restartGame() {
    player.health = 100; player.hunger = 100; player.energy = 100;
    player.inv = { wood: 0, stone: 0, food: 2, water: 2 };
    player.tools = { axe: false, pickaxe: false, sword: false };
    player.x = 0; player.y = 0;
    dayCount = 1; timeOfDay = 0.2;
    ui.dayCount.innerText = dayCount;
    updateInventoryUI();
    initWorld();
    ui.deathScreen.classList.remove('active');
    ui.deathScreen.classList.add('hidden');
    ui.deathScreen.style.display = 'none';
    ui.uiContainer.classList.remove('hidden');
    lastTime = performance.now();
    currentState = GAME_STATE.PLAYING;
}


// --- 6. CRAFTING & BUILDING LOGIC ---
const RECIPES = [
    { title: 'Axe', req: { wood: 5, stone: 2 }, type: 'tool', id: 'axe', icon: '🪓' },
    { title: 'Pickaxe', req: { wood: 5, stone: 5 }, type: 'tool', id: 'pickaxe', icon: '⛏️' },
    { title: 'Sword', req: { wood: 2, stone: 10 }, type: 'tool', id: 'sword', icon: '🗡️' },
    { title: 'Eat Food', req: { food: 1 }, type: 'consume', id: 'eat', icon: '🍗' },
    { title: 'Drink Water', req: { water: 1 }, type: 'consume', id: 'drink', icon: '💧' }
];

const BUILDINGS = [
    { title: 'Shelter', req: { wood: 20, stone: 10 }, id: 'shelter', icon: '🛖' },
    { title: 'Campfire', req: { wood: 5, stone: 2 }, id: 'campfire', icon: '🔥' }
];

function openCrafting() {
    if(currentState !== GAME_STATE.PLAYING) return;
    currentState = GAME_STATE.CRAFTING;
    ui.craftWindow.classList.remove('hidden');
    renderCraftingUI();
    playSound('craft');
}

function openBuilding() {
    if(currentState !== GAME_STATE.PLAYING) return;
    currentState = GAME_STATE.BUILDING;
    ui.buildWindow.classList.remove('hidden');
    renderBuildingUI();
    playSound('craft');
}

function renderCraftingUI() {
    const grid = document.querySelector('.craft-grid');
    grid.innerHTML = '';
    RECIPES.forEach(r => {
        let canCraft = true;
        let reqText = '';
        for(let k in r.req) {
            reqText += `${r.req[k]} ${k} `;
            if(player.inv[k] < r.req[k]) canCraft = false;
        }

        // Check if already has tool
        if(r.type === 'tool' && player.tools[r.id]) {
            canCraft = false; reqText = "Already Owned";
        }

        const div = document.createElement('div');
        div.className = 'recipe-card';
        div.innerHTML = `
            <div class="recipe-icon">${r.icon}</div>
            <div class="recipe-name">${r.title}</div>
            <div class="recipe-req">${reqText}</div>
            <button class="btn-craft" ${canCraft ? '' : 'disabled'} onclick="craftItem('${r.id}')">Craft</button>
        `;
        grid.appendChild(div);
    });
}

function renderBuildingUI() {
    const grid = document.querySelector('.build-grid');
    grid.innerHTML = '';
    BUILDINGS.forEach(b => {
        let canCraft = true;
        let reqText = '';
        for(let k in b.req) {
            reqText += `${b.req[k]} ${k} `;
            if(player.inv[k] < b.req[k]) canCraft = false;
        }

        const div = document.createElement('div');
        div.className = 'recipe-card';
        div.innerHTML = `
            <div class="recipe-icon">${b.icon}</div>
            <div class="recipe-name">${b.title}</div>
            <div class="recipe-req">${reqText}</div>
            <button class="btn-craft" ${canCraft ? '' : 'disabled'} onclick="startPlacing('${b.id}')">Build</button>
        `;
        grid.appendChild(div);
    });
}

window.craftItem = (id) => {
    let r = RECIPES.find(x => x.id === id);
    if(r) {
        // deduct
        for(let k in r.req) {
            player.inv[k] -= r.req[k];
        }
        if(r.type === 'tool') player.tools[id] = true;
        if(id === 'eat') player.hunger = Math.min(player.maxHunger, player.hunger + 30);
        if(id === 'drink') player.energy = Math.min(player.maxEnergy, player.energy + 20);
        
        playSound('craft');
        updateInventoryUI();
        renderCraftingUI();
    }
};

let placementState = null;

window.startPlacing = (id) => {
    ui.buildWindow.classList.add('hidden');
    let b = BUILDINGS.find(x => x.id === id);
    for(let k in b.req) player.inv[k] -= b.req[k];
    updateInventoryUI();

    currentState = GAME_STATE.PLAYING;
    placementState = b.id; // active placement ghost
};

function finalizePlacement(targetX, targetY) {
    structures.push({
        x: targetX, y: targetY, type: placementState
    });
    playSound('chop');
    spawnParticles(targetX, targetY, '#8D6E63', 20);
    placementState = null;
}

// --- 7. RENDERING ENGINE ---
function render() {
    if(currentState !== GAME_STATE.PLAYING) return;

    // Viewport bounds calculation
    const startCol = Math.floor((camera.x) / TILE_SIZE);
    const endCol = startCol + (width / TILE_SIZE) + 2;
    const startRow = Math.floor((camera.y) / TILE_SIZE);
    const endRow = startRow + (height / TILE_SIZE) + 2;

    // 1. Render Terrain Base
    for (let c = startCol - 1; c <= endCol; c++) {
        for (let r = startRow - 1; r <= endRow; r++) {
            let type = getTerrainType(c*TILE_SIZE, r*TILE_SIZE);
            let px = c * TILE_SIZE - camera.x;
            let py = r * TILE_SIZE - camera.y;
            
            if(assets[type]) {
                ctx.drawImage(assets[type], px, py, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    // Prepare Dynamic Rendering List for Z-Sorting (Y-sorting for pseudo 3D)
    let renderables = [];
    
    // Objects
    objects.forEach(obj => {
        if(obj.x > camera.x - 100 && obj.x < camera.x + width + 100 &&
           obj.y > camera.y - 100 && obj.y < camera.y + height + 100) {
            renderables.push({ type: 'img', asset: obj.asset, x: obj.x, y: obj.y, w: 64, h: 64, sortY: obj.y });
        }
    });

    // Structures
    structures.forEach(st => {
        if(st.x > camera.x - 100 && st.x < camera.x + width + 100 &&
           st.y > camera.y - 100 && st.y < camera.y + height + 100) {
            let assetName = st.type === 'shelter' ? 'shelter' : 'campfire';
            let sSize = st.type === 'shelter' ? 100 : 50;
            renderables.push({ type: 'img', asset: assetName, x: st.x, y: st.y, w: sSize, h: sSize, sortY: st.y });
        }
    });

    // Animals
    animals.forEach(ani => {
        if(ani.x > camera.x - 50 && ani.x < camera.x + width + 50 &&
           ani.y > camera.y - 50 && ani.y < camera.y + height + 50) {
            renderables.push({ type: 'rect', color: ani.type === 'wolf' ? '#424242' : '#F48FB1', x: ani.x, y: ani.y, w: 30, h: 30, sortY: ani.y });
        }
    });

    // Player
    renderables.push({ type: 'player', x: player.x, y: player.y, w: player.width, h: player.height, sortY: player.y });

    // Z-Sort
    renderables.sort((a, b) => a.sortY - b.sortY);

    // 2. Draw Renderables
    renderables.forEach(item => {
        let px = item.x - camera.x;
        let py = item.y - camera.y;

        if(item.type === 'img') {
            if(assets[item.asset]) {
                // Center pivot drawing
                ctx.drawImage(assets[item.asset], px - item.w/2, py - item.h/2, item.w, item.h);
            }
        } else if(item.type === 'rect') {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath(); ctx.ellipse(px, py+10, item.w/2, 5, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = item.color;
            ctx.fillRect(px - item.w/2, py - item.h/2, item.w, item.h);
        } else if(item.type === 'player') {
            // Draw player via asset
            ctx.save();
            ctx.translate(px, py);
            if(player.dirX < 0) ctx.scale(-1, 1); // Flip horizontally if moving left
            ctx.drawImage(assets['player'], -20, -25, 40, 50);
            
            // Draw equipped tool
            if(player.isMoving || keys[' ']) {
                ctx.fillStyle = '#795548'; // sword/tool handle
                ctx.fillRect(0, -10, 20, 4);
                // Simple animation wobble
                let rot = Math.sin(Date.now() * 0.01) * 0.5;
                ctx.rotate(rot);
            }
            ctx.restore();
        }
    });

    // 3. Draw placement ghost
    if(placementState) {
        let mx = camera.x + width/2; // place in front of player
        let targetX = player.x + player.dirX * 80;
        let targetY = player.y + player.dirY * 80;
        
        ctx.globalAlpha = 0.5;
        let assetName = placementState === 'shelter' ? 'shelter' : 'campfire';
        let sSize = placementState === 'shelter' ? 100 : 50;
        ctx.drawImage(assets[assetName], targetX - camera.x - sSize/2, targetY - camera.y - sSize/2, sSize, sSize);
        ctx.globalAlpha = 1.0;
        
        // Draw interaction key prompt
        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.fillText('Press SPACE / Tap Center to Place', targetX - camera.x - 100, targetY - camera.y + 60);
    }

    // 4. Draw Particles
    particles.forEach(p => {
        let px = p.x - camera.x;
        let py = p.y - camera.y;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(px, py, 6, 6);
    });
    ctx.globalAlpha = 1.0;
}

// --- 8. LOOP ---
let lastTime = performance.now();
function gameLoop() {
    let time = performance.now();
    let dt = time - lastTime;
    if (dt > 100) dt = 16.66; // clamp massive lag spikes
    lastTime = time;
    let timeScale = dt / 16.66; // normalize to 60fps

    if(currentState === GAME_STATE.PLAYING) {
        updatePlayer(timeScale);
        updateEnvironment(timeScale);
        render();
    }
    
    requestAnimationFrame(gameLoop);
}

// --- 9. INPUT BINDINGS ---
window.addEventListener('keydown', e => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) {
        e.preventDefault(); // Prevent page scrolling on desktop
    }
    keys[e.key] = true;
    if(currentState === GAME_STATE.PLAYING) {
        if(e.key === ' ' || e.key === 'e') {
            if(placementState) {
                let targetX = player.x + player.dirX * 80;
                let targetY = player.y + player.dirY * 80;
                finalizePlacement(targetX, targetY);
            } else {
                performAction();
            }
        }
    }
    if(e.key === 'c') openCrafting();
    if(e.key === 'b') openBuilding();
    if(e.key === 'Escape') {
        ui.craftWindow.classList.add('hidden');
        ui.buildWindow.classList.add('hidden');
        currentState = GAME_STATE.PLAYING;
    }
});

window.addEventListener('keyup', e => {
    keys[e.key] = false;
});

// UI Buttons
document.getElementById('btnStartGame').addEventListener('click', () => {
    try { audioCtx.resume(); } catch(e){} // Browser policy requirement
    ui.startScreen.classList.remove('active');
    ui.startScreen.classList.add('hidden');
    ui.startScreen.style.display = 'none'; // absolute force hide
    ui.uiContainer.classList.remove('hidden');
    initWorld();
    lastTime = performance.now(); // reset timer on start
    currentState = GAME_STATE.PLAYING;
});

document.getElementById('btnRestart').addEventListener('click', restartGame);
document.getElementById('btnCraft').addEventListener('click', openCrafting);
document.getElementById('btnBuild').addEventListener('click', openBuilding);

document.getElementById('closeCrafting').addEventListener('click', () => {
    ui.craftWindow.classList.add('hidden');
    currentState = GAME_STATE.PLAYING;
});
document.getElementById('closeBuilding').addEventListener('click', () => {
    ui.buildWindow.classList.add('hidden');
    currentState = GAME_STATE.PLAYING;
});

document.getElementById('btnSound').addEventListener('click', (e) => {
    isSoundEnabled = !isSoundEnabled;
    e.target.innerText = isSoundEnabled ? '🔊' : '🔇';
});

// Mobile Controls
const stickBase = document.getElementById('joystickBase');
const stick = document.getElementById('joystickStick');
const zone = document.getElementById('joystickZone');

zone.addEventListener('touchstart', handleJoystickStart);
zone.addEventListener('touchmove', handleJoystickMove);
zone.addEventListener('touchend', handleJoystickEnd);

function handleJoystickStart(e) {
    joystick.active = true;
    const touch = e.changedTouches[0];
    joystick.x = touch.clientX;
    joystick.y = touch.clientY;
}
function handleJoystickMove(e) {
    if(!joystick.active) return;
    const touch = e.changedTouches[0];
    let dx = touch.clientX - joystick.x;
    let dy = touch.clientY - joystick.y;
    let dist = Math.sqrt(dx*dx + dy*dy);
    let maxDist = 40;
    
    if(dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
    }
    
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    joystick.dx = dx / maxDist;
    joystick.dy = dy / maxDist;
}
function handleJoystickEnd(e) {
    joystick.active = false;
    joystick.dx = 0; joystick.dy = 0;
    stick.style.transform = `translate(0px, 0px)`;
}

// Action Buttons Support Mouse & Touch
function handleInteractAction(e) {
    e.preventDefault();
    if(placementState) {
        let targetX = player.x + player.dirX * 80;
        let targetY = player.y + player.dirY * 80;
        finalizePlacement(targetX, targetY);
    } else {
        performAction();
    }
}

function handleHitAction(e) {
    e.preventDefault();
    performAction();
}

document.getElementById('btnInteract').addEventListener('mousedown', handleInteractAction);
document.getElementById('btnInteract').addEventListener('touchstart', handleInteractAction, {passive: false});

document.getElementById('btnHit').addEventListener('mousedown', handleHitAction);
document.getElementById('btnHit').addEventListener('touchstart', handleHitAction, {passive: false});

// Quickbar Logic
document.querySelectorAll('.inv-slot').forEach(slot => {
    slot.addEventListener('pointerdown', (e) => {
        document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        let slotId = e.currentTarget.getAttribute('data-slot');
        playSound('chop'); 
        
        if (slotId === '2') { // Food
            if (player.inv.food > 0) {
                player.inv.food--;
                player.hunger = Math.min(player.maxHunger, player.hunger + 30);
                playSound('collect');
                spawnParticles(player.x, player.y, '#e53935', 10);
                updateInventoryUI();
            }
        } else if (slotId === '3') { // Water
            if (player.inv.water > 0) {
                player.inv.water--;
                player.energy = Math.min(player.maxEnergy, player.energy + 30);
                playSound('collect');
                spawnParticles(player.x, player.y, '#42a5f5', 10);
                updateInventoryUI();
            }
        }
    });
});

// Initialize on Load
updateInventoryUI();
requestAnimationFrame(gameLoop);
