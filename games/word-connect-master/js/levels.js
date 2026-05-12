const LEVEL_DATA = [
    // 3 Letters (1-10)
    "CAT,ACT", "DOG,GOD", "ART,RAT,TAR", "TOP,POT,OPT", "BAT,TAB", 
    "NOW,OWN,WON", "ARM,RAM,MAR", "TIP,PIT", "NAP,PAN", "ATE,TEA,EAT",
    // 4 Letters (11-30)
    "POST,STOP,SPOT,POTS", "TIME,MITE,ITEM,EMIT", "STAR,ARTS,RATS", "DEAL,LEAD",
    "CARE,RACE", "BEAR,BARE", "PART,TRAP", "MEAT,TEAM", "NODE,DONE", "FORM,FROM",
    "NAME,MEAN", "SAVE,VASE", "WAKE,WEAK", "MILE,LIME", "TAPE,PEAT",
    "SEAT,EAST", "WORD,ROW,ROD", "GOLF,LOG,FOG", "FISH,HIS,IFS", "BIRD,RIB,RID",
    // 5 Letters (31-60)
    "HEART,EARTH,HEAR,RATE", "WATER,TEAR,WEAR,RATE", "BOARD,BROAD,ROAD,BOAR", 
    "SMILE,MILES,SLIME,ISLE", "NIGHT,THING,THIN,HINT", "TRAIN,RAIN,TAR,ART", 
    "BRAIN,RAIN,BRAN", "SPACE,PACES,CAPE", "STONE,NOTES,TONES,NOSE",
    "SUPER,PURSE,SPUR,SURE", "POWER,PORE,ROPE,PROW", "MAGIC,AIM,CAM,MAC", 
    "BREAD,BEARD,BARE,DARE", "GRAPE,PAGER,PAGE,GEAR",
    "MOUSE,MUSE,SOME,SUM", "CHAIR,HAIR,RICH,ARCH", "DREAM,ARMED,READ,DARE",
    "FLOOR,FOOL,ROOF", "PLANT,PANT,PLAN", "SUGAR,RUGS,RAGS",
    "TRUCK,TUCK,RUCK", "MONEY,OMEN,ONE", "LIGHT,HILT,HIT,LIT", 
    "SOUND,UNDO,NOD", "DANCE,CANE,ACNE", "PAINT,PANT,PAIN",
    "OCEAN,CANE,CONE", "FRUIT,TURF,RUT", "GLASS,LASS,GAS", 
    "METAL,MEAL,TAME", "RIVER,RIVE,IRE", "CLOUD,LOUD,COLD",
    // 6+ Letters (61-100)
    "MASTER,STREAM,STARE,TEAM,STAR,REST", "STREET,TESTER,RESET,TEST,REST,TREE",
    "ACTION,CATION,COIN,INTO,ICON", "FOREST,FOSTER,SOFTER,STORE,REST,ROSE",
    "NATURE,MATURE,TUNE,RATE,TEAR", "CASTLE,CLEATS,STALE,TALE,SALE,LACE",
    "PUZZLE,PULE,PULZ", "ANIMAL,MANIA,MAIL,MAIN,NAIL", "ISLAND,SNAIL,DIAL,SAIL",
    "BEAUTY,TUBE,BEAT", "FAMILY,FAIL,MAIL", "WINTER,TWINE,WINE,WIRE,TIRE,RENT",
    "SUMMER,MUSE,SURE", "SPRING,RINGS,GRIP,PIGS,RING,SIGN", "AUTUMN,AUNT,MAN", 
    "PLANET,PANEL,PLANT,PALE,LANE,LATE", "SYSTEM,STEMS,MESS",
    "ENERGY,GREEN,GENE", "PEOPLE,POLE,PEEL", "PERSON,SNORE,NOSE,ROPE,PORE",
    "MOTHER,OTHER,HERO,MOTH,MORE,TEAR,HOME", "FATHER,AFTER,FEAR,HEAR,RATE",
    "SISTER,RESIST,TIRES,REST,SITE,TIRE", "BROTHER,BOTHER,ROB,HER,HOT",
    "DOCTOR,CORD,ROOT,DOOR", "POLICE,SLICE,PRICE,ICE", "SCHOOL,COOLS",
    "MARKET,MAKER,TAKE,MAKE,TEAM,MEAT", "GARDEN,DANGER,ANGER,RANGE,GEAR,READ",
    "PLAYER,PEARL,PLAY,PEAR,REAL,RELY", "RECORD,ORDER,CORD,CORE",
    "WINDOW,WIDOW,OWN,NOW", "CAMERA,MACAC,CARE", "ORANGE,RANGE,ANGER,GEAR,NEAR",
    "APPLES,PALE,SALE,SEAL", "CHERRY,HER,CRY", "BOTTLE,BOLT,LET", 
    "LAPTOP,PLOT,PAT", "SCREEN,SCENE,SNEER", "BOARD,BAKER,DARK,BORE"
];

