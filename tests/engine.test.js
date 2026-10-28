import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, ITEM_TYPES, ROUND_DURATION, PUNCH_DURATION, PUNCH_WINDUP, SPECIAL_DURATION, SPECIAL_REACH, FINISHER_DURATION, createMatch, stepMatch } from '../public/engine.js';

const playing = (ids, seed = 12345) => { const match = createMatch(ids, { seed }); match.phase = 'playing'; match.countdown = 0; return match; };
const advance = (state, inputs, seconds, hz = 60) => {
  for (let tick = 0; tick < Math.round(seconds * hz); tick++) stepMatch(state, inputs, 1 / hz);
  return state;
};
const closeFighters = state => { state.players[0].x = 400; state.players[1].x = 485; return state; };
const landPunch = (state, inputs = [{ attack: true }, {}]) => {
  stepMatch(state, inputs, 1 / 120);
  return stepMatch(state, inputs, PUNCH_WINDUP);
};
const pickup = (state, type, index = 0) => {
  const player = state.players[index];
  state.items.push({ id: ++state.itemId, type, x: player.x, y: player.y, vy: 0, ttl: 14 });
  stepMatch(state, [{}, {}], 1 / 120);
};

test('eleven characters, six useful drops and a 150 second clock are available', () => {
  assert.deepEqual(CHARACTERS.map(c => c.id), ['emerzon', 'douglas', 'jose', 'kaua', 'lula', 'bolsonaro', 'nikolas', 'dilma', 'flavio', 'kid-bengala', 'tun-tum-sarhur']);
  assert.equal(createMatch(['invalid']).players[0].characterId, 'emerzon');
  assert.equal(ROUND_DURATION, 150);
  assert.deepEqual(ITEM_TYPES.map(item => item.id).sort(), ['energy', 'heal', 'jump', 'rage', 'shield', 'speed']);
});

test('every guest can move, punch and launch a damaging special', () => {
  for (const id of ['lula', 'bolsonaro', 'nikolas', 'dilma', 'flavio', 'kid-bengala', 'tun-tum-sarhur']) {
    const movement = playing([id, 'emerzon']);
    assert.equal(movement.players[0].characterId, id);
    advance(movement, [{ right: true }, {}], 0.2);
    assert.ok(movement.players[0].x > 280, id + ' moves');
    const punch = closeFighters(playing([id, 'emerzon']));
    landPunch(punch);
    assert.ok(punch.players[1].hp < 100, id + ' lands a punch');
    assert.equal(punch.events.filter(e => e.type === 'hit').length, 1);
    const special = closeFighters(playing([id, 'emerzon']));
    stepMatch(special, [{ special: true }, {}], 1 / 120);
    assert.ok(special.players[1].hp < 100 && special.players[1].downTimer > 0, id + ' launches a special');
    assert.equal(special.players[0].energy, 50);
  }
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
  landPunch(state);
  const hp = state.players[1].hp, x = state.players[1].x;
  assert.ok(hp >= 91 && hp <= 94); assert.ok(state.players[1].vx > 0);
  advance(state, [{ attack: true }, { left: true }], 0.1);
  assert.equal(state.players[1].hp, hp); assert.ok(state.players[1].x > x, 'opposite input cannot erase knockback during hitstun');
  // Direction and blood eligibility are checked at the actual connecting tick below.
  const fresh = closeFighters(playing()); landPunch(fresh);
  assert.equal(fresh.events.find(e => e.type === 'hit').direction, 1);
  assert.equal(fresh.events.find(e => e.type === 'hit').knockdown, false);
});

test('punches connect only at full hand extension and deal damage once per animation', () => {
  const state = closeFighters(playing());
  stepMatch(state, [{ attack: true }, {}], 1 / 120);
  assert.equal(PUNCH_DURATION, 0.24); assert.equal(PUNCH_WINDUP, 0.08);
  assert.equal(state.players[0].attackTimer, PUNCH_DURATION);
  assert.equal(state.players[0].punchPending, true);
  assert.equal(state.players[1].hp, 100, 'button press only starts the arm windup');
  stepMatch(state, [{}, {}], PUNCH_WINDUP - 0.01);
  assert.equal(state.players[1].hp, 100);
  stepMatch(state, [{}, {}], 0.01);
  const hp = state.players[1].hp;
  assert.ok(hp < 100); assert.equal(state.players[0].punchPending, false);
  assert.equal(state.events.filter(e => e.type === 'hit').length, 1);
  // Keep the rival in reach without hitstun to expose accidental repeat hits.
  Object.assign(state.players[1], { x: state.players[0].x + 85, vx: 0, hitTimer: 0, action: 'idle' });
  advance(state, [{ attack: true }, {}], 0.15, 120);
  assert.equal(state.players[1].hp, hp);
  assert.ok(state.players[0].attackCooldown > 0.15, 'holding attack cannot restart before its cooldown');
});

