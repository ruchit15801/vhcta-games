// ═══════════════════════════════════════════════════════════════
//   RHYTHM BEAT RUNNER — COMPLETE GAME ENGINE
//   Beat-synced, fully polished, 20 levels, premium visuals
// ═══════════════════════════════════════════════════════════════
'use strict';

// ── CANVAS SETUP ──────────────────────────────────────────────
const CV  = document.getElementById('gameCanvas');
const ctx = CV.getContext('2d');
let W, H, DPR = Math.min(window.devicePixelRatio || 1, 2);

function resizeCanvas() {
  W  = window.innerWidth;
  H  = window.innerHeight;
  CV.style.width  = W + 'px';
  CV.style.height = H + 'px';
  CV.width  = Math.floor(W  * DPR);
  CV.height = Math.floor(H * DPR);
  ctx.scale(DPR, DPR);
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); if (GS !== 'play') drawIdle(); });

// ── AUDIO ENGINE ──────────────────────────────────────────────
let AC = null;
function initAudio() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); }

function beep(freq, type='square', dur=0.06, vol=0.12, delay=0) {
  if (!AC || !soundOn) return;
  const osc = AC.createOscillator(), gain = AC.createGain();
  osc.connect(gain); gain.connect(AC.destination);
  osc.type = type; osc.frequency.value = freq;
  const t = AC.currentTime + delay;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.start(t); osc.stop(t + dur + 0.05);
}

let musicNode = null, musicGain = null, bgBeat = null;

function startBgMusic(bpm, trackIdx) {
  stopBgMusic();
  if (!AC || !soundOn) return;
  musicGain = AC.createGain();
  musicGain.gain.value = 0.4;
  musicGain.connect(AC.destination);
  const beatSec = 60 / bpm;
  const TRACKS = [
    () => { // Track 0: CYBER PULSE
      scheduleBeat(beatSec, () => {
        beep(110, 'sawtooth', 0.08, 0.3);
        beep(220, 'square', 0.04, 0.15);
      });
    },
    () => { // Track 1: NEON DRIVE
      scheduleBeat(beatSec, () => { beep(165, 'square', 0.1, 0.28); });
      scheduleBeat(beatSec, () => { beep(330, 'sine', 0.06, 0.2); }, beatSec/2);
    },
    () => { // Track 2: GALACTIC RUSH
      scheduleBeat(beatSec, () => { beep(80, 'sawtooth', 0.12, 0.35); beep(160,'square',0.04,0.15); });
    },
    () => { // Track 3: STORM BREAK
      scheduleBeat(beatSec, () => { beep(55,'sawtooth',0.15,0.4); beep(440,'square',0.03,0.1); });
    },
    () => { // Track 4: VOID RUNNER
      scheduleBeat(beatSec, () => { beep(100,'sawtooth',0.08,0.3); beep(200,'square',0.05,0.18); beep(400,'sine',0.04,0.12); });
    }
  ];
  if (TRACKS[trackIdx]) TRACKS[trackIdx % TRACKS.length]();
}
function scheduleBeat(interval, fn, offset=0) {
  function tick() {
    if (GS !== 'play') return;
    fn();
    bgBeat = setTimeout(tick, interval * 1000);
  }
  bgBeat = setTimeout(tick, offset * 1000);
}
function stopBgMusic() { if (bgBeat) clearTimeout(bgBeat); }

const SFX = {
  jump:   () => { beep(440,'sine',0.08,0.15); beep(660,'sine',0.06,0.1,0.04); },
  land:   () => beep(180,'sine',0.05,0.1),
  hit:    () => { [200,150,100].forEach((f,i)=>beep(f,'sawtooth',0.15,0.35,i*0.04)); },
  perfect:() => { [880,1108,1318].forEach((f,i)=>beep(f,'sine',0.08,0.2,i*0.05)); },
  good:   () => beep(660,'sine',0.08,0.18),
  miss:   () => beep(220,'sawtooth',0.08,0.15),
  checkpoint: () => { [440,550,660,880].forEach((f,i)=>beep(f,'sine',0.12,0.25,i*0.06)); },
  levelUp:    () => { [440,554,659,880,1108].forEach((f,i)=>beep(f,'sine',0.14,0.28,i*0.07)); },
  menu:       () => beep(660,'sine',0.06,0.12),
  death: () => { [440,330,220,110].forEach((f,i)=>beep(f,'sawtooth',0.18,0.3,i*0.06)); },
};

// ── STATE ─────────────────────────────────────────────────────
let GS = 'splash'; // splash|guide|trackselect|levelselect|play|pause|result
let soundOn = true;
let selectedTrack = 0;
let currentLevel  = 0;
let levelData = { score:0, combo:0, maxCombo:0, perfect:0, good:0, miss:0, deaths:0 };
let beatCount = 0, lastBeatTime = 0;
let saveData = {};

function loadSave() {
  try { saveData = JSON.parse(localStorage.getItem('rbr_save') || '{}'); }
  catch(e) { saveData = {}; }
}
function writeSave() { localStorage.setItem('rbr_save', JSON.stringify(saveData)); }
loadSave();

