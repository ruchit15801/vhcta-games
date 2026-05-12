/**
 * Defines useful constants and methods for math.
 * @struct
 */
var MathUtility = {
	/**
	 * Represents the ratio of a circle's circumference to its radius.
	 * (Approx. 6.283). 
	 * @constant
	 * @type !number
	 */
	TAU: Math.PI * 2,

	/**
	 * Represents half the value of PI. (Approx. 1.571).
	 * @constant
	 * @type !number
	 */
	HALF_PI: Math.PI / 2,

	/**
	 * Represents an angle pointing right.
	 * @constant
	 * @type !number
	 */
	ANGLE_RIGHT: 0,

	/**
	 * Represents an angle pointing down.
	 * @constant
	 * @type !number
	 */
	ANGLE_DOWN: Math.PI * (1 / 2),

	/**
	 * Represents an angle pointing left.
	 * @constant
	 * @type !number
	 */
	ANGLE_LEFT: Math.PI,

	/**
	 * Represents an angle pointing up.
	 * @constant
	 * @type !number
	 */
	ANGLE_UP: Math.PI * (3 / 2),

	/**
	 * Returns the remainder of the division of the two given numbers.
	 * @param {!number} dividend
	 * @param {!number} divisor
	 * @returns {!number}
	 */
	mod: function(dividend, divisor) {
		if (dividend > 0) {
			return dividend % divisor;
		}
		else {
			return ((dividend % divisor) + divisor) % divisor;
		}
	},

	/**
	 * Returns a random number representing an angle in radians.
	 * @returns {!number}
	 */
	randomAngle: function() {
		return Math.random() * MathUtility.TAU;
	}
};

window.MathUtility = MathUtility;
