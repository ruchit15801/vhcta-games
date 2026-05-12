class EconomySystem {
    constructor(gameState) {
        this.gameState = gameState;
    }

    canAfford(amount) {
        return this.gameState.coins >= amount;
    }

    buySeed(cropTypeKey) {
        const cost = CROP_TYPES[cropTypeKey].seedCost;
        if (this.canAfford(cost)) {
            this.gameState.coins -= cost;
            this.gameState.inventory[cropTypeKey] = (this.gameState.inventory[cropTypeKey] || 0) + 1;
            return true;
        }
        return false;
    }

    harvest(tile) {
        if (tile.crop && tile.crop.status === 'ready') {
            const yieldAmount = 1; // Simplified
            const profit = CROP_TYPES[tile.crop.typeKey].sellPrice;
            const xpGain = CROP_TYPES[tile.crop.typeKey].xp;

            this.gameState.coins += profit;
            this.gameState.xp += xpGain;
            
            const harvestedCropType = tile.crop.typeKey;
            tile.crop = null; // Remove from field
            
            this.checkLevelUp();
            return { coins: profit, xp: xpGain, type: harvestedCropType };
        }
        return null;
    }

    checkLevelUp() {
        const threshold = this.gameState.level * 100;
        if (this.gameState.xp >= threshold) {
            this.gameState.level++;
            // Could unlock stuff here
            return true;
        }
        return false;
    }

    expandLand() {
        const cost = this.gameState.level * 500;
        if (this.canAfford(cost)) {
            this.gameState.coins -= cost;
            // Unlocking logic would be in Game controller
            return true;
        }
        return false;
    }
}

window.EconomySystem = EconomySystem;
