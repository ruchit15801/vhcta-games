/**
 * ╔══════════════════════════════════════════════════╗
 *   VOID BREAKER — CYBERPUNK INFINITE RUNNER ENGINE
 *   Premium Edition — V1.0
 * ╚══════════════════════════════════════════════════╝
 */

// ── CONSTANTS ──────────────────────────────────────
const ZONES = [
    { name: 'SECTOR ZERO', minDist: 0, color: '#00ffcc', speed: 5.5, bgHue: '180' },
    { name: 'NEON DISTRICT', minDist: 500, color: '#ff00ff', speed: 7.5, bgHue: '290' },
    { name: 'DEAD CIRCUIT', minDist: 1000, color: '#ffcc00', speed: 9.5, bgHue: '45' },
    { name: 'VOID CORE', minDist: 1500, color: '#ff4422', speed: 12.0, bgHue: '0' },
];

const POWER_TYPES = [
    { type: 'energy', icon: '🔋', col: '#ffcc00', label: 'ENERGY REFILL' },
    { type: 'shield', icon: '🛡️', col: '#00ffcc', label: 'SHIELD ONLINE' },
    { type: 'surge', icon: '⚡', col: '#ff00ff', label: 'SURGE MODE' },
    { type: 'magnet', icon: '🧲', col: '#ff8800', label: 'MAGNET ACTIVE' },
    { type: 'crystal', icon: '💠', col: '#88aaff', label: 'CRYSTAL SCORE' },
    { type: 'vortex', icon: '🌀', col: '#cc44ff', label: 'VORTEX BLAST' },
];

const STORAGE_KEYS = {
    BEST_DIST: 'vb_best_dist',
    BEST_SCORE: 'vb_best_score'
};

// ── AUDIO ENGINE ───────────────────────────────────
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.engineOsc = null;
        this.engineGain = null;
        this.ambientOsc = null;
        this.ambientGain = null;
        this.enabled = true;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.setupAmbient();
    }

    setupAmbient() {
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.connect(this.ctx.destination);
        this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }

    startAmbient() {
        if (!this.ctx || this.ambientOsc) return;
        this.ambientOsc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        
        lfo.frequency.value = 0.5;
        lfoGain.gain.value = 5;
        lfo.connect(lfoGain);
        lfoGain.connect(this.ambientOsc.frequency);
        
        this.ambientOsc.type = 'sine';
        this.ambientOsc.frequency.value = 40;
        this.ambientOsc.connect(this.ambientGain);
        this.ambientGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 2);
        
        lfo.start();
        this.ambientOsc.start();
    }

    stopAmbient() {
        if (this.ambientGain) {
            this.ambientGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
            setTimeout(() => {
                if (this.ambientOsc) { this.ambientOsc.stop(); this.ambientOsc = null; }
            }, 1000);
        }
    }

    tone(f, t = 'square', d = 0.06, v = 0.1, dl = 0) {
        if (!this.ctx || !this.enabled) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g);
        g.connect(this.ctx.destination);
        o.type = t;
        o.frequency.value = f;
        const T = this.ctx.currentTime + dl;
        g.gain.setValueAtTime(0, T);
        g.gain.linearRampToValueAtTime(v, T + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, T + d);
        o.start(T);
        o.stop(T + d + 0.05);
    }

    startEngine() {
        if (!this.ctx || !this.enabled) return;
        this.stopEngine();
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineGain.gain.setValueAtTime(0.015, this.ctx.currentTime);
        this.engineOsc.start();
    }

    updateEngine(spd) {
        if (this.engineOsc) {
            this.engineOsc.frequency.setTargetAtTime(55 + spd * 12, this.ctx.currentTime, 0.1);
        }
    }

    stopEngine() {
        if (this.engineOsc) {
            try { this.engineOsc.stop(); } catch (e) { }
            this.engineOsc = null;
        }
    }

    play(sfx, val) {
        switch (sfx) {
            case 'jump': this.tone(660, 'sine', 0.07, 0.14); break;
            case 'dJump': this.tone(880, 'sine', 0.07, 0.14); this.tone(1100, 'sine', 0.05, 0.1, 0.04); break;
            case 'slide': this.tone(200, 'sawtooth', 0.08, 0.12); break;
            case 'collect': this.tone(1108, 'sine', 0.06, 0.15); this.tone(1318, 'sine', 0.04, 0.1, 0.04); break;
            case 'powerup': [440, 554, 659, 880, 1108].forEach((f, i) => this.tone(f, 'sine', 0.1, 0.2, i * 0.06)); break;
            case 'hit': this.tone(180, 'sawtooth', 0.15, 0.3); this.tone(120, 'sine', 0.12, 0.25, 0.05); break;
            case 'shield': this.tone(660, 'sine', 0.08, 0.18); break;
            case 'die': [330, 260, 190, 120].forEach((f, i) => this.tone(f, 'sawtooth', 0.15, 0.3, i * 0.07)); break;
            case 'combo': this.tone(440 + val * 50, 'sine', 0.08, 0.2); break;
            case 'surge': [220, 330, 440, 660, 880].forEach((f, i) => this.tone(f, 'sawtooth', 0.18, 0.28, i * 0.04)); break;
            case 'zone': [440, 550, 660, 880].forEach((f, i) => this.tone(f, 'sine', 0.12, 0.25, i * 0.08)); break;
            case 'newBest': [440, 554, 659, 880, 1108, 1318].forEach((f, i) => this.tone(f, 'sine', 0.14, 0.28, i * 0.07)); break;
        }
    }
}

