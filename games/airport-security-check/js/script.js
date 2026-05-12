// ==========================================
// AUDIO SYNTHESIS SYSTEM (Web Audio API)
// ==========================================
class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
    }

    playOscillator(type, freq, duration, vol=0.5, slideFreq=null) {
        if (!this.enabled || this.ctx.state === 'suspended') return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
        }
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playNoise(duration, vol=0.2) {
        if (!this.enabled || this.ctx.state === 'suspended') return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        noise.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }

    playClick() { this.playOscillator('sine', 800, 0.05, 0.3, 1200); }
    playStampApprove() { this.playOscillator('square', 150, 0.2, 0.5, 50); this.playNoise(0.1, 0.5); }
    playStampReject() { this.playOscillator('sawtooth', 100, 0.3, 0.5, 20); this.playNoise(0.15, 0.6); }
    playError() { this.playOscillator('square', 200, 0.3, 0.4, 150); setTimeout(()=>this.playOscillator('square', 200, 0.4, 0.4, 150), 100); }
    playSuccess() { this.playOscillator('sine', 400, 0.1, 0.3, 600); setTimeout(()=>this.playOscillator('sine', 600, 0.2, 0.3, 800), 100); }
    playScanBeam() { this.playNoise(2.0, 0.1); this.playOscillator('triangle', 50, 2.0, 0.2, 100); }
    playAlarm() { 
        this.playOscillator('sawtooth', 800, 0.3, 0.3, 600);
        setTimeout(()=>this.playOscillator('sawtooth', 800, 0.3, 0.3, 600), 400);
        setTimeout(()=>this.playOscillator('sawtooth', 800, 0.3, 0.3, 600), 800);
    }
}

const sfx = new AudioSystem();

// ==========================================
// GAME STATE & CONFIG
// ==========================================
const CONFIG = {
    totalLevels: 40,
    baseQuota: 5,
    maxStrikes: 3,
    levelDuration: 120 // seconds
};

let gameState = {
    level: 1,
    timeRemaining: CONFIG.levelDuration,
    processed: 0,
    quota: CONFIG.baseQuota,
    correct: 0,
    mistakes: 0,
    strikes: 0,
    salary: 0,
    interval: null,
    isPlaying: false
};

const DATES = {
    today: "2026-04-20" 
};

// Vector Shapes for X-Ray
const PATHS = {
    pistol: new Path2D("M0,5 L25,5 L25,15 L10,15 L5,30 L-5,30 Z"),
    knife: new Path2D("M-20,-2 L10,-2 L20,0 L10,2 L-20,2 Z"),
    laptop: new Path2D("M-30,-20 L30,-20 L30,10 L-30,10 Z M-35,10 L35,10 L35,15 L-35,15 Z"),
    bottle: new Path2D("M-5,-20 L5,-20 L5,-10 L10,-5 L10,20 L-10,20 L-10,-5 L-5,-10 Z")
};

const NAMES = ["JOHN SMITH", "MARIA GARCIA", "DAVID CHEN", "SARAH CONNOR", "ALEXEI VOLKOV", "YUKI TANAKA", "FATIMA ALI", "JAMES BOND"];
const COUNTRIES = ["ARSTOTZKA", "UNITED FEDERATION", "REPUBLIA", "KOLECHIA", "IMPOR"];

class Passenger {
    constructor(level) {
        this.isMatch = true;
        this.issues = [];
        this.generateData(level);
    }

    generateData(level) {
        let name = NAMES[Math.floor(Math.random() * NAMES.length)];
        let country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
        let expYear = 2026 + Math.floor(Math.random()*10);
        let dobYear = 1960 + Math.floor(Math.random()*40);
        
        this.realFaceId = 1 + Math.floor(Math.random() * 4); // 1 to 4 files available
        
        this.passport = {
            name: name,
            dob: `${dobYear}-05-12`,
            exp: `${expYear}-11-23`,
            country: country,
            faceId: this.realFaceId
        };

        this.ticket = {
            name: name,
            date: DATES.today,
            flight: "FL-" + Math.floor(Math.random()*1000)
        };
        
        this.bag = {
            hasContraband: false,
            items: this.generateBagItems(level)
        };

        let mismatchChance = 0.2 + (level * 0.02);
        if (Math.random() < mismatchChance) {
            this.createMismatch(level);
        }
    }

