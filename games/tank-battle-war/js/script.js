// --- CORE ENGINE & CONFIG --- //
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency on base
const minimapCanvas = document.getElementById('minimap-canvas');
const mCtx = minimapCanvas.getContext('2d');

let cw, ch;
let isMobile = false;
let gameLoopId;
let lastTime = 0;
let gameState = 'LOGIN'; // LOGIN, MENU, PLAYING, UPGRADE, GAMEOVER, VICTORY
let camera = { x: 0, y: 0 };
let screenShakeX = 0;
let screenShakeY = 0;
let screenShakeTimer = 0;

// Game Constants
const TILE_SIZE = 64;
const MAP_WIDTH = 40;
const MAP_HEIGHT = 40;
const WORLD_W = MAP_WIDTH * TILE_SIZE;
const WORLD_H = MAP_HEIGHT * TILE_SIZE;

// Procedural Audio Context
let actx = null;
let soundEnabled = true;

// Player Data & Progression
let playerLevel = 1;
let currentLevel = 1;
const MAX_LEVELS = 40;
let score = 0;
let funds = 0;

let upgrades = {
    damage: { level: 1, cost: 500, max: 10, val: 25, inc: 15 },
    armor: { level: 1, cost: 500, max: 10, val: 100, inc: 50 },
    speed: { level: 1, cost: 500, max: 10, val: 250, inc: 20 }
};

// Input State
const keys = {};
let mouseX = 0, mouseY = 0, mouseDown = false;
let mobileJoysticks = {
    left: { active: false, id: null, x: 0, y: 0, nx: 0, ny: 0, originX: 0, originY: 0 }
};
let isMobileFiring = false;
let mobileFireX = 0;
let mobileFireY = 0;

// Entities
let player;
let enemies = [];
let bullets = [];
let particles = [];
let obstacles = [];
let powerups = [];

// DOM Elements
const uiLogin = document.getElementById('ui-login');
const uiMainMenu = document.getElementById('ui-main-menu');
const uiInstructions = document.getElementById('ui-instructions');
const uiHud = document.getElementById('ui-hud');
const uiUpgrade = document.getElementById('ui-upgrade');
const uiGameOver = document.getElementById('ui-game-over');
const uiVictory = document.getElementById('ui-victory');
const uiMobileControls = document.getElementById('ui-mobile-controls');

// Init Input Listeners
function initInput() {
    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);
    
    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    window.addEventListener('mousedown', e => {
        if(e.button === 0) mouseDown = true;
    });
    window.addEventListener('mouseup', e => {
        if(e.button === 0) mouseDown = false;
    });

    // Touch Controls
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice || window.innerWidth <= 768) {
        isMobile = true;
        setupMobileControls();
    }
}

function setupMobileControls() {
    const joyL = document.getElementById('joystick-left');
    const stickL = joyL.querySelector('.stick');

    const handleTouch = (e, joyObj, stickEl, maxDist) => {
        e.preventDefault();
        const rect = stickEl.parentElement.getBoundingClientRect();
        const originX = rect.left + rect.width / 2;
        const originY = rect.top + rect.height / 2;
        
        let targetTouch = null;
        for (let i = 0; i < e.touches.length; i++) {
            let t = e.touches[i];
            if (t.identifier === joyObj.id || joyObj.id === null) {
                targetTouch = t;
                joyObj.id = t.identifier;
                break;
            }
        }

        if (targetTouch) {
            let dx = targetTouch.clientX - originX;
            let dy = targetTouch.clientY - originY;
            let dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }
            
            stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
            joyObj.nx = dx / maxDist;
            joyObj.ny = dy / maxDist;
            joyObj.active = true;
        } else {
            joyObj.active = false;
            joyObj.id = null;
            joyObj.nx = 0;
            joyObj.ny = 0;
            stickEl.style.transform = `translate(0px, 0px)`;
        }
    };

    joyL.addEventListener('touchstart', e => handleTouch(e, mobileJoysticks.left, stickL, 40), {passive: false});
    joyL.addEventListener('touchmove', e => handleTouch(e, mobileJoysticks.left, stickL, 40), {passive: false});
    joyL.addEventListener('touchend', e => {
        for(let i=0; i<e.changedTouches.length; i++){
            if(e.changedTouches[i].identifier === mobileJoysticks.left.id) {
                mobileJoysticks.left.active = false;
                mobileJoysticks.left.id = null;
                mobileJoysticks.left.nx = 0;
                mobileJoysticks.left.ny = 0;
                stickL.style.transform = `translate(0px, 0px)`;
            }
        }
    });

    // Tap to fire on canvas
    const handleCanvasTouch = (e) => {
        if(gameState !== 'PLAYING') return;
        isMobileFiring = false;
        
        for (let i = 0; i < e.touches.length; i++) {
            let t = e.touches[i];
            // Ignore left joystick touches
            if (mobileJoysticks.left.id === t.identifier) continue;
            
            // This is a firing touch
            isMobileFiring = true;
            mobileFireX = t.clientX;
            mobileFireY = t.clientY;
        }
    };

    canvas.addEventListener('touchstart', handleCanvasTouch, {passive: true});
    canvas.addEventListener('touchmove', handleCanvasTouch, {passive: true});
    canvas.addEventListener('touchend', (e) => {
        isMobileFiring = false;
        for (let i = 0; i < e.touches.length; i++) {
             if (mobileJoysticks.left.id !== e.touches[i].identifier) {
                 isMobileFiring = true;
                 mobileFireX = e.touches[i].clientX;
                 mobileFireY = e.touches[i].clientY;
                 break;
             }
        }
    }, {passive: true});
}

