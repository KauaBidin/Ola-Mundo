import { drawArena, drawFinisherPose } from './art.js';

const TAU=Math.PI*2;
const ORIGINAL_FIST_HEIGHT={emerzon:280,douglas:269,jose:283,kaua:278};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const ease=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const pixel=value=>Math.round(value/4)*4;
// Indexed randomness is independent of frame rate. No particle list grows over
// time, and the renderer never writes to either combat snapshot.
function random(seed,index) {
  let value=((seed|0)^Math.imul(index+1,0x9e3779b1))>>>0;
  value^=value>>>16;value=Math.imul(value,0x7feb352d);
  value^=value>>>15;value=Math.imul(value,0x846ca68b);
  return ((value^(value>>>16))>>>0)/4294967296;
}
function ring(ctx,x,y,radius,color,opacity,phase=0) {
  ctx.fillStyle=color;ctx.globalAlpha=opacity;
  for(let i=0;i<36;i++) {
    const angle=i/36*TAU+phase;
    ctx.fillRect(pixel(x+Math.cos(angle)*radius),pixel(y+Math.sin(angle)*radius*.7),6,6);
  }
  ctx.globalAlpha=1;
}

/** Render the full 1200x600 magical finisher. age is seconds, 0..1.45.
 * cinematic={attacker:playerSnapshot,target:playerSnapshot,color,seed}.
 * Pure drawing: the caller owns the clock, state and transition back to play.
 */
