class Particle {
    constructor(x, y, color, speed, angle, life, size) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        this.life = life;
        this.maxLife = life;
        this.size = size;
        this.alpha = 1;
    }

    update(dt) {
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
        this.life -= 1 * dt;
        this.alpha = Math.max(0, this.life / this.maxLife);
        this.velocity.x *= Math.pow(0.98, dt);
        this.velocity.y *= Math.pow(0.98, dt);
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10 * this.alpha;
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

    emit(x, y, color, count = 5, speed = 2, size = 2) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const s = (Math.random() + 0.5) * speed;
            const life = Math.random() * 30 + 30;
            this.particles.push(new Particle(x, y, color, s, angle, life, size));
        }
    }

    explosion(x, y, color, count = 20) {
        this.emit(x, y, color, count, 5, 3);
        this.emit(x, y, '#ffffff', count / 2, 8, 1);
    }

    blood(x, y) {
        this.emit(x, y, '#ff0000', 10, 3, 2);
    }

    sparks(x, y, angle) {
        for (let i = 0; i < 5; i++) {
            const sAngle = angle + (Math.random() - 0.5) * 1;
            const speed = Math.random() * 5 + 2;
            this.particles.push(new Particle(x, y, '#ffcc00', speed, sAngle, 10, 1));
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }
}

class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.shakeAmount = 0;
        this.shakeDecay = 0.9;
    }

    shake(intensity) {
        this.shakeAmount = intensity;
    }

    update(targetX, targetY, width, height, dt = 1) {
        const lerpFactor = 0.1 * dt;
        const desiredX = targetX - width / 2;
        const desiredY = targetY - height / 2;
        
        this.x += (desiredX - this.x) * lerpFactor;
        this.y += (desiredY - this.y) * lerpFactor;

        if (this.shakeAmount > 0.1) {
            this.x += (Math.random() - 0.5) * this.shakeAmount;
            this.y += (Math.random() - 0.5) * this.shakeAmount;
            this.shakeAmount *= Math.pow(0.9, dt);
        }
    }

    apply(ctx) {
        ctx.save();
        ctx.translate(-this.x, -this.y);
    }

    restore(ctx) {
        ctx.restore();
    }
}

class Engine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = new ParticleSystem();
        this.camera = new Camera();
        
        this.bgImage = new Image();
        this.bgImage.src = 'assets/bg.png';
        this.bgLoaded = false;
        this.bgImage.onload = () => this.bgLoaded = true;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    clear() {
        const ctx = this.ctx;
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.width, this.height);

        if (this.bgLoaded) {
            // Parallax/Tiled background logic
            const pattern = ctx.createPattern(this.bgImage, 'repeat');
            ctx.save();
            ctx.translate(-this.camera.x * 0.5, -this.camera.y * 0.5);
            ctx.fillStyle = pattern;
            ctx.fillRect(this.camera.x * 0.5, this.camera.y * 0.5, this.width, this.height);
            ctx.restore();
        }

        // Vignette & Glow Overlay
        const gradient = ctx.createRadialGradient(
            this.width/2, this.height/2, 0,
            this.width/2, this.height/2, Math.max(this.width, this.height)
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.width, this.height);
    }

    drawCircle(x, y, radius, color, glow = true) {
        const ctx = this.ctx;
        ctx.save();
        if (glow) {
            ctx.shadowBlur = radius * 1.5;
            ctx.shadowColor = color;
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawGlow(x, y, radius, color) {
        const ctx = this.ctx;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.globalCompositeOperation = 'screen';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
}

// Engine will be initialized by GameManager
window.Engine = Engine;
