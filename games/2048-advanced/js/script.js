// ==== GAME ENGINE CORE ====

const LEVELS = [
    { lvl: 1, size: 4, target: 256, rocks: 0, desc: "Classic 4x4, reach 256" },
    { lvl: 2, size: 4, target: 512, rocks: 1, desc: "Grid 4x4 + 1 Rock" },
    { lvl: 3, size: 5, target: 1024, rocks: 2, desc: "Bigger 5x5 Grid + Rocks" },
    { lvl: 4, size: 5, target: 2048, rocks: 3, desc: "Hunt for 2048!" },
    { lvl: 5, size: 6, target: 4096, rocks: 4, desc: "Massive 6x6 Grid" },
    { lvl: 6, size: 6, target: 8192, rocks: 6, desc: "Ultimate Challenge" },
    // Infinite scaling after by target*2
];

let gameState = {
    levelIdx: 0,
    score: 0,
    bestScore: localStorage.getItem('2048adv_best') || 0,
    grid: [],
    size: 4,
    tiles: {}, // id -> tile obj
    tileIdCounter: 0,
    isAnimating: false,
    isPaused: false,
    soundEnabled: true,
};

// UI Elements
const els = {
    app: document.getElementById('app-container'),
    bg1: document.getElementById('bg-layer-1'),
    boardContainer: document.getElementById('board-container'),
    boardGrid: document.getElementById('board-grid'),
    tilesLayer: document.getElementById('tiles-layer'),
    levelBadge: document.getElementById('level-badge'),
    score: document.getElementById('score-current'),
    bestScore: document.getElementById('score-best'),
    target: document.getElementById('target-value'),
    
    // Screens
    hud: document.getElementById('hud'),
    ctrlTop: document.getElementById('controls-top'),
    sStart: document.getElementById('screen-start'),
    sPause: document.getElementById('screen-pause'),
    sGameOver: document.getElementById('screen-gameover'),
    sLevelUp: document.getElementById('screen-level-up'),
    
// Text references
    finalScore: document.getElementById('final-score-val'),
    nextLevelDesc: document.getElementById('next-level-desc')
};

// High-performance Audio Synthesis Module
const Synth = {
    ctx: new (window.AudioContext || window.webkitAudioContext)(),
    play(type) {
        if (!gameState.soundEnabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        const now = this.ctx.currentTime;
        if (type === 'slide') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'merge') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.15);
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'action') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'levelup') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554, now + 0.1);
            osc.frequency.setValueAtTime(659, now + 0.2);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        } else if (type === 'gameover') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.5);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        }
    }
};

function playSfx(type) {
    Synth.play(type);
}

// ==== INIT & SETUP ====

function initGame() {
    els.bestScore.innerText = gameState.bestScore;
    setupEvents();
    resizeBoard();
    window.addEventListener('resize', resizeBoard);
}

function startGame() {
    els.app.classList.add('game-active');
    els.sStart.classList.remove('active');
    els.hud.classList.remove('hidden-initially');
    els.ctrlTop.classList.remove('hidden-initially');
    els.boardContainer.classList.remove('hidden-initially');
    playSfx('click');
    loadLevel(0);
}

