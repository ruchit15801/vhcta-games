// Space Colony Manager - Core Logic
const CONFIG = {
    FPS_TICK: 60,
    SIM_TICK_MS: 1000, 
    TILE_SIZE: 64, // Isometric width basis
    GRID_ROWS: 15,
    GRID_COLS: 15
};

// Data Structures
const BUILDING_TYPES = {
    'habitat': { name: 'Habitat', costEnergy: 10, costOxy: 0, costFood: 0, outEnergy: -5, outOxy: 0, outFood: 0, capacity: 5, imgSrc: 'assets/images/bldg-habitat.png', filter: 'none' },
    'oxy': { name: 'O2 Gen', costEnergy: 15, costOxy: 0, costFood: 0, outEnergy: -10, outOxy: 10, outFood: 0, capacity: 0, imgSrc: 'assets/images/bldg-oxy.png', filter: 'none' },
    'farm': { name: 'Biodome', costEnergy: 20, costOxy: 5, costFood: 0, outEnergy: -15, outOxy: -5, outFood: 10, capacity: 0, imgSrc: 'assets/images/bldg-farm.png', filter: 'none' },
    'power': { name: 'Reactor', costEnergy: 0, costOxy: 0, costFood: 0, outEnergy: 50, outOxy: 0, outFood: 0, capacity: 0, imgSrc: 'assets/images/bldg-habitat.png', filter: 'hue-rotate(180deg) sepia(1)' } // Procedural power station color
};

// Procedural Audio System (Vanilla Web Audio API)
class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
    }
    
    resume() {
        if(this.ctx.state === 'suspended') this.ctx.resume();
    }
    
    toggle(state) {
        this.enabled = state;
        this.masterGain.gain.value = state ? 0.3 : 0;
    }
    
    playClick() {
        if(!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.1);
    }
    
    playBuild() {
        if(!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        
        osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.3);
    }

    playAlert() {
        if(!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(this.masterGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.4);
    }
}

