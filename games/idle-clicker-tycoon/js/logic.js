/**
 * Infinite Tycoon: Galactic Empire - V2 Core Simulation Logic
 * Features: Managers, Milestones, Events, and Cycle-Based Automation.
 */

// --- CONFIGURATION & DATA ---
const BUSINESS_DATA = [
    { id: 'stall', name: 'Nano Stall', baseCost: 10, baseIncome: 1, interval: 1000, icon: 'assets/stall.png', unlockAt: 0 },
    { id: 'factory', name: 'Auto Factory', baseCost: 150, baseIncome: 15, interval: 3000, icon: 'assets/factory.png', unlockAt: 100 },
    { id: 'techhub', name: 'Cyber Hub', baseCost: 2000, baseIncome: 90, interval: 10000, icon: 'assets/techhub.png', unlockAt: 1500 },
    { id: 'spacestation', name: 'Orbit Hub', baseCost: 15000, baseIncome: 350, interval: 30000, icon: 'assets/spacestation.png', unlockAt: 10000 },
    { id: 'dyson', name: 'Dyson Sphere', baseCost: 200000, baseIncome: 1200, interval: 120000, icon: 'assets/core.png', unlockAt: 100000 }
];

const MANAGER_DATA = [
    { id: 'mgr_stall', bizId: 'stall', name: 'Stall Junior', cost: 1000, desc: 'Automates the Nano Stall.' },
    { id: 'mgr_factory', bizId: 'factory', name: 'Factory Bot', cost: 15000, desc: 'Automates the Auto Factory.' },
    { id: 'mgr_techhub', bizId: 'techhub', name: 'Cyber Manager', cost: 100000, desc: 'Automates the Cyber Hub.' },
    { id: 'mgr_spacestation', bizId: 'spacestation', name: 'Fleet Cmdr', cost: 500000, desc: 'Automates Orbit Hub.' }
];

const UPGRADE_DATA = [
    { id: 'click_1', name: 'Neural Pulse', cost: 50, type: 'click', mult: 2, desc: '2x Click Power.' },
    { id: 'click_2', name: 'Force Link', cost: 1000, type: 'click', mult: 5, desc: '5x Click Power.' },
    { id: 'speed_1', name: 'Turbo Chips', cost: 5000, type: 'global_speed', mult: 0.8, desc: '20% Faster Cycles.' }
];

// --- GAME STATE ---
let state = {
    credits: 0,
    totalEarned: 0,
    prestigeMultiplier: 1,
    businesses: {
        stall: { level: 1, timer: 0, automated: false },
        factory: { level: 0, timer: 0, automated: false },
        techhub: { level: 0, timer: 0, automated: false },
        spacestation: { level: 0, timer: 0, automated: false },
        dyson: { level: 0, timer: 0, automated: false }
    },
    managers: [],
    upgrades: [],
    lastSave: Date.now(),
    marketEvent: { active: false, type: '', mult: 1, timer: 0 }
};

// --- UTILITIES ---
const format = (v) => {
    if (v < 1000) return Math.floor(v).toString();
    const s = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx"];
    const n = Math.floor(("" + Math.floor(v)).length / 3);
    let sv = parseFloat((n != 0 ? (v / Math.pow(1000, n)) : v).toPrecision(3));
    return sv.toFixed(sv % 1 === 0 ? 0 : 1) + s[n];
};

const getCost = (base, lvl) => Math.floor(base * Math.pow(1.15, lvl));

const getInterval = (bizId) => {
    const biz = BUSINESS_DATA.find(b => b.id === bizId);
    let interval = biz.interval;
    const lvl = state.businesses[bizId].level;
    
    // Milestone logic: Speed doubles at 25, 50, 100...
    const milestones = [25, 50, 100, 200, 400];
    milestones.forEach(m => { if (lvl >= m) interval *= 0.5; });
    
    // Upgrade logic
    state.upgrades.forEach(uid => {
        const u = UPGRADE_DATA.find(x => x.id === uid);
        if (u.type === 'global_speed') interval *= u.mult;
    });
    
    return Math.max(50, interval); // Minimum 50ms
};

const getIncome = (bizId) => {
    const biz = BUSINESS_DATA.find(b => b.id === bizId);
    let income = biz.baseIncome * state.businesses[bizId].level;
    
    // Milestone logic: Profit doubles at 25, 50, 100...
    const milestones = [25, 50, 100, 200, 400];
    milestones.forEach(m => { if (state.businesses[bizId].level >= m) income *= 2; });
    
    return income * state.prestigeMultiplier * state.marketEvent.mult;
};

