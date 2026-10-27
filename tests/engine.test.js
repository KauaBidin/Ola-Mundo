import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, ITEM_TYPES, ROUND_DURATION, createMatch, stepMatch } from '../public/engine.js';

const playing = (ids, seed = 12345) => { const match = createMatch(ids, { seed }); match.phase = 'playing'; match.countdown = 0; return match; };
const advance = (state, inputs, seconds, hz = 60) => {
  for (let tick = 0; tick < Math.round(seconds * hz); tick++) stepMatch(state, inputs, 1 / hz);
  return state;
};
const closeFighters = state => { state.players[0].x = 400; state.players[1].x = 485; return state; };
const pickup = (state, type, index = 0) => {
  const player = state.players[index];
  state.items.push({ id: ++state.itemId, type, x: player.x, y: player.y, vy: 0, ttl: 14 });
  stepMatch(state, [{}, {}], 1 / 120);
};

test('four characters, six useful drops and a 150 second clock are available', () => {
  assert.deepEqual(CHARACTERS.map(c => c.id), ['emerzon', 'douglas', 'jose', 'kaua']);
  assert.equal(createMatch(['invalid']).players[0].characterId, 'emerzon');
  assert.equal(ROUND_DURATION, 150);
  assert.deepEqual(ITEM_TYPES.map(item => item.id).sort(), ['energy', 'heal', 'jump', 'rage', 'shield', 'speed']);
});

test('countdown gates movement and drops, then the full 2:30 fight begins', () => {
  const state = createMatch(undefined, { seed: 12345 });
  advance(state, [{ right: true }, {}], 3);
  assert.equal(state.phase, 'playing'); assert.equal(state.players[0].x, 280);
  assert.equal(state.timeLeft, 150); assert.equal(state.dropTimer, 4); assert.equal(state.items.length, 0);
  advance(state, [{ right: true }, {}], 0.5);
  assert.ok(state.players[0].x > 390);
});

test('movement accelerates smoothly, stops promptly and respects arena bounds', () => {
  const state = playing();
  stepMatch(state, [{ right: true }, {}], 1 / 60);
  assert.ok(state.players[0].vx > 0 && state.players[0].vx < 265);
  assert.ok(state.players[0].x > 280 && state.players[0].x < 282);
  advance(state, [{ right: true }, {}], 0.2);
  const before = state.players[0].x;
  advance(state, [{}, {}], 0.2);
  assert.equal(state.players[0].vx, 0); assert.ok(state.players[0].x - before < 16);
  advance(state, [{ left: true }, { right: true }], 3);
  assert.equal(state.players[0].x, 40); assert.equal(state.players[1].x, 960);
});

test('jump is edge-triggered, allows air control and buffered input near landing', () => {
  const state = playing();
  stepMatch(state, [{ jump: true }, {}], 1 / 60); assert.ok(state.players[0].y > 0);
  const x = state.players[0].x;
  advance(state, [{ jump: true, right: true }, {}], 0.15); assert.ok(state.players[0].x > x);
  advance(state, [{ jump: true }, {}], 1.5); assert.equal(state.players[0].y, 0, 'held jump cannot auto-repeat');
  const buffered = playing(); Object.assign(buffered.players[0], { y: 6, vy: -160, coyoteTimer: 0 });
  stepMatch(buffered, [{ jump: true }, {}], 1 / 120);
  assert.equal(buffered.players[0].vy < 0, true);
  advance(buffered, [{ jump: true }, {}], 0.08, 120);
  assert.ok(buffered.players[0].vy > 0 && buffered.players[0].y > 0, 'queued jump starts on landing');
});

test('coyote time permits a late jump but does not grant unlimited air jumps', () => {
  const state = playing(); Object.assign(state.players[0], { y: 5, vy: -10, coyoteTimer: 0.06 });
  stepMatch(state, [{ jump: true }, {}], 1 / 120); assert.ok(state.players[0].vy > 600);
  const late = playing(); Object.assign(late.players[0], { y: 80, vy: -10, coyoteTimer: 0 });
  stepMatch(late, [{ jump: true }, {}], 1 / 120); assert.ok(late.players[0].vy < 0);
});

