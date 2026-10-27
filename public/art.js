import { PUNCH_DURATION, SPECIAL_DURATION } from './engine.js';
import { drawInjuries, getInjuryStage } from './injuries.js';

// Photo-inspired pixel art, shared by the selection screen and the arena.
// Crops and individual artwork are reused by SVG/Canvas.
const SHEETS = {
  emerzon: { src:'/assets/emerzon-corinthians.png', width:1024, height:1536, feet:1465 },
  douglas: { src:'/assets/douglas-revolver.png', width:1136, height:1385, feet:1339 },
  jose: { src:'/assets/jose-coffee.png', width:1024, height:1536, feet:1488 },
  kaua: { src:'/assets/kaua-saopaulo.png', width:1046, height:1504, feet:1450 },
};
// Register each sprite at its soles instead of its transparent bottom margin.
const CROPS = Object.fromEntries(Object.entries(SHEETS).map(([id,sheet]) =>
  [id, { sheet:id, x:0, y:0, width:sheet.width, height:sheet.feet }]));
const cropFor = id => CROPS[id]||CROPS.emerzon;
for (const sheet of Object.values(SHEETS)) {
  sheet.image = typeof Image === 'undefined' ? null : new Image();
  if (sheet.image) sheet.image.src = sheet.src;
}
const kickSheet = typeof Image === 'undefined' ? null : new Image();
if (kickSheet) kickSheet.src = '/assets/flying-kicks.png';
const KICK_CROPS = {
  emerzon:{x:4,y:4}, douglas:{x:772,y:4},
  jose:{x:4,y:516}, kaua:{x:772,y:516},
};
const punchSheet = typeof Image === 'undefined' ? null : new Image();
if (punchSheet) punchSheet.src = '/assets/punch-frames.png';
const PUNCH_ROWS = {emerzon:0,douglas:1,jose:2,kaua:3};
// Atlas cells are 362px square. Register each row at its soles so changing
// hands never makes a fighter float or change size between animation frames.
const PUNCH_FEET = [356,361,355,356];

export function getPunchFrame(progress) {
  const p=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
  return p<1/6-1e-6?0:p<1/3-1e-6?1:p<7/12-1e-6?2:p<19/24-1e-6?1:0;
}

let woundCanvas=null, woundContext=null;
function getWoundContext() {
  if(woundContext)return woundContext;
  if(typeof OffscreenCanvas!=='undefined')woundCanvas=new OffscreenCanvas(384,256);
  else if(typeof document!=='undefined'){
    woundCanvas=document.createElement('canvas');woundCanvas.width=384;woundCanvas.height=256;
  }
  woundContext=woundCanvas?.getContext('2d')||null;
  return woundContext;
}

// Lightweight animated fallback while the shared image is loading.
const LOOKS = {
  emerzon: { skin:'#d1a185', shade:'#a8755d', hair:'#302820', top:'#e9e9e3', light:'#ffffff', dark:'#26282d', pants:'#292f38', accent:'#b6f269' },
  douglas: { skin:'#cda080', shade:'#a87660', hair:'#292626', top:'#cda080', light:'#e1b497', dark:'#a87660', pants:'#30323c', accent:'#bc91ff' },
  jose: { skin:'#bc8c70', shade:'#93664e', hair:'#2d2523', top:'#254d43', light:'#38695c', dark:'#19382f', pants:'#2b313d', accent:'#69cfff' },
  kaua: { skin:'#d7ab8d', shade:'#ae7d65', hair:'#272321', top:'#ecece7', light:'#ffffff', dark:'#c4c8c8', pants:'#30343d', accent:'#ffb66f' },
};

