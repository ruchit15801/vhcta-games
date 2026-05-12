// ═══════════════════════════════════════════════════════
// BRIDGE CROSSING CHALLENGE — Luxury Neon-Gold Edition
// ═══════════════════════════════════════════════════════

(function () {
  // ── DOM SETUP ──────────────────────────────────────────
  const container = document.getElementById('game-container');

  // HUD
  const hudEl = document.createElement('div');
  hudEl.id = 'hud';
  hudEl.innerHTML = `
    <div class="hud-block">
      <span class="hud-label">Score</span>
      <span class="hud-value" id="hud-score">0</span>
    </div>
    <div class="hud-title">⚡ BRIDGE CROSSING ⚡</div>
    <div class="hud-block">
      <span class="hud-label">Level</span>
      <span class="hud-value cyan" id="hud-level">1</span>
    </div>
    <div class="hud-block">
      <span class="hud-label">Lives</span>
      <div class="lives-container" id="hud-lives">
        <span class="life-icon">❤️</span>
        <span class="life-icon">❤️</span>
        <span class="life-icon">❤️</span>
      </div>
    </div>
  `;
  document.body.appendChild(hudEl);

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'gameCanvas';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Toast
  const toast = document.createElement('div');
  toast.id = 'toast';
  document.body.appendChild(toast);

  // Mobile controls
  const mobileCtrl = document.createElement('div');
  mobileCtrl.id = 'mobile-controls';
  mobileCtrl.innerHTML = `
    <button class="ctrl-btn" id="btn-left">◀</button>
    <button class="ctrl-btn" id="btn-up">▲</button>
    <button class="ctrl-btn" id="btn-down">▼</button>
    <button class="ctrl-btn" id="btn-right">▶</button>
  `;
  document.body.appendChild(mobileCtrl);

  // ── SCREENS ───────────────────────────────────────────
  function makeScreen(id, iconTxt, titleTxt, subTxt, btn1, btn2) {
    const s = document.createElement('div');
    s.className = 'screen-overlay hidden';
    s.id = id;
    s.innerHTML = `
      <div class="overlay-icon">${iconTxt}</div>
      <div class="overlay-title">${titleTxt}</div>
      <div class="overlay-sub">${subTxt}</div>
      <div id="${id}-stat" class="overlay-stat"></div>
      <button class="btn-luxury" id="${id}-btn1">${btn1}</button>
      ${btn2 ? `<button class="btn-ghost" id="${id}-btn2">${btn2}</button>` : ''}
    `;
    document.body.appendChild(s);
    return s;
  }

  const startScreen  = makeScreen('start-screen',  '🌉', 'BRIDGE CROSSING', 'Navigate the perilous bridge. Avoid the obstacles. Reach the other side!', 'PLAY NOW');
  const gameoverScreen = makeScreen('gameover-screen','💀','GAME OVER',       'The bridge claims another soul...', 'TRY AGAIN', 'MAIN MENU');
  const winScreen    = makeScreen('win-screen',     '🏆', 'BRIDGE CLEARED!', 'You crossed the bridge!', 'NEXT LEVEL', 'MAIN MENU');

  startScreen.classList.remove('hidden');

  // ── CONSTANTS ─────────────────────────────────────────
  const COLS = 9, ROWS = 7;
  const TILE = 72;
  const W = COLS * TILE, H = ROWS * TILE;

  // ── STATE ─────────────────────────────────────────────
  let score = 0, lives = 3, level = 1;
  let player, lanes, running = false, animId = null;
  let keys = {};

  // ── RESIZE ────────────────────────────────────────────
  function resize() {
    const scale = Math.min(window.innerWidth / W, (window.innerHeight - 56) / H, 1);
    canvas.width  = W;
    canvas.height = H;
    canvas.style.width  = (W * scale) + 'px';
    canvas.style.height = (H * scale) + 'px';
    canvas.style.marginTop = '56px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ── LEVEL CONFIG ──────────────────────────────────────
  function getLaneConfig(lvl) {
    const speed = 1 + (lvl - 1) * 0.35;
    return [
      { type: 'safe',    y: 6, color: '#1a1a3a' },
      { type: 'traffic', y: 5, color: '#0a1520', speed:  speed,      dir:  1 },
      { type: 'traffic', y: 4, color: '#0a1520', speed:  speed*1.3,  dir: -1 },
      { type: 'log',     y: 3, color: '#0d1a10', speed:  speed*0.8,  dir:  1, isWater: true },
      { type: 'water',   y: 3, color: '#051020' },
      { type: 'log',     y: 2, color: '#0d1a10', speed:  speed*1.1,  dir: -1, isWater: true },
      { type: 'safe',    y: 0, color: '#1a1a3a' },
    ];
  }

  // ── LANE / OBSTACLE CREATION ──────────────────────────
  function makeLanes(lvl) {
    const config = getLaneConfig(lvl);
    return config.map(cfg => {
      const lane = { ...cfg };
      lane.py = cfg.y * TILE;
      if (cfg.type === 'traffic') {
        lane.obstacles = [];
        let x = cfg.dir > 0 ? 0 : W;
        const gap = TILE * (2.5 - lvl * 0.1);
        for (let i = 0; i < COLS; i++) {
          lane.obstacles.push({ x: (cfg.dir > 0 ? x : x - TILE * 1.5) + i * gap, w: TILE * 1.4 });
        }
      }
      if (cfg.type === 'log') {
        lane.obstacles = [];
        for (let i = 0; i < 3; i++) {
          lane.obstacles.push({ x: (i * W / 3) + Math.random() * (W / 5), w: TILE * (2 + Math.random()) });
        }
      }
      return lane;
    });
  }

  // ── PLAYER ────────────────────────────────────────────
  function makePlayer() {
    return { col: 4, row: 6, x: 4 * TILE + TILE / 2, y: 6 * TILE + TILE / 2, onLog: null, dead: false, moveCD: 0, trail: [] };
  }

  // ── SHOW/HIDE SCREENS ─────────────────────────────────
  function showScreen(el, statTxt) {
    [startScreen, gameoverScreen, winScreen].forEach(s => s.classList.add('hidden'));
    if (statTxt) el.querySelector('[id$="-stat"]').textContent = statTxt;
    el.classList.remove('hidden');
  }

  function hideAllScreens() {
    [startScreen, gameoverScreen, winScreen].forEach(s => s.classList.add('hidden'));
  }

  // ── UPDATE HUD ────────────────────────────────────────
  function updateHUD() {
    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-level').textContent = level;
    const lifeIcons = document.querySelectorAll('.life-icon');
    lifeIcons.forEach((ic, i) => ic.classList.toggle('lost', i >= lives));
  }

  // ── TOAST ─────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg, dur = 1800) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), dur);
  }

  // ── DRAWING ───────────────────────────────────────────
  const COLORS = {
    gold:   '#FFD700', cyan: '#00F5FF', red: '#FF003C',
    purple: '#BF00FF', bg:  '#03030A', water: '#051A3A',
    log:    '#7B4F2E', car: ['#FF003C','#00F5FF','#BF00FF','#FFD700']
  };

  function drawBG() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawLane(lane) {
    // Background strip
    const rowY = lane.y * TILE;
    if (lane.type === 'water' || (lane.type === 'log' && lane.isWater)) {
      // Water gradient
      const grd = ctx.createLinearGradient(0, rowY, 0, rowY + TILE);
      grd.addColorStop(0, '#020E25');
      grd.addColorStop(1, '#051A3A');
      ctx.fillStyle = grd;
      ctx.fillRect(0, rowY, W, TILE);
      // Wave shimmer
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 1.5;
      const t = Date.now() / 700;
      for (let wx = 0; wx < W; wx += 30) {
        ctx.beginPath();
        ctx.moveTo(wx, rowY + TILE / 2 + Math.sin(t + wx * 0.05) * 6);
        ctx.lineTo(wx + 20, rowY + TILE / 2 + Math.sin(t + (wx + 20) * 0.05) * 6);
        ctx.stroke();
      }
      ctx.restore();
    } else if (lane.type === 'safe') {
      const grd = ctx.createLinearGradient(0, rowY, 0, rowY + TILE);
      grd.addColorStop(0, '#0F0F2A');
      grd.addColorStop(1, '#07071A');
      ctx.fillStyle = grd;
      ctx.fillRect(0, rowY, W, TILE);
      // Gold lane edge
      ctx.fillStyle = 'rgba(255,215,0,0.15)';
      ctx.fillRect(0, rowY, W, 2);
      ctx.fillRect(0, rowY + TILE - 2, W, 2);
    } else {
      ctx.fillStyle = '#070714';
      ctx.fillRect(0, rowY, W, TILE);
      // Road markings
      ctx.save();
      ctx.setLineDash([TILE * 0.3, TILE * 0.3]);
      ctx.strokeStyle = 'rgba(255,215,0,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, rowY + TILE / 2);
      ctx.lineTo(W, rowY + TILE / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawCar(obs, lane, idx) {
    const color = COLORS.car[idx % COLORS.car.length];
    const x = obs.x, y = lane.y * TILE + 4, w = obs.w, h = TILE - 8;
    ctx.save();
    // Body glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    const grd = ctx.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, lighten(color, 40));
    grd.addColorStop(1, color);
    ctx.fillStyle = grd;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    // Windshield
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,245,255,0.25)';
    roundRect(ctx, x + w * 0.25, y + 4, w * 0.5, h * 0.35, 4);
    ctx.fill();
    // Headlights
    ctx.fillStyle = '#FFE96A';
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 14;
    const lx = lane.dir > 0 ? x + w - 8 : x + 4;
    ctx.fillRect(lx, y + h * 0.2, 5, h * 0.2);
    ctx.fillRect(lx, y + h * 0.6, 5, h * 0.2);
    ctx.restore();
  }

  function drawLog(obs, lane) {
    const x = obs.x, y = lane.y * TILE + 8, w = obs.w, h = TILE - 16;
    ctx.save();
    ctx.shadowColor = '#7B4F2E'; ctx.shadowBlur = 12;
    const grd = ctx.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, '#A06040');
    grd.addColorStop(1, '#5A2E10');
    ctx.fillStyle = grd;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    // Wood grain
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#3A1A05';
    ctx.lineWidth = 1.5;
    for (let gx = x + 12; gx < x + w - 6; gx += 14) {
      ctx.beginPath();
      ctx.moveTo(gx, y + 2);
      ctx.lineTo(gx, y + h - 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(p) {
    if (p.dead) return;
    const px = p.x, py = p.y;
    ctx.save();
    const pulse = 1 + 0.06 * Math.sin(Date.now() / 200);

    // Trail
    p.trail.forEach((t, i) => {
      const a = (i / p.trail.length) * 0.35;
      ctx.globalAlpha = a;
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 10 * a, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Outer glow ring
    ctx.shadowColor = COLORS.gold; ctx.shadowBlur = 30;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(px, py, 22 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Body
    const grd = ctx.createRadialGradient(px - 6, py - 6, 2, px, py, 18);
    grd.addColorStop(0, '#FFE96A');
    grd.addColorStop(0.6, '#FFD700');
    grd.addColorStop(1, '#B8960C');
    ctx.fillStyle = grd;
    ctx.shadowColor = COLORS.gold; ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.fill();

    // Face
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#030310';
    ctx.beginPath(); ctx.arc(px - 5, py - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 5, py - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#030310'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py + 2, 6, 0, Math.PI);
    ctx.stroke();

    // Crown
    ctx.fillStyle = COLORS.gold;
    ctx.shadowColor = COLORS.gold; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(px - 9, py - 18);
    ctx.lineTo(px - 5, py - 24);
    ctx.lineTo(px, py - 20);
    ctx.lineTo(px + 5, py - 24);
    ctx.lineTo(px + 9, py - 18);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawGoalLine() {
    const y = 0;
    const grd = ctx.createLinearGradient(0, y, W, y);
    grd.addColorStop(0,   'rgba(0,245,255,0)');
    grd.addColorStop(0.5, 'rgba(0,245,255,0.5)');
    grd.addColorStop(1,   'rgba(0,245,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, y, W, TILE);

    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = COLORS.cyan;
    ctx.shadowColor = COLORS.cyan; ctx.shadowBlur = 16;
    ctx.textAlign = 'center';
    ctx.fillText('◀ GOAL ▶', W / 2, TILE / 2 + 7);
    ctx.shadowBlur = 0;
  }

  // ── HELPERS ───────────────────────────────────────────
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16) + amt);
    const g = Math.min(255, ((n >> 8) & 0xFF) + amt);
    const b = Math.min(255, (n & 0xFF) + amt);
    return `rgb(${r},${g},${b})`;
  }

  // ── COLLISION ─────────────────────────────────────────
  function playerRow() { return Math.round(player.y / TILE - 0.5); }

  function checkCollisions() {
    const row = playerRow();
    const px = player.x, pr = 14;

    for (const lane of lanes) {
      if (lane.y !== row) continue;

      if (lane.type === 'traffic' && lane.obstacles) {
        for (const obs of lane.obstacles) {
          if (px + pr > obs.x + 4 && px - pr < obs.x + obs.w - 4) {
            killPlayer();
            return;
          }
        }
      }

      if (lane.type === 'water') {
        // water: check if NOT on any log in same row area
        const logLanes = lanes.filter(l => l.isWater && l.y === row);
        if (logLanes.length === 0) { killPlayer(); return; }
        let onLog = false;
        for (const ll of logLanes) {
          for (const obs of ll.obstacles) {
            if (px + pr > obs.x && px - pr < obs.x + obs.w) { onLog = true; player.onLog = { lane: ll, obs }; }
          }
        }
        if (!onLog) { killPlayer(); return; }
      }
    }

    // log row check
    if (player.onLog) {
      const { lane: ll, obs } = player.onLog;
      if (ll.y !== row) { player.onLog = null; return; }
      if (player.x - pr < 0 || player.x + pr > W) { killPlayer(); return; }
    }
  }

  function killPlayer() {
    if (player.dead) return;
    player.dead = true;
    lives--;
    updateHUD();
    showToast('💀 Careful!', 1200);
    setTimeout(() => {
      if (lives <= 0) { endGame(); return; }
      resetPlayer();
    }, 900);
  }

  function resetPlayer() {
    player.col = 4; player.row = 6;
    player.x = 4 * TILE + TILE / 2;
    player.y = 6 * TILE + TILE / 2;
    player.dead = false;
    player.onLog = null;
    player.trail = [];
  }

  // ── MOVE ──────────────────────────────────────────────
  function movePlayer(dx, dy) {
    if (player.dead || player.moveCD > 0) return;
    const nx = player.x + dx * TILE;
    const ny = player.y + dy * TILE;
    if (nx < TILE / 2 || nx > W - TILE / 2) return;
    if (ny < TILE / 2 || ny > H - TILE / 2) return;

    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > 5) player.trail.shift();

    player.x = nx; player.y = ny;
    player.onLog = null;
    player.moveCD = 180;

    if (dy < 0) { score += 10 * level; updateHUD(); }

    // Win check
    if (player.y <= TILE / 2) { winLevel(); }
  }

  // ── GAME LOOP ─────────────────────────────────────────
  let lastTime = 0;
  function loop(ts) {
    if (!running) return;
    const dt = ts - lastTime; lastTime = ts;

    if (player.moveCD > 0) player.moveCD -= dt;

    // Update obstacles
    for (const lane of lanes) {
      if (!lane.obstacles || (!lane.speed)) continue;
      for (const obs of lane.obstacles) {
        obs.x += lane.speed * lane.dir * (dt / 16);
        if (lane.dir > 0 && obs.x > W + TILE)   obs.x = -obs.w - TILE;
        if (lane.dir < 0 && obs.x + obs.w < -TILE) obs.x = W + TILE;
      }
      // Move player on log
      if (lane.isWater && player.onLog && player.onLog.lane === lane) {
        player.x += lane.speed * lane.dir * (dt / 16);
      }
    }

    // Input
    if (!player.dead) {
      if (keys['ArrowUp']    || keys['KeyW']) { movePlayer(0, -1); keys['ArrowUp'] = keys['KeyW'] = false; }
      if (keys['ArrowDown']  || keys['KeyS']) { movePlayer(0,  1); keys['ArrowDown'] = keys['KeyS'] = false; }
      if (keys['ArrowLeft']  || keys['KeyA']) { movePlayer(-1, 0); keys['ArrowLeft'] = keys['KeyA'] = false; }
      if (keys['ArrowRight'] || keys['KeyD']) { movePlayer( 1, 0); keys['ArrowRight'] = keys['KeyD'] = false; }
    }

    checkCollisions();

    // ── DRAW ──
    drawBG();
    lanes.forEach(drawLane);
    lanes.forEach(lane => {
      if (lane.obstacles) {
        lane.obstacles.forEach((obs, i) => {
          if (lane.type === 'traffic') drawCar(obs, lane, i);
          if (lane.type === 'log')    drawLog(obs, lane);
        });
      }
    });
    drawGoalLine();
    drawPlayer(player);

    animId = requestAnimationFrame(loop);
  }

  // ── GAME FLOW ─────────────────────────────────────────
  function startGame() {
    score = 0; lives = 3; level = 1;
    updateHUD();
    startLevel();
  }

  function startLevel() {
    lanes  = makeLanes(level);
    player = makePlayer();
    running = true;
    cancelAnimationFrame(animId);
    hideAllScreens();
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
    updateHUD();
    showToast(`⚡ Level ${level}`, 1200);
  }

  function winLevel() {
    running = false;
    cancelAnimationFrame(animId);
    score += 100 * level;
    updateHUD();
    showScreen(winScreen, `Score: ${score}  |  Level: ${level}`);
  }

  function endGame() {
    running = false;
    cancelAnimationFrame(animId);
    showScreen(gameoverScreen, `Score: ${score}`);
  }

  // ── BUTTON EVENTS ─────────────────────────────────────
  document.getElementById('start-screen-btn1').addEventListener('click', startGame);
  document.getElementById('gameover-screen-btn1').addEventListener('click', startGame);
  document.getElementById('gameover-screen-btn2').addEventListener('click', () => showScreen(startScreen));
  document.getElementById('win-screen-btn1').addEventListener('click', () => { level++; startLevel(); });
  document.getElementById('win-screen-btn2').addEventListener('click', () => { showScreen(startScreen); });

  // ── KEYBOARD ──────────────────────────────────────────
  window.addEventListener('keydown', e => { keys[e.code] = true; e.preventDefault(); });
  window.addEventListener('keyup',   e => { keys[e.code] = false; });

  // ── MOBILE BUTTONS ────────────────────────────────────
  function mobileMove(dx, dy) {
    if (!running) return;
    movePlayer(dx, dy);
  }
  document.getElementById('btn-up').addEventListener('click',    () => mobileMove(0, -1));
  document.getElementById('btn-down').addEventListener('click',  () => mobileMove(0,  1));
  document.getElementById('btn-left').addEventListener('click',  () => mobileMove(-1, 0));
  document.getElementById('btn-right').addEventListener('click', () => mobileMove( 1, 0));

  // ── SWIPE ─────────────────────────────────────────────
  let sx = 0, sy = 0;
  canvas.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  canvas.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy)) mobileMove(dx > 0 ? 1 : -1, 0);
    else                              mobileMove(0, dy > 0 ? 1 : -1);
  }, { passive: true });
})();