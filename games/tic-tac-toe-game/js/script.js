/* ===============================================
   TIC TAC TOE — PREMIUM EDITION
   Complete Game Logic + AI + Multiplayer
   =============================================== */

(function () {
    'use strict';

    // ============================
    // CONSTANTS & CONFIG
    // ============================
    const LEVELS = [
        { id: 1,  grid: 3, winLen: 3, ai: 'easy',   timer: 0,  label: 'Warm Up',      blocked: 0 },
        { id: 2,  grid: 3, winLen: 3, ai: 'easy',   timer: 0,  label: 'Getting Started', blocked: 0 },
        { id: 3,  grid: 3, winLen: 3, ai: 'easy',   timer: 0,  label: 'Easy Peasy',   blocked: 0 },
        { id: 4,  grid: 3, winLen: 3, ai: 'medium', timer: 30, label: 'Timed Trouble', blocked: 0 },
        { id: 5,  grid: 3, winLen: 3, ai: 'medium', timer: 25, label: 'Quick Thinker', blocked: 0 },
        { id: 6,  grid: 3, winLen: 3, ai: 'medium', timer: 20, label: 'Strategist',    blocked: 0 },
        { id: 7,  grid: 3, winLen: 3, ai: 'medium', timer: 15, label: 'Under Pressure', blocked: 0 },
        { id: 8,  grid: 3, winLen: 3, ai: 'hard',   timer: 30, label: 'Challenger',    blocked: 0 },
        { id: 9,  grid: 3, winLen: 3, ai: 'hard',   timer: 25, label: 'Mind Games',    blocked: 0 },
        { id: 10, grid: 3, winLen: 3, ai: 'hard',   timer: 20, label: 'Tactician',     blocked: 0 },
        { id: 11, grid: 3, winLen: 3, ai: 'hard',   timer: 15, label: 'Prodigy',       blocked: 0 },
        { id: 12, grid: 3, winLen: 3, ai: 'hard',   timer: 10, label: 'Lightning',     blocked: 0 },
        { id: 13, grid: 4, winLen: 4, ai: 'easy',   timer: 30, label: 'Big Board',     blocked: 0 },
        { id: 14, grid: 4, winLen: 4, ai: 'medium', timer: 25, label: 'Expanded',      blocked: 0 },
        { id: 15, grid: 4, winLen: 4, ai: 'medium', timer: 20, label: 'Widened',       blocked: 0 },
        { id: 16, grid: 5, winLen: 4, ai: 'medium', timer: 30, label: 'Grand Arena',   blocked: 0 },
        { id: 17, grid: 5, winLen: 4, ai: 'hard',   timer: 25, label: 'Marathon',      blocked: 0 },
        { id: 18, grid: 3, winLen: 3, ai: 'hard',   timer: 8,  label: 'Speed Rush',    blocked: 0, speed: true },
        { id: 19, grid: 4, winLen: 4, ai: 'hard',   timer: 15, label: 'Obstacles',     blocked: 3 },
        { id: 20, grid: 5, winLen: 4, ai: 'hard',   timer: 12, label: 'Ultimate',      blocked: 5 },
    ];

    const ACHIEVEMENTS = [
        { id: 'first_win',     icon: '🏆', name: 'First Victory',     desc: 'Win your first game' },
        { id: 'streak_3',      icon: '🔥', name: 'Hot Streak',        desc: 'Win 3 games in a row' },
        { id: 'streak_5',      icon: '⚡', name: 'Unstoppable',       desc: 'Win 5 games in a row' },
        { id: 'streak_10',     icon: '💎', name: 'Diamond Streak',    desc: 'Win 10 games in a row' },
        { id: 'perfect_game',  icon: '✨', name: 'Perfect Game',      desc: 'Win without AI scoring once' },
        { id: 'speed_demon',   icon: '⏱️', name: 'Speed Demon',       desc: 'Win a timed game in under 10s' },
        { id: 'beat_hard',     icon: '🧠', name: 'Mastermind',        desc: 'Beat Hard AI' },
        { id: 'level_10',      icon: '📈', name: 'Rising Star',       desc: 'Reach level 10' },
        { id: 'level_20',      icon: '👑', name: 'Grand Champion',    desc: 'Complete all 20 levels' },
        { id: 'big_board_win', icon: '🎯', name: 'Big Brain',         desc: 'Win on a 5x5 board' },
        { id: 'no_undo',       icon: '💪', name: 'No Regrets',        desc: 'Win 5 games without using Undo' },
        { id: 'mp_10',         icon: '🤝', name: 'Social Butterfly',  desc: 'Play 10 multiplayer games' },
    ];

    // ============================
    // SAVE DATA
    // ============================
    const SAVE_KEY = 'ttt_premium_save';
    let saveData = loadSave();

    function defaultSave() {
        return {
            highestLevel: 1,
            levelStars: {},
            achievements: [],
            totalWins: 0,
            totalLosses: 0,
            totalDraws: 0,
            streak: 0,
            bestStreak: 0,
            gamesPlayed: 0,
            mpGames: 0,
            noUndoWins: 0,
            theme: 'neon',
            sfx: true,
            music: false,
            tutorialSeen: false,
        };
    }

    function loadSave() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) return { ...defaultSave(), ...JSON.parse(raw) };
        } catch (e) { /* ignore */ }
        return defaultSave();
    }

    function save() {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData)); } catch (e) { /* ignore */ }
    }

    // ============================
    // DOM REFERENCES
    // ============================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const screens = {
        splash: $('#splashScreen'),
        menu: $('#menuScreen'),
        tutorial: $('#tutorialScreen'),
        level: $('#levelScreen'),
        mpSetup: $('#mpSetupScreen'),
        game: $('#gameScreen'),
        achieve: $('#achieveScreen'),
    };

    const modals = {
        result: $('#resultModal'),
        settings: $('#settingsModal'),
    };

    const gameBoard = $('#gameBoard');
    const boardWrapper = $('#boardWrapper');
    const winLineCanvas = $('#winLineCanvas');
    const winCtx = winLineCanvas.getContext('2d');
    const particleCanvas = $('#particleCanvas');
    const pCtx = particleCanvas.getContext('2d');

    // ============================
    // GAME STATE
    // ============================
    let state = {
        mode: 'single',       // 'single' or 'multi'
        gridSize: 3,
        winLen: 3,
        board: [],
        currentPlayer: 'X',
        gameActive: false,
        moveHistory: [],
        level: null,
        timer: 0,
        timerMax: 0,
        timerInterval: null,
        blockedCells: [],
        scores: { X: 0, O: 0, draw: 0 },
        aiDifficulty: 'easy',
        p1Name: 'Player X',
        p2Name: 'Player O',
        undoLeft: 1,
        hintLeft: 1,
        startTime: 0,
        moveCount: 0,
        sessionNoUndo: true,
        aiThinking: false,
    };

    // ============================
    // SOUND SYSTEM (Web Audio API)
    // ============================
    let audioCtx = null;

    function getAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playTone(freq, duration, type = 'sine', vol = 0.15) {
        if (!saveData.sfx) return;
        try {
            const ctx = getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        } catch (e) { /* ignore */ }
    }

    const SFX = {
        tap: () => playTone(800, 0.08, 'sine', 0.1),
        placeX: () => {
            playTone(523, 0.1, 'triangle', 0.12);
            setTimeout(() => playTone(659, 0.1, 'triangle', 0.1), 60);
        },
        placeO: () => {
            playTone(440, 0.1, 'triangle', 0.12);
            setTimeout(() => playTone(349, 0.1, 'triangle', 0.1), 60);
        },
        win: () => {
            playTone(523, 0.15, 'sine', 0.15);
            setTimeout(() => playTone(659, 0.15, 'sine', 0.15), 120);
            setTimeout(() => playTone(784, 0.15, 'sine', 0.15), 240);
            setTimeout(() => playTone(1047, 0.3, 'sine', 0.15), 360);
        },
        lose: () => {
            playTone(440, 0.2, 'sine', 0.12);
            setTimeout(() => playTone(349, 0.2, 'sine', 0.12), 150);
            setTimeout(() => playTone(262, 0.4, 'sine', 0.12), 300);
        },
        draw: () => {
            playTone(440, 0.2, 'triangle', 0.1);
            setTimeout(() => playTone(440, 0.2, 'triangle', 0.1), 200);
        },
        click: () => playTone(1000, 0.05, 'sine', 0.08),
        achievement: () => {
            playTone(784, 0.1, 'sine', 0.15);
            setTimeout(() => playTone(988, 0.1, 'sine', 0.15), 100);
            setTimeout(() => playTone(1175, 0.1, 'sine', 0.15), 200);
            setTimeout(() => playTone(1568, 0.3, 'sine', 0.15), 300);
        },
        timerWarn: () => playTone(600, 0.1, 'square', 0.06),
    };

    // ============================
    // PARTICLE SYSTEM
    // ============================
    let particles = [];
    let bgParticles = [];

    function resizeParticleCanvas() {
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
    }

    function initBgParticles() {
        bgParticles = [];
        const count = Math.min(50, Math.floor((window.innerWidth * window.innerHeight) / 15000));
        for (let i = 0; i < count; i++) {
            bgParticles.push({
                x: Math.random() * particleCanvas.width,
                y: Math.random() * particleCanvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 2 + 0.5,
                alpha: Math.random() * 0.3 + 0.05,
            });
        }
    }

    function spawnCelebrationParticles(x, y, count = 30) {
        const colors = ['#00e5ff', '#ff4081', '#7c4dff', '#76ff03', '#ffd700'];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 2 + Math.random() * 4;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                r: Math.random() * 4 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                decay: 0.015 + Math.random() * 0.01,
                gravity: 0.08,
            });
        }
    }

    function animateParticles() {
        pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

        // Background particles
        const isGlass = saveData.theme === 'glass';
        for (const p of bgParticles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = particleCanvas.width;
            if (p.x > particleCanvas.width) p.x = 0;
            if (p.y < 0) p.y = particleCanvas.height;
            if (p.y > particleCanvas.height) p.y = 0;
            pCtx.beginPath();
            pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            pCtx.fillStyle = isGlass
                ? `rgba(99, 102, 241, ${p.alpha})`
                : `rgba(124, 77, 255, ${p.alpha})`;
            pCtx.fill();
        }

        // Celebration particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.alpha -= p.decay;
            if (p.alpha <= 0) { particles.splice(i, 1); continue; }
            pCtx.beginPath();
            pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            pCtx.fillStyle = p.color;
            pCtx.globalAlpha = p.alpha;
            pCtx.fill();
            pCtx.globalAlpha = 1;
        }

        requestAnimationFrame(animateParticles);
    }

    // ============================
    // SCREEN MANAGEMENT
    // ============================
    function showScreen(id) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[id].classList.add('active');
    }

    function showModal(id) {
        modals[id].classList.add('active');
    }
    function hideModal(id) {
        modals[id].classList.remove('active');
    }

    function showToast(msg) {
        const t = $('#toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2500);
    }

    // ============================
    // SPLASH SCREEN
    // ============================
    function initSplash() {
        const fill = $('.loader-fill');
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15 + 5;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                fill.style.width = '100%';
                setTimeout(() => {
                    if (!saveData.tutorialSeen) {
                        showScreen('tutorial');
                    } else {
                        showScreen('menu');
                    }
                }, 400);
            } else {
                fill.style.width = progress + '%';
            }
        }, 200);
    }

    // ============================
    // TUTORIAL
    // ============================
    let tutSlide = 0;
    const tutSlides = $$('.tutorial-slide');
    const tutDots = $$('.tutorial-dots .dot');

    function updateTutSlide() {
        tutSlides.forEach((s, i) => {
            s.classList.toggle('active', i === tutSlide);
            s.style.transform = i < tutSlide ? 'translateX(-40px)' : i > tutSlide ? 'translateX(40px)' : 'translateX(0)';
        });
        tutDots.forEach((d, i) => d.classList.toggle('active', i === tutSlide));
        $('#btnTutPrev').disabled = tutSlide === 0;
        if (tutSlide === tutSlides.length - 1) {
            $('#btnTutNext').textContent = 'Start Playing ✨';
        } else {
            $('#btnTutNext').textContent = 'Next →';
        }
    }

    $('#btnTutNext').addEventListener('click', () => {
        SFX.click();
        if (tutSlide < tutSlides.length - 1) {
            tutSlide++;
            updateTutSlide();
        } else {
            saveData.tutorialSeen = true;
            save();
            showScreen('menu');
        }
    });

    $('#btnTutPrev').addEventListener('click', () => {
        SFX.click();
        if (tutSlide > 0) { tutSlide--; updateTutSlide(); }
    });

    $('#btnTutSkip').addEventListener('click', () => {
        SFX.click();
        saveData.tutorialSeen = true;
        save();
        showScreen('menu');
    });

    tutDots.forEach(d => d.addEventListener('click', () => {
        tutSlide = parseInt(d.dataset.dot);
        updateTutSlide();
    }));

    // ============================
    // MAIN MENU
    // ============================
    $('#btnSinglePlayer').addEventListener('click', () => {
        SFX.click();
        state.mode = 'single';
        buildLevelGrid();
        showScreen('level');
    });

    $('#btnMultiplayer').addEventListener('click', () => {
        SFX.click();
        state.mode = 'multi';
        showScreen('mpSetup');
    });

    $('#btnHowToPlay').addEventListener('click', () => {
        SFX.click();
        tutSlide = 0;
        updateTutSlide();
        showScreen('tutorial');
    });

    $('#btnAchievements').addEventListener('click', () => {
        SFX.click();
        buildAchievementList();
        showScreen('achieve');
    });

    $('#btnSettings').addEventListener('click', () => {
        SFX.click();
        updateSettingsUI();
        showModal('settings');
    });

    // ============================
    // LEVEL GRID
    // ============================
    function buildLevelGrid() {
        const grid = $('#levelGrid');
        grid.innerHTML = '';
        let totalStars = 0;
        LEVELS.forEach(lvl => {
            const stars = saveData.levelStars[lvl.id] || 0;
            totalStars += stars;
            const unlocked = lvl.id <= saveData.highestLevel;
            const isCurrent = lvl.id === saveData.highestLevel;
            const completed = stars > 0;

            const btn = document.createElement('button');
            btn.className = 'level-btn' +
                (!unlocked ? ' locked' : '') +
                (isCurrent ? ' current' : '') +
                (completed ? ' completed' : '');
            btn.innerHTML = `
                <span class="level-num">${unlocked ? lvl.id : '🔒'}</span>
                <span class="level-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>
                <span class="level-tag">${lvl.label}</span>
            `;
            if (unlocked) {
                btn.addEventListener('click', () => {
                    SFX.click();
                    startSinglePlayer(lvl);
                });
            }
            grid.appendChild(btn);
        });
        $('#levelStarsTotal').textContent = `⭐ ${totalStars} / ${LEVELS.length * 3}`;
    }

    $('#btnLevelBack').addEventListener('click', () => {
        SFX.click();
        showScreen('menu');
    });

    // ============================
    // MULTIPLAYER SETUP
    // ============================
    let mpGridSize = 3;
    let mpTimer = 0;

    $$('.grid-size-btn').forEach(btn => btn.addEventListener('click', () => {
        SFX.click();
        $$('.grid-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mpGridSize = parseInt(btn.dataset.size);
    }));

    $$('.timer-btn').forEach(btn => btn.addEventListener('click', () => {
        SFX.click();
        $$('.timer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mpTimer = parseInt(btn.dataset.time);
    }));

    $('#btnStartMp').addEventListener('click', () => {
        SFX.click();
        state.p1Name = $('#p1Name').value.trim() || 'Player X';
        state.p2Name = $('#p2Name').value.trim() || 'Player O';
        startMultiplayer(mpGridSize, mpTimer);
    });

    $('#btnMpBack').addEventListener('click', () => {
        SFX.click();
        showScreen('menu');
    });

    // ============================
    // START GAME FUNCTIONS
    // ============================
    function startSinglePlayer(level) {
        state.mode = 'single';
        state.level = level;
        state.gridSize = level.grid;
        state.winLen = level.winLen;
        state.aiDifficulty = level.ai;
        state.timerMax = level.timer;
        state.p1Name = 'You';
        state.p2Name = 'AI';
        state.blockedCells = [];

        $('#gameModeLabel').textContent = `Level ${level.id}`;
        $('#gameDiffLabel').textContent = `${capitalize(level.ai)} AI${level.timer ? ` • ${level.timer}s` : ''}`;
        $('#scoreNameX').textContent = 'You (X)';
        $('#scoreNameO').textContent = 'AI (O)';

        // Generate blocked cells
        if (level.blocked > 0) {
            const totalCells = level.grid * level.grid;
            const blocked = [];
            while (blocked.length < level.blocked) {
                const r = Math.floor(Math.random() * totalCells);
                if (!blocked.includes(r)) blocked.push(r);
            }
            state.blockedCells = blocked;
        }

        initGame();
        showScreen('game');
    }

    function startMultiplayer(gridSize, timer) {
        state.mode = 'multi';
        state.level = null;
        state.gridSize = gridSize;
        state.winLen = gridSize >= 4 ? 4 : 3;
        state.aiDifficulty = null;
        state.timerMax = timer;
        state.blockedCells = [];

        $('#gameModeLabel').textContent = 'Multiplayer';
        $('#gameDiffLabel').textContent = `${gridSize}×${gridSize}${timer ? ` • ${timer}s` : ''}`;
        $('#scoreNameX').textContent = state.p1Name + ' (X)';
        $('#scoreNameO').textContent = state.p2Name + ' (O)';

        initGame();
        showScreen('game');
        saveData.mpGames = (saveData.mpGames || 0) + 1;
        save();
        checkAchievement('mp_10', saveData.mpGames >= 10);
    }

    function initGame() {
        const n = state.gridSize;
        state.board = new Array(n * n).fill(null);
        state.currentPlayer = 'X';
        state.gameActive = true;
        state.moveHistory = [];
        state.moveCount = 0;
        state.undoLeft = 1;
        state.hintLeft = 1;
        state.startTime = Date.now();
        state.sessionNoUndo = true;
        state.aiThinking = false;

        buildBoard();
        updateTurnUI();
        updateScoreUI();
        updatePowerupUI();
        updateStreakUI();
        startTimer();

        // Resize win line canvas
        requestAnimationFrame(() => {
            winLineCanvas.width = boardWrapper.offsetWidth;
            winLineCanvas.height = boardWrapper.offsetHeight;
            winCtx.clearRect(0, 0, winLineCanvas.width, winLineCanvas.height);
        });
    }

    // ============================
    // BOARD RENDERING
    // ============================
    function buildBoard() {
        const n = state.gridSize;
        gameBoard.className = `game-board grid-${n}`;
        gameBoard.innerHTML = '';

        for (let i = 0; i < n * n; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;

            if (state.blockedCells.includes(i)) {
                cell.classList.add('blocked');
                state.board[i] = 'BLOCKED';
            }

            cell.addEventListener('click', handleCellClick);
            cell.addEventListener('pointerdown', (e) => {
                if (cell.classList.contains('taken') || cell.classList.contains('blocked')) return;
                // Ripple
                const rect = cell.getBoundingClientRect();
                const rip = document.createElement('span');
                rip.className = 'cell-ripple';
                rip.style.left = (e.clientX - rect.left) + 'px';
                rip.style.top = (e.clientY - rect.top) + 'px';
                cell.appendChild(rip);
                setTimeout(() => rip.remove(), 500);
            });

            gameBoard.appendChild(cell);
        }
    }

    function renderBoard() {
        const cells = $$('.cell');
        cells.forEach((cell, i) => {
            const val = state.board[i];
            if (val === 'X' && !cell.querySelector('.x-mark')) {
                cell.innerHTML = createXSVG();
                cell.classList.add('taken');
            } else if (val === 'O' && !cell.querySelector('.o-mark')) {
                cell.innerHTML = createOSVG();
                cell.classList.add('taken');
            } else if (val === null) {
                cell.innerHTML = '';
                cell.classList.remove('taken', 'win-cell', 'hint-cell');
            }
        });
    }

    function createXSVG() {
        return `<svg class="x-mark" viewBox="0 0 100 100">
            <line x1="20" y1="20" x2="80" y2="80"/>
            <line x1="80" y1="20" x2="20" y2="80"/>
        </svg>`;
    }

    function createOSVG() {
        return `<svg class="o-mark" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="30"/>
        </svg>`;
    }

    // ============================
    // CELL CLICK HANDLER
    // ============================
    function handleCellClick(e) {
        if (!state.gameActive || state.aiThinking) return;

        const idx = parseInt(e.currentTarget.dataset.index);
        if (state.board[idx] !== null) return;

        makeMove(idx);
    }

    function makeMove(idx) {
        state.board[idx] = state.currentPlayer;
        state.moveHistory.push({ index: idx, player: state.currentPlayer });
        state.moveCount++;

        // Play sound
        if (state.currentPlayer === 'X') SFX.placeX(); else SFX.placeO();

        renderBoard();

        // Check win/draw
        const winResult = checkWin(state.board, state.gridSize, state.winLen);
        if (winResult) {
            endGame(winResult.winner, winResult.cells);
            return;
        }
        if (checkDraw()) {
            endGame('draw', []);
            return;
        }

        // Switch turn
        state.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';
        updateTurnUI();
        resetMoveTimer();

        // AI move
        if (state.mode === 'single' && state.currentPlayer === 'O' && state.gameActive) {
            state.aiThinking = true;
            updateTurnUI();
            const delay = state.level && state.level.speed ? 200 : 400 + Math.random() * 400;
            setTimeout(() => {
                if (!state.gameActive) return;
                state.aiThinking = false;
                const aiMove = getAIMove();
                if (aiMove !== -1) {
                    makeMove(aiMove);
                }
            }, delay);
        }
    }

    // ============================
    // WIN / DRAW DETECTION
    // ============================
    function checkWin(board, gridSize, winLen) {
        const n = gridSize;
        const dirs = [
            [0, 1],   // horizontal
            [1, 0],   // vertical
            [1, 1],   // diagonal down-right
            [1, -1],  // diagonal down-left
        ];

        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const val = board[r * n + c];
                if (!val || val === 'BLOCKED') continue;

                for (const [dr, dc] of dirs) {
                    const cells = [];
                    let valid = true;
                    for (let k = 0; k < winLen; k++) {
                        const nr = r + dr * k;
                        const nc = c + dc * k;
                        if (nr < 0 || nr >= n || nc < 0 || nc >= n || board[nr * n + nc] !== val) {
                            valid = false;
                            break;
                        }
                        cells.push(nr * n + nc);
                    }
                    if (valid) {
                        return { winner: val, cells };
                    }
                }
            }
        }
        return null;
    }

    function checkDraw() {
        return state.board.every(c => c !== null);
    }

    // ============================
    // END GAME
    // ============================
    function endGame(result, winCells) {
        state.gameActive = false;
        clearTimer();

        // Highlight win cells
        if (winCells && winCells.length > 0) {
            const cells = $$('.cell');
            winCells.forEach(i => cells[i].classList.add('win-cell'));
            drawWinLine(winCells);
        }

        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);

        // Determine outcome from player perspective
        let outcome; // 'win', 'lose', 'draw'
        if (result === 'draw') {
            outcome = 'draw';
            state.scores.draw++;
            saveData.totalDraws++;
            state.streak = 0;
        } else if (state.mode === 'single') {
            if (result === 'X') {
                outcome = 'win';
                state.scores.X++;
                saveData.totalWins++;
                saveData.streak++;
                if (saveData.streak > saveData.bestStreak) saveData.bestStreak = saveData.streak;
            } else {
                outcome = 'lose';
                state.scores.O++;
                saveData.totalLosses++;
                saveData.streak = 0;
            }
        } else {
            // Multiplayer — just track
            outcome = result === 'X' ? 'win' : 'lose'; // relative to X
            state.scores[result]++;
            saveData.totalWins++;
        }

        saveData.gamesPlayed++;
        updateScoreUI();
        updateStreakUI();

        // Celebrations
        if (outcome === 'win') {
            SFX.win();
            const rect = boardWrapper.getBoundingClientRect();
            spawnCelebrationParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, 60);
        } else if (outcome === 'lose') {
            SFX.lose();
        } else {
            SFX.draw();
        }

        // Achievements & level progress (single player)
        let newAchievement = null;
        if (state.mode === 'single' && outcome === 'win') {
            // Level stars
            if (state.level) {
                let stars = 1;
                if (elapsed <= (state.timerMax || 30)) stars = 2;
                if (state.moveCount <= state.gridSize * state.gridSize / 2 + 2) stars = 3;
                if (stars < 1) stars = 1;

                const prev = saveData.levelStars[state.level.id] || 0;
                if (stars > prev) saveData.levelStars[state.level.id] = stars;

                if (state.level.id >= saveData.highestLevel && state.level.id < LEVELS.length) {
                    saveData.highestLevel = state.level.id + 1;
                }
            }

            // Achievements
            newAchievement = checkAchievement('first_win', saveData.totalWins >= 1);
            if (!newAchievement) newAchievement = checkAchievement('streak_3', saveData.streak >= 3);
            if (!newAchievement) newAchievement = checkAchievement('streak_5', saveData.streak >= 5);
            if (!newAchievement) newAchievement = checkAchievement('streak_10', saveData.streak >= 10);
            if (!newAchievement) newAchievement = checkAchievement('beat_hard', state.aiDifficulty === 'hard');
            if (!newAchievement) newAchievement = checkAchievement('speed_demon', state.timerMax > 0 && elapsed < 10);
            if (!newAchievement) newAchievement = checkAchievement('level_10', saveData.highestLevel >= 10);
            if (!newAchievement) newAchievement = checkAchievement('level_20', saveData.highestLevel > 20);
            if (!newAchievement) newAchievement = checkAchievement('big_board_win', state.gridSize === 5);
            if (!newAchievement) newAchievement = checkAchievement('perfect_game', state.scores.O === 0 && saveData.gamesPlayed > 0);

            if (state.sessionNoUndo) {
                saveData.noUndoWins = (saveData.noUndoWins || 0) + 1;
                if (!newAchievement) newAchievement = checkAchievement('no_undo', saveData.noUndoWins >= 5);
            } else {
                saveData.noUndoWins = 0;
            }
        }

        save();

        // Show result modal
        setTimeout(() => showResultModal(outcome, result, elapsed, newAchievement), 600);
    }

    // ============================
    // RESULT MODAL
    // ============================
    function showResultModal(outcome, winner, elapsed, achievement) {
        const icon = outcome === 'win' ? '🏆' : outcome === 'lose' ? '😔' : '🤝';
        let title, sub;
        if (state.mode === 'single') {
            if (outcome === 'win') { title = 'Victory!'; sub = 'You outsmarted the AI!'; }
            else if (outcome === 'lose') { title = 'Defeated'; sub = 'The AI was too strong this time.'; }
            else { title = "It's a Draw"; sub = 'A close match!'; }
        } else {
            if (winner === 'draw') { title = "It's a Draw"; sub = 'Well played, both!'; }
            else { title = `${winner === 'X' ? state.p1Name : state.p2Name} Wins!`; sub = 'What a game!'; }
        }

        $('#resultIcon').textContent = icon;
        $('#resultTitle').textContent = title;
        $('#resultTitle').className = 'result-title ' + outcome;
        $('#resultSub').textContent = sub;
        $('#rMoves').textContent = state.moveCount;
        $('#rTime').textContent = elapsed + 's';
        $('#rStreak').textContent = saveData.streak;

        // Stars
        const starsEl = $$('.result-stars .star');
        const starCount = state.level ? (saveData.levelStars[state.level.id] || 0) : (outcome === 'win' ? 3 : outcome === 'draw' ? 1 : 0);
        starsEl.forEach((s, i) => {
            s.classList.remove('earned');
            if (i < starCount) {
                setTimeout(() => s.classList.add('earned'), 200 + i * 200);
            }
        });

        // Achievement
        const achEl = $('#resultAchievement');
        if (achievement) {
            achEl.textContent = `🎖️ Achievement Unlocked: ${achievement.name}`;
            setTimeout(() => SFX.achievement(), 600);
        } else {
            achEl.textContent = '';
        }

        // Buttons
        if (state.mode === 'single' && outcome === 'win' && state.level && state.level.id < LEVELS.length) {
            $('#btnNextLevel').style.display = '';
        } else {
            $('#btnNextLevel').style.display = 'none';
        }

        showModal('result');
    }

    $('#btnNextLevel').addEventListener('click', () => {
        SFX.click();
        hideModal('result');
        const nextId = state.level.id + 1;
        if (nextId <= LEVELS.length) {
            startSinglePlayer(LEVELS[nextId - 1]);
        }
    });

    $('#btnReplay').addEventListener('click', () => {
        SFX.click();
        hideModal('result');
        if (state.mode === 'single' && state.level) {
            // Re-randomize blocked cells
            if (state.level.blocked > 0) {
                const totalCells = state.level.grid * state.level.grid;
                const blocked = [];
                while (blocked.length < state.level.blocked) {
                    const r = Math.floor(Math.random() * totalCells);
                    if (!blocked.includes(r)) blocked.push(r);
                }
                state.blockedCells = blocked;
            }
            initGame();
        } else {
            initGame();
        }
    });

    $('#btnResultMenu').addEventListener('click', () => {
        SFX.click();
        hideModal('result');
        clearTimer();
        showScreen('menu');
    });

    // ============================
    // AI SYSTEM
    // ============================
    function getAIMove() {
        const empty = getEmptyCells();
        if (empty.length === 0) return -1;

        switch (state.aiDifficulty) {
            case 'easy': return aiEasy(empty);
            case 'medium': return aiMedium(empty);
            case 'hard': return aiHard(empty);
            default: return aiEasy(empty);
        }
    }

    function getEmptyCells() {
        return state.board
            .map((v, i) => v === null ? i : -1)
            .filter(i => i !== -1);
    }

    // Easy: Random move
    function aiEasy(empty) {
        return empty[Math.floor(Math.random() * empty.length)];
    }

    // Medium: Block/win detection + basic strategy
    function aiMedium(empty) {
        // 1. Win if possible
        const winMove = findWinningMove('O');
        if (winMove !== -1) return winMove;

        // 2. Block opponent
        const blockMove = findWinningMove('X');
        if (blockMove !== -1) return blockMove;

        // 3. Take center if available
        const center = Math.floor(state.gridSize / 2) * state.gridSize + Math.floor(state.gridSize / 2);
        if (state.board[center] === null) return center;

        // 4. Take corners
        const corners = getCorners().filter(i => state.board[i] === null);
        if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];

        // 5. Random
        return aiEasy(empty);
    }

    // Hard: Minimax for 3x3, heuristic for larger boards
    function aiHard(empty) {
        if (state.gridSize === 3 && empty.length <= 9) {
            return minimax(state.board.slice(), 'O', 0, -Infinity, Infinity).move;
        } else {
            // For larger boards, use enhanced heuristic
            return aiHeuristicLarge(empty);
        }
    }

    function findWinningMove(player) {
        const empty = getEmptyCells();
        for (const idx of empty) {
            state.board[idx] = player;
            if (checkWin(state.board, state.gridSize, state.winLen)) {
                state.board[idx] = null;
                return idx;
            }
            state.board[idx] = null;
        }
        return -1;
    }

    function getCorners() {
        const n = state.gridSize;
        return [0, n - 1, (n - 1) * n, n * n - 1];
    }

    // Minimax with alpha-beta pruning
    function minimax(board, player, depth, alpha, beta) {
        const winResult = checkWin(board, state.gridSize, state.winLen);
        if (winResult) {
            return { score: winResult.winner === 'O' ? 10 - depth : depth - 10, move: -1 };
        }
        if (board.every(c => c !== null)) {
            return { score: 0, move: -1 };
        }

        const isMax = player === 'O';
        let bestScore = isMax ? -Infinity : Infinity;
        let bestMove = -1;

        for (let i = 0; i < board.length; i++) {
            if (board[i] !== null) continue;
            board[i] = player;
            const result = minimax(board, player === 'X' ? 'O' : 'X', depth + 1, alpha, beta);
            board[i] = null;

            if (isMax) {
                if (result.score > bestScore) {
                    bestScore = result.score;
                    bestMove = i;
                }
                alpha = Math.max(alpha, bestScore);
            } else {
                if (result.score < bestScore) {
                    bestScore = result.score;
                    bestMove = i;
                }
                beta = Math.min(beta, bestScore);
            }
            if (beta <= alpha) break;
        }

        return { score: bestScore, move: bestMove };
    }

    // Enhanced heuristic for 4x4 and 5x5
    function aiHeuristicLarge(empty) {
        // 1. Win
        const winMove = findWinningMove('O');
        if (winMove !== -1) return winMove;

        // 2. Block
        const blockMove = findWinningMove('X');
        if (blockMove !== -1) return blockMove;

        // 3. Look for best scoring position
        let bestScore = -Infinity;
        let bestMoves = [];

        for (const idx of empty) {
            let score = evaluatePosition(idx, 'O') + evaluatePosition(idx, 'X') * 0.8;
            // Center preference
            const n = state.gridSize;
            const r = Math.floor(idx / n);
            const c = idx % n;
            const centerDist = Math.abs(r - (n - 1) / 2) + Math.abs(c - (n - 1) / 2);
            score += (n - centerDist) * 0.5;

            if (score > bestScore) {
                bestScore = score;
                bestMoves = [idx];
            } else if (score === bestScore) {
                bestMoves.push(idx);
            }
        }

        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    function evaluatePosition(idx, player) {
        const n = state.gridSize;
        const wl = state.winLen;
        const r = Math.floor(idx / n);
        const c = idx % n;
        let score = 0;

        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        const opponent = player === 'X' ? 'O' : 'X';

        for (const [dr, dc] of dirs) {
            // Count in both directions
            let count = 1;
            let openEnds = 0;

            // Forward
            for (let k = 1; k < wl; k++) {
                const nr = r + dr * k, nc = c + dc * k;
                if (nr < 0 || nr >= n || nc < 0 || nc >= n) break;
                const val = state.board[nr * n + nc];
                if (val === player) count++;
                else if (val === null) { openEnds++; break; }
                else break;
            }
            // Backward
            for (let k = 1; k < wl; k++) {
                const nr = r - dr * k, nc = c - dc * k;
                if (nr < 0 || nr >= n || nc < 0 || nc >= n) break;
                const val = state.board[nr * n + nc];
                if (val === player) count++;
                else if (val === null) { openEnds++; break; }
                else break;
            }

            if (count >= wl - 1) score += 10;
            else if (count >= wl - 2 && openEnds >= 1) score += 3;
            else if (count >= 1) score += 1;
        }

        return score;
    }

    // ============================
    // TIMER SYSTEM
    // ============================
    function startTimer() {
        clearTimer();
        if (state.timerMax <= 0) {
            $('#timerRing').classList.remove('visible');
            return;
        }
        state.timer = state.timerMax;
        $('#timerRing').classList.add('visible');
        updateTimerUI();

        state.timerInterval = setInterval(() => {
            if (!state.gameActive) { clearTimer(); return; }
            if (state.aiThinking) return; // Don't count AI time against player

            state.timer--;
            updateTimerUI();

            if (state.timer <= 5 && state.timer > 0) {
                SFX.timerWarn();
            }

            if (state.timer <= 0) {
                // Time's up — auto-lose the turn
                clearTimer();
                if (state.mode === 'single' && state.currentPlayer === 'X') {
                    // Player loses by timeout
                    showToast("⏱️ Time's up!");
                    endGame('O', []);
                } else if (state.mode === 'multi') {
                    // Current player loses
                    showToast("⏱️ Time's up! " + (state.currentPlayer === 'X' ? state.p1Name : state.p2Name) + " ran out of time!");
                    const winner = state.currentPlayer === 'X' ? 'O' : 'X';
                    endGame(winner, []);
                }
            }
        }, 1000);
    }

    function resetMoveTimer() {
        if (state.timerMax <= 0) return;
        state.timer = state.timerMax;
        updateTimerUI();
    }

    function clearTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    function updateTimerUI() {
        const circle = $('#timerCircle');
        const val = $('#timerVal');
        const circumference = 2 * Math.PI * 16; // r=16
        const progress = state.timer / state.timerMax;
        circle.style.strokeDashoffset = circumference * (1 - progress);

        circle.classList.remove('warning', 'danger');
        if (state.timer <= 5) circle.classList.add('danger');
        else if (state.timer <= 10) circle.classList.add('warning');

        val.textContent = state.timer;
    }

    // ============================
    // UI UPDATES
    // ============================
    function updateTurnUI() {
        const marker = $('#turnMarker');
        const text = $('#turnText');
        marker.textContent = state.currentPlayer;
        marker.className = 'turn-marker marker-' + state.currentPlayer.toLowerCase();

        if (state.aiThinking) {
            text.textContent = 'AI Thinking...';
        } else if (state.mode === 'single') {
            text.textContent = state.currentPlayer === 'X' ? 'Your Turn' : 'AI Turn';
        } else {
            text.textContent = (state.currentPlayer === 'X' ? state.p1Name : state.p2Name) + "'s Turn";
        }

        // Active score highlight
        $('#scorePlayerX').classList.toggle('active-turn', state.currentPlayer === 'X');
        $('#scorePlayerO').classList.toggle('active-turn', state.currentPlayer === 'O');
    }

    function updateScoreUI() {
        $('#scoreValX').textContent = state.scores.X;
        $('#scoreValO').textContent = state.scores.O;
        $('#scoreValDraw').textContent = state.scores.draw;
    }

    function updatePowerupUI() {
        $('#undoCount').textContent = state.undoLeft;
        $('#hintCount').textContent = state.hintLeft;
        $('#btnUndo').disabled = state.undoLeft <= 0 || state.moveHistory.length === 0;
        $('#btnHint').disabled = state.hintLeft <= 0;

        // Only enable during player's turn
        if (state.mode === 'single' && state.currentPlayer !== 'X') {
            $('#btnUndo').disabled = true;
            $('#btnHint').disabled = true;
        }
    }

    function updateStreakUI() {
        const bar = $('#streakBar');
        const text = $('#streakText');
        text.textContent = `${saveData.streak} Win Streak`;
        bar.classList.toggle('hot', saveData.streak >= 3);
    }

    // ============================
    // POWER-UPS
    // ============================
    $('#btnUndo').addEventListener('click', () => {
        if (!state.gameActive || state.undoLeft <= 0 || state.aiThinking) return;
        if (state.moveHistory.length === 0) return;

        SFX.click();
        state.sessionNoUndo = false;

        // Undo last move(s) — undo AI move + player move in single player
        if (state.mode === 'single') {
            // Undo AI move if last was AI
            if (state.moveHistory.length > 0 && state.moveHistory[state.moveHistory.length - 1].player === 'O') {
                const aiMove = state.moveHistory.pop();
                state.board[aiMove.index] = null;
                state.moveCount--;
            }
            // Undo player move
            if (state.moveHistory.length > 0 && state.moveHistory[state.moveHistory.length - 1].player === 'X') {
                const playerMove = state.moveHistory.pop();
                state.board[playerMove.index] = null;
                state.moveCount--;
            }
            state.currentPlayer = 'X';
        } else {
            const lastMove = state.moveHistory.pop();
            state.board[lastMove.index] = null;
            state.currentPlayer = lastMove.player;
            state.moveCount--;
        }

        state.undoLeft--;
        renderBoard();
        updateTurnUI();
        updatePowerupUI();
        resetMoveTimer();
        showToast('↩️ Move undone!');
    });

    $('#btnHint').addEventListener('click', () => {
        if (!state.gameActive || state.hintLeft <= 0 || state.aiThinking) return;
        if (state.mode === 'single' && state.currentPlayer !== 'X') return;

        SFX.click();
        state.hintLeft--;
        updatePowerupUI();

        // Find best move for current player
        const empty = getEmptyCells();
        if (empty.length === 0) return;

        let hintIdx;
        // Use AI logic to find best move for the player
        const winMove = findWinningMoveFor('X');
        if (winMove !== -1) {
            hintIdx = winMove;
        } else {
            const blockMove = findWinningMoveFor('O');
            if (blockMove !== -1) {
                hintIdx = blockMove;
            } else {
                const center = Math.floor(state.gridSize / 2) * state.gridSize + Math.floor(state.gridSize / 2);
                if (state.board[center] === null) {
                    hintIdx = center;
                } else {
                    hintIdx = empty[Math.floor(Math.random() * empty.length)];
                }
            }
        }

        // Highlight hint cell
        const cells = $$('.cell');
        cells[hintIdx].classList.add('hint-cell');
        setTimeout(() => cells[hintIdx].classList.remove('hint-cell'), 2000);
        showToast('💡 Hint: Try the highlighted cell!');
    });

    function findWinningMoveFor(player) {
        const empty = getEmptyCells();
        for (const idx of empty) {
            state.board[idx] = player;
            if (checkWin(state.board, state.gridSize, state.winLen)) {
                state.board[idx] = null;
                return idx;
            }
            state.board[idx] = null;
        }
        return -1;
    }

    // ============================
    // WIN LINE ANIMATION
    // ============================
    function drawWinLine(cells) {
        if (cells.length < 2) return;

        const boardRect = gameBoard.getBoundingClientRect();
        const wrapRect = boardWrapper.getBoundingClientRect();
        const n = state.gridSize;

        // Get cell positions
        const cellEls = $$('.cell');
        const firstRect = cellEls[cells[0]].getBoundingClientRect();
        const lastRect = cellEls[cells[cells.length - 1]].getBoundingClientRect();

        const x1 = firstRect.left + firstRect.width / 2 - wrapRect.left;
        const y1 = firstRect.top + firstRect.height / 2 - wrapRect.top;
        const x2 = lastRect.left + lastRect.width / 2 - wrapRect.left;
        const y2 = lastRect.top + lastRect.height / 2 - wrapRect.top;

        // Animate line
        const duration = 400;
        const start = performance.now();

        function animate(now) {
            const progress = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

            winCtx.clearRect(0, 0, winLineCanvas.width, winLineCanvas.height);
            winCtx.beginPath();
            winCtx.moveTo(x1, y1);
            winCtx.lineTo(x1 + (x2 - x1) * ease, y1 + (y2 - y1) * ease);

            const style = getComputedStyle(document.documentElement);
            const winColor = style.getPropertyValue('--color-win').trim() || '#76ff03';

            winCtx.strokeStyle = winColor;
            winCtx.lineWidth = 4;
            winCtx.lineCap = 'round';
            winCtx.shadowColor = winColor;
            winCtx.shadowBlur = 16;
            winCtx.stroke();

            if (progress < 1) requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
    }

    // ============================
    // GAME CONTROLS
    // ============================
    $('#btnRestart').addEventListener('click', () => {
        SFX.click();
        if (state.mode === 'single' && state.level && state.level.blocked > 0) {
            const totalCells = state.level.grid * state.level.grid;
            const blocked = [];
            while (blocked.length < state.level.blocked) {
                const r = Math.floor(Math.random() * totalCells);
                if (!blocked.includes(r)) blocked.push(r);
            }
            state.blockedCells = blocked;
        }
        initGame();
    });

    $('#btnGameBack').addEventListener('click', () => {
        SFX.click();
        clearTimer();
        state.gameActive = false;
        showScreen('menu');
    });

    // ============================
    // SOUND TOGGLES
    // ============================
    function updateSoundBtns() {
        const icon = saveData.sfx ? '🔊' : '🔇';
        $('#btnSoundToggle').textContent = icon;
        $('#btnSoundToggleMenu').textContent = icon;
    }

    function toggleSound() {
        saveData.sfx = !saveData.sfx;
        save();
        updateSoundBtns();
        if (saveData.sfx) SFX.tap();
    }

    $('#btnSoundToggle').addEventListener('click', toggleSound);
    $('#btnSoundToggleMenu').addEventListener('click', toggleSound);

    // ============================
    // THEME SYSTEM
    // ============================
    let currentThemeIdx = 0;
    const themes = ['neon', 'gold', 'glass'];

    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        saveData.theme = theme;
        save();
        $$('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
    }

    $('#btnTheme').addEventListener('click', () => {
        SFX.click();
        currentThemeIdx = (currentThemeIdx + 1) % themes.length;
        applyTheme(themes[currentThemeIdx]);
        showToast(`🎨 Theme: ${capitalize(themes[currentThemeIdx])}`);
    });

    $$('.theme-btn').forEach(btn => btn.addEventListener('click', () => {
        SFX.click();
        applyTheme(btn.dataset.theme);
    }));

    // ============================
    // SETTINGS
    // ============================
    function updateSettingsUI() {
        $('#settingSfx').checked = saveData.sfx;
        $('#settingMusic').checked = saveData.music;
    }

    $('#settingSfx').addEventListener('change', (e) => {
        saveData.sfx = e.target.checked;
        save();
        updateSoundBtns();
    });

    $('#settingMusic').addEventListener('change', (e) => {
        saveData.music = e.target.checked;
        save();
    });

    $('#btnResetProgress').addEventListener('click', () => {
        if (confirm('Reset all progress? This cannot be undone.')) {
            saveData = defaultSave();
            save();
            state.scores = { X: 0, O: 0, draw: 0 };
            hideModal('settings');
            showScreen('menu');
            showToast('🗑️ Progress reset');
        }
    });

    $('#btnCloseSettings').addEventListener('click', () => {
        SFX.click();
        hideModal('settings');
    });

    // Close modals by clicking overlay
    $$('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            overlay.closest('.modal').classList.remove('active');
        });
    });

    // ============================
    // ACHIEVEMENTS
    // ============================
    function checkAchievement(id, condition) {
        if (!condition || saveData.achievements.includes(id)) return null;
        saveData.achievements.push(id);
        save();
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (ach) showToast(`🎖️ ${ach.name}`);
        return ach;
    }

    function buildAchievementList() {
        const list = $('#achieveList');
        list.innerHTML = '';
        ACHIEVEMENTS.forEach(ach => {
            const unlocked = saveData.achievements.includes(ach.id);
            const item = document.createElement('div');
            item.className = 'achieve-item ' + (unlocked ? 'unlocked' : 'locked');
            item.innerHTML = `
                <span class="achieve-icon">${ach.icon}</span>
                <div class="achieve-info">
                    <div class="achieve-name">${ach.name}</div>
                    <div class="achieve-desc">${ach.desc}</div>
                </div>
                <span class="achieve-status">${unlocked ? '✅ Unlocked' : '🔒 Locked'}</span>
            `;
            list.appendChild(item);
        });
    }

    $('#btnAchieveBack').addEventListener('click', () => {
        SFX.click();
        showScreen('menu');
    });

    // ============================
    // RESPONSIVE / RESIZE
    // ============================
    function handleResize() {
        resizeParticleCanvas();
        // Recalculate win line canvas
        if (screens.game.classList.contains('active')) {
            requestAnimationFrame(() => {
                winLineCanvas.width = boardWrapper.offsetWidth;
                winLineCanvas.height = boardWrapper.offsetHeight;
            });
        }
    }

    window.addEventListener('resize', handleResize);

    // ============================
    // UTILITIES
    // ============================
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ============================
    // INITIALIZATION
    // ============================
    function init() {
        resizeParticleCanvas();
        initBgParticles();
        animateParticles();

        // Apply saved theme
        applyTheme(saveData.theme || 'neon');
        currentThemeIdx = themes.indexOf(saveData.theme || 'neon');
        updateSoundBtns();

        // Start splash
        initSplash();
    }

    // Wait for DOM and fonts
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
