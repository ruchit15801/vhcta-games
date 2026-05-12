/* ============================================
   AEGIS DEFENSE — COMPLETE GAME ENGINE
   v2.4 Production Build
   ============================================ */

'use strict';

// ═══════════════════════════════════════
//   GLOBAL STATE
// ═══════════════════════════════════════
const G = {
  canvas: null, ctx: null,
  W: 0, H: 0,
  cellSize: 0, cols: 0, rows: 0,
  gold: 300, lives: 20, score: 0, kills: 0,
  level: 1, wave: 0, totalWaves: 5,
  waveRunning: false, wavePaused: false,
  speed: 1, paused: false,
  selectedTower: -1,
  selectedPlacedTower: null,
  nukeReady: true, nukeCooldownWaves: 0,
  animId: null,
  lastTime: 0,
  towers: [], enemies: [], projectiles: [], particles: [],
  path: [],
  grid: [],          // 0=empty, 1=path, 2=tower
  spawnQueue: [],
  spawnTimer: 0,
  spawnInterval: 1200,
  waveEnemiesLeft: 0,
  waveEnemiesKilled: 0,
  totalEnemiesInWave: 0,
  scoreMultiplier: 1,
  startTime: 0,
  levelStartLives: 20,
  totalScore: 0,
  assets: {},
};

// ═══════════════════════════════════════
//   ASSET LOADING
// ═══════════════════════════════════════
const ASSET_LIST = {
  'tower_0': 'assets/tower_pulse.svg',
  'tower_1': 'assets/tower_tesla.svg',
  'tower_2': 'assets/tower_inferno.svg',
  'tower_3': 'assets/tower_void.svg',
  'enemy_scout': 'assets/enemy_scout.svg',
  'enemy_soldier': 'assets/enemy_soldier.svg',
  'enemy_tank': 'assets/enemy_tank.svg',
  'enemy_phantom': 'assets/enemy_scout.svg', // Fallback to scout for phantom
  'enemy_berserker': 'assets/enemy_scout.svg', // Fallback to scout
  'enemy_boss': 'assets/enemy_boss.svg',
};

function loadAssets() {
  Object.entries(ASSET_LIST).forEach(([key, path]) => {
    const img = new Image();
    img.src = path;
    img.onload = () => { G.assets[key] = img; };
    // Handle error gracefully (e.g. if file doesn't exist yet)
    img.onerror = () => { console.warn(`Failed to load asset: ${path}`); };
  });
}

// ═══════════════════════════════════════
//   LEVEL CONFIGS (10 Levels)
// ═══════════════════════════════════════
const LEVELS = [
  { // Level 1 — Tutorial
    waves: 5, startGold: 300, lives: 20,
    name: "SECTOR ALPHA",
    pathKey: 'A',
    waveConfigs: [
      { scout:6 },
      { scout:8, soldier:2 },
      { scout:6, soldier:4 },
      { soldier:8, scout:4 },
      { soldier:10, boss:1 }
    ]
  },
  { // Level 2
    waves: 6, startGold: 300, lives: 20,
    name: "SECTOR BRAVO",
    pathKey: 'B',
    waveConfigs: [
      { scout:10, soldier:2 },
      { soldier:8, scout:4 },
      { soldier:10, tank:2 },
      { tank:4, soldier:8 },
      { tank:4, soldier:6, scout:6 },
      { soldier:8, tank:4, boss:1 }
    ]
  },
  { // Level 3
    waves: 6, startGold: 280, lives: 18,
    name: "SECTOR CHARLIE",
    pathKey: 'C',
    waveConfigs: [
      { soldier:10, scout:5 },
      { tank:5, soldier:8 },
      { phantom:4, scout:8 },
      { phantom:6, tank:4 },
      { soldier:10, phantom:6, tank:2 },
      { tank:6, phantom:4, boss:1, boss2:0 }
    ]
  },
  { // Level 4
    waves: 7, startGold: 250, lives: 18,
    name: "SECTOR DELTA",
    pathKey: 'A',
    waveConfigs: [
      { scout:12, soldier:6 },
      { soldier:10, tank:4 },
      { phantom:8, soldier:8 },
      { berserker:4, soldier:8 },
      { berserker:6, tank:4, phantom:4 },
      { berserker:8, phantom:6, soldier:8 },
      { tank:6, berserker:4, boss:1 }
    ]
  },
  { // Level 5
    waves: 7, startGold: 250, lives: 16,
    name: "SECTOR ECHO",
    pathKey: 'B',
    waveConfigs: [
      { soldier:12, phantom:4 },
      { tank:6, berserker:4 },
      { berserker:8, phantom:6 },
      { phantom:8, tank:6, soldier:6 },
      { berserker:10, tank:6, scout:8 },
      { phantom:10, berserker:6, tank:4 },
      { tank:8, berserker:6, boss:1, boss2:0 }
    ]
  },
  { // Level 6
    waves: 8, startGold: 230, lives: 16,
    name: "SECTOR FOXTROT",
    pathKey: 'C',
    waveConfigs: [
      { soldier:14, scout:8 },
      { tank:8, berserker:4 },
      { phantom:10, berserker:6 },
      { berserker:10, tank:6, scout:6 },
      { phantom:12, soldier:10, tank:4 },
      { berserker:10, phantom:8, tank:6 },
      { tank:10, berserker:8, phantom:6 },
      { boss:2, berserker:8, tank:6 }
    ]
  },
  { // Level 7
    waves: 8, startGold: 220, lives: 15,
    name: "SECTOR GHOST",
    pathKey: 'A',
    waveConfigs: [
      { soldier:16, phantom:6 },
      { tank:10, berserker:6 },
      { berserker:12, phantom:8 },
      { phantom:12, tank:8, scout:8 },
      { berserker:14, tank:8, soldier:8 },
      { phantom:14, berserker:10, tank:6 },
      { tank:12, berserker:10, phantom:8 },
      { boss:2, tank:8, berserker:8, phantom:4 }
    ]
  },
  { // Level 8
    waves: 9, startGold: 200, lives: 15,
    name: "SECTOR HAVOC",
    pathKey: 'B',
    waveConfigs: [
      { soldier:18, phantom:6 },
      { tank:12, berserker:6 },
      { berserker:14, phantom:10 },
      { phantom:14, tank:10 },
      { berserker:16, tank:8, scout:10 },
      { phantom:16, berserker:10, tank:8 },
      { berserker:14, tank:12, phantom:10 },
      { boss:2, berserker:10, tank:8 },
      { boss:3, berserker:10, phantom:8 }
    ]
  },
  { // Level 9
    waves: 9, startGold: 180, lives: 12,
    name: "SECTOR INFERNO",
    pathKey: 'C',
    waveConfigs: [
      { soldier:20, phantom:8 },
      { tank:14, berserker:8 },
      { berserker:16, phantom:12 },
      { phantom:16, tank:12, berserker:6 },
      { berserker:18, tank:10, scout:10 },
      { phantom:18, berserker:12, tank:10 },
      { tank:16, berserker:14, phantom:12 },
      { boss:3, berserker:12, tank:10 },
      { boss:3, berserker:12, phantom:10, tank:8 }
    ]
  },
  { // Level 10 — FINAL
    waves: 10, startGold: 150, lives: 10,
    name: "FINAL BASTION",
    pathKey: 'A',
    waveConfigs: [
      { soldier:20, phantom:10 },
      { tank:16, berserker:10 },
      { berserker:18, phantom:14 },
      { phantom:18, tank:14, berserker:8 },
      { berserker:20, tank:12, scout:12 },
      { phantom:20, berserker:14, tank:12 },
      { boss:3, berserker:14, tank:12 },
      { boss:3, phantom:14, berserker:12 },
      { boss:4, berserker:14, phantom:12, tank:10 },
      { boss:5, berserker:16, phantom:14, tank:12 }
    ]
  }
];