const Audio = new AudioEngine();

// ── GAME STATE ─────────────────────────────────────
const CV = document.getElementById('gameCanvas');
const ctx = CV.getContext('2d');
let W, H;
let gSt = 'splash', frame = 0;
let dist = 0, score = 0, hp = 3, energy = 5, maxEnergy = 5;
let combo = 1, comboTimer = 0;
let activePower = null, powerTimer = 0;
let shielded = false, surgeMode = false, magnetMode = false;
let bestDist = +localStorage.getItem(STORAGE_KEYS.BEST_DIST) || 0;
let bestScore = +localStorage.getItem(STORAGE_KEYS.BEST_SCORE) || 0;
let currentZone = 0, zoneTimer = 0;
let gameSpeed = 5.5;

// Player & World
let pl = { trail: [] };
let platforms = [], obstacles = [], orbs = [], powerups = [], particles = [], floatTexts = [], bgLines = [], bgStars = [];

function resize() { 
    W = CV.width = window.innerWidth; 
    H = CV.height = window.innerHeight; 
    
    // Auto-align player to the new floor avoiding mobile URL bar jumps
    if (gSt === 'play' && pl && pl.y !== undefined) {
        pl.y = (H * 0.72) - (pl.sliding ? pl.h * 0.5 : pl.h) / 2;
    }
}
resize(); 
window.addEventListener('resize', resize);

// Input Handling
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (gSt !== 'play') return;
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) doJump();
    if (['ArrowDown', 'KeyS'].includes(e.code)) doSlide();
    if (['ShiftLeft', 'ShiftRight', 'KeyX'].includes(e.code)) doShield();
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', e => { 
    keys[e.code] = false; 
    if (['ArrowDown', 'KeyS'].includes(e.code) && pl.sliding) endSlide(); 
});

// ── PLAYER LOGIC ───────────────────────────────────
function initPlayer() {
    const floorY = H * 0.72;
    pl = {
        x: W * 0.18, y: floorY, w: 30, h: 44,
        vy: 0, vx: 0,
        onGround: true, jumping: false, doubleJumped: false,
        sliding: false, slideTimer: 0,
        invincible: 0, trail: [],
        animT: 0, runCycle: 0,
    };
}