// Game Manager
class ColonyGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // State
        this.running = false;
        this.camera = { x: 0, y: 0 };
        this.resources = { oxy: 100, food: 100, energy: 100, pop: 2, capacity: 5 };
        this.rates = { oxy: 0, food: 0, energy: 0 };
        this.buildings = [];
        this.buildMode = null;
        this.hoverTile = null;
        this.selectedBuilding = null;
        this.level = 1;
        this.survivedTicks = 0;
        this.goalTicks = 60;
        
        this.audio = new AudioSystem();

        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Assets
        this.images = {};
        this.bgImage = new Image();
        this.bgImage.src = 'assets/images/bg-mars.png';
        
        this.loadAssets();
        this.bindEvents();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Center camera initially
        this.camera.x = this.canvas.width / 2;
        this.camera.y = 150;
    }
    
    loadAssets() {
        for(let key in BUILDING_TYPES) {
            let img = new Image();
            img.src = BUILDING_TYPES[key].imgSrc;
            this.images[key] = img;
        }
    }
    
    bindEvents() {
        // UI Start
        document.getElementById('btn-start').addEventListener('click', () => {
            this.audio.resume();
            this.audio.playClick();
            document.getElementById('start-screen').classList.add('hidden');
            document.getElementById('ui-layer').classList.remove('hidden');
            this.startSimulation();
        });

        // Restart
        document.getElementById('btn-restart').addEventListener('click', () => {
            this.audio.playClick();
            location.reload();
        });

        // Next Level
        document.getElementById('btn-next-level').addEventListener('click', () => {
            this.audio.playClick();
            this.levelUp();
        });

        // Audio Toggle
        document.getElementById('toggle-sound').addEventListener('change', (e) => {
            this.audio.toggle(e.target.checked);
        });

        // Build Menu
        document.querySelectorAll('.build-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.audio.playClick();
                // Clear selection
                document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.buildMode = btn.getAttribute('data-type');
                document.getElementById('cancel-build-btn').classList.remove('hidden');
            });
        });

        document.getElementById('cancel-build-btn').addEventListener('click', () => {
             this.audio.playClick();
             this.exitBuildMode();
        });

        // Canvas Interaction
        this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e.clientX, e.clientY));
        this.canvas.addEventListener('touchmove', (e) => {
            if(e.touches.length > 0) {
               this.handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        });
        
        this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e.clientX, e.clientY));
        this.canvas.addEventListener('touchstart', (e) => {
            if(e.touches.length > 0) {
                this.handlePointerMove(e.touches[0].clientX, e.touches[0].clientY); // Update hover
                this.handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
            }
        });

        // Upgrade Panel
        document.getElementById('btn-close-upgrade').addEventListener('click', () => {
             this.audio.playClick();
             document.getElementById('upgrade-panel').classList.add('hidden');
             this.selectedBuilding = null;
        });

        document.getElementById('btn-dismantle').addEventListener('click', () => {
            if(this.selectedBuilding) {
                this.audio.playAlert();
                this.buildings = this.buildings.filter(b => b !== this.selectedBuilding);
                this.selectedBuilding = null;
                document.getElementById('upgrade-panel').classList.add('hidden');
                this.updateRates();
            }
        });
    }

    exitBuildMode() {
        this.buildMode = null;
        document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('cancel-build-btn').classList.add('hidden');
    }
    
    // Isometric Math
    toIso(r, c) {
        // Simple isometric projection
        let x = (c - r) * CONFIG.TILE_SIZE;
        let y = (c + r) * (CONFIG.TILE_SIZE / 2);
        return { x: x + this.camera.x, y: y + this.camera.y };
    }
    
    toGrid(screenX, screenY) {
        let adjX = screenX - this.camera.x;
        let adjY = screenY - this.camera.y;
        
        let c = (adjX / CONFIG.TILE_SIZE + adjY / (CONFIG.TILE_SIZE / 2)) / 2;
        let r = (adjY / (CONFIG.TILE_SIZE / 2) - adjX / CONFIG.TILE_SIZE) / 2;
        return { r: Math.floor(r), c: Math.floor(c) };
    }

    handlePointerMove(x, y) {
        if(!this.running) return;
        let gridPos = this.toGrid(x, y);
        if(gridPos.r >= 0 && gridPos.r < CONFIG.GRID_ROWS && gridPos.c >= 0 && gridPos.c < CONFIG.GRID_COLS) {
            this.hoverTile = gridPos;
        } else {
            this.hoverTile = null;
        }
    }

    handlePointerDown(x, y) {
        if(!this.running || !this.hoverTile) return;
        
        if(this.buildMode) {
            this.placeBuilding(this.hoverTile.r, this.hoverTile.c, this.buildMode);
        } else {
            // Select building
            let found = this.buildings.find(b => b.r === this.hoverTile.r && b.c === this.hoverTile.c);
            if(found) {
                this.audio.playClick();
                this.selectedBuilding = found;
                this.showUpgradePanel(found);
            } else {
                document.getElementById('upgrade-panel').classList.add('hidden');
                this.selectedBuilding = null;
            }
        }
    }

    placeBuilding(r, c, type) {
        // Check occupation
        if(this.buildings.some(b => b.r === r && b.c === c)) {
            this.showAlert("Tile already occupied!", "warning");
            return;
        }
        
        let spec = BUILDING_TYPES[type];
        
        // Check absolute setup cost (we mock this by just allowing it if energy > 0 for now, 
        // to simplify simulation we deduct a chunk of energy to build)
        if(this.resources.energy < spec.costEnergy) {
            this.showAlert(`Insufficient Energy (${spec.costEnergy} required)`, "critical");
            this.audio.playAlert();
            return;
        }

        this.resources.energy -= spec.costEnergy;
        this.buildings.push({ r, c, type, level: 1 });
        this.audio.playBuild();
        this.updateRates();
        this.exitBuildMode();
        this.showAlert(`${spec.name} constructed.`, "success");
    }

    showUpgradePanel(bldg) {
        let spec = BUILDING_TYPES[bldg.type];
        document.getElementById('upgrade-bldg-name').innerText = spec.name;
        document.getElementById('upgrade-stats').innerHTML = `
            Output Rate:<br>
            O2: ${spec.outOxy} | Food: ${spec.outFood} | Energy: ${spec.outEnergy}<br><br>
            Level: ${bldg.level}
        `;
        document.getElementById('upgrade-panel').classList.remove('hidden');
    }

    showAlert(msg, type = "normal") {
        const container = document.getElementById('alert-system');
        const alert = document.createElement('div');
        alert.className = `alert-toast ${type}`;
        alert.innerText = msg;
        container.appendChild(alert);
        setTimeout(() => alert.remove(), 4000);
    }

    startSimulation() {
        this.running = true;
        this.updateRates();
        
        // Main Loops
        this.simInterval = setInterval(() => this.simTick(), CONFIG.SIM_TICK_MS);
        this.renderLoop();
    }

    updateRates() {
        // Base consumption: Pop consumes 2 O2 and 1 Food per tick. Pop needs 1 Habitat capacity.
        this.rates = { oxy: -(this.resources.pop * 2), food: -(this.resources.pop * 1), energy: 0 };
        this.resources.capacity = 0;

        for(let b of this.buildings) {
            let spec = BUILDING_TYPES[b.type];
            this.rates.oxy += spec.outOxy;
            this.rates.food += spec.outFood;
            this.rates.energy += spec.outEnergy;
            this.resources.capacity += spec.capacity;
        }
        
        // Update UI DOM
        const uiMap = {
            'flow-oxy': this.rates.oxy,
            'flow-food': this.rates.food,
            'flow-energy': this.rates.energy
        };
        
        for(let key in uiMap) {
            let el = document.getElementById(key);
            let val = uiMap[key];
            el.innerText = val >= 0 ? `+${val}` : val;
            el.className = `flow-indicator ${val >= 0 ? 'positive' : 'negative'}`;
        }
    }

    simTick() {
        if(!this.running) return;

        // Apply rates
        this.resources.oxy += this.rates.oxy;
        this.resources.food += this.rates.food;
        this.resources.energy += this.rates.energy;

        // Clamp
        if(this.resources.oxy > 200) this.resources.oxy = 200;
        if(this.resources.food > 200) this.resources.food = 200;
        if(this.resources.energy > 500) this.resources.energy = 500;

        // Failure states
        if(this.resources.oxy <= 0 || this.resources.food <= 0 || this.resources.energy <= 0) {
            this.resources.pop -= 1;
            this.audio.playAlert();
            this.showAlert("CITIZEN LOST: Resource Depletion", "critical");
            
            if(this.resources.oxy <= 0) this.resources.oxy = 0;
            if(this.resources.food <= 0) this.resources.food = 0;
            if(this.resources.energy <= 0) this.resources.energy = 0;
        }

        // Population Growth (If capacity and good resources)
        if(this.resources.pop < this.resources.capacity && this.resources.oxy > 50 && this.resources.food > 50) {
            if(Math.random() < 0.2) {
                this.resources.pop += 1;
                this.showAlert("New citizen arrived!", "success");
            }
        }

        // Game Over
        if(this.resources.pop <= 0) {
            this.gameOver();
            return;
        }

        // Progression
        this.survivedTicks++;
        this.updateTickUI();
        
        if(this.survivedTicks >= this.goalTicks) {
            this.winLevel();
        }
        
        // Dynamically update rates just in case pop changed
        this.updateRates();
    }

    updateTickUI() {
        document.getElementById('res-oxy').innerText = Math.floor(this.resources.oxy);
        document.getElementById('res-food').innerText = Math.floor(this.resources.food);
        document.getElementById('res-energy').innerText = Math.floor(this.resources.energy);
        document.getElementById('res-pop').innerText = `${this.resources.pop} / ${this.resources.capacity}`;
        
        let prog = (this.survivedTicks / this.goalTicks) * 100;
        document.getElementById('goal-progress').style.width = `${prog}%`;
        document.getElementById('time-survived').innerText = `${this.survivedTicks} / ${this.goalTicks} c`;
        
        // Visual warnings
        ['oxy','food','energy'].forEach(res => {
           let el = document.getElementById(`res-${res}`);
           if(this.resources[res] < 20) {
               el.style.color = 'var(--neon-red)';
               el.parentElement.parentElement.style.animation = 'pulse 1s infinite alternate';
           } else {
               el.style.color = '#fff';
               el.parentElement.parentElement.style.animation = 'none';
           }
        });
    }

    gameOver() {
        this.running = false;
        clearInterval(this.simInterval);
        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('recap-time').innerText = this.survivedTicks;
        document.getElementById('recap-sectors').innerText = this.level - 1;
        this.audio.playAlert();
    }

    winLevel() {
        this.running = false;
        clearInterval(this.simInterval);
        document.getElementById('level-complete-screen').classList.remove('hidden');
        this.audio.playAlert(); // using as success chime for now
    }

    levelUp() {
        this.level++;
        this.survivedTicks = 0;
        this.goalTicks += 30; // harder each time
        // Give bonuses
        this.resources.energy += 100;
        this.resources.food += 50;
        this.resources.oxy += 50;
        
        document.getElementById('current-level').innerText = this.level;
        document.getElementById('level-goal').innerText = `Survive for ${this.goalTicks} cycles`;
        document.getElementById('level-complete-screen').classList.add('hidden');
        
        this.startSimulation();
    }

    renderLoop() {
        if(!this.running) return;
        requestAnimationFrame(() => this.renderLoop());
        
        this.ctx.fillStyle = '#050608';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw Planet Background
        if(this.bgImage.complete && this.bgImage.naturalWidth > 0) {
             this.ctx.globalAlpha = 0.4;
             // Slow pan
             let panX = (Date.now() * 0.01) % this.canvas.width;
             this.ctx.drawImage(this.bgImage, -panX, 0, this.canvas.width, this.canvas.height);
             this.ctx.drawImage(this.bgImage, this.canvas.width - panX, 0, this.canvas.width, this.canvas.height);
             this.ctx.globalAlpha = 1.0;
        }

        // Render Grid
        this.ctx.lineWidth = 1;
        
        for(let r=0; r < CONFIG.GRID_ROWS; r++) {
            for(let c=0; c < CONFIG.GRID_COLS; c++) {
                let pos = this.toIso(r, c);
                
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x, pos.y);
                this.ctx.lineTo(pos.x + CONFIG.TILE_SIZE, pos.y + CONFIG.TILE_SIZE/2);
                this.ctx.lineTo(pos.x, pos.y + CONFIG.TILE_SIZE);
                this.ctx.lineTo(pos.x - CONFIG.TILE_SIZE, pos.y + CONFIG.TILE_SIZE/2);
                this.ctx.closePath();
                
                // Hover effect
                if(this.hoverTile && this.hoverTile.r === r && this.hoverTile.c === c) {
                    if(this.buildMode) {
                         this.ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
                         this.ctx.fill();
                    } else {
                         this.ctx.strokeStyle = '#0ff';
                         this.ctx.lineWidth = 2;
                         this.ctx.stroke();
                         this.ctx.lineWidth = 1;
                    }
                } else {
                    this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
                    this.ctx.stroke();
                }
            }
        }
        
        // Render Buildings
        let drawList = [];
        for(let b of this.buildings) drawList.push(b);
        if(this.hoverTile && this.buildMode) {
             drawList.push({r: this.hoverTile.r, c: this.hoverTile.c, type: this.buildMode, isPreview: true});
        }
        
        // Depth Sort (Isometric)
        drawList.sort((a,b) => (a.r + a.c) - (b.r + b.c));
        
        for(let b of drawList) {
            let pos = this.toIso(b.r, b.c);
            let spec = BUILDING_TYPES[b.type];
            let img = this.images[b.type];
            
            if(img && img.complete) {
                this.ctx.save();
                if(b.isPreview) {
                     this.ctx.globalAlpha = 0.5;
                     this.ctx.filter = `sepia(1) hue-rotate(180deg) brightness(2)`; 
                } else {
                     if(spec.filter !== 'none') {
                         this.ctx.filter = spec.filter;
                     }
                }
                
                if(this.selectedBuilding === b) {
                     this.ctx.shadowColor = '#0ff';
                     this.ctx.shadowBlur = 20;
                }
                
                // Pulsing animation for buildings if resources are low
                const timeStr = Date.now();
                if(this.resources.energy === 0) {
                     this.ctx.filter = 'grayscale(0.8) brightness(0.5)';
                }
                
                // Offset image so its bottom aligns with diamond center
                // Assuming image is around 128x128
                let w = CONFIG.TILE_SIZE * 2;
                let h = w;
                
                // Magic trick to remove the black background of the images and make them glowing holograms!
                let oldBlend = this.ctx.globalCompositeOperation;
                this.ctx.globalCompositeOperation = 'screen';
                
                this.ctx.drawImage(img, pos.x - w/2, pos.y - h + (CONFIG.TILE_SIZE * 0.75), w, h);
                
                this.ctx.globalCompositeOperation = oldBlend;
                this.ctx.restore();
            }
        }
    }
}

// Add animation keyframes dynamically
const style = document.createElement('style');
style.innerHTML = `
@keyframes pulse {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 15px rgba(255,0,0,0.5); }
}
`;
document.head.appendChild(style);

// Init
window.onload = () => {
    window.game = new ColonyGame();
};
