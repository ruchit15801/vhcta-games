// Main Game Logic

// Audio Context Setup
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let soundEnabled = true;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!soundEnabled || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'connect') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554, now + 0.1);
            osc.frequency.setValueAtTime(659, now + 0.2);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'win') {
            osc.type = 'square';
            [523, 659, 783, 1046].forEach((freq, i) => {
                osc.frequency.setValueAtTime(freq, now + i * 0.1);
            });
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.8);
            osc.start(now);
            osc.stop(now + 0.8);
        }
    } catch(e) {}
}

// Game State
let currentLevel = parseInt(localStorage.getItem('wcm_level')) || 1;
let coins = parseInt(localStorage.getItem('wcm_coins')) || 100;

let currentWords = [];
let currentGrid = null;
let foundWords = new Set();
let baseLetters = [];

// DOM Elements
const levelDisplay = document.getElementById('level-display');
const coinDisplay = document.getElementById('coin-display');
const boardContainer = document.getElementById('board-container');
const wheelContainer = document.getElementById('wheel-container');
const lettersWrapper = document.getElementById('letters-wrapper');
const swipeLayer = document.getElementById('swipe-layer');
const currentWordDisplay = document.getElementById('current-word');
const toastMsg = document.getElementById('toast-msg');
const bgLayer = document.getElementById('bg-layer');

// Input tracking for drawing
let isSwiping = false;
let selectedLetters = [];
let currentPath = null;
let swipeLinePos = {x: 0, y: 0};

// Initialization
document.getElementById('start-btn').addEventListener('click', () => {
    initAudio();
    playSound('click');
    document.getElementById('instruction-screen').classList.remove('active');
    loadLevel(currentLevel);
});

document.getElementById('next-level-btn').addEventListener('click', () => {
    playSound('click');
    document.getElementById('level-complete').classList.remove('active');
    currentLevel++;
    localStorage.setItem('wcm_level', currentLevel);
    loadLevel(currentLevel);
});

document.getElementById('sound-btn').addEventListener('click', (e) => {
    soundEnabled = !soundEnabled;
    e.target.textContent = soundEnabled ? '🔊' : '🔇';
});

document.getElementById('shuffle-btn').addEventListener('click', () => {
    playSound('click');
    shuffleLetters();
    renderWheel();
});

document.getElementById('hint-btn').addEventListener('click', () => {
    playSound('click');
    giveHint();
});

function updateHUD() {
    levelDisplay.textContent = currentLevel;
    coinDisplay.textContent = coins;
    localStorage.setItem('wcm_coins', coins);
}

function showToast(msg, isErr=false) {
    toastMsg.textContent = msg;
    toastMsg.style.background = isErr ? 'linear-gradient(45deg, #ff416c, #ff4b2b)' : 'linear-gradient(45deg, #11998e, #38ef7d)';
    toastMsg.classList.add('show');
    setTimeout(() => toastMsg.classList.remove('show'), 1500);
}

function loadLevel(num) {
    updateHUD();
    foundWords.clear();
    
    // Change BG every 10 levels
    let bgIndex = (Math.floor((num-1) / 10) % 3) + 1;
    bgLayer.style.backgroundImage = `url('assets/images/bg${bgIndex}.png')`;

    currentWords = getLevelWords(num);
    currentGrid = generateGrid(currentWords);
    
    // Root word is the first/longest one, extract unique letters from ALL words
    let lettersSet = new Set();
    currentWords.forEach(w => {
        for(let char of w) lettersSet.add(char);
    });
    baseLetters = Array.from(lettersSet);
    
    // If somehow letters are less than required root, add them
    let longestWord = currentWords[0].split('');
    longestWord.forEach(c => {
       if(!baseLetters.includes(c)) baseLetters.push(c); 
    });

    shuffleLetters();
    renderBoard();
    renderWheel();
}

function shuffleLetters() {
    for (let i = baseLetters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [baseLetters[i], baseLetters[j]] = [baseLetters[j], baseLetters[i]];
    }
}

function renderBoard() {
    boardContainer.innerHTML = '';
    const boardEl = document.createElement('div');
    boardEl.className = 'crossword-board';
    
    // Calculate cell sizes based on container and grid size
    const pad = 20;
    const cw = boardContainer.clientWidth - pad;
    const ch = boardContainer.clientHeight - pad;
    
    let w = currentGrid.width;
    let h = currentGrid.height;
    
    let cellSize = Math.min(cw / w, ch / h, 50); // max 50px

    boardEl.style.width = `${w * cellSize}px`;
    boardEl.style.height = `${h * cellSize}px`;
    
    currentGrid.board.forEach(cellData => {
        let span = document.createElement('div');
        span.className = 'cell';
        span.id = `cell-${cellData.x}-${cellData.y}`;
        span.style.width = `${cellSize - 4}px`;
        span.style.height = `${cellSize - 4}px`;
        span.style.left = `${(cellData.x + currentGrid.offsetX) * cellSize}px`;
        span.style.top = `${(cellData.y + currentGrid.offsetY) * cellSize}px`;
        span.dataset.char = cellData.char;
        // Keep hidden initially
        boardEl.appendChild(span);
    });
    
    boardContainer.appendChild(boardEl);
}

function renderWheel() {
    lettersWrapper.innerHTML = '';
    const radius = wheelContainer.clientWidth / 2 - 35; // margin for letter UI
    const cx = wheelContainer.clientWidth / 2;
    const cy = wheelContainer.clientHeight / 2;
    
    const count = baseLetters.length;
    const angleStep = (Math.PI * 2) / count;

    baseLetters.forEach((letter, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);

        let btn = document.createElement('div');
        btn.className = 'wheel-letter';
        btn.textContent = letter;
        btn.style.left = `${x}px`;
        btn.style.top = `${y}px`;
        btn.dataset.id = i;
        btn.dataset.char = letter;
        
        lettersWrapper.appendChild(btn);
    });
}

