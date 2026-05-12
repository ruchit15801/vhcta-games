// --- Game Configuration & State ---
const CONFIG = {
    fps: 60,
    playerSpeedWalk: 3.5,
    playerSpeedSneak: 1.5,
    guardSpeedPatrol: 1.5,
    guardSpeedChase: 3.5,
    visionRadius: 300,
    visionAngle: Math.PI / 2.5, // 72 degrees
    noiseWalkRadius: 150,
    noiseSneakRadius: 30,
    tileSize: 64,
};

const STATE = {
    screen: 'menu',
    mission: 1,
    audio: true,
    score: 0,
    isMobile: false,
    keys: {},
    joystick: { active: false, x: 0, y: 0 },
    gadgets: { smoke: 3, distraction: 2, emp: 1 },
    selectedGadget: 'smoke'
};

// --- DOM Elements ---
const UIElements = {
    menuScreen: document.getElementById('menuScreen'),
    guideScreen: document.getElementById('guideScreen'),
    pauseScreen: document.getElementById('pauseScreen'),
    gameOverScreen: document.getElementById('gameOverScreen'),
    victoryScreen: document.getElementById('victoryScreen'),
    hud: document.getElementById('hud'),
    detectionStatus: document.getElementById('detectionStatus'),
    detectionBar: document.getElementById('detectionBar'),
    objectiveText: document.getElementById('objectiveText'),
    missionNum: document.getElementById('missionNum'),
    smokeCount: document.getElementById('smokeCount'),
    distractCount: document.getElementById('distractCount'),
    btnSneak: document.getElementById('btnSneak')
};

// --- Canvas Setup ---
const floorCanvas = document.getElementById('floorCanvas');
const gameCanvas = document.getElementById('gameCanvas');
const lightCanvas = document.getElementById('lightCanvas');
const uiCanvas = document.getElementById('uiCanvas');

const floorCtx = floorCanvas.getContext('2d');
const gameCtx = gameCanvas.getContext('2d');
const lightCtx = lightCanvas.getContext('2d');
const uiCtx = uiCanvas.getContext('2d');

let cw, ch;
function resizeCanvases() {
    cw = window.innerWidth;
    ch = window.innerHeight;
    [floorCanvas, gameCanvas, lightCanvas, uiCanvas].forEach(c => {
        c.width = cw;
        c.height = ch;
    });
    STATE.isMobile = cw < 900;
}
window.addEventListener('resize', resizeCanvases);
resizeCanvases();

// --- Assets ---
const ASSETS = {
    images: {
        player: new Image(),
        guard: new Image(),
        floor: new Image()
    },
    loaded: 0,
    total: 3
};
ASSETS.images.player.src = 'assets/images/player.png';
ASSETS.images.guard.src = 'assets/images/guard.png';
ASSETS.images.floor.src = 'assets/images/floor.png';

Object.values(ASSETS.images).forEach(img => {
    img.onload = () => ASSETS.loaded++;
});

// --- Audio System ---
const AudioSys = {
    ctx: new (window.AudioContext || window.webkitAudioContext)(),
    playTone: function(freq, type, duration, vol=0.1) {
        if (!STATE.audio) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    step: () => AudioSys.playTone(150, 'triangle', 0.1, 0.05),
    alert: () => AudioSys.playTone(800, 'sawtooth', 0.5, 0.2),
    smoke: () => AudioSys.playTone(100, 'noise', 1.0, 0.3)
};

// --- Math Utilities ---
function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
}

function lineIntersectRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    const lines = [
        [rx, ry, rx+rw, ry],
        [rx+rw, ry, rx+rw, ry+rh],
        [rx+rw, ry+rh, rx, ry+rh],
        [rx, ry+rh, rx, ry]
    ];
    for (let l of lines) {
        if (linesIntersect(x1, y1, x2, y2, l[0], l[1], l[2], l[3])) return true;
    }
    if (x1 >= rx && x1 <= rx+rw && y1 >= ry && y1 <= ry+rh) return true;
    return false;
}

function linesIntersect(a,b,c,d,p,q,r,s) {
    let det, gamma, lambda;
    det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) return false;
    lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
    gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

