/**
 * Robot Factory Automation - Core Engine
 * Premium Industrial Automation Simulation
 */

// --- Audio Synthesizer Engine (Zero External Assets) ---
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.masterGain = null;
        this.initialized = false;
        this.lastProcessTime = 0;
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.15;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
        this.playAmbience();
    }

    playAmbience() {
        if (!this.enabled || !this.ctx) return;
        // Deep industrial drone
        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = 35; // Lower frequency, softer waveform
        lfo.type = 'sine';
        lfo.frequency.value = 0.2; // Very slow modulation
        
        lfo.connect(gain.gain);
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        gain.gain.value = 0.05; // Much softer ambient drone
        osc.start();
        lfo.start();
    }

    playClick() {
        if (!this.enabled || !this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(300, this.ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.2, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        o.connect(g);
        g.connect(this.masterGain);
        o.start();
        o.stop(this.ctx.currentTime + 0.1);
    }

    playBuild() {
        if (!this.enabled || !this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, this.ctx.currentTime);
        o.frequency.linearRampToValueAtTime(400, this.ctx.currentTime + 0.15);
        g.gain.setValueAtTime(0.2, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        o.connect(g);
        g.connect(this.masterGain);
        o.start();
        o.stop(this.ctx.currentTime + 0.15);
    }

    playProcess() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        if (now - this.lastProcessTime < 0.4) return; // heavily throttle process sound
        this.lastProcessTime = now;

        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(300, now);
        o.frequency.exponentialRampToValueAtTime(150, now + 0.2);
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        o.connect(g);
        g.connect(this.masterGain);
        o.start();
        o.stop(now + 0.2);
    }
    
    playError() {
        if (!this.enabled || !this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(150, this.ctx.currentTime);
        o.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.2);
        g.gain.setValueAtTime(0.5, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        o.connect(g);
        g.connect(this.masterGain);
        o.start();
        o.stop(this.ctx.currentTime + 0.2);
    }
}

const sfx = new AudioEngine();

// --- Game Constants & State ---
const TILE_SIZE = 60;
const MAP_W = 40;
const MAP_H = 40;
const DIRS = [
    {x: 0, y: -1}, // 0: Up
    {x: 1, y: 0},  // 1: Right
    {x: 0, y: 1},  // 2: Down
    {x: -1, y: 0}  // 3: Left
];

const ResType = {
    M_IRON: 'm_iron', // raw ore
    M_COPPER: 'm_copper',
    P_IRON: 'p_iron', // processed plate
    P_COPPER: 'p_copper',
    PART: 'part'      // assembled part
};

const ResColors = {
    'm_iron': '#00f3ff', // cyan ore
    'm_copper': '#ff9d00', // orange ore
    'p_iron': '#00b3cc', // dark cyan plate
    'p_copper': '#cc7a00', // dark orange plate
    'part': '#00ff66' // green part
};

class GameState {
    constructor() {
        this.inventory = {
            iron: 200, // starting res
            copper: 100,
            parts: 50
        };
        this.power = {
            current: 0,
            max: 50 // Base power
        };
        this.upgrades = {
            speed: 1,      // multiplier
            efficiency: 1  // divider for power
        };
        this.level = 1;
        this.objectiveProgress = 0;
        this.currentTool = 'cursor'; // cursor, rotate, delete, build
        this.buildType = null;
        this.buildDir = 1;
        
        // Map Grid [y][x]
        this.grid = new Array(MAP_H).fill(0).map(() => new Array(MAP_W).fill(null));
        // Static Resources (Ores) [y][x]
        this.ores = new Array(MAP_H).fill(0).map(() => new Array(MAP_W).fill(null));
        
        this.machines = [];
        this.items = []; // Loose items on belts/machines
        
        this.generateOres();
        this.updateObjectives();
    }
    
    generateOres() {
        // Procedural clumps
        for (let i = 0; i < 15; i++) {
            let ox = Math.floor(Math.random() * (MAP_W - 4)) + 2;
            let oy = Math.floor(Math.random() * (MAP_H - 4)) + 2;
            let type = Math.random() > 0.5 ? ResType.M_IRON : ResType.M_COPPER;
            // Blob
            for(let dy=-2; dy<=2; dy++){
                for(let dx=-2; dx<=2; dx++){
                    if(Math.random() > 0.3 && ox+dx>=0 && ox+dx<MAP_W && oy+dy>=0 && oy+dy<MAP_H) {
                        this.ores[oy+dy][ox+dx] = type;
                    }
                }
            }
        }
    }

    updateObjectives() {
        const goals = [
            { req: { m_iron: 20 }, desc: "Mine 20 Iron Ores" },
            { req: { m_copper: 20 }, desc: "Mine 20 Copper Ores" },
            { req: { p_iron: 20 }, desc: "Process 20 Iron Plates" },
            { req: { part: 10 }, desc: "Assemble 10 Parts" },
            { req: { part: 100 }, desc: "Mass Produce 100 Parts (Sandbox Mode)" }
        ];
        
        let idx = Math.min(this.level - 1, goals.length - 1);
        this.currentGoal = goals[idx];
        this.objectiveProgress = 0;
        
        // Reset count for the goal resource type in tracker
        this.goalTrackerType = Object.keys(this.currentGoal.req)[0];
        this.goalTrackerTarget = this.currentGoal.req[this.goalTrackerType];
        
        document.getElementById('val-level').innerText = this.level;
        document.getElementById('obj-text').innerText = this.currentGoal.desc;
        this.updateHUD();
    }

    updateHUD() {
        document.getElementById('val-iron').innerText = Math.floor(this.inventory.iron);
        document.getElementById('val-copper').innerText = Math.floor(this.inventory.copper);
        document.getElementById('val-parts').innerText = Math.floor(this.inventory.parts);
        
        let pText = `${Math.floor(this.power.current)}/${Math.floor(this.power.max)} MW`;
        document.getElementById('val-power').innerText = pText;
        let pPct = Math.min(100, Math.max(0, (this.power.current / this.power.max) * 100));
        document.getElementById('bar-power').style.width = pPct + '%';
        
        // Power Error state
        if (this.power.current > this.power.max) {
            document.getElementById('bar-power').style.background = 'linear-gradient(90deg, #ff3333, #ff0000)';
            document.getElementById('bar-power').style.boxShadow = '0 0 8px #ff0000';
            document.getElementById('val-power').classList.add('text-red');
            document.getElementById('val-power').classList.remove('text-small');
        } else {
            document.getElementById('bar-power').style.background = 'linear-gradient(90deg, #ff9d00, #f2e000)';
            document.getElementById('bar-power').style.boxShadow = '0 0 8px #f2e000';
            document.getElementById('val-power').classList.remove('text-red');
            document.getElementById('val-power').classList.add('text-small');
        }

        // Objective
        let objPct = Math.min(100, (this.objectiveProgress / this.goalTrackerTarget) * 100);
        document.getElementById('bar-objective').style.width = objPct + '%';
        document.getElementById('obj-stats').innerText = `${this.objectiveProgress} / ${this.goalTrackerTarget}`;
        
        if (this.objectiveProgress >= this.goalTrackerTarget) {
            this.levelComplete();
        }
    }

    trackProduction(type) {
        if (type === this.goalTrackerType) {
            this.objectiveProgress++;
            this.updateHUD();
        }
    }

    levelComplete() {
        if (this.levelCompleteTriggered) return;
        this.levelCompleteTriggered = true;
        document.getElementById('modal-level').classList.remove('hidden');
        sfx.playClick();
    }

    nextLevel() {
        this.levelCompleteTriggered = false;
        this.level++;
        this.updateObjectives();
        document.getElementById('modal-level').classList.add('hidden');
        sfx.playBuild();
    }

    calcPower() {
        let max = 50 + this.machines.filter(m => m.type === 'generator').length * 20;
        let curr = 0;
        for(let m of this.machines) {
            if(m.type !== 'generator') {
                curr += (m.powerDraw / this.upgrades.efficiency);
            }
        }
        this.power.max = max;
        this.power.current = curr;
    }

    hasPower() {
        return this.power.current <= this.power.max;
    }

    buyUpgrade(type) {
        if (type === 'speed' && this.inventory.parts >= 50) {
            this.inventory.parts -= 50;
            this.upgrades.speed += 0.2;
            sfx.playBuild();
        } else if (type === 'efficiency' && this.inventory.copper >= 100) {
            this.inventory.copper -= 100;
            this.upgrades.efficiency += 0.25;
            sfx.playBuild();
        } else {
            sfx.playError();
        }
        this.calcPower();
        this.updateHUD();
    }
}

// --- Machines & Logistics ---

class Machine {
    constructor(x, y, type, dir) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.dir = dir; // 0,1,2,3
        this.powerDraw = 0;
        this.progress = 0;
        this.maxProgress = 100;
        this.inventory = [];
        this.outputBuffer = null;
        this.animPhase = 0;
        this.id = Math.random().toString(36).substr(2, 9);
    }

    canAccept(itemType) { return false; }
    acceptItem(item) { this.inventory.push(item); }
    
    update(dt) {}
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x * TILE_SIZE + TILE_SIZE/2, this.y * TILE_SIZE + TILE_SIZE/2);
        ctx.rotate(this.dir * Math.PI/2);
        
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        this.drawSpecific(ctx);
        ctx.restore();
    }
    
    drawSpecific(ctx) {}
}

