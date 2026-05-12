const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const waveDisplay = document.getElementById('waveDisplay');
const finalScoreDisplay = document.getElementById('finalScore');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let gameState = 'START';
let score = 0;
let wave = 1;
let animationId;
let frameCount = 0;

const COLOR_PLAYER = '#00f3ff';
const COLOR_ENEMY = '#ff00ea';
const COLOR_BULLET = '#fff200';
const COLOR_GRID = 'rgba(0, 243, 255, 0.1)';

// Inputs
const keys = {};
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let isMouseDown = false;

// Virtual Joysticks
const joysticks = {
    left: { active: false, id: null, startX: 0, startY: 0, currentX: 0, currentY: 0 },
    right: { active: false, id: null, startX: 0, startY: 0, currentX: 0, currentY: 0 }
};

// Player Tank
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 24,
    speed: 4,
    angle: 0, // Movement angle
    turretAngle: 0,
    fireRate: 15,
    fireTimer: 0,
    dead: false,
    
    update() {
        if (this.dead) return;
        
        let dx = 0; let dy = 0;
        
        // Keyboard movement
        if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
        
        // Joystick movement
        if (joysticks.left.active) {
            const jdx = joysticks.left.currentX - joysticks.left.startX;
            const jdy = joysticks.left.currentY - joysticks.left.startY;
            const dist = Math.hypot(jdx, jdy);
            if (dist > 10) {
                dx = jdx / dist;
                dy = jdy / dist;
            }
        }
        
        // Normalize
        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            dx /= len; dy /= len;
            this.angle = Math.atan2(dy, dx);
            this.x += dx * this.speed;
            this.y += dy * this.speed;
        }
        
        // Boundaries
        this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
        this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));
        
        // Aiming
        if (joysticks.right.active) {
            const jdx = joysticks.right.currentX - joysticks.right.startX;
            const jdy = joysticks.right.currentY - joysticks.right.startY;
            if (Math.hypot(jdx, jdy) > 10) {
                this.turretAngle = Math.atan2(jdy, jdx);
                this.fireTimer++;
                if (this.fireTimer > this.fireRate) {
                    this.fireTimer = 0;
                    this.shoot();
                }
            }
        } else {
            this.turretAngle = Math.atan2(mouseY - this.y, mouseX - this.x);
            if (isMouseDown) {
                this.fireTimer++;
                if (this.fireTimer > this.fireRate) {
                    this.fireTimer = 0;
                    this.shoot();
                }
            } else {
                this.fireTimer = this.fireRate; // ready to shoot instantly
            }
        }
    },
    
    shoot() {
        bullets.push(new Bullet(this.x, this.y, this.turretAngle, false));
        // Recoil
        this.x -= Math.cos(this.turretAngle) * 3;
        this.y -= Math.sin(this.turretAngle) * 3;
    },
    
    draw() {
        if (this.dead) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Body (rotates with movement)
        ctx.save();
        ctx.rotate(this.angle);
        ctx.fillStyle = 'rgba(0, 243, 255, 0.2)';
        ctx.strokeStyle = COLOR_PLAYER;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_PLAYER;
        ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        // Tracks
        ctx.fillStyle = COLOR_PLAYER;
        ctx.fillRect(-this.size/2 - 4, -this.size/2 - 2, 8, this.size + 4);
        ctx.fillRect(this.size/2 - 4, -this.size/2 - 2, 8, this.size + 4);
        ctx.restore();
        
        // Turret (rotates with aim)
        ctx.rotate(this.turretAngle);
        ctx.fillStyle = COLOR_PLAYER;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI*2);
        ctx.fill();
        ctx.fillRect(0, -3, 20, 6); // Barrel
        
        ctx.restore();
    }
};

