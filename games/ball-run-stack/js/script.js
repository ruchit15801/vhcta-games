const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;
window.addEventListener('resize', () => { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; });

let gameState = 'START';
let score = 0;
let uiScore = document.getElementById('score');
let finalScore = document.getElementById('final-score');
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); if(id) document.getElementById(id).classList.add('active'); }
document.getElementById('start-btn').addEventListener('click', () => { init(); gameState = 'PLAY'; show('game-ui'); requestAnimationFrame(loop); });
document.getElementById('retry-btn').addEventListener('click', () => { init(); gameState = 'PLAY'; show('game-ui'); requestAnimationFrame(loop); });
if(document.getElementById('pause-btn')) document.getElementById('pause-btn').addEventListener('click', () => { gameState = 'PAUSE'; show('pause-screen'); });
if(document.getElementById('resume-btn')) document.getElementById('resume-btn').addEventListener('click', () => { gameState = 'PLAY'; show('game-ui'); requestAnimationFrame(loop); });

let input = { x: width/2, y: height/2, isDown: false, justPressed: false };
const setInput = (e) => { input.x = e.touches ? e.touches[0].clientX : e.clientX; input.y = e.touches ? e.touches[0].clientY : e.clientY; };
window.addEventListener('mousedown', e => { input.isDown = true; input.justPressed = true; setInput(e); });
window.addEventListener('mousemove', e => { if(input.isDown) setInput(e); });
window.addEventListener('mouseup', () => input.isDown = false);
window.addEventListener('touchstart', e => { input.isDown = true; input.justPressed = true; setInput(e); }, {passive: false});
window.addEventListener('touchmove', e => { if(input.isDown) setInput(e); }, {passive: false});
window.addEventListener('touchend', () => input.isDown = false);

let lastTime = 0;
function loop(time) {
    if(gameState !== 'PLAY') return;
    let dt = Math.min((time - lastTime)/1000 || 0.016, 0.05);
    lastTime = time;
    update(dt);
    draw(ctx);
    input.justPressed = false;
    if(gameState === 'PLAY') requestAnimationFrame(loop);
}
function gameOver() { gameState = 'GAMEOVER'; if(finalScore) finalScore.innerText = score; show('gameover-screen'); }
function addScore(n) { score += n; if(uiScore) uiScore.innerText = score; }
let x=width/2, stack=1, obs=[], dist=0;
function init() { x=width/2; stack=1; obs=[]; dist=0; score=0; if(uiScore) uiScore.innerText = score;}
function update(dt) {
    x += (input.x - x)*12*dt; dist+=350*dt;
    if(Math.random()<0.04) obs.push({y: -50, type: Math.random()<0.4?'ball':'gap', x: Math.random()*(width-100)+50, hit:false});
    obs.forEach(o => {
        o.y += 350*dt;
        if(o.y>height-100 && o.y<height-50 && Math.abs(o.x-x)<30 && !o.hit) {
            o.hit=true;
            if(o.type=='ball') { stack++; addScore(1); } 
            else { stack--; if(stack<=0) gameOver(); }
        }
    });
}
function draw(ctx) {
    ctx.clearRect(0,0,width,height);
    // Draw track
    ctx.fillStyle='#334155'; ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#475569'; ctx.fillRect(40,0,width-80,height);
    
    obs.forEach(o => { 
        if(!o.hit){ 
            if(o.type=='ball') { ctx.fillStyle='#3b82f6'; ctx.beginPath(); ctx.arc(o.x, o.y, 15, 0, 7); ctx.fill(); }
            else { ctx.fillStyle='#ef4444'; ctx.fillRect(o.x-20, o.y-10, 40, 20); }
        } 
    });
    for(let i=0;i<stack;i++) { ctx.fillStyle='#3b82f6'; ctx.beginPath(); ctx.arc(x, height-50 - i*18, 15, 0, 7); ctx.fill(); }
}