// ═══════════════════════════════════════
//   PATH DEFINITIONS (3 layouts)
// ═══════════════════════════════════════
function buildPath(key, cols, rows) {
  const pathDefs = {
    'A': (c, r) => {
      const p = [];
      const mid1 = Math.floor(r * 0.35);
      const mid2 = Math.floor(r * 0.65);
      // Enter left, zigzag
      for (let x = 0; x < c; x++) p.push([x, 1]);
      for (let y = 1; y <= mid1; y++) p.push([c-1, y]);
      for (let x = c-1; x >= 0; x--) p.push([x, mid1]);
      for (let y = mid1; y <= mid2; y++) p.push([0, y]);
      for (let x = 0; x < c; x++) p.push([x, mid2]);
      for (let y = mid2; y <= r-2; y++) p.push([c-1, y]);
      for (let x = c-1; x >= 0; x--) p.push([x, r-2]);
      return p;
    },
    'B': (c, r) => {
      const p = [];
      const m = Math.floor(c / 2);
      for (let y = 0; y < r; y++) p.push([1, y]);
      for (let x = 1; x <= m; x++) p.push([x, r-2]);
      for (let y = r-2; y >= 1; y--) p.push([m, y]);
      for (let x = m; x <= c-2; x++) p.push([x, 1]);
      for (let y = 1; y < r; y++) p.push([c-2, y]);
      return p;
    },
    'C': (c, r) => {
      const p = [];
      const q1 = Math.floor(c * 0.25);
      const q2 = Math.floor(c * 0.5);
      const q3 = Math.floor(c * 0.75);
      const mid = Math.floor(r / 2);
      for (let x = 0; x <= q1; x++) p.push([x, 1]);
      for (let y = 1; y <= mid; y++) p.push([q1, y]);
      for (let x = q1; x <= q2; x++) p.push([x, mid]);
      for (let y = mid; y >= 1; y--) p.push([q2, y]);
      for (let x = q2; x <= q3; x++) p.push([x, 1]);
      for (let y = 1; y <= r-2; y++) p.push([q3, y]);
      for (let x = q3; x < c; x++) p.push([x, r-2]);
      return p;
    }
  };
  const rawPath = pathDefs[key](cols, rows);
  // Deduplicate
  const seen = new Set();
  return rawPath.filter(([cx, cy]) => {
    const k = `${cx},${cy}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

// ═══════════════════════════════════════
//   TOWER DEFINITIONS
// ═══════════════════════════════════════
const TOWER_DEFS = [
  { // 0 — Pulse Cannon
    name: 'PULSE', cost: 100, color: '#1565c0', accent: '#4fc3f7',
    range: 3, damage: 20, fireRate: 800, projectileSpeed: 8,
    projectileColor: '#4fc3f7', sound: 'pulse',
    upgrades: [
      { range: 3.5, damage: 30, fireRate: 700, cost: 80 },
      { range: 4, damage: 45, fireRate: 600, cost: 140 },
      { range: 4.5, damage: 65, fireRate: 500, cost: 220 },
    ]
  },
  { // 1 — Tesla Grid
    name: 'TESLA', cost: 150, color: '#1b5e20', accent: '#81c784',
    range: 2.5, damage: 15, fireRate: 600, projectileSpeed: 0, splash: true, splashRadius: 1.5,
    slow: 0.5, slowDuration: 1000,
    projectileColor: '#81c784', sound: 'tesla',
    upgrades: [
      { range: 3, damage: 22, fireRate: 550, cost: 110 },
      { range: 3.5, damage: 32, fireRate: 480, cost: 190 },
      { range: 4, damage: 48, fireRate: 400, cost: 280 },
    ]
  },
  { // 2 — Inferno
    name: 'INFERNO', cost: 200, color: '#bf360c', accent: '#ffb74d',
    range: 2.8, damage: 35, fireRate: 1200, projectileSpeed: 6,
    burn: true, burnDPS: 8, burnDuration: 2000,
    projectileColor: '#ff6d00', sound: 'inferno',
    upgrades: [
      { range: 3.2, damage: 50, fireRate: 1100, cost: 150 },
      { range: 3.6, damage: 75, fireRate: 950, cost: 250 },
      { range: 4.2, damage: 110, fireRate: 800, cost: 380 },
    ]
  },
  { // 3 — Void Cannon
    name: 'VOID', cost: 350, color: '#4a148c', accent: '#ce93d8',
    range: 5, damage: 80, fireRate: 2000, projectileSpeed: 10,
    splash: true, splashRadius: 1.2,
    projectileColor: '#e040fb', sound: 'void',
    upgrades: [
      { range: 5.5, damage: 120, fireRate: 1800, cost: 250 },
      { range: 6, damage: 175, fireRate: 1600, cost: 400 },
      { range: 7, damage: 250, fireRate: 1400, cost: 600 },
    ]
  }
];

// ═══════════════════════════════════════
//   ENEMY DEFINITIONS
// ═══════════════════════════════════════
function getEnemyDef(type, level) {
  const scale = 1 + (level - 1) * 0.18;
  const defs = {
    scout:     { hp: Math.floor(60*scale),  speed: 2.2, reward: 8,  color: '#ef5350', size: 0.35, armor: 0 },
    soldier:   { hp: Math.floor(140*scale), speed: 1.4, reward: 15, color: '#ffd54f', size: 0.42, armor: 5 },
    tank:      { hp: Math.floor(380*scale), speed: 0.8, reward: 30, color: '#8d6e63', size: 0.55, armor: 20 },
    phantom:   { hp: Math.floor(120*scale), speed: 1.7, reward: 22, color: '#b0bec5', size: 0.38, armor: 8, phantom: true },
    berserker: { hp: Math.floor(200*scale), speed: 1.2, reward: 25, color: '#ff5722', size: 0.45, armor: 10, berserker: true },
    boss:      { hp: Math.floor(1200*scale),speed: 0.7, reward: 150,color: '#212121', size: 0.7,  armor: 40, isBoss: true },
  };
  return defs[type] || defs.soldier;
}

// ═══════════════════════════════════════
//   SCREEN MANAGEMENT
// ═══════════════════════════════════════
function showScreen(id, noSound = false) {
  if (!noSound) AudioEngine.play('click');
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
    el.classList.add('active');
  }
}

function showGuide() { AudioEngine.play('click'); showScreen('guideScreen'); }
function showCredits() { AudioEngine.play('click'); showScreen('creditsScreen'); }

// ═══════════════════════════════════════
//   GAME INIT
// ═══════════════════════════════════════
function checkGuideSeen() {
  try { return localStorage.getItem('aegis_guide_seen'); } catch(e) { return false; }
}
function setGuideSeen() {
  try { localStorage.setItem('aegis_guide_seen', 'true'); } catch(e) {}
}

function startGame() {
  AudioEngine.resume();
  if (!checkGuideSeen()) {
    showGuide();
    return;
  }
  G.level = 1;
  G.totalScore = 0;
  initLevel();
}

function forceStartGame() {
  AudioEngine.resume();
  setGuideSeen();
  G.level = 1;
  G.totalScore = 0;
  initLevel();
}

function initLevel() {
  const cfg = LEVELS[G.level - 1];
  G.gold = cfg.startGold;
  G.lives = cfg.lives;
  G.levelStartLives = cfg.lives;
  G.score = 0; G.kills = 0;
  G.wave = 0; G.totalWaves = cfg.waves;
  G.waveRunning = false; G.paused = false; G.speed = 1;
  G.selectedTower = -1; G.selectedPlacedTower = null;
  G.towers = []; G.enemies = []; G.projectiles = []; G.particles = [];
  G.spawnQueue = []; G.spawnTimer = 0;
  G.nukeReady = true; G.nukeCooldownWaves = 0;
  G.startTime = Date.now();

  if (G.animId) cancelAnimationFrame(G.animId);

  // Show in-game popup guide if it's level 1
  if (G.level === 1) showInGameTutorial();

  showScreen('gameScreen');
  resizeCanvas(); // Ensure size is set BEFORE buildGrid
  buildGrid(cfg.pathKey);
  updateHUD();
  updateTowerButtons();
  updateControlPanel();

  document.getElementById('bossAlert').style.display = 'none';
  document.getElementById('pauseOverlay').classList.add('hidden');
  document.getElementById('towerMenu').classList.add('hidden');
  document.getElementById('startWaveBtn').disabled = false;

  G.lastTime = performance.now();
  // Use a small timeout to ensure the DOM has settled and sizes are correct
  setTimeout(() => {
    resizeCanvas();
    requestAnimationFrame(gameLoop);
  }, 50);

  AudioEngine.play('waveStart');
}

// ═══════════════════════════════════════
//   CANVAS SETUP & GRID
// ═══════════════════════════════════════
function setupCanvas() {
  console.log("AEGIS DEFENSE: Initializing Canvas...");
  if (!G.canvas) G.canvas = document.getElementById('gameCanvas');
  if (G.canvas && !G.ctx) G.ctx = G.canvas.getContext('2d');
  
  if (!G.canvas) {
    console.error("AEGIS DEFENSE: Canvas element not found!");
    return;
  }
  
  resizeCanvas();
  console.log(`AEGIS DEFENSE: Grid Size ${G.cols}x${G.rows}, Cell Size ${G.cellSize}`);

  G.canvas.addEventListener('click', onCanvasClick);
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  const wrap = G.canvas.parentElement;
  const w = wrap.clientWidth || window.innerWidth;
  const h = wrap.clientHeight || (window.innerHeight - 150); // Fallback for HUD/Panel
  
  G.canvas.width = w;
  G.canvas.height = h;
  G.W = w;
  G.H = h;

  const minDim = Math.min(G.W, G.H);
  G.cellSize = Math.floor(minDim / (G.W > G.H ? 10 : 12));
  G.cellSize = Math.max(G.cellSize, 28);

  G.cols = Math.floor(G.W / G.cellSize);
  G.rows = Math.floor(G.H / G.cellSize);

  if (G.level && LEVELS[G.level-1]) {
    buildGrid(LEVELS[G.level-1].pathKey);
  }
}

function buildGrid(pathKey) {
  G.cols = Math.max(G.cols, 8);
  G.rows = Math.max(G.rows, 6);
  G.grid = Array.from({length: G.rows}, () => new Array(G.cols).fill(0));
  G.path = buildPath(pathKey, G.cols, G.rows);
  G.path.forEach(([c, r]) => {
    if (r >= 0 && r < G.rows && c >= 0 && c < G.cols)
      G.grid[r][c] = 1;
  });
  // Mark existing towers
  G.towers.forEach(t => { G.grid[t.row][t.col] = 2; });
}

// ═══════════════════════════════════════
//   GAME LOOP
// ═══════════════════════════════════════
function gameLoop(timestamp) {
  const raw = timestamp - G.lastTime;
  G.lastTime = timestamp;
  const dt = Math.min(raw, 50) * G.speed;

  if (!G.paused) {
    update(dt);
  }
  render();
  const statusEl = document.getElementById('engineStatus');
  if (statusEl) statusEl.textContent = 'ONLINE';
  G.animId = requestAnimationFrame(gameLoop);
}

function update(dt) {
  spawnEnemies(dt);
  updateEnemies(dt);
  updateTowers(dt);
  updateProjectiles(dt);
  updateParticles(dt);
  checkWaveComplete();
}

// ═══════════════════════════════════════
//   WAVE MANAGEMENT
// ═══════════════════════════════════════
function startWave() {
  if (G.waveRunning || G.wave >= G.totalWaves) return;
  AudioEngine.resume();
  AudioEngine.play('waveStart');

  G.wave++;
  G.waveRunning = true;
  document.getElementById('startWaveBtn').disabled = true;
  document.getElementById('bossAlert').style.display = 'none';

  const cfg = LEVELS[G.level-1];
  const waveCfg = cfg.waveConfigs[G.wave - 1] || {};
  G.spawnQueue = buildSpawnQueue(waveCfg);
  G.totalEnemiesInWave = G.spawnQueue.length;
  G.waveEnemiesLeft = G.totalEnemiesInWave;
  G.waveEnemiesKilled = 0;
  G.spawnTimer = 0;
  G.spawnInterval = Math.max(400, 1200 - G.level * 40);

  // Boss alert
  if (waveCfg.boss) {
    document.getElementById('bossAlert').style.display = 'block';
    AudioEngine.play('bossAppear');
  }

  updateHUD();
  updateNukeButton();
}

function buildSpawnQueue(cfg) {
  const q = [];
  const order = ['scout', 'soldier', 'phantom', 'berserker', 'tank', 'boss'];
  order.forEach(type => {
    const count = cfg[type] || 0;
    for (let i = 0; i < count; i++) q.push(type);
  });
  // Shuffle lightly (interleave)
  return shuffleArray(q);
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function spawnEnemies(dt) {
  if (!G.waveRunning || G.spawnQueue.length === 0) return;
  G.spawnTimer += dt;
  if (G.spawnTimer < G.spawnInterval) return;
  G.spawnTimer = 0;

  const type = G.spawnQueue.shift();
  const def = getEnemyDef(type, G.level);
  const startCell = G.path[0] || [0, 0];

  G.enemies.push({
    type, ...def,
    maxHp: def.hp,
    x: startCell[0] * G.cellSize + G.cellSize / 2,
    y: startCell[1] * G.cellSize + G.cellSize / 2,
    pathIdx: 0,
    slowTimer: 0, slowFactor: 1,
    burnTimer: 0, burnDPS: 0,
    berserkerSpeed: def.speed,
    phaseTimer: def.phantom ? Math.random() * 2000 : 0,
    phased: false,
    id: Math.random(),
    flashTimer: 0,
  });
}

function checkWaveComplete() {
  if (!G.waveRunning) return;
  if (G.spawnQueue.length === 0 && G.enemies.length === 0) {
    G.waveRunning = false;
    AudioEngine.play('waveComplete');
    G.gold += 25 + G.level * 5; // Wave bonus
    AudioEngine.play('coin');

    document.getElementById('bossAlert').style.display = 'none';

    // Nuke cooldown tracking
    if (G.nukeCooldownWaves > 0) G.nukeCooldownWaves--;
    if (G.nukeCooldownWaves <= 0) G.nukeReady = true;
    updateNukeButton();

    if (G.wave >= G.totalWaves) {
      setTimeout(levelComplete, 800);
    } else {
      document.getElementById('startWaveBtn').disabled = false;
      updateHUD();
      updateControlPanel();
    }
  }
}

// ═══════════════════════════════════════
//   ENEMY UPDATE
// ═══════════════════════════════════════
function updateEnemies(dt) {
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.hp <= 0) {
      // Kill
      addParticles(e.x, e.y, e.color, e.isBoss ? 20 : 8);
      G.gold += e.reward;
      G.score += e.reward * 10 * G.level;
      G.kills++;
      G.waveEnemiesKilled++;
      AudioEngine.play(e.isBoss ? 'enemyDie' : 'enemyDie');
      G.enemies.splice(i, 1);
      G.waveEnemiesLeft = Math.max(0, G.waveEnemiesLeft - 1);
      updateHUD();
      continue;
    }

    // Slow timer
    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      if (e.slowTimer <= 0) { e.slowFactor = 1; e.slowTimer = 0; }
    }

    // Burn DoT
    if (e.burnTimer > 0) {
      e.burnTimer -= dt;
      e.hp -= e.burnDPS * (dt / 1000);
    }

    // Phantom phase
    if (e.phantom) {
      e.phaseTimer -= dt;
      if (e.phaseTimer <= 0) {
        e.phased = !e.phased;
        e.phaseTimer = e.phased ? 2000 : 1500;
      }
    }

    // Flash
    if (e.flashTimer > 0) e.flashTimer -= dt;

    // Move along path
    const spd = e.speed * e.slowFactor * (G.cellSize / 40);
    const dist = spd * dt / 16;

    if (e.pathIdx + 1 >= G.path.length) {
      // Reached end
      G.lives = Math.max(0, G.lives - (e.isBoss ? 3 : 1));
      AudioEngine.play('lifeLost');
      G.enemies.splice(i, 1);
      G.waveEnemiesLeft = Math.max(0, G.waveEnemiesLeft - 1);
      updateHUD();
      if (G.lives <= 0) {
        setTimeout(gameOver, 300);
        return;
      }
      continue;
    }

    const target = G.path[e.pathIdx + 1];
    const tx = target[0] * G.cellSize + G.cellSize / 2;
    const ty = target[1] * G.cellSize + G.cellSize / 2;
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.sqrt(dx*dx + dy*dy);

    if (d <= dist) {
      e.x = tx; e.y = ty;
      e.pathIdx++;
      // Berserker speeds up when damaged
      if (e.berserker) {
        const pct = e.hp / e.maxHp;
        e.speed = e.berserkerSpeed * (pct < 0.5 ? 1.8 : pct < 0.75 ? 1.3 : 1);
      }
    } else {
      e.x += (dx/d) * dist;
      e.y += (dy/d) * dist;
    }
  }
}

// ═══════════════════════════════════════
//   TOWER UPDATE
// ═══════════════════════════════════════
function updateTowers(dt) {
  G.towers.forEach(tower => {
    tower.fireTimer = (tower.fireTimer || tower.fireRate) - dt;
    if (tower.fireTimer > 0) return;

    // Find target (first enemy in range that isn't phased)
    const def = TOWER_DEFS[tower.type];
    const range = (tower.range || def.range) * G.cellSize;
    const tx = tower.col * G.cellSize + G.cellSize / 2;
    const ty = tower.row * G.cellSize + G.cellSize / 2;

    let target = null;
    let bestProgress = -1;
    G.enemies.forEach(e => {
      if (e.phased) return; // phantoms phased through
      const dx = e.x - tx, dy = e.y - ty;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= range && e.pathIdx > bestProgress) {
        bestProgress = e.pathIdx;
        target = e;
      }
    });

    if (!target) return;

    tower.fireTimer = tower.fireRate || def.fireRate;
    AudioEngine.play(def.sound);

    if (def.splash) {
      // Splash / Tesla area
      const splashR = (tower.splashRadius || def.splashRadius) * G.cellSize;
      G.enemies.forEach(e => {
        if (e.phased) return;
        const dx = e.x - target.x, dy = e.y - target.y;
        if (Math.sqrt(dx*dx + dy*dy) <= splashR) {
          dealDamage(tower, e, def);
        }
      });
      addParticles(target.x, target.y, def.accent || def.projectileColor, 6);
      // Tesla arc projectile
      G.projectiles.push({
        x: tx, y: ty, tx: target.x, ty: target.y,
        color: def.projectileColor, type: 'arc', life: 200
      });
    } else {
      G.projectiles.push({
        x: tx, y: ty,
        vx: 0, vy: 0,
        target: target.id,
        speed: def.projectileSpeed * (G.cellSize / 40),
        color: def.projectileColor,
        damage: tower.damage || def.damage,
        towerId: tower.id,
        tower: tower,
        size: tower.type === 3 ? 7 : 4,
        type: 'bullet',
      });
    }
  });
}

function dealDamage(tower, enemy, def) {
  const dmg = (tower.damage || def.damage) - (enemy.armor || 0) * 0.5;
  enemy.hp -= Math.max(1, dmg);
  enemy.flashTimer = 80;
  AudioEngine.play('enemyHit');

  if (def.slow && tower.type === 1) {
    enemy.slowFactor = tower.slow || def.slow;
    enemy.slowTimer = tower.slowDuration || def.slowDuration;
  }
  if (def.burn && tower.type === 2) {
    enemy.burnDPS = tower.burnDPS || def.burnDPS;
    enemy.burnTimer = tower.burnDuration || def.burnDuration;
  }

  showDamageNumber(enemy.x, enemy.y, Math.floor(Math.max(1, dmg)), def.projectileColor);
}

// ═══════════════════════════════════════
//   PROJECTILE UPDATE
// ═══════════════════════════════════════
function updateProjectiles(dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    if (p.type === 'arc') {
      p.life -= dt;
      if (p.life <= 0) { G.projectiles.splice(i, 1); }
      continue;
    }

    // Homing bullet
    const target = G.enemies.find(e => e.id === p.target);
    if (!target || target.hp <= 0) {
      G.projectiles.splice(i, 1); continue;
    }

    const dx = target.x - p.x, dy = target.y - p.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const step = p.speed * dt / 16;

    if (dist <= step + 4) {
      // Hit
      const def = TOWER_DEFS[p.tower.type];
      if (def.splash) {
        const splashR = (p.tower.splashRadius || def.splashRadius) * G.cellSize;
        G.enemies.forEach(e => {
          if (e.phased) return;
          const ex = e.x - target.x, ey = e.y - target.y;
          if (Math.sqrt(ex*ex + ey*ey) <= splashR) dealDamage(p.tower, e, def);
        });
        addParticles(target.x, target.y, def.projectileColor, 12);
      } else {
        dealDamage(p.tower, target, def);
      }
      G.projectiles.splice(i, 1);
    } else {
      p.x += (dx/dist) * step;
      p.y += (dy/dist) * step;
    }
  }
}

// ═══════════════════════════════════════
//   PARTICLES
// ═══════════════════════════════════════
function addParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * 3 + 1;
    G.particles.push({
      x, y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd,
      color, life: 300 + Math.random()*200, maxLife: 500, size: Math.random()*3+1
    });
  }
}

function updateParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.92; p.vy *= 0.92;
    if (p.life <= 0) G.particles.splice(i, 1);
  }
}

// ═══════════════════════════════════════
//   RENDER
// ═══════════════════════════════════════
function render() {
  const c = G.ctx;
  c.clearRect(0, 0, G.W, G.H);

  // Background grid
  drawGrid(c);

  // Path
  drawPath(c);

  // Towers
  G.towers.forEach(t => drawTower(c, t));

  // Selected tower range
  if (G.selectedPlacedTower) {
    drawRange(c, G.selectedPlacedTower);
  }

  // Enemies
  G.enemies.forEach(e => drawEnemy(c, e));

  // Projectiles
  G.projectiles.forEach(p => drawProjectile(c, p));

  // Particles
  G.particles.forEach(p => drawParticle(c, p));

  // Selected tower preview (hover)
  drawPlacementIndicator(c);
}

function drawGrid(c) {
  c.strokeStyle = 'rgba(212,175,55,0.15)'; // Brighter grid
  c.lineWidth = 0.5;
  for (let row = 0; row < G.rows; row++) {
    for (let col = 0; col < G.cols; col++) {
      c.strokeRect(col*G.cellSize, row*G.cellSize, G.cellSize, G.cellSize);
    }
  }
}

function drawPath(c) {
  if (G.path.length < 2) return;
  // Path glow
  c.beginPath();
  c.moveTo(G.path[0][0]*G.cellSize + G.cellSize/2, G.path[0][1]*G.cellSize + G.cellSize/2);
  G.path.forEach(([col, row]) => {
    c.lineTo(col*G.cellSize + G.cellSize/2, row*G.cellSize + G.cellSize/2);
  });
  c.strokeStyle = 'rgba(50,150,200,0.8)'; // Brighter path
  c.lineWidth = G.cellSize * 0.85;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.stroke();

  // Path surface
  c.beginPath();
  c.moveTo(G.path[0][0]*G.cellSize + G.cellSize/2, G.path[0][1]*G.cellSize + G.cellSize/2);
  G.path.forEach(([col, row]) => {
    c.lineTo(col*G.cellSize + G.cellSize/2, row*G.cellSize + G.cellSize/2);
  });
  c.strokeStyle = 'rgba(100,200,255,0.4)'; // Brighter surface
  c.lineWidth = G.cellSize * 0.75;
  c.stroke();

  // Path edge glow
  c.beginPath();
  c.moveTo(G.path[0][0]*G.cellSize + G.cellSize/2, G.path[0][1]*G.cellSize + G.cellSize/2);
  G.path.forEach(([col, row]) => {
    c.lineTo(col*G.cellSize + G.cellSize/2, row*G.cellSize + G.cellSize/2);
  });
  c.strokeStyle = 'rgba(100,200,255,0.12)';
  c.lineWidth = G.cellSize * 0.78;
  c.stroke();

  // Start marker
  const s = G.path[0];
  c.fillStyle = '#43a047';
  c.beginPath();
  c.arc(s[0]*G.cellSize + G.cellSize/2, s[1]*G.cellSize + G.cellSize/2, G.cellSize*0.3, 0, Math.PI*2);
  c.fill();
  c.fillStyle = '#fff';
  c.font = `bold ${G.cellSize*0.3}px Orbitron, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('S', s[0]*G.cellSize + G.cellSize/2, s[1]*G.cellSize + G.cellSize/2);

  // End marker
  const e = G.path[G.path.length-1];
  c.fillStyle = '#e53935';
  c.beginPath();
  c.arc(e[0]*G.cellSize + G.cellSize/2, e[1]*G.cellSize + G.cellSize/2, G.cellSize*0.3, 0, Math.PI*2);
  c.fill();
  c.fillStyle = '#fff';
  c.fillText('E', e[0]*G.cellSize + G.cellSize/2, e[1]*G.cellSize + G.cellSize/2);
}

function drawTower(c, t) {
  const def = TOWER_DEFS[t.type];
  const x = t.col * G.cellSize + G.cellSize/2;
  const y = t.row * G.cellSize + G.cellSize/2;
  const r = G.cellSize * 0.4;

  // Base platform
  c.fillStyle = '#0a1c30';
  c.strokeStyle = def.color;
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(x, y, r + 3, 0, Math.PI*2);
  c.fill(); c.stroke();

  // Draw Image Asset if available
  const assetKey = `tower_${t.type}`;
  if (G.assets[assetKey]) {
    c.drawImage(G.assets[assetKey], x - r, y - r, r * 2, r * 2);
  } else {
    // Fallback: Tower body
    c.fillStyle = def.color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI*2);
    c.fill();

    // Accent ring
    c.strokeStyle = def.accent || '#fff';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x, y, r * 0.65, 0, Math.PI*2);
    c.stroke();
  }

  // Level indicator dots
  for (let lv = 0; lv < (t.upgradeLevel || 0); lv++) {
    const angle = -Math.PI/2 + (lv * Math.PI * 2 / 3);
    c.fillStyle = '#d4af37';
    c.beginPath();
    c.arc(x + Math.cos(angle) * (r+5), y + Math.sin(angle) * (r+5), 2.5, 0, Math.PI*2);
    c.fill();
  }

  // Tower type icon (only fallback if image missing)
  if (!G.assets[assetKey]) {
    c.fillStyle = '#fff';
    c.font = `bold ${G.cellSize * 0.32}px Share Tech Mono, monospace`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const icons = ['P', 'T', 'F', 'V'];
    c.fillText(icons[t.type], x, y);
  }

  // Glow when selected
  if (G.selectedPlacedTower && G.selectedPlacedTower.id === t.id) {
    c.strokeStyle = 'rgba(212,175,55,0.8)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y, r + 6, 0, Math.PI*2);
    c.stroke();
  }
}

