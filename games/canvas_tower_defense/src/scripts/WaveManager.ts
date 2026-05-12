import 'phaser';
import { Enemy } from './Enemy';

export class WaveManager {
    private scene: Phaser.Scene;
    private path: Phaser.Curves.Path;
    private enemyGroup: Phaser.GameObjects.Group;
    
    public currentWave: number = 1;
    private spawnTimer: number = 0;
    private enemiesToSpawn: number = 0;
    private spawnRate: number = 1000;

    constructor(scene: Phaser.Scene, path: Phaser.Curves.Path, enemyGroup: Phaser.GameObjects.Group) {
        this.scene = scene;
        this.path = path;
        this.enemyGroup = enemyGroup;
    }

    startWave() {
        this.enemiesToSpawn = 5 + (this.currentWave * 2);
        this.spawnRate = Math.max(200, 1000 - (this.currentWave * 50));
    }

    update(time: number) {
        if (this.enemiesToSpawn > 0 && time > this.spawnTimer) {
            this.spawnEnemy();
            this.enemiesToSpawn--;
            this.spawnTimer = time + this.spawnRate;
        }

        if (this.enemiesToSpawn === 0 && this.enemyGroup.getLength() === 0) {
            // Wave complete logic could go here
        }
    }

    private spawnEnemy() {
        const hp = 20 + (this.currentWave * 10);
        const enemy = new Enemy(this.scene, this.path, 0, 0, hp);
        this.enemyGroup.add(enemy);
        enemy.startFollow({
            duration: 10000,
            rotateToPath: true
        });
    }
}