    createMismatch(level) {
        this.isMatch = false;
        let p = Math.random();
        
        if (p < 0.2) {
            this.passport.name = "FORGED " + this.passport.name;
            this.issues.push("Name Mismatch");
        } else if (p < 0.4) {
            this.passport.exp = "2025-01-01"; // Expired
            this.issues.push("Passport Expired");
        } else if (p < 0.6) {
            this.ticket.date = "2026-04-21"; // Wrong date
            this.issues.push("Invalid Ticket Date");
        } else if (p < 0.8) {
            // FACE IMPOSTER LOGIC
            let fakeId = (this.realFaceId % 4) + 1; 
            this.passport.faceId = fakeId;
            this.issues.push("Imposter! Face Does Not Match");
        } else {
            this.bag.hasContraband = true;
            let contrabandType = Math.random() > 0.5 ? 'pistol' : 'knife';
            this.bag.items.push({ type: contrabandType, category: 'metal', x: 150 + Math.random()*50, y: 100 + Math.random()*50, r: Math.random()*Math.PI });
            this.issues.push("Contraband Detected in Luggage");
        }
    }

    generateBagItems(level) {
        let items = [];
        let count = 2 + Math.floor(Math.random()*3);
        // Safe items
        for(let i=0; i<count; i++) {
            items.push({
                type: 'clothes', category: 'organic',
                x: 80 + Math.random()*150, y: 60 + Math.random()*100, r: Math.random()*Math.PI*2, scale: 20 + Math.random()*30
            });
        }
        if (Math.random() > 0.3) {
            items.push({
                type: 'laptop', category: 'electronics',
                x: 100 + Math.random()*100, y: 80 + Math.random()*60, r: Math.random()*0.5
            });
        }
        if (Math.random() > 0.5) {
             items.push({
                type: 'bottle', category: 'water',
                x: 80 + Math.random()*150, y: 60 + Math.random()*100, r: Math.random()*Math.PI*2
            });
        }
        return items;
    }
}

// ==========================================
// DOM ELEMENTS
// ==========================================
const screenStart = document.getElementById('screen-start');
const screenTutorial = document.getElementById('screen-tutorial');
const screenGame = document.getElementById('screen-game');
const screenResult = document.getElementById('screen-result');
const screenGameover = document.getElementById('screen-gameover');

const btnPlay = document.getElementById('btn-play');
const btnTutorial = document.getElementById('btn-tutorial');
const btnCloseTutorial = document.getElementById('btn-close-tutorial');
const btnSound = document.getElementById('toggle-sound');
const btnApprove = document.getElementById('btn-approve');
const btnReject = document.getElementById('btn-reject');
const btnScan = document.getElementById('btn-scan');
const btnNext = document.getElementById('btn-next');
const btnNextLevel = document.getElementById('btn-next-level');
const btnRestart = document.getElementById('btn-restart');

const docArea = document.getElementById('doc-area');
const passContainer = document.getElementById('passenger-container');
const scanCanvas = document.getElementById('scanner-canvas');
const scanCtx = scanCanvas.getContext('2d');
const scanLine = document.querySelector('.scan-line');
const scannerStatus = document.getElementById('scanner-status');
const alertBanner = document.getElementById('alert-banner');

