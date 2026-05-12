/**
 * Police Chase Escape - Realistic Map Overhaul & Mechanics
 */

const CONFIG = {
    FPS_TARGET: 60,
    MAP_SIZE: 8000,
    TILE_SIZE: 400, // Larger city blocks
    ROAD_WIDTH: 150,
    PLAYER: {
        MAX_HEALTH: 100,
    },
    COLORS: {
        ROAD: '#1e1e24',
        ROAD_LINE: '#ffffff',
        SIDEWALK: '#333333',
        GRASS: '#1e3328', // Park green
        BUILDING_BASE: '#0f0f15',
        BUILDING_TOP: '#1c1c24',
        BUILDING_NEON: ['#00e5ff', '#ffaa00', '#ea0038', '#9b59b6'],
        COP_CAR: '#ffffff',
        TRAFFIC: ['#3498db', '#e74c3c', '#95a5a6', '#f1c40f']
    },
    CARS: [
        { id: 0, name: 'STREET SCRAMBLER', color: '#ffaa00', price: 0, speed: 25, handling: 0.08, nitro: 80, length: 60, width: 30 },
        { id: 1, name: 'MUSCLE BEAST', color: '#ea0038', price: 3000, speed: 28, handling: 0.06, nitro: 120, length: 65, width: 32 },
        { id: 2, name: 'NEON HYPERCAR', color: '#00e5ff', price: 10000, speed: 32, handling: 0.09, nitro: 100, length: 55, width: 28 }
    ]
};

let GAME = {
    state: 'MENU',
    level: 1,
    cash: 15000, // Starting cash for testing
    ownedCars: [0], // IDs of owned cars
    selectedCar: 0,
    upgrades: { speed: 0, handling: 0, nitro: 0 },
    stats: { survivalTime: 0, score: 0, wantedLevel: 1, driftScore: 0 },
    levelData: null,
    lastTime: 0,
    deltaTime: 0,
    keys: {},
    isMobile: false
};

// Sub-systems
let ctx, canvas, miniCtx, miniCanvas;
let player, camera;
let entities = [];
let particles = [];
let buildings = []; // Now acting as collision bounds
let parks = [];
let roads = [];
let signals = [];
let soundSystem;

const UI = {
    screens: {
        loading: document.getElementById('loading-screen'),
        menu: document.getElementById('main-menu'),
        carSelect: document.getElementById('car-select-screen'),
        guide: document.getElementById('guide-screen'),
        levels: document.getElementById('level-select'),
        garage: document.getElementById('garage-screen'),
        hud: document.getElementById('hud-screen'),
        gameOver: document.getElementById('game-over-screen'),
        complete: document.getElementById('level-complete-screen')
    },
    hud: {
        level: document.getElementById('hud-level'),
        timer: document.getElementById('hud-timer'),
        score: document.getElementById('hud-score'),
        speed: document.getElementById('hud-speed'),
        nitroFill: document.getElementById('hud-nitro-fill'),
        healthFill: document.getElementById('hud-health-fill'),
        stars: document.getElementById('hud-stars'),
        copProximity: document.getElementById('cop-proximity')
    },
    fx: document.getElementById('screen-fx')
};

// --- INITIALIZATION ---
window.onload = () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d', { alpha: false });
    miniCanvas = document.getElementById('minimapCanvas');
    miniCtx = miniCanvas.getContext('2d');
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    GAME.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;
    
    if (GAME.isMobile) {
        document.getElementById('mobile-controls').style.display = 'flex';
    }

    setupInput();
    setupSound();
    populateLevels();
    loadSaveData();
    setupCarSelection();
    updateMenuUI();

    let progress = 0;
    let loadingInterval = setInterval(() => {
        progress += 8;
        document.getElementById('loading-bar').style.width = `${progress}%`;
        if (progress >= 100) {
            clearInterval(loadingInterval);
            switchScreen('menu');
        }
    }, 50);

    requestAnimationFrame(gameLoop);
};

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function switchScreen(screenName) {
    Object.values(UI.screens).forEach(s => s.classList.add('hidden'));
    UI.screens[screenName].classList.remove('hidden');
    GAME.state = screenName.toUpperCase();
}

