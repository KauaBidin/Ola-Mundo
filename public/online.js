// Browser transport for both the self-hosted WebSocket server and Vercel's
// short-lived HTTP functions. The game receives the same room/state messages.
const INPUT_FIELDS=['left','right','jump','attack','special','block','dash'];
const EDGE_FIELDS=['jump','attack','special','dash'];
const STORAGE_KEY='apane.online.v1';
const TERMINAL=new Set(['ROOM_NOT_FOUND','INVALID_SESSION','SESSION_EXPIRED']);
const emptyInput=()=>Object.fromEntries(INPUT_FIELDS.map(key=>[key,false]));
const validSession=value=>value&&/^[A-Z2-9]{6}$/.test(value.code)&&/^[a-f0-9]{64}$/i.test(value.token)&&Number.isSafeInteger(value.seq)&&value.seq>=0;
class OnlineError extends Error {
  constructor(message,code='NETWORK_ERROR',status=0){super(message);this.code=code;this.status=status;}
}
const cancelled=()=>new OnlineError('Operação cancelada.','CANCELLED');
const retryable=error=>!error.status||error.status>=500||error.status===429||error.code==='CONFLICT';

export class OnlineTransport {
  /** Callbacks: onMessage(room/state/error/opponent_left),
   * onStatus('connected'|'reconnecting'), onExpired(message).
   * Optional fetch/WebSocket/storage/baseUrl/timers allow deterministic tests.
   */
  constructor(options={}){
    this.onMessage=options.onMessage||(()=>{});this.onStatus=options.onStatus||(()=>{});this.onExpired=options.onExpired||(()=>{});
    this.fetch=options.fetch||globalThis.fetch.bind(globalThis);this.WebSocket=options.WebSocket||globalThis.WebSocket;
    try{this.storage=options.storage===undefined?globalThis.sessionStorage:options.storage;}catch{this.storage=null;}
    this.baseUrl=options.baseUrl||globalThis.location?.origin||'http://localhost';
    this.setTimeout=options.setTimeout||globalThis.setTimeout.bind(globalThis);this.clearTimeout=options.clearTimeout||globalThis.clearTimeout.bind(globalThis);
    this._mode=null;this._session=null;this._generation=0;this._timer=null;this._flight=null;this._controllers=new Set();this._status=null;
    this._input=emptyInput();this._edges=Object.fromEntries(EDGE_FIELDS.map(key=>[key,0]));this._edgeVersion=0;
    this._retry=0;this._command=null;this._resumeNeeded=false;this._roomStatus='waiting';this._roundId=null;this._afterEvent=0;this._leftRound=null;
    this._lastPostAt=0;this._ws=null;this._wsConnecting=null;this._wsPending=null;this._requesting=false;this._pendingCredentials=null;
  }
  _statusChanged(status){if(this._status!==status){this._status=status;this.onStatus(status);}}
  _save(){try{if(this._session)this.storage?.setItem(STORAGE_KEY,JSON.stringify(this._session));else this.storage?.removeItem(STORAGE_KEY);}catch{/* Storage is optional during the current visit. */}}
  _clearTimer(){if(this._timer!==null){this.clearTimeout(this._timer);this._timer=null;}}
  _schedule(delay=100){this._clearTimer();if(!this._session||this._mode!=='http')return;const generation=this._generation;this._timer=this.setTimeout(()=>{this._timer=null;if(generation===this._generation)this._pump();},delay);}
  async _fetch(url,init={},generation=this._generation){
    const controller=new AbortController();this._controllers.add(controller);
    const timeout=this.setTimeout(()=>controller.abort(),6500);
    try{
      const response=await this.fetch(new URL(url,this.baseUrl),{...init,signal:controller.signal,cache:'no-store',credentials:'same-origin'});
      let data;try{data=await response.json();}catch{throw new OnlineError('Não foi possível ler a resposta da arena.');}
      if(generation!==this._generation)throw cancelled();
      if(!response.ok){const error=data?.error;throw new OnlineError(String(error?.message||data?.message||'A arena está indisponível. Tente novamente.').slice(0,300),error?.code||'SERVER_ERROR',response.status);}
      return data;
    }catch(error){if(generation!==this._generation)throw cancelled();if(error instanceof OnlineError)throw error;throw new OnlineError('A conexão com a arena caiu. Tentando reconectar.');}
    finally{this.clearTimeout(timeout);this._controllers.delete(controller);}
  }
  async check(){
    const health=await this._fetch('/api/health');
    if(!health?.ok)throw new OnlineError(health?.message||'A arena ainda não está disponível.','NOT_CONFIGURED',503);
    this._mode=health.transport==='http'?'http':'ws';return health;
  }
  async _post(body,generation=this._generation){return this._fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},generation);}
  _cleanup(session){
    if(!session?.token)return;
    const controller=new AbortController(),timeout=this.setTimeout(()=>controller.abort(),2000);
    this.fetch(new URL('/api/game',this.baseUrl),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'leave',code:session.code,token:session.token}),signal:controller.signal,keepalive:true,credentials:'same-origin'}).catch(()=>{}).finally(()=>this.clearTimeout(timeout));
  }
  _accept(data){
    if(data.session&&this._session&&data.session.token===this._session.token){this._session.code=data.session.code;this._save();}
    for(const message of data.messages||[]){
      if(!message||typeof message!=='object')continue;
      if(message.roundId!==undefined&&message.roundId!==this._roundId){this._roundId=message.roundId;this._afterEvent=0;this._command=null;this._input=emptyInput();this._edges=Object.fromEntries(EDGE_FIELDS.map(key=>[key,0]));}
      if(message.type==='room')this._roomStatus=message.status;
      if(message.type==='opponent_left'){
        if(this._leftRound===message.roundId)continue;
        this._leftRound=message.roundId;
      }
      this.onMessage(message);
      if(message.type==='state')for(const event of message.state?.events||[])if(Number.isSafeInteger(event.id))this._afterEvent=Math.max(this._afterEvent,event.id);
    }
  }
  async requestRoom(type,characterId,code){
    if(!['create','join'].includes(type))throw new OnlineError('Pedido de sala inválido.','INVALID_REQUEST',400);
    if(this._requesting)throw new OnlineError('Aguarde a resposta da sala.');
    if(this._session||this._wsPending)throw new OnlineError('Saia da sala atual antes de entrar em outra.');
    this._requesting=true;const generation=++this._generation;this._status=null;
    try{
      if(!this._mode)await this.check();
      if(generation!==this._generation)throw cancelled();
      if(this._mode==='ws')return await this._requestWs(type,characterId,code,generation);
      const bytes=new Uint8Array(32);globalThis.crypto.getRandomValues(bytes);
      const token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
      const credentials={token,code:type==='join'?String(code||'').trim().toUpperCase():undefined,seq:0};
      this._pendingCredentials=credentials;
      const body={type,characterId,code:credentials.code,token};let data;
      for(let attempt=0;;attempt++){
        try{data=await this._post(body,generation);break;}
        catch(error){if(error.code==='CANCELLED'||!retryable(error)||attempt>=2)throw error;this._statusChanged('reconnecting');await new Promise(resolve=>this.setTimeout(resolve,250*2**attempt));if(generation!==this._generation)throw cancelled();}
      }
      if(!data.session||!validSession({...data.session,seq:0}))throw new OnlineError('A arena enviou uma sala inválida.');
      this._session={...data.session,seq:0};this._pendingCredentials=null;this._save();this._retry=0;this._statusChanged('connected');
      this._accept(data);this._schedule(this._interval(data));
      const room=(data.messages||[]).find(message=>message.type==='room');if(!room)throw new OnlineError('A arena não confirmou a sala.');return room;
    }catch(error){
      if(this._pendingCredentials){this._cleanup(this._pendingCredentials);this._pendingCredentials=null;}
      throw error;
    }finally{this._requesting=false;}
  }
  _interval(data){return this._roomStatus==='playing'?Math.max(80,Math.min(500,Number(data.pollAfterMs)||100)):750;}
  send(message){
    if(this._mode==='ws'){if(this._ws?.readyState===1)this._ws.send(JSON.stringify(message));return;}
    if(message?.type==='input'){
      const before=this._input;this._input=Object.fromEntries(INPUT_FIELDS.map(key=>[key,message.input?.[key]===true]));
      for(const key of EDGE_FIELDS)if(this._input[key]&&!before[key])this._edges[key]=++this._edgeVersion;
      const changed=INPUT_FIELDS.some(key=>before[key]!==this._input[key]);
      if(changed&&this._session&&!this._flight)this._schedule(Math.max(0,100-(Date.now()-this._lastPostAt)));
    }else if(message?.type==='rematch'&&this._session){this._command='rematch';if(!this._flight)this._schedule(0);}
    else if(message?.type==='leave')this.leave();
  }
  async _pump(){
    if(this._flight||!this._session||this._mode!=='http')return;
    const generation=this._generation,session=this._session,type=this._resumeNeeded?'resume':this._command||'sync';
    const edges={...this._edges},input={...this._input};for(const key of EDGE_FIELDS)if(edges[key])input[key]=true;
    const seq=++session.seq;this._save();
    const body={type,code:session.code,token:session.token,seq,input,roundId:this._roundId,afterEvent:this._afterEvent};
    this._lastPostAt=Date.now();
    const flight=this._post(body,generation);this._flight=flight;
    try{
      const data=await flight;if(generation!==this._generation)return;
      this._resumeNeeded=false;if(type===this._command)this._command=null;
      if(type==='sync')for(const key of EDGE_FIELDS)if(this._edges[key]===edges[key])this._edges[key]=0;
      this._retry=0;this._statusChanged('connected');this._accept(data);this._schedule(this._command?0:Math.max(0,this._interval(data)-(Date.now()-this._lastPostAt)));
    }catch(error){
      if(generation!==this._generation||error.code==='CANCELLED')return;
      if(TERMINAL.has(error.code)){this._expire(error.message);return;}
      if(!retryable(error)){if(type===this._command)this._command=null;this.onMessage({type:'error',message:error.message});this._schedule(750);return;}
      this._resumeNeeded=true;this._statusChanged('reconnecting');this._schedule(Math.min(3000,250*2**Math.min(this._retry++,4)));
    }finally{if(this._flight===flight)this._flight=null;}
  }
  async restore(){
    if(this._session||this._requesting)return false;let saved;
    try{saved=JSON.parse(this.storage?.getItem(STORAGE_KEY)||'null');}catch{this._save();return false;}
    if(!validSession(saved)){this._save();return false;}
    const generation=++this._generation;
    // Keep the saved credential if the health check itself fails temporarily.
    try{if(!this._mode)await this.check();}catch(error){if(generation!==this._generation)return false;this._mode='http';this._session={code:saved.code,token:saved.token,seq:saved.seq};this._resumeNeeded=true;this._statusChanged('reconnecting');this._schedule(500);return true;}
    if(generation!==this._generation)return false;
    if(this._mode!=='http'){this._save();return false;}
    this._session={code:saved.code,token:saved.token,seq:saved.seq};this._resumeNeeded=true;this._input=emptyInput();this._edges=Object.fromEntries(EDGE_FIELDS.map(key=>[key,0]));
    await this._pump();return !!this._session;
  }
  _expire(message){
    ++this._generation;this._clearTimer();this._session=null;this._pendingCredentials=null;this._command=null;this._resumeNeeded=false;this._input=emptyInput();this._edges=Object.fromEntries(EDGE_FIELDS.map(key=>[key,0]));this._save();
    this.onExpired(message||'A sala expirou. Crie ou entre em uma sala novamente.');
  }
  leave(){
    const credentials=this._session||this._pendingCredentials;const ws=this._ws;
    ++this._generation;this._clearTimer();this._session=null;this._pendingCredentials=null;this._command=null;this._resumeNeeded=false;this._roundId=null;this._afterEvent=0;this._leftRound=null;this._input=emptyInput();this._edges=Object.fromEntries(EDGE_FIELDS.map(key=>[key,0]));this._save();
    for(const controller of this._controllers)controller.abort();this._controllers.clear();
    this._flight=null;this._ws=null;this._wsConnecting=null;
    if(this._wsPending){this._wsPending.reject(cancelled());this._wsPending=null;}
    if(ws){if(ws.readyState===1)ws.send(JSON.stringify({type:'leave'}));ws.close();}
    if(this._mode==='http')this._cleanup(credentials);
  }
  async _connectWs(generation){
    if(this._ws?.readyState===1)return this._ws;
    if(this._wsConnecting)return this._wsConnecting;
    this._wsConnecting=new Promise((resolve,reject)=>{
      const url=new URL('/ws',this.baseUrl);url.protocol=url.protocol==='https:'?'wss:':'ws:';
      const ws=new this.WebSocket(url.href);this._ws=ws;
      const timeout=this.setTimeout(()=>{ws.close();reject(new OnlineError('O servidor demorou a responder. Tente novamente.'));},7000);
      ws.addEventListener('open',()=>{this.clearTimeout(timeout);this._wsConnecting=null;if(generation!==this._generation){ws.close();reject(cancelled());return;}this._statusChanged('connected');resolve(ws);});
      ws.addEventListener('message',event=>{
        if(this._ws!==ws)return;let message;try{message=JSON.parse(event.data);}catch{return;}
        if(message.type==='room'&&this._wsPending){const pending=this._wsPending;this._wsPending=null;pending.resolve(message);}
        else if(message.type==='error'&&this._wsPending){const pending=this._wsPending;this._wsPending=null;pending.reject(new OnlineError(message.message));return;}
        this.onMessage(message);
      });
      ws.addEventListener('error',()=>{this.clearTimeout(timeout);this._wsConnecting=null;reject(new OnlineError('Não foi possível conectar à arena. O modo local continua disponível.'));});
      ws.addEventListener('close',()=>{this.clearTimeout(timeout);this._wsConnecting=null;if(this._ws!==ws)return;this._ws=null;reject(new OnlineError('Conexão encerrada.'));if(this._wsPending){this._wsPending.reject(new OnlineError('Conexão encerrada. Tente novamente.'));this._wsPending=null;}this.onExpired('A conexão com a sala foi encerrada. Crie ou entre em uma sala novamente.');});
    });return this._wsConnecting;
  }
  async _requestWs(type,characterId,code,generation){
    const ws=await this._connectWs(generation);
    return new Promise((resolve,reject)=>{
      const timer=this.setTimeout(()=>{if(this._wsPending){this._wsPending=null;ws.send(JSON.stringify({type:'leave'}));reject(new OnlineError('Não recebemos resposta da sala. Tente novamente.'));}},7000);
      this._wsPending={resolve:message=>{this.clearTimeout(timer);resolve(message);},reject:error=>{this.clearTimeout(timer);reject(error);}};
      ws.send(JSON.stringify({type,characterId,code}));
    });
  }
}
