import audio from './audio.js';
import particles from './particles.js';
import { getLevel, BRICK_COLORS, BRICK_POINTS } from './levels.js';
import { Ball, checkCollision } from './physics.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.width = 800; // Fixed internal resolution
        this.height = 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.gameState = 'START'; // START, PLAYING, PAUSED, LEVEL_COMPLETE, GAMEOVER
        this.score = 0;
        this.lives = 3;
        this.currentLevel = 0;
        this.combo = 0;
        this.maxCombo = 0;

        this.paddle = {
            x: this.width / 2 - 60,
            y: this.height - 40,
            width: 120,
            height: 15,
            speed: 10,
            targetX: this.width / 2 - 60,
            glow: 0
        };

        this.balls = [];
        this.bricks = [];
        this.powerUps = [];
        this.activePowerUps = new Set();
        
        this.init();
        this.setupListeners();
        this.requestUpdate();
    }

    init() {
        this.loadLevel(this.currentLevel);
        this.resetBalls();
    }

    loadLevel(levelIndex) {
        const layout = getLevel(levelIndex);
        this.bricks = [];
        const padding = 10;
        const totalWidth = this.width - 40;
        const brickWidth = (totalWidth / layout[0].length) - padding;
        const brickHeight = 25;

        layout.forEach((row, r) => {
            row.forEach((type, c) => {
                if (type > 0) {
                    this.bricks.push({
                        x: 20 + c * (brickWidth + padding),
                        y: 50 + r * (brickHeight + padding),
                        width: brickWidth,
                        height: brickHeight,
                        type: type,
                        hits: type === 2 ? 2 : (type === 3 ? 3 : 1),
                        maxHits: type === 2 ? 2 : (type === 3 ? 3 : 1)
                    });
                }
            });
        });
    }

    resetBalls() {
        this.balls = [new Ball(this.width / 2, this.height - 60, 8, 5 + this.currentLevel * 0.2)];
    }

    setupListeners() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.gameState === 'PLAYING') this.togglePause();
            if (e.key === ' ' && this.gameState === 'START') this.startGame();
        });

        // Button
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());

        // Mouse/Touch
        const handleMove = (x) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.width / rect.width;
            const mouseX = (x - rect.left) * scaleX;
            this.paddle.targetX = mouseX - this.paddle.width / 2;
        };

        this.canvas.addEventListener('mousemove', (e) => handleMove(e.clientX));
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            handleMove(e.touches[0].clientX);
        }, { passive: false });

        this.canvas.addEventListener('mousedown', () => {
            if (this.gameState === 'START') this.startGame();
            if (this.gameState === 'GAMEOVER' || this.gameState === 'LEVEL_COMPLETE') this.nextLevel();
        });
    }

    startGame() {
        this.gameState = 'PLAYING';
        document.getElementById('startScreen').classList.add('hidden');
    }

    togglePause() {
        this.gameState = this.gameState === 'PLAYING' ? 'PAUSED' : 'PLAYING';
    }

    update() {
        if (this.gameState !== 'PLAYING') return;

        // Smooth paddle movement
        this.paddle.x += (this.paddle.targetX - this.paddle.x) * 0.2;
        this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.width, this.paddle.x));

        // Update balls
        this.balls.forEach((ball, bIndex) => {
            const result = ball.update(this.width, this.height);
            
            if (result === 'wall') audio.playHit();
            if (result === 'lost') {
                this.balls.splice(bIndex, 1);
                if (this.balls.length === 0) {
                    this.lives--;
                    this.combo = 0;
                    if (this.lives <= 0) {
                        this.gameState = 'GAMEOVER';
                        audio.playGameOver();
                    } else {
                        this.resetBalls();
                    }
                }
            }

            // Paddle collision
            if (checkCollision(ball, this.paddle)) {
                audio.playHit();
                this.combo = 0;
                this.paddle.glow = 20;
                // Change ball angle based on where it hit the paddle
                const hitPos = (ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
                ball.dx = hitPos * ball.speed;
            }

            // Brick collision
            this.bricks.forEach((brick, index) => {
                if (brick.type === 4 && !ball.isFireball) { // Unbreakable
                    if (checkCollision(ball, brick)) audio.playHit();
                    return;
                }

                if (checkCollision(ball, brick)) {
                    this.hitBrick(brick, index, ball);
                }
            });
        });

        // Update particles
        particles.update();
        if (this.paddle.glow > 0) this.paddle.glow--;

        // Check level completion
        if (this.bricks.filter(b => b.type !== 4).length === 0) {
            this.gameState = 'LEVEL_COMPLETE';
            audio.playLevelUp();
        }
    }

    hitBrick(brick, index, ball) {
        if (ball.isFireball) {
            this.destroyBrick(brick, index);
        } else {
            brick.hits--;
            if (brick.hits <= 0) {
                this.destroyBrick(brick, index);
            } else {
                audio.playHit();
                particles.createSparks(ball.x, ball.y, BRICK_COLORS[brick.type]);
            }
        }
    }

    destroyBrick(brick, index) {
        audio.playBreak();
        particles.createExplosion(brick.x + brick.width / 2, brick.y + brick.height / 2, BRICK_COLORS[brick.type]);
        this.score += BRICK_POINTS[brick.type] * (1 + Math.floor(this.combo / 5));
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        
        // Chance to drop power-up
        if (brick.type === 6 || Math.random() < 0.1) {
            this.spawnPowerUp(brick.x, brick.y);
        }

        if (brick.type === 5) { // Explosive
            this.explodeBricks(brick);
        }

        this.bricks.splice(index, 1);
    }

    spawnPowerUp(x, y) {
        const types = ['MULTI', 'WIDER', 'LASER', 'FIRE', 'SLOW'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.powerUps.push({ x, y, type, speed: 2 });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw HUD
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px Outfit, sans-serif';
        this.ctx.fillText(`Score: ${this.score}`, 20, 30);
        this.ctx.fillText(`Lives: ${'❤'.repeat(this.lives)}`, this.width - 150, 30);
        this.ctx.fillText(`Level: ${this.currentLevel + 1}`, this.width / 2 - 40, 30);
        if (this.combo > 5) {
            this.ctx.fillStyle = '#ff00ff';
            this.ctx.fillText(`${this.combo} Combo!`, this.width / 2 - 40, 60);
        }

        // Draw Bricks
        this.bricks.forEach(brick => {
            this.ctx.fillStyle = BRICK_COLORS[brick.type];
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = BRICK_COLORS[brick.type];
            this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
            // 3D effect
            this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
            this.ctx.fillRect(brick.x, brick.y, brick.width, 4);
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.ctx.fillRect(brick.x, brick.y + brick.height - 4, brick.width, 4);
        });
        this.ctx.shadowBlur = 0;

        // Draw Paddle
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowBlur = this.paddle.glow;
        this.ctx.shadowColor = '#00f2ff';
        this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        this.ctx.shadowBlur = 0;

        // Draw Balls
        this.balls.forEach(ball => ball.draw(this.ctx));

        // Draw Particles
        particles.draw(this.ctx);

        // Screens based on state
        if (this.gameState === 'GAMEOVER') this.drawScreen('GAME OVER', 'Touch to Restart');
        if (this.gameState === 'LEVEL_COMPLETE') this.drawScreen('LEVEL CLEAR', 'Touch for Next Level');
        if (this.gameState === 'PAUSED') this.drawScreen('PAUSED', 'Press ESC to Resume');
    }

    drawScreen(title, subtitle) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = '#ff00ff';
        this.ctx.font = '60px Outfit, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(title, this.width / 2, this.height / 2);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Outfit, sans-serif';
        this.ctx.fillText(subtitle, this.width / 2, this.height / 2 + 50);
        this.ctx.textAlign = 'left';
    }

    nextLevel() {
        this.currentLevel++;
        this.init();
        this.score += 500;
        this.gameState = 'PLAYING';
    }

    requestUpdate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.requestUpdate());
    }
}

window.onload = () => {
    new Game();
};