class Conveyor extends Machine {
    constructor(x, y, dir) {
        super(x, y, 'conveyor', dir);
        this.powerDraw = 0.5; // low power
    }
    canAccept(itemType) {
        // Can only accept if output buffer is empty and no local items blocking center
        return game.items.filter(i => Math.floor(i.x) === this.x && Math.floor(i.y) === this.y).length < 2;
    }
    drawSpecific(ctx) {
        // Base plate
        ctx.fillStyle = '#222';
        ctx.fillRect(-TILE_SIZE/2, -TILE_SIZE/2, TILE_SIZE, TILE_SIZE);
        
        // Borders
        ctx.fillStyle = '#111';
        ctx.fillRect(-TILE_SIZE/2, -TILE_SIZE/2, TILE_SIZE, 5);
        ctx.fillRect(-TILE_SIZE/2, TILE_SIZE/2 - 5, TILE_SIZE, 5);
        
        // Moving arrows based on time
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#3a3a4a';
        let offset = (performance.now() / 10 % 100) / 100 * TILE_SIZE;
        
        for (let i = -1; i < 2; i++) {
            let px = -TILE_SIZE/2 + offset + i*TILE_SIZE/2;
            if(px > -TILE_SIZE/2 && px < TILE_SIZE/2) {
                ctx.beginPath();
                ctx.moveTo(px-10, -10);
                ctx.lineTo(px+5, 0);
                ctx.lineTo(px-10, 10);
                ctx.strokeRect = 2; // Hack to trigger stroke
                ctx.strokeStyle = '#445';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }
}

class Miner extends Machine {
    constructor(x, y, type, dir) {
        super(x, y, type, dir);
        this.powerDraw = 5;
        this.maxProgress = 120; // Time to mine
        this.oreType = type === 'miner_iron' ? ResType.M_IRON : ResType.M_COPPER;
    }
    update(dt) {
        if (!game.hasPower()) return;
        this.animPhase += dt * 0.005;
        this.progress += dt * game.upgrades.speed;
        
        if (this.progress >= this.maxProgress) {
            // Check in front for place to put
            let nx = this.x + DIRS[this.dir].x;
            let ny = this.y + DIRS[this.dir].y;
            
            // Output logic is handled globally or here. Let's do it here.
            let nextBlock = (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) ? game.grid[ny][nx] : null;
            
            let canOutput = false;
            if (nextBlock && nextBlock.canAccept(this.oreType)) {
                canOutput = true;
            } else if (!nextBlock) {
                 // Deposit straight floor if empty
                 canOutput = true;
            }

            if (canOutput) {
                // Spawn item at center, tell it to move to dir
                let ni = new Item(this.x, this.y, this.oreType);
                game.items.push(ni);
                this.progress = 0;
                game.trackProduction(this.oreType);
                sfx.playProcess();
            }
        }
    }
    drawSpecific(ctx) {
        // Base
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.roundRect(-25, -25, 50, 50, 8);
        ctx.fill();
        
        // Output nozzle
        ctx.fillStyle = '#111';
        ctx.fillRect(15, -10, 10, 20);
        
        // Rotating Drill head
        ctx.save();
        ctx.rotate(this.animPhase);
        ctx.shadowColor = this.oreType === ResType.M_IRON ? '#00f3ff' : '#ff9d00';
        ctx.shadowBlur = Math.sin(this.animPhase*5)*10 + 10;
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI*2);
        ctx.fill();
        
        ctx.fillStyle = this.oreType === ResType.M_IRON ? '#00b3cc' : '#cc7a00';
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(15, 9);
        ctx.lineTo(-15, 9);
        ctx.fill();
        ctx.restore();
    }
}

class Processor extends Machine {
    constructor(x, y, dir) {
        super(x, y, 'processor', dir);
        this.powerDraw = 8;
        this.maxProgress = 80;
        this.currentRecipe = null;
    }
    canAccept(itemType) {
        if (this.inventory.length < 2) {
            if (itemType === ResType.M_IRON || itemType === ResType.M_COPPER) {
                // If empty or matches existing
                if (this.inventory.length === 0) return true;
                if (this.inventory[0].type === itemType) return true;
            }
        }
        return false;
    }
    acceptItem(item) {
        this.inventory.push(item);
    }
    update(dt) {
        if (!game.hasPower()) return;
        
        if (this.inventory.length >= 2 || (this.progress > 0 && this.currentRecipe)) {
            // Start process
            if (this.progress === 0) {
                this.currentRecipe = this.inventory[0].type === ResType.M_IRON ? ResType.P_IRON : ResType.P_COPPER;
                // consume
                this.inventory = [];
            }
            this.progress += dt * game.upgrades.speed;
            this.animPhase = Math.sin(performance.now()/50); // pulse
            
            if (this.progress >= this.maxProgress) {
                // Attempt output
                let outMode = true; // Simplistic out
                if (outMode) {
                    let ni = new Item(this.x, this.y, this.currentRecipe);
                    game.items.push(ni);
                    game.trackProduction(this.currentRecipe);
                    sfx.playProcess();
                    this.progress = 0;
                    this.currentRecipe = null;
                    this.animPhase = 0;
                }
            }
        }
    }
    drawSpecific(ctx) {
        // Base
        ctx.fillStyle = '#223';
        ctx.beginPath();
        ctx.roundRect(-25, -25, 50, 50, 15);
        ctx.fill();
        
        // Input / Output ports
        ctx.fillStyle = '#111';
        ctx.fillRect(-25, -10, 10, 20); // input
        ctx.fillRect(15, -10, 10, 20);  // output
        
        // Center Core
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI*2);
        ctx.fillStyle = '#111';
        ctx.fill();
        
