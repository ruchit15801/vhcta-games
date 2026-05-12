// CLASS TO PRELOAD ASSETS

// this class extends Scene class
export class PreloadAssets extends Phaser.Scene {
  
    // constructor    
    constructor() {
        super({
            key : 'PreloadAssets'
        });
    }
  
    // method to be called during class preloading
    preload() : void {
 
        // this is how to load images
        this.load.image('ball', 'assets/sprites/ball.png');
        this.load.image('bar', 'assets/sprites/bar.png');
        this.load.image('background', 'assets/sprites/background.png');
        this.load.image('hole', 'assets/sprites/hole.png');
        this.load.image('goal', 'assets/sprites/goal.png');
        this.load.image('flag', 'assets/sprites/flag.png');
    }
  
    // method to be called once the instance has been created
    create() : void {
 
        // call PlayGame scene
        this.scene.start('PlayGame');
    }
}