function doJump() {
    if (gSt !== 'play') return;
    if (pl.sliding) { endSlide(); return; }
    if (pl.onGround) {
        pl.vy = -16.5; pl.onGround = false; pl.jumping = true; Audio.play('jump');
        spawnP(pl.x, pl.y + pl.h / 2, '#00ffcc', 6);
    } else if (!pl.doubleJumped) {
        pl.vy = -14; pl.doubleJumped = true; Audio.play('dJump');
        spawnP(pl.x, pl.y, '#ff00ff', 10);
    }
}

function doSlide() {
    if (gSt !== 'play' || pl.sliding) return;
    pl.sliding = true; pl.slideTimer = 60; Audio.play('slide');
    spawnP(pl.x, pl.y + pl.h / 2, '#ffcc00', 4);
}
function endSlide() { pl.sliding = false; }

function doShield() {
    if (gSt !== 'play') return;
    if (energy <= 0) { showToast('LOW ENERGY!'); return; }
    if (shielded) return;
    energy--; shielded = true; Audio.play('shield');
    showToast('🛡 SHIELD ONLINE');
    updateHUD();
}

// ── WORLD GENERATION ───────────────────────────────
const getFloorY = () => H * 0.72;

function spawnObstacle() {
    const zone = ZONES[currentZone] || ZONES[0];
    const types = ['wall', 'spike', 'laser', 'barrier', 'doublespike'];
    const activeTypes = dist < 500 ? ['wall', 'spike'] : dist < 1000 ? ['wall', 'spike', 'barrier'] : types;
    const t = activeTypes[Math.floor(Math.random() * activeTypes.length)];
    const h = t === 'wall' ? 60 + Math.random() * 50 : t === 'doublespike' ? 90 : t === 'laser' ? 20 : 45 + Math.random() * 30;
    const isHigh = t === 'barrier' && Math.random() < 0.5;
    
    obstacles.push({
        x: W + 100,
        y: isHigh ? getFloorY() - 90 : getFloorY() - h,
        w: t === 'laser' ? 12 : t === 'wall' ? 22 : 18,
        h, type: t,
        col: zone.color, speed: gameSpeed, animT: Math.random() * Math.PI * 2,
        isHigh
    });
}

function spawnOrb(x, y) {
    orbs.push({ 
        x: x || W + 50, 
        y: y || (getFloorY() - 40 - Math.random() * 100), 
        r: 8, col: '#00ffcc', animT: Math.random() * Math.PI * 2, 
        speed: gameSpeed, collected: false 
    });
}

function spawnPowerup() {
    const p = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
    powerups.push({ 
        x: W + 50, y: getFloorY() - 60 - Math.random() * 100, 
        r: 16, ...p, animT: 0, speed: gameSpeed, collected: false 
    });
}

function spawnP(x, y, col, n = 8) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 1, decay: 0.04, col, r: 2 + Math.random() * 4 });
    }
}

function addFloat(x, y, text, col) {
    floatTexts.push({ x, y, text, col, life: 1, vy: -2 });
}

// ── CORE LOOP ──────────────────────────────────────
let obstacleTimer = 0, orbTimer = 0, powerupTimer = 0;