// Resize Handling
function resize() {
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width = cw;
    canvas.height = ch;
}
window.addEventListener('resize', resize);
resize();

// --- AUDIO SYSTEM (Procedural Synthesis) --- //
function playSound(type, vol = 1.0) {
    if (!soundEnabled) return;
    if (!actx) {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        if(window.AudioContext) actx = new AudioContext();
        else return;
    }
    if (actx.state === 'suspended') actx.resume();

    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);

    const now = actx.currentTime;

    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        gain.gain.setValueAtTime(vol * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.5);
        gain.gain.setValueAtTime(vol * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        // Add noise
        const bufferSize = actx.sampleRate * 0.5; 
        const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = actx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = actx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 1000;
        const noiseGain = actx.createGain();
        noiseGain.gain.setValueAtTime(vol * 1, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(actx.destination);
        noise.start(now);

        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(vol * 0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
}

// --- UTILS --- //
function randomRange(min, max) { return Math.random() * (max - min) + min; }
function distance(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function normalize(vx, vy) {
    let len = Math.hypot(vx, vy);
    if(len===0) return {x:0, y:0};
    return {x: vx/len, y: vy/len};
}

// Collisions
function rectIntersect(r1, r2) {
    return !(r2.x > r1.x + r1.w || 
             r2.x + r2.w < r1.x || 
             r2.y > r1.y + r1.h ||
             r2.y + r2.h < r1.y);
}

function circleRectIntersect(cx, cy, cr, rx, ry, rw, rh) {
    let testX = cx;
    let testY = cy;
    
    if (cx < rx) testX = rx;
    else if (cx > rx + rw) testX = rx + rw;
    
    if (cy < ry) testY = ry;
    else if (cy > ry + rh) testY = ry + rh;
    
    let distX = cx - testX;
    let distY = cy - testY;
    let distance = Math.sqrt((distX*distX) + (distY*distY));
    
    return distance <= cr;
}

// --- CLASSES --- //
class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // smoke, fire, debris, track
        this.life = 1.0;
        this.decay = randomRange(0.02, 0.05);
        this.size = randomRange(2, 10);
        let ang = randomRange(0, Math.PI * 2);
        let spd = randomRange(10, 100);
        this.vx = Math.cos(ang) * spd;
        this.vy = Math.sin(ang) * spd;
        
        if (type === 'smoke') {
            this.color = `rgba(100, 100, 100,`;
            this.size = randomRange(10, 30);
            this.decay = 0.01;
            this.vx *= 0.2; this.vy *= 0.2;
        } else if (type === 'fire') {
            this.color = `rgba(255, ${Math.floor(randomRange(50, 150))}, 0,`;
            this.decay = 0.05;
        } else if (type === 'debris') {
            this.color = `rgba(80, 80, 80,`;
            this.decay = 0.03;
        } else if (type === 'track') {
            this.size = 6;
            this.color = `rgba(0, 0, 0,`;
            this.decay = 0.01;
            this.vx = 0; this.vy = 0;
        }
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= this.decay * (dt * 60);
        if (this.type === 'smoke') this.size += 10 * dt;
        if (this.type === 'track') {
             this.size *= 0.99; // Flatten track
        }
    }
    draw(ctx) {
        ctx.fillStyle = `${this.color} ${Math.max(0, this.life)})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0, this.size), 0, Math.PI*2);
        ctx.fill();
    }
}

class Obstacle {
    constructor(x, y, w, h, type = 'wall') {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.type = type; // wall, crate
        this.hp = type === 'crate' ? 50 : Infinity;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 3D Box effect
        let depth = 15;
        
        // Base Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 10;
        
        if (this.type === 'wall') {
            ctx.fillStyle = '#444';
            ctx.fillRect(0, 0, this.w, this.h);
            ctx.shadowColor = 'transparent';
            
            // Top face
            ctx.fillStyle = '#555';
            ctx.fillRect(-5, -5, this.w, this.h);
            
            // Texture lines
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-5, -5); ctx.lineTo(this.w-5, this.h-5);
            ctx.stroke();

        } else {
            ctx.fillStyle = '#8B5A2B';
            ctx.fillRect(0, 0, this.w, this.h);
            ctx.shadowColor = 'transparent';
            
            // Top face
            ctx.fillStyle = '#A0522D';
            ctx.fillRect(-3, -3, this.w, this.h);
            
            ctx.strokeStyle = '#3e1a06';
            ctx.lineWidth = 2;
            ctx.strokeRect(-3, -3, this.w, this.h);
            
            // Cross
            ctx.beginPath();
            ctx.moveTo(-3, -3); ctx.lineTo(this.w-3, this.h-3);
            ctx.moveTo(this.w-3, -3); ctx.lineTo(-3, this.h-3);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, angle, speed, damage, isPlayer) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = 4;
        this.damage = damage;
        this.isPlayer = isPlayer;
        this.life = 2.0; // Seconds
        playSound('shoot', isPlayer ? 0.8 : 0.4);
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        
        if (Math.random() < 0.3) {
            particles.push(new Particle(this.x, this.y, 'smoke'));
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        let ang = Math.atan2(this.vy, this.vx);
        ctx.rotate(ang);
        
        ctx.shadowColor = this.isPlayer ? '#0ff' : '#f00';
        ctx.shadowBlur = 10;
        
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Tank {
    constructor(x, y, config) {
        this.x = x;
        this.y = y;
        this.w = config.w || 36;
        this.h = config.h || 48;
        this.color = config.color || '#333';
        this.accent = config.accent || '#45a29e';
        this.maxSpeed = config.speed || 150;
        this.turnSpeed = config.turnSpeed || 2.5;
        this.hp = config.hp || 100;
        this.maxHp = this.hp;
        
        this.damage = config.damage || 25;
        this.reloadTime = config.reloadTime || 1.0;
        this.reloadTimer = 0;
        
        this.hullAngle = 0;
        this.turretAngle = 0;
        
        this.vx = 0;
        this.vy = 0;
        
        this.isMoving = false;
        this.trackTimer = 0;
    }
    
    takeDamage(amt) {
        playSound('hit');
        this.hp -= amt;
        for(let i=0; i<5; i++) particles.push(new Particle(this.x, this.y, 'debris'));
        if (this.hp <= 0 && this.hp + amt > 0) {
            this.destroy();
        }
    }
    
    shoot() {
        if (this.reloadTimer <= 0) {
            let muzzleX = this.x + Math.cos(this.turretAngle) * (this.w);
            let muzzleY = this.y + Math.sin(this.turretAngle) * (this.w);
            bullets.push(new Bullet(muzzleX, muzzleY, this.turretAngle, 800, this.damage, this instanceof PlayerTank));
            this.reloadTimer = this.reloadTime;
            
            // Recoil & Fire effect
            this.x -= Math.cos(this.turretAngle) * 10;
            this.y -= Math.sin(this.turretAngle) * 10;
            
            if (this instanceof PlayerTank) {
                screenShakeTimer = 0.25;
            }
            
            // Flash and blast particles
            for(let i=0; i<15; i++) {
                let p = new Particle(muzzleX, muzzleY, 'fire');
                p.size = randomRange(5, 18);
                p.vx += Math.cos(this.turretAngle) * 300 + randomRange(-50, 50);
                p.vy += Math.sin(this.turretAngle) * 300 + randomRange(-50, 50);
                particles.push(p);
            }
            for(let i=0; i<10; i++) {
                let p = new Particle(muzzleX, muzzleY, 'smoke');
                p.vx += Math.cos(this.turretAngle) * 100 + randomRange(-50, 50);
                p.vy += Math.sin(this.turretAngle) * 100 + randomRange(-50, 50);
                particles.push(p);
            }
            return true;
        }
        return false;
    }

    destroy() {
        playSound('explosion', 1.0);
        if (this instanceof PlayerTank) {
            screenShakeTimer = 0.5;
        }
        for(let i=0; i<30; i++) particles.push(new Particle(this.x, this.y, 'fire'));
        for(let i=0; i<20; i++) particles.push(new Particle(this.x, this.y, 'smoke'));
        for(let i=0; i<15; i++) particles.push(new Particle(this.x, this.y, 'debris'));
    }

    checkCollisions(newX, newY) {
        let testRect = { x: newX - this.w/2, y: newY - this.h/2, w: this.w, h: this.h };
        
        // World Bounds
        if(testRect.x < 0 || testRect.y < 0 || testRect.x + testRect.w > WORLD_W || testRect.y + testRect.h > WORLD_H) return true;

        for (let obs of obstacles) {
            if (rectIntersect(testRect, obs)) {
                return true;
            }
        }
        
        // Tank-Tank collision
        let otherTanks = enemies.concat(player);
        for(let t of otherTanks) {
            if(t && t !== this && t.hp > 0) {
                let r2 = {x: t.x - t.w/2, y: t.y - t.h/2, w: t.w, h: t.h };
                if (rectIntersect(testRect, r2)) return true;
            }
        }
        
        return false;
    }

    update(dt) {
        if(this.reloadTimer > 0) this.reloadTimer -= dt;
        
        // Spawn tracks if moving
        if (this.isMoving) {
            this.trackTimer += dt;
            if (this.trackTimer > 0.1) {
                let leftTrackX = this.x + Math.cos(this.hullAngle + Math.PI/2) * (this.h/3) - Math.cos(this.hullAngle)* (this.w/3);
                let leftTrackY = this.y + Math.sin(this.hullAngle + Math.PI/2) * (this.h/3) - Math.sin(this.hullAngle)* (this.w/3);
                let rightTrackX = this.x + Math.cos(this.hullAngle - Math.PI/2) * (this.h/3) - Math.cos(this.hullAngle)* (this.w/3);
                let rightTrackY = this.y + Math.sin(this.hullAngle - Math.PI/2) * (this.h/3) - Math.sin(this.hullAngle)* (this.w/3);
                
                particles.push(new Particle(leftTrackX, leftTrackY, 'track'));
                particles.push(new Particle(rightTrackX, rightTrackY, 'track'));
                this.trackTimer = 0;
            }
        }
    }

    draw(ctx) {
        if(this.hp <= 0) return;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Shadow
        ctx.save();
        ctx.translate(5, 5);
        ctx.rotate(this.hullAngle);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
        ctx.restore();

        // Hull
        ctx.rotate(this.hullAngle);
        
        // Tracks
        ctx.fillStyle = '#111';
        ctx.fillRect(-this.w/2 - 4, -this.h/2 + 2, 6, this.h - 4);
        ctx.fillRect(this.w/2 - 2, -this.h/2 + 2, 6, this.h - 4);

        // Body Plate
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
        
        // Bevel / 3D feel
        ctx.strokeStyle = this.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.w/2 + 2, -this.h/2 + 2, this.w - 4, this.h - 4);
        
        // Details
        ctx.fillStyle = '#222';
        ctx.fillRect(-this.w/3, -this.h/3 + 4, this.w/1.5, 8);

        ctx.restore();
        
        // Turret (Independent rotation)
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.turretAngle);
        
        // Turret shadow
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // Gun barrel
        ctx.fillStyle = '#444';
        ctx.fillRect(0, -4, this.w + 10, 8);
        ctx.fillStyle = '#222';
        ctx.fillRect(this.w + 4, -5, 8, 10); // Muzzle brake

        // Turret Base
        ctx.beginPath();
        ctx.arc(0, 0, this.w * 0.4, 0, Math.PI*2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(0, 0, this.w * 0.4 - 2, 0, Math.PI*2);
        ctx.strokeStyle = this.accent;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowColor = 'transparent'; // Reset shadow
        
        // Hatch
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(-4, 0, 6, 0, Math.PI*2);
        ctx.fill();
        
        ctx.restore();

        // Draw Health bar
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - 20, this.y - this.h, 40, 5);
            ctx.fillStyle = (this.hp/this.maxHp > 0.5) ? '#0f0' : '#f00';
            ctx.fillRect(this.x - 20, this.y - this.h, 40 * (this.hp/this.maxHp), 5);
        }
    }
}

class PlayerTank extends Tank {
    constructor(x, y) {
        super(x, y, {
            color: '#2a3b2a',
            accent: '#45a29e',
            w: 40, h: 50,
            hp: upgrades.armor.val,
            damage: upgrades.damage.val,
            speed: upgrades.speed.val,
            turnSpeed: 3.0,
            reloadTime: 1.2 - (upgrades.speed.level * 0.05)
        });
    }

    update(dt) {
        super.update(dt);
        let moveX = 0;
        let moveY = 0;
        let isTryingMove = false;

        if (!isMobile) {
            if (keys['KeyW'] || keys['ArrowUp']) { moveY = -1; isTryingMove = true; }
            if (keys['KeyS'] || keys['ArrowDown']) { moveY = 1; isTryingMove = true; }
            if (keys['KeyA'] || keys['ArrowLeft']) { moveX = -1; isTryingMove = true; }
            if (keys['KeyD'] || keys['ArrowRight']) { moveX = 1; isTryingMove = true; }
            
            // Mouse Turret Aim
            let targetTurretAngle = Math.atan2((mouseY + camera.y) - this.y, (mouseX + camera.x) - this.x);
            this.turretAngle = targetTurretAngle;

            if (mouseDown) {
                this.shoot();
            }
        } else {
            // Touch Joysticks
            if (mobileJoysticks.left.active) {
                moveX = mobileJoysticks.left.nx;
                moveY = mobileJoysticks.left.ny;
                isTryingMove = true;
            }
            if (isMobileFiring) {
                this.turretAngle = Math.atan2((mobileFireY + camera.y) - this.y, (mobileFireX + camera.x) - this.x);
                this.shoot();
            } else if (isTryingMove) {
                 // Auto center turret towards move direction if not firing
                 let moveAngle = Math.atan2(moveY, moveX);
                 let diff = moveAngle - this.turretAngle;
                 while(diff < -Math.PI) diff += Math.PI*2;
                 while(diff > Math.PI) diff -= Math.PI*2;
                 this.turretAngle += diff * dt * 3;
            }
        }

        this.isMoving = false;

        if (isTryingMove) {
            let moveVec = normalize(moveX, moveY);
            
            // Rotate Hull to match movement direction gradually
            let targetHullAngle = Math.atan2(moveVec.y, moveVec.x);
            
            // Shortest angle sweep
            let diff = targetHullAngle - this.hullAngle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            
            if (Math.abs(diff) > 0.1) {
                this.hullAngle += Math.sign(diff) * this.turnSpeed * dt;
            } else {
                this.hullAngle = targetHullAngle;
            }

            // Move Forward based on current hull angle to give physical feel
            let vx = Math.cos(this.hullAngle) * this.maxSpeed * dt;
            let vy = Math.sin(this.hullAngle) * this.maxSpeed * dt;
            
            // Allow sliding on walls (separate axis collision testing)
            if (!this.checkCollisions(this.x + vx, this.y)) {
                this.x += vx;
                this.isMoving = true;
            }
            if (!this.checkCollisions(this.x, this.y + vy)) {
                this.y += vy;
                this.isMoving = true;
            }
        }
        
        // Constrain to map
        this.x = clamp(this.x, this.w, WORLD_W - this.w);
        this.y = clamp(this.y, this.h, WORLD_H - this.h);

        // Update HUD
        const hpBar = document.getElementById('hud-health-bar');
        hpBar.style.width = `${Math.max(0, (this.hp / this.maxHp) * 100)}%`;
        if (this.hp / this.maxHp < 0.3) hpBar.classList.add('low');
        else hpBar.classList.remove('low');
        document.getElementById('hud-hp-text').innerText = `${Math.ceil(this.hp)}/${this.maxHp}`;
        
        const reloadBar = document.getElementById('hud-reload-bar');
        const reloadTxt = document.getElementById('hud-reload-text');
        if (this.reloadTimer > 0) {
            reloadBar.style.width = `${((this.reloadTime - this.reloadTimer) / this.reloadTime) * 100}%`;
            reloadTxt.innerText = "RELOADING";
            reloadBar.style.backgroundColor = 'var(--danger)';
        } else {
            reloadBar.style.width = `100%`;
            reloadTxt.innerText = "READY";
            reloadBar.style.backgroundColor = 'var(--warning)';
        }
    }
}

class EnemyTank extends Tank {
    constructor(x, y, type) {
        let config = { color: '#6b3e2b', accent: '#d45d2e' }; // Basic (Reddish)
        if (type === 'fast') {
            config = { color: '#828236', accent: '#e8e81e', w: 30, h: 42, speed: 200, hp: 50, damage: 15, reloadTime: 0.8 };
        } else if (type === 'heavy') {
            config = { color: '#4a4a4a', accent: '#ffffff', w: 50, h: 65, speed: 80, hp: 300, damage: 50, reloadTime: 2.0 };
        } else if (type === 'boss') {
            config = { color: '#2b0000', accent: '#ff0000', w: 60, h: 80, speed: 100, hp: 1000, damage: 70, reloadTime: 1.5 };
        } else {
            type = 'basic';
            config = { color: '#6b3e2b', accent: '#d45d2e', speed: 120, hp: 100, damage: 20, reloadTime: 1.5 };
        }
        
        super(x, y, config);
        this.enemyType = type;
        this.state = 'PATROL'; // PATROL, CHASE
        this.patrolTarget = { x: this.x + randomRange(-200, 200), y: this.y + randomRange(-200, 200) };
        this.patrolTimer = 0;
        this.sightRange = type === 'fast' ? 500 : 400;
        if(type === 'boss') this.sightRange = 800;
        this.shootRange = type === 'boss' ? 500 : 300;
    }

    update(dt) {
        super.update(dt);
        
        if (!player || player.hp <= 0) {
            this.state = 'PATROL';
        }

        let distToPlayer = distance(this.x, this.y, player.x, player.y);
        
        // Simple line of sight check (raycast approximation)
        let hasLOS = true;
        if (distToPlayer < this.sightRange) {
             let steps = 10;
             let dx = (player.x - this.x)/steps;
             let dy = (player.y - this.y)/steps;
             for(let i=1; i<steps; i++) {
                 let tx = this.x + dx*i;
                 let ty = this.y + dy*i;
                 for(let obs of obstacles) {
                     if(tx > obs.x && tx < obs.x+obs.w && ty > obs.y && ty < obs.y+obs.h) {
                         hasLOS = false;
                         break;
                     }
                 }
                 if(!hasLOS) break;
             }
        } else {
             hasLOS = false;
        }

        if (hasLOS) {
            this.state = 'CHASE';
        } else if (this.state === 'CHASE') {
             // Lost player, go to last known position briefly then patrol
             this.state = 'PATROL';
             this.patrolTarget = { x: player.x, y: player.y };
             this.patrolTimer = 2.0;
        }

        let targetX, targetY;

        if (this.state === 'PATROL') {
            targetX = this.patrolTarget.x;
            targetY = this.patrolTarget.y;
            this.patrolTimer -= dt;
            
            if (distance(this.x, this.y, targetX, targetY) < 50 || this.patrolTimer <= 0) {
                this.patrolTarget = { 
                    x: clamp(this.x + randomRange(-300, 300), 100, WORLD_W-100), 
                    y: clamp(this.y + randomRange(-300, 300), 100, WORLD_H-100) 
                };
                this.patrolTimer = randomRange(2, 5);
            }
        } else if (this.state === 'CHASE') {
            // Predict movement slightly
            targetX = player.x + player.vx * 0.5;
            targetY = player.y + player.vy * 0.5;
            
            // Aim at player
            let aimAngle = Math.atan2(player.y - this.y, player.x - this.x);
            let tDiff = aimAngle - this.turretAngle;
            while(tDiff < -Math.PI) tDiff+=Math.PI*2;
            while(tDiff > Math.PI) tDiff-=Math.PI*2;
            this.turretAngle += Math.sign(tDiff) * 3.0 * dt;

            // Shoot if close and aiming roughly at player
            if (distToPlayer < this.shootRange && Math.abs(tDiff) < 0.2) {
                this.shoot();
            }
            
            // Maintain optimal distance
            if(distToPlayer < 150) {
                 // Back away
                 targetX = this.x - (player.x - this.x);
                 targetY = this.y - (player.y - this.y);
            } else if (distToPlayer < 250 && this.enemyType !== 'boss') {
                 // Strafe / Hold position
                 targetX = this.x; targetY = this.y;
            }
        }

        // Movement execution
        if (distance(this.x, this.y, targetX, targetY) > 20) {
            let moveAngle = Math.atan2(targetY - this.y, targetX - this.x);
            
            let hDiff = moveAngle - this.hullAngle;
            while(hDiff < -Math.PI) hDiff+=Math.PI*2;
            while(hDiff > Math.PI) hDiff-=Math.PI*2;
            
            if (Math.abs(hDiff) > 0.2) {
                 this.hullAngle += Math.sign(hDiff) * this.turnSpeed * dt;
                 this.isMoving = true;
            } else {
                 this.hullAngle = moveAngle;
            }

            // Move
            let vx = Math.cos(this.hullAngle) * (this.state === 'PATROL' ? this.maxSpeed*0.5 : this.maxSpeed) * dt;
            let vy = Math.sin(this.hullAngle) * (this.state === 'PATROL' ? this.maxSpeed*0.5 : this.maxSpeed) * dt;
            
            if (!this.checkCollisions(this.x + vx, this.y)) this.x += vx;
            else this.patrolTimer = 0; // Force repath on bump
            
            if (!this.checkCollisions(this.x, this.y + vy)) this.y += vy;
            else this.patrolTimer = 0;
            
            if(vx !== 0 || vy !== 0) this.isMoving = true;
            else this.isMoving = false;
        } else {
            this.isMoving = false;
            // Slowly rotate turret to match hull when idle
            if(this.state === 'PATROL') {
                let diff = this.hullAngle - this.turretAngle;
                while(diff < -Math.PI) diff+=Math.PI*2;
                while(diff > Math.PI) diff-=Math.PI*2;
                this.turretAngle += diff * dt;
            }
        }
    }
}

// --- LEVEL GENERATION --- //
function initLevel(level) {
    currentLevel = level;
    obstacles = [];
    enemies = [];
    bullets = [];
    particles = [];
    
    // Set UI
    document.getElementById('hud-level').innerText = `LEVEL ${level}`;
    
    // Generate terrain borders
    for(let i=0; i<MAP_WIDTH; i++) {
        obstacles.push(new Obstacle(i*TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, 'wall'));
        obstacles.push(new Obstacle(i*TILE_SIZE, (MAP_HEIGHT-1)*TILE_SIZE, TILE_SIZE, TILE_SIZE, 'wall'));
    }
    for(let j=0; j<MAP_HEIGHT; j++) {
        obstacles.push(new Obstacle(0, j*TILE_SIZE, TILE_SIZE, TILE_SIZE, 'wall'));
        obstacles.push(new Obstacle((MAP_WIDTH-1)*TILE_SIZE, j*TILE_SIZE, TILE_SIZE, TILE_SIZE, 'wall'));
    }

    // Generate inner obstacles based on level complexity
    let numObstacles = 20 + level * 2;
    for(let i=0; i<numObstacles; i++) {
        let w = Math.floor(randomRange(1, 4)) * TILE_SIZE;
        let h = Math.floor(randomRange(1, 4)) * TILE_SIZE;
        let x = Math.floor(randomRange(2, MAP_WIDTH - 4)) * TILE_SIZE;
        let y = Math.floor(randomRange(2, MAP_HEIGHT - 4)) * TILE_SIZE;
        
        let type = Math.random() > 0.3 ? 'wall' : 'crate';
        
        // Don't block center (spawn area)
        if (Math.abs(x - WORLD_W/2) > 200 || Math.abs(y - WORLD_H/2) > 200) {
            obstacles.push(new Obstacle(x, y, w, h, type));
        }
    }

    // Spawn Player
    player = new PlayerTank(WORLD_W/2, WORLD_H/2);

    // Spawn Enemies
    let numEnemies = 2 + Math.floor(level * 0.8);
    for(let i=0; i<numEnemies; i++) {
        let ex, ey;
        do {
            ex = randomRange(200, WORLD_W - 200);
            ey = randomRange(200, WORLD_H - 200);
        } while(distance(ex, ey, player.x, player.y) < 500); // Don't spawn too close
        
        let pool = ['basic', 'basic'];
        if(level > 3) pool.push('fast');
        if(level > 7) pool.push('heavy');
        
        let type = pool[Math.floor(Math.random()*pool.length)];
        enemies.push(new EnemyTank(ex, ey, type));
    }

    // Boss Every 10 levels or level 40
    if (level % 10 === 0) {
        enemies.push(new EnemyTank(WORLD_W - 300, WORLD_H - 300, 'boss'));
    }

    updateEnemyCount();
}

function updateEnemyCount() {
    let alive = enemies.filter(e => e.hp > 0).length;
    document.getElementById('hud-enemies-text').innerText = `${alive} REMAINING`;
}

function addScore(pts) {
    score += pts;
    funds += Math.floor(pts / 2);
    document.getElementById('hud-score').innerText = `SCORE: ${score}`;
}

// --- GAME LOOP --- //
function update(dt) {
    if (gameState !== 'PLAYING') return;

    if (screenShakeTimer > 0) {
        screenShakeTimer -= dt;
        screenShakeX = (Math.random() - 0.5) * 20;
        screenShakeY = (Math.random() - 0.5) * 20;
    } else {
        screenShakeX = 0;
        screenShakeY = 0;
    }

    if (player.hp > 0) {
        player.update(dt);
        
        // Camera Follow
        let diffX = player.x - cw/2 - camera.x;
        let diffY = player.y - ch/2 - camera.y;
        camera.x += diffX * 5.0 * dt;
        camera.y += diffY * 5.0 * dt;
        
        // Clamp camera to world bounds
        camera.x = clamp(camera.x, 0, WORLD_W - cw);
        camera.y = clamp(camera.y, 0, WORLD_H - ch);
    } else {
        // Player death logic
        setTimeout(() => {
            if(gameState === 'PLAYING') {
                gameState = 'GAMEOVER';
                document.getElementById('go-level').innerText = currentLevel;
                document.getElementById('go-score').innerText = score;
                showLayer(uiGameOver);
            }
        }, 2000);
    }

    // Enemies
    let aliveEnemies = 0;
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        if (e.hp > 0) {
            e.update(dt);
            aliveEnemies++;
        } else {
            addScore(e.enemyType === 'boss' ? 500 : (e.enemyType === 'heavy' ? 200 : 100));
            enemies.splice(i, 1);
            updateEnemyCount();
        }
    }

    // Win condition
    if (aliveEnemies === 0 && player.hp > 0) {
        gameState = 'UPGRADE';
        setTimeout(() => {
            if (currentLevel >= MAX_LEVELS) {
                gameState = 'VICTORY';
                document.getElementById('vic-score').innerText = score;
                showLayer(uiVictory);
            } else {
                openShop();
            }
        }, 1500);
    }

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.update(dt);
        
        let hit = false;
        
        // Wall hits
        for (let obs of obstacles) {
            if (circleRectIntersect(b.x, b.y, b.radius, obs.x, obs.y, obs.w, obs.h)) {
                hit = true;
                if(obs.type === 'crate') {
                     obs.hp -= b.damage;
                     if(obs.hp <= 0) {
                         obstacles.splice(obstacles.indexOf(obs), 1);
                         for(let k=0; k<10; k++) particles.push(new Particle(obs.x+obs.w/2, obs.y+obs.h/2, 'debris'));
                     }
                }
                break;
            }
        }

        // Entity hits
        if (!hit) {
            let targets = b.isPlayer ? enemies : [player];
            for (let t of targets) {
                if (t && t.hp > 0) {
                    if (distance(b.x, b.y, t.x, t.y) < t.w/2 + b.radius) {
                        t.takeDamage(b.damage);
                        hit = true;
                        break;
                    }
                }
            }
        }

        if (b.life <= 0 || hit) {
            let pColor = b.isPlayer ? 'smoke' : 'fire'; // differentiating impact slightly
            for(let j=0; j<5; j++) particles.push(new Particle(b.x, b.y, pColor));
            bullets.splice(i, 1);
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(dt);
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawGrid(ctx) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    let startX = Math.floor(camera.x / TILE_SIZE) * TILE_SIZE;
    let startY = Math.floor(camera.y / TILE_SIZE) * TILE_SIZE;
    
    ctx.beginPath();
    for (let x = startX; x < camera.x + cw; x += TILE_SIZE) {
        ctx.moveTo(x, camera.y);
        ctx.lineTo(x, camera.y + ch);
    }
    for (let y = startY; y < camera.y + ch; y += TILE_SIZE) {
        ctx.moveTo(camera.x, y);
        ctx.lineTo(camera.x + cw, y);
    }
    ctx.stroke();
}

function drawMinimap() {
    mCtx.clearRect(0, 0, 150, 150);
    let scaleX = 150 / WORLD_W;
    let scaleY = 150 / WORLD_H;

    // Obstacles
    mCtx.fillStyle = '#444';
    for(let obs of obstacles) {
        if(obs.type === 'wall') mCtx.fillRect(obs.x * scaleX, obs.y * scaleY, obs.w * scaleX, obs.h * scaleY);
    }

    // Enemies
    mCtx.fillStyle = '#f00';
    for(let e of enemies) {
        if(e.hp > 0) {
            mCtx.beginPath();
            mCtx.arc(e.x * scaleX, e.y * scaleY, 2, 0, Math.PI*2);
            mCtx.fill();
        }
    }

    // Player
    if (player && player.hp > 0) {
        mCtx.fillStyle = '#0f0';
        mCtx.beginPath();
        mCtx.arc(player.x * scaleX, player.y * scaleY, 3, 0, Math.PI*2);
        mCtx.fill();
        
        // Camera Viewport Box
        mCtx.strokeStyle = 'rgba(255,255,255,0.5)';
        mCtx.lineWidth = 1;
        mCtx.strokeRect(camera.x * scaleX, camera.y * scaleY, cw * scaleX, ch * scaleY);
    }
}

function draw() {
    ctx.fillStyle = '#1e1c16'; // Dirt/Sand base color
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(-camera.x + screenShakeX, -camera.y + screenShakeY);

    drawGrid(ctx);

    // Draw tracks and lower particles
    for (let p of particles) if(p.type === 'track') p.draw(ctx);
    
    for (let obs of obstacles) obs.draw(ctx);
    
    // Sort entities for slight pseudo-depth (y-sorting)
    let renderList = [...bullets, ...enemies, player].filter(e => e && (e.hp > 0 || e instanceof Bullet));
    renderList.sort((a,b) => a.y - b.y);

    for (let e of renderList) e.draw(ctx);

    // Draw upper particles (smoke, fire)
    ctx.globalCompositeOperation = 'screen';
    for (let p of particles) if(p.type === 'fire') p.draw(ctx);
    ctx.globalCompositeOperation = 'source-over';
    for (let p of particles) if(p.type === 'smoke' || p.type === 'debris') p.draw(ctx);

    ctx.restore();

    // Viginette / Lighting overlay
    let gradient = ctx.createRadialGradient(cw/2, ch/2, Math.min(cw, ch) * 0.3, cw/2, ch/2, Math.min(cw, ch));
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cw, ch);
    
    if (gameState === 'PLAYING') {
        drawMinimap();
    }
}

function loop(timestamp) {
    // Delta time clamping to handle tab switching
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; 
    lastTime = timestamp;

    update(dt);
    draw();

    gameLoopId = requestAnimationFrame(loop);
}

// --- UI / STATE MANAGEMENT --- //
function hideAllLayers() {
    document.querySelectorAll('.ui-layer').forEach(layer => layer.classList.add('hidden'));
    document.querySelectorAll('.ui-layer').forEach(layer => layer.classList.remove('active'));
}

function showLayer(layer) {
    hideAllLayers();
    layer.classList.remove('hidden');
    layer.classList.add('active');
    // Keep HUD and Mobile Controls visible if in game
    if(gameState === 'PLAYING') {
        uiHud.classList.remove('hidden');
        uiHud.classList.add('active');
        if(isMobile) {
            uiMobileControls.classList.remove('hidden');
            uiMobileControls.classList.add('active');
        }
    }
}

function startGame() {
    score = 0;
    funds = 0;
    playerLevel = 1;
    // Reset Upgrades
    upgrades.damage.level = 1; upgrades.damage.val = 25; upgrades.damage.cost = 500;
    upgrades.armor.level = 1;  upgrades.armor.val = 100; upgrades.armor.cost = 500;
    upgrades.speed.level = 1;  upgrades.speed.val = 150; upgrades.speed.cost = 500;
    
    startLevel(1);
}

function startLevel(l) {
    gameState = 'PLAYING';
    initLevel(l);
    showLayer(uiHud); // handled by PLAYING state logic in showLayer
}


function openShop() {
    gameState = 'UPGRADE';
    showLayer(uiUpgrade);
    updateShopUI();
}

function updateShopUI() {
    document.getElementById('shop-funds').innerText = funds;
    
    document.querySelectorAll('.upgrade-card').forEach(card => {
        let type = card.dataset.type;
        let upg = upgrades[type];
        let btn = card.querySelector('.btn-buy');
        card.querySelector('.u-lvl').innerText = upg.level;
        
        if (upg.level >= upg.max) {
            btn.innerText = "MAXED OUT";
            btn.disabled = true;
        } else {
            btn.innerText = `BUY ($${upg.cost})`;
            btn.disabled = (funds < upg.cost);
        }
    });
}

// Button Bindings
// Login Bindings
document.getElementById('btn-login-submit').addEventListener('click', () => {
    playSound('hit');
    let name = document.getElementById('pilot-name').value;
    if(name.trim() === '') name = 'Commander';
    document.querySelector('.game-title[data-text="TANK BATTLE WAR"]').innerText = `WELCOME, ${name.toUpperCase()}`;
    gameState = 'MENU'; 
    showLayer(uiMainMenu); 
});
document.getElementById('btn-login-guest').addEventListener('click', () => {
    playSound('hit');
    document.querySelector('.game-title[data-text="TANK BATTLE WAR"]').innerText = `TANK BATTLE WAR`;
    gameState = 'MENU'; 
    showLayer(uiMainMenu); 
});

// Menu Bindings
document.getElementById('btn-start').addEventListener('click', () => {
    playSound('hit');
    startLevel(1); 
});
document.getElementById('btn-how-to').addEventListener('click', () => {
    playSound('hit');
    showLayer(uiInstructions); 
});
document.getElementById('btn-inst-start').addEventListener('click', () => {
    playSound('hit');
    startGame(); 
});
document.getElementById('btn-inst-back').addEventListener('click', () => {
    playSound('hit');
    showLayer(uiMainMenu); 
});
document.getElementById('btn-restart').addEventListener('click', () => {
    playSound('hit');
    startGame(); 
});
document.getElementById('btn-home').addEventListener('click', () => {
    playSound('hit');
    gameState = 'MENU'; showLayer(uiMainMenu); 
});
document.getElementById('btn-vic-home').addEventListener('click', () => {
    playSound('hit');
    gameState = 'MENU'; showLayer(uiMainMenu); 
});
document.getElementById('btn-next-level').addEventListener('click', () => {
    playSound('hit');
    playerLevel++;
    startLevel(playerLevel);
});

// Shop Bindings
document.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', (e) => {
        let card = e.target.closest('.upgrade-card');
        let type = card.dataset.type;
        let upg = upgrades[type];
        
        if (funds >= upg.cost && upg.level < upg.max) {
            funds -= upg.cost;
            upg.level++;
            upg.val += upg.inc;
            upg.cost = Math.floor(upg.cost * 1.5);
            playSound('shoot', 0.5); // Cha-ching sound alt
            updateShopUI();
        }
    });
});

// Sound Toggle
const btnSound = document.getElementById('btn-sound-toggle');
btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnSound.innerText = soundEnabled ? '🔊' : '🔇';
    btnSound.style.opacity = soundEnabled ? '1' : '0.5';
    // Initialize audio context on first user interaction if enabled
    if(soundEnabled && !actx) playSound('hit', 0); 
});

// Start game loop
initInput();
showLayer(uiLogin);
gameLoopId = requestAnimationFrame(loop);
