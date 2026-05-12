// ============================================================
// SIEGE DEFENSE — Complete Tower Defense Game Engine
// Pure vanilla JS, zero dependencies, zero build step
// ============================================================

(function() {
'use strict';

// ==================== CONFIGURATION ====================
const GRID = 40;           // Grid cell size in pixels
const COLS = 15;
const ROWS = 12;
const CANVAS_W = COLS * GRID;
const CANVAS_H = ROWS * GRID;

const TOWER_DEFS = {
    archer: { name: 'Archer', cost: 50, damage: 15, range: 120, fireRate: 800, color: '#4caf50', bulletColor: '#8bc34a', bulletSpeed: 6, splash: 0, slow: 0, emoji: '🏹' },
    mage:   { name: 'Mage',   cost: 100, damage: 30, range: 140, fireRate: 1200, color: '#9c27b0', bulletColor: '#ce93d8', bulletSpeed: 5, splash: 0, slow: 0, emoji: '🔮' },
    cannon: { name: 'Cannon', cost: 150, damage: 50, range: 100, fireRate: 2000, color: '#e64a19', bulletColor: '#ff8a65', bulletSpeed: 4, splash: 40, slow: 0, emoji: '💣' },
    ice:    { name: 'Ice',    cost: 75,  damage: 5,  range: 130, fireRate: 1000, color: '#0288d1', bulletColor: '#81d4fa', bulletSpeed: 5, splash: 0, slow: 0.5, emoji: '❄️' }
};

// ==================== GAME STATE ====================
let canvas, ctx;
let gameState = 'idle'; // idle, waving, gameover
let gold = 200;
let health = 20;
let wave = 0;
let score = 0;
let speedMultiplier = 1;
let selectedTowerType = null;
let selectedPlacedTower = null;

let towers = [];
let enemies = [];
let bullets = [];
let particles = [];
let floatingTexts = [];

// Grid: 0=grass, 1=path, 2=tower, 3=spawn, 4=exit
let grid = [];
let path = [];

// ==================== PATH DEFINITION ====================
function buildMap() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < COLS; c++) {
            grid[r][c] = 0;
        }
    }

    // Define a winding path
    const pathCells = [
        [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],
        [7,2],[7,3],[7,4],[7,5],
        [6,5],[5,5],[4,5],[3,5],[2,5],[1,5],
        [1,6],[1,7],[1,8],
        [2,8],[3,8],[4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],[12,8],[13,8],
        [13,9],[13,10],
        [12,10],[11,10],[10,10],[9,10],[8,10],[7,10],[6,10],[5,10],[4,10],
        [4,9],
        [4,8] // loops handled by path order
    ];

    // Cleaner path that doesn't self-intersect
    path = [
        [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],
        [7,2],[7,3],[7,4],[7,5],
        [6,5],[5,5],[4,5],[3,5],[2,5],[1,5],
        [1,6],[1,7],[1,8],
        [2,8],[3,8],[4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],
        [10,7],[10,6],[10,5],[10,4],
        [11,4],[12,4],[13,4],
        [13,5],[13,6],[13,7],[13,8],[13,9],[13,10],
        [12,10],[11,10],[10,10],[9,10],[8,10],[7,10],[6,10],[5,10],[4,10],[3,10]
    ];

    path.forEach(function(p) { grid[p[1]][p[0]] = 1; });
    grid[path[0][1]][path[0][0]] = 3; // spawn
    grid[path[path.length-1][1]][path[path.length-1][0]] = 4; // exit
}

function cellCenter(col, row) {
    return { x: col * GRID + GRID / 2, y: row * GRID + GRID / 2 };
}

