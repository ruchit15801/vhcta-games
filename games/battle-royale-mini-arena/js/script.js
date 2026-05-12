// Battle Royale Mini Arena - Realistic Tactical Overhaul

// --- CONSTANTS & CONFIG ---
const MAP_SIZE = 4000;
const FPS = 60;

const WEAPONS = {
    UNARMED: { name: 'HANDS', damage: 10, fireRate: 600, speed: 0, spread: 0, range: 40, ammo: Infinity, recoil: 0 },
    PISTOL: { name: 'G19', damage: 25, fireRate: 350, speed: 25, spread: 0.05, range: 1000, ammo: 45, recoil: 2, length: 15 },
    RIFLE: { name: 'M4A1 TACTICAL', damage: 35, fireRate: 100, speed: 35, spread: 0.1, range: 1800, ammo: 90, recoil: 4, length: 30 },
    SHOTGUN: { name: 'M870', damage: 15, fireRate: 800, speed: 20, spread: 0.25, range: 500, ammo: 30, pellets: 8, recoil: 8, length: 25 }
};

// --- DOM ELEMENTS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');
const uiElements = {
    hud: document.getElementById('hud'), hp: document.getElementById('hp-val'), hpFill: document.getElementById('health-fill'),
    ammo: document.getElementById('ammo-val'), ammoMax: document.getElementById('ammo-max'), weaponName: document.getElementById('weapon-name'),
    alive: document.getElementById('alive-val'), kills: document.getElementById('kill-val'), dmgOverlay: document.getElementById('damage-overlay'),
    zoneWarning: document.getElementById('zone-warning'), mainMenu: document.getElementById('main-menu'), setupMenu: document.getElementById('ui-layer'),
    endScreen: document.getElementById('end-screen'), endTitle: document.getElementById('end-title'), levelVal: document.getElementById('level-val'),
    mobileControls: document.getElementById('mobile-controls'), joystickLeft: document.getElementById('joystick-left'),
    joystickKnob: document.querySelector('.joystick-knob'), btnShoot: document.getElementById('btn-shoot'), btnPlay: document.getElementById('btn-play')
};

// --- GAME STATE ---
let gameState = { isRunning: false, lastTime: 0, startTime: 0, camX: 0, camY: 0, width: window.innerWidth, height: window.innerHeight, isMobile: false, shake: 0, level: 1 };
let camScale = 1;
let entities = { player: null, enemies: [], bullets: [], particles: [], loot: [], walls: [], blood: [] };
let zone = { x: MAP_SIZE/2, y: MAP_SIZE/2, radius: MAP_SIZE, targetRadius: MAP_SIZE * 0.8, shrinkTimer: 0, shrinkInterval: 15000, damage: 10, isShrinking: false };

// --- INPUT ---
const keys = {}; const mouse = { x: 0, y: 0, down: false }; const joystick = { active: false, x: 0, y: 0, dx: 0, dy: 0, id: null };
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', e => { if(e.target.tagName !== 'BUTTON') { mouse.down = true; audioSys.init(); } });
window.addEventListener('mouseup', () => mouse.down = false);
window.addEventListener('resize', () => {
    gameState.width = window.innerWidth; gameState.height = window.innerHeight;
    canvas.width = gameState.width; canvas.height = gameState.height;
    let minW = Math.min(gameState.width, gameState.height);
    if(minW < 800) camScale = minW / 800; else camScale = 1;
});
window.addEventListener('touchstart', e => {
    audioSys.init();
    gameState.isMobile = true; uiElements.mobileControls.classList.remove('hidden');
    for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth/2 && !joystick.active) {
            joystick.active = true; joystick.id = t.identifier; joystick.ox = t.clientX; joystick.oy = t.clientY;
            uiElements.joystickLeft.style.display = 'block'; uiElements.joystickLeft.style.left = (t.clientX-60)+'px'; uiElements.joystickLeft.style.top = (t.clientY-60)+'px';
        } else if (t.clientX >= window.innerWidth/2) mouse.down = true;
    }
});
window.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
        if (joystick.active && t.identifier === joystick.id) {
            let dx = t.clientX - joystick.ox, dy = t.clientY - joystick.oy;
            let dist = Math.hypot(dx, dy);
            if (dist > 50) { dx = (dx/dist)*50; dy = (dy/dist)*50; }
            joystick.dx = dx/50; joystick.dy = dy/50;
            uiElements.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
    }
});
window.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
        if (joystick.active && t.identifier === joystick.id) {
            joystick.active = false; joystick.dx = joystick.dy = 0;
            uiElements.joystickLeft.style.display = 'none'; uiElements.joystickKnob.style.transform = `translate(-50%, -50%)`;
        } else if (t.clientX >= window.innerWidth/2) mouse.down = false;
    }
});
uiElements.btnShoot.addEventListener('touchstart', e => { e.preventDefault(); mouse.down = true; });
uiElements.btnShoot.addEventListener('touchend', e => { e.preventDefault(); mouse.down = false; });

