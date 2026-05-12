// entities.js - Player, Enemies, Traps, Collectibles

// Utility for Circle-Rect Collision
function circleRectCollide(circle, rect) {
    let testX = circle.x;
    let testY = circle.y;
    
    if (circle.x < rect.x) testX = rect.x;
    else if (circle.x > rect.x + rect.w) testX = rect.x + rect.w;
    
    if (circle.y < rect.y) testY = rect.y;
    else if (circle.y > rect.y + rect.h) testY = rect.y + rect.h;
    
    let distX = circle.x - testX;
    let distY = circle.y - testY;
    let distance = Math.sqrt((distX*distX) + (distY*distY));
    
    return distance <= circle.r;
}

class Player {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.r = radius;
        this.speed = 250; // pixels per second
        this.color = '#ff0844';
        this.shielded = false;
        this.shieldTimer = 0;
        this.speedBoostTimer = 0;
    }

    update(dt, input, maze) {
        let currentSpeed = this.speed;
        if (this.speedBoostTimer > 0) {
            currentSpeed *= 1.5;
            this.speedBoostTimer -= dt;
            if (Math.random() < 0.2) {
                engine.addParticle(this.x, this.y, '#00f2fe', 100, 3, 0.5);
            }
        }
        
        if (this.shieldTimer > 0) {
            this.shieldTimer -= dt;
            this.shielded = true;
        } else {
            this.shielded = false;
        }

        // Apply movement
        let vx = input.x * currentSpeed * (dt / 1000);
        let vy = input.y * currentSpeed * (dt / 1000);

        // Attempt X move
        this.x += vx;
        for (let w of maze.getBounds()) {
            if (circleRectCollide(this, w)) {
                // Resolve X collision
                this.x -= vx;
                break;
            }
        }

        // Attempt Y move
        this.y += vy;
        for (let w of maze.getBounds()) {
            if (circleRectCollide(this, w)) {
                // Resolve Y collision
                this.y -= vy;
                break;
            }
        }
        
        // Bounds constraint
        if (this.x < this.r) this.x = this.r;
        if (this.y < this.r) this.y = this.r;
    }

    draw(ctx, camera) {
        let cx = this.x - camera.x;
        let cy = this.y - camera.y;
        let time = Date.now();

        ctx.save();
        ctx.shadowBlur = 15 + Math.sin(time * 0.01) * 5;
        ctx.shadowColor = this.color;
        
        // Shield Effect
        if (this.shielded) {
            ctx.beginPath();
            ctx.arc(cx, cy, this.r + 8 + Math.sin(time*0.01)*3, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(0, 242, 254, 0.2)';
            ctx.fill();
            ctx.strokeStyle = '#00f2fe';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 10]);
            ctx.lineDashOffset = -time * 0.05;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.translate(cx, cy);

        // Player Core Hovering effect
        let hoverY = Math.sin(time * 0.005) * 3;
        ctx.translate(0, hoverY);

        // Rotating tech rings
        ctx.save();
        ctx.rotate(time * 0.002);
        ctx.beginPath();
        ctx.arc(0, 0, this.r + 2, 0, Math.PI * 1.5);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Base shape
        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        // Inner glowing orb
        ctx.beginPath();
        ctx.arc(0, 0, this.r * 0.5 + Math.sin(time * 0.02) * 2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        ctx.restore();

        // Speed Boost trail effect
        if (this.speedBoostTimer > 0 && Math.random() < 0.3) {
            engine.addParticle(this.x, this.y, '#00f2fe', 50, 4, 0.4);
        }
    }
}

class Enemy {
    constructor(x, y, type, radius) {
        this.x = x;
        this.y = y;
        this.r = radius;
        this.type = type; // 0 = Random, 1 = Chaser
        this.speed = type === 0 ? 100 : 150;
        this.color = type === 0 ? '#ffb199' : '#ff0000';
        this.vx = 0;
        this.vy = 0;
        this.pickNewDirection();
    }

    pickNewDirection() {
        const dirs = [
            {vx: 1, vy: 0}, {vx: -1, vy: 0},
            {vx: 0, vy: 1}, {vx: 0, vy: -1}
        ];
        let d = dirs[Math.floor(Math.random() * dirs.length)];
        this.vx = d.vx;
        this.vy = d.vy;
    }

