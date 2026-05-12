/**
 * Neon Breaker Levels
 * Contains 30+ level definitions and generator logic.
 */
const LEVELS = [
    // Level 1: Basic Introduction
    [
        [0,0,0,0,0,0,0,0],
        [0,1,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,0],
        [0,0,0,0,0,0,0,0]
    ],
    // Level 2: Alternating
    [
        [1,2,1,2,1,2,1,2],
        [2,1,2,1,2,1,2,1],
        [1,2,1,2,1,2,1,2]
    ],
    // Level 3: Walls
    [
        [4,1,1,1,1,1,1,4],
        [4,1,2,2,2,2,1,4],
        [4,1,1,2,2,1,1,4],
        [4,4,1,1,1,1,4,4]
    ],
    // Level 4: Diamonds
    [
        [0,0,0,3,3,0,0,0],
        [0,0,3,2,2,3,0,0],
        [0,3,2,1,1,2,3,0],
        [0,0,3,2,2,3,0,0],
        [0,0,0,3,3,0,0,0]
    ],
    // Level 5: Stripes
    [
        [5,5,5,5,5,5,5,5],
        [1,1,1,1,1,1,1,1],
        [2,2,2,2,2,2,2,2],
        [3,3,3,3,3,3,3,3],
        [4,0,0,4,4,0,0,4]
    ],
    // Level 6: The Eye
    [
        [1,1,1,1,1,1,1,1],
        [1,2,2,2,2,2,2,1],
        [1,2,3,3,3,3,2,1],
        [1,2,3,5,5,3,2,1],
        [1,2,3,3,3,3,2,1],
        [1,2,2,2,2,2,2,1],
        [1,1,1,1,1,1,1,1]
    ]
    // More will be procedurally added during runtime if exceeding these
];

export function getLevel(index) {
    if (index < LEVELS.length) {
        return JSON.parse(JSON.stringify(LEVELS[index]));
    }
    
    // Procedural generation for high levels
    const rows = 5 + Math.min(5, Math.floor(index / 10));
    const cols = 8;
    const level = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            const rand = Math.random();
            if (rand < 0.1) row.push(4); // Unbreakable
            else if (rand < 0.2) row.push(5); // Explosive
            else if (rand < 0.4) row.push(3); // 3-hit
            else if (rand < 0.6) row.push(2); // 2-hit
            else if (rand < 0.9) row.push(1); // 1-hit
            else row.push(0);
        }
        level.push(row);
    }
    return level;
}

export const BRICK_COLORS = {
    1: '#00f2ff', // Cyan
    2: '#ff00ff', // Magenta
    3: '#ffea00', // Gold
    4: '#888888', // Steel
    5: '#ff6a00', // Orange (Explosive)
    6: '#00ff00'  // Green (Power-up)
};

export const BRICK_POINTS = {
    1: 10,
    2: 25,
    3: 50,
    4: 0,
    5: 40,
    6: 15
};
