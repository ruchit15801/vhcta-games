require("./IGameState.js");

/**
 * @constructor
 * @struct
 * @class GameOverState
 */
function GameOverState() { }

/**
 * @param {Game} game
 * @returns {IGameState}
 */
GameOverState.prototype.update = function(game) { };

/**
 * @param {Game} game
 * @returns {undefined}
 */
GameOverState.prototype.draw = function(game) { };

window.GameOverState = GameOverState;
