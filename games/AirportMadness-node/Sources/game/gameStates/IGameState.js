require("../Game.js");

/**
 * @interface
 */
function IGameState() {}

/**
 * 
 * @param {Game} game
 * @returns {IGameState}
 */
IGameState.prototype.update = function(game) {};

/**
 * 
 * @param {Game} game
 * @returns {undefined}
 */
IGameState.prototype.draw = function(game) {};

window.IGameState = IGameState;
