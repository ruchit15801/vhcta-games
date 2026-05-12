// --------------------------------------------------------
// Audio Engine (HTML5 Audio)
// --------------------------------------------------------
const AudioEngine = {
    enabled: true,
    sounds: {},
    
    init() {
        const loadSound = (name, path) => {
            const audio = new Audio(path);
            audio.load();
            this.sounds[name] = audio;
        };
        
        loadSound('click', 'assets/sounds/click.wav');
        loadSound('type', 'assets/sounds/type.wav');
        loadSound('success', 'assets/sounds/success.wav');
        loadSound('error', 'assets/sounds/error.wav');
        loadSound('win', 'assets/sounds/win.wav');
        loadSound('lose', 'assets/sounds/lose.wav');
    },

    play(name) {
        if (!this.enabled || !this.sounds[name]) return;
        // Cloning node allows identical sounds to play overlapping seamlessly
        const soundClone = this.sounds[name].cloneNode();
        soundClone.volume = 0.7;
        soundClone.play().catch(e => console.warn('Audio play blocked until user interact'));
    },

    click() { this.play('click'); },
    type() { this.play('type'); },
    success() { this.play('success'); },
    error() { this.play('error'); },
    levelComplete() { this.play('win'); },
    gameOver() { this.play('lose'); }
};

// --------------------------------------------------------
// Particle & Background Engine (Canvas)
// --------------------------------------------------------
const FXEngine = {
    bgCanvas: document.getElementById('bgCanvas'),
    bgCtx: document.getElementById('bgCanvas').getContext('2d'),
    fxCanvas: document.getElementById('fxCanvas'),
    fxCtx: document.getElementById('fxCanvas').getContext('2d'),
    width: window.innerWidth,
    height: window.innerHeight,
    particles: [],
    bgLines: [],
    hue: 180,

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initBGLines();
        requestAnimationFrame(this.loop.bind(this));
    },

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.bgCanvas.width = this.width;
        this.bgCanvas.height = this.height;
        this.fxCanvas.width = this.width;
        this.fxCanvas.height = this.height;
    },

    initBGLines() {
        this.bgLines = [];
        for (let i = 0; i < 20; i++) {
            this.bgLines.push({
                y: Math.random() * this.height,
                speed: 0.2 + Math.random() * 0.5,
                opacity: 0.05 + Math.random() * 0.1
            });
        }
    },

    createExplosion(x, y, color) {
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                radius: Math.random() * 4 + 1,
                color: color || `hsl(${this.hue}, 100%, 50%)`,
                life: 1,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    },

    createTextPopup(text, x, y, color) {
        this.particles.push({
            isText: true, text: text, x: x, y: y,
            vx: 0, vy: -2, life: 1, decay: 0.015, color: color
        });
    },

    loop() {
        // Draw background
        this.bgCtx.fillStyle = 'rgba(10, 10, 18, 0.2)';
        this.bgCtx.fillRect(0, 0, this.width, this.height);
        
        this.bgCtx.strokeStyle = `hsla(${this.hue}, 100%, 50%, 0.1)`;
        this.bgCtx.lineWidth = 1;
        this.bgLines.forEach(line => {
            line.y += line.speed;
            if (line.y > this.height) line.y = 0;
            this.bgCtx.beginPath();
            this.bgCtx.moveTo(0, line.y);
            this.bgCtx.lineTo(this.width, line.y);
            this.bgCtx.stroke();
        });

        // Draw FX
        this.fxCtx.clearRect(0, 0, this.width, this.height);
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;

            if (p.isText) {
                this.fxCtx.fillStyle = p.color;
                this.fxCtx.globalAlpha = Math.max(0, p.life);
                this.fxCtx.font = "bold 24px Orbitron";
                this.fxCtx.textAlign = "center";
                this.fxCtx.fillText(p.text, p.x, p.y);
                this.fxCtx.globalAlpha = 1;
            } else {
                this.fxCtx.fillStyle = p.color;
                this.fxCtx.globalAlpha = Math.max(0, p.life);
                this.fxCtx.beginPath();
                this.fxCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.fxCtx.fill();
                this.fxCtx.globalAlpha = 1;
            }

            if (p.life <= 0) this.particles.splice(i, 1);
        }

        requestAnimationFrame(this.loop.bind(this));
    }
};

// --------------------------------------------------------
// Sudoku Logic
// --------------------------------------------------------
class SudokuGenerator {
    constructor() {
        this.board = Array(9).fill().map(() => Array(9).fill(0));
        this.solution = Array(9).fill().map(() => Array(9).fill(0));
    }

