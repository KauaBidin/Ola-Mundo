import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createRoomService, roomCodeForToken } from '../lib/room-service.js';
import { MemoryRoomStore } from '../lib/room-store.js';
import { createGameHandler } from '../api/game.js';
import { createHealthHandler } from '../api/health.js';

const token = n => n.toString(16).padStart(64, '0');
const messageOf = (result, type) => result.messages.find(message => message.type === type);
function fixture() {
  let time = 10_000;
  const now = () => time;
  const store = new MemoryRoomStore({ now, ttlSeconds: 1800 });
  const first = createRoomService({ store, now });
  const second = createRoomService({ store, now });
  return { store, first, second, now, advance: ms => { time += ms; } };
}
async function pair(f = fixture()) {
  const created = await f.first.handle({ type: 'create', token: token(1), characterId: 'lula' });
  const code = created.session.code;
  const joined = await f.second.handle({ type: 'join', code, token: token(2), characterId: 'tun-tum-sarhur' });
  return { ...f, code, created, joined };
}
const sync = (service, code, playerToken, seq = 1, input = {}) => service.handle({ type: 'sync', code, token: playerToken, seq, input });
const statusIs = status => error => error.status === status;

async function request(handler, { method = 'POST', body = {}, origin = 'https://game.example', headers = {} } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const req = Readable.from([Buffer.from(raw)]);
  req.method = method;
  req.headers = { host: 'game.example', origin, 'content-type': 'application/json', ...headers };
  const output = { status: 200, headers: {}, body: '' };
  const res = {
    statusCode: 200,
    setHeader(name, value) { output.headers[name.toLowerCase()] = value; },
    getHeader(name) { return output.headers[name.toLowerCase()]; },
    writeHead(status, extra) { this.statusCode = status; if (extra) for (const [key, value] of Object.entries(extra)) this.setHeader(key, value); return this; },
    end(value = '') { output.status = this.statusCode; output.body += value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.end(JSON.stringify(value)); return this; },
  };
  await handler(req, res);
  if (output.body) output.json = JSON.parse(output.body);
  return output;
}

test('independent serverless instances share a room, retry-safe sessions and eleven-character engine', async () => {
  const f = await pair();
  assert.match(f.code, /^[A-Z2-9]{6}$/);
  assert.equal(f.code, roomCodeForToken(token(1)));
  assert.equal(messageOf(f.created, 'room').playerIndex, 0);
  assert.equal(messageOf(f.joined, 'room').playerIndex, 1);
  const initial = messageOf(f.joined, 'state');
  assert.equal(initial.state.phase, 'countdown');
  assert.equal(initial.state.timeLeft, 150);
  assert.deepEqual(initial.state.players.map(p => p.characterId), ['lula', 'tun-tum-sarhur']);
  const repeatedCreate = await f.second.handle({ type: 'create', token: token(1), characterId: 'douglas' });
  const repeatedJoin = await f.first.handle({ type: 'join', code: f.code, token: token(2), characterId: 'jose' });
  assert.equal(repeatedCreate.session.code, f.code);
  assert.equal(messageOf(repeatedJoin, 'room').playerIndex, 1);
  assert.equal(messageOf(repeatedJoin, 'room').players.length, 2);
  assert.deepEqual(messageOf(repeatedJoin, 'state').state.players.map(p => p.characterId), ['lula', 'tun-tum-sarhur']);
  assert.equal(initial.roundId, messageOf(repeatedJoin, 'state').roundId, 'retry never restarts a round');
});

