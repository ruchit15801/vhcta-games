/**
 * CITY BUILDER TYCOON - ULTRA PREMIUM "JOR DAR" EDITION
 */

// --- 1. CONFIG & DATA ---
const BUILDINGS = {
    residential: [
        { id: 'r1', name: 'Villa', cost: 100, population: 10, income: 0, upkeep: 2, level: 1, icon: '🏠', color:'#4ade80' },
        { id: 'r2', name: 'Estate', cost: 600, population: 60, income: 0, upkeep: 12, level: 2, icon: '🏢', color:'#22c55e' },
        { id: 'r3', name: 'Sky Mansion', cost: 3000, population: 300, income: 0, upkeep: 50, level: 3, icon: '🏙️', color:'#16a34a' }
    ],
    commercial: [
        { id: 'c1', name: 'Boutique', cost: 250, population: 0, income: 40, upkeep: 8, level: 1, icon: '🏪', color:'#60a5fa' },
        { id: 'c2', name: 'Plaza', cost: 1000, population: 0, income: 200, upkeep: 30, level: 2, icon: '🏬', color:'#3b82f6' },
        { id: 'c3', name: 'Empire Mall', cost: 5000, population: 0, income: 1000, upkeep: 150, level: 3, icon: '🛍️', color:'#1d4ed8' }
    ],
    industrial: [
        { id: 'i1', name: 'Factory', cost: 400, population: 0, income: 80, upkeep: 20, level: 1, icon: '🏭', color:'#fbbf24' },
        { id: 'i2', name: 'Logistics', cost: 1500, population: 0, income: 350, upkeep: 60, level: 2, icon: '🏗️', color:'#f59e0b' },
        { id: 'i3', name: 'Fusion Plant', cost: 8000, population: 0, income: 2000, upkeep: 400, level: 3, icon: '🧪', color:'#b45309' }
    ],
    services: [
        { id: 'p1', name: 'Police HQ', cost: 1500, upkeep: 60, range: 12, icon: '🚓', color:'#ef4444' },
        { id: 'h1', name: 'Royal Hospital', cost: 3000, upkeep: 120, range: 18, icon: '🏥', color:'#ec4899' }
    ]
};

// --- 2. PREMIUM RENDERER ---
class AssetEngine {
    constructor() { this.cache = new Map(); }
    async generateAll() {
        Object.values(BUILDINGS).flat().forEach(b => {
            this.cache.set(b.id, this.drawBuilding(b.color, b.level, b.name.toUpperCase()));
        });
        this.cache.set('grass', this.drawTile('#064e3b'));
        this.cache.set('road', this.drawRoad());
        this.cache.set('tree', this.drawTree());
    }
    drawBuilding(color, level, label) {
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 160;
        const ctx = canvas.getContext('2d'); const cx = 64, cy = 120, w = 64, h = 32;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+w, cy-h/2); ctx.lineTo(cx, cy-h); ctx.lineTo(cx-w, cy-h/2); ctx.fill();
        const height = 20 + (level * 25);
        // Bodies
        ctx.fillStyle = color; this.cube(ctx, cx, cy-h/2, w, h, height);
        // Detail windows
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for(let i=1; i<=level+1; i++) { ctx.fillRect(cx-15, cy-h/2-i*15, 6, 8); ctx.fillRect(cx+10, cy-h/2-i*15, 6, 8); }
        // Label
        ctx.fillStyle = '#fff'; ctx.font = '800 9px Outfit'; ctx.textAlign = 'center'; ctx.fillText(label, cx, cy-h-height-8);
        return canvas;
    }
    cube(ctx, x, y, w, h, hh) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x-w/2, y-h/4); ctx.lineTo(x-w/2, y-h/4-hh); ctx.lineTo(x, y-hh); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+w/2, y-h/4); ctx.lineTo(x+w/2, y-h/4-hh); ctx.lineTo(x, y-hh); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(x, y-hh); ctx.lineTo(x+w/2, y-h/4-hh); ctx.lineTo(x, y-h-hh); ctx.lineTo(x-w/2, y-h/4-hh); ctx.fill();
    }
    drawTile(col) {
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(64, 48); ctx.lineTo(128, 32); ctx.lineTo(64, 16); ctx.lineTo(0, 32); ctx.fill();
        return canvas;
    }
    drawRoad() {
        const c = this.drawTile('#1e293b'); const ctx = c.getContext('2d');
        ctx.strokeStyle = '#64748b'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(32, 40); ctx.lineTo(96, 24); ctx.stroke();
        return c;
    }
    drawTree() {
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 100;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#065f46';
        ctx.beginPath(); ctx.arc(64, 40, 15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3f2e1e'; ctx.fillRect(62, 40, 4, 20);
        return canvas;
    }
    get(id) { return this.cache.get(id); }
}