// --- CORE LOOPS ---
let lastFrameTime = Date.now();
const tick = () => {
    const now = Date.now();
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    // Process Market Events
    if (state.marketEvent.active) {
        state.marketEvent.timer -= dt;
        if (state.marketEvent.timer <= 0) {
            state.marketEvent.active = false;
            state.marketEvent.mult = 1;
            updateEventIcon();
        }
    } else if (Math.random() < 0.0001) { // 0.01% chance per frame to start event
        triggerEvent();
    }

    // Process Businesses
    Object.keys(state.businesses).forEach(id => {
        const b = state.businesses[id];
        if (b.level > 0) {
            if (b.automated || b.timer > 0) {
                b.timer += dt;
                const interval = getInterval(id);
                if (b.timer >= interval) {
                    const cycles = b.automated ? Math.floor(b.timer / interval) : 1;
                    addCredits(getIncome(id) * cycles);
                    b.timer = b.automated ? b.timer % interval : 0;
                }
            }
        }
    });

    updateBars();
};

const triggerEvent = () => {
    const types = [
        { name: 'BOOM', mult: 2, desc: 'Market Surge: 2x Profit' },
        { name: 'CRASH', mult: 0.5, desc: 'Market Crash: 0.5x Profit' }
    ];
    const e = types[Math.floor(Math.random() * types.length)];
    state.marketEvent = { active: true, type: e.name, mult: e.mult, timer: 15000 };
    updateEventIcon(e.desc);
};

// --- INTERACTIONS ---
const handleCoreClick = (e) => {
    let power = state.prestigeMultiplier;
    state.upgrades.forEach(uid => {
        const u = UPGRADE_DATA.find(x => x.id === uid);
        if (u.type === 'click') power *= u.mult;
    });
    addCredits(power);
    spawnFloat(e.clientX, e.clientY, `+${format(power)}`);
    document.getElementById('main-core').style.transform = 'scale(0.9)';
    setTimeout(() => document.getElementById('main-core').style.transform = 'scale(1)', 50);
};

const addCredits = (v) => {
    state.credits += v;
    state.totalEarned += v;
    document.getElementById('total-credits').innerText = format(state.credits);
};

const buyBiz = (id) => {
    const b = BUSINESS_DATA.find(x => x.id === id);
    const cost = getCost(b.baseCost, state.businesses[id].level);
    if (state.credits >= cost) {
        state.credits -= cost;
        state.businesses[id].level++;
        render('business');
    }
};

const hireManager = (mid) => {
    const m = MANAGER_DATA.find(x => x.id === mid);
    if (state.credits >= m.cost && !state.managers.includes(mid)) {
        state.credits -= m.cost;
        state.managers.push(mid);
        state.businesses[m.bizId].automated = true;
        render('managers');
    }
};

const buyUpgrade = (uid) => {
    const u = UPGRADE_DATA.find(x => x.id === uid);
    if (state.credits >= u.cost && !state.upgrades.includes(uid)) {
        state.credits -= u.cost;
        state.upgrades.push(uid);
        render('upgrades');
    }
};

const prestigeReset = () => {
    const potential = Math.floor(Math.sqrt(state.totalEarned / 1000000) - (state.prestigeMultiplier - 1) * 10);
    if (potential < 1) {
        alert("You need at least 1 potential shard to ascend!");
        return;
    }
    if (confirm("Ascending will reset your empire. You will keep your power boost. Proceed?")) {
        state.prestigeMultiplier += potential * 0.1;
        state.credits = 0;
        state.totalEarned = 0;
        Object.keys(state.businesses).forEach(id => {
            state.businesses[id] = { level: id === 'stall' ? 1 : 0, timer: 0, automated: false };
        });
        state.managers = [];
        state.upgrades = [];
        save();
        location.reload();
    }
};

// --- UI UPDATES ---
const spawnFloat = (x, y, txt) => {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.innerText = txt;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    document.getElementById('floating-text-container').appendChild(el);
    setTimeout(() => el.remove(), 1000);
};

const updateBars = () => {
    Object.keys(state.businesses).forEach(id => {
        const bar = document.getElementById(`bar-${id}`);
        if (bar) {
            const pct = (state.businesses[id].timer / getInterval(id)) * 100;
            bar.style.width = Math.min(100, pct) + '%';
        }
    });
};

const updateEventIcon = (msg) => {
    const el = document.getElementById('market-ticker');
    if (!el) return;
    if (state.marketEvent.active) {
        el.innerText = `[ MARKET ${state.marketEvent.type}: ${msg} ]`;
        el.className = 'active-' + state.marketEvent.type.toLowerCase();
    } else {
        el.innerText = "[ MARKET STABLE ]";
        el.className = '';
    }
};

