import { CHARACTERS, ITEM_TYPES, ROUND_DURATION, FINISHER_DURATION, createMatch, stepMatch } from './engine.js';
import { portraitSVG, drawFighter, drawArena, drawItems } from './art.js';
import { drawFinisher, FINISHER_IMPACT_TIMES, getFinisherStage } from './finisher.js';
import { OnlineTransport } from './online.js';

const $=id=>document.getElementById(id);
const character=id=>CHARACTERS.find(c=>c.id===id)||CHARACTERS[0];
let selected='emerzon', opponent='douglas', room=null, onlineRoundId=null, connectionState='connected';
let state=null, mode=null, running=false, lastFrame=0, heartbeat=0, lastEvent=0;
let sound=false, audio=null, toastTimer;
const inputs=[{},{}], keys=new Set(), touch=new Set(), particles=[];
const eventQueue=[];
const bloodLayer=document.createElement('canvas');
bloodLayer.width=1200;bloodLayer.height=600;
const bloodCtx=bloodLayer.getContext('2d');
let renderPositions=[], shake=0, bannerUntil=0, animationFrame=0;
let finishingShot=null, lastFinisherId=0;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const canvas=$('arena-canvas'), ctx=canvas.getContext('2d');
const icons={sound:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>',muted:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/></svg>'};
const classes=['SUPORTE','LIDERANÇA','ESTRATÉGIA','AUTOMAÇÃO'];

