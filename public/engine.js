// Shared deterministic game rules: the server owns online matches; the browser
// uses the same rules for the two-player local mode.
export const CHARACTERS = [
  { id: 'emerzon', name: 'Emerzon', role: 'TI N2', color: '#b6f269', special: 'Reboot crítico', description: 'Resolve no suporte. Finaliza na arena.', stats: { power: 4, speed: 3, defense: 4 } },
  { id: 'douglas', name: 'Douglas', role: 'Gerente de TI', color: '#bc91ff', special: 'Escalação máxima', description: 'A última palavra agora é um golpe.', stats: { power: 5, speed: 2, defense: 5 } },
  { id: 'jose', name: 'José', role: 'Analista de TI', color: '#69cfff', special: 'Bug fatal', description: 'Analisa a defesa. Encontra a brecha.', stats: { power: 3, speed: 4, defense: 3 } },
  { id: 'kaua', name: 'Kauã', role: 'Aux. Procesos e automatización', color: '#ffb66f', special: 'Loop infinito', description: 'Automatiza os processos e os combos.', stats: { power: 3, speed: 5, defense: 2 } },
  { id: 'lula', name: 'Lula', role: 'Convidado da arena', color: '#ff777d', special: 'Redemoinho rubro', description: 'Barba branca, guarda firme e um giro poderoso.', stats: { power: 4, speed: 3, defense: 4 }, aliases: ['Luiz Inácio Lula da Silva'], className: 'VETERANO' },
  { id: 'bolsonaro', name: 'Bolsonaro', role: 'Convidado da arena', color: '#7de0a2', special: 'Arrancada verde', description: 'Avança pela arena em uma investida veloz.', stats: { power: 4, speed: 4, defense: 3 }, aliases: ['Jair Bolsonaro'], className: 'INVESTIDA' },
  { id: 'nikolas', name: 'Nikolas Ferreira', role: 'Convidado da arena', color: '#79baff', special: 'Salto relâmpago', description: 'Guarda leve, passos rápidos e ataque aéreo.', stats: { power: 2, speed: 5, defense: 3 }, aliases: ['Nikolas'], className: 'VELOCISTA' },
  { id: 'dilma', name: 'Dilma', role: 'Convidada da arena', color: '#ff8ebf', special: 'Impacto rubi', description: 'Jaqueta vermelha e golpes de presença.', stats: { power: 4, speed: 3, defense: 4 }, aliases: ['Dilma Rousseff'], className: 'RESISTÊNCIA' },
  { id: 'flavio', name: 'Flávio Bolsonaro', role: 'Convidado da arena', color: '#79e3da', special: 'Investida cobalto', description: 'Mantém a postura e responde no contra-ataque.', stats: { power: 3, speed: 4, defense: 4 }, aliases: ['Flavio Bolsonaro', 'Flávio'], className: 'EQUILÍBRIO' },
  { id: 'kid-bengala', name: 'Kid Bengala', role: 'Convidado da arena', color: '#ddadff', special: 'Impacto titã', description: 'Porte imponente e força de peso-pesado.', stats: { power: 5, speed: 2, defense: 4 }, aliases: ['Kid'], className: 'PESO-PESADO' },
  { id: 'tun-tum-sarhur', name: 'Tun Tum Sarhur', role: 'Meme de madeira', color: '#efca85', special: 'Batida de madeira', description: 'Olhos atentos e um ritmo que sacode a arena.', stats: { power: 5, speed: 3, defense: 2 }, aliases: ['Tung Tung Sahur', 'Tun Tun Sahur', 'Tung Tung', 'Tun Tum'], className: 'BRUTAMONTES' },
];

