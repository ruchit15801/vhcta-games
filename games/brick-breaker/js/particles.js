/**
 * Neon Breaker Particle System
 * Handles explosions, trails, and impact sparks.
 */
class Particle {
    constructor(x, y, color, speed, angle, life, size) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = life;
        this.maxLife = life;
        this.size = size;
        this.alpha = 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.alpha = this.life / this.maxLife;
        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    createExplosion(x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            const speed = Math.random() * 5 + 2;
            const angle = Math.random() * Math.PI * 2;
            const life = Math.random() * 30 + 20;
            const size = Math.random() * 3 + 1;
            this.particles.push(new Particle(x, y, color, speed, angle, life, size));
        }
    }

    createTrail(x, y, color) {
        const speed = Math.random() * 1;
        const angle = Math.random() * Math.PI * 2;
        const life = 15;
        const size = Math.random() * 2 + 1;
        this.particles.push(new Particle(x, y, color, speed, angle, life, size));
    }

    createSparks(x, y, color, count = 5) {
        for (let i = 0; i < count; i++) {
            const speed = Math.random() * 8 + 4;
            const angle = Math.random() * Math.PI * 2;
            const life = Math.random() * 10 + 5;
            const size = Math.random() * 1.5 + 0.5;
            this.particles.push(new Particle(x, y, color, speed, angle, life, size));
        }
    }

    update() {
        this.particles = this.particles.filter(p => p.update());
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }

    clear() {
        this.particles = [];
    }
}

const particles = new ParticleSystem();
export default particles;
