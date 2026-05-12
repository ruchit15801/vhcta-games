// ============================================================
//  COOKING BATTLE ARENA — Rewritten Engine v2
//  Click/Tap to Move + Smooth Gameplay + 60fps
// ============================================================
'use strict';

// ─── AUDIO ENGINE ─────────────────────────────────────────
const Audio = (() => {
  const ctx = (() => { try { return new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return null; } })();
  let enabled = true;
  let bgSource = null;

  function unlockCtx() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function playTone(freq, dur, type='sine', vol=0.3, attack=0.01) {
    if (!ctx || !enabled) return;
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur + 0.05);
    } catch(e){}
  }

  function playNoise(dur=0.1, vol=0.2) {
    if (!ctx || !enabled) return;
    try {
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0; i<d.length; i++) d[i] = (Math.random()*2-1);
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      const filt = ctx.createBiquadFilter(); filt.type='bandpass'; filt.frequency.value=800;
      src.buffer=buf; src.connect(filt); filt.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(vol,ctx.currentTime); g.gain.linearRampToValueAtTime(0,ctx.currentTime+dur);
      src.start();
    } catch(e){}
  }

  const sounds = {
    chop:    ()=>{ playNoise(0.06,0.3); playTone(300,0.05,'square',0.15); },
    cook:    ()=>{ for(let i=0;i<3;i++) setTimeout(()=>playNoise(0.08,0.15),i*80); },
    serve:   ()=>{ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>playTone(f,0.15,'sine',0.25),i*80)); },
    error:   ()=>{ playTone(200,0.2,'sawtooth',0.3); setTimeout(()=>playTone(150,0.2,'sawtooth',0.3),150); },
    pickup:  ()=>playTone(660,0.1,'sine',0.2),
    burn:    ()=>{ playTone(100,0.4,'sawtooth',0.4); playNoise(0.2,0.3); },
    combo:   ()=>{ [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>playTone(f,0.1,'sine',0.35),i*60)); },
    levelUp: ()=>{ [523,659,784,1047,1319,1568].forEach((f,i)=>setTimeout(()=>playTone(f,0.15,'sine',0.3),i*90)); },
    rush:    ()=>{ playTone(440,0.1,'sawtooth',0.2); playTone(880,0.1,'sawtooth',0.2); },
    click:   ()=>playTone(880,0.04,'sine',0.1),
  };

  function startBGMusic(fast=false) {
    if (!ctx || !enabled) return;
    stopBGMusic();
    const bpm = fast ? 160 : 120;
    const beat = 60/bpm;
    const notes = fast
      ? [329,392,440,523,392,349,329,392,440,329,349,392]
      : [261,329,392,349,261,329,392,261,329,349,392,329];
    let step = 0;
    function tick() {
      if (!enabled) return;
      playTone(notes[step%notes.length]*0.5, beat*0.9, 'triangle', 0.06, 0.01);
      step++;
    }
    tick();
    bgSource = setInterval(tick, beat*1000);
  }

  function stopBGMusic() { if(bgSource){ clearInterval(bgSource); bgSource=null; } }

  return {
    play: (name) => { unlockCtx(); if(sounds[name]) sounds[name](); },
    startBGMusic, stopBGMusic,
    toggle: () => { enabled=!enabled; if(!enabled) stopBGMusic(); return enabled; },
    isEnabled: () => enabled,
    resume: unlockCtx
  };
})();

// ─── DISHES & LEVELS ──────────────────────────────────────
const DISHES = {
  burger:   { name:'Burger',    icon:'🍔', cookTime:3, points:120, color:'#FF8F00' },
  pizza:    { name:'Pizza',     icon:'🍕', cookTime:4, points:150, color:'#FF1744' },
  sushi:    { name:'Sushi',     icon:'🍣', cookTime:2, points:130, color:'#0288D1' },
  hotdog:   { name:'Hot Dog',   icon:'🌭', cookTime:2, points:100, color:'#FF6D00' },
  salad:    { name:'Salad',     icon:'🥗', cookTime:1, points:90,  color:'#2E7D32' },
  soup:     { name:'Soup',      icon:'🍲', cookTime:5, points:160, color:'#6A1B9A' },
  pasta:    { name:'Pasta',     icon:'🍝', cookTime:4, points:140, color:'#F4511E' },
  tacos:    { name:'Tacos',     icon:'🌮', cookTime:3, points:130, color:'#558B2F' },
  rice:     { name:'Rice Box',  icon:'🍱', cookTime:3, points:120, color:'#00796B' },
  cake:     { name:'Cake',      icon:'🎂', cookTime:6, points:200, color:'#AD1457' },
  ramen:    { name:'Ramen',     icon:'🍜', cookTime:5, points:180, color:'#E53935' },
  steak:    { name:'Steak',     icon:'🥩', cookTime:6, points:210, color:'#BF360C' },
  icecream: { name:'Ice Cream', icon:'🍦', cookTime:2, points:110, color:'#E91E63' },
  donut:    { name:'Donut',     icon:'🍩', cookTime:4, points:160, color:'#F06292' },
  sandwich: { name:'Sandwich',  icon:'🥪', cookTime:2, points:105, color:'#795548' },
};

