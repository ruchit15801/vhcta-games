// ============================================================
// Royal Gems — Match-3 (Clean, Working Build)
// ============================================================

// Canvas
var canvas = document.getElementById('game-canvas');
var ctx = canvas.getContext('2d');

// DOM
var uiLevel = document.getElementById('level');
var uiScore = document.getElementById('score');
var uiTarget = document.getElementById('target');
var uiMoves = document.getElementById('moves');
var tutorialOverlay = document.getElementById('tutorial');
var gameOverOverlay = document.getElementById('game-over');
var pauseOverlay = document.getElementById('pause-menu');
var btnStart = document.getElementById('btn-start');
var btnRestart = document.getElementById('btn-restart');
var btnResume = document.getElementById('btn-resume');
var btnQuit = document.getElementById('btn-quit');
var btnPause = document.getElementById('btn-pause');
var btnSound = document.getElementById('btn-sound');
var endTitle = document.getElementById('end-title');
var endMessage = document.getElementById('end-message');
var popups = document.getElementById('popups');

// ============ CONSTANTS ============
var COLS = 8;
var ROWS = 8;
var COLORS = [
    { main: '#ff2a40', shape: 2 },
    { main: '#1ab2ff', shape: 1 },
    { main: '#00e676', shape: 4 },
    { main: '#ffc400', shape: 3 },
    { main: '#d500f9', shape: 0 },
    { main: '#ff6e00', shape: 5 }
];

// ============ STATE ============
var STATE_MENU = 0;
var STATE_PLAYING = 1;
var STATE_ANIMATING = 2;
var STATE_PAUSED = 3;
var STATE_OVER = 4;

var gameState = STATE_MENU;
var level = 1;
var score = 0;
var levelStartScore = 0;
var targetScore = 2500;
var movesLeft = 25;
var grid = null; // Will be 2D array
var particles = [];
var tileSize = 0;
var offX = 0;
var offY = 0;
var topBarH = 0;
var selected = null; // {c, r}
var combo = 1;
var busy = false;
var soundOn = true;
var audioCtx = null;

// Touch state
var tSX = 0, tSY = 0, tSC = -1, tSR = -1, tActive = false;

// Level intro animation
var levelIntro = null; // {text, alpha, timer}

// ============ AUDIO ============
function initAudio() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
}

function playTone(type) {
    if (!soundOn || !audioCtx) return;
    try {
        var o = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        var t = audioCtx.currentTime;

        switch (type) {
            case 'click':
                o.type = 'sine'; o.frequency.setValueAtTime(1000, t);
                g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
                o.start(t); o.stop(t + 0.05); break;
            case 'swap':
                o.type = 'sine'; o.frequency.setValueAtTime(600, t);
                o.frequency.exponentialRampToValueAtTime(800, t + 0.1);
                g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
                o.start(t); o.stop(t + 0.1); break;
            case 'match':
                o.type = 'triangle'; var bf = 600 + combo * 150;
                o.frequency.setValueAtTime(bf, t); o.frequency.exponentialRampToValueAtTime(bf * 2, t + 0.25);
                g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
                o.start(t); o.stop(t + 0.25); break;
            case 'win':
                o.type = 'square';
                o.frequency.setValueAtTime(440, t); o.frequency.setValueAtTime(659, t + 0.15);
                o.frequency.setValueAtTime(880, t + 0.3); o.frequency.setValueAtTime(1046, t + 0.45);
                g.gain.setValueAtTime(0.15, t); g.gain.linearRampToValueAtTime(0, t + 1);
                o.start(t); o.stop(t + 1); break;
            case 'lose':
                o.type = 'sawtooth'; o.frequency.setValueAtTime(300, t);
                o.frequency.exponentialRampToValueAtTime(80, t + 0.7);
                g.gain.setValueAtTime(0.2, t); g.gain.linearRampToValueAtTime(0, t + 0.7);
                o.start(t); o.stop(t + 0.7); break;
            case 'bad':
                o.type = 'square'; o.frequency.setValueAtTime(150, t);
                o.frequency.exponentialRampToValueAtTime(100, t + 0.12);
                g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
                o.start(t); o.stop(t + 0.12); break;
        }
    } catch (e) {}
}