// ── LEVEL DEFINITIONS (20 levels) ────────────────────────────
const LEVEL_DEFS = [
  // Lv 1-3 SLOW & SIMPLE
  { id:1,  name:'NEON DAWN',      bpm:80,  spd:4.5, track:0, color:'#00f5ff', patternKey:'easy1',   cp:[0.4,0.75], starScore:[200,400,600] },
  { id:2,  name:'CYBER STEP',     bpm:90,  spd:5.0, track:0, color:'#00ff88', patternKey:'easy2',   cp:[0.4,0.75], starScore:[250,500,750] },
  { id:3,  name:'GRID WALK',      bpm:95,  spd:5.5, track:1, color:'#ff00ff', patternKey:'easy3',   cp:[0.35,0.7], starScore:[300,600,900] },
  // Lv 4-7 MEDIUM RHYTHM
  { id:4,  name:'PULSE RISE',     bpm:100, spd:6.0, track:1, color:'#ffff00', patternKey:'mid1',    cp:[0.33,0.66], starScore:[400,800,1200] },
  { id:5,  name:'BEAT SURGE',     bpm:110, spd:6.5, track:1, color:'#ff6600', patternKey:'mid2',    cp:[0.33,0.66], starScore:[500,1000,1500] },
  { id:6,  name:'RHYTHM STORM',   bpm:115, spd:7.0, track:2, color:'#00f5ff', patternKey:'mid3',    cp:[0.33,0.66], starScore:[600,1200,1800] },
  { id:7,  name:'WAVE BREAK',     bpm:120, spd:7.5, track:2, color:'#bf00ff', patternKey:'mid4',    cp:[0.33,0.66], starScore:[700,1400,2100] },
  // Lv 8-12 FAST & COMPLEX
  { id:8,  name:'HYPER DASH',     bpm:128, spd:8.0, track:2, color:'#ff0055', patternKey:'hard1',   cp:[0.33,0.66], starScore:[800,1600,2400] },
  { id:9,  name:'APEX THUNDER',   bpm:130, spd:8.5, track:3, color:'#00f5ff', patternKey:'hard2',   cp:[0.33,0.66], starScore:[900,1800,2700] },
  { id:10, name:'VOID SHIFT',     bpm:135, spd:9.0, track:3, color:'#ffff00', patternKey:'hard3',   cp:[0.33,0.66], starScore:[1000,2000,3000] },
  { id:11, name:'CHAOS DRIVE',    bpm:140, spd:9.5, track:3, color:'#ff6600', patternKey:'hard4',   cp:[0.3,0.6,0.85], starScore:[1100,2200,3300] },
  { id:12, name:'NEON FURY',      bpm:145, spd:10,  track:4, color:'#ff00ff', patternKey:'hard5',   cp:[0.3,0.6,0.85], starScore:[1200,2400,3600] },
  // Lv 13-17 EXTREME
  { id:13, name:'DEATH MARCH',    bpm:150, spd:10.5,track:4, color:'#ff0055', patternKey:'extreme1',cp:[0.3,0.6,0.85], starScore:[1500,3000,4500] },
  { id:14, name:'BLACKOUT',       bpm:155, spd:11,  track:4, color:'#bf00ff', patternKey:'extreme2',cp:[0.3,0.6,0.85], starScore:[1700,3400,5100] },
  { id:15, name:'SONIC BLAST',    bpm:160, spd:11.5,track:4, color:'#00f5ff', patternKey:'extreme3',cp:[0.25,0.5,0.75], starScore:[2000,4000,6000] },
  { id:16, name:'OVERDRIVE',      bpm:165, spd:12,  track:4, color:'#ffff00', patternKey:'extreme4',cp:[0.25,0.5,0.75], starScore:[2200,4400,6600] },
  { id:17, name:'SHOCKWAVE',      bpm:170, spd:12.5,track:4, color:'#ff6600', patternKey:'extreme5',cp:[0.25,0.5,0.75], starScore:[2500,5000,7500] },
  // Lv 18-20 MASTER
  { id:18, name:'SINGULARITY',    bpm:175, spd:13,  track:4, color:'#ff0055', patternKey:'master1', cp:[0.25,0.5,0.75], starScore:[3000,6000,9000] },
  { id:19, name:'OMEGA PULSE',    bpm:180, spd:13.5,track:4, color:'#bf00ff', patternKey:'master2', cp:[0.25,0.5,0.75], starScore:[3500,7000,10500] },
  { id:20, name:'THE VOID',       bpm:185, spd:14,  track:4, color:'#00f5ff', patternKey:'master3', cp:[0.2,0.4,0.6,0.8], starScore:[4000,8000,12000] },
];

// ── TRACK DEFINITIONS ─────────────────────────────────────────
const TRACKS = [
  { name:'CYBER PULSE',    bpm:80,  icon:'🎵', desc:'120 BPM • Electronic • Beginner' },
  { name:'NEON DRIVE',     bpm:110, icon:'⚡', desc:'140 BPM • Synth • Intermediate' },
  { name:'GALACTIC RUSH',  bpm:128, icon:'🌌', desc:'158 BPM • Cosmic • Advanced' },
  { name:'STORM BREAK',    bpm:150, icon:'⛈', desc:'175 BPM • Hardcore • Expert' },
  { name:'VOID RUNNER',    bpm:175, icon:'🔮', desc:'200 BPM • Chaos • Master' },
];

// ── OBSTACLE PATTERNS ─────────────────────────────────────────
// Each pattern is an array of beat positions (0-1 normalized) with types
// Types: S=spike, W=wall, G=gap, D=double, H=high obstacle
function makePattern(key) {
  const P = {
    easy1:    makeSeq(48, 0.8, ['S','S','_','S','_','_','S','S']),
    easy2:    makeSeq(56, 0.8, ['S','_','S','S','_','S','_','S','_','S']),
    easy3:    makeSeq(60, 0.75,['S','S','_','W','_','S','S','_','S','_']),
    mid1:     makeSeq(64, 0.7, ['S','S','W','_','S','S','_','D','_','S']),
    mid2:     makeSeq(72, 0.7, ['D','_','S','S','W','_','S','D','S','_']),
    mid3:     makeSeq(80, 0.7, ['S','D','S','W','_','S','S','D','_','S','W']),
    mid4:     makeSeq(88, 0.65,['D','S','W','D','S','S','_','W','D','S','S']),
    hard1:    makeSeq(96, 0.65,['S','D','S','W','D','S','W','S','D','D','S','W']),
    hard2:    makeSeq(100,0.6, ['D','W','S','D','S','W','D','D','S','W','S','D']),
    hard3:    makeSeq(108,0.6, ['S','S','D','W','D','S','S','W','D','D','W','S','S']),
    hard4:    makeSeq(112,0.58,['D','D','W','S','D','W','D','S','D','W','D','D','S']),
    hard5:    makeSeq(120,0.55,['D','W','D','D','S','W','S','D','D','W','D','S','D','W']),
    extreme1: makeSeq(128,0.55,['D','D','W','D','D','W','S','D','W','D','D','W','D','S']),
    extreme2: makeSeq(136,0.52,['D','W','D','D','W','D','W','D','D','S','D','W','D','D','W']),
    extreme3: makeSeq(144,0.5, ['D','D','W','D','W','D','D','W','D','D','W','D','W','D','D','W']),
    extreme4: makeSeq(150,0.5, ['W','D','D','W','D','D','W','D','W','D','D','W','D','D','W','D']),
    extreme5: makeSeq(156,0.48,['D','D','W','D','W','D','D','W','D','D','W','D','D','W','D','W','D']),
    master1:  makeSeq(160,0.48,['D','W','D','D','W','D','D','W','D','W','D','D','W','D','D','W','D','D']),
    master2:  makeSeq(168,0.46,['D','D','W','D','W','D','D','W','D','D','W','D','D','W','D','W','D','D','W']),
    master3:  makeSeq(176,0.45,['W','D','D','W','D','D','W','D','D','W','D','D','W','D','D','W','D','D','W','D']),
  };
  return P[key] || P['easy1'];
}
function makeSeq(count, density, types) {
  const seq = [];
  let lastPos = 0.04;
  const gap = 1 / count;
  for (let i = 0; i < count; i++) {
    if (Math.random() > density && types.length > 0) { lastPos += gap; continue; }
    const t = types[i % types.length];
    if (t !== '_') seq.push({ pos: Math.min(lastPos + gap * 0.1, 0.98), type: t });
    lastPos += gap;
  }
  return seq;
}

