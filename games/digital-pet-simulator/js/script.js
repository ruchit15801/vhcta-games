// === GAME STATE & DEEP LOGIC ===
const pet = {
    hunger: 50,
    happiness: 50,
    energy: 100,
    hygiene: 100,
    health: 100,
    coins: 200,
    xp: 0,
    level: 1,
    state: 'idle' // idle, sleeping, eating, washing, sick
};

const inventory = {
    'soap': 1,
    'medicine': 0,
    'premium_meat': 0
};

const shopItems = [
    { id: 'kibble', name: 'Basic Kibble', desc: '+20 Hunger', cost: 10, icon: '🥣', type: 'food', value: 20 },
    { id: 'premium_meat', name: 'Premium Meat', desc: '+50 Hunger, +10 Happy', cost: 50, icon: '🥩', type: 'food', value: 50 },
    { id: 'soap', name: 'Luxury Soap', desc: 'Cleans pet fully', cost: 30, icon: '🧼', type: 'clean', value: 100 },
    { id: 'medicine', name: 'Medicine', desc: 'Restores Health', cost: 100, icon: '💊', type: 'health', value: 100 }
];

const DECAY_RATE = 0.5; // Base stat decay per second
let lastTime = 0;

// === UI ELEMENTS ===
const ui = {
    layer: document.getElementById('hud-layer'),
    modalOverlay: document.getElementById('modal-overlay'),
    shopPanel: document.getElementById('shop-panel'),
    invPanel: document.getElementById('inventory-panel'),
    tutorial: document.getElementById('tutorial-screen'),
    bg: document.getElementById('background'),
    interactionLayer: document.getElementById('interaction-layer'),
    dragItem: document.getElementById('draggable-item'),
    hint: document.getElementById('interaction-hint'),
    
    lblLevel: document.getElementById('player-level'),
    xpFill: document.getElementById('xp-fill'),
    lblCoins: document.getElementById('coin-balance'),
    
    bars: {
        hunger: document.getElementById('bar-hunger'),
        happiness: document.getElementById('bar-happiness'),
        energy: document.getElementById('bar-energy'),
        hygiene: document.getElementById('bar-hygiene'),
        health: document.getElementById('bar-health')
    }
};

// === AUDIO SYSTEM ===
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration, vol=0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

const sfx = {
    click: () => playTone(600, 'sine', 0.1, 0.1),
    buy: () => { playTone(800, 'square', 0.1, 0.1); setTimeout(()=>playTone(1200, 'square', 0.2, 0.1), 100); },
    bark: () => { playTone(300, 'sawtooth', 0.1, 0.2); setTimeout(() => playTone(250, 'sawtooth', 0.2, 0.2), 100); },
    eat: () => { for(let i=0; i<5; i++) setTimeout(()=>playTone(150+Math.random()*50, 'square', 0.1, 0.1), i*150); },
    levelUp: () => { [400, 500, 600, 800, 1000].forEach((f, i) => setTimeout(()=>playTone(f, 'square', 0.15, 0.1), i*150)); }
};

// === LOGIC FUNCTIONS ===
function addXP(amount) {
    pet.xp += amount;
    const xpNeeded = pet.level * 100;
    if (pet.xp >= xpNeeded) {
        pet.level++;
        pet.xp -= xpNeeded;
        pet.coins += pet.level * 50; // Reward
        sfx.levelUp();
        for(let i=0;i<20;i++) setTimeout(()=>createParticle(cw/2, ch/2, ['🎉','✨','🪙'][Math.floor(Math.random()*3)]), i*50);
    }
    updateHUD();
}

function updateHUD() {
    ui.lblLevel.innerText = pet.level;
    ui.lblCoins.innerText = pet.coins;
    ui.xpFill.style.width = Math.min(100, (pet.xp / (pet.level * 100)) * 100) + '%';
    
    ['hunger', 'happiness', 'energy', 'hygiene', 'health'].forEach(stat => {
        ui.bars[stat].style.width = pet[stat] + '%';
    });

    // Visual BG effects
    ui.bg.className = pet.state === 'sleeping' ? 'bg-room night-mode' : 
                      pet.health < 30 ? 'bg-room sick-mode' : 
                      pet.state === 'playing' ? 'bg-garden' : 'bg-room';
}

function buyItem(id) {
    const item = shopItems.find(i => i.id === id);
    if (pet.coins >= item.cost) {
        pet.coins -= item.cost;
        sfx.buy();
        if (id === 'kibble') {
            pet.hunger = Math.min(100, pet.hunger + item.value);
            sfx.eat();
            addXP(10);
            createParticle(cw/2, ch/2, '🍖');
        } else {
            inventory[id] = (inventory[id] || 0) + 1;
            renderInventory();
        }
        updateHUD();
        renderShop();
    }
}

// === INTERACTION (DRAG & DROP) ===
let activeDragItem = null;

function startDragInteraction(itemDef) {
    closePanels();
    activeDragItem = itemDef;
    ui.interactionLayer.classList.remove('hidden');
    ui.dragItem.innerText = itemDef.icon;
    ui.dragItem.style.left = '50%';
    ui.dragItem.style.top = '80%';
    ui.dragItem.classList.remove('hidden');
    ui.hint.classList.remove('hidden');
}