export const ARENA_WIDTH = 1000;
export const ROUND_DURATION = 150;
export const PUNCH_DURATION = 0.24;
export const PUNCH_WINDUP = 0.08;
export const SPECIAL_DURATION = 0.5;
export const SPECIAL_REACH = 250;
export const FINISHER_DURATION = 1.45;
export const ITEM_TYPES = [
  { id: 'heal', label: 'Vida extra', short: '+30 HP', color: '#b6f269', duration: 0, description: 'Recupera 30 de vida.' },
  { id: 'speed', label: 'Turbo', short: 'TURBO', color: '#ffe078', duration: 8, description: 'Movimento 45% mais rápido por 8 segundos.' },
  { id: 'shield', label: 'Escudo', short: 'ESCUDO', color: '#75d9ff', duration: 8, description: 'Reduz dano e evita quedas por 8 segundos.' },
  { id: 'energy', label: 'Carga extra', short: '+60 EN', color: '#bc91ff', duration: 0, description: 'Recupera 60 de energia.' },
  { id: 'rage', label: 'Fúria', short: 'FÚRIA', color: '#ff9a63', duration: 8, description: 'Golpes 35% mais fortes por 8 segundos.' },
  { id: 'jump', label: 'Superpulo', short: 'PULO+', color: '#f2a1ea', duration: 8, description: 'Impulso do pulo 25% maior por 8 segundos.' },
];
const characterFor = id => CHARACTERS.find(character => character.id === id) || CHARACTERS[0];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
const EPSILON = 0.000001;
const GRAVITY = 1750;
const timer = (value, dt) => Math.max(0, value - dt) < EPSILON ? 0 : Math.max(0, value - dt);
const emptyBuffs = () => ({ speed: 0, shield: 0, rage: 0, jump: 0 });
const spawnX = index => index ? 720 : 280;

export function createMatch(ids = ['emerzon', 'douglas'], { seed = Math.floor(Math.random() * 0xffffffff) } = {}) {
  return {
    phase: 'countdown', countdown: 3, timeLeft: ROUND_DURATION, winner: null,
    elapsed: 0, eventId: 0, events: [], finisher: null, scores: [0, 0], items: [],
    dropTimer: 4, itemId: 0, randomSeed: (Number(seed) >>> 0) || 0x9e3779b9,
    players: [0, 1].map(index => ({
      characterId: characterFor(ids[index]).id, x: spawnX(index),
      y: 0, vx: 0, vy: 0, facing: index ? -1 : 1, hp: 100, energy: 100,
      action: 'idle', attackTimer: 0, attackCooldown: 0, specialCooldown: 0,
      punchPending: false,
      hitTimer: 0, previousJump: false, jumpBuffer: 0, coyoteTimer: 0.09,
      dashTimer: 0, dashCooldown: 0, previousDash: false, dashDirection: index ? -1 : 1,
      kickTimer: 0, kickDirection: index ? -1 : 1, kickHit: false,
      downTimer: 0, respawnTimer: 0, invulnerableTimer: 0, buffs: emptyBuffs(),
    })),
  };
}

function event(state, type, data = {}) {
  const record = { id: ++state.eventId, type, ...data };
  state.events.push(record);
  return record;
}

function random(state) {
  let value = state.randomSeed;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.randomSeed = value >>> 0;
  return state.randomSeed / 0x100000000;
}

function respawn(state, index) {
  const player = state.players[index];
  Object.assign(player, {
    x: spawnX(index), y: 0, vx: 0, vy: 0, hp: 100, energy: 100,
    action: 'idle', attackTimer: 0, attackCooldown: 0, specialCooldown: 0,
    punchPending: false,
    hitTimer: 0, downTimer: 0, respawnTimer: 0, invulnerableTimer: 1.5,
    dashTimer: 0, dashCooldown: 0, jumpBuffer: 0, coyoteTimer: 0.09,
    kickTimer: 0, kickHit: false,
    buffs: emptyBuffs(),
  });
  event(state, 'respawn', { player: index, x: player.x, y: 0 });
}

function moveBody(player, dt) {
  const nextX = player.x + player.vx * dt;
  player.x = clamp(nextX, 40, ARENA_WIDTH - 40);
  if (player.x !== nextX) player.vx = 0;
  if (player.y > 0 || player.vy > 0) {
    const nextY = player.y + player.vy * dt - GRAVITY * dt * dt / 2;
    player.vy -= GRAVITY * dt;
    player.y = Math.max(0, nextY);
    if (!player.y) player.vy = 0;
  }
}

