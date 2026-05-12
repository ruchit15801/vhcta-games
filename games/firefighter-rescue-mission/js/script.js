/**
 * Firefighter Rescue Mission - Core Game Logic
 * Author: Antigravity AI
 * Built with HTML5 Canvas, Vanilla JS
 */

// --- ZzFX Micro Audio Synthesizer ---
const zzfx=(...t)=>zzfxP(zzfxG(...t));
const zzfxP=(...t)=>{
    if(!zzfxX)return;
    try {
        let e=zzfxX.createBufferSource(),f=zzfxX.createBuffer(t.length,t[0].length,zzfxR);
        t.map((d,i)=>f.getChannelData(i).set(d));
        e.buffer=f;e.connect(zzfxX.destination);e.start();
        return e;
    } catch(e){}
};
const zzfxG=(q=1,k=.05,c=220,e=0,t=0,u=.1,r=0,F=1,v=0,z=0,w=0,A=0,l=0,B=0,x=0,G=0,d=0,y=1,m=0,C=0)=>{let b=2*Math.PI,H=v*=500*b/zzfxR**2,I=(0<x?1:-1)*b/4,D=c*=(1+2*k*Math.random()-k)*b/zzfxR,Z=[],g=0,E=0,a=0,n=1,J=0,K=0,f=0,p,h;e=99+zzfxR*e;m*=zzfxR;t*=zzfxR;u*=zzfxR;d*=zzfxR;z*=500*b/zzfxR**3;x*=b/zzfxR;w*=b/zzfxR;A*=zzfxR;l=zzfxR*l|0;for(h=e+m+t+u+d|0;a<h;Z[a++]=f)++K%(100*G|0)||(f=r?1<r?2<r?3<r?Math.sin((g%b)**3):Math.max(Math.min(Math.tan(g),1),-1):1-(2*g/b%2+2)%2:1-4*Math.abs(Math.round(g/b)-g/b):Math.sin(g),f=(l?1-C+C*Math.sin(2*Math.PI*a/l):1)*(0<f?1:-1)*Math.abs(f)**F*q*zzfxV*(a<e?a/e:a<e+m?1-(a-e)/m*(1-y):a<e+m+t?y:a<h-d?(h-a-d)/u*y:0),f=d?f/2+(d>a?0:(a<h-d?1:(h-a)/d)*Z[a-d|0]/2):f),p=(c+=v+=z)*Math.sin(E*x-I),g+=p-p*B*(1-1E9*(Math.sin(a)+1)%2),E+=p-p*B*(1-1E9*(Math.sin(a)**2+1)%2),J&&++J>A&&(c+=w,D+=w,J=0),!l||++f%l||(c=D,v=H,J=J||1);return Z};
const zzfxV=.3;
const zzfxR=44100;
let zzfxX = null;
try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) zzfxX = new AudioCtx();
} catch(e) {
    console.warn("AudioContext could not be initialized", e);
}

// --- Game Configuration & State ---
const CONFIG = {
    FPS: 60,
    TILE_SIZE: 64,
    PLAYER_SPEED: 250, 
    CIVILIAN_SPEED: 140,
    FIRE_SPREAD_RATE: 2.0, 
    MAX_LEVEL: 20
};

const STATE = {
    MENU: 0,
    PLAYING: 1,
    PAUSED: 2,
    GAMEOVER: 3,
    LEVEL_COMPLETE: 4
};

let gameState = STATE.MENU;
let currentLevel = 1;
let lastTime = 0;
let timeRemaining = 120; 
let score = 0;
let soundEnabled = true;
let isMobile = false;

// --- Assets ---
const ASSETS = {
    images: {
        player: new Image(),
        fire: new Image(),
        civilian: new Image()
    },
    loaded: 0,
    total: 3
};

ASSETS.images.player.onload = () => ASSETS.loaded++;
ASSETS.images.fire.onload = () => ASSETS.loaded++;
ASSETS.images.civilian.onload = () => ASSETS.loaded++;

