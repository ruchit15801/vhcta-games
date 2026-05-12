// Game State & Configuration
const Game = {
    state: {
        currentLevel: 1,
        inventory: [],
        discoveredClues: [],
        unlockedLevels: 1,
        startTime: 0,
        hintsUsed: 0,
        settings: { sfx: true, music: true }
    },
    audio: {},
    ui: {
        screens: {
            loading: document.getElementById('loading-screen'),
            menu: document.getElementById('main-menu'),
            tutorial: document.getElementById('tutorial-screen'),
            game: document.getElementById('game-screen'),
            levels: document.getElementById('levels-screen'),
            settings: document.getElementById('settings-screen'),
            victory: document.getElementById('victory-screen')
        },
        buttons: {
            play: document.getElementById('btn-play'),
            levels: document.getElementById('btn-levels'),
            settings: document.getElementById('btn-settings'),
            start: document.getElementById('btn-start-game'),
            nextRoom: document.getElementById('btn-next-room'),
            hint: document.getElementById('btn-hint')
        },
        game: {
            bgImage: document.getElementById('bg-image'),
            objectsLayer: document.getElementById('objects-layer'),
            inventoryContainer: document.getElementById('inventory-container'),
            inspectPanel: document.getElementById('inspect-panel'),
            inspectEmoji: document.getElementById('inspect-emoji'),
            inspectTitle: document.getElementById('inspect-title'),
            inspectDesc: document.getElementById('inspect-desc'),
            puzzleArea: document.getElementById('puzzle-interaction-area'),
            dialogBox: document.getElementById('dialog-box'),
            dialogText: document.getElementById('dialog-text'),
            roomText: document.getElementById('current-room-text'),
            fxCanvas: document.getElementById('fx-canvas')
        }
    },
    itemsDB: {
        'iron_key': { id: 'iron_key', name: 'Iron Key', icon: '🔑', img: 'assets/images/item_key.png', desc: 'A rusty iron key. Heavy and old.' },
        'gold_key': { id: 'gold_key', name: 'Gold Key', icon: '🗝️', img: 'assets/images/item_key.png', desc: 'An ornate golden key. Shines warmly.' },
        'skull_key': { id: 'skull_key', name: 'Skull Key', icon: '💀', img: 'assets/images/item_key.png', desc: 'A menacing key shaped like a skull.' },
        'emerald_key': { id: 'emerald_key', name: 'Emerald Key', icon: '💎', img: 'assets/images/item_key.png', desc: 'A glowing green gem key.' },
        'master_key': { id: 'master_key', name: 'Master Key', icon: '👑', img: 'assets/images/item_key.png', desc: 'The ultimate key to escape.' },
        'crowbar': { id: 'crowbar', name: 'Crowbar', icon: '🪝', desc: 'A heavy metal crowbar. Pries open stubborn things.' },
        'flashlight': { id: 'flashlight', name: 'Flashlight', icon: '🔦', desc: 'A sturdy flashlight.' },
        'cogs': { id: 'cogs', name: 'Mechanism Cogs', icon: '⚙️', desc: 'Vital mechanical gears.' },
        'wire': { id: 'wire', name: 'Copper Wire', icon: '🔌', desc: 'Used to bridge electrical connections.' },
        'potion': { id: 'potion', name: 'Acid Potion', icon: '🧪', desc: 'Melts through certain locks.' }
    },
    levels: [] // Generated below
};

