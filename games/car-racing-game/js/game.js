/**
 * NEON VELOCITY - Core Game Engine
 */

class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.isRunning = false;
        this.lastTime = 0;

        // Game State
        this.state = 'INIT';
        this.score = 0;
        this.distance = 0;
        this.level = 1;
        this.health = 100;
        this.nitro = 0;
        this.speed = 0;
        this.maxSpeed = 800; // Pixels per second
        this.targetSpeed = 0;
        this.acceleration = 300;

        // Entities
        this.player = null;
        this.traffic = [];
        this.powerups = [];
        this.particles = [];
        this.scenery = [];

        // Road props
        this.roadY = 0;
        this.laneWidth = 0;
        this.laneLeft = 0;
        this.numLanes = 3;

        // Input
        this.keys = {};
        this.isNitroActive = false;

        // Difficulty scaling
        this.spawnTimer = 0;
        this.spawnInterval = 1500; // ms
        this.shakeTime = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupInput();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Road proportions (Optimized for simulation)
        const isMobile = this.width < 768;
        const roadScale = isMobile ? 0.85 : 0.4;
        this.roadWidth = this.width * roadScale;
        this.laneLeft = (this.width - this.roadWidth) / 2;
        this.laneWidth = this.roadWidth / this.numLanes;

        if (this.player) {
            this.player.updateDimensions(this.laneWidth);
        }
    }

    setupInput() {
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'ShiftLeft' || e.code === 'Space') {
                this.deactivateNitro();
            }
        });

        // Touch events
        const touchLeft = document.getElementById('touch-left');
        const touchRight = document.getElementById('touch-right');
        const touchNitro = document.getElementById('touch-nitro');

        const setTouch = (btn, code, state) => {
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys[code] = true; });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); this.keys[code] = false; if (code === 'Space') this.deactivateNitro(); });
        };

        if (touchLeft) {
            setTouch(touchLeft, 'ArrowLeft', true);
            setTouch(touchRight, 'ArrowRight', true);
            setTouch(touchNitro, 'Space', true);
        }
    }

    init() {
        this.player = new PlayerCar(this);
        this.reset();
        this.state = 'READY';
    }

    reset() {
        this.score = 0;
        this.distance = 0;
        this.level = 1;
        this.health = 100;
        this.nitro = 0;
        this.speed = 0;
        this.traffic = [];
        this.powerups = [];
        this.particles = [];
        this.scenery = [];
        this.spawnInterval = 1500;
        this.player.reset();

        // HUD Update
        this.updateHUD();
    }

    start() {
        this.state = 'PLAYING';
        this.isRunning = true;
        this.lastTime = performance.now();
        AudioEngine.startEngine();
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(time) {
        if (!this.isRunning) return;

        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        if (this.state === 'PLAYING') {
            this.update(dt);
        }

        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Player speed logic
        this.handleSpeed(dt);

        // Update background road
        this.roadY = (this.roadY + this.speed * dt) % this.height;
        this.distance += (this.speed * dt) / 50;

        // Movement blur / Camera Shake
        if (this.speed > 600) {
            this.shakeTime = Math.min(0.5, (this.speed - 600) / 1000);
        } else {
            this.shakeTime *= 0.9;
        }

        // Spawning Real Scenery (Suburban Realism)
        if (Math.random() < 0.2) {
            this.spawnScenery();
        }

        // Update Player
        this.player.update(dt);

        // Spawning
        this.spawnTimer += dt * 1000;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTraffic();
            this.spawnTimer = 0;
        }

        // Update Traffic
        for (let i = this.traffic.length - 1; i >= 0; i--) {
            const car = this.traffic[i];
            car.update(dt, this.speed);

            // Offscreen removal
            if (car.y > this.height + 200) {
                this.traffic.splice(i, 1);
                this.score += 10; // Point for surviving traffic
                continue;
            }

            // Collision detection
            if (this.checkCollision(this.player, car)) {
                this.handleCollision(car);
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            if (this.particles[i].update(dt)) {
                this.particles.splice(i, 1);
            }
        }

        // Update Scenery
        for (let i = this.scenery.length - 1; i >= 0; i--) {
            this.scenery[i].y += this.speed * dt;
            if (this.scenery[i].y > this.height + 200) {
                this.scenery.splice(i, 1);
            }
        }

        // Nitro regen
        if (!this.isNitroActive && this.nitro < 100) {
            this.nitro += dt * 5;
        } else if (this.isNitroActive) {
            this.nitro -= dt * 30;
            if (this.nitro <= 0) {
                this.nitro = 0;
                this.deactivateNitro();
            }
        }

        // Level progression
        this.checkLevelProgression();

        // Audio update
        const speedPercent = this.speed / this.maxSpeed;
        AudioEngine.updateEngine(speedPercent);

        this.updateHUD();
    }

    handleSpeed(dt) {
        let baseMax = 600 + (this.level * 20);
        let target = baseMax;

        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            target = baseMax;
        } else if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            target = baseMax * 0.4;
        } else {
            target = baseMax * 0.7; // Cruise
        }

        if (this.isNitroActive) {
            target = this.maxSpeed;
        }

        if (this.speed < target) {
            this.speed += this.acceleration * dt;
        } else {
            this.speed -= this.acceleration * 0.5 * dt;
        }
    }

    activateNitro() {
        if (this.nitro > 10 && !this.isNitroActive) {
            this.isNitroActive = true;
            AudioEngine.playNitro(true);
            this.createNitroSparks();
        }
    }

    deactivateNitro() {
        if (this.isNitroActive) {
            this.isNitroActive = false;
            AudioEngine.playNitro(false);
        }
    }

    spawnTraffic() {
        const lane = Math.floor(Math.random() * this.numLanes);
        // Ensure not spawning on top of another car in that lane
        const tooClose = this.traffic.some(c => c.lane === lane && c.y < 200);
        if (tooClose) return;

        const type = Math.floor(Math.random() * 4); // 4 variations in sprite
        const speed = 200 + (Math.random() * 100) + (this.level * 10);
        this.traffic.push(new TrafficCar(this, lane, -200, type, speed));

        // Bonus: Lane switching enemies at level 8+
        if (this.level >= 8 && Math.random() < 0.3) {
            this.traffic[this.traffic.length - 1].canSwitchLanes = true;
        }
    }

    spawnScenery() {
        // High-Quality Suburban Realism (Houses + Professional landscaping)
        const side = Math.random() > 0.5 ? 1 : -1;
        const roadEdge = 200; // Buffer from road
        const xOffset = side === 1 ? (this.laneLeft + this.roadWidth + roadEdge) : (this.laneLeft - 400);
        
        // Variant: 0-1 (Houses), 2 (Elite Trees)
        const variant = Math.floor(Math.random() * 3);
        const scale = 1.5 + Math.random() * 1.5;
        this.scenery.push(new SceneryObject(xOffset + (Math.random() * 50), -500, variant, scale));
    }

    checkCollision(a, b) {
        // Simple AABB with padding for luxury feel (don't punish tiny overlaps)
        const pad = 10;
        return (
            a.x + pad < b.x + b.width - pad &&
            a.x + a.width - pad > b.x + pad &&
            a.y + pad < b.y + b.height - pad &&
            a.y + a.height - pad > b.y + pad
        );
    }

    handleCollision(car) {
        if (car.hit) return;
        car.hit = true;
        this.health -= 25;
        this.speed *= 0.5;
        this.shakeTime = 0.3;
        this.createExplosion(car.x + car.width / 2, car.y + car.height / 2);
        AudioEngine.playCrash();

        if (this.health <= 0) {
            this.gameOver();
        }
    }

    gameOver() {
        this.isRunning = false;
        this.state = 'GAMEOVER';
        AudioEngine.stopEngine();

        document.getElementById('final-dist').textContent = Math.floor(this.distance);
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('gameover-screen').classList.add('active');
        document.getElementById('hud').classList.add('hidden');
    }

    checkLevelProgression() {
        const distNeeded = this.level * 1000;
        if (this.distance >= distNeeded) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.state = 'LEVELUP';
        this.isRunning = false;

        const themes = ["HIGHWAY", "CITY NIGHT", "RAINY SUBURBS", "DESERT FOG", "NEON METROPOLIS"];
        const theme = themes[(this.level - 1) % themes.length];

        document.getElementById('level-summary').textContent = `New track unlocked: ${theme}`;
        document.getElementById('levelup-screen').classList.add('active');

        this.spawnInterval = Math.max(500, 1500 - (this.level * 50));
    }

    resumeFromLevelUp() {
        this.state = 'PLAYING';
        this.isRunning = true;
        this.lastTime = performance.now();
        document.getElementById('levelup-screen').classList.remove('active');
        requestAnimationFrame((t) => this.loop(t));
    }

    updateHUD() {
        const scoreEl = document.getElementById('score-val');
        if (scoreEl) scoreEl.textContent = String(this.score).padStart(5, '0');

        const levelEl = document.getElementById('level-val');
        if (levelEl) levelEl.textContent = this.level;

        const speedEl = document.getElementById('speed-val');
        if (speedEl) speedEl.textContent = Math.floor(this.speed / 4);

        const healthBar = document.getElementById('health-bar-fill');
        if (healthBar) {
            healthBar.style.width = this.health + '%';
            healthBar.style.background = this.health < 30 ? '#ff0000' : '#fff';
        }

        const nitroBar = document.getElementById('nitro-bar-fill');
        if (nitroBar) nitroBar.style.width = this.nitro + '%';

        // Vector Mode Indicator
        const vectorMsg = document.getElementById('vector-msg');
        const roadImg = Assets.images.road;
        if (vectorMsg) {
            if (roadImg && roadImg.width <= 1) {
                vectorMsg.classList.remove('hidden');
            } else {
                vectorMsg.classList.add('hidden');
            }
        }
    }

    draw() {
        // Motion Blur Effect: Semi-transparent clear
        if (this.speed > 500) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else {
            this.ctx.clearRect(0, 0, this.width, this.height);
        }

        // Screenshake for collision
        if (this.shakeTime > 0) {
            this.ctx.save();
            this.ctx.translate(Math.random() * 10 - 5, Math.random() * 10 - 5);
            this.shakeTime -= 0.016;
        }

        // Draw Road
        this.drawRoad();

        // Draw Scenery (Behind cars)
        this.scenery.forEach(s => s.draw(this.ctx));

        // Draw Shadows
        this.traffic.forEach(car => this.drawShadow(car));
        this.drawShadow(this.player);

        // Draw Traffic
        this.traffic.forEach(car => {
            car.draw(this.ctx);
            this.drawHeadlights(car);
        });

        // Draw Player
        this.player.draw(this.ctx);
        this.drawHeadlights(this.player);

        // Draw Particles
        this.particles.forEach(p => p.draw(this.ctx));

        if (this.shakeTime > 0) this.ctx.restore();

        // 6. Draw Rear View Mirror (Elite Sim Logic)
        this.drawMirror();

        // Post Processing (Vignette / Weather)
        this.drawEffects();
    }

    drawMirror() {
        const mirrorCanvas = document.getElementById('mirrorCanvas');
        if (!mirrorCanvas) return;
        const mctx = mirrorCanvas.getContext('2d');
        const mw = mirrorCanvas.width = 250;
        const mh = mirrorCanvas.height = 60;

        mctx.fillStyle = '#111';
        mctx.fillRect(0, 0, mw, mh);

        // Draw Mini-Road in Mirror
        const mRoadWidth = mw * 0.4;
        const mLaneLeft = (mw - mRoadWidth) / 2;
        const mLaneWidth = mRoadWidth / this.numLanes;

        mctx.fillStyle = '#222';
        mctx.fillRect(mLaneLeft, 0, mRoadWidth, mh);

        // Draw Traffic in Mirror (Inverted Y)
        this.traffic.forEach(car => {
            const relX = (car.x - this.laneLeft) / this.roadWidth;
            const mirrorX = mLaneLeft + (relX * mRoadWidth);
            const mirrorY = mh / 2 + (car.y - this.player.y) * 0.1;

            if (mirrorY > 0 && mirrorY < mh) {
                mctx.fillStyle = car.variant === 3 ? '#8e1a1a' : '#555';
                mctx.fillRect(mirrorX, mirrorY, 15, 20);
            }
        });

        // Mirror Glass Overlay
        mctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        mctx.fillRect(0, 0, mw, mh / 2);
    }

    drawRoad() {
        // WORLD-CLASS ENVIRONMENT RENDERER (ELIMINATES BLACK BARS)
        const roadImg = Assets.images.road;
        const terrainImg = Assets.images.scenery;

        // 1. Draw solid base to prevent flickering
        this.ctx.fillStyle = '#101510';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // 2. Tile side terrain (Forest/Grass) across full screen width
        if (terrainImg && terrainImg.width > 1) {
            const pattern = this.ctx.createPattern(terrainImg, 'repeat');
            this.ctx.save();
            this.ctx.translate(0, this.roadY % terrainImg.height);
            this.ctx.fillStyle = pattern;
            this.ctx.fillRect(0, -terrainImg.height, this.width, this.height + terrainImg.height * 2);
            this.ctx.restore();
        }

        // 3. Render Main Road (Calibrated for Pixel-Perfect Centering)
        if (roadImg && roadImg.width > 1) {
            this.ctx.save();
            const scrollY = (this.roadY % this.height) - this.height;
            this.ctx.translate(this.laneLeft, scrollY);
            
            // Draw Main Asphalt (High-Res Photorealistic Texture)
            this.ctx.drawImage(roadImg, 0, 0, this.roadWidth, this.height);
            this.ctx.drawImage(roadImg, 0, this.height, this.roadWidth, this.height);
            
            // Premium simulation curbs
            this.ctx.fillStyle = 'rgba(255,255,255,0.08)';
            this.ctx.fillRect(-20, 0, 20, this.height * 2);
            this.ctx.fillRect(this.roadWidth, 0, 20, this.height * 2);

            this.ctx.restore();
        } else {
            // High-End Vector Road Fallback
            this.ctx.fillStyle = '#111';
            this.ctx.fillRect(this.laneLeft, 0, this.roadWidth, this.height);

            this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            this.ctx.setLineDash([60, 60]);
            this.ctx.lineDashOffset = -this.roadY;
            this.ctx.lineWidth = 4;
            for (let i = 1; i < this.numLanes; i++) {
                const x = this.laneLeft + (i * this.laneWidth);
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.height);
                this.ctx.stroke();
            }
            this.ctx.setLineDash([]);
        }
    }


