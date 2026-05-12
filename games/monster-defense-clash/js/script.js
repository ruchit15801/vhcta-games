
/* 'use strict'; — removed to allow GC global shortcut */
/* ============================================================
   MONSTER DEFENSE CLASH — Complete Game Engine
   Version 1.0  |  Canvas + Vanilla JS
   ============================================================ */

// ─────────────────────────────────────────────
//  CONSTANTS & CONFIG
// ─────────────────────────────────────────────
const GAME_CONFIG = {
  CANVAS_W: 1200,
  CANVAS_H: 720,
  LANES: 5,
  GRID_COLS: 10,
  GRID_ROWS: 5,
  CELL_W: 100,
  CELL_H: 110,
  BASE_X: 60,
  START_COL: 1,
  ENEMY_START_X: 1220,
  BASE_HEALTH: 100,
  START_ENERGY: 150,
  ENERGY_REGEN: 0.6,    // per second
  MAX_ENERGY: 500,
  FPS: 60,
};

const GC = GAME_CONFIG;

// roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'undefined') r = 0;
    if (typeof r === 'object') r = r[0] || 0;
    r = Math.min(r, w/2, h/2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.arcTo(x + w, y, x + w, y + r, r);
    this.lineTo(x + w, y + h - r);
    this.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.lineTo(x + r, y + h);
    this.arcTo(x, y + h, x, y + h - r, r);
    this.lineTo(x, y + r);
    this.arcTo(x, y, x + r, y, r);
    this.closePath();
    return this;
  };
}

// ─────────────────────────────────────────────
//  LEVELS DATA — 30 levels
// ─────────────────────────────────────────────
const LEVELS = [];
(function buildLevels(){
  const enemyNames = ['weak','fast','tank','boss'];
  for(let i=1;i<=30;i++){
    const isBoss = (i%10===0);
    const difficulty = i/30;
    const waves = Math.min(3 + Math.floor(i/5), 8);
    const enemysPerWave = Math.min(4 + i*1.5, 20);
    let types = ['weak'];
    if(i>=4) types.push('fast');
    if(i>=8) types.push('tank');
    if(i>=16||isBoss) types.push('boss');

    const def = {
      id: i,
      name: getLevelName(i),
      waves,
      enemiesPerWave: Math.floor(enemysPerWave),
      enemyTypes: types,
      spawnInterval: Math.max(0.6, 2 - i*0.04),  // seconds between enemies
      waveInterval: Math.max(10, 25 - i*0.5),       // seconds between waves
      energyBonus: 50 + i*10,
      speedMult: 1 + difficulty*0.5,
      healthMult: 1 + difficulty*1.5,
      isBoss,
      unlockUnit: i===3?'archer':(i===6?'mage':(i===10?'cannon':(i===15?'tesla':(i===20?'freeze':null)))),
    };
    LEVELS.push(def);
  }
  function getLevelName(n){
    const names=[
      'Meadow Dawn','Lost Path','Forest Edge','Dark Hollow','Goblin Pass',
      'Stone Bridge','Cursed Grove','Shadow Marsh','Iron Gate','Bone Tower',
      'Inferno Rise','Lava Plains','Dragon Pass','Demon Pit','The Abyss',
      'Core Chamber','Void Nexus','Chaos Realm','Crystal Cave','Death Peak',
      'Final Stand','Nightmare','Oblivion','Chaos Gate','Spectral Plains',
      'Ancient Ruins','Sky Fortress','Dark Throne','End Times','BOSS REALM',
    ];
    return names[(n-1)%names.length];
  }
})();

// ─────────────────────────────────────────────
//  UNIT DEFINITIONS
// ─────────────────────────────────────────────
const UNIT_DEFS = {
  archer: {
    id:'archer', name:'Archer', cost:75, damage:18, range:3, fireRate:1.2,
    health:100, color:'#22c55e', icon:'🏹', unlocked:true,
    projectileType:'arrow', splashRadius:0,
    upgrades:{ damage:0, speed:0, range:0 },
    description:'Fast, cheap, long-range',
  },
  knight: {
    id:'knight', name:'Knight', cost:125, damage:35, range:1.2, fireRate:0.9,
    health:220, color:'#3b82f6', icon:'⚔️', unlocked:true,
    projectileType:'slash', splashRadius:0,
    upgrades:{ damage:0, speed:0, range:0 },
    description:'Heavy melee defender',
  },
  mage: {
    id:'mage', name:'Mage', cost:175, damage:55, range:2.5, fireRate:0.7,
    health:80, color:'#8b5cf6', icon:'🔮', unlocked:false,
    projectileType:'magic', splashRadius:40,
    upgrades:{ damage:0, speed:0, range:0 },
    description:'Splash magic damage',
  },
  cannon: {
    id:'cannon', name:'Cannon', cost:250, damage:95, range:3.5, fireRate:0.4,
    health:180, color:'#f59e0b', icon:'💣', unlocked:false,
    projectileType:'cannonball', splashRadius:70,
    upgrades:{ damage:0, speed:0, range:0 },
    description:'Slow, massive AoE',
  },
  tesla: {
    id:'tesla', name:'Tesla', cost:300, damage:45, range:2.2, fireRate:2,
    health:120, color:'#06b6d4', icon:'⚡', unlocked:false,
    projectileType:'lightning', splashRadius:0,
    upgrades:{ damage:0, speed:0, range:0 },
    description:'Chain lightning fast',
  },
  freeze: {
    id:'freeze', name:'Freezer', cost:200, damage:20, range:2, fireRate:0.5,
    health:90, color:'#bae6fd', icon:'❄️', unlocked:false,
    projectileType:'ice', splashRadius:55,
    upgrades:{ damage:0, speed:0, range:0 },
    description:'Slows + freeze AoE',
  },
};

// ─────────────────────────────────────────────
//  ENEMY DEFINITIONS
// ─────────────────────────────────────────────
const ENEMY_DEFS = {
  weak:  { name:'Goblin',  health:60,  speed:80, damage:5,  reward:10, color:'#86efac', size:32 },
  fast:  { name:'Speeder', health:45,  speed:160, damage:8, reward:15, color:'#fde68a', size:28 },
  tank:  { name:'Troll',   health:280, speed:45, damage:20, reward:30, color:'#fca5a5', size:42 },
  boss:  { name:'BOSS',    health:800, speed:30, damage:40, reward:100,color:'#c084fc', size:55 },
};

// ─────────────────────────────────────────────
//  SOUND ENGINE (Web Audio API)
// ─────────────────────────────────────────────
const SFX = (() => {
  let ctx = null;
  let enabled = true;
  let bgGain = null;
  let bgOsc = null;
  let musicPlaying = false;

  function getCtx(){
    if(!ctx){
      try{ ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){}
    }
    return ctx;
  }

  function resumeCtx(){
    const c = getCtx();
    if(c && c.state === 'suspended') c.resume();
  }

  function playTone(freq, type, dur, vol=0.3, startDelay=0, freqEnd=null){
    if(!enabled) return;
    const c = getCtx(); if(!c) return;
    resumeCtx();
    const g = c.createGain();
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime + startDelay);
    if(freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + startDelay + dur);
    g.gain.setValueAtTime(vol, c.currentTime + startDelay);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startDelay + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + startDelay);
    o.stop(c.currentTime + startDelay + dur);
  }

  function playNoise(dur, vol=0.2, freq=2000){
    if(!enabled) return;
    const c = getCtx(); if(!c) return;
    resumeCtx();
    const buf = c.createBuffer(1, c.sampleRate*dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+dur);
    src.connect(filt); filt.connect(g); g.connect(c.destination);
    src.start();
  }

  return {
    get enabled(){ return enabled; },
    toggle(){ enabled = !enabled; if(!enabled && bgOsc){ bgOsc.stop(); bgOsc=null; musicPlaying=false; } if(enabled) this.startMusic(); return enabled; },

    shoot(type){
      if(type==='arrow'){ playTone(800,  'sawtooth', 0.08, 0.15); }
      else if(type==='magic'){ playTone(600,'sine',0.15,0.2,0,400); playTone(900,'sine',0.1,0.15,0.05); }
      else if(type==='cannonball'){ playNoise(0.15,0.3,400); playTone(150,'sawtooth',0.25,0.3); }
      else if(type==='lightning'){ playTone(1200,'square',0.12,0.25,0,200); }
      else if(type==='ice'){ playTone(400,'sine',0.2,0.15,0,800); playTone(1000,'sine',0.1,0.1); }
      else if(type==='slash'){ playNoise(0.1,0.15,1500); playTone(300,'sawtooth',0.1,0.2); }
    },

    hit(){ playTone(220,'sawtooth',0.12,0.25,0,80); },
    explosion(){ playNoise(0.4,0.5,300); playTone(80,'sawtooth',0.35,0.4,0,30); },
    waveAlert(){ for(let i=0;i<4;i++) playTone(440*(i+1),'square',0.15,0.3,i*0.1); },
    victory(){ [523,659,784,1047].forEach((f,i)=>playTone(f,'sine',0.4,0.35,i*0.15)); },
    defeat(){ [400,300,200,100].forEach((f,i)=>playTone(f,'sawtooth',0.4,0.3,i*0.2)); },
    ability(){ playTone(800,'sine',0.5,0.4,0,1200); playNoise(0.2,0.2,800); },
    coin(){ playTone(1047,'sine',0.1,0.3); playTone(1319,'sine',0.12,0.3,0.07); },
    place(){ playTone(600,'sine',0.15,0.3,0,800); },

    startMusic(){
      if(!enabled || musicPlaying) return;
      const c = getCtx(); if(!c) return;
      resumeCtx();
      musicPlaying = true;
      const notes=[220,247,262,294,330,392,440];
      let step=0;
      const schedule=()=>{
        if(!enabled||!musicPlaying) return;
        const freq=notes[step%notes.length];
        playTone(freq,'sine',0.45,0.06);
        if(step%3===0) playTone(freq*0.5,'triangle',0.45,0.04);
        step++;
        setTimeout(schedule, 480);
      };
      schedule();
    },
    stopMusic(){ musicPlaying=false; },
    resume(){ resumeCtx(); },
  };
})();

// ─────────────────────────────────────────────
//  PARTICLE SYSTEM
// ─────────────────────────────────────────────
class ParticleSystem {
  constructor(){
    this.particles = [];
  }