ASSETS.images.player.src = 'assets/images/player.png';
ASSETS.images.fire.src = 'assets/images/fire.png';
ASSETS.images.civilian.src = 'assets/images/civilian.png';

// --- Sound Functions ---
const SOUNDS = {
    spray: () => soundEnabled && zzfx(0.5,.1,100,.1,.3,.5,3,1.5,0,0,0,0,0,0,0,0,0,.5,.1,.05),
    fireExtinguish: () => soundEnabled && zzfx(1.2,.05,150,.1,.2,.4,3,2,0,0,0,0,0,0,0,0,0,.5,.05,0),
    rescue: () => soundEnabled && zzfx(1,.1,600,.05,.1,.2,0,1.2,5,-2,0,0,0,0,0,0,0,1,.1,0),
    levelUp: () => soundEnabled && zzfx(1,.1,400,.1,.2,.5,0,1.5,0,0,50,.1,0,0,0,0,0,1,.1,0),
    gameOver: () => soundEnabled && zzfx(1.5,.5,100,.2,.5,1,2,1,0,0,-10,.1,0,0,0,0,0,1,.2,0),
    hurt: () => soundEnabled && zzfx(1,.05,150,.05,.1,.2,2,1.5,0,0,-5,.1,0,0,0,0,0,1,.1,0)
};

// --- DOM Elements ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const screens = {
    mainMenu: document.getElementById('main-menu'),
    tutorial: document.getElementById('tutorial-screen'),
    hud: document.getElementById('hud'),
    pauseMenu: document.getElementById('pause-menu'),
    levelComplete: document.getElementById('level-complete'),
    gameOver: document.getElementById('game-over')
};
const ui = {
    healthBar: document.getElementById('health-bar'),
    waterBar: document.getElementById('water-bar'),
    levelDisplay: document.getElementById('level-display'),
    timeDisplay: document.getElementById('time-display'),
    fireCount: document.getElementById('fire-count'),
    rescueCount: document.getElementById('rescue-count'),
    damageFlash: document.getElementById('damage-flash')
};

// --- Input Management ---
const Input = {
    keys: {},
    joystick: { active: false, dx: 0, dy: 0 },
    actionWater: false,
    init() {
        window.addEventListener('keydown', e => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
        
        const zone = document.getElementById('joystick-zone');
        const stick = document.getElementById('joystick-stick');
        const base = document.getElementById('joystick-base');
        let baseRect;
        
        const handleTouch = (e, isDown) => {
            e.preventDefault();
            if (!isDown) {
                this.joystick.active = false;
                this.joystick.dx = 0;
                this.joystick.dy = 0;
                stick.style.transform = `translate(0px, 0px)`;
                return;
            }
            this.joystick.active = true;
            if (!baseRect) baseRect = base.getBoundingClientRect();
            const touch = e.targetTouches[0];
            const centerX = baseRect.left + baseRect.width / 2;
            const centerY = baseRect.top + baseRect.height / 2;
            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            const dist = Math.hypot(dx, dy);
            const maxDist = baseRect.width / 2;
            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }
            stick.style.transform = `translate(${dx}px, ${dy}px)`;
            this.joystick.dx = dx / maxDist;
            this.joystick.dy = dy / maxDist;
        };
        
        zone.addEventListener('touchstart', e => handleTouch(e, true), {passive: false});
        zone.addEventListener('touchmove', e => handleTouch(e, true), {passive: false});
        zone.addEventListener('touchend', e => handleTouch(e, false));
        
        const btnWater = document.getElementById('btn-action-water');
        btnWater.addEventListener('touchstart', (e) => { e.preventDefault(); this.actionWater = true; });
        btnWater.addEventListener('touchend', (e) => { e.preventDefault(); this.actionWater = false; });
        btnWater.addEventListener('mousedown', () => this.actionWater = true);
        btnWater.addEventListener('mouseup', () => this.actionWater = false);
        btnWater.addEventListener('mouseleave', () => this.actionWater = false);

        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            isMobile = true;
            document.getElementById('mobile-controls').style.display = 'flex';
        }
    }
};

