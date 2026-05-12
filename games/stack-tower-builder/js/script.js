/**
 * Stack Tower Builder - Complete Game Logic
 * Features: Isometric Rendering, Physics, Adaptive Difficulty, Tutorial, Synthesized Audio
 */

const Game = {
    // --- Configuration & Constants ---
    config: {
        blockSize: 200,          // Base size of blocks
        blockHeight: 40,        // Height of each block
        perfectTolerance: 8,    // Pixels within which a drop is considered 'perfect'
        initialSpeed: 2.5,      // Starting speed of moving blocks
        speedIncrement: 0.1,    // Speed increase per block
        maxSpeed: 8,            // Maximum speed limit
        colorShift: 5,          // HSL hue shift per block
        camInteria: 0.1,        // Camera smoothness
        themes: [
            { hue: 220, primary: '#6366f1' }, // Default Indigo
            { hue: 280, primary: '#a855f7' }, // Purple
            { hue: 340, primary: '#f43f5e' }, // Rose
            { hue: 30,  primary: '#f59e0b' }, // Amber
            { hue: 160, primary: '#10b981' }  // Emerald
        ]
    },

    // --- State Management ---
    state: {
        phase: 'LOADING',       // LOADING, START, TUTORIAL, PLAYING, GAMEOVER
        score: 0,
        highScore: 0,           // Loaded safely in init()
        combo: 0,               // Consecutive perfect stacks
        speed: 0,
        direction: 'x',         // Current movement axis
        isMovingForward: true,
        bgHue: 220,             // Background starting hue
        isSoundEnabled: true,
        level: 1,               // Current Level
        blocksInLevel: 0        // Progress towards next level
    },

    // --- Game Objects ---
    stack: [],                  // Array of placed blocks
    movingBlock: null,          // The block currently sliding
    debris: [],                 // Falling offcut pieces
    particles: [],              // Visual effects
    camera: { y: 0, targetY: 0 },
    floatingTexts: [],           // Array for combo popups
    screenShake: 0,              // Visual feedback

    // --- Initialization ---
    init() {
        try {
            this.canvas = document.getElementById('gameCanvas');
            this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
            
            // Immediate Loader Removal
            const loader = document.getElementById('loading-screen');
            if (loader) loader.classList.remove('active');
            this.showStartScreen();

            // Setup Event Listeners
            window.addEventListener('resize', () => this.resize());
            if (this.canvas) this.resize();

            const handleAction = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                this.handleInput();
            };

            window.addEventListener('mousedown', handleAction);
            window.addEventListener('touchstart', handleAction, { passive: false });
            window.addEventListener('keydown', (e) => {
                if (e.code === 'Space') this.handleInput();
            });

            // UI Listeners Safely
            this.bindEvents();

            // Load High Score Safely
            try {
                this.state.highScore = parseInt(localStorage.getItem('stack_high_score')) || 0;
            } catch (e) {}

            // Initialize State and Loop
            this.resetGame();
            this.loop();

        } catch (initError) {
            console.error("Critical Init Error:", initError);
            // Final fallback to make game container interactive
            const loader = document.getElementById('loading-screen');
            if (loader) loader.classList.remove('active');
            const startScreen = document.getElementById('start-screen');
            if (startScreen) startScreen.classList.add('active');
        }
    },

    bindEvents() {
        const uiMap = {
            'start-btn': () => this.startGame(),
            'restart-btn': () => this.startGame(),
            'sound-toggle': () => this.toggleSound(),
            'skip-tutorial': () => this.startGame(),
            'next-tutorial': () => this.nextTutorialStep()
        };

        Object.entries(uiMap).forEach(([id, fn]) => {
            const el = document.getElementById(id);
            if (el) el.onclick = fn;
        });
    },

    resize() {
        if (!this.canvas || !this.ctx) return;
        this.canvas.width = window.innerWidth * window.devicePixelRatio;
        this.canvas.height = window.innerHeight * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    },

    // --- UI Controls ---
    showStartScreen() {
        this.state.phase = 'START';
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.classList.add('active');
        const bestScore = document.getElementById('best-score-start');
        if (bestScore) bestScore.innerText = this.state.highScore;
        this.resetGame();
    },

    startGame() {
        if (!this.audioCtx) this.initAudio();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        
        const hasSeenTutorial = localStorage.getItem('seen_tutorial');
        
        document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
        
        if (!hasSeenTutorial) {
            this.startTutorial();
        } else {
            this.state.phase = 'PLAYING';
            this.startMusic();
            this.spawnMovingBlock();
        }
    },

    startTutorial() {
        this.state.phase = 'TUTORIAL';
        document.getElementById('tutorial-overlay').classList.add('active');
        this.tutorialStep = 1;
        this.showTutorialStep(1);
    },

    showTutorialStep(step) {
        document.querySelectorAll('.step').forEach(sh => sh.classList.remove('active'));
        document.querySelector(`.step-${step}`).classList.add('active');
        if (step === 2) {
             document.getElementById('next-tutorial').innerText = "LET'S BUILD!";
        }
    },

    nextTutorialStep() {
        if (this.tutorialStep === 1) {
            this.tutorialStep = 2;
            this.showTutorialStep(2);
        } else {
            localStorage.setItem('seen_tutorial', 'true');
            this.startGame();
        }
    },

    toggleSound() {
        if (!this.audioCtx) this.initAudio();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this.state.isSoundEnabled = !this.state.isSoundEnabled;
        const btn = document.getElementById('sound-toggle');
        btn.style.opacity = this.state.isSoundEnabled ? "1" : "0.5";
        
        if (this.state.isSoundEnabled) {
            if (this.audioCtx) this.startMusic();
        } else {
            this.isPlayingMusic = false;
        }

        this.playSound('click');
    },

    // --- Audio Synthesis ---
    initAudio() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.initMusic();
    },

    initMusic() {
        this.musicGain = this.audioCtx.createGain();
        this.musicGain.connect(this.audioCtx.destination);
        this.musicGain.gain.setValueAtTime(0.08, this.audioCtx.currentTime); // Slightly louder BGM

        this.notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // Pentatonic + High C
        this.currentNote = 0;
        this.isPlayingMusic = false;
    },

    startMusic() {
        if (!this.state.isSoundEnabled || this.isPlayingMusic) return;
        this.isPlayingMusic = true;
        this.playNextMusicNote();
    },

    playNextMusicNote() {
        if (!this.isPlayingMusic || !this.state.isSoundEnabled) return;

        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();

        const freq = this.notes[Math.floor(Math.random() * this.notes.length)];
        osc.frequency.setValueAtTime(freq, now);
        osc.type = 'sine';

        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.1, now + 0.5);
        g.gain.linearRampToValueAtTime(0, now + 2);

        osc.connect(g);
        g.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + 2);

        // Schedule next note
        const delay = Math.floor(Math.random() * 800) + 400; // Faster, more rhythmic
        setTimeout(() => this.playNextMusicNote(), delay);
    },

    playSound(type, intensity = 1) {
        if (!this.state.isSoundEnabled || !this.audioCtx) return;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        const now = this.audioCtx.currentTime;

        if (type === 'stack') {
            osc.type = 'sine';
            const freq = 200 + (this.state.score * 10) + (this.state.combo * 50);
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.1);
            gain.gain.setValueAtTime(0.2 * intensity, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        } else if (type === 'perfect') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600 + (this.state.combo * 100), now);
            osc.frequency.exponentialRampToValueAtTime(800 + (this.state.combo * 100), now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'fail') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.5);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start();
            osc.stop(now + 0.05);
        } else if (type === 'milestone') {
            osc.type = 'sine';
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major Arpeggio
            notes.forEach((f, i) => {
                const t = now + i * 0.1;
                osc.frequency.setValueAtTime(f, t);
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            });
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'victory') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
            osc.start();
            osc.stop(now + 0.8);
        }
    },

    // --- Game Logic ---
    resetGame() {
        this.state.score = 0;
        this.state.level = 1;
        this.state.blocksInLevel = 0;
        this.state.combo = 0;
        this.state.speed = this.config.initialSpeed;
        this.state.direction = 'x';
        this.state.bgHue = 220;
        this.updateProgressBar(0);
        this.updateScoreUI();

        this.stack = [{
            x: 0,
            z: 0,
            w: this.config.blockSize,
            d: this.config.blockSize,
            color: this.generateColor(0)
        }];
        
        this.movingBlock = null;
        this.debris = [];
        this.particles = [];
        this.floatingTexts = [];
        this.camera.y = 0;
        this.camera.targetY = 0;
    },

    spawnMovingBlock() {
        const top = this.stack[this.stack.length - 1];
        const offset = 400; // Starting distance

        this.movingBlock = {
            w: top.w,
            d: top.d,
            x: this.state.direction === 'x' ? -offset : top.x,
            z: this.state.direction === 'z' ? -offset : top.z,
            y: this.stack.length * this.config.blockHeight,
            color: this.generateColor(this.stack.length)
        };

        this.state.isMovingForward = true;
    },

    handleInput() {
        if (this.state.phase !== 'PLAYING') return;
        if (!this.movingBlock) return;

        this.placeBlock();
    },

    placeBlock() {
        const top = this.stack[this.stack.length - 1];
        const current = this.movingBlock;
        
        let isX = this.state.direction === 'x';
        let diff = isX ? (current.x - top.x) : (current.z - top.z);
        let overlap = isX ? (top.w - Math.abs(diff)) : (top.d - Math.abs(diff));

        if (overlap <= 0) {
            this.gameOver();
            return;
        }

        // Check for Perfect Drop
        if (Math.abs(diff) < this.config.perfectTolerance) {
            this.state.combo++;
            current.x = top.x;
            current.z = top.z;
            this.playSound('perfect');
            this.createParticles(current, true);
            this.showFloatingText(this.state.combo > 1 ? `COMBO x${this.state.combo}` : "PERFECT!");
            
            // Expansion & Milestone Sound
            if (this.state.combo % 5 === 0) {
                this.playSound('milestone');
                if (isX && current.w < this.config.blockSize) {
                    current.w = Math.min(this.config.blockSize, current.w + 20);
                } else if (!isX && current.d < this.config.blockSize) {
                    current.d = Math.min(this.config.blockSize, current.d + 20);
                }
            }
        } else {
            this.state.combo = 0;
            const size = isX ? current.w : current.d;
            const sliceSize = Math.abs(diff);

            // Create debris before modifying current
            this.createDebris(current, isX, diff, sliceSize);

            // Update block size and centration based on overlap
            if (isX) {
                current.w = overlap;
                current.x = top.x + (diff / 2);
            } else {
                current.d = overlap;
                current.z = top.z + (diff / 2);
            }
            this.playSound('stack', 0.5);
            this.createParticles(current, false);
        }

        this.stack.push(current);
        this.state.score++;
        this.state.speed = Math.min(this.config.maxSpeed, this.config.initialSpeed + (this.state.score * this.config.speedIncrement));
        
        // Progression: Switch direction
        this.state.direction = this.state.direction === 'x' ? 'z' : 'x';
        this.state.bgHue += this.config.colorShift;
        
        this.camera.targetY = this.stack.length * this.config.blockHeight;
        
        this.state.blocksInLevel++;
        this.checkLevelProgress();
        this.updateScoreUI();
        this.spawnMovingBlock();
    },

    checkLevelProgress() {
        const required = 5 + this.state.level * 5;
        this.updateProgressBar(this.state.blocksInLevel / required);

        if (this.state.blocksInLevel >= required) {
            this.levelUp();
        }
    },

    levelUp() {
        this.state.level++;
        this.state.blocksInLevel = 0;
        this.playSound('milestone');
        this.showLevelUpUI();
        
        // Cycle Themes
        const theme = this.config.themes[(this.state.level - 1) % this.config.themes.length];
        this.state.bgHue = theme.hue;
        document.documentElement.style.setProperty('--primary', theme.primary);
        
        // Increase speed jump
        this.state.speed += 0.4;
        this.updateProgressBar(0);
    },

    showLevelUpUI() {
        const overlay = document.createElement('div');
        overlay.className = 'level-up-card';
        overlay.innerHTML = `<h2>LEVEL ${this.state.level}</h2><p>CHALLENGE INCREASED</p>`;
        document.getElementById('game-container').appendChild(overlay);
        setTimeout(() => overlay.remove(), 2000);
    },

    updateProgressBar(percent) {
        const bar = document.getElementById('level-progress-fill');
        if (bar) bar.style.width = (percent * 100) + '%';
        const levelLabel = document.getElementById('level-count');
        if (levelLabel) levelLabel.innerText = "LVL " + this.state.level;
    },

    createDebris(block, isX, diff, size) {
        const debris = {
            w: isX ? size : block.w,
            d: isX ? block.d : size,
            y: block.y,
            color: block.color,
            vx: (Math.random() - 0.5) * 2,
            vz: (Math.random() - 0.5) * 2,
            vy: 0,
            rv: (Math.random() - 0.5) * 0.2, // Rotation velocity
            rotation: 0,
            life: 1
        };

        if (isX) {
            debris.x = diff > 0 ? (block.x + block.w / 2) : (block.x - block.w / 2);
            debris.z = block.z;
            debris.vx += diff > 0 ? 2 : -2;
        } else {
            debris.x = block.x;
            debris.z = diff > 0 ? (block.z + block.d / 2) : (block.z - block.d / 2);
            debris.vz += diff > 0 ? 2 : -2;
        }

        this.debris.push(debris);
    },

    createParticles(block, perfect) {
        const count = perfect ? 30 : 8;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: block.x + (Math.random() - 0.5) * block.w,
                z: block.z + (Math.random() - 0.5) * block.d,
                y: block.y,
                vx: (Math.random() - 0.5) * 8,
                vz: (Math.random() - 0.5) * 8,
                vy: Math.random() * 10,
                size: Math.random() * 6 + 2,
                color: perfect ? '#fff' : block.color,
                life: 1
            });
        }
    },

    gameOver() {
        this.state.phase = 'GAMEOVER';
        this.playSound('fail');
        
        // Screen Shake
        this.screenShake = 20;

        if (this.state.score > this.state.highScore) {
            this.state.highScore = this.state.score;
            try {
                localStorage.setItem('stack_high_score', this.state.highScore);
            } catch (e) {}
            this.playSound('victory');
            document.getElementById('rank-display').style.display = 'block';
            document.getElementById('rank-display').innerText = 'NEW PERSONAL BEST!';
        } else {
            document.getElementById('rank-display').style.display = 'none';
        }

        document.getElementById('final-score').innerText = this.state.score;
        document.getElementById('best-score').innerText = this.state.highScore;
        const finalLevel = document.getElementById('final-level');
        if (finalLevel) finalLevel.innerText = this.state.level;
        
        setTimeout(() => {
            document.getElementById('game-over-screen').classList.add('active');
        }, 800);
    },

    showFloatingText(text) {
        this.floatingTexts.push({
            text,
            x: 0,
            z: 0,
            y: this.stack.length * this.config.blockHeight + 100,
            life: 1,
            vy: 2
        });
    },

    updateScoreUI() {
        const scoreEl = document.getElementById('score');
        if (scoreEl) scoreEl.innerText = this.state.score;
    },

    generateColor(index) {
        // Use current level hue base for smoother gradients
        return `hsl(${(this.state.bgHue + index * 2) % 360}, 70%, 60%)`;
    },

    // --- Rendering ---
    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    },

    update() {
        // Camera smoothing
        this.camera.y += (this.camera.targetY - this.camera.y) * this.config.camInteria;

        // Screen Shake decay
        if (this.screenShake > 0) {
            this.screenShake *= 0.9;
            if (this.screenShake < 0.1) this.screenShake = 0;
        }

        if (this.state.phase === 'PLAYING' && this.movingBlock) {
            const axis = this.state.direction;
            const bound = 350;

            if (this.state.isMovingForward) {
                this.movingBlock[axis] += this.state.speed;
                if (this.movingBlock[axis] > bound) this.state.isMovingForward = false;
            } else {
                this.movingBlock[axis] -= this.state.speed;
                if (this.movingBlock[axis] < -bound) this.state.isMovingForward = true;
            }
        }

        // Update Debris
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.vy -= 0.5; // Gravity
            d.y += d.vy;
            d.x += d.vx;
            d.z += d.vz;
            if (d.rv) d.rotation += d.rv;
            d.life -= 0.01;
            if (d.y < -500 || d.life <= 0) this.debris.splice(i, 1);
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.y += p.vy;
            p.x += p.vx;
            p.z += p.vz;
            p.vy -= 0.4;
            p.life -= 0.02;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Update Floating Text
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y += t.vy;
            t.life -= 0.015;
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }
    },

    draw() {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Calculate Viewport offsets
        const centerX = (canvas.width / 2) / window.devicePixelRatio;
        const centerY = (canvas.height * 0.75) / window.devicePixelRatio;

        this.drawBackground();

        ctx.save();
        
        // Apply Screen Shake
        if (this.screenShake > 0) {
            ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        }

        ctx.translate(centerX, centerY + this.camera.y);

        // Draw Stack
        this.stack.forEach(block => this.drawBlock(block));

        // Draw Moving Block
        if (this.state.phase === 'PLAYING' && this.movingBlock) {
            this.drawBlock(this.movingBlock);
        }

        // Draw Debris
        this.debris.forEach(d => this.drawBlock(d));

        // Draw Particles
        this.drawParticles();

        // Draw Floating Text
        this.floatingTexts.forEach(t => {
            const pos = this.toIso(t.x, t.z, t.y);
            ctx.fillStyle = `rgba(255, 255, 255, ${t.life})`;
            ctx.font = `bold ${30 + t.life * 10}px Outfit`;
            ctx.textAlign = 'center';
            ctx.fillText(t.text, pos.x, pos.y);
        });

        ctx.restore();
    },

    drawParticles() {
        const { ctx } = this;
        this.particles.forEach(p => {
            const pos = this.toIso(p.x, p.z, p.y);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    },

    drawBackground() {
        const grad = this.ctx.createRadialGradient(
            this.canvas.width/4, this.canvas.height/4, 0,
            this.canvas.width/2, this.canvas.height/2, this.canvas.width
        );
        grad.addColorStop(0, `hsl(${this.state.bgHue}, 30%, 20%)`);
        grad.addColorStop(1, `hsl(${this.state.bgHue + 20}, 40%, 5%)`);
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    toIso(x, z, y) {
        // Isometric Projection Formula
        // isoX = (x - z) * cos(30)
        // isoY = (x + z) * sin(30) - y
        return {
            x: (x - z) * Math.cos(Math.PI / 6),
            y: (x + z) * Math.sin(Math.PI / 6) - y
        };
    },

    drawBlock(block) {
        const { ctx } = this;
        const { x, z, y, w, d, color } = block;

        const points = [
            this.toIso(x - w/2, z - d/2, y), // 0: Top-Left-Back
            this.toIso(x + w/2, z - d/2, y), // 1: Top-Right-Back
            this.toIso(x + w/2, z + d/2, y), // 2: Top-Right-Front
            this.toIso(x - w/2, z + d/2, y), // 3: Top-Left-Front
            this.toIso(x - w/2, z - d/2, y - this.config.blockHeight), // 4: Bottom-Left-Back
            this.toIso(x + w/2, z - d/2, y - this.config.blockHeight), // 5: Bottom-Right-Back
            this.toIso(x + w/2, z + d/2, y - this.config.blockHeight), // 6: Bottom-Right-Front
            this.toIso(x - w/2, z + d/2, y - this.config.blockHeight), // 7: Bottom-Left-Front
        ];

        // Draw Shadows/Reflections (Subtle)
        ctx.shadowBlur = 0;
        
        // --- Top Face ---
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.lineTo(points[3].x, points[3].y);
        ctx.closePath();
        ctx.fill();
        
        // Slight highlight on top
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // --- Left Face ---
        ctx.fillStyle = this.shadeColor(color, -15);
        ctx.beginPath();
        ctx.moveTo(points[3].x, points[3].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.lineTo(points[6].x, points[6].y);
        ctx.lineTo(points[7].x, points[7].y);
        ctx.closePath();
        ctx.fill();

        // --- Right Face ---
        ctx.fillStyle = this.shadeColor(color, -30);
        ctx.beginPath();
        ctx.moveTo(points[2].x, points[2].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[5].x, points[5].y);
        ctx.lineTo(points[6].x, points[6].y);
        ctx.closePath();
        ctx.fill();
    },

    shadeColor(col, amt) {
        // Simple HSL lightness adjustment
        const match = col.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!match) return col;
        const h = match[1];
        const s = match[2];
        let l = parseInt(match[3]) + amt;
        l = Math.max(0, Math.min(100, l));
        return `hsl(${h}, ${s}%, ${l}%)`;
    }
};

// Launch Game
document.addEventListener('DOMContentLoaded', () => Game.init());
