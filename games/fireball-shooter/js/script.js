const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('scoreDisplay');
const shotsDisplay = document.getElementById('shotsDisplay');
const levelDisplay = document.getElementById('levelDisplay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const gameOverTitle = document.getElementById('gameOverTitle');
const finalScore = document.getElementById('finalScore');

let width, height;
let gameLoopId;
let gameState = 'START';
let lastTime = 0;

let score = 0;
let level = 1;
let shotsLeft = 10;

let player;
let fireballs = [];
let targets = [];
let particles = [];
let obstacles = [];
let floatText = [];

let isDragging = false;
let dragStart = {x: 0, y: 0};
let dragCurrent = {x: 0, y: 0};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'shoot') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'level') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

function resize() {
    width = canvas.width = canvas.clientWidth;
    height = canvas.height = canvas.clientHeight;
    if(player) {
        player.x = width / 2;
        player.y = height - 80;
    }
}
window.addEventListener('resize', resize);

class Cannon {
    constructor() {
        this.x = width / 2;
        this.y = height - 80;
        this.angle = -Math.PI / 2;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        let grad = ctx.createLinearGradient(-20, -20, 20, 20);
        grad.addColorStop(0, '#888');
        grad.addColorStop(0.5, '#444');
        grad.addColorStop(1, '#222');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4d00';
        ctx.shadowColor = '#ff4d00';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;

        let bGrad = ctx.createLinearGradient(0, -15, 60, 15);
        bGrad.addColorStop(0, '#555');
        bGrad.addColorStop(1, '#111');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.roundRect(0, -15, 60, 30, 5);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}

class Fireball {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 12;
        this.active = true;
        this.gravity = 0.15;
    }
    update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        
        for(let i=0; i<2; i++) {
            particles.push(new Particle(this.x + (Math.random()-0.5)*10, this.y + (Math.random()-0.5)*10, 'fire'));
        }

        if (this.x < 0 || this.x > width || this.y > height) {
            this.active = false;
        }
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        let grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, '#ffaa00');
        grad.addColorStop(1, '#ff0000');
        ctx.fillStyle = grad;
        ctx.shadowColor = '#ff4d00';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Target {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 20;
        this.active = true;
        this.vx = type === 2 ? (Math.random() > 0.5 ? 2 : -2) : 0;
        this.vy = type === 3 ? (Math.random() > 0.5 ? 1.5 : -1.5) : 0;
        this.startX = x;
        this.startY = y;
        this.health = type === 1 ? 1 : 2;
        this.maxHealth = this.health;
    }
    update() {
        if (this.type === 2) {
            this.x += this.vx;
            if (Math.abs(this.x - this.startX) > 80 || this.x < 20 || this.x > width - 20) this.vx *= -1;
        } else if (this.type === 3) {
            this.y += this.vy;
            if (Math.abs(this.y - this.startY) > 60 || this.y < 20 || this.y > height - 200) this.vy *= -1;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        let grad = ctx.createLinearGradient(-this.radius, -this.radius, this.radius, this.radius);
        grad.addColorStop(0, '#00ffcc');
        grad.addColorStop(1, '#005577');
        
        if (this.health < this.maxHealth) {
            grad.addColorStop(0, '#ff4444');
            grad.addColorStop(1, '#aa0000');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            let angle = (Math.PI / 3) * i;
            let px = this.radius * Math.cos(angle);
            let py = this.radius * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 10;
        ctx.fill();

        ctx.restore();
    }
}

class Obstacle {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
    draw(ctx) {
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.w, this.h);
        ctx.beginPath();
        ctx.moveTo(this.x + 5, this.y + 5);
        ctx.lineTo(this.x + this.w - 5, this.y + 5);
        ctx.strokeStyle = '#777';
        ctx.stroke();
    }
}

class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.active = true;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
        
        if(type === 'fire') {
            this.vx = (Math.random() - 0.5) * 1;
            this.vy = (Math.random() - 0.5) * 1 - 1;
            this.size = Math.random() * 6 + 2;
            this.color = ['#ff0000', '#ff7700', '#ffff00'][Math.floor(Math.random()*3)];
        } else if(type === 'explosion') {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 5 + 2;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.size = Math.random() * 5 + 3;
            this.color = ['#00ffcc', '#ffffff', '#005577'][Math.floor(Math.random()*3)];
            this.decay = Math.random() * 0.03 + 0.01;
        }
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        if(this.life <= 0) this.active = false;
        if(this.type === 'fire') this.size *= 0.9;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class FloatText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.active = true;
    }
    update() {
        this.y -= 1;
        this.life -= 0.02;
        if(this.life <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, this.x, this.y);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }
}

function initLevel() {
    fireballs = [];
    targets = [];
    obstacles = [];
    particles = [];
    floatText = [];
    
    shotsLeft = Math.max(5, 12 - level);
    updateHUD();
    
    let targetCount = Math.min(3 + level, 8);
    for(let i=0; i<targetCount; i++) {
        let tx = Math.random() * (width - 100) + 50;
        let ty = Math.random() * (height/2) + 50;
        let type = 1;
        if(level > 1 && Math.random() > 0.5) type = 2;
        if(level > 3 && Math.random() > 0.7) type = 3;
        targets.push(new Target(tx, ty, type));
    }
    
    let obsCount = Math.min(level - 1, 4);
    for(let i=0; i<obsCount; i++) {
        let ow = 80;
        let oh = 20;
        let ox = Math.random() * (width - ow);
        let oy = Math.random() * (height/2) + height/3;
        obstacles.push(new Obstacle(ox, oy, ow, oh));
    }
}

function startGame() {
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    hud.classList.add('visible');
    
    score = 0;
    level = 1;
    resize();
    player = new Cannon();
    initLevel();
    gameState = 'PLAYING';
    
    if(audioCtx.state === 'suspended') audioCtx.resume();
}

