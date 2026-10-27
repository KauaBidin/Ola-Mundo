import { CHARACTERS, createMatch, stepMatch } from './engine.js';
import { portraitSVG, drawFighter, drawArena } from './art.js';

const $=id=>document.getElementById(id);
const character=id=>CHARACTERS.find(c=>c.id===id)||CHARACTERS[0];
let selected='emerzon', opponent='douglas', socket=null, connecting=null, room=null;
let state=null, mode=null, running=false, lastFrame=0, heartbeat=0, lastEvent=0;
let sound=false, audio=null, toastTimer, pendingRequest=null;
const inputs=[{},{}], keys=new Set(), touch=new Set(), particles=[];
const canvas=$('arena-canvas'), ctx=canvas.getContext('2d');
const icons={sound:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>',muted:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/></svg>'};
const classes=['SUPORTE','LIDERANÇA','ESTRATÉGIA','AUTOMAÇÃO'];

function renderRoster(){
  $('character-grid').innerHTML=CHARACTERS.map((c,i)=>`<button class="character-card ${selected===c.id?'selected':''}" data-character="${c.id}" style="--accent:${c.color}" aria-pressed="${selected===c.id}" aria-label="Selecionar ${c.name}, ${c.role}"><div class="card-art">${portraitSVG(c)}<span class="card-index">P.${String(i+1).padStart(2,'0')}</span><span class="character-class">${classes[i]}</span><span class="selected-label">✓ SELECIONADO <span>PLAYER 01</span></span></div><div class="card-info"><div class="card-name-row"><h3>${c.name.toUpperCase()}</h3><span class="card-number">↗</span></div><p class="card-role">${c.role}</p><p class="card-description">${c.description}</p><div class="stats">${[['FORÇA','power'],['VELOC.','speed'],['DEFESA','defense']].map(([label,key])=>`<div class="stat"><span>${label}</span><div class="stat-bars" aria-label="${label}: ${c.stats[key]} de 5">${Array.from({length:5},(_,n)=>`<i class="${n<c.stats[key]?'filled':''}"></i>`).join('')}</div></div>`).join('')}</div><div class="card-special"><span class="special-symbol">ϟ</span><span>${c.special.toUpperCase()}</span></div></div></button>`).join('');
  document.querySelectorAll('[data-character]').forEach(button=>button.addEventListener('click',()=>{
    selected=button.dataset.character;
    document.querySelectorAll('[data-character]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',b===button?'true':'false');});
    beep('select');
  }));
}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function closeDialogs(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
function showDialog(id){closeDialogs();$(id).showModal();}
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom){if(dialog.id==='lobby-dialog')leaveRoom();dialog.close();}}}));
$('help-button')?.addEventListener('click',()=>showDialog('help-dialog'));
$('how-button').addEventListener('click',()=>showDialog('help-dialog'));
$('sound-button').innerHTML=icons.muted;
$('sound-button').addEventListener('click',()=>{sound=!sound;$('sound-button').innerHTML=icons[sound?'sound':'muted'];$('sound-button').setAttribute('aria-pressed',String(sound));$('sound-button').setAttribute('aria-label',sound?'Desativar efeitos sonoros':'Ativar efeitos sonoros');if(sound)beep('select');});
function beep(type){
  if(!sound)return;
  try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.type=type==='hit'?'sawtooth':'square';const f=type==='hit'?110:type==='special'?360:type==='finish'?440:640;o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(type==='hit'?40:f/2,audio.currentTime+.12);g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.14);o.start();o.stop(audio.currentTime+.15);}catch{/* Sound is optional; gameplay stays available. */}
}

