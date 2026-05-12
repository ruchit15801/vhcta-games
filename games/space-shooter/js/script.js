/**
 * NEON STRIKE | MASTER OVERHAUL v2
 * High-End UI, Robust Audio Engine, Security Policy Fix.
 */

"use strict";

// --- GLOBAL SCOPE CONSTANTS ---
const CONFIG = {
    PLAYER: { W: 75, H: 90, FIRE_RATE: 150 },
    COLORS: { CYAN: '#00f2ff', PINK: '#ff007b', PURPLE: '#bc13fe', YELLOW: '#ffea00', WHITE: '#ffffff' },
    LEVEL_TARGET: 25
};

// --- GLOBAL MODULES (Fixed Reference Errors) ---
window.AudioEngine = {
    ctx: null, 
    init() { 
        try {
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); 
            if (this.ctx.state === 'suspended') this.ctx.resume();
        } catch(e) { console.warn("Audio Context blocked."); }
    },
    play(freq, dur, type='sawtooth', vol=0.05) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + dur);
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime + dur);
    }
};

const MathUtil = {
    clamp: (v, min, max) => Math.min(Math.max(v, min), max),
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    rand: (min, max) => Math.random() * (max - min) + min,
    randInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
};

const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// --- ASSET LOADER ---
const AssetLoader = {
    async load(path) {
        return new Promise((res) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => res(img);
            img.onerror = () => res(null);
            img.src = path;
        });
    }
};




class Particle {
    constructor() { this.active = false; }
    init(x, y, c, s=3) { this.x=x; this.y=y; this.c=c; this.s=s; this.vx=(Math.random()-0.5)*8; this.vy=(Math.random()-0.5)*8; this.a=1; this.active=true; }
    update(dt) { this.x+=this.vx*dt; this.y+=this.vy*dt; this.a-=0.03*dt; if(this.a<=0) this.active=false; }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.a;
        ctx.fillStyle = this.c;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillRect(this.x, this.y, this.s, this.s);
        ctx.restore();
    }
}

class Bullet {
    constructor() { this.active = false; }
    init(x, y, a, s, c, p) { this.x=x; this.y=y; this.a=a; this.s=s; this.c=c; this.p=p; this.active=true; }
    update(dt) { this.x+=Math.cos(this.a)*this.s*dt; this.y+=Math.sin(this.a)*this.s*dt; if(this.y<0 || this.y>game.h || this.x<0 || this.x>game.w) this.active=false; }
    draw(ctx) { ctx.save(); ctx.fillStyle=this.c; ctx.globalCompositeOperation='lighter'; ctx.beginPath(); ctx.arc(this.x,this.y,4,0,Math.PI*2); ctx.fill(); ctx.restore(); }
}

