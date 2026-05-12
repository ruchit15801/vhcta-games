/* ══════════════════════════════════════════════════════════
   TRAIN CONTROL MANAGER v2 — Realistic World Engine
   ══════════════════════════════════════════════════════════ */
'use strict';

// ═══════════════════════════════════════════════════════════
// CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════════════
const CFG = {
  FPS:             60,
  TRAIN_W:         95,    // Doubled for impact
  TRAIN_H:         32,    // Doubled for impact
  STATION_R:       50,    // Larger stations
  SIGNAL_R:        20,    // Highly visible signals
  COLLISION_DIST:  70,    // Adjusted for larger trains
  DANGER_DIST:     160,   // Adjusted for larger trains
  BASE_SPEED:      65,
  SCORE_SAFE:      15,
  SCORE_COMBO:     30,
  SCORE_PERFECT:   60,
  COMBO_TIMEOUT:   3000,
  WHEEL_R:         11,    // Thicker wheels
  HORN_DIST:       180,   // Triggers earlier
};

const TRAIN_COLORS = [
  { body:'#c0392b', stripe:'#e74c3c', roof:'#96281b', window:'#85c1e9' },  // Red Express
  { body:'#1a5276', stripe:'#2980b9', roof:'#154360', window:'#a9cce3' },  // Blue Arrow
  { body:'#1e8449', stripe:'#27ae60', roof:'#196f3d', window:'#a9dfbf' },  // Green Flyer
  { body:'#7d3c98', stripe:'#9b59b6', roof:'#6c3483', window:'#d2b4de' },  // Purple Metro
  { body:'#d35400', stripe:'#e67e22', roof:'#a04000', window:'#fad7a0' },  // Orange Express
  { body:'#2e4057', stripe:'#00e5ff', roof:'#1a2636', window:'#b2ebf2' },  // Midnight Neon
  { body:'#7f8c8d', stripe:'#bdc3c7', roof:'#616a6b', window:'#d5d8dc' },  // Silver Bullet
  { body:'#b7950b', stripe:'#f1c40f', roof:'#9a7d0a', window:'#fde8a8' },  // Gold Line
];

// ═══════════════════════════════════════════════════════════
// SOUND ENGINE (Web Audio API — train horn + rich audio)
// ═══════════════════════════════════════════════════════════
const Sound = (() => {
  let ctx = null, muted = false, ambientNode = null, ambientGain = null;
  let hornCooldown = {};

  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function play(type, vol = 0.5, id='') {
    if (muted) return;
    const c = getCtx(); if (!c) return;

    // Cooldown for horn (per train)
    if (type === 'horn') {
      const now = Date.now();
      if (hornCooldown[id] && now - hornCooldown[id] < 4000) return;
      hornCooldown[id] = now;
    }

    const g = c.createGain(); g.gain.setValueAtTime(vol, c.currentTime);
    g.connect(c.destination);

    switch(type) {
      case 'horn': {
        // Classic train horn: two-tone blast
        [220, 277, 330].forEach((freq, i) => {
          const o = c.createOscillator();
          const gn = c.createGain();
          o.connect(gn); gn.connect(c.destination);
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(freq, c.currentTime + i*0.05);
          gn.gain.setValueAtTime(vol * 0.35, c.currentTime + i*0.05);
          gn.gain.setValueAtTime(vol * 0.35, c.currentTime + 0.4);
          gn.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6 + i*0.05);
          o.start(c.currentTime + i*0.05);
          o.stop(c.currentTime + 0.7 + i*0.05);
        });
        break;
      }
      case 'signal': {
        const o = c.createOscillator();
        o.connect(g); o.type = 'sine';
        o.frequency.setValueAtTime(880, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(1100, c.currentTime + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
        o.start(); o.stop(c.currentTime + 0.25);
        break;
      }
      case 'signal_stop': {
        const o = c.createOscillator();
        o.connect(g); o.type = 'sine';
        o.frequency.setValueAtTime(440, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.2);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
        o.start(); o.stop(c.currentTime + 0.25);
        break;
      }
      case 'wheelclack': {
        // Rhythmic metal clack
        const buf = c.createBuffer(1, c.sampleRate * 0.04, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random()*2-1) * Math.exp(-i/(data.length*0.15));
        }
        const src = c.createBufferSource();
        const filt = c.createBiquadFilter();
        filt.type = 'bandpass'; filt.frequency.value = 400; filt.Q.value = 1.5;
        src.buffer = buf; src.connect(filt); filt.connect(g);
        g.gain.setValueAtTime(vol * 0.4, c.currentTime);
        src.start(); src.stop(c.currentTime + 0.04);
        break;
      }
      case 'collision': {
        [80, 120, 60].forEach((freq, i) => {
          const o = c.createOscillator();
          const gn = c.createGain();
          o.connect(gn); gn.connect(c.destination);
          o.type = 'sawtooth'; o.frequency.value = freq;
          gn.gain.setValueAtTime(vol * 0.5, c.currentTime + i*0.02);
          gn.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.0);
          o.start(c.currentTime + i*0.02);
          o.stop(c.currentTime + 1.0);
        });
        break;
      }
      case 'warning': {
        [0, 0.18, 0.36].forEach(delay => {
          const o = c.createOscillator();
          const g2 = c.createGain();
          o.connect(g2); g2.connect(c.destination);
          o.type = 'sine'; o.frequency.value = 1000;
          g2.gain.setValueAtTime(vol*0.5, c.currentTime + delay);
          g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.15);
          o.start(c.currentTime + delay); o.stop(c.currentTime + delay + 0.15);
        });
        break;
      }
      case 'score': {
        const o = c.createOscillator();
        o.connect(g); o.type = 'sine';
        [523,659,784,1047].forEach((f, i) => {
          o.frequency.setValueAtTime(f, c.currentTime + i*0.07);
        });
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
        o.start(); o.stop(c.currentTime + 0.4);
        break;
      }
      case 'levelup': {
        const notes = [523,659,784,1047,1319];
        notes.forEach((f, i) => {
          const o = c.createOscillator();
          const g2 = c.createGain();
          o.connect(g2); g2.connect(c.destination);
          o.type = 'sine'; o.frequency.value = f;
          g2.gain.setValueAtTime(vol*0.5, c.currentTime + i*0.1);
          g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i*0.1 + 0.35);
          o.start(c.currentTime + i*0.1); o.stop(c.currentTime + i*0.1 + 0.35);
        });
        break;
      }
      case 'brake': {
        const buf = c.createBuffer(1, c.sampleRate*0.3, c.sampleRate);
        const d = buf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length)*0.6;
        const src = c.createBufferSource();
        const filt = c.createBiquadFilter(); filt.type='highpass'; filt.frequency.value=600;
        src.buffer=buf; src.connect(filt); filt.connect(g);
        g.gain.setValueAtTime(vol*0.4, c.currentTime);
        src.start(); src.stop(c.currentTime+0.3);
        break;
      }
    }
  }

  function startAmbient() {
    if (muted) return;
    const c = getCtx(); if (!c || ambientNode) return;
    ambientGain = c.createGain(); ambientGain.gain.value = 0.03;
    ambientGain.connect(c.destination);
    // Wind + distant rumble
    const o1 = c.createOscillator(); o1.type='sine'; o1.frequency.value=55;
    const o2 = c.createOscillator(); o2.type='sine'; o2.frequency.value=57.5;
    o1.connect(ambientGain); o2.connect(ambientGain);
    o1.start(); o2.start();
    ambientNode = [o1, o2];
  }

  function stopAmbient() {
    if (!ambientNode) return;
    ambientNode.forEach(o => { try{ o.stop(); }catch(e){} });
    ambientNode = null;
  }

  function toggleMute() {
    muted = !muted;
    if (muted) { stopAmbient(); if (ctx) ctx.suspend(); }
    else        { if (ctx) ctx.resume(); startAmbient(); }
    return muted;
  }

  return { play, startAmbient, stopAmbient, toggleMute, get muted(){ return muted; } };
})();

// ═══════════════════════════════════════════════════════════
// LEVEL DEFINITIONS (20 levels)
// ═══════════════════════════════════════════════════════════
function buildLevels() {
  const zones = [
    {
      id:1, name:'GREEN VALLEY', badge:'easy', color:'#00ff9d',
      levels:[
        { id:1,  name:'First Ride',       layout:'straight1', trainCount:1, targetScore:200,  timeLimit:60,  trainSpeeds:[0.55], description:'Control one train. Stop at the red signal!' },
        { id:2,  name:'Signal Master',     layout:'straight2', trainCount:1, targetScore:350,  timeLimit:75,  trainSpeeds:[0.65], description:'Two signals — time them perfectly.' },
        { id:3,  name:'Dual Track',        layout:'parallel',  trainCount:2, targetScore:500,  timeLimit:90,  trainSpeeds:[0.55,0.60], description:'Two trains on parallel tracks. Stay safe!' },
        { id:4,  name:'Speed Up',          layout:'straight1', trainCount:1, targetScore:400,  timeLimit:60,  trainSpeeds:[0.85], description:'Faster train! React quickly.' },
      ]
    },
    {
      id:2, name:'IRON RIDGE', badge:'medium', color:'#ffd700',
      levels:[
        { id:5,  name:'Junction City',     layout:'junction1', trainCount:2, targetScore:700,  timeLimit:100, trainSpeeds:[0.60,0.65], description:'First intersection! Prevent crossing collisions.' },
        { id:6,  name:'Rush Hour',         layout:'parallel',  trainCount:3, targetScore:900,  timeLimit:110, trainSpeeds:[0.65,0.70,0.60], description:'Three trains! Stay focused.' },
        { id:7,  name:'Cross Roads',       layout:'cross1',    trainCount:2, targetScore:1000, timeLimit:120, trainSpeeds:[0.65,0.75], description:'Cross junction — ultimate timing.' },
        { id:8,  name:'Express Lane',      layout:'junction1', trainCount:3, targetScore:1200, timeLimit:130, trainSpeeds:[0.90,0.70,0.60], description:'One express train! Manage priority routing.' },
      ]
    },
    {
      id:3, name:'STEEL CANYON', badge:'hard', color:'#ff6b2b',
      levels:[
        { id:9,  name:'Metro Network',     layout:'network1',  trainCount:3, targetScore:1500, timeLimit:140, trainSpeeds:[0.75,0.80,0.70] , description:'Complex metro network. Multiple routes!' },
        { id:10, name:'Night Shift',       layout:'cross2',    trainCount:4, targetScore:1800, timeLimit:150, trainSpeeds:[0.80,0.85,0.90,0.70], description:'Four trains. Heavy traffic.' },
        { id:11, name:'High Speed',        layout:'network1',  trainCount:3, targetScore:2000, timeLimit:160, trainSpeeds:[1.0,0.95,0.85], description:'High-speed trains. Fast decisions!' },
        { id:12, name:'Chaos Theory',      layout:'network2',  trainCount:4, targetScore:2400, timeLimit:170, trainSpeeds:[1.0,0.95,0.90,0.85], description:'Maximum complexity.' },
        { id:13, name:'The Grid',          layout:'cross2',    trainCount:5, targetScore:2800, timeLimit:180, trainSpeeds:[0.90,0.95,1.0,0.85,0.80], description:'Five trains, seven signals!' },
      ]
    },
    {
      id:4, name:'NEON HEIGHTS', badge:'expert', color:'#ff3366',
      levels:[
        { id:14, name:'Bullet Run',        layout:'network2',  trainCount:4, targetScore:3200, timeLimit:180, trainSpeeds:[1.2,1.1,1.0,0.95], description:'Bullet trains! Split-second reactions.' },
        { id:15, name:'Signal Storm',      layout:'network3',  trainCount:5, targetScore:3800, timeLimit:200, trainSpeeds:[1.2,1.1,1.0,1.0,0.95], description:'Storm of signals. Master them all!' },
        { id:16, name:'Terminal Velocity', layout:'network3',  trainCount:5, targetScore:4500, timeLimit:210, trainSpeeds:[1.3,1.2,1.1,1.0,0.95], description:'Top speed trains. Maximum danger!' },
        { id:17, name:'Critical Mass',     layout:'mega1',     trainCount:6, targetScore:5200, timeLimit:220, trainSpeeds:[1.2,1.2,1.1,1.0,0.95,0.90], description:'Six trains! Pure chaos.' },
      ]
    },
    {
      id:5, name:'QUANTUM RAIL', badge:'master', color:'#a855f7',
      levels:[
        { id:18, name:'Quantum Flux',      layout:'mega1',     trainCount:6, targetScore:6000, timeLimit:240, trainSpeeds:[1.3,1.25,1.2,1.1,1.0,0.95], description:'Ultimate challenge begins!' },
        { id:19, name:'Singularity',       layout:'mega2',     trainCount:7, targetScore:7500, timeLimit:260, trainSpeeds:[1.4,1.3,1.25,1.2,1.1,1.0,0.95], description:'Seven trains. Godspeed.' },
        { id:20, name:'Omega Station',     layout:'mega2',     trainCount:8, targetScore:10000,timeLimit:300, trainSpeeds:[1.4,1.35,1.3,1.25,1.2,1.15,1.1,1.0], description:'The final challenge. Prove mastery!' },
      ]
    },
  ];
  const flat = [];
  zones.forEach(z => z.levels.forEach(l => flat.push({ ...l, zone: z })));
  return { zones, flat };
}