const LEVELS = [
  { id:1,  name:'Kitchen Basics',   dishes:['burger'],                        orders:5,  time:90,  speed:0.5, rushAt:30 },
  { id:2,  name:'Simple Service',   dishes:['hotdog','salad'],                orders:6,  time:90,  speed:0.6, rushAt:25 },
  { id:3,  name:'Quick Cook',       dishes:['sushi','burger'],                orders:7,  time:90,  speed:0.7, rushAt:25 },
  { id:4,  name:'Double Trouble',   dishes:['burger','pizza','sushi'],        orders:8,  time:100, speed:0.75,rushAt:35 },
  { id:5,  name:'Rush Hour',        dishes:['hotdog','pasta','salad'],        orders:9,  time:100, speed:0.8, rushAt:30 },
  { id:6,  name:'Soup Kitchen',     dishes:['soup','burger','tacos'],         orders:9,  time:100, speed:0.85,rushAt:30 },
  { id:7,  name:'Taco Tuesday',     dishes:['tacos','pizza','sushi'],         orders:10, time:100, speed:0.9, rushAt:25 },
  { id:8,  name:'Rice Frenzy',      dishes:['rice','burger','pasta','sushi'], orders:10, time:110, speed:0.95,rushAt:40 },
  { id:9,  name:'Midnight Kitchen', dishes:['ramen','tacos','soup','pizza'],  orders:11, time:110, speed:1.0, rushAt:35 },
  { id:10, name:'Chef Showdown',    dishes:['steak','cake','ramen'],          orders:11, time:110, speed:1.05,rushAt:30 },
  { id:11, name:'Sweet Deal',       dishes:['cake','icecream','donut'],       orders:12, time:120, speed:1.1, rushAt:30 },
  { id:12, name:'Grill Master',     dishes:['steak','burger','hotdog'],       orders:12, time:120, speed:1.1, rushAt:30 },
  { id:13, name:'Sandwich War',     dishes:['sandwich','pizza','pasta'],      orders:13, time:120, speed:1.15,rushAt:25 },
  { id:14, name:'Ocean Kitchen',    dishes:['sushi','ramen','rice'],          orders:13, time:120, speed:1.2, rushAt:25 },
  { id:15, name:'Grand Prix',       dishes:['cake','steak','ramen','pizza'],  orders:14, time:130, speed:1.25,rushAt:20 },
  { id:16, name:'Chaos Fiesta',     dishes:['tacos','pizza','steak','cake'],  orders:14, time:130, speed:1.3, rushAt:20 },
  { id:17, name:'Storm Kitchen',    dishes:['ramen','soup','pasta','sushi'],  orders:15, time:130, speed:1.35,rushAt:20 },
  { id:18, name:'Ice Storm',        dishes:['icecream','donut','cake'],       orders:15, time:130, speed:1.4, rushAt:15 },
  { id:19, name:'Mega Combo',       dishes:['burger','pizza','steak','ramen'],orders:16, time:140, speed:1.45,rushAt:15 },
  { id:20, name:'Battle Royale',    dishes:Object.keys(DISHES).slice(0,8),   orders:16, time:140, speed:1.5, rushAt:15 },
  { id:21, name:'Inferno Kitchen',  dishes:Object.keys(DISHES).slice(2,10),  orders:17, time:140, speed:1.6, rushAt:12 },
  { id:22, name:'Speed Demon',      dishes:Object.keys(DISHES).slice(4,12),  orders:17, time:150, speed:1.65,rushAt:12 },
  { id:23, name:'Ultimate Chaos',   dishes:Object.keys(DISHES).slice(0,10),  orders:18, time:150, speed:1.7, rushAt:10 },
  { id:24, name:'Pro Chef Arena',   dishes:Object.keys(DISHES).slice(5,13),  orders:18, time:150, speed:1.75,rushAt:10 },
  { id:25, name:'Grand Master',     dishes:Object.keys(DISHES).slice(3,14),  orders:19, time:160, speed:1.8, rushAt:10 },
  { id:26, name:'Legend I',         dishes:Object.keys(DISHES),              orders:20, time:160, speed:1.9, rushAt:8  },
  { id:27, name:'Legend II',        dishes:Object.keys(DISHES),              orders:20, time:170, speed:2.0, rushAt:8  },
  { id:28, name:'Legend III',       dishes:Object.keys(DISHES),              orders:22, time:180, speed:2.1, rushAt:8  },
  { id:29, name:'God Mode',         dishes:Object.keys(DISHES),              orders:24, time:180, speed:2.2, rushAt:6  },
  { id:30, name:'Cooking God',      dishes:Object.keys(DISHES),              orders:25, time:200, speed:2.3, rushAt:5  },
];

// ─── GAME STATE ───────────────────────────────────────────
const State = {
  currentLevel: 1,
  unlockedLevel: parseInt(localStorage.getItem('cba_unlocked')||'1'),
  levelStars: JSON.parse(localStorage.getItem('cba_stars')||'{}'),
  totalScore: parseInt(localStorage.getItem('cba_total_score')||'0'),
  upgrades: JSON.parse(localStorage.getItem('cba_upgrades')||'{"speed":0,"cook":0,"capacity":0}'),
  upgradePoints: parseInt(localStorage.getItem('cba_upg_pts')||'0'),
  save() {
    localStorage.setItem('cba_unlocked', this.unlockedLevel);
    localStorage.setItem('cba_stars', JSON.stringify(this.levelStars));
    localStorage.setItem('cba_total_score', this.totalScore);
    localStorage.setItem('cba_upgrades', JSON.stringify(this.upgrades));
    localStorage.setItem('cba_upg_pts', this.upgradePoints);
  }
};

// ─── HELPERS ──────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}

function shadeColor(hex, amount) {
  let r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  const clamp = v => Math.max(0,Math.min(255,v));
  return `rgb(${clamp(r+amount)},${clamp(g+amount)},${clamp(b+amount)})`;
}

function lerp(a, b, t) { return a + (b-a)*t; }
function dist(x1,y1,x2,y2) { return Math.sqrt((x2-x1)**2+(y2-y1)**2); }

// ─── CANVAS ───────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;

function resizeCanvas() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

// ─── GAME SESSION ─────────────────────────────────────────
let G = null;         // active game data
let running = false;
let paused = false;
let animFrame = null;
let lastTime = 0;
let particles = [];

// ─── STATION TYPES ────────────────────────────────────────
const ST = {
  ingredient: { color:'#1B5E20', border:'#4CAF50', label:'Pick Up',    icon:'📦', hint:'Tap → Pick dish' },
  chop:       { color:'#1565C0', border:'#42A5F5', label:'Chop',       icon:'🔪', hint:'Tap → Chop it' },
  cook:       { color:'#B71C1C', border:'#EF5350', label:'Cook',       icon:'🔥', hint:'Tap → Cook it' },
  serve:      { color:'#4A148C', border:'#AB47BC', label:'Serve',      icon:'🪟', hint:'Tap → Serve!' },
  trash:      { color:'#33691E', border:'#8BC34A', label:'Trash',      icon:'🗑️', hint:'Tap → Trash' },
};

function buildLayout() {
  const pad = Math.max(16, W * 0.03);
  const stW = Math.min(90, Math.max(60, W * 0.12));
  const stH = Math.min(85, Math.max(58, H * 0.13));
  const cx = W / 2;

  // 5 columns across, 2 rows of stations
  const cols = [pad, W*0.22, W*0.44, W*0.66, W - pad - stW];
  const row1 = H * 0.18;
  const row2 = H * 0.58;

  return [
    { type:'ingredient', x:cols[0], y:row1, w:stW, h:stH, id:'ing1' },
    { type:'ingredient', x:cols[0], y:row2, w:stW, h:stH, id:'ing2' },
    { type:'chop',       x:cols[1], y:row1, w:stW, h:stH, id:'chop1' },
    { type:'chop',       x:cols[1], y:row2, w:stW, h:stH, id:'chop2' },
    { type:'cook',       x:cols[2], y:row1, w:stW, h:stH, id:'cook1' },
    { type:'cook',       x:cols[2], y:row2, w:stW, h:stH, id:'cook2' },
    { type:'serve',      x:cols[3], y:row1, w:stW, h:stH, id:'serve1' },
    { type:'serve',      x:cols[3], y:row2, w:stW, h:stH, id:'serve2' },
    { type:'trash',      x:cols[4], y:(row1+row2)/2, w:stW, h:stH, id:'trash' },
  ];
}

