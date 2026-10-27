// Photo-inspired pixel art, shared by the selection screen and the arena.
// Crops leave the original generated sheet intact and are reused by SVG/Canvas.
const FIGHTER_SHEET = '/assets/fighters-reference.png';
const SHEET_WIDTH = 1774, SHEET_HEIGHT = 887;
const CROPS = {
  emerzon: { x:0, width:466 }, douglas: { x:466, width:445 },
  jose: { x:911, width:454 }, kaua: { x:1365, width:409 },
};
const fighterSheet = typeof Image === 'undefined' ? null : new Image();
if (fighterSheet) fighterSheet.src = FIGHTER_SHEET;

// Lightweight animated fallback while the shared image is loading.
const LOOKS = {
  emerzon: { skin:'#d1a185', shade:'#a8755d', hair:'#302820', top:'#24364d', light:'#344b63', dark:'#19273b', pants:'#292f38', accent:'#b6f269' },
  douglas: { skin:'#cda080', shade:'#a87660', hair:'#292626', top:'#25364d', light:'#3a4d65', dark:'#172438', pants:'#30323c', accent:'#bc91ff' },
  jose: { skin:'#bc8c70', shade:'#93664e', hair:'#2d2523', top:'#254d43', light:'#38695c', dark:'#19382f', pants:'#2b313d', accent:'#69cfff' },
  kaua: { skin:'#d7ab8d', shade:'#ae7d65', hair:'#272321', top:'#255357', light:'#367075', dark:'#193b40', pants:'#30343d', accent:'#ffb66f' },
};

function sprite(id, pose='idle', frame=0) {
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
    // Navy open jacket over a black crew-neck shirt, without a tie.
    rect(28,43,15,29,'#141a23');rect(30,42,12,4,c.skin);rect(29,46,14,3,'#0f141c');
    rect(24,43,5,25,c.light);rect(26,48,4,13,c.top);rect(43,43,5,25,c.light);rect(41,49,4,15,c.top);
    rect(23,65,6,3,c.dark);rect(43,64,6,3,c.dark);rect(28,69,16,3,'#10151d');
  }
  if(id==='emerzon') {
    // Plain navy T-shirt with a round collar.
    rect(22,47,25,21,c.top);rect(27,42,19,6,c.dark);rect(29,42,15,4,c.skin);rect(31,46,11,2,c.dark);
    rect(24,50,3,12,c.light);rect(42,62,5,2,c.dark);
  }
  if(id==='jose') {
    // Dark-green polo, white collar and a small white pocket detail.
    rect(27,43,7,5,'#e4e6de');rect(39,43,7,5,'#e4e6de');rect(30,47,4,3,'#e4e6de');rect(38,47,4,3,'#e4e6de');
    rect(34,45,5,10,c.dark);rect(36,48,1,1,'#e3e5dc');rect(36,52,1,1,'#e3e5dc');
    rect(39,54,8,6,'#dce3db');rect(40,56,6,4,c.top);
  }
  if(id==='kaua') {
    // Petrol-blue / dark-teal crew-neck T-shirt, no accessories.
    rect(22,47,25,21,c.top);rect(27,42,19,6,c.dark);rect(29,42,15,4,c.skin);rect(31,46,11,2,c.dark);
    rect(24,50,3,13,c.light);rect(40,64,7,2,c.dark);
  }
  // Left arm, bent into a guard.
  rect(10,46,10,19,c.top);rect(7,61,12,8,c.dark);rect(6,53,8,12,c.skin);rect(4,48,12,10,c.skin);rect(4,48,12,3,c.shade);rect(5,49,10,3,c.skin);
  if(punch) {rect(47,46,18,11,c.top);rect(57,47,20,9,c.skin);rect(73,43,14,15,c.skin);rect(73,54,13,4,c.shade);rect(75,44,10,3,'#ffffff20');}
  else if(block) {rect(47,43,10,20,c.top);rect(49,29,9,22,c.skin);rect(46,26,14,12,c.skin);rect(46,26,14,3,c.shade);}
  else {rect(46,47,11,18,c.top);rect(51,52,10,14,c.dark);rect(53,43,8,15,c.skin);rect(50,38,14,12,c.skin);rect(50,38,14,3,c.shade);rect(52,39,10,2,'#ffffff1a');}
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
  if(hit) rect(25,19,25,15,'#ff8c8c22');
  return r;
}