function sprite(id, pose='idle', frame=0, extension=1) {
  const c=LOOKS[id]||LOOKS.emerzon, r=[];
  const rect=(x,y,w,h,color)=>r.push([x,y,w,h,color]);
  const walking=pose==='walk', airborne=pose==='jump', hit=pose==='hit';
  const stride=walking?Math.round(Math.sin(frame*12))*5:airborne?5:0;
  const punch=pose==='attack'||pose==='special', block=pose==='block';
  // Shared body silhouette and raised guard; clothing details follow each photo.
  rect(15-stride,102,18,7,'#13131d');rect(36+stride,102,18,7,'#13131d');
  rect(17-stride,106,16,3,'#62616b');rect(37+stride,106,17,3,'#62616b');
  rect(19-stride,75,12,28,c.pants);rect(36+stride,75,13,28,c.pants);
  rect(21-stride,78,4,22,'#ffffff0d');rect(39+stride,79,3,22,'#ffffff0c');
  rect(21,71,28,10,c.pants);rect(21,74,28,3,'#1c202a');rect(32,74,5,3,'#a3a0aa');
  rect(19,42,31,31,c.top);rect(16,47,6,22,c.dark);rect(23,43,5,26,c.light);
  rect(19,68,31,7,c.dark);rect(27,43,17,5,c.light);rect(30,36,13,12,c.skin);rect(30,37,13,5,c.shade);
  if(id==='douglas') {
    // Shirtless, broad chest and round belly, matching the updated artwork.
    rect(17,43,36,11,c.skin);rect(13,53,44,18,c.skin);rect(17,70,37,7,c.skin);
    rect(15,55,4,14,c.shade);rect(52,55,5,14,c.shade);rect(20,49,5,15,c.light);
    rect(25,56,4,2,c.shade);rect(44,56,4,2,c.shade);rect(27,60,19,2,'#b9866b');
    rect(34,68,3,3,c.shade);rect(23,75,27,2,c.shade);rect(22,78,28,3,c.pants);
  }
  if(id==='emerzon') {
    // Corinthians-inspired white jersey, black collar and a tiny club crest.
    rect(22,47,25,21,c.top);rect(27,42,19,6,c.dark);rect(29,42,15,4,c.skin);rect(31,46,11,2,c.dark);
    rect(24,50,3,12,c.light);rect(42,65,5,2,'#c8cbcb');
    rect(38,52,8,9,'#202329');rect(40,51,4,11,'#202329');rect(39,54,6,5,'#f9f7ee');
    rect(41,52,2,9,'#b02b3c');rect(38,56,8,1,'#b02b3c');rect(40,62,4,1,'#202329');
  }
  if(id==='jose') {
    // Dark-green polo, white collar and a small white pocket detail.
    rect(27,43,7,5,'#e4e6de');rect(39,43,7,5,'#e4e6de');rect(30,47,4,3,'#e4e6de');rect(38,47,4,3,'#e4e6de');
    rect(34,45,5,10,c.dark);rect(36,48,1,1,'#e3e5dc');rect(36,52,1,1,'#e3e5dc');
    rect(39,54,8,6,'#dce3db');rect(40,56,6,4,c.top);
  }
  if(id==='kaua') {
    // São Paulo-inspired white jersey with horizontal red and black bands.
    rect(22,47,25,21,c.top);rect(27,42,19,6,'#22252a');rect(29,42,15,4,c.skin);rect(31,46,11,2,'#22252a');
    rect(19,53,31,5,'#c53340');rect(19,59,31,5,'#20242b');
    rect(31,51,12,9,'#ffffff');rect(33,60,8,2,'#ffffff');rect(35,62,4,2,'#ffffff');
    rect(32,52,10,3,'#20242b');rect(33,56,4,4,'#c53340');rect(38,56,3,4,'#20242b');
    rect(35,60,4,2,'#20242b');rect(34,53,1,1,'#ffffff');rect(37,53,1,1,'#ffffff');rect(40,53,1,1,'#ffffff');
  }
  // Left arm, bent into a guard.
  rect(10,46,10,19,c.top);rect(7,61,12,8,c.dark);rect(6,53,8,12,c.skin);rect(4,48,12,10,c.skin);rect(4,48,12,3,c.shade);rect(5,49,10,3,c.skin);
  if(punch) {
    const reach=extension*27, handX=50+reach, handY=38+extension*5;
    rect(47,46,10+extension*8,11,c.top);rect(53,47,7+extension*17,9,c.skin);
    rect(handX,handY,14,15,c.skin);rect(handX,handY+11,13,4,c.shade);rect(handX+2,handY+1,10,3,'#ffffff20');
  }
  else if(block) {rect(47,43,10,20,c.top);rect(49,29,9,22,c.skin);rect(46,26,14,12,c.skin);rect(46,26,14,3,c.shade);}
  else {rect(46,47,11,18,c.top);rect(51,52,10,14,c.dark);rect(53,43,8,15,c.skin);rect(50,38,14,12,c.skin);rect(50,38,14,3,c.shade);rect(52,39,10,2,'#ffffff1a');}
  if(id==='emerzon') {
    rect(10,46,10,3,'#202329');
    if(punch)rect(57,46,6,11,'#202329');else if(block)rect(47,43,10,3,'#202329');else rect(46,47,11,3,'#202329');
  }
  // Head, ears and pixel highlights.
  rect(22,13,27,23,c.skin);rect(25,31,22,8,c.skin);rect(24,35,17,5,c.shade);rect(19,21,5,10,c.shade);rect(20,22,5,7,c.skin);
  rect(47,24,5,7,c.skin);rect(25,14,5,18,'#ffffff12');rect(44,16,5,15,c.shade);
  if(id==='douglas') {
    // A broad, curly hair silhouette with individual stepped curls.
    rect(20,8,30,9,c.hair);rect(18,12,8,14,c.hair);rect(45,12,7,13,c.hair);
    rect(22,4,7,9,c.hair);rect(29,3,7,10,c.hair);rect(37,4,8,10,c.hair);rect(44,7,6,8,c.hair);
    rect(23,6,4,3,'#47403a');rect(32,5,3,3,'#47403a');rect(40,7,4,3,'#47403a');rect(19,15,3,3,'#47403a');rect(47,15,3,3,'#47403a');
    rect(23,16,4,5,c.hair);rect(43,16,4,4,c.hair);
  } else if(id==='jose') {
    // Short, high, slightly wavy hair and no glasses.
    rect(21,8,27,9,c.hair);rect(20,13,6,12,c.hair);rect(45,13,5,8,c.hair);
    rect(24,4,8,8,c.hair);rect(31,3,9,8,c.hair);rect(40,6,7,8,c.hair);
    rect(26,6,5,3,'#4b3b32');rect(32,5,6,3,'#4b3b32');rect(39,9,6,3,'#4b3b32');rect(23,15,5,4,c.hair);
  } else if(id==='kaua') {
    // Tousled volume and uneven fringe; the cheeks stay clean-shaven.
    rect(20,8,30,11,c.hair);rect(19,14,6,12,c.hair);rect(46,13,5,10,c.hair);
    rect(22,5,7,8,c.hair);rect(29,3,10,10,c.hair);rect(39,5,8,9,c.hair);rect(46,8,6,9,c.hair);
    rect(25,8,7,3,'#43372e');rect(35,6,6,3,'#43372e');rect(43,10,4,3,'#43372e');
    rect(25,16,5,7,c.hair);rect(31,15,6,5,c.hair);rect(38,16,5,6,c.hair);rect(44,17,5,3,c.hair);
  } else {
    // Close-cut sides with a short side-swept fringe, no headset.
    rect(21,8,28,9,c.hair);rect(20,14,6,11,c.hair);rect(46,14,4,8,c.hair);rect(24,6,21,7,c.hair);
    rect(25,8,18,3,'#504036');rect(24,16,13,4,c.hair);rect(24,19,6,3,c.hair);rect(36,15,8,3,c.hair);
  }
  rect(31,23,4,3,'#28232c');rect(43,23,4,3,'#28232c');rect(31,22,5,1,c.hair);rect(42,22,5,1,c.hair);
  rect(37,29,5,2,c.shade);rect(36,33,7,2,'#6d4841');
  if(id==='emerzon') {
    // Dark moustache and jaw beard, tapering into a distinctive long goatee.
    rect(24,29,4,7,c.hair);rect(45,29,4,7,c.hair);rect(27,34,19,5,c.hair);
    rect(32,30,13,3,c.hair);rect(34,33,9,2,'#855c49');rect(31,37,13,6,c.hair);rect(33,43,9,4,c.hair);rect(35,47,5,3,c.hair);
    rect(33,38,2,5,'#514033');rect(37,44,2,3,'#514033');
  } else if(id==='douglas') {
    // Black rectangular glasses and a close jawline beard.
    rect(24,22,12,8,'#171c23');rect(38,22,12,8,'#171c23');rect(35,24,4,2,'#171c23');rect(20,23,5,2,'#171c23');
    rect(26,24,8,4,'#586a72');rect(40,24,8,4,'#586a72');rect(28,25,3,1,'#9badb0');rect(42,25,3,1,'#9badb0');
    rect(24,30,3,5,'#44352e');rect(46,30,3,5,'#44352e');rect(27,35,19,3,'#44352e');rect(31,38,12,2,'#44352e');
    rect(33,31,11,1,'#554036');rect(36,33,7,2,'#795443');
  } else if(id==='jose') {
    // Sparse stubble, leaving the face lighter than the two bearded fighters.
    rect(27,33,2,2,'#8b6853');rect(44,33,2,2,'#8b6853');rect(31,36,2,1,'#8b6853');rect(36,37,5,1,'#8b6853');rect(42,35,2,1,'#8b6853');
  }
  if(id==='douglas') {
    // A small upright .38-style revolver in the guard hand, purely cosmetic.
    rect(8,27,4,15,'#30323a');rect(7,26,6,3,'#1b1d24');rect(9,30,1,10,'#7c8087');
    rect(5,40,10,7,'#292c34');rect(6,41,4,4,'#626670');rect(11,42,3,3,'#171a20');
    rect(10,46,6,3,'#20232a');rect(11,48,4,7,'#76513a');rect(11,49,1,4,'#aa7a51');
    rect(6,48,5,5,c.skin);rect(12,53,3,3,c.skin);
  } else if(id==='jose') {
    // The cup follows the raised hand; during a punch it travels with the fist.
    const cupX=punch?4:block?46:43, cupY=punch?40:block?21:30;
    rect(cupX,cupY,14,12,'#f1f0e9');rect(cupX+1,cupY+3,3,7,'#ffffff');rect(cupX+10,cupY+3,3,8,'#c3cdca');
    rect(cupX+13,cupY+3,5,8,'#f1f0e9');rect(cupX+14,cupY+5,3,4,c.top);
    rect(cupX,cupY,14,3,'#d8dcd5');rect(cupX+2,cupY+1,10,2,'#61402b');rect(cupX+3,cupY+1,5,1,'#99724d');
    rect(cupX+4,cupY-7,2,4,'#e2ecea88');rect(cupX+6,cupY-11-(Math.floor(frame*3)%2),2,3,'#e2ecea66');
    rect(cupX+10,cupY-6,1,3,'#e2ecea66');
  }
  if(hit) rect(25,19,25,15,'#ff8c8c22');
  return r;
}

