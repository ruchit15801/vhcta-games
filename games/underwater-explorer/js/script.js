// ==========================================
// UNDERWATER EXPLORER - CORE GAME LOGIC
// ==========================================

// --- UTILS & MATH ---
const MathUtils = {
    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    randomRange: (min, max) => Math.random() * (max - min) + min,
};

// --- DOM ELEMENTS ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui-layer');

const screens = {
    loading: document.getElementById('loading-screen'),
    menu: document.getElementById('main-menu'),
    guide: document.getElementById('guide-screen'),
    settings: document.getElementById('settings-screen'),
    hud: document.getElementById('hud'),
    gameOver: document.getElementById('game-over-screen'),
    shop: document.getElementById('shop-screen')
};

// Buttons
const btns = {
    play: document.getElementById('btn-play'),
    guide: document.getElementById('btn-guide'),
    settings: document.getElementById('btn-settings'),
    closeGuide: document.getElementById('btn-close-guide'),
    closeSettings: document.getElementById('btn-close-settings'),
    restart: document.getElementById('btn-restart'),
    upgrade: document.getElementById('btn-upgrade'),
    closeShop: document.getElementById('btn-close-shop'),
};

// HUD Elements
const hudElements = {
    healthBar: document.getElementById('health-bar'),
    oxygenBar: document.getElementById('oxygen-bar'),
    depth: document.getElementById('current-depth'),
    treasure: document.getElementById('treasure-count'),
    warning: document.getElementById('warning-message'),
    mobileControls: document.getElementById('mobile-controls'),
    stick: document.getElementById('joystick-stick'),
    base: document.getElementById('joystick-base')
};

// Shop Elements
const shopElements = {
    treasureCount: document.getElementById('shop-treasure-count'),
    buyO2: document.getElementById('buy-o2'),
    buySuit: document.getElementById('buy-suit'),
    buySpeed: document.getElementById('buy-speed'),
    lvlO2: document.getElementById('lvl-o2'),
    lvlSuit: document.getElementById('lvl-suit'),
    lvlSpeed: document.getElementById('lvl-speed')
};

// --- GAME STATE ---
const GAME_STATES = { MENU: 0, PLAYING: 1, GAMEOVER: 2, SHOP: 3 };
let currentState = GAME_STATES.MENU;

let width, height;
let lastTime = 0;
let frameCount = 0;

// World settings
const WORLD_WIDTH = 2000;
const SURFACE_Y = 0;
const MAX_DEPTH_PX = 50000; // Game gets progressively harder

// Camera
const camera = { x: 0, y: 0 };

// Controls
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };
const joystick = { active: false, dx: 0, dy: 0, originX: 0, originY: 0 };

let isMobile = false;

// --- ASSETS ---
const images = { diver: null, fish: null, predator: null, treasure: null, o2tank: null };

function loadAssets(onProgress, onComplete) {
    const srcList = {
        diver: 'assets/images/diver_trans.png',
        fish: 'assets/images/fish_trans.png',
        predator: 'assets/images/predator_trans.png',
        treasure: 'assets/images/treasure_trans.png',
        o2tank: 'assets/images/o2tank_trans.png'
    };
    
    let loaded = 0;
    const total = Object.keys(srcList).length;
    
    for (const [key, src] of Object.entries(srcList)) {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            images[key] = img;
            loaded++;
            onProgress((loaded / total) * 100);
            if (loaded === total) onComplete();
        };
        img.onerror = () => {
            console.error("Failed to load: " + src);
            loaded++;
            onProgress((loaded / total) * 100);
            if (loaded === total) onComplete();
        };
    }
}