// Generates 30 visually and logically upgraded levels
function generateLevels() {
    const levels = [];
    
    for(let i = 1; i <= 30; i++) {
        let phase = Math.ceil(i / 6); // 5 Distinct Phases (Phase 1 to 5)
        
        let level = {
            id: i, phase: phase,
            bg: 'assets/images/room_1.png', 
            objects: []
        };

        // Escaping object (Door or passage)
        let exit = { id: 'main_door', x: 45, y: 25, w: 100, h: 150, name: 'Ornate Door', desc: 'The only way out. Completely locked.', img: 'assets/images/item_door.png', interactable: true, action: 'escape' };

        // Unique dynamic logic per room to prevent "sameness"
        if (phase === 1) {
            // PHASE 1: The Dark Cell (Simple Find & Key)
            exit.reqItem = i < 3 ? 'iron_key' : 'gold_key';
            level.objects.push(exit);
            let hidingSpots = ['desk', 'bookshelf', 'chest', 'pot', 'crate', 'painting'];
            let imgAssets = ['assets/images/item_desk.png', 'assets/images/room_1.png', 'assets/images/item_chest.png', 'assets/images/room_1.png', 'assets/images/item_chest.png', 'assets/images/room_1.png'];
            let spotIdx = i % 6;
            
            level.objects.push({ 
                id: hidingSpots[spotIdx], x: 20 + (i*10)%50, y: 60 + (i*5)%20, w: 120, h: 120, 
                name: 'Dusty ' + hidingSpots[spotIdx].toUpperCase(), 
                desc: 'Maybe something is inside?', img: imgAssets[spotIdx], interactable: true, 
                action: 'search', giveItem: exit.reqItem, searchMsg: 'You found a key hidden here!' 
            });
            if(i > 3) level.objects.push({ id: 'distraction', x: 70, y: 60, w: 60, h: 60, name: 'Old Bones', desc: 'Nothing useful here.', emoji: '🦴', interactable: true, action: 'clue', clueMsg: 'Just a dead end.' });
        
        } else if (phase === 2) {
            // PHASE 2: The Toxic Lab (Numpad & Codes)
            exit.reqItem = 'code';
            exit.code = (1000 + i * 231).toString().substring(0,4); 
            level.objects.push(exit);
            level.objects.push({ id: 'computer', x: 20, y: 60, w: 80, h: 80, name: 'Mainframe Terminal', desc: `Screen is glitching. It reads: OVERRIDE_CODE_${exit.code}`, emoji: '🖥️', interactable: true, action: 'clue', clueMsg: `Terminal flashes: ${exit.code}` });
            level.objects.push({ id: 'safe', x: 70, y: 40, w: 80, h: 80, name: 'Bio-Safe', desc: 'Requires a code to dispense an item, but wait... you just need to escape.', emoji: '🗄️', interactable: true, action: 'puzzle', pType: 'numpad', code: '9999', giveItem: 'potion' });
            
        } else if (phase === 3) {
            // PHASE 3: The Frozen Archives (Item Chains)
            exit.reqItem = 'emerald_key';
            level.objects.push(exit);
            level.objects.push({ id: 'ice_block', x: 25, y: 65, w: 80, h: 80, name: 'Frozen Pillar', desc: 'The Emerald key is frozen solid! Need heat.', emoji: '🧊', interactable: true, action: 'search', reqItem: 'potion', giveItem: 'emerald_key', searchMsg: 'The acid melted the ice! Key acquired.', reqFailMsg: 'The ice is too hard. Need something to melt it.' });
            level.objects.push({ id: 'cabinet', x: 65, y: 50, w: 80, h: 90, name: 'Chemical Cabinet', desc: 'Locked with a 4-digit code.', emoji: '🗄️', interactable: true, action: 'puzzle', pType: 'numpad', code: (3000 + i).toString(), giveItem: 'potion' });
            level.objects.push({ id: 'note', x: 10, y: 80, w: 60, h: 60, name: 'Torn Note', desc: `Scrawled numbers: ${3000 + i}`, emoji: '📜', interactable: true, action: 'clue', clueMsg: `The note says ${3000 + i}` });

        } else if (phase === 4) {
            // PHASE 4: The Engine (Mechanical)
            exit.action = 'fix_escape';
            exit.reqItem = 'cogs';
            exit.emoji = '⚙️';
            level.objects.push(exit);
            level.objects.push({ id: 'toolbox', x: 75, y: 70, w: 80, h: 80, name: 'Mechanic Toolbox', desc: 'Needs prying open.', emoji: '🧰', interactable: true, action: 'search', reqItem: 'crowbar', giveItem: 'cogs', searchMsg: 'Pried it open. Got cogs!', reqFailMsg: 'Locked tight. Need a lever.' });
            level.objects.push({ id: 'pipe', x: 20, y: 30, w: 60, h: 100, name: 'Bent Pipe', desc: 'Something is lodged inside.', emoji: '🦯', interactable: true, action: 'search', giveItem: 'crowbar', searchMsg: 'Pulled out a rusty crowbar.' });
            
        } else {
            // PHASE 5: Master's Quarters (Combination)
            exit.reqItem = 'master_key';
            exit.emoji = '👑';
            level.objects.push(exit);
            level.objects.push({ id: 'master_safe', x: 50, y: 60, w: 90, h: 90, name: 'The Final Safe', desc: 'The ultimate lock.', emoji: '🗄️', interactable: true, action: 'puzzle', pType: 'numpad', code: '8888', giveItem: 'master_key' });
            level.objects.push({ id: 'wiring', x: 20, y: 40, w: 70, h: 70, name: 'Broken Fusebox', desc: 'Needs copper wire to power the safe.', emoji: '🔌', interactable: true, action: 'search', reqItem: 'wire', giveItem: 'none', searchMsg: 'Power restored! Code is 8888.', reqFailMsg: 'Missing a wire connection.' });
            level.objects.push({ id: 'junk', x: 80, y: 75, w: 70, h: 70, name: 'Pile of Junk', desc: 'A messy pile.', emoji: '🗑️', interactable: true, action: 'search', giveItem: 'wire', searchMsg: 'Found a piece of copper wire.' });
        }
        levels.push(level);
    }
    return levels;
}
Game.levels = generateLevels();

