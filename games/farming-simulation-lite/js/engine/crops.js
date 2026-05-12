const CROP_TYPES = {
    WHEAT: {
        name: 'Wheat',
        seedCost: 10,
        sellPrice: 25,
        growthTime: 30, // seconds
        xp: 5,
        sprite: 'assets/wheat_stages.png'
    },
    CORN: {
        name: 'Corn',
        seedCost: 20,
        sellPrice: 55,
        growthTime: 60, // seconds
        xp: 12,
        sprite: 'assets/corn_stages.png'
    },
    CARROT: {
        name: 'Carrot',
        seedCost: 35,
        sellPrice: 100,
        growthTime: 120, // seconds
        xp: 25,
        sprite: 'assets/carrot_stages.png'
    }
};

class Crop {
    constructor(typeKey, startTime = Date.now()) {
        const type = CROP_TYPES[typeKey];
        this.typeKey = typeKey;
        this.name = type.name;
        this.growthTime = type.growthTime * 1000; // ms
        this.startTime = startTime;
        this.img = new Image();
        this.img.src = type.sprite;
        this.status = 'growing'; // growing, ready
        this.stage = 0; // 0, 1, 2
    }

    update() {
        const elapsed = Date.now() - this.startTime;
        const progress = elapsed / this.growthTime;

        if (progress >= 1.0) {
            this.stage = 2;
            this.status = 'ready';
        } else if (progress >= 0.5) {
            this.stage = 1;
        } else {
            this.stage = 0;
        }
    }

    draw(ctx, x, y, scale) {
        if (!this.img.complete) return;

        // Assume sprite is 3 stages horizontally
        const sw = this.img.width / 3;
        const sh = this.img.height;
        
        const dw = 100 * scale;
        const dh = (sh / sw) * dw;

        ctx.drawImage(
            this.img,
            this.stage * sw, 0, sw, sh,
            x - dw / 2, y - dh + 20 * scale, dw, dh
        );
    }
}

window.CROP_TYPES = CROP_TYPES;
window.Crop = Crop;