function raycast(x, y, angle, maxDist, walls) {
    let minT = 1;
    let endX = x + Math.cos(angle) * maxDist;
    let endY = y + Math.sin(angle) * maxDist;
    
    // Very simple optimization: only check walls nearby
    for (let w of walls) {
        let rx = w.x, ry = w.y, rw = w.width, rh = w.height;
        const lines = [
            [rx, ry, rx+rw, ry],
            [rx+rw, ry, rx+rw, ry+rh],
            [rx+rw, ry+rh, rx, ry+rh],
            [rx, ry+rh, rx, ry]
        ];
        for (let l of lines) {
            let p = x, q = y, r = endX, s = endY;
            let a = l[0], b = l[1], c = l[2], d = l[3];
            let det = (c - a) * (s - q) - (r - p) * (d - b);
            if (det !== 0) {
                let lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
                let gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
                if ((0 < lambda && lambda < 1) && (0 < gamma && gamma < minT)) {
                    minT = gamma;
                }
            }
        }
    }
    return {
        x: x + Math.cos(angle) * (maxDist * minT),
        y: y + Math.sin(angle) * (maxDist * minT),
        dist: maxDist * minT
    };
}

// --- Effects Entities ---
class Particle {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.life = 1.0;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * 2 + 1;
        this.radius = Math.random() * 3 + 2;
        if(type === 'smoke') {
            this.speed = Math.random() * 4 + 2;
            this.radius = Math.random() * 10 + 10;
        }
    }
    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.speed *= 0.95; // friction
        if(this.type === 'smoke') {
            this.radius += 1.5;
            this.life -= 0.015;
        } else if (this.type === 'spark') {
            this.life -= 0.05;
        } else {
            this.life -= 0.02;
        }
        return this.life > 0;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        if (this.type === 'smoke') {
            let grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
            grad.addColorStop(0, 'rgba(150,150,150,0.8)');
            grad.addColorStop(1, 'rgba(150,150,150,0)');
            ctx.fillStyle = grad;
        } else if (this.type === 'spark') {
            ctx.fillStyle = '#00e5ff';
        } else if (this.type === 'footprint') {
            ctx.fillStyle = 'rgba(0,255,136,0.3)';
        }
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class Footprint {
    constructor(x, y, angle) {
        this.x = x; this.y = y; this.angle = angle; this.life = 1.0;
    }
    update() {
        this.life -= 0.01;
        return this.life > 0;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = Math.max(0, this.life * 0.3);
        ctx.fillStyle = '#00ff88';
        ctx.beginPath(); ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class Ripple {
    constructor(x, y, maxR) {
        this.x = x; this.y = y; this.radius = 0; this.maxRadius = maxR; this.alpha = 1;
    }
    update() {
        this.radius += 4;
        this.alpha = 1 - (this.radius / this.maxRadius);
        return this.alpha > 0;
    }
    draw(ctx) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, this.alpha * 0.6)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.stroke();
    }
}

