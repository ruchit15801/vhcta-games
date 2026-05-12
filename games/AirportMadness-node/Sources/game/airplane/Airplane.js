require("../../gameEngine/Vector.js");
require("../../gameEngine/Rectangle.js");
require("../../gameEngine/Sprite.js");
require("../../gameEngine/MathUtility.js");

/**
 * Creates an airplane object.
 * @constructor
 * @struct
 * @implements GameObject
 * @returns {Airplane}
 */
function Airplane() {
	/**
	 * The size of the gap squared between the paths.
	 * @protected
	 * @type number
	 */
	this._pathGapSize2 = 100; // 10^2

	/**
	 * The position of the airplane.
	 * @protected
	 * @type Vector
	 */
	this._position = new Vector();

	/**
	 * The velocity of the airplane.
	 * @protected
	 * @type Vector
	 */
	this._velocity = new Vector().setPolar(MathUtility.randomAngle(), 0.5);

	/**
	 * The speed at which the airplane turns.
	 * @protected
	 * @type number
	 */
	this._turnSpeed = 0.002;

	/**
	 * 
	 * @type Sprite
	 */
	this._glow = new Sprite("img/glow.png");

	/**
	 * The hitbox of the airplane.
	 * @protected
	 * @type Rectangle
	 */
	this._hitbox = new Rectangle(25, 25);

	/**
	 * An array of vector representing the path the airplane is to follow.
	 * @protected
	 * @type Array.<Vector>
	 */
	this._path = [];

	/**
	 * 
	 * @type boolean
	 */
	this.crashed = false;

	/**
	 * The area where the airplane is allowed to roam.
	 * @type Rectangle
	 */
	this.roamingArea = new Rectangle(800, 570, new Vector(0, 30));

	/**
	 * The score this airplane is worth.
	 * @type number
	 */
	this.score = 0;
}

/**
 * Returns the distance the target squared or null if there is no target.
 * (Caution: ensure _getCurrentTarget() is not null before using this method).
 * @private
 * @returns {number}
 */
Airplane.prototype._getDistanceToTarget2 = function() {
	/** @type Vector */
	var target = this._getCurrentTarget().clone();

	/** @type Vector */
	var position = this._position.clone();

	// target - position = distance
	return target.addVector(position.reverse()).getLength2();
};

/**
 * Gets the next target for the airplane.
 * @private
 * @returns {Vector}
 */
Airplane.prototype._getCurrentTarget = function() {
	if (this._path.length > 0) {
		return this._path[0];
	}
	else {
		return null;
	}
};

/**
 * Gets the lastest target for the airplane.
 * @private
 * @returns {Vector}
 */
Airplane.prototype._getLastTarget = function() {
	var length = this._path.length;
	
	if (length > 0) {
		return this._path[length - 1];
	}
	else {
		return null;
	}
};

/**
 * Gets the velocity of the airplane.
 * @returns {Vector}
 */
Airplane.prototype.getVelocity = function() {
	return this._velocity.clone();
};

/**
 * Clears the path array.
 * @returns {undefined}
 */
Airplane.prototype.clearPath = function() {
	this._path = [];
};

/**
 * Adds a path to the airplane.
 * @param {Vector} target
 * @returns {undefined}
 */
Airplane.prototype.addTarget = function(target) {
	var last = this._getLastTarget();

	if ((last === null 
		|| Vector.getDistanceBetween2(last, target) > this._pathGapSize2)
		&& target.toRectangle().isInside(this.roamingArea)) {
		this._path.push(target);
	}
};

/**
 * 
 * @param {CanvasRenderingContext2D} context
 * @returns {undefined}
 */
Airplane.prototype.drawGlow = function(context) {
	var position = this._position.clone();
	position.x -= 25;
	position.y -= 25;
	this._glow.draw(context, position);
};

/**
 * Returns the hitbox.
 * @returns {Rectangle}
 */
Airplane.prototype.getHitbox = function() {
	return this._hitbox.clone();
};

/** 
 * @returns {Vector}
 */
Airplane.prototype.getPosition = function() {
	return this._position.clone();
};

/**
 * Sets the airplane position.
 * @param {Vector} position
 * @returns {Airplane}
 */
Airplane.prototype.setPosition = function(position) {
	this._position = position;
	return this;
};

/**
 * Updates the state of the airplane.
 * @param {GameTime} gameTime
 * @returns {undefined}
 */
Airplane.prototype.update = function(gameTime) {
	var elapsed = gameTime.getElapsed();

	if (this.crashed) {
		return;
	}

	// Check if airplane is inside roaming area.
	if (!this._hitbox.isInside(this.roamingArea)) {
		var min = this.roamingArea.getMin();
		var max = this.roamingArea.getMax();
		var position = this._position;
		var velocity = this._velocity;

		// Check horizontal boundaries.
		if ((position.x < min.x && velocity.x < 0) ||
			(position.x > max.x && velocity.x > 0)) {
			velocity.x *= -1;
		}

		// Check vertical boundaries.
		if ((position.y < min.y && velocity.y < 0) ||
			(position.y > max.y && velocity.y > 0)) {
			velocity.y *= -1;
		}
	}

	// Check if airplane has a path to follow.
	if (this._path.length > 0) {			
		if (this._hitbox.collidesWith(this._getCurrentTarget().toRectangle())) {
			// Pop current path from array if distance is small.
			this._path.shift();
		}
		else {
			// Calculate cross product between velocity and target path.
			var target = this._getCurrentTarget();
			var path = target.clone().addVector(this._position.clone().reverse());
			var cross = this._velocity.cross(path);

			// Check if cross product is within rotation deadzone.
			if (Math.abs(cross) > 0.025) {
				// Rotate velocity to the direction of the cross product.
				var direction = cross > 0 ? 1 : -1;
				this._velocity.rotate(this._turnSpeed * elapsed * direction);
			}
		}
	}

	// Update position.
	this._position.addVector(this._velocity.clone().scale(elapsed));

	// Update hitbox position.
	this._hitbox.centerOnPosition(this._position);
};

/**
 * Draws the airplane.
 * @param {CanvasRenderingContext2D} context
 * @returns {undefined}
 */
Airplane.prototype.draw = function(context) {
	context.save();

	if (DEBUG) {
		this._hitbox.draw(context);
	}

	var length = this._path.length;

	// Draw path lines.
	if (length > 0) {		
		context.globalAlpha = 0.5;
		context.beginPath();
		context.strokeStyle = "#990000";
		context.moveTo(this._position.x, this._position.y);

		for (var i = 0; i < length; i++) {
			/** @type Vector */
			var vector = this._path[i];
			context.lineTo(vector.x, vector.y);
			
			if (DEBUG) {
				vector.toRectangle(2, 2).centerOnPosition().draw(context);
			}
		}
		context.stroke();
	}
	context.restore();
};

window.Airplane = Airplane;
