import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { CHARACTERS, createMatch, stepMatch } from './public/engine.js';

const PUBLIC = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2' };
const characterExists = id => CHARACTERS.some(character => character.id === id);
const send = (socket, data) => {
  if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 512_000) socket.send(JSON.stringify(data));
};
const emptyInput = () => ({ left: false, right: false, jump: false, attack: false, special: false, block: false });

export function createGameServer({ port = Number(process.env.PORT || 3000), host = process.env.HOST || '0.0.0.0' } = {}) {
  const rooms = new Map();
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400).end('Requisição inválida'); return; }
    if (pathname === '/api/health') {
      response.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ ok: true, game: 'PVP GRUPO APANE', rooms: rooms.size }));
      return;
    }
    const filename = path.resolve(PUBLIC, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(PUBLIC + path.sep) || pathname.split('/').some(segment => segment.startsWith('.'))) {
      response.writeHead(403).end('Acesso negado'); return;
    }
    try {
      const data = await readFile(filename);
      response.writeHead(200, { 'Content-Type': MIME[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch { response.writeHead(404).end('Página não encontrada'); }
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });

  function notifyRoom(room) {
    room.players.forEach((player, playerIndex) => send(player.socket, {
      type: 'room', code: room.code, playerIndex,
      status: room.state?.phase === 'finished' ? 'finished' : room.state ? 'playing' : 'waiting',
      players: room.players.map(p => ({ characterId: p.characterId, connected: true, rematch: p.rematch })),
    }));
  }

  function leave(socket) {
    const room = rooms.get(socket.roomCode);
    socket.roomCode = null;
    if (!room) return;
    room.players = room.players.filter(player => player.socket !== socket);
    if (!room.players.length) { rooms.delete(room.code); return; }
    room.state = null;
    for (const player of room.players) {
      player.input = emptyInput(); player.rematch = false;
      send(player.socket, { type: 'opponent_left' });
    }
    notifyRoom(room);
  }

  function start(room) {
    room.state = createMatch(room.players.map(player => player.characterId));
    room.players.forEach(player => { player.input = emptyInput(); player.rematch = false; });
    notifyRoom(room);
    room.players.forEach(player => send(player.socket, { type: 'state', state: room.state }));
  }

  wss.on('connection', socket => {
    if (wss.clients.size > 512) { socket.close(1013, 'Servidor ocupado'); return; }
    socket.roomCode = null;
    socket.alive = true;
    socket.rateWindow = Date.now(); socket.rateCount = 0;
    socket.on('pong', () => { socket.alive = true; });
    socket.on('error', () => {});
    socket.on('message', buffer => {
      const now = Date.now();
      if (now - socket.rateWindow > 1000) { socket.rateWindow = now; socket.rateCount = 0; }
      if (++socket.rateCount > 150) { socket.close(1008, 'Muitas mensagens'); return; }
      let message;
      try { message = JSON.parse(buffer.toString()); }
      catch { send(socket, { type: 'error', message: 'Mensagem inválida.' }); return; }
      if (!message || typeof message !== 'object' || Array.isArray(message)) return;
      const error = text => send(socket, { type: 'error', message: text });
      if (message.type === 'create' || message.type === 'join') {
        if (!characterExists(message.characterId)) { error('Escolha um personagem válido.'); return; }
        if (socket.roomCode) { error('Saia da sala atual antes de entrar em outra.'); return; }
        let room;
        if (message.type === 'create') {
          if (rooms.size >= 256) { error('A arena está cheia. Tente novamente em instantes.'); return; }
          const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code;
          do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(code));
          room = { code, players: [], state: null };
          rooms.set(code, room);
        } else {
          const code = typeof message.code === 'string' ? message.code.trim().toUpperCase() : '';
          if (!/^[A-Z2-9]{6}$/.test(code)) { error('Digite um código de sala com 6 caracteres.'); return; }
          room = rooms.get(code);
          if (!room) { error('Sala não encontrada. Confira o código e tente novamente.'); return; }
          if (room.players.length >= 2) { error('Esta sala já tem dois jogadores.'); return; }
        }
        socket.roomCode = room.code;
        room.players.push({ socket, characterId: message.characterId, input: emptyInput(), lastInput: now, rematch: false });
        if (room.players.length === 2) start(room);
        else notifyRoom(room);
      } else if (message.type === 'input') {
        const room = rooms.get(socket.roomCode);
        const player = room?.players.find(p => p.socket === socket);
        if (player && message.input && typeof message.input === 'object') {
          for (const key of Object.keys(player.input)) player.input[key] = message.input[key] === true;
          player.lastInput = now;
        }
      } else if (message.type === 'rematch') {
        const room = rooms.get(socket.roomCode);
        if (!room || room.state?.phase !== 'finished') { error('A revanche estará disponível ao final da luta.'); return; }
        room.players.find(p => p.socket === socket).rematch = true;
        if (room.players.length === 2 && room.players.every(p => p.rematch)) start(room);
        else notifyRoom(room);
      } else if (message.type === 'leave') {
        leave(socket);
        send(socket, { type: 'left' });
      } else if (message.type === 'ping') send(socket, { type: 'pong' });
    });
    socket.on('close', () => leave(socket));
  });

  const interval = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (!room.state || room.state.phase === 'finished') continue;
      room.players.forEach(player => { if (now - player.lastInput > 1000) player.input = emptyInput(); });
      stepMatch(room.state, room.players.map(player => player.input), 1 / 30);
      room.players.forEach(player => send(player.socket, { type: 'state', state: room.state }));
      if (room.state.phase === 'finished') notifyRoom(room);
    }
  }, 1000 / 30);
  interval.unref();
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.alive) { socket.terminate(); continue; }
      socket.alive = false; socket.ping();
    }
  }, 30_000);
  heartbeat.unref();

  const ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server.address()));
  });
  async function close() {
    clearInterval(interval); clearInterval(heartbeat);
    wss.clients.forEach(socket => socket.terminate());
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  }
  return { server, wss, rooms, ready, close };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createGameServer();
  app.ready.then(address => console.log(`PVP GRUPO APANE ativo na porta ${address.port}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
  let stopping = false;
  const stop = () => { if (!stopping) { stopping = true; app.close().then(() => process.exit(0)); } };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
