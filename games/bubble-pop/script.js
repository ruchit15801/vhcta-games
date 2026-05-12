// ===================== CONSTANTS =====================
const CW = 400, CH = 572;
const R = 20, D = 40; // bubble radius & diameter
const ROW_H = 35;     // vertical distance between row centers
const COLS_E = 10, COLS_O = 9; // even/odd row bubble counts
const GRID_ROWS = 12;
const SX = 200, SY = 512; // shooter center
const SPEED = 11;
const DANGER_ROW = 9;
const MAX_LIVES = 3;
const NEIGHBOR_THRESH = 44; // distance for honeycomb adjacency

const PALETTE = [
  {fill:'#FF3366',glow:'rgba(255,51,102,0.8)'},
  {fill:'#FF7A00',glow:'rgba(255,122,0,0.8)'},
  {fill:'#FFD700',glow:'rgba(255,215,0,0.8)'},
  {fill:'#00E676',glow:'rgba(0,230,118,0.8)'},
  {fill:'#00B4FF',glow:'rgba(0,180,255,0.8)'},
  {fill:'#E040FB',glow:'rgba(224,64,251,0.8)'},
  {fill:'#FF80AB',glow:'rgba(255,128,171,0.8)'},
];

// ===================== STATE =====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let grid, score, best, lives, level, gameState;
let curColor, nxtColor;
let bullet; // {x,y,vx,vy,color}
let particles, floatTexts;
let aimAngle = -Math.PI/2;
let cooldown = 0;
let missCount = 0;
let soundEnabled = true;
let curStep = 1;

best = +localStorage.getItem('nbp_best')||0;
document.getElementById('bestEl').textContent = best;
gameState = 'start';

window.nextGuideStep = function() {
  const steps = document.querySelectorAll('.guide-step');
  const dots = document.querySelectorAll('.dot');
  
  if (curStep < steps.length) {
    steps[curStep-1].classList.remove('active');
    dots[curStep-1].classList.remove('active');
    curStep++;
    steps[curStep-1].classList.add('active');
    dots[curStep-1].classList.add('active');
    
    if (curStep === steps.length) {
      document.getElementById('nextBtn').style.display = 'none';
      document.getElementById('playBtn').style.display = 'inline-block';
    }
    playSound('stick');
  }
};

window.toggleSound = function() {
  soundEnabled = !soundEnabled;
  document.getElementById('soundToggle').textContent = soundEnabled ? '🔊' : '🔇';
  if (soundEnabled && ac && ac.state === 'suspended') {
      ac.resume();
  }
};

// ===================== JUICE =====================
function triggerShake() {
  const wrapper = document.querySelector('.game-wrapper');
  wrapper.classList.remove('shake');
  void wrapper.offsetWidth; // trigger reflow
  wrapper.classList.add('shake');
  setTimeout(() => wrapper.classList.remove('shake'), 400);
}

// ===================== GRID HELPERS =====================
function cols(r){ return r%2===0 ? COLS_E : COLS_O; }
function pos(r,c){ return {x: r%2===0 ? 20+c*40 : 40+c*40, y: 20+r*ROW_H}; }

function initGrid(){
  grid = Array.from({length:GRID_ROWS},(_,r)=>new Array(cols(r)).fill(-1));
  const nColors = Math.min(3+level, PALETTE.length);
  const fillRows = Math.min(4+level, DANGER_ROW-1);
  for(let r=0;r<fillRows;r++){
    for(let c=0;c<cols(r);c++){
      grid[r][c] = Math.random()<0.88 ? Math.floor(Math.random()*nColors) : -1;
    }
  }
  // Ensure no isolated colors
  for(let r=1;r<fillRows;r++){
    for(let c=0;c<cols(r);c++){
      if(grid[r][c]!==-1 && Math.random()<0.4){
        const nbrs = neighbors(r,c).filter(([nr,nc])=>grid[nr][nc]!==-1);
        if(nbrs.length>0){
          const [nr,nc]=nbrs[Math.floor(Math.random()*nbrs.length)];
          grid[r][c]=grid[nr][nc];
        }
      }
    }
  }
}