// ============ RESIZE ============
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var tb = document.getElementById('top-bar');
    topBarH = tb ? tb.offsetHeight : 48;

    var aw = canvas.width - 10;
    var ah = canvas.height - topBarH - 6;
    tileSize = Math.floor(Math.min(aw / COLS, ah / ROWS));
    if (tileSize < 28) tileSize = 28;

    var bw = tileSize * COLS;
    var bh = tileSize * ROWS;
    offX = Math.floor((canvas.width - bw) / 2);
    offY = Math.floor(topBarH + (canvas.height - topBarH - bh) / 2);
    if (offY < topBarH + 2) offY = topBarH + 2;

    // Update candy positions
    if (grid) {
        for (var c = 0; c < COLS; c++)
            for (var r = 0; r < ROWS; r++)
                if (grid[c][r]) {
                    grid[c][r].x = offX + c * tileSize;
                    grid[c][r].y = offY + r * tileSize;
                }
    }
}
window.addEventListener('resize', resize);

// ============ DRAWING ============
function roundRect(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y); ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
}

function drawGem(shape, rad, color) {
    ctx.save();
    ctx.beginPath();
    var i;
    switch (shape) {
        case 0: for (i = 0; i < 6; i++) ctx.lineTo(rad * Math.cos(i * Math.PI / 3), rad * Math.sin(i * Math.PI / 3)); break;
        case 1: ctx.lineTo(0, -rad); ctx.lineTo(rad, 0); ctx.lineTo(0, rad); ctx.lineTo(-rad, 0); break;
        case 2: ctx.rect(-rad * 0.8, -rad * 0.8, rad * 1.6, rad * 1.6); break;
        case 3: ctx.arc(0, 0, rad * 0.9, 0, Math.PI * 2); break;
        case 4: for (i = 0; i < 8; i++) ctx.lineTo(rad * 0.95 * Math.cos(i * Math.PI / 4 + Math.PI / 8), rad * 0.95 * Math.sin(i * Math.PI / 4 + Math.PI / 8)); break;
        default: for (i = 0; i < 3; i++) ctx.lineTo(rad * 1.1 * Math.cos(i * Math.PI * 2 / 3 - Math.PI / 2), rad * 1.1 * Math.sin(i * Math.PI * 2 / 3 - Math.PI / 2)); break;
    }
    ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = Math.max(4, rad * 0.35); ctx.shadowOffsetY = Math.max(2, rad * 0.12);
    ctx.fillStyle = color; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.clip();
    var gr = ctx.createLinearGradient(-rad, -rad, rad, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.4, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = gr; ctx.fill();
    // Facet
    ctx.beginPath();
    switch (shape) {
        case 0: case 4: ctx.arc(0, 0, rad * 0.5, 0, Math.PI * 2); break;
        case 1: ctx.lineTo(0, -rad * 0.5); ctx.lineTo(rad * 0.5, 0); ctx.lineTo(0, rad * 0.5); ctx.lineTo(-rad * 0.5, 0); break;
        case 2: ctx.rect(-rad * 0.4, -rad * 0.4, rad * 0.8, rad * 0.8); break;
        case 3: ctx.arc(0, 0, rad * 0.5, 0, Math.PI * 2); break;
        default: for (i = 0; i < 3; i++) ctx.lineTo(rad * 0.45 * Math.cos(i * Math.PI * 2 / 3 - Math.PI / 2), rad * 0.45 * Math.sin(i * Math.PI * 2 / 3 - Math.PI / 2)); break;
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
    // Highlight
    ctx.beginPath(); ctx.arc(-rad * 0.25, -rad * 0.28, rad * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    ctx.restore();
}

// ============ PARTICLE ============
function Particle(x, y, color) {
    this.x = x; this.y = y; this.color = color;
    var a = Math.random() * Math.PI * 2, s = Math.random() * 5 + 2;
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.life = 1; this.decay = Math.random() * 0.03 + 0.02; this.size = Math.random() * 4 + 2;
}
Particle.prototype.update = function () {
    this.x += this.vx; this.y += this.vy; this.vy += 0.2;
    this.life -= this.decay; this.size *= 0.96;
};
Particle.prototype.draw = function () {
    if (this.life <= 0) return;
    ctx.save(); ctx.globalAlpha = this.life; ctx.fillStyle = this.color;
    ctx.shadowColor = this.color; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
};

// ============ CANDY ============
function Candy(c, r, type) {
    this.c = c; this.r = r; this.type = type;
    this.x = offX + c * tileSize;
    this.y = offY - (ROWS - r + 2) * tileSize; // Start above board
    this.vy = 0;
    this.alpha = 1; this.scale = 0; this.targetScale = 1; this.dying = false;
}
Candy.prototype.update = function () {
    var tx = offX + this.c * tileSize;
    var ty = offY + this.r * tileSize;
    var moved = false;
    // X — smooth horizontal slide
    var dx = tx - this.x;
    if (Math.abs(dx) > 0.5) { this.x += dx * 0.3; moved = true; } else this.x = tx;
    // Y — gravity drop with soft bounce
    var dy = ty - this.y;
    if (Math.abs(dy) > 0.5 || Math.abs(this.vy) > 0.1) {
        if (this.y < ty || this.vy !== 0) {
            this.vy += 1.5; this.y += this.vy;
            if (this.y > ty) { this.y = ty; this.vy *= -0.18; if (Math.abs(this.vy) < 0.5) this.vy = 0; }
        } else { this.y += dy * 0.3; }
        moved = true;
    } else { this.y = ty; this.vy = 0; }
    // Scale — snappy pop-in
    var ds = this.targetScale - this.scale;
    if (Math.abs(ds) > 0.01) { this.scale += ds * 0.25; moved = true; } else this.scale = this.targetScale;
    // Die — quick fade
    if (this.dying) { this.targetScale = 0; this.alpha -= 0.15; if (this.alpha < 0) this.alpha = 0; moved = true; }
    return moved;
};
Candy.prototype.draw = function () {
    if (this.alpha <= 0 || this.scale < 0.01) return;
    var cx = this.x + tileSize / 2;
    var cy = this.y + tileSize / 2;
    var r = (tileSize / 2) * 0.72 * this.scale;
    ctx.save(); ctx.globalAlpha = this.alpha; ctx.translate(cx, cy);
    var td = COLORS[this.type];
    if (td) drawGem(td.shape, r, td.main);
    ctx.restore();
};

// ============ LEVEL CONFIG ============
function numGemTypes() { return level <= 2 ? 4 : level <= 5 ? 5 : 6; }
function calcMoves() { return level <= 2 ? 25 : level <= 4 ? 22 : level <= 7 ? 20 : Math.max(14, 22 - level); }
function calcTarget() { return score + 1500 + level * 1000; }

// ============ CREATE GRID ============
function createGrid() {
    grid = [];
    var n = numGemTypes();
    for (var c = 0; c < COLS; c++) {
        grid[c] = [];
        for (var r = 0; r < ROWS; r++) {
            var type, att = 0;
            do {
                type = Math.floor(Math.random() * n);
                att++;
            } while (att < 50 && (
                (c >= 2 && grid[c - 1][r] && grid[c - 2][r] && grid[c - 1][r].type === type && grid[c - 2][r].type === type) ||
                (r >= 2 && grid[c][r - 1] && grid[c][r - 2] && grid[c][r - 1].type === type && grid[c][r - 2].type === type)
            ));
            grid[c][r] = new Candy(c, r, type);
        }
    }
}

// ============ START LEVEL ============
function startLevel() {
    resize();
    createGrid();
    movesLeft = calcMoves();
    targetScore = calcTarget();
    levelStartScore = score;
    combo = 1;
    busy = false;
    selected = null;
    particles = [];
    if (popups) popups.innerHTML = '';

    var hue = (level * 35) % 360;
    var bd = document.getElementById('backdrop');
    if (bd) bd.style.filter = 'hue-rotate(' + hue + 'deg)';

    // Show level intro animation on canvas
    levelIntro = { text: 'Level ' + level, alpha: 1, timer: 90 };

    updateUI();
    gameState = STATE_PLAYING;

    // Hide all overlays
    if (tutorialOverlay) tutorialOverlay.classList.add('hidden');
    if (gameOverOverlay) gameOverOverlay.classList.add('hidden');
    if (pauseOverlay) pauseOverlay.classList.add('hidden');
}

// ============ UI UPDATE ============
function updateUI() {
    if (uiLevel) uiLevel.textContent = level;
    if (uiScore) uiScore.textContent = score;
    if (uiTarget) uiTarget.textContent = targetScore;
    if (uiMoves) uiMoves.textContent = movesLeft;
    if (uiScore) uiScore.style.color = score >= targetScore ? '#00e676' : '#fcf6ba';
    if (uiMoves) uiMoves.style.color = (movesLeft <= 3 && movesLeft > 0 && score < targetScore) ? '#ff2a40' : '#fcf6ba';
}

// ============ FLOATING TEXT ============
function floatText(text, x, y, color) {
    if (!popups) return;
    var el = document.createElement('div');
    el.className = 'score-popup'; el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.color = color;
    popups.appendChild(el);
    setTimeout(function () { try { el.remove(); } catch (e) {} }, 1300);
}

function showCombo(c) {
    if (c < 2) return;
    var el = document.createElement('div');
    el.className = 'combo-msg ' + (c >= 5 ? 'x5' : c >= 4 ? 'x4' : c >= 3 ? 'x3' : 'x2');
    var words = ['', '', 'DOUBLE!', 'TRIPLE!', 'AMAZING!', 'INCREDIBLE!'];
    el.textContent = words[Math.min(c, 5)] || 'LEGENDARY!';
    document.body.appendChild(el);
    setTimeout(function () { try { el.remove(); } catch (e) {} }, 1100);
}

// ============ MATCH DETECTION ============
function findMatches() {
    if (!grid) return [];
    var m = [];
    var inSet = {};
    function addM(candy) {
        var key = candy.c + ',' + candy.r;
        if (!inSet[key]) { inSet[key] = true; m.push(candy); }
    }
    // Horizontal
    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS - 2; c++) {
            var c1 = grid[c][r];
            if (!c1 || c1.dying) continue;
            var len = 1;
            while (c + len < COLS && grid[c + len][r] && !grid[c + len][r].dying && grid[c + len][r].type === c1.type) len++;
            if (len >= 3) { for (var i = 0; i < len; i++) addM(grid[c + i][r]); c += len - 1; }
        }
    }
    // Vertical
    for (var c2 = 0; c2 < COLS; c2++) {
        for (var r2 = 0; r2 < ROWS - 2; r2++) {
            var c3 = grid[c2][r2];
            if (!c3 || c3.dying) continue;
            var len2 = 1;
            while (r2 + len2 < ROWS && grid[c2][r2 + len2] && !grid[c2][r2 + len2].dying && grid[c2][r2 + len2].type === c3.type) len2++;
            if (len2 >= 3) { for (var j = 0; j < len2; j++) addM(grid[c2][r2 + j]); r2 += len2 - 1; }
        }
    }
    return m;
}

function explode(x, y, col) {
    var n = Math.min(12, Math.max(6, Math.floor(tileSize * 0.25)));
    for (var i = 0; i < n; i++) particles.push(new Particle(x, y, col));
}

// ============ ASYNC GAME LOGIC ============
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function removeMatches(matches) {
    if (!matches.length) return;
    playTone('match');
    gameState = STATE_ANIMATING;
    var pts = matches.length * 25 * combo;
    score += pts;
    var cx = 0, cy = 0;
    for (var i = 0; i < matches.length; i++) {
        var candy = matches[i];
        candy.dying = true; cx += candy.x; cy += candy.y;
        explode(candy.x + tileSize / 2, candy.y + tileSize / 2, COLORS[candy.type].main);
        grid[candy.c][candy.r] = null;
    }
    cx /= matches.length; cy /= matches.length;
    var txt = '+' + pts;
    if (combo > 1) txt += ' ×' + combo;
    floatText(txt, cx + tileSize / 2, cy, '#fcf6ba');
    if (combo >= 2) showCombo(combo);
    updateUI();
    await wait(180);
}

async function dropAndFill() {
    var moved = false;
    var n = numGemTypes();
    for (var c = 0; c < COLS; c++) {
        var empty = 0;
        for (var r = ROWS - 1; r >= 0; r--) {
            if (!grid[c][r]) { empty++; }
            else if (empty > 0) {
                var candy = grid[c][r];
                candy.r += empty; candy.vy = 0;
                grid[c][candy.r] = candy; grid[c][r] = null; moved = true;
            }
        }
        for (var k = 0; k < empty; k++) {
            grid[c][k] = new Candy(c, k, Math.floor(Math.random() * n));
            moved = true;
        }
    }
    if (moved) { gameState = STATE_ANIMATING; await wait(250); }
}

async function processBoard() {
    busy = true;
    var matches = findMatches();
    if (matches.length > 0) {
        await removeMatches(matches);
        await dropAndFill();
        combo++;
        await processBoard();
    } else {
        combo = 1; busy = false;
        checkEnd();
    }
}

// ============ SHUFFLE ============
function shuffle() {
    if (!grid) return;
    var types = [];
    for (var c = 0; c < COLS; c++)
        for (var r = 0; r < ROWS; r++)
            if (grid[c][r]) types.push(grid[c][r].type);
    for (var i = types.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = types[i]; types[i] = types[j]; types[j] = tmp;
    }
    var idx = 0;
    for (var c2 = 0; c2 < COLS; c2++)
        for (var r2 = 0; r2 < ROWS; r2++)
            if (grid[c2][r2]) { grid[c2][r2].type = types[idx++]; grid[c2][r2].scale = 0.3; grid[c2][r2].targetScale = 1; }
    if (!hasMoves()) createGrid();
}

// ============ STARS ============
function showStars(n) {
    var c = document.getElementById('level-stars');
    if (!c) return;
    c.innerHTML = '';
    for (var i = 0; i < 3; i++) {
        var s = document.createElement('span');
        s.className = 'star ' + (i < n ? 'earned' : 'empty');
        s.textContent = '⭐';
        s.style.animationDelay = (i * 0.15) + 's';
        c.appendChild(s);
    }
}

// ============ END CHECK ============
function checkEnd() {
    if (gameState === STATE_OVER) return;

    if (score >= targetScore) {
        playTone('win');
        if (gameOverOverlay) gameOverOverlay.classList.remove('hidden');
        if (endTitle) { endTitle.textContent = 'Level Complete!'; endTitle.style.color = '#d4af37'; }
        var earned = score - levelStartScore;
        var left = movesLeft;
        var stars = left >= 8 ? 3 : left >= 3 ? 2 : 1;
        showStars(stars);
        if (endMessage) endMessage.innerHTML = '<span class="gold-text">Magnificent!</span><br>Score: <span class="gold-text">' + score + '</span><br><span style="font-size:0.8em;color:#b0a0ca">+' + earned + ' this level</span>';
        if (btnRestart) btnRestart.querySelector('span').textContent = 'Next Level';
        gameState = STATE_OVER;
        return;
    }

    if (movesLeft <= 0) {
        playTone('lose');
        if (gameOverOverlay) gameOverOverlay.classList.remove('hidden');
        if (endTitle) { endTitle.textContent = 'Out of Moves'; endTitle.style.color = '#ff2a40'; }
        showStars(0);
        if (endMessage) endMessage.innerHTML = 'Needed <span class="gold-text">' + (targetScore - score) + '</span> more<br>Score: <span class="gold-text">' + score + '</span>';
        if (btnRestart) btnRestart.querySelector('span').textContent = 'Try Again';
        gameState = STATE_OVER;
        return;
    }

    if (!hasMoves()) { shuffle(); if (!hasMoves()) createGrid(); }
    gameState = STATE_PLAYING;
}

// ============ POSSIBLE MOVES ============
function hasMoves() {
    if (!grid) return false;
    var s = [];
    for (var c = 0; c < COLS; c++) { s[c] = []; for (var r = 0; r < ROWS; r++) s[c][r] = grid[c][r] ? grid[c][r].type : -1; }
    function chk(g) {
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS - 2; c++) { var t = g[c][r]; if (t !== -1 && t === g[c + 1][r] && t === g[c + 2][r]) return true; }
        for (var c2 = 0; c2 < COLS; c2++) for (var r2 = 0; r2 < ROWS - 2; r2++) { var t2 = g[c2][r2]; if (t2 !== -1 && t2 === g[c2][r2 + 1] && t2 === g[c2][r2 + 2]) return true; }
        return false;
    }
    for (var c3 = 0; c3 < COLS; c3++) {
        for (var r3 = 0; r3 < ROWS; r3++) {
            if (c3 < COLS - 1) { var t = s[c3][r3]; s[c3][r3] = s[c3 + 1][r3]; s[c3 + 1][r3] = t; if (chk(s)) return true; t = s[c3][r3]; s[c3][r3] = s[c3 + 1][r3]; s[c3 + 1][r3] = t; }
            if (r3 < ROWS - 1) { var t2 = s[c3][r3]; s[c3][r3] = s[c3][r3 + 1]; s[c3][r3 + 1] = t2; if (chk(s)) return true; t2 = s[c3][r3]; s[c3][r3] = s[c3][r3 + 1]; s[c3][r3 + 1] = t2; }
        }
    }
    return false;
}

