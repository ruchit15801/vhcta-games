class Track {
    constructor(type) {
        this.type = type; // 'city', 'mountain', 'desert'
        this.width = 300;
        this.path = [];
        this.boundaries = [];
        this.checkpoints = [];
        
        this.generatePath();
    }

    generatePath() {
        // Procedural generation of a closed loop or load predefined coordinates
        // For a high-quality game, we define spline points for a great track
        
        let waypoints = [];
        if (this.type === 'city') {
            waypoints = [
                {x: 0, y: 0}, {x: 1000, y: 0}, {x: 1000, y: 1000}, {x: 500, y: 1500}, 
                {x: 0, y: 1000}, {x: -1000, y: 1000}, {x: -1000, y: 0}, {x: -500, y: -500}
            ];
        } else if (this.type === 'mountain') {
            waypoints = [
                {x: 0, y: 0}, {x: 800, y: -200}, {x: 1600, y: 400}, {x: 1200, y: 1200}, 
                {x: 400, y: 800}, {x: -400, y: 1600}, {x: -1200, y: 800}, {x: -800, y: 0}
            ];
        } else { // desert
            waypoints = [
                {x: 0, y: 0}, {x: 2000, y: 0}, {x: 2000, y: 2000}, {x: 0, y: 2000}
            ];
        }

        // Catmull-Rom Spline Interpolation for smooth curves
        this.path = this.computeSpline(waypoints, 10);
        
        // Generate Checkpoints (every 50 path nodes)
        for (let i = 0; i < this.path.length; i += 50) {
            this.checkpoints.push(this.path[i]);
        }
    }

    computeSpline(points, resolution) {
        let curve = [];
        for (let i = 0; i < points.length; i++) {
            let p0 = points[(i - 1 + points.length) % points.length];
            let p1 = points[i];
            let p2 = points[(i + 1) % points.length];
            let p3 = points[(i + 2) % points.length];

            for (let t = 0; t < 1; t += 1/resolution) {
                let tt = t * t;
                let ttt = tt * t;

                let q1 = -ttt + 2.0*tt - t;
                let q2 = 3.0*ttt - 5.0*tt + 2.0;
                let q3 = -3.0*ttt + 4.0*tt + t;
                let q4 = ttt - tt;

                let tx = 0.5 * (points[0].x * q1 + points[1].x * q2 + points[2].x * q3 + points[3].x * q4);
                // Hack for array boundaries - use actual points
                let px = 0.5 * (p0.x * q1 + p1.x * q2 + p2.x * q3 + p3.x * q4);
                let py = 0.5 * (p0.y * q1 + p1.y * q2 + p2.y * q3 + p3.y * q4);

                curve.push({x: px, y: py});
            }
        }
        return curve;
    }

    getCollisionData(x, y) {
        let minDistSq = Infinity;
        let closestPoint = null;
        for (let p of this.path) {
            let dx = p.x - x;
            let dy = p.y - y;
            let dSq = dx*dx + dy*dy;
            if (dSq < minDistSq) {
                minDistSq = dSq;
                closestPoint = p;
            }
        }
        
        let trackRadius = this.width / 2;
        let carRadius = 25; // roughly half car width
        let isOff = minDistSq > ((trackRadius - carRadius) * (trackRadius - carRadius));
        
        let normal = {x: 0, y: 0};
        if (isOff && closestPoint) {
            let dist = Math.sqrt(minDistSq);
            normal.x = (closestPoint.x - x) / dist;
            normal.y = (closestPoint.y - y) / dist;
        }
        
        return { isOff: isOff, normal: normal };
    }

    draw(ctx, camera) {
        // Draw Parallax Context/Background based on type
        // This gives the Ultra Premium Depth effect
        
        // Clear absolute background bounds to prevent camera un-filled visual artifacts/smearing
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = this.type === 'city' ? '#111218' : 
                        this.type === 'mountain' ? '#2c3e50' : '#e67e22';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();

        // Premium Neon Glow Border Outer
        ctx.lineWidth = this.width + 15;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = this.type === 'city' ? '#00f3ff' : this.type === 'mountain' ? '#bc13fe' : '#ff0055';
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 30;

        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.shadowBlur = 0; // reset shadow for road

        // Draw Road Base
        ctx.lineWidth = this.width;
        ctx.strokeStyle = '#222';
        
        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        // Draw Road Inner Lines
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#fff';
        ctx.setLineDash([40, 40]);
        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]); // Reset
    }
}