test('punch range is measured at contact and a missed punch cannot hit during retraction', () => {
  const miss = closeFighters(playing());
  stepMatch(miss, [{ attack: true }, {}], 1 / 120);
  miss.players[1].x = 650;
  stepMatch(miss, [{}, {}], PUNCH_WINDUP);
  assert.equal(miss.players[1].hp, 100); assert.equal(miss.players[0].punchPending, false);
  closeFighters(miss);
  advance(miss, [{}, {}], 0.15, 120);
  assert.equal(miss.players[1].hp, 100, 'a rival entering reach after extension avoids the missed punch');

  const enters = playing();
  stepMatch(enters, [{ attack: true }, {}], 1 / 120);
  closeFighters(enters);
  stepMatch(enters, [{}, {}], PUNCH_WINDUP);
  assert.ok(enters.players[1].hp < 100, 'a rival entering reach before extension can be hit');
});

test('an earlier normal hit interrupts a winding-up punch before its pending contact', () => {
  const state = closeFighters(playing());
  stepMatch(state, [{}, { attack: true }], 1 / 120);
  stepMatch(state, [{}, {}], PUNCH_WINDUP / 2);
  stepMatch(state, [{ attack: true }, {}], 1 / 120);
  assert.equal(state.players[0].punchPending, true);
  stepMatch(state, [{}, {}], PUNCH_WINDUP / 2);
  assert.equal(state.players[0].action, 'hit'); assert.equal(state.players[0].punchPending, false);
  advance(state, [{}, {}], 0.3, 120);
  assert.equal(state.players[1].hp, 100, 'canceled hand movement cannot produce delayed damage');
});

