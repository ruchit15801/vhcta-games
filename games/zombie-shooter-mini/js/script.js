const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const finalScoreDisplay = document.getElementById('finalScore');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let gameState = 'START';
let score = 0;
let animationId;
let spawnRate = 60;
let frameCount = 0;

const COLOR_PLAYER = '#00f3ff';
const COLOR_ZOMBIE = '#00ff3c';
const COLOR_BULLET = '#ff00ea';
const COLOR_BLOOD = 'rgba(0, 255, 60, 0.5)';

// Player
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    targetX: canvas.width / 2,
    targetY: canvas.height / 2,
    radius: 15,
    speed: 4,
    fireTimer: 0,
    fireRate: 15,
    
    update() {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > this.speed) {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        } else {
            this.x = this.targetX;
            this.y = this.targetY;
        }
        
        // Boundaries
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));
        
        // Auto Fire
        this.fireTimer++;
        if (this.fireTimer >= this.fireRate) {
            this.fireTimer = 0;
            this.shootNearest();
        }
    },
    
    shootNearest() {
        if (zombies.length === 0) return;
        
        let nearest = null;
        let minDist = Infinity;
        
        zombies.forEach(z => {
            const d = Math.hypot(this.x - z.x, this.y - z.y);
            if (d < minDist) {
                minDist = d;
                nearest = z;
            }
        });
        
        if (nearest && minDist < 400) {
            const angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
            bullets.push(new Bullet(this.x, this.y, angle));
            
            // Recoil
            this.x -= Math.cos(angle) * 3;
            this.y -= Math.sin(angle) * 3;
        }
    },
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        ctx.fillStyle = 'rgba(0, 243, 255, 0.2)';
        ctx.strokeStyle = COLOR_PLAYER;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_PLAYER;
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
};

let bullets = [];
class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * 12;
        this.vy = Math.sin(angle) * 12;
        this.radius = 4;
        this.life = 60;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }
    
    draw() {
        ctx.save();
        ctx.fillStyle = COLOR_BULLET;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLOR_BULLET;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

let zombies = [];
class Zombie {
    constructor() {
        this.radius = 12 + Math.random() * 5;
        this.speed = Math.random() * 1.5 + 0.5 + (score * 0.005);
        this.hp = Math.floor(1 + score * 0.02);
        this.maxHp = this.hp;
        
        // Spawn on edges
        if (Math.random() < 0.5) {
            this.x = Math.random() < 0.5 ? -this.radius : canvas.width + this.radius;
            this.y = Math.random() * canvas.height;
        } else {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() < 0.5 ? -this.radius : canvas.height + this.radius;
        }
    }
    
    update() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        ctx.fillStyle = `rgba(0, 255, 60, ${this.hp / this.maxHp * 0.8 + 0.2})`;
        ctx.strokeStyle = COLOR_ZOMBIE;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLOR_ZOMBIE;
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
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
        this.size = Math.random() * 4 + 1;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.life -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}

let splats = []; // Persistent blood on ground

function drawBackground() {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for(let x=0; x<canvas.width; x+=50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for(let y=0; y<canvas.height; y+=50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    
    // Splats
    splats.forEach(s => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.fillStyle = COLOR_BLOOD;
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.arc(0, 0, s.size, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        s.alpha -= 0.001; // Fade out slowly
    });
    
    // Remove faded splats
    splats = splats.filter(s => s.alpha > 0);
}

function spawnExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
    if (color === COLOR_ZOMBIE) {
        splats.push({x: x, y: y, size: Math.random() * 15 + 5, alpha: 0.5});
    }
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    player.update();
    player.draw();
    
    // Spawning
    frameCount++;
    if (frameCount >= spawnRate) {
        frameCount = 0;
        zombies.push(new Zombie());
        // Decrease spawn rate to increase difficulty
        spawnRate = Math.max(15, 60 - (score * 0.5));
    }
    
    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.update();
        b.draw();
        
        let hit = false;
        for (let j = zombies.length - 1; j >= 0; j--) {
            const z = zombies[j];
            const dist = Math.hypot(b.x - z.x, b.y - z.y);
            if (dist < z.radius + b.radius) {
                hit = true;
                z.hp--;
                spawnExplosion(b.x, b.y, COLOR_BULLET);
                if (z.hp <= 0) {
                    spawnExplosion(z.x, z.y, COLOR_ZOMBIE);
                    zombies.splice(j, 1);
                    score += 10;
                    scoreDisplay.textContent = `SCORE: ${score}`;
                }
                break;
            }
        }
        
        if (hit || b.life <= 0) {
            bullets.splice(i, 1);
        }
    }
    
    // Zombies
    for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i];
        z.update();
        z.draw();
        
        // Check player collision
        const dist = Math.hypot(player.x - z.x, player.y - z.y);
        if (dist < player.radius + z.radius - 5) {
            gameOver();
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

function gameOver() {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationId);
    
    spawnExplosion(player.x, player.y, COLOR_PLAYER);
    spawnExplosion(player.x, player.y, '#fff');
    
    drawBackground();
    splats.forEach(s => { ctx.fillStyle = COLOR_BLOOD; ctx.globalAlpha = s.alpha; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill(); });
    zombies.forEach(z => z.draw());
    particles.forEach(p => { p.update(); p.draw(); });
    
    finalScoreDisplay.textContent = score;
    setTimeout(() => {
        gameOverScreen.classList.add('active');
    }, 500);
}

function init() {
    score = 0;
    spawnRate = 60;
    frameCount = 0;
    zombies = [];
    bullets = [];
    particles = [];
    splats = [];
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.targetX = player.x;
    player.targetY = player.y;
    scoreDisplay.textContent = `SCORE: 0`;
    
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    cancelAnimationFrame(animationId);
    gameLoop();
}

function handleInput(e) {
    if (gameState !== 'PLAYING') return;
    let posX, posY;
    if (e.touches && e.touches.length > 0) {
        posX = e.touches[0].clientX;
        posY = e.touches[0].clientY;
    } else {
        posX = e.clientX;
        posY = e.clientY;
    }
    player.targetX = posX;
    player.targetY = posY;
}

window.addEventListener('mousemove', handleInput);
window.addEventListener('mousedown', handleInput);
window.addEventListener('touchmove', handleInput, {passive: false});
window.addEventListener('touchstart', handleInput, {passive: false});

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Initial draw
drawBackground();
player.draw();