function drawRange(c, t) {
  const def = TOWER_DEFS[t.type];
  const range = (t.range || def.range) * G.cellSize;
  const x = t.col * G.cellSize + G.cellSize/2;
  const y = t.row * G.cellSize + G.cellSize/2;
  c.strokeStyle = 'rgba(212,175,55,0.3)';
  c.lineWidth = 1;
  c.setLineDash([4, 4]);
  c.beginPath();
  c.arc(x, y, range, 0, Math.PI*2);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = 'rgba(212,175,55,0.04)';
  c.beginPath();
  c.arc(x, y, range, 0, Math.PI*2);
  c.fill();
}

function drawEnemy(c, e) {
  const r = G.cellSize * e.size;
  const alpha = e.phased ? 0.3 : 1;

  // Flash white on hit
  const flashAlpha = e.flashTimer > 0 ? e.flashTimer / 80 : 0;

  // Shadow
  c.save();
  c.globalAlpha = alpha * 0.7;
  c.fillStyle = '#000';
  c.beginPath();
  c.ellipse(e.x, e.y + r + 2, r * 0.8, 3, 0, 0, Math.PI*2);
  c.fill();
  c.restore();

  // Body
  c.save();
  c.globalAlpha = alpha;
  const assetKey = `enemy_${e.type}`;
  if (G.assets[assetKey]) {
      c.drawImage(G.assets[assetKey], e.x - r, e.y - r, r * 2, r * 2);
  } else {
    c.fillStyle = flashAlpha > 0 ? `rgba(255,255,255,${flashAlpha})` : e.color;
    c.beginPath();
    if (e.isBoss) {
      // Boss: hexagon
      hexPath(c, e.x, e.y, r);
    } else {
      c.arc(e.x, e.y, r, 0, Math.PI*2);
    }
    c.fill();
  }

  // Burn effect
  if (e.burnTimer > 0) {
    c.fillStyle = 'rgba(255,100,0,0.4)';
    c.beginPath();
    c.arc(e.x, e.y, r, 0, Math.PI*2);
    c.fill();
  }
  // Slow effect
  if (e.slowTimer > 0) {
    c.strokeStyle = 'rgba(100,200,100,0.6)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(e.x, e.y, r + 2, 0, Math.PI*2);
    c.stroke();
  }
  // Berserker glow when damaged
  if (e.berserker && e.hp/e.maxHp < 0.5) {
    c.strokeStyle = 'rgba(255,80,0,0.8)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(e.x, e.y, r + 4, 0, Math.PI*2);
    c.stroke();
  }
  c.restore();

  // HP bar
  const barW = r * 2.5, barH = 4;
  const barX = e.x - barW/2, barY = e.y - r - 10;
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.fillRect(barX, barY, barW, barH);
  const pct = Math.max(0, e.hp / e.maxHp);
  const barColor = pct > 0.6 ? '#43a047' : pct > 0.3 ? '#ffa000' : '#e53935';
  c.fillStyle = barColor;
  c.fillRect(barX, barY, barW * pct, barH);

  // Boss label
  if (e.isBoss) {
    c.fillStyle = '#d4af37';
    c.font = `bold ${G.cellSize * 0.22}px Orbitron, monospace`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('BOSS', e.x, e.y);
  }
}

