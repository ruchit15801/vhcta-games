class UIController {
    constructor(game) {
        this.game = game;
        this.elements = {
            coins: document.getElementById('coin-count'),
            level: document.getElementById('level-num'),
            xpFill: document.getElementById('xp-fill'),
            shopModal: document.getElementById('shop-modal'),
            overlay: document.getElementById('modal-overlay'),
            shopItems: document.getElementById('shop-items'),
            taskBtn: document.getElementById('task-btn'),
            tutorial: document.getElementById('tutorial-overlay'),
            startBtn: document.getElementById('start-game-btn')
        };
        
        this.harvestCounts = {
            WHEAT: 0,
            CORN: 0,
            CARROT: 0
        };

        this.toolLevels = {
            WATERING_CAN: 1,
            TRACTOR: 1
        };



        this.init();
    }

    init() {
        // Modal closing
        this.elements.overlay.onclick = (e) => {
            if (e.target === this.elements.overlay) this.closeModal();
        };

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => this.closeModal();
        });

        // Action buttons
        document.getElementById('shop-btn').onclick = () => this.openShop();
        document.getElementById('inventory-btn').onclick = () => this.openCargo();
        document.getElementById('expand-btn').onclick = () => this.openExpansion();
        document.getElementById('upgrade-btn').onclick = () => this.openTools();
        
        this.elements.taskBtn.onclick = () => this.openMissions();

        this.elements.startBtn.onclick = () => {
            this.elements.tutorial.classList.add('hidden');
            this.game.start();
        };

    }

    updateHUD() {
        this.elements.coins.innerText = Math.floor(this.game.state.coins);
        this.elements.level.innerText = `LVL ${this.game.state.level}`;
        
        const threshold = this.game.state.level * 100;
        const progress = (this.game.state.xp / threshold) * 100;
        this.elements.xpFill.style.width = `${Math.min(100, progress)}%`;
    }

    openShop() {
        this.closeModal();
        this.updateShop();
        this.elements.overlay.classList.remove('hidden');
        this.elements.shopModal.classList.remove('hidden');
    }

    updateShop() {
        this.elements.shopItems.innerHTML = '';
        Object.keys(CROP_TYPES).forEach(key => {
            const crop = CROP_TYPES[key];
            const item = document.createElement('div');
            item.className = 'shop-item';
            item.innerHTML = `
                <div class="item-info">
                    <strong>${crop.name}</strong>
                    <div class="item-stats">Seed: ${crop.seedCost} | Profit: ${crop.sellPrice}</div>
                </div>
                <button class="buy-btn" ${this.game.state.coins < crop.seedCost ? 'disabled' : ''}>
                    BUY
                </button>
            `;
            
            item.querySelector('.buy-btn').onclick = () => {
                if (this.game.economy.buySeed(key)) {
                    this.game.selectedSeed = key;
                    this.closeModal();
                    this.showNotification(`Purchased ${crop.name} seeds!`, 'success');
                }
            };
            
            this.elements.shopItems.appendChild(item);
        });
    }

    openMissions() {
        this.closeModal();
        this.elements.overlay.classList.remove('hidden');
        let modal = this.getOrCreateModal('missions-modal', 'Farm Tasks');
        modal.innerHTML = `
            <div class="modal-header"><h2>Farm Tasks</h2><button class="close-modal">&times;</button></div>
            <div class="modal-content">
                <div class="mission-item">
                    <p>Harvest 5 Wheat (${this.harvestCounts.WHEAT}/5)</p>
                    <div class="progress-bar"><div class="fill" style="width: ${Math.min(100, (this.harvestCounts.WHEAT/5)*100)}%"></div></div>
                </div>
                <div class="mission-item">
                    <p>Harvest 3 Corn (${this.harvestCounts.CORN}/3)</p>
                    <div class="progress-bar"><div class="fill" style="width: ${Math.min(100, (this.harvestCounts.CORN/3)*100)}%"></div></div>
                </div>
            </div>
        `;
        modal.querySelector('.close-modal').onclick = () => this.closeModal();
    }


    openCargo() {
        this.closeModal();
        this.elements.overlay.classList.remove('hidden');
        let modal = this.getOrCreateModal('cargo-modal', 'Inventory / Cargo');
        
        const contents = Object.keys(this.game.state.inventory).map(key => {
            const count = this.game.state.inventory[key];
            if (count <= 0) return '';
            const price = CROP_TYPES[key].sellPrice;
            return `
                <div class="shop-item">
                    <div class="item-info">
                        <strong>${CROP_TYPES[key].name}</strong>
                        <p>Qty: ${count} | Value: ${count * price} Coins</p>
                    </div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-header"><h2>Inventory / Cargo</h2><button class="close-modal">&times;</button></div>
            <div class="modal-content">
                ${contents || '<p>Inventory is empty.</p>'}
                <button id="sell-all-btn" class="primary-btn" ${contents ? '' : 'disabled'}>SELL ALL HARVEST</button>
            </div>
        `;
        
        modal.querySelector('#sell-all-btn').onclick = () => {
            let totalProfit = 0;
            Object.keys(this.game.state.inventory).forEach(key => {
                totalProfit += this.game.state.inventory[key] * CROP_TYPES[key].sellPrice;
                this.game.state.inventory[key] = 0;
            });
            this.game.state.coins += totalProfit;
            this.showNotification(`Sold all items for ${totalProfit} coins!`, 'success');
            this.closeModal();
            this.game.saveGame();
        };
        modal.querySelector('.close-modal').onclick = () => this.closeModal();
    }

    openExpansion() {
        this.closeModal();
        this.elements.overlay.classList.remove('hidden');
        let modal = this.getOrCreateModal('expand-modal', 'Farm Expansion');
        
        const cost = this.game.state.unlockedTiles * 50;
        modal.innerHTML = `
            <div class="modal-header"><h2>Farm Expansion</h2><button class="close-modal">&times;</button></div>
            <div class="modal-content">
                <p>Expand your farm territory to plant more crops!</p>
                <div class="stats-box">
                    Current: ${this.game.state.unlockedTiles} Tiles<br>
                    Next Expansion: +4 Tiles
                </div>
                <button id="buy-expand-btn" class="primary-btn">EXPAND LAND (${cost} Coins)</button>
            </div>
        `;
        
        modal.querySelector('#buy-expand-btn').onclick = () => {
            if (this.game.state.coins >= cost) {
                this.game.state.coins -= cost;
                this.game.unlockBulkTiles(4);
                this.showNotification('Farm expanded!', 'success');
                this.closeModal();
                this.game.saveGame();
            } else {
                this.showNotification('Not enough coins!', 'error');
            }
        };
        modal.querySelector('.close-modal').onclick = () => this.closeModal();
    }

    openTools() {
        this.closeModal();
        this.elements.overlay.classList.remove('hidden');
        let modal = this.getOrCreateModal('tools-modal', 'Tool Upgrades');
        
        const waterCost = this.toolLevels.WATERING_CAN * 300;
        const tractorCost = this.toolLevels.TRACTOR * 500;

        modal.innerHTML = `
            <div class="modal-header"><h2>Tool Shed</h2><button class="close-modal">&times;</button></div>
            <div class="modal-content">
                <div class="shop-item">
                    <div class="item-info"><strong>Watering Can (LVL ${this.toolLevels.WATERING_CAN})</strong><p>Reduces growth time by 5%</p></div>
                    <button id="up-water-btn" class="buy-btn">UPGRADE (${waterCost})</button>
                </div>
                <div class="shop-item">
                    <div class="item-info"><strong>Tractor (LVL ${this.toolLevels.TRACTOR})</strong><p>Bonus XP on harvest</p></div>
                    <button id="up-tractor-btn" class="buy-btn">UPGRADE (${tractorCost})</button>
                </div>
            </div>
        `;
        
        modal.querySelector('#up-water-btn').onclick = () => {
            if (this.game.state.coins >= waterCost) {
                this.game.state.coins -= waterCost;
                this.toolLevels.WATERING_CAN++;
                this.showNotification('Watering Can upgraded!', 'success');
                this.openTools();
            }
        };
        modal.querySelector('.close-modal').onclick = () => this.closeModal();
    }

    getOrCreateModal(id, title) {
        let modal = document.getElementById(id);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = id;
            modal.className = 'modal';
            this.elements.overlay.appendChild(modal);
        }
        modal.classList.remove('hidden');
        return modal;
    }

    showLevelUp(level) {
        this.elements.overlay.classList.remove('hidden');
        const modal = this.getOrCreateModal('levelup-modal', 'LEVEL UP!');
        modal.innerHTML = `
            <div class="modal-content celebrate">
                <div class="celebrate-icon">🌟</div>
                <h1>LEVEL UP!</h1>
                <p>You reached level <strong>${level}</strong></p>
                <div class="reward">+100 Coins Bonus</div>
                <button onclick="window.gameEngine.ui.closeModal()" class="primary-btn">AWESOME!</button>
            </div>
        `;
        this.game.state.coins += 100;
        this.game.audio.playCoins();
    }

    closeModal() {
        this.elements.overlay.classList.add('hidden');
        const modals = document.querySelectorAll('.modal');
        modals.forEach(m => m.classList.add('hidden'));
    }



    showNotification(msg, type = 'info') {
        const n = document.createElement('div');
        n.className = `notification ${type}`;
        n.innerText = msg;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 2000);
    }

    floatingText(text, x, y, color = '#FFC107') {
        const el = document.createElement('div');
        el.className = 'floating-text';
        el.innerText = text;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.color = color;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }
}

window.UIController = UIController;