  spawn(x, y, type='hit', color='#f59e0b', count=8){
    for(let i=0;i<count;i++){
      const angle = (Math.PI*2/count)*i + Math.random()*0.5;
      let speed = 40+Math.random()*120;
      let life = 0.5+Math.random()*0.4;
      let size = 3+Math.random()*5;
      if(type==='explosion'){life=0.8+Math.random()*0.5; size=5+Math.random()*10; speed*=1.5;}
      if(type==='sparkle'){size=2+Math.random()*3; life=0.3+Math.random()*0.3;}
      this.particles.push({
        x,y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        life, maxLife:life, size, color, type,
        gravity: type==='explosion'?80:40,
        alpha:1,
      });
    }
  }

  spawnText(x, y, text, color='#f59e0b'){
    this.particles.push({
      isText:true, x, y, vy:-60, vx:(Math.random()-0.5)*20,
      text, color, life:0.8, maxLife:0.8, alpha:1,
    });
  }

  update(dt){
    this.particles = this.particles.filter(p=>{
      p.life -= dt;
      p.alpha = p.life/p.maxLife;
      p.x += p.vx*dt;
      p.y += p.vy*dt;
      if(!p.isText) p.vy += p.gravity*dt;
      return p.life > 0;
    });
  }

  draw(ctx){
    this.particles.forEach(p=>{
      ctx.save();
      ctx.globalAlpha = p.alpha;
      if(p.isText){
        ctx.font = `bold 18px 'Orbitron', monospace`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size*(p.alpha+0.2), 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    });
  }
}

// ─────────────────────────────────────────────
//  PROJECTILE CLASS
// ─────────────────────────────────────────────
class Projectile {
  constructor(sx, sy, target, type, damage, splash, color){
    this.x = sx; this.y = sy;
    this.target = target;
    this.type = type;
    this.damage = damage;
    this.splashRadius = splash;
    this.color = color;
    this.speed = type==='cannonball'?280:(type==='lightning'?600:420);
    this.alive = true;
    this.trail = [];
    this.size = type==='cannonball'?8:(type==='ice'?6:4);
    this.rotation = 0;
  }

  update(dt, enemies, particles){
    if(!this.alive) return;
    const tx = this.target.x, ty = this.target.y;
    const dx = tx-this.x, dy = ty-this.y;
    const dist = Math.sqrt(dx*dx+dy*dy);

    if(dist < 12){
      this.hit(enemies, particles);
      return;
    }

    this.trail.push({x:this.x, y:this.y});
    if(this.trail.length>8) this.trail.shift();

    const spd = this.speed * dt;
    this.x += (dx/dist)*spd;
    this.y += (dy/dist)*spd;
    this.rotation += 5*dt;
  }

  hit(enemies, particles){
    this.alive = false;
    SFX.hit();
    if(this.splashRadius > 0){
      SFX.explosion();
      particles.spawn(this.x, this.y, 'explosion', this.color, 14);
      enemies.forEach(e=>{
        const dx = e.x - this.x, dy = e.y - this.y;
        if(Math.sqrt(dx*dx+dy*dy) < this.splashRadius){
          e.takeDamage(this.damage, particles);
          if(this.type==='ice') e.freeze(2.5);
        }
      });
    } else {
      if(this.target && this.target.alive !== false){
        this.target.takeDamage(this.damage, particles);
        if(this.type==='ice') this.target.freeze(2.5);
      }
      particles.spawn(this.x, this.y, 'hit', this.color, 5);
    }
  }