function hexPath(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI/6;
    i === 0 ? c.moveTo(x + r*Math.cos(a), y + r*Math.sin(a))
             : c.lineTo(x + r*Math.cos(a), y + r*Math.sin(a));
  }
  c.closePath();
}

function drawProjectile(c, p) {
  if (p.type === 'arc') {
    // Tesla arc
    c.strokeStyle = p.color;
    c.lineWidth = 2;
    c.shadowColor = p.color;
    c.shadowBlur = 8;
    c.beginPath();
    c.moveTo(p.x, p.y);
    const mx = (p.x + p.tx)/2 + (Math.random()-0.5)*20;
    const my = (p.y + p.ty)/2 + (Math.random()-0.5)*20;
    c.quadraticCurveTo(mx, my, p.tx, p.ty);
    c.stroke();
    c.shadowBlur = 0;
    return;
  }
  c.fillStyle = p.color;
  c.shadowColor = p.color;
  c.shadowBlur = 8;
  c.beginPath();
  c.arc(p.x, p.y, p.size || 4, 0, Math.PI*2);
  c.fill();
  c.shadowBlur = 0;
}

function drawParticle(c, p) {
  c.globalAlpha = p.life / p.maxLife;
  c.fillStyle = p.color;
  c.beginPath();
  c.arc(p.x, p.y, p.size, 0, Math.PI*2);
  c.fill();
  c.globalAlpha = 1;
}

