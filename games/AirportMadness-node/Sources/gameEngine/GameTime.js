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
