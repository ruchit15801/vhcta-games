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
let cameraY = 0;

const BLOCK_HEIGHT = 40;
const INITIAL_WIDTH = 250;

let blocks = [];
let debris = [];
let currentBlock = null;

const COLORS = [
    '#ff00ea', '#00f3ff', '#fff200', '#00ff88', '#ff003c', '#9d00ff'
];

class Block {
    constructor(x, y, width, colorIndex, dir) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.colorIndex = colorIndex;
        this.color = COLORS[this.colorIndex % COLORS.length];
        this.dir = dir; // 1 = right, -1 = left, 0 = stationary
        this.speed = 3 + (score * 0.1);
    }
    
    update() {
        if (this.dir !== 0) {
            this.x += this.speed * this.dir;
            // Bounce off edges
            if (this.x > canvas.width - this.width/2 && this.dir === 1) this.dir = -1;
            if (this.x < -this.width/2 && this.dir === -1) this.dir = 1;
        }
    }
    
    draw(camY) {
        ctx.save();
        ctx.translate(this.x, this.y + camY);
        
        // Front Face
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(0, 0, this.width, BLOCK_HEIGHT);
        
        // Top Face (pseudo 3D)
        ctx.fillStyle = lighten(this.color, 40);
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(15, -15);
        ctx.lineTo(this.width + 15, -15);
        ctx.lineTo(this.width, 0);
        ctx.closePath();
        ctx.fill();
        
        // Right Face
        ctx.fillStyle = darken(this.color, 40);
        ctx.beginPath();
        ctx.moveTo(this.width, 0);
        ctx.lineTo(this.width + 15, -15);
        ctx.lineTo(this.width + 15, BLOCK_HEIGHT - 15);
        ctx.lineTo(this.width, BLOCK_HEIGHT);
        ctx.closePath();
        ctx.fill();
        
        // Edge highlights
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(0, 0, this.width, BLOCK_HEIGHT);
        
        ctx.restore();
    }
}

class Debris {
    constructor(x, y, width, colorIndex) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.color = COLORS[colorIndex % COLORS.length];
        this.vy = 0;
        this.vx = (Math.random() - 0.5) * 4;
        this.gravity = 0.5;
        this.rotation = 0;
        this.rotSpeed = (Math.random() - 0.5) * 0.1;
    }
    
    update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotSpeed;
    }
    
    draw(camY) {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + camY + BLOCK_HEIGHT/2);
        ctx.rotate(this.rotation);
        
        // Front Face
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(-this.width/2, -BLOCK_HEIGHT/2, this.width, BLOCK_HEIGHT);
        
        ctx.restore();
    }
}

// Color helpers
function hexToRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}
function lighten(hex, percent) {
    let rgb = hexToRgb(hex);
    if (!rgb) return hex;
    let r = Math.min(255, rgb.r + percent);
    let g = Math.min(255, rgb.g + percent);
    let b = Math.min(255, rgb.b + percent);
    return `rgb(${r},${g},${b})`;
}
function darken(hex, percent) {
    let rgb = hexToRgb(hex);
    if (!rgb) return hex;
    let r = Math.max(0, rgb.r - percent);
    let g = Math.max(0, rgb.g - percent);
    let b = Math.max(0, rgb.b - percent);
    return `rgb(${r},${g},${b})`;
}

function spawnNextBlock() {
    let lastBlock = blocks[blocks.length - 1];
    let y = lastBlock.y - BLOCK_HEIGHT;
    let dir = Math.random() > 0.5 ? 1 : -1;
    let x = dir === 1 ? -lastBlock.width : canvas.width;
    
    currentBlock = new Block(x, y, lastBlock.width, score + 1, dir);
}

