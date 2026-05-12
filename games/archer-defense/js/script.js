const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const healthBar = document.getElementById('healthBar');
const finalScoreDisplay = document.getElementById('finalScore');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let gameState = 'START';
let wave = 1;
let towerHealth = 100;
let animationId;
let frameCount = 0;

const COLOR_PLAYER = '#00f3ff';
const COLOR_ENEMY = '#ff003c';
const COLOR_TOWER = '#333';
const COLOR_GROUND = '#111';

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let currentMouseX = 0;
let currentMouseY = 0;

// Player/Tower
const tower = {
    x: 100,
    width: 60,
    height: 150
};

const archer = {
    x: tower.x + 30,
    y: canvas.height - tower.height - 40,
    
    draw() {
        ctx.save();
        ctx.strokeStyle = COLOR_PLAYER;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLOR_PLAYER;
        
        // Head
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI*2);
        ctx.stroke();
        
        // Body
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 8);
        ctx.lineTo(this.x, this.y + 25);
        ctx.stroke();
        
        // Legs
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 25);
        ctx.lineTo(this.x - 10, this.y + 40);
        ctx.moveTo(this.x, this.y + 25);
        ctx.lineTo(this.x + 10, this.y + 40);
        ctx.stroke();
        
        // Bow and Arrow if dragging
        if (isDragging) {
            let dx = dragStartX - currentMouseX;
            let dy = dragStartY - currentMouseY;
            
            // Limit pull
            const pullDist = Math.min(100, Math.hypot(dx, dy));
            const angle = Math.atan2(dy, dx);
            
            // Arms holding bow
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + 12);
            ctx.lineTo(this.x + Math.cos(angle)*15, this.y + 12 + Math.sin(angle)*15);
            ctx.stroke();
            
            ctx.save();
            ctx.translate(this.x + Math.cos(angle)*20, this.y + 12 + Math.sin(angle)*20);
            ctx.rotate(angle);
            
            // Bow
            ctx.beginPath();
            ctx.arc(0, 0, 20, -Math.PI/2.5, Math.PI/2.5);
            ctx.stroke();
            
            // String
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
            ctx.beginPath();
            ctx.moveTo(Math.cos(-Math.PI/2.5)*20, Math.sin(-Math.PI/2.5)*20);
            ctx.lineTo(-pullDist * 0.3, 0);
            ctx.lineTo(Math.cos(Math.PI/2.5)*20, Math.sin(Math.PI/2.5)*20);
            ctx.stroke();
            
            // Arrow
            ctx.strokeStyle = '#fff';
            ctx.shadowColor = '#fff';
            ctx.beginPath();
            ctx.moveTo(-pullDist * 0.3, 0);
            ctx.lineTo(20, 0);
            ctx.stroke();
            
            ctx.restore();
        } else {
            // Idle arms
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + 12);
            ctx.lineTo(this.x + 10, this.y + 20);
            ctx.stroke();
        }
        
        ctx.restore();
    }
};

let arrows = [];
class Arrow {
    constructor(x, y, angle, power) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * (power * 0.3);
        this.vy = Math.sin(angle) * (power * 0.3);
        this.gravity = 0.2;
        this.active = true;
    }
    
    update() {
        if (!this.active) return;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        
        // Ground hit
        if (this.y > canvas.height - 10) {
            this.y = canvas.height - 10;
            this.active = false;
        }
        if (this.x > canvas.width) {
            this.active = false;
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.vy, this.vx));
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#fff';
        
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(5, 0);
        ctx.stroke();
        
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(0, -3);
        ctx.lineTo(0, 3);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();
        
        ctx.restore();
    }
}

let enemies = [];
class Enemy {
    constructor() {
        this.x = canvas.width + 50 + Math.random() * 200;
        this.y = canvas.height - 40;
        this.speed = 0.5 + Math.random() * 0.5 + (wave * 0.1);
        this.hp = 1 + Math.floor(wave / 5);
        this.state = 'WALKING'; // WALKING, ATTACKING, DEAD
        this.attackTimer = 0;
        
        // Animation
        this.legAngle = 0;
    }
    