// --- SETUP & BINDINGS ---
function setupInput() {
    window.addEventListener('keydown', e => { 
        GAME.keys[e.key.toLowerCase()] = true; 
        if(e.key === 'Shift') GAME.keys['shift'] = true;
    });
    window.addEventListener('keyup', e => { 
        GAME.keys[e.key.toLowerCase()] = false; 
        if(e.key === 'Shift') GAME.keys['shift'] = false;
    });

    document.getElementById('btn-car-select').onclick = () => switchScreen('carSelect');
    document.getElementById('btn-back-car').onclick = () => switchScreen('menu');
    document.getElementById('btn-play-selected').onclick = () => switchScreen('guide');
    document.getElementById('btn-start-game-from-guide').onclick = () => startGame(GAME.level);
    document.getElementById('btn-close-guide').onclick = () => startGame(GAME.level);
    document.getElementById('btn-garage').onclick = () => switchScreen('garage');
    document.getElementById('btn-levels').onclick = () => switchScreen('levels');
    document.getElementById('btn-back-levels').onclick = () => switchScreen('menu');
    document.getElementById('btn-back-garage').onclick = () => switchScreen('menu');
    
    document.getElementById('btn-retry').onclick = () => startGame(GAME.level);
    document.querySelectorAll('.menu-return').forEach(b => b.onclick = () => switchScreen('menu'));
    document.getElementById('btn-next-level').onclick = () => { GAME.level++; startGame(GAME.level); };

    const bindBtn = (id, key) => {
        const btn = document.getElementById(id);
        if(!btn) return;
        ['touchstart', 'mousedown'].forEach(ev => btn.addEventListener(ev, e => { e.preventDefault(); GAME.keys[key] = true; }));
        ['touchend', 'mouseup', 'mouseleave'].forEach(ev => btn.addEventListener(ev, e => { e.preventDefault(); GAME.keys[key] = false; }));
    };
    bindBtn('btn-left', 'a'); bindBtn('btn-right', 'd'); bindBtn('btn-brake', 's'); bindBtn('btn-nitro', 'shift');
}

function setupSound() {
    // Basic stub matching previous logic
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    let ctxAudio = null; let engineOsc = null; let sirenOsc = null; let isMuted = false;

    document.getElementById('btn-sound').onclick = (e) => {
        isMuted = !isMuted; e.target.innerHTML = isMuted ? '🔇' : '🔊';
        if (ctxAudio) { if(isMuted) ctxAudio.suspend(); else ctxAudio.resume(); }
    };

    soundSystem = {
        init: () => { if(!ctxAudio) { try { ctxAudio = new AudioContext(); } catch(e) {} } },
        playEngine: (rpmRatio) => {
            if(!ctxAudio || isMuted) return;
            if(!engineOsc) {
                engineOsc = ctxAudio.createOscillator(); engineOsc.type = 'sawtooth';
                let gain = ctxAudio.createGain(); gain.gain.value = 0.03;
                engineOsc.connect(gain); gain.connect(ctxAudio.destination); engineOsc.start();
            }
            engineOsc.frequency.setTargetAtTime(40 + (rpmRatio * 120), ctxAudio.currentTime, 0.1);
        },
        stopEngine: () => { if(engineOsc) { engineOsc.stop(); engineOsc.disconnect(); engineOsc = null; } },
        playSiren: (intensity) => {
            if(!ctxAudio || isMuted) return;
            if(!sirenOsc) {
                sirenOsc = ctxAudio.createOscillator(); sirenOsc.type = 'sine';
                let gain = ctxAudio.createGain(); gain.gain.value = 0.05 * intensity;
                sirenOsc.connect(gain); gain.connect(ctxAudio.destination); sirenOsc.start();
                let lfo = ctxAudio.createOscillator(); lfo.frequency.value = 2.5;
                let lfoGain = ctxAudio.createGain(); lfoGain.gain.value = 400;
                lfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency); lfo.start();
                sirenOsc.lfo = lfo;
            }
            sirenOsc.frequency.setTargetAtTime(800, ctxAudio.currentTime, 0.1);
        },
        stopSiren: () => { if(sirenOsc) { sirenOsc.lfo.stop(); sirenOsc.stop(); sirenOsc = null; } },
        playCrash: () => {
            if(!ctxAudio || isMuted) return;
            let osc = ctxAudio.createOscillator(); let gain = ctxAudio.createGain();
            osc.type = 'square'; osc.frequency.setValueAtTime(150, ctxAudio.currentTime);
            osc.frequency.exponentialRampToValueAtTime(10, ctxAudio.currentTime + 0.3);
            gain.gain.setValueAtTime(0.3, ctxAudio.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctxAudio.currentTime + 0.3);
            osc.connect(gain); gain.connect(ctxAudio.destination); osc.start(); osc.stop(ctxAudio.currentTime + 0.3);
        }
    };
}

