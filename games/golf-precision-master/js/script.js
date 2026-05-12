// js/script.js
// Main Game Engine

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let cx, cy; // Center of screen

// Game State
const GAME_STATE = {
    MENU: 0,
    AIMING: 1,
    POWERING: 2,
    IN_FLIGHT: 3,
    ROLLING: 4,
    HOLE_IN: 5,
    OUT_OF_BOUNDS: 6
};

let currentState = GAME_STATE.MENU;

// Game Data
let currentLevelNum = 1;
let currentLevel = null;
let strokes = 0;

// Camera
let camera = { x: 0, y: 0, zoom: 1, angle: 0 };
let targetCamera = { x: 0, y: 0, zoom: 1, angle: 0 };

// Ball
let ball = {
    pos: new Vector3(0, 0, 0),
    vel: new Vector3(0, 0, 0),
    spin: new Vector3(0, 0, 0),
    state: 'idle', // idle, in_air, rolling, water, hole_in
    radius: 4
};

// Physics
const physics = new PhysicsEngine();

// Input
const input = {
    isDown: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    spinX: 0,
    spinY: 0
};

// Particles
let particles = [];

// Initialization
function init() {
    resize();
    window.addEventListener('resize', resize);
    
    UI.init();
    bindEvents();
    
    // Start Loop
    requestAnimationFrame(loop);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    cx = width / 2;
    cy = height / 2;
}

function bindEvents() {
    UI.elements.btnStart.addEventListener('click', () => {
        AudioEngine.init();
        AudioEngine.resume();
        startLevel(1);
    });
    
    UI.elements.btnTutorial.addEventListener('click', () => {
        UI.showMenu('tutorialMenu');
    });
    
    UI.elements.btnCloseTutorial.addEventListener('click', () => {
        UI.showMenu('mainMenu');
    });
    
    UI.elements.btnNextLevel.addEventListener('click', () => {
        startLevel(currentLevelNum + 1);
    });
    
    UI.elements.btnRetry.addEventListener('click', () => {
        startLevel(currentLevelNum);
    });

    // Touch / Mouse Events on Canvas
    canvas.addEventListener('mousedown', pointerDown);
    canvas.addEventListener('mousemove', pointerMove);
    window.addEventListener('mouseup', pointerUp);
    
    canvas.addEventListener('touchstart', (e) => pointerDown(e.touches[0]), {passive: false});
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); pointerMove(e.touches[0]); }, {passive: false});
    window.addEventListener('touchend', pointerUp);
    
    // Spin Control Events
    const spinBall = document.getElementById('spin-ball');
    
    const handleSpin = (e) => {
        if(currentState !== GAME_STATE.AIMING && currentState !== GAME_STATE.POWERING) return;
        const rect = spinBall.getBoundingClientRect();
        let clientX = e.clientX || (e.touches && e.touches[0].clientX);
        let clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (clientX === undefined) return;
        
        let x = clientX - rect.left - rect.width/2;
        let y = clientY - rect.top - rect.height/2;
        
        // Normalize -1 to 1
        x = Math.max(-1, Math.min(1, x / (rect.width/2)));
        y = Math.max(-1, Math.min(1, y / (rect.height/2)));
        
        // Circular clamp
        let dist = Math.sqrt(x*x + y*y);
        if(dist > 1) {
            x /= dist;
            y /= dist;
        }
        
        input.spinX = x;
        input.spinY = y;
        UI.updateSpin(x, y);
    };

    spinBall.addEventListener('mousedown', (e) => { e.stopPropagation(); handleSpin(e); });
    spinBall.addEventListener('mousemove', (e) => { if(e.buttons > 0) { e.stopPropagation(); handleSpin(e); }});
    
    spinBall.addEventListener('touchstart', (e) => { e.stopPropagation(); handleSpin(e.touches[0]); }, {passive: false});
    spinBall.addEventListener('touchmove', (e) => { e.stopPropagation(); e.preventDefault(); handleSpin(e.touches[0]); }, {passive: false});
}

function startLevel(num) {
    currentLevelNum = num;
    strokes = 0;
    currentLevel = LevelGenerator.generate(num);
    
    ball.pos = new Vector3(currentLevel.startPos.x, currentLevel.startPos.y, 0);
    ball.vel = new Vector3(0, 0, 0);
    ball.spin = new Vector3(0, 0, 0);
    ball.state = 'idle';
    
    // Auto aim at hole
    let dx = currentLevel.holePos.x - ball.pos.x;
    let dy = currentLevel.holePos.y - ball.pos.y;
    camera.angle = Math.atan2(dy, dx);
    targetCamera.angle = camera.angle;
    
    input.spinX = 0;
    input.spinY = 0;
    UI.updateSpin(0,0);
    
    setState(GAME_STATE.AIMING);
    UI.updateHUD(currentLevel.number, currentLevel.par, strokes, currentLevel.wind);
    
    particles = [];
}