        if (this.progress > 0) {
            let color = this.currentRecipe === ResType.P_IRON ? '#00f3ff' : '#ff9d00';
            ctx.shadowColor = color;
            ctx.shadowBlur = 15;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, 12 + this.animPhase*3, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI*2);
            ctx.fill();
        }
    }
}

class Assembler extends Machine {
    constructor(x, y, dir) {
        super(x, y, 'assembler', dir);
        this.powerDraw = 12;
        this.maxProgress = 150;
    }
    canAccept(itemType) {
        if (itemType === ResType.P_IRON || itemType === ResType.P_COPPER) {
            let iCount = this.inventory.filter(i=>i.type===ResType.P_IRON).length;
            let cCount = this.inventory.filter(i=>i.type===ResType.P_COPPER).length;
            if (itemType === ResType.P_IRON && iCount < 1) return true;
            if (itemType === ResType.P_COPPER && cCount < 1) return true;
        }
        return false;
    }
    acceptItem(item) {
        this.inventory.push(item);
    }
    update(dt) {
        if (!game.hasPower()) return;
        
        let hasI = this.inventory.some(i=>i.type===ResType.P_IRON);
        let hasC = this.inventory.some(i=>i.type===ResType.P_COPPER);
        
        if ((hasI && hasC) || this.progress > 0) {
            if (this.progress === 0) {
                 // consume
                 this.inventory = [];
            }
            this.progress += dt * game.upgrades.speed;
            this.animPhase += dt * 0.01;
            
            if (this.progress >= this.maxProgress) {
                let ni = new Item(this.x, this.y, ResType.PART);
                game.items.push(ni);
                game.trackProduction(ResType.PART);
                sfx.playProcess();
                this.progress = 0;
            }
        }
    }
    drawSpecific(ctx) {
        // Base
        ctx.fillStyle = '#112';
        ctx.fillRect(-25, -25, 50, 50);
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 1;
        ctx.strokeRect(-25, -25, 50, 50);
        
        // Robotic Arms
        ctx.fillStyle = '#555';
        ctx.save();
        if (this.progress > 0) {
            ctx.translate(-15, 0);
            ctx.rotate(Math.sin(this.animPhase) * 0.5);
            ctx.fillRect(0, -4, 25, 8);
            ctx.fillStyle = '#00ff66';
            ctx.shadowColor = '#00ff66';
            ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(20, 0, 4, 0, Math.PI*2); ctx.fill();
        } else {
             ctx.fillRect(-15, -4, 20, 8);
        }
        ctx.restore();
        
        ctx.save();
        if (this.progress > 0) {
            ctx.translate(15, 0);
            ctx.rotate(-Math.sin(this.animPhase) * 0.5);
            ctx.fillRect(-25, -4, 25, 8);
        } else {
            ctx.fillRect(-5, -4, 20, 8);
        }
        ctx.restore();

        // Central hub
        ctx.fillStyle = '#222';
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(0,0, 10, 0, Math.PI*2); ctx.fill();
    }
}

