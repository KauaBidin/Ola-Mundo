import { createHash } from 'node:crypto';
import { CHARACTERS, createMatch, stepMatch } from '../public/engine.js';

export const POLL_AFTER_MS = 100;
export const PRESENCE_MS = 1500;
export const RESUME_GRACE_MS = 30_000;
export const INPUT_EXPIRE_MS = 350;
const MAX_CATCHUP_MS = PRESENCE_MS;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INPUT_KEYS = ['left', 'right', 'jump', 'attack', 'special', 'block', 'dash'];
const emptyInput = () => Object.fromEntries(INPUT_KEYS.map(key => [key, false]));
const hashToken = token => createHash('sha256').update(token).digest('hex');
export const roomCodeForToken = token => [...createHash('sha256').update(token).digest().subarray(0, 6)].map(byte => ALPHABET[byte & 31]).join('');
export class RoomError extends Error {
  constructor(status, code, message) { super(message); this.name = 'RoomError'; this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new RoomError(status, code, message); };
const characterExists = id => CHARACTERS.some(c => c.id === id);

function resetRoom(room, now) {
  room.state = null; room.recentEvents = []; room.roundId++; room.departed = true; room.lastStep = now;
  for (const p of room.players) { p.input = emptyInput(); p.lastInputAt = now; p.rematch = false; }
}
function startRound(room, now) {
  room.state = createMatch(room.players.map(p => p.characterId)); room.roundId++;
  room.recentEvents = []; room.lastStep = now; room.departed = false;
  for (const p of room.players) { p.input = emptyInput(); p.lastInputAt = now; p.rematch = false; }
}
function advance(room, now) {
  const elapsed = Math.max(0, now - room.lastStep);
  room.lastStep = now;
  if (!room.state || room.state.phase === 'finished' || room.players.length !== 2) return;
  if (room.players.some(p => now - p.lastSeen > PRESENCE_MS)) return;
  // A sleeping function or absent browser is not an opportunity to fast-forward
  // attacks against an offline player. Ordinary short polls integrate real time.
  if (elapsed > MAX_CATCHUP_MS) return;
  let remaining = elapsed;
  while (remaining > 0.0001 && room.state.phase !== 'finished') {
    const dt = Math.min(remaining, 1000 / 60);
    // Expiration is evaluated at each substep, not at the request's end time.
    const at = now - remaining + dt;
    const inputs = room.players.map(p => at - p.lastInputAt <= INPUT_EXPIRE_MS ? p.input : emptyInput());
    stepMatch(room.state, inputs, dt / 1000);
    room.recentEvents.push(...room.state.events); room.state.events = [];
    if (room.recentEvents.length > 200) room.recentEvents.splice(0, room.recentEvents.length - 200);
    remaining -= dt;
  }
}
function responseFor(room, index, request, now, includeSession = false) {
  const paused = !!room.state && room.state.phase !== 'finished' && room.players.some(p => now - p.lastSeen > PRESENCE_MS);
  const messages = [];
  if (!room.state && room.departed && request.roundId !== undefined && request.roundId !== room.roundId) messages.push({ type: 'opponent_left', roundId: room.roundId });
  messages.push({ type: 'room', code: room.code, playerIndex: index,
    status: room.state?.phase === 'finished' ? 'finished' : room.state ? 'playing' : 'waiting', paused, roundId: room.roundId,
    players: room.players.map(p => ({ characterId: p.characterId, connected: now - p.lastSeen <= PRESENCE_MS, rematch: p.rematch })),
  });
  if (room.state) {
    const cursor = request.roundId === room.roundId && Number.isSafeInteger(request.afterEvent) ? request.afterEvent : 0;
    messages.push({ type: 'state', roundId: room.roundId, state: { ...room.state, events: room.recentEvents.filter(e => e.id > cursor) } });
  }
  return { messages, ...(includeSession ? { session: { code: room.code, token: request.token } } : {}), pollAfterMs: room.state?.phase === 'finished' ? 1000 : room.state ? POLL_AFTER_MS : 750 };
}
function validate(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) fail(400, 'INVALID_REQUEST', 'Mensagem inválida.');
  if (!['create', 'join', 'sync', 'resume', 'rematch', 'leave'].includes(message.type)) fail(400, 'INVALID_REQUEST', 'Comando inválido.');
  if (typeof message.token !== 'string' || !/^[a-f0-9]{64}$/.test(message.token)) fail(401, 'INVALID_SESSION', 'Sessão inválida. Crie ou entre em uma sala novamente.');
  if (message.type === 'create' || message.type === 'join') {
    if (!characterExists(message.characterId)) fail(400, 'INVALID_REQUEST', 'Escolha um personagem válido.');
  }
  if (message.seq !== undefined && (!Number.isSafeInteger(message.seq) || message.seq < 0)) fail(400, 'INVALID_REQUEST', 'Sequência de controles inválida.');
  if (message.afterEvent !== undefined && (!Number.isSafeInteger(message.afterEvent) || message.afterEvent < 0)) fail(400, 'INVALID_REQUEST', 'Sequência de eventos inválida.');
  if (message.input !== undefined && (!message.input || typeof message.input !== 'object' || Array.isArray(message.input))) fail(400, 'INVALID_REQUEST', 'Controles inválidos.');
}

