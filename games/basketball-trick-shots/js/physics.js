// physics.js

const Physics = {
    gravity: 0.25,
    bounceRestitution: 0.7, // How much energy is kept after bounce
    wallRestitution: 0.6,
    rimRestitution: 0.5,
    airResistance: 0.995,

    // Calculate distance between two points
    dist: (x1, y1, x2, y2) => {
        return Math.hypot(x2 - x1, y2 - y1);
    },

    // Circle to Line Segment Collision
    circleLineCollide: (circle, line) => {
        // Line points
        let x1 = line.x1, y1 = line.y1;
        let x2 = line.x2, y2 = line.y2;
        
        let dx = x2 - x1;
        let dy = y2 - y1;
        let length = Math.hypot(dx, dy);
        
        // Dot product to find closest point on line
        let dot = (((circle.x - x1) * dx) + ((circle.y - y1) * dy)) / Math.pow(length, 2);
        
        // Clamp to line segment
        let closestX = x1 + (dot * dx);
        let closestY = y1 + (dot * dy);
        
        if (!line.infinite) {
            if (dot < 0) { closestX = x1; closestY = y1; }
            if (dot > 1) { closestX = x2; closestY = y2; }
        }

        let distanceX = circle.x - closestX;
        let distanceY = circle.y - closestY;
        let distance = Math.hypot(distanceX, distanceY);

        if (distance <= circle.radius) {
            // Collision detected
            let nx = distanceX / distance;
            let ny = distanceY / distance;
            
            // Push circle out
            circle.x = closestX + nx * circle.radius;
            circle.y = closestY + ny * circle.radius;
            
            // Reflect velocity
            let vDot = circle.vx * nx + circle.vy * ny;
            circle.vx -= 2 * vDot * nx;
            circle.vy -= 2 * vDot * ny;
            
            // Apply restitution
            circle.vx *= Physics.wallRestitution;
            circle.vy *= Physics.wallRestitution;

            // Apply friction/spin reduction
            circle.spin *= 0.8;
            
            return true;
        }
        return false;
    },

    // Circle to Circle Collision (for Rim edges)
    circleCircleCollide: (ball, p2) => {
        let dx = ball.x - p2.x;
        let dy = ball.y - p2.y;
        let distance = Math.hypot(dx, dy);
        let minDistance = ball.radius + p2.radius;

        if (distance < minDistance) {
            // Normal vector
            let nx = dx / distance;
            let ny = dy / distance;

            // Push out
            ball.x = p2.x + nx * minDistance;
            ball.y = p2.y + ny * minDistance;

            // Reflect velocity
            let vDot = ball.vx * nx + ball.vy * ny;
            ball.vx -= 2 * vDot * nx;
            ball.vy -= 2 * vDot * ny;

            ball.vx *= Physics.rimRestitution;
            ball.vy *= Physics.rimRestitution;

            return true;
        }
        return false;
    },

    // Update ball physics
    updateBall: (ball, width, height) => {
        if (!ball.isShooting) return;

        // Apply forces
        ball.vy += Physics.gravity;
        ball.vx += ball.wind; // Wind effect
        
        ball.vx *= Physics.airResistance;
        ball.vy *= Physics.airResistance;

        ball.x += ball.vx;
        ball.y += ball.vy;
        
        // Spin effect
        ball.angle += ball.vx * 0.05 + ball.spin;

        // Floor collision
        if (ball.y + ball.radius > height) {
            ball.y = height - ball.radius;
            ball.vy *= -Physics.bounceRestitution;
            ball.vx *= 0.9; // Friction
            ball.spin *= 0.5;
            return 'bounce';
        }
        
        // Left/Right Walls (Out of bounds)
        if (ball.x + ball.radius < -100 || ball.x - ball.radius > width + 100 || ball.y < -1000) {
            ball.isOut = true;
        }

        return null;
    }
};