    update(dt, maze, player, isFrozen) {
        if (isFrozen) return;

        let moveAmount = this.speed * (dt / 1000);

        if (this.type === 1) {
            // Chaser - simple vector towards player (bounces off walls usually, not true A* for performance)
            let dx = player.x - this.x;
            let dy = player.y - this.y;
            let len = Math.hypot(dx, dy);
            if (len > 0) {
                this.vx = dx / len;
                this.vy = dy / len;
            }
        }

        // Move X
        this.x += this.vx * moveAmount;
        let colX = false;
        for (let w of maze.getBounds()) {
            if (circleRectCollide(this, w)) {
                this.x -= this.vx * moveAmount;
                colX = true;
                break;
            }
        }

        // Move Y
        this.y += this.vy * moveAmount;
        let colY = false;
        for (let w of maze.getBounds()) {
            if (circleRectCollide(this, w)) {
                this.y -= this.vy * moveAmount;
                colY = true;
                break;
            }
        }

        if ((colX || colY) && this.type === 0) {
            this.pickNewDirection();
        }
    }

    draw(ctx, camera) {
        let cx = this.x - camera.x;
        let cy = this.y - camera.y;
        let time = Date.now();

        ctx.save();
        ctx.shadowBlur = 15 + Math.sin(time * 0.01) * 5;
        ctx.shadowColor = this.color;
        
        ctx.translate(cx, cy);
        
        // Outer hazard ring (spins opposite)
        ctx.save();
        ctx.rotate(-time * 0.003);
        ctx.beginPath();
        ctx.setLineDash([5, 15]);
        ctx.arc(0, 0, this.r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        
        // Main spiky body
        ctx.rotate(time * 0.002);
        ctx.beginPath();
        for(let i=0; i<8; i++) {
            let outerRadius = this.r + (i % 2 === 0 ? Math.sin(time*0.01)*2 : 0);
            ctx.lineTo(0, -outerRadius);
            ctx.rotate(Math.PI/4);
            ctx.lineTo(0, -(this.r*0.5));
            ctx.rotate(Math.PI/4);
        }
        ctx.closePath();
        
        // Gradient fill
        let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.5, this.color);
        grad.addColorStop(1, '#000');
        
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Glowing center eye
        ctx.beginPath();
        ctx.arc(0, 0, this.r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, this.r * 0.15 + Math.sin(time * 0.02) * 1, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        ctx.restore();
    }
}

class Collectible {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.r = 10;
        // type: 0 = score, 1 = shield, 2 = speed, 3 = freeze
        this.type = type; 
        this.colors = ['#ffd700', '#00f2fe', '#00ff87', '#b100ff'];
        this.collected = false;
    }

    draw(ctx, camera) {
        if (this.collected) return;
        let cx = this.x - camera.x;
        let cy = this.y - camera.y;
        let time = Date.now();

        ctx.save();
        
        // Hover animation
        let hoverY = Math.sin(time * 0.003 + this.x) * 5;
        cy += hoverY;
        
        ctx.translate(cx, cy);
        
        ctx.shadowBlur = 20 + Math.sin(time * 0.005) * 10;
        ctx.shadowColor = this.colors[this.type];
        
        // Background glow
        ctx.beginPath();
        ctx.arc(0, 0, this.r * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = this.colors[this.type];
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        
        if (this.type === 0) {
            // Coin - Spinning Gold Coin
            ctx.scale(Math.sin(time * 0.005), 1); // 3D spin effect
            ctx.beginPath();
            ctx.arc(0, 0, this.r, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd700';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            
            // Inner coin detail
            ctx.beginPath();
            ctx.arc(0, 0, this.r * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.stroke();
        } else {
            // Powerup Diamond - Rotating Gem
            ctx.rotate(time * 0.002);
            
            // Outer gem
            ctx.beginPath();
            ctx.moveTo(0, -this.r*1.5);
            ctx.lineTo(this.r*1.5, 0);
            ctx.lineTo(0, this.r*1.5);
            ctx.lineTo(-this.r*1.5, 0);
            ctx.closePath();
            ctx.fillStyle = this.colors[this.type];
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            
            // Inner gem facet
            ctx.beginPath();
            ctx.moveTo(0, -this.r*0.8);
            ctx.lineTo(this.r*0.8, 0);
            ctx.lineTo(0, this.r*0.8);
            ctx.lineTo(-this.r*0.8, 0);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fill();
        }
        
        ctx.restore();

        // Emit ambient sparkles
        if (Math.random() < 0.05) {
            engine.addParticle(
                this.x + (Math.random() - 0.5) * 10, 
                this.y + (Math.random() - 0.5) * 10 + hoverY, 
                this.colors[this.type], 20, 1.5, 0.5
            );
        }
    }
}
