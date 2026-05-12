// THE ANIMATED BACKGROUND

// this class extends Scene class
export class AnimatedBackground extends Phaser.Scene {

    constructor() {
        super({
            key : 'AnimatedBackground'
        });
    }

    create() : void {
        
        // place a big tilesprite
        const background : Phaser.GameObjects.TileSprite = this.add.tileSprite(0, -128, this.game.config.width as number + 128, this.game.config.height as number + 128, 'background');
        background.setOrigin(0);
            
        // slowly continuously tween the tilesprite, then place it in its original position, repeat forever
        this.tweens.add({
            targets : background,
            x : -128,
            y : 0,
            duration : 5000,
            onComplete : () => {
                background.setPosition(0, -128);
            },
            repeat : -1
        })    
    }
}