class Generator extends Machine {
    constructor(x, y, dir) {
        super(x, y, 'generator', dir);
        this.powerDraw = 0; // It produces, it's counted in GameState calcPower
    }
    drawSpecific(ctx) {
        // Base panel
        ctx.fillStyle = '#1a3355';
        ctx.fillRect(-25, -25, 50, 50);
        
        // Solar grid
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        for(let i=-20; i<=20; i+=10) {
            ctx.beginPath(); ctx.moveTo(-25, i); ctx.lineTo(25, i); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, -25); ctx.lineTo(i, 25); ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        
        // Shine
        let shine = (Math.sin(performance.now()/500) + 1)/2;
        ctx.fillStyle = `rgba(0, 243, 255, ${shine * 0.2})`;
        ctx.fillRect(-25, -25, 50, 50);
    }
}

// Moving items on grid
class Item {
    constructor(bx, by, type) {
        this.x = bx; // floating coord
        this.y = by; // floating coord
        this.type = type;
        this.id = Math.random();
    }
    
    update(dt) {
        let ix = Math.floor(this.x + 0.5);
        let iy = Math.floor(this.y + 0.5);
        
        let bk = null;
        if(iy>=0 && iy<MAP_H && ix>=0 && ix<MAP_W) {
            bk = game.grid[iy][ix];
        }
        
        if (bk && bk.type === 'conveyor') {
            // Move item along conveyor direction
            let speed = 0.002 * dt; // tiles per ms
            let dx = DIRS[bk.dir].x;
            let dy = DIRS[bk.dir].y;
            
            // Snap to grid axis for smooth movement
            if (dx !== 0) this.y += (iy - this.y) * 0.1;
            if (dy !== 0) this.x += (ix - this.x) * 0.1;
            
            // Look ahead collision
            let tX = this.x + dx * speed;
            let tY = this.y + dy * speed;
            let nextIx = Math.floor(tX + 0.5 * Math.sign(dx));
            let nextIy = Math.floor(tY + 0.5 * Math.sign(dy));
            
            let canMove = true;
            
            // If entering new block
            if (nextIx !== ix || nextIy !== iy) {
                 if (nextIx>=0 && nextIx<MAP_W && nextIy>=0 && nextIy<MAP_H) {
                     let nBk = game.grid[nextIy][nextIx];
                     if (nBk && nBk.type !== 'conveyor') {
                         if (nBk.canAccept(this.type)) {
                             // Accept item
                             nBk.acceptItem(this);
                             return false; // remove item
                         } else {
                             canMove = false; // Blocked by machine
                         }
                     } else if (!nBk || (nBk.type === 'conveyor' && game.items.some(oi => Math.floor(oi.x)===nextIx && Math.floor(oi.y)===nextIy && oi.id !== this.id))) {
                         canMove = false; // Blocked by empty space or other item
                     }
                 } else {
                     canMove = false; // Edge of world
                 }
            } else {
                 // Check if hitting item on SAME block
                 let other = game.items.find(oi => oi.id !== this.id && Math.abs(oi.x - tX) < 0.4 && Math.abs(oi.y - tY) < 0.4);
                 if (other) {
                      // Only blocked if other is in front
                      if ((dx > 0 && other.x > this.x) || (dx < 0 && other.x < this.x) ||
                          (dy > 0 && other.y > this.y) || (dy < 0 && other.y < this.y)) {
                          canMove = false;
                      }
                 }
            }
            
            if (canMove) {
                this.x = tX;
                this.y = tY;
            }
        } else if (bk && bk.type !== 'conveyor' && bk.canAccept(this.type)) {
            bk.acceptItem(this);
            return false;
        } else if (!bk) {
            // Reached end of line or fell off
            // Convert to global inventory for simplicity and reward
            if (this.type === ResType.M_IRON) game.inventory.iron++;
            if (this.type === ResType.M_COPPER) game.inventory.copper++;
            if (this.type === ResType.P_IRON) game.inventory.iron += 2;
            if (this.type === ResType.P_COPPER) game.inventory.copper += 2;
            if (this.type === ResType.PART) game.inventory.parts++;
            game.updateHUD();
            return false;
        }
        return true; // keep alive
    }
    
