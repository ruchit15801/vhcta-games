// script.js - Core Game Engine

// --- Config & State ---
const state = {
    currentLevelIndex: 0,
    nodes: {}, // id -> NodeObject
    connections: [], // { fromNode, fromPort, toNode, toPort }
    wiring: {
        active: false,
        fromNode: null,
        fromPort: null, // "out", "out2", etc.
        mouseX: 0,
        mouseY: 0
    },
    isPlaying: false
};

const DEVICE_ICONS = {
    "switch": "🔘",
    "sensor": "📡",
    "light": "💡",
    "door": "🚪",
    "alarm": "🚨",
    "and": "⋀",
    "or": "⋁",
    "not": "¬"
};

// --- DOM Elements ---
const dom = {
    startScreen: document.getElementById('start-screen'),
    gameScreen: document.getElementById('game-screen'),
    levelCompleteScreen: document.getElementById('level-complete-screen'),
    startBtn: document.getElementById('start-btn'),
    nextLevelBtn: document.getElementById('next-level-btn'),
    resetBtn: document.getElementById('reset-level-btn'),
    soundBtn: document.getElementById('sound-toggle-btn'),
    runBtn: document.getElementById('run-test-btn'),
    
    canvas: document.getElementById('game-canvas'),
    nodesLayer: document.getElementById('nodes-layer'),
    
    lblLevel: document.getElementById('current-level-display'),
    lblName: document.getElementById('level-name-display'),
    lblObjective: document.getElementById('objective-display'),
    statusDot: document.getElementById('system-status-dot'),
    statusText: document.getElementById('system-status-text')
};

const ctx = dom.canvas.getContext('2d');

// --- Initialization ---
function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    dom.startBtn.addEventListener('click', startGame);
    dom.nextLevelBtn.addEventListener('click', nextLevel);
    dom.resetBtn.addEventListener('click', () => loadLevel(state.currentLevelIndex));
    
    dom.soundBtn.addEventListener('click', () => {
        const enabled = window.gameAudio.toggle();
        dom.soundBtn.textContent = enabled ? "🔊" : "🔇";
        if(enabled) window.gameAudio.startAmbient();
    });

    dom.runBtn.addEventListener('click', testLogic);

    // Global mouse/touch events for wiring
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleMouseMove, {passive: false});
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
}

function resizeCanvas() {
    dom.canvas.width = window.innerWidth;
    dom.canvas.height = window.innerHeight;
}

function startGame() {
    window.gameAudio.init();
    window.gameAudio.playClick();
    window.gameAudio.startAmbient();
    
    dom.startScreen.classList.remove('active');
    setTimeout(() => {
        dom.startScreen.classList.add('hidden');
        dom.gameScreen.classList.remove('hidden');
        // Small delay to allow display:block to apply before animating opacity
        setTimeout(() => {
            dom.gameScreen.classList.add('active');
            loadLevel(0);
            state.isPlaying = true;
            requestAnimationFrame(gameLoop);
        }, 50);
    }, 500);
}

// --- Level Loading ---
function loadLevel(index) {
    if(index >= window.gameLevels.length) index = 0; // Wrap around or end game
    state.currentLevelIndex = index;
    const levelData = window.gameLevels[index];
    
    // Update HUD
    dom.lblLevel.textContent = levelData.id;
    dom.lblName.textContent = levelData.name;
    dom.lblObjective.textContent = levelData.objective;
    
    updateStatus("SYSTEM STANDBY", "");
    dom.runBtn.classList.remove('success');
    dom.runBtn.textContent = "EXECUTE LOGIC";
    
    // Clear previous state
    dom.nodesLayer.innerHTML = '';
    state.nodes = {};
    state.connections = [];
    
    // Create nodes
    levelData.nodes.forEach(nData => {
        createNode(nData);
    });
}

function createNode(data) {
    const el = document.createElement('div');
    el.className = `device-node type-${data.type}`;
    el.id = `node-${data.id}`;
    
    // Convert % coordinates to pixels
    const pxX = (data.x / 100) * window.innerWidth;
    const pxY = (data.y / 100) * window.innerHeight;
    
    el.style.left = `${pxX}px`;
    el.style.top = `${pxY}px`;
    
    let html = `<div class="device-icon">${DEVICE_ICONS[data.device] || '❓'}</div>
                <div class="device-label">${data.label}</div>`;
                
    // Add Ports
    if (data.type === 'trigger') {
        html += `<div class="port port-out" data-node="${data.id}" data-type="out" title="Output"></div>`;
    } else if (data.type === 'action') {
        html += `<div class="port port-in" data-node="${data.id}" data-type="in" title="Input"></div>`;
    } else if (data.type === 'logic') {
        html += `<div class="port port-in top" data-node="${data.id}" data-type="in" title="Input"></div>
                 <div class="port port-out bottom" data-node="${data.id}" data-type="out" title="Output"></div>`;
    }
    
    el.innerHTML = html;
    dom.nodesLayer.appendChild(el);
    
    // Node state object
    state.nodes[data.id] = {
        id: data.id,
        type: data.type,
        device: data.device,
        el: el,
        active: false,
        userToggled: false, // For switches
        autoTrigger: data.autoTrigger || false
    };
    
    // Interactions
    if (data.device === 'switch') {
        el.addEventListener('click', (e) => {
            if(e.target.classList.contains('port')) return;
            const node = state.nodes[data.id];
            node.userToggled = !node.userToggled;
            window.gameAudio.playClick();
        });
    }

    // Port interactions
    const ports = el.querySelectorAll('.port');
    ports.forEach(port => {
        port.addEventListener('mousedown', (e) => startWiring(e, port));
        port.addEventListener('touchstart', (e) => startWiring(e, port), {passive: false});
    });
}

