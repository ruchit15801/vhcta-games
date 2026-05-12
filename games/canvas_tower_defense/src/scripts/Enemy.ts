import 'phaser';

/**
 * Enemy class for Tower Defense
 */
export class Enemy extends Phaser.GameObjects.PathFollower {
    public hp: number;
    public maxHp: number;
    public moneyValue: number;
    private hpBar: Phaser.GameObjects.Graphics;

    constructor(scene: Phaser.Scene, path: Phaser.Curves.Path, x: number, y: number, hp: number) {
        super(scene, path, x, y, 'enemies', 0);
        this.scene = scene;
        this.hp = hp;
        this.maxHp = hp;
        this.moneyValue = 10;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.hpBar = scene.add.graphics();
        this.updateHpBar();
    }

    updateHpBar() {
        this.hpBar.clear();
        this.hpBar.fillStyle(0x000000);
        this.hpBar.fillRect(this.x - 20, this.y - 35, 40, 5);
        this.hpBar.fillStyle(0xff0000);
        this.hpBar.fillRect(this.x - 20, this.y - 35, 40 * (this.hp / this.maxHp), 5);
    }

    damage(amount: number) {
        this.hp -= amount;
        this.updateHpBar();
        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        this.hpBar.destroy();
        this.destroy();
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);
        this.updateHpBar();
    }
}