function update() {
    if (gSt !== 'play') return;
    frame++;
    dist += gameSpeed * 0.016;
    score += Math.ceil(gameSpeed * 0.1 * combo);

    // Speed scaling
    const targetSpd = (ZONES[currentZone]?.speed || 5.5) + dist * 0.001;
    gameSpeed += (targetSpd - gameSpeed) * 0.02;
    Audio.updateEngine(gameSpeed);

    // Zone logic
    for (let i = ZONES.length - 1; i >= 0; i--) {
        if (dist >= ZONES[i].minDist && i !== currentZone) {
            currentZone = i;
            Audio.play('zone');
            showToast('⚠ ENTERING ' + ZONES[i].name);
            zoneTimer = 120;
            showComboFlash('ZONE: ' + ZONES[i].name, ZONES[i].color);
            break;
        }
    }

    // Player physics
    pl.vy += 0.72;
    pl.y += pl.vy;
    pl.animT += 0.15;
    if (!pl.sliding) pl.runCycle += 0.25;
    if (pl.invincible > 0) pl.invincible--;

    if (pl.sliding) {
        pl.slideTimer--;
        if (pl.slideTimer <= 0) endSlide();
    }

    const ground = getFloorY();
    const effH = pl.sliding ? pl.h * 0.5 : pl.h;
    if (pl.y + effH / 2 >= ground) {
        pl.y = ground - effH / 2;
        pl.vy = 0; pl.onGround = true; pl.jumping = false; pl.doubleJumped = false;
    } else {
        pl.onGround = false;
    }

    pl.trail.push({ x: pl.x, y: pl.y, sliding: pl.sliding });
    if (pl.trail.length > 12) pl.trail.shift();

    // Timers
    if (powerTimer > 0) {
        powerTimer--;
        if (powerTimer <= 0) { surgeMode = false; magnetMode = false; activePower = null; }
    }
    if (comboTimer > 0) { comboTimer--; if (comboTimer <= 0) combo = 1; }

    // Spawning logic
    const speedMult = gameSpeed / 5.5;

    obstacleTimer -= speedMult;
    if (obstacleTimer <= 0) {
        spawnObstacle();
        // Obstacles spawn every 30 to 70 frames naturally
        obstacleTimer = 30 + Math.random() * 40;
    }
    
    orbTimer -= speedMult;
    if (orbTimer <= 0) {
        const cluster = Math.floor(Math.random() * 4) + 1;
        for (let i = 0; i < cluster; i++) spawnOrb(W + 50 + i * 35);
        orbTimer = 25 + Math.random() * 35;
    }
    
    powerupTimer -= speedMult;
    if (powerupTimer <= 0) {
        spawnPowerup();
        powerupTimer = 400 + Math.random() * 400;
    }

    // Entity updates
    orbs.forEach((orb, i) => {
        orb.x -= gameSpeed; orb.animT += 0.1;
        if (magnetMode && !orb.collected) {
            const dx = pl.x - orb.x, dy = pl.y - orb.y, d = Math.hypot(dx, dy);
            if (d < 250) { orb.x += dx / d * 10; orb.y += dy / d * 10; }
        }
        if (orb.x < -50) orbs.splice(i, 1);
        else if (!orb.collected && Math.hypot(orb.x - pl.x, orb.y - pl.y) < 35) {
            orb.collected = true; Audio.play('collect');
            score += 10 * combo; combo = Math.min(combo + 1, 50); comboTimer = 100;
            if (combo > 5) showComboFlash();
            spawnP(orb.x, orb.y, '#00ffcc', 6);
            orbs.splice(i, 1);
        }
    });

    powerups.forEach((p, i) => {
        p.x -= gameSpeed; p.animT += 0.06;
        if (p.x < -50) powerups.splice(i, 1);
        else if (!p.collected && Math.hypot(p.x - pl.x, p.y - pl.y) < 40) collectPower(p, i);
    });

    obstacles.forEach((obs, i) => {
        obs.x -= gameSpeed; 
        if (obs.x < -80) obstacles.splice(i, 1);
        else {
            const pX = pl.x, pY = pl.y, pW = pl.w, pH = pl.sliding ? pl.h * 0.5 : pl.h;
            if (pX + pW/2 > obs.x - obs.w/2 && pX - pW/2 < obs.x + obs.w/2 && 
                pY + pH/2 > obs.y && pY - pH/2 < obs.y + obs.h) {
                hitPlayer();
                obstacles.splice(i, 1);
            }
        }
    });

    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= p.decay; p.r *= 0.97; });
    particles = particles.filter(p => p.life > 0);
    floatTexts.forEach(ft => { ft.y += ft.vy; ft.life -= 0.02; });
    floatTexts = floatTexts.filter(ft => ft.life > 0);
    bgStars.forEach(s => { s.x -= s.spd * gameSpeed * 0.3; if (s.x < -10) s.x = W + 10; });

    if (score > bestScore) { bestScore = score; localStorage.setItem(STORAGE_KEYS.BEST_SCORE, bestScore); }
    
    // Smooth zone transition
    if (zoneTimer > 0) zoneTimer--;

    updateHUD();
}