function neighbors(r,c){
  const p=pos(r,c), res=[];
  for(let nr=Math.max(0,r-1);nr<=Math.min(GRID_ROWS-1,r+1);nr++){
    for(let nc=0;nc<cols(nr);nc++){
      if(nr===r&&nc===c)continue;
      const np=pos(nr,nc);
      if(Math.hypot(p.x-np.x,p.y-np.y)<=NEIGHBOR_THRESH) res.push([nr,nc]);
    }
  }
  return res;
}

function colorsInGrid(){
  const s=new Set();
  for(let r=0;r<GRID_ROWS;r++) for(let c=0;c<cols(r);c++) if(grid[r][c]!==-1) s.add(grid[r][c]);
  return [...s];
}

function randColor(){
  const present = colorsInGrid();
  if(present.length===0) return Math.floor(Math.random()*PALETTE.length);
  return Math.random()<0.88 ? present[Math.floor(Math.random()*present.length)]
                             : Math.floor(Math.random()*PALETTE.length);
}

// ===================== MATCHING =====================
function bfsMatch(r,c,color){
  const visited=new Set(), queue=[[r,c]], res=[];
  while(queue.length){
    const [cr,cc]=queue.shift(), key=cr+','+cc;
    if(visited.has(key))continue;
    visited.add(key);
    if(grid[cr][cc]===color){
      res.push([cr,cc]);
      for(const [nr,nc] of neighbors(cr,cc))
        if(!visited.has(nr+','+nc)&&grid[nr][nc]===color) queue.push([nr,nc]);
    }
  }
  return res;
}

function findFloating(){
  const connected=new Set(), queue=[];
  for(let c=0;c<cols(0);c++) if(grid[0][c]!==-1){queue.push([0,c]);connected.add('0,'+c);}
  while(queue.length){
    const [r,c]=queue.shift();
    for(const [nr,nc] of neighbors(r,c)){
      const key=nr+','+nc;
      if(!connected.has(key)&&grid[nr][nc]!==-1){connected.add(key);queue.push([nr,nc]);}
    }
  }
  const floating=[];
  for(let r=0;r<GRID_ROWS;r++) for(let c=0;c<cols(r);c++)
    if(grid[r][c]!==-1&&!connected.has(r+','+c)) floating.push([r,c]);
  return floating;
}

function isGridClear(){
  for(let r=0;r<GRID_ROWS;r++) for(let c=0;c<cols(r);c++) if(grid[r][c]!==-1) return false;
  return true;
}

// ===================== PLACE BUBBLE =====================
function placeBubble(r,c,color){
  if(r<0||r>=GRID_ROWS||c<0||c>=cols(r))return;
  grid[r][c]=color;
  const matches=bfsMatch(r,c,color);

  if(matches.length>=3){
    if(matches.length>=5) triggerShake();
    let pts=0;
    matches.forEach(([mr,mc])=>{
      const p=pos(mr,mc); spawnParticles(p.x,p.y,PALETTE[color].fill);
      grid[mr][mc]=-1; pts+=10;
    });
    const floating=findFloating();
    if(floating.length > 0) triggerShake();
    floating.forEach(([fr,fc])=>{
      const p=pos(fr,fc); spawnParticles(p.x,p.y,PALETTE[grid[fr][fc]].fill);
      grid[fr][fc]=-1; pts+=5;
    });
    const multiplier=Math.max(1,Math.floor(matches.length/3));
    pts*=multiplier;
    score+=pts;
    missCount=0;

    const p=pos(r,c);
    const label=multiplier>1?`COMBO x${multiplier}! +${pts}`:`+${pts}`;
    const col=multiplier>1?'#FFD700':'#ffffff';
    pushText(label, CW/2, multiplier>1?CH/2:p.y-24, col);
    playSound(multiplier>1?'combo':'pop');

    updateUI();
    if(isGridClear()) setTimeout(nextLevel,600);
  } else {
    missCount++;
    playSound('stick');
    for(let dc=0;dc<cols(DANGER_ROW);dc++){
      if(grid[DANGER_ROW][dc]!==-1){ loseLife(); return; }
    }
    if(missCount>=8){ missCount=0; shiftGridDown(); triggerShake(); }
  }
  nextShot();
}