    draw(ctx) {
        ctx.fillStyle = ResColors[this.type];
        ctx.shadowColor = ResColors[this.type];
        ctx.shadowBlur = 8;
        
        let px = this.x * TILE_SIZE + TILE_SIZE/2;
        let py = this.y * TILE_SIZE + TILE_SIZE/2;
        
        ctx.beginPath();
        if (this.type === ResType.M_IRON || this.type === ResType.M_COPPER) {
             ctx.arc(px, py, 6, 0, Math.PI*2);
        } else if (this.type === ResType.P_IRON || this.type === ResType.P_COPPER) {
             ctx.fillRect(px - 6, py - 6, 12, 12);
        } else {
             // Part
             ctx.moveTo(px, py-8); ctx.lineTo(px+8, py); ctx.lineTo(px, py+8); ctx.lineTo(px-8, py);
        }
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// --- Engine & Input ---

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Better performance
let game, lastTime;

// Camera
let camX = 0, camY = 0, zoom = 1;
let isDragging = false, lastMouseX = 0, lastMouseY = 0;
let mouseGridX = -1, mouseGridY = -1;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function initGame() {
    game = new GameState();
    // Center camera
    camX = -(MAP_W * TILE_SIZE) / 2 + canvas.width / 2;
    camY = -(MAP_H * TILE_SIZE) / 2 + canvas.height / 2;
    
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameLoop(time) {
    let dt = time - lastTime;
    // Cap dt to prevent massive jumps on lag
    if (dt > 100) dt = 100;
    lastTime = time;
    
    update(dt);
    draw();
    
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // Update machines
    for (let m of game.machines) {
        m.update(dt);
    }
    
    // Update items
    for (let i = game.items.length - 1; i >= 0; i--) {
        let alive = game.items[i].update(dt);
        if (!alive) game.items.splice(i, 1);
    }
}

function draw() {
    // BG
    ctx.fillStyle = '#0a0a10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(camX, camY);
    ctx.scale(zoom, zoom);
    
    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(40, 40, 60, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= MAP_W; x++) {
        ctx.moveTo(x * TILE_SIZE, 0);
        ctx.lineTo(x * TILE_SIZE, MAP_H * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_H; y++) {
        ctx.moveTo(0, y * TILE_SIZE);
        ctx.lineTo(MAP_W * TILE_SIZE, y * TILE_SIZE);
    }
    ctx.stroke();
    
    // Draw Ores (Ground layer)
    for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
            let ore = game.ores[y][x];
            if (ore) {
                ctx.fillStyle = ore === ResType.M_IRON ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 157, 0, 0.2)';
                ctx.fillRect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                // Draw little dots
                ctx.fillStyle = ore === ResType.M_IRON ? '#00f3ff' : '#ff9d00';
                for(let d=0; d<3; d++) {
                    // pseudo random based on coords
                    let randX = ((x*13 + d*7) % 10) / 10 * TILE_SIZE;
                    let randY = ((y*17 + d*11) % 10) / 10 * TILE_SIZE;
                    ctx.beginPath();
                    ctx.arc(x * TILE_SIZE + randX, y * TILE_SIZE + randY, 2, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
    }
    
    // Draw Machines
    for (let m of game.machines) {
        m.draw(ctx);
    }
    
    // Draw Items
    for (let i of game.items) {
        i.draw(ctx);
    }
    
    // Hover Highlight / Build Preview
    if (mouseGridX >= 0 && mouseGridX < MAP_W && mouseGridY >= 0 && mouseGridY < MAP_H) {
        if (game.currentTool === 'cursor') {
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(mouseGridX * TILE_SIZE, mouseGridY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else if (game.currentTool === 'delete') {
            ctx.fillStyle = 'rgba(255, 51, 51, 0.4)';
            ctx.fillRect(mouseGridX * TILE_SIZE, mouseGridY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else if (game.currentTool === 'build' && game.buildType) {
            // Preview
            ctx.save();
            ctx.translate(mouseGridX * TILE_SIZE + TILE_SIZE/2, mouseGridY * TILE_SIZE + TILE_SIZE/2);
            ctx.rotate(game.buildDir * Math.PI/2);
            ctx.globalAlpha = 0.5;
            // Hacky draw generic preview based on type
            if (game.buildType === 'conveyor') { ctx.fillStyle='#222'; ctx.fillRect(-25,-25,50,50); ctx.fillStyle='#00f3ff'; ctx.fillRect(0,-5,20,10); }
            else if (game.buildType.includes('miner')) { ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill(); }
            else { ctx.fillStyle='#555'; ctx.fillRect(-20,-20,40,40); }
            ctx.restore();
            
            // Check cost validity
            let color = 'rgba(0, 255, 102, 0.3)';
            ctx.fillStyle = color;
            ctx.fillRect(mouseGridX * TILE_SIZE, mouseGridY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }
    
    ctx.restore();
}

// --- Interaction Logic ---

function getMouseGrid(e) {
    let rect = canvas.getBoundingClientRect();
    let cx, cy;
    if (e.touches && e.touches.length > 0) {
        cx = e.touches[0].clientX - rect.left;
        cy = e.touches[0].clientY - rect.top;
    } else {
        cx = e.clientX - rect.left;
        cy = e.clientY - rect.top;
    }
    
    // Convert to world
    let wx = (cx - camX) / zoom;
    let wy = (cy - camY) / zoom;
    
    let gx = Math.floor(wx / TILE_SIZE);
    let gy = Math.floor(wy / TILE_SIZE);
    
    return {gx, gy, cx, cy};
}

let initialPinchDistance = null;

canvas.addEventListener('mousedown', pointerDown);
canvas.addEventListener('mousemove', pointerMove);
window.addEventListener('mouseup', pointerUp);

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
        initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        isDragging = false;
        return;
    }
    pointerDown(e);
}, {passive: false});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
        let currentPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        
        if (initialPinchDistance) {
            let zoomDiff = (currentPinchDistance - initialPinchDistance) * 0.005;
            zoom += zoomDiff;
            zoom = Math.max(0.4, Math.min(2.5, zoom));
        }
        initialPinchDistance = currentPinchDistance;
        isDragging = false;
        return;
    }
    pointerMove(e);
}, {passive: false});

window.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) initialPinchDistance = null;
    pointerUp(e);
});
window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') rotateBuild();
    if (e.key === 'x' || e.key === 'X') setTool('delete');
    if (e.key === 'Escape') setTool('cursor');
});