ui.interactionLayer.addEventListener('touchmove', handleDrag, {passive: false});
ui.interactionLayer.addEventListener('mousemove', handleDrag);
ui.interactionLayer.addEventListener('touchend', checkDrop);
ui.interactionLayer.addEventListener('mouseup', checkDrop);

function handleDrag(e) {
    if(!activeDragItem) return;
    e.preventDefault();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    ui.dragItem.style.left = x + 'px';
    ui.dragItem.style.top = y + 'px';
    
    // Check intersection with pet center
    const dist = Math.hypot(x - cw/2, y - ch/2);
    if (dist < 150 && activeDragItem.id === 'soap') {
        // Scrubbing effect
        if(Math.random() > 0.8) createParticle(x + (Math.random()-0.5)*50, y + (Math.random()-0.5)*50, '🫧');
        pet.hygiene = Math.min(100, pet.hygiene + 2);
    }
}

function checkDrop(e) {
    if(!activeDragItem) return;
    const x = parseInt(ui.dragItem.style.left);
    const y = parseInt(ui.dragItem.style.top);
    const dist = Math.hypot(x - cw/2, y - ch/2);
    
    if (dist < 200) {
        // Dropped on pet
        sfx.click();
        if (activeDragItem.type === 'food') {
            pet.hunger = Math.min(100, pet.hunger + activeDragItem.value);
            pet.happiness = Math.min(100, pet.happiness + 10);
            sfx.eat();
            addXP(25);
        } else if (activeDragItem.type === 'health') {
            pet.health = Math.min(100, pet.health + activeDragItem.value);
            addXP(50);
            createParticle(cw/2, ch/2, '💖');
        } else if (activeDragItem.type === 'clean') {
            addXP(20);
        }
        inventory[activeDragItem.id]--;
    }
    
    // End drag
    activeDragItem = null;
    ui.interactionLayer.classList.add('hidden');
    ui.dragItem.classList.add('hidden');
    ui.hint.classList.add('hidden');
    updateHUD();
}

// === UI PANELS & BUTTONS ===
window.closePanels = () => {
    ui.modalOverlay.classList.add('hidden');
    ui.shopPanel.classList.remove('active');
    ui.invPanel.classList.remove('active');
};

function openPanel(panel) {
    sfx.click();
    ui.modalOverlay.classList.remove('hidden');
    panel.classList.add('active');
}

document.getElementById('btn-shop').onclick = () => { renderShop(); openPanel(ui.shopPanel); };
document.getElementById('btn-food').onclick = () => { renderInventory(); openPanel(ui.invPanel); };
document.getElementById('btn-clean').onclick = () => {
    if(inventory.soap > 0) startDragInteraction(shopItems.find(i=>i.id==='soap'));
    else { renderShop(); openPanel(ui.shopPanel); } // Go buy soap
};
document.getElementById('btn-play').onclick = () => {
    sfx.click();
    if(pet.state === 'sleeping' || pet.health < 30) return;
    pet.state = 'playing';
    pet.happiness = Math.min(100, pet.happiness + 30);
    pet.energy = Math.max(0, pet.energy - 15);
    pet.hygiene = Math.max(0, pet.hygiene - 10);
    sfx.bark();
    addXP(15);
    pet.coins += 5; // Earn coins playing
    for(let i=0; i<3; i++) setTimeout(() => createParticle(cw/2 + (Math.random()-0.5)*100, ch/2, '🎾'), i*200);
    updateHUD();
    setTimeout(() => { if(pet.state === 'playing') pet.state = 'idle'; updateHUD(); }, 3000);
};
document.getElementById('btn-sleep').onclick = () => {
    sfx.click();
    pet.state = pet.state === 'sleeping' ? 'idle' : 'sleeping';
    if(pet.state === 'sleeping') createParticle(cw/2, ch/2 - 100, '💤');
    updateHUD();
};

document.getElementById('btn-start').onclick = () => {
    sfx.click();
    ui.tutorial.style.opacity = 0;
    setTimeout(() => {
        ui.tutorial.style.display = 'none';
        ui.layer.classList.remove('hidden');
    }, 500);
};

// Render Functions
function renderShop() {
    const html = shopItems.map(item => `
        <div class="shop-item">
            <div class="icon">${item.icon}</div>
            <div class="details">
                <h4>${item.name}</h4>
                <p>${item.desc}</p>
                <button class="buy-btn ${pet.coins < item.cost ? 'disabled' : ''}" onclick="buyItem('${item.id}')">
                    🪙 ${item.cost}
                </button>
            </div>
        </div>
    `).join('');
    document.getElementById('shop-items').innerHTML = html;
}