// ============ SWAP ============
async function doSwap(c1, r1, c2, r2) {
    if (gameState !== STATE_PLAYING || busy) return;
    if (!grid || !grid[c1] || !grid[c2] || !grid[c1][r1] || !grid[c2][r2]) return;
    gameState = STATE_ANIMATING; busy = true;

    var a = grid[c1][r1], b = grid[c2][r2];
    a.c = c2; a.r = r2; b.c = c1; b.r = r1;
    grid[c2][r2] = a; grid[c1][r1] = b;
    playTone('swap');
    await wait(150);

    var matches = findMatches();
    if (matches.length > 0) {
        movesLeft--; updateUI();
        await processBoard();
    } else {
        // Revert
        a.c = c1; a.r = r1; b.c = c2; b.r = r2;
        grid[c1][r1] = a; grid[c2][r2] = b;
        playTone('bad');
        await wait(160);
        busy = false; gameState = STATE_PLAYING;
    }
}

// ============ BOARD DRAWING ============
function drawBoard() {
    if (!grid) return;
    ctx.save();
    var bw = COLS * tileSize, bh = ROWS * tileSize;
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 18;
    var gr = ctx.createLinearGradient(offX, offY, offX + bw, offY + bh);
    gr.addColorStop(0, '#fcf6ba'); gr.addColorStop(0.5, '#b38728'); gr.addColorStop(1, '#fbf5b7');
    ctx.strokeStyle = gr; ctx.lineWidth = 2.5; ctx.fillStyle = 'rgba(20,5,30,0.78)';
    roundRect(offX - 6, offY - 6, bw + 12, bh + 12, 10); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    for (var c = 0; c < COLS; c++) {
        for (var r = 0; r < ROWS; r++) {
            var x = offX + c * tileSize, y = offY + r * tileSize;
            ctx.fillStyle = (c + r) % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.1)';
            ctx.strokeStyle = 'rgba(212,175,55,0.06)'; ctx.lineWidth = 0.5;
            roundRect(x + 1, y + 1, tileSize - 2, tileSize - 2, 4); ctx.fill(); ctx.stroke();
        }
    }

    // Selected highlight
    if (selected && grid[selected.c] && grid[selected.c][selected.r]) {
        ctx.fillStyle = 'rgba(212,175,55,0.18)';
        roundRect(offX + selected.c * tileSize, offY + selected.r * tileSize, tileSize, tileSize, 6);
        ctx.fill();
        ctx.shadowColor = '#fcf6ba'; ctx.shadowBlur = 12;
        ctx.strokeStyle = '#fcf6ba'; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
    }
    ctx.restore();
}

