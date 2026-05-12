/**
 * Dragon Tower — Game Constants & Definitions
 */

export const GRID_COLS = 16;
export const GRID_ROWS = 12;
export const TOTAL_WAVES = 20;

// Tower definitions
export const TOWER_DEFS = {
  archer:  { name:'Archer',      icon:'🏹', cost:50,  dmg:18,  range:3.2, rate:45,  splash:0,  slow:0,    chain:0, color:'#8b6914', upgCost:60,  maxLv:3, desc:'Fast ranged attack' },
  fire:    { name:'Fire Mage',   icon:'🔥', cost:100, dmg:28,  range:2.8, rate:55,  splash:1.2,slow:0,    chain:0, color:'#cc3300', upgCost:110, maxLv:3, desc:'Splash + burn DoT' },
  frost:   { name:'Frost',       icon:'❄️', cost:80,  dmg:12,  range:3.0, rate:50,  splash:0,  slow:0.5,  chain:0, color:'#1a8ccc', upgCost:90,  maxLv:3, desc:'Slows enemies 50%' },
  thunder: { name:'Thunder',     icon:'⚡', cost:150, dmg:45,  range:3.5, rate:70,  splash:0,  slow:0,    chain:3, color:'#8844cc', upgCost:160, maxLv:3, desc:'Chains to 3 enemies' },
  death:   { name:'Death',       icon:'💀', cost:200, dmg:100, range:4.0, rate:100, splash:0,  slow:0,    chain:0, color:'#443344', upgCost:220, maxLv:3, desc:'Targets highest HP' },
  vortex:  { name:'Vortex',      icon:'🌀', cost:250, dmg:35,  range:2.5, rate:40,  splash:2.0,slow:0.35, chain:0, color:'#224466', upgCost:280, maxLv:3, desc:'AoE slow + damage' },
};

// Enemy definitions
export const ENEMY_DEFS = {
  goblin:  { name:'Goblin',   icon:'👺', hp:60,   spd:1.4, reward:8,   col:'#22aa22', size:14 },
  orc:     { name:'Orc',      icon:'👹', hp:180,  spd:1.0, reward:18,  col:'#448800', size:18 },
  troll:   { name:'Troll',    icon:'🧌', hp:400,  spd:0.8, reward:35,  col:'#228844', size:22 },
  skeleton:{ name:'Skeleton', icon:'💀', hp:100,  spd:1.8, reward:15,  col:'#ccddcc', size:14 },
  knight:  { name:'Knight',   icon:'🪖', hp:350,  spd:1.1, reward:40,  col:'#888888', size:20 },
  dragon:  { name:'Dragon',   icon:'🐲', hp:1200, spd:1.6, reward:100, col:'#cc2200', size:26 },
  demon:   { name:'Demon',    icon:'😈', hp:800,  spd:1.5, reward:80,  col:'#aa0044', size:22 },
  giant:   { name:'Giant',    icon:'🗿', hp:2000, spd:0.6, reward:150, col:'#886644', size:30 },
  phantom: { name:'Phantom',  icon:'👻', hp:150,  spd:2.2, reward:25,  col:'#aabbcc', size:16 },
  lord:    { name:'Demon Lord',icon:'👿',hp:5000, spd:0.9, reward:400, col:'#660044', size:34 },
};

// Wave definitions
export const WAVE_DEFS = [
  { name:'Scouting Party',    enemies:[{t:'goblin',n:8,gap:60}] },
  { name:'Goblin Horde',      enemies:[{t:'goblin',n:14,gap:45}] },
  { name:'Orc Vanguard',      enemies:[{t:'goblin',n:6,gap:50},{t:'orc',n:4,gap:80}] },
  { name:'Skeleton March',    enemies:[{t:'skeleton',n:10,gap:50},{t:'orc',n:4,gap:70}] },
  { name:'Mixed Forces',      enemies:[{t:'goblin',n:8,gap:40},{t:'orc',n:6,gap:60},{t:'skeleton',n:6,gap:45}] },
  { name:'Troll Assault',     enemies:[{t:'orc',n:8,gap:50},{t:'troll',n:3,gap:120}] },
  { name:'Knight Battalion',  enemies:[{t:'skeleton',n:8,gap:45},{t:'knight',n:5,gap:90}] },
  { name:'Phantom Wave',      enemies:[{t:'phantom',n:12,gap:40},{t:'orc',n:6,gap:55}] },
  { name:'Siege Advance',     enemies:[{t:'knight',n:6,gap:80},{t:'troll',n:4,gap:110},{t:'orc',n:8,gap:50}] },
  { name:'Dark Legion',       enemies:[{t:'skeleton',n:12,gap:40},{t:'knight',n:6,gap:75},{t:'troll',n:2,gap:130}] },
  { name:'Dragon Scouts',     enemies:[{t:'orc',n:10,gap:45},{t:'dragon',n:2,gap:200}] },
  { name:'Undead Army',       enemies:[{t:'skeleton',n:15,gap:38},{t:'phantom',n:8,gap:42},{t:'troll',n:3,gap:100}] },
  { name:'Demon Vanguard',    enemies:[{t:'demon',n:4,gap:100},{t:'knight',n:8,gap:70}] },
  { name:'Giant March',       enemies:[{t:'giant',n:2,gap:300},{t:'orc',n:12,gap:45}] },
  { name:'Dragon Siege',      enemies:[{t:'dragon',n:3,gap:180},{t:'demon',n:5,gap:90}] },
  { name:'Apocalypse Dawn',   enemies:[{t:'giant',n:3,gap:250},{t:'dragon',n:2,gap:200},{t:'demon',n:6,gap:80}] },
  { name:'Shadow Horde',      enemies:[{t:'phantom',n:15,gap:35},{t:'demon',n:8,gap:75},{t:'giant',n:2,gap:280}] },
  { name:'Demon Storm',       enemies:[{t:'demon',n:12,gap:60},{t:'dragon',n:4,gap:150},{t:'knight',n:10,gap:55}] },
  { name:'Last Army',         enemies:[{t:'giant',n:4,gap:220},{t:'dragon',n:5,gap:150},{t:'demon',n:10,gap:65}] },
  { name:'FINAL ONSLAUGHT',   enemies:[{t:'lord',n:1,gap:999},{t:'demon',n:15,gap:50},{t:'dragon',n:6,gap:120},{t:'giant',n:3,gap:240}] },
];