drawEffects() {
    // Speed Vignette
    if (this.isNitroActive) {
        const grad = this.ctx.createRadialGradient(this.width / 2, this.height / 2, 200, this.width / 2, this.height / 2, this.width);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, 'rgba(0, 242, 255, 0.2)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Rain / Night / Weather
    if (this.level >= 6 && this.level <= 12) {
        // Rainy Night
        this.ctx.fillStyle = 'rgba(0, 0, 50, 0.2)';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
}

createExplosion(x, y) {
    for (let i = 0; i < 20; i++) {
        this.particles.push(new Particle(x, y, '#ffaa00'));
    }
}

createNitroSparks() {
    if (!this.player) return;
    this.particles.push(new Particle(this.player.x + this.player.width / 2, this.player.y + this.player.height, '#fff'));
}

createHeatHaze() {
    if (this.speed > 500) {
        this.particles.push(new Particle(
            this.player.x + Math.random() * this.player.width,
            this.player.y + this.player.height,
            'rgba(255, 255, 255, 0.1)'
        ));
    }
}
}

/**
 * PLAYER CAR
 */
class PlayerCar {
    constructor(game) {
        this.game = game;
        this.lane = 1;
        this.width = 60;
        this.height = 120;
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.angle = 0;
        this.reset();
    }

    reset() {
        this.lane = 1;
        this.updateDimensions(this.game.laneWidth);
        this.x = this.game.laneLeft + (this.lane * this.game.laneWidth) + (this.game.laneWidth / 2) - (this.width / 2);
        this.targetX = this.x;
        this.y = this.game.height - 200;
    }

    updateDimensions(laneWidth) {
        this.width = Math.min(60, laneWidth * 0.7);
        this.height = this.width * 2;
    }

    update(dt) {
        // Continuous Steering Flow (Physics-Based)
        if (this.game.keys['ArrowLeft'] || this.game.keys['KeyA']) {
            this.targetX -= 1200 * dt;
        }
        if (this.game.keys['ArrowRight'] || this.game.keys['KeyD']) {
            this.targetX += 1200 * dt;
        }
        
        // Inertia-Based Smoothing (Simulation Grade)
        const laneX = this.game.laneLeft + (this.lane * this.game.laneWidth);
        const roadMin = this.game.laneLeft + 20;
        const roadMax = this.game.laneLeft + this.game.roadWidth - this.width - 20;
        this.targetX = Math.max(roadMin, Math.min(roadMax, this.targetX));

        const diff = this.targetX - this.x;
        this.momentum = (this.momentum || 0) + diff * 0.1;
        this.momentum *= 0.85; // Friction
        this.x += this.momentum * 10 * dt;
        
        // Realistic Suspension Lean (Angular Momentum)
        this.angle = this.momentum * 0.005;
        this.suspensionTilt = this.momentum * 0.02;
        
        // Nitro Input
        if (this.game.keys['ShiftLeft'] || this.game.keys['Space']) {
            this.game.activateNitro();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2 + (this.suspensionTilt || 0), this.y + this.height / 2);
        ctx.rotate(this.angle);

        // Photorealistic High-End Vehicle Sprite
        const img = Assets.images.player;
        if (img && img.width > 1) {
            ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            // Luxury Vector Fallback
            CarRenderer.draw(ctx, -this.width / 2, -this.height / 2, this.width, this.height, '#e0e0e0', 'sports');
        }

        // Executive Tail Light Glow
        if (this.game.keys['ArrowDown'] || this.game.keys['KeyS']) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#f00';
            ctx.fillStyle = '#f00';
            ctx.fillRect(-this.width / 2 + 5, this.height / 2 - 5, 10, 5);
            ctx.fillRect(this.width / 2 - 15, this.height / 2 - 5, 10, 5);
        }

        ctx.restore();
    }
}