// ═══════════════════════════════════════════════════════════
// TRACK / LAYOUT BUILDER
// ═══════════════════════════════════════════════════════════
function buildLayout(layoutId, W, H) {
  const cx=W/2, cy=H/2;
  let _tid=0, _sid=0, _jid=0;
  const makeTrack  = (pts,ci=0) => ({id:'T'+(++_tid),points:pts,colorIdx:ci,length:0});
  const makeSignal = (x,y,tid,tp,st='go') => ({id:'S'+(++_sid),x,y,trackId:tid,tPos:tp,state:st});
  const makeStation= (x,y,name,tid,tp,side='top') => ({x,y,name,trackId:tid,tPos:tp,side});
  const makeJunction=(x,y,tids)=>({id:'J'+(++_jid),x,y,trackIds:tids});

  const layouts = {};

  layouts['straight1'] = ()=>{
    const tr=makeTrack([{x:W*0.04,y:cy},{x:W*0.96,y:cy}]);
    return{
      tracks:[tr],
      signals:[makeSignal(W*0.35,cy-35,tr.id,0.35), makeSignal(W*0.65,cy-35,tr.id,0.65)],
      stations:[makeStation(W*0.06,cy,'Sunrise',tr.id,0.04,'top'), makeStation(W*0.94,cy,'Sunset',tr.id,0.96,'top')],
      junctions:[]
    };
  };

  layouts['straight2'] = ()=>{
    const tr=makeTrack([{x:W*0.03,y:cy},{x:W*0.97,y:cy}]);
    return{
      tracks:[tr],
      signals:[makeSignal(W*0.28,cy-35,tr.id,0.28), makeSignal(W*0.55,cy-35,tr.id,0.55), makeSignal(W*0.75,cy-35,tr.id,0.75)],
      stations:[makeStation(W*0.05,cy,'North Gate',tr.id,0.04,'top'), makeStation(W*0.5,cy,'Central',tr.id,0.5,'top'), makeStation(W*0.95,cy,'South Gate',tr.id,0.96,'top')],
      junctions:[]
    };
  };

  layouts['parallel'] = ()=>{
    const y1=cy-55,y2=cy+55;
    const t1=makeTrack([{x:W*0.04,y:y1},{x:W*0.96,y:y1}],0);
    const t2=makeTrack([{x:W*0.04,y:y2},{x:W*0.96,y:y2}],1);
    return{
      tracks:[t1,t2],
      signals:[makeSignal(W*0.32,y1-35,t1.id,0.32), makeSignal(W*0.68,y1-35,t1.id,0.68),
               makeSignal(W*0.32,y2-35,t2.id,0.32), makeSignal(W*0.68,y2-35,t2.id,0.68)],
      stations:[makeStation(W*0.06,y1,'Alpha North',t1.id,0.04,'top'), makeStation(W*0.94,y1,'Beta North',t1.id,0.96,'top'),
                makeStation(W*0.06,y2,'Alpha South',t2.id,0.04,'bot'), makeStation(W*0.94,y2,'Beta South',t2.id,0.96,'bot')],
      junctions:[]
    };
  };

  layouts['junction1'] = ()=>{
    const jx=cx,jy=cy;
    const t1=makeTrack([{x:W*0.04,y:cy-60},{x:jx,y:jy}],0);
    const t2=makeTrack([{x:jx,y:jy},{x:W*0.96,y:cy-60}],1);
    const t3=makeTrack([{x:W*0.04,y:cy+60},{x:jx,y:jy}],2);
    const t4=makeTrack([{x:jx,y:jy},{x:W*0.96,y:cy+60}],3);
    return{
      tracks:[t1,t2,t3,t4],
      signals:[makeSignal(W*0.26,cy-72,t1.id,0.55), makeSignal(W*0.74,cy-72,t2.id,0.45),
               makeSignal(W*0.26,cy+38,t3.id,0.55), makeSignal(W*0.74,cy+38,t4.id,0.55)],
      stations:[makeStation(W*0.06,cy-60,'West-N',t1.id,0.04,'top'), makeStation(W*0.94,cy-60,'East-N',t2.id,0.96,'top'),
                makeStation(W*0.06,cy+60,'West-S',t3.id,0.04,'bot'), makeStation(W*0.94,cy+60,'East-S',t4.id,0.96,'bot')],
      junctions:[makeJunction(jx,jy,[t1.id,t2.id,t3.id,t4.id])]
    };
  };

  layouts['cross1'] = ()=>{
    const t1=makeTrack([{x:W*0.04,y:cy-40},{x:W*0.46,y:cy},{x:W*0.96,y:cy+40}],0);
    const t2=makeTrack([{x:W*0.04,y:cy+40},{x:W*0.46,y:cy},{x:W*0.96,y:cy-40}],1);
    return{
      tracks:[t1,t2],
      signals:[makeSignal(W*0.22,cy-55,t1.id,0.28), makeSignal(W*0.70,cy-12,t1.id,0.72),
               makeSignal(W*0.22,cy+48,t2.id,0.28), makeSignal(W*0.70,cy+46,t2.id,0.72)],
      stations:[makeStation(W*0.06,cy-40,'Cross-A',t1.id,0.04,'top'), makeStation(W*0.94,cy+40,'Cross-B',t1.id,0.96,'bot'),
                makeStation(W*0.06,cy+40,'Cross-C',t2.id,0.04,'bot'), makeStation(W*0.94,cy-40,'Cross-D',t2.id,0.96,'top')],
      junctions:[makeJunction(W*0.46,cy,[t1.id,t2.id])]
    };
  };

  layouts['network1'] = ()=>{
    const mx=cx*0.82,my=cy;
    const t1=makeTrack([{x:W*0.04,y:cy-90},{x:mx,y:my}],0);
    const t2=makeTrack([{x:mx,y:my},{x:W*0.96,y:cy}],1);
    const t3=makeTrack([{x:W*0.04,y:cy+90},{x:mx,y:my}],2);
    const t4=makeTrack([{x:W*0.04,y:cy},{x:W*0.54,y:cy},{x:W*0.96,y:cy-65}],3);
    return{
      tracks:[t1,t2,t3,t4],
      signals:[makeSignal(W*0.28,cy-100,t1.id,0.5), makeSignal(mx+W*0.08,my-28,t2.id,0.3),
               makeSignal(W*0.28,cy+68,t3.id,0.5),  makeSignal(W*0.58,cy-18,t4.id,0.6),
               makeSignal(W*0.76,cy-40,t4.id,0.8)],
      stations:[makeStation(W*0.06,cy-90,'Alpha',t1.id,0.04,'top'), makeStation(W*0.94,cy,'Beta',t2.id,0.96,'top'),
                makeStation(W*0.06,cy+90,'Gamma',t3.id,0.04,'bot'), makeStation(W*0.94,cy-65,'Delta',t4.id,0.96,'top')],
      junctions:[makeJunction(mx,my,[t1.id,t2.id,t3.id])]
    };
  };

  layouts['cross2'] = ()=>{
    const j1x=W*0.34,j1y=cy-28,j2x=W*0.66,j2y=cy+28;
    const t1=makeTrack([{x:W*0.04,y:cy-65},{x:j1x,y:j1y},{x:j2x,y:j2y},{x:W*0.96,y:cy+65}],0);
    const t2=makeTrack([{x:W*0.04,y:cy+65},{x:j1x,y:j1y},{x:j2x,y:j2y},{x:W*0.96,y:cy-65}],1);
    const t3=makeTrack([{x:W*0.04,y:cy},{x:j1x,y:j1y}],2);
    const t4=makeTrack([{x:j2x,y:j2y},{x:W*0.96,y:cy}],3);
    return{
      tracks:[t1,t2,t3,t4],
      signals:[makeSignal(W*0.18,cy-78,t1.id,0.22), makeSignal(W*0.5,cy-2,t1.id,0.5),
               makeSignal(W*0.18,cy+50,t2.id,0.22), makeSignal(W*0.5,cy+50,t2.id,0.5),
               makeSignal(W*0.18,cy-16,t3.id,0.5)],
      stations:[makeStation(W*0.06,cy-65,'NW Hub',t1.id,0.04,'top'), makeStation(W*0.94,cy+65,'SE Hub',t1.id,0.96,'bot'),
                makeStation(W*0.06,cy+65,'SW Hub',t2.id,0.04,'bot'), makeStation(W*0.94,cy-65,'NE Hub',t2.id,0.96,'top')],
      junctions:[makeJunction(j1x,j1y,[t1.id,t2.id,t3.id]), makeJunction(j2x,j2y,[t1.id,t2.id,t4.id])]
    };
  };

  layouts['network2'] = ()=>{
    const hub={x:cx,y:cy};
    const t1=makeTrack([{x:W*0.04,y:H*0.18},{x:cx*0.45,y:cy*0.55},{x:hub.x,y:hub.y}],0);
    const t2=makeTrack([{x:hub.x,y:hub.y},{x:cx*1.55,y:cy*0.55},{x:W*0.96,y:H*0.18}],1);
    const t3=makeTrack([{x:W*0.04,y:H*0.82},{x:cx*0.45,y:cy*1.45},{x:hub.x,y:hub.y}],2);
    const t4=makeTrack([{x:hub.x,y:hub.y},{x:cx*1.55,y:cy*1.45},{x:W*0.96,y:H*0.82}],3);
    const t5=makeTrack([{x:W*0.04,y:cy},{x:hub.x,y:hub.y}],4);
    const t6=makeTrack([{x:hub.x,y:hub.y},{x:W*0.96,y:cy}],5);
    return{
      tracks:[t1,t2,t3,t4,t5,t6],
      signals:[makeSignal(W*0.2,H*0.26,t1.id,0.5), makeSignal(W*0.8,H*0.26,t2.id,0.5),
               makeSignal(W*0.2,H*0.74,t3.id,0.5), makeSignal(W*0.8,H*0.74,t4.id,0.5),
               makeSignal(W*0.22,cy-16,t5.id,0.6),  makeSignal(W*0.78,cy-16,t6.id,0.4)],
      stations:[makeStation(W*0.06,H*0.18,'Star-N',t1.id,0.04,'top'), makeStation(W*0.94,H*0.18,'Star-E',t2.id,0.96,'top'),
                makeStation(W*0.06,H*0.82,'Star-W',t3.id,0.04,'bot'), makeStation(W*0.94,H*0.82,'Star-S',t4.id,0.96,'bot')],
      junctions:[makeJunction(hub.x,hub.y,[t1.id,t2.id,t3.id,t4.id,t5.id,t6.id])]
    };
  };

  layouts['network3'] = ()=>{
    const hub={x:cx,y:cy}, arms=6;
    const tracks=[],stations=[],signals=[];
    for(let i=0;i<arms;i++){
      const angle=(i/arms)*Math.PI*2-Math.PI/2;
      const ex=hub.x+Math.cos(angle)*(W*0.43);
      const ey=hub.y+Math.sin(angle)*(H*0.38);
      const mx=hub.x+Math.cos(angle)*(W*0.2);
      const my=hub.y+Math.sin(angle)*(H*0.18);
      const tr=makeTrack([{x:ex,y:ey},{x:mx,y:my},{x:hub.x,y:hub.y}],i);
      tracks.push(tr);
      const sx=hub.x+Math.cos(angle)*(W*0.26);
      const sy=hub.y+Math.sin(angle)*(H*0.22)-22;
      signals.push(makeSignal(sx,sy,tr.id,0.5));
      const side=Math.sin(angle)>0?'bot':'top';
      stations.push(makeStation(ex,ey,'S'+i,tr.id,0.04,side));
    }
    return{tracks,signals,stations,junctions:[makeJunction(hub.x,hub.y,tracks.map(t=>t.id))]};
  };

  layouts['mega1'] = ()=>{
    const h1={x:W*0.30,y:cy-35},h2={x:W*0.70,y:cy+35};
    const t1=makeTrack([{x:W*0.04,y:H*0.18},{x:h1.x,y:h1.y}],0);
    const t2=makeTrack([{x:W*0.04,y:cy},{x:h1.x,y:h1.y}],1);
    const t3=makeTrack([{x:W*0.04,y:H*0.82},{x:h1.x,y:h1.y}],2);
    const t4=makeTrack([{x:h1.x,y:h1.y},{x:h2.x,y:h2.y}],3);
    const t5=makeTrack([{x:h2.x,y:h2.y},{x:W*0.96,y:H*0.18}],0);
    const t6=makeTrack([{x:h2.x,y:h2.y},{x:W*0.96,y:cy}],1);
    const t7=makeTrack([{x:h2.x,y:h2.y},{x:W*0.96,y:H*0.82}],2);
    const t8=makeTrack([{x:W*0.04,y:H*0.33},{x:h1.x,y:h1.y},{x:h2.x,y:h2.y},{x:W*0.96,y:H*0.67}],3);
    return{
      tracks:[t1,t2,t3,t4,t5,t6,t7,t8],
      signals:[makeSignal(W*0.15,H*0.13,t1.id,0.5), makeSignal(W*0.15,cy-18,t2.id,0.5),
               makeSignal(W*0.15,H*0.77,t3.id,0.5), makeSignal(cx,cy-28,t4.id,0.5),
               makeSignal(W*0.85,H*0.13,t5.id,0.5), makeSignal(W*0.85,cy+18,t6.id,0.5),
               makeSignal(W*0.85,H*0.77,t7.id,0.5), makeSignal(W*0.5,cy+18,t8.id,0.5),
               makeSignal(W*0.72,cy+38,t8.id,0.75)],
      stations:[makeStation(W*0.06,H*0.18,'Port-A',t1.id,0.04,'top'), makeStation(W*0.06,cy,'Port-B',t2.id,0.04,'top'),
                makeStation(W*0.06,H*0.82,'Port-C',t3.id,0.04,'bot'), makeStation(W*0.94,H*0.18,'Port-D',t5.id,0.96,'top'),
                makeStation(W*0.94,cy,'Port-E',t6.id,0.96,'top'),    makeStation(W*0.94,H*0.82,'Port-F',t7.id,0.96,'bot')],
      junctions:[makeJunction(h1.x,h1.y,[t1.id,t2.id,t3.id,t4.id,t8.id]), makeJunction(h2.x,h2.y,[t4.id,t5.id,t6.id,t7.id,t8.id])]
    };
  };

  layouts['mega2'] = ()=>{
    const h1={x:W*0.27,y:H*0.33},h2={x:W*0.73,y:H*0.33},h3={x:W*0.5,y:H*0.70};
    const t1=makeTrack([{x:W*0.04,y:H*0.13},{x:h1.x,y:h1.y}],0);
    const t2=makeTrack([{x:W*0.04,y:H*0.52},{x:h1.x,y:h1.y}],1);
    const t3=makeTrack([{x:h1.x,y:h1.y},{x:h2.x,y:h2.y}],2);
    const t4=makeTrack([{x:h1.x,y:h1.y},{x:h3.x,y:h3.y}],3);
    const t5=makeTrack([{x:h2.x,y:h2.y},{x:W*0.96,y:H*0.13}],0);
    const t6=makeTrack([{x:h2.x,y:h2.y},{x:W*0.96,y:H*0.52}],1);
    const t7=makeTrack([{x:h2.x,y:h2.y},{x:h3.x,y:h3.y}],2);
    const t8=makeTrack([{x:h3.x,y:h3.y},{x:W*0.04,y:H*0.87}],3);
    const t9=makeTrack([{x:h3.x,y:h3.y},{x:W*0.96,y:H*0.87}],0);
    const t10=makeTrack([{x:W*0.04,y:H*0.28},{x:h1.x,y:h1.y},{x:h2.x,y:h2.y},{x:W*0.96,y:H*0.28}],1);
    const sigs=[];
    [[W*0.13,H*0.18,t1.id],[W*0.13,H*0.44,t2.id],[W*0.5,H*0.27,t3.id],
     [W*0.36,H*0.54,t4.id],[W*0.87,H*0.18,t5.id],[W*0.87,H*0.44,t6.id],
     [W*0.64,H*0.54,t7.id],[W*0.25,H*0.80,t8.id],[W*0.75,H*0.80,t9.id],
     [W*0.28,H*0.22,t10.id],[W*0.72,H*0.22,t10.id]].forEach(([x,y,tid])=>sigs.push(makeSignal(x,y,tid,0.5)));
    return{
      tracks:[t1,t2,t3,t4,t5,t6,t7,t8,t9,t10],signals:sigs,
      stations:[makeStation(W*0.06,H*0.13,'Alpha',t1.id,0.04,'top'), makeStation(W*0.06,H*0.52,'Beta',t2.id,0.04,'top'),
                makeStation(W*0.94,H*0.13,'Gamma',t5.id,0.96,'top'), makeStation(W*0.94,H*0.52,'Delta',t6.id,0.96,'top'),
                makeStation(W*0.06,H*0.87,'Epsilon',t8.id,0.04,'bot'), makeStation(W*0.94,H*0.87,'Zeta',t9.id,0.96,'bot')],
      junctions:[makeJunction(h1.x,h1.y,[t1.id,t2.id,t3.id,t4.id,t10.id]),
                 makeJunction(h2.x,h2.y,[t3.id,t5.id,t6.id,t7.id,t10.id]),
                 makeJunction(h3.x,h3.y,[t4.id,t7.id,t8.id,t9.id])]
    };
  };

  const fn = layouts[layoutId] || layouts['straight1'];
  return fn();
}