    generate(emptyCellsCount) {
        this.board = Array(9).fill().map(() => Array(9).fill(0));
        this.fillDiagonal();
        this.fillRemaining(0, 3);
        
        // Save solution
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                this.solution[i][j] = this.board[i][j];
            }
        }

        this.removeDigitsUnique(Math.min(emptyCellsCount, 60)); // Ensure robust uniqueness!
    }

    fillDiagonal() {
        for (let i = 0; i < 9; i += 3) {
            this.fillBox(i, i);
        }
    }

    fillBox(rowStart, colStart) {
        let num;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                do {
                    num = Math.floor(Math.random() * 9) + 1;
                } while (!this.unUsedInBox(rowStart, colStart, num));
                this.board[rowStart + i][colStart + j] = num;
            }
        }
    }

    unUsedInBox(rowStart, colStart, num) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.board[rowStart + i][colStart + j] === num) return false;
            }
        }
        return true;
    }

    unUsedInRow(i, num, boardArray = this.board) {
        for (let j = 0; j < 9; j++) {
            if (boardArray[i][j] === num) return false;
        }
        return true;
    }

    unUsedInCol(j, num, boardArray = this.board) {
        for (let i = 0; i < 9; i++) {
            if (boardArray[i][j] === num) return false;
        }
        return true;
    }

    checkIfSafe(i, j, num) {
        return this.unUsedInRow(i, num) &&
               this.unUsedInCol(j, num) &&
               this.unUsedInBox(i - (i % 3), j - (j % 3), num);
    }

    fillRemaining(i, j) {
        if (j >= 9 && i < 8) { i++; j = 0; }
        if (i >= 9 && j >= 9) return true;
        if (i < 3) { if (j < 3) j = 3; }
        else if (i < 6) { if (j === Math.floor(i / 3) * 3) j += 3; }
        else { if (j === 6) { i++; j = 0; if (i >= 9) return true; } }

        for (let num = 1; num <= 9; num++) {
            if (this.checkIfSafe(i, j, num)) {
                this.board[i][j] = num;
                if (this.fillRemaining(i, j + 1)) return true;
                this.board[i][j] = 0;
            }
        }
        return false;
    }

    removeDigitsUnique(k) {
        let cells = [];
        for(let r=0; r<9; r++) for(let c=0; c<9; c++) cells.push({r,c});
        cells.sort(() => Math.random() - 0.5);

        let removed = 0;
        for(let i=0; i<cells.length; i++) {
            if (removed >= k) break;
            let row = cells[i].r;
            let col = cells[i].c;

            let backup = this.board[row][col];
            this.board[row][col] = 0;

            let copy = this.board.map(r => [...r]);
            let solutions = 0;

            const solve = (b) => {
                if (solutions > 1) return;
                for(let r=0; r<9; r++){
                    for(let c=0; c<9; c++){
                        if(b[r][c] === 0) {
                            for(let n=1; n<=9; n++){
                                if(this.unUsedInRow(r, n, b) && this.unUsedInCol(c, n, b) && this.unUsedInBoxFast(r, c, n, b)) {
                                    b[r][c] = n;
                                    solve(b);
                                    b[r][c] = 0;
                                }
                            }
                            return;
                        }
                    }
                }
                solutions++;
            };

            solve(copy);

            if (solutions !== 1) {
                this.board[row][col] = backup; // multiple solutions found, put back digit
            } else {
                removed++; // Unique solution maintained
            }
        }
    }
    
    unUsedInBoxFast(r, c, num, b) {
        let startRow = r - r % 3;
        let startCol = c - c % 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (b[startRow + i][startCol + j] === num) return false;
            }
        }
        return true;
    }
}

