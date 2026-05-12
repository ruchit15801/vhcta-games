// CONFIGURABLE GAME OPTIONS
// changing these values will affect gameplay
 
export const GameOptions : any = {

    // game canvas size and color
    game : {

        // width of the game, in pixels
        width : 1080,

        // height of the game, in pixels
        height : 1920,

        // game background color
        bgColor : 0x444444
    },

    // Box2D related options
    Box2D : {

        // gravity, in meters per second squared
        gravity : 10,

        // pixels per meters
        worldScale : 120
    },

    // bar properties
    bar : {

        // bar width, in pixels
        width : 1000,

        // bar height, in pixels
        height : 40,

        // bar Y start coordinate, in pixels
        startY : 1800,

        // rotation speed, in degrees per second
        speed : 45
    },

    // ball radius, in pixels
    ballRadius : 25,

    // goal to be reached, with position and diameter
    goal : {
        x : 540,
        y : 200,
        diameter : 256
    },

    // deadly holes, with position and diameter
    holes : [{
        x : 730,
        y : 600,
        diameter : 150
    },
    {
        x : 350,
        y : 600,
        diameter : 150
    },
    {
        x : 730,
        y : 1400,
        diameter : 150
    },
    {
        x : 350,
        y : 1400,
        diameter : 150
    },
    {
        x : 880,
        y : 1000,
        diameter : 100
    },
    {
        x : 200,
        y : 1000,
        diameter : 100
    },{
        x : 540,
        y : 1000,
        diameter : 200
    }]
}