let currentPassenger = null;
let scanActive = false;
let docsRendered = [];
let decisionMade = false;

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
    document.body.addEventListener('click', () => {
        if(sfx.ctx.state === 'suspended') sfx.ctx.resume();
    }, {once:true});

    btnPlay.addEventListener('click', () => { sfx.playClick(); startGame(1); });
    btnTutorial.addEventListener('click', () => {
        sfx.playClick();
        screenStart.classList.replace('active', 'hidden');
        screenTutorial.classList.replace('hidden', 'active');
    });
    btnCloseTutorial.addEventListener('click', () => {
        sfx.playClick();
        screenTutorial.classList.replace('active', 'hidden');
        screenStart.classList.replace('hidden', 'active');
    });
    btnSound.addEventListener('change', (e) => { sfx.enabled = e.target.checked; if(sfx.enabled) sfx.playClick(); });
    btnNextLevel.addEventListener('click', () => { sfx.playClick(); startGame(gameState.level + 1); });
    btnRestart.addEventListener('click', () => { sfx.playClick(); startGame(1); });

    btnApprove.addEventListener('click', () => handleDecision(true));
    btnReject.addEventListener('click', () => handleDecision(false));
    btnScan.addEventListener('click', triggerScan);
    btnNext.addEventListener('click', callNextPassenger);
    
    setupDragDrop();
}

function startGame(level) {
    gameState = {
        level: level,
        timeRemaining: Math.max(45, CONFIG.levelDuration - (level * 2)), 
        processed: 0,
        quota: CONFIG.baseQuota + Math.floor(level/2),
        correct: 0,
        mistakes: 0,
        strikes: 0,
        salary: 0,
        interval: null,
        isPlaying: true
    };

    updateHUD();
    
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    screenGame.classList.add('active');
    screenGame.classList.remove('hidden');

    btnScan.disabled = false;
    scannerStatus.textContent = "READY";
    scannerStatus.style.color = "var(--accent)";
    drawEmptyScanner();

    docArea.innerHTML = '<div class="drag-hint">WAITING FOR PASSENGER...</div>';
    passContainer.style.opacity = 0;
    
    startTimer();
    callNextPassenger();
}

function startTimer() {
    clearInterval(gameState.interval);
    gameState.interval = setInterval(() => {
        if(!gameState.isPlaying) return;
        gameState.timeRemaining--;
        updateHUD();
        
        let timeBar = document.getElementById('time-bar-fill');
        let pct = (gameState.timeRemaining / CONFIG.levelDuration) * 100;
        timeBar.style.width = pct + "%";
        
        if(pct < 30) {
            timeBar.className = "fill danger";
            if(gameState.timeRemaining % 2 == 0) sfx.playClick();
        } else if(pct < 60) {
            timeBar.className = "fill warning";
        } else {
            timeBar.className = "fill";
        }

        if(gameState.timeRemaining <= 0) {
            endLevel();
        }
    }, 1000);
}

function updateHUD() {
    document.getElementById('game-time').textContent = formatTime(gameState.timeRemaining);
    document.getElementById('game-quota').textContent = `${gameState.processed}/${gameState.quota}`;
    document.getElementById('game-level').textContent = gameState.level;
    
    let strikesEl = document.getElementById('game-strikes');
    strikesEl.textContent = `${gameState.strikes}/${CONFIG.maxStrikes}`;
    if(gameState.strikes >= 2) strikesEl.className = "strikes danger";
    else if(gameState.strikes == 1) strikesEl.className = "strikes warning";
    else strikesEl.className = "strikes";
}

function formatTime(s) {
    let m = Math.floor(s/60);
    let sec = Math.max(0, Math.floor(s%60));
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
}

function callNextPassenger() {
    if(!gameState.isPlaying) return;
    
    decisionMade = false;
    docArea.innerHTML = '<div class="drag-hint">WAITING FOR PASSENGER...</div>';
    docsRendered = [];
    passContainer.style.opacity = 0;
    btnNext.style.display = "none";
    btnNext.classList.remove("anim-pulse");
    
    drawEmptyScanner();
    scannerStatus.textContent = "READY";
    scannerStatus.className = "scanner-status";
    scannerStatus.style.color = "var(--accent)";
    scanActive = false;

    setTimeout(() => {
        currentPassenger = new Passenger(gameState.level);
        
        passContainer.innerHTML = `
            <div class="passenger-backlight"></div>
            <div class="passenger-figure" style="background-image: url('assets/images/face_${currentPassenger.realFaceId}.png')"></div>
        `;
        passContainer.style.opacity = 1;
        sfx.playClick();
        
        setTimeout(spawnDocuments, 600);
    }, 400);
}