    update() {
        if (this.state === 'DEAD') return;
        
        if (this.x > tower.x + tower.width + 10) {
            this.state = 'WALKING';
            this.x -= this.speed;
            this.legAngle += 0.1 * this.speed;
        } else {
            this.state = 'ATTACKING';
            this.attackTimer++;
            if (this.attackTimer > 60) {
                this.attackTimer = 0;
                towerHealth -= 5;
                updateHealth();
                spawnParticles(tower.x + tower.width, this.y, '#fff', 5);
            }
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        if (this.state === 'DEAD') {
            ctx.rotate(Math.PI/2);
            ctx.translate(20, -10);
            ctx.globalAlpha = 0.3;
        }
        
        ctx.strokeStyle = COLOR_ENEMY;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLOR_ENEMY;
        
        // Head
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI*2);
        ctx.stroke();
        
        // Body
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(0, 25);
        ctx.stroke();
        
        // Legs
        const swing = Math.sin(this.legAngle) * 10;
        ctx.beginPath();
        ctx.moveTo(0, 25);
        ctx.lineTo(-swing, 40);
        ctx.moveTo(0, 25);
        ctx.lineTo(swing, 40);
        ctx.stroke();
        
        // Arms
        if (this.state === 'ATTACKING') {
            const hit = Math.sin(this.attackTimer * 0.2) * 10;
            ctx.beginPath();
            ctx.moveTo(0, 12);
            ctx.lineTo(-15 + hit, 12);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(0, 12);
            ctx.lineTo(-swing, 20);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

let particles = [];
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
        this.color = color;
        this.size = Math.random() * 3 + 1;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // gravity
        this.life -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function drawBackground() {
    // Sky
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Moon
    ctx.fillStyle = 'rgba(255, 0, 234, 0.1)';
    ctx.beginPath(); ctx.arc(canvas.width*0.8, canvas.height*0.2, 100, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 0, 234, 0.2)';
    ctx.beginPath(); ctx.arc(canvas.width*0.8, canvas.height*0.2, 80, 0, Math.PI*2); ctx.fill();
    
    // Ground
    ctx.fillStyle = COLOR_GROUND;
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
    
    // Tower
    ctx.fillStyle = COLOR_TOWER;
    ctx.fillRect(tower.x, canvas.height - tower.height, tower.width, tower.height);
    
    // Tower neon edge
    ctx.strokeStyle = COLOR_PLAYER;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLOR_PLAYER;
    ctx.strokeRect(tower.x, canvas.height - tower.height, tower.width, tower.height);
    ctx.shadowBlur = 0;
}

function updateHealth() {
    healthBar.style.width = Math.max(0, towerHealth) + '%';
    if (towerHealth <= 0) {
        die();
    }
}

function die() {
    if (gameState === 'GAMEOVER') return;
    gameState = 'GAMEOVER';
    spawnParticles(tower.x + tower.width/2, canvas.height - tower.height/2, COLOR_PLAYER, 100);
    setTimeout(() => {
        finalScoreDisplay.textContent = wave;
        gameOverScreen.classList.add('active');
    }, 1500);
}

function spawnWave() {
    const numEnemies = 3 + wave * 2;
    for(let i=0; i<numEnemies; i++) {
        enemies.push(new Enemy());
    }
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    archer.draw();
    
    // Wave management
    let aliveEnemies = enemies.filter(e => e.state !== 'DEAD');
    if (aliveEnemies.length === 0 && enemies.length > 0) {
        wave++;
        scoreDisplay.textContent = `WAVE: ${wave}`;
        enemies = [];
        setTimeout(spawnWave, 2000);
    } else if (enemies.length === 0) {
        spawnWave();
    }
    
    // Arrows
    for (let i = arrows.length - 1; i >= 0; i--) {
        const a = arrows[i];
        a.update();
        a.draw();
        
        if (a.active) {
            // Check collision with enemies
            for (let j = 0; j < enemies.length; j++) {
                const e = enemies[j];
                if (e.state === 'DEAD') continue;
                
                // simple box collision
                if (a.x > e.x - 10 && a.x < e.x + 10 && a.y > e.y && a.y < e.y + 40) {
                    a.active = false;
                    e.hp--;
                    spawnParticles(a.x, a.y, COLOR_ENEMY, 10);
                    if (e.hp <= 0) {
                        e.state = 'DEAD';
                        spawnParticles(e.x, e.y, COLOR_ENEMY, 30);
                    }
                    break;
                }
            }
        }
        
        // Remove dead arrows
        if (!a.active && a.y >= canvas.height - 10) {
            // Keep on ground for a bit then remove (too many will lag)
            if (arrows.length > 20) {
                arrows.splice(i, 1);
            }
        }
    }
    
    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].update();
        enemies[i].draw();
        
        if (enemies[i].state === 'DEAD' && enemies[i].x < tower.x + tower.width) {
            enemies.splice(i, 1); // cleanup dead overlapping tower
        }
    }
    
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

function init() {
    wave = 1;
    towerHealth = 100;
    arrows = [];
    enemies = [];
    particles = [];
    
    scoreDisplay.textContent = `WAVE: 1`;
    updateHealth();
    
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    cancelAnimationFrame(animationId);
    gameLoop();
}

// Input Handling
function handleDown(e) {
    if (e.target.tagName === 'BUTTON') return;
    if (gameState === 'START') { init(); return; }
    if (gameState === 'GAMEOVER') {
        if (gameOverScreen.classList.contains('active')) init();
        return;
    }
    
    isDragging = true;
    let pos = e.touches ? e.touches[0] : e;
    dragStartX = pos.clientX;
    dragStartY = pos.clientY;
    currentMouseX = pos.clientX;
    currentMouseY = pos.clientY;
}

function handleMove(e) {
    if (!isDragging) return;
    let pos = e.touches ? e.touches[0] : e;
    currentMouseX = pos.clientX;
    currentMouseY = pos.clientY;
}

function handleUp() {
    if (isDragging && gameState === 'PLAYING') {
        isDragging = false;
        let dx = dragStartX - currentMouseX;
        let dy = dragStartY - currentMouseY;
        let pullDist = Math.hypot(dx, dy);
        
        if (pullDist > 10) {
            const angle = Math.atan2(dy, dx);
            const power = Math.min(100, pullDist);
            
            // Spawn arrow at bow position
            const bx = archer.x + Math.cos(angle)*20;
            const by = archer.y + 12 + Math.sin(angle)*20;
            
            arrows.push(new Arrow(bx, by, angle, power));
            spawnParticles(bx, by, '#fff', 3);
        }
    }
    isDragging = false;
}

window.addEventListener('mousedown', handleDown);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleUp);
window.addEventListener('touchstart', (e) => { if (e.target.tagName !== 'BUTTON') e.preventDefault(); handleDown(e); }, {passive: false});
window.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e); }, {passive: false});
window.addEventListener('touchend', handleUp);

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Initial draw
drawBackground();
archer.draw();