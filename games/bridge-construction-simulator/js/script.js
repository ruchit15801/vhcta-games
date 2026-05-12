// ==========================================
// BRIDGE CONSTRUCTION SIMULATOR - CORE LOGIC
// ==========================================

const CONFIG = {
    materials: {
        road:  { cost: 100, strength: 30, weight: 1.5, maxLen: 160, color: '#475569', rope: false },
        wood:  { cost: 50,  strength: 15, weight: 0.8, maxLen: 130, color: '#b45309', rope: false },
        steel: { cost: 200, strength: 50, weight: 2.0, maxLen: 220, color: '#e2e8f0', rope: false },
        rope:  { cost: 30,  strength: 20, weight: 0.2, maxLen: 180, color: '#d97706', rope: true }
    },
    grid: 20,
    physicsSteps: 20,
    gravity: 0.3
};

// --- AUDIO SYNTHESIZER (No external dependencies) ---
class AudioSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }
    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if(AudioContext) this.ctx = new AudioContext();
        }
    }
    play(type) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;
        if (type === 'build') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'snap') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'success') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(600, now + 0.2);
            osc.frequency.setValueAtTime(800, now + 0.4);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.8);
            osc.start(now);
            osc.stop(now + 0.8);
        } else if (type === 'start') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }
    }
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}
const audio = new AudioSystem();

// --- DATA STRUCTURES ---
class Node {
    constructor(x, y, fixed = false) {
        this.x = x; this.y = y;
        this.oldX = x; this.oldY = y;
        this.fixed = fixed;
        this.mass = fixed ? 0 : 1;
        this.links = []; // Beams connected
    }
}

class Beam {
    constructor(n1, n2, type) {
        this.n1 = n1;
        this.n2 = n2;
        this.type = type;
        this.mat = CONFIG.materials[type];
        let dx = n2.x - n1.x;
        let dy = n2.y - n1.y;
        this.length = Math.hypot(dx, dy);
        this.broken = false;
        this.stress = 0;
        
        // Add weight mass to nodes
        if(!n1.fixed) n1.mass += this.mat.weight / 2;
        if(!n2.fixed) n2.mass += this.mat.weight / 2;
        
        n1.links.push(this);
        n2.links.push(this);
    }
}

