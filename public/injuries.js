// Non-graphic, deterministic wear for the fighter's local 110px body space.
// Recomputed from current HP: healing fades stages and respawning clears them.
export function getInjuryStage(hp) {
  const health=Number.isFinite(hp)?Math.max(0,Math.min(100,hp)):100;
  return health<=20?3:health<=45?2:health<=75?1:0;
}

export function drawInjuries(ctx, player, {pose='guard',progress=0}={}) {
  const stage=getInjuryStage(player?.hp);
  if(!stage)return;
  const amount=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
  const headShift=pose==='flying'?-12:pose==='punch'?amount*3:0;
  const torsoShift=pose==='flying'?-5:0;
  const code=Array.from(String(player?.characterId||'')).reduce((sum,c)=>sum+c.charCodeAt(0),0);
  const side=code%2?1:-1;
  const cheekX=3+side*7+headShift;
  ctx.save();
  const originalAlpha=ctx.globalAlpha;
  const pixel=(x,y,w,h,color,opacity=1)=>{
    ctx.globalAlpha=originalAlpha*opacity;
    ctx.fillStyle=color;
    ctx.fillRect(Math.round(x),Math.round(y),w,h);
  };

  // Fine cheek scratches and dusty fabric, leaving the eyes and badge clear.
  pixel(cheekX-2,-86,5,2,'#aa5d56',.32);
  pixel(cheekX-1,-86,4,1,'#c95f58',.76);
  pixel(cheekX,-84,3,1,'#b94d4b',.65);
  pixel(-18+torsoShift,-51,6,3,'#494048',.26);
  pixel(-15+torsoShift,-48,5,2,'#645a5d',.28);
  pixel(12+torsoShift,-39,5,2,'#3c323b',.24);

  if(stage>=2) {
    // A soft block-shaped cheek bruise and superficial scuffs on the forearm.
    pixel(cheekX-2,-89,6,4,'#76506c',.38);
    pixel(cheekX-1,-88,5,3,'#70475f',.47);
    pixel(cheekX,-87,3,2,'#8e555d',.4);
    pixel(3-side*6+headShift,-85,3,2,'#a66a6d',.35);
    pixel(-24+torsoShift,-61,5,2,'#a95555',.57);
    pixel(-23+torsoShift,-59,4,1,'#c36e62',.7);
    pixel(14+torsoShift,-49,5,3,'#4a3540',.37);
    pixel(17+torsoShift,-46,3,2,'#5f4652',.34);
    pixel(-13,-15,5,2,'#756064',.38);
  }
  if(stage>=3) {
    // Small eyebrow cut and a few pixels of blood; no exposed anatomy.
    pixel(8+headShift,-96,5,2,'#783b46',.62);
    pixel(9+headShift,-96,4,1,'#bd2d40',.96);
    pixel(11+headShift,-95,2,3,'#a82137',.85);
    pixel(12+headShift,-92,1,2,'#c33e48',.8);
    pixel(cheekX-3,-88,7,4,'#603d5c',.32);
    pixel(cheekX-1,-85,4,2,'#a14151',.58);
    pixel(-25+torsoShift,-56,5,1,'#b23743',.83);
    pixel(-23+torsoShift,-55,3,2,'#b6464b',.62);
    pixel(21+torsoShift,-63,4,1,'#b64a4d',.8);
    pixel(23+torsoShift,-62,2,2,'#a8424b',.58);
    pixel(-19+torsoShift,-43,8,4,'#4e3440',.43);
    pixel(-16+torsoShift,-40,7,2,'#71424c',.37);
    pixel(12+torsoShift,-35,6,2,'#5f3c48',.4);
    pixel(11,-9,6,2,'#80656b',.48);
    pixel(-12,-22,3,2,'#866871',.37);
  }
  ctx.restore();
}