/**
 * TRAFFIC CAR
 */
class TrafficCar {
    constructor(game, lane, y, variant, speed) {
        this.game = game;
        this.lane = lane;
        this.variant = variant;
        this.speed = speed;
        this.y = y;
        this.width = Math.min(60, game.laneWidth * 0.7);
        this.height = this.width * 2;
        this.x = game.laneLeft + (lane * game.laneWidth) + (game.laneWidth / 2) - (this.width / 2);
        this.hit = false;
        this.canSwitchLanes = false;
        this.switchTimer = 0;
    }

    update(dt, playerSpeed) {
        // Relative speed
        this.y += (playerSpeed - this.speed) * dt;

        // AI: Lane switching
        if (this.canSwitchLanes) {
            this.switchTimer += dt;
            if (this.switchTimer > 2) {
                const dir = Math.random() > 0.5 ? 1 : -1;
                const newLane = Math.max(0, Math.min(this.game.numLanes - 1, this.lane + dir));
                this.lane = newLane;
                this.switchTimer = 0;
            }
        }

        // Master-Grade Centering Logic
        const laneX = this.game.laneLeft + (this.lane * this.game.laneWidth);
        const targetX = laneX + (this.game.laneWidth / 2) - (this.width / 2);

        // Add subtle physics sway and tilt
        const moveSpeed = 5 * (0.5 + this.game.speed / 1000);
        this.x += (targetX - this.x) * moveSpeed * dt;
        this.tilt += ((targetX - this.x) * 0.15 - this.tilt) * 10 * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.tilt * 0.01);

