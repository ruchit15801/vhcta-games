/**
 * MERGE BATTLE EVOLUTION - JOR DAR CORE ENGINE
 * Ultimate Smooth Render & Logic
 */

// --- CONFIGURATION & SCALING ---
const CONFIG = {
    fps: 60,
    gridSize: 5,
    cellSize: 80, // Larger, more imposing grid
    baseSpawnCost: 10,
    gemRewardScale: 5,
};

// --- GAME STATE ---
const STATE = {
    screen: 'splash',
    level: 1,
    gems: 50,
    score: 0,
    spawnCost: CONFIG.baseSpawnCost,
    units: [],
    enemies: [],
    particles: [],
    grid: [],
    draggingUnit: null,
    dragOffset: { x: 0, y: 0 },
    lastTime: 0,
    visualGems: 50, // For animated counting
    cameraShake: 0
};

// --- AUDIO SYNTHESIS ENGINE ---
// Creating incredibly thick, punchy synths
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const SOUNDS = {
    playRaw: (freq, type, duration, vol, env='decay') => {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(env === 'attack' ? 0.01 : vol, audioCtx.currentTime);
        if(env === 'decay') gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        if(env === 'attack') gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + duration/2);
        
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    },
    spawn: () => SOUNDS.playRaw(600, 'sine', 0.3, 0.1),
    merge: () => {
        SOUNDS.playRaw(300, 'sawtooth', 0.1, 0.15); // Bass thump
        setTimeout(() => SOUNDS.playRaw(800, 'square', 0.3, 0.1), 100); // High ping
    },
    attackMeele: () => SOUNDS.playRaw(120, 'square', 0.1, 0.08),
    critMeele: () => SOUNDS.playRaw(80, 'sawtooth', 0.15, 0.15),
    hit: () => SOUNDS.playRaw(150, 'triangle', 0.1, 0.1),
    collect: () => SOUNDS.playRaw(1200, 'sine', 0.05, 0.05), // Diamond ping
    victory: () => {
        [400, 500, 600, 800, 1000].forEach((f, i) => setTimeout(() => SOUNDS.playRaw(f, 'sine', 0.5, 0.1), i*120));
    },
    click: () => SOUNDS.playRaw(900, 'sine', 0.05, 0.08)
};

// --- DOM ELEMENTS ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const ui = {
    gems: document.getElementById('gems'),
    level: document.getElementById('level'),
    score: document.getElementById('score'),
    screens: {
        splash: document.getElementById('splash-screen'),
        victory: document.getElementById('victory-screen'),
        gameover: document.getElementById('gameover-screen')
    },
    btns: {
        start: document.getElementById('btn-start'),
        spawn: document.getElementById('btn-spawn'),
        attack: document.getElementById('btn-attack'),
        next: document.getElementById('btn-next-level'),
        restart: document.getElementById('btn-restart')
    },
    healthBars: document.getElementById('health-bars-container'),
    dmgTexts: document.getElementById('damage-text-container'),
    rewardGems: document.getElementById('reward-gems')
};

// --- RESIZE & SCALING ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Scale cell size based on screen width for perfectly fitting mobile UI
    CONFIG.cellSize = Math.min(80, (canvas.width - 40) / CONFIG.gridSize);
    
    CONFIG.gridStartX = (canvas.width - (CONFIG.gridSize * CONFIG.cellSize)) / 2;
    CONFIG.gridStartY = canvas.height - (CONFIG.gridSize * CONFIG.cellSize) - Math.max(120, window.innerHeight * 0.15); 
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Initialize Grid Array
for(let y=0; y<CONFIG.gridSize; y++) {
    STATE.grid[y] = [];
    for(let x=0; x<CONFIG.gridSize; x++) STATE.grid[y][x] = null;
}

// --- ENTITY CLASSES (JOR DAR 3D PROCEDURAL GRAPHICS) ---