const pageSize=()=>window.matchMedia('(max-width:680px)').matches?2:4;
let rosterPage=0, opponentPage=0;
const normalizeName=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g,' ');
function rosterSlice(input,page,size){
  const query=normalizeName(input.value);
  const matches=CHARACTERS.filter(c=>normalizeName([c.name,...(c.aliases||[])].join(' ')).includes(query));
  const pages=Math.max(1,Math.ceil(matches.length/size));
  const current=Math.max(0,Math.min(page,pages-1));
  return {matches,pages,current,visible:matches.slice(current*size,(current+1)*size)};
}
function updatePager(prefix,view,selectedId){
  $(prefix+'-prev').disabled=view.current===0;
  $(prefix+'-next').disabled=view.current===view.pages-1;
  $(prefix+'-status').textContent=(view.matches.length?`${view.matches.length} lutadores · ${view.current+1}/${view.pages}`:'Nenhum lutador encontrado')+` · ${prefix==='roster'?'P1':'P2'}: ${character(selectedId).name}`;
  $(prefix+'-empty').hidden=!!view.matches.length;
}
function renderRoster(){
  const view=rosterSlice($('character-search'),rosterPage,pageSize());
  rosterPage=view.current;
  updatePager('roster',view,selected);
  $('character-grid').innerHTML=view.visible.map((c)=>`<button class="character-card ${selected===c.id?'selected':''}" data-character="${c.id}" style="--accent:${c.color}" aria-pressed="${selected===c.id}" aria-label="Selecionar ${c.name}, ${c.role}"><div class="card-art">${portraitSVG(c)}<span class="card-index">P.${String(CHARACTERS.indexOf(c)+1).padStart(2,'0')}</span><span class="character-class">${c.className||classes[CHARACTERS.indexOf(c)]||'CONVIDADO'}</span><span class="selected-label">✓ SELECIONADO <span>PLAYER 01</span></span></div><div class="card-info"><div class="card-name-row"><h3>${c.name.toUpperCase()}</h3><span class="card-number">↗</span></div><p class="card-role">${c.role}</p><p class="card-description">${c.description}</p><div class="stats">${[['FORÇA','power'],['VELOC.','speed'],['DEFESA','defense']].map(([label,key])=>`<div class="stat"><span>${label}</span><div class="stat-bars" aria-label="${label}: ${c.stats[key]} de 5">${Array.from({length:5},(_,n)=>`<i class="${n<c.stats[key]?'filled':''}"></i>`).join('')}</div></div>`).join('')}</div><div class="card-special"><span class="special-symbol">ϟ</span><span>${c.special.toUpperCase()}</span></div></div></button>`).join('');
  document.querySelectorAll('[data-character]').forEach(button=>button.addEventListener('click',()=>{
    selected=button.dataset.character;
    updatePager('roster',rosterSlice($('character-search'),rosterPage,pageSize()),selected);
    document.querySelectorAll('[data-character]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',b===button?'true':'false');});
    beep('select');
  }));
}
$('character-search').addEventListener('input',()=>{rosterPage=0;renderRoster();});
$('roster-prev').addEventListener('click',()=>{rosterPage--;renderRoster();});
$('roster-next').addEventListener('click',()=>{rosterPage++;renderRoster();});
window.matchMedia('(max-width:680px)').addEventListener('change',()=>{rosterPage=0;renderRoster();});
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function closeDialogs(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
function showDialog(id){closeDialogs();$(id).showModal();}
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom){if(dialog.id==='lobby-dialog')leaveRoom();dialog.close();}}}));
$('help-button')?.addEventListener('click',()=>showDialog('help-dialog'));
$('how-button').addEventListener('click',()=>showDialog('help-dialog'));
$('sound-button').innerHTML=icons.muted;
$('sound-button').addEventListener('click',()=>{sound=!sound;$('sound-button').innerHTML=icons[sound?'sound':'muted'];$('sound-button').setAttribute('aria-pressed',String(sound));$('sound-button').setAttribute('aria-label',sound?'Desativar efeitos sonoros':'Ativar efeitos sonoros');if(sound)beep('select');});
function beep(type,intensity=1){
  if(!sound)return;
  if(type==='fatality'){
    // A short, synthetic arcade thud, not a realistic injury sound.
    try{
      audio??=new (window.AudioContext||window.webkitAudioContext)();
      if(audio.state==='suspended')audio.resume().catch(()=>{});
      const now=audio.currentTime,duration=.23,strength=Math.max(.5,Math.min(1.2,intensity));
      const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate);
      const samples=buffer.getChannelData(0);let seed=517;
      for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=((seed/4294967296)*2-1)*(1-i/samples.length);}
      const noise=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
      noise.buffer=buffer;filter.type='lowpass';filter.frequency.value=1100;
      noise.connect(filter);filter.connect(gain);gain.connect(audio.destination);
      gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(.055*strength,now+.008);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
      noise.start(now);noise.stop(now+duration);
      const bass=audio.createOscillator(),bassGain=audio.createGain();
      bass.type='triangle';bass.frequency.setValueAtTime(125,now);bass.frequency.exponentialRampToValueAtTime(38,now+duration);
      bass.connect(bassGain);bassGain.connect(audio.destination);
      bassGain.gain.setValueAtTime(.001,now);bassGain.gain.linearRampToValueAtTime(.065*strength,now+.008);bassGain.gain.exponentialRampToValueAtTime(.001,now+duration);
      bass.start(now);bass.stop(now+duration);
    }catch{/* Audio is optional; the cinematic still completes. */}
    return;
  }
  try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.type=type==='hit'?'sawtooth':'square';const f=type==='hit'?110:type==='special'?360:type==='finish'?440:640;o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(type==='hit'?40:f/2,audio.currentTime+.12);g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.14);o.start();o.stop(audio.currentTime+.15);}catch{/* Sound is optional; gameplay stays available. */}
}

