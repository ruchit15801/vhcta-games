// Fashion Designer Studio - Main Game Logic

class GameState {
    constructor() {
        this.level = 1;
        this.coins = 500;
        this.unlockedItems = WARDROBE.filter(i => i.price === 0).map(i => i.id);
        this.activeChallenge = null;
        this.loadProgress();
    }
    
    loadProgress() {
        const saved = localStorage.getItem('fashion_studio_save');
        if (saved) {
            const data = JSON.parse(saved);
            this.level = data.level || 1;
            this.coins = data.coins || 0;
            this.unlockedItems = data.unlockedItems || this.unlockedItems;
            
            // Unlock levels based on saved progress
            LEVELS.forEach(lvl => {
                if (lvl.id <= this.level) {
                    lvl.unlocked = true;
                }
            });
        }
    }
    
    saveProgress() {
        localStorage.setItem('fashion_studio_save', JSON.stringify({
            level: this.level,
            coins: this.coins,
            unlockedItems: this.unlockedItems
        }));
    }
    
    addCoins(amount) {
        this.coins += amount;
        this.saveProgress();
    }
    
    unlockLevel() {
        this.level++;
        if (LEVELS[this.level - 1]) {
            LEVELS[this.level - 1].unlocked = true;
        }
        this.saveProgress();
    }
}

class GameManager {
    constructor() {
        this.state = new GameState();
        this.engine = new StylingEngine('model-canvas');
        this.audio = window.AudioManager ? new AudioManager() : null;
        
        this.currentCategory = 'dresses';
        
        this.initUI();
        this.bindEvents();
        
        // Show tutorial if first time, else main menu
        if (this.state.level === 1 && !localStorage.getItem('fashion_studio_save')) {
            this.showScreen('tutorial-screen');
        } else {
            this.showScreen('main-menu');
        }
        
        this.updateTopBar();
    }
    
    initUI() {
        // Setup Category Tabs
        const tabsContainer = document.getElementById('category-tabs');
        tabsContainer.innerHTML = '';
        CATEGORIES.forEach((cat, index) => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
            btn.dataset.category = cat.id;
            btn.innerText = cat.name;
            btn.onclick = () => this.switchCategory(cat.id, btn);
            tabsContainer.appendChild(btn);
        });
        