function movePlayer(state, index, input, dt, strikes) {
  const player = state.players[index], opponent = state.players[1 - index];
  const character = characterFor(player.characterId);
  const wasDown = player.action === 'down' || player.downTimer > 0;
  for (const key of ['attackTimer', 'attackCooldown', 'specialCooldown', 'hitTimer', 'dashTimer', 'dashCooldown', 'kickTimer', 'downTimer', 'invulnerableTimer', 'jumpBuffer']) player[key] = timer(player[key], dt);
  for (const key of Object.keys(player.buffs)) player.buffs[key] = timer(player.buffs[key], dt);
  player.energy = Math.min(100, player.energy + dt * 10);
  const jumpPressed = !!input.jump && !player.previousJump;
  const dashPressed = !!input.dash && !player.previousDash;
  player.previousJump = !!input.jump; player.previousDash = !!input.dash;

  if (player.respawnTimer > 0 || player.hp <= 0) {
    player.respawnTimer = timer(player.respawnTimer, dt);
    if (!player.respawnTimer) { respawn(state, index); return; }
    player.action = 'knockout'; player.attackTimer = 0; player.punchPending = false; player.kickTimer = 0; player.hitTimer = 0; player.dashTimer = 0;
    player.vx = approach(player.vx, 0, dt * 340);
    moveBody(player, dt);
    return;
  }
  player.facing = player.x <= opponent.x ? 1 : -1;
  if (wasDown) {
    player.dashTimer = 0; player.kickTimer = 0; player.attackTimer = 0; player.punchPending = false; player.hitTimer = 0; player.jumpBuffer = 0;
    player.vx = approach(player.vx, 0, dt * 400);
    moveBody(player, dt);
    if (!player.downTimer && !player.y) {
      player.action = 'idle'; player.invulnerableTimer = Math.max(player.invulnerableTimer, 0.15);
    } else {
      player.action = 'down'; player.invulnerableTimer = Math.max(player.invulnerableTimer, dt * 2);
    }
    return;
  }
  const grounded = player.y <= 0;
  player.coyoteTimer = grounded ? 0.09 : timer(player.coyoteTimer, dt);
  if (jumpPressed) player.jumpBuffer = 0.12;
  if (player.hitTimer > 0) {
    player.action = 'hit'; player.dashTimer = 0; player.kickTimer = 0; player.attackTimer = 0; player.punchPending = false;
    player.vx = approach(player.vx, 0, dt * 180);
    moveBody(player, dt);
    return;
  }
  if (player.kickTimer > 0) {
    player.punchPending = false;
    player.action = 'special'; player.attackTimer = player.kickTimer;
    player.facing = player.kickDirection; player.vx = player.kickDirection * 620;
    moveBody(player, dt);
    if (!player.kickHit) strikes.push({ attacker: index, special: true });
    return;
  }

  // The hand reaches full extension after its windup, rather than dealing
  // damage on the button press. Consume the contact once, even if it misses.
  if (player.punchPending && player.attackTimer <= PUNCH_DURATION - PUNCH_WINDUP + EPSILON) {
    if (player.attackTimer > 0) strikes.push({ attacker: index, special: false });
    player.punchPending = false;
  }

  const blocking = !!input.block && grounded && !player.attackTimer && !player.dashTimer;
  const direction = Number(!!input.right) - Number(!!input.left);
  if (blocking) {
    player.action = 'block'; player.vx = approach(player.vx, 0, 3800 * dt);
  } else {
    if (player.jumpBuffer > 0 && player.coyoteTimer > 0) {
      player.vy = 680 * (player.buffs.jump > 0 ? 1.25 : 1);
      player.jumpBuffer = 0; player.coyoteTimer = 0;
    }
    if (dashPressed && !player.dashCooldown && !player.attackTimer) {
      player.dashTimer = 0.14; player.dashCooldown = 0.9;
      player.dashDirection = direction || player.facing;
      event(state, 'dash', { player: index, direction: player.dashDirection });
    }
    if (player.dashTimer > 0) {
      player.vx = player.dashDirection * 680 * (player.buffs.speed > 0 ? 1.15 : 1);
      player.action = 'dash';
    } else {
      const speed = (205 + character.stats.speed * 20) * (player.buffs.speed > 0 ? 1.45 : 1);
      const desired = direction * speed * (player.attackTimer > 0 ? 0.45 : 1);
      const acceleration = direction ? (grounded ? 2200 : 1400) : (grounded ? 2800 : 650);
      player.vx = approach(player.vx, desired, acceleration * dt);
      if (!player.attackTimer) player.action = player.y > 0 || player.vy > 0 ? 'jump' : Math.abs(player.vx) > 8 ? 'walk' : 'idle';
    }
    if (!player.attackTimer && !player.dashTimer) {
      if (input.special && !player.specialCooldown && player.energy >= 50) {
        player.energy -= 50; player.specialCooldown = 1.6;
        player.attackCooldown = 0.65; player.attackTimer = SPECIAL_DURATION; player.action = 'special';
        player.punchPending = false;
        player.kickTimer = SPECIAL_DURATION; player.kickDirection = player.facing; player.kickHit = false;
        player.dashTimer = 0; player.vx = player.kickDirection * 620;
        if (grounded) player.vy = 340;
        strikes.push({ attacker: index, special: true }); event(state, 'special', { player: index });
      } else if (input.attack && !player.attackCooldown) {
        player.attackCooldown = 0.4; player.attackTimer = PUNCH_DURATION; player.action = 'attack';
        player.punchPending = true; event(state, 'punch', { player: index });
      }
    }
  }
  moveBody(player, dt);
}