// --- 3. PRO SYSTEM ENGINE ---
class ParticleSystem {
    constructor() { this.items = []; }
    spawn(x, y, col, txt = '') { this.items.push({ x, y, vy: -1, life: 1, col, txt }); }
    update() { this.items.forEach(i => { i.y += i.vy; i.life -= 0.015; }); this.items = this.items.filter(i => i.life > 0); }
    render(ctx) {
        this.items.forEach(i => {
            ctx.globalAlpha = i.life; ctx.fillStyle = i.col;
            if(i.txt) { ctx.font = '800 20px Outfit'; ctx.fillText(i.txt, i.x, i.y); }
            else { ctx.beginPath(); ctx.arc(i.x, i.y, 4, 0, 7); ctx.fill(); }
        });
        ctx.globalAlpha = 1;
    }
}

class CitySimulation {
    constructor() {
        this.money = 15000; this.displayMoney = 15000;
        this.pop = 0; this.happiness = 90;
        this.level = 1; this.xp = 0;
        this.taxRate = 12; // Default 12%
        this.lastTick = Date.now();
    }
    tick(grid, particles) {
        const now = Date.now();
        if(now - this.lastTick > 4000) {
            this.lastTick = now;
            this.process(grid, particles);
        }
        this.displayMoney += (this.money - this.displayMoney) * 0.1;
    }
    process(grid, particles) {
        let income = 0, upkeep = 0, pop = 0, happinessMod = 0;
        grid.forEach((row, x) => row.forEach((b, y) => {
            if(!b) return;
            income += (b.income || 0); upkeep += (b.upkeep || 0); pop += (b.population || 0);
            // Proximity check
            if(b.id.startsWith('r')) {
                grid.forEach((r2, x2) => r2.forEach((b2, y2) => {
                    if(b2 && b2.id.startsWith('i')) {
                        const dist = Math.hypot(x-x2, y-y2);
                        if(dist < 5) happinessMod -= 2;
                    }
                }));
            }
        }));

        const taxIncome = pop * (this.taxRate / 2); // Dynamic tax
        const net = (income + taxIncome) - upkeep;
        this.money += net; this.pop = pop;
        
        // Happiness logic: high tax hurts happiness
        this.happiness = Math.max(0, Math.min(100, 90 + happinessMod - (this.taxRate - 10)*2));
        
        this.xp += pop / 5;
        if(this.xp >= this.level * 1000) { this.level++; this.xp = 0; }

        if(net !== 0) particles.spawn(window.innerWidth/2, 120, net > 0 ? '#00f5d4' : '#ff0054', (net > 0 ? '+' : '') + '$' + Math.floor(net));
    }
}

