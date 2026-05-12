// maze.js - Procedural Maze Generation and Rendering

class Maze {
    constructor(cols, rows, cellSize) {
        this.cols = cols;
        this.rows = rows;
        this.cellSize = cellSize;
        this.grid = [];
        this.walls = []; // Precomputed geometry for rendering/collisions
        this.exit = { x: cols - 1, y: rows - 1 };
    }

    generate() {
        // 1. Initialize Grid
        for (let y = 0; y < this.rows; y++) {
            let row = [];
            for (let x = 0; x < this.cols; x++) {
                row.push({
                    x, y,
                    visited: false,
                    top: true, right: true, bottom: true, left: true
                });
            }
            this.grid.push(row);
        }

        // 2. Recursive Backtracker
        let current = this.grid[0][0];
        current.visited = true;
        let stack = [];

        do {
            let next = this.getUnvisitedNeighbor(current);
            if (next) {
                stack.push(current);
                this.removeWalls(current, next);
                current = next;
                current.visited = true;
            } else if (stack.length > 0) {
                current = stack.pop();
            } else {
                break; // done
            }
        } while (true);

        // 3. Add loops (remove some random walls) to make it more like Pac-Man and less strictly a perfect maze
        let loopDensity = 0.15; // 15% chance to break a wall
        for (let y = 1; y < this.rows - 1; y++) {
            for (let x = 1; x < this.cols - 1; x++) {
                if (Math.random() < loopDensity) {
                    if (Math.random() < 0.5 && this.grid[y][x].right) {
                        this.removeWalls(this.grid[y][x], this.grid[y][x+1]);
                    } else if (this.grid[y][x].bottom) {
                        this.removeWalls(this.grid[y][x], this.grid[y+1][x]);
                    }
                }
            }
        }

        // Generate wall hitboxes
        this.buildWallHitboxes();
    }

    getUnvisitedNeighbor(cell) {
        let neighbors = [];
        let {x, y} = cell;

        let top = y > 0 ? this.grid[y - 1][x] : undefined;
        let right = x < this.cols - 1 ? this.grid[y][x + 1] : undefined;
        let bottom = y < this.rows - 1 ? this.grid[y + 1][x] : undefined;
        let left = x > 0 ? this.grid[y][x - 1] : undefined;

        if (top && !top.visited) neighbors.push(top);
        if (right && !right.visited) neighbors.push(right);
        if (bottom && !bottom.visited) neighbors.push(bottom);
        if (left && !left.visited) neighbors.push(left);

        if (neighbors.length > 0) {
            let r = Math.floor(Math.random() * neighbors.length);
            return neighbors[r];
        } else {
            return undefined;
        }
    }

    removeWalls(a, b) {
        let x = a.x - b.x;
        if (x === 1) {
            a.left = false;
            b.right = false;
        } else if (x === -1) {
            a.right = false;
            b.left = false;
        }
        let y = a.y - b.y;
        if (y === 1) {
            a.top = false;
            b.bottom = false;
        } else if (y === -1) {
            a.bottom = false;
            b.top = false;
        }
    }

    buildWallHitboxes() {
        this.walls = [];
        const cs = this.cellSize;
        const wThickness = 12; // Wall thickness

        // Add bounding box walls
        this.walls.push({ x: -wThickness, y: -wThickness, w: this.cols * cs + wThickness*2, h: wThickness }); // Top
        this.walls.push({ x: -wThickness, y: this.rows * cs, w: this.cols * cs + wThickness*2, h: wThickness }); // Bottom
        this.walls.push({ x: -wThickness, y: 0, w: wThickness, h: this.rows * cs }); // Left
        this.walls.push({ x: this.cols * cs, y: 0, w: wThickness, h: this.rows * cs }); // Right

        // We only need to check right and bottom walls of each cell to avoid duplicates
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                let cell = this.grid[y][x];
                
                // Right wall
                if (cell.right && x < this.cols - 1) {
                    this.walls.push({
                        x: (x + 1) * cs - wThickness / 2,
                        y: y * cs - wThickness / 2,
                        w: wThickness,
                        h: cs + wThickness
                    });
                }
                
                // Bottom wall
                if (cell.bottom && y < this.rows - 1) {
                    this.walls.push({
                        x: x * cs - wThickness / 2,
                        y: (y + 1) * cs - wThickness / 2,
                        w: cs + wThickness,
                        h: wThickness
                    });
                }
            }
        }
    }

    getBounds(x, y, radius) {
        // Return walls that could collide
        return this.walls; // For simplicity, return all, optimization: spatial hash
    }

    draw(ctx, camera) {
        ctx.save();
        
        // Premium 3D Neon Rendering
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f2fe';
        ctx.fillStyle = '#0f0c29';
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';

        // Draw Walls
        for (let w of this.walls) {
            let cx = w.x - camera.x;
            let cy = w.y - camera.y;
            
            // Only draw if visible
            if (cx + w.w < 0 || cx > engine.width || cy + w.h < 0 || cy > engine.height) continue;

            // Draw Base
            ctx.fillRect(cx, cy, w.w, w.h);
            ctx.strokeRect(cx, cy, w.w, w.h);
            
            // Draw 3D Depth Top Face (fake depth)
            ctx.fillStyle = 'rgba(0, 242, 254, 0.2)';
            ctx.fillRect(cx - 5, cy - 10, w.w, w.h);
            ctx.fillStyle = '#0f0c29';
        }

        // Draw Animated Exit Portal
        let ex = this.exit.x * this.cellSize - camera.x;
        let ey = this.exit.y * this.cellSize - camera.y;
        let cxEx = ex + this.cellSize/2;
        let cyEy = ey + this.cellSize/2;
        
        if (ex + this.cellSize > 0 && ex < engine.width && ey + this.cellSize > 0 && ey < engine.height) {
            ctx.save();
            ctx.translate(cxEx, cyEy);
            
            // Portal Vortex Rings
            let time = Date.now() * 0.003;
            ctx.shadowBlur = 20 + Math.sin(time * 2) * 10;
            ctx.shadowColor = '#00ff87';
            
            for (let i = 0; i < 3; i++) {
                ctx.save();
                ctx.rotate(time * (1 + i * 0.5));
                ctx.beginPath();
                ctx.ellipse(0, 0, this.cellSize * 0.35, this.cellSize * 0.15, 0, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 255, 135, ${0.8 - i*0.2})`;
                ctx.lineWidth = 4;
                ctx.stroke();
                ctx.restore();
            }
            
            // Glowing Core pulsing
            ctx.beginPath();
            ctx.arc(0, 0, this.cellSize * 0.15 + Math.sin(time*3) * 5, 0, Math.PI*2);
            ctx.fillStyle = '#00ff87';
            ctx.fill();
            
            // Emit particles occasionally
            if (Math.random() < 0.2) {
                engine.addParticle(
                    this.exit.x * this.cellSize + this.cellSize/2, 
                    this.exit.y * this.cellSize + this.cellSize/2, 
                    '#00ff87', 80, 2, 0.8
                );
            }
            
            ctx.restore();
        }

        ctx.restore();
    }
}
