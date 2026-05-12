require("./airplane/SmallAirplane.js");
require("./airplane/MediumAirplane.js");
require("./airplane/HeavyAirplane.js");
require("./airport/Airport.js");
require("./../gameEngine/InputMonitor.js");
require("./gameStates/PlayingState.js");
require("./gameStates/HowToPlayState.js");
require("./gameStates/MenuState.js");

/**
 * @constructor
 * @struct
 * @param {HTMLCanvasElement} canvas
 * @returns {Game}
 */
function Game(canvas) {
	/** @type HTMLCanvasElement */
	this.canvas = canvas;
	
	/** @type CanvasRenderingContext2D */
	this.context =
		/** @type CanvasRenderingContext2D */
		(this.canvas.getContext("2d"));
	
	/** @type IGameState */
	this.gameState = new MenuState();

	// Initialization
	InputMonitor.initialize();
}

/**
 * Updates the state of the game.
 * @returns {undefined}
 */
Game.prototype.update = function() {
	this.gameState = this.gameState.update(this);
};

/**
 * Draws the current game.
 * @returns {undefined}
 */
Game.prototype.draw = function() {
	this.gameState.draw(this);
};

window.Game = Game;
