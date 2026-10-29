import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { OnlineTransport } from '../public/online.js';
import { createRoomService } from '../lib/room-service.js';
import { MemoryRoomStore } from '../lib/room-store.js';
import { createGameServer } from '../server.js';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,ms=2500){const start=Date.now();while(!check()){if(Date.now()-start>ms)throw Error('Timed out');await delay(10);}}
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
function fixture(){
  const store=new MemoryRoomStore(),service=createRoomService({store}),calls=[],statuses=[],messages=[];let inFlight=0,maxFlight=0,fail=false;
  const fetchImpl=async(url,options={})=>{
    if(new URL(url).pathname==='/api/health')return Response.json({ok:true,transport:'http'});
    const body=JSON.parse(options.body);calls.push(body);inFlight++;maxFlight=Math.max(maxFlight,inFlight);
    try{await delay(4);if(fail&&body.type==='sync'){fail=false;throw Error('network offline');}return Response.json(await service.handle(body));}
    catch(error){if(!error.status)throw error;return Response.json({error:{code:error.code,message:error.message}},{status:error.status});}
    finally{inFlight--;}
  };
  const client=new OnlineTransport({fetch:fetchImpl,storage:storage(),baseUrl:'https://arena.test',onMessage:m=>messages.push(m),onStatus:s=>statuses.push(s)});
  return {client,calls,statuses,messages,fail:()=>{fail=true;},maxFlight:()=>maxFlight};
}

test('HTTP transport latches quick button taps, serializes polls and does not poll on unchanged heartbeat input',async t=>{
  const f=fixture();t.after(()=>f.client.leave());await f.client.requestRoom('create','lula');
  f.client.send({type:'input',input:{attack:true}});f.client.send({type:'input',input:{attack:false}});
  await until(()=>f.calls.some(c=>c.type==='sync'&&c.input.attack));
  for(let i=0;i<20;i++)f.client.send({type:'input',input:{}});
  await until(()=>f.calls.filter(c=>c.type==='sync').length>=2);
  const syncs=f.calls.filter(c=>c.type==='sync');assert.equal(syncs[0].input.attack,true);assert.equal(syncs.at(-1).input.attack,false);
  assert.equal(f.maxFlight(),1);assert(syncs.length<8,'unchanged inputs do not create a heartbeat request storm');
  assert(syncs[1].seq>syncs[0].seq);
});

test('a transient HTTP failure resumes the same private session instead of joining again',async t=>{
  const f=fixture();t.after(()=>f.client.leave());const room=await f.client.requestRoom('create','lula');const bearer=f.calls[0].token;
  f.fail();f.client.send({type:'input',input:{right:true}});await until(()=>f.calls.some(c=>c.type==='resume'));
  await until(()=>f.statuses.at(-1)==='connected'&&f.calls.some(c=>c.type==='resume'));
  assert(f.statuses.includes('reconnecting'));assert.equal(f.calls.filter(c=>c.type==='create').length,1);
  const resumed=f.calls.find(c=>c.type==='resume');assert.equal(resumed.token,bearer);assert.equal(resumed.code,room.code);
  assert.equal(f.messages.filter(m=>m.type==='room').at(-1).playerIndex,0);
});

test('cancelled room creation cannot deliver a late room or restart polling',async()=>{
  let release;const gate=new Promise(r=>{release=r});let posts=0;const messages=[];
  const client=new OnlineTransport({storage:storage(),baseUrl:'https://arena.test',onMessage:m=>messages.push(m),fetch:async(url,options)=>{
    if(new URL(url).pathname==='/api/health')return Response.json({ok:true,transport:'http'});
    const body=JSON.parse(options.body);posts++;if(body.type==='leave')return Response.json({messages:[{type:'left'}]});
    await gate;return Response.json({session:{code:'ABCDEF',token:body.token},messages:[{type:'room',code:'ABCDEF',playerIndex:0,status:'waiting',players:[]}],pollAfterMs:100});
  }});
  const creating=client.requestRoom('create','lula');await until(()=>posts===1);client.leave();release();await assert.rejects(creating,/cancelad/i);await delay(150);assert.deepEqual(messages,[]);assert.equal(client._session,null);assert.equal(client._timer,null);
});

test('the original WebSocket transport can retry an invalid join on its existing socket',async t=>{
  const app=createGameServer({port:0,host:'127.0.0.1'});t.after(()=>app.close());const {port}=await app.ready;const baseUrl=`http://127.0.0.1:${port}`;
  const alice=new OnlineTransport({baseUrl,WebSocket,storage:storage()}),bob=new OnlineTransport({baseUrl,WebSocket,storage:storage()});t.after(()=>{alice.leave();bob.leave()});
  const room=await alice.requestRoom('create','lula');await assert.rejects(bob.requestRoom('join','dilma','ZZZZZZ'),/não encontrada/);
  const joined=await bob.requestRoom('join','dilma',room.code);assert.equal(joined.playerIndex,1);assert.equal(joined.players.length,2);
});
