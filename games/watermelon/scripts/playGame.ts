// THE GAME ITSELF

import Planck from 'planck';
import { toMeters, toPixels } from './planckUtils';
import { GameOptions } from './gameOptions';
import { getLocalStorage, setLocalStorage, deleteLocalStorage } from './storageUtils';

// body type, can be a ball or a wall
enum bodyType {
    BALL,
    WALL
}

// game state, can be idle (nothing to do), moving (when you move the ball) or gameover, when the game is over
enum gameState {
    IDLE,
    MOVING,
    GAMEOVER
}

// this class extends Scene class
export class PlayGame extends Phaser.Scene {

    constructor() {
        super({
            key : 'PlayGame'
        });
    }

    world : Planck.World;                                       // physics world
    contactManagement : any[];                                  // array to store all contacts
    savedData : any;                                            // data retrieved from local storage / to save on local storage
    config : any;                                               // configuration object
    ballsAdded : number;                                        // amount of balls added
    currentBallValue : number;                                  // current ball value
    score : number;                                             // score
    nextBallValue : number;                                     // next ball value      
    ids : number[];                                             // array with all ball ids
    emitters : Phaser.GameObjects.Particles.ParticleEmitter[];  // array with all particle emitters
    dummyBalls : Phaser.GameObjects.Sprite[];                   // array with all dummy balls
    nextBallValueSprites : Phaser.GameObjects.Sprite[];         // array with all sprites showing 'next' ball
    currentState : gameState;                                   // current game state
    scoreText : Phaser.GameObjects.BitmapText;                  // score bitmap text
    bestScoreText : Phaser.GameObjects.BitmapText;              // best score bitmap text
    objectPool : any[];                                         // object pool