test('competing joins admit only one guest without overwriting the winning room', async () => {
  const f = fixture();
  const created = await f.first.handle({ type: 'create', token: token(1), characterId: 'emerzon' });
  const code = created.session.code;
  const results = await Promise.allSettled([
    f.first.handle({ type: 'join', code, token: token(2), characterId: 'douglas' }),
    f.second.handle({ type: 'join', code, token: token(3), characterId: 'dilma' }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const rejected = results.find(r => r.status === 'rejected');
  assert.equal(rejected.reason.status, 409);
  const host = await sync(f.second, code, token(1));
  assert.equal(messageOf(host, 'room').players.length, 2);
  assert.equal(messageOf(host, 'state').state.players[0].characterId, 'emerzon');
});

test('session authentication rejects strangers and does not reveal other bearer tokens', async () => {
  const f = await pair();
  for (const type of ['sync', 'resume', 'rematch', 'leave']) {
    await assert.rejects(f.first.handle({ type, code: f.code, token: token(999), seq: 1, input: {} }), statusIs(401));
  }
  const response = await sync(f.second, f.code, token(1));
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes(token(2)), false, 'the opponent bearer is never returned');
  assert.equal(JSON.stringify(response.messages).includes(token(1)), false, 'room and state messages contain no bearer credentials');
  const stored = await f.store.get(f.code);
  assert.equal(stored.includes(token(1)), false);
  assert.equal(stored.includes(token(2)), false, 'only token hashes are persisted');
});

test('forged character or state data cannot replace an authoritative fighter', async () => {
  const f = await pair();
  await assert.rejects(f.first.handle({ type: 'create', token: token(4), characterId: '<script>' }), statusIs(400));
  const result = await f.second.handle({ type: 'sync', code: f.code, token: token(1), seq: 1,
    characterId: 'douglas', state: { players: [{ hp: 999 }] }, input: { hp: 999, x: 10000, attack: false } });
  const state = messageOf(result, 'state').state;
  assert.equal(state.players[0].hp, 100);
  assert.equal(state.players[0].characterId, 'lula');
  assert.ok(state.players[0].x < 1000);
});

test('resume restores the same seat and explicit leave revokes it', async () => {
  const f = await pair();
  const resumed = await f.first.handle({ type: 'resume', code: f.code, token: token(2) });
  assert.equal(messageOf(resumed, 'room').playerIndex, 1);
  assert.equal(messageOf(resumed, 'state').roundId, messageOf(f.joined, 'state').roundId);
  await f.second.handle({ type: 'leave', code: f.code, token: token(2) });
  await assert.rejects(f.first.handle({ type: 'resume', code: f.code, token: token(2) }), statusIs(401));
  const remaining = await sync(f.first, f.code, token(1));
  assert.equal(messageOf(remaining, 'room').status, 'waiting');
  assert.equal(messageOf(remaining, 'room').players.length, 1);
  assert.equal(messageOf(remaining, 'state'), undefined);
});

test('TTL expiry removes idle sessions across all service instances', async () => {
  const f = fixture();
  const created = await f.first.handle({ type: 'create', token: token(1), characterId: 'kaua' });
  f.advance(1800_001);
  await assert.rejects(f.second.handle({ type: 'resume', code: created.session.code, token: token(1) }), statusIs(404));
});

test('HTTP handler validates origin, method, malformed JSON and payload size', async () => {
  const f = fixture();
  const handler = createGameHandler({ service: f.first });
  assert.equal((await request(handler, { method: 'GET' })).status, 405);
  assert.equal((await request(handler, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await request(handler, { body: '{broken' })).status, 400);
  assert.equal((await request(handler, { body: JSON.stringify({ pad: 'x'.repeat(9000) }) })).status, 413);
  const created = await request(handler, { body: { type: 'create', token: token(1), characterId: 'emerzon' } });
  assert.equal(created.status, 200);
  assert.ok(created.json.session.code);
  assert.match(created.headers['cache-control'], /no-store/);
});

test('health reports HTTP transport only after the shared store is reachable', async () => {
  const healthy = createHealthHandler({ store: { async ping() { return 'PONG'; } } });
  const response = await request(healthy, { method: 'GET' });
  assert.equal(response.status, 200);
  assert.equal(response.json.ok, true);
  assert.equal(response.json.transport, 'http');
  const broken = createHealthHandler({ store: { async ping() { throw new Error('secret-token-in-provider-error'); } } });
  const failure = await request(broken, { method: 'GET' });
  assert.equal(failure.status, 503);
  assert.equal(failure.body.includes('secret-token-in-provider-error'), false);
});

async function editRoom(f, change) {
  const raw = await f.store.get(f.code), room = JSON.parse(raw);
  change(room);
  assert.equal(await f.store.compareAndSet(f.code, raw, JSON.stringify(room)), true);
}
async function playingPair() {
  const f = await pair();
  await editRoom(f, room => {
    room.state.phase = 'playing'; room.state.countdown = 0; room.lastStep = f.now();
  });
  return f;
}

test('stale input sequences cannot overwrite newer controls and held input expires', async () => {
  const f = await playingPair();
  await sync(f.first, f.code, token(1), 10, { right: true });
  f.advance(100);
  const moved = await sync(f.second, f.code, token(1), 9, { left: true, right: false });
  assert.ok(messageOf(moved, 'state').state.players[0].x > 280, 'newer rightward input is authoritative');
  const stored = JSON.parse(await f.store.get(f.code));
  assert.equal(stored.players[0].inputSeq, 10);
  assert.equal(stored.players[0].input.right, true);
  assert.equal(stored.players[0].input.left, false);
  f.advance(500);
  await sync(f.second, f.code, token(2), 1, {});
  const expired = JSON.parse(await f.store.get(f.code));
  assert.equal(expired.players[0].input.right, false, 'disconnected or stale clients cannot walk forever');
});

test('short polling integrates elapsed combat time once across independent instances', async () => {
  const f = await playingPair();
  const start = messageOf(await sync(f.first, f.code, token(1)), 'state').state.timeLeft;
  for (let tick = 0; tick < 20; tick++) {
    f.advance(100);
    await sync(tick % 2 ? f.first : f.second, f.code, token(tick % 2 + 1), tick + 2, {});
  }
  const final = messageOf(await sync(f.second, f.code, token(1), 100), 'state').state;
  assert.ok(Math.abs(final.timeLeft - (start - 2)) < 0.025, 'two readers never double-integrate the clock');
  assert.ok(final.timeLeft >= start - 2.001, 'game clock cannot run faster than elapsed time');
});

test('a disconnected opponent pauses the room and can resume the same seat within grace', async () => {
  const f = await playingPair();
  const initial = messageOf(await sync(f.first, f.code, token(1)), 'state');
  f.advance(1800);
  const paused = await sync(f.first, f.code, token(1), 2);
  assert.equal(messageOf(paused, 'room').players[1].connected, false);
  const pausedTime = messageOf(paused, 'state').state.timeLeft;
  f.advance(1000);
  const stillPaused = await sync(f.second, f.code, token(1), 3);
  assert.equal(messageOf(stillPaused, 'state').state.timeLeft, pausedTime);
  const resumed = await f.second.handle({ type: 'resume', code: f.code, token: token(2) });
  assert.equal(messageOf(resumed, 'room').playerIndex, 1);
  assert.equal(messageOf(resumed, 'state').roundId, initial.roundId);
  assert.equal(messageOf(resumed, 'state').state.timeLeft, pausedTime, 'rejoining does not simulate the disconnected interval');
  f.advance(100);
  const active = await sync(f.first, f.code, token(1), 4);
  assert.ok(messageOf(active, 'state').state.timeLeft < pausedTime);
});

test('combat events persist between polls and a mutually accepted rematch uses a new round id', async () => {
  const f = await playingPair();
  const roundId = messageOf(f.joined, 'state').roundId;
  await editRoom(f, room => {
    room.state.players[0].x = 400; room.state.players[1].x = 485; room.state.players[1].hp = 1;
  });
  await sync(f.first, f.code, token(1), 1, { special: true });
  f.advance(50);
  const struck = messageOf(await sync(f.second, f.code, token(2), 1), 'state');
  assert.equal(struck.state.scores[0], 1);
  assert.ok(struck.state.finisher);
  const id = struck.state.events.find(event => event.type === 'ko').id;
  f.advance(50);
  const later = messageOf(await sync(f.first, f.code, token(1), 2, {}), 'state');
  assert.ok(later.state.events.some(event => event.id === id), 'missed client polls retain important events');
  await editRoom(f, room => { room.state.phase = 'finished'; room.state.winner = 0; room.state.timeLeft = 0; });
  const accepted = await f.first.handle({ type: 'rematch', code: f.code, token: token(1) });
  assert.equal(messageOf(accepted, 'room').players[0].rematch, true);
  const restarted = await f.second.handle({ type: 'rematch', code: f.code, token: token(2) });
  const next = messageOf(restarted, 'state');
  assert.notEqual(next.roundId, roundId);
  assert.equal(next.state.phase, 'countdown'); assert.equal(next.state.timeLeft, 150);
  assert.equal(next.state.finisher, null); assert.deepEqual(next.state.scores, [0, 0]);
});

test('normal network latency above250ms still advances the shared clock without simulating an absent player',async()=>{
  const f=await playingPair();
  const start=messageOf(await sync(f.first,f.code,token(1)),'state').state.timeLeft;
  for(let i=0;i<6;i++){f.advance(450);await sync(i%2?f.first:f.second,f.code,token(i%2+1),i+2,{});}
  const current=messageOf(await sync(f.first,f.code,token(1),100,{}),'state').state.timeLeft;
  assert.ok(Math.abs(current-(start-2.7))<.025,'round time follows real time while both browsers remain present');
});