// --- SAVE & CAR SELECTION ---
function loadSaveData() {
    let dCash = localStorage.getItem('pc_cash'); if (dCash) GAME.cash = parseInt(dCash);
    let dOwned = localStorage.getItem('pc_owned_cars'); if (dOwned) GAME.ownedCars = JSON.parse(dOwned);
    let dSel = localStorage.getItem('pc_sel_car'); if(dSel) GAME.selectedCar = parseInt(dSel);
    ['speed', 'handling', 'nitro'].forEach(stat => {
        let val = localStorage.getItem(`pc_upg_${stat}`); if (val) GAME.upgrades[stat] = parseInt(val);
    });
    localStorage.setItem('lvl_1_unlocked', 'true');
    setupGarage();
}
function saveGame() {
    localStorage.setItem('pc_cash', GAME.cash);
    localStorage.setItem('pc_owned_cars', JSON.stringify(GAME.ownedCars));
    localStorage.setItem('pc_sel_car', GAME.selectedCar);
    ['speed', 'handling', 'nitro'].forEach(stat => localStorage.setItem(`pc_upg_${stat}`, GAME.upgrades[stat]));
}
function updateMenuUI() {
    document.getElementById('garage-cash').innerText = `$${GAME.cash}`;
}

function setupCarSelection() {
    const cont = document.getElementById('car-carousel');
    cont.innerHTML = '';
    
    const updateStats = (carId) => {
        let c = CONFIG.CARS[carId];
        document.getElementById('cs-name').innerText = c.name;
        document.getElementById('cs-speed').style.width = `${(c.speed/35)*100}%`;
        document.getElementById('cs-handling').style.width = `${(c.handling/0.1)*100}%`;
        document.getElementById('cs-nitro').style.width = `${(c.nitro/120)*100}%`;
        
        let playBtn = document.getElementById('btn-play-selected');
        let isOwned = GAME.ownedCars.includes(carId);
        if (isOwned) {
            playBtn.innerHTML = '<span>SELECT & PLAY</span>';
            playBtn.style.background = '';
            playBtn.onclick = () => { GAME.selectedCar = carId; saveGame(); switchScreen('guide'); };
        } else {
            playBtn.innerHTML = `<span>BUY $${c.price}</span>`;
            playBtn.style.background = 'rgba(234, 0, 56, 0.2)';
            playBtn.onclick = () => {
                if (GAME.cash >= c.price) {
                    GAME.cash -= c.price;
                    GAME.ownedCars.push(carId);
                    saveGame();
                    updateMenuUI();
                    setupCarSelection(); // refresh view
                } else {
                    playBtn.innerHTML = '<span>NOT ENOUGH CASH</span>';
                    setTimeout(()=> updateStats(carId), 1000);
                }
            };
        }
    };

    CONFIG.CARS.forEach(car => {
        let div = document.createElement('div');
        div.className = `car-card ${GAME.selectedCar === car.id ? 'selected' : ''}`;
        div.innerHTML = `
            <div class="car-card-img" style="background-color: ${car.color}; mask: url('assets/images/icon.png') center/contain; -webkit-mask: url('assets/images/icon.png') center/contain; border-radius: 10px;"></div>
            <h3>${car.name}</h3>
            ${GAME.ownedCars.includes(car.id) ? '' : '<span class="lock">🔒</span>'}
        `;
        div.onclick = () => {
            document.querySelectorAll('.car-card').forEach(c => c.classList.remove('selected'));
            div.classList.add('selected');
            updateStats(car.id);
        };
        cont.appendChild(div);
    });
    // Init stats for current
    updateStats(GAME.selectedCar);
}

function populateLevels() {
    const container = document.getElementById('levels-container'); container.innerHTML = '';
    for(let i = 1; i <= 40; i++) {
        let isUnlocked = localStorage.getItem(`lvl_${i}_unlocked`) === 'true' || i === 1;
        let btn = document.createElement('div'); btn.className = `level-btn ${isUnlocked ? '' : 'locked'}`;
        btn.innerHTML = `<span class="num">${i}</span>`;
        if (isUnlocked) btn.onclick = () => startGame(i);
        container.appendChild(btn);
    }
}

function setupGarage() {
    const cost = 500;
    ['speed', 'handling', 'nitro'].forEach(stat => {
        let btn = document.getElementById(`upg-${stat}`);
        let bars = document.getElementById(`stat-${stat}-bars`).querySelectorAll('span');
        let updateUI = () => {
            let val = GAME.upgrades[stat];
            bars.forEach((b, i) => b.className = i < val ? 'filled' : '');
            if (val >= 5) { btn.innerText = 'MAX'; btn.disabled = true; btn.style.opacity = '0.5'; }
            else btn.innerText = `BUY $${cost * (val+1)}`;
        };
        updateUI();
        btn.onclick = () => {
            let price = cost * (GAME.upgrades[stat] + 1);
            if (GAME.cash >= price && GAME.upgrades[stat] < 5) {
                GAME.cash -= price; GAME.upgrades[stat]++; saveGame(); updateMenuUI(); updateUI();
            } else { btn.style.borderColor = 'red'; setTimeout(() => btn.style.borderColor = '', 200); }
        };
    });
}

