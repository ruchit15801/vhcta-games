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
