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