// --- GAME LOGIC & WORLD GEN ---
function getLevelConfig(lvl) {
    return {
        timeToEscape: 40 + (lvl * 5),
        wantedLevel: Math.min(5, Math.ceil(lvl / 8)),
        maxCops: Math.min(15, 2 + Math.floor(lvl / 2)),
        trafficDensity: Math.min(0.8, 0.15 + (lvl * 0.02))
    };
}

function startGame(lvl) {
    soundSystem.init();
    GAME.level = lvl; GAME.levelData = getLevelConfig(lvl);
    GAME.stats = { survivalTime: GAME.levelData.timeToEscape, score: 0, wantedLevel: GAME.levelData.wantedLevel, driftScore: 0 };
    
    let baseCar = CONFIG.CARS[GAME.selectedCar];
    let upg = GAME.upgrades;
    player = {
        x: CONFIG.MAP_SIZE / 2, y: CONFIG.MAP_SIZE / 2,
        vx: 0, vy: 0, angle: -Math.PI / 2, speed: 0,
        width: baseCar.width, length: baseCar.length,
        health: CONFIG.PLAYER.MAX_HEALTH,
        nitro: baseCar.nitro + (upg.nitro * 20),
        nitroCap: baseCar.nitro + (upg.nitro * 20),
        isDrifting: false,
        maxSpeed: baseCar.speed + (upg.speed * 2),
        handling: baseCar.handling + (upg.handling * 0.01),
        driftFactor: 0.95 + (upg.handling * 0.005),
        color: baseCar.color,
        type: 'player'
    };
    camera = { x: player.x, y: player.y, zoom: 1 };
    
    generateRealisticCity();
    
    // Move player to nearest road center
    for(let r of roads) {
        if(r.layout === 'H' && player.x > r.x && player.x < r.x + r.w) { player.y = r.y + r.h/2; break; }
        if(r.layout === 'V' && player.y > r.y && player.y < r.y + r.h) { player.x = r.x + r.w/2; break; }
    }

    entities = []; particles = [];
    switchScreen('hud');
    GAME.lastTime = performance.now();
}

function generateRealisticCity() {
    buildings = []; roads = []; parks = []; signals = [];
    let ts = CONFIG.TILE_SIZE;
    let rw = CONFIG.ROAD_WIDTH;
    
    // Grid generation
    for(let i=0; i<CONFIG.MAP_SIZE; i+=ts) {
        for(let j=0; j<CONFIG.MAP_SIZE; j+=ts) {
            // Is it an intersection/road?
            let isRoadH = (j % (ts*2) === 0);
            let isRoadV = (i % (ts*2) === 0);
            
            if (isRoadH && !isRoadV) {
                roads.push({x: i, y: j, w: ts, h: rw, layout:'H'});
            } else if (isRoadV && !isRoadH) {
                roads.push({x: i, y: j, w: rw, h: ts, layout:'V'});
            } else if (isRoadH && isRoadV) {
                roads.push({x: i, y: j, w: rw, h: rw, layout:'I'}); // Intersection
                if(Math.random() > 0.5) {
                    signals.push({x: i, y: j, state: Math.random()>0.5?'G':'R', timer: 5});
                }
            } else {
                // City Block
                let blockX = i + rw/2 + 20; 
                let blockY = j + rw/2 + 20;
                let blockW = ts - rw - 40;
                
                if (Math.random() < 0.15) {
                    parks.push({x: blockX, y: blockY, w: blockW, h: blockW});
                } else {
                    buildings.push({
                        x: blockX, y: blockY, width: blockW, height: blockW,
                        tallness: 100 + Math.random() * 300,
                        neon: CONFIG.COLORS.BUILDING_NEON[Math.floor(Math.random()*CONFIG.COLORS.BUILDING_NEON.length)]
                    });
                }
            }
        }
    }
}