function renderInventory() {
    const items = Object.keys(inventory).filter(k => inventory[k] > 0);
    if(items.length === 0) {
        document.getElementById('inventory-items').innerHTML = '<p style="color:#aaa;text-align:center;">Your inventory is empty. Go to the shop!</p>';
        return;
    }
    const html = items.map(id => {
        const item = shopItems.find(i => i.id === id);
        return `
        <div class="shop-item">
            <div class="icon">${item.icon}</div>
            <div class="details">
                <h4>${item.name} (x${inventory[id]})</h4>
                <button class="use-btn" onclick="startDragInteraction(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                    Use
                </button>
            </div>
        </div>
        `;
    }).join('');
    document.getElementById('inventory-items').innerHTML = html;
}

// === CANVAS RENDERER ===
const canvas = document.getElementById('petCanvas');
const ctx = canvas.getContext('2d');
let cw, ch;
function resize() { cw = canvas.width = window.innerWidth; ch = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

const dogImg = new Image(); dogImg.src = 'assets/images/dog_base.jpg';

let time = 0;
let particles = [];
function createParticle(x, y, emoji) {
    particles.push({ x, y, emoji, vy: -2 - Math.random() * 3, vx: (Math.random() - 0.5) * 4, life: 1.0, size: 30 + Math.random() * 20 });
}

function updateDrawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 2 * dt; // Gravity
        p.life -= dt * 0.8;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.font = `${p.size}px Arial`;
        ctx.fillText(p.emoji, p.x, p.y);
        ctx.globalAlpha = 1.0;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawPet() {
    // Advanced procedural animation based on state
    let breathe = Math.sin(time * 3) * 0.02;
    let floatY = Math.sin(time * 2) * 5;
    
    if(pet.state === 'sleeping') { breathe = Math.sin(time * 1.5) * 0.03; floatY = 0; }
    if(pet.health < 30) { breathe = Math.sin(time * 5) * 0.01; floatY = Math.sin(time*10) * 2; } // Shivering

    const imgWidth = Math.min(cw * 0.8, 400);
    const imgHeight = (dogImg.height / dogImg.width) * imgWidth || imgWidth;
    
    const cx = cw / 2;
    const cy = ch / 2 + floatY + (ch < 750 ? 120 : 50);

    ctx.save();
    ctx.translate(cx, cy);

    if (pet.state === 'sleeping') { ctx.rotate(Math.PI / 16); ctx.globalAlpha = 0.8; }
    
    let scaleX = 1, scaleY = 1 + breathe;
    ctx.scale(scaleX, scaleY);

    // Shadow
    ctx.beginPath(); ctx.ellipse(0, imgHeight/2 - 10, imgWidth/2.5, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.filter = 'blur(10px)'; ctx.fill(); ctx.filter = 'none';

    // Image Mask
    ctx.beginPath(); ctx.arc(0, 0, imgWidth/2.2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();

    if (dogImg.complete) {
        // Dirty effect
        if(pet.hygiene < 40) ctx.filter = 'sepia(0.8) brightness(0.7)';
        ctx.drawImage(dogImg, -imgWidth/2, -imgHeight/2, imgWidth, imgHeight);
        ctx.filter = 'none';
        
        // Dirt particles over pet if dirty
        if (pet.hygiene < 20 && Math.random() < 0.05) {
            createParticle(cx + (Math.random()-0.5)*imgWidth, cy + (Math.random()-0.5)*imgHeight, '🪰');
        }
    } else {
        ctx.fillStyle = '#4facfe'; ctx.fill();
    }
    
    ctx.restore();
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp; time += dt;

    ctx.clearRect(0, 0, cw, ch);

    if (!ui.layer.classList.contains('hidden')) {
        // Logic Tick
        if (pet.state !== 'sleeping') {
            pet.hunger -= DECAY_RATE * 0.5 * dt;
            pet.energy -= DECAY_RATE * 0.3 * dt;
            pet.happiness -= DECAY_RATE * 0.4 * dt;
            pet.hygiene -= DECAY_RATE * 0.2 * dt;
            
            // Health decays if others are extremely low
            if (pet.hunger < 10 || pet.hygiene < 10) pet.health -= DECAY_RATE * dt;
        } else {
            pet.energy += DECAY_RATE * 5 * dt;
            if (pet.energy >= 100) { pet.energy = 100; pet.state = 'idle'; updateHUD(); }
        }

        ['hunger', 'happiness', 'energy', 'hygiene', 'health'].forEach(s => pet[s] = Math.max(0, Math.min(100, pet[s])));
        
        // Periodic UI update (optimization)
        if(Math.floor(time*10) % 5 === 0) updateHUD();
    }

    drawPet();
    updateDrawParticles(dt);

    requestAnimationFrame(gameLoop);
}

// Tap Interaction
canvas.addEventListener('pointerdown', (e) => {
    if (!ui.layer.classList.contains('hidden') && activeDragItem === null) {
        const rect = canvas.getBoundingClientRect();
        const dist = Math.hypot(e.clientX - rect.left - cw/2, e.clientY - rect.top - ch/2);
        if (dist < 200) {
            if (pet.state !== 'sleeping' && pet.health > 30) {
                pet.happiness = Math.min(100, pet.happiness + 5);
                sfx.bark();
                createParticle(e.clientX, e.clientY, '❤️');
                addXP(2);
            }
        }
    }
});

updateHUD();
requestAnimationFrame(gameLoop);
