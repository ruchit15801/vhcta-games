require("./IDrawable.js");
require("./Vector.js");

/**
 * Creates a new Rectangle object.
 * @constructor
 * @struct
 * @implements IDrawable
 * @param {!number} width
 * @param {!number} height
 * @param {Vector=} position
 * @returns {Rectangle}
 */
function Rectangle(width, height, position) {
	/**
	 * Specifies the position of the Rectangle.
	 * @type Vector
	 */
	this.position = position || new Vector();

	/**
	 * Specifies the width of the Rectangle.
	 * @type !number
	 */
	this.width = width;

	/**
	 * Specifies the height of the Rectangle.
	 * @type !number
	 */
	this.height = height;
}

/**
 * Returns a new copy of this rectangle.
 * @returns {Rectangle}
 */
Rectangle.prototype.clone = function() {
	return new Rectangle(this.width, this.height, this.position.clone());
};

/**
 * Calculates a vector which represents a point at top left corner of
 * the rectangle.
 * @returns {Vector}
 */
Rectangle.prototype.getMin = function() {
	return this.position.clone();
};

/**
 * Calculates a vector which represents a point at the bottom right corner
 * of the rectangle.
 * @returns {Vector}
 */
Rectangle.prototype.getMax = function() {
	return new Vector(this.position.x + this.width, this.position.y + this.height);
};

/**
 * Centers the rectangle on the given position.
 * @param {Vector=} position The new position. If null, centers on current position.
 * @returns {Rectangle}
 */
Rectangle.prototype.centerOnPosition = function(position) {
	position = position || this.position;

	var xOffset = this.width / 2;
	var yOffset = this.height / 2;
	this.position = new Vector(position.x - xOffset, position.y - yOffset);
	return this;
};

/**
 * Draws the object.
 * @param {CanvasRenderingContext2D} context
 * @returns {undefined}
 */
Rectangle.prototype.draw = function(context) {
	context.strokeRect(this.position.x, this.position.y, this.width, this.height);
};

/**
 * Determines whether this Rectangle collides with the given rectangle.
 * @param {Rectangle} rectangle
 * @returns {!boolean}
 */
Rectangle.prototype.collidesWith = function(rectangle) {
	// Calculate min and max vectors.
	var minA = this.getMin();
	var maxA = this.getMax();	
	var minB = rectangle.getMin();
	var maxB = rectangle.getMax();

	return (maxA.x > minB.x && maxA.y > minB.y) &&
		(maxB.x > minA.x && maxB.y > minA.y);
};

/**
 * Determines whether this rectangle is completely enclosed by the given rectangle.
 * @param {Rectangle} rectangle
 * @returns {!boolean}
 */
Rectangle.prototype.isInside = function(rectangle) {
	// Calculate min and max vectors.
	var minA = this.getMin();
	var maxA = this.getMax();	
	var minB = rectangle.getMin();
	var maxB = rectangle.getMax();

	return (minA.x > minB.x && minA.y > minB.y) &&
		(maxA.x < maxB.x && maxA.y < maxB.y);
};

window.Rectangle = Rectangle;