        const colors = ['#3a4856', '#8e1a1a', '#1a563a', '#b08d1a'];
        const color = colors[this.variant % colors.length];
        const type = this.variant === 3 ? 'truck' : (this.variant === 2 ? 'suv' : 'sedan');

        CarRenderer.draw(ctx, -this.width / 2, -this.height / 2, this.width, this.height, color, type);

        ctx.restore();
    }
}

/**
 * ELITE CAR RENDERER (Pure Canvas Premium Logic)
 */
class CarRenderer {
    static draw(ctx, x, y, w, h, bodyColor, type) {
        ctx.save();
        ctx.translate(x, y);

        // 1. Premium Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.roundRect(10, 10, w, h, h * 0.1);
        ctx.fill();

        // 2. High-End Metallic Gradient (Ray-tracing style)
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, bodyColor);
        grad.addColorStop(0.3, '#ffffff'); // Primary Reflection
        grad.addColorStop(0.4, bodyColor);
        grad.addColorStop(0.7, '#ffffff33'); // Soft highlight
        grad.addColorStop(0.9, bodyColor);
        grad.addColorStop(1, '#00000033'); // Edge shadow

        ctx.fillStyle = grad;
        ctx.beginPath();

        if (type === 'sports') {
            this.drawSportsBody(ctx, w, h);
        } else if (type === 'truck') {
            this.drawTruckBody(ctx, w, h);
        } else {
            this.drawSedanBody(ctx, w, h);
        }
        ctx.fill();