// Smooth Synthesis Audio Engine
const Synthesizer = {
    createOsc: function(freq, type, duration, vol = 1) {
        if (!window.AudioContext) window.AudioContext = window.webkitAudioContext;
        if (!Game.audioCtx) Game.audioCtx = new AudioContext();
        if (Game.audioCtx.state === 'suspended') Game.audioCtx.resume();
        const ctx = Game.audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    },
    playHover: () => Synthesizer.createOsc(400, 'sine', 0.1, 0.3),
    playClick: () => Synthesizer.createOsc(800, 'square', 0.1, 0.5),
    playUnlock: () => { Synthesizer.createOsc(600, 'sine', 0.2); setTimeout(()=>Synthesizer.createOsc(1200, 'sine', 0.4), 150); },
    playError: () => { Synthesizer.createOsc(150, 'sawtooth', 0.2); setTimeout(()=>Synthesizer.createOsc(100, 'sawtooth', 0.3), 100); },
    playEscape: () => { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => Synthesizer.createOsc(f, 'sine', 0.3, 0.6), i*150)); },
    playPhaseChange: () => { Synthesizer.createOsc(200, 'sine', 2, 0.5); Synthesizer.createOsc(300, 'triangle', 2, 0.3); }
};

function initGame() {
    loadProgress();
    attachEvents();
    buildLevelsGrid();
    
    setTimeout(() => {
        Game.ui.screens.loading.style.opacity = '0';
        setTimeout(() => {
            Game.ui.screens.loading.classList.remove('active');
            showScreen(Game.ui.screens.menu);
            document.getElementById('menu-icon-img').style.display = 'block';
        }, 500);
    }, 1000);

    setInterval(() => {
        if (Game.state.settings.music && Game.ui.screens.game.classList.contains('active')) {
            Synthesizer.createOsc(40 + Math.random()*20, 'sine', 4.0, 0.2); 
        }
    }, 6000);
}

function P(audioId) {
    if (!Game.state.settings.sfx) return;
    if(audioId === 'hover') Synthesizer.playHover();
    if(audioId === 'click') Synthesizer.playClick();
    if(audioId === 'unlock') Synthesizer.playUnlock();
    if(audioId === 'error') Synthesizer.playError();
}

function showScreen(screenItem) {
    Object.values(Game.ui.screens).forEach(s => s.classList.remove('active'));
    screenItem.classList.add('active');
}

let dialogTimeout;
function showDialog(text) {
    Game.ui.dialogText.textContent = text;
    const box = Game.ui.dialogBox;
    box.classList.remove('hidden');
    box.classList.remove('dialog-show');
    void box.offsetWidth; 
    box.classList.add('dialog-show');

    clearTimeout(dialogTimeout);
    dialogTimeout = setTimeout(() => {
        box.classList.remove('dialog-show');
        box.classList.add('hidden');
    }, 3500);
}

