require("./IGameState.js");

/**
 * @constructor
 * @struct
 * @class MenuState
 * @implements IGameState
 */
function MenuState() {
	this.menuSprite = new Sprite("img/Menu.png");
	this.newGameArea = new Rectangle(140, 30, new Vector(330, 362));
	this.howToPlayArea = new Rectangle(140, 30, new Vector(330, 412));
	this.credits = new Rectangle(140, 30, new Vector(330, 466))
}

/**
 * @param {Game} game
 * @returns {IGameState}
 */
MenuState.prototype.update = function(game) {
	if (InputMonitor.isKeyPressed(KeyCode.LeftClick)) {
		var mouse = InputMonitor.getMousePosition(game.canvas).toRectangle();

		if (mouse.collidesWith(this.newGameArea)) {
			InputMonitor.clear();
			return new PlayingState();
		}
		if (mouse.collidesWith(this.howToPlayArea)) {
			InputMonitor.clear();
			return new HowToPlayState();
		}
		if (mouse.collidesWith(this.credits)) {
			alert("Made by Marcos López C.");
			InputMonitor.clear();
		}
	}

	return this;
};

/**
 * @param {Game} game
 * @returns {undefined}
 */
MenuState.prototype.draw = function(game) {
	var context = game.context;

	this.menuSprite.draw(context, new Vector());

	if (DEBUG) {
		this.newGameArea.draw(context);
		this.howToPlayArea.draw(context);
		this.credits.draw(context);
	}
};

window.MenuState = MenuState;
