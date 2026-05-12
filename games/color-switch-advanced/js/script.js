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
let animationId;
let cameraY = 0;

// Colors
const COLORS = [
    '#ff00ea', // Pink
    '#00f3ff', // Cyan
    '#fff200', // Yellow
    '#9d00ff'  // Purple
];

// Entities
let obstacles = [];
let items = [];
let particles = [];

// Player
const player = {
    x: canvas.width / 2,
    y: canvas.height - 200,
    radius: 12,
    vy: 0,
    gravity: 0.6,
    jumpStrength: -9,
    colorIndex: 0,
    dead: false,
    
    reset() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 200;
        this.vy = 0;
        this.colorIndex = Math.floor(Math.random() * COLORS.length);
        this.dead = false;
        cameraY = 0;
    },
    
    jump() {
        if (!this.dead) {
            this.vy = this.jumpStrength;
            // Jump puff
            for(let i=0; i<5; i++){
                particles.push(new Particle(this.x, this.y + this.radius, '#fff', 0.5));
            }
        }
    },
    
    update() {
        if (this.dead) return;
        
        this.vy += this.gravity;
        this.y += this.vy;
        
        // Camera follow
        const targetCamY = canvas.height / 2 - this.y;
        if (targetCamY > cameraY) {
            cameraY += (targetCamY - cameraY) * 0.1;
        }
        
        // Die if fall too far below camera
        if (this.y > canvas.height - cameraY + 100) {
            die();
        }
    },
    
    draw() {
        if (this.dead) return;
        
        ctx.save();
        ctx.fillStyle = COLORS[this.colorIndex];
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS[this.colorIndex];
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner white core
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
};

class RingObstacle {
    constructor(y) {
        this.x = canvas.width / 2;
        this.y = y;
        this.radius = 80;
        this.thickness = 15;
        this.rotation = 0;
        this.speed = (Math.random() * 0.02 + 0.02) * (Math.random() > 0.5 ? 1 : -1);
        this.passed = false;
        this.type = 'ring';
    }
    
    update() {
        this.rotation += this.speed;
        if (this.rotation >= Math.PI * 2) this.rotation -= Math.PI * 2;
        if (this.rotation < 0) this.rotation += Math.PI * 2;
        
        // Check collision and score
        if (!player.dead) {
            // Did player pass it?
            if (!this.passed && player.y < this.y) {
                this.passed = true;
                score++;
                scoreDisplay.textContent = score;
                spawnParticles(player.x, player.y, '#fff', 15);
            }
            
            // Precise collision using distance from center
            const dist = Math.abs(this.y - player.y);
            const rDist = Math.abs(dist - this.radius);
            
            // If ball is at the ring's edge level
            if (rDist < this.thickness/2 + player.radius) {
                // Determine which color arc the player is touching
                // Since player is at x = center, we only care about top/bottom arcs
                let angle = player.y < this.y ? -Math.PI/2 : Math.PI/2;
                
                // Adjust angle by rotation to find the local angle
                let localAngle = angle - this.rotation;
                while (localAngle < 0) localAngle += Math.PI * 2;
                while (localAngle >= Math.PI * 2) localAngle -= Math.PI * 2;
                
                // Each arc is PI/2 rad. 0-PI/2: color 0, PI/2-PI: color 1, etc.
                let segment = Math.floor(localAngle / (Math.PI / 2));
                
                if (segment !== player.colorIndex) {
                    die();
                }
            }
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.lineWidth = this.thickness;
        
        for (let i = 0; i < 4; i++) {
            ctx.strokeStyle = COLORS[i];
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLORS[i];
            
            ctx.beginPath();
            // Slight gap between arcs
            ctx.arc(0, 0, this.radius, (i * Math.PI / 2) + 0.05, ((i + 1) * Math.PI / 2) - 0.05);
            ctx.stroke();
        }
        ctx.restore();
    }
}

class ColorSwitcher {
    constructor(y) {
        this.x = canvas.width / 2;
        this.y = y;
        this.radius = 15;
        this.rotation = 0;
        this.active = true;
    }
    
    update() {
        if (!this.active || player.dead) return;
        this.rotation += 0.05;
        
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist < this.radius + player.radius) {
            this.active = false;
            // Change player color to something different
            let newColor;
            do {
                newColor = Math.floor(Math.random() * COLORS.length);
            } while (newColor === player.colorIndex);
            
            player.colorIndex = newColor;
            spawnParticles(this.x, this.y, COLORS[newColor], 30);
        }
    }
    
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = COLORS[i];
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, this.radius, i * Math.PI / 2, (i + 1) * Math.PI / 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, speedMultiplier = 1) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 6 + 2) * speedMultiplier;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.01;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95;
        this.vy *= 0.95;
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

function generateLevel() {
    obstacles = [];
    items = [];
    let currentY = canvas.height - 400;
    
    // Generate obstacles going way up
    for (let i = 0; i < 100; i++) {
        obstacles.push(new RingObstacle(currentY));
        // Add color switcher halfway to next obstacle
        items.push(new ColorSwitcher(currentY - 200));
        currentY -= 400;
    }
}

function drawBackground() {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Stars
    ctx.fillStyle = '#fff';
    // Use cameraY to parallax stars
    for(let i=0; i<50; i++) {
        const sx = (i * 73) % canvas.width;
        const sy = (i * 113 + cameraY * 0.2) % canvas.height;
        ctx.globalAlpha = (i % 5) / 10 + 0.1;
        ctx.beginPath();
        ctx.arc(sx, (sy + canvas.height) % canvas.height, (i%3)+1, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

function die() {
    if (player.dead) return;
    player.dead = true;
    spawnParticles(player.x, player.y, COLORS[player.colorIndex], 50);
    setTimeout(gameOver, 1000);
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    ctx.save();
    ctx.translate(0, cameraY); // Apply camera
    
    // Cleanup far objects
    obstacles = obstacles.filter(o => o.y < player.y + 800);
    items = items.filter(i => i.y < player.y + 800);
    
    items.forEach(item => { item.update(); item.draw(); });
    obstacles.forEach(obs => { obs.update(); obs.draw(); });
    
    player.update();
    player.draw();
    
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    ctx.restore();
    
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
    scoreDisplay.textContent = `0`;
    particles = [];
    
    player.reset();
    generateLevel();
    
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    cancelAnimationFrame(animationId);
    gameLoop();
}

function handleInput(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    // Prevent default touch behavior
    if (e.type === 'touchstart') e.preventDefault();
    
    if (gameState === 'START') {
        init();
    } else if (gameState === 'PLAYING') {
        player.jump();
    } else if (gameState === 'GAMEOVER') {
        if (gameOverScreen.classList.contains('active')) {
             init();
        }
    }
}

window.addEventListener('mousedown', handleInput);
window.addEventListener('touchstart', handleInput, {passive: false});
window.addEventListener('keydown', handleInput);

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Initial draw
drawBackground();
player.draw();