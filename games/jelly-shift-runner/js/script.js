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
let w=50, h=50, obs=[], dist=0;
function init() { w=50; h=50; obs=[]; dist=0; score=0; if(uiScore) uiScore.innerText = score;}
function update(dt) {
    if(input.isDown) { h = Math.max(10, Math.min(120, height/2 - input.y + 60)); w = 3000/h; }
    dist += 400*dt;
    if(Math.random()<0.015) obs.push({x: width+50, gapW: Math.random()*100+30, gapH: Math.random()*100+30});
    obs.forEach(o => { 
        o.x -= 400*dt; 
        if(o.x>width/2-30 && o.x<width/2+30) { 
            if(w>o.gapW || h>o.gapH) gameOver(); 
            else { addScore(1); o.x = -100; } 
        } 
    });
}
function draw(ctx) {
    ctx.clearRect(0,0,width,height); 
    ctx.fillStyle='#334155'; ctx.fillRect(0, height/2+60, width, height); // Floor
    
    obs.forEach(o => { 
        ctx.fillStyle='#ef4444'; 
        ctx.fillRect(o.x-10, height/2+60-150, 20, 150 - o.gapH); // Top obstacle
        ctx.fillRect(o.x-10 - o.gapW/2 - 20, height/2+60-o.gapH, 20, o.gapH); // Left
        ctx.fillRect(o.x-10 + o.gapW/2 + 20, height/2+60-o.gapH, 20, o.gapH); // Right
    });
    
    ctx.fillStyle='#3b82f6'; ctx.beginPath(); ctx.roundRect(width/2 - w/2, height/2 + 60 - h, w, h, 10); ctx.fill();
}