// ─── PLAYER ───────────────────────────────────────────────
function createPlayer(x, y, isAI=false) {
  return {
    x, y,
    targetX: x,
    targetY: y,
    speed: 200,          // px/s
    w: 38, h: 44,
    isAI,
    hatColor: isAI ? '#673AB7' : '#FF6B2B',
    carrying: null,      // null or { dishKey, chopDone, cooked, burned, cookProgress }
    busy: false,         // currently doing an interaction
    facing: 1,
    walkAnim: 0,
    // AI fields
    aiState: 'idle',
    aiTimer: 0,
    aiStepTimer: 0,
    clickRipple: null,
  };
}

// ─── ORDER SYSTEM ─────────────────────────────────────────
function createOrder(levelIdx) {
  const lvl = LEVELS[levelIdx];
  const dishKey = lvl.dishes[Math.floor(Math.random()*lvl.dishes.length)];
  const baseTime = 20 - Math.min(12, lvl.speed * 4);
  const maxTime = Math.max(9, baseTime);
  return {
    id: Date.now() + Math.random(),
    dishKey,
    dish: DISHES[dishKey],
    timeLeft: maxTime,
    maxTime,
    urgent: false,
  };
}

// ─── INTERACTION LOGIC ────────────────────────────────────
function interactWithStation(player, station) {
  if (player.busy) return;

  const type = station.type;

  if (type === 'ingredient') {
    if (player.carrying) { showNotif('Already carrying something!', 'error'); Audio.play('error'); return; }
    const lvl = LEVELS[G.levelIdx];
    const dishKey = lvl.dishes[Math.floor(Math.random()*lvl.dishes.length)];
    player.carrying = { dishKey, chopDone:false, cooked:false, burned:false, cookProgress:0 };
    showNotif(`${DISHES[dishKey].icon} Picked ${DISHES[dishKey].name}!`, 'success');
    Audio.play('pickup');
    spawnBurst(station.x+station.w/2, station.y, '#4CAF50');
    return;
  }

  if (type === 'chop') {
    if (!player.carrying) { showNotif('Nothing to chop!', 'error'); Audio.play('error'); return; }
    if (player.carrying.chopDone) { showNotif('Already chopped! Cook it now 🔥', 'gold'); return; }
    if (player.carrying.cooked) { showNotif('Already cooked! Serve it 🪟', 'gold'); return; }
    startChop(player, station);
    return;
  }

  if (type === 'cook') {
    if (!player.carrying) { showNotif('Nothing to cook!', 'error'); Audio.play('error'); return; }
    if (!player.carrying.chopDone) { showNotif('Chop it first! 🔪', 'error'); Audio.play('error'); return; }
    if (player.carrying.cooked) { showNotif('Already cooked! Go serve 🪟', 'gold'); return; }
    startCooking(player, station);
    return;
  }

  if (type === 'serve') {
    doServe(player);
    return;
  }

  if (type === 'trash') {
    if (!player.carrying) { showNotif('Nothing to trash!', 'error'); return; }
    player.carrying = null;
    showNotif('Trashed! ♻️', 'error');
    Audio.play('error');
    return;
  }
}

function startChop(player, station) {
  player.busy = true;
  Audio.play('chop');
  const speedMult = 1 + State.upgrades.speed * 0.3;
  const chopMs = Math.max(500, 1400 / speedMult);
  let elapsed = 0;
  let lastChop = 0;

  function tick() {
    if (!running || paused) { player.busy = false; return; }
    elapsed += 50;
    if (elapsed - lastChop > 350) { Audio.play('chop'); lastChop = elapsed; }
    if (elapsed < chopMs) {
      setTimeout(tick, 50);
    } else {
      player.carrying.chopDone = true;
      player.busy = false;
      showNotif('Chopped! ✅ Now cook it 🔥', 'success');
      spawnBurst(station.x+station.w/2, station.y, '#42A5F5');
    }
  }
  setTimeout(tick, 50);
}

function startCooking(player, station) {
  player.busy = true;
  Audio.play('cook');
  const dish = DISHES[player.carrying.dishKey];
  const speedMult = 1 + State.upgrades.cook * 0.3;
  const cookMs = Math.max(800, dish.cookTime * 1000 / speedMult);
  const startTime = Date.now();

  function tick() {
    if (!running || paused) { player.busy = false; return; }
    const pct = (Date.now() - startTime) / cookMs;
    if (player.carrying) player.carrying.cookProgress = Math.min(1, pct);

    if (pct < 1) {
      setTimeout(tick, 80);
    } else {
      if (!player.carrying) { player.busy = false; return; }
      player.carrying.cooked = true;
      player.carrying.cookProgress = 1;
      player.busy = false;
      showNotif(`${dish.icon} Cooked! Go serve it! 🪟`, 'gold');
      Audio.play('serve');
      spawnBurst(station.x+station.w/2, station.y, '#FF8F00');

      // Burn timer
      const burnMs = 7000 + State.upgrades.cook * 2000;
      setTimeout(() => {
        if (player.carrying && player.carrying.cooked && !player.carrying.burned) {
          player.carrying.burned = true;
          showNotif('BURNED! 🔥 Trash it!', 'error');
          Audio.play('burn');
        }
      }, burnMs);
    }
  }
  setTimeout(tick, 80);
}

function doServe(player) {
  if (!player.carrying) { showNotif('Nothing to serve!', 'error'); Audio.play('error'); return; }
  if (!player.carrying.cooked) { showNotif('Not cooked yet! Use stove first 🔥', 'error'); Audio.play('error'); return; }
  if (player.carrying.burned) {
    showNotif('Burned! -30pts. Trash it first!', 'error');
    Audio.play('error');
    G.score = Math.max(0, G.score - 30);
    player.carrying = null;
    updateHUD(); return;
  }

  const dishKey = player.carrying.dishKey;
  const orderIdx = G.orders.findIndex(o => o.dishKey === dishKey);

  if (orderIdx === -1) {
    showNotif('No matching order! -20pts', 'error');
    Audio.play('error');
    G.score = Math.max(0, G.score - 20);
    player.carrying = null;
    updateHUD(); return;
  }

  const order = G.orders[orderIdx];
  const dish = DISHES[dishKey];
  const timeFactor = order.timeLeft / order.maxTime;
  const timeBonus = Math.floor(timeFactor * 50);
  const cBonus = G.combo >= 2 ? G.combo * 20 : 0;
  const pts = dish.points + timeBonus + cBonus;

  G.score += pts;
  G.served++;
  G.combo++;
  G.comboTimer = 5;
  G.orders.splice(orderIdx, 1);
  player.carrying = null;

  if (G.combo >= 3) {
    showNotif(`🔥 COMBO x${G.combo}! +${pts}pts`, 'combo');
    Audio.play('combo');
    spawnBurst(W/2, H*0.4, '#FFD700', 24);
  } else {
    showNotif(`${dish.icon} Served! +${pts}pts`, 'success');
    Audio.play('serve');
  }
  spawnBurst(player.x+player.w/2, player.y, '#00E676', 14);
  updateHUD();

  if (G.served >= G.totalOrders) setTimeout(() => endLevel(true), 600);
}

