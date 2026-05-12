// js/physics.js
// 2.5D Physics Engine

class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    
    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }
    
    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }
    
    mult(n) {
        this.x *= n;
        this.y *= n;
        this.z *= n;
        return this;
    }
    
    mag() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    
    normalize() {
        const m = this.mag();
        if (m !== 0) this.mult(1 / m);
        return this;
    }

    copy() {
        return new Vector3(this.x, this.y, this.z);
    }
}

class PhysicsEngine {
    constructor() {
        this.gravity = -0.5; // Z axis gravity
        this.airFriction = 0.99; // drag while in air
        
        // Terrain properties: friction (lower = more slippery), bounce restitution
        this.terrainProps = {
            'fairway': { friction: 0.96, bounce: 0.5 },
            'rough': { friction: 0.85, bounce: 0.3 },
            'sand': { friction: 0.70, bounce: 0.1 },
            'green': { friction: 0.98, bounce: 0.4 },
            'water': { friction: 0.0, bounce: 0.0 } // stops immediately
        };
    }

    update(ball, dt, windVector, getTerrainAt) {
        if (ball.state === 'idle' || ball.state === 'hole_in') return;

        // Apply velocities
        ball.pos.add(ball.vel);

        // State: in_air
        if (ball.pos.z > 0 || ball.vel.z > 0) {
            ball.state = 'in_air';
            ball.vel.z += this.gravity;
            
            // Wind affects X and Y velocity
            ball.vel.x += windVector.x * 0.01;
            ball.vel.y += windVector.y * 0.01;
            
            ball.vel.x *= this.airFriction;
            ball.vel.y *= this.airFriction;

            // Check ground collision
            if (ball.pos.z <= 0) {
                ball.pos.z = 0;
                this.handleBounce(ball, getTerrainAt);
            }
        } 
        // State: rolling
        else {
            ball.state = 'rolling';
            ball.pos.z = 0;
            ball.vel.z = 0;

            const terrain = getTerrainAt(ball.pos.x, ball.pos.y);
            
            if (terrain === 'water') {
                ball.state = 'water';
                ball.vel.mult(0);
                return;
            }

            const props = this.terrainProps[terrain] || this.terrainProps['fairway'];
            
            // Apply spin effect while rolling
            ball.vel.x += ball.spin.x * 0.05;
            ball.vel.y += ball.spin.y * 0.05;
            
            // Decay spin
            ball.spin.mult(0.95);

            // Apply ground friction
            ball.vel.x *= props.friction;
            ball.vel.y *= props.friction;

            // Stop if moving very slow
            if (Math.abs(ball.vel.x) < 0.1 && Math.abs(ball.vel.y) < 0.1) {
                ball.vel.x = 0;
                ball.vel.y = 0;
                ball.state = 'idle';
            }
        }
    }

    handleBounce(ball, getTerrainAt) {
        const terrain = getTerrainAt(ball.pos.x, ball.pos.y);
        
        if (terrain === 'water') {
            ball.state = 'water';
            ball.vel.mult(0);
            if (typeof AudioEngine !== 'undefined') AudioEngine.playBounce('water');
            return;
        }

        const props = this.terrainProps[terrain] || this.terrainProps['fairway'];
        
        // Bounce Z
        ball.vel.z = -ball.vel.z * props.bounce;
        
        // Apply spin to horizontal velocity on first bounce
        if (ball.spin.mag() > 0) {
            ball.vel.x += ball.spin.x * 0.5;
            ball.vel.y += ball.spin.y * 0.5;
        }

        // Horizontal friction during bounce
        ball.vel.x *= props.friction;
        ball.vel.y *= props.friction;

        // Play sound if bounce is strong enough
        if (Math.abs(ball.vel.z) > 1.0 && typeof AudioEngine !== 'undefined') {
            AudioEngine.playBounce(terrain);
        }

        // If bounce is very small, force to roll
        if (Math.abs(ball.vel.z) < 0.5) {
            ball.vel.z = 0;
        }
    }
}
