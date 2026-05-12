class DataLoader {
    static load() {
        const defaultData = {
            coins: 1500, // start with some coins for demo
            unlockedCars: ['car_1'],
            selectedCar: 'car_1',
            settings: { bgm: true, sfx: true },
            highScores: { city: 0, mountain: 0, desert: 0 }
        };
        try {
            const data = localStorage.getItem('drift_racing_data');
            if (data) return { ...defaultData, ...JSON.parse(data), settings: { ...defaultData.settings, ...(JSON.parse(data).settings || {}) } };
        } catch (e) {}
        return defaultData;
    }
    
    static save(data) {
        localStorage.setItem('drift_racing_data', JSON.stringify(data));
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimize for no alpha background
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        this.lastTime = performance.now();
        this.audioSystem = new AudioSystem();
        this.ui = new UIManager(this);
        
        this.state = 'MENU'; // MENU, PLAYING, RESULT
        this.selectedTrackType = 'city';
        this.saveData = DataLoader.load();
        
        // Push initial UI sync based on saveData
        this.ui.syncWithSaveData();
        
        this.initInput();
        
        window.addEventListener('resize', this.resize.bind(this));
        
        // Attempt to pre-generate AI assets
        this.loadAssets();
    }
    
    loadAssets() {
        // Ensure UI assets are ready
        this.ui.showScreen('menu');
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    initInput() {
        this.keys = {};
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    startRace() {
        this.track = new Track(this.selectedTrackType);
        
        // Initialize Players
        const startPos = this.track.path[0];
        
        // Find selected car data
        const carData = CAR_CATALOG.find(c => c.id === this.saveData.selectedCar) || CAR_CATALOG[0];
        this.playerCar = new Car(startPos.x, startPos.y, false, carData);
        
        // AI Competitor slightly behind
        this.enemyCar = new Car(startPos.x - 50, startPos.y - 50, true);
        this.enemyCar.stats.maxSpeed *= 0.95; // Slightly slower for fairness
        this.aiController = new AIController(this.enemyCar, this.track);
        
        // Race Stats
        this.raceStartTime = performance.now();
        this.lap = 1;
        this.maxLaps = 3;
        this.currentCheckpoint = 0;
        
        this.camera = { x: startPos.x, y: startPos.y, zoom: 0.8 };
        
        this.state = 'PLAYING';
        this.lastTime = performance.now();
        
        // Stop UI bg
        document.getElementById('ui-background').style.display = 'none';

        if (!this.loopRunning) {
            this.loopRunning = true;
            requestAnimationFrame(this.gameLoop.bind(this));
        }
    }

    stopRace() {
        this.state = 'MENU';
        this.audioSystem.stopAll();
    }

    gameLoop(currentTime) {
        if (this.state !== 'PLAYING') {
            this.loopRunning = false;
            return;
        }
        
        requestAnimationFrame(this.gameLoop.bind(this));

        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05); // Cap delta time
        this.lastTime = currentTime;

        this.update(dt);
        this.draw();
    }

    update(dt) {
        // Handle input mapping to car
        this.playerCar.input.gas = this.keys['KeyW'] || this.keys['ArrowUp'];
        this.playerCar.input.brake = this.keys['KeyS'] || this.keys['ArrowDown'];
        this.playerCar.input.handbrake = this.keys['Space'];
        
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.playerCar.input.steer = -1;
        else if (this.keys['KeyD'] || this.keys['ArrowRight']) this.playerCar.input.steer = 1;
        else this.playerCar.input.steer = 0;

        // Physics Updates
        this.playerCar.update(dt, this.track);
        
        // AI Updates
        this.aiController.update();
        this.enemyCar.update(dt, this.track);

        // Audio
        let speedRatio = Math.sqrt(this.playerCar.vx**2 + this.playerCar.vy**2) / this.playerCar.stats.maxSpeed;
        this.audioSystem.updateEngine(speedRatio);
        
        if (this.playerCar.isDrifting) {
            this.audioSystem.startDrift();
        } else {
            this.audioSystem.stopDrift();
        }

        // Camera Follow (Smooth Damped)
        const targetCamX = this.playerCar.x + this.playerCar.vx * 0.5; // Look ahead
        const targetCamY = this.playerCar.y + this.playerCar.vy * 0.5;
        this.camera.x += (targetCamX - this.camera.x) * dt * 5;
        this.camera.y += (targetCamY - this.camera.y) * dt * 5;

        // Speed-based Zoom
        const targetZoom = 1.0 - speedRatio * 0.3; // Zoom out when fast
        this.camera.zoom += (targetZoom - this.camera.zoom) * dt * 2;

        // Checkpoints & Laps logic
        this.checkLapLogic();

        // UI Update
        this.ui.updateHUD(this.playerCar, performance.now() - this.raceStartTime, this.lap, this.maxLaps);
    }
    
    checkLapLogic() {
        // Simplified distance check for lap completion based on start position
        const dist = Math.hypot(this.playerCar.x - this.track.path[0].x, this.playerCar.y - this.track.path[0].y);
        if (dist > 500) {
            this.playerCar.leftStart = true;
        }
        
        if (this.playerCar.leftStart && dist < 200) {
            this.lap++;
            this.playerCar.leftStart = false;
            if (this.lap > this.maxLaps) {
                // RACE FINISH
                this.state = 'RESULT';
                this.audioSystem.stopAll();
                
                // Determine Position
                const pDist = Math.hypot(this.playerCar.x - this.track.path[this.track.path.length/2].x, this.playerCar.y - this.track.path[this.track.path.length/2].y);
                const aDist = Math.hypot(this.enemyCar.x - this.track.path[this.track.path.length/2].x, this.enemyCar.y - this.track.path[this.track.path.length/2].y);
                const pos = 1; // Simplify result logic
                
                // Record best drift, coins, and high score
                const earnedCoins = Math.floor(this.playerCar.score / 100);
                this.saveData.coins += earnedCoins;
                
                if (this.playerCar.score > this.saveData.highScores[this.selectedTrackType]) {
                    this.saveData.highScores[this.selectedTrackType] = Math.floor(this.playerCar.score);
                }
                
                DataLoader.save(this.saveData);
                
                this.ui.showResultScreen({
                    position: pos,
                    score: this.playerCar.score,
                    bestDriftScore: this.playerCar.score / 2,
                    coins: earnedCoins
                });
            }
        }
    }

    draw() {
        const ctx = this.ctx;
        
        ctx.save();
        
        // Center camera
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);

        // Draw track
        this.track.draw(ctx, this.camera);

        // Draw skidmarks
        this.playerCar.drawSkidmarks(ctx);
        this.enemyCar.drawSkidmarks(ctx);

        // Draw cars
        this.enemyCar.draw(ctx);
        this.playerCar.draw(ctx);

        ctx.restore();

        // Draw Minimap
        this.drawMinimap();
    }

    drawMinimap() {
        const mCtx = this.minimapCtx;
        mCtx.clearRect(0, 0, 120, 120);
        
        // Find bounds of track to scale
        const bounds = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
        this.track.path.forEach(p => {
            if(p.x < bounds.minX) bounds.minX = p.x;
            if(p.x > bounds.maxX) bounds.maxX = p.x;
            if(p.y < bounds.minY) bounds.minY = p.y;
            if(p.y > bounds.maxY) bounds.maxY = p.y;
        });
        
        const w = bounds.maxX - bounds.minX;
        const h = bounds.maxY - bounds.minY;
        const scale = 100 / Math.max(w, h);
        
        mCtx.save();
        mCtx.translate(60, 60); // center
        mCtx.scale(scale, scale);
        mCtx.translate(-(bounds.minX + w/2), -(bounds.minY + h/2));
        
        // Draw track layout
        mCtx.lineWidth = 150;
        mCtx.strokeStyle = 'rgba(255,255,255,0.4)';
        mCtx.lineJoin = 'round';
        mCtx.beginPath();
        mCtx.moveTo(this.track.path[0].x, this.track.path[0].y);
        for(let i=1; i<this.track.path.length; i++) mCtx.lineTo(this.track.path[i].x, this.track.path[i].y);
        mCtx.closePath();
        mCtx.stroke();
        
        // Draw Player
        mCtx.fillStyle = '#00f3ff';
        mCtx.beginPath(); mCtx.arc(this.playerCar.x, this.playerCar.y, 200, 0, Math.PI*2); mCtx.fill();
        
        // Draw Enemy
        mCtx.fillStyle = '#ff0055';
        mCtx.beginPath(); mCtx.arc(this.enemyCar.x, this.enemyCar.y, 200, 0, Math.PI*2); mCtx.fill();
        
        mCtx.restore();
    }
}

// Bootstrap
window.onload = () => {
    const game = new GameEngine();
};
