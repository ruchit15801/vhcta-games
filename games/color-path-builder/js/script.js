/**
 * Color Path Builder - Core Logic
 */

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

const sfx = {
    init: () => { if (!audioCtx) audioCtx = new AudioCtx(); },
    play: (type) => {
        if (!audioCtx || !gameState.soundEnabled) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        if (type === 'connect') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'complete') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.setValueAtTime(600, now + 0.1);
            osc.frequency.setValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        } else if (type === 'pop') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        }
    }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
let cw, ch;

function resize() {
    cw = canvas.width = window.innerWidth;
    ch = canvas.height = window.innerHeight;
    calculateGrid();
}
window.addEventListener('resize', resize);

const colors = [
    '#ff4757', // 1 Red
    '#2ed573', // 2 Green
    '#1e90ff', // 3 Blue
    '#ffa502', // 4 Orange
    '#9b59b6'  // 5 Purple
];

// 5 hardcoded levels (0: empty, 1-5: color nodes)
const levels = [
    {
        size: 5,
        grid: [
            [1, 0, 0, 0, 2],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [1, 0, 0, 0, 2]
        ]
    },
    {
        size: 5,
        grid: [
            [1, 0, 0, 0, 0],
            [0, 0, 2, 0, 3],
            [0, 2, 0, 0, 0],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 3, 0]
        ]
    },
    {
        size: 6,
        grid: [
            [0, 1, 0, 2, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [3, 0, 0, 4, 0, 0],
            [0, 0, 0, 0, 0, 3],
            [0, 0, 0, 0, 0, 0],
            [1, 0, 2, 0, 0, 4]
        ]
    },
    {
        size: 6,
        grid: [
            [1, 0, 2, 0, 3, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 4, 0, 0, 5],
            [5, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [1, 0, 2, 0, 3, 4]
        ]
    },
    {
        size: 7,
        grid: [
            [1, 0, 0, 0, 0, 0, 2],
            [0, 0, 3, 0, 4, 0, 0],
            [0, 0, 0, 0, 0, 0, 0],
            [0, 5, 0, 0, 0, 5, 0],
            [0, 0, 0, 0, 0, 0, 0],
            [0, 0, 4, 0, 3, 0, 0],
            [2, 0, 0, 0, 0, 0, 1]
        ]
    }
];

const gameState = {
    active: false,
    paused: false,
    soundEnabled: true,
    currentLevel: 0,
    gridSize: 5,
    cellSize: 0,
    offsetX: 0,
    offsetY: 0,
    nodes: [],
    paths: {}, // colorId -> array of {x,y}
    drawingColor: null,
    levelWon: false,
    particles: []
};

function calculateGrid() {
    if (!gameState.active) return;
    const padding = 40;
    const maxSize = Math.min(cw, ch) - padding * 2;
    gameState.cellSize = Math.floor(maxSize / gameState.gridSize);
    
    // Center grid
    const totalW = gameState.cellSize * gameState.gridSize;
    const totalH = gameState.cellSize * gameState.gridSize;
    gameState.offsetX = (cw - totalW) / 2;
    gameState.offsetY = (ch - totalH) / 2;
}

const ui = {
    startScreen: document.getElementById('start-screen'),
    instructionsScreen: document.getElementById('instructions-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    levelCompleteScreen: document.getElementById('level-complete-screen'),
    gameCompleteScreen: document.getElementById('game-complete-screen'),
    uiLayer: document.getElementById('ui-layer'),
    levelDisplay: document.getElementById('current-level'),
    soundToggle: document.getElementById('sound-toggle')
};

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.size = Math.random() * 5 + 2;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life -= 0.03;
        this.size *= 0.95;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function loadLevel(index) {
    if (index >= levels.length) {
        gameComplete();
        return;
    }
    gameState.currentLevel = index;
    const lvl = levels[index];
    gameState.gridSize = lvl.size;
    gameState.nodes = [];
    gameState.paths = {};
    gameState.levelWon = false;
    gameState.particles = [];
    
    ui.levelDisplay.innerText = index + 1;
    
    for (let r = 0; r < lvl.size; r++) {
        for (let c = 0; c < lvl.size; c++) {
            const val = lvl.grid[r][c];
            if (val > 0) {
                gameState.nodes.push({ r, c, colorId: val });
                if (!gameState.paths[val]) gameState.paths[val] = [];
            }
        }
    }
    
    calculateGrid();
}

function getGridCell(px, py) {
    const c = Math.floor((px - gameState.offsetX) / gameState.cellSize);
    const r = Math.floor((py - gameState.offsetY) / gameState.cellSize);
    if (c >= 0 && c < gameState.gridSize && r >= 0 && r < gameState.gridSize) {
        return {r, c};
    }
    return null;
}

function getNodeAt(r, c) {
    return gameState.nodes.find(n => n.r === r && n.c === c);
}

function clearPathAt(r, c, ignoreColor) {
    for (const colorId in gameState.paths) {
        if (colorId == ignoreColor) continue;
        const path = gameState.paths[colorId];
        const idx = path.findIndex(p => p.r === r && p.c === c);
        if (idx !== -1) {
            // Cut path here
            gameState.paths[colorId] = path.slice(0, idx);
        }
    }
}

function handlePointerDown(e) {
    if (!gameState.active || gameState.paused || gameState.levelWon) return;
    const px = e.touches ? e.touches[0].clientX : e.clientX;
    const py = e.touches ? e.touches[0].clientY : e.clientY;
    
    const cell = getGridCell(px, py);
    if (!cell) return;
    
    const node = getNodeAt(cell.r, cell.c);
    if (node) {
        // Start from node
        gameState.drawingColor = node.colorId;
        gameState.paths[node.colorId] = [{r: cell.r, c: cell.c}];
        sfx.play('pop');
    } else {
        // Did we tap on an existing path?
        for (const colorId in gameState.paths) {
            const path = gameState.paths[colorId];
            const idx = path.findIndex(p => p.r === cell.r && p.c === cell.c);
            if (idx !== -1) {
                gameState.drawingColor = parseInt(colorId);
                gameState.paths[colorId] = path.slice(0, idx + 1);
                sfx.play('pop');
                break;
            }
        }
    }
}

function handlePointerMove(e) {
    if (!gameState.active || gameState.paused || gameState.levelWon || !gameState.drawingColor) return;
    const px = e.touches ? e.touches[0].clientX : e.clientX;
    const py = e.touches ? e.touches[0].clientY : e.clientY;
    
    const cell = getGridCell(px, py);
    if (!cell) return;
    
    const path = gameState.paths[gameState.drawingColor];
    if (path.length === 0) return;
    
    const lastCell = path[path.length - 1];
    
    // Check if moved to adjacent cell
    const isAdjacent = Math.abs(cell.r - lastCell.r) + Math.abs(cell.c - lastCell.c) === 1;
    
    if (isAdjacent) {
        // Check if we hit another node
        const node = getNodeAt(cell.r, cell.c);
        if (node) {
            if (node.colorId === gameState.drawingColor) {
                // Completed this color connection
                path.push({r: cell.r, c: cell.c});
                gameState.drawingColor = null;
                sfx.play('connect');
                createConnectParticles(cell.r, cell.c, colors[node.colorId - 1]);
                checkWin();
            }
        } else {
            // Check if moving backwards on own path
            if (path.length > 1 && path[path.length - 2].r === cell.r && path[path.length - 2].c === cell.c) {
                path.pop(); // Retreat
                sfx.play('pop');
            } else {
                // Moving forward
                // Don't cross own path
                const idx = path.findIndex(p => p.r === cell.r && p.c === cell.c);
                if (idx === -1) {
                    clearPathAt(cell.r, cell.c, gameState.drawingColor);
                    path.push({r: cell.r, c: cell.c});
                    sfx.play('pop');
                }
            }
        }
    }
}

function handlePointerUp() {
    gameState.drawingColor = null;
    checkWin();
}

document.addEventListener('mousedown', handlePointerDown);
document.addEventListener('mousemove', handlePointerMove);
document.addEventListener('mouseup', handlePointerUp);

document.addEventListener('touchstart', handlePointerDown, {passive: false});
document.addEventListener('touchmove', handlePointerMove, {passive: false});
document.addEventListener('touchend', handlePointerUp);

function createConnectParticles(r, c, colorStr) {
    const cx = gameState.offsetX + c * gameState.cellSize + gameState.cellSize/2;
    const cy = gameState.offsetY + r * gameState.cellSize + gameState.cellSize/2;
    for(let i=0; i<20; i++) gameState.particles.push(new Particle(cx, cy, colorStr));
}

function checkWin() {
    if (gameState.levelWon) return;
    
    // 1. Check if all nodes are connected
    for (const node of gameState.nodes) {
        const path = gameState.paths[node.colorId];
        if (!path || path.length < 2) return;
        
        const first = path[0];
        const last = path[path.length-1];
        
        // Find the two nodes for this color
        const colorNodes = gameState.nodes.filter(n => n.colorId === node.colorId);
        
        // Check if endpoints match nodes
        const matches1 = (first.r === colorNodes[0].r && first.c === colorNodes[0].c && last.r === colorNodes[1].r && last.c === colorNodes[1].c);
        const matches2 = (first.r === colorNodes[1].r && first.c === colorNodes[1].c && last.r === colorNodes[0].r && last.c === colorNodes[0].c);
        
        if (!matches1 && !matches2) return;
    }
    
    // 2. Check if all cells are filled
    let filledCells = 0;
    for (const colorId in gameState.paths) {
        filledCells += gameState.paths[colorId].length;
    }
    // Nodes are counted twice if they are endpoints, wait no, they are just added to path.
    // Length is number of cells in path.
    if (filledCells === gameState.gridSize * gameState.gridSize) {
        winLevel();
    }
}

function winLevel() {
    gameState.levelWon = true;
    sfx.play('complete');
    
    // Celebration particles
    for(let i=0; i<50; i++) {
        gameState.particles.push(new Particle(cw/2, ch/2, colors[Math.floor(Math.random()*colors.length)]));
    }
    
    setTimeout(() => {
        ui.levelCompleteScreen.classList.add('active');
        ui.uiLayer.style.display = 'none';
    }, 1000);
}

function gameComplete() {
    ui.uiLayer.style.display = 'none';
    ui.levelCompleteScreen.classList.remove('active');
    ui.gameCompleteScreen.classList.add('active');
}

function update() {
    if (!gameState.active) return;
    gameState.particles.forEach(p => p.update());
    gameState.particles = gameState.particles.filter(p => p.life > 0);
}

function draw() {
    // Background is handled by CSS, just clear canvas
    ctx.clearRect(0, 0, cw, ch);
    
    if (!gameState.active) return;
    
    const { offsetX, offsetY, cellSize, gridSize } = gameState;
    
    // Draw Grid Base
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 20;
    ctx.fillRect(offsetX, offsetY, cellSize * gridSize, cellSize * gridSize);
    ctx.shadowBlur = 0;
    
    // Draw Grid Lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= gridSize; i++) {
        ctx.moveTo(offsetX + i * cellSize, offsetY);
        ctx.lineTo(offsetX + i * cellSize, offsetY + gridSize * cellSize);
        ctx.moveTo(offsetX, offsetY + i * cellSize);
        ctx.lineTo(offsetX + gridSize * cellSize, offsetY + i * cellSize);
    }
    ctx.stroke();

    // Draw Paths
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    for (const colorId in gameState.paths) {
        const path = gameState.paths[colorId];
        if (path.length > 0) {
            ctx.strokeStyle = colors[parseInt(colorId) - 1];
            ctx.lineWidth = cellSize * 0.4;
            
            ctx.beginPath();
            for (let i = 0; i < path.length; i++) {
                const cx = offsetX + path[i].c * cellSize + cellSize/2;
                const cy = offsetY + path[i].r * cellSize + cellSize/2;
                if (i === 0) ctx.moveTo(cx, cy);
                else ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        }
    }

    // Draw Nodes
    for (const node of gameState.nodes) {
        const cx = offsetX + node.c * cellSize + cellSize/2;
        const cy = offsetY + node.r * cellSize + cellSize/2;
        const colorStr = colors[node.colorId - 1];
        
        ctx.fillStyle = colorStr;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.35, 0, Math.PI*2);
        ctx.fill();
        
        // Inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(cx - cellSize*0.1, cy - cellSize*0.1, cellSize * 0.1, 0, Math.PI*2);
        ctx.fill();
        
        // Pulse effect if connected
        const path = gameState.paths[node.colorId];
        if (path && path.length > 1) {
            const first = path[0];
            const last = path[path.length-1];
            if ((first.r === node.r && first.c === node.c) || (last.r === node.r && last.c === node.c)) {
                // If the other end is also a node, it's connected
                const isFullyConnected = gameState.nodes.some(n => n.colorId === node.colorId && n !== node && ((first.r === n.r && first.c === n.c) || (last.r === n.r && last.c === n.c)));
                if (isFullyConnected) {
                    ctx.strokeStyle = colorStr;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(cx, cy, cellSize * 0.45 + Math.sin(Date.now() * 0.005) * 5, 0, Math.PI*2);
                    ctx.stroke();
                }
            }
        }
    }

    // Draw Particles
    gameState.particles.forEach(p => p.draw(ctx));
}

function loop() {
    requestAnimationFrame(loop);
    update();
    draw();
}

function startGame() {
    sfx.init();
    resize();
    gameState.active = true;
    gameState.paused = false;
    loadLevel(0);
    
    ui.startScreen.classList.remove('active');
    ui.pauseScreen.classList.remove('active');
    ui.gameCompleteScreen.classList.remove('active');
    ui.uiLayer.style.display = 'block';
}

function togglePause() {
    if (!gameState.active || gameState.levelWon) return;
    gameState.paused = !gameState.paused;
    if (gameState.paused) {
        ui.pauseScreen.classList.add('active');
    } else {
        ui.pauseScreen.classList.remove('active');
    }
}

// UI Event Listeners
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('instructions-btn').addEventListener('click', () => {
    sfx.init();
    ui.startScreen.classList.remove('active');
    ui.instructionsScreen.classList.add('active');
});
document.getElementById('back-btn').addEventListener('click', () => {
    ui.instructionsScreen.classList.remove('active');
    ui.startScreen.classList.add('active');
});
ui.soundToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    sfx.init();
    gameState.soundEnabled = !gameState.soundEnabled;
    ui.soundToggle.innerText = gameState.soundEnabled ? '🔊' : '🔇';
});
document.getElementById('pause-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause();
});
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('quit-btn').addEventListener('click', () => {
    gameState.active = false;
    ui.pauseScreen.classList.remove('active');
    ui.uiLayer.style.display = 'none';
    ui.startScreen.classList.add('active');
});

document.getElementById('restart-level-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    loadLevel(gameState.currentLevel);
});

document.getElementById('next-level-btn').addEventListener('click', () => {
    ui.levelCompleteScreen.classList.remove('active');
    ui.uiLayer.style.display = 'block';
    loadLevel(gameState.currentLevel + 1);
});

// Init
resize();
requestAnimationFrame(loop);