        this.populateItemsGrid();
        this.updateChallengeCard();
    }
    
    bindEvents() {
        document.getElementById('btn-start').onclick = () => {
            this.playSound('click');
            this.showScreen('main-menu');
        };
        
        document.getElementById('btn-enter-challenge').onclick = () => {
            this.playSound('click');
            this.state.activeChallenge = LEVELS.find(l => l.id === this.state.level) || LEVELS[0];
            this.setupChallengeStudio();
            this.showScreen('studio-screen');
        };
        
        document.getElementById('btn-back-menu').onclick = () => {
            this.playSound('click');
            this.showScreen('main-menu');
        };
        
        document.getElementById('btn-submit-look').onclick = () => {
            this.playSound('success');
            this.evaluateLook();
        };
        
        document.getElementById('btn-continue').onclick = () => {
            this.playSound('click');
            this.showScreen('main-menu');
        };
    }
    
    playSound(type) {
        if (this.audio) this.audio.play(type);
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }
    
    updateTopBar() {
        document.getElementById('player-level').innerText = this.state.level;
        document.getElementById('player-coins').innerText = this.state.coins;
    }
    
    updateChallengeCard() {
        const lvl = LEVELS.find(l => l.id === this.state.level) || LEVELS[LEVELS.length - 1];
        document.getElementById('current-challenge-title').innerText = `Level ${lvl.id}: ${lvl.title}`;
        document.getElementById('current-challenge-desc').innerText = lvl.desc;
        
        const tagsContainer = document.getElementById('current-challenge-tags');
        tagsContainer.innerHTML = '';
        lvl.requiredTags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.innerText = tag.charAt(0).toUpperCase() + tag.slice(1);
            tagsContainer.appendChild(span);
        });
    }
    
    switchCategory(categoryId, btnElement) {
        this.playSound('click');
        this.currentCategory = categoryId;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        this.populateItemsGrid();
    }
    
    populateItemsGrid() {
        const grid = document.getElementById('items-grid');
        grid.innerHTML = '';
        
        const items = WARDROBE.filter(i => i.category === this.currentCategory);
        
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            
            // Check if equipped
            const currentEquipped = this.engine.currentOutfit[this.currentCategory];
            if (currentEquipped && currentEquipped.id === item.id) {
                card.classList.add('equipped');
            }
            
            // Generate a simple SVG thumbnail for the item card
            // In a real app we'd have separate thumb images
            const thumb = new Image();
            thumb.className = 'item-thumb';
            thumb.src = SVGS[item.type];
            card.appendChild(thumb);
            
            card.onclick = () => {
                this.playSound('equip');
                if (card.classList.contains('equipped')) {
                    this.engine.unequipItem(this.currentCategory);
                    card.classList.remove('equipped');
                } else {
                    this.engine.equipItem(item);
                    this.populateItemsGrid(); // Re-render to update equipped states
                }
                this.updateTrendBar();
            };
            
            grid.appendChild(card);
        });
    }
    
    setupChallengeStudio() {
        const challenge = this.state.activeChallenge;
        document.querySelector('.challenge-brief h4').innerText = challenge.title;
        this.updateTrendBar();
        
        // Reset engine outfit for the challenge
        this.engine.currentOutfit = { dresses: null, tops: null, bottoms: null, shoes: null };
        this.populateItemsGrid();
    }
    
    updateTrendBar() {
        if (!this.state.activeChallenge) return;
        
        const requiredTags = this.state.activeChallenge.requiredTags;
        const currentTags = this.engine.getEquippedTags();
        
        let matchCount = 0;
        requiredTags.forEach(req => {
            if (currentTags.includes(req)) matchCount++;
        });
        
        let percentage = (matchCount / requiredTags.length) * 100;
        
        // Bonus for having more items
        const itemsCount = Object.values(this.engine.currentOutfit).filter(i => i !== null).length;
        if (itemsCount > 1) percentage += 10;
        if (itemsCount > 2) percentage += 10;
        
        percentage = Math.min(100, percentage);
        
        document.getElementById('trend-match-fill').style.width = `${percentage}%`;
        
        // Change color based on score
        if (percentage >= 80) {
            document.getElementById('trend-match-fill').style.background = '#2ecc71'; // Green
        } else if (percentage >= 40) {
            document.getElementById('trend-match-fill').style.background = '#f1c40f'; // Yellow
        } else {
            document.getElementById('trend-match-fill').style.background = 'var(--primary)';
        }
    }
    
    evaluateLook() {
        const challenge = this.state.activeChallenge;
        const requiredTags = challenge.requiredTags;
        const currentTags = this.engine.getEquippedTags();
        
        // Check if naked
        const itemsCount = Object.values(this.engine.currentOutfit).filter(i => i !== null).length;
        if (itemsCount === 0) {
            alert("You need to dress up the model first!");
            return;
        }
        
        let matchCount = 0;
        requiredTags.forEach(req => {
            if (currentTags.includes(req)) matchCount++;
        });
        
        let baseScore = (matchCount / requiredTags.length) * 5.0; // Max 5 from tags
        let itemBonus = itemsCount * 0.2; // Max 0.8 from items
        
        let finalScore = Math.min(5.8, baseScore + itemBonus).toFixed(1);
        
        // Setup Result Screen
        let stars = "⭐".repeat(Math.round(finalScore));
        if (stars === "") stars = "⭐";
        
        document.getElementById('result-stars').innerText = stars;
        document.getElementById('result-score').innerText = finalScore;
        
        const rewards = Math.floor(challenge.rewardCoins * (finalScore / 5));
        document.getElementById('reward-coins').innerText = rewards;
        
        this.state.addCoins(rewards);
        
        if (finalScore >= 3.0) {
            this.state.unlockLevel();
            document.getElementById('result-title').innerText = "Challenge Passed!";
        } else {
            document.getElementById('result-title').innerText = "Try Again!";
        }
        
        this.updateTopBar();
        this.updateChallengeCard();
        this.showScreen('result-screen');
    }
}

// Start Game when window loads
window.onload = () => {
    window.game = new GameManager();
};