function drawPolygonalGem(ctx, x, y, radius, sides, colorA, colorB, pulse, shadowColor) {
    ctx.save();
    ctx.translate(x, y);
    
    // Super Glow effect
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 20 + pulse * 10;
    
    // Draw base shadow offset
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    for (let i=0; i<sides; i++) {
        const a = (Math.PI * 2 / sides) * i - Math.PI/2;
        ctx.lineTo(Math.cos(a)*radius + 5, Math.sin(a)*radius + 15);
    }
    ctx.fill();

    // Main Gem Body
    ctx.beginPath();
    for (let i=0; i<sides; i++) {
        const a = (Math.PI * 2 / sides) * i - Math.PI/2;
        ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.closePath();
    
    // Intense Gradient Mapping
    const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, colorA);
    grad.addColorStop(1, colorB);
    
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();

    // Inner facets (drawing lines to center)
    ctx.beginPath();
    for (let i=0; i<sides; i++) {
        const a = (Math.PI * 2 / sides) * i - Math.PI/2;
        ctx.moveTo(0,0);
        ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.stroke();
    ctx.restore();
}

class Unit {
    constructor(tier, gridX, gridY) {
        this.tier = tier;
        this.id = 'U_' + Math.random().toString(36).substr(2, 9);
        this.gridX = gridX;
        this.gridY = gridY;
        
        // Initial pos
        this.x = CONFIG.gridStartX + gridX * CONFIG.cellSize + CONFIG.cellSize/2;
        this.y = CONFIG.gridStartY + gridY * CONFIG.cellSize + CONFIG.cellSize/2;
        
        // Target visual pos for smooth interpolation
        this.vx = this.x; 
        this.vy = this.y;
        
        this.updateStats();
        
        this.target = null;
        this.isDragging = false;
        this.actionTimer = 0;
        this.createHealthBar('player');
        
        this.timeOffset = Math.random() * 100; // For pulse animation
    }

    updateStats() {
        this.maxHp = this.tier * 120;
        this.hp = this.maxHp;
        this.dmg = this.tier * 25 + Math.pow(this.tier, 1.5) * 5; // Exponential scale scaling
        this.range = 80 + (this.tier * 15);
        this.speed = 120 + (this.tier * 10);
        this.atkSpeed = Math.max(0.3, 1.2 - (this.tier * 0.1)); 
        
        // Tier distinct visual mapping
        const tierVisuals = [
            { s: 3, c: ['#00f5d4', '#00bbf9'], sh: '#00f5d4' }, // T1 Triangle
            { s: 4, c: ['#fee440', '#f15bb5'], sh: '#fee440' }, // T2 Square/Diamond
            { s: 5, c: ['#9b5de5', '#f15bb5'], sh: '#9b5de5' }, // T3 Pentagon
            { s: 6, c: ['#ff006e', '#8338ec'], sh: '#ff006e' }, // T4 Hexagon
            { s: 8, c: ['#ffffff', '#fb5607'], sh: '#fb5607' }  // T5+ Octagon
        ];
        this.visual = tierVisuals[Math.min(this.tier - 1, tierVisuals.length - 1)];
    }

    createHealthBar(type) {
        const wrapper = document.createElement('div');
        wrapper.className = 'health-bar-wrapper ' + (type==='player' ? 'player-health' : (this.isBoss ? 'boss-health' : ''));
        wrapper.id = 'hb_' + this.id;
        wrapper.innerHTML = '<div class="health-bar-fill"></div>';
        ui.healthBars.appendChild(wrapper);
    }

    updateHealthBar() {
        const hb = document.getElementById('hb_' + this.id);
        if(hb) {
            hb.style.left = this.x + 'px';
            hb.style.top = (this.y - 40) + 'px';
            const pct = Math.max(0, this.hp / this.maxHp) * 100;
            hb.firstChild.style.width = pct + '%';
            hb.style.display = (STATE.screen === 'battle') ? 'block' : 'none';
        }
    }

    removeHealthBar() {
        const hb = document.getElementById('hb_' + this.id);
        if(hb) hb.remove();
    }

    takeDamage(amt) {
        this.hp -= amt;
        const isCrit = Math.random() > 0.8;
        const finalDmg = isCrit ? amt * 1.5 : amt; // 20% Crit chance
        if(isCrit) SOUNDS.critMeele(); else SOUNDS.hit();
        
        spawnDamageText(this.x, this.y, finalDmg, isCrit);
        
        if(this.hp <= 0) {
            spawnParticles(this.x, this.y, this.visual.c[1], 30, true);
            this.removeHealthBar();
            return true;
        }
        return false;
    }

    draw(ctx, time) {
        if(this.hp <= 0 && STATE.screen === 'battle') return;
        
        // Smooth interpolation for visually stunning movement
        if(!this.isDragging && STATE.screen === 'merge') {
            const targetX = CONFIG.gridStartX + this.gridX * CONFIG.cellSize + CONFIG.cellSize/2;
            const targetY = CONFIG.gridStartY + this.gridY * CONFIG.cellSize + CONFIG.cellSize/2;
            this.x += (targetX - this.x) * 0.2;
            this.y += (targetY - this.y) * 0.2;
        }

        const pulse = Math.sin(time * 5 + this.timeOffset) * 0.1;
        let radius = Math.min(35, 18 + (this.tier * 3));
        
        if(this.isDragging) radius *= 1.3;
        
        drawPolygonalGem(ctx, this.x, this.y, radius + (pulse*5), this.visual.s, this.visual.c[0], this.visual.c[1], pulse, this.visual.sh);

        // Render Tier Label
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = '900 16px "Inter", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('L' + this.tier, 0, 0);
        ctx.restore();

        this.updateHealthBar();
    }
}

class Enemy extends Unit {
    constructor(tier, x, y, isBoss = false) {
        super(tier, 0, 0); 
        this.x = x; this.y = y;
        this.isBoss = isBoss;
        
        this.visual = { s: isBoss ? 6 : 4, c: ['#ff0a54', '#780000'], sh: '#ff0000' };
        
        this.maxHp = this.tier * 100 * (1 + STATE.level * 0.3); 
        if(isBoss) {
            this.maxHp *= 3;
            this.visual.c = ['#390099', '#03071e']; // Dark cosmic boss
            this.visual.sh = '#390099';
        }
        
        this.hp = this.maxHp;
        this.dmg = this.tier * 20 * (1 + STATE.level * 0.15);
        if(isBoss) this.dmg *= 1.5;
        this.speed = isBoss ? 80 : 130;
        
        this.removeHealthBar();
        this.createHealthBar('enemy');
    }

    draw(ctx, time) {
        if(this.hp <= 0) return;
        
        const pulse = Math.sin(time * 8 + this.timeOffset) * 0.2;
        let radius = this.isBoss ? 45 : 22 + (this.tier * 2);
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Spin enemies slowly
        ctx.rotate(time * (this.isBoss ? 0.5 : 2)); 
        
        drawPolygonalGem(ctx, 0, 0, radius + (pulse*4), this.visual.s, this.visual.c[0], this.visual.c[1], pulse, this.visual.sh);
        
        ctx.restore();
        
        if(this.isBoss) {
            ctx.fillStyle = 'white';
            ctx.font = '900 18px Inter';
            ctx.textAlign = 'center'; ctx.fillText('BOSS', this.x, this.y - 15);
        }
        this.updateHealthBar();
    }
}

// --- VISUAL EFFECTS ---
function spawnParticles(x, y, color, count, explode=false) {
    for(let i=0; i<count; i++) {
        STATE.particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * (explode ? 15 : 5),
            vy: (Math.random() - 0.5) * (explode ? 15 : 5),
            life: 1.0,
            decay: Math.random() * 0.05 + 0.02,
            color: color,
            size: Math.random() * 6 + 3
        });
    }
}

