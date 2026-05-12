// main.js - Game State, Progression, and Loop Management

class Game {
    constructor() {
        this.level = 1;
        this.score = 0;
        this.time = 0;
        this.timeLimit = 120; // Seconds per level
        
        this.freezeTimer = 0;
        
        this.cellSize = 80;
        this.cols = 10;
        this.rows = 10;
        
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('btn-start').addEventListener('click', () => {
            audio.init();
            audio.startBGM();
            this.startLevel(1);
        });
        document.getElementById('btn-howto').addEventListener('click', () => {
            this.switchScreen('screen-howto');
        });
        document.getElementById('btn-back-menu').addEventListener('click', () => {
            this.switchScreen('screen-title');
        });
        document.getElementById('btn-pause').addEventListener('click', () => {
            engine.state = GAME_STATES.PAUSED;
            this.switchScreen('screen-pause');
        });
        document.getElementById('btn-resume').addEventListener('click', () => {
            engine.state = GAME_STATES.PLAYING;
            this.switchScreen('screen-hud');
            engine.lastTime = performance.now();
            requestAnimationFrame((t) => this.loop(t));
        });
        document.getElementById('btn-quit').addEventListener('click', () => {
            this.switchScreen('screen-title');
            engine.state = GAME_STATES.MENU;
            audio.stopBGM();
        });
        document.getElementById('btn-next-level').addEventListener('click', () => {
            this.startLevel(this.level + 1);
        });
        document.getElementById('btn-retry').addEventListener('click', () => {
            this.score = 0;
            this.startLevel(1);
        });
    }

    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => {
            if(s.id === screenId) {
                s.classList.remove('hidden');
                s.classList.add('active');
            } else {
                s.classList.add('hidden');
                s.classList.remove('active');
            }
        });
    }

    updateHUD() {
        document.getElementById('hud-level').innerText = this.level;
        document.getElementById('hud-score').innerText = this.score;
        let mins = Math.floor(this.time / 60);
        let secs = Math.floor(this.time % 60);
        document.getElementById('hud-time').innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    startLevel(lvl) {
        this.level = lvl;
        this.time = this.timeLimit;
        this.freezeTimer = 0;
        
        // Progression Logic
        this.cols = Math.min(10 + Math.floor(this.level / 2), 30);
        this.rows = Math.min(10 + Math.floor(this.level / 2), 30);
        
        // Ensure odd numbers for maze generation stability (optional but good practice)
        if(this.cols % 2 === 0) this.cols++;
        if(this.rows % 2 === 0) this.rows++;

        engine.maze = new Maze(this.cols, this.rows, this.cellSize);
        engine.maze.generate();

        // Spawn Player at 0,0
        engine.player = new Player(this.cellSize/2, this.cellSize/2, this.cellSize * 0.3);
        
        // Spawn Enemies
        engine.entities = [];
        let numEnemies = Math.min(this.level, 15); // Max 15 enemies
        for (let i = 0; i < numEnemies; i++) {
            let x = Math.floor(Math.random() * (this.cols - 2)) + 2; // don't spawn on player
            let y = Math.floor(Math.random() * (this.rows - 2)) + 2;
            let type = this.level > 5 && Math.random() < 0.3 ? 1 : 0; // 30% chasers after level 5
            engine.entities.push(new Enemy(x * this.cellSize + this.cellSize/2, y * this.cellSize + this.cellSize/2, type, this.cellSize*0.3));
        }

        // Spawn Collectibles (Coins and Powerups)
        engine.collectibles = [];
        let numCoins = this.cols * 2;
        for (let i=0; i<numCoins; i++) {
            let x = Math.floor(Math.random() * this.cols);
            let y = Math.floor(Math.random() * this.rows);
            // 80% coin, 20% powerup
            let type = Math.random() < 0.8 ? 0 : Math.floor(Math.random() * 3) + 1;
            engine.collectibles.push(new Collectible(x * this.cellSize + this.cellSize/2, y * this.cellSize + this.cellSize/2, type));
        }

        engine.particles = [];
        
        this.switchScreen('screen-hud');
        engine.state = GAME_STATES.PLAYING;
        engine.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(timestamp) {
        if (engine.state !== GAME_STATES.PLAYING) return;
        
        let dt = timestamp - engine.lastTime;
        engine.lastTime = timestamp;
        
        // Cap dt to prevent massive jumps if tab is backgrounded
        if (dt > 100) dt = 16; 

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Time
        this.time -= dt / 1000;
        if (this.time <= 0) {
            this.gameOver();
            return;
        }

        if (this.freezeTimer > 0) {
            this.freezeTimer -= dt / 1000;
        }

        // Update Player
        let input = engine.getInput();
        if(input.x !== 0 || input.y !== 0) {
            if(Math.random() < 0.1) audio.playMove(); // Very light footstep sound
        }
        engine.player.update(dt, input, engine.maze);

        // Update Camera (Center on player)
        engine.camera.x = engine.player.x - engine.width / 2;
        engine.camera.y = engine.player.y - engine.height / 2;

        // Clamp camera to maze bounds
        engine.camera.x = Math.max(-200, Math.min(engine.camera.x, engine.maze.cols * this.cellSize - engine.width + 200));
        engine.camera.y = Math.max(-200, Math.min(engine.camera.y, engine.maze.rows * this.cellSize - engine.height + 200));

        // Update Enemies
        for (let e of engine.entities) {
            e.update(dt, engine.maze, engine.player, this.freezeTimer > 0);
            
            // Check Player Collision
            if (circleRectCollide(engine.player, {x: e.x-e.r, y: e.y-e.r, w: e.r*2, h: e.r*2})) {
                if (engine.player.shielded) {
                    // Destroy enemy
                    audio.playHit();
                    engine.addParticle(e.x, e.y, '#ff0000', 150, 4, 1);
                    e.dead = true;
                    engine.player.shielded = false;
                    engine.player.shieldTimer = 0;
                } else {
                    this.gameOver();
                    return;
                }
            }
        }
        engine.entities = engine.entities.filter(e => !e.dead);

        // Collectibles
        for (let c of engine.collectibles) {
            if (!c.collected && circleRectCollide(engine.player, {x: c.x-c.r, y: c.y-c.r, w: c.r*2, h: c.r*2})) {
                c.collected = true;
                if (c.type === 0) { // Coin
                    this.score += 10;
                    audio.playCollect();
                    engine.addParticle(c.x, c.y, '#ffd700', 50, 2, 0.5);
                } else { // Powerups
                    audio.playPowerup();
                    if (c.type === 1) engine.player.shieldTimer = 5; // Shield 5s
                    if (c.type === 2) engine.player.speedBoostTimer = 5; // Speed 5s
                    if (c.type === 3) this.freezeTimer = 5; // Freeze enemies 5s
                    engine.addParticle(c.x, c.y, c.colors[c.type], 100, 3, 1);
                }
            }
        }

        // Check Exit
        let ex = engine.maze.exit.x * this.cellSize + this.cellSize/2;
        let ey = engine.maze.exit.y * this.cellSize + this.cellSize/2;
        if (Math.hypot(engine.player.x - ex, engine.player.y - ey) < this.cellSize) {
            this.levelComplete();
            return;
        }

        engine.updateParticles(dt);
        this.updateHUD();
    }

    draw() {
        let ctx = engine.ctx;
        ctx.clearRect(0, 0, engine.width, engine.height);

        engine.maze.draw(ctx, engine.camera);

        for (let c of engine.collectibles) c.draw(ctx, engine.camera);
        for (let e of engine.entities) e.draw(ctx, engine.camera);
        
        engine.player.draw(ctx, engine.camera);
        engine.drawParticles();
    }

    levelComplete() {
        engine.state = GAME_STATES.LEVEL_COMPLETE;
        audio.playLevelComplete();
        let timeBonus = Math.floor(this.time) * 10;
        this.score += timeBonus;
        document.getElementById('stat-time').innerText = timeBonus;
        document.getElementById('stat-score').innerText = this.score;
        this.switchScreen('screen-level-complete');
    }

    gameOver() {
        engine.state = GAME_STATES.GAME_OVER;
        audio.playHit();
        document.getElementById('game-over-level').innerText = this.level;
        document.getElementById('game-over-score').innerText = this.score;
        this.switchScreen('screen-game-over');
    }
}

// Start
window.onload = () => {
    window.game = new Game();
};