let bullets = [];
class Bullet {
    constructor(x, y, angle, isEnemy) {
        // start slightly ahead of barrel
        this.x = x + Math.cos(angle) * 20;
        this.y = y + Math.sin(angle) * 20;
        this.vx = Math.cos(angle) * 10;
        this.vy = Math.sin(angle) * 10;
        this.radius = 4;
        this.bounces = 1; // can bounce once
        this.isEnemy = isEnemy;
        this.color = isEnemy ? COLOR_ENEMY : COLOR_BULLET;
        this.life = 120;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        
        // Bounce off walls
        if (this.x < this.radius || this.x > canvas.width - this.radius) {
            if (this.bounces > 0) {
                this.vx *= -1;
                this.bounces--;
                spawnParticles(this.x, this.y, this.color, 3);
            } else {
                this.life = 0;
            }
        }
        if (this.y < this.radius || this.y > canvas.height - this.radius) {
            if (this.bounces > 0) {
                this.vy *= -1;
                this.bounces--;
                spawnParticles(this.x, this.y, this.color, 3);
            } else {
                this.life = 0;
            }
        }
    }
    
    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Trail effect
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(this.x - this.vx, this.y - this.vy, this.radius*0.8, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}

let enemies = [];
class Enemy {
    constructor() {
        this.size = 24;
        // Spawn edge
        if (Math.random() < 0.5) {
            this.x = Math.random() < 0.5 ? -50 : canvas.width + 50;
            this.y = Math.random() * canvas.height;
        } else {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() < 0.5 ? -50 : canvas.height + 50;
        }
        
        this.speed = 1.5 + (wave * 0.2);
        this.angle = 0;
        this.turretAngle = 0;
        this.fireRate = Math.max(60, 120 - wave * 10);
        this.fireTimer = Math.random() * this.fireRate;
        this.hp = 1 + Math.floor(wave / 3);
        
        // State: 0=seek player, 1=strafe
        this.stateTimer = 0;
        this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    }
    
    update() {
        if (player.dead) return;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        
        this.turretAngle = Math.atan2(dy, dx);
        
        this.stateTimer++;
        if (this.stateTimer > 100) {
            this.stateTimer = 0;
            this.strafeDir = Math.random() > 0.5 ? 1 : -1;
        }
        
        let moveAngle;
        if (dist > 200) {
            // move towards
            moveAngle = this.turretAngle;
        } else {
            // strafe
            moveAngle = this.turretAngle + (Math.PI/2) * this.strafeDir;
        }
        
        this.angle += (moveAngle - this.angle) * 0.1;
        this.x += Math.cos(moveAngle) * this.speed;
        this.y += Math.sin(moveAngle) * this.speed;
        
        // Boundaries (keep inside once spawned)
        if (this.x > 0 && this.x < canvas.width && this.y > 0 && this.y < canvas.height) {
            this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
            this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));
        }
        
        // Fire
        if (dist < 400) {
            this.fireTimer++;
            if (this.fireTimer > this.fireRate) {
                this.fireTimer = 0;
                // Lead target slightly
                const leadAngle = this.turretAngle + (Math.random()-0.5)*0.2;
                bullets.push(new Bullet(this.x, this.y, leadAngle, true));
            }
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Body
        ctx.save();
        ctx.rotate(this.angle);
        ctx.fillStyle = `rgba(255, 0, 234, ${this.hp > 1 ? 0.5 : 0.2})`;
        ctx.strokeStyle = COLOR_ENEMY;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLOR_ENEMY;
        ctx.beginPath();
        ctx.moveTo(this.size/2, 0);
        ctx.lineTo(-this.size/2, this.size/2);
        ctx.lineTo(-this.size/2, -this.size/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        // Turret
        ctx.rotate(this.turretAngle);
        ctx.fillStyle = COLOR_ENEMY;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.fillRect(0, -2, 18, 4); // Barrel
        
        ctx.restore();
    }
}

let particles = [];
class Particle {
    constructor(x, y, color, speedMultiplier = 1) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 5 + 1) * speedMultiplier;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
        this.color = color;
        this.size = Math.random() * 3 + 2;
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
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    const gridOffset = (Date.now() / 50) % 40;
    
