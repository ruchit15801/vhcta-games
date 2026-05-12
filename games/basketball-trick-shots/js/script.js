// script.js

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const screenStart = document.getElementById('screen-start');
const screenHud = document.getElementById('screen-hud');
const screenLevelComplete = document.getElementById('screen-level-complete');
const btnStart = document.getElementById('btn-start');
const btnNext = document.getElementById('btn-next');
const btnRetry = document.getElementById('btn-retry');
const btnSound = document.getElementById('btn-sound');
const uiLevel = document.getElementById('ui-level');
const uiScore = document.getElementById('ui-score');
const uiLevelScore = document.getElementById('ui-level-score');
const uiStars = document.getElementById('ui-stars');
const floatingTextContainer = document.getElementById('floating-text-container');
const imgBg = document.getElementById('img-bg');
const imgBall = document.getElementById('img-ball');

// Pause Menu UI Elements
const screenPause = document.getElementById('screen-pause');
const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
const btnMenu = document.getElementById('btn-menu');
// Game State
let width, height;
let state = 'menu'; // menu, playing, flying, over
let currentLevel = 0;
let totalScore = 0;
let levelScore = 0;
let soundEnabled = true;
let isPaused = false;

// Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Game Objects
let ball = {
    x: 0, y: 0, radius: 20, vx: 0, vy: 0, 
    startX: 0, startY: 0,
    isShooting: false, angle: 0, spin: 0, isOut: false, wind: 0,
    trail: []
};

let hoop = {
    x: 0, y: 0, width: 100, height: 10,
    baseY: 0, moving: false, time: 0,
    leftRim: { x: 0, y: 0, radius: 5 },
    rightRim: { x: 0, y: 0, radius: 5 },
    backboard: { x1: 0, y1: 0, x2: 0, y2: 0 }
};

let obstacles = [];
let particles = [];
let netPoints = [];

// Input Drag State
let drag = {
    isDragging: false,
    startX: 0, startY: 0,
    currentX: 0, currentY: 0
};

// Initialization
function init() {
    resize();
    window.addEventListener('resize', resize);
    
    // Event Listeners
    btnStart.addEventListener('click', startGame);
    btnNext.addEventListener('click', loadNextLevel);
    btnRetry.addEventListener('click', () => loadLevel(currentLevel));
    btnSound.addEventListener('click', toggleSound);
    
    btnPause.addEventListener('click', pauseGame);
    btnResume.addEventListener('click', resumeGame);
    btnMenu.addEventListener('click', goToMenu);

    // Canvas Input
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    // Initialize net
    for(let i=0; i<5; i++) {
        netPoints.push({ x: 0, y: 0, vx: 0, vy: 0 });
    }

    requestAnimationFrame(gameLoop);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    // Scale ball based on screen size
    ball.radius = Math.max(15, Math.min(width * 0.03, 30));
    hoop.width = ball.radius * 3.5;
    hoop.leftRim.radius = ball.radius * 0.25;
    hoop.rightRim.radius = ball.radius * 0.25;
    
    if (state === 'playing') {
        loadLevel(currentLevel, false); // Keep state but resize positions
    }
}