function loadLevel(lvlIdx, keepState = false) {
    gameState.levelIdx = lvlIdx;
    const config = LEVELS[Math.min(lvlIdx, LEVELS.length - 1)];
    
    // Update theme
    document.body.className = `level-${(lvlIdx % 7) + 1}`;
    els.levelBadge.innerText = `LVL ${lvlIdx + 1}`;
    els.target.innerText = config.target;
    
    // Dynamic pulse to draw user attention
    els.target.parentElement.classList.add('pulse');
    setTimeout(() => els.target.parentElement.classList.remove('pulse'), 2000);
    
    if (keepState) {
        const oldSize = gameState.size;
        const newSize = config.size;
        
        if (newSize !== oldSize) {
            gameState.size = newSize;
            
            // Expand grid array securely to not lose tiles
            let newGrid = Array(newSize).fill(null).map(() => Array(newSize).fill(null));
            for (let r = 0; r < oldSize; r++) {
                for (let c = 0; c < oldSize; c++) {
                    newGrid[r][c] = gameState.grid[r][c];
                }
            }
            gameState.grid = newGrid;
            
            // Rebuild DOM Grid cells properly dynamically
            els.boardGrid.innerHTML = '';
            for (let r = 0; r < newSize; r++) {
                for (let c = 0; c < newSize; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'grid-cell';
                    els.boardGrid.appendChild(cell);
                }
            }
            
            // Visually resize CSS variables
            resizeBoard();
            
            // Hard relocate all existing tile positions via transitions elegantly
            for (let id in gameState.tiles) {
                updateTilePos(gameState.tiles[id].el, gameState.tiles[id].r, gameState.tiles[id].c);
            }
        }
        
        // Add new rocks progressively
        const prevConfig = LEVELS[Math.max(0, lvlIdx - 1)];
        const additionalRocks = config.rocks - prevConfig.rocks;
        for (let i = 0; i < additionalRocks; i++) {
            spawnTile(true);
        }
        
    } else {
        gameState.size = config.size;
        gameState.tiles = {};
        els.tilesLayer.innerHTML = '';
        
        resizeBoard();
        createGrid(config.size);
        
        // Add rocks
        for (let i = 0; i < config.rocks; i++) {
            spawnTile(true);
        }
        
        // Add initial tiles
        spawnTile();
        spawnTile();
        updateScore(0);
    }
    
    gameState.isPaused = false;
}

function resizeBoard() {
    const parentWidth = els.boardContainer.parentElement.clientWidth - 40;
    const parentHeight = els.boardContainer.parentElement.clientHeight - 40;
    const maxSize = Math.min(parentWidth, parentHeight, 500);
    
    const size = gameState.size;
    const gap = maxSize * 0.02;
    const padding = maxSize * 0.02;
    const innerSpace = maxSize - (padding * 2) - (gap * (size - 1));
    const cellSize = innerSpace / size;
    
    document.documentElement.style.setProperty('--grid-size', size);
    document.documentElement.style.setProperty('--gap', `${gap}px`);
    document.documentElement.style.setProperty('--board-padding', `${padding}px`);
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
}

function createGrid(size) {
    els.boardGrid.innerHTML = '';
    gameState.grid = Array(size).fill(null).map(() => Array(size).fill(null));
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            els.boardGrid.appendChild(cell);
        }
    }
}

function spawnTile(isRock = false) {
    const emptyCells = [];
    for (let r = 0; r < gameState.size; r++) {
        for (let c = 0; c < gameState.size; c++) {
            if (gameState.grid[r][c] === null) emptyCells.push({r, c});
        }
    }
    if (emptyCells.length === 0) return null;
    
    const {r, c} = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const val = isRock ? -1 : (Math.random() < 0.9 ? 2 : 4);
    const id = ++gameState.tileIdCounter;
    
    const tileObj = { id, r, c, val, el: null };
    gameState.tiles[id] = tileObj;
    gameState.grid[r][c] = id;
    
    const el = document.createElement('div');
    el.className = 'tile new';
    el.dataset.val = val;
    el.innerText = val > 0 ? val : '';
    el.id = `tile-${id}`;
    
    updateTilePos(el, r, c);
    els.tilesLayer.appendChild(el);
    tileObj.el = el;
    
    setTimeout(() => el.classList.remove('new'), 300);
    return tileObj;
}

function updateTilePos(el, r, c) {
    const sizeStr = getComputedStyle(document.documentElement).getPropertyValue('--cell-size');
    const gapStr = getComputedStyle(document.documentElement).getPropertyValue('--gap');
    const size = parseFloat(sizeStr);
    const gap = parseFloat(gapStr);
    
    const x = c * (size + gap);
    const y = r * (size + gap);
    el.style.transform = `translate(${x}px, ${y}px)`;
}

// ==== INPUTS ====

