/**
 * Dragon Tower — Core Game Logic
 */

import { GRID_COLS, GRID_ROWS, TOTAL_WAVES, TOWER_DEFS, ENEMY_DEFS, WAVE_DEFS } from './constants.js';
import { sfx } from './audio.js';

const CV = document.getElementById('gameCanvas');
const ctx = CV.getContext('2d');
let W, H, DPR;

let gameState = 'splash';
let map = [], tileSize = 0;
let path = []; 
let towers = [], enemies = [], projectiles = [], particles = [], floatingTexts = [];
let wave = 0, hp = 20, gold = 200, score = 0;
let waveActive = false, enemyQueue = [], spawnTimer = 0, spawnIdx = 0;
let selectedTowerType = null, selectedTower = null;
let speed = 1, paused = false;
let frame = 0;
let bestWave = +localStorage.getItem('dt_best') || 0;
let nextEnemyId = 0;
let toastTimer;

// Handle High DPI scaling
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  
  CV.width = W * DPR;
  CV.height = H * DPR;
  CV.style.width = W + 'px';
  CV.style.height = H + 'px';
  ctx.scale(DPR, DPR);

  if (gameState === 'play' || gameState === 'over') buildMap();
}

window.addEventListener('resize', resize);
resize();

// ─── MAP GENERATION ──────────────────────────────────────
function buildMap() {
  const availableH = H - 180; // Reserve space for HUD and Palette
  // Ensure tileSize is integer so map aligns perfectly.
  tileSize = Math.floor(Math.min(W / GRID_COLS, availableH / GRID_ROWS));
  // Set minimum tileSize
  if(tileSize < 20) tileSize = 20;
  
  const mapW = tileSize * GRID_COLS;
  const mapH = tileSize * GRID_ROWS;
  const offsetX = Math.floor((W - mapW) / 2);
  const offsetY = 70 + Math.floor((availableH - mapH) / 2); // Center vertically

  const rawPath = [];
  const rowDirs = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];

  let r = 1;
  for (let seg = 0; seg < 6; seg++) {
    const dir = rowDirs[seg * 2];
    const startC = dir ? 0 : GRID_COLS - 1;
    const endC = dir ? GRID_COLS - 1 : 0;
    const step = dir ? 1 : -1;
    for (let c = startC; c !== endC + step; c += step) rawPath.push({ r, c });
    if (seg < 5) {
      rawPath.push({ r: r + 1, c: endC });
      r += 2;
    }
  }

  path = rawPath;

  map = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    map.push([]);
    for (let col = 0; col < GRID_COLS; col++) {
      map[row].push({ 
        type: 'grass', 
        row, col, 
        x: offsetX + col * tileSize, 
        y: offsetY + row * tileSize, 
        tower: null 
      });
    }
  }
  
  path.forEach(p => { 
    if (map[p.r] && map[p.r][p.c]) map[p.r][p.c].type = 'path'; 
  });

  const start = path[0];
  const end = path[path.length - 1];
  map[start.r][start.c].type = 'start';
  map[end.r][end.c].type = 'end';
}

function worldX(col) { return map[0][col]?.x + tileSize / 2 || 0; }
function worldY(row) { return map[row]?.[0]?.y + tileSize / 2 || 0; }

// ─── TOWER PALETTE ───────────────────────────────────────
function buildPalette() {
  const row = document.getElementById('tower-row');
  row.innerHTML = '';
  Object.entries(TOWER_DEFS).forEach(([key, def]) => {
    const btn = document.createElement('div');
    btn.className = 'tower-btn';
    btn.id = 'tbtn-' + key;
    btn.innerHTML = `<span class="tower-emoji">${def.icon}</span><span class="tower-btn-name">${def.name}</span><span class="tower-btn-cost">🪙${def.cost}</span>`;
    btn.onclick = (e) => {
        e.stopPropagation();
        selectTowerType(key);
    };
    row.appendChild(btn);
  });
}

function updatePalette() {
  Object.entries(TOWER_DEFS).forEach(([key, def]) => {
    const btn = document.getElementById('tbtn-' + key);
    if (!btn) return;
    btn.classList.toggle('selected', selectedTowerType === key);
    btn.classList.toggle('cant-afford', gold < def.cost);
  });
}

function selectTowerType(key) {
  selectedTowerType = selectedTowerType === key ? null : key;
  selectedTower = null;
  updatePalette();
}

