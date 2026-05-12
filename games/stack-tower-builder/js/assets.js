/**
 * Stack Tower Builder Assets
 * Contains programmatic SVG assets for icons and thumbnails.
 */

const GameAssets = {
    // App Icon (SVG String)
    getIconSVG() {
        return `
        <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="512" height="512" rx="120" fill="url(#bg_grad)"/>
            <path d="M256 120L400 200L256 280L112 200L256 120Z" fill="#818CF8" stroke="white" stroke-width="4"/>
            <path d="M112 200L256 280V380L112 300V200Z" fill="#6366F1" stroke="white" stroke-width="4"/>
            <path d="M400 200L256 280V380L400 300V200Z" fill="#4F46E5" stroke="white" stroke-width="4"/>
            <defs>
                <linearGradient id="bg_grad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#1E293B"/>
                    <stop offset="1" stop-color="#0F172A"/>
                </linearGradient>
            </defs>
        </svg>`;
    },

    // Game Thumbnail (Base64 placeholder or SVG)
    getThumbnailSVG() {
        return `
        <svg width="1280" height="720" viewBox="0 0 1280 720" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="1280" height="720" fill="#0F172A"/>
            <circle cx="640" cy="360" r="400" fill="url(#radial)"/>
            <g transform="translate(640, 450) scale(2)">
                <path d="M0 -60L80 -20L0 20L-80 -20L0 -60Z" fill="#818CF8" stroke="white" stroke-width="2"/>
                <path d="M-80 -20L0 20V60L-80 20V-20Z" fill="#6366F1" stroke="white" stroke-width="2"/>
                <path d="M80 -20L0 20V60L80 20V-20Z" fill="#4F46E5" stroke="white" stroke-width="2"/>
                
                <path d="M0 -100L80 -60L0 -20L-80 -60L0 -100Z" fill="#A5B4FC" stroke="white" stroke-width="2"/>
                <path d="M-80 -60L0 -20V20L-80 -20V-60Z" fill="#818CF8" stroke="white" stroke-width="2"/>
                <path d="M80 -60L0 -20V20L80 -20V-60Z" fill="#6366F1" stroke="white" stroke-width="2"/>
            </g>
            <text x="640" y="200" text-anchor="middle" fill="white" font-family="Outfit" font-weight="800" font-size="120">STACK TOWER</text>
            <text x="640" y="280" text-anchor="middle" fill="#94A3B8" font-family="Outfit" font-weight="600" font-size="40" letter-spacing="10">BUILD THE ULTIMATE HEIGHT</text>
            <defs>
                <radialGradient id="radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(640 360) rotate(90) scale(400)">
                    <stop stop-color="#1E293B"/>
                    <stop offset="1" stop-color="#0F172A" stop-opacity="0"/>
                </radialGradient>
            </defs>
        </svg>`;
    }
};