  draw(ctx){
    if(!this.alive) return;
    ctx.save();

    // Trail
    this.trail.forEach((pt,i)=>{
      const alpha = (i/this.trail.length)*0.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, this.size*0.5*(i/this.trail.length), 0, Math.PI*2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;

    if(this.type==='arrow'){
      ctx.save();
      ctx.translate(this.x, this.y);
      const ang = Math.atan2(this.target.y-this.y, this.target.x-this.x);
      ctx.rotate(ang);
      ctx.fillStyle = '#86efac';
      ctx.fillRect(-8,-1.5,16,3);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(8,0); ctx.lineTo(0,-4); ctx.lineTo(0,4);
      ctx.fill();
      ctx.restore();
    } else if(this.type==='magic'){
      ctx.fillStyle = this.color;
      for(let i=0;i<3;i++){
        const angle = this.rotation + i*Math.PI*2/3;
        ctx.beginPath();
        ctx.arc(this.x+Math.cos(angle)*5, this.y+Math.sin(angle)*5, 4, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, 6, 0, Math.PI*2);
      ctx.fill();
    } else if(this.type==='cannonball'){
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(this.x-2, this.y-2, this.size*0.4, 0, Math.PI*2);
      ctx.fill();
    } else if(this.type==='lightning'){
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      const steps = 6;
      for(let i=0;i<steps;i++){
        const t = i/steps;
        const nx = this.x + (this.target.x-this.x)*t + (Math.random()-0.5)*8;
        const ny = this.y + (this.target.y-this.y)*t + (Math.random()-0.5)*8;
        ctx.lineTo(nx, ny);
      }
      ctx.lineTo(this.target.x, this.target.y);
      ctx.stroke();
    } else if(this.type==='ice'){
      ctx.fillStyle = '#bae6fd';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1;
      for(let i=0;i<4;i++){
        const ang = this.rotation + i*Math.PI/2;
        ctx.beginPath();
        ctx.moveTo(this.x,this.y);
        ctx.lineTo(this.x+Math.cos(ang)*10, this.y+Math.sin(ang)*10);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ─────────────────────────────────────────────
//  TOWER / UNIT CLASS
// ─────────────────────────────────────────────
class Tower {
  constructor(col, row, defId){
    this.col = col;
    this.row = row;
    this.def = JSON.parse(JSON.stringify(UNIT_DEFS[defId]));
    this.id = `tower_${Date.now()}_${Math.random()}`;

    // Position in canvas coords
    this.updatePosition();

    this.fireTimer = 0;
    this.target = null;
    this.animFrame = 0;
    this.animTimer = 0;
    this.scale = 0;
    this.scaleTarget = 1;
    this.shooting = false;
    this.shootTimer = 0;
    this.upgLvl = { damage:0, speed:0, range:0 };
    this.totalCost = this.def.cost;
    this.selected = false;
    this.floatOffset = 0;
    this.floatTimer = Math.random() * Math.PI * 2;
  }

  updatePosition(){
    const g = GAME_CONFIG;
    this.x = g.BASE_X + 180 + this.col * g.CELL_W + g.CELL_W/2;
    this.y = 150 + this.row * g.CELL_H + g.CELL_H/2;
  }

  getRange(){ return (this.def.range * GAME_CONFIG.CELL_W) * (1 + this.upgLvl.range*0.2); }
  getDamage(){ return this.def.damage * (1 + this.upgLvl.damage*0.3); }
  getFireRate(){ return this.def.fireRate * (1 + this.upgLvl.speed*0.3); }

  getUpgradeCost(type){
    const costs = { damage:80, speed:70, range:60 };
    return costs[type] + this.upgLvl[type] * 50;
  }

  upgrade(type){ this.upgLvl[type] = Math.min(this.upgLvl[type]+1, 5); }

  update(dt, enemies, projectiles){
    // Spawn animation
    if(this.scale < this.scaleTarget){
      this.scale = Math.min(this.scale + dt*5, this.scaleTarget);
    }

    this.floatTimer += dt;
    this.floatOffset = Math.sin(this.floatTimer*1.5) * 3;

    this.animTimer += dt;
    if(this.animTimer > 0.15){ this.animTimer=0; this.animFrame=(this.animFrame+1)%4; }

    this.shootTimer -= dt;
    if(this.shootTimer > 0) this.shooting = true;
    else this.shooting = false;

    // Fire rate timer
    this.fireTimer -= dt;
    if(this.fireTimer <= 0){
      // Find target in range
      this.target = this.findBestTarget(enemies);
      if(this.target){
        this.fire(projectiles);
        this.fireTimer = 1 / this.getFireRate();
        this.shooting = true;
        this.shootTimer = 0.15;
        SFX.shoot(this.def.projectileType);
      }
    }
  }

  findBestTarget(enemies){
    const range = this.getRange();
    let best = null;
    enemies.forEach(e=>{
      if(e.alive === false) return;
      const dx = e.x - this.x, dy = e.y - this.y;
      const d = Math.sqrt(dx*dx+dy*dy);
      if(d <= range){
        // Prioritize enemy furthest along the path (smallest x)
        if(!best || e.x < best.x){ best = e; }
      }
    });
    return best;
  }

  fire(projectiles){
    if(!this.target) return;
    const proj = new Projectile(
      this.x, this.y - 10,
      this.target,
      this.def.projectileType,
      this.getDamage(),
      this.def.splashRadius,
      this.def.color
    );
    projectiles.push(proj);
  }

  draw(ctx, selected){
    const x = this.x, y = this.y + this.floatOffset;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(this.scale, this.scale);

    // Range circle (when selected)
    if(selected || this.selected){
      ctx.beginPath();
      ctx.arc(0, 0, this.getRange(), 0, Math.PI*2);
      ctx.fillStyle = `${this.def.color}11`;
      ctx.fill();
      ctx.strokeStyle = `${this.def.color}66`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8,4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 28, 24, 8, 0, 0, Math.PI*2);
    ctx.fill();

    this.drawUnit(ctx, this.def.id, this.shootTimer);

    // Upgrade indicators
    const upgTotal = this.upgLvl.damage + this.upgLvl.speed + this.upgLvl.range;
    if(upgTotal > 0){
      for(let i=0;i<Math.min(upgTotal,9);i++){
        const angle = (i/9)*Math.PI*2 - Math.PI/2;
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(Math.cos(angle)*26, Math.sin(angle)*26, 2.5, 0, Math.PI*2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  drawUnit(ctx, type, shooting){
    const s = shooting ? 1.15 : 1;
    const color = this.def.color;
    const bounce = Math.sin(this.floatTimer*3)*2;

    ctx.shadowColor = color;
    ctx.shadowBlur = shooting ? 20 : 10;

    if(type === 'archer'){
      // Body
      ctx.fillStyle = '#166534';
      ctx.beginPath(); ctx.ellipse(0,2*s,12,16,0,0,Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.arc(0,-18+bounce,10,0,Math.PI*2); ctx.fill();
      // Hood
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.moveTo(-10,-14); ctx.lineTo(0,-30); ctx.lineTo(10,-14);
      ctx.closePath(); ctx.fill();
      // Bow
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(18, -6, 12, -Math.PI/2, Math.PI/2, false); ctx.stroke();
      ctx.strokeStyle = '#d4d4d4';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(18,-18); ctx.lineTo(18,6); ctx.stroke();
      // Star accent
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0,-30,3,0,Math.PI*2); ctx.fill();

    } else if(type === 'knight'){
      // Armor body
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath(); ctx.roundRect(-14,-4,28,28,5); ctx.fill();
      // Plate detail
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.roundRect(-10,0,20,16,3); ctx.fill();
      // Head/helmet
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath(); ctx.arc(0,-16+bounce,14,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2563eb';
      ctx.beginPath(); ctx.roundRect(-14,-24,28,18,6); ctx.fill();
      // Visor
      ctx.fillStyle = '#93c5fd';
      ctx.beginPath(); ctx.roundRect(-8,-20,16,6,2); ctx.fill();
      // Sword
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath(); ctx.roundRect(16,-28,5,40,2); ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.roundRect(10,-4,16,5,1); ctx.fill();

    } else if(type === 'mage'){
      // Robe
      ctx.fillStyle = '#4c1d95';
      const grad = ctx.createLinearGradient(-14,-10,14,24);
      grad.addColorStop(0,'#7c3aed'); grad.addColorStop(1,'#4c1d95');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(-14,24); ctx.lineTo(-10,-8); ctx.lineTo(10,-8); ctx.lineTo(14,24); ctx.closePath(); ctx.fill();
      // Hat
      ctx.fillStyle = '#3b0764';
      ctx.beginPath(); ctx.moveTo(0,-42+bounce); ctx.lineTo(-12,-14); ctx.lineTo(12,-14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0,-14,14,4,0,0,Math.PI*2); ctx.fill();
      // Face
      ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.arc(0,-20+bounce,9,0,Math.PI*2); ctx.fill();
      // Orb
      ctx.fillStyle = color;
      ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(22,-10,8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(20,-12,3,0,Math.PI*2); ctx.fill();

    } else if(type === 'cannon'){
      // Base
      ctx.fillStyle = '#a16207';
      ctx.beginPath(); ctx.roundRect(-16,4,32,20,5); ctx.fill();
      // Wheels
      ctx.fillStyle = '#78350f';
      [-12,12].forEach(ox=>{
        ctx.beginPath(); ctx.arc(ox,20,8,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#92400e'; ctx.lineWidth=2; ctx.stroke();
      });
      // Drum
      ctx.fillStyle = '#525252';
      ctx.beginPath(); ctx.ellipse(0,-2,16,16,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#737373';
      ctx.beginPath(); ctx.ellipse(0,-2,10,10,0,0,Math.PI*2); ctx.fill();
      // Barrel
      const ang = shooting ? -0.2 : -0.3;
      ctx.save(); ctx.rotate(ang);
      ctx.fillStyle = '#404040';
      ctx.beginPath(); ctx.roundRect(0,-6,30,12,4); ctx.fill();
      ctx.fillStyle = '#262626';
      ctx.beginPath(); ctx.arc(30,0,6,0,Math.PI*2); ctx.fill();
      ctx.restore();

    } else if(type === 'tesla'){
      // Stand
      ctx.fillStyle = '#164e63';
      ctx.beginPath(); ctx.roundRect(-8,10,16,16,3); ctx.fill();
      // Coil
      ctx.fillStyle = '#0e7490';
      ctx.beginPath(); ctx.ellipse(0,-2,14,18,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2;
      for(let i=-6;i<=6;i+=4){
        ctx.beginPath(); ctx.ellipse(0,i,14,3,0,0,Math.PI*2); ctx.stroke();
      }
      // Top orb
      ctx.fillStyle = color;
      ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.arc(0,-22+bounce,10,0,Math.PI*2); ctx.fill();
      // Lightning sparks
      if(shooting){
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.5;
        for(let i=0;i<4;i++){
          const ang2 = Math.random()*Math.PI*2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang2)*10, -22+Math.sin(ang2)*10);
          ctx.lineTo(Math.cos(ang2)*22, -22+Math.sin(ang2)*22);
          ctx.stroke();
        }
      }

    } else if(type === 'freeze'){
      // Crystal tower
      ctx.fillStyle = '#0c4a6e';
      ctx.beginPath(); ctx.roundRect(-10,8,20,18,4); ctx.fill();
      // Crystal shards
      ctx.fillStyle = '#bae6fd';
      ctx.shadowBlur = 15;
      [ [-6,-24], [0,-32], [6,-24], [-12,-16], [12,-16] ].forEach(([cx,cy])=>{
        ctx.save();
        ctx.translate(cx,cy+bounce*0.5);
        ctx.beginPath();
        ctx.moveTo(0,-8); ctx.lineTo(5,0); ctx.lineTo(0,8); ctx.lineTo(-5,0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      });
      // Center gem
      ctx.fillStyle = '#e0f2fe';
      ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(0,-14+bounce,8,0,Math.PI*2); ctx.fill();
    }
  }
}

// ─────────────────────────────────────────────
//  ENEMY CLASS
// ─────────────────────────────────────────────
class Enemy {
  constructor(type, laneIndex, healthMult, speedMult){
    this.type = type;
    this.def = Object.assign({}, ENEMY_DEFS[type]);
    this.lane = laneIndex;
    this.health = this.def.health * healthMult;
    this.maxHealth = this.health;
    this.speed = this.def.speed * speedMult;
    this.baseSpeed = this.speed;
    this.damage = this.def.damage;
    this.reward = this.def.reward;
    this.color = this.def.color;
    this.size = this.def.size;
    this.alive = true;

    // Position
    this.x = GAME_CONFIG.ENEMY_START_X;
    this.y = 150 + this.lane * GAME_CONFIG.CELL_H + GAME_CONFIG.CELL_H/2;

    // State
    this.freezeTimer = 0;
    this.hitFlash = 0;
    this.animTimer = 0;
    this.animFrame = 0;
    this.deathTimer = 0;
    this.dying = false;
    this.bounceY = 0;
    this.walkCycle = 0;
  }

  freeze(duration){ this.freezeTimer = duration; this.speed = this.baseSpeed * 0.25; }

  takeDamage(dmg, particles){
    this.health -= dmg;
    this.hitFlash = 0.2;
    const col = this.health < this.maxHealth*0.3 ? '#ef4444' : '#f59e0b';
    particles.spawnText(this.x, this.y-this.size, `-${Math.round(dmg)}`, col);
    if(this.health <= 0) this.die();
  }

  die(){
    if(this.dying) return;
    this.dying = true;
    this.alive = false;
    this.deathTimer = 0.5;
  }

  update(dt){
    this.animTimer += dt;
    if(this.animTimer > 0.1){ this.animTimer=0; this.animFrame=(this.animFrame+1)%8; }

    this.walkCycle += dt * this.speed * 0.04;
    this.bounceY = Math.sin(this.walkCycle) * (this.dying?0:4);

    if(this.freezeTimer > 0){
      this.freezeTimer -= dt;
      if(this.freezeTimer <= 0){ this.freezeTimer=0; this.speed=this.baseSpeed; }
    }

    if(this.hitFlash > 0) this.hitFlash -= dt;
    if(this.dying){ this.deathTimer-=dt; return; }

    // Move left
    this.x -= this.speed * dt;
  }

  draw(ctx){
    if(!this.alive && this.deathTimer <= 0) return;
    const alpha = this.dying ? Math.max(0, this.deathTimer/0.5) : 1;
    const x = this.x, y = this.y + this.bounceY;
    const sz = this.size;
    const isBoss = this.type === 'boss';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    if(this.dying){
      ctx.rotate((0.5-this.deathTimer/0.5)*Math.PI*0.5);
      ctx.scale(1+this.deathTimer, 1+this.deathTimer);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, sz+4, sz*0.8, sz*0.25, 0, 0, Math.PI*2);
    ctx.fill();

    if(this.hitFlash > 0){
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20;
    } else {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.freezeTimer>0 ? 15 : 8;
    }

    // Draw enemy by type
    const freezeColor = this.freezeTimer>0 ? '#bae6fd' : this.color;

    if(this.type === 'weak'){ // Goblin
      // Legs (walking)
      ctx.fillStyle = '#166534';
      const legSwing = Math.sin(this.walkCycle)*8;
      ctx.beginPath(); ctx.ellipse(-8, sz-2+legSwing, 6, 10, 0.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8, sz-2-legSwing, 6, 10, -0.2, 0, Math.PI*2); ctx.fill();
      // Body
      ctx.fillStyle = freezeColor;
      ctx.beginPath(); ctx.ellipse(0, 4, 16, 18, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#86efac';
      ctx.beginPath(); ctx.arc(0, -18, 13, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(-5,-18,3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(5,-18,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-5,-18,1.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(5,-18,1.5,0,Math.PI*2); ctx.fill();
      // Ears
      ctx.fillStyle = '#86efac';
      ctx.beginPath(); ctx.moveTo(-12,-18); ctx.lineTo(-20,-30); ctx.lineTo(-6,-14); ctx.fill();
      ctx.beginPath(); ctx.moveTo(12,-18); ctx.lineTo(20,-30); ctx.lineTo(6,-14); ctx.fill();
      // Club
      const armSwing = Math.sin(this.walkCycle)*15;
      ctx.save(); ctx.rotate((armSwing-20)*Math.PI/180);
      ctx.fillStyle = '#a16207';
      ctx.beginPath(); ctx.roundRect(14,-10,8,28,3); ctx.fill();
      ctx.fillStyle = '#92400e';
      ctx.beginPath(); ctx.arc(18,-10,10,0,Math.PI*2); ctx.fill();
      ctx.restore();

    } else if(this.type === 'fast'){ // Speeder
      const legSwing = Math.sin(this.walkCycle)*12;
      // Very fast legs
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.ellipse(-6, sz-4+legSwing, 5, 12, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, sz-4-legSwing, 5, 12, -0.3, 0, Math.PI*2); ctx.fill();
      // Slim body
      ctx.fillStyle = freezeColor;
      ctx.beginPath(); ctx.ellipse(0, 4, 12, 15, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.arc(0,-16,10,0,Math.PI*2); ctx.fill();
      // Angry eyes
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath(); ctx.arc(-4,-16,3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(4,-16,3,0,Math.PI*2); ctx.fill();
      // Speed lines behind
      ctx.strokeStyle = freezeColor;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha *= 0.5;
      [8,12,16].forEach(offset=>{
        const len = 6+offset;
        ctx.beginPath(); ctx.moveTo(sz+offset, -6); ctx.lineTo(sz+offset+len, -6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sz+offset, 4); ctx.lineTo(sz+offset+len+4, 4); ctx.stroke();
      });
      ctx.globalAlpha = alpha;
      // Wings
      ctx.fillStyle = `${freezeColor}88`;
      ctx.beginPath(); ctx.ellipse(-16,-4,10,5,0.4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(16,-4,10,5,-0.4,0,Math.PI*2); ctx.fill();

    } else if(this.type === 'tank'){ // Troll
      const legSwing = Math.sin(this.walkCycle)*5;
      // Big legs
      ctx.fillStyle = '#78350f';
      ctx.beginPath(); ctx.roundRect(-18, sz-4+legSwing, 16, 18, 4); ctx.fill();
      ctx.beginPath(); ctx.roundRect(2, sz-4-legSwing, 16, 18, 4); ctx.fill();
      // Massive body
      ctx.fillStyle = freezeColor;
      ctx.beginPath(); ctx.roundRect(-22, -8, 44, 36, 10); ctx.fill();
      // Armor plates
      ctx.fillStyle = `${freezeColor}88`;
      ctx.fillStyle = '#64748b';
      ctx.beginPath(); ctx.roundRect(-18, -4, 36, 10, 3); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-18, 8, 36, 10, 3); ctx.fill();
      // Big head
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath(); ctx.arc(0, -22, 20, 0, Math.PI*2); ctx.fill();
      // Horns
      ctx.fillStyle = '#78350f';
      ctx.beginPath(); ctx.moveTo(-18,-22); ctx.lineTo(-24,-42); ctx.lineTo(-10,-30); ctx.fill();
      ctx.beginPath(); ctx.moveTo(18,-22); ctx.lineTo(24,-42); ctx.lineTo(10,-30); ctx.fill();
      // Eyes
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(-8,-22,5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(8,-22,5,0,Math.PI*2); ctx.fill();
      // Arms holding weapon
      const armSwing = Math.sin(this.walkCycle)*8;
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath(); ctx.roundRect(22,-14+armSwing,14,30,5); ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.beginPath(); ctx.arc(29,-20+armSwing,10,0,Math.PI*2); ctx.fill();

    } else if(this.type === 'boss'){ // Boss Monster
      const legSwing = Math.sin(this.walkCycle)*4;
      const time = Date.now()/1000;
      // Huge legs
      ctx.fillStyle = '#4a044e';
      ctx.beginPath(); ctx.roundRect(-22, sz-6+legSwing, 20, 22, 5); ctx.fill();
      ctx.beginPath(); ctx.roundRect(2, sz-6-legSwing, 20, 22, 5); ctx.fill();
      // Massive body with glow
      const grad = ctx.createRadialGradient(0,0,5,0,0,sz);
      grad.addColorStop(0,'#c084fc');
      grad.addColorStop(0.5,freezeColor);
      grad.addColorStop(1,'#4a044e');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(-28,-18,56,46,12); ctx.fill();
      // Crown
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b'; ctx.shadowBlur=20;
      ctx.beginPath();
      ctx.moveTo(-20,-28); ctx.lineTo(-20,-48); ctx.lineTo(-10,-38); ctx.lineTo(0,-52); ctx.lineTo(10,-38); ctx.lineTo(20,-48); ctx.lineTo(20,-28);
      ctx.closePath(); ctx.fill();
      // Boss head
      ctx.fillStyle = '#e879f9';
      ctx.shadowColor = '#c084fc'; ctx.shadowBlur=15;
      ctx.beginPath(); ctx.arc(0,-36,26,0,Math.PI*2); ctx.fill();
      // Boss eyes — glowing
      const eyePulse = 0.5+0.5*Math.sin(time*4);
      ctx.fillStyle = `rgba(255,${Math.floor(50+eyePulse*100)},0,1)`;
      ctx.shadowColor = '#f97316'; ctx.shadowBlur=15+eyePulse*10;
      ctx.beginPath(); ctx.arc(-10,-36,7,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(10,-36,7,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-10,-36,3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(10,-36,3,0,Math.PI*2); ctx.fill();
      // Boss wings
      ctx.fillStyle = `rgba(168,85,247,0.6)`;
      ctx.shadowBlur=10;
      const wingFlap = Math.sin(time*3)*0.2;
      ctx.save(); ctx.rotate(-0.5+wingFlap);
      ctx.beginPath(); ctx.ellipse(-36,-20,28,14,0.3,0,Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.rotate(0.5-wingFlap);
      ctx.beginPath(); ctx.ellipse(36,-20,28,14,-0.3,0,Math.PI*2); ctx.fill();
      ctx.restore();
      // Aura rings
      ctx.strokeStyle = `rgba(192,132,252,${0.2+eyePulse*0.3})`;
      ctx.lineWidth = 2;
      for(let r=sz+4;r<=sz+24;r+=10){
        ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
      }
    }

    ctx.restore();

    // Health bar
    this.drawHealthBar(ctx, x, y, sz);
  }

  drawHealthBar(ctx, x, y, sz){
    const bw = sz*2.4, bh = 6;
    const bx = x - bw/2, by = y - sz - 16;
    const pct = Math.max(0, this.health/this.maxHealth);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(bx-1,by-1,bw+2,bh+2,3); ctx.fill();

    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,2); ctx.fill();

    const hpColor = pct>0.6?'#22c55e':(pct>0.3?'#f59e0b':'#ef4444');
    ctx.fillStyle = hpColor;
    ctx.shadowColor = hpColor; ctx.shadowBlur=4;
    ctx.beginPath(); ctx.roundRect(bx,by,bw*pct,bh,2); ctx.fill();
    ctx.shadowBlur=0;

    if(this.type==='boss'){
      ctx.font = 'bold 9px Orbitron';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(this.health)}/${this.maxHealth}`, x, by-2);
    }
  }
}

// ─────────────────────────────────────────────
//  MAIN GAME CLASS
// ─────────────────────────────────────────────
class Game {
  constructor(){
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.initialized = false;

    // Game state
    this.state = 'menu';  // menu, playing, paused, gameover, victory
    this.currentLevel = null;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = new ParticleSystem();

    // Resources
    this.energy = GC.START_ENERGY;
    this.maxEnergy = GC.MAX_ENERGY;
    this.score = 0;
    this.kills = 0;
    this.baseHealth = GC.BASE_HEALTH;
    this.maxBaseHealth = GC.BASE_HEALTH;

    // Waves
    this.waveNum = 0;
    this.totalWaves = 0;
    this.waveActive = false;
    this.waveEnemiesLeft = 0;
    this.waveSpawnTimer = 0;
    this.waveSpawnInterval = 1;
    this.betweenWaveTimer = 0;
    this.betweenWaveDelay = 5;
    this.levelDef = null;
    this.spawnedThisWave = 0;

    // Selected unit for placement
    this.selectedUnitId = null;
    this.selectedTower = null;

    // Hover
    this.hoverCol = -1;
    this.hoverRow = -1;
    this.canvasRect = null;

    // Grid
    this.grid = {};  // "col,row" → tower

    // Abilities
    this.abilities = {
      bomb: { name:'Bomb', icon:'💥', cooldown:30, timer:30 },
      freeze: { name:'Freeze', icon:'❄️', cooldown:25, timer:25 },
      fire: { name:'Fire', icon:'🔥', cooldown:20, timer:20 },
    };

    // Stats
    this.unlockedLevels = [1];
    this.levelStars = {};
    this.unlockedUnits = new Set(['archer','knight']);

    // Screen shake
    this.shakeTimer = 0;
    this.shakeIntensity = 0;

    // Time
    this.lastTime = 0;
    this.totalTime = 0;

    // FPS counter
    this.fps = 0;
    this.fpsTimer = 0;
    this.fpsCount = 0;

    // Environment animation
    this.envTimer = 0;

    // Camera / scale
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Load save
    this.loadSave();
    this.setupEventListeners();
    this.setupResize();
    this.startRenderLoop();
  }

  // ─── Save / Load ───────────────────────────
  saveGame(){
    const save = {
      unlockedLevels: [...this.unlockedLevels],
      levelStars: this.levelStars,
      unlockedUnits: [...this.unlockedUnits],
    };
    try{ localStorage.setItem('mdc_save', JSON.stringify(save)); }catch(e){}
  }

  loadSave(){
    try{
      const raw = localStorage.getItem('mdc_save');
      if(!raw) return;
      const save = JSON.parse(raw);
      this.unlockedLevels = save.unlockedLevels || [1];
      this.levelStars = save.levelStars || {};
      this.unlockedUnits = new Set(save.unlockedUnits || ['archer','knight']);
      // Sync unit defs
      Object.keys(UNIT_DEFS).forEach(id=>{
        UNIT_DEFS[id].unlocked = this.unlockedUnits.has(id);
      });
    }catch(e){}
  }

  // ─── Setup ─────────────────────────────────
  setupResize(){
    const resize = ()=>{
      const hudH   = document.getElementById('game-hud')?.offsetHeight   || 0;
      const panelH = document.getElementById('unit-panel')?.offsetHeight  || 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Available area = full viewport; canvas is position:fixed and covers everything
      this.canvas.width  = vw;
      this.canvas.height = vh;

      // Scale game world to fit inside the area NOT occupied by HUD / panel
      const availW = vw;
      const availH = vh - hudH - panelH;
      this.scale   = Math.min(availW / GC.CANVAS_W, availH / GC.CANVAS_H);
      this.offsetX = (vw - GC.CANVAS_W * this.scale) / 2;
      // Push content down below HUD
      this.offsetY = hudH + Math.max(0, (availH - GC.CANVAS_H * this.scale) / 2);
    };
    resize();
    window.addEventListener('resize', resize);
    // Re-run once UI panels are rendered
    setTimeout(resize, 300);
  }

  toGameCoords(cx, cy){
    // cx/cy are already relative to canvas top-left (after subtracting rect.left/top)
    return {
      x: (cx - this.offsetX) / this.scale,
      y: (cy - this.offsetY) / this.scale,
    };
  }

  setupEventListeners(){
    // Helper: is a point inside a DOM element?
    const inEl = (x, y, id) => {
      const el = document.getElementById(id);
      if(!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    this.canvas.addEventListener('click', e=>{
      if(this.state!=='playing') return;
      // Ignore if click is over UI elements
      if(inEl(e.clientX, e.clientY, 'unit-panel')) return;
      if(inEl(e.clientX, e.clientY, 'game-hud'))   return;
      if(inEl(e.clientX, e.clientY, 'upgrade-panel')) return;
      // Canvas is full-screen so rect.left/top = 0
      this.handleGameClick(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('touchend', e=>{
      e.preventDefault();
      if(this.state!=='playing') return;
      const t = e.changedTouches[0];
      // Ignore touches that lifted over UI panels
      if(inEl(t.clientX, t.clientY, 'unit-panel'))   return;
      if(inEl(t.clientX, t.clientY, 'game-hud'))     return;
      if(inEl(t.clientX, t.clientY, 'upgrade-panel')) return;
      this.handleGameClick(t.clientX, t.clientY);
    }, { passive:false });

    this.canvas.addEventListener('mousemove', e=>{
      if(this.state!=='playing') return;
      const {x,y} = this.toGameCoords(e.clientX, e.clientY);
      this.updateHover(x, y);
    });

    this.canvas.addEventListener('touchmove', e=>{
      e.preventDefault();
      if(this.state!=='playing') return;
      const t = e.touches[0];
      const {x,y} = this.toGameCoords(t.clientX, t.clientY);
      this.updateHover(x, y);
    }, { passive:false });

    window.addEventListener('keydown', e=>{
      if(e.key==='Escape') this.togglePause();
      if(e.key==='1') this.selectUnit('archer');
      if(e.key==='2') this.selectUnit('knight');
      if(e.key==='3') this.selectUnit('mage');
      if(e.key==='4') this.selectUnit('cannon');
      if(e.key==='5') this.selectUnit('tesla');
      if(e.key==='6') this.selectUnit('freeze');
    });
  }

  updateHover(gx, gy){
    const col = Math.floor((gx - (GC.BASE_X+180)) / GC.CELL_W);
    const row = Math.floor((gy - 150) / GC.CELL_H);
    if(col>=0 && col<GC.GRID_COLS && row>=0 && row<GC.GRID_ROWS){
      this.hoverCol = col;
      this.hoverRow = row;
    } else {
      this.hoverCol = -1;
      this.hoverRow = -1;
    }
  }

  handleGameClick(cx, cy){
    const {x,y} = this.toGameCoords(cx, cy);
    const col = Math.floor((x - (GC.BASE_X+180)) / GC.CELL_W);
    const row = Math.floor((y - 150) / GC.CELL_H);

    // Click on grid
    if(col>=0 && col<GC.GRID_COLS && row>=0 && row<GC.GRID_ROWS){
      const key = `${col},${row}`;
      const existing = this.grid[key];

      if(existing){
        // Select existing tower
        this.selectedTower = existing;
        this.showUpgradePanel(existing, cx, cy);
        this.selectedUnitId = null;
      } else if(this.selectedUnitId){
        // Place tower
        this.placeTower(col, row);
      } else {
        this.hideUpgradePanel();
        this.selectedTower = null;
      }
    } else {
      this.hideUpgradePanel();
      this.selectedTower = null;
    }
  }

  placeTower(col, row){
    const def = UNIT_DEFS[this.selectedUnitId];
    if(!def || !def.unlocked) return;
    if(this.energy < def.cost){ this.flashEnergyWarning(); return; }
    const key = `${col},${row}`;
    if(this.grid[key]) return;

    // Check not on base column
    if(col === 0 && row >= 0) return;

    const tower = new Tower(col, row, this.selectedUnitId);
    this.towers.push(tower);
    this.grid[key] = tower;
    this.energy -= def.cost;
    SFX.place();
    this.particles.spawn(tower.x, tower.y, 'sparkle', def.color, 12);
    this.updateHUD();
  }

  sellTower(tower){
    const key = `${tower.col},${tower.row}`;
    delete this.grid[key];
    this.towers = this.towers.filter(t=>t!==tower);
    const sellValue = Math.floor(tower.totalCost * 0.6);
    this.energy += sellValue;
    this.particles.spawnText(tower.x, tower.y, `+${sellValue}⚡`, '#f59e0b');
    SFX.coin();
    this.hideUpgradePanel();
    this.selectedTower = null;
    this.updateHUD();
  }

  // ─── Level Management ───────────────────────
  startLevel(levelId){
    const ldef = LEVELS[levelId-1];
    if(!ldef) return;
    this.currentLevel = levelId;
    this.levelDef = ldef;

    // Reset state
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = new ParticleSystem();
    this.grid = {};
    this.energy = GC.START_ENERGY;
    this.score = 0;
    this.kills = 0;
    this.baseHealth = GC.BASE_HEALTH;
    this.maxBaseHealth = GC.BASE_HEALTH;
    this.waveNum = 0;
    this.totalWaves = ldef.waves;
    this.waveActive = false;
    this.waveEnemiesLeft = 0;
    this.spawnedThisWave = 0;
    this.betweenWaveTimer = 5; // 5 seconds before wave 1
    this.selectedUnitId = null;
    this.selectedTower = null;
    this.abilities.bomb.timer = this.abilities.bomb.cooldown;
    this.abilities.freeze.timer = this.abilities.freeze.cooldown;
    this.abilities.fire.timer = this.abilities.fire.cooldown;
    this.totalTime = 0;

    // Sync unlocked units
    Object.keys(UNIT_DEFS).forEach(id=>{
      UNIT_DEFS[id].unlocked = this.unlockedUnits.has(id);
    });

    this.state = 'playing';
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('level-select').classList.add('hidden');
    document.getElementById('game-canvas-container').classList.add('active');
    document.getElementById('game-hud').style.display = 'block';
    document.getElementById('unit-panel').classList.remove('hidden');

    this.buildUnitPanel();
    this.updateHUD();
    // Re-compute canvas scale now that HUD + panel are visible
    setTimeout(()=>{ window.dispatchEvent(new Event('resize')); }, 50);
    SFX.resume();
    SFX.startMusic();

    setTimeout(()=>{
      this.showWaveAlert(`LEVEL ${levelId}: ${ldef.name.toUpperCase()}`);
    }, 500);
  }

  // ─── Wave System ────────────────────────────
  startWave(){
    this.waveNum++;
    this.waveActive = true;
    this.spawnedThisWave = 0;
    this.waveEnemiesLeft = this.levelDef.enemiesPerWave + Math.floor(this.waveNum * 1.5);
    this.waveSpawnTimer = 0;
    this.waveSpawnInterval = this.levelDef.spawnInterval;

    SFX.waveAlert();
    this.showWaveAlert(`WAVE ${this.waveNum}!`);
    this.updateHUD();
  }

  spawnEnemy(){
    const types = this.levelDef.enemyTypes;
    let type;
    if(this.waveNum >= this.totalWaves && this.levelDef.isBoss){
      type = (this.spawnedThisWave === 0) ? 'boss' : types[Math.floor(Math.random()*types.length)];
    } else {
      // Weighted random
      const weights = [];
      types.forEach(t=>{
        if(t==='weak') weights.push({t,w:4});
        else if(t==='fast') weights.push({t,w:3});
        else if(t==='tank') weights.push({t,w:2});
        else if(t==='boss') weights.push({t,w:0.3});
      });
      const total = weights.reduce((s,w)=>s+w.w,0);
      let r = Math.random()*total;
      type = 'weak';
      for(const w of weights){ r-=w.w; if(r<=0){type=w.t;break;} }
    }

    const lane = Math.floor(Math.random() * GC.LANES);
    const e = new Enemy(
      type, lane,
      this.levelDef.healthMult,
      this.levelDef.speedMult
    );
    this.enemies.push(e);
    this.spawnedThisWave++;
    this.waveEnemiesLeft--;
  }

  // ─── Main Update Loop ───────────────────────
  update(dt){
    if(this.state !== 'playing') return;

    this.totalTime += dt;
    this.envTimer += dt;

    // Ability cooldowns
    Object.values(this.abilities).forEach(ab=>{
      if(ab.timer < ab.cooldown) ab.timer += dt;
    });

    // Energy regen
    this.energy = Math.min(this.maxEnergy, this.energy + GC.ENERGY_REGEN * dt);

    // Screen shake
    if(this.shakeTimer > 0){
      this.shakeTimer -= dt;
    }

    // Wave management
    if(!this.waveActive){
      if(this.waveNum >= this.totalWaves){
        // All waves done — victory check
        if(this.enemies.filter(e=>e.alive).length === 0){
          this.triggerVictory();
          return;
        }
      } else {
        this.betweenWaveTimer -= dt;
        if(this.betweenWaveTimer <= 0){
          this.startWave();
        }
        // Show countdown HUD
        const waveEl = document.getElementById('hud-wave');
        if(waveEl && this.waveNum < this.totalWaves){
          const cd = Math.ceil(this.betweenWaveTimer);
          waveEl.textContent = `WAVE ${this.waveNum+1}/${this.totalWaves} — ${cd}s`;
        }
      }
    } else {
      // Spawn enemies
      if(this.waveEnemiesLeft > 0){
        this.waveSpawnTimer -= dt;
        if(this.waveSpawnTimer <= 0){
          this.spawnEnemy();
          this.waveSpawnTimer = this.waveSpawnInterval;
        }
      } else if(this.enemies.filter(e=>e.alive||(e.dying&&e.deathTimer>0)).length === 0){
        // Wave clear
        this.waveActive = false;
        this.betweenWaveTimer = this.levelDef.waveInterval;
        this.energy += 50 + this.waveNum * 10;
        SFX.coin();
        this.particles.spawnText(GC.CANVAS_W/2, GC.CANVAS_H/2, `WAVE ${this.waveNum} CLEAR! +${50+this.waveNum*10}⚡`, '#f59e0b');
        this.updateHUD();
      }
    }

    // Update towers
    this.towers.forEach(t=>t.update(dt, this.enemies.filter(e=>e.alive), this.projectiles));

    // Update enemies
    this.enemies.forEach(e=>{
      e.update(dt);
      if(e.alive && e.x < GC.BASE_X + 80){
        // Reached base
        this.baseHealth -= e.damage;
        e.die();
        this.screenShake(0.4, 6);
        SFX.hit();
        if(this.baseHealth <= 0){
          this.baseHealth = 0;
          this.triggerDefeat();
          return;
        }
        this.updateHUD();
      }
    });

    // Remove dead enemies (after death animation)
    this.enemies = this.enemies.filter(e=>e.alive || (e.dying && e.deathTimer > 0));

    // Update projectiles
    this.projectiles.forEach(p=>p.update(dt, this.enemies.filter(e=>e.alive), this.particles));
    this.projectiles = this.projectiles.filter(p=>p.alive);

    // Update particles
    this.particles.update(dt);

    // Count kills from dead enemies
    this.enemies.filter(e=>!e.alive&&!e.dying&&e.reward>0).forEach(e=>{
      this.score += e.reward;
      this.energy = Math.min(this.maxEnergy, this.energy + e.reward*0.5);
      this.kills++;
      e.reward = 0; // prevent double counting
    });

    this.updateHUD();
    this.updateAbilityButtons();
  }

  // ─── Render ────────────────────────────────
  render(){
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    ctx.clearRect(0,0,W,H);

    if(this.state === 'playing' || this.state === 'paused'){
      ctx.save();

      // Screen shake
      if(this.shakeTimer > 0){
        const intensity = this.shakeIntensity * (this.shakeTimer/0.5);
        ctx.translate(
          (Math.random()-0.5)*intensity,
          (Math.random()-0.5)*intensity
        );
      }

      // Scale & center
      ctx.translate(this.offsetX, this.offsetY);
      ctx.scale(this.scale, this.scale);

      // Draw layers
      this.drawBackground(ctx);
      this.drawGrid(ctx);
      this.drawBase(ctx);
      this.towers.forEach(t=>t.draw(ctx, t===this.selectedTower));
      this.enemies.forEach(e=>e.draw(ctx));
      this.projectiles.forEach(p=>p.draw(ctx));
      this.particles.draw(ctx);
      this.drawPlacementPreview(ctx);

      ctx.restore();
    } else if(this.state === 'menu'){
      this.drawMenuBackground(ctx, W, H);
    }
  }

  drawBackground(ctx){
    const t = this.envTimer;

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0,0,0,GC.CANVAS_H);
    skyGrad.addColorStop(0,'#0f0c29');
    skyGrad.addColorStop(0.4,'#302b63');
    skyGrad.addColorStop(1,'#24243e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0,0,GC.CANVAS_W,GC.CANVAS_H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for(let i=0;i<60;i++){
      const sx = (i*137.5)%GC.CANVAS_W;
      const sy = (i*73.1)%(GC.CANVAS_H*0.35);
      const ss = 0.5+Math.sin(t+i)*0.5;
      ctx.globalAlpha = ss;
      ctx.beginPath(); ctx.arc(sx,sy,1,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;

    // Mountains background
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(0,220);
    [0,150,300,450,600,750,900,1050,1200].forEach((x,i)=>{
      const h = 80+Math.sin(i*1.7)*60;
      ctx.lineTo(x, 220-h);
      ctx.lineTo(x+75, 220-h*0.6);
    });
    ctx.lineTo(GC.CANVAS_W,220);
    ctx.closePath();
    ctx.fill();

    // Ground layers
    const groundGrad = ctx.createLinearGradient(0,140,0,GC.CANVAS_H);
    groundGrad.addColorStop(0,'#14532d');
    groundGrad.addColorStop(0.15,'#166534');
    groundGrad.addColorStop(0.3,'#1a5c38');
    groundGrad.addColorStop(1,'#0f3a22');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0,140,GC.CANVAS_W,GC.CANVAS_H-140);

    // Lane paths
    for(let r=0;r<GC.LANES;r++){
      const ly = 145 + r*GC.CELL_H;
      const pathGrad = ctx.createLinearGradient(0,ly,0,ly+GC.CELL_H);
      pathGrad.addColorStop(0,'rgba(100,60,20,0.5)');
      pathGrad.addColorStop(0.5,'rgba(120,75,25,0.4)');
      pathGrad.addColorStop(1,'rgba(100,60,20,0.5)');
      ctx.fillStyle = pathGrad;
      ctx.fillRect(GC.BASE_X+180, ly, GC.CANVAS_W-GC.BASE_X-180, GC.CELL_H);

      // Path texture stripes
      ctx.strokeStyle = 'rgba(80,45,15,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([12,8]);
      ctx.beginPath(); ctx.moveTo(GC.BASE_X+180, ly+GC.CELL_H/2); ctx.lineTo(GC.CANVAS_W, ly+GC.CELL_H/2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Grass edges
      ctx.fillStyle = '#22c55e';
      for(let gx=0;gx<GC.CANVAS_W;gx+=30){
        const gh = 6+Math.sin(gx*0.1+t*0.5)*2;
        ctx.fillRect(gx, ly-gh, 14, gh);
        ctx.fillRect(gx+15, ly+GC.CELL_H, 12, gh);
      }
    }

    // Torch effects
    for(let r=0;r<GC.LANES+1;r++){
      const ty = 145 + r*GC.CELL_H;
      const tx = GC.BASE_X + 170;
      const flicker = 0.7+0.3*Math.sin(t*8+r);
      ctx.fillStyle = `rgba(251,146,60,${flicker})`;
      ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI*2); ctx.fill();
      const fg = ctx.createRadialGradient(tx,ty,0,tx,ty,20);
      fg.addColorStop(0,`rgba(251,146,60,${0.3*flicker})`);
      fg.addColorStop(1,'transparent');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(tx,ty,20,0,Math.PI*2); ctx.fill();
    }

    // Foreground overlay gradient
    const fgGrad = ctx.createLinearGradient(0,GC.CANVAS_H-80,0,GC.CANVAS_H);
    fgGrad.addColorStop(0,'transparent');
    fgGrad.addColorStop(1,'rgba(0,0,0,0.4)');
    ctx.fillStyle = fgGrad;
    ctx.fillRect(0,GC.CANVAS_H-80,GC.CANVAS_W,80);
  }

  drawGrid(ctx){
    for(let r=0;r<GC.GRID_ROWS;r++){
      for(let c=0;c<GC.GRID_COLS;c++){
        const cx = GC.BASE_X+180 + c*GC.CELL_W;
        const cy = 150 + r*GC.CELL_H;
        const key = `${c},${r}`;
        const isHovered = (c===this.hoverCol && r===this.hoverRow);
        const isOccupied = !!this.grid[key];

        if(!isOccupied){
          ctx.fillStyle = isHovered ?
            (this.selectedUnitId ? 'rgba(34,197,94,0.15)' : 'rgba(139,92,246,0.1)') :
            'rgba(255,255,255,0.03)';
          ctx.strokeStyle = isHovered ?
            (this.selectedUnitId ? 'rgba(34,197,94,0.5)' : 'rgba(139,92,246,0.3)') :
            'rgba(255,255,255,0.05)';
          ctx.lineWidth = isHovered ? 2 : 1;
          ctx.beginPath();
          ctx.roundRect(cx+2, cy+2, GC.CELL_W-4, GC.CELL_H-4, 8);
          ctx.fill(); ctx.stroke();

          // Placement indicator
          if(isHovered && this.selectedUnitId){
            ctx.fillStyle = 'rgba(34,197,94,0.8)';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('+', cx+GC.CELL_W/2, cy+GC.CELL_H/2+6);
          }
        }
      }
    }
  }

  drawBase(ctx){
    const bx = GC.BASE_X, by = 140;
    const bh = GC.CANVAS_H - 140 - 20;
    const bw = 120;
    const t = this.envTimer;

    // Base wall
    const wallGrad = ctx.createLinearGradient(bx,0,bx+bw,0);
    wallGrad.addColorStop(0,'#1e1b4b');
    wallGrad.addColorStop(0.4,'#2d2a6e');
    wallGrad.addColorStop(1,'#1e1b4b');
    ctx.fillStyle = wallGrad;
    ctx.beginPath();
    ctx.roundRect(bx,by,bw,bh,0);
    ctx.fill();

    // Stone texture
    ctx.strokeStyle = 'rgba(139,92,246,0.15)';
    ctx.lineWidth = 1;
    for(let gy=by+20;gy<by+bh;gy+=25){
      ctx.beginPath(); ctx.moveTo(bx,gy); ctx.lineTo(bx+bw,gy); ctx.stroke();
    }

    // Battlements
    for(let i=0;i<4;i++){
      ctx.fillStyle = '#312e81';
      ctx.fillRect(bx+i*30, by-20, 22, 24);
    }

    // Glow aura (hurt = red, healthy = purple)
    const hpPct = this.baseHealth/this.maxBaseHealth;
    const auraColor = hpPct > 0.5 ? `rgba(139,92,246,${0.15+0.1*Math.sin(t*2)})` :
                                     `rgba(239,68,68,${0.2+0.15*Math.sin(t*4)})`;
    const auraGrad = ctx.createRadialGradient(bx+bw/2, by+bh/2, 10, bx+bw/2, by+bh/2, bw);
    auraGrad.addColorStop(0, auraColor);
    auraGrad.addColorStop(1,'transparent');
    ctx.fillStyle = auraGrad;
    ctx.fillRect(bx-20, by-20, bw+40, bh+40);

    // Shield icon
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏰', bx+bw/2, by+bh/2-10);

    // Base health bar
    const bhW = bw-16, bhH = 10;
    const bhX = bx+8, bhY = by+20;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.roundRect(bhX,bhY,bhW,bhH,5); ctx.fill();
    const hpColor = hpPct>0.5?'#22c55e':(hpPct>0.25?'#f59e0b':'#ef4444');
    ctx.fillStyle = hpColor;
    ctx.shadowColor = hpColor; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.roundRect(bhX,bhY,bhW*hpPct,bhH,5); ctx.fill();
    ctx.shadowBlur=0;

    // Base HP text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(this.baseHealth)}`, bx+bw/2, bhY-2);
  }

  drawPlacementPreview(ctx){
    if(!this.selectedUnitId) return;
    if(this.hoverCol<0||this.hoverRow<0) return;
    const def = UNIT_DEFS[this.selectedUnitId];
    if(!def) return;
    const key = `${this.hoverCol},${this.hoverRow}`;
    if(this.grid[key]) return;

    const px = GC.BASE_X+180 + this.hoverCol*GC.CELL_W + GC.CELL_W/2;
    const py = 150 + this.hoverRow*GC.CELL_H + GC.CELL_H/2;

    // Range preview
    ctx.beginPath();
    ctx.arc(px, py, def.range*GC.CELL_W, 0, Math.PI*2);
    ctx.fillStyle = `${def.color}15`;
    ctx.fill();
    ctx.strokeStyle = `${def.color}55`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6,4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawMenuBackground(ctx, W, H){
    const t = Date.now()/1000;
    // Animated menu background
    const grad = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H));
    grad.addColorStop(0,'#1a0a4e');
    grad.addColorStop(0.5,'#0f0f2e');
    grad.addColorStop(1,'#0a0a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);

    // Floating orbs
    for(let i=0;i<8;i++){
      const ox = W*0.1 + (Math.sin(t*0.3+i*2.1)*0.4+0.5)*(W*0.8);
      const oy = H*0.1 + (Math.cos(t*0.25+i*1.7)*0.4+0.5)*(H*0.8);
      const r = 30+i*15;
      const g2 = ctx.createRadialGradient(ox,oy,0,ox,oy,r);
      const colors = ['#7c3aed','#a855f7','#06b6d4','#f59e0b','#22c55e'];
      const c = colors[i%colors.length];
      g2.addColorStop(0,`${c}33`);
      g2.addColorStop(1,'transparent');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(ox,oy,r,0,Math.PI*2); ctx.fill();
    }
  }

  // ─── HUD Management ─────────────────────────
  updateHUD(){
    const energyEl = document.getElementById('hud-energy');
    const scoreEl = document.getElementById('hud-score');
    const waveEl = document.getElementById('hud-wave');
    const bHealthEl = document.getElementById('base-health-fill');
    const waveProg = document.getElementById('wave-progress-fill');

    if(energyEl) energyEl.textContent = Math.floor(this.energy);
    if(scoreEl) scoreEl.textContent = this.score;
    if(waveEl) waveEl.textContent = `WAVE ${this.waveNum}/${this.totalWaves}`;

    const hpPct = (this.baseHealth/this.maxBaseHealth)*100;
    if(bHealthEl){
      bHealthEl.style.width = `${hpPct}%`;
      bHealthEl.className = 'base-health-fill' + (hpPct<30?' low':(hpPct<60?' mid':''));
    }

    const wpPct = this.totalWaves>0 ? (this.waveNum/this.totalWaves)*100 : 0;
    if(waveProg) waveProg.style.width = `${wpPct}%`;

    // Update unit card affordability
    document.querySelectorAll('.unit-card').forEach(card=>{
      const id = card.dataset.unitId;
      if(!id) return;
      const def = UNIT_DEFS[id];
      if(!def || !def.unlocked) return;
      if(this.energy >= def.cost){
        card.classList.remove('too-expensive');
      } else {
        card.classList.add('too-expensive');
      }
    });
  }

  updateAbilityButtons(){
    Object.entries(this.abilities).forEach(([key, ab])=>{
      const btn = document.getElementById(`ability-${key}`);
      if(!btn) return;
      const ready = ab.timer >= ab.cooldown;
      btn.classList.toggle('cooldown', !ready);
      const ring = btn.querySelector('.cooldown-ring');
      if(ring){
        const pct = (ab.timer/ab.cooldown)*360;
        ring.style.setProperty('--cd-pct', `${pct}deg`);
        ring.style.background = ready ? 'transparent' :
          `conic-gradient(rgba(0,0,0,0.7) ${pct}deg, transparent 0%)`;
      }
    });
  }

  buildUnitPanel(){
    const row = document.getElementById('units-row');
    if(!row) return;
    row.innerHTML = '';
    Object.values(UNIT_DEFS).forEach(def=>{
      const card = document.createElement('div');
      card.className = 'unit-card' + (def.unlocked?'':' too-expensive');
      card.dataset.unitId = def.id;

      // Mini canvas preview
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = 48; previewCanvas.height = 48;
      previewCanvas.className = 'unit-canvas-preview';
      this.drawUnitPreview(previewCanvas, def);

      card.innerHTML = `
        <div class="unit-card-cost"><span>⚡</span>${def.cost}</div>
        <div class="unit-card-name">${def.name}</div>
      `;
      card.insertBefore(previewCanvas, card.firstChild);

      if(!def.unlocked){
        const overlay = document.createElement('div');
        overlay.className = 'unit-locked-overlay';
        overlay.innerHTML = '🔒';
        card.appendChild(overlay);
      } else {
        card.addEventListener('click', ()=>{
          this.selectUnit(def.id);
        });
        card.addEventListener('touchend', e=>{
          e.stopPropagation();
          this.selectUnit(def.id);
        });
      }

      row.appendChild(card);
    });
  }

  drawUnitPreview(canvas, def){
    const ctx = canvas.getContext('2d');
    const tmpTower = { def, floatTimer:0, floatOffset:0, animFrame:0, shootTimer:0, upgLvl:{damage:0,speed:0,range:0} };
    ctx.clearRect(0,0,48,48);
    ctx.save();
    ctx.translate(24,34);
    ctx.scale(0.75, 0.75);
    Tower.prototype.drawUnit.call(tmpTower, ctx, def.id, false);
    ctx.restore();
  }

  selectUnit(unitId){
    const def = UNIT_DEFS[unitId];
    if(!def || !def.unlocked) return;
    if(this.selectedUnitId === unitId){
      this.selectedUnitId = null;
    } else {
      this.selectedUnitId = unitId;
      this.selectedTower = null;
      this.hideUpgradePanel();
    }
    document.querySelectorAll('.unit-card').forEach(c=>{
      c.classList.toggle('selected', c.dataset.unitId === this.selectedUnitId);
    });
  }

  flashEnergyWarning(){
    const el = document.getElementById('hud-energy-container');
    if(!el) return;
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'energyFlash 0.4s ease 2';
  }

  // ─── Upgrade Panel ──────────────────────────
  showUpgradePanel(tower, cx, cy){
    const panel = document.getElementById('upgrade-panel');
    if(!panel) return;

    panel.innerHTML = `
      <button class="close-upgrade" id="close-upgrade-btn">✕</button>
      <div class="upgrade-title">${tower.def.icon} ${tower.def.name}</div>
      <div class="upgrade-stats">
        <div class="upgrade-stat"><span>⚔️ Damage</span><span class="val">${Math.round(tower.getDamage())} (+${tower.upgLvl.damage})</span></div>
        <div class="upgrade-stat"><span>⚡ Fire Rate</span><span class="val">${tower.getFireRate().toFixed(1)}/s (+${tower.upgLvl.speed})</span></div>
        <div class="upgrade-stat"><span>🎯 Range</span><span class="val">${Math.round(tower.getRange()/GC.CELL_W*10)/10} (+${tower.upgLvl.range})</span></div>
        <div class="upgrade-stat"><span>💰 Invested</span><span class="val">${tower.totalCost}</span></div>
      </div>
      <div class="upgrade-buttons">
        <button class="upg-btn upg-damage" id="upg-damage-btn" ${tower.upgLvl.damage>=5?'disabled':''}>
          ⚔️ DMG +30% <span>⚡${tower.getUpgradeCost('damage')}</span>
        </button>
        <button class="upg-btn upg-speed" id="upg-speed-btn" ${tower.upgLvl.speed>=5?'disabled':''}>
          ⚡ SPD +30% <span>⚡${tower.getUpgradeCost('speed')}</span>
        </button>
        <button class="upg-btn upg-range" id="upg-range-btn" ${tower.upgLvl.range>=5?'disabled':''}>
          🎯 RNG +20% <span>⚡${tower.getUpgradeCost('range')}</span>
        </button>
        <button class="upg-btn sell-btn" id="sell-tower-btn">
          💰 Sell <span>⚡${Math.floor(tower.totalCost*0.6)}</span>
        </button>
      </div>
    `;

    // Position
    const W = window.innerWidth, H = window.innerHeight;
    let px = cx + 10, py = cy - 20;
    if(px + 230 > W) px = cx - 240;
    if(py + 320 > H) py = H - 330;
    if(py < 10) py = 10;
    panel.style.left = `${px}px`;
    panel.style.top = `${py}px`;
    panel.classList.add('show');

    document.getElementById('close-upgrade-btn').onclick = ()=>this.hideUpgradePanel();

    const upgBtns = ['damage','speed','range'];
    upgBtns.forEach(type=>{
      const btn = document.getElementById(`upg-${type}-btn`);
      if(btn) btn.onclick = ()=>{
        const cost = tower.getUpgradeCost(type);
        if(this.energy >= cost){
          this.energy -= cost;
          tower.upgrade(type);
          tower.totalCost += cost;
          SFX.ability();
          this.particles.spawn(tower.x, tower.y, 'sparkle', tower.def.color, 8);
          this.showUpgradePanel(tower, cx, cy);
          this.updateHUD();
        } else {
          this.flashEnergyWarning();
        }
      };
    });

    document.getElementById('sell-tower-btn').onclick = ()=>this.sellTower(tower);
  }

  hideUpgradePanel(){
    const panel = document.getElementById('upgrade-panel');
    if(panel) panel.classList.remove('show');
  }

  // ─── Abilities ──────────────────────────────
  useAbility(abilityKey){
    const ab = this.abilities[abilityKey];
    if(!ab || ab.timer < ab.cooldown) return;
    ab.timer = 0;
    SFX.ability();

    if(abilityKey === 'bomb'){
      // Damage all enemies on screen
      const dmg = 80 + this.kills * 0.5;
      this.enemies.filter(e=>e.alive).forEach(e=>{
        e.takeDamage(dmg*0.5+Math.random()*dmg, this.particles);
        this.particles.spawn(e.x, e.y, 'explosion', '#f97316', 12);
      });
      this.screenShake(0.6, 10);
      SFX.explosion();
      this.showFlashEffect('#f97316', 0.4);
    } else if(abilityKey === 'freeze'){
      // Freeze all enemies
      this.enemies.filter(e=>e.alive).forEach(e=>{
        e.freeze(5);
        this.particles.spawn(e.x, e.y, 'sparkle', '#bae6fd', 8);
      });
      this.showFlashEffect('#bae6fd', 0.25);
    } else if(abilityKey === 'fire'){
      // Fire sweep — heavy damage
      this.enemies.filter(e=>e.alive).forEach(e=>{
        e.takeDamage(120 + Math.random()*80, this.particles);
        this.particles.spawn(e.x, e.y, 'explosion', '#ef4444', 15);
      });
      this.screenShake(0.4, 8);
      SFX.explosion();
      this.showFlashEffect('#ef4444', 0.35);
    }

    this.updateAbilityButtons();
  }

  showFlashEffect(color, alpha){
    const canvas = this.canvas;
    const ctx = this.ctx;
    let a = alpha;
    const fade = ()=>{
      if(a <= 0) return;
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = a;
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.restore();
      a -= 0.04;
      requestAnimationFrame(fade);
    };
    fade();
  }

  screenShake(duration, intensity){
    this.shakeTimer = duration;
    this.shakeIntensity = intensity;
  }

  // ─── Wave Alert ─────────────────────────────
  showWaveAlert(text){
    const el = document.getElementById('wave-alert');
    const numEl = document.getElementById('wave-alert-num');
    if(!el || !numEl) return;
    numEl.textContent = text;
    el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 2500);
  }

  // ─── Victory / Defeat ───────────────────────
  triggerVictory(){
    if(this.state === 'victory' || this.state === 'gameover') return;
    this.state = 'victory';
    SFX.victory();
    SFX.stopMusic();

    // Unlock next level
    const nextLevel = this.currentLevel + 1;
    if(nextLevel <= 30 && !this.unlockedLevels.includes(nextLevel)){
      this.unlockedLevels.push(nextLevel);
    }

    // Stars based on base health
    const hpPct = this.baseHealth/this.maxBaseHealth;
    const stars = hpPct > 0.7 ? 3 : hpPct > 0.4 ? 2 : 1;
    const existing = this.levelStars[this.currentLevel] || 0;
    this.levelStars[this.currentLevel] = Math.max(existing, stars);

    // Unlock unit if applicable
    const ldef = this.levelDef;
    if(ldef.unlockUnit && !this.unlockedUnits.has(ldef.unlockUnit)){
      this.unlockedUnits.add(ldef.unlockUnit);
      UNIT_DEFS[ldef.unlockUnit].unlocked = true;
    }

    this.saveGame();

    const starsStr = '⭐'.repeat(stars) + '☆'.repeat(3-stars);
    const screen = document.getElementById('victory-screen');
    if(screen){
      screen.querySelector('.result-stars').textContent = starsStr;
      screen.querySelector('#vs-score').textContent = this.score;
      screen.querySelector('#vs-kills').textContent = this.kills;
      screen.querySelector('#vs-time').textContent = `${Math.floor(this.totalTime/60)}:${String(Math.floor(this.totalTime%60)).padStart(2,'0')}`;
      screen.querySelector('#vs-waves').textContent = `${this.waveNum}/${this.totalWaves}`;
      if(ldef.unlockUnit && this.unlockedUnits.has(ldef.unlockUnit)){
        screen.querySelector('#vs-unlock').textContent = `🎉 Unlocked: ${UNIT_DEFS[ldef.unlockUnit].name}!`;
      } else {
        screen.querySelector('#vs-unlock').textContent = '';
      }
      screen.classList.add('show');
    }

    // Particle burst
    for(let i=0;i<5;i++){
      setTimeout(()=>{
        for(let j=0;j<3;j++){
          this.particles.spawn(
            200+Math.random()*(GC.CANVAS_W-400),
            200+Math.random()*(GC.CANVAS_H-300),
            'explosion', ['#f59e0b','#a855f7','#22c55e','#06b6d4'][Math.floor(Math.random()*4)], 12
          );
        }
      }, i*400);
    }
  }

  triggerDefeat(){
    if(this.state === 'gameover' || this.state === 'victory') return;
    this.state = 'gameover';
    SFX.defeat();
    SFX.stopMusic();
    this.screenShake(0.8, 15);

    const screen = document.getElementById('defeat-screen');
    if(screen){
      screen.querySelector('#ds-score').textContent = this.score;
      screen.querySelector('#ds-kills').textContent = this.kills;
      screen.querySelector('#ds-time').textContent = `${Math.floor(this.totalTime/60)}:${String(Math.floor(this.totalTime%60)).padStart(2,'0')}`;
      screen.querySelector('#ds-waves').textContent = `${this.waveNum}/${this.totalWaves}`;
      screen.classList.add('show');
    }
  }

  // ─── Pause ──────────────────────────────────
  togglePause(){
    if(this.state==='playing'){
      this.state='paused';
      document.getElementById('pause-screen').classList.add('show');
      SFX.stopMusic();
    } else if(this.state==='paused'){
      this.state='playing';
      document.getElementById('pause-screen').classList.remove('show');
      SFX.startMusic();
    }
  }

  returnToMenu(){
    this.state = 'menu';
    this.towers = []; this.enemies = []; this.projectiles = [];
    document.getElementById('game-canvas-container').classList.remove('active');
    document.getElementById('game-hud').style.display = 'none';
    document.getElementById('unit-panel').classList.add('hidden');
    document.getElementById('pause-screen').classList.remove('show');
    document.getElementById('victory-screen')?.classList.remove('show');
    document.getElementById('defeat-screen')?.classList.remove('show');
    this.hideUpgradePanel();
    document.getElementById('main-menu').classList.remove('hidden');
    SFX.stopMusic();
    SFX.startMusic();
  }

  // ─── Render Loop ────────────────────────────
  startRenderLoop(){
    const loop = (timestamp)=>{
      if(!this.lastTime) this.lastTime = timestamp;
      const dt = Math.min((timestamp - this.lastTime)/1000, 0.05);
      this.lastTime = timestamp;

      // FPS counter
      this.fpsCount++;
      this.fpsTimer += dt;
      if(this.fpsTimer >= 1){ this.fps=this.fpsCount; this.fpsCount=0; this.fpsTimer=0; }

      this.update(dt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// ─────────────────────────────────────────────
//  UI MANAGER
// ─────────────────────────────────────────────
function buildUI(){
  // Stars background
  const starsDiv = document.createElement('div');
  starsDiv.className = 'stars-bg';
  for(let i=0;i<80;i++){
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = `${Math.random()*100}%`;
    star.style.top = `${Math.random()*100}%`;
    star.style.setProperty('--dur', `${2+Math.random()*4}s`);
    star.style.setProperty('--delay', `${Math.random()*3}s`);
    starsDiv.appendChild(star);
  }
  document.body.insertBefore(starsDiv, document.body.firstChild);
}

// ─────────────────────────────────────────────
//  LEVEL SELECT BUILDER
// ─────────────────────────────────────────────
function buildLevelSelect(game){
  const grid = document.getElementById('levels-grid');
  if(!grid) return;
  grid.innerHTML = '';
  LEVELS.forEach(ldef=>{
    const unlocked = game.unlockedLevels.includes(ldef.id);
    const stars = game.levelStars[ldef.id] || 0;
    const card = document.createElement('div');
    card.className = `level-card${ldef.isBoss?' boss-level':''}${!unlocked?' locked':''}`;
    const starsStr = '⭐'.repeat(stars)+'☆'.repeat(3-stars);
    card.innerHTML = `
      ${ldef.isBoss?'<div class="level-badge badge-boss">BOSS</div>':''}
      ${stars===0&&unlocked?'<div class="level-badge badge-new">NEW</div>':''}
      <div class="level-num">${ldef.id}</div>
      <div class="level-name">${ldef.name}</div>
      <div class="level-stars">${starsStr}</div>
    `;
    if(unlocked){
      card.addEventListener('click', ()=>{
        document.getElementById('level-select').classList.add('hidden');
        game.startLevel(ldef.id);
      });
    }
    grid.appendChild(card);
  });
}

// ─────────────────────────────────────────────
//  LOGO CANVAS DRAW
// ─────────────────────────────────────────────
// Icon is now an SVG — no canvas needed

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  buildUI();

  // Loading screen simulation
  const loadBar = document.querySelector('.loading-bar-fill');
  const loadText = document.querySelector('.loading-text');
  const loadMessages = ['Forging weapons...','Training units...','Summoning monsters...','Building defenses...','Ready to clash!'];
  let loadProgress = 0;
  const loadInterval = setInterval(()=>{
    loadProgress += Math.random()*20+8;
    if(loadProgress > 100) loadProgress = 100;
    if(loadBar) loadBar.style.width = `${loadProgress}%`;
    const msgIdx = Math.floor((loadProgress/100)*loadMessages.length);
    if(loadText) loadText.textContent = loadMessages[Math.min(msgIdx, loadMessages.length-1)];
    if(loadProgress >= 100){
      clearInterval(loadInterval);
      setTimeout(()=>{
        const ls = document.getElementById('loading-screen');
        if(ls){ ls.classList.add('fade-out'); setTimeout(()=>ls.remove(),600); }
      }, 500);
    }
  }, 150);

  // Create game
  const game = new Game();
  window.game = game; // debug

  // SVG icon is already animated via CSS (iconFloat keyframe)

  // Menu stats
  const totalStars = Object.values(game.levelStars).reduce((s,v)=>s+v,0);
  const elUnlocked = document.getElementById('stat-levels');
  const elStars = document.getElementById('stat-stars');
  if(elUnlocked) elUnlocked.textContent = game.unlockedLevels.length;
  if(elStars) elStars.textContent = totalStars;

  // ── Button Handlers ──────────────────────────
  // Menu → Tutorial
  document.getElementById('btn-play').addEventListener('click', ()=>{
    SFX.resume();
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('tutorial-screen').classList.remove('hidden');
  });

  // Skip tutorial
  document.getElementById('btn-skip-tutorial').addEventListener('click', ()=>{
    document.getElementById('tutorial-screen').classList.add('hidden');
    document.getElementById('level-select').classList.remove('hidden');
    buildLevelSelect(game);
  });

  // Tutorial start
  document.getElementById('btn-start-game').addEventListener('click', ()=>{
    document.getElementById('tutorial-screen').classList.add('hidden');
    document.getElementById('level-select').classList.remove('hidden');
    buildLevelSelect(game);
  });

  // Level select back
  document.getElementById('btn-back-levels').addEventListener('click', ()=>{
    document.getElementById('level-select').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
  });

  // Pause button
  document.getElementById('btn-pause').addEventListener('click', ()=>game.togglePause());

  // Sound toggle
  const soundBtn = document.getElementById('btn-sound');
  soundBtn.addEventListener('click', ()=>{
    const enabled = SFX.toggle();
    soundBtn.textContent = enabled ? '🔊' : '🔇';
  });

  // Ability buttons
  document.getElementById('ability-bomb').addEventListener('click', ()=>{ SFX.resume(); game.useAbility('bomb'); });
  document.getElementById('ability-freeze').addEventListener('click', ()=>{ SFX.resume(); game.useAbility('freeze'); });
  document.getElementById('ability-fire').addEventListener('click', ()=>{ SFX.resume(); game.useAbility('fire'); });

  // Pause screen buttons
  document.getElementById('btn-resume').addEventListener('click', ()=>game.togglePause());
  document.getElementById('btn-restart').addEventListener('click', ()=>{
    game.togglePause();
    game.startLevel(game.currentLevel);
  });
  document.getElementById('btn-quit').addEventListener('click', ()=>{
    game.togglePause();
    game.returnToMenu();
  });

  // Victory screen
  document.getElementById('btn-victory-next').addEventListener('click', ()=>{
    document.getElementById('victory-screen').classList.remove('show');
    const next = game.currentLevel + 1;
    if(next <= 30 && game.unlockedLevels.includes(next)){
      game.startLevel(next);
    } else {
      game.returnToMenu();
    }
  });
  document.getElementById('btn-victory-retry').addEventListener('click', ()=>{
    document.getElementById('victory-screen').classList.remove('show');
    game.startLevel(game.currentLevel);
  });
  document.getElementById('btn-victory-menu').addEventListener('click', ()=>{
    document.getElementById('victory-screen').classList.remove('show');
    game.returnToMenu();
  });

  // Defeat screen
  document.getElementById('btn-defeat-retry').addEventListener('click', ()=>{
    document.getElementById('defeat-screen').classList.remove('show');
    game.startLevel(game.currentLevel);
  });
  document.getElementById('btn-defeat-menu').addEventListener('click', ()=>{
    document.getElementById('defeat-screen').classList.remove('show');
    game.returnToMenu();
  });

  // Keyboard ESC note visible in menu
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape' && game.state==='playing') game.togglePause();
  });

  // Start bg music on any interaction
  document.addEventListener('click', ()=>{ SFX.resume(); }, { once:true });
  document.addEventListener('touchstart', ()=>{ SFX.resume(); }, { once:true });
});