// ==================== ENEMY CLASS ====================
function createEnemy(type, waveNum) {
    var start = cellCenter(path[0][0], path[0][1]);
    var hpBase = { goblin: 40, orc: 100, dragon: 250, slime: 60 };
    var speedBase = { goblin: 1.8, orc: 1.0, dragon: 1.5, slime: 0.7 };
    var goldBase = { goblin: 10, orc: 25, dragon: 50, slime: 15 };
    var colorBase = { goblin: '#66bb6a', orc: '#78909c', dragon: '#ef5350', slime: '#ab47bc' };
    var sizeBase = { goblin: 8, orc: 14, dragon: 16, slime: 10 };

    var hpScale = 1 + (waveNum - 1) * 0.3;

    return {
        type: type,
        x: start.x,
        y: start.y,
        hp: Math.floor((hpBase[type] || 50) * hpScale),
        maxHp: Math.floor((hpBase[type] || 50) * hpScale),
        speed: speedBase[type] || 1,
        baseSpeed: speedBase[type] || 1,
        goldValue: goldBase[type] || 10,
        color: colorBase[type] || '#66bb6a',
        size: sizeBase[type] || 10,
        pathIndex: 0,
        slowTimer: 0,
        alive: true
    };
}

function moveEnemy(e, dt) {
    if (e.pathIndex >= path.length - 1) {
        // Reached the end
        health--;
        e.alive = false;
        updateUI();
        if (health <= 0) {
            gameState = 'gameover';
            showGameOver();
        }
        return;
    }

    // Slow effect
    var speed = e.speed;
    if (e.slowTimer > 0) {
        speed *= 0.4;
        e.slowTimer -= dt;
    } else {
        e.speed = e.baseSpeed;
    }

    var target = cellCenter(path[e.pathIndex + 1][0], path[e.pathIndex + 1][1]);
    var dx = target.x - e.x;
    var dy = target.y - e.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < speed * dt * 0.06) {
        e.x = target.x;
        e.y = target.y;
        e.pathIndex++;
    } else {
        e.x += (dx / dist) * speed * dt * 0.06;
        e.y += (dy / dist) * speed * dt * 0.06;
    }
}

// ==================== TOWER CLASS ====================
function createTower(type, col, row) {
    var def = TOWER_DEFS[type];
    var pos = cellCenter(col, row);
    return {
        type: type,
        col: col,
        row: row,
        x: pos.x,
        y: pos.y,
        level: 1,
        damage: def.damage,
        range: def.range,
        fireRate: def.fireRate,
        color: def.color,
        bulletColor: def.bulletColor,
        bulletSpeed: def.bulletSpeed,
        splash: def.splash,
        slow: def.slow,
        lastFire: 0,
        angle: 0
    };
}

function towerUpgradeCost(tower) {
    return Math.floor(TOWER_DEFS[tower.type].cost * 0.6 * tower.level);
}

function towerSellValue(tower) {
    var totalInvested = TOWER_DEFS[tower.type].cost;
    for (var i = 1; i < tower.level; i++) {
        totalInvested += Math.floor(TOWER_DEFS[tower.type].cost * 0.6 * i);
    }
    return Math.floor(totalInvested * 0.6);
}

// ==================== BULLET CLASS ====================
function createBullet(tower, target) {
    return {
        x: tower.x,
        y: tower.y,
        targetId: target,
        speed: tower.bulletSpeed,
        damage: tower.damage,
        splash: tower.splash,
        slow: tower.slow,
        color: tower.bulletColor,
        alive: true
    };
}

// ==================== WAVE SYSTEM ====================
var waveEnemies = [];
var waveSpawnTimer = 0;
var waveSpawnDelay = 800;

function startWave() {
    if (gameState === 'waving') return;
    wave++;
    gameState = 'waving';
    updateUI();

    waveEnemies = [];
    var count = 5 + wave * 2;
    
    for (var i = 0; i < count; i++) {
        var roll = Math.random();
        var type;
        if (wave >= 8 && roll < 0.1) type = 'dragon';
        else if (wave >= 3 && roll < 0.35) type = 'orc';
        else if (roll < 0.6) type = 'goblin';
        else type = 'slime';
        
        waveEnemies.push(type);
    }

    waveSpawnTimer = 0;
    waveSpawnDelay = Math.max(300, 800 - wave * 20);
    
    document.getElementById('wave-btn').disabled = true;
    document.getElementById('wave-btn').textContent = '⚔️ Wave ' + wave;
}

// ==================== PARTICLES ====================
function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 30 + Math.random() * 20,
            maxLife: 50,
            color: color,
            size: 2 + Math.random() * 3
        });
    }
}

function spawnFloatingText(x, y, text, color) {
    floatingTexts.push({ x: x, y: y, text: text, color: color, life: 40 });
}