function updateItems(state, dt) {
  state.dropTimer = timer(state.dropTimer, dt);
  if (!state.dropTimer) {
    if (state.items.length < 4) {
      const type = ITEM_TYPES[Math.floor(random(state) * ITEM_TYPES.length)].id;
      const item = { id: ++state.itemId, type, x: 85 + random(state) * 830, y: 560, vy: -30, ttl: 14 };
      state.items.push(item);
      event(state, 'drop', { itemId: item.id, itemType: type, x: item.x, y: item.y });
    }
    state.dropTimer = 8 + random(state) * 4;
  }
  const retained = [];
  for (const item of state.items) {
    if (item.y > 0) {
      item.y = Math.max(0, item.y + item.vy * dt - 550 * dt * dt / 2);
      item.vy -= 550 * dt;
      if (!item.y) item.vy = 0;
    } else item.ttl = timer(item.ttl, dt);
    if (!item.ttl) continue;
    const candidates = state.players.map((player, index) => ({ player, index, distance: Math.abs(player.x - item.x) }))
      .filter(({ player, distance }) => player.hp > 0 && !player.respawnTimer && !player.downTimer && player.action !== 'down' && distance <= 50 && Math.abs(player.y - item.y) <= 65)
      .sort((a, b) => a.distance - b.distance || ((a.index + item.id) % 2) - ((b.index + item.id) % 2));
    const collector = candidates[0];
    if (!collector) { retained.push(item); continue; }
    const { player, index } = collector;
    if (item.type === 'heal') player.hp = Math.min(100, player.hp + 30);
    else if (item.type === 'energy') player.energy = Math.min(100, player.energy + 60);
    else if (Object.hasOwn(player.buffs, item.type)) player.buffs[item.type] = 8;
    event(state, 'pickup', { player: index, itemType: item.type, x: item.x, y: item.y });
  }
  state.items = retained;
}

