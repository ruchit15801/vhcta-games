/** 
 * Dungeon Card Battle - V2 World Best Edition
 * Deep Strategy Logic, Premium UI Controllers
 */

// -------------------------------------------------------------
// REFINED AUDIO ENGINE
// -------------------------------------------------------------
const Sfx = {
    ctx: null,
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    play(freq, type, dur, vol = 0.1) {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime + dur);
    },
    ui() { this.play(800, 'sine', 0.1, 0.05); },
    draw() { this.play(400, 'sine', 0.1, 0.05); },
    attack() { this.play(100, 'sawtooth', 0.2, 0.2); this.play(50, 'square', 0.3, 0.1); },
    block() { this.play(300, 'square', 0.1, 0.1); this.play(500, 'sine', 0.2, 0.05); },
    buff() { this.play(600, 'sine', 0.4, 0.1); this.play(800, 'sine', 0.5, 0.05); },
    hurt() { this.play(150, 'sawtooth', 0.3, 0.2); },
    win() { [440, 554, 659].forEach((f, i) => setTimeout(() => this.play(f, 'sine', 0.4), i * 150)); }
};

// -------------------------------------------------------------
// PARTICLE SYSTEM
// -------------------------------------------------------------
const canvas = document.getElementById('fx-canvas');
const ctxFx = canvas.getContext('2d');
let particles = [];
const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
window.onresize = resize; resize();

class Dot {
    constructor(x, y, c) { this.x = x; this.y = y; this.v = {x:(Math.random()-0.5)*8, y:(Math.random()-0.5)*8}; this.l = 1; this.c = c; }
    up() { this.x += this.v.x; this.y += this.v.y; this.l -= 0.02; }
    draw() { ctxFx.globalAlpha = this.l; ctxFx.fillStyle = this.c; ctxFx.beginPath(); ctxFx.arc(this.x, this.y, 3, 0, 7); ctxFx.fill(); }
}
const spawn = (x, y, c, n=20) => { for(let i=0; i<n; i++) particles.push(new Dot(x,y,c)); };
const loop = () => {
    ctxFx.clearRect(0,0,canvas.width,canvas.height);
    particles = particles.filter(p => { p.up(); p.draw(); return p.l > 0; });
    requestAnimationFrame(loop);
};
loop();

// -------------------------------------------------------------
// GAME DATABASE
// -------------------------------------------------------------
const CARDS = [
    { id: 'strike', name: 'Strike', type: 'attack', cost: 1, dmg: 6, art: '🗡️', desc: 'Deal <b>6</b> damage.' },
    { id: 'defend', name: 'Defend', type: 'skill', cost: 1, blk: 5, art: '🛡️', desc: 'Gain <b>5</b> block.' },
    { id: 'bash', name: 'Bash', type: 'attack', cost: 2, dmg: 8, vuln: 2, art: '🔨', desc: 'Deal <b>8</b> damage. Apply 2 <b>Vulnerable</b>.' },
    { id: 'inflame', name: 'Inflame', type: 'power', cost: 1, str: 2, art: '🔥', desc: 'Gain 2 <b>Strength</b>.' },
    { id: 'poison_stab', name: 'Poison Stab', type: 'attack', cost: 1, dmg: 6, poi: 3, art: '🐍', desc: 'Deal <b>6</b> damage. Apply 3 <b>Poison</b>.' },
    { id: 'shrug', name: 'Shrug It Off', type: 'skill', cost: 1, blk: 8, draw: 1, art: '🧥', desc: 'Gain <b>8</b> block. Draw 1 card.' },
    { id: 'heavy_blade', name: 'Heavy Blade', type: 'attack', cost: 2, dmg: 14, art: '⚔️', desc: 'Deal <b>14</b> damage.' },
    { id: 'blind', name: 'Blind', type: 'skill', cost: 0, weak: 2, art: '👁️', desc: 'Apply 2 <b>Weak</b>.' }
];

const RELICS = [
    { id: 'burning_blood', name: 'Burning Blood', art: '🩸', desc: 'Heal 6 HP at the end of combat.' },
    { id: 'ring_of_snake', name: 'Ring of Snake', art: '💍', desc: 'Start each combat drawing 2 extra cards.' },
    { id: 'vajra', name: 'Vajra', art: '💎', desc: 'Start each combat with 1 Strength.' }
];