// ── PLAYER ─────────────────────────────────────────────────────
const PLAYER = {
  x: 0, y: 0, w: 0, h: 0,
  vy: 0, onGround: false, canDoubleJump: true,
  jumpCooldown: 0, color: '#00f5ff',
  animT: 0, trail: [],
  shineT: 0, jumpPressed: false,
};

const GRAVITY = 0.55;
const JUMP_V  = -14.5;
const DOUBLE_JUMP_V = -13;

// ── GAME WORLD ─────────────────────────────────────────────────
let world = {
  progress: 0,      // 0-1 normalized
  speed: 5,         // pixels/frame
  obstacles: [],    // { x, type, w, h, color, hit, animT }
  collectibles: [], // { x, y, r, collected }
  particles: [],
  bgStars: [],
  bgLayers: [],     // parallax layers
  groundY: 0,
  levelLen: 0,      // total pixels
  checkpoint: [],   // [pixelPos] where CPs are
  checkpointPassed: [],
  beatPhase: 0,     // 0-1 within one beat cycle
  beatT: 0,         // raw beat timer
  bgHue: 0,
  bgHueTarget: 0,
  camShake: 0,
};

let frame = 0;
let spawnedCheckpoints = new Set();

// ── OBSTACLE BUILDERS ─────────────────────────────────────────
const OBJ_COLORS = {
  S: '#ff0055', W: '#ff6600', D: '#ff00ff', G: '#bf00ff', H: '#ffff00'
};

function buildObstacles(pattern, levelLen, floorH) {
  const obsList = [];
  pattern.forEach(p => {
    const x = p.pos * levelLen;
    const type = p.type;
    const col = OBJ_COLORS[type] || '#ff0055';
    const pW = floorH;
    const pH = pW * 0.85;
    switch (type) {
      case 'S': // Ground spike
        obsList.push({ x, type:'spike', w: pW*0.6, h: pH*0.7, y: world.groundY - pH*0.7, color: col, hit: false, animT: 0 });
        break;
      case 'W': // Tall wall (jump over)
        obsList.push({ x, type:'wall', w: pW*0.45, h: pH*1.3, y: world.groundY - pH*1.3, color: col, hit: false, animT: 0 });
        break;
      case 'D': // Double spike
        obsList.push({ x, type:'spike', w: pW*0.55, h: pH*0.65, y: world.groundY - pH*0.65, color: col, hit: false, animT: 0 });
        obsList.push({ x: x + pW*0.75, type:'spike', w: pW*0.55, h: pH*0.65, y: world.groundY - pH*0.65, color: col, hit: false, animT: 0 });
        break;
      case 'H': // High obstacle (must slide or double-jump)
        obsList.push({ x, type:'wall', w: pW*0.45, h: pH*0.7, y: world.groundY - pH*1.6, color: col, hit: false, animT: 0 });
        break;
    }
  });
  return obsList;
}

// ── INIT GAME ─────────────────────────────────────────────────
function initGame(lvIdx) {
  currentLevel = lvIdx;
  const lv = LEVEL_DEFS[lvIdx];
  levelData = { score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, deaths: 0 };
  beatCount = 0; lastBeatTime = 0;
  frame = 0; spawnedCheckpoints = new Set();

  world.groundY  = H * 0.75;
  world.levelLen = W * 25;  // full level length in pixels
  world.speed    = lv.spd;
  world.progress = 0;
  world.particles = [];
  world.beatPhase = 0; world.beatT = 0;
  world.bgHue = 0; world.bgHueTarget = 0;
  world.camShake = 0;
  world.checkpoint = lv.cp.map(f => f * world.levelLen);
  world.checkpointPassed = lv.cp.map(() => false);

  // Player
  const pH = H * 0.09;
  const pW = pH * 0.75;
  PLAYER.x = W * 0.18;
  PLAYER.y = world.groundY - pH;
  PLAYER.w = pW; PLAYER.h = pH;
  PLAYER.vy = 0; PLAYER.onGround = true; PLAYER.canDoubleJump = true;
  PLAYER.jumpCooldown = 0; PLAYER.animT = 0; PLAYER.trail = [];
  PLAYER.color = lv.color;

  // Generate obstacles
  const pattern = makePattern(lv.patternKey);
  world.obstacles = buildObstacles(pattern, world.levelLen, H * 0.08);

  // Background stars
  world.bgStars = Array.from({ length: 80 }, () => ({
    x: Math.random() * W * 2, y: Math.random() * H * 0.7,
    r: Math.random() * 2.5 + 0.5, spd: Math.random() * 0.5 + 0.2,
    twinkle: Math.random() * Math.PI * 2,
  }));

  // Parallax bg layers
  world.bgLayers = [
    { items: Array.from({length:12},()=>({x:Math.random()*W*3,y:H*0.1+Math.random()*H*0.4,w:Math.random()*80+30,h:Math.random()*60+20})), spd:0.1, col:'rgba(0,245,255,0.04)' },
    { items: Array.from({length:8}, ()=>({x:Math.random()*W*3,y:H*0.05+Math.random()*H*0.5,w:Math.random()*60+20,h:Math.random()*80+30})), spd:0.25,col:'rgba(255,0,255,0.04)' },
  ];

  updateHUDProgress();
  updateBeatDots(0);
}