class Enemy {
    constructor(type, lvl) {
        this.type = type; // 1, 2, 3, 'boss'
        this.w = type === 'boss' ? 220 : 75; this.h = type === 'boss' ? 220 : 85;
        this.x = MathUtil.rand(this.w, game.w - this.w); this.y = -this.h;
        this.hp = (type === 'boss' ? 1000 : 40) + (lvl * 20); this.maxHp = this.hp;
        this.spd = (type === 'boss' ? 1 : 2.5 + (3-type)*0.5) + (lvl * 0.1);
        this.active = true; this.lastS = 0; this.osc = Math.random()*100;
    }
    update(dt) {
        if (this.type === 'boss') {
            this.y = MathUtil.lerp(this.y, game.h * 0.2, 0.02 * dt);
            this.x += Math.sin(Date.now() * 0.002) * 5 * dt;
            if (Date.now() - this.lastS > 1400) {
                for (let i = 0; i < 8; i++) game.spawnB(this.x, this.y + 60, (i / 8) * Math.PI * 2, 5, CONFIG.COLORS.PINK, false);
                this.lastS = Date.now();
            }
            // Boss Nitro Plume
            if (Math.random() > 0.4) game.spawnP(this.x + (Math.random() - 0.5) * 40, this.y - 80, CONFIG.COLORS.PINK, Math.random() * 6 + 3);
        } else {
            this.y += this.spd * dt;
            this.x += Math.sin(this.osc + Date.now() * 0.004) * (this.type === 2 ? 4 : 1) * dt;
            if (Date.now() - this.lastS > (3000 - game.lvl * 80)) {
                game.spawnB(this.x, this.y + 40, Math.PI / 2, 6, CONFIG.COLORS.PINK, false);
                this.lastS = Date.now();
            }
            if (this.y > game.h + 100) this.active = false;
            // Enemy Nitro Plume
            if (Math.random() > 0.5) game.spawnP(this.x + (Math.random() - 0.5) * 15, this.y - 30, CONFIG.COLORS.PINK, Math.random() * 4 + 2);
        }
    }
    draw(ctx) {
        const img = game.assets['enemy' + (this.type === 'boss' ? 'boss' : this.type)];
        const hover = Math.sin(this.osc + Date.now() * 0.005) * 5;
        ctx.save();
        ctx.translate(this.x, this.y + hover);
        if (this.type !== 'boss') ctx.rotate(Math.sin(this.osc + Date.now() * 0.004) * 0.2 + (this.x - this.lastX || 0) * 0.05);
        if (img) ctx.drawImage(img, -this.w / 2, -this.h / 2, this.w, this.h);
        this.lastX = this.x;
        if (this.hp < this.maxHp) {
            const bw = this.w * 0.6;
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(-bw / 2, this.h / 2 + 10, bw, 4);
            ctx.fillStyle = CONFIG.COLORS.PINK;
            ctx.fillRect(-bw / 2, this.h / 2 + 10, bw * (this.hp / this.maxHp), 4);
        }
        ctx.restore();
    }
}