const ENEMIES = [
    { name: 'Slime', hp: 25, art: '🧪', color:'#2ecc71', pattern: [{t:'atk', v:6}, {t:'blk', v:4}] },
    { name: 'Cultist', hp: 50, art: '🧙', color:'#9b59b6', pattern: [{t:'str', v:2}, {t:'atk', v:10}] },
    { name: 'Guardian', hp: 120, art: '🗿', color:'#95a5a6', pattern: [{t:'blk', v:15}, {t:'atk', v:8, m:2}] }
];

// -------------------------------------------------------------
// GAME STATE
// -------------------------------------------------------------
const State = {
    floor: 1,
    hp: 80, maxHp: 80,
    gold: 50,
    relics: [],
    deck: [],
    drawPile: [], discardPile: [], hand: [],
    energy: 3, maxEnergy: 3,
    block: 0,
    status: { str: 0, weak: 0, vuln: 0, poi: 0 },
    
    enemy: null,
    eStatus: { str: 0, weak: 0, vuln: 0, poi: 0 },
    eInt: 0, // pattern index
    
    screen: 'menu'
};

// -------------------------------------------------------------
// CORE ENGINE
// -------------------------------------------------------------
const E = {
    get: id => document.getElementById(id),
    show: id => {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hide'));
        E.get(`screen-${id}`).classList.remove('hide');
        State.screen = id;
        if(id !== 'menu') E.get('global-hud').classList.remove('hide');
        else E.get('global-hud').classList.add('hide');
    },
    
    updateHUD() {
        E.get('gold-value').innerText = State.gold;
        E.get('current-floor').innerText = State.floor;
        const rc = E.get('relic-container');
        rc.innerHTML = '';
        State.relics.forEach(r => {
            const div = document.createElement('div');
            div.className = 'relic-icon'; div.innerText = r.art; div.title = `${r.name}: ${r.desc}`;
            rc.appendChild(div);
        });
    },

    initGame() {
        State.floor = 1; State.hp = 80; State.gold = 50; State.relics = [RELICS[0]];
        State.deck = [
            ...Array(4).fill(CARDS[0]), // 4 strikes
            ...Array(4).fill(CARDS[1]), // 4 defends
            CARDS[2], CARDS[3]          // bash, inflame
        ].map(c => ({...c, uid: Math.random()}));
        E.updateHUD();
        E.show('map');
        genMap();
    }
};

// -------------------------------------------------------------
// COMBAT LOGIC
// -------------------------------------------------------------
function startCombat(enemyData) {
    State.enemy = { ...enemyData, curHp: enemyData.hp, maxHp: enemyData.hp, block: 0 };
    State.eInt = 0;
    State.block = 0;
    State.status = { str: State.relics.find(r=>r.id==='vajra') ? 1 : 0, weak: 0, vuln: 0, poi: 0 };
    State.eStatus = { str: 0, weak: 0, vuln: 0, poi: 0 };
    
    State.drawPile = [...State.deck].sort(() => Math.random() - 0.5);
    State.discardPile = [];
    State.hand = [];
    
    E.show('combat');
    E.get('enemy-name').innerText = State.enemy.name;
    E.get('enemy-sprite').style.backgroundColor = State.enemy.color;
    E.get('enemy-sprite').innerText = State.enemy.art;
    E.get('enemy-sprite').style.display = 'flex';
    E.get('enemy-sprite').style.fontSize = '5rem';
    E.get('enemy-sprite').style.justifyContent = 'center';
    E.get('enemy-sprite').style.alignItems = 'center';
    E.get('enemy-sprite').style.color = '#fff';

    startPlayerTurn();
}

function startPlayerTurn() {
    State.energy = State.maxEnergy;
    State.block = 0;
    
    // Poison ticks
    if(State.status.poi > 0) {
        damageEntity('player', State.status.poi);
        State.status.poi--;
    }
    
    // Decrement other status
    if(State.status.weak > 0) State.status.weak--;
    if(State.status.vuln > 0) State.status.vuln--;

    let drawCount = 5;
    if(State.relics.find(r=>r.id==='ring_of_snake') && State.floor === 1) drawCount += 2; // Simple check
    
    drawCards(drawCount);
    updateCombatUI();
}

