// Shared deterministic game rules: the server owns online matches; the browser
// uses the same rules for the two-player local mode.
export const CHARACTERS = [
  { id: 'emerzon', name: 'Emerzon', role: 'TI N2', color: '#b6f269', special: 'Reboot crítico', description: 'Resolve no suporte. Finaliza na arena.', stats: { power: 4, speed: 3, defense: 4 } },
  { id: 'douglas', name: 'Douglas', role: 'Gerente de TI', color: '#bc91ff', special: 'Escalação máxima', description: 'A última palavra agora é um golpe.', stats: { power: 5, speed: 2, defense: 5 } },
  { id: 'jose', name: 'José', role: 'Analista de TI', color: '#69cfff', special: 'Bug fatal', description: 'Analisa a defesa. Encontra a brecha.', stats: { power: 3, speed: 4, defense: 3 } },
  { id: 'kaua', name: 'Kauã', role: 'Aux. Procesos e automatización', color: '#ffb66f', special: 'Loop infinito', description: 'Automatiza os processos e os combos.', stats: { power: 3, speed: 5, defense: 2 } },
];

export const ARENA_WIDTH = 1000;
const characterFor = id => CHARACTERS.find(character => character.id === id) || CHARACTERS[0];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createMatch(ids = ['emerzon', 'douglas']) {
  return {
    phase: 'countdown', countdown: 3, timeLeft: 60, winner: null,
    elapsed: 0, eventId: 0, events: [],
    players: [0, 1].map(index => ({
      characterId: characterFor(ids[index]).id, x: index ? 720 : 280,
      y: 0, vx: 0, vy: 0, facing: index ? -1 : 1, hp: 100, energy: 100,
      action: 'idle', attackTimer: 0, attackCooldown: 0,
      specialCooldown: 0, hitTimer: 0, previousJump: false,
    })),
  };
}

function event(state, type, data = {}) {
  state.events.push({ id: ++state.eventId, type, ...data });
}

export function stepMatch(state, inputs = [{}, {}], dt = 1 / 60) {
  if (!Number.isFinite(dt) || dt <= 0 || state.phase === 'finished') return state;
  dt = Math.min(dt, 0.05);
  state.events = [];
  state.elapsed += dt;
  if (state.phase === 'countdown') {
    state.countdown = Math.max(0, state.countdown - dt);
    if (state.countdown < 0.00001) {
      state.countdown = 0;
      state.phase = 'playing';
      event(state, 'start');
    }
    return state;
  }

  state.timeLeft = Math.max(0, state.timeLeft - dt);
  const strikes = [];
  for (let index = 0; index < 2; index++) {
    const player = state.players[index];
    const opponent = state.players[1 - index];
    const input = inputs[index] || {};
    const character = characterFor(player.characterId);
    player.facing = player.x <= opponent.x ? 1 : -1;
    player.attackTimer = Math.max(0, player.attackTimer - dt);
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    player.specialCooldown = Math.max(0, player.specialCooldown - dt);
    player.hitTimer = Math.max(0, player.hitTimer - dt);
    player.energy = Math.min(100, player.energy + dt * 10);

    const grounded = player.y <= 0;
    const blocking = !!input.block && grounded && player.hitTimer === 0 && player.attackTimer === 0;
    if (player.hitTimer > 0) player.action = 'hit';
    else if (player.attackTimer === 0) {
      if (blocking) {
        player.action = 'block';
        player.vx = 0;
      } else {
        const direction = Number(!!input.right) - Number(!!input.left);
        player.vx = direction * (205 + character.stats.speed * 20);
        player.action = direction ? 'walk' : 'idle';
        if (input.jump && !player.previousJump && grounded) {
          player.vy = 680;
          player.action = 'jump';
        }
        if (input.special && player.specialCooldown === 0 && player.energy >= 50) {
          player.energy -= 50;
          player.specialCooldown = 1.6;
          player.attackCooldown = 0.65;
          player.attackTimer = 0.36;
          player.action = 'special';
          strikes.push({ attacker: index, special: true });
          event(state, 'special', { player: index });
        } else if (input.attack && player.attackCooldown === 0) {
          player.attackCooldown = 0.45;
          player.attackTimer = 0.2;
          player.action = 'attack';
          strikes.push({ attacker: index, special: false });
          event(state, 'punch', { player: index });
        }
      }
    } else player.vx *= 0.8;

    player.previousJump = !!input.jump;
    player.x = clamp(player.x + player.vx * dt, 40, ARENA_WIDTH - 40);
    player.y = Math.max(0, player.y + player.vy * dt);
    if (player.y > 0 || player.vy > 0) player.vy -= 1750 * dt;
    if (player.y === 0 && player.vy < 0) player.vy = 0;
    if (player.y > 0 && player.attackTimer === 0 && player.hitTimer === 0) player.action = 'jump';
  }

  // Keep grounded bodies separate without stopping an airborne cross-up.
  const [a, b] = state.players;
  if (Math.abs(a.y - b.y) < 95 && Math.abs(a.x - b.x) < 64) {
    const direction = a.x <= b.x ? 1 : -1;
    const overlap = (64 - Math.abs(a.x - b.x)) / 2;
    a.x = clamp(a.x - direction * overlap, 40, 960);
    b.x = clamp(b.x + direction * overlap, 40, 960);
  }

  // Resolve both attacks after input processing so simultaneous hits are fair.
  for (const strike of strikes) {
    const source = state.players[strike.attacker];
    const targetIndex = 1 - strike.attacker;
    const target = state.players[targetIndex];
    const reach = strike.special ? 195 : 118;
    if (Math.abs(source.x - target.x) > reach || Math.abs(source.y - target.y) > 105) continue;
    const power = characterFor(source.characterId).stats.power;
    const defense = characterFor(target.characterId).stats.defense;
    const blocked = target.action === 'block';
    const damage = (strike.special ? 17 + power * 2 : 7 + power * 1.5) * (1 - defense * 0.025);
    const actual = Math.round(damage * (blocked ? 0.2 : 1));
    target.hp = Math.max(0, target.hp - actual);
    if (!blocked) {
      target.hitTimer = 0.18;
      target.action = 'hit';
      target.vx = source.facing * (strike.special ? 260 : 110);
    }
    target.x = clamp(target.x + source.facing * (blocked ? 7 : strike.special ? 40 : 14), 40, 960);
    event(state, blocked ? 'block' : 'hit', { player: targetIndex, attacker: strike.attacker, damage: actual, special: strike.special, x: target.x, y: target.y });
  }

  if (a.hp <= 0 || b.hp <= 0 || state.timeLeft === 0) {
    state.phase = 'finished';
    state.winner = a.hp === b.hp ? 'draw' : a.hp > b.hp ? 0 : 1;
    event(state, 'finish', { winner: state.winner });
  }
  return state;
}