// ═══════════════════════════════════════════════════════════
// GEOMETRY HELPERS
// ═══════════════════════════════════════════════════════════
function trackLength(pts) {
  let l=0;
  for(let i=1;i<pts.length;i++){
    const dx=pts[i].x-pts[i-1].x,dy=pts[i].y-pts[i-1].y;
    l+=Math.sqrt(dx*dx+dy*dy);
  }
  return l;
}

function getPointAtT(pts, t) {
  const total=trackLength(pts);
  let target=t*total, acc=0;
  for(let i=1;i<pts.length;i++){
    const dx=pts[i].x-pts[i-1].x,dy=pts[i].y-pts[i-1].y;
    const sl=Math.sqrt(dx*dx+dy*dy);
    if(acc+sl>=target||i===pts.length-1){
      const loc=(target-acc)/sl;
      return{
        x:pts[i-1].x+dx*Math.min(loc,1),
        y:pts[i-1].y+dy*Math.min(loc,1),
        angle:Math.atan2(dy,dx)
      };
    }
    acc+=sl;
  }
  return{x:pts[pts.length-1].x,y:pts[pts.length-1].y,angle:0};
}

function dist(a,b){const dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}

// ═══════════════════════════════════════════════════════════
// PARTICLE SYSTEM
// ═══════════════════════════════════════════════════════════
class ParticleSystem {
  constructor(){this.particles=[];}

  emit(x,y,type='spark',count=8){
    for(let i=0;i<count;i++){
      const ang=Math.random()*Math.PI*2;
      const spd=Math.random()*3+1;
      let color, size=Math.random()*4+2;
      switch(type){
        case 'spark':     color=`hsl(${30+Math.random()*60},100%,70%)`;break;
        case 'collision': color=`hsl(${Math.random()*30},100%,60%)`;size+=2;break;
        case 'score':     color=`hsl(45,100%,65%)`;break;
        case 'signal':    color=`hsl(${Math.random()>0.5?120:0},100%,55%)`;break;
        case 'smoke':     color=`rgba(${180+Math.random()*40},${180+Math.random()*40},${180+Math.random()*40},0.7)`;size=Math.random()*8+4;break;
        case 'steam':     color=`rgba(220,235,255,0.6)`;size=Math.random()*6+3;break;
        default:          color='#fff';
      }
      this.particles.push({
        x,y,
        vx:Math.cos(ang)*spd*(type==='smoke'?0.4:1),
        vy:Math.sin(ang)*spd*(type==='smoke'?0.4:1)+(type==='smoke'?-0.8:0),
        life:1,maxLife:type==='smoke'?0.8+Math.random()*0.6:0.3+Math.random()*0.4,
        size,color,type,
        grow:type==='smoke'?0.05:0,
      });
    }
  }

  update(dt){
    this.particles=this.particles.filter(p=>{
      p.life-=dt/p.maxLife;
      p.x+=p.vx; p.y+=p.vy;
      if(p.type!=='smoke'&&p.type!=='steam'){ p.vy+=0.06; p.vx*=0.96; p.vy*=0.96; }
      else { p.vx*=0.95; p.vy*=0.95; p.size+=p.grow; }
      return p.life>0;
    });
  }

  draw(ctx){
    this.particles.forEach(p=>{
      ctx.save();
      ctx.globalAlpha=p.life*0.85;
      ctx.fillStyle=p.color;
      if(p.type!=='smoke'&&p.type!=='steam'){
        ctx.shadowColor=p.color; ctx.shadowBlur=5;
      }
      ctx.beginPath();
      ctx.arc(p.x,p.y,Math.max(0.5, p.size*p.life),0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    });
  }
}

// ═══════════════════════════════════════════════════════════
// ENVIRONMENT / NATURE RENDERER
// ═══════════════════════════════════════════════════════════
class Environment {
  constructor(){
    this.trees=[];
    this.clouds=[];
    this.birds=[];
    this.hills=[];
    this.built=false;
    this.time=0; // for animation
  }

  build(W,H,tracks){
    this.W=W; this.H=H;
    // Sky gradient stops
    this.skyTop='#050e1a';
    this.skyBot='#0d2341';
    // Ground
    this.groundY=H;
    this.grassTop=H*0.75;

    // 🏔️ Layered Hills (static decorative)
    this.hills=[];
    
    // Far-Far Hills (Silhouettes)
    this.farHills = [
      {x:W*0.1, y:H*0.72, rx:W*0.25, ry:H*0.15, color:'rgba(5,15,30,0.95)'},
      {x:W*0.4, y:H*0.74, rx:W*0.30, ry:H*0.12, color:'rgba(5,15,30,0.95)'},
      {x:W*0.8, y:H*0.73, rx:W*0.28, ry:H*0.14, color:'rgba(5,15,30,0.95)'},
    ];

    // Mid Hills
    const hillData=[
      {x:W*0.05,y:H*0.78,rx:W*0.2,ry:H*0.15, color:'rgba(12,45,20,0.8)'},
      {x:W*0.3, y:H*0.76,rx:W*0.15,ry:H*0.12, color:'rgba(15,55,25,0.75)'},
      {x:W*0.65,y:H*0.77,rx:W*0.22,ry:H*0.16, color:'rgba(10,40,20,0.8)'},
      {x:W*0.9, y:H*0.75,rx:W*0.18,ry:H*0.13, color:'rgba(12,48,22,0.7)'},
    ];
    this.hills=hillData;

    // 🌲 Nature Elements
    this.trees=[];
    this.natureElements=[]; // Grass, rocks, etc.
    
    const trackXRanges=[];
    tracks.forEach(tr=>{
      tr.points.forEach(p=>trackXRanges.push({cx:p.x,cy:p.y,r:70})); // Larger exclusion for grand scale
    });

    const isClear=(tx,ty,r=60)=>trackXRanges.every(rect=>{
      const d2=(tx-rect.cx)**2+(ty-rect.cy)**2;
      return d2>(rect.r+r)**2;
    });

    // Place trees
    for(let i=0;i<45;i++){
      const tx=W*0.02+Math.random()*W*0.96;
      const ty=H*0.58+Math.random()*H*0.32;
      if(isClear(tx,ty, 25)){
        this.trees.push({
          x:tx, y:ty,
          h:40+Math.random()*50, // Larger trees
          w:18+Math.random()*15,
          type:Math.random()>0.35?'pine':'round',
          hue:100+Math.random()*35,
          sat:45+Math.random()*30,
          phase:Math.random()*Math.PI*2,
          sway:0.002+Math.random()*0.003,
        });
      }
    }
    
    // Place grass/rocks
    for(let i=0;i<60;i++){
      const tx=Math.random()*W;
      const ty=H*0.65+Math.random()*H*0.3;
      if(isClear(tx,ty, 10)){
        this.natureElements.push({
          x:tx, y:ty,
          type:Math.random()>0.5?'grass':'rock',
          size:4+Math.random()*8,
          color:Math.random()>0.5?'#1a3a2a':'#2a4a3a'
        });
      }
    }

    this.trees.sort((a,b)=>a.y-b.y);

    // Clouds
    this.clouds=[];
    for(let i=0;i<8;i++){
      this.clouds.push({
        x:Math.random()*W, y:H*0.02+Math.random()*H*0.25,
        w:100+Math.random()*150, h:25+Math.random()*35,
        speed:0.08+Math.random()*0.15,
        alpha:0.08+Math.random()*0.15,
      });
    }

    // Birds
    this.birds=[];
    for(let i=0;i<12;i++){
      this.birds.push({
        x:Math.random()*W, y:H*0.05+Math.random()*H*0.3,
        speed:0.4+Math.random()*1.0,
        phase:Math.random()*Math.PI*2,
        size:2.5+Math.random()*2.5,
        flap:0,
      });
    }

    this.built=true;
  }

  update(dt){
    this.time+=dt;
    if(!this.built) return;
    const W=this.W;
    this.clouds.forEach(c=>{
      c.x+=c.speed;
      if(c.x>W+c.w) c.x=-c.w;
    });
    this.birds.forEach(b=>{
      b.x+=b.speed;
      b.phase+=dt*4;
      b.flap=Math.sin(b.phase)*4;
      if(b.x>W+20) b.x=-20;
    });
  }