let mouseCol = -1, mouseRow = -1;
document.addEventListener('mousemove', e => {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  mouseCol = Math.floor((e.clientX - rect.left) / G.cellSize);
  mouseRow = Math.floor((e.clientY - rect.top) / G.cellSize);
});

function drawPlacementIndicator(c) {
  if (G.selectedTower < 0 || mouseCol < 0) return;
  const col = mouseCol, row = mouseRow;
  if (col < 0 || col >= G.cols || row < 0 || row >= G.rows) return;
  const canPlace = G.grid[row] && G.grid[row][col] === 0;
  const def = TOWER_DEFS[G.selectedTower];
  const x = col * G.cellSize + G.cellSize/2;
  const y = row * G.cellSize + G.cellSize/2;

  c.globalAlpha = 0.5;
  c.fillStyle = canPlace ? def.color : 'rgba(229,57,53,0.5)';
  c.beginPath();
  c.arc(x, y, G.cellSize * 0.4, 0, Math.PI*2);
  c.fill();

  // Range preview
  if (canPlace) {
    c.strokeStyle = 'rgba(212,175,55,0.3)';
    c.lineWidth = 1;
    c.setLineDash([3,3]);
    c.beginPath();
    c.arc(x, y, def.range * G.cellSize, 0, Math.PI*2);
    c.stroke();
    c.setLineDash([]);
  }
  c.globalAlpha = 1;
}