export function portraitSVG(character, small=false) {
  const {id,color}=character;
  const crop=cropFor(id), sheet=SHEETS[crop.sheet];
  const width=crop.width/crop.height*216;
  const fighter=`<svg x="${146-width/2}" y="8" width="${width}" height="216" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}" overflow="hidden" preserveAspectRatio="none"><image href="${sheet.src}" width="${sheet.width}" height="${sheet.height}"/></svg>`;
  const racks=[15,80,180,245].map((x,i)=>`<g opacity="${i%2?.28:.45}"><rect x="${x}" y="25" width="43" height="160" fill="#16141e" stroke="${color}" stroke-opacity=".22"/>${[38,58,78,98,118,138,158].map((y,j)=>`<rect x="${x+5}" y="${y}" width="33" height="14" fill="#292534"/><rect x="${x+8}" y="${y+4}" width="2" height="3" fill="${color}" opacity="${j%3?.45:1}"/><path d="M${x+15} ${y+6}h16" stroke="#ffffff" stroke-opacity=".1"/>`).join('')}</g>`).join('');
  return `<svg class="portrait" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 240" role="img" aria-label="Ilustração pixel art de ${character.name}"><defs><radialGradient id="glow-${id}${small?'s':''}"><stop stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="280" height="240" fill="#211e29"/><rect width="280" height="240" fill="url(#glow-${id}${small?'s':''})"/>${racks}<path d="M0 195h280M140 195 0 240m140-45 140 45M140 195l-65 45m65-45 65 45M0 215h280M0 237h280" stroke="${color}" stroke-opacity=".12"/><path d="M0 0h90L0 190z" fill="${color}" opacity=".025"/><text x="20" y="187" fill="${color}" opacity=".2" font-family="monospace" font-size="7">${id==='kaua'?'&gt; auto.combo()':id==='jose'?'&gt; weakness.found':id==='douglas'?'&gt; access: admin':'&gt; system.ready'}</text><ellipse cx="146" cy="222" rx="67" ry="9" fill="#08080e" opacity=".7"/><ellipse cx="146" cy="224" rx="64" ry="7" fill="none" stroke="${color}" stroke-opacity=".4"/>${fighter}<path d="M16 211v12h12m224-12v12h-12" fill="none" stroke="${color}" opacity=".35"/></svg>`;
}