  drawBackground(ctx){
    if(!this.built) return;
    const W=this.W, H=this.H;

    // 🌌 Deep Space / Sky
    const sky=ctx.createLinearGradient(0,0,0,H*0.7);
    sky.addColorStop(0,'#020814');
    sky.addColorStop(0.4,'#06142a');
    sky.addColorStop(0.8,'#0d2345');
    sky.addColorStop(1,'#102b55');
    ctx.fillStyle=sky;
    ctx.fillRect(0,0,W,H);

    // Stars
    ctx.fillStyle='rgba(200,225,255,0.3)';
    for(let s=0;s<80;s++){
      const sx=(W * ((s*137.5)%1));
      const sy=(H*0.65 * ((s*97.3)%1));
      const ss=Math.sin(this.time*0.7+s)*0.5+0.5;
      ctx.globalAlpha=ss*0.5;
      ctx.fillRect(sx,sy,1.4,1.4);
    }
    ctx.globalAlpha=1;

    // Moon Glow
    const moonX=W*0.9, moonY=H*0.1;
    const moonGrd=ctx.createRadialGradient(moonX,moonY,0,moonX,moonY,80);
    moonGrd.addColorStop(0,'rgba(255,245,200,0.15)');
    moonGrd.addColorStop(0.5,'rgba(255,235,180,0.05)');
    moonGrd.addColorStop(1,'transparent');
    ctx.fillStyle=moonGrd;
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,250,230,0.5)';
    ctx.beginPath(); ctx.arc(moonX,moonY,15,0,Math.PI*2); ctx.fill();