class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.shakeTime = 0;
        this.shakeMag = 0;
    }
    shake(magnitude, time) {
        this.shakeMag = magnitude;
        this.shakeTime = time;
    }
    follow(target, dt) {
        const targetX = target.x - canvas.width / 2;
        const targetY = target.y - canvas.height / 2;
        this.x += (targetX - this.x) * 5 * dt;
        this.y += (targetY - this.y) * 5 * dt;
        this.x = Math.max(0, Math.min(this.x, Level.width * CONFIG.TILE_SIZE - canvas.width));
        this.y = Math.max(0, Math.min(this.y, Level.height * CONFIG.TILE_SIZE - canvas.height));
        
        if (this.shakeTime > 0) {
            this.x += (Math.random() - 0.5) * this.shakeMag;
            this.y += (Math.random() - 0.5) * this.shakeMag;
            this.shakeTime -= dt;
        }
    }
}

class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'water', 'smoke', 'spark', 'dust'
        this.life = 1.0;
        this.maxLife = type === 'water' ? 0.6 : (type === 'smoke' ? 2.0 : (type === 'dust' ? 0.5 : 1.2));
        
        const angle = Math.random() * Math.PI * 2;
        const speed = type === 'water' ? Math.random() * 250 + 150 : (type === 'spark' ? Math.random() * 100 + 50 : (type === 'dust' ? Math.random() * 20 : Math.random() * 50 + 20));
        
        if (type === 'water') {
            const spread = 0.5;
            const dir = player.angle + (Math.random() * spread - spread/2);
            this.vx = Math.cos(dir) * speed;
            this.vy = Math.sin(dir) * speed;
        } else if (type === 'spark') {
            this.vx = Math.cos(angle) * speed;
            this.vy = -Math.random() * speed - 50; 
        } else if (type === 'dust') {
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
        } else {
            this.vx = Math.cos(angle) * speed * 0.5;
            this.vy = -Math.random() * 100 - 30; 
        }
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt / this.maxLife;
        if(this.type === 'water') {
            this.vx *= 0.90;
            this.vy *= 0.90;
        }
    }
    draw(ctx, camX, camY) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.beginPath();
        if (this.type === 'water') {
            ctx.fillStyle = '#74b9ff';
            ctx.arc(this.x - camX, this.y - camY, 4, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(116, 185, 255, 0.5)';
            ctx.arc(this.x - camX, this.y - camY, 8, 0, Math.PI*2);
        } else if (this.type === 'smoke') {
            ctx.fillStyle = '#2d3436';
            ctx.arc(this.x - camX, this.y - camY, 15 + (1-this.life)*30, 0, Math.PI*2);
        } else if (this.type === 'dust') {
            ctx.fillStyle = '#7f8c8d';
            ctx.arc(this.x - camX, this.y - camY, 4 + (1-this.life)*6, 0, Math.PI*2);
        } else {
            ctx.fillStyle = '#fdcb6e';
            ctx.arc(this.x - camX, this.y - camY, 3 * this.life, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(225, 112, 85, 0.5)';
            ctx.arc(this.x - camX, this.y - camY, 8 * this.life, 0, Math.PI*2);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class Entity {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.walkCycle = 0;
    }
    move(dt) {
        let newX = this.x + this.vx * dt;
        let newY = this.y + this.vy * dt;
        const checkCollision = (cx, cy) => {
            const tileX = Math.floor(cx / CONFIG.TILE_SIZE);
            const tileY = Math.floor(cy / CONFIG.TILE_SIZE);
            return Level.grid[tileY] && Level.grid[tileY][tileX] === 1;
        };
        if (!checkCollision(newX + Math.sign(this.vx)*this.radius, this.y) &&
            !checkCollision(newX, this.y + Math.sign(this.vy)*this.radius)) {
            this.x = newX;
        } else if (!checkCollision(newX + Math.sign(this.vx)*this.radius, this.y)) {
             this.x = newX;
        }
        if (!checkCollision(this.x, newY + Math.sign(this.vy)*this.radius) &&
            !checkCollision(this.x + Math.sign(this.vx)*this.radius, newY)) {
            this.y = newY;
        } else if (!checkCollision(this.x, newY + Math.sign(this.vy)*this.radius)) {
            this.y = newY;
        }
        this.x = Math.max(this.radius, Math.min(this.x, Level.width * CONFIG.TILE_SIZE - this.radius));
        this.y = Math.max(this.radius, Math.min(this.y, Level.height * CONFIG.TILE_SIZE - this.radius));
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 20);
        this.hp = 100;
        this.water = 100;
        this.isSpraying = false;
        this.damageTimer = 0;
    }
    update(dt) {
        let dx = 0;
        let dy = 0;
        if (Input.joystick.active) {
            dx = Input.joystick.dx;
            dy = Input.joystick.dy;
        } else {
            if (Input.keys['w'] || Input.keys['arrowup']) dy = -1;
            if (Input.keys['s'] || Input.keys['arrowdown']) dy = 1;
            if (Input.keys['a'] || Input.keys['arrowleft']) dx = -1;
            if (Input.keys['d'] || Input.keys['arrowright']) dx = 1;
        }
        const len = Math.hypot(dx, dy);
        if (len > 0) {
            this.vx = (dx / len) * CONFIG.PLAYER_SPEED;
            this.vy = (dy / len) * CONFIG.PLAYER_SPEED;
            this.angle = Math.atan2(dy, dx);
            this.walkCycle += dt * 15;
            if (Math.random() < 0.3) {
                Level.particles.push(new Particle(this.x - Math.cos(this.angle)*15, this.y - Math.sin(this.angle)*15, 'dust'));
            }
        } else {
            this.vx = 0;
            this.vy = 0;
            this.walkCycle = 0;
        }
        this.move(dt);
        this.isSpraying = (Input.keys[' '] || Input.actionWater) && this.water > 0;
        if (this.isSpraying) {
            this.water -= dt * 15;
            if(Math.random() < 0.5) SOUNDS.spray();
            for(let i=0; i<4; i++) {
                Level.particles.push(new Particle(this.x + Math.cos(this.angle)*20, this.y + Math.sin(this.angle)*20, 'water'));
            }
            const sprayX = this.x + Math.cos(this.angle) * 70;
            const sprayY = this.y + Math.sin(this.angle) * 70;
            Level.fires.forEach(f => {
                const dist = Math.hypot(f.x*CONFIG.TILE_SIZE + 32 - sprayX, f.y*CONFIG.TILE_SIZE + 32 - sprayY);
                if (dist < 70) {
                    f.intensity -= dt * 60;
                    if (Math.random() < 0.2) Level.particles.push(new Particle(f.x*CONFIG.TILE_SIZE + 32, f.y*CONFIG.TILE_SIZE + 32, 'smoke'));
                }
            });
        } else {
            this.water = Math.min(100, this.water + dt * 8);
        }
        this.damageTimer -= dt;
        let onFire = false;
        Level.fires.forEach(f => {
            const dist = Math.hypot(f.x*CONFIG.TILE_SIZE + 32 - this.x, f.y*CONFIG.TILE_SIZE + 32 - this.y);
            if (dist < 45) onFire = true;
        });
        if (onFire && this.damageTimer <= 0) {
            this.hp -= 10;
            this.damageTimer = 0.5;
            camera.shake(15, 0.3);
            SOUNDS.hurt();
            ui.damageFlash.classList.add('flash-active');
            setTimeout(() => ui.damageFlash.classList.remove('flash-active'), 150);
            if (this.hp <= 0) gameOver("You succumbed to the fire.");
        }
    }
    draw(ctx, camX, camY) {
        ctx.save();
        ctx.translate(this.x - camX, this.y - camY);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 5, 20, 10, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.rotate(this.angle);
        const isMoving = this.vx !== 0 || this.vy !== 0;
        if (isMoving) {
            const waddle = Math.sin(this.walkCycle) * 0.15;
            const stretch = 1 + Math.sin(this.walkCycle * 2) * 0.05;
            const squash = 1 - Math.sin(this.walkCycle * 2) * 0.05;
            ctx.rotate(waddle);
            ctx.scale(stretch, squash);
        }
        if (ASSETS.images.player.complete && ASSETS.images.player.naturalWidth > 0) {
            ctx.drawImage(ASSETS.images.player, -32, -32, 64, 64);
        } else {
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(10, 0, 8, 0, Math.PI*2); ctx.fill(); 
        }
        ctx.restore();
    }
}

class Civilian extends Entity {
    constructor(x, y) {
        super(x, y, 16);
        this.rescued = false;
        this.saved = false;
        this.panicAngle = Math.random() * Math.PI * 2;
        this.panicTimer = 0;
    }
    update(dt) {
        if (this.saved) return;
        if (!this.rescued) {
            const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
            if (distToPlayer < 50) {
                this.rescued = true;
                SOUNDS.rescue();
                score += 100;
            }
            this.panicTimer -= dt;
            if(this.panicTimer <= 0) {
                this.panicAngle += (Math.random() - 0.5) * Math.PI;
                this.panicTimer = Math.random() * 1 + 0.5;
            }
            this.vx = Math.cos(this.panicAngle) * (CONFIG.CIVILIAN_SPEED * 0.3);
            this.vy = Math.sin(this.panicAngle) * (CONFIG.CIVILIAN_SPEED * 0.3);
        } else {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 60) {
                this.vx = (dx / dist) * CONFIG.CIVILIAN_SPEED;
                this.vy = (dy / dist) * CONFIG.CIVILIAN_SPEED;
                this.angle = Math.atan2(dy, dx);
            } else {
                this.vx = 0;
                this.vy = 0;
            }
            const tileX = Math.floor(this.x / CONFIG.TILE_SIZE);
            const tileY = Math.floor(this.y / CONFIG.TILE_SIZE);
            if (Level.grid[tileY] && Level.grid[tileY][tileX] === 2) {
                this.saved = true;
                score += 500;
                SOUNDS.rescue();
                Level.civiliansSaved++;
            }
        }
        if (this.vx !== 0 || this.vy !== 0) {
            this.walkCycle += dt * 12;
            if (Math.random() < 0.2) {
                Level.particles.push(new Particle(this.x, this.y, 'dust'));
            }
        } else {
            this.walkCycle = 0;
        }
        this.move(dt);
    }
    draw(ctx, camX, camY) {
        if (this.saved) return;
        ctx.save();
        ctx.translate(this.x - camX, this.y - camY);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 5, 16, 8, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.rotate(this.angle);
        const isMoving = this.vx !== 0 || this.vy !== 0;
        if (isMoving) {
            const waddle = Math.sin(this.walkCycle) * 0.15;
            const stretch = 1 + Math.sin(this.walkCycle * 2) * 0.05;
            const squash = 1 - Math.sin(this.walkCycle * 2) * 0.05;
            ctx.rotate(waddle);
            ctx.scale(stretch, squash);
        }
        if (ASSETS.images.civilian.complete && ASSETS.images.civilian.naturalWidth > 0) {
            ctx.drawImage(ASSETS.images.civilian, -24, -24, 48, 48);
        } else {
            ctx.fillStyle = this.rescued ? '#2ecc71' : '#3498db';
            ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
}

class Fire {
    constructor(tx, ty) {
        this.x = tx;
        this.y = ty;
        this.intensity = 100;
        this.spreadTimer = Math.random() * CONFIG.FIRE_SPREAD_RATE;
        this.active = true;
        this.animOffset = Math.random() * 100;
    }
    update(dt) {
        if (!this.active) return;
        if (this.intensity <= 0) {
            this.active = false;
            SOUNDS.fireExtinguish();
            score += 50;
            Level.firesExtinguished++;
            return;
        }
        this.intensity = Math.min(200, this.intensity + dt * 3);
        this.spreadTimer -= dt;
        if (this.spreadTimer <= 0) {
            this.spreadTimer = CONFIG.FIRE_SPREAD_RATE;
            if (this.intensity > 100 && Math.random() < 0.6) {
                Level.spreadFire(this.x, this.y);
            }
        }
        if (Math.random() < 0.05) Level.particles.push(new Particle(this.x*CONFIG.TILE_SIZE + 32, this.y*CONFIG.TILE_SIZE + 32, 'smoke'));
        if (this.intensity > 150 && Math.random() < 0.1) Level.particles.push(new Particle(this.x*CONFIG.TILE_SIZE + 32, this.y*CONFIG.TILE_SIZE + 32, 'spark'));
    }
    draw(ctx, camX, camY) {
        if (!this.active) return;
        const px = this.x * CONFIG.TILE_SIZE - camX;
        const py = this.y * CONFIG.TILE_SIZE - camY;
        const scale = this.intensity / 100;
        const size = CONFIG.TILE_SIZE * Math.min(1.5, scale);
        const offset = (CONFIG.TILE_SIZE - size) / 2;
        ctx.save();
        ctx.globalAlpha = Math.min(1, scale);
        if (ASSETS.images.fire.complete && ASSETS.images.fire.naturalWidth > 0) {
             ctx.globalCompositeOperation = 'lighter';
             const pulse = 1 + Math.sin(Date.now()*0.01 + this.animOffset)*0.15;
             ctx.drawImage(ASSETS.images.fire, px + offset - (size*pulse-size)/2, py + offset - (size*pulse-size)/2, size*pulse, size*pulse);
             ctx.globalCompositeOperation = 'source-over';
        } else {
            ctx.fillStyle = '#e67e22';
            ctx.fillRect(px + offset, py + offset, size, size);
        }
        ctx.restore();
    }
}

const Level = {
    grid: [], 
    width: 0,
    height: 0,
    fires: [],
    civilians: [],
    particles: [],
    civiliansSaved: 0,
    firesExtinguished: 0,
    totalCivilians: 0,
    
    generate(levelNum) {
        this.width = 15 + Math.floor(levelNum * 1.5);
        this.height = 10 + Math.floor(levelNum * 1);
        this.grid = Array(this.height).fill(0).map(() => Array(this.width).fill(0));
        this.fires = [];
        this.civilians = [];
        this.particles = [];
        this.civiliansSaved = 0;
        this.firesExtinguished = 0;
        for(let y=0; y<this.height; y++) {
            for(let x=0; x<this.width; x++) {
                if (x===0 || x===this.width-1 || y===0 || y===this.height-1) this.grid[y][x] = 1;
            }
        }
        const numRooms = 2 + Math.floor(levelNum * 0.5);
        for(let i=0; i<numRooms; i++) {
            let wx = Math.floor(Math.random() * (this.width - 4)) + 2;
            let wy = Math.floor(Math.random() * (this.height - 4)) + 2;
            let wLen = Math.floor(Math.random() * 5) + 3;
            let isHoriz = Math.random() < 0.5;
            for(let l=0; l<wLen; l++) {
                if (isHoriz && wx+l < this.width-1) this.grid[wy][wx+l] = 1;
                if (!isHoriz && wy+l < this.height-1) this.grid[wy+l][wx] = 1;
            }
        }
        this.grid[1][1] = 2; this.grid[1][2] = 2; this.grid[2][1] = 2; this.grid[2][2] = 2;
        player = new Player(1.5 * CONFIG.TILE_SIZE, 1.5 * CONFIG.TILE_SIZE);
        const numFires = 5 + levelNum * 3;
        for(let i=0; i<numFires; i++) {
            let fx = Math.floor(Math.random() * (this.width-2)) + 1;
            let fy = Math.floor(Math.random() * (this.height-2)) + 1;
            if (this.grid[fy][fx] === 0 && (fx > 4 || fy > 4)) this.fires.push(new Fire(fx, fy));
            else i--;
        }
        this.totalCivilians = 2 + Math.floor(levelNum / 2);
        for(let i=0; i<this.totalCivilians; i++) {
            let cx = Math.floor(Math.random() * (this.width-2)) + 1;
            let cy = Math.floor(Math.random() * (this.height-2)) + 1;
            if (this.grid[cy][cx] === 0 && (cx > 4 || cy > 4)) this.civilians.push(new Civilian(cx * CONFIG.TILE_SIZE + 32, cy * CONFIG.TILE_SIZE + 32));
            else i--;
        }
        timeRemaining = 90 + levelNum * 20;
    },
    spreadFire(tx, ty) {
        const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
        const dir = dirs[Math.floor(Math.random() * 4)];
        const nx = tx + dir[0];
        const ny = ty + dir[1];
        if (nx > 0 && nx < this.width-1 && ny > 0 && ny < this.height-1) {
            if (this.grid[ny][nx] === 0) {
                if (!this.fires.some(f => f.active && f.x === nx && f.y === ny)) {
                    this.fires.push(new Fire(nx, ny));
                    camera.shake(8, 0.2);
                }
            }
        }
    },
    update(dt) {
        this.fires.forEach(f => f.update(dt));
        this.civilians.forEach(c => c.update(dt));
        for(let i = this.particles.length-1; i>=0; i--) {
            this.particles[i].update(dt);
            if(this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
    },
    draw(ctx, camX, camY) {
        for(let y=0; y<this.height; y++) {
            for(let x=0; x<this.width; x++) {
                const px = x * CONFIG.TILE_SIZE - camX;
                const py = y * CONFIG.TILE_SIZE - camY;
                if (px < -CONFIG.TILE_SIZE || py < -CONFIG.TILE_SIZE || px > canvas.width || py > canvas.height) continue;
                if (this.grid[y][x] === 1) {
                    ctx.fillStyle = '#1c2833'; ctx.fillRect(px, py, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                } else if (this.grid[y][x] === 2) {
                    ctx.fillStyle = '#27ae60'; ctx.globalAlpha = 0.3; ctx.fillRect(px, py, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE); ctx.globalAlpha = 1;
                } else {
                    ctx.fillStyle = ((x+y)%2===0) ? '#2c3e50' : '#273746'; ctx.fillRect(px, py, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                }
            }
        }
        let drawables = [];
        this.fires.forEach(f => { if(f.active) drawables.push({y: f.y*CONFIG.TILE_SIZE, draw: ()=>f.draw(ctx, camX, camY)})});
        this.civilians.forEach(c => drawables.push({y: c.y, draw: ()=>c.draw(ctx, camX, camY)}));
        drawables.push({y: player.y, draw: ()=>player.draw(ctx, camX, camY)});
        drawables.sort((a,b) => a.y - b.y);
        drawables.forEach(d => d.draw());
        this.particles.forEach(p => p.draw(ctx, camX, camY));
    },
    drawLighting(ctx, camX, camY) {
        // Ambient smoke vignette
        const smokeGrad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.width/4, canvas.width/2, canvas.height/2, canvas.width);
        smokeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        smokeGrad.addColorStop(1, 'rgba(30,20,10,0.6)');
        ctx.fillStyle = smokeGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gradient = ctx.createRadialGradient(player.x - camX, player.y - camY, 60, player.x - camX, player.y - camY, 350);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.globalCompositeOperation = 'lighter';
        this.fires.forEach(f => {
            if(!f.active) return;
            const px = f.x * CONFIG.TILE_SIZE + 32 - camX;
            const py = f.y * CONFIG.TILE_SIZE + 32 - camY;
            if (px < -200 || py < -200 || px > canvas.width+200 || py > canvas.height+200) return;
            const g = ctx.createRadialGradient(px, py, 10, px, py, 150 + f.intensity);
            g.addColorStop(0, 'rgba(255, 140, 0, 0.5)');
            g.addColorStop(1, 'rgba(255, 40, 0, 0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(px, py, 150 + f.intensity, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
    }
};

let player;
let camera = new Camera();

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

function updateHUD() {
    ui.healthBar.style.width = `${Math.max(0, player.hp)}%`;
    ui.waterBar.style.width = `${Math.max(0, player.water)}%`;
    ui.levelDisplay.innerText = currentLevel;
    const min = Math.floor(Math.max(0, timeRemaining) / 60);
    const sec = Math.floor(Math.max(0, timeRemaining) % 60);
    ui.timeDisplay.innerText = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
    const activeFires = Level.fires.filter(f => f.active).length;
    ui.fireCount.innerText = activeFires;
    ui.rescueCount.innerText = `${Level.civiliansSaved}/${Level.totalCivilians}`;
}

function changeState(newState) {
    gameState = newState;
    Object.values(screens).forEach(s => { s.classList.add('hidden'); s.classList.remove('active'); });
    switch(newState) {
        case STATE.MENU: screens.mainMenu.classList.remove('hidden'); screens.mainMenu.classList.add('active'); break;
        case STATE.PLAYING: screens.hud.classList.remove('hidden'); screens.hud.classList.add('active'); break;
        case STATE.PAUSED: screens.pauseMenu.classList.remove('hidden'); screens.pauseMenu.classList.add('active'); break;
        case STATE.LEVEL_COMPLETE:
            screens.levelComplete.classList.remove('hidden'); screens.levelComplete.classList.add('active');
            document.getElementById('stat-time').innerText = ui.timeDisplay.innerText;
            document.getElementById('stat-rescued').innerText = Level.civiliansSaved;
            document.getElementById('stat-fires').innerText = Level.firesExtinguished;
            document.getElementById('stat-score').innerText = score;
            SOUNDS.levelUp(); break;
        case STATE.GAMEOVER: screens.gameOver.classList.remove('hidden'); screens.gameOver.classList.add('active'); SOUNDS.gameOver(); break;
    }
}

function gameOver(reason) { document.getElementById('fail-reason').innerText = reason; changeState(STATE.GAMEOVER); }

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;
    if (gameState === STATE.PLAYING) {
        player.update(dt); Level.update(dt); camera.follow(player, dt);
        timeRemaining -= dt;
        if (timeRemaining <= 0) gameOver("Time ran out! The building collapsed.");
        else if (player.hp <= 0) gameOver("You succumbed to the fire.");
        else if (Level.civiliansSaved === Level.totalCivilians && Level.fires.filter(f => f.active).length === 0) changeState(STATE.LEVEL_COMPLETE);
        updateHUD();
    }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (gameState !== STATE.MENU) { Level.draw(ctx, camera.x, camera.y); Level.drawLighting(ctx, camera.x, camera.y); }
    requestAnimationFrame(loop);
}

window.addEventListener('resize', resize); resize();

document.getElementById('btn-play').addEventListener('click', () => {
    if (zzfxX && zzfxX.state !== 'running') zzfxX.resume();
    currentLevel = 1; score = 0; Level.generate(currentLevel); changeState(STATE.PLAYING);
});
document.getElementById('btn-tutorial').addEventListener('click', () => { screens.mainMenu.classList.add('hidden'); screens.tutorial.classList.remove('hidden'); screens.tutorial.classList.add('active'); });
document.getElementById('btn-close-tutorial').addEventListener('click', () => { screens.tutorial.classList.add('hidden'); screens.mainMenu.classList.remove('hidden'); screens.mainMenu.classList.add('active'); });
document.getElementById('btn-pause').addEventListener('click', () => changeState(STATE.PAUSED));
document.getElementById('btn-resume').addEventListener('click', () => changeState(STATE.PLAYING));
document.getElementById('btn-toggle-sound').addEventListener('click', (e) => { soundEnabled = !soundEnabled; e.target.innerText = `SOUND: ${soundEnabled ? 'ON' : 'OFF'}`; });
document.getElementById('btn-quit').addEventListener('click', () => changeState(STATE.MENU));
document.getElementById('btn-next-level').addEventListener('click', () => { currentLevel++; if (currentLevel > CONFIG.MAX_LEVEL) { gameOver("CONGRATULATIONS! You completed all missions!"); } else { Level.generate(currentLevel); changeState(STATE.PLAYING); } });
document.getElementById('btn-retry').addEventListener('click', () => { score = 0; Level.generate(currentLevel); changeState(STATE.PLAYING); });
document.getElementById('btn-menu').addEventListener('click', () => changeState(STATE.MENU));

Input.init();
requestAnimationFrame(loop);