const render = (tab) => {
    const content = document.getElementById('panel-content');
    const title = document.getElementById('panel-title');
    content.innerHTML = '';

    if (tab === 'business') {
        title.innerText = "BUSINESS HUB";
        
        // Find best value
        let bestValueId = null;
        let highestRatio = 0;
        BUSINESS_DATA.forEach(biz => {
            if (state.totalEarned >= biz.unlockAt) {
                const cost = getCost(biz.baseCost, state.businesses[biz.id].level);
                const ratio = biz.baseIncome / cost;
                if (ratio > highestRatio) {
                    highestRatio = ratio;
                    bestValueId = biz.id;
                }
            }
        });

        BUSINESS_DATA.forEach(b => {
            const s = state.businesses[b.id];
            const cost = getCost(b.baseCost, s.level);
            const isLocked = state.totalEarned < b.unlockAt;
            const isBest = b.id === bestValueId && state.credits >= cost;
            const progress = s.level > 0 ? (s.timer / getInterval(b.id)) * 100 : 0;
            
            content.innerHTML += `
                <div class="item-card ${isLocked ? 'locked' : ''} ${state.credits < cost ? 'disabled' : ''}">
                    <img src="${b.icon}" class="item-icon">
                    <div class="item-info">
                        <div class="item-header">
                            <span>${isLocked ? '???' : b.name}</span>
                            <span class="lvl">Lv. ${s.level}</span>
                        </div>
                        <div class="progress-container">
                            <div class="progress-fill" id="bar-${b.id}" style="width:${progress}%"></div>
                        </div>
                        <div class="item-cost">⌬ ${format(cost)} ${isBest ? '<span class="badge">BEST</span>' : ''}</div>
                    </div>
                    <button class="buy-btn" onclick="buyBiz('${b.id}')">BUY</button>
                </div>
            `;
        });
    } else if (tab === 'managers') {
        title.innerText = "HIRE MANAGERS";
        MANAGER_DATA.forEach(m => {
            const isOwned = state.managers.includes(m.id);
            content.innerHTML += `
                <div class="item-card ${isOwned ? 'owned' : ''} ${!isOwned && state.credits < m.cost ? 'disabled' : ''}">
                    <div class="item-info">
                        <div class="item-header"><span>${m.name}</span></div>
                        <p style="font-size:0.7rem; opacity:0.7">${m.desc}</p>
                        <div class="item-cost">⌬ ${format(m.cost)}</div>
                    </div>
                    ${isOwned ? '<span class="status-tag">HIRED</span>' : `<button class="buy-btn" onclick="hireManager('${m.id}')">HIRE</button>`}
                </div>
            `;
        });
    } else if (tab === 'upgrades') {
        title.innerText = "TECH UPGRADES";
        UPGRADE_DATA.forEach(u => {
            const isOwned = state.upgrades.includes(u.id);
            content.innerHTML += `
                <div class="item-card ${isOwned ? 'owned' : ''} ${!isOwned && state.credits < u.cost ? 'disabled' : ''}">
                    <div class="item-info">
                        <div class="item-header"><span>${u.name}</span></div>
                        <p style="font-size:0.7rem; opacity:0.7">${u.desc}</p>
                        <div class="item-cost">⌬ ${format(u.cost)}</div>
                    </div>
                    ${isOwned ? '<span class="status-tag">ACTIVE</span>' : `<button class="buy-btn" onclick="buyUpgrade('${u.id}')">ACQUIRE</button>`}
                </div>
            `;
        });
    } else if (tab === 'prestige') {
        title.innerText = "ASCENSION";
        const potential = Math.max(0, Math.floor(Math.sqrt(state.totalEarned / 1000000) - (state.prestigeMultiplier - 1) * 10));
        content.innerHTML = `
            <div style="text-align: center; padding: 1.5rem; background: rgba(112, 0, 255, 0.1); border-radius: 24px; border: 1px solid var(--glass-border);">
                <h3 style="color: var(--gold);">Multiplier: x${state.prestigeMultiplier.toFixed(1)}</h3>
                <p style="margin: 1rem 0; font-size: 0.8rem; opacity: 0.8;">Sacrifice current progress for permanent power shards.</p>
                <div style="font-size: 1.1rem; margin-bottom: 1rem;">Potential Shards: <span style="color: var(--primary);">+${potential}</span></div>
                <button class="premium-btn" onclick="prestigeReset()">ASCEND NOW</button>
            </div>
        `;
    }
};

// --- SYSTEM ---
const save = () => {
    state.lastSave = Date.now();
    localStorage.setItem('tycoon_v2', JSON.stringify(state));
};

const load = () => {
    const s = localStorage.getItem('tycoon_v2');
    if (s) {
        state = { ...state, ...JSON.parse(s) };
        const off = (Date.now() - state.lastSave) / 1000;
        if (off > 60) calcOffline(off);
    }
};

const calcOffline = (sec) => {
    let earned = 0;
    Object.keys(state.businesses).forEach(id => {
        if (state.businesses[id].automated) {
            const cycles = Math.floor(sec * 1000 / getInterval(id));
            earned += getIncome(id) * cycles;
        }
    });
    if (earned > 0) {
        alert("While you were gone, your managers earned: ⌬ " + format(earned));
        addCredits(earned);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    load();
    render('business');
    setInterval(tick, 30);
    setInterval(save, 5000);
    document.getElementById('main-core').onclick = handleCoreClick;
    
    // Nav
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.onclick = () => {
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            b.classList.add('active');
            render(b.dataset.tab);
            document.getElementById('side-panel').classList.remove('hidden');
        };
    });

    document.getElementById('close-panel').onclick = () => {
        document.getElementById('side-panel').classList.add('hidden');
    };

    document.getElementById('start-game').onclick = () => {
        document.getElementById('tutorial-overlay').classList.add('hidden');
    };
});
