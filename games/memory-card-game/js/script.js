/**
 * LUXURY MEMORY CARD GAME CORE ENGINE
 * Implements 20 Levels, Combo System, HTML5 Canvas Particles, Web Audio Synth
 */

// --- 1. Audio Engine ---
class SoundEngine {
    constructor() {
        this.ctx = null;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    playTone(freq, type, duration, vol=0.1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    flip() { this.playTone(350, 'sine', 0.1, 0.05); }
    match() { 
        this.playTone(600, 'sine', 0.1, 0.1); 
        setTimeout(()=>this.playTone(800, 'sine', 0.2, 0.1), 100);
    }
    wrong() { this.playTone(150, 'sawtooth', 0.3, 0.05); }
    win() {
        [400, 500, 600, 800, 1000].forEach((f, i) => {
            setTimeout(() => this.playTone(f, 'square', 0.2, 0.1), i * 100);
        });
    }
}
const sfx = new SoundEngine();

// --- 2. Canvas Particle System (requestAnimationFrame) ---
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

let currentConfig = null;
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (currentConfig) {
        updateCardSize(currentConfig.rows, currentConfig.cols);
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function updateCardSize(rows, cols) {
    if (!rows || !cols) return;
    let gap = window.innerWidth <= 600 ? 8 : 12;
    grid.style.gap = `${gap}px`;
    
    let availableW = window.innerWidth * 0.95 - (cols - 1) * gap;
    let availableH = window.innerHeight - (window.innerWidth <= 600 ? 180 : 200) - (rows - 1) * gap;
    
    let cellW = availableW / cols;
    let cellH = availableH / rows;
    
    let targetW = cellW;
    let targetH = targetW * 1.35; // 3:4 ratio vibe
    
    if (targetH > cellH) {
        targetH = cellH;
        targetW = targetH / 1.35;
    }
    
    targetW = Math.min(targetW, 140);
    targetH = Math.min(targetH, 190);
    
    document.documentElement.style.setProperty('--card-size-w', `${targetW}px`);
    document.documentElement.style.setProperty('--card-size-h', `${targetH}px`);
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // gravity
        this.life -= 0.02;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function spawnParticles(x, y, count, color) {
    const isMobile = window.innerWidth <= 600;
    const finalCount = isMobile ? Math.floor(count / 2) : count;
    for(let i=0; i<finalCount; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for(let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(ctx);
        if(particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
    requestAnimationFrame(animateParticles);
}
animateParticles();

// --- 3. Level Configuration (20 Levels) ---
const LEVELS = [];
for (let i = 1; i <= 20; i++) {
    let rows, cols, timeLimit;
    if (i <= 3) { rows = 2; cols = 2 + (i-1); timeLimit = 60; }
    else if (i <= 7) { rows = 4; cols = 3 + (i-4); timeLimit = 90 - (i*2); }
    else if (i <= 12) { rows = 4; cols = 5; timeLimit = 80 - (i*2); }
    else { rows = 6; cols = 6; timeLimit = 120 - (i*3); }

    LEVELS.push({
        id: i,
        rows: Math.min(rows, 6),
        cols: Math.min(cols, 6),
        timeLimit: Math.max(timeLimit, 30),
        pairs: Math.floor((Math.min(rows, 6) * Math.min(cols, 6)) / 2)
    });
}

// --- 4. Game Logic ---
let currentLevelIndex = 0;
let score = 0;
let combo = 1;
let moves = 0;
let timeRemaining = 0;
let timerInt = null;
let comboInt = null;

let cardsFlipped = [];
let matchedPairs = 0;
let isAnimating = false;

// UI Elements
const uiStart = document.getElementById('start-screen');
const uiGame = document.getElementById('game-container');
const uiHud = document.getElementById('hud');
const uiResult = document.getElementById('result-screen');
const grid = document.getElementById('card-grid');

// HUD Elements
const elLevel = document.getElementById('txt-level');
const elScore = document.getElementById('txt-score');
const elTime = document.getElementById('txt-time');
const elCombo = document.getElementById('txt-combo');
const elComboFill = document.getElementById('combo-fill');

// Init Game Background
document.body.style.backgroundImage = `url('assets/images/background.png')`;
document.body.style.backgroundSize = "cover";

document.getElementById('btn-start').addEventListener('click', () => {
    sfx.init();
    uiStart.classList.remove('active');
    uiStart.classList.add('hidden');
    setTimeout(() => {
        uiHud.classList.remove('hidden');
        uiGame.classList.remove('hidden');
        startLevel(currentLevelIndex);
    }, 400);
});

document.getElementById('btn-next').addEventListener('click', () => {
    uiResult.classList.remove('active');
    uiResult.classList.add('hidden');
    setTimeout(() => {
        if(currentLevelIndex < 19) currentLevelIndex++;
        startLevel(currentLevelIndex);
    }, 400);
});

// --- Power-Ups Logic ---
let isTimerFrozen = false;
let revealCooldown = false;
let freezeCooldown = false;

document.getElementById('btn-reveal').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (revealCooldown || isAnimating) return;
    useRevealPowerUp();
});

document.getElementById('btn-freeze').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (freezeCooldown) return;
    useFreezePowerUp();
});

function useRevealPowerUp() {
    revealCooldown = true;
    const btn = document.getElementById('btn-reveal');
    btn.disabled = true;
    
    // Reveal all cards
    const allCards = document.querySelectorAll('.card:not(.matched)');
    allCards.forEach(c => c.classList.add('flipped'));
    isAnimating = true;

    setTimeout(() => {
        allCards.forEach(c => c.classList.remove('flipped'));
        isAnimating = false;
        // Cooldown 15 sec
        setTimeout(() => { revealCooldown = false; btn.disabled = false; }, 15000);
    }, 2000);
}

function useFreezePowerUp() {
    freezeCooldown = true;
    isTimerFrozen = true;
    const btn = document.getElementById('btn-freeze');
    btn.disabled = true;
    btn.classList.add('active');
    elTime.style.color = '#00f2ff';
    elTime.classList.add('glow-text');

    setTimeout(() => {
        isTimerFrozen = false;
        btn.classList.remove('active');
        elTime.style.color = '#fff';
        elTime.classList.remove('glow-text');
        // Cooldown 20 sec
        setTimeout(() => { freezeCooldown = false; btn.disabled = false; }, 20000);
    }, 5000);
}

function startLevel(index) {
    const config = LEVELS[index];
    cardsFlipped = [];
    matchedPairs = 0;
    isAnimating = false;
    timeRemaining = config.timeLimit;
    combo = 1;
    updateHUD();

    // Reset powerups
    document.getElementById('btn-reveal').disabled = false;
    document.getElementById('btn-freeze').disabled = false;
    revealCooldown = false;
    freezeCooldown = false;
    isTimerFrozen = false;
    elTime.style.color = '#fff';

    clearInterval(timerInt);
    timerInt = setInterval(() => {
        if (!isTimerFrozen) {
            timeRemaining--;
            if (timeRemaining <= 0) {
                timeRemaining = 0;
                gameOver(false);
            }
            updateHUD();
        }
    }, 1000);

    buildGrid(config.rows, config.cols, config.pairs);
}

function updateHUD() {
    elLevel.innerText = LEVELS[currentLevelIndex].id;
    elScore.innerText = score;
    let m = Math.floor(timeRemaining / 60);
    let s = timeRemaining % 60;
    elTime.innerText = `${m}:${s.toString().padStart(2, '0')}`;
    elCombo.innerText = `x${combo}`;
    if (timeRemaining <= 10) elTime.style.color = 'var(--theme-error)';
    else elTime.style.color = '#fff';
}

function resetComboTimer() {
    clearInterval(comboInt);
    elComboFill.style.width = '100%';
    elComboFill.style.transition = 'none';
    
    // Force reflow
    void elComboFill.offsetWidth;
    
    elComboFill.style.transition = 'width 3s linear';
    elComboFill.style.width = '0%';
    
    comboInt = setTimeout(() => {
        combo = 1;
        updateHUD();
    }, 3000);
}

function buildGrid(rows, cols, totalPairs) {
    grid.innerHTML = '';
    currentConfig = { rows, cols };
    
    // Adjust grid CSS dynamically
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    
    // Calculate card size
    updateCardSize(rows, cols);

    let deck = [];
    for(let i=0; i<totalPairs; i++) {
        // We have 9 icons in sprite, hue rotate for extra unique sets
        let iconId = i % 9;
        let hue = Math.floor(i / 9) * 120;
        deck.push({ id: i, icon: iconId, hue: hue });
        deck.push({ id: i, icon: iconId, hue: hue });
    }
    
    // Shuffle
    deck.sort(() => Math.random() - 0.5);

    deck.forEach((cardData, idx) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.id = cardData.id;
        
        const back = document.createElement('div');
        back.className = 'card-face card-back';
        
        const front = document.createElement('div');
        front.className = 'card-face card-front';
        
        // Use sprite mapping (3x3 grid)
        const xp = (cardData.icon % 3) * 50;
        const yp = Math.floor(cardData.icon / 3) * 50;
        
        const iconLayer = document.createElement('div');
        iconLayer.style.width = '70%'; 
        iconLayer.style.aspectRatio = '1 / 1';
        iconLayer.style.backgroundImage = `url('assets/images/cards.png')`;
        iconLayer.style.backgroundSize = "300% 300%";
        iconLayer.style.backgroundPosition = `${xp}% ${yp}%`;
        iconLayer.style.filter = `hue-rotate(${cardData.hue}deg) drop-shadow(0 0 10px rgba(255,255,255,0.4))`;
        
        front.appendChild(iconLayer);

        card.appendChild(back);
        card.appendChild(front);
        
        // Use pointerdown for faster response on mobile
        card.addEventListener('pointerdown', (e) => onCardClick(card, e));
        grid.appendChild(card);
    });
}

function onCardClick(card, e) {
    if (isAnimating || card.classList.contains('flipped') || card.classList.contains('matched')) return;

    sfx.flip();
    card.classList.add('flipped');
    cardsFlipped.push(card);

    if (cardsFlipped.length === 2) {
        moves++;
        isAnimating = true;
        checkMatch(e);
    }
}

function checkMatch(e) {
    const [c1, c2] = cardsFlipped;
    if (c1.dataset.id === c2.dataset.id) {
        // Match
        sfx.match();
        c1.classList.add('matched');
        c2.classList.add('matched');
        
        // Particles
        const rect = c2.getBoundingClientRect();
        spawnParticles(rect.left + rect.width/2, rect.top + rect.height/2, 20, '#00ff88');
        
        // Scoring
        const points = 100 * combo;
        score += points;
        combo++;
        resetComboTimer();
        updateHUD();

        matchedPairs++;
        cardsFlipped = [];
        isAnimating = false;

        if (matchedPairs === LEVELS[currentLevelIndex].pairs) {
            setTimeout(() => gameOver(true), 500);
        }
    } else {
        // Mismatch
        sfx.wrong();
        combo = 1;
        updateHUD();
        c1.classList.add('wrong');
        c2.classList.add('wrong');
        
        setTimeout(() => {
            c1.classList.remove('flipped', 'wrong');
            c2.classList.remove('flipped', 'wrong');
            cardsFlipped = [];
            isAnimating = false;
        }, 800);
    }
}

function gameOver(win) {
    clearInterval(timerInt);
    clearInterval(comboInt);

    if (win) {
        sfx.win();
        spawnParticles(window.innerWidth/2, window.innerHeight/2, 100, '#e6b800');
        spawnParticles(window.innerWidth/4, window.innerHeight/2, 50, '#ff3366');
        spawnParticles(window.innerWidth*0.75, window.innerHeight/2, 50, '#33ccff');
        
        document.getElementById('result-title').innerText = "LEVEL CLEARED";
        document.getElementById('result-title').style.color = "var(--theme-success)";
        document.getElementById('btn-next').innerText = currentLevelIndex < 19 ? "NEXT LEVEL" : "REPLAY MAX LEVEL";
    } else {
        sfx.wrong();
        document.getElementById('result-title').innerText = "TIME UP";
        document.getElementById('result-title').style.color = "var(--theme-error)";
        document.getElementById('btn-next').innerText = "TRY AGAIN";
    }

    document.getElementById('res-score').innerText = score;
    document.getElementById('res-time').innerText = elTime.innerText;
    
    let acc = moves === 0 ? 0 : Math.round((matchedPairs / moves) * 100);
    document.getElementById('res-accuracy').innerText = `${acc}%`;

    // Stars calculation
    let starsStr = "";
    let starsNum = acc >= 80 ? 3 : (acc >= 50 ? 2 : 1);
    if (!win) starsNum = 0;
    
    for(let i=0; i<3; i++) starsStr += i < starsNum ? "⭐" : "★";
    document.getElementById('result-stars').innerText = starsStr;

    uiResult.classList.remove('hidden');
    uiResult.classList.add('active');
}
