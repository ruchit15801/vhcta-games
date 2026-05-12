const TILE_SIZE = 40;

const ObjectTypes = {
    PLAYER: 0,
    WALL: 1,
    MOVABLE: 2,
    SPIKE: 3,
    DOOR: 4,
    SWITCH: 5,
    SEED: 6,
    TREE: 7, 
    FRAGILE_WALL: 8 
};

const TimelineState = {
    PAST: 'past',
    FUTURE: 'future'
};

const CONFIG = {
    GRAVITY: 0.5,
    FRICTION: 0.8,
    JUMP_FORCE: 10,
    MOVE_SPEED: 4,
    MAX_FALL_SPEED: 12,
    ACCELERATION: 1.5
};
