const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const nextBtn = document.getElementById('nextBtn');
const levelDisplay = document.getElementById('levelDisplay');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let gameState = 'START';
let level = 1;
let animationId;

// Physics
let tiltX = 0;
let tiltY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// Colors
const COLOR_BALL = '#00f3ff';
const COLOR_WALL = '#2a0033';
const COLOR_WALL_TOP = '#ff00ea';
const COLOR_EXIT = '#00ff88';

// Maze Generator
class Maze {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.cellSize = Math.min(canvas.width / cols, canvas.height / rows) * 0.8;
        this.offsetX = (canvas.width - this.cols * this.cellSize) / 2;
        this.offsetY = (canvas.height - this.rows * this.cellSize) / 2;
        this.grid = [];
        this.walls = [];
        
        for (let r = 0; r < rows; r++) {
            let row = [];
            for (let c = 0; c < cols; c++) {
                row.push({
                    c: c, r: r,
                    visited: false,
                    top: true, right: true, bottom: true, left: true
                });
            }
            this.grid.push(row);
        }
        
        this.generate(0, 0);
        this.buildWalls();
    }
    
    generate(startC, startR) {
        let stack = [];
        let current = this.grid[startR][startC];
        current.visited = true;
        
        let unvisitedCount = this.rows * this.cols - 1;
        
        while (unvisitedCount > 0) {
            let neighbors = [];
            let r = current.r; let c = current.c;
            
            if (r > 0 && !this.grid[r-1][c].visited) neighbors.push({cell: this.grid[r-1][c], dir: 'top'});
            if (c < this.cols-1 && !this.grid[r][c+1].visited) neighbors.push({cell: this.grid[r][c+1], dir: 'right'});
            if (r < this.rows-1 && !this.grid[r+1][c].visited) neighbors.push({cell: this.grid[r+1][c], dir: 'bottom'});
            if (c > 0 && !this.grid[r][c-1].visited) neighbors.push({cell: this.grid[r][c-1], dir: 'left'});
            
            if (neighbors.length > 0) {
                let next = neighbors[Math.floor(Math.random() * neighbors.length)];
                stack.push(current);
                
                if (next.dir === 'top') { current.top = false; next.cell.bottom = false; }
                else if (next.dir === 'right') { current.right = false; next.cell.left = false; }
                else if (next.dir === 'bottom') { current.bottom = false; next.cell.top = false; }
                else if (next.dir === 'left') { current.left = false; next.cell.right = false; }
                
                current = next.cell;
                current.visited = true;
                unvisitedCount--;
            } else if (stack.length > 0) {
                current = stack.pop();
            } else {
                break;
            }
        }
    }
    
    buildWalls() {
        this.walls = [];
        const t = 4; // thickness
        const cs = this.cellSize;
        const ox = this.offsetX;
        const oy = this.offsetY;
        
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                const x = ox + c * cs;
                const y = oy + r * cs;
                
                if (cell.top) this.walls.push({x: x, y: y-t, w: cs, h: t*2});
                if (cell.right) this.walls.push({x: x+cs-t, y: y, w: t*2, h: cs});
                if (cell.bottom) this.walls.push({x: x, y: y+cs-t, w: cs, h: t*2});
                if (cell.left) this.walls.push({x: x-t, y: y, w: t*2, h: cs});
            }
        }
    }
    
    draw() {
        // Draw floor
        ctx.fillStyle = '#050505';
        ctx.fillRect(this.offsetX, this.offsetY, this.cols * this.cellSize, this.rows * this.cellSize);
        
        // Draw grid lines faintly
        ctx.strokeStyle = 'rgba(255, 0, 234, 0.05)';
        ctx.lineWidth = 1;
        for (let r = 0; r <= this.rows; r++) {
            ctx.beginPath(); ctx.moveTo(this.offsetX, this.offsetY + r*this.cellSize); ctx.lineTo(this.offsetX + this.cols*this.cellSize, this.offsetY + r*this.cellSize); ctx.stroke();
        }
        for (let c = 0; c <= this.cols; c++) {
            ctx.beginPath(); ctx.moveTo(this.offsetX + c*this.cellSize, this.offsetY); ctx.lineTo(this.offsetX + c*this.cellSize, this.offsetY + this.rows*this.cellSize); ctx.stroke();
        }
        
        // Draw 3D effect walls
        // Draw base shadow
        ctx.fillStyle = COLOR_WALL;
        this.walls.forEach(w => {
            ctx.fillRect(w.x + 5, w.y + 5, w.w, w.h);
        });
        
        // Draw Top glowing edge
        ctx.fillStyle = COLOR_WALL_TOP;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLOR_WALL_TOP;
        this.walls.forEach(w => {
            ctx.fillRect(w.x, w.y, w.w, w.h);
        });
        ctx.shadowBlur = 0;
        
        // Exit
        ctx.fillStyle = COLOR_EXIT;
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLOR_EXIT;
        const ex = this.offsetX + (this.cols - 1) * this.cellSize;
        const ey = this.offsetY + (this.rows - 1) * this.cellSize;
        ctx.fillRect(ex + this.cellSize*0.2, ey + this.cellSize*0.2, this.cellSize*0.6, this.cellSize*0.6);
        ctx.shadowBlur = 0;
    }
}

