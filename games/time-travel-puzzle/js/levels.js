// Level definitions (Grid based: 16x10 for wide aspect, scaled visually)
const Levels = [
    {
        id: 1,
        hint: "Welcome to Chrono Echoes. Use W/A/D to move and jump. Press DOWN (S) to enter the glowing door.",
        playerStart: { x: 2, y: 7 },
        past: [
            {t: ObjectTypes.WALL, x: 0, y: 9, w: 16, h: 1}, // Floor
            {t: ObjectTypes.WALL, x: 0, y: 0, w: 1, h: 10}, // Left Wall
            {t: ObjectTypes.WALL, x: 15, y: 0, w: 1, h: 10},// Right Wall
            {t: ObjectTypes.DOOR, x: 13, y: 7, w: 1.5, h: 2, id: 'door1'}
        ],
        future: [
            {t: ObjectTypes.WALL, x: 0, y: 9, w: 16, h: 1},
            {t: ObjectTypes.WALL, x: 0, y: 0, w: 1, h: 10},
            {t: ObjectTypes.WALL, x: 15, y: 0, w: 1, h: 10},
            {t: ObjectTypes.DOOR, x: 13, y: 7, w: 1.5, h: 2, id: 'door1'}
        ]
    },
    {
        id: 2,
        hint: "The future is ruined. Press SHIFT or TIME to travel forward and bypass the wall.",
        playerStart: { x: 2, y: 7 },
        past: [
            {t: ObjectTypes.WALL, x: 0, y: 9, w: 16, h: 1},
            {t: ObjectTypes.RUINED_WALL, x: 7, y: 3, w: 2, h: 6}, // Blocks path in past
            {t: ObjectTypes.DOOR, x: 13, y: 7, w: 1.5, h: 2, id: 'door1'}
        ],
        future: [
            {t: ObjectTypes.WALL, x: 0, y: 9, w: 16, h: 1},
            // Ruined wall is missing here!
            {t: ObjectTypes.DOOR, x: 13, y: 7, w: 1.5, h: 2, id: 'door1'}
        ]
    },
    {
        id: 3,
        hint: "Cause & Effect: Move the crate in the PAST, and it will remain there in the FUTURE.",
        playerStart: { x: 2, y: 7 },
        past: [
            {t: ObjectTypes.WALL, x: 0, y: 9, w: 16, h: 1},
            {t: ObjectTypes.MOVABLE, x: 6, y: 8, w: 1, h: 1, id: 'box1'},
            {t: ObjectTypes.WALL, x: 11, y: 6, w: 5, h: 4}, // High platform
            {t: ObjectTypes.DOOR, x: 13, y: 4, w: 1.5, h: 2, id: 'door1'}
        ],
        future: [
            {t: ObjectTypes.WALL, x: 0, y: 9, w: 16, h: 1},
            {t: ObjectTypes.WALL, x: 11, y: 6, w: 5, h: 4},
            {t: ObjectTypes.DOOR, x: 13, y: 4, w: 1.5, h: 2, id: 'door1'}
        ]
    },
    {
        id: 4,
        hint: "A planted seed in the past grows into a sturdy tree platform in the future.",
        playerStart: { x: 2, y: 7 },
        past: [
            {t: ObjectTypes.WALL, x: 0, y: 9, w: 16, h: 1},
            {t: ObjectTypes.WALL, x: 5, y: 7, w: 2, h: 2},
            {t: ObjectTypes.SEED, x: 8, y: 8, w: 0.5, h: 0.5, id: 'seed1'},
            {t: ObjectTypes.WALL, x: 12, y: 4, w: 4, h: 5},
            {t: ObjectTypes.DOOR, x: 13, y: 2, w: 1.5, h: 2, id: 'door1'},
            {t: ObjectTypes.SPIKE, x: 9, y: 8.5, w: 2, h: 0.5} // Danger
        ],
        future: [
            {t: ObjectTypes.WALL, x: 0, y: 9, w: 16, h: 1},
            {t: ObjectTypes.WALL, x: 5, y: 7, w: 2, h: 2},
            {t: ObjectTypes.WALL, x: 12, y: 4, w: 4, h: 5},
            {t: ObjectTypes.DOOR, x: 13, y: 2, w: 1.5, h: 2, id: 'door1'},
            {t: ObjectTypes.SPIKE, x: 9, y: 8.5, w: 2, h: 0.5}
            // Tree will be auto-generated here based on seed's final past position
        ]
    },
    {
        id: 5,
        hint: "Changes in the Future do not rewrite the Past. Use both timelines to solve.",
        playerStart: { x: 1, y: 7 },
        past: [
            {t: ObjectTypes.WALL, x: 0, y: 9, w: 16, h: 1},
            {t: ObjectTypes.MOVABLE, x: 4, y: 8, w: 1, h: 1, id: 'box1'},
            {t: ObjectTypes.RUINED_WALL, x: 8, y: 0, w: 2, h: 9}, // Blocks past
            {t: ObjectTypes.SWITCH, x: 13, y: 8, w: 1.5, h: 0.2, target: 'door1', id: 'sw1'},
            {t: ObjectTypes.DOOR, x: 1, y: 2, w: 1.5, h: 2, id: 'door1', locked: true},
            {t: ObjectTypes.WALL, x: 0, y: 4, w: 3, h: 1}
        ],
        future: [
            {t: ObjectTypes.WALL, x: 0, y: 9, w: 16, h: 1},
            {t: ObjectTypes.SWITCH, x: 13, y: 8, w: 1.5, h: 0.2, target: 'door1', id: 'sw1'},
            {t: ObjectTypes.DOOR, x: 1, y: 2, w: 1.5, h: 2, id: 'door1', locked: true},
            {t: ObjectTypes.WALL, x: 0, y: 4, w: 3, h: 1}
            // Ruined wall is gone, so player can access the switch in future
        ]
    }
];