function shiftGridDown(){
  for(let r=GRID_ROWS-1;r>0;r--){
    for(let c=0;c<cols(r);c++){
      const prevCols=cols(r-1);
      if(r%2===0){
        grid[r][c] = c<prevCols ? grid[r-1][c] : -1;
      } else {
        grid[r][c] = grid[r-1][c] !== undefined ? grid[r-1][c] : -1;
      }
    }
  }
  const nColors=Math.min(3+level,PALETTE.length);
  for(let c=0;c<cols(0);c++) grid[0][c]=Math.random()<0.6?Math.floor(Math.random()*nColors):-1;

  for(let dc=0;dc<cols(DANGER_ROW);dc++){
    if(grid[DANGER_ROW][dc]!==-1){ loseLife(); return; }
  }
  pushText('⚠️ WATCH OUT!', CW/2, CH/2+40, '#FF3366');
}

function loseLife(){
  lives--;
  updateUI();
  playSound('lose');
  triggerShake();
  for(let r=DANGER_ROW;r<GRID_ROWS;r++) for(let c=0;c<cols(r);c++) grid[r][c]=-1;
  if(lives<=0){
    setTimeout(()=>{
      document.getElementById('finalScoreEl').textContent=score;
      const msg=score>500?'🔥 Incredible score!':score>200?'✨ Great run!':'Keep practicing, bubble master!';
      document.getElementById('gameOverMsg').textContent=msg;
      document.getElementById('gameOverScreen').style.display='flex';
      gameState='over';
    },400);
  } else {
    pushText(`💔 ${lives} ${lives===1?'life':'lives'} left!`, CW/2, CH/2, '#FF3366');
  }
}

function nextLevel(){
  level++;
  score+=level*50;
  initGrid();
  curColor=randColor(); nxtColor=randColor();
  missCount=0;
  pushText(`⭐ LEVEL ${level}!`, CW/2, CH/2, '#00E676');
  playSound('level');
  updateUI();
  triggerShake();
}

function nextShot(){
  curColor=nxtColor;
  nxtColor=randColor();
}

// ===================== BULLET =====================
window.shoot = function(){
  if(bullet||cooldown>0||gameState!=='playing')return;
  const angle=Math.max(-Math.PI+0.18, Math.min(-0.18, aimAngle));
  bullet={x:SX,y:SY,vx:Math.cos(angle)*SPEED,vy:Math.sin(angle)*SPEED,color:curColor};
  cooldown=8;
  playSound('shoot');
};

function updateBullet(){
  if(!bullet)return;
  bullet.x+=bullet.vx; bullet.y+=bullet.vy;
  if(bullet.x-R<0){bullet.x=R;bullet.vx=Math.abs(bullet.vx);}
  if(bullet.x+R>CW){bullet.x=CW-R;bullet.vx=-Math.abs(bullet.vx);}
  if(bullet.y-R<=0){
    bullet.y=R;
    stickBullet(); return;
  }
  for(let r=0;r<GRID_ROWS;r++){
    for(let c=0;c<cols(r);c++){
      if(grid[r][c]===-1)continue;
      const p=pos(r,c);
      if(Math.hypot(p.x-bullet.x,p.y-bullet.y)<D-2){
        stickBullet(); return;
      }
    }
  }
  if(bullet.y>CH+50){ bullet=null; nextShot(); missCount++; }
}