function saveProgress() {
    localStorage.setItem('EscapeRoomMaster_Save', JSON.stringify({
        unlockedLevels: Game.state.unlockedLevels,
        settings: Game.state.settings
    }));
}

function loadProgress() {
    try {
        const save = localStorage.getItem('EscapeRoomMaster_Save');
        if(save) {
            const data = JSON.parse(save);
            Game.state.unlockedLevels = data.unlockedLevels || 1;
            Game.state.settings = data.settings || { sfx: true, music: true };
        }
    } catch(e) {}
    document.getElementById('toggle-sfx').checked = Game.state.settings.sfx;
    document.getElementById('toggle-music').checked = Game.state.settings.music;
}

// Level Setup dynamically alters Visuals
function loadLevel(lvlNum) {
    Game.state.currentLevel = lvlNum;
    Game.state.inventory = [];
    Game.state.discoveredClues = [];
    Game.state.startTime = Date.now();
    Game.state.hintsUsed = 0;
    
    const lvlConfig = Game.levels[lvlNum - 1];
    if(!lvlConfig) return;

    Game.ui.game.roomText.textContent = lvlNum;
    
    // Apply Phase Theme & Visual Engine Upgrades
    document.body.className = `theme-phase-${lvlConfig.phase}`;
    Game.ui.game.bgImage.src = lvlConfig.bg;
    
    // Hue shift background slightly per level to make EVERY room unique!
    let hueShift = (lvlNum * 25) % 360;
    Game.ui.game.bgImage.style.filter = `hue-rotate(${hueShift}deg) brightness(1.1) contrast(1.1) saturate(1.1)`;

    // Phase Title Announcement
    const phaseAnnounce = document.createElement('div');
    phaseAnnounce.id = 'phase-title';
    phaseAnnounce.textContent = `PHASE ${lvlConfig.phase}`;
    Game.ui.game.objectsLayer.parentElement.appendChild(phaseAnnounce);
    
    setTimeout(() => {
        phaseAnnounce.classList.add('show-phase');
        if(Game.state.settings.sfx) Synthesizer.playPhaseChange();
        setTimeout(() => phaseAnnounce.remove(), 3500);
    }, 500);
    
    Game.ui.game.objectsLayer.innerHTML = '';
    Game.ui.game.inventoryContainer.innerHTML = '';
    
    // Render Hyper-Realistic Objects!
    lvlConfig.objects.forEach(obj => {
        const container = document.createElement('div');
        container.className = 'interactable-container'; 
        
        container.style.left = obj.x + '%';
        container.style.top = obj.y + '%';
        
        const visual = document.createElement('div');
        visual.className = 'interactable-obj';
        
        if (obj.img) {
            const img = document.createElement('img');
            img.src = obj.img + "?v=" + Date.now(); // Cache busting for dev
            img.alt = obj.name;
            visual.appendChild(img);
        } else if (obj.emoji) {
            visual.innerHTML = `<span style="font-size: 50px;">${obj.emoji}</span>`;
        }
        
        const nameTag = document.createElement('div');
        nameTag.className = 'room-item-name';
        nameTag.textContent = obj.name;
        
        container.appendChild(visual);
        container.appendChild(nameTag);
        
        container.addEventListener('pointerdown', (e) => {
            e.preventDefault(); 
            interactObject(obj, container);
            
            visual.style.transform = 'scale(0.9)';
            setTimeout(() => visual.style.transform = '', 150);
        });
        Game.ui.game.objectsLayer.appendChild(container);
    });

    showScreen(Game.ui.screens.game);
}