function dropBlock() {
    let lastBlock = blocks[blocks.length - 1];
    currentBlock.dir = 0; // stop moving
    
    let overlapLeft = Math.max(currentBlock.x, lastBlock.x);
    let overlapRight = Math.min(currentBlock.x + currentBlock.width, lastBlock.x + lastBlock.width);
    let overlapWidth = overlapRight - overlapLeft;
    
    if (overlapWidth <= 0) {
        // Missed completely
        gameOver();
        // Turn current block into debris
        debris.push(new Debris(currentBlock.x, currentBlock.y, currentBlock.width, currentBlock.colorIndex));
        currentBlock = null;
        return;
    }
    
    // Slicing logic
    let leftDebrisWidth = 0;
    let rightDebrisWidth = 0;
    
    if (currentBlock.x < lastBlock.x) {
        leftDebrisWidth = lastBlock.x - currentBlock.x;
        debris.push(new Debris(currentBlock.x, currentBlock.y, leftDebrisWidth, currentBlock.colorIndex));
    }
    
    if (currentBlock.x + currentBlock.width > lastBlock.x + lastBlock.width) {
        rightDebrisWidth = (currentBlock.x + currentBlock.width) - (lastBlock.x + lastBlock.width);
        debris.push(new Debris(lastBlock.x + lastBlock.width, currentBlock.y, rightDebrisWidth, currentBlock.colorIndex));
    }
    
    // Perfect drop bonus check
    if (Math.abs(currentBlock.x - lastBlock.x) < 5) {
        overlapWidth = lastBlock.width; // snap to perfect
        overlapLeft = lastBlock.x;
        spawnParticles(overlapLeft + overlapWidth/2, currentBlock.y + BLOCK_HEIGHT, '#fff', 30);
    }
    
    // Update current block to sliced size
    currentBlock.x = overlapLeft;
    currentBlock.width = overlapWidth;
    
    blocks.push(currentBlock);
    score++;
    scoreDisplay.textContent = score;
    
    // Spawn next
    spawnNextBlock();
    
    // Move camera up
    cameraY += BLOCK_HEIGHT;
}

let particles = [];
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
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
        this.life -= this.decay;
    }
    draw(camY) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y + camY, this.size, 0, Math.PI*2);
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
    
    // Grid lines scrolling
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const yOffset = cameraY % 50;
    for(let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y + yOffset);
        ctx.lineTo(canvas.width, y + yOffset);
        ctx.stroke();
    }
}

function gameOver() {
    gameState = 'GAMEOVER';
    finalScoreDisplay.textContent = score;
    setTimeout(() => {
        gameOverScreen.classList.add('active');
    }, 1000);
}

// Smooth camera
let actualCamY = 0;

function gameLoop() {
    if (gameState === 'START') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    // Smooth camera lerp
    actualCamY += (cameraY - actualCamY) * 0.1;
    
    // Draw base platform
    ctx.fillStyle = '#222';
    ctx.fillRect(canvas.width/2 - INITIAL_WIDTH/2, canvas.height - 100 + actualCamY, INITIAL_WIDTH, canvas.height);
    
    // Draw stacked blocks
    for(let i=0; i<blocks.length; i++) {
        blocks[i].draw(actualCamY);
    }
    
    // Draw debris
    for(let i=debris.length-1; i>=0; i--) {
        debris[i].update();
        debris[i].draw(actualCamY);
        if (debris[i].y > canvas.height - actualCamY) {
            debris.splice(i, 1);
        }
    }
    
    // Draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(actualCamY);
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    // Draw current moving block
    if (currentBlock && gameState === 'PLAYING') {
        currentBlock.update();
        currentBlock.draw(actualCamY);
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

function init() {
    score = 0;
    scoreDisplay.textContent = `0`;
    blocks = [];
    debris = [];
    particles = [];
    cameraY = 0;
    actualCamY = 0;
    
    // Base block
    blocks.push(new Block(canvas.width/2 - INITIAL_WIDTH/2, canvas.height - 100 - BLOCK_HEIGHT, INITIAL_WIDTH, 0, 0));
    
    spawnNextBlock();
    
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    cancelAnimationFrame(animationId);
    gameLoop();
}

function handleInput(e) {
    if (e.target.tagName === 'BUTTON') return;
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'touchstart') e.preventDefault();
    
    if (gameState === 'START') {
        init();
    } else if (gameState === 'PLAYING') {
        dropBlock();
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
// Fake base block for start screen
new Block(canvas.width/2 - INITIAL_WIDTH/2, canvas.height - 100 - BLOCK_HEIGHT, INITIAL_WIDTH, 0, 0).draw(0);