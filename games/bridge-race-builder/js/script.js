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
let x=width/2, y=height/2, bricks=0, stairs=0, items=[];
function init() { x=width/2; y=height/2; bricks=0; stairs=0; items=[]; score=0; if(uiScore) uiScore.innerText = score;}
function update(dt) {
    let dx = input.x - x, dy = input.y - y; let mag = Math.sqrt(dx*dx+dy*dy);
    if(input.isDown && mag>0) { x += dx/mag * 250*dt; y += dy/mag * 250*dt; }
    if(Math.random()<0.05 && items.length<15) items.push({x:Math.random()*width, y:Math.random()*(height-200)+200, hit:false});
    
    items.forEach(i => { if(Math.abs(i.x-x)<25 && Math.abs(i.y-y)<25 && !i.hit) { i.hit=true; bricks++; addScore(1); }});
    
    if(y < 150 && bricks > 0 && Math.random()<0.2) { y += 5; bricks--; stairs++; addScore(5); }
    if(stairs > 30) { addScore(100); init(); }
    if(y < 150 && bricks == 0) y = 150; // Block player if no bricks
}
function draw(ctx) {
    ctx.clearRect(0,0,width,height);
    // Bridge area
    ctx.fillStyle='#0ea5e9'; ctx.fillRect(width/2-60, 0, 120, 150);
    ctx.fillStyle='#ef4444'; for(let i=0;i<stairs;i++) ctx.fillRect(width/2 - 50, 150 - i*15, 100, 15);
    
    items.forEach(i => { if(!i.hit){ ctx.fillStyle='#f59e0b'; ctx.fillRect(i.x-10, i.y-10, 20, 20); }});
    
    ctx.fillStyle='#3b82f6'; ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.fill();
    for(let i=0;i<bricks;i++) { ctx.fillStyle='#f59e0b'; ctx.fillRect(x-15, y-30 - i*8, 30, 6); }
}