function drawCards(n) {
    for(let i=0; i<n; i++) {
        if(State.drawPile.length === 0) {
            State.drawPile = [...State.discardPile].sort(() => Math.random() - 0.5);
            State.discardPile = [];
        }
        if(State.drawPile.length > 0) State.hand.push(State.drawPile.pop());
    }
    renderHand();
}

function renderHand() {
    const cont = E.get('hand-container');
    cont.innerHTML = '';
    State.hand.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = `game-card type-${c.type}`;
        div.innerHTML = `
            <div class="card-cost-badge">${c.cost}</div>
            <div class="card-name">${c.name}</div>
            <div class="card-art-box">${c.art}</div>
            <div class="card-desc-box">${c.desc}</div>
        `;
        
        // 3D Tilt Logic
        div.onmousemove = e => {
            const r = div.getBoundingClientRect();
            const x = e.clientX - r.left, y = e.clientY - r.top;
            const rx = (y - r.height/2) / 10, ry = -(x - r.width/2) / 10;
            div.style.setProperty('--rx', `${rx}deg`);
            div.style.setProperty('--ry', `${ry}deg`);
        };
        div.onmouseleave = () => {
            div.style.setProperty('--rx', '0deg');
            div.style.setProperty('--ry', '0deg');
        };

        // Interaction
        div.onmousedown = e => dragStart(e, i, div);
        div.ontouchstart = e => dragStart(e, i, div);

        cont.appendChild(div);
    });
}

function updateCombatUI() {
    // Player
    E.get('player-hp-text').innerText = `${State.hp}/${State.maxHp}`;
    E.get('player-hp-fill').style.width = `${(State.hp/State.maxHp)*100}%`;
    const pb = E.get('player-block');
    if(State.block > 0) { pb.classList.remove('hide'); pb.querySelector('span:last-child').innerText = State.block; }
    else pb.classList.add('hide');
    renderStatusBar('hero-status', State.status);

    // Enemy
    E.get('enemy-hp-text').innerText = `${Math.max(0, State.enemy.curHp)}/${State.enemy.maxHp}`;
    E.get('enemy-hp-fill').style.width = `${(Math.max(0, State.enemy.curHp)/State.enemy.maxHp)*100}%`;
    const eb = E.get('enemy-block');
    if(State.enemy.block > 0) { eb.classList.remove('hide'); eb.querySelector('span:last-child').innerText = State.enemy.block; }
    else eb.classList.add('hide');
    renderStatusBar('enemy-status', State.eStatus);

    // Intent
    const intent = State.enemy.pattern[State.eInt];
    E.get('intent-icon').innerText = intent.t === 'atk' ? '⚔️' : (intent.t === 'blk' ? '🛡️' : '✨');
    E.get('intent-value').innerText = intent.v + (intent.m ? `x${intent.m}` : '');

    // HUD
    E.get('energy-text').innerText = `${State.energy}/${State.maxEnergy}`;
    E.get('draw-count').innerText = State.drawPile.length;
    E.get('discard-count').innerText = State.discardPile.length;
}

function renderStatusBar(id, status) {
    const cont = E.get(id);
    cont.innerHTML = '';
    const map = { str: '💪', weak: '⬇️', vuln: '💔', poi: '🤢' };
    Object.entries(status).forEach(([k, v]) => {
        if(v > 0) {
            const s = document.createElement('div');
            s.className = 'status-icon'; s.innerText = map[k];
            s.innerHTML += `<span class="status-val">${v}</span>`;
            cont.appendChild(s);
        }
    });
}

// -------------------------------------------------------------
// DRAG & PLAY
// -------------------------------------------------------------
let activeDrag = null;