function setupEvents() {
    els.sStart.querySelector('#btn-start').addEventListener('click', startGame);
    
    document.getElementById('btn-pause').addEventListener('click', () => {
        gameState.isPaused = true;
        els.sPause.classList.add('active');
        playSfx('click');
    });
    
    document.getElementById('btn-resume').addEventListener('click', () => {
        gameState.isPaused = false;
        els.sPause.classList.remove('active');
        playSfx('click');
    });
    
    document.getElementById('btn-restart').addEventListener('click', () => {
        els.sPause.classList.remove('active');
        playSfx('action');
        loadLevel(gameState.levelIdx);
        updateScore(-gameState.score); // Reset score
    });
    
    document.getElementById('btn-retry').addEventListener('click', () => {
        els.sGameOver.classList.remove('active');
        playSfx('action');
        updateScore(-gameState.score);
        loadLevel(0); // Full reset
    });
    
    document.getElementById('btn-next').addEventListener('click', () => {
        els.sLevelUp.classList.remove('active');
        playSfx('action');
        loadLevel(gameState.levelIdx + 1, true);
    });
    
    document.getElementById('btn-sound').addEventListener('click', (e) => {
        gameState.soundEnabled = !gameState.soundEnabled;
        e.currentTarget.innerText = gameState.soundEnabled ? '🔊' : '🔇';
    });

    // Keyboard
    window.addEventListener('keydown', (e) => {
        if (gameState.isPaused || els.sStart.classList.contains('active')) return;
        switch(e.key) {
            case 'ArrowUp': case 'w': move('up'); break;
            case 'ArrowDown': case 's': move('down'); break;
            case 'ArrowLeft': case 'a': move('left'); break;
            case 'ArrowRight': case 'd': move('right'); break;
        }
    });
    
    // Touch
    let touchStartX = 0;
    let touchStartY = 0;
    els.boardContainer.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        // e.preventDefault();
    }, {passive: true});
    
    els.boardContainer.addEventListener('touchmove', e => {
        e.preventDefault(); // Prevent scrolling while playing
    }, {passive: false});

    els.boardContainer.addEventListener('touchend', e => {
        if (gameState.isPaused || els.sStart.classList.contains('active')) return;
        const dx = e.changedTouches[0].screenX - touchStartX;
        const dy = e.changedTouches[0].screenY - touchStartY;
        
        if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
            if (Math.abs(dx) > Math.abs(dy)) {
                move(dx > 0 ? 'right' : 'left');
            } else {
                move(dy > 0 ? 'down' : 'up');
            }
        }
    });

    // Parallax
    document.addEventListener('mousemove', e => {
        if (!els.app.classList.contains('game-active')) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 20;
        const y = (e.clientY / window.innerHeight - 0.5) * 20;
        els.boardContainer.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
        els.bg1.style.transform = `translate(${x*2}px, ${y*2}px)`;
    });
}

// ==== CORE LOGIC ====

