import { Scene } from 'phaser';
import { SameGame } from '../../../src/SameGame/SameGame';
import type { SameGameBoardChange, SameGameBoardStats } from '../../../src/SameGame/SameGame';

interface Tile {
    type: number;
    sprite: Phaser.GameObjects.Sprite;
}

type BestScore = {
    score: number;
};

const tileSize: number = 80;
const rows: number = 10;
const cols: number = 20;
const localStorageName: string = 'samegame';
const offsetX: number = 160;
const offsetY: number = 140;

export class Game extends Scene {
    constructor() {
        super('Game');
    }

    preload() {
        this.load.setPath('assets');
        this.load.spritesheet('tiles', 'sprites/tiles.png', {
            frameWidth: tileSize,
            frameHeight: tileSize
        });
        this.load.bitmapFont('font', 'fonts/font.png', 'fonts/font.fnt');
    }

    create() {

        const rawData: string | null = localStorage.getItem(localStorageName);
        const savedBestScore: BestScore | null = rawData !== null ? JSON.parse(rawData) : null;
        let bestScore: number = savedBestScore !== null ? savedBestScore.score : 0;

        const scoreText: Phaser.GameObjects.BitmapText = this.add.bitmapText(20, 20, 'font', '0', 60);
        const bestScoreText:Phaser.GameObjects.BitmapText = this.add.bitmapText(this.scale.width - 20, 20, 'font', 'Best: ' + bestScore, 60);
        bestScoreText.setOrigin(1, 0);
        
        const titleText: Phaser.GameObjects.BitmapText = this.add.bitmapText(this.scale.width / 2, this.scale.height - 60, 'font', 'SAMEGAME', 90);
        titleText.setOrigin(0.5, 0.5);

        let score: number = 0;
        let level: number = 1;
        let canPick: boolean = true;

        const spritePool: Phaser.GameObjects.Sprite[] = [];
        for (let i: number = 0; i < rows * cols; i++) {
            const sprite: Phaser.GameObjects.Sprite = this.add.sprite(0, 0, 'tiles');
            sprite.setActive(false).setVisible(false);
            spritePool.push(sprite);
        }
        
        const generator = (): Tile => {
            const type: number = Math.floor(Math.random() * 4);
            const sprite: Phaser.GameObjects.Sprite | undefined = spritePool.pop() as Phaser.GameObjects.Sprite;
            sprite.setActive(true).setVisible(true).setAlpha(1);
            return { type, sprite };
        };

        const equals = (a: Tile | null, b: Tile | null): boolean => {
            return a !== null && b !== null && a.type === b.type;
        }

        let game: SameGame<Tile> = new SameGame(rows, cols, 'down', 'normal', generator, true, equals);

        const drawBoard = (): void => {
            const grid: (Tile | null)[][] = game.getGrid();
            for (let row: number = 0; row < rows; row++) {
                for (let col: number = 0; col < cols; col++) {
                    const tile: Tile | null = grid[row][col];
                    if (tile) {      
                        tile.sprite.setPosition(offsetX + tileSize / 2 + col * tileSize, offsetY + tileSize / 2 + row * tileSize);
                        tile.sprite.setFrame(tile.type);   
                    }
                }
            }
        }

        drawBoard();

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!canPick) {
                return;
            }
            canPick = false;
            const col: number = Math.floor((pointer.worldX - offsetX) / tileSize);
            const row: number = Math.floor((pointer.worldY - offsetY) / tileSize);
            const change: SameGameBoardChange<Tile> = game.removeRegion(row, col);
            removeBlocks(change);  
        });

        const removeBlocks = (change: SameGameBoardChange<Tile>) => {
            if (change.removed.length > 0) {
                if (score === 0) {
                    titleText.setText('LEVEL 1');
                }
                score += level * change.removed.length * (change.removed.length - 1);
                scoreText.setText(score.toString());
                if (score > bestScore) {
                    bestScore = score;
                    bestScoreText.setText('BEST: ' + score.toString());
                    localStorage.setItem(localStorageName, JSON.stringify({ score: bestScore }));
                }
                const spritesToFade: Phaser.GameObjects.Sprite[] = [];
                change.removed.forEach((item: SameGameBoardChange<Tile>['removed'][number]) => {
                    const tile: Tile | null = item.value;
                    if (tile) {
                        spritesToFade.push(tile.sprite);    
                    }
                });
                this.add.tween({
                    targets: spritesToFade,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        spritesToFade.forEach((s: Phaser.GameObjects.Sprite) => {
                            s.setActive(false).setVisible(false);
                            spritePool.push(s);
                        })
                        makeBlocksFall(change);
                    }
                })
            }
            else {
                canPick = true;
            }
        }

        const makeBlocksFall = (change: SameGameBoardChange<Tile>) => {
            if (change.moved.length > 0) {
                let tweens: number = 0;
                change.moved.forEach((item: SameGameBoardChange<Tile>['moved'][number]) => {
                    const tile: Tile | null = item.value;
                    if (tile) {         
                        this.add.tween({
                            targets: tile.sprite,
                            y: tile.sprite.y + (item.to.row - item.from.row) * tileSize,
                            duration: 50 * (item.to.row - item.from.row),
                            onComplete: () => {
                                tweens++;
                                if (tweens == change.moved.length) {
                                    compactTable(change);
                                }    
                            }
                        }) 
                    }
                })    
            }
            else {
                compactTable(change);
            }
        }

         
        const compactTable = (change: SameGameBoardChange<Tile>) => {
            if (change.shifted.length > 0) {
                let tweens: number = 0;    
                change.shifted.forEach((item: SameGameBoardChange<Tile>['moved'][number]) => {
                    const tile: Tile | null = item.value;
                    if (tile) {
                        this.add.tween({
                            targets: tile.sprite,
                            x: tile.sprite.x + (item.to.col - item.from.col) * tileSize,
                            duration: 500 * (item.from.col - item.to.col),
                            ease: 'Bounce.easeOut',
                            onComplete: () => {
                                tweens++;
                                if (tweens == change.shifted.length) {
                                    newMove();
                                }
                            }
                        })
                    }
                })
            }
            else {
                newMove();
            }
        }

        const newMove = () => {
            if (game.hasMoves()) { 
                canPick = true;  
            }
            else {
                const stats: SameGameBoardStats = game.getBoardStats();
                if (stats.tiles > 0) {
                    titleText.setText('NO MORE MOVES');
                    this.time.addEvent({
                        delay: 5000,
                        callback: () => {
                            titleText.setText('SAMEGAME');
                            const remainingTiles: Tile[] = game.getAllTiles();
                            remainingTiles.forEach((tile: Tile) => {
                                tile.sprite.setActive(false).setVisible(false);
                                spritePool.push(tile.sprite);
                            })
                            game = new SameGame(rows, cols, 'down', 'normal', generator, true, equals);
                            canPick = true;
                            score = 0;
                            level = 1;
                            scoreText.setText('0');
                            drawBoard();
                        }
                    });
                }
                else {
                    titleText.setText('CONGRATULATIONS');
                    this.time.addEvent({
                        delay: 3000,
                        callback: () => {
                            level++
                            titleText.setText('LEVEL' + level.toString());
                            game = new SameGame(rows, cols, 'down', 'normal', generator, true, equals);
                            canPick = true;
                            drawBoard();
                        }
                    });
                }
            }  
        }
    }
}