// ─── SPAWNING ───────────────────────────────────────────
function spawnEnemy(type) {
  const def = ENEMY_DEFS[type];
  const waveScale = 1 + wave * 0.15;
  const hp_max = Math.ceil(def.hp * waveScale);
  const start = path[0];
  enemies.push({
    id: nextEnemyId++,
    type, icon: def.icon,
    hp: hp_max, maxHp: hp_max,
    spd: def.spd * (0.9 + Math.random() * 0.2),
    reward: def.reward,
    col: def.col, size: def.size,
    x: worldX(start.c), y: worldY(start.r),
    pathIdx: 0, progress: 0,
    slow: 0, burn: 0, burnTick: 0,
    dead: false, reached: false,
    animT: Math.random() * Math.PI * 2,
  });
}

// ─── TOWER LOGIC ────────────────────────────────────────
function placeTower(tile) {
  if (!selectedTowerType) return;
  const def = TOWER_DEFS[selectedTowerType];
  if (gold < def.cost) { showToast('🪙 Not enough gold!'); return; }
  if (tile.type !== 'grass') { showToast('Must place on grass!'); return; }
  
  gold -= def.cost;
  sfx.play('place');
  const t = {
    id: Date.now(), type: selectedTowerType, level: 1,
    def: { ...def }, tile,
    x: tile.x + tileSize / 2, y: tile.y + tileSize / 2,
    fireCD: 0, target: null, animT: 0,
  };
  tile.tower = t; tile.type = 'tower';
  towers.push(t);
  spawnParticle(t.x, t.y, def.color, 12);
  updatePalette();
  updateHUD();
}

function updateTowers() {
  towers.forEach(tower => {
    tower.animT += 0.05;
    tower.fireCD = Math.max(0, tower.fireCD - speed);
    if (tower.fireCD > 0) return;

    const range = tower.def.range * tileSize;
    let target = null;
    let maxProg = -1;

    enemies.forEach(e => {
      const d = Math.hypot(e.x - tower.x, e.y - tower.y);
      if (d < range) {
        if (tower.type === 'death') {
          if (e.hp > (target?.hp || 0)) target = e;
        } else if (e.pathIdx + e.progress > maxProg) {
          maxProg = e.pathIdx + e.progress;
          target = e;
        }
      }
    });

    if (!target) return;
    tower.fireCD = tower.def.rate;
    sfx.play('shoot');

    if (tower.def.splash > 0) {
      const splashR = tower.def.splash * tileSize;
      enemies.forEach(e => {
        const d = Math.hypot(e.x - target.x, e.y - target.y);
        if (d < splashR) {
          dealDamage(e, tower.def.dmg, tower);
          if (tower.def.slow) e.slow = Math.max(e.slow, tower.def.slow * 60);
        }
      });
      spawnParticle(target.x, target.y, tower.def.color, 16);
      if (tower.type === 'fire') target.burn = Math.max(target.burn, 120);
    } else if (tower.def.chain > 0) {
        // Chain logic simplified
        addProjectile(tower.x, tower.y, target.x, target.y, tower.def.color, 1);
        dealDamage(target, tower.def.dmg, tower);
        // Next logic...
    } else {
      addProjectile(tower.x, tower.y, target.x, target.y, tower.def.color, 1);
      dealDamage(target, tower.def.dmg, tower);
      if (tower.def.slow) target.slow = Math.max(target.slow, tower.def.slow * 60);
    }
  });
}

function dealDamage(e, dmg, tower) {
  if (e.dead) return;
  e.hp -= dmg;
  sfx.play('hit');
  addFloatText(e.x, e.y, '-' + Math.ceil(dmg), tower.def.color);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  gold += e.reward; score += e.reward * 10;
  spawnParticle(e.x, e.y, e.col, 14);
  sfx.play('death'); 
  sfx.play('gold');
  updateHUD();
}

