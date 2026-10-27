import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../server.js';

async function client(url) {
  const socket = new WebSocket(url);
  const inbox = [];
  const waiters = [];
  socket.on('message', data => {
    const message = JSON.parse(data.toString());
    const waiter = waiters.find(w => w.match(message));
    if (waiter) { waiters.splice(waiters.indexOf(waiter), 1); clearTimeout(waiter.timeout); waiter.resolve(message); }
    else inbox.push(message);
  });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  return {
    socket, send: data => socket.send(JSON.stringify(data)),
    discard: type => { for (let index = inbox.length - 1; index >= 0; index--) if (inbox[index].type === type) inbox.splice(index, 1); },
    wait: (type, predicate = () => true) => {
      const match = message => message.type === type && predicate(message);
      const index = inbox.findIndex(match);
      if (index >= 0) return Promise.resolve(inbox.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { match, resolve, timeout: setTimeout(() => { waiters.splice(waiters.indexOf(waiter), 1); reject(new Error(`Timeout: ${type}`)); }, 4000) };
        waiters.push(waiter);
      });
    },
  };
}

test('HTTP serves game modules, health, 404, method restrictions and blocks traversal', async t => {
  const app = createGameServer({ port: 0, host: '127.0.0.1' }); t.after(() => app.close());
  const { port } = await app.ready;
  const base = `http://127.0.0.1:${port}`;
  const health = await fetch(`${base}/api/health`);
  assert.deepEqual(await health.json(), { ok: true, game: 'PVP GRUPO APANE', rooms: 0 });
  const engine = await fetch(`${base}/engine.js`);
  assert.equal(engine.status, 200); assert.match(engine.headers.get('content-type'), /javascript/);
  assert.match(await engine.text(), /export const CHARACTERS/);
  assert.equal((await fetch(`${base}/missing.txt`)).status, 404);
  assert.equal((await fetch(`${base}/api/health`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/%2e%2e%2fserver.js`)).status, 403);
});

test('two WebSocket players share the 150s clock, KO/respawn, drops, rematch and room cleanup', async t => {
  const app = createGameServer({ port: 0, host: '127.0.0.1' }); t.after(() => app.close());
  const { port } = await app.ready;
  const url = `ws://127.0.0.1:${port}/ws`;
  const host = await client(url); const guest = await client(url); const extra = await client(url);
  t.after(() => { host.socket.terminate(); guest.socket.terminate(); extra.socket.terminate(); });

  host.send({ type: 'create', characterId: 'emerzon' });
  const lobby = await host.wait('room');
  assert.match(lobby.code, /^[A-Z2-9]{6}$/); assert.equal(lobby.playerIndex, 0);
  assert.equal(lobby.status, 'waiting'); assert.equal(lobby.players.length, 1);
  extra.send({ type: 'join', code: 'ZZZZZZ', characterId: 'kaua' });
  assert.match((await extra.wait('error')).message, /não encontrada/);

  guest.send({ type: 'join', code: lobby.code.toLowerCase(), characterId: 'douglas' });
  const joined = await guest.wait('room');
  assert.equal(joined.playerIndex, 1); assert.equal(joined.players.length, 2);
  const state = (await host.wait('state')).state;
  assert.equal(state.phase, 'countdown');
  assert.equal(state.timeLeft, 150); assert.deepEqual(state.scores, [0, 0]);
  assert.deepEqual(state.players.map(p => p.characterId), ['emerzon', 'douglas']);
  extra.send({ type: 'join', code: lobby.code, characterId: 'jose' });
  assert.match((await extra.wait('error')).message, /dois jogadores/);

  // Skip only the countdown to exercise actual tick/input transport promptly.
  const room = app.rooms.get(lobby.code);
  room.state.phase = 'playing'; room.state.countdown = 0;
  host.send({ type: 'input', input: { right: true } });
  const moved = (await host.wait('state', message => message.state.players[0].x > 280)).state;
  assert.ok(moved.players[0].x > 280);

  room.state.players[0].x = 400; room.state.players[1].x = 480; room.state.players[1].hp = 1;
  host.send({ type: 'input', input: { attack: true } });
  const knockout = (await guest.wait('state', message => message.state.players[1].respawnTimer > 0)).state;
  assert.equal(knockout.phase, 'playing'); assert.equal(knockout.winner, null);
  assert.deepEqual(knockout.scores, [1, 0]); assert.equal(knockout.players[1].action, 'knockout');
  const respawned = (await guest.wait('state', message => message.state.scores[0] === 1 && message.state.players[1].hp === 100)).state;
  assert.ok(respawned.players[1].invulnerableTimer > 1);
  // Trigger a real scheduled drop without waiting for the full spawn interval.
  room.state.dropTimer = 0.01;
  const dropped = (await guest.wait('state', message => message.state.items.length > 0)).state;
  assert.ok(dropped.items[0].y > 0); assert.ok(dropped.items[0].type);
  const hostDrop = (await host.wait('state', message => message.state.items.length > 0)).state;
  assert.equal(hostDrop.items[0].id, dropped.items[0].id);
  room.state.timeLeft = 0.01;
  const finished = (await guest.wait('state', message => message.state.phase === 'finished')).state;
  assert.equal(finished.winner, 0);
  host.send({ type: 'rematch' });
  assert.equal((await host.wait('room', message => message.players[0].rematch)).players[0].rematch, true);
  host.discard('state');
  guest.send({ type: 'rematch' });
  const restarted = (await host.wait('state', message => message.state.phase === 'countdown' && message.state.players[1].hp === 100)).state;
  assert.equal(restarted.players[0].hp, 100);
  assert.equal(restarted.timeLeft, 150); assert.deepEqual(restarted.scores, [0, 0]); assert.deepEqual(restarted.items, []);

  guest.socket.close();
  await host.wait('opponent_left');
  const waiting = await host.wait('room', message => message.status === 'waiting');
  assert.equal(waiting.players.length, 1); assert.equal(waiting.playerIndex, 0);
  extra.send({ type: 'join', code: lobby.code, characterId: 'kaua' });
  assert.equal((await extra.wait('room')).playerIndex, 1);
  assert.equal((await extra.wait('state')).state.players[1].characterId, 'kaua');
  host.send({ type: 'leave' }); await host.wait('left'); await extra.wait('opponent_left');
  extra.send({ type: 'leave' }); await extra.wait('left');
  assert.equal(app.rooms.size, 0);
});

test('malformed or invalid commands cannot create rooms or inject player state', async t => {
  const app = createGameServer({ port: 0, host: '127.0.0.1' }); t.after(() => app.close());
  const { port } = await app.ready;
  const player = await client(`ws://127.0.0.1:${port}/ws`); t.after(() => player.socket.terminate());
  player.socket.send('{'); assert.match((await player.wait('error')).message, /inválida/);
  player.send({ type: 'create', characterId: 'hacker' });
  await player.wait('error'); assert.equal(app.rooms.size, 0);
  player.send({ type: 'join', code: '../../', characterId: 'jose' });
  assert.match((await player.wait('error')).message, /6 caracteres/);
  player.send({ type: 'rematch' }); assert.match((await player.wait('error')).message, /final da luta/);
});

test('online round clock never advances faster than real elapsed time', async t => {
  const app = createGameServer({ port: 0, host: '127.0.0.1' }); t.after(() => app.close());
  const { port } = await app.ready;
  const host = await client(`ws://127.0.0.1:${port}/ws`);
  const guest = await client(`ws://127.0.0.1:${port}/ws`);
  t.after(() => { host.socket.terminate(); guest.socket.terminate(); });
  host.send({ type: 'create', characterId: 'emerzon' });
  const lobby = await host.wait('room');
  guest.send({ type: 'join', code: lobby.code, characterId: 'douglas' });
  await guest.wait('state');
  const room = app.rooms.get(lobby.code);
  room.state.phase = 'playing'; room.state.countdown = 0;
  room.state.timeLeft = 1; // Shorten the fixture, keeping the production timer loop.
  const started = performance.now(); room.lastStep = started;
  await guest.wait('state', message => message.state.phase === 'finished');
  assert.ok(performance.now() - started >= 999, 'one simulated second must take at least one real second (1 ms clock tolerance)');
});
