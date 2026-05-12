class GameManager {
    constructor() {
        console.log("GameManager: Initializing System...");
        
        try {
            // Root Initialization - Ensure these exist before GameManager
            this.engine = new window.Engine();
            this.input = new window.InputManager();
            this.ui = new window.UIManager();
            this.sfx = new window.SoundManager();

            // Set global refs for legacy/entity access
            window.gameEngine = this.engine;
            window.inputManager = this.input;
            window.uiManager = this.ui;
            window.sfxManager = this.sfx;

            this.player = null;
            this.enemies = [];
            this.bullets = [];
            this.items = [];
            this.wave = 1;
            this.kills = 0;
            this.state = 'START'; 
            this.lastSpawn = 0;
            this.lastTime = performance.now();

            this.setupEvents();
            this.loop();
            this.ui.generateBranding();
            
            console.log("GameManager: System Ready.");
        } catch (e) {
            console.error("GameManager: Critical initialization failure:", e);
        }
    }

    setupEvents() {
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            const onStart = (e) => {
                e.preventDefault();
                console.log("Start Sequence Triggered");
                this.start();
            };
            startBtn.onclick = onStart;
            startBtn.ontouchstart = onStart;
        } else {
            console.error("Start Button NOT found in DOM!");
        }

        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.onclick = () => location.reload();
        }
    }

    start() {
        try {
            console.log("Initializing Arena...");
            
            // Resume Audio Context on user gesture
            if (this.sfx && this.sfx.ctx.state === 'suspended') {
                this.sfx.ctx.resume().then(() => console.log("Audio Context Resumed"));
            }

            // Spawn Player
            this.player = new Player(this.engine.width / 2, this.engine.height / 2);
            this.state = 'PLAYING';
            
            // UI Transition
            this.ui.hideOverlays();
            
            // Visual Effect
            this.engine.particles.explosion(this.player.x, this.player.y, this.player.color);
            
            console.log("Protocol Active.");
        } catch (e) {
            console.error("Failed to start game:", e);
        }
    }

    spawnWave() {
        const count = 5 + (this.wave * 2);
        const types = ['fast'];
        if (this.wave > 2) types.push('tank');
        if (this.wave > 4) types.push('ranged');
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 800 + Math.random() * 400; // Farther away
            const x = this.player.x + Math.cos(angle) * dist;
            const y = this.player.y + Math.sin(angle) * dist;
            
            const type = types[Math.floor(Math.random() * types.length)];
            this.enemies.push(new Enemy(x, y, type));
        }

        if (this.wave % 5 === 0) {
            const angle = Math.random() * Math.PI * 2;
            const bx = this.player.x + Math.cos(angle) * 1200;
            const by = this.player.y + Math.sin(angle) * 1200;
            this.enemies.push(new Enemy(bx, by, 'boss'));
        }
    }

    handleCollisions() {
        this.bullets.forEach(b => {
            if (b.owner === 'player') {
                this.enemies.forEach(e => {
                    const dx = b.x - e.x;
                    const dy = b.y - e.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < e.radius + b.radius) {
                        e.takeDamage(b.damage);
                        b.toDelete = true;
                        this.engine.particles.sparks(b.x, b.y, b.angle + Math.PI);
                        this.engine.camera.shake(2);
                        this.sfx.playHit();
                        
                        if (e.toDelete) {
                            this.kills++;
                            this.player.xp += 20 * (this.wave * 0.5);
                            this.engine.particles.explosion(e.x, e.y, e.color);
                            this.engine.camera.shake(5);
                            this.sfx.playExplosion();
                            this.checkLevelUp();
                        }
                    }
                });
            } else {
                const dx = b.x - this.player.x;
                const dy = b.y - this.player.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < (this.player.radius * 0.8) + b.radius && this.player.invulnerable <= 0) {
                    this.player.takeDamage(b.damage);
                    b.toDelete = true;
                    this.engine.particles.blood(this.player.x, this.player.y);
                    this.engine.camera.shake(10);
                }
            }
        });

        this.enemies.forEach(e => {
            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < (this.player.radius * 0.8) + (e.radius * 0.8) && this.player.invulnerable <= 0) {
                this.player.takeDamage(0.2); 
                this.engine.camera.shake(1);
            }
        });
    }

    checkLevelUp() {
        if (this.player.xp >= this.player.xpToNext) {
            this.state = 'UPGRADE';
            this.player.xp -= this.player.xpToNext;
            this.player.level++;
            this.player.xpToNext *= 1.25;
            
            const options = [
                { id: 'dmg', name: 'ATK OVERDRIVE', desc: 'Increase bullet damage by 25%', icon: '⚔️' },
                { id: 'rate', name: 'HYPER TRIGGER', desc: 'Increase fire rate by 15%', icon: '🔥' },
                { id: 'spd', name: 'KEVLAR BOOTS', desc: 'Increase movement speed', icon: '🏃' },
                { id: 'hp', name: 'REPAIR NANITES', desc: 'Full restoration + Max HP', icon: '❤️' },
                { id: 'weapon', name: 'NEW TECH', desc: 'Deploy experimental weapon', icon: '🔫' }
            ];

            const chosen = options.sort(() => 0.5 - Math.random()).slice(0, 3);
            this.ui.showLevelUp(chosen, (opt) => {
                this.applyUpgrade(opt.id);
                this.state = 'PLAYING';
            });
        }
    }

    applyUpgrade(id) {
        switch(id) {
            case 'dmg': this.player.weapon.damage *= 1.25; break;
            case 'rate': this.player.weapon.fireRate *= 0.85; break;
            case 'spd': this.player.speed *= 1.15; break;
            case 'hp': 
                this.player.maxHp += 20;
                this.player.hp = this.player.maxHp;
                break;
            case 'weapon':
                const guns = ['Shotgun', 'MachineGun', 'Laser'];
                const nextGun = guns[Math.floor(Math.random()*guns.length)];
                this.player.weapon = window.Armory[nextGun]();
                break;
        }
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        this.input.update();
        if (this.player) {
            this.player.update(this.input, this.engine, this.bullets, dt);
            
            if (this.player.toDelete) {
                this.state = 'GAMEOVER';
                this.ui.showGameOver(this.wave, this.kills);
                return;
            }
        }

        if (this.enemies.length === 0 && Date.now() - this.lastSpawn > 2000) {
            this.wave++;
            this.spawnWave();
            this.lastSpawn = Date.now();
        }

        this.enemies.forEach(e => e.update(this.player, this.bullets, dt));
        this.bullets.forEach(b => b.update(dt));

        this.handleCollisions();

        this.enemies = this.enemies.filter(e => !e.toDelete);
        this.bullets = this.bullets.filter(b => !b.toDelete);

        if (this.player) {
            this.engine.camera.update(this.player.x, this.player.y, this.engine.width, this.engine.height, dt);
            this.ui.updateHUD(this.player, this.wave, this.enemies);
        }
        this.engine.particles.update(dt);
    }

    draw() {
        this.engine.clear();
        
        if (this.state === 'START' || !this.player) return;

        this.engine.camera.apply(this.engine.ctx);
        const ctx = this.engine.ctx;
        
        this.enemies.forEach(e => e.draw(ctx));
        this.bullets.forEach(b => b.draw(ctx));
        this.player.draw(ctx);
        this.engine.particles.draw(ctx);

        this.engine.camera.restore(ctx);
    }

    loop() {
        const now = performance.now();
        const dt = (now - this.lastTime) / 16.666; 
        this.lastTime = now;

        this.update(dt);
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

// Global initialization
window.addEventListener('load', () => {
    console.log("System Load Complete. Initializing GameManager...");
    window.gameManager = new GameManager();
});