function move(dir) {
    if (gameState.isAnimating) return;
    
    const size = gameState.size;
    let moved = false;
    let mergedTotal = 0;
    
    // Config traversal
    let rs = 0, re = size, rd = 1;
    let cs = 0, ce = size, cd = 1;
    
    if (dir === 'down') { rs = size - 1; re = -1; rd = -1; }
    if (dir === 'right') { cs = size - 1; ce = -1; cd = -1; }
    
    // Track merges this turn
    const mergedThisTurn = Array(size).fill(null).map(() => Array(size).fill(false));
    
    // Gather moves
    const movements = [];
    
    for (let r = rs; r !== re; r += rd) {
        for (let c = cs; c !== ce; c += cd) {
            const id = gameState.grid[r][c];
            if (!id) continue;
            
            const tile = gameState.tiles[id];
            if (tile.val === -1) continue; // Rock cannot move
            
            // Find furthest destination
            let destR = r;
            let destC = c;
            let nextR = r + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0);
            let nextC = c + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
            
            while (
                nextR >= 0 && nextR < size && 
                nextC >= 0 && nextC < size && 
                gameState.grid[nextR][nextC] === null
            ) {
                destR = nextR;
                destC = nextC;
                nextR += (dir === 'down' ? 1 : dir === 'up' ? -1 : 0);
                nextC += (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
            }
            
            // Check for merge
            let willMerge = false;
            if (
                nextR >= 0 && nextR < size && 
                nextC >= 0 && nextC < size
            ) {
                const mapId = gameState.grid[nextR][nextC];
                if (mapId) {
                    const nextTile = gameState.tiles[mapId];
                    if (nextTile && nextTile.val === tile.val && !mergedThisTurn[nextR][nextC] && nextTile.val !== -1) {
                        destR = nextR;
                        destC = nextC;
                        willMerge = true;
                    }
                }
            }
            
            if (destR !== r || destC !== c) {
                moved = true;
                gameState.grid[r][c] = null;
                if (!willMerge) {
                    gameState.grid[destR][destC] = id;
                } else {
                    mergedThisTurn[destR][destC] = true;
                    mergedTotal += tile.val * 2;
                }
                
                movements.push({
                    tile, destR, destC, willMerge,
                    targetId: willMerge ? gameState.grid[destR][destC] : null
                });
            }
        }
    }
    
    if (moved) {
        gameState.isAnimating = true;
        
        // Execute DOM animations
        movements.forEach(m => {
            updateTilePos(m.tile.el, m.destR, m.destC);
        });
        
        if (mergedTotal > 0) {
            playSfx('merge');
            updateScore(mergedTotal);
        } else {
            playSfx('slide');
        }
        
        // Finalize after transition
        setTimeout(() => {
            movements.forEach(m => {
                m.tile.r = m.destR;
                m.tile.c = m.destC;
                
                if (m.willMerge) {
                    // Update target tile
                    const tTile = gameState.tiles[m.targetId];
                    tTile.val *= 2;
                    tTile.el.dataset.val = tTile.val;
                    tTile.el.innerText = tTile.val;
                    tTile.el.classList.add('merged');
                    setTimeout(() => tTile.el.classList.remove('merged'), 300);
                    
                    // Remove source tile
                    m.tile.el.remove();
                    delete gameState.tiles[m.tile.id];
                }
            });
            
            spawnTile();
            checkGameState();
            gameState.isAnimating = false;
        }, 150); // Matches CSS transition
    }
}

function updateScore(add) {
    gameState.score += add;
    els.score.innerText = gameState.score;
    if (gameState.score > gameState.bestScore) {
        gameState.bestScore = gameState.score;
        els.bestScore.innerText = gameState.bestScore;
        localStorage.setItem('2048adv_best', gameState.bestScore);
    }
}

function checkGameState() {
    const config = LEVELS[Math.min(gameState.levelIdx, LEVELS.length - 1)];
    
    // Check Win (Level target reached)
    let maxTile = 0;
    for (let id in gameState.tiles) {
        if (gameState.tiles[id].val > maxTile) maxTile = gameState.tiles[id].val;
    }
    
    if (maxTile >= config.target) {
        gameState.isPaused = true;
        playSfx('levelup');
        const nextConfig = LEVELS[Math.min(gameState.levelIdx + 1, LEVELS.length - 1)];
        els.nextLevelDesc.innerText = `Next: ${nextConfig.desc}`;
        els.sLevelUp.classList.add('active');
        return;
    }
    
    // Check Lose (No moves left)
    const size = gameState.size;
    let full = true;
    for (let r=0; r<size; r++) {
        for (let c=0; c<size; c++) {
            if (gameState.grid[r][c] === null) {
                full = false; break;
            }
        }
    }
    
    if (full) {
        let hasMoves = false;
        for (let r=0; r<size; r++) {
            for (let c=0; c<size; c++) {
                const id = gameState.grid[r][c];
                if (!id) continue;
                const tile = gameState.tiles[id];
                if (tile.val === -1) continue; // rock
                
                // check right
                if (c < size-1) {
                    const rId = gameState.grid[r][c+1];
                    if (rId && gameState.tiles[rId].val === tile.val) hasMoves = true;
                }
                // check down
                if (r < size-1) {
                    const dId = gameState.grid[r+1][c];
                    if (dId && gameState.tiles[dId].val === tile.val) hasMoves = true;
                }
            }
        }
        
        if (!hasMoves) {
            gameState.isPaused = true;
            playSfx('gameover');
            els.finalScore.innerText = gameState.score;
            els.sGameOver.classList.add('active');
        }
    }
}

// Start
initGame();
