'use strict';
// ── CONFIG ──────────────────────────────────────────────────────
const CFG = {
  gravity: 0.55, jumpForce: -13.5, doubleJumpForce: -12,
  groundY: 0.80,            // fraction of canvas height
  playerX: 0.18,
  baseSpeed: 5.5, maxSpeed: 14, speedStep: 0.0015,
  obstacleInterval: [900, 1700],
  powerupInterval: [7000, 14000],
  starInterval: [3000, 6000],
  scoreRate: 10,            // ms per point
  particleCount: 18,
  shieldDuration: 6000,
  slowDuration: 5000,
  comboWindow: 1800,        // ms between jumps for combo
};

// ── STATE ────────────────────────────────────────────────────────
let canvas, ctx, raf;
let state = 'start';       // start | playing | paused | dead
let score = 0, highScore = 0, lastScoreTime = 0;
let gameSpeed = CFG.baseSpeed;
let frame = 0;
let soundOn = true;
let prevT = 0;

// player
const player = {
  x:0, y:0, w:60, h:60,
  vy:0, onGround:false,
  jumpsLeft:2,
  shieldActive:false, shieldTimer:0,
  slowActive:false, slowTimer:0,
  squashY:1, squashX:1,
  dustTimer:0,
  angle:0,
};

// arrays
let obstacles=[], powerups=[], stars=[], particles=[];
let clouds=[], bgLayers=[];
let obstacleTimer=0, powerupTimer=0, starTimer=0;
let nextObstacleIn=1200, nextPowerupIn=9000, nextStarIn=3000;

// combo
let combo=0, lastJumpTime=0, comboDisplayTimer=0;

// scroll offsets for parallax
let scrollFar=0, scrollMid=0, scrollNear=0;

// images
const imgs = {};
const imgSrcs = {
  player:  'assets/images/player.png',
  obstacle:'assets/images/obstacle.png',
  shield:  'assets/images/power_shield.png',
  slowmo:  'assets/images/power_slowmo.png',
  star:    'assets/images/star.png',
};
let imgsLoaded=0, imgsTotal=Object.keys(imgSrcs).length;

// audio context
let audioCtx=null;
function getAudio(){ if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)(); return audioCtx; }

// ── SOUND ────────────────────────────────────────────────────────
function playTone(freq, type, dur, vol=0.18, decay=0.1){
  if(!soundOn) return;
  try{
    const a=getAudio(), o=a.createOscillator(), g=a.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,a.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq*0.5,a.currentTime+dur);
    g.gain.setValueAtTime(vol,a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+dur+decay);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime+dur+decay);
  }catch(e){}
}
function sfxJump(){ playTone(380,'sine',0.12,0.22); }
function sfxDoubleJump(){ playTone(520,'sine',0.14,0.22); }
function sfxLand(){ playTone(160,'triangle',0.08,0.18); }
function sfxHit(){ playTone(140,'sawtooth',0.25,0.3,0.2); }
function sfxStar(){ playTone(880,'sine',0.1,0.18); playTone(1100,'sine',0.12,0.18); }
function sfxPowerup(){ playTone(660,'sine',0.2,0.22); playTone(880,'sine',0.22,0.22); }
function sfxCombo(n){ playTone(440+n*55,'sine',0.1,0.2); }

// ── LOAD IMAGES ───────────────────────────────────────────────────
function loadImages(cb){
  Object.entries(imgSrcs).forEach(([k,src])=>{
    const im=new Image(); im.src=src;
    im.onload=()=>{ imgs[k]=im; imgsLoaded++; if(imgsLoaded>=imgsTotal) cb(); };
    im.onerror=()=>{ imgsLoaded++; if(imgsLoaded>=imgsTotal) cb(); };
  });
}

// ── INIT ──────────────────────────────────────────────────────────
function init(){
  canvas=document.getElementById('game-canvas');
  ctx=canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  setupInput();
  setupUI();
  loadImages(()=>{
    buildBgLayers();
    buildClouds();
    showScreen('start');
  });
}

function resize(){
  canvas.width=window.innerWidth;
  canvas.height=window.innerHeight;
  resetPlayerPos();
  buildBgLayers();
  buildClouds();
}

function resetPlayerPos(){
  player.x = canvas.width * CFG.playerX;
  player.y = canvas.height * CFG.groundY - player.h;
  player.vy=0; player.onGround=true; player.jumpsLeft=2;
}

