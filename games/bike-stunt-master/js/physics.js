/**
 * Custom 2D Physics Engine for Bike Stunt Master
 * Verlet Integration based rigid body system with constraints.
 */

class Vec2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    mul(s) { return new Vec2(this.x * s, this.y * s); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    magSq() { return this.x * this.x + this.y * this.y; }
    norm() { 
        let m = this.mag(); 
        return m === 0 ? new Vec2(0,0) : new Vec2(this.x/m, this.y/m);
    }
    dot(v) { return this.x * v.x + this.y * v.y; }
    cross(v) { return this.x * v.y - this.y * v.x; }
    dist(v) { return this.sub(v).mag(); }
    copy() { return new Vec2(this.x, this.y); }
    set(x, y) { this.x = x; this.y = y; }
}

class Particle {
    constructor(x, y, radius = 5, mass = 1, isStatic = false) {
        this.pos = new Vec2(x, y);
        this.oldPos = new Vec2(x, y);
        this.acc = new Vec2(0, 0);
        this.radius = radius;
        this.mass = mass;
        this.isStatic = isStatic;
        this.friction = 0.99;
        this.restitution = 0.2;
        // Specific properties for wheels
        this.isWheel = false;
        this.angularVel = 0;
        this.rotation = 0;
        this.motorTorque = 0;
        this.brakeForce = 0;
        this.noTerrainCollision = false;
    }

    applyForce(f) {
        if (this.isStatic) return;
        this.acc.x += f.x / this.mass;
        this.acc.y += f.y / this.mass;
    }

    update(dt) {
        if (this.isStatic) return;

        // Verlet integration
        let vel = this.pos.sub(this.oldPos);
        vel = vel.mul(this.friction);
        
        this.oldPos = this.pos.copy();
        
        this.pos.x += vel.x + this.acc.x * dt * dt;
        this.pos.y += vel.y + this.acc.y * dt * dt;
        
        this.acc.set(0, 0); // Reset acceleration
        
        // Wheel rotation
        if (this.isWheel) {
            this.rotation += this.angularVel * dt;
            this.angularVel *= 0.98; // Angular friction
        }
    }
}

class Constraint {
    constructor(p1, p2, stiffness = 1, type = "distance") {
        this.p1 = p1;
        this.p2 = p2;
        this.restLength = p1.pos.dist(p2.pos);
        this.stiffness = stiffness;
        this.type = type; // "distance" or "spring" or "shock"
        this.damping = 0.1; // For shock absorbers
    }

    resolve(dt) {
        let delta = this.p2.pos.sub(this.p1.pos);
        let dist = delta.mag();
        if (dist === 0) return;
        
        let diff = (dist - this.restLength) / dist;

        if (this.type === "distance") {
            let offset = delta.mul(diff * 0.5 * this.stiffness);
            let m1 = this.p1.mass;
            let m2 = this.p2.mass;
            let totalMass = m1 + m2;
            
            if (!this.p1.isStatic) {
                this.p1.pos = this.p1.pos.add(offset.mul(m2 / totalMass * 2));
            }
            if (!this.p2.isStatic) {
                this.p2.pos = this.p2.pos.sub(offset.mul(m1 / totalMass * 2));
            }
        } else if (this.type === "shock") {
            // Spring force
            let force = diff * this.stiffness;
            let dir = delta.norm();
            
            // Damping (relative velocity along spring)
            let v1 = this.p1.pos.sub(this.p1.oldPos).mul(1/dt);
            let v2 = this.p2.pos.sub(this.p2.oldPos).mul(1/dt);
            let relVel = v2.sub(v1);
            let dampForce = relVel.dot(dir) * this.damping;
            
            let totalForce = dir.mul(force + dampForce);
            
            if (!this.p1.isStatic) this.p1.applyForce(totalForce);
            if (!this.p2.isStatic) this.p2.applyForce(totalForce.mul(-1));
            
            // Visual constraint resolution to prevent extreme stretching
            if(Math.abs(diff) > 0.5) { // Prevent overstretch
                 let offset = delta.mul(diff * 0.1);
                 if (!this.p1.isStatic) this.p1.pos = this.p1.pos.add(offset);
                 if (!this.p2.isStatic) this.p2.pos = this.p2.pos.sub(offset);
            }
        }
    }
}

class Terrain {
    constructor() {
        this.points = [];
        this.segments = []; // array of {p1, p2, normal}
    }

    addPoint(x, y) {
        this.points.push(new Vec2(x, y));
        if (this.points.length > 1) {
            this.buildSegments();
        }
    }

    buildSegments() {
        this.segments = [];
        for (let i = 0; i < this.points.length - 1; i++) {
            let p1 = this.points[i];
            let p2 = this.points[i + 1];
            let dir = p2.sub(p1).norm();
            // Canvas uses +Y downward, so this normal points "up" from terrain.
            let normal = new Vec2(dir.y, -dir.x);
            this.segments.push({ p1: p1, p2: p2, dir: dir, normal: normal, length: p1.dist(p2) });
        }
    }
}

