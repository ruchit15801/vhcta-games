/**
 * Pirate Ship Battle - Core Game Engine
 * Hyper-Realistic Procedural Graphics Edition v2
 */

function loadImages() {
    return Promise.resolve();
}

// --- 0. PROCEDURAL TEXTURES ---
const woodCanvas = document.createElement('canvas');
woodCanvas.width = 128;
woodCanvas.height = 128;
const wctx = woodCanvas.getContext('2d');
wctx.fillStyle = '#3e2723';
wctx.fillRect(0,0,128,128);
// Wood grain
for(let i=0; i<800; i++) {
    wctx.fillStyle = `rgba(20, 10, 5, ${Math.random()*0.2})`;
    wctx.fillRect(Math.random()*128, Math.random()*128, Math.random()*30+10, 1);
}
for(let i=0; i<15; i++) {
    wctx.strokeStyle = `rgba(0, 0, 0, 0.3)`;
    wctx.lineWidth = 1;
    wctx.beginPath();
    let y = Math.random()*128;
    wctx.moveTo(0, y);
    wctx.bezierCurveTo(40, y + (Math.random()*20-10), 80, y + (Math.random()*20-10), 128, y);
    wctx.stroke();
}
let woodPattern = null; // Will be created after ctx is available

// --- 2. AUDIO SYSTEM (Web Audio API Synthesizer) ---
const AudioSys = {
    ctx: null,
    init() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.startOceanAmbient();
    },
    playCannon() {
        if(!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.6);
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.6);
    },
    playExplosion() {
        if(!this.ctx) return;
        const t = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 1.5; 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; 
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(50, t + 1.5);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(1.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);
    },
    playSplash() {
        if(!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.4);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
    },
    startOceanAmbient() {
        if(!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 5.0; 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.1; 
        }
        this.oceanNoise = this.ctx.createBufferSource();
        this.oceanNoise.buffer = buffer;
        this.oceanNoise.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 350; 
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.15; 
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 250;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();
        const gain = this.ctx.createGain();
        gain.gain.value = 0.4;
        this.oceanNoise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        this.oceanNoise.start();
    }
};

// --- 3. UTILITIES & MATH ---
const MathUtils = {
    distance: (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y),
    angle: (p1, p2) => Math.atan2(p2.y - p1.y, p2.x - p1.x),
    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
    rand: (min, max) => Math.random() * (max - min) + min,
    normalizeAngle: (angle) => {
        let a = angle % (Math.PI * 2);
        if (a < -Math.PI) a += Math.PI * 2;
        if (a > Math.PI) a -= Math.PI * 2;
        return a;
    }
};

// --- 4. GAME ENGINE & STATE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const minimapCanvas = document.getElementById('minimapCanvas');
const mctx = minimapCanvas.getContext('2d');
woodPattern = ctx.createPattern(woodCanvas, 'repeat');

let cw, ch;
function resize() {
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width = cw;
    canvas.height = ch;
}
window.addEventListener('resize', resize);
resize();