// Map bounds physics helper
function isPointInBuilding(x, y) {
    // Check map borders
    if(x < 0 || x > CONFIG.MAP_SIZE || y < 0 || y > CONFIG.MAP_SIZE) return true;
    for(let b of buildings) {
        if(x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return true;
    }
    return false;
}

function updatePhysics(dt) {
    let inputForce = 0;
    if (GAME.isMobile) {
        inputForce = 1; 
        if(GAME.keys['s']) inputForce = -1;
    } else {
        if(GAME.keys['w'] || GAME.keys['arrowup']) inputForce = 1;
        if(GAME.keys['s'] || GAME.keys['arrowdown']) inputForce = -1;
    }

    let turnDir = 0;
    if(GAME.keys['a'] || GAME.keys['arrowleft']) turnDir = -1;
    if(GAME.keys['d'] || GAME.keys['arrowright']) turnDir = 1;

    let useNitro = GAME.keys['shift'] && player.nitro > 0;

    if (inputForce > 0) { player.speed += 0.4 * (useNitro ? 1.8 : 1); } 
    else if (inputForce < 0) { player.speed -= 0.8; } 
    else { player.speed *= 0.9; }
    
    if(useNitro) {
        player.nitro -= 0.5;
        UI.fx.className = 'nitro-active';
        camera.zoom += (0.8 - camera.zoom) * 0.1; // Zoom out for speed effect
        // Exhaust flames
        spawnParticle(player.x - Math.cos(player.angle)*30, player.y - Math.sin(player.angle)*30, '#00e5ff', 0.2, true);
    } else {
        player.nitro = Math.min(player.nitroCap, player.nitro + 0.1);
        if(UI.fx.className === 'nitro-active') UI.fx.className = '';
    }

    let cap = useNitro ? player.maxSpeed * 1.5 : player.maxSpeed;
    if(player.speed > cap) player.speed = cap;
    if(player.speed < -player.maxSpeed/2) player.speed = -player.maxSpeed/2;

    if (Math.abs(player.speed) > 1) {
        player.angle += turnDir * player.handling * Math.sign(player.speed) * (1 - (Math.abs(player.speed)/cap)*0.3);
    }

    let targetVx = Math.cos(player.angle) * player.speed;
    let targetVy = Math.sin(player.angle) * player.speed;
    let grip = GAME.keys[' '] || (useNitro && Math.abs(turnDir) > 0) ? player.driftFactor * 0.85 : player.driftFactor; 
    
    player.vx = player.vx * (1 - grip) + targetVx * grip;
    player.vy = player.vy * (1 - grip) + targetVy * grip;

    // DRIFT SCORE & FX
    let headingVec = Math.atan2(player.vy, player.vx);
    let angleDiff = Math.abs(player.angle - headingVec);
    angleDiff = Math.min(angleDiff, Math.PI*2 - angleDiff);
    
    if (angleDiff > 0.3 && Math.abs(player.speed) > 5) {
        GAME.stats.driftScore += Math.floor(angleDiff * 10);
        if (Math.random() > 0.5) spawnParticle(player.x - Math.cos(player.angle)*20, player.y - Math.sin(player.angle)*20, '#dddddd', 0.5);
        soundSystem.playEngine(1.2);
    } else {
        soundSystem.playEngine(Math.abs(player.speed) / player.maxSpeed);
    }

    // POSITION UPDATE & WALL COLLISION
    let nextX = player.x + player.vx;
    let nextY = player.y + player.vy;

    // Predict corners for block
    if (isPointInBuilding(nextX + Math.cos(player.angle)*player.length/2, nextY + Math.sin(player.angle)*player.length/2) || 
        isPointInBuilding(nextX, nextY)) {
        // Wall Crash
        player.speed *= -0.5; // Bounce back
        player.health -= Math.abs(player.vx + player.vy); // Damage
        soundSystem.playCrash();
        UI.fx.className = 'damaged'; setTimeout(()=> { if(UI.fx.className === 'damaged') UI.fx.className = ''; }, 150);
        for(let i=0; i<8; i++) spawnParticle(player.x, player.y, '#FFAA00', 0.5, true);
    } else {
        player.x = nextX;
        player.y = nextY;
    }

    // COPS & TRAFFIC AI
    for(let i=entities.length-1; i>=0; i--) {
        let e = entities[i];
        if (e.type === 'cop') {
            let targetAngle = Math.atan2(player.y - e.y, player.x - e.x);
            let angleDiff = targetAngle - e.angle;
            while(angleDiff <= -Math.PI) angleDiff += Math.PI*2;
            while(angleDiff > Math.PI) angleDiff -= Math.PI*2;
            
            e.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.08 * (1+e.aggression));
            let distToPlayer = Math.hypot(player.x - e.x, player.y - e.y);
            if (distToPlayer > 150) e.speed += 0.5; else e.speed -= 0.5;
            e.speed = Math.min(e.maxSpeed, Math.max(-5, e.speed));
            
            e.vx = Math.cos(e.angle) * e.speed; e.vy = Math.sin(e.angle) * e.speed;
            
            // Cop Wall check
            if (!isPointInBuilding(e.x + e.vx, e.y + e.vy)) { e.x += e.vx; e.y += e.vy; }
            else { e.angle += Math.PI/2; e.speed *= 0.5; } // Simple bounce avoid

            if(distToPlayer < 1000) soundSystem.playSiren(1 - distToPlayer/1000);
            
        } else if (e.type === 'traffic') {
            e.vx = Math.cos(e.angle) * e.speed; e.vy = Math.sin(e.angle) * e.speed;
            if (!isPointInBuilding(e.x + e.vx, e.y + e.vy)) { e.x += e.vx; e.y += e.vy; }
            else { e.angle += Math.PI; } // reverse
        }

        // Broadphase Collision Entities
        let dist = Math.hypot(player.x - e.x, player.y - e.y);
        let minRadius = (player.length + e.length)/2;
        if (dist < minRadius) handleCarCollision(player, e);

        // Despawn far
        if(Math.hypot(e.x - player.x, e.y - player.y) > 2500) entities.splice(i, 1);
    }

    for(let i=particles.length-1; i>=0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= dt;
        if(p.life <= 0) particles.splice(i, 1);
    }

    if (player.health <= 0) endGame(false);
}