// Both hosting modes use the same game protocol and authoritative rules.
const online=new OnlineTransport({
  onMessage:receive,
  onStatus:status=>{connectionState=status;updateConnectionStatus();},
  onExpired:message=>{if(room||mode==='online'){room=null;onlineRoundId=null;stopGame();closeDialogs();toast(message||'A sala expirou. Crie ou entre em uma sala novamente.');}},
});
function send(message){online.send(message);}
function requestRoom(type,code){return online.requestRoom(type,selected,code);}
function updateConnectionStatus(){
  const element=$('game-connection');
  if(!element)return;
  const other=room?.players?.[1-room.playerIndex];
  element.textContent=connectionState==='reconnecting'?'RECONECTANDO…':other?.connected===false?'AGUARDANDO O ADVERSÁRIO RECONECTAR…':'';
  element.hidden=!element.textContent||mode!=='online';
}
function receive(message){
  if(message.type==='error'){
    toast(message.message);return;
  }
  if(message.type==='room'){
    const previous=room;room=message;
    updateConnectionStatus();
    const own=room.players[room.playerIndex]?.characterId;
    if(own&&own!==selected){selected=own;renderRoster();}
    if(message.status==='waiting'){
      if(running)stopGame();
      if(!$('lobby-dialog').open||previous?.code!==room.code||previous?.playerIndex!==room.playerIndex)renderLobby();
    } else if(message.status==='finished'&&mode==='online'){
      const me=message.players[message.playerIndex],other=message.players[1-message.playerIndex];
      $('rematch-button').disabled=!!me?.rematch;
      $('rematch-button').textContent=me?.rematch?'AGUARDANDO ADVERSÁRIO...':'REVANCHE ↻';
      if(other?.rematch&&!me?.rematch)$('result-description').textContent='Seu adversário pediu revanche. Aceita o desafio?';
    }
  }
  if(message.type==='state'){
    if(!room)return;
    const changedRound=message.roundId&&message.roundId!==onlineRoundId;
    if(!running||mode!=='online')startGame('online',message.state);
    else if(changedRound||(state?.phase==='finished'&&message.state.phase==='countdown')){
      resetRoundEffects(message.state);$('game-result').hidden=true;$('rematch-button').disabled=false;$('rematch-button').innerHTML='REVANCHE <span>↻</span>';
    }
    if(message.roundId)onlineRoundId=message.roundId;
    state=message.state;enqueueEvents(state.events);
  }
  if(message.type==='opponent_left'){
    if(running)stopGame();
    toast('Seu adversário saiu. A sala está aberta para outro desafiante.');
  }
}
function renderLobby(){
  $('lobby-code').textContent=room.code;
  const c=character(room.players[room.playerIndex]?.characterId||selected);
  $('lobby-player').innerHTML=`${portraitSVG(c,true)}<div><strong>${c.name}</strong><span>${c.role} · PRONTO PARA LUTAR</span></div>`;
  if(!$('lobby-dialog').open)showDialog('lobby-dialog');
}
function leaveRoom(){online.leave();room=null;onlineRoundId=null;$('lobby-dialog').close();}
$('lobby-dialog').addEventListener('cancel',()=>leaveRoom());
$('leave-lobby').addEventListener('click',leaveRoom);$('cancel-room').addEventListener('click',leaveRoom);
$('copy-code').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(room.code);$('copy-code').textContent='COPIADO ✓';setTimeout(()=>$('copy-code').innerHTML='COPIAR <span>⧉</span>',1800);}catch{toast(`Código da sala: ${room.code}. Selecione o código para copiar.`);const range=document.createRange();range.selectNodeContents($('lobby-code'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}
});
$('create-button').addEventListener('click',async()=>{const button=$('create-button');button.disabled=true;try{await requestRoom('create');}catch(error){toast(error.message);}finally{button.disabled=false;}});
$('join-button').addEventListener('click',()=>{$('join-error').textContent='';showDialog('join-dialog');$('room-code').focus();});
$('join-form').addEventListener('submit',async e=>{e.preventDefault();const button=$('join-form').querySelector('button');button.disabled=true;$('join-error').textContent='';try{await requestRoom('join',$('room-code').value.trim().toUpperCase());$('join-dialog').close();}catch(error){$('join-error').textContent=error.message;}finally{button.disabled=false;}});
$('room-code').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});