function collectPower(p, idx) {
    p.collected = true; Audio.play('powerup');
    spawnP(p.x, p.y, p.col, 15);
    showToast(p.icon + ' ' + p.label);
    activePower = p.type;
    powerTimer = 400;

    switch (p.type) {
        case 'energy': energy = Math.min(maxEnergy, energy + 3); activePower = null; break;
        case 'shield': shielded = true; activePower = null; break;
        case 'surge': surgeMode = true; break;
        case 'magnet': magnetMode = true; break;
        case 'crystal': score += 1000 * combo; addFloat(pl.x, pl.y - 50, '+' + (1000 * combo), p.col); activePower = null; break;
        case 'vortex':
            Audio.play('surge');
            obstacles.forEach(o => spawnP(o.x, o.y, '#cc44ff', 12));
            obstacles = [];
            activePower = null;
            break;
    }
    powerups.splice(idx, 1);
    updateHUD();
}

function hitPlayer() {
    if (surgeMode || pl.invincible > 0) return;
    if (shielded) {
        shielded = false; Audio.play('shield');
        spawnP(pl.x, pl.y, '#00ffcc', 20);
        showToast('🛡 SHIELD ABSORBED');
        pl.invincible = 60;
        return;
    }
    hp--; Audio.play('hit'); 
    pl.invincible = 90; combo = 1; comboTimer = 0;
    spawnP(pl.x, pl.y, '#ff2244', 20);
    CV.classList.add('shake');
    setTimeout(() => CV.classList.remove('shake'), 200);
    if (hp <= 0) endGame();
    updateHUD();
}