function giveHint() {
    if (coins < 25) {
        showToast("Not enough coins!", true);
        return;
    }
    
    // Find empty cells
    let emptyCells = Array.from(document.querySelectorAll('.cell:not(.found):not(.hinted)'));
    if (emptyCells.length === 0) return;
    
    let randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    randomCell.textContent = randomCell.dataset.char;
    randomCell.classList.add('hinted');
    
    coins -= 25;
    updateHUD();
    playSound('success');
}

// Draw SWIPE logic
function getPoint(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function getLocalPoint(clientX, clientY) {
    const rect = wheelContainer.getBoundingClientRect();
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

// Events wrapper
const EventSetup = () => {
    
    function startSwipe(e) {
        let target = e.target.closest('.wheel-letter');
        if (target) {
            e.preventDefault();
            initAudio();
            isSwiping = true;
            selectedLetters = [target];
            target.classList.add('active');
            playSound('connect');
            updateWordDisplay();
            requestAnimationFrame(drawLines);
        }
    }

    function moveSwipe(e) {
        if (!isSwiping) return;
        e.preventDefault();

        const pt = getPoint(e);
        swipeLinePos = getLocalPoint(pt.x, pt.y);

        // Detect if over another letter
        const elems = document.elementsFromPoint(pt.x, pt.y);
        const letterElem = elems.find(el => el.classList && el.classList.contains('wheel-letter'));

        if (letterElem) {
            // If new letter
            if (!selectedLetters.includes(letterElem)) {
                selectedLetters.push(letterElem);
                letterElem.classList.add('active');
                playSound('connect');
                updateWordDisplay();
            } 
            // If dragging back to previous letter
            else if (selectedLetters.length > 1 && letterElem === selectedLetters[selectedLetters.length - 2]) {
                let removed = selectedLetters.pop();
                removed.classList.remove('active');
                playSound('click');
                updateWordDisplay();
            }
        }
    }

    function endSwipe(e) {
        if (!isSwiping) return;
        isSwiping = false;
        
        // Remove tracking classes securely
        document.querySelectorAll('.wheel-letter').forEach(el => el.classList.remove('active'));
        
        let formedWord = selectedLetters.map(el => el.dataset.char).join('');
        
        if (formedWord.length > 0) {
            checkWord(formedWord);
        }
        
        selectedLetters = [];
        swipeLayer.innerHTML = '';
        currentWordDisplay.textContent = '';
        currentWordDisplay.classList.remove('shake');
    }

    wheelContainer.addEventListener('mousedown', startSwipe);
    document.addEventListener('mousemove', moveSwipe);
    document.addEventListener('mouseup', endSwipe);

    wheelContainer.addEventListener('touchstart', startSwipe, {passive: false});
    document.addEventListener('touchmove', moveSwipe, {passive: false});
    document.addEventListener('touchend', endSwipe);
};

function updateWordDisplay() {
    currentWordDisplay.textContent = selectedLetters.map(el => el.dataset.char).join('');
}

function drawLines() {
    if (!isSwiping) return;
    
    let svgContent = '';
    
    if (selectedLetters.length > 0) {
        for (let i = 0; i < selectedLetters.length - 1; i++) {
            let p1 = getCenter(selectedLetters[i]);
            let p2 = getCenter(selectedLetters[i+1]);
            svgContent += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#f29c1f" stroke-width="12" stroke-linecap="round" opacity="0.8"/>`;
        }
        
        // Line to cursor
        let last = getCenter(selectedLetters[selectedLetters.length - 1]);
        svgContent += `<line x1="${last.x}" y1="${last.y}" x2="${swipeLinePos.x}" y2="${swipeLinePos.y}" stroke="#f29c1f" stroke-width="12" stroke-linecap="round" opacity="0.5"/>`;
    }
    
    swipeLayer.innerHTML = svgContent;
    requestAnimationFrame(drawLines);
}

function getCenter(el) {
    // el is absolute positioned inside wheel container using left/top translate
    return {
        x: parseFloat(el.style.left),
        y: parseFloat(el.style.top)
    };
}

function checkWord(word) {
    if (foundWords.has(word)) {
        showToast("Already Found!", true);
        playSound('error');
        currentWordDisplay.classList.add('shake');
        return;
    }
    
    let wordData = currentGrid.words.find(w => w.word === word);
    if (wordData) {
        // Correct Word!
        foundWords.add(word);
        playSound('success');
        showToast("Awesome!");
        
        // Reveal cells
        wordData.cells.forEach(c => {
            let cellSpan = document.getElementById(`cell-${c.x}-${c.y}`);
            if (cellSpan) {
                cellSpan.textContent = c.char;
                cellSpan.classList.add('found');
                cellSpan.classList.remove('hinted');
            }
        });
        
        // Grant coins based on length
        coins += word.length;
        updateHUD();

        checkLevelComplete();
    } else {
        // Wrong
        playSound('error');
        currentWordDisplay.classList.add('shake');
    }
}

function checkLevelComplete() {
    if (foundWords.size === currentGrid.words.length) {
        setTimeout(() => {
            playSound('win');
            document.getElementById('reward-amount').textContent = currentWords.length * 2;
            coins += currentWords.length * 2;
            updateHUD();
            document.getElementById('level-complete').classList.add('active');
        }, 1000);
    }
}

// Start
EventSetup();
