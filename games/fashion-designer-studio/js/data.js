// Fashion Designer Studio - Game Data

// SVGs for the Studio feel - Now with explicit width/height to fix rendering issues
// Added HIGH DETAIL shadows, highlights, and realistic fabric folds

const RAW_SVGS = {
    model: `<svg width="400" height="800" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <radialGradient id="faceGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#FFD6C0"/>
                <stop offset="100%" stop-color="#EAA684"/>
            </radialGradient>
            <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#EAA684"/>
                <stop offset="30%" stop-color="#FFD6C0"/>
                <stop offset="70%" stop-color="#FFD6C0"/>
                <stop offset="100%" stop-color="#D8906B"/>
            </linearGradient>
            <filter id="shadow"><feDropShadow dx="0" dy="15" stdDeviation="20" flood-opacity="0.15"/></filter>
            <filter id="softGlow"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <g filter="url(#shadow)">
            <!-- Hair -->
            <path d="M 160,50 C 130,50 120,100 130,160 C 140,220 160,250 160,250 L 175,180 C 180,120 220,120 225,180 L 240,250 C 240,250 260,220 270,160 C 280,100 270,50 240,50 C 210,50 190,20 160,50 Z" fill="#2A1B18"/>
            <path d="M 165,55 C 140,65 135,100 145,150 C 150,180 165,220 165,220 L 170,160 C 175,120 215,120 220,160 L 225,220 C 225,220 240,180 245,150 C 255,100 250,65 225,55 C 200,45 185,45 165,55 Z" fill="#3D2924"/>
            <!-- Head & Neck -->
            <path d="M 200,55 C 225,55 235,95 215,125 C 205,140 195,140 185,125 C 165,95 175,55 200,55 Z" fill="url(#faceGrad)"/>
            <path d="M 188,120 L 212,120 L 220,160 C 200,165 200,165 180,160 Z" fill="url(#bodyGrad)"/>
            <path d="M 188,120 L 212,120 L 208,135 C 200,140 200,140 192,135 Z" fill="#D8906B" opacity="0.5"/> <!-- Neck shadow -->
            <!-- Torso -->
            <path d="M 180,160 C 145,165 135,190 125,250 C 115,310 110,400 115,420 L 130,420 C 130,350 135,300 145,260 L 160,330 C 165,400 155,440 160,490 C 165,540 170,550 200,550 C 230,550 235,540 240,490 C 245,440 235,400 240,330 L 255,260 C 265,300 270,350 270,420 L 285,420 C 290,400 285,310 275,250 C 265,190 255,165 220,160 Z" fill="url(#bodyGrad)"/>
            <!-- Collarbones -->
            <path d="M 175,175 C 185,180 190,180 200,175 M 225,175 C 215,180 210,180 200,175" stroke="#D8906B" stroke-width="1.5" fill="none" opacity="0.6"/>
            <!-- Bust detailing -->
            <path d="M 160,220 C 175,245 190,245 200,220" stroke="#D8906B" stroke-width="1" fill="none" opacity="0.4"/>
            <path d="M 240,220 C 225,245 210,245 200,220" stroke="#D8906B" stroke-width="1" fill="none" opacity="0.4"/>
            <!-- Legs -->
            <path d="M 160,540 C 145,600 145,700 155,770 L 175,770 C 175,680 185,600 195,540 Z" fill="url(#bodyGrad)"/>
            <path d="M 240,540 C 255,600 255,700 245,770 L 225,770 C 225,680 215,600 205,540 Z" fill="url(#bodyGrad)"/>
            <!-- Knee detailing -->
            <path d="M 160,650 C 165,655 170,655 175,650" stroke="#D8906B" stroke-width="1" fill="none" opacity="0.4"/>
            <path d="M 240,650 C 235,655 230,655 225,650" stroke="#D8906B" stroke-width="1" fill="none" opacity="0.4"/>
            <!-- Face -->
            <path d="M 190,95 C 193,92 197,92 200,95" stroke="#603813" stroke-width="1.5" fill="none"/>
            <path d="M 210,95 C 207,92 203,92 200,95" stroke="#603813" stroke-width="1.5" fill="none"/>
            <circle cx="193" cy="100" r="2" fill="#3D2924"/>
            <circle cx="207" cy="100" r="2" fill="#3D2924"/>
            <path d="M 195,115 C 200,118 200,118 205,115" stroke="#C06060" stroke-width="2" fill="none"/>
        </g>
    </svg>`,
    
    // Dresses - Highly detailed
    dress_elegant: `<svg width="400" height="800" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="silk" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FFFFFF"/>
                <stop offset="30%" stop-color="#EEEEEE"/>
                <stop offset="50%" stop-color="#DDDDDD"/>
                <stop offset="80%" stop-color="#F5F5F5"/>
                <stop offset="100%" stop-color="#BBBBBB"/>
            </linearGradient>
            <filter id="cloth-shadow"><feDropShadow dx="3" dy="8" stdDeviation="5" flood-opacity="0.4"/></filter>
        </defs>
        <!-- Back layer of dress -->
        <path d="M 160,400 L 130,780 L 270,780 L 240,400 Z" fill="#BBBBBB" filter="url(#cloth-shadow)"/>
        <!-- Main Dress Body with folds -->
        <path d="M 165,190 C 180,220 220,220 235,190 C 245,260 235,320 230,400 C 260,500 280,650 285,780 L 115,780 C 120,650 140,500 170,400 C 165,320 155,260 165,190 Z" fill="url(#silk)" filter="url(#cloth-shadow)"/>
        <!-- Fabric Folds Details (Highlights & Shadows) -->
        <path d="M 170,400 Q 150,600 135,780" stroke="#CCCCCC" stroke-width="3" fill="none" opacity="0.6"/>
        <path d="M 230,400 Q 250,600 265,780" stroke="#CCCCCC" stroke-width="3" fill="none" opacity="0.6"/>
        <path d="M 200,400 Q 200,600 190,780" stroke="#FFFFFF" stroke-width="5" fill="none" opacity="0.8"/>
        <path d="M 200,400 Q 210,600 220,780" stroke="#BBBBBB" stroke-width="4" fill="none" opacity="0.5"/>
        <!-- Waist Belt -->
        <path d="M 165,390 C 180,400 220,400 235,390 L 235,405 C 220,415 180,415 165,405 Z" fill="#333333"/>
    </svg>`,
    
    dress_party: `<svg width="400" height="800" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="glitter" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FFFFFF"/>
                <stop offset="25%" stop-color="#F8F8F8"/>
                <stop offset="50%" stop-color="#E0E0E0"/>
                <stop offset="75%" stop-color="#F8F8F8"/>
                <stop offset="100%" stop-color="#CCCCCC"/>
            </linearGradient>
            <filter id="glow"><feDropShadow dx="0" dy="5" stdDeviation="8" flood-opacity="0.3" flood-color="#FFF"/></filter>
        </defs>
        <!-- Dress Silhouette -->
        <path d="M 160,200 L 175,220 C 190,230 210,230 225,220 L 240,200 C 245,260 235,330 245,450 C 255,470 230,520 200,520 C 170,520 145,470 155,450 C 165,330 155,260 160,200 Z" fill="url(#glitter)" filter="url(#glow)"/>
        <!-- Sequin sparkles (simulated with white dots/lines) -->
        <circle cx="170" cy="250" r="2" fill="#FFF"/>
        <circle cx="230" cy="270" r="1.5" fill="#FFF"/>
        <circle cx="180" cy="350" r="2" fill="#FFF"/>
        <circle cx="220" cy="400" r="1.5" fill="#FFF"/>
        <circle cx="190" cy="480" r="2.5" fill="#FFF"/>
        <circle cx="210" cy="460" r="1.5" fill="#FFF"/>
        <!-- Cutout details -->
        <path d="M 165,390 C 180,410 220,410 235,390" stroke="#DDDDDD" stroke-width="2" fill="none"/>
    </svg>`,
    
    // Tops
    top_casual: `<svg width="400" height="800" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="shadowT"><feDropShadow dx="1" dy="3" stdDeviation="2" flood-opacity="0.2"/></filter></defs>
        <path d="M 165,165 C 180,185 220,185 235,165 L 260,230 L 240,240 L 235,210 L 240,370 C 220,380 180,380 160,370 L 165,210 L 160,240 L 140,230 Z" fill="#FFFFFF" filter="url(#shadowT)"/>
        <path d="M 180,210 Q 185,300 175,360" stroke="#EEEEEE" stroke-width="2" fill="none"/>
        <path d="M 220,210 Q 215,300 225,360" stroke="#EEEEEE" stroke-width="2" fill="none"/>
    </svg>`,
    
    top_formal: `<svg width="400" height="800" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="shadowF"><feDropShadow dx="1" dy="4" stdDeviation="3" flood-opacity="0.25"/></filter></defs>
        <path d="M 175,160 L 200,220 L 225,160 C 235,165 245,200 240,260 C 230,320 235,360 235,380 C 210,390 190,390 165,380 C 165,360 170,320 160,260 C 155,200 165,165 175,160 Z" fill="#F4F4F4" filter="url(#shadowF)"/>
        <!-- Silk folds -->
        <path d="M 200,220 Q 190,300 195,380" stroke="#DDDDDD" stroke-width="3" fill="none"/>
        <path d="M 200,220 Q 210,300 205,380" stroke="#FFFFFF" stroke-width="3" fill="none"/>
    </svg>`,
    
    // Bottoms
    skirt_casual: `<svg width="400" height="800" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="shadowB"><feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.3"/></filter></defs>
        <path d="M 160,370 C 180,380 220,380 240,370 C 255,430 260,490 245,510 C 220,520 180,520 155,510 C 140,490 145,430 160,370 Z" fill="#FFFFFF" filter="url(#shadowB)"/>
        <!-- Denim seams / pockets -->
        <path d="M 165,380 C 175,410 185,410 185,385" stroke="#EEEEEE" stroke-width="2" fill="none"/>
        <path d="M 235,380 C 225,410 215,410 215,385" stroke="#EEEEEE" stroke-width="2" fill="none"/>
        <!-- Folds -->
        <path d="M 180,450 Q 190,480 185,510" stroke="#DDDDDD" stroke-width="2" fill="none"/>
        <path d="M 220,450 Q 210,480 215,510" stroke="#DDDDDD" stroke-width="2" fill="none"/>
    </svg>`,
    
    pants_formal: `<svg width="400" height="800" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="shadowP"><feDropShadow dx="1" dy="3" stdDeviation="2" flood-opacity="0.2"/></filter></defs>
        <path d="M 160,370 C 180,380 220,380 240,370 L 255,750 L 215,750 L 205,480 L 195,480 L 185,750 L 145,750 Z" fill="#E8E8E8" filter="url(#shadowP)"/>
        <!-- Creases -->
        <path d="M 180,390 L 165,750" stroke="#CCCCCC" stroke-width="2" fill="none"/>
        <path d="M 220,390 L 235,750" stroke="#CCCCCC" stroke-width="2" fill="none"/>
    </svg>`,
    
    // Shoes
    shoes_heels: `<svg width="400" height="800" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg">
        <path d="M 155,765 C 165,765 175,785 180,785 L 185,775 C 180,755 160,755 155,765 Z" fill="#222222"/>
        <path d="M 155,765 L 150,795" stroke="#222222" stroke-width="3" stroke-linecap="round"/>
        <path d="M 245,765 C 235,765 225,785 220,785 L 215,775 C 220,755 240,755 245,765 Z" fill="#222222"/>
        <path d="M 245,765 L 250,795" stroke="#222222" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    
    shoes_sneakers: `<svg width="400" height="800" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg">
        <path d="M 150,760 C 160,755 175,765 185,775 C 185,785 170,785 150,780 C 145,775 145,765 150,760 Z" fill="#FFFFFF" stroke="#DDDDDD" stroke-width="2"/>
        <path d="M 250,760 C 240,755 225,765 215,775 C 215,785 230,785 250,780 C 255,775 255,765 250,760 Z" fill="#FFFFFF" stroke="#DDDDDD" stroke-width="2"/>
        <path d="M 155,775 L 175,780 M 245,775 L 225,780" stroke="#CCCCCC" stroke-width="2"/>
    </svg>`
};

const SVGS = {};
for (const key in RAW_SVGS) {
    SVGS[key] = 'data:image/svg+xml;base64,' + btoa(RAW_SVGS[key]);
}

const WARDROBE = [
    { id: 'd1', category: 'dresses', name: 'Silk Gala Gown', type: 'dress_elegant', defaultColor: '#E74C3C', tags: ['formal', 'elegant', 'party'], price: 0 },
    { id: 'd2', category: 'dresses', name: 'Midnight Sparkle', type: 'dress_party', defaultColor: '#2C3E50', tags: ['party', 'elegant'], price: 100 },
    { id: 'd3', category: 'dresses', name: 'Emerald Dream', type: 'dress_elegant', defaultColor: '#27AE60', tags: ['formal', 'elegant'], price: 150 },
    
    { id: 't1', category: 'tops', name: 'Basic White Tee', type: 'top_casual', defaultColor: '#FFFFFF', tags: ['casual'], price: 0 },
    { id: 't2', category: 'tops', name: 'Silk Blouse', type: 'top_formal', defaultColor: '#FDF5E6', tags: ['formal', 'elegant'], price: 80 },
    { id: 't3', category: 'tops', name: 'Crop Top', type: 'top_casual', defaultColor: '#E74C3C', tags: ['casual', 'party'], price: 50 },
    
    { id: 'b1', category: 'bottoms', name: 'Denim Skirt', type: 'skirt_casual', defaultColor: '#3498DB', tags: ['casual'], price: 0 },
    { id: 'b2', category: 'bottoms', name: 'Tailored Pants', type: 'pants_formal', defaultColor: '#111111', tags: ['formal', 'elegant'], price: 90 },
    { id: 'b3', category: 'bottoms', name: 'Leather Skirt', type: 'skirt_casual', defaultColor: '#222222', tags: ['party', 'casual'], price: 120 },
    
    { id: 's1', category: 'shoes', name: 'Classic Stilettos', type: 'shoes_heels', defaultColor: '#000000', tags: ['formal', 'elegant', 'party'], price: 0 },
    { id: 's2', category: 'shoes', name: 'White Sneakers', type: 'shoes_sneakers', defaultColor: '#FFFFFF', tags: ['casual'], price: 60 },
    { id: 's3', category: 'shoes', name: 'Red Bottoms', type: 'shoes_heels', defaultColor: '#C0392B', tags: ['formal', 'party', 'luxury'], price: 250 }
];

const CATEGORIES = [
    { id: 'dresses', name: 'Dresses' },
    { id: 'tops', name: 'Tops' },
    { id: 'bottoms', name: 'Bottoms' },
    { id: 'shoes', name: 'Shoes' }
];

const LEVELS = [
    {
        id: 1,
        title: 'Casual Coffee Date',
        desc: 'Style a comfortable yet chic look for a morning coffee run.',
        requiredTags: ['casual'],
        rewardCoins: 100,
        unlocked: true
    },
    {
        id: 2,
        title: 'The Paris Gala',
        desc: 'Design a breathtaking, elegant look for the red carpet event of the year.',
        requiredTags: ['formal', 'elegant'],
        rewardCoins: 250,
        unlocked: false
    },
    {
        id: 3,
        title: 'Neon Nights',
        desc: 'A VIP club opening downtown. Make it pop!',
        requiredTags: ['party'],
        rewardCoins: 300,
        unlocked: false
    },
    {
        id: 4,
        title: 'Luxury Yacht Cruise',
        desc: 'High-end elegant summer vibe. Think luxury and comfort.',
        requiredTags: ['elegant', 'casual'],
        rewardCoins: 400,
        unlocked: false
    }
];

// Utility: Generate remaining levels up to 50
const trendPool = [['casual'], ['formal', 'elegant'], ['party'], ['casual', 'party']];
const titlePool = ['Streetwear Fashion', 'Award Show', 'Summer Festival', 'Business Meeting', 'Fashion Week Front Row', 'Beach Resort', 'Winter Wonderland'];

for(let i = 5; i <= 50; i++) {
    let rand = Math.floor(Math.random() * trendPool.length);
    LEVELS.push({
        id: i,
        title: titlePool[Math.floor(Math.random() * titlePool.length)] + ' Vol. ' + (Math.floor(i/5)+1),
        desc: 'Match the trends and score high to unlock the next level.',
        requiredTags: trendPool[rand],
        rewardCoins: 100 + (i * 10),
        unlocked: false
    });
}
