const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('scoreDisplay');
const distDisplay = document.getElementById('distDisplay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const finalScore = document.getElementById('finalScore');
const finalDist = document.getElementById('finalDist');

let width, height;
let gameState = 'START';
let lastTime = 0;

let score = 0;
let distance = 0;
let gameSpeed = 6;

let player = {
    x: 100, y: 0, w: 60, h: 80,
    vy: 0, gravity: 0.8, jumpForce: -15,
    grounded: false,
    jumpCount: 0,
    maxJumps: 2
};

let coins = [];
let obstacles = [];
let particles = [];

const playerImg = new Image();
playerImg.src = 'assets/player.png';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

function resize() {
    width = canvas.width = canvas.clientWidth;
    height = canvas.height = canvas.clientHeight;
    player.y = height - player.h - 50;
}
window.addEventListener('resize', resize);

class Coin {
    constructor(x, y) {
        this.x = x; this.y = y; this.r = 15;
        this.angle = 0;
    }
    update() {
        this.x -= gameSpeed;
        this.angle += 0.1;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

class Obstacle {
    constructor(x) {
        this.x = x;
        this.w = 40 + Math.random() * 40;
        this.h = 40 + Math.random() * 60;
        this.y = height - this.h - 50;
    }
    update() {
        this.x -= gameSpeed;
    }
    draw(ctx) {
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeStyle = '#3d1f0a';
        ctx.strokeRect(this.x, this.y, this.w, this.h);
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.vx = (Math.random()-0.5)*10;
        this.vy = (Math.random()-0.5)*10;
        this.life = 1.0;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life -= 0.05;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function initGame() {
    coins = [];
    obstacles = [];
    particles = [];
    score = 0;
    distance = 0;
    gameSpeed = 6;
    player.vy = 0;
    player.jumpCount = 0;
    resize();
}

function startGame() {
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    hud.classList.add('visible');
    initGame();
    gameState = 'PLAYING';
    if(audioCtx.state === 'suspended') audioCtx.resume();
}

function endGame() {
    gameState = 'GAMEOVER';
    hud.classList.remove('visible');
    gameOverScreen.classList.add('active');
    finalScore.innerText = score;
    finalDist.innerText = Math.floor(distance);
    playSound('hit');
}

function playerJump() {
    if(gameState !== 'PLAYING') return;
    if(player.jumpCount < player.maxJumps) {
        player.vy = player.jumpForce;
        player.jumpCount++;
        player.grounded = false;
        playSound('jump');
    }
}

function loop(timestamp) {
    let dt = timestamp - lastTime;
    if(dt > 50) dt = 16;
    lastTime = timestamp;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = '#3d1f0a';
    ctx.fillRect(0, height - 50, width, 50);
    ctx.fillStyle = '#228b22';
    ctx.fillRect(0, height - 55, width, 5);

    if(gameState === 'PLAYING') {
        distance += gameSpeed * 0.1;
        gameSpeed = 6 + (distance / 500);
        scoreDisplay.innerText = score;
        distDisplay.innerText = Math.floor(distance);
        
        player.vy += player.gravity;
        player.y += player.vy;
        
        if(player.y > height - player.h - 50) {
            player.y = height - player.h - 50;
            player.vy = 0;
            player.grounded = true;
            player.jumpCount = 0;
        }
        
        if(Math.random() < 0.02) coins.push(new Coin(width + 50, height - 100 - Math.random()*200));
        if(Math.random() < 0.01) obstacles.push(new Obstacle(width + 50));
        
        for(let i=coins.length-1; i>=0; i--) {
            coins[i].update();
            coins[i].draw(ctx);
            let dx = player.x + player.w/2 - coins[i].x;
            let dy = player.y + player.h/2 - coins[i].y;
            if(Math.sqrt(dx*dx + dy*dy) < player.w/2 + coins[i].r) {
                score += 10;
                playSound('coin');
                for(let j=0; j<5; j++) particles.push(new Particle(coins[i].x, coins[i].y, '#ffd700'));
                coins.splice(i, 1);
            }
        }
        
        for(let o of obstacles) {
            o.update();
            o.draw(ctx);
            if(player.x + 10 < o.x + o.w && player.x + player.w - 10 > o.x &&
               player.y + 10 < o.y + o.h && player.y + player.h - 10 > o.y) {
                endGame();
            }
        }
        
        coins = coins.filter(c => c.x > -50);
        obstacles = obstacles.filter(o => o.x > -100);
        
        ctx.save();
        if(playerImg.complete) {
            ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
        } else {
            ctx.fillStyle = '#f00';
            ctx.fillRect(player.x, player.y, player.w, player.h);
        }
        ctx.restore();
    }
    
    particles.forEach(p => { p.update(); p.draw(ctx); });
    particles = particles.filter(p => p.life > 0);
    
    requestAnimationFrame(loop);
}

window.addEventListener('keydown', e => { if(e.code === 'Space') playerJump(); });
canvas.addEventListener('touchstart', e => { if(e.target.tagName !== 'BUTTON') { e.preventDefault(); playerJump(); } }, {passive: false});
canvas.addEventListener('mousedown', playerJump);

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

resize();
requestAnimationFrame(loop);
