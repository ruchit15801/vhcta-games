require("./Vector.js");
require("./Rectangle.js");

/**
 * Creates a new sprite object.
 * @constructor
 * @struct
 * @param {string} imagePath A path to the image.
 * @param {Vector=} origin The origin of the sprite (used for position and rotation).
 * @returns {Sprite}
 */
function Sprite(imagePath, origin) {
	/**
	 * The image used to render.
	 * @private
	 * @type HTMLImageElement
	 */
	this._image = new Image();
	this._image.src = imagePath; // Note: setting the image path.

	/** @type Vector */
	this.origin = origin || new Vector();
}

/**
 * Determines if the sprite is loaded and ready to be used.
 * @returns {boolean}
 */
Sprite.prototype.isLoaded = function() {
	// Image width is 0 until the image is loaded.
	return this._image.width !== 0;
};

/**
 * Gets the width of the sprite.
 * @returns {number}
 */
Sprite.prototype.getWidth = function() {
	return this._image.width;
};

/**
 * Gets the height of the sprite.
 * @returns {number}
 */
Sprite.prototype.getHeight = function() {
	return this._image.height;
};

/**
 * Centers the origin of the sprite. (Pipe).
 * @returns {Sprite}
 */
Sprite.prototype.centerOrigin = function() {
	this.origin.x = this.getWidth() * 0.5;
	this.origin.y = this.getHeight() * 0.5;
	return this;
};

/**
 * Draws the entire sprite to the given context. (Pipe).
 * @param {CanvasRenderingContext2D} context
 * @param {Vector} position The position to draw the sprite.
 * @param {number=} rotation The angle to rotate the sprite about its origin.
 * @param {Vector=} scale The scale factor.
 * @returns {Sprite}
 */
Sprite.prototype.draw =	function(context, position, rotation, scale) {
	context.save();

	context.translate(position.x, position.y);

	if (rotation) {
		context.rotate(rotation);
	}

	if (scale) {
		context.scale(scale.x, scale.y);
	}

	context.drawImage(this._image, 0 - this.origin.x, 0 - this.origin.y);

	context.restore();

	return this;
};

/**
 * Draws a clip from the sprite to the given context. (Pipe).
 * @param {CanvasRenderingContext2D} context
 * @param {Rectangle} clip
 * @param {Vector} position
 * @param {number=} rotation
 * @param {Vector=} scale
 * @returns {Sprite}
 */
Sprite.prototype.drawClip =	function(context, clip, position, rotation, scale) {
	context.save();

	context.translate(position.x, position.y);

	if (rotation) {
		context.rotate(rotation);
	}

	if (scale) {
		context.scale(scale.x, scale.y);
	}

	context.drawImage(this._image,
		clip.position.x, clip.position.y,
		clip.width, clip.height,
		this.origin.x, this.origin.y,
		clip.width, clip.height);

	context.restore();

	return this;
};

window.Sprite = Sprite;