    // method to be called once the instance has been created
    create() : void {

        // default object to save in local storage
        const defaultObject : any = {
            bestScore : 0
        }  

        // initialize local storage
        this.savedData = getLocalStorage(GameOptions.localStorageName, defaultObject);

        // initialize global variables
        this.ids = [];
        this.ballsAdded = 0;
        this.contactManagement = [];
        this.emitters = [];   
        this.dummyBalls = [];
        this.nextBallValueSprites = [];
        this.objectPool = [];
        this.currentState = gameState.MOVING;
        this.currentBallValue = Phaser.Math.Between(0, GameOptions.maxStartBallSize);
        this.nextBallValue = Phaser.Math.Between(0, GameOptions.maxStartBallSize);
        this.score = 0;

        // build particle emitters
        this.buildEmitters();
       
        // create a Box2D world with gravity
        this.world = new Planck.World(new Planck.Vec2(0, GameOptions.Box2D.gravity));

        // set some variables to build walls and various stuff
        const baseStartX : number = this.game.config.width as number / 2 - GameOptions.gameField.width / 2;
        const baseEndX : number = baseStartX + GameOptions.gameField.width;
        const baseStartY : number = this.game.config.height as number - GameOptions.gameField.distanceFromBottom;
        const baseEndY : number = baseStartY - GameOptions.gameField.height;
        const leftPanelCenter : number = baseStartX / 2;
        const rightPanelCenter : number = baseEndX + leftPanelCenter;
        const leftPanelWidth : number = 400;

        // Box2D polygon where to make ball fall into
        this.createPolygon(baseStartX, baseStartY, baseEndX, baseEndY);

        // score panel
        this.add.nineslice(leftPanelCenter, 100, 'panel', 0, leftPanelWidth, 120, 33, 33, 33, 33);
        this.scoreText = this.add.bitmapText(leftPanelCenter + 180, 132, 'font', '0', 90);
        this.scoreText.setOrigin(1)
        this.scoreText.setTint(0x3d3d3d);

        // best score panel
        this.add.nineslice(rightPanelCenter, 100, 'panel', 0, leftPanelWidth, 120, 33, 33, 33, 33);
        this.bestScoreText = this.add.bitmapText(rightPanelCenter + 180, 132, 'font', this.savedData.bestScore.toString(), 90);
        this.bestScoreText.setOrigin(1)
        this.bestScoreText.setTint(0x3d3d3d);
        this.add.sprite(rightPanelCenter - leftPanelWidth / 2 + 15, 100, 'crown').setOrigin(0, 0.5).setTint(0x3d3d3d);

        // "next" panel
        this.add.nineslice(leftPanelCenter, 200, 'panel', 0, leftPanelWidth, 150 + GameOptions.bodies[GameOptions.maxStartBallSize].size * 2, 33, 33, 33, 33).setOrigin(0.5, 0);
        this.add.bitmapText(leftPanelCenter, 210, 'font', 'NEXT', 90).setTint(0x3d3d3d).setOrigin(0.5, 0);

        // game field
        this.add.tileSprite(baseStartX, baseStartY, GameOptions.gameField.width, 50, 'line').setOrigin(0);
        this.add.sprite(baseStartX - 32, baseStartY, 'angle').setOrigin(0);
        this.add.sprite(baseEndX, baseStartY, 'angle').setOrigin(0).setFlipX(true);
        this.add.tileSprite(baseStartX - 32, baseEndY, 32, GameOptions.gameField.height, 'vertical').setOrigin(0);
        this.add.tileSprite(baseEndX, baseEndY, 32, GameOptions.gameField.height, 'vertical').setOrigin(0);
        this.add.rectangle(baseStartX, baseEndY, GameOptions.gameField.width, GameOptions.gameField.height, 0x000000, 0.5).setOrigin(0);

        // create dummy and "next" balls. These aren't physics bodies, just sprites to be moved according to user input
        for (let i : number = 0; i <= GameOptions.maxStartBallSize; i ++) {
            const ball : Phaser.GameObjects.Sprite =  this.add.sprite(baseStartX, baseEndY - GameOptions.bodies[i].size, 'ball');
            ball.setAlpha(0.7);
            ball.setVisible(false);
            ball.setDisplaySize(GameOptions.bodies[i].size * 2, GameOptions.bodies[i].size  * 2);
            ball.setTint(GameOptions.bodies[i].color);
            this.dummyBalls.push(ball);
            const nextBallValue : Phaser.GameObjects.Sprite =  this.add.sprite(leftPanelCenter, 320 + GameOptions.bodies[GameOptions.maxStartBallSize].size, 'ball');
            nextBallValue.setVisible(false);
            nextBallValue.setTint(GameOptions.bodies[i].color);
            nextBallValue.setDisplaySize(GameOptions.bodies[i].size * 2, GameOptions.bodies[i].size  * 2);
            this.nextBallValueSprites.push(nextBallValue);
        }
        this.dummyBalls[this.currentBallValue].setVisible(true);
        this.nextBallValueSprites[this.nextBallValue].setVisible(true);

        // when the player releases the input...
        this.input.on('pointerup', (pointer : Phaser.Input.Pointer) => {
            
            // are we moving?
            if (this.currentState == gameState.MOVING) {

                // hide dummy ball
                this.dummyBalls[this.currentBallValue].setVisible(false);

                // create a new physics ball
                this.createBall(Phaser.Math.Clamp(pointer.x, baseStartX + GameOptions.bodies[this.currentBallValue].size, baseEndX - GameOptions.bodies[this.currentBallValue].size), baseEndY - GameOptions.bodies[this.currentBallValue].size, this.currentBallValue);
                
                // set the game state to IDLE
                this.currentState = gameState.IDLE; 

                // wait some time before adding a new ball
                this.time.addEvent({
                    delay: GameOptions.idleTime,
                    callback: (() => {
                        this.currentState = gameState.MOVING;
                        this.currentBallValue = this.nextBallValue;
                        this.nextBallValue = Phaser.Math.Between(0, GameOptions.maxStartBallSize);
                        this.dummyBalls[this.currentBallValue].setVisible(true);
                        this.nextBallValueSprites[this.currentBallValue].setVisible(false);
                        this.nextBallValueSprites[this.nextBallValue].setVisible(true);
                        this.dummyBalls[this.currentBallValue].setX(Phaser.Math.Clamp(pointer.x, baseStartX + GameOptions.bodies[this.currentBallValue].size, baseEndX - GameOptions.bodies[this.currentBallValue].size));
                    })
                })   
            }
        }, this);

        // when the player moves the input
        this.input.on('pointermove', (pointer : Phaser.Input.Pointer) => {
            if (this.currentState == gameState.MOVING) {
                this.dummyBalls[this.currentBallValue].setX(Phaser.Math.Clamp(pointer.x, baseStartX + GameOptions.bodies[this.currentBallValue].size, baseEndX - GameOptions.bodies[this.currentBallValue].size));
            }
        })

        // this is the collision listener used to process contacts
        this.world.on('pre-solve', (contact : Planck.Contact) => {

            // get both bodies user data
            const userDataA : any = contact.getFixtureA().getBody().getUserData();
            const userDataB : any = contact.getFixtureB().getBody().getUserData();

            // get the contact point
            const worldManifold : Planck.WorldManifold = contact.getWorldManifold(null) as Planck.WorldManifold;
            const contactPoint : Planck.Vec2Value = worldManifold.points[0] as Planck.Vec2Value;

            // three nested "if" just to improve readability, to check for a collision we need:
            // 1 - both bodies must be balls
            if (userDataA.type == bodyType.BALL && userDataB.type == bodyType.BALL) {
                
                // 2 - both balls must have the same value
                if (userDataA.value == userDataB.value) {

                    // 3 - balls ids must not be already present in the array of ids 
                    if (this.ids.indexOf(userDataA.id) == -1 && this.ids.indexOf(userDataB.id) == -1) {
                        
                        // add bodies ids to ids array
                        this.ids.push(userDataA.id)
                        this.ids.push(userDataB.id)

                        // add a contact management item with both bodies to remove, the contact point, the new value of the ball and both ids
                        this.contactManagement.push({
                            body1 : contact.getFixtureA().getBody(),
                            body2 : contact.getFixtureB().getBody(),
                            point : contactPoint,
                            value : userDataA.value + 1,
                            id1 : userDataA.id,
                            id2 : userDataB.id
                        })
                    }
                }  
            }
        });
    }

