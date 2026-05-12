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
let path = [], car = {x: 50, y: 100, vx: 0, vy: 0}, state = 'draw';
function init() { path = []; car = {x: 50, y: height/2 - 50, vx: 0, vy: 0}; state = 'draw'; score=0; if(uiScore) uiScore.innerText = score;}
function update(dt) {
    if(state === 'draw') {
        if(input.isDown) path.push({x: input.x, y: input.y});
        else if(path.length > 10) state = 'play';
    } else {
        car.vy += 1000 * dt; car.x += 150 * dt; car.y += car.vy * dt;
        let groundY = height/2 + 100;
        if(car.x < 200 || car.x > width-200) { if(car.y > groundY - 15) { car.y = groundY - 15; car.vy = 0; } }
        else if(car.y > height) gameOver();
        for(let i=0; i<path.length-1; i++) {
            let p1 = path[i], p2 = path[i+1];
            if(car.x > Math.min(p1.x, p2.x) && car.x < Math.max(p1.x, p2.x)) {
                let ty = p1.y + (car.x - p1.x)*(p2.y - p1.y)/(p2.x - p1.x);
                if(car.y > ty - 15 && car.y < ty + 15) { car.y = ty - 15; car.vy = 0; }
            }
        }
        if(car.x > width) { addScore(100); init(); }
    }
}
function draw(ctx) {
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(0, height/2+100, 200, height); ctx.fillRect(width-200, height/2+100, 200, height);
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath();
    path.forEach((p,i) => i==0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.stroke();
    
    // Draw car
    ctx.fillStyle = '#ef4444'; ctx.fillRect(car.x-15, car.y-10, 30, 15);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(car.x-10, car.y+5, 6, 0, 7); ctx.arc(car.x+10, car.y+5, 6, 0, 7); ctx.fill();
}