// --- UTILS & MATH ---
function AABBvsCircle(rect, cx, cy, cr) {
    let testX = cx, testY = cy;
    if (cx < rect.x) testX = rect.x; else if (cx > rect.x + rect.w) testX = rect.x + rect.w;
    if (cy < rect.y) testY = rect.y; else if (cy > rect.y + rect.h) testY = rect.y + rect.h;
    let dist = Math.hypot(cx - testX, cy - testY);
    if(dist <= cr) {
        let pushAngle = Math.atan2(cy - testY, cx - testX);
        let pushAmt = cr - dist;
        if(dist === 0) { pushAngle = Math.random()*Math.PI*2; pushAmt = 1; }
        return { hit: true, px: Math.cos(pushAngle)*pushAmt, py: Math.sin(pushAngle)*pushAmt };
    }
    return { hit: false };
}

function lineVsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    // Basic AABB raycast using Cohen-Sutherland or simple parametric
    let minX = rx, maxX = rx + rw;
    let minY = ry, maxY = ry + rh;
    let tmin = -Infinity, tmax = Infinity;
    let dx = x2 - x1, dy = y2 - y1;

    if (dx !== 0) {
        let t1 = (minX - x1) / dx;
        let t2 = (maxX - x1) / dx;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
    } else if (x1 < minX || x1 > maxX) return false;

    if (dy !== 0) {
        let t1 = (minY - y1) / dy;
        let t2 = (maxY - y1) / dy;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
    } else if (y1 < minY || y1 > maxY) return false;

    return tmax >= tmin && tmin <= 1 && tmax >= 0;
}

function checkLineOfSight(x1, y1, x2, y2) {
    for (let w of entities.walls) {
        if (lineVsRect(x1, y1, x2, y2, w.x, w.y, w.w, w.h)) return false;
    }
    return true;
}

// --- CLASSES ---
class Wall {
    constructor(x, y, w, h, type) { this.x = x; this.y = y; this.w = w; this.h = h; this.type = type; } // type: 'building', 'crate'
    draw(ctx, cx, cy) {
        ctx.fillStyle = this.type === 'crate' ? '#4a3f35' : '#22252a'; // Concrete vs Wood
        ctx.fillRect(this.x - cx, this.y - cy, this.w, this.h);
        
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
        ctx.strokeRect(this.x - cx, this.y - cy, this.w, this.h);
        
        // Pseudo 3D Top roof
        ctx.fillStyle = this.type === 'crate' ? '#5c4e42' : '#2a2e35';
        ctx.beginPath();
        let off = this.type === 'crate' ? 5 : 15;
        ctx.moveTo(this.x - cx, this.y - cy); ctx.lineTo(this.x - cx + off, this.y - cy - off);
        ctx.lineTo(this.x - cx + this.w + off, this.y - cy - off); ctx.lineTo(this.x - cx + this.w, this.y - cy);
        ctx.fill(); ctx.stroke();
    }
    drawShadow(ctx, cx, cy) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - cx + 15, this.y - cy + 15, this.w, this.h);
    }
}

