const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const finalScoreDisplay = document.getElementById('finalScore');

// Resize canvas to fill screen
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Assets
const bgImage = new Image();
bgImage.src = 'assets/bg.png';

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let gameSpeed = 5;
let animationId;
let bgOffset = 0;

// Colors
const COLOR_NEON_BLUE = '#00f3ff';
const COLOR_NEON_PINK = '#ff00ea';

// Particles
let particles = [];
class Particle {
    constructor(x, y, color, speedX, speedY, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.speedX = speedX;
        this.speedY = speedY;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 3 + 1;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life--;
        this.size = Math.max(0.1, this.size - 0.05);
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function spawnParticles(x, y, color, count, speedFactor) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(
            x, y, color,
            (Math.random() - 0.5) * speedFactor,
            (Math.random() - 0.5) * speedFactor,
            Math.random() * 30 + 20
        ));
    }
}

// Player
const player = {
    x: 100,
    y: 0,
    width: 40,
    height: 60,
    vy: 0,
    gravity: 0.8,
    jumpStrength: -15,
    grounded: false,
    jumps: 0,
    maxJumps: 2,
    
    reset() {
        this.y = canvas.height - 100 - this.height;
        this.vy = 0;
        this.jumps = 0;
    },
    
    jump() {
        if (this.jumps < this.maxJumps) {
            this.vy = this.jumpStrength;
            this.jumps++;
            this.grounded = false;
            // Spawn jump particles
            spawnParticles(this.x + this.width/2, this.y + this.height, COLOR_NEON_BLUE, 15, 5);
        }
    },
    
    update() {
        this.vy += this.gravity;
        this.y += this.vy;
        
        // Ground collision
        const groundY = canvas.height - 100;
        if (this.y + this.height >= groundY) {
            this.y = groundY - this.height;
            this.vy = 0;
            this.grounded = true;
            this.jumps = 0;
        }

        // Trail particles when running
        if (this.grounded && Math.random() < 0.3) {
            particles.push(new Particle(
                this.x, this.y + this.height, 
                COLOR_NEON_BLUE, 
                -2 + Math.random(), -1 + Math.random(), 20
            ));
        }
    },
    
    draw() {
        ctx.save();
        ctx.strokeStyle = COLOR_NEON_BLUE;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_NEON_BLUE;
        ctx.fillStyle = 'rgba(0, 243, 255, 0.1)';
        
        // Procedural cyberpunk runner shape (leaning forward)
        ctx.beginPath();
        const lean = this.grounded ? 15 : 0;
        ctx.moveTo(this.x + lean, this.y); // Top left (head)
        ctx.lineTo(this.x + this.width + lean, this.y); // Top right
        ctx.lineTo(this.x + this.width, this.y + this.height); // Bottom right
        ctx.lineTo(this.x, this.y + this.height); // Bottom left
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Eye glow
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#fff';
        ctx.fillRect(this.x + this.width - 10 + lean, this.y + 10, 8, 4);

        ctx.restore();
    }
};

// Obstacles
let obstacles = [];
class Obstacle {
    constructor() {
        this.width = Math.random() > 0.5 ? 30 : 50;
        this.height = Math.random() * 40 + 30; // 30 to 70 height
        this.x = canvas.width;
        this.y = canvas.height - 100 - this.height;
        this.passed = false;
    }
    
    update() {
        this.x -= gameSpeed;
    }
    
    draw() {
        ctx.save();
        ctx.strokeStyle = COLOR_NEON_PINK;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_NEON_PINK;
        ctx.fillStyle = 'rgba(255, 0, 234, 0.1)';
        
        // Spike shape
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Warning core
        ctx.beginPath();
        ctx.moveTo(this.x + this.width/2, this.y + 10);
        ctx.lineTo(this.x + this.width - 10, this.y + this.height - 5);
        ctx.lineTo(this.x + 10, this.y + this.height - 5);
        ctx.fillStyle = COLOR_NEON_PINK;
        ctx.fill();

        ctx.restore();
    }
}

