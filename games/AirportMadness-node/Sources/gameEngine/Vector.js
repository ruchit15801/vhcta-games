require("./MathUtility.js");
require("./Rectangle.js");

/**
 * Creates a new vector object.
 * @constructor
 * @struct
 * @param {!number=} x
 * @param {!number=} y
 * @returns {Vector}
 */
function Vector(x, y) {
	/**
	 * The x component.
	 * @type !number
	 */
	this.x = x || 0;

	/**
	 * The y component.
	 * @type !number
	 */
	this.y = y || 0;
}

/**
 * Gets the distance between the given vectors.
 * @param {Vector} A
 * @param {Vector} B
 * @returns {number}
 */
Vector.getDistanceBetween = function(A, B) {
	return Math.sqrt(Vector.getDistanceBetween2(A, B));
};

/**
 * Gets the distance squared between the given vectors.
 * @param {Vector} A
 * @param {Vector} B
 * @returns {number}
 */
Vector.getDistanceBetween2 = function(A, B) {
	var x = A.x - B.x;
	var y = A.y - B.y;

	return x * x + y * y;
};

/**
 * Sets the x and y components of the vector to match that of the polar value.
 * If a value is null, the current value will be used to calculate. (Pipe).
 * @param {?number} angle
 * @param {?number} length
 * @returns {Vector}
 */
Vector.prototype.setPolar = function(angle, length) {
	if (angle === null) {
		angle = this.getAngle();
	}

	if (length === null) {
		length = this.getLength();
	}

	this.x = length * Math.cos(angle);
	this.y = length * Math.sin(angle);

	return this;
};

/**
 * Adds the given vector to this vector. (Pipe).
 * @param {Vector} vector
 * @returns {Vector}
 */
Vector.prototype.addVector = function(vector) {
	this.x += vector.x;
	this.y += vector.y;

	return this;
};

/**
 * Calculates the angle of the vector.
 * @returns {!number}
 */
Vector.prototype.getAngle = function() {
	return Math.atan2(this.y, this.x);
};

/**
 * Sets the angle of the vector.
 * @param {!number} angle
 * @returns {Vector}
 */
Vector.prototype.setAngle = function(angle) {
	return this.setPolar(angle, null);
};

/**
 * Calculates the length of the vector.
 * @returns {!number}
 */
Vector.prototype.getLength = function() {
	return Math.sqrt(this.getLength2());
};

/**
 * Calculates the length of the vector squared.
 * (Avoids Math.sqrt() overhead. Useful for condition checks). 
 * @returns {!number}
 */
Vector.prototype.getLength2 = function() {
	return this.x * this.x + this.y * this.y;
};

/**
 * Sets the length of the vector.
 * @param {!number} length
 * @returns {Vector}
 */
Vector.prototype.setLength = function(length) {	
	return this.setPolar(null, length);
};

/**
 * Scales the vector by the given factor. (Pipe).
 * @param {!number} factor
 * @returns {Vector}
 */
Vector.prototype.scale = function(factor) {
	this.x *= factor;
	this.y *= factor;

	return this;
};

/**
 * Returns the length of the z-component of the cross product with given vector.
 * @param {Vector} vector
 * @returns {!number}
 */
Vector.prototype.cross = function(vector) {
	return (this.x * vector.y) - (this.y * vector.x);
};

/**
 * Returns the dot product with the given vector.
 * @param {Vector} vector
 * @returns {!number}
 */
Vector.prototype.dot = function(vector) {
	return (this.x * vector.x) + (this.y * vector.y);
};

/**
 * Find the angle between this and the given vector.
 * @param {Vector} vector
 * @returns {!number}
 */
Vector.prototype.getAngleBetween = function(vector) {
	var lengthProduct = this.getLength() * vector.getLength();

	return Math.acos(this.dot(vector)/lengthProduct);
};

/**
 * Normalizes this vector (makes the length equal to 1).
 * @returns {Vector}
 */
Vector.prototype.normalize = function() {
	var length = this.getLength();

	this.x = this.x / length;
	this.y = this.y / length;

	return this;
};

/**
 * Rotates the vector by the given angle. (Pipe).
 * @param {!number} angle
 * @returns {Vector}
 */
Vector.prototype.rotate = function(angle) {
	return this.setAngle(this.getAngle() + angle);
};

/**
 * Returns a new copy of this vector.
 * @returns {Vector}
 */
Vector.prototype.clone = function() {
	return new Vector(this.x, this.y);
};

/**
 * Reverses the vector. (Pipe).
 * @returns {Vector}
 */
Vector.prototype.reverse = function() {
	this.x *= -1;
	this.y *= -1;

	return this;
};

/**
 * Returns a rectangle representation of this vector.
 * @param {!number=} width
 * @param {!number=} height
 * @returns {Rectangle}
 */
Vector.prototype.toRectangle = function(width, height) {
	return new Rectangle(width || 0, height || 0, this.clone());
};

window.Vector = Vector;