function stickBullet(){
  if(!bullet)return;
  let bestSlot=null, bestDist=Infinity;
  for(let r=0;r<GRID_ROWS;r++){
    for(let c=0;c<cols(r);c++){
      if(grid[r][c]!==-1)continue;
      const p=pos(r,c);
      const d=Math.hypot(p.x-bullet.x,p.y-bullet.y);
      if(d<bestDist){bestDist=d;bestSlot=[r,c];}
    }
  }
  const bc=bullet.color; bullet=null;
  if(bestSlot&&bestDist<=D*1.5) placeBubble(bestSlot[0],bestSlot[1],bc);
  else nextShot();
}

// ===================== PARTICLES =====================
function spawnParticles(x,y,color){
  for(let i=0;i<18;i++){
    const a=(Math.PI*2/18)*i+Math.random()*0.4;
    const sp=1.5+Math.random()*5.5;
    particles.push({
      x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
      color,a:1,sz:2+Math.random()*6,
      rot:Math.random()*Math.PI*2,
      rv: (Math.random()-0.5)*0.2
    });
  }
}

function pushText(text,x,y,color){
  floatTexts.push({text,x,y,color,a:1,dy:-1.2,scale:1.2});
}

// ===================== AUDIO =====================
let ac=null;
function getAC(){ if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)(); return ac; }
function playSound(type){
  if(!soundEnabled) return;
  try{
    const a=getAC();
    if(a.state === 'suspended') a.resume();
    const o=a.createOscillator(), g=a.createGain();
    o.connect(g);g.connect(a.destination);
    if(type==='shoot'){
      o.type='square';o.frequency.setValueAtTime(300,a.currentTime);
      o.frequency.exponentialRampToValueAtTime(150,a.currentTime+0.08);
      g.gain.setValueAtTime(0.08,a.currentTime);g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.1);
    }else if(type==='pop'){
      o.type='sine';o.frequency.setValueAtTime(700,a.currentTime);
      o.frequency.exponentialRampToValueAtTime(1400,a.currentTime+0.12);
      g.gain.setValueAtTime(0.15,a.currentTime);g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.18);
    }else if(type==='combo'){
      o.type='sine';o.frequency.setValueAtTime(500,a.currentTime);
      o.frequency.exponentialRampToValueAtTime(1600,a.currentTime+0.25);
      g.gain.setValueAtTime(0.2,a.currentTime);g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.3);
    }else if(type==='stick'){
      o.type='triangle';o.frequency.setValueAtTime(200,a.currentTime);
      g.gain.setValueAtTime(0.06,a.currentTime);g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.06);
    }else if(type==='lose'){
      o.type='sawtooth';o.frequency.setValueAtTime(400,a.currentTime);
      o.frequency.exponentialRampToValueAtTime(100,a.currentTime+0.4);
      g.gain.setValueAtTime(0.12,a.currentTime);g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.45);
    }else if(type==='level'){
      o.type='sine';o.frequency.setValueAtTime(400,a.currentTime);
      o.frequency.setValueAtTime(600,a.currentTime+0.1);
      o.frequency.setValueAtTime(800,a.currentTime+0.2);
      g.gain.setValueAtTime(0.18,a.currentTime);g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.4);
    }
    o.start(a.currentTime); o.stop(a.currentTime+0.6);
  }catch(e){}
}

// ===================== DRAWING =====================
function drawBubble(x,y,ci,radius,alpha=1){
  if(ci<0)return;
  const pal=PALETTE[ci];
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.shadowColor=pal.fill;ctx.shadowBlur=14;
  const gr=ctx.createRadialGradient(x-radius*0.32,y-radius*0.38,radius*0.08,x,y,radius);
  const c=pal.fill;
  gr.addColorStop(0,lighten(c,55));
  gr.addColorStop(0.45,c);
  gr.addColorStop(1,darken(c,45));
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);
  ctx.fillStyle=gr;ctx.fill();
  ctx.shadowBlur=0;
  const sh=ctx.createRadialGradient(x-radius*0.32,y-radius*0.42,0,x-radius*0.18,y-radius*0.22,radius*0.6);
  sh.addColorStop(0,'rgba(255,255,255,0.65)');sh.addColorStop(1,'rgba(255,255,255,0)');
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle=sh;ctx.fill();
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,255,255,0.22)';ctx.lineWidth=1.5;ctx.stroke();
  ctx.restore();
}

