/**
 * Physics Engine
 * Handles strict rigid body movement, friction, and slip angle calculations for drifting.
 */

class Physics {
    static calculateForces(car, mapDetails, dt) {
        // 1. Inputs
        let engineForce = 0;
        if (car.input.gas) engineForce = car.stats.acceleration * car.enginePowerMultiplier;
        if (car.input.brake) engineForce = -car.stats.braking;

        // Base speed before acceleration
        let initialSpeed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);

        // 2. Steering - rotate car angle based on input
        if (car.input.steer !== 0 && initialSpeed > 50) {
            const speedFactor = Math.max(0.6, 1 - (initialSpeed / (car.stats.maxSpeed * 1.5)));
            car.angle += car.input.steer * car.stats.turnSpeed * speedFactor * dt;
        } else if (car.input.steer !== 0 && initialSpeed > 5) {
            car.angle += car.input.steer * car.stats.turnSpeed * dt;
        }

        // Apply engine acceleration forward
        car.vx += Math.cos(car.angle) * engineForce * dt;
        car.vy += Math.sin(car.angle) * engineForce * dt;

        // Apply drag (air/rolling friction)
        car.vx -= car.vx * 0.8 * dt;
        car.vy -= car.vy * 0.8 * dt;

        // Recalculate speed after acceleration and drag
        let speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);

        // Calculate current motion angle and slip angle
        const motionAngle = Math.atan2(car.vy, car.vx);
        let slipAngle = motionAngle - car.angle;
        
        // Normalize slipAngle between -PI and PI
        while (slipAngle > Math.PI) slipAngle -= Math.PI * 2;
        while (slipAngle < -Math.PI) slipAngle += Math.PI * 2;
        
        // 3. Drift vs Grip Lateral Handling
        let isDrifting = false;
        let grip = car.stats.handling;
        
        // Initiate drift if handbrake is used, or if turning hard at high speed
        if (car.input.handbrake && speed > 200) {
            isDrifting = true;
            grip = car.stats.driftControl;
            car.driftQuality = Math.min(1.0, car.driftQuality + dt * 3);
        } else if (Math.abs(slipAngle) > 0.3 && speed > 300) {
            isDrifting = true;
            grip = car.stats.driftControl * 1.5; // Slight drift
            car.driftQuality = Math.min(1.0, car.driftQuality + dt * 2);
        } else {
            car.driftQuality = Math.max(0, car.driftQuality - dt * 2);
        }

        car.isDrifting = isDrifting;
        car.slipAngle = slipAngle;

        // Deconstruct velocity into Forward and Lateral vectors
        let forwardVel = speed * Math.cos(slipAngle);
        let lateralVel = speed * Math.sin(slipAngle);
        
        // Apply grip by killing lateral velocity
        lateralVel -= lateralVel * grip * dt;

        // Reconstruct velocity purely in X/Y axes from the new vectors
        car.vx = Math.cos(car.angle) * forwardVel - Math.sin(car.angle) * lateralVel;
        car.vy = Math.sin(car.angle) * forwardVel + Math.cos(car.angle) * lateralVel;

        // Ensure we don't exceed absolute max speed
        const currentSpeed = Math.sqrt(car.vx*car.vx + car.vy*car.vy);
        if (currentSpeed > car.stats.maxSpeed) {
            const ratio = car.stats.maxSpeed / currentSpeed;
            car.vx *= ratio;
            car.vy *= ratio;
        }

        // Apply movement
        car.x += car.vx * dt;
        car.y += car.vy * dt;

        // Terrain Friction (Solid Wall Bouncing)
        const colData = mapDetails.getCollisionData(car.x, car.y);
        if (colData.isOff) {
            // Push car out strictly back into the track bounds
            car.x += colData.normal.x * 5;
            car.y += colData.normal.y * 5;
            
            // Bounce the velocity vector against the track normal
            let dotProduct = car.vx * colData.normal.x + car.vy * colData.normal.y;
            
            if (dotProduct < 0) { // If moving towards the wall
                // Reflect velocity: V = V - (1 + restitution) * (V . N) * N
                const restitution = 0.5; // bounce heavily dampened so it doesn't spring off wildly
                car.vx = car.vx - (1 + restitution) * dotProduct * colData.normal.x;
                car.vy = car.vy - (1 + restitution) * dotProduct * colData.normal.y;
                
                // Slow car down massively for hitting the wall
                car.vx *= 0.5;
                car.vy *= 0.5;
            }
            
            car.isDrifting = false;
            car.driftQuality = 0;
            car.combo = 1; // Break combo
        }
    }
}