// ── BACKGROUND ───────────────────────────────────────────────────
function buildBgLayers(){
  bgLayers = [
    { stars:[] }, { stars:[] },
  ];
  // far stars
  for(let i=0;i<80;i++) bgLayers[0].stars.push({
    x:Math.random()*canvas.width, y:Math.random()*canvas.height*0.75,
    r:Math.random()*1.5+0.5, a:Math.random()
  });
  // mid orbs
  for(let i=0;i<20;i++) bgLayers[1].stars.push({
    x:Math.random()*canvas.width, y:Math.random()*canvas.height*0.65,
    r:Math.random()*3+2, a:Math.random()
  });
}

function buildClouds(){
  clouds=[];
  for(let i=0;i<7;i++) clouds.push({
    x:Math.random()*canvas.width,
    y:Math.random()*canvas.height*0.45+20,
    w:Math.random()*120+80,
    h:Math.random()*40+20,
    spd: Math.random()*0.4+0.2,
    alpha:Math.random()*0.18+0.06,
    hue: Math.floor(Math.random()*360),
  });
}

// ── PARTICLES ────────────────────────────────────────────────────
function spawnParticles(x,y,color,n=8){
  for(let i=0;i<n;i++){
    const angle=Math.random()*Math.PI*2;
    const spd=Math.random()*4+1.5;
    particles.push({
      x,y,
      vx:Math.cos(angle)*spd,
      vy:Math.sin(angle)*spd - 2,
      life:1, decay:Math.random()*0.04+0.025,
      r:Math.random()*5+2,
      color,
    });
  }
}

function spawnDust(){
  for(let i=0;i<4;i++){
    particles.push({
      x:player.x+player.w*0.5,
      y:player.y+player.h,
      vx:Math.random()*2-3,
      vy:-(Math.random()*1.5),
      life:0.8, decay:0.05,
      r:Math.random()*6+3,
      color:'rgba(200,180,255,',
    });
  }
}

// ── GAME START / RESET ────────────────────────────────────────────
function startGame(){
  score=0; frame=0; gameSpeed=CFG.baseSpeed;
  obstacles=[]; powerups=[]; stars=[]; particles=[];
  obstacleTimer=0; powerupTimer=0; starTimer=0;
  nextObstacleIn=rnd(CFG.obstacleInterval[0],CFG.obstacleInterval[1]);
  nextPowerupIn=rnd(CFG.powerupInterval[0],CFG.powerupInterval[1]);
  nextStarIn=rnd(CFG.starInterval[0],CFG.starInterval[1]);
  combo=0; lastJumpTime=0; comboDisplayTimer=0;
  scrollFar=0; scrollMid=0; scrollNear=0;
  player.shieldActive=false; player.shieldTimer=0;
  player.slowActive=false; player.slowTimer=0;
  player.angle=0; player.squashX=1; player.squashY=1;
  lastScoreTime=performance.now();
  resetPlayerPos();
  buildClouds();
  hideAllScreens();
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('hud-best').textContent=highScore;
  updateHUD();
  state='playing';
  prevT=performance.now();
  raf=requestAnimationFrame(loop);
}

function rnd(a,b){ return Math.random()*(b-a)+a; }

// ── JUMP ──────────────────────────────────────────────────────────
function doJump(){
  if(state!=='playing') return;
  if(player.jumpsLeft<=0) return;
  const isDouble = !player.onGround;
  if(isDouble){
    player.vy=CFG.doubleJumpForce;
    sfxDoubleJump();
    spawnParticles(player.x+player.w/2, player.y+player.h/2,'rgba(155,93,229,',12);
  } else {
    player.vy=CFG.jumpForce;
    sfxJump();
    spawnDust();
  }
  player.jumpsLeft--;
  player.onGround=false;
  player.squashX=0.7; player.squashY=1.4;

  // combo
  const now=performance.now();
  if(now-lastJumpTime<CFG.comboWindow){ combo++; sfxCombo(Math.min(combo,8)); showCombo(); }
  else combo=1;
  lastJumpTime=now;
}

function showCombo(){
  if(combo<2) return;
  const el=document.getElementById('combo-display');
  el.textContent= combo===2?'✨ NICE!': combo===3?'🔥 GREAT!': combo===4?'⚡ AWESOME!':'🌟 x'+combo+' COMBO!';
  el.classList.remove('hidden');
  clearTimeout(window._comboTO);
  window._comboTO=setTimeout(()=>el.classList.add('hidden'),900);
}