// ─── AI LOGIC ─────────────────────────────────────────────
function updateAI(ai, dt) {
  // Move AI toward its target
  movePlayerToTarget(ai, dt * 1.1);

  ai.aiStepTimer -= dt;
  if (ai.aiStepTimer > 0 || ai.busy) return;

  const atTarget = dist(ai.x, ai.y, ai.targetX, ai.targetY) < 30;

  if (!ai.carrying) {
    const s = G.stations.find(s => s.type === 'ingredient');
    ai.targetX = s.x + s.w/2; ai.targetY = s.y + s.h/2;
    if (atTarget) { interactWithStation(ai, s); ai.aiStepTimer = 0.4 + Math.random()*0.3; }
  } else if (!ai.carrying.chopDone) {
    const s = G.stations.find(s => s.type === 'chop');
    ai.targetX = s.x + s.w/2; ai.targetY = s.y + s.h/2;
    if (atTarget) { interactWithStation(ai, s); ai.aiStepTimer = 0.3; }
  } else if (!ai.carrying.cooked) {
    const s = G.stations.find(s => s.type === 'cook');
    ai.targetX = s.x + s.w/2; ai.targetY = s.y + s.h/2;
    if (atTarget) {
      interactWithStation(ai, s);
      ai.aiStepTimer = DISHES[ai.carrying.dishKey].cookTime * 0.8;
    }
  } else {
    const s = G.stations.find(s => s.type === 'serve');
    ai.targetX = s.x + s.w/2; ai.targetY = s.y + s.h/2;
    if (atTarget) { interactWithStation(ai, s); ai.aiStepTimer = 0.5; }
  }
}

function movePlayerToTarget(player, dt) {
  const dx = player.targetX - (player.x + player.w/2);
  const dy = player.targetY - (player.y + player.h/2);
  const d = Math.sqrt(dx*dx + dy*dy);

  if (d < 4) return; // arrived

  const spd = player.speed * (1 + State.upgrades.speed * 0.15);
  const step = Math.min(d, spd * dt);
  const nx = player.x + (dx/d) * step;
  const ny = player.y + (dy/d) * step;

  // Clamp to arena
  player.x = Math.max(0, Math.min(W - player.w, nx));
  player.y = Math.max(60, Math.min(H - player.h - 60, ny));

  if (dx !== 0) player.facing = dx > 0 ? 1 : -1;
  player.walkAnim += dt * 8;
}

// ─── CLICK TO MOVE ────────────────────────────────────────
function handleCanvasClick(cx, cy) {
  if (!running || paused || !G) return;

  // Check if clicked on a station
  const clickedStation = G.stations.find(s => {
    const margin = 20;
    return cx >= s.x - margin && cx <= s.x + s.w + margin &&
           cy >= s.y - margin && cy <= s.y + s.h + margin;
  });

  if (clickedStation) {
    // Move player to station center then interact
    G.player.targetX = clickedStation.x + clickedStation.w / 2;
    G.player.targetY = clickedStation.y + clickedStation.h / 2;
    G.player.pendingStation = clickedStation;
  } else {
    // Move player to clicked position
    G.player.targetX = cx;
    G.player.targetY = cy - G.player.h/2;
    G.player.pendingStation = null;
  }

  // Visual ripple
  G.player.clickRipple = { x: cx, y: cy, r: 0, life: 1 };
  Audio.play('click');
}

// ─── PARTICLES ────────────────────────────────────────────
function spawnBurst(x, y, color, count=10) {
  for (let i=0; i<count; i++) {
    const angle = (Math.PI*2/count)*i + Math.random()*0.5;
    const spd = 80 + Math.random()*100;
    particles.push({ x, y, vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd-50, r:3+Math.random()*5, life:1, decay:1.0+Math.random()*0.5, color, type:'circle' });
  }
}
function spawnSteam(x, y) {
  particles.push({ x, y, vx:(Math.random()-0.5)*15, vy:-35-Math.random()*30, r:5+Math.random()*7, life:1, decay:0.7, color:'', type:'steam' });
}

// ─── DRAWING ──────────────────────────────────────────────
function drawBg() {
  // Floor
  ctx.fillStyle = '#12192A';
  ctx.fillRect(0, 0, W, H);

  // Wall (top 28%)
  const wallGrad = ctx.createLinearGradient(0, 0, 0, H*0.28);
  wallGrad.addColorStop(0, '#1C3A60');
  wallGrad.addColorStop(1, '#0E1E35');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, W, H*0.28);

  // Floor gradient
  const floorGrad = ctx.createLinearGradient(0, H*0.28, 0, H);
  floorGrad.addColorStop(0, '#1A2540');
  floorGrad.addColorStop(1, '#0D1520');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, H*0.28, W, H*0.72);

  // Tile grid
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#7CB9E8';
  ctx.lineWidth = 1;
  const tile = 56;
  for (let x=0; x<W; x+=tile) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y=0; y<H; y+=tile) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.restore();

  // Ceiling lights
  const lights = [W*0.2, W*0.5, W*0.8];
  lights.forEach(lx => {
    ctx.save();
    const lg = ctx.createRadialGradient(lx, 0, 0, lx, 0, H*0.35);
    lg.addColorStop(0, 'rgba(255,230,160,0.18)');
    lg.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H*0.35);
    ctx.fillStyle = '#FFFDE7';
    ctx.shadowColor = '#FFF9C4'; ctx.shadowBlur = 16;
    ctx.fillRect(lx-18, 0, 36, 5);
    ctx.restore();
  });
}

