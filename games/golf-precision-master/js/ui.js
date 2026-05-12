// js/ui.js
// UI Controller

const UI = {
    elements: {},

    init() {
        this.elements = {
            mainMenu: document.getElementById('main-menu'),
            tutorialMenu: document.getElementById('tutorial-menu'),
            levelComplete: document.getElementById('level-complete'),
            gameOver: document.getElementById('game-over'),
            
            btnStart: document.getElementById('btn-start'),
            btnTutorial: document.getElementById('btn-tutorial'),
            btnCloseTutorial: document.getElementById('btn-close-tutorial'),
            btnNextLevel: document.getElementById('btn-next-level'),
            btnRetry: document.getElementById('btn-retry'),
            
            windIndicator: document.getElementById('wind-arrow'),
            windSpeed: document.getElementById('wind-speed'),
            levelDisplay: document.getElementById('level-display'),
            parDisplay: document.getElementById('par-display'),
            scoreDisplay: document.getElementById('score-display'),
            
            powerContainer: document.getElementById('power-meter-container'),
            powerFill: document.getElementById('power-meter-fill'),
            powerCursor: document.getElementById('power-meter-cursor'),
            
            spinContainer: document.getElementById('spin-control-container'),
            spinCursor: document.getElementById('spin-cursor'),
            spinBall: document.getElementById('spin-ball'),
            
            resultTitle: document.getElementById('result-title'),
            resultStrokes: document.getElementById('result-strokes'),
            resultPar: document.getElementById('result-par'),
            resultScore: document.getElementById('result-score')
        };
    },

    showMenu(menuName) {
        // Hide all
        this.elements.mainMenu.classList.add('hidden');
        this.elements.tutorialMenu.classList.add('hidden');
        this.elements.levelComplete.classList.add('hidden');
        this.elements.gameOver.classList.add('hidden');
        
        if (menuName && this.elements[menuName]) {
            this.elements[menuName].classList.remove('hidden');
        }
    },

    updateHUD(levelNum, par, strokes, wind) {
        this.elements.levelDisplay.innerText = levelNum;
        this.elements.parDisplay.innerText = par;
        this.elements.scoreDisplay.innerText = strokes;
        
        this.elements.windSpeed.innerText = wind.speed;
        this.elements.windIndicator.style.transform = `rotate(${wind.angle}rad)`;
    },

    setPowerUIActive(active) {
        if (active) {
            this.elements.powerContainer.classList.remove('hidden');
            this.elements.spinContainer.classList.remove('hidden');
        } else {
            this.elements.powerContainer.classList.add('hidden');
            this.elements.spinContainer.classList.add('hidden');
        }
    },

    updatePower(pullDistance, maxPull) {
        // Map pull distance to 0-100%
        let pct = Math.min(100, Math.max(0, (pullDistance / maxPull) * 100));
        this.elements.powerCursor.style.left = `${pct}%`;
    },
    
    updateSpin(spinX, spinY) {
        // Map spin -1 to 1 to percentages 0 to 100
        let px = 50 + (spinX * 50);
        let py = 50 + (spinY * 50);
        this.elements.spinCursor.style.left = `${px}%`;
        this.elements.spinCursor.style.top = `${py}%`;
    },

    showLevelComplete(strokes, par) {
        let score = strokes - par;
        let title = "HOLE IN ONE!";
        
        if (strokes === 1) {
            title = "HOLE IN ONE!";
        } else if (score <= -3) {
            title = "ALBATROSS";
        } else if (score === -2) {
            title = "EAGLE";
        } else if (score === -1) {
            title = "BIRDIE";
        } else if (score === 0) {
            title = "PAR";
        } else if (score === 1) {
            title = "BOGEY";
        } else if (score === 2) {
            title = "DOUBLE BOGEY";
        } else {
            title = `+${score}`;
        }
        
        this.elements.resultTitle.innerText = title;
        this.elements.resultStrokes.innerText = strokes;
        this.elements.resultPar.innerText = par;
        this.elements.resultScore.innerText = score > 0 ? `+${score}` : score;
        
        this.showMenu('levelComplete');
    }
};