// ==================== RENDERING ====================
function drawGrid() {
    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
            var x = c * GRID;
            var y = r * GRID;
            
            if (grid[r][c] === 1) {
                // Path
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(x, y, GRID, GRID);
                // Path texture (subtle dots)
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                for (var i = 0; i < 3; i++) {
                    var dx = x + 5 + Math.sin(c * 7 + i * 13) * 12;
                    var dy = y + 5 + Math.cos(r * 11 + i * 7) * 12;
                    ctx.beginPath();
                    ctx.arc(dx, dy, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (grid[r][c] === 3) {
                // Spawn
                ctx.fillStyle = '#4a148c';
                ctx.fillRect(x, y, GRID, GRID);
                ctx.fillStyle = '#ce93d8';
                ctx.font = '10px Outfit';
                ctx.textAlign = 'center';
                ctx.fillText('SPAWN', x + GRID/2, y + GRID/2 + 3);
            } else if (grid[r][c] === 4) {
                // Exit
                ctx.fillStyle = '#b71c1c';
                ctx.fillRect(x, y, GRID, GRID);
                ctx.fillStyle = '#ef9a9a';
                ctx.font = '10px Outfit';
                ctx.textAlign = 'center';
                ctx.fillText('EXIT', x + GRID/2, y + GRID/2 + 3);
            } else {
                // Grass
                var shade = ((c + r) % 2 === 0) ? '#2e7d32' : '#388e3c';
                ctx.fillStyle = shade;
                ctx.fillRect(x, y, GRID, GRID);
            }
        }
    }
    // Grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    for (var r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * GRID);
        ctx.lineTo(CANVAS_W, r * GRID);
        ctx.stroke();
    }
    for (var c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * GRID, 0);
        ctx.lineTo(c * GRID, CANVAS_H);
        ctx.stroke();
    }
}