function lighten(hex,a){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,r+a)},${Math.min(255,g+a)},${Math.min(255,b+a)})`;
}
function darken(hex,a){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,r-a)},${Math.max(0,g-a)},${Math.max(0,b-a)})`;
}

function drawGrid(){
  for(let r=0;r<GRID_ROWS;r++){
    for(let c=0;c<cols(r);c++){
      if(grid[r][c]===-1)continue;
      const p=pos(r,c);
      drawBubble(p.x,p.y,grid[r][c],R);
    }
  }
}

function drawAimLine(){
  const angle=Math.max(-Math.PI+0.18,Math.min(-0.18,aimAngle));
  let lx=SX,ly=SY;
  let vx=Math.cos(angle),vy=Math.sin(angle);
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,0.18)';
  ctx.lineWidth=1.5;ctx.setLineDash([7,7]);
  ctx.beginPath();ctx.moveTo(lx,ly);
  for(let i=0;i<40;i++){
    lx+=vx*13;ly+=vy*13;
    if(lx-R<0){lx=R;vx=Math.abs(vx);}
    if(lx+R>CW){lx=CW-R;vx=-Math.abs(vx);}
    if(ly<R)break;
    ctx.lineTo(lx,ly);
  }
  ctx.stroke();ctx.setLineDash([]);ctx.restore();
}

function drawShooter(){
  drawAimLine();
  ctx.save();
  const pg=ctx.createLinearGradient(SX-60,0,SX+60,0);
  pg.addColorStop(0,'transparent');pg.addColorStop(0.5,'rgba(255,255,255,0.12)');pg.addColorStop(1,'transparent');
  ctx.fillStyle=pg;ctx.fillRect(SX-60,SY+R+2,120,3);
  drawBubble(SX,SY,curColor,R+2);
  ctx.fillStyle='rgba(255,255,255,0.28)';ctx.font='8px Nunito';
  ctx.textAlign='center';ctx.fillText('NEXT',SX+62,SY-12);
  drawBubble(SX+62,SY+5,nxtColor,R*0.65);
  ctx.restore();
}

function drawBackground(){
  ctx.clearRect(0,0,CW,CH); // clear the canvas area (transparent background is driven by CSS)
  // Subtle grid
  ctx.strokeStyle='rgba(255,255,255,0.025)';ctx.lineWidth=1;
  for(let x=0;x<CW;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,CH);ctx.stroke();}
  // Danger zone
  const dangerY=DANGER_ROW*ROW_H+R*2;
  ctx.strokeStyle='rgba(255,30,30,0.18)';ctx.lineWidth=1.5;
  ctx.setLineDash([6,6]);
  ctx.beginPath();ctx.moveTo(0,dangerY);ctx.lineTo(CW,dangerY);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle='rgba(255,50,50,0.1)';
  ctx.fillRect(0,dangerY,CW,CH-dangerY);
  ctx.fillStyle='rgba(255,80,80,0.35)';ctx.font='10px Nunito';
  ctx.textAlign='left';ctx.fillText('⚠ DANGER ZONE',6,dangerY-4);
}

function drawParticles(){
  particles.forEach(p=>{
    ctx.save();ctx.globalAlpha=p.a;
    ctx.shadowColor=p.color;ctx.shadowBlur=8;
    ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,Math.PI*2);ctx.fill();
    ctx.restore();
  });
}

