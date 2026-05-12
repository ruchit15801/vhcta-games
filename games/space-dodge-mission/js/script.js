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

// Game State
let gameState = 'START';
let score = 0;
let speed = 5;
let animationId;

// Colors
const COLOR_SHIP = '#00f3ff';
const COLOR_ASTEROID = '#ff003c';
const COLOR_STAR = '#ffffff';

// Stars Background
let stars = [];
for (let i = 0; i < 100; i++) {
    stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 2,
        speed: Math.random() * 3 + 1
    });
}

function drawStars() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = COLOR_STAR;
    stars.forEach(star => {
        star.y += star.speed + (speed * 0.2);
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
        ctx.globalAlpha = Math.random() * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;
}

// Player Ship
const ship = {
    x: window.innerWidth / 2,
    y: window.innerHeight - 100,
    width: 40,
    height: 50,
    targetX: window.innerWidth / 2,
    
    reset() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 100;
        this.targetX = this.x;
    },
    
    update() {
        // Smooth follow mouse/touch
        this.x += (this.targetX - this.x) * 0.15;
        
        // Clamp to screen
        if (this.x < this.width/2) this.x = this.width/2;
        if (this.x > canvas.width - this.width/2) this.x = canvas.width - this.width/2;
    },
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Thruster flame
        ctx.fillStyle = '#ffaa00';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(-10, this.height/2);
        ctx.lineTo(10, this.height/2);
        ctx.lineTo(0, this.height/2 + Math.random() * 30 + 10);
        ctx.closePath();
        ctx.fill();
        
        // Ship Body
        ctx.strokeStyle = COLOR_SHIP;
        ctx.fillStyle = 'rgba(0, 243, 255, 0.1)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_SHIP;
        
        ctx.beginPath();
        ctx.moveTo(0, -this.height/2); // Nose
        ctx.lineTo(this.width/2, this.height/2); // Right wing
        ctx.lineTo(-this.width/2, this.height/2); // Left wing
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Cockpit
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fff';
        ctx.beginPath();
        ctx.arc(0, -this.height/4, 4, 0, Math.PI*2);
        ctx.fill();
        
        ctx.restore();
    }
};

// Asteroids
let asteroids = [];
class Asteroid {
    constructor() {
        this.radius = Math.random() * 20 + 15;
        this.x = Math.random() * (canvas.width - this.radius*2) + this.radius;
        this.y = -this.radius;
        this.vy = speed + Math.random() * 2;
        this.vx = (Math.random() - 0.5) * 2;
        this.rotation = 0;
        this.rotSpeed = (Math.random() - 0.5) * 0.1;
        this.vertices = [];
        
        // Generate irregular shape
        const numPoints = 6 + Math.floor(Math.random() * 4);
        for(let i=0; i<numPoints; i++) {
            const angle = (Math.PI * 2 / numPoints) * i;
            const r = this.radius * (0.8 + Math.random() * 0.4);
            this.vertices.push({x: Math.cos(angle)*r, y: Math.sin(angle)*r});
        }
    }
    
    update() {
        this.y += this.vy;
        this.x += this.vx;
        this.rotation += this.rotSpeed;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.strokeStyle = COLOR_ASTEROID;
        ctx.fillStyle = 'rgba(255, 0, 60, 0.1)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_ASTEROID;
        
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for(let i=1; i<this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    }
}

// Particles for Explosion
let particles = [];
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
        this.color = color;
        this.size = Math.random() * 3 + 2;
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
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}

let spawnTimer = 0;

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStars();
    
    ship.update();
    ship.draw();
    
    // Spawn Asteroids
    spawnTimer++;
    const spawnRate = Math.max(10, 40 - speed);
    if (spawnTimer > spawnRate) {
        asteroids.push(new Asteroid());
        spawnTimer = 0;
    }
    
    // Update Score
    score += 1;
    if (score % 10 === 0) {
        scoreDisplay.textContent = `SCORE: ${Math.floor(score/10)}`;
    }
    
    // Increase difficulty
    if (score % 1000 === 0) {
        speed += 0.5;
    }
    
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        a.update();
        a.draw();
        
        // Collision
        // Approximate circle collision for triangle ship
        const dist = Math.hypot(ship.x - a.x, ship.y - a.y);
        if (dist < a.radius + 15) {
            gameOver();
        }
        
        if (a.y - a.radius > canvas.height || a.x + a.radius < 0 || a.x - a.radius > canvas.width) {
            asteroids.splice(i, 1);
        }
    }
    
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
    
    for(let i=0; i<50; i++) {
        particles.push(new Particle(ship.x, ship.y, COLOR_SHIP));
        particles.push(new Particle(ship.x, ship.y, '#ffaa00'));
    }
    
    drawStars();
    asteroids.forEach(a => a.draw());
    particles.forEach(p => { p.update(); p.draw(); });
    
    finalScoreDisplay.textContent = Math.floor(score/10);
    setTimeout(() => {
        gameOverScreen.classList.add('active');
    }, 500);
}

function init() {
    score = 0;
    speed = 5;
    asteroids = [];
    particles = [];
    ship.reset();
    scoreDisplay.textContent = `SCORE: 0`;
    
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    cancelAnimationFrame(animationId);
    gameLoop();
}

function handleInputMove(e) {
    if (gameState !== 'PLAYING') return;
    if (e.touches && e.touches.length > 0) {
        ship.targetX = e.touches[0].clientX;
    } else {
        ship.targetX = e.clientX;
    }
}

window.addEventListener('mousemove', handleInputMove);
window.addEventListener('touchmove', handleInputMove, {passive: false});

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Initial draw
drawStars();
ship.reset();
ship.draw();