function spawnDamageText(x, y, amt, isCrit) {
    const el = document.createElement('div');
    el.className = 'damage-text ' + (isCrit ? 'crit' : '');
    el.innerText = '-' + Math.round(amt);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    ui.dmgTexts.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// --- CORE SYSTEMS ---

function updateUI() {
    STATE.spawnCost = CONFIG.baseSpawnCost + (STATE.level * 2);
    ui.btns.spawn.querySelector('.btn-text').innerHTML = `🥚 SPAWN (${STATE.spawnCost} 💎)`;
    ui.level.innerText = 'WAVE ' + STATE.level;
    ui.score.innerText = STATE.score;
    // visualGems handles animate count up
}

function triggerGemUI() {
    ui.gems.classList.remove('counter-pop');
    void ui.gems.offsetWidth; // force reflow
    ui.gems.classList.add('counter-pop');
}

function setScreen(screenName) {
    STATE.screen = screenName;
    Object.values(ui.screens).forEach(s => s.classList.remove('active'));
    if(ui.screens[screenName]) {
        ui.screens[screenName].classList.add('active');
    }
    
    if(screenName === 'merge') {
        ui.btns.spawn.style.display = 'block';
        ui.btns.attack.style.display = 'block';
    } else {
        ui.btns.spawn.style.display = 'none';
        ui.btns.attack.style.display = 'none';
    }
    updateUI();
}

function spawnUnit() {
    if(STATE.gems >= STATE.spawnCost) {
        let emptySpots = [];
        for(let y=0; y<CONFIG.gridSize; y++){
            for(let x=0; x<CONFIG.gridSize; x++){
                if(!STATE.grid[y][x]) emptySpots.push({x,y});
            }
        }
        if(emptySpots.length > 0) {
            STATE.gems -= STATE.spawnCost;
            SOUNDS.spawn();
            const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
            const unit = new Unit(1, spot.x, spot.y);
            STATE.units.push(unit);
            STATE.grid[spot.y][spot.x] = unit;
            spawnParticles(unit.x, unit.y, '#ffffff', 15, true);
            STATE.cameraShake = 5;
            updateUI();
        }
    }
}

// --- INPUT LOGIC ---
let pointerX=0, pointerY=0;

canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('mousemove', onMove);
canvas.addEventListener('mouseup', onUp);
canvas.addEventListener('touchstart', (e)=>{ e.preventDefault(); onDown(e.touches[0]); }, {passive:false});
canvas.addEventListener('touchmove', (e)=>{ e.preventDefault(); onMove(e.touches[0]); }, {passive:false});
canvas.addEventListener('touchend', (e)=>{ e.preventDefault(); onUp(e.changedTouches[0]); }, {passive:false});

function onDown(e) {
    if(STATE.screen !== 'merge') return;
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left; pointerY = e.clientY - rect.top;
    
    for(let i=STATE.units.length-1; i>=0; i--) {
        let u = STATE.units[i];
        let dist = Math.hypot(pointerX - u.x, pointerY - u.y);
        if(dist < CONFIG.cellSize * 0.6) {
            STATE.draggingUnit = u;
            u.isDragging = true;
            STATE.grid[u.gridY][u.gridX] = null; 
            SOUNDS.click();
            break;
        }
    }
}

function onMove(e) {
    if(!STATE.draggingUnit) return;
    const rect = canvas.getBoundingClientRect();
    STATE.draggingUnit.x = e.clientX - rect.left;
    STATE.draggingUnit.y = e.clientY - rect.top;
}

function onUp(e) {
    if(!STATE.draggingUnit) return;
    let u = STATE.draggingUnit;
    u.isDragging = false;
    STATE.draggingUnit = null;

    let gx = Math.floor((u.x - CONFIG.gridStartX) / CONFIG.cellSize);
    let gy = Math.floor((u.y - CONFIG.gridStartY) / CONFIG.cellSize);

    if(gx >= 0 && gx < CONFIG.gridSize && gy >= 0 && gy < CONFIG.gridSize) {
        let target = STATE.grid[gy][gx];
        if(target && target !== u) {
            // MERGE ATTEMPT
            if(target.tier === u.tier) {
                // SUCCESS!! JOR DAR MERGE!
                SOUNDS.merge();
                spawnParticles(target.x, target.y, u.visual.c[0], 50, true);
                STATE.cameraShake = 15; // Massive shake
                
                STATE.units = STATE.units.filter(unit => unit !== u && unit !== target);
                u.removeHealthBar(); target.removeHealthBar();
                STATE.score += u.tier * 50;
                
                let newUnit = new Unit(u.tier + 1, gx, gy);
                STATE.units.push(newUnit);
                STATE.grid[gy][gx] = newUnit;
            } else {
                // SWAP ANIMATED
                STATE.grid[u.gridY][u.gridX] = target;
                target.gridX = u.gridX; target.gridY = u.gridY;
                u.gridX = gx; u.gridY = gy;
                STATE.grid[gy][gx] = u;
            }
        } else {
            // DROP
            u.gridX = gx; u.gridY = gy;
            STATE.grid[gy][gx] = u;
        }
    } else {
        // RETURN
        STATE.grid[u.gridY][u.gridX] = u;
    }
    updateUI();
}

// --- BATTLE LOGIC ---
function startBattle() {
    if(STATE.units.length === 0) return;
    SOUNDS.click();
    setScreen('battle');
    STATE.enemies = [];
    
    const isBossWave = (STATE.level % 5 === 0);
    let enemyCount = isBossWave ? 1 : 1 + Math.floor(STATE.level / 2);
    
    for(let i=0; i<enemyCount; i++) {
        let tier = 1 + Math.floor(STATE.level / 3);
        let ex = (canvas.width / (enemyCount+1)) * (i+1);
        let ey = -50 - (Math.random() * 100); // Spawn offscreen top
        let enemy = new Enemy(tier, ex, ey, isBossWave);
        STATE.enemies.push(enemy);
    }
}

let awardGems = 0;

function updateBattle(dt) {
    function processFaction(attackers, defenders) {
        for(let i=attackers.length-1; i>=0; i--) {
            let a = attackers[i];
            if(a.hp <= 0) continue;

            if(!a.target || a.target.hp <= 0) {
                let closest = null, minDist = Infinity;
                defenders.forEach(d => {
                    if(d.hp > 0) {
                        let dist = Math.hypot(d.x - a.x, d.y - a.y);
                        if(dist < minDist) { minDist = dist; closest = d; }
                    }
                });
                a.target = closest;
            }

            if(a.target) {
                // Approach
                let dist = Math.hypot(a.target.x - a.x, a.target.y - a.y);
                if(dist > a.range) {
                    a.x += (a.target.x - a.x) / dist * a.speed * dt;
                    a.y += (a.target.y - a.y) / dist * a.speed * dt;
                } else {
                    // Attack
                    a.actionTimer -= dt;
                    if(a.actionTimer <= 0) {
                        spawnParticles(a.target.x, a.target.y, '#ffffff', 5);
                        let died = a.target.takeDamage(a.dmg);
                        if(died && !(a instanceof Enemy)) {
                            STATE.score += a.target.tier * 100;
                            // Small combat reward
                            if(Math.random() > 0.8) STATE.gems += 1;
                        }
                        a.actionTimer = a.atkSpeed;
                    }
                }
            } else {
                // Move down if enemy and wandering
                if(a instanceof Enemy) {
                    a.y += a.speed * 0.5 * dt;
                    if(a.y > canvas.height + 100) a.hp = 0; // Destroy if past edge
                }
            }
        }
    }

    processFaction(STATE.units, STATE.enemies);
    processFaction(STATE.enemies, STATE.units);

    STATE.enemies = STATE.enemies.filter(e => e.hp > 0);
    STATE.units = STATE.units.filter(u => {
        if(u.hp <= 0) { STATE.grid[u.gridY][u.gridX] = null; return false; }
        return true;
    });

    if(STATE.screen !== 'battle') return; 

    // Resolution
    if(STATE.enemies.length === 0) {
        SOUNDS.victory();
        const baseGems = Math.floor(CONFIG.gemRewardScale * STATE.level);
        const isCritRwd = Math.random() > 0.9;
        awardGems = isCritRwd ? baseGems * 2 : baseGems;
        
        ui.rewardGems.innerText = '+0'; // Setup for animation
        ui.rewardGems.style.color = isCritRwd ? '#00f5d4' : '#ffea00';
        ui.healthBars.innerHTML = ''; 
        setScreen('victory');
        
        // Setup Animate Diamond Count
        let counted = 0;
        const countInt = setInterval(() => {
            counted += Math.ceil(awardGems / 20);
            if(counted >= awardGems) {
                counted = awardGems;
                clearInterval(countInt);
                STATE.gems += awardGems;
                triggerGemUI();
            }
            ui.rewardGems.innerText = '+' + counted;
            SOUNDS.collect();
        }, 50);

    } else if(STATE.units.length === 0) {
        ui.healthBars.innerHTML = ''; 
        setScreen('gameover');
    }
}

// --- RENDER PIPELINE ---
function drawIsoGrid() {
    ctx.save();
    
    for(let y=0; y<CONFIG.gridSize; y++){
        for(let x=0; x<CONFIG.gridSize; x++){
            const cx = CONFIG.gridStartX + x*CONFIG.cellSize;
            const cy = CONFIG.gridStartY + y*CONFIG.cellSize;
            const s = CONFIG.cellSize;
            
            // 3D Tile
            ctx.fillStyle = 'rgba(10, 0, 20, 0.6)';
            ctx.strokeStyle = STATE.grid[y][x] ? '#ff9e00' : 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = STATE.grid[y][x] ? 2 : 1;
            
            ctx.beginPath();
            ctx.roundRect(cx, cy, s-2, s-2, 10);
            ctx.fill();
            ctx.stroke();
            
            // Inner glow
            if(STATE.grid[y][x]) {
                const grad = ctx.createRadialGradient(cx+s/2, cy+s/2, 0, cx+s/2, cy+s/2, s/2);
                grad.addColorStop(0, 'rgba(255, 158, 0, 0.2)');
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.fill();
            }
        }
    }
    ctx.restore();
}

function gameLoop(timestamp) {
    const dt = (timestamp - STATE.lastTime) / 1000;
    STATE.lastTime = timestamp;
    
    // Smooth gem counter interpolation for Top Bar
    if(STATE.visualGems < STATE.gems) {
        STATE.visualGems += (STATE.gems - STATE.visualGems) * 0.2;
        if(STATE.gems - STATE.visualGems < 0.5) STATE.visualGems = STATE.gems;
        ui.gems.innerText = Math.round(STATE.visualGems);
    } else if(STATE.visualGems > STATE.gems) {
        STATE.visualGems = STATE.gems;
        ui.gems.innerText = STATE.gems;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Camera Shake
    if(STATE.cameraShake > 0) {
        ctx.translate((Math.random()-0.5)*STATE.cameraShake, (Math.random()-0.5)*STATE.cameraShake);
        STATE.cameraShake *= 0.9;
        if(STATE.cameraShake < 0.5) STATE.cameraShake = 0;
    }

    if (STATE.screen === 'merge' || STATE.screen === 'battle') {
        if(STATE.screen === 'merge') drawIsoGrid();
        if(STATE.screen === 'battle') updateBattle(Math.min(dt, 0.1)); 

        // Sorting drawing order based on Y
        let renderQueue = [...STATE.units, ...STATE.enemies];
        renderQueue.sort((a,b) => a.y - b.y);

        renderQueue.forEach(ent => {
            if(!ent.isDragging) ent.draw(ctx, timestamp/1000);
        });
        
        if(STATE.draggingUnit) STATE.draggingUnit.draw(ctx, timestamp/1000);
    }

    // Advanced Particles
    for(let i=STATE.particles.length-1; i>=0; i--) {
        let p = STATE.particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= p.decay;
        if(p.life <= 0) {
            STATE.particles.splice(i, 1);
        } else {
            ctx.globalAlpha = p.life;
            ctx.shadowBlur = 10; ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2);
            ctx.fill();
        }
    }
    ctx.restore();

    requestAnimationFrame(gameLoop);
}

// --- BUTTON BINDS ---
ui.btns.start.onclick = () => { SOUNDS.click(); setScreen('merge'); };
ui.btns.spawn.onclick = () => { spawnUnit(); };
ui.btns.attack.onclick = () => { startBattle(); };

ui.btns.next.onclick = () => { 
    SOUNDS.click(); 
    STATE.level++; 
    STATE.units.forEach(u => u.removeHealthBar()); // force cleanup
    setScreen('merge'); 
};
ui.btns.restart.onclick = () => { 
    SOUNDS.click(); 
    STATE.units.forEach(u => u.removeHealthBar());
    STATE.enemies.forEach(e => e.removeHealthBar());
    STATE.units = []; STATE.enemies = [];
    for(let y=0; y<CONFIG.gridSize; y++) {
        for(let x=0; x<CONFIG.gridSize; x++) STATE.grid[y][x] = null;
    }
    STATE.gems += Math.floor(STATE.spawnCost * 3); // Pity gems
    updateUI();
    setScreen('merge'); 
};

// Initialize
requestAnimationFrame(gameLoop);
