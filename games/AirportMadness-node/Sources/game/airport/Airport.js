require("../../gameEngine/GameObject.js");
require("../../gameEngine/Sprite.js");
require("../../gameEngine/Vector.js");

/**
 * @constructor
 * @struct
 * @implements GameObject
 * @param {!Vector} position
 * @returns {Airport}
 */
function Airport(position) {
	/**
	 * The position of the airport.
	 * @private
	 * @type Vector
	 */
	this._position = position;

	/**
	 * The sprite of the airport
	 * @private
	 * @type Sprite
	 */
	this._sprite = new Sprite("img/airport1.png");

	/**
	 * An array of rectangle representing the area where an airplane can land.
	 * @private
	 * @type Array.<Rectangle>
	 */
	this._landingArea = [
		new Rectangle(40, 200, new Vector(-5, 0))
	];
}

/**
 * Determines whether an airplane is in the landing area of the airport.
 * @param {Airplane} airplane
 * @returns {boolean}
 */
Airport.prototype.inLandingArea = function(airplane) {
	for (var i = 0, length = this._landingArea.length; i < length; i++) {
		/** @type Rectangle */
		var area = this._landingArea[i].clone();
		area.position.addVector(this._position);

		if (airplane.getHitbox().isInside(area)) {
			
			// Calculate landing direction.
			var landingAngle = area.width > area.height ?
				new Vector(1, 0) : new Vector(0, 1);
			
			// Calculate angle difference.
			var crossProduct = landingAngle.cross(airplane.getVelocity());

			// True if the airplane is at the right angle.
			return Math.abs(crossProduct) < 0.0015;
		}
	}
	return false;
};

/**
 * Updates the state of the airport.
 * @param {GameTime} gameTime
 * @returns {undefined}
 */
Airport.prototype.update = function(gameTime) { };

/**
 * Draws the airport.
 * @param {CanvasRenderingContext2D} context
 * @returns {undefined}
 */
Airport.prototype.draw = function(context) {
	this._sprite.draw(context, this._position);

	if (DEBUG) {
		// Draw landing areas.
		for (var i = 0, length = this._landingArea.length; i < length; i++) {
			var area = this._landingArea[i].clone();
			area.position.addVector(this._position);
			area.draw(context);
		}
	}
};

window.Airport = Airport;
