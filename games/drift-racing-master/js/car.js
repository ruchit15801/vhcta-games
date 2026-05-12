class Car {
    constructor(x, y, isAI = false, carData = null) {
        this.x = x;
        this.y = y;
        this.isAI = isAI;
        this.angle = -Math.PI / 2; // Pointing up
        this.vx = 0;
        this.vy = 0;
        this.mass = 1200;
        
        const data = carData || CAR_CATALOG[0];

        // Base Stats
        this.stats = {
            acceleration: data.stats.acceleration,
            braking: data.stats.braking,
            maxSpeed: data.stats.maxSpeed,
            handling: data.stats.handling,
            driftControl: data.stats.driftControl,
            turnSpeed: data.stats.turnSpeed
        };
        
        this.input = { gas: false, brake: false, steer: 0, handbrake: false };
        this.isDrifting = false;
        this.slipAngle = 0;
        this.driftQuality = 0; // 0 to 1
        
        // Effects
        this.skidmarks = [];
        this.particles = [];
        this.color = isAI ? '#ff0055' : data.color;
        
        // Scoring
        this.score = 0;
        this.combo = 1;
        this.driftDuration = 0;
        
        this.enginePowerMultiplier = 1.0;
    }

    update(dt, mapDetails) {
        Physics.calculateForces(this, mapDetails, dt);
        
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        // Scoring Logic
        if (this.isDrifting && speed > 5) {
            this.driftDuration += dt;
            const angleScore = Math.abs(this.slipAngle) * 10;
            const points = (angleScore * speed * this.combo) * dt;
            if (!this.isAI) {
                this.score += points;
                if (this.driftDuration > 2) this.combo = 2;
                if (this.driftDuration > 5) this.combo = 3;
                if (this.driftDuration > 8) this.combo = 5;
            }
            
            // Add particles (smoke) based on drift quality
            if (Math.random() < this.driftQuality) {
                this.particles.push({
                    x: this.x - Math.cos(this.angle)*20,
                    y: this.y - Math.sin(this.angle)*20,
                    life: 1.0,
                    vx: -this.vx*0.1 + (Math.random()-0.5)*5,
                    vy: -this.vy*0.1 + (Math.random()-0.5)*5,
                    size: 10 + Math.random()*20
                });
            }
            
            // Add skidmarks
            if (this.skidmarks.length === 0 || this.skidmarks[this.skidmarks.length-1].dist > 10) {
                 this.skidmarks.push({ 
                     x1: this.x - Math.cos(this.angle-0.5)*15, y1: this.y - Math.sin(this.angle-0.5)*15,
                     x2: this.x - Math.cos(this.angle+0.5)*15, y2: this.y - Math.sin(this.angle+0.5)*15,
                     life: 1.0, dist: 0 
                 });
            } else {
                this.skidmarks[this.skidmarks.length-1].dist++;
            }
        } else {
            this.driftDuration = 0;
            // Combo drops slowly, but for now we reset
            this.combo = 1;
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt * 0.5;
            p.size += dt * 10;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        
        // Update skidmarks fade
        for (let i = this.skidmarks.length - 1; i >= 0; i--) {
            this.skidmarks[i].life -= dt * 0.1; // 10 seconds fade
            if (this.skidmarks[i].life <= 0) this.skidmarks.splice(i, 1);
        }
    }

    drawSkidmarks(ctx) {
        ctx.lineWidth = 4;
        for (let s of this.skidmarks) {
            ctx.strokeStyle = `rgba(10, 10, 10, ${s.life * 0.5})`;
            ctx.beginPath();
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x1, s.y1+1); // Minimal line for now, better handled with path
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(s.x2, s.y2);
            ctx.lineTo(s.x2, s.y2+1);
            ctx.stroke();
        }
    }

    draw(ctx) {
        // Draw Particles inside shadow layer context ideally, but here works
        for (let p of this.particles) {
            ctx.fillStyle = `rgba(200, 200, 200, ${p.life * 0.3})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Premium 3D shadow effect
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 10;

        // Draw Car Body
        ctx.fillStyle = this.color;
        // Body shape (approximating a sleek sports car)
        ctx.beginPath();
        ctx.roundRect(-25, -12, 50, 24, 6);
        ctx.fill();
        
        // Glow if drifting
        if (this.isDrifting && !this.isAI) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }

        // Roof
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.roundRect(-10, -10, 20, 20, 4);
        ctx.fill();

        // Windshield
        ctx.fillStyle = '#44ffff';
        ctx.beginPath();
        ctx.moveTo(10, -9);
        ctx.lineTo(15, -7);
        ctx.lineTo(15, 7);
        ctx.lineTo(10, 9);
        ctx.closePath();
        ctx.fill();
        
        // Headlights
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.fillRect(22, -10, 3, 5);
        ctx.fillRect(22, 5, 3, 5);

        // Taillights
        ctx.fillStyle = '#ff0000';
        if (this.input.brake) {
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#ff5555';
        } else {
            ctx.shadowColor = 'transparent';
        }
        ctx.beginPath();
        ctx.fillRect(-25, -10, 3, 6);
        ctx.fillRect(-25, 4, 3, 6);

        ctx.restore();
    }
}

const CAR_CATALOG = [
    {
        id: 'car_1',
        name: 'Neon Viper',
        cost: 0,
        color: '#00f3ff',
        stats: { acceleration: 1800, braking: 2500, maxSpeed: 1200, handling: 8.0, driftControl: 1.5, turnSpeed: 3.5 }
    },
    {
        id: 'car_2',
        name: 'Cyber Phantom',
        cost: 2500,
        color: '#bc13fe',
        stats: { acceleration: 2200, braking: 3000, maxSpeed: 1400, handling: 9.0, driftControl: 2.0, turnSpeed: 4.0 }
    },
    {
        id: 'car_3',
        name: 'Drift Emperor',
        cost: 8000,
        color: '#ffdd00',
        stats: { acceleration: 2600, braking: 3500, maxSpeed: 1600, handling: 7.0, driftControl: 2.5, turnSpeed: 4.5 }
    }
];
