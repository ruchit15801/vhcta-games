const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const levelCompleteScreen = document.getElementById('level-complete-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const swipeOverlay = document.getElementById('swipe-overlay');
const levelDisplay = document.getElementById('levelDisplay');
const movesDisplay = document.getElementById('movesDisplay');
const startBtn = document.getElementById('startBtn');
const nextLevelBtn = document.getElementById('nextLevelBtn');
const restartBtn = document.getElementById('restartBtn');

let width, height;
let gameState = 'START';
let lastTime = 0;

let level = 1;
let moves = 0;

const GRID_SIZE = 8;
let tileSize = 0;
let offsetX = 0;
let offsetY = 0;

let grid = [];
let player = { r: 0, c: 0, x: 0, y: 0, vx: 0, vy: 0, targetR: 0, targetC: 0, moving: false };
let goal = { r: 0, c: 0 };
let particles = [];

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'slide') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500, audioCtx.currentTime);
        osc.frequency.setValueAtTime(700, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(900, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

function resize() {
    width = canvas.width = canvas.clientWidth;
    height = canvas.height = canvas.clientHeight;
    tileSize = Math.min(width, height) / (GRID_SIZE + 2);
    offsetX = (width - tileSize * GRID_SIZE) / 2;
    offsetY = (height - tileSize * GRID_SIZE) / 2;
    
    if(!player.moving) {
        player.x = offsetX + player.c * tileSize;
        player.y = offsetY + player.r * tileSize;
    }
}
window.addEventListener('resize', resize);

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 2 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random()*3 + 2;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life -= 0.05;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function loadLevel(lvl) {
    grid = [];
    moves = 0;
    movesDisplay.innerText = moves;
    levelDisplay.innerText = lvl;
    
    for(let r=0; r<GRID_SIZE; r++) {
        grid[r] = [];
        for(let c=0; c<GRID_SIZE; c++) {
            if(r===0 || r===GRID_SIZE-1 || c===0 || c===GRID_SIZE-1) grid[r][c] = 1;
            else {
                let chance = 0.1 + (lvl * 0.02);
                grid[r][c] = Math.random() < chance ? 1 : 0;
            }
        }
    }
    
    player.r = 1; player.c = 1;
    goal.r = GRID_SIZE-2; goal.c = GRID_SIZE-2;
    grid[player.r][player.c] = 0;
    grid[goal.r][goal.c] = 0;
    grid[player.r+1][player.c] = 0;
    grid[goal.r-1][goal.c] = 0;
    
    player.x = offsetX + player.c * tileSize;
    player.y = offsetY + player.r * tileSize;
    player.moving = false;
    player.targetR = player.r;
    player.targetC = player.c;
}

function startGame() {
    startScreen.classList.remove('active');
    levelCompleteScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    hud.classList.add('visible');
    
    level = 1;
    resize();
    loadLevel(level);
    gameState = 'PLAYING';
    if(audioCtx.state === 'suspended') audioCtx.resume();
}

function nextLevel() {
    level++;
    levelCompleteScreen.classList.remove('active');
    loadLevel(level);
    gameState = 'PLAYING';
}

function movePlayer(dc, dr) {
    if(player.moving || gameState !== 'PLAYING') return;
    
    let r = player.r;
    let c = player.c;
    
    while(grid[r+dr][c+dc] !== 1) {
        r += dr;
        c += dc;
    }
    
    if(r !== player.r || c !== player.c) {
        player.targetR = r;
        player.targetC = c;
        player.vx = dc * 15;
        player.vy = dr * 15;
        player.moving = true;
        moves++;
        movesDisplay.innerText = moves;
        playSound('slide');
    }
}

function drawGrid(ctx) {
    for(let r=0; r<GRID_SIZE; r++) {
        for(let c=0; c<GRID_SIZE; c++) {
            let x = offsetX + c * tileSize;
            let y = offsetY + r * tileSize;
            
            if(grid[r][c] === 1) {
                ctx.fillStyle = '#005f99';
                ctx.fillRect(x, y, tileSize, tileSize);
                
                ctx.fillStyle = '#7FDBFF';
                ctx.fillRect(x, y, tileSize, 5);
                ctx.fillRect(x, y, 5, tileSize);
                
                ctx.fillStyle = '#001f3f';
                ctx.fillRect(x+tileSize-5, y, 5, tileSize);
                ctx.fillRect(x, y+tileSize-5, tileSize, 5);
            } else {
                ctx.fillStyle = 'rgba(127, 219, 255, 0.1)';
                ctx.fillRect(x, y, tileSize, tileSize);
                ctx.strokeStyle = 'rgba(127, 219, 255, 0.2)';
                ctx.strokeRect(x, y, tileSize, tileSize);
            }
        }
    }
    
    let gx = offsetX + goal.c * tileSize;
    let gy = offsetY + goal.r * tileSize;
    ctx.fillStyle = '#39CCCC';
    ctx.beginPath();
    ctx.arc(gx + tileSize/2, gy + tileSize/2, tileSize/3, 0, Math.PI*2);
    ctx.shadowColor = '#39CCCC';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawPlayer(ctx) {
    ctx.fillStyle = '#FF4136';
    ctx.beginPath();
    ctx.arc(player.x + tileSize/2, player.y + tileSize/2, tileSize/2.5, 0, Math.PI*2);
    ctx.shadowColor = '#FF4136';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(player.x + tileSize/2 - 5, player.y + tileSize/2 - 5, tileSize/6, 0, Math.PI*2);
    ctx.fill();
}

function loop(timestamp) {
    let dt = timestamp - lastTime;
    lastTime = timestamp;
    
    ctx.clearRect(0, 0, width, height);
    
    if(gameState === 'PLAYING') {
        if(player.moving) {
            player.x += player.vx;
            player.y += player.vy;
            
            if(Math.random() < 0.3) {
                particles.push(new Particle(player.x + tileSize/2, player.y + tileSize/2, '#E0FFFF'));
            }
            
            let targetX = offsetX + player.targetC * tileSize;
            let targetY = offsetY + player.targetR * tileSize;
            
            if((player.vx > 0 && player.x >= targetX) || (player.vx < 0 && player.x <= targetX) ||
               (player.vy > 0 && player.y >= targetY) || (player.vy < 0 && player.y <= targetY)) {
                player.x = targetX;
                player.y = targetY;
                player.r = player.targetR;
                player.c = player.targetC;
                player.moving = false;
                playSound('hit');
                
                for(let i=0; i<10; i++) particles.push(new Particle(player.x + tileSize/2, player.y + tileSize/2, '#7FDBFF'));
                
                if(player.r === goal.r && player.c === goal.c) {
                    gameState = 'LEVEL_COMPLETE';
                    playSound('win');
                    setTimeout(() => {
                        levelCompleteScreen.classList.add('active');
                    }, 500);
                }
            }
        }
    }
    
    drawGrid(ctx);
    drawPlayer(ctx);
    
    particles.forEach(p => { p.update(); p.draw(ctx); });
    particles = particles.filter(p => p.life > 0);
    
    requestAnimationFrame(loop);
}

window.addEventListener('keydown', e => {
    if(e.code === 'ArrowUp' || e.code === 'KeyW') movePlayer(0, -1);
    if(e.code === 'ArrowDown' || e.code === 'KeyS') movePlayer(0, 1);
    if(e.code === 'ArrowLeft' || e.code === 'KeyA') movePlayer(-1, 0);
    if(e.code === 'ArrowRight' || e.code === 'KeyD') movePlayer(1, 0);
});

let touchStartX = 0;
let touchStartY = 0;
swipeOverlay.addEventListener('touchstart', e => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, {passive: false});
swipeOverlay.addEventListener('touchend', e => {
    e.preventDefault();
    let touchEndX = e.changedTouches[0].clientX;
    let touchEndY = e.changedTouches[0].clientY;
    let dx = touchEndX - touchStartX;
    let dy = touchEndY - touchStartY;
    
    if(Math.abs(dx) > Math.abs(dy)) {
        if(dx > 30) movePlayer(1, 0);
        else if(dx < -30) movePlayer(-1, 0);
    } else {
        if(dy > 30) movePlayer(0, 1);
        else if(dy < -30) movePlayer(0, -1);
    }
}, {passive: false});

startBtn.addEventListener('click', startGame);
nextLevelBtn.addEventListener('click', nextLevel);
restartBtn.addEventListener('click', startGame);

resize();
requestAnimationFrame(loop);
