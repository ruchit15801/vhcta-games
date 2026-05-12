"use strict";

module.exports = function(grunt) {
	grunt.config.init({
		packageInfo: grunt.file.readJSON("package.json"),
		browserify: {
			game: {
				files: {
					"Deploy/game.js": "Sources/main.js"
				}
			}
		}
	});

	grunt.task.loadNpmTasks("grunt-browserify");

	grunt.registerTask("default", ["browserify"]);
};