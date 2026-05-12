import 'phaser';
import { Enemy } from './Enemy';

/**
 * Tower class for Tower Defense
 */
export class Tower extends Phaser.GameObjects.Sprite {
    public range: number;
    public damage: number;
    public fireRate: number;
    public cost: number;
    public level: number;
    private nextFire: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, frame: number) {
        super(scene, x, y, 'towers', frame);
        this.scene = scene;
        this.range = 150;
        this.damage = 10;
        this.fireRate = 1000; // ms
        this.level = 1;
        this.cost = 50;

        scene.add.existing(this);
    }

    upgrade() {
        this.level++;
        this.damage += 5;
        this.range += 10;
        this.fireRate = Math.max(200, this.fireRate - 50);
        this.setFrame(this.frame.name + 4); // Switch to 'gold' version frame
    }

    fire(target: Enemy, projectiles: Phaser.GameObjects.Group) {
        // Logic to spawn a projectile targeting the enemy
        // To be implemented in Projects.ts
    }

    update(time: number, enemies: Phaser.GameObjects.Group, projectiles: Phaser.GameObjects.Group) {
        if (time < this.nextFire) return;

        // Simple targeting: find closest enemy in range
        let target = this.findTarget(enemies);
        if (target) {
            this.fire(target, projectiles);
            this.nextFire = time + this.fireRate;
        }
    }

    private findTarget(enemies: Phaser.GameObjects.Group): Enemy | null {
        let closest: Enemy | null = null;
        let minDist = this.range;

        enemies.children.iterate((c) => {
            const enemy = c as Enemy;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (dist < minDist) {
                minDist = dist;
                closest = enemy;
            }
            return true;
        });

        return closest;
    }
}