    // method to build emitters
    buildEmitters() : void {

        // loop through each ball
        GameOptions.bodies.forEach((body : any, index : number) => {

            // build particle graphics as a graphic object turned into a sprite
            const particleGraphics : Phaser.GameObjects.Graphics = this.make.graphics({
                x : 0,
                y : 0
            }, false);
            particleGraphics.fillStyle(0xffffff);
            particleGraphics.fillCircle(body.particleSize, body.particleSize, body.particleSize);
            particleGraphics.generateTexture('particle_' + index.toString(), body.particleSize * 2, body.particleSize * 2);

            // create the emitter
            let emitter : Phaser.GameObjects.Particles.ParticleEmitter = this.add.particles(0, 0, 'particle_' + index.toString(), {
                lifespan : 500,
                speed : {
                    min : 0, 
                    max : 50
                },
                scale : {
                    start : 1,
                    end : 0
                },
                emitting : false
            });

            // set the emitter zone as the circle area
            emitter.addEmitZone({
                source : new Phaser.Geom.Circle(0, 0, body.size),
                type : 'random',
                quantity : 1
            });

            // set emitter z-order to 1, to always bring explosions on top
            emitter.setDepth(1);

            // add the emitter to emitters array
            this.emitters.push(emitter)    
        })
    }

