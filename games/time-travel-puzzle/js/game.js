const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let engine = new GameEngine();

const keys = { left: false, right: false, up: false, down: false };
const ui = {
    startScreen: document.getElementById('start-screen'),
    tutorialScreen: document.getElementById('tutorial-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    completeScreen: document.getElementById('level-complete-screen'),
    timelineIndicator: document.getElementById('timeline-indicator'),
    timelineText: document.getElementById('timeline-text'),
    levelText: document.getElementById('level-text'),
    hintPanel: document.getElementById('hint-panel'),
    hintText: document.getElementById('hint-text'),
    glitchOverlay: document.getElementById('glitch-overlay')
};

let isPlaying = false, isPaused = false;
let camera = { x: 0, y: 0 };
let glitchIntensity = 0;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function startGame() {
    ui.startScreen.classList.add('hidden');
    AudioSys.init();
    loadLevel(0);
    isPlaying = true;
    requestAnimationFrame(gameLoop);
}

function loadLevel(index) {
    if (engine.loadLevel(index)) {
        ui.completeScreen.classList.add('hidden');
        ui.levelText.innerText = (index + 1).toString().padStart(2, '0');
        let levelData = Levels[index];
        ui.hintText.innerText = levelData.hint || "Solve the puzzle.";
        updateTimelineUI();
    }
}

function toggleTime() {
    if (!isPlaying || isPaused || engine.levelCompleted) return;
    engine.switchTimeline();
    updateTimelineUI();
    glitchIntensity = 1.0;
}

function updateTimelineUI() {
    const isPast = engine.timeline === TimelineState.PAST;
    ui.timelineIndicator.className = 'timeline-indicator ' + (isPast ? 'past' : 'future');
    ui.timelineText.innerText = isPast ? 'PAST' : 'FUTURE';
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.right = true;
    if (e.key === 's' || e.key === 'ArrowDown') keys.down = true;
    
    // Smooth jump logic with coyote time buffer allowance
    if ((e.key === 'w' || e.key === 'ArrowUp' || e.key === ' ') && !keys.up) {
        if (engine.player && engine.player.grounded && !engine.levelCompleted) {
            engine.player.vy = -CONFIG.JUMP_FORCE;
            engine.player.grounded = false;
            engine.player.squash = 0.6;
            engine.player.stretch = 1.4;
            AudioSys.playJump();
            engine.spawnParticles(engine.player.x + engine.player.w/2, engine.player.y + engine.player.h, 10, '#fff');
        }
        keys.up = true;
    }
    if (e.key === 'Shift') toggleTime();
    if (e.key === 'Escape') togglePause();
    
    // Interaction using UP/DOWN
    if(e.key === 'ArrowDown' || e.key === 's') {
        // e.g., Enter door
        let objects = engine.timeline === TimelineState.PAST ? engine.entities.past : engine.entities.future;
        let doors = objects.filter(o => o.type === ObjectTypes.DOOR);
        doors.forEach(door => {
            if (engine.doorOpen && engine.checkCollision(engine.player.getRect(), door.getRect())) {
                engine.triggerLevelComplete();
            }
        });
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'w' || e.key === 'ArrowUp' || e.key === ' ') keys.up = false;
    if (e.key === 's' || e.key === 'ArrowDown') keys.down = false;
});

// UI Bindings
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-tutorial').addEventListener('click', () => ui.tutorialScreen.classList.remove('hidden'));
document.getElementById('btn-close-tutorial').addEventListener('click', () => ui.tutorialScreen.classList.add('hidden'));
document.getElementById('btn-next-level').addEventListener('click', () => loadLevel(engine.currentLevel + 1));
document.getElementById('btn-hint').addEventListener('click', () => ui.hintPanel.classList.toggle('hidden'));
document.getElementById('btn-restart').addEventListener('click', () => loadLevel(engine.currentLevel));
document.getElementById('btn-sound').addEventListener('click', () => {
    document.getElementById('btn-sound').innerText = AudioSys.toggle() ? '🔊' : '🔇';
});
document.getElementById('btn-pause').addEventListener('click', togglePause);

// Mobile Controls
const bindBtn = (id, key, isHold = true) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const startEvent = e => { e.preventDefault(); if(key==='time') toggleTime(); else {
        if(key==='up' && engine.player && engine.player.grounded) {
            engine.player.vy = -CONFIG.JUMP_FORCE;
            engine.player.grounded = false;
            AudioSys.playJump();
        }
        keys[key] = true; 
    }};
    const endEvent = e => { e.preventDefault(); if(key!=='time') keys[key] = false; };
    btn.addEventListener('touchstart', startEvent);
    btn.addEventListener('mousedown', startEvent);
    if (isHold) {
        btn.addEventListener('touchend', endEvent);
        btn.addEventListener('mouseup', endEvent);
        btn.addEventListener('mouseleave', endEvent);
    }
};
bindBtn('btn-left', 'left'); bindBtn('btn-right', 'right'); bindBtn('btn-jump', 'up'); bindBtn('btn-time', 'time', false);

function togglePause() {
    isPaused = !isPaused;
    ui.pauseScreen.classList.toggle('hidden', !isPaused);
}

function drawRect(x, y, w, h, color, glow = false, squash = 1, stretch = 1) {
    ctx.save();
    ctx.translate(x + w/2, y + h);
    ctx.scale(squash, stretch);
    ctx.translate(-(x + w/2), -(y + h));
    
    ctx.fillStyle = color;
    if (glow) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
    }
    ctx.fillRect(x, y, w, h);
    ctx.restore();
}

