// MAIN GAME FILE

// modules to import
import Phaser from 'phaser';
import { PreloadAssets } from './scenes/preloadAssets';
import { PlayGame } from './scenes/playGame';
import { GameOptions } from './gameOptions';

// object to initialize the Scale Manager
const scaleObject : Phaser.Types.Core.ScaleConfig = {
    mode : Phaser.Scale.FIT,
    autoCenter : Phaser.Scale.CENTER_BOTH,
    parent : 'thegame',
    width : GameOptions.game.width,
    height : GameOptions.game.height
}

// game configuration object
const configObject : Phaser.Types.Core.GameConfig = { 
    type : Phaser.AUTO,
    backgroundColor : GameOptions.game.bgColor,
    scale : scaleObject,
    scene : [PreloadAssets, PlayGame]
}

// the game itself
new Phaser.Game(configObject);