// ── PHYSICS & GAME UPDATE ─────────────────────────────────────
function updateGame() {
  if (GS !== 'play') return;
  frame++;

  const lv = LEVEL_DEFS[currentLevel];
  const bpm = lv.bpm;
  const beatSec = 60 / bpm;
  const frameSec = 1 / 60;

  // Beat tracking
  world.beatT += frameSec;
  world.beatPhase = (world.beatT % beatSec) / beatSec;
  if (world.beatT - lastBeatTime >= beatSec) {
    lastBeatTime = world.beatT;
    beatCount++;
    onBeat();
  }

  // Camera shake decay
  world.camShake *= 0.85;

  // Scroll world
  world.progress += world.speed / world.levelLen;
  const scrollX = world.progress * world.levelLen;

  // Player jump physics
  if (PLAYER.jumpCooldown > 0) PLAYER.jumpCooldown--;
  if (!PLAYER.onGround) {
    PLAYER.vy += GRAVITY;
    PLAYER.y += PLAYER.vy;
  }
  // Ground collision
  if (PLAYER.y + PLAYER.h >= world.groundY) {
    PLAYER.y = world.groundY - PLAYER.h;
    PLAYER.vy = 0;
    PLAYER.onGround = true;
    PLAYER.canDoubleJump = true;
  }
  PLAYER.animT += 0.15;

  // Trail
  PLAYER.trail.push({ x: PLAYER.x, y: PLAYER.y + PLAYER.h / 2 });
  if (PLAYER.trail.length > 12) PLAYER.trail.shift();

  // BG hue drift toward beat color
  world.bgHue += (world.bgHueTarget - world.bgHue) * 0.05;

  // Parallax scroll
  world.bgLayers.forEach(layer => {
    layer.items.forEach(item => {
      item.x -= layer.spd * world.speed;
      if (item.x + item.w < 0) item.x = W + Math.random() * 200;
    });
  });
  world.bgStars.forEach(s => {
    s.x -= s.spd;
    s.twinkle += 0.04;
    if (s.x < -5) s.x = W + Math.random() * 50;
  });

  // Obstacle check
  world.obstacles.forEach(obs => {
    obs.animT += 0.08;
    const ox = obs.x - scrollX + PLAYER.x * 1.2;
    if (obs.hit) return;
    // AABB
    const px1 = PLAYER.x + 4, px2 = PLAYER.x + PLAYER.w - 4;
    const py1 = PLAYER.y + 4, py2 = PLAYER.y + PLAYER.h - 4;
    const ox1 = ox, ox2 = ox + obs.w;
    const oy1 = obs.y, oy2 = obs.y + obs.h;
    if (px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1) {
      obs.hit = true;
      playerHit(PLAYER.x + PLAYER.w / 2, PLAYER.y + PLAYER.h / 2);
    }
    // Beat-timing zone: check if player jumped near this obstacle
    const distToCenter = Math.abs(px1 + PLAYER.w/2 - (ox + obs.w/2));
    if (distToCenter < 5 && !PLAYER.onGround) {
      // Passed an obstacle (over it)! Check beat accuracy
      const btp = world.beatPhase;
      let acc;
      if (btp < 0.1 || btp > 0.9)      acc = 'perfect';
      else if (btp < 0.2 || btp > 0.8) acc = 'good';
      else acc = 'ok';
      showAccuracy(acc, PLAYER.x, PLAYER.y);
    }
  });

  // Checkpoint logic
  world.checkpoint.forEach((cpX, i) => {
    const scrollX2 = world.progress * world.levelLen;
    if (!world.checkpointPassed[i] && scrollX2 >= cpX) {
      world.checkpointPassed[i] = true;
      triggerCheckpoint(i);
    }
  });

  // Level complete
  if (world.progress >= 1) {
    levelComplete();
    return;
  }

  // Update particles
  world.particles = world.particles.filter(p => p.life > 0);
  world.particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= p.decay; p.r *= 0.94;
  });

  updateHUDProgress();
}

// ── ON BEAT ───────────────────────────────────────────────────
function onBeat() {
  // Flash beat indicator
  const flash = document.getElementById('beatFlash');
  flash.classList.add('flash');
  setTimeout(() => flash.classList.remove('flash'), 60);
  // Cycle beat dots
  updateBeatDots(beatCount % 4);
  // BG hue change
  world.bgHueTarget = (world.bgHueTarget + 30) % 360;
  // Glow player
  PLAYER.shineT = 1;
  // Visualizer bars
  updateVisualizer();
}

function updateBeatDots(active) {
  document.querySelectorAll('.beat-dot').forEach((d, i) => {
    d.classList.toggle('active', i === active);
  });
}
function updateVisualizer() {
  const bars = document.querySelectorAll('.beat-bar');
  const lv = LEVEL_DEFS[currentLevel];
  const bpm = lv ? lv.bpm : 120;
  bars.forEach((bar, i) => {
    const h = 6 + Math.random() * (bpm / 8);
    bar.style.height = Math.min(h, 55) + 'px';
  });
}

// ── PLAYER JUMP ───────────────────────────────────────────────
function doJump() {
  if (GS !== 'play') return;
  if (PLAYER.onGround) {
    PLAYER.vy = JUMP_V;
    PLAYER.onGround = false;
    PLAYER.jumpCooldown = 6;
    spawnJumpParticles();
    SFX.jump();
  } else if (PLAYER.canDoubleJump) {
    PLAYER.vy = DOUBLE_JUMP_V;
    PLAYER.canDoubleJump = false;
    spawnJumpParticles();
    beep(660, 'sine', 0.06, 0.12);
  }
}

function spawnJumpParticles() {
  for (let i = 0; i < 8; i++) {
    const a = Math.PI + (Math.random() - 0.5) * Math.PI;
    const s = 2 + Math.random() * 4;
    world.particles.push({
      x: PLAYER.x + PLAYER.w / 2, y: PLAYER.y + PLAYER.h,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
      life: 1, decay: 0.04, r: 3 + Math.random() * 4,
      col: PLAYER.color
    });
  }
}

