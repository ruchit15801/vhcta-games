const Assets = {
    images: {},
    audio: {},
    
    // SVG generators for premium assets
    generateIcon: function() {
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#2d1e15"/>
                    <stop offset="100%" stop-color="#0a0e17"/>
                </linearGradient>
                <linearGradient id="split" x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stop-color="#f39c12"/>
                    <stop offset="100%" stop-color="#00d2ff"/>
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="15" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <rect width="512" height="512" fill="url(#bg)" rx="100"/>
            <!-- Clock Outer -->
            <circle cx="256" cy="256" r="180" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="20"/>
            <circle cx="256" cy="256" r="160" fill="none" stroke="url(#split)" stroke-width="8" filter="url(#glow)"/>
            <!-- Hourglass / Infinity -->
            <path d="M 200 150 L 312 150 L 256 256 L 312 362 L 200 362 L 256 256 Z" fill="none" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
            <!-- Particles -->
            <circle cx="256" cy="180" r="10" fill="#f39c12" filter="url(#glow)"/>
            <circle cx="256" cy="332" r="10" fill="#00d2ff" filter="url(#glow)"/>
        </svg>`;
        return "data:image/svg+xml;base64," + btoa(svg);
    },

    generateThumbnail: function() {
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
            <defs>
                <linearGradient id="pastBg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#3e2723"/>
                    <stop offset="100%" stop-color="#ffb300"/>
                </linearGradient>
                <linearGradient id="futureBg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#000000"/>
                    <stop offset="100%" stop-color="#00bcd4"/>
                </linearGradient>
                <filter id="glitch">
                    <feOffset dx="5" dy="0" in="SourceGraphic" result="red-shift"/>
                    <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" in="red-shift" result="red"/>
                    <feOffset dx="-5" dy="0" in="SourceGraphic" result="blue-shift"/>
                    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" in="blue-shift" result="blue"/>
                    <feMerge>
                        <feMergeNode in="red"/>
                        <feMergeNode in="blue"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <rect x="0" y="0" width="640" height="720" fill="url(#pastBg)"/>
            <rect x="640" y="0" width="640" height="720" fill="url(#futureBg)" filter="url(#glitch)"/>
            
            <polygon points="640,0 660,720 620,720" fill="#fff" opacity="0.8"/>
            <text x="640" y="380" font-family="sans-serif" font-size="120" font-weight="bold" fill="#fff" text-anchor="middle" letter-spacing="10" filter="drop-shadow(0 0 20px rgba(255,255,255,0.5))">CHRONO ECHOES</text>
        </svg>`;
        return "data:image/svg+xml;base64," + btoa(svg);
    },

    load: async function() {
        return new Promise((resolve) => {
            this.images.icon = new Image();
            this.images.icon.src = this.generateIcon();
            
            this.images.thumbnail = new Image();
            this.images.thumbnail.src = this.generateThumbnail();

            // When all load (sync for data uris, but good practice)
            this.images.thumbnail.onload = () => resolve();
        });
    }
};
