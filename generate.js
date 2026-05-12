const fs = require('fs');
const path = require('path');

const gamesDir = path.join(__dirname, 'games');
const gamesJsPath = path.join(__dirname, 'js', 'games.js');
const sitemapPath = path.join(__dirname, 'sitemap.xml');
const BASE_URL = 'https://vhcta.com';
const TODAY = new Date().toISOString().split('T')[0];

const defaultCategories = ['puzzle', 'action', 'arcade', 'strategy', 'racing', 'sports'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str) {
    return str.replace(/ /g, '-').replace(/_/g, '-').toLowerCase();
}

function titleCase(str) {
    return str.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getAllFiles(dirPath, arrayOfFiles) {
    let files;
    try { files = fs.readdirSync(dirPath); } catch (e) { return arrayOfFiles || []; }
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(file => {
        const full = path.join(dirPath, file);
        try {
            if (fs.statSync(full).isDirectory()) {
                arrayOfFiles = getAllFiles(full, arrayOfFiles);
            } else {
                arrayOfFiles.push(full);
            }
        } catch (e) {}
    });
    return arrayOfFiles;
}

// Find the real playable index.html path for a game folder
function findIndexPath(dir) {
    const candidates = [
        `games/${dir}/index.html`,
        `games/${dir}/dist/index.html`,
        `games/${dir}/Deploy/index.html`,
        `games/${dir}/build/index.html`,
        `games/${dir}/public/index.html`,
    ];
    for (const c of candidates) {
        if (fs.existsSync(path.join(__dirname, c))) return c;
    }
    return null; // game not playable — skip from sitemap
}

// Score and pick the best thumbnail image
function findBestThumbnail(dir, id) {
    // Priority 1: curated assets/thumbs/
    if (fs.existsSync(path.join(__dirname, `assets/thumbs/${id}.png`)))
        return `assets/thumbs/${id}.png`;
    if (fs.existsSync(path.join(__dirname, `assets/thumbs/${dir}.png`)))
        return `assets/thumbs/${dir}.png`;

    const allFiles = getAllFiles(path.join(gamesDir, dir), []);
    const imageFiles = allFiles.filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
    });

    if (imageFiles.length === 0) return '';

    let best = imageFiles[0], bestScore = -9999;
    imageFiles.forEach(img => {
        let score = 0;
        const low = img.toLowerCase();
        if (low.includes('icon'))      score += 30;
        if (low.includes('thumb'))     score += 30;
        if (low.includes('cover'))     score += 20;
        if (low.includes('logo'))      score += 10;
        if (low.includes('256'))       score += 5;
        if (low.includes('512'))       score += 5;
        if (low.includes('192'))       score += 4;
        if (low.endsWith('.png'))      score += 2;
        if (low.includes('bg') || low.includes('background')) score -= 25;
        if (low.includes('sprite'))    score -= 25;
        if (low.includes('button'))    score -= 10;
        if (low.includes('particle'))  score -= 15;
        if (low.includes('shadow'))    score -= 15;
        if (low.includes('ui'))        score -= 10;
        if (low.includes('tile'))      score -= 10;
        if (score > bestScore) { bestScore = score; best = img; }
    });

    return path.relative(__dirname, best).replace(/\\/g, '/');
}

// ── Category mapping for known game IDs ──────────────────────────────────────
const CATEGORY_MAP = {
    'puzzle': ['puzzle','2048','match','sliding','word','sudoku','jigsaw','ice-slide','fit-shape','color-path','samegame','feed-the-frog','bomb-defuse','hidden-easter','maze-escape','memory','card-memory','quantum-cube','time-travel'],
    'action': ['action','shooting','combat','blade','bomb','battle-royale','bridge-race','bridge-cross','energy-boost','escape-room','firefighter','gun','dual-stick','ninja','shooter','survival','zombie','hacker','jetpack','laser','robot-jump'],
    'arcade': ['arcade','2048','mimstris','teeter','snake','flappy','brick','bubble','cannon','color-switch','basket','cooking','tap','helix','stack','neon-breakout','pop','balloon','alien','coin-rush'],
    'strategy': ['strategy','chess','tower','defense','city','build','factory','automation','idle','management','space-colony','hoop','golf','archer-defense','bridge-construction'],
    'racing': ['racing','racer','car','drift','highway','fast','speed','bike','moto','dirt','crowd-runner','draw-bridge','endless','gravity','fishing-sim','bubble-tap','card-memory-b','count-masters','cube-adventure','dual'],
    'sports': ['sports','golf','basketball','football','fishing','delivery','watermelon','cave','color-path-b','ball-run','swimming','athletic','hoop','farm','island','underwater','rope'],
};

