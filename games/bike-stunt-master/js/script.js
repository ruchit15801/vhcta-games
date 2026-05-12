/**
 * Bike Stunt Master - UI and Main Script
 */

document.addEventListener('DOMContentLoaded', () => {
    
    const engine = new GameEngine('gameCanvas');
    
    // UI Elements
    const mainMenu = document.getElementById('main-menu');
    const levelMenu = document.getElementById('level-menu');
    const tutorialScreen = document.getElementById('tutorial-screen');
    const endScreen = document.getElementById('end-screen');
    const hud = document.getElementById('hud');
    const mobileControls = document.getElementById('mobile-controls');
    
    const scoreDisplay = document.getElementById('score-display');
    const levelDisplay = document.getElementById('level-display');
    const speedDisplay = document.getElementById('speed-display');
    const comboDisplay = document.getElementById('combo-display');
    const comboText = document.getElementById('combo-text');
    const comboMultiplier = document.getElementById('combo-multiplier');
    
    const endTitle = document.getElementById('end-title');
    const endScore = document.getElementById('end-score');
    const endTime = document.getElementById('end-time');
    
    const btnPlay = document.getElementById('btn-play');
    const btnGarage = document.getElementById('btn-garage');
    const btnBackMain = document.getElementById('btn-back-main');
    const btnStartGame = document.getElementById('btn-start-game');
    const btnRestart = document.getElementById('btn-restart');
    const btnNext = document.getElementById('btn-next');
    const btnMenu = document.getElementById('btn-menu');
    
    const levelGrid = document.getElementById('level-grid');
    
    let maxUnlockedLevel = parseInt(localStorage.getItem('bsm_max_level')) || 1;
    let selectedLevel = 1;
    let startTime = 0;

    // Build Level Grid
    function buildLevelGrid() {
        levelGrid.innerHTML = '';
        for (let i = 1; i <= 40; i++) {
            let btn = document.createElement('button');
            btn.className = 'lvl-btn';
            if (i > maxUnlockedLevel) {
                btn.classList.add('locked');
                btn.innerText = '🔒';
            } else {
                btn.innerText = i;
                btn.addEventListener('click', () => {
                    selectedLevel = i;
                    showScreen(tutorialScreen);
                });
            }
            levelGrid.appendChild(btn);
        }
    }

    // Screen Management
    function hideAllScreens() {
        mainMenu.classList.add('hidden');
        mainMenu.classList.remove('active');
        levelMenu.classList.add('hidden');
        levelMenu.classList.remove('active');
        tutorialScreen.classList.add('hidden');
        tutorialScreen.classList.remove('active');
        endScreen.classList.add('hidden');
        endScreen.classList.remove('active');
        hud.classList.add('hidden');
        mobileControls.classList.add('hidden');
    }

    function showScreen(screen) {
        hideAllScreens();
        screen.classList.remove('hidden');
        // small delay for transition effect
        setTimeout(() => screen.classList.add('active'), 10);
    }

    // Callbacks from Engine
    engine.onUpdateUI = (score, level, speed) => {
        scoreDisplay.innerText = score;
        levelDisplay.innerText = level;
        speedDisplay.innerText = Math.max(0, speed);
    };

    let comboTimeout;
    engine.onStunt = (stuntName, multiplier) => {
        comboText.innerText = stuntName + "!";
        comboMultiplier.innerText = "x" + multiplier;
        comboDisplay.classList.remove('hidden');
        
        // Retrigger animation
        comboDisplay.style.animation = 'none';
        comboDisplay.offsetHeight; /* trigger reflow */
        comboDisplay.style.animation = null; 

        clearTimeout(comboTimeout);
        comboTimeout = setTimeout(() => {
            comboDisplay.classList.add('hidden');
        }, 2000);
    };

    engine.onGameOver = (win, score) => {
        let timePlayed = (performance.now() - startTime) / 1000;
        let mins = Math.floor(timePlayed / 60);
        let secs = Math.floor(timePlayed % 60).toString().padStart(2, '0');
        
        endScore.innerText = score;
        endTime.innerText = `${mins}:${secs}`;
        
        if (win) {
            endTitle.innerText = "LEVEL CLEAR!";
            endTitle.className = "win-title";
            btnNext.classList.remove('hidden');
            
            if (selectedLevel == maxUnlockedLevel && selectedLevel < 40) {
                maxUnlockedLevel++;
                localStorage.setItem('bsm_max_level', maxUnlockedLevel);
            }
        } else {
            endTitle.innerText = "CRASHED!";
            endTitle.className = "crash-title";
            btnNext.classList.add('hidden');
        }
        
        showScreen(endScreen);
        // Save score if needed
    };

    // Event Listeners
    btnPlay.addEventListener('click', () => {
        buildLevelGrid();
        showScreen(levelMenu);
        engine.initAudio();
    });

    btnBackMain.addEventListener('click', () => showScreen(mainMenu));
    
    btnStartGame.addEventListener('click', () => {
        hideAllScreens();
        hud.classList.remove('hidden');
        
        // Show mobile controls if on touch device
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            mobileControls.classList.remove('hidden');
        }
        
        startTime = performance.now();
        engine.loadLevel(selectedLevel);
    });

    btnRestart.addEventListener('click', () => {
        hideAllScreens();
        hud.classList.remove('hidden');
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            mobileControls.classList.remove('hidden');
        }
        startTime = performance.now();
        engine.loadLevel(selectedLevel);
    });

    btnNext.addEventListener('click', () => {
        selectedLevel++;
        hideAllScreens();
        hud.classList.remove('hidden');
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            mobileControls.classList.remove('hidden');
        }
        startTime = performance.now();
        engine.loadLevel(selectedLevel);
    });

    btnMenu.addEventListener('click', () => {
        buildLevelGrid();
        showScreen(levelMenu);
    });

    // Mobile + desktop press bindings for on-screen controls
    function bindTouch(btnId, actionName) {
        const btn = document.getElementById(btnId);
        if(!btn) return;
        
        const startAction = (e) => {
            e.preventDefault();
            engine.inputs[actionName] = true;
        };
        const endAction = (e) => {
            e.preventDefault();
            engine.inputs[actionName] = false;
        };

        btn.addEventListener('touchstart', startAction, {passive: false});
        btn.addEventListener('touchend', endAction, {passive: false});
        btn.addEventListener('touchcancel', endAction, {passive: false});
        btn.addEventListener('mousedown', startAction);
        btn.addEventListener('mouseup', endAction);
        btn.addEventListener('mouseleave', endAction);
        btn.addEventListener('pointerdown', startAction);
        btn.addEventListener('pointerup', endAction);
        btn.addEventListener('pointercancel', endAction);
    }

    bindTouch('btn-accel', 'accel');
    bindTouch('btn-brake', 'brake');
    bindTouch('btn-lean-fwd', 'tiltForward');
    bindTouch('btn-lean-back', 'tiltBack');

    window.addEventListener('blur', () => {
        engine.inputs.accel = false;
        engine.inputs.brake = false;
        engine.inputs.tiltForward = false;
        engine.inputs.tiltBack = false;
    });

    // Start Engine Loop
    engine.start();
});
