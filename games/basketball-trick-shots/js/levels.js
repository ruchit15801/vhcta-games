// levels.js

// Helper to generate dynamic levels
const generateLevels = () => {
    const levels = [];
    
    // Level 1: Basic straight shot
    levels.push({
        hoop: { x: 0.8, y: 0.5 },
        obstacles: [],
        movingHoop: false,
        wind: 0,
        reqScore: 1
    });

    // Level 2: Small wall and moving hoop
    levels.push({
        hoop: { x: 0.8, y: 0.3 },
        obstacles: [
            { x: 0.6, y: 0.4, w: 0.02, h: 0.2, type: 'wall' }
        ],
        movingHoop: { rangeY: 0.15, speed: 0.02 },
        wind: 0,
        reqScore: 1
    });

    // Level 3: Tunnel with moving obstacles
    levels.push({
        hoop: { x: 0.85, y: 0.5 },
        obstacles: [
            { x: 0.5, y: 0.0, w: 0.05, h: 0.3, type: 'wall' },
            { x: 0.5, y: 0.7, w: 0.05, h: 0.3, type: 'wall' }
        ],
        movingHoop: { rangeY: 0.2, speed: 0.03 },
        wind: 0,
        reqScore: 1
    });

    // Level 4: High wall block + Wind
    levels.push({
        hoop: { x: 0.8, y: 0.6 },
        obstacles: [
            { x: 0.4, y: 0.2, w: 0.02, h: 0.6, type: 'wall' }
        ],
        movingHoop: false,
        wind: 0.05,
        reqScore: 1
    });

    // Level 5: Ceiling and floor obstacles + High Wind
    levels.push({
        hoop: { x: 0.85, y: 0.5 },
        obstacles: [
            { x: 0.4, y: 0.0, w: 0.03, h: 0.4, type: 'wall' },
            { x: 0.6, y: 0.6, w: 0.03, h: 0.4, type: 'wall' }
        ],
        movingHoop: { rangeY: 0.25, speed: 0.04 },
        wind: -0.08,
        reqScore: 1
    });

    // Generate remaining levels up to 50
    for (let i = 6; i <= 50; i++) {
        let hoopX = 0.7 + Math.random() * 0.2;
        let hoopY = 0.3 + Math.random() * 0.4;
        let obstacles = [];
        
        // Hoops move almost always after level 5
        let movingHoop = false;
        if (i >= 5 && Math.random() > 0.2) {
            movingHoop = {
                rangeY: 0.1 + (i * 0.005),
                speed: 0.01 + (i * 0.001)
            };
        }

        // Wind is more frequent and stronger
        let wind = 0;
        if (i >= 8 && Math.random() > 0.3) {
            wind = (Math.random() - 0.5) * (i * 0.015);
        }

        // Generate 1 to 3 random obstacles
        let numObstacles = Math.min(3, Math.floor(i / 10));
        for (let j = 0; j < numObstacles; j++) {
            let obsX = 0.3 + Math.random() * 0.4; // between 30% and 70% width
            let obsY = Math.random() * 0.8;
            let obsW = 0.02 + Math.random() * 0.05;
            let obsH = 0.1 + Math.random() * 0.3;
            
            // Check for overlap with hoop (roughly)
            if (Math.abs(obsX - hoopX) < 0.1 && Math.abs(obsY - hoopY) < 0.2) {
                continue; // Skip this obstacle
            }
            
            obstacles.push({ x: obsX, y: obsY, w: obsW, h: obsH, type: 'wall' });
        }

        levels.push({
            hoop: { x: hoopX, y: hoopY },
            obstacles: obstacles,
            movingHoop: movingHoop,
            wind: wind,
            reqScore: 1
        });
    }

    return levels;
};

const gameLevels = generateLevels();
