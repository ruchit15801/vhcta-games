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
let shape = {x: width/2, y: height-150, type: 0}, holes = [{x: width/4, y: 200, type: 0}, {x: width*3/4, y: 200, type: 1}];
function init() { shape.x=width/2; shape.y=height-150; shape.type = Math.random()<0.5?0:1; score=0; if(uiScore) uiScore.innerText = score;}
function update(dt) {
    if(input.isDown) { shape.x += (input.x-shape.x)*10*dt; shape.y += (input.y-shape.y)*10*dt; }
    else {
        holes.forEach(h => {
            if(Math.abs(h.x-shape.x)<40 && Math.abs(h.y-shape.y)<40) {
                if(h.type == shape.type) { addScore(10); shape.x=width/2; shape.y=height-150; shape.type = Math.random()<0.5?0:1; } 
                else gameOver();
            }
        });
    }
}
function draw(ctx) {
    ctx.clearRect(0,0,width,height);
    holes.forEach(h => { 
        ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=8; ctx.setLineDash([10, 10]);
        if(h.type==0) ctx.strokeRect(h.x-40, h.y-40, 80, 80); 
        else { ctx.beginPath(); ctx.arc(h.x, h.y, 40, 0, 7); ctx.stroke(); } 
        ctx.setLineDash([]);
    });
    ctx.fillStyle='#3b82f6'; 
    if(shape.type==0) { ctx.beginPath(); ctx.roundRect(shape.x-35, shape.y-35, 70, 70, 10); ctx.fill(); } 
    else { ctx.beginPath(); ctx.arc(shape.x, shape.y, 35, 0, 7); ctx.fill(); }
}