// ─── UPDATE LOOP ────────────────────────────────────────
function update() {
  if (paused) return;

  frame++;
  
  // Wave Spawning
  if (waveActive && spawnIdx < enemyQueue.length) {
    spawnTimer -= speed;
    if (spawnTimer <= 0) {
      const item = enemyQueue[spawnIdx];
      spawnEnemy(item.type);
      spawnTimer = item.delay;
      spawnIdx++;
    }
  }

  // Enemies
  enemies.forEach(e => {
    if (e.dead || e.reached) return;
    
    // Status effects
    if (e.burn > 0) {
      e.burnTick++;
      if (e.burnTick % 30 === 0) {
        e.hp -= 5;
        addFloatText(e.x, e.y, '🔥', '#ff6600');
        if (e.hp <= 0) killEnemy(e);
      }
      e.burn -= speed;
    }
    if (e.slow > 0) e.slow -= speed;

    const effSpd = (e.slow > 0 ? e.spd * 0.5 : e.spd) * speed;
    let moved = effSpd;

    while (moved > 0 && e.pathIdx < path.length - 1) {
      const next = path[e.pathIdx + 1];
      const tx = worldX(next.c), ty = worldY(next.r);
      const dx = tx - e.x, dy = ty - e.y, dist = Math.hypot(dx, dy);
      
      const step = Math.min(moved, dist);
      if (dist > 0.1) {
          e.x += (dx / dist) * step;
          e.y += (dy / dist) * step;
      }
      moved -= step;
      if (dist < 1) e.pathIdx++;
    }
    
    e.progress = e.pathIdx / path.length;

    if (e.pathIdx >= path.length - 1) {
      e.reached = true; hp--;
      sfx.play('damage');
      addFloatText(e.x, e.y, '💔 -1 HP', '#cc2222');
      updateHUD();
      if (hp <= 0) gameOver();
    }
  });
  enemies = enemies.filter(e => !e.dead && !e.reached);

  updateTowers();
  
  // Wave Complete?
  if (waveActive && spawnIdx >= enemyQueue.length && enemies.length === 0) {
    waveActive = false;
    const bonus = wave * 30;
    gold += bonus; score += bonus * 10;
    sfx.play('gold');
    showToast('✦ WAVE ' + wave + ' COMPLETE! +🪙' + bonus);
    updateHUD();
    if (wave >= TOTAL_WAVES) winGame();
  }
}

