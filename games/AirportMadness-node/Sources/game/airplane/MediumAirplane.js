require("./Airplane.js");

/**
 * Creates a medium airplane object.
 * @constructor
 * @struct
 * @extends Airplane
 * @returns {MediumAirplane}
 */
function MediumAirplane() {
	// Base constructor.
	Airplane.call(this);

	/**
	 * The origin of the sprite.
	 * @protected
	 * @type Vector
	 */
	this._origin = new Vector(20, 17);

	/**
	 * The sprite of the airplane.
	 * @protected
	 * @type Sprite
	 */
	this._sprite = new Sprite("img/medium.png", this._origin);

	/**
	 * The velocity of the airplane.
	 * @protected
	 * @type Vector
	 */
	this._velocity = new Vector().setPolar(MathUtility.randomAngle(), 0.02);

	/**
	 * The speed at which the airplane turns.
	 * @protected
	 * @type number
	 */
	this._turnSpeed = 0.001;

	/**
	 * The hitbox of the airplane.
	 * @protected
	 * @type Rectangle
	 */
	this._hitbox = new Rectangle(25, 25);

	this.score = 50;
}

// Airplane Inheretance.
MediumAirplane.prototype = new Airplane();
MediumAirplane.prototype.base_draw = Airplane.prototype.draw;

/**
 * Draws the medium airplane.
 * @override
 * @param {CanvasRenderingContext2D} context
 * @returns {undefined}
 */
MediumAirplane.prototype.draw = function(context) {
	this.base_draw(context);
	this._sprite.draw(context, this._position, this._velocity.getAngle());
};

window.MediumAirplane = MediumAirplane;