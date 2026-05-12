// engine.js - Core Game Loop, Input, and Render Systems

const GAME_STATES = {
    MENU: 0,
    HOWTO: 1,
    PLAYING: 2,
    PAUSED: 3,
    LEVEL_COMPLETE: 4,
    GAME_OVER: 5
};

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.width = 0;
        this.height = 0;
        this.lastTime = 0;
        this.state = GAME_STATES.MENU;
        
        // Input
        this.keys = {};
        this.joystick = { active: false, x: 0, y: 0, angle: 0, magnitude: 0 };
        
        // Systems
        this.particles = [];
        this.entities = [];
        this.maze = null;
        
        this.camera = { x: 0, y: 0 };
        
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Keyboard
        window.addEventListener('keydown', (e) => { this.keys[e.key] = true; });
        window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });
        
        // Touch / Joystick
        this.setupJoystick();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    setupJoystick() {
        const zone = document.getElementById('joystick-zone');
        const stick = document.getElementById('joystick-stick');
        const base = document.getElementById('joystick-base');
        let stickRadius = 20;
        let maxRadius = 40;

        const handleTouch = (e) => {
            e.preventDefault();
            if (this.state !== GAME_STATES.PLAYING) return;
            
            let touch = e.targetTouches[0];
            if (!touch) {
                // Touch ended
                this.joystick.active = false;
                this.joystick.x = 0;
                this.joystick.y = 0;
                stick.style.transform = `translate(0px, 0px)`;
                stick.classList.remove('active');
                return;
            }

            this.joystick.active = true;
            stick.classList.add('active');

            let rect = base.getBoundingClientRect();
            let centerX = rect.left + rect.width / 2;
            let centerY = rect.top + rect.height / 2;
            
            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            
            let distance = Math.hypot(dx, dy);
            let angle = Math.atan2(dy, dx);
            
            if (distance > maxRadius) {
                dx = Math.cos(angle) * maxRadius;
                dy = Math.sin(angle) * maxRadius;
                distance = maxRadius;
            }

            stick.style.transform = `translate(${dx}px, ${dy}px)`;
            
            // Normalized inputs (-1 to 1)
            this.joystick.x = dx / maxRadius;
            this.joystick.y = dy / maxRadius;
            this.joystick.angle = angle;
            this.joystick.magnitude = distance / maxRadius;
        };

        zone.addEventListener('touchstart', handleTouch, {passive: false});
        zone.addEventListener('touchmove', handleTouch, {passive: false});
        zone.addEventListener('touchend', handleTouch);
        zone.addEventListener('touchcancel', handleTouch);
    }

    getInput() {
        let dx = 0, dy = 0;
        
        // Keyboard mapping
        if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) dy -= 1;
        if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) dy += 1;
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) dx -= 1;
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) dx += 1;
        
        // Joystick override
        if (this.joystick.active) {
            // Apply deadzone
            if (this.joystick.magnitude > 0.2) {
                dx = this.joystick.x;
                dy = this.joystick.y;
            }
        }
        
        // Normalize vector to prevent faster diagonal movement
        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            dx /= len;
            dy /= len;
        }

        return { x: dx, y: dy };
    }

    addParticle(x, y, color, speed, size, life) {
        this.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * speed,
            vy: (Math.random() - 0.5) * speed,
            color,
            size: Math.random() * size + 2,
            life,
            maxLife: life
        });
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * (dt/16);
            p.y += p.vy * (dt/16);
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    drawParticles() {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'lighter';
        for (let p of this.particles) {
            const alpha = p.life / p.maxLife;
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x - this.camera.x, p.y - this.camera.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }
}

const engine = new GameEngine();