// ── INPUT ─────────────────────────────────────────────────────────
function setupInput(){
  const jump=()=>{ if(state==='playing') doJump(); };
  canvas.addEventListener('pointerdown', jump);
  window.addEventListener('keydown', e=>{
    if(e.code==='Space'||e.code==='ArrowUp') jump();
    if(e.code==='Escape'||e.code==='KeyP'){
      if(state==='playing') pauseGame();
      else if(state==='paused') resumeGame();
    }
  });
}

// ── UI ────────────────────────────────────────────────────────────
function setupUI(){
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('retry-btn').addEventListener('click', startGame);
  document.getElementById('menu-btn').addEventListener('click', goMenu);
  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('pause-menu-btn').addEventListener('click', goMenu);
  document.getElementById('pause-btn').addEventListener('click', ()=>{
    if(state==='playing') pauseGame();
  });
  document.getElementById('sound-btn').addEventListener('click', ()=>{
    soundOn=!soundOn;
    document.getElementById('sound-btn').textContent=soundOn?'🔊':'🔇';
  });
}

function showScreen(id){
  hideAllScreens();
  const el=document.getElementById(id+'-screen');
  if(el){ el.classList.add('active'); }
}
function hideAllScreens(){
  document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('active'));
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('powerup-indicator').classList.add('hidden');
  document.getElementById('combo-display').classList.add('hidden');
}

function updateHUD(){
  document.getElementById('hud-score').textContent=Math.floor(score);
  document.getElementById('hud-best').textContent=highScore;
}

function goMenu(){
  cancelAnimationFrame(raf);
  state='start';
  document.getElementById('start-best-display').textContent='Best: '+highScore;
  showScreen('start');
}

function pauseGame(){
  state='paused';
  cancelAnimationFrame(raf);
  showScreen('pause');
  document.getElementById('hud').classList.remove('hidden');
}

function resumeGame(){
  state='playing';
  hideAllScreens();
  document.getElementById('hud').classList.remove('hidden');
  prevT=performance.now();
  raf=requestAnimationFrame(loop);
}

function gameOver(){
  sfxHit();
  spawnParticles(player.x+player.w/2, player.y+player.h/2,'rgba(255,107,107,',CFG.particleCount);
  cancelAnimationFrame(raf);
  state='dead';
  if(score>highScore){ highScore=Math.floor(score); localStorage.setItem('ttj_hi',highScore); }
  document.getElementById('go-score').textContent=Math.floor(score);
  document.getElementById('go-best').textContent=highScore;
  const nr=document.getElementById('new-record-badge');
  if(Math.floor(score)>=highScore && score>0){ nr.classList.remove('hidden'); }
  else nr.classList.add('hidden');
  setTimeout(()=>showScreen('gameover'),600);
}

// ── SPAWN ─────────────────────────────────────────────────────────
const GY = ()=> canvas.height * CFG.groundY;

function spawnObstacle(){
  const gY=GY();
  const type=Math.random()<0.3?'flying':'ground';
  const heights=[28,44,60,72];
  const h=heights[Math.floor(Math.random()*heights.length)];
  const isMov=gameSpeed>7.5 && Math.random()<0.4;
  obstacles.push({
    x:canvas.width+20, y: type==='flying'? gY-h-rnd(60,130): gY-h,
    w:38, h, type, moving:isMov,
    movDir:Math.random()<0.5?1:-1, movSpd:rnd(1.5,3), movRange:rnd(40,90),
    baseY:0, travelY:0,
    hue:Math.floor(Math.random()*60+260),
  });
  obstacles[obstacles.length-1].baseY=obstacles[obstacles.length-1].y;
}

function spawnPowerup(){
  const gY=GY();
  const types=['shield','slowmo'];
  const t=types[Math.floor(Math.random()*types.length)];
  powerups.push({
    x:canvas.width+20, y:gY-rnd(90,160),
    w:36, h:36, kind:t,
    bob:Math.random()*Math.PI*2,
  });
}

function spawnStar(){
  const gY=GY();
  stars.push({
    x:canvas.width+20, y:gY-rnd(60,180),
    w:28, h:28, bob:Math.random()*Math.PI*2,
  });
}

// ── COLLISION ─────────────────────────────────────────────────────
function hitTest(a,b,shrink=8){
  return a.x+shrink < b.x+b.w-shrink &&
         a.x+a.w-shrink > b.x+shrink &&
         a.y+shrink < b.y+b.h-shrink &&
         a.y+a.h-shrink > b.y+shrink;
}

// ── MAIN LOOP ─────────────────────────────────────────────────────
function loop(ts){
  raf=requestAnimationFrame(loop);
  const dt=Math.min(ts-prevT,50); prevT=ts;
  const spd=player.slowActive? gameSpeed*0.45 : gameSpeed;

  update(dt, spd, ts);
  render(ts);
}