// --- Game Engine Entities ---
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 18;
        this.angle = 0;
        this.targetAngle = 0;
        this.isSneaking = false;
        this.speed = 0;
        this.detection = 0; // 0 to 100
        this.stepTimer = 0;
        this.footToggle = false;
    }
    
    update(walls) {
        let dx = 0, dy = 0;
        
        if (STATE.isMobile && STATE.joystick.active) {
            dx = STATE.joystick.x;
            dy = STATE.joystick.y;
        } else {
            if (STATE.keys['ArrowUp'] || STATE.keys['w']) dy -= 1;
            if (STATE.keys['ArrowDown'] || STATE.keys['s']) dy += 1;
            if (STATE.keys['ArrowLeft'] || STATE.keys['a']) dx -= 1;
            if (STATE.keys['ArrowRight'] || STATE.keys['d']) dx += 1;
        }

        const len = Math.sqrt(dx*dx + dy*dy);
        if (len > 0) {
            dx /= len; dy /= len;
            this.targetAngle = Math.atan2(dy, dx);
            
            this.isSneaking = (STATE.keys['Shift'] || (document.getElementById('btn-sneak') && document.getElementById('btn-sneak').classList.contains('active')));
            const moveSpeed = this.isSneaking ? CONFIG.playerSpeedSneak : CONFIG.playerSpeedWalk;
            
            this.speed = moveSpeed * (STATE.isMobile && len < 1 ? len : 1);
            
            // Move with sliding collision
            this.move(dx * this.speed, dy * this.speed, walls);

            // Footsteps
            this.stepTimer += this.speed;
            if (this.stepTimer > 25) {
                this.stepTimer = 0;
                this.footToggle = !this.footToggle;
                let perpX = Math.cos(this.targetAngle + Math.PI/2) * (this.footToggle ? 8 : -8);
                let perpY = Math.sin(this.targetAngle + Math.PI/2) * (this.footToggle ? 8 : -8);
                
                Game.footprints.push(new Footprint(this.x + perpX, this.y + perpY, this.targetAngle));

                if (!this.isSneaking) {
                    AudioSys.step();
                    Game.ripples.push(new Ripple(this.x, this.y, CONFIG.noiseWalkRadius));
                    Game.guards.forEach(g => {
                        if (Math.hypot(g.x - this.x, g.y - this.y) < CONFIG.noiseWalkRadius) {
                            g.investigate(this.x, this.y);
                        }
                    });
                }
            }
        } else {
            this.speed = 0;
        }

        // Smooth rotation
        this.angle = lerpAngle(this.angle, this.targetAngle, 0.2);

        // Decay detection
        this.detection -= 0.3;
        if (this.detection < 0) this.detection = 0;
        
        this.updateHUD();
        
        if (this.detection >= 100) {
            Game.triggerGameOver();
        }
    }

    move(dx, dy, walls) {
        let newX = this.x + dx;
        let newY = this.y + dy;
        
        // Sliding collision response
        for (let w of walls) {
            let closeX = Math.max(w.x, Math.min(newX, w.x + w.width));
            let closeY = Math.max(w.y, Math.min(newY, w.y + w.height));
            let dist = Math.hypot(newX - closeX, this.y - closeY);
            if (dist < this.radius) newX = this.x; // Block X
            
            dist = Math.hypot(this.x - closeX, newY - closeY);
            if (dist < this.radius) newY = this.y; // Block Y
        }
        
        newX = Math.max(this.radius, Math.min(Game.mapWidth - this.radius, newX));
        newY = Math.max(this.radius, Math.min(Game.mapHeight - this.radius, newY));
        
        this.x = newX;
        this.y = newY;
    }

    updateHUD() {
        UIElements.detectionBar.style.width = Math.min(100, this.detection) + '%';
        if (this.detection > 75) {
            UIElements.detectionBar.style.background = 'var(--neon-red)';
            UIElements.detectionStatus.innerText = 'DANGER';
            UIElements.detectionStatus.style.color = 'var(--neon-red)';
            UIElements.hud.style.boxShadow = 'inset 0 0 50px rgba(255,0,0,0.2)';
        } else if (this.detection > 0) {
            UIElements.detectionBar.style.background = 'yellow';
            UIElements.detectionStatus.innerText = 'SUSPICIOUS';
            UIElements.detectionStatus.style.color = 'yellow';
            UIElements.hud.style.boxShadow = 'inset 0 0 30px rgba(255,255,0,0.1)';
        } else {
            UIElements.detectionBar.style.background = 'var(--neon-green)';
            UIElements.detectionStatus.innerText = 'HIDDEN';
            UIElements.detectionStatus.style.color = 'var(--neon-green)';
            UIElements.hud.style.boxShadow = 'none';
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI/2); 
        if (ASSETS.loaded >= 3) {
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 15;
            ctx.drawImage(ASSETS.images.player, -32, -32, 64, 64);
        } else {
            ctx.fillStyle = '#00ff88';
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
}

class Guard {
    constructor(x, y, path) {
        this.x = x; this.y = y; this.radius = 18;
        this.angle = 0; this.targetAngle = 0;
        this.path = path || []; this.pathIndex = 0;
        this.state = 'patrol'; 
        this.target = null;
        this.waitTimer = 0;
        this.stunTimer = 0;
    }

    update() {
        if (this.stunTimer > 0) {
            this.stunTimer--;
            // Emit sparks
            if(Math.random() > 0.7) {
                Game.particles.push(new Particle(this.x + (Math.random()-0.5)*20, this.y + (Math.random()-0.5)*20, 'spark'));
            }
            return;
        }

        // Smoke blind check
        let blinded = false;
        for (let p of Game.particles) {
            if (p.type === 'smoke' && Math.hypot(this.x - p.x, this.y - p.y) < p.radius) {
                blinded = true;
                break;
            }
        }

        if (!blinded) {
            this.checkVision();
        }

        if (this.state === 'patrol') {
            if (this.path.length > 0) {
                if (this.waitTimer > 0) {
                    this.waitTimer--;
                } else {
                    let dest = this.path[this.pathIndex];
                    let dx = dest.x - this.x;
                    let dy = dest.y - this.y;
                    let dist = Math.hypot(dx, dy);
                    
                    if (dist < 5) {
                        this.pathIndex = (this.pathIndex + 1) % this.path.length;
                        this.waitTimer = 120; // wait 2 sec
                    } else {
                        this.targetAngle = Math.atan2(dy, dx);
                        this.x += Math.cos(this.targetAngle) * CONFIG.guardSpeedPatrol;
                        this.y += Math.sin(this.targetAngle) * CONFIG.guardSpeedPatrol;
                    }
                }
            }
        } else if (this.state === 'investigate') {
            if (this.target) {
                let dx = this.target.x - this.x;
                let dy = this.target.y - this.y;
                let dist = Math.hypot(dx, dy);
                if (dist < 10) {
                    this.waitTimer = 180;
                    this.target = null;
                } else {
                    this.targetAngle = Math.atan2(dy, dx);
                    this.x += Math.cos(this.targetAngle) * CONFIG.guardSpeedPatrol;
                    this.y += Math.sin(this.targetAngle) * CONFIG.guardSpeedPatrol;
                }
            } else {
                if (this.waitTimer > 0) {
                    this.waitTimer--;
                    this.targetAngle += 0.03; // look around smoothly
                } else {
                    this.state = 'patrol';
                }
            }
        } else if (this.state === 'chase') {
            let dx = Game.player.x - this.x;
            let dy = Game.player.y - this.y;
            this.targetAngle = Math.atan2(dy, dx);
            this.x += Math.cos(this.targetAngle) * CONFIG.guardSpeedChase;
            this.y += Math.sin(this.targetAngle) * CONFIG.guardSpeedChase;
            
            if (Math.hypot(dx, dy) > CONFIG.visionRadius * 1.5) {
                this.investigate(Game.player.x, Game.player.y);
            }
        }

        this.angle = lerpAngle(this.angle, this.targetAngle, 0.15);
    }

    investigate(x, y) {
        if (this.state === 'chase') return;
        this.state = 'investigate';
        this.target = {x, y};
    }

    checkVision() {
        let p = Game.player;
        let dx = p.x - this.x;
        let dy = p.y - this.y;
        let dist = Math.hypot(dx, dy);
        
        if (dist < CONFIG.visionRadius) {
            let angleToPlayer = Math.atan2(dy, dx);
            let angleDiff = Math.abs(this.angle - angleToPlayer);
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            if (Math.abs(angleDiff) < CONFIG.visionAngle / 2) {
                if (!Game.checkLineCollision(this.x, this.y, p.x, p.y)) {
                    if (this.state !== 'chase') {
                        AudioSys.alert();
                        Game.ripples.push(new Ripple(this.x, this.y, 100)); // Visual alert
                    }
                    this.state = 'chase';
                    let detectionPower = ((CONFIG.visionRadius - dist) / CONFIG.visionRadius) * 3;
                    p.detection += detectionPower;
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI/2);
        if (ASSETS.loaded >= 3) {
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 15;
            ctx.drawImage(ASSETS.images.guard, -32, -32, 64, 64);
        } else {
            ctx.fillStyle = this.state === 'chase' ? '#ff003c' : '#ff8800';
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI*2); ctx.fill();
        }
        
        if (this.stunTimer > 0) {
            ctx.rotate(-(this.angle + Math.PI/2));
            ctx.fillStyle = '#00e5ff'; ctx.font = '20px Arial'; ctx.fillText('STUNNED', -40, -30);
        } else if (this.state === 'investigate') {
            ctx.rotate(-(this.angle + Math.PI/2));
            ctx.fillStyle = 'yellow'; ctx.font = '24px Arial'; ctx.fillText('?', -8, -30);
        } else if (this.state === 'chase') {
            ctx.rotate(-(this.angle + Math.PI/2));
            ctx.fillStyle = '#ff003c'; ctx.font = '24px Arial'; ctx.fillText('!', -4, -30);
        }
        ctx.restore();
    }
}

class Wall {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.width = w; this.height = h;
    }
    draw(ctx) {
        // High quality glass/cyber wall look
        ctx.fillStyle = '#0c1017';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        let grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        grad.addColorStop(0, 'rgba(0, 255, 136, 0.2)');
        grad.addColorStop(1, 'rgba(0, 255, 136, 0.05)');
        
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // Inner glow line
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
        ctx.strokeRect(this.x+2, this.y+2, this.width-4, this.height-4);
    }
}

// --- Main Game Object ---
const Game = {
    mapWidth: 2400,
    mapHeight: 1800,
    player: null,
    guards: [],
    walls: [],
    ripples: [],
    particles: [],
    footprints: [],
    camera: { x: 0, y: 0 },
    targetPoint: null,

    initLevel() {
        this.guards = [];
        this.walls = [];
        this.ripples = [];
        this.particles = [];
        this.footprints = [];
        STATE.gadgets = { smoke: 3, distraction: 2 };
        UIElements.smokeCount.innerText = '3';
        UIElements.distractCount.innerText = '2';
        
        this.walls.push(new Wall(-20, -20, this.mapWidth+40, 20));
        this.walls.push(new Wall(-20, this.mapHeight, this.mapWidth+40, 20));
        this.walls.push(new Wall(-20, 0, 20, this.mapHeight));
        this.walls.push(new Wall(this.mapWidth, 0, 20, this.mapHeight));

        if (STATE.mission === 1) {
            this.player = new Player(150, 150);
            this.targetPoint = {x: 2100, y: 1600, radius: 50};
            
            this.walls.push(new Wall(500, 0, 40, 800));
            this.walls.push(new Wall(500, 1100, 40, 700));
            this.walls.push(new Wall(540, 500, 800, 40));
            this.walls.push(new Wall(1000, 1000, 800, 40));
            this.walls.push(new Wall(1800, 200, 40, 800));
            
            this.guards.push(new Guard(700, 300, [{x:700, y:300}, {x:1200, y:300}]));
            this.guards.push(new Guard(1400, 800, [{x:1400, y:800}, {x:1400, y:200}]));
            this.guards.push(new Guard(800, 1400, [{x:800, y:1400}, {x:1600, y:1400}]));
        } else {
            this.player = new Player(150, 150);
            this.targetPoint = {x: this.mapWidth - 200, y: this.mapHeight - 200, radius: 50};
            
            let numWalls = 15 + STATE.mission;
            for(let i=0; i<numWalls; i++) {
                let w = Math.random() > 0.5 ? (Math.random()*400+200) : 40;
                let h = w === 40 ? (Math.random()*400+200) : 40;
                let x = Math.random() * (this.mapWidth - 600) + 200;
                let y = Math.random() * (this.mapHeight - 600) + 200;
                this.walls.push(new Wall(x, y, w, h));
            }
            
            let numGuards = 3 + STATE.mission;
            for(let i=0; i<numGuards; i++) {
                let gx = Math.random() * (this.mapWidth - 400) + 200;
                let gy = Math.random() * (this.mapHeight - 400) + 200;
                let px = gx + (Math.random()-0.5)*500;
                let py = gy + (Math.random()-0.5)*500;
                this.guards.push(new Guard(gx, gy, [{x:gx, y:gy}, {x:px, y:py}]));
            }
        }
        
        UIElements.missionNum.innerText = STATE.mission;
        UIElements.objectiveText.innerText = 'REACH EXTRACTION POINT';
        STATE.score = 0;
    },

    checkLineCollision(x1, y1, x2, y2) {
        for (let w of this.walls) {
            if (lineIntersectRect(x1, y1, x2, y2, w.x, w.y, w.width, w.height)) return true;
        }
        return false;
    },

    update() {
        if (STATE.screen !== 'game') return;

        this.player.update(this.walls);
        this.guards.forEach(g => g.update());
        
        this.ripples = this.ripples.filter(r => r.update());
        this.particles = this.particles.filter(p => p.update());
        this.footprints = this.footprints.filter(f => f.update());

        // Ambient particles
        if(Math.random() > 0.8) {
            this.particles.push(new Particle(
                this.camera.x + Math.random()*cw, 
                this.camera.y + Math.random()*ch, 
                'ambient'
            ));
        }

        let dx = this.player.x - this.targetPoint.x;
        let dy = this.player.y - this.targetPoint.y;
        if (Math.hypot(dx, dy) < this.targetPoint.radius) {
            this.triggerVictory();
        }

        // Smooth Camera Follow
        let targetCamX = this.player.x - cw / 2;
        let targetCamY = this.player.y - ch / 2;
        this.camera.x += (targetCamX - this.camera.x) * 0.1;
        this.camera.y += (targetCamY - this.camera.y) * 0.1;
        
        this.camera.x = Math.max(0, Math.min(this.mapWidth - cw, this.camera.x));
        this.camera.y = Math.max(0, Math.min(this.mapHeight - ch, this.camera.y));
    },

    draw() {
        if (STATE.screen !== 'game') return;

        gameCtx.clearRect(0, 0, cw, ch);
        lightCtx.clearRect(0, 0, cw, ch);
        
        // Floor
        if (ASSETS.loaded >= 3) {
            let pat = floorCtx.createPattern(ASSETS.images.floor, 'repeat');
            floorCtx.fillStyle = pat;
            floorCtx.save();
            floorCtx.translate(-this.camera.x, -this.camera.y);
            floorCtx.fillRect(this.camera.x, this.camera.y, cw, ch);
            floorCtx.restore();
        } else {
            floorCtx.fillStyle = '#0a0d14';
            floorCtx.fillRect(0, 0, cw, ch);
        }

        // --- Game Canvas ---
        gameCtx.save();
        gameCtx.translate(-this.camera.x, -this.camera.y);

        this.footprints.forEach(f => f.draw(gameCtx));

        // Extraction point
        gameCtx.fillStyle = 'rgba(0, 229, 255, 0.2)';
        gameCtx.beginPath(); gameCtx.arc(this.targetPoint.x, this.targetPoint.y, this.targetPoint.radius, 0, Math.PI*2); gameCtx.fill();
        gameCtx.strokeStyle = 'var(--neon-blue)'; gameCtx.lineWidth=2; gameCtx.stroke();
        gameCtx.fillStyle = '#fff'; gameCtx.font = '20px Rajdhani'; gameCtx.fillText('EXTRACTION', this.targetPoint.x - 45, this.targetPoint.y + 5);

        this.walls.forEach(w => w.draw(gameCtx));
        this.ripples.forEach(r => r.draw(gameCtx));
        
        // Guard Vision Cones (Colored, drawn underneath characters)
        gameCtx.globalCompositeOperation = 'screen';
        this.guards.forEach(g => {
            if(g.stunTimer > 0) return;
            
            let color = 'rgba(255, 255, 255, 0.08)';
            if(g.state === 'chase') color = 'rgba(255, 0, 50, 0.2)';
            if(g.state === 'investigate') color = 'rgba(255, 200, 0, 0.15)';
            
            gameCtx.fillStyle = color;
            gameCtx.beginPath();
            gameCtx.moveTo(g.x, g.y);
            
            // Raycast vision cone for smooth clipping
            let steps = 20;
            let startAngle = g.angle - CONFIG.visionAngle/2;
            let stepAngle = CONFIG.visionAngle / steps;
            
            for(let i=0; i<=steps; i++) {
                let a = startAngle + i * stepAngle;
                let hit = raycast(g.x, g.y, a, CONFIG.visionRadius, this.walls);
                gameCtx.lineTo(hit.x, hit.y);
            }
            gameCtx.lineTo(g.x, g.y);
            gameCtx.fill();
        });
        gameCtx.globalCompositeOperation = 'source-over';

        this.guards.forEach(g => g.draw(gameCtx));
        this.player.draw(gameCtx);
        this.particles.forEach(p => p.draw(gameCtx));

        gameCtx.restore();

        // --- Lighting Canvas (Darkness overlay) ---
        lightCtx.fillStyle = 'rgba(5, 7, 10, 0.95)';
        lightCtx.fillRect(0, 0, cw, ch);
        
        lightCtx.save();
        lightCtx.translate(-this.camera.x, -this.camera.y);
        lightCtx.globalCompositeOperation = 'destination-out';

        // Player Light
        let pGrad = lightCtx.createRadialGradient(this.player.x, this.player.y, 0, this.player.x, this.player.y, 250);
        pGrad.addColorStop(0, 'rgba(255,255,255,1)');
        pGrad.addColorStop(1, 'rgba(255,255,255,0)');
        lightCtx.fillStyle = pGrad;
        lightCtx.beginPath(); lightCtx.arc(this.player.x, this.player.y, 250, 0, Math.PI*2); lightCtx.fill();

        // Guard Light Cutouts
        this.guards.forEach(g => {
            if(g.stunTimer > 0) return;
            lightCtx.beginPath();
            lightCtx.moveTo(g.x, g.y);
            let steps = 20;
            let startAngle = g.angle - CONFIG.visionAngle/2;
            let stepAngle = CONFIG.visionAngle / steps;
            for(let i=0; i<=steps; i++) {
                let a = startAngle + i * stepAngle;
                let hit = raycast(g.x, g.y, a, CONFIG.visionRadius, this.walls);
                lightCtx.lineTo(hit.x, hit.y);
            }
            lightCtx.lineTo(g.x, g.y);
            
            let vGrad = lightCtx.createRadialGradient(g.x, g.y, 0, g.x, g.y, CONFIG.visionRadius);
            vGrad.addColorStop(0, 'rgba(255,255,255,0.8)');
            vGrad.addColorStop(1, 'rgba(255,255,255,0)');
            lightCtx.fillStyle = vGrad;
            lightCtx.fill();
        });

        // Extraction point glow
        let eGrad = lightCtx.createRadialGradient(this.targetPoint.x, this.targetPoint.y, 0, this.targetPoint.x, this.targetPoint.y, 150);
        eGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
        eGrad.addColorStop(1, 'rgba(255,255,255,0)');
        lightCtx.fillStyle = eGrad;
        lightCtx.beginPath(); lightCtx.arc(this.targetPoint.x, this.targetPoint.y, 150, 0, Math.PI*2); lightCtx.fill();

        lightCtx.restore();
    },

    useGadget(type) {
        if (STATE.gadgets[type] > 0) {
            STATE.gadgets[type]--;
            if (type === 'smoke') {
                UIElements.smokeCount.innerText = STATE.gadgets[type];
                AudioSys.smoke();
                for(let i=0; i<30; i++) {
                    this.particles.push(new Particle(this.player.x, this.player.y, 'smoke'));
                }
            } else if (type === 'distraction') {
                UIElements.distractCount.innerText = STATE.gadgets[type];
                let tx = this.player.x + Math.cos(this.player.angle) * 150;
                let ty = this.player.y + Math.sin(this.player.angle) * 150;
                this.ripples.push(new Ripple(tx, ty, 400));
                AudioSys.step(); 
                this.guards.forEach(g => {
                    if (Math.hypot(g.x - tx, g.y - ty) < 400) {
                        g.investigate(tx, ty);
                    }
                });
            }
        }
    },

    triggerGameOver() {
        STATE.screen = 'gameover';
        switchScreen('gameOverScreen');
    },

    triggerVictory() {
        STATE.screen = 'victory';
        STATE.mission++;
        switchScreen('victoryScreen');
    }
};

// --- Input & Screen Management ---
function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
        el.classList.remove('hidden');
    }
    
    if (id === null || id === '') {
        UIElements.hud.classList.remove('hidden');
    } else {
        UIElements.hud.classList.add('hidden');
    }
}

