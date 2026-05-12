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

	/**
	 * Handles touchstart events.
	 * @param {TouchEvent} e
	 * @returns {undefined}
	 */
	_touchstartHandler: function(e) {
		if (e.touches && e.touches.length > 0) {
			InputMonitor._mousePosition.x = e.touches[0].clientX;
			InputMonitor._mousePosition.y = e.touches[0].clientY;
			InputMonitor._keyState[KeyCode.LeftClick] = true;
		}
		e.preventDefault();
		e.stopPropagation();
	},

	/**
	 * Handles touchmove events.
	 * @param {TouchEvent} e
	 * @returns {undefined}
	 */
	_touchmoveHandler: function(e) {
		if (e.touches && e.touches.length > 0) {
			InputMonitor._mousePosition.x = e.touches[0].clientX;
			InputMonitor._mousePosition.y = e.touches[0].clientY;
		}
		e.preventDefault();
		e.stopPropagation();
	},

	/**
	 * Handles touchend events.
	 * @param {TouchEvent} e
	 * @returns {undefined}
	 */
	_touchendHandler: function(e) {
		InputMonitor._keyState[KeyCode.LeftClick] = false;
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

		document.addEventListener("touchstart", InputMonitor._touchstartHandler, {passive: false, capture: true});
		document.addEventListener("touchmove", InputMonitor._touchmoveHandler, {passive: false, capture: true});
		document.addEventListener("touchend", InputMonitor._touchendHandler, {passive: false, capture: true});
		document.addEventListener("touchcancel", InputMonitor._touchendHandler, {passive: false, capture: true});
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
	 * Uses getBoundingClientRect and scale correction for CSS-scaled canvases.
	 * @param {HTMLElement=} element
	 * @returns {Vector}
	 */
	getMousePosition: function(element) {
		var position = InputMonitor._mousePosition.clone();
		
		if (element) {
			var rect = element.getBoundingClientRect();
			// Calculate scale factor between internal size and displayed size
			var scaleX = element.width / rect.width;
			var scaleY = element.height / rect.height;
			// Map screen coordinates to internal canvas coordinates
			position.x = (position.x - rect.left) * scaleX;
			position.y = (position.y - rect.top) * scaleY;
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