function pointerDown(e) {
    if (e.target !== canvas) return;
    let {gx, gy, cx, cy} = getMouseGrid(e);
    isDragging = true;
    lastMouseX = cx;
    lastMouseY = cy;
    
    handleGridAction(gx, gy);
}

function pointerMove(e) {
    let {gx, gy, cx, cy} = getMouseGrid(e);
    mouseGridX = gx;
    mouseGridY = gy;
    
    if (isDragging) {
        // Build dragging (e.g. conveyors)
        if (game.currentTool === 'build' || game.currentTool === 'delete') {
            handleGridAction(gx, gy);
        } else {
            // Pan
            camX += (cx - lastMouseX);
            camY += (cy - lastMouseY);
            lastMouseX = cx;
            lastMouseY = cy;
        }
    } else {
        // Just hover
        if(game.currentTool === 'cursor') inspectMachine(gx, gy);
    }
}

function pointerUp(e) {
    isDragging = false;
}

function canvasWheel(e) {
    e.preventDefault();
    let zoomAmount = e.deltaY * -0.001;
    zoom += zoomAmount;
    zoom = Math.max(0.5, Math.min(2, zoom));
}
canvas.addEventListener('wheel', canvasWheel, {passive: false});

function setTool(toolName) {
    game.currentTool = toolName;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.build-item').forEach(b => b.classList.remove('selected'));
    document.getElementById('inspector-panel').classList.add('hidden');
    
    if (toolName === 'cursor') document.getElementById('tool-cursor').classList.add('active');
    if (toolName === 'delete') document.getElementById('tool-delete').classList.add('active');
}