class PhysicsWorld {
    constructor() {
        this.particles = [];
        this.constraints = [];
        this.terrain = new Terrain();
        this.gravity = new Vec2(0, 1800); // Slightly more gravity for realistic feel
        this.iterations = 22; // Higher iteration count keeps bike frame rigid
        this.contactPoints = []; // Visualizing contacts/particles
        this.bikeCrashed = false;
        this.time = 0;
        this.gameStarted = false;
    }

    addParticle(p) {
        this.particles.push(p);
        return p;
    }

    addConstraint(c) {
        this.constraints.push(c);
        return c;
    }

    update(dt) {
        if(dt > 0.05) dt = 0.05; // Tighter clamp prevents solver explosions on lag spikes
        
        // Apply forces
        for (let p of this.particles) {
            p.applyForce(this.gravity.mul(p.mass));
            p.update(dt);
        }

        this.contactPoints = [];
        this.bikeCrashed = false;
        this.time += dt;

        // Resolve Constraints
        for (let i = 0; i < this.iterations; i++) {
            for (let c of this.constraints) {
                c.resolve(dt);
            }
            this.resolveTerrainCollisions(dt);
        }
    }

    resolveTerrainCollisions(dt) {
        // Line collision detection
        for (let p of this.particles) {
            if (p.isStatic) continue;
            if (p.noTerrainCollision) {
                p.onGround = false;
                continue;
            }

            let closestDist = Infinity;
            let closestNormal = null;
            let contactPoint = null;
            let segmentDir = null;
            let onGround = false;

            // Simplified: check segments that are near the particle's X
            for (let seg of this.terrain.segments) {
                // AABB early out
                let minX = Math.min(seg.p1.x, seg.p2.x) - p.radius;
                let maxX = Math.max(seg.p1.x, seg.p2.x) + p.radius;
                
                if (p.pos.x < minX || p.pos.x > maxX) continue;

                // Distance from point to line segment
                let v = p.pos.sub(seg.p1);
                let proj = v.dot(seg.dir);
                
                if (proj >= -p.radius && proj <= seg.length + p.radius) {
                    let d = v.dot(seg.normal);
                    // Use a slightly larger buffer for detection
                    if (d < p.radius && d > -p.radius * 3) {
                        // Collision!
                        onGround = true;
                        
                        // Push out
                        let pen = p.radius - d;
                        if(d < 0) { // Passed through terrain, highly unlikely with dense points but check
                            pen = p.radius + d;
                            p.pos = p.pos.sub(seg.normal.mul(pen));
                        } else {
                            p.pos = p.pos.add(seg.normal.mul(pen));
                        }
                        
                        // Friction and restitution (velocity level)
                        let vel = p.pos.sub(p.oldPos);
                        let velNormal = seg.normal.mul(vel.dot(seg.normal));
                        let velTangent = vel.sub(velNormal);
                        
                        // Bounce
                        velNormal = velNormal.mul(-p.restitution);
                        
                        // Wheel specific logic
                        if (p.isWheel) {
                            // Ground friction turns into angular velocity, and motor torque turns into linear force.
                            // Apply motor torque
                            if (Math.abs(p.motorTorque) > 0) {
                                // IMPORTANT: apply drive into tangent velocity (not pos/oldPos),
                                // otherwise final velocity reconstruction will cancel it.
                                let drive = Math.max(-1, Math.min(1, p.motorTorque / 1400));
                                velTangent = velTangent.add(seg.dir.mul(drive * 150 * dt));
                                p.angularVel += drive * 16 * dt;
                                
                                // Particle effect logic
                                if(Math.random() > 0.5) {
                                    this.contactPoints.push({x: p.pos.x, y: p.pos.y + p.radius, type: 'dust'});
                                }
                            }
                            
                            // Apply brake
                            if (p.brakeForce > 0) {
                                p.angularVel *= (1 - p.brakeForce);
                                velTangent = velTangent.mul(1 - p.brakeForce);
                                if(vel.magSq() > 100) {
                                    this.contactPoints.push({x: p.pos.x, y: p.pos.y + p.radius, type: 'smoke'});
                                }
                            } else {
                                // Rolling friction
                                // Tangent velocity affects rotation
                                let slip = velTangent.dot(seg.dir);
                                p.angularVel = slip / p.radius; // Rolling without slipping
                                velTangent = velTangent.mul(0.96); // Slightly stronger rolling drag for stability
                            }
                            
                        } else {
                            // Chassis collision = Crash
                            velTangent = velTangent.mul(0.8); // High friction for body
                            
                            // Crash only on meaningful impact after user control starts.
                            // This prevents false "instant crash" while settling at spawn.
                            let impactSpeed = vel.mag();
                            let impactNormal = Math.abs(vel.dot(seg.normal));
                            let canCrash = this.time > 1.0 && this.gameStarted;
                            
                            if (p.mass > 5 && canCrash && impactSpeed > 260 && impactNormal > 140) {
                                this.bikeCrashed = true;
                            }
                        }

                        // Reconstruct velocity
                        p.oldPos = p.pos.sub(velNormal.add(velTangent));
                    }
                }
            }
            p.onGround = onGround;
        }
    }
}