function detectCategory(id, dir) {
    const key = (id + ' ' + dir).toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
        if (keywords.some(kw => key.includes(kw))) return cat;
    }
    return defaultCategories[Math.floor(Math.random() * defaultCategories.length)];
}

// ── Main processing ───────────────────────────────────────────────────────────

const dirs = fs.readdirSync(gamesDir)
    .filter(f => {
        try { return fs.statSync(path.join(gamesDir, f)).isDirectory(); } catch(e) { return false; }
    });

const games = [];
const workingEndpoints = []; // only games with real index.html

dirs.forEach(dir => {
    const id       = dir.replace(/ /g, '_').toLowerCase();
    const slug     = slugify(dir) + '-game';
    const title    = titleCase(dir);
    const indexPath = findIndexPath(dir);
    const thumb    = findBestThumbnail(dir, id);
    const category = detectCategory(id, dir);
    const hasIndex = !!indexPath;

    const game = {
        id,
        slug,
        title,
        category,
        creator: "VHCTA Games",
        path: indexPath || `games/${dir}/index.html`,
        thumbnail: thumb,
        description: `Play ${title} online for free!`,
        longDescription: `${title} is an exciting ${category} game available for free on VHCTA Games. Jump in, complete challenges, beat high scores, and enjoy instant fun — no downloads required.`,
        howToPlay: "Use your mouse or touch to interact. Follow the on-screen instructions to play. Enjoy!",
        isTrending: false,
        hasIndex
    };
    games.push(game);
    if (hasIndex) workingEndpoints.push(game);
});

// ── Sort: curated thumbs first, then by index.html presence ──────────────────
games.sort((a, b) => {
    const thumbScore = g => {
        if (g.thumbnail.startsWith('assets/thumbs/')) return 2000;
        if (g.thumbnail.includes('icon')) return 500;
        if (g.thumbnail.endsWith('.png')) return 200;
        return 0;
    };
    const indexBonus = g => g.hasIndex ? 1000 : 0;
    return (thumbScore(b) + indexBonus(b)) - (thumbScore(a) + indexBonus(a));
});

// ── Mark trending (every 11th among the top sorted ones) ─────────────────────
let trendCount = 0;
games.forEach((g, i) => {
    if (i % 11 === 0 && trendCount < 12) { g.isTrending = true; trendCount++; }
    else g.isTrending = false;
});

// ── Strip internal field before writing ──────────────────────────────────────
const output = games.map(({ hasIndex, ...rest }) => rest);

fs.writeFileSync(gamesJsPath, `window.GAMES = ${JSON.stringify(output, null, 4)};\n`);
console.log(`✅ games.js regenerated — ${games.length} total, ${workingEndpoints.length} with working index.html`);

// ── Generate Sitemap ──────────────────────────────────────────────────────────
const staticPages = [
    { url: '/',        freq: 'daily',   pri: '1.0' },
    { url: '/about',   freq: 'monthly', pri: '0.5' },
    { url: '/contact', freq: 'monthly', pri: '0.5' },
    { url: '/privacy', freq: 'monthly', pri: '0.3' },
    { url: '/terms',   freq: 'monthly', pri: '0.3' },
];

const gameUrls = workingEndpoints.map(g =>
    `  <url><loc>${BASE_URL}/games/${g.slug}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`
).join('\n');

const staticUrls = staticPages.map(p =>
    `  <url>\n    <loc>${BASE_URL}${p.url}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${p.freq}</changefreq>\n    <priority>${p.pri}</priority>\n  </url>`
).join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Static Pages -->
${staticUrls}

  <!-- Game Detail Pages (${workingEndpoints.length} working games) -->
${gameUrls}

</urlset>
`;

fs.writeFileSync(sitemapPath, sitemap);
console.log(`✅ sitemap.xml generated — ${staticPages.length} static + ${workingEndpoints.length} game URLs`);
console.log(`\n📋 Working game endpoints (${workingEndpoints.length}):`);
workingEndpoints.forEach(g => console.log(`   ${BASE_URL}/games/${g.slug}  →  /${g.path}`));
