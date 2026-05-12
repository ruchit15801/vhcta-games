class AIController {
    constructor(car, track) {
        this.car = car;
        this.track = track;
        this.currentNodeIdx = 0;
        this.lookAheadDistance = 200; // Look ahead for corners
        this.difficulty = 0.8; // 0 to 1
    }

    update() {
        const path = this.track.path;
        if (!path || path.length === 0) return;

        let target = path[this.currentNodeIdx];
        
        // Calculate distance to target
        let dx = target.x - this.car.x;
        let dy = target.y - this.car.y;
        let dist = Math.sqrt(dx*dx + dy*dy);

        // If close enough to target node, move to next
        if (dist < 100) {
            this.currentNodeIdx = (this.currentNodeIdx + 1) % path.length;
            target = path[this.currentNodeIdx];
            dx = target.x - this.car.x;
            dy = target.y - this.car.y;
        }

        // Angle to target
        const targetAngle = Math.atan2(dy, dx);
        
        // Calculate angle difference (-PI to PI)
        let angleDiff = targetAngle - this.car.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Steering logic
        if (angleDiff > 0.1) {
            this.car.input.steer = 1;
        } else if (angleDiff < -0.1) {
            this.car.input.steer = -1;
        } else {
            this.car.input.steer = 0;
        }

        // Speed logic
        const speed = Math.sqrt(this.car.vx*this.car.vx + this.car.vy*this.car.vy);
        const isSharpTurn = Math.abs(angleDiff) > 0.8;
        
        // Cornering logic - AI tries to drift on sharp turns!
        if (isSharpTurn) {
            if (speed > 600 * this.difficulty) {
                this.car.input.brake = true;
                this.car.input.gas = false;
                this.car.input.handbrake = true;
            } else {
                this.car.input.brake = false;
                this.car.input.gas = true;
                this.car.input.handbrake = false;
            }
        } else {
            this.car.input.brake = false;
            this.car.input.gas = true;
            this.car.input.handbrake = false;
        }
    }
}