function spawnDocuments() {
    if(!currentPassenger || !gameState.isPlaying) return;
    
    docArea.innerHTML = ''; 

    let p = document.createElement('div');
    p.className = 'document passport-doc anim-drop';
    p.innerHTML = `
        <div class="passport-photo" style="background: url('assets/images/face_${currentPassenger.passport.faceId}.png') center/cover"></div>
        <div class="passport-data">
            <div class="field">NAME</div><div class="val">${currentPassenger.passport.name}</div>
            <div class="field">DOB</div><div class="val">${currentPassenger.passport.dob}</div>
            <div class="field">EXP</div><div class="val" ${currentPassenger.passport.exp < DATES.today ? 'style="color:#ef4444;"' : ''}>${currentPassenger.passport.exp}</div>
            <div class="field">NATION</div><div class="val">${currentPassenger.passport.country}</div>
        </div>
    `;
    
    let t = document.createElement('div');
    t.className = 'document ticket-doc anim-drop';
    t.style.animationDelay = "0.2s";
    t.innerHTML = `
        <div class="ticket-info">
            <div class="ticket-data"><span class="field">PASSENGER:</span> <span class="val">${currentPassenger.ticket.name}</span></div>
            <div class="ticket-data"><span class="field">FLIGHT:</span> <span class="val">${currentPassenger.ticket.flight}</span></div>
            <div class="ticket-data"><span class="field">DATE:</span> <span class="val" ${currentPassenger.ticket.date !== DATES.today ? 'style="color:#ef4444;"' : ''}>${currentPassenger.ticket.date}</span></div>
            <div class="ticket-data" style="margin-top:10px; font-size:1.5rem">ECONOMY</div>
        </div>
    `;
    
    makeDraggable(p);
    makeDraggable(t);
    docArea.appendChild(p);
    docArea.appendChild(t);
    docsRendered.push(p, t);
    
    sfx.playNoise(0.1, 0.3); // papers sound
}

function drawEmptyScanner() {
    scanCanvas.width = scanCanvas.parentElement.clientWidth;
    scanCanvas.height = scanCanvas.parentElement.clientHeight;
    
    scanCtx.fillStyle = '#020617';
    scanCtx.fillRect(0, 0, scanCanvas.width, scanCanvas.height);
    
    scanCtx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    scanCtx.lineWidth = 1;
    for(let i=0; i<scanCanvas.width; i+=30) {
        scanCtx.beginPath(); scanCtx.moveTo(i,0); scanCtx.lineTo(i,scanCanvas.height); scanCtx.stroke();
    }
}

function triggerScan() {
    if(!gameState.isPlaying || !currentPassenger || scanActive || decisionMade) return;
    
    scanActive = true;
    sfx.playScanBeam();
    scanLine.style.display = 'block';
    scannerStatus.textContent = "SCANNING...";
    scannerStatus.style.color = "yellow";
    
    setTimeout(() => {
        scanLine.style.display = 'none';
        renderXRay(currentPassenger.bag);
    }, 1500);
}