// Interaction Engine
function interactObject(obj, element) {
    P('click');
    
    if (obj.reqItem && !obj.action.includes('escape') && !obj.action.includes('puzzle')) {
        const hasItem = Game.state.inventory.find(i => i.id === obj.reqItem);
        if (!hasItem) {
            P('error');
            showDialog(obj.reqFailMsg || `Requires: ${Game.itemsDB[obj.reqItem].name}.`);
            return;
        }
    }

    if (obj.action === 'escape' || obj.action === 'fix_escape') {
        const hasReq = obj.reqItem === 'code' ? true : Game.state.inventory.find(i => i.id === obj.reqItem);
        if (hasReq || obj.reqItem === 'code') {
            openInspect(obj, element);
        } else {
            P('error');
            let itemN = Game.itemsDB[obj.reqItem]?.name || "a specific item";
            showDialog(`Locked! You need ${itemN}.`);
        }
    } else if (obj.action === 'search') {
        if (obj.giveItem && obj.giveItem !== 'none' && !Game.state.inventory.find(i => i.id === obj.giveItem)) {
            addToInventory(obj.giveItem);
            P('unlock');
            showDialog(obj.searchMsg || `Found: ${Game.itemsDB[obj.giveItem].name}!`);
            obj.interactable = false;
            element.style.opacity = '0.3';
            element.style.pointerEvents = 'none';
        } else {
            P('unlock');
            showDialog(obj.searchMsg || "Nothing left here.");
        }
    } else if (obj.action === 'clue') {
        showDialog(obj.clueMsg);
        if (!Game.state.discoveredClues.includes(obj.clueMsg)) {
            Game.state.discoveredClues.push(obj.clueMsg);
            P('unlock');
        }
    } else if (obj.action === 'puzzle') {
        openInspect(obj, element);
    } else {
        openInspect(obj, element);
    }
}

function openInspect(obj, element) {
    Game.ui.game.inspectTitle.textContent = obj.name;
    Game.ui.game.inspectDesc.textContent = obj.desc;
    
    // Switch between Image or Emoji for realistic zoom
    if (obj.img) {
        Game.ui.game.inspectEmoji.style.display = 'none';
        document.getElementById('inspect-image').style.display = 'block';
        document.getElementById('inspect-image').src = obj.img;
    } else {
        document.getElementById('inspect-image').style.display = 'none';
        Game.ui.game.inspectEmoji.style.display = 'block';
        let displayEmoji = obj.emoji || '🔮';
        if (obj.giveItem && Game.itemsDB[obj.giveItem]) displayEmoji = Game.itemsDB[obj.giveItem].icon;
        Game.ui.game.inspectEmoji.textContent = displayEmoji;
    }
    
    Game.ui.game.puzzleArea.innerHTML = '';
    Game.ui.game.puzzleArea.classList.add('hidden');

    if (obj.pType === 'numpad' || (obj.action === 'escape' && obj.reqItem === 'code')) {
        Game.ui.game.puzzleArea.classList.remove('hidden');
        Game.ui.game.puzzleArea.innerHTML = `
            <div class="puzzle-display" id="puzzle-screen">- - - -</div>
            <div class="numpad">
                ${[1,2,3,4,5,6,7,8,9,'C',0,'E'].map(n => `<button class="num-btn">${n}</button>`).join('')}
            </div>
        `;
        
        let entered = '';
        const pscreen = document.getElementById('puzzle-screen');
        const correctCode = obj.code || '1234';

        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                P('click');
                const val = e.target.textContent;
                if (val === 'C') entered = '';
                else if (val === 'E') {
                    if (entered === correctCode) {
                        P('unlock');
                        pscreen.textContent = "SOLVED";
                        pscreen.style.color = "#44ff44";
                        setTimeout(() => resolveInspectPuzzle(obj, element), 800);
                    } else {
                        P('error');
                        pscreen.textContent = "ERROR";
                        pscreen.style.color = "#ff4444";
                        entered = '';
                        setTimeout(() => { if(pscreen.textContent==="ERROR") { pscreen.textContent = "- - - -"; pscreen.style.color="var(--accent)"; } }, 800);
                    }
                } else {
                    if (entered.length < 4) entered += val;
                }
                if (val !== 'E' && entered !== '') pscreen.textContent = entered.padEnd(4, '-');
            });
        });
    } else if (obj.action === 'escape' && obj.reqItem !== 'code') {
        Game.ui.game.puzzleArea.classList.remove('hidden');
        Game.ui.game.puzzleArea.innerHTML = `<button class="btn primary" id="btn-use-item" style="width:100%;">USE ${Game.itemsDB[obj.reqItem].name.toUpperCase()}</button>`;
        document.getElementById('btn-use-item').addEventListener('pointerdown', () => {
            P('unlock');
            closeInspectSmoothly(() => winLevel());
        });
    } else if (obj.action === 'fix_escape') {
        Game.ui.game.puzzleArea.classList.remove('hidden');
        Game.ui.game.puzzleArea.innerHTML = `<button class="btn primary" id="btn-fix-door" style="width:100%;">INSERT COGS & PULL LEVER</button>`;
        document.getElementById('btn-fix-door').addEventListener('pointerdown', () => {
            P('unlock');
            closeInspectSmoothly(() => winLevel());
        });
    }

    Game.ui.game.inspectPanel.classList.remove('hidden');
    setTimeout(() => {
        Game.ui.game.inspectPanel.style.opacity = '1';
        Game.ui.game.inspectPanel.style.transform = 'scale(1)';
    }, 10);
}