        // Glossy coat highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 3. Advanced Refractive Glass
        ctx.fillStyle = 'rgba(10, 15, 25, 0.9)';
        if (type === 'sports') {
            ctx.beginPath();
            ctx.roundRect(w * 0.15, h * 0.22, w * 0.7, h * 0.38, 15);
            ctx.fill();

            // Glass Reflection Glint
            const glassGrad = ctx.createLinearGradient(w * 0.2, h * 0.25, w * 0.8, h * 0.6);
            glassGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
            glassGrad.addColorStop(0.5, 'transparent');
            glassGrad.addColorStop(1, 'rgba(255,255,255,0.1)');
            ctx.fillStyle = glassGrad;
            ctx.fill();
        } else {
            ctx.fillRect(w * 0.15, h * 0.25, w * 0.7, h * 0.4);
        }

        // 4. Detailed Chrome Details
        ctx.fillStyle = '#fff';
        // Headlights
        ctx.fillRect(w * 0.1, 2, w * 0.15, 4);
        ctx.fillRect(w * 0.75, 2, w * 0.15, 4);

        // Tail Lights (High Intensity)
        ctx.fillStyle = 'rgba(255, 10, 10, 1)';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#f00';
        ctx.fillRect(w * 0.05, h - 6, w * 0.3, 5);
        ctx.fillRect(w * 0.65, h - 6, w * 0.3, 5);

