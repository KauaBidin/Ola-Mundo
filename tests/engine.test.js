import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, createMatch, stepMatch } from '../public/engine.js';

const playing = ids => { const match = createMatch(ids); match.phase = 'playing'; match.countdown = 0; return match; };
const advance = (state, inputs, seconds) => {
  for (let tick = 0; tick < Math.round(seconds * 60); tick++) stepMatch(state, inputs, 1 / 60);
  return state;
};

test('all four requested characters are available and invalid ids fall back safely', () => {
  assert.deepEqual(CHARACTERS.map(c => c.id), ['emerzon', 'douglas', 'jose', 'kaua']);
  assert.equal(createMatch(['invalid']).players[0].characterId, 'emerzon');
});

test('countdown gates movement, then starts a 60 second fight', () => {
  const state = createMatch();
  advance(state, [{ right: true }, {}], 3);
  assert.equal(state.phase, 'playing');
  assert.equal(state.players[0].x, 280);
  assert.equal(state.timeLeft, 60);
  advance(state, [{ right: true }, {}], 0.5);
  assert.ok(state.players[0].x > 400);
});

test('movement respects arena bounds and jumping returns to the ground', () => {
  const state = playing();
  advance(state, [{ left: true }, { right: true }], 2);
  assert.equal(state.players[0].x, 40);
  assert.equal(state.players[1].x, 960);
  stepMatch(state, [{ jump: true }, {}], 1 / 60);
  assert.ok(state.players[0].y > 0);
  advance(state, [{ jump: true }, {}], 2);
  assert.equal(state.players[0].y, 0, 'holding jump does not auto-jump');
});

test('punches need range and are limited by cooldown', () => {
  const state = playing();
  stepMatch(state, [{ attack: true }, {}], 1 / 60);
  assert.equal(state.players[1].hp, 100);
  state.players[0].attackCooldown = 0;
  state.players[0].attackTimer = 0;
  state.players[1].x = state.players[0].x + 90;
  stepMatch(state, [{ attack: true }, {}], 1 / 60);
  const hp = state.players[1].hp;
  assert.ok(hp < 100);
  advance(state, [{ attack: true }, {}], 0.2);
  assert.equal(state.players[1].hp, hp);
});

test('blocking reduces incoming damage', () => {
  const normal = playing();
  normal.players[1].x = 370;
  stepMatch(normal, [{ attack: true }, {}], 1 / 60);
  const blocked = playing();
  blocked.players[1].x = 370;
  stepMatch(blocked, [{ attack: true }, { block: true }], 1 / 60);
  assert.ok(blocked.players[1].hp > normal.players[1].hp);
  assert.ok(blocked.players[1].hp < 100);
  assert.equal(blocked.events.at(-1).type, 'block');
});

test('special uses energy, has longer reach, and cannot be spammed', () => {
  const state = playing(['kaua', 'douglas']);
  state.players[1].x = 450;
  stepMatch(state, [{ special: true }, {}], 1 / 60);
  assert.equal(state.players[0].energy, 50);
  assert.ok(state.players[1].hp < 100);
  const hp = state.players[1].hp;
  advance(state, [{ special: true }, {}], 0.5);
  assert.equal(state.players[1].hp, hp);
  assert.ok(state.players[0].energy > 50);
  state.players[0].energy = 20;
  state.players[0].specialCooldown = 0;
  state.players[0].attackTimer = 0;
  stepMatch(state, [{ special: true }, {}], 1 / 60);
  assert.ok(state.players[0].energy >= 20);
  assert.equal(state.players[1].hp, hp);
});

test('KO freezes the result and time expiry selects remaining health or a draw', () => {
  const ko = playing();
  ko.players[1].x = 370; ko.players[1].hp = 1;
  stepMatch(ko, [{ attack: true }, {}], 1 / 60);
  assert.equal(ko.phase, 'finished'); assert.equal(ko.winner, 0);
  const snapshot = structuredClone(ko);
  advance(ko, [{ right: true }, { left: true }], 3);
  assert.deepEqual(ko, snapshot);
  const timeout = playing(); timeout.timeLeft = 0.01; timeout.players[0].hp = 70;
  stepMatch(timeout, [{}, {}], 1 / 60);
  assert.equal(timeout.winner, 1);
  const draw = playing(); draw.timeLeft = 0.01;
  stepMatch(draw, [{}, {}], 1 / 60);
  assert.equal(draw.winner, 'draw');
});

test('simultaneous attacks damage both players', () => {
  const state = playing(); state.players[1].x = 370;
  stepMatch(state, [{ attack: true }, { attack: true }], 1 / 60);
  assert.ok(state.players.every(player => player.hp < 100));
});
