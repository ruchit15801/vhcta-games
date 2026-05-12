const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const timeDisplay = document.getElementById('timeDisplay');
const finalScoreDisplay = document.getElementById('finalScore');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let gameState = 'START';
let score = 0;
let timeLeft = 60;
let animationId;
let lastTime = 0;

const COLOR_HOOK = '#00f3ff';
const COLOR_FISH = ['#ff00ea', '#00ff88', '#fff200', '#ff003c'];

// Hook
const hook = {
    originX: canvas.width / 2,
    originY: 50,
    angle: 0,
    maxAngle: Math.PI / 2.5,
    swingSpeed: 0.03,
    swingDir: 1,
    length: 100,
    baseLength: 100,
    state: 'SWINGING', // SWINGING, EXTENDING, RETRACTING
    extendSpeed: 15,
    retractSpeed: 10,
    caughtFish: null,
    
    update() {
        this.originX = canvas.width / 2;
        
        if (this.state === 'SWINGING') {
            this.angle += this.swingSpeed * this.swingDir;
            if (this.angle > this.maxAngle) {
                this.angle = this.maxAngle;
                this.swingDir = -1;
            } else if (this.angle < -this.maxAngle) {
                this.angle = -this.maxAngle;
                this.swingDir = 1;
            }
        } else if (this.state === 'EXTENDING') {
            this.length += this.extendSpeed;
            // Calculate hook tip
            const tipX = this.originX + Math.sin(this.angle) * this.length;
            const tipY = this.originY + Math.cos(this.angle) * this.length;
            
            // Check boundaries
            if (tipX < 0 || tipX > canvas.width || tipY > canvas.height) {
                this.state = 'RETRACTING';
            }
            
            // Check collision with fish
            for (let i = 0; i < fishes.length; i++) {
                const f = fishes[i];
                if (!f.caught && Math.hypot(tipX - f.x, tipY - f.y) < f.radius + 15) {
                    f.caught = true;
                    this.caughtFish = f;
                    this.state = 'RETRACTING';
                    spawnParticles(tipX, tipY, f.color, 10);
                    break;
                }
            }
        } else if (this.state === 'RETRACTING') {
            this.length -= this.retractSpeed;
            if (this.caughtFish) {
                this.caughtFish.x = this.originX + Math.sin(this.angle) * this.length;
                this.caughtFish.y = this.originY + Math.cos(this.angle) * this.length;
            }
            
            if (this.length <= this.baseLength) {
                this.length = this.baseLength;
                this.state = 'SWINGING';
                if (this.caughtFish) {
                    score += this.caughtFish.value;
                    scoreDisplay.textContent = `CATCH: $${score}`;
                    spawnParticles(this.originX, this.originY, '#00ff88', 20);
                    // Remove fish
                    fishes = fishes.filter(f => f !== this.caughtFish);
                    this.caughtFish = null;
                }
            }
        }
    },
    
    draw() {
        ctx.save();
        ctx.translate(this.originX, this.originY);
        ctx.rotate(-this.angle); // - angle because 0 is down
        
        // Line
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, this.length);
        ctx.stroke();
        
        // Hook Tip
        ctx.translate(0, this.length);
        ctx.strokeStyle = COLOR_HOOK;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLOR_HOOK;
        
        ctx.beginPath();
        ctx.arc(-8, 0, 8, 0, Math.PI);
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -20);
        ctx.stroke();
        
        // Barb
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(-12, -4);
        ctx.stroke();
        
        ctx.restore();
    }
};

let fishes = [];
class Fish {
    constructor() {
        this.radius = Math.random() * 10 + 15;
        this.y = canvas.height * 0.3 + Math.random() * (canvas.height * 0.6);
        this.speed = (Math.random() * 2 + 1) * (10 / this.radius); // smaller = faster
        this.dir = Math.random() > 0.5 ? 1 : -1;
        this.x = this.dir === 1 ? -50 : canvas.width + 50;
        this.color = COLOR_FISH[Math.floor(Math.random() * COLOR_FISH.length)];
        this.value = Math.floor((30 - this.radius) * 10);
        this.caught = false;
        this.wobble = Math.random() * Math.PI * 2;
    }
    
