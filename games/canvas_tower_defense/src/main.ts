import 'phaser';
import { Tower } from './scripts/Tower';
import { WaveManager } from './scripts/WaveManager';

export class MainScene extends Phaser.Scene {
    private towers!: Phaser.GameObjects.Group;
    private enemies!: Phaser.GameObjects.Group;
    private projectiles!: Phaser.GameObjects.Group;
    private waveManager!: WaveManager;
    private path!: Phaser.Curves.Path;
    
    private money: number = 200;
    private health: number = 10;
    private moneyText!: Phaser.GameObjects.Text;

    constructor() {
        super('MainScene');
    }

    preload() {
        this.load.setBaseURL('./assets/');
        this.load.image('tileset', 'td_fantasy_tileset.png');
        this.load.spritesheet('towers', 'td_towers_spritesheet.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('enemies', 'td_enemies_spritesheet.png', { frameWidth: 64, frameHeight: 64 });
    }

    create() {
        // 1. Setup Path
        this.path = new Phaser.Curves.Path(0, 300);
        this.path.lineTo(200, 300);
        this.path.lineTo(200, 100);
        this.path.lineTo(600, 100);
        this.path.lineTo(600, 500);
        this.path.lineTo(800, 500);

        // Draw Path
        const graphics = this.add.graphics();
        graphics.lineStyle(40, 0x555555, 0.5);
        this.path.draw(graphics);

        // 2. Groups
        this.towers = this.add.group({ runChildUpdate: true });
        this.enemies = this.add.group();
        this.projectiles = this.add.group();

        // 3. Wave Manager
        this.waveManager = new WaveManager(this, this.path, this.enemies);
        this.waveManager.startWave();

        // 4. Input - Place Tower
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.money >= 50) {
                const tower = new Tower(this, pointer.x, pointer.y, 0);
                this.towers.add(tower);
                this.money -= 50;
                this.updateUI();
            }
        });

        // 5. UI
        this.moneyText = this.add.text(10, 10, `Money: ${this.money} | Health: ${this.health}`, { 
            fontSize: '20px', 
            color: '#fff',
            backgroundColor: '#000'
        });
    }

    update(time: number, delta: number) {
        this.waveManager.update(time);
        
        // Custom logic for enemies reaching the end
        this.enemies.children.iterate((c) => {
            const enemy = c as any;
            if (enemy.t >= 1) {
                this.health--;
                enemy.die();
                this.updateUI();
            }
            return true;
        });

        if (this.health <= 0) {
            this.scene.pause();
            this.add.text(400, 300, 'GAME OVER', { fontSize: '64px', color: '#ff0000' }).setOrigin(0.5);
        }
    }

    updateUI() {
        this.moneyText.setText(`Money: ${this.money} | Health: ${this.health}`);
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    scene: MainScene
};

new Phaser.Game(config);