// ── UPDATE ────────────────────────────────────────────────────────
function update(dt, spd, ts){
  frame++;
  // speed ramp
  gameSpeed=Math.min(CFG.maxSpeed, CFG.baseSpeed + (score*0.004));

  // score
  if(ts-lastScoreTime>=CFG.scoreRate){ score+=1+(combo>1?0.5:0); lastScoreTime=ts; updateHUD(); }

  // powerup timers
  if(player.shieldActive){
    player.shieldTimer-=dt;
    if(player.shieldTimer<=0){ player.shieldActive=false; document.getElementById('powerup-indicator').classList.add('hidden'); }
    else{
      const pct=(player.shieldTimer/CFG.shieldDuration)*100;
      document.getElementById('powerup-bar-fill').style.width=pct+'px';
    }
  }
  if(player.slowActive){
    player.slowTimer-=dt;
    if(player.slowTimer<=0){ player.slowActive=false; if(!player.shieldActive) document.getElementById('powerup-indicator').classList.add('hidden'); }
    else if(!player.shieldActive){
      const pct=(player.slowTimer/CFG.slowDuration)*100;
      document.getElementById('powerup-bar-fill').style.width=pct+'px';
    }
  }

  // physics
  const gY=GY();
  player.vy+=CFG.gravity;
  player.y+=player.vy;
  if(player.y+player.h>=gY){
    const wasAir=!player.onGround;
    player.y=gY-player.h;
    player.vy=0;
    if(!player.onGround){
      player.onGround=true; player.jumpsLeft=2;
      if(wasAir){ sfxLand(); player.squashX=1.3; player.squashY=0.7; spawnDust(); }
    }
  } else { player.onGround=false; }

  // squash recovery
  player.squashX+=(1-player.squashX)*0.18;
  player.squashY+=(1-player.squashY)*0.18;

  // angle tilt
  player.angle = player.onGround? 0 : Math.min(Math.max(player.vy*0.04,-0.5),0.5);

  // parallax scroll
  scrollFar+=spd*0.15; scrollMid+=spd*0.3; scrollNear+=spd*0.6;

  // clouds
  clouds.forEach(c=>{
    c.x-=c.spd*(spd/CFG.baseSpeed);
    if(c.x+c.w<0) c.x=canvas.width+c.w;
  });

  // bg stars twinkle
  bgLayers[0].stars.forEach(s=>{ s.a=0.3+Math.sin(ts*0.002+s.x)*0.4; });
  bgLayers[1].stars.forEach(s=>{ s.a=0.15+Math.sin(ts*0.0015+s.y)*0.3; });

  // spawn timers
  obstacleTimer+=dt;
  if(obstacleTimer>=nextObstacleIn){
    spawnObstacle(); obstacleTimer=0;
    nextObstacleIn=rnd(CFG.obstacleInterval[0], Math.max(600, CFG.obstacleInterval[1]-score*2));
  }
  powerupTimer+=dt;
  if(powerupTimer>=nextPowerupIn){ spawnPowerup(); powerupTimer=0; nextPowerupIn=rnd(CFG.powerupInterval[0],CFG.powerupInterval[1]); }
  starTimer+=dt;
  if(starTimer>=nextStarIn){ spawnStar(); starTimer=0; nextStarIn=rnd(CFG.starInterval[0],CFG.starInterval[1]); }

  // obstacles
  obstacles.forEach(o=>{
    o.x-=spd;
    if(o.moving){
      o.travelY+=o.movDir*o.movSpd;
      if(Math.abs(o.travelY)>o.movRange) o.movDir*=-1;
      o.y=o.baseY+o.travelY;
    }
  });
  obstacles=obstacles.filter(o=>o.x+o.w>-20);

  // powerups
  powerups.forEach(p=>{ p.x-=spd*0.85; p.bob+=0.07; p.y+=Math.sin(p.bob)*0.6; });
  powerups=powerups.filter(p=>p.x+p.w>-20);

  // stars
  stars.forEach(s=>{ s.x-=spd*0.9; s.bob+=0.09; s.y+=Math.sin(s.bob)*0.5; });
  stars=stars.filter(s=>s.x+s.w>-20);

  // particles
  particles.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life-=p.decay; });
  particles=particles.filter(p=>p.life>0);

  // collision — obstacles
  const pRect={x:player.x,y:player.y,w:player.w,h:player.h};
  for(let i=obstacles.length-1;i>=0;i--){
    if(hitTest(pRect,obstacles[i])){
      if(player.shieldActive){
        player.shieldActive=false; player.shieldTimer=0;
        obstacles.splice(i,1);
        spawnParticles(player.x+player.w/2,player.y+player.h/2,'rgba(110,231,247,',16);
        document.getElementById('powerup-indicator').classList.add('hidden');
      } else { gameOver(); return; }
    }
  }

  // collision — powerups
  for(let i=powerups.length-1;i>=0;i--){
    if(hitTest(pRect,powerups[i],4)){
      sfxPowerup();
      spawnParticles(powerups[i].x+18,powerups[i].y+18,'rgba(155,93,229,',10);
      if(powerups[i].kind==='shield'){ player.shieldActive=true; player.shieldTimer=CFG.shieldDuration; showPowerupHUD('🛡'); }
      else { player.slowActive=true; player.slowTimer=CFG.slowDuration; showPowerupHUD('⏱'); }
      powerups.splice(i,1);
    }
  }

  // collision — stars
  for(let i=stars.length-1;i>=0;i--){
    if(hitTest(pRect,stars[i],4)){
      sfxStar(); score+=15; combo++; showCombo();
      spawnParticles(stars[i].x+14,stars[i].y+14,'rgba(247,201,72,',12);
      stars.splice(i,1); updateHUD();
    }
  }
}

