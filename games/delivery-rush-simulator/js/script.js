/* ═══════════════════════════════════════════════════
   DELIVERY RUSH SIMULATOR — Premium Engine
   ═══════════════════════════════════════════════════ */
'use strict';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §1  WORLD CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ROAD_W   = 120;             // Wider roads for better playability
const BLOCK_W  = 260;             // Building block size
const CELL_W   = ROAD_W + BLOCK_W; // 380px per grid cell
const GRID_N   = 7;               // 7 roads × 7 = 6×6 blocks
const WORLD_W  = (GRID_N - 1) * CELL_W + ROAD_W; // 2400px
const WORLD_H  = WORLD_W;

const RX = Array.from({length: GRID_N}, (_,i) => i * CELL_W);
const RY = Array.from({length: GRID_N}, (_,i) => i * CELL_W);

const CAR_W = 28, CAR_H = 50;

// Physics
const ACCEL       = 420;
const BRAKE_F     = 650;
const FRICTION_F  = 220;
const MAX_SPD     = 380;
const TURN_RAD    = 2.8;
const NITRO_BOOST = 1.85;
const NITRO_ACCEL = 3.6;

// Delivery
const PICKUP_R  = 85;
const DROPOFF_R = 85;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §2  LEVELS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const LEVELS = [
  {n:1,  del:1,  time:90,  ai:0,  spd:0.80, wx:'clear',  name:'First Delivery'},
  {n:2,  del:2,  time:85,  ai:3,  spd:0.85, wx:'clear',  name:'Getting Started'},
  {n:3,  del:3,  time:80,  ai:5,  spd:0.90, wx:'clear',  name:'Rush Hour'},
  {n:4,  del:3,  time:75,  ai:8,  spd:0.95, wx:'clear',  name:'City Traffic'},
  {n:5,  del:4,  time:75,  ai:10, spd:1.00, wx:'clear',  name:'Downtown Dash'},
  {n:6,  del:4,  time:70,  ai:12, spd:1.00, wx:'clear',  name:'Express Lane'},
  {n:7,  del:5,  time:70,  ai:14, spd:1.05, wx:'clear',  name:'Speed Run'},
  {n:8,  del:5,  time:65,  ai:14, spd:1.10, wx:'clear',  name:'Adrenaline Zone'},
  {n:9,  del:6,  time:65,  ai:16, spd:1.10, wx:'rain',   name:'Rainy Rush'},
  {n:10, del:6,  time:60,  ai:16, spd:1.15, wx:'rain',   name:'Wet Streets'},
  {n:11, del:7,  time:60,  ai:18, spd:1.15, wx:'fog',    name:'Foggy City'},
  {n:12, del:7,  time:55,  ai:18, spd:1.20, wx:'fog',    name:'Zero Visibility'},
  {n:13, del:8,  time:55,  ai:20, spd:1.20, wx:'rain',   name:'Storm Delivery'},
  {n:14, del:8,  time:50,  ai:20, spd:1.25, wx:'rain',   name:'Hurricane Run'},
  {n:15, del:9,  time:50,  ai:22, spd:1.25, wx:'clear',  name:'Midnight Shift'},
  {n:16, del:9,  time:45,  ai:22, spd:1.30, wx:'rain',   name:'City Chaos'},
  {n:17, del:10, time:45,  ai:24, spd:1.35, wx:'fog',    name:'Phantom Delivery'},
  {n:18, del:10, time:42,  ai:26, spd:1.35, wx:'rain',   name:'Deluge'},
  {n:19, del:11, time:40,  ai:28, spd:1.40, wx:'fog',    name:'Blind Speed'},
  {n:20, del:12, time:38,  ai:30, spd:1.45, wx:'rain',   name:'Extreme Rush'},
  {n:21, del:12, time:35,  ai:32, spd:1.50, wx:'fog',    name:'Pro Driver'},
  {n:22, del:13, time:32,  ai:34, spd:1.50, wx:'rain',   name:'Master Run'},
  {n:23, del:14, time:30,  ai:36, spd:1.55, wx:'fog',    name:'Legend Mode'},
  {n:24, del:15, time:28,  ai:38, spd:1.60, wx:'rain',   name:'Insane Rush'},
  {n:25, del:15, time:25,  ai:40, spd:1.70, wx:'fog',    name:'Maximum Overdrive'}
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §3  HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function rnd(a,b){ return a+Math.random()*(b-a); }
function clamp(v,l,h){ return v<l?l:v>h?h:v; }
function lerp(a,b,t){ return a+(b-a)*t; }
function dist2(ax,ay,bx,by){ const dx=ax-bx,dy=ay-by; return Math.sqrt(dx*dx+dy*dy); }
function nAng(a){ while(a>Math.PI)a-=Math.PI*2; while(a<-Math.PI)a+=Math.PI*2; return a; }

function onRoad(x,y){
  // Check bounds
  if(x<0||x>WORLD_W||y<0||y>WORLD_H) return false;
  // Is on vertical road?
  for(let c=0;c<GRID_N;c++){ if(x>=RX[c] && x<=RX[c]+ROAD_W) return true; }
  // Is on horizontal road?
  for(let r=0;r<GRID_N;r++){ if(y>=RY[r] && y<=RY[r]+ROAD_W) return true; }
  return false;
}
function rIsc(){
  const c=Math.floor(Math.random()*GRID_N);
  const r=Math.floor(Math.random()*GRID_N);
  return {c, r, x:RX[c]+ROAD_W/2, y:RY[r]+ROAD_W/2};
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §4  AUDIO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class AudioSys {
  constructor(){ this.ctx=null; this.m=null; this.eo=null; this.eg=null; this.muted=false; }
  init(){
    if(this.ctx) return;
    try{
      this.ctx=new(window.AudioContext||window.webkitAudioContext)();
      this.m=this.ctx.createGain(); this.m.gain.value=0.5; this.m.connect(this.ctx.destination);
      this._eng();
    }catch(e){}
  }
  _eng(){
    this.eo=this.ctx.createOscillator(); this.eo.type='sawtooth'; this.eo.frequency.value=50;
    const wf=this.ctx.createWaveShaper(); const c=new Float32Array(128);
    for(let i=0;i<128;i++){const x=i*2/128-1;c[i]=((Math.PI+50)*x)/(Math.PI+50*Math.abs(x));}
    wf.curve=c;
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=800;
    this.eg=this.ctx.createGain(); this.eg.gain.value=0;
    this.eo.connect(wf); wf.connect(f); f.connect(this.eg); this.eg.connect(this.m); this.eo.start();
  }
  upd(spd,mx){
    if(!this.ctx||this.muted) return;
    const r=clamp(Math.abs(spd)/mx,0,1);
    this.eo.frequency.setTargetAtTime(50+r*220,this.ctx.currentTime,0.05);
    this.eg.gain.setTargetAtTime(0.06+r*0.14,this.ctx.currentTime,0.05);
  }
  play(f,t,d,g,dl=0,fe=null){
    if(!this.ctx||this.muted) return;
    const o=this.ctx.createOscillator(), gn=this.ctx.createGain();
    o.type=t||'sine'; o.frequency.value=f;
    if(fe) o.frequency.exponentialRampToValueAtTime(fe,this.ctx.currentTime+dl+d);
    gn.gain.setValueAtTime(g,this.ctx.currentTime+dl);
    gn.gain.exponentialRampToValueAtTime(0.01,this.ctx.currentTime+dl+d);
    o.connect(gn); gn.connect(this.m);
    o.start(this.ctx.currentTime+dl); o.stop(this.ctx.currentTime+dl+d);
  }
  horn(){ [0,0.18].forEach(t=>this.play(440,'square',0.15,0.25,t)); }
  drift(){
    if(!this.ctx||this.muted) return;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type='triangle'; o.frequency.value=400; o.frequency.exponentialRampToValueAtTime(100,this.ctx.currentTime+0.2);
    g.gain.value=0.25; g.gain.exponentialRampToValueAtTime(0.01,this.ctx.currentTime+0.2);
    o.connect(g); g.connect(this.m); o.start(); o.stop(this.ctx.currentTime+0.2);
  }
  pick(){ [440,554,659].forEach((f,i)=>this.play(f,'square',0.1,0.2,i*0.08)); }
  del(){ [523,659,784,1047].forEach((f,i)=>this.play(f,'square',0.12,0.25,i*0.1)); }
  win(){ [523,659,784,880,1047].forEach((f,i)=>this.play(f,'square',0.15,0.25,i*0.09)); }
  col(){
    if(!this.ctx||this.muted) return;
    const b=this.ctx.createBuffer(1,Math.floor(this.ctx.sampleRate*0.15),this.ctx.sampleRate);
    const cd=b.getChannelData(0);
    for(let i=0;i<cd.length;i++) cd[i]=(Math.random()*2-1)*(1-i/cd.length);
    const s=this.ctx.createBufferSource(), g=this.ctx.createGain();
    s.buffer=b; g.gain.value=0.5;
    s.connect(g); g.connect(this.m); s.start();
  }
  tog(){ this.muted=!this.muted; if(this.m)this.m.gain.value=this.muted?0:0.5; return this.muted; }
  res(){ if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume(); }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §5  GRAPHICS & MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const B_COLS = [
  { c:['#11192b','#1c2a43','#131f33'], w:'#ffe16b', dw:'#0a101d' },
  { c:['#4a1500','#631d00','#3b1000'], w:'#ffd1a3', dw:'#170700' },
  { c:['#223015','#2a3e18','#1d2713'], w:'#92e854', dw:'#0c1007' },
  { c:['#222','#2c2c2c','#1a1a1a'],    w:'#666',    dw:'#0a0a0a' }
];

class MapSys {
  constructor(){ this.b=[]; }
  gen(){
    if(this.b.length) return;
    const p=14, g=10;
    for(let c=0;c<GRID_N-1;c++){
      for(let r=0;r<GRID_N-1;r++){
        const bx=c*CELL_W+ROAD_W+p, by=r*CELL_W+ROAD_W+p;
        const bw=BLOCK_W-p*2, bh=BLOCK_W-p*2;
        const l=Math.random();
        if(l<0.25) this._bld(bx,by,bw,bh);
        else if(l<0.5){ const hw=(bw-g)/2; this._bld(bx,by,hw,bh); this._bld(bx+hw+g,by,hw,bh); }
        else if(l<0.7){ const hh=(bh-g)/2; this._bld(bx,by,bw,hh); this._bld(bx,by+hh+g,bw,hh); }
        else {
          const hw=(bw-g)/2, hh=(bh-g)/2;
          this._bld(bx,by,hw,hh); this._bld(bx+hw+g,by,hw,hh);
          this._bld(bx,by+hh+g,hw,hh); this._bld(bx+hw+g,by+hh+g,hw,hh);
        }
      }
    }
  }
  _bld(x,y,w,h){
    const t=B_COLS[Math.floor(Math.random()*B_COLS.length)];
    const c=t.c[Math.floor(Math.random()*t.c.length)];
    const ws=[]; const wg=15;
    const nc=Math.max(1,Math.floor((w-12)/wg)), nr=Math.max(1,Math.floor((h-12)/wg));
    for(let ic=0;ic<nc;ic++){
      for(let ir=0;ir<nr;ir++){
        if(Math.random()>0.3) ws.push({x:7+ic*wg,y:7+ir*wg,on:Math.random()>0.4});
      }
    }
    this.b.push({x,y,w,h,c,ws,tw:t.w,td:t.dw});
  }
  draw(ctx, cx, cy, cw, ch){
    const m=100;
    ctx.fillStyle='#13182b'; ctx.fillRect(0,0,WORLD_W,WORLD_H);

    // H Roads
    for(let r=0;r<GRID_N;r++){
      const y=RY[r]; ctx.fillStyle='#21283d'; ctx.fillRect(0,y,WORLD_W,ROAD_W);
      ctx.fillStyle='#2b344d'; ctx.fillRect(0,y,WORLD_W,8); ctx.fillRect(0,y+ROAD_W-8,WORLD_W,8);
      ctx.save(); ctx.setLineDash([26,20]); ctx.strokeStyle='rgba(255,215,0,0.5)'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(0,y+ROAD_W/2); ctx.lineTo(WORLD_W,y+ROAD_W/2); ctx.stroke(); ctx.restore();
    }
    // V Roads
    for(let c=0;c<GRID_N;c++){
      const x=RX[c]; ctx.fillStyle='#21283d'; ctx.fillRect(x,0,ROAD_W,WORLD_H);
      ctx.fillStyle='#2b344d'; ctx.fillRect(x,0,8,WORLD_H); ctx.fillRect(x+ROAD_W-8,0,8,WORLD_H);
      ctx.save(); ctx.setLineDash([26,20]); ctx.strokeStyle='rgba(255,215,0,0.5)'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(x+ROAD_W/2,0); ctx.lineTo(x+ROAD_W/2,WORLD_H); ctx.stroke(); ctx.restore();
    }

    // Intersections
    for(let c=0;c<GRID_N;c++){
      for(let r=0;r<GRID_N;r++){
        const ix=RX[c], iy=RY[r];
        ctx.fillStyle='#272f45'; ctx.fillRect(ix,iy,ROAD_W,ROAD_W);
        ctx.strokeStyle='rgba(255,255,255,0.45)'; ctx.lineWidth=4; ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(ix+6,iy+6); ctx.lineTo(ix+ROAD_W-6,iy+6);
        ctx.moveTo(ix+6,iy+ROAD_W-6); ctx.lineTo(ix+ROAD_W-6,iy+ROAD_W-6);
        ctx.moveTo(ix+6,iy+6); ctx.lineTo(ix+6,iy+ROAD_W-6);
        ctx.moveTo(ix+ROAD_W-6,iy+6); ctx.lineTo(ix+ROAD_W-6,iy+ROAD_W-6);
        ctx.stroke();
        // TL
        const ph=(Date.now()%3000)/3000;
        const lc=ph<0.45?'#FF2020':ph<0.55?'#FFA500':'#20FF60';
        ctx.fillStyle='#111'; ctx.fillRect(ix-14,iy-14,12,20); ctx.fillRect(ix+ROAD_W+2,iy-14,12,20);
        ctx.fillStyle=lc; ctx.beginPath(); ctx.arc(ix-8,iy-4,4,0,Math.PI*2); ctx.arc(ix+ROAD_W+8,iy-4,4,0,Math.PI*2); ctx.fill();
      }
    }

    // Buildings
    for(const b of this.b){
      const sx=b.x-cx, sy=b.y-cy;
      if(sx+b.w<-m||sx>cw+m||sy+b.h<-m||sy>ch+m) continue;
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(b.x+6,b.y+6,b.w,b.h); // shad
      ctx.fillStyle=b.c; ctx.fillRect(b.x,b.y,b.w,b.h);
      const lg=ctx.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);
      lg.addColorStop(0,'rgba(255,255,255,0.1)'); lg.addColorStop(1,'rgba(0,0,0,0.25)');
      ctx.fillStyle=lg; ctx.fillRect(b.x,b.y,b.w,b.h);

      for(const w of b.ws){
        ctx.fillStyle=w.on?b.tw:b.td;
        ctx.fillRect(b.x+w.x, b.y+w.y, 8, 10);
      }
      ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
      ctx.strokeRect(b.x,b.y,b.w,b.h);
    }
  }
}

class Cam {
  constructor(){ this.x=0; this.y=0; }
  upd(tx,ty,cw,ch,dt){
    this.x=lerp(this.x,tx-cw/2,1-Math.pow(0.02,dt));
    this.y=lerp(this.y,ty-ch/2,1-Math.pow(0.02,dt));
    this.x=clamp(this.x,0,WORLD_W-cw); this.y=clamp(this.y,0,WORLD_H-ch);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §6  PARTICLES & FX
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class FX {
  constructor(){ this.p=[]; }
  add(x,y,vx,vy,l,r,c,t){ this.p.push({x,y,vx,vy,l,ml:l,r,c,t}); if(this.p.length>500)this.p.shift(); }
  drift(x,y,a){
    for(let i=0;i<4;i++){
      const a2=a+Math.PI+rnd(-0.8,0.8), s=rnd(30,90);
      this.add(x+rnd(-6,6),y+rnd(-6,6),Math.cos(a2)*s,Math.sin(a2)*s,rnd(0.5,1.2),rnd(10,24),`rgba(220,220,230,${rnd(0.4,0.7)})`,'smk');
    }
  }
  nitro(x,y,a){
    for(let i=0;i<6;i++){
      const a2=a+Math.PI+rnd(-0.25,0.25), s=rnd(160,280);
      const cx=x+Math.cos(a+Math.PI)*28+rnd(-4,4), cy=y+Math.sin(a+Math.PI)*28+rnd(-4,4);
      this.add(cx,cy,Math.cos(a2)*s,Math.sin(a2)*s,rnd(0.1,0.35),rnd(6,12),['#0cf','#88f','#e6f'][i%3],'spk');
    }
  }
  col(x,y){
    for(let i=0;i<24;i++){
      const a=rnd(0,Math.PI*2),s=rnd(80,240);
      this.add(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(0.3,0.8),rnd(4,10),i%2?'#fa0':'#f30','spk');
    }
  }
  pick(x,y){
    for(let i=0;i<30;i++){
      const a=rnd(0,Math.PI*2),s=rnd(50,200);
      this.add(x,y,Math.cos(a)*s,Math.sin(a)*s,rnd(0.6,1.4),rnd(5,13),'#0f8','star');
    }
  }
  del(x,y){
    const col=['#fd0','#f60','#0f8','#fff'];
    for(let i=0;i<40;i++){
      const a=rnd(0,Math.PI*2),s=rnd(80,300);
      this.add(x,y,Math.cos(a)*s*1.2,Math.sin(a)*s*1.2-120,rnd(0.8,2),rnd(7,16),col[i%4],'conf');
    }
  }
  upd(dt){
    for(let i=this.p.length-1;i>=0;i--){
      const p=this.p[i]; p.l-=dt;
      if(p.l<=0){this.p.splice(i,1);continue;}
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.94; p.vy*=0.94;
      if(p.t==='conf') p.vy+=120*dt;
    }
  }
  draw(ctx){
    for(const p of this.p){
      const a=p.l/p.ml; ctx.save(); ctx.globalAlpha=a;
      if(p.t==='smk'){
        ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(2-a),0,Math.PI*2); ctx.fill();
      } else if(p.t==='spk'||p.t==='star'){
        ctx.shadowColor=p.c; ctx.shadowBlur=10; ctx.fillStyle=p.c;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*a,0,Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle=p.c; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.vx*0.01); ctx.fillRect(-p.r/2,-p.r/3,p.r,p.r/2); ctx.restore();
      }
      ctx.restore();
    }
  }
}

class Wx {
  constructor(){ this.t='clear'; this.d=[]; }
  set(t){
    this.t=t; this.d=[];
    if(t==='rain'){ for(let i=0;i<300;i++)this.d.push({x:Math.random(),y:Math.random(),s:rnd(0.5,1)}); }
  }
  get sm(){return this.t==='rain'?0.85:this.t==='fog'?0.9:1;}
  get gm(){return this.t==='rain'?0.75:this.t==='fog'?0.9:1;}
  draw(ctx,cw,ch){
    if(this.t==='rain'){
      ctx.save(); ctx.fillStyle='rgba(0,18,48,0.18)'; ctx.fillRect(0,0,cw,ch);
      ctx.strokeStyle='rgba(160,200,255,0.25)'; ctx.lineWidth=1; ctx.beginPath();
      for(const d of this.d){
        d.y=(d.y+d.s*0.005)%1;
        ctx.moveTo(d.x*cw,d.y*ch); ctx.lineTo(d.x*cw+6,d.y*ch+22);
      }
      ctx.stroke(); ctx.restore();
    } else if(this.t==='fog'){
      const g=ctx.createRadialGradient(cw/2,ch/2,cw*0.1,cw/2,ch/2,cw*0.8);
      g.addColorStop(0,'rgba(200,210,225,0)'); g.addColorStop(1,'rgba(170,185,205,0.55)');
      ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §7  PLAYER  (Sliding Wall Collision)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class Player {
  constructor(x,y){
    this.x=x; this.y=y; this.ang=0; this.spd=0;
    this.pkg=false; this.niC=100; this.niOn=false; this.drf=false;
    this.su=0; this.hu=0; this.nu=0; this.lm=1;
    this.hf=0; this.dt=0; this.sm=[];
  }
  get mxS(){ return MAX_SPD * this.lm * (1+this.su*0.22); }
  update(dt, inp, wx){
    const tm=this.mxS, hm=1+this.hu*0.2, gm=wx.gm, nm=1+this.nu*0.15;
    if(inp.ni && this.niC>1){ this.niOn=true; this.niC=Math.max(0,this.niC-45*dt); }
    else { this.niOn=false; this.niC=Math.min(100,this.niC+22*dt); }

    const eTop = this.niOn ? tm*NITRO_BOOST*nm : tm;
    const eAc = this.niOn ? NITRO_ACCEL : 1;

    // inp.acc and inp.str are the correct property names from Inp class
    const facAcc = inp.acc || 0;
    const facStr = inp.str || 0;

    // Movement
    if(facAcc>0) this.spd += ACCEL*eAc*facAcc*dt;
    else if(facAcc<0){
      if(this.spd>0) this.spd = Math.max(0, this.spd - BRAKE_F*Math.abs(facAcc)*dt);
      else this.spd -= ACCEL*0.45*Math.abs(facAcc)*dt;
    } else {
      if(this.spd>0) this.spd=Math.max(0,this.spd-FRICTION_F*dt);
      else if(this.spd<0) this.spd=Math.min(0,this.spd+FRICTION_F*dt);
    }
    this.spd=clamp(this.spd,-eTop*0.35,eTop);

    // Steer
    if(Math.abs(this.spd)>15 && Math.abs(facStr)>0.05){
      const r=clamp(Math.abs(this.spd)/tm, 0.15, 1.0);
      this.ang += TURN_RAD*hm*gm*r*dt*facStr*Math.sign(this.spd);
    }

    // Drift detect
    this.dt = (Math.abs(this.spd)>140 && Math.abs(facStr)>0.5) ? Math.min(this.dt+dt,2) : Math.max(0,this.dt-dt*4);
    this.drf = this.dt>0.06;
    if(this.drf) this.sm.push({x:this.x,y:this.y});
    if(this.sm.length>250) this.sm.shift();

    // Road Bounds + Slide
    const nx = this.x + Math.cos(this.ang)*this.spd*dt;
    const ny = this.y + Math.sin(this.ang)*this.spd*dt;
    
    // Check bounding box corners against road logic to prevent edge slipping
    const sz=CAR_W/2+4;
    const ok = onRoad(nx-sz,ny-sz) && onRoad(nx+sz,ny-sz) && onRoad(nx-sz,ny+sz) && onRoad(nx+sz,ny+sz);
    
    if(ok){
      this.x=nx; this.y=ny;
    } else {
      const okX = onRoad(nx-sz,this.y-sz) && onRoad(nx+sz,this.y-sz) && onRoad(nx-sz,this.y+sz) && onRoad(nx+sz,this.y+sz);
      const okY = onRoad(this.x-sz,ny-sz) && onRoad(this.x+sz,ny-sz) && onRoad(this.x-sz,ny+sz) && onRoad(this.x+sz,ny+sz);
      
      if(okX){ this.x=nx; this.spd*=1-1.2*dt; }
      else if(okY){ this.y=ny; this.spd*=1-1.2*dt; }
      else { this.spd*=1-4*dt; } // hard bounce
    }
    
    this.x=clamp(this.x,ROAD_W/2,WORLD_W-ROAD_W/2);
    this.y=clamp(this.y,ROAD_W/2,WORLD_H-ROAD_W/2);

    this.hf=Math.max(0,this.hf-dt*4);
  }
  hit(){ this.spd*=0.3; this.hf=1; }
  
  draw(ctx){
    ctx.save();
    if(this.sm.length>1){
      ctx.strokeStyle='rgba(40,40,40,0.5)'; ctx.lineWidth=7; ctx.setLineDash([10,8]);
      ctx.beginPath(); ctx.moveTo(this.sm[0].x,this.sm[0].y);
      for(let i=1;i<this.sm.length;i++) ctx.lineTo(this.sm[i].x,this.sm[i].y);
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.translate(this.x,this.y); ctx.rotate(this.ang-Math.PI/2);
    const W=CAR_W,H=CAR_H;

    if(this.niOn){ ctx.shadowColor='#0cf'; ctx.shadowBlur=28; }
    if(this.hf>0){ ctx.shadowColor='#f20'; ctx.shadowBlur=20*this.hf; }

    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(-W/2+4,5,W,H); // shad
    
    const bg=ctx.createLinearGradient(-W/2,-H/2,W/2,H/2);
    bg.addColorStop(0,'#FFEA50'); bg.addColorStop(0.5,'#FFD200'); bg.addColorStop(1,'#D08000');
    ctx.fillStyle=bg; ctx.shadowBlur=0;
    const px=-W/2, py=-H/2, pr=6;
    ctx.beginPath(); ctx.moveTo(px+pr,py); ctx.lineTo(px+W-pr,py); ctx.arcTo(px+W,py,px+W,py+pr,pr);
    ctx.lineTo(px+W,py+H-pr); ctx.arcTo(px+W,py+H,px+W-pr,py+H,pr);
    ctx.lineTo(px+pr,py+H); ctx.arcTo(px,py+H,px,py+H-pr,pr); ctx.lineTo(px,py+pr); ctx.arcTo(px,py,px+pr,py,pr); ctx.fill();

    // Windows
    const cg=ctx.createLinearGradient(-W/2+4,-H/2+8,W/2-4,-H/2+8+H*0.25);
    cg.addColorStop(0,'rgba(100,225,255,0.9)'); cg.addColorStop(1,'rgba(50,150,220,0.7)');
    ctx.fillStyle=cg; ctx.fillRect(-W/2+4,-H/2+8,W-8,H*0.25);
    ctx.fillStyle='rgba(60,160,220,0.6)'; ctx.fillRect(-W/2+5,H/2-7-H*0.14,W-10,H*0.14);

    // Lights
    ctx.fillStyle='#FFFAB0'; ctx.fillRect(-W/2+3,-H/2,8,6); ctx.fillRect(W/2-11,-H/2,8,6);
    if(this.niOn){ ctx.shadowColor='#FFFAA0'; ctx.shadowBlur=12; ctx.fillRect(-W/2+3,-H/2,8,6); ctx.fillRect(W/2-11,-H/2,8,6); ctx.shadowBlur=0; }
    ctx.fillStyle=this.spd<-5?'#FF6000':'#FF1010'; ctx.fillRect(-W/2+3,H/2-6,8,6); ctx.fillRect(W/2-11,H/2-6,8,6);

    // Wheels
    ctx.fillStyle='#111'; const ww=8,wh=15;
    ctx.fillRect(-W/2-4,-H/2+6,ww,wh); ctx.fillRect(W/2-4,-H/2+6,ww,wh);
    ctx.fillRect(-W/2-4,H/2-6-wh,ww,wh); ctx.fillRect(W/2-4,H/2-6-wh,ww,wh);
    ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(-W/2-2,-H/2+7,4,6); ctx.fillRect(W/2-2,-H/2+7,4,6);

    // Package box
    if(this.pkg){
      ctx.fillStyle='#8B4513'; ctx.fillRect(-W/3,-H/6,W*0.66,H/3);
      ctx.strokeStyle='#5C2800'; ctx.lineWidth=1; ctx.strokeRect(-W/3,-H/6,W*0.66,H/3);
      ctx.strokeStyle='#f80'; ctx.setLineDash([3,3]); ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(0,-H/6); ctx.lineTo(0,H/6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-W/3,0); ctx.lineTo(W/3,0); ctx.stroke(); ctx.setLineDash([]);
    }

    // Flame
    if(this.niOn){
      const l=rnd(18,36); const fg=ctx.createLinearGradient(0,H/2,0,H/2+l);
      fg.addColorStop(0,'rgba(0,180,255,0.95)'); fg.addColorStop(0.5,'rgba(100,50,255,0.7)'); fg.addColorStop(1,'rgba(255,0,255,0)');
      ctx.fillStyle=fg; ctx.beginPath(); ctx.ellipse(0,H/2+l/2,8,l/2,0,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §8  AI ROAD NAVIGATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class AI {
  constructor(sm){
    const i=rIsc();
    this.c=i.c; this.r=i.r;
    this.x=i.x; this.y=i.y;
    // Pick immediate adjacent neighbor
    this._pTgt();
    this.ang=Math.atan2(this.tY-this.y, this.tX-this.x);
    this.msp=rnd(100,160)*sm;
    this.cM=AI_COLS[Math.floor(Math.random()*AI_COLS.length)];
  }
  _pTgt(){
    const adjs=[];
    if(this.c>0) adjs.push({c:this.c-1, r:this.r});
    if(this.c<GRID_N-1) adjs.push({c:this.c+1, r:this.r});
    if(this.r>0) adjs.push({c:this.c, r:this.r-1});
    if(this.r<GRID_N-1) adjs.push({c:this.c, r:this.r+1});
    const nt=adjs[Math.floor(Math.random()*adjs.length)];
    this.nc=nt.c; this.nr=nt.r;
    this.tX=RX[nt.c]+ROAD_W/2 + rnd(-16,16); // small variance in lane
    this.tY=RY[nt.r]+ROAD_W/2 + rnd(-16,16);
  }
  upd(dt){
    const dx=this.tX-this.x, dy=this.tY-this.y;
    const d=Math.sqrt(dx*dx+dy*dy);
    if(d<20){
      this.c=this.nc; this.r=this.nr;
      this._pTgt();
    }
    const tA=Math.atan2(this.tY-this.y, this.tX-this.x);
    this.ang+=clamp(nAng(tA-this.ang), -4*dt, 4*dt);
    
    const v=this.msp*dt;
    this.x+=Math.cos(this.ang)*v; 
    this.y+=Math.sin(this.ang)*v;
    this.x=clamp(this.x, ROAD_W*0.3, WORLD_W-ROAD_W*0.3);
    this.y=clamp(this.y, ROAD_W*0.3, WORLD_H-ROAD_W*0.3);
  }
  draw(ctx){
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.ang-Math.PI/2);
    const W=24,H=42;
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(-W/2+4,4,W,H);
    ctx.fillStyle=this.cM; ctx.fillRect(-W/2,-H/2,W,H);
    const lg=ctx.createLinearGradient(-W/2,-H/2,W/2,0);
    lg.addColorStop(0,'rgba(255,255,255,0.2)'); lg.addColorStop(1,'rgba(0,0,0,0.1)');
    ctx.fillStyle=lg; ctx.fillRect(-W/2,-H/2,W,H);
    ctx.fillStyle='rgba(130,220,255,0.6)'; ctx.fillRect(-W/2+3,-H/2+6,W-6,H*0.25);
    ctx.fillStyle='#111'; ctx.fillRect(-W/2-2,-H/2+4,5,10); ctx.fillRect(W/2-3,-H/2+4,5,10); ctx.fillRect(-W/2-2,H/2-4-10,5,10); ctx.fillRect(W/2-3,H/2-4-10,5,10);
    ctx.fillStyle='#ffd'; ctx.fillRect(-W/2+2,-H/2,4,4); ctx.fillRect(W/2-6,-H/2,4,4);
    ctx.fillStyle='#f22'; ctx.fillRect(-W/2+2,H/2-4,4,4); ctx.fillRect(W/2-6,H/2-4,4,4);
    ctx.restore();
  }
  hit(p){ return dist2(this.x,this.y,p.x,p.y)<40; }
}
const AI_COLS=['#E74C3C','#3498DB','#2ECC71','#E67E22','#9B59B6','#1ABC9C','#F39C12','#00BCD4'];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §9  DELIVERY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class Del {
  constructor(){
    this.s='idle'; this.p=null; this.d=null;
    this.dn=0; this.tot=0; this.tm=0; this.cmb=1; this.ct=0; this.ph=0;
    this.np=false; this.nd=false;
  }
  start(cfg){
    this.tot=cfg.del; this.dn=0; this.s='idle'; this.cmb=1; this.ct=0;
    this.p=null; this.d=null;
    this._pPick(WORLD_W/2,WORLD_H/2);
  }
  _pPick(px,py){
    let b=null, bd=0;
    for(let i=0;i<20;i++){ const p=rIsc(); const dist=dist2(p.x,p.y,px,py); if(dist>400&&dist>bd){ b=p; bd=dist; } }
    if(!b) b=rIsc();
    this.p=b; this.d=null; this.s='gotoPickup'; this.tm=0;
  }
  _pDrop(px,py){
    let b=null, bd=0;
    for(let i=0;i<20;i++){ 
      const p=rIsc(); const dp=dist2(p.x,p.y,px,py), dpp=dist2(p.x,p.y,this.p.x,this.p.y);
      const s=dp+dpp*0.5; if(dp>450&&s>bd){ b=p; bd=s; }
    }
    if(!b) b=rIsc();
    this.d=b; this.s='goDeliver';
  }
  upd(dt, plr, gm){
    this.ph=(this.ph+dt*3)%(Math.PI*2);
    if(this.ct>0){ this.ct-=dt; if(this.ct<=0)this.cmb=1; }
    if(this.s==='goDeliver') this.tm+=dt;
    this.np=false; this.nd=false;

    if(this.s==='gotoPickup'&&this.p){
      const dist=dist2(plr.x,plr.y,this.p.x,this.p.y);
      this.np=dist<PICKUP_R*2.5;
      if(dist<PICKUP_R){
        plr.pkg=true; this._pDrop(plr.x,plr.y); this.tm=0;
        gm.audio.pick(); gm.fx.pick(plr.x,plr.y); gm.bonus('📦 PACKAGE OBTAINED!','#00FF88');
      }
    }
    if(this.s==='goDeliver'&&this.d){
      const dist=dist2(plr.x,plr.y,this.d.x,this.d.y);
      this.nd=dist<DROPOFF_R*2.5;
      if(dist<DROPOFF_R){
        plr.pkg=false; this.dn++;
        const tb=Math.max(0,Math.floor((55-this.tm)*14));
        const pts=Math.floor((700+tb)*this.cmb);
        this.cmb=Math.min(9,this.cmb+0.5); this.ct=10;
        gm.onDel(pts,this.cmb,tb);
        gm.fx.del(plr.x,plr.y); gm.audio.del();
        if(this.dn>=this.tot){ this.s='done'; gm.lvlCmpl(); }
        else this._pPick(plr.x,plr.y);
      }
    }
  }
  draw(ctx){
    const pls=0.65+0.35*Math.sin(this.ph), sc=1+0.15*Math.sin(this.ph*1.6);
    if(this.s==='gotoPickup'&&this.p) this._mk(ctx,this.p.x,this.p.y,'#00FF88','#003322',pls,sc,'📦','PICKUP',this.np);
    if(this.s==='goDeliver'&&this.d) this._mk(ctx,this.d.x,this.d.y,'#FF6B00','#331500',pls,sc,'🏠','DELIVER',this.nd);
  }
  _mk(ctx,x,y,c,dc,p,s,i,l,n){
    ctx.save(); ctx.translate(x,y);
    ctx.globalAlpha=0.25*p; ctx.fillStyle=c; ctx.beginPath(); ctx.arc(0,0,60*s,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.45*p; ctx.beginPath(); ctx.arc(0,0,40*s,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1; ctx.fillStyle=dc; ctx.beginPath(); ctx.arc(0,0,24,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=c; ctx.lineWidth=n?5:3; ctx.shadowColor=c; ctx.shadowBlur=n?24:14; ctx.stroke(); ctx.shadowBlur=0;
    ctx.font=`${n?24:18}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff'; ctx.fillText(i,0,0);
    ctx.fillStyle=c; ctx.font=`bold ${n?16:12}px Orbitron`; ctx.textBaseline='bottom'; ctx.shadowColor=c; ctx.shadowBlur=8; ctx.fillText(l,0,-32); ctx.shadowBlur=0;
    const ay=-54+Math.sin(this.ph)*8; ctx.font=`${n?20:16}px sans-serif`; ctx.textBaseline='middle'; ctx.fillText('▼',0,ay);
    ctx.restore();
  }
  tA(p){ const t=this.s==='gotoPickup'?this.p:this.d; return t?Math.atan2(t.y-p.y,t.x-p.x):0; }
  tD(p){ const t=this.s==='gotoPickup'?this.p:this.d; return t?Math.round(dist2(p.x,p.y,t.x,t.y)):0; }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §10  UI DRAWING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function drawSpd(ctx,spd,mx,nOn){
  const W=150,H=150,cx=W/2,cy=H*0.55,r=58;
  const sA=0.75*Math.PI, sw=1.5*Math.PI;
  ctx.clearRect(0,0,W,H);
  
  const fg=ctx.createRadialGradient(cx,cy,8,cx,cy,r);
  fg.addColorStop(0,'#12192a'); fg.addColorStop(1,'#080c1a');
  ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(cx,cy,r+10,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=nOn?'rgba(0,180,255,0.7)':'rgba(255,215,0,0.3)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(cx,cy,r+8,0,Math.PI*2); ctx.stroke();

  ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=14; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(cx,cy,r,sA,sA+sw); ctx.stroke();

  const rt=clamp(Math.abs(spd)/mx,0,1);
  if(rt>0.01){
    const sc=ctx.createLinearGradient(cx-r,cy,cx+r,cy);
    sc.addColorStop(0,'#0f8'); sc.addColorStop(0.5,'#fd0'); sc.addColorStop(1,'#f20');
    ctx.strokeStyle=sc; ctx.lineWidth=14; ctx.shadowColor=nOn?'#0cf':'rgba(255,165,0,0.8)'; ctx.shadowBlur=nOn?20:12;
    ctx.beginPath(); ctx.arc(cx,cy,r,sA,sA+sw*rt); ctx.stroke(); ctx.shadowBlur=0;
  }
  for(let i=0;i<=10;i++){
    const a=sA+sw*(i/10), ir=i%5===0?r-15:r-8;
    ctx.strokeStyle=i%5===0?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.3)'; ctx.lineWidth=i%5===0?3:1.5;
    ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*ir,cy+Math.sin(a)*ir); ctx.lineTo(cx+Math.cos(a)*(r-2),cy+Math.sin(a)*(r-2)); ctx.stroke();
  }
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(sA+sw*rt);
  const ng=ctx.createLinearGradient(0,-r+15,0,12); ng.addColorStop(0,'#f40'); ng.addColorStop(1,'rgba(255,60,0,0)');
  ctx.fillStyle=ng; ctx.shadowColor='#f40'; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.moveTo(-3,12); ctx.lineTo(0,-r+18); ctx.lineTo(3,12); ctx.fill();
  ctx.restore(); ctx.shadowBlur=0;
  
  ctx.fillStyle='#fd0'; ctx.beginPath(); ctx.arc(cx,cy,10,0,Math.PI*2); ctx.fill();
}

function drawMM(ctx,p,ais,del){
  const W=150,H=150,sc=W/WORLD_W;
  ctx.clearRect(0,0,W,H); ctx.fillStyle='#060a15'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#212a40';
  for(let i=0;i<GRID_N;i++){ ctx.fillRect(0,RY[i]*sc,W,ROAD_W*sc); ctx.fillRect(RX[i]*sc,0,ROAD_W*sc,H); }
  ctx.fillStyle='rgba(255,60,60,0.8)'; for(const a of ais){ ctx.beginPath(); ctx.arc(a.x*sc,a.y*sc,2.5,0,Math.PI*2); ctx.fill(); }
  if(del.s==='gotoPickup'&&del.p){ ctx.fillStyle='#0f8'; ctx.shadowColor='#0f8'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(del.p.x*sc,del.p.y*sc,6,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0; }
  if(del.s==='goDeliver'&&del.d){ ctx.fillStyle='#f60'; ctx.shadowColor='#f60'; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(del.d.x*sc,del.d.y*sc,6,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0; }
  const px=p.x*sc, py=p.y*sc;
  ctx.fillStyle='#fd0'; ctx.shadowColor='#fd0'; ctx.shadowBlur=12; ctx.beginPath(); ctx.arc(px,py,7,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='#fd0'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+Math.cos(p.ang)*14,py+Math.sin(p.ang)*14); ctx.stroke();
  ctx.strokeStyle='rgba(255,215,0,0.25)'; ctx.lineWidth=2; ctx.strokeRect(0,0,W,H);
}

function dSL(ctx,spd,mx,nOn,cw,ch){
  const rt=clamp(Math.abs(spd)/mx,0,1); if(rt<0.3)return;
  const ins=(rt-0.3)/0.7, cx=cw/2, cy=ch/2, cnt=Math.floor(ins*35);
  ctx.save(); ctx.strokeStyle=nOn?`rgba(0,180,255,${0.1*ins})`:`rgba(255,255,255,${0.08*ins})`; ctx.lineWidth=2;
  for(let i=0;i<cnt;i++){
    const a=rnd(0,Math.PI*2), r1=rnd(cw*0.2,cw*0.4), r2=rnd(cw*0.5,cw*1.2);
    ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1); ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2); ctx.stroke();
  }
  ctx.restore();
  if(nOn){
    const g=ctx.createRadialGradient(cx,cy,cw*0.3,cx,cy,cw*0.9);
    g.addColorStop(0,'rgba(0,160,255,0)'); g.addColorStop(1,'rgba(0,80,255,0.15)');
    ctx.fillStyle=g; ctx.fillRect(0,0,cw,ch);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §11  INPUT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class Inp {
  constructor(){
    this.acc=0; this.str=0; this.ni=false; this.k={}; this.j={x:0,y:0,o:false};
    this.mni=false; this.mbr=false;
    window.addEventListener('keydown',e=>{
      this.k[e.code]=true;
      if((e.code==='KeyP'||e.code==='Escape')&&window.G) G.pause();
      if(e.code==='KeyH'&&window.G) G.audio.horn();
      if(e.code==='Space'||e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup',e=>this.k[e.code]=false);
    this._mob();
  }
  _mob(){
    const a=document.getElementById('joyArea'), t=document.getElementById('joyThumb');
    if(!a||!t) return;
    const R=60;
    const gC=()=>{const r=a.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};};
    const mv=(cx,cy)=>{
      const c=gC(), dx=cx-c.x, dy=cy-c.y, l=Math.sqrt(dx*dx+dy*dy), cl=Math.min(l,R);
      const nx=l>0?dx/l:0, ny=l>0?dy/l:0;
      this.j.x=nx*(cl/R); this.j.y=ny*(cl/R);
      t.style.transform=`translate(calc(-50% + ${nx*cl}px), calc(-50% + ${ny*cl}px))`;
    };
    const end=()=>{this.j.x=0;this.j.y=0;this.j.o=false;t.style.transform='translate(-50%,-50%)';};
    a.addEventListener('touchstart',ev=>{ev.preventDefault();this.j.o=true;mv(ev.touches[0].clientX,ev.touches[0].clientY);},{passive:false});
    a.addEventListener('touchmove',ev=>{ev.preventDefault();if(this.j.o)mv(ev.touches[0].clientX,ev.touches[0].clientY);},{passive:false});
    a.addEventListener('touchend',end); a.addEventListener('touchcancel',end);
    const n=document.getElementById('mNitro'), b=document.getElementById('mBrake');
    if(n){
      n.addEventListener('touchstart',ev=>{ev.preventDefault();this.mni=true;},{passive:false});
      n.addEventListener('touchend',()=>this.mni=false);
      n.addEventListener('touchcancel',()=>this.mni=false);
      // Also support mouse for desktop testing
      n.addEventListener('mousedown',()=>this.mni=true);
      n.addEventListener('mouseup',()=>this.mni=false);
    }
    if(b){
      b.addEventListener('touchstart',ev=>{ev.preventDefault();this.mbr=true;},{passive:false});
      b.addEventListener('touchend',()=>this.mbr=false);
      b.addEventListener('touchcancel',()=>this.mbr=false);
      b.addEventListener('mousedown',()=>this.mbr=true);
      b.addEventListener('mouseup',()=>this.mbr=false);
    }
    // Horn button
    const h=document.getElementById('mHorn');
    if(h){
      h.addEventListener('touchstart',ev=>{ev.preventDefault();if(window.G)G.audio.horn();},{passive:false});
      h.addEventListener('mousedown',()=>{if(window.G)G.audio.horn();});
    }
  }
  upd(){
    // Keyboard input
    if(this.k['ArrowUp']||this.k['KeyW']) this.acc=1;
    else if((this.k['ArrowDown']||this.k['KeyS'])&&!this.mbr) this.acc=-1;
    else this.acc=0;
    if(this.k['ArrowLeft']||this.k['KeyA']) this.str=-1;
    else if(this.k['ArrowRight']||this.k['KeyD']) this.str=1;
    else this.str=0;
    this.ni=this.k['Space']||this.k['ShiftLeft']||this.mni;
    if(this.mbr) this.acc=-1;
    // Joystick overrides keyboard
    if(this.j.o){ this.str=this.j.x; this.acc=clamp(-this.j.y,-1,1); }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §12  THUMBNAIL UI GENERATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function drawThumbnail(){
  const c = document.createElement('canvas');
  c.width=1200; c.height=630;
  const x = c.getContext('2d');
  
  // BG Gradient
  const g = x.createLinearGradient(0,0,1200,630);
  g.addColorStop(0,'#060d1a'); g.addColorStop(1,'#14203a');
  x.fillStyle=g; x.fillRect(0,0,1200,630);
  
  // Roads grid backing
  x.strokeStyle='rgba(255,215,0,0.15)'; x.lineWidth=4;
  for(let i=0;i<1200;i+=150){
    x.beginPath(); x.moveTo(i,0); x.lineTo(i,630); x.stroke();
    x.beginPath(); x.moveTo(0,i); x.lineTo(1200,i); x.stroke();
  }

  // Draw huge car
  x.save();
  x.translate(600, 315);
  x.rotate(Math.PI/6);
  x.scale(4.5, 4.5);
  const W=CAR_W, H=CAR_H;

  x.shadowColor='#0cf'; x.shadowBlur=40;
  x.fillStyle='rgba(0,0,0,0.5)'; x.fillRect(-W/2+4,8,W,H); // shadow
  
  const bg=x.createLinearGradient(-W/2,-H/2,W/2,H/2);
  bg.addColorStop(0,'#FFEE50'); bg.addColorStop(0.5,'#FFD700'); bg.addColorStop(1,'#CC7000');
  x.fillStyle=bg; x.shadowBlur=0;
  const px=-W/2, py=-H/2, pr=6;
  x.beginPath(); x.moveTo(px+pr,py); x.lineTo(px+W-pr,py); x.arcTo(px+W,py,px+W,py+pr,pr);
  x.lineTo(px+W,py+H-pr); x.arcTo(px+W,py+H,px+W-pr,py+H,pr);
  x.lineTo(px+pr,py+H); x.arcTo(px,py+H,px,py+H-pr,pr); x.lineTo(px,py+pr); x.arcTo(px,py,px+pr,py,pr); x.fill();
  
  x.fillStyle='rgba(0,180,255,0.85)'; x.fillRect(-W/2+4,-H/2+8,W-8,H*0.25);
  x.fillStyle='rgba(0,120,220,0.7)'; x.fillRect(-W/2+5,H/2-7-H*0.14,W-10,H*0.14);
  x.fillStyle='#FFF'; x.fillRect(-W/2+3,-H/2,8,6); x.fillRect(W/2-11,-H/2,8,6);
  x.fillStyle='#F20'; x.fillRect(-W/2+3,H/2-6,8,6); x.fillRect(W/2-11,H/2-6,8,6);
  x.fillStyle='#111'; x.fillRect(-W/2-4,-H/2+6,8,15); x.fillRect(W/2-4,-H/2+6,8,15);
  x.fillRect(-W/2-4,H/2-6-15,8,15); x.fillRect(W/2-4,H/2-6-15,8,15);
  
  // Delivery box
  x.fillStyle='#8B4513'; x.fillRect(-W/3,-H/6,W*0.66,H/3);
  x.strokeStyle='#5C2800'; x.strokeRect(-W/3,-H/6,W*0.66,H/3);
  x.strokeStyle='#fd0'; x.lineWidth=2; x.setLineDash([3,3]);
  x.beginPath(); x.moveTo(0,-H/6); x.lineTo(0,H/6); x.stroke(); x.setLineDash([]);

  // Nitro
  x.fillStyle='rgba(0,200,255,0.9)'; x.beginPath(); x.ellipse(0,H/2+18,10,18,0,0,Math.PI*2); x.fill();
  x.restore();

  // "RENDER" text overlays
  x.font='bold 110px Orbitron';
  x.textAlign='center';
  
  x.shadowColor='#000'; x.shadowBlur=20;
  x.fillStyle='#FFF'; x.fillText('DELIVERY', 600, 150);
  
  x.shadowColor='#f60'; x.shadowBlur=30;
  x.fillStyle='#FFD700'; x.fillText('RUSH', 600, 260);

  x.shadowBlur=0;
  x.font='28px Orbitron';
  x.fillStyle='#0cf'; x.letterSpacing='12px';
  x.fillText('S I M U L A T O R', 600, 320);

  // Export
  const ds = c.toDataURL('image/jpeg', 0.9);
  
  // Set to DOM (Static assets are preferred for platform/SEO)
  // const og = document.getElementById('ogImage');
  // if(og) og.content = ds;
  const mt = document.getElementById('gameThumbnail');
  if(mt) { mt.src = ds; document.getElementById('menuThumbWrap').style.display='block'; }
  // const fv = document.getElementById('favicon');
  // if(fv) fv.href = ds;
  // const ap = document.getElementById('appleIcon');
  // if(ap) ap.href = ds;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §13  GAME CORE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class Game {
  constructor(){
    this.c=document.getElementById('gameCanvas'); this.x=this.c.getContext('2d');
    this.sx=document.getElementById('speedoCanvas').getContext('2d');
    this.mx=document.getElementById('minimapCanvas').getContext('2d');
    
    this.audio=new AudioSys(); this.inp=new Inp(); this.cam=new Cam();
    this.map=new MapSys(); this.fx=new FX(); this.wx=new Wx(); this.del=new Del();
    this.p=new Player(WORLD_W/2, WORLD_H/2); this.ais=[];
    
    this.s='load'; this.cLvl=1; this.scr=0; this.cns=0; this.hi=0; this.bLvl=1; this.tDel=0;
    this.tl=90; this.itl=90; this.tOn=false; this._cc=0;
    
    this._lS(); window.addEventListener('resize',()=>this._r()); this._r();
    this._lt=0; requestAnimationFrame(t=>this._l(t));
    this._boot();
  }
  _r(){ this.c.width=window.innerWidth; this.c.height=window.innerHeight; }
  
  _l(t){ const dt=Math.min((t-this._lt)/1000,0.05); this._lt=t; this._u(dt); this._d(); requestAnimationFrame(T=>this._l(T)); }
  
  _boot(){
    this.map.gen();
    drawThumbnail(); // Gen UI graphic
    let p=0;
    const iv=setInterval(()=>{
      p+=rnd(12,25);
      const b=document.getElementById('loadBar'), t=document.getElementById('loadText');
      if(b) b.style.width=Math.min(p,100)+'%';
      if(t) t.textContent=p<40?'Initializing City Graph...':p<80?'Spawning Traffic...':'Ready!';
      if(p>=100){ clearInterval(iv); setTimeout(()=>this.shM(),400); }
    },100);
  }

  // Screens
  _hAll(){ document.querySelectorAll('.screen').forEach(e=>e.classList.remove('active')); }
  _sh(id){ this._hAll(); const e=document.getElementById(id); if(e)e.classList.add('active'); }
  
  shM(){
    this.s='menu'; this._sh('screen-menu'); document.getElementById('game-hud').classList.add('hidden');
    document.getElementById('mHiScore').textContent=this.hi.toLocaleString();
    document.getElementById('mBestLvl').textContent=this.bLvl;
    document.getElementById('mDeliveries').textContent=this.tDel;
    document.getElementById('btnPlay').onclick=()=>this.shT();
  }
  
  shT(){ this.s='tut'; this._sh('screen-tutorial'); this.tI=0; this._rT(); }
  _rT(){
    const ts=[
      {i:'🎮',t:'Controls',b:'Use <b>W/A/S/D</b> or <b>Arrow Keys</b> to drive.<br>Mobile: Use <b>Virtual Joystick</b>.<br>Hit <b>Space / ⚡</b> for Nitro Boost!'},
      {i:'📦',t:'Deliveries',b:'Follow the <span style="color:#0f8">GREEN</span> marker to pick up packages.<br>Race to the <span style="color:#f60">ORANGE</span> marker to drop off!'},
      {i:'⏱',t:'Time is Money',b:'Deliver fast to get huge TIME BONUSES!<br>If the timer hits zero, it\'s GAME OVER.'},
      {i:'⭐',t:'Upgrades',b:'Earn coins and upgrade your Engine, Handling, and Nitro in the Garage! 25 levels total.'}
    ];
    const d=ts[this.tI];
    document.getElementById('tutSlides').innerHTML=`
      <div class="tut-slide"><span class="tut-slide-icon">${d.i}</span><h3>${d.t}</h3><p>${d.b}</p></div>`;
    document.getElementById('tutDots').innerHTML=ts.map((_,i)=>`<div class="tut-dot${i===this.tI?' active':''}"></div>`).join('');
    document.getElementById('tutPrev').disabled=this.tI===0; document.getElementById('tutNext').disabled=this.tI===ts.length-1;
  }
  tutNext(){if(this.tI<3){this.tI++;this._rT();}}
  tutPrev(){if(this.tI>0){this.tI--;this._rT();}}
  
  showUpgrades(){
    this.s='upg'; this._sh('screen-upgrades');
    const uR=(si,bi,ci,lvl,cs)=>{
      document.getElementById(si).textContent='★'.repeat(lvl)+'☆'.repeat(5-lvl);
      const b=document.getElementById(bi), c=document.getElementById(ci);
      if(lvl>=5){ c.textContent='MAX'; b.disabled=true; } else { c.textContent=`🪙 ${cs[lvl]}`; b.disabled=this.cns<cs[lvl]; }
    };
    document.getElementById('upgCoins').textContent=this.cns.toLocaleString();
    uR('starsSpeed','btnUpgSpeed','costSpeed',this.p.su,[200,400,700,1100,1600]);
    uR('starsHandling','btnUpgHandling','costHandling',this.p.hu,[150,300,550,900,1400]);
    uR('starsNitro','btnUpgNitro','costNitro',this.p.nu,[180,360,620,1000,1500]);
  }
  upgrade(t){
    const m={s:{p:'su',c:[200,400,700,1100,1600]}, h:{p:'hu',c:[150,300,550,900,1400]}, n:{p:'nu',c:[180,360,620,1000,1500]}}[['speed','handling','nitro'].indexOf(t)];
    const ty=t==='speed'?'s':t==='handling'?'h':'n';
    const lv=this.p[m[ty].p]||0, c=m[ty].c[lv];
    if(lv>=5||this.cns<c) return;
    this.cns-=c; this.p[m[ty].p]++; this._sS(); this.showUpgrades(); this.bonus(`${t.toUpperCase()} UPGRADED!★`,'#0cf');
  }

  // State
  startLevel(n){
    n=clamp(n,1,LEVELS.length); const c=LEVELS[n-1]; this.cLvl=n;
    this._sh('screen-loading');
    setTimeout(()=>{
      this._hAll(); document.getElementById('game-hud').classList.remove('hidden'); this.s='play';
      const is=rIsc(); this.p.x=is.x; this.p.y=is.y; this.p.ang=0; this.p.spd=0; this.p.pkg=false; this.p.niC=100; this.p.sm=[];
      this.p.lm=c.spd; this.itl=c.time; this.tl=c.time; this.tOn=true;
      this.ais=[]; for(let i=0;i<c.ai;i++)this.ais.push(new AI(c.spd));
      this.wx.set(c.wx); this.del.start(c);
      this.cam.x=this.p.x-this.c.width/2; this.cam.y=this.p.y-this.c.height/2;
      document.getElementById('hLvl').textContent=n; document.getElementById('hTotal').textContent=c.del;
      const mc=document.getElementById('mobileCtrl'); if(mc){ 'ontouchstart' in window?mc.classList.remove('hidden'):mc.classList.add('hidden'); }
      this.audio.init(); this.audio.res();
    },400);
  }
  
  nextLevel(){ if(this.cLvl<LEVELS.length){this.startLevel(this.cLvl+1);}else{this.shM();} }
  restartLevel(){ this.startLevel(this.cLvl); }
  pause(){ if(this.s!=='play')return; this.s='pause'; this._sh('screen-pause'); }
  resume(){ if(this.s!=='pause')return; this._hAll(); document.getElementById('game-hud').classList.remove('hidden'); this.s='play'; this.audio.res(); }
  
  onDel(pt,cm,tb){
    this.scr+=pt; if(this.scr>this.hi)this.hi=this.scr; this.tDel++; this.cns+=Math.floor(pt/10);
    this.tl=Math.min(this.tl+Math.min(tb/10+30,45), this.itl+45); this._sS();
    this.bonus(`+${pt.toLocaleString()} ${cm>=2?`×${cm.toFixed(1)} Combo`:''}`,'#fd0');
  }
  
  lvlCmpl(){
    this.s='cmpl'; this.tOn=false; if(this.cLvl>this.bLvl)this.bLvl=this.cLvl; this.audio.win();
    const c=LEVELS[this.cLvl-1], tb=Math.floor(this.tl)*60; this.scr+=tb; if(this.scr>this.hi)this.hi=this.scr;
    const st=this.tl>this.itl*0.6?3:this.tl>this.itl*0.25?2:1; this.cns+=Math.floor(tb/10); this._sS();
    document.getElementById('cmplLvl').textContent=`LEVEL ${c.n}`;
    document.getElementById('cmplStars').textContent='⭐'.repeat(st)+'☆'.repeat(3-st);
    document.getElementById('csDeliveries').textContent=`${this.del.dn}/${this.del.tot}`;
    document.getElementById('csTimeBonus').textContent=`+${tb}`; document.getElementById('csCombo').textContent=`×${this.del.cmb.toFixed(1)}`;
    document.getElementById('csScore').textContent=this.scr.toLocaleString(); document.getElementById('csCoins').textContent=`+${Math.floor(tb/10)}`;
    const nb=document.getElementById('btnNext'); if(nb)nb.disabled=this.cLvl>=LEVELS.length;
    setTimeout(()=>this._sh('screen-complete'),800); this.fx.del(this.p.x,this.p.y);
  }
  
  _gO(){
    this.s='go'; this.tOn=false; this._sS();
    document.getElementById('goScore').textContent=this.scr.toLocaleString();
    document.getElementById('goLvl').textContent=this.cLvl; document.getElementById('goDel').textContent=this.tDel;
    setTimeout(()=>this._sh('screen-gameover'),600);
  }
  
  toggleSound(){ const m=this.audio.tog(); document.getElementById('sndIcon').textContent=m?'🔇':'🔊'; }
  bonus(t,c){ const el=document.getElementById('hudBonus'); if(!el)return; el.textContent=t; el.style.color=c||'#fd0'; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); this._bT=1.8; }
  
  _u(dt){
    if(this.s!=='play') return;
    this.inp.upd();
    if(this.tOn){ this.tl-=dt; if(this.tl<=0){this.tl=0;this._gO();return;} }
    
    this.p.update(dt, this.inp, this.wx);
    for(const a of this.ais){
      a.upd(dt);
      if(a.hit(this.p)){
        if(this._cc<=0){ this.p.hit(); a.ang+=Math.PI; a.msp*=0.5; this.audio.col(); this.fx.col(this.p.x,this.p.y); this._cc=1; }
      }
    }
    this._cc=Math.max(0,this._cc-dt);
    this.del.upd(dt, this.p, this);
    
    this.fx.upd(dt);
    if(this.p.drf){ this.fx.drift(this.p.x,this.p.y,this.p.ang); if(!this._wD){this.audio.drift();} }
    this._wD=this.p.drf;
    if(this.p.niOn) this.fx.nitro(this.p.x,this.p.y,this.p.ang);
    
    this.cam.upd(this.p.x,this.p.y,this.c.width,this.c.height,dt);
    this.audio.upd(this.p.spd, this.p.mxS);
    this._uH(dt);
  }
  
  _uH(dt){
    document.getElementById('hTime').textContent=Math.ceil(this.tl);
    const tr=this.tl/this.itl; document.getElementById('hTimeFill').style.width=(tr*100)+'%';
    document.getElementById('hTimeFill').style.background=tr>0.3?'linear-gradient(90deg,#0f8,#fd0)':'linear-gradient(90deg,#f50,#f00)';
    document.getElementById('hTime').classList.toggle('danger',this.tl<15);
    
    document.getElementById('hScore').textContent=this.scr.toLocaleString();
    document.getElementById('hCombo').textContent=this.del.cmb>=2?`×${this.del.cmb.toFixed(1)} COMBO`:'';
    
    const ds=this.del.s;
    const dS=document.getElementById('hDelStatus');
    if(ds==='gotoPickup'){ dS.textContent='FIND PICKUP'; dS.style.color='#0f8'; }
    else if(ds==='goDeliver'){ dS.textContent='DELIVER NOW!'; dS.style.color='#f60'; }
    else dS.textContent='';
    document.getElementById('hDelivered').textContent=this.del.dn; document.getElementById('hTotal').textContent=this.del.tot;
    const dd=this.del.tD(this.p); document.getElementById('hDelDist').textContent=dd>0?`${dd}m`:'';
    
    document.getElementById('hSpdNum').textContent=Math.round(Math.abs(this.p.spd)*0.6);
    drawSpd(this.sx, this.p.spd, this.p.mxS, this.p.niOn);
    
    const hN=document.getElementById('hNitroFill');
    hN.style.width=this.p.niC+'%';
    hN.style.background=this.p.niOn?'linear-gradient(90deg,#0cf,#70f)':'linear-gradient(90deg,#08f,#50c)';
    
    const ar=document.getElementById('hudArrow');
    if(ds==='gotoPickup'||ds==='goDeliver'){
      document.getElementById('hArrowPtr').style.transform=`rotate(${this.del.tA(this.p)*(180/Math.PI)+90}deg)`;
      document.getElementById('hArrowLabel').textContent=ds==='gotoPickup'?'PICKUP':'DROPOFF';
      ar.style.opacity='1';
    } else ar.style.opacity='0';
    
    if(this._bT>0){ this._bT-=dt; if(this._bT<=0)document.getElementById('hudBonus').classList.remove('show'); }
    drawMM(this.mx, this.p, this.ais, this.del);
  }
  
  _d(){
    const cw=this.c.width, ch=this.c.height;
    this.x.fillStyle='#070b16'; this.x.fillRect(0,0,cw,ch);
    if(this.s==='play'||this.s==='pause'||this.s==='cmpl'){
      const cx=this.cam.x, cy=this.cam.y;
      this.x.save(); this.x.translate(-cx,-cy);
      this.map.draw(this.x,cx,cy,cw,ch);
      this.del.draw(this.x);
      for(const a of this.ais) a.draw(this.x);
      this.p.draw(this.x);
      this.fx.draw(this.x);
      this.x.restore();
      
      dSL(this.x, this.p.spd, this.p.mxS, this.p.niOn, cw, ch);
      this.wx.draw(this.x, cw, ch);
      
      this.x.save(); this.x.fillStyle='rgba(255,255,255,0.1)'; this.x.font='bold 12px Orbitron';
      this.x.textAlign='center'; this.x.textBaseline='top'; this.x.fillText((LEVELS[this.cLvl-1]?.name||'').toUpperCase(),cw/2, 85);
      this.x.restore();
      
      if(this.p.drf){ this.x.strokeStyle='rgba(255,100,0,0.2)'; this.x.lineWidth=12; this.x.strokeRect(6,6,cw-12,ch-12); }
      if(this.del.np||this.del.nd){ this.x.fillStyle=this.del.np?'rgba(0,255,120,0.06)':'rgba(255,120,0,0.08)'; this.x.fillRect(0,0,cw,ch); }
    } else {
      const t=Date.now()/1000; this.x.fillStyle='#040812'; this.x.fillRect(0,0,cw,ch);
      this.x.strokeStyle='rgba(255,215,0,0.06)'; this.x.lineWidth=1;
      for(let i=(t*30)%100;i<cw;i+=100){this.x.beginPath();this.x.moveTo(i,0);this.x.lineTo(i,ch);this.x.stroke();}
      for(let i=(t*30)%100;i<ch;i+=100){this.x.beginPath();this.x.moveTo(0,i);this.x.lineTo(cw,i);this.x.stroke();}
    }
  }
  
  _sS(){
    try{ localStorage.setItem('drs_data_v3', JSON.stringify({h:this.hi,b:this.bLvl,t:this.tDel,c:this.cns,su:this.p.su,hu:this.p.hu,nu:this.p.nu})); }catch(e){}
  }
  _lS(){
    try{ const s=JSON.parse(localStorage.getItem('drs_data_v3')||'{}');
      this.hi=s.h||0; this.bLvl=s.b||1; this.tDel=s.t||0; this.cns=s.c||0;
      this.p.su=s.su||0; this.p.hu=s.hu||0; this.p.nu=s.nu||0;
    }catch(e){}
  }
}

window.addEventListener('load',()=>{ window.G=new Game(); });