// ============ LEVEL INTRO ANIMATION ============
function drawLevelIntro() {
    if (!levelIntro) return;
    levelIntro.timer--;
    if (levelIntro.timer <= 30) levelIntro.alpha -= 0.033;
    if (levelIntro.alpha <= 0 || levelIntro.timer <= 0) { levelIntro = null; return; }

    ctx.save();
    ctx.globalAlpha = levelIntro.alpha;
    ctx.font = 'bold ' + Math.max(28, tileSize * 0.8) + 'px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Gold gradient text
    var grd = ctx.createLinearGradient(canvas.width / 2 - 100, 0, canvas.width / 2 + 100, 0);
    grd.addColorStop(0, '#bf953f'); grd.addColorStop(0.5, '#fcf6ba'); grd.addColorStop(1, '#b38728');
    ctx.fillStyle = grd;

    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 15;
    var scale = levelIntro.timer > 70 ? 0.5 + (90 - levelIntro.timer) * 0.025 : 1;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.fillText(levelIntro.text, 0, 0);

    // Sub text
    ctx.font = Math.max(14, tileSize * 0.35) + 'px Nunito, sans-serif';
    ctx.fillStyle = '#b0a0ca';
    ctx.shadowBlur = 8;
    ctx.fillText('Target: ' + targetScore + '  |  Moves: ' + movesLeft, 0, Math.max(30, tileSize * 0.7));

    ctx.restore();
}

