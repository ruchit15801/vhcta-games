const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const levelDisplay = document.getElementById('levelDisplay');
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
let level = 1;
let animationId;
let knivesToThrow = 5;
let knivesThrown = 0;

// Colors
const COLOR_DISC = '#111';
const COLOR_DISC_OUTLINE = '#ff00ea';
const COLOR_KNIFE = '#00f3ff';
const COLOR_KNIFE_DANGER = '#ff003c';

// Particles
let particles = [];
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 15;
        this.vy = (Math.random() - 0.5) * 15;
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

// Disc Entity
const disc = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 3,
    radius: 80,
    rotation: 0,
    baseSpeed: 0.02,
    speed: 0.02,
    knives: [], // Angles where knives are stuck (in radians relative to disc)
    
    update() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 3;
        
        // Complex rotation patterns based on level
        if (level > 5) {
            this.speed = this.baseSpeed + Math.sin(Date.now() / 1000) * 0.03;
        } else if (level > 2) {
            this.speed = this.baseSpeed + Math.sin(Date.now() / 2000) * 0.02;
        }
        
        this.rotation += this.speed;
        if (this.rotation >= Math.PI * 2) this.rotation -= Math.PI * 2;
        if (this.rotation < 0) this.rotation += Math.PI * 2;
    },
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw stuck knives first so they go under the disc slightly
        this.knives.forEach(angle => {
            ctx.save();
            ctx.rotate(angle);
            drawKnife(0, this.radius, true);
            ctx.restore();
        });
        
        // Draw Disc
        ctx.fillStyle = COLOR_DISC;
        ctx.strokeStyle = COLOR_DISC_OUTLINE;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLOR_DISC_OUTLINE;
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        
        // Center dot
        ctx.fillStyle = COLOR_DISC_OUTLINE;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
};

// Player Knife
let activeKnife = null;
class Knife {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 100;
        this.vy = 0;
        this.active = true;
    }
    
    throw() {
        if (this.vy === 0) {
            this.vy = -35;
        }
    }
    
    update() {
        this.x = canvas.width / 2; // Keep centered horizontally
        this.y += this.vy;
        
        // Check collision with disc
        if (this.vy < 0 && this.y <= disc.y + disc.radius) {
            this.active = false;
            
            // Calculate hit angle relative to current disc rotation
            // The knife hits exactly at the bottom (Math.PI/2 in canvas coordinates relative to disc center)
            // But since the disc is rotated, we need to subtract its rotation
            let hitAngle = (Math.PI / 2) - disc.rotation;
            
            // Normalize angle
            while (hitAngle < 0) hitAngle += Math.PI * 2;
            while (hitAngle >= Math.PI * 2) hitAngle -= Math.PI * 2;
            
            // Check if hit another knife
            let hit = false;
            const hitTolerance = 0.25; // Radians
            
            for (let angle of disc.knives) {
                let diff = Math.abs(angle - hitAngle);
                if (diff > Math.PI) diff = Math.PI * 2 - diff; // shortest distance
                
                if (diff < hitTolerance) {
                    hit = true;
                    break;
                }
            }
            
            if (hit) {
                // Game Over
                spawnExplosion(this.x, this.y, COLOR_KNIFE_DANGER);
                gameOver();
            } else {
                // Successful stick
                disc.knives.push(hitAngle);
                score += 10;
                knivesThrown++;
                updateHUD();
                
                spawnExplosion(this.x, this.y, COLOR_DISC_OUTLINE);
                
                // Shake disc effect
                disc.y -= 10;
                setTimeout(() => disc.y += 10, 50);
                
                // Next level or next knife
                if (knivesThrown >= knivesToThrow) {
                    nextLevel();
                } else {
                    activeKnife = new Knife();
                }
            }
        }
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        drawKnife(0, 0, false);
        ctx.restore();
    }
}