// Same-origin WebSocket: rooms work on HTTP or HTTPS without a third-party service.
function connect(){
  if(socket?.readyState===WebSocket.OPEN)return Promise.resolve(socket);
  if(connecting)return connecting;
  connecting=new Promise((resolve,reject)=>{
    const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);socket=ws;
    const timeout=setTimeout(()=>{ws.close();reject(new Error('O servidor demorou a responder. Tente novamente.'));},7000);
    ws.addEventListener('open',()=>{clearTimeout(timeout);connecting=null;resolve(ws);});
    ws.addEventListener('message',e=>{try{receive(JSON.parse(e.data));}catch(error){console.warn('Não foi possível ler o estado da arena.',error);}});
    ws.addEventListener('error',()=>{clearTimeout(timeout);connecting=null;reject(new Error('Não foi possível conectar à arena. O modo local continua disponível.'));});
    ws.addEventListener('close',()=>{
      clearTimeout(timeout);connecting=null;
      if(socket!==ws)return;
      socket=null;
      if(pendingRequest){pendingRequest.reject(new Error('Conexão encerrada. Tente novamente.'));pendingRequest=null;}
      if(room||mode==='online'){room=null;stopGame();closeDialogs();toast('A conexão com a sala foi encerrada. Crie ou entre em uma sala novamente.');}
    });
  });return connecting;
}
function send(message){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(message));}
async function requestRoom(type,code){
  await connect();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{if(pendingRequest){pendingRequest=null;send({type:'leave'});reject(new Error('Não recebemos resposta da sala. Tente novamente.'));}},7000);
    pendingRequest={resolve:data=>{clearTimeout(timer);resolve(data);},reject:error=>{clearTimeout(timer);reject(error);}};
    send({type,characterId:selected,code});
  });
}
function receive(message){
  if(message.type==='error'){
    if(pendingRequest){pendingRequest.reject(new Error(message.message));pendingRequest=null;}else toast(message.message);return;
  }
  if(message.type==='room'){
    room=message;
    if(pendingRequest){pendingRequest.resolve(message);pendingRequest=null;}
    if(message.status==='waiting'){
      if(running)stopGame();
      renderLobby();
    } else if(message.status==='finished'&&mode==='online'){
      const me=message.players[message.playerIndex],other=message.players[1-message.playerIndex];
      $('rematch-button').disabled=!!me?.rematch;
      $('rematch-button').textContent=me?.rematch?'AGUARDANDO ADVERSÁRIO...':'REVANCHE ↻';
      if(other?.rematch&&!me?.rematch)$('result-description').textContent='Seu adversário pediu revanche. Aceita o desafio?';
    }
  }
  if(message.type==='state'){
    if(!room)return;
    if(!running||mode!=='online')startGame('online',message.state);
    if(state?.phase==='finished'&&message.state.phase==='countdown'){lastEvent=0;particles.length=0;$('game-result').hidden=true;$('rematch-button').disabled=false;$('rematch-button').innerHTML='REVANCHE <span>↻</span>';}
    state=message.state;
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
function leaveRoom(){send({type:'leave'});room=null;$('lobby-dialog').close();}
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
  $('opponent-grid').innerHTML=CHARACTERS.map(c=>`<button class="opponent-choice ${opponent===c.id?'selected':''}" data-opponent="${c.id}" aria-pressed="${opponent===c.id}" aria-label="Jogador 2: ${c.name}">${portraitSVG(c,true)}<span>${c.name}</span></button>`).join('');
  document.querySelectorAll('[data-opponent]').forEach(button=>button.addEventListener('click',()=>{opponent=button.dataset.opponent;renderOpponents();beep('select');}));
}
$('local-button').addEventListener('click',()=>{renderOpponents();showDialog('local-dialog');});
$('start-local').addEventListener('click',()=>startGame('local',createMatch([selected,opponent])));

function startGame(newMode,newState){
  closeDialogs();clearInputs();state=newState;mode=newMode;lastEvent=0;particles.length=0;
  $('game-screen').hidden=false;document.body.style.overflow='hidden';$('game-result').hidden=true;
  $('rematch-button').disabled=false;$('rematch-button').innerHTML='REVANCHE <span>↻</span>';
  $('game-mode').textContent=mode==='local'?'PVP LOCAL · 1 × 1':`PVP ONLINE · SALA ${room.code}`;
  $('you-tag').textContent=mode==='online'?` / VOCÊ É P${room.playerIndex+1}`:'';
  $('p2-controls').hidden=mode==='online';
  $('p1-name').textContent=character(state.players[0].characterId).name.toUpperCase();
  $('p2-name').textContent=character(state.players[1].characterId).name.toUpperCase();
  if(!running){running=true;lastFrame=performance.now();requestAnimationFrame(frame);}
  $('exit-game').focus({preventScroll:true});
}
function stopGame(){running=false;mode=null;state=null;clearInputs();$('game-screen').hidden=true;document.body.style.overflow='';$('game-result').hidden=true;$('game-announcement').textContent='';}
function exitGame(){if(mode==='online')leaveRoom();stopGame();$('local-button').focus({preventScroll:true});}
$('exit-game').addEventListener('click',exitGame);$('back-selection').addEventListener('click',exitGame);
$('rematch-button').addEventListener('click',()=>{if(mode==='local')startGame('local',createMatch(state.players.map(p=>p.characterId)));else{send({type:'rematch'});$('rematch-button').disabled=true;$('rematch-button').textContent='AGUARDANDO ADVERSÁRIO...';}});

const mapping=[{KeyA:'left',KeyD:'right',KeyW:'jump',KeyF:'attack',KeyG:'special',KeyS:'block'},{ArrowLeft:'left',ArrowRight:'right',ArrowUp:'jump',KeyK:'attack',KeyL:'special',ArrowDown:'block'}];
function updateInputs(){
  for(let i=0;i<2;i++){for(const field of ['left','right','jump','attack','special','block'])inputs[i][field]=false;for(const [code,field]of Object.entries(mapping[i]))if(keys.has(code))inputs[i][field]=true;}
  for(const field of touch)inputs[0][field]=true;
  if(mode==='online')send({type:'input',input:inputs[0]});
}
function clearInputs(){keys.clear();touch.clear();updateInputs();document.querySelectorAll('.touch-controls .pressed').forEach(b=>b.classList.remove('pressed'));}
window.addEventListener('keydown',e=>{if(!running||e.target.matches('input,textarea')||document.querySelector('dialog[open]'))return;if([...Object.keys(mapping[0]),...Object.keys(mapping[1])].includes(e.code)){e.preventDefault();keys.add(e.code);updateInputs();}});
window.addEventListener('keyup',e=>{if(keys.delete(e.code)){if(running)e.preventDefault();updateInputs();}});
window.addEventListener('blur',clearInputs);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInputs();});
document.querySelectorAll('[data-input]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touch.add(button.dataset.input);button.classList.add('pressed');updateInputs();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{touch.delete(button.dataset.input);button.classList.remove('pressed');updateInputs();});
});