export function portraitSVG(character, small=false) {
  const {id,color}=character;
  const crop=CROPS[id]||CROPS.emerzon;
  const width=crop.width/850*216;
  const fighter=`<svg x="${146-width/2}" y="8" width="${width}" height="216" viewBox="${crop.x} 24 ${crop.width} 850" overflow="hidden" preserveAspectRatio="none"><image href="${FIGHTER_SHEET}" width="${SHEET_WIDTH}" height="${SHEET_HEIGHT}"/></svg>`;
  const racks=[15,80,180,245].map((x,i)=>`<g opacity="${i%2?.28:.45}"><rect x="${x}" y="25" width="43" height="160" fill="#16141e" stroke="${color}" stroke-opacity=".22"/>${[38,58,78,98,118,138,158].map((y,j)=>`<rect x="${x+5}" y="${y}" width="33" height="14" fill="#292534"/><rect x="${x+8}" y="${y+4}" width="2" height="3" fill="${color}" opacity="${j%3?.45:1}"/><path d="M${x+15} ${y+6}h16" stroke="#ffffff" stroke-opacity=".1"/>`).join('')}</g>`).join('');
  return `<svg class="portrait" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 240" role="img" aria-label="Ilustração pixel art de ${character.name}"><defs><radialGradient id="glow-${id}${small?'s':''}"><stop stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="280" height="240" fill="#211e29"/><rect width="280" height="240" fill="url(#glow-${id}${small?'s':''})"/>${racks}<path d="M0 195h280M140 195 0 240m140-45 140 45M140 195l-65 45m65-45 65 45M0 215h280M0 237h280" stroke="${color}" stroke-opacity=".12"/><path d="M0 0h90L0 190z" fill="${color}" opacity=".025"/><text x="20" y="187" fill="${color}" opacity=".2" font-family="monospace" font-size="7">${id==='kaua'?'&gt; auto.combo()':id==='jose'?'&gt; weakness.found':id==='douglas'?'&gt; access: admin':'&gt; system.ready'}</text><ellipse cx="146" cy="222" rx="67" ry="9" fill="#08080e" opacity=".7"/><ellipse cx="146" cy="224" rx="64" ry="7" fill="none" stroke="${color}" stroke-opacity=".4"/>${fighter}<path d="M16 211v12h12m224-12v12h-12" fill="none" stroke="${color}" opacity=".35"/></svg>`;
}

export function drawFighter(ctx, player, x, ground, scale, time) {
  const accent=LOOKS[player.characterId]?.accent||'#fff';
  ctx.save();ctx.translate(x,ground-player.y*.62);ctx.scale(player.facing*scale,scale);
  if(player.action==='special') {ctx.fillStyle=accent+'35';ctx.fillRect(-35,-105,95,108);}
  if(player.action==='block') {ctx.strokeStyle=accent+'bb';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(24,-61,21,40,0,-1.4,1.4);ctx.stroke();}
  if(fighterSheet?.complete && fighterSheet.naturalWidth) {
    const crop=CROPS[player.characterId]||CROPS.emerzon;
    const walking=player.action==='walk', attacking=player.action==='attack'||player.action==='special';
    const duration=player.action==='special'?.36:.2;
    const impact=attacking?Math.sin(Math.PI*Math.max(0,Math.min(1,1-player.attackTimer/duration))):0;
    const bob=walking?-Math.abs(Math.sin(time*13))*2.2:player.action==='idle'?Math.sin(time*3)*.7:0;
    const width=crop.width/850*110;
    ctx.save();ctx.translate(impact*9,bob);
    if(player.hp<=0)ctx.rotate(-1.12);
    else if(player.action==='hit'){ctx.rotate(.08);ctx.globalAlpha=.72;}
    else if(player.action==='jump')ctx.rotate(-.045);
    else if(walking)ctx.rotate(Math.sin(time*13)*.018);
    else if(attacking)ctx.rotate(-impact*.055);
    if(player.action==='block')ctx.scale(1,.93);
    else ctx.scale(1+impact*.04,1-impact*.025);
    ctx.drawImage(fighterSheet,crop.x,24,crop.width,850,-width/2,-110,width,110);
    ctx.restore();
    if(attacking) {
      const special=player.action==='special';
      ctx.strokeStyle=accent;ctx.fillStyle=accent;ctx.globalAlpha=.35+impact*.65;
      ctx.lineWidth=special?3:2;
      ctx.beginPath();ctx.ellipse(20+impact*17,-59,special?43:30,special?26:16,0,-1.1,1.05);ctx.stroke();
      for(let i=0;i<(special?5:3);i++)ctx.fillRect(33+impact*13+i*6,-69+i*5,5+(special?4:0),2);
      ctx.globalAlpha=1;
    }
  } else {
    const bob=player.action==='idle'?Math.round(Math.sin(time*3)):0;
    ctx.translate(-34,-110+bob);
    for(const [rx,ry,w,h,color] of sprite(player.characterId,player.action,time)){ctx.fillStyle=color;ctx.fillRect(rx,ry,w,h);}
    if(player.hp<=0){ctx.fillStyle='#f4787a44';ctx.fillRect(19,10,32,90);}
  }
  ctx.restore();
}