export function drawFighter(ctx, player, x, ground, scale, time) {
  const accent=LOOKS[player.characterId]?.accent||'#fff';
  const crop=cropFor(player.characterId), fighterSheet=SHEETS[crop.sheet].image;
  const ready=!!(fighterSheet?.complete && fighterSheet.naturalWidth);
  const punchReady=!!(punchSheet?.complete && punchSheet.naturalWidth);
  const width=punchReady?94:ready?crop.width/crop.height*110:66;
  const buffs=player.buffs||{};
  const walking=player.action==='walk', dashing=player.action==='dash'||player.dashTimer>0;
  const knockedOut=player.hp<=0||player.action==='knockout'||player.respawnTimer>0;
  const down=knockedOut||player.action==='down'||player.downTimer>0;
  const attacking=!down&&(player.action==='attack'||player.action==='special');
  const flying=attacking&&player.action==='special';
  const kickReady=flying&&kickSheet?.complete&&kickSheet.naturalWidth;
  const duration=flying?SPECIAL_DURATION:PUNCH_DURATION;
  const progress=attacking?Math.max(0,Math.min(1,1-player.attackTimer/duration)):0;
  const punchFrame=attacking&&!flying?getPunchFrame(progress):0;
  const extension=punchFrame/2;
  const impact=attacking?Math.sin(Math.PI*progress):0;
  const bob=down?0:walking?-Math.abs(Math.sin(time*13))*1.8:player.action==='idle'?Math.sin(time*3)*.65:0;
  const fallback=ready||punchReady?null:sprite(player.characterId,player.action,time,extension);
  const rawBody=(target)=>{
    if(kickReady){
      const frame=KICK_CROPS[player.characterId]||KICK_CROPS.emerzon;
      target.drawImage(kickSheet,frame.x,frame.y,760,504,-45,-105,151,100);
    }
    else if(punchReady){
      const row=PUNCH_ROWS[player.characterId]??0, feet=PUNCH_FEET[row], cellWidth=362/feet*110;
      target.drawImage(punchSheet,punchFrame*362,row*362,362,feet,-cellWidth/2,-110,cellWidth,110);
      // Keep José's coffee in the guard hand while his free hand throws a punch.
      if(player.characterId==='jose'&&punchFrame>0){
        target.fillStyle='#eef1e9';target.fillRect(-17,-76,8,8);target.fillRect(-20,-74,3,4);
        target.fillStyle='#aabeb5';target.fillRect(-11,-74,2,5);
        target.fillStyle='#67432c';target.fillRect(-16,-76,6,2);
      }
    }
    else if(ready){const idleWidth=crop.width/crop.height*110;target.drawImage(fighterSheet,crop.x,crop.y,crop.width,crop.height,-idleWidth/2,-110,idleWidth,110);}
    else {
      target.save();target.translate(-34,-110);
      for(const [rx,ry,w,h,color] of fallback){target.fillStyle=color;target.fillRect(rx,ry,w,h);}
      target.restore();
    }
  };
  const injuryPose=flying?'flying':attacking?'punch':'guard';
  const wounds=getInjuryStage(player.hp)>0?getWoundContext():null;
  if(wounds){
    wounds.setTransform(1,0,0,1,0,0);wounds.clearRect(0,0,384,256);
    wounds.save();wounds.scale(2,2);wounds.translate(64,120);
    rawBody(wounds);
    // Composite only onto this isolated sprite, so marks cannot float outside
    // the body or attach to the arena behind it.
    wounds.globalCompositeOperation='source-atop';
    drawInjuries(wounds,player,{pose:injuryPose,progress});wounds.restore();
  }
  const body=()=>{
    if(wounds)ctx.drawImage(woundCanvas,-64,-120,192,128);
    else rawBody(ctx);
  };

  ctx.save();ctx.translate(x,ground-(player.y||0)*.62);ctx.scale(player.facing*scale,scale);
  // Colored trails and auras stay behind the fighter instead of obscuring the outfit.
  if(!down && (flying || dashing || (buffs.speed>0 && walking))) {
    const trails=flying||dashing?3:2;
    for(let n=trails;n>=1;n--){ctx.save();ctx.translate(-n*(flying?18:dashing?11:7),bob);ctx.globalAlpha=.13/n;body();ctx.restore();}
    ctx.strokeStyle=dashing?accent:'#ffe078';ctx.lineWidth=1.5;ctx.globalAlpha=.7;
    for(let n=0;n<3;n++){ctx.beginPath();ctx.moveTo(-width/2-10-n*3,-35-n*22);ctx.lineTo(-width/2-25-n*7,-35-n*22);ctx.stroke();}
    ctx.globalAlpha=1;
  }
  if(buffs.rage>0 && !knockedOut) {
    const glow=ctx.createRadialGradient(0,-54,12,0,-54,68);
    glow.addColorStop(0,'#ff853715');glow.addColorStop(.6,'#ff853725');glow.addColorStop(1,'#ff853700');
    ctx.fillStyle=glow;ctx.fillRect(-68,-122,136,136);
    for(let n=0;n<5;n++){const lift=(time*28+n*13)%45;ctx.fillStyle=n%2?'#ffb15370':'#ff6b3a80';ctx.fillRect((n-2)*13,-4-lift,3,5);}
  }
  if(buffs.shield>0 && !knockedOut) {
    ctx.fillStyle='#72d4ff0d';ctx.beginPath();ctx.ellipse(0,-55,width/2+8,62,0,0,Math.PI*2);ctx.fill();
  }
  if(buffs.jump>0 && !down) {
    ctx.strokeStyle='#f3a2ee88';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,-2,25,5,0,0,Math.PI*2);ctx.stroke();
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*23-3,-9);ctx.lineTo(side*23,-13);ctx.lineTo(side*23+3,-9);ctx.stroke();}
  }

  ctx.save();ctx.translate(impact*9,bob);
  if(down) {
    let angle=Math.PI/2;
    if(!knockedOut) {
      const remaining=Math.max(0,player.downTimer||0);
      const progress=1-Math.min(1,remaining/1.15);
      angle=Math.min(Math.PI/2,.4+progress*1.6);
      if((player.y||0)<=0 && remaining<.8)angle=Math.PI/2;
      if((player.y||0)<=0 && remaining>0 && remaining<.22)angle=remaining/.22*Math.PI/2;
    }
    // Rotate around the body center and keep the resting body's lower edge on the floor.
    const sine=Math.sin(angle), centerY=-55*Math.cos(angle)-width/2*sine;
    ctx.translate(0,centerY);ctx.rotate(-angle);ctx.translate(0,55);
    if(knockedOut)ctx.globalAlpha=.66+Math.sin(time*4)*.12;
  } else {
    if(player.action==='hit'){ctx.rotate(.08);ctx.globalAlpha=.76;}
    else if(dashing)ctx.rotate(-.16);
    else if(player.action==='jump')ctx.rotate(-.045);
    else if(walking)ctx.rotate(Math.sin(time*13)*.018);
    else if(flying&&!kickReady)ctx.rotate(-.45-impact*.1);
    else if(attacking&&!flying)ctx.rotate(-impact*.055);
    if(player.invulnerableTimer>0)ctx.globalAlpha*=.7+Math.sin(time*6)*.13;
    if(player.action==='block')ctx.scale(1,.93);
    else if(walking)ctx.scale(1+Math.sin(time*13)*.008,1-Math.abs(Math.sin(time*13))*.008);
    else if(!flying)ctx.scale(1+impact*.04,1-impact*.025);
  }
  body();ctx.restore();

  if(!down && player.action==='block') {
    ctx.strokeStyle=accent+'bb';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(width/2-4,-61,17,40,0,-1.4,1.4);ctx.stroke();
  }
  if(buffs.shield>0 && !knockedOut) {
    ctx.strokeStyle='#82d9ffbb';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(0,-55,width/2+8,62,0,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#d5f3ff77';ctx.beginPath();ctx.ellipse(0,-55,width/2+12,66,0,-.8,.1);ctx.stroke();
  }
  if(player.invulnerableTimer>0 && !down) {
    ctx.strokeStyle='#eee5ff70';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,-2,width/2+4,6,0,0,Math.PI*2);ctx.stroke();
  }
  if(attacking) {
    const special=player.action==='special';
    ctx.strokeStyle=accent;ctx.fillStyle=accent;ctx.globalAlpha=.35+impact*.65;ctx.lineWidth=special?3:2;
    const tip=special?119:30+extension*20;
    if(special){ctx.beginPath();ctx.ellipse(tip,-59,22,30,0,-1.1,1.05);ctx.stroke();}
    if(special||punchFrame>0)for(let i=0;i<(special?5:2);i++)ctx.fillRect(special?89+impact*13+i*6:tip-18-i*7,-76+i*5,special?9:5,2);
    ctx.globalAlpha=1;
  }
  ctx.restore();
}