    // method to create a physics ball
    createBall(posX : number, posY : number, value : number) : void {

        // define ball and face sprites
        let ballSprite : Phaser.GameObjects.Sprite;
        let faceSprite : Phaser.GameObjects.Sprite;
        
        // should we take them from the pool?
        if (this.objectPool.length > 0) {
            const poolObject : any = this.objectPool.pop();
            ballSprite = poolObject.ball;
            ballSprite.setVisible(true);
            faceSprite = poolObject.face;
            faceSprite.setVisible(true);
        }

        // create them from scratch
        else {
            ballSprite = this.add.sprite(posX, posY, 'ball');
            faceSprite = this.add.sprite(posX, posY, 'faces')  
        }

        // adjust size, tint color and face
        ballSprite.setDisplaySize(GameOptions.bodies[value].size * 2, GameOptions.bodies[value].size  * 2);
        ballSprite.setTint(GameOptions.bodies[value].color);
        const faceFrame : number = Phaser.Math.Between(0, 8);
        faceSprite.setFrame(faceFrame);
        
        // create a dynamic body
        const ball : Planck.Body = this.world.createDynamicBody({
            position : new Planck.Vec2(toMeters(posX), toMeters(posY)),
        });

        console.log(toMeters(posX),posX)

        // attach a fixture to the body
        ball.createFixture({
            shape : new Planck.Circle(toMeters(GameOptions.bodies[value].size)),
            density : 1,
            friction : 0.3,
            restitution : 0.1
        });

        // set some custom user data
        ball.setUserData({
            sprite : ballSprite,
            type : bodyType.BALL,
            value : value,
            id : this.ballsAdded,
            face : faceSprite
        })

        // keep counting how many balls we added so far
        this.ballsAdded ++;

        console.log(ball)
    }

    // method to create a physics polygon
    createPolygon(startX : number, startY : number, endX : number, endY : number) : void {
        
        // create a static body
        const walls : Planck.Body = this.world.createBody({
            position : new Planck.Vec2(toMeters(0), toMeters(0))
        });

        // attach a fixture to the body
        walls.createFixture(Planck.Chain([Planck.Vec2(toMeters(startX), toMeters(endY)), Planck.Vec2(toMeters(startX), toMeters(startY)), Planck.Vec2(toMeters(endX), toMeters(startY)), Planck.Vec2(toMeters(endX), toMeters(endY))]));
        
        // set some custom user data
        walls.setUserData({
            type : bodyType.WALL
        })
    }
   
    // method to destroy a ball
    // ball = the ball to be destroyed
    destroyBall(ball : Planck.Body) : void {

        // get ball user data
        const userData : any = ball.getUserData();

        // hide the sprites
        userData.sprite.setVisible(false);
        userData.face.setVisible(false);

        // place sprites into pool
        this.objectPool.push({
            ball : userData.sprite,
            face : userData.face
        })
      
        // destroy the physics body
        this.world.destroyBody(ball);
        
        // remove body id from ids array
        this.ids.splice(this.ids.indexOf(userData.id), 1);    
    } 

    // method to update the score
    // n = ball from which to compute the score 
    updateScore(n : number) : void {

        // add score according to ball value
        this.score += GameOptions.bodies[n].score;

        // update score text
        this.scoreText.setText(this.score.toString());

        // did the score beat the best score
        if (this.score > this.savedData.bestScore) {

            // update best score into savedData object
            this.savedData.bestScore = this.score;

            // update bestScoreText bitmap text
            this.bestScoreText.setText(this.score.toString());

            // save the local storage
            setLocalStorage(GameOptions.localStorageName, this.savedData);
        }
    }