function render() {
    const isPast = engine.timeline === TimelineState.PAST;
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (isPast) {
        bgGradient.addColorStop(0, '#2d1e15'); bgGradient.addColorStop(1, '#110a05');
    } else {
        bgGradient.addColorStop(0, '#0a0e17'); bgGradient.addColorStop(1, '#000000');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (engine.player) {
        let targetCx = engine.player.x - canvas.width / 2 + engine.player.w / 2;
        let targetCy = engine.player.y - canvas.height / 2 + engine.player.h / 2;
        camera.x += (targetCx - camera.x) * 0.1;
        camera.y += (targetCy - camera.y) * 0.1;
        
        let maxCamX = 16 * TILE_SIZE - canvas.width;
        let maxCamY = 10 * TILE_SIZE - canvas.height;
        if(maxCamX < 0) maxCamX = 0; if(maxCamY < 0) maxCamY = 0;
        camera.x = Math.max(0, Math.min(camera.x, maxCamX));
        camera.y = Math.max(0, Math.min(camera.y, maxCamY));
    }

    ctx.save();
    const offsetX = Math.max(0, (canvas.width - 16 * TILE_SIZE) / 2);
    const offsetY = Math.max(0, (canvas.height - 10 * TILE_SIZE) / 2);
    
    // Screenshake
    let sx = (Math.random()-0.5)*engine.screenShake;
    let sy = (Math.random()-0.5)*engine.screenShake;
    ctx.translate(-camera.x + offsetX + sx, -camera.y + offsetY + sy);

    let objects = isPast ? engine.entities.past : engine.entities.future;
    
    objects.forEach(obj => {
        let rx = obj.x, ry = obj.y, rw = obj.w, rh = obj.h;
        switch (obj.type) {
            case ObjectTypes.WALL:
                drawRect(rx, ry, rw, rh, isPast ? '#5c4033' : '#1a252c');
                ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(rx, ry + rh - 5, rw, 5);
                break;
            case ObjectTypes.RUINED_WALL:
                drawRect(rx, ry, rw, rh, '#3a251a');
                ctx.strokeStyle = '#221100'; ctx.beginPath(); ctx.moveTo(rx+10, ry); ctx.lineTo(rx+rw-10, ry+rh); ctx.stroke();
                break;
            case ObjectTypes.MOVABLE:
                drawRect(rx, ry, rw, rh, '#7f8c8d');
                ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rw, rh);
                ctx.beginPath(); ctx.moveTo(rx+5, ry+5); ctx.lineTo(rx+rw-5, ry+rh-5); ctx.moveTo(rx+rw-5, ry+5); ctx.lineTo(rx+5, ry+rh-5); ctx.stroke();
                break;
            case ObjectTypes.SPIKE:
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath(); ctx.moveTo(rx+rw/2, ry); ctx.lineTo(rx+rw, ry+rh); ctx.lineTo(rx, ry+rh); ctx.fill();
                break;
            case ObjectTypes.SEED:
                drawRect(rx, ry, rw, rh, '#2ecc71', true);
                break;
            case ObjectTypes.TREE:
                drawRect(rx + rw/2 - 10, ry + 20, 20, rh - 20, '#5c4033');
                drawRect(rx, ry, rw, 40, '#27ae60', true);
                break;
            case ObjectTypes.SWITCH:
                drawRect(rx, ry + rh - 10, rw, 10, '#34495e');
                if (obj.pressed) drawRect(rx + 10, ry + rh - 5, rw - 20, 5, '#e74c3c', true);
                else drawRect(rx + 10, ry + rh - 15, rw - 20, 15, '#e74c3c');
                break;
            case ObjectTypes.DOOR:
                drawRect(rx, ry, rw, rh, '#2c3e50');
                if (engine.doorOpen) drawRect(rx + 5, ry + 5, rw - 10, rh - 10, isPast ? '#f1c40f' : '#00d2ff', true);
                else drawRect(rx + 5, ry + 5, rw - 10, rh - 10, '#c0392b');
                
                // Door hint
                if(engine.doorOpen && engine.checkCollision(engine.player.getRect(), obj.getRect())) {
                    ctx.fillStyle = '#fff'; ctx.font = '12px Inter'; ctx.fillText('Press DOWN to enter', rx - 10, ry - 10);
                }
                break;
        }
    });

    if (engine.player) {
        let p = engine.player;
        let color = isPast ? '#f39c12' : '#00d2ff';
        if (Math.abs(p.vx) > 1 || Math.abs(p.vy) > 1) drawRect(p.x - p.vx, p.y - p.vy, p.w, p.h, color + '40');
        drawRect(p.x, p.y, p.w, p.h, color, true, p.squash, p.stretch);
        
        ctx.fillStyle = '#fff';
        if (p.vx >= 0) ctx.fillRect(p.x + p.w - 10, p.y + 10, 6, 6);
        else ctx.fillRect(p.x + 4, p.y + 10, 6, 6);
    }

    // Particles
    engine.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    ctx.restore();

    // Cinematic Glitch Effect
    if (glitchIntensity > 0) {
        ui.glitchOverlay.style.opacity = glitchIntensity * 0.8;
        glitchIntensity -= 0.05;
    } else {
        ui.glitchOverlay.style.opacity = 0.1;
    }
}

function gameLoop() {
    if (!isPlaying) return;
    if (!isPaused && !engine.levelCompleted) {
        if (engine.player) {
            if (keys.left) engine.player.vx -= CONFIG.ACCELERATION;
            if (keys.right) engine.player.vx += CONFIG.ACCELERATION;
            if (engine.player.vx > CONFIG.MOVE_SPEED) engine.player.vx = CONFIG.MOVE_SPEED;
            if (engine.player.vx < -CONFIG.MOVE_SPEED) engine.player.vx = -CONFIG.MOVE_SPEED;
        }
        engine.update();
    }
    render();
    requestAnimationFrame(gameLoop);
}

Assets.load().then(() => console.log("Assets loaded"));