test('knockdown, KO and respawn clear an unfinished punch', () => {
  for (const hp of [100, 1]) {
    const state = closeFighters(playing()); state.players[0].hp = hp;
    stepMatch(state, [{ attack: true }, {}], 1 / 120);
    stepMatch(state, [{}, { special: true }], 1 / 120);
    assert.equal(state.players[0].punchPending, false);
    assert.equal(state.players[0].attackTimer, 0);
    assert.equal(state.players[0].action, hp === 1 ? 'knockout' : 'down');
    advance(state, [{}, {}], hp === 1 ? FINISHER_DURATION + 0.1 : 2.1);
    assert.equal(state.players[1].hp, 100);
    assert.equal(state.players[0].punchPending, false);
    if (hp === 1) assert.equal(state.players[0].hp, 100);
  }
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

test('manual defense and shield reduce damage, prevent launch and emit a block event instead of a hit', () => {
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
  landPunch(state);
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
  landPunch(state, [{ attack: true }, { attack: true }]);
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
  landPunch(baseHit); landPunch(rage);
  assert.ok(rage.players[1].hp < baseHit.players[1].hp);
  const baseJump = playing(), highJump = playing(); pickup(highJump, 'jump');
  advance(baseJump, [{ jump: true }, {}], 0.3); advance(highJump, [{ jump: true }, {}], 0.3);
  assert.ok(highJump.players[0].y > baseJump.players[0].y + 40);
});

test('flying kick visibly advances and jumps before connecting beyond the old special range', () => {
  const state = playing(); state.players[0].x = 200; state.players[1].x = 550;
  stepMatch(state, [{ special: true }, {}], 1 / 120);
  assert.equal(SPECIAL_DURATION, 0.5); assert.equal(SPECIAL_REACH, 250);
  const source = state.players[0];
  assert.equal(source.action, 'special'); assert.equal(source.kickTimer, SPECIAL_DURATION);
  assert.equal(source.kickDirection, 1); assert.equal(source.kickHit, false);
  assert.ok(source.x > 200 && source.y > 0 && source.vx >= 600 && source.vy > 300);
  assert.equal(state.players[1].hp, 100, 'cannot connect before reaching the distant rival');
  advance(state, [{}, {}], 0.2);
  assert.ok(source.x > 300); assert.ok(state.players[1].hp < 100);
  assert.equal(source.kickHit, true); assert.ok(state.players[1].downTimer > 0);
});

test('active flying kick hits an opponent entering reach later, exactly once per activation', () => {
  const state = playing(); state.players[0].x = 100; state.players[1].x = 850;
  stepMatch(state, [{ special: true }, {}], 1 / 120);
  advance(state, [{ special: true }, {}], 0.1);
  assert.equal(state.players[1].hp, 100);
  state.players[1].x = state.players[0].x + 150;
  stepMatch(state, [{ special: true }, {}], 1 / 120);
  const hit = state.events.find(e => e.type === 'hit');
  assert.ok(hit && hit.special && hit.knockdown && hit.blood); assert.equal(hit.direction, 1);
  assert.equal(state.players[0].kickHit, true);
  Object.assign(state.players[1], { hp: 100, downTimer: 0, invulnerableTimer: 0, action: 'idle', y: 0, vy: 0, vx: 0 });
  state.players[1].x = state.players[0].x + 100;
  advance(state, [{ special: true }, {}], 0.25);
  assert.equal(state.players[1].hp, 100, 'even resetting victim protection cannot cause a second hit');
  assert.ok(state.players[0].energy > 50 && state.players[0].energy < 55, 'one activation charges only 50');
});

test('flying kick is directional and works toward rivals on either side', () => {
  const state = playing(); state.players[0].x = 750; state.players[1].x = 400;
  stepMatch(state, [{ special: true }, {}], 1 / 120);
  assert.equal(state.players[0].kickDirection, -1); assert.ok(state.players[0].vx < -600);
  assert.ok(state.players[0].x < 750 && state.players[0].y > 0);
  advance(state, [{ right: true }, {}], 0.2);
  assert.equal(state.players[0].facing, -1, 'kick direction stays locked despite opposite movement input');
  assert.ok(state.players[1].hp < 100);
});

test('flying kick cannot hit across the whole arena or repeat before its cooldown', () => {
  const far = playing(); far.players[0].x = 80; far.players[1].x = 930;
  stepMatch(far, [{ special: true }, {}], 1 / 120);
  advance(far, [{ special: true }, {}], 0.7);
  assert.equal(far.players[1].hp, 100); assert.equal(far.players[0].kickTimer, 0);
  assert.ok(far.players[0].energy > 55 && far.players[0].energy < 59);
  assert.ok(far.players[0].specialCooldown > 0.85);
  const distantX = far.players[0].x;
  advance(far, [{ special: true }, {}], 0.3);
  assert.equal(far.players[0].kickTimer, 0); assert.ok(far.players[0].x - distantX < 20);
});

test('flying kick keeps airborne momentum rather than granting another upward jump', () => {
  const state = playing(); Object.assign(state.players[0], { y: 170, vy: -100 });
  stepMatch(state, [{ special: true }, {}], 1 / 120);
  assert.ok(state.players[0].vy < -100); assert.ok(state.players[0].y < 170);
  assert.equal(state.players[0].action, 'special');
});

test('normal hits, knockdowns and KO interrupt a flying kick; simultaneous kicks stay fair', () => {
  for (const [attackerInput, hp, expected] of [[{ attack: true }, 100, 'hit'], [{ special: true }, 100, 'down'], [{ attack: true }, 1, 'knockout']]) {
    const state = closeFighters(playing());
    Object.assign(state.players[0], { action: 'special', kickTimer: 0.4, attackTimer: 0.4, kickDirection: 1, kickHit: true, hp });
    if (attackerInput.attack) landPunch(state, [{}, attackerInput]);
    else stepMatch(state, [{}, attackerInput], 1 / 120);
    assert.equal(state.players[0].action, expected); assert.equal(state.players[0].kickTimer, 0); assert.equal(state.players[0].attackTimer, 0);
  }
  const both = closeFighters(playing()); stepMatch(both, [{ special: true }, { special: true }], 1 / 120);
  assert.ok(both.players.every(p => p.downTimer > 0 && p.hp < 100 && !p.kickTimer));
});

test('all positive-damage strikes identify blood eligibility, including defense chip', () => {
  for (const [special, block] of [[false, false], [true, false], [false, true], [true, true]]) {
    const state = closeFighters(playing()), inputs = [special ? { special: true } : { attack: true }, block ? { block: true } : {}];
    if (special) stepMatch(state, inputs, 1 / 120);
    else landPunch(state, inputs);
    const damage = state.events.find(e => ['hit', 'block'].includes(e.type));
    assert.ok(damage.damage > 0 && damage.blood); assert.equal(damage.special, special);
    assert.equal(damage.knockdown, special && !block);
  }
});

test('an unblocked lethal special emits one finisher with immutable detached fighter snapshots', () => {
  const state = closeFighters(playing(['lula', 'bolsonaro']));
  assert.equal(state.finisher, null);
  state.players[0].buffs.speed = 3; state.players[1].buffs.rage = 4;
  state.players[1].hp = 1;
  stepMatch(state, [{ special: true }, {}], 1 / 120);
  const scenes = state.events.filter(e => e.type === 'finisher');
  assert.equal(scenes.length, 1);
  const scene = scenes[0];
  assert.equal(state.finisher, scene);
  assert.equal(scene.attacker, 0); assert.equal(scene.player, 1);
  assert.equal(scene.at, state.elapsed);
  assert.equal(scene.source.characterId, 'lula'); assert.ok(scene.source.hp > 0);
  assert.equal(scene.target.characterId, 'bolsonaro'); assert.equal(scene.target.hp, 0);
  assert.equal(scene.target.action, 'knockout'); assert.equal(scene.target.respawnTimer, 2);
  assert.ok(state.events.findIndex(e => e.type === 'ko') < state.events.indexOf(scene));
  for (const object of [scene, scene.source, scene.target, scene.source.buffs, scene.target.buffs]) assert.ok(Object.isFrozen(object));
  assert.notEqual(scene.source, state.players[0]); assert.notEqual(scene.target, state.players[1]);
  assert.notEqual(scene.source.buffs, state.players[0].buffs); assert.notEqual(scene.target.buffs, state.players[1].buffs);
  const captured = structuredClone(scene);
  state.players[0].x += 20; state.players[0].buffs.speed = 0;
  state.players[1].x -= 20; state.players[1].buffs.rage = 0;
  stepMatch(state, [{}, {}], 0.1);
  assert.equal(state.events.some(e => e.type === 'finisher'), false, 'later frames do not duplicate the event');
  assert.deepEqual(scene, captured, 'simulation cannot alter recorded positions, health or buffs');
  assert.equal(state.finisher, scene, 'persistent descriptor survives the transient events array');
});

test('nonlethal, normal, defended, shielded and double-KO strikes never start a finisher', () => {
  const nonlethal = closeFighters(playing());
  stepMatch(nonlethal, [{ special: true }, {}], 1 / 120);
  assert.equal(nonlethal.finisher, null);
  const normal = closeFighters(playing()); normal.players[1].hp = 1;
  landPunch(normal); assert.equal(normal.players[1].hp, 0); assert.equal(normal.finisher, null);
  for (const shield of [false, true]) {
    const defended = closeFighters(playing()); defended.players[1].hp = 1;
    if (shield) defended.players[1].buffs.shield = 8;
    stepMatch(defended, [{ special: true }, shield ? {} : { block: true }], 1 / 120);
    assert.equal(defended.players[1].hp, 0, 'even lethal chip remains a normal KO');
    assert.equal(defended.finisher, null);
    assert.equal(defended.events.some(e => e.type === 'finisher'), false);
  }
  const simultaneous = closeFighters(playing()); simultaneous.players.forEach(p => { p.hp = 1; });
  stepMatch(simultaneous, [{ special: true }, { special: true }], 1 / 120);
  assert.deepEqual(simultaneous.scores, [1, 1]);
  assert.equal(simultaneous.finisher, null);
  assert.equal(simultaneous.events.some(e => e.type === 'finisher'), false);
});

test('finisher freezes combat for 5.5s, then respawns the target and recovers the survivor', () => {
  const state = closeFighters(playing()); state.players[0].hp = 85; state.players[1].hp = 1;
  state.players[0].buffs.speed = 4; state.players[1].buffs.rage = 6;
  state.items.push({ id: 1, type: 'energy', x: 900, y: 0, vy: 0, ttl: 10 }); state.dropTimer = 2;
  stepMatch(state, [{ special: true }, {}], 1 / 120);
  assert.equal(FINISHER_DURATION, 5.5);
  const started = state.elapsed, clock = state.timeLeft, scene = state.finisher;
  const players = structuredClone(state.players), items = structuredClone(state.items), dropTimer = state.dropTimer;
  advance(state, [{ right: true, jump: true, attack: true }, { left: true, special: true }], 5);
  assert.equal(state.finisher, scene, 'scene is still active after five complete seconds');
  assert.ok(Math.abs(state.elapsed - started - 5) < 0.0001, 'presentation time advances');
  assert.equal(state.timeLeft, clock);
  assert.deepEqual(state.players, players, 'movement, buffs, attacks, health and respawn timers all freeze');
  assert.deepEqual(state.items, items); assert.equal(state.dropTimer, dropTimer);
  assert.deepEqual(state.scores, [1, 0]);
  advance(state, [{}, {}], 0.5, 120);
  assert.equal(state.finisher, null);
  assert.ok(Math.abs(state.elapsed - started - 5.5) < 0.0001);
  assert.ok(Math.abs(state.timeLeft - clock) < 0.0001, 'cinematic consumes none of the 150s combat clock');
  const [survivor, target] = state.players;
  assert.equal(target.hp, 100); assert.equal(target.energy, 100); assert.equal(target.respawnTimer, 0);
  assert.equal(target.x, 720); assert.ok(Math.abs(target.invulnerableTimer - 1.5) < 0.0001);
  assert.equal(survivor.hp, players[0].hp); assert.ok(Math.abs(survivor.energy - players[0].energy) < 0.000001);
  for (const key of Object.keys(survivor.buffs)) assert.ok(Math.abs(survivor.buffs[key] - players[0].buffs[key]) < 0.000001, key);
  assert.equal(survivor.x, players[0].x); assert.equal(survivor.y, 0);
  for (const key of ['vx', 'vy', 'attackTimer', 'attackCooldown', 'specialCooldown', 'hitTimer', 'kickTimer', 'dashTimer', 'dashCooldown']) assert.equal(survivor[key], 0, key);
  assert.equal(survivor.action, 'idle'); assert.equal(survivor.punchPending, false);
  assert.deepEqual(state.scores, [1, 0], 'scene exit never awards another point');
  stepMatch(state, [{}, {}], 0.1);
  assert.ok(Math.abs(state.timeLeft - (clock - 0.1)) < 0.0001);
  assert.ok(Math.abs(state.players[0].buffs.speed - (players[0].buffs.speed - 0.1)) < 0.0001);
  assert.ok(Math.abs(state.items[0].ttl - (items[0].ttl - 0.1)) < 0.0001);
  assert.equal(createMatch().finisher, null, 'fresh rounds and rematches reset the scene');
});

test('a substep crossing cinematic expiry preserves every remaining millisecond of combat', () => {
  const state = closeFighters(playing()); state.players[1].hp = 1;
  state.items.push({ id: 1, type: 'energy', x: 900, y: 0, vy: 0, ttl: 10 });
  stepMatch(state, [{ special: true }, {}], 1 / 120);
  state.elapsed = state.finisher.at + FINISHER_DURATION - 0.005;
  state.players[0].buffs.speed = 4;
  const before = { elapsed: state.elapsed, clock: state.timeLeft, ttl: state.items[0].ttl, drop: state.dropTimer };
  stepMatch(state, [{}, {}], 0.05);
  assert.equal(state.finisher, null);
  assert.ok(Math.abs(state.elapsed - (before.elapsed + 0.05)) < 0.000001);
  assert.ok(Math.abs(state.timeLeft - (before.clock - 0.045)) < 0.000001);
  assert.ok(Math.abs(state.items[0].ttl - (before.ttl - 0.045)) < 0.000001);
  assert.ok(Math.abs(state.dropTimer - (before.drop - 0.045)) < 0.000001);
  assert.ok(Math.abs(state.players[0].buffs.speed - (4 - 0.045)) < 0.000001);
  assert.ok(Math.abs(state.players[1].invulnerableTimer - (1.5 - 0.045)) < 0.000001);
});
