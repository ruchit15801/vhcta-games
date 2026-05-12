class PersistenceSystem {
    constructor(saveKey = 'farming_sim_lite_save') {
        this.saveKey = saveKey;
    }

    save(gameState, grid) {
        const data = {
            coins: gameState.coins,
            xp: gameState.xp,
            level: gameState.level,
            unlockedTiles: gameState.unlockedTiles,
            inventory: gameState.inventory,
            grid: grid.tiles.map(row => row.map(tile => ({
                type: tile.type,
                isUnlocked: tile.isUnlocked,
                crop: tile.crop ? {
                    typeKey: tile.crop.typeKey,
                    startTime: tile.crop.startTime
                } : null
            }))),
            lastSave: Date.now()
        };
        localStorage.setItem(this.saveKey, JSON.stringify(data));
    }


    load() {
        const saved = localStorage.getItem(this.saveKey);
        if (!saved) return null;
        return JSON.parse(saved);
    }

    calculateOfflineProgress(gameState, lastSaveTime) {
        const now = Date.now();
        const diff = now - lastSaveTime;
        
        // Growth happens automatically because crops are based on startTime
        // But we could add idle worker logic here
        return diff;
    }
}

window.PersistenceSystem = PersistenceSystem;
