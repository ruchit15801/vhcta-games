(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require("./IDrawable.js");
require("./GameTime.js");

/**
 * A game object.
 * @interface
 * @extends IDrawable
 */
function GameObject() { }

/**
 * Updates the state of the game object.
 * @param {GameTime} gameTime
 * @returns {undefined}
 */
GameObject.prototype.update = function(gameTime) {};

window.GameObject = GameObject;

},{"./GameTime.js":2,"./IDrawable.js":3}],2:[function(require,module,exports){
/**
 * Creates a new GameTime object.
 * @constructor
 * @struct
 * 
 * @returns {GameTime}
 */
function GameTime() {
	/**
	 * The amount of game time since the start of the game.
	 * @private
	 * @type !number
	 */
	this._total = 0;

	/**
	 * The amount of game time since the last update.
	 * @private
	 * @type !number
	 */
	this._elapsed = 0;

	/**
	 * Timestamp of the last update.
	 * @private
	 * @type !number
	 */
	this._lastUpdate = 0;

	/**
	 * The maximun number of milliseconds the game play can be delayed.
	 * @type !number
	 */
	this.maxLatency = 100;
}

/**
 * Starts keeping track of the game time. (Pipe).
 * @returns {GameTime}
 */
GameTime.prototype.start = function() {
	this._lastUpdate = Date.now();
	return this;
};

/**
 * Updates the game time. (Pipe).
 * @returns {GameTime}
 */
GameTime.prototype.update = function() {
	this._total += this._elapsed;
	var now = Date.now();
	var elapsed = now - this._lastUpdate;
	this._elapsed = elapsed < this.maxLatency ? elapsed : this.maxLatency;
	this._lastUpdate = now;

	return this;
};

/**
 * Gets the amount of game time since the last update.
 * @returns {!number}
 */
GameTime.prototype.getElapsed = function() {
	return this._elapsed;
};

/**
 * Gets the total amount of game time since the start of the game.
 * @returns {!number}
 */
GameTime.prototype.getTotal = function() {
	return this._total;
};

window.GameTime = GameTime;

},{}],3:[function(require,module,exports){
/**
 * A drawable object.
 * @interface
 */
function IDrawable() {};

/**
 * Draws the object.
 * @param {CanvasRenderingContext2D} context
 * @returns {undefined}
 */
IDrawable.prototype.draw = function(context) {};

window.IDrawable = IDrawable;

},{}],4:[function(require,module,exports){
require("./KeyCode.js");
require("./Vector.js");

/**
 * Stores the state of input devices for polling.
 * InputMonitor.initialize needs to be called this can be used.
 * @struct
 */
var InputMonitor = {
	/**
	 * Stores the state of the keyboard. Indexed by KeyboardKeyCodeEnum.
	 * (True = Pressed; False = Released).
	 * @private
	 * @type Array.<boolean>
	 */
	_keyState: [],

	/**
	 * Stores the position of the mouse relative to the canvas.
	 * @private
	 * @type Vector
	 */
	_mousePosition: new Vector(),

	/**
	 * Handles keydown events.
	 * @param {Event} e
	 * @returns {undefined}
	 */
	_keydownHandler: function(e) {
		InputMonitor._keyState[e.which] = true;
		e.preventDefault();
		e.stopPropagation();
	},

	/**
	 * Handles keyup events.
	 * @param {Event} e
	 * @returns {undefined}
	 */
	_keyupHandler: function(e) {
		InputMonitor._keyState[e.which] = false;
		e.preventDefault();
		e.stopPropagation();
	},

	/**
	 * Handles mousemove events.
	 * @param {Event} e
	 * @returns {undefined}
	 */
	_mousemoveHandler: function(e) {
		InputMonitor._mousePosition.x = e.clientX;
		InputMonitor._mousePosition.y = e.clientY;
		e.preventDefault();
		e.stopPropagation();
	},

	/**
	 * Handles mousewheel events.
	 * @param {Event} e
	 * @returns {undefined}
	 */
	_mousewheelHandler: function(e) {
		if ((e.wheelDelta || -e.detail) > 0) {
			InputMonitor._keyState[KeyCode.ScrollUp] = true;
		}
		else {
			InputMonitor._keyState[KeyCode.ScrollDown] = true;
		}
		e.preventDefault();
		e.stopPropagation();
	},

	/**
	 * Handles contextmenu events.
	 * @param {Event} e
	 * @returns {undefined}
	 */
	_contextmenuHandler: function(e) {
		e.preventDefault();
		e.stopPropagation();
	},

	clear: function() {
		for (var i = 0; i < 255; i++) {
			InputMonitor._keyState[i] = false;
		}
	},

	/**
	 * Initializes InputMonitor.
	 * @returns {undefined}
	 */
	initialize: function() {
		// Initialize _keyboardState array.
		InputMonitor.clear();

		document.addEventListener("keydown", InputMonitor._keydownHandler, true);
		document.addEventListener("keyup", InputMonitor._keyupHandler, true);
		document.addEventListener("mousemove", InputMonitor._mousemoveHandler, true);
		document.addEventListener("mousedown", InputMonitor._keydownHandler, true);
		document.addEventListener("mouseup", InputMonitor._keyupHandler, true);
		document.addEventListener("contextmenu", InputMonitor._contextmenuHandler, true);
		document.addEventListener("mousewheel", InputMonitor._mousewheelHandler, true);
		document.addEventListener("DOMMouseScroll", InputMonitor._mousewheelHandler, true);
	},

	/**
	 * Returns true if key is being pressed.
	 * @param {KeyCode} key
	 * @returns {!boolean}
	 */
	isKeyPressed: function(key) {
		return InputMonitor._keyState[key];
	},

	/**
	 * Returns true if key is released.
	 * @param {KeyCode} key
	 * @returns {!boolean}
	 */
	isKeyReleased: function(key) {
		return !InputMonitor.isKeyPressed(key);
	},

	/**
	 * Returns the position of the mouse relative to the given element.
	 * If no element is passed, returns position relative to the client area.
	 * @param {HTMLElement=} element
	 * @returns {Vector}
	 */
	getMousePosition: function(element) {
		var position = InputMonitor._mousePosition.clone();
		
		if (element) {
			position.x -= element.offsetLeft;
			position.y -= element.offsetTop;
		}

		return position;
	},
	
	/**
	 * Resets the value of Mouse scroll.
	 * @returns {undefined}
	 */
	resetMouseScroll: function() {
		InputMonitor._keyState[KeyCode.ScrollUp] = false;
		InputMonitor._keyState[KeyCode.ScrollDown] = false;
	}
};

window.InputMonitor = InputMonitor;

},{"./KeyCode.js":5,"./Vector.js":9}],5:[function(require,module,exports){
/**
 * Key codes for Javascript.
 * @enum {number}
 */
var KeyCode = {	
	LeftClick:		1,
	RightClick:		3,
	MiddleClick:	2,

	// Scroll codes are non-standard.
	ScrollUp:		5,
	ScrollDown:		6,

	Backspace:		8,
	Tab:			9,
	Enter:			13,
	Shift:			16,
	Ctrl:			17,
	Alt:			18,
	PauseBreak:		19,
	CapsLock:		20,
	Escape:			27,

	Insert:			45,
	Delete:			46,	
	PageUp:			33,
	PageDown:		34,
	End:			35,
	Home:			36,

	LeftArrow:		37,
	UpArrow:		38,
	RightArrow:		39,
	DownArrow:		40,

	Number0:		48,
	Number1:		49,
	Number2:		50,
	Number3:		51,
	Number4:		52,
	Number5:		53,
	Number6:		54,
	Number7:		55,
	Number8:		56,
	Number9:		57,

	A:				65,
	B:				66,
	C:				67,
	D:				68,
	E:				69,
	F:				70,
	G:				71,
	H:				72,
	I:				73,
	J:				74,
	K:				75,
	L:				76,
	M:				77,
	N:				78,
	O:				79,
	P:				80,
	Q:				81,
	R:				82,
	S:				83,
	T:				84,
	U:				85,
	V:				86,
	W:				87,
	X:				88,
	Y:				89,
	Z:				90,

	LeftWindow:		91,
	RightWindow:	92,
	Menu:			93,

	Numpad0:		96,
	Numpad1:		97,
	Numpad2:		98,
	Numpad3:		99,
	Numpad4:		100,
	Numpad5:		101,
	Numpad6:		103,
	Numpad7:		104,
	Numpad8:		105,
	Numpad9:		106,
	NumpadMultiply:	106,
	NumpadAdd:		107,
	NumpadSubtract:	109,
	NumpadPoint:	110,
	NumpadDivide:	111,

	F1:				112,
	F2:				113,
	F3:				114,
	F4:				115,
	F5:				116,
	F6:				117,
	F7:				118,
	F8:				119,
	F9:				120,
	F10:			121,
	F11:			122,
	F12:			123,

	NumLock:		144,
	ScrollLock:		145,
	SemiColon:		186,
	Equals:			187,
	Comma:			188,
	Dash:			189,
	Period:			190,
	ForwardSlash:	191,
	Tilde:			192,
	OpenBracket:	219,
	BackSlash:		220,
	CloseBracket:	221,
	SingleQuote:	222
};

window.KeyCode = KeyCode;

},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
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

},{"./IDrawable.js":3,"./Vector.js":9}],8:[function(require,module,exports){
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

},{"./Rectangle.js":7,"./Vector.js":9}],9:[function(require,module,exports){
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

},{"./MathUtility.js":6,"./Rectangle.js":7}],10:[function(require,module,exports){
require("./airplane/SmallAirplane.js");
require("./airplane/MediumAirplane.js");
require("./airplane/HeavyAirplane.js");
require("./airport/Airport.js");
require("./../gameEngine/InputMonitor.js");
require("./gameStates/PlayingState.js");
require("./gameStates/HowToPlayState.js");
require("./gameStates/MenuState.js");

/**
 * @constructor
 * @struct
 * @param {HTMLCanvasElement} canvas
 * @returns {Game}
 */
function Game(canvas) {
	/** @type HTMLCanvasElement */
	this.canvas = canvas;
	
	/** @type CanvasRenderingContext2D */
	this.context =
		/** @type CanvasRenderingContext2D */
		(this.canvas.getContext("2d"));
	
	/** @type IGameState */
	this.gameState = new MenuState();

	// Initialization
	InputMonitor.initialize();
}

/**
 * Updates the state of the game.
 * @returns {undefined}
 */
Game.prototype.update = function() {
	this.gameState = this.gameState.update(this);
};

/**
 * Draws the current game.
 * @returns {undefined}
 */
Game.prototype.draw = function() {
	this.gameState.draw(this);
};

window.Game = Game;

},{"./../gameEngine/InputMonitor.js":4,"./airplane/HeavyAirplane.js":13,"./airplane/MediumAirplane.js":14,"./airplane/SmallAirplane.js":15,"./airport/Airport.js":16,"./gameStates/HowToPlayState.js":17,"./gameStates/MenuState.js":19,"./gameStates/PlayingState.js":20}],11:[function(require,module,exports){
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

},{"../gameEngine/GameObject.js":1}],12:[function(require,module,exports){
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

},{"../../gameEngine/MathUtility.js":6,"../../gameEngine/Rectangle.js":7,"../../gameEngine/Sprite.js":8,"../../gameEngine/Vector.js":9}],13:[function(require,module,exports){
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
},{"./Airplane.js":12}],14:[function(require,module,exports){
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
},{"./Airplane.js":12}],15:[function(require,module,exports){
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

},{"./Airplane.js":12}],16:[function(require,module,exports){
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

},{"../../gameEngine/GameObject.js":1,"../../gameEngine/Sprite.js":8,"../../gameEngine/Vector.js":9}],17:[function(require,module,exports){
require("./IGameState.js");

/**
 * @constructor
 * @struct
 * @class HowToPlayState
 * @implements IGameState
 */
function HowToPlayState() {
	this.menuSprite = new Sprite("img/HTP.png");
	this.mainMenu = new Rectangle(140, 30, new Vector(330, 545));
}

/**
 * @param {Game} game
 * @returns {IGameState}
 */
HowToPlayState.prototype.update = function(game) {
	if (InputMonitor.isKeyPressed(KeyCode.LeftClick)) {
		var mouse = InputMonitor.getMousePosition(game.canvas).toRectangle();
		if (mouse.collidesWith(this.mainMenu)) {
			InputMonitor.clear();
			return new MenuState();
		}
	}
	return this;
};

/**
 * @param {Game} game
 * @returns {undefined}
 */
HowToPlayState.prototype.draw = function(game) {
	var context = game.context;

	this.menuSprite.draw(context, new Vector());

	if (DEBUG) {
		this.mainMenu.draw(context);
	}
};

window.HowToPlayState = HowToPlayState;

},{"./IGameState.js":18}],18:[function(require,module,exports){
require("../Game.js");

/**
 * @interface
 */
function IGameState() {}

/**
 * 
 * @param {Game} game
 * @returns {IGameState}
 */
IGameState.prototype.update = function(game) {};

/**
 * 
 * @param {Game} game
 * @returns {undefined}
 */
IGameState.prototype.draw = function(game) {};

window.IGameState = IGameState;

},{"../Game.js":10}],19:[function(require,module,exports){
require("./IGameState.js");

/**
 * @constructor
 * @struct
 * @class MenuState
 * @implements IGameState
 */
function MenuState() {
	this.menuSprite = new Sprite("img/Menu.png");
	this.newGameArea = new Rectangle(140, 30, new Vector(330, 362));
	this.howToPlayArea = new Rectangle(140, 30, new Vector(330, 412));
	this.credits = new Rectangle(140, 30, new Vector(330, 466))
}

/**
 * @param {Game} game
 * @returns {IGameState}
 */
MenuState.prototype.update = function(game) {
	if (InputMonitor.isKeyPressed(KeyCode.LeftClick)) {
		var mouse = InputMonitor.getMousePosition(game.canvas).toRectangle();

		if (mouse.collidesWith(this.newGameArea)) {
			InputMonitor.clear();
			return new PlayingState();
		}
		if (mouse.collidesWith(this.howToPlayArea)) {
			InputMonitor.clear();
			return new HowToPlayState();
		}
		if (mouse.collidesWith(this.credits)) {
			alert("Made by Marcos López C.");
			InputMonitor.clear();
		}
	}

	return this;
};

/**
 * @param {Game} game
 * @returns {undefined}
 */
MenuState.prototype.draw = function(game) {
	var context = game.context;

	this.menuSprite.draw(context, new Vector());

	if (DEBUG) {
		this.newGameArea.draw(context);
		this.howToPlayArea.draw(context);
		this.credits.draw(context);
	}
};

window.MenuState = MenuState;

},{"./IGameState.js":18}],20:[function(require,module,exports){
require("./IGameState.js");
require("../PointText.js");

/**
 * @constructor
 * @struct
 * @class PlayingState
 * @implements IGameState
 */
function PlayingState() {
	/**
	 * The UI sprite.
	 * @private
	 * @type Sprite
	 */
	this._ui = new Sprite("img/ui.png");

	/**
	 * The position of the UI sprite.
	 * @private
	 * @type Vector
	 */
	this._uiPosition = new Vector(0, 0);

	/**
	 * The background of the game.
	 * @private
	 * @type Sprite
	 */
	this._background = new Sprite("img/background.png");

	/**
	 * Set of airplanes.
	 * @private
	 * @type Array.<Airplane>
	 */
	this._airplanes = [];

	/**
	 * @private
	 * @type Array.<PointText>
	 */
	this._pointText = [];

	/**
	 * Airport.
	 * @private
	 * @type Airport
	 */
	this._airport = new Airport(new Vector(350, 200));

	/**
	 * The selected airplane.
	 * @private
	 * @type Airplane
	 */
	this._selectedAirplane = null;

	/**
	 * @type GameTime
	 */
	this.gameTime = new GameTime().start();

	/**
	 * @type number
	 */
	this.nextAirplaneTime = 0;

	/**
	 * @type number
	 */
	this.airplaneLanded = 0;

	/**
	 * @type number
	 */
	this.score = 0;

	/**
	 * @type boolean
	 */
	this.gameOver = false;

	/**
	 * @type number
	 */
	this.gameOverExitTime = 0;

	/**
	 * @type Audio
	 */
	this._music = new Audio("sound/game.ogg");
	this._music.volume = 0.8;
}

/**
 * Adds a new airplane to the game.
 * @returns {undefined}
 */
PlayingState.prototype.addAirplane = function() {
	// Only add if there are less than 30.
	if (this._airplanes.length > 30) {
		return;
	}

	/** @type Vector */
	var position;
	
	var randomPosition = (Math.random() * 100) | 0;

	if (randomPosition > 75) {
		position = new Vector(0, 0);
	}
	else if (randomPosition > 50) {
		position = new Vector(0, 600);
	}
	else if (randomPosition > 25) {
		position = new Vector(800, 600);
	}
	else {
		position = new Vector(800, 0);
	}

	var randomAirplane = (Math.random() * 200) | 0;

	if (randomAirplane > 50) {
		this._airplanes.push(new SmallAirplane().setPosition(position));
	}
	else if (randomAirplane > 15) {
		this._airplanes.push(new MediumAirplane().setPosition(position));
	}
	else {
		this._airplanes.push(new HeavyAirplane().setPosition(position));
	}

	this.nextAirplaneTime = this.gameTime.getTotal() + 10000;
};

/**
 * Updates the state of the game.
 * @param {Game} game
 * @returns {IGameState}
 */
PlayingState.prototype.update = function(game) {
	var gameTime = this.gameTime;

	var music = this._music;

	if (this.gameOver) {
		if (this.gameOverExitTime === 0) {
			this.gameOverExitTime = gameTime.getTotal() + 5000;
		}
		else if (this.gameOverExitTime < gameTime.getTotal()) {
			return new MenuState();
		}

		gameTime.update();
		return this;
	}
	else {
		// Loop Music
		if (music.paused) {
			music.play();
		}
	}

	for (var i = 0, length = this._pointText.length; i < length; i++) {
		if (this._pointText[i].finished === true) {
			this._pointText.splice(i, 1);
		}
		else {
			this._pointText[i].update(gameTime);
		}
	}

	if (gameTime.getTotal() > this.nextAirplaneTime) {
		this.addAirplane();
	}

	if (this._airplanes.length > 0) {
		// Handle input.
		var mousePosition = InputMonitor.getMousePosition(game.canvas);

		// Check if user is clicking.
		if (InputMonitor.isKeyPressed(KeyCode.LeftClick)) {
			if (this._selectedAirplane !== null) {
				this._selectedAirplane.addTarget(mousePosition);
			}
		}
		else {
			// Unselect airplane.
			this._selectedAirplane = null;
		}

		// Collision Handling for each airplane.
		for (var i = 0; i < this._airplanes.length; i++) {
			var airplane = this._airplanes[i];

			// Check if airplane has landed.
			if (this._airport.inLandingArea(airplane)) {

				(new Audio("sound/score.ogg")).play();

				this._pointText.push(new PointText(this._airplanes[i].score.toString(),
					this._airplanes[i].getPosition()));

				this.airplaneLanded++;
				this.score += this._airplanes[i].score;
				this._airplanes.splice(i, 1);

				continue;
			}

			// Check for collision with other airplanes.
			for (var j = i + 1, length = this._airplanes.length; j < length; j++) {
				if (airplane.getHitbox().collidesWith(this._airplanes[j].getHitbox())) {
					//airplane._velocity = new Vector(0, 0);
					airplane.clearPath();
					airplane.crashed = true;

					var crashedAirplane = this._airplanes[j];

					//this._airplanes[j]._velocity = new Vector(0, 0);
					crashedAirplane.clearPath();
					crashedAirplane.crashed = true;

					music.pause();
					this.gameOver = true;
				}
			}

			// Check if user selects airplane.
			if (this._selectedAirplane === null
				&& InputMonitor.isKeyPressed(KeyCode.LeftClick)
				&& InputMonitor.getMousePosition(game.canvas)
				.toRectangle().collidesWith(airplane.getHitbox())) {
				
				airplane.clearPath();
				this._selectedAirplane = airplane;
			}

			airplane.update(gameTime);
		}
	}
	else {
		// Add airplane to the game if there are no airplanes.
		this.addAirplane();
	}

	gameTime.update();

	return this;
};

/**
 * Draws the current game.
 * @param {Game} game
 * @returns {undefined}
 */
PlayingState.prototype.draw = function(game) {
	/** @type CanvasRenderingContext2D */
	var context = game.context;

	context.save();

	// Draw grass background.
	this._background.draw(context, new Vector());

	// Draw airport.
	this._airport.draw(context);

	if (this._selectedAirplane !== null) {
		/** @type Airplane */
		var airplane = this._selectedAirplane;
		//airplane.getPosition().toRectangle(20, 20).draw(context);
		airplane.drawGlow(context);
	}

	// Draw airplanes.
	for (var i = 0, length = this._airplanes.length; i < length; i++) {
		this._airplanes[i].draw(context);
	}

	for (var i = 0, length = this._pointText.length; i < length; i++) {
		this._pointText[i].draw(context);
	}

	// Draw UI.
	this._ui.draw(context, this._uiPosition);

	// Draw UI text.
	context.fillStyle = "#000000";
	context.font = "10px Verdana";
	context.textAlign = "end";
	context.fillText(this.airplaneLanded.toString(),
		this._uiPosition.x + 155, this._uiPosition.y + 18, 30);
	context.fillText(this.score.toString(),
		this._uiPosition.x + 345, this._uiPosition.y + 18, 30);

	if (this.gameOver) {
		context.fillStyle = "#ffffff";
		context.font = "bold 100px Verdana";
		context.textAlign = "center";
		context.fillText("Game Over", 400, 300);
		context.strokeText("Game Over", 400, 300);
	}

	context.restore();
};

window.PlayingState = PlayingState;

},{"../PointText.js":11,"./IGameState.js":18}],21:[function(require,module,exports){
require("./game/Game.js");

/** @constant */ window.DEBUG = false;

$(window).bind("load", function() {
	var myGame;
	
	function gameLoop() {
		myGame.update();
		myGame.draw();
		window.requestAnimationFrame(gameLoop);
	}

	myGame = new Game(document.getElementById("graphics"));

	gameLoop();
});

},{"./game/Game.js":10}]},{},[21]);
