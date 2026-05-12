class Entity {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.hp = 100;
        this.maxHp = 100;
        this.speed = 3;
        this.angle = 0;
        this.toDelete = false;
        this.lastHit = 0;
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.lastHit = Date.now();
        if (this.hp <= 0) this.toDelete = true;
        return this.toDelete;
    }

    draw(ctx) {
        // Base drawing logic for entities
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 20, '#00f2ff');
        this.weapon = window.Armory.Pistol();
        this.xp = 0;
        this.level = 1;
        this.xpToNext = 100;
        this.dashCooldown = 0;
        this.isDashing = false;
        this.invulnerable = 120; // 2 seconds at 60fps
    }

    update(input, engine, bullets, dt) {
        if (this.invulnerable > 0) this.invulnerable -= 1 * dt;
        
        // Movement
        let moveSpeed = this.speed * dt;
        if (input.isDashing && this.dashCooldown <= 0) {
            this.isDashing = true;
            this.dashCooldown = 60;
            engine.particles.emit(this.x, this.y, this.color, 15, 8);
        }

        if (this.isDashing) {
            moveSpeed *= 3;
            this.dashCooldown -= 1 * dt;
            if (this.dashCooldown < 40) this.isDashing = false;
        } else if (this.dashCooldown > 0) {
            this.dashCooldown -= 1 * dt;
        }

        this.x += input.moveVector.x * moveSpeed;
        this.y += input.moveVector.y * moveSpeed;

        // Rotation
        if (input.touch.active && input.touch.aim.active) {
            this.angle = Math.atan2(input.aimVector.y, input.aimVector.x);
        } else if (!input.touch.active) {
            this.angle = Math.atan2(input.mouse.y - engine.height / 2, input.mouse.x - engine.width / 2);
        }

        // Shooting
        if (input.isFiring) {
            if (this.weapon.fire(this.x, this.y, this.angle, 'player', bullets)) {
                window.sfxManager.playShoot();
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Body Glow
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 2);
        grad.addColorStop(0, this.color + '55');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Mechanical Detail (Procedural)
        ctx.lineWidth = 3;
        ctx.strokeStyle = this.color;
        
        // Main Body
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Internal core
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Weapon Barrel
        ctx.fillStyle = '#333';
        ctx.strokeStyle = this.color;
        ctx.strokeRect(this.radius * 0.5, -5, 20, 10);
        ctx.fillRect(this.radius * 0.5, -5, 20, 10);

        ctx.restore();
    }
}

class Enemy extends Entity {
    constructor(x, y, type) {
        super(x, y, 15, '#ff00ea');
        this.type = type; // 'fast', 'tank', 'ranged', 'boss'
        this.setupStats();
    }

    setupStats() {
        switch(this.type) {
            case 'fast':
                this.hp = 30;
                this.speed = 4.5;
                this.radius = 12;
                this.color = '#39ff14';
                break;
            case 'tank':
                this.hp = 200;
                this.speed = 1.5;
                this.radius = 25;
                this.color = '#ff3131';
                break;
            case 'ranged':
                this.hp = 60;
                this.speed = 2.5;
                this.radius = 18;
                this.color = '#ffcc00';
                this.weapon = window.Armory.Pistol();
                this.weapon.fireRate = 2000;
                this.weapon.color = '#ffcc00';
                break;
            case 'boss':
                this.hp = 1000;
                this.speed = 1.0;
                this.radius = 60;
                this.color = '#ff00ea';
                break;
        }
        this.maxHp = this.hp;
    }

    update(player, bullets, dt) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        this.angle = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx*dx + dy*dy);

        // Simple Seek AI
        let stopDist = (this.type === 'ranged') ? 300 : 0;
        
        if (dist > stopDist) {
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
        }

        // Shooting AI for ranged
        if (this.type === 'ranged' && dist < 500) {
            this.weapon.fire(this.x, this.y, this.angle, 'enemy', bullets);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Body Glow
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 2);
        grad.addColorStop(0, this.color + '44');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Health Bar (mini)
        if (this.hp < this.maxHp) {
            ctx.fillStyle = '#333';
            ctx.fillRect(-20, -this.radius - 15, 40, 5);
            ctx.fillStyle = this.color;
            ctx.fillRect(-20, -this.radius - 15, (this.hp / this.maxHp) * 40, 5);
        }

        // Body
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.fillStyle = '#1a1a1a';

        ctx.beginPath();
        if (this.type === 'fast') {
            // Triangle shape
            ctx.moveTo(this.radius, 0);
            ctx.lineTo(-this.radius, this.radius * 0.8);
            ctx.lineTo(-this.radius, -this.radius * 0.8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Core
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(-5, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'tank') {
            // Hexagon/Square
            ctx.rect(-this.radius, -this.radius, this.radius*2, this.radius*2);
            ctx.fill();
            ctx.stroke();
            
            // Tread marks
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.strokeRect(-this.radius + 5, -this.radius - 5, this.radius*2 - 10, 5);
            ctx.strokeRect(-this.radius + 5, this.radius, this.radius*2 - 10, 5);
        } else if (this.type === 'boss') {
            // Giant mechanical spider/core
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Rotating outer ring effect
            ctx.rotate(Date.now() / 1000);
            ctx.strokeStyle = '#fff';
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Circle (Ranged)
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Sniper lens
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.radius*0.6, 0, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

window.Player = Player;
window.Enemy = Enemy;