window.addEventListener('keydown', e => {
    STATE.keys[e.key] = true;
    if (e.key === '1') Game.useGadget('smoke');
    if (e.key === '2') Game.useGadget('distraction');
    if (e.key === 'Escape' && STATE.screen === 'game') {
        STATE.screen = 'pause';
        switchScreen('pauseScreen');
    }
});
window.addEventListener('keyup', e => { STATE.keys[e.key] = false; });

document.getElementById('btn-start').addEventListener('click', () => {
    Game.initLevel(); STATE.screen = 'game'; switchScreen(''); AudioSys.ctx.resume();
});
document.getElementById('btn-guide').addEventListener('click', () => switchScreen('guideScreen'));
document.getElementById('btn-close-guide').addEventListener('click', () => switchScreen('menuScreen'));
document.getElementById('btn-pause').addEventListener('click', () => { STATE.screen = 'pause'; switchScreen('pauseScreen'); });
document.getElementById('btn-resume').addEventListener('click', () => { STATE.screen = 'game'; switchScreen(''); });
document.getElementById('btn-restart').addEventListener('click', () => { Game.initLevel(); STATE.screen = 'game'; switchScreen(''); });
document.getElementById('btn-quit').addEventListener('click', () => { STATE.screen = 'menu'; switchScreen('menuScreen'); });
document.getElementById('btn-retry').addEventListener('click', () => { Game.initLevel(); STATE.screen = 'game'; switchScreen(''); });
document.getElementById('btn-menu').addEventListener('click', () => { STATE.screen = 'menu'; switchScreen('menuScreen'); });
document.getElementById('btn-next-mission').addEventListener('click', () => { Game.initLevel(); STATE.screen = 'game'; switchScreen(''); });
document.getElementById('soundToggle').addEventListener('change', e => { STATE.audio = e.target.checked; });

