// Fashion Designer Studio - Rendering Engine

class StylingEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // Fixed internal resolution for ultra-crisp rendering
        this.canvas.width = 800; 
        this.canvas.height = 1600;
        this.ctx.scale(2, 2);
        this.scaleRatio = 1; // Logical size 400x800
        
        this.loadedImages = {};
        this.currentOutfit = {
            dresses: null,
            tops: null,
            bottoms: null,
            shoes: null
        };
        
        this.time = 0;
        this.isAnimating = false;
        
        this.preloadSVGs();
    }
    
    async preloadSVGs() {
        for (const [key, svgString] of Object.entries(SVGS)) {
            const img = new Image();
            img.src = svgString;
            await new Promise(r => {
                img.onload = r;
                img.onerror = () => { console.error('Failed to load SVG:', key); r(); };
            });
            this.loadedImages[key] = img;
        }
        this.startAnimationLoop();
    }
    
    equipItem(itemData) {
        if (!itemData) return;
        
        // If it's a dress, remove top and bottom
        if (itemData.category === 'dresses') {
            this.currentOutfit.tops = null;
            this.currentOutfit.bottoms = null;
            this.currentOutfit.dresses = itemData;
        } 
        // If it's top/bottom, remove dress
        else if (itemData.category === 'tops' || itemData.category === 'bottoms') {
            this.currentOutfit.dresses = null;
            this.currentOutfit[itemData.category] = itemData;
        } else {
            this.currentOutfit[itemData.category] = itemData;
        }
    }
    
    unequipItem(category) {
        this.currentOutfit[category] = null;
    }
    
    getEquippedTags() {
        let tags = [];
        Object.values(this.currentOutfit).forEach(item => {
            if (item && item.tags) {
                tags = tags.concat(item.tags);
            }
        });
        return [...new Set(tags)];
    }
    
    drawLayer(imageKey, colorTint, offsetY = 0) {
        if (!this.loadedImages[imageKey]) return;
        
        const img = this.loadedImages[imageKey];
        const w = 400 * this.scaleRatio;
        const h = 800 * this.scaleRatio;
        
        // Draw the image
        this.ctx.save();
        this.ctx.translate(0, offsetY * this.scaleRatio);
        
        if (colorTint && colorTint !== '#FFFFFF' && colorTint !== '#000000') {
            // Draw original image
            this.ctx.drawImage(img, 0, 0, w, h);
            
            // Tint using blending modes
            this.ctx.globalAlpha = 0.6; // Strong tint
            this.ctx.globalCompositeOperation = 'source-atop';
            this.ctx.fillStyle = colorTint;
            this.ctx.fillRect(0, 0, w, h);
            
            // Restore alpha and blend modes
            this.ctx.globalAlpha = 1.0;
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.drawImage(img, 0, 0, w, h); // Multiply the shadows back
            this.ctx.globalCompositeOperation = 'source-over';
        } else {
            this.ctx.drawImage(img, 0, 0, w, h);
        }
        
        this.ctx.restore();
    }
    
    render() {
        this.ctx.clearRect(0, 0, 400, 800);
        
        // Smooth breathing animation
        const breathOffset = Math.sin(this.time * 0.003) * 2; 
        
        // 1. Draw Base Model
        this.drawLayer('model', null, breathOffset);
        
        // 2. Draw Bottoms / Shoes
        if (this.currentOutfit.shoes) {
            this.drawLayer(this.currentOutfit.shoes.type, this.currentOutfit.shoes.defaultColor, breathOffset);
        }
        if (this.currentOutfit.bottoms) {
            this.drawLayer(this.currentOutfit.bottoms.type, this.currentOutfit.bottoms.defaultColor, breathOffset);
        }
        
        // 3. Draw Tops / Dresses (goes over bottoms)
        if (this.currentOutfit.tops) {
            this.drawLayer(this.currentOutfit.tops.type, this.currentOutfit.tops.defaultColor, breathOffset);
        }
        if (this.currentOutfit.dresses) {
            this.drawLayer(this.currentOutfit.dresses.type, this.currentOutfit.dresses.defaultColor, breathOffset);
        }
    }
    
    startAnimationLoop() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        
        const loop = (timestamp) => {
            this.time = timestamp;
            this.render();
            if (this.isAnimating) {
                requestAnimationFrame(loop);
            }
        };
        requestAnimationFrame(loop);
    }
    
    stopAnimationLoop() {
        this.isAnimating = false;
    }
}