// --- Wiring Interaction ---
function startWiring(e, port) {
    e.stopPropagation();
    e.preventDefault();
    
    const isTouch = e.type === 'touchstart';
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    
    const nodeId = port.getAttribute('data-node');
    const portType = port.getAttribute('data-type');
    
    state.wiring.active = true;
    state.wiring.fromNode = nodeId;
    state.wiring.fromPortType = portType; // in or out
    state.wiring.fromEl = port;
    state.wiring.mouseX = clientX;
    state.wiring.mouseY = clientY;
    
    window.gameAudio.playTone(500, 'sine', 0.1, 0.2);
}

function handleMouseMove(e) {
    if (!state.wiring.active) return;
    e.preventDefault(); // Prevent scrolling on touch
    const isTouch = e.type === 'touchmove';
    state.wiring.mouseX = isTouch ? e.touches[0].clientX : e.clientX;
    state.wiring.mouseY = isTouch ? e.touches[0].clientY : e.clientY;
}

function handleMouseUp(e) {
    if (!state.wiring.active) return;
    
    const isTouch = e.type === 'touchend';
    let target = null;
    
    if (isTouch) {
        // Find element under touch point
        const touch = e.changedTouches[0];
        target = document.elementFromPoint(touch.clientX, touch.clientY);
    } else {
        target = e.target;
    }
    
    if (target && target.classList.contains('port')) {
        const toNode = target.getAttribute('data-node');
        const toPortType = target.getAttribute('data-type');
        
        // Prevent connecting to self or same port type (out to out)
        if (toNode !== state.wiring.fromNode && toPortType !== state.wiring.fromPortType) {
            
            // Standardize connection format: always {outNode, inNode}
            let outNode = state.wiring.fromPortType === 'out' ? state.wiring.fromNode : toNode;
            let inNode = state.wiring.fromPortType === 'in' ? state.wiring.fromNode : toNode;
            
            // Check if connection already exists
            const exists = state.connections.find(c => c.outNode === outNode && c.inNode === inNode);
            
            if (exists) {
                // Remove existing
                state.connections = state.connections.filter(c => c !== exists);
                window.gameAudio.playDisconnect();
            } else {
                // Add new
                state.connections.push({ outNode, inNode });
                window.gameAudio.playConnect();
            }
        }
    }
    
    state.wiring.active = false;
    state.wiring.fromNode = null;
    state.wiring.fromEl = null;
}

// --- Logic Engine ---
function evaluateLogic() {
    const levelData = window.gameLevels[state.currentLevelIndex];
    let anyChanged = false;
    
    // Reset inputs for all nodes
    const nodeInputs = {};
    for(let id in state.nodes) nodeInputs[id] = [];
    
    // Build adjacency list for this frame
    state.connections.forEach(conn => {
        const sourceState = state.nodes[conn.outNode].active;
        nodeInputs[conn.inNode].push(sourceState);
    });
    
    // Evaluate Triggers
    for(let id in state.nodes) {
        const node = state.nodes[id];
        let newState = false;
        
        if (node.type === 'trigger') {
            if (node.device === 'switch') {
                newState = node.userToggled;
            } else if (node.device === 'sensor') {
                // Simple auto-trigger for simulation (blinks every 2 seconds)
                const time = Date.now() / 1000;
                newState = node.autoTrigger && (time % 4 > 2); // 2s on, 2s off
            }
        } else if (node.type === 'logic') {
            const inputs = nodeInputs[id];
            if (node.device === 'and') {
                newState = inputs.length > 0 && inputs.every(val => val === true);
            } else if (node.device === 'or') {
                newState = inputs.some(val => val === true);
            } else if (node.device === 'not') {
                // NOT gate needs exactly 1 connection ideally, but we handle empty
                newState = inputs.length > 0 ? !inputs[0] : false;
            }
        } else if (node.type === 'action') {
            const inputs = nodeInputs[id];
            // Actions act like OR gates natively
            newState = inputs.some(val => val === true);
        }
        
        if (node.active !== newState) {
            node.active = newState;
            anyChanged = true;
            
            // Visual Update
            if (newState) {
                node.el.classList.add('active');
                if(node.type === 'action') window.gameAudio.playActivate();
            } else {
                node.el.classList.remove('active');
            }
        }
    }
    
    return anyChanged;
}

