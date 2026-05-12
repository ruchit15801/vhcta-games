/**
 * Neon Breaker Physics Engine
 * Handles ball movement and collision detection.
 */
export class Ball {
    constructor(x, y, radius, speed) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.baseSpeed = speed;
        this.reset();
    }

    reset() {
        this.speed = this.baseSpeed;
        this.dx = this.speed * (Math.random() > 0.5 ? 1 : -1);
        this.dy = -this.speed;
        this.active = true;
        this.isFireball = false;
        this.trail = [];
    }

    update(canvasWidth, canvasHeight) {
        // Update trail
        this.trail.unshift({ x: this.x, y: this.y });
        if (this.trail.length > 10) this.trail.pop();

        this.x += this.dx;
        this.y += this.dy;

        // Wall collisions
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.dx = -this.dx;
            return 'wall';
        }
        if (this.x + this.radius > canvasWidth) {
            this.x = canvasWidth - this.radius;
            this.dx = -this.dx;
            return 'wall';
        }
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.dy = -this.dy;
            return 'wall';
        }
        
        // Out of bounds (Bottom)
        if (this.y + this.radius > canvasHeight) {
            return 'lost';
        }

        return null;
    }

    draw(ctx) {
        // Draw trail
        this.trail.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.radius * (1 - i/10), 0, Math.PI * 2);
            ctx.fillStyle = this.isFireball ? `rgba(255, 100, 0, ${0.5 - i/20})` : `rgba(0, 242, 255, ${0.5 - i/20})`;
            ctx.fill();
        });

        // Draw ball
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isFireball ? '#ff4e00' : '#ffffff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.isFireball ? '#ff4e00' : '#00f2ff';
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

export function checkCollision(ball, rect) {
    const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height));

    const distanceX = ball.x - closestX;
    const distanceY = ball.y - closestY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

    if (distanceSquared < (ball.radius * ball.radius)) {
        // Find which side was hit
        const overlapX = ball.radius - Math.abs(distanceX);
        const overlapY = ball.radius - Math.abs(distanceY);

        if (overlapX < overlapY) {
            ball.dx = -ball.dx;
            ball.x += (distanceX > 0 ? overlapX : -overlapX);
        } else {
            ball.dy = -ball.dy;
            ball.y += (distanceY > 0 ? overlapY : -overlapY);
        }
        return true;
    }
    return false;
}