export function drawFinisher(ctx,cinematic,age,reducedMotion=false) {
  if(!cinematic?.attacker||!cinematic?.target)return;
  const t=clamp(Number.isFinite(age)?age:0,0,1.45),seed=cinematic.seed|0;
  const accent=cinematic.color||'#ba93ff';
  const charge=ease(t/.35),impact=clamp(1-Math.abs(t-.405)/.095,0,1);
  const aftermath=clamp((t-.5)/.95,0,1),release=ease((t-.32)/.12);
  const extension=t<.35?charge*.25:t<.85?.25+release*.75:1-ease((t-.85)/.6)*.2;
  const original=Object.hasOwn(ORIGINAL_FIST_HEIGHT,cinematic.attacker.characterId);
  const fistX=original?450+extension*48:465+extension*64;
  const fistY=ORIGINAL_FIST_HEIGHT[cinematic.attacker.characterId]||294;
  const targetX=810,targetY=321,ground=518;
  const zoom=reducedMotion?1:1+ease(t/.5)*.035;
  const shake=reducedMotion?0:impact*3;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#070711';ctx.fillRect(0,0,1200,600);
  ctx.translate(600+Math.sin(t*91)*shake,300+Math.sin(t*117)*shake*.6);
  ctx.scale(zoom,zoom);ctx.translate(-600,-300);
  drawArena(ctx,1200,600,reducedMotion?0:t);
  ctx.fillStyle='#080713';ctx.globalAlpha=.76;ctx.fillRect(-24,-24,1248,648);ctx.globalAlpha=1;
  // Sparse horizontal mist strips keep the atmosphere in the pixel palette.
  ctx.fillStyle='#6e4a9e';ctx.globalAlpha=.09;
  for(let i=0;i<7;i++)ctx.fillRect(60+i*78,448-i*19,480-i*37,8);
  ctx.globalAlpha=1;
  const glow=ctx.createRadialGradient(fistX,fistY,4,fistX,fistY,220+charge*80);
  glow.addColorStop(0,accent+'65');glow.addColorStop(.35,'#9a68ef28');glow.addColorStop(1,'#59407800');
  ctx.fillStyle=glow;ctx.fillRect(160,50,710,490);
  ctx.fillStyle='#00000077';ctx.beginPath();ctx.ellipse(348,ground+4,144,19,0,0,TAU);ctx.fill();
  ctx.beginPath();ctx.ellipse(targetX,ground+4,122,16,0,0,TAU);ctx.fill();
  // The target keeps its own face, clothes and accessories while kneeling.
  drawFinisherPose(ctx,cinematic.target,targetX,ground,3.25,'kneel',0,-1);
  drawFinisherPose(ctx,cinematic.attacker,348,ground,3.25,'punch',extension,1);
  // Gathering motes spiral into the attacker's hand, with fixed count/lifetime.
  const motes=reducedMotion?8:28;
  for(let i=0;i<motes;i++) {
    const angle=random(seed,i)*TAU+(reducedMotion?0:t*2.4);
    const radius=reducedMotion?52+random(seed,i+30)*35:(1-charge)*100+22+random(seed,i+30)*45;
    ctx.fillStyle=i%3?'#c3a0ff':accent;
    ctx.globalAlpha=(.3+random(seed,i+60)*.6)*(1-aftermath*.85);
    ctx.fillRect(pixel(fistX+Math.cos(angle)*radius),pixel(fistY+Math.sin(angle)*radius),i%4?4:8,4);
  }
  ctx.globalAlpha=1;
  ring(ctx,fistX,fistY,24+charge*27,accent,.35+charge*.4,reducedMotion?0:t*.5);
  ring(ctx,fistX,fistY,14+charge*10,'#e0caff',.65,reducedMotion?0:-t*.7);
  ctx.fillStyle=accent;ctx.globalAlpha=.75;ctx.fillRect(pixel(fistX-10),pixel(fistY-12),24,24);
  ctx.fillStyle='#fff0ff';ctx.fillRect(pixel(fistX-4),pixel(fistY-6),12,12);ctx.globalAlpha=1;
  if(t>=.35) {
    const beamFade=t<.5?1:Math.max(0,1-(t-.5)/.55);
    const endX=fistX+(targetX-29-fistX)*release;
    // Layered, stepped electric arc: luminous core and jagged purple edges.
    for(let layer=0;layer<3;layer++) {
      ctx.fillStyle=layer===0?accent:layer===1?'#c4a1ff':'#fff0ff';
      ctx.globalAlpha=beamFade*(layer===0?.32:layer===1?.65:.95);
      const thickness=layer===0?30:layer===1?14:6;
      for(let j=0;j<18;j++) {
        const x=fistX+(endX-fistX)*j/18;
        const bend=reducedMotion?0:(random(seed+Math.floor(t*12),j+110)-.5)*(layer===2?9:19);
        const y=fistY+(targetY-fistY)*j/18+bend;
        ctx.fillRect(pixel(x),pixel(y-thickness/2),Math.ceil((endX-fistX)/18)+4,thickness);
      }
    }
    ctx.globalAlpha=1;
    // Radial impact fragments disperse once; no persistent list or allocation.
    const burst=clamp((t-.35)/.85,0,1),count=reducedMotion?16:88;
    for(let i=0;i<count;i++) {
      const angle=random(seed,i+200)*TAU;
      const distance=(reducedMotion?45:18+burst*(80+random(seed,i+310)*210));
      const x=targetX-24+Math.cos(angle)*distance;
      const y=targetY+Math.sin(angle)*distance*.72+(reducedMotion?0:burst*burst*90);
      const size=i%7?4:8;
      ctx.fillStyle=i%5===0?'#ffebb5':i%2?accent:'#d9b9ff';
      ctx.globalAlpha=(1-burst)*(.3+random(seed,i+400)*.7);
      ctx.fillRect(pixel(x),pixel(y),size,size);
    }
    ctx.globalAlpha=1;
    ring(ctx,targetX-24,targetY,32+(reducedMotion?0:burst*125),accent,(1-burst)*.7);
    // A brief local starburst, skipped entirely for reduced-motion users.
    if(impact>0&&!reducedMotion) {
      ctx.fillStyle='#e9d6ff';ctx.globalAlpha=impact*.65;
      ctx.fillRect(targetX-64,targetY-8,80,16);ctx.fillRect(targetX-32,targetY-43,16,88);
      ctx.fillRect(targetX-48,targetY-25,48,48);ctx.globalAlpha=1;
    }
  }
  const vignette=ctx.createRadialGradient(600,300,160,600,300,670);
  vignette.addColorStop(0,'#07051000');vignette.addColorStop(1,'#070510bb');
  ctx.fillStyle=vignette;ctx.fillRect(-24,-24,1248,648);
  // Restrained letterboxing leaves the existing HUD copy to the caller.
  ctx.fillStyle='#06050c';ctx.fillRect(-24,-24,1248,62);ctx.fillRect(-24,562,1248,62);
  ctx.fillStyle=accent;ctx.globalAlpha=.4;ctx.fillRect(80,39,1040,2);ctx.fillRect(80,559,1040,2);
  ctx.restore();
}