function setState(state) {
    currentState = state;
    if (state === GAME_STATE.AIMING) {
        UI.showMenu(null);
        UI.setPowerUIActive(true);
        UI.updatePower(0, 100);
        targetCamera.x = ball.pos.x;
        targetCamera.y = ball.pos.y;
        targetCamera.zoom = 1;
    } else if (state === GAME_STATE.POWERING) {
        // Handled dynamically
    } else if (state === GAME_STATE.IN_FLIGHT || state === GAME_STATE.ROLLING) {
        UI.setPowerUIActive(false);
    } else if (state === GAME_STATE.HOLE_IN) {
        AudioEngine.playHoleIn();
        createConfetti();
        setTimeout(() => UI.showLevelComplete(strokes, currentLevel.par), 2000);
    } else if (state === GAME_STATE.OUT_OF_BOUNDS) {
        setTimeout(() => UI.showMenu('gameOver'), 1000);
    }
}

// Input Handlers
function pointerDown(e) {
    if (currentState !== GAME_STATE.AIMING) return;
    
    input.isDown = true;
    input.startX = e.clientX;
    input.startY = e.clientY;
    input.currentX = e.clientX;
    input.currentY = e.clientY;
}

function pointerMove(e) {
    if (!input.isDown) return;
    
    input.currentX = e.clientX;
    input.currentY = e.clientY;
    
    let dy = input.currentY - input.startY;
    let dx = input.currentX - input.startX;
    
    if (currentState === GAME_STATE.AIMING) {
        // If pulled down, switch to powering
        if (dy > 20 && Math.abs(dy) > Math.abs(dx)) {
            setState(GAME_STATE.POWERING);
        } else {
            // Drag left/right to aim
            targetCamera.angle -= dx * 0.005;
            input.startX = input.currentX; // reset start to prevent compounding
        }
    } else if (currentState === GAME_STATE.POWERING) {
        let pull = Math.max(0, dy);
        UI.updatePower(pull, 300);
    }
}

function pointerUp(e) {
    if (!input.isDown) return;
    input.isDown = false;
    
    if (currentState === GAME_STATE.POWERING) {
        let dy = input.currentY - input.startY;
        let pull = Math.max(0, dy);
        
        if (pull > 20) {
            shoot(pull);
        } else {
            setState(GAME_STATE.AIMING);
            UI.updatePower(0, 300);
        }
    }
}

function shoot(pullDistance) {
    strokes++;
    UI.updateHUD(currentLevel.number, currentLevel.par, strokes, currentLevel.wind);
    
    // Max pull is around 300px
    let power = Math.min(1.0, pullDistance / 300);
    
    // Base velocity magnitude
    let mag = power * 35; // max velocity
    
    // Add club arch/lift
    ball.vel.x = Math.cos(camera.angle) * mag;
    ball.vel.y = Math.sin(camera.angle) * mag;
    ball.vel.z = power * 20 + 5; // upward force
    
    // Apply spin setup
    ball.spin.x = input.spinX * 5; // Side spin
    ball.spin.y = -input.spinY * 5; // Top/back spin (inverted Y)
    
    ball.state = 'in_air';
    
    AudioEngine.playHit(power);
    createHitParticles();
    
    setState(GAME_STATE.IN_FLIGHT);
}

// Game Loop
let lastTime = 0;
function loop(timestamp) {
    let dt = (timestamp - lastTime) / 16.66; // Normalized to 60FPS
    if (dt > 3) dt = 3; // Clamp dt to avoid huge jumps if tab inactive
    lastTime = timestamp;
    
    if (currentLevel && (currentState === GAME_STATE.IN_FLIGHT || currentState === GAME_STATE.ROLLING)) {
        updatePhysics(dt);
    }
    
    updateCamera();
    updateParticles();
    render();
    
    requestAnimationFrame(loop);
}