function handleCarCollision(c1, c2) {
    let impact = Math.abs(c1.speed - c2.speed);
    if(impact < 5) return;
    soundSystem.playCrash();
    if(c1 === player || c2 === player) {
        UI.fx.className = 'damaged'; setTimeout(()=> { if(UI.fx.className === 'damaged') UI.fx.className = ''; }, 150);
    }
    c1.health -= impact * 0.5; c2.health -= impact * 0.5;

    let angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
    c1.vx -= Math.cos(angle) * impact; c1.vy -= Math.sin(angle) * impact; c1.speed *= 0.5;
    c2.vx += Math.cos(angle) * impact; c2.vy += Math.sin(angle) * impact; c2.speed *= 0.5;

    for(let i=0; i<5; i++) spawnParticle((c1.x+c2.x)/2, (c1.y+c2.y)/2, '#FFAA00', 0.2, true);

    if (c2.health <= 0 && c2 !== player) {
        c2.dead = true; GAME.stats.score += 100;
        for(let i=0; i<15; i++) spawnParticle(c2.x, c2.y, '#ea0038', 0.5, true);
    }
}

function updateCamera() {
    let leadX = player.x + player.vx * 15; let leadY = player.y + player.vy * 15;
    camera.x += (leadX - camera.x) * 0.1; camera.y += (leadY - camera.y) * 0.1;
    let targetZoom = 1 - (Math.abs(player.speed) / player.maxSpeed) * 0.2;
    if(GAME.keys['shift'] && player.nitro > 0) targetZoom -= 0.1; // Extra zoom for nitro
    camera.zoom += (targetZoom - camera.zoom) * 0.05;
}

function updateGameLogic(dt) {
    GAME.stats.survivalTime -= dt;
    if (GAME.stats.survivalTime <= 0) { endGame(true); return; }

    if (Math.random() < 0.05 && entities.length < GAME.levelData.maxCops) {
        let ang = Math.random() * Math.PI * 2;
        // ensure spawn on road
        let rx = player.x + Math.cos(ang) * 1000; let ry = player.y + Math.sin(ang) * 1000;
        if(!isPointInBuilding(rx, ry)) {
            entities.push({
                type: 'cop', x: rx, y: ry, vx: 0, vy: 0, angle: 0, speed: 0,
                width: 32, length: 64, maxSpeed: player.maxSpeed * (0.8 + (GAME.stats.wantedLevel * 0.05)),
                aggression: GAME.stats.wantedLevel * 0.2, health: 50, color: CONFIG.COLORS.COP_CAR
            });
        }
    }
    
    // Signals
    signals.forEach(s => {
        s.timer -= dt;
        if(s.timer <= 0) { s.state = s.state === 'G' ? 'R' : 'G'; s.timer = 5; }
    });

    GAME.stats.score += dt * 10 * GAME.stats.wantedLevel;
    GAME.levelData.wantedLevel = Math.min(5, Math.ceil((1 - GAME.stats.survivalTime / getLevelConfig(GAME.level).timeToEscape) * 5));
    GAME.stats.wantedLevel = GAME.levelData.wantedLevel;
    entities = entities.filter(e => !e.dead);
}

function updateHUD() {
    if(GAME.state !== 'HUD') return;
    UI.hud.timer.innerText = Math.max(0, GAME.stats.survivalTime).toFixed(1);
    if(GAME.stats.survivalTime < 10) UI.hud.timer.parentElement.classList.add('critical'); else UI.hud.timer.parentElement.classList.remove('critical');
    UI.hud.score.innerText = Math.floor(GAME.stats.score + GAME.stats.driftScore);
    UI.hud.speed.innerText = Math.floor(Math.abs(player.speed) * 4);
    UI.hud.nitroFill.style.width = `${(player.nitro/player.nitroCap)*100}%`;
    UI.hud.healthFill.style.width = `${(player.health/CONFIG.PLAYER.MAX_HEALTH)*100}%`;
    if(player.health < 30) UI.hud.healthFill.style.backgroundColor = '#ea0038'; else UI.hud.healthFill.style.backgroundColor = '#2ecc71';
    
    let strs = ''; for(let i=0; i<5; i++) strs += i < GAME.stats.wantedLevel ? '★ ' : '☆ ';
    UI.hud.stars.innerText = strs; UI.hud.stars.className = `star-container w${GAME.stats.wantedLevel}`;
    
    let nd = 9999; entities.forEach(e => { if(e.type==='cop') nd = Math.min(nd, Math.hypot(e.x-player.x, e.y-player.y)); });
    if(nd < 300) UI.hud.copProximity.classList.add('active'); else UI.hud.copProximity.classList.remove('active');

    renderMinimap();
}