function simulate(state, inputs, dt) {
  state.elapsed += dt;
  if (state.finisher && state.elapsed - state.finisher.at + EPSILON >= FINISHER_DURATION) state.finisher = null;
  if (state.phase === 'countdown') {
    state.countdown = timer(state.countdown, dt);
    if (!state.countdown) { state.phase = 'playing'; event(state, 'start'); }
    return;
  }
  state.timeLeft = timer(state.timeLeft, dt);
  const strikes = [];
  for (let index = 0; index < 2; index++) movePlayer(state, index, inputs[index] || {}, dt, strikes);
  const [a, b] = state.players;
  if (a.hp > 0 && b.hp > 0 && !a.invulnerableTimer && !b.invulnerableTimer && a.action !== 'down' && b.action !== 'down' && Math.abs(a.y - b.y) < 95 && Math.abs(a.x - b.x) < 64) {
    const direction = a.x <= b.x ? 1 : -1;
    const overlap = (64 - Math.abs(a.x - b.x)) / 2;
    a.x = clamp(a.x - direction * overlap, 40, 960); b.x = clamp(b.x + direction * overlap, 40, 960);
  }
  // Snapshot all connecting strikes before applying either: a simultaneous KO
  // or knockdown cannot cancel the opponent's already-started hit.
  const hits = [];
  for (const strike of strikes) {
    const source = state.players[strike.attacker], targetIndex = 1 - strike.attacker, target = state.players[targetIndex];
    if (target.hp <= 0 || target.respawnTimer || target.downTimer || target.action === 'down' || target.invulnerableTimer > 0) continue;
    if (Math.abs(source.x - target.x) > (strike.special ? SPECIAL_REACH : 118) || Math.abs(source.y - target.y) > 105) continue;
    if (strike.special && (target.x - source.x) * source.kickDirection < -35) continue;
    const blocked = target.action === 'block', shielded = target.buffs.shield > 0;
    const power = characterFor(source.characterId).stats.power, defense = characterFor(target.characterId).stats.defense;
    const baseDamage = (strike.special ? 13 + power * 1.8 : 4 + power * 1.1) * (1 - defense * 0.025);
    const damage = Math.max(1, Math.round(baseDamage * (source.buffs.rage > 0 ? 1.35 : 1) * (blocked ? 0.2 : shielded ? 0.35 : 1)));
    hits.push({ ...strike, targetIndex, damage, blocked: blocked || shielded, knockdown: strike.special && !blocked && !shielded, direction: source.facing });
  }
  const finisherCandidates = [];
  for (const hit of hits) {
    if (hit.special) state.players[hit.attacker].kickHit = true;
    const target = state.players[hit.targetIndex];
    target.hp = Math.max(0, target.hp - hit.damage);
    if (hit.knockdown) {
      target.downTimer = 1.15; target.action = 'down'; target.vx = hit.direction * 480; target.vy = 460;
      target.invulnerableTimer = 1.15; target.dashTimer = 0; target.kickTimer = 0; target.attackTimer = 0; target.punchPending = false;
    } else if (!hit.blocked) {
      target.hitTimer = 0.14; target.action = 'hit'; target.vx = hit.direction * 150;
      target.dashTimer = 0; target.kickTimer = 0; target.attackTimer = 0; target.punchPending = false;
    } else target.vx += hit.direction * 25;
    event(state, hit.blocked ? 'block' : 'hit', {
      player: hit.targetIndex, attacker: hit.attacker, damage: hit.damage, special: hit.special,
      direction: hit.direction, knockdown: hit.knockdown, blood: hit.damage > 0, x: target.x, y: target.y,
    });
    if (!target.hp) {
      state.scores[hit.attacker]++;
      target.action = 'knockout'; target.respawnTimer = 2; target.downTimer = 0; target.hitTimer = 0; target.kickTimer = 0; target.punchPending = false;
      event(state, 'ko', { player: hit.targetIndex, attacker: hit.attacker, x: target.x, y: target.y });
      if (hit.special && !hit.blocked) finisherCandidates.push(hit);
    }
  }
  // Evaluate after both strikes so a simultaneous double KO never names one
  // fighter as the finisher. This descriptor is presentation only: combat,
  // the round clock and the normal two-second respawn continue unchanged.
  const finisher = finisherCandidates.find(hit => state.players[hit.attacker].hp > 0 && state.players[hit.targetIndex].hp === 0);
  if (finisher) {
    const snapshot = player => Object.freeze({ ...player, buffs: Object.freeze({ ...player.buffs }) });
    state.finisher = Object.freeze(event(state, 'finisher', {
      at: state.elapsed, attacker: finisher.attacker, player: finisher.targetIndex,
      source: snapshot(state.players[finisher.attacker]), target: snapshot(state.players[finisher.targetIndex]),
    }));
  }
  updateItems(state, dt);
  if (!state.timeLeft) {
    state.phase = 'finished';
    state.winner = state.scores[0] === state.scores[1]
      ? a.hp === b.hp ? 'draw' : a.hp > b.hp ? 0 : 1
      : state.scores[0] > state.scores[1] ? 0 : 1;
    event(state, 'finish', { winner: state.winner });
  }
}

export function stepMatch(state, inputs = [{}, {}], dt = 1 / 60) {
  if (!Number.isFinite(dt) || dt <= 0 || state.phase === 'finished') return state;
  state.events = [];
  // Bounded substeps keep acceleration, airborne control and knockback stable
  // across the server's 30 Hz tick and displays running at 60/120 Hz.
  const duration = Math.min(dt, 0.1);
  const count = Math.ceil(duration / (1 / 120));
  for (let tick = 0; tick < count && state.phase !== 'finished'; tick++) simulate(state, inputs, duration / count);
  return state;
}