function getTerrainAt(x, y) {
    // Check hole
    let distToHole = Math.hypot(x - currentLevel.holePos.x, y - currentLevel.holePos.y);
    if (distToHole < 10) return 'hole';
    
    // Check green
    if (distToHole < currentLevel.greenRadius) return 'green';
    
    // Check hazards
    for (let h of currentLevel.hazards) {
        let dist = Math.hypot(x - h.x, y - h.y);
        if (dist < h.radius) return h.type;
    }
    
    // Define fairway boundaries (simple line thickness from start to hole)
    // We use distance from line segment
    let A = x - currentLevel.startPos.x;
    let B = y - currentLevel.startPos.y;
    let C = currentLevel.holePos.x - currentLevel.startPos.x;
    let D = currentLevel.holePos.y - currentLevel.startPos.y;

    let dot = A * C + B * D;
    let len_sq = C * C + D * D;
    let param = -1;
    if (len_sq != 0) //in case of 0 length line
        param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
        xx = currentLevel.startPos.x;
        yy = currentLevel.startPos.y;
    }
    else if (param > 1) {
        xx = currentLevel.holePos.x;
        yy = currentLevel.holePos.y;
    }
    else {
        xx = currentLevel.startPos.x + param * C;
        yy = currentLevel.startPos.y + param * D;
    }

    let dx = x - xx;
    let dy = y - yy;
    let distFromCenterline = Math.sqrt(dx * dx + dy * dy);

    // Fairway width
    if (distFromCenterline < 150) return 'fairway';
    if (distFromCenterline < 250) return 'rough';
    
    // Default to rough if far away
    return 'rough';
}

function updatePhysics(dt) {
    // Wind vector
    let windVec = {
        x: Math.cos(currentLevel.wind.angle) * currentLevel.wind.speed,
        y: Math.sin(currentLevel.wind.angle) * currentLevel.wind.speed
    };
    
    physics.update(ball, dt, windVec, getTerrainAt);
    
    // Check Hole in
    let distToHole = Math.hypot(ball.pos.x - currentLevel.holePos.x, ball.pos.y - currentLevel.holePos.y);
    if (distToHole < 15 && ball.pos.z < 5 && ball.vel.mag() < 15) {
        ball.state = 'hole_in';
        ball.pos.x = currentLevel.holePos.x;
        ball.pos.y = currentLevel.holePos.y;
        ball.vel.mult(0);
        setState(GAME_STATE.HOLE_IN);
    }
    
    // Check Water
    if (ball.state === 'water') {
        setState(GAME_STATE.OUT_OF_BOUNDS);
    }
    
    // Check stop
    if (ball.state === 'idle' && currentState !== GAME_STATE.HOLE_IN && currentState !== GAME_STATE.OUT_OF_BOUNDS) {
        setState(GAME_STATE.AIMING);
        // Look at hole again
        let dx = currentLevel.holePos.x - ball.pos.x;
        let dy = currentLevel.holePos.y - ball.pos.y;
        targetCamera.angle = Math.atan2(dy, dx);
    }
}

function updateCamera() {
    if (currentState === GAME_STATE.AIMING || currentState === GAME_STATE.POWERING) {
        targetCamera.x = ball.pos.x;
        targetCamera.y = ball.pos.y;
        targetCamera.zoom = 1.0;
    } else if (currentState === GAME_STATE.IN_FLIGHT || currentState === GAME_STATE.ROLLING) {
        targetCamera.x = ball.pos.x;
        targetCamera.y = ball.pos.y;
        // Zoom out slightly while high up
        targetCamera.zoom = 1.0 - (ball.pos.z * 0.002);
        if(targetCamera.zoom < 0.6) targetCamera.zoom = 0.6;
    } else if (currentState === GAME_STATE.HOLE_IN) {
        targetCamera.zoom = 2.0; // zoom in on hole
    }

    // Smooth lerp
    camera.x += (targetCamera.x - camera.x) * 0.1;
    camera.y += (targetCamera.y - camera.y) * 0.1;
    camera.zoom += (targetCamera.zoom - camera.zoom) * 0.05;
    
    // Shortest path angle lerp
    let diff = targetCamera.angle - camera.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    camera.angle += diff * 0.1;
}

function createHitParticles() {
    for(let i=0; i<10; i++) {
        particles.push({
            x: ball.pos.x,
            y: ball.pos.y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1.0,
            color: '#fff'
        });
    }
}

