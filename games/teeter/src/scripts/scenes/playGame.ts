// THE GAME ITSELF

// modules to import
import Planck, { Box, Circle } from 'planck';
import { toMeters, toPixels } from '../planckUtils';
import { GameOptions } from '../gameOptions';

// enum to represent bar side
enum barSide {
    LEFT,
    RIGHT,
    NONE
}

// this class extends Scene class
export class PlayGame extends Phaser.Scene {

    constructor() {
        super({
            key : 'PlayGame'
        });
    }

    world : Planck.World;           // the Box2D world  
    liftingSide : barSide;          // the lifting side of the bar
    bar : Planck.Body;              // the bar   
    ball : Planck.Body;             // the ball           

    // method to be called once the instance has been created
    create() : void {

        // add background
        this.add.tileSprite(0, 0, this.game.config.width as number, this.game.config.height as number, 'background').setOrigin(0);

        // when we start playing, no bar side is lifting
        this.liftingSide = barSide.NONE;

        // create a Box2D world with gravity
        this.world = new Planck.World(new Planck.Vec2(0, GameOptions.Box2D.gravity));

        // place holes
        GameOptions.holes.forEach((hole : any) => {
            this.add.sprite(hole.x, hole.y, 'hole').setDisplaySize(hole.diameter, hole.diameter);
        });

        // place goal hole
        this.add.sprite(GameOptions.goal.x, GameOptions.goal.y, 'hole').setDisplaySize(GameOptions.goal.diameter, GameOptions.goal.diameter);
        this.add.sprite(GameOptions.goal.x, GameOptions.goal.y, 'goal').setDisplaySize(GameOptions.goal.diameter, GameOptions.goal.diameter);
        this.add.sprite(GameOptions.goal.x, GameOptions.goal.y, 'flag');

        // set bar and ball sprites
        const barSprite : Phaser.GameObjects.TileSprite = this.add.tileSprite(this.game.config.width as number / 2, GameOptions.bar.startY, GameOptions.bar.width, GameOptions.bar.height, 'bar');
        const ballSprite : Phaser.GameObjects.Sprite = this.add.sprite(this.game.config.width as number / 2, GameOptions.bar.startY - GameOptions.bar.height / 2 - GameOptions.ballRadius, 'ball');
        ballSprite.setDisplaySize(GameOptions.ballRadius * 2, GameOptions.ballRadius * 2);

        // create the bar kinematic body
        this.bar = this.world.createKinematicBody({
            position : new Planck.Vec2(toMeters(barSprite.x), toMeters(barSprite.y))
        })

        // attach a fixture to bar body
        this.bar.createFixture({
            shape : new Box(toMeters(GameOptions.bar.width / 2), toMeters(GameOptions.bar.height / 2)),
            density : 1,
            friction : 0,
            restitution : 0
        })

        // set custom bar body user data
        this.bar.setUserData({
            sprite : barSprite
        })

        // create ball dynamic body
        this.ball = this.world.createDynamicBody({
            position : new Planck.Vec2(toMeters(ballSprite.x), toMeters(ballSprite.y))    
        })
        
        // attach a fixture to ball body
        this.ball.createFixture({
            shape : new Circle(toMeters(GameOptions.ballRadius)),
            density : 1,
            friction : 0,
            restitution : 0
        })
        
        // set custom ball body user data
        this.ball.setUserData({
            sprite : ballSprite
        })

        // listener waiting for pointer to be down (pressed)
        this.input.on('pointerdown', (pointer : Phaser.Input.Pointer) => {

            // check lifting side according to pointer x position
            this.liftingSide = Math.floor(pointer.x / (this.game.config.width as number / 2));       
        });

        // listener waiting for pointer to be up (released)
        this.input.on('pointerup', (pointer : Phaser.Input.Pointer) => {

            // bar is not lifting
            this.liftingSide = barSide.NONE;      
        })
    }

    // method to be executed at each frame
    // totalTime : time, in milliseconds, since the game started
    // deltaTime : time, in milliseconds, passed since previous "update" call
    update(totalTime : number, deltaTime : number) : void {  
        
        // advance world simulation
        this.world.step(deltaTime / 1000, 10, 8);
        this.world.clearForces();

        // do we have to lift the bar?
        if (this.liftingSide != barSide.NONE) {

            // determine delta angle
            const deltaAngle : number = Phaser.Math.DegToRad(GameOptions.bar.speed) * deltaTime / 1000;

            // given the angle, determine bar movement
            const barMovement : number = toMeters((GameOptions.bar.width / 2) * Math.sin(deltaAngle));
            
            // get bar position
            const barPosition : Planck.Vec2 = this.bar.getPosition();

            // set new bar angle according to lifting side
            this.bar.setAngle(this.bar.getAngle() + deltaAngle * (this.liftingSide == barSide.LEFT ? 1 : -1));

            // set new bar position
            this.bar.setPosition(new Planck.Vec2(barPosition.x, barPosition.y - barMovement));
        }

        // loop through all bodies
        for (let body : Planck.Body = this.world.getBodyList() as Planck.Body; body; body = body.getNext() as Planck.Body) {
   
            // get body user data
            const userData : any = body.getUserData();

            // get body position
            const bodyPosition : Planck.Vec2 = body.getPosition();

            // get body angle
            const bodyAngle : number = body.getAngle();

            // update sprite position and rotation accordingly
            userData.sprite.setPosition(toPixels(bodyPosition.x), toPixels(bodyPosition.y));
            userData.sprite.setRotation(bodyAngle);
        }

        // determine ball position
        const ballPosition : Planck.Vec2 = this.ball.getPosition();

        // restart if the ball flies off the screen
        if (ballPosition.x < 0 || toPixels(ballPosition.x) > GameOptions.game.width || toPixels(ballPosition.y) > GameOptions.game.height) {
            this.scene.start('PlayGame');    
        }

        // check if the player is inside a hole
        GameOptions.holes.forEach((hole : any) => {

            // determine distance between ball and hole center
            const distance : number = Phaser.Math.Distance.Between(hole.x, hole.y, toPixels(ballPosition.x), toPixels(ballPosition.y));
            
            // consider the ball to be inside a hole when ball center is inside the hole,
            // this means when the distance is less than hole radius
            if (distance < hole.diameter / 2) {
                this.scene.start('PlayGame');
            }    
        });

        // determine distance between ball and hole center
        const distance : number = Phaser.Math.Distance.Between(GameOptions.goal.x, GameOptions.goal.y, toPixels(ballPosition.x), toPixels(ballPosition.y));
            
        // consider the ball to be inside the goal when ball center is inside the goal,
        // this means when the distance is less than goal radius
        if (distance < GameOptions.goal.diameter / 2) {
            this.scene.start('PlayGame');
        }    
    }  
}