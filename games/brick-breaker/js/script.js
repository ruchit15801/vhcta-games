/**
 * Neon Breaker - Elite Multi-Platform Engine
 * Standardized High-Res Coordinate System (800x1200)
 */

// --- 1. Pro Audio Engine ---
class AudioEngine {
    constructor() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.gain = this.ctx.createGain();
            this.gain.connect(this.ctx.destination);
            this.gain.gain.value = 0.5;
        } catch(e) {}
    }
    #osc(type, f, d, g=0.5) {
        if(!this.ctx) return null;
        const o = this.ctx.createOscillator();
        const gn = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, this.ctx.currentTime);
        gn.gain.setValueAtTime(g, this.ctx.currentTime);
        gn.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + d);
        o.connect(gn); gn.connect(this.gain);
        return o;
    }
    playHit() { if(this.ctx) { const o=this.#osc('triangle', 180, 0.1); o.start(); o.stop(this.ctx.currentTime+0.1); } }
    playBreak() { if(this.ctx) { const o=this.#osc('square', 250, 0.2, 0.3); o.start(); o.stop(this.ctx.currentTime+0.2); } }
    playWin() { if(this.ctx) { [523, 659, 783].forEach((f,i) => { const o=this.#osc('sine', f, 0.5, 0.2); o.start(this.ctx.currentTime+i*0.1); o.stop(this.ctx.currentTime+0.5+i*0.1); }); } }
}
const audio = new AudioEngine();

// --- 2. Particles & FX ---
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * 8 + 2;
        this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
        this.life = 40; this.maxLife = 40;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life--; return this.life > 0; }
    draw(ctx) {
        ctx.save(); ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color; ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, 4, 4); ctx.restore();
    }
}

// --- 3. Core Engine ---
class Engine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // STABLE LOGICAL RESOLUTION
        this.w = 800; this.h = 1100;
        this.canvas.width = this.w;
        this.canvas.height = this.h;

        this.gameState = 'START'; // START, PLAYING, GAMEOVER
        this.score = 0; this.lvl = 0; this.lives = 3;
        this.paddle = { x: 300, w: 160, h: 22, tx: 300 };
        this.balls = []; this.bricks = [];
        this.particles = [];
        this.shake = 0;

        this.gameState = 'START';
        document.getElementById('start-menu').classList.remove('hidden');
        document.getElementById('death-menu').classList.add('hidden');
        document.getElementById('ui-overlay').classList.remove('hidden');

        this.initListeners();
        this.loop();
    }

    initBricks() {
        this.bricks = [];
        const cols = 8;
        const brickW = (this.w - 100) / cols;
        const rows = 4 + Math.min(this.lvl, 6);
        const colors = ['#00f2ff', '#ff00ff', '#ffea00', '#ff6a00', '#00ffaa'];
        
        for(let r=0; r<rows; r++) {
            for(let c=0; c<cols; c++) {
                this.bricks.push({
                    x: 50 + c * brickW,
                    y: 120 + r * 40,
                    w: brickW - 10, h: 30,
                    color: colors[r % colors.length],
                    hp: 1
                });
            }
        }
        this.resetBall();
    }

    resetBall() {
        this.balls = [{
            x: this.w / 2, y: this.h - 150, r: 12,
            dx: 6 * (Math.random() > 0.5 ? 1 : -1), dy: -8,
            speed: 9 + this.lvl
        }];
        this.paddle.x = this.w/2 - this.paddle.w/2;
        this.paddle.tx = this.paddle.x;
    }

    initListeners() {
        const start = () => {
            if (this.gameState !== 'PLAYING') {
                // Smooth Start Transition
                const modal = document.querySelector('.glass-modal:not(.hidden)');
                if (modal) {
                    modal.style.transition = 'all 0.5s ease';
                    modal.style.opacity = '0';
                    modal.style.transform = 'scale(1.1)';
                }

                setTimeout(() => {
                    this.gameState = 'PLAYING';
                    this.score = 0; this.lvl = 0; this.lives = 3;
                    this.initBricks();
                    this.updateHUD();
                    document.getElementById('ui-overlay').classList.add('hidden');
                    document.getElementById('game-hud').classList.remove('hidden');
                    if(audio.ctx) audio.ctx.resume();
                }, 300);
            }
        };

        document.getElementById('start-btn').addEventListener('click', start);
        document.getElementById('restart-btn').addEventListener('click', start);

        const handleInput = (clientX) => {
            const rect = this.canvas.getBoundingClientRect();
            // Map real pixel coordinate back to 800x1200 space
            const scaleX = this.w / rect.width;
            const logicalX = (clientX - rect.left) * scaleX;
            this.paddle.tx = logicalX - this.paddle.w/2;
        };

        window.addEventListener('mousemove', e => handleInput(e.clientX));
        window.addEventListener('touchmove', e => {
            e.preventDefault();
            handleInput(e.touches[0].clientX);
        }, { passive: false });
    }

    update() {
        if (this.gameState !== 'PLAYING') return;

        // Paddle smoothing
        this.paddle.x += (this.paddle.tx - this.paddle.x) * 0.25;
        this.paddle.x = Math.max(10, Math.min(this.w - this.paddle.w - 10, this.paddle.x));

        this.balls.forEach((b, bIdx) => {
            b.x += b.dx; b.y += b.dy;

            // Wall Bounce
            if (b.x < b.r || b.x > this.w - b.r) { b.dx *= -1; audio.playHit(); }
            if (b.y < b.r) { b.dy *= -1; audio.playHit(); }

            // Death
            if (b.y > this.h) {
                this.balls.splice(bIdx, 1);
                if (this.balls.length === 0) {
                    this.lives--;
                    this.updateHUD();
                    if (this.lives <= 0) this.gameOver();
                    else this.resetBall();
                }
            }

            // Paddle Bounce
            if (b.y + b.r > this.h - 80 && b.y - b.r < this.h - 80 + this.paddle.h && 
                b.x > this.paddle.x && b.x < this.paddle.x + this.paddle.w) {
                const ratio = (b.x - (this.paddle.x + this.paddle.w/2)) / (this.paddle.w/2);
                b.dy = -Math.abs(b.dy);
                b.dx = ratio * b.speed;
                b.y = this.h - 80 - b.r;
                audio.playHit();
            }

            // Bricks
            this.bricks.forEach((br, i) => {
                const cx = Math.max(br.x, Math.min(b.x, br.x + br.w));
                const cy = Math.max(br.y, Math.min(b.y, br.y + br.h));
                const distSq = (b.x-cx)**2 + (b.y-cy)**2;

                if (distSq < b.r * b.r) {
                    for(let j=0; j<15; j++) this.particles.push(new Particle(br.x+br.w/2, br.y+br.h/2, br.color));
                    this.bricks.splice(i, 1);
                    this.score += 200; this.shake = 12;
                    b.dy *= -1; audio.playBreak();
                    this.updateHUD();
                    if (this.bricks.length === 0) { this.lvl++; this.initBricks(); audio.playWin(); this.updateHUD(); }
                }
            });
        });

        this.particles = this.particles.filter(p => p.update());
        if(this.shake > 0) this.shake *= 0.9;
    }

    updateHUD() {
        document.getElementById('score-text').innerText = this.score.toString().padStart(6, '0');
        document.getElementById('level-text').innerText = (this.lvl + 1).toString().padStart(2, '0');
        document.getElementById('lives-text').innerText = '❤'.repeat(Math.max(0, this.lives));
    }

    gameOver() {
        this.gameState = 'GAMEOVER';
        document.getElementById('game-hud').classList.add('hidden');
        document.getElementById('ui-overlay').classList.remove('hidden');
        document.getElementById('start-menu').classList.add('hidden');
        const deathMenu = document.getElementById('death-menu');
        deathMenu.classList.remove('hidden');
        deathMenu.style.opacity = '1';
        deathMenu.style.transform = 'scale(1)';
        document.getElementById('final-score-val').innerText = this.score;
    }

    draw() {
        // High-end rendering loop
        this.ctx.save();
        if (this.shake > 0.5) this.ctx.translate((Math.random()-0.5)*this.shake, (Math.random()-0.5)*this.shake);
        this.ctx.clearRect(0, 0, this.w, this.h);

        // Bricks
        this.bricks.forEach(br => {
            this.ctx.shadowBlur = 15; this.ctx.shadowColor = br.color;
            this.ctx.fillStyle = br.color;
            this.ctx.fillRect(br.x, br.y, br.w, br.h);
            this.ctx.fillStyle = 'rgba(255,255,255,0.4)'; this.ctx.fillRect(br.x, br.y, br.w, 4);
        });

        // Paddle
        this.ctx.shadowBlur = 20; this.ctx.shadowColor = '#00f2ff';
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(this.paddle.x, this.h - 80, this.paddle.w, this.paddle.h);

        // Balls
        this.balls.forEach(b => {
            this.ctx.shadowBlur = 25; this.ctx.shadowColor = '#fff';
            this.ctx.beginPath(); this.ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
            this.ctx.fillStyle = '#fff'; this.ctx.fill();
        });

        this.particles.forEach(p => p.draw(this.ctx));
        this.ctx.restore();
    }

    loop() {
        this.update(); this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

window.onload = () => new Engine();
