class Particle {
    constructor(x, y, color, timeline) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
        this.color = color;
        this.timeline = timeline;
        this.size = Math.random() * 4 + 2;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }
}

class PhysicsEntity {
    constructor(x, y, w, h, isStatic = false) {
        this.x = x * TILE_SIZE;
        this.y = y * TILE_SIZE;
        this.w = w * TILE_SIZE;
        this.h = h * TILE_SIZE;
        this.vx = 0;
        this.vy = 0;
        this.isStatic = isStatic;
        this.grounded = false;
        this.squash = 1.0;
        this.stretch = 1.0;
        this.color = '#fff';
    }

    getRect() {
        return { x: this.x, y: this.y, w: this.w, h: this.h };
    }
}

class GameEngine {
    constructor() {
        this.entities = { past: [], future: [] };
        this.player = null;
        this.timeline = TimelineState.PAST;
        this.pastStateMap = new Map();
        this.futureStateMap = new Map();
        this.currentLevel = 0;
        this.timeShifts = 0;
        this.doorOpen = false;
        this.particles = [];
        this.screenShake = 0;
        this.levelCompleted = false;
    }

    loadLevel(index) {
        this.currentLevel = index;
        const levelData = Levels[index];
        if (!levelData) return false;

        this.entities.past = [];
        this.entities.future = [];
        this.pastStateMap.clear();
        this.futureStateMap.clear();
        this.particles = [];
        this.timeShifts = 0;
        this.doorOpen = false;
        this.levelCompleted = false;

        this.player = new PhysicsEntity(levelData.playerStart.x, levelData.playerStart.y, 0.8, 1.6, false);
        this.player.color = '#f39c12';

        const parseObjects = (objList, timeline) => {
            let parsed = [];
            objList.forEach(obj => {
                let e = new PhysicsEntity(obj.x, obj.y, obj.w || 1, obj.h || 1, obj.t === ObjectTypes.WALL || obj.t === ObjectTypes.RUINED_WALL || obj.t === ObjectTypes.TREE);
                e.type = obj.t;
                e.id = obj.id || Math.random().toString();
                e.locked = obj.locked || false;
                e.target = obj.target || null;
                
                if (e.type === ObjectTypes.SWITCH) e.isStatic = true;
                if (e.type === ObjectTypes.DOOR) e.isStatic = true;
                if (e.type === ObjectTypes.SEED) e.isStatic = false;

                parsed.push(e);

                if (timeline === TimelineState.PAST && !e.isStatic && e.type !== ObjectTypes.PLAYER) {
                    this.pastStateMap.set(e.id, { x: e.x, y: e.y });
                }
            });
            return parsed;
        };

        this.entities.past = parseObjects(levelData.past, TimelineState.PAST);
        this.entities.future = parseObjects(levelData.future, TimelineState.FUTURE);
        this.timeline = TimelineState.PAST;
        return true;
    }