function createConfetti() {
    for(let i=0; i<100; i++) {
        particles.push({
            x: currentLevel.holePos.x + (Math.random()-0.5)*100,
            y: currentLevel.holePos.y + (Math.random()-0.5)*100,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10 - 5,
            life: 2.0,
            color: `hsl(${Math.random()*360}, 100%, 50%)`
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// Rendering
function render() {
    // Clear screen
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    if (!currentLevel || currentState === GAME_STATE.MENU) return;

    ctx.save();
    
    // Transform to camera
    ctx.translate(cx, cy);
    ctx.scale(camera.zoom, camera.zoom);
    // Rotate world around camera (like a 3D third person view)
    // We want the aim direction to be UP. So we rotate by -camera.angle - PI/2
    ctx.rotate(-camera.angle - Math.PI / 2);
    ctx.translate(-camera.x, -camera.y);

    // Draw Background/Rough
    ctx.fillStyle = getPattern(Textures.rough) || '#083d10';
    ctx.fillRect(camera.x - 2000, camera.y - 2000, 4000, 4000);

    // Draw Fairway
    ctx.lineWidth = 300;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = getPattern(Textures.grass) || '#0d591b';
    ctx.beginPath();
    ctx.moveTo(currentLevel.startPos.x, currentLevel.startPos.y);
    ctx.lineTo(currentLevel.holePos.x, currentLevel.holePos.y);
    ctx.stroke();

    // Draw Green
    ctx.fillStyle = '#128e2a';
    ctx.beginPath();
    ctx.arc(currentLevel.holePos.x, currentLevel.holePos.y, currentLevel.greenRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw Hazards
    for (let h of currentLevel.hazards) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        if (h.type === 'sand') {
            ctx.fillStyle = getPattern(Textures.sand) || '#d1c08a';
        } else if (h.type === 'water') {
            ctx.fillStyle = getPattern(Textures.water) || '#1da2d8';
        } else if (h.type === 'rough') {
            ctx.fillStyle = getPattern(Textures.rough) || '#083d10';
        }
        ctx.fill();
    }

    // Draw Hole
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(currentLevel.holePos.x, currentLevel.holePos.y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw Flag
    if (currentState !== GAME_STATE.HOLE_IN) {
        // Flag pole shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(currentLevel.holePos.x, currentLevel.holePos.y);
        ctx.lineTo(currentLevel.holePos.x + 40, currentLevel.holePos.y + 40);
        ctx.stroke();

        ctx.strokeStyle = '#eee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(currentLevel.holePos.x, currentLevel.holePos.y);
        // Offset pole upwards visually in current view rotation
        let px = currentLevel.holePos.x + Math.cos(camera.angle) * 40;
        let py = currentLevel.holePos.y + Math.sin(camera.angle) * 40;
        ctx.lineTo(px, py);
        ctx.stroke();
        
        // Flag
        ctx.fillStyle = '#ff3366';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(currentLevel.wind.angle) * 20, py + Math.sin(currentLevel.wind.angle) * 20);
        ctx.lineTo(px, py - 10);
        ctx.fill();
    }

    // Aim Guide
    if (currentState === GAME_STATE.AIMING || currentState === GAME_STATE.POWERING) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(ball.pos.x, ball.pos.y);
        // Draw line 500px forward
        ctx.lineTo(ball.pos.x + Math.cos(camera.angle) * 500, ball.pos.y + Math.sin(camera.angle) * 500);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw Particles
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Draw Ball
    if (ball.state !== 'water') {
        // Shadow (scales with height)
        let shadowOffset = ball.pos.z * 0.5;
        let shadowScale = Math.max(0.1, 1 - (ball.pos.z * 0.01));
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.arc(ball.pos.x - shadowOffset, ball.pos.y + shadowOffset, ball.radius * shadowScale, 0, Math.PI * 2);
        ctx.fill();

        // Ball itself
        // Scale ball to simulate 3D height perspective
        let scale = 1 + (ball.pos.z * 0.015);
        let bpx = ball.pos.x + Math.cos(camera.angle) * (ball.pos.z * 0.5); // Visual parallax shift
        let bpy = ball.pos.y + Math.sin(camera.angle) * (ball.pos.z * 0.5);

        ctx.save();
        ctx.translate(bpx, bpy);
        ctx.scale(scale, scale);
        
        // Spin rotation visually (simplified)
        ctx.rotate(ball.pos.x * 0.1 + ball.pos.y * 0.1);

        if (Textures.ball && Textures.ball.complete) {
            ctx.drawImage(Textures.ball, -ball.radius, -ball.radius, ball.radius*2, ball.radius*2);
        } else {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    ctx.restore();
}

// Caching patterns
const patterns = {};
function getPattern(img) {
    if (!img || !img.complete) return null;
    if (patterns[img.src]) return patterns[img.src];
    
    let pat = ctx.createPattern(img, 'repeat');
    patterns[img.src] = pat;
    return pat;
}

// Kickoff
window.onload = init;
