// Original pixel characters, drawn with the same geometry in cards and combat.
const LOOKS = {
  emerzon: { skin:'#c48b65', shade:'#955d49', hair:'#29232c', top:'#596746', light:'#819c5d', dark:'#344333', pants:'#292f38', accent:'#b6f269' },
  douglas: { skin:'#d9aa86', shade:'#af7e68', hair:'#463a3b', top:'#555066', light:'#777087', dark:'#353041', pants:'#33313e', accent:'#bc91ff' },
  jose: { skin:'#a87556', shade:'#7f503e', hair:'#211f29', top:'#456476', light:'#6991a6', dark:'#2d4656', pants:'#2b313d', accent:'#69cfff' },
  kaua: { skin:'#e5b593', shade:'#b98470', hair:'#3b2d2d', top:'#a36b43', light:'#cf945d', dark:'#714933', pants:'#38313e', accent:'#ffb66f' },
};

function sprite(id, pose='idle', frame=0) {
  const c=LOOKS[id]||LOOKS.emerzon, r=[];
  const rect=(x,y,w,h,color)=>r.push([x,y,w,h,color]);
  const walking=pose==='walk', airborne=pose==='jump', hit=pose==='hit';
  const stride=walking?Math.round(Math.sin(frame*12))*5:airborne?5:0;
  const punch=pose==='attack'||pose==='special', block=pose==='block';
  // Strong silhouette: boots, denim, overshirt, raised guard.
  rect(15-stride,102,18,7,'#13131d');rect(36+stride,102,18,7,'#13131d');
  rect(17-stride,106,16,3,'#62616b');rect(37+stride,106,17,3,'#62616b');
  rect(19-stride,75,12,28,c.pants);rect(36+stride,75,13,28,c.pants);
  rect(21-stride,78,4,22,'#ffffff0d');rect(39+stride,79,3,22,'#ffffff0c');
  rect(21,71,28,10,c.pants);rect(21,74,28,3,'#1c202a');rect(32,74,5,3,'#a3a0aa');
  rect(19,42,31,31,c.top);rect(16,47,6,22,c.dark);rect(23,43,5,26,c.light);
  rect(19,68,31,7,c.dark);rect(27,43,17,5,c.light);rect(30,36,13,12,c.skin);rect(30,37,13,5,c.shade);
  if(id==='douglas') {rect(27,43,7,22,'#d9d5d6');rect(34,43,8,22,'#c5bccb');rect(33,44,4,22,c.accent);rect(30,43,3,7,'#eeece8');rect(37,43,4,7,'#eeece8');rect(26,67,18,6,c.top);}
  if(id==='emerzon') {rect(35,52,11,9,c.dark);rect(36,52,9,2,c.light);rect(40,45,2,6,'#d2d4bd');}
  if(id==='jose') {rect(29,43,7,28,'#253b4d');rect(32,44,2,30,'#729fb9');rect(38,52,9,6,c.light);rect(39,54,4,1,'#d8edf1');}
  if(id==='kaua') {rect(27,42,18,5,c.dark);rect(31,45,2,12,'#eed1a3');rect(40,45,2,12,'#eed1a3');rect(28,61,17,8,c.dark);rect(29,61,15,2,c.light);}
  // Left arm, bent into a guard.
  rect(10,46,10,19,c.top);rect(7,61,12,8,c.dark);rect(6,53,8,12,c.skin);rect(4,48,12,10,c.skin);rect(4,48,12,3,c.shade);rect(5,49,10,3,c.skin);
  if(punch) {rect(47,46,18,11,c.top);rect(57,47,20,9,c.skin);rect(73,43,14,15,c.skin);rect(73,54,13,4,c.shade);rect(75,44,10,3,'#ffffff20');}
  else if(block) {rect(47,43,10,20,c.top);rect(49,29,9,22,c.skin);rect(46,26,14,12,c.skin);rect(46,26,14,3,c.shade);}
  else {rect(46,47,11,18,c.top);rect(51,52,10,14,c.dark);rect(53,43,8,15,c.skin);rect(50,38,14,12,c.skin);rect(50,38,14,3,c.shade);rect(52,39,10,2,'#ffffff1a');}
  // Head, ears and pixel highlights.
  rect(22,13,27,23,c.skin);rect(25,31,22,8,c.skin);rect(24,35,17,5,c.shade);rect(19,21,5,10,c.shade);rect(20,22,5,7,c.skin);
  rect(47,24,5,7,c.skin);rect(25,14,5,18,'#ffffff12');rect(44,16,5,15,c.shade);
  if(id==='douglas') {rect(22,6,24,9,c.hair);rect(19,12,7,12,c.hair);rect(43,12,6,7,c.hair);rect(22,6,6,5,'#777079');rect(20,12,4,6,'#777079');rect(27,32,18,4,'#735750');rect(30,35,13,3,'#735750');}
  else if(id==='jose') {rect(20,8,27,10,c.hair);rect(18,12,7,12,c.hair);rect(23,5,20,7,c.hair);rect(26,7,15,3,'#35313e');rect(24,22,11,8,'#192633');rect(38,22,11,8,'#192633');rect(34,24,5,2,'#192633');rect(26,24,6,3,'#72a9bb');rect(40,24,6,3,'#72a9bb');rect(19,23,6,3,'#192633');}
  else if(id==='kaua') {rect(20,9,28,10,c.hair);rect(24,5,19,8,c.hair);rect(43,10,9,13,c.hair);rect(21,18,6,8,c.hair);rect(23,8,17,3,'#5d4139');rect(20,7,5,26,'#242332');rect(18,21,8,14,'#3c3546');rect(18,24,5,8,c.accent);rect(21,5,23,4,'#242332');}
  else {rect(20,8,28,12,c.hair);rect(19,14,7,12,c.hair);rect(23,5,19,7,c.hair);rect(23,8,17,3,'#46404a');rect(19,10,4,24,'#3e433c');rect(17,21,8,13,'#252c2c');rect(17,24,5,7,c.accent);rect(21,6,23,4,'#59604f');rect(22,31,6,3,'#252c2c');rect(26,32,7,2,'#252c2c');rect(31,31,4,3,'#879d66');}
  if(id!=='jose') {rect(31,23,4,3,'#28232c');rect(43,23,4,3,'#28232c');rect(31,22,5,1,c.hair);rect(42,22,5,1,c.hair);}
  rect(37,29,5,2,c.shade);rect(36,33,7,2,'#6d4841');
  if(hit) rect(25,19,25,15,'#ff8c8c22');
  return r;
}