// --- AUDIO SYSTEM (Web Audio API Synthesizer) ---
const AudioSys = {
    ctx: null,
    sfxOn: true,
    musicOn: true,
    volume: 0.5,
    osc: null,
    gainNode: null,

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            
            // Background ambient drone
            this.gainNode = this.ctx.createGain();
            this.gainNode.connect(this.ctx.destination);
            this.gainNode.gain.value = 0;
            
            this.osc = this.ctx.createOscillator();
            this.osc.type = 'sine';
            this.osc.frequency.value = 55; // Low rumble
            this.osc.connect(this.gainNode);
            this.osc.start();
        }
    },
    updateAmbientDepth(depthRatio) {
        if (!this.musicOn || !this.ctx) return;
        // Deepen the sound as you go down
        this.osc.frequency.setTargetAtTime(55 - (depthRatio * 20), this.ctx.currentTime, 0.5);
        this.gainNode.gain.setTargetAtTime(0.1 * this.volume, this.ctx.currentTime, 0.5);
    },
    stopAmbient() {
        if (this.gainNode) this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
    },
    playTone(freq, type, duration, volMultiplier = 1) {
        if (!this.sfxOn || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(this.volume * volMultiplier, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    playBubble() { this.playTone(MathUtils.randomRange(400, 800), 'sine', 0.2, 0.5); },
    playTreasure() { 
        this.playTone(800, 'sine', 0.1, 0.5);
        setTimeout(() => this.playTone(1200, 'sine', 0.2, 0.5), 100);
    },
    playDamage() { this.playTone(100, 'sawtooth', 0.3, 1.0); },
    playAlert() { this.playTone(300, 'square', 0.2, 0.4); }
};

// --- GAME OBJECTS ---
const player = {
    x: WORLD_WIDTH / 2,
    y: 100,
    vx: 0,
    vy: 0,
    radius: 15,
    color: '#00f0ff',
    
    // Stats
    maxHealth: 100,
    health: 100,
    maxOxygen: 100,
    oxygen: 100,
    treasures: 0,
    maxDepthReached: 0,
    
    // Upgrades
    levelO2: 1,
    levelSuit: 1,
    levelSpeed: 1,

    // Upgradable properties
    get oxygenDepletionRate() { return 2 - (this.levelO2 * 0.2); },
    get safeDepth() { return 1000 + (this.levelSuit * 1500); }, // px depth
    get moveAccel() { return 0.5 + (this.levelSpeed * 0.1); },
    get maxSpeed() { return 5 + (this.levelSpeed * 0.5); },

    reset() {
        this.x = WORLD_WIDTH / 2;
        this.y = 100;
        this.vx = 0;
        this.vy = 0;
        this.health = this.maxHealth;
        this.oxygen = this.maxOxygen;
        this.maxDepthReached = 0;
    },

    update(dt) {
        // Movement
        let ax = 0;
        let ay = 0;

        if (isMobile && joystick.active) {
            const mag = Math.hypot(joystick.dx, joystick.dy);
            if (mag > 0) {
                ax = (joystick.dx / mag) * this.moveAccel;
                ay = (joystick.dy / mag) * this.moveAccel;
            }
        } else {
            if (keys.w || keys.ArrowUp) ay -= this.moveAccel;
            if (keys.s || keys.ArrowDown) ay += this.moveAccel;
            if (keys.a || keys.ArrowLeft) ax -= this.moveAccel;
            if (keys.d || keys.ArrowRight) ax += this.moveAccel;
        }

        this.vx += ax;
        this.vy += ay;

        // Friction / Water resistance
        this.vx *= 0.92;
        this.vy *= 0.92;

        // Clamp speed
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > this.maxSpeed) {
            this.vx = (this.vx / speed) * this.maxSpeed;
            this.vy = (this.vy / speed) * this.maxSpeed;
        }

        // Apply velocity
        this.x += this.vx * (dt/16);
        this.y += this.vy * (dt/16);

        const swimSpeed = Math.hypot(this.vx, this.vy);

        // Realistic Breath Bubbles Effect
        if (frameCount % Math.floor(MathUtils.randomRange(15, 30)) === 0 && this.y > SURFACE_Y + 50) {
            const facingLeft = this.vx < -0.1;
            const mouthX = this.x + (facingLeft ? -this.radius : this.radius) * 1.5;
            const mouthY = this.y - this.radius * 0.5;
            entities.push(new Bubble(mouthX, mouthY));
        }

        // Swim Wake Particles
        if (swimSpeed > 2 && Math.random() < 0.3) {
            particles.push({
                x: this.x - this.vx, y: this.y - this.vy + MathUtils.randomRange(-5, 5),
                vx: -this.vx * 0.2, vy: -this.vy * 0.2,
                life: 0.5, color: 'rgba(255, 255, 255, 0.4)',
                size: MathUtils.randomRange(1, 3)
            });
        }

        // Bounds
        if (this.x < 0) this.x = 0;
        if (this.x > WORLD_WIDTH) this.x = WORLD_WIDTH;
        if (this.y < SURFACE_Y) {
            this.y = SURFACE_Y;
            this.vy = 0;
            // Surface replenishes oxygen rapidly
            this.oxygen = Math.min(this.maxOxygen, this.oxygen + 5 * (dt/16));
        } else {
            // Deplete oxygen
            this.oxygen -= (this.oxygenDepletionRate / 60) * (dt/16);
        }

        // Pressure Damage
        if (this.y > this.safeDepth) {
            const overDepth = this.y - this.safeDepth;
            // take damage per frame based on how deep
            this.health -= (overDepth * 0.0001) * (dt/16);
            if (frameCount % 60 === 0) AudioSys.playAlert(); // alert sound every sec
        }

        if (this.y > this.maxDepthReached) this.maxDepthReached = this.y;

        // Check Death
        if (this.health <= 0 || this.oxygen <= 0) {
            die(this.oxygen <= 0 ? "You ran out of oxygen." : "You succumbed to the depths.");
        }
    },

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        const angle = Math.atan2(this.vy, this.vx);
        const swimSpeed = Math.hypot(this.vx, this.vy);
        const swimBob = Math.sin(frameCount * 0.2) * (swimSpeed > 0.5 ? 0.08 : 0.02);
        
        if (images.diver) {
            if (this.vx < -0.1) {
                ctx.scale(-1, 1);
                ctx.rotate(-angle + swimBob);
            } else {
                ctx.rotate(angle + swimBob);
            }
            
            // Squash and stretch for swimming animation
            ctx.scale(1 + swimBob * 0.5, 1 - swimBob * 0.5);
            
            const dw = 80;
            const dh = 80;
            ctx.drawImage(images.diver, -dw/2, -dh/2, dw, dh);
            
            // Subtle helmet glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00f0ff';
            ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(dw*0.2, -dh*0.1, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.rotate(angle);
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius, this.radius * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
};

let entities = [];
let particles = [];

// --- ENTITY CLASSES ---
class Bubble {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = MathUtils.randomRange(2, 6);
        this.vy = -MathUtils.randomRange(1, 3);
        this.vx = MathUtils.randomRange(-0.5, 0.5);
        this.life = 1;
    }
    update(dt) {
        this.y += this.vy * (dt/16);
        this.x += (Math.sin(frameCount * 0.05) * 0.5) + this.vx;
        this.life -= 0.005 * (dt/16);
    }
    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.life * 0.5})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Resource {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'oxygen' or 'treasure'
        this.radius = type === 'oxygen' ? 12 : 10;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.active = true;
    }
    update(dt) {
        this.y += Math.sin(frameCount * 0.05 + this.floatOffset) * 0.5;
        
        // Collision with player
        if (this.active && MathUtils.dist(this.x, this.y, player.x, player.y) < this.radius + player.radius) {
            this.collect();
        }
    }
    collect() {
        this.active = false;
        if (this.type === 'oxygen') {
            player.oxygen = Math.min(player.maxOxygen, player.oxygen + 30);
            AudioSys.playBubble();
            createBurst(this.x, this.y, '#00f0ff', 10);
        } else {
            player.treasures += 1;
            AudioSys.playTreasure();
            createBurst(this.x, this.y, '#ffd700', 10);
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (this.type === 'oxygen') {
            if (images.o2tank) {
                const dw = 30;
                const dh = 30;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00f0ff';
                ctx.drawImage(images.o2tank, -dw/2, -dh/2, dw, dh);
            } else {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#00f0ff';
                ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
                ctx.beginPath();
                ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            if (images.treasure) {
                const dw = 40;
                const dh = 40;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ffd700';
                ctx.drawImage(images.treasure, -dw/2, -dh/2, dw, dh);
            } else {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ffd700';
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.moveTo(0, -this.radius);
                ctx.lineTo(this.radius, 0);
                ctx.lineTo(0, this.radius);
                ctx.lineTo(-this.radius, 0);
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.restore();
    }
}

class Creature {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'passive', 'predator'
        this.radius = type === 'predator' ? 20 : 8;
        this.vx = (Math.random() > 0.5 ? 1 : -1) * (type === 'predator' ? 2 : 1);
        this.vy = 0;
        this.color = type === 'predator' ? '#ff3366' : '#a0e0ff';
        this.active = true;
    }
    update(dt) {
        if (this.type === 'passive') {
            this.x += this.vx * (dt/16);
            this.y += Math.sin(frameCount * 0.02) * 0.5;
            if (this.x < -100 || this.x > WORLD_WIDTH + 100) this.active = false;
        } else if (this.type === 'predator') {
            // AI Chase
            const dist = MathUtils.dist(this.x, this.y, player.x, player.y);
            if (dist < 400) { // Aggro range
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                this.vx += Math.cos(angle) * 0.05;
                this.vy += Math.sin(angle) * 0.05;
            } else {
                // Patrol
                this.x += this.vx * (dt/16);
                if (this.x < 0 || this.x > WORLD_WIDTH) this.vx *= -1;
            }

            // Friction & Speed limit
            this.vx *= 0.98;
            this.vy *= 0.98;
            const speed = Math.hypot(this.vx, this.vy);
            if (speed > 3.5) {
                this.vx = (this.vx / speed) * 3.5;
                this.vy = (this.vy / speed) * 3.5;
            }

            this.x += this.vx * (dt/16);
            this.y += this.vy * (dt/16);

            // Collision
            if (dist < this.radius + player.radius) {
                player.health -= 15;
                AudioSys.playDamage();
                createBurst(player.x, player.y, '#ff0000', 15);
                // Knockback
                const angle = Math.atan2(this.y - player.y, this.x - player.x);
                this.vx = Math.cos(angle) * 10;
                this.vy = Math.sin(angle) * 10;
                player.vx = -Math.cos(angle) * 10;
                player.vy = -Math.sin(angle) * 10;
            }

            // Predator Wake
            if (speed > 2 && Math.random() < 0.2) {
                particles.push({
                    x: this.x - this.vx, y: this.y - this.vy,
                    vx: -this.vx * 0.1, vy: -this.vy * 0.1,
                    life: 0.5, color: 'rgba(255, 100, 100, 0.3)', size: 2
                });
            }
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        const angle = Math.atan2(this.vy, this.vx);
        
        // Tail wag animation
        const swimSpeed = Math.hypot(this.vx, this.vy);
        const wagFreq = this.type === 'predator' ? 0.3 : 0.1;
        const wagMag = swimSpeed > 0.5 ? 0.1 : 0.02;
        const wag = Math.sin(frameCount * wagFreq + this.x) * wagMag;
        
        if (this.type === 'predator') {
            if (images.predator) {
                if (this.vx < -0.1) {
                    ctx.scale(-1, 1);
                    ctx.rotate(-angle + wag);
                } else {
                    ctx.rotate(angle + wag);
                }
                ctx.scale(1 + wag * 0.5, 1 - wag * 0.5);
                
                const dw = 90;
                const dh = 90;
                ctx.shadowBlur = 20;
                ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
                ctx.drawImage(images.predator, -dw/2, -dh/2, dw, dh);
            } else {
                ctx.rotate(angle);
                ctx.fillStyle = this.color;
                ctx.shadowBlur = 10;
                ctx.shadowColor = this.color;
                ctx.beginPath();
                ctx.moveTo(this.radius, 0);
                ctx.lineTo(-this.radius, this.radius * 0.7);
                ctx.lineTo(-this.radius * 0.5, 0);
                ctx.lineTo(-this.radius, -this.radius * 0.7);
                ctx.closePath();
                ctx.fill();
            }
        } else {
            if (images.fish) {
                if (this.vx < -0.1) {
                    ctx.scale(-1, 1);
                    ctx.rotate(-angle + wag);
                } else {
                    ctx.rotate(angle + wag);
                }
                ctx.scale(1 + wag * 0.5, 1 - wag * 0.5);
                
                const dw = 40;
                const dh = 40;
                ctx.drawImage(images.fish, -dw/2, -dh/2, dw, dh);
            } else {
                ctx.rotate(angle);
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, this.radius, this.radius * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
}

// --- SYSTEMS ---
function createBurst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x, y: y,
            vx: MathUtils.randomRange(-3, 3),
            vy: MathUtils.randomRange(-3, 3),
            life: 1,
            color: color,
            size: MathUtils.randomRange(2, 5)
        });
    }
}

let spawnDepthTracker = 0;

function spawnEntities() {
    // Generate entities below camera as player descends
    if (camera.y + height > spawnDepthTracker) {
        const spawnY = spawnDepthTracker + 500;
        const depthRatio = spawnY / MAX_DEPTH_PX;

        // Spawn O2
        if (Math.random() < 0.6) {
            entities.push(new Resource(MathUtils.randomRange(50, WORLD_WIDTH - 50), spawnY, 'oxygen'));
        }
        
        // Spawn Treasure
        if (Math.random() < 0.4 + (depthRatio * 0.3)) { // More treasure deep down
            entities.push(new Resource(MathUtils.randomRange(50, WORLD_WIDTH - 50), spawnY + MathUtils.randomRange(-200, 200), 'treasure'));
        }

        // Spawn Fish
        if (Math.random() < 0.7) {
            for(let i=0; i < Math.floor(MathUtils.randomRange(2, 5)); i++) {
                entities.push(new Creature(MathUtils.randomRange(0, WORLD_WIDTH), spawnY + MathUtils.randomRange(-100, 100), 'passive'));
            }
        }

        // Spawn Predator
        if (spawnY > 1000 && Math.random() < 0.3 + (depthRatio * 0.5)) {
            entities.push(new Creature(MathUtils.randomRange(50, WORLD_WIDTH - 50), spawnY, 'predator'));
        }

        spawnDepthTracker += 400; // Increment spawn line
    }
}

function updateCamera() {
    // Smooth follow
    camera.x += (player.x - width / 2 - camera.x) * 0.1;
    camera.y += (player.y - height / 2 - camera.y) * 0.1;

    // Clamp camera
    camera.x = MathUtils.clamp(camera.x, 0, WORLD_WIDTH - width);
    if (camera.y < 0) camera.y = 0;
}

function updateHUD() {
    hudElements.healthBar.style.width = `${Math.max(0, (player.health / player.maxHealth) * 100)}%`;
    hudElements.oxygenBar.style.width = `${Math.max(0, (player.oxygen / player.maxOxygen) * 100)}%`;
    
    // Depth formatting (1px = 0.1m)
    const depthMeters = Math.floor(player.y * 0.1);
    hudElements.depth.innerText = depthMeters;
    hudElements.treasure.innerText = player.treasures;

    // Warning
    if (player.oxygen < 20 || player.y > player.safeDepth) {
        hudElements.warning.classList.remove('hidden');
        hudElements.warning.innerText = player.oxygen < 20 ? "CRITICAL OXYGEN" : "PRESSURE WARNING";
    } else {
        hudElements.warning.classList.add('hidden');
    }
}

// --- RENDER LOGIC ---
function renderEnvironment(ctx) {
    // Background Gradient based on depth
    const depthRatio = MathUtils.clamp(camera.y / 20000, 0, 1);
    
    // Surface: #051937, Deep: #010408
    const r = MathUtils.lerp(5, 1, depthRatio);
    const g = MathUtils.lerp(25, 4, depthRatio);
    const b = MathUtils.lerp(55, 8, depthRatio);

    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
    bgGradient.addColorStop(1, `rgb(${r*0.5}, ${g*0.5}, ${b*0.5})`);
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Light rays from surface (only visible near top)
    if (camera.y < height * 2) {
        const opacity = 1 - (camera.y / (height * 2));
        ctx.fillStyle = `rgba(255, 255, 255, ${0.05 * opacity})`;
        for(let i=0; i<5; i++) {
            ctx.beginPath();
            ctx.moveTo(WORLD_WIDTH/2 + Math.sin(frameCount*0.01 + i) * 500, -100);
            ctx.lineTo((i*500) - 500, 2000);
            ctx.lineTo((i*500) + 100, 2000);
            ctx.closePath();
            ctx.fill();
        }
    }

    // Grid / Plankton dust for parallax sense
    ctx.fillStyle = `rgba(255, 255, 255, 0.2)`;
    for (let i = 0; i < 100; i++) {
        // pseudo random deterministic positions
        const px = (Math.sin(i * 12.3) * 10000) % WORLD_WIDTH;
        let py = (Math.cos(i * 45.6) * 100000) % (camera.y + height + 1000);
        // wrap around visually
        py = camera.y + ((py - camera.y) % (height + 200));
        if (py < camera.y - 100) py += height + 200;

        const size = (i % 3) + 1;
        ctx.beginPath();
        ctx.arc(Math.abs(px), py, size, 0, Math.PI*2);
        ctx.fill();
    }

    // Entities
    for (const e of entities) e.draw(ctx);
    
    // Player
    player.draw(ctx);

    // Particles
    for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Bubbles
    if (Math.random() < 0.1) entities.push(new Bubble(player.x, player.y));

    ctx.restore();
}

function update(time) {
    const dt = time - lastTime;
    lastTime = time;
    frameCount++;

    if (currentState === GAME_STATES.PLAYING) {
        player.update(dt);
        updateCamera();
        spawnEntities();

        // Update entities
        for (let i = entities.length - 1; i >= 0; i--) {
            const e = entities[i];
            e.update(dt);
            // Cleanup far above
            if (e.y < camera.y - 500 || !e.active) {
                entities.splice(i, 1);
            }
        }

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * (dt/16);
            p.y += p.vy * (dt/16);
            p.life -= 0.05 * (dt/16);
            if (p.life <= 0) particles.splice(i, 1);
        }

        updateHUD();
        
        const depthRatio = MathUtils.clamp(player.y / 10000, 0, 1);
        AudioSys.updateAmbientDepth(depthRatio);
    }

    // Always render to show background even in menus
    renderEnvironment(ctx);

    requestAnimationFrame(update);
}

// --- GAME FLOW ---
function startGame() {
    AudioSys.init();
    player.reset();
    entities = [];
    particles = [];
    spawnDepthTracker = 0;
    camera.x = player.x - width / 2;
    camera.y = 0;
    
    hideAllScreens();
    screens.hud.classList.remove('hidden');
    currentState = GAME_STATES.PLAYING;
}

function die(reason) {
    currentState = GAME_STATES.GAMEOVER;
    AudioSys.stopAmbient();
    hideAllScreens();
    screens.gameOver.classList.remove('hidden');
    document.getElementById('death-reason').innerText = reason;
    document.getElementById('go-max-depth').innerText = Math.floor(player.maxDepthReached * 0.1);
    document.getElementById('go-treasures').innerText = player.treasures;
}

function showMenu() {
    currentState = GAME_STATES.MENU;
    hideAllScreens();
    screens.menu.classList.remove('hidden');
}

function showShop() {
    currentState = GAME_STATES.SHOP;
    hideAllScreens();
    screens.shop.classList.remove('hidden');
    updateShopUI();
}

function hideAllScreens() {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
}

// --- SHOP LOGIC ---
const costs = { o2: 10, suit: 15, speed: 20 };
function updateShopUI() {
    shopElements.treasureCount.innerText = player.treasures;
    shopElements.lvlO2.innerText = player.levelO2;
    shopElements.lvlSuit.innerText = player.levelSuit;
    shopElements.lvlSpeed.innerText = player.levelSpeed;

    const scaleCost = (base, lvl) => Math.floor(base * Math.pow(1.5, lvl - 1));

    shopElements.buyO2.innerText = `${scaleCost(costs.o2, player.levelO2)} 💎`;
    shopElements.buyO2.disabled = player.treasures < scaleCost(costs.o2, player.levelO2);

    shopElements.buySuit.innerText = `${scaleCost(costs.suit, player.levelSuit)} 💎`;
    shopElements.buySuit.disabled = player.treasures < scaleCost(costs.suit, player.levelSuit);

    shopElements.buySpeed.innerText = `${scaleCost(costs.speed, player.levelSpeed)} 💎`;
    shopElements.buySpeed.disabled = player.treasures < scaleCost(costs.speed, player.levelSpeed);
}

shopElements.buyO2.addEventListener('click', () => {
    const cost = Math.floor(costs.o2 * Math.pow(1.5, player.levelO2 - 1));
    if (player.treasures >= cost) {
        player.treasures -= cost;
        player.levelO2++;
        player.maxOxygen += 20;
        updateShopUI();
        AudioSys.playBubble();
    }
});
shopElements.buySuit.addEventListener('click', () => {
    const cost = Math.floor(costs.suit * Math.pow(1.5, player.levelSuit - 1));
    if (player.treasures >= cost) {
        player.treasures -= cost;
        player.levelSuit++;
        updateShopUI();
        AudioSys.playBubble();
    }
});
shopElements.buySpeed.addEventListener('click', () => {
    const cost = Math.floor(costs.speed * Math.pow(1.5, player.levelSpeed - 1));
    if (player.treasures >= cost) {
        player.treasures -= cost;
        player.levelSpeed++;
        updateShopUI();
        AudioSys.playBubble();
    }
});

// --- INPUT & EVENT LISTENERS ---
window.addEventListener('keydown', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key)) keys[e.key] = false; });