function dragStart(e, idx, el) {
    Sfx.init();
    if(State.energy < State.hand[idx].cost) return;
    
    const touch = e.type.startsWith('touch');
    const startX = touch ? e.touches[0].clientX : e.clientX;
    const startY = touch ? e.touches[0].clientY : e.clientY;
    
    activeDrag = { idx, el, startX, startY };
    el.classList.add('dragging');
    
    const move = mev => {
        const cx = touch ? mev.touches[0].clientX : mev.clientX;
        const cy = touch ? mev.touches[0].clientY : mev.clientY;
        el.style.transform = `translate(${cx - startX}px, ${cy - startY}px) scale(1.1)`;
    };
    
    const end = eev => {
        const ey = touch ? eev.changedTouches[0].clientY : eev.clientY;
        window.removeEventListener(touch ? 'touchmove' : 'mousemove', move);
        window.removeEventListener(touch ? 'touchend' : 'mouseup', end);
        
        if(ey < window.innerHeight * 0.6) playCard(idx);
        else { el.classList.remove('dragging'); el.style.transform = ''; }
        
        activeDrag = null;
    };

    window.addEventListener(touch ? 'touchmove' : 'mousemove', move);
    window.addEventListener(touch ? 'touchend' : 'mouseup', end);
}

function playCard(idx) {
    const c = State.hand.splice(idx, 1)[0];
    State.energy -= c.cost;
    State.discardPile.push(c);
    
    Sfx.play(400, 'sine', 0.1);
    
    if(c.dmg) {
        let d = c.dmg + State.status.str;
        if(State.status.weak > 0) d = Math.floor(d * 0.75);
        if(State.eStatus.vuln > 0) d = Math.floor(d * 1.5);
        damageEntity('enemy', d);
        Sfx.attack();
    }
    if(c.blk) { State.block += c.blk; Sfx.block(); }
    if(c.str) { State.status.str += c.str; Sfx.buff(); }
    if(c.poi) { State.eStatus.poi += c.poi; Sfx.buff(); }
    if(c.weak) { State.eStatus.weak += c.weak; Sfx.buff(); }
    if(c.vuln) { State.eStatus.vuln += c.vuln; Sfx.buff(); }
    if(c.draw) drawCards(c.draw);

    renderHand();
    updateCombatUI();
}

function damageEntity(target, amt) {
    if(target === 'enemy') {
        let dealt = amt;
        if(State.enemy.block >= dealt) { State.enemy.block -= dealt; dealt = 0; }
        else { dealt -= State.enemy.block; State.enemy.block = 0; }
        
        State.enemy.curHp -= dealt;
        popText('enemy', dealt > 0 ? `-${dealt}` : '0', 'dmg');
        spawn(window.innerWidth*0.75, window.innerHeight*0.3, '#ff4757');
        
        if(State.enemy.curHp <= 0) winCombat();
    } else {
        let dealt = amt;
        if(State.block >= dealt) { State.block -= dealt; dealt = 0; }
        else { dealt -= State.block; State.block = 0; }
        
        State.hp -= dealt;
        popText('hero', dealt > 0 ? `-${dealt}` : '0', 'dmg');
        spawn(window.innerWidth*0.25, window.innerHeight*0.6, '#ff4757');
        Sfx.hurt();
        
        if(State.hp <= 0) E.show('gameover');
    }
    updateCombatUI();
}

function popText(who, txt, type) {
    const el = E.get(who === 'hero' ? 'hero-dmg-txt' : 'enemy-dmg-txt');
    el.innerText = txt; el.className = `damage-number show ${type}`;
    setTimeout(() => el.classList.remove('show'), 1000);
}

// -------------------------------------------------------------
// TURN FLOW
// -------------------------------------------------------------
E.get('btn-end-turn').onclick = () => {
    if(State.screen !== 'combat' || State.energy < 0) return;
    State.discardPile.push(...State.hand);
    State.hand = [];
    renderHand();
    enemyTurn();
};

