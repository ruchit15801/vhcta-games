require("./IGameState.js");

/**
 * @constructor
 * @struct
 * @class HowToPlayState
 * @implements IGameState
 */
function HowToPlayState() {
	this.menuSprite = new Sprite("img/HTP.png");
	this.mainMenu = new Rectangle(140, 30, new Vector(330, 545));
}

/**
 * @param {Game} game
 * @returns {IGameState}
 */
HowToPlayState.prototype.update = function(game) {
	if (InputMonitor.isKeyPressed(KeyCode.LeftClick)) {
		var mouse = InputMonitor.getMousePosition(game.canvas).toRectangle();
		if (mouse.collidesWith(this.mainMenu)) {
			InputMonitor.clear();
			return new MenuState();
		}
	}
	return this;
};

/**
 * @param {Game} game
 * @returns {undefined}
 */
HowToPlayState.prototype.draw = function(game) {
	var context = game.context;

	this.menuSprite.draw(context, new Vector());

	if (DEBUG) {
		this.mainMenu.draw(context);
	}
};

window.HowToPlayState = HowToPlayState;
