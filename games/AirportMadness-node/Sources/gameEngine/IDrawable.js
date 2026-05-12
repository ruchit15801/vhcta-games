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