export function drawArena(ctx,w,h,time) {
  ctx.fillStyle='#1b1525';ctx.fillRect(0,0,w,h);
  const glow=ctx.createRadialGradient(w/2,220,10,w/2,260,560);glow.addColorStop(0,'#4c355b');glow.addColorStop(1,'#1b1525');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#18131f';ctx.fillRect(0,52,w,12);ctx.fillStyle='#3f2e4a';ctx.fillRect(0,64,w,2);
  for(let i=0;i<9;i++) {const x=22+i*140;ctx.fillStyle='#17141e';ctx.fillRect(x,90,104,288);ctx.strokeStyle='#48344f';ctx.strokeRect(x,90,104,288);for(let j=0;j<8;j++){const y=104+j*33;ctx.fillStyle='#262030';ctx.fillRect(x+8,y,88,26);ctx.fillStyle=j%3===0?'#b4e77a':'#826396';ctx.globalAlpha=.5+Math.sin(time*2+i+j)*.25;ctx.fillRect(x+16,y+8,4,4);ctx.fillRect(x+23,y+8,4,4);ctx.globalAlpha=1;ctx.fillStyle='#44384f';ctx.fillRect(x+36,y+9,48,2);ctx.fillRect(x+36,y+15,48,2);}}
  ctx.fillStyle='#32243d';ctx.fillRect(w/2-158,150,316,136);ctx.strokeStyle='#87649d';ctx.lineWidth=2;ctx.strokeRect(w/2-158,150,316,136);ctx.fillStyle='#17131f';ctx.fillRect(w/2-152,156,304,124);ctx.textAlign='center';ctx.fillStyle='#bda0d3';ctx.font='800 54px "Barlow Condensed", sans-serif';ctx.fillText('GRUPO APANE',w/2,220);ctx.fillStyle='#92809f';ctx.font='11px monospace';ctx.fillText('TI DE DIA. LENDAS NA ARENA.',w/2,247);ctx.fillStyle='#c0ee87';ctx.fillRect(w/2-6,263,12,3);
  ctx.fillStyle='#221a2b';ctx.fillRect(0,380,w,h-380);ctx.strokeStyle='#493452';ctx.lineWidth=1;for(let i=-6;i<=6;i++){ctx.beginPath();ctx.moveTo(w/2+i*85,380);ctx.lineTo(w/2+i*170,h);ctx.stroke();}for(const y of [390,412,445,492,557]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.fillStyle='#b18bc5';ctx.globalAlpha=.35;ctx.fillRect(0,379,w,2);ctx.globalAlpha=1;
  ctx.strokeStyle='#8c6d9e';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(w/2,501,370,42,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#42304f';ctx.beginPath();ctx.ellipse(w/2,501,350,34,0,0,Math.PI*2);ctx.stroke();
  ctx.textAlign='left';ctx.font='9px monospace';ctx.fillStyle='#8d729c';ctx.fillText('APANE // DATACENTER 01',24,30);ctx.textAlign='right';ctx.fillText('AUTHORIZED FIGHTERS ONLY',w-24,30);
  ctx.fillStyle='#09060e';ctx.globalAlpha=.12;for(let y=0;y<h;y+=4)ctx.fillRect(0,y,w,1);ctx.globalAlpha=1;
}