let maze;

const ball = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    radius: 0,
    
    reset() {
        this.radius = maze.cellSize * 0.3;
        this.x = maze.offsetX + maze.cellSize / 2;
        this.y = maze.offsetY + maze.cellSize / 2;
        this.vx = 0;
        this.vy = 0;
    },
    
    update() {
        // Apply tilt gravity
        this.vx += tiltX * 0.2;
        this.vy += tiltY * 0.2;
        
        // Friction
        this.vx *= 0.95;
        this.vy *= 0.95;
        
        // Predicted next position
        let nx = this.x + this.vx;
        let ny = this.y + this.vy;
        
        // Collision with walls (AABB vs Circle)
        for (let w of maze.walls) {
            // Find closest point on rect to circle center
            let cx = Math.max(w.x, Math.min(nx, w.x + w.w));
            let cy = Math.max(w.y, Math.min(ny, w.y + w.h));
            
            // Distance
            let dx = nx - cx;
            let dy = ny - cy;
            let dist = dx*dx + dy*dy;
            
            if (dist < this.radius * this.radius) {
                // Collision!
                // Simple resolution
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.vx *= -0.5; // bounce
                    nx = this.x; // cancel movement
                } else {
                    this.vy *= -0.5;
                    ny = this.y;
                }
            }
        }
        
        this.x = nx;
        this.y = ny;
        
        // Check Exit
        const ex = maze.offsetX + (maze.cols - 1) * maze.cellSize;
        const ey = maze.offsetY + (maze.rows - 1) * maze.cellSize;
        
        if (this.x > ex && this.x < ex + maze.cellSize && this.y > ey && this.y < ey + maze.cellSize) {
            levelComplete();
        }
    },
    
    draw() {
        ctx.save();
        ctx.fillStyle = COLOR_BALL;
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLOR_BALL;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();
        
        // Specular highlight
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(this.x - this.radius*0.3, this.y - this.radius*0.3, this.radius*0.2, 0, Math.PI*2);
        ctx.fill();
        
        ctx.restore();
    }
};

function gameLoop() {
    if (gameState !== 'PLAYING') return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    maze.draw();
    ball.update();
    ball.draw();
    
    // Draw visual tilt indicator if dragging
    if (isDragging) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dragStartX, dragStartY);
        ctx.lineTo(dragStartX + tiltX * 20, dragStartY + tiltY * 20);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(0, 243, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(dragStartX, dragStartY, 30, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

function levelComplete() {
    gameState = 'GAMEOVER';
    cancelAnimationFrame(animationId);
    gameOverScreen.classList.add('active');
}

function init() {
    let cols = 5 + level;
    let rows = 5 + level;
    // Cap size for performance and fit
    cols = Math.min(cols, 15);
    rows = Math.min(rows, 15);
    
    maze = new Maze(cols, rows);
    ball.reset();
    
    levelDisplay.textContent = `LEVEL: ${level}`;
    
    tiltX = 0;
    tiltY = 0;
    isDragging = false;
    
    gameState = 'PLAYING';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    cancelAnimationFrame(animationId);
    gameLoop();
}

// Controls
// Device Orientation
window.addEventListener('deviceorientation', (e) => {
    if (gameState !== 'PLAYING') return;
    // Beta is front-to-back tilt in degrees, where front is positive
    // Gamma is left-to-right tilt in degrees, where right is positive
    if (e.beta !== null && e.gamma !== null) {
        // limit values
        let b = Math.max(-45, Math.min(45, e.beta));
        let g = Math.max(-45, Math.min(45, e.gamma));
        
        tiltY = b / 20; // adjust sensitivity
        tiltX = g / 20;
    }
});

// Mouse/Touch Drag fallback
function handleDown(e) {
    if (e.target.tagName === 'BUTTON') return;
    if (gameState !== 'PLAYING') return;
    isDragging = true;
    let pos = e.touches ? e.touches[0] : e;
    dragStartX = pos.clientX;
    dragStartY = pos.clientY;
    tiltX = 0; tiltY = 0;
}

function handleMove(e) {
    if (!isDragging || gameState !== 'PLAYING') return;
    let pos = e.touches ? e.touches[0] : e;
    let dx = pos.clientX - dragStartX;
    let dy = pos.clientY - dragStartY;
    
    tiltX = Math.max(-2, Math.min(2, dx / 50));
    tiltY = Math.max(-2, Math.min(2, dy / 50));
}

function handleUp() {
    isDragging = false;
    tiltX = 0;
    tiltY = 0;
}

window.addEventListener('mousedown', handleDown);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleUp);
window.addEventListener('touchstart', (e) => { if (e.target.tagName !== 'BUTTON') e.preventDefault(); handleDown(e); }, {passive: false});
window.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e); }, {passive: false});
window.addEventListener('touchend', handleUp);

startBtn.addEventListener('click', init);
nextBtn.addEventListener('click', () => {
    level++;
    init();
});

// Initial draw bg
ctx.fillStyle = '#050505';
ctx.fillRect(0, 0, canvas.width, canvas.height);