// ── RENDER ENGINE ───────────────────────────────────
function draw() {
    ctx.clearRect(0,0,W,H);
    const zone = ZONES[currentZone] || ZONES[0];

    // Background
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, '#04000c'); grad.addColorStop(0.7, '#080018'); grad.addColorStop(1, '#0c0028');
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

    // Grid & Stars
    ctx.strokeStyle = zone.color + '11'; ctx.lineWidth = 1;
    const gs = 50;
    const off = (frame * gameSpeed * 0.4) % gs;
    for (let x = -off; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    bgStars.forEach(s => {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(frame * 0.05 + s.x) * 0.2})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });

    const fY = getFloorY();
    // Floor
    ctx.shadowColor = zone.color; ctx.shadowBlur = 15;
    ctx.strokeStyle = zone.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, fY); ctx.lineTo(W, fY); ctx.stroke();
    ctx.shadowBlur = 0;

    // Entities
    orbs.forEach(o => {
        ctx.save(); ctx.translate(o.x, o.y);
        ctx.shadowColor = o.col; ctx.shadowBlur = 12 + Math.sin(o.animT*4)*4;
        ctx.fillStyle = o.col; ctx.beginPath(); ctx.arc(0,0,o.r,0,Math.PI*2); ctx.fill();
        ctx.restore();
    });

    powerups.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.animT);
        ctx.shadowColor = p.col; ctx.shadowBlur = 15;
        ctx.strokeStyle = p.col; ctx.lineWidth = 2;
        ctx.strokeRect(-p.r,-p.r,p.r*2,p.r*2);
        ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.rotate(-p.animT); ctx.fillText(p.icon, 0, 0);
        ctx.restore();
    });

    obstacles.forEach(o => {
        ctx.save(); ctx.translate(o.x, o.y);
        ctx.shadowColor = o.col; ctx.shadowBlur = 15;
        if (o.type === 'wall') {
            const g = ctx.createLinearGradient(0,0,0,o.h);
            g.addColorStop(0, o.col); g.addColorStop(1, '#000');
            ctx.fillStyle = g; ctx.fillRect(-o.w/2, 0, o.w, o.h);
            ctx.strokeStyle = o.col; ctx.strokeRect(-o.w/2, 0, o.w, o.h);
        } else if (o.type.includes('spike')) {
            ctx.fillStyle = o.col;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, o.h); ctx.lineTo(12, o.h); ctx.fill();
        } else {
            ctx.fillStyle = o.col + '33'; ctx.fillRect(-o.w/2, 0, o.w, o.h);
            ctx.strokeStyle = o.col; ctx.strokeRect(-o.w/2, 0, o.w, o.h);
        }
        ctx.restore();
    });

    // Player
    if (gSt !== 'splash') {
        pl.trail.forEach((t, i) => {
            const a = (i / pl.trail.length) * 0.3;
            ctx.fillStyle = zone.color + Math.floor(a * 255).toString(16).padStart(2, '0');
            const th = t.sliding ? pl.h * 0.5 : pl.h;
            ctx.fillRect(t.x - pl.w / 2, t.y - th / 2, pl.w, th);
        });

        if (pl.x !== undefined && !(pl.invincible > 0 && frame % 6 < 3)) {
            ctx.save(); ctx.translate(pl.x, pl.y);
            const drawH = pl.sliding ? pl.h * 0.5 : pl.h;
            const drawW = pl.sliding ? pl.w * 1.4 : pl.w;
            
            if (surgeMode) { ctx.shadowColor = '#f0f'; ctx.shadowBlur = 30; }
            if (shielded) {
                ctx.beginPath(); ctx.arc(0,0,40,0,Math.PI*2);
                ctx.strokeStyle = '#0ff8'; ctx.setLineDash([5,5]); ctx.stroke();
                ctx.setLineDash([]);
            }

            ctx.fillStyle = zone.color; ctx.shadowBlur = 15;
            ctx.fillRect(-drawW/2, -drawH/2, drawW, drawH);
            
            // Cyber Visor
            ctx.fillStyle = '#fff'; ctx.fillRect(drawW/4, -drawH/3, drawW/4, 5);
            ctx.restore();
        }
    }

    particles.forEach(p => {
        ctx.fillStyle = p.col + Math.floor(p.life * 255).toString(16).padStart(2, '0');
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });

    floatTexts.forEach(ft => {
        ctx.fillStyle = ft.col + Math.floor(ft.life * 255).toString(16).padStart(2, '0');
        ctx.font = 'bold 20px Audiowide'; ctx.fillText(ft.text, ft.x, ft.y);
    });

    if (zoneTimer > 0) {
        ctx.fillStyle = zone.color + Math.floor(zoneTimer / 120 * 80).toString(16).padStart(2, '0');
        ctx.fillRect(0, 0, W, H);
        zoneTimer--;
    }
}

// ── FLOW CONTROL ───────────────────────────────────
function startGame() {
    Audio.init();
    document.getElementById('splash').classList.add('off');
    document.getElementById('guide').classList.add('off');
    document.getElementById('ov').style.display = 'none';

    dist = 0; score = 0; hp = 3; energy = 5; combo = 1; 
    activePower = null; powerTimer = 0; shielded = false; surgeMode = false; magnetMode = false;
    gameSpeed = 5.5; currentZone = 0; frame = 0;
    obstacles = []; orbs = []; powerups = []; particles = []; floatTexts = [];
    obstacleTimer = 40; orbTimer = 20; powerupTimer = 300;
    
    bgStars = Array.from({ length: 100 }, () => ({
        x: Math.random() * W, y: Math.random() * H * 0.7,
        r: Math.random() * 1.5 + 0.5, spd: Math.random() * 0.5 + 0.1
    }));

    initPlayer();
    document.getElementById('hud').style.display = 'flex';
    if ('ontouchstart' in window) document.getElementById('mob-ctrl').style.display = 'flex';
    
    updateHUD();
    Audio.startEngine();
    Audio.startAmbient();
    
    let count = 3;
    const el = document.getElementById('countdown');
    el.style.opacity = '1';
    el.textContent = count;
    gSt = 'countdown';
    
    const tick = setInterval(() => {
        count--;
        if (count > 0) { el.textContent = count; Audio.play('jump'); }
        else {
            el.style.opacity = '0'; clearInterval(tick);
            gSt = 'play'; Audio.play('surge');
        }
    }, 1000);
}

