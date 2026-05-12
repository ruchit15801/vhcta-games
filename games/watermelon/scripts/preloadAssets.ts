// CLASS TO PRELOAD ASSETS

// this class extends Scene class
export class PreloadAssets extends Phaser.Scene {

    // constructor    
    constructor() {
        super({
            key: 'PreloadAssets'
        });
    }

    // method to be called during class preloading
    preload(): void {

        // Setup Loading Bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        this.load.on('progress', (value: number) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
        });

        // this is how to load an image
        this.load.image('ball', 'assets/sprites/ball.png');
        this.load.image('background', 'assets/sprites/background.png');
        this.load.image('angle', 'assets/sprites/angle.png');
        this.load.image('line', 'assets/sprites/line.png');
        this.load.image('vertical', 'assets/sprites/vertical.png');
        this.load.image('panel', 'assets/sprites/panel.png');
        this.load.image('crown', 'assets/sprites/crown.png');

        // this is how to load a sprite sheet
        this.load.spritesheet('faces', 'assets/sprites/faces.png', {
            frameWidth: 45,
            frameHeight: 25
        });

        // this is how to load a bitmap font
        this.load.bitmapFont('font', 'assets/fonts/font.png', 'assets/fonts/font.fnt');

    }

    // method to be called once the instance has been created
    create(): void {

        // call MainGameScene
        this.scene.start('MainGame');
    }
}