// --- Testing & Progression ---
function testLogic() {
    window.gameAudio.playClick();
    updateStatus("ANALYZING LOGIC...", "active");
    
    const levelData = window.gameLevels[state.currentLevelIndex];
    
    // Run evaluation and check win condition
    // For strict logic levels (like AND/OR), we should theoretically test all switch permutations
    // To keep it simple but functional, we evaluate the current state against the win condition.
    
    // Extract current state representation
    const currentState = {};
    for(let id in state.nodes) {
        currentState[id] = state.nodes[id].active;
    }
    
    const isWin = levelData.winCondition(currentState);
    
    setTimeout(() => {
        if (isWin) {
            updateStatus("SYSTEM AUTOMATED", "success");
            dom.runBtn.classList.add('success');
            dom.runBtn.textContent = "SUCCESS";
            window.gameAudio.playSuccess();
            
            setTimeout(showLevelComplete, 1000);
        } else {
            updateStatus("LOGIC ERROR", "error");
            window.gameAudio.playError();
        }
    }, 500);
}

function updateStatus(text, type) {
    dom.statusText.textContent = text;
    dom.statusDot.className = `status-dot ${type}`;
}

function showLevelComplete() {
    dom.levelCompleteScreen.classList.remove('hidden');
    // small delay for css transition
    setTimeout(() => {
        dom.levelCompleteScreen.classList.add('active');
        createParticles();
    }, 50);
}

function nextLevel() {
    window.gameAudio.playClick();
    dom.levelCompleteScreen.classList.remove('active');
    setTimeout(() => {
        dom.levelCompleteScreen.classList.add('hidden');
        loadLevel(state.currentLevelIndex + 1);
    }, 500);
}

// --- Rendering Loop ---
function getPortCenter(nodeId, type) {
    const nodeEl = state.nodes[nodeId].el;
    const rect = nodeEl.getBoundingClientRect();
    
    if (type === 'out') {
        // Output is usually right side, or bottom for logic
        const port = nodeEl.querySelector('.port-out');
        const pRect = port.getBoundingClientRect();
        return { x: pRect.left + pRect.width/2, y: pRect.top + pRect.height/2 };
    } else {
        // Input is usually left side, or top for logic
        const port = nodeEl.querySelector('.port-in');
        const pRect = port.getBoundingClientRect();
        return { x: pRect.left + pRect.width/2, y: pRect.top + pRect.height/2 };
    }
}

function drawLine(x1, y1, x2, y2, isActive) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    
    // Bezier curve for wires
    const midX = (x1 + x2) / 2;
    ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
    
    ctx.lineWidth = 4;
    ctx.strokeStyle = isActive ? 'rgba(0, 243, 255, 0.8)' : 'rgba(100, 100, 255, 0.3)';
    
    if (isActive) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f3ff';
    } else {
        ctx.shadowBlur = 0;
    }
    
    ctx.stroke();
    
    // Draw flowing particles on active lines
    if (isActive) {
        const time = Date.now() / 500;
        const t = (time % 1); // 0 to 1
        
        // Calculate point on bezier
        const ptX = Math.pow(1-t, 3)*x1 + 3*Math.pow(1-t, 2)*t*midX + 3*(1-t)*Math.pow(t, 2)*midX + Math.pow(t, 3)*x2;
        const ptY = Math.pow(1-t, 3)*y1 + 3*Math.pow(1-t, 2)*t*y1 + 3*(1-t)*Math.pow(t, 2)*y2 + Math.pow(t, 3)*y2;
        
        ctx.beginPath();
        ctx.arc(ptX, ptY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    }
}

function gameLoop() {
    if (!state.isPlaying) return;
    
    // Update logic
    evaluateLogic();
    
    // Clear Canvas
    ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
    
    // Draw established connections
    state.connections.forEach(conn => {
        const p1 = getPortCenter(conn.outNode, 'out');
        const p2 = getPortCenter(conn.inNode, 'in');
        
        const isActive = state.nodes[conn.outNode].active;
        drawLine(p1.x, p1.y, p2.x, p2.y, isActive);
    });
    
    // Draw wiring in progress
    if (state.wiring.active && state.wiring.fromNode) {
        const p1 = getPortCenter(state.wiring.fromNode, state.wiring.fromPortType);
        drawLine(p1.x, p1.y, state.wiring.mouseX, state.wiring.mouseY, false);
    }
    
    requestAnimationFrame(gameLoop);
}

// --- Effects ---
function createParticles() {
    const container = document.getElementById('success-particles');
    container.innerHTML = '';
    
    for(let i=0; i<20; i++) {
        const p = document.createElement('div');
        p.style.position = 'absolute';
        p.style.width = '8px';
        p.style.height = '8px';
        p.style.background = 'var(--neon-cyan)';
        p.style.borderRadius = '50%';
        p.style.left = '50%';
        p.style.top = '50%';
        p.style.boxShadow = '0 0 10px var(--neon-cyan)';
        
        // Random velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 100;
        const tx = Math.cos(angle) * speed;
        const ty = Math.sin(angle) * speed;
        
        p.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
        ], {
            duration: 1000 + Math.random() * 500,
            easing: 'cubic-bezier(0, .9, .57, 1)',
            fill: 'forwards'
        });
        
        container.appendChild(p);
    }
}

// Start app
window.addEventListener('DOMContentLoaded', init);