// ============ INPUT ============
function gridAt(px, py) {
    var c = Math.floor((px - offX) / tileSize);
    var r = Math.floor((py - offY) / tileSize);
    return (c >= 0 && c < COLS && r >= 0 && r < ROWS) ? { c: c, r: r } : null;
}

// Mouse
canvas.addEventListener('mousedown', function (e) {
    if (gameState !== STATE_PLAYING || busy) return;
    initAudio();
    var p = gridAt(e.clientX, e.clientY);
    if (p && grid && grid[p.c][p.r] && !grid[p.c][p.r].dying) {
        selected = { c: p.c, r: p.r }; playTone('click');
    }
});
canvas.addEventListener('mousemove', function (e) {
    if (gameState !== STATE_PLAYING || !selected || busy) return;
    var p = gridAt(e.clientX, e.clientY);
    if (p && (p.c !== selected.c || p.r !== selected.r)) {
        var dc = Math.abs(p.c - selected.c), dr = Math.abs(p.r - selected.r);
        if ((dc === 1 && dr === 0) || (dc === 0 && dr === 1)) {
            if (grid && grid[p.c][p.r] && !grid[p.c][p.r].dying) {
                var sc = selected.c, sr = selected.r;
                selected = null;
                doSwap(sc, sr, p.c, p.r);
            }
        }
    }
});
canvas.addEventListener('mouseup', function () { selected = null; });

