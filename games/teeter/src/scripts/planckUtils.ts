// PLANCK UTILITIES

import { GameOptions } from './gameOptions';
 
// simple function to convert pixels to meters
// pixels : amount of pixels to convert
export function toMeters(pixels : number) : number {
    return pixels / GameOptions.Box2D.worldScale;
}
 
// simple function to convert meters to pixels
// meters : amount of meters to convert
export function toPixels(meters : number) : number {
    return meters * GameOptions.Box2D.worldScale;
}