const ITEM_VISUALS = {
  heal:{color:'#b6f269',label:'VIDA'}, speed:{color:'#ffe078',label:'TURBO'},
  shield:{color:'#75d9ff',label:'ESCUDO'}, energy:{color:'#bc91ff',label:'ENERGIA'},
  rage:{color:'#ff9a63',label:'FÚRIA'}, jump:{color:'#f2a1ea',label:'SUPERPULO'},
};

export function drawItems(ctx, items=[], time=0) {
  for(const item of items) {
    const visual=ITEM_VISUALS[item.type]||{color:'#e9dfff',label:'ITEM'};
    const phase=typeof item.id==='number'?item.id:0;
    const x=70+item.x*1.06, grounded=(item.y||0)<=0;
    const y=500-(item.y||0)*.62-19+(grounded?Math.sin(time*3+phase)*1.5:0);
    ctx.save();
    ctx.fillStyle='#09061055';ctx.beginPath();ctx.ellipse(x,503,18,4,0,0,Math.PI*2);ctx.fill();
    ctx.translate(x,y);
    if(grounded && item.ttl<3)ctx.globalAlpha=.55+Math.sin(time*6)**2*.4;
    if(!grounded) {
      // A small pixel parachute makes a falling pickup readable before it lands.
      ctx.strokeStyle=visual.color+'88';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(-20,-39);ctx.lineTo(-11,-14);ctx.moveTo(20,-39);ctx.lineTo(11,-14);ctx.moveTo(0,-43);ctx.lineTo(0,-16);ctx.stroke();
      ctx.fillStyle=visual.color+'25';ctx.beginPath();ctx.moveTo(-24,-39);ctx.lineTo(-18,-48);ctx.lineTo(-9,-53);ctx.lineTo(9,-53);ctx.lineTo(18,-48);ctx.lineTo(24,-39);ctx.closePath();ctx.fill();
      ctx.strokeStyle=visual.color+'aa';ctx.stroke();
    }
    ctx.fillStyle=visual.color+'12';ctx.fillRect(-21,-21,42,42);
    ctx.fillStyle='#16111fec';ctx.fillRect(-16,-16,32,32);
    ctx.strokeStyle=visual.color;ctx.lineWidth=2;ctx.strokeRect(-16,-16,32,32);
    ctx.fillStyle=visual.color+'30';ctx.fillRect(-13,-13,26,3);
    ctx.fillStyle=visual.color;ctx.strokeStyle=visual.color;ctx.lineWidth=2;
    if(item.type==='heal') {ctx.fillRect(-3,-10,6,20);ctx.fillRect(-10,-3,20,6);}
    else if(item.type==='speed') {ctx.beginPath();ctx.moveTo(2,-11);ctx.lineTo(-8,2);ctx.lineTo(-1,2);ctx.lineTo(-3,11);ctx.lineTo(9,-3);ctx.lineTo(2,-3);ctx.closePath();ctx.fill();}
    else if(item.type==='shield') {ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(10,-6);ctx.lineTo(8,4);ctx.lineTo(0,11);ctx.lineTo(-8,4);ctx.lineTo(-10,-6);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(-1,4);ctx.lineTo(5,-4);ctx.stroke();}
    else if(item.type==='energy') {ctx.strokeRect(-9,-8,16,16);ctx.fillRect(8,-3,3,6);ctx.fillRect(-6,-5,3,10);ctx.fillRect(-1,-5,3,10);ctx.fillRect(4,-5,1,10);}
    else if(item.type==='rage') {ctx.fillRect(-8,-3,17,11);ctx.fillRect(-7,-8,4,6);ctx.fillRect(-2,-9,4,7);ctx.fillRect(3,-7,4,6);ctx.fillRect(-10,1,5,5);ctx.fillRect(-4,8,10,3);ctx.fillStyle='#16111f';ctx.fillRect(-5,-3,1,4);ctx.fillRect(0,-3,1,4);ctx.fillRect(5,-2,1,3);}
    else if(item.type==='jump') {ctx.fillRect(-3,-1,6,12);ctx.beginPath();ctx.moveTo(-10,-1);ctx.lineTo(0,-12);ctx.lineTo(10,-1);ctx.closePath();ctx.fill();}
    else {ctx.fillRect(-3,-8,6,16);ctx.fillRect(-8,-3,16,6);}
    ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.textBaseline='alphabetic';
    const labelWidth=ctx.measureText(visual.label).width+10;
    ctx.fillStyle='#120d1ced';ctx.fillRect(-labelWidth/2,20,labelWidth,14);
    ctx.fillStyle=visual.color;ctx.fillText(visual.label,0,30);
    ctx.restore();
  }
}