// Touch — swipe
canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (gameState !== STATE_PLAYING || busy) return;
    initAudio();
    var touch = e.touches[0];
    tSX = touch.clientX; tSY = touch.clientY; tActive = true;
    var p = gridAt(touch.clientX, touch.clientY);
    if (p && grid && grid[p.c][p.r] && !grid[p.c][p.r].dying) {
        selected = { c: p.c, r: p.r }; tSC = p.c; tSR = p.r; playTone('click');
    }
}, { passive: false });

canvas.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!tActive || !selected || gameState !== STATE_PLAYING || busy) return;
    var touch = e.touches[0];
    var dx = touch.clientX - tSX, dy = touch.clientY - tSY;
    var threshold = Math.max(12, tileSize * 0.2);
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        var tc = tSC, tr = tSR;
        if (Math.abs(dx) > Math.abs(dy)) tc += dx > 0 ? 1 : -1;
        else tr += dy > 0 ? 1 : -1;
        if (tc >= 0 && tc < COLS && tr >= 0 && tr < ROWS) {
            var sc = selected.c, sr = selected.r;
            selected = null; tActive = false;
            doSwap(sc, sr, tc, tr);
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', function (e) {
    e.preventDefault(); selected = null; tActive = false;
}, { passive: false });

// Prevent scroll
document.addEventListener('touchmove', function (e) {
    if (gameState === STATE_PLAYING || gameState === STATE_ANIMATING) e.preventDefault();
}, { passive: false });

