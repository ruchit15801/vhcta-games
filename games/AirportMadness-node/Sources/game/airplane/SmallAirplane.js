require("./Airplane.js");

/**
 * Creates a small airplane object.
 * @constructor
 * @struct
 * @extends Airplane
 * @returns {SmallAirplane}
 */
function SmallAirplane() {
	// Base constructor.
	Airplane.call(this);

	/**
	 * The origin of the sprite.
	 * @protected
	 * @type Vector
	 */
	this._origin = new Vector(10, 15);

	/**
	 * The sprite of the airplane.
	 * @protected
	 * @type Sprite
	 */
	this._sprite = new Sprite("img/small.png", this._origin);

	/**
	 * The velocity of the airplane.
	 * @protected
	 * @type Vector
	 */
	this._velocity = new Vector().setPolar(MathUtility.randomAngle(), 0.01);

	/**
	 * The speed at which the airplane turns.
	 * @protected
	 * @type number
	 */
	this._turnSpeed = 0.0015;

	/**
	 * The hitbox of the airplane.
	 * @protected
	 * @type Rectangle
	 */
	this._hitbox = new Rectangle(20, 20);

	this.score = 10;
}

// Airplane Inheretance.
SmallAirplane.prototype = new Airplane();
SmallAirplane.prototype.base_draw = Airplane.prototype.draw;

/**
 * Draws the small airplane.
 * @override
 * @param {CanvasRenderingContext2D} context
 * @returns {undefined}
 */
SmallAirplane.prototype.draw = function(context) {
	this.base_draw(context);
	this._sprite.draw(context, this._position, this._velocity.getAngle());
};

window.SmallAirplane = SmallAirplane;