function drawFloatTexts(){
  floatTexts.forEach(t=>{
    ctx.save();ctx.globalAlpha=t.a;
    ctx.font=`bold ${Math.round(18*t.scale)}px 'Fredoka One',cursive`;
    ctx.textAlign='center';ctx.fillStyle=t.color;
    ctx.shadowColor=t.color;ctx.shadowBlur=12;
    ctx.fillText(t.text,t.x,t.y);
    ctx.restore();
  });
}

function drawBullet(){
  if(!bullet)return;
  drawBubble(bullet.x,bullet.y,bullet.color,R);
}

// ===================== UPDATE =====================
function update(){
  if(gameState!=='playing')return;
  if(cooldown>0)cooldown--;
  updateBullet();
  particles=particles.filter(p=>p.a>0.02);
  particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.18;p.a-=0.024;p.sz*=0.97;});
  floatTexts=floatTexts.filter(t=>t.a>0.02);
  floatTexts.forEach(t=>{t.y+=t.dy;t.a-=0.018;t.scale=Math.max(1,t.scale-0.02);});
}

function render(){
  drawBackground();
  if(gameState!=='start'){
    drawGrid();
    if(gameState==='playing'){
      drawShooter();
      drawBullet();
    }
    drawParticles();
    drawFloatTexts();
  }
}

function loop(){
  update();render();
  requestAnimationFrame(loop);
}

// ===================== UI =====================
function updateUI(){
  document.getElementById('scoreEl').textContent=score;
  document.getElementById('levelEl').textContent=level;
  document.getElementById('livesEl').textContent='❤️'.repeat(lives)+'🖤'.repeat(Math.max(0,MAX_LIVES-lives));
  if(score>best){best=score;localStorage.setItem('nbp_best',best);}
  document.getElementById('bestEl').textContent=best;
}

// ===================== GAME FLOW =====================
window.startGame = function(){
  score=0;lives=MAX_LIVES;level=1;
  particles=[];floatTexts=[];bullet=null;missCount=0;
  initGrid();
  curColor=randColor();nxtColor=randColor();
  gameState='playing';
  document.getElementById('startScreen').style.display='none';
  document.getElementById('gameOverScreen').style.display='none';
  updateUI();
  if (soundEnabled && ac && ac.state === 'suspended') ac.resume();
};

// ===================== INPUT (RESPONSIVE) =====================
canvas.addEventListener('mousemove',e=>{
  if(gameState !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  aimAngle = Math.atan2(my - SY, mx - SX);
});

canvas.addEventListener('click',()=>{if(gameState==='playing')shoot();});

canvas.addEventListener('touchmove',e=>{
  if(gameState !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const t = e.touches[0];
  const mx = (t.clientX - rect.left) * scaleX;
  const my = (t.clientY - rect.top) * scaleY;
  aimAngle = Math.atan2(my - SY, mx - SX);
},{passive:false}); // note: passive:false is crucial since body has touch-action:none but we might still want to prevent default if needed, though browser handles it.

canvas.addEventListener('touchend',e=>{
  if(e.target === canvas) {
      if(gameState==='playing') shoot();
  }
});

// ===================== DECORATIONS =====================
const starsEl=document.getElementById('stars');
for(let i=0;i<80;i++){
  const s=document.createElement('div');s.className='star';
  const sz=0.5+Math.random()*2;
  s.style.cssText=`width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*100}%;
    animation-duration:${2+Math.random()*4}s;animation-delay:${-Math.random()*6}s;`;
  starsEl.appendChild(s);
}
const bbEl=document.getElementById('bgBubbles');
const bgColors=['#FF3366','#FF7A00','#FFD700','#00E676','#00B4FF','#E040FB','#FF80AB'];
for(let i=0;i<18;i++){
  const d=document.createElement('div');d.className='bg-bubble';
  const sz=15+Math.random()*55;
  d.style.cssText=`width:${sz}px;height:${sz}px;background:${bgColors[i%7]};
    left:${Math.random()*100}vw;
    animation-duration:${10+Math.random()*18}s;animation-delay:${-Math.random()*25}s;`;
  bbEl.appendChild(d);
}

loop();