const btnSneak = document.getElementById('btn-sneak');
if (btnSneak) {
    btnSneak.addEventListener('touchstart', (e) => { e.preventDefault(); btnSneak.classList.add('active'); STATE.keys['Shift'] = true; });
    btnSneak.addEventListener('touchend', (e) => { e.preventDefault(); btnSneak.classList.remove('active'); STATE.keys['Shift'] = false; });
}

document.querySelectorAll('.gadget-slot').forEach(slot => {
    slot.addEventListener('click', () => Game.useGadget(slot.dataset.gadget));
});

const joyArea = document.getElementById('joystick-area');
const joyStick = document.getElementById('joystick-stick');
if (joyArea && joyStick) {
    joyArea.addEventListener('touchstart', e => { e.preventDefault(); STATE.joystick.active = true; updateJoystick(e.touches[0]); });
    joyArea.addEventListener('touchmove', e => { e.preventDefault(); if(STATE.joystick.active) updateJoystick(e.touches[0]); });
    joyArea.addEventListener('touchend', e => {
        e.preventDefault(); STATE.joystick.active = false;
        joyStick.style.transform = `translate(0px, 0px)`;
        STATE.joystick.x = 0; STATE.joystick.y = 0;
    });

    function updateJoystick(touch) {
        let rect = joyArea.getBoundingClientRect();
        let dx = touch.clientX - (rect.left + rect.width/2);
        let dy = touch.clientY - (rect.top + rect.height/2);
        let dist = Math.hypot(dx, dy);
        let maxDist = 40;
        if (dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
        joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
        STATE.joystick.x = dx / maxDist;
        STATE.joystick.y = dy / maxDist;
    }
}

// --- Main Loop ---
let lastTime = 0;
function loop(timestamp) {
    let dt = timestamp - lastTime;
    if (dt > 1000 / CONFIG.fps) {
        Game.update();
        Game.draw();
        lastTime = timestamp;
    }
    requestAnimationFrame(loop);
}

switchScreen('menuScreen');
requestAnimationFrame(loop);