export function createRoomService({ store, now = Date.now } = {}) {
  if (!store) throw new TypeError('A shared room store is required.');
  async function handle(message) {
    validate(message);
    const request = { ...message };
    request.code = request.type === 'create' || (request.type === 'leave' && !request.code)
      ? roomCodeForToken(request.token) : typeof request.code === 'string' ? request.code.trim().toUpperCase() : '';
    if (!/^[A-Z2-9]{6}$/.test(request.code)) fail(400, 'INVALID_REQUEST', 'Digite o código de sala com 6 caracteres.');
    const tokenHash = hashToken(request.token);
    for (let attempt = 0; attempt < 10; attempt++) {
      const stamp = now();
      const raw = await store.get(request.code);
      if (raw === null) {
        if (request.type !== 'create') fail(404, 'ROOM_NOT_FOUND', 'Sala não encontrada ou expirada. Crie uma nova sala.');
        const room = { version: 1, code: request.code, createdAt: stamp, touchedAt: stamp, revision: 0,
          players: [{ tokenHash, characterId: request.characterId, lastSeen: stamp, lastInputAt: stamp, input: emptyInput(), inputSeq: -1, rematch: false }],
          state: null, roundId: 0, lastStep: stamp, recentEvents: [], departed: false };
        if (await store.create(request.code, JSON.stringify(room))) return responseFor(room, 0, request, stamp, true);
        continue;
      }
      let room;
      try { room = JSON.parse(raw); } catch { fail(503, 'STORAGE_UNAVAILABLE', 'Não foi possível recuperar a sala. Tente novamente.'); }
      const originalIndex = room.players.findIndex(p => p.tokenHash === tokenHash);
      const expiredSelf = originalIndex >= 0 && stamp - room.players[originalIndex].lastSeen > RESUME_GRACE_MS;
      const retained = room.players.filter(p => stamp - p.lastSeen <= RESUME_GRACE_MS);
      if (retained.length !== room.players.length) { room.players = retained; resetRoom(room, stamp); }
      let index = room.players.findIndex(p => p.tokenHash === tokenHash);
      if (expiredSelf) {
        room.revision++; room.touchedAt = stamp;
        if (await store.compareAndSet(request.code, raw, room.players.length ? JSON.stringify(room) : null)) fail(410, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre na sala novamente.');
        continue;
      }
      if (request.type === 'create' && index < 0) fail(409, 'CODE_COLLISION', 'Não foi possível reservar esse código. Tente criar outra sala.');
      if (request.type === 'join' && index < 0) {
        if (room.players.length >= 2) fail(409, 'ROOM_FULL', 'Esta sala já tem dois jogadores.');
        room.players.push({ tokenHash, characterId: request.characterId, lastSeen: stamp, lastInputAt: stamp, input: emptyInput(), inputSeq: -1, rematch: false });
        index = room.players.length - 1;
        if (room.players.length === 2) startRound(room, stamp);
      } else if (index < 0) fail(401, 'INVALID_SESSION', 'Esta sessão não pertence à sala. Entre novamente.');
      const player = room.players[index];
      // Requests cannot move a fighter retroactively: advance with previously
      // acknowledged inputs, then accept this request's newer sequence.
      advance(room, stamp);
      for (const p of room.players) if (stamp - p.lastInputAt > INPUT_EXPIRE_MS) p.input = emptyInput();
      const wasDisconnected = stamp - player.lastSeen > PRESENCE_MS;
      player.lastSeen = stamp;
      if (request.type === 'resume' || wasDisconnected) { player.input = emptyInput(); player.lastInputAt = stamp; }
      if (request.type === 'sync' && request.input && request.seq !== undefined && request.seq > player.inputSeq) {
        player.input = Object.fromEntries(INPUT_KEYS.map(key => [key, request.input[key] === true]));
        player.inputSeq = request.seq; player.lastInputAt = stamp;
      }
      if (request.type === 'rematch') {
        if (room.state?.phase !== 'finished') fail(409, 'ROUND_NOT_FINISHED', 'A revanche estará disponível ao final da luta.');
        player.rematch = true;
        if (room.players.length === 2 && room.players.every(p => p.rematch)) startRound(room, stamp);
      }
      const replyIndex = index;
      if (request.type === 'leave') {
        room.players.splice(index, 1); resetRoom(room, stamp);
      }
      room.revision++; room.touchedAt = stamp;
      const next = room.players.length ? JSON.stringify(room) : null;
      if (!(await store.compareAndSet(request.code, raw, next))) continue;
      if (request.type === 'leave') return { messages: [{ type: 'left' }], pollAfterMs: 750 };
      return responseFor(room, replyIndex, request, stamp, ['create', 'join', 'resume'].includes(request.type));
    }
    fail(409, 'CONFLICT', 'A sala está recebendo controles ao mesmo tempo. Tente novamente.');
  }
  return { handle };
}