function setBuild(type, el) {
    game.currentTool = 'build';
    game.buildType = type;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.build-item').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('inspector-panel').classList.add('hidden');
}

function rotateBuild() {
    game.buildDir = (game.buildDir + 1) % 4;
    sfx.playClick();
}
document.getElementById('tool-rotate').addEventListener('click', rotateBuild);

function handleGridAction(gx, gy) {
    if (gx < 0 || gx >= MAP_W || gy < 0 || gy >= MAP_H) return;
    
    if (game.currentTool === 'delete') {
        if (game.grid[gy][gx]) {
            let m = game.grid[gy][gx];
            game.machines = game.machines.filter(mx => mx.id !== m.id);
            game.grid[gy][gx] = null;
            // Clean items on this block
            game.items = game.items.filter(i => Math.floor(i.x) !== gx || Math.floor(i.y) !== gy);
            sfx.playError();
            game.calcPower();
            game.updateHUD();
        }
    } else if (game.currentTool === 'build' && game.buildType) {
        if (!game.grid[gy][gx]) {
            // Check costs
            let cost = getCost(game.buildType);
            if (game.inventory.iron >= cost.i && game.inventory.copper >= cost.c && game.inventory.parts >= cost.p) {
                // Must build miners on specific ore
                if (game.buildType === 'miner_iron' && game.ores[gy][gx] !== ResType.M_IRON) { sfx.playError(); return; }
                if (game.buildType === 'miner_copper' && game.ores[gy][gx] !== ResType.M_COPPER) { sfx.playError(); return; }
                // Avoid building non-miners on ore to keep clear logic
                if (!game.buildType.includes('miner') && game.ores[gy][gx]) { sfx.playError(); return; }

                // Deduct
                game.inventory.iron -= cost.i;
                game.inventory.copper -= cost.c;
                game.inventory.parts -= cost.p;
                
                let machine;
                if (game.buildType === 'conveyor') machine = new Conveyor(gx, gy, game.buildDir);
                else if (game.buildType.includes('miner')) machine = new Miner(gx, gy, game.buildType, game.buildDir);
                else if (game.buildType === 'processor') machine = new Processor(gx, gy, game.buildDir);
                else if (game.buildType === 'assembler') machine = new Assembler(gx, gy, game.buildDir);
                else if (game.buildType === 'generator') machine = new Generator(gx, gy, game.buildDir);
                
                game.grid[gy][gx] = machine;
                game.machines.push(machine);
                sfx.playBuild();
                game.calcPower();
                game.updateHUD();
                
                // Auto-rotate conveyor magic on drag
                if (game.buildType === 'conveyor' && window.lastBuild) {
                    if (window.lastBuild.gx !== gx || window.lastBuild.gy !== gy) {
                        let dx = gx - window.lastBuild.gx;
                        let dy = gy - window.lastBuild.gy;
                        if (dx===1) game.buildDir = 1;
                        if (dx===-1) game.buildDir = 3;
                        if (dy===1) game.buildDir = 2;
                        if (dy===-1) game.buildDir = 0;
                        machine.dir = game.buildDir;
                    }
                }
                window.lastBuild = {gx, gy};
            }
        }
    }
}