async function enemyTurn() {
    const intent = State.enemy.pattern[State.eInt];
    
    // Poison ticks
    if(State.eStatus.poi > 0) {
        damageEntity('enemy', State.eStatus.poi);
        State.eStatus.poi--;
    }
    if(State.enemy.curHp <= 0) return;

    await new Promise(r => setTimeout(r, 800));
    
    if(intent.t === 'atk') {
        const hits = intent.m || 1;
        for(let i=0; i<hits; i++) {
            let d = intent.v + State.eStatus.str;
            if(State.eStatus.weak > 0) d = Math.floor(d * 0.75);
            if(State.status.vuln > 0) d = Math.floor(d * 1.5);
            damageEntity('player', d);
            Sfx.attack();
            await new Promise(r => setTimeout(r, 400));
        }
    } else if(intent.t === 'blk') {
        State.enemy.block += intent.v;
        Sfx.block();
    } else if(intent.t === 'str') {
        State.eStatus.str += intent.v;
        Sfx.buff();
    }

    State.eInt = (State.eInt + 1) % State.enemy.pattern.length;
    
    // Weak/Vuln decrement
    if(State.eStatus.weak > 0) State.eStatus.weak--;
    if(State.eStatus.vuln > 0) State.eStatus.vuln--;

    updateCombatUI();
    if(State.hp > 0) startPlayerTurn();
}

// -------------------------------------------------------------
// REWARDS & MAP
// -------------------------------------------------------------
function winCombat() {
    Sfx.win();
    setTimeout(() => {
        E.show('reward');
        E.get('loot-gold').innerText = 20 + Math.floor(Math.random()*20);
        const cont = E.get('reward-cards');
        cont.innerHTML = '';
        // 3 Random cards
        for(let i=0; i<3; i++) {
            const c = CARDS[Math.floor(Math.random()*CARDS.length)];
            const div = document.createElement('div');
            div.className = `game-card type-${c.type}`;
            div.innerHTML = `<div class="card-name">${c.name}</div><div class="card-art-box">${c.art}</div><div class="card-desc-box">${c.desc}</div>`;
            div.onclick = () => { State.deck.push({...c, uid:Math.random()}); E.show('map'); State.floor++; genMap(); };
            cont.appendChild(div);
        }
    }, 1000);
}

function genMap() {
    const cont = E.get('map-nodes');
    cont.innerHTML = '';
    const types = ['⚔️', '⚔️', '💰', '✨'];
    for(let i=0; i<6; i++) {
        const div = document.createElement('div');
        div.className = 'map-node active';
        const t = types[Math.floor(Math.random()*types.length)];
        div.innerText = t;
        div.onclick = () => {
            if(t === '⚔️') startCombat(ENEMIES[Math.min(ENEMIES.length-1, Math.floor(Math.random()*2))]);
            else if(t === '💰') { E.show('shop'); renderShop(); }
            else { State.hp = Math.min(State.maxHp, State.hp + 20); State.floor++; genMap(); }
        };
        cont.appendChild(div);
    }
}

function renderShop() {
    const cGrid = E.get('shop-cards');
    cGrid.innerHTML = '';
    [0,1,2].forEach(() => {
        const c = CARDS[Math.floor(Math.random()*CARDS.length)];
        const div = document.createElement('div');
        div.className = 'game-card shop-item';
        div.innerHTML = `<div class="price">💰 40</div><div class="card-name">${c.name}</div><div class="card-art-box">${c.art}</div>`;
        div.onclick = () => {
            if(State.gold >= 40) { State.gold -= 40; State.deck.push({...c, uid:Math.random()}); div.remove(); E.updateHUD(); }
        };
        cGrid.appendChild(div);
    });
}

// -------------------------------------------------------------
// NAVIGATION
// -------------------------------------------------------------
E.get('btn-start').onclick = () => E.show('tutorial');
E.get('btn-tutorial-start').onclick = () => E.initGame();
E.get('btn-exit-shop').onclick = () => { E.show('map'); State.floor++; genMap(); };
E.get('btn-restart').onclick = () => location.reload();
E.get('btn-skip-reward').onclick = () => { State.gold += parseInt(E.get('loot-gold').innerText); E.updateHUD(); E.show('map'); State.floor++; genMap(); };
E.get('btn-view-deck').onclick = () => {
    E.get('deck-viewer').classList.remove('hide');
    const g = E.get('deck-grid'); g.innerHTML = '';
    State.deck.forEach(c => {
        const d = document.createElement('div'); d.className = `game-card type-${c.type}`;
        d.innerHTML = `<div class="card-name">${c.name}</div><div class="card-art-box">${c.art}</div>`;
        g.appendChild(d);
    });
};
E.get('btn-close-deck').onclick = () => E.get('deck-viewer').classList.add('hide');