function drawStation(s) {
  const def = ST[s.type];
  const { x, y, w, h } = s;

  // Drop shadow / 3D base
  ctx.save();
  ctx.fillStyle = shadeColor(def.color, -50);
  ctx.globalAlpha = 0.6;
  roundRect(ctx, x+5, y+7, w, h, 14);
  ctx.fill();
  ctx.restore();

  // Body gradient
  const grad = ctx.createLinearGradient(x, y, x, y+h);
  grad.addColorStop(0, shadeColor(def.color, 35));
  grad.addColorStop(1, def.color);
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();

  // Glow border
  ctx.save();
  ctx.shadowColor = def.border;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = def.border;
  ctx.lineWidth = 2.5;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
  ctx.restore();

  // Shine
  const shine = ctx.createLinearGradient(x, y, x, y+h*0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.22)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  roundRect(ctx, x+2, y+2, w-4, h*0.48, 12);
  ctx.fill();

  // Icon
  const iconSize = Math.min(26, w*0.42);
  ctx.font = `${iconSize}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(def.icon, x+w/2, y+h*0.37);

  // Label
  ctx.font = `bold ${Math.max(8, Math.min(10, w*0.13))}px Nunito, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(def.label, x+w/2, y+h*0.72);

  // Steam from cook/chop
  if ((s.type === 'cook' || s.type === 'chop') && Math.random() < 0.04) {
    spawnSteam(x + w*0.3 + Math.random()*w*0.4, y - 5);
  }

  // Hover hint arrow (always show small arrow at top)
  ctx.font = `bold 11px Nunito, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'center';
  ctx.fillText('▼ TAP', x+w/2, y - 6);
}

function drawPlayer(p) {
  const { x, y, w, h } = p;
  const cx = x + w/2;
  const bob = Math.sin(p.walkAnim) * 3;

  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, y+h+3, w*0.42, 6, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // Chef coat (body)
  const bodyGrad = ctx.createLinearGradient(x, y+16, x, y+h);
  bodyGrad.addColorStop(0, '#FAFAFA');
  bodyGrad.addColorStop(1, '#E0E0E0');
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, x+5, y+16+bob, w-10, h-20, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
  roundRect(ctx, x+5, y+16+bob, w-10, h-20, 10);
  ctx.stroke();

  // Chef hat
  ctx.fillStyle = p.hatColor;
  roundRect(ctx, x+3, y+bob, w-6, 12, 6);
  ctx.fill();
  // Hat brim
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, x+1, y+10+bob, w-2, 6, 3);
  ctx.fill();
  ctx.strokeStyle = p.hatColor; ctx.lineWidth = 1;
  roundRect(ctx, x+1, y+10+bob, w-2, 6, 3);
  ctx.stroke();

  // Face
  ctx.fillStyle = '#2D1B00';
  // Eyes
  ctx.beginPath(); ctx.arc(cx-5*p.facing+2, y+22+bob, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx-5*p.facing+10, y+22+bob, 2.5, 0, Math.PI*2); ctx.fill();
  // Smile
  ctx.beginPath(); ctx.arc(cx-5*p.facing+6, y+27+bob, 4.5, 0.1, Math.PI-0.1);
  ctx.strokeStyle='#2D1B00'; ctx.lineWidth=1.5; ctx.stroke();

  // Apron
  ctx.fillStyle = p.isAI ? '#9C27B0' : '#FF6B2B';
  ctx.globalAlpha = 0.65;
  roundRect(ctx, x+9, y+27+bob, w-18, h-32, 5);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Carrying item display
  if (p.carrying) {
    const dish = DISHES[p.carrying.dishKey];
    const itemColor = p.carrying.burned ? '#888' : p.carrying.cooked ? '#FFD700' : p.carrying.chopDone ? '#FF9800' : '#42A5F5';

    // Glow backdrop
    ctx.save();
    ctx.shadowColor = itemColor; ctx.shadowBlur = 18;
    ctx.font = '24px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(p.carrying.burned ? '💀' : dish.icon, cx, y+bob - 2);
    ctx.restore();

    // Cook progress bar
    if (!p.carrying.cooked && p.carrying.chopDone && p.carrying.cookProgress > 0) {
      const bw = w - 4, bh = 5;
      const bx = x + 2, by = y + bob - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, bx, by, bw, bh, 2); ctx.fill();
      ctx.fillStyle = p.carrying.cookProgress > 0.8 ? '#FFD700' : '#FF6B2B';
      roundRect(ctx, bx, by, bw * p.carrying.cookProgress, bh, 2); ctx.fill();
    }

    // Status badge
    const badge = p.carrying.burned ? '🔥' : p.carrying.cooked ? '✅' : p.carrying.chopDone ? '🍳' : '🔪';
    ctx.font = '12px serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(badge, x+w, y+bob);
  }

  // Busy indicator — spinning dots
  if (p.busy) {
    const t = Date.now() / 200;
    for (let i=0; i<3; i++) {
      const angle = t + i * (Math.PI*2/3);
      const bx = cx + Math.cos(angle)*14;
      const by = y + bob - 28 + Math.sin(angle)*6;
      ctx.fillStyle = i===0?'#FFD700':i===1?'#FF6B2B':'#FF2D78';
      ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, Math.PI*2); ctx.fill();
    }
  }

  // AI badge
  if (p.isAI) {
    ctx.fillStyle = 'rgba(103,58,183,0.85)';
    roundRect(ctx, cx-15, y+bob-26, 30, 14, 7); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = 'bold 8px Nunito,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('AI', cx, y+bob-19);
  }
}

function drawClickRipple(player) {
  const r = player.clickRipple;
  if (!r) return;
  r.r += 120 * (G.dt || 0.016);
  r.life -= 2.5 * (G.dt || 0.016);
  if (r.life <= 0) { player.clickRipple = null; return; }
  ctx.save();
  ctx.globalAlpha = r.life * 0.6;
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawTargetIndicator(player) {
  const dx = player.targetX - (player.x + player.w/2);
  const dy = player.targetY - (player.y + player.h/2);
  const d = Math.sqrt(dx*dx + dy*dy);
  if (d < 20) return;

  // Draw dashed line from player to target
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6,8]);
  ctx.beginPath();
  ctx.moveTo(player.x+player.w/2, player.y+player.h/2);
  ctx.lineTo(player.targetX, player.targetY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Target dot
  ctx.globalAlpha = 0.5 + Math.sin(Date.now()*0.008)*0.3;
  ctx.fillStyle = '#FFD700';
  ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(player.targetX, player.targetY, 5, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(dt) {
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 90 * dt;
    p.life -= p.decay * dt;

    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);

    if (p.type === 'circle') {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.r * p.life), 0, Math.PI*2);
      ctx.fill();
    } else if (p.type === 'steam') {
      ctx.globalAlpha *= 0.5;
      ctx.fillStyle = `rgba(180,210,255,${p.life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + (1-p.life)*12, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ─── GAME LOOP ────────────────────────────────────────────
function gameLoop(timestamp) {
  if (!running) return;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  G.dt = dt;

  if (!paused) update(dt);
  render();

  animFrame = requestAnimationFrame(gameLoop);
}

function update(dt) {
  G.gameTime += dt;
  G.timeLeft -= dt;
  if (G.timeLeft < 0) G.timeLeft = 0;

  // Combo decay
  if (G.combo > 0) {
    G.comboTimer -= dt;
    if (G.comboTimer <= 0) { G.combo = 0; updateHUD(); }
  }

  // Rush mode
  const lvl = LEVELS[G.levelIdx];
  const wasRush = G.rush;
  G.rush = G.timeLeft > 0 && G.timeLeft <= lvl.rushAt;
  if (G.rush && !wasRush) {
    Audio.play('rush');
    showNotif('⚡ RUSH HOUR! Speed up!', 'error');
    document.querySelector('.rush-indicator')?.classList.add('active');
    document.querySelector('.rush-label')?.classList.add('active');
    Audio.startBGMusic(true);
  }

  // Spawn orders
  G.orderTimer -= dt;
  const spawnInterval = G.rush ? Math.max(2.5, 7/lvl.speed) : Math.max(4, 11/lvl.speed);
  if (G.orderTimer <= 0 && G.orders.length < 6 && G.ordersSpawned < G.totalOrders + 4) {
    G.orders.push(createOrder(G.levelIdx));
    G.ordersSpawned++;
    G.orderTimer = spawnInterval;
  }

  // Update orders
  for (let i = G.orders.length-1; i >= 0; i--) {
    const o = G.orders[i];
    o.timeLeft -= dt;
    o.urgent = o.timeLeft < o.maxTime * 0.3;
    if (o.timeLeft <= 0) {
      G.orders.splice(i, 1);
      G.combo = 0;
      G.score = Math.max(0, G.score - 25);
      showNotif('Order expired! -25pts', 'error');
      Audio.play('error');
      updateHUD();
    }
  }

  // Move player toward target
  const prevDist = dist(G.player.x+G.player.w/2, G.player.y+G.player.h/2, G.player.targetX, G.player.targetY);
  movePlayerToTarget(G.player, dt);
  const newDist = dist(G.player.x+G.player.w/2, G.player.y+G.player.h/2, G.player.targetX, G.player.targetY);

  // Auto-interact when arrived at pending station
  if (G.player.pendingStation && newDist < 32 && !G.player.busy) {
    const station = G.player.pendingStation;
    G.player.pendingStation = null;
    interactWithStation(G.player, station);
  }

  // AI
  if (G.ai) updateAI(G.ai, dt);

  // HUD throttle
  if (Math.floor(G.gameTime * 2) !== Math.floor((G.gameTime - dt) * 2)) updateHUD();

  // Time up
  if (G.timeLeft <= 0) {
    const success = G.served >= Math.ceil(G.totalOrders * 0.6);
    endLevel(success);
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawBg();
  for (const s of G.stations) drawStation(s);
  drawTargetIndicator(G.player);
  drawClickRipple(G.player);
  if (G.ai) drawPlayer(G.ai);
  drawPlayer(G.player);
  drawParticles(G.dt || 0.016);
}

// ─── HUD ──────────────────────────────────────────────────
function updateHUD() {
  if (!G) return;
  const t = Math.max(0, Math.ceil(G.timeLeft));
  const timerEl = document.querySelector('.timer-value');
  if (timerEl) {
    timerEl.textContent = `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
    timerEl.classList.toggle('urgent', G.timeLeft <= 15);
  }
  const scoreEl = document.querySelector('.score-value');
  if (scoreEl) scoreEl.textContent = G.score.toLocaleString();
  const comboEl = document.querySelector('.combo-value');
  if (comboEl) comboEl.textContent = `x${G.combo}`;
  document.querySelector('.hud-combo')?.classList.toggle('combo-active', G.combo >= 3);
  document.querySelector('.level-banner').textContent = `Lv ${G.levelIdx+1}: ${LEVELS[G.levelIdx].name}`;
  renderOrders();
}

function renderOrders() {
  const panel = document.querySelector('.orders-panel');
  if (!panel) return;
  const existing = {};
  panel.querySelectorAll('.order-ticket').forEach(el => existing[el.dataset.id] = el);
  const newIds = new Set(G.orders.map(o => String(o.id)));
  Object.keys(existing).forEach(id => { if (!newIds.has(id)) existing[id].remove(); });

  for (const o of G.orders) {
    let el = existing[String(o.id)];
    if (!el) {
      el = document.createElement('div');
      el.className = 'order-ticket';
      el.dataset.id = String(o.id);
      el.style.setProperty('--ticket-color', DISHES[o.dishKey].color);
      el.innerHTML = `<span class="order-dish-icon">${o.dish.icon}</span><span class="order-dish-name">${o.dish.name}</span><div class="order-time-bar"><div class="order-time-fill"></div></div>`;
      panel.appendChild(el);
    }
    const pct = Math.max(0, (o.timeLeft/o.maxTime)*100);
    const fill = el.querySelector('.order-time-fill');
    if (fill) {
      fill.style.width = pct + '%';
      fill.style.background = pct > 50 ? DISHES[o.dishKey].color : pct > 25 ? '#FF9800' : '#FF1744';
    }
    el.classList.toggle('urgent', o.urgent);
  }
}

// ─── START / END LEVEL ────────────────────────────────────
function startLevel(levelIdx) {
  particles = [];
  resizeCanvas();

  G = {
    levelIdx,
    score: 0, served: 0, combo: 0, comboTimer: 0,
    orders: [], ordersSpawned: 0,
    totalOrders: LEVELS[levelIdx].orders,
    timeLeft: LEVELS[levelIdx].time,
    orderTimer: 2.5,
    rush: false, gameTime: 0, dt: 0.016,
    player: null, ai: null, stations: null,
  };

  G.stations = buildLayout();
  // Spawn player in center
  G.player = createPlayer(W*0.5 - 19, H*0.4);
  // AI from level 5+
  if (levelIdx >= 4) {
    G.ai = createPlayer(W*0.5 + 40, H*0.45, true);
  }

  running = true; paused = false;

  canvas.classList.add('active');
  document.getElementById('gameHUD').classList.add('active');
  document.querySelector('.rush-indicator')?.classList.remove('active');
  document.querySelector('.rush-label')?.classList.remove('active');

  updateHUD();
  Audio.startBGMusic(false);

  lastTime = performance.now();
  animFrame = requestAnimationFrame(gameLoop);
}

function endLevel(success) {
  if (!running) return;
  running = false;
  paused = false;
  cancelAnimationFrame(animFrame);
  Audio.stopBGMusic();
  document.querySelector('.rush-indicator')?.classList.remove('active');
  document.querySelector('.rush-label')?.classList.remove('active');

  const threshold3 = LEVELS[G.levelIdx].orders * 185;
  const threshold2 = LEVELS[G.levelIdx].orders * 110;
  const stars = !success ? 0 : G.score >= threshold3 ? 3 : G.score >= threshold2 ? 2 : 1;

  if (success && G.levelIdx + 2 <= LEVELS.length) {
    State.unlockedLevel = Math.max(State.unlockedLevel, G.levelIdx + 2);
  }
  State.levelStars[G.levelIdx+1] = Math.max(State.levelStars[G.levelIdx+1]||0, stars);
  State.totalScore += G.score;
  State.upgradePoints += Math.floor(G.score / 180);
  State.save();

  if (success) Audio.play('levelUp');
  else Audio.play('error');

  showResultScreen(success, stars, G.score, G.served, G.totalOrders);
}

function stopGame() {
  running = false; paused = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  Audio.stopBGMusic();
  canvas.classList.remove('active');
  document.getElementById('gameHUD').classList.remove('active');
  document.querySelector('.rush-indicator')?.classList.remove('active');
  document.querySelector('.rush-label')?.classList.remove('active');
  G = null;
}

function togglePause() {
  if (!running && !paused) return;
  paused = !paused;
  if (paused) Audio.stopBGMusic();
  else { Audio.startBGMusic(G?.rush); lastTime = performance.now(); animFrame = requestAnimationFrame(gameLoop); }
}

// ─── RESULT SCREEN ────────────────────────────────────────
function showResultScreen(success, stars, score, served, total) {
  const screen = document.getElementById('resultOverlay');
  screen.classList.add('active');
  screen.querySelector('.result-title').textContent = success ? '🎉 Level Clear!' : '💀 Time\'s Up!';
  screen.querySelector('.result-title').style.color = success ? '#00E676' : '#FF1744';
  screen.querySelector('.result-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3-stars);
  document.getElementById('res-score').textContent = score.toLocaleString();
  document.getElementById('res-served').textContent = `${served}/${total}`;
  document.getElementById('res-pts').textContent = `+${State.upgradePoints}`;
}

// ─── NOTIFICATIONS ────────────────────────────────────────
const notifQueue = [];
function showNotif(text, type='success') {
  const container = document.querySelector('.notif-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `notif ${type}`;
  el.textContent = text;
  container.appendChild(el);
  notifQueue.push(el);
  if (notifQueue.length > 4) { notifQueue[0].remove(); notifQueue.shift(); }
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => { el.remove(); const i=notifQueue.indexOf(el); if(i>-1) notifQueue.splice(i,1); }, 350);
  }, 2200);
}

// ─── UPGRADES ─────────────────────────────────────────────
const UPGRADES = [
  { key:'speed', name:'Speed Boost',  desc:'Move faster + chop faster',  icon:'⚡', maxLevel:5, baseCost:3 },
  { key:'cook',  name:'Pro Stove',    desc:'Cook faster, burn slower',    icon:'🔥', maxLevel:5, baseCost:4 },
  { key:'capacity', name:'Big Bag',   desc:'More time per order',         icon:'🎒', maxLevel:5, baseCost:3 },
];

function renderUpgradePanel() {
  const list = document.getElementById('upgradeList');
  if (!list) return;
  list.innerHTML = '';
  UPGRADES.forEach(u => {
    const lvl = State.upgrades[u.key];
    const cost = u.baseCost + lvl*2;
    const maxed = lvl >= u.maxLevel;
    const canAfford = State.upgradePoints >= cost;
    const item = document.createElement('div');
    item.className = 'upgrade-item';
    item.innerHTML = `
      <span class="upgrade-icon">${u.icon}</span>
      <div class="upgrade-info">
        <div class="upgrade-name">${u.name} Lv${lvl}/${u.maxLevel}</div>
        <div class="upgrade-desc">${u.desc}</div>
      </div>
      <span class="upgrade-cost">${maxed ? 'MAX' : (canAfford?'✅':'❌')+' '+cost+'pts'}</span>
    `;
    if (!maxed && canAfford) {
      item.addEventListener('click', () => {
        State.upgrades[u.key]++; State.upgradePoints -= cost; State.save();
        showNotif(`${u.icon} ${u.name} upgraded!`, 'gold');
        renderUpgradePanel();
        document.getElementById('upgPtsDisplay').textContent = `${State.upgradePoints} pts`;
      });
    }
    list.appendChild(item);
  });
}

function renderSideUpgrades() {
  const list = document.getElementById('sideUpgradeList');
  if (!list) return;
  list.innerHTML = '';
  UPGRADES.forEach(u => {
    const lvl = State.upgrades[u.key];
    const cost = u.baseCost + lvl*2;
    const maxed = lvl >= u.maxLevel;
    const canAfford = State.upgradePoints >= cost;
    const item = document.createElement('div');
    item.className = 'upgrade-item';
    item.innerHTML = `<span class="upgrade-icon">${u.icon}</span><div class="upgrade-info"><div class="upgrade-name">${u.name} Lv${lvl}</div><div class="upgrade-desc">${u.desc}</div></div><span class="upgrade-cost" style="font-size:0.72rem">${maxed?'MAX':cost+'p'}</span>`;
    if (!maxed && canAfford) item.addEventListener('click', () => { State.upgrades[u.key]++; State.upgradePoints-=cost; State.save(); showNotif(`${u.icon} Upgraded!`, 'gold'); renderSideUpgrades(); });
    list.appendChild(item);
  });
}

// ─── LEVEL SELECT ─────────────────────────────────────────
function renderLevelSelect() {
  const grid = document.getElementById('levelsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  LEVELS.forEach((lvl, i) => {
    const unlocked = i+1 <= State.unlockedLevel;
    const stars = State.levelStars[i+1] || 0;
    const card = document.createElement('div');
    card.className = `level-card ${unlocked?'':'locked'} ${stars>0?'complete':''}`;
    const diffColor = i<3?'#00E676':i<7?'#FFD700':i<15?'#FF9800':i<25?'#FF5722':'#FF1744';
    if (unlocked) {
      card.innerHTML = `<span class="level-num" style="color:${diffColor}">${i+1}</span><span class="level-name">${lvl.name}</span><div class="level-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>`;
      card.addEventListener('click', () => {
        Audio.resume(); Audio.play('pickup');
        State.currentLevel = i+1;
        Screens.hide('levelSelect');
        startLevel(i);
      });
    } else {
      card.innerHTML = `<div class="level-lock">🔒</div><span class="level-name">${lvl.name}</span>`;
    }
    grid.appendChild(card);
  });
  const upgEl = document.getElementById('upgPtsDisplay');
  if (upgEl) upgEl.textContent = `${State.upgradePoints} pts available`;
}

// ─── SCREENS ──────────────────────────────────────────────
const Screens = {
  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  },
  hide(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }
};

// ─── LOADING ──────────────────────────────────────────────
function runLoadingScreen(cb) {
  const bar = document.querySelector('.loading-bar');
  const txt = document.querySelector('.loading-text');
  const steps = ['Heating the kitchen...','Slicing ingredients...','Loading recipes...','Firing up stoves...','Ready to cook!'];
  let pct = 0, stepIdx = 0;
  const iv = setInterval(() => {
    pct = Math.min(100, pct + 5 + Math.random()*12);
    if (bar) bar.style.width = pct + '%';
    if (stepIdx < steps.length && pct > stepIdx*22) { if(txt) txt.textContent = steps[stepIdx++]; }
    if (pct >= 100) { clearInterval(iv); setTimeout(cb, 500); }
  }, 80);
}

function updateSoundBtn() {
  const btn = document.getElementById('soundBtn');
  if (btn) btn.textContent = Audio.isEnabled() ? '🔊' : '🔇';
}

// ─── MAIN INIT ────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); if(G) G.stations = buildLayout(); });

  // ── Canvas input: click + touch ──
  function handleInput(e) {
    e.preventDefault();
    Audio.resume();
    let cx, cy;
    if (e.touches) {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    handleCanvasClick(cx, cy);
  }
  canvas.addEventListener('click', handleInput, { passive:false });
  canvas.addEventListener('touchstart', handleInput, { passive:false });

  // ── Keyboard ──
  window.addEventListener('keydown', e => {
    Audio.resume();
    if ((e.code==='KeyE'||e.code==='Space') && running && !paused && G) {
      e.preventDefault();
      // Interact with nearest station
      const player = G.player;
      const nearest = G.stations.reduce((best, s) => {
        const d = dist(player.x+player.w/2, player.y+player.h/2, s.x+s.w/2, s.y+s.h/2);
        return (!best || d < best.d) ? {s, d} : best;
      }, null);
      if (nearest && nearest.d < 100) interactWithStation(player, nearest.s);
    }
    if (e.code==='KeyF' && running && !paused && G) {
      e.preventDefault();
      const serveStation = G.stations.find(s => s.type==='serve');
      if (serveStation) interactWithStation(G.player, serveStation);
    }
    if (e.code==='Escape') {
      if (running || paused) {
        togglePause();
        document.getElementById('pauseScreen')?.classList.toggle('active', paused);
      }
    }
  });

  // ── Loading ──
  runLoadingScreen(() => {
    document.getElementById('loadingScreen').classList.add('hidden');
    Screens.show('mainMenu');
    Audio.startBGMusic(false);
  });

  // ── Main Menu ──
  document.getElementById('btnPlay')?.addEventListener('click', () => { Audio.resume(); Audio.play('pickup'); renderLevelSelect(); Screens.show('levelSelect'); });
  document.getElementById('btnTutorial')?.addEventListener('click', () => { Audio.resume(); Screens.show('tutorialScreen'); });
  document.getElementById('btnUpgrades')?.addEventListener('click', () => { renderUpgradePanel(); Screens.show('upgradeScreen'); });

  // ── Tutorial ──
  document.getElementById('btnTutStart')?.addEventListener('click', () => { Audio.play('pickup'); renderLevelSelect(); Screens.show('levelSelect'); });
  document.getElementById('btnTutSkip')?.addEventListener('click', () => { Audio.play('error'); Screens.show('mainMenu'); });

  // ── Level Select ──
  document.getElementById('btnBackLvl')?.addEventListener('click', () => { Audio.play('error'); Screens.show('mainMenu'); });

  // ── HUD ──
  document.getElementById('soundBtn')?.addEventListener('click', () => { const on=Audio.toggle(); updateSoundBtn(); if(on) Audio.startBGMusic(G?.rush||false); });
  document.getElementById('upgradeToggle')?.addEventListener('click', () => { document.getElementById('sideUpgradePanel')?.classList.toggle('open'); renderSideUpgrades(); });
  document.getElementById('pauseBtn')?.addEventListener('click', () => { Audio.resume(); togglePause(); document.getElementById('pauseScreen')?.classList.toggle('active', paused); });
  document.getElementById('homeBtn')?.addEventListener('click', () => { stopGame(); document.getElementById('pauseScreen')?.classList.remove('active'); Audio.startBGMusic(false); Screens.show('mainMenu'); });

  // ── Pause ──
  document.getElementById('btnResumeGame')?.addEventListener('click', () => { togglePause(); document.getElementById('pauseScreen')?.classList.remove('active'); });
  document.getElementById('btnRestartPause')?.addEventListener('click', () => { document.getElementById('pauseScreen')?.classList.remove('active'); stopGame(); startLevel(State.currentLevel-1); });
  document.getElementById('btnHomePause')?.addEventListener('click', () => { stopGame(); document.getElementById('pauseScreen')?.classList.remove('active'); Audio.startBGMusic(false); Screens.show('mainMenu'); });

  // ── Result ──
  document.getElementById('btnNextLevel')?.addEventListener('click', () => {
    document.getElementById('resultOverlay')?.classList.remove('active');
    const next = State.currentLevel;
    if (next <= LEVELS.length && next <= State.unlockedLevel) { State.currentLevel = next; startLevel(next-1); }
    else { stopGame(); renderLevelSelect(); Screens.show('levelSelect'); }
  });
  document.getElementById('btnRetryLevel')?.addEventListener('click', () => { document.getElementById('resultOverlay')?.classList.remove('active'); startLevel(State.currentLevel-1); });
  document.getElementById('btnHomeLvl')?.addEventListener('click', () => { document.getElementById('resultOverlay')?.classList.remove('active'); stopGame(); Audio.startBGMusic(false); renderLevelSelect(); Screens.show('levelSelect'); });

  // ── Upgrade Screen ──
  document.getElementById('btnBackUpg')?.addEventListener('click', () => { Screens.show('mainMenu'); });

  // Quick Serve mobile button
  document.getElementById('quickServeBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    Audio.resume();
    if (running && !paused && G) {
      const serveStation = G.stations.find(s => s.type === 'serve');
      if (serveStation) {
        G.player.targetX = serveStation.x + serveStation.w/2;
        G.player.targetY = serveStation.y + serveStation.h/2;
        G.player.pendingStation = serveStation;
        Audio.play('click');
      }
    }
  });
  document.getElementById('quickServeBtn')?.addEventListener('touchstart', (e) => {
    e.preventDefault(); e.stopPropagation();
    Audio.resume();
    if (running && !paused && G) {
      const serveStation = G.stations.find(s => s.type === 'serve');
      if (serveStation) {
        G.player.targetX = serveStation.x + serveStation.w/2;
        G.player.targetY = serveStation.y + serveStation.h/2;
        G.player.pendingStation = serveStation;
        Audio.play('click');
      }
    }
  }, { passive:false });

  updateSoundBtn();
});