function renderXRay(bag) {
    drawEmptyScanner();
    
    scanCtx.save();
    scanCtx.strokeStyle = 'rgba(100,200,255,0.8)';
    scanCtx.lineWidth = 4;
    let bX = 30, bY = 30, bW = scanCanvas.width - 60, bH = scanCanvas.height - 60;
    scanCtx.strokeRect(bX, bY, bW, bH);
    scanCtx.fillStyle = 'rgba(50,100,200,0.2)';
    scanCtx.fillRect(bX, bY, bW, bH);
    
    // UI Label styles
    scanCtx.font = "12px 'Share Tech Mono', monospace";
    scanCtx.textAlign = "center";
    scanCtx.textBaseline = "middle";

    bag.items.forEach(item => {
        scanCtx.save();
        scanCtx.setTransform(1, 0, 0, 1, item.x, item.y);
        scanCtx.rotate(item.r);
        
        scanCtx.globalCompositeOperation = 'screen';
        
        if (item.category === 'organic') {
            scanCtx.fillStyle = 'rgba(255, 120, 30, 0.5)';
            scanCtx.beginPath();
            scanCtx.arc(0, 0, item.scale, 0, Math.PI*2);
            scanCtx.fill();
            
            // Subtle indicator
            scanCtx.setTransform(1, 0, 0, 1, item.x, item.y);
            scanCtx.strokeStyle = 'rgba(255, 120, 30, 0.8)';
            scanCtx.lineWidth = 1;
            scanCtx.strokeRect(-item.scale, -item.scale, item.scale*2, item.scale*2);
            scanCtx.fillText("ORGANIC", 0, -item.scale - 10);
            
        } else if (item.category === 'electronics') {
            scanCtx.fillStyle = 'rgba(30, 150, 255, 0.7)';
            scanCtx.fill(PATHS.laptop);
            
            // Indicator
            scanCtx.setTransform(1, 0, 0, 1, item.x, item.y);
            scanCtx.strokeStyle = 'rgba(30, 150, 255, 0.8)';
            scanCtx.lineWidth = 2;
            scanCtx.strokeRect(-40, -30, 80, 60);
            scanCtx.fillStyle = 'rgba(30, 150, 255, 1)';
            scanCtx.fillText("ELECTRONICS", 0, -40);
        
        } else if (item.category === 'water') {
            scanCtx.fillStyle = 'rgba(30, 150, 255, 0.4)';
            scanCtx.fill(PATHS.bottle);
            
        } else if (item.category === 'metal') {
            scanCtx.globalCompositeOperation = 'source-over';
            scanCtx.fillStyle = 'rgba(0, 255, 100, 0.9)';
            scanCtx.shadowColor = 'rgba(0, 255, 100, 1)';
            scanCtx.shadowBlur = 15;
            scanCtx.fill(PATHS[item.type]);
            
            // RED UI CONTRABAND INDICATOR
            scanCtx.setTransform(1, 0, 0, 1, item.x, item.y);
            scanCtx.strokeStyle = 'rgba(255, 0, 50, 1)';
            scanCtx.lineWidth = 3;
            scanCtx.setLineDash([5, 5]);
            scanCtx.strokeRect(-35, -35, 70, 70);
            scanCtx.setLineDash([]);
            
            // Target corners
            scanCtx.beginPath();
            scanCtx.moveTo(-40,-35); scanCtx.lineTo(-40,-40); scanCtx.lineTo(-35,-40);
            scanCtx.moveTo(40,-35); scanCtx.lineTo(40,-40); scanCtx.lineTo(35,-40);
            scanCtx.moveTo(-40,35); scanCtx.lineTo(-40,40); scanCtx.lineTo(-35,40);
            scanCtx.moveTo(40,35); scanCtx.lineTo(40,40); scanCtx.lineTo(35,40);
            scanCtx.stroke();

            scanCtx.fillStyle = 'rgba(255, 0, 50, 1)';
            scanCtx.shadowBlur = 0;
            // Draw background tag for text
            scanCtx.fillRect(-50, -55, 100, 16);
            scanCtx.fillStyle = 'white';
            scanCtx.fillText(`[${item.type.toUpperCase()}]`, 0, -47);

            scannerStatus.textContent = `ALERT: ${item.type.toUpperCase()} DETECTED!`;
            scannerStatus.className = "scanner-status alert";
            sfx.playAlarm();
        }
        scanCtx.restore();
    });

    scanCtx.restore();
    
    if(!bag.hasContraband) {
        scannerStatus.textContent = "CLEARED - SECURE";
        scannerStatus.className = "scanner-status";
        scannerStatus.style.color = "var(--success)";
        sfx.playSuccess();
    }
}