        ctx.restore();
    }

    static drawSportsBody(ctx, w, h) {
        ctx.moveTo(w * 0.1, 0);
        ctx.quadraticCurveTo(w * 0.1, 0, w * 0.9, 0);
        ctx.lineTo(w, h * 0.1);
        ctx.lineTo(w, h * 0.9);
        ctx.lineTo(w * 0.9, h);
        ctx.lineTo(w * 0.1, h);
        ctx.lineTo(0, h * 0.9);
        ctx.lineTo(0, h * 0.1);
        ctx.closePath();
    }

    static drawSedanBody(ctx, w, h) {
        ctx.roundRect(0, 0, w, h, 8);
    }

    static drawTruckBody(ctx, w, h) {
        ctx.roundRect(0, 0, w, h, 2);
        // Back bed
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(w * 0.1, h * 0.4, w * 0.8, h * 0.5);
    }
}

/**
 * PARTICLES
 */
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 200;
        this.vy = (Math.random() - 0.5) * 200;
        this.life = 1.0;
        this.size = Math.random() * 5 + 2;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt * 2;
        return this.life <= 0;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

/**
 * SCENERY
 */
class SceneryObject {
    constructor(x, y, variant, scale) {
        this.x = x;
        this.y = y;
        this.variant = variant;
        this.scale = scale;
        this.width = 100 * scale;
        this.height = 100 * scale;
    }

    draw(ctx) {
        const sprite = Assets.getScenerySprite(this.variant);
        if (sprite && sprite.img) {
            ctx.drawImage(sprite.img, sprite.sx, sprite.sy, sprite.sw, sprite.sh, this.x, this.y, this.width, this.height);
        }
    }
}

// Add methods to GameEngine prototype for organization
GameEngine.prototype.drawShadow = function (car) {
    const shadowOffset = 15;
    this.ctx.save();
    this.ctx.translate(car.x + shadowOffset, car.y + shadowOffset);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.beginPath();
    this.ctx.roundRect(0, 0, car.width, car.height, 10);
    this.ctx.fill();
    this.ctx.restore();
};

GameEngine.prototype.drawHeadlights = function (car) {
    // Only show lights if night or high speed for "realism" effect
    if (this.level >= 6 || this.speed > 400) {
        this.ctx.save();
        this.ctx.translate(car.x + car.width / 2, car.y);

        const grad = this.ctx.createRadialGradient(0, 0, 10, 0, -200, 200);
        grad.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
        grad.addColorStop(1, 'transparent');

        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.moveTo(-car.width / 2, 0);
        this.ctx.lineTo(-car.width, -300);
        this.ctx.lineTo(car.width, -300);
        this.ctx.lineTo(car.width / 2, 0);
        this.ctx.fill();
        this.ctx.restore();
    }
};
