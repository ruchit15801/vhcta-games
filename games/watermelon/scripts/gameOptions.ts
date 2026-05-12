// CONFIGURABLE GAME OPTIONS
// changing these values will affect gameplay
 
export const GameOptions : any = {

    // local storage name
    localStorageName : 'com.emanueleferonato.mergy',
    
    // maximum size of the ball going to be dropped
    maxStartBallSize : 4,

    // radius and impulse of the blast occurring when to balls merge
    blast : {
        radius : 100,
        impulse : 2
    },

    // idle time after the played droppet the ball
    idleTime : 1000,

    // game field size
    gameField : {
        width : 500,
        height : 700,
        distanceFromBottom : 70
    },

    // Box2D gravity and scale
    Box2D : {
        gravity : 20,
        worldScale : 30
    },

    // bodies
    bodies : [
        {
            size : 30,
            color : 0xf5221c,
            particleSize : 10,
            score : 1
        },
        {
            size : 40,
            color : 0x26e24e,
            particleSize : 20,
            score : 2
        },
        {
            size : 50,
            color : 0xfeec27,
            particleSize : 30,
            score : 3
        },
        {
            size : 60,
            color : 0xff49b2,
            particleSize : 40,
            score : 4
        },
        {
            size : 70,
            color : 0x1ac6f9,
            particleSize : 50,
            score : 5
        },
        {
            size : 80,
            color : 0x7638c8,
            particleSize : 60,
            score : 6
        },
        {
            size : 90,
            color : 0x925f2c,
            particleSize : 70,
            score : 7
        },
        {
            size : 100,
            color : 0xff8504,
            particleSize : 80,
            score : 8
        },
        {
            size : 110,
            color : 0xf2f2f2,
            particleSize : 90,
            score : 9
        },
        {
            size : 120,
            color : 0x888888,
            particleSize : 100,
            score : 10
        },
        {
            size : 130,
            color : 0x2f2f2d,
            particleSize : 100,
            score : 11
        }
    ]
}