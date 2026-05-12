(function() {
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const menuScreen = document.getElementById('menu-screen');
const tutorialScreen = document.getElementById("tutorial-screen");
const gameUi = document.getElementById('game-ui');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const tutorialOkBtn = document.getElementById("tutorial-ok-btn");
const restartBtn = document.getElementById('restart-btn');
const scoreDisplay = document.getElementById('score-display');
const levelDisplay = document.getElementById('level-display');
const finalScoreDisplay = document.getElementById('final-score');
const healthFill = document.getElementById('health-fill');
const levelUpToast = document.getElementById('level-up-toast');

const playerImg = new Image(); playerImg.src = 'assets/images/player.png';
const enemyImg = new Image(); enemyImg.src = 'assets/images/enemy.png';

let gameState = 'MENU'; let score = 0; let level = 1; let lastTime = 0;
let particles = []; let floatingTexts = []; let shake = 0; let flash = 0; let gameLoopId = null;

function resize() { if(!canvas) return; canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
window.addEventListener('resize', resize); resize();

class Particle {
    constructor(x, y, color, sizeMultiplier=1) {
        this.x = x; this.y = y; this.vx = (Math.random() - 0.5)*15; this.vy = (Math.random() - 0.5)*15;
        this.life = 1.0; this.color = color; this.size = (Math.random()*8+4)*sizeMultiplier; this.decay = Math.random()*1.5 + 1.0;
    }
    update(dt) { this.x+=this.vx; this.y+=this.vy; this.life-=dt*this.decay; this.vx*=0.95; this.vy*=0.95; }
    draw(ctx) { ctx.save(); ctx.globalAlpha=Math.max(0, this.life); ctx.fillStyle=this.color; ctx.shadowBlur=15; ctx.shadowColor=this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size*this.life, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
}
class FloatingText {
    constructor(x, y, text, color) { this.x = x; this.y = y; this.text = text; this.color = color; this.life = 1.0; this.vy = -60; }
    update(dt) { this.y+=this.vy*dt; this.life-=dt*1.2; }
    draw(ctx) { ctx.save(); ctx.globalAlpha=Math.max(0,this.life); ctx.fillStyle=this.color; ctx.shadowBlur=10; ctx.shadowColor=this.color; ctx.font='900 32px Outfit'; ctx.textAlign='center'; ctx.fillText(this.text, this.x, this.y); ctx.restore(); }
}
function createExplosion(x,y,color,count=15) { for(let i=0; i<count; i++) particles.push(new Particle(x,y,color)); }
function spawnFloatingText(x,y,text,color='#fff') { floatingTexts.push(new FloatingText(x,y,text,color)); }

function triggerLevelUp() {
    level++; if(levelDisplay) { levelDisplay.innerText = level; levelDisplay.parentElement.style.transform='scale(1.3)'; setTimeout(()=>levelDisplay.parentElement.style.transform='scale(1)', 300); }
    if(levelUpToast) { levelUpToast.classList.add('show'); setTimeout(()=>levelUpToast.classList.remove('show'), 2000); }
    shake = 35; flash = 0.4;
}
function endGame() { gameState = 'GAMEOVER'; if(gameUi) gameUi.classList.remove('active'); if(gameOverScreen) { gameOverScreen.classList.add('active'); if(finalScoreDisplay) finalScoreDisplay.innerText = Math.floor(score); } }

if(!ctx.roundRect){ctx.roundRect=function(x,y,w,h,r){if(w<2*r)r=w/2;if(h<2*r)r=h/2;this.beginPath();this.moveTo(x+r,y);this.arcTo(x+w,y,x+w,y+h,r);this.arcTo(x+w,y+h,x,y+h,r);this.arcTo(x,y+h,x,y,r);this.arcTo(x,y,x+w,y,r);this.closePath();return this;};}


let player, cars=[], timer=0, roadOffset=0; let joystick={active:false, dirX:0, dirY:0};
class Car {
    constructor(x,y,isP) { this.x=x; this.y=y; this.isP=isP; this.w=75; this.h=140; this.speed=isP?2200:(250+level*70); this.health=100; this.vx=0; this.vy=0; }
    update(dt) {
        if(this.isP){ if(joystick.active){this.vx+=joystick.dirX*this.speed*dt; this.vy+=joystick.dirY*this.speed*dt;} this.vx*=0.85; this.vy*=0.85; this.x+=this.vx*dt; this.y+=this.vy*dt; }
        else { this.y+=this.speed*dt; if(this.y>canvas.height+200)this.dead=true; }
        this.x=Math.max(this.w/2, Math.min(canvas.width-this.w/2, this.x)); this.y=Math.max(this.h/2, Math.min(canvas.height-this.h/2, this.y));
        if(this.isP){ if(healthFill)healthFill.style.width=`${Math.max(0,this.health)}%`; if(this.health<=0)endGame(); }
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); if(!this.isP)ctx.scale(1,-1);
        ctx.shadowBlur=20; ctx.shadowColor=this.isP?'rgba(245,158,11,0.5)':'rgba(239,68,68,0.5)';
        let img = this.isP?playerImg:enemyImg; if(img.complete&&img.naturalWidth>0)ctx.drawImage(img,-this.w/2,-this.h/2,this.w,this.h); else{ctx.fillStyle=this.isP?'#f59e0b':'#ef4444'; ctx.fillRect(-this.w/2,-this.h/2,this.w,this.h);}
        ctx.restore();
    }
}
function initGame() { if(tutorialScreen) tutorialScreen.classList.remove('active'); menuScreen.classList.remove('active'); gameOverScreen.classList.remove('active'); gameUi.classList.add('active'); canvas.style.display='block'; player=new Car(canvas.width/2,canvas.height-180,true); cars=[]; score=0; level=1; roadOffset=0; particles=[]; floatingTexts=[]; if(scoreDisplay)scoreDisplay.innerText=0; if(levelDisplay)levelDisplay.innerText=1; gameState='PLAY'; lastTime=performance.now(); resize(); requestAnimationFrame(gameLoop); }
function gameLoop(t) { if(gameState!=='PLAY')return; let dt=(t-lastTime)/1000; lastTime=t; if(dt>0.1)dt=0.1;
    player.update(dt); score+=dt*(30+level*5); if(scoreDisplay)scoreDisplay.innerText=Math.floor(score); if(Math.floor(score)>level*400)triggerLevelUp();
    timer-=dt; if(timer<=0){cars.push(new Car(80+Math.random()*(canvas.width-160),-250,false)); timer=Math.max(0.3, 1.0-level*0.1);}
    cars.forEach(c=>{c.update(dt); if(Math.abs(c.x-player.x)<65 && Math.abs(c.y-player.y)<130){player.health-=40; c.dead=true; shake=35; flash=0.3; createExplosion(c.x,c.y,'#ef4444',25); spawnFloatingText(player.x,player.y-80,'CRASH!','#ef4444');}}); cars=cars.filter(c=>!c.dead);
    particles.forEach(p=>p.update(dt)); particles=particles.filter(p=>p.life>0); floatingTexts.forEach(f=>f.update(dt)); floatingTexts=floatingTexts.filter(f=>f.life>0);
    roadOffset += (500+level*50)*dt; if(roadOffset>100) roadOffset-=100;
    ctx.save(); if(shake>0){ctx.translate(Math.random()*shake-shake/2, Math.random()*shake-shake/2); shake-=dt*60;}
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Draw Road Lines directly on clear canvas (so CSS gradient shows through)
    ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=8; ctx.setLineDash([60,40]); ctx.lineDashOffset = -roadOffset; ctx.beginPath(); ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height); ctx.stroke(); ctx.setLineDash([]);
    player.draw(ctx); cars.forEach(c=>c.draw(ctx)); particles.forEach(p=>p.draw(ctx)); floatingTexts.forEach(f=>f.draw(ctx));
    if(flash>0){ctx.fillStyle=`rgba(255,255,255,${flash})`; ctx.fillRect(0,0,canvas.width,canvas.height); flash-=dt*2;} ctx.restore(); requestAnimationFrame(gameLoop);
}
const jz=document.getElementById('joystick-zone');
if(jz){ const hm=(e)=>{if(!joystick.active)return; let r=jz.getBoundingClientRect(), cx=e.touches?e.touches[0].clientX:e.clientX, cy=e.touches?e.touches[0].clientY:e.clientY, dx=cx-(r.left+r.width/2), dy=cy-(r.top+r.height/2), d=Math.sqrt(dx*dx+dy*dy); if(d>0){joystick.dirX=dx/d; joystick.dirY=dy/d;}}; jz.addEventListener('touchstart', (e)=>{joystick.active=true; hm(e);}, {passive:false}); jz.addEventListener('mousedown', (e)=>{joystick.active=true; hm(e);}); window.addEventListener('touchmove', (e)=>{if(joystick.active){e.preventDefault(); hm(e);}}, {passive:false}); window.addEventListener('mousemove', (e)=>{if(joystick.active)hm(e);}); window.addEventListener('touchend', ()=>{joystick.active=false; joystick.dirX=0; joystick.dirY=0;}); window.addEventListener('mouseup', ()=>{joystick.active=false; joystick.dirX=0; joystick.dirY=0;}); }


if(startBtn) startBtn.onclick = () => { menuScreen.classList.remove('active'); gameOverScreen.classList.remove('active'); if(tutorialScreen) tutorialScreen.classList.add('active'); };
if(restartBtn) restartBtn.onclick = () => { menuScreen.classList.remove('active'); gameOverScreen.classList.remove('active'); if(tutorialScreen) tutorialScreen.classList.add('active'); };
if(tutorialOkBtn) tutorialOkBtn.onclick = initGame;

})();