    spawnParticles(x, y, count, color) {
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(x, y, color, this.timeline));
        }
    }

    switchTimeline() {
        this.timeShifts++;
        this.screenShake = 10;
        
        // Save current timeline state
        if (this.timeline === TimelineState.PAST) {
            this.entities.past.forEach(e => {
                if (e.id && !e.isStatic) this.pastStateMap.set(e.id, { x: e.x, y: e.y, vx: e.vx, vy: e.vy });
            });
            
            this.timeline = TimelineState.FUTURE;
            this.player.color = '#00d2ff';
            
            // Apply causality
            this.entities.future.forEach(e => {
                if (e.id && this.pastStateMap.has(e.id)) {
                    const pastState = this.pastStateMap.get(e.id);
                    if (!this.futureStateMap.has(e.id)) {
                        e.x = pastState.x; e.y = pastState.y; e.vx = pastState.vx; e.vy = pastState.vy;
                    } else {
                        const futState = this.futureStateMap.get(e.id);
                        e.x = futState.x; e.y = futState.y;
                    }
                }
            });

            // Seeds to Trees
            const pastSeeds = this.entities.past.filter(e => e.type === ObjectTypes.SEED);
            pastSeeds.forEach(seed => {
                this.entities.future = this.entities.future.filter(e => !(e.type === ObjectTypes.TREE && e.id === 'tree_'+seed.id));
                let tree = new PhysicsEntity(seed.x / TILE_SIZE, (seed.y / TILE_SIZE) - 2, 2, 3, true);
                tree.type = ObjectTypes.TREE;
                tree.id = 'tree_' + seed.id;
                this.entities.future.push(tree);
            });

        } else {
            this.entities.future.forEach(e => {
                if (e.id && !e.isStatic) this.futureStateMap.set(e.id, { x: e.x, y: e.y });
            });

            this.timeline = TimelineState.PAST;
            this.player.color = '#f39c12';
            
            this.entities.past.forEach(e => {
                if (e.id && this.pastStateMap.has(e.id)) {
                    const state = this.pastStateMap.get(e.id);
                    e.x = state.x; e.y = state.y; e.vx = state.vx; e.vy = state.vy;
                }
            });
        }
        
        AudioSys.playTimeSwitch(this.timeline === TimelineState.PAST);
        this.spawnParticles(this.player.x + this.player.w/2, this.player.y + this.player.h/2, 30, this.player.color);
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.w &&
               rect1.x + rect1.w > rect2.x &&
               rect1.y < rect2.y + rect2.h &&
               rect1.y + rect1.h > rect2.y;
    }

    resolveCollisions(entity, objects) {
        let wasGrounded = entity.grounded;
        entity.grounded = false;
        
        let rectX = { x: entity.x + entity.vx, y: entity.y, w: entity.w, h: entity.h };
        for (let obj of objects) {
            if (obj === entity) continue;
            let isSolid = obj.isStatic && obj.type !== ObjectTypes.SWITCH && obj.type !== ObjectTypes.DOOR;
            if (obj.type === ObjectTypes.MOVABLE) isSolid = true;

            if (isSolid && this.checkCollision(rectX, obj.getRect())) {
                if (entity.vx > 0) entity.vx = obj.x - entity.x - entity.w;
                else if (entity.vx < 0) entity.vx = obj.x + obj.w - entity.x;
                
                if (entity.type === ObjectTypes.PLAYER && obj.type === ObjectTypes.MOVABLE) {
                    obj.vx = (entity.vx > 0) ? 2 : (entity.vx < 0 ? -2 : 0);
                    if(Math.abs(obj.vx)>0) AudioSys.playHeavyMove();
                }
            }
        }
        entity.x += entity.vx;

        let rectY = { x: entity.x, y: entity.y + entity.vy, w: entity.w, h: entity.h };
        for (let obj of objects) {
            if (obj === entity) continue;
            let isSolid = obj.isStatic && obj.type !== ObjectTypes.SWITCH && obj.type !== ObjectTypes.DOOR;
            if (obj.type === ObjectTypes.MOVABLE) isSolid = true;

            if (isSolid && this.checkCollision(rectY, obj.getRect())) {
                if (entity.vy > 0) {
                    entity.vy = obj.y - entity.y - entity.h;
                    entity.grounded = true;
                    if (!wasGrounded) {
                        entity.squash = 1.3;
                        entity.stretch = 0.7;
                        if(entity.type === ObjectTypes.PLAYER) this.spawnParticles(entity.x + entity.w/2, entity.y + entity.h, 10, '#fff');
                    }
                } else if (entity.vy < 0) {
                    entity.vy = obj.y + obj.h - entity.y;
                }
            }
        }
        entity.y += entity.vy;
    }

    update() {
        if(this.screenShake > 0) this.screenShake *= 0.8;
        if(this.screenShake < 0.5) this.screenShake = 0;

        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.life > 0);

        let objects = this.timeline === TimelineState.PAST ? this.entities.past : this.entities.future;
        let allEntities = [this.player, ...objects.filter(o => !o.isStatic)];

        let switches = objects.filter(o => o.type === ObjectTypes.SWITCH);
        switches.forEach(sw => sw.pressed = false);

        allEntities.forEach(ent => {
            if (!ent.isStatic) {
                ent.vy += CONFIG.GRAVITY;
                if (ent.vy > CONFIG.MAX_FALL_SPEED) ent.vy = CONFIG.MAX_FALL_SPEED;
                
                ent.vx *= CONFIG.FRICTION;
                if (Math.abs(ent.vx) < 0.1) ent.vx = 0;
            }

            // Smoothing squash/stretch back to 1
            ent.squash += (1.0 - ent.squash) * 0.2;
            ent.stretch += (1.0 - ent.stretch) * 0.2;
            
            let prevY = ent.y;
            this.resolveCollisions(ent, objects);

            switches.forEach(sw => {
                if (this.checkCollision(ent.getRect(), sw.getRect())) sw.pressed = true;
            });
            
            // Spike collision
            let spikes = objects.filter(o => o.type === ObjectTypes.SPIKE);
            spikes.forEach(spike => {
                if(ent.type === ObjectTypes.PLAYER && this.checkCollision(ent.getRect(), spike.getRect())) {
                    // Death - restart level
                    this.loadLevel(this.currentLevel);
                    this.screenShake = 20;
                }
            });
        });

        // Door Logic
        let doors = objects.filter(o => o.type === ObjectTypes.DOOR);
        this.doorOpen = true; 
        doors.forEach(door => {
            if (door.locked) {
                let linkedSwitch = switches.find(s => s.target === door.id);
                this.doorOpen = (linkedSwitch && linkedSwitch.pressed);
            }
        });

        // Win Logic
        if(!this.levelCompleted) {
            doors.forEach(door => {
                if (this.doorOpen && this.checkCollision(this.player.getRect(), door.getRect())) {
                    this.triggerLevelComplete();
                }
            });
        }
    }

    triggerLevelComplete() {
        this.levelCompleted = true;
        document.getElementById('level-complete-screen').classList.remove('hidden');
        document.getElementById('stat-shifts').innerText = this.timeShifts;
        AudioSys.playPickup();
        this.spawnParticles(this.player.x + this.player.w/2, this.player.y + this.player.h/2, 50, '#f1c40f');
    }
}