test('dash is a short edge-triggered burst with a cooldown and no energy cost', () => {
  const state = playing(); state.players[0].x = 150;
  stepMatch(state, [{ dash: true, right: true }, {}], 1 / 120);
  assert.equal(state.players[0].action, 'dash'); assert.equal(state.players[0].energy, 100);
  assert.ok(state.players[0].vx >= 680); assert.ok(state.events.some(e => e.type === 'dash'));
  advance(state, [{ dash: true, right: true }, {}], 0.2);
  assert.equal(state.players[0].dashTimer, 0); assert.ok(state.players[0].dashCooldown > 0);
  advance(state, [{ dash: true }, {}], 1); assert.equal(state.players[0].dashTimer, 0, 'holding dash does not repeat');
  stepMatch(state, [{}, {}], 1 / 60); stepMatch(state, [{ dash: true }, {}], 1 / 60);
  assert.ok(state.players[0].dashTimer > 0);
});

test('30 Hz and 60 Hz simulations agree on movement, landing, drops and clock', () => {
  const a = playing(undefined, 333), b = playing(undefined, 333);
  for (const state of [a, b]) { state.players[0].x = 100; state.players[1].x = 900; }
  advance(a, [{ jump: true, right: true }, {}], 0.5, 30);
  advance(b, [{ jump: true, right: true }, {}], 0.5, 60);
  advance(a, [{}, {}], 6, 30); advance(b, [{}, {}], 6, 60);
  for (const field of ['x', 'y', 'vx', 'vy']) assert.ok(Math.abs(a.players[0][field] - b.players[0][field]) < 0.001, field);
  assert.ok(Math.abs(a.timeLeft - b.timeLeft) < 0.0001); assert.deepEqual(a.items, b.items);
});

test('punches need range, have reduced damage and preserve physical knockback during stun', () => {
  const state = playing(); stepMatch(state, [{ attack: true }, {}], 1 / 60);
  assert.equal(state.players[1].hp, 100);
  advance(state, [{}, {}], 0.5); closeFighters(state);
  stepMatch(state, [{ attack: true }, {}], 1 / 120);
  const hp = state.players[1].hp, x = state.players[1].x;
  assert.ok(hp >= 91 && hp <= 94); assert.ok(state.players[1].vx > 0);
  advance(state, [{ attack: true }, { left: true }], 0.1);
  assert.equal(state.players[1].hp, hp); assert.ok(state.players[1].x > x, 'opposite input cannot erase knockback during hitstun');
  // Direction and blood eligibility are checked at the actual connecting tick below.
  const fresh = closeFighters(playing()); stepMatch(fresh, [{ attack: true }, {}], 1 / 120);
  assert.equal(fresh.events.find(e => e.type === 'hit').direction, 1);
  assert.equal(fresh.events.find(e => e.type === 'hit').knockdown, false);
});

test('special launches, protects the fallen player from juggling, then recovers on the floor', () => {
  const state = closeFighters(playing());
  stepMatch(state, [{ special: true }, {}], 1 / 120);
  const player = state.players[1], hp = player.hp;
  assert.equal(player.action, 'down'); assert.ok(player.downTimer > 1.1);
  assert.ok(player.vy > 400 && player.vx > 400); assert.ok(hp >= 77 && hp <= 85);
  assert.equal(state.events.find(e => e.type === 'hit').knockdown, true);
  const originalX = player.x;
  advance(state, [{ right: true, attack: true }, { left: true, attack: true, jump: true }], 0.55);
  assert.equal(player.hp, hp); assert.equal(player.action, 'down'); assert.ok(player.x > originalX + 70);
  advance(state, [{}, {}], 0.8);
  assert.equal(player.downTimer, 0); assert.equal(player.y, 0); assert.notEqual(player.action, 'down');
});