const Game = {
    state: 'START',
    lastTime: 0,
    camera: { x: 0, y: 0, targetZoom: 1, zoom: 1 },
    worldSize: 4000,
    score: 0,
    level: 1,
    kills: 0,
    particles: [],
    cannonballs: [],
    enemies: [],
    floatingTexts: [],
    weather: { active: false, type: 'fog', intensity: 0 },
    waterOffset: 0,
    init() {
        this.player = new Player(this.worldSize/2, this.worldSize/2);
        this.resetLevel();
        requestAnimationFrame(t => this.loop(t));
    },
    resetLevel() {
        this.enemies = [];
        this.cannonballs = [];
        this.particles = [];
        this.spawnWave();
        document.getElementById('level-display').innerText = `LEVEL ${this.level}`;
        
        if(this.level > 3 && Math.random() > 0.5) {
            this.weather.active = true;
            this.weather.type = Math.random() > 0.5 ? 'fog' : 'storm';
            this.weather.intensity = Math.min(1, this.level * 0.1);
        } else {
            this.weather.active = false;
        }
    },
    spawnWave() {
        let count = 2 + Math.floor(this.level * 0.5);
        for(let i=0; i<count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let dist = MathUtils.rand(800, 1500);
            let x = this.player.x + Math.cos(angle) * dist;
            let y = this.player.y + Math.sin(angle) * dist;
            
            x = MathUtils.clamp(x, 100, this.worldSize - 100);
            y = MathUtils.clamp(y, 100, this.worldSize - 100);

            let type = 'basic';
            if(this.level >= 4 && Math.random() < 0.3) type = 'fast';
            if(this.level >= 7 && Math.random() < 0.2) type = 'heavy';
            if(this.level % 5 === 0 && i === 0) type = 'boss';

            this.enemies.push(new Enemy(x, y, type));
        }
    },
    screenShake: 0,
    addShake(amount) {
        this.screenShake = Math.min(this.screenShake + amount, 40);
    },
    update(dt) {
        if(this.state !== 'PLAYING') return;

        this.waterOffset += dt * 0.05;
        if(this.screenShake > 0) this.screenShake *= 0.9;

        this.player.update(dt);
        
        this.camera.x = MathUtils.lerp(this.camera.x, this.player.x - cw/2, 0.1);
        this.camera.y = MathUtils.lerp(this.camera.y, this.player.y - ch/2, 0.1);
        this.camera.x = MathUtils.clamp(this.camera.x, 0, this.worldSize - cw);
        this.camera.y = MathUtils.clamp(this.camera.y, 0, this.worldSize - ch);

        let speedRatio = Math.hypot(this.player.vx, this.player.vy) / this.player.maxSpeed;
        this.camera.targetZoom = 1 - (speedRatio * 0.15);
        this.camera.zoom = MathUtils.lerp(this.camera.zoom, this.camera.targetZoom, 0.05);

        for(let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            e.update(dt);
            if(e.hp <= 0) {
                this.score += e.scoreValue;
                this.kills++;
                document.getElementById('score-display').innerText = this.score;
                this.spawnExplosion(e.x, e.y, e.type === 'boss' ? 120 : 50, true);
                this.enemies.splice(i, 1);
                
                if(this.enemies.length === 0) {
                    setTimeout(() => this.levelComplete(), 2000);
                }
            }
        }

        for(let i = this.cannonballs.length - 1; i >= 0; i--) {
            let cb = this.cannonballs[i];
            cb.update(dt);
            if(cb.life <= 0) {
                this.spawnSplash(cb.x, cb.y);
                this.cannonballs.splice(i, 1);
                continue;
            }
            if(cb.owner === 'player') {
                for(let e of this.enemies) {
                    if(MathUtils.distance(cb, e) < e.radius) {
                        e.takeDamage(cb.damage);
                        this.spawnExplosion(cb.x, cb.y, 15);
                        this.cannonballs.splice(i, 1);
                        break;
                    }
                }
            } else {
                if(MathUtils.distance(cb, this.player) < this.player.radius) {
                    this.player.takeDamage(cb.damage);
                    this.spawnExplosion(cb.x, cb.y, 20);
                    this.cannonballs.splice(i, 1);
                }
            }
        }

        for(let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if(this.particles[i].life <= 0) this.particles.splice(i, 1);
        }

        for(let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if(this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1);
        }

        if(this.player.hp <= 0 && this.state === 'PLAYING') {
            this.gameOver();
        }
    },
    draw() {
        // Deep realistic ocean background
        ctx.fillStyle = '#020b17';
        ctx.fillRect(0, 0, cw, ch);

        ctx.save();
        
        if(this.screenShake > 0.5) {
            let sx = (Math.random()-0.5) * this.screenShake;
            let sy = (Math.random()-0.5) * this.screenShake;
            ctx.translate(sx, sy);
        }

        ctx.translate(cw/2, ch/2);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-cw/2, -ch/2);
        ctx.translate(-this.camera.x, -this.camera.y);

        // --- HYPER-REALISTIC PROCEDURAL WATER ---
        let time = this.waterOffset * 0.05;
        let startX = Math.floor(this.camera.x / 400) * 400;
        let startY = Math.floor(this.camera.y / 200) * 200;
        
        for(let y = startY - 200; y < this.camera.y + ch/this.camera.zoom + 200; y += 50) {
            ctx.beginPath();
            let colorVal = 10 + Math.sin(y * 0.01 + time) * 15;
            ctx.fillStyle = `rgba(5, ${30 + colorVal}, ${70 + colorVal * 2}, 0.8)`;
            
            ctx.moveTo(startX - 400, y);
            for(let x = startX - 400; x < this.camera.x + cw/this.camera.zoom + 400; x += 40) {
                let waveY = Math.sin(x * 0.012 + time * 1.5 + y * 0.01) * 25;
                let waveY2 = Math.cos(x * 0.008 - time * 0.8 + y * 0.015) * 15;
                ctx.lineTo(x, y + waveY + waveY2);
            }
            ctx.lineTo(this.camera.x + cw/this.camera.zoom + 400, y + 200);
            ctx.lineTo(startX - 400, y + 200);
            ctx.fill();
            
            // Rich foam highlights
            ctx.strokeStyle = `rgba(200, 230, 255, ${0.05 + Math.max(0, Math.sin(y*0.02 + time*2))*0.15})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,0,0,0.3)';
        ctx.lineWidth = 5;
        ctx.strokeRect(0, 0, this.worldSize, this.worldSize);

        this.player.draw(ctx);
        for(let e of this.enemies) e.draw(ctx);
        for(let cb of this.cannonballs) cb.draw(ctx);
        for(let p of this.particles) p.draw(ctx);
        for(let ft of this.floatingTexts) ft.draw(ctx);

        ctx.restore();

        if(this.weather.active) {
            ctx.fillStyle = `rgba(180, 200, 210, ${this.weather.intensity * 0.35})`;
            ctx.fillRect(0, 0, cw, ch);
            if(this.weather.type === 'storm') {
                ctx.fillStyle = `rgba(0, 5, 10, ${this.weather.intensity * 0.5})`;
                ctx.fillRect(0, 0, cw, ch);
                if(Math.random() < 0.015 * this.weather.intensity) {
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.fillRect(0, 0, cw, ch);
                }
            }
        }

        this.drawMinimap();
    },
    drawMinimap() {
        mctx.clearRect(0, 0, 120, 120);
        let scale = 120 / this.worldSize;
        mctx.fillStyle = '#020b17';
        mctx.fillRect(0, 0, 120, 120);
        mctx.fillStyle = '#00ff00';
        mctx.beginPath();
        mctx.arc(this.player.x * scale, this.player.y * scale, 3, 0, Math.PI*2);
        mctx.fill();
        mctx.fillStyle = '#ff0000';
        for(let e of this.enemies) {
            mctx.beginPath();
            mctx.arc(e.x * scale, e.y * scale, e.type==='boss'? 4 : 2, 0, Math.PI*2);
            mctx.fill();
        }
        mctx.strokeStyle = 'rgba(255,255,255,0.3)';
        mctx.strokeRect(this.camera.x * scale, this.camera.y * scale, cw * scale, ch * scale);
    },
    loop(time) {
        requestAnimationFrame(t => this.loop(t));
        let dt = (time - this.lastTime);
        if(dt > 100) dt = 16; 
        this.lastTime = time;

        this.update(dt);
        this.draw();
        
        if(this.state === 'PLAYING') {
            document.getElementById('health-fill').style.width = `${(this.player.hp / this.player.maxHp) * 100}%`;
            document.getElementById('armor-fill').style.width = `${(this.player.armor / this.player.maxArmor) * 100}%`;
            let lProg = 1 - (this.player.reloadTimers.left / this.player.reloadTime);
            let rProg = 1 - (this.player.reloadTimers.right / this.player.reloadTime);
            document.getElementById('reload-left').style.background = `conic-gradient(var(--gold) ${lProg * 360}deg, transparent 0deg)`;
            document.getElementById('reload-right').style.background = `conic-gradient(var(--gold) ${rProg * 360}deg, transparent 0deg)`;
        }
    },
    spawnExplosion(x, y, count, big=false) {
        AudioSys.playExplosion();
        if(big) this.addShake(20);
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(x, y, 'fire'));
            this.particles.push(new Particle(x, y, 'smoke'));
            this.particles.push(new Particle(x, y, 'splinter')); // Wood debris
        }
    },
    spawnSplash(x, y) {
        AudioSys.playSplash();
        for(let i=0; i<10; i++) {
            this.particles.push(new Particle(x, y, 'water'));
        }
    },
    spawnText(x, y, text, color) {
        this.floatingTexts.push(new FloatingText(x, y, text, color));
    },
    levelComplete() {
        this.state = 'UPGRADE';
        document.getElementById('upgrade-screen').classList.remove('hidden');
        document.getElementById('upgrade-title').innerText = `LEVEL ${this.level} COMPLETE`;
    },
    applyUpgrade(type) {
        if(type === 'health') {
            this.player.maxHp += 20;
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + (this.player.maxHp * 0.5));
        } else if(type === 'damage') {
            this.player.cannonDamage *= 1.2;
        } else if(type === 'reload') {
            this.player.reloadTime *= 0.85;
        }
        this.level++;
        document.getElementById('upgrade-screen').classList.add('hidden');
        this.resetLevel();
        this.state = 'PLAYING';
    },
    gameOver() {
        this.state = 'GAMEOVER';
        this.addShake(40);
        this.spawnExplosion(this.player.x, this.player.y, 150, true);
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('final-level').innerText = this.level;
        document.getElementById('final-kills').innerText = this.kills;
    },
    restart() {
        this.score = 0;
        this.level = 1;
        this.kills = 0;
        document.getElementById('score-display').innerText = '0';
        this.player = new Player(this.worldSize/2, this.worldSize/2);
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        this.resetLevel();
        this.state = 'PLAYING';
    }
};

// --- 5. ENTITIES ---
class Ship {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.angle = -Math.PI/2;
        this.speed = 0;
        
        this.maxSpeed = 0.2;
        this.turnSpeed = 0.002;
        this.accel = 0.0005;
        this.drag = 0.98;
        this.hp = 100;
        this.maxHp = 100;
        this.radius = 40;
        this.width = 50; this.height = 100;
        this.bobTime = Math.random() * 100;
        this.hitFlashTimer = 0;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= this.drag;
        this.vy *= this.drag;
        this.bobTime += dt * 0.005;
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

        this.x = MathUtils.clamp(this.x, this.radius, Game.worldSize - this.radius);
        this.y = MathUtils.clamp(this.y, this.radius, Game.worldSize - this.radius);

        // Fire particles if low HP
        if (this.hp < this.maxHp * 0.3 && Math.random() < 0.1) {
            let px = this.x + MathUtils.rand(-this.width/2, this.width/2);
            let py = this.y + MathUtils.rand(-this.height/2, this.height/2);
            Game.particles.push(new Particle(px, py, 'fire'));
            Game.particles.push(new Particle(px, py, 'smoke'));
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI/2); 
        
        let bobScale = 1 + Math.sin(this.bobTime) * 0.02;
        ctx.scale(bobScale, bobScale);

        // --- HYPER-REALISTIC PROCEDURAL SHIP ---
        let isPlayer = this.isPlayer;
        let w = this.width;
        let h = this.height;
        
        // Deep shadow
        ctx.fillStyle = 'rgba(0,10,20,0.6)';
        ctx.beginPath();
        ctx.ellipse(15, 20, w/1.3, h/1.8, 0, 0, Math.PI*2);
        ctx.fill();

        // Hull body
        let hullGrad = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
        if (this.type === 'boss') {
            hullGrad.addColorStop(0, '#5a0000');
            hullGrad.addColorStop(1, '#110000');
        } else if (isPlayer) {
            hullGrad.addColorStop(0, '#795548');
            hullGrad.addColorStop(1, '#3e2723');
        } else if (this.type === 'fast') {
            hullGrad.addColorStop(0, '#1a3622');
            hullGrad.addColorStop(1, '#051108');
        } else {
            hullGrad.addColorStop(0, '#555555');
            hullGrad.addColorStop(1, '#222222');
        }

        // Draw outer hull
        ctx.fillStyle = hullGrad;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -h/2 - 15); // Bow 
        ctx.quadraticCurveTo(w/2 + 5, -h/4, w/2, h/2 - 5); // Right
        ctx.lineTo(w/2 - 10, h/2 + 10); // Right stern
        ctx.lineTo(-w/2 + 10, h/2 + 10); // Left stern
        ctx.quadraticCurveTo(-w/2 - 5, -h/4, 0, -h/2 - 15); // Left
        ctx.fill();
        ctx.stroke();

        // Wood Pattern Deck
        ctx.save();
        ctx.clip(); // Clip deck to hull shape
        if (woodPattern) {
            ctx.fillStyle = woodPattern;
            ctx.fillRect(-w, -h, w*2, h*2);
        } else {
            ctx.fillStyle = '#4a2f1d';
            ctx.fillRect(-w, -h, w*2, h*2);
        }
        
        // Deck shading
        let deckShade = ctx.createLinearGradient(0, -h/2, 0, h/2);
        deckShade.addColorStop(0, 'rgba(0,0,0,0)');
        deckShade.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = deckShade;
        ctx.fillRect(-w, -h, w*2, h*2);
        ctx.restore();

        // Ropes & Rigging
        ctx.strokeStyle = 'rgba(20, 10, 5, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Forward mast to sides
        ctx.moveTo(0, -h/4); ctx.lineTo(-w/2, -h/8);
        ctx.moveTo(0, -h/4); ctx.lineTo(w/2, -h/8);
        // Main mast to sides
        ctx.moveTo(0, h/8); ctx.lineTo(-w/2, 0);
        ctx.moveTo(0, h/8); ctx.lineTo(w/2, 0);
        ctx.stroke();

        // Captain's cabin (Rear structure)
        ctx.fillStyle = '#2b1b12';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.fillRect(-w/2 + 10, h/2 - 25, w - 20, 30);
        ctx.strokeRect(-w/2 + 10, h/2 - 25, w - 20, 30);
        
        // Lanterns on the back
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ff5500';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(-w/2 + 10, h/2 + 5, 3, 0, Math.PI*2);
        ctx.arc(w/2 - 10, h/2 + 5, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Flag at the back
        let flagWave = Math.sin(this.bobTime * 5) * 5;
        ctx.fillStyle = this.isPlayer ? '#000' : '#8b0000';
        ctx.beginPath();
        ctx.moveTo(0, h/2 - 10);
        ctx.lineTo(15, h/2 + 10 + flagWave);
        ctx.lineTo(0, h/2 + 15);
        ctx.fill();

        // Cannons (metallic and shaded)
        let numCannons = isPlayer ? 5 : (this.type === 'heavy' || this.type === 'boss' ? 6 : (this.type === 'fast' ? 2 : 4));
        let spacing = (h - 40) / (numCannons);
        
        for(let i=0; i<numCannons; i++) {
            let cy = -h/2 + 30 + (i * spacing);
            // Metallic gradient
            let cGrad = ctx.createLinearGradient(0, cy-3, 0, cy+3);
            cGrad.addColorStop(0, '#555');
            cGrad.addColorStop(0.5, '#111');
            cGrad.addColorStop(1, '#000');
            ctx.fillStyle = cGrad;
            
            // Left cannon
            ctx.fillRect(-w/2 - 8, cy, 12, 4);
            // Right cannon
            ctx.fillRect(w/2 - 4, cy, 12, 4);
        }

        // Sails
        let sailColor = (this.type === 'boss') ? '#a00000' : '#f8f8f8';
        if (this.type === 'enemyBasic') sailColor = '#cc0000';
        if (this.type === 'enemyFast') sailColor = '#222';
        
        let sailW = w * 1.6;
        let sailCurve = 25 + Math.sin(this.bobTime * 3) * 8; 

        let drawSail = (yPos) => {
            // Sail shadow on deck
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.moveTo(-sailW/2 + 8, yPos + 15);
            ctx.quadraticCurveTo(0, yPos - sailCurve + 15, sailW/2 + 8, yPos + 15);
            ctx.quadraticCurveTo(0, yPos + 25, -sailW/2 + 8, yPos + 15);
            ctx.fill();

            // Sail cloth
            let sGrad = ctx.createLinearGradient(0, yPos - sailCurve, 0, yPos + 10);
            sGrad.addColorStop(0, sailColor);
            sGrad.addColorStop(1, '#888');
            
            ctx.fillStyle = sGrad;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-sailW/2, yPos);
            ctx.quadraticCurveTo(0, yPos - sailCurve, sailW/2, yPos);
            ctx.quadraticCurveTo(0, yPos + 10, -sailW/2, yPos);
            ctx.fill();
            ctx.stroke();

            // Mast crossbar
            ctx.fillStyle = '#2b1b12';
            ctx.fillRect(-sailW/2, yPos - 2, sailW, 4);

            // Mast pole
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(0, yPos, 5, 0, Math.PI*2);
            ctx.fill();
        };

        if (this.type === 'fast') {
            drawSail(-h/6);
            drawSail(h/4);
        } else if (isPlayer || this.type === 'heavy' || this.type === 'boss') {
            drawSail(-h/4);
            drawSail(h/8);
            if(this.type === 'boss') drawSail(h/2 - 20);
        } else {
            drawSail(-h/8);
            drawSail(h/4);
        }

        // Hit flash overlay
        if (this.hitFlashTimer > 0) {
            ctx.fillStyle = `rgba(255, 0, 0, ${this.hitFlashTimer / 100})`;
            ctx.globalCompositeOperation = 'source-atop'; // Only color the ship
            ctx.beginPath();
            ctx.moveTo(0, -h/2 - 15);
            ctx.quadraticCurveTo(w/2 + 5, -h/4, w/2, h/2 - 5);
            ctx.lineTo(w/2 - 10, h/2 + 10);
            ctx.lineTo(-w/2 + 10, h/2 + 10);
            ctx.quadraticCurveTo(-w/2 - 5, -h/4, 0, -h/2 - 15);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over'; // Reset
        }

        // Wake effect (particles)
        if(Math.hypot(this.vx, this.vy) > 0.05 && Math.random() < 0.4) {
            let wx = this.x - Math.cos(this.angle) * this.height/2;
            let wy = this.y - Math.sin(this.angle) * this.height/2;
            Game.particles.push(new Particle(wx, wy, 'wake'));
            Game.particles.push(new Particle(wx + MathUtils.rand(-10,10), wy + MathUtils.rand(-10,10), 'wake'));
        }

        ctx.restore();
    }
    fireCannons(side) {
        let numCannons = this.isPlayer ? 5 : (this.type === 'heavy' || this.type === 'boss' ? 6 : (this.type === 'fast' ? 2 : 4));
        let spacing = (this.height - 40) / (numCannons);
        let startY = -this.height/2 + 30;
        
        let fireAngle = side === 'left' ? this.angle - Math.PI/2 : this.angle + Math.PI/2;
        
        for(let i=0; i<numCannons; i++) {
            let cxLocal = side === 'left' ? -this.width/2 : this.width/2;
            let cyLocal = startY + (i * spacing);
            
            let cxWorld = this.x + (cxLocal * Math.cos(this.angle + Math.PI/2) - cyLocal * Math.sin(this.angle + Math.PI/2));
            let cyWorld = this.y + (cxLocal * Math.sin(this.angle + Math.PI/2) + cyLocal * Math.cos(this.angle + Math.PI/2));
            
            let spread = (Math.random() - 0.5) * 0.15;
            
            Game.cannonballs.push(new Cannonball(cxWorld, cyWorld, fireAngle + spread, this.cannonDamage, this.isPlayer ? 'player' : 'enemy'));
            
            // Big muzzle flash and thick smoke
            Game.particles.push(new Particle(cxWorld, cyWorld, 'smoke'));
            Game.particles.push(new Particle(cxWorld, cyWorld, 'smoke'));
            Game.particles.push(new Particle(cxWorld, cyWorld, 'fire')); 
        }
        
        // Recoil (pushes ship back slightly)
        let recoilForce = 0.05;
        this.vx += Math.cos(fireAngle + Math.PI) * recoilForce;
        this.vy += Math.sin(fireAngle + Math.PI) * recoilForce;

        AudioSys.playCannon();
        if(this.isPlayer) Game.addShake(8);
    }
    takeDamage(amt) {
        this.hp -= amt;
        this.hitFlashTimer = 150; // Milliseconds for red flash
        
        // Floating text exact damage formatting
        let dmg = Math.floor(amt);
        Game.spawnText(this.x, this.y, `-${dmg}`, '#ff0000');
    }
}

class Player extends Ship {
    constructor(x, y) {
        super(x, y);
        this.isPlayer = true;
        this.maxSpeed = 0.25;
        this.turnSpeed = 0.0025;
        this.accel = 0.0006;
        this.maxArmor = 50;
        this.armor = 50;
        this.reloadTime = 2000;
        this.reloadTimers = { left: 0, right: 0 };
        this.cannonDamage = 25;
        this.input = { forward: false, backward: false, left: false, right: false, fireL: false, fireR: false };
    }
    update(dt) {
        let intentForward = this.input.forward || Joystick.y < -0.2;
        let intentBackward = this.input.backward || Joystick.y > 0.2;
        let intentLeft = this.input.left || Joystick.x < -0.2;
        let intentRight = this.input.right || Joystick.x > 0.2;

        if (intentForward) {
            this.vx += Math.cos(this.angle) * this.accel * dt;
            this.vy += Math.sin(this.angle) * this.accel * dt;
        } else if (intentBackward) {
            this.vx -= Math.cos(this.angle) * this.accel * dt * 0.5;
            this.vy -= Math.sin(this.angle) * this.accel * dt * 0.5;
        }

        let currentSpeed = Math.hypot(this.vx, this.vy);
        if(currentSpeed > this.maxSpeed) {
            let ratio = this.maxSpeed / currentSpeed;
            this.vx *= ratio;
            this.vy *= ratio;
        }

        let steerFactor = Math.min(1, currentSpeed / (this.maxSpeed * 0.5));
        if (intentLeft) this.angle -= this.turnSpeed * dt * steerFactor;
        if (intentRight) this.angle += this.turnSpeed * dt * steerFactor;

        if(this.reloadTimers.left > 0) this.reloadTimers.left -= dt;
        if(this.reloadTimers.right > 0) this.reloadTimers.right -= dt;

        if(this.input.fireL && this.reloadTimers.left <= 0) {
            this.fireCannons('left');
            this.reloadTimers.left = this.reloadTime;
        }
        if(this.input.fireR && this.reloadTimers.right <= 0) {
            this.fireCannons('right');
            this.reloadTimers.right = this.reloadTime;
        }

        super.update(dt);
    }
    takeDamage(amt) {
        if(this.armor > 0) {
            let remaining = amt - this.armor;
            this.armor = Math.max(0, this.armor - amt);
            if(remaining > 0) this.hp -= remaining;
        } else {
            this.hp -= amt;
        }
        this.hitFlashTimer = 150;
        let dmg = Math.floor(amt);
        Game.spawnText(this.x, this.y, `-${dmg}`, '#ff0000');
        Game.addShake(15);
    }
}

class Enemy extends Ship {
    constructor(x, y, type) {
        super(x, y);
        this.type = type;
        this.state = 'CHASE';
        this.stateTimer = 0;
        this.reloadTimer = 0;
        
        switch(type) {
            case 'basic':
                this.maxHp = this.hp = 80;
                this.maxSpeed = 0.18;
                this.cannonDamage = 10;
                this.scoreValue = 100;
                break;
            case 'fast':
                this.width = 35; this.height = 90;
                this.radius = 35;
                this.maxHp = this.hp = 50;
                this.maxSpeed = 0.28;
                this.turnSpeed = 0.0035;
                this.cannonDamage = 5;
                this.scoreValue = 150;
                break;
            case 'heavy':
                this.width = 65; this.height = 125;
                this.radius = 50;
                this.maxHp = this.hp = 200;
                this.maxSpeed = 0.12;
                this.turnSpeed = 0.0015;
                this.cannonDamage = 20;
                this.scoreValue = 300;
                break;
            case 'boss':
                this.width = 85; this.height = 160;
                this.radius = 65;
                this.maxHp = this.hp = 1000;
                this.maxSpeed = 0.15;
                this.turnSpeed = 0.002;
                this.cannonDamage = 25;
                this.scoreValue = 1000;
                break;
        }
    }
    update(dt) {
        let p = Game.player;
        let dist = MathUtils.distance(this, p);
        let angToPlayer = MathUtils.angle(this, p);
        
        this.stateTimer -= dt;
        if(this.stateTimer <= 0) {
            if(this.hp < this.maxHp * 0.2 && this.type !== 'boss') {
                this.state = 'RETREAT';
            } else if (dist < 450) {
                this.state = 'BROADSIDE';
            } else {
                this.state = 'CHASE';
            }
            this.stateTimer = 2000 + Math.random() * 2000;
        }

        let targetAngle = this.angle;
        let targetSpeed = 0;

        if(this.state === 'CHASE') {
            targetAngle = angToPlayer;
            targetSpeed = this.maxSpeed;
        } else if (this.state === 'BROADSIDE') {
            targetAngle = angToPlayer + Math.PI/2;
            targetSpeed = this.maxSpeed * 0.6;
            
            let diff = Math.abs(MathUtils.normalizeAngle(this.angle - (angToPlayer + Math.PI/2)));
            let diff2 = Math.abs(MathUtils.normalizeAngle(this.angle - (angToPlayer - Math.PI/2)));
            if((diff < 0.25 || diff2 < 0.25) && this.reloadTimer <= 0) {
                this.fireCannons(diff < 0.25 ? 'left' : 'right');
                this.reloadTimer = this.type === 'boss' ? 2000 : 3000;
            }
        } else if (this.state === 'RETREAT') {
            targetAngle = angToPlayer + Math.PI;
            targetSpeed = this.maxSpeed;
        }

        if(this.reloadTimer > 0) this.reloadTimer -= dt;

        let aDiff = MathUtils.normalizeAngle(targetAngle - this.angle);
        if(aDiff > 0) this.angle += Math.min(this.turnSpeed * dt, aDiff);
        else this.angle += Math.max(-this.turnSpeed * dt, aDiff);

        this.vx += Math.cos(this.angle) * this.accel * dt;
        this.vy += Math.sin(this.angle) * this.accel * dt;

        let currentSpeed = Math.hypot(this.vx, this.vy);
        if(currentSpeed > targetSpeed) {
            let ratio = targetSpeed / currentSpeed;
            this.vx *= ratio;
            this.vy *= ratio;
        }

        super.update(dt);
        
        if(this.hp < this.maxHp) {
            this.drawHpBar = true;
        }
    }
    draw(ctx) {
        super.draw(ctx);
        if(this.drawHpBar) {
            ctx.save();
            ctx.translate(this.x, this.y - this.radius - 20);
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(-20, -4, 40, 8);
            ctx.fillStyle = this.type === 'boss' ? '#ff0000' : '#ffaa00';
            ctx.fillRect(-19, -3, 38 * (this.hp / this.maxHp), 6);
            ctx.restore();
        }
    }
}

class Cannonball {
    constructor(x, y, angle, damage, owner) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * 1.0; // Faster cannonballs
        this.vy = Math.sin(angle) * 1.0;
        this.damage = damage;
        this.owner = owner;
        this.life = 1200;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        
        if(Math.random() < 0.4) {
            Game.particles.push(new Particle(this.x, this.y, 'trail'));
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        let grad = ctx.createRadialGradient(0,0,0, 0,0,4);
        grad.addColorStop(0, '#aaa');
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0,0, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, type) {
        this.x = x; this.y = y;
        this.type = type;
        this.life = 1.0;
        this.decay = MathUtils.rand(0.01, 0.03);
        
        if(type === 'fire') {
            this.vx = MathUtils.rand(-0.15, 0.15);
            this.vy = MathUtils.rand(-0.15, 0.15);
            this.size = MathUtils.rand(15, 35);
            this.color = `rgba(255, ${Math.floor(Math.random()*150)}, 0`;
        } else if (type === 'smoke') {
            this.vx = MathUtils.rand(-0.08, 0.08);
            this.vy = MathUtils.rand(-0.08, 0.08) - 0.05;
            this.size = MathUtils.rand(15, 45);
            this.decay = 0.005;
        } else if (type === 'water') {
            this.vx = MathUtils.rand(-0.25, 0.25);
            this.vy = MathUtils.rand(-0.25, 0.25);
            this.size = MathUtils.rand(6, 18);
            this.color = `rgba(200, 240, 255`;
            this.decay = 0.02;
        } else if (type === 'splinter') {
            this.vx = MathUtils.rand(-0.2, 0.2);
            this.vy = MathUtils.rand(-0.2, 0.2);
            this.size = MathUtils.rand(2, 6);
            this.color = '#3e2723';
            this.decay = 0.03;
        } else if (type === 'trail') {
            this.vx = 0; this.vy = 0;
            this.size = MathUtils.rand(2, 4);
            this.decay = 0.06;
        } else if (type === 'wake') {
            this.vx = 0; this.vy = 0;
            this.size = MathUtils.rand(10, 30);
            this.decay = 0.01;
            this.life = 0.5;
        }
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if(this.type === 'smoke' || this.type === 'wake') {
            this.size += dt * 0.03;
        }
        this.life -= this.decay * (dt/16);
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.beginPath();
        if(this.type === 'fire') {
            ctx.fillStyle = `${this.color}, ${this.life})`;
            ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI*2);
            ctx.fill();
        } else if(this.type === 'smoke' || this.type === 'trail') {
            ctx.fillStyle = `rgba(80, 80, 80, ${this.life * 0.6})`;
            ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
            ctx.fill();
        } else if(this.type === 'water') {
            ctx.fillStyle = `${this.color}, ${this.life})`;
            ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI*2);
            ctx.fill();
        } else if (this.type === 'wake') {
            ctx.fillStyle = `rgba(220, 240, 255, ${this.life * 0.3})`;
            ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
            ctx.fill();
        } else if (this.type === 'splinter') {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.size, this.size/2);
        }
        ctx.restore();
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x + MathUtils.rand(-15, 15);
        this.y = y + MathUtils.rand(-15, 15);
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.vy = -0.06;
    }
    update(dt) {
        this.y += this.vy * dt;
        this.life -= 0.015 * (dt/16);
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = 'bold 26px Roboto';
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// --- 6. INPUT HANDLING ---
const Joystick = {
    x: 0, y: 0, active: false, id: null,
    base: document.getElementById('joystick'),
    knob: document.getElementById('joystick-knob')
};

function handleTouch(e) {
    if(Game.state !== 'PLAYING') return;
    let rect = Joystick.base.getBoundingClientRect();
    let cx = rect.left + rect.width/2;
    let cy = rect.top + rect.height/2;
    let maxDist = rect.width/2;

    for(let i=0; i<e.touches.length; i++) {
        let t = e.touches[i];
        if(!Joystick.active && Math.hypot(t.clientX - cx, t.clientY - cy) < maxDist * 2) {
            Joystick.active = true;
            Joystick.id = t.identifier;
        }
        if(Joystick.active && t.identifier === Joystick.id) {
            let dx = t.clientX - cx;
            let dy = t.clientY - cy;
            let dist = Math.hypot(dx, dy);
            if(dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }
            Joystick.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            Joystick.x = dx / maxDist;
            Joystick.y = dy / maxDist;
            e.preventDefault();
        }
    }
}

function handleTouchEnd(e) {
    for(let i=0; i<e.changedTouches.length; i++) {
        if(e.changedTouches[i].identifier === Joystick.id) {
            Joystick.active = false;
            Joystick.id = null;
            Joystick.x = 0;
            Joystick.y = 0;
            Joystick.knob.style.transform = `translate(-50%, -50%)`;
        }
    }
}

window.addEventListener('touchstart', handleTouch, {passive: false});
window.addEventListener('touchmove', handleTouch, {passive: false});
window.addEventListener('touchend', handleTouchEnd);
window.addEventListener('touchcancel', handleTouchEnd);

const btnL = document.getElementById('fire-left-btn');
const btnR = document.getElementById('fire-right-btn');
btnL.addEventListener('touchstart', (e) => { e.preventDefault(); if(Game.player) Game.player.input.fireL = true; });
btnL.addEventListener('touchend', (e) => { e.preventDefault(); if(Game.player) Game.player.input.fireL = false; });
btnR.addEventListener('touchstart', (e) => { e.preventDefault(); if(Game.player) Game.player.input.fireR = true; });
btnR.addEventListener('touchend', (e) => { e.preventDefault(); if(Game.player) Game.player.input.fireR = false; });

const keyMap = {
    'KeyW': 'forward', 'ArrowUp': 'forward',
    'KeyS': 'backward', 'ArrowDown': 'backward',
    'KeyA': 'left', 'ArrowLeft': 'left',
    'KeyD': 'right', 'ArrowRight': 'right',
    'KeyQ': 'fireL', 'KeyE': 'fireR'
};

window.addEventListener('keydown', e => {
    if(Game.player && keyMap[e.code]) {
        Game.player.input[keyMap[e.code]] = true;
    }
});
window.addEventListener('keyup', e => {
    if(Game.player && keyMap[e.code]) {
        Game.player.input[keyMap[e.code]] = false;
    }
});

// --- 7. INITIALIZATION & UI BINDINGS ---
document.getElementById('start-btn').addEventListener('click', () => {
    AudioSys.init();
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('instructions-modal').classList.remove('hidden');
});

document.getElementById('close-inst-btn').addEventListener('click', () => {
    document.getElementById('instructions-modal').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    Game.init();
    Game.state = 'PLAYING';
});

document.getElementById('restart-btn').addEventListener('click', () => {
    Game.restart();
});

document.querySelectorAll('.upgrade-card').forEach(card => {
    card.addEventListener('click', () => {
        Game.applyUpgrade(card.dataset.upgrade);
    });
});

window.onload = async () => {
    let bar = document.getElementById('loading-bar');
    bar.style.width = '30%';
    await loadImages();
    bar.style.width = '100%';
    setTimeout(() => {
        document.querySelector('.loading-bar-container').style.display = 'none';
        document.getElementById('start-btn').classList.remove('hidden');
    }, 500);
};