let obstacleTimer = 0;
function handleObstacles() {
    obstacleTimer++;
    // Spawn rate based on speed
    const spawnRate = Math.max(40, 120 - gameSpeed * 5); 
    
    if (obstacleTimer > spawnRate && Math.random() > 0.1) {
        obstacles.push(new Obstacle());
        obstacleTimer = 0;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.update();
        obs.draw();

        // Collision detection (AABB with some leniency)
        const shrink = 10; // Hitbox shrink for fairness
        if (
            player.x + shrink < obs.x + obs.width - shrink &&
            player.x + player.width - shrink > obs.x + shrink &&
            player.y + shrink < obs.y + obs.height - shrink &&
            player.y + player.height - shrink > obs.y + shrink
        ) {
            gameOver();
        }

        // Score
        if (obs.x + obs.width < player.x && !obs.passed) {
            score += 10;
            obs.passed = true;
            scoreDisplay.textContent = `SCORE: ${score}`;
            
            // Increase speed
            if (score % 100 === 0) {
                gameSpeed += 0.5;
                spawnParticles(player.x, player.y, '#fff', 30, 8); // Level up effect
            }
        }

        // Remove off-screen
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }
    }
}

function drawBackground() {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (bgImage.complete && bgImage.width > 0) {
        // Draw scrolling background
        const ratio = canvas.height / bgImage.height;
        const scaledWidth = bgImage.width * ratio;
        
        bgOffset -= gameSpeed * 0.2; // Parallax
        if (bgOffset <= -scaledWidth) bgOffset = 0;

        ctx.globalAlpha = 0.6;
        ctx.drawImage(bgImage, bgOffset, 0, scaledWidth, canvas.height);
        ctx.drawImage(bgImage, bgOffset + scaledWidth, 0, scaledWidth, canvas.height);
        ctx.globalAlpha = 1.0;
    }

    // Grid Floor
    const groundY = canvas.height - 100;
    
    // Draw neon ground line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.strokeStyle = COLOR_NEON_BLUE;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = COLOR_NEON_BLUE;
    ctx.stroke();

    // Perspective grid on ground
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    
    const gridSpeed = gameSpeed;
    // We use a counter for grid movement
    const gridOffset = (Date.now() / 1000 * gridSpeed * 20) % 50;
    
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        const startX = i - gridOffset;
        ctx.moveTo(startX, groundY);
        ctx.lineTo(startX - 100, canvas.height); // Angle left
        ctx.stroke();
    }
    
    // Horizontal grid lines
    for(let i=0; i<4; i++) {
        ctx.beginPath();
        const y = groundY + i * 25;
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    ctx.restore();
}

function init() {
    player.reset();
    obstacles = [];
    particles = [];
    score = 0;
    gameSpeed = 6;
    bgOffset = 0;
    scoreDisplay.textContent = `SCORE: ${score}`;
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    gameLoop();
}

function gameOver() {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationId);
    
    // Death explosion
    spawnParticles(player.x + player.width/2, player.y + player.height/2, COLOR_NEON_BLUE, 50, 10);
    spawnParticles(player.x + player.width/2, player.y + player.height/2, COLOR_NEON_PINK, 50, 10);
    
    // Render one last frame to show explosion
    drawBackground();
    obstacles.forEach(o => o.draw());
    particles.forEach(p => p.draw());
    
    finalScoreDisplay.textContent = score;
    setTimeout(() => {
        gameOverScreen.classList.add('active');
    }, 500);
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBackground();
    
    player.update();
    player.draw();
    
    handleObstacles();

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

// Controls
function handleInput(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    
    if (gameState === 'START') {
        init();
    } else if (gameState === 'PLAYING') {
        player.jump();
    } else if (gameState === 'GAMEOVER') {
        // Prevent accidental immediate restart
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
player.reset();
player.draw();