function getCost(type) {
    if (type === 'conveyor') return {i: 1, c: 0, p: 0};
    if (type.includes('miner')) return {i: 5, c: 0, p: 0};
    if (type === 'processor') return {i: 0, c: 10, p: 0};
    if (type === 'assembler') return {i: 0, c: 0, p: 20};
    if (type === 'generator') return {i: 30, c: 0, p: 0};
    return {i:0, c:0, p:0};
}

function inspectMachine(gx, gy) {
    let panel = document.getElementById('inspector-panel');
    if (gx>=0 && gx<MAP_W && gy>=0 && gy<MAP_H && game.grid[gy][gx]) {
        let m = game.grid[gy][gx];
        document.getElementById('ins-title').innerText = m.type.replace('_', ' ').toUpperCase();
        document.getElementById('ins-power').innerText = m.powerDraw > 0 ? `-${m.powerDraw} MW` : `+20 MW`;
        document.getElementById('ins-eff').innerText = game.hasPower() ? '100%' : 'OFFLINE';
        if (!game.hasPower()) document.getElementById('ins-eff').className = 'text-red';
        else document.getElementById('ins-eff').className = 'text-green';
        
        let io = "I/O: None";
        if (m.type === 'processor') io = "Input: Ore | Out: Plate";
        if (m.type === 'assembler') io = "In: Cu+Fe Plates | Out: Part";
        if (m.type.includes('miner')) io = "Out: Ore (Dmg: " + m.oreType + ")";
        document.getElementById('ins-io').innerText = io;
        
        panel.classList.remove('hidden');
    } else {
        panel.classList.add('hidden');
    }
}

// UI Binds
document.querySelectorAll('.build-item').forEach(el => {
    el.addEventListener('click', () => setBuild(el.dataset.type, el));
});
document.getElementById('tool-cursor').addEventListener('click', () => setTool('cursor'));
document.getElementById('tool-delete').addEventListener('click', () => setTool('delete'));

document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('screen-tutorial').classList.add('hidden');
    if(document.getElementById('chk-sound').checked) sfx.init();
    else sfx.enabled = false;
    initGame();
});

document.getElementById('btn-upgrades').addEventListener('click', () => {
    document.getElementById('modal-upgrades').classList.remove('hidden');
});
document.getElementById('btn-close-upgrades').addEventListener('click', () => {
    document.getElementById('modal-upgrades').classList.add('hidden');
});

document.getElementById('btn-next-level').addEventListener('click', () => {
    game.nextLevel();
});
document.getElementById('btn-upg-speed').addEventListener('click', () => game.buyUpgrade('speed'));
document.getElementById('btn-upg-eff').addEventListener('click', () => game.buyUpgrade('efficiency'));