class Blood {
    constructor(x, y, s) { this.x=x; this.y=y; this.s=s; this.a=0.8; this.r = Math.random()*Math.PI*2; }
    draw(ctx, cx, cy) {
        ctx.save(); ctx.translate(this.x - cx, this.y - cy); ctx.rotate(this.r);
        ctx.fillStyle = `rgba(138, 3, 3, ${this.a})`;
        ctx.beginPath(); ctx.ellipse(0, 0, this.s, this.s*0.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, speed, life, size) {
        this.x = x; this.y = y; this.color = color; this.life = life; this.maxLife = life; this.size = size;
        const angle = Math.random() * Math.PI * 2; const s = Math.random() * speed;
        this.vx = Math.cos(angle) * s; this.vy = Math.sin(angle) * s;
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; return this.life > 0; }
    draw(ctx, cx, cy) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - cx - this.size/2, this.y - cy - this.size/2, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

class Bullet {
    constructor(x, y, angle, weapon, ownerId) {
        this.x = x; this.y = y; this.color = weapon.damage > 20 ? '#ffea00' : '#ffcc00';
        this.vx = Math.cos(angle) * weapon.speed; this.vy = Math.sin(angle) * weapon.speed;
        this.damage = weapon.damage; this.range = weapon.range; this.dist = 0; this.ownerId = ownerId;
    }
    update(dt) {
        const stepX = this.vx * dt * 60; const stepY = this.vy * dt * 60;
        this.x += stepX; this.y += stepY; this.dist += Math.hypot(stepX, stepY);
        
        // Wall collision
        for (let w of entities.walls) {
            if(this.x > w.x && this.x < w.x+w.w && this.y > w.y && this.y < w.y+w.h) {
                // Spark on wall
                for(let i=0; i<3; i++) entities.particles.push(new Particle(this.x, this.y, '#ffd24d', 80, 0.1, 3));
                return false; 
            }
        }
        if(Math.random() > 0.8) entities.particles.push(new Particle(this.x, this.y, 'rgba(255,255,255,0.5)', 5, 0.1, 1)); // Trail
        return this.dist < this.range;
    }
    draw(ctx, cx, cy) {
        ctx.strokeStyle = this.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(this.x - cx, this.y - cy); ctx.lineTo(this.x - cx - this.vx * 1.5, this.y - cy - this.vy * 1.5); ctx.stroke();
    }
}

class Entity {
    constructor(id, x, y, isPlayer) {
        this.id = id; this.x = x; this.y = y; this.radius = 16; this.isPlayer = isPlayer;
        this.hp = 100; this.maxHp = 100; this.speed = isPlayer ? 4 : 3.2; this.angle = 0;
        this.weapon = isPlayer ? WEAPONS.PISTOL : WEAPONS.UNARMED; this.ammo = this.weapon.ammo;
        this.lastShot = 0; this.kills = 0;
        this.footstepTimer = 0;
        
        if (!isPlayer) {
            this.state = 'wander'; // wander, chase, hide
            this.targetX = x; this.targetY = y; this.reactionTime = Math.random();
            this.memory = { x: null, y: null, time: 0 };
        }
    }

    update(dt) {
        let dx = 0, dy = 0;
        if(this.isPlayer) {
            if(gameState.isMobile && joystick.active) { dx = joystick.dx; dy = joystick.dy; }
            else {
                if(keys['KeyW'] || keys['ArrowUp']) dy -= 1; if(keys['KeyS'] || keys['ArrowDown']) dy += 1;
                if(keys['KeyA'] || keys['ArrowLeft']) dx -= 1; if(keys['KeyD'] || keys['ArrowRight']) dx += 1;
            }
            if(dx !== 0 || dy !== 0) {
                const len = Math.hypot(dx, dy); dx=(dx/len)*this.speed*dt*60; dy=(dy/len)*this.speed*dt*60;
                this.x += dx; this.y += dy;
                this.footstepTimer += len;
                if(this.footstepTimer > 30) {
                    audioSys.playGunshot('FOOTSTEP'); // Cheap trick for footstep sound using empty click
                    this.footstepTimer = 0;
                }
            }

            if(gameState.isMobile && joystick.active) this.angle = Math.atan2(joystick.dy, joystick.dx);
            else if (!gameState.isMobile) {
                let sPx = (this.x - gameState.camX - gameState.width/2)*camScale + gameState.width/2;
                let sPy = (this.y - gameState.camY - gameState.height/2)*camScale + gameState.height/2;
                this.angle = Math.atan2(mouse.y - sPy, mouse.x - sPx);
            }

            if(mouse.down && performance.now() - this.lastShot > this.weapon.fireRate) this.shoot();

            // Loot
            for(let i=entities.loot.length-1; i>=0; i--) {
                const l = entities.loot[i];
                if(Math.hypot(this.x - l.x, this.y - l.y) < this.radius + l.radius) {
                    if(l.type === 'health' && this.hp < this.maxHp) { this.hp = Math.min(this.maxHp, this.hp+50); audioSys.playPickup('health'); entities.loot.splice(i, 1); updateHUD(); }
                    else if(l.type === 'ammo' && this.weapon !== WEAPONS.UNARMED) { this.ammo += this.weapon.ammo; audioSys.playPickup('ammo'); entities.loot.splice(i, 1); updateHUD(); }
                    else if(WEAPONS[l.type] && this.weapon.name !== WEAPONS[l.type].name) { 
                        // Drop current weapon
                        if(this.weapon !== WEAPONS.UNARMED) entities.loot.push({x: this.x, y: this.y, type: Object.keys(WEAPONS).find(k=>WEAPONS[k]===this.weapon), radius: 15});
                        this.weapon = WEAPONS[l.type]; this.ammo = this.weapon.ammo; audioSys.playPickup('weapon'); entities.loot.splice(i, 1); updateHUD(); 
                    }
                }
            }
        } else {
            this.handleTacticalAI(dt);
        }
        
        // Collisions
        this.x = Math.max(this.radius, Math.min(MAP_SIZE-this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(MAP_SIZE-this.radius, this.y));
        for(let w of entities.walls) {
            const res = AABBvsCircle(w, this.x, this.y, this.radius);
            if(res.hit) { this.x += res.px; this.y += res.py; }
        }

        // Zone damage
        if(Math.hypot(this.x - zone.x, this.y - zone.y) > zone.radius) {
            this.takeDamage(zone.damage * dt, null);
            if(this.isPlayer) uiElements.dmgOverlay.classList.add('active');
        } else if (this.isPlayer) {
            uiElements.dmgOverlay.classList.remove('active');
        }
    }

    handleTacticalAI(dt) {
        this.reactionTime -= dt;
        const p = entities.player;
        let hasLoS = false;
        let distToPlayer = Infinity;

        if (p && p.hp > 0) {
            distToPlayer = Math.hypot(this.x - p.x, this.y - p.y);
            // Can see player? 1200 range vision, plus line of sight
            if (distToPlayer < 1200 && checkLineOfSight(this.x, this.y, p.x, p.y)) {
                hasLoS = true;
                this.memory.x = p.x; this.memory.y = p.y; this.memory.time = performance.now();
            }
        }

        if (hasLoS) {
            this.state = 'chase';
            // Aim at player
            let targetAngle = Math.atan2(p.y - this.y, p.x - this.x);
            // Lerp angle for realism
            let diff = targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2; while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle += diff * 10 * dt;

            // Combat logic
            if (distToPlayer < this.weapon.range && this.reactionTime <= 0) {
                if(performance.now() - this.lastShot > this.weapon.fireRate * 1.5) this.shoot();
            }

            // Tactical movement (Strafe or close gap)
            if (distToPlayer > 300) {
                this.x += Math.cos(this.angle) * this.speed * dt * 60;
                this.y += Math.sin(this.angle) * this.speed * dt * 60;
            } else if (distToPlayer < 200) { // Back up
                this.x -= Math.cos(this.angle) * this.speed * dt * 60;
                this.y -= Math.sin(this.angle) * this.speed * dt * 60;
            }
        } else {
            // Investigate memory if recent (within 5 seconds)
            if (this.memory.time > 0 && performance.now() - this.memory.time < 5000 && Math.hypot(this.x - this.memory.x, this.y - this.memory.y) > 50) {
                this.state = 'investigate';
                this.targetX = this.memory.x; this.targetY = this.memory.y;
            } else {
                this.state = 'wander';
                if(this.reactionTime <= 0) {
                    this.reactionTime = 2 + Math.random() * 4;
                    this.targetX = this.x + (Math.random()-0.5)*800;
                    this.targetY = this.y + (Math.random()-0.5)*800;
                    // Steer towards zone
                    if(Math.hypot(this.x - zone.x, this.y - zone.y) > zone.radius - 200) {
                        this.targetX = zone.x; this.targetY = zone.y;
                    }
                }
            }
            
            // Move to target
            this.angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
            if(Math.hypot(this.x - this.targetX, this.y - this.targetY) > 20) {
                this.x += Math.cos(this.angle) * (this.speed*0.6) * dt * 60;
                this.y += Math.sin(this.angle) * (this.speed*0.6) * dt * 60;
            }
        }
    }

    shoot() {
        if(this.ammo <= 0 && this.weapon !== WEAPONS.UNARMED) {
            audioSys.playGunshot('EMPTY'); this.lastShot = performance.now(); return;
        }

        const type = Object.keys(WEAPONS).find(k => WEAPONS[k] === this.weapon);
        audioSys.playGunshot(type);

        // Screen Shake for player
        if (this.isPlayer) gameState.shake = this.weapon.recoil * 3;

        const count = this.weapon.pellets || 1;
        for(let i=0; i<count; i++) {
            const spread = (Math.random() - 0.5) * this.weapon.spread;
            // Spawn bullet from barrel tip
            let bx = this.x + Math.cos(this.angle) * this.weapon.length;
            let by = this.y + Math.sin(this.angle) * this.weapon.length;
            entities.bullets.push(new Bullet(bx, by, this.angle + spread, this.weapon, this.id));
        }

        // Muzzle flash
        entities.particles.push(new Particle(this.x + Math.cos(this.angle)*(this.weapon.length+5), 
                                             this.y + Math.sin(this.angle)*(this.weapon.length+5), '#ffcc00', 0, 0.1, 15));

        // Player Recoil kickback
        if (this.isPlayer) {
            this.x -= Math.cos(this.angle) * this.weapon.recoil;
            this.y -= Math.sin(this.angle) * this.weapon.recoil;
        }

        this.ammo--; this.lastShot = performance.now();
        if(this.isPlayer) updateHUD();
    }

    takeDamage(amt, attackerId) {
        this.hp -= amt;
        // Blood squirt
        for(let i=0; i<6; i++) {
            entities.particles.push(new Particle(this.x, this.y, '#aa0000', 150, 0.3, 4));
        }
        // Persistent blood
        if (Math.random() > 0.5) entities.blood.push(new Blood(this.x, this.y, 10 + Math.random()*15));

        audioSys.playHit(this.isPlayer);
        if(this.isPlayer) {
            gameState.shake += 5;
            updateHUD();
        } else {
            // Memory update - attacker is shooting me
            if (attackerId === 'player' && entities.player) {
                this.memory.x = entities.player.x; this.memory.y = entities.player.y; this.memory.time = performance.now();
            }
        }

        if(this.hp <= 0) this.die(attackerId);
    }

    die(attackerId) {
        // Splatter pool
        entities.blood.push(new Blood(this.x, this.y, 40));
        
        if(this.isPlayer) endGame(false);
        else {
            if(Math.random() > 0.2) {
                const types = ['health', 'ammo', 'RIFLE', 'SHOTGUN'];
                entities.loot.push({x: this.x, y: this.y, type: types[Math.floor(Math.random()*types.length)], radius: 15});
            }
            entities.enemies = entities.enemies.filter(e => e.id !== this.id);
            updateHUDAlive();
            if (attackerId === 'player' && entities.player) { entities.player.kills++; updateHUD(); }
            if(entities.enemies.length === 0) endGame(true);
        }
    }

    draw(ctx, cx, cy) {
        const drawX = this.x - cx; const drawY = this.y - cy;
        
        ctx.save();
        ctx.translate(drawX, drawY);
        
        // Shadow cast
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(-5, 5, 20, 15, this.angle, 0, Math.PI*2); ctx.fill();

        ctx.rotate(this.angle);

        // PROCEDURAL REALISTIC TOP-DOWN HUMAN
        // Colors
        let camo = this.isPlayer ? ['#3c4a38', '#2a3626', '#485743'] : ['#222', '#111', '#333'];
        let skinTone = '#ffcd94';
        
        // Legs (Walking animation based on footstep timer)
        let legSwing = Math.sin(this.footstepTimer / 5) * 10;
        ctx.fillStyle = camo[1];
        ctx.fillRect(-10, -12, 25, 8); // left leg
        ctx.fillRect(-10 + (this.x === this.lastX ? 0 : legSwing), -12, 10, 8);
        ctx.fillRect(-10, 4, 25, 8); // right leg
        ctx.fillRect(-10 - (this.x === this.lastX ? 0 : legSwing), 4, 10, 8);
        this.lastX = this.x; // naive for animation

        // Body / Torso / Vest
        ctx.fillStyle = camo[0];
        ctx.beginPath();
        ctx.roundRect(-15, -14, 28, 28, 10);
        ctx.fill();
        ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
        
        // Tactical Vest Details
        ctx.fillStyle = camo[2];
        ctx.fillRect(-8, -10, 15, 20); // main plate Carrier
        ctx.fillStyle = '#111';
        ctx.fillRect(8, -8, 6, 16); // pouches

        // Weapon Rendering (Complex Shapes)
        if(this.weapon !== WEAPONS.UNARMED) {
            ctx.fillStyle = '#1a1a1a'; // Gun metal
            if(this.weapon === WEAPONS.PISTOL) {
                ctx.fillRect(15, -3, 15, 6);
            } else if (this.weapon === WEAPONS.RIFLE) {
                ctx.fillRect(10, -4, 30, 8); // Receiver/Handguard
                ctx.fillRect(40, -2, 10, 4); // Barrel
                ctx.fillStyle = '#444'; ctx.fillRect(25, -5, 5, 10); // Sight
            } else if (this.weapon === WEAPONS.SHOTGUN) {
                ctx.lineWidth = 6; ctx.strokeStyle = '#222';
                ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(35, 0); ctx.stroke(); // Barrel
                ctx.strokeStyle = '#5c4e42'; // Wooden pump
                ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(25, 0); ctx.stroke();
            }
            
            // Hands on weapon
            ctx.fillStyle = skinTone;
            ctx.beginPath(); ctx.arc(12, -5, 4, 0, Math.PI*2); ctx.fill(); // Left hand
            ctx.beginPath(); ctx.arc(20, -5, 4, 0, Math.PI*2); ctx.fill(); // Right hand gripping further
            if(this.weapon === WEAPONS.RIFLE || this.weapon === WEAPONS.SHOTGUN) {
                ctx.fillStyle = camo[1]; // Sleeves reaching
                ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(12, -5); ctx.lineTo(10, 0); ctx.fill();
                ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(20, -5); ctx.lineTo(10, 0); ctx.fill();
            }
        } else {
            // Fists
            ctx.fillStyle = skinTone;
            ctx.beginPath(); ctx.arc(10, -10, 5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(10, 10, 5, 0, Math.PI*2); ctx.fill();
        }

        // Head (Helmet/Bandana)
        ctx.fillStyle = skinTone;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
        if(this.isPlayer) {
            ctx.fillStyle = '#3c4a38'; // Military Helmet
            ctx.beginPath(); ctx.arc(0, 0, 11, -Math.PI/2, Math.PI/2); ctx.fill();
            ctx.fillStyle = '#111'; ctx.fillRect(0, -6, 5, 12); // Goggles
        } else {
            ctx.fillStyle = '#8a0303'; // Red Bandana
            ctx.fillRect(-10, -5, 20, 10);
            ctx.fillStyle = '#111'; // Hair/Hat
            ctx.beginPath(); ctx.arc(-2, 0, 9, Math.PI/2, Math.PI*1.5); ctx.fill();
        }

        ctx.restore();

        // HP bar for enemies
        if(!this.isPlayer && this.hp < this.maxHp) {
            ctx.fillStyle = 'red'; ctx.fillRect(drawX - 20, drawY - 30, 40, 4);
            ctx.fillStyle = '#0f0'; ctx.fillRect(drawX - 20, drawY - 30, 40 * (this.hp/this.maxHp), 4);
        }
    }
}

// --- CORE FUNCTIONS ---
function generateMap() {
    entities.walls = [];
    // Borders
    entities.walls.push(new Wall(-100, -100, MAP_SIZE+200, 100, 'building')); // top
    entities.walls.push(new Wall(-100, MAP_SIZE, MAP_SIZE+200, 100, 'building')); // bot
    entities.walls.push(new Wall(-100, 0, 100, MAP_SIZE, 'building')); // left
    entities.walls.push(new Wall(MAP_SIZE, 0, 100, MAP_SIZE, 'building')); // right

    // Random buildings and crates
    for(let i=0; i<40; i++) {
        let w = 200 + Math.random()*300; let h = 200 + Math.random()*300;
        entities.walls.push(new Wall(Math.random()*MAP_SIZE, Math.random()*MAP_SIZE, w, h, 'building'));
    }
    for(let i=0; i<80; i++) {
        entities.walls.push(new Wall(Math.random()*MAP_SIZE, Math.random()*MAP_SIZE, 50, 50, 'crate'));
    }
}

function updateHUD() {
    if(!entities.player) return;
    uiElements.hpFill.style.width = Math.max(0, entities.player.hp / entities.player.maxHp * 100) + '%';
    uiElements.hp.innerText = `${Math.floor(entities.player.hp)} / 100`;
    uiElements.weaponName.innerText = entities.player.weapon.name;
    uiElements.ammo.innerText = entities.player.ammo === Infinity ? '∞' : entities.player.ammo;
    uiElements.kills.innerText = entities.player.kills;
}

function updateHUDAlive() {
    const total = entities.enemies.length + (entities.player && entities.player.hp > 0 ? 1 : 0);
    uiElements.alive.innerText = total;
}

function initGame() {
    generateMap();
    if(uiElements.levelVal) uiElements.levelVal.innerText = gameState.level;
    // Safely spawn player
    let px = MAP_SIZE/2, py = MAP_SIZE/2;
    entities.player = new Entity('player', px, py, true);
    entities.enemies = []; entities.bullets = []; entities.particles = []; entities.loot = []; entities.blood = [];
    
    let botCount = 5 + (gameState.level * 5); // Level scaling
    
    // Spawn enemies safely away from player
    for(let i=0; i<botCount; i++) {
        let ex, ey;
        do { ex = Math.random() * MAP_SIZE; ey = Math.random() * MAP_SIZE; } 
        while (Math.hypot(ex - px, ey - py) < 800);
        
        let e = new Entity('enemy_' + i, ex, ey, false);
        e.maxHp = 100 + (gameState.level * 10);
        e.hp = e.maxHp;
        e.speed = 3.2 + (gameState.level * 0.1); 
        let r = Math.random();
        if(r > 0.6 - (gameState.level * 0.05)) e.weapon = WEAPONS.PISTOL;
        if(r > 0.8 - (gameState.level * 0.05)) e.weapon = WEAPONS.RIFLE;
        if(r > 0.95 - (gameState.level * 0.05)) e.weapon = WEAPONS.SHOTGUN;
        entities.enemies.push(e);
    }
    
    for(let i=0; i<40; i++) {
        entities.loot.push({x: Math.random()*MAP_SIZE, y: Math.random()*MAP_SIZE, type: ['health','ammo','RIFLE','SHOTGUN'][Math.floor(Math.random()*4)], radius: 15});
    }

    zone.radius = MAP_SIZE * 0.9; zone.targetRadius = zone.radius * 0.6;
    zone.shrinkTimer = performance.now(); zone.isShrinking = false;

    updateHUD(); updateHUDAlive();
    gameState.startTime = performance.now(); gameState.isRunning = true; gameState.lastTime = performance.now();

    uiElements.mainMenu.classList.add('hidden'); uiElements.endScreen.classList.add('hidden'); uiElements.endScreen.classList.remove('active');
    uiElements.setupMenu.style.pointerEvents = 'none'; uiElements.hud.classList.remove('hidden');

    audioSys.init(); audioSys.startBGM();
    requestAnimationFrame(gameLoop);
}

function endGame(win) {
    gameState.isRunning = false; audioSys.stopBGM();
    uiElements.dmgOverlay.classList.remove('active'); uiElements.endScreen.classList.remove('hidden');
    
    if (win) gameState.level++;
    else gameState.level = 1;
    
    setTimeout(() => {
        uiElements.endScreen.classList.add('active'); uiElements.setupMenu.style.pointerEvents = 'auto';
        uiElements.endTitle.innerText = win ? 'SECTOR CLEARED' : 'KIA';
        uiElements.endTitle.style.color = win ? '#00ffaa' : '#ff3333';
        const btnRestart = document.getElementById('btn-restart');
        if(btnRestart) btnRestart.innerText = win ? 'ENTER NEXT SECTOR' : 'PLAY AGAIN';
        
        const t = Math.floor((performance.now() - gameState.startTime) / 1000);
        document.getElementById('end-rank').innerText = `#${entities.enemies.length + 1}`;
        document.getElementById('end-kills').innerText = entities.player ? entities.player.kills : 0;
        document.getElementById('end-time').innerText = `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
    }, 1000);
}

function drawGame() {
    // Dirt BG
    ctx.fillStyle = '#26292b'; ctx.fillRect(0, 0, gameState.width, gameState.height);

    ctx.save();
    ctx.translate(gameState.width/2, gameState.height/2);
    ctx.scale(camScale, camScale);
    ctx.translate(-gameState.width/2, -gameState.height/2);

    // Screen Shake
    if (gameState.shake > 0) {
        ctx.translate((Math.random()-0.5)*gameState.shake, (Math.random()-0.5)*gameState.shake);
        gameState.shake *= 0.8;
        if(gameState.shake < 0.5) gameState.shake = 0;
    }

    // Grid lines for scale
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 2;
    for(let x = Math.floor(-gameState.camX/100)*100; x < gameState.width-gameState.camX; x+=100) { ctx.beginPath(); ctx.moveTo(x+gameState.camX, 0); ctx.lineTo(x+gameState.camX, gameState.height); ctx.stroke(); }
    for(let y = Math.floor(-gameState.camY/100)*100; y < gameState.height-gameState.camY; y+=100) { ctx.beginPath(); ctx.moveTo(0, y+gameState.camY); ctx.lineTo(gameState.width, y+gameState.camY); ctx.stroke(); }

    // Map bounds
    ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 10; ctx.strokeRect(-gameState.camX, -gameState.camY, MAP_SIZE, MAP_SIZE);

    // Zone Blue
    ctx.fillStyle = 'rgba(0, 50, 255, 0.2)';
    ctx.beginPath(); ctx.arc(zone.x - gameState.camX, zone.y - gameState.camY, zone.radius, 0, Math.PI*2); ctx.rect(0, 0, gameState.width, gameState.height); ctx.fill('evenodd');
    ctx.strokeStyle = '#0088ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(zone.x - gameState.camX, zone.y - gameState.camY, zone.radius, 0, Math.PI*2); ctx.stroke();
    // Zone safe indicator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.setLineDash([15, 15]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(zone.x - gameState.camX, zone.y - gameState.camY, zone.targetRadius, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);

    // Draw Blood
    for (let b of entities.blood) b.draw(ctx, gameState.camX, gameState.camY);

    // Draw Shadows for Walls first
    for (let w of entities.walls) {
        if(w.x-gameState.camX < gameState.width && w.x+w.w-gameState.camX > 0 && w.y-gameState.camY < gameState.height && w.y+w.h-gameState.camY > 0)
            w.drawShadow(ctx, gameState.camX, gameState.camY);
    }

    // Loot
    entities.loot.forEach(l => {
        let drawX = l.x - gameState.camX, drawY = l.y - gameState.camY;
        ctx.beginPath(); ctx.arc(drawX, drawY, l.radius, 0, Math.PI*2);
        if(l.type === 'health') { ctx.fillStyle = '#00ffaa'; ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(drawX-2, drawY-8, 4, 16); ctx.fillRect(drawX-8, drawY-2, 16, 4); }
        else if(l.type === 'ammo') { ctx.fillStyle = '#a0aab5'; ctx.fill(); ctx.fillStyle='#fff'; ctx.font='10px Roboto'; ctx.fillText('AMMO', drawX-14, drawY+4); }
        else { ctx.fillStyle = WEAPONS[l.type].damage > 20 ? '#ffcc00' : '#ff3333'; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle='#000'; ctx.font='12px Teko'; ctx.fillText('WPN', drawX-12, drawY+4); }
    });

    // Entities
    if(entities.player && entities.player.hp > 0) entities.player.draw(ctx, gameState.camX, gameState.camY);
    entities.enemies.forEach(e => e.draw(ctx, gameState.camX, gameState.camY));
    entities.bullets.forEach(b => b.draw(ctx, gameState.camX, gameState.camY));
    entities.particles.forEach(p => p.draw(ctx, gameState.camX, gameState.camY));

    // Draw Walls Above everything
    for (let w of entities.walls) {
        if(w.x-gameState.camX < gameState.width && w.x+w.w-gameState.camX > 0 && w.y-gameState.camY < gameState.height && w.y+w.h-gameState.camY > 0)
            w.draw(ctx, gameState.camX, gameState.camY);
    }

    ctx.restore();

    // Minicmap
    minimapCtx.clearRect(0,0,150,150);
    const scale = 150/MAP_SIZE;
    minimapCtx.fillStyle = 'rgba(255,255,255,0.2)'; minimapCtx.beginPath(); minimapCtx.arc(zone.x*scale, zone.y*scale, zone.targetRadius*scale, 0, Math.PI*2); minimapCtx.fill();
    minimapCtx.fillStyle = 'rgba(0,0,255,0.4)'; minimapCtx.beginPath(); minimapCtx.arc(zone.x*scale, zone.y*scale, zone.radius*scale, 0, Math.PI*2); minimapCtx.fill();
    
    // Draw walls on minimap
    minimapCtx.fillStyle = '#444';
    entities.walls.forEach(w => minimapCtx.fillRect(w.x*scale, w.y*scale, w.w*scale, w.h*scale));

    if(entities.player) { minimapCtx.fillStyle = '#00ffaa'; minimapCtx.beginPath(); minimapCtx.arc(entities.player.x*scale, entities.player.y*scale, 3, 0, Math.PI*2); minimapCtx.fill(); }
    minimapCtx.fillStyle = '#ff3333'; entities.enemies.forEach(e => { minimapCtx.beginPath(); minimapCtx.arc(e.x*scale, e.y*scale, 2, 0, Math.PI*2); minimapCtx.fill(); });
}

function updateLogic(dt) {
    if(!entities.player) return;
    if(!zone.isShrinking) {
        if(performance.now() - zone.shrinkTimer > zone.shrinkInterval) {
            zone.isShrinking = true; uiElements.zoneWarning.classList.add('active'); audioSys.playZoneWarning();
        }
    } else {
        zone.radius -= 25 * dt; // Faster shrink
        if(zone.radius <= zone.targetRadius) {
            zone.isShrinking = false; zone.targetRadius = Math.max(10, zone.targetRadius * 0.6); zone.shrinkTimer = performance.now();
            uiElements.zoneWarning.classList.remove('active');
            zone.x += (Math.random()-0.5)*zone.radius*0.5; zone.y += (Math.random()-0.5)*zone.radius*0.5;
        }
    }

    entities.player.update(dt);
    entities.enemies.forEach(e => e.update(dt));

    for(let i=entities.bullets.length-1; i>=0; i--) {
        const b = entities.bullets[i];
        if(!b.update(dt)) { entities.bullets.splice(i, 1); continue; }
        
        let hit = false;
        if(b.ownerId === 'player') {
            for(let e of entities.enemies) {
                if(Math.hypot(b.x - e.x, b.y - e.y) < e.radius) { e.takeDamage(b.damage, b.ownerId); hit = true; break; }
            }
        } else {
            if(Math.hypot(b.x - entities.player.x, b.y - entities.player.y) < entities.player.radius) { entities.player.takeDamage(b.damage, b.ownerId); hit = true; }
        }
        if(hit) entities.bullets.splice(i, 1);
    }
    for(let i=entities.particles.length-1; i>=0; i--) if(!entities.particles[i].update(dt)) entities.particles.splice(i, 1);

    let targetCamX = entities.player.x - gameState.width / 2;
    let targetCamY = entities.player.y - gameState.height / 2;
    gameState.camX += (targetCamX - gameState.camX) * 10 * dt;
    gameState.camY += (targetCamY - gameState.camY) * 10 * dt;
}

function gameLoop(now) {
    if(!gameState.isRunning) return;
    requestAnimationFrame(gameLoop);
    let dt = (now - gameState.lastTime)/1000;
    if(dt > 0.1) dt = 0.1; gameState.lastTime = now;
    updateLogic(dt); drawGame();
}

uiElements.btnPlay.onclick = initGame;
if(document.getElementById('btn-restart')) document.getElementById('btn-restart').onclick = initGame;
