// js/levels.js
// Procedural Level Generator

const LevelGenerator = {
    generate(levelNum) {
        // Seed randomness based on level number to keep it consistent
        this.seed = levelNum * 12345;
        
        const difficulty = Math.min(1, levelNum / 50); // 0.0 to 1.0
        
        // Distance increases with difficulty
        const minDistance = 500 + difficulty * 1000;
        const maxDistance = 800 + difficulty * 1500;
        const distance = this.random(minDistance, maxDistance);
        
        // Direction angle
        const angle = this.random(-Math.PI / 4, Math.PI / 4) - Math.PI / 2; // Generally upwards
        
        const startPos = { x: 0, y: 0 };
        const holePos = {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance
        };

        // Determine Par
        let par = 3;
        if (distance > 1200) par = 4;
        if (distance > 2000) par = 5;

        // Generate Wind
        const maxWind = difficulty * 20; // up to 20 mph
        const wind = {
            speed: Math.floor(this.random(0, maxWind)),
            angle: this.random(0, Math.PI * 2)
        };

        // Generate Hazards
        const hazards = [];
        const numHazards = Math.floor(difficulty * 5) + 1;
        
        for (let i = 0; i < numHazards; i++) {
            // Place hazard somewhere between start and hole
            const t = this.random(0.2, 0.8);
            const offset = this.random(-200, 200);
            
            const hx = startPos.x + (holePos.x - startPos.x) * t + Math.cos(angle + Math.PI/2) * offset;
            const hy = startPos.y + (holePos.y - startPos.y) * t + Math.sin(angle + Math.PI/2) * offset;
            
            hazards.push({
                x: hx,
                y: hy,
                radius: this.random(50, 150),
                type: this.random() > 0.5 ? 'sand' : 'water'
            });
        }

        // Generate rough patches
        const numRough = Math.floor(difficulty * 3) + 1;
        for (let i = 0; i < numRough; i++) {
            const t = this.random(0.3, 0.9);
            const offset = this.random(-100, 100);
            const hx = startPos.x + (holePos.x - startPos.x) * t + Math.cos(angle + Math.PI/2) * offset;
            const hy = startPos.y + (holePos.y - startPos.y) * t + Math.sin(angle + Math.PI/2) * offset;
            
            hazards.push({
                x: hx,
                y: hy,
                radius: this.random(100, 200),
                type: 'rough'
            });
        }

        return {
            number: levelNum,
            par: par,
            startPos: startPos,
            holePos: holePos,
            wind: wind,
            hazards: hazards,
            greenRadius: 100 + (1 - difficulty) * 50 // Green gets smaller
        };
    },
    
    // Simple seeded random
    random(min = 0, max = 1) {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        const rnd = this.seed / 233280;
        return min + rnd * (max - min);
    }
};