test('manual defense and shield reduce damage, prevent launch and emit no hit/blood event', () => {
  for (const shield of [false, true]) {
    const state = closeFighters(playing());
    if (shield) state.players[1].buffs.shield = 8;
    stepMatch(state, [{ special: true }, shield ? {} : { block: true }], 1 / 120);
    assert.ok(state.players[1].hp > 90); assert.equal(state.players[1].downTimer, 0);
    assert.equal(state.players[1].vy, 0); assert.equal(state.events.some(e => e.type === 'hit'), false);
    assert.equal(state.events.some(e => e.type === 'block'), true);
  }
});

test('special costs energy, has longer range and cannot be spammed', () => {
  const state = playing(['kaua', 'douglas']); state.players[1].x = 450;
  stepMatch(state, [{ special: true }, {}], 1 / 120); assert.equal(state.players[0].energy, 50);
  const hp = state.players[1].hp; assert.ok(hp < 100);
  advance(state, [{ special: true }, {}], 0.5); assert.equal(state.players[1].hp, hp);
  state.players[0].energy = 20; state.players[0].specialCooldown = 0; state.players[0].attackTimer = 0;
  stepMatch(state, [{ special: true }, {}], 1 / 120); assert.ok(state.players[0].energy >= 20);
  assert.equal(state.players[0].action === 'special', false);
});

test('KO awards a point, never ends early, and respawns with temporary protection', () => {
  const state = closeFighters(playing()); state.players[1].hp = 1;
  stepMatch(state, [{ attack: true }, {}], 1 / 120);
  assert.equal(state.phase, 'playing'); assert.equal(state.winner, null); assert.deepEqual(state.scores, [1, 0]);
  assert.equal(state.players[1].action, 'knockout'); assert.equal(state.players[1].respawnTimer, 2);
  assert.ok(state.events.some(e => e.type === 'ko' && e.player === 1 && e.attacker === 0));
  advance(state, [{ right: true, attack: true }, { left: true }], 1.8);
  assert.equal(state.players[1].hp, 0); assert.deepEqual(state.scores, [1, 0]);
  advance(state, [{}, {}], 0.25); assert.equal(state.players[1].hp, 100);
  assert.equal(state.players[1].x, 720); assert.ok(state.players[1].invulnerableTimer > 1.4);
  closeFighters(state); stepMatch(state, [{ special: true }, {}], 1 / 120);
  assert.equal(state.players[1].hp, 100, 'respawn protection absorbs an immediate attack');
  advance(state, [{}, {}], 146.7); assert.equal(state.phase, 'playing');
  advance(state, [{}, {}], 1.3); assert.equal(state.phase, 'finished'); assert.equal(state.winner, 0);
});

test('time expiry uses scores first, health second, and supports draws; results freeze', () => {
  for (const [scores, hp, expected] of [[[2, 1], [10, 100], 0], [[1, 1], [70, 90], 1], [[0, 0], [100, 100], 'draw']]) {
    const state = playing(); state.scores = scores; state.timeLeft = 0.01;
    state.players.forEach((p, i) => { p.hp = hp[i]; });
    stepMatch(state, [{}, {}], 1 / 60); assert.equal(state.phase, 'finished'); assert.equal(state.winner, expected);
    const snapshot = structuredClone(state); advance(state, [{ right: true }, { left: true }], 1); assert.deepEqual(state, snapshot);
  }
});

test('simultaneous lethal attacks award both points instead of privileging P1', () => {
  const state = closeFighters(playing()); state.players.forEach(p => { p.hp = 1; });
  stepMatch(state, [{ attack: true }, { attack: true }], 1 / 120);
  assert.deepEqual(state.scores, [1, 1]); assert.ok(state.players.every(p => p.hp === 0 && p.respawnTimer > 0));
  assert.equal(state.events.filter(e => e.type === 'ko').length, 2); assert.equal(state.phase, 'playing');
  const specials = closeFighters(playing());
  stepMatch(specials, [{ special: true }, { special: true }], 1 / 120);
  assert.ok(specials.players.every(p => p.hp < 100 && p.downTimer > 0));
});