    ctx.beginPath();
    for(let x = gridOffset; x < canvas.width; x += 40) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    for(let y = gridOffset; y < canvas.height; y += 40) {
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
}

function drawJoysticks() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    
    if (joysticks.left.active) {
        ctx.beginPath();
        ctx.arc(joysticks.left.startX, joysticks.left.startY, 40, 0, Math.PI*2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(joysticks.left.currentX, joysticks.left.currentY, 20, 0, Math.PI*2);
        ctx.fill();
    }
    
    if (joysticks.right.active) {
        ctx.beginPath();
        ctx.arc(joysticks.right.startX, joysticks.right.startY, 40, 0, Math.PI*2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(joysticks.right.currentX, joysticks.right.currentY, 20, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.restore();
}

function nextWave() {
    wave++;
    waveDisplay.textContent = `WAVE: ${wave}`;
    const numEnemies = 2 + Math.floor(wave * 1.5);
    for(let i=0; i<numEnemies; i++) {
        enemies.push(new Enemy());
    }
    spawnParticles(canvas.width/2, canvas.height/2, '#fff', 50);
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    player.update();
    player.draw();
    
    // Wave Management
    if (enemies.length === 0) {
        nextWave();
    }
    
    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.update();
        b.draw();
        
        if (b.life <= 0) {
            bullets.splice(i, 1);
            continue;
        }
        
        let hit = false;
        
        if (b.isEnemy) {
            // Check player collision
            if (!player.dead && Math.hypot(b.x - player.x, b.y - player.y) < player.size/2 + b.radius) {
                spawnParticles(player.x, player.y, COLOR_PLAYER, 50);
                player.dead = true;
                hit = true;
                setTimeout(gameOver, 1500);
            }
        } else {
            // Check enemy collision
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (Math.hypot(b.x - e.x, b.y - e.y) < e.size/2 + b.radius) {
                    e.hp--;
                    hit = true;
                    spawnParticles(b.x, b.y, COLOR_BULLET, 5);
                    if (e.hp <= 0) {
                        spawnParticles(e.x, e.y, COLOR_ENEMY, 20);
                        enemies.splice(j, 1);
                        score += 100 * wave;
                        scoreDisplay.textContent = `SCORE: ${score}`;
                    }
                    break;
                }
            }
        }
        
        if (hit) {
            bullets.splice(i, 1);
        }
    }
    
    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].update();
        enemies[i].draw();
    }
    
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    drawJoysticks();
    
    animationId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationId);
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.add('active');
}

function init() {
    score = 0;
    wave = 1;
    scoreDisplay.textContent = `SCORE: 0`;
    waveDisplay.textContent = `WAVE: 1`;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.dead = false;
    bullets = [];
    enemies = [];
    particles = [];
    
    // Start with 2 enemies
    enemies.push(new Enemy());
    enemies.push(new Enemy());
    
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    cancelAnimationFrame(animationId);
    gameLoop();
}

// Input Handling
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
window.addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON') return;
    isMouseDown = true;
});
window.addEventListener('mouseup', () => { isMouseDown = false; });

// Touch Joysticks
function handleTouch(e) {
    if (gameState !== 'PLAYING') return;
    e.preventDefault();
    
    const touches = e.touches;
    let leftTouch = false;
    let rightTouch = false;
    
    for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        if (t.clientX < canvas.width / 2) {
            leftTouch = true;
            if (!joysticks.left.active) {
                joysticks.left.active = true;
                joysticks.left.id = t.identifier;
                joysticks.left.startX = t.clientX;
                joysticks.left.startY = t.clientY;
            }
            if (joysticks.left.id === t.identifier) {
                joysticks.left.currentX = t.clientX;
                joysticks.left.currentY = t.clientY;
            }
        } else {
            rightTouch = true;
            if (!joysticks.right.active) {
                joysticks.right.active = true;
                joysticks.right.id = t.identifier;
                joysticks.right.startX = t.clientX;
                joysticks.right.startY = t.clientY;
            }
            if (joysticks.right.id === t.identifier) {
                joysticks.right.currentX = t.clientX;
                joysticks.right.currentY = t.clientY;
            }
        }
    }
    
    if (!leftTouch) joysticks.left.active = false;
    if (!rightTouch) joysticks.right.active = false;
}

window.addEventListener('touchstart', handleTouch, {passive: false});
window.addEventListener('touchmove', handleTouch, {passive: false});
window.addEventListener('touchend', handleTouch, {passive: false});

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Initial draw
drawBackground();
player.draw();