function endGame() {
    gSt = 'dead'; Audio.stopEngine(); Audio.stopAmbient(); Audio.play('die');
    if (dist > bestDist) { bestDist = Math.floor(dist); localStorage.setItem(STORAGE_KEYS.BEST_DIST, bestDist); }
    
    document.getElementById('ov-st').innerHTML = `
        <div class="sb"><div class="sv">${Math.floor(dist)}m</div><div class="sl">DISTANCE</div></div>
        <div class="sb"><div class="sv">${score}</div><div class="sl">SCORE</div></div>
        <div class="sb"><div class="sv">${ZONES[currentZone]?.name || ''}</div><div class="sl">ZONE REACHED</div></div>
        <div class="sb"><div class="sv">${bestDist}m</div><div class="sl">BEST RUN</div></div>
    `;
    document.getElementById('ov').style.display = 'flex';
}

function updateHUD() {
    document.getElementById('hud-dist').textContent = Math.floor(dist);
    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-hp').textContent = '❤'.repeat(Math.max(0, hp));
    document.getElementById('hud-combo').textContent = '×' + combo;
    document.getElementById('hud-best').textContent = bestDist + 'm';
    document.getElementById('hud-zone').textContent = ZONES[currentZone]?.name || '';
    document.getElementById('hud-shield').textContent = shielded ? '🛡 SHIELD ON' : 'NO SHIELD';
    document.getElementById('hp-fill').style.width = (hp / 3 * 100) + '%';
    document.getElementById('en-fill').style.width = (energy / maxEnergy * 100) + '%';
    document.getElementById('hud-power').textContent = activePower ? (activePower.toUpperCase() + ' ACTIVE') : '—';
}

function showToast(m) {
    const el = document.getElementById('toast');
    el.textContent = m; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2500);
}

function showComboFlash(text, col) {
    const el = document.getElementById('combo-flash');
    el.textContent = text || ('COMBO ×' + combo + '!');
    el.style.color = col || '#ffcc00';
    el.style.opacity = '1'; el.style.fontSize = Math.min(22 + combo * 0.5, 60) + 'px';
    clearTimeout(el._t); el._t = setTimeout(() => el.style.opacity = '0', 1000);
}

// ── EXPOSED FUNCTIONS ──────────────────────────────
window.showGuide = () => {
    document.getElementById('splash').classList.add('off');
    document.getElementById('guide').classList.remove('off');
};
window.startGame = startGame;
window.restartGame = () => { document.getElementById('ov').style.display = 'none'; startGame(); };
window.goMenu = () => {
    Audio.stopEngine(); Audio.stopAmbient(); gSt = 'splash';
    document.getElementById('ov').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('mob-ctrl').style.display = 'none';
    document.getElementById('splash').classList.remove('off');
    document.getElementById('sp-best').textContent = 'BEST: ' + bestDist + 'm';
};
window.doJump = doJump;
window.doSlide = doSlide;
window.doShield = doShield;

// ── LOOP ───────────────────────────────────────────
function loop(ts) {
    update(); draw();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Initial State
document.getElementById('sp-best').textContent = 'BEST: ' + bestDist + 'm';