const game = {
    w:0, h:0, lvl:1, score:0, kills:0, hp:100, combo:0, lastK:0,
    px:0, py:0, pTilt:0, pCooldown:0, running:false,
    assets:{}, entities:{ bullets:[], enemies:[], particles:[] }, pools:{ bullets:[], particles:[] },
    stars:[], joy:{ active:false, x:0, y:0, ox:0, oy:0 },

    async init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.resize(); window.addEventListener('resize', () => this.resize());
        this.setupI(); this.initS();

        // High Performance: Load PNG Assets directly from images folder (Already pre-positioned)
        const assetsToLoad = {
            'player': 'assets/images/player.png',
            'enemy1': 'assets/images/enemy1.png',
            'enemy2': 'assets/images/enemy2.png',
            'enemy3': 'assets/images/enemy3.png',
            'enemyboss': 'assets/images/boss.png'
        };

        const loadPromises = Object.entries(assetsToLoad).map(async ([key, path]) => {
            this.assets[key] = await AssetLoader.load(path);
        });
        
        await Promise.all(loadPromises);
        this.bindU();
        requestAnimationFrame((t) => this.loop(t));
    },
    resize() { 
        this.w = window.innerWidth; 
        this.h = window.innerHeight; 
        this.canvas.width = this.w; 
        this.canvas.height = this.h; 
        this.initS(); 
        // Re-center player on major resize
        if(!this.running) {
            this.px = this.w / 2;
            this.py = this.h * 0.8;
        }
    },

    initS() { this.stars=[]; for(let i=0; i<150; i++) this.stars.push({ x:Math.random()*this.w, y:Math.random()*this.h, s:Math.random()*2, v:Math.random()*2+1 }); },
    setupI() {
        window.addEventListener('mousedown', () => this.mD=true); window.addEventListener('mouseup', () => this.mD=false);
        window.addEventListener('mousemove', e => { this.mx=e.clientX; this.my=e.clientY; });
        const jC=document.getElementById('joystick-container'), jH=document.getElementById('joystick-handle');
        const start=(tx,ty)=>{ this.joy.active=true; const r=jC.getBoundingClientRect(); this.joy.ox=r.left+r.width/2; this.joy.oy=r.top+r.height/2; this.upJ(tx,ty,jH); };
        jC.addEventListener('touchstart', e=>{ e.preventDefault(); start(e.touches[0].clientX, e.touches[0].clientY); });
        window.addEventListener('touchmove', e=>{ if(this.joy.active){ e.preventDefault(); this.upJ(e.touches[0].clientX,e.touches[0].clientY,jH); } }, {passive:false});
        window.addEventListener('touchend', ()=>{ this.joy.active=false; this.joy.x=0; this.joy.y=0; jH.style.transform='translate(0,0)'; });
    },
    upJ(tx,ty,h) { const dx=tx-this.joy.ox, dy=ty-this.joy.oy, d=Math.min(60,Math.hypot(dx,dy)), a=Math.atan2(dy,dx); this.joy.x=(Math.cos(a)*d)/60; this.joy.y=(Math.sin(a)*d)/60; h.style.transform=`translate(${Math.cos(a)*d}px, ${Math.sin(a)*d}px)`; },
    bindU() {
        document.getElementById('start-btn').onclick=()=>this.start();
        document.getElementById('briefing-btn').onclick=()=>{ document.getElementById('briefing-screen').classList.remove('hidden'); document.getElementById('start-screen').classList.add('hidden'); };
        document.getElementById('close-briefing-btn').onclick=()=>{ document.getElementById('briefing-screen').classList.add('hidden'); document.getElementById('start-screen').classList.remove('hidden'); };
        document.getElementById('restart-btn').onclick=()=>this.start();
    },
    start() {
        window.AudioEngine.init(); this.running=true; this.lvl=1; this.score=0; this.kills=0; this.hp=100; this.combo=0;
        this.px=this.w/2; this.py=this.h*0.8; this.entities={ bullets:[], enemies:[], particles:[] };
        document.getElementById('hud').classList.remove('hidden'); document.getElementById('overlay').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        this.spawnL();
    },
    spawnL() {
        if(!this.running) return;
        if(this.entities.enemies.length < (2 + Math.floor(this.lvl/3))) {
            const isB=(this.lvl%5===0 && !this.entities.enemies.some(e=>e.type==='boss'));
            this.entities.enemies.push(new Enemy(isB?'boss':MathUtil.randInt(1,3), this.lvl));
        }
        setTimeout(()=>this.spawnL(), 1800-(this.lvl*50));
    },
    spawnB(x,y,a,s,c,p) { let b=this.pools.bullets.find(i=>!i.active); if(!b){ b=new Bullet(); this.pools.bullets.push(b); } b.init(x,y,a,s,c,p); this.entities.bullets.push(b); },
    spawnP(x,y,c,s) { let p=this.pools.particles.find(i=>!i.active); if(!p){ p=new Particle(); this.pools.particles.push(p); } p.init(x,y,c,s); this.entities.particles.push(p); },
    update(dt) {
        if(!this.running) return; let scale=dt/16.6;
        let tx=this.px, ty=this.py, mx=0;
        if(this.joy.active){ mx=this.joy.x*15*scale; tx+=mx; ty+=this.joy.y*15*scale; }
        else if(this.mD){ tx=MathUtil.lerp(this.px,this.mx,0.15*scale); ty=MathUtil.lerp(this.py,this.my,0.15*scale); mx=tx-this.px; }
        this.pTilt=MathUtil.lerp(this.pTilt, MathUtil.clamp(mx*0.05, -0.4, 0.4), 0.1);
        this.px=MathUtil.clamp(tx,40,this.w-40); this.py=MathUtil.clamp(ty,40,this.h-40);

        // Realism: Nitro Exhaust Particles (Cyan Glow)
        if(this.running && Math.random() > 0.3) {
            this.spawnP(this.px + (Math.random()-0.5)*10, this.py + 40, CONFIG.COLORS.CYAN, Math.random()*4+2);
        }

        if(this.pCooldown>0) this.pCooldown-=dt;
        if(this.pCooldown<=0){ this.spawnB(this.px-20,this.py-20,-Math.PI/2,16,CONFIG.COLORS.CYAN,true); this.spawnB(this.px+20,this.py-20,-Math.PI/2,16,CONFIG.COLORS.CYAN,true); this.pCooldown=CONFIG.PLAYER.FIRE_RATE; window.AudioEngine.play(600,0.1); }
        this.entities.bullets.forEach(b=>{ if(b.active) b.update(scale); });
        this.entities.enemies.forEach(e=>{ if(e.active) e.update(scale); });
        this.entities.particles.forEach(p=>{ if(p.active) p.update(scale); });
        this.entities.bullets=this.entities.bullets.filter(b=>b.active);
        this.entities.enemies=this.entities.enemies.filter(e=>e.active);
        this.entities.particles=this.entities.particles.filter(p=>p.active);
        this.stars.forEach(s=>{ s.y+=s.v*scale; if(s.y>this.h) s.y=-10; });
        this.checkC(); this.upHUD();
        if(this.kills >= this.lvl*10){ this.lvl++; this.kills=0; this.showT(); }
    },
    checkC() {
        const {bullets, enemies}=this.entities;
        bullets.filter(b=>b.p && b.active).forEach(b=>{
            enemies.forEach(e=>{
                if(e.active && MathUtil.dist(b,e)<e.w/2){
                    b.active=false; e.hp-=10; this.spawnP(b.x,b.y,CONFIG.COLORS.CYAN); window.AudioEngine.play(100,0.1,'square');
                    if(e.hp<=0){ e.active=false; this.kills++; this.score+=(e.type==='boss'?2000:100)*(this.combo+1); this.combo++; this.lastK=Date.now(); for(let i=0; i<15; i++) this.spawnP(e.x,e.y,CONFIG.COLORS.PINK,4); }
                }
            });
        });
        bullets.filter(b=>!b.p && b.active).forEach(b=>{ if(MathUtil.dist(b,{x:this.px,y:this.py})<35){ b.active=false; this.hp-=5; this.combo=0; this.spawnP(this.px,this.py,CONFIG.COLORS.WHITE,5); } });
        if(this.hp<=0) this.gameOver();
        if(Date.now()-this.lastK > 2000) this.combo=0;
    },
    upHUD() {
        document.getElementById('score').innerText=String(this.score).padStart(6,'0');
        document.getElementById('level').innerText=String(this.lvl).padStart(2,'0');
        document.getElementById('health-bar').style.width=this.hp+'%';
        document.getElementById('sector-bar').style.width=(this.kills/(this.lvl*10))*100+'%';
        const cUI=document.getElementById('combo-ui');
        if(this.combo>1){ cUI.classList.remove('hidden'); document.getElementById('combo-val').innerText=this.combo+'X'; } else { cUI.classList.add('hidden'); }
    },
    showT() { this.running=false; const s=document.getElementById('transition-screen'), o=document.getElementById('overlay'); document.getElementById('next-level-text').innerText=`SECTOR ${String(this.lvl).padStart(2,'0')}`; o.classList.remove('hidden'); s.classList.remove('hidden'); setTimeout(()=>{ s.classList.add('hidden'); o.classList.add('hidden'); this.running=true; this.spawnL(); }, 2000); },
    gameOver() { this.running=false; document.getElementById('overlay').classList.remove('hidden'); document.getElementById('game-over-screen').classList.remove('hidden'); document.getElementById('res-score').innerText=this.score; document.getElementById('res-kills').innerText=this.kills; document.getElementById('res-level').innerText=this.lvl; },
    draw() {
        this.ctx.clearRect(0,0,this.w,this.h);
        this.ctx.fillStyle="rgba(255,255,255,0.7)"; this.stars.forEach(s=>this.ctx.fillRect(s.x,s.y,s.s,s.s));
        this.entities.particles.forEach(p=>p.draw(this.ctx)); this.entities.bullets.forEach(b=>b.draw(this.ctx)); this.entities.enemies.forEach(e=>e.draw(this.ctx));
        
        // Player Drawing with High-Performance Realism
        const hover = Math.sin(Date.now() * 0.006) * 5;
        this.ctx.save(); 
        this.ctx.translate(this.px, this.py + hover); 
        this.ctx.rotate(this.pTilt);
        if(this.assets.player) {
            // High efficiency additive glow effect
            this.ctx.globalCompositeOperation = 'lighter';
            this.ctx.globalAlpha = 0.8;
            this.ctx.drawImage(this.assets.player, -CONFIG.PLAYER.W/2, -CONFIG.PLAYER.H/2, CONFIG.PLAYER.W, CONFIG.PLAYER.H);
        }
        this.ctx.restore();
    },
    loop(t) { if(!this.lastT) this.lastT=t; const dt=t-this.lastT; this.lastT=t; this.update(dt); this.draw(); requestAnimationFrame(l=>this.loop(l)); }
};

game.init();
