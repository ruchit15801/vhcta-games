/**
 * Bike Stunt Master - Game Logic & Rendering
 */

// Simple visual particles for dust/smoke
class VisualParticle {
    constructor(x, y, type) {
        this.pos = new Vec2(x, y);
        this.vel = new Vec2((Math.random() - 0.5) * 100, -Math.random() * 100 - 50);
        this.life = 1.0;
        this.type = type; // 'dust', 'smoke', 'spark'
        this.size = Math.random() * 5 + 2;
    }
    update(dt) {
        this.pos = this.pos.add(this.vel.mul(dt));
        this.life -= dt * 2;
        if (this.type === 'smoke') {
            this.size += dt * 10;
        }
    }
    render(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.globalAlpha = this.life;
        if (this.type === 'dust') {
            ctx.fillStyle = '#8B5A2B';
        } else if (this.type === 'smoke') {
            ctx.fillStyle = '#AAAAAA';
        } else if (this.type === 'spark') {
            ctx.fillStyle = '#FFD700';
            ctx.scale(1, 0.2);
        }
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Bike {
    constructor(world, startX, startY) {
        this.world = world;
        this.poseOffsets = {
            head: new Vec2(22, -26),
            seat: new Vec2(-12, -22),
            motor: new Vec2(4, -8),
            backWheel: new Vec2(-34, 18),
            frontWheel: new Vec2(36, 18),
            riderHead: new Vec2(-2, -54)
        };
        
        // Visual-only frame nodes. Physics is driven by wheels for stability.
        this.head = { pos: new Vec2(startX + this.poseOffsets.head.x, startY + this.poseOffsets.head.y), applyForce: () => {} };
        this.seat = { pos: new Vec2(startX + this.poseOffsets.seat.x, startY + this.poseOffsets.seat.y), applyForce: () => {} };
        this.motor = { pos: new Vec2(startX + this.poseOffsets.motor.x, startY + this.poseOffsets.motor.y), applyForce: () => {} };
        
        // Wheels
        let wheelRadius = 16;
        this.backWheel = world.addParticle(new Particle(startX + this.poseOffsets.backWheel.x, startY + this.poseOffsets.backWheel.y, wheelRadius, 8));
        this.backWheel.isWheel = true;
        
        this.frontWheel = world.addParticle(new Particle(startX + this.poseOffsets.frontWheel.x, startY + this.poseOffsets.frontWheel.y, wheelRadius, 7));
        this.frontWheel.isWheel = true;
        
        // Keep only wheelbase physics constraint to avoid frame tearing.
        this.c_wheelbase = world.addConstraint(new Constraint(this.backWheel, this.frontWheel, 1, "distance"));

        // Rider is visual only; keeping it out of physics avoids chassis tearing.
        this.riderHead = { pos: new Vec2(startX + this.poseOffsets.riderHead.x, startY + this.poseOffsets.riderHead.y) };

        this.dir = 1; // Facing right
        
        // Base64 SVGs for Premium Render fallback
        // Highly detailed SVG strings
        this.svgFrame = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 60'><path d='M20,30 L40,10 L70,15 L80,35 L60,45 Z' fill='%23222'/><path d='M40,10 L60,15 L60,30 L30,40 Z' fill='%23f94144'/><circle cx='50' cy='35' r='10' fill='%23444'/></svg>";
        // High-Quality SVG Sprite for Bike + Rider
        this.svgFrame = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80'>
            <defs>
                <linearGradient id='bodyGrad' x1='0%' y1='0%' x2='100%' y2='0%'>
                    <stop offset='0%' style='stop-color:%23f94144;stop-opacity:1' />
                    <stop offset='100%' style='stop-color:%23f3722c;stop-opacity:1' />
                </linearGradient>
            </defs>
            <!-- Engine & Frame -->
            <rect x='40' y='40' width='30' height='20' fill='%23333' rx='5'/>
            <path d='M30 45 L90 45' stroke='%23222' stroke-width='6'/>
            <!-- Body Work -->
            <path d='M20 35 L40 30 L80 35 L90 50 L70 55 L30 55 Z' fill='url(%23bodyGrad)'/>
            <path d='M35 30 L60 25 L85 30 L80 35 L40 35 Z' fill='%23111'/> <!-- Seat -->
            <!-- Exhaust -->
            <path d='M45 50 L20 45 L15 40' stroke='%23666' stroke-width='4' fill='none'/>
            <!-- Rider -->
            <circle cx='60' cy='15' r='8' fill='%23f3722c' stroke='%23000' stroke-width='2'/> <!-- Helmet -->
            <path d='M60 23 L55 45 M60 23 L85 45' stroke='%23222' stroke-width='5' stroke-linecap='round'/> <!-- Body & Legs -->
            <path d='M60 28 L85 35' stroke='%23222' stroke-width='4' stroke-linecap='round'/> <!-- Arms -->
        </svg>`;
        
        this.imgFrame = new Image();
        this.imgFrame.src = this.svgFrame;

        // Stats tracking
        this.isAirborne = false;
        this.airTime = 0;
        this.startAngle = 0;
        this.currentRot = 0;
        this.totalRot = 0;
        this.flips = 0;
        this.wheelieTime = 0;
        this.exhaustParticles = [];
    }

    resetPose(startX, startY) {
        const resetParticle = (particle, offset) => {
            particle.pos.set(startX + offset.x, startY + offset.y);
            particle.oldPos.set(particle.pos.x, particle.pos.y);
            particle.acc.set(0, 0);
            particle.angularVel = 0;
            particle.motorTorque = 0;
            particle.brakeForce = 0;
            particle.onGround = false;
        };

        resetParticle(this.backWheel, this.poseOffsets.backWheel);
        resetParticle(this.frontWheel, this.poseOffsets.frontWheel);
        this.syncVisualFrame();
    }

    rotateOffset(offset, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Vec2(offset.x * c - offset.y * s, offset.x * s + offset.y * c);
    }

    syncVisualFrame() {
        const axis = this.frontWheel.pos.sub(this.backWheel.pos);
        const axisLen = axis.mag();
        if (axisLen < 0.001) return;

        const angle = Math.atan2(axis.y, axis.x);
        const bikeOrigin = new Vec2(
            (this.backWheel.pos.x + this.frontWheel.pos.x) * 0.5,
            (this.backWheel.pos.y + this.frontWheel.pos.y) * 0.5 - 18
        );

        this.motor.pos = bikeOrigin.add(this.rotateOffset(this.poseOffsets.motor, angle));
        this.seat.pos = bikeOrigin.add(this.rotateOffset(this.poseOffsets.seat, angle));
        this.head.pos = bikeOrigin.add(this.rotateOffset(this.poseOffsets.head, angle));
        this.riderHead.pos = bikeOrigin.add(this.rotateOffset(this.poseOffsets.riderHead, angle));
    }

    control(inputs) {
        let torque = 1050;
        let tiltDrive = 140;

        if (inputs.accel) {
            this.backWheel.motorTorque = torque;
            this.frontWheel.motorTorque = torque * 0.25;
            // Add exhaust smoke
            if (Math.random() > 0.5) {
                this.exhaustParticles.push({
                    x: this.motor.pos.x - 20,
                    y: this.motor.pos.y,
                    vx: -50 - Math.random() * 50,
                    vy: (Math.random() - 0.5) * 20,
                    life: 1.0,
                    size: 2 + Math.random() * 4
                });
            }
        } else if (inputs.brake) {
            // Reverse / Brake
            this.backWheel.brakeForce = 0.5;
            this.frontWheel.brakeForce = 0.5;
            if(!this.backWheel.onGround && !this.frontWheel.onGround) {
                 this.backWheel.motorTorque = -torque * 0.5; // air brake tilt
                 this.frontWheel.motorTorque = -torque * 0.2;
            }
        } else {
            this.backWheel.motorTorque = 0;
            this.frontWheel.motorTorque = 0;
            this.backWheel.brakeForce = 0;
            this.frontWheel.brakeForce = 0;
        }

        // Tilt controls in air or for wheelies
        if (inputs.tiltForward) {
            this.frontWheel.motorTorque += tiltDrive;
            this.backWheel.motorTorque -= tiltDrive * 0.4;
        }
        if (inputs.tiltBack) {
            this.backWheel.motorTorque += tiltDrive;
            this.frontWheel.motorTorque -= tiltDrive * 0.4;
        }

        // Gentle self-balance while both wheels are grounded, keeps bike on track.
        if (this.backWheel.onGround && this.frontWheel.onGround && !inputs.tiltForward && !inputs.tiltBack) {
            let frameAngle = Math.atan2(this.frontWheel.pos.y - this.backWheel.pos.y, this.frontWheel.pos.x - this.backWheel.pos.x);
            let correction = Math.max(-1, Math.min(1, frameAngle * 2.5));
            this.backWheel.motorTorque += correction * 80;
            this.frontWheel.motorTorque -= correction * 80;
        }
    }

    getLinearSpeed(dt = 1) {
        const backVel = this.backWheel.pos.sub(this.backWheel.oldPos);
        const frontVel = this.frontWheel.pos.sub(this.frontWheel.oldPos);
        const avgVel = backVel.add(frontVel).mul(0.5);
        if (dt <= 0) return avgVel.mag();
        return avgVel.mag() / dt;
    }

    updateStats(dt) {
        this.riderHead.pos.set(
            this.seat.pos.x + (this.head.pos.x - this.seat.pos.x) * 0.25 - 4,
            this.seat.pos.y - 32
        );

        // Calculate angle of bike
        let dx = this.head.pos.x - this.seat.pos.x;
        let dy = this.head.pos.y - this.seat.pos.y;
        let angle = Math.atan2(dy, dx);

        if (!this.frontWheel.onGround && !this.backWheel.onGround) {
            if (!this.isAirborne) {
                this.isAirborne = true;
                this.airTime = 0;
                this.startAngle = angle;
                this.totalRot = 0;
            }
            this.airTime += dt;
            
            // Calculate rotation delta
            let diff = angle - this.currentRot;
            // Handle wrap around
            if (diff > Math.PI) diff -= Math.PI * 2;
            if (diff < -Math.PI) diff += Math.PI * 2;
            
            this.totalRot += diff;
            
            // Check for flips
            if (Math.abs(this.totalRot) > Math.PI * 1.8) {
                this.flips++;
                this.totalRot = 0; // Reset for next flip
                return "FLIP"; // Notify game engine
            }
        } else {
            if (this.isAirborne) {
                // Landed
                this.isAirborne = false;
                let t = this.airTime;
                this.airTime = 0;
                if (t > 1.0) {
                     return "BIG JUMP";
                }
            }
        }
        
        // Wheelie logic
        if (this.backWheel.onGround && !this.frontWheel.onGround && !this.isAirborne) {
            this.wheelieTime += dt;
            if (this.wheelieTime > 0.5 && this.wheelieTime < 0.6) {
                return "WHEELIE";
            }
        } else {
            this.wheelieTime = 0;
        }

        this.currentRot = angle;
        return null;
    }

    render(ctx) {
        let dx = this.frontWheel.pos.x - this.backWheel.pos.x;
        let dy = this.frontWheel.pos.y - this.backWheel.pos.y;
        let angle = Math.atan2(dy, dx);
        let midX = (this.backWheel.pos.x + this.frontWheel.pos.x) * 0.5;
        let midY = (this.backWheel.pos.y + this.frontWheel.pos.y) * 0.5 - 22;

        // Draw Exhaust Smoke & Fire
        for (let i = this.exhaustParticles.length - 1; i >= 0; i--) {
            let p = this.exhaustParticles[i];
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.life > 0.7 ? '#ff9f1c' : '#555'; // Fire then smoke
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            p.x += p.vx * 0.016;
            p.y += p.vy * 0.016;
            p.life -= 0.04;
            p.size += 0.4;
            if (p.life <= 0) this.exhaustParticles.splice(i, 1);
        }
        ctx.globalAlpha = 1.0;

        // Draw Bike Sprite
        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(angle);
        ctx.drawImage(this.imgFrame, -60, -55, 120, 80);
        ctx.restore();

        // Draw Shocks (Details)
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.head.pos.x, this.head.pos.y);
        ctx.lineTo(this.frontWheel.pos.x, this.frontWheel.pos.y);
        ctx.stroke();

        // Draw Wheels
        this.drawWheel(ctx, this.backWheel);
        this.drawWheel(ctx, this.frontWheel);
    }

    renderRider(ctx) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Helmet
        ctx.fillStyle = '#f3722c';
        ctx.beginPath();
        ctx.arc(this.riderHead.pos.x, this.riderHead.pos.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Body
        ctx.strokeStyle = '#222';
        ctx.beginPath();
        ctx.moveTo(this.riderHead.pos.x, this.riderHead.pos.y + 5);
        ctx.lineTo(this.seat.pos.x, this.seat.pos.y);
        ctx.stroke();

        // Arms to handlebars
        ctx.beginPath();
        ctx.moveTo(this.riderHead.pos.x, this.riderHead.pos.y + 10);
        ctx.lineTo(this.head.pos.x, this.head.pos.y);
        ctx.stroke();
    }

    drawWheel(ctx, w) {
        ctx.save();
        ctx.translate(w.pos.x, w.pos.y);
        ctx.rotate(w.rotation);
        
        // Tire
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(0, 0, w.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Tread
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        for (let i = 0; i < 12; i++) {
            ctx.rotate(Math.PI / 6);
            ctx.beginPath();
            ctx.moveTo(w.radius - 4, 0);
            ctx.lineTo(w.radius, 0);
            ctx.stroke();
        }

        // Rim
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, w.radius - 6, 0, Math.PI * 2);
        ctx.stroke();
        
        // Spokes
        ctx.strokeStyle = '#777';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(w.radius - 6, 0);
            ctx.stroke();
        }

        // Hub
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class LevelGenerator {
    static generate(levelNum) {
        let pts = [];
        let numPoints = 100 + levelNum * 20; // Longer tracks for higher levels
        let x = 0;
        let y = 300;
        pts.push({x: x, y: y});
        
        let difficulty = Math.min(levelNum * 0.1, 1.0);
        
        for (let i = 1; i < numPoints; i++) {
            let dx = 80 + Math.random() * 40;
            let type = Math.random();
            let dy = 0;

            if (i < 8) {
                // Flat start
                dy = 0;
                dx = 100;
            } else if (i > numPoints - 5) {
                // Flat
                dy = (Math.random() - 0.5) * 20;
            } else if (type < 0.6) {
                // Ramp Up
                dy = -50 - Math.random() * 150 * difficulty;
                dx = 100;
            } else if (type < 0.8) {
                // Drop
                dy = 50 + Math.random() * 100 * difficulty;
            } else {
                // Bumpy / Obstacle
                dy = (Math.random() - 0.5) * 100 * difficulty;
                dx = 40; // closer points make bumps sharper
            }

            x += dx;
            y += dy;
            
            // Bound Y so it doesn't go off screen forever
            if (y < -500) y = -500;
            if (y > 1000) y = 1000;
            
            pts.push({x: x, y: y});
            
            // Add gap logic for high levels (skipped points)
            // Simulating gaps by dropping the point very low
            if (levelNum > 5 && type > 0.9 && i < numPoints - 10) {
                x += 100 * difficulty;
                pts.push({x: x, y: y + 400}); // Deep pit
            }
        }
        
        // Finish Line Platform
        pts.push({x: x + 500, y: y});
        
        return {
            points: pts,
            targetX: x,
            startPos: {x: 50, y: 100}
        };
    }
}

class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimize
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.world = new PhysicsWorld();
        this.bike = null;
        this.camera = new Vec2(0, 0);
        
        this.particles = [];
        this.visualParticles = [];
        
        this.levelData = null;
        this.currentLevel = 1;
        this.score = 0;
        this.combo = 1;
        this.comboTimer = 0;
        
        this.state = 'MENU'; // MENU, PLAYING, END
        this.lastTime = 0;
        
        this.inputs = {
            accel: false,
            brake: false,
            tiltForward: false,
            tiltBack: false
        };

        this.audioCtx = null;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupInputs();
    }
    
    initAudio() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
    }

    playSound(type) {
        if(!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        const now = this.audioCtx.currentTime;
        
        if (type === 'engine') {
            let speed = this.bike.getLinearSpeed(1);
            let freq = 40 + speed * 1.5;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq + 10, now + 0.1);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'crash') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'stunt') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.linearRampToValueAtTime(880, now + 0.2);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    setupInputs() {
        const keyToAction = {
            ArrowUp: 'accel',
            KeyW: 'accel',
            ArrowDown: 'brake',
            KeyS: 'brake',
            ArrowRight: 'tiltForward',
            KeyD: 'tiltForward',
            ArrowLeft: 'tiltBack',
            KeyA: 'tiltBack'
        };

        // Keyboard (prevent default so arrow keys always control bike)
        window.addEventListener('keydown', (e) => {
            const action = keyToAction[e.code];
            if (!action) return;
            e.preventDefault();
            this.inputs[action] = true;
        });

        window.addEventListener('keyup', (e) => {
            const action = keyToAction[e.code];
            if (!action) return;
            e.preventDefault();
            this.inputs[action] = false;
        });

        // Prevent stuck keys when tab loses focus.
        window.addEventListener('blur', () => {
            this.inputs.accel = false;
            this.inputs.brake = false;
            this.inputs.tiltForward = false;
            this.inputs.tiltBack = false;
        });

        // Touch setup happens in script.js to bind UI buttons
    }

    loadLevel(levelNum) {
        this.currentLevel = levelNum;
        this.levelData = LevelGenerator.generate(levelNum);
        
        this.world = new PhysicsWorld();
        
        // Build terrain
        for (let pt of this.levelData.points) {
            this.world.terrain.addPoint(pt.x, pt.y);
        }
        
        this.bike = new Bike(this.world, this.levelData.startPos.x, this.levelData.startPos.y);
        const startGroundY = this.getTerrainHeightAt(this.levelData.startPos.x + 10);
        if (startGroundY !== null) {
            this.bike.resetPose(this.levelData.startPos.x, startGroundY - 34);
            for (let i = 0; i < 8; i++) {
                this.world.update(1 / 120);
            }
        }
        
        this.state = 'PLAYING';
        this.score = 0;
        this.combo = 1;
        this.visualParticles = [];
        this.camera.set(this.bike.motor.pos.x, this.bike.motor.pos.y);
        
        // Reset inputs
        this.inputs = { accel:false, brake:false, tiltForward:false, tiltBack:false };
        
        this.initAudio();
    }

    getTerrainHeightAt(x) {
        for (let seg of this.world.terrain.segments) {
            let minX = Math.min(seg.p1.x, seg.p2.x);
            let maxX = Math.max(seg.p1.x, seg.p2.x);
            if (x < minX || x > maxX) continue;
            let span = seg.p2.x - seg.p1.x;
            if (Math.abs(span) < 0.0001) return seg.p1.y;
            let t = (x - seg.p1.x) / span;
            return seg.p1.y + (seg.p2.y - seg.p1.y) * t;
        }
        return null;
    }

    addScore(stuntName, pts) {
        this.combo++;
        let total = pts * this.combo;
        this.score += total;
        this.comboTimer = 2.0; // 2 seconds to keep combo
        
        this.playSound('stunt');
        
        // Trigger UI callback
        if (this.onStunt) this.onStunt(stuntName, this.combo);
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;
        
        if (this.inputs.accel || this.inputs.brake || this.inputs.tiltForward || this.inputs.tiltBack) {
            this.world.gameStarted = true;
        }

        if (this.inputs.accel) this.playSound('engine');

        this.bike.control(this.inputs);
        this.world.update(dt);
        this.bike.syncVisualFrame();
        
        // Process visual particles from physics
        for (let cp of this.world.contactPoints) {
            this.visualParticles.push(new VisualParticle(cp.x, cp.y, cp.type));
        }

        // Stunt checking
        let stunt = this.bike.updateStats(dt);
        if (stunt) {
            let pts = stunt === "FLIP" ? 500 : (stunt === "WHEELIE" ? 100 : 200);
            this.addScore(stunt, pts);
        }

        // Combo decay
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 1;
            }
        }

        // Camera smoothing
        let targetX = this.bike.motor.pos.x + 200; // Look ahead
        let targetY = this.bike.motor.pos.y - 100;
        
        this.camera.x += (targetX - this.camera.x) * 5 * dt;
        this.camera.y += (targetY - this.camera.y) * 5 * dt;

        // Visual Particles update
        for (let i = this.visualParticles.length - 1; i >= 0; i--) {
            this.visualParticles[i].update(dt);
            if (this.visualParticles[i].life <= 0) {
                this.visualParticles.splice(i, 1);
            }
        }

        // Check Win/Loss
        if (this.world.bikeCrashed || this.bike.motor.pos.y > 5000) {
            this.gameOver(false);
        } else if (this.bike.motor.pos.x >= this.levelData.targetX) {
            this.gameOver(true);
        }
        
        // Update UI Speedometer
        if (this.onUpdateUI) {
            let speed = this.bike.getLinearSpeed(dt);
            // Convert to arbitrary km/h
            let kmh = Math.floor(speed * 0.1);
            this.onUpdateUI(this.score, this.currentLevel, kmh);
        }
    }

    gameOver(win) {
        this.state = 'END';
        this.playSound(win ? 'stunt' : 'crash');
        if (this.onGameOver) {
            this.onGameOver(win, this.score);
        }
    }

    render() {
        // Clear background with dark sky color
        this.ctx.fillStyle = '#0a0a0c';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.state !== 'PLAYING' && this.state !== 'END') return;

        this.ctx.save();
        
        // Parallax Background
        this.renderBackground();

        // Camera transform
        this.ctx.translate(this.width / 2 - this.camera.x, this.height / 2 - this.camera.y);

        // Draw Target Line
        this.ctx.fillStyle = 'rgba(6, 214, 160, 0.5)';
        this.ctx.fillRect(this.levelData.targetX, -1000, 20, 2000);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '30px Teko';
        this.ctx.fillText("FINISH", this.levelData.targetX + 5, this.levelData.points[this.levelData.points.length-1].y - 50);

        // Draw Terrain
        this.ctx.beginPath();
        let pts = this.world.terrain.points;
        if(pts.length > 0) {
            this.ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                this.ctx.lineTo(pts[i].x, pts[i].y);
            }
            // Close path for fill
            this.ctx.lineTo(pts[pts.length-1].x, 2000);
            this.ctx.lineTo(pts[0].x, 2000);
            this.ctx.closePath();
            
            // Terrain Fill
            let grad = this.ctx.createLinearGradient(0, this.camera.y - 500, 0, this.camera.y + 1000);
            grad.addColorStop(0, '#2c1e16');
            grad.addColorStop(1, '#1a120c');
            this.ctx.fillStyle = grad;
            this.ctx.fill();
            
            // Terrain Stroke
            this.ctx.strokeStyle = '#f3722c';
            this.ctx.lineWidth = 6;
            this.ctx.lineJoin = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                this.ctx.lineTo(pts[i].x, pts[i].y);
            }
            this.ctx.stroke();
        }

        // Draw Particles
        for (let vp of this.visualParticles) {
            vp.render(this.ctx);
        }

        // Draw Bike
        if(this.bike) this.bike.render(this.ctx);

        this.ctx.restore();
    }

    renderBackground() {
        // Cinematic Sunset Sky
        let skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
        skyGrad.addColorStop(0, '#0a0a0c');
        skyGrad.addColorStop(0.5, '#1a1a24');
        skyGrad.addColorStop(1, '#f9414433');
        this.ctx.fillStyle = skyGrad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Distant Mountains (Parallax Layer 1)
        this.ctx.save();
        let pX1 = this.camera.x * 0.1;
        this.ctx.fillStyle = '#0f0f15';
        for (let i = -2; i < 5; i++) {
            let x = (i * 800 - (pX1 % 800));
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.height);
            this.ctx.lineTo(x + 400, this.height - 300);
            this.ctx.lineTo(x + 800, this.height);
            this.ctx.fill();
        }

        // Closer Hills (Parallax Layer 2)
        let pX2 = this.camera.x * 0.3;
        this.ctx.fillStyle = '#14141d';
        for (let i = -2; i < 10; i++) {
            let x = (i * 400 - (pX2 % 400));
            this.ctx.beginPath();
            this.ctx.arc(x, this.height + 100, 300, Math.PI, 0);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        
        if (dt > 0.1) dt = 0.1; // Cap dt for lag spikes
        
        this.update(dt);
        this.render();
        
        requestAnimationFrame((t) => this.loop(t));
    }
    
    start() {
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }
}
