const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const ammoDisplay = document.getElementById('ammoDisplay');
const finalScoreDisplay = document.getElementById('finalScore');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Game State
let gameState = 'START';
let score = 0;
let ammo = 10;
let animationId;

const COLOR_CANNON = '#00f3ff';
const COLOR_PROJECTILE = '#00f3ff';
const COLOR_TARGET = '#ff00ea';
const COLOR_TRAJECTORY = 'rgba(0, 243, 255, 0.5)';

// Physics & Entities
const gravity = 0.5;

class Cannon {
    constructor() {
        this.width = 40;
        this.height = 80;
        this.x = canvas.width / 2;
        this.y = canvas.height - 50;
        this.angle = 0;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Base
        ctx.fillStyle = '#111';
        ctx.strokeStyle = COLOR_CANNON;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_CANNON;
        
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Barrel
        ctx.fillStyle = 'rgba(0, 243, 255, 0.1)';
        ctx.beginPath();
        ctx.rect(-15, -this.height, 30, this.height);
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 8;
        this.active = true;
    }
    
    update() {
        this.vy += gravity;
        this.x += this.vx;
        this.y += this.vy;
        
        if (this.y > canvas.height || this.x < 0 || this.x > canvas.width) {
            this.active = false;
        }
    }
    
    draw() {
        ctx.save();
        ctx.fillStyle = COLOR_PROJECTILE;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_PROJECTILE;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Target {
    constructor() {
        this.radius = Math.random() * 20 + 15;
        this.x = Math.random() < 0.5 ? -this.radius : canvas.width + this.radius;
        this.y = Math.random() * (canvas.height / 2) + 50;
        this.vx = (Math.random() * 2 + 1) * (this.x < 0 ? 1 : -1);
        this.vy = Math.sin(this.x * 0.05) * 2; // Wavy motion
        this.active = true;
        this.health = 1;
        this.shape = Math.floor(Math.random() * 3);
    }
    
    update() {
        this.x += this.vx;
        this.y += Math.sin(this.x * 0.02) * 2; // Wavy flight
        
        if ((this.vx > 0 && this.x > canvas.width + this.radius) ||
            (this.vx < 0 && this.x < -this.radius)) {
            this.active = false; // Off screen
        }
    }
    
    draw() {
        ctx.save();
        ctx.strokeStyle = COLOR_TARGET;
        ctx.fillStyle = 'rgba(255, 0, 234, 0.2)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_TARGET;
        
        ctx.translate(this.x, this.y);
        ctx.rotate(Date.now() * 0.002);
        
        ctx.beginPath();
        if (this.shape === 0) { // Circle
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        } else if (this.shape === 1) { // Square
            ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        } else { // Triangle
            ctx.moveTo(0, -this.radius);
            ctx.lineTo(this.radius, this.radius);
            ctx.lineTo(-this.radius, this.radius);
            ctx.closePath();
        }
        
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }
    
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Globals
const cannon = new Cannon();
let projectiles = [];
let targets = [];
let particles = [];

// Input Handling
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let currentMouseX = 0;
let currentMouseY = 0;

function getEventPos(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function handleStart(e) {
    if (gameState !== 'PLAYING') return;
    const pos = getEventPos(e);
    isDragging = true;
    dragStartX = pos.x;
    dragStartY = pos.y;
    currentMouseX = pos.x;
    currentMouseY = pos.y;
}

function handleMove(e) {
    if (!isDragging) return;
    const pos = getEventPos(e);
    currentMouseX = pos.x;
    currentMouseY = pos.y;
    
    // Calculate angle based on drag direction (drag backwards like a slingshot)
    const dx = dragStartX - currentMouseX;
    const dy = dragStartY - currentMouseY;
    if (dx !== 0 || dy !== 0) {
        cannon.angle = Math.atan2(dx, -dy);
    }
}

function handleEnd(e) {
    if (!isDragging || gameState !== 'PLAYING') return;
    isDragging = false;
    
    if (ammo > 0) {
        const dx = dragStartX - currentMouseX;
        const dy = dragStartY - currentMouseY;
        
        // Power based on drag distance
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 10) {
            const power = Math.min(dist * 0.15, 30);
            const vx = Math.sin(cannon.angle) * power;
            const vy = -Math.cos(cannon.angle) * power;
            
            // Spawn projectile at barrel end
            const px = cannon.x + Math.sin(cannon.angle) * cannon.height;
            const py = cannon.y - Math.cos(cannon.angle) * cannon.height;
            
            projectiles.push(new Projectile(px, py, vx, vy));
            ammo--;
            updateHUD();
            
            // Recoil effect
            cannon.y += 10;
            setTimeout(() => cannon.y -= 10, 50);
        }
    }
    
    if (ammo <= 0 && projectiles.length === 0) {
        setTimeout(() => checkGameOver(), 1000);
    }
}

window.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);
window.addEventListener('touchstart', handleStart, {passive: false});
window.addEventListener('touchmove', handleMove, {passive: false});
window.addEventListener('touchend', handleEnd);

function spawnExplosion(x, y, color) {
    for (let i = 0; i < 30; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateHUD() {
    scoreDisplay.textContent = `SCORE: ${score}`;
    ammoDisplay.textContent = `AMMO: ${ammo}`;
    if (ammo <= 3) ammoDisplay.style.color = '#ff0000';
    else ammoDisplay.style.color = '#ffaa00';
}

function drawTrajectory() {
    if (!isDragging) return;
    
    const dx = dragStartX - currentMouseX;
    const dy = dragStartY - currentMouseY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist <= 10) return;
    
    const power = Math.min(dist * 0.15, 30);
    let vx = Math.sin(cannon.angle) * power;
    let vy = -Math.cos(cannon.angle) * power;
    
    let px = cannon.x + Math.sin(cannon.angle) * cannon.height;
    let py = cannon.y - Math.cos(cannon.angle) * cannon.height;
    
    ctx.save();
    ctx.fillStyle = COLOR_TRAJECTORY;
    for (let i = 0; i < 30; i++) {
        px += vx;
        vy += gravity;
        py += vy;
        
        if (i % 3 === 0) {
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

let targetTimer = 0;

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Grid Background
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridOffset = (Date.now() / 50) % 50;
    for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = gridOffset; y < canvas.height; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    ctx.restore();
    
    // Spawn Targets
    targetTimer++;
    if (targetTimer > 60) {
        if (Math.random() > 0.3) targets.push(new Target());
        targetTimer = 0;
    }
    
    // Update & Draw
    cannon.x = canvas.width / 2; // Keep centered on resize
    cannon.draw();
    drawTrajectory();
    
    // Targets
    for (let i = targets.length - 1; i >= 0; i--) {
        let t = targets[i];
        t.update();
        t.draw();
        if (!t.active) targets.splice(i, 1);
    }
    
    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.update();
        p.draw();
        
        // Collision
        for (let j = targets.length - 1; j >= 0; j--) {
            let t = targets[j];
            const dist = Math.hypot(p.x - t.x, p.y - t.y);
            if (dist < p.radius + t.radius) {
                // Hit
                spawnExplosion(t.x, t.y, COLOR_TARGET);
                spawnExplosion(p.x, p.y, COLOR_PROJECTILE);
                targets.splice(j, 1);
                p.active = false;
                score += 100;
                // Reward ammo for hits
                if (Math.random() > 0.5) ammo += 1;
                updateHUD();
                break;
            }
        }
        
        if (!p.active) projectiles.splice(i, 1);
    }
    
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    // Ammo check
    if (ammo <= 0 && projectiles.length === 0 && !isDragging) {
        checkGameOver();
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

function checkGameOver() {
    if (ammo <= 0 && projectiles.length === 0) {
        gameState = 'GAMEOVER';
        finalScoreDisplay.textContent = score;
        gameOverScreen.classList.add('active');
    }
}

function init() {
    score = 0;
    ammo = 15;
    projectiles = [];
    targets = [];
    particles = [];
    isDragging = false;
    cannon.angle = 0;
    updateHUD();
    
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    gameState = 'PLAYING';
    
    // Initial targets
    for(let i=0; i<3; i++) targets.push(new Target());
    
    cancelAnimationFrame(animationId);
    gameLoop();
}

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Initial draw
cannon.draw();