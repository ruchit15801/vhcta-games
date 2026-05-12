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


let player, enemies=[], enemySpawnTimer=0; let joystick={active:false, dirX:0, dirY:0};
class Player {
    constructor() { this.x=canvas.width/2; this.y=canvas.height/2; this.vx=0; this.vy=0; this.size=75; this.speed=1800; this.health=100; this.dir=1; this.atk=0; this.sq=1; }
    update(dt) {
        if(joystick.active) { this.vx += joystick.dirX * this.speed * dt; this.vy += joystick.dirY * this.speed * dt; if(Math.abs(joystick.dirX)>0.1) this.dir=joystick.dirX>0?1:-1; this.sq=1+Math.sin(Date.now()*0.015)*0.06; } else { this.sq=1; }
        this.vx *= 0.85; this.vy *= 0.85; this.x += this.vx * dt; this.y += this.vy * dt;
        this.x = Math.max(this.size/2, Math.min(canvas.width-this.size/2, this.x)); this.y = Math.max(this.size/2, Math.min(canvas.height-this.size/2, this.y));
        if(healthFill) healthFill.style.width=`${Math.max(0,this.health)}%`; if(this.health<=0) endGame(); if(this.atk>0) this.atk-=dt;
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.dir*this.sq, 1/this.sq);
        ctx.shadowBlur=20; ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, this.size/2.5, this.size/2.5, 10, 0, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
        if(playerImg.complete && playerImg.naturalWidth>0) ctx.drawImage(playerImg, -this.size/2, -this.size/2, this.size, this.size); else { ctx.fillStyle='#f59e0b'; ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size); }
        if(this.atk>0.2) { ctx.beginPath(); ctx.arc(this.size/2, 0, 110, -Math.PI/2, Math.PI/2); ctx.lineWidth=18; ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.shadowBlur=25; ctx.shadowColor='#fff'; ctx.stroke(); }
        ctx.restore();
    }
    attack() {
        if(this.atk<=0) {
            this.atk=0.4; let hit=false;
            enemies.forEach(e=>{ let dx=e.x-this.x, dy=e.y-this.y, d=Math.sqrt(dx*dx+dy*dy); if(d<150 && ((this.dir>0&&dx>0)||(this.dir<0&&dx<0))){ e.dead=true; score+=10; if(scoreDisplay) scoreDisplay.innerText=score; createExplosion(e.x,e.y,'#f59e0b',20); spawnFloatingText(e.x,e.y,'+10','#10b981'); if(score%100===0)triggerLevelUp(); hit=true; } });
            if(hit){ shake=18; flash=0.15; }
        }
    }
}
class Obstacle {
    constructor() { this.x=Math.random()>0.5?-80:canvas.width+80; this.y=Math.random()*canvas.height; this.size=65; this.speed=(100+Math.random()*80)*(1+level*0.25); this.atkcd=0; }
    update(dt) { let dx=player.x-this.x, dy=player.y-this.y, d=Math.sqrt(dx*dx+dy*dy); if(d>55){ this.x+=(dx/d)*this.speed*dt; this.y+=(dy/d)*this.speed*dt; } else if(this.atkcd<=0){ player.health-=15+level*2; this.atkcd=1.2; shake=25; flash=0.2; spawnFloatingText(player.x,player.y-40,'-HP','#ef4444'); } if(this.atkcd>0) this.atkcd-=dt; }
    draw(ctx) { ctx.save(); ctx.translate(this.x, this.y); ctx.scale(player.x>this.x?1:-1, 1); ctx.shadowBlur=15; ctx.shadowColor='rgba(239,68,68,0.5)'; if(enemyImg.complete && enemyImg.naturalWidth>0) ctx.drawImage(enemyImg, -this.size/2, -this.size/2, this.size, this.size); else { ctx.fillStyle='#ef4444'; ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size); } ctx.restore(); }
}
function initGame() { if(tutorialScreen) tutorialScreen.classList.remove('active'); menuScreen.classList.remove('active'); gameOverScreen.classList.remove('active'); gameUi.classList.add('active'); canvas.style.display='block'; player=new Player(); enemies=[]; score=0; level=1; particles=[]; floatingTexts=[]; if(scoreDisplay)scoreDisplay.innerText=0; if(levelDisplay)levelDisplay.innerText=1; gameState='PLAY'; lastTime=performance.now(); resize(); requestAnimationFrame(gameLoop); }
function gameLoop(t) { if(gameState!=='PLAY')return; let dt=(t-lastTime)/1000; lastTime=t; if(dt>0.1)dt=0.1;
    player.update(dt); enemySpawnTimer-=dt; if(enemySpawnTimer<=0){enemies.push(new Enemy()); enemySpawnTimer=Math.max(0.3, 1.3-level*0.15);}
    enemies.forEach(e=>e.update(dt)); enemies=enemies.filter(e=>!e.dead); particles.forEach(p=>p.update(dt)); particles=particles.filter(p=>p.life>0); floatingTexts.forEach(f=>f.update(dt)); floatingTexts=floatingTexts.filter(f=>f.life>0);
    ctx.save(); if(shake>0){ctx.translate(Math.random()*shake-shake/2, Math.random()*shake-shake/2); shake-=dt*60;}
    ctx.clearRect(0,0,canvas.width,canvas.height); player.draw(ctx); enemies.forEach(e=>e.draw(ctx)); particles.forEach(p=>p.draw(ctx)); floatingTexts.forEach(f=>f.draw(ctx));
    if(flash>0){ctx.fillStyle=`rgba(255,255,255,${flash})`; ctx.fillRect(0,0,canvas.width,canvas.height); flash-=dt*2;} ctx.restore(); gameLoopId=requestAnimationFrame(gameLoop);
}
const actionBtn=document.getElementById('action-btn'), jz=document.getElementById('joystick-zone');
if(actionBtn) actionBtn.ontouchstart=(e)=>{e.preventDefault();player&&player.attack();}; if(actionBtn) actionBtn.onmousedown=()=>player&&player.attack();
if(jz){ const hm=(e)=>{if(!joystick.active)return; let r=jz.getBoundingClientRect(), cx=e.touches?e.touches[0].clientX:e.clientX, cy=e.touches?e.touches[0].clientY:e.clientY, dx=cx-(r.left+r.width/2), dy=cy-(r.top+r.height/2), d=Math.sqrt(dx*dx+dy*dy); if(d>0){joystick.dirX=dx/d; joystick.dirY=dy/d;}}; jz.addEventListener('touchstart', (e)=>{joystick.active=true; hm(e);}, {passive:false}); jz.addEventListener('mousedown', (e)=>{joystick.active=true; hm(e);}); window.addEventListener('touchmove', (e)=>{if(joystick.active){e.preventDefault(); hm(e);}}, {passive:false}); window.addEventListener('mousemove', (e)=>{if(joystick.active)hm(e);}); window.addEventListener('touchend', ()=>{joystick.active=false; joystick.dirX=0; joystick.dirY=0;}); window.addEventListener('mouseup', ()=>{joystick.active=false; joystick.dirX=0; joystick.dirY=0;}); }


if(startBtn) startBtn.onclick = () => { menuScreen.classList.remove('active'); gameOverScreen.classList.remove('active'); if(tutorialScreen) tutorialScreen.classList.add('active'); };
if(restartBtn) restartBtn.onclick = () => { menuScreen.classList.remove('active'); gameOverScreen.classList.remove('active'); if(tutorialScreen) tutorialScreen.classList.add('active'); };
if(tutorialOkBtn) tutorialOkBtn.onclick = initGame;

})();
