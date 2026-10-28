import { drawArena, drawFinisherPose } from './art.js';
import { FINISHER_DURATION } from './engine.js';

export const FINISHER_IMPACT_TIMES=Object.freeze([1.4,2.2,3.0]);
export const FINISHER_IMPACT_AT=FINISHER_IMPACT_TIMES[0];
const TAU=Math.PI*2;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const ease=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const ageFor=age=>clamp(Number.isFinite(age)?age:0,0,FINISHER_DURATION);
const pixel=value=>Math.round(value/4)*4;
let silhouetteCanvas=null,silhouetteContext=null;
function getSilhouetteContext() {
  if(silhouetteContext)return silhouetteContext;
  if(typeof OffscreenCanvas!=='undefined')silhouetteCanvas=new OffscreenCanvas(1200,600);
  else if(typeof document!=='undefined') {
    silhouetteCanvas=document.createElement('canvas');silhouetteCanvas.width=1200;silhouetteCanvas.height=600;
  }
  silhouetteContext=silhouetteCanvas?.getContext('2d')||null;
  return silhouetteContext;
}

export function getFinisherStage(age) {
  const t=ageFor(age);
  return t<1.1?'grab':t<3.5?'blackout':t<4.3?'silhouette':'victory';
}

// Fixed indexed randomness: no particle objects, accumulated lifetimes or timers.
function random(seed,index) {
  let value=((seed|0)^Math.imul(index+1,0x9e3779b1))>>>0;
  value^=value>>>16;value=Math.imul(value,0x7feb352d);
  value^=value>>>15;value=Math.imul(value,0x846ca68b);
  return ((value^(value>>>16))>>>0)/4294967296;
}

/** Full 1200x600 arcade finish. Pure drawing; the caller owns the engine clock.
 * cinematic={attacker:playerSnapshot,target:playerSnapshot,color,seed}.
 * The blackout conceals unspecified arcade impacts. The later silhouettes and
 * victory scene show both bodies intact; geometric sparks have no anatomy.
 */