function renderMinimap() {
    miniCtx.clearRect(0,0,miniCanvas.width, miniCanvas.height);
    miniCtx.fillStyle = '#101015'; miniCtx.fillRect(0,0,miniCanvas.width, miniCanvas.height);
    
    let mScale = 0.05;
    let cx = miniCanvas.width/2; let cy = miniCanvas.height/2;

    // Draw Roads on minimap
    miniCtx.fillStyle = '#333';
    roads.forEach(r => {
        let mx = cx + (r.x - player.x) * mScale;
        let my = cy + (r.y - player.y) * mScale;
        miniCtx.fillRect(mx, my, r.w * mScale, r.h * mScale);
    });

    // Draw Parks
    miniCtx.fillStyle = '#1e3328';
    parks.forEach(p => {
        let mx = cx + (p.x - player.x) * mScale;
        let my = cy + (p.y - player.y) * mScale;
        miniCtx.fillRect(mx, my, p.w * mScale, p.h * mScale);
    });

    // Cops (Red pixels)
    miniCtx.fillStyle = 'red';
    entities.forEach(e => {
        if(e.type === 'cop') {
            let mx = cx + (e.x - player.x) * mScale;
            let my = cy + (e.y - player.y) * mScale;
            miniCtx.beginPath(); miniCtx.arc(mx, my, 3, 0, Math.PI*2); miniCtx.fill();
        }
    });

    // Player (Green triangle pointing up always since map is relative to world, not rotated, actually let's draw dot)
    miniCtx.fillStyle = '#00e5ff';
    miniCtx.beginPath();
    miniCtx.arc(cx, cy, 4, 0, Math.PI*2);
    miniCtx.fill();
}

function endGame(won) {
    GAME.state = won ? 'COMPLETE' : 'GAME_OVER';
    soundSystem.stopEngine(); soundSystem.stopSiren();
    if (won) {
        switchScreen('complete');
        let bonus = GAME.level * 1000; let total = bonus + GAME.stats.driftScore;
        GAME.cash += total; localStorage.setItem(`lvl_${GAME.level+1}_unlocked`, 'true'); saveGame();
        document.getElementById('lc-bonus').innerText = `$${bonus}`; document.getElementById('lc-drift').innerText = GAME.stats.driftScore; document.getElementById('lc-total').innerText = `$${total}`;
    } else {
        switchScreen('gameOver');
        let c = Math.floor(GAME.stats.score / 10); GAME.cash += c; saveGame();
        document.getElementById('go-time').innerText = `${(getLevelConfig(GAME.level).timeToEscape - GAME.stats.survivalTime).toFixed(1)}s`;
        document.getElementById('go-cash').innerText = `$${c}`;
    }
    updateMenuUI();
}

