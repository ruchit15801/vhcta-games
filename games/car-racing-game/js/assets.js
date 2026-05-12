const Assets = {
    images: {},
    isLoaded: false,
    
    // Path to assets (Upgraded for Realism)
    paths: {
        player: 'assets/images/player_real.png',
        traffic: 'assets/images/traffic.png',
        road: 'assets/images/road_real.png',
        splash: 'assets/images/splash.png',
        scenery: 'assets/images/scenery_real.png',
        icon: 'assets/images/icon.png',
        thumbnail: 'assets/images/thumbnail.png'
    },

    loadAll: function() {
        return new Promise((resolve) => {
            let loadedCount = 0;
            const total = Object.keys(this.paths).length;
            
            for (let key in this.paths) {
                const img = new Image();
                img.src = this.paths[key];
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    // Process Transparency for car and scenery assets
                    if (key === 'player' || key === 'traffic' || key === 'scenery') {
                        this.images[key] = this.processTransparency(img);
                    } else {
                        this.images[key] = img;
                    }
                    
                    loadedCount++;
                    if (loadedCount === total) {
                        this.isLoaded = true;
                        resolve();
                    }
                };
                img.onerror = () => {
                    console.warn(`Failed to load asset: ${key}. Using logic-based fallback.`);
                    // Create a 1x1 invisible placeholder so code doesn't crash
                    const canvas = document.createElement('canvas');
                    canvas.width = 1; canvas.height = 1;
                    this.images[key] = canvas;
                    
                    loadedCount++;
                    if (loadedCount === total) {
                        this.isLoaded = true;
                        resolve();
                    }
                };
            }
        });
    },

    processTransparency: function(img) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Remove noisy backgrounds (Dark & Neutral colors)
        // High threshold (120) for aggressive removal of compressed black backgrounds
        const threshold = 120; 
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calculate brightness and saturation (for neutrality check)
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max - min;
            
            // If it's dark and relatively gray/neutral, it's likely background noise
            if (max < threshold && saturation < 30) {
                // Smooth falloff based on brightness
                data[i + 3] = Math.pow(max / threshold, 3) * 255;
                
                // If it's very dark, make it fully transparent
                if (max < 40) data[i + 3] = 0;
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    },

    // Traffic Car Sub-sprites
    getTrafficSprite: function(index) {
        const img = this.images.traffic;
        if (!img) return null;
        
        // Photorealistic traffic sheet has 4 cars in a row
        const cols = 4;
        const rows = 1;
        const sw = img.width / cols;
        const sh = img.height / rows;
        
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        return {
            img: img,
            sx: col * sw,
            sy: row * sh,
            sw: sw,
            sh: sh
        };
    },

    // Scenery Sub-sprites
    getScenerySprite: function(index) {
        const img = this.images.scenery;
        if (!img) return null;
        
        const cols = 3; // 3 trees generated
        const sw = img.width / cols;
        const sh = img.height;
        
        return {
            img: img,
            sx: index * sw,
            sy: 0,
            sw: sw,
            sh: sh
        };
    }
};