function drawKnife(x, y, isStuck) {
    ctx.strokeStyle = isStuck ? '#aaa' : COLOR_KNIFE;
    ctx.fillStyle = isStuck ? '#444' : 'rgba(0, 243, 255, 0.2)';
    ctx.lineWidth = 2;
    if (!isStuck) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_KNIFE;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y); // Tip
    ctx.lineTo(x + 5, y + 20); // Right edge
    ctx.lineTo(x + 5, y + 40); // Handle right
    ctx.lineTo(x - 5, y + 40); // Handle left
    ctx.lineTo(x - 5, y + 20); // Left edge
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Handle detail
    ctx.fillStyle = isStuck ? '#222' : COLOR_KNIFE;
    ctx.fillRect(x - 2, y + 25, 4, 15);
}

function spawnExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateHUD() {
    scoreDisplay.textContent = `SCORE: ${score}`;
    levelDisplay.textContent = `LEVEL: ${level}`;
}

function drawKnivesRemaining() {
    const startX = 30;
    const startY = canvas.height - 50;
    const spacing = 20;
    
    for (let i = 0; i < knivesToThrow - knivesThrown; i++) {
        ctx.save();
        ctx.translate(startX + (i % 10) * spacing, startY - Math.floor(i / 10) * 40);
        ctx.scale(0.5, 0.5);
        ctx.rotate(-Math.PI/4);
        drawKnife(0, 0, false);
        ctx.restore();
    }
}

function nextLevel() {
    level++;
    knivesThrown = 0;
    knivesToThrow = 5 + Math.floor(level * 1.5);
    disc.baseSpeed = 0.02 + (level * 0.005);
    disc.speed = disc.baseSpeed;
    
    // Pre-populate some random knives based on level
    disc.knives = [];
    const preStuck = Math.min(level - 1, 8);
    for (let i = 0; i < preStuck; i++) {
        let angle = Math.random() * Math.PI * 2;
        // Basic check to ensure they don't overlap initially
        let overlap = false;
        for (let existing of disc.knives) {
            let diff = Math.abs(angle - existing);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < 0.3) {
                overlap = true;
                break;
            }
        }
        if (!overlap) disc.knives.push(angle);
    }
    
    updateHUD();
    activeKnife = new Knife();
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background glow pulse
    const pulse = Math.sin(Date.now() / 500) * 0.05 + 0.1;
    ctx.fillStyle = `rgba(255, 0, 234, ${pulse})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    disc.update();
    disc.draw();
    
    if (activeKnife) {
        activeKnife.update();
        if (activeKnife.active) {
            activeKnife.draw();
        }
    }
    
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    drawKnivesRemaining();
    
    animationId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationId);
    
    // Death Explosion
    spawnExplosion(canvas.width/2, canvas.height/3 + disc.radius, COLOR_KNIFE_DANGER);
    
    // Render one last frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    disc.draw();
    particles.forEach(p => { p.update(); p.draw(); });
    
    finalScoreDisplay.textContent = score;
    setTimeout(() => {
        gameOverScreen.classList.add('active');
    }, 500);
}

function init() {
    score = 0;
    level = 1;
    knivesThrown = 0;
    knivesToThrow = 5;
    disc.baseSpeed = 0.02;
    disc.knives = [];
    particles = [];
    
    activeKnife = new Knife();
    updateHUD();
    
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    cancelAnimationFrame(animationId);
    gameLoop();
}

function handleInput(e) {
    // Prevent default touch behavior (like zooming/scrolling)
    if (e.type === 'touchstart') e.preventDefault();
    
    if (gameState === 'START') {
        init();
    } else if (gameState === 'PLAYING') {
        if (activeKnife && activeKnife.vy === 0) {
            activeKnife.throw();
        }
    } else if (gameState === 'GAMEOVER') {
        if (gameOverScreen.classList.contains('active')) {
             init();
        }
    }
}

window.addEventListener('mousedown', handleInput);
window.addEventListener('touchstart', handleInput, {passive: false});

startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Initial draw
disc.x = canvas.width / 2;
disc.y = canvas.height / 3;
disc.draw();