// ── PLAYER HIT ────────────────────────────────────────────────
function playerHit(ex, ey) {
  levelData.deaths++;
  SFX.death();
  world.camShake = 12;
  // Explosion particles
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 8;
    world.particles.push({
      x: ex, y: ey, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
      life: 1, decay: 0.025, r: 4 + Math.random() * 8,
      col: ['#ff0055','#ff6600','#ffff00','#ff00ff'][Math.floor(Math.random() * 4)]
    });
  }
  // Death explosion overlay
  const ex2 = document.getElementById('deathExplosion');
  ex2.style.setProperty('--ex', ((ex / W) * 100) + '%');
  ex2.style.setProperty('--ey', ((ey / H) * 100) + '%');
  ex2.classList.add('boom');
  setTimeout(() => ex2.classList.remove('boom'), 300);

  // Reset player to last checkpoint
  const lastCP = world.checkpoint.findIndex((c, i) => !world.checkpointPassed[i]);
  const cpIdx = lastCP > 0 ? lastCP - 1 : -1;
  if (cpIdx >= 0 && world.checkpointPassed[cpIdx]) {
    // Respawn at checkpoint
    world.progress = world.checkpoint[cpIdx] / world.levelLen;
    showToast('CHECKPOINT RESPAWN');
  } else {
    // Restart from beginning
    world.progress = 0;
    showToast('TRY AGAIN!');
  }
  // Reset player pos
  PLAYER.y = world.groundY - PLAYER.h;
  PLAYER.vy = 0; PLAYER.onGround = true; PLAYER.canDoubleJump = true;
  // Re-enable obstacles that were passed (reset hit state)
  const scrollX = world.progress * world.levelLen;
  world.obstacles.forEach(obs => { if (obs.x - scrollX + PLAYER.x * 1.2 > 0) obs.hit = false; });
  // Combo reset
  levelData.combo = 0;
  updateComboUI();
}

// ── CHECKPOINT ────────────────────────────────────────────────
function triggerCheckpoint(i) {
  SFX.checkpoint();
  levelData.score += 200;
  const banner = document.getElementById('checkpointBanner');
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 2000);
  showScorePopup('+200 CHECKPOINT!', W / 2, H * 0.4, '#00ff88');
}

// ── LEVEL COMPLETE ────────────────────────────────────────────
function levelComplete() {
  stopBgMusic();
  GS = 'result';
  const lv = LEVEL_DEFS[currentLevel];
  SFX.levelUp();
  // Calculate stars
  let stars = 0;
  if (levelData.score >= lv.starScore[0]) stars = 1;
  if (levelData.score >= lv.starScore[1]) stars = 2;
  if (levelData.score >= lv.starScore[2]) stars = 3;
  // Save progress
  const key = 'lv' + currentLevel;
  if (!saveData[key] || saveData[key].stars < stars) {
    saveData[key] = { stars, score: levelData.score };
    writeSave();
  }
  if (!saveData.unlocked || saveData.unlocked <= currentLevel) {
    saveData.unlocked = Math.min(currentLevel + 1, 19);
    writeSave();
  }
  // Show result screen
  showResultScreen(true, stars);
}

// ── ACCURACY FEEDBACK ─────────────────────────────────────────
let accTimer = null;
function showAccuracy(acc, x, y) {
  const labels = { perfect: 'PERFECT!', good: 'GOOD!', ok: 'OK', miss: 'MISS' };
  const classes= { perfect: 'acc-perfect', good: 'acc-good', ok: 'acc-ok', miss: 'acc-miss' };
  const scores = { perfect: 150, good: 80, ok: 30, miss: 0 };
  if (scores[acc]) {
    levelData.score += scores[acc] * Math.max(1, Math.floor(levelData.combo / 5));
  }
  if (acc !== 'miss') { levelData.combo++; levelData[acc]++; SFX[acc]?.(); }
  else                { levelData.combo = 0; SFX.miss(); }
  if (levelData.combo > levelData.maxCombo) levelData.maxCombo = levelData.combo;

  // DOM feedback
  const ab = document.getElementById('accuracyBadge');
  ab.textContent = labels[acc];
  ab.className = 'accuracy-badge ' + classes[acc];
  if (accTimer) clearTimeout(accTimer);
  accTimer = setTimeout(() => { ab.textContent = ''; ab.className = 'accuracy-badge'; }, 700);

  showScorePopup((scores[acc]?'+'+scores[acc]:'') + ' ' + labels[acc], PLAYER.x + PLAYER.w, PLAYER.y, acc === 'perfect' ? '#00ff88' : acc === 'good' ? '#00f5ff' : '#ffff00');
  updateComboUI();
}

function updateComboUI() {
  const el = document.getElementById('comboDisplay');
  el.textContent = levelData.combo > 1 ? '× ' + levelData.combo : '';
  if (levelData.combo > 1) el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 200);
}