    // method to be executed at each frame
    // n deltaTime : time, in milliseconds, passed since previous "update" call
    update(totalTime : number, deltaTime : number) : void {  
        
        // advance world simulation
        this.world.step(deltaTime / 1000, 10, 8);
        this.world.clearForces();

        // is there any contact to manage?
        if (this.contactManagement.length > 0) {

            // loop through all contacts
            this.contactManagement.forEach((contact : any) => {

                // set the emitters to explode
                this.emitters[contact.value - 1].explode(50 * contact.value, toPixels(contact.body1.getPosition().x), toPixels(contact.body1.getPosition().y));
                this.emitters[contact.value - 1].explode(50 * contact.value, toPixels(contact.body2.getPosition().x), toPixels(contact.body2.getPosition().y));

                // destroy the balls after some delay, useful to display explosions or whatever
                this.time.addEvent({
                    delay : 10,
                    callback : (() => {
                        this.updateScore(contact.value - 1);
                        this.destroyBall(contact.body1);
                        this.destroyBall(contact.body2);
                    })
                })
                
                // determining blast radius, which is actually a square, but who cares?
                const query : Planck.AABB = new Planck.AABB(
                    new Planck.Vec2(contact.point.x - toMeters(GameOptions.blast.radius), contact.point.y - toMeters(GameOptions.blast.radius)),
                    new Planck.Vec2(contact.point.x + toMeters(GameOptions.blast.radius), contact.point.y + toMeters(GameOptions.blast.radius))
                );

                // query the world for fixtures inside the square, aka "radius"
                this.world.queryAABB(query, (fixture : Planck.Fixture) => {
                    const body : Planck.Body = fixture.getBody();
                    const bodyPosition : Planck.Vec2 = body.getPosition();
                    
                    // just in case you need the body distance from the center of the blast. I am not using it.
                    const bodyDistance : number = Math.sqrt(Math.pow(bodyPosition.x - contact.point.x, 2) + Math.pow(bodyPosition.y - contact.point.y, 2));
                    const angle : number = Math.atan2(bodyPosition.y - contact.point.y, bodyPosition.x - contact.point.x);
                    
                    // the explosion effect itself is just a linear velocity applied to bodies
                    body.setLinearVelocity(new Planck.Vec2(GameOptions.blast.impulse * Math.cos(angle), GameOptions.blast.impulse * Math.sin(angle)));
                    
                    // true = keep querying the world
                    return true;
                });

                // little delay before creating next ball, be used for a spawn animation
                this.time.addEvent({
                    delay: 200,
                    callback: (() => {
                      
                        if (contact.value < GameOptions.bodies.length) {
                            this.createBall(toPixels(contact.point.x), toPixels(contact.point.y), contact.value); 
                        }
                    })
                })       
            })

            // empty contactManagement array
            this.contactManagement = [];
        }

        // loop through all bodies
        for (let body : Planck.Body = this.world.getBodyList() as Planck.Body; body; body = body.getNext() as Planck.Body) {
   
            // get body user data
            const userData : any = body.getUserData();

            // is it a ball?
            if (userData.type == bodyType.BALL) {

                // get body position
                const bodyPosition : Planck.Vec2 = body.getPosition();

                console.log(bodyPosition)

                // get body angle
                const bodyAngle : number = body.getAngle();

                // update sprite position and rotation accordingly
                userData.sprite.setPosition(toPixels(bodyPosition.x), toPixels(bodyPosition.y));
                userData.sprite.setRotation(bodyAngle);
                userData.face.setPosition(toPixels(bodyPosition.x), toPixels(bodyPosition.y));
                userData.face.setRotation(bodyAngle);

                // if a ball falls off the screen...
                const gameHeight : number = this.game.config.height as number
                if ((userData.sprite.y > gameHeight || userData.sprite.y < gameHeight - GameOptions.gameField.distanceFromBottom - GameOptions.gameField.height - 100) && this.currentState != gameState.GAMEOVER) {
                    
                    // ... it's game over
                    this.currentState = gameState.GAMEOVER;

                    // set dummy ball to invisible
                    this.dummyBalls[this.currentBallValue].setVisible(false);

                    // remove all balls with a timer event
                    const gameOverTimer : Phaser.Time.TimerEvent = this.time.addEvent({
                        delay : 100,
                        callback : ((event : Phaser.Time.TimerEvent) => {
                            let body : Planck.Body = this.world.getBodyList() as Planck.Body;
                            const userData : any = body.getUserData();
                            if (userData.type == bodyType.BALL) {
                                this.destroyBall(body)
                            }
                            else {
                                gameOverTimer.remove();

                                // restart game scene
                                this.scene.start('PlayGame')    
                            }
                        }),
                        loop : true
                    })   
                }            
            }
        }
    }  
}