// ═══════════════════════════════════════
//   INPUT HANDLERS
// ═══════════════════════════════════════
function onCanvasClick(e) {
  if (!G.canvas) return;
  AudioEngine.resume();
  const rect = G.canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  const col = Math.floor(cx / G.cellSize);
  const row = Math.floor(cy / G.cellSize);

  if (col < 0 || col >= G.cols || row < 0 || row >= G.rows) return;

  // Check if clicked on existing tower
  const existingTower = G.towers.find(t => t.col === col && t.row === row);
  if (existingTower) {
    selectPlacedTower(existingTower, cx, cy);
    return;
  }

  // Place new tower
  if (G.selectedTower >= 0) {
    placeTower(col, row);
  } else {
    // Deselect
    G.selectedPlacedTower = null;
    document.getElementById('towerMenu').classList.add('hidden');
  }
}

// ═══════════════════════════════════════
//   GESTURE AND TOUCH SUPPORT
// ═══════════════════════════════════════
let isDragging = false;

document.getElementById('gameCanvas')?.addEventListener('touchstart', e => {
  if (!G.canvas) return;
  e.preventDefault();
  isDragging = false;
  const touch = e.touches[0];
  const rect = G.canvas.getBoundingClientRect();
  mouseCol = Math.floor((touch.clientX - rect.left) / G.cellSize);
  mouseRow = Math.floor((touch.clientY - rect.top) / G.cellSize);
}, { passive: false });

document.getElementById('gameCanvas')?.addEventListener('touchmove', e => {
  if (!G.canvas) return;
  e.preventDefault();
  isDragging = true;
  const touch = e.touches[0];
  const rect = G.canvas.getBoundingClientRect();
  mouseCol = Math.floor((touch.clientX - rect.left) / G.cellSize);
  mouseRow = Math.floor((touch.clientY - rect.top) / G.cellSize);
}, { passive: false });