// --- GAME LOGIC ---
const Game = {
    canvas: null,
    ctx: null,
    levels: [],
    currentLevel: 1,
    state: 'MENU', // MENU, BUILD, SIM, RESULT
    
    camX: 0, camY: 0, zoom: 1,
    nodes: [], beams: [],
    
    // Build state
    budget: 0,
    spent: 0,
    currentMaterial: 'road',
    selectedNode: null,
    dragNode: null,
    tempTarget: null, // {x, y} for dragging preview
    pointer: { x: 0, y: 0, isDown: false, startCamX: 0, startCamY: 0, startXP: 0, startYP: 0},
    toolMode: 'build', // build, delete
    
    // Sim State
    maxStress: 0,
    vehicleParams: {x: 0, targetX:0, wait: 60, speed: 2, weight: 15, active: false},
    
    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.generateLevels();
        this.bindEvents();
        
        requestAnimationFrame((t) => this.loop(t));
    },
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },
    
    generateLevels() {
        for(let i=1; i<=30; i++) {
            let gap = 150 + i * 30; // progressively larger
            let hOffset = (i % 4) * 40; // slope variants
            let pX = -gap/2;
            let anchors = [];
            let terrains = [];

            // Left Cliff
            terrains.push([
                {x: -2000, y: 1000},
                {x: -2000, y: 0},
                {x: pX, y: 0},
                {x: pX, y: 80},
                {x: pX - 50, y: 150},
                {x: pX - 60, y: 1000}
            ]);
            anchors.push({x: pX, y: 0});
            anchors.push({x: pX, y: 80}); // wall support

            // Right Cliff
            let rY = -hOffset;
            terrains.push([
                {x: pX + gap, y: 1000},
                {x: pX + gap + 30, y: rY + 150},
                {x: pX + gap, y: rY + 80},
                {x: pX + gap, y: rY},
                {x: 2000, y: rY},
                {x: 2000, y: 1000}
            ]);
            anchors.push({x: pX + gap, y: rY});
            anchors.push({x: pX + gap, y: rY + 80}); // wall support

            // Intermediate Pillars (Complex Levels)
            if(i >= 5 && i % 2 === 0) {
                 let mX = 0;
                 let mY = Math.max(0, rY) + 100 + Math.random()*80;
                 terrains.push([
                     {x: mX - 40, y: 1000},
                     {x: mX - 25, y: mY},
                     {x: mX + 25, y: mY},
                     {x: mX + 40, y: 1000}
                 ]);
                 anchors.push({x: mX - 25, y: mY});
                 anchors.push({x: mX + 25, y: mY});
            }

            this.levels.push({
                id: i,
                gap: gap,
                startX: pX - 80,
                targetX: pX + gap + 100,
                budget: 2000 + i * 800,
                terrains: terrains,
                anchors: anchors,
                vehicleWeight: 10 + i * 1.5,
                vehicleSpeed: 2 + i * 0.05
            });
        }
    },
    
    loadLevel(lvlIndex) {
        const lvl = this.levels[lvlIndex - 1];
        if(!lvl) return;
        this.currentLevel = lvl.id;
        this.budget = lvl.budget;
        this.spent = 0;
        
        this.nodes = [];
        this.beams = [];
        
        lvl.anchors.forEach(a => {
            let n = new Node(a.x, a.y, true);
            this.nodes.push(n);
        });
        
        this.camX = 0;
        this.camY = -100;
        this.zoom = Math.min(1, window.innerWidth / (lvl.gap + 300));
        
        this.updateHUD();
        this.updateBiomeTheme();
        this.state = 'BUILD';
        
        document.getElementById('level-text').innerText = `LEVEL ${this.currentLevel}`;
        
        // Reset tools
        this.toolMode = 'build';
        document.getElementById('btn-delete').classList.remove('active-tool');
        
        audio.init();
    },

    updateBiomeTheme() {
        let root = document.documentElement;
        if(this.currentLevel <= 10) {
            // River Valley (Green/Teal)
            root.style.setProperty('--accent-glow', '0 0 15px rgba(20, 184, 166, 0.6)');
            root.style.setProperty('--panel-border', 'rgba(20, 184, 166, 0.4)');
            root.style.setProperty('--accent-blue', '#14b8a6');
            document.getElementById('game-background').style.filter = 'hue-rotate(0deg) brightness(0.6) contrast(1.1)';
        } else if (this.currentLevel <= 20) {
            // Sunset Canyon (Orange)
            root.style.setProperty('--accent-glow', '0 0 15px rgba(249, 115, 22, 0.6)');
            root.style.setProperty('--panel-border', 'rgba(249, 115, 22, 0.4)');
            root.style.setProperty('--accent-blue', '#f97316');
            document.getElementById('game-background').style.filter = 'hue-rotate(150deg) brightness(0.5) contrast(1.2)';
        } else {
            // High Tech Industrial (Purple)
            root.style.setProperty('--accent-glow', '0 0 15px rgba(168, 85, 247, 0.6)');
            root.style.setProperty('--panel-border', 'rgba(168, 85, 247, 0.4)');
            root.style.setProperty('--accent-blue', '#a855f7');
            document.getElementById('game-background').style.filter = 'hue-rotate(250deg) brightness(0.4) contrast(1.3) grayscale(0.5)';
        }
    },
    
    updateHUD() {
        document.getElementById('budget-text').innerText = `$${Math.round(this.budget - this.spent)}`;
        let pct = Math.min(100, Math.max(0, (this.spent / this.budget) * 100));
        let fill = document.getElementById('budget-fill');
        fill.style.width = pct + '%';
        if (pct > 90) fill.style.background = '#f87171';
        else fill.style.background = 'linear-gradient(90deg, var(--accent-green), var(--accent-yellow))';
    },
    
    screenToWorld(sx, sy) {
        let cx = this.canvas.width / 2;
        let cy = this.canvas.height / 2;
        let wx = ((sx - cx) / this.zoom) - this.camX;
        let wy = ((sy - cy) / this.zoom) - this.camY;
        return {x: wx, y: wy};
    },
    
    snap(val) {
        return Math.round(val / CONFIG.grid) * CONFIG.grid;
    },
    
    findNode(x, y, radius = 15) {
        let rSq = radius * radius;
        for(let n of this.nodes) {
            let dx = n.x - x; let dy = n.y - y;
            if (dx*dx + dy*dy < rSq) return n;
        }
        return null;
    },
    
    findBeam(x, y, radius = 10) {
        for(let b of this.beams) {
            if(b.broken) continue;
            let lenSq = b.length * b.length;
            let dot = (((x - b.n1.x)*(b.n2.x - b.n1.x)) + ((y - b.n1.y)*(b.n2.y - b.n1.y))) / lenSq;
            let t = Math.max(0, Math.min(1, dot));
            let projX = b.n1.x + t * (b.n2.x - b.n1.x);
            let projY = b.n1.y + t * (b.n2.y - b.n1.y);
            let dx = x - projX; let dy = y - projY;
            if (dx*dx + dy*dy < radius*radius) return b;
        }
        return null;
    },
    
    removeNode(n) {
        if(n.fixed) return;
        // remove all connected beams
        this.beams = this.beams.filter(b => {
            if(b.n1 === n || b.n2 === n) {
                this.spent -= b.length * b.mat.cost / 100;
                return false;
            }
            return true;
        });
        this.nodes = this.nodes.filter(nd => nd !== n);
        this.updateHUD();
    },
    
    removeBeam(b) {
        this.beams = this.beams.filter(bm => bm !== b);
        this.spent -= b.length * b.mat.cost / 100;
        this.updateHUD();
        // remove orphaned non-fixed nodes
        this.nodes = this.nodes.filter(n => {
            if(n.fixed) return true;
            let hasLink = this.beams.some(bm => bm.n1 === n || bm.n2 === n);
            return hasLink;
        });
    },

    bindEvents() {
        // UI Events
        document.getElementById('btn-start-game').addEventListener('click', () => {
            audio.init();
            audio.play('start');
            document.getElementById('guide-screen').classList.remove('active');
            document.getElementById('ui-layer').classList.remove('hidden');
            this.loadLevel(1);
        });

        document.getElementById('btn-menu').addEventListener('click', () => {
            this.state = 'MENU';
            document.getElementById('guide-screen').classList.add('active');
            document.getElementById('ui-layer').classList.add('hidden');
        });

        document.getElementById('btn-sound').addEventListener('click', (e) => {
            let on = audio.toggle();
            e.target.innerText = on ? '🔊' : '🔇';
        });

        document.querySelectorAll('.mat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mat-btn').forEach(b => b.classList.remove('active'));
                let b = e.currentTarget;
                b.classList.add('active');
                this.currentMaterial = b.getAttribute('data-mat');
                this.toolMode = 'build';
                document.getElementById('btn-delete').classList.remove('active-tool');
            });
        });

        document.getElementById('btn-delete').addEventListener('click', (e) => {
            this.toolMode = 'delete';
            e.currentTarget.classList.add('active-tool');
        });

        document.getElementById('btn-clear').addEventListener('click', () => {
            if(confirm("Clear current design?")) {
                this.loadLevel(this.currentLevel);
            }
        });

        document.getElementById('btn-undo').addEventListener('click', () => {
            if(this.state !== 'BUILD' || this.beams.length === 0) return;
            let lastBeam = this.beams[this.beams.length - 1];
            this.removeBeam(lastBeam);
            audio.play('snap');
        });

        document.getElementById('btn-simulate').addEventListener('click', () => {
            if(this.state === 'BUILD') this.startSimulation();
        });
        document.getElementById('btn-stop-sim').addEventListener('click', () => {
             this.stopSimulation();
        });

        // Overlay Navigation
        document.getElementById('btn-retry').addEventListener('click', () => {
            document.getElementById('result-screen').classList.remove('active');
            this.stopSimulation();
        });
        document.getElementById('btn-next-level').addEventListener('click', () => {
            document.getElementById('result-screen').classList.remove('active');
            this.loadLevel(this.currentLevel + 1);
        });

        // Canvas Input
        this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        window.addEventListener('pointermove', (e) => this.onPointerMove(e));
        window.addEventListener('pointerup', (e) => this.onPointerUp(e));
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            let zoomFactor = -e.deltaY * 0.001;
            this.zoom = Math.max(0.2, Math.min(3, this.zoom + zoomFactor));
        }, {passive: false});
    },
    
    onPointerDown(e) {
        if(this.state !== 'BUILD') return;
        if(e.button === 1 || e.button === 2) { // Middle or Right click = Pan
            this.pointer.isPan = true;
            this.pointer.startCamX = this.camX;
            this.pointer.startCamY = this.camY;
            this.pointer.startXP = e.clientX;
            this.pointer.startYP = e.clientY;
            return;
        }

        const w = this.screenToWorld(e.clientX, e.clientY);
        
        if (this.toolMode === 'delete') {
            let n = this.findNode(w.x, w.y);
            if(n) this.removeNode(n);
            else {
                let b = this.findBeam(w.x, w.y);
                if (b) this.removeBeam(b);
            }
            audio.play('snap');
            return;
        }

        let n = this.findNode(w.x, w.y);
        if (n) {
            this.selectedNode = n;
        } else {
            // Clicked empty space. Try snapping to grid to start
            let sx = this.snap(w.x); let sy = this.snap(w.y);
            let tryN = this.findNode(sx, sy);
            if(tryN) {
                this.selectedNode = tryN;
            } else {
                this.tempTarget = {x: sx, y: sy};
            }
        }
        
        this.pointer.isDown = true;
    },
    
    onPointerMove(e) {
        if (this.pointer.isPan) {
            let dx = (e.clientX - this.pointer.startXP) / this.zoom;
            let dy = (e.clientY - this.pointer.startYP) / this.zoom;
            this.camX = this.pointer.startCamX + dx;
            this.camY = this.pointer.startCamY + dy;
            return;
        }

        if(!this.pointer.isDown || this.state !== 'BUILD') return;
        const w = this.screenToWorld(e.clientX, e.clientY);
        
        let targetX = this.snap(w.x);
        let targetY = this.snap(w.y);
        
        let n = this.findNode(targetX, targetY);
        if(n) {
            this.tempTarget = {x: n.x, y: n.y};
        } else {
            // Cap distance visually to guarantee placement
            if(this.selectedNode) {
                let dx = targetX - this.selectedNode.x;
                let dy = targetY - this.selectedNode.y;
                let dist = Math.hypot(dx, dy);
                let maxL = CONFIG.materials[this.currentMaterial].maxLen;
                if(dist > maxL) {
                    let a = Math.atan2(dy, dx);
                    targetX = this.snap(this.selectedNode.x + Math.cos(a) * maxL);
                    targetY = this.snap(this.selectedNode.y + Math.sin(a) * maxL);
                }
            }
            this.tempTarget = {x: targetX, y: targetY};
        }
    },
    
    onPointerUp(e) {
        if(this.pointer.isPan) {
            this.pointer.isPan = false;
            return;
        }
        if(!this.pointer.isDown || this.state !== 'BUILD') return;
        this.pointer.isDown = false;
        
        if (this.selectedNode && this.tempTarget) {
            let dx = this.tempTarget.x - this.selectedNode.x;
            let dy = this.tempTarget.y - this.selectedNode.y;
            let dist = Math.hypot(dx, dy);
            let mat = CONFIG.materials[this.currentMaterial];
            
            // Tolerance added to avoid silently failing due to decimals
            if (dist > 5 && dist <= mat.maxLen + 15) {
                let cost = (dist * mat.cost) / 100;
                if (this.spent + cost <= this.budget) {
                    let endNode = this.findNode(this.tempTarget.x, this.tempTarget.y);
                    if (!endNode) {
                        endNode = new Node(this.tempTarget.x, this.tempTarget.y);
                        this.nodes.push(endNode);
                    }
                    
                    let exists = this.beams.some(b => 
                        (b.n1 === this.selectedNode && b.n2 === endNode) ||
                        (b.n2 === this.selectedNode && b.n1 === endNode)
                    );
                    
                    if(!exists) {
                        let newBeam = new Beam(this.selectedNode, endNode, this.currentMaterial);
                        this.beams.push(newBeam);
                        this.spent += cost;
                        this.updateHUD();
                        audio.play('build');
                    }
                } else {
                    // Visual feedback for out of budget
                    let fill = document.getElementById('budget-fill');
                    fill.style.background = '#f87171';
                    setTimeout(() => this.updateHUD(), 300);
                    audio.play('snap');
                }
            }
        }
        
        this.selectedNode = null;
        this.tempTarget = null;
    },

    startSimulation() {
        this.state = 'SIM';
        this.maxStress = 0;
        document.getElementById('sim-overlay').classList.remove('hidden');
        document.getElementById('ui-layer').classList.add('hidden');
        
        // Save state for undo/stop
        this.savedState = {
            nodes: this.nodes.map(n => ({x: n.x, y:n.y, fixed:n.fixed, id: Math.random()})),
            beams: []
        };
        // Mapping old nodes to easily recreate beams
        this.nodes.forEach((n, i) => n._id = this.savedState.nodes[i].id);
        this.beams.forEach(b => {
            this.savedState.beams.push({
                n1: b.n1._id, n2: b.n2._id, type: b.type
            });
        });

        const lvl = this.levels[this.currentLevel - 1];
        
        this.vehicleParams = {
            x: lvl.startX,
            y: -50, // Let it fall onto the terrain naturally at start
            targetX: lvl.targetX,
            wait: 60,
            speed: lvl.vehicleSpeed,
            weight: lvl.vehicleWeight,
            active: true
        };
        audio.play('start');
    },

    stopSimulation() {
        this.state = 'BUILD';
        document.getElementById('sim-overlay').classList.add('hidden');
        document.getElementById('ui-layer').classList.remove('hidden');
        
        // Restore
        if(this.savedState) {
            this.nodes = this.savedState.nodes.map(sn => {
                let n = new Node(sn.x, sn.y, sn.fixed);
                n._id = sn.id;
                return n;
            });
            this.beams = this.savedState.beams.map(sb => {
                let n1 = this.nodes.find(n => n._id === sb.n1);
                let n2 = this.nodes.find(n => n._id === sb.n2);
                return new Beam(n1, n2, sb.type);
            });
        }
    },

    showResult(success) {
        this.state = 'RESULT';
        this.vehicleParams.active = false;
        
        const res = document.getElementById('result-screen');
        res.classList.add('active');
        
        const title = document.getElementById('result-title');
        title.innerText = success ? 'TEST PASSED' : 'STRUCTURAL FAILURE';
        title.style.color = success ? 'var(--accent-green)' : 'var(--accent-red)';
        
        document.getElementById('result-budget').innerText = `$${Math.round(this.spent)}`;
        document.getElementById('result-stress').innerText = `${Math.round(this.maxStress)}%`;
        
        if(success) audio.play('success');
        else audio.play('snap');
    },

    physicsStep() {
        if(this.state !== 'SIM') return;

        // Apply gravity and inertia (Verlet)
        this.nodes.forEach(n => {
            if(!n.fixed) {
                let vx = n.x - n.oldX;
                let vy = n.y - n.oldY;
                n.oldX = n.x;
                n.oldY = n.y;
                let g = CONFIG.gravity * n.mass;
                n.x += vx * 0.99; // Damping
                n.y += vy * 0.99 + g;
            }
        });

        // Vehicle constraints applied to nodes dynamically based on position
        if(this.vehicleParams.active) {
            if(this.vehicleParams.wait > 0) {
                this.vehicleParams.wait--;
            } else {
                this.vehicleParams.x += this.vehicleParams.speed;
                let vX = this.vehicleParams.x;
                
                // Find road segments at this X
                let validRoad = null;
                let maxT = -1;
                
                for(let b of this.beams) {
                    if(b.type !== 'road' || b.broken) continue;
                    let minX = Math.min(b.n1.x, b.n2.x);
                    let maxX = Math.max(b.n1.x, b.n2.x);
                    if(vX >= minX && vX <= maxX && minX !== maxX) {
                        let t = (vX - b.n1.x) / (b.n2.x - b.n1.x);
                        if(t >= 0 && t <= 1) {
                            validRoad = {b:b, t:t};
                            break;
                        }
                    }
                }

                if(validRoad) {
                    let b = validRoad.b; let t = validRoad.t;
                    this.vehicleParams.y = b.n1.y + t * (b.n2.y - b.n1.y) - 15;
                    // Apply downward acceleration proportionally
                    let force = this.vehicleParams.weight;
                    if(!b.n1.fixed) b.n1.y += force * (1-t);
                    if(!b.n2.fixed) b.n2.y += force * t;
                } else {
                    // Check Terrain Collision
                    let validTerrainY = null;
                    const lvl = this.levels[this.currentLevel - 1];
                    if(lvl.terrains) {
                        for(let poly of lvl.terrains) {
                            for(let i=0; i<poly.length-1; i++) {
                                let p1 = poly[i]; let p2 = poly[i+1];
                                let minX = Math.min(p1.x, p2.x);
                                let maxX = Math.max(p1.x, p2.x);
                                if(vX >= minX && vX <= maxX && minX !== maxX) {
                                    let t = (vX - p1.x) / (p2.x - p1.x);
                                    let y = p1.y + t * (p2.y - p1.y);
                                    if(validTerrainY === null || y < validTerrainY) validTerrainY = y;
                                }
                            }
                        }
                    }

                    // Tolerance for placing car onto terrain (snap down)
                    if(validTerrainY !== null && (this.vehicleParams.y - 20) <= validTerrainY + 25) {
                        this.vehicleParams.y += (validTerrainY - 15 - this.vehicleParams.y) * 0.5; // Smooth adjust
                    } else {
                        // Falling state
                        this.vehicleParams.y += this.vehicleParams.weight; 
                        if(this.vehicleParams.y > 1000) {
                            this.showResult(false);
                        }
                    }
                }

                if(this.vehicleParams.x >= this.vehicleParams.targetX && (validRoad || this.vehicleParams.y < 800)) {
                    this.showResult(true);
                }
            }
        }

        // Solve constraints across multiple steps for stability
        let currentMaxStress = 0;
        
        for(let j=0; j<CONFIG.physicsSteps; j++) {
            for(let i=0; i<this.beams.length; i++) {
                let b = this.beams[i];
                if(b.broken) continue;

                let dx = b.n2.x - b.n1.x;
                let dy = b.n2.y - b.n1.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if (dist === 0) continue;

                let diff = (dist - b.length);
                let stressRatio = Math.abs(diff) / b.mat.strength;
                b.stress = stressRatio;

                if (stressRatio > currentMaxStress) currentMaxStress = stressRatio;

                // Threshold to break
                if(stressRatio > 1.2) {
                    b.broken = true;
                    if(j===0) audio.play('snap'); 
                    continue; // Let it swing freely
                }

                if(b.mat.rope && diff < 0) continue; // Rope doesn't compress

                let percent = diff / dist / 2;
                let offsetX = dx * percent;
                let offsetY = dy * percent;

                // Inverse mass factor for stability (assuming equal relative mass for simplicity)
                if(!b.n1.fixed) { b.n1.x += offsetX; b.n1.y += offsetY; }
                if(!b.n2.fixed) { b.n2.x -= offsetX; b.n2.y -= offsetY; }
            }
        }

        if(currentMaxStress * 100 > this.maxStress) {
            this.maxStress = currentMaxStress * 100;
            const msUI = document.getElementById('max-stress-val');
            if(msUI) msUI.innerText = `${Math.min(100, Math.round(this.maxStress))}%`;
            if (this.maxStress > 90) msUI.style.color = 'var(--accent-red)';
            else if (this.maxStress > 60) msUI.style.color = 'var(--accent-yellow)';
            else msUI.style.color = 'var(--accent-green)';
        }
    },

    loop() {
        if(this.state === 'SIM' || this.state === 'RESULT') {
            this.physicsStep();
        }
        this.render();
        requestAnimationFrame(() => this.loop());
    },

    shadeColor(color, percent) {
        if(!color.startsWith('#')) return color;
        let R = parseInt(color.substring(1,3),16);
        let G = parseInt(color.substring(3,5),16);
        let B = parseInt(color.substring(5,7),16);
        R = parseInt(R * (100 + percent) / 100);
        G = parseInt(G * (100 + percent) / 100);
        B = parseInt(B * (100 + percent) / 100);
        R = (R<255)?R:255;  G = (G<255)?G:255;  B = (B<255)?B:255;
        R = Math.max(0, R); G = Math.max(0, G); B = Math.max(0, B);
        let RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
        let GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
        let BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
        return "#"+RR+GG+BB;
    },

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if(this.state === 'MENU') return;

        ctx.save();
        ctx.translate(this.canvas.width/2 + this.camX * this.zoom, this.canvas.height/2 + this.camY * this.zoom);
        ctx.scale(this.zoom, this.zoom);

        // Draw Custom Biome Terrain Over Background
        const lvl = this.levels[this.currentLevel - 1];
        if(lvl && lvl.terrains) {
            let tColor = '#78350f'; let topColor = '#65a30d'; // Forest
            if(this.currentLevel > 10 && this.currentLevel <= 20) { tColor = '#7c2d12'; topColor = '#ea580c'; } // Canyon
            if(this.currentLevel > 20) { tColor = '#1e293b'; topColor = '#64748b'; } // Industrial
            
            lvl.terrains.forEach(poly => {
                // Background depth Extrusion
                ctx.fillStyle = this.shadeColor(tColor, -40);
                ctx.beginPath();
                poly.forEach((p, i) => {
                    if(i===0) ctx.moveTo(p.x, p.y + 60);
                    else ctx.lineTo(p.x, p.y + 60);
                });
                ctx.fill();

                // Front Face
                ctx.fillStyle = tColor;
                ctx.beginPath();
                poly.forEach((p, i) => {
                    if(i===0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.fill();

                // Top Driving Edge Accent
                poly.forEach((p, i) => {
                    if (i > 0) {
                        let prev = poly[i-1];
                        if (p.y < 800 && prev.y < 800 && Math.abs(p.y - prev.y) <= 100) {
                            ctx.strokeStyle = topColor;
                            ctx.lineWidth = 14;
                            ctx.lineCap = 'round';
                            ctx.beginPath();
                            ctx.moveTo(prev.x, prev.y);
                            ctx.lineTo(p.x, p.y);
                            ctx.stroke();
                        }
                    }
                });
                
                // Outline border for sharp 2D game look
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 4;
                ctx.lineJoin = 'round';
                ctx.beginPath();
                poly.forEach((p, i) => {
                    if(i===0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
            });
        }

        // Draw Environment Anchors over Terrain (Red Zone indicators)
        if(lvl) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
            lvl.anchors.forEach(a => {
                ctx.beginPath();
                ctx.arc(a.x, a.y, 25, 0, Math.PI*2);
                ctx.fill();
            });
        }

        // Draw Grid if Building
        if(this.state === 'BUILD') {
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            let bounds = 1000;
            ctx.beginPath();
            for(let x = -bounds; x <= bounds; x += CONFIG.grid) {
                ctx.moveTo(x, -bounds); ctx.lineTo(x, bounds);
            }
            for(let y = -bounds; y <= bounds; y += CONFIG.grid) {
                ctx.moveTo(-bounds, y); ctx.lineTo(bounds, y);
            }
            ctx.stroke();
        }

        // Render broken debris
        this.beams.forEach(b => {
             if(b.broken) {
                 ctx.strokeStyle = b.mat.color;
                 ctx.globalAlpha = 0.5;
                 ctx.lineWidth = 4;
                 ctx.beginPath();
                 ctx.moveTo(b.n1.x, b.n1.y);
                 ctx.lineTo(b.n2.x, b.n2.y);
                 ctx.stroke();
                 ctx.globalAlpha = 1;
             }
        });

        // Render 3D Extruded Beams
        this.beams.forEach(b => {
            if(b.broken) return;
            
            ctx.lineCap = 'round';
            let width = b.type === 'steel' ? 8 : (b.type === 'road' ? 12 : 6);
            let color = b.mat.color;
            let darkColor = this.shadeColor(color, -40); // Darker shade for 3D depth

            // Draw 3D Depth (Back Face extruded down by 5px)
            if (b.type !== 'rope') {
                ctx.strokeStyle = darkColor;
                ctx.lineWidth = width;
                ctx.beginPath();
                ctx.moveTo(b.n1.x, b.n1.y + 6);
                ctx.lineTo(b.n2.x, b.n2.y + 6);
                ctx.stroke();
            }
            
            // Stress color mixing on the front face (Green -> Red)
            if(this.state === 'SIM' || this.state === 'RESULT') {
                if(b.stress > 0.5) {
                    let intensity = Math.min(1, (b.stress - 0.5) * 2);
                    color = `rgba(239, 68, 68, ${intensity})`;
                }
            }
            
            // Draw Front Face
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(b.n1.x, b.n1.y);
            ctx.lineTo(b.n2.x, b.n2.y);
            ctx.stroke();
            
            // Detailing for roads and rope
            if(b.type === 'road') {
                ctx.strokeStyle = '#eab308';
                ctx.lineWidth = 2;
                ctx.setLineDash([10, 10]);
                ctx.beginPath();
                ctx.moveTo(b.n1.x, b.n1.y);
                ctx.lineTo(b.n2.x, b.n2.y);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (b.type === 'rope') {
                ctx.strokeStyle = '#92400e';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(b.n1.x, b.n1.y);
                ctx.lineTo(b.n2.x, b.n2.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        // Current build preview line
        if(this.state === 'BUILD' && this.selectedNode && this.tempTarget && this.toolMode === 'build') {
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 4;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(this.selectedNode.x, this.selectedNode.y);
            ctx.lineTo(this.tempTarget.x, this.tempTarget.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // draw cost
            let dx = this.tempTarget.x - this.selectedNode.x;
            let dy = this.tempTarget.y - this.selectedNode.y;
            let dist = Math.hypot(dx, dy);
            let cost = Math.round((dist * CONFIG.materials[this.currentMaterial].cost) / 100);
            
            ctx.fillStyle = (dist > CONFIG.materials[this.currentMaterial].maxLen || this.spent + cost > this.budget) ? '#ef4444' : 'white';
            ctx.font = '16px "Share Tech Mono"';
            ctx.fillText(`$${cost} (${Math.round(dist)}m)`, this.tempTarget.x + 15, this.tempTarget.y - 15);
        }

        // Render Nodes (Metallic Bolts in 3D)
        this.nodes.forEach(n => {
            // Draw 3D Depth Base (Extruded down)
            ctx.fillStyle = n.fixed ? '#7f1d1d' : '#1e293b';
            ctx.beginPath();
            ctx.arc(n.x, n.y + 4, n.fixed ? 10 : 8, 0, Math.PI*2);
            ctx.fill();

            // Outer casing Top
            ctx.fillStyle = n.fixed ? '#b91c1c' : '#475569';
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.fixed ? 10 : 8, 0, Math.PI*2);
            ctx.fill();
            
            // Hex/Bolt inner detail
            ctx.fillStyle = n.fixed ? '#fca5a5' : '#94a3b8';
            ctx.beginPath();
            for(let i=0; i<6; i++) {
                let angle = i * Math.PI / 3;
                let r = n.fixed ? 6 : 4;
                let px = n.x + Math.cos(angle) * r;
                let py = n.y + Math.sin(angle) * r;
                if(i===0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            
            // Center pin
            ctx.fillStyle = '#0f172a';
            ctx.beginPath(); ctx.arc(n.x, n.y, 2, 0, Math.PI*2); ctx.fill();
            
            if (this.selectedNode === n) {
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
                ctx.lineWidth = 4;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.arc(n.x, n.y, 20, 0, Math.PI*2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        });

        // Render Vehicle (Realistic Truck)
        if ((this.state === 'SIM' || this.state === 'RESULT') && this.vehicleParams.active) {
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 12;
            
            let vx = this.vehicleParams.x;
            let vy = this.vehicleParams.y - 10; // offset slightly up
            
            // Truck Body
            ctx.fillStyle = '#fbbf24'; // Yellow industrial truck
            // Cab
            ctx.fillRect(vx + 5, vy - 25, 20, 25);
            // Bed / Front
            ctx.fillRect(vx - 25, vy - 15, 30, 15);
            
            ctx.shadowBlur = 0;
            // Details
            ctx.fillStyle = '#bae6fd'; // Window
            ctx.fillRect(vx + 12, vy - 20, 10, 10);
            ctx.fillStyle = '#0f172a'; // Bumper
            ctx.fillRect(vx + 23, vy - 5, 4, 5);
            ctx.fillRect(vx - 27, vy - 5, 4, 5);
            
            // Wheels
            let wAngle = (vx / 8) % (Math.PI * 2); // Rotating wheels
            const drawWheel = (wx, wy) => {
                ctx.fillStyle = '#1e293b'; // Tire
                ctx.beginPath(); ctx.arc(wx, wy, 8, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#94a3b8'; // Hubcap
                ctx.beginPath(); ctx.arc(wx, wy, 4, 0, Math.PI*2); ctx.fill();
                // Spokes
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(wx + Math.cos(wAngle)*4, wy + Math.sin(wAngle)*4);
                ctx.lineTo(wx - Math.cos(wAngle)*4, wy - Math.sin(wAngle)*4);
                ctx.moveTo(wx + Math.cos(wAngle+Math.PI/2)*4, wy + Math.sin(wAngle+Math.PI/2)*4);
                ctx.lineTo(wx - Math.cos(wAngle+Math.PI/2)*4, wy - Math.sin(wAngle+Math.PI/2)*4);
                ctx.stroke();
            };
            
            drawWheel(vx - 15, vy + 2);
            drawWheel(vx + 15, vy + 2);
        }

        ctx.restore();
    }
};

window.onload = () => Game.init();