export function portraitSVG(character, small=false) {
  const {id,color}=character;
  const rects=sprite(id).map(([x,y,w,h,c])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('');
  const racks=[15,80,180,245].map((x,i)=>`<g opacity="${i%2?.28:.45}"><rect x="${x}" y="25" width="43" height="160" fill="#16141e" stroke="${color}" stroke-opacity=".22"/>${[38,58,78,98,118,138,158].map((y,j)=>`<rect x="${x+5}" y="${y}" width="33" height="14" fill="#292534"/><rect x="${x+8}" y="${y+4}" width="2" height="3" fill="${color}" opacity="${j%3?.45:1}"/><path d="M${x+15} ${y+6}h16" stroke="#ffffff" stroke-opacity=".1"/>`).join('')}</g>`).join('');
  return `<svg class="portrait" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 240" role="img" aria-label="Ilustração pixel art de ${character.name}"><defs><radialGradient id="glow-${id}${small?'s':''}"><stop stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="280" height="240" fill="#211e29"/><rect width="280" height="240" fill="url(#glow-${id}${small?'s':''})"/>${racks}<path d="M0 195h280M140 195 0 240m140-45 140 45M140 195l-65 45m65-45 65 45M0 215h280M0 237h280" stroke="${color}" stroke-opacity=".12"/><path d="M0 0h90L0 190z" fill="${color}" opacity=".025"/><text x="20" y="187" fill="${color}" opacity=".2" font-family="monospace" font-size="7">${id==='kaua'?'&gt; auto.combo()':id==='jose'?'&gt; weakness.found':id==='douglas'?'&gt; access: admin':'&gt; system.ready'}</text><ellipse cx="146" cy="222" rx="67" ry="9" fill="#08080e" opacity=".7"/><ellipse cx="146" cy="224" rx="64" ry="7" fill="none" stroke="${color}" stroke-opacity=".4"/><g transform="translate(77 12) scale(1.92)" shape-rendering="crispEdges">${rects}</g><path d="M16 211v12h12m224-12v12h-12" fill="none" stroke="${color}" opacity=".35"/></svg>`;
}

export function drawFighter(ctx, player, x, ground, scale, time) {
  ctx.save();ctx.translate(x,ground-player.y*.62);ctx.scale(player.facing*scale,scale);
  if(player.action==='special') {ctx.fillStyle=(LOOKS[player.characterId]?.accent||'#fff')+'35';ctx.fillRect(-35,-105,95,108);}
  if(player.action==='block') {ctx.strokeStyle=(LOOKS[player.characterId]?.accent||'#fff')+'bb';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(24,-61,21,40,0,-1.4,1.4);ctx.stroke();}
  const bob=player.action==='idle'?Math.round(Math.sin(time*3))*1:0;
  ctx.translate(-34,-110+bob);
  for(const [rx,ry,w,h,color] of sprite(player.characterId,player.action,time)){ctx.fillStyle=color;ctx.fillRect(rx,ry,w,h);}
  if(player.hp<=0){ctx.fillStyle='#f4787a44';ctx.fillRect(19,10,32,90);}
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
