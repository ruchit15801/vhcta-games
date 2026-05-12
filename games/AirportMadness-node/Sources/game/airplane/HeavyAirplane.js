require("./Airplane.js");

/**
 * Creates a heavy airplane object.
 * @constructor
 * @struct
 * @extends Airplane
 * @returns {HeavyAirplane}
 */
function HeavyAirplane() {
	// Base constructor.
	Airplane.call(this);

	/**
	 * The origin of the sprite.
	 * @protected
	 * @type Vector
	 */
	this._origin = new Vector(20, 18.5);

	/**
	 * The sprite of the airplane.
	 * @protected
	 * @type Sprite
	 */
	this._sprite = new Sprite("img/heavy.png", this._origin);

	/**
	 * The velocity of the airplane.
	 * @protected
	 * @type Vector
	 */
	this._velocity = new Vector().setPolar(MathUtility.randomAngle(), 0.035);

	/**
	 * The speed at which the airplane turns.
	 * @protected
	 * @type number
	 */
	this._turnSpeed = 0.0025;

	/**
	 * The hitbox of the airplane.
	 * @protected
	 * @type Rectangle
	 */
	this._hitbox = new Rectangle(25, 25);

	this.score = 100;
}

// Airplane Inheretance.
HeavyAirplane.prototype = new Airplane();
HeavyAirplane.prototype.base_draw = Airplane.prototype.draw;

/**
 * Draws the heavy airplane.
 * @override
 * @param {CanvasRenderingContext2D} context
 * @returns {undefined}
 */
HeavyAirplane.prototype.draw = function(context) {
	this.base_draw(context);
	this._sprite.draw(context, this._position, this._velocity.getAngle());
};

window.HeavyAirplane = HeavyAirplane;