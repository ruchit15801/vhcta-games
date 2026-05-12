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
let distance = 0;
let speed = 6;
let animationId;
let isFlying = false;

const COLOR_PLAYER = '#00f3ff';
const COLOR_JETPACK = '#ffaa00';
const COLOR_LASER = '#ff003c';
const COLOR_BG_LINES = 'rgba(0, 243, 255, 0.1)';

const player = {
    x: 150,
    y: canvas.height / 2,
    radius: 15,
    vy: 0,
    gravity: 0.5,
    thrust: -0.9,
    
    update() {
        if (isFlying) {
            this.vy += this.thrust;
            // Particles
            spawnParticles(this.x - 10, this.y + 10, COLOR_JETPACK, 2);
        } else {
            this.vy += this.gravity;
        }
        
        this.y += this.vy;
        
        // Ceiling and Floor collisions
        if (this.y < this.radius) {
            this.y = this.radius;
            this.vy = 0;
        }
        if (this.y > canvas.height - this.radius) {
            // Floor is death
            die();
        }
    },
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Jetpack Backpack
        ctx.fillStyle = '#555';
        ctx.fillRect(-this.radius - 5, -5, 8, 20);
        
        // Player Body
        ctx.fillStyle = 'rgba(0, 243, 255, 0.2)';
        ctx.strokeStyle = COLOR_PLAYER;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_PLAYER;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        
        // Eye
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(6, -4, 4, 0, Math.PI*2);
        ctx.fill();
        
        ctx.restore();
    }
};

let obstacles = [];
class Laser {
    constructor() {
        this.x = canvas.width + 50;
        this.width = 20;
        // 0: top, 1: bottom, 2: middle floating
        const type = Math.floor(Math.random() * 3);
        const gap = 200 - (speed * 5); // gap shrinks as speed increases
        
        if (type === 0) {
            this.y = 0;
            this.height = Math.random() * (canvas.height/2) + 50;
        } else if (type === 1) {
            this.height = Math.random() * (canvas.height/2) + 50;
            this.y = canvas.height - this.height;
        } else {
            this.y = Math.random() * (canvas.height - 200) + 100;
            this.height = 150;
        }
    }
    
    update() {
        this.x -= speed;
    }
    
    draw() {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 60, 0.2)';
        ctx.strokeStyle = COLOR_LASER;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_LASER;
        
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // Internal electric line
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y);
        ctx.lineTo(this.x + this.width/2, this.y + this.height);
        ctx.stroke();
        
        ctx.restore();
    }
}

let particles = [];
class Particle {
    constructor(x, y, color, speedMultiplier = 1) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const s = (Math.random() * 4 + 1) * speedMultiplier;
        this.vx = Math.cos(angle) * s - speed * 0.5; // move back with scroll
        this.vy = Math.sin(angle) * s;
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
    
    // Corridor lines
    ctx.strokeStyle = COLOR_BG_LINES;
    ctx.lineWidth = 2;
    const offset = (distance * 0.5) % 100;
    
    // Ceiling and floor
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(canvas.width, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, canvas.height - 10); ctx.lineTo(canvas.width, canvas.height - 10); ctx.stroke();
    
    // Perspective lines
    for(let x = -offset; x < canvas.width; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 10);
        ctx.lineTo(x - 50, Math.min(100, canvas.height/4));
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - 10);
        ctx.lineTo(x - 50, Math.max(canvas.height - 100, canvas.height*3/4));
        ctx.stroke();
    }
}

let spawnTimer = 0;

function die() {
    if (gameState === 'GAMEOVER') return;
    gameState = 'GAMEOVER';
    spawnParticles(player.x, player.y, COLOR_PLAYER, 30);
    spawnParticles(player.x, player.y, COLOR_LASER, 20);
    setTimeout(() => {
        finalScoreDisplay.textContent = Math.floor(distance / 10);
        gameOverScreen.classList.add('active');
    }, 1000);
}

function gameLoop() {
    if (gameState !== 'PLAYING') {
        if (gameState === 'GAMEOVER') {
            // keep rendering particles
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawBackground();
            obstacles.forEach(o => o.draw());
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]; p.update(); p.draw();
                if (p.life <= 0) particles.splice(i, 1);
            }
            animationId = requestAnimationFrame(gameLoop);
        }
        return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    distance += speed;
    if (Math.floor(distance) % 1000 === 0) {
        speed += 0.5;
    }
    
    scoreDisplay.textContent = `DISTANCE: ${Math.floor(distance / 10)}M`;
    
    drawBackground();
    
    // Spawning
    spawnTimer++;
    const spawnRate = Math.max(40, 100 - speed * 4);
    if (spawnTimer > spawnRate) {
        obstacles.push(new Laser());
        spawnTimer = 0;
    }
    
    player.update();
    player.draw();
    
    // Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.update();
        obs.draw();
        
        // Collision
        if (player.x + player.radius > obs.x && player.x - player.radius < obs.x + obs.width &&
            player.y + player.radius > obs.y && player.y - player.radius < obs.y + obs.height) {
            die();
        }
        
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
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
    distance = 0;
    speed = 6;
    spawnTimer = 0;
    obstacles = [];
    particles = [];
    player.y = canvas.height / 2;
    player.vy = 0;
    isFlying = false;
    
    scoreDisplay.textContent = `DISTANCE: 0M`;
    
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    cancelAnimationFrame(animationId);
    gameLoop();
}

function handleDown(e) {
    if (e.target.tagName === 'BUTTON') return;
    if (e.type === 'touchstart') e.preventDefault();
    if (gameState === 'START') init();
    else if (gameState === 'PLAYING') isFlying = true;
    else if (gameState === 'GAMEOVER' && gameOverScreen.classList.contains('active')) init();
}

function handleUp(e) {
    if (e.type === 'touchend') e.preventDefault();
    isFlying = false;
}

window.addEventListener('mousedown', handleDown);
window.addEventListener('mouseup', handleUp);
window.addEventListener('touchstart', handleDown, {passive: false});
window.addEventListener('touchend', handleUp, {passive: false});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (gameState === 'START') init();
        else if (gameState === 'PLAYING') isFlying = true;
        else if (gameState === 'GAMEOVER' && gameOverScreen.classList.contains('active')) init();
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') isFlying = false;
});

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Initial draw
drawBackground();
player.draw();