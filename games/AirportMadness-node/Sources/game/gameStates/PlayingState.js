require("./IGameState.js");
require("../PointText.js");

/**
 * @constructor
 * @struct
 * @class PlayingState
 * @implements IGameState
 */
function PlayingState() {
	/**
	 * The UI sprite.
	 * @private
	 * @type Sprite
	 */
	this._ui = new Sprite("img/ui.png");

	/**
	 * The position of the UI sprite.
	 * @private
	 * @type Vector
	 */
	this._uiPosition = new Vector(0, 0);

	/**
	 * The background of the game.
	 * @private
	 * @type Sprite
	 */
	this._background = new Sprite("img/background.png");

	/**
	 * Set of airplanes.
	 * @private
	 * @type Array.<Airplane>
	 */
	this._airplanes = [];

	/**
	 * @private
	 * @type Array.<PointText>
	 */
	this._pointText = [];

	/**
	 * Airport.
	 * @private
	 * @type Airport
	 */
	this._airport = new Airport(new Vector(350, 200));

	/**
	 * The selected airplane.
	 * @private
	 * @type Airplane
	 */
	this._selectedAirplane = null;

	/**
	 * @type GameTime
	 */
	this.gameTime = new GameTime().start();

	/**
	 * @type number
	 */
	this.nextAirplaneTime = 0;

	/**
	 * @type number
	 */
	this.airplaneLanded = 0;

	/**
	 * @type number
	 */
	this.score = 0;

	/**
	 * @type boolean
	 */
	this.gameOver = false;

	/**
	 * @type number
	 */
	this.gameOverExitTime = 0;

	/**
	 * @type Audio
	 */
	this._music = new Audio("sound/game.ogg");
	this._music.volume = 0.8;
}

/**
 * Adds a new airplane to the game.
 * @returns {undefined}
 */
PlayingState.prototype.addAirplane = function() {
	// Only add if there are less than 30.
	if (this._airplanes.length > 30) {
		return;
	}

	/** @type Vector */
	var position;
	
	var randomPosition = (Math.random() * 100) | 0;

	if (randomPosition > 75) {
		position = new Vector(0, 0);
	}
	else if (randomPosition > 50) {
		position = new Vector(0, 600);
	}
	else if (randomPosition > 25) {
		position = new Vector(800, 600);
	}
	else {
		position = new Vector(800, 0);
	}

	var randomAirplane = (Math.random() * 200) | 0;

	if (randomAirplane > 50) {
		this._airplanes.push(new SmallAirplane().setPosition(position));
	}
	else if (randomAirplane > 15) {
		this._airplanes.push(new MediumAirplane().setPosition(position));
	}
	else {
		this._airplanes.push(new HeavyAirplane().setPosition(position));
	}

	this.nextAirplaneTime = this.gameTime.getTotal() + 10000;
};

/**
 * Updates the state of the game.
 * @param {Game} game
 * @returns {IGameState}
 */
PlayingState.prototype.update = function(game) {
	var gameTime = this.gameTime;

	var music = this._music;

	if (this.gameOver) {
		if (this.gameOverExitTime === 0) {
			this.gameOverExitTime = gameTime.getTotal() + 5000;
		}
		else if (this.gameOverExitTime < gameTime.getTotal()) {
			return new MenuState();
		}

		gameTime.update();
		return this;
	}
	else {
		// Loop Music
		if (music.paused) {
			music.play();
		}
	}

	for (var i = 0, length = this._pointText.length; i < length; i++) {
		if (this._pointText[i].finished === true) {
			this._pointText.splice(i, 1);
		}
		else {
			this._pointText[i].update(gameTime);
		}
	}

	if (gameTime.getTotal() > this.nextAirplaneTime) {
		this.addAirplane();
	}

	if (this._airplanes.length > 0) {
		// Handle input.
		var mousePosition = InputMonitor.getMousePosition(game.canvas);

		// Check if user is clicking.
		if (InputMonitor.isKeyPressed(KeyCode.LeftClick)) {
			if (this._selectedAirplane !== null) {
				this._selectedAirplane.addTarget(mousePosition);
			}
		}
		else {
			// Unselect airplane.
			this._selectedAirplane = null;
		}

		// Collision Handling for each airplane.
		for (var i = 0; i < this._airplanes.length; i++) {
			var airplane = this._airplanes[i];

			// Check if airplane has landed.
			if (this._airport.inLandingArea(airplane)) {

				(new Audio("sound/score.ogg")).play();

				this._pointText.push(new PointText(this._airplanes[i].score.toString(),
					this._airplanes[i].getPosition()));

				this.airplaneLanded++;
				this.score += this._airplanes[i].score;
				this._airplanes.splice(i, 1);

				continue;
			}

			// Check for collision with other airplanes.
			for (var j = i + 1, length = this._airplanes.length; j < length; j++) {
				if (airplane.getHitbox().collidesWith(this._airplanes[j].getHitbox())) {
					//airplane._velocity = new Vector(0, 0);
					airplane.clearPath();
					airplane.crashed = true;

					var crashedAirplane = this._airplanes[j];

					//this._airplanes[j]._velocity = new Vector(0, 0);
					crashedAirplane.clearPath();
					crashedAirplane.crashed = true;

					music.pause();
					this.gameOver = true;
				}
			}

			// Check if user selects airplane.
			if (this._selectedAirplane === null
				&& InputMonitor.isKeyPressed(KeyCode.LeftClick)
				&& InputMonitor.getMousePosition(game.canvas)
				.toRectangle().collidesWith(airplane.getHitbox())) {
				
				airplane.clearPath();
				this._selectedAirplane = airplane;
			}

			airplane.update(gameTime);
		}
	}
	else {
		// Add airplane to the game if there are no airplanes.
		this.addAirplane();
	}

	gameTime.update();

	return this;
};

/**
 * Draws the current game.
 * @param {Game} game
 * @returns {undefined}
 */
PlayingState.prototype.draw = function(game) {
	/** @type CanvasRenderingContext2D */
	var context = game.context;

	context.save();

	// Draw grass background.
	this._background.draw(context, new Vector());

	// Draw airport.
	this._airport.draw(context);

	if (this._selectedAirplane !== null) {
		/** @type Airplane */
		var airplane = this._selectedAirplane;
		//airplane.getPosition().toRectangle(20, 20).draw(context);
		airplane.drawGlow(context);
	}

	// Draw airplanes.
	for (var i = 0, length = this._airplanes.length; i < length; i++) {
		this._airplanes[i].draw(context);
	}

	for (var i = 0, length = this._pointText.length; i < length; i++) {
		this._pointText[i].draw(context);
	}

	// Draw UI.
	this._ui.draw(context, this._uiPosition);

	// Draw UI text.
	context.fillStyle = "#000000";
	context.font = "10px Verdana";
	context.textAlign = "end";
	context.fillText(this.airplaneLanded.toString(),
		this._uiPosition.x + 155, this._uiPosition.y + 18, 30);
	context.fillText(this.score.toString(),
		this._uiPosition.x + 345, this._uiPosition.y + 18, 30);

	if (this.gameOver) {
		context.fillStyle = "#ffffff";
		context.font = "bold 100px Verdana";
		context.textAlign = "center";
		context.fillText("Game Over", 400, 300);
		context.strokeText("Game Over", 400, 300);
	}

	context.restore();
};

window.PlayingState = PlayingState;