function frame(now){
  if(!running||!state)return;
  const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
  if(mode==='local')stepMatch(state,inputs,dt);
  else if(now-heartbeat>50){send({type:'input',input:inputs[0]});heartbeat=now;}
  processEvents();renderGame(now/1000,dt);
  requestAnimationFrame(frame);
}
function processEvents(){
  for(const event of state.events||[]){
    if(event.id<=lastEvent)continue;lastEvent=event.id;
    if(event.type==='hit'||event.type==='block'){
      const c=character(state.players[event.attacker].characterId);
      const x=70+event.x*1.06,y=488-event.y*.62-125;
      for(let n=0;n<10;n++)particles.push({x,y,vx:(Math.random()-.5)*350,vy:(Math.random()-.6)*260,life:.4,max:.4,color:event.type==='block'?'#d9ebff':c.color,size:3+Math.random()*5});
      particles.push({x,y:y-25,vx:0,vy:-70,life:.7,max:.7,text:event.type==='block'?'DEFESA':`−${event.damage}`,color:c.color});
      beep('hit');
    }else if(event.type==='special')beep('special');else if(event.type==='finish')beep('finish');
  }
}
function renderGame(time,dt){
  ctx.imageSmoothingEnabled=false;drawArena(ctx,1200,600,time);
  for(const p of state.players){ctx.fillStyle='#09061088';ctx.beginPath();ctx.ellipse(70+p.x*1.06,501,55-Math.min(p.y*.07,18),10,0,0,Math.PI*2);ctx.fill();}
  state.players.forEach(p=>drawFighter(ctx,p,70+p.x*1.06,500,1.9,time));
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0){particles.splice(i,1);continue;}ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;if(p.text){ctx.font='bold 23px monospace';ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y);}else ctx.fillRect(p.x,p.y,p.size,p.size);ctx.globalAlpha=1;}
  for(let i=0;i<2;i++){const p=state.players[i];$(`p${i+1}-health`).style.width=`${p.hp}%`;$(`p${i+1}-energy`).style.width=`${p.energy}%`;}
  $('timer').textContent=String(Math.ceil(state.timeLeft)).padStart(2,'0');
  $('game-announcement').textContent=state.phase==='countdown'?Math.max(1,Math.ceil(state.countdown)):state.phase==='playing'&&state.elapsed<3.65?'LUTEM!':'';
  if(state.phase==='finished'&&$('game-result').hidden){
    $('game-result').hidden=false;
    const draw=state.winner==='draw';
    $('result-kicker').textContent=state.timeLeft<=0?'TEMPO ESGOTADO':'K.O. · FIM DE ROUND';
    $('result-title').textContent=draw?'EMPATE NA ARENA!':`${character(state.players[state.winner].characterId).name.toUpperCase()} VENCEU!`;
    $('result-description').textContent=draw?'Rivais à altura. Que tal tirar a prova?':mode==='online'?(state.winner===room?.playerIndex?'Vitória sua! Os chamados podem esperar.':'Seu adversário levou essa. A revanche é sua chance.'):`Jogador ${state.winner+1} levou essa. Quem vence a próxima?`;
  }
}

async function checkServer(){try{const response=await fetch('/api/health');if(!response.ok)throw new Error();const data=await response.json();if(!data.ok)throw new Error();$('server-status').innerHTML='<i></i> ARENA ONLINE';$('server-status').classList.remove('offline');}catch{$('server-status').innerHTML='<i></i> MODO LOCAL';$('server-status').classList.add('offline');}}
renderRoster();checkServer();setInterval(checkServer,30000);