function resolveInspectPuzzle(obj, element) {
    closeInspectSmoothly(() => {
        if (obj.action === 'escape') {
            winLevel();
        } else if (obj.giveItem && obj.giveItem !== 'none' && !Game.state.inventory.find(i => i.id === obj.giveItem)) {
            addToInventory(obj.giveItem);
            showDialog(`Unlocked! Found: ${Game.itemsDB[obj.giveItem].name}`);
            obj.interactable = false;
            if(element) {
                element.style.pointerEvents = 'none';
                element.style.opacity = '0.3';
            }
        } else {
            showDialog("Puzzle solved!");
        }
    });
}

function closeInspectSmoothly(callback) {
    Game.ui.game.inspectPanel.style.opacity = '0';
    Game.ui.game.inspectPanel.style.transform = 'scale(1.1)';
    setTimeout(() => {
        Game.ui.game.inspectPanel.classList.add('hidden');
        if(callback) callback();
    }, 300); 
}

function addToInventory(itemId) {
    const item = Game.itemsDB[itemId];
    if(!item) return;
    Game.state.inventory.push(item);
    renderInventory();
}

function renderInventory() {
    Game.ui.game.inventoryContainer.innerHTML = '';
    Game.state.inventory.forEach(item => {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        slot.innerHTML = `<span>${item.icon}</span>`;
        slot.title = item.name;
        
        slot.addEventListener('pointerdown', () => {
            P('click');
            document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('active'));
            slot.classList.add('active');
            showDialog(`${item.name} Selected: ${item.desc}`);
            
            slot.style.transform = 'scale(0.9)';
            setTimeout(() => {
                if(slot.classList.contains('active')) slot.style.transform = 'scale(1.05) translateY(-5px)';
                else slot.style.transform = '';
            }, 100);
        });
        Game.ui.game.inventoryContainer.appendChild(slot);
    });
}

function hintSystem() {
    P('click');
    Game.state.hintsUsed++;
    let hint = "Keep exploring. Tap on the glowing items in the room.";
    
    const door = Game.levels[Game.state.currentLevel-1].objects.find(o => o.action && o.action.includes('escape'));
    if (door && door.reqItem) {
        if (door.reqItem === 'code') {
            hint = Game.state.discoveredClues.length > 0 ? "You found a code clue. Enter it on the main door!" : "Look out for clues that give you a 4-digit code in the room.";
        } else {
            const hasItem = Game.state.inventory.find(i => i.id === door.reqItem);
            if (hasItem) hint = `You have the ${Game.itemsDB[door.reqItem].name}. Use it on the exit!`;
            else hint = `You need to find the ${Game.itemsDB[door.reqItem].name}. Try opening objects.`;
        }
    }
    showDialog(`💡 HINT: ${hint}`);
}