function handleDecision(approved) {
    if(!currentPassenger || !gameState.isPlaying || decisionMade) return;
    decisionMade = true;
    
    const passport = docsRendered.find(d => d.classList.contains('passport-doc'));
    if(passport) {
        const stamp = document.createElement('div');
        stamp.className = approved ? 'stamp-mark stamp-approved' : 'stamp-mark stamp-denied';
        stamp.innerText = approved ? 'APPROVED' : 'DENIED';
        stamp.style.left = (passport.clientWidth / 2 - 50) + 'px';
        stamp.style.top = (passport.clientHeight / 2 - 20) + 'px';
        stamp.style.opacity = '1';
        passport.appendChild(stamp);
    }
    
    if(approved) sfx.playStampApprove();
    else sfx.playStampReject();

    let wasCorrect = (approved && currentPassenger.isMatch) || (!approved && !currentPassenger.isMatch);
    
    gameState.processed++;
    
    if(wasCorrect) {
        gameState.correct++;
        gameState.salary += 15;
    } else {
        gameState.mistakes++;
        gameState.strikes++;
        issueCitation(currentPassenger.issues.length > 0 ? "Missed Violations: " + currentPassenger.issues.join(", ") : "False Rejection! Passenger was fully clear.");
    }
    
    updateHUD();
    
    setTimeout(() => {
        if(gameState.isPlaying) {
            btnNext.style.display = "block";
            btnNext.classList.add("anim-pulse");
        }
    }, 1000);

    if (gameState.strikes >= CONFIG.maxStrikes) {
        setTimeout(gameOver, 1500);
    } else if (gameState.processed >= gameState.quota) {
        setTimeout(endLevel, 1500);
    }
}

function issueCitation(reason) {
    sfx.playError();
    alertBanner.textContent = `CITATION ISSUED\n${reason}`;
    alertBanner.classList.remove('hidden');
    
    screenGame.classList.add('screen-flash');
    setTimeout(() => screenGame.classList.remove('screen-flash'), 500);

    setTimeout(() => {
        alertBanner.classList.add('hidden');
    }, 4000);
}

function endLevel() {
    if(!gameState.isPlaying) return;
    gameState.isPlaying = false;
    clearInterval(gameState.interval);
    
    document.getElementById('res-processed').textContent = gameState.processed;
    document.getElementById('res-correct').textContent = gameState.correct;
    document.getElementById('res-mistakes').textContent = gameState.mistakes;
    document.getElementById('res-salary').textContent = `$${gameState.salary}`;
    
    document.getElementById('result-title').textContent = `SHIFT ${gameState.level} COMPLETE`;
    
    screenGame.classList.replace('active', 'hidden');
    screenResult.classList.replace('hidden', 'active');
    sfx.playSuccess();
}

function gameOver() {
    gameState.isPlaying = false;
    clearInterval(gameState.interval);
    screenGame.classList.replace('active', 'hidden');
    screenGameover.classList.replace('hidden', 'active');
}

// Drag & Drop
function setupDragDrop() {
    let activeDoc = null;
    let initialX, initialY, currentX, currentY, xOffset = 0, yOffset = 0;

    function dragStart(e) {
        if (!e.target.closest('.document')) return;
        activeDoc = e.target.closest('.document');
        
        docsRendered.forEach(d => d.style.zIndex = 10);
        activeDoc.style.zIndex = 100;

        activeDoc.classList.remove('anim-drop');

        let transform = window.getComputedStyle(activeDoc).getPropertyValue('transform');
        if (transform !== "none") {
            let matrix = new DOMMatrix(transform);
            xOffset = matrix.m41;
            yOffset = matrix.m42;
        } else {
            xOffset = 0; yOffset = 0;
        }

        if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }
    }

    function drag(e) {
        if (activeDoc) {
            e.preventDefault();
            if (e.type === "touchmove") {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }
            activeDoc.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }
    }

    function dragEnd() {
        activeDoc = null;
    }

    docArea.addEventListener('touchstart', dragStart, {passive: false});
    docArea.addEventListener('touchmove', drag, {passive: false});
    docArea.addEventListener('touchend', dragEnd, {passive: false});

    docArea.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
}

function makeDraggable(el) {}

window.onload = init;
