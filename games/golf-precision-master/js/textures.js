// js/textures.js
// Procedural Generation of Textures to base64 images

const Textures = {
    grass: null,
    rough: null,
    sand: null,
    water: null,
    ball: null,

    init() {
        this.grass = this.createNoiseTexture('#0d591b', '#107a23', 128); // Fairway
        this.rough = this.createNoiseTexture('#083d10', '#0a4d14', 128); // Rough
        this.sand = this.createNoiseTexture('#d1c08a', '#e8d7a1', 128); // Sand
        this.water = this.createWaterTexture(128); // Water
        this.ball = this.createBallTexture(64); // Golf ball
    },

    createNoiseTexture(color1, color2, size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = color1;
        ctx.fillRect(0, 0, size, size);
        
        // Add noise
        for (let i = 0; i < size * size * 0.5; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? color1 : color2;
            const x = Math.random() * size;
            const y = Math.random() * size;
            ctx.fillRect(x, y, 2, 2);
        }
        
        const img = new Image();
        img.src = canvas.toDataURL();
        return img;
    },

    createWaterTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Base gradient
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, '#1da2d8');
        grad.addColorStop(1, '#0e6f96');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        // Water ripples
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 20 + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        const img = new Image();
        img.src = canvas.toDataURL();
        return img;
    },

    createBallTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const r = size / 2;
        
        // Base white sphere
        const grad = ctx.createRadialGradient(r*0.7, r*0.7, r*0.1, r, r, r);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.8, '#e0e0e0');
        grad.addColorStop(1, '#909090');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(r, r, r - 1, 0, Math.PI * 2);
        ctx.fill();
        
        // Dimples
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        for(let i=0; i<40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * (r - 4);
            const px = r + Math.cos(angle) * dist;
            const py = r + Math.sin(angle) * dist;
            ctx.beginPath();
            ctx.arc(px, py, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        const img = new Image();
        img.src = canvas.toDataURL();
        return img;
    }
};

Textures.init();