// --- 4. ENGINE HUB ---
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.assets = new AssetEngine();
        this.sim = new CitySimulation();
        this.particles = new ParticleSystem();
        this.gridSize = 30; this.grid = Array(30).fill().map(() => Array(30).fill(null));
        this.camera = { x: window.innerWidth/2, y: 200, z: 1, tx: window.innerWidth/2, ty: 200 };
        this.hover = { x: -1, y: -1 };
        this.selected = null;
        this.time = 0;
        this.init();
    }
    async init() {
        await this.assets.generateAll();
        this.setupEvents();
        this.renderMenu('residential');
        this.loop();
    }
    setupEvents() {
        let drag = false, lx, ly;
        window.onmousedown = (e) => { drag = true; lx = e.clientX; ly = e.clientY; };
        window.onmousemove = (e) => {
            if(drag) { this.camera.tx += e.clientX - lx; this.camera.ty += e.clientY - ly; lx = e.clientX; ly = e.clientY; }
            this.hover = this.screenToWorld(e.clientX, e.clientY);
        };
        window.onmouseup = () => drag = false;
        window.onwheel = (e) => this.camera.z = Math.min(Math.max(this.camera.z * (e.deltaY > 0 ? 0.9 : 1.1), 0.5), 2.5);
        this.canvas.onclick = () => this.place();
        
        document.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active'); this.renderMenu(btn.dataset.category);
        });

        const taxSlider = document.getElementById('tax-slider');
        taxSlider.oninput = (e) => {
            this.sim.taxRate = e.target.value;
            document.getElementById('tax-label').innerText = e.target.value;
        };
        document.getElementById('budget-btn').onclick = () => document.getElementById('budget-panel').classList.toggle('hidden');
    }
    screenToWorld(sx, sy) {
        const x = (sx - this.camera.x) / this.camera.z, y = (sy - this.camera.y) / this.camera.z;
        const wx = Math.floor((x / 32 + y / 16) / 2), wy = Math.floor((y / 16 - x / 32) / 2);
        return { x: wx, y: wy };
    }
    worldToScreen(wx, wy) {
        return { x: (wx - wy) * 32 * this.camera.z + this.camera.x, y: (wx + wy) * 16 * this.camera.z + this.camera.y };
    }
    renderMenu(cat) {
        const list = document.getElementById('build-items-list'); list.innerHTML = '';
        (BUILDINGS[cat] || []).forEach(b => {
            const card = document.createElement('div'); card.className = `build-card ${b.level > this.sim.level ? 'locked' : ''}`;
            card.innerHTML = `<div style="font-size:2rem">${b.icon}</div><div>${b.name}</div><div style="color:var(--success);font-weight:800">$${b.cost}</div>`;
            card.onclick = (e) => { e.stopPropagation(); if(this.sim.level >= b.level) this.selected = b; };
            list.appendChild(card);
        });
    }
    place() {
        if(!this.selected || this.sim.money < this.selected.cost) return;
        const h = this.hover; if(h.x < 0 || h.x >= 30 || h.y < 0 || h.y >= 30) return;
        if(!this.grid[h.x][h.y]) {
            this.sim.money -= this.selected.cost; this.grid[h.x][h.y] = { ...this.selected };
            this.playSnd(300, 600);
        }
    }
    playSnd(f1, f2) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setTargetAtTime(f1, ctx.currentTime, 0.1); o.frequency.exponentialRampToValueAtTime(f2, ctx.currentTime+0.1);
        g.gain.setTargetAtTime(0.1, ctx.currentTime, 0.1); g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime+0.1);
        o.start(); o.stop(ctx.currentTime+0.1);
    }
    loop() {
        // Day/Night and smoothing
        this.time += 0.001; this.camera.x += (this.camera.tx - this.camera.x) * 0.15; this.camera.y += (this.camera.ty - this.camera.y) * 0.15;
        const isNight = Math.sin(this.time) < -0.5;
        document.body.className = isNight ? 'night-mode' : 'day-mode';

        this.sim.tick(this.grid, this.particles); this.particles.update();
        this.render(); requestAnimationFrame(() => this.loop());
    }
    render() {
        this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
        this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
        for(let x=0; x<this.gridSize; x++) {
            for(let y=0; y<this.gridSize; y++) {
                const pos = this.worldToScreen(x, y); const b = this.grid[x][y];
                const asset = this.assets.get(b ? b.id : ( (x+y)%5==0 ? 'tree' : 'grass'));
                if(asset) {
                    const z = this.camera.z;
                    this.ctx.drawImage(asset, pos.x - (asset.width/2)*z, pos.y - (asset.height-16)*z, asset.width*z, asset.height*z);
                }
                if(x == this.hover.x && y == this.hover.y) {
                    this.ctx.fillStyle = this.selected ? 'rgba(76, 201, 240, 0.4)' : 'rgba(255,255,255,0.1)';
                    this.drawTilePoly(pos.x, pos.y);
                }
            }
        }
        this.particles.render(this.ctx); this.updateHUD();
    }
    drawTilePoly(x, y) {
        const z = this.camera.z; this.ctx.beginPath();
        this.ctx.moveTo(x, y+16*z); this.ctx.lineTo(x+32*z, y); this.ctx.lineTo(x, y-16*z); this.ctx.lineTo(x-32*z, y); this.ctx.fill();
    }
    updateHUD() {
        document.getElementById('money-display').innerText = `$${Math.floor(this.sim.displayMoney)}`;
        document.getElementById('population-display').innerText = Math.floor(this.sim.pop);
        document.getElementById('happiness-fill').style.width = `${this.sim.happiness}%`;
        document.getElementById('level-display').innerText = this.sim.level;
        document.getElementById('lvl-progress-fill').style.width = `${(this.sim.xp / (this.sim.level * 1000)) * 100}%`;
    }
}

document.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