// ─── DRAW ───────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Background gradient for gameplay
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#0a0408');
  skyGrad.addColorStop(1, '#180c10');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Background is handled by CSS, but we can add stars/particles
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 30; i++) {
    const sx = (i * 123) % W, sy = (i * 97) % H;
    ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill();
  }

  // Ensure map exists before drawing the grid Elements
  if (!map || map.length === 0) return;

  // Draw Grid & Map
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const tile = map[r][c];
      const { x, y } = tile;
      const ts = tileSize;

      ctx.fillStyle = tile.type === 'path' ? '#6b5232' : 
                      tile.type === 'start' ? '#2e5a2e' :
                      tile.type === 'end' ? '#5a2e2e' : '#3a4a35';
      ctx.fillRect(x, y, ts, ts);

      // Path decoration
      if (tile.type === 'path' || tile.type === 'start' || tile.type === 'end') {
        ctx.fillStyle = 'rgba(212,168,67,0.15)';
        ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
        ctx.fillStyle = 'rgba(100,80,40,0.5)';
        ctx.beginPath(); ctx.arc(x + ts * 0.3, y + ts * 0.3, ts * 0.12, 0, Math.PI * 2); ctx.fill();
      }

      ctx.strokeStyle = 'rgba(212,168,67,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, ts, ts);

      if (tile.type === 'start') {
        ctx.fillStyle = '#44ff66'; ctx.font = `${ts*0.5}px serif`;
        ctx.textAlign = 'center'; ctx.fillText('⚑', x+ts/2, y+ts/2+ts*0.2);
      }
      if (tile.type === 'end') {
        ctx.fillStyle = '#ff4444'; ctx.font = `${ts*0.55}px serif`;
        ctx.textAlign = 'center'; ctx.fillText('🏰', x+ts/2, y+ts/2+ts*0.2);
      }
      
      // Hover ring
      if (selectedTowerType && tile.type === 'grass') {
          ctx.fillStyle = 'rgba(212,168,67,0.2)';
          ctx.fillRect(x+1, y+1, ts-2, ts-2);
      }
    }
  }

  // Range rings
  if (selectedTower) {
    const t = selectedTower;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.def.range * tileSize, 0, Math.PI * 2);
    ctx.strokeStyle = t.def.color;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Projectiles
  projectiles.forEach(p => {
    const t = 1 - p.life;
    const px = p.x + (p.tx - p.x) * t;
    const py = p.y + (p.ty - p.y) * t;
    ctx.beginPath(); ctx.arc(px, py, p.size * 5, 0, Math.PI * 2);
    ctx.fillStyle = p.col + 'cc';
    ctx.shadowColor = p.col; ctx.shadowBlur = 10;
    ctx.fill(); ctx.shadowBlur = 0;
    p.life -= 0.1 * speed;
  });
  projectiles = projectiles.filter(p => p.life > 0);
  
  // Particles
  particles.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2);
    let alpha = Math.max(0, Math.min(255, Math.floor(p.life * 255))).toString(16).padStart(2,'0');
    ctx.fillStyle = p.col + alpha;
    ctx.fill();
    p.x += p.vx; p.y += p.vy; p.life -= 0.02;
  });
  particles = particles.filter(p => p.life > 0);

  // Draw Towers
  towers.forEach(t => {
    ctx.font = `${tileSize * 0.7}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(TOWER_DEFS[t.type].icon, t.x, t.y + tileSize * 0.25);
    // Lv dots
    for(let i=0; i<t.level; i++) {
        ctx.fillStyle = t.def.color;
        ctx.beginPath(); ctx.arc(t.tile.x + 8 + i * 8, t.tile.y + tileSize - 8, 3, 0, Math.PI * 2); ctx.fill();
    }
  });

  // Draw Enemies
  enemies.forEach(e => {
    ctx.save();
    ctx.translate(e.x, e.y);
    const bob = Math.sin(frame * 0.1 + e.id) * 3;
    ctx.font = `${e.size * 1.5}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(e.icon, 0, bob);
    // HP
    const bw = e.size * 2, bh=4;
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(-bw/2, -e.size-15, bw, bh);
    ctx.fillStyle = '#cc2222'; ctx.fillRect(-bw/2, -e.size-15, bw * (e.hp/e.maxHp), bh);
    ctx.restore();
  });

  // Floating Text
  floatingTexts.forEach(ft => {
    ctx.fillStyle = ft.col; ctx.font = 'bold 14px Cinzel Decorative, serif';
    ctx.fillText(ft.text, ft.x, ft.y);
    ft.y -= 1; ft.life -= 0.02;
  });
  floatingTexts = floatingTexts.filter(ft => ft.life > 0);

  // Wave Button
  if (!waveActive && gameState === 'play' && wave < TOTAL_WAVES) {
    const bx = W / 2, by = H - 150;
    ctx.fillStyle = 'rgba(139,26,26,0.9)';
    ctx.beginPath();
    ctx.roundRect(bx - 100, by - 25, 200, 50, 10);
    ctx.fill();
    ctx.fillStyle = '#f5d070'; ctx.font = 'bold 16px Cinzel Decorative, serif';
    ctx.textAlign = 'center'; ctx.fillText('⚔ START WAVE ' + (wave + 1), bx, by + 6);
  }
}