// --- RENDERING ---
function render() {
    ctx.fillStyle = CONFIG.COLORS.ROAD; ctx.fillRect(0, 0, canvas.width, canvas.height); // Background is road color now
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);

    let cx = camera.x, cy = camera.y; let cw = canvas.width / camera.zoom, ch = canvas.height / camera.zoom;
    let padding = 1000;

    // Draw Sidewalk borders (Building Bases)
    ctx.fillStyle = CONFIG.COLORS.SIDEWALK;
    buildings.forEach(b => {
        if (b.x+b.width > cx-cw/2-padding && b.x < cx+cw/2+padding && b.y+b.height > cy-ch/2-padding && b.y < cy+ch/2+padding) {
            ctx.fillRect(b.x-10, b.y-10, b.width+20, b.height+20);
        }
    });

    // Draw Parks
    ctx.fillStyle = CONFIG.COLORS.GRASS;
    parks.forEach(p => {
        if (p.x+p.w > cx-cw/2-padding && p.x < cx+cw/2+padding && p.y+p.h > cy-ch/2-padding && p.y < cy+ch/2+padding) {
            ctx.fillRect(p.x, p.y, p.w, p.h);
        }
    });

    // Draw Roads detailing (Lines)
    ctx.strokeStyle = CONFIG.COLORS.ROAD_LINE; ctx.lineWidth = 4;
    ctx.setLineDash([40, 40]);
    roads.forEach(r => {
        if (r.layout === 'H') {
            ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h/2); ctx.lineTo(r.x + r.w, r.y + r.h/2); ctx.stroke();
        } else if (r.layout === 'V') {
            ctx.beginPath(); ctx.moveTo(r.x + r.w/2, r.y); ctx.lineTo(r.x + r.w/2, r.y + r.h); ctx.stroke();
        }
    });
    ctx.setLineDash([]);

    // Draw Signals Ground lines
    ctx.lineWidth = 10;
    signals.forEach(s => {
        ctx.strokeStyle = s.state === 'G' ? '#2ecc71' : '#e74c3c';
        ctx.beginPath();
        // Just draw a stop line at intersection
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + CONFIG.ROAD_WIDTH, s.y);
        ctx.stroke();
    });

    // Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
    });

    // Entities
    entities.forEach(e => { drawCar(e.x, e.y, e.width, e.length, e.angle, e.color, e.type); });
    drawCar(player.x, player.y, player.width, player.length, player.angle, player.color, 'player');

    // 3D Buildings
    buildings.forEach(b => {
        if (b.x+b.width > cx-cw/2-padding && b.x < cx+cw/2+padding && b.y+b.height > cy-ch/2-padding && b.y < cy+ch/2+padding) {
            let dx = b.x + b.width/2 - cx; let dy = b.y + b.height/2 - cy;
            let shiftFactor = 0.4; // More depth
            let topX = b.x + dx * shiftFactor; let topY = b.y + dy * shiftFactor;

            ctx.fillStyle = b.neon; ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y); ctx.lineTo(topX, topY);
            ctx.moveTo(b.x+b.width, b.y); ctx.lineTo(topX+b.width, topY);
            ctx.moveTo(b.x, b.y+b.height); ctx.lineTo(topX, topY+b.height);
            ctx.moveTo(b.x+b.width, b.y+b.height); ctx.lineTo(topX+b.width, topY+b.height);
            ctx.stroke();

            ctx.globalAlpha = 1.0; ctx.fillStyle = CONFIG.COLORS.BUILDING_TOP;
            ctx.fillRect(topX, topY, b.width, b.height);
            ctx.strokeStyle = b.neon; ctx.lineWidth = 2; ctx.strokeRect(topX, topY, b.width, b.height);
        }
    });

    ctx.restore();
}

function drawCar(x, y, w, l, angle, color, type) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-l/2 + 5, -w/2 + 5, l, w);
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-l/2, -w/2, l, w, 5); ctx.fill();
    ctx.fillStyle = '#011'; ctx.fillRect(l/6, -w/2 + 2, l/4, w - 4); ctx.fillRect(-l/3, -w/2 + 4, l/6, w - 8);

    if(type === 'cop') {
        let t = performance.now() / 150;
        ctx.fillStyle = (Math.sin(t) > 0) ? '#ff0000' : '#0000ff';
        ctx.shadowBlur = 20; ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(-5, -w/2, 10, w); ctx.shadowBlur = 0;
        ctx.fillStyle = '#111'; ctx.fillRect(-l/2, -w/2, l/4, w); ctx.fillRect(l/4 + 5, -w/2, l/4, w);
    }
    if(type === 'player') {
        ctx.fillStyle = 'rgba(255,255,200,0.6)';
        ctx.beginPath(); ctx.moveTo(l/2, -w/2 + 2); ctx.lineTo(l/2 + 200, -w*3); ctx.lineTo(l/2 + 200, w*3); ctx.lineTo(l/2, w/2 - 2); ctx.fill();
        if(GAME.keys['s']) {
            ctx.fillStyle = 'rgba(255,0,0,0.9)'; ctx.shadowBlur = 15; ctx.shadowColor = 'red';
            ctx.fillRect(-l/2 - 2, -w/2 + 2, 4, 8); ctx.fillRect(-l/2 - 2, w/2 - 10, 4, 8); ctx.shadowBlur = 0;
        }
    }
    ctx.restore();
}

function spawnParticle(x, y, color, duration, explode = false) {
    if(particles.length > 250) return;
    particles.push({ x: x, y: y, vx: explode ? (Math.random()-0.5)*15 : 0, vy: explode ? (Math.random()-0.5)*15 : 0, color: color, size: explode ? Math.random()*6 + 2 : Math.random()*4 + 1, life: duration });
}

function gameLoop(timestamp) {
    if (GAME.state === 'HUD') {
        GAME.deltaTime = Math.min((timestamp - GAME.lastTime) / 1000, 0.05);
        GAME.lastTime = timestamp;
        updatePhysics(GAME.deltaTime);
        updateCamera();
        updateGameLogic(GAME.deltaTime);
        render();
        updateHUD();
    }
    requestAnimationFrame(gameLoop);
}