    update() {
        if (this.caught) return; // position updated by hook
        
        this.x += this.speed * this.dir;
        this.wobble += 0.1;
        this.y += Math.sin(this.wobble) * 1;
        
        // Wrap around
        if (this.dir === 1 && this.x > canvas.width + 50) this.x = -50;
        if (this.dir === -1 && this.x < -50) this.x = canvas.width + 50;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir === -1) ctx.scale(-1, 1);
        if (this.caught) {
            ctx.rotate(-hook.angle);
            ctx.rotate(Math.PI/2); // hang down
        }
        
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        
        // Body
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.6, 0, 0, Math.PI*2);
        ctx.fill();
        
        // Tail
        ctx.beginPath();
        ctx.moveTo(-this.radius + 2, 0);
        ctx.lineTo(-this.radius - 15, -10);
        ctx.lineTo(-this.radius - 15, 10);
        ctx.closePath();
        ctx.fill();
        
        // Eye
        ctx.fillStyle = '#000';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(this.radius * 0.5, -this.radius * 0.2, 3, 0, Math.PI*2);
        ctx.fill();
        
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
        this.size = Math.random() * 4 + 2;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // gravity
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

let bubbles = [];
for(let i=0; i<30; i++) {
    bubbles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        s: Math.random() * 3 + 1,
        v: Math.random() * 1 + 0.5
    });
}

function drawBackground() {
    // Gradient is CSS, just clear with alpha for trails if wanted, or clear full
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Boat silhouette
    ctx.fillStyle = '#0a0a0f';
    ctx.beginPath();
    ctx.arc(canvas.width/2, -100, 150, 0, Math.PI*2);
    ctx.fill();
    
    // Bubbles
    ctx.fillStyle = 'rgba(0, 243, 255, 0.2)';
    bubbles.forEach(b => {
        b.y -= b.v;
        b.x += Math.sin(b.y * 0.05) * 0.5;
        if (b.y < 0) {
            b.y = canvas.height;
            b.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.s, 0, Math.PI*2);
        ctx.fill();
    });
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function maintainFishes() {
    // Keep exactly 10 fishes
    const uncaught = fishes.filter(f => !f.caught).length;
    if (uncaught < 10) {
        if (Math.random() < 0.05) {
            fishes.push(new Fish());
        }
    }
}

function gameLoop(timestamp) {
    if (gameState !== 'PLAYING') return;
    
    const dt = timestamp - lastTime;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    maintainFishes();
    
    for (let i = fishes.length - 1; i >= 0; i--) {
        fishes[i].update();
        fishes[i].draw();
    }
    
    hook.update();
    hook.draw();
    
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    // Timer
    if (timestamp - lastTime >= 1000) {
        lastTime = timestamp;
        timeLeft--;
        timeDisplay.textContent = `TIME: ${timeLeft}`;
        
        if (timeLeft <= 0) {
            gameOver();
        }
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationId);
    finalScoreDisplay.textContent = `$${score}`;
    gameOverScreen.classList.add('active');
}

function init() {
    score = 0;
    timeLeft = 60;
    scoreDisplay.textContent = `CATCH: $0`;
    timeDisplay.textContent = `TIME: 60`;
    
    hook.angle = 0;
    hook.length = hook.baseLength;
    hook.state = 'SWINGING';
    hook.caughtFish = null;
    
    fishes = [];
    for(let i=0; i<10; i++) {
        const f = new Fish();
        f.x = Math.random() * canvas.width; // spawn in view
        fishes.push(f);
    }
    
    particles = [];
    
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(gameLoop);
}

function handleInput(e) {
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'touchstart') e.preventDefault();
    if (e.target.tagName === 'BUTTON') return;
    
    if (gameState === 'START') {
        init();
    } else if (gameState === 'PLAYING') {
        if (hook.state === 'SWINGING') {
            hook.state = 'EXTENDING';
        }
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
hook.draw();