function showPowerupHUD(icon){
  document.getElementById('powerup-icon-display').textContent=icon;
  document.getElementById('powerup-indicator').classList.remove('hidden');
}

// ── RENDER ────────────────────────────────────────────────────────
function render(ts){
  const W=canvas.width, H=canvas.height, gY=GY();
  ctx.clearRect(0,0,W,H);

  // sky gradient
  const skyGrad=ctx.createLinearGradient(0,0,0,H);
  if(player.slowActive){
    skyGrad.addColorStop(0,'#0d0038');
    skyGrad.addColorStop(0.6,'#1a0561');
    skyGrad.addColorStop(1,'#0a2a5e');
  } else {
    skyGrad.addColorStop(0,'#0e0127');
    skyGrad.addColorStop(0.55,'#1e0566');
    skyGrad.addColorStop(1,'#0a1f5e');
  }
  ctx.fillStyle=skyGrad; ctx.fillRect(0,0,W,H);

  // far stars layer
  bgLayers[0].stars.forEach(s=>{
    ctx.save();
    ctx.globalAlpha=s.a;
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // mid glow orbs
  bgLayers[1].stars.forEach(s=>{
    ctx.save();
    ctx.globalAlpha=s.a*0.7;
    const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.r*4);
    g.addColorStop(0,'rgba(155,93,229,0.8)');
    g.addColorStop(1,'transparent');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r*4,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // clouds
  clouds.forEach(c=>{
    ctx.save();
    ctx.globalAlpha=c.alpha;
    const cg=ctx.createRadialGradient(c.x+c.w/2,c.y+c.h/2,0,c.x+c.w/2,c.y+c.h/2,c.w/1.5);
    cg.addColorStop(0,`hsla(${c.hue},70%,70%,0.9)`);
    cg.addColorStop(1,'transparent');
    ctx.fillStyle=cg;
    ctx.beginPath();
    ctx.ellipse(c.x+c.w/2,c.y+c.h/2,c.w/2,c.h/2,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  // parallax hills — far
  drawHills(W,H,gY,scrollFar,'rgba(40,10,100,0.55)',3,0.12);
  // parallax hills — mid
  drawHills(W,H,gY,scrollMid,'rgba(60,15,130,0.7)',4,0.18);

  // ground
  drawGround(W,H,gY,ts);

  // stars collectibles — procedural 5-point star
  stars.forEach(s=>{
    ctx.save();
    const glow=1+Math.sin(ts*0.006+s.bob)*0.1;
    ctx.translate(s.x+s.w/2, s.y+s.h/2);
    ctx.scale(glow,glow);
    ctx.rotate(ts*0.002);
    // glow ring
    ctx.globalAlpha=0.35+Math.sin(ts*0.006)*0.2;
    const sg=ctx.createRadialGradient(0,0,0,0,0,s.w*1.2);
    sg.addColorStop(0,'rgba(247,201,72,0.7)');
    sg.addColorStop(1,'transparent');
    ctx.fillStyle=sg;
    ctx.beginPath(); ctx.arc(0,0,s.w*1.2,0,Math.PI*2); ctx.fill();
    // 5-point star shape
    ctx.globalAlpha=1;
    const R=s.w*0.55, r=s.w*0.22;
    ctx.beginPath();
    for(let i=0;i<10;i++){
      const ang=Math.PI/5*i - Math.PI/2;
      const rad=i%2===0?R:r;
      i===0?ctx.moveTo(Math.cos(ang)*rad,Math.sin(ang)*rad):ctx.lineTo(Math.cos(ang)*rad,Math.sin(ang)*rad);
    }
    ctx.closePath();
    const stG=ctx.createRadialGradient(-2,-4,1,0,0,R);
    stG.addColorStop(0,'#fff8a0');
    stG.addColorStop(0.4,'#f7c948');
    stG.addColorStop(1,'#e08800');
    ctx.fillStyle=stG; ctx.fill();
    ctx.strokeStyle='#fff5c0'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.restore();
  });

  // powerups — procedural icons
  powerups.forEach(p=>{
    ctx.save();
    const sc=1+Math.sin(ts*0.005)*0.08;
    ctx.translate(p.x+p.w/2, p.y+p.h/2);
    ctx.scale(sc,sc);
    const isShield=p.kind==='shield';
    const col=isShield?'#6ee7f7':'#c084fc';
    const col2=isShield?'#0284c7':'#7c3aed';
    // outer glow
    ctx.globalAlpha=0.3+Math.sin(ts*0.004)*0.15;
    const pg=ctx.createRadialGradient(0,0,0,0,0,p.w);
    pg.addColorStop(0,isShield?'rgba(110,231,247,0.9)':'rgba(192,132,252,0.9)');
    pg.addColorStop(1,'transparent');
    ctx.fillStyle=pg;
    ctx.beginPath(); ctx.arc(0,0,p.w,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    // circle bg
    const bg=ctx.createRadialGradient(-3,-3,1,0,0,p.w*0.48);
    bg.addColorStop(0,col); bg.addColorStop(1,col2);
    ctx.fillStyle=bg;
    ctx.beginPath(); ctx.arc(0,0,p.w*0.48,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=2;
    ctx.stroke();
    // icon
    ctx.fillStyle='#fff'; ctx.font='bold '+(p.w*0.55)+'px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(isShield?'🛡':'⏱',0,1);
    ctx.restore();
  });

  // obstacles — procedural crystal spikes
  obstacles.forEach(o=>{
    ctx.save();
    ctx.translate(o.x+o.w/2, o.y+o.h/2);
    const hue=o.hue;
    // spike glow
    ctx.globalAlpha=0.25;
    const spGlow=ctx.createRadialGradient(0,0,0,0,o.h*0.6,o.h*0.6);
    spGlow.addColorStop(0,`hsla(${hue},90%,70%,0.8)`);
    spGlow.addColorStop(1,'transparent');
    ctx.fillStyle=spGlow;
    ctx.beginPath(); ctx.arc(0,o.h*0.1,o.h*0.7,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    // main spike
    const spG=ctx.createLinearGradient(-o.w*0.3,-o.h/2,o.w*0.3,o.h/2);
    spG.addColorStop(0,`hsl(${hue},95%,85%)`);
    spG.addColorStop(0.4,`hsl(${hue},85%,60%)`);
    spG.addColorStop(1,`hsl(${hue},75%,30%)`);
    ctx.fillStyle=spG;
    ctx.beginPath();
    ctx.moveTo(0,-o.h/2);
    ctx.lineTo(o.w*0.45, o.h/2);
    ctx.lineTo(0, o.h*0.32);
    ctx.lineTo(-o.w*0.45, o.h/2);
    ctx.closePath(); ctx.fill();
    // highlight
    ctx.globalAlpha=0.55;
    ctx.fillStyle=`hsl(${hue},100%,90%)`;
    ctx.beginPath();
    ctx.moveTo(0,-o.h/2);
    ctx.lineTo(-o.w*0.1,-o.h*0.1);
    ctx.lineTo(-o.w*0.3,o.h/2);
    ctx.lineTo(-o.w*0.45,o.h/2);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha=1;
    ctx.strokeStyle=`hsl(${hue},100%,90%)`; ctx.lineWidth=1.5;
    ctx.stroke();
    // side small spikes
    const drawMiniSpike=(sx,sw,sh)=>{
      ctx.fillStyle=`hsl(${hue},80%,55%)`;
      ctx.beginPath();
      ctx.moveTo(sx,o.h/2-sh);
      ctx.lineTo(sx+sw/2,o.h/2);
      ctx.lineTo(sx-sw/2,o.h/2);
      ctx.closePath(); ctx.fill();
    };
    drawMiniSpike(-o.w*0.3,o.w*0.28,o.h*0.38);
    drawMiniSpike(o.w*0.3,o.w*0.28,o.h*0.3);
    // moving indicator ring
    if(o.moving){
      ctx.globalAlpha=0.5;
      ctx.strokeStyle='#ff6b6b'; ctx.lineWidth=2;
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.arc(0,0,o.w*0.7,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  });

  // particles
  particles.forEach(p=>{
    ctx.save();
    ctx.globalAlpha=p.life;
    ctx.fillStyle=p.color+p.life+')';
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // player
  drawPlayer(ts, gY);

  // shield aura
  if(player.shieldActive){
    ctx.save();
    ctx.globalAlpha=0.3+Math.sin(ts*0.008)*0.2;
    const sa=ctx.createRadialGradient(
      player.x+player.w/2, player.y+player.h/2, player.w*0.3,
      player.x+player.w/2, player.y+player.h/2, player.w*1.1
    );
    sa.addColorStop(0,'rgba(110,231,247,0.5)');
    sa.addColorStop(1,'transparent');
    ctx.fillStyle=sa;
    ctx.beginPath();
    ctx.arc(player.x+player.w/2, player.y+player.h/2, player.w*1.1, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle='rgba(110,231,247,0.8)'; ctx.lineWidth=2;
    ctx.setLineDash([6,4]);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  // slowmo vignette
  if(player.slowActive){
    ctx.save();
    ctx.globalAlpha=0.18;
    const vg=ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.8);
    vg.addColorStop(0,'transparent');
    vg.addColorStop(1,'rgba(80,0,180,1)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  // start idle — draw player on start screen
  if(state==='start'){
    drawIdlePlayer(W,H,ts);
  }
}

// ── DRAW HELPERS ──────────────────────────────────────────────────
function drawHills(W,H,gY,scroll,color,count,amp){
  ctx.save();
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(0,gY);
  for(let x=0;x<=W;x+=4){
    let y=gY;
    for(let i=1;i<=count;i++){
      y-=Math.sin((x+scroll*i*0.5)*0.008*i)*H*amp/i;
    }
    ctx.lineTo(x,y);
  }
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGround(W,H,gY,ts){
  // ground body
  const gg=ctx.createLinearGradient(0,gY,0,H);
  gg.addColorStop(0,'#2d0a6e');
  gg.addColorStop(0.05,'#1a0533');
  gg.addColorStop(1,'#0a0020');
  ctx.fillStyle=gg;
  ctx.fillRect(0,gY,W,H-gY);

  // glowing ground line
  ctx.save();
  const gl=ctx.createLinearGradient(0,0,W,0);
  gl.addColorStop(0,'transparent');
  gl.addColorStop(0.2,'rgba(155,93,229,0.9)');
  gl.addColorStop(0.5,'rgba(247,201,72,0.9)');
  gl.addColorStop(0.8,'rgba(110,231,247,0.9)');
  gl.addColorStop(1,'transparent');
  ctx.strokeStyle=gl; ctx.lineWidth=3;
  ctx.shadowColor='rgba(155,93,229,0.8)'; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.moveTo(0,gY); ctx.lineTo(W,gY); ctx.stroke();
  ctx.restore();

  // scrolling grid lines on ground
  ctx.save();
  ctx.globalAlpha=0.08;
  ctx.strokeStyle='rgba(155,93,229,1)'; ctx.lineWidth=1;
  const gridW=80;
  const off=(scrollNear%gridW);
  for(let x=-gridW+off;x<W+gridW;x+=gridW){
    ctx.beginPath(); ctx.moveTo(x,gY); ctx.lineTo(x-(H-gY)*0.5,H); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(ts, gY){
  const cx=player.x+player.w/2;
  const cy=player.y+player.h/2;
  const W2=player.w*0.5, H2=player.h*0.5;

  // ground shadow
  const shadowY=gY;
  const dist=Math.max(0,shadowY-(player.y+player.h));
  const shadowAlpha=Math.max(0,0.4-dist*0.004);
  ctx.save();
  ctx.globalAlpha=shadowAlpha;
  const sg=ctx.createRadialGradient(cx,shadowY,0,cx,shadowY,W2*0.9);
  sg.addColorStop(0,'rgba(0,0,50,0.6)');
  sg.addColorStop(1,'transparent');
  ctx.fillStyle=sg;
  ctx.beginPath(); ctx.ellipse(cx,shadowY,Math.max(4,W2*0.8*(1-dist*0.006)),5,0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(player.angle);
  ctx.scale(player.squashX, player.squashY);

  const t=ts*0.012;
  // cape (behind body) — flows left since running RIGHT
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-W2*0.15,-H2*0.3);
  ctx.quadraticCurveTo(-W2*0.85+Math.sin(t)*4,0,-W2*0.6+Math.sin(t*1.3)*6,H2*0.55);
  ctx.lineTo(-W2*0.1,H2*0.1);
  ctx.closePath();
  const capeG=ctx.createLinearGradient(-W2*0.8,-H2*0.3,-W2*0.1,H2*0.5);
  capeG.addColorStop(0,'#7c3aed'); capeG.addColorStop(1,'#4c1d95');
  ctx.fillStyle=capeG; ctx.fill();
  ctx.restore();

  // body — round orange
  const bodyG=ctx.createRadialGradient(-W2*0.2,-H2*0.25,W2*0.05,0,0,W2*0.9);
  bodyG.addColorStop(0,'#ffd580');
  bodyG.addColorStop(0.45,'#ff8c00');
  bodyG.addColorStop(1,'#c45000');
  ctx.fillStyle=bodyG;
  ctx.beginPath();
  ctx.ellipse(0,0,W2*0.88,H2*0.88,0,0,Math.PI*2);
  ctx.fill();
  // body outline
  ctx.strokeStyle='rgba(80,20,0,0.4)'; ctx.lineWidth=1.5; ctx.stroke();

  // eye white (RIGHT side = facing right)
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.ellipse(W2*0.32,-H2*0.25,W2*0.28,H2*0.32,0.2,0,Math.PI*2); ctx.fill();
  // pupil
  ctx.fillStyle='#1a1a2e';
  ctx.beginPath(); ctx.arc(W2*0.42,-H2*0.22,W2*0.14,0,Math.PI*2); ctx.fill();
  // eye shine
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.arc(W2*0.47,-H2*0.28,W2*0.06,0,Math.PI*2); ctx.fill();

  // smile (facing right)
  ctx.strokeStyle='rgba(80,20,0,0.7)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(W2*0.15,H2*0.15,W2*0.28,0.1,Math.PI*0.9); ctx.stroke();

  // running legs
  const legT=player.onGround? Math.sin(t*1.5)*12 : 0;
  const legCol='#c45000';
  // left leg
  ctx.fillStyle=legCol;
  ctx.beginPath(); ctx.ellipse(-W2*0.2,H2*0.72+legT,W2*0.22,H2*0.2,0.3,0,Math.PI*2); ctx.fill();
  // right leg
  ctx.beginPath(); ctx.ellipse(W2*0.15,H2*0.72-legT,W2*0.22,H2*0.2,-0.3,0,Math.PI*2); ctx.fill();
  // shoes
  ctx.fillStyle='#fbbf24';
  ctx.beginPath(); ctx.ellipse(-W2*0.2+Math.sin(t*1.5)*4,H2*0.9,W2*0.28,H2*0.16,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W2*0.15-Math.sin(t*1.5)*4,H2*0.9,W2*0.28,H2*0.16,0,0,Math.PI*2); ctx.fill();

  // arm pump (right arm forward since facing right)
  ctx.fillStyle='#ff8c00';
  const armAng=player.onGround? Math.sin(t*1.5)*0.5 : -0.6;
  ctx.save();
  ctx.rotate(armAng);
  ctx.beginPath(); ctx.ellipse(W2*0.65,H2*0.1,W2*0.2,H2*0.35,0.8,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // jump trail
  if(!player.onGround){
    ctx.globalAlpha=0.18;
    for(let i=1;i<=4;i++){
      ctx.beginPath();
      ctx.arc(-i*7,i*4,W2*(0.8-i*0.15),0,Math.PI*2);
      ctx.fillStyle=`rgba(255,140,0,${0.15-i*0.03})`;
      ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  ctx.restore();
}

function drawIdlePlayer(W,H,ts){
  // On start screen show bouncing player at center
  const gY=GY();
  const cx=W*0.5;
  const bob=Math.sin(ts*0.002)*10;
  // temporarily move player to center for drawing
  const savedX=player.x, savedY=player.y;
  player.x=cx-player.w/2;
  player.y=gY-player.h-40+bob;
  drawPlayer(ts,gY+100);
  player.x=savedX; player.y=savedY;
}

// ── BOOT ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', ()=>{
  highScore=parseInt(localStorage.getItem('ttj_hi')||'0');
  init();
});
