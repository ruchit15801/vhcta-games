# Airport Madness

This is the very first game that I wrote in the JavaScript language.
It was my final project for Intro to Game Programming and it took 3 months to develop.
Beware that the project does not follow the best practices for the JavaScript language.
The source code was originally intended to be processed the [Google's Closure Compiler](https://developers.google.com/closure/).
However, it has been modified to work with [browserify](http://browserify.org/).

The goal of the game is to draw a path so that every airplane can arrive at the airport without crashing into each other.
There are three types of airplanes in the game and each has different characteristics.
The small airplane travel slowly and turns fast, but it's worth the least points: 10.
The medium airplane travel and turns at moderate speed, and it's worth 30 points.
The heavy airplane travels fast and turns slowly, but the reward for successfully guiding it to the airport is 50 points.

## How to build

In other to run the game, the source files must first be processed first. Follow these steps to build the game:

1. Install [node.js](http://nodejs.org/).
2. Open the terminal and change the current working directory to `/Sources`.
3. Type and run `npm install` to install the project dependencies.
4. Type and run `grunt` to run the default task and process the files.
5. The processed game file will be placed in `/Deploy/game.js`.

## How to start the game

First, make sure that you have built the code. Then, open `/Deploy/index.html` in either Firefox or Chrome.
Unfortunately, but not surprisingly, the game does not run well on Internet Explorer.

You can also [play the game online](//marcoslopezc.github.io/AirportMadness).

## Runtime options

When the game starts, multiple properties are placed in the global namespace.
Setting the `DEBUG` property to `true` will cause bounding boxes to draw on the screen.