// Buttons
btns.play.addEventListener('click', startGame);
btns.guide.addEventListener('click', () => { hideAllScreens(); screens.guide.classList.remove('hidden'); });
btns.settings.addEventListener('click', () => { hideAllScreens(); screens.settings.classList.remove('hidden'); });
btns.closeGuide.addEventListener('click', showMenu);
btns.closeSettings.addEventListener('click', showMenu);
btns.restart.addEventListener('click', startGame);
btns.upgrade.addEventListener('click', showShop);
btns.closeShop.addEventListener('click', showMenu);

// Settings
document.getElementById('volume-slider').addEventListener('input', (e) => AudioSys.volume = e.target.value);
document.getElementById('sfx-toggle').addEventListener('change', (e) => AudioSys.sfxOn = e.target.checked);
document.getElementById('music-toggle').addEventListener('change', (e) => AudioSys.musicOn = e.target.checked);

// Mobile Joystick Logic
function initMobileControls() {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (isMobile) {
        hudElements.mobileControls.classList.remove('hidden');
        
        const zone = document.getElementById('joystick-zone');
        
        const handleTouch = (e) => {
            e.preventDefault();
            joystick.active = true;
            const touch = e.targetTouches[0];
            const rect = zone.getBoundingClientRect();
            
            // center of base
            const centerX = rect.left + 80; // 20px padding + 60px half base
            const centerY = rect.top + 80;
            
            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            
            const dist = Math.hypot(dx, dy);
            const maxDist = 40;
            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }
            
            hudElements.stick.style.transform = `translate(${dx}px, ${dy}px)`;
            
            // normalize -1 to 1
            joystick.dx = dx / maxDist;
            joystick.dy = dy / maxDist;
        };

        const resetTouch = (e) => {
            e.preventDefault();
            joystick.active = false;
            joystick.dx = 0;
            joystick.dy = 0;
            hudElements.stick.style.transform = `translate(0px, 0px)`;
        };

        zone.addEventListener('touchstart', handleTouch, {passive: false});
        zone.addEventListener('touchmove', handleTouch, {passive: false});
        zone.addEventListener('touchend', resetTouch);
        zone.addEventListener('touchcancel', resetTouch);
    }
}

// --- INIT & RESIZE ---
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    initMobileControls();
}
window.addEventListener('resize', resize);

// Initialization sequence
window.onload = () => {
    resize();
    
    const loadBar = document.getElementById('loading-bar');
    const loadText = document.getElementById('loading-text');
    
    loadAssets(
        (progress) => {
            loadBar.style.width = `${progress}%`;
            if (progress > 30) loadText.innerText = "Loading High-Res Sprites...";
            if (progress > 60) loadText.innerText = "Applying Chroma Key...";
            if (progress === 100) loadText.innerText = "Ready to Dive!";
        },
        () => {
            setTimeout(() => {
                showMenu();
            }, 500);
        }
    );

    // Start loop
    requestAnimationFrame(update);
};
