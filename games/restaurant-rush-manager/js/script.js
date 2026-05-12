/**
 * Restaurant Rush - Jor Dar Premium Logic - Ultimate Smooth Polish
 */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let soundEnabled = true;

const sfx = {
    playTone: (freq, type, duration, vol=0.1) => {
        if(!soundEnabled) return;
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    },
    coin: () => {
        sfx.playTone(800, 'sine', 0.1, 0.2);
        setTimeout(() => sfx.playTone(1200, 'sine', 0.2, 0.2), 100);
    },
    cook: () => sfx.playTone(100, 'sawtooth', 0.5, 0.05),
    ready: () => sfx.playTone(600, 'triangle', 0.3, 0.1),
    burn: () => sfx.playTone(150, 'square', 0.5, 0.1),
    serve: () => sfx.playTone(400, 'sine', 0.2, 0.1),
    angry: () => {
        sfx.playTone(200, 'sawtooth', 0.2, 0.1);
        setTimeout(() => sfx.playTone(150, 'sawtooth', 0.4, 0.1), 200);
    },
    pop: () => sfx.playTone(500, 'sine', 0.1, 0.1)
};

const game = {
    level: 1, coins: 0, timeRemaining: 60, maxTime: 60,
    customersServed: 0, targetServed: 3, state: 'loading', lastTime: 0,
    
    stoves: [
        { id: 0, state: 'idle', progress: 0, el: null, pattyObj: null, timerObj: null },
        { id: 1, state: 'idle', progress: 0, el: null, pattyObj: null, timerObj: null },
        { id: 2, state: 'idle', progress: 0, el: null, pattyObj: null, timerObj: null }
    ],
    plates: [
        { id: 0, hasBurger: false, el: null, burgerObj: null },
        { id: 1, hasBurger: false, el: null, burgerObj: null },
        { id: 2, hasBurger: false, el: null, burgerObj: null }
    ],
    drinkMachine: { state: 'idle', progress: 0, locked: false },
    customers: [], spawnTimer: 0, upgrades: { stoveSpeed: 1 },

    init() { this.cacheDOM(); requestAnimationFrame(ts => this.loop(ts)); },

    cacheDOM() {
        this.ui = {
            lvl: document.getElementById('ui-level'), coins: document.getElementById('ui-coins'),
            timer: document.getElementById('ui-timer'), custArea: document.getElementById('customers-area'),
            modalStart: document.getElementById('screen-loading'), modalWin: document.getElementById('screen-level-complete'),
            modalLose: document.getElementById('screen-game-over'), drinkMachine: document.getElementById('drink-0'),
            drinkTank: document.getElementById('drink-liquid-0'), drinkCup: document.getElementById('drink-cup-0'),
            drinkTimer: document.getElementById('timer-drink'), btnSound: document.getElementById('btn-sound')
        };
        for(let i=0; i<3; i++) {
            this.stoves[i].el = document.getElementById('stove-' + i);
            this.stoves[i].pattyObj = document.getElementById('patty-' + i);
            this.stoves[i].timerObj = document.getElementById('timer-' + i);
            this.plates[i].el = document.getElementById('plate-' + i);
            this.plates[i].burgerObj = document.getElementById('burger-' + i);
        }
    },

    toggleSound() { soundEnabled = !soundEnabled; this.ui.btnSound.innerText = soundEnabled ? '🔊' : '🔇'; },

    startGame() {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        this.ui.modalStart.classList.remove('active'); this.ui.modalWin.classList.remove('active'); this.ui.modalLose.classList.remove('active');
        this.state = 'playing';
        
        this.maxTime = 45 + (this.level * 5 > 45 ? 45 : this.level * 5);
        this.timeRemaining = this.maxTime; this.targetServed = 2 + this.level * 2;
        
        if(this.level < 3) {
            this.drinkMachine.locked = true; this.ui.drinkMachine.classList.add('locked');
        } else {
            this.drinkMachine.locked = false; this.ui.drinkMachine.classList.remove('locked');
        }

        this.customersServed = 0; this.customers.forEach(c => c.el.remove()); this.customers = [];
        this.ui.custArea.innerHTML = ''; this.spawnTimer = 500;
        
        this.drinkMachine.state = 'idle'; this.ui.drinkMachine.dataset.state = 'idle';
        this.ui.drinkTank.style.height = '0%'; this.ui.drinkCup.classList.add('hidden');
        
        this.stoves.forEach(s => {
            s.state = 'idle'; s.progress = 0; s.pattyObj.classList.add('hidden'); s.pattyObj.dataset.state = 'raw';
            s.timerObj.style.width = '0%'; s.el.dataset.state = 'idle';
        });
        
        this.plates.forEach(p => { p.hasBurger = false; p.burgerObj.classList.add('hidden'); });

        this.ui.lvl.innerText = this.level; this.updateCoins();
    },

    takeMeat() {
        if(this.state !== 'playing') return;
        const emptyStove = this.stoves.find(s => s.state === 'idle');
        if(emptyStove) {
            emptyStove.state = 'cooking'; emptyStove.progress = 0;
            emptyStove.pattyObj.classList.remove('hidden'); emptyStove.pattyObj.dataset.state = 'cooking';
            emptyStove.el.dataset.state = 'cooking'; sfx.cook();
            
            // bounce animation on click
            document.querySelector('.meat-box').classList.add('bounce-fx');
            setTimeout(() => document.querySelector('.meat-box').classList.remove('bounce-fx'), 200);
        }
    },

    clickStove(id) {
        if(this.state !== 'playing') return;
        const s = this.stoves[id];
        if(s.state === 'ready') {
            const emptyPlate = this.plates.find(p => !p.hasBurger);
            if(emptyPlate) {
                s.state = 'idle'; s.progress = 0; s.pattyObj.classList.add('hidden');
                s.timerObj.style.width = '0%'; s.el.dataset.state = 'idle';
                emptyPlate.hasBurger = true; emptyPlate.burgerObj.classList.remove('hidden');
                sfx.pop();
            }
        } else if(s.state === 'burnt') {
            s.state = 'idle'; s.progress = 0; s.pattyObj.classList.add('hidden');
            s.timerObj.style.width = '0%'; s.el.dataset.state = 'idle'; sfx.burn();
        }
    },

    flyItemToCustomer(emoji, originEl, targetEl, onComplete) {
        const start = originEl.getBoundingClientRect();
        const fly = document.createElement('div');
        fly.className = 'smooth-fly';
        fly.innerText = emoji;
        fly.style.left = start.left + (start.width/2) - 25 + 'px';
        fly.style.top = start.top + (start.height/2) - 25 + 'px';
        document.body.appendChild(fly);
        
        // Force reflow
        fly.getBoundingClientRect();
        
        const end = targetEl.getBoundingClientRect();
        fly.style.left = end.left + (end.width/2) - 25 + 'px';
        fly.style.top = end.top + (end.height/2) - 25 + 'px';
        fly.style.transform = 'scale(0) rotate(360deg)';
        fly.style.opacity = '0';
        
        sfx.serve();
        
        setTimeout(() => {
            fly.remove();
            if(onComplete) onComplete();
        }, 400);
    },

    clickPlate(id) {
        if(this.state !== 'playing') return;
        const p = this.plates[id];
        if(p.hasBurger) {
            const cIndex = this.customers.findIndex(c => c.want === 'burger');
            if(cIndex !== -1) {
                const c = this.customers[cIndex];
                p.hasBurger = false; p.burgerObj.classList.add('hidden');
                
                this.flyItemToCustomer('🍔', p.el, c.el.querySelector('.order-bubble'), () => {
                    this.serveCustomer(cIndex, c.el, 15);
                });
            }
        }
    },

    clickDrink() {
        if(this.state !== 'playing' || this.drinkMachine.locked) return;
        if(this.drinkMachine.state === 'idle' || this.ui.drinkMachine.dataset.state === 'idle') {
            this.drinkMachine.state = 'filling'; this.ui.drinkMachine.dataset.state = 'filling';
            this.drinkMachine.progress = 0; this.ui.drinkTank.style.height = '100%';
            this.ui.drinkCup.classList.add('hidden'); sfx.cook();
            
            this.ui.drinkMachine.classList.add('bounce-fx');
            setTimeout(() => this.ui.drinkMachine.classList.remove('bounce-fx'), 200);
            
        } else if(this.drinkMachine.state === 'ready') {
            const cIndex = this.customers.findIndex(c => c.want === 'drink');
            if(cIndex !== -1) {
                const c = this.customers[cIndex];
                this.drinkMachine.state = 'idle'; this.ui.drinkMachine.dataset.state = 'idle';
                this.ui.drinkTank.style.height = '0%'; this.ui.drinkCup.classList.add('hidden');
                
                this.flyItemToCustomer('🥤', this.ui.drinkCup, c.el.querySelector('.order-bubble'), () => {
                    this.serveCustomer(cIndex, c.el, 10);
                });
            }
        }
    },

    spawnCustomer() {
        if(this.customers.length >= 4) return;
        let want = 'burger';
        if(!this.drinkMachine.locked && Math.random() > 0.6) want = 'drink';
        const types = ['normal', 'vip', 'angry', 'normal'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        let pBase = type === 'angry' ? 12 : 25;
        let patience = Math.max(8, pBase - (this.level * 0.5));
        const c = { id: 'c_' + Date.now(), want: want, type: type, patience: patience, maxPatience: patience, el: null };
        
        const div = document.createElement('div'); div.className = 'customer'; div.id = c.id; div.dataset.type = type;
        const bubble = document.createElement('div'); bubble.className = 'order-bubble';
        bubble.innerHTML = `<div class="order-ico">${want === 'burger' ? '🍔' : '🥤'}</div>
                            <div class="p-bar"><div class="p-fill" id="pbar-${c.id}"></div></div>`;
                            
        div.appendChild(bubble); this.ui.custArea.appendChild(div); c.el = div;
        this.customers.push(c);
        sfx.pop();
    },

    serveCustomer(cIndex, originEl, basePayout) {
        const c = this.customers[cIndex];
        let payout = basePayout;
        if(c.type === 'vip') payout *= 2;
        if(c.patience > c.maxPatience * 0.5) payout += 5;
        
        this.coins += payout; this.updateCoins(); this.customersServed++;
        sfx.coin(); this.spawnFX(originEl, '+'+payout);
        this.spawnCoinBurst(originEl);
        
        // Satisfied customer animation
        c.el.style.transform = 'scale(0) translateY(-100px)';
        c.el.style.opacity = '0';
        c.el.style.transition = 'all 0.3s';
        
        setTimeout(() => {
            c.el.remove(); 
            const idx = this.customers.indexOf(c);
            if(idx > -1) this.customers.splice(idx, 1);
        }, 300);
    },

    spawnFX(origin, text) {
        const rect = origin.getBoundingClientRect();
        const fx = document.createElement('div');
        fx.className = 'fx-element'; fx.innerText = text;
        fx.style.left = (rect.left + rect.width/2 - 20) + 'px'; fx.style.top = rect.top + 'px';
        document.body.appendChild(fx); setTimeout(() => fx.remove(), 1000);
    },

    spawnCoinBurst(origin) {
        const rect = origin.getBoundingClientRect();
        for(let i=0; i<6; i++) {
            const coin = document.createElement('div');
            coin.className = 'coin-particle'; coin.innerText = '🪙';
            coin.style.left = (rect.left + rect.width/2) + 'px';
            coin.style.top = (rect.top + rect.height/2) + 'px';
            coin.style.setProperty('--tx', (Math.random() * 200 - 100) + 'px');
            document.body.appendChild(coin);
            setTimeout(() => coin.remove(), 800);
        }
    },

    updateCoins() { 
        this.ui.coins.innerText = this.coins; 
        this.ui.coins.parentElement.classList.add('bounce-fx');
        setTimeout(() => this.ui.coins.parentElement.classList.remove('bounce-fx'), 200);
    },

    buyUpgrade() {
        const cost = 100 * this.upgrades.stoveSpeed;
        if(this.coins >= cost) {
            this.coins -= cost; this.upgrades.stoveSpeed += 0.5; this.updateCoins();
            document.getElementById('upg-cost').innerText = 100 * this.upgrades.stoveSpeed;
            sfx.coin();
        } else {
            sfx.burn(); // error sound
        }
    },

    nextLevel() { this.level++; this.startGame(); },
    restartLevel() { this.startGame(); },

    loop(ts) {
        if(!this.lastTime) this.lastTime = ts;
        let dt = ts - this.lastTime; this.lastTime = ts;

        if(this.state === 'playing') {
            this.timeRemaining -= dt / 1000;
            const pct = Math.max(0, (this.timeRemaining / this.maxTime) * 100);
            this.ui.timer.style.width = pct + '%';
            
            if(this.timeRemaining <= 0) {
                this.state = this.customersServed >= this.targetServed ? 'win' : 'lose';
                if(this.state === 'win') {
                    this.ui.modalWin.classList.add('active'); sfx.ready(); sfx.coin();
                    document.getElementById('end-lvl').innerText = this.level;
                    const bonus = (this.customersServed - this.targetServed)*10;
                    this.coins += bonus; this.updateCoins();
                    document.getElementById('end-earned').innerText = bonus;
                } else {
                    sfx.angry(); this.ui.modalLose.classList.add('active');
                }
            }

            const cookT = 3000 / this.upgrades.stoveSpeed; const burnT = 4000;
            
            this.stoves.forEach(s => {
                if(s.state === 'cooking') {
                    s.progress += dt;
                    const rPct = Math.min(100, (s.progress / cookT)*100);
                    s.timerObj.style.width = rPct + '%';
                    if(s.progress >= cookT) {
                        s.state = 'ready'; s.progress = 0; s.pattyObj.dataset.state = 'ready';
                        s.el.dataset.state = 'ready'; sfx.ready();
                    }
                } else if(s.state === 'ready') {
                    s.progress += dt;
                    const rPct = Math.min(100, (1 - (s.progress / burnT))*100);
                    s.timerObj.style.width = rPct + '%';
                    if(s.progress >= burnT) {
                        s.state = 'burnt'; s.progress = 0; s.pattyObj.dataset.state = 'burnt';
                        s.el.dataset.state = 'burnt'; sfx.burn();
                    }
                }
            });

            if(!this.drinkMachine.locked && this.drinkMachine.state === 'filling') {
                this.drinkMachine.progress += dt;
                const rPct = Math.min(100, (this.drinkMachine.progress / 2000)*100);
                this.ui.drinkTimer.style.width = rPct + '%';
                if(this.drinkMachine.progress >= 2000) {
                    this.drinkMachine.state = 'ready'; this.ui.drinkMachine.dataset.state = 'ready';
                    this.ui.drinkCup.classList.remove('hidden'); sfx.ready();
                }
            }

            this.spawnTimer -= dt;
            if(this.spawnTimer <= 0) {
                this.spawnCustomer();
                let minRate = 800; let cRate = 3000 - (this.level * 200);
                this.spawnTimer = Math.max(minRate, cRate);
            }

            for(let i=this.customers.length-1; i>=0; i--) {
                const c = this.customers[i];
                c.patience -= dt/1000;
                
                const bar = document.getElementById('pbar-'+c.id);
                if(bar) {
                    const pPct = (c.patience/c.maxPatience)*100;
                    bar.style.width = Math.max(0, pPct) + '%';
                    if(pPct < 30) bar.style.background = '#FF0044';
                    else if (pPct < 60) bar.style.background = '#ffaa00';
                }
                
                if(c.patience <= 0) {
                    c.el.remove(); this.customers.splice(i, 1); sfx.angry();
                }
            }
        }
        requestAnimationFrame((t) => this.loop(t));
    }
};

window.onload = () => game.init();
