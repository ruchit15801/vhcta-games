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
let x=width/2, y=height/2, crowd=10, neutrals=[];
function init() { x=width/2; y=height/2; crowd=10; neutrals=[]; for(let i=0;i<25;i++) neutrals.push({x:Math.random()*width, y:Math.random()*height, val: Math.floor(Math.random()*4)+1, hit:false}); score=0; if(uiScore) uiScore.innerText = score;}
function update(dt) {
    let dx = input.x - x, dy = input.y - y; let mag = Math.sqrt(dx*dx+dy*dy);
    if(input.isDown && mag>0) { x += dx/mag * 180*dt; y += dy/mag * 180*dt; }
    neutrals.forEach(n => {
        let dist = Math.sqrt((n.x-x)**2 + (n.y-y)**2);
        if(dist < crowd*1.5 + 15 && !n.hit) { n.hit=true; crowd += n.val; addScore(n.val); }
    });
    if(neutrals.every(n=>n.hit)) init();
}
function draw(ctx) {
    ctx.clearRect(0,0,width,height);
    neutrals.forEach(n => { if(!n.hit){ ctx.fillStyle='#94a3b8'; ctx.beginPath(); ctx.arc(n.x, n.y, n.val*3+5, 0, 7); ctx.fill(); }});
    ctx.fillStyle='#3b82f6'; ctx.beginPath(); ctx.arc(x, y, crowd*1.5+10, 0, 7); ctx.fill(); 
    ctx.fillStyle='#fff'; ctx.font='bold 16px Outfit'; ctx.textAlign='center'; ctx.fillText(crowd, x, y+5);
}