document.getElementById('gameCanvas')?.addEventListener('touchend', e => {
  e.preventDefault();
  const col = mouseCol, row = mouseRow;
  if (col < 0 || col >= G.cols || row < 0 || row >= G.rows) return;

  const existingTower = G.towers.find(t => t.col === col && t.row === row);
  if (existingTower) {
    if (!isDragging) selectPlacedTower(existingTower, mouseCol * G.cellSize, mouseRow * G.cellSize);
    return;
  }
  
  if (G.selectedTower >= 0) placeTower(col, row);
  else if (!isDragging) {
    G.selectedPlacedTower = null;
    document.getElementById('towerMenu').classList.add('hidden');
  }
  isDragging = false;
}, { passive: false });

// ═══════════════════════════════════════
//   IN-GAME TUTORIAL LOGIC
// ═══════════════════════════════════════
let currentTutStep = 1;

function checkTutSeen() {
  try { return localStorage.getItem('aegis_ingame_tut'); } catch(e) { return false; }
}

function setTutSeen() {
  try { localStorage.setItem('aegis_ingame_tut', 'true'); } catch(e) {}
}

function showInGameTutorial() {
  if (checkTutSeen()) return;
  document.getElementById('inGameTutorial').classList.remove('hidden');
  currentTutStep = 1;
  updateTutStep();
}

function tutNext() {
  AudioEngine.play('click');
  if (currentTutStep < 4) { 
    currentTutStep++; 
    updateTutStep(); 
  } else {
    document.getElementById('inGameTutorial').classList.add('hidden');
    setTutSeen();
  }
}

function tutPrev() {
  AudioEngine.play('click');
  if (currentTutStep > 1) { 
    currentTutStep--; 
    updateTutStep(); 
  }
}

function updateTutStep() {
  for(let i=1; i<=4; i++) {
    const el = document.getElementById(`tut${i}`);
    if (el) el.classList.toggle('active', i === currentTutStep);
  }
  const prevBtn = document.getElementById('tutPrevBtn');
  const nextBtn = document.getElementById('tutNextBtn');
  if (prevBtn) prevBtn.disabled = currentTutStep === 1;
  if (nextBtn) nextBtn.textContent = currentTutStep === 4 ? 'DISMISS' : 'NEXT →';
}

function placeTower(col, row) {
  if (!G.grid[row] || G.grid[row][col] !== 0) {
    AudioEngine.play('error');
    return;
  }
  const def = TOWER_DEFS[G.selectedTower];
  if (G.gold < def.cost) {
    AudioEngine.play('error');
    shakeGold();
    return;
  }
  G.gold -= def.cost;
  G.grid[row][col] = 2;
  const tower = {
    id: Math.random(), type: G.selectedTower,
    col, row, upgradeLevel: 0, fireTimer: 0,
    range: def.range, damage: def.damage,
    fireRate: def.fireRate,
    splashRadius: def.splashRadius,
    slow: def.slow, slowDuration: def.slowDuration,
    burnDPS: def.burnDPS, burnDuration: def.burnDuration,
  };
  G.towers.push(tower);
  AudioEngine.play('place');
  addParticles(col*G.cellSize + G.cellSize/2, row*G.cellSize + G.cellSize/2, def.accent || def.color, 8);
  updateHUD();
  updateTowerButtons();
}

function selectPlacedTower(tower, px, py) {
  G.selectedTower = -1;
  document.querySelectorAll('.tower-select-btn').forEach(b => b.classList.remove('selected'));
  G.selectedPlacedTower = tower;

  const def = TOWER_DEFS[tower.type];
  const ul = tower.upgradeLevel || 0;
  const menu = document.getElementById('towerMenu');
  document.getElementById('tmTitle').textContent = def.name + ' LV.' + (ul+1);

  const upBtn = document.getElementById('tmUpgrade');
  if (ul >= 3) {
    upBtn.textContent = '⬆ MAX LEVEL';
    upBtn.disabled = true;
  } else {
    const upgCost = def.upgrades[ul].cost;
    document.getElementById('tmUpgradeCost').textContent = upgCost;
    upBtn.disabled = G.gold < upgCost;
    upBtn.textContent = `⬆ UPGRADE (${upgCost}g)`;
  }

  const sellVal = Math.floor(def.cost * 0.6 + (ul > 0 ? def.upgrades.slice(0,ul).reduce((s,u) => s+u.cost,0)*0.5 : 0));
  document.getElementById('tmSellValue').textContent = sellVal;

  // Position menu
  const canvas = G.canvas;
  const rect = canvas.getBoundingClientRect();
  const mx = Math.min(px + 10, G.W - 200);
  const my = Math.min(py + 10, G.H - 160);
  menu.style.left = mx + 'px';
  menu.style.top = my + 'px';
  menu.classList.remove('hidden');
  AudioEngine.play('click');
}

function upgradeTower() {
  const t = G.selectedPlacedTower;
  if (!t || t.upgradeLevel >= 3) return;
  const def = TOWER_DEFS[t.type];
  const upg = def.upgrades[t.upgradeLevel];
  if (G.gold < upg.cost) { AudioEngine.play('error'); return; }
  G.gold -= upg.cost;
  t.upgradeLevel++;
  t.range = upg.range; t.damage = upg.damage; t.fireRate = upg.fireRate;
  AudioEngine.play('upgrade');
  addParticles(t.col*G.cellSize + G.cellSize/2, t.row*G.cellSize + G.cellSize/2, '#d4af37', 12);
  selectPlacedTower(t, parseFloat(document.getElementById('towerMenu').style.left), parseFloat(document.getElementById('towerMenu').style.top));
  updateHUD();
  updateTowerButtons();
}

function sellTower() {
  const t = G.selectedPlacedTower;
  if (!t) return;
  const def = TOWER_DEFS[t.type];
  const ul = t.upgradeLevel || 0;
  const sellVal = Math.floor(def.cost * 0.6 + (ul > 0 ? def.upgrades.slice(0,ul).reduce((s,u) => s+u.cost,0)*0.5 : 0));
  G.gold += sellVal;
  G.grid[t.row][t.col] = 0;
  G.towers = G.towers.filter(x => x.id !== t.id);
  G.selectedPlacedTower = null;
  document.getElementById('towerMenu').classList.add('hidden');
  AudioEngine.play('sell');
  updateHUD();
  updateTowerButtons();
}

function closeTowerMenu() {
  G.selectedPlacedTower = null;
  document.getElementById('towerMenu').classList.add('hidden');
}

function selectTower(idx) {
  AudioEngine.play('click');
  if (G.selectedTower === idx) {
    G.selectedTower = -1;
    document.querySelectorAll('.tower-select-btn').forEach(b => b.classList.remove('selected'));
  } else {
    G.selectedTower = idx;
    G.selectedPlacedTower = null;
    document.getElementById('towerMenu').classList.add('hidden');
    document.querySelectorAll('.tower-select-btn').forEach((b,i) => {
      b.classList.toggle('selected', i === idx);
    });
  }
}

// ═══════════════════════════════════════
//   CONTROLS
// ═══════════════════════════════════════
function toggleSpeed() {
  G.speed = G.speed === 1 ? 2 : 1;
  const btn = document.getElementById('speedBtn');
  btn.textContent = G.speed === 2 ? '⚡ 2x' : '⚡ 1x';
  btn.classList.toggle('active', G.speed === 2);
  AudioEngine.play('click');
}

