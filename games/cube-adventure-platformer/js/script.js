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

// Constants
const COLOR_CUBE = '#00ff88';
const COLOR_SPIKE = '#ff003c';
const GROUND_HEIGHT = 150;

// Game State
let gameState = 'START';
let score = 0;
let speed = 6;
let animationId;
let distance = 0;

// Particles
let particles = [];
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 1) * 2; // Move left relative to cube
        this.vy = (Math.random() - 0.5) * 2;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
        this.color = color;
        this.size = Math.random() * 6 + 2;
    }
    update() {
        this.x += this.vx - speed * 0.5; // Scroll left with background
        this.y += this.vy;
        this.life -= this.decay;
        this.size = Math.max(0, this.size - 0.1);
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

// Cube Player
const cube = {
    x: 150,
    y: 0,
    size: 40,
    vy: 0,
    gravity: 0.8,
    jumpStrength: -16,
    rotation: 0,
    grounded: false,

    reset() {
        this.y = canvas.height - GROUND_HEIGHT - this.size;
        this.vy = 0;
        this.rotation = 0;
    },

    jump() {
        if (this.grounded) {
            this.vy = this.jumpStrength;
            this.grounded = false;
            // Jump particles
            for(let i=0; i<15; i++) {
                particles.push(new Particle(this.x + this.size/2, this.y + this.size, '#fff'));
            }
        }
    },

    update() {
        this.vy += this.gravity;
        this.y += this.vy;

        const groundY = canvas.height - GROUND_HEIGHT;
        if (this.y + this.size >= groundY) {
            this.y = groundY - this.size;
            this.vy = 0;
            this.grounded = true;
            // Snap rotation to nearest 90 degrees when landing
            this.rotation = Math.round(this.rotation / (Math.PI/2)) * (Math.PI/2);
        } else {
            this.rotation += 0.1; // Spin while in air
        }

        // Trail
        if (this.grounded && Math.random() > 0.5) {
            particles.push(new Particle(this.x, this.y + this.size - 5, COLOR_CUBE));
        }
    },

    draw() {
        ctx.save();
        ctx.translate(this.x + this.size/2, this.y + this.size/2);
        ctx.rotate(this.rotation);
        
        ctx.strokeStyle = COLOR_CUBE;
        ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLOR_CUBE;
        
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);
        
        // Inner detail
        ctx.fillStyle = COLOR_CUBE;
        ctx.fillRect(-this.size/4, -this.size/4, this.size/2, this.size/2);

        ctx.restore();
    }
};

// Obstacles
let obstacles = [];
class Obstacle {
    constructor() {
        this.width = 40;
        this.height = Math.random() > 0.5 ? 40 : 80; // Single or double spike
        this.x = canvas.width;
        this.y = canvas.height - GROUND_HEIGHT - this.height;
        this.passed = false;
    }
    
    update() {
        this.x -= speed;
    }

    draw() {
        ctx.save();
        ctx.strokeStyle = COLOR_SPIKE;
        ctx.fillStyle = 'rgba(255, 0, 60, 0.2)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_SPIKE;
        
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y); // Top
        ctx.lineTo(this.x + this.width, this.y + this.height); // Bottom right
        ctx.lineTo(this.x, this.y + this.height); // Bottom left
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}

let spawnTimer = 0;

function drawBackground() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid Floor
    const groundY = canvas.height - GROUND_HEIGHT;
    
    // Draw neon ground line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.strokeStyle = COLOR_CUBE;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLOR_CUBE;
    ctx.stroke();

    // Moving grid patterns
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
    
    const offset = distance % 50;
    for(let x = -offset; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x - 50, canvas.height);
        ctx.stroke();
    }
    
    for(let i=0; i<3; i++) {
        ctx.beginPath();
        const y = groundY + 30 + (i*40);
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Abstract geometric background elements
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for(let x = -(distance*0.2)%200; x < canvas.width; x+=200) {
        ctx.strokeRect(x, 100, 100, 100);
        ctx.strokeRect(x+50, 50, 100, 100);
    }
    ctx.restore();
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    distance += speed;
    
    drawBackground();

    // Player
    cube.update();
    cube.draw();

    // Spawn Obstacles
    spawnTimer++;
    const spawnRate = Math.max(50, 100 - speed * 2);
    if (spawnTimer > spawnRate && Math.random() > 0.05) {
        obstacles.push(new Obstacle());
        spawnTimer = 0;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.update();
        obs.draw();

        // Collision Check (AABB with slight leniency)
        const shrink = 8;
        if (
            cube.x + shrink < obs.x + obs.width - shrink &&
            cube.x + cube.size - shrink > obs.x + shrink &&
            cube.y + shrink < obs.y + obs.height - shrink &&
            cube.y + cube.size - shrink > obs.y + shrink
        ) {
            gameOver();
        }

        if (obs.x + obs.width < cube.x && !obs.passed) {
            obs.passed = true;
            score += 10;
            scoreDisplay.textContent = `SCORE: ${score}`;
            
            if (score % 100 === 0) {
                speed += 0.5;
            }
        }

        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    animationId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationId);
    
    // Death Explosion
    for(let i=0; i<40; i++) {
        particles.push(new Particle(cube.x + cube.size/2, cube.y + cube.size/2, COLOR_CUBE));
        particles.push(new Particle(cube.x + cube.size/2, cube.y + cube.size/2, COLOR_SPIKE));
    }
    
    drawBackground();
    obstacles.forEach(o => o.draw());
    particles.forEach(p => { p.update(); p.draw(); });
    
    finalScoreDisplay.textContent = score;
    setTimeout(() => {
        gameOverScreen.classList.add('active');
    }, 500);
}

function init() {
    cube.reset();
    obstacles = [];
    particles = [];
    score = 0;
    speed = 8;
    distance = 0;
    spawnTimer = 0;
    scoreDisplay.textContent = `SCORE: ${score}`;
    
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    cancelAnimationFrame(animationId);
    gameLoop();
}

function handleInput(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    
    if (gameState === 'START') {
        init();
    } else if (gameState === 'PLAYING') {
        cube.jump();
    } else if (gameState === 'GAMEOVER') {
        if (gameOverScreen.classList.contains('active')) {
             init();
        }
    }
}

window.addEventListener('keydown', handleInput);
window.addEventListener('touchstart', handleInput, {passive: false});

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Initial draw
drawBackground();
cube.reset();
cube.draw();