// Both local players use the same game rules as the authoritative online server.
function renderOpponents(){
  $('local-player-name').textContent=character(selected).name;
  const view=rosterSlice($('opponent-search'),opponentPage,4);
  opponentPage=view.current;
  updatePager('opponent',view,opponent);
  $('opponent-grid').innerHTML=view.visible.map(c=>`<button class="opponent-choice ${opponent===c.id?'selected':''}" data-opponent="${c.id}" aria-pressed="${opponent===c.id}" aria-label="Jogador 2: ${c.name}">${portraitSVG(c,true)}<span>${c.name}</span></button>`).join('');
  document.querySelectorAll('[data-opponent]').forEach(button=>button.addEventListener('click',()=>{opponent=button.dataset.opponent;document.querySelectorAll('[data-opponent]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});updatePager('opponent',rosterSlice($('opponent-search'),opponentPage,4),opponent);beep('select');}));
}
$('opponent-search').addEventListener('input',()=>{opponentPage=0;renderOpponents();});
$('opponent-prev').addEventListener('click',()=>{opponentPage--;renderOpponents();});
$('opponent-next').addEventListener('click',()=>{opponentPage++;renderOpponents();});
$('local-button').addEventListener('click',()=>{online.leave();room=null;onlineRoundId=null;renderOpponents();showDialog('local-dialog');});
$('start-local').addEventListener('click',()=>startGame('local',createMatch([selected,opponent])));

function resetRoundEffects(newState){
  lastEvent=0;eventQueue.length=0;particles.length=0;bloodCtx.clearRect(0,0,1200,600);shake=0;bannerUntil=0;
  finishingShot=null;lastFinisherId=0;
  $('finisher-caption').hidden=true;canvas.parentElement.classList.remove('finishing','finishing-blackout');
  renderPositions=newState.players.map(p=>({x:p.x,y:p.y}));
  $('arena-event').hidden=true;
}
function startGame(newMode,newState){
  closeDialogs();state=newState;mode=newMode;clearInputs();resetRoundEffects(newState);
  $('game-screen').hidden=false;document.querySelector('.site-shell').inert=true;document.body.style.overflow='hidden';$('game-result').hidden=true;
  $('rematch-button').disabled=false;$('rematch-button').innerHTML='REVANCHE <span>↻</span>';
  $('game-mode').textContent=mode==='local'?'PVP LOCAL · 1 × 1':`PVP ONLINE · SALA ${room.code}`;
  $('you-tag').textContent=mode==='online'?` / VOCÊ É P${room.playerIndex+1}`:'';
  updateConnectionStatus();
  $('p2-controls').hidden=mode==='online';
  $('p1-name').textContent=character(state.players[0].characterId).name.toUpperCase();
  $('p2-name').textContent=character(state.players[1].characterId).name.toUpperCase();
  if(!running){running=true;lastFrame=performance.now();animationFrame=requestAnimationFrame(frame);}
  $('exit-game').focus({preventScroll:true});
}
function stopGame(){cancelAnimationFrame(animationFrame);animationFrame=0;running=false;mode=null;state=null;finishingShot=null;lastFinisherId=0;$('finisher-caption').hidden=true;canvas.parentElement.classList.remove('finishing','finishing-blackout');clearInputs();$('arena-event').hidden=true;eventQueue.length=0;$('game-screen').hidden=true;document.querySelector('.site-shell').inert=false;document.body.style.overflow='';$('game-result').hidden=true;$('game-announcement').textContent='';}
function exitGame(){if(mode==='online')leaveRoom();stopGame();$('local-button').focus({preventScroll:true});}
$('exit-game').addEventListener('click',exitGame);$('back-selection').addEventListener('click',exitGame);
$('rematch-button').addEventListener('click',()=>{if(mode==='local')startGame('local',createMatch(state.players.map(p=>p.characterId)));else{send({type:'rematch'});$('rematch-button').disabled=true;$('rematch-button').textContent='AGUARDANDO ADVERSÁRIO...';}});

const mapping=[{KeyA:'left',KeyD:'right',KeyW:'jump',KeyF:'attack',KeyG:'special',KeyS:'block',ShiftLeft:'dash'},{ArrowLeft:'left',ArrowRight:'right',ArrowUp:'jump',KeyK:'attack',KeyL:'special',ArrowDown:'block',ShiftRight:'dash'}];
function updateInputs(){
  for(let i=0;i<2;i++){for(const field of ['left','right','jump','attack','special','block','dash'])inputs[i][field]=false;for(const [code,field]of Object.entries(mapping[i]))if(keys.has(code))inputs[i][field]=true;}
  for(const field of touch)inputs[0][field]=true;
  if(mode==='online')send({type:'input',input:inputs[0]});
}
function clearInputs(){keys.clear();touch.clear();updateInputs();document.querySelectorAll('.touch-controls .pressed').forEach(b=>b.classList.remove('pressed'));}
window.addEventListener('keydown',e=>{if(!running||e.target.matches('input,textarea')||document.querySelector('dialog[open]'))return;if([...Object.keys(mapping[0]),...Object.keys(mapping[1])].includes(e.code)){e.preventDefault();if(finishingShot)return;keys.add(e.code);updateInputs();}});
window.addEventListener('keyup',e=>{if(keys.delete(e.code)){if(running)e.preventDefault();updateInputs();}});
window.addEventListener('blur',clearInputs);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInputs();});
document.querySelectorAll('[data-input]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{e.preventDefault();if(finishingShot)return;button.setPointerCapture(e.pointerId);touch.add(button.dataset.input);button.classList.add('pressed');updateInputs();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{touch.delete(button.dataset.input);button.classList.remove('pressed');updateInputs();});
});

function frame(now){
  if(!running||!state)return;
  const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
  if(mode==='local'){stepMatch(state,inputs,dt);enqueueEvents(state.events);}
  else if(now-heartbeat>50){send({type:'input',input:inputs[0]});heartbeat=now;}
  processEvents();renderGame(now/1000,dt);
  animationFrame=requestAnimationFrame(frame);
}
function enqueueEvents(events=[]){
  for(const event of events){
    if(event.id<=lastEvent)continue;
    lastEvent=event.id;
    if((event.type==='hit'||event.type==='block')&&event.damage>0)spawnBlood(event);
    eventQueue.push(event);
  }
  if(eventQueue.length>256)eventQueue.splice(0,eventQueue.length-256);
}
function announce(message,color='#ad8bfa',seconds=1.7){
  $('arena-event').textContent=message;$('arena-event').style.borderColor=color;
  $('arena-event').hidden=false;bannerUntil=performance.now()+seconds*1000;
}
// Decals are painted once into a fixed-size layer. They never fade or get
// evicted during a match, regardless of the number of hits or render frames.
function stampBlood(x,y,size,color){
  bloodCtx.fillStyle=color;
  bloodCtx.fillRect(Math.round(x),Math.round(y),Math.ceil(size*1.7),Math.ceil(size*.55));
  bloodCtx.fillRect(Math.round(x-size*.4),Math.round(y+size*.3),Math.ceil(size*.8),2);
}
function spawnBlood(event){
  let seed=((event.id*2654435761)^(Math.round(event.x*11)*1597334677))>>>0;
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  const special=!!event.special,blocked=event.type==='block';
  const count=special?104:blocked?12:26;
  const direction=event.direction||state.players[event.attacker].facing;
  const x=70+event.x*1.06,y=500-event.y*.62-112;
  for(let n=0;n<count;n++){
    const color=['#e94b64','#c92b47','#9b1e3a'][n%3];
    const size=(special?3:2)+random()*(special?4:2);
    const vx=direction*(50+random()*(special?260:150))+(random()-.5)*(special?160:80);
    const vy=-30-random()*(special?290:160);
    const flight=(-vy+Math.sqrt(vy*vy+2*850*Math.max(0,499-y)))/850;
    const floorX=Math.max(20,Math.min(1170,x+vx*flight));
    const floorY=497+random()*(special?36:24);
    particles.push({x,y:y+(random()-.5)*20,vx,vy,life:2.7,max:2.7,color,size,blood:true,gravity:850,floorX,floorY});
    stampBlood(floorX,floorY,size,color);
  }
  // Only airborne decoration is bounded; the painted ring layer is never erased.
  if(particles.length>900)particles.splice(0,particles.length-900);
}
function processEvents(){
  for(const event of eventQueue.splice(0)){
    if(event.type==='hit'||event.type==='block'){
      const source=state.players[event.attacker], c=character(source.characterId);
      const x=70+event.x*1.06,y=500-event.y*.62-115;
      for(let n=0;n<10;n++)particles.push({x,y,vx:(Math.random()-.5)*300,vy:(Math.random()-.6)*240,life:.4,max:.4,color:event.type==='block'?'#d9ebff':c.color,size:3+Math.random()*4});
      particles.push({x,y:y-25,vx:0,vy:-70,life:.8,max:.8,text:event.type==='block'?'DEFESA':`−${event.damage}`,color:c.color});
      if(event.type==='hit'){
        shake=Math.max(shake,event.knockdown?6:2);
        if(event.knockdown)announce('VOADORA! ADVERSÁRIO AO CHÃO',c.color,1.1);
      }
      beep('hit');
    }else if(event.type==='pickup'){
      const item=ITEM_TYPES.find(item=>item.id===event.itemType);
      if(!item)continue;
      const p=state.players[event.player],x=70+(event.x??p.x)*1.06,y=430-(event.y??p.y)*.62;
      for(let n=0;n<18;n++)particles.push({x,y,vx:(Math.random()-.5)*230,vy:-40-Math.random()*170,life:.65,max:.65,color:item.color,size:3});
      particles.push({x,y:y-45,vx:0,vy:-40,life:1.3,max:1.3,text:item.label.toUpperCase(),color:item.color});
      announce(`${character(p.characterId).name.toUpperCase()} · ${item.label.toUpperCase()}`,item.color,1.8);beep('select');
    }else if(event.type==='drop'){
      announce('SUPRIMENTOS CHEGANDO! PEGUE SEU BÔNUS','#d0f387',1.4);
    }else if(event.type==='ko'){
      const name=character(state.players[event.attacker].characterId).name.toUpperCase();
      announce(`NOCAUTE! +1 PARA ${name} · A LUTA CONTINUA`,'#f7b569',2.1);shake=8;beep('finish');
    }else if(event.type==='special')beep('special');
    else if(event.type==='finish')beep('finish');
  }
}
function drawParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];p.life-=dt;p.vy+=(p.gravity||0)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(p.blood&&p.y>=498){
      // Its permanent decal was already painted in event order on contact.
      particles.splice(i,1);continue;
    }
    if(p.life<=0){particles.splice(i,1);continue;}
    ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;
    if(p.text){ctx.font='bold 18px monospace';ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y);}
    else ctx.fillRect(p.x,p.y,p.size,p.size);
    ctx.globalAlpha=1;
  }
}
function renderBuffs(player,index){
  const chips=ITEM_TYPES.filter(item=>player.buffs?.[item.id]>0).map(item=>`<span class="buff-chip" style="color:${item.color}">${item.short} ${Math.ceil(player.buffs[item.id])}s</span>`);
  if(finishingShot&&player.hp<=0)chips.unshift('<span class="buff-chip neutral">FINALIZAÇÃO EM ANDAMENTO</span>');
  else if(player.respawnTimer>0)chips.unshift(`<span class="buff-chip neutral">VOLTA EM ${Math.ceil(player.respawnTimer)}s</span>`);
  else if(player.downTimer>0)chips.unshift('<span class="buff-chip neutral">AO CHÃO</span>');
  else if(player.invulnerableTimer>0)chips.unshift('<span class="buff-chip neutral">PROTEGIDO</span>');
  else if(player.dashCooldown>0)chips.push(`<span class="buff-chip neutral">DASH ${player.dashCooldown.toFixed(1)}s</span>`);
  const html=chips.join(''),element=$(`p${index+1}-buffs`);
  if(element.innerHTML!==html)element.innerHTML=html;
}
function syncFinisher(time){
  const scene=state.finisher;
  // The shared snapshot also survives a missed WebSocket event. Its engine
  // timestamp aligns both clients; a local clock completes a final-tick KO
  // even after the authoritative match has stopped ticking.
  if(scene&&scene.id!==lastFinisherId){
    lastFinisherId=scene.id;
    const elapsed=Math.max(0,state.elapsed-scene.at);
    if(elapsed<FINISHER_DURATION){
      finishingShot={started:time-elapsed,at:scene.at,attacker:scene.source,target:scene.target,color:character(scene.source.characterId).color,seed:scene.id,impactsPlayed:new Set(FINISHER_IMPACT_TIMES.flatMap((at,index)=>elapsed>=at?[index]:[])),stage:null};
      clearInputs();shake=0;
      $('finisher-name').textContent=character(scene.source.characterId).name;
      $('finisher-special').textContent='AGARRÃO · '+character(scene.source.characterId).special;
      $('finisher-caption').style.setProperty('--finisher-color','#ff6577');
      $('finisher-caption').hidden=false;canvas.parentElement.classList.add('finishing');
    }
  }
  if(!finishingShot)return -1;
  const simulatedAge=Math.max(0,state.elapsed-finishingShot.at);
  // Follow the paused simulation in local play, even after a slow frame or a
  // background tab. Online interpolation leads the latest server tick by at
  // most one tick. Only a finished round needs the independent wall clock.
  const age=state.phase==='finished'?Math.max(time-finishingShot.started,simulatedAge)
    :mode==='local'?simulatedAge:Math.min(Math.max(time-finishingShot.started,simulatedAge),simulatedAge+1/30);
  if(age>=FINISHER_DURATION){
    finishingShot=null;$('finisher-caption').hidden=true;canvas.parentElement.classList.remove('finishing','finishing-blackout');
    return -1;
  }
  for(let index=0;index<FINISHER_IMPACT_TIMES.length;index++){
    const at=FINISHER_IMPACT_TIMES[index];
    if(age>=at&&!finishingShot.impactsPlayed.has(index)){
      finishingShot.impactsPlayed.add(index);
      // Skip old beats after a background-tab stall rather than playing a
      // burst of delayed sounds when the player returns to the window.
      if(age-at<.35)beep('fatality',.85+index*.15);
    }
  }
  const stage=getFinisherStage(age);
  if(stage!==finishingShot.stage){
    finishingShot.stage=stage;
    canvas.parentElement.classList.toggle('finishing-blackout',stage==='blackout');
    $('finisher-special').textContent=stage==='victory'?'NOCAUTE · +1 KO':stage==='silhouette'?'IMPACTO DECISIVO':'AGARRÃO · '+character(finishingShot.attacker.characterId).special;
  }
  return Math.max(0,age);
}
function renderGame(time,dt){
  const finisherAge=syncFinisher(time);
  ctx.imageSmoothingEnabled=false;ctx.fillStyle='#1b1525';ctx.fillRect(0,0,1200,600);ctx.save();
  if(shake>0){if(!reducedMotion.matches&&finisherAge<0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake=Math.max(0,shake-dt*24);}
  if(finisherAge<0){drawArena(ctx,1200,600,time);ctx.drawImage(bloodLayer,0,0);drawItems(ctx,state.items||[],time);}
  state.players.forEach((p,index)=>{
    const visual=renderPositions[index]||{x:p.x,y:p.y},blend=mode==='online'?1-Math.exp(-28*dt):1;
    if(p.respawnTimer<=0&&Math.abs(p.x-visual.x)<260){visual.x+=(p.x-visual.x)*blend;visual.y+=(p.y-visual.y)*blend;}
    else{visual.x=p.x;visual.y=p.y;}
    renderPositions[index]=visual;
    if(finisherAge<0){
      ctx.fillStyle='#09061088';ctx.beginPath();ctx.ellipse(70+visual.x*1.06,501,55-Math.min(visual.y*.07,18),10,0,0,Math.PI*2);ctx.fill();
      drawFighter(ctx,{...p,y:visual.y},70+visual.x*1.06,500,1.9,time);
    }
    $(`p${index+1}-health`).style.width=`${p.hp}%`;$(`p${index+1}-energy`).style.width=`${p.energy}%`;
    $(`p${index+1}-score`).textContent=state.scores?.[index]||0;renderBuffs(p,index);
  });
  // Age existing particles during the cut-in without painting over its art.
  if(finisherAge<0)drawParticles(dt);
  else for(let i=particles.length-1;i>=0;i--){particles[i].life-=dt;if(particles[i].life<=0)particles.splice(i,1);}
  ctx.restore();
  if(finisherAge>=0)drawFinisher(ctx,finishingShot,finisherAge,reducedMotion.matches);
  const seconds=Math.max(0,Math.ceil(state.timeLeft??ROUND_DURATION));
  $('timer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  $('game-announcement').textContent=state.phase==='countdown'?Math.max(1,Math.ceil(state.countdown)):state.phase==='playing'&&state.elapsed<3.65?'LUTEM!':'';
  $('drop-status').textContent=state.phase==='finished'?'FIM DE PARTIDA':state.phase==='countdown'?'150s · CADA NOCAUTE VALE +1':`PRÓXIMO DROP · ${Math.max(0,Math.ceil(state.dropTimer??4))}s`;
  if(performance.now()>bannerUntil)$('arena-event').hidden=true;
  if(state.phase==='finished'&&finisherAge<0&&$('game-result').hidden){
    $('game-result').hidden=false;
    const draw=state.winner==='draw',scores=state.scores||[0,0];
    $('result-kicker').textContent=`2MIN30 COMPLETOS · ${scores[0]} × ${scores[1]} NOCAUTES`;
    $('result-title').textContent=draw?'EMPATE NA ARENA!':`${character(state.players[state.winner].characterId).name.toUpperCase()} VENCEU!`;
    $('result-description').textContent=draw?'Nocautes e vida empatados. Hora de uma revanche!':scores[0]===scores[1]?'Nocautes empatados: a vida restante decidiu a vitória.':`Jogador ${state.winner+1} venceu com mais nocautes. Aceita uma revanche?`;
  }
}

async function checkServer(){try{const response=await fetch('/api/health');if(!response.ok)throw new Error();const data=await response.json();if(!data.ok)throw new Error();$('server-status').innerHTML='<i></i> ARENA ONLINE';$('server-status').classList.remove('offline');}catch{$('server-status').innerHTML='<i></i> MODO LOCAL';$('server-status').classList.add('offline');}}
$('item-guide').innerHTML=ITEM_TYPES.map(item=>`<span class="item-legend" style="--item-color:${item.color}" title="${item.description}"><b>${({heal:'+',speed:'ϟ',shield:'◇',energy:'▰',rage:'✦',jump:'↑'})[item.id]}</b>${item.short}</span>`).join('');
renderRoster();checkServer();online.restore().catch(error=>toast(error.message));setInterval(checkServer,30000);
