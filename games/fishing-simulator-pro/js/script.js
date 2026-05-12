'use strict';
/* ════════════════════════════════════════════════════════════
   FISHING SIMULATOR PRO — Complete Game Engine v2.0
   Matches new index.html structure fully
   ════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────
// 1. FISH DATABASE (15 Species)
// ─────────────────────────────────────────────────────────────
const FISH_DB = [
  // COMMON
  { id:'bass',      name:'Largemouth Bass',  emoji:'🐟', rarity:'common',    minW:0.5,  maxW:2.5,  xp:20,  coins:30,  difficulty:1.0, behavior:'steady',   locs:['lake','river'] },
  { id:'catfish',   name:'Channel Catfish',  emoji:'🐠', rarity:'common',    minW:1.0,  maxW:4.5,  xp:25,  coins:40,  difficulty:1.1, behavior:'sluggish', locs:['lake','river'] },
  { id:'trout',     name:'Rainbow Trout',    emoji:'🐡', rarity:'common',    minW:0.3,  maxW:2.0,  xp:20,  coins:35,  difficulty:1.2, behavior:'erratic',  locs:['river'] },
  { id:'perch',     name:'Yellow Perch',     emoji:'🐟', rarity:'common',    minW:0.2,  maxW:1.2,  xp:15,  coins:25,  difficulty:0.9, behavior:'steady',   locs:['lake'] },
  { id:'carp',      name:'Common Carp',      emoji:'🐠', rarity:'common',    minW:2.0,  maxW:8.0,  xp:30,  coins:50,  difficulty:1.3, behavior:'sluggish', locs:['lake','river'] },
  // RARE
  { id:'salmon',    name:'Atlantic Salmon',  emoji:'🐟', rarity:'rare',      minW:2.0,  maxW:12.0, xp:60,  coins:120, difficulty:1.8, behavior:'runner',   locs:['river','ocean'] },
  { id:'snapper',   name:'Red Snapper',      emoji:'🐡', rarity:'rare',      minW:1.5,  maxW:6.0,  xp:55,  coins:110, difficulty:1.7, behavior:'erratic',  locs:['ocean'] },
  { id:'grouper',   name:'Giant Grouper',    emoji:'🐠', rarity:'rare',      minW:5.0,  maxW:20.0, xp:70,  coins:140, difficulty:2.0, behavior:'sluggish', locs:['ocean'] },
  { id:'walleye',   name:'Walleye',          emoji:'🐟', rarity:'rare',      minW:1.0,  maxW:5.0,  xp:50,  coins:100, difficulty:1.6, behavior:'erratic',  locs:['lake','river'] },
  // EPIC
  { id:'tuna',      name:'Bluefin Tuna',     emoji:'🐟', rarity:'epic',      minW:50.0, maxW:200.0,xp:150, coins:350, difficulty:2.8, behavior:'runner',   locs:['ocean'] },
  { id:'mahi',      name:'Mahi-Mahi',        emoji:'🐡', rarity:'epic',      minW:5.0,  maxW:25.0, xp:120, coins:280, difficulty:2.5, behavior:'erratic',  locs:['ocean'] },
  { id:'pike',      name:'Northern Pike',    emoji:'🐠', rarity:'epic',      minW:3.0,  maxW:15.0, xp:110, coins:250, difficulty:2.3, behavior:'runner',   locs:['lake','river'] },
  // LEGENDARY
  { id:'marlin',    name:'Blue Marlin',      emoji:'🏅', rarity:'legendary', minW:100.0,maxW:450.0,xp:400, coins:1000,difficulty:3.8, behavior:'runner',   locs:['ocean'] },
  { id:'swordfish', name:'Swordfish',        emoji:'⚔️', rarity:'legendary', minW:80.0, maxW:300.0,xp:350, coins:850, difficulty:3.5, behavior:'erratic',  locs:['ocean'] },
  { id:'koi',       name:'Golden Dragon Koi',emoji:'🐉', rarity:'legendary', minW:5.0,  maxW:20.0, xp:500, coins:1200,difficulty:4.0, behavior:'erratic',  locs:['lake'] },
];

// ─────────────────────────────────────────────────────────────
// 2. LEVEL SYSTEM (scales to 40 levels)
// ─────────────────────────────────────────────────────────────
function getLvlCfg(lvl) {
  return {
    xpReq:       Math.floor(100 * Math.pow(lvl, 1.45)),
    rarities:    lvl >= 16 ? ['common','rare','epic','legendary']
               : lvl >= 10 ? ['common','rare','epic']
               : lvl >= 5  ? ['common','rare']
               :              ['common'],
    diffMul:     1.0 + (lvl - 1) * 0.07,
    biteWindow:  Math.max(550, 1200 - lvl * 22),
    waitMin:     Math.max(2500, 4500 - lvl * 55),
    waitMax:     Math.max(5000, 11000 - lvl * 90),
  };
}

// ─────────────────────────────────────────────────────────────
// 3. SAVE DATA
// ─────────────────────────────────────────────────────────────
const SAVE_KEY = 'fsp_v3';
let save = null;

function defaultSave() {
  return {
    level: 1, xp: 0, coins: 200, totalCaught: 0,
    records: {}, catalog: {},
    upgrades: { rod:0, reel:0, line:0, bait:0 },
    lastDaily: 0, location: 'lake',
    soundOn: true,
  };
}
function loadSave() {
  try { save = Object.assign(defaultSave(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
  catch(e) { save = defaultSave(); }
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch(e) {}
}

// ─────────────────────────────────────────────────────────────
// 4. AUDIO (Web Audio API — fully synthetic)
// ─────────────────────────────────────────────────────────────
const Snd = (() => {
  let ctx = null;
  let masterGain = null;
  let enabled = true;
  let waterSrc = null;

  function boot() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = enabled ? 1 : 0;
      masterGain.connect(ctx.destination);
      spawnWater();
    } catch(e) { enabled = false; }
  }

  function wake() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{}); }

  function spawnWater() {
    if (!ctx || !enabled) return;
    const makeLayer = (f, g, q) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
      const src = ctx.createBufferSource(); src.buffer=buf; src.loop=true;
      const filt = ctx.createBiquadFilter(); filt.type='bandpass'; filt.frequency.value=f; filt.Q.value=q;
      const gain = ctx.createGain(); gain.gain.value=g;
      src.connect(filt); filt.connect(gain); gain.connect(masterGain);
      src.start(); return src;
    };
    makeLayer(380, 0.07, 0.5);
    makeLayer(170, 0.05, 0.8);
  }

  function tone(f, type, dur, vol, delay=0) {
    if (!ctx||!enabled) return;
    wake();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(vol, t+0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t+dur+0.05);
  }

  function noise(dur, f, q, vol, delay=0) {
    if (!ctx||!enabled) return;
    wake();
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate*dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const s = ctx.createBufferSource(); s.buffer=buf;
    const filt = ctx.createBiquadFilter(); filt.type='bandpass'; filt.frequency.value=f; filt.Q.value=q;
    const g = ctx.createGain(); g.gain.value=vol;
    s.connect(filt); filt.connect(g); g.connect(masterGain);
    s.start(ctx.currentTime + delay);
  }

  return {
    boot, wake,
    cast()     { tone(300,'sine',0.35,0.3); noise(0.3,900,1.2,0.12); },
    splash()   { noise(0.45,650,0.8,0.25); tone(190,'sine',0.28,0.18,0.04); },
    bite()     { tone(880,'sine',0.12,0.5); tone(1320,'sine',0.12,0.38,0.1); tone(1760,'sine',0.25,0.3,0.2); },
    reel()     { tone(950,'square',0.07,0.04); tone(750,'square',0.07,0.04,0.07); },
    catch()    { [523,659,784,1047].forEach((n,i)=>tone(n,'sine',0.35,0.4,i*0.12)); },
    fail()     { tone(440,'sawtooth',0.15,0.3); tone(330,'sawtooth',0.28,0.22,0.15); tone(220,'sawtooth',0.38,0.18,0.3); },
    snap()     { noise(0.35,1300,3,0.35); tone(140,'sine',0.35,0.28,0.08); },
    coin()     { tone(1047,'sine',0.1,0.3); tone(1319,'sine',0.1,0.22,0.07); },
    levelUp()  { [523,659,784,880,1047].forEach((f,i)=>tone(f,'sine',0.38,0.35,i*0.1)); },
    setOn(v)   { enabled = v; if (masterGain) masterGain.gain.value = v ? 1 : 0; },
    get on()   { return enabled; },
  };
})();

// ─────────────────────────────────────────────────────────────
// 5. CANVAS RENDERER
// ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const C = canvas.getContext('2d');
const bgImg = {}; // id → HTMLImageElement
const bgOk  = {}; // id → bool

['lake','river','ocean'].forEach(id => {
  const img = new Image();
  img.onload  = () => { bgOk[id] = true; };
  img.onerror = () => { bgOk[id] = false; };
  img.src = `assets/images/${id}-bg.png`;
  bgImg[id] = img;
});

function sizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
sizeCanvas();
window.addEventListener('resize', sizeCanvas);

// Particles
let ripples = [];
let splashes = [];
let sparkles = [];

function addRipple(x, y, r=35) {
  ripples.push({ x, y, r, maxR: r*2.8, alpha: 0.9, born: Date.now(), dur: 1300 });
}
function addSplash(x, y, n=14) {
  for (let i=0;i<n;i++) {
    const a = -Math.PI + Math.random()*Math.PI;
    const sp = 1.5 + Math.random()*3.5;
    splashes.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp-3.2, r: 2+Math.random()*4,
                    born: Date.now(), dur: 650+Math.random()*450 });
  }
}
function addSparkle(x, y, col, n=10) {
  for (let i=0;i<n;i++) {
    const a = Math.random()*Math.PI*2;
    const sp = 1+Math.random()*4;
    sparkles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp-2,
                    r: 3+Math.random()*5, col, born: Date.now(), dur: 800+Math.random()*500 });
  }
}

let lineState = { active:false, sx:0, sy:0, bx:0, by:0, bobVis:false, dip:false };
let fishShadow = null;
let animT = 0;
let lastT = 0;

function render(ts) {
  requestAnimationFrame(render);
  const dt = Math.min((ts - lastT) / 1000, 0.055);
  lastT = ts;
  animT += dt;
  const now = Date.now();
  const W = canvas.width, H = canvas.height;
  C.clearRect(0, 0, W, H);

  // Background
  const inPlay = ['idle','casting','waiting','bite','battle'].includes(gs);
  if (inPlay || gs === 'result' || gs === 'tutorial' || gs === 'location') {
    drawBg(currentLoc);
    drawWater(animT, W, H);
    drawRipples(now);
    drawSplash(now);
    drawSparkles(now);
    if (fishShadow) drawFishShadow(fishShadow, animT);
    drawLine(lineState, animT);
    // Animated ambient bubbles in water
    drawBubbles(animT, W, H);
  }

  // Cast power oscillation
  if (gs === 'casting' && castHold) {
    castPow += castDir * 2.4;
    if (castPow >= 100) { castPow = 100; castDir = -1; }
    if (castPow <= 0)   { castPow = 0;   castDir = 1; }
    const el = document.getElementById('power-meter-fill');
    if (el) el.style.height = castPow + '%';
    if (Math.random() < 0.06) addRipple(W*0.5+(Math.random()-0.5)*60, H*0.56, 12);
  }
  if (gs === 'waiting' && Math.random() < 0.007) {
    addRipple(lineState.bx+(Math.random()-0.5)*25, lineState.by+(Math.random()-0.5)*10, 14);
  }
}

function drawBg(loc) {
  const W=canvas.width, H=canvas.height;
  if (bgOk[loc] && bgImg[loc]) {
    C.drawImage(bgImg[loc], 0, 0, W, H);
  } else {
    const g = C.createLinearGradient(0,0,0,H);
    if (loc==='ocean')      { g.addColorStop(0,'#0d1b2a'); g.addColorStop(0.6,'#1a4f7a'); g.addColorStop(1,'#0a3a6e'); }
    else if (loc==='river') { g.addColorStop(0,'#0a2b1e'); g.addColorStop(0.6,'#1a5437'); g.addColorStop(1,'#0d3825'); }
    else                    { g.addColorStop(0,'#0b1e3b'); g.addColorStop(0.6,'#1a4a72'); g.addColorStop(1,'#0d2e52'); }
    C.fillStyle = g; C.fillRect(0,0,W,H);
  }
}

function drawWater(t, W, H) {
  const wY = H * 0.55;
  const g = C.createLinearGradient(0, wY, 0, H);
  g.addColorStop(0,   'rgba(26,127,193,0.48)');
  g.addColorStop(0.25,'rgba(8,61,107,0.62)');
  g.addColorStop(1,   'rgba(2,11,24,0.88)');
  C.save();
  C.beginPath();
  C.moveTo(0, wY);
  for (let x=0; x<=W; x+=5) {
    const w = Math.sin((x*0.014)+t*1.3)*5.5
            + Math.sin((x*0.027)+t*0.9)*3.5
            + Math.sin((x*0.007)+t*0.5)*8;
    C.lineTo(x, wY+w);
  }
  C.lineTo(W,H); C.lineTo(0,H);
  C.fillStyle = g; C.fill();

  // shimmer lines
  C.globalAlpha = 0.12;
  for (let i=0;i<5;i++) {
    const sy = wY + 18 + i*16 + Math.sin(t*0.6+i*1.2)*5;
    const sg = C.createLinearGradient(0,sy,W,sy);
    sg.addColorStop(0,'transparent');
    sg.addColorStop(0.2+Math.sin(t+i)*0.1,'rgba(38,198,247,0.7)');
    sg.addColorStop(0.5+Math.sin(t+i)*0.1,'rgba(38,198,247,0.4)');
    sg.addColorStop(1,'transparent');
    C.fillStyle = sg; C.fillRect(0,sy,W,1.5);
  }
  C.globalAlpha = 1; C.restore();
}

function drawBubbles(t, W, H) {
  C.save();
  for (let i=0;i<6;i++) {
    const bx = (Math.sin(t*0.3+i*1.2)*0.4+0.5)*W;
    const by = H*0.6 + Math.sin(t*0.7+i*2.1)*H*0.15;
    const br = 2 + Math.sin(t*1.1+i)*1.5;
    const alpha = 0.08 + Math.sin(t*0.9+i)*0.04;
    C.beginPath();
    C.arc(bx,by,br,0,Math.PI*2);
    C.strokeStyle = `rgba(160,216,239,${alpha})`;
    C.lineWidth = 1;
    C.stroke();
  }
  C.restore();
}

function drawRipples(now) {
  ripples = ripples.filter(r => now-r.born < r.dur);
  ripples.forEach(r => {
    const p = (now-r.born)/r.dur;
    const rad = r.r + p*(r.maxR-r.r);
    const alpha = r.alpha*(1-p);
    C.beginPath();
    C.strokeStyle = `rgba(38,198,247,${alpha})`;
    C.lineWidth = 1.4;
    C.ellipse(r.x, r.y, rad, rad*0.32, 0, 0, Math.PI*2);
    C.stroke();
  });
}

function drawSplash(now) {
  splashes = splashes.filter(p => now-p.born < p.dur);
  splashes.forEach(p => {
    const pr = (now-p.born)/p.dur;
    p.x += p.vx*0.82; p.y += p.vy*0.82; p.vy += 0.2;
    C.beginPath();
    C.fillStyle = `rgba(160,216,239,${0.75*(1-pr)})`;
    C.arc(p.x, p.y, p.r*(1-pr*0.4), 0, Math.PI*2);
    C.fill();
  });
}

function drawSparkles(now) {
  sparkles = sparkles.filter(s => now-s.born < s.dur);
  sparkles.forEach(s => {
    const pr = (now-s.born)/s.dur;
    s.x += s.vx; s.y += s.vy; s.vy += 0.06;
    s.vx *= 0.96; s.vy *= 0.96;
    const a = 1-pr;
    C.beginPath();
    C.fillStyle = s.col.replace('1.0',`${a}`).replace('0.9',`${a.toFixed(2)}`);
    C.arc(s.x, s.y, s.r*(1-pr*0.5), 0, Math.PI*2);
    C.fill();
  });
}

function drawLine(ls, t) {
  if (!ls.active) return;
  const {sx,sy,bx,by} = ls;
  const mx=(sx+bx)*0.5, my=Math.max(sy,by)-18+Math.sin(t*0.9)*4;
  // Line glow
  C.save();
  C.shadowColor='rgba(200,220,255,0.3)'; C.shadowBlur=4;
  C.beginPath(); C.moveTo(sx,sy); C.quadraticCurveTo(mx,my,bx,by);
  C.strokeStyle='rgba(215,225,255,0.88)'; C.lineWidth=1.3;
  C.stroke(); C.restore();

  if (!ls.bobVis) return;
  const dip = ls.dip ? 6 : Math.sin(t*2.1)*3.5;
  const by2 = by+dip;
  // Glow halo
  const gr = C.createRadialGradient(bx,by2,1,bx,by2,18);
  gr.addColorStop(0,'rgba(231,76,60,0.45)'); gr.addColorStop(1,'rgba(231,76,60,0)');
  C.beginPath(); C.arc(bx,by2,18,0,Math.PI*2); C.fillStyle=gr; C.fill();
  // Red cap
  C.save(); C.beginPath();
  C.arc(bx,by2-3.5,7,0,Math.PI);
  C.fillStyle = ls.dip ? '#c0392b' : '#e74c3c'; C.fill();
  // Specular on cap
  C.beginPath(); C.arc(bx-2,by2-5.5,2.5,0,Math.PI*2);
  C.fillStyle='rgba(255,255,255,0.35)'; C.fill();
  // White bottom
  C.beginPath(); C.arc(bx,by2+3.5,7,Math.PI,0);
  C.fillStyle='#ecf0f1'; C.fill();
  // Water line
  C.beginPath(); C.moveTo(bx-11,by2); C.lineTo(bx+11,by2);
  C.strokeStyle='rgba(38,198,247,0.6)'; C.lineWidth=1; C.stroke();
  C.restore();
}

function drawFishShadow(fs, t) {
  const { x, y, scale, rarity } = fs;
  const cols = {
    common:   'rgba(39,174,96,0.35)',
    rare:     'rgba(52,152,219,0.42)',
    epic:     'rgba(155,89,182,0.48)',
    legendary:'rgba(255,215,0,0.52)',
  };
  const col = cols[rarity] || cols.common;
  const sx = x + Math.sin(t*1.4)*22;
  const sy = y + Math.cos(t*0.9)*8;
  C.save(); C.translate(sx,sy);
  // Animated swim X
  C.scale((scale+Math.sin(t*1.5)*0.06) * (Math.sin(t*1.5)>0?1:-1), scale*0.5);
  const g = C.createRadialGradient(0,0,4,0,0,32);
  g.addColorStop(0,col); g.addColorStop(1,'transparent');
  C.fillStyle=g; C.beginPath(); C.ellipse(0,0,32,19,0,0,Math.PI*2); C.fill();
  // Fish body silhouette
  C.fillStyle = col.replace('0.52','0.25').replace('0.48','0.22').replace('0.42','0.2').replace('0.35','0.18');
  C.beginPath(); C.ellipse(0,0,20,9,0,0,Math.PI*2); C.fill();
  // Tail
  C.beginPath(); C.moveTo(18,0); C.lineTo(30,-7); C.lineTo(30,7); C.closePath(); C.fill();
  C.restore();
}

// ─────────────────────────────────────────────────────────────
// 6. GAME STATE
// ─────────────────────────────────────────────────────────────
let gs = 'menu'; // menu|tutorial|location|idle|casting|waiting|bite|battle|result|upgrades|catalog|paused
let currentLoc = 'lake';
let curFish = null;
let fishW = 0;
let fishHP = 100;
let tension = 50;
let isReel = false;
let castPow = 0, castDir = 1, castHold = false;
let biteT = null, biteWT = null;
let battleIv = null;
let isPaused = false;
let prevGs = 'menu'; // for returning from upgrades/catalog

// Upgrade helpers
function upStat(k) {
  const l = save.upgrades[k]||0;
  if (k==='rod')  return 1+l*0.2;
  if (k==='reel') return 1+l*0.22;
  if (k==='line') return l*8;       // safe zone px (out of 100 scale)
  if (k==='bait') return l*0.14;
  return 1;
}

function pickFish() {
  const cfg = getLvlCfg(save.level);
  let pool = FISH_DB.filter(f => cfg.rarities.includes(f.rarity) && f.locs.includes(currentLoc));
  if (!pool.length) pool = FISH_DB.filter(f => cfg.rarities.includes(f.rarity));
  if (!pool.length) pool = FISH_DB;
  const bb = upStat('bait');
  const wt = r => ({ common:70, rare:20+bb*30, epic:8+bb*15, legendary:2+bb*8 }[r]||1);
  let total = pool.reduce((s,f) => s+wt(f.rarity), 0);
  let roll  = Math.random() * total;
  for (const f of pool) { roll -= wt(f.rarity); if (roll <= 0) return f; }
  return pool[pool.length-1];
}

// ─────────────────────────────────────────────────────────────
// 7. HELPER: getElementById shorthand
// ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showScreen(id) {
  ['screen-menu','screen-tutorial','screen-location','screen-gameplay',
   'screen-result','screen-upgrades','screen-catalog'].forEach(s => {
    const el = $(s);
    if (el) { el.classList.toggle('hidden', s !== id); }
  });
}

// ─────────────────────────────────────────────────────────────
// 8. MENU
// ─────────────────────────────────────────────────────────────
function updateMenuStats() {
  $('menu-stat-level').textContent = `🏅 LVL ${save.level}`;
  $('menu-stat-coins').textContent = `🪙 ${save.coins.toLocaleString()}`;
  $('menu-stat-caught').textContent = `🐟 ${save.totalCaught} Caught`;
}

function spawnMenuParticles() {
  const cont = $('menu-particles');
  if (!cont) return;
  cont.innerHTML = '';
  for (let i=0; i<18; i++) {
    const p = document.createElement('div');
    p.className = 'menu-particle';
    const size = 3 + Math.random()*6;
    p.style.cssText = `
      left: ${Math.random()*100}%;
      width: ${size}px; height: ${size}px;
      animation-delay: ${Math.random()*6}s;
      animation-duration: ${6+Math.random()*8}s;
      opacity: ${0.3+Math.random()*0.5};
    `;
    cont.appendChild(p);
  }
}

function showMenu() {
  gs = 'menu';
  showScreen('screen-menu');
  lineState.active = false; fishShadow = null;
  clearBattle();
  updateMenuStats();
  checkDaily();
  spawnMenuParticles();
}

// ─────────────────────────────────────────────────────────────
// 9. TUTORIAL
// ─────────────────────────────────────────────────────────────
function showTutorial() {
  gs = 'tutorial';
  showScreen('screen-tutorial');
}

// ─────────────────────────────────────────────────────────────
// 10. LOCATION
// ─────────────────────────────────────────────────────────────
function showLocation() {
  gs = 'location';
  const lvl = save.level;
  const riverLocked = lvl < 7;
  const oceanLocked = lvl < 12;

  const riverCard = $('loc-river');
  const oceanCard = $('loc-ocean');

  if (riverLocked) {
    riverCard.classList.add('locked'); riverCard.onclick = null;
  } else {
    riverCard.classList.remove('locked'); riverCard.onclick = () => chooseLocation('river');
  }
  if (oceanLocked) {
    oceanCard.classList.add('locked'); oceanCard.onclick = null;
  } else {
    oceanCard.classList.remove('locked'); oceanCard.onclick = () => chooseLocation('ocean');
  }
  $('location-unlock-hint').textContent = riverLocked
    ? 'River unlocks at Level 7 • Ocean unlocks at Level 12'
    : oceanLocked ? 'Ocean unlocks at Level 12' : 'All locations unlocked!';
  showScreen('screen-location');
}

function chooseLocation(loc) {
  currentLoc = loc; save.location = loc; persist();
  startFishing();
}

// ─────────────────────────────────────────────────────────────
// 11. FISHING — IDLE / CAST / WAIT / BITE
// ─────────────────────────────────────────────────────────────
const locTags = { lake:'🏔️ MOUNTAIN LAKE', river:'🌊 WILD RIVER', ocean:'🌊 DEEP OCEAN' };

function startFishing() {
  gs = 'idle';
  showScreen('screen-gameplay');
  lineState = { active:false, sx:0, sy:0, bx:0, by:0, bobVis:false, dip:false };
  fishShadow = null; curFish = null;
  clearBattle();
  $('battle-hud').classList.add('hidden');
  $('cast-hint').style.display = '';
  $('cast-hint-text').textContent = 'TAP \u0026 HOLD TO CAST';
  $('cast-hint-sub').textContent = 'Hold longer for greater distance';
  $('bobber-hint').classList.add('hidden');
  $('bite-alert').className = 'bite-alert';
  $('power-meter-container').style.display = 'none';
  $('hud-location-tag').textContent = locTags[currentLoc] || '';
  // show cast-zone so player can tap to cast
  const cz = $('cast-zone');
  if (cz) { cz.style.display = 'block'; cz.style.bottom = '0'; }
  updateHUD();
}

function updateHUD() {
  $('hud-level').textContent = `LVL ${save.level}`;
  $('hud-coins-val').textContent = save.coins.toLocaleString();
  const cfg = getLvlCfg(save.level);
  const pct = Math.min(1, save.xp / cfg.xpReq);
  $('hud-xp-fill').style.width = (pct*100).toFixed(1) + '%';
  $('upgrade-coins-val') && ($('upgrade-coins-val').textContent = save.coins.toLocaleString());
}

function beginCast() {
  if (gs !== 'idle') return;
  gs = 'casting';
  castPow = 0; castDir = 1; castHold = true;
  $('power-meter-container').style.display = 'flex';
  $('cast-hint-text').textContent = 'RELEASE TO CAST!';
  $('cast-hint-sub').textContent = 'More power = farther cast!';
  lineState.sx = canvas.width * 0.12;
  lineState.sy = canvas.height * 0.36;
}

function releaseCast() {
  if (gs !== 'casting') return;
  castHold = false;
  $('power-meter-container').style.display = 'none';
  $('cast-hint').style.display = 'none';
  const W = canvas.width, H = canvas.height;
  const wY = H * 0.57;
  const pow = castPow / 100;
  lineState.bx = W * (0.28 + pow * 0.47);
  lineState.by = wY + 8 + pow * 22;
  lineState.active = true; lineState.bobVis = true; lineState.dip = false;
  Snd.cast();
  setTimeout(() => { Snd.splash(); addSplash(lineState.bx, lineState.by, 16); addRipple(lineState.bx, lineState.by, 28); }, 340);
  gs = 'waiting';
  $('bobber-hint').classList.remove('hidden');
  const cfg = getLvlCfg(save.level);
  const wait = cfg.waitMin + Math.random()*(cfg.waitMax-cfg.waitMin);
  scheduleFishApproach(wait);
}

function scheduleFishApproach(delay) {
  clearTimeout(biteT);
  // Fish shadow appears 2s before bite
  setTimeout(() => {
    if (gs !== 'waiting') return;
    curFish = pickFish();
    fishW = +(curFish.minW + Math.random()*(curFish.maxW-curFish.minW)).toFixed(1);
    fishShadow = { x: lineState.bx - 65, y: lineState.by + 42,
                   scale: 0.55 + Math.min(fishW/curFish.maxW, 1)*0.85, rarity: curFish.rarity };
    // Bobber pre-bite dips
    [0, 500, 900].forEach((d, i) => {
      setTimeout(() => { if (gs==='waiting') lineState.dip = (i%2===0); }, d);
    });
  }, Math.max(delay - 2200, 400));

  biteT = setTimeout(() => {
    if (gs !== 'waiting') return;
    gs = 'bite';
    fireBite();
  }, delay);
}

function fireBite() {
  Snd.bite();
  addRipple(lineState.bx, lineState.by, 32, 1);
  lineState.dip = true;
  const ba = $('bite-alert');
  ba.classList.add('visible');
  $('bobber-hint').classList.add('hidden');
  const cfg = getLvlCfg(save.level);
  biteWT = setTimeout(() => {
    if (gs === 'bite') missedBite();
  }, cfg.biteWindow);
}

function onBiteAlertTap() {
  if (gs !== 'bite') return;
  clearTimeout(biteWT);
  $('bite-alert').className = 'bite-alert'; // remove visible
  Snd.splash();
  addSplash(lineState.bx, lineState.by, 20);
  addRipple(lineState.bx, lineState.by, 42);
  $('bobber-hint').classList.add('hidden');
  startBattle();
}

function missedBite() {
  gs = 'idle';
  $('bite-alert').classList.add('missed');
  lineState.active = false; fishShadow = null;
  setTimeout(() => { $('bite-alert').className = 'bite-alert'; }, 800);
  $('bobber-hint').classList.add('hidden');
  $('cast-hint').style.display = '';
  $('cast-hint-text').textContent = 'TAP & HOLD TO CAST';
  $('cast-hint-sub').textContent = 'The fish got away…';
}

// ─────────────────────────────────────────────────────────────
// 12. BATTLE
// ─────────────────────────────────────────────────────────────
function startBattle() {
  if (!curFish) { curFish = pickFish(); fishW = +(curFish.minW*1.2).toFixed(1); }
  gs = 'battle';
  fishHP = 100; tension = 50; isReel = false;

  // Safe zone: 28–72% baseline, line upgrade widens it
  const safeW = 44 + upStat('line');      // total width
  const safeL = 50 - safeW/2;
  const safeR = 50 + safeW/2;

  // UI
  $('battle-fish-portrait').textContent = curFish.emoji;
  const nm = $('battle-fish-name');
  nm.textContent = curFish.name;
  nm.className = 'battle-fish-name rarity-' + curFish.rarity;
  $('battle-fish-weight').textContent = `~${fishW} kg`;
  const rt = $('battle-rarity-tag');
  rt.textContent = curFish.rarity.toUpperCase();
  rt.className = 'battle-rarity-tag ' + curFish.rarity;
  $('fish-hp-fill').style.width = '100%';
  $('fish-hp-fill').className = 'hp-fill';
  $('hp-pct').textContent = '100%';
  $('battle-hud').classList.remove('hidden');
  $('cast-hint').style.display = 'none';
  // Narrow cast-zone during battle (top half only; reel btn handles bottom)
  const cz = $('cast-zone');
  if (cz) { cz.style.bottom = '45%'; }

  // Tension safe zone visual
  const safeZone = $('tension-safe-zone');
  safeZone.style.left  = safeL + '%';
  safeZone.style.width = safeW + '%';

  const cfg = getLvlCfg(save.level);
  const rodPow = upStat('rod');
  const reelSpd = upStat('reel');
  const fishDiff = curFish.difficulty * cfg.diffMul / rodPow;

  let phase = 0, pullDir = 1, cooldown = 0;

  battleIv = setInterval(() => {
    if (gs !== 'battle' || isPaused) return;
    phase += 0.055; cooldown--;
    let pull = 0;
    switch(curFish.behavior) {
      case 'steady':   pull = 0.55 * fishDiff; break;
      case 'sluggish': pull = 0.35*fishDiff + Math.sin(phase)*0.22*fishDiff; break;
      case 'runner':
        if (cooldown<=0) { pullDir=Math.random()>0.4?1:-1; cooldown=18+Math.random()*28; }
        pull = fishDiff*pullDir*(0.65+Math.sin(phase*2)*0.4);
        break;
      case 'erratic':
        if (cooldown<=0) { pullDir=Math.random()>0.5?1:-1; cooldown=7+Math.random()*14; }
        pull = fishDiff*pullDir*(0.45+Math.random()*0.85);
        break;
    }
    tension += pull;
    if (isReel) {
      tension -= reelSpd * 0.75;
      fishHP  -= 0.45 * reelSpd;
      if (Math.random()<0.14) Snd.reel();
    } else {
      tension += 0.28; // line drifts toward danger when not reeling
    }
    tension = Math.clamp ? Math.clamp(0,tension,100) : Math.max(0, Math.min(100, tension));
    fishHP  = Math.max(0, Math.min(100, fishHP));
    updateBattleUI(safeL, safeR);
    if (tension >= 100) { snapLine(); }
    else if (fishHP <= 0) { catchFish(); }
  }, 80);
}

function updateBattleUI(safeL, safeR) {
  // Tension fill
  const fill = $('tension-fill');
  fill.style.width = tension + '%';
  const safe = tension >= safeL && tension <= safeR;
  const crit = tension > 90 || tension < 10;
  fill.className = `t-fill ${crit?'critical':safe?'safe':tension>safeR?'danger':'danger'}`;
  $('t-needle') && ($('t-needle').__left = tension); // track for needle
  $('tension-marker').style.left = tension + '%';
  $('tension-value').textContent = Math.round(tension) + '%';

  const status = $('tension-status');
  if (crit)       { status.textContent = '⚠️ DANGER!'; status.className='tension-status danger'; }
  else if (safe)  { status.textContent = '✅ SAFE';    status.className='tension-status'; }
  else            { status.textContent = '⚠️ CAREFUL'; status.className='tension-status danger'; }

  // HP
  const hp = $('fish-hp-fill');
  hp.style.width = fishHP + '%';
  hp.className = `hp-fill${fishHP<25?' critical':fishHP<55?' low':''}`;
  $('hp-pct').textContent = Math.ceil(fishHP) + '%';
}

function clearBattle() {
  clearInterval(battleIv); battleIv = null;
  clearTimeout(biteT); biteT = null;
  clearTimeout(biteWT); biteWT = null;
}

function snapLine() {
  clearBattle();
  lineState.active = false; fishShadow = null;
  Snd.snap();
  const flash = $('screen-flash');
  flash.classList.add('show');
  setTimeout(() => flash.classList.remove('show'), 700);
  gs = 'result';
  showFailResult();
}

function catchFish() {
  clearBattle();
  lineState.active = false;
  Snd.catch();
  const bx = lineState.bx, by = lineState.by - 35;
  addSplash(bx, by, 22);
  addRipple(bx, by+35, 55);
  const rCol = { common:'rgba(39,174,96,0.9)', rare:'rgba(52,152,219,0.9)', epic:'rgba(155,89,182,0.9)', legendary:'rgba(255,215,0,0.9)' };
  addSparkle(bx, by, rCol[curFish.rarity]||'rgba(255,215,0,0.9)', 20);

  save.totalCaught++;
  save.catalog[curFish.id] = (save.catalog[curFish.id]||0)+1;
  const isRecord = !save.records[curFish.id] || fishW > save.records[curFish.id];
  if (isRecord) save.records[curFish.id] = fishW;
  const coins = Math.ceil(curFish.coins * (1 + fishW/curFish.maxW));
  save.coins += coins;
  Snd.coin();
  const cfg = getLvlCfg(save.level);
  save.xp += curFish.xp;
  let leveled = false;
  while (save.level < 40 && save.xp >= getLvlCfg(save.level).xpReq) {
    save.xp -= getLvlCfg(save.level).xpReq; save.level++; leveled = true;
  }
  persist();
  gs = 'result';
  if (leveled) setTimeout(() => showLevelUp(save.level), 700);
  showCatchResult(isRecord, coins);
}

// ─────────────────────────────────────────────────────────────
// 13. RESULT SCREEN
// ─────────────────────────────────────────────────────────────
function rarCol(r) {
  return { common:'var(--c-common)', rare:'var(--c-rare)', epic:'var(--c-epic)', legendary:'var(--c-gold)' }[r]||'#fff';
}

function showCatchResult(isRecord, coins) {
  showScreen('screen-result');
  $('result-header').textContent = '🏆 FISH CAUGHT!';
  $('result-header').className = 'result-header';
  $('result-fish-emoji').textContent = curFish.emoji;
  $('result-fish-name').textContent  = curFish.name;
  $('result-fish-name').style.color  = rarCol(curFish.rarity);
  $('result-rarity-strip').textContent = curFish.rarity.toUpperCase() + ' CATCH';
  $('result-rarity-strip').style.color = rarCol(curFish.rarity);
  $('result-weight').textContent   = fishW + ' kg';
  $('result-rarity').textContent   = curFish.rarity.toUpperCase();
  $('result-rarity').style.color   = rarCol(curFish.rarity);
  $('result-level').textContent    = save.level;
  $('result-location').textContent = currentLoc.charAt(0).toUpperCase()+currentLoc.slice(1);
  $('result-coins').textContent    = `+${coins} 🪙`;
  $('result-xp').textContent       = `+${curFish.xp} XP`;
  isRecord ? $('result-new-record').classList.remove('hidden') : $('result-new-record').classList.add('hidden');
  // legendary glow
  const card = $('result-card');
  card.classList.toggle('legendary', curFish.rarity === 'legendary');
  updateHUD();
}

function showFailResult() {
  showScreen('screen-result');
  $('result-header').textContent = '💔 LINE SNAPPED!';
  $('result-header').className = 'result-header fail';
  $('result-fish-emoji').textContent = '💫';
  $('result-fish-name').textContent = 'The Fish Got Away…';
  $('result-fish-name').style.color = 'var(--t-sec)';
  $('result-rarity-strip').textContent = 'BETTER LUCK NEXT TIME';
  $('result-rarity-strip').style.color = 'var(--t-muted)';
  $('result-weight').textContent  = '—';
  $('result-rarity').textContent  = '—';
  $('result-rarity').style.color  = 'var(--t-muted)';
  $('result-level').textContent   = save.level;
  $('result-location').textContent= currentLoc.charAt(0).toUpperCase()+currentLoc.slice(1);
  $('result-coins').textContent   = '+0 🪙';
  $('result-xp').textContent      = '+0 XP';
  $('result-new-record').classList.add('hidden');
  Snd.fail();
  updateHUD();
}

// ─────────────────────────────────────────────────────────────
// 14. LEVEL UP
// ─────────────────────────────────────────────────────────────
function showLevelUp(lvl) {
  Snd.levelUp();
  const banner = $('level-up-banner');
  $('level-up-num').textContent = lvl;
  banner.classList.add('show');
  addSparkle(window.innerWidth/2, window.innerHeight/2, 'rgba(255,215,0,0.9)', 30);
  setTimeout(() => banner.classList.remove('show'), 2900);
}

// ─────────────────────────────────────────────────────────────
// 15. UPGRADES
// ─────────────────────────────────────────────────────────────
const UPG_MAX = 8;
const UPG_COST = {
  rod:  [80,150,260,420,620,950,1400,2200],
  reel: [80,155,265,430,640,980,1450,2300],
  line: [100,200,360,580,860,1200,1700,2600],
  bait: [120,260,460,740,1080,1600,2200,3200],
};
const UPG_DESC = {
  rod:  l => `Reduces fish pull × ${(1+l*0.2).toFixed(2)} (Level ${l}/${UPG_MAX})`,
  reel: l => `Reel speed × ${(1+l*0.22).toFixed(2)} (Level ${l}/${UPG_MAX})`,
  line: l => `Safe zone +${l*8}% wider (Level ${l}/${UPG_MAX})`,
  bait: l => `+${Math.round(l*14)}% rare fish chance (Level ${l}/${UPG_MAX})`,
};

function showUpgrades(back) {
  prevGs = back || 'menu';
  gs = 'upgrades';
  $('btn-back-upgrades').onclick = () => {
    if (prevGs === 'play') startFishing();
    else showMenu();
  };
  showScreen('screen-upgrades');
  renderUpgrades();
  updateHUD();
}

function renderUpgrades() {
  ['rod','reel','line','bait'].forEach(k => {
    const lvl = save.upgrades[k]||0;
    const maxed = lvl >= UPG_MAX;
    const cost = maxed ? 0 : UPG_COST[k][lvl];
    const canBuy = save.coins >= cost;
    $(k+'-desc').textContent = UPG_DESC[k](lvl);
    const btn = $('btn-upgrade-'+k);
    const costEl = $(k+'-cost-label');
    if (maxed) {
      btn.className = 'upg-btn maxed'; btn.disabled = false;
      costEl.textContent = 'MAX ✓';
      btn.querySelector('.upg-btn-label').textContent = 'MAXED';
    } else {
      btn.className = 'upg-btn'; btn.disabled = !canBuy;
      costEl.textContent = `🪙 ${cost.toLocaleString()}`;
      btn.querySelector('.upg-btn-label').textContent = 'UPGRADE';
    }
    // Pips
    const pipsEl = $(k+'-pips');
    pipsEl.innerHTML = '';
    for (let i=0;i<UPG_MAX;i++) {
      const pip = document.createElement('div');
      pip.className = 'upg-pip' + (i < lvl ? ' filled' : '');
      pipsEl.appendChild(pip);
    }
  });
}

function purchaseUpgrade(k) {
  const lvl = save.upgrades[k]||0;
  if (lvl >= UPG_MAX) return;
  const cost = UPG_COST[k][lvl];
  if (save.coins < cost) return;
  save.coins -= cost; save.upgrades[k] = lvl+1;
  persist(); Snd.coin();
  renderUpgrades(); updateHUD();
}

// ─────────────────────────────────────────────────────────────
// 16. CATALOG
// ─────────────────────────────────────────────────────────────
function showCatalog(back) {
  prevGs = back || 'menu';
  gs = 'catalog';
  $('btn-back-catalog').onclick = () => {
    if (prevGs === 'play') startFishing();
    else showMenu();
  };
  showScreen('screen-catalog');
  renderCatalog();
}

function renderCatalog() {
  const grid = $('catalog-grid');
  grid.innerHTML = '';
  let caughtN = 0;
  FISH_DB.forEach(f => {
    const caught = save.catalog[f.id]||0;
    if (caught > 0) caughtN++;
    const best = save.records[f.id];
    const card = document.createElement('div');
    card.className = `cat-card c-${f.rarity}${caught===0?' undiscovered':''}`;
    card.innerHTML = `
      <span class="cat-rarity ${f.rarity}">${f.rarity.toUpperCase()}</span>
      <span class="cat-emoji">${caught>0 ? f.emoji : '❓'}</span>
      <div class="cat-name">${caught>0 ? f.name : '???'}</div>
      <div class="cat-weight">${caught>0 ? (best?`Best: ${best} kg`:'Not weighed') : 'Undiscovered'}</div>
      ${caught>0 ? `<span class="cat-caught" title="${caught}x caught">✅</span>` : ''}
    `;
    grid.appendChild(card);
  });
  $('catalog-count').textContent = `${caughtN} / ${FISH_DB.length}`;
}

// ─────────────────────────────────────────────────────────────
// 17. DAILY REWARD
// ─────────────────────────────────────────────────────────────
function checkDaily() {
  const ok = Date.now() - (save.lastDaily||0) >= 86400000;
  $('daily-reward-banner').classList.toggle('hidden', !ok);
}
function showDailyReward() {
  if (Date.now() - (save.lastDaily||0) < 86400000) return;
  const amt = 200 + save.level * 25;
  $('daily-amount').textContent = `+${amt} 🪙`;
  $('modal-daily').classList.remove('hidden');
}
function claimDailyReward() {
  const amt = 200 + save.level * 25;
  save.coins += amt; save.lastDaily = Date.now();
  persist(); Snd.coin();
  $('modal-daily').classList.add('hidden');
  $('daily-reward-banner').classList.add('hidden');
  updateHUD(); updateMenuStats();
}

// ─────────────────────────────────────────────────────────────
// 18. INPUT SYSTEM — Document-level + Cast-zone
//     Using document ensures no pointer-event block can stop
//     casting from working on any device.
// ─────────────────────────────────────────────────────────────

const castZone = $('cast-zone');

// ── Core gameplay tap/hold handlers ──────────────────────
function onGameDown(e) {
  // Only fire if we tapped on cast-zone or canvas (not on HUD buttons)
  const tag = e.target ? e.target.tagName : '';
  const cls = e.target ? (e.target.className || '') : '';
  // If tap is on a button/interactive UI element — ignore (let the button handle it)
  if (tag === 'BUTTON' || cls.includes('hud-btn') || cls.includes('upg-btn') ||
      cls.includes('cat-card') || cls.includes('location-card')) return;
  // If bite-alert is visible, let it handle itself
  if (gs === 'bite') { onBiteAlertTap(); return; }

  Snd.boot(); Snd.wake();
  if (gs === 'idle')    beginCast();
  else if (gs === 'battle') startReel();
}

function onGameUp(e) {
  if (gs === 'casting') releaseCast();
  else if (gs === 'battle') stopReel();
}

// Attach to cast-zone div (the primary gameplay input surface)
castZone.addEventListener('touchstart', e => { e.preventDefault(); onGameDown(e); }, { passive: false });
castZone.addEventListener('touchend',   e => { e.preventDefault(); onGameUp(e);   }, { passive: false });
castZone.addEventListener('touchcancel',e => { onGameUp(e); }, { passive: false });
castZone.addEventListener('mousedown',  e => { onGameDown(e); });
castZone.addEventListener('mouseup',    e => { onGameUp(e); });
castZone.addEventListener('mouseleave', e => { onGameUp(e); });

// ALSO attach to canvas as fallback
canvas.addEventListener('touchstart', e => { e.preventDefault(); onGameDown(e); }, { passive: false });
canvas.addEventListener('touchend',   e => { e.preventDefault(); onGameUp(e);   }, { passive: false });
canvas.addEventListener('mousedown',  e => { onGameDown(e); });
canvas.addEventListener('mouseup',    e => { onGameUp(e); });

// Reel button — specific, direct handler (separate from cast-zone)
const reelBtn = $('reel-btn');
function startReel() {
  if (gs !== 'battle') return;
  isReel = true;
  reelBtn.classList.add('pressing');
}
function stopReel() {
  isReel = false;
  reelBtn.classList.remove('pressing');
}
reelBtn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); Snd.boot(); startReel(); }, { passive: false });
reelBtn.addEventListener('touchend',   e => { e.preventDefault(); e.stopPropagation(); stopReel(); }, { passive: false });
reelBtn.addEventListener('touchcancel',e => { stopReel(); }, { passive: false });
reelBtn.addEventListener('mousedown',  e => { e.preventDefault(); startReel(); });
reelBtn.addEventListener('mouseup',    e => { e.preventDefault(); stopReel(); });
reelBtn.addEventListener('mouseleave', e => { stopReel(); });

// syncCastZone is called directly inside startFishing() and startBattle()
// (already handled above — no wrapper needed)


// ─────────────────────────────────────────────────────────────
// 19. BUTTON WIRING
// ─────────────────────────────────────────────────────────────
$('btn-play').onclick            = () => { Snd.boot(); showTutorial(); };
$('btn-upgrades-menu').onclick   = () => { Snd.boot(); showUpgrades('menu'); };
$('btn-catalog-menu').onclick    = () => { Snd.boot(); showCatalog('menu'); };
$('btn-start-fishing').onclick   = () => showLocation();
$('btn-skip-tutorial').onclick   = () => showLocation();
$('btn-back-loc').onclick        = () => showMenu();
$('btn-pause').onclick           = () => {
  isPaused = true;
  $('modal-pause').classList.remove('hidden');
};
$('btn-resume').onclick          = () => { isPaused=false; $('modal-pause').classList.add('hidden'); };
$('btn-pause-upgrades').onclick  = () => { isPaused=false; $('modal-pause').classList.add('hidden'); showUpgrades('play'); };
$('btn-pause-catalog').onclick   = () => { isPaused=false; $('modal-pause').classList.add('hidden'); showCatalog('play'); };
$('btn-pause-menu').onclick      = () => {
  isPaused=false; $('modal-pause').classList.add('hidden');
  clearBattle(); lineState.active=false; fishShadow=null;
  showMenu();
};
$('btn-fish-again').onclick      = () => { curFish=null; showLocation(); };
$('btn-result-upgrades').onclick = () => showUpgrades('play');
$('btn-result-menu').onclick     = () => { curFish=null; showMenu(); };
$('btn-back-upgrades') && ($('btn-back-upgrades').onclick = () => showMenu());
$('btn-back-catalog')  && ($('btn-back-catalog').onclick  = () => showMenu());
$('loc-lake').onclick            = () => chooseLocation('lake');

// Sound toggle
const soundBtn = $('sound-toggle-btn');
soundBtn.textContent = '🔊';
soundBtn.onclick = () => {
  Snd.boot();
  save.soundOn = !save.soundOn;
  Snd.setOn(save.soundOn);
  soundBtn.textContent = save.soundOn ? '🔊' : '🔇';
  persist();
};

// ─────────────────────────────────────────────────────────────
// 20. EXPOSE GLOBALS (called from HTML onclick)
// ─────────────────────────────────────────────────────────────
window.onBiteAlertTap   = onBiteAlertTap;
window.showDailyReward  = showDailyReward;
window.claimDailyReward = claimDailyReward;
window.purchaseUpgrade  = purchaseUpgrade;
window.selectLocation   = chooseLocation;

// ─────────────────────────────────────────────────────────────
// 21. INIT
// ─────────────────────────────────────────────────────────────
loadSave();
currentLoc = save.location || 'lake';
Snd.setOn(save.soundOn !== false);
soundBtn.textContent = save.soundOn !== false ? '\uD83D\uDD0A' : '\uD83D\uDD07';
// Cast-zone hidden until we enter gameplay
if (castZone) castZone.style.display = 'none';
requestAnimationFrame(render);
showMenu();
