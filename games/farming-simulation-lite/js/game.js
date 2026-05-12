class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        this.state = {
            coins: 500,
            xp: 0,
            level: 1,
            inventory: {},
            unlockedTiles: 16, // Default 4x4
            toolLevels: { WATERING_CAN: 1, TRACTOR: 1 },
            lastSave: Date.now()
        };




        // Systems
        this.grid = new GridSystem(this.canvas, this.ctx);
        this.economy = new EconomySystem(this.state);
        this.persistence = new PersistenceSystem();
        this.audio = new AudioController();
        this.ui = new UIController(this);

        
        this.selectedSeed = null;
        this.isStarted = false;

        // Listeners
        window.addEventListener('resize', () => this.resize());
        this.setupInput();
        
        // Load save
        this.loadGame();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        if (this.grid) {
            // Dynamic scale based on screen size
            const baseSize = Math.min(this.canvas.width, this.canvas.height);
            this.grid.scale = Math.max(0.6, baseSize / 1000); 
            
            this.grid.targetOffsetX = this.canvas.width / 2;
            this.grid.targetOffsetY = this.canvas.height / 2 - (this.grid.gridSize * this.grid.baseTileHeight * this.grid.scale) / 2;
        }
    }



    setupInput() {
        this.canvas.addEventListener('mousedown', (e) => this.handleTap(e.clientX, e.clientY));
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleTap(touch.clientX, touch.clientY);
        });
    }

    handleTap(x, y) {
        if (!this.isStarted) return;

        const gridPos = this.grid.screenToGrid(x, y);
        const row = gridPos.row;
        const col = gridPos.col;

        if (row >= 0 && row < this.grid.gridSize && col >= 0 && col < this.grid.gridSize) {
            const tile = this.grid.tiles[row][col];
            if (!tile.isUnlocked) {
                this.promptExpansion(row, col, x, y);
                return;
            }

            this.processTileAction(tile, x, y);
        }
    }

    promptExpansion(row, col, x, y) {
        const cost = this.state.level * 200;
        if (this.state.coins >= cost) {
            if (confirm(`Unlock this land for ${cost} coins?`)) {
                this.state.coins -= cost;
                this.grid.tiles[row][col].isUnlocked = true;
                this.state.unlockedTiles++;
                this.audio.playCoins();
                this.ui.floatingText('UNLOCKED!', x, y - 50, '#FFC107');
                this.saveGame();
            }
        } else {
            this.ui.showNotification(`Not enough coins! Need ${cost} coins.`);
        }
    }


    unlockBulkTiles(amount) {
        let unlocked = 0;
        for (let r = 0; r < this.grid.gridSize; r++) {
            for (let c = 0; c < this.grid.gridSize; c++) {
                if (!this.grid.tiles[r][c].isUnlocked && unlocked < amount) {
                    this.grid.tiles[r][c].isUnlocked = true;
                    unlocked++;
                    this.state.unlockedTiles++;
                }
            }
        }
        this.saveGame();
    }
    processTileAction(tile, x, y) {
        // Tile logic state machine
        if (tile.crop) {
            // If crop is ready, harvest it
            const result = this.economy.harvest(tile);
            if (result) {
                this.audio.playCoins();
                this.ui.harvestCounts[result.type]++;
                
                // Tractor Bonus
                const tractorBonus = (this.state.toolLevels.TRACTOR - 1) * 2;
                this.state.xp += tractorBonus;

                this.ui.floatingText(`+${result.coins} Coins`, x, y - 50, '#FFC107');
                this.ui.floatingText(`+${result.xp + tractorBonus} XP`, x, y - 80, '#4CAF50');
                
                this.checkLevelUp();
                this.saveGame();
            }
        } else if (tile.type === 'grass') {
            // Till grass to soil
            tile.type = 'soil';
            this.audio.playWater();
            this.ui.floatingText('Tilled!', x, y - 50, '#795548');

            this.saveGame();
        } else if (tile.type === 'soil' && !tile.crop) {
            // Plant seed if selected
            if (this.selectedSeed) {
                tile.crop = new Crop(this.selectedSeed);
                this.audio.playPop();
                this.selectedSeed = null; // Clear selection after planting

                this.ui.floatingText('Planted!', x, y - 50, '#8BC34A');
                this.saveGame();
            } else {
                this.ui.showNotification('Select seeds from Shop first!');
            }
        }
    }

    start() {
        this.isStarted = true;
        this.loop();
    }

    checkLevelUp() {
        const threshold = this.state.level * 100;
        if (this.state.xp >= threshold) {
            this.state.level++;
            this.state.xp -= threshold;
            this.ui.showLevelUp(this.state.level);
            this.saveGame();
        }
    }
    loop() {
        // Update
        for (let r = 0; r < this.grid.gridSize; r++) {
            for (let c = 0; c < this.grid.gridSize; c++) {
                const tile = this.grid.tiles[r][c];
                if (tile.crop) tile.crop.update();
            }
        }
        
        // Render
        this.grid.draw();
        this.ui.updateHUD();

        requestAnimationFrame(() => this.loop());
    }

    saveGame() {
        this.persistence.save(this.state, this.grid);
    }


    loadGame() {
        const saved = this.persistence.load();
        if (saved) {
            this.state.coins = saved.coins;
            this.state.xp = saved.xp;
            this.state.level = saved.level;
            
            // Reconstruct grid
            if (saved.grid) {
                saved.grid.forEach((row, r) => {
                    row.forEach((tileData, c) => {
                        if (this.grid.tiles[r] && this.grid.tiles[r][c]) {
                            const tile = this.grid.tiles[r][c];
                            tile.type = tileData.type;
                            tile.isUnlocked = tileData.isUnlocked;
                            if (tileData.crop) {
                                tile.crop = new Crop(tileData.crop.typeKey, tileData.crop.startTime);
                            }
                        }
                    });
                });
            }
        }
    }

}

// Global instance
window.onload = () => {
    window.gameEngine = new Game();
};