function winLevel() {
    Synthesizer.playEscape();
    const timeSpent = Math.floor((Date.now() - Game.state.startTime) / 1000);
    const min = Math.floor(timeSpent / 60).toString().padStart(2, '0');
    const sec = (timeSpent % 60).toString().padStart(2, '0');
    
    document.getElementById('victory-time').textContent = `${min}:${sec}`;
    document.getElementById('victory-hints').textContent = Game.state.hintsUsed;
    document.getElementById('victory-room-num').textContent = Game.state.currentLevel;
    
    if(Game.state.currentLevel >= Game.state.unlockedLevels && Game.state.currentLevel < 30) {
        Game.state.unlockedLevels = Game.state.currentLevel + 1;
        saveProgress();
    }
    showScreen(Game.ui.screens.victory);
}

function buildLevelsGrid() {
    const grid = document.getElementById('levels-grid');
    grid.innerHTML = '';
    for(let i = 1; i <= 30; i++) {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        if (i <= Game.state.unlockedLevels) {
            btn.classList.add('unlocked');
            btn.textContent = i;
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                P('click');
                loadLevel(i);
            });
        } else {
            btn.textContent = '🔒';
            btn.disabled = true;
        }
        grid.appendChild(btn);
    }
}

// Particle Engine
const canvas = Game.ui.game.fxCanvas;
const ctx = canvas.getContext('2d');
let particles = [];
let lastTime = 0;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function animate(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (Game.ui.screens.game.classList.contains('active')) {
        if(Math.random() < 0.1 && particles.length < 60) {
            particles.push({
                x: Math.random() * canvas.width,
                y: canvas.height + 10,
                s: Math.random() * 2 + 0.5,
                vx: (Math.random() - 0.5) * 0.05, 
                vy: -Math.random() * 0.05 - 0.02,
                alpha: Math.random() * 0.6
            });
        }
        
        // Use phase color for particles!
        const styles = getComputedStyle(document.body);
        let colorMatch = styles.getPropertyValue('--accent').trim();
        if(!colorMatch) colorMatch = '#d4af37';
        // Extract RGB roughly or just use context global alpha
        ctx.fillStyle = colorMatch; 

        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.s, 0, Math.PI*2);
            ctx.fill();
            if(p.y < -10) particles.splice(i, 1);
        }
        ctx.globalAlpha = 1.0;
    }
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

function attachEvents() {
    const bindBtn = (id, el, cb) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); P('click'); cb(); });

    bindBtn('play', Game.ui.buttons.play, () => showScreen(Game.ui.screens.tutorial));
    bindBtn('levels', Game.ui.buttons.levels, () => { buildLevelsGrid(); showScreen(Game.ui.screens.levels); });
    bindBtn('settings', Game.ui.buttons.settings, () => showScreen(Game.ui.screens.settings));
    
    bindBtn('back-levels', document.getElementById('btn-back-levels'), () => showScreen(Game.ui.screens.menu));
    bindBtn('back-settings', document.getElementById('btn-back-settings'), () => showScreen(Game.ui.screens.menu));
    
    bindBtn('start', Game.ui.buttons.start, () => loadLevel(Game.state.unlockedLevels));
    bindBtn('pause', document.getElementById('btn-pause'), () => { buildLevelsGrid(); showScreen(Game.ui.screens.levels); });
    
    bindBtn('hint', Game.ui.buttons.hint, hintSystem);
    
    bindBtn('close-inspect', document.getElementById('btn-close-inspect'), () => closeInspectSmoothly());
    
    bindBtn('nextRoom', Game.ui.buttons.nextRoom, () => {
        if(Game.state.currentLevel < 30) loadLevel(Game.state.currentLevel + 1);
        else {
            showDialog("CONGRATULATIONS! You escaped!");
            setTimeout(() => showScreen(Game.ui.screens.menu), 3500);
        }
    });

    document.getElementById('toggle-sfx').addEventListener('change', (e) => { Game.state.settings.sfx = e.target.checked; saveProgress(); P('click'); });
    document.getElementById('toggle-music').addEventListener('change', (e) => { Game.state.settings.music = e.target.checked; saveProgress(); P('click'); });

    document.querySelectorAll('.btn, .icon-btn, .level-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => { if(!btn.disabled) P('hover'); });
    });
}

window.onload = () => {
    document.body.addEventListener('pointerdown', () => {
        if (!Game.audioCtx) Game.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (Game.audioCtx.state === 'suspended') Game.audioCtx.resume();
    }, { once: true });
    
    initGame();
};
