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
let crowd=1, x=width/2, dist=0, gates=[], enemies=[];
function init() { crowd=1; x=width/2; dist=0; gates=[]; enemies=[]; score=0; if(uiScore) uiScore.innerText = score;}
function update(dt) {
    x += (input.x - x) * 10 * dt; dist += 200 * dt;
    if(Math.random() < 0.02) gates.push({y: -50, val: Math.random()<0.5?'+10':'x2', x: Math.random()*(width-100)+50, hit:false});
    if(Math.random() < 0.01) enemies.push({y: -50, count: Math.floor(Math.random()*20)+5, x: Math.random()*(width-100)+50, hit:false});
    
    gates.forEach(g => { 
        g.y += 200*dt; 
        if(g.y>height-150 && g.y<height-100 && Math.abs(g.x-x)<50 && !g.hit) { 
            g.hit=true; 
            if(g.val=='+10') crowd+=10; else crowd*=2; 
            addScore(10); 
        } 
    });
    enemies.forEach(e => { 
        e.y += 200*dt; 
        if(e.y>height-150 && e.y<height-100 && Math.abs(e.x-x)<50 && !e.hit) { 
            e.hit=true; crowd-=e.count; 
            if(crowd<=0) gameOver(); 
        } 
    });
}
function draw(ctx) {
    ctx.clearRect(0,0,width,height);
    // Draw grid
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=2; for(let i=0;i<10;i++){ let y=(dist%50)+(i*50); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke(); }
    
    gates.forEach(g => { if(!g.hit){ ctx.fillStyle='rgba(59,130,246,0.6)'; ctx.fillRect(g.x-40, g.y, 80, 40); ctx.fillStyle='#fff'; ctx.font='bold 20px Outfit'; ctx.fillText(g.val, g.x-15, g.y+25); }});
    enemies.forEach(e => { if(!e.hit){ ctx.fillStyle='#ef4444'; ctx.beginPath(); ctx.arc(e.x, e.y, 25, 0, 7); ctx.fill(); ctx.fillStyle='#fff'; ctx.font='bold 16px Outfit'; ctx.fillText(e.count, e.x-8, e.y+5); } });
    
    ctx.fillStyle='#3b82f6'; ctx.beginPath(); ctx.arc(x, height-100, Math.min(crowd+15, 50), 0, 7); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 20px Outfit'; ctx.fillText(crowd, x-10, height-95);
}