function drawTower(t) {
    ctx.save();
    ctx.translate(t.x, t.y);

    // Range indicator for selected
    if (selectedPlacedTower === t) {
        ctx.beginPath();
        ctx.arc(0, 0, t.range, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(124,77,255,0.1)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(124,77,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Base
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(0, 0, GRID * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Level indicator (small dots)
    ctx.fillStyle = '#ffd700';
    for (var i = 0; i < t.level && i < 5; i++) {
        var angle = -Math.PI/2 + (i - (t.level-1)/2) * 0.5;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 18, Math.sin(angle) * 18, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Turret gun pointing at angle
    ctx.rotate(t.angle);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(-2, -GRID * 0.35, 4, -8);
    
    ctx.restore();
}

function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(2, e.size * 0.6, e.size * 0.7, e.size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(0, 0, e.size, 0, Math.PI * 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Slow effect
    if (e.slowTimer > 0) {
        ctx.strokeStyle = '#81d4fa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.size + 3, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Eyes
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(-3, -2, 3, 0, Math.PI * 2);
    ctx.arc(3, -2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-2, -2, 1.5, 0, Math.PI * 2);
    ctx.arc(4, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Health bar
    var barW = e.size * 2;
    var barH = 4;
    var barY = -e.size - 8;
    ctx.fillStyle = '#222';
    ctx.fillRect(-barW / 2, barY, barW, barH);
    var hpRatio = e.hp / e.maxHp;
    ctx.fillStyle = hpRatio > 0.5 ? '#4caf50' : hpRatio > 0.25 ? '#ff9800' : '#f44336';
    ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);

    ctx.restore();
}

function drawBullet(b) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.fillStyle = b.color + '44';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
    ctx.fill();
}

function drawParticles() {
    particles.forEach(function(p) {
        var alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawFloatingTexts() {
    floatingTexts.forEach(function(ft) {
        var alpha = ft.life / 40;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 14px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
    });
    ctx.globalAlpha = 1;
}

function drawPlacementPreview(mx, my) {
    if (!selectedTowerType || gameState === 'gameover') return;
    
    var col = Math.floor(mx / GRID);
    var row = Math.floor(my / GRID);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    
    var canPlace = grid[row][col] === 0;
    var def = TOWER_DEFS[selectedTowerType];
    var center = cellCenter(col, row);

    // Range circle
    ctx.beginPath();
    ctx.arc(center.x, center.y, def.range, 0, Math.PI * 2);
    ctx.fillStyle = canPlace ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)';
    ctx.fill();
    ctx.strokeStyle = canPlace ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tower preview
    ctx.fillStyle = canPlace ? def.color + '88' : '#f4433688';
    ctx.beginPath();
    ctx.arc(center.x, center.y, GRID * 0.38, 0, Math.PI * 2);
    ctx.fill();
}

// ==================== UPDATE ====================
var mouseX = 0, mouseY = 0;

function update(dt) {
    if (gameState === 'gameover') return;

    var effectiveDt = dt * speedMultiplier;

    // Spawn enemies
    if (gameState === 'waving' && waveEnemies.length > 0) {
        waveSpawnTimer -= effectiveDt;
        if (waveSpawnTimer <= 0) {
            var type = waveEnemies.shift();
            enemies.push(createEnemy(type, wave));
            waveSpawnTimer = waveSpawnDelay;
        }
    }

    // Check wave complete
    if (gameState === 'waving' && waveEnemies.length === 0 && enemies.length === 0) {
        gameState = 'idle';
        gold += 25 + wave * 5; // Wave bonus
        spawnFloatingText(CANVAS_W / 2, CANVAS_H / 2, '💰 Wave Bonus!', '#ffd700');
        updateUI();
        document.getElementById('wave-btn').disabled = false;
        document.getElementById('wave-btn').textContent = '⚔️ Next Wave';
    }

    // Move enemies
    enemies.forEach(function(e) {
        if (e.alive) moveEnemy(e, effectiveDt);
    });

    // Tower targeting and firing
    var now = performance.now();
    towers.forEach(function(t) {
        // Find target
        var target = null;
        var minDist = t.range;
        enemies.forEach(function(e) {
            if (!e.alive) return;
            var d = Math.sqrt((e.x - t.x) * (e.x - t.x) + (e.y - t.y) * (e.y - t.y));
            if (d < minDist) {
                minDist = d;
                target = e;
            }
        });

        if (target) {
            t.angle = Math.atan2(target.y - t.y, target.x - t.x) + Math.PI / 2;
            
            if (now - t.lastFire > t.fireRate / speedMultiplier) {
                bullets.push(createBullet(t, enemies.indexOf(target)));
                t.lastFire = now;
            }
        }
    });

    // Move bullets
    bullets.forEach(function(b) {
        if (!b.alive) return;
        var target = enemies[b.targetId];
        if (!target || !target.alive) {
            b.alive = false;
            return;
        }
        var dx = target.x - b.x;
        var dy = target.y - b.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 8) {
            // Hit!
            b.alive = false;
            target.hp -= b.damage;
            spawnParticles(target.x, target.y, b.color, 5);

            // Splash damage
            if (b.splash > 0) {
                enemies.forEach(function(e2) {
                    if (e2 === target || !e2.alive) return;
                    var sd = Math.sqrt((e2.x - target.x) * (e2.x - target.x) + (e2.y - target.y) * (e2.y - target.y));
                    if (sd < b.splash) {
                        e2.hp -= Math.floor(b.damage * 0.5);
                        spawnParticles(e2.x, e2.y, b.color, 3);
                    }
                });
            }

            // Slow
            if (b.slow > 0) {
                target.slowTimer = 2000;
                // Slow nearby too
                enemies.forEach(function(e2) {
                    if (e2 === target || !e2.alive) return;
                    var sd = Math.sqrt((e2.x - target.x) * (e2.x - target.x) + (e2.y - target.y) * (e2.y - target.y));
                    if (sd < 50) {
                        e2.slowTimer = 1500;
                    }
                });
            }

            if (target.hp <= 0) {
                target.alive = false;
                gold += target.goldValue;
                score += target.goldValue;
                spawnFloatingText(target.x, target.y - 15, '+' + target.goldValue, '#ffd700');
                spawnParticles(target.x, target.y, target.color, 12);
                updateUI();
            }
        } else {
            var moveSpeed = b.speed * effectiveDt * 0.3;
            b.x += (dx / dist) * moveSpeed;
            b.y += (dy / dist) * moveSpeed;
        }
    });

    // Update particles
    particles.forEach(function(p) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life--;
    });

    // Update floating texts
    floatingTexts.forEach(function(ft) {
        ft.y -= 0.8;
        ft.life--;
    });

    // Cleanup
    enemies = enemies.filter(function(e) { return e.alive; });
    bullets = bullets.filter(function(b) { return b.alive; });
    particles = particles.filter(function(p) { return p.life > 0; });
    floatingTexts = floatingTexts.filter(function(ft) { return ft.life > 0; });
}

// ==================== RENDER ====================
function render() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    drawGrid();

    towers.forEach(drawTower);
    enemies.forEach(function(e) { if (e.alive) drawEnemy(e); });
    bullets.forEach(function(b) { if (b.alive) drawBullet(b); });
    drawParticles();
    drawFloatingTexts();
    drawPlacementPreview(mouseX, mouseY);
}

// ==================== GAME LOOP ====================
var lastTime = 0;
function gameLoop(timestamp) {
    var dt = timestamp - lastTime;
    lastTime = timestamp;
    if (dt > 100) dt = 16; // Cap delta

    update(dt);
    render();
    requestAnimationFrame(gameLoop);
}

// ==================== INPUT ====================
function getCanvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = CANVAS_W / rect.width;
    var scaleY = CANVAS_H / rect.height;
    var clientX, clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

canvas = document.getElementById('gameCanvas');
ctx = canvas.getContext('2d');

function resizeCanvas() {
    var maxW = window.innerWidth - (window.innerWidth > 700 ? 200 : 0);
    var maxH = window.innerHeight - (window.innerWidth <= 700 ? 200 : 0);
    var scale = Math.min(maxW / CANVAS_W, maxH / CANVAS_H, 1);
    canvas.style.width = (CANVAS_W * scale) + 'px';
    canvas.style.height = (CANVAS_H * scale) + 'px';
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

canvas.addEventListener('mousemove', function(e) {
    var pos = getCanvasPos(e);
    mouseX = pos.x;
    mouseY = pos.y;
});

canvas.addEventListener('click', function(e) {
    var pos = getCanvasPos(e);
    handleCanvasClick(pos.x, pos.y);
});

canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    var pos = getCanvasPos(e);
    mouseX = pos.x;
    mouseY = pos.y;
    handleCanvasClick(pos.x, pos.y);
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    var pos = getCanvasPos(e);
    mouseX = pos.x;
    mouseY = pos.y;
}, { passive: false });

function handleCanvasClick(mx, my) {
    var col = Math.floor(mx / GRID);
    var row = Math.floor(my / GRID);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

    // Check if clicking on an existing tower
    var clickedTower = null;
    towers.forEach(function(t) {
        if (t.col === col && t.row === row) clickedTower = t;
    });

    if (clickedTower) {
        selectedPlacedTower = clickedTower;
        selectedTowerType = null;
        showUpgradePanel(clickedTower);
        clearTowerSelection();
        return;
    }

    // Hide upgrade panel
    hideUpgradePanel();
    selectedPlacedTower = null;

    // Place tower
    if (selectedTowerType && grid[row][col] === 0) {
        var def = TOWER_DEFS[selectedTowerType];
        if (gold >= def.cost) {
            gold -= def.cost;
            var tower = createTower(selectedTowerType, col, row);
            towers.push(tower);
            grid[row][col] = 2;
            updateUI();
            updateTowerButtons();
        }
    }
}

// ==================== UI FUNCTIONS ====================
function updateUI() {
    document.getElementById('gold-display').textContent = gold;
    document.getElementById('health-display').textContent = health;
    document.getElementById('wave-display').textContent = wave;
    updateTowerButtons();
}

function updateTowerButtons() {
    document.querySelectorAll('.tower-btn').forEach(function(btn) {
        var type = btn.getAttribute('data-tower');
        var def = TOWER_DEFS[type];
        if (gold < def.cost) {
            btn.classList.add('disabled');
        } else {
            btn.classList.remove('disabled');
        }
    });
}

window.selectTower = function(type) {
    if (gold < TOWER_DEFS[type].cost) return;
    selectedTowerType = type;
    selectedPlacedTower = null;
    hideUpgradePanel();

    document.querySelectorAll('.tower-btn').forEach(function(btn) {
        btn.classList.remove('selected');
        if (btn.getAttribute('data-tower') === type) {
            btn.classList.add('selected');
        }
    });
};

function clearTowerSelection() {
    selectedTowerType = null;
    document.querySelectorAll('.tower-btn').forEach(function(btn) {
        btn.classList.remove('selected');
    });
}

function showUpgradePanel(tower) {
    var panel = document.getElementById('upgrade-panel');
    var def = TOWER_DEFS[tower.type];
    var upgCost = towerUpgradeCost(tower);

    document.getElementById('panel-title').textContent = def.emoji + ' ' + def.name + ' Lv.' + tower.level;
    document.getElementById('panel-level').textContent = 'Level: ' + tower.level;
    document.getElementById('panel-damage').textContent = 'Damage: ' + tower.damage;
    document.getElementById('panel-range').textContent = 'Range: ' + tower.range;
    document.getElementById('panel-upgrade').textContent = '⬆️ Upgrade (' + upgCost + 'g)';
    document.getElementById('panel-upgrade').disabled = gold < upgCost;

    // Position near the tower
    var rect = canvas.getBoundingClientRect();
    var scaleX = rect.width / CANVAS_W;
    var scaleY = rect.height / CANVAS_H;
    var px = rect.left + tower.x * scaleX + 30;
    var py = rect.top + tower.y * scaleY - 50;

    // Keep on screen
    if (px + 180 > window.innerWidth) px = rect.left + tower.x * scaleX - 190;
    if (py < 10) py = 10;

    panel.style.left = px + 'px';
    panel.style.top = py + 'px';
    panel.style.display = 'block';
}

function hideUpgradePanel() {
    document.getElementById('upgrade-panel').style.display = 'none';
}

window.upgradeTower = function() {
    if (!selectedPlacedTower) return;
    var cost = towerUpgradeCost(selectedPlacedTower);
    if (gold < cost) return;

    gold -= cost;
    selectedPlacedTower.level++;
    selectedPlacedTower.damage = Math.floor(selectedPlacedTower.damage * 1.4);
    selectedPlacedTower.range += 10;
    selectedPlacedTower.fireRate = Math.max(200, selectedPlacedTower.fireRate - 80);

    updateUI();
    showUpgradePanel(selectedPlacedTower);
    spawnFloatingText(selectedPlacedTower.x, selectedPlacedTower.y - 20, '⬆️ Level ' + selectedPlacedTower.level, '#ffd700');
};

window.sellTower = function() {
    if (!selectedPlacedTower) return;
    var value = towerSellValue(selectedPlacedTower);
    gold += value;
    grid[selectedPlacedTower.row][selectedPlacedTower.col] = 0;
    towers = towers.filter(function(t) { return t !== selectedPlacedTower; });
    spawnFloatingText(selectedPlacedTower.x, selectedPlacedTower.y, '+' + value + 'g', '#ffd700');
    selectedPlacedTower = null;
    hideUpgradePanel();
    updateUI();
};

window.toggleSpeed = function() {
    if (speedMultiplier === 1) speedMultiplier = 2;
    else if (speedMultiplier === 2) speedMultiplier = 3;
    else speedMultiplier = 1;
    document.getElementById('speed-btn').textContent = 'Speed: ' + speedMultiplier + 'x';
};

window.startWave = startWave;

function showGameOver() {
    document.getElementById('final-wave').textContent = wave;
    document.getElementById('game-over-screen').style.display = 'flex';
}

window.restartGame = function() {
    document.getElementById('game-over-screen').style.display = 'none';
    gold = 200;
    health = 20;
    wave = 0;
    score = 0;
    speedMultiplier = 1;
    selectedTowerType = null;
    selectedPlacedTower = null;
    towers = [];
    enemies = [];
    bullets = [];
    particles = [];
    floatingTexts = [];
    waveEnemies = [];
    gameState = 'idle';
    buildMap();
    updateUI();
    hideUpgradePanel();
    document.getElementById('wave-btn').disabled = false;
    document.getElementById('wave-btn').textContent = '⚔️ Start Wave';
    document.getElementById('speed-btn').textContent = 'Speed: 1x';
};

// ==================== INIT ====================
buildMap();
updateUI();
requestAnimationFrame(gameLoop);

})();