// Fill remainder safely to easily cross 100 without manual input
function fillLevels() {
    let base = ["GALAXY,LAG,LAX", "ROCKET,ROCK,CORE,TORE", "COFFEE,FEE,OFF", "GUITAR,RUG,RIG,TAR", "PHONE,HOPE,OPEN,PEN", "LAPTOP,PLOT,POT", "PENCIL,PEN,LICE,ICE", "BOTTLE,BOLT,LET", "TABLE,ABLE,BATE,BET", "CHAIR,HAIR,AIR,CAR"];
    let idx = 0;
    while(LEVEL_DATA.length <= 100) {
        LEVEL_DATA.push(base[idx % base.length]);
        idx++;
    }
}
fillLevels();

function getLevelWords(levelIndex) {
    let index = Math.min(levelIndex - 1, LEVEL_DATA.length - 1);
    let words = LEVEL_DATA[index].split(",").map(w => w.trim().toUpperCase());
    return words;
}

// Simple Layout Engine for Crossword Grid
function generateGrid(wordsList) {
    let sortedWords = [...wordsList].sort((a,b) => b.length - a.length);
    let board = [];
    let bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    
    // Attempt placing words
    let placedWords = [];
    
    function canPlace(word, startX, startY, isHoriz) {
        let x = startX, y = startY;
        for(let i=0; i<word.length; i++) {
            let cx = isHoriz ? x + i : x;
            let cy = isHoriz ? y : y + i;
            let cell = board.find(c => c.x === cx && c.y === cy);
            if(cell && cell.char !== word[i]) return false;

            // Check neighbors to avoid accidental adjacencies
            let neighbors = [
                {x: cx+1, y: cy}, {x: cx-1, y: cy},
                {x: cx, y: cy+1}, {x: cx, y: cy-1}
            ];
            for(let n of neighbors) {
                if((isHoriz && n.y !== cy) || (!isHoriz && n.x !== cx)) {
                    // It's a lateral neighbor
                    let nCell = board.find(c => c.x === n.x && c.y === n.y);
                    if(nCell && (!cell || cell.char !== word[i])) { // Not crossing here
                         return false; 
                    }
                }
            }
        }
        return true;
    }

    function placeWord(word, startX, startY, isHoriz) {
        let cells = [];
        let x = startX, y = startY;
        for(let i=0; i<word.length; i++) {
            let cx = isHoriz ? x + i : x;
            let cy = isHoriz ? y : y + i;
            if(!board.find(c => c.x === cx && c.y === cy)) {
                board.push({x: cx, y: cy, char: word[i]});
            }
            cells.push({x: cx, y: cy, char: word[i]});
            bounds.minX = Math.min(bounds.minX, cx);
            bounds.maxX = Math.max(bounds.maxX, cx);
            bounds.minY = Math.min(bounds.minY, cy);
            bounds.maxY = Math.max(bounds.maxY, cy);
        }
        placedWords.push({word, cells, isHoriz, startX, startY});
    }

    // Place first horizontally
    placeWord(sortedWords[0], 0, 0, true);
    let unplaced = sortedWords.slice(1);
    
    let attempts = 0;
    while(unplaced.length > 0 && attempts < 50) {
        let w = unplaced.shift();
        let placed = false;
        
        // Find intersection
        for(let b of board) {
            let matchIdxs = [];
            for(let i=0; i<w.length; i++){
                if(w[i] === b.char) matchIdxs.push(i);
            }
            
            for(let i of matchIdxs) {
                // Try Vertical if b was part of a horizontal word, and vice versa
                // A simple heuristic: try both
                if(canPlace(w, b.x, b.y - i, false)) {
                    placeWord(w, b.x, b.y - i, false);
                    placed = true; break;
                }
                if(canPlace(w, b.x - i, b.y, true)) {
                    placeWord(w, b.x - i, b.y, true);
                    placed = true; break;
                }
            }
            if(placed) break;
        }
        
        if(!placed) {
            // Force place it standalone at bottom if it's struggling
            placeWord(w, bounds.minX, bounds.maxY + 2, true);
        }
        attempts++;
    }

    return {
        board,
        words: placedWords,
        width: (bounds.maxX - bounds.minX) + 1,
        height: (bounds.maxY - bounds.minY) + 1,
        offsetX: -bounds.minX,
        offsetY: -bounds.minY
    };
}