// ── SCORE POPUP ───────────────────────────────────────────────
function showScorePopup(text, x, y, col) {
  const el = document.createElement('div');
  el.className = 'score-popup';
  el.textContent = text;
  el.style.left = Math.min(Math.max(x, 10), W - 120) + 'px';
  el.style.top  = Math.min(Math.max(y - 30, 10), H - 50) + 'px';
  el.style.fontSize = clamp(12, W * 0.025, 20) + 'px';
  el.style.color = col || '#00f5ff';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function updateHUDProgress() {
  const fill = document.getElementById('progressFill');
  const pct  = document.getElementById('progressPct');
  const sv   = document.getElementById('scoreVal');
  if (fill) fill.style.width = (world.progress * 100) + '%';
  if (pct)  pct.textContent  = Math.floor(world.progress * 100) + '%';
  if (sv)   sv.textContent   = levelData.score;
}

// ── DRAW ENGINE ────────────────────────────────────────────────
function drawGame() {
  if (GS !== 'play') return;

  const scrollX = world.progress * world.levelLen;
  const shake   = world.camShake;
  const sx = shake > 0 ? (Math.random() - 0.5) * shake * 2 : 0;
  const sy = shake > 0 ? (Math.random() - 0.5) * shake * 2 : 0;

  ctx.save();
  ctx.translate(sx, sy);

  // ── BACKGROUND ─────────────────────────────────────────────
  // Dynamic gradient based on beat
  const pulse = Math.sin(world.beatPhase * Math.PI * 2) * 0.5 + 0.5;
  const lv = LEVEL_DEFS[currentLevel];
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, `hsl(${world.bgHue + 260},80%,4%)`);
  bg.addColorStop(0.6, `hsl(${world.bgHue + 280},80%,6%)`);
  bg.addColorStop(1, `hsl(${world.bgHue + 300},70%,3%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Beat horizon glow
  const hg = ctx.createLinearGradient(0, H * 0.6, 0, H * 0.8);
  hg.addColorStop(0, `rgba(${hexToRgb(lv.color)},${0.08 + pulse * 0.06})`);
  hg.addColorStop(1, 'transparent');
  ctx.fillStyle = hg;
  ctx.fillRect(0, H * 0.6, W, H * 0.2);

  // Parallax background layers
  world.bgLayers.forEach(layer => {
    ctx.fillStyle = layer.col;
    layer.items.forEach(item => {
      ctx.fillRect(item.x % (W + item.w) - item.w, item.y, item.w, item.h);
    });
  });

  // Stars
  world.bgStars.forEach(s => {
    const tw = 0.5 + Math.sin(s.twinkle) * 0.4;
    ctx.fillStyle = `rgba(255,255,255,${tw * 0.6})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * tw, 0, Math.PI * 2);
    ctx.fill();
  });

  // Neon grid floor effect
  ctx.strokeStyle = `rgba(${hexToRgb(lv.color)},${0.07 + pulse * 0.05})`;
  ctx.lineWidth = 0.5;
  const gridSpacing = 50;
  const gridOff = scrollX * 0.2 % gridSpacing;
  for (let gx = -gridSpacing + gridOff; gx < W + gridSpacing; gx += gridSpacing) {
    ctx.beginPath(); ctx.moveTo(gx, world.groundY); ctx.lineTo(gx - 80, H); ctx.stroke();
  }
  for (let gy = world.groundY; gy < H; gy += 24) {
    const alpha = (1 - (gy - world.groundY) / (H - world.groundY)) * 0.08;
    ctx.strokeStyle = `rgba(${hexToRgb(lv.color)},${alpha})`;
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }

  // ── GROUND ──────────────────────────────────────────────────
  const groundGrad = ctx.createLinearGradient(0, world.groundY, 0, H);
  groundGrad.addColorStop(0, `rgba(${hexToRgb(lv.color)},${0.3 + pulse * 0.2})`);
  groundGrad.addColorStop(0.08, `rgba(${hexToRgb(lv.color)},0.12)`);
  groundGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, world.groundY, W, H - world.groundY);

  // Ground neon line
  ctx.shadowColor = lv.color;
  ctx.shadowBlur = 16 + pulse * 12;
  ctx.strokeStyle = lv.color;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, world.groundY); ctx.lineTo(W, world.groundY); ctx.stroke();
  ctx.shadowBlur = 0;

  // Ground tile marks
  const tileW = 80;
  const tileOff = scrollX % tileW;
  ctx.strokeStyle = `rgba(${hexToRgb(lv.color)},0.18)`;
  ctx.lineWidth = 1;
  for (let tx = -tileOff; tx < W; tx += tileW) {
    ctx.beginPath(); ctx.moveTo(tx, world.groundY); ctx.lineTo(tx, world.groundY + 12); ctx.stroke();
  }

  // ── OBSTACLES ──────────────────────────────────────────────
  world.obstacles.forEach(obs => {
    if (obs.hit) return;
    const ox = obs.x - scrollX + PLAYER.x * 1.2;
    if (ox < -obs.w - 20 || ox > W + 100) return;
    const pulse2 = Math.sin(obs.animT * 3) * 0.3 + 0.7;

    ctx.save();
    ctx.translate(ox, obs.y);

    if (obs.type === 'spike') {
      // 3D spike with glow
      ctx.shadowColor = obs.color; ctx.shadowBlur = 14 + pulse2 * 10;
      const spkGrad = ctx.createLinearGradient(0, 0, 0, obs.h);
      spkGrad.addColorStop(0, obs.color);
      spkGrad.addColorStop(1, obs.color + '44');
      ctx.fillStyle = spkGrad;
      ctx.beginPath();
      ctx.moveTo(obs.w / 2, 0);
      ctx.lineTo(obs.w, obs.h);
      ctx.lineTo(obs.w * 0.65, obs.h * 0.7);
      ctx.lineTo(obs.w / 2, obs.h);
      ctx.lineTo(obs.w * 0.35, obs.h * 0.7);
      ctx.lineTo(0, obs.h);
      ctx.closePath();
      ctx.fill();
      // Bright tip
      ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(obs.w / 2, 3, 2, 0, Math.PI * 2); ctx.fill();
    } else {
      // Wall — 3D box effect
      ctx.shadowColor = obs.color; ctx.shadowBlur = 16 + pulse2 * 8;
      // Main face
      const wGrad = ctx.createLinearGradient(0, 0, obs.w, 0);
      wGrad.addColorStop(0, obs.color + 'cc');
      wGrad.addColorStop(0.5, obs.color);
      wGrad.addColorStop(1, obs.color + '88');
      ctx.fillStyle = wGrad;
      ctx.fillRect(0, 0, obs.w, obs.h);
      // Top face (3D)
      ctx.fillStyle = obs.color + 'aa';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(8, -6); ctx.lineTo(obs.w + 8, -6); ctx.lineTo(obs.w, 0);
      ctx.closePath(); ctx.fill();
      // Right face (3D)
      ctx.fillStyle = obs.color + '66';
      ctx.beginPath();
      ctx.moveTo(obs.w, 0); ctx.lineTo(obs.w + 8, -6); ctx.lineTo(obs.w + 8, obs.h - 6); ctx.lineTo(obs.w, obs.h);
      ctx.closePath(); ctx.fill();
      // Glow edge
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(obs.w, 0); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  });

  // ── PLAYER ─────────────────────────────────────────────────
  const pulse3 = 0.6 + (PLAYER.shineT > 0 ? 0.4 : Math.sin(PLAYER.animT * 4) * 0.3);
  if (PLAYER.shineT > 0) PLAYER.shineT = Math.max(0, PLAYER.shineT - 0.08);

  // Trail
  PLAYER.trail.forEach((t, i) => {
    const a = (i / PLAYER.trail.length) * 0.35;
    const sz = PLAYER.w * (i / PLAYER.trail.length) * 0.85;
    ctx.fillStyle = PLAYER.color + Math.floor(a * 180).toString(16).padStart(2, '0');
    ctx.fillRect(t.x + (PLAYER.w - sz) / 2, t.y - sz * 0.6, sz, sz);
  });

  ctx.save();
  ctx.translate(PLAYER.x, PLAYER.y);

  // Shadow beneath player
  const shadowAlpha = PLAYER.onGround ? 0.4 : 0.15;
  const shadowY = world.groundY - PLAYER.y - PLAYER.h;
  ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(PLAYER.w / 2, PLAYER.h + Math.min(shadowY * 0.3, 20), PLAYER.w * 0.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Player glow
  ctx.shadowColor = PLAYER.color;
  ctx.shadowBlur = 20 + pulse3 * 20;

  // 3D player body
  const bodyGrad = ctx.createLinearGradient(0, 0, PLAYER.w, PLAYER.h);
  bodyGrad.addColorStop(0, '#fff');
  bodyGrad.addColorStop(0.3, PLAYER.color);
  bodyGrad.addColorStop(1, PLAYER.color + '88');
  ctx.fillStyle = bodyGrad;
  // Main block (cube-ish)
  ctx.fillRect(0, 0, PLAYER.w, PLAYER.h);
  // Top face 3D
  ctx.fillStyle = PLAYER.color + 'cc';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(8, -7); ctx.lineTo(PLAYER.w + 8, -7); ctx.lineTo(PLAYER.w, 0);
  ctx.closePath(); ctx.fill();
  // Right face 3D
  ctx.fillStyle = PLAYER.color + '66';
  ctx.beginPath();
  ctx.moveTo(PLAYER.w, 0); ctx.lineTo(PLAYER.w + 8, -7); ctx.lineTo(PLAYER.w + 8, PLAYER.h - 7); ctx.lineTo(PLAYER.w, PLAYER.h);
  ctx.closePath(); ctx.fill();
  // Eyes
  ctx.fillStyle = '#fff'; ctx.shadowBlur = 6;
  ctx.fillRect(PLAYER.w * 0.55, PLAYER.h * 0.18, PLAYER.w * 0.22, PLAYER.h * 0.22);
  ctx.fillRect(PLAYER.w * 0.55, PLAYER.h * 0.18, PLAYER.w * 0.22, PLAYER.h * 0.22);
  ctx.fillStyle = '#000';
  ctx.fillRect(PLAYER.w * 0.6, PLAYER.h * 0.22, PLAYER.w * 0.12, PLAYER.h * 0.14);
  // Energy core
  ctx.fillStyle = PLAYER.color; ctx.shadowColor = PLAYER.color; ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(PLAYER.w * 0.3, PLAYER.h * 0.55, 4 + pulse3 * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();

  // ── PARTICLES ──────────────────────────────────────────────
  world.particles.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2);
    ctx.fillStyle = p.col + Math.floor(p.life * 200).toString(16).padStart(2, '0');
    ctx.fill();
  });

  ctx.restore(); // camera shake end

  // ── BEAT VISUAL EFFECTS ────────────────────────────────────
  if (world.beatPhase < 0.08) {
    ctx.fillStyle = `rgba(${hexToRgb(lv.color)},${(0.08 - world.beatPhase) * 0.8})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// idle draw for non-play screens
function drawIdle() {
  ctx.fillStyle = '#040008'; ctx.fillRect(0, 0, W, H);
}

// ── MAIN LOOP ─────────────────────────────────────────────────
let rafId = null;
function loop() {
  rafId = requestAnimationFrame(loop);
  if (GS === 'play') {
    updateGame();
    drawGame();
  }
}
loop();

// ── HELPER: HEX TO RGB ───────────────────────────────────────
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substr(0,2), 16);
  const g = parseInt(hex.substr(2,2), 16);
  const b = parseInt(hex.substr(4,2), 16);
  return `${r},${g},${b}`;
}
function clamp(mn, v, mx) { return Math.max(mn, Math.min(mx, v)); }

// ── SCREEN MANAGEMENT ─────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function showGameUI(visible) {
  const hud     = document.getElementById('hud');
  const pBtn    = document.getElementById('pauseBtn');
  const sBtn    = document.getElementById('soundBtn');
  const tapZ    = document.getElementById('tapZone');
  const mobJump = document.getElementById('mobileJump');
  const beatVis = document.getElementById('beatVisualizer');
  if (visible) {
    hud.classList.remove('hidden');
    pBtn.classList.remove('hidden');
    sBtn.classList.remove('hidden');
    tapZ.classList.add('active');
    beatVis.style.display = 'flex';
    if ('ontouchstart' in window) mobJump.classList.add('active');
  } else {
    hud.classList.add('hidden');
    pBtn.classList.add('hidden');
    tapZ.classList.remove('active');
    mobJump.classList.remove('active');
    beatVis.style.display = 'none';
  }
}

// ── UI: SPLASH ────────────────────────────────────────────────
function goSplash() {
  GS = 'splash';
  stopBgMusic();
  showScreen('splashScreen');
  showGameUI(false);
  drawIdle();
}

// ── UI: GUIDE ─────────────────────────────────────────────────
function goGuide() {
  GS = 'guide';
  showScreen('guideScreen');
  SFX.menu();
}

// ── UI: TRACK SELECT ─────────────────────────────────────────
function goTrackSelect() {
  GS = 'trackselect';
  showScreen('trackSelectScreen');
  buildTrackList();
  SFX.menu();
}
function buildTrackList() {
  const list = document.getElementById('trackList');
  list.innerHTML = '';
  TRACKS.forEach((tr, i) => {
    const el = document.createElement('div');
    el.className = 'track-item' + (i === selectedTrack ? ' active' : '');
    el.innerHTML = `
      <div class="track-icon">${tr.icon}</div>
      <div class="track-info">
        <div class="track-name">${tr.name}</div>
        <div class="track-bpm">${tr.desc}</div>
      </div>
      ${i === selectedTrack ? '<div class="track-check">✓</div>' : ''}
    `;
    el.onclick = () => { selectedTrack = i; buildTrackList(); SFX.menu(); };
    list.appendChild(el);
  });
}

// ── UI: LEVEL SELECT ─────────────────────────────────────────
function goLevelSelect() {
  GS = 'levelselect';
  showScreen('levelSelectScreen');
  buildLevelGrid();
  SFX.menu();
}
function buildLevelGrid() {
  const grid = document.getElementById('levelGrid');
  grid.innerHTML = '';
  const maxUnlocked = (saveData.unlocked !== undefined ? saveData.unlocked : 0);
  LEVEL_DEFS.forEach((lv, i) => {
    const key = 'lv' + i;
    const saved = saveData[key] || {};
    const stars = saved.stars || 0;
    const locked = i > maxUnlocked;
    const completed = stars > 0;
    const el = document.createElement('div');
    el.className = 'level-btn ' + (locked ? 'locked' : completed ? 'completed' : 'unlocked');
    el.innerHTML = `
      <div>${locked ? '🔒' : lv.id}</div>
      <div style="font-family:'Rajdhani',sans-serif;font-size:clamp(7px,1.5vw,9px);color:rgba(255,255,255,0.5);letter-spacing:1px;">${locked?'':'LV'+lv.id}</div>
      <div class="level-stars">${stars > 0 ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : locked ? '' : '☆☆☆'}</div>
    `;
    if (!locked) el.onclick = () => { playLevel(i); SFX.menu(); };
    grid.appendChild(el);
  });
}

// ── UI: PLAY LEVEL ────────────────────────────────────────────
function playLevel(idx) {
  GS = 'play';
  showScreen('__none__'); // hide all
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  showGameUI(true);
  document.getElementById('pauseMenu').classList.add('hidden');

  // Set level info in HUD
  const lv = LEVEL_DEFS[idx];
  document.getElementById('levelBadge').textContent = 'LV ' + lv.id + ' · ' + lv.name;

  initGame(idx);
  startBgMusic(lv.bpm, lv.track);
}

// ── UI: PAUSE ─────────────────────────────────────────────────
function togglePause() {
  if (GS === 'play') {
    GS = 'pause';
    stopBgMusic();
    document.getElementById('pauseMenu').classList.remove('hidden');
    // Update pause stats
    document.getElementById('pScore').textContent = levelData.score;
    document.getElementById('pCombo').textContent = levelData.maxCombo;
    document.getElementById('pDeaths').textContent = levelData.deaths;
  } else if (GS === 'pause') {
    GS = 'play';
    document.getElementById('pauseMenu').classList.add('hidden');
    const lv = LEVEL_DEFS[currentLevel];
    startBgMusic(lv.bpm, lv.track);
  }
  SFX.menu();
}

function restartLevel() {
  document.getElementById('pauseMenu').classList.add('hidden');
  playLevel(currentLevel);
}
function quitToMenu() {
  document.getElementById('pauseMenu').classList.add('hidden');
  goLevelSelect();
}

// ── UI: RESULT SCREEN ────────────────────────────────────────
function showResultScreen(win, stars) {
  const screen = document.getElementById('resultScreen');
  screen.classList.remove('hidden');

  document.getElementById('resultIcon').textContent  = win ? '🏆' : '💔';
  document.getElementById('resultTitle').textContent = win ? 'LEVEL CLEAR!' : 'FAILED!';
  document.getElementById('resultTitle').className   = 'result-title ' + (win ? 'win' : 'lose');

  // Stars
  const starsEl = document.getElementById('resultStars');
  starsEl.innerHTML = [0,1,2].map(i => `<span class="${i < stars ? 'star-filled' : 'star-empty'}">${i < stars ? '⭐' : '☆'}</span>`).join('');

  document.getElementById('rScore').textContent  = levelData.score;
  document.getElementById('rCombo').textContent  = levelData.maxCombo;
  document.getElementById('rDeaths').textContent = levelData.deaths;
  document.getElementById('rPerfect').textContent= levelData.perfect;

  // Next level button
  const nextBtn = document.getElementById('nextLvBtn');
  const hasNext = currentLevel < LEVEL_DEFS.length - 1;
  nextBtn.style.display = win && hasNext ? 'inline-block' : 'none';
}

function nextLevel() {
  if (currentLevel < LEVEL_DEFS.length - 1) {
    document.getElementById('resultScreen').classList.add('hidden');
    playLevel(currentLevel + 1);
  }
}
function retryLevel() {
  document.getElementById('resultScreen').classList.add('hidden');
  playLevel(currentLevel);
}
function goMenuFromResult() {
  document.getElementById('resultScreen').classList.add('hidden');
  goLevelSelect();
}

// ── INPUT ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  initAudio();
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault(); doJump();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') toggleSound();
});

// Tap to jump (game canvas + tap zone)
function handleTap(e) {
  e.preventDefault(); initAudio();
  if (GS === 'play' || GS === 'pause') {
    const target = e.target;
    // Don't trigger if tapping UI buttons
    if (target.closest('button') || target.closest('#pauseMenu') || target.closest('#pauseBtn') || target.closest('#soundBtn')) return;
    if (GS === 'play') doJump();
  }
}
document.getElementById('tapZone').addEventListener('touchstart', handleTap, { passive: false });
document.getElementById('tapZone').addEventListener('click', handleTap);
document.getElementById('mobileJump').addEventListener('touchstart', e => { e.preventDefault(); initAudio(); doJump(); }, { passive: false });
document.getElementById('mobileJump').addEventListener('click', () => { initAudio(); doJump(); });

// ── SOUND TOGGLE ──────────────────────────────────────────────
function toggleSound() {
  soundOn = !soundOn;
  const btn = document.getElementById('soundBtn');
  btn.textContent = soundOn ? '🔊' : '🔇';
  if (!soundOn) stopBgMusic();
  else if (GS === 'play') startBgMusic(LEVEL_DEFS[currentLevel].bpm, LEVEL_DEFS[currentLevel].track);
}

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toastEl');
  el.textContent = msg; el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── INIT SPLASH ───────────────────────────────────────────────
goSplash();
