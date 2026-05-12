class GridSystem {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.gridSize = 10;
        this.scale = 1.0;
        this.baseTileWidth = 140;
        this.baseTileHeight = 70;
        this.tiles = [];
        
        this.offsetX = canvas.width / 2;
        this.offsetY = 150;
        this.targetOffsetX = this.offsetX;
        this.targetOffsetY = this.offsetY;
        
        this.initGrid();
        this.loadAssets();

    }


    initGrid() {
        for (let row = 0; row < this.gridSize; row++) {
            this.tiles[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                this.tiles[row][col] = {
                    type: 'grass', // grass, soil
                    crop: null,    // crop object
                    isUnlocked: (row < 4 && col < 4), // Start with 4x4
                    watered: false,
                    lastAction: Date.now()
                };
            }
        }
    }

    loadAssets() {
        this.images = {
            grass: new Image(),
            soil: new Image()
        };
        
        this.images.grass.src = 'assets/tile_grass.png';
        this.images.soil.src = 'assets/tile_soil.png';

    }

    // Removed processImageTransparency to avoid SecurityError



    // Convert grid (row, col) to Screen (x, y)
    gridToScreen(row, col) {
        const tw = this.baseTileWidth * this.scale;
        const th = this.baseTileHeight * this.scale;
        const x = (col - row) * (tw / 2) + this.offsetX;
        const y = (col + row) * (th / 2) + this.offsetY;
        return { x, y };
    }

    // Convert Screen (x, y) to Grid (row, col)
    screenToGrid(screenX, screenY) {
        const tw = this.baseTileWidth * this.scale;
        const th = this.baseTileHeight * this.scale;
        const x = (screenX - this.offsetX);
        const y = (screenY - this.offsetY);
        
        const col = (y / (th / 2) + x / (tw / 2)) / 2;
        const row = (y / (th / 2) - x / (tw / 2)) / 2;
        
        return { row: Math.round(row), col: Math.round(col) };
    }


    draw() {
        // Smooth camera movement
        this.offsetX += (this.targetOffsetX - this.offsetX) * 0.1;
        this.offsetY += (this.targetOffsetY - this.offsetY) * 0.1;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        
        // Draw in back-to-front order (top row to bottom row)
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const tile = this.tiles[row][col];
                if (!tile.isUnlocked) continue;

                const pos = this.gridToScreen(row, col);
                const img = tile.type === 'grass' ? this.images.grass : this.images.soil;
                
                if (img.complete) {
                    const tw = this.baseTileWidth * this.scale;
                    const th = this.baseTileHeight * this.scale;
                    
                    const drawW = tw * 1.1; // Slight bleed to ensure no gaps
                    const drawH = (img.height / img.width) * drawW;
                    
                    this.ctx.save();
                    
                    // --- Diamond clipping to hide white corners ---
                    this.ctx.beginPath();
                    this.ctx.moveTo(pos.x, pos.y - th / 2); // Top
                    this.ctx.lineTo(pos.x + tw / 2, pos.y); // Right
                    this.ctx.lineTo(pos.x, pos.y + th / 2); // Bottom
                    this.ctx.lineTo(pos.x - tw / 2, pos.y); // Left
                    this.ctx.closePath();
                    this.ctx.clip();
                    
                    if (!tile.isUnlocked) {
                        this.ctx.globalAlpha = 0.4;
                        this.ctx.filter = 'grayscale(100%) brightness(0.7)';
                    }
                    
                    this.ctx.drawImage(
                        img, 
                        pos.x - drawW / 2, 
                        pos.y - drawH + (th * 0.75), 
                        drawW, drawH
                    );
                    
                    this.ctx.restore();

                    if (!tile.isUnlocked) {
                        this.ctx.font = `bold ${Math.floor(24 * this.scale)}px Outfit`;
                        this.ctx.textAlign = 'center';
                        this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
                        this.ctx.fillText('🔒', pos.x, pos.y + 10);
                    }
                }




                // Draw Crop if any
                if (tile.crop) {
                    tile.crop.draw(this.ctx, pos.x, pos.y + (this.tileHeight / 4) * this.scale, this.scale);
                }
            }
        }
    }

    update() {
        // Handle rotation/day-night logic if needed
    }
}

window.GridSystem = GridSystem;