function togglePause() {
  G.paused = !G.paused;
  const overlay = document.getElementById('pauseOverlay');
  overlay.classList.toggle('hidden', !G.paused);
  document.getElementById('pauseBtn').textContent = G.paused ? '▶' : '⏸';
  AudioEngine.play('click');
}

function useNuke() {
  if (!G.nukeReady || G.enemies.length === 0) return;
  AudioEngine.play('nuke');
  G.enemies.forEach(e => {
    const dmg = e.isBoss ? 300 : e.maxHp * 0.6;
    e.hp -= dmg;
    addParticles(e.x, e.y, '#ff6d00', 10);
    showDamageNumber(e.x, e.y, Math.floor(dmg), '#ff6d00');
  });
  G.nukeReady = false;
  G.nukeCooldownWaves = 3;
  updateNukeButton();

  // Screen flash
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:rgba(255,150,0,0.3);z-index:999;pointer-events:none;transition:opacity 0.5s';
  document.body.appendChild(flash);
  setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 500); }, 50);
}

function updateNukeButton() {
  const btn = document.getElementById('nukeBtn');
  const cd = document.getElementById('nukeCooldown');
  btn.disabled = !G.nukeReady;
  cd.textContent = G.nukeReady ? '' : `(${G.nukeCooldownWaves}w)`;
}

// ═══════════════════════════════════════
//   HUD UPDATE
// ═══════════════════════════════════════
function updateHUD() {
  document.getElementById('livesDisplay').textContent = G.lives;
  document.getElementById('goldDisplay').textContent = G.gold;
  document.getElementById('scoreDisplay').textContent = G.score.toLocaleString();
  document.getElementById('killsDisplay').textContent = G.kills;
  document.getElementById('levelBadge').textContent = `LEVEL ${G.level}`;
  document.getElementById('waveBadge').textContent = `WAVE ${G.wave}/${G.totalWaves}`;
}

function updateTowerButtons() {
  TOWER_DEFS.forEach((def, i) => {
    const btn = document.getElementById(`tb${i}`);
    if (btn) btn.classList.toggle('disabled-btn', G.gold < def.cost);
  });
}

function updateControlPanel() {
  document.getElementById('speedBtn').textContent = G.speed === 2 ? '⚡ 2x' : '⚡ 1x';
}

function shakeGold() {
  const el = document.getElementById('goldDisplay');
  el.style.animation = 'none';
  el.style.color = '#e53935';
  setTimeout(() => { el.style.color = ''; }, 500);
}

function showDamageNumber(x, y, dmg, color) {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'damage-num';
  el.textContent = dmg;
  el.style.color = color || '#fff';
  el.style.fontSize = dmg > 50 ? '14px' : '10px';
  el.style.left = (rect.left + x - 10) + 'px';
  el.style.top = (rect.top + y - 10) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

// ═══════════════════════════════════════
//   LEVEL COMPLETE / GAME OVER / VICTORY
// ═══════════════════════════════════════
function levelComplete() {
  cancelAnimationFrame(G.animId);
  AudioEngine.play('levelComplete');
  G.totalScore += G.score;

  const livesLeft = G.lives;
  const lifeBonus = livesLeft * 50 * G.level;
  const finalScore = G.score + lifeBonus;
  G.totalScore += lifeBonus;

  // Stars
  const pct = livesLeft / G.levelStartLives;
  const stars = pct >= 0.8 ? 3 : pct >= 0.5 ? 2 : 1;
  const starRow = document.getElementById('starRow');
  starRow.innerHTML = ['★','★','★'].map((s,i) =>
    `<span style="color:${i<stars?'#d4af37':'#2a3a4a'};filter:${i<stars?'drop-shadow(0 0 8px #d4af37)':'none'}">${s}</span>`
  ).join('');

  document.getElementById('levelStats').innerHTML = `
    <div>Enemies Eliminated: <span>${G.kills}</span></div>
    <div>Lives Remaining: <span>${livesLeft}</span></div>
    <div>Life Bonus: <span>+${lifeBonus}g</span></div>
    <div>Sector Score: <span>${finalScore.toLocaleString()}</span></div>
    <div>Campaign Total: <span>${G.totalScore.toLocaleString()}</span></div>
  `;

  if (G.level >= 10) {
    setTimeout(showVictory, 500);
  } else {
    showScreen('levelCompleteScreen');
  }
}

function nextLevel() {
  AudioEngine.play('click');
  G.level++;
  initLevel();
}

function restartLevel() {
  AudioEngine.play('click');
  initLevel();
}

function gameOver() {
  if (!document.getElementById('gameScreen').classList.contains('active')) return;
  cancelAnimationFrame(G.animId);
  AudioEngine.play('gameOver');

  document.getElementById('gameOverStats').innerHTML = `
    <div>Level Reached: <span>${G.level}</span></div>
    <div>Waves Survived: <span>${G.wave - 1}/${G.totalWaves}</span></div>
    <div>Enemies Eliminated: <span>${G.kills}</span></div>
    <div>Final Score: <span>${G.score.toLocaleString()}</span></div>
  `;
  showScreen('gameOverScreen');
}

function showVictory() {
  AudioEngine.play('victory');
  document.getElementById('victoryStats').innerHTML = `
    <div>All 10 Sectors Secured!</div>
    <div>Total Enemies Eliminated: <span>${G.kills}</span></div>
    <div>Campaign Score: <span>${G.totalScore.toLocaleString()}</span></div>
    <div style="color:#d4af37;margin-top:8px;font-size:0.9rem">★ AEGIS LEGEND ★</div>
  `;
  showScreen('victoryScreen');

  // Fireworks
  const fw = document.getElementById('fireworks');
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'fw-particle';
      const colors = ['#d4af37','#4fc3f7','#ef5350','#81c784','#ce93d8'];
      const col = colors[Math.floor(Math.random()*colors.length)];
      const sx = Math.random() * 360, sy = Math.random() * 300;
      const ex = sx + (Math.random()-0.5)*200, ey = sy + (Math.random()-0.5)*200;
      p.style.cssText = `left:${sx}px;top:${sy}px;background:${col};box-shadow:0 0 6px ${col};`;
      p.style.setProperty('--ex', (ex-sx)+'px');
      p.style.setProperty('--ey', (ey-sy)+'px');
      fw.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }, i * 120);
  }
}

// ═══════════════════════════════════════
//   INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  AudioEngine.init();
  setupCanvas(); // Sets G.canvas, G.ctx, and adds listeners
  loadAssets();
  showScreen('splashScreen', true);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    switch(e.key) {
      case '1': selectTower(0); break;
      case '2': selectTower(1); break;
      case '3': selectTower(2); break;
      case '4': selectTower(3); break;
      case ' ': e.preventDefault(); if(G.waveRunning) togglePause(); else startWave(); break;
      case 'Escape': closeTowerMenu(); G.selectedTower=-1; document.querySelectorAll('.tower-select-btn').forEach(b=>b.classList.remove('selected')); break;
      case 'f': toggleSpeed(); break;
      case 'n': useNuke(); break;
    }
  });
});