    // ☁️ Clouds
    this.clouds.forEach(c=>{
      ctx.save();
      ctx.globalAlpha=c.alpha;
      ctx.fillStyle='rgba(150,185,220,0.8)';
      ctx.shadowColor='rgba(150,185,220,0.4)';
      ctx.shadowBlur=30;
      [-0.3,0,0.3].forEach((ox,i)=>{
        ctx.beginPath();
        ctx.ellipse(c.x+ox*c.w, c.y+i*-6, c.w*0.5, c.h*0.5, 0, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.restore();
    });

    // 🏔️ Far-Far Hills (Silhouettes)
    this.farHills.forEach(fh=>{
      ctx.fillStyle=fh.color;
      ctx.beginPath();
      ctx.ellipse(fh.x, fh.y, fh.rx, fh.ry, 0, 0, Math.PI*2);
      ctx.fill();
    });

    // 🌿 Ground Base
    const groundGrd=ctx.createLinearGradient(0,H*0.6,0,H);
    groundGrd.addColorStop(0,'#05150a');
    groundGrd.addColorStop(0.4,'#0a2012');
    groundGrd.addColorStop(1,'#041008');
    ctx.fillStyle=groundGrd;
    ctx.beginPath();
    ctx.moveTo(0,H*0.68);
    ctx.bezierCurveTo(W*0.3,H*0.62,W*0.7,H*0.74,W,H*0.68);
    ctx.lineTo(W,H); ctx.lineTo(0,H);
    ctx.fill();

    // 🏔️ Mid Hills
    this.hills.forEach(h=>{
      ctx.save();
      const hGrd=ctx.createRadialGradient(h.x,h.y,0,h.x,h.y,h.rx);
      hGrd.addColorStop(0, h.color);
      hGrd.addColorStop(0.7, darken(h.color, 40));
      hGrd.addColorStop(1, 'transparent');
      ctx.fillStyle=hGrd;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    });

    // 🌫️ Atmospheric Haze/Mist
    const mistGrd=ctx.createLinearGradient(0,H*0.5,0,H*0.75);
    mistGrd.addColorStop(0,'transparent');
    mistGrd.addColorStop(1,'rgba(10,35,70,0.15)');
    ctx.fillStyle=mistGrd;
    ctx.fillRect(0,0,W,H);
  }

  drawTrees(ctx){
    if(!this.built) return;
    const W=this.W, H=this.H;

    // Grass & Rocks
    this.natureElements.forEach(el=>{
      ctx.save();
      ctx.translate(el.x, el.y);
      if(el.type==='grass'){
        ctx.strokeStyle=el.color;
        ctx.lineWidth=1.5;
        for(let i=0;i<3;i++){
          ctx.beginPath();
          ctx.moveTo(0,0);
          ctx.quadraticCurveTo(Math.sin(this.time+el.x)*3, -el.size, (i-1)*el.size*0.5, -el.size*1.2);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle='#2c3e50';
        ctx.beginPath();
        ctx.moveTo(-el.size, 0); ctx.lineTo(el.size, 0);
        ctx.lineTo(el.size*0.6, -el.size*0.8); ctx.lineTo(-el.size*0.6, -el.size*0.8);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });

    // 🌲 Trees (Grand Scale)
    this.trees.forEach(tr=>{
      ctx.save();
      const sway=Math.sin(this.time*tr.sway*12+tr.phase)*4;
      ctx.translate(tr.x, tr.y);

      // Shadow
      ctx.save();
      ctx.scale(1, 0.18);
      ctx.fillStyle='rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(sway*0.4, 4, tr.w*0.8, tr.h*0.5, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      if(tr.type==='pine'){
        // Trunk
        ctx.fillStyle='#2c1b06';
        ctx.fillRect(-2, 0, 4, tr.h*0.3);
        // Tiers
        const hue=tr.hue, sat=tr.sat;
        [0.8, 0.5, 0.2].forEach((tier, i)=>{
          const tierW=tr.w * (1 - i*0.25);
          const tierH=tr.h * 0.4;
          const tierY=-tr.h*0.2 - i*tr.h*0.25;
          ctx.save();
          ctx.translate(sway*(1-i*0.2), tierY);
          const grd=ctx.createLinearGradient(-tierW,0,tierW,0);
          grd.addColorStop(0,`hsl(${hue},${sat}%,${15-i*2}%)`);
          grd.addColorStop(0.5,`hsl(${hue},${sat}%,${22-i*2}%)`);
          grd.addColorStop(1,`hsl(${hue},${sat}%,${12-i*2}%)`);
          ctx.fillStyle=grd;
          ctx.beginPath();
          ctx.moveTo(0, -tierH);
          ctx.lineTo(tierW, 0);
          ctx.lineTo(-tierW, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
      } else {
        // Round Tree
        const trunkH=tr.h*0.35;
        ctx.fillStyle='#3e2508';
        ctx.fillRect(-3,0,6,trunkH);
        // Canopy
        ctx.save(); ctx.translate(sway, -tr.h*0.55);
        const grd=ctx.createRadialGradient(-tr.w*0.2,-tr.h*0.2,0,0,0,tr.w*0.7);
        grd.addColorStop(0,`hsl(${tr.hue+10},${tr.sat}%,30%)`);
        grd.addColorStop(0.6,`hsl(${tr.hue},${tr.sat}%,22%)`);
        grd.addColorStop(1,`hsl(${tr.hue-5},${tr.sat-10}%,15%)`);
        ctx.fillStyle=grd;
        ctx.beginPath(); ctx.arc(0,0,tr.w*0.7,0,Math.PI*2); ctx.fill();
        // Highlight
        ctx.fillStyle=`hsl(${tr.hue+5},${tr.sat-15}%,35%)`;
        ctx.beginPath(); ctx.arc(-tr.w*0.25,-tr.w*0.25,tr.w*0.35,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    });

    // Birds
    this.birds.forEach(b=>{
      ctx.save();
      ctx.translate(b.x,b.y);
      ctx.fillStyle='rgba(180,205,230,0.7)';
      // Simple wing shape
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.quadraticCurveTo(-b.size*3,b.flap,-b.size*6,0);
      ctx.quadraticCurveTo(-b.size*3,b.flap+2,0,0);
      ctx.quadraticCurveTo(b.size*3,b.flap,b.size*6,0);
      ctx.quadraticCurveTo(b.size*3,b.flap+2,0,0);
      ctx.fill();
      ctx.restore();
    });
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN GAME ENGINE
// ═══════════════════════════════════════════════════════════
class TrainGame {
  constructor() {
    this.canvas    = document.getElementById('gameCanvas');
    this.menuCanvas= document.getElementById('menuCanvas');
    this.ctx       = this.canvas.getContext('2d');
    this.menuCtx   = this.menuCanvas ? this.menuCanvas.getContext('2d') : null;
    this.particles = new ParticleSystem();
    this.env       = new Environment();
    this.state     = 'menu';
    this.loadData();
    this.bindEvents();
    this.resizeCanvas();
    this.loop();
    this.startLoadingScreen();
  }

  // ── Persistence ──────────────────────────────────────── //
  loadData() {
    try {
      const d=JSON.parse(localStorage.getItem('tcm_save')||'{}');
      this.save={
        highScore:d.highScore||0, totalScore:d.totalScore||0,
        unlockedLevel:d.unlockedLevel||1, completedLevels:d.completedLevels||{},
        levelStars:d.levelStars||{}, soundMuted:d.soundMuted||false,
      };
    } catch(e){ this.resetSave(); }
    this.levels=buildLevels();
    if(this.save.soundMuted) Sound.toggleMute();
    this.updateMenuStats();
  }

  resetSave(){ this.save={highScore:0,totalScore:0,unlockedLevel:1,completedLevels:{},levelStars:{},soundMuted:false}; }
  persistData(){ try{localStorage.setItem('tcm_save',JSON.stringify(this.save));}catch(e){} }

  // ── Loading ───────────────────────────────────────────── //
  startLoadingScreen(){
    const screen=document.getElementById('screen-intro');
    screen.classList.add('active');
    const fill=screen.querySelector('.loading-bar-fill');
    const label=screen.querySelector('.loading-label');
    let pct=0;
    const msgs=['Initializing Engine','Building World','Placing Trains','Ready to Depart'];
    const iv=setInterval(()=>{
      pct+=Math.random()*10+4;
      if(pct>100)pct=100;
      fill.style.width=pct+'%';
      label.textContent=msgs[Math.min(msgs.length-1,Math.floor(pct/28))];
      if(pct>=100){
        clearInterval(iv);
        setTimeout(()=>{
          screen.classList.remove('active');
          this.showScreen('menu');
          Sound.startAmbient();
        },600);
      }
    },80);
  }

  // ── Screen ────────────────────────────────────────────── //
  showScreen(name){
    ['menu','tutorial','levels','game','gameover','levelcomplete'].forEach(n=>{
      const el=document.getElementById('screen-'+n);
      if(el) el.classList.remove('active');
    });
    const el=document.getElementById('screen-'+name);
    if(el) el.classList.add('active');
    this.state=name;
  }

  // ── Canvas Resize ─────────────────────────────────────── //
  resizeCanvas(){
    const wrap=this.canvas.parentElement;
    if(wrap){
      const rect=wrap.getBoundingClientRect();
      this.canvas.width =rect.width||window.innerWidth;
      this.canvas.height=rect.height||(window.innerHeight-130);
    }
    if(this.menuCanvas){
      this.menuCanvas.width=window.innerWidth;
      this.menuCanvas.height=window.innerHeight;
    }
    if(this.levelData) this.rebuildLayout();
    // Rebuild env
    if(this.tracks&&this.tracks.length){
      this.env.build(this.canvas.width,this.canvas.height,this.tracks);
    }
  }

  rebuildLayout(){
    if(!this.currentLevel) return;
    const W=this.canvas.width,H=this.canvas.height;
    const layout=buildLayout(this.currentLevel.layout,W,H);
    this.tracks=layout.tracks;
    this.stations=layout.stations;
    this.junctions=layout.junctions;
    layout.signals.forEach((ls,i)=>{
      if(this.signals[i]){this.signals[i].x=ls.x;this.signals[i].y=ls.y;}
    });
    if(!this.signals||!this.signals.length) this.signals=layout.signals;
    this.tracks.forEach(t=>{t.length=trackLength(t.points);});
    this.env.build(W,H,this.tracks);
  }

  // ── Events ────────────────────────────────────────────── //
  bindEvents(){
    window.addEventListener('resize',()=>this.resizeCanvas());
    this.canvas.addEventListener('click',(e)=>this.onCanvasClick(e));
    this.canvas.addEventListener('touchstart',(e)=>{
      e.preventDefault();
      const t=e.touches[0];
      const rect=this.canvas.getBoundingClientRect();
      const sx=this.canvas.width/rect.width, sy=this.canvas.height/rect.height;
      this.onCanvasClickXY((t.clientX-rect.left)*sx,(t.clientY-rect.top)*sy);
    },{passive:false});

    document.getElementById('btn-pause').addEventListener('click',()=>this.togglePause());
    document.getElementById('btn-sound').addEventListener('click',()=>this.toggleSound());
    document.getElementById('btn-resume').addEventListener('click',()=>this.togglePause());
    document.getElementById('btn-pause-menu').addEventListener('click',()=>this.goToMenu());
    document.getElementById('btn-emergency').addEventListener('click',()=>this.emergencyBrake());

    document.querySelectorAll('.ctrl-tab').forEach(tab=>{
      tab.addEventListener('click',()=>{
        document.querySelectorAll('.ctrl-tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        const panel=tab.dataset.panel;
        document.querySelectorAll('.ctrl-panel').forEach(p=>{
          p.style.display=p.dataset.panel===panel?'flex':'none';
        });
      });
    });

    const slider=document.getElementById('speed-slider');
    slider.addEventListener('input',()=>{
      const v=parseInt(slider.value);
      document.getElementById('speed-val').textContent=v+'%';
      slider.style.setProperty('--pct',v+'%');
      if(this.selectedTrain){
        this.selectedTrain.speedPct=v/100;
        this.selectedTrain.stopped=(v===0);
        if(v===0) Sound.play('brake',0.4);
      }
    });

    document.getElementById('btn-play').addEventListener('click',()=>this.showTutorial());
    document.getElementById('btn-levels').addEventListener('click',()=>this.showLevelSelect());
    document.getElementById('btn-menu-sound').addEventListener('click',()=>this.toggleSound());
    document.getElementById('btn-tut-skip').addEventListener('click',()=>this.skipTutorial());
    document.getElementById('btn-tut-next').addEventListener('click',()=>this.nextTutSlide());
    document.getElementById('btn-tut-start').addEventListener('click',()=>this.startLevel(1));
    document.getElementById('btn-levels-back').addEventListener('click',()=>this.showScreen('menu'));
    document.getElementById('btn-retry').addEventListener('click',()=>this.retryLevel());
    document.getElementById('btn-go-menu').addEventListener('click',()=>this.goToMenu());
    document.getElementById('btn-next-level').addEventListener('click',()=>this.nextLevel());
    document.getElementById('btn-lc-menu').addEventListener('click',()=>this.goToMenu());
    document.getElementById('btn-lc-retry').addEventListener('click',()=>this.retryLevel());

    document.addEventListener('keydown',(e)=>{
      if(e.code==='Escape') this.togglePause();
      if(e.code==='Space')  {e.preventDefault();this.emergencyBrake();}
      if(e.code==='KeyM')   this.toggleSound();
    });
  }

  // ── Menu stats ────────────────────────────────────────── //
  updateMenuStats(){
    const hs=document.getElementById('menu-highscore');
    const lv=document.getElementById('menu-level');
    const tr=document.getElementById('menu-trains');
    if(hs) hs.textContent=(this.save.highScore||0).toLocaleString();
    if(lv) lv.textContent=this.save.unlockedLevel||1;
    if(tr) tr.textContent=Object.keys(this.save.completedLevels||{}).length+'/20';
  }

  // ── Tutorial ──────────────────────────────────────────── //
  showTutorial(){this.tutSlide=0;this.showScreen('tutorial');this.updateTutSlide();}
  nextTutSlide(){this.tutSlide++;if(this.tutSlide>=4){this.startLevel(1);return;}this.updateTutSlide();}
  skipTutorial(){this.startLevel(1);}
  updateTutSlide(){
    document.querySelectorAll('.tutorial-slide').forEach((s,i)=>s.classList.toggle('active',i===this.tutSlide));
    document.querySelectorAll('.tutorial-dot').forEach((d,i)=>{
      d.classList.toggle('active',i===this.tutSlide);
      d.classList.toggle('done',i<this.tutSlide);
    });
    const isLast=this.tutSlide===3;
    document.getElementById('btn-tut-next').style.display=isLast?'none':'block';
    document.getElementById('btn-tut-start').style.display=isLast?'block':'none';
  }

  // ── Level Select ──────────────────────────────────────── //
  showLevelSelect(){this.showScreen('levels');this.renderLevelGrid();}
  renderLevelGrid(){
    const container=document.getElementById('level-zones');
    container.innerHTML='';
    this.levels.zones.forEach(zone=>{
      const zoneEl=document.createElement('div');
      zoneEl.className='levels-zone';
      zoneEl.innerHTML=`
        <div class="zone-header">
          <span class="zone-title" style="color:${zone.color}">${zone.name}</span>
          <span class="zone-badge ${zone.badge}">${zone.badge}</span>
        </div>
        <div class="levels-grid" id="zone-grid-${zone.id}"></div>
      `;
      container.appendChild(zoneEl);
      const grid=zoneEl.querySelector('.levels-grid');
      zone.levels.forEach(level=>{
        const locked=level.id>this.save.unlockedLevel;
        const stars=this.save.levelStars[level.id]||0;
        const done=!!this.save.completedLevels[level.id];
        const card=document.createElement('div');
        card.className=`level-card${locked?' locked':''}${done?' completed':''}`;
        card.innerHTML=locked
          ?`<div class="level-lock-icon">🔒</div><div class="level-number">${level.id}</div><div class="level-name">${level.name}</div>`
          :`<div class="level-number">${level.id}</div><div class="level-name">${level.name}</div>
            <div class="level-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>`;
        if(!locked) card.addEventListener('click',()=>this.startLevel(level.id));
        grid.appendChild(card);
      });
    });
  }

  // ── Start Level ───────────────────────────────────────── //
  startLevel(id){
    this.cleanupAlerts();
    const def=this.levels.flat.find(l=>l.id===id);
    if(!def) return;
    this.currentLevel=def;
    this.levelId=id;
    const W=this.canvas.width,H=this.canvas.height;

    const layout=buildLayout(def.layout,W,H);
    this.tracks=layout.tracks;
    this.signals=layout.signals;
    this.stations=layout.stations;
    this.junctions=layout.junctions;
    this.tracks.forEach(t=>{t.length=trackLength(t.points);});

    // Build natural environment
    this.env.build(W,H,this.tracks);

    // Spawn trains — stagger them along track
    this.trains=[];
    for(let i=0;i<def.trainCount;i++){
      const track=this.tracks[i%this.tracks.length];
      const startT=0.02; // Start at entry
      const clr=TRAIN_COLORS[i%TRAIN_COLORS.length];
      const pos=getPointAtT(track.points,startT);
      
      // Stagger arrival: 0s, 7s, 14s, etc.
      const arrivalDelay=i*7.0; 
      
      this.trains.push({
        id:'TR'+(i+1), name:String.fromCharCode(65+i),
        trackId:track.id,
        t:startT, dir:1,
        speed:CFG.BASE_SPEED*(def.trainSpeeds[i]||0.7),
        speedPct:1,
        color:clr,
        x:pos.x, y:pos.y, angle:pos.angle,
        stopped:false, collided:false,
        trail:[], wheelAngle:0,
        smokeTimer:0, 
        arrivalTimer:arrivalDelay, 
        arrivalPhase:arrivalDelay>0?'waiting':'active',
        hornBlown:false,
        wagons:Math.floor(1+Math.random()*2), 
        length:track.length,
      });
    }

    // Init state
    this.score=0; this.combo=0; this.comboTimer=0;
    this.frameTimer=0; this.elapsed=0;
    this.collisionCount=0; this.selectedTrain=null;
    this.gameActive=true; this.paused=false;
    this.lastTime=null;
    this.trainsPassed=0;
    this.wheelClackTimer=0;
    this.levelData=true;

    this.signals.forEach(s=>{s.blink=false;s.blinkTimer=0;});
    this.updateHUD();
    this.renderTrainList();
    this.showScreen('game');
    Sound.startAmbient();
    Sound.play('score',0.3);
    this.notify('Level '+id+' — '+def.name,'success');
    this.notify(def.description,'');
    document.getElementById('btn-tut-start').style.display='none';
  }

  retryLevel(){if(this.levelId) this.startLevel(this.levelId);}
  nextLevel(){const n=this.levelId+1;if(n<=20) this.startLevel(n);else this.goToMenu();}
  goToMenu(){
    this.gameActive=false; this.paused=false;
    this.cleanupAlerts();
    document.getElementById('overlay-pause').classList.remove('visible');
    this.showScreen('menu');
    this.updateMenuStats();
    Sound.startAmbient();
  }

  // ── Pause / Sound ─────────────────────────────────────── //
  togglePause(){
    if(this.state!=='game') return;
    this.paused=!this.paused;
    document.getElementById('overlay-pause').classList.toggle('visible',this.paused);
    if(!this.paused){this.lastTime=null;Sound.startAmbient();}
    else Sound.stopAmbient();
  }
  toggleSound(){
    const muted=Sound.toggleMute();
    this.save.soundMuted=muted;
    this.persistData();
    ['btn-sound','btn-menu-sound'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.textContent=muted?'🔇':'🔊';
    });
    if(!muted) Sound.startAmbient();
  }

  // ── Canvas Click ──────────────────────────────────────── //
  onCanvasClick(e){
    const rect=this.canvas.getBoundingClientRect();
    const sx=this.canvas.width/rect.width, sy=this.canvas.height/rect.height;
    this.onCanvasClickXY((e.clientX-rect.left)*sx,(e.clientY-rect.top)*sy);
  }

  onCanvasClickXY(mx,my){
    if(this.state!=='game'||this.paused) return;
    let hitSignal=false;
    this.signals.forEach(s=>{
      if(dist({x:mx,y:my},{x:s.x,y:s.y})<CFG.SIGNAL_R*2.8){
        s.state=s.state==='go'?'stop':'go';
        s.blink=true; s.blinkTimer=0.4;
        Sound.play(s.state==='stop'?'signal_stop':'signal',0.45);
        this.particles.emit(s.x,s.y,'signal',8);
        this.addCombo(); hitSignal=true;
      }
    });
    if(!hitSignal){
      let nearest=null,nd=55;
      this.trains.forEach(tr=>{
        const d=dist({x:mx,y:my},{x:tr.x,y:tr.y});
        if(d<nd){nd=d;nearest=tr;}
      });
      if(nearest){
        this.selectedTrain=(this.selectedTrain===nearest)?null:nearest;
        this.renderTrainList();
        if(this.selectedTrain){
          const slider=document.getElementById('speed-slider');
          slider.value=Math.round(this.selectedTrain.speedPct*100);
          document.getElementById('speed-val').textContent=slider.value+'%';
          slider.style.setProperty('--pct',slider.value+'%');
        }
      }
    }
  }

  // ── Emergency Brake ───────────────────────────────────── //
  emergencyBrake(){
    if(!this.gameActive||this.paused) return;
    this.trains.forEach(t=>{if(!t.collided) t.stopped=true;});
    Sound.play('brake',0.5);
    Sound.play('warning',0.4);
    this.notify('🚨 Emergency Brake! All trains stopped.','warning');
    this.particles.emit(this.canvas.width/2,this.canvas.height/2,'spark',25);
    setTimeout(()=>{
      this.trains.forEach(t=>{if(!t.collided) t.stopped=false;});
      this.notify('✅ Trains resuming…','success');
    },2200);
  }

  // ── Combo / Score ─────────────────────────────────────── //
  addCombo(){
    this.combo++;
    this.comboTimer=CFG.COMBO_TIMEOUT;
    if(this.combo>=3) this.addScore(this.combo>=5?CFG.SCORE_COMBO*2:CFG.SCORE_COMBO,'COMBO x'+this.combo);
    this.updateHUD();
  }

  addScore(pts,label=''){
    this.score+=pts;
    if(label) this.showScorePop(pts,label);
    this.updateHUD();
    if(pts>20) Sound.play('score',0.25);
  }

  showScorePop(pts,label){
    const el=document.createElement('div');
    el.className='score-pop';
    el.textContent=`+${pts} ${label}`;
    el.style.left=(Math.random()*40+28)+'%';
    el.style.top=(Math.random()*15+38)+'%';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1300);
  }

  // ── HUD ───────────────────────────────────────────────── //
  updateHUD(){
    document.getElementById('hud-score').textContent=this.score.toLocaleString();
    document.getElementById('hud-level').textContent=this.levelId;
    document.getElementById('hud-trains-count').textContent=
      this.trains.filter(t=>!t.collided).length+'/'+this.trains.length;
    const cb=document.getElementById('hud-combo');
    if(this.combo>=2){cb.classList.remove('hidden');document.getElementById('hud-combo-val').textContent='x'+this.combo;}
    else cb.classList.add('hidden');
  }

  renderTrainList(){
    const c=document.getElementById('train-list');
    c.innerHTML='';
    this.trains.forEach(tr=>{
      const el=document.createElement('div');
      el.className='train-indicator'+(this.selectedTrain===tr?' selected':'')+(tr.stopped?' stopped':'')+(tr.collided?' danger':'');
      const spd=Math.round(tr.speed*(tr.stopped?0:tr.speedPct));
      el.innerHTML=`
        <div class="train-ind-status">${tr.collided?'💥':tr.stopped?'🛑':'🚂'}</div>
        <div class="train-ind-name" style="color:${tr.color.body}">${tr.name}</div>
        <div class="train-ind-speed">${spd}<small>km/h</small></div>
        <div><span class="status-dot ${tr.collided?'warning':tr.stopped?'stopped':'running'}"></span></div>
      `;
      el.addEventListener('click',()=>{
        this.selectedTrain=(this.selectedTrain===tr)?null:tr;
        this.renderTrainList();
      });
      c.appendChild(el);
    });
  }

  notify(msg,type=''){
    const c=document.getElementById('notifications');
    const el=document.createElement('div');
    el.className=`notification${type?' '+type:''}`;
    el.textContent=msg;
    c.appendChild(el);
    setTimeout(()=>el.remove(),3400);
  }

  // ═══════════════════════════════════════════════════════
  // GAME LOOP
  // ═══════════════════════════════════════════════════════
  loop(){
    requestAnimationFrame((ts)=>{
      if(this.lastTime===null) this.lastTime=ts;
      const dt=Math.min((ts-this.lastTime)/1000,0.05);
      this.lastTime=ts;

      if(this.state==='game'&&!this.paused&&this.gameActive){
        this.update(dt);
      }
      if(this.state==='game') this.render();
      else if(this.state==='menu') this.renderMenu();

      this.loop();
    });
  }

  // ── Arrival Warnings ──────────────────────────────────── //
  showArrivalWarning(tr){
    const wrap=this.canvas.parentElement;
    if(!wrap) return;
    
    // Create Alert Box
    const alert=document.createElement('div');
    alert.className='incoming-alert';
    alert.id=`alert-${tr.id}`;
    alert.innerHTML=`⚠ INCOMING: TRAIN ${tr.name}`;
    
    // Create Ping Indicator
    const ping=document.createElement('div');
    ping.className='incoming-indicator';
    ping.id=`ping-${tr.id}`;
    
    // Position based on canvas coordinates
    const rect=this.canvas.getBoundingClientRect();
    const scX=rect.width/this.canvas.width;
    const scY=rect.height/this.canvas.height;
    
    const px=tr.x * scX;
    const py=tr.y * scY;
    
    alert.style.left=(px)+'px';
    alert.style.top=(py-45)+'px'; // Above the entry point
    ping.style.left=(px)+'px';
    ping.style.top=(py)+'px';
    
    wrap.appendChild(alert);
    wrap.appendChild(ping);
  }

  removeArrivalWarning(tr){
    ['alert','ping'].forEach(p=>{
      const el=document.getElementById(`${p}-${tr.id}`);
      if(el) el.remove();
    });
  }

  cleanupAlerts(){
    document.querySelectorAll('.incoming-alert, .incoming-indicator').forEach(el=>el.remove());
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════
  update(dt){
    this.elapsed+=dt;
    this.frameTimer+=dt;
    this.wheelClackTimer+=dt;
    this.env.update(dt);

    // Staggered Arrival Management
    this.trains.forEach(tr=>{
      if(tr.arrivalPhase==='active') return;
      
      tr.arrivalTimer-=dt;
      
      // Warning trigger at 4 seconds
      if(tr.arrivalPhase==='waiting' && tr.arrivalTimer<4){
        tr.arrivalPhase='incoming';
        this.showArrivalWarning(tr);
        this.notify(`Incoming Train ${tr.name}! Prepare for arrival.`,'warning');
      }
      
      // Horn trigger at 3 seconds
      if(tr.arrivalPhase==='incoming' && tr.arrivalTimer<3 && !tr.hornBlown){
        tr.hornBlown=true;
        Sound.play('horn', 0.5, tr.id + '_initial');
      }
      
      // Activation
      if(tr.arrivalTimer<=0){
        tr.arrivalPhase='active';
        this.removeArrivalWarning(tr);
        this.particles.emit(tr.x, tr.y, 'smoke', 8);
      }
    });

    // Timer
    const timeLeft=Math.max(0,this.currentLevel.timeLimit-this.elapsed);
    const timerEl=document.getElementById('hud-timer');
    timerEl.textContent=Math.ceil(timeLeft)+'s';
    timerEl.classList.toggle('warning',timeLeft<15);
    if(timeLeft<=0){this.endLevel(true);return;}

    // Wheel clack sound
    if(this.wheelClackTimer>0.35){
      this.wheelClackTimer=0;
      const running=this.trains.filter(t=>!t.stopped&&!t.collided);
      if(running.length>0) Sound.play('wheelclack',0.12);
    }

    // Combo cooldown
    if(this.comboTimer>0){
      this.comboTimer-=dt*1000;
      if(this.comboTimer<=0){this.combo=0;this.updateHUD();}
    }

    // Signal blink
    this.signals.forEach(s=>{
      if(s.blinkTimer>0){s.blinkTimer-=dt;if(s.blinkTimer<=0)s.blink=false;}
    });

    // Trains
    this.trains.forEach(tr=>{
      if(tr.collided) return;

      const track=this.tracks.find(t=>t.id===tr.trackId);
      if(!track) return;

      // Check signal blocking
      const blocked=this.signals.some(sig=>{
        if(sig.trackId!==tr.trackId||sig.state!=='stop') return false;
        const diff=sig.tPos-tr.t;
        return tr.dir===1?(diff>0&&diff<0.18):(diff<0&&diff>-0.18);
      });

      if(blocked){ tr.stopped=true; }
      else if(!tr._manualStop){ tr.stopped=false; }

      // Horn: approaching a red signal
      if(!tr.stopped&&!tr.collided){
        this.signals.forEach(sig=>{
          if(sig.state!=='stop'||sig.trackId!==tr.trackId) return;
          const d=dist(tr,sig);
          if(d<CFG.HORN_DIST&&d>CFG.SIGNAL_R*3){
            Sound.play('horn',0.35,tr.id+'_horn');
          }
        });
      }

      if(tr.stopped || tr.arrivalPhase!=='active') return;

      // Move
      const effSpd=tr.speed*tr.speedPct;
      const step=(effSpd*dt)/track.length;
      tr.t+=tr.dir*step;

      // Bounce at ends
      if(tr.t>=0.98){tr.t=0.98;tr.dir=-1;this.onTrainReach(tr,track,'end');}
      if(tr.t<=0.02){tr.t=0.02;tr.dir=1;this.onTrainReach(tr,track,'start');}

      // Update position & angle
      const pos=getPointAtT(track.points,tr.t);
      tr.trail.push({x:tr.x,y:tr.y});
      if(tr.trail.length>22) tr.trail.shift();
      tr.x=pos.x; tr.y=pos.y; tr.angle=pos.angle;

      // Wheel rotation
      tr.wheelAngle+=(effSpd*dt)*0.2*(tr.dir===1?1:-1);

      // Smoke particle
      tr.smokeTimer+=dt;
      if(tr.smokeTimer>0.18){
        tr.smokeTimer=0;
        const sOff=(tr.dir===1?-1:1)*(CFG.TRAIN_W*0.5+4);
        const sx=tr.x+Math.cos(tr.angle)*sOff-Math.sin(tr.angle)*(-CFG.TRAIN_H*0.5);
        const sy=tr.y+Math.sin(tr.angle)*sOff+Math.cos(tr.angle)*(-CFG.TRAIN_H*0.5);
        this.particles.emit(sx,sy,'smoke',1);
      }
    });

    // Collision detection
    for(let i=0;i<this.trains.length;i++){
      for(let j=i+1;j<this.trains.length;j++){
        const a=this.trains[i],b=this.trains[j];
        if(a.collided||b.collided) continue;
        if(dist(a,b)<CFG.COLLISION_DIST) this.triggerCollision(a,b);
      }
    }

    // Danger warning lines + horn
    for(let i=0;i<this.trains.length;i++){
      for(let j=i+1;j<this.trains.length;j++){
        const a=this.trains[i],b=this.trains[j];
        if(a.collided||b.collided) continue;
        if(dist(a,b)<CFG.DANGER_DIST) Sound.play('warning',0.08);
      }
    }

    // Particles
    this.particles.update(dt);

    // Periodic score
    if(this.frameTimer>1.8){
      this.frameTimer=0;
      this.addScore(8);
    }

    // Render train list occasionally
    if(Math.floor(this.elapsed*8)%5===0) this.renderTrainList();
  }

  onTrainReach(tr, track, end){
    this.addScore(CFG.SCORE_SAFE,'SAFE');
    this.trainsPassed++;
    const pt=end==='end'?track.points[track.points.length-1]:track.points[0];
    this.particles.emit(pt.x,pt.y,'score',6);
    Sound.play('horn',0.3,tr.id+'_arrive');
  }

  // ── Collision ─────────────────────────────────────────── //
  triggerCollision(a,b){
    a.collided=true;b.collided=true;a.stopped=true;b.stopped=true;
    this.collisionCount++;
    Sound.play('collision',0.7);
    this.particles.emit((a.x+b.x)/2,(a.y+b.y)/2,'collision',50);
    const flash=document.getElementById('collision-flash');
    flash.classList.add('flashing');
    setTimeout(()=>flash.classList.remove('flashing'),500);
    this.notify('💥 CRASH! Trains '+a.name+' & '+b.name,'danger');
    const allDone=this.trains.every(t=>t.collided);
    if(allDone) setTimeout(()=>this.endLevel(false),1500);
    else this.score=Math.max(0,this.score-250);
    this.updateHUD();
  }

  // ── End Level ─────────────────────────────────────────── //
  endLevel(timeUp){
    if(!this.gameActive) return;
    this.gameActive=false;
    const allCrashed=this.trains.every(t=>t.collided);
    if(allCrashed){this.showGameOver();return;}
    if(timeUp){
      if(this.score>=this.currentLevel.targetScore) this.showLevelComplete();
      else this.showGameOver();
    } else this.showLevelComplete();
  }

  showGameOver(){
    Sound.play('collision',0.4);
    document.getElementById('go-score').textContent=this.score.toLocaleString();
    document.getElementById('go-collisions').textContent=this.collisionCount;
    document.getElementById('go-time').textContent=Math.floor(this.elapsed)+'s';
    if(this.score>this.save.highScore){this.save.highScore=this.score;this.persistData();}
    this.showScreen('gameover');
  }

  showLevelComplete(){
    Sound.play('levelup',0.6);
    const pct=this.score/this.currentLevel.targetScore;
    const stars=pct>=1.5?3:pct>=1.0?2:pct>=0.7?1:0;
    const old=this.save.levelStars[this.levelId]||0;
    this.save.levelStars[this.levelId]=Math.max(old,stars);
    this.save.completedLevels[this.levelId]=true;
    const nu=this.levelId+1;
    if(nu<=20&&nu>this.save.unlockedLevel) this.save.unlockedLevel=nu;
    if(this.score>this.save.highScore) this.save.highScore=this.score;
    this.save.totalScore=(this.save.totalScore||0)+this.score;
    this.persistData();
    document.getElementById('lc-score').textContent=this.score.toLocaleString();
    document.getElementById('lc-trains').textContent=this.trainsPassed;
    document.getElementById('lc-time').textContent=Math.floor(this.elapsed)+'s';
    const se=document.getElementById('lc-stars');
    se.innerHTML='';
    for(let i=1;i<=3;i++){
      const s=document.createElement('span');
      s.className='result-star'+(i>stars?' empty':'');
      s.textContent=i<=stars?'⭐':'☆';
      se.appendChild(s);
    }
    document.getElementById('btn-next-level').style.display=this.levelId<20?'block':'none';
    this.showScreen('levelcomplete');
  }

  // ═══════════════════════════════════════════════════════
  // RENDER ENGINE — Full Realistic World
  // ═══════════════════════════════════════════════════════
  render(){
    const ctx=this.ctx, W=this.canvas.width, H=this.canvas.height;
    ctx.clearRect(0,0,W,H);

    if(!this.tracks) return;

    // 1. Natural Sky + Ground + Clouds + Hills
    this.env.drawBackground(ctx);

    // 2. Tracks (realistic ballast + rails + sleepers)
    this.drawTracks(ctx);

    // 3. Junctions
    this.drawJunctions(ctx);

    // 4. Stations (realistic platform buildings)
    this.drawStations(ctx);

    // 5. Trees / nature over ground
    this.env.drawTrees(ctx);

    // 6. Train trails
    this.drawTrainTrails(ctx);

    // 7. Trains (realistic 3D-ish)
    this.drawTrains(ctx);

    // 8. Signals (3D post + lights)
    this.drawSignals(ctx);

    // 9. Particles
    this.particles.draw(ctx);

    // 10. Selected train highlight
    this.drawSelectedHighlight(ctx);

    // 11. Danger proximity lines
    this.drawDangerArcs(ctx);
  }

  // ── Track Rendering ───────────────────────────────────── //
  drawTracks(ctx){
    this.tracks.forEach((track)=>{
      const pts=track.points;
      const totalLen=track.length||trackLength(pts);

      ctx.save();

      // 🛤️ Ballast / gravel bed (Wide)
      ctx.strokeStyle='rgba(75,65,50,0.85)';
      ctx.lineWidth=36;
      ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath();
      pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.stroke();

      // Ballast color variation (Rust/Oil stains)
      ctx.strokeStyle='rgba(100,85,60,0.6)';
      ctx.lineWidth=28;
      ctx.beginPath();
      pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.stroke();

      // Central dark stain (Oil/Dust)
      ctx.strokeStyle='rgba(40,30,20,0.4)';
      ctx.lineWidth=12;
      ctx.beginPath();
      pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.stroke();

      // 🪵 Sleepers (wooden crossties) - Larger
      const sleeperCount=Math.floor(totalLen/24);
      for(let s=0;s<=sleeperCount;s++){
        const t=s/sleeperCount;
        const pos=getPointAtT(pts,t);
        ctx.save();
        ctx.translate(pos.x,pos.y); ctx.rotate(pos.angle);
        // Sleeper shadow
        ctx.fillStyle='rgba(0,0,0,0.3)';
        ctx.fillRect(-16,5,32,10);
        // Sleeper wood
        ctx.fillStyle='#4a3318';
        ctx.fillRect(-15,-6,30,12);
        // Wood grain detail
        ctx.fillStyle='rgba(255,200,150,0.1)';
        ctx.fillRect(-13,-4,26,3);
        ctx.restore();
      }

      // 🛣️ Steel rails (two parallel heavy lines)
      const railOffset = 8.5;
      [-railOffset, railOffset].forEach(offset=>{
        // Rail base shadow
        ctx.strokeStyle='rgba(0,0,0,0.45)';
        ctx.lineWidth=5;
        ctx.beginPath();
        pts.forEach((p,i)=>{
          const a=i<pts.length-1?Math.atan2(pts[i+1].y-p.y,pts[i+1].x-p.x):
                  i>0?Math.atan2(p.y-pts[i-1].y,p.x-pts[i-1].x):0;
          const nx=p.x-Math.sin(a)*offset+1.5;
          const ny=p.y+Math.cos(a)*offset+1.5;
          i===0?ctx.moveTo(nx,ny):ctx.lineTo(nx,ny);
        });
        ctx.stroke();

        // Rail main beam (heavy steel)
        ctx.strokeStyle='#7a8a98';
        ctx.lineWidth=4.5;
        ctx.shadowColor='rgba(150,180,210,0.5)';
        ctx.shadowBlur=4;
        ctx.beginPath();
        pts.forEach((p,i)=>{
          const a=i<pts.length-1?Math.atan2(pts[i+1].y-p.y,pts[i+1].x-p.x):
                  i>0?Math.atan2(p.y-pts[i-1].y,p.x-pts[i-1].x):0;
          const nx=p.x-Math.sin(a)*offset;
          const ny=p.y+Math.cos(a)*offset;
          i===0?ctx.moveTo(nx,ny):ctx.lineTo(nx,ny);
        });
        ctx.stroke();

        // Rail top shine (polished steel)
        ctx.strokeStyle='rgba(230,245,255,0.7)';
        ctx.lineWidth=1.5;
        ctx.shadowBlur=0;
        ctx.beginPath();
        pts.forEach((p,i)=>{
          const a=i<pts.length-1?Math.atan2(pts[i+1].y-p.y,pts[i+1].x-p.x):
                  i>0?Math.atan2(p.y-pts[i-1].y,p.x-pts[i-1].x):0;
          const nx=p.x-Math.sin(a)*(offset-0.8);
          const ny=p.y+Math.cos(a)*(offset-0.8)-0.8;
          i===0?ctx.moveTo(nx,ny):ctx.lineTo(nx,ny);
        });
        ctx.stroke();
      });

      ctx.restore();
    });
  }

  // ── Junction ──────────────────────────────────────────── //
  drawJunctions(ctx){
    this.junctions.forEach(j=>{
      ctx.save();
      // Ground plate
      ctx.fillStyle='rgba(100,85,60,0.8)';
      ctx.beginPath(); ctx.arc(j.x,j.y,18,0,Math.PI*2); ctx.fill();
      // Outer glow
      const grd=ctx.createRadialGradient(j.x,j.y,0,j.x,j.y,28);
      grd.addColorStop(0,'rgba(255,200,80,0.3)');
      grd.addColorStop(1,'transparent');
      ctx.fillStyle=grd;
      ctx.beginPath(); ctx.arc(j.x,j.y,28,0,Math.PI*2); ctx.fill();
      // Metal plate
      ctx.fillStyle='#4a3a20';
      ctx.beginPath(); ctx.arc(j.x,j.y,14,0,Math.PI*2); ctx.fill();
      // Gold ring
      ctx.strokeStyle='rgba(255,200,60,0.9)';
      ctx.lineWidth=2.5;
      ctx.shadowColor='rgba(255,200,60,0.6)';
      ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(j.x,j.y,14,0,Math.PI*2); ctx.stroke();
      // Center bolt
      ctx.fillStyle='rgba(255,215,0,0.9)';
      ctx.beginPath(); ctx.arc(j.x,j.y,5,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });
  }

  // ── Signals (Grand Realistic) ─────────────────────────── //
  drawSignals(ctx){
    this.signals.forEach(sig=>{
      ctx.save();
      const isStop=sig.state==='stop';
      const blink=sig.blink && Math.floor(Date.now()/300)%2===0;
      const sW=28, sH=70; // Grand scale
      const by=sig.y-sH/2;

      // Pole
      ctx.fillStyle='#374151';
      ctx.fillRect(sig.x-2.5, sig.y-sH/2, 5, sH);
      // Concrete Base
      ctx.fillStyle='#4b5563';
      ctx.fillRect(sig.x-10, sig.y+sH/2-4, 20, 6);

      // Box
      ctx.fillStyle='#111827';
      ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=10;
      roundRect(ctx, sig.x-sW/2, by-5, sW, 55, 6);
      ctx.fill();
      ctx.shadowBlur=0;

      // ── Red Light (Top) ──
      const rOn=isStop||blink;
      ctx.beginPath(); ctx.arc(sig.x,by+10,8,0,Math.PI*2);
      ctx.fillStyle=rOn?'#ef4444':'#3d0d0d';
      if(rOn){ctx.shadowColor='#ef4444';ctx.shadowBlur=20;}
      ctx.fill(); ctx.shadowBlur=0;
      if(rOn){
        ctx.fillStyle='rgba(255,200,200,0.5)';
        ctx.beginPath(); ctx.arc(sig.x-3,by+7,3,0,Math.PI*2); ctx.fill();
        const rhalo=ctx.createRadialGradient(sig.x,by+10,0,sig.x,by+10,35);
        rhalo.addColorStop(0,'rgba(239,68,68,0.4)');
        rhalo.addColorStop(1,'transparent');
        ctx.fillStyle=rhalo;
        ctx.beginPath(); ctx.arc(sig.x,by+10,35,0,Math.PI*2); ctx.fill();
      }

      // ── Amber ──
      ctx.beginPath(); ctx.arc(sig.x,by+25,6,0,Math.PI*2);
      ctx.fillStyle='#1c1200'; ctx.fill();

      // ── Green Light (Bottom) ──
      const gOn=!isStop&&!blink;
      ctx.beginPath(); ctx.arc(sig.x,by+40,8,0,Math.PI*2);
      ctx.fillStyle=gOn?'#22c55e':'#0d2e0d';
      if(gOn){ctx.shadowColor='#22c55e';ctx.shadowBlur=20;}
      ctx.fill(); ctx.shadowBlur=0;
      if(gOn){
        ctx.fillStyle='rgba(200,255,220,0.5)';
        ctx.beginPath(); ctx.arc(sig.x-3,by+37,3,0,Math.PI*2); ctx.fill();
        const ghalo=ctx.createRadialGradient(sig.x,by+40,0,sig.x,by+40,35);
        ghalo.addColorStop(0,'rgba(34,197,94,0.4)');
        ghalo.addColorStop(1,'transparent');
        ctx.fillStyle=ghalo;
        ctx.beginPath(); ctx.arc(sig.x,by+40,35,0,Math.PI*2); ctx.fill();
      }

      ctx.restore();
    });
  }

  // ── Stations (Grand Realistic) ────────────────────────── //
  drawStations(ctx){
    this.stations.forEach(st=>{
      ctx.save();
      const above=st.side!=='bot';
      const dirY=above?-1:1;
      const baseY=st.y;
      
      // 🚉 Platform (Larger/More Detailed)
      const platW=90, platH=16; 
      const platY=baseY+dirY*0;

      ctx.fillStyle='rgba(140,135,120,0.95)';
      ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=12; ctx.shadowOffsetY=4;
      roundRect(ctx, st.x-platW/2, platY-platH/2, platW, platH, 5);
      ctx.fill();
      ctx.shadowBlur=0; ctx.shadowOffsetY=0;

      // Tactile Paving (Yellow Line)
      ctx.fillStyle='#f1c40f';
      ctx.fillRect(st.x-platW/2+8, platY+(above?platH/2-4:-(platH/2)), platW-16, 3);

      // 🏢 Building (Grand)
      const bW=70, bH=50;
      const bX=st.x-bW/2, bY=platY+dirY*(platH/2+4);
      const bRectY=above?bY-bH:bY;

      ctx.fillStyle='#2c3e50';
      ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=15;
      roundRect(ctx, bX, bRectY, bW, bH, 6);
      ctx.fill();

      // Glowing Windows
      ctx.fillStyle='rgba(255,255,180,0.2)';
      for(let row=0;row<2;row++){
        for(let col=0;col<3;col++){
          ctx.fillRect(bX+10+col*20, bRectY+10+row*18, 12, 10);
        }
      }

      // Station Signboard (Neon)
      ctx.fillStyle='rgba(0,0,0,0.8)';
      ctx.fillRect(st.x-25, bRectY-15, 50, 12);
      ctx.font='bold 9px Orbitron';
      ctx.fillStyle=CFG.cyan || '#00e5ff';
      ctx.textAlign='center';
      ctx.fillText(st.name.toUpperCase(), st.x, bRectY-6);

      // Platform Lamps (Glowing)
      [st.x-platW/2+10, st.x+platW/2-10].forEach(lx=>{
        ctx.strokeStyle='#7f8c8d'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(lx, platY); ctx.lineTo(lx, platY+dirY*25); ctx.stroke();
        const lGrd=ctx.createRadialGradient(lx, platY+dirY*25, 0, lx, platY+dirY*25, 15);
        lGrd.addColorStop(0,'rgba(255,255,200,0.6)');
        lGrd.addColorStop(1,'transparent');
        ctx.fillStyle=lGrd;
        ctx.beginPath(); ctx.arc(lx, platY+dirY*25, 15, 0, Math.PI*2); ctx.fill();
      });

      ctx.restore();
    });
  }

  // ── Signals (3D post) ─────────────────────────────────── //
  drawSignals(ctx){
    const now=Date.now();
    this.signals.forEach(sig=>{
      ctx.save();
      const isStop=sig.state==='stop';
      const blink=sig.blink&&(Math.floor(now/120)%2===0);

      // Post shadow
      ctx.fillStyle='rgba(0,0,0,0.2)';
      ctx.fillRect(sig.x+2,sig.y+4,3,22);

      // Post (metal pole)
      const postGrd=ctx.createLinearGradient(sig.x-1.5,0,sig.x+3,0);
      postGrd.addColorStop(0,'#6b7280');
      postGrd.addColorStop(0.5,'#9ca3af');
      postGrd.addColorStop(1,'#4b5563');
      ctx.fillStyle=postGrd;
      ctx.fillRect(sig.x-1.5,sig.y+4,3,22);

      // Base plate
      ctx.fillStyle='#374151';
      roundRect(ctx,sig.x-5,sig.y+24,10,4,2);
      ctx.fill();

      // Signal box housing
      const boxW=22,boxH=26;
      const bx=sig.x-boxW/2, by=sig.y-boxH;
      ctx.fillStyle='#1f2937';
      ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=6; ctx.shadowOffsetX=2; ctx.shadowOffsetY=3;
      roundRect(ctx,bx,by,boxW,boxH,5);
      ctx.fill();
      ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;

      // Box highlight edge
      ctx.strokeStyle='rgba(100,120,140,0.5)';
      ctx.lineWidth=1;
      roundRect(ctx,bx,by,boxW,boxH,5);
      ctx.stroke();

      // ── Red light ──
      const rOn=isStop&&!blink;
      ctx.beginPath(); ctx.arc(sig.x,by+7,5.5,0,Math.PI*2);
      ctx.fillStyle=rOn?'#ef4444':'#3d0d0d';
      if(rOn){ctx.shadowColor='#ef4444';ctx.shadowBlur=14;}
      ctx.fill(); ctx.shadowBlur=0;
      // Red lens shine
      if(rOn){
        ctx.fillStyle='rgba(255,200,200,0.4)';
        ctx.beginPath(); ctx.arc(sig.x-1.5,by+5.5,2,0,Math.PI*2); ctx.fill();
        // Outer halo
        const rhalo=ctx.createRadialGradient(sig.x,by+7,0,sig.x,by+7,22);
        rhalo.addColorStop(0,'rgba(239,68,68,0.35)');
        rhalo.addColorStop(1,'transparent');
        ctx.fillStyle=rhalo;
        ctx.beginPath(); ctx.arc(sig.x,by+7,22,0,Math.PI*2); ctx.fill();
      }

      // ── Amber light (middle) ──
      ctx.beginPath(); ctx.arc(sig.x,by+15,4.5,0,Math.PI*2);
      ctx.fillStyle='#1c1200'; ctx.fill();

      // ── Green light ──
      const gOn=!isStop&&!blink;
      ctx.beginPath(); ctx.arc(sig.x,by+23,5.5,0,Math.PI*2);
      ctx.fillStyle=gOn?'#22c55e':'#0d2e0d';
      if(gOn){ctx.shadowColor='#22c55e';ctx.shadowBlur=14;}
      ctx.fill(); ctx.shadowBlur=0;
      if(gOn){
        ctx.fillStyle='rgba(200,255,220,0.4)';
        ctx.beginPath(); ctx.arc(sig.x-1.5,by+21.5,2,0,Math.PI*2); ctx.fill();
        const ghalo=ctx.createRadialGradient(sig.x,by+23,0,sig.x,by+23,22);
        ghalo.addColorStop(0,'rgba(34,197,94,0.35)');
        ghalo.addColorStop(1,'transparent');
        ctx.fillStyle=ghalo;
        ctx.beginPath(); ctx.arc(sig.x,by+23,22,0,Math.PI*2); ctx.fill();
      }

      ctx.restore();
    });
  }

  // ── Train Trails ──────────────────────────────────────── //
  drawTrainTrails(ctx){
    this.trains.forEach(tr=>{
      if(tr.arrivalPhase==='waiting' || tr.trail.length<2) return;
      ctx.save();
      for(let i=1;i<tr.trail.length;i++){
        const a=(i/tr.trail.length);
        ctx.globalAlpha=a*0.25;
        ctx.strokeStyle=tr.color.stripe;
        ctx.lineWidth=3*a;
        ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(tr.trail[i-1].x,tr.trail[i-1].y);
        ctx.lineTo(tr.trail[i].x,tr.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  // ── Realistic Train Drawing ───────────────────────────── //
  drawTrains(ctx){
    this.trains.forEach(tr=>{
      if(tr.arrivalPhase==='waiting') return;
      ctx.save();
      ctx.translate(tr.x,tr.y);
      const angle=(tr.dir===-1)?tr.angle+Math.PI:tr.angle;
      ctx.rotate(angle);

      const W=CFG.TRAIN_W, H=CFG.TRAIN_H;
      const hw=W/2, hh=H/2;

      // Draw wagon(s) behind locomotive
      for(let w=0;w<tr.wagons;w++){
        const woffset=-(hw*2+10)*(w+1); // More gap for large wagons
        ctx.save();
        ctx.translate(woffset,0);
        this.drawWagon(ctx,W*0.9,H*0.95,tr.color,tr.wheelAngle,tr.collided);
        ctx.restore();
      }

      // Locomotive
      this.drawLocomotive(ctx,W,H,tr.color,tr.wheelAngle,tr.collided,tr.dir);

      // Train label - JOR DAR
      ctx.fillStyle='rgba(255,255,255,0.98)';
      ctx.font=`bold ${Math.min(14,W*0.18)}px Orbitron,monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=6;
      ctx.fillText(tr.name,0,0);
      ctx.shadowBlur=0;

      ctx.restore();
    });
  }

  drawLocomotive(ctx, W, H, clr, wheelAngle, crashed, dir){
    const hw=W/2, hh=H/2;

    // 🚂 Deep Drop Shadow
    ctx.save();
    ctx.translate(4,8);
    ctx.fillStyle='rgba(0,0,0,0.4)';
    roundRect(ctx,-hw,-hh,W,H,6);
    ctx.fill();
    ctx.restore();

    // 🚂 Body
    if(crashed){
      ctx.fillStyle='rgba(200,60,60,0.9)';
      roundRect(ctx,-hw,-hh,W,H,6);
      ctx.fill();
    } else {
      const bd=ctx.createLinearGradient(-hw,-hh,-hw,hh);
      bd.addColorStop(0,lighten(clr.body,50));
      bd.addColorStop(0.35,clr.body);
      bd.addColorStop(0.65,clr.body);
      bd.addColorStop(1,darken(clr.body,30));
      ctx.fillStyle=bd;
      roundRect(ctx,-hw,-hh,W,H,6);
      ctx.fill();

      // Side stripes & vents
      ctx.fillStyle=clr.stripe;
      ctx.fillRect(-hw,-hh+H*0.55,W,H*0.2);
      ctx.fillStyle='rgba(0,0,0,0.2)';
      for(let i=0;i<5;i++) ctx.fillRect(-hw+15+i*12, -hh+H*0.75, 4, 3);

      // Detailed Nose (3D impact)
      ctx.fillStyle=darken(clr.body,40);
      roundRect(ctx,hw-20,-hh,20,H,4);
      ctx.fill();
      
      // Front Cowcatcher (Shield)
      ctx.fillStyle='#222';
      ctx.beginPath();
      ctx.moveTo(hw-10, hh); ctx.lineTo(hw+5, hh+6);
      ctx.lineTo(hw+5, -hh-6); ctx.lineTo(hw-10, -hh);
      ctx.closePath(); ctx.fill();

      // Reflections/Glass
      ctx.globalAlpha=0.8;
      const winGrd=ctx.createLinearGradient(hw-18,-hh,hw-18,hh);
      winGrd.addColorStop(0,clr.window);
      winGrd.addColorStop(1,darken(clr.window,40));
      ctx.fillStyle=winGrd;
      ctx.fillRect(hw-18,-hh+4,15,H-8);
      ctx.globalAlpha=1;

      // Glow Lens
      const hlg=ctx.createRadialGradient(hw+5,0,0,hw+5,0,30);
      hlg.addColorStop(0,'rgba(255,255,200,0.6)');
      hlg.addColorStop(1,'transparent');
      ctx.fillStyle=hlg;
      ctx.beginPath(); ctx.arc(hw+5,0,30,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fffce0';
      ctx.beginPath(); ctx.arc(hw-2,0,5,0,Math.PI*2); ctx.fill();
    }

    // Wheels
    const wpos=[-hw*0.7, -hw*0.2, hw*0.3, hw*0.7];
    wpos.forEach(wx=>{
      this.drawWheel(ctx, wx, hh+3, CFG.WHEEL_R, wheelAngle, clr, crashed);
      this.drawWheel(ctx, wx,-hh-3, CFG.WHEEL_R, wheelAngle, clr, crashed);
    });
  }

  drawWagon(ctx, W, H, clr, wheelAngle, crashed){
    const hw=W/2, hh=H/2;
    ctx.save(); ctx.translate(1,5);
    ctx.fillStyle='rgba(0,0,0,0.3)';
    roundRect(ctx,-hw,-hh,W,H,5); ctx.fill();
    ctx.restore();

    const bd=ctx.createLinearGradient(-hw,-hh,-hw,hh);
    bd.addColorStop(0,lighten(clr.body,20));
    bd.addColorStop(0.5,clr.body);
    bd.addColorStop(1,darken(clr.body,20));
    ctx.fillStyle=crashed?'#777':bd;
    roundRect(ctx,-hw,-hh,W,H,4); ctx.fill();

    // Windows
    ctx.fillStyle=clr.window;
    ctx.globalAlpha=0.6;
    for(let i=0;i<4;i++) ctx.fillRect(-hw+12+i*(W/5), -hh+6, W/7, H*0.3);
    ctx.globalAlpha=1;

    // Wheels
    [-hw*0.6, hw*0.6].forEach(wx=>{
      this.drawWheel(ctx,wx,hh+3,CFG.WHEEL_R*0.9,wheelAngle,clr,crashed);
      this.drawWheel(ctx,wx,-hh-3,CFG.WHEEL_R*0.9,wheelAngle,clr,crashed);
    });
  }

  drawWheel(ctx, x, y, r, angle, clr, crashed){
    ctx.save(); ctx.translate(x,y);

    // Wheel shadow
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.4)';
    ctx.scale(1,0.3);
    ctx.beginPath(); ctx.arc(1,5,r,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Outer rim
    ctx.fillStyle=crashed?'#555':'#333';
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();

    // Rim ring
    ctx.strokeStyle='#888';
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,0,r-1,0,Math.PI*2); ctx.stroke();

    // Spokes (rotating)
    ctx.rotate(angle);
    ctx.strokeStyle='rgba(140,140,130,0.9)';
    ctx.lineWidth=1;
    for(let s=0;s<4;s++){
      ctx.save(); ctx.rotate((s/4)*Math.PI*2);
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,r-1.5);
      ctx.stroke(); ctx.restore();
    }

    // Hub
    ctx.fillStyle='#aaa';
    ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fill();

    ctx.restore();
  }

  // ── Selected Highlight ────────────────────────────────── //
  drawSelectedHighlight(ctx){
    if(!this.selectedTrain) return;
    const tr=this.selectedTrain;
    const pulse=0.6+0.4*Math.sin(Date.now()*0.007);
    ctx.save();
    ctx.strokeStyle=tr.color.stripe;
    ctx.lineWidth=2.5;
    ctx.globalAlpha=pulse;
    ctx.shadowColor=tr.color.stripe; ctx.shadowBlur=20;
    ctx.beginPath(); ctx.arc(tr.x,tr.y,35,0,Math.PI*2); ctx.stroke();
    // Direction arrow
    ctx.globalAlpha=pulse*0.8;
    ctx.fillStyle=tr.color.stripe;
    const ax=tr.x+Math.cos(tr.angle)*(tr.dir===1?45:-45);
    const ay=tr.y+Math.sin(tr.angle)*(tr.dir===1?45:-45);
    ctx.save(); ctx.translate(ax,ay); ctx.rotate(tr.dir===1?tr.angle:tr.angle+Math.PI);
    ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-4,4); ctx.lineTo(-4,-4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // ── Danger Arcs ───────────────────────────────────────── //
  drawDangerArcs(ctx){
    for(let i=0;i<this.trains.length;i++){
      for(let j=i+1;j<this.trains.length;j++){
        const a=this.trains[i],b=this.trains[j];
        if(a.collided||b.collided) continue;
        const d=dist(a,b);
        if(d<CFG.DANGER_DIST){
          const pct=1-(d/CFG.DANGER_DIST);
          ctx.save();
          ctx.setLineDash([5,5]);
          ctx.strokeStyle=`rgba(255,${Math.floor(100+100*pct)},0,${pct*0.7})`;
          ctx.lineWidth=1.5+pct*1.5;
          ctx.shadowColor=`rgba(255,150,0,${pct*0.4})`; ctx.shadowBlur=8;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
          ctx.setLineDash([]);
          // Warning icon midpoint
          const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
          ctx.font='bold 14px Arial';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.globalAlpha=pct;
          ctx.fillText('⚠',mx,my);
          ctx.restore();
        }
      }
    }
  }

  // ── Menu render ───────────────────────────────────────── //
  renderMenu(){
    const ctx=this.menuCtx;
    if(!ctx) return;
    const W=this.menuCanvas.width, H=this.menuCanvas.height;
    const t=Date.now()*0.001;
    ctx.clearRect(0,0,W,H);

    // Sky
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#030a14'); sky.addColorStop(1,'#0d2040');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

    // Grid
    ctx.strokeStyle='rgba(0,229,255,0.04)';
    ctx.lineWidth=1;
    for(let x=0;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    // Animated grand train on menu background
    const tx=((t*0.1)%1.4)*W-W*0.2;
    ctx.save();
    ctx.fillStyle='rgba(0,229,255,0.08)'; ctx.strokeStyle='rgba(0,229,255,0.06)';
    ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(0,H*0.4); ctx.lineTo(W,H*0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,H*0.6); ctx.lineTo(W,H*0.6); ctx.stroke();
    // Heavy Silhouette
    ctx.globalAlpha=0.25;
    ctx.fillStyle='rgba(0,229,255,0.8)';
    roundRect(ctx,tx,H*0.35,160,35,8); ctx.fill(); // Locomotive
    roundRect(ctx,tx-180,H*0.55,140,30,6); ctx.fill(); // Wagon 1
    roundRect(ctx,tx-340,H*0.55,140,30,6); ctx.fill(); // Wagon 2
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
// COLOR HELPERS
// ═══════════════════════════════════════════════════════════
function hexParts(hex){
  const h=hex.replace('#','');
  return{r:parseInt(h.slice(0,2),16)||0,g:parseInt(h.slice(2,4),16)||0,b:parseInt(h.slice(4,6),16)||0};
}
function lighten(hex,amt){
  const{r,g,b}=hexParts(hex);
  return`rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
}
function darken(hex,amt){
  const{r,g,b}=hexParts(hex);
  return`rgb(${Math.max(0,r-amt)},${Math.max(0,g-amt)},${Math.max(0,b-amt)})`;
}

// ── Polyfill roundRect as standalone helper ── //
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded',()=>{
  window.game=new TrainGame();
});
