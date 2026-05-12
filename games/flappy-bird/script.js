/**
 * Sky Bound | Premium Flappy Bird
 * A Vanilla JavaScript Game Engine
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const pauseScreen = document.getElementById('pause-screen');
const currentScoreElement = document.getElementById('current-score');
const finalScoreElement = document.getElementById('final-score');
const highScoreElement = document.getElementById('high-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const tutorialOverlay = document.getElementById('tutorial-overlay');

// Game Constants
const GRAVITY = 0.25;
const JUMP_STRENGTH = -5.5;
const PIPE_WIDTH = 70;
const PIPE_GAP = 160;
const PIPE_COOLDOWN = 1400; // ms
const BIRD_RADIUS = 18;
const INITIAL_SPEED = 3;
const SPEED_INCREMENT = 0.05;

// Game State
let gameState = 'START'; // START, TUTORIAL, PLAYING, PAUSED, GAME_OVER
let score = 0;
let highScore = localStorage.getItem('skybound_high_score') || 0;
let lastTime = 0;
let bird;
let pipes = [];
let particles = [];
let pipeTimer = 0;
let gameSpeed = INITIAL_SPEED;

// Sound System (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type, duration) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
    flap: () => playSound(400, 'triangle', 0.1),
    score: () => {
        playSound(600, 'square', 0.1);
        setTimeout(() => playSound(800, 'square', 0.1), 50);
    },
    hit: () => playSound(150, 'sawtooth', 0.3)
};

// --- BACKGROUND SYSTEM ---
class BackgroundLayer {
    constructor(imageColor, speed, height, yOffset) {
        this.color = imageColor;
        this.speed = speed;
        this.height = height;
        this.y = yOffset;
        this.x = 0;
    }

    update(dt, gameSpeed) {
        this.x -= (this.speed * (gameSpeed / INITIAL_SPEED)) * (dt / 16);
        if (this.x <= -canvas.width) this.x = 0;
    }

    draw() {
        ctx.fillStyle = this.color;
        // Draw two segments for seamless loop
        ctx.fillRect(this.x, this.y, canvas.width + 2, this.height);
        ctx.fillRect(this.x + canvas.width, this.y, canvas.width + 2, this.height);
    }
}

class BackgroundManager {
    constructor() {
        this.layers = [
            new BackgroundLayer('rgba(255, 255, 255, 0.05)', 0.5, 200, 100), // Distant clouds
            new BackgroundLayer('rgba(255, 255, 255, 0.1)', 1.2, 150, 400), // Mid clouds
            new BackgroundLayer('rgba(255, 255, 255, 0.15)', 2.5, 100, canvas.height - 100) // Ground
        ];
    }

    update(dt, gameSpeed) {
        this.layers.forEach(layer => layer.update(dt, gameSpeed));
    }

    draw() {
        // Sky Gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        skyGrad.addColorStop(0, '#4facfe');
        skyGrad.addColorStop(1, '#00f2fe');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        this.layers.forEach(layer => layer.draw());
    }
}

const backgroundManager = new BackgroundManager();

class Bird {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = canvas.width / 4;
        this.y = canvas.height / 2;
        this.velocity = 0;
        this.radius = BIRD_RADIUS;
        this.rotation = 0;
        this.wingAngle = 0;
        this.blinkTimer = 0;
        this.trail = [];
    }

    update(dt) {
        if (gameState === 'TUTORIAL') {
            // Floating sine wave
            this.y = canvas.height / 2 + Math.sin(Date.now() * 0.005) * 20;
            this.wingAngle = Math.sin(Date.now() * 0.01) * 0.5;
            return;
        }

        if (gameState !== 'PLAYING') return;

        this.velocity += GRAVITY;
        this.y += this.velocity;

        // Wing Animation speed based on velocity
        this.wingAngle += (this.velocity < 0 ? 0.3 : 0.1);
        
        // Rotation based on velocity
        this.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.velocity * 0.1));

        // Trail logic
        if (Math.abs(this.velocity) > 0.1) {
            this.trail.push({x: this.x, y: this.y, life: 1.0});
        }
        this.trail.forEach(t => t.life -= 0.02);
        this.trail = this.trail.filter(t => t.life > 0);

        // Floor collision
        if (this.y + this.radius > canvas.height) {
            this.y = canvas.height - this.radius;
            gameOver();
        }
        
        // Ceiling collision
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.velocity = 0;
        }
    }

    draw() {
        // Draw Trail
        this.trail.forEach(t => {
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.radius * t.life, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 215, 0, ${t.life * 0.3})`;
            ctx.fill();
        });

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Simulate flapping by scaling height
        const flapScale = 1 + Math.sin(this.wingAngle) * 0.1;
        ctx.scale(1, flapScale);
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';

        // Draw Bird Body
        ctx.fillStyle = '#FFD700'; // Gold/Yellow
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.radius * 0.4, -this.radius * 0.3, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.radius * 0.5, -this.radius * 0.3, this.radius * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#FF7F50'; // Coral
        ctx.beginPath();
        ctx.moveTo(this.radius * 0.6, 0);
        ctx.lineTo(this.radius * 1.2, 0);
        ctx.lineTo(this.radius * 0.6, this.radius * 0.4);
        ctx.fill();

        // Wing
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.ellipse(-this.radius * 0.2, this.radius * 0.2, this.radius * 0.4, this.radius * 0.25, -0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    jump() {
        if (gameState !== 'PLAYING') return;
        this.velocity = JUMP_STRENGTH;
        sounds.flap();
        createParticles(this.x, this.y, '#fff', 5);
    }
}

class Pipe {
    constructor() {
        this.x = canvas.width;
        this.width = PIPE_WIDTH;
        this.gap = PIPE_GAP - (score * 0.5); // Difficulty: gaps get smaller
        this.gap = Math.max(100, this.gap);
        
        const minPipeHeight = 50;
        const maxPipeHeight = canvas.height - this.gap - minPipeHeight;
        this.topHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
        this.passed = false;
    }

    update() {
        if (gameState !== 'PLAYING') return;
        this.x -= gameSpeed;
    }

    draw() {
        // Modern gradient pipes with "inner-glow" effect
        ctx.save();
        
        const gradient = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
        gradient.addColorStop(0, '#2ed573');
        gradient.addColorStop(0.3, '#7bed9f');
        gradient.addColorStop(1, '#2ed573');

        ctx.fillStyle = gradient;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;

        // Top Pipe
        ctx.beginPath();
        ctx.roundRect(this.x, -10, this.width, this.topHeight + 10, [0, 0, 15, 15]);
        ctx.fill();
        ctx.stroke();

        // Bottom Pipe
        ctx.beginPath();
        ctx.roundRect(this.x, this.topHeight + this.gap, this.width, canvas.height - (this.topHeight + this.gap) + 10, [15, 15, 0, 0]);
        ctx.fill();
        ctx.stroke();

        // Glossy Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(this.x + 10, 0, 5, this.topHeight - 10);
        ctx.fillRect(this.x + 10, this.topHeight + this.gap + 10, 5, canvas.height);

        ctx.restore();
    }

    isOffscreen() {
        return this.x + this.width < 0;
    }

    collidesWith(bird) {
        // Simple AABB collision for pipes
        const bx = bird.x;
        const by = bird.y;
        const br = bird.radius - 2; // Slight buffer

        // Check if bird is within pipe's horizontal bounds
        if (bx + br > this.x && bx - br < this.x + this.width) {
            // Check if bird hits top or bottom pipe
            if (by - br < this.topHeight || by + br > this.topHeight + this.gap) {
                return true;
            }
        }
        return false;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 4;
        this.speedY = (Math.random() - 0.5) * 4;
        this.opacity = 1;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.opacity -= 0.02;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Canvas Sizing
function resizeCanvas() {
    const container = document.getElementById('game-container');
    const displayWidth = container.clientWidth;
    const displayHeight = container.clientHeight;

    // Fixed aspect ratio or responsive? Let's go with a balanced vertical-ish ratio
    const targetWidth = 400;
    const targetHeight = 700;
    
    const scale = Math.min(displayWidth / targetWidth, displayHeight / targetHeight);
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Initial objects
bird = new Bird();

// Game Control Functions
function startGame() {
    gameState = 'TUTORIAL';
    score = 0;
    gameSpeed = INITIAL_SPEED;
    pipes = [];
    particles = [];
    pipeTimer = 0;
    bird.reset();
    updateScoreDisplay();
    startScreen.classList.remove('active');
    tutorialOverlay.classList.add('active');
    gameOverScreen.classList.remove('active');
    pauseScreen.classList.remove('active');
}

function startActualPlay() {
    gameState = 'PLAYING';
    tutorialOverlay.classList.remove('active');
    bird.jump(); // First jump starts it
}

function gameOver() {
    if (gameState === 'GAME_OVER') return;
    gameState = 'GAME_OVER';
    sounds.hit();
    createParticles(bird.x, bird.y, '#ffd700', 20);
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('skybound_high_score', highScore);
    }

    finalScoreElement.textContent = score;
    highScoreElement.textContent = highScore;
    gameOverScreen.classList.add('active');
}

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseScreen.classList.add('active');
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        pauseScreen.classList.remove('active');
    }
}

function updateScoreDisplay() {
    currentScoreElement.textContent = score;
}

// Input Handlers
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (gameState === 'PLAYING') bird.jump();
        else if (gameState === 'TUTORIAL') startActualPlay();
        else if (gameState === 'START') startGame();
        else if (gameState === 'GAME_OVER') startGame();
    }
    if (e.code === 'Escape') togglePause();
});

canvas.addEventListener('mousedown', () => {
    if (gameState === 'PLAYING') bird.jump();
    else if (gameState === 'TUTORIAL') startActualPlay();
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'PLAYING') bird.jump();
    else if (gameState === 'TUTORIAL') startActualPlay();
}, { passive: false });

startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
});

restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
});

pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause();
});

resumeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause();
});

// Parallax Background elements REMOVED - Using BackgroundManager

// Main Game Loop
function loop(timestamp) {
    const deltaTime = timestamp - lastTime || 0;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    backgroundManager.update(deltaTime, gameSpeed);
    backgroundManager.draw();

    if (gameState === 'PLAYING') {
        // Pipe Generation
        pipeTimer += deltaTime;
        if (pipeTimer > PIPE_COOLDOWN) {
            pipes.push(new Pipe());
            pipeTimer = 0;
        }

        // Increase Difficulty
        gameSpeed += SPEED_INCREMENT / 1000 * deltaTime;
    }

    // Logic and Drawing
    pipes.forEach((pipe, index) => {
        pipe.update();
        pipe.draw();

        if (pipe.collidesWith(bird)) {
            gameOver();
        }

        if (!pipe.passed && bird.x > pipe.x + pipe.width) {
            pipe.passed = true;
            score++;
            sounds.score();
            updateScoreDisplay();
        }

        if (pipe.isOffscreen()) {
            pipes.splice(index, 1);
        }
    });

    particles.forEach((p, index) => {
        p.update();
        p.draw();
        if (p.opacity <= 0) particles.splice(index, 1);
    });

    bird.update(deltaTime);
    bird.draw();

    requestAnimationFrame(loop);
}

// Start visual loop immediately for background animations
requestAnimationFrame(loop);
updateScoreDisplay(); // Initialize score text
highScoreElement.textContent = highScore;