// ─── UTILS ───────────────────────────────────────────────
function addProjectile(x1, y1, x2, y2, col, size) {
  projectiles.push({ x: x1, y: y1, tx: x2, ty: y2, col, size, life: 1 });
}
function spawnParticle(x, y, col, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s-1, life: 1, col, r: 2 + Math.random()*2 });
  }
}
function addFloatText(x, y, text, col) {
  floatingTexts.push({ x, y, text, col, life: 1 });
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ─── GAME FLOW ──────────────────────────────────────────
window.showGuide = () => {
  document.getElementById('splash').classList.add('off');
  document.getElementById('guide').classList.remove('off');
};

window.startGame = () => {
  sfx.init();
  sfx.startAmbience();
  document.getElementById('guide').classList.add('off');
  document.getElementById('game-overlay').style.display = 'none';
  
  wave = 0; hp = 20; gold = 200; score = 0;
  towers = []; enemies = []; projectiles = []; particles = []; floatingTexts = [];
  waveActive = false; frame = 0; speed = 1; paused = false;
  
  buildMap();
  buildPalette();
  updateHUD();
  
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('tower-palette').style.display = 'flex';
  document.getElementById('ctrl-btns').style.display = 'flex';
  
  gameState = 'play';
};

window.restartGame = () => startGame();
window.goMenu = () => {
    gameState = 'splash';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('tower-palette').style.display = 'none';
    document.getElementById('ctrl-btns').style.display = 'none';
    document.getElementById('game-overlay').style.display = 'none';
    document.getElementById('splash').classList.remove('off');
};

function gameOver() {
  gameState = 'over'; sfx.play('lose');
  document.getElementById('ov-title').textContent = '💀 KINGDOM FALLEN';
  document.getElementById('ov-stats').innerHTML = `<div class="ov-stat"><div class="ov-stat-val">${wave}</div><div class="ov-stat-lbl">WAVES</div></div>`;
  document.getElementById('game-overlay').style.display = 'flex';
}
function winGame() {
  gameState = 'over'; sfx.play('win');
  document.getElementById('ov-title').textContent = '🏆 VICTORIOUS!';
  document.getElementById('game-overlay').style.display = 'flex';
}

function updateHUD() {
  document.getElementById('hud-gold').textContent = '🪙 ' + gold;
  document.getElementById('hud-hp').textContent = '❤ ' + hp;
  document.getElementById('hud-score').textContent = score;
  document.getElementById('hud-wave').textContent = 'WAVE ' + (wave || 1);
  document.getElementById('hp-fill').style.width = (hp/20*100) + '%';
  updatePalette();
}

// ─── CONTROLS ───────────────────────────────────────────
CV.addEventListener('click', (e) => {
  if (gameState !== 'play') return;
  const rect = CV.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;

  // Check Wave Button
  if (!waveActive && wave < TOTAL_WAVES) {
    const bx = W / 2, by = H - 150;
    if (Math.abs(mx - bx) < 100 && Math.abs(my - by) < 25) { startWave(); return; }
  }

  // Click on tile
  let clickedTile = null;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const t = map[r][c];
      if (mx >= t.x && mx < t.x + tileSize && my >= t.y && my < t.y + tileSize) { clickedTile = t; break; }
    }
  }
  
  if (clickedTile) {
    if (clickedTile.tower) {
        selectedTower = clickedTile.tower;
        selectedTowerType = null;
        showTowerMenu(selectedTower);
    } else if (selectedTowerType) {
        placeTower(clickedTile);
    }
  }
});

function showTowerMenu(t) {
    const def = TOWER_DEFS[t.type];
    const upgCost = def.upgCost * t.level;
    const sellVal = Math.floor(def.cost * 0.6 + (t.level-1) * def.upgCost * 0.5);
    
    // Simple confirm for now or toast with actions
    showToast(`${def.name} Lv${t.level}. Press U to Upgrade (🪙${upgCost}) or S to Sell (🪙${sellVal})`);
}

function startWave() {
  if (waveActive || wave >= TOTAL_WAVES) return;
  wave++;
  waveActive = true;
  const def = WAVE_DEFS[wave - 1];
  enemyQueue = [];
  def.enemies.forEach(g => { for(let i=0; i<g.n; i++) enemyQueue.push({ type: g.t, delay: g.gap }); });
  spawnIdx = 0; spawnTimer = 0;
  sfx.play('waveStart');
  updateHUD();
}

window.toggleSpeed = () => { speed = speed === 1 ? 2 : 1; document.getElementById('speed-btn').classList.toggle('active', speed === 2); };
window.togglePause = () => { paused = !paused; document.getElementById('pause-btn').classList.toggle('active', paused); };

// Loop
let loopError = null;
function loop() {
  try {
    update();
    draw();
  } catch(e) {
    if(!loopError) {
      loopError = e;
      ctx.fillStyle = 'red';
      ctx.font = '20px sans-serif';
      ctx.fillText(e.message, 50, 50);
      ctx.fillText(e.stack.substring(0, 50), 50, 80);
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Polyfill roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    this.beginPath(); this.moveTo(x + r, y);
    this.lineTo(x + w - r, y); this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r); this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h); this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r); this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
  };
}

// Keyboard
document.addEventListener('keydown', e => {
  if (selectedTower) {
    if (e.key.toLowerCase() === 'u') {
        const cost = TOWER_DEFS[selectedTower.type].upgCost * selectedTower.level;
        if (gold >= cost && selectedTower.level < TOWER_DEFS[selectedTower.type].maxLv) {
            gold -= cost; selectedTower.level++;
            selectedTower.def.dmg *= 1.5;
            selectedTower.def.range *= 1.1;
            sfx.play('upgrade'); updateHUD();
        }
    }
    if (e.key.toLowerCase() === 's') {
        const def = TOWER_DEFS[selectedTower.type];
        gold += Math.floor(def.cost * 0.6);
        selectedTower.tile.type = 'grass'; selectedTower.tile.tower = null;
        towers = towers.filter(tw => tw !== selectedTower);
        selectedTower = null;
        sfx.play('sell'); updateHUD();
    }
  }
});
