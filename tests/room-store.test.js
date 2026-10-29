import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRoomStore, UpstashRoomStore, createRoomStore } from '../lib/room-store.js';

const fakeResponse = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });

test('explicit memory fixture implements atomic create, compare-and-swap, delete and TTL', async () => {
  let time = 1000;
  const store = new MemoryRoomStore({ now: () => time, ttlSeconds: 2 });
  assert.equal(await store.create('ABCDEF', 'first'), true);
  assert.equal(await store.create('ABCDEF', 'overwritten'), false);
  assert.equal(await store.get('ABCDEF'), 'first');
  const writes = await Promise.all([
    store.compareAndSet('ABCDEF', 'first', 'second'),
    store.compareAndSet('ABCDEF', 'first', 'third'),
  ]);
  assert.equal(writes.filter(Boolean).length, 1);
  assert.equal(await store.get('ABCDEF'), 'second');
  assert.equal(await store.compareAndSet('ABCDEF', 'first', null), false);
  assert.equal(await store.compareAndSet('ABCDEF', 'second', null), true);
  assert.equal(await store.get('ABCDEF'), null);
  assert.equal(await store.create('ABCDEF', 'new'), true);
  time += 2001;
  assert.equal(await store.get('ABCDEF'), null);
});

test('REST store keeps bearer credentials in headers and uses atomic Redis commands with expiry', async () => {
  const calls = [], answers = [{ result: null }, { result: 'OK' }, { result: 1 }, { result: 'PONG' }];
  const store = new UpstashRoomStore({ url: 'https://redis.example', token: 'private-api-token', ttlSeconds: 1800,
    fetchImpl: async (url, options) => { calls.push({ url, options, command: JSON.parse(options.body) }); return fakeResponse(answers.shift()); } });
  assert.equal(await store.get('ABCDEF'), null);
  assert.equal(await store.create('ABCDEF', '{"revision":1}'), true);
  assert.equal(await store.compareAndSet('ABCDEF', '{"revision":1}', '{"revision":2}'), true);
  assert.equal(await store.ping(), true);
  for (const call of calls) {
    assert.equal(call.options.method, 'POST');
    assert.equal(new Headers(call.options.headers).get('authorization'), 'Bearer private-api-token');
    assert.equal(call.url.includes('private-api-token'), false);
    assert.equal(call.options.body.includes('private-api-token'), false);
  }
  assert.deepEqual(calls[0].command.slice(0, 1), ['GET']);
  assert.deepEqual(calls[1].command.slice(0, 1), ['SET']);
  assert.ok(calls[1].command.includes('NX')); assert.ok(calls[1].command.includes('EX'));
  assert.equal(calls[2].command[0], 'EVAL');
  assert.match(calls[2].command[1], /redis\.call/);
  assert.ok(calls[2].command.includes('{"revision":1}'));
  assert.ok(calls[2].command.includes('{"revision":2}'));
});

test('configuration fails closed instead of creating isolated process-local production rooms', () => {
  assert.throws(() => createRoomStore({}), /config|Redis|UPSTASH/i);
  assert.throws(() => new UpstashRoomStore({ url: 'http://redis.example', token: 'secret' }), /https|config|Redis/i);
});

test('Redis failures never return provider credential details to callers', async () => {
  const store = new UpstashRoomStore({ url: 'https://redis.example', token: 'super-secret',
    fetchImpl: async () => fakeResponse({ error: 'invalid bearer super-secret' }) });
  await assert.rejects(store.get('ABCDEF'), error => !error.message.includes('super-secret'));
  const offline = new UpstashRoomStore({ url: 'https://redis.example', token: 'super-secret',
    fetchImpl: async () => { throw new Error('transport exposed super-secret'); } });
  await assert.rejects(offline.get('ABCDEF'), error => !error.message.includes('super-secret'));
});
