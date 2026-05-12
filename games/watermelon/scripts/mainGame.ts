// MAIN GAME SCENE

// this class extends Scene class
export class MainGame extends Phaser.Scene {

    constructor() {
        super({
            key : 'MainGame'
        });
    }

    create() : void {

        // how to launch two scenes simultaneously
        this.scene.launch('AnimatedBackground');
        this.scene.launch('PlayGame');
    }
}