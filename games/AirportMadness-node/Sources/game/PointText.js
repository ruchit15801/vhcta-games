require("../gameEngine/GameObject.js");

/**
 * @constructor
 * @struct
 * @class PointText
 * @implements GameObject
 * @param {string} text
 * @param {Vector} position
 */
function PointText(text, position) {
	/** @type string */
	this.text = text;

	/** @type boolean */
	this.finished = false;

	/** @type Vector */
	this.position = position;

	/** @type number */
	this.alpha = 1;

	/** @type Vector */
	this.velocity = new Vector(0, -0.04);
}

/**
 * Updates the state of the game object.
 * @param {GameTime} gameTime
 * @returns {undefined}
 */
PointText.prototype.update = function(gameTime) {
	if (this.finished) {
		return;
	}

	this.position.addVector(this.velocity.clone().scale(gameTime.getElapsed()));

	if (this.alpha < 0) {
		this.finished = true;
	}
	else {
		this.alpha -= 0.002 * gameTime.getElapsed();
		
		if (this.alpha < 0) {
			this.alpha = 0;
		}
	}
};

/**
 * Draws the object.
 * @param {CanvasRenderingContext2D} context
 * @returns {undefined}
 */
PointText.prototype.draw = function(context) {
	context.save();

	context.globalAlpha = this.alpha;
	context.fillStyle = "#ccffcc";
	context.textAlign = "center";
	context.font = "bold 30px Arial";

	context.fillText(this.text, this.position.x, this.position.y);
	context.strokeText(this.text, this.position.x, this.position.y);
	
	context.restore();
};

window.PointText = PointText;