// --------------------------------------------------------
// Main Game Engine
// --------------------------------------------------------
const Game = {
    level: 1,
    score: 0,
    lives: 3,
    time: 0,
    combo: 1,
    hints: 3,
    state: 'MENU', // MENU, PLAYING, PAUSED, GAMEOVER
    sandboxMode: false,
    
    sudoku: new SudokuGenerator(),
    gridData: [], // 9x9 containing cell DOM elements and states
    selectedCell: null,
    timerInterval: null,
    
    init() {
        FXEngine.init();
        this.bindEvents();
        this.showScreen('main-menu');
    },
        
    bindEvents() {
        // Unlock audio on first interaction for strict mobile browsers
        const unlockAudio = () => {
            for (let key in AudioEngine.sounds) {
                const s = AudioEngine.sounds[key];
                s.volume = 0; 
                s.play().catch(e=>{});
                s.pause();
                s.currentTime = 0;
            }
        };
        document.body.addEventListener('touchstart', unlockAudio, {once: true});
        document.body.addEventListener('click', unlockAudio, {once: true});
        
        // Universal button click sound (excludes specific game keys which have custom sounds)
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && 
                !e.target.classList.contains('num-key') && 
                !e.target.classList.contains('action-key') &&
                e.target.id !== 'btn-toggle-sound') {
                AudioEngine.click();
            }
        });

        document.getElementById('btn-start').onclick = () => this.startGame(false);
        document.getElementById('btn-sandbox').onclick = () => this.startGame(true);
        document.getElementById('btn-toggle-sound').onclick = (e) => {
            AudioEngine.enabled = !AudioEngine.enabled;
            e.target.innerText = `Sound: ${AudioEngine.enabled ? 'ON' : 'OFF'}`;
        };
        
        document.getElementById('btn-pause').onclick = () => this.pauseGame();
        document.getElementById('btn-resume').onclick = () => this.resumeGame();
        document.getElementById('btn-restart').onclick = () => this.startGame(this.sandboxMode);
        document.getElementById('btn-quit').onclick = () => { this.resetGame(); this.showScreen('main-menu'); };
        document.getElementById('btn-menu').onclick = () => { this.resetGame(); this.showScreen('main-menu'); };
        document.getElementById('btn-retry').onclick = () => this.startGame(this.sandboxMode);
        document.getElementById('btn-next-level').onclick = () => this.startLevel();

        document.getElementById('btn-erase').onclick = () => this.handleInput(0);
        document.getElementById('btn-hint').onclick = () => this.useHint();
        document.getElementById('btn-solve').onclick = () => this.autoSolve();

        document.querySelectorAll('.num-key').forEach(btn => {
            btn.onclick = (e) => this.handleInput(parseInt(e.target.dataset.val));
        });

        document.addEventListener('keydown', (e) => {
            if (this.state !== 'PLAYING') return;
            if (e.key >= '1' && e.key <= '9') {
                this.handleInput(parseInt(e.key));
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                this.handleInput(0);
            } else if (e.key === 'ArrowUp') this.moveSelection(-1, 0);
            else if (e.key === 'ArrowDown') this.moveSelection(1, 0);
            else if (e.key === 'ArrowLeft') this.moveSelection(0, -1);
            else if (e.key === 'ArrowRight') this.moveSelection(0, 1);
        });

        document.getElementById('btn-tut-skip').onclick = () => {
            document.getElementById('tutorial-overlay').classList.add('hidden');
        };
    },

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },

    updateTheme() {
        // Change colors based on level
        let hueBase = 180; // Level 1 is Cyan
        if (this.level > 3) hueBase = 120; // Green
        if (this.level > 7) hueBase = 45;  // Orange
        if (this.level > 12) hueBase = 300; // Purple
        if (this.level > 17) hueBase = 0;   // Red
        
        FXEngine.hue = hueBase;
        document.documentElement.style.setProperty('--primary-color', `hsl(${hueBase}, 100%, 50%)`);
        document.documentElement.style.setProperty('--grid-border', `hsl(${hueBase}, 100%, 50%)`);
        
        let glow = `0 0 10px hsla(${hueBase}, 100%, 50%, 0.5)`;
        document.documentElement.style.setProperty('--theme-glow', glow);
    },

    startGame(sandbox) {
        this.sandboxMode = sandbox;
        this.level = 1;
        this.score = 0;
        document.getElementById('btn-solve').classList.toggle('hidden', !sandbox);
        this.startLevel();
        this.showScreen('gameplay');
        
        // Show tutorial only on first ever play
        if (!localStorage.getItem('sudoku-tut') && !sandbox) {
            document.getElementById('tutorial-overlay').classList.remove('hidden');
            localStorage.setItem('sudoku-tut', 'done');
        }
    },

    startLevel() {
        this.state = 'PLAYING';
        this.lives = this.sandboxMode ? 99 : 3;
        this.combo = 1;
        this.time = 0;
        this.hints = this.sandboxMode ? 99 : Math.max(1, 4 - Math.floor(this.level/5));
        
        this.updateTheme();
        this.updateHUD();
        
        let emptyCells = 20 + (this.level * 3);
        if (this.sandboxMode) emptyCells = 50;
        this.sudoku.generate(emptyCells);
        this.renderBoard();
        
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.state === 'PLAYING') {
                this.time++;
                this.updateTimer();
            }
        }, 1000);
    },

    resetGame() {
        this.state = 'MENU';
        clearInterval(this.timerInterval);
    },

    pauseGame() {
        if(this.state !== 'PLAYING') return;
        this.state = 'PAUSED';
        this.showScreen('pause-screen');
    },

    resumeGame() {
        this.state = 'PLAYING';
        this.showScreen('gameplay');
    },

    renderBoard() {
        const boardEl = document.getElementById('sudoku-board');
        boardEl.innerHTML = '';
        boardEl.classList.remove('board-anim-shake');
        this.gridData = [];

        for (let r = 0; r < 9; r++) {
            let rowNodes = [];
            for (let c = 0; c < 9; c++) {
                const val = this.sudoku.board[r][c];
                const cell = document.createElement('div');
                cell.className = 'cell';
                if (val !== 0) {
                    cell.innerText = val;
                    cell.classList.add('given');
                }
                
                // Add thick borders for 3x3 grids
                if (c === 2 || c === 5) cell.classList.add('border-right');
                if (r === 2 || r === 5) cell.classList.add('border-bottom');
                
                cell.dataset.r = r;
                cell.dataset.c = c;
                
                cell.onclick = () => this.selectCell(r, c);
                
                boardEl.appendChild(cell);
                rowNodes.push({ el: cell, value: val, isGiven: val !== 0 });
            }
            this.gridData.push(rowNodes);
        }
        this.selectedCell = null;
    },

    selectCell(r, c) {
        if (this.state !== 'PLAYING') return;
        
        // Remove old selection/highlights
        for(let i=0; i<9; i++){
            for(let j=0; j<9; j++){
                this.gridData[i][j].el.classList.remove('selected', 'highlight', 'number-highlight');
            }
        }
        
        this.selectedCell = { r, c };
        this.gridData[r][c].el.classList.add('selected');
        
        // Highlight row, col, box
        let boxR = Math.floor(r / 3) * 3;
        let boxC = Math.floor(c / 3) * 3;
        
        for(let i=0; i<9; i++){
            this.gridData[r][i].el.classList.add('highlight');
            this.gridData[i][c].el.classList.add('highlight');
        }
        for(let i=0; i<3; i++){
            for(let j=0; j<3; j++){
                this.gridData[boxR+i][boxC+j].el.classList.add('highlight');
            }
        }
        
        // Highlight all identical numbers across the board
        let selectedValue = this.gridData[r][c].value;
        if (selectedValue !== 0) {
            for(let i=0; i<9; i++){
                for(let j=0; j<9; j++){
                    if (this.gridData[i][j].value === selectedValue) {
                        this.gridData[i][j].el.classList.add('number-highlight');
                    }
                }
            }
        }

        AudioEngine.click();
    },

    moveSelection(dr, dc) {
        if (!this.selectedCell) {
            this.selectCell(0, 0);
            return;
        }
        let nr = (this.selectedCell.r + dr + 9) % 9;
        let nc = (this.selectedCell.c + dc + 9) % 9;
        this.selectCell(nr, nc);
    },

    handleInput(num) {
        if (this.state !== 'PLAYING' || !this.selectedCell) return;
        const {r, c} = this.selectedCell;
        const cellData = this.gridData[r][c];
        
        if (cellData.isGiven) return; // Cannot edit givens

        if (num === 0) {
            cellData.value = 0;
            cellData.el.innerText = '';
            cellData.el.classList.remove('input', 'error');
            AudioEngine.type();
            return;
        }

        cellData.value = num;
        cellData.el.innerText = num;
        cellData.el.classList.remove('error');
        cellData.el.classList.add('input');

        // Check Correctness
        if (num === this.sudoku.solution[r][c]) {
            // Correct
            AudioEngine.success();
            cellData.el.classList.add('solved-anim');
            setTimeout(() => cellData.el.classList.remove('solved-anim'), 400);
            
            // Score Add
            let points = 10 * this.combo;
            this.score += points;
            this.combo++;
            this.updateHUD();
            
            let rect = cellData.el.getBoundingClientRect();
            FXEngine.createTextPopup(`+${points}`, rect.left + rect.width/2, rect.top, '#00ff66');
            FXEngine.createExplosion(rect.left + rect.width/2, rect.top, '#00ff66');

            this.checkWin();
            this.selectCell(r, c); // Refresh number highlighting
        } else {
            // Wrong
            AudioEngine.error();
            cellData.el.classList.add('error');
            this.lives--;
            this.combo = 1;
            
            // Shake board
            const boardEl = document.getElementById('sudoku-board');
            boardEl.classList.remove('board-anim-shake');
            void boardEl.offsetWidth; // trigger reflow
            boardEl.classList.add('board-anim-shake');
            
            let rect = cellData.el.getBoundingClientRect();
            FXEngine.createTextPopup('WRONG', rect.left + rect.width/2, rect.top, '#ff003c');
            
            this.updateHUD();
            this.selectCell(r, c); // Refresh number highlighting
            if (this.lives <= 0 && !this.sandboxMode) {
                this.gameOver();
            }
        }
    },

    useHint() {
        if (this.state !== 'PLAYING' || this.hints <= 0) return;
        
        let target = null;
        
        // If a cell is selected, and it's either empty or wrong, hit that cell!
        if (this.selectedCell) {
            let r = this.selectedCell.r;
            let c = this.selectedCell.c;
            if (!this.gridData[r][c].isGiven && this.gridData[r][c].value !== this.sudoku.solution[r][c]) {
                target = { r, c };
            }
        }
        
        // If no target identified, grab a random wrong/empty cell
        if (!target) {
            let emptyCells = [];
            for (let i = 0; i < 9; i++) {
                for (let j = 0; j < 9; j++) {
                    if (!this.gridData[i][j].isGiven && this.gridData[i][j].value !== this.sudoku.solution[i][j]) {
                        emptyCells.push({r: i, c: j});
                    }
                }
            }
            if (emptyCells.length === 0) return;
            target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        }
        
        this.hints--;
        
        // Inject solution manually without awarding points
        const cellData = this.gridData[target.r][target.c];
        cellData.value = this.sudoku.solution[target.r][target.c];
        cellData.el.innerText = cellData.value;
        cellData.el.classList.remove('error');
        cellData.el.classList.add('input', 'solved-anim');
        setTimeout(() => cellData.el.classList.remove('solved-anim'), 400);
        AudioEngine.success();
        
        this.updateHUD();
        this.checkWin();
        this.selectCell(target.r, target.c); // refresh highlights to properly show
    },

    autoSolve() {
        if (this.state !== 'PLAYING') return;
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (!this.gridData[i][j].isGiven) {
                    this.gridData[i][j].value = this.sudoku.solution[i][j];
                    this.gridData[i][j].el.innerText = this.sudoku.solution[i][j];
                    this.gridData[i][j].el.classList.add('input', 'solved-anim');
                }
            }
        }
        AudioEngine.levelComplete();
        this.checkWin();
    },

    checkWin() {
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (this.gridData[i][j].value !== this.sudoku.solution[i][j]) return;
            }
        }
        // Win
        this.state = 'LEVEL_COMPLETE';
        clearInterval(this.timerInterval);
        AudioEngine.levelComplete();
        
        // Fireworks
        let interval = setInterval(() => {
            FXEngine.createExplosion(Math.random() * window.innerWidth, Math.random() * window.innerHeight);
        }, 200);
        setTimeout(() => clearInterval(interval), 2000);

        setTimeout(() => {
            document.getElementById('finish-score').innerText = this.score;
            document.getElementById('finish-time').innerText = this.formatTime(this.time);
            document.getElementById('finish-combo').innerText = 'x' + this.combo;
            this.showScreen('level-complete');
            this.level++;
        }, 1500);
    },

    gameOver() {
        this.state = 'GAMEOVER';
        clearInterval(this.timerInterval);
        AudioEngine.gameOver();
        document.getElementById('fail-level').innerText = this.level;
        setTimeout(() => this.showScreen('game-over'), 1000);
    },

    updateHUD() {
        document.getElementById('level-display').innerText = this.level;
        document.getElementById('score-display').innerText = this.score;
        
        const comboEl = document.getElementById('combo-display');
        comboEl.innerText = 'x' + this.combo;
        if (this.combo > 1) {
            comboEl.classList.add('active');
        } else {
            comboEl.classList.remove('active');
        }

        document.getElementById('hint-count').innerText = this.hints;

        if (!this.sandboxMode) {
            let hpContainer = document.getElementById('health-container');
            hpContainer.innerHTML = '';
            for (let i = 0; i < 3; i++) {
                let heart = document.createElement('span');
                heart.className = i < this.lives ? 'heart' : 'heart empty';
                heart.innerText = '❤';
                hpContainer.appendChild(heart);
            }
        } else {
            document.getElementById('health-container').innerHTML = 'SANDBOX';
        }
    },

    updateTimer() {
        document.getElementById('timer-display').innerText = this.formatTime(this.time);
    },

    formatTime(sec) {
        let m = Math.floor(sec / 60).toString().padStart(2, '0');
        let s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }
};

window.onload = () => Game.init();
