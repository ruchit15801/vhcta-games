// MAIN GAME FILE

// modules to import
import Phaser from 'phaser';
import { PlayGame } from './playGame';
import { PreloadAssets } from './preloadAssets';
import { MainGame } from './mainGame';
import { AnimatedBackground } from './animatedBackground';

// object to initialize the Scale Manager
const scaleObject : Phaser.Types.Core.ScaleConfig = {
    mode : Phaser.Scale.FIT,
    autoCenter : Phaser.Scale.CENTER_BOTH,
    parent : 'thegame',
    width : 1920,
    height : 1080
}

// game configuration object
const configObject : Phaser.Types.Core.GameConfig = { 
    type : Phaser.AUTO,
    backgroundColor : 0xaee2ff,
    scale : scaleObject,
    scene : [PreloadAssets, MainGame, AnimatedBackground, PlayGame]
}

// the game itself
new Phaser.Game(configObject);