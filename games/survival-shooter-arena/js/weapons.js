class Bullet {
    constructor(x, y, angle, speed, damage, color, owner) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.damage = damage;
        this.color = color;
        this.owner = owner; // 'player' or 'enemy'
        this.radius = 4;
        this.toDelete = false;
        this.life = 120; // frames
    }

    update(dt) {
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
        this.life -= 1 * dt;
        if (this.life <= 0) this.toDelete = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        // Bullet Trail
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - Math.cos(this.angle) * 15, this.y - Math.sin(this.angle) * 15);
        ctx.stroke();

        // Bullet Head
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Weapon {
    constructor(config) {
        this.name = config.name || 'Pistol';
        this.fireRate = config.fireRate || 250; // ms
        this.damage = config.damage || 10;
        this.speed = config.speed || 12;
        this.color = config.color || '#00f2ff';
        this.bulletsPerShot = config.bulletsPerShot || 1;
        this.spread = config.spread || 0;
        this.ammo = config.maxAmmo || Infinity;
        this.maxAmmo = config.maxAmmo || Infinity;
        this.reloadTime = config.reloadTime || 1000;
        
        this.lastFire = 0;
        this.isReloading = false;
    }

    canFire() {
        return Date.now() - this.lastFire > this.fireRate && !this.isReloading && this.ammo > 0;
    }

    fire(x, y, angle, owner, bulletArray) {
        if (!this.canFire()) return false;

        this.lastFire = Date.now();
        this.ammo--;

        for (let i = 0; i < this.bulletsPerShot; i++) {
            const shotAngle = angle + (Math.random() - 0.5) * this.spread;
            bulletArray.push(new Bullet(x, y, shotAngle, this.speed, this.damage, this.color, owner));
        }

        if (this.ammo <= 0 && this.maxAmmo !== Infinity) {
            this.reload();
        }

        return true;
    }

    reload() {
        if (this.isReloading) return;
        this.isReloading = true;
        setTimeout(() => {
            this.ammo = this.maxAmmo;
            this.isReloading = false;
        }, this.reloadTime);
    }
}

const Armory = {
    Pistol: () => new Weapon({
        name: 'Pistol',
        fireRate: 300,
        damage: 15,
        speed: 15,
        color: '#00f2ff'
    }),
    Shotgun: () => new Weapon({
        name: 'Shotgun',
        fireRate: 800,
        damage: 10,
        speed: 12,
        color: '#ff00ea',
        bulletsPerShot: 5,
        spread: 0.5,
        maxAmmo: 8,
        reloadTime: 1500
    }),
    MachineGun: () => new Weapon({
        name: 'Uzi',
        fireRate: 100,
        damage: 8,
        speed: 18,
        color: '#39ff14',
        spread: 0.1,
        maxAmmo: 30,
        reloadTime: 1200
    }),
    Laser: () => new Weapon({
        name: 'Plasma Rail',
        fireRate: 500,
        damage: 40,
        speed: 25,
        color: '#ff3131',
        maxAmmo: 5,
        reloadTime: 2000
    })
};

window.Armory = Armory;
window.Bullet = Bullet;