// Audio Synthesis for Realistic Sounds without loading files
function playSound(type) {
    if (!soundEnabled || audioCtx.state === 'suspended') return;
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'bounce') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        gainNode.gain.setValueAtTime(1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
        gainNode.gain.setValueAtTime(0.8, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'swish') {
        // White noise burst for swish
        const bufferSize = audioCtx.sampleRate * 0.3; 
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        noise.start(now);
        noise.stop(now + 0.3);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    btnSound.innerText = soundEnabled ? '🔊' : '🔇';
    if(soundEnabled && audioCtx.state === 'suspended') audioCtx.resume();
}

function pauseGame() {
    if (state !== 'playing' && state !== 'flying') return;
    isPaused = true;
    screenPause.classList.remove('hidden');
    // slight delay for transition
    setTimeout(() => screenPause.classList.add('active'), 10);
}

function resumeGame() {
    isPaused = false;
    screenPause.classList.remove('active');
    screenPause.classList.add('hidden');
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function goToMenu() {
    isPaused = false;
    screenPause.classList.remove('active');
    screenPause.classList.add('hidden');
    screenHud.classList.add('hidden');
    screenLevelComplete.classList.remove('active');
    screenLevelComplete.classList.add('hidden');
    screenStart.classList.remove('hidden');
    screenStart.classList.add('active');
    state = 'menu';
}

function startGame() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    screenStart.classList.remove('active');
    screenStart.classList.add('hidden');
    screenHud.classList.remove('hidden');
    currentLevel = 0;
    totalScore = 0;
    uiScore.innerText = totalScore;
    loadLevel(currentLevel);
}

function loadNextLevel() {
    screenLevelComplete.classList.remove('active');
    screenLevelComplete.classList.add('hidden');
    currentLevel++;
    if (currentLevel >= gameLevels.length) currentLevel = 0; // Loop back or show win screen
    loadLevel(currentLevel);
}

function loadLevel(idx, resetScore = true) {
    state = 'playing';
    const lvl = gameLevels[idx];
    uiLevel.innerText = idx + 1;
    
    // Set Ball Pos
    ball.startX = width * 0.2;
    ball.startY = height * 0.7;
    resetBall();
    
    // Set Hoop Pos
    hoop.x = width * lvl.hoop.x;
    hoop.y = height * lvl.hoop.y;
    hoop.baseY = hoop.y;
    hoop.moving = lvl.movingHoop;
    hoop.time = 0;
    
    // Define Backboard relative to hoop
    hoop.backboard = {
        x1: hoop.x + hoop.width/2 + 10, y1: hoop.y - hoop.width,
        x2: hoop.x + hoop.width/2 + 10, y2: hoop.y + 20
    };

    hoop.leftRim.x = hoop.x - hoop.width/2;
    hoop.leftRim.y = hoop.y;
    hoop.rightRim.x = hoop.x + hoop.width/2;
    hoop.rightRim.y = hoop.y;

    // Load Obstacles
    obstacles = lvl.obstacles.map(o => {
        return {
            x: width * o.x,
            y: height * o.y,
            w: width * o.w,
            h: height * o.h
        };
    });

    ball.wind = lvl.wind;
    particles = [];
}

function resetBall() {
    ball.x = ball.startX;
    ball.y = ball.startY;
    ball.vx = 0;
    ball.vy = 0;
    ball.isShooting = false;
    ball.isOut = false;
    ball.trail = [];
    ball.spin = 0;
    ball.passedRim = false;
    drag.isDragging = false;
    state = 'playing';
}

// Input Handling
function getPointerPos(e) {
    if (e.touches) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function handlePointerDown(e) {
    if (state !== 'playing' || isPaused) return;
    const pos = getPointerPos(e);
    
    // Check if clicking near ball
    if (Physics.dist(pos.x, pos.y, ball.x, ball.y) < ball.radius * 3) {
        drag.isDragging = true;
        drag.startX = pos.x;
        drag.startY = pos.y;
        drag.currentX = pos.x;
        drag.currentY = pos.y;
    }
}

function handlePointerMove(e) {
    if (!drag.isDragging) return;
    e.preventDefault(); // prevent scrolling
    const pos = getPointerPos(e);
    drag.currentX = pos.x;
    drag.currentY = pos.y;
}

function handlePointerUp(e) {
    if (!drag.isDragging) return;
    drag.isDragging = false;
    
    let dx = drag.startX - drag.currentX;
    let dy = drag.startY - drag.currentY;
    
    // Only shoot if dragged enough
    if (Math.hypot(dx, dy) > 10) {
        ball.vx = dx * 0.15;
        ball.vy = dy * 0.15;
        ball.spin = (Math.random() - 0.5) * 0.2; // Add random initial spin
        ball.isShooting = true;
        state = 'flying';
    }
}

// Particle System
function spawnParticles(x, y, color, isPerfect) {
    let count = isPerfect ? 60 : 30;
    for (let i=0; i<count; i++) {
        let speed = isPerfect ? (Math.random() * 15) : (Math.random() * 8);
        let angle = Math.random() * Math.PI * 2;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: 0.01 + Math.random() * 0.02,
            color: color,
            size: 2 + Math.random() * 4
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.vy += Physics.gravity * 0.2; // particles fall slightly
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
}

function showFloatingText(text, isPerfect, points) {
    const el = document.createElement('div');
    el.className = `floating-text ${isPerfect ? 'perfect' : ''}`;
    el.innerHTML = `${text}<br><span style="font-size: 0.7em;">+${points}</span>`;
    el.style.left = `${hoop.x}px`;
    el.style.top = `${hoop.y}px`;
    floatingTextContainer.appendChild(el);
    setTimeout(() => { el.remove(); }, 1200);
}

// Drawing Utilities
function drawBallImage(x, y, radius, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Shadow outside the clipping area
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = -5;
    ctx.shadowOffsetY = 10;

    // Draw the actual AI Generated Image but clipped to a circle to hide any white background!
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.closePath();
    
    // Fill slightly so shadow renders if image fails
    ctx.fillStyle = '#e65c00';
    ctx.fill();
    
    ctx.shadowColor = 'transparent'; // Turn off shadow before clipping image

    ctx.clip(); // Mask the image to a perfect circle!

    if (imgBall && imgBall.complete && imgBall.naturalHeight !== 0) {
        // Draw the image slightly larger to avoid pixelated edges
        ctx.drawImage(imgBall, -radius - 1, -radius - 1, (radius * 2) + 2, (radius * 2) + 2);
    }

    ctx.restore();
}

function drawTrajectory() {
    if (!drag.isDragging) return;
    
    let dx = drag.startX - drag.currentX;
    let dy = drag.startY - drag.currentY;
    let vx = dx * 0.15;
    let vy = dy * 0.15;
    
    let simX = ball.x;
    let simY = ball.y;
    
    ctx.beginPath();
    ctx.moveTo(simX, simY);
    for(let i=0; i<20; i++) {
        vy += Physics.gravity;
        vx *= Physics.airResistance;
        vy *= Physics.airResistance;
        simX += vx;
        simY += vy;
        
        ctx.lineTo(simX, simY);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
}

function updateGameLogic() {
    if (state === 'flying') {
        // Record trail
        if(ball.trail.length > 15) ball.trail.shift();
        ball.trail.push({x: ball.x, y: ball.y});

        let event = Physics.updateBall(ball, width, height);
        if (event === 'bounce') playSound('bounce');

        // Wall collisions
        obstacles.forEach(obs => {
            // Treat obstacles as AABB boxes. Create lines for borders
            let lines = [
                {x1: obs.x, y1: obs.y, x2: obs.x + obs.w, y2: obs.y}, // Top
                {x1: obs.x, y1: obs.y+obs.h, x2: obs.x + obs.w, y2: obs.y+obs.h}, // Bottom
                {x1: obs.x, y1: obs.y, x2: obs.x, y2: obs.y+obs.h}, // Left
                {x1: obs.x+obs.w, y1: obs.y, x2: obs.x+obs.w, y2: obs.y+obs.h} // Right
            ];
            lines.forEach(line => {
                if(Physics.circleLineCollide(ball, line)) playSound('hit');
            });
        });

        // Backboard collision
        if(Physics.circleLineCollide(ball, hoop.backboard)) playSound('bounce');

        // Rim collisions
        let hitLeft = Physics.circleCircleCollide(ball, hoop.leftRim);
        let hitRight = Physics.circleCircleCollide(ball, hoop.rightRim);
        if(hitLeft || hitRight) playSound('hit');

        // Check scoring (passing through hoop from top)
        // Check if ball was above hoop previously and is now below hoop level, and between rims
        if (ball.trail.length > 2) {
            let prev = ball.trail[ball.trail.length - 2];
            if (prev.y < hoop.y && ball.y > hoop.y) {
                if (ball.x > hoop.leftRim.x && ball.x < hoop.rightRim.x) {
                    // Scored!
                    handleScore(hitLeft || hitRight);
                }
            }
        }

        if (ball.isOut || (ball.y > height - ball.radius - 1 && Math.abs(ball.vy) < 0.5)) {
            setTimeout(() => resetBall(), 1000);
            state = 'over';
        }
    }
}

function handleScore(hitRim) {
    if (state !== 'flying') return;
    state = 'over'; // Prevent double scoring
    playSound('swish');

    let pts = 100;
    let msg = "SWISH!";
    let isPerfect = !hitRim;

    if (isPerfect) {
        pts = 200;
        msg = "PERFECT!";
        spawnParticles(hoop.x, hoop.y, '#00f0ff', true);
        spawnParticles(hoop.x, hoop.y, '#ff00ff', true); // Extra explosion
    } else {
        spawnParticles(hoop.x, hoop.y + 20, '#ffaa00', false);
    }

    totalScore += pts;
    uiScore.innerText = totalScore;
    uiLevelScore.innerText = pts;
    showFloatingText(msg, isPerfect, pts);

    setTimeout(() => showLevelComplete(isPerfect ? 3 : 2), 1500);
}

function showLevelComplete(stars) {
    uiStars.innerHTML = '';
    for(let i=0; i<3; i++) {
        let s = document.createElement('div');
        s.className = 'star';
        uiStars.appendChild(s);
        if (i < stars) {
            setTimeout(() => s.classList.add('earned'), i * 200 + 100);
        }
    }
    screenLevelComplete.classList.remove('hidden');
    // slight delay for transition
    setTimeout(()=> screenLevelComplete.classList.add('active'), 10);
}

// Main Render Loop
function gameLoop() {
    ctx.clearRect(0, 0, width, height);

    // Draw Background
    if(imgBg.complete && imgBg.naturalHeight !== 0) {
        // Draw image covering screen
        let scale = Math.max(width / imgBg.width, height / imgBg.height);
        let x = (width / 2) - (imgBg.width / 2) * scale;
        let y = (height / 2) - (imgBg.height / 2) * scale;
        ctx.globalAlpha = 0.4; // Darken bg slightly
        ctx.drawImage(imgBg, x, y, imgBg.width * scale, imgBg.height * scale);
        ctx.globalAlpha = 1.0;
    }

    if (!isPaused) {
        if (hoop.moving) {
            hoop.time += hoop.moving.speed;
            hoop.y = hoop.baseY + Math.sin(hoop.time) * (height * hoop.moving.rangeY);
            
            // update backboard and rims
            hoop.backboard.y1 = hoop.y - hoop.width;
            hoop.backboard.y2 = hoop.y + 20;
            hoop.leftRim.y = hoop.y;
            hoop.rightRim.y = hoop.y;
        }

        updateGameLogic();
        updateParticles();
    }

    // Draw Obstacles
    ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
    ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
    ctx.shadowBlur = 10;
    obstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    });
    ctx.shadowBlur = 0;

    // Draw Hoop (Backboard)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hoop.backboard.x1, hoop.backboard.y1);
    ctx.lineTo(hoop.backboard.x2, hoop.backboard.y2);
    ctx.stroke();

    // Draw Red Square on Backboard
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(hoop.backboard.x1 - 25, hoop.y - 40, 25, 30);

    // Draw Net (Simple physics approximation)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    let stretch = 0;
    if(state === 'over' && ball.y > hoop.y && ball.y < hoop.y + 100 && Math.abs(ball.x - hoop.x) < hoop.width/2) {
        stretch = (ball.y - hoop.y) * 0.3; // Net follows ball slightly
    }
    
    ctx.beginPath();
    // V-shape net
    for(let i=0; i<=5; i++) {
        let p = i/5;
        let nx1 = hoop.leftRim.x + (hoop.width * p);
        let nx2 = hoop.x + (stretch * Math.sin(p*Math.PI));
        let ny = hoop.y + 60 + stretch;
        
        ctx.moveTo(nx1, hoop.y);
        ctx.lineTo(hoop.x, ny);
    }
    ctx.stroke();

    // Draw Front Rim
    ctx.fillStyle = '#ff3300';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(hoop.leftRim.x, hoop.leftRim.y, hoop.leftRim.radius, 0, Math.PI*2);
    ctx.arc(hoop.rightRim.x, hoop.rightRim.y, hoop.rightRim.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Connect rims
    ctx.strokeStyle = '#ff3300';
    ctx.lineWidth = hoop.leftRim.radius * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hoop.leftRim.x, hoop.leftRim.y);
    ctx.lineTo(hoop.rightRim.x, hoop.rightRim.y);
    ctx.stroke();

    // Draw Ball Trail
    if (ball.trail.length > 0) {
        ctx.beginPath();
        ctx.moveTo(ball.trail[0].x, ball.trail[0].y);
        for(let i=1; i<ball.trail.length; i++) {
            ctx.lineTo(ball.trail[i].x, ball.trail[i].y);
        }
        ctx.strokeStyle = 'rgba(255, 106, 0, 0.3)';
        ctx.lineWidth = ball.radius;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    // Draw Image Ball with Transparent Clipping
    drawBallImage(ball.x, ball.y, ball.radius, ball.angle);

    drawTrajectory();
    drawParticles();

    requestAnimationFrame(gameLoop);
}

// Start
window.onload = () => {
    // Wait slightly to ensure fonts and images are ready
    setTimeout(init, 100);
};