// ============ MAIN LOOP ============
function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (grid) {
        drawBoard();
        for (var c = 0; c < COLS; c++)
            for (var r = 0; r < ROWS; r++) {
                var candy = grid[c][r];
                if (candy) { candy.update(); candy.draw(); }
            }
    }

    // Particles
    for (var i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // Level intro
    drawLevelIntro();

    requestAnimationFrame(loop);
}

// ============ BUTTON HANDLERS ============

// START GAME → Start level directly! No overlay popup, no extra steps.
if (btnStart) {
    btnStart.onclick = function () {
        initAudio();
        playTone('click');
        startLevel();
    };
}

// Next Level / Try Again
if (btnRestart) {
    btnRestart.onclick = function () {
        initAudio();
        playTone('click');
        if (score >= targetScore) { level++; }
        else { score = levelStartScore; }
        startLevel();
    };
}

// Pause
if (btnPause) {
    btnPause.onclick = function () {
        if (gameState === STATE_PLAYING) {
            playTone('click');
            gameState = STATE_PAUSED;
            if (pauseOverlay) pauseOverlay.classList.remove('hidden');
        }
    };
}

// Resume
if (btnResume) {
    btnResume.onclick = function () {
        playTone('click');
        gameState = STATE_PLAYING;
        if (pauseOverlay) pauseOverlay.classList.add('hidden');
    };
}

// Quit → Restart level
if (btnQuit) {
    btnQuit.onclick = function () {
        playTone('click');
        score = levelStartScore;
        startLevel();
    };
}

// Sound
if (btnSound) {
    btnSound.onclick = function () {
        soundOn = !soundOn;
        btnSound.textContent = soundOn ? '🔊' : '🔇';
        if (soundOn) { initAudio(); playTone('click'); }
    };
}

// ============ INIT ============
resize();
if (tutorialOverlay) tutorialOverlay.classList.remove('hidden');
requestAnimationFrame(loop);