function endGame(win) {
    gameState = 'GAMEOVER';
    hud.classList.remove('visible');
    gameOverScreen.classList.add('active');
    finalScore.innerText = score;
    gameOverTitle.innerText = win ? 'YOU WIN!' : 'OUT OF SHOTS!';
    gameOverTitle.style.color = win ? '#00ffcc' : '#ff4d00';
}

function updateHUD() {
    scoreDisplay.innerText = score;
    shotsDisplay.innerText = shotsLeft;
    levelDisplay.innerText = 'LEVEL ' + level;
}

function checkCollisions() {
    for (let f of fireballs) {
        if (!f.active) continue;
        
        for (let t of targets) {
            if (!t.active) continue;
            let dx = f.x - t.x;
            let dy = f.y - t.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < f.radius + t.radius) {
                f.active = false;
                t.health--;
                playSound('hit');
                if (t.health <= 0) {
                    t.active = false;
                    score += 100 * t.type;
                    updateHUD();
                    for(let i=0; i<20; i++) particles.push(new Particle(t.x, t.y, 'explosion'));
                    floatText.push(new FloatText(t.x, t.y, '+' + (100*t.type), '#00ffcc'));
                } else {
                    for(let i=0; i<10; i++) particles.push(new Particle(t.x, t.y, 'explosion'));
                }
            }
        }
        
        for (let o of obstacles) {
            if (f.x > o.x && f.x < o.x + o.w && f.y > o.y && f.y < o.y + o.h) {
                f.active = false;
                playSound('hit');
                for(let i=0; i<10; i++) particles.push(new Particle(f.x, f.y, 'explosion'));
            }
        }
    }
}

function drawTrajectory() {
    if(!isDragging) return;
    
    let dx = dragStart.x - dragCurrent.x;
    let dy = dragStart.y - dragCurrent.y;
    let power = Math.min(Math.sqrt(dx*dx + dy*dy) * 0.1, 20);
    let angle = Math.atan2(dy, dx);
    
    player.angle = angle;
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    let simX = player.x + Math.cos(angle) * 60;
    let simY = player.y + Math.sin(angle) * 60;
    ctx.moveTo(simX, simY);
    
    let simVy = Math.sin(angle) * power;
    let simVx = Math.cos(angle) * power;
    
    for(let i=0; i<20; i++) {
        simVy += 0.15;
        simX += simVx;
        simY += simVy;
        ctx.lineTo(simX, simY);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

function loop(timestamp) {
    let dt = timestamp - lastTime;
    lastTime = timestamp;
    
    ctx.clearRect(0, 0, width, height);
    
    if (gameState === 'PLAYING' || gameState === 'LEVEL_TRANSITION') {
        player.draw(ctx);
        drawTrajectory();
        
        fireballs.forEach(f => { f.update(); f.draw(ctx); });
        targets.forEach(t => { t.update(); t.draw(ctx); });
        obstacles.forEach(o => o.draw(ctx));
        particles.forEach(p => { p.update(); p.draw(ctx); });
        floatText.forEach(ft => { ft.update(); ft.draw(ctx); });
        
        fireballs = fireballs.filter(f => f.active);
        targets = targets.filter(t => t.active);
        particles = particles.filter(p => p.active);
        floatText = floatText.filter(ft => ft.active);
        
        checkCollisions();
        
        if (gameState === 'PLAYING') {
            if (targets.length === 0) {
                gameState = 'LEVEL_TRANSITION';
                playSound('level');
                setTimeout(() => {
                    level++;
                    initLevel();
                    gameState = 'PLAYING';
                }, 2000);
            } else if (fireballs.length === 0 && shotsLeft === 0 && !isDragging) {
                endGame(false);
            }
        }
        
        if(gameState === 'LEVEL_TRANSITION') {
            ctx.fillStyle = 'rgba(0, 255, 204, 0.8)';
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('LEVEL COMPLETED!', width/2, height/2);
        }
    }
    
    requestAnimationFrame(loop);
}

function getEventPos(e) {
    if(e.touches) return {x: e.touches[0].clientX, y: e.touches[0].clientY};
    return {x: e.clientX, y: e.clientY};
}

function handleStart(e) {
    if(gameState !== 'PLAYING') return;
    if(e.target.tagName === 'BUTTON') return;
    isDragging = true;
    dragStart = getEventPos(e);
    dragCurrent = dragStart;
}

function handleMove(e) {
    if(!isDragging) return;
    e.preventDefault();
    dragCurrent = getEventPos(e);
}

function handleEnd(e) {
    if(!isDragging) return;
    isDragging = false;
    
    if(shotsLeft <= 0) return;
    
    let dx = dragStart.x - dragCurrent.x;
    let dy = dragStart.y - dragCurrent.y;
    let dist = Math.sqrt(dx*dx + dy*dy);
    
    if(dist > 10) {
        let power = Math.min(dist * 0.1, 20);
        let angle = Math.atan2(dy, dx);
        
        let vx = Math.cos(angle) * power;
        let vy = Math.sin(angle) * power;
        
        let spawnX = player.x + Math.cos(angle) * 60;
        let spawnY = player.y + Math.sin(angle) * 60;
        
        fireballs.push(new Fireball(spawnX, spawnY, vx, vy));
        shotsLeft--;
        updateHUD();
        playSound('shoot');
    }
}

canvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove, {passive: false});
window.addEventListener('mouseup', handleEnd);

canvas.addEventListener('touchstart', handleStart, {passive: false});
window.addEventListener('touchmove', handleMove, {passive: false});
window.addEventListener('touchend', handleEnd);

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

resize();
requestAnimationFrame(loop);
