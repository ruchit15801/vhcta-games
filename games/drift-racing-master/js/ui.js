class UIManager {
    constructor(game) {
        this.game = game;
        
        // Screens
        this.screens = {
            menu: document.getElementById('menu-screen'),
            instruction: document.getElementById('instruction-screen'),
            garage: document.getElementById('garage-screen'),
            track: document.getElementById('track-screen'),
            game: document.getElementById('game-container'),
            result: document.getElementById('result-screen'),
            loader: document.getElementById('loader'),
            leaderboard: document.getElementById('leaderboard-screen'),
            settings: document.getElementById('settings-screen')
        };
        
        // Bind Buttons
        document.getElementById('btn-start').addEventListener('click', () => this.showScreen('instruction'));
        document.getElementById('btn-play').addEventListener('click', () => {
            this.showScreen('track');
            this.game.audioSystem.startEngine();
        });
        
        document.getElementById('btn-garage').addEventListener('click', () => {
            this.updateGarageUI();
            this.showScreen('garage');
        });
        document.getElementById('btn-garage-back').addEventListener('click', () => this.showScreen('menu'));
        
        document.getElementById('btn-track-back').addEventListener('click', () => this.showScreen('menu'));
        
        // Leaderboard and Settings
        document.getElementById('btn-leaderboard').addEventListener('click', () => {
            this.updateLeaderboardUI();
            this.showScreen('leaderboard');
        });
        document.getElementById('btn-leader-back').addEventListener('click', () => this.showScreen('menu'));
        
        document.getElementById('btn-settings').addEventListener('click', () => this.showScreen('settings'));
        document.getElementById('btn-settings-back').addEventListener('click', () => this.showScreen('menu'));
        
        // Garage Logic
        this.garageCurrentCarIndex = 0;
        document.getElementById('btn-prev-car').addEventListener('click', () => {
            this.garageCurrentCarIndex = (this.garageCurrentCarIndex - 1 + CAR_CATALOG.length) % CAR_CATALOG.length;
            this.updateGarageUI();
        });
        document.getElementById('btn-next-car').addEventListener('click', () => {
            this.garageCurrentCarIndex = (this.garageCurrentCarIndex + 1) % CAR_CATALOG.length;
            this.updateGarageUI();
        });
        document.getElementById('btn-buy-car').addEventListener('click', () => this.buySelectedCar());
        
        // Settings Toggles
        document.getElementById('btn-toggle-bgm').addEventListener('click', (e) => this.toggleSetting('bgm', e.target));
        document.getElementById('btn-toggle-sfx').addEventListener('click', (e) => this.toggleSetting('sfx', e.target));
        document.getElementById('btn-reset-data').addEventListener('click', () => {
             if(confirm("Are you sure you want to reset all game progress?")) {
                 localStorage.removeItem('drift_racing_data');
                 location.reload();
             }
        });
        
        document.getElementById('btn-start-race').addEventListener('click', () => {
            this.showScreen('game');
            this.game.startRace();
        });
        
        document.getElementById('btn-restart').addEventListener('click', () => {
             this.showScreen('game');
             this.game.startRace();
        });
        
        document.getElementById('btn-menu').addEventListener('click', () => {
            this.showScreen('menu');
            this.game.stopRace();
        });
        
        document.getElementById('btn-ingame-menu').addEventListener('click', () => {
            this.game.stopRace();
            this.showScreen('menu');
        });

        // Track Selection
        document.querySelectorAll('.track-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (card.classList.contains('locked')) return;
                document.querySelectorAll('.track-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.game.selectedTrackType = card.dataset.track;
            });
        });

        // HUD Elements
        this.hudScore = document.getElementById('hud-score-val');
        this.hudTime = document.getElementById('hud-time');
        this.hudSpeed = document.getElementById('hud-speed');
        this.hudLap = document.getElementById('hud-lap');
        this.driftAlert = document.getElementById('drift-alert');
        this.driftPoints = document.getElementById('drift-points');
        this.driftCombo = document.getElementById('drift-combo');
        this.speedNeedle = document.getElementById('speed-needle');
        
        // Input Binding for mobile
        this.bindMobile();
    }

    syncWithSaveData() {
        const sd = this.game.saveData;
        if (!sd.settings.bgm) {
            let el = document.getElementById('btn-toggle-bgm');
            if (el) { el.innerText = 'OFF'; el.classList.add('off'); }
            this.game.audioSystem.bgmMuted = true;
        }
        if (!sd.settings.sfx) {
            let el = document.getElementById('btn-toggle-sfx');
            if (el) { el.innerText = 'OFF'; el.classList.add('off'); }
            this.game.audioSystem.sfxMuted = true;
        }
        
        this.garageCurrentCarIndex = CAR_CATALOG.findIndex(c => c.id === sd.selectedCar);
        if (this.garageCurrentCarIndex === -1) this.garageCurrentCarIndex = 0;
        this.updateGarageUI();
        
        // Track Unlock Logic Based on Points (High Scores)
        const maxPts = Math.max(sd.highScores.city || 0, sd.highScores.mountain || 0, sd.highScores.desert || 0);
        
        const desertCard = document.querySelector('.track-card[data-track="desert"]');
        if (desertCard) {
            if (maxPts >= 10000) {
                desertCard.classList.remove('locked');
                desertCard.querySelector('p').innerText = "UNLOCKED";
                desertCard.querySelector('p').style.color = "#00f3ff";
            } else {
                desertCard.classList.add('locked');
                desertCard.querySelector('p').innerText = `Requires 10,000 pts (Best: ${Math.floor(maxPts).toLocaleString()})`;
                desertCard.querySelector('p').style.color = "#ff5555";
            }
        }
    }
    
    updateLeaderboardUI() {
        const sd = this.game.saveData;
        document.getElementById('lb-city').innerText = Math.floor(sd.highScores.city || 0).toLocaleString();
        document.getElementById('lb-mountain').innerText = Math.floor(sd.highScores.mountain || 0).toLocaleString();
        document.getElementById('lb-desert').innerText = Math.floor(sd.highScores.desert || 0).toLocaleString();
    }
    
    updateGarageUI() {
        const sd = this.game.saveData;
        const car = CAR_CATALOG[this.garageCurrentCarIndex];
        
        document.getElementById('garage-coins').innerText = Math.floor(sd.coins).toLocaleString();
        document.getElementById('garage-car-name').innerText = car.name;
        document.getElementById('garage-car-name').style.color = car.color;
        
        document.getElementById('stat-speed').style.width = Math.min(100, (car.stats.maxSpeed / 20)) + '%';
        document.getElementById('stat-handling').style.width = Math.min(100, (car.stats.handling * 10)) + '%';
        document.getElementById('stat-drift').style.width = Math.min(100, (car.stats.driftControl * 35)) + '%';
        
        const btnBuy = document.getElementById('btn-buy-car');
        const msOwned = document.getElementById('car-owned-msg');
        
        if (sd.unlockedCars.includes(car.id)) {
            btnBuy.classList.add('hidden');
            msOwned.classList.remove('hidden');
            msOwned.innerText = "SELECTED";
            sd.selectedCar = car.id;
            DataLoader.save(sd);
        } else {
            btnBuy.classList.remove('hidden');
            msOwned.classList.add('hidden');
            document.getElementById('car-cost-disp').innerText = car.cost + ' 🪙';
            if (sd.coins >= car.cost) {
                btnBuy.style.opacity = '1.0';
                btnBuy.disabled = false;
            } else {
                btnBuy.style.opacity = '0.5';
                btnBuy.disabled = true;
            }
        }
    }
    
    buySelectedCar() {
        const sd = this.game.saveData;
        const car = CAR_CATALOG[this.garageCurrentCarIndex];
        if (!sd.unlockedCars.includes(car.id) && sd.coins >= car.cost) {
            sd.coins -= car.cost;
            sd.unlockedCars.push(car.id);
            sd.selectedCar = car.id;
            DataLoader.save(sd);
            this.updateGarageUI();
        }
    }
    
    toggleSetting(key, element) {
        const sd = this.game.saveData;
        sd.settings[key] = !sd.settings[key];
        DataLoader.save(sd);
        if (sd.settings[key]) {
            element.innerText = 'ON';
            element.classList.remove('off');
        } else {
            element.innerText = 'OFF';
            element.classList.add('off');
        }
        if (key === 'sfx') this.game.audioSystem.applyMuteState(sd.settings.sfx, sd.settings.bgm);
        if (key === 'bgm') this.game.audioSystem.applyMuteState(sd.settings.sfx, sd.settings.bgm);
    }

    showScreen(screenId) {
        Object.values(this.screens).forEach(s => s.classList.add('hidden'));
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        
        if (this.screens[screenId]) {
             this.screens[screenId].classList.remove('hidden');
             // small delay to trigger css transitions
             setTimeout(() => {
                 this.screens[screenId].classList.add('active');
             }, 10);
        }
        
        if (screenId === 'game') {
            document.getElementById('ui-background').style.display = 'none';
        } else {
            document.getElementById('ui-background').style.display = 'block';
        }
    }

    updateHUD(car, timeElapsed, lap, maxLaps) {
        const speedKPH = Math.abs(Math.sqrt(car.vx*car.vx + car.vy*car.vy) * 3.6).toFixed(0);
        this.hudSpeed.innerText = speedKPH;
        this.hudScore.innerText = Math.floor(car.score).toLocaleString();
        
        // Needle rotation: 0 to 220 kmh mapped to -135deg to +135deg
        let ratio = speedKPH / 220;
        if (ratio > 1) ratio = 1;
        const degrees = -135 + (ratio * 270);
        this.speedNeedle.style.transform = `rotate(${degrees}deg)`;
        
        // Time formatting
        const seconds = Math.floor(timeElapsed / 1000);
        const ms = Math.floor(timeElapsed % 1000);
        this.hudTime.innerText = `${String(Math.floor(seconds/60)).padStart(2, '0')}:${String(seconds%60).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
        
        this.hudLap.innerText = `LAP ${lap}/${maxLaps}`;

        // Drift Alerts
        if (car.isDrifting && speedKPH > 20) {
            this.driftAlert.classList.remove('hidden');
            this.driftPoints.innerText = `+${Math.floor(car.score)}`;
            if (car.combo > 1) {
                this.driftCombo.innerText = `COMBO x${car.combo}`;
                this.driftPoints.className = 'glow-text-crazy'; // Custom effect class if needed
            } else {
                this.driftCombo.innerText = '';
            }
        } else {
            this.driftAlert.classList.add('hidden');
        }
    }

    showResultScreen(stats) {
        this.showScreen('result');
        document.getElementById('r-pos').innerText = stats.position === 1 ? '1st' : '2nd';
        document.getElementById('r-score').innerText = Math.floor(stats.score).toLocaleString();
        document.getElementById('r-drift').innerText = Math.floor(stats.bestDriftScore || 0).toLocaleString();
        document.getElementById('r-coins').innerText = `+${Math.floor(stats.score / 100)} 🪙`;
    }

    bindMobile() {
        const addControl = (id, prop, val) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const start = (e) => { e.preventDefault(); this.game.player[prop] = val; };
            const stop = (e) => { e.preventDefault(); this.game.player[prop] = prop === 'input.steer' ? 0 : false; };
            
            btn.addEventListener('touchstart', start, {passive: false});
            btn.addEventListener('mousedown', start);
            btn.addEventListener('touchend', stop);
            btn.addEventListener('mouseup', stop);
        }

        // Steer is special
        const btnL = document.getElementById('btn-steer-left');
        const btnR = document.getElementById('btn-steer-right');
        
        if(btnL) {
            btnL.addEventListener('touchstart', (e) => { e.preventDefault(); this.game.playerCar.input.steer = -1; }, {passive: false});
            btnL.addEventListener('touchend', (e) => { e.preventDefault(); this.game.playerCar.input.steer = 0; });
        }
        if(btnR) {
            btnR.addEventListener('touchstart', (e) => { e.preventDefault(); this.game.playerCar.input.steer = 1; }, {passive: false});
            btnR.addEventListener('touchend', (e) => { e.preventDefault(); this.game.playerCar.input.steer = 0; });
        }
        
        const btnGas = document.getElementById('btn-accel');
        const btnBrake = document.getElementById('btn-brake');
        
        if(btnGas) {
            btnGas.addEventListener('touchstart', (e) => { e.preventDefault(); this.game.playerCar.input.gas = true; }, {passive: false});
            btnGas.addEventListener('touchend', (e) => { e.preventDefault(); this.game.playerCar.input.gas = false; });
        }
        
        if(btnBrake) {
            btnBrake.addEventListener('touchstart', (e) => { e.preventDefault(); this.game.playerCar.input.brake = true; this.game.playerCar.input.handbrake = true; }, {passive: false});
            btnBrake.addEventListener('touchend', (e) => { e.preventDefault(); this.game.playerCar.input.brake = false; this.game.playerCar.input.handbrake = false; });
        }
    }
}