// The detailed infrastructure room is cached; only LEDs and terminal telemetry
// animate each frame. No DOM is accessed while this module is imported in Node.
let arenaBackdrop=null, arenaBackdropWidth=0, arenaBackdropHeight=0;

function paintArenaRoom(ctx) {
  const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  const line=(x1,y1,x2,y2,color,width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
  rect(0,0,1200,600,'#070b10');
  const ambient=ctx.createRadialGradient(600,150,20,600,230,670);
  ambient.addColorStop(0,'#142a253c');ambient.addColorStop(.6,'#0c17222b');ambient.addColorStop(1,'#070b1000');
  ctx.fillStyle=ambient;ctx.fillRect(0,0,1200,600);

  // Ceiling cable trays, conduit and hanging patch leads.
  rect(0,43,1200,16,'#121b22');rect(0,59,1200,3,'#26343c');
  for(let x=8;x<1200;x+=28){rect(x,46,17,3,'#273039');rect(x+5,51,18,2,'#0b1017');}
  for(const y of [66,71,77])line(0,y,1200,y,y===71?'#142d2c':'#131c26',2);
  for(const x of [17,137,397,799,1057,1182]){
    line(x,76,x,333,'#1b2830',2);line(x+4,76,x+4,322,'#101923',2);
  }
  for(const [x,y]of [[104,83],[366,83],[805,83],[1174,83]]){
    line(x,68,x,y,'#274e48',2);line(x,y,x-12,y+10,'#274e48',2);line(x-12,y+10,x-12,151,'#203e3d',2);
  }
  rect(0,367,1200,13,'#101820');rect(0,379,1200,2,'#334148');

  // Full-height racks: switches, copper ports, servers, vents and UPS units.
  const rackXs=[24,154,284,812,942,1072];
  for(let rack=0;rack<rackXs.length;rack++){
    const x=rackXs[rack];
    rect(x+7,91,105,282,'#03070b');rect(x,83,104,291,'#101820');
    ctx.strokeStyle='#2a3740';ctx.lineWidth=1;ctx.strokeRect(x+.5,83.5,103,290);
    rect(x+4,87,96,13,'#18242d');rect(x+10,91,25,3,'#324248');
    ctx.font='7px monospace';ctx.textAlign='right';ctx.fillStyle='#59706e';ctx.fillText(`R${rack+1} / 42U`,x+95,97);
    rect(x+5,104,94,265,'#090f15');
    for(let row=0;row<8;row++){
      const y=109+row*28;
      rect(x+10,y,84,23,row%2?'#111c24':'#142029');
      rect(x+12,y+2,80,1,'#28353b');
      if(row<2){
        rect(x+16,y+7,8,8,'#080c10');rect(x+17,y+8,5,2,'#355a50');
        for(let port=0;port<10;port++){const px=x+29+port*6;rect(px,y+7,4,4,'#425049');rect(px,y+8,4,2,'#070c10');rect(px,y+14,4,4,'#34453f');rect(px,y+15,4,2,'#070c10');}
        // Colored patch cables emerge from a few occupied switch ports.
        for(let p=0;p<3;p++){
          const px=x+36+p*15, end=px+7+(rack%2?-3:5);
          line(px,y+18,px,y+25,p%2?'#24413f':'#2f394c');line(px,y+25,end,y+25,p%2?'#24413f':'#2f394c');
        }
      }else{
        rect(x+16,y+7,5,5,'#294538');rect(x+24,y+7,3,5,'#27494b');
        for(let slit=0;slit<10;slit++)rect(x+34+slit*5,y+6,2,11,'#070c12');
        rect(x+83,y+6,5,11,'#263139');
      }
      rect(x+12,y+20,3,2,'#2c3940');rect(x+89,y+20,3,2,'#2c3940');
    }
    rect(x+10,338,84,28,'#171f28');rect(x+17,344,21,12,'#071813');
    rect(x+21,348,13,3,'#49634d');rect(x+44,345,3,14,'#2c3940');
    for(let slit=0;slit<6;slit++)rect(x+54+slit*5,345,2,14,'#080c12');
    rect(x+5,374,12,6,'#03070a');rect(x+86,374,12,6,'#03070a');
  }

  // Central NOC console: terminal, network topology and system telemetry.
  rect(410,96,380,204,'#03070c');rect(416,101,368,194,'#18252b');
  rect(421,107,358,181,'#07130f');rect(421,107,358,15,'#20312f');
  ctx.font='8px monospace';ctx.textAlign='left';ctx.fillStyle='#769889';ctx.fillText('APANE CORE / SECURE OPERATIONS',431,117);
  for(const [i,color]of ['#87544f','#8f8250','#5f8b6d'].entries())rect(747+i*9,112,4,4,color);
  ctx.font='bold 25px monospace';ctx.textAlign='center';ctx.fillStyle='#7ca28c';ctx.fillText('GRUPO APANE',600,153);
  ctx.font='8px monospace';ctx.fillStyle='#496f63';ctx.fillText('INFRASTRUCTURE  /  BLUE TEAM  /  NIGHT SHIFT',600,169);
  line(435,177,765,177,'#1f3b31');line(594,184,594,273,'#20362e');
  ctx.textAlign='left';ctx.font='8px monospace';
  const logs=['[OK] CORE SWITCH  10.0.0.1','[OK] VPN TUNNEL   ESTABLISHED','[OK] FIREWALL     ACTIVE','[OK] SERVER FARM  SYNCHRONIZED','[--] PACKET TRACE 0x7F32'];
  logs.forEach((log,i)=>{ctx.fillStyle=i===4?'#756f45':'#426d56';ctx.fillText(log,434,194+i*15);});
  const nodes=[[622,207],[677,191],[739,210],[650,250],[719,253]];
  for(const [a,b]of [[0,1],[1,2],[0,3],[3,4],[2,4],[1,4]])line(...nodes[a],...nodes[b],'#244e49');
  for(const [i,[x,y]]of nodes.entries()){
    rect(x-6,y-5,12,10,'#0a211b');ctx.strokeStyle='#386c5a';ctx.strokeRect(x-6,y-5,12,10);
    rect(x-3,y-2,6,3,'#487660');ctx.fillStyle='#49675f';ctx.font='6px monospace';ctx.fillText(i?'NODE '+i:'CORE',x-11,y+15);
  }
  rect(444,300,312,9,'#26313a');rect(458,309,284,13,'#121c23');
  rect(474,321,252,44,'#101820');
  for(let k=0;k<26;k++)rect(486+k*9,329,6,3,k%5?'#26363a':'#3d4c49');
  rect(494,338,210,10,'#0a1118');rect(502,341,186,2,'#263c37');
  rect(464,364,13,13,'#080e15');rect(725,364,13,13,'#080e15');

  // Side workstations: monitors, terminal logs, keyboards and trailing cables.
  for(const [x,mirror]of [[73,false],[1013,true]]){
    rect(x-5,292,128,6,'#1e2c34');rect(x,248,108,43,'#020609');rect(x+4,252,100,35,'#0a1a15');
    ctx.fillStyle='#365f49';ctx.font='6px monospace';ctx.textAlign='left';
    ['SESSION: ADMIN','LOGSTREAM // LIVE','0A 3F B2 77 C1','CHECKSUM: VALID'].forEach((t,i)=>ctx.fillText(t,x+9,260+i*7));
    rect(x+46,291,16,14,'#1c2930');rect(x+25,304,59,4,'#26323a');
    rect(x-13,319,142,9,'#1d2931');rect(x-8,328,133,11,'#0e171f');
    rect(x+4,310,87,7,'#0c131a');for(let k=0;k<12;k++)rect(x+9+k*6,312,4,2,'#384442');
    rect(x-6,339,8,36,'#1b2730');rect(x+111,339,8,36,'#1b2730');
    const cableX=mirror?x+121:x-8;
    line(cableX,331,cableX,362,'#243a39',2);line(cableX,362,cableX+(mirror?35:-35),362,'#243a39',2);
  }

  // Floor tiles recede into the rack wall. The combat baseline remains y=500.
  const floor=ctx.createLinearGradient(0,380,0,600);floor.addColorStop(0,'#0a1117');floor.addColorStop(1,'#0b1018');
  ctx.fillStyle=floor;ctx.fillRect(0,381,1200,219);
  ctx.strokeStyle='#1b2932';ctx.lineWidth=1;
  for(let i=-8;i<=8;i++){ctx.beginPath();ctx.moveTo(600+i*65,381);ctx.lineTo(600+i*155,600);ctx.stroke();}
  for(const y of [390,410,439,480,537,598])line(0,y,1200,y,'#1d2832');
  line(0,380,1200,380,'#33454c');line(0,383,1200,383,'#173a3b');
  for(const x of [0,1172])for(let y=386;y<430;y+=12){rect(x,y,28,4,'#6c603233');rect(x,y+4,28,4,'#090f15');}
  ctx.strokeStyle='#3d565b';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(600,501,370,42,0,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#1d3a3e';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(600,501,351,34,0,0,Math.PI*2);ctx.stroke();
  line(230,501,242,501,'#4d6b67',2);line(958,501,970,501,'#4d6b67',2);
  ctx.font='8px monospace';ctx.textAlign='center';ctx.fillStyle='#253b40';ctx.fillText('APANE / RESTRICTED ZONE',600,556);

  // Fine scanlines and small floor scuffs keep the room in the pixel-art world.
  rect(0,0,1200,39,'#080d12');ctx.fillStyle='#587a73';ctx.font='9px monospace';ctx.textAlign='left';ctx.fillText('APANE // DATACENTER 01',24,24);
  ctx.textAlign='right';ctx.fillStyle='#3c635c';ctx.fillText('INFRASTRUCTURE  ·  BLUE TEAM',1176,24);
  ctx.fillStyle='#020509';ctx.globalAlpha=.15;for(let y=0;y<600;y+=4)ctx.fillRect(0,y,1200,1);ctx.globalAlpha=1;
  for(let i=0;i<38;i++){const x=(i*137+47)%1200,y=401+(i*53)%190;rect(x,y,3+i%7,1,'#1a252d');}
}

function getArenaBackdrop(w,h) {
  if(arenaBackdrop && arenaBackdropWidth===w && arenaBackdropHeight===h)return arenaBackdrop;
  let canvas;
  if(typeof OffscreenCanvas!=='undefined')canvas=new OffscreenCanvas(w,h);
  else if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;}
  if(!canvas)return null;
  const background=canvas.getContext('2d');
  if(!background)return null;
  background.save();background.scale(w/1200,h/600);paintArenaRoom(background);background.restore();
  arenaBackdrop=canvas;arenaBackdropWidth=w;arenaBackdropHeight=h;
  return canvas;
}

export function drawArena(ctx,w,h,time=0) {
  ctx.save();
  const backdrop=getArenaBackdrop(w,h);
  if(backdrop)ctx.drawImage(backdrop,0,0);
  else{ctx.save();ctx.scale(w/1200,h/600);paintArenaRoom(ctx);ctx.restore();}
  ctx.scale(w/1200,h/600);
  // Animated LEDs, fans and packet traces are dim enough for the fight to read.
  for(let rack=0;rack<6;rack++){
    const x=[24,154,284,812,942,1072][rack];
    for(let row=0;row<8;row++){
      ctx.globalAlpha=.28+Math.sin(time*1.8+rack*1.7+row*.8)**2*.35;
      ctx.fillStyle=row%3?'#61b79e':'#82b9c0';ctx.fillRect(x+16,116+row*28,4,3);
      if(row<2){ctx.fillStyle='#588f65';ctx.fillRect(x+55+(row*13+rack*3)%28,117+row*28,2,2);}
    }
  }
  ctx.globalAlpha=1;
  const cursor=Math.sin(time*3)>-.25;
  if(cursor){ctx.fillStyle='#6e9d78';ctx.fillRect(568,251,6,2);ctx.fillRect(126,282,4,2);ctx.fillRect(1066,282,4,2);}
  const nodes=[[622,207],[677,191],[739,210],[650,250],[719,253]],links=[[0,1],[1,2],[0,3],[3,4],[2,4],[1,4]];
  for(let i=0;i<links.length;i++){
    const [a,b]=links[i],t=(time*.16+i*.21)%1;
    ctx.globalAlpha=.45;ctx.fillStyle=i%2?'#5a9991':'#719565';ctx.fillRect(nodes[a][0]+(nodes[b][0]-nodes[a][0])*t-1,nodes[a][1]+(nodes[b][1]-nodes[a][1])*t-1,2,2);
  }
  ctx.globalAlpha=1;
  ctx.fillStyle='#597466';ctx.font='7px monospace';ctx.textAlign='left';
  const hex=Math.floor(time*.7)%65536;ctx.fillText(`TRACE ${hex.toString(16).toUpperCase().padStart(4,'0')} / LINK STABLE`,434,278);
  ctx.restore();
}