export function drawFinisher(ctx,cinematic,age,reducedMotion=false) {
  if(!cinematic?.attacker||!cinematic?.target)return;
  const t=ageFor(age),stage=getFinisherStage(t),seed=cinematic.seed|0;
  let impact=0;
  for(const beat of FINISHER_IMPACT_TIMES)impact=Math.max(impact,clamp(1-Math.abs(t-beat)/.14,0,1));
  const approach=reducedMotion?1:ease(t/.78);
  const celebration=reducedMotion?1:ease((t-4.3)/.55);
  const attackerX=stage==='victory'?565-celebration*145:335+approach*230;
  const targetX=stage==='victory'?820:790,ground=518;
  const zoom=reducedMotion?1:1+ease(t/1.1)*.045;
  const shake=reducedMotion?0:impact*5;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
  ctx.fillStyle='#000000';ctx.fillRect(0,0,1200,600);
  ctx.translate(600+Math.sin(t*91)*shake,300+Math.sin(t*117)*shake*.5);
  ctx.scale(zoom,zoom);ctx.translate(-600,-300);
  if(stage==='blackout') {
    // The central scene is completely black. Only a restrained dark-red border
    // and a few abstract squares acknowledge the caller's synthetic arcade thud.
    const opacity=reducedMotion?.35:.25+impact*.5;
    ctx.fillStyle='#4e1425';ctx.globalAlpha=opacity;
    ctx.fillRect(72,42,1056,3);ctx.fillRect(72,555,1056,3);
    ctx.fillRect(72,42,3,48);ctx.fillRect(1125,510,3,48);
    const count=reducedMotion?6:14;
    for(let i=0;i<count;i++) {
      const angle=random(seed,i+221)*TAU;
      const radius=70+random(seed,i+288)*115+(reducedMotion?0:impact*18);
      ctx.fillStyle=i%4?'#59182b':'#7d283a';
      ctx.globalAlpha=(reducedMotion?.18:.1+impact*.35)*(.4+random(seed,i+341)*.6);
      const size=i%5?4:8;
      ctx.fillRect(pixel(640+Math.cos(angle)*radius),pixel(330+Math.sin(angle)*radius*.7),size,size);
    }
    ctx.restore();return;
  }
  drawArena(ctx,1200,600,reducedMotion?0:t);
  ctx.fillStyle='#10060d';ctx.globalAlpha=.81;ctx.fillRect(-32,-32,1264,664);ctx.globalAlpha=1;
  const backdrop=ctx.createRadialGradient(680,300,30,680,300,520);
  backdrop.addColorStop(0,stage==='silhouette'?'#b8233f99':'#641d2948');
  backdrop.addColorStop(.6,'#48132125');backdrop.addColorStop(1,'#13080e00');
  ctx.fillStyle=backdrop;ctx.fillRect(0,40,1200,520);
  ctx.fillStyle='#dd5360';ctx.globalAlpha=.07+ease(t/1.1)*.12;
  for(let i=0;i<5;i++)ctx.fillRect(90+i*50,470-i*18,840-i*100,4);
  ctx.globalAlpha=1;ctx.fillStyle='#00000077';
  ctx.beginPath();ctx.ellipse(attackerX,ground+4,130,17,0,0,TAU);ctx.fill();
  ctx.beginPath();ctx.ellipse(targetX,ground+4,stage==='victory'?180:110,16,0,0,TAU);ctx.fill();
  if(stage==='victory') {
    const fall=reducedMotion?1:ease((t-4.3)/.5);
    drawFinisherPose(ctx,cinematic.target,targetX,ground,3,'fall',fall,-1);
    drawFinisherPose(ctx,cinematic.attacker,attackerX,ground,3,'victory',celebration,1);
  } else {
    // Composite posed bodies once. Filtering each pixel separately is wasteful.
    const layer=stage==='silhouette'?getSilhouetteContext():null;
    const target=layer||ctx;
    target.save();
    if(layer) {
      target.setTransform(1,0,0,1,0,0);target.clearRect(0,0,1200,600);
      target.globalCompositeOperation='source-over';target.globalAlpha=1;
    } else if(stage==='silhouette')target.filter='brightness(0)';
    drawFinisherPose(target,cinematic.target,targetX,ground,3,'grabbed',0,-1);
    drawFinisherPose(target,cinematic.attacker,attackerX,ground,3,'grab',approach,1);
    if(layer) {
      target.globalCompositeOperation='source-in';target.fillStyle='#030307';target.fillRect(0,0,1200,600);
    }
    target.restore();
    if(layer)ctx.drawImage(silhouetteCanvas,0,0);
  }
  if(t>=3.5) {
    const burst=clamp((t-3.5)/1.65,0,1),count=reducedMotion?12:64;
    // Abstract squares disperse in the empty space between the fighters.
    for(let i=0;i<count;i++) {
      const angle=random(seed,i+11)*TAU;
      const radius=reducedMotion?60+random(seed,i+92)*80:24+burst*(65+random(seed,i+92)*190);
      const x=687+Math.cos(angle)*radius,y=355+Math.sin(angle)*radius*.8;
      ctx.fillStyle=i%5===0?'#e8b78b':i%2?'#e95768':'#a5314d';
      ctx.globalAlpha=(1-burst)*(.3+random(seed,i+164)*.6);
      const size=i%7?4:8;ctx.fillRect(pixel(x),pixel(y),size,size);
    }
    ctx.globalAlpha=1;
  }
  const vignette=ctx.createRadialGradient(600,300,190,600,300,660);
  vignette.addColorStop(0,'#09050a00');vignette.addColorStop(1,'#09050ac7');
  ctx.fillStyle=vignette;ctx.fillRect(-32,-32,1264,664);
  ctx.fillStyle='#08050a';ctx.fillRect(-32,-32,1264,70);ctx.fillRect(-32,562,1264,70);
  ctx.fillStyle='#c65165';ctx.globalAlpha=.45;ctx.fillRect(80,39,1040,2);ctx.fillRect(80,559,1040,2);
  ctx.restore();
}