test('first drop appears at four seconds, falls, lands and expires with deterministic seeds', () => {
  const state = playing(undefined, 9876), same = playing(undefined, 9876);
  advance(state, [{}, {}], 3.9); assert.equal(state.items.length, 0);
  advance(state, [{}, {}], 0.1); assert.equal(state.items.length, 1);
  const item = state.items[0]; assert.ok(item.y > 500); assert.equal(item.ttl, 14);
  assert.ok(state.events.some(e => e.type === 'drop')); assert.ok(state.dropTimer >= 8 && state.dropTimer <= 12);
  advance(same, [{}, {}], 4); assert.deepEqual(state.items, same.items);
  state.players[0].x = 40; state.players[1].x = 960; item.x = 500;
  advance(state, [{}, {}], 1.6); assert.equal(item.y, 0); assert.ok(item.ttl > 13.5);
  const id = item.id; advance(state, [{}, {}], 14.1); assert.equal(state.items.some(i => i.id === id), false);
});

test('drop cap is four and no item survives its grounded TTL', () => {
  const state = playing(); state.players[0].x = 40; state.players[1].x = 960;
  state.items = Array.from({ length: 4 }, (_, id) => ({ id: id + 1, type: 'heal', x: 500, y: 0, vy: 0, ttl: 20 }));
  state.itemId = 4; state.dropTimer = 0.001;
  stepMatch(state, [{}, {}], 1 / 60); assert.equal(state.items.length, 4);
  state.items.forEach(item => { item.ttl = 0.01; }); stepMatch(state, [{}, {}], 1 / 60); assert.equal(state.items.length, 0);
});

test('heal and energy collect automatically, clamp at 100 and report pickups', () => {
  const state = playing(); state.players[0].hp = 80; state.players[0].energy = 70;
  pickup(state, 'heal'); assert.equal(state.players[0].hp, 100); assert.equal(state.items.length, 0);
  assert.ok(state.events.some(e => e.type === 'pickup' && e.itemType === 'heal' && e.player === 0));
  pickup(state, 'energy'); assert.equal(state.players[0].energy, 100);
  state.players[0].hp = 40; pickup(state, 'heal'); assert.equal(state.players[0].hp, 70);
});

test('downed and knocked-out players cannot collect drops, but airborne players can', () => {
  const state = playing(); Object.assign(state.players[0], { action: 'down', downTimer: 1, hp: 30 });
  pickup(state, 'heal'); assert.equal(state.players[0].hp, 30); assert.equal(state.items.length, 1);
  Object.assign(state.players[0], { downTimer: 0, action: 'knockout', hp: 0, respawnTimer: 1 });
  stepMatch(state, [{}, {}], 1 / 60); assert.equal(state.items.length, 1);
  const airborne = playing(); airborne.players[0].y = 200; pickup(airborne, 'speed'); assert.ok(airborne.players[0].buffs.speed > 7.9);
});

test('all timed buffs last eight seconds, refresh without stacking and expire', () => {
  for (const type of ['speed', 'shield', 'rage', 'jump']) {
    const state = playing(); pickup(state, type); assert.equal(state.players[0].buffs[type], 8);
    advance(state, [{}, {}], 3); pickup(state, type); assert.equal(state.players[0].buffs[type], 8);
    state.dropTimer = 100; advance(state, [{}, {}], 8.1); assert.equal(state.players[0].buffs[type], 0);
  }
});

test('speed, rage and jump pickups materially change movement, damage and jump height', () => {
  const normal = playing(), fast = playing(); normal.players[0].x = fast.players[0].x = 100;
  pickup(fast, 'speed'); advance(normal, [{ right: true }, {}], 1); advance(fast, [{ right: true }, {}], 1);
  assert.ok(fast.players[0].x > normal.players[0].x + 65);
  const baseHit = closeFighters(playing()), rage = closeFighters(playing()); pickup(rage, 'rage');
  stepMatch(baseHit, [{ attack: true }, {}], 1 / 120); stepMatch(rage, [{ attack: true }, {}], 1 / 120);
  assert.ok(rage.players[1].hp < baseHit.players[1].hp);
  const baseJump = playing(), highJump = playing(); pickup(highJump, 'jump');
  advance(baseJump, [{ jump: true }, {}], 0.3); advance(highJump, [{ jump: true }, {}], 0.3);
  assert.ok(highJump.